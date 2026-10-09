import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { ApiClientError } from '../../services/apiClient'
import {
  getPaymentComplaint,
  submitPaymentComplaint,
  uploadComplaintImage,
  withdrawPaymentComplaint,
  type CustomerReservation,
  type PaymentComplaint,
} from '../../services/customerReservationApi'
import { paymentCountdown } from './reservationPresentation'

interface Props {
  reservation: CustomerReservation
  complaintExpiresAt?: string | null
  now: number
  onMessage: (message: string) => void
  onRefresh: () => Promise<void>
}

const complaintStatusLabels: Record<PaymentComplaint['status'], string> = {
  PENDING: 'Đang chờ xử lý',
  REVIEW_OVERDUE: 'Quá hạn xử lý',
  APPROVED: 'Đã chấp thuận',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút',
}

export default function CustomerPaymentComplaint({ reservation, complaintExpiresAt, now, onMessage, onRefresh }: Props) {
  const [complaint, setComplaint] = useState<PaymentComplaint | null>(null)
  const [open, setOpen] = useState(false)
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    let disposed = false
    void getPaymentComplaint(reservation.id)
      .then(value => { if (!disposed) setComplaint(value) })
      .catch(error => {
        if (!disposed && !(error instanceof ApiClientError && error.status === 404)) {
          onMessage(error instanceof Error ? error.message : 'Không thể tải khiếu nại.')
        }
      })
    return () => { disposed = true }
  }, [reservation.id, reservation.status, onMessage])

  const countdown = paymentCountdown(complaintExpiresAt, now)
  useEffect(() => {
    if (reservation.status !== 'PAYMENT_GRACE' || !countdown.expired) return
    let disposed = false
    const refreshStatus = async () => { if (!disposed) await onRefreshRef.current() }
    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 1000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [reservation.status, countdown.expired])

  const send = async () => {
    if (busy || countdown.expired || !reason.trim() || files.length === 0) return
    setBusy(true)
    setErrorMessage(null)
    try {
      const uploaded = await Promise.all(files.map(uploadComplaintImage))
      const result = await submitPaymentComplaint(reservation.id, reason.trim(), uploaded.map(file => file.id))
      setComplaint(result)
      setOpen(false)
      setReason('')
      setFiles([])
      onMessage('Khiếu nại thanh toán đã được gửi và đang chờ xử lý.')
      await onRefresh()
    } catch (error) {
      setErrorMessage(error instanceof ApiClientError && error.status === 413
        ? 'Ảnh tải lên vượt quá dung lượng cho phép. Mỗi ảnh tối đa 10 MB.'
        : error instanceof Error ? error.message : 'Không thể gửi khiếu nại.')
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    if (!complaint || busy) return
    setBusy(true)
    try {
      const result = await withdrawPaymentComplaint(complaint.id)
      setComplaint(result)
      setWithdrawConfirmOpen(false)
      onMessage('Đã rút khiếu nại. Đơn giữ kho đã bị hủy và chưa ghi nhận thanh toán.')
      await onRefresh()
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Không thể rút khiếu nại.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    {reservation.status === 'PAYMENT_GRACE' && !complaint && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900">
      <p className="font-bold">Chưa ghi nhận thanh toán</p>
      <p className="mt-1">Nếu tài khoản đã bị trừ tiền, hãy gửi thông tin và ảnh giao dịch để được kiểm tra.</p>
      <p className="mt-2 font-bold">Thời gian gửi khiếu nại còn lại</p>
      <p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p>
      <Button className="mt-2" size="sm" disabled={countdown.expired} onClick={() => setOpen(true)}>{countdown.expired ? 'Đã hết thời hạn khiếu nại' : 'Gửi khiếu nại thanh toán'}</Button>
    </div>}
    {complaint && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
      <p className="font-bold">Khiếu nại: {complaintStatusLabels[complaint.status]}</p>
      <p className="mt-1">{complaint.reason}</p>
      {['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && <p className="mt-1">Dự kiến xử lý trước: <b>{new Date(complaint.reviewDueAt).toLocaleString('vi-VN')}</b></p>}
      {complaint.decisionReason && <p className="mt-1"><b>Phản hồi:</b> {complaint.decisionReason}</p>}
      {['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && <Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => setWithdrawConfirmOpen(true)}>Rút khiếu nại</Button>}
    </div>}
    <Modal open={open} onClose={() => { if (!busy) { setOpen(false); setErrorMessage(null) } }} title="Khiếu nại thanh toán">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">Chỉ gửi khi tài khoản của bạn đã bị trừ tiền nhưng đơn chưa ghi nhận thanh toán.</p>
        <label className="block text-sm font-bold text-stone-800">Lý do và thông tin giao dịch<textarea className="mt-2 min-h-28 w-full rounded-lg border border-stone-300 p-3 font-normal" maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Mô tả thời gian, số tiền và mã giao dịch…" /></label>
        <label className="block text-sm font-bold text-stone-800">Ảnh chứng minh giao dịch<input className="mt-2 block w-full rounded-lg border border-stone-300 p-3 font-normal" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files || []).slice(0, 10))} /></label>
        <p className="text-xs text-stone-500">Tối đa 10 ảnh PNG, JPEG hoặc WebP. Đã chọn: {files.length} ảnh.</p>
        {errorMessage && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">{errorMessage}</p>}
        <div className="rounded-lg bg-red-50 p-3 text-center text-red-800"><p className="text-xs font-bold">Thời gian gửi khiếu nại còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p></div>
        <Button className="w-full" disabled={busy || countdown.expired || !reason.trim() || files.length === 0} onClick={() => void send()}>{busy ? 'Đang gửi…' : countdown.expired ? 'Đã hết thời hạn khiếu nại' : 'Gửi khiếu nại'}</Button>
      </div>
    </Modal>
    <PaymentComplaintWithdrawalConfirmation
      open={withdrawConfirmOpen}
      busy={busy}
      onCancel={() => setWithdrawConfirmOpen(false)}
      onConfirm={() => void withdraw()}
    />
  </>
}

export function PaymentComplaintWithdrawalConfirmation({ open, busy, onCancel, onConfirm }: {
  open: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return <Modal open={open} onClose={() => { if (!busy) onCancel() }} title="Xác nhận rút khiếu nại">
    <div className="space-y-4">
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900">
        <p className="font-bold">Rút khiếu nại sẽ hủy đơn giữ kho.</p>
        <p className="mt-1">Suất kho hiện tại sẽ được giải phóng và không được đảm bảo có thể khôi phục nếu bạn đổi ý hoặc đã chuyển tiền.</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onCancel}>Giữ khiếu nại</Button>
        <Button disabled={busy} onClick={onConfirm}>{busy ? 'Đang rút…' : 'Xác nhận rút'}</Button>
      </div>
    </div>
  </Modal>
}
