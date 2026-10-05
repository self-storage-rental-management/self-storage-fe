import { useEffect, useRef, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { getCustomerReservation, getReservationPayment, payReservationDeposit, type CustomerReservation, type CustomerReservationDetail, type ReservationPaymentResult } from '../../services/customerReservationApi'
import { paymentCountdown, reservationProgress, reservationStatusLabels } from './reservationPresentation'
import ReservationReceipt from './ReservationReceipt'
import { ApiClientError } from '../../services/apiClient'

interface Props {
  reservation: CustomerReservation
  facilityName: string
  unitTypeName: string
  onVerify: () => void
  onCancel: () => void
  onRefresh: () => Promise<void>
}

export default function CustomerReservationCard({ reservation: r, facilityName, unitTypeName, onVerify, onCancel, onRefresh }: Props) {
  const [detail, setDetail] = useState<CustomerReservationDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState<ReservationPaymentResult | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const paymentKey = useRef<string | null>(null)
  useEffect(() => {
    let disposed = false
    void getCustomerReservation(r.id).then(value => { if (!disposed) setDetail(value) })
      .catch(error => { if (!disposed) setMessage(error instanceof Error ? error.message : 'Không thể tải chi tiết đơn.') })
    return () => { disposed = true }
  }, [r.id, r.status])
  useEffect(() => {
    if (['AWAITING_EMAIL', 'AWAITING_REVIEW'].includes(r.status)) return
    let disposed = false
    void getReservationPayment(r.id).then(value => { if (!disposed) setPayment(value) })
      .catch(error => { if (!disposed && !(error instanceof ApiClientError && error.status === 404)) setMessage(error instanceof Error ? error.message : 'Không thể tải biên lai.') })
    return () => { disposed = true }
  }, [r.id, r.status])
  const countdown = paymentCountdown(detail?.paymentExpiresAt || r.holdExpiresAt, now)
  const progress = reservationProgress(r.status)
  const inactive = progress === null
  const steps = [
    { label: 'Xác minh email', detail: 'Xác nhận địa chỉ liên hệ' },
    { label: 'Phê duyệt hồ sơ', detail: r.goodsReviewStatus === 'PENDING' ? 'Nhân viên kiểm tra hàng hóa' : 'Hồ sơ được duyệt tự động' },
    { label: 'Thanh toán cọc', detail: 'Hoàn tất cọc giữ chỗ' },
    { label: 'quản lý phân kho', detail: 'Chờ phân gian kho cụ thể' },
    { label: 'Nhận kho và ký', detail: 'Đối chiếu và ký tại cơ sở' },
    { label: 'Đã bàn giao', detail: 'Nhận kho và mã ra vào' },
  ]
  const pay = async () => {
    if (busy || countdown.expired || r.status !== 'AWAITING_PAYMENT') return
    setBusy(true)
    setMessage(null)
    try {
      paymentKey.current ??= crypto.randomUUID()
      const result = await payReservationDeposit(r.id, paymentKey.current)
      setPayment(result)
      // Preserve the key on transport errors; a definitive failure permits a new attempt.
      if (result.outcome === 'FAILED') paymentKey.current = null
      setMessage(result.outcome === 'SUCCESS' ? 'Thanh toán cọc thành công. Đơn đã được xác nhận.'
        : result.outcome === 'NOT_RECEIVED' ? 'Hệ thống chưa ghi nhận tiền. Không chuyển lại nếu đã bị trừ tiền; cần đối soát.'
        : 'Thanh toán thất bại. Bạn có thể thử lại trong thời hạn của đơn.')
      setPayOpen(false)
      if (result.paymentStatus === 'PAID') setReceiptOpen(true)
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể thanh toán cọc.')
    } finally { setBusy(false) }
  }
  return <Card className={`p-6 border-l-4 ${inactive ? 'border-l-stone-300 text-stone-500' : 'border-l-amber-500'}`}>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-amber-700">{r.reservationCode}</span>
          <span className={`rounded px-2.5 py-1 text-xs font-bold ${progress !== null && progress >= 3 ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{reservationStatusLabels[r.status]}</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-stone-900">{unitTypeName} · {facilityName}</h2>
        <p className="text-xs text-stone-500">Lịch thuê: <b>{r.startDate} → {r.endDate}</b></p>
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 space-y-1.5">
          <p><b>Hàng hóa khai báo:</b> {detail?.goodsItems.map(item => `${item.description || item.customGoodsName || item.category} (${item.quantity} kiện)`).join(' · ') || 'Đang tải chi tiết…'}</p>
          <p><b>Thể tích / trọng lượng:</b> {r.totalGoodsVolumeM3} m³ · {r.totalGoodsWeightKg} kg</p>
          <div className="mt-2 grid gap-2 border-t border-stone-200/80 pt-3 text-[11px] sm:grid-cols-2">
            <div className="rounded-lg bg-white/70 p-3 leading-5"><p className="font-bold text-stone-900">Tiền thuê và cọc giữ chỗ</p><p>Tiền thuê cả kỳ: {formatVnd(r.totalRentalAmount)}</p><p>Cọc giữ chỗ: {formatVnd(r.reservationDepositAmount)}</p><p>Tiền thuê còn lại: {formatVnd(r.remainingRentalAmount)}</p></div>
            <div className="rounded-lg bg-amber-50 p-3 leading-5"><p className="font-bold text-stone-900">Khoản thu khi nhận kho</p><p>Tiền đảm bảo kho: {formatVnd(r.securityDepositAmount)}</p><p className="border-t border-amber-200 pt-1 font-bold">Tổng thu khi nhận kho: {formatVnd(r.dueAtCheckIn)}</p></div>
          </div>
        </div>
        {progress !== null && <div className="mt-4 border-t border-stone-200 pt-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-black">Tiến trình đơn đặt kho</p><p className="mt-0.5 text-[11px] text-stone-500">Đã hoàn thành {progress}/{steps.length} bước</p></div>{steps[progress] && <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-300">Đang thực hiện: {steps[progress].label}</span>}</div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{steps.map((step, index) => {
            const completed = index < progress
            const current = index === progress
            return <div key={step.label} aria-current={current ? 'step' : undefined} className={`relative rounded-xl border p-3 transition ${completed ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : current ? 'border-amber-500 bg-amber-500 text-white shadow-lg ring-2 ring-amber-200' : 'border-stone-200 bg-stone-50 text-stone-400'}`}>
              <div className="mb-2 flex items-center justify-between gap-1"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${completed ? 'bg-emerald-600 text-white' : current ? 'bg-white text-amber-700' : 'bg-stone-200 text-stone-500'}`}>{completed ? '✓' : index + 1}</span><span className="text-[9px] font-bold">{completed ? 'Đã xong' : current ? 'Hiện tại' : 'Sắp tới'}</span></div><p className="text-[11px] font-bold leading-4">{step.label}</p><p className="mt-1 text-[10px] leading-4">{step.detail}</p>
            </div>
          })}</div>
        </div>}
      </div>
      <div className="flex min-w-0 flex-col items-stretch gap-3 lg:items-end">
        <div className="text-right"><p className="text-xs text-stone-500">Tổng thu cả kỳ (gồm tiền đảm bảo kho)</p><p className="text-xl font-bold text-stone-900">{formatVnd(r.totalInitialObligation)}</p><p className="text-xs text-amber-800">Trả lúc giữ chỗ: {formatVnd(r.reservationDepositAmount)}</p></div>
        {r.status === 'AWAITING_EMAIL' && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-xs text-amber-950"><p className="font-bold">Cần xác minh email</p><p className="mt-1">Thời gian giữ đơn còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p><Button className="mt-2" size="sm" disabled={countdown.expired} onClick={onVerify}>Xác minh email</Button></div>}
        {r.status === 'AWAITING_REVIEW' && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950"><p className="font-bold">Đang chờ nhân viên cơ sở duyệt hàng hóa</p><p className="mt-1">Thời gian giữ hồ sơ còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p><p className="mt-1">Tối đa 24 giờ từ khi xác minh email.</p></div>}
        {r.status === 'AWAITING_PAYMENT' && <div className="rounded-lg bg-red-700 p-3 text-right text-xs text-white"><p className="font-bold">Thời gian thanh toán cọc còn lại</p><p role="timer" className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p><p className="mt-1">{countdown.expired ? 'Đã hết thời hạn. Đang chờ cập nhật trạng thái đơn.' : 'Vui lòng hoàn tất thanh toán trước khi hết thời hạn.'}</p><Button className="mt-2" size="sm" disabled={busy || countdown.expired} onClick={() => setPayOpen(true)}>Thanh toán cọc</Button></div>}
        {payment?.paymentStatus === 'PAID' && <Button variant="outline" size="sm" onClick={() => setReceiptOpen(true)}>Xem biên lai thanh toán</Button>}
        {['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) && <p className="text-xs text-amber-900">{reservationStatusLabels[r.status]} — chưa được xác nhận thanh toán.</p>}
        {!inactive && r.status !== 'COMPLETED' && <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 text-xs" onClick={onCancel}>✕ Hủy giữ kho</Button>}
      </div>
    </div>
    {message && <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <Modal open={payOpen} onClose={() => { if (!busy) setPayOpen(false) }} title="Thanh toán cọc giữ chỗ">
      <div className="space-y-4"><p>Đơn giữ kho: <b>{r.reservationCode}</b></p><p>Cơ sở: <b>{facilityName}</b></p><p>Loại kho: <b>{unitTypeName}</b></p><p>Kỳ thuê: <b>{r.startDate} → {r.endDate}</b></p><div className="rounded-lg bg-stone-50 p-3 text-sm"><p>Cọc giữ chỗ: <b>{formatVnd(r.reservationDepositAmount)}</b></p><p>Tiền thuê còn lại: {formatVnd(r.remainingRentalAmount)}</p><p>Tiền đảm bảo kho: {formatVnd(r.securityDepositAmount)}</p><p>Tổng thu khi nhận kho: <b>{formatVnd(r.dueAtCheckIn)}</b></p></div><p className="text-sm text-red-700">Thời gian còn lại: <b className="tabular-nums">{countdown.text}</b></p><p className="text-sm text-stone-500">Sau khi thanh toán được ghi nhận, đơn giữ kho và biên lai sẽ được cập nhật.</p><Button disabled={busy || countdown.expired} onClick={() => void pay()}>{busy ? 'Đang xử lý…' : 'Xác nhận thanh toán'}</Button></div>
    </Modal>
    <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Biên lai thanh toán">
      {payment && <ReservationReceipt payment={payment} reservationCode={r.reservationCode} />}
    </Modal>
  </Card>
}
