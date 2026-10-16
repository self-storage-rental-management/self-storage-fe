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
  getRenewalExceptionProposal,
  getRenewalPayableStatement,
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
import RenewalCoordinationPanel from "../rental-support-integration/RenewalCoordinationPanel"
import { EvidenceUpload, EvidenceDownload } from "../rental-support-integration/EvidenceControls"
import { renewalSignedContractEntityType } from "../../services/duongIntegrationApi"

export const operationsInputClass =
  "mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
const eventLabels: Record<string, string> = {
  DEPOSIT: "Thanh toán cọc gia hạn",
  FULL_RENT_PAYMENT: "Thanh toán toàn kỳ bằng VNPay Sandbox",
  CASH: "Ghi nhận tiền thuê còn lại",
  INCIDENT: "Sự cố cơ sở",
  FAULT_REVIEW: "Kết quả xác minh lỗi cơ sở",
  STAFF_ASSIGNMENT: "Phân công nhân viên gia hạn",
  EXCEPTION: "Quyết định ngoại lệ",
  REFUND: "Quyết định hoàn tiền",
  DEPOSIT_DISPOSITION: "Kết quả xử lý cọc",
  REFUND_EXECUTION: "Ghi nhận hoàn cọc",
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
    "Đã duyệt, chờ hoàn tiền (chưa chuyển tiền)",
  REJECTED: "Từ chối",
  FORFEITED: "Đã ghi nhận mất cọc gia hạn",
  AWAITING_RECOVERY_DEADLINE: "Chờ mốc xử lý cọc ngày quá hạn thứ 8",
  REVIEW_REQUIRED: "Chờ xác minh nguyên nhân",
  REFUND_ELIGIBLE: "Đủ điều kiện xem xét hoàn cọc",
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
      {e.kind === "REFUND_EXECUTION" && <p>{d.environment === "SANDBOX" ? "Đã ghi nhận hoàn cọc Sandbox theo chứng từ." : "Đã ghi nhận khoản hoàn theo chứng từ tại cơ sở."}</p>}
      <p className="break-all">
        Mã sự kiện: {e.id}
      </p>
      {["outcome", "status", "action"].map((key) =>
        field(key) ? (
          <p key={key}>{copy(statusLabels[field(key)!] || "Chưa rõ trạng thái")}</p>
        ) : null,
      )}
      {amount !== null && field("currency") && (
        <p>Số tiền: {rentalMoney(amount, field("currency")!)}</p>
      )}
      {e.kind === "CASH" && field("paymentMethod") && (
        <p>Phương thức: {field("paymentMethod") === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt"}</p>
      )}
      {e.kind === "CASH" && field("transactionReference") && (
        <p className="break-all">Mã giao dịch: {field("transactionReference")}</p>
      )}
      {e.kind === "CASH" && field("receiptFileId") && isUuid(field("receiptFileId")!) && (
        <EvidenceDownload id={field("receiptFileId")!} label={field("paymentMethod") === "BANK_TRANSFER" ? "Tải chứng từ chuyển khoản" : "Tải biên nhận"} previewLabel="Xem trước" />
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
      {[
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
      {Array.isArray(d.evidenceFileIds) && d.evidenceFileIds.filter(isUuid).map((id, index) => <EvidenceDownload key={id} id={id} index={index + 1} />)}
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

export function RenewalOperationsSummary({ state: s, role, cashRecorded = false }: { state: RenewalOperationState; role?: RenewalOperationsRole; cashRecorded?: boolean }) {
  const { copy } = useManagerPresentation()
  const progressSteps = [
    { label: "Thanh toán cọc", detail: "Khoản cọc gia hạn đã được ghi nhận", done: !!s.depositPaidAt || ["SIGNING", "SIGNING_EXPIRY_PENDING", "SIGNING_EXPIRED", "COMPLETED"].includes(s.phase) },
    { label: "Chọn lịch ký", detail: "Lịch hẹn đã được lưu", done: !!s.appointmentRef },
    { label: "Khách đến", detail: "Nhân viên đã ghi nhận khách tại cơ sở", done: !!s.arrivalRef },
    { label: "Thanh toán còn lại", detail: "Khoản tiền thuê còn lại đã được ghi nhận", done: cashRecorded || !!s.fullRentPaidAt || s.phase === "COMPLETED" },
    { label: "Hoàn tất ký", detail: "Hợp đồng gia hạn đã được lưu", done: !!s.completedAt || s.phase === "COMPLETED" },
  ]
  const activeProgressIndex = progressSteps.findIndex(step => !step.done)
  const progressIndex = activeProgressIndex < 0 ? progressSteps.length : activeProgressIndex
  return (
    <Card className="space-y-3 p-4 text-sm">
      <h3 className="font-semibold">Lịch ký</h3>
      {role === "staff" && <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3" aria-label="Tiến trình gia hạn cho nhân viên">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold">Tiến trình gia hạn</h4>
            <p className="text-xs text-stone-500">Đã hoàn thành {progressIndex}/{progressSteps.length} bước</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${progressIndex === progressSteps.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
            {progressIndex === progressSteps.length ? "Gia hạn hoàn tất" : `Đang thực hiện: ${progressSteps[progressIndex]?.label}`}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {progressSteps.map((step, index) => {
            const completed = step.done
            const current = index === progressIndex && progressIndex < progressSteps.length
            return <div key={step.label} aria-current={current ? "step" : undefined} className={`rounded-lg border p-3 ${completed ? "border-emerald-200 bg-emerald-50 text-emerald-950" : current ? "border-amber-400 bg-amber-500 text-white" : "border-stone-200 bg-white text-stone-400"}`}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${completed ? "bg-emerald-600 text-white" : current ? "bg-white text-amber-700" : "bg-stone-100 text-stone-500"}`}>{completed ? "✓" : index + 1}</span>
                <span className="text-[10px] font-semibold">{completed ? "Đã xong" : current ? "Hiện tại" : "Sắp tới"}</span>
              </div>
              <p className="text-xs font-bold">{step.label}</p>
              <p className={`mt-1 text-[11px] leading-4 ${current ? "text-amber-50" : completed ? "text-emerald-800" : "text-stone-500"}`}>{step.detail}</p>
            </div>
          })}
        </div>
      </section>}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div><dt className="text-xs text-stone-500">Trạng thái</dt><dd className="font-semibold">{copy(phaseLabels[s.phase])}</dd></div>
        <div><dt className="text-xs text-stone-500">Lịch ký</dt><dd className="font-medium">{s.appointmentRef ? `${rentalDate(s.appointmentStart)} — ${rentalDate(s.appointmentEnd)}` : "Chưa đặt lịch"}</dd></div>
        <div><dt className="text-xs text-stone-500">Khách đến</dt><dd className="font-medium">{s.arrivalRef ? "Đã ghi nhận" : "Chưa ghi nhận"}</dd></div>
      </dl>
      {s.phase === "SIGNING" && !s.arrivalRef && s.appointmentEnd && Date.parse(s.appointmentEnd) < Date.now() && <p className="text-amber-700">Lịch hẹn đã qua. Khách hàng cần đổi lịch trong hạn ký còn hiệu lực để tiếp tục.</p>}
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-stone-600">Hạn ký và hạn xử lý</summary>
        <div className="mt-2 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
          <p>Hạn ký ban đầu: {rentalDate(s.originalSigningDeadline)}</p>
          <p>Hạn ký hiện tại: {rentalDate(s.effectiveSigningDeadline)}</p>
          <p>Mốc thu hồi: {rentalDate(s.recoveryCutoff)}</p>
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
    refunds: "Lịch sử xử lý cọc và hoàn tiền",
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
              return ids.length ? ids.map((fileId, index) => <EvidenceDownload key={fileId} id={fileId} index={index + 1} label={`Tải minh chứng ${index + 1}`} previewLabel={`Xem trước ${index + 1}`} />) : <span className="text-stone-500">Không có tệp đính kèm</span>
            })()}
            {e.kind === "COMPLETION" && (() => {
              const data = e.data && typeof e.data === "object" ? e.data as Record<string, unknown> : {}
              return typeof data.signedDocumentFileId === "string" && isUuid(data.signedDocumentFileId)
                ? <EvidenceDownload id={data.signedDocumentFileId} label="Tải hợp đồng" previewLabel="Xem trước PDF" />
                : <span className="text-stone-500">Không có hợp đồng đính kèm</span>
            })()}
          </div>
        </article>
      ) : <OperationEventCard key={e.id} event={e} />)}
      {visibleEvents?.length === 0 && <p className="text-sm text-stone-500">Không có dữ liệu</p>}
      {category !== "payments" && read.data && read.data.pagination.totalPages > 1 && <ApiPager pagination={read.data.pagination} onPage={setPage} />}
    </>}
  </div>
  if (category === "payments" && collapsible) return <details className="rounded-xl border border-stone-200 bg-white p-4">
    <summary className="cursor-pointer list-none font-semibold">{title}<span className="ml-2 text-sm font-normal text-stone-500">Mở để xem biên lai và lịch sử thanh toán</span></summary>
    <div className="mt-3">{content}</div>
  </details>
  if (category === "documents" && collapsible) return <details className="rounded-xl border border-stone-200 bg-white p-4">
    <summary className="cursor-pointer list-none font-semibold">{title}</summary>
    <div className="mt-3">{content}</div>
  </details>
  return <Card className="space-y-3 p-4">{category !== "payments" && <h4 className="font-semibold">{title}</h4>}{content}</Card>
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
  const proposalRead = useRentalApiResource(
    `${identity}:${revision}:${read.data?.expectedVersion}:${read.data?.pendingExceptionRef}:proposal`,
    () => role === "customer" && read.data?.pendingExceptionRef ? getRenewalExceptionProposal(id) : Promise.resolve(null),
  )
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (role !== "customer") return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [role])
  const actions: RenewalOperationAction[] =
    role === "customer"
      ? [
          read.data?.appointmentRef ? "reschedule" : "appointment",
          ...(!appointmentOnly && read.data?.pendingExceptionRef ? ["confirmation" as const] : []),
        ]
      : role === "staff"
        ? ["arrival", "incident", "cash", "completion"]
        : ["exception", "refund"]
  const lock = useCallback((value: boolean) => {
    lockRef.current = value
    setLocked(value)
    onLocked?.(value)
  }, [onLocked])
  const refresh = () => {
    if (lockRef.current) return
    read.refresh()
  }
  return (
    <div className="space-y-4 mt-4">
      {!appointmentOnly && <RenewalDepositSettlementPanel id={id} role={role} revision={read.data?.expectedVersion}
        onLocked={lock} onChanged={() => { read.refresh();setRevision(value => value + 1);onChanged?.() }} />}
      {!appointmentOnly && role === "staff" && <RenewalRiskNotice renewalId={id} role="staff" revision={read.data?.expectedVersion} facilityId={facilityId} />}
      <ApiReadState {...read} retry={refresh} />
      {read.data && (
        <>
          {appointmentOnly ? (
            <section className="space-y-2" aria-label="Chọn lịch ký gia hạn">
              <h3 className="font-semibold">Lịch ký gia hạn</h3>
              <p>{read.data.appointmentRef
                ? `Lịch đã chọn: ${rentalDate(read.data.appointmentStart)} - ${rentalDate(read.data.appointmentEnd)}`
                : "Chọn và lưu lịch ký trước khi thanh toán cọc."}</p>
            </section>
          ) : <RenewalOperationsSummary state={read.data} role={role} cashRecorded={cashRecorded} />}
          {role === "manager" && !selected && <RenewalCoordinationPanel
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
          {!appointmentOnly && <Card className="p-4 space-y-3">
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
                    ? "Khoản thanh toán còn lại đã được ghi nhận."
                    : paymentEventsRead.loading
                      ? "Đang kiểm tra trạng thái thanh toán."
                      : paymentEventsRead.error
                        ? "Không thể xác minh trạng thái thanh toán. Hãy tải lại hồ sơ rồi thử lại."
                        : blockedReason
                  : blockedReason
                return (
                  <div key={action}>
                    <Button
                      variant="outline"
                      disabled={!!reason || locked}
                      onClick={() => {
                        if (lockRef.current || reason) return
                        setSuccessMessage(undefined)
                        setSelected({ action, state: read.data!, proposal: proposalRead.data })
                      }}
                    >
                      {copy(operationLabels[action])}
                    </Button>
                    {reason && !reason.startsWith("\u0043h\u01b0a \u0111\u1ee7 th\u00f4ng tin:") && !reason.startsWith("H\u1ed3 s\u01a1 ch\u01b0a \u0111\u1ee7 th\u00f4ng tin") && (
                      <p className="mt-1 text-xs text-stone-500">{copy(reason)}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>}
        </>
      )}
      {appointmentOnly && read.data && <OperationForm
        key={`${identity}:${revision}:inline-appointment`}
        action={read.data.appointmentRef ? "reschedule" : "appointment"}
        state={read.data}
        onLocked={lock}
        onCancel={() => { setRevision(v => v + 1); onChanged?.() }}
        onSuccess={event => {
          setLastEvent(event); setSuccessMessage("Lịch ký đã lưu thành công."); setRevision(v => v + 1); onChanged?.()
        }}
      />}
      {/* Keep the selected snapshot mounted across background read/proposal updates.
          The server still validates its version; uncertain retries retain the original body/key. */}
      {selected && (
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
            if (e.kind === "ARRIVAL" || e.kind === "COMPLETION") onDocumentEvent?.(e)
            if (selected.action === "appointment" || selected.action === "reschedule")
              setSuccessMessage(selected.action === "reschedule" ? "Đổi lịch ký đã lưu thành công." : "Lịch ký đã lưu thành công.")
            setSelected(undefined)
            setRevision((v) => v + 1)
            onChanged?.()
          }}
        />
      )}
      {role === "staff" && !appointmentOnly && <>
        <EventTimeline
          key={`${identity}:${revision}:payments`}
          identity={`${identity}:${revision}`}
          role={role}
          id={id}
          category="payments"
        />
        <EventTimeline
          key={`${identity}:${revision}:documents`}
          identity={`${identity}:${revision}`}
          role={role}
          id={id}
          category="documents"
          extraEvents={[
            ...(paymentEventsRead.data?.data ?? []),
            ...(lastEvent ? [lastEvent] : []),
          ]}
        />
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
  onLocked,
  onCancel,
  onSuccess,
}: {
  action: RenewalOperationAction
  state: RenewalOperationState
  proposal?: RenewalExceptionProposal | null
  onLocked: (locked: boolean) => void
  onCancel: () => void
  onSuccess: (event: RenewalOperationEvent) => void
}) {
  const { copy, errorText } = useManagerPresentation()

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
  const [evidence, setEvidence] = useState("")
  const [appointment, setAppointment] = useState(() => s.appointmentStart ? signingLocalInput(s.appointmentStart) : "")
  const [scheduleReady, setScheduleReady] = useState(false)
  const [deadline, setDeadline] = useState("")
  const [incidentId, setIncidentId] = useState("")
  const [incidentPage, setIncidentPage] = useState(0)
  const [exception, setException] = useState<RenewalExceptionAction>("REJECT")
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("REJECT")
  const [receipt, setReceipt] = useState("")
  const [receiptFile, setReceiptFile] = useState("")
  const [balanceMethod, setBalanceMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH")
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
    interactionLock.current = uploadLock.current || command.isLocked()
    onLocked(interactionLock.current)
  }, [locked, onLocked]) // Parent cannot dismiss/reload an uncertain mutation.
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
    if (s.expectedVersion === null) throw new Error("Hồ sơ chưa đủ thông tin để tiếp tục xử lý.")
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
            "Cần bảng kê còn hiệu lực, số tiền lớn hơn 0 và xác nhận đã nhận đủ tiền.",
          )
        validateText(receipt, true, 100)
        if (!isUuid(receiptFile)) throw new Error("Cần chứng từ thanh toán.")
        return {
          action,
          body: {
            ...base,
            payableStatementRef: statement.reference,
            receiptReference: receipt,
            receiptFileId: receiptFile,
            paymentMethod: balanceMethod,
            received: true,
          },
        }
      }
      case "completion":
        if (!s.arrivalRef || !isUuid(signedFile) || !attested)
          throw new Error(
            "Cần ghi nhận khách đến, mã tài liệu đã ký và xác nhận danh tính khách hàng.",
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
        if (!attested) throw new Error("Cần xác nhận đã đọc và đồng ý với lịch và hạn ký mới.")
        return exceptionConfirmationCommand(s, proposal)
    }
  }
  return (
    <Card className="p-4 space-y-3">
      <h4 className="font-semibold">{copy(operationLabels[action])}</h4>
      <fieldset disabled={locked} className="space-y-3">
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
            <input
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
            Mã tệp minh chứng đã lưu (nếu có)<textarea
              className={operationsInputClass}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
            <span className="text-xs text-stone-500">
              Nhập tối đa 10 mã tệp đã liên kết với hồ sơ, cách nhau bằng dấu phẩy.</span>
          </label>
        )}
        {needFiles && <EvidenceUpload
          entityType={`DUONG_RENEWAL_${action.toUpperCase()}`}
          entityId={s.renewalId} value={files}
          onChange={ids => setEvidence(ids.join(", "))} onBusy={uploadBusy}
        />}
        {action === "cash" && (
          <>
            <ApiReadState {...cash} retry={cash.refresh} />
            {cash.data && (
              <div className="space-y-2">
                {cash.data.remainingRentalAmount !== undefined && <p>Tiền thuê còn lại: {rentalMoney(cash.data.remainingRentalAmount,cash.data.currency)}</p>}
                {cash.data.overdueFee !== undefined && <p>Phí quá hạn: {rentalMoney(cash.data.overdueFee,cash.data.currency)}</p>}
                <p>
                  Số tiền theo bảng kê:{" "}
                  {rentalMoney(cash.data.amount, cash.data.currency)}
                </p>
                <p>Hết hiệu lực: {rentalDate(cash.data.expiresAt)}</p>
                <p className="break-all">
                  Mã bảng kê: {cash.data.reference}
                </p>
                <p className="break-all">
                  Mã khoản phải thanh toán: {cash.data.requiredObligations.join(", ")}
                </p>
              </div>
            )}
            <label className="block">
              Phương thức thanh toán
              <select className={operationsInputClass} value={balanceMethod}
                onChange={e => setBalanceMethod(e.target.value as "CASH" | "BANK_TRANSFER")}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </select>
            </label>
            <label className="block">
              {balanceMethod === "BANK_TRANSFER" ? "Mã giao dịch chuyển khoản" : "Mã biên nhận tiền mặt"}
              <input
                className={operationsInputClass}
                value={receipt}
                maxLength={100}
                onChange={(e) => setReceipt(e.target.value)}
              />
            </label>
            <p className="text-sm text-stone-600">
              {balanceMethod === "BANK_TRANSFER"
                ? "Tải chứng từ chuyển khoản và chỉ ghi nhận sau khi đã đối chiếu tiền vào tài khoản nhận. Ảnh chuyển khoản do khách gửi chưa đủ để xác nhận đã thanh toán."
                : "Tải biên nhận thu tiền mặt đã lập cho giao dịch này."}
            </p>
            <EvidenceUpload entityType="DUONG_RENEWAL_CASH_RECEIPT" entityId={s.renewalId}
              disabled={locked} value={receiptFile ? [receiptFile] : []} limit={1}
              onChange={ids => setReceiptFile(ids[0] || "")} onBusy={uploadBusy} />
            <label>
              <input
                type="checkbox"
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
            <EvidenceUpload entityType={renewalSignedContractEntityType} entityId={s.renewalId}
              value={signedFile ? [signedFile] : []} limit={1}
              label="Tải lên hợp đồng gia hạn đã ký (PDF)" accept=".pdf,application/pdf"
              onChange={ids => setSignedFile(ids[0] || "")} onBusy={uploadBusy} />
            {signedFile && isUuid(signedFile) && <EvidenceDownload id={signedFile} label="Tải hợp đồng đã ký" previewLabel="Xem trước PDF" />}
            <label>
              <input
                type="checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
              />{" "}
              Đã xác minh danh tính khách
            </label>
          </>
        )}
      </fieldset>
      {validation && <p role="alert">{validation}</p>}
      {command.error ? <p role="alert">{errorText(command.error, rentalError)}</p> : null}
      {command.uncertain && (
        <p role="alert">
          Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại, không đóng hoặc tải lại trang.</p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={
            command.busy || uploading || command.conflict || decisionMissing.length > 0 ||
            (!command.uncertain && ["appointment", "reschedule"].includes(action) && !scheduleReady) ||
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
            ).finally(() => {
              // A fast rejection can be batched without a busy render/effect.
              interactionLock.current = uploadLock.current || command.isLocked()
              onLocked(interactionLock.current)
            })
          }}
        >
          {command.busy
            ? ["appointment", "reschedule"].includes(action) ? "Đang lưu lịch ký…" : "Đang gửi…"
            : command.uncertain
              ? "Thử lại cùng yêu cầu"
              : ["appointment", "reschedule"].includes(action) ? "Lưu lịch ký" : "Gửi yêu cầu"}
        </Button>
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => {
            if (interactionLock.current) return
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
