import { useManagerPresentation } from "../manager/managerPresentation"
import { Button, Card } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { useRenewalPayment } from "../../hooks/useRenewalPayment"
import LedgerPanel from "../rental-support-integration/LedgerPanel"
import type { RentalApiRole } from "../../types/rentalApi"
import type { ReactNode } from "react"
import type { RenewalApiAction, RenewalApiRecord } from "../../types/renewalApi"
import {
  hasRenewalAction,
  rentalDate,
  rentalMoney,
  renewalLabels,
  unknown,
  financialCompletenessLabels,
} from "./presentation"
export default function RenewalDetail({
  renewal: r,
  role,
  onAction,
  onPaymentChange,
  appointmentSelection,
  operationsLocked = false,
}: {
  renewal: RenewalApiRecord
  role: RentalApiRole
  onAction: (action: RenewalApiAction) => void
  onPaymentChange?: () => void
  appointmentSelection?: ReactNode
  operationsLocked?: boolean
}) {
  const { manager, copy, explain } = useManagerPresentation()
  const actor = getAuthenticatedActor()
  const terms = r.acceptedTerms
  const hasDeposit = !!terms && terms.renewalDepositAmount > 0
  const isManager = role === "manager"
  const canOpenPayment = role === "customer" && r.status === "accepted" && r.acceptedRevision !== null
  const { payment, busy: paymentBusy, error: paymentError, pay: openRenewalPayment, appointmentSelected } = useRenewalPayment(
    r, role === "customer", onPaymentChange,
  )
  const financialState = r.financialCheck.completeness
  const obligationRefs = r.financialCheck.blockingObligationRefs
  const obligationsState = obligationRefs === null
    ? "Chưa xác minh"
    : obligationRefs.length > 0
      ? "Cần xử lý"
      : financialState === "COMPLETE"
        ? "Không có khoản chặn theo lần kiểm tra"
        : "Chưa xác minh, không thể kết luận là không có nợ"
  const reviewState = r.reviewState === "READY"
    ? "Điều khoản hiện tại còn hiệu lực"
    : r.reviewState === "AWAITING_CUSTOMER_CONFIRMATION"
      ? "Khách hàng cần xác nhận báo giá mới"
      : "Chưa xác minh điều khoản hoặc nguồn vận hành"
  const verification = r.systemVerification
  const verificationLabel = verification?.status === "VERIFIED"
    ? "Đã xác minh các nguồn hiện có"
    : verification?.status === "BLOCKED"
      ? "Có điều kiện hiện có không đạt"
      : verification?.status === "INCOMPLETE"
        ? "Chưa đủ dữ liệu từ nguồn hiện có"
        : "Chưa xác minh"
  const workflowStatusLabel = r.status === "accepted" && r.approvedPaymentDeadline
    ? hasDeposit ? "Đã mở thanh toán cọc qua VNPay Sandbox" : "Đã mở thanh toán toàn kỳ qua VNPay Sandbox"
    : r.status === "accepted" && verification?.status === "VERIFIED"
    ? "Đã xác nhận điều kiện, chờ kiểm tra readiness thanh toán"
    : copy(renewalLabels[r.status] || unknown)
  const verificationCheckLabel = (check: string) => ({
    ACTIVE_RENTAL_AND_PERIOD: "Hồ sơ thuê đang hoạt động và kỳ thuê hợp lệ",
    PUBLISHED_POLICY: "Chính sách gia hạn đã công bố",
    ELIGIBILITY_AND_RECOVERY: "Điều kiện gia hạn và hạn xử lý",
    CURRENT_PRICING_AND_ACCEPTED_TERMS: "Giá hiện tại khớp điều khoản khách đã chấp nhận",
  }[check] ?? check)
  const actions: {
    action: RenewalApiAction
    label: string
  }[] =
    role === "manager"
      ? []
      : [
          { action: "CANCEL", label: "Hủy yêu cầu" },
        ]
  return (
    <Card className="p-4 space-y-3">
      <p className="break-all">Mã gia hạn: {r.id}</p>
      <p className="break-all">Hồ sơ thuê: {r.rentalId}</p>
      <p>
        {r.customer.fullName}, {r.facility.name.replace(/[–—]/g, "-")}, {r.storageUnit.code}
      </p>
      <p>
        Trạng thái: {workflowStatusLabel}
      </p>
      <p>
        Mốc kết thúc kỳ thuê cũ: {rentalDate(r.oldEndDate)}, Ngày cuối kỳ gia hạn:{" "}
        {rentalDate(r.newEndDate)}
      </p>
      <p>Tiền gia hạn: {rentalMoney(r.amount, r.currency)}</p>
      <p>
        Thời điểm gửi: {rentalDate(r.createdAt)}
      </p>
      {r.reviewReason && <p>Lý do quyết định: {r.reviewReason}</p>}
      {r.cancellationReason && <p>Lý do hủy: {r.cancellationReason}</p>}
      {isManager ? (
        <section className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3" aria-labelledby="renewal-monitoring">
          <div>
            <h4 id="renewal-monitoring" className="font-semibold">Theo dõi yêu cầu gia hạn</h4>
            <p className="text-sm text-stone-600">Manager theo dõi hồ sơ, không cần duyệt để khách hàng được thanh toán. Hệ thống chỉ mở thanh toán khi điều kiện và nguồn thanh toán sẵn sàng.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-600">
                  <th scope="col" className="py-2 pr-4">Điều kiện</th>
                  <th scope="col" className="py-2 pr-4">Trạng thái</th>
                  <th scope="col" className="py-2">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-stone-200 align-top">
                  <th scope="row" className="py-2 pr-4 font-medium">Xác minh tự động</th>
                  <td className="py-2 pr-4">{verificationLabel}</td>
                  <td className="py-2">
                    {verification?.verifiedChecks.length ? <p>Đã kiểm tra: {verification.verifiedChecks.map(verificationCheckLabel).join(", ")}</p> : null}
                    {verification?.blockingReasons.map((reason) => <p key={reason} className="text-red-700">{copy(reason)}</p>)}
                  </td>
                </tr>
                <tr className="border-b border-stone-200 align-top">
                  <th scope="row" className="py-2 pr-4 font-medium">Báo giá khách đã chấp nhận</th>
                  <td className="py-2 pr-4">{reviewState}</td>
                  <td className="py-2">{r.acceptedRevision == null ? unknown : `Phiên bản ${r.acceptedRevision}`}</td>
                </tr>
                <tr className="border-b border-stone-200 align-top">
                  <th scope="row" className="py-2 pr-4 font-medium">Đối soát tài chính Rental hiện tại</th>
                  <td className="py-2 pr-4">{financialCompletenessLabels[financialState] ?? unknown}</td>
                  <td className="py-2">{rentalDate(r.financialCheck.checkedAt)}, đây không phải xác nhận đã thu tiền gia hạn.</td>
                </tr>
                <tr className="border-b border-stone-200 align-top">
                  <th scope="row" className="py-2 pr-4 font-medium">Khoản đến hạn cần xử lý</th>
                  <td className="py-2 pr-4">{obligationsState}</td>
                  <td className="py-2">{obligationRefs?.length ? obligationRefs.join(", ") : ""}</td>
                </tr>
                <tr className="border-b border-stone-200 align-top">
                  <th scope="row" className="py-2 pr-4 font-medium">Khiếu nại chưa giải quyết</th>
                  <td className="py-2 pr-4">{r.financialCheck.hasUnresolvedDispute === null ? unknown : r.financialCheck.hasUnresolvedDispute ? "Có" : "Không ghi nhận"}</td>
                  <td className="py-2">{r.financialCheck.checkedAt ? `Kiểm tra lúc ${rentalDate(r.financialCheck.checkedAt)}` : unknown}</td>
                </tr>
                <tr className="align-top">
                  <th scope="row" className="py-2 pr-4 font-medium">Khả năng thanh toán</th>
                  <td className="py-2 pr-4 font-semibold">{r.approvedPaymentDeadline ? "Đã mở thanh toán" : "Chưa mở thanh toán"}</td>
                  <td className="py-2">VNPay Sandbox chỉ mở khi đối soát tài chính, kỳ hạn, giữ chỗ và lịch ký đạt readiness. Khi đã mở, hạn thanh toán bắt đầu từ lúc payment intent khả dụng.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {r.approvedPaymentDeadline && (
        <p>Hạn thanh toán: {rentalDate(r.approvedPaymentDeadline)}</p>
      )}
      {role==="customer"&&payment&&(
        <section className={`space-y-1 rounded-lg border p-3 ${payment.reconciliationRequired?"border-amber-300 bg-amber-50":"border-stone-200 bg-stone-50"}`} aria-live="polite">
          <p className="font-semibold">Trạng thái thanh toán {hasDeposit ? "cọc" : "toàn kỳ"}: {({PENDING:"Đang chờ VNPay",PROCESSING:"Đang xử lý",PAID:payment.reconciliationRequired?"Đã nhận tiền, cần đối soát":"Đã ghi nhận thanh toán",NOT_RECEIVED:"Chưa xác nhận đã nhận tiền",FAILED:"Thanh toán thất bại",CANCELLED:"Giao dịch đã hủy"} as Record<string,string>)[payment.paymentStatus]}</p>
          <p>{payment.settlementStage ? ({
            AWAITING_PAYMENT: "Chờ VNPay xác nhận thanh toán",
            VERIFIED_AWAITING_ALLOCATION: "Đã xác minh tiền, đang chờ phân bổ vào khoản gia hạn",
            ALLOCATED_AWAITING_SIGNING: "Đã phân bổ tiền, đang kiểm tra điều kiện ký hợp đồng",
            AWAITING_SIGNING: "Đã thanh toán, cần hoàn tất ký hợp đồng để gia hạn có hiệu lực",
            COMPLETED: "Gia hạn đã hoàn tất",
            RECONCILIATION_REQUIRED: "Đã ghi nhận tiền, cần hỗ trợ đối soát trước khi tiếp tục",
          }[payment.settlementStage]) : payment.message}</p>
          <p>Số tiền: {rentalMoney(payment.amount,payment.currency)}</p>
          {payment.paidAt&&<p>Thời điểm VNPay ghi nhận: {rentalDate(payment.paidAt)}</p>}
          {payment.paymentDeadline&&<p>Hạn thanh toán: {rentalDate(payment.paymentDeadline)}</p>}
        </section>
      )}
      {role==="customer"&&paymentError&&<p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">{paymentError}</p>}
      {terms ? (
        <section className="rounded border border-stone-200 p-3 space-y-2">
          <h4 className="font-semibold">Điều khoản khách hàng đã chấp nhận</h4>
          <p>Gói gia hạn: {terms.rentalMonths} tháng</p>
          <p>Kỳ gia hạn: {rentalDate(terms.extensionStartDate)} - {rentalDate(terms.newEndDate)}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt>Đơn giá/tháng</dt><dd>{rentalMoney(terms.monthlyPrice, terms.currency)}</dd></div>
            <div><dt>Trước giảm giá</dt><dd>{rentalMoney(terms.subtotal, terms.currency)}</dd></div>
            <div><dt>Giảm giá</dt><dd>{rentalMoney(terms.discountAmount, terms.currency)}</dd></div>
            <div><dt>Tổng tiền gia hạn</dt><dd>{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>
            {hasDeposit ? <>
              <div><dt>Cọc gia hạn trả trước</dt><dd>{rentalMoney(terms.renewalDepositAmount, terms.currency)}</dd></div>
              <div><dt>Tiền thuê còn lại khi ký</dt><dd>{rentalMoney(terms.remainingRentalAmount, terms.currency)}</dd></div>
            </> : <div><dt>Toàn bộ tiền thuê gia hạn cần thanh toán</dt><dd>{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>}
          </dl>
          {isManager && <p className="text-sm text-stone-600">Đây là số tiền theo báo giá, chưa xác nhận đã phát sinh nghĩa vụ hoặc đã thu tiền.</p>}
        </section>
      ) : (
        <p className="text-sm text-stone-500">Chưa có điều khoản được khách hàng chấp nhận, chưa thể xác định giá và khoản thanh toán.</p>
      )}
      {r.status === "approved" && (
        <p className="rounded bg-amber-50 p-3">
          Hồ sơ gia hạn đã được duyệt. Trạng thái này chưa xác nhận đã thanh toán hoặc hoàn tất ký, ngày kết thúc thuê chưa thay đổi.</p>
      )}
      <LedgerPanel key={`${r.id}:${r.version}`} role={role} id={r.rentalId} />
      {r.version === null && (
        <p className="text-amber-700">
          Hồ sơ chưa đủ thông tin để xử lý, hiện chỉ có thể xem.</p>
      )}
      {!isManager && r.disabledReasons.length > 0 && <p role="status" className="text-amber-700">
        Chưa đủ điều kiện xử lý. Vui lòng kiểm tra hồ sơ hoặc liên hệ quản lý.
      </p>}
      {appointmentSelection}
      {canOpenPayment && !appointmentSelected && <p className="text-sm text-stone-600">Lưu lịch ký trước khi thanh toán cọc.</p>}
      <div className="flex flex-wrap gap-2">
        {canOpenPayment&&<Button
          disabled={operationsLocked||paymentBusy||!appointmentSelected||payment?.paymentStatus==="PAID"}
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
