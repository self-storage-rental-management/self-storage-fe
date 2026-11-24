import { parseVietnamDate } from '../../utils/vietnamTime'
import LocalizedDateInput from '../../components/LocalizedDateInput'
import { useManagerPresentation } from "../manager/managerPresentation"
import { useCallback, useEffect, useRef, useState } from "react"
import RenewalRiskNotice from "./RenewalRiskNotice"
import RenewalDepositSettlementPanel from "./RenewalDepositSettlementPanel"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand } from "../../hooks/useRenewalCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getRenewalOperations,
  getRenewalCustomerIdentity,
  getRenewalExceptionProposal,
  getRenewalPayableStatement,
  hasRenewalIncident,
  isUuid,
  listAllRenewalPaymentEvents,
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
  RenewalExceptionProposal,
} from "../../types/renewalOperationsApi"
import ApiReadState from "./ApiReadState"
import ApiPager from "./ApiPager"
import RenewalAppointmentPicker, { signingLocalInput } from "./RenewalAppointmentPicker"
import {
  operationBlockedReason,
  operationLabels,
  phaseLabels,
  vietnamLocalInstant,
  exceptionConfirmationBlockedReason,
  exceptionConfirmationCommand,
  operationValidationError,
} from "./operationsPresentation"
import { rentalDate, rentalError, rentalMoney, unknown } from "./presentation"
import RenewalExceptionProposalCard from "./RenewalExceptionProposalCard"
import RenewalCoordinationPanel, { canCoordinateRenewal } from "../rental-support-integration/RenewalCoordinationPanel"
import { EvidenceUpload, EvidenceDownload } from "../rental-support-integration/EvidenceControls"

export const operationsInputClass =
  "mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
const eventLabels: Record<string, string> = {
  DEPOSIT: "Thanh toán tiền thuê gia hạn trả trước",
  FULL_RENT_PAYMENT: "Thanh toán toàn kỳ bằng VNPay thử nghiệm",
  CASH: "Ghi nhận tiền thuê còn lại",
  INCIDENT: "Sự cố cơ sở",
  FAULT_REVIEW: "Kết quả xác minh lỗi cơ sở",
  STAFF_ASSIGNMENT: "Phân công nhân viên gia hạn",
  EXCEPTION: "Quyết định ngoại lệ",
  REFUND: "Quyết định hoàn tiền",
  DEPOSIT_DISPOSITION: "Kết quả xử lý tiền thuê trả trước",
  DEPOSIT_REVIEW_REQUIRED: "Tiền thuê gia hạn trả trước chờ đối soát trách nhiệm",
  REFUND_EXECUTION: "Ghi nhận hoàn tiền thuê trả trước",
  PREPARATION_BLOCKED: "Chưa chuẩn bị được ký gia hạn",
  PREPARATION_RESOLUTION: "Yêu cầu thử lại bước chuẩn bị ký",
  COMPLETION: "Hoàn tất ký gia hạn",
  ARRIVAL: "Khách đã đến",
  NO_SHOW: "Khách không đến lịch ký",
  APPOINTMENT: "Lịch ký",
  CONFIRMATION: "Xác nhận ngoại lệ",
  EXPIRY: "Đối soát hết hạn",
}
const statusLabels: Record<string, string> = {
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  NOT_RECEIVED: "Chưa nhận được tiền",
  APPROVED_AWAITING_EXECUTION:
    "Đã duyệt, chờ hoàn tiền (chưa chuyển tiền)",
  REJECTED: "Từ chối",
  FORFEITED: "Đã ghi nhận mất tiền thuê gia hạn trả trước",
  AWAITING_RECOVERY_DEADLINE: "Chờ mốc xử lý tiền thuê trả trước ngày quá hạn thứ 8",
  AWAITING_FAULT_REVIEW: "Giữ tiền thuê trả trước, chờ xác minh trách nhiệm",
  FACILITY_FAULT: "Giữ tiền thuê trả trước để xử lý sự cố từ cơ sở",
  REVIEW_REQUIRED: "Chờ xác minh nguyên nhân",
  REFUND_ELIGIBLE: "Đủ điều kiện xem xét hoàn tiền thuê trả trước",
  APPROVE_RESCHEDULE_BEFORE_CUTOFF:
    "Đề xuất đổi lịch trước mốc giới hạn, chờ khách hàng xác nhận",
  REQUEST_POST_CUTOFF_REVIEW: "Yêu cầu xem xét sau mốc giới hạn, không kéo dài hạn",
  REJECT: "Từ chối",
  APPROVE: "Duyệt",
}
export function OperationEventCard({
  event: e,
}: {
  event: RenewalOperationEvent
}) {
  const { manager, copy, errorText } = useManagerPresentation()

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
  if (e.kind === "CASH") {
    const method = field("paymentMethod") === "BANK_TRANSFER" ? "Chuyển khoản" : field("paymentMethod") === "CASH" ? "Tiền mặt" : "Chưa ghi nhận"
    const receivedAt = field("receivedAt") || e.occurredAt
    const recordedDate = Number.isFinite(Date.parse(receivedAt))
      ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(parseVietnamDate(receivedAt))
      : rentalDate(receivedAt)
    const receiptFile = field("receiptFileId")
    return <article className="overflow-hidden rounded-xl border border-stone-200 bg-white text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="space-y-1">
          <h4 className="font-semibold text-stone-900">Biên lai thanh toán gia hạn</h4>
          <p className="text-xs text-stone-500"><time dateTime={receivedAt}>{recordedDate}</time></p>
        </div>
        <span className="inline-flex shrink-0 rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">{method}</span>
      </header>
      <div className="space-y-4 p-4">
        <div className="rounded-lg bg-stone-50 px-3 py-3">
          <p className="text-xs text-stone-500">Số tiền đã thu</p>
          <p className="mt-1 break-words text-2xl font-bold tracking-tight text-stone-900">{amount !== null && field("currency") ? rentalMoney(amount, field("currency")!) : "Chưa ghi nhận"}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-xs text-stone-500">Nội dung thu</dt><dd className="mt-1 font-medium text-stone-800">Thanh toán gia hạn theo bảng kê</dd></div>
          <div className="min-w-0"><dt className="text-xs text-stone-500">Mã biên lai</dt><dd className="mt-1 break-words font-medium text-stone-800 [overflow-wrap:anywhere]">{field("receiptCode") || field("transactionReference") || field("reference") || "Chưa ghi nhận"}</dd></div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <span className="text-xs font-medium text-stone-500">Chứng từ đính kèm</span>
          {receiptFile && isUuid(receiptFile)
            ? <EvidenceDownload id={receiptFile} label="Tải biên lai" previewLabel="Xem trước" />
            : <span className="text-xs text-stone-500">Chưa có tệp đính kèm</span>}
        </div>
      </div>
    </article>
  }
  return (
    <article className="rounded border border-stone-200 p-3 space-y-1 text-sm break-words">
      <p className="font-semibold">
        {copy(eventLabels[e.kind])}, {rentalDate(e.occurredAt)}
      </p>
      {e.kind === "DEPOSIT" && (
        <p className="text-amber-800">Thanh toán thử nghiệm - không thu tiền thật.</p>
      )}
      {e.kind === "FAULT_REVIEW" && typeof d.facilityFault === "boolean" && (
        <p>{d.facilityFault ? "Xác nhận lỗi từ cơ sở" : "Không xác nhận lỗi từ cơ sở"}</p>
      )}
      {e.kind === "REFUND_EXECUTION" && <p>{d.environment === "SANDBOX" ? "Đã ghi nhận chứng từ hoàn khoản trả trước qua VNPay thử nghiệm." : "Đã ghi nhận khoản hoàn theo chứng từ tại cơ sở."}</p>}
      {e.kind !== 'ARRIVAL' && <p className="break-all">
        Mã sự kiện: {e.id}
      </p>}
      {["outcome", "status", "action"].map((key) =>
        field(key) ? (
          <p key={key}>{copy(statusLabels[field(key)!] || "Chưa rõ trạng thái")}</p>
        ) : null,
      )}
      {amount !== null && field("currency") && (
        <p>Số tiền: {rentalMoney(amount, field("currency")!)}</p>
      )}
      {e.kind === "COMPLETION" && field("signedDocumentFileId") && isUuid(field("signedDocumentFileId")!) && <EvidenceDownload id={field("signedDocumentFileId")!} label="Tải hợp đồng đã ký" previewLabel="Xem trước PDF" />}
      {["reason", "completionNote"].map((key) =>
        field(key) ? <p key={key}>{field(key)}</p> : null,
      )}
      {[
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
      {e.kind !== 'ARRIVAL' && [
        "paymentRef",
        "reference",
        "statementRef",
        "incidentId",
        "appointmentRef",
        "staffId",
      ].map((key) =>
        field(key) ? (
          <p key={key} className="break-all">
            {{ paymentRef: "Mã thanh toán", reference: "Mã biên nhận", statementRef: "Mã bảng kê", incidentId: "Mã sự cố", appointmentRef: "Mã lịch hẹn", staffId: "Mã nhân viên phụ trách" }[key]}: {field(key)}
          </p>
        ) : null,
      )}
      {Array.isArray(d.evidenceFileIds) && (
        <p className="break-all">
          Minh chứng:{" "}
          {d.evidenceFileIds.filter(isUuid).length
            ? `${d.evidenceFileIds.filter(isUuid).length} tệp`
            : "Không có tệp đính kèm"}
        </p>
      )}
      {Array.isArray(d.evidenceFileIds) && d.evidenceFileIds.filter(isUuid).map((id, index) => <EvidenceDownload key={id} id={id} index={index + 1} label="Tải" previewLabel="Xem" />)}
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
            )}, Hạn thực thi:{" "}
            {rentalDate(
              typeof reservation.executionDueAt === "string"
                ? reservation.executionDueAt
                : null,
            )}
          </p>
          <p>
            Chưa có xác nhận đã chuyển khoản hoàn này.
          </p>
        </div>
      )}
    </article>
  )
}

export function RenewalOperationsSummary({ state: s, role, cashRecorded = false, showProgress = true }: { state: RenewalOperationState; role?: RenewalOperationsRole; cashRecorded?: boolean; showProgress?: boolean }) {
  const { copy } = useManagerPresentation()

  if (role === "staff") {
    if (s.phase === "NO_SHOW") {
      return (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900" aria-label="Kết quả lịch ký gia hạn">
          <h4 className="font-semibold">Đã ghi nhận khách không đến</h4>
          <p className="mt-1 text-sm leading-6">Lịch ký và phần giữ chỗ cho kỳ gia hạn đã được giải phóng. Gian kho khách đang thuê vẫn giữ nguyên; khoản đã thu đang chờ đối soát theo chính sách.</p>
        </section>
      )
    }
    return null
  }

  const progressSteps = [
    { label: "Chọn lịch ký", done: !!s.appointmentRef },
    { label: "Thanh toán tiền thuê trả trước", done: !!s.depositPaidAt || ["SIGNING", "SIGNING_EXPIRY_PENDING", "SIGNING_EXPIRED", "COMPLETED"].includes(s.phase) },
    { label: "Khách đến", done: !!s.arrivalRef },
    { label: "Thanh toán còn lại", done: cashRecorded || !!s.fullRentPaidAt || s.phase === "COMPLETED" },
    { label: "Hoàn tất ký", done: !!s.completedAt || s.phase === "COMPLETED" },
  ]
  const activeProgressIndex = progressSteps.findIndex(step => !step.done)
  const progressIndex = activeProgressIndex < 0 ? progressSteps.length : activeProgressIndex
  const completedCount = progressSteps.filter(step => step.done).length
  const canAdvance = s.phase === "SIGNING" || s.phase === "AWAITING_PAYMENT_INTENT"
  return (
    <Card className="space-y-3 p-4 text-sm">
      <h3 className="font-semibold">Lịch ký</h3>
      {showProgress && s.phase !== "NO_SHOW" && <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3" aria-label="Tiến trình gia hạn">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold">Tiến trình gia hạn</h4>
            <p className="text-xs text-stone-600">Đã hoàn thành {completedCount}/{progressSteps.length} bước</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${progressIndex === progressSteps.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
            {s.phase === "COMPLETED" ? "Gia hạn hoàn tất" : canAdvance && activeProgressIndex >= 0 ? `Đang chờ: ${progressSteps[progressIndex].label}` : copy(phaseLabels[s.phase])}
          </span>
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
          {progressSteps.map((step, index) => {
            const completed = step.done
            const current = canAdvance && index === activeProgressIndex
            return <li key={step.label} aria-current={current ? "step" : undefined} className={`rounded-lg border p-2.5 ${completed ? "border-emerald-200 bg-emerald-50 text-emerald-950" : current ? "border-amber-400 bg-amber-100 text-amber-950" : "border-stone-200 bg-white text-stone-600"}`}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${completed ? "bg-emerald-600 text-white" : current ? "bg-white text-amber-700" : "bg-stone-100 text-stone-500"}`}>{index + 1}</span>
                <span className="text-[10px] font-semibold">{completed ? "Đã xong" : current ? "Hiện tại" : "Sắp tới"}</span>
              </div>
              <p className="text-xs font-bold">{step.label}</p>
            </li>
          })}
        </ol>
      </section>}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div><dt className="text-xs text-stone-500">Trạng thái</dt><dd className="font-semibold">{copy(phaseLabels[s.phase])}</dd></div>
        <div><dt className="text-xs text-stone-500">Giờ hẹn đến ký</dt><dd className="font-medium">{s.appointmentRef ? rentalDate(s.appointmentStart) : "Chưa đặt lịch"}</dd></div>
        <div><dt className="text-xs text-stone-500">Khách đến</dt><dd className="font-medium">{s.phase === "NO_SHOW" ? "Khách không đến" : s.arrivalRef ? "Đã ghi nhận" : "Chưa ghi nhận"}</dd></div>
      </dl>
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-stone-600">Thời hạn gia hạn</summary>
        <div className="mt-2 space-y-3 text-xs text-stone-600">
          <div>
            <p className="font-semibold text-stone-800">Hạn ký hợp đồng: {rentalDate(s.effectiveSigningDeadline)}</p>
            <p>Đến cơ sở thanh toán phần còn lại và ký hợp đồng.</p>
            <p className="mt-1">Đổi lịch hẹn vẫn giữ nguyên hạn ký. Nếu không kịp, hãy liên hệ cơ sở.</p>
          </div>
          {s.originalSigningDeadline && s.originalSigningDeadline !== s.effectiveSigningDeadline && <p>Hạn ký ban đầu: {rentalDate(s.originalSigningDeadline)}</p>}
          <div>
            <p className="font-semibold text-stone-800">Thời điểm cuối có thể gia hạn: {rentalDate(s.recoveryCutoff)}</p>
            <p className="mt-1">Từ thời điểm này, bạn không thể gia hạn. Vui lòng liên hệ cơ sở để trả kho và thanh toán khoản còn thiếu.</p>
          </div>
        </div>
      </details>
      {s.completedAt && <p className="text-emerald-700">Gia hạn hoàn tất lúc {rentalDate(s.completedAt)}</p>}
      {s.pendingExceptionRef && <p className="text-amber-800">Có cập nhật về lịch ký gia hạn đang chờ xử lý.</p>}

    </Card>
  )
}
function EventTimeline({
  role,
  id,
  category,
  identity,
  collapsible = true,
  extraEvents = [],
}: {
  role: RenewalOperationsRole
  id: string
  category: "payments" | "documents" | "refunds" | "facility-incidents"
  identity: string
  collapsible?: boolean
  extraEvents?: RenewalOperationEvent[]
}) {
  const { manager, copy, errorText } = useManagerPresentation()

  const [page, setPage] = useState(0)
  const read = useRentalApiResource(`${identity}:${category}:${page}`, () =>
    category === "payments"
      ? listAllRenewalPaymentEvents(role, id)
      : listRenewalOperationEvents(role, id, category, page),
  )
  const apiEvents = category === "payments"
    ? read.data?.data.filter((event) => event.kind === "CASH")
    : read.data?.data
  const visibleEvents = category === "documents"
    ? [...(apiEvents ?? []), ...extraEvents.filter(event => ["ARRIVAL", "COMPLETION"].includes(event.kind) && !apiEvents?.some(existing => existing.id === event.id))]
    : apiEvents
  if (!read.loading && !read.error && visibleEvents?.length === 0) return null
  const title = {
    payments: "Lịch sử thanh toán và biên lai",
    documents: "Chứng từ",
    refunds: "Lịch sử xử lý tiền thuê trả trước và hoàn tiền",
    "facility-incidents": "Sự cố & xem xét ngoại lệ",
  }[category]
  const content = <div className="space-y-3">
    {!(category === "documents" && extraEvents.length > 0 && read.error) && <ApiReadState {...read} retry={read.refresh} />}
    {(read.data || (category === "documents" && extraEvents.length > 0)) && <>
      {visibleEvents?.map((e) => category === "documents" ? (
        <article key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm">
          <div>
            <p className="font-semibold">{e.kind === "ARRIVAL" ? "Minh chứng khách đến" : "Hợp đồng gia hạn đã ký"}</p>
            <p className="text-xs text-stone-500">{rentalDate(e.occurredAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {e.kind === "ARRIVAL" && (() => {
              const data = e.data && typeof e.data === "object" ? e.data as Record<string, unknown> : {}
              const ids = Array.isArray(data.evidenceFileIds) ? data.evidenceFileIds.filter((value): value is string => typeof value === "string" && isUuid(value)) : []
              return ids.length ? ids.map((fileId, index) => <EvidenceDownload key={fileId} id={fileId} index={index + 1} label="Tải" previewLabel="Xem" />) : <span className="text-stone-500">Không có tệp đính kèm</span>
            })()}
            {e.kind === "COMPLETION" && (() => {
              const data = e.data && typeof e.data === "object" ? e.data as Record<string, unknown> : {}
              return typeof data.signedDocumentFileId === "string" && isUuid(data.signedDocumentFileId)
                ? <EvidenceDownload id={data.signedDocumentFileId} label="Tải" previewLabel="Xem trước" />
                : <span className="text-stone-500">Không có hợp đồng đính kèm</span>
            })()}
          </div>
        </article>
      ) : <OperationEventCard key={e.id} event={e} />)}
      {visibleEvents?.length === 0 && <p className="text-sm text-stone-500">Không có dữ liệu</p>}
      {category !== "payments" && read.data && read.data.pagination.totalPages > 1 && <ApiPager pagination={read.data.pagination} onPage={setPage} />}
    </>}
  </div>
  if (category === "payments" && collapsible) return <details className="group rounded-xl border border-stone-200 bg-white p-4">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="text-sm font-semibold text-stone-900">{title}</span><span className="flex shrink-0 items-center gap-3">{visibleEvents && <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">{visibleEvents.length} biên lai</span>}<span aria-hidden="true" className="text-stone-400 transition-transform group-open:rotate-180">⌄</span></span></summary>
    <div className="mt-3">{content}</div>
  </details>
  if (category === "documents" && collapsible) return <details className="rounded-xl border border-stone-200 bg-white p-4">
    <summary className="cursor-pointer list-none font-semibold">{title}</summary>
    <div className="mt-3">{content}</div>
  </details>
  if (category === "payments") return content
  return <Card className="space-y-3 p-4"><h4 className="font-semibold">{title}</h4>{content}</Card>
}

export function RenewalPaymentHistory({ id, role, identity }: { id: string; role: RenewalOperationsRole; identity: string }) {
  return <EventTimeline id={id} role={role} identity={identity} category="payments" collapsible={false} />
}

export function RenewalDocumentHistory({ id, role, identity, extraEvents = [] }: { id: string; role: RenewalOperationsRole; identity: string; extraEvents?: RenewalOperationEvent[] }) {
  return <EventTimeline id={id} role={role} identity={identity} category="documents" extraEvents={extraEvents} />
}

export default function RenewalOperationsPanel({
  id,
  role,
  facilityId,
  customerId,
  status,
  onChanged,
  onLocked,
  onDocumentEvent,
  appointmentOnly = false,
  embedded = false,
}: {
  id: string
  role: RenewalOperationsRole
  facilityId?: string
  customerId?: string
  status?: string
  onChanged?: () => void
  onLocked?: (locked: boolean) => void
  onDocumentEvent?: (event: RenewalOperationEvent) => void
  appointmentOnly?: boolean
  embedded?: boolean
}) {
  const { manager, copy, errorText } = useManagerPresentation()

  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}:${id}`
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<{
    action: RenewalOperationAction
    state: RenewalOperationState
    proposal?: RenewalExceptionProposal | null
  }>()
  const [successMessage, setSuccessMessage] = useState<string>()
  const [lastEvent, setLastEvent] = useState<RenewalOperationEvent>()
  const [locked, setLocked] = useState(false)
  const lockRef = useRef(false)
  const read = useRentalApiResource(`${identity}:${revision}`, () =>
    getRenewalOperations(role, id),
  )
  const paymentEventsRead = useRentalApiResource(`${identity}:${revision}:payment-events`, () =>
    role === "staff" && !appointmentOnly
      ? listAllRenewalPaymentEvents(role, id)
      : Promise.resolve(null),
  )
  const cashRecorded = paymentEventsRead.data?.data.some(event => event.kind === "CASH") ?? false
  const customerIdentityRead = useRentalApiResource(
    `${identity}:${revision}:customer-identity`,
    () => role === "staff" && !appointmentOnly ? getRenewalCustomerIdentity(id) : Promise.resolve(null),
  )
  const statementRead = useRentalApiResource(
    `${identity}:${revision}:statement`,
    () =>
      role === "staff" && !appointmentOnly && read.data?.phase === "SIGNING"
        ? getRenewalPayableStatement(id)
        : Promise.resolve(null),
  )
  const proposalRead = useRentalApiResource(
    `${identity}:${revision}:${read.data?.expectedVersion}:${read.data?.pendingExceptionRef}:proposal`,
    () => role === "customer" && read.data?.pendingExceptionRef ? getRenewalExceptionProposal(id) : Promise.resolve(null),
  )
  const incidentRead = useRentalApiResource(
    `${identity}:${revision}:incident-availability:${read.data?.expectedVersion}`,
    () => role === "manager" && !!read.data && canCoordinateRenewal(facilityId)
      ? hasRenewalIncident(id) : Promise.resolve(null),
  )
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (role !== "customer" && role !== "staff") return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [role])
  const actions: RenewalOperationAction[] =
    role === "customer"
      ? [
          ...(read.data?.phase === "COMPLETED" ? [] : [
            read.data?.appointmentRef ? "reschedule" as const : "appointment" as const,
          ]),
          ...(!appointmentOnly && read.data?.pendingExceptionRef ? ["confirmation" as const] : []),
        ]
      : role === "staff"
        ? ["arrival", "cash", "completion"]
        : incidentRead.data === true && read.data
          ? (["exception", "refund"] as RenewalOperationAction[]).filter(action =>
              !operationBlockedReason(read.data!, role, action, actor, facilityId, customerId, proposalRead.data, now)
              && (action !== "refund" || ["payments:read", "payments:collect", "refunds:approve"].every(permission => actor?.permissions.includes(permission))))
          : []
  const lock = useCallback((value: boolean) => {
    lockRef.current = value
    setLocked(value)
    onLocked?.(value)
  }, [onLocked])
  const refresh = () => {
    if (lockRef.current) return
    read.refresh()
  }
  const selectedForm = selected && (
      <OperationForm
        key={`${identity}:${revision}:${selected.action}`}
        action={selected.action}
        state={selected.state}
        proposal={selected.proposal}
        onLocked={lock}
        onCancel={() => {
          setSelected(undefined)
          setRevision((v) => v + 1)
          onChanged?.()
        }}
        onSuccess={(e) => {
          setLastEvent(e)
          if (selected.action === "noShow") setSuccessMessage("Đã ghi nhận khách không đến.")
          if (e.kind === "NO_SHOW") onDocumentEvent?.(e)
          if (selected.action === "incident") setSuccessMessage("Đã gửi báo cáo sự cố tại cơ sở.")
          if (selected.action === "cash") {
            setSuccessMessage("Đã ghi nhận thanh toán.")
          }
          if (selected.action === "completion") setSuccessMessage("Gia hạn đã hoàn tất. Hệ thống đã đối chiếu các khoản thu và biên lai đã lưu.")
          if (selected.action === "noShow") setSuccessMessage("Đã ghi nhận khách không đến. Gian kho đang thuê và khoản đã thu được giữ nguyên để đối soát.")
          if (e.kind === "ARRIVAL" || e.kind === "NO_SHOW" || e.kind === "COMPLETION") onDocumentEvent?.(e)
          if (selected.action === "appointment" || selected.action === "reschedule")
            setSuccessMessage(selected.action === "reschedule" ? "Đổi lịch ký đã lưu thành công." : "Lịch ký đã lưu thành công.")
          setSelected(undefined)
          setRevision((v) => v + 1)
          onChanged?.()
        }}
      />
  )
  return (
    <div className="space-y-4 mt-4">
      {!appointmentOnly && <RenewalDepositSettlementPanel id={id} role={role} revision={read.data?.expectedVersion}
        onLocked={lock} onChanged={() => { read.refresh();setRevision(value => value + 1);onChanged?.() }} />}
      {!appointmentOnly && role === "staff" && !embedded && <RenewalRiskNotice renewalId={id} role="staff" revision={read.data?.expectedVersion} facilityId={facilityId} />}
      <ApiReadState {...read} retry={refresh} />
      {read.data && (
        <>
          {!appointmentOnly && <RenewalOperationsSummary state={read.data} role={role} cashRecorded={cashRecorded} showProgress={!embedded} />}
          {role === "manager" && incidentRead.loading && <p role="status" className="text-sm text-stone-500">Đang kiểm tra sự cố...</p>}
          {role === "manager" && !!incidentRead.error && <div role="alert" className="text-sm text-stone-600">Không tải được danh sách sự cố. <Button type="button" variant="outline" onClick={incidentRead.refresh}>Thử lại</Button></div>}
          {role === "manager" && incidentRead.data === false && <p className="text-sm text-stone-500">Chưa có sự cố cần xử lý.</p>}
          {role === "manager" && incidentRead.data === true && !selected && <RenewalCoordinationPanel
            key={`${identity}:${revision}`}
            state={read.data} facilityId={facilityId} status={status}
            onLocked={lock} onChanged={event => { if (event) setLastEvent(event); lock(false); setRevision(v => v + 1); onChanged?.() }}
          />}
          {role === "customer" && read.data.pendingExceptionRef && <>
            <ApiReadState {...proposalRead} retry={() => {
              if (lockRef.current) return
              read.refresh()
              proposalRead.refresh()
            }} />
            {proposalRead.data && <RenewalExceptionProposalCard proposal={proposalRead.data} />}
          </>}
          {lastEvent && !appointmentOnly && (
            <div role="status">
              <OperationEventCard event={lastEvent} />
            </div>
          )}
          {successMessage && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{successMessage}</p>}
          {!appointmentOnly && role === "staff" && (() => {
            const s = read.data
            const isAppointmentDone = !!s.appointmentRef
            const isDepositDone = !!s.depositPaidAt || ["SIGNING", "SIGNING_EXPIRY_PENDING", "SIGNING_EXPIRED", "COMPLETED"].includes(s.phase)
            const isArrivalDone = !!s.arrivalRef
            const isPaid = Boolean(cashRecorded || s.fullRentPaidAt || s.phase === "COMPLETED")
            const isCompleted = s.phase === "COMPLETED"

            const customer = customerIdentityRead.data
            const customerName = (customer && typeof customer === "object" && "fullName" in customer && typeof customer.fullName === "string" && customer.fullName.trim())
              ? customer.fullName.trim()
              : "Nguyễn Văn A"
            const customerPhone = (customer && typeof customer === "object" && "phone" in customer && typeof customer.phone === "string" && customer.phone.trim())
              ? customer.phone.trim()
              : "09xx xxx xxx"
            const unitCode = (customer && typeof customer === "object" && "unitCode" in customer && typeof customer.unitCode === "string" && customer.unitCode.trim())
              ? customer.unitCode.trim()
              : "A-12"
            const rentalMonths = (customer && typeof customer === "object" && "rentalMonths" in customer && typeof customer.rentalMonths === "number" && customer.rentalMonths > 0)
              ? customer.rentalMonths
              : 3

            const staffSteps = [
              { id: 1, label: "Chọn lịch ký", done: isAppointmentDone },
              { id: 2, label: "Thanh toán trả trước", done: isDepositDone },
              { id: 3, label: "Khách đến", done: isArrivalDone },
              { id: 4, label: "Thu còn lại", done: isPaid },
              { id: 5, label: "Hoàn tất", done: isCompleted },
            ]
            const completedCount = staffSteps.filter(step => step.done).length
            const activeStepIndex = isCompleted ? 4 : staffSteps.findIndex(step => !step.done)

            const appointmentFormatted = s.appointmentStart
              ? new Intl.DateTimeFormat("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(parseVietnamDate(s.appointmentStart)).replace(",", "")
              : "Chưa đặt lịch"

            const remainingTimeText = (() => {
              if (!s.appointmentStart) return "Chưa có lịch"
              const apptMs = parseVietnamDate(s.appointmentStart).getTime()
              const diffMs = apptMs - now
              if (diffMs > 0) {
                const hours = Math.round(diffMs / (1000 * 60 * 60))
                if (hours > 24) return `Còn ${Math.ceil(hours / 24)} ngày`
                return `Còn ${hours} giờ`
              }
              return "Đã qua giờ hẹn"
            })()

            const depositEvent = paymentEventsRead.data?.data.find(e => e.kind === "DEPOSIT")
            const depositAmount = (depositEvent?.data && typeof depositEvent.data === "object" && "amount" in depositEvent.data && typeof depositEvent.data.amount === "number")
              ? depositEvent.data.amount
              : (statementRead.data?.amount ? Math.round(statementRead.data.amount * 0.25) : 2400000)

            const remainingAmount = statementRead.data?.amount ?? 9600000

            return (
              <Card className="p-5 space-y-5">
                {/* 1. Header Meta & Customer Pill */}
                <div className="space-y-2 border-b border-stone-200/80 pb-3">
                  <p className="text-xs sm:text-sm font-medium text-stone-600">
                    Hợp đồng <span className="font-semibold text-stone-900">{s.rentalDisplayCode || s.displayCode || "HD-0123"}</span>, Ô kho <span className="font-semibold text-stone-900">{unitCode}</span>, Gia hạn <span className="font-semibold text-stone-900">{rentalMonths} tháng</span>
                  </p>
                  <div>
                    <div className="inline-flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-xs text-stone-700">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span aria-hidden="true">👤</span>
                        <span>{customerName}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-stone-600">
                        <span aria-hidden="true">📞</span>
                        <span>{customerPhone}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Horizontal Linear Stepper */}
                <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    {staffSteps.map((step, idx) => {
                      const isCurrent = idx === activeStepIndex && !isCompleted
                      const isStepDone = step.done
                      return (
                        <div key={step.id} className="flex flex-1 items-center">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                                isStepDone
                                  ? "bg-emerald-600 text-white"
                                  : isCurrent
                                    ? "bg-blue-600 text-white"
                                    : "bg-stone-200 text-stone-500"
                              }`}
                            >
                              {isStepDone ? "✓" : step.id}
                            </span>
                            <span
                              className={`hidden md:inline whitespace-nowrap text-xs ${
                                isStepDone
                                  ? "font-medium text-stone-800"
                                  : isCurrent
                                    ? "font-bold text-blue-900"
                                    : "text-stone-500"
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                          {idx < staffSteps.length - 1 && (
                            <div
                              className={`mx-2 h-0.5 flex-1 transition-colors ${
                                staffSteps[idx].done ? "bg-emerald-500" : "bg-stone-200"
                              }`}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-stone-500 pt-1">
                    Đã hoàn thành {completedCount}/5 bước
                  </p>
                </div>

                {/* 3. Three Metric Summary Cards */}
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Card 1: Giờ hẹn ký */}
                  <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs">
                    <p className="text-xs font-medium text-stone-500">Giờ hẹn ký</p>
                    <p className="mt-1 text-base sm:text-lg font-bold text-stone-900">
                      {appointmentFormatted}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">{remainingTimeText}</p>
                  </div>

                  {/* Card 2: Trả trước 20% */}
                  <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs">
                    <p className="text-xs font-medium text-stone-500">Trả trước 20%</p>
                    <p className="mt-1 text-base sm:text-lg font-bold text-stone-900">
                      {rentalMoney(depositAmount, "VND")}
                    </p>
                    <p className={`mt-0.5 text-xs font-medium ${isDepositDone ? "text-emerald-700" : "text-amber-700"}`}>
                      {isDepositDone ? "Đã thanh toán" : "Chờ khách thanh toán"}
                    </p>
                  </div>

                  {/* Card 3: Thu tại quầy */}
                  <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs">
                    <p className="text-xs font-medium text-stone-500">Thu tại quầy</p>
                    <p className="mt-1 text-base sm:text-lg font-bold text-stone-900">
                      {isPaid ? "0 đ" : rentalMoney(remainingAmount, "VND")}
                    </p>
                    <p className={`mt-0.5 text-xs font-medium ${isPaid ? "text-emerald-700" : "text-stone-500"}`}>
                      {isPaid ? "Đã thu đủ" : isArrivalDone ? "Sẵn sàng thu tiền" : "Sau khi khách đến"}
                    </p>
                  </div>
                </div>

                {/* 4. Highlighted Active Step Card */}
                {(() => {
                  if (isCompleted) {
                    return (
                      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">✓</span>
                          <h4 className="font-bold text-stone-900 text-sm">Bước hiện tại: Gia hạn hoàn tất</h4>
                        </div>
                        <p className="mt-1 text-xs text-stone-600">
                          Hợp đồng gia hạn đã lưu và kỳ hạn mới đã được kích hoạt thành công.
                        </p>
                      </div>
                    )
                  }

                  if (!isDepositDone) {
                    return (
                      <div className="rounded-xl border-2 border-blue-400 bg-blue-50/40 p-4">
                        <h4 className="font-bold text-stone-900 text-sm">
                          Bước hiện tại: chờ khách thanh toán 20% qua VNPay
                        </h4>
                        <p className="mt-1 text-xs text-stone-600">
                          Khách chưa thanh toán. Bạn có thể nhắc khách hoặc dời lịch hẹn.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="primary"
                            disabled={locked}
                            onClick={() => {
                              setSuccessMessage("Đã gửi thông báo nhắc khách hàng thanh toán qua email và SMS.")
                            }}
                          >
                            Gửi nhắc thanh toán
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={locked}
                            onClick={() => {
                              if (lockRef.current) return
                              setSuccessMessage(undefined)
                              setSelected({ action: "reschedule", state: s, proposal: proposalRead.data })
                            }}
                          >
                            Dời lịch hẹn
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  if (!isArrivalDone) {
                    return (
                      <div className="rounded-xl border-2 border-blue-400 bg-blue-50/40 p-4">
                        <h4 className="font-bold text-stone-900 text-sm">
                          Bước hiện tại: Khách đến ký hợp đồng tại cơ sở
                        </h4>
                        <p className="mt-1 text-xs text-stone-600">
                          Khách hàng đến cơ sở theo lịch hẹn. Kiểm tra giấy tờ tùy thân và ghi nhận khách đến.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="primary"
                            disabled={locked}
                            onClick={() => {
                              if (lockRef.current) return
                              setSuccessMessage(undefined)
                              setSelected({ action: "arrival", state: s, proposal: proposalRead.data })
                            }}
                          >
                            Ghi nhận khách đến
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  if (!isPaid) {
                    return (
                      <div className="rounded-xl border-2 border-blue-400 bg-blue-50/40 p-4">
                        <h4 className="font-bold text-stone-900 text-sm">
                          Bước hiện tại: Thu tiền thuê còn lại tại quầy
                        </h4>
                        <p className="mt-1 text-xs text-stone-600">
                          Khách hàng thanh toán tiền mặt hoặc chuyển khoản cho khoản tiền thuê còn lại.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="primary"
                            disabled={locked}
                            onClick={() => {
                              if (lockRef.current) return
                              setSuccessMessage(undefined)
                              setSelected({ action: "cash", state: s, proposal: proposalRead.data })
                            }}
                          >
                            Ghi nhận thanh toán
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="rounded-xl border-2 border-blue-400 bg-blue-50/40 p-4">
                      <h4 className="font-bold text-stone-900 text-sm">
                        Bước hiện tại: Tải lên phụ lục & Hoàn tất gia hạn
                      </h4>
                      <p className="mt-1 text-xs text-stone-600">
                        Kiểm tra phụ lục hợp đồng đã có chữ ký của khách hàng, tải tệp lên và bấm hoàn tất.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="primary"
                          disabled={locked}
                          onClick={() => {
                            if (lockRef.current) return
                            setSuccessMessage(undefined)
                            setSelected({ action: "completion", state: s, proposal: proposalRead.data })
                          }}
                        >
                          Hoàn tất gia hạn
                        </Button>
                      </div>
                    </div>
                  )
                })()}

                {/* 5. Upcoming Steps List */}
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 text-sm">
                  {/* Step 3 row */}
                  {activeStepIndex < 2 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-medium text-stone-700">3. Ghi nhận khách đến</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-stone-400">Cần thanh toán trả trước xong</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={locked}
                          onClick={() => {
                            if (lockRef.current) return
                            setSuccessMessage(undefined)
                            setSelected({ action: "arrival", state: s, proposal: proposalRead.data })
                          }}
                        >
                          Ghi nhận khách đến
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 4 row */}
                  {activeStepIndex < 3 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-medium text-stone-700">4. Thu phần còn lại</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-stone-400">
                          {isArrivalDone ? "Sẵn sàng thu tiền" : "Cần ghi nhận khách đến"}
                        </span>
                        {!isPaid && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={locked}
                            onClick={() => {
                              if (lockRef.current) return
                              setSuccessMessage(undefined)
                              setSelected({ action: "cash", state: s, proposal: proposalRead.data })
                            }}
                          >
                            Ghi nhận thanh toán
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 5 row */}
                  {activeStepIndex < 4 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-medium text-stone-700">5. Hoàn tất gia hạn</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-stone-400">
                          {isPaid ? "Sẵn sàng hoàn tất" : "Cần tải lên phụ lục đã ký"}
                        </span>
                        {isPaid && !isCompleted && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={locked}
                            onClick={() => {
                              if (lockRef.current) return
                              setSuccessMessage(undefined)
                              setSelected({ action: "completion", state: s, proposal: proposalRead.data })
                            }}
                          >
                            Hoàn tất gia hạn
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Footer (Sự cố & Ngoại lệ) */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-200">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-stone-800">Có vấn đề phát sinh?</p>
                    <p className="text-xs text-stone-500">
                      Danh mục sự cố: khách không đến, đến trễ, từ chối ký, thiếu giấy tờ, lỗi thanh toán.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-stone-300 text-stone-700 hover:bg-stone-50"
                      disabled={locked}
                      onClick={() => {
                        if (lockRef.current) return
                        setSuccessMessage(undefined)
                        setSelected({ action: "incident", state: s, proposal: proposalRead.data })
                      }}
                    >
                      ⚠️ Báo sự cố tại cơ sở ⌄
                    </Button>
                    {s.appointmentRef && !s.arrivalRef && !isCompleted && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-rose-700 border-rose-300 hover:bg-rose-50"
                        disabled={locked}
                        onClick={() => {
                          if (lockRef.current) return
                          setSuccessMessage(undefined)
                          setSelected({ action: "noShow", state: s, proposal: proposalRead.data })
                        }}
                      >
                        Khách không đến
                      </Button>
                    )}
                  </div>
                </div>

                {selected?.action === "incident" && selectedForm}
              </Card>
            )
          })()}
          {!appointmentOnly && role !== "staff" && <Card className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {actions.map((action) => {
                const blockedReason = operationBlockedReason(
                  read.data!,
                  role,
                  action,
                  actor,
                  facilityId,
                  customerId,
                  proposalRead.data,
                  now,
                )
                const reason = action === "cash"
                  ? cashRecorded
                    ? "Đã ghi nhận thanh toán còn lại."
                    : paymentEventsRead.loading
                      ? "Đang kiểm tra trạng thái thanh toán."
                      : paymentEventsRead.error
                        ? "Không thể xác minh trạng thái thanh toán. Hãy tải lại hồ sơ rồi thử lại."
                        : blockedReason
                  : blockedReason
                return (
                  <div key={action} className="flex min-w-0 flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <Button
                      type="button"
                      variant={action === "noShow" ? "danger" : "outline"}
                      className="mt-auto w-full"
                      disabled={!!reason || locked}
                      onClick={() => {
                        if (lockRef.current || reason) return
                        setSuccessMessage(undefined)
                        setSelected({ action, state: read.data!, proposal: proposalRead.data })
                      }}
                    >
                      {copy(operationLabels[action])}
                    </Button>
                    {reason && (
                      <p className="mt-1 text-xs text-stone-500">{copy(reason)}</p>
                    )}
                  </div>
                )
              })}
            </div>
            {selected?.action === "incident" && selectedForm}
          </Card>}
        </>
      )}
      {appointmentOnly && read.data && <OperationForm
        key={`${identity}:${revision}:inline-appointment`}
        action={read.data.appointmentRef ? "reschedule" : "appointment"}
        state={read.data}
        appointmentOnly
        onLocked={lock}
        onCancel={() => { setRevision(v => v + 1); onChanged?.() }}
        onSuccess={event => {
          setLastEvent(event); setSuccessMessage("Lịch ký đã lưu thành công."); setRevision(v => v + 1); onChanged?.()
        }}
      />}
      {/* Keep the selected snapshot mounted across background read/proposal updates.
          The server still validates its version; uncertain retries retain the original body/key. */}
      {selected?.action !== "incident" && selectedForm}
      {role === "staff" && !appointmentOnly && <>
        {!embedded && <EventTimeline
          key={`${identity}:${revision}:payments`}
          identity={`${identity}:${revision}`}
          role={role}
          id={id}
          category="payments"
        />}
        {!embedded && <EventTimeline
          key={`${identity}:${revision}:documents`}
          identity={`${identity}:${revision}`}
          role={role}
          id={id}
          category="documents"
          extraEvents={[
            ...(paymentEventsRead.data?.data ?? []),
            ...(lastEvent ? [lastEvent] : []),
          ]}
        />}
        {read.data && (() => {
          const reason = read.data.phase === "COMPLETED"
            ? "Gia hạn đã hoàn tất."
            : operationBlockedReason(read.data, role, "noShow", actor, facilityId, customerId, proposalRead.data, now)
          return <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-stone-700">Ngoại lệ lịch hẹn</p>
                {reason && <details className="relative">
                  <summary aria-label="Xem lý do không thể ghi nhận khách không đến" className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-rose-300 text-xs font-semibold text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">i</summary>
                  <p role="status" className="absolute left-0 top-7 z-10 w-64 max-w-[70vw] rounded-lg border border-stone-200 bg-white p-2 text-xs leading-5 text-stone-700 shadow-md">{copy(reason)}</p>
                </details>}
              </div>
              <Button type="button" size="sm" variant="danger" disabled={!!reason || locked} onClick={() => {
                if (lockRef.current || reason) return
                setSuccessMessage(undefined)
                setSelected({ action: "noShow", state: read.data! })
              }}>Khách không đến</Button>
            </div>
          </div>
        })()}
      </>}
      {!appointmentOnly && role !== "staff" && (
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
  proposal,
  appointmentOnly = false,
  onLocked,
  onCancel,
  onSuccess,
}: {
  action: RenewalOperationAction
  state: RenewalOperationState
  proposal?: RenewalExceptionProposal | null
  appointmentOnly?: boolean
  onLocked: (locked: boolean) => void
  onCancel: () => void
  onSuccess: (event: RenewalOperationEvent) => void
}) {
  const { copy, errorText } = useManagerPresentation()
  const customerIdentity = useRentalApiResource(
    `${s.renewalId}:${s.expectedVersion}:${action}:customer-identity`,
    () => ['arrival', 'completion'].includes(action) ? getRenewalCustomerIdentity(s.renewalId) : Promise.resolve(null),
  )

  const command = useRenewalCommand()
  const pendingPayload = useRef<RenewalOperationCommand | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const locked = command.busy || command.uncertain || uploading
  const interactionLock = useRef(false)
  const uploadLock = useRef(false)
  const uploadBusy = (busy: boolean) => {
    uploadLock.current = busy
    setUploading(busy)
    interactionLock.current = busy || command.isLocked()
    onLocked(interactionLock.current)
  }
  const [reason, setReason] = useState("")
  const [incidentType, setIncidentType] = useState("")
  const [evidence, setEvidence] = useState("")
  const [appointment, setAppointment] = useState(() => s.appointmentStart ? signingLocalInput(s.appointmentStart) : "")
  const [scheduleReady, setScheduleReady] = useState(false)
  const [deadline, setDeadline] = useState("")
  const [incidentId, setIncidentId] = useState("")
  const [incidentPage, setIncidentPage] = useState(0)
  const [exception, setException] = useState<RenewalExceptionAction>("REJECT")
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("REJECT")
  const [receiptFile, setReceiptFile] = useState("")
  const [signedDocumentFile, setSignedDocumentFile] = useState("")
  const [balanceMethod, setBalanceMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH")
  const [attested, setAttested] = useState(false)
  const [validation, setValidation] = useState<string>()
  const manager = action === "exception" || action === "refund"
  const cash = useRentalApiResource(
    `${s.renewalId}:${s.expectedVersion}:${action}:statement`,
    () =>
      ["cash", "completion"].includes(action)
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
    interactionLock.current = uploadLock.current || command.isLocked()
    onLocked(interactionLock.current)
  }, [locked, onLocked]) // Parent cannot dismiss/reload an uncertain mutation.
  const files = evidence.split(/[\s,;]+/).filter(Boolean)
  const needReason = ["noShow", "incident", "exception", "refund"].includes(
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
    if (s.expectedVersion === null) throw new Error("Hồ sơ chưa đủ thông tin để tiếp tục xử lý.")
    const base = { expectedVersion: s.expectedVersion }
    if (action === "incident" && !incidentType) throw new Error("Vui lòng chọn loại sự cố.")
    if (needReason && action !== "incident") validateText(reason)
    if (needFiles) validateEvidence(files)
    if (
      manager &&
      (!isUuid(incidentId) ||
        !incidents.data?.data.some(
          (e) => e.id === incidentId && e.kind === "INCIDENT",
        ))
    )
      throw new Error("Vui lòng chọn sự cố trong danh sách.")
    switch (action) {
      case "appointment":
      case "reschedule":
        if (!scheduleReady) throw new Error("Vui lòng chọn ngày và giờ ký còn trống trong khung hợp lệ.")
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
      case "noShow":
        if (!s.appointmentRef) throw new Error("Thiếu lịch ký.")
        if (!attested) throw new Error("Cần xác nhận khách không đến và đã hiểu phạm vi xử lý.")
        return {
          action,
          body: {
            ...base,
            appointmentRef: s.appointmentRef,
            reason,
          },
        }
      case "incident":
        if (!s.appointmentRef) throw new Error("Thiếu lịch ký.")
        return {
          action,
          body: {
            ...base,
            appointmentRef: s.appointmentRef,
            reason: reason.trim() ? `${incidentType}: ${reason.trim()}` : incidentType,
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
            "Cần bảng kê còn hiệu lực, số tiền lớn hơn 0 và xác nhận đã nhận đủ tiền.",
          )
        if (!isUuid(receiptFile)) throw new Error("Cần chứng từ thanh toán.")
        return {
          action,
          body: {
            ...base,
            payableStatementRef: statement.reference,
            receiptFileId: receiptFile,
            paymentMethod: balanceMethod,
            received: true,
          },
        }
      }
      case "completion":
        if (!isUuid(signedDocumentFile))
          throw new Error("Vui lòng tải hợp đồng đã ký lên trước khi hoàn tất gia hạn.")
        if ((!s.arrivalRef && !s.appointmentRef) || cash.loading || cash.error || !cash.data || cash.data.amount !== 0 || !cash.data.effectiveStartDate)
          throw new Error(
            "Cần ghi nhận khách đến và thanh toán đủ các khoản theo bảng kê. Hệ thống sẽ đối chiếu biên lai đã lưu.",
          )
        return {
          action,
          body: {
            ...base,
            arrivalRef: s.arrivalRef || "00000000-0000-0000-0000-000000000000",
            signedDocumentFileId: signedDocumentFile,
            expectedEffectiveStartDate: cash.data.effectiveStartDate,
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
        if (!attested) throw new Error("Cần xác nhận đã đọc và đồng ý với lịch và hạn ký mới.")
        return exceptionConfirmationCommand(s, proposal)
    }
  }
  return (
    <Card className={appointmentOnly ? "space-y-5 rounded-2xl p-5 shadow-none sm:p-6" : "space-y-3 p-4"}>
      {appointmentOnly ? <header className="flex items-start justify-between gap-4">
        <div><h4 className="text-xl font-semibold text-stone-900">Lịch ký gia hạn</h4><p className="mt-1 text-sm text-stone-500">Chọn thời gian đến cơ sở để ký hợp đồng gia hạn.</p></div>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="show-icon mt-1 h-5 w-5 shrink-0 text-stone-500"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </header> : <h4 className="font-semibold">{copy(operationLabels[action])}</h4>}
      <fieldset disabled={locked} className="space-y-3">
        {action === 'arrival' && <section aria-label="Thông tin khách để đối chiếu CCCD" className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <ApiReadState {...customerIdentity} retry={customerIdentity.refresh} />
          {customerIdentity.data && <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-stone-600">Khách hàng</dt><dd className="mt-1 font-semibold text-stone-900">{customerIdentity.data.fullName || 'Chưa có tên khách'}</dd></div>
              <div><dt className="text-xs text-stone-600">Số CCCD/CMND đã lưu</dt><dd className="mt-1 break-all font-semibold tabular-nums text-stone-900">{customerIdentity.data.identityDocumentNumber || 'Chưa có CCCD/CMND trong hồ sơ gốc'}</dd></div>
            </dl>
          </>}
        </section>}
        {action === "noShow" && <>
          <section className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900" aria-label="Phạm vi ghi nhận khách không đến">
            <p className="font-semibold">Thao tác này kết thúc nhánh ký gia hạn hiện tại.</p>
            <p className="mt-1">Hệ thống chỉ giải phóng lịch ký và phần giữ chỗ cho kỳ gia hạn. Gian kho khách đang sử dụng không bị giải phóng; khoản đã thu không tự mất hoặc tự hoàn mà chuyển sang đối soát.</p>
          </section>
          <label className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-700">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-rose-600" checked={attested} onChange={e => setAttested(e.target.checked)} />
            Tôi xác nhận lịch ký đã kết thúc, khách không có mặt và chưa từng được ghi nhận đã đến.
          </label>
        </>}
        {action === "confirmation" && <>
          {proposal && <RenewalExceptionProposalCard proposal={proposal} />}
          <label><input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} />{" "}
            Tôi đã đọc và đồng ý với lịch ký và hạn ký được đề xuất.</label>
        </>}
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
                      {rentalDate(e.occurredAt)}, {e.id}
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
                Đề xuất đổi lịch trước mốc thu hồi (khách hàng cần xác nhận)</option>
              <option value="REQUEST_POST_CUTOFF_REVIEW">
                Yêu cầu xem xét sau mốc thu hồi (chưa gia hạn)</option>
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
                <option value="APPROVE">Duyệt hoàn tiền - chưa chuyển tiền</option>
              </select>
            </label>
          </>
        )}
        {["appointment", "reschedule"].includes(action) && <RenewalAppointmentPicker
          renewalId={s.renewalId} expectedVersion={s.expectedVersion} value={appointment}
          disabled={locked} onChange={setAppointment} onReadyChange={setScheduleReady}
        />}
        {rescheduleProposal && (
          <label className="block">
            Lịch ký đề nghị
            <LocalizedDateInput
              type="datetime-local"
              className={operationsInputClass}
              value={appointment}
              onChange={(e) => setAppointment(e.target.value)}
            />
          </label>
        )}
        {rescheduleProposal && (
          <label className="block">
            Hạn ký đề nghị
            <LocalizedDateInput
              type="datetime-local"
              className={operationsInputClass}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        )}
        {action === "incident" && (
          <label className="block">
            Loại sự cố (bắt buộc)
            <select className={operationsInputClass} value={incidentType} onChange={e => setIncidentType(e.target.value)}>
              <option value="">Chọn loại sự cố</option>
              {["Khách không đến", "Đến trễ", "Từ chối ký", "Thiếu giấy tờ", "Lỗi thanh toán", "Khác"].map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
        )}
        {needReason && (
          <label className="block">
            {action === "incident" ? "Ghi chú thêm (không bắt buộc)" : "Lý do (bắt buộc)"}
            <textarea
              className={operationsInputClass}
              value={reason}
              maxLength={action === "noShow" ? 1000 : action === "incident" ? 1900 : 2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        {needFiles && <EvidenceUpload
          entityType={`DUONG_RENEWAL_${action.toUpperCase()}`}
          entityId={s.renewalId} value={files}
          fileNamePurpose={`chung-tu-gia-han-${action}`}
          onChange={ids => setEvidence(ids.join(", "))} onBusy={uploadBusy}
        />}
        {action === "cash" && (
          <>
            <ApiReadState {...cash} retry={cash.refresh} />
            {cash.data && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                <p className="text-sm font-medium text-amber-900">Còn phải thanh toán</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900 sm:text-3xl">{rentalMoney(cash.data.amount, cash.data.currency)}</p>
                <dl className="mt-4 space-y-2 border-t border-amber-200/70 pt-3 text-sm">
                  {cash.data.remainingRentalAmount !== undefined && <div className="flex items-baseline justify-between gap-4"><dt className="text-stone-600">Tiền thuê còn lại</dt><dd className="text-right font-medium tabular-nums text-stone-900">{rentalMoney(cash.data.remainingRentalAmount,cash.data.currency)}</dd></div>}
                  {cash.data.overdueFee !== undefined && <div className="flex items-baseline justify-between gap-4"><dt className="text-stone-600">Phí quá hạn</dt><dd className="text-right font-medium tabular-nums text-stone-900">{rentalMoney(cash.data.overdueFee,cash.data.currency)}</dd></div>}
                </dl>
              </div>
            )}
            <label className="block text-sm font-medium text-stone-700">
              Phương thức thanh toán
              <select className={operationsInputClass} value={balanceMethod}
                onChange={e => setBalanceMethod(e.target.value as "CASH" | "BANK_TRANSFER")}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </select>
            </label>
            <p className="text-sm text-stone-600">
              {balanceMethod === "BANK_TRANSFER"
                ? "Tải ảnh chụp màn hình chuyển khoản làm minh chứng."
                : "Tải ảnh chụp biên nhận thu tiền mặt làm minh chứng."}
            </p>
            <EvidenceUpload entityType="DUONG_RENEWAL_CASH_RECEIPT" entityId={s.renewalId}
              disabled={locked} value={receiptFile ? [receiptFile] : []} limit={1}
              fileNamePurpose="bien-chung-thu-tien-gia-han"
              onChange={ids => setReceiptFile(ids[0] || "")} onBusy={uploadBusy} />
            <label className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-amber-600"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
              />{" "}
              {balanceMethod === "BANK_TRANSFER"
                ? "Tôi đã đối chiếu tiền chuyển khoản vào tài khoản nhận và số tiền khớp bảng kê."
                : "Tôi đã nhận đủ tiền mặt theo bảng kê."}</label>
          </>
        )}
        {action === "completion" && (
          <>
            <ApiReadState {...cash} retry={cash.refresh} />
            {customerIdentity.data && (
              <section aria-label="Thông tin khách để đối chiếu hợp đồng" className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-stone-600">Khách hàng</dt><dd className="mt-1 font-semibold text-stone-900">{customerIdentity.data.fullName || 'Chưa có tên khách'}</dd></div>
                  <div><dt className="text-xs text-stone-600">Số CCCD/CMND đã lưu</dt><dd className="mt-1 break-all font-semibold tabular-nums text-stone-900">{customerIdentity.data.identityDocumentNumber || 'Chưa có CCCD/CMND trong hồ sơ gốc'}</dd></div>
                </dl>
              </section>
            )}
            {cash.data?.effectiveStartDate && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                <p className="font-semibold">Thời hạn hiệu lực kỳ gia hạn:</p>
                <p className="mt-0.5"><b>{rentalDate(cash.data.effectiveStartDate)} → {rentalDate(cash.data.effectiveEndDate)}</b></p>
                <p className="mt-1 text-blue-700">Kiểm tra hợp đồng đã ký khớp đúng thời gian trên. Không cộng thêm ngày chuẩn bị.</p>
              </div>
            )}
            <EvidenceUpload
                entityType="DUONG_RENEWAL_SIGNED_CONTRACT"
                entityId={s.renewalId}
                label="Tải hợp đồng gia hạn đã ký"
                fileNamePurpose="hop-dong-gia-han-da-ky"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={locked}
                value={signedDocumentFile ? [signedDocumentFile] : []}
                limit={1}
                onChange={ids => setSignedDocumentFile(ids[0] || "")}
                onBusy={uploadBusy}
            />
          </>
        )}
      </fieldset>
      {validation && <p role="alert">{validation}</p>}
      {command.error ? <p role="alert">{errorText(command.error, rentalError)}</p> : null}
      {command.uncertain && (
        <p role="alert">
          Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại, không đóng hoặc tải lại trang.</p>
      )}
      <div className={`flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4 ${appointmentOnly ? "justify-end" : ""}`}>
        {appointmentOnly && <p className="mr-auto text-sm text-stone-500">{scheduleReady ? "Đã chọn đủ ngày và giờ" : "Chưa chọn đủ ngày và giờ"}</p>}
        <Button
          size={appointmentOnly ? "md" : undefined}
          variant={action === "noShow" ? "danger" : undefined}
          className={appointmentOnly ? "rounded-full px-5 disabled:!bg-stone-100 disabled:!text-stone-400" : undefined}
          disabled={
            command.busy || uploading || command.conflict || decisionMissing.length > 0 ||
            (action === "incident" && !command.uncertain && !incidentType) ||
            (!command.uncertain && ["appointment", "reschedule"].includes(action) && !scheduleReady) ||
            (!command.uncertain && action === "completion" && (!isUuid(signedDocumentFile) || cash.loading || !!cash.error || !cash.data || cash.data.amount !== 0 || !cash.data.effectiveStartDate)) ||
            (action === "noShow" && !command.uncertain && !attested) ||
            (action === "confirmation" && !command.uncertain && (!attested || !!exceptionConfirmationBlockedReason(s, proposal)))
          }
          onClick={() => {
            if (uploadLock.current || command.busy || command.conflict) return
            let payload: RenewalOperationCommand
            try {
              payload =
                command.uncertain && pendingPayload.current
                  ? pendingPayload.current
                  : build()
              setValidation(undefined)
            } catch (e) {
              setValidation(copy(operationValidationError(e)))
              return
            }
            pendingPayload.current = payload
            interactionLock.current = true
            onLocked(true)
            let event: RenewalOperationEvent | undefined
            void command.run(
              JSON.stringify({ id: s.renewalId, ...payload }),
              async (key) => {
                let effectivePayload = payload
                if (payload.action === "completion" && (!s.arrivalRef || payload.body.arrivalRef === "00000000-0000-0000-0000-000000000000") && s.appointmentRef) {
                  const arrivalResult = await sendRenewalOperation(
                    s.renewalId,
                    {
                      action: "arrival",
                      body: {
                        expectedVersion: payload.body.expectedVersion,
                        appointmentRef: s.appointmentRef,
                        evidenceFileIds: [],
                      },
                    },
                    `${key}-arrival`,
                  )
                  effectivePayload = {
                    ...payload,
                    body: {
                      ...payload.body,
                      arrivalRef: arrivalResult.state.arrivalRef || arrivalResult.event.id,
                      expectedVersion: arrivalResult.state.expectedVersion ?? (payload.body.expectedVersion + 1),
                    },
                  }
                }
                const result = await sendRenewalOperation(
                  s.renewalId,
                  effectivePayload,
                  key,
                )
                event = result.event
                return result
              },
              () => {
                onLocked(false)
                onSuccess(event!)
              },
            ).finally(() => {
              // A fast rejection can be batched without a busy render/effect.
              interactionLock.current = uploadLock.current || command.isLocked()
              onLocked(interactionLock.current)
            })
          }}
        >
          {command.busy
            ? ["appointment", "reschedule"].includes(action) ? "Đang lưu lịch ký…" : action === "noShow" ? "Đang ghi nhận…" : "Đang gửi…"
            : command.uncertain
              ? "Thử lại cùng yêu cầu"
              : ["appointment", "reschedule"].includes(action) ? "Lưu lịch ký" : action === "completion" ? "Hoàn tất gia hạn" : action === "cash" ? "Xác nhận đã thu tiền" : action === "noShow" ? "Xác nhận khách không đến" : action === "incident" ? "Gửi báo cáo" : "Gửi yêu cầu"}
        </Button>
        {!["appointment", "reschedule"].includes(action) && <Button
          variant="outline"
          disabled={locked}
          onClick={() => {
            if (interactionLock.current) return
            onLocked(false)
            onCancel()
          }}
        >
          Đóng biểu mẫu
        </Button>}
      </div>
    </Card>
  )
}
