import { useState } from "react"
import { Button, Modal } from "../../components/ui"
import { cancelRenewal, decideRenewal } from "../../services/renewalApi"
import { getAuthenticatedActor } from "../../services/authApi"
import { useRenewalCommand } from "../../hooks/useRenewalCommand"
import type { RenewalApiRecord } from "../../types/renewalApi"
import {
  hasRenewalAction,
  rentalDate,
  rentalError,
  rentalMoney,
} from "./presentation"
export default function RenewalDecisionModal({
  renewal: r,
  action,
  onClose,
  onSuccess,
  onRefresh,
}: {
  renewal: RenewalApiRecord
  action: "APPROVE" | "REJECT" | "CANCEL"
  onClose: () => void
  onSuccess: () => void
  onRefresh: () => void
}) {
  const [reason, setReason] = useState("")
  const command = useRenewalCommand()
  const role = action === "CANCEL" ? "customer" : "manager"
  const allowed = hasRenewalAction(r, action, getAuthenticatedActor(), role)
  const locked = command.busy || command.uncertain
  return (
    <Modal
      open
      title={
        action === "APPROVE"
          ? "Duyệt yêu cầu gia hạn"
          : action === "REJECT"
            ? "Từ chối gia hạn"
            : "Hủy yêu cầu gia hạn"
      }
      onClose={() => {
        if (!locked) onClose()
      }}
    >
      <div className="space-y-4">
        <p className="break-all">
          {r.id} · {r.storageUnit.code}
        </p>
        <p>Ngày kết thúc đề nghị: {rentalDate(r.newEndDate)}</p>
        <p>Tiền gia hạn: {rentalMoney(r.amount, r.currency)}</p>
        {action === "APPROVE" && (
          <p>
            Duyệt không tự gia hạn hồ sơ thuê. BE sẽ kiểm tra lại policy,
            nợ/khiếu nại, trả kho và giữ chỗ.
          </p>
        )}
        <label className="block">
          Lý do {action !== "APPROVE" ? "(bắt buộc)" : "(nếu có)"}
          <textarea
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            value={reason}
            maxLength={2000}
            disabled={locked}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {command.error ? (
          <p role="alert">{rentalError(command.error)}</p>
        ) : null}
        {command.uncertain && (
          <p>
            Kết quả chưa xác định. Giữ nguyên nội dung và thử lại cùng key;
            không đóng hộp thoại hoặc gửi quyết định khác.
          </p>
        )}
        <Button
          disabled={
            command.busy ||
            command.conflict ||
            !allowed ||
            (action !== "APPROVE" && !reason.trim())
          }
          onClick={() => {
            void command.run(
              JSON.stringify({ id: r.id, action, reason, version: r.version }),
              (key) =>
                action === "CANCEL"
                  ? cancelRenewal(r.id, reason, r.version!, key)
                  : decideRenewal(r.id, action, reason, r.version!, key),
              onSuccess,
            )
          }}
        >
          {command.busy
            ? "Đang gửi…"
            : command.uncertain
              ? "Thử lại cùng quyết định"
              : "Xác nhận"}
        </Button>
        {command.error && !command.uncertain ? (
          <Button
            variant="outline"
            onClick={() => {
              onClose()
              onRefresh()
            }}
          >
            Đóng và tải lại hồ sơ
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
