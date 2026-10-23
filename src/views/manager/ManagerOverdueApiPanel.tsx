import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { singleManagerFacility, managerFacilityNotice } from "./managerFacilityUi"
import { Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getOverdueCase,
  listOverdueCases,
  listOverdueFollowUps,
  sendOverdueFollowUp,
  validOverdueRef,
} from "../../services/overdueApi"
import { validateText } from "../../services/renewalOperationsApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand } from "../../hooks/useRenewalCommand"
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
  rentalError,
  rentalMoney,
} from "../rental-api/presentation"

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
function OverdueStatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] ?? "border-stone-200 bg-stone-50 text-stone-700"}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
    {priorityLabels[status] ?? status}
  </span>
}
export function OverdueCompleteness({ page: p }: { page: OverduePage }) {
  return (
    <span className="text-xs text-stone-500">Cập nhật: {rentalDate(p.asOf)}</span>
  )
}
export function OverdueCaseSummary({ record: r, onChanged, actions }: { record: OverdueCase; onChanged?: () => void; actions?: ReactNode }) {
  const status = r.workflowStatus ?? r.priority
  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-stone-200 p-4 text-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="min-w-0 flex-1">
          {r.displayCode && <p className="mb-1 font-mono text-xs text-stone-500">{r.displayCode}</p>}
          <h3 className="break-words text-lg font-semibold text-stone-900 [overflow-wrap:anywhere]">{r.customerName}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OverdueStatusBadge status={status} />
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-rose-700">Quá hạn {r.overdueDays} ngày</span>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-stone-500">Gian kho</dt><dd className="mt-1 break-words font-medium text-stone-800 [overflow-wrap:anywhere]">{r.storageUnitCode}</dd></div>
        <div><dt className="text-xs text-stone-500">Loại quá hạn</dt><dd className="mt-1 font-medium">{r.kind === "RENTAL_TERM" ? "Thời hạn thuê" : "Thanh toán"}</dd></div>
        <div><dt className="text-xs text-stone-500">{r.kind === "RENTAL_TERM" ? "Hạn cuối gia hạn" : "Hạn thanh toán"}</dt><dd className="mt-1 font-medium tabular-nums">{rentalDate(r.kind === "RENTAL_TERM" ? r.recoveryCutoff : r.dueAt)}</dd></div>
        {r.kind === "PAYMENT_DUE" && <div><dt className="text-xs text-stone-500">Số tiền còn nợ</dt><dd className="mt-1 font-semibold">{rentalMoney(r.outstanding, r.currency!)}</dd></div>}
      </dl>
      <details className="border-t border-stone-100 pt-3 text-xs text-stone-500">
        <summary className="w-fit cursor-pointer py-1 hover:text-stone-800">Mã tham chiếu</summary>
        <dl className="mt-2 grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
          <div className="min-w-0"><dt>Mã theo dõi</dt><dd className="mt-1 break-all font-mono text-stone-700">{r.caseRef}</dd></div>
          <div className="min-w-0"><dt>Hồ sơ thuê</dt><dd className="mt-1 break-all font-mono text-stone-700">{r.rentalId}</dd></div>
          {r.obligationRef && <div className="min-w-0"><dt>Nghĩa vụ thanh toán</dt><dd className="mt-1 break-all font-mono text-stone-700">{r.obligationRef}</dd></div>}
        </dl>
      </details>
      <div className={`space-y-3 rounded-lg p-3 ${r.kind === "RENTAL_TERM" ? "border border-blue-100 bg-blue-50/60" : "bg-stone-50"}`}>
      {r.kind === "RENTAL_TERM" && <p className="text-xs leading-relaxed text-blue-900">
        {status === "COMPLETED" ? "Đã hoàn tất thu hồi. Bạn có thể mở nhiệm vụ để xem chứng từ." : r.recoveryTaskId ? "Đã tạo nhiệm vụ thu hồi, chờ hoàn tất các bước xử lý tại cơ sở." : r.recoveryEligible ? "Đã đến thời điểm chuyển thu hồi." : "Chưa đến thời điểm chuyển thu hồi."}
      </p>}
      <div className="flex flex-wrap items-center gap-2">
        {r.kind === "RENTAL_TERM" && r.recoveryTaskId && <RecoveryTaskLink role="manager" taskId={r.recoveryTaskId} facilityId={r.facilityId} onChanged={onChanged} />}
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
          <div className="min-w-0"><dt>Người ghi</dt><dd className="mt-1 break-all">{e.actorId ?? "Hệ thống"}</dd></div>
          <div className="min-w-0"><dt>Mã sự kiện</dt><dd className="mt-1 break-all font-mono">{e.id}</dd></div>
          {e.externalRef && <div className="min-w-0 sm:col-span-2"><dt>Mã tham chiếu tiếp nhận</dt><dd className="mt-1 break-all font-mono">{e.externalRef}</dd></div>}
        </dl>
      </details>
    </article>
  )
}
export default function ManagerOverdueApiPanel() {
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
  return <OverdueWorkspace key={identity} identity={identity} facilityId={facilityId} />
}
function OverdueWorkspace({ identity, facilityId }: { identity: string; facilityId: string }) {
  const [, setLocked] = useState(false)
  return <div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">Theo dõi quá hạn</h1>
      <p className="mt-1 text-sm text-stone-500">Theo dõi thời hạn thuê, công nợ và tiến độ xử lý tại cơ sở.</p>
    </header>
    <OverdueSession identity={identity} facilityId={facilityId} onLocked={setLocked} />
  </div>
}
function OverdueSession({ identity, facilityId, onLocked }: {
  identity: string
  facilityId: string
  onLocked: (value: boolean) => void
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
  const [historyRef, setHistoryRef] = useState("")
  const [refError, setRefError] = useState(false)
  const [locked, setLocked] = useState(false)
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => listOverdueCases(query),
  )
  const change = (patch: OverdueQuery) =>
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 md:col-span-2">
          <label className="block text-xs font-semibold text-stone-600" htmlFor="overdue-search">
            Tìm kiếm
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="overdue-search"
              className={operationsInputClass.replace("mt-1 ", "")}
              placeholder="Khách hàng, gian kho hoặc mã hồ sơ"
              value={search}
              maxLength={200}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") change({ search: search.trim() })
              }}
            />
          <Button
            className="shrink-0 whitespace-nowrap"
            onClick={() => change({ search: search.trim() })}
          >
            Tìm kiếm
          </Button>
          </div>
          </div>
          <label className="min-w-0 text-xs font-semibold text-stone-600">
            Loại quá hạn
            <select
              className={operationsInputClass}
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
          <label className="min-w-0 text-xs font-semibold text-stone-600">
            Sắp xếp
            <select
              className={operationsInputClass}
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
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">Danh sách theo dõi <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-stone-600">{read.data.pagination.totalItems}</span></h2>
              <OverdueCompleteness page={read.data} />
            </div>
            {read.data.data.length > 0 && <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] table-fixed text-left text-sm">
                <colgroup><col className="w-[34%]" /><col className="w-[21%]" /><col className="w-[12%]" /><col className="w-[21%]" /><col className="w-[12%]" /></colgroup>
                <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
                  <tr><th scope="col" className="px-4 py-3 font-semibold">Khách hàng / Gian kho</th><th scope="col" className="px-4 py-3 font-semibold">Loại quá hạn</th><th scope="col" className="px-4 py-3 font-semibold">Số ngày</th><th scope="col" className="px-4 py-3 font-semibold">Trạng thái xử lý</th><th scope="col" className="px-4 py-3 text-right font-semibold">Thao tác</th></tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {read.data.data.map(r => <tr key={r.caseRef} className="transition-colors hover:bg-amber-50/40 focus-within:bg-amber-50/40">
                    <td className="break-words px-4 py-4 align-middle"><p className="font-semibold text-stone-900">{r.customerName}</p><p className="mt-1 text-xs leading-relaxed text-stone-600"><span className="text-stone-400">Kho: </span>{r.storageUnitCode}</p>{r.displayCode && <p className="mt-1 font-mono text-[11px] text-stone-400">{r.displayCode}</p>}</td>
                    <td className="px-4 py-4 align-middle"><p className="text-stone-600">{r.kind === "PAYMENT_DUE" ? "Thanh toán quá hạn" : "Quá thời hạn thuê"}</p>{r.kind === "PAYMENT_DUE" && <p className="mt-1 text-sm font-semibold tabular-nums text-stone-900">{rentalMoney(r.outstanding, r.currency!)}</p>}</td>
                    <td className="px-4 py-4 align-middle"><span className={`text-lg font-semibold tabular-nums ${r.priority === "URGENT" || r.priority === "RECOVERY" ? "text-red-700" : "text-stone-900"}`}>{r.overdueDays}</span><span className="ml-1 text-xs text-stone-500">ngày</span></td>
                    <td className="px-4 py-4 align-middle"><OverdueStatusBadge status={r.workflowStatus ?? r.priority} />{r.workflowStatus && r.workflowStatus !== r.priority && r.workflowStatus !== "COMPLETED" && <p className="mt-1.5 text-xs text-stone-500">Mức độ: {priorityLabels[r.priority]}</p>}</td>
                    <td className="px-4 py-4 text-right align-middle"><Button size="sm" variant="outline" aria-label={`Chi tiết hồ sơ ${r.displayCode ?? r.customerName}`} onClick={() => setSelected(r.caseRef)}>Chi tiết</Button></td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
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
      <Card className="p-4">
        <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Tra cứu lịch sử</summary>
        <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          Mã theo dõi có sẵn
          <input
            className={operationsInputClass}
            value={historyRef}
            onChange={(e) => setHistoryRef(e.target.value)}
            placeholder="Nhập mã hồ sơ quá hạn cần tra cứu"
          />
        </label>
        <Button
          variant="outline"
          onClick={async () => {
            const ref = historyRef.trim()
            if (validOverdueRef(ref)) { setRefError(false); setSelected(ref); return }
            if (/^QH-\d{4}-\d{6}$/i.test(ref)) {
              try { const record = await getOverdueCase(ref); setRefError(false); setSelected(record.caseRef) }
              catch { setRefError(true) }
            } else setRefError(true)
          }}
        >
          Mở lịch sử
        </Button>
        {refError && (
          <p role="alert">Mã hồ sơ không hợp lệ. Vui lòng chọn hồ sơ trong danh sách phía trên.</p>
        )}
        </div>
        </details>
      </Card>
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
            onLocked={value => { setLocked(value); onLocked(value) }}
            onChanged={read.refresh}
          />
        </Modal>
      )}
    </div>
  )
}
function OverdueDetail({
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
          <OverdueCaseSummary record={read.data} onChanged={() => { read.refresh(); onChanged() }} actions={<Button
            variant="outline"
            disabled={!canWrite || locked}
            onClick={() => setForm(true)}
          >
            Ghi nhận xử lý
          </Button>} />
          {!canWrite && <p>Bạn chưa có quyền xử lý hồ sơ tại cơ sở này.</p>}
          {form && (
            <OverdueForm
              key={tick}
              record={read.data}
              onLocked={(v) => {
                setLocked(v)
                onLocked(v)
              }}
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
      {last && (
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
function OverdueForm({
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
  const [type, setType] = useState<"NOTE" | "REMINDER" | "RECOVERY_HANDOFF">(
    "NOTE",
  )
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
          Thao tác
          <select
            className={operationsInputClass}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="NOTE">Ghi chú xử lý (không thay đổi nợ)</option>
            {r.workflowStatus !== "COMPLETED" && <option value="REMINDER">
              Yêu cầu gửi nhắc nợ
            </option>}
            {r.kind === "RENTAL_TERM" && r.recoveryEligible && (
              <option value="RECOVERY_HANDOFF">
                Đề nghị bàn giao tới thu hồi kho
              </option>
            )}
          </select>
        </label>
        <label className="block">
          Nội dung / lý do (bắt buộc)
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
            void command
              .run(
                JSON.stringify({
                  ref: r.caseRef,
                  type,
                  content,
                  version: r.followUpVersion,
                }),
                async (key) => {
                  result = await sendOverdueFollowUp(
                    r.caseRef,
                    type,
                    content,
                    r.followUpVersion,
                    key,
                  )
                  return result
                },
                () => {
                  onLocked(false)
                  onSuccess(result!)
                },
              )
              .then(() => {
                /* uncertain remains locked until successful retry; HTTP errors can be dismissed below */
              })
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
