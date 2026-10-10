import { useEffect, useState } from "react"
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
import { operationsInputClass } from "../rental-api/RenewalOperationsPanel"
import { sourceLabels } from "../rental-api/operationsPresentation"
import { managerDisplayText, managerDisplayError } from './managerPresentation'
import {
  rentalDate,
  rentalError,
  rentalMoney,
} from "../rental-api/presentation"

const priorityLabels: Record<string, string> = {
  WARNING: "Cảnh báo",
  SERIOUS: "Nghiêm trọng",
  URGENT: "Khẩn cấp",
  RECOVERY: "Ngưỡng thu hồi",
  PAYMENT_DUE: "Thanh toán quá hạn",
}
export function OverdueCompleteness({ page: p }: { page: OverduePage }) {
  return (
    <div
      className={`rounded p-3 text-sm ${
        p.completeness === "PARTIAL"
          ? "bg-amber-50 text-amber-900"
          : "bg-stone-50"
      }`}
      role="status"
    >
      <p>
        Dữ liệu lúc {rentalDate(p.asOf)} ·{" "}
        {p.completeness === "COMPLETE"
          ? "Đầy đủ"
          : "Chỉ có dữ liệu một phần"}
      </p>
      {p.completeness === "PARTIAL" && (
        <>
          <p>
            Chưa đủ dữ liệu để xác định tất cả khoản nợ và hồ sơ quá hạn.
          </p>
          <ul className="list-disc pl-5">
            {p.missingSources.map((ref) => (
              <li key={ref}>{managerDisplayText(sourceLabels[ref] || 'Thông tin bổ sung')}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
export function OverdueCaseSummary({ record: r }: { record: OverdueCase }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="break-all">Mã theo dõi: {r.caseRef}</p>
      <p>
        {r.customerName} · Gian kho {r.storageUnitCode}
      </p>
      <p className="break-all">Hồ sơ thuê: {r.rentalId}</p>
      <p>
        {r.kind === "RENTAL_TERM"
          ? "Quá thời hạn thuê"
          : "Nghĩa vụ thanh toán quá hạn"}{" "}
        · {r.overdueDays} ngày · {priorityLabels[r.priority]}
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
            Đủ điều kiện gửi thu hồi kho theo hệ thống:{" "}
            {r.recoveryEligible ? "Có (cần bộ phận tiếp nhận xác nhận)" : "Chưa"}
          </p>
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
        }{" "}
        · {rentalDate(e.recordedAt)}
      </p>
      <p className="whitespace-pre-wrap break-words">{e.content}</p>
      <p className="break-all">
        Người ghi: {e.actorId} · Sự kiện: {e.id}
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
  return <OverdueSession key={identity} identity={identity} />
}
function OverdueSession({ identity }: { identity: string }) {
  const actor = getAuthenticatedActor()!
  const [query, setQuery] = useState<OverdueQuery>({
    page: 0,
    size: 20,
    kind: "ALL",
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
      <h1 className="text-2xl font-bold">Theo dõi quá hạn</h1>
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <label>
            Tìm khách / gian / mã
            <input
              className={operationsInputClass}
              value={search}
              maxLength={200}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") change({ search: search.trim() })
              }}
            />
          </label>
          <Button
            variant="outline"
            onClick={() => change({ search: search.trim() })}
          >
            Tìm
          </Button>
          <label>
            Cơ sở
            <select
              className={operationsInputClass}
              value={query.facilityId || ""}
              onChange={(e) =>
                change({ facilityId: e.target.value || undefined })
              }
            >
              <option value="">Các cơ sở được đọc</option>
              {Object.keys(actor.facilityScopes).map((id) => (
                <option key={id} value={id}>
                  {actor.facilityNames?.[id] || id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại
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
          <label>
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
          <label>
            Số hồ sơ
            <select
              className={operationsInputClass}
              value={query.size}
              onChange={(e) => change({ size: Number(e.target.value) })}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/trang
                </option>
              ))}
            </select>
          </label>

        </div>
      </Card>
      <ApiReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          <OverdueCompleteness page={read.data} />
          <Card className="p-4 space-y-3">
            {read.data.data.map((r) => (
              <div
                key={r.caseRef}
                className="rounded border p-3 flex flex-wrap justify-between gap-3"
              >
                <div className="space-y-1 text-sm min-w-0">
                  <p className="font-semibold">
                    {r.customerName} · {r.storageUnitCode} ·{" "}
                    {priorityLabels[r.priority]}
                  </p>
                  <p>
                    {r.kind === "PAYMENT_DUE"
                      ? "Thanh toán quá hạn"
                      : "Quá thời hạn thuê"}{" "}
                    · {r.overdueDays} ngày
                  </p>
                  {r.kind === "PAYMENT_DUE" && (
                    <p>{rentalMoney(r.outstanding, r.currency!)}</p>
                  )}
                  <p className="break-all">{r.caseRef}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelected(r.caseRef)}
                >
                  Chi tiết / Theo dõi
                </Button>
              </div>
            ))}
            {read.data.data.length === 0 && (
              <p>
                {read.data.completeness === "PARTIAL"
                  ? "Chưa tìm thấy hồ sơ, nhưng dữ liệu quá hạn còn thiếu."
                  : "Không có dữ liệu"}
              </p>
            )}
            <ApiPager
              pagination={read.data.pagination}
              onPage={(page) => setQuery((q) => ({ ...q, page }))}
            />
          </Card>
        </>
      )}
      <Card className="p-4 space-y-2">
        <p className="text-sm">
          Xem lại lịch sử bằng mã theo dõi đã lưu, kể cả khi hồ sơ không còn quá
          hạn.
        </p>
        <label className="block">
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
            onLocked={setLocked}
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
          <OverdueCaseSummary record={read.data} />
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
            <option value="REMINDER">
              Yêu cầu gửi nhắc nợ
            </option>
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
