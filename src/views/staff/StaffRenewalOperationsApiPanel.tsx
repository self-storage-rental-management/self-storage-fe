import { parseVietnamDate } from '../../utils/vietnamTime'
import LocalizedDateInput from '../../components/LocalizedDateInput'
import { useCallback, useRef, useState } from "react"
import { Badge, Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { listRenewalAppointments } from "../../services/renewalOperationsApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { RenewalAppointmentQuery } from "../../types/renewalOperationsApi"
import ApiPager from "../rental-api/ApiPager"
import RenewalOperationsPanel, {
  operationsInputClass,
} from "../rental-api/RenewalOperationsPanel"
import { phaseLabels } from "../rental-api/operationsPresentation"
import { rentalError } from "../rental-api/presentation"

function signingDate(value: string | null, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Chưa có lịch"
  return new Intl.DateTimeFormat("vi-VN", time
    ? { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(parseVietnamDate(value))
}

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
  const [, setLocked] = useState(false)
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">Ký gia hạn tại cơ sở</h1>
    <StaffSession identity={identity} onLocked={setLocked} />
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
      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block min-w-0 text-sm font-medium text-stone-700">
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
        <label className="block min-w-0 text-sm font-medium text-stone-700">
          Ngày hẹn
          <LocalizedDateInput
            className={operationsInputClass}
            type="date"
            value={query.date || ""}
            onChange={(e) => change({ date: e.target.value || undefined })}
          />
        </label>
        <label className="block min-w-0 text-sm font-medium text-stone-700">
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
      {read.data && <>
        {[
          { id: 'ongoing', title: 'Đang diễn ra', empty: 'Không có lịch ký đang diễn ra.', rows: read.data.data.filter(s => !['COMPLETED', 'SIGNING_EXPIRED', 'PAYMENT_EXPIRED'].includes(s.phase)) },
          { id: 'finished', title: 'Đã kết thúc', empty: 'Chưa có lịch ký đã kết thúc.', rows: read.data.data.filter(s => ['COMPLETED', 'SIGNING_EXPIRED', 'PAYMENT_EXPIRED'].includes(s.phase)) },
        ].map(group => (
        <Card key={group.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">{group.title}</h2>
            <span className="text-xs text-stone-500">{group.rows.length} hồ sơ</span>
          </div>
          {group.rows.length > 0 ? <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="sr-only">Lịch ký gia hạn - {group.title}</caption>
              <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Hồ sơ gia hạn</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Lịch hẹn</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Hạn ký</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {group.rows.map(s => <tr key={s.renewalId} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-4 align-middle">
                    <span className="font-semibold text-stone-900" title={s.renewalId}>{s.displayCode || `#${s.renewalId.slice(0, 8)}`}</span>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <Badge variant={s.phase === "COMPLETED" ? "success" : ["SIGNING_EXPIRED", "PAYMENT_EXPIRED"].includes(s.phase) ? "error" : ["SIGNING", "AWAITING_DEPOSIT", "AWAITING_PAYMENT_INTENT"].includes(s.phase) ? "warning" : "muted"}>{phaseLabels[s.phase]}</Badge>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <p className="whitespace-nowrap font-medium text-stone-900">{signingDate(s.appointmentStart)}</p>
                    {s.appointmentStart && <p className="mt-1 whitespace-nowrap text-xs text-stone-500">
                      {signingDate(s.appointmentStart, true)}{s.appointmentEnd ? `, ${signingDate(s.appointmentEnd, true)}` : ""}
                      {s.appointmentEnd && signingDate(s.appointmentEnd) !== signingDate(s.appointmentStart) ? ` (${signingDate(s.appointmentEnd)})` : ""}
                    </p>}
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <p className="whitespace-nowrap text-stone-700">{s.effectiveSigningDeadline ? signingDate(s.effectiveSigningDeadline) : "Chưa ghi nhận"}</p>
                    {s.effectiveSigningDeadline && <p className="mt-1 text-xs text-stone-500">{signingDate(s.effectiveSigningDeadline, true)}</p>}
                  </td>
                  <td className="px-4 py-4 text-right align-middle">
                    <Button type="button" size="sm" variant="outline" className="whitespace-nowrap" onClick={() => { if (!lockRef.current) setSelected(s.renewalId) }}>
                      {["COMPLETED", "SIGNING_EXPIRED", "PAYMENT_EXPIRED"].includes(s.phase) ? "Xem chi tiết" : "Xử lý"}
                    </Button>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div> : <p className="px-4 py-8 text-center text-sm text-stone-500">{group.empty}</p>}
        </Card>
        ))}
        {read.data.pagination.totalPages > 1 && <Card>
          <div className="border-t border-stone-200 px-4 py-3">
            <ApiPager
              pagination={read.data.pagination}
              onPage={(page) => { if (!lockRef.current) setQuery((q) => ({ ...q, page })) }}
            />
          </div>
        </Card>}
      </>}
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
