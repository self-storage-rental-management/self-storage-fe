import { renewalDisplayLabel } from '../../presentation/renewalIdentity'
import { useManagerPresentation } from "../manager/managerPresentation"
import { useState } from "react"
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getRenewalCancellationPolicy } from '../../services/returnRenewalEligibility'
import { Button, Modal } from "../../components/ui"
import { cancelRenewal } from "../../services/renewalApi"
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
  action: "CANCEL"
  onClose: () => void
  onSuccess: () => void
  onRefresh: () => void
}) {
  const { manager, copy, errorText } = useManagerPresentation()

  const [reason, setReason] = useState("")
  const [forfeitureAccepted, setForfeitureAccepted] = useState(false)
  const cancellation = useRentalApiResource(`cancel:${r.id}:${r.version}`, () => getRenewalCancellationPolicy(r.id))
  const depositPaid = cancellation.data?.state === 'DEPOSIT_PAID'
  const fullyPaid = cancellation.data?.state === 'FULLY_PAID'
  const requiresAcknowledgement = depositPaid || fullyPaid
  const policyAllows = cancellation.data?.state === 'UNPAID' || requiresAcknowledgement
  const command = useRenewalCommand()
  const allowed = hasRenewalAction(r, action, getAuthenticatedActor(), "customer")
  const locked = command.busy || command.uncertain
  return (
    <Modal
      open
      title={
        "Hủy yêu cầu gia hạn"
      }
      onClose={() => {
        if (!locked) onClose()
      }}
    >
      <div className="space-y-4">
        <p className="break-all">
          {renewalDisplayLabel(r)} · {r.storageUnit.code}
        </p>
        <p>Ngày kết thúc đề nghị: {rentalDate(r.newEndDate)}</p>
        <p>Tiền gia hạn: {rentalMoney(r.amount, r.currency)}</p>
        {cancellation.loading ? <p role="status">Đang kiểm tra khoản thanh toán gia hạn…</p>
          : cancellation.error ? <p role="alert">{rentalError(cancellation.error)}</p>
          : cancellation.data && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p>{fullyPaid ? 'Bạn đã thanh toán đủ tiền gia hạn. Khi tự hủy yêu cầu, toàn bộ tiền gia hạn đã thanh toán không được hoàn lại. Hợp đồng thuê hiện tại giữ nguyên thời hạn.'
              : depositPaid ? 'Bạn đã thanh toán cọc gia hạn. Khi tự hủy yêu cầu, tiền cọc gia hạn không được hoàn lại. Hợp đồng thuê hiện tại giữ nguyên thời hạn.'
              : policyAllows ? 'Hủy yêu cầu gia hạn chưa thanh toán để tiếp tục trả kho theo hợp đồng hiện tại.'
              : 'Khoản thanh toán gia hạn cần được cơ sở đối soát trước khi hủy. Vui lòng liên hệ cơ sở.'}</p>
            {requiresAcknowledgement && <>
              <p>{fullyPaid ? 'Tổng tiền gia hạn không hoàn lại' : 'Cọc gia hạn không hoàn lại'}: <strong>{rentalMoney(fullyPaid ? cancellation.data.paidAmount : cancellation.data.depositAmount, r.currency)}</strong></p>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 size-4" checked={forfeitureAccepted}
                disabled={locked} onChange={event => setForfeitureAccepted(event.target.checked)} />
                {fullyPaid ? 'Tôi xác nhận tự hủy gia hạn và đồng ý toàn bộ tiền gia hạn đã thanh toán không được hoàn lại.'
                  : 'Tôi xác nhận tự hủy gia hạn và đồng ý tiền cọc gia hạn không được hoàn lại.'}</label>
            </>}
          </div>}
        <label className="block">
          Lý do (bắt buộc)
          <textarea
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            value={reason}
            maxLength={2000}
            disabled={locked}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {command.error ? (
          <p role="alert">{errorText(command.error, rentalError)}</p>
        ) : null}
        {command.uncertain && (
          <p>
            Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại, không đóng hộp thoại hoặc gửi quyết định khác.</p>
        )}
        <Button
          disabled={
            command.busy ||
            command.conflict ||
            !allowed ||
            cancellation.loading || !!cancellation.error || !policyAllows || (requiresAcknowledgement && !forfeitureAccepted) ||
            !reason.trim()
          }
          onClick={() => {
            if (cancellation.loading || cancellation.error || !policyAllows || !allowed || (requiresAcknowledgement && !forfeitureAccepted) || !reason.trim()) return
            void command.run(
              JSON.stringify({ id: r.id, action, reason, version: r.version, acknowledgeDepositForfeiture: depositPaid && forfeitureAccepted, acknowledgePaymentForfeiture: fullyPaid && forfeitureAccepted }),
              (key) =>
                cancelRenewal(r.id, reason, r.version!, key, depositPaid && forfeitureAccepted, fullyPaid && forfeitureAccepted),
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
            {manager ? 'Đóng' : 'Đóng và tải lại hồ sơ'}
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
