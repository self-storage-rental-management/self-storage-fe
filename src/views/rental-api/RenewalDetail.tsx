import { useManagerPresentation } from "../manager/managerPresentation"
import RenewalRiskNotice from "./RenewalRiskNotice"
import { Button, Card, Modal } from "../../components/ui"
import { useState } from "react"
import { getAuthenticatedActor } from "../../services/authApi"
import { useRenewalPayment } from "../../hooks/useRenewalPayment"
import type { RentalApiRole } from "../../types/rentalApi"
import type { ReactNode } from "react"
import type { RenewalApiAction, RenewalApiRecord } from "../../types/renewalApi"
import {
  hasRenewalAction,
  rentalDate,
  rentalMoney,
  renewalLabels,
  unknown,
} from "./presentation"
import RenewalReceipt from "../customer/RenewalReceipt"
export default function RenewalDetail({
  renewal: r,
  role,
  onAction,
  onPaymentChange,
  appointmentSelection,
  financeHistory,
  evidenceDocuments,
  operationsLocked = false,
}: {
  renewal: RenewalApiRecord
  role: RentalApiRole
  onAction: (action: RenewalApiAction) => void
  onPaymentChange?: () => void
  appointmentSelection?: ReactNode
  financeHistory?: ReactNode
  evidenceDocuments?: ReactNode
  operationsLocked?: boolean
}) {
  const [receiptOpen, setReceiptOpen] = useState(false)
  const { manager, copy, explain } = useManagerPresentation()
  const actor = getAuthenticatedActor()
  const terms = r.acceptedTerms
  const isSplit = !!terms && terms.remainingRentalAmount > 0
  const hasDeposit = !!terms && terms.renewalDepositAmount > 0
  const isManager = role === "manager"
  const canOpenPayment = role === "customer" && r.status === "accepted" && r.acceptedRevision !== null
  const { payment, busy: paymentBusy, error: paymentError, pay: openRenewalPayment, appointmentSelected } = useRenewalPayment(
    r, role === "customer", onPaymentChange,
  )
  const canViewReceipt = payment?.paymentStatus === "PAID" && !payment.reconciliationRequired &&
    (!payment.settlementStage || ["ALLOCATED_AWAITING_SIGNING", "AWAITING_SIGNING", "COMPLETED"].includes(payment.settlementStage))
  const paymentDeadline = payment?.paymentDeadline ?? r.approvedPaymentDeadline
  const paymentExpired = r.status === "accepted" && !!paymentDeadline && Date.parse(paymentDeadline) <= Date.now() && payment?.paymentStatus !== "PAID"
  const paymentStatusLabel = payment ? ({ PENDING: "Chờ thanh toán", PROCESSING: "Đang xử lý", PAID: payment.reconciliationRequired ? "Đã nhận tiền, cần đối soát" : "Đã thanh toán", NOT_RECEIVED: "Chờ xác nhận", FAILED: "Thất bại", CANCELLED: "Đã hủy" } as Record<string, string>)[payment.paymentStatus] || "Đang cập nhật" : ""
  const paymentDetail = payment?.settlementStage
    ? ({ AWAITING_PAYMENT: "Chờ VNPay xác nhận giao dịch.", VERIFIED_AWAITING_ALLOCATION: "Đang cập nhật khoản thanh toán vào hồ sơ.", ALLOCATED_AWAITING_SIGNING: "Đang kiểm tra điều kiện ký hợp đồng.", AWAITING_SIGNING: "Tiếp theo: đến cơ sở hoàn tất ký.", COMPLETED: "Đã hoàn tất gia hạn.", RECONCILIATION_REQUIRED: "Giao dịch cần được cơ sở kiểm tra." }[payment.settlementStage])
    : payment?.message
  const verification = r.systemVerification
  const workflowStatusLabel = paymentExpired ? "Đã hết hạn thanh toán, đang đối soát VNPay" : r.status === "accepted" && r.approvedPaymentDeadline
    ? isSplit ? "Đã mở thanh toán đợt 1 qua VNPay Sandbox" : "Đã mở thanh toán toàn kỳ qua VNPay Sandbox"
    : r.status === "accepted" && verification?.status === "VERIFIED"
    ? "Đã xác nhận điều kiện, chờ kiểm tra readiness thanh toán"
    : copy(renewalLabels[r.status] || unknown)
  const renewalProgressSteps = [
    { label: "Gửi yêu cầu", detail: "Hồ sơ gia hạn đã được tạo" },
    { label: "Điều khoản & báo giá", detail: "Hệ thống xác minh điều kiện và ghi nhận gói thuê" },
    { label: "Thanh toán trực tuyến", detail: isSplit ? "Thanh toán đợt 1 qua VNPay" : "Thanh toán toàn kỳ qua VNPay" },
    { label: "Hoàn tất gia hạn", detail: "Hợp đồng thuê tự động được kéo dài thời hạn" },
  ]
  const renewalProgressIndex = r.status === "completed" ? renewalProgressSteps.length
    : ["deposit_paid", "full_rent_paid", "appointment_scheduled"].includes(r.status) || payment?.paymentStatus === "PAID" ? 3
      : ["accepted", "approved", "payment_processing", "payment_failed"].includes(r.status) ? 2
        : 1
  const renewalTerminalMessage = r.status === "rejected" ? "Yêu cầu bị từ chối. Xem lý do quyết định bên dưới."
    : r.status === "cancelled" ? "Yêu cầu đã hủy. Các khoản đã thu cần được đối soát theo giao dịch."
      : r.status === "payment_expired" ? "Yêu cầu đã hết hạn thanh toán, các bước tiếp theo đang tạm dừng."
        : null
  const actions: {
    action: RenewalApiAction
    label: string
  }[] =
    role === "manager"
      ? []
      : [
          ...(r.reviewState === "AWAITING_CUSTOMER_CONFIRMATION"
            ? [{ action: "ACCEPT_REVISED_QUOTE" as const, label: "Lấy báo giá và xác nhận lại" }]
            : []),
          { action: "CANCEL", label: "Hủy yêu cầu" },
        ]
  return (
    <Card className="p-4 space-y-3">
      {r.status !== "completed" && <RenewalRiskNotice renewalId={r.id} role={role} revision={r.version} facilityId={r.facility.id} />}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-stone-50 p-3">
        <div>
          <p className="font-semibold text-stone-900">{r.storageUnit.code}</p>
          {r.displayCode && <p className="mt-1 font-mono text-xs text-stone-500">{r.displayCode}</p>}
          <p className="text-sm text-stone-600">{r.facility.name.replace(/[–—]/g, "-")}, {r.customer.fullName}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{workflowStatusLabel}</span>
      </div>
      <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3" aria-label="Tiến trình hồ sơ gia hạn">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold">Tiến trình gia hạn</h4>
            <p className="text-xs text-stone-500">Đã hoàn thành {renewalProgressIndex}/{renewalProgressSteps.length} bước</p>
          </div>
          {renewalTerminalMessage
            ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Đang tạm dừng</span>
            : renewalProgressIndex === renewalProgressSteps.length
              ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Gia hạn hoàn tất</span>
              : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Đang thực hiện: {renewalProgressSteps[renewalProgressIndex]?.label}</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {renewalProgressSteps.map((step, index) => {
            const completed = index < renewalProgressIndex
            const current = index === renewalProgressIndex && renewalProgressIndex < renewalProgressSteps.length
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
        {renewalTerminalMessage && <p role="status" className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">{renewalTerminalMessage}</p>}
      </section>
      <dl className="rounded-lg border border-stone-200 p-3 text-sm">
        <div><dt className="text-xs text-stone-500">Kỳ gia hạn</dt><dd className="font-semibold">{rentalDate(r.oldEndDate)} → {rentalDate(r.newEndDate)}</dd></div>
      </dl>
      {r.reviewReason && <p>Lý do quyết định: {r.reviewReason}</p>}
      {r.cancellationReason && <p>Lý do hủy: {r.cancellationReason === "AUTO_RECOVERY_DAY_8" ? "Đã qua ngày quá hạn thứ 7, hồ sơ chuyển sang xử lý thu hồi kho. Tiền cọc đang chờ đối soát nguyên nhân." : r.cancellationReason}</p>}
      <div className="space-y-3">
          {role === "customer" && payment && <section className={`rounded-xl border p-4 ${payment.reconciliationRequired ? "border-amber-200 bg-amber-50/50" : "border-stone-200 bg-white"}`} aria-label="Thanh toán gia hạn" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-stone-700">{isSplit ? "Thanh toán đợt 1 (20%)" : "Thanh toán toàn kỳ (100%)"}</h4>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${payment.reconciliationRequired ? "bg-amber-100 text-amber-800" : payment.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700" : ["FAILED", "CANCELLED"].includes(payment.paymentStatus) ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>{paymentStatusLabel}</span>
            </div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xl font-bold tracking-tight text-stone-900">{rentalMoney(payment.amount, payment.currency)}</p>
                {payment.paidAt && <p className="mt-1 text-xs text-stone-500">Thanh toán lúc {rentalDate(payment.paidAt)}</p>}
                {payment.invoiceNumber && <p className="mt-1 text-xs text-stone-500">Hóa đơn {payment.invoiceNumber} · {payment.invoiceStatus}</p>}
              </div>
              {canViewReceipt && <Button type="button" size="sm" variant="outline" className="shrink-0 self-start sm:self-auto" onClick={() => setReceiptOpen(true)}>Xem biên lai</Button>}
            </div>
            {paymentDetail && <p className="mt-3 border-t border-stone-100 pt-2 text-xs leading-5 text-stone-600">{paymentDetail}</p>}
          </section>}
          {role === "customer" && paymentError && <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">{paymentError}</p>}
      </div>
      {financeHistory}
      {evidenceDocuments}
      {receiptOpen && canViewReceipt && payment && <Modal open onClose={() => setReceiptOpen(false)} title="Biên lai thanh toán" size="lg">
        <RenewalReceipt id={r.id} paymentId={payment.paymentId} role={role} />
      </Modal>}
      {terms ? (
        <details className="rounded-xl border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer font-semibold">Điều khoản</summary>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-stone-600">Gói gia hạn: {terms.rentalMonths} tháng</p>
            <p className="text-sm text-stone-600">Kỳ gia hạn: {rentalDate(terms.extensionStartDate)} → {rentalDate(terms.newEndDate)}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-stone-500">Đơn giá/tháng</dt><dd className="font-medium">{rentalMoney(terms.monthlyPrice, terms.currency)}</dd></div>
              <div><dt className="text-stone-500">Tạm tính</dt><dd className="font-medium">{rentalMoney(terms.subtotal, terms.currency)}</dd></div>
              <div><dt className="text-stone-500">Giảm giá</dt><dd className="font-medium">{rentalMoney(terms.discountAmount, terms.currency)}</dd></div>
              <div><dt className="text-stone-500">Tổng tiền sau giảm</dt><dd className="font-semibold">{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>
              {hasDeposit ? <>
                <div><dt className="text-stone-500">Cọc gia hạn trả trước</dt><dd className="font-medium">{rentalMoney(terms.renewalDepositAmount, terms.currency)}</dd></div>
                <div><dt className="text-stone-500">Tiền thuê còn lại khi ký</dt><dd className="font-medium">{rentalMoney(terms.remainingRentalAmount, terms.currency)}</dd></div>
              </> : <div><dt className="text-stone-500">Tiền cần thanh toán</dt><dd className="font-medium">{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>}
            </dl>
            {isManager && <p className="text-sm text-stone-600">Đây là số tiền theo báo giá, chưa xác nhận đã phát sinh nghĩa vụ hoặc đã thu tiền.</p>}
          </div>
        </details>
      ) : (
        <p className="text-sm text-stone-500">Chưa có điều khoản được khách hàng chấp nhận.</p>
      )}
      {r.status === "approved" && (
        <p className="rounded bg-amber-50 p-3">
          Hồ sơ gia hạn đã được duyệt. Trạng thái này chưa xác nhận đã thanh toán hoặc hoàn tất ký, ngày kết thúc thuê chưa thay đổi.</p>
      )}
      {r.status === "completed" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
          <h4 className="font-bold text-emerald-900 text-sm">✓ Gia hạn hợp đồng thành công</h4>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Hợp đồng thuê của bạn đã được gia hạn thành công. Thời hạn mới có hiệu lực đến ngày <b>{rentalDate(r.newEndDate)}</b>.
          </p>
        </div>
      )}
      {role === "customer" && r.status === "accepted" && payment?.paymentStatus !== "PAID" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-1">
          <h4 className="font-bold text-blue-900 text-sm">Thanh toán gia hạn trực tuyến</h4>
          <p className="text-xs text-blue-800 leading-relaxed">
            Quý khách chỉ cần bấm <b>{isSplit ? "Thanh toán đợt 1 qua VNPay" : "Thanh toán gia hạn qua VNPay"}</b> bên dưới. Hợp đồng sẽ tự động được gia hạn đến ngày <b>{rentalDate(r.newEndDate)}</b> ngay sau khi giao dịch thành công.
          </p>
        </div>
      )}
      {!isManager && r.reviewState === "AWAITING_CUSTOMER_CONFIRMATION" && <p role="status" className="text-amber-700">
        Báo giá đã thay đổi. Vui lòng lấy báo giá mới và xác nhận lại trước khi tiếp tục thanh toán.
      </p>}
      {appointmentSelection}
      {paymentExpired ? <p className="text-sm text-stone-600">Hạn thanh toán đã qua. Hệ thống đang kiểm tra kết quả VNPay, khi xác nhận chưa thu tiền, yêu cầu sẽ được đóng để bạn có thể gửi yêu cầu gia hạn mới.</p> : null}
      <div className="flex flex-wrap gap-2">
        {canOpenPayment&&<Button
          disabled={operationsLocked||paymentBusy||paymentExpired||payment?.paymentStatus==="PAID"}
          onClick={openRenewalPayment}
        >{paymentBusy?"Đang mở VNPay":payment&&["PENDING","PROCESSING","NOT_RECEIVED"].includes(payment.paymentStatus)?"Tiếp tục thanh toán":isSplit?"Thanh toán đợt 1 (20%)":"Thanh toán toàn kỳ"}</Button>}
        {actions
          .filter((a) => r.allowedActions.includes(a.action))
          .map((a) => (
            <Button
              key={a.action}
              variant={
                a.action === "CANCEL"
                  ? "danger"
                  : "primary"
              }
              disabled={!hasRenewalAction(r, a.action, actor, role)}
              onClick={() => onAction(a.action)}
            >
              {a.label}
            </Button>
          ))}
      </div>
    </Card>
  )
}
