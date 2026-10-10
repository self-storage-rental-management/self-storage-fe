import { useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  coordinateRenewal,
  getRenewalAssignment,
  integrationError,
  type RenewalCoordination,
  type RenewalAssignmentView,
} from "../../services/duongIntegrationApi"
import {
  listRenewalOperationEvents,
  isUuid,
} from "../../services/renewalOperationsApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import {
  useRenewalCommand,
  isUncertainRenewalOutcome,
} from "../../hooks/useRenewalCommand"
import type { RenewalOperationState, RenewalOperationEvent } from "../../types/renewalOperationsApi"
import ApiPager from "../rental-api/ApiPager"
import { EvidenceUpload } from "./EvidenceControls"

export function canCoordinateRenewal(facilityId?: string) {
  const a = getAuthenticatedActor()
  return (
    !!a &&
    a.status === "ACTIVE" &&
    a.roles.includes("MANAGER") &&
    ["rentals:read", "rentals:update"].every((p) =>
      a.permissions.includes(p),
    ) &&
    !!facilityId &&
    a.facilityScopes[facilityId] === "MANAGE"
  )
}
export default function RenewalCoordinationPanel({
  state,
  facilityId,
  status,
  onLocked,
  onChanged,
}: {
  state: RenewalOperationState
  facilityId?: string
  status?: string
  onLocked: (locked: boolean) => void
  onChanged: (event?: RenewalOperationEvent) => void
}) {
  const [action, setAction] = useState<"assignment" | "fault">("assignment"),
    [staff, setStaff] = useState(""),
    [reason, setReason] = useState(""),
    [incident, setIncident] = useState(""),
    [verdict, setVerdict] = useState(""),
    [files, setFiles] = useState<string[]>([]),
    [uploading, setUploading] = useState(false),
    [page, setPage] = useState(0),
    [validation, setValidation] = useState<string>()
  const command = useRenewalCommand(),
    payload = useRef<RenewalCoordination | undefined>(undefined),
    actor = getAuthenticatedActor()
  const locked = command.busy || command.uncertain || uploading
  const uploadLock = useRef(false)
  const uploadBusy = (busy: boolean) => {
    uploadLock.current = busy
    setUploading(busy)
    onLocked(busy || command.isLocked())
  }
  useEffect(() => {
    onLocked(uploadLock.current || command.isLocked())
  }, [locked, onLocked])
  const incidents = useRentalApiResource(
    `${actor?.id}:${state.renewalId}:${state.expectedVersion}:coordination:${action}:${page}`,
    () =>
      action === "fault"
        ? listRenewalOperationEvents(
            "manager",
            state.renewalId,
            "facility-incidents",
            page,
          )
        : Promise.resolve(null),
  )
  const assignment = useRentalApiResource(
    `${actor?.id}:${state.renewalId}:${state.expectedVersion}:assignment:${canCoordinateRenewal(facilityId)}`,
    () => canCoordinateRenewal(facilityId) ? getRenewalAssignment(state.renewalId) : Promise.resolve(null),
  )
  if (!canCoordinateRenewal(facilityId))
    return (
      <p className="text-sm text-stone-500">
        Phân công và xác minh sự cố cần quyền quản lý gia hạn tại cơ sở.
      </p>
    )
  const terminal = ["completed", "cancelled", "rejected", "payment_expired"].includes(status || "") || state.expectedVersion === null
  // Do not discard an uncertain command: replay must keep its original key/body.
  if (terminal && !command.busy && !command.uncertain) return null
  const assignmentAllowed = status === "approved" && state.arrivalRef === null
  const inputClass =
    "mt-1 block w-full rounded border border-stone-300 px-3 py-2"
  return (
    <Card className="p-4 space-y-3 text-sm">
      <h4 className="font-semibold">Điều phối gia hạn</h4>
      {assignment.loading && <p role="status">Đang tải phân công...</p>}
      {!!assignment.error && <p role="alert">{integrationError(assignment.error)}</p>}
      {assignment.data && <RenewalAssignmentSummary assignment={assignment.data} expectedVersion={state.expectedVersion} />}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (uploadLock.current || command.busy || command.conflict) return
          if (terminal && !payload.current) return
          setValidation(undefined)
          if (!canCoordinateRenewal(facilityId)) {
            setValidation("Bạn không còn quyền xử lý hồ sơ này.")
            return
          }
          if (!payload.current) {
            if (
              !reason.trim() ||
              reason.length > 2000 ||
              (action === "assignment"
                ? !assignmentAllowed || !isUuid(staff)
                : !incidents.data?.data.some(
                    (e) => e.id === incident && e.kind === "INCIDENT",
                  ) || !["true", "false"].includes(verdict))
            ) {
              setValidation("Vui lòng chọn hồ sơ phù hợp và nhập đủ thông tin.")
              return
            }
            payload.current =
              action === "assignment"
                ? {
                    kind: action,
                    assignedStaffId: staff,
                    reason: reason.trim(),
                    expectedVersion: state.expectedVersion!,
                  }
                : {
                    kind: action,
                    incidentId: incident,
                    facilityFault: verdict === "true",
                    evidenceFileIds: files,
                    reason: reason.trim(),
                    expectedVersion: state.expectedVersion!,
                  }
          }
          const body = payload.current
          let event: RenewalOperationEvent | undefined
          onLocked(true)
          void command.run(
            JSON.stringify({ id: state.renewalId, body }),
            async (key) => {
              try {
                const result = await coordinateRenewal(state.renewalId, body, key)
                event = result.event
                return result
              } catch (error) {
                if (!command.uncertain && !isUncertainRenewalOutcome(error))
                  payload.current = undefined
                throw error
              }
            },
            () => {
              payload.current = undefined
              onChanged(event)
            },
          ).finally(() => {
            onLocked(uploadLock.current || command.isLocked())
          })
        }}
      >
        <fieldset disabled={terminal || locked || command.conflict} className="space-y-3">
          <label className="block">
            Thao tác
            <select
              className={inputClass}
              value={action}
              onChange={(e) => {
                setAction(e.target.value as "assignment" | "fault")
                setFiles([])
                setIncident("")
                setPage(0)
                payload.current = undefined
              }}
            >
              <option value="assignment">Phân công nhân viên</option>
              <option value="fault">Xác minh lỗi cơ sở</option>
            </select>
          </label>
          {action === "assignment" ? (
            <>
              <label className="block">
                Mã nhân viên phụ trách
                <input
                  className={inputClass}
                  value={staff}
                  onChange={(e) => {
                    setStaff(e.target.value)
                    payload.current = undefined
                  }}
                  required
                />
              </label>
              {!assignmentAllowed && (
                <p role="status">
                  Chỉ phân công khi yêu cầu đã được duyệt và chưa ghi nhận khách
                  đến.
                </p>
              )}
            </>
          ) : (
            <>
              {incidents.loading && <p role="status">Đang tải sự cố...</p>}
              {incidents.error && (
                <p role="alert">{integrationError(incidents.error)}</p>
              )}
              <label className="block">
                Sự cố cần xác minh
                <select
                  className={inputClass}
                  value={incident}
                  onChange={(e) => {
                    setIncident(e.target.value)
                    payload.current = undefined
                  }}
                  required
                >
                  <option value="">Chọn sự cố</option>
                  {incidents.data?.data
                    .filter((e) => e.kind === "INCIDENT")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.occurredAt} · {e.id}
                      </option>
                    ))}
                </select>
              </label>
              {incidents.data && (
                <ApiPager
                  pagination={incidents.data.pagination}
                  disabled={locked}
                  onPage={(p) => {
                    setIncident("")
                    setPage(p)
                    payload.current = undefined
                  }}
                />
              )}
              <label className="block">
                Kết luận
                <select
                  className={inputClass}
                  value={verdict}
                  onChange={(e) => {
                    setVerdict(e.target.value)
                    payload.current = undefined
                  }}
                  required
                >
                  <option value="">Chọn kết luận</option>
                  <option value="true">Lỗi thuộc cơ sở</option>
                  <option value="false">Không xác nhận lỗi thuộc cơ sở</option>
                </select>
              </label>
              <EvidenceUpload
                entityType="DUONG_RENEWAL_FAULT_REVIEW"
                entityId={state.renewalId}
                value={files}
                onChange={(v) => {
                  setFiles(v)
                  payload.current = undefined
                }}
                onBusy={uploadBusy}
              />
            </>
          )}
          <label className="block">
            Lý do
            <textarea
              className={inputClass}
              maxLength={2000}
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                payload.current = undefined
              }}
            />
          </label>
        </fieldset>
        {validation && <p role="alert">{validation}</p>}
        {!!command.error && (
          <p role="alert">{integrationError(command.error)}</p>
        )}
        {command.uncertain && (
          <p role="status">
            Kết quả chưa xác định. Thử lại cùng nội dung, không đổi yêu cầu.
          </p>
        )}
        <Button
          type="submit"
          disabled={
            command.busy ||
            uploading ||
            command.conflict ||
            (!command.uncertain && (terminal || (action === "assignment" && !assignmentAllowed)))
          }
        >
          {command.uncertain
            ? "Thử lại cùng yêu cầu"
            : action === "assignment"
              ? "Ghi nhận phân công"
              : "Ghi nhận kết luận"}
        </Button>
        {command.conflict && (
          <Button type="button" variant="outline" onClick={() => onChanged()}>
            Kiểm tra lại hồ sơ
          </Button>
        )}
      </form>
    </Card>
  )
}

export function RenewalAssignmentSummary({ assignment, expectedVersion }: {
  assignment: RenewalAssignmentView
  expectedVersion: number | null
}) {
  if (assignment.expectedVersion !== expectedVersion || assignment.status === "UNAVAILABLE")
    return <p role="status">Chưa xác minh được nhân viên phụ trách. Kiểm tra lại hồ sơ.</p>
  if (assignment.status === "UNASSIGNED") return <p>Chưa phân công nhân viên.</p>
  return <div>
    <p>Nhân viên phụ trách: {assignment.staffName || assignment.staffId}</p>
    {assignment.status === "INELIGIBLE" && <p role="status">Nhân viên được phân công hiện không đủ điều kiện xử lý hồ sơ.</p>}
  </div>
}
