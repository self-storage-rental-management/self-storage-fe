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
import RenewalStatusPanel from './RenewalStatusPanel'
import { reconciledRenewalPayment, renewalPaymentDisplayLabel, renewalPaymentDisplayStatus, renewalProgress, renewalWorkflowLabel } from './renewalStatusPresentation'
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
  const { manager, copy, explain } = useManagerPresentation()
  const actor = getAuthenticatedActor()
  const terms = r.acceptedTerms
  const extensionStartDate = r.effectivePeriod?.startDate ?? terms?.extensionStartDate
  const extensionEndDate = r.effectivePeriod?.newEndDate ?? r.newEndDate
  const extensionPeriodLabel = r.effectivePeriod?.finalized ? 'Kỳ gia hạn có hiệu lực' : 'Kỳ gia hạn dự kiến'
  const isSplit = !!terms && terms.remainingRentalAmount > 0
  const hasDeposit = !!terms && terms.renewalDepositAmount > 0
  const isManager = role === "manager"
  const canOpenPayment = role === "customer" && r.status === "accepted" && r.acceptedRevision !== null
    && !['ON_HOLD', 'SIGNING_EXPIRED', 'PAYMENT_WINDOW_EXPIRED'].includes(r.statusSummary?.workflowStatus ?? '')
  const { payment, busy: paymentBusy, error: paymentError, pay: openRenewalPayment, appointmentSelected } = useRenewalPayment(
    r, role === "customer", onPaymentChange,
  )
  const canViewReceipt = reconciledRenewalPayment(payment)
  const paymentDeadline = payment?.paymentDeadline ?? r.approvedPaymentDeadline
  const paymentExpired = r.status === "accepted" && !!paymentDeadline && Date.parse(paymentDeadline) <= Date.now() && payment?.paymentStatus !== "PAID"
  const paymentStatusLabel = payment ? renewalPaymentDisplayLabel(payment) : ''
  const paymentDisplayStatus = payment ? renewalPaymentDisplayStatus(payment) : null
  const paymentDetail = payment?.settlementStage
    ? ({ AWAITING_PAYMENT: "Chờ VNPay xác nhận giao dịch.", VERIFIED_AWAITING_ALLOCATION: "Đang cập nhật khoản thanh toán vào hồ sơ.", ALLOCATED_AWAITING_SIGNING: "Đang kiểm tra điều kiện ký hợp đồng.", AWAITING_SIGNING: "Tiếp theo: đến cơ sở hoàn tất ký.", COMPLETED: "Đã hoàn tất xử lý khoản thanh toán.", RECONCILIATION_REQUIRED: "Giao dịch cần được cơ sở kiểm tra." }[payment.settlementStage])
    : payment?.message
  const verification = r.systemVerification
  const workflowStatusLabel = r.statusSummary ? renewalWorkflowLabel(r) : paymentExpired ? "Đã hết hạn thanh toán, đang đối soát VNPay" : r.status === "accepted" && r.approvedPaymentDeadline
    ? hasDeposit ? "Đã mở thanh toán tiền thuê trả trước qua VNPay Sandbox" : "Đã mở thanh toán toàn kỳ qua VNPay Sandbox"
    : r.status === "accepted" && verification?.status === "VERIFIED"
    ? "Đã xác nhận điều kiện, chờ kiểm tra readiness thanh toán"
    : copy(renewalLabels[r.status] || unknown)
  const renewalProgressSteps = [
    { label: "Gửi yêu cầu", detail: "Hồ sơ gia hạn đã được tạo" },
    { label: "Kiểm tra & báo giá", detail: "Hệ thống xác minh điều kiện và ghi nhận điều khoản" },
    { label: "Thanh toán", detail: hasDeposit ? "Thanh toán tiền thuê gia hạn trả trước" : "Thanh toán tiền gia hạn" },
    { label: "Hẹn lịch ký", detail: "Chọn thời gian đến cơ sở" },
    { label: "Đối chiếu & ký", detail: "Staff xác minh, nhận tiền còn lại và lưu hợp đồng đã ký" },
  ]
  const renewalProgressIndex = renewalProgress(r, payment)
  const renewalTerminalMessage = r.statusSummary?.workflowStatus === 'SIGNING_EXPIRED' ? 'Hạn ký gia hạn đã hết. Khoản đã thu được theo dõi riêng để đối soát và xử lý theo chính sách.'
    : r.statusSummary?.workflowStatus === 'ON_HOLD' ? 'Hồ sơ đang tạm dừng xử lý. Vui lòng kiểm tra điều kiện, điều khoản hoặc khoản hoàn trước khi tiếp tục.'
    : r.status === "rejected" ? "Yêu cầu bị từ chối. Xem lý do quyết định bên dưới."
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
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800" aria-label="Trạng thái hồ sơ gia hạn">{workflowStatusLabel}</span>
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
        <div><dt className="text-xs text-stone-500">{extensionPeriodLabel}</dt><dd className="font-semibold">{rentalDate(extensionStartDate)} → {rentalDate(extensionEndDate)}</dd></div>
      </dl>
      {r.reviewReason && <p>Lý do quyết định: {r.reviewReason}</p>}
      {r.cancellationReason && <p>Lý do hủy: {r.cancellationReason === "AUTO_RECOVERY_DAY_8" ? "Đã qua ngày quá hạn thứ 7, hồ sơ chuyển sang xử lý thu hồi kho. Tiền thuê trả trước đang chờ đối soát nguyên nhân." : r.cancellationReason}</p>}
      <div className="space-y-3">
          {r.statusSummary ? <RenewalStatusPanel summary={r.statusSummary} onReceipt={setReceiptPaymentId} /> : <p className="rounded-lg border border-stone-200 p-3 text-sm text-stone-600" role="status">Chưa xác định được bảng kê khoản phải thu. Cần đối soát trước khi xác nhận số tiền đã thanh toán hoặc còn phải thu.</p>}
          {role === "customer" && payment && <section className={`rounded-xl border p-4 ${payment.reconciliationRequired ? "border-amber-200 bg-amber-50/50" : "border-stone-200 bg-white"}`} aria-label="Thanh toán gia hạn" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-stone-700">{hasDeposit ? "Tiền thuê gia hạn trả trước" : "Thanh toán toàn kỳ"}</h4>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentDisplayStatus === 'RECONCILIATION_REQUIRED' ? "bg-amber-100 text-amber-800" : paymentDisplayStatus === 'SUCCEEDED' ? "bg-emerald-50 text-emerald-700" : ["FAILED", "CANCELLED"].includes(payment.paymentStatus) ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>{paymentStatusLabel}</span>
            </div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xl font-bold tracking-tight text-stone-900">{rentalMoney(payment.amount, payment.currency)}</p>
                {payment.paidAt && <p className="mt-1 text-xs text-stone-500">Thanh toán lúc {rentalDate(payment.paidAt)}</p>}
              </div>
              {canViewReceipt && <Button type="button" size="sm" variant="outline" className="shrink-0 self-start sm:self-auto" onClick={() => setReceiptPaymentId(payment.paymentId)}>Xem biên lai</Button>}
            </div>
            {paymentDetail && <p className="mt-3 border-t border-stone-100 pt-2 text-xs leading-5 text-stone-600">{paymentDetail}</p>}
          </section>}
          {role === "customer" && paymentError && <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">{paymentError}</p>}
      </div>
      {financeHistory}
      {evidenceDocuments}
      {receiptPaymentId && <Modal open onClose={() => setReceiptPaymentId(null)} title="Biên lai khoản thu gia hạn" size="lg">
        <RenewalReceipt id={r.id} paymentId={receiptPaymentId} role={role} />
      </Modal>}
      {terms ? (
        <details className="rounded-xl border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer font-semibold">Điều khoản</summary>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-stone-600">Gói gia hạn: {terms.rentalMonths} tháng</p>
            {terms.signingWindowDays != null && <p className="text-sm text-stone-600">Thời gian đến ký: {terms.signingWindowDays} ngày từ khi thanh toán khoản trả trước thành công, trong giới hạn xử lý quá hạn. Đây là thời gian chuẩn bị đến ký, không phải setup miễn phí.</p>}
            <p className="text-sm text-stone-600">{extensionPeriodLabel}: {rentalDate(extensionStartDate)} → {rentalDate(extensionEndDate)}</p>
            <p className="text-sm text-stone-600">Chưa quá hạn: kỳ mới nối tiếp kỳ cũ. Nếu hoàn tất khi đã quá hạn: kỳ mới bắt đầu từ ngày ký, phí quá hạn tính riêng cho các ngày trước đó. Không cộng ngày setup.</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-stone-500">Đơn giá/tháng</dt><dd className="font-medium">{rentalMoney(terms.monthlyPrice, terms.currency)}</dd></div>
              <div><dt className="text-stone-500">Tổng trước giảm</dt><dd className="font-medium">{rentalMoney(terms.subtotal, terms.currency)}</dd></div>
              <div><dt className="text-stone-500">Giảm giá</dt><dd className="font-medium">{rentalMoney(terms.discountAmount, terms.currency)}</dd></div>
              <div><dt className="text-stone-500">Tổng sau điều chỉnh</dt><dd className="font-semibold">{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>
              {hasDeposit ? <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><dt className="text-amber-900">Tiền thuê gia hạn trả trước</dt><dd className="mt-1 text-lg font-semibold text-amber-950">{rentalMoney(terms.renewalDepositAmount, terms.currency)}</dd></div>
                <div><dt className="text-stone-500">Tiền thuê còn lại khi ký</dt><dd className="font-medium">{rentalMoney(terms.remainingRentalAmount, terms.currency)}</dd></div>
              </> : <div><dt className="text-stone-500">Tiền cần thanh toán</dt><dd className="font-medium">{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>}
            </dl>
            <p className="text-sm text-stone-600">Tiền thuê gia hạn trả trước được trừ vào tiền thuê kỳ mới. Không thu lại cọc bảo đảm kho đang giữ. Phí quá hạn và phí phát sinh hợp lệ, nếu có, được ghi riêng trong bảng kê thanh toán.</p>
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
            Quý khách bấm <b>{isSplit ? "Thanh toán đợt 1 qua VNPay" : "Thanh toán gia hạn qua VNPay"}</b> bên dưới. Sau khi thanh toán được xác minh, vui lòng hoàn tất đối chiếu và ký tại cơ sở. Kỳ gia hạn có hiệu lực được xác nhận khi hoàn tất ký.
          </p>
        </div>
      )}
      {!isManager && r.reviewState === "AWAITING_CUSTOMER_CONFIRMATION" && <p role="status" className="text-amber-700">
        Báo giá đã thay đổi. Vui lòng lấy báo giá mới và xác nhận lại trước khi tiếp tục thanh toán.
      </p>}
      {appointmentSelection}
      {paymentExpired ? <p className="text-sm text-stone-600">Hạn thanh toán đã qua. Hệ thống đang kiểm tra kết quả VNPay, khi xác nhận chưa thu tiền, yêu cầu sẽ được đóng để bạn có thể gửi yêu cầu gia hạn mới.</p> : canOpenPayment && !appointmentSelected && <p className="text-sm text-stone-600">Lưu lịch ký trước khi {hasDeposit ? "thanh toán tiền thuê trả trước" : "thanh toán"}.</p>}
      <div className="flex flex-wrap gap-2">
        {canOpenPayment&&<Button
          disabled={operationsLocked||paymentBusy||paymentExpired||payment?.paymentStatus==="PAID"}
          onClick={openRenewalPayment}
        >{paymentBusy?"Đang mở VNPay":payment&&["PENDING","PROCESSING","NOT_RECEIVED"].includes(payment.paymentStatus)?"Tiếp tục thanh toán":hasDeposit?"Thanh toán tiền thuê trả trước":"Thanh toán toàn kỳ"}</Button>}
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
