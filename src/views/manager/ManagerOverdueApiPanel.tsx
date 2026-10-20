import { useEffect, useState } from "react"
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
export function OverdueCaseSummary({ record: r, onChanged }: { record: OverdueCase; onChanged?: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="break-all">Mã theo dõi: {r.caseRef}</p>
      <p>
        {r.customerName}, Gian kho {r.storageUnitCode}
      </p>
      <p className="break-all">Hồ sơ thuê: {r.rentalId}</p>
      <p>
        {r.kind === "RENTAL_TERM"
          ? "Quá thời hạn thuê"
          : "Nghĩa vụ thanh toán quá hạn"}, {r.overdueDays} ngày, {priorityLabels[r.workflowStatus ?? r.priority]}
      </p>
      {r.kind === "PAYMENT_DUE" ? (
        <>
          <p>Số còn nợ theo hệ thống: {rentalMoney(r.outstanding, r.currency!)}</p>
          <p>Hạn thanh toán: {rentalDate(r.dueAt)}</p>
          <p className="break-all">Nghĩa vụ: {r.obligationRef}</p>
        </>
      ) : (
        <>
          <p>Mốc thu hồi: {rentalDate(r.recoveryCutoff)}</p>
          <p>
            {r.recoveryTaskId ? "Nhiệm vụ thu hồi đã được tạo. Theo dõi tiến độ trong danh sách nhiệm vụ thu hồi." : r.recoveryEligible ? "Đã đến thời điểm chuyển thu hồi." : "Chưa đến thời điểm chuyển thu hồi."}
          </p>
          {r.recoveryTaskId && <RecoveryTaskLink role="manager" taskId={r.recoveryTaskId} facilityId={r.facilityId} onChanged={onChanged} />}
        </>
      )}
    </div>
  )
}
export function OverdueFollowUpCard({ event: e }: { event: OverdueFollowUp }) {
  return (
    <article className="rounded border p-3 text-sm space-y-1">
      <p className="font-semibold">
        {
          {
            NOTE: "Ghi chú",
            REMINDER: "Yêu cầu nhắc nợ",
            RECOVERY_HANDOFF: "Bàn giao tới thu hồi kho",
          }[e.type]
        }, {rentalDate(e.recordedAt)}
      </p>
      <p className="whitespace-pre-wrap break-words">{e.content}</p>
      <p className="break-all">
        Người ghi: {e.actorId ?? "Hệ thống"}, Sự kiện: {e.id}
      </p>
      {e.externalRef && (
        <p className="break-all">Tham chiếu hệ thống nhận: {e.externalRef}</p>
      )}
      {e.type === "REMINDER" && (
        <p>
          Đã được đưa vào hàng đợi thông báo, không xác nhận đã gửi đến khách.
        </p>
      )}
      {e.type === "RECOVERY_HANDOFF" && (
        <p>
          Bộ phận thu hồi đã nhận hồ sơ, chưa có nghĩa gian kho đã được thu hồi hoặc giải phóng.
        </p>
      )}
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
          <OverdueCaseSummary record={read.data} onChanged={() => { read.refresh(); onChanged() }} />
          <Button
            variant="outline"
            disabled={!canWrite || locked}
            onClick={() => setForm(true)}
          >
            Ghi nhận xử lý
          </Button>
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
      <h4 className="font-semibold">Lịch sử theo dõi</h4>
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
