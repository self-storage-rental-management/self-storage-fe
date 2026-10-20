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
export function OverdueCompleteness({ page: p }: { page: OverduePage }) {
  return (
    <span className="text-xs text-stone-500">Cập nhật: {rentalDate(p.asOf)}</span>
  )
}
export function OverdueCaseSummary({ record: r, onChanged, actions }: { record: OverdueCase; onChanged?: () => void; actions?: ReactNode }) {
  const status = r.workflowStatus ?? r.priority
  const statusClass = status === "COMPLETED" ? "bg-green-50 text-green-700" : status === "URGENT" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
  return (
    <section className="min-w-0 space-y-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-stone-500">Gian kho</p>
          <h3 className="break-words text-lg font-semibold [overflow-wrap:anywhere]">{r.storageUnitCode}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{priorityLabels[status]}</span>
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs text-stone-600">Quá hạn {r.overdueDays} ngày</span>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0"><dt className="text-xs text-stone-500">Khách hàng</dt><dd className="mt-1 break-words font-medium">{r.customerName}</dd></div>
        <div><dt className="text-xs text-stone-500">Loại quá hạn</dt><dd className="mt-1 font-medium">{r.kind === "RENTAL_TERM" ? "Thời hạn thuê" : "Thanh toán"}</dd></div>
        <div><dt className="text-xs text-stone-500">{r.kind === "RENTAL_TERM" ? "Hạn cuối gia hạn" : "Hạn thanh toán"}</dt><dd className="mt-1 font-medium tabular-nums">{rentalDate(r.kind === "RENTAL_TERM" ? r.recoveryCutoff : r.dueAt)}</dd></div>
        {r.kind === "PAYMENT_DUE" && <div><dt className="text-xs text-stone-500">Số tiền còn nợ</dt><dd className="mt-1 font-semibold">{rentalMoney(r.outstanding, r.currency!)}</dd></div>}
      </dl>
      <details className="text-xs text-stone-500">
        <summary className="w-fit cursor-pointer py-1">Mã tham chiếu</summary>
        <dl className="mt-2 grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
          <div className="min-w-0"><dt>Mã theo dõi</dt><dd className="mt-1 break-all font-mono text-stone-700">{r.caseRef}</dd></div>
          <div className="min-w-0"><dt>Hồ sơ thuê</dt><dd className="mt-1 break-all font-mono text-stone-700">{r.rentalId}</dd></div>
          {r.obligationRef && <div className="min-w-0"><dt>Nghĩa vụ thanh toán</dt><dd className="mt-1 break-all font-mono text-stone-700">{r.obligationRef}</dd></div>}
        </dl>
      </details>
      {r.kind === "RENTAL_TERM" && <p className="text-xs leading-relaxed text-stone-500">
        {status === "COMPLETED" ? "Đã hoàn tất thu hồi. Bạn có thể mở nhiệm vụ để xem chứng từ." : r.recoveryTaskId ? "Đã tạo nhiệm vụ thu hồi, chờ hoàn tất các bước xử lý tại cơ sở." : r.recoveryEligible ? "Đã đến thời điểm chuyển thu hồi." : "Chưa đến thời điểm chuyển thu hồi."}
      </p>}
      <div className="flex flex-wrap items-center gap-2">
        {r.kind === "RENTAL_TERM" && r.recoveryTaskId && <RecoveryTaskLink role="manager" taskId={r.recoveryTaskId} facilityId={r.facilityId} onChanged={onChanged} />}
        {actions}
      </div>
    </section>
  )
}
export function OverdueFollowUpCard({ event: e }: { event: OverdueFollowUp }) {
  return (
    <article className="space-y-3 rounded-lg border border-stone-200 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h5 className="font-semibold">
        {
          {
            NOTE: "Ghi chú",
            REMINDER: "Yêu cầu nhắc nợ",
            RECOVERY_HANDOFF: "Chuyển thu hồi",
          }[e.type]
        }
      </h5>
      <time className="text-xs tabular-nums text-stone-500" dateTime={e.recordedAt}>{rentalDate(e.recordedAt)}</time>
      </div>
      <p className="whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]">{e.content === "AUTO_OVERDUE_DAY_8" ? "Hệ thống tự động chuyển hồ sơ sang thu hồi vào ngày quá hạn thứ 8." : e.content}</p>
      {e.type === "REMINDER" && (
        <p className="text-xs leading-relaxed text-stone-500">
          Đã được đưa vào hàng đợi thông báo, không xác nhận đã gửi đến khách.
        </p>
      )}
      {e.type === "RECOVERY_HANDOFF" && (
        <p className="text-xs leading-relaxed text-stone-500">
          Nhiệm vụ đã được tiếp nhận; gian kho chỉ được giải phóng sau khi hoàn tất thu hồi.
        </p>
      )}
      <details className="text-xs text-stone-500">
        <summary className="w-fit cursor-pointer">Thông tin ghi nhận</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
    <h1 className="text-2xl font-bold">Theo dõi quá hạn</h1>
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
      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 md:col-span-2">
          <label className="block text-sm" htmlFor="overdue-search">
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
          <label className="min-w-0 text-sm">
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
          <label className="min-w-0 text-sm">
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
              <h2 className="text-sm font-semibold">Danh sách theo dõi <span className="ml-2 font-normal text-stone-500">({read.data.pagination.totalItems})</span></h2>
              <OverdueCompleteness page={read.data} />
            </div>
            {read.data.data.length > 0 && <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                <colgroup><col className="w-[30%]" /><col className="w-[24%]" /><col className="w-[12%]" /><col className="w-[18%]" /><col className="w-[16%]" /></colgroup>
                <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <tr><th className="px-4 py-3 font-semibold">Khách hàng / Gian kho</th><th className="px-4 py-3 font-semibold">Loại quá hạn</th><th className="px-4 py-3 font-semibold">Số ngày</th><th className="px-4 py-3 font-semibold">Mức độ</th><th className="px-4 py-3 text-right font-semibold">Thao tác</th></tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {read.data.data.map(r => <tr key={r.caseRef} className="hover:bg-stone-50">
                    <td className="break-words px-4 py-3 align-middle"><p className="font-semibold">{r.customerName}</p><p className="mt-1 text-xs text-stone-500">{r.storageUnitCode}</p></td>
                    <td className="px-4 py-3 align-middle"><p>{r.kind === "PAYMENT_DUE" ? "Thanh toán quá hạn" : "Quá thời hạn thuê"}</p>{r.kind === "PAYMENT_DUE" && <p className="mt-1 text-xs text-stone-500">{rentalMoney(r.outstanding, r.currency!)}</p>}</td>
                    <td className="px-4 py-3 align-middle">{r.overdueDays} ngày</td>
                    <td className="px-4 py-3 align-middle">{priorityLabels[r.workflowStatus ?? r.priority]}</td>
                    <td className="px-4 py-3 text-right align-middle"><Button size="sm" variant="outline" onClick={() => setSelected(r.caseRef)}>Chi tiết</Button></td>
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
          onClick={() => {
            const ref = historyRef.trim()
            setRefError(!validOverdueRef(ref))
            if (validOverdueRef(ref)) setSelected(ref)
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
      <h4 className="border-t border-stone-200 pt-5 font-semibold">Lịch sử xử lý</h4>
      <ApiReadState {...history} retry={history.refresh} />
      {history.data && (
        <>
          <div className="space-y-2">
            {history.data.data.map((e) => (
              <OverdueFollowUpCard key={e.id} event={e} />
            ))}
            {history.data.data.length === 0 && <p>Không có dữ liệu</p>}
          </div>
          <ApiPager
            disabled={locked}
            pagination={history.data.pagination}
            onPage={setPage}
          />
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
