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
  const verification = r.systemVerification
  const workflowStatusLabel = paymentExpired ? "Đã hết hạn thanh toán, đang đối soát VNPay" : r.status === "accepted" && r.approvedPaymentDeadline
    ? hasDeposit ? "Đã mở thanh toán cọc qua VNPay Sandbox" : "Đã mở thanh toán toàn kỳ qua VNPay Sandbox"
    : r.status === "accepted" && verification?.status === "VERIFIED"
    ? "Đã xác nhận điều kiện, chờ kiểm tra readiness thanh toán"
    : copy(renewalLabels[r.status] || unknown)
  const renewalProgressSteps = [
    { label: "Gửi yêu cầu", detail: "Hồ sơ gia hạn đã được tạo" },
    { label: "Kiểm tra & báo giá", detail: "Hệ thống xác minh điều kiện và ghi nhận điều khoản" },
    { label: "Thanh toán", detail: hasDeposit ? "Thanh toán cọc gia hạn" : "Thanh toán tiền gia hạn" },
    { label: "Hẹn lịch ký", detail: "Chọn thời gian đến cơ sở" },
    { label: "Đối chiếu & ký", detail: "Staff xác minh, nhận tiền còn lại và lưu hợp đồng đã ký" },
  ]
  const renewalProgressIndex = r.status === "completed" ? renewalProgressSteps.length
    : ["deposit_paid", "full_rent_paid"].includes(r.status) || payment?.paymentStatus === "PAID" ? 3
      : r.status === "appointment_scheduled" ? 4
        : ["accepted", "approved", "payment_processing", "payment_failed"].includes(r.status) ? 2
          : 1
  const renewalTerminalMessage = r.status === "rejected" ? "Yêu cầu bị từ chối. Xem lý do quyết định bên dưới."
    : r.status === "cancelled" ? "Yêu cầu đã hủy. Các khoản đã thu cần được đối soát theo giao dịch."
      : r.status === "payment_expired" ? "Yêu cầu đã hết hạn thanh toán; các bước tiếp theo đang tạm dừng."
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
          <p className="text-sm text-stone-600">{r.facility.name.replace(/[–—]/g, "-")} — {r.customer.fullName}</p>
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
      <details className="rounded-xl border border-stone-200 bg-white p-3">
        <summary className="cursor-pointer font-semibold">Tài chính</summary>
        <div className="mt-3 space-y-3">
          {role === "customer" && payment && <section className={`space-y-1 rounded-lg border p-3 ${payment.reconciliationRequired ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50"}`} aria-live="polite">
            <p className="font-semibold">{hasDeposit ? "Thanh toán cọc" : "Thanh toán toàn kỳ"}: {({ PENDING: "Đang chờ VNPay", PROCESSING: "Đang xử lý", PAID: payment.reconciliationRequired ? "Đã nhận tiền, cần đối soát" : "Đã ghi nhận thanh toán", NOT_RECEIVED: "Chưa xác nhận đã nhận tiền", FAILED: "Thanh toán thất bại", CANCELLED: "Giao dịch đã hủy" } as Record<string, string>)[payment.paymentStatus]}</p>
            <p>{payment.settlementStage ? ({ AWAITING_PAYMENT: "Chờ VNPay xác nhận thanh toán", VERIFIED_AWAITING_ALLOCATION: "Đã xác minh tiền, đang chờ phân bổ", ALLOCATED_AWAITING_SIGNING: "Đang kiểm tra điều kiện ký", AWAITING_SIGNING: "Đã thanh toán, chờ hoàn tất ký", COMPLETED: "Gia hạn đã hoàn tất", RECONCILIATION_REQUIRED: "Cần hỗ trợ đối soát" }[payment.settlementStage]) : payment.message}</p>
            <p>{rentalMoney(payment.amount, payment.currency)}{payment.paidAt ? ` — ${rentalDate(payment.paidAt)}` : ""}</p>
            {payment.paymentDeadline && <p className="text-xs text-stone-600">Hạn thanh toán: {rentalDate(payment.paymentDeadline)}</p>}
            {canViewReceipt && <Button type="button" variant="outline" onClick={() => setReceiptOpen(true)}>Xem biên lai</Button>}
          </section>}
          {financeHistory}
          {role === "customer" && paymentError && <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">{paymentError}</p>}
        </div>
      </details>
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
      {!isManager && r.reviewState === "AWAITING_CUSTOMER_CONFIRMATION" && <p role="status" className="text-amber-700">
        Báo giá đã thay đổi. Vui lòng lấy báo giá mới và xác nhận lại trước khi tiếp tục thanh toán.
      </p>}
      {appointmentSelection}
      {paymentExpired ? <p className="text-sm text-stone-600">Hạn thanh toán đã qua. Hệ thống đang kiểm tra kết quả VNPay; khi xác nhận chưa thu tiền, yêu cầu sẽ được đóng để bạn có thể gửi yêu cầu gia hạn mới.</p> : canOpenPayment && !appointmentSelected && <p className="text-sm text-stone-600">Lưu lịch ký trước khi {hasDeposit ? "thanh toán cọc" : "thanh toán"}.</p>}
      <div className="flex flex-wrap gap-2">
        {canOpenPayment&&<Button
          disabled={operationsLocked||paymentBusy||paymentExpired||!appointmentSelected||payment?.paymentStatus==="PAID"}
          onClick={openRenewalPayment}
        >{paymentBusy?"Đang mở VNPay":payment&&["PENDING","PROCESSING","NOT_RECEIVED"].includes(payment.paymentStatus)?"Tiếp tục thanh toán":hasDeposit?"Thanh toán cọc":"Thanh toán toàn kỳ"}</Button>}
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
