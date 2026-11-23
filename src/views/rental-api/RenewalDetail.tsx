import { invoiceNumberLabel } from '../customer/paymentLabels'
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
  renewalDisplayLabel,
  renewalLabels,
  unknown,
} from "./presentation"
import RenewalReceipt from "../customer/RenewalReceipt"
import RenewalStatusPanel from './RenewalStatusPanel'
import { reconciledRenewalPayment, renewalPaymentDisplayLabel, renewalPaymentDisplayStatus, renewalProgress, renewalWorkflowLabel } from './renewalStatusPresentation'

const renewalStepCardClass = "rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-sm"

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
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null)
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false)
  const [noRefundAccepted, setNoRefundAccepted] = useState(false)
  const { manager, copy, explain } = useManagerPresentation()
  const actor = getAuthenticatedActor()
  const terms = r.acceptedTerms
  const extensionStartDate = r.effectivePeriod?.startDate ?? terms?.extensionStartDate
  const extensionEndDate = r.effectivePeriod?.newEndDate ?? r.newEndDate
  const extensionPeriodLabel = r.effectivePeriod?.finalized ? 'Kỳ gia hạn có hiệu lực' : 'Kỳ gia hạn dự kiến'
  const hasDeposit = !!terms && terms.renewalDepositAmount > 0
  const isManager = role === "manager"
  const canOpenPayment = role === "customer" && r.status === "accepted" && r.acceptedRevision !== null
    && !['ON_HOLD', 'NO_SHOW', 'SIGNING_EXPIRED', 'PAYMENT_WINDOW_EXPIRED'].includes(r.statusSummary?.workflowStatus ?? '')
  const { payment, busy: paymentBusy, error: paymentError, pay: openRenewalPayment, appointmentSelected } = useRenewalPayment(
    r, role === "customer", onPaymentChange,
  )
  const canViewReceipt = reconciledRenewalPayment(payment)
  const paymentDeadline = payment?.paymentDeadline ?? r.approvedPaymentDeadline
  const paymentExpired = r.status === "accepted" && !!paymentDeadline && Date.parse(paymentDeadline) <= Date.now() && payment?.paymentStatus !== "PAID"
  const paymentStatusLabel = payment ? renewalPaymentDisplayLabel(payment) : ''
  const paymentDisplayStatus = payment ? renewalPaymentDisplayStatus(payment) : null
  const paymentAmount = payment?.amount ?? (hasDeposit ? terms?.renewalDepositAmount : terms?.totalAfterDiscount) ?? r.amount
  const paymentCurrency = terms?.currency ?? r.currency
  const paymentAmountLabel = hasDeposit ? 'khoản trả trước gia hạn' : 'toàn bộ tiền gia hạn'
  const paymentDetail = payment?.settlementStage
    ? ({ AWAITING_PAYMENT: "Chờ VNPay xác nhận giao dịch.", VERIFIED_AWAITING_ALLOCATION: "Đang cập nhật khoản thanh toán vào hồ sơ.", ALLOCATED_AWAITING_SIGNING: "Đang kiểm tra điều kiện ký hợp đồng.", AWAITING_SIGNING: "Tiếp theo: đến cơ sở hoàn tất ký.", COMPLETED: "Đã hoàn tất xử lý khoản thanh toán.", RECONCILIATION_REQUIRED: "Giao dịch cần được cơ sở kiểm tra." }[payment.settlementStage])
    : payment?.message
  const isCustomer = role === "customer"
  const customerHasPaid =
    payment?.paymentStatus === "PAID" ||
    r.status === "completed" ||
    r.status === "deposit_paid" ||
    r.status === "full_rent_paid" ||
    (r.statusSummary?.transactions?.some((t) => t.status === "SUCCEEDED" && t.amount > 0) ?? false)
  const verification = r.systemVerification
  const workflowStatusLabel = r.statusSummary ? renewalWorkflowLabel(r) : paymentExpired ? "Đã hết hạn thanh toán, đang đối soát VNPay" : r.status === "accepted" && r.approvedPaymentDeadline
    ? isCustomer ? "Đã mở thanh toán qua VNPay thử nghiệm" : hasDeposit ? "Đã mở thanh toán tiền thuê trả trước qua VNPay thử nghiệm" : "Đã mở thanh toán toàn kỳ qua VNPay thử nghiệm"
    : r.status === "accepted" && verification?.status === "VERIFIED"
    ? "Đang kiểm tra điều kiện thanh toán"
    : copy(renewalLabels[r.status] || unknown)

  const renewalProgressSteps = isCustomer
    ? [
        { label: "Gửi yêu cầu", detail: "Hồ sơ gia hạn đã được tạo" },
        { label: "Thanh toán", detail: "Thanh toán tiền gia hạn qua VNPay" },
        { label: "Hoàn tất gia hạn", detail: "Hợp đồng được kích hoạt thời hạn mới" },
      ]
    : [
        { label: "Gửi yêu cầu", detail: "Hồ sơ gia hạn đã được tạo" },
        { label: "Kiểm tra & báo giá", detail: "Hệ thống xác minh điều kiện và ghi nhận điều khoản" },
        { label: "Thanh toán", detail: hasDeposit ? "Thanh toán tiền thuê gia hạn trả trước" : "Thanh toán tiền gia hạn" },
        { label: "Hẹn lịch ký", detail: "Chọn thời gian đến cơ sở" },
        { label: "Đối chiếu & ký", detail: "Staff xác minh, nhận tiền còn lại và lưu hợp đồng đã ký" },
      ]

  const renewalProgressIndex = isCustomer
    ? r.status === "completed"
      ? 3
      : customerHasPaid
        ? 2
        : 1
    : renewalProgress(r, payment)

  const renewalTerminalMessage = r.statusSummary?.workflowStatus === 'NO_SHOW' ? 'Cơ sở đã ghi nhận khách không đến lịch ký. Gian kho đang thuê vẫn giữ nguyên; khoản đã thu được theo dõi riêng để đối soát theo chính sách.'
    : r.statusSummary?.workflowStatus === 'SIGNING_EXPIRED' ? 'Hạn ký gia hạn đã hết. Khoản đã thu được theo dõi riêng để đối soát và xử lý theo chính sách.'
    : r.statusSummary?.workflowStatus === 'ON_HOLD' ? 'Hồ sơ đang tạm dừng xử lý. Vui lòng kiểm tra điều kiện, điều khoản hoặc khoản hoàn trước khi tiếp tục.'
    : r.status === "rejected" ? "Yêu cầu bị từ chối. Xem lý do quyết định bên dưới."
    : r.status === "cancelled" ? "Yêu cầu đã hủy. Các khoản đã thu cần được đối soát theo giao dịch."
      : r.status === "payment_expired" ? "Yêu cầu đã hết hạn thanh toán, các bước tiếp theo đang tạm dừng."
        : null
  const actions: {
    action: RenewalApiAction
    label: string
  }[] =
    role === "manager" || ["completed", "cancelled", "rejected"].includes(r.status) || customerHasPaid
      ? []
      : [
          ...(r.reviewState === "AWAITING_CUSTOMER_CONFIRMATION"
            ? [{ action: "ACCEPT_REVISED_QUOTE" as const, label: "Lấy báo giá và xác nhận lại" }]
            : []),
        ]
  const openPaymentConfirmation = () => {
    if (operationsLocked || paymentBusy || paymentExpired || !appointmentSelected || payment?.paymentStatus === "PAID") return
    setNoRefundAccepted(false)
    setPaymentConfirmationOpen(true)
  }
  const confirmPayment = () => {
    if (!noRefundAccepted || operationsLocked || paymentBusy || paymentExpired || payment?.paymentStatus === "PAID") return
    setPaymentConfirmationOpen(false)
    return openRenewalPayment()
  }
  return (
    <Card className="p-4 space-y-3">
      {r.status !== "completed" && <RenewalRiskNotice renewalId={r.id} role={role} revision={r.version} facilityId={r.facility.id} />}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-stone-50 p-3">
        <div>
          <p className="font-semibold text-stone-900">{r.storageUnit.code}</p>
          <p className="mt-1 text-sm font-semibold text-stone-700">{renewalDisplayLabel(r)}</p>
          <p className="text-sm text-stone-600">{r.facility.name.replace(/[--]/g, "-")}, {r.customer.fullName}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800" aria-label="Trạng thái hồ sơ gia hạn">{workflowStatusLabel}</span>
      </div>
      <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3" aria-label="Tiến trình hồ sơ gia hạn">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold">Tiến trình gia hạn</h4>
            <p className="text-xs text-stone-500">Đã hoàn thành {renewalProgressIndex}/{renewalProgressSteps.length} bước</p>
          </div>
          {renewalTerminalMessage
            ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">{r.statusSummary?.workflowStatus === 'NO_SHOW' ? 'Khách không đến' : 'Đang tạm dừng'}</span>
            : renewalProgressIndex === renewalProgressSteps.length
              ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Gia hạn hoàn tất</span>
              : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Đang thực hiện: {renewalProgressSteps[renewalProgressIndex]?.label}</span>}
        </div>
        <div className={`grid gap-2 sm:grid-cols-2 ${isCustomer ? "xl:grid-cols-3" : "xl:grid-cols-5"}`}>
          {renewalProgressSteps.map((step, index) => {
            const completed = index < renewalProgressIndex
            const current = index === renewalProgressIndex && renewalProgressIndex < renewalProgressSteps.length
            return <div key={step.label} aria-current={current ? "step" : undefined} className={`rounded-lg border p-3 ${completed ? "border-emerald-200 bg-emerald-50 text-emerald-950" : current ? "border-amber-400 bg-amber-500 text-white" : "border-stone-200 bg-white text-stone-400"}`}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${completed ? "bg-emerald-600 text-white" : current ? "bg-white text-amber-700" : "bg-stone-100 text-stone-500"}`}>{index + 1}</span>
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
        <div>
          <dt className="text-xs text-stone-500">{extensionPeriodLabel}</dt>
          <dd className="font-semibold text-stone-900">
            {rentalDate(extensionStartDate)} → {rentalDate(extensionEndDate)}
            {terms?.rentalMonths && <span className="ml-2 text-xs font-normal text-stone-500">({terms.rentalMonths} tháng tiếp nối kỳ hiện tại)</span>}
          </dd>
        </div>
      </dl>
      {r.reviewReason && <p>Lý do quyết định: {r.reviewReason}</p>}
      {r.cancellationReason && <p>Lý do hủy: {r.cancellationReason === "AUTO_RECOVERY_DAY_8" ? "Đã qua ngày quá hạn thứ 7, hồ sơ chuyển sang xử lý thu hồi kho. Tiền thuê trả trước đang chờ đối soát nguyên nhân." : r.cancellationReason}</p>}
      <div className="space-y-3">
          {r.statusSummary ? <RenewalStatusPanel summary={r.statusSummary} onReceipt={setReceiptPaymentId} /> : <p className="rounded-lg border border-stone-200 p-3 text-sm text-stone-600" role="status">Chưa xác định được bảng kê khoản phải thu. Cần đối soát trước khi xác nhận số tiền đã thanh toán hoặc còn phải thu.</p>}
          {role === "customer" && payment && <section className={`rounded-xl border p-4 ${payment.reconciliationRequired ? "border-amber-200 bg-amber-50/50" : "border-stone-200 bg-white"}`} aria-label="Thanh toán gia hạn" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-stone-700">{isCustomer ? "Thanh toán gia hạn" : hasDeposit ? "Tiền thuê gia hạn trả trước" : "Thanh toán toàn kỳ"}</h4>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentDisplayStatus === 'RECONCILIATION_REQUIRED' ? "bg-amber-100 text-amber-800" : paymentDisplayStatus === 'SUCCEEDED' ? "bg-emerald-50 text-emerald-700" : ["FAILED", "CANCELLED"].includes(payment.paymentStatus) ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>{paymentStatusLabel}</span>
            </div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xl font-bold tracking-tight text-stone-900">{rentalMoney(payment.amount, payment.currency)}</p>
                {payment.paidAt && <p className="mt-1 text-xs text-stone-500">Thanh toán lúc {rentalDate(payment.paidAt)}</p>}
                <p className="mt-1 text-xs text-stone-500">Số hóa đơn: {invoiceNumberLabel(payment.invoiceNumber)}{payment.invoiceNumber?.trim() && `, ${payment.invoiceStatus}`}</p>
              </div>
              {canViewReceipt && <Button type="button" size="sm" variant="outline" className="shrink-0 self-start sm:self-auto" onClick={() => setReceiptPaymentId(payment.paymentId)}>Xem biên lai</Button>}
            </div>
            {paymentDetail && <p className="mt-3 border-t border-stone-100 pt-2 text-xs leading-5 text-stone-600">{paymentDetail}</p>}
          </section>}
          {role === "customer" && paymentError && <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">{paymentError}</p>}
      </div>
      {receiptPaymentId && <Modal open onClose={() => setReceiptPaymentId(null)} title="Biên lai khoản thu gia hạn" size="lg">
        <RenewalReceipt id={r.id} paymentId={receiptPaymentId} role={role} />
      </Modal>}
      {terms ? (
        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold text-stone-900">Điều khoản và chi phí gia hạn</summary>
          <div className="mt-4 space-y-5 text-sm">
            <section aria-label="Thông tin gia hạn">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Thông tin gia hạn</h4>
              <dl className="grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
                <div><dt className="text-stone-500">Gói gia hạn</dt><dd className="mt-1 font-semibold text-stone-900">{terms.rentalMonths} tháng</dd></div>
                <div><dt className="text-stone-500">{extensionPeriodLabel}</dt><dd className="mt-1 font-semibold text-stone-900">{rentalDate(extensionStartDate)} → {rentalDate(extensionEndDate)}</dd></div>
                {terms.signingWindowDays != null && <div className="sm:col-span-2"><dt className="text-stone-500">Thời gian đến ký</dt><dd className="mt-1 text-stone-900">{terms.signingWindowDays} ngày từ khi thanh toán khoản trả trước thành công, trong giới hạn xử lý quá hạn.</dd></div>}
              </dl>
              <p className="mt-2 text-xs leading-5 text-stone-600">Chưa quá hạn: kỳ mới nối tiếp kỳ cũ. Nếu hoàn tất khi đã quá hạn: kỳ mới bắt đầu từ ngày ký, phí quá hạn tính riêng cho các ngày trước đó.</p>
            </section>
            <section aria-label="Chi phí gia hạn">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Chi phí gia hạn</h4>
              <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200 px-3">
                <div className="flex justify-between gap-4 py-2"><dt className="text-stone-600">Đơn giá/tháng</dt><dd className="text-right font-medium text-stone-900">{rentalMoney(terms.monthlyPrice, terms.currency)}</dd></div>
                <div className="flex justify-between gap-4 py-2"><dt className="text-stone-600">Tổng trước giảm</dt><dd className="text-right font-medium text-stone-900">{rentalMoney(terms.subtotal, terms.currency)}</dd></div>
                <div className="flex justify-between gap-4 py-2"><dt className="text-stone-600">Giảm giá</dt><dd className="text-right font-medium text-stone-900">{rentalMoney(terms.discountAmount, terms.currency)}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="font-semibold text-stone-900">Tổng sau điều chỉnh</dt><dd className="text-right font-bold text-stone-900">{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>
              </dl>
            </section>
            <section aria-label="Kế hoạch thanh toán">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Kế hoạch thanh toán</h4>
              <dl className="grid gap-2 sm:grid-cols-2">
                {hasDeposit ? <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><dt className="text-amber-900">Tiền thuê gia hạn trả trước</dt><dd className="mt-1 text-lg font-semibold text-amber-950">{rentalMoney(terms.renewalDepositAmount, terms.currency)}</dd></div>
                  <div className="rounded-lg border border-stone-200 p-3"><dt className="text-stone-600">Tiền thuê còn lại khi ký</dt><dd className="mt-1 text-lg font-semibold text-stone-900">{rentalMoney(terms.remainingRentalAmount, terms.currency)}</dd></div>
                </> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><dt className="text-amber-900">Tiền cần thanh toán</dt><dd className="mt-1 text-lg font-semibold text-amber-950">{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>}
              </dl>
              <p className="mt-2 text-xs leading-5 text-stone-600">{hasDeposit && 'Tiền thuê gia hạn trả trước được trừ vào tiền thuê kỳ mới. '}Tiền bảo đảm kho được giữ sang kỳ mới. Phí quá hạn và các phí phát sinh hợp lệ được ghi trong bảng kê thanh toán.</p>
            </section>
            {isManager && <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">Đây là số tiền theo báo giá, chưa xác nhận đã phát sinh nghĩa vụ hoặc đã thu tiền.</p>}
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
          <h4 className="font-bold text-emerald-900 text-sm">Gia hạn hợp đồng thành công</h4>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Hợp đồng thuê của bạn đã được gia hạn thành công. Thời hạn mới có hiệu lực đến ngày <b>{rentalDate(r.newEndDate)}</b>.
          </p>
        </div>
      )}
      {!isManager && r.reviewState === "AWAITING_CUSTOMER_CONFIRMATION" && <p role="status" className="text-amber-700">
        Báo giá đã thay đổi. Vui lòng lấy báo giá mới và xác nhận lại trước khi tiếp tục thanh toán.
      </p>}
      {isCustomer && customerHasPaid && r.status !== "completed" && !renewalTerminalMessage && !payment?.reconciliationRequired && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-1.5" role="status">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
            <h4 className="font-bold text-emerald-950 text-sm">Đã ghi nhận thanh toán gia hạn</h4>
          </div>
          <p className="text-xs text-emerald-900 leading-relaxed">
            Hệ thống đã ghi nhận khoản thanh toán. Vui lòng theo dõi lịch hẹn và đến cơ sở ký gia hạn. Thời hạn thuê mới có hiệu lực sau khi nhân viên đối soát đủ tiền và xác nhận hoàn tất ký.
          </p>
        </div>
      )}
      {isCustomer && canOpenPayment && !paymentExpired && !customerHasPaid && appointmentSelection && (
        <details className={renewalStepCardClass} open>
          <summary className="flex cursor-pointer select-none flex-wrap items-center justify-between gap-x-3 gap-y-1 font-semibold text-amber-950">
            <span>Bước 1: Chọn &amp; lưu lịch hẹn ký gia hạn tại cơ sở</span>
            <span className="text-xs font-normal text-amber-700">Bấm để thu gọn / mở rộng</span>
          </summary>
          <div className="mt-3 border-t border-amber-200/60 pt-3">
            {appointmentSelection}
          </div>
        </details>
      )}
      {paymentExpired ? (
        <p className="text-sm text-stone-600">Hạn thanh toán đã qua. Hệ thống đang kiểm tra kết quả VNPay, khi xác nhận chưa thu tiền, yêu cầu sẽ được đóng để bạn có thể gửi yêu cầu gia hạn mới.</p>
      ) : canOpenPayment ? (
        <div className={renewalStepCardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-amber-950">
                {payment?.paymentStatus === "PAID"
                  ? "Đã ghi nhận thanh toán qua VNPay"
                  : hasDeposit
                  ? "Bước 2: Thanh toán khoản trả trước qua VNPay"
                  : "Thanh toán gia hạn trực tuyến qua VNPay"}
              </p>
              <p className="mt-1 text-xs text-amber-900">
                {payment?.paymentStatus === "PAID"
                  ? "Khoản thanh toán đã được ghi nhận thành công."
                  : hasDeposit
                  ? "Vui lòng thanh toán khoản trả trước trong thời gian VNPay hiển thị, tối đa 15 phút. Phần còn lại thanh toán tại cơ sở khi ký phụ lục."
                  : "Hỗ trợ quét mã VNPAY-QR hoặc thẻ ATM / Internet Banking nội địa. Sau khi thanh toán, vui lòng theo dõi lịch ký tại cơ sở."}
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">Cổng VNPay</span>
          </div>
          {payment?.paymentStatus !== "PAID" && <p className="mt-3 rounded border border-amber-300/60 bg-amber-500/10 px-2 py-1.5 text-[11px] font-semibold text-amber-950">
            ⚠️ {paymentAmountLabel[0].toUpperCase() + paymentAmountLabel.slice(1)} {rentalMoney(paymentAmount, paymentCurrency)} không được hoàn lại nếu khách tự ý hủy hoặc không tiếp tục gia hạn sau khi thanh toán.
          </p>}
          <div className="mt-3 border-t border-amber-200/60 pt-3">
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              disabled={operationsLocked || paymentBusy || paymentExpired || !appointmentSelected || payment?.paymentStatus === "PAID"}
              onClick={openPaymentConfirmation}
            >
              {paymentBusy ? "Đang mở cổng VNPay..." : payment && ["PENDING", "PROCESSING", "NOT_RECEIVED"].includes(payment.paymentStatus) ? "Tiếp tục thanh toán qua VNPay" : hasDeposit ? "Thanh toán trả trước qua VNPay" : "Thanh toán toàn kỳ qua VNPay"}
            </Button>
          </div>
        </div>
      ) : null}
      <Modal size="lg" open={paymentConfirmationOpen} onClose={() => { if (!paymentBusy) setPaymentConfirmationOpen(false) }} title="Thông báo quan trọng">
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-950">
            <div className="space-y-2 text-xs">
              <p className="text-sm font-bold uppercase tracking-wider text-rose-900">
                Thông báo quan trọng: Quy định không hoàn tiền gia hạn
              </p>
              <p className="font-medium leading-relaxed text-rose-900">
                Khoản thanh toán ngay <b>{rentalMoney(paymentAmount, paymentCurrency)}</b> là {paymentAmountLabel}. Sau khi thanh toán, khoản này <b>không được hoàn lại nếu khách tự ý hủy hoặc không tiếp tục gia hạn</b>.
              </p>
              <p className="text-[11px] leading-relaxed text-rose-800">
                Vui lòng kiểm tra kỹ kỳ gia hạn, số tiền và lịch ký trước khi xác nhận. Giao dịch lỗi, thu trùng hoặc trường hợp được xử lý theo chính sách của StorageHub sẽ được đối soát theo hồ sơ giao dịch.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer select-none items-start gap-2.5 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-800 transition hover:bg-stone-100">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              checked={noRefundAccepted}
              onChange={(event) => setNoRefundAccepted(event.target.checked)}
            />
            <span className="leading-tight">
              Tôi xác nhận đã đọc, hiểu rõ và đồng ý rằng <b>{paymentAmountLabel} không được hoàn lại nếu tôi tự ý hủy hoặc không tiếp tục gia hạn sau khi thanh toán</b>.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={paymentBusy}
              onClick={() => setPaymentConfirmationOpen(false)}
            >
              Quay lại
            </Button>
            <Button
              disabled={operationsLocked || paymentBusy || paymentExpired || payment?.paymentStatus === "PAID" || !noRefundAccepted}
              onClick={confirmPayment}
            >
              {paymentBusy ? "Đang chuyển sang VNPay…" : "Xác nhận & Chuyển sang VNPay"}
            </Button>
          </div>
        </div>
      </Modal>
      <div className="flex flex-wrap gap-2">
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
      {financeHistory}
      {evidenceDocuments}
    </Card>
  )
}
