import { useEffect, useRef, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { confirmCustomerReceipt, downloadBookingDocument, downloadCustomerCheckInDocument, downloadCustomerReservationGoodsImage, generateBookingDocument, getBookingDocument, getCustomerCheckInDocuments, getCustomerReservation, setCustomerCheckInAppointment, updateSetupGoods, type BookingDocument, type CheckInDocument, type CustomerFacility, type CustomerReservation, type CustomerReservationDetail, type CustomerUnitType, type GoodsItemInput, type ReservationPaymentResult } from '../../services/customerReservationApi'
import { paymentCountdown, reservationProgress, reservationStatusLabels } from './reservationPresentation'
import { ApiClientError } from '../../services/apiClient'
import CustomerPaymentComplaint from './CustomerPaymentComplaint'
import CustomerReservationPayment from './CustomerReservationPayment'
import ReservationReceipt from './ReservationReceipt'
import { paymentMethodLabel } from './paymentLabels'
import { formatPolicyDateTime, isCheckInAppointmentAllowed, plannedCheckInWindow, policyDateInput, policyDateTimeInput, policyTimeInput } from '../../domain/reservationCheckInPolicy'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import type { Facility, UnitType } from '../../types/storageHub'
import { totalGoodsVolumeM3, formatGoodsVolume } from '../../domain/goodsMeasurements'

const APPOINTMENT_EDITABLE_STATUSES = [
  'AWAITING_EMAIL',
  'AWAITING_REVIEW',
  'AWAITING_PAYMENT',
  'PAYMENT_GRACE',
  'PAYMENT_REVIEW',
  'CONFIRMED',
  'UNIT_RESERVED',
  'READY_FOR_CHECKIN',
] as const

function localDateTimeInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() + 7 * 60 * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.replace(/-/g, '/')
}

function maskIdentityDocument(value?: string | null) {
  if (!value) return 'Chưa cập nhật'
  if (value.length <= 4) return '••••'
  return `${value.slice(0, 2)}••••${value.slice(-2)}`
}

interface Props {
  reservation: CustomerReservation
  facilityName: string
  unitTypeName: string
  facilityDetails?: Pick<CustomerFacility, 'address' | 'city' | 'phone' | 'accessHours'> | null
  unitTypeDetails?: Pick<CustomerUnitType, 'lengthM' | 'widthM' | 'heightM' | 'volumeM3' | 'rackCount' | 'rackLengthM' | 'rackWidthM' | 'rackHeightM' | 'maxLoadKg'> | null
  facility?: Facility
  unitType?: UnitType
  onVerify: () => void
  onCancel: () => void
  onRefresh: () => Promise<void>
  onReceiptConfirmed?: (reservationId: string) => void
}

export default function CustomerReservationCard({ reservation: r, facilityName, unitTypeName, facilityDetails, unitTypeDetails, facility, unitType, onVerify, onCancel, onRefresh, onReceiptConfirmed }: Props) {
  const [detail, setDetail] = useState<CustomerReservationDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const receiptLock = useRef(false)
  const [bookingDocument, setBookingDocument] = useState<BookingDocument | null>(null)
  const [bookingDocumentOpen, setBookingDocumentOpen] = useState(false)
  const [handoverDocuments, setHandoverDocuments] = useState<CheckInDocument[]>([])
  const [handoverDocumentsOpen, setHandoverDocumentsOpen] = useState(false)
  const [paymentReceipt, setPaymentReceipt] = useState<ReservationPaymentResult | null>(null)
  const [appointmentInput, setAppointmentInput] = useState(() => localDateTimeInput(r.appointmentAt))
  const [appointmentErrors, setAppointmentErrors] = useState<{ date?: string; time?: string }>({})
  const [savedAppointmentAt, setSavedAppointmentAt] = useState(r.appointmentAt)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [setupGoodsEditOpen, setSetupGoodsEditOpen] = useState(false)
  const [setupGoodsDraft, setSetupGoodsDraft] = useState<GoodsItemInput[]>([])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    setAppointmentInput(localDateTimeInput(r.appointmentAt))
    setSavedAppointmentAt(r.appointmentAt)
  }, [r.appointmentAt])
  useEffect(() => {
    let disposed = false
    void getCustomerReservation(r.id).then(value => { if (!disposed) setDetail(value) })
      .catch(error => { if (!disposed) setMessage(error instanceof Error ? error.message : 'Không thể tải chi tiết đơn.') })
    return () => { disposed = true }
  }, [r.id, r.status])
  const countdown = paymentCountdown(detail?.paymentExpiresAt || r.holdExpiresAt, now)
  const appointmentWindow = plannedCheckInWindow(
    r.createdAt,
    r.goodsReviewStatus !== 'NOT_REQUIRED',
  )
  const progress = reservationProgress(r.status)
  const inactive = progress === null
  const remainingPayment = detail?.payments?.find(payment => payment.purpose === 'RENTAL_BALANCE' && payment.paymentStatus === 'PAID') || null
  const goodsItems = detail?.goodsItems ?? []
  const totalGoodsQuantity = goodsItems.reduce((total, item) => total + item.quantity, 0)
  const calculatedGoodsVolumeM3 = totalGoodsVolumeM3(goodsItems)
  const calculatedGoodsWeightKg = goodsItems.reduce((total, item) => total + item.quantity * item.weightPerItemKg, 0)
  const formatMeasurement = formatGoodsVolume
  const rentalMonths = r.rentalMonths && r.rentalMonths > 0 ? r.rentalMonths : Math.max(1, Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (30.4375 * 86_400_000)))
  const discountAmount = r.discountAmount ?? 0
  const voucherDiscountAmount = r.voucherDiscountAmount ?? 0
  const grossRentalAmount = r.grossRentalAmount ?? r.totalRentalAmount + discountAmount + voucherDiscountAmount
  const savedQuote = {
    quoteId: r.quoteId,
    facilityId: r.facilityId,
    unitTypeId: r.unitTypeId,
    startDate: r.startDate,
    endDate: r.endDate,
    rentalMonths,
    freeSetupDays: r.freeSetupDays ?? 0,
    monthlyPrice: r.monthlyPrice ?? grossRentalAmount / rentalMonths,
    subtotal: grossRentalAmount,
    discountRate: r.discountRate ?? (grossRentalAmount > 0 ? discountAmount / grossRentalAmount : 0),
    discountAmount,
    totalAfterDiscount: r.totalRentalAmount,
    reservationDepositAmount: r.reservationDepositAmount,
    securityDepositAmount: r.securityDepositAmount,
    remainingRentalAmount: r.remainingRentalAmount,
    dueAtCheckIn: r.dueAtCheckIn,
    totalInitialObligation: r.totalInitialObligation,
    policyVersion: r.pricingPackageCode ?? 'Đã lưu cùng đơn',
    voucherCode: r.voucherCode,
    voucherDiscountAmount,
    quotedAt: r.createdAt,
    expiresAt: r.holdExpiresAt,
  }
  const beginSetupGoodsEdit = () => {
    setSetupGoodsDraft(goodsItems.map(item => ({
      category: item.category,
      customGoodsName: item.customGoodsName,
      materialName: item.materialName,
      customMaterial: item.customMaterial,
      description: item.description,
      customerNote: item.customerNote,
      quantity: item.quantity,
      lengthCm: item.lengthCm,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      weightPerItemKg: item.weightPerItemKg,
      fragile: item.fragile,
    })))
    setSetupGoodsEditOpen(true)
  }
  const saveSetupGoods = async () => {
    if (busy || !setupGoodsDraft.length) return
    setBusy(true); setMessage(null)
    try {
      const updated = await updateSetupGoods(r.id, { goodsItems: setupGoodsDraft, goodsCondition: detail?.goodsCondition })
      setDetail(updated)
      setSetupGoodsEditOpen(false)
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật khai báo hàng trong setup.')
    } finally { setBusy(false) }
  }
  const steps = [
    { label: 'Xác minh email', detail: 'Xác nhận địa chỉ liên hệ' },
    { label: 'Phê duyệt hồ sơ', detail: r.goodsReviewStatus === 'PENDING' ? 'Nhân viên kiểm tra hàng hóa' : 'Hồ sơ được duyệt tự động' },
    { label: ['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) ? 'Đối soát thanh toán' : 'Thanh toán cọc', detail: r.status === 'PAYMENT_GRACE' ? 'Chờ khách hàng gửi chứng từ' : r.status === 'PAYMENT_REVIEW' ? 'Đang kiểm tra chứng từ thanh toán' : 'Hoàn tất cọc giữ chỗ' },
    { label: 'Quản lý phân kho', detail: r.assignedUnitCode ? `Đã phân ${r.assignedUnitCode}` : 'Chờ phân gian kho cụ thể' },
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
    if (receiptLock.current) return
    receiptLock.current = true
    setConfirmingReceipt(true); setMessage(null)
    try {
      const confirmed = await confirmCustomerReceipt(r.id)
      setMessage('Đã xác nhận nhận kho. Hồ sơ thuê đã được tạo thành công.')
      try { await onRefresh() } catch { /* Receipt command has already succeeded. */ }
      onReceiptConfirmed?.(confirmed.reservation.assignedUnitId || r.assignedUnitId || '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể xác nhận nhận kho.')
      try { await onRefresh() } catch { /* Preserve the command error if readback is also unavailable. */ }
    }
    finally { receiptLock.current = false; setConfirmingReceipt(false) }
  }
  const documentAvailable = ['CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'COMPLETED'].includes(r.status)
  const handoverDocumentsAvailable = ['AWAITING_CUSTOMER_RECEIPT', 'COMPLETED'].includes(r.status)
  const saveAppointment = async () => {
    if (!appointmentInput || busy) return
    const [appointmentDate = '', appointmentTime = ''] = appointmentInput.split('T')
    const earliestDate = policyDateInput(appointmentWindow.availableAt)
    const latestDate = policyDateInput(appointmentWindow.deadlineAt)
    const appointment = new Date(`${appointmentInput}:00+07:00`)
    const errors: { date?: string; time?: string } = {}

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      errors.date = 'Vui lòng chọn ngày nhận kho hợp lệ.'
    } else if (appointmentDate < earliestDate || appointmentDate > latestDate) {
      errors.date = `Ngày nhận kho phải từ ${appointmentWindow.availableAt.toLocaleDateString('vi-VN')} đến ${appointmentWindow.deadlineAt.toLocaleDateString('vi-VN')}.`
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)) {
      errors.time = 'Vui lòng chọn giờ nhận kho hợp lệ.'
    } else {
      if (!errors.date && appointmentDate === earliestDate && appointment < appointmentWindow.availableAt) {
        errors.time = `Trong ngày ${appointmentWindow.availableAt.toLocaleDateString('vi-VN')}, giờ nhận kho sớm nhất là ${policyTimeInput(appointmentWindow.availableAt)}.`
      }
    }

    if (!errors.date && !errors.time && !isCheckInAppointmentAllowed(appointment, appointmentWindow)) {
      errors.time = 'Giờ nhận kho không nằm trong khung giờ được phép.'
    }
    if (errors.date || errors.time) {
      setAppointmentErrors(errors)
      setMessage(null)
      return
    }
    setAppointmentErrors({})
    setBusy(true); setMessage(null)
    try {
      const saved = await setCustomerCheckInAppointment(r.id, appointment.toISOString())
      setSavedAppointmentAt(saved.appointmentAt)
      setAppointmentInput(localDateTimeInput(saved.appointmentAt))
      try { await onRefresh() } catch {
        setMessage('Lịch đã lưu vào hệ thống, nhưng chưa tải lại được danh sách. Vui lòng tải lại trang để kiểm tra.')
        return
      }
      setMessage('Đã lưu lịch nhận kho. Nhân viên tại cơ sở đã được thông báo về thay đổi này.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể lưu lịch hẹn.') }
    finally { setBusy(false) }
  }
  const loadHandoverDocuments = async () => {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      setHandoverDocuments(await getCustomerCheckInDocuments(r.id))
      setHandoverDocumentsOpen(true)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể tải văn bản bàn giao.') }
    finally { setBusy(false) }
  }
  const viewHandoverDocument = async (document: CheckInDocument) => {
    const preview = window.open('', '_blank')
    if (preview) preview.opener = null
    try {
      const file = await downloadCustomerCheckInDocument(document.id)
      const url = URL.createObjectURL(file.blob)
      if (preview) preview.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      preview?.close()
      setMessage(error instanceof Error ? error.message : 'Không thể mở văn bản bàn giao.')
    }
  }
  const viewGoodsImage = async (assetId: string) => {
    const preview = window.open('', '_blank')
    if (preview) preview.opener = null
    try {
      const file = await downloadCustomerReservationGoodsImage(assetId)
      const url = URL.createObjectURL(file.blob)
      if (preview) preview.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      preview?.close()
      setMessage(error instanceof Error ? error.message : 'Không thể mở hình ảnh hàng hóa.')
    }
  }
  const saveHandoverDocument = async (fileDocument: CheckInDocument) => {
    try {
      const file = await downloadCustomerCheckInDocument(fileDocument.id)
      const url = URL.createObjectURL(file.blob)
      const link = window.document.createElement('a')
      link.href = url; link.download = file.fileName || fileDocument.originalName; window.document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể tải văn bản bàn giao.') }
  }
  return (
  <Card
    id={`customer-reservation-${r.id}`}
    tabIndex={-1}
    className={`p-6 border-l-4 ${
      inactive
        ? 'border-l-stone-300 text-stone-500'
        : 'border-l-amber-500'
    }`}
  >
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-amber-700">{r.reservationCode}</span>
          <span className={`rounded px-2.5 py-1 text-xs font-bold ${progress !== null && progress >= 3 ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{reservationStatusLabels[r.status]}</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-stone-900">{unitTypeName} · {facilityName}</h2>
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-5 text-stone-600">Lịch thuê: <b className="text-stone-900">{formatDisplayDate(r.startDate)} đến {formatDisplayDate(r.endDate)}</b></p>
          <p className="text-xs leading-5 text-blue-800">Lịch nhận kho khách đặt: <b>{savedAppointmentAt ? new Date(savedAppointmentAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa đặt lịch'}</b></p>
        </div>
        <div className="mt-3 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-700 md:grid-cols-2">
          <section>
            <h3 className="font-bold text-stone-900">Thông tin khách hàng</h3>
            <div className="mt-2 space-y-1"><p><b>Họ tên:</b> {r.customerName || 'Chưa cập nhật'}</p><p><b>Email:</b> {r.customerEmail || 'Chưa cập nhật'}</p><p><b>Số điện thoại:</b> {r.customerPhone || 'Chưa cập nhật'}</p><p><b>CCCD/Hộ chiếu:</b> {maskIdentityDocument(r.identityDocumentNumber)}</p><p><b>Địa chỉ:</b> {r.customerAddress || 'Chưa cập nhật'}</p></div>
          </section>
          <section>
            <h3 className="font-bold text-stone-900">Thông tin kho</h3>
            <div className="mt-2 space-y-1"><p><b>Địa chỉ:</b> {facilityDetails ? `${facilityDetails.address}, ${facilityDetails.city}` : 'Chưa cập nhật'}</p><p><b>Liên hệ:</b> {facilityDetails?.phone || 'Chưa cập nhật'}</p><p><b>Giờ hoạt động:</b> {facilityDetails?.accessHours || 'Chưa cập nhật'}</p>{unitTypeDetails && <><p><b>Kích thước kho:</b> {unitTypeDetails.lengthM} × {unitTypeDetails.widthM} × {unitTypeDetails.heightM} m · {unitTypeDetails.volumeM3} m³</p><p><b>Khung:</b> {unitTypeDetails.rackCount} khung · {unitTypeDetails.rackLengthM} × {unitTypeDetails.rackWidthM} × {unitTypeDetails.rackHeightM} m/khung</p><p><b>Tải trọng:</b> {unitTypeDetails.maxLoadKg.toLocaleString('vi-VN')} kg</p></>}{r.assignedUnitCode && <p><b>Gian kho đã phân:</b> {r.assignedUnitCode}{r.assignedUnitStatus ? ` (${r.assignedUnitStatus})` : ''}</p>}</div>
          </section>
        </div>
        {APPOINTMENT_EDITABLE_STATUSES.some(status => status === r.status) && <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <div><VietnameseDateInput value={appointmentInput.split('T')[0] || ''} min={policyDateTimeInput(appointmentWindow.availableAt).slice(0, 10)} max={policyDateTimeInput(appointmentWindow.deadlineAt).slice(0, 10)}
              onChange={date => { setAppointmentInput(`${date}T${appointmentInput.split('T')[1] || '00:00'}`); setAppointmentErrors(current => ({ ...current, date: undefined })); setMessage(null) }} />
              {appointmentErrors.date && <p className="mt-1 text-xs text-red-700">{appointmentErrors.date}</p>}</div>
            <label className="block text-sm font-medium text-stone-700">Giờ nhận kho mong muốn<input aria-invalid={Boolean(appointmentErrors.time)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-normal" type="time" step="60" value={appointmentInput.split('T')[1] || ''}
              onChange={event => { setAppointmentInput(`${appointmentInput.split('T')[0] || ''}T${event.target.value}`); setAppointmentErrors(current => ({ ...current, time: undefined })); setMessage(null) }} />{appointmentErrors.time && <p className="mt-1 text-xs text-red-700">{appointmentErrors.time}</p>}</label>
          </div>
          <Button size="sm" disabled={!appointmentInput || busy} onClick={() => void saveAppointment()}>{busy ? 'Đang lưu…' : r.appointmentAt ? 'Đổi lịch nhận kho' : 'Lưu lịch nhận kho'}</Button>
          <span className="basis-full text-[11px]">Lịch hợp lệ từ {formatPolicyDateTime(appointmentWindow.availableAt)} đến {formatPolicyDateTime(appointmentWindow.deadlineAt)}. Kỳ thuê bắt đầu từ ngày kho có thể sẵn sàng sớm nhất. Mọi thay đổi lịch sẽ được thông báo cho nhân viên tại cơ sở.</span>
          {message && <p role="status" className="basis-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
        </div>}
        <div className="mt-3 space-y-4">
          <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-700">
            <h3 className="font-bold text-stone-900">Thông tin khách hàng</h3>
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><dt className="inline font-medium">Họ và tên: </dt><dd className="inline">{r.customerName || 'Chưa có thông tin'}</dd></div>
              <div><dt className="inline font-medium">CCCD / Hộ chiếu: </dt><dd className="inline">{r.identityDocumentNumber || 'Chưa có thông tin'}</dd></div>
              <div><dt className="inline font-medium">Số điện thoại: </dt><dd className="inline">{r.customerPhone || 'Chưa có thông tin'}</dd></div>
              <div><dt className="inline font-medium">Email: </dt><dd className="inline break-all">{r.customerEmail || 'Chưa có thông tin'}</dd></div>
              <div className="sm:col-span-2"><dt className="inline font-medium">Địa chỉ: </dt><dd className="inline">{r.customerAddress || 'Chưa có thông tin'}</dd></div>
            </dl>
            <h3 className="mt-4 border-t border-stone-200 pt-4 font-bold text-stone-900">Thông tin kho đã đặt</h3>
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><dt className="inline font-medium">Cơ sở: </dt><dd className="inline">{facilityName}</dd></div>
              <div><dt className="inline font-medium">Loại kho: </dt><dd className="inline">{unitTypeName}</dd></div>
              {facility && <><div className="sm:col-span-2"><dt className="inline font-medium">Địa chỉ kho: </dt><dd className="inline">{facility.address}</dd></div><div><dt className="inline font-medium">Giờ hoạt động: </dt><dd className="inline">{facility.accessHours || 'Chưa công bố'}</dd></div>{facility.phone && <div><dt className="inline font-medium">Liên hệ cơ sở: </dt><dd className="inline">{facility.phone}</dd></div>}</>}
              {unitType && <><div><dt className="inline font-medium">Diện tích: </dt><dd className="inline">{unitType.areaM2} m²</dd></div><div><dt className="inline font-medium">Kích thước kho (D × R × C): </dt><dd className="inline">{unitType.lengthM} × {unitType.widthM} × {unitType.heightM} m</dd></div><div><dt className="inline font-medium">Thể tích kho: </dt><dd className="inline">{unitType.volumeM3} m³</dd></div><div><dt className="inline font-medium">Tải trọng tối đa: </dt><dd className="inline">{unitType.maxLoadKg.toLocaleString('vi-VN')} kg</dd></div></>}
            </dl>
          </section>
          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-stone-900">Thông tin hàng hóa đã khai báo</h3><p className="mt-1 text-xs text-stone-500">Chỉ được sửa một lần trong setup và sẽ khóa ngay khi kiểm kê.</p></div>{r.status === 'READY_FOR_CHECKIN' && !r.setupGoodsRevisionUsedAt && !setupGoodsEditOpen && <Button type="button" variant="outline" size="sm" disabled={!goodsItems.length || busy} onClick={beginSetupGoodsEdit}>Sửa khai báo một lần</Button>}</div>
            {!detail && <p className="mt-3 text-stone-500">Đang tải chi tiết hàng hóa…</p>}
            {detail && <>
              {setupGoodsEditOpen && <div className="mt-3 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><p className="font-bold">Cập nhật khai báo trong setup</p><p>Đây là lần sửa duy nhất. Sau khi lưu hoặc sau khi Staff kiểm kê, hệ thống sẽ khóa khai báo.</p>{setupGoodsDraft.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:grid-cols-4"><label className="sm:col-span-2">Mô tả<input className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5" value={item.description || ''} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, description: event.target.value } : value))} /></label><label>Số lượng<input className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5" type="number" min="1" value={item.quantity} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, quantity: Number(event.target.value) } : value))} /></label><label>Cân nặng/kiện<input className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5" type="number" min="0.01" step="0.01" value={item.weightPerItemKg} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, weightPerItemKg: Number(event.target.value) } : value))} /></label><label>Dài × Rộng × Cao (cm)<span className="mt-1 flex gap-1"><input className="w-full rounded border border-stone-300 px-1 py-1.5" type="number" min="0.01" value={item.lengthCm} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, lengthCm: Number(event.target.value) } : value))} /><input className="w-full rounded border border-stone-300 px-1 py-1.5" type="number" min="0.01" value={item.widthCm} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, widthCm: Number(event.target.value) } : value))} /><input className="w-full rounded border border-stone-300 px-1 py-1.5" type="number" min="0.01" value={item.heightCm} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, heightCm: Number(event.target.value) } : value))} /></span></label></div>)}<div className="flex gap-2"><Button type="button" size="sm" disabled={busy} onClick={() => void saveSetupGoods()}>{busy ? 'Đang lưu…' : 'Lưu thay đổi và khóa khai báo'}</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setSetupGoodsEditOpen(false)}>Hủy</Button></div></div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng loại hàng</span><b className="mt-1 block text-base text-stone-900">{goodsItems.length}</b></div>
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng số lượng</span><b className="mt-1 block text-base text-stone-900">{totalGoodsQuantity.toLocaleString('vi-VN')} kiện</b></div>
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng kích thước cần dùng</span><b className="mt-1 block text-base text-stone-900">{formatMeasurement(calculatedGoodsVolumeM3)} m³</b></div>
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng cân nặng</span><b className="mt-1 block text-base text-stone-900">{formatMeasurement(calculatedGoodsWeightKg)} kg</b></div>
              </div>
              <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3"><b className="text-stone-900">Tình trạng đóng gói chung:</b> {detail.goodsCondition || 'Không có mô tả'}</div>
              <div className="mt-3 space-y-3">
                {goodsItems.map((item, index) => {
                  const itemVolumeM3 = item.lengthCm * item.widthCm * item.heightCm / 1_000_000
                  return <article key={item.id} className="rounded-lg border border-stone-200 bg-white p-4 leading-5">
                    <p className="font-bold text-stone-900">{item.goodsCode || 'Hàng hóa'}: {item.customGoodsName || item.categoryName || 'Loại hàng đã khai báo'}</p>
                    <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      <p><b>Loại hàng:</b> {item.categoryName || 'Loại hàng đã khai báo'}</p>
                      <p><b>Chất liệu:</b> {item.customMaterial || item.materialName || 'Không có'}</p>
                      <p className="sm:col-span-2"><b>Mô tả:</b> {item.description || 'Không có'}</p>
                      <p><b>Số lượng:</b> {item.quantity.toLocaleString('vi-VN')} kiện</p>
                      <p><b>Kích thước mỗi kiện:</b> {formatMeasurement(item.lengthCm)} × {formatMeasurement(item.widthCm)} × {formatMeasurement(item.heightCm)} cm</p>
                      <p><b>Thể tích:</b> {formatMeasurement(itemVolumeM3)} m³/kiện · tổng {formatMeasurement(itemVolumeM3 * item.quantity)} m³</p>
                      <p><b>Cân nặng:</b> {formatMeasurement(item.weightPerItemKg)} kg/kiện · tổng {formatMeasurement(item.quantity * item.weightPerItemKg)} kg</p>
                      <p><b>Hàng dễ bể / dễ vỡ:</b> {item.fragile ? 'Có' : 'Không'}</p>
                      <div><b>Hình ảnh:</b> {item.images.length ? <span className="mt-1 flex flex-wrap gap-1.5">{item.images.map(image => <button key={image.id} type="button" className="rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-left text-[11px] text-stone-700 hover:border-amber-400 hover:bg-amber-50" onClick={() => void viewGoodsImage(image.id)}>{image.originalName}</button>)}</span> : 'Không có'}</div>
                      {item.customerNote && <p className="sm:col-span-2"><b>Ghi chú:</b> {item.customerNote}</p>}
                    </div>
                  </article>
                })}
              </div>
              <p className="mt-3 text-[11px] text-stone-500">Số liệu đối chiếu đã lưu: {formatMeasurement(r.totalGoodsVolumeM3)} m³ · {formatMeasurement(r.totalGoodsWeightKg)} kg.</p>
            </>}
          </section>

          <ReservationQuoteSummary quote={savedQuote} needsReview={false} context="reservation" />
            {r.setupExitReviewRequired && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><b>Đang chờ Business quyết định hoàn tiền</b><p className="mt-1 text-xs">Yêu cầu hủy/trả trong thời gian setup không tự động hoàn tiền. Khoản hoàn và bước kiểm tra trả kho sẽ được quyết định theo tình trạng hàng thực tế.</p></div>}
            {remainingPayment && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
              <p className="font-bold">Biên lai thanh toán phần còn lại</p>
              <p className="mt-1">Đã ghi nhận {formatVnd(remainingPayment.amount)} bằng {remainingPayment.paymentMethod ? paymentMethodLabel(remainingPayment.paymentMethod) : 'phương thức tại quầy'}.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setPaymentReceipt(remainingPayment)}>Xem biên lai</Button>
            </div>}
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
        <div className="text-right"><p className="text-xs text-stone-500">Tổng thu cả kỳ (gồm tiền cọc đảm bảo kho)</p><p className="text-xl font-bold text-stone-900">{formatVnd(r.totalInitialObligation)}</p><p className="text-xs text-amber-800">Trả lúc giữ chỗ: {formatVnd(r.reservationDepositAmount)}</p></div>
        {r.status === 'AWAITING_EMAIL' && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-xs text-amber-950"><p className="font-bold">Cần xác minh email</p><p className="mt-1">Thời gian giữ đơn còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p><Button className="mt-2" size="sm" disabled={countdown.expired} onClick={onVerify}>Xác minh email</Button></div>}
        {r.status === 'AWAITING_REVIEW' && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950"><p className="font-bold">Đang chờ nhân viên cơ sở duyệt hàng hóa</p><p className="mt-1">Thời gian giữ hồ sơ còn lại</p><p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p><p className="mt-1">Tối đa 24 giờ từ khi xác minh email.</p></div>}
        <CustomerReservationPayment reservation={r} facilityName={facilityName} unitTypeName={unitTypeName} paymentExpiresAt={detail?.paymentExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />
        {r.status === 'AWAITING_CUSTOMER_RECEIPT' && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-xs text-amber-950"><p className="font-bold">Nhân viên đã hoàn tất bàn giao</p><p className="mt-1">Vui lòng xác nhận bạn đã nhận kho và mã ra vào.</p><Button type="button" className="mt-2" size="sm" disabled={confirmingReceipt} onClick={() => void confirmReceipt()}>{confirmingReceipt ? 'Đang xác nhận…' : 'Xác nhận đã nhận kho'}</Button></div>}
        {documentAvailable && <Button variant="outline" size="sm" disabled={busy} onClick={() => void prepareBookingDocument()}>{busy ? 'Đang chuẩn bị…' : 'Xem phiếu giữ kho'}</Button>}
        {handoverDocumentsAvailable && <Button variant="outline" size="sm" disabled={busy} onClick={() => void loadHandoverDocuments()}>{busy ? 'Đang tải…' : 'Xem hợp đồng đã ký'}</Button>}
        {['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) && <CustomerPaymentComplaint reservation={r} complaintExpiresAt={detail?.complaintExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />}
        {APPOINTMENT_EDITABLE_STATUSES.some(status => status === r.status) && <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 text-xs" onClick={() => setCancelConfirmOpen(true)}>Hủy giữ kho</Button>}
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
    <Modal open={handoverDocumentsOpen} onClose={() => setHandoverDocumentsOpen(false)} title="Văn bản hợp đồng và bàn giao">
      <div className="space-y-3">
        <p className="text-sm text-stone-600">Các tệp được nhân viên tải lên khi hoàn tất bàn giao kho.</p>
        {handoverDocuments.map((document, index) => {
          const isSignedContract = document.originalName.toLowerCase().startsWith('hop-dong-da-ky-') || index === 0
          return <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"><span><b className="mr-2">{isSignedContract ? 'Hợp đồng đã ký' : 'Bằng chứng bàn giao'}</b>{document.originalName.replace(/^hop-dong-da-ky-/i, '')}</span><span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void viewHandoverDocument(document)}>Xem</Button><Button size="sm" onClick={() => void saveHandoverDocument(document)}>Tải xuống</Button></span></div>
        })}
        {!handoverDocuments.length && <p className="rounded-lg border border-dashed border-stone-300 p-5 text-center text-sm text-stone-500">Chưa có văn bản bàn giao được tải lên.</p>}
      </div>
    </Modal>
    <Modal open={Boolean(paymentReceipt)} onClose={() => setPaymentReceipt(null)} title="Biên lai thanh toán nhận kho">
      {paymentReceipt && <ReservationReceipt payment={paymentReceipt} reservationCode={r.reservationCode} />}
    </Modal>
    <Modal open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)} title="Xác nhận hủy giữ kho" closeLabel="Đóng xác nhận hủy">
      <div className="space-y-5">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
          {progress !== null && progress >= 3
            ? `Đơn ${r.reservationCode} đã được xác nhận thanh toán cọc. Hủy trước khi nhận kho có thể mất cọc theo chính sách. Bạn chắc chắn muốn hủy?`
            : `Bạn có chắc muốn hủy ${r.reservationCode}? Suất kho đang giữ sẽ được giải phóng.`}
        </p>
        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
          <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>Quay lại</Button>
          <Button variant="danger" onClick={() => { setCancelConfirmOpen(false); onCancel() }}>Xác nhận hủy giữ kho</Button>
        </div>
      </div>
    </Modal>
 </Card>
  )
}
