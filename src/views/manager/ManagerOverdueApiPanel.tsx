import { recordDisplayCode } from '../../utils/recordDisplayCode'
import { displayStatusLabel } from '../../presentation/statusLabels'
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { singleManagerFacility, managerFacilityNotice } from "./managerFacilityUi"
import { Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getOverdueCase,
  listOverdueCases,
  listOverdueFollowUps,
  openOverdueRecovery,
} from "../../services/overdueApi"
import { validateText } from "../../services/renewalOperationsApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand } from "../../hooks/useRenewalCommand"
import { vietnamDateTimeInput } from "../../utils/vietnamTime"
import type {
  OverdueCase,
  OverdueFollowUp,
  OverduePage,
  OverdueQuery,
} from "../../types/overdueApi"
import ApiReadState from "../rental-api/ApiReadState"
import ApiPager from "../rental-api/ApiPager"
import RecoveryTaskLink from "../rental-api/RecoveryTaskLink"
import { operationsInputClass } from "../rental-api/RenewalOperationsPanel"
import { managerDisplayError } from './managerPresentation'
import {
  rentalDate,
  rentalMoney,
} from "../rental-api/presentation"
import "./managerOverdueList.css"

const priorityLabels: Record<string, string> = {
  WARNING: "Cảnh báo",
  SERIOUS: "Nghiêm trọng",
  URGENT: "Khẩn cấp",
  RECOVERY: "Chờ thu hồi",
  WAITING_RECOVERY: "Chờ thu hồi",
  RECOVERING: "Đang thu hồi",
  COMPLETED: "Hoàn tất",
  PAYMENT_DUE: "Thanh toán quá hạn",
}
const statusStyles: Record<string, string> = {
  WARNING: "border-amber-200 bg-amber-50 text-amber-800",
  SERIOUS: "border-orange-200 bg-orange-50 text-orange-800",
  URGENT: "border-red-200 bg-red-50 text-red-700",
  RECOVERY: "border-rose-200 bg-rose-50 text-rose-800",
  WAITING_RECOVERY: "border-rose-200 bg-rose-50 text-rose-800",
  RECOVERING: "border-blue-200 bg-blue-50 text-blue-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PAYMENT_DUE: "border-orange-200 bg-orange-50 text-orange-800",
}
export function OverdueStatusBadge({ status }: { status: string }) {
  return <span data-status={status} className={`overdue-status inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] ?? "border-stone-200 bg-stone-50 text-stone-700"}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
    {priorityLabels[status] ?? displayStatusLabel(status)}
  </span>
}
export function OverdueCompleteness({ page: p }: { page: OverduePage }) {
  const [date, time] = vietnamDateTimeInput(p.asOf).split("T")
  return (
    <span className="text-sm tabular-nums text-stone-600">
      {time ? <>Cập nhật lúc <time dateTime={p.asOf}>{time}, {rentalDate(date)}</time></> : "Chưa có thời điểm cập nhật"}
    </span>
  )
}
export function OverdueCaseSummary({ record: r, onChanged, actions }: { record: OverdueCase; onChanged?: () => void; actions?: ReactNode }) {
  const status = r.workflowStatus ?? r.priority
  const rentalCode = r.rentalDisplayCode || recordDisplayCode(r.rentalId)
  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-stone-200 p-4 text-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-semibold text-stone-900 [overflow-wrap:anywhere]">{r.customerName}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OverdueStatusBadge status={status} />
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-rose-700">Quá hạn {r.overdueDays} ngày</span>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div><dt className="text-xs text-stone-500">Mã hồ sơ thuê</dt><dd className="mt-1 break-all font-mono text-stone-700">{rentalCode}</dd></div>
        <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-stone-500">Gian kho</dt><dd className="mt-1 break-words font-medium text-stone-800 [overflow-wrap:anywhere]">{r.storageUnitCode}</dd></div>
        <div><dt className="text-xs text-stone-500">Loại quá hạn</dt><dd className="mt-1 font-medium">{r.kind === "RENTAL_TERM" ? "Thời hạn thuê" : "Thanh toán"}</dd></div>
        <div><dt className="text-xs text-stone-500">{r.kind === "RENTAL_TERM" ? "Hạn cuối gia hạn" : "Hạn thanh toán"}</dt><dd className="mt-1 font-medium tabular-nums">{rentalDate(r.kind === "RENTAL_TERM" ? r.recoveryCutoff : r.dueAt)}</dd></div>
        {r.kind === "PAYMENT_DUE" && <div><dt className="text-xs text-stone-500">Số tiền còn nợ</dt><dd className="mt-1 font-semibold">{rentalMoney(r.outstanding, r.currency!)}</dd></div>}
      </dl>
      <p className="text-xs leading-relaxed text-stone-600">{r.kind === 'PAYMENT_DUE'
        ? 'Đây là khoản thanh toán đã đến hạn còn nợ, không phải trạng thái hết thời hạn thuê hoặc kết quả của một giao dịch.'
        : 'Đây là quá hạn thời hạn sử dụng kho. Thanh toán thành công chưa tự động hoàn tất gia hạn, hồ sơ cần hoàn tất ký theo quy định.'}</p>
      <div className={`space-y-3 rounded-lg p-3 ${r.kind === "RENTAL_TERM" ? "border border-blue-100 bg-blue-50/60" : "bg-stone-50"}`}>
      {r.kind === "RENTAL_TERM" && <p className="text-xs leading-relaxed text-blue-900">
        {status === "COMPLETED" ? "Đã hoàn tất thu hồi. Bạn có thể mở nhiệm vụ để xem chứng từ." : r.recoveryTaskId ? "Đã tạo nhiệm vụ thu hồi, chờ hoàn tất các bước xử lý tại cơ sở." : r.recoveryEligible ? "Đã đến thời điểm chuyển thu hồi." : "Chưa đến thời điểm chuyển thu hồi."}
      </p>}
      <div className="flex flex-wrap items-center gap-2">
        {r.kind === "RENTAL_TERM" && r.recoveryTaskId && <RecoveryTaskLink role="manager" taskId={r.recoveryTaskId} facilityId={r.facilityId} rentalDisplayCode={rentalCode} onChanged={onChanged} />}
        {actions}
      </div>
      </div>
    </section>
  )
}
export function OverdueFollowUpCard({ event: e }: { event: OverdueFollowUp }) {
  return (
    <article className="relative ml-2 space-y-2 border-l-2 border-stone-200 pb-6 pl-5 text-sm last:pb-1">
      <span aria-hidden="true" className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${e.type === "RECOVERY_HANDOFF" ? "bg-blue-500" : e.type === "REMINDER" ? "bg-amber-500" : "bg-stone-400"}`} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h5 className="font-semibold text-stone-900">
        {
          {
            NOTE: "Ghi chú",
            REMINDER: "Yêu cầu nhắc nợ",
            RECOVERY_HANDOFF: "Chuyển thu hồi",
          }[e.type]
        }
      </h5>
      <time className="text-[11px] tabular-nums text-stone-400" dateTime={e.recordedAt}>{rentalDate(e.recordedAt)}</time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700 [overflow-wrap:anywhere]">{e.content === "AUTO_OVERDUE_DAY_8" ? "Hệ thống tự động chuyển hồ sơ sang thu hồi vào ngày quá hạn thứ 8." : e.content}</p>
      {e.type === "REMINDER" && (
        <p className="text-xs leading-relaxed text-stone-500">
          Đã được đưa vào hàng đợi thông báo, không xác nhận đã gửi đến khách.
        </p>
      )}
      {e.type === "RECOVERY_HANDOFF" && (
        <p className="text-xs leading-relaxed text-stone-500">
          Nhiệm vụ đã được tiếp nhận, gian kho chỉ được giải phóng sau khi hoàn tất thu hồi.
        </p>
      )}
      <details className="text-xs text-stone-500">
        <summary className="w-fit cursor-pointer">Thông tin ghi nhận</summary>
        <dl className="mt-2 grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
          <div className="min-w-0"><dt>Người ghi</dt><dd className="mt-1 break-all">{e.actorName || (e.actorId ? "Nhân viên" : "Hệ thống")}</dd></div>
          <div className="min-w-0"><dt>Mã sự kiện</dt><dd className="mt-1 break-all font-mono">{recordDisplayCode(e.id)}</dd></div>
          {e.externalRef && <div className="min-w-0 sm:col-span-2"><dt>Mã tham chiếu tiếp nhận</dt><dd className="mt-1 break-all font-mono">{recordDisplayCode(e.externalRef)}</dd></div>}
        </dl>
      </details>
    </article>
  )
}
export default function ManagerOverdueApiPanel({ embedded = false, onLocked }: { embedded?: boolean; onLocked?: (value: boolean) => void } = {}) {
  const actor = getAuthenticatedActor()
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    !actor.roles.includes("MANAGER") ||
    !actor.permissions.includes("rentals:read")
  )
    return (
      <Card className="p-5" role="alert">Bạn chưa có quyền xem hồ sơ thuê tại cơ sở này.</Card>
    )
  const identity = `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}`
  const facilityId = singleManagerFacility(actor)
  if (!facilityId) return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  return <OverdueWorkspace key={identity} identity={identity} facilityId={facilityId} embedded={embedded} onLocked={onLocked} />
}
function OverdueWorkspace({ identity, facilityId, embedded, onLocked }: {
  identity: string
  facilityId: string
  embedded: boolean
  onLocked?: (value: boolean) => void
}) {
  return <div className="space-y-5 sm:space-y-7">
    {!embedded && <header>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Theo dõi quá hạn</h1>
      <p className="mt-2 text-sm text-stone-600 sm:text-base">Theo dõi thời hạn thuê, công nợ và tiến độ xử lý tại cơ sở.</p>
    </header>}
    <OverdueSession identity={identity} facilityId={facilityId} onLocked={onLocked} />
  </div>
}
function OverdueSession({ identity, facilityId, onLocked }: {
  identity: string
  facilityId: string
  onLocked?: (value: boolean) => void
}) {
  const [query, setQuery] = useState<OverdueQuery>({
    page: 0,
    size: 10,
    facilityId,
    kind: "RENTAL_TERM",
    sort: "priority,desc",
  })
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string>()
  const [locked, setLocked] = useState(false)
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => listOverdueCases(query),
  )
  const change = (patch: OverdueQuery) =>
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
  const controlClass = "mt-1.5 block min-h-11 w-full rounded-[10px] border border-stone-300 bg-white px-3 text-base text-stone-900"
  return (
    <div className="manager-overdue-list space-y-5 sm:space-y-7">
      <Card className="!rounded-2xl !shadow-none p-4 sm:px-6 sm:py-5">
        <div className="manager-overdue-filters grid items-end gap-3 sm:gap-4">
          <form className="manager-overdue-search min-w-0" role="search" onSubmit={(e) => {
            e.preventDefault()
            change({ search: search.trim() })
          }}>
            <label className="block text-sm text-stone-600" htmlFor="overdue-search">Tìm kiếm</label>
            <div className="relative">
              <input
                id="overdue-search"
                className={`${controlClass} !pl-11 placeholder:text-stone-500`}
                placeholder="Khách hàng, gian kho hoặc mã hồ sơ"
                value={search}
                maxLength={200}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" aria-label="Tìm kiếm" className="absolute inset-y-0 left-0 grid w-11 cursor-pointer place-items-center rounded-l-[10px] text-stone-500 hover:text-stone-900">
                <span aria-hidden="true" className="overdue-search-icon" />
              </button>
            </div>
          </form>
          <label className="min-w-0 text-sm text-stone-600">
            Loại quá hạn
            <select
              className={controlClass}
              value={query.kind}
              onChange={(e) =>
                change({ kind: e.target.value as OverdueQuery["kind"] })
              }
            >
              <option value="ALL">Tất cả</option>
              <option value="PAYMENT_DUE">Quá hạn thanh toán</option>
              <option value="RENTAL_TERM">Quá thời hạn thuê</option>
            </select>
          </label>
          <label className="min-w-0 text-sm text-stone-600">
            Sắp xếp
            <select
              className={controlClass}
              value={query.sort}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="priority,desc">Ưu tiên cao trước</option>
              <option value="overdueDays,desc">Quá hạn lâu nhất</option>
              <option value="overdueDays,asc">Quá hạn ít nhất</option>
              <option value="caseRef,asc">Mã tăng dần</option>
            </select>
          </label>
        </div>
      </Card>
      <ApiReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          <Card className="overflow-hidden !rounded-2xl !shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
              <h2 id="overdue-list-heading" className="flex items-center gap-3 text-lg font-semibold text-stone-900 sm:text-xl">
                Danh sách theo dõi
                <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-sm font-normal tabular-nums text-stone-600">{read.data.pagination.totalItems}</span>
              </h2>
              <OverdueCompleteness page={read.data} />
            </div>
            {read.data.data.length > 0 && (
              <table role="table" aria-labelledby="overdue-list-heading" className="manager-overdue-table w-full table-fixed text-left text-sm text-stone-900">
                <colgroup><col className="w-[15%]" /><col className="w-[27%]" /><col className="w-[16%]" /><col className="w-[13%]" /><col className="w-[17%]" /><col className="w-[12%]" /></colgroup>
                <thead role="rowgroup" className="border-b border-stone-200 bg-[#f6f4f0] text-stone-600">
                  <tr role="row">
                    {["Khách hàng", "Gian kho", "Loại quá hạn", "Số ngày quá hạn", "Trạng thái xử lý", "Thao tác"].map(label =>
                      <th key={label} role="columnheader" scope="col" className="font-medium last:text-right">{label}</th>)}
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-stone-200">
                  {read.data.data.map(r => {
                    const status = r.workflowStatus ?? r.priority
                    const rentalCode = r.rentalDisplayCode || recordDisplayCode(r.rentalId)
                    return <tr role="row" key={r.caseRef} className="transition-colors hover:bg-stone-50/75 focus-within:bg-stone-50/75">
                      <td role="cell" className="min-w-0 wrap-anywhere">
                        <span aria-hidden="true" className="overdue-mobile-label">Khách hàng</span>
                        <p className="text-base">{r.customerName}</p>
                        <p className="mt-0.5 font-mono text-xs text-stone-600">{rentalCode}</p>
                      </td>
                      <td role="cell" className="min-w-0 wrap-anywhere">
                        <span aria-hidden="true" className="overdue-mobile-label">Gian kho</span>
                        <span className="overdue-unit-code">{r.storageUnitCode}</span>
                      </td>
                      <td role="cell">
                        <span aria-hidden="true" className="overdue-mobile-label">Loại quá hạn</span>
                        <p>{r.kind === "PAYMENT_DUE" ? "Quá hạn thanh toán" : "Quá thời hạn thuê"}</p>
                        {r.kind === "PAYMENT_DUE" && <p className="mt-0.5 font-semibold tabular-nums">{rentalMoney(r.outstanding, r.currency!)}</p>}
                      </td>
                      <td role="cell">
                        <span aria-hidden="true" className="overdue-mobile-label">Số ngày quá hạn</span>
                        <span className={`text-xl font-bold tabular-nums ${r.priority === "URGENT" || r.priority === "RECOVERY" ? "text-red-700" : "text-stone-900"}`}>{r.overdueDays}</span>{" "}<span className="text-sm text-stone-600">ngày</span>
                      </td>
                      <td role="cell">
                        <span aria-hidden="true" className="overdue-mobile-label">Trạng thái xử lý</span>
                        <OverdueStatusBadge status={status} />
                        {r.workflowStatus && r.workflowStatus !== "COMPLETED" && priorityLabels[status] !== priorityLabels[r.priority] && <p className="mt-1 text-xs text-stone-600">Mức độ: {priorityLabels[r.priority]}</p>}
                      </td>
                      <td role="cell" className="text-right">
                        <Button type="button" variant="outline" className="min-h-11 whitespace-nowrap !rounded-[10px] !px-3 !font-medium"
                          aria-label={`Chi tiết hồ sơ ${rentalCode}`} onClick={() => setSelected(r.caseRef)}>
                          Chi tiết <span aria-hidden="true" className="overdue-detail-chevron" />
                        </Button>
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>
            )}
            {read.data.data.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-stone-500">Không tìm thấy hồ sơ phù hợp.</p>
            )}
            {read.data.pagination.totalPages > 1 && <div className="border-t border-stone-200 px-4"><ApiPager
              pagination={read.data.pagination}
              onPage={(page) => setQuery((q) => ({ ...q, page }))}
            /></div>}
          </Card>
        </>
      )}
      {selected && (
        <Modal
          open
          size="xl"
          title="Chi tiết quá hạn & lịch sử xử lý"
          onClose={() => {
            if (!locked) setSelected(undefined)
          }}
        >
          <OverdueDetail
            key={`${identity}:${selected}`}
            identity={identity}
            caseRef={selected}
            onLocked={value => { setLocked(value); onLocked?.(value) }}
            onChanged={read.refresh}
          />
        </Modal>
      )}
    </div>
  )
}
export function OverdueDetail({
  identity,
  caseRef,
  onLocked,
  onChanged,
}: {
  identity: string
  caseRef: string
  onLocked: (locked: boolean) => void
  onChanged: () => void
}) {
  const actor = getAuthenticatedActor()!
  const [page, setPage] = useState(0)
  const [tick, setTick] = useState(0)
  const read = useRentalApiResource(`${identity}:${caseRef}:${tick}:case`, () =>
    getOverdueCase(caseRef),
  )
  const history = useRentalApiResource(
    `${identity}:${caseRef}:${tick}:${page}:history`,
    () => listOverdueFollowUps(caseRef, page),
  )
  const [form, setForm] = useState(false)
  const [locked, setLocked] = useState(false)
  const [last, setLast] = useState<OverdueFollowUp>()
  const canWrite =
    !!read.data &&
    actor.permissions.includes("rentals:update") &&
    actor.facilityScopes[read.data.facilityId] === "MANAGE"
  const canOpenRecovery = canWrite && read.data?.kind === "RENTAL_TERM" &&
    read.data.recoveryEligible && !read.data.recoveryTaskId && read.data.workflowStatus !== "COMPLETED"
  const updateLock = (value: boolean) => { setLocked(value); onLocked(value) }
  return (
    <div className="space-y-4">
      <ApiReadState {...read} retry={read.refresh} />
      {!read.loading && read.error ? (
        <p>
          Lịch sử vẫn được tải riêng. Lỗi “không còn quá hạn” không làm mất các
          lần theo dõi đã ghi.
        </p>
      ) : null}
      {read.data && (
        <>
          <OverdueCaseSummary record={read.data} onChanged={() => { read.refresh(); onChanged() }} actions={<>
            {canOpenRecovery && !form && <Button disabled={locked} onClick={() => setForm(true)}>Mở thu hồi</Button>}
          </>} />
          {!canWrite && <p>Bạn chưa có quyền xử lý hồ sơ tại cơ sở này.</p>}
          {form && canOpenRecovery && (
            <OpenRecoveryForm
              key={tick}
              record={read.data}
              onLocked={updateLock}
              onCancel={() => {
                setForm(false)
                setTick((v) => v + 1)
              }}
              onSuccess={(e) => {
                setLast(e)
                setForm(false)
                setPage(0)
                setTick((v) => v + 1)
                onChanged()
              }}
            />
          )}
        </>
      )}
      {last && !history.data?.data.some(event => event.id === last.id) && (
        <div role="status">
          <OverdueFollowUpCard event={last} />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 pt-2">
        <h4 className="text-sm font-semibold text-stone-900">Lịch sử xử lý</h4>
        {history.data && !history.loading && !history.error && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs tabular-nums text-stone-500">{history.data.pagination.totalItems} bản ghi</span>}
      </div>
      <ApiReadState {...history} retry={history.refresh} />
      {history.data && (
        <>
          <div className="rounded-xl border border-stone-200 p-4 sm:p-5">
            {history.data.data.map((e) => (
              <OverdueFollowUpCard key={e.id} event={e} />
            ))}
            {history.data.data.length === 0 && <p className="py-4 text-center text-sm text-stone-500">Chưa có lịch sử xử lý.</p>}
          </div>
          {history.data.pagination.totalPages > 1 && <ApiPager
            disabled={locked}
            pagination={history.data.pagination}
            onPage={setPage}
          />}
        </>
      )}
    </div>
  )
}
function OpenRecoveryForm({
  record: r,
  onLocked,
  onCancel,
  onSuccess,
}: {
  record: OverdueCase
  onLocked: (locked: boolean) => void
  onCancel: () => void
  onSuccess: (event: OverdueFollowUp) => void
}) {
  const command = useRenewalCommand()
  const [content, setContent] = useState("")
  const [validation, setValidation] = useState<string>()
  const locked = command.busy || command.uncertain
  useEffect(() => {
    onLocked(locked)
  }, [locked])
  return (
    <Card className="p-4 space-y-3">
      <fieldset disabled={locked} className="space-y-3">
        <label className="block">
          Lý do mở thu hồi (bắt buộc)
          <textarea
            className={operationsInputClass}
            value={content}
            maxLength={2000}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
      </fieldset>
      {validation && <p role="alert">{validation}</p>}
      {command.error ? <p role="alert">{managerDisplayError(command.error)}</p> : null}
      {command.uncertain && (
        <p role="alert">
          Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại, không đóng hoặc tải lại trang.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={command.busy || command.conflict}
          onClick={() => {
            try {
              validateText(content)
              setValidation(undefined)
            } catch (e) {
              setValidation(managerDisplayError(e))
              return
            }
            onLocked(true)
            let result: OverdueFollowUp | undefined
            void command.run(
              JSON.stringify({ ref: r.caseRef, content, version: r.followUpVersion }),
              async (key) => {
                result = await openOverdueRecovery(r.caseRef, content, r.followUpVersion, key)
                return result
              },
              () => {
                onLocked(false)
                onSuccess(result!)
              },
            )
          }}
        >
          {command.busy
            ? "Đang gửi…"
            : command.uncertain
              ? "Thử lại cùng yêu cầu"
              : "Xác nhận mở thu hồi"}
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
