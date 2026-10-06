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
  const actor = getAuthenticatedActor()
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
        Trạng thái: {renewalLabels[r.status] || r.status} · Review:{" "}
        {r.reviewState}
      </p>
      <p>
        Ngày kết thúc cũ: {rentalDate(r.oldEndDate)} · Ngày kết thúc đề nghị:{" "}
        {rentalDate(r.newEndDate)}
      </p>
      <p>Tiền gia hạn: {rentalMoney(r.amount, r.currency)}</p>
      <p>
        Thời điểm gửi: {rentalDate(r.createdAt)} · Phiên bản:{" "}
        {r.version ?? unknown}
      </p>
      <p>
        Người duyệt: {r.reviewerId || "Chưa duyệt"} · Thời điểm duyệt:{" "}
        {rentalDate(r.reviewedAt)}
      </p>
      {r.reviewReason && <p>Lý do quyết định: {r.reviewReason}</p>}
      <p>
        Nguồn kiểm tra tài chính: {r.financialCheck.completeness} ·{" "}
        {rentalDate(r.financialCheck.checkedAt)}
      </p>
      <p>
        Khoản nghĩa vụ đang chặn:{" "}
        {r.financialCheck.blockingObligationRefs?.join(", ") ||
          (r.financialCheck.blockingObligationRefs === null
            ? unknown
            : "Không có khoản chặn theo kiểm tra của BE")}
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
      <p className="text-sm text-stone-500">
        Chi tiết phân rã giá/cọc của điều khoản đã chấp nhận chưa được API hồ sơ
        gia hạn cung cấp.
      </p>
      {r.status === "approved" && (
        <p className="rounded bg-amber-50 p-3">
          Đã duyệt; chờ bước thanh toán và hoàn tất D3. Duyệt không tự thay đổi
          ngày kết thúc hồ sơ thuê. Chưa có tích hợp thanh toán D3 trên màn hình
          này.
        </p>
      )}
      {r.version === null && (
        <p className="text-amber-700">
          Hồ sơ cũ thiếu workflow/version xác thực; không thể thao tác.
        </p>
      )}
      {r.disabledReasons.map((reason, i) => (
        <p key={i} className="text-amber-700">
          {reason}
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
