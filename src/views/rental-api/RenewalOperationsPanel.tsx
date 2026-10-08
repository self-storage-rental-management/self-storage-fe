import { useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand } from "../../hooks/useRenewalCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getRenewalOperations,
  getRenewalPayableStatement,
  isUuid,
  listRenewalOperationEvents,
  sendRenewalOperation,
  validateEvidence,
  validateText,
} from "../../services/renewalOperationsApi"
import type {
  RenewalExceptionAction,
  RenewalOperationAction,
  RenewalOperationCommand,
  RenewalOperationEvent,
  RenewalOperationsRole,
  RenewalOperationState,
} from "../../types/renewalOperationsApi"
import ApiReadState from "./ApiReadState"
import ApiPager from "./ApiPager"
import {
  operationBlockedReason,
  operationLabels,
  phaseLabels,
  sourceLabels,
  vietnamLocalInstant,
} from "./operationsPresentation"
import { rentalDate, rentalError, rentalMoney, unknown } from "./presentation"

export const operationsInputClass =
  "mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
const eventLabels: Record<string, string> = {
  DEPOSIT: "Kết quả thanh toán cọc",
  CASH: "Biên nhận CASH",
  INCIDENT: "Sự cố cơ sở",
  EXCEPTION: "Quyết định ngoại lệ",
  REFUND: "Quyết định hoàn tiền",
  COMPLETION: "Hoàn tất ký gia hạn",
  ARRIVAL: "Khách đã đến",
  APPOINTMENT: "Lịch ký",
  CONFIRMATION: "Xác nhận ngoại lệ",
  EXPIRY: "Đối soát hết hạn",
}
const statusLabels: Record<string, string> = {
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  NOT_RECEIVED: "Chưa nhận được tiền",
  APPROVED_AWAITING_EXECUTION:
    "Đã duyệt — chờ thực thi hoàn tiền (chưa chuyển tiền)",
  REJECTED: "Từ chối",
  APPROVE_RESCHEDULE_BEFORE_CUTOFF:
    "Đề xuất đổi lịch trước cutoff — cần Customer xác nhận",
  REQUEST_POST_CUTOFF_REVIEW: "Yêu cầu xem xét sau cutoff — không kéo dài hạn",
  REJECT: "Từ chối",
  APPROVE: "Duyệt",
}
export function OperationEventCard({
  event: e,
}: {
  event: RenewalOperationEvent
}) {
  const d =
    e.data && typeof e.data === "object"
      ? e.data as Record<string, unknown>
      : {}
  const reservation =
    d.reservation && typeof d.reservation === "object"
      ? d.reservation as Record<string, unknown>
      : null
  const field = (key: string) =>
    typeof d[key] === "string" ? d[key] as string : null
  const amount =
    typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : null
  return (
    <article className="rounded border border-stone-200 p-3 space-y-1 text-sm break-words">
      <p className="font-semibold">
        {eventLabels[e.kind]} · {rentalDate(e.occurredAt)}
      </p>
      <p className="break-all">
        Mã sự kiện: {e.id}
        {e.actorId ? ` · Người thực hiện: ${e.actorId}` : ""}
      </p>
      {["outcome", "status", "action"].map((key) =>
        field(key) ? (
          <p key={key}>{statusLabels[field(key)!] || field(key)}</p>
        ) : null,
      )}
      {amount !== null && field("currency") && (
        <p>Số tiền: {rentalMoney(amount, field("currency")!)}</p>
      )}
      {["reason", "completionNote"].map((key) =>
        field(key) ? <p key={key}>{field(key)}</p> : null,
      )}
      {[
        "paidAt",
        "receivedAt",
        "start",
        "end",
        "appointmentAt",
        "revisedDeadline",
      ].map((key) =>
        field(key) ? (
          <p key={key}>
            {
              {
                paidAt: "Lúc trả cọc",
                receivedAt: "Lúc thu tiền",
                start: "Bắt đầu lịch",
                end: "Kết thúc lịch",
                appointmentAt: "Lịch đề nghị",
                revisedDeadline: "Hạn đề nghị",
              }[key]
            }
            : {rentalDate(field(key))}
          </p>
        ) : null,
      )}
      {[
        "paymentRef",
        "reference",
        "statementRef",
        "incidentId",
        "appointmentRef",
      ].map((key) =>
        field(key) ? (
          <p key={key} className="break-all">
            {key}: {field(key)}
          </p>
        ) : null,
      )}
      {Array.isArray(d.evidenceFileIds) && (
        <p className="break-all">
          Minh chứng (FileAsset):{" "}
          {d.evidenceFileIds.filter(isUuid).join(", ") ||
            "Không có tệp đính kèm"}
        </p>
      )}
      {reservation && (
        <div className="space-y-1">
          <p>
            Số tiền được dành để hoàn:{" "}
            {rentalMoney(
              typeof reservation.amount === "number"
                ? reservation.amount
                : null,
              typeof reservation.currency === "string"
                ? reservation.currency
                : "",
            )}
          </p>
          <p>
            Hạn xem xét:{" "}
            {rentalDate(
              typeof reservation.reviewDueAt === "string"
                ? reservation.reviewDueAt
                : null,
            )}{" "}
            · Hạn thực thi:{" "}
            {rentalDate(
              typeof reservation.executionDueAt === "string"
                ? reservation.executionDueAt
                : null,
            )}
          </p>
          <p>
            Đây là quyết định/dành khoản hoàn, không phải minh chứng đã chuyển
            tiền.
          </p>
        </div>
      )}
      {e.kind === "CASH" && <p>Biên nhận không tự hoàn tất gia hạn.</p>}
    </article>
  )
}

export function RenewalOperationsSummary({
  state: s,
}: {
  state: RenewalOperationState
}) {
  return (
    <Card className="p-4 space-y-2 text-sm">
      <h3 className="font-semibold text-lg">Ký & thanh toán gia hạn (D3)</h3>
      <p>
        Trạng thái: {phaseLabels[s.phase]} · Phiên bản workflow:{" "}
        {s.expectedVersion ?? unknown}
      </p>
      <p>Cọc được ghi nhận lúc: {rentalDate(s.depositPaidAt)}</p>
      <p>
        Hạn ký ban đầu: {rentalDate(s.originalSigningDeadline)} · Hạn ký hiệu
        lực: {rentalDate(s.effectiveSigningDeadline)}
      </p>
      <p>Cutoff thu hồi: {rentalDate(s.recoveryCutoff)}</p>
      <p>
        Lịch ký đã lưu:{" "}
        {s.appointmentRef
          ? `${rentalDate(s.appointmentStart)} → ${rentalDate(s.appointmentEnd)}`
          : "Chưa đặt lịch"}
      </p>
      <p className="break-all">
        Lượt khách đến: {s.arrivalRef || "Chưa ghi nhận"}
      </p>
      {s.completedAt && (
        <p className="break-all">
          Hoàn tất lúc: {rentalDate(s.completedAt)} · Người hoàn tất:{" "}
          {s.completedBy || unknown}
        </p>
      )}
      {s.pendingExceptionRef && (
        <p className="text-amber-800 break-all">
          Đề xuất ngoại lệ mới: {s.pendingExceptionRef}. BE chưa cung cấp nội
          dung lịch/hạn đề xuất cho Customer; chưa thể xác nhận trên FE.
        </p>
      )}
      {s.missingSources.length > 0 && (
        <section role="status" className="rounded bg-amber-50 p-3">
          <p className="font-semibold">
            Chưa đủ nguồn dùng chung; không dùng dữ liệu demo để thay thế:
          </p>
          <ul className="list-disc pl-5">
            {s.missingSources.map((ref) => (
              <li key={ref}>
                {sourceLabels[ref] || ref} ({ref})
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-stone-500">
        Chỉ bước Staff hoàn tất hợp lệ mới kéo dài ngày kết thúc thuê. Duyệt,
        trả cọc, đặt lịch và thu CASH không tự gia hạn.
      </p>
    </Card>
  )
}

function EventTimeline({
  role,
  id,
  category,
  identity,
}: {
  role: RenewalOperationsRole
  id: string
  category: "payments" | "refunds" | "facility-incidents"
  identity: string
}) {
  const [page, setPage] = useState(0)
  const read = useRentalApiResource(`${identity}:${category}:${page}`, () =>
    listRenewalOperationEvents(role, id, category, page),
  )
  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between gap-3">
        <h4 className="font-semibold">
          {
            {
              payments: "Lịch sử cọc & CASH D3",
              refunds: "Lịch sử quyết định hoàn tiền (không phải payout)",
              "facility-incidents": "Sự cố & xem xét ngoại lệ",
            }[category]
          }
        </h4>
        <Button variant="outline" onClick={read.refresh}>
          Tải lại
        </Button>
      </div>
      <ApiReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          {read.data.data.map((e) => (
            <OperationEventCard key={e.id} event={e} />
          ))}
          {read.data.data.length === 0 && (
            <p>
              Chưa có sự kiện D3 trong nhóm này. Không suy ra lịch sử thanh toán
              khác hoặc không có nợ.
            </p>
          )}
          <ApiPager pagination={read.data.pagination} onPage={setPage} />
        </>
      )}
    </Card>
  )
}

export default function RenewalOperationsPanel({
  id,
  role,
  facilityId,
  customerId,
  onChanged,
  onLocked,
}: {
  id: string
  role: RenewalOperationsRole
  facilityId?: string
  customerId?: string
  onChanged?: () => void
  onLocked?: (locked: boolean) => void
}) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}:${id}`
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<RenewalOperationAction>()
  const [lastEvent, setLastEvent] = useState<RenewalOperationEvent>()
  const [locked, setLocked] = useState(false)
  const read = useRentalApiResource(`${identity}:${revision}`, () =>
    getRenewalOperations(role, id),
  )
  const actions: RenewalOperationAction[] =
    role === "customer"
      ? ["deposit", "appointment", "reschedule", "confirmation"]
      : role === "staff"
        ? ["arrival", "incident", "cash", "completion"]
        : ["exception", "refund"]
  const lock = (value: boolean) => {
    setLocked(value)
    onLocked?.(value)
  }
  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => {
            setSelected(undefined)
            setRevision((v) => v + 1)
            onChanged?.()
          }}
        >
          Tải lại tiến độ D3
        </Button>
      </div>
      <ApiReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          <RenewalOperationsSummary state={read.data} />
          {lastEvent && (
            <div role="status">
              <p>Kết quả BE của thao tác vừa gửi:</p>
              <OperationEventCard event={lastEvent} />
            </div>
          )}
          <Card className="p-4 space-y-3">
            <p className="text-sm text-stone-500">
              BE kiểm tra lại quyền chuyên biệt, phân công, policy, hạn và số
              tiền ở mỗi thao tác; FE không cấp quyền chỉ vì có role.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {actions.map((action) => {
                const reason = operationBlockedReason(
                  read.data!,
                  role,
                  action,
                  actor,
                  facilityId,
                  customerId,
                )
                return (
                  <div key={action}>
                    <Button
                      variant="outline"
                      disabled={!!reason || locked}
                      onClick={() => setSelected(action)}
                    >
                      {operationLabels[action]}
                    </Button>
                    {reason && (
                      <p className="mt-1 text-xs text-stone-500">{reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
          {selected && (
            <OperationForm
              key={`${identity}:${revision}:${selected}`}
              action={selected}
              state={read.data}
              onLocked={lock}
              onCancel={() => {
                setSelected(undefined)
                setRevision((v) => v + 1)
                onChanged?.()
              }}
              onSuccess={(e) => {
                setLastEvent(e)
                setSelected(undefined)
                setRevision((v) => v + 1)
                onChanged?.()
              }}
            />
          )}
        </>
      )}
      <EventTimeline
        key={`${identity}:${revision}:payments`}
        identity={`${identity}:${revision}`}
        role={role}
        id={id}
        category="payments"
      />
      {role !== "staff" && (
        <EventTimeline
          key={`${identity}:${revision}:refunds`}
          identity={`${identity}:${revision}`}
          role={role}
          id={id}
          category="refunds"
        />
      )}
      {role === "manager" && (
        <EventTimeline
          key={`${identity}:${revision}:incidents`}
          identity={`${identity}:${revision}`}
          role={role}
          id={id}
          category="facility-incidents"
        />
      )}
    </div>
  )
}

function OperationForm({
  action,
  state: s,
  onLocked,
  onCancel,
  onSuccess,
}: {
  action: RenewalOperationAction
  state: RenewalOperationState
  onLocked: (locked: boolean) => void
  onCancel: () => void
  onSuccess: (event: RenewalOperationEvent) => void
}) {
  const command = useRenewalCommand()
  const pendingPayload = useRef<RenewalOperationCommand | undefined>(undefined)
  const locked = command.busy || command.uncertain
  const [reason, setReason] = useState("")
  const [evidence, setEvidence] = useState("")
  const [appointment, setAppointment] = useState("")
  const [deadline, setDeadline] = useState("")
  const [incidentId, setIncidentId] = useState("")
  const [incidentPage, setIncidentPage] = useState(0)
  const [exception, setException] = useState<RenewalExceptionAction>("REJECT")
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("REJECT")
  const [receipt, setReceipt] = useState("")
  const [signedFile, setSignedFile] = useState("")
  const [attested, setAttested] = useState(false)
  const [validation, setValidation] = useState<string>()
  const manager = action === "exception" || action === "refund"
  const cash = useRentalApiResource(
    `${s.renewalId}:${s.expectedVersion}:${action}:statement`,
    () =>
      action === "cash"
        ? getRenewalPayableStatement(s.renewalId)
        : Promise.resolve(null),
  )
  const incidents = useRentalApiResource(
    `${s.renewalId}:${s.expectedVersion}:${action}:incidents:${incidentPage}`,
    () =>
      manager
        ? listRenewalOperationEvents(
            "manager",
            s.renewalId,
            "facility-incidents",
            incidentPage,
          )
        : Promise.resolve(null),
  )
  useEffect(() => {
    onLocked(locked)
  }, [locked]) // Parent cannot dismiss/reload an uncertain mutation.
  const files = evidence.split(/[\s,;]+/).filter(Boolean)
  const needReason = ["reschedule", "incident", "exception", "refund"].includes(
    action,
  )
  const needFiles = ["arrival", "incident", "exception", "refund"].includes(
    action,
  )
  const rescheduleProposal =
    action === "exception" && exception === "APPROVE_RESCHEDULE_BEFORE_CUTOFF"
  const missingDecisionSources = rescheduleProposal
    ? ["BO_SIGNING_POLICY", "SERVICE_CALENDAR", "SHARED_HOLD_RETURN_RECOVERY"]
    : action === "refund" && decision === "APPROVE"
      ? ["REFUND_ENTITLEMENT_EXECUTION"]
      : []
  const decisionMissing = missingDecisionSources.filter((ref) =>
    s.missingSources.includes(ref),
  )
  const build = (): RenewalOperationCommand => {
    if (s.expectedVersion === null) throw new Error("Chưa có version.")
    const base = { expectedVersion: s.expectedVersion }
    if (needReason) validateText(reason)
    if (needFiles) validateEvidence(files)
    if (
      manager &&
      (!isUuid(incidentId) ||
        !incidents.data?.data.some(
          (e) => e.id === incidentId && e.kind === "INCIDENT",
        ))
    )
      throw new Error("Chọn sự cố thật từ trang danh sách đang tải.")
    switch (action) {
      case "deposit":
        return { action, body: base }
      case "appointment":
      case "reschedule":
        return {
          action,
          body: {
            ...base,
            appointmentAt: vietnamLocalInstant(appointment),
            ...(reason ? { reason } : {}),
          },
        }
      case "arrival":
        if (!s.appointmentRef) throw new Error("Thiếu lịch ký.")
        return {
          action,
          body: {
            ...base,
            appointmentRef: s.appointmentRef,
            evidenceFileIds: files,
          },
        }
      case "incident":
        if (!s.appointmentRef) throw new Error("Thiếu lịch ký.")
        return {
          action,
          body: {
            ...base,
            appointmentRef: s.appointmentRef,
            reason,
            evidenceFileIds: files,
          },
        }
      case "cash": {
        const statement = cash.data
        if (
          !statement ||
          statement.amount <= 0 ||
          Date.parse(statement.expiresAt) <= Date.now() ||
          !attested
        )
          throw new Error(
            "Cần statement còn hạn, số tiền lớn hơn 0 và xác nhận đã nhận CASH thật.",
          )
        validateText(receipt, true, 100)
        return {
          action,
          body: {
            ...base,
            payableStatementRef: statement.reference,
            receiptReference: receipt,
            received: true,
          },
        }
      }
      case "completion":
        if (!s.arrivalRef || !isUuid(signedFile) || !attested)
          throw new Error(
            "Cần lượt đến, FileAsset văn bản đã ký và xác nhận danh tính.",
          )
        validateText(reason, false)
        return {
          action,
          body: {
            ...base,
            arrivalRef: s.arrivalRef,
            signedDocumentFileId: signedFile,
            identityVerified: true,
            completionNote: reason,
          },
        }
      case "exception":
        return {
          action,
          body: {
            ...base,
            incidentId,
            action: exception,
            reason,
            evidenceFileIds: files,
            ...(rescheduleProposal
              ? {
                  appointmentAt: vietnamLocalInstant(appointment),
                  revisedDeadline: vietnamLocalInstant(deadline),
                }
              : {}),
          },
        }
      case "refund":
        return {
          action,
          body: {
            ...base,
            incidentId,
            decision,
            reason,
            evidenceFileIds: files,
          },
        }
      case "confirmation":
        throw new Error("Chưa có nội dung đề xuất để Customer xác nhận.")
    }
  }
  return (
    <Card className="p-4 space-y-3">
      <h4 className="font-semibold">{operationLabels[action]}</h4>
      <fieldset disabled={locked} className="space-y-3">
        {manager && (
          <>
            <ApiReadState {...incidents} retry={incidents.refresh} />
            <label className="block">
              Sự cố liên quan
              <select
                className={operationsInputClass}
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
              >
                <option value="">Chọn sự cố đã ghi nhận</option>
                {incidents.data?.data
                  .filter((e) => e.kind === "INCIDENT")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {rentalDate(e.occurredAt)} · {e.id}
                    </option>
                  ))}
              </select>
            </label>
            {incidents.data && (
              <>
                <div className="space-y-2">
                  {incidents.data.data
                    .filter((e) => e.kind === "INCIDENT" && e.id === incidentId)
                    .map((e) => (
                      <OperationEventCard key={e.id} event={e} />
                    ))}
                </div>
                <ApiPager
                  pagination={incidents.data.pagination}
                  onPage={(p) => {
                    setIncidentId("")
                    setIncidentPage(p)
                  }}
                />
              </>
            )}
          </>
        )}
        {action === "exception" && (
          <label className="block">
            Quyết định
            <select
              className={operationsInputClass}
              value={exception}
              onChange={(e) =>
                setException(e.target.value as RenewalExceptionAction)
              }
            >
              <option value="REJECT">Từ chối ngoại lệ</option>
              <option value="APPROVE_RESCHEDULE_BEFORE_CUTOFF">
                Đề xuất đổi lịch trước cutoff (cần Customer xác nhận)
              </option>
              <option value="REQUEST_POST_CUTOFF_REVIEW">
                Yêu cầu xem xét sau cutoff (không gia hạn tự động)
              </option>
            </select>
          </label>
        )}
        {action === "refund" && (
          <>
            <label className="block">
              Quyết định
              <select
                className={operationsInputClass}
                value={decision}
                onChange={(e) =>
                  setDecision(e.target.value as "APPROVE" | "REJECT")
                }
              >
                <option value="REJECT">Từ chối</option>
                <option value="APPROVE">Duyệt khoản hoàn — chờ thực thi</option>
              </select>
            </label>
            <p>
              Không nhập số tiền tự tính. BE xác minh tiền thực thu, policy và
              khoản hoàn đang chờ; duyệt không có nghĩa đã chuyển tiền.
            </p>
          </>
        )}
        {(["appointment", "reschedule"].includes(action) ||
          rescheduleProposal) && (
          <label className="block">
            Lịch ký đề nghị (giờ Việt Nam)
            <input
              type="datetime-local"
              className={operationsInputClass}
              value={appointment}
              onChange={(e) => setAppointment(e.target.value)}
            />
            <span className="text-xs text-stone-500">
              Đây là đề nghị, không phải slot đã giữ. BE kiểm tra lịch phục vụ
              và toàn bộ thời lượng slot.
            </span>
          </label>
        )}
        {rescheduleProposal && (
          <label className="block">
            Hạn ký đề nghị (giờ Việt Nam)
            <input
              type="datetime-local"
              className={operationsInputClass}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        )}
        {(needReason || action === "completion") && (
          <label className="block">
            {action === "completion" ? "Ghi chú hoàn tất" : "Lý do (bắt buộc)"}
            <textarea
              className={operationsInputClass}
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        {needFiles && (
          <label className="block">
            Minh chứng đã lưu (FileAsset UUID, nếu có)
            <textarea
              className={operationsInputClass}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
            <span className="text-xs text-stone-500">
              Tối đa 10 UUID, cách nhau bằng dấu phẩy. Chỉ dùng tệp thật đã liên
              kết với hồ sơ. Chưa có contract upload Renewal; không dùng upload
              Check-in hoặc URL tùy ý.
            </span>
          </label>
        )}
        {action === "cash" && (
          <>
            <ApiReadState {...cash} retry={cash.refresh} />
            {cash.data && (
              <div className="space-y-2">
                <p>
                  Số tiền theo statement BE:{" "}
                  {rentalMoney(cash.data.amount, cash.data.currency)}
                </p>
                <p>Hết hiệu lực: {rentalDate(cash.data.expiresAt)}</p>
                <p className="break-all">
                  Statement: {cash.data.reference} · version {cash.data.version}
                </p>
                <p className="break-all">
                  Nghĩa vụ: {cash.data.requiredObligations.join(", ")}
                </p>
              </div>
            )}
            <label className="block">
              Mã biên nhận thực tế
              <input
                className={operationsInputClass}
                value={receipt}
                maxLength={100}
                onChange={(e) => setReceipt(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
              />{" "}
              Tôi đã nhận đủ số CASH theo statement
            </label>
          </>
        )}
        {action === "completion" && (
          <>
            <label className="block">
              FileAsset UUID của văn bản gia hạn đã ký
              <input
                className={operationsInputClass}
                value={signedFile}
                onChange={(e) => setSignedFile(e.target.value.trim())}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
              />{" "}
              Đã xác minh danh tính khách
            </label>
            <p>
              BE kiểm tra đã thanh toán đầy đủ, minh chứng, trả kho, giữ chỗ và
              hạn. Không hoàn tất thay khi một gate chưa đủ.
            </p>
          </>
        )}
        {action === "deposit" && (
          <p>
            API simulated-payment của BE chỉ xử lý cọc theo điều khoản đã chấp
            nhận, không cho nhập số tiền/kết quả tùy ý. Hãy xem kết quả sự kiện;
            gửi thành công không đồng nghĩa thanh toán thành công.
          </p>
        )}
      </fieldset>
      {decisionMissing.length > 0 && (
        <p role="status" className="text-amber-700">
          Chưa kết nối:{" "}
          {decisionMissing.map((ref) => sourceLabels[ref] || ref).join("; ")}
        </p>
      )}
      {validation && <p role="alert">{validation}</p>}
      {command.error ? <p role="alert">{rentalError(command.error)}</p> : null}
      {command.uncertain && (
        <p role="alert">
          Kết quả chưa xác định. Giữ nguyên nội dung, thử lại cùng key; không
          đổi yêu cầu hoặc đóng/tải lại.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={
            command.busy || command.conflict || decisionMissing.length > 0
          }
          onClick={() => {
            let payload: RenewalOperationCommand
            try {
              payload =
                command.uncertain && pendingPayload.current
                  ? pendingPayload.current
                  : build()
              setValidation(undefined)
            } catch (e) {
              setValidation(rentalError(e))
              return
            }
            pendingPayload.current = payload
            onLocked(true)
            let event: RenewalOperationEvent | undefined
            void command.run(
              JSON.stringify({ id: s.renewalId, ...payload }),
              async (key) => {
                const result = await sendRenewalOperation(
                  s.renewalId,
                  payload,
                  key,
                )
                event = result.event
                return result
              },
              () => {
                onLocked(false)
                onSuccess(event!)
              },
            )
          }}
        >
          {command.busy
            ? "Đang gửi…"
            : command.uncertain
              ? "Thử lại cùng yêu cầu"
              : "Gửi yêu cầu"}
        </Button>
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => {
            onLocked(false)
            onCancel()
          }}
        >
          Đóng biểu mẫu
        </Button>
      </div>
    </Card>
  )
}
