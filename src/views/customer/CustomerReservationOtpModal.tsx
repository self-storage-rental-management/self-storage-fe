import { Button, Input, Modal } from '../../components/ui'
import type { CustomerReservation } from '../../services/customerReservationApi'

export default function CustomerReservationOtpModal({
  reservation,
  code,
  busy,
  message,
  nextResendAt,
  now,
  onCodeChange,
  onClose,
  onResend,
  onVerify,
}: {
  reservation: CustomerReservation | null
  code: string
  busy: boolean
  message: string | null
  nextResendAt: number
  now: number
  onCodeChange: (value: string) => void
  onClose: () => void
  onResend: () => void
  onVerify: () => void
}) {
  const resendSeconds = Math.max(0, Math.ceil((nextResendAt - now) / 1000))

  return <Modal open={Boolean(reservation)} onClose={onClose} title="Xác minh email cho đơn giữ kho">
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Nhập mã OTP 6 chữ số đã gửi tới email của bạn cho đơn <b>{reservation?.reservationCode}</b>.
      </p>
      <Input
        label="Mã OTP"
        value={code}
        maxLength={6}
        inputMode="numeric"
        onChange={event => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
      />
      {message && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 pt-4">
        <Button variant="outline" disabled={busy || resendSeconds > 0} onClick={onResend}>
          {resendSeconds > 0 ? `Gửi lại sau ${resendSeconds} giây` : 'Gửi lại OTP'}
        </Button>
        <Button disabled={busy || code.length !== 6} onClick={onVerify}>
          {busy ? 'Đang xử lý...' : 'Xác minh'}
        </Button>
      </div>
    </div>
  </Modal>
}
