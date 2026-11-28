import { parseVietnamDate } from '../../utils/vietnamTime'
import LocalizedDateInput from '../../components/LocalizedDateInput'
import { useCallback, useRef, useState } from "react"
import { Badge, Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor, staffWorkingFacilityId } from "../../services/authApi"
import { listRenewalAppointments } from "../../services/renewalOperationsApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { RenewalAppointmentQuery } from "../../types/renewalOperationsApi"
import ApiPager from "../rental-api/ApiPager"
import RenewalOperationsPanel, {
  operationsInputClass,
} from "../rental-api/RenewalOperationsPanel"
import { phaseLabels } from "../rental-api/operationsPresentation"
import { renewalDisplayLabel, rentalDate, rentalError } from "../rental-api/presentation"

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
    facilityId: staffWorkingFacilityId(actor),
    sort: "appointmentStart,asc",
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
      <Card className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <label className="block min-w-0 text-sm font-medium text-stone-700">
          Sắp xếp
          <select className={operationsInputClass} value={query.sort || 'appointmentStart,asc'}
            onChange={event => change({ sort: event.target.value as RenewalAppointmentQuery['sort'] })}>
            <option value="appointmentStart,asc">Lịch hẹn sớm nhất</option>
            <option value="createdAt,desc">Mới nhất</option>
            <option value="createdAt,asc">Cũ nhất</option>
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
            {(["SIGNING", "NO_SHOW", "SIGNING_EXPIRED", "COMPLETED"] as const).map((v) => (
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
          { id: 'ongoing', title: 'Đang diễn ra', empty: 'Không có lịch ký đang diễn ra.', rows: read.data.data.filter(s => !['COMPLETED', 'NO_SHOW', 'SIGNING_EXPIRED', 'PAYMENT_EXPIRED'].includes(s.phase)) },
          { id: 'finished', title: 'Đã kết thúc', empty: 'Chưa có lịch ký đã kết thúc.', rows: read.data.data.filter(s => ['COMPLETED', 'NO_SHOW', 'SIGNING_EXPIRED', 'PAYMENT_EXPIRED'].includes(s.phase)) },
        ].map(group => (
        <Card key={group.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4">
            <h2 className="text-base font-semibold text-stone-900">{group.title}</h2>
            <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">{group.rows.length} hồ sơ</span>
          </div>
          {group.rows.length > 0 ? <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
              <caption className="sr-only">Lịch ký gia hạn - {group.title}</caption>
              <colgroup><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[16%]" /><col className="w-[10%]" /></colgroup>
              <thead className="border-y border-stone-200 bg-[#f6f4f1] text-xs text-stone-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Hồ sơ thuê</th>
                  <th scope="col" className="px-4 py-3 font-medium">Lần gia hạn</th>
                  <th scope="col" className="px-4 py-3 font-medium">Khách hàng</th>
                  <th scope="col" className="px-4 py-3 font-medium">Kết thúc kỳ dự kiến</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Lịch hẹn</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Hạn ký</th>
                  <th scope="col" className="px-4 py-3 font-medium">Trạng thái</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {group.rows.map(s => <tr key={s.renewalId} className="transition-colors hover:bg-stone-50">
                  <td className="break-words px-4 py-4 align-middle"><span className="font-semibold text-stone-900" title={renewalDisplayLabel(s)}>{s.rentalDisplayCode || s.displayCode || 'Chưa cấp mã'}</span></td>
                  <td className="px-4 py-4 align-middle"><span className="inline-block rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-800">{s.renewalSequence ? `Lần ${s.renewalSequence}` : 'Chưa xác định'}</span></td>
                  <td className="break-words px-4 py-4 align-middle [overflow-wrap:anywhere]">
                    <p className="font-medium text-stone-900">{s.appointmentDetails?.customerName || 'Chưa xác định'}</p>
                    {s.appointmentDetails?.customerEmail && <p className="mt-1 text-xs text-stone-500">{s.appointmentDetails.customerEmail}</p>}
                  </td>
                  <td className="px-4 py-4 align-middle text-stone-700">{s.appointmentDetails?.proposedEndDate ? rentalDate(s.appointmentDetails.proposedEndDate) : 'Chưa xác định'}</td>
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
                  <td className="px-4 py-4 align-middle">
                    <span className="[&_.ui-badge]:!rounded-full [&_.ui-badge]:!border-0 [&_.ui-badge]:!px-3 [&_.ui-badge]:!py-1.5"><Badge variant={s.phase === "COMPLETED" ? "success" : ["NO_SHOW", "SIGNING_EXPIRED", "PAYMENT_EXPIRED"].includes(s.phase) ? "error" : ["SIGNING", "AWAITING_DEPOSIT", "AWAITING_PAYMENT_INTENT"].includes(s.phase) ? "warning" : "muted"}>{phaseLabels[s.phase]}</Badge></span>
                  </td>
                  <td className="px-4 py-4 text-right align-middle">
                    <Button type="button" size="sm" variant={group.id === 'ongoing' ? 'primary' : 'outline'} className={group.id === 'ongoing' ? "whitespace-nowrap !bg-[#a64e00] !text-white hover:!bg-[#893f00]" : "whitespace-nowrap"} onClick={() => { if (!lockRef.current) setSelected(s.renewalId) }}>
                      {["COMPLETED", "NO_SHOW", "SIGNING_EXPIRED", "PAYMENT_EXPIRED"].includes(s.phase) ? "Xem chi tiết" : "Xử lý"}
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
          title="Xử lý ký gia hạn"
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
