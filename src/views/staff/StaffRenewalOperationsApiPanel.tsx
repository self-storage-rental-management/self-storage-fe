import { useCallback, useRef, useState } from "react"
import { Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { listRenewalAppointments } from "../../services/renewalOperationsApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { RenewalAppointmentQuery } from "../../types/renewalOperationsApi"
import ApiPager from "../rental-api/ApiPager"
import RecoveryTasksPanel from "../rental-api/RecoveryTasksPanel"
import RenewalOperationsPanel, {
  operationsInputClass,
} from "../rental-api/RenewalOperationsPanel"
import { phaseLabels } from "../rental-api/operationsPresentation"
import { rentalDate, rentalError } from "../rental-api/presentation"

export default function StaffRenewalOperationsApiPanel() {
  return <StaffRenewalWorkspace />
}
function StaffRenewalWorkspace() {
  const actor = getAuthenticatedActor()
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    !actor.roles.includes("STAFF") ||
    !Object.values(actor.facilityScopes).some(
      (v) => v === "OPERATE" || v === "MANAGE",
    )
  )
    return (
      <Card className="p-5">
        Tài khoản nhân viên chưa được cấp quyền vận hành tại cơ sở.
        Vui lòng liên hệ quản lý để kiểm tra phân công.
      </Card>
    )
  const identity = `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}`
  return <StaffWorkspaceTabs key={identity} identity={identity} />
}
function StaffWorkspaceTabs({ identity }: { identity: string }) {
  const actor = getAuthenticatedActor()!
  const facilities = Object.entries(actor.facilityScopes).filter(([, scope]) => scope === "OPERATE" || scope === "MANAGE")
  const [tab, setTab] = useState<"signing" | "recovery">("signing")
  const [locked, setLocked] = useState(false)
  const [facilityId, setFacilityId] = useState(facilities[0]?.[0] ?? "")
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">Ký gia hạn tại cơ sở</h1>
    <div className="flex gap-2" aria-label="Danh sách công việc">
      <Button disabled={locked} variant={tab === "signing" ? "primary" : "outline"} aria-pressed={tab === "signing"} onClick={() => setTab("signing")}>Lịch ký gia hạn</Button>
      <Button disabled={locked} variant={tab === "recovery" ? "primary" : "outline"} aria-pressed={tab === "recovery"} onClick={() => setTab("recovery")}>Thu hồi kho</Button>
    </div>
    {tab === "signing" ? <StaffSession identity={identity} onLocked={setLocked} /> : <>
      {facilities.length > 1 && <label className="block max-w-md">Cơ sở<select className={operationsInputClass} value={facilityId} onChange={event => setFacilityId(event.target.value)}>
        {facilities.map(([id]) => <option key={id} value={id}>{actor.facilityNames?.[id] || id}</option>)}
      </select></label>}
      <RecoveryTasksPanel role="staff" facilityId={facilityId} />
    </>}
  </div>
}
function StaffSession({ identity, onLocked }: { identity: string; onLocked: (value: boolean) => void }) {
  const actor = getAuthenticatedActor()!
  const [query, setQuery] = useState<RenewalAppointmentQuery>({
    page: 0,
    size: 20,
  })
  const [selected, setSelected] = useState<string>()
  const lockRef = useRef(false)
  const setLocked = useCallback((value: boolean) => { lockRef.current = value; onLocked(value) }, [onLocked])
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => listRenewalAppointments(query),
  )
  const change = (patch: RenewalAppointmentQuery) => {
    if (lockRef.current) return
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
    setSelected(undefined)
  }
  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <label>
          Cơ sở
          <select
            className={operationsInputClass}
            value={query.facilityId || ""}
            onChange={(e) =>
              change({ facilityId: e.target.value || undefined })
            }
          >
            <option value="">Các cơ sở được vận hành</option>
            {Object.entries(actor.facilityScopes)
              .filter(([, scope]) => scope === "OPERATE" || scope === "MANAGE")
              .map(([id]) => (
                <option key={id} value={id}>
                  {actor.facilityNames?.[id] || id}
                </option>
              ))}
          </select>
        </label>
        <label>
          Ngày hẹn
          <input
            className={operationsInputClass}
            type="date"
            value={query.date || ""}
            onChange={(e) => change({ date: e.target.value || undefined })}
          />
        </label>
        <label>
          Trạng thái
          <select
            className={operationsInputClass}
            value={query.status || ""}
            onChange={(e) =>
              change({
                status: (e.target.value ||
                  undefined) as RenewalAppointmentQuery["status"],
              })
            }
          >
            <option value="">Tất cả</option>
            {(["SIGNING", "SIGNING_EXPIRED", "COMPLETED"] as const).map((v) => (
              <option key={v} value={v}>
                {phaseLabels[v]}
              </option>
            ))}
          </select>
        </label>
      </Card>
      {read.loading && (
        <p role="status" className="p-4 text-stone-500">
          Đang tải dữ liệu…
        </p>
      )}
      {Boolean(read.error) && (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <p>{rentalError(read.error)}</p>
        </div>
      )}
      {read.data && (
        <Card className="p-4 space-y-3">
          {read.data.data.map((s) => (
            <div
              key={s.renewalId}
              className="flex flex-wrap justify-between gap-3 rounded border p-3"
            >
              <div className="text-sm space-y-1 min-w-0">
                <p className="break-all">Gia hạn: {s.renewalId}</p>
                <p>{phaseLabels[s.phase]}</p>
                <p>
                  {rentalDate(s.appointmentStart)} -{" "}
                  {rentalDate(s.appointmentEnd)}
                </p>
                <p>Hạn ký: {rentalDate(s.effectiveSigningDeadline)}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => { if (!lockRef.current) setSelected(s.renewalId) }}
              >
                Xử lý
              </Button>
            </div>
          ))}
          {read.data.data.length === 0 && (
            <p>Không có dữ liệu</p>
          )}
          <ApiPager
            pagination={read.data.pagination}
            onPage={(page) => { if (!lockRef.current) setQuery((q) => ({ ...q, page })) }}
          />
        </Card>
      )}
      {selected && (
        <Modal
          open
          size="xl"
          title="Xử lý ký gia hạn - Nhân viên"
          onClose={() => {
            if (!lockRef.current) setSelected(undefined)
          }}
        >
          <RenewalOperationsPanel
            key={`${identity}:${selected}`}
            role="staff"
            id={selected}
            onLocked={setLocked}
            onChanged={read.refresh}
          />
        </Modal>
      )}
    </div>
  )
}
