import { useEffect, useRef, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { getCustomerReservation, getPaymentComplaint, getReservationPayment, payReservationDeposit, submitPaymentComplaint, uploadComplaintImage, withdrawPaymentComplaint, type CustomerReservation, type CustomerReservationDetail, type PaymentComplaint, type ReservationPaymentResult } from '../../services/customerReservationApi'
import { paymentCountdown, reservationProgress, reservationStatusLabels } from './reservationPresentation'
import ReservationReceipt from './ReservationReceipt'
import { ApiClientError } from '../../services/apiClient'

const GOODS_CATEGORY_LABELS: Record<string, string> = {
  FURNITURE: 'Nội thất', KITCHENWARE: 'Đồ dùng nhà bếp', DECOR: 'Đồ trang trí',
  ELECTRONICS: 'Thiết bị điện tử', OFFICE: 'Đồ dùng văn phòng', TOYS: 'Đồ chơi',
  SPORTS: 'Dụng cụ thể thao', GIFTS: 'Quà tặng', MUSICAL_INSTRUMENTS: 'Nhạc cụ',
  CAMERA_EQUIPMENT: 'Thiết bị máy ảnh', EVENT_EQUIPMENT: 'Thiết bị sự kiện',
  STORE_FIXTURES: 'Thiết bị cửa hàng', FINE_ART: 'Mỹ thuật',
  CERAMIC_GLASS: 'Gốm, sứ và thủy tinh', MOVING_ITEMS: 'Đồ chuyển nhà', OTHER: 'Khác',
}

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
  const [goodsDetailOpen, setGoodsDetailOpen] = useState(false)
  const [complaint, setComplaint] = useState<PaymentComplaint | null>(null)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaintReason, setComplaintReason] = useState('')
  const [complaintFiles, setComplaintFiles] = useState<File[]>([])
  const [complaintError, setComplaintError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const paymentKey = useRef<string | null>(null)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])
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
  useEffect(() => {
    if (!['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status)) { setComplaint(null); return }
    let disposed = false
    void getPaymentComplaint(r.id).then(value => { if (!disposed) setComplaint(value) })
      .catch(error => { if (!disposed && !(error instanceof ApiClientError && error.status === 404)) setMessage(error instanceof Error ? error.message : 'Không thể tải khiếu nại.') })
    return () => { disposed = true }
  }, [r.id, r.status])
  const countdown = paymentCountdown(detail?.paymentExpiresAt || r.holdExpiresAt, now)
  const complaintCountdown = paymentCountdown(detail?.complaintExpiresAt, now)
  useEffect(() => {
    const deadlineExpired = r.status === 'AWAITING_PAYMENT' ? countdown.expired
      : r.status === 'PAYMENT_GRACE' ? complaintCountdown.expired : false
    if (!deadlineExpired) return
    let disposed = false
    const refreshStatus = async () => { if (!disposed) await onRefreshRef.current() }
    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 5000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [r.status, countdown.expired, complaintCountdown.expired])
  const progress = reservationProgress(r.status)
  const inactive = progress === null
  const steps = [
    { label: 'Xác minh email', detail: 'Xác nhận địa chỉ liên hệ' },
    { label: 'Phê duyệt hồ sơ', detail: r.goodsReviewStatus === 'PENDING' ? 'Nhân viên kiểm tra hàng hóa' : 'Hồ sơ được duyệt tự động' },
    { label: ['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) ? 'Đối soát thanh toán' : 'Thanh toán cọc', detail: r.status === 'PAYMENT_GRACE' ? 'Chờ khách hàng gửi chứng từ' : r.status === 'PAYMENT_REVIEW' ? 'Đang kiểm tra chứng từ thanh toán' : 'Hoàn tất cọc giữ chỗ' },
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
  const sendComplaint = async () => {
    if (busy || complaintCountdown.expired || !complaintReason.trim() || complaintFiles.length === 0) return
    setBusy(true); setMessage(null); setComplaintError(null)
    try {
      const uploaded = await Promise.all(complaintFiles.map(uploadComplaintImage))
      const result = await submitPaymentComplaint(r.id, complaintReason.trim(), uploaded.map(file => file.id))
      setComplaint(result); setComplaintOpen(false); setComplaintReason(''); setComplaintFiles([])
      setMessage('Khiếu nại thanh toán đã được gửi và đang chờ xử lý.')
      await onRefresh()
    } catch (error) {
      const errorMessage = error instanceof ApiClientError && error.status === 413
        ? 'Ảnh tải lên vượt quá dung lượng cho phép. Mỗi ảnh tối đa 10 MB.'
        : error instanceof Error ? error.message : 'Không thể gửi khiếu nại.'
      setComplaintError(errorMessage)
    }
    finally { setBusy(false) }
  }
  const withdrawComplaint = async () => {
    if (!complaint || busy) return
    setBusy(true); setMessage(null)
    try {
      const result = await withdrawPaymentComplaint(complaint.id)
      setComplaint(result); setMessage('Đã rút khiếu nại thanh toán.'); await onRefresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể rút khiếu nại.') }
    finally { setBusy(false) }
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
          <Button type="button" variant="outline" size="sm" className="mt-2" disabled={!detail} onClick={() => setGoodsDetailOpen(open => !open)}>{goodsDetailOpen ? 'Ẩn thông tin đã khai báo' : 'Xem thông tin đã khai báo'}</Button>
          {goodsDetailOpen && detail && <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
            <div><p className="font-bold text-stone-900">Tình trạng đóng gói chung</p><p className="mt-1">{detail.goodsCondition || 'Không có mô tả'}</p></div>
            {detail.goodsItems.map((item, index) => <div key={item.id} className="rounded-lg border border-stone-200 bg-white p-3 leading-5">
              <p className="font-bold text-stone-900">Hàng hóa {index + 1}: {item.customGoodsName || GOODS_CATEGORY_LABELS[item.category] || item.category}</p>
              <p><b>Mô tả:</b> {item.description || 'Không có'}</p>
              <p><b>Chất liệu:</b> {item.customMaterial || item.materialName || 'Không có'}</p>
              <p><b>Số lượng:</b> {item.quantity} kiện</p>
              <p><b>Kích thước mỗi kiện:</b> {item.lengthCm} × {item.widthCm} × {item.heightCm} cm</p>
              <p><b>Cân nặng:</b> {item.weightPerItemKg} kg/kiện · tổng {(item.quantity * item.weightPerItemKg).toLocaleString('vi-VN')} kg</p>
              <p><b>Hàng dễ bể / dễ vỡ:</b> {item.fragile ? 'Có' : 'Không'}</p>
              {item.customerNote && <p><b>Ghi chú:</b> {item.customerNote}</p>}
            </div>)}
          </div>}
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
        {r.status === 'PAYMENT_GRACE' && !complaint && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900"><p className="font-bold">Chưa ghi nhận thanh toán</p><p className="mt-1">Nếu tài khoản đã bị trừ tiền, hãy gửi thông tin và ảnh giao dịch để được kiểm tra.</p><p className="mt-2 font-bold">Thời gian gửi khiếu nại còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{complaintCountdown.text}</p><Button className="mt-2" size="sm" disabled={complaintCountdown.expired} onClick={() => setComplaintOpen(true)}>{complaintCountdown.expired ? 'Đã hết thời hạn khiếu nại' : 'Gửi khiếu nại thanh toán'}</Button></div>}
        {complaint && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950"><p className="font-bold">Khiếu nại: {{ PENDING: 'Đang chờ xử lý', REVIEW_OVERDUE: 'Quá hạn xử lý', APPROVED: 'Đã chấp thuận', REJECTED: 'Đã từ chối', WITHDRAWN: 'Đã rút' }[complaint.status]}</p><p className="mt-1">{complaint.reason}</p>{['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && <p className="mt-1">Dự kiến xử lý trước: <b>{new Date(complaint.reviewDueAt).toLocaleString('vi-VN')}</b></p>}{complaint.decisionReason && <p className="mt-1"><b>Phản hồi:</b> {complaint.decisionReason}</p>}{['PENDING', 'REVIEW_OVERDUE'].includes(complaint.status) && <Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => void withdrawComplaint()}>Rút khiếu nại</Button>}</div>}
        {!inactive && r.status !== 'COMPLETED' && <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 text-xs" onClick={onCancel}>✕ Hủy giữ kho</Button>}
      </div>
    </div>
    {message && <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <Modal open={payOpen} onClose={() => { if (!busy) setPayOpen(false) }} title="Thanh toán cọc giữ chỗ">
      <div className="space-y-4">
        <div className="grid gap-1 text-sm"><p>Đơn giữ kho: <b>{r.reservationCode}</b></p><p>Cơ sở: <b>{facilityName}</b></p><p>Loại kho: <b>{unitTypeName}</b></p><p>Kỳ thuê: <b>{r.startDate} → {r.endDate}</b></p></div>
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Số tiền cần thanh toán ngay</p>
          <p className="mt-1 text-3xl font-extrabold text-stone-950">{formatVnd(r.reservationDepositAmount)}</p>
          <p className="mt-1 text-xs text-stone-600">Cọc giữ chỗ được khấu trừ vào tiền thuê của kỳ này.</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3 text-sm space-y-1"><div className="flex justify-between gap-4"><span>Tiền thuê còn lại</span><b>{formatVnd(r.remainingRentalAmount)}</b></div><div className="flex justify-between gap-4"><span>Tiền đảm bảo kho</span><b>{formatVnd(r.securityDepositAmount)}</b></div><div className="flex justify-between gap-4 border-t border-stone-200 pt-2"><span>Tổng thanh toán khi nhận kho</span><b>{formatVnd(r.dueAtCheckIn)}</b></div><p className="pt-1 text-xs text-stone-500">Các khoản trên chưa thu trong bước này.</p></div>
        <div className="rounded-lg bg-red-700 p-3 text-center text-white"><p className="text-xs font-bold uppercase tracking-wide">Thời gian thanh toán còn lại</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p></div>
        <p className="text-sm text-stone-600">Sau khi thanh toán thành công, đơn giữ kho và biên lai sẽ được cập nhật tự động.</p>
        <Button className="w-full" disabled={busy || countdown.expired} onClick={() => void pay()}>{busy ? 'Đang xử lý…' : `Thanh toán ${formatVnd(r.reservationDepositAmount)}`}</Button>
      </div>
    </Modal>
    <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Biên lai thanh toán">
      {payment && <ReservationReceipt payment={payment} reservationCode={r.reservationCode} />}
    </Modal>
    <Modal open={complaintOpen} onClose={() => { if (!busy) { setComplaintOpen(false); setComplaintError(null) } }} title="Khiếu nại thanh toán">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">Chỉ gửi khi tài khoản của bạn đã bị trừ tiền nhưng đơn chưa ghi nhận thanh toán.</p>
        <label className="block text-sm font-bold text-stone-800">Lý do và thông tin giao dịch<textarea className="mt-2 min-h-28 w-full rounded-lg border border-stone-300 p-3 font-normal" maxLength={2000} value={complaintReason} onChange={event => setComplaintReason(event.target.value)} placeholder="Mô tả thời gian, số tiền và mã giao dịch…" /></label>
        <label className="block text-sm font-bold text-stone-800">Ảnh chứng minh giao dịch<input className="mt-2 block w-full rounded-lg border border-stone-300 p-3 font-normal" type="file" accept="image/*" multiple onChange={event => setComplaintFiles(Array.from(event.target.files || []).slice(0, 10))} /></label>
        <p className="text-xs text-stone-500">Tối đa 10 ảnh. Đã chọn: {complaintFiles.length} ảnh.</p>
        {complaintError && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">{complaintError}</p>}
        <div className="rounded-lg bg-red-50 p-3 text-center text-red-800"><p className="text-xs font-bold">Thời gian gửi khiếu nại còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{complaintCountdown.text}</p></div>
        <Button className="w-full" disabled={busy || complaintCountdown.expired || !complaintReason.trim() || complaintFiles.length === 0} onClick={() => void sendComplaint()}>{busy ? 'Đang gửi…' : complaintCountdown.expired ? 'Đã hết thời hạn khiếu nại' : 'Gửi khiếu nại'}</Button>
      </div>
    </Modal>
  </Card>
}
