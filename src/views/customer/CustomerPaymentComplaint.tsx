import { formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { apiDownload, ApiClientError } from '../../services/apiClient'
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
  const [detailOpen, setDetailOpen] = useState(false)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loadingImages, setLoadingImages] = useState(false)
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
          onMessage(userFacingError(error, 'Không thể tải khiếu nại.'))
        }
      })
    return () => { disposed = true }
  }, [reservation.id, reservation.status, onMessage])

  useEffect(() => {
    if (!detailOpen || !complaint?.images?.length) {
      setImageUrls({})
      return
    }
    let disposed = false
    const createdUrls: string[] = []
    setLoadingImages(true)
    Promise.all(
      complaint.images.map(async img => {
        try {
          const result = await apiDownload(`/api/files/${img.id}`)
          const url = URL.createObjectURL(result.blob)
          createdUrls.push(url)
          return { id: img.id, url }
        } catch {
          return { id: img.id, url: null }
        }
      }),
    )
      .then(results => {
        if (disposed) {
          createdUrls.forEach(url => URL.revokeObjectURL(url))
          return
        }
        const map: Record<string, string> = {}
        results.forEach(r => { if (r.url) map[r.id] = r.url })
        setImageUrls(map)
      })
      .finally(() => {
        if (!disposed) setLoadingImages(false)
      })
    return () => {
      disposed = true
      createdUrls.forEach(url => URL.revokeObjectURL(url))
      setImageUrls({})
    }
  }, [detailOpen, complaint?.id, complaint?.images?.length])

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
    if (busy || countdown.expired || !reason.trim()) return
    setBusy(true)
    setErrorMessage(null)
    try {
      const uploaded = files.length > 0 ? await Promise.all(files.map(uploadComplaintImage)) : []
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
        : userFacingError(error, 'Không thể gửi khiếu nại.'))
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
      onMessage(userFacingError(error, 'Không thể rút khiếu nại.'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    {reservation.status === 'PAYMENT_GRACE' && !complaint && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900">
      <p className="font-bold">Chưa ghi nhận thanh toán</p>
      <p className="mt-2 font-bold">Thời gian gửi khiếu nại còn lại</p>
      <p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p>
      <Button className="mt-2" size="sm" disabled={countdown.expired} onClick={() => setOpen(true)}>{countdown.expired ? 'Đã hết thời hạn khiếu nại' : 'Gửi khiếu nại thanh toán'}</Button>
    </div>}
    {complaint && <div className={`rounded-lg border p-3 text-xs ${complaint.status === 'REJECTED' ? 'border-red-300 bg-red-50 text-red-950' : 'border-blue-200 bg-blue-50 text-blue-950'}`}>
      <p className="font-bold">Khiếu nại: {complaintStatusLabels[complaint.status]}</p>
      <p className="mt-1">{complaint.reason}</p>
      {['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && <p className="mt-1">Dự kiến xử lý trước: <b>{formatCustomerDateTime(new Date(complaint.reviewDueAt))}</b></p>}
      {['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && <p className="mt-1">Suất kho tiếp tục được giữ trong khi quản lý đối soát. Quá hạn xử lý sẽ được đánh dấu để theo dõi, không tự động hủy đơn hoặc kết luận mất tiền.</p>}
      {complaint.decisionReason && <p className="mt-1.5"><b>{complaint.status === 'REJECTED' ? 'Lý do từ chối:' : 'Phản hồi:'}</b> {complaint.decisionReason}</p>}
      {complaint.status === 'REJECTED' && complaint.gatewayQueryMessage && (
        <div className="mt-2 rounded border border-red-200 bg-white/80 p-2 text-[11px] text-stone-800">
          <p className="font-bold text-red-900">Bằng chứng đối soát VNPAY</p>
          <p className="mt-0.5">{complaint.gatewayQueryMessage}</p>
          <p className="mt-1 text-stone-600">
            Mã phản hồi: <b>{complaint.gatewayQueryResponseCode || '—'}</b> · Trạng thái GD: <b>{complaint.gatewayQueryTransactionStatus || '—'}</b>
            {complaint.gatewayQueryTransactionNo ? <> · Mã GD VNPAY: <b>{complaint.gatewayQueryTransactionNo}</b></> : null}
          </p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setDetailOpen(true)}>Xem chi tiết khiếu nại</Button>
        {['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && <Button variant="outline" size="sm" disabled={busy} onClick={() => setWithdrawConfirmOpen(true)}>Rút khiếu nại</Button>}
      </div>
    </div>}
    <Modal open={open} onClose={() => { if (!busy) { setOpen(false); setErrorMessage(null) } }} title="Khiếu nại thanh toán">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">Chỉ gửi khi tài khoản của bạn đã bị trừ tiền nhưng đơn chưa ghi nhận thanh toán.</p>
        <label className="block text-sm font-bold text-stone-800">Lý do và thông tin giao dịch<textarea className="mt-2 min-h-28 w-full rounded-lg border border-stone-300 p-3 font-normal" maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Mô tả thời gian, số tiền và mã giao dịch…" /></label>
        <label className="block text-sm font-bold text-stone-800">Ảnh chứng minh giao dịch (không bắt buộc)<input className="mt-2 block w-full rounded-lg border border-stone-300 p-3 font-normal" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files || []).slice(0, 10))} /></label>
        <p className="text-xs text-stone-500">Tối đa 10 ảnh PNG, JPEG hoặc WebP. Đã chọn: {files.length} ảnh.</p>
        {errorMessage && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">{errorMessage}</p>}
        <div className="rounded-lg bg-red-50 p-3 text-center text-red-800"><p className="text-xs font-bold">Thời gian gửi khiếu nại còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p></div>
        <Button className="w-full" disabled={busy || countdown.expired || !reason.trim()} onClick={() => send()}>{busy ? 'Đang gửi…' : countdown.expired ? 'Đã hết thời hạn khiếu nại' : 'Gửi khiếu nại'}</Button>
      </div>
    </Modal>
    <Modal open={detailOpen && Boolean(complaint)} onClose={() => setDetailOpen(false)} title="Chi tiết khiếu nại đã gửi">
      {complaint && (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg bg-stone-50 p-3 space-y-1 text-xs">
            <p>Đơn giữ kho: <b>{complaint.reservationCode}</b></p>
            <p>Trạng thái: <b>{complaintStatusLabels[complaint.status]}</b></p>
            <p>Gửi lúc: <b>{formatCustomerDateTime(new Date(complaint.submittedAt))}</b></p>
            {['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && (
              <p>Dự kiến xử lý trước: <b>{formatCustomerDateTime(new Date(complaint.reviewDueAt))}</b></p>
            )}
            {complaint.gatewayIntentId && (
              <p>Mã tham chiếu VNPAY: <code className="font-mono">{complaint.gatewayIntentId}</code></p>
            )}
          </div>
          <div>
            <p className="font-bold text-stone-800">Lý do và thông tin giao dịch đã gửi</p>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-stone-200 bg-white p-3 text-stone-800">{complaint.reason}</p>
          </div>
          <div>
            <p className="font-bold text-stone-800">Ảnh chứng minh đã gửi ({complaint.images?.length || 0})</p>
            {loadingImages ? (
              <p className="mt-2 text-xs text-stone-500">Đang tải ảnh chứng minh…</p>
            ) : !complaint.images?.length ? (
              <p className="mt-2 text-xs text-stone-500">Không có ảnh đính kèm.</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {complaint.images.map(img => {
                  const url = imageUrls[img.id]
                  return (
                    <a
                      key={img.id}
                      href={url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-stone-200 bg-stone-50 p-1.5 hover:border-amber-400"
                    >
                      {url ? (
                        <img src={url} alt={img.originalName} className="h-28 w-full rounded object-cover" />
                      ) : (
                        <div className="flex h-28 items-center justify-center text-xs text-stone-400">Không tải được ảnh</div>
                      )}
                      <p className="mt-1 truncate text-[11px] text-stone-600" title={img.originalName}>{img.originalName}</p>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
          {complaint.gatewayQueryMessage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
              <p className="font-bold">Bằng chứng đối soát từ VNPAY</p>
              <p>{complaint.gatewayQueryMessage}</p>
              <p className="text-stone-700">
                Mã phản hồi: <b>{complaint.gatewayQueryResponseCode || '—'}</b> · Trạng thái GD: <b>{complaint.gatewayQueryTransactionStatus || '—'}</b>
                {complaint.gatewayQueryTransactionNo ? <> · Mã GD VNPAY: <b>{complaint.gatewayQueryTransactionNo}</b></> : null}
                {complaint.gatewayQueryPayDate ? <> · Ngày thanh toán: <b>{complaint.gatewayQueryPayDate}</b></> : null}
              </p>
              {complaint.gatewayQueryCheckedAt && (
                <p className="text-stone-500">Kiểm tra lúc: {formatCustomerDateTime(new Date(complaint.gatewayQueryCheckedAt))}</p>
              )}
            </div>
          )}
          {complaint.decisionReason && (
            <div className={`rounded-lg border p-3 text-xs ${complaint.status === 'REJECTED' ? 'border-red-200 bg-red-50 text-red-950' : 'border-stone-200 bg-stone-50 text-stone-800'}`}>
              <p className="font-bold">{complaint.status === 'REJECTED' ? 'Lý do từ chối từ cơ sở' : 'Phản hồi từ cơ sở'}</p>
              <p className="mt-1">{complaint.decisionReason}</p>
              {complaint.reviewedAt && (
                <p className="mt-1 text-stone-500">Xử lý lúc: {formatCustomerDateTime(new Date(complaint.reviewedAt))}</p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Đóng</Button>
          </div>
        </div>
      )}
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
