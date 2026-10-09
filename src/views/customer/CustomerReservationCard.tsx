import { useEffect, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { confirmCustomerReceipt, downloadBookingDocument, generateBookingDocument, getBookingDocument, getCustomerReservation, type BookingDocument, type CustomerReservation, type CustomerReservationDetail } from '../../services/customerReservationApi'
import { paymentCountdown, reservationProgress, reservationStatusLabels } from './reservationPresentation'
import { ApiClientError } from '../../services/apiClient'
import CustomerPaymentComplaint from './CustomerPaymentComplaint'
import CustomerReservationPayment from './CustomerReservationPayment'

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
  const [busy, setBusy] = useState(false)
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const [goodsDetailOpen, setGoodsDetailOpen] = useState(false)
  const [bookingDocument, setBookingDocument] = useState<BookingDocument | null>(null)
  const [bookingDocumentOpen, setBookingDocumentOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    let disposed = false
    void getCustomerReservation(r.id).then(value => { if (!disposed) setDetail(value) })
      .catch(error => { if (!disposed) setMessage(error instanceof Error ? error.message : 'Không thể tải chi tiết đơn.') })
    return () => { disposed = true }
  }, [r.id, r.status])
  const countdown = paymentCountdown(detail?.paymentExpiresAt || r.holdExpiresAt, now)
  const progress = reservationProgress(r.status)
  const inactive = progress === null
  const steps = [
    { label: 'Xác minh email', detail: 'Xác nhận địa chỉ liên hệ' },
    { label: 'Phê duyệt hồ sơ', detail: r.goodsReviewStatus === 'PENDING' ? 'Nhân viên kiểm tra hàng hóa' : 'Hồ sơ được duyệt tự động' },
    { label: ['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) ? 'Đối soát thanh toán' : 'Thanh toán cọc', detail: r.status === 'PAYMENT_GRACE' ? 'Chờ khách hàng gửi chứng từ' : r.status === 'PAYMENT_REVIEW' ? 'Đang kiểm tra chứng từ thanh toán' : 'Hoàn tất cọc giữ chỗ' },
    { label: 'Quản lý phân kho', detail: 'Chờ phân gian kho cụ thể' },
    { label: 'Nhận kho và ký', detail: 'Đối chiếu và ký tại cơ sở' },
    { label: 'Đã bàn giao', detail: 'Nhận kho và mã ra vào' },
  ]
  const prepareBookingDocument = async () => {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      let result: BookingDocument
      try {
        result = await getBookingDocument(r.id)
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 404) throw error
        result = await generateBookingDocument(r.id)
      }
      setBookingDocument(result)
      setBookingDocumentOpen(true)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể tạo phiếu xác nhận giữ kho.') }
    finally { setBusy(false) }
  }
  const viewBookingDocument = async () => {
    const preview = window.open('', '_blank')
    if (preview) preview.opener = null
    try {
      const file = await downloadBookingDocument(r.id)
      const url = URL.createObjectURL(file.blob)
      if (preview) preview.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      preview?.close()
      setMessage(error instanceof Error ? error.message : 'Không thể xem phiếu xác nhận giữ kho.')
    }
  }
  const saveBookingDocument = async () => {
    try {
      const file = await downloadBookingDocument(r.id)
      const url = URL.createObjectURL(file.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.fileName || bookingDocument?.fileName || `phieu-xac-nhan-giu-kho-${r.reservationCode}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể tải phiếu xác nhận giữ kho.') }
  }
  const confirmReceipt = async () => {
    if (confirmingReceipt) return
    setConfirmingReceipt(true); setMessage(null)
    try {
      await confirmCustomerReceipt(r.id)
      setMessage('Đã xác nhận nhận kho. Hồ sơ thuê đã được tạo thành công.')
      await onRefresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể xác nhận nhận kho.') }
    finally { setConfirmingReceipt(false) }
  }
  const documentAvailable = ['CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'COMPLETED'].includes(r.status)
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
        <CustomerReservationPayment reservation={r} facilityName={facilityName} unitTypeName={unitTypeName} paymentExpiresAt={detail?.paymentExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />
        {r.status === 'AWAITING_CUSTOMER_RECEIPT' && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-xs text-amber-950"><p className="font-bold">Nhân viên đã hoàn tất bàn giao</p><p className="mt-1">Vui lòng xác nhận bạn đã nhận kho và mã ra vào.</p><Button type="button" className="mt-2" size="sm" disabled={confirmingReceipt} onClick={() => void confirmReceipt}>{confirmingReceipt ? 'Đang xác nhận…' : 'Xác nhận đã nhận kho'}</Button></div>}
        {documentAvailable && <Button variant="outline" size="sm" disabled={busy} onClick={() => void prepareBookingDocument()}>{busy ? 'Đang chuẩn bị…' : 'Xem phiếu giữ kho'}</Button>}
        {['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) && <CustomerPaymentComplaint reservation={r} complaintExpiresAt={detail?.complaintExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />}
        {!inactive && r.status !== 'COMPLETED' && <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 text-xs" onClick={onCancel}>✕ Hủy giữ kho</Button>}
      </div>
    </div>
    {message && <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <Modal open={bookingDocumentOpen} onClose={() => setBookingDocumentOpen(false)} title="Phiếu xác nhận giữ kho">
      {bookingDocument && <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-bold">Phiếu xác nhận giữ kho đã được phát hành</p>
          <p className="mt-2">Đơn giữ kho: <b>{bookingDocument.reservationCode}</b></p>
          <p>Tệp: <b>{bookingDocument.fileName}</b></p>
          <p>Ngày phát hành: <b>{new Date(bookingDocument.issuedAt).toLocaleString('vi-VN')}</b></p>
        </div>
        <p className="text-sm text-stone-600">Phiếu ghi nhận loại kho đã giữ và khoản cọc giữ chỗ đã thanh toán. Đây không phải hợp đồng thuê và không xác nhận một gian kho vật lý cụ thể.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={() => void viewBookingDocument()}>Xem PDF</Button>
          <Button onClick={() => void saveBookingDocument()}>Tải PDF</Button>
        </div>
      </div>}
    </Modal>
  </Card>
}
