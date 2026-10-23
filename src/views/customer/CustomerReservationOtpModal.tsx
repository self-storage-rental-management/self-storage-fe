import { Button, Input, Modal } from '../../components/ui'
import type { CustomerReservation } from '../../services/customerReservationApi'

export default function CustomerReservationOtpModal({
  reservation,
  code,
  developmentCode,
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
  developmentCode?: string | null
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
        Nhập mã OTP 6 chữ số đã gửi tới <b className="text-stone-900">{reservation?.customerEmail || 'email tài khoản của bạn'}</b> cho đơn <b>{reservation?.reservationCode}</b>.
      </p>
      <Input
        label="Mã OTP"
        value={code}
        maxLength={6}
        inputMode="numeric"
        onChange={event => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
      />
      {developmentCode && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div>
            <span>Mã OTP thử nghiệm (Dev): </span>
            <strong className="font-mono text-sm font-bold tracking-widest">{developmentCode}</strong>
          </div>
          <button
            type="button"
            className="rounded bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-300 transition-colors"
            onClick={() => onCodeChange(developmentCode)}
          >
            Điền mã
          </button>
        </div>
      )}
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
