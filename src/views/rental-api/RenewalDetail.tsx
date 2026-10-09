import { useManagerPresentation } from "../manager/managerPresentation"
import { Button, Card } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import type { RentalApiRole } from "../../types/rentalApi"
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
}: {
  renewal: RenewalApiRecord
  role: RentalApiRole
  onAction: (action: RenewalApiAction) => void
}) {
  const { manager, copy, explain } = useManagerPresentation()

  const actor = getAuthenticatedActor()
  const terms = r.acceptedTerms
  const actions: {
    action: RenewalApiAction
    label: string
  }[] =
    role === "manager"
      ? [
          { action: "APPROVE", label: "Duyệt" },
          { action: "REJECT", label: "Từ chối" },
        ]
      : [
          {
            action: "ACCEPT_REVISED_QUOTE",
            label: "Lấy báo giá và xác nhận lại",
          },
          { action: "CANCEL", label: "Hủy yêu cầu" },
        ]
  return (
    <Card className="p-4 space-y-3">
      <p className="break-all">Mã gia hạn: {r.id}</p>
      <p className="break-all">Hồ sơ thuê: {r.rentalId}</p>
      <p>
        {r.customer.fullName} · {r.facility.name} · {r.storageUnit.code}
      </p>
      <p>
        Trạng thái: {copy(renewalLabels[r.status] || unknown)}
      </p>
      <p>
        Ngày kết thúc cũ: {rentalDate(r.oldEndDate)} · Ngày kết thúc đề nghị:{" "}
        {rentalDate(r.newEndDate)}
      </p>
      <p>Tiền gia hạn: {rentalMoney(r.amount, r.currency)}</p>
      <p>
        Thời điểm gửi: {rentalDate(r.createdAt)}
      </p>
      <p>
        Thời điểm duyệt:{" "}
        {rentalDate(r.reviewedAt)}
      </p>
      {r.reviewReason && <p>Lý do quyết định: {r.reviewReason}</p>}
      {r.cancellationReason && <p>Lý do hủy: {r.cancellationReason}</p>}
      <p>
        Kiểm tra thanh toán: {financialCompletenessLabels[r.financialCheck.completeness] ?? unknown} ·{" "}
        {rentalDate(r.financialCheck.checkedAt)}
      </p>
      <p>
        Khoản thanh toán cần xử lý:{" "}
        {r.financialCheck.blockingObligationRefs?.join(", ") ||
          (r.financialCheck.blockingObligationRefs === null
            ? unknown
            : "Không có khoản cần xử lý theo lần kiểm tra này")}
      </p>
      <p>
        Khiếu nại chưa giải quyết:{" "}
        {r.financialCheck.hasUnresolvedDispute === null
          ? unknown
          : r.financialCheck.hasUnresolvedDispute
            ? "Có"
            : "Không"}
      </p>
      {r.approvedPaymentDeadline && (
        <p>Hạn thanh toán: {rentalDate(r.approvedPaymentDeadline)}</p>
      )}
      {terms ? (
        <section className="rounded border border-stone-200 p-3 space-y-2">
          <h4 className="font-semibold">Điều khoản khách hàng đã chấp nhận</h4>
          <p>Gói: {terms.pricingPackageCode} · {terms.rentalMonths} tháng</p>
          <p>Kỳ gia hạn: {rentalDate(terms.extensionStartDate)} → {rentalDate(terms.newEndDate)}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt>Đơn giá/tháng</dt><dd>{rentalMoney(terms.monthlyPrice, terms.currency)}</dd></div>
            <div><dt>Trước giảm giá</dt><dd>{rentalMoney(terms.subtotal, terms.currency)}</dd></div>
            <div><dt>Giảm giá</dt><dd>{rentalMoney(terms.discountAmount, terms.currency)}</dd></div>
            <div><dt>Tổng tiền gia hạn</dt><dd>{rentalMoney(terms.totalAfterDiscount, terms.currency)}</dd></div>
            <div><dt>Cọc gia hạn</dt><dd>{rentalMoney(terms.renewalDepositAmount, terms.currency)}</dd></div>
            <div><dt>Tiền thuê còn lại</dt><dd>{rentalMoney(terms.remainingRentalAmount, terms.currency)}</dd></div>
          </dl>
        </section>
      ) : (
        <p className="text-sm text-stone-500">Chưa có điều khoản được khách hàng chấp nhận, chưa thể xác định giá và tiền cọc.</p>
      )}
      {r.status === "approved" && (
        <p className="rounded bg-amber-50 p-3">
          Đã duyệt, chờ thanh toán và hoàn tất ký gia hạn. Ngày kết thúc thuê chưa thay đổi.</p>
      )}
      {r.version === null && (
        <p className="text-amber-700">
          Hồ sơ chưa đủ thông tin để xử lý, hiện chỉ có thể xem.</p>
      )}
      {r.disabledReasons.length > 0 && <p role="status" className="text-amber-700">
        Chưa đủ điều kiện xử lý. Vui lòng kiểm tra hồ sơ hoặc liên hệ quản lý.
      </p>}
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((a) => r.allowedActions.includes(a.action))
          .map((a) => (
            <Button
              key={a.action}
              variant={
                a.action === "REJECT" || a.action === "CANCEL"
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
