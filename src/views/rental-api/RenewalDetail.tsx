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
        Trạng thái: {copy(renewalLabels[r.status] || r.status)}
        {!manager && <> · Review: {r.reviewState}</>}
      </p>
      <p>
        Ngày kết thúc cũ: {rentalDate(r.oldEndDate)} · Ngày kết thúc đề nghị:{" "}
        {rentalDate(r.newEndDate)}
      </p>
      <p>Tiền gia hạn: {rentalMoney(r.amount, r.currency)}</p>
      <p>
        Thời điểm gửi: {rentalDate(r.createdAt)}
        {!manager && <> · Phiên bản: {r.version ?? unknown}</>}
      </p>
      <p>
        Người duyệt: {r.reviewerId || "Chưa duyệt"} · Thời điểm duyệt:{" "}
        {rentalDate(r.reviewedAt)}
      </p>
      {r.reviewReason && <p>Lý do quyết định: {r.reviewReason}</p>}
      {r.cancellationReason && <p>Lý do hủy: {r.cancellationReason}</p>}
      <p>
        {manager ? 'Kiểm tra thanh toán: ' : 'Nguồn kiểm tra tài chính: '}{copy(r.financialCheck.completeness)} ·{" "}
        {rentalDate(r.financialCheck.checkedAt)}
      </p>
      <p>
        {manager ? 'Khoản thanh toán cần xử lý: ' : 'Khoản nghĩa vụ đang chặn: '}{" "}
        {r.financialCheck.blockingObligationRefs?.join(", ") ||
          (r.financialCheck.blockingObligationRefs === null
            ? unknown
            : copy("Không có khoản chặn theo kiểm tra của BE"))}
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
        <p>Hạn thanh toán đã khóa: {rentalDate(r.approvedPaymentDeadline)}</p>
      )}
      {terms ? (
        <section className="rounded border border-stone-200 p-3 space-y-2">
          <h4 className="font-semibold">{copy("Điều khoản đã được Customer chấp nhận")}</h4>
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
          {!manager && <p className="text-sm text-stone-500 break-all">Policy áp dụng: {terms.renewalPolicyRef} · phiên bản {terms.renewalPolicyVersion}. Gói: {terms.packagePolicyRef} · phiên bản {terms.packagePolicyVersion}.</p>}
          <p className="text-sm text-stone-500">{copy("Giá theo điều khoản đã lưu; không phải xác nhận đã thanh toán.")}</p>
        </section>
      ) : (
        <p className="text-sm text-stone-500">{copy("Chưa có snapshot điều khoản đã chấp nhận; không tính lại giá/cọc từ catalog hiện tại.")}</p>
      )}
      {r.status === "approved" && (
        <p className="rounded bg-amber-50 p-3">
          {copy("Đã duyệt; chờ bước thanh toán và hoàn tất D3. Duyệt không tự thay đổi ngày kết thúc hồ sơ thuê. Xem tiến độ ký/thanh toán D3 ở bên dưới; các thao tác chỉ khả dụng khi BE đã kết nối đủ nguồn dùng chung.")}</p>
      )}
      {r.version === null && (
        <p className="text-amber-700">
          {copy("Hồ sơ cũ thiếu workflow/version xác thực; không thể thao tác.")}</p>
      )}
      {r.disabledReasons.map((reason, i) => (
        <p key={i} className="text-amber-700">
          {explain(reason)}
        </p>
      ))}
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
