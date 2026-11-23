import { rentalEndDateForDisplay } from '../../domain/rentalTimeline'
import type { CheckInInventoryLine } from '../../services/checkInApi'
import { formatCustomerDate, formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { savedReservationQuote, MISSING_RESERVATION_SNAPSHOT } from '../../services/reservationSnapshot'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { confirmCustomerReceipt, downloadBookingDocument, downloadCustomerCheckInDocument, downloadCustomerReservationGoodsImage, generateBookingDocument, getCustomerCheckInDocuments, getCustomerReservation, markCustomerPreparationComplete, resolveCustomerInventory, setCustomerCheckInAppointment, updateSetupGoods, type BookingDocument, type CheckInDocument, type CustomerFacility, type CustomerReservation, type CustomerReservationDetail, type CustomerUnitType, type GoodsItemInput, type ReservationPaymentResult } from '../../services/customerReservationApi'
import { goodsReviewLabels, paymentCountdown, reservationProgress, reservationStatusLabels } from './reservationPresentation'
import CustomerPaymentComplaint from './CustomerPaymentComplaint'
import CustomerReservationPayment from './CustomerReservationPayment'
import ReservationReceipt from './ReservationReceipt'
import { paymentMethodLabel } from './paymentLabels'
import { formatPolicyDateTime, isCheckInAppointmentAllowed, plannedCheckInWindow, policyDateInput, policyDateTimeInput, policyTimeInput, STAFF_REVIEW_HOURS } from '../../domain/reservationCheckInPolicy'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import InventoryAppointmentPanel, { inventoryDeadlineText } from './InventoryAppointmentPanel'
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
  onRequestSupport?: () => void
  facility?: Facility
  unitType?: UnitType
  onVerify: () => void
  onCancel: () => void
  onDelete?: () => void
  onRefresh: () => Promise<void>
  onReceiptConfirmed?: (reservationId: string) => void
  visualTone?: 'active' | 'expired' | 'completed'
}

export function ReservationPreparationNotice({ checkInStatus, submitting, onReady }: {
  checkInStatus: string | null | undefined
  submitting: boolean
  onReady: () => void
}) {
  const waitingForInventory = checkInStatus === 'setup_completed' || checkInStatus === 'completed'
  const canReportPreparation = checkInStatus === 'setup_in_progress' || checkInStatus === 'handover_pending_receipt'

  return (
    <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 text-right text-xs text-violet-950">
      {waitingForInventory ? (
        <p className="font-bold">{checkInStatus === 'completed' ? 'Đã hoàn tất kiểm kê' : 'Đang chờ nhân viên kiểm kê'}</p>
      ) : (
        <>
          <p className="font-bold">Đang chuẩn bị hàng hóa</p>
          {canReportPreparation && (
            <>
              <p className="mt-1">Sau khi sắp xếp hàng hóa xong, nhấn nút để báo nhân viên có thể kiểm kê.</p>
              <Button type="button" className="mt-2" size="sm" disabled={submitting} onClick={onReady}>
                {submitting ? 'Đang gửi…' : 'Đã setup xong'}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function receiptConfirmationCountdown(value: string | null | undefined, now: number) {
  if (!value) return { text: null, expired: false, urgent: false }
  const remaining = new Date(value).getTime() - now
  if (!Number.isFinite(remaining)) return { text: 'Chưa xác định', expired: false, urgent: true }
  if (remaining <= 0) return { text: 'Đã quá hạn xác nhận', expired: true, urgent: true }
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  return {
    text: `Còn ${days > 0 ? `${days} ngày ` : ''}${hours > 0 ? `${hours} giờ ` : ''}${rest} phút`,
    expired: false,
    urgent: remaining <= 2 * 60 * 60_000,
  }
}

function inventoryComparison(value: string | null | undefined) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { declared?: Record<string, unknown>; actual?: Record<string, unknown> }
    if (!parsed || typeof parsed !== 'object' || !parsed.declared || !parsed.actual) return null
    return parsed
  } catch {
    return null
  }
}

function InventoryResolutionNotice({ detail, now, submitting, onResolve }: {
  detail: CustomerReservationDetail
  now: number
  submitting: boolean
  onResolve: (decision: 'ACCEPT_FULL' | 'ACCEPT_PARTIAL' | 'CANCEL_AND_RETURN', scheduledDate?: string) => void
}) {
  const resultConfirmationDeadline = detail.inventoryResultPublishedAt
    ? new Date(detail.inventoryResultPublishedAt).getTime() + 48 * 60 * 60 * 1000
    : null
  const resultConfirmationDeadlineIso = resultConfirmationDeadline == null
    ? null
    : new Date(resultConfirmationDeadline).toISOString()
  const partialAccepted = detail.inventoryResolutionStatus === 'PARTIAL_ACCEPTED'
  const returnRequested = detail.inventoryResolutionStatus === 'RETURN_REQUESTED'
  const activeDeadline = returnRequested
    ? detail.inventoryRemovalDeadlineAt
    : partialAccepted
      ? detail.inventoryRemainderDeadlineAt
      : resultConfirmationDeadlineIso || detail.inventoryFinalDeadlineAt
  const activeCountdown = inventoryDeadlineText(activeDeadline, now)
  const hasVariance = Boolean(detail.inventoryMismatchSummary) || !detail.inventoryFullFit
  const comparison = inventoryComparison(detail.inventoryMismatchJson)
  const displayValue = (value: unknown) => value == null || value === '' ? 'Chưa ghi nhận' : String(value)
  const today = policyDateInput(new Date())
  const removalFirst = detail.inventoryRemovalPublishedAt
    ? policyDateInput(new Date(new Date(detail.inventoryRemovalPublishedAt).getTime() + 86_400_000)) : today
  const removalLast = detail.inventoryRemovalDeadlineAt
    ? policyDateInput(new Date(new Date(detail.inventoryRemovalDeadlineAt).getTime() - 1)) : undefined
  const minReturnDate = removalFirst > today ? removalFirst : today
  const removalDeadline = detail.inventoryRemovalDeadlineAt
  const removalDeadlineMs = removalDeadline ? Date.parse(removalDeadline) : null
  const maxReturnDate = removalDeadlineMs == null ? undefined : policyDateInput(new Date(removalDeadlineMs - 1))
  const inventoryExpired = Boolean(detail.inventoryEscalatedAt)
    || Boolean(detail.inventoryFinalDeadlineAt && Date.parse(detail.inventoryFinalDeadlineAt) <= now)
    || (removalDeadlineMs != null && removalDeadlineMs <= now)
  const canPlanReturn = !detail.inventoryEscalatedAt
    && (removalDeadlineMs == null ? !inventoryExpired : now < removalDeadlineMs)
  const [returnDate, setReturnDate] = useState(today)
  const [returnPlannerOpen, setReturnPlannerOpen] = useState(false)
  const [partialConfirmOpen, setPartialConfirmOpen] = useState(false)
  const [returnDateError, setReturnDateError] = useState('')
  if (!['PENDING_CUSTOMER', 'PARTIAL_ACCEPTED', 'RETURN_REQUESTED'].includes(detail.inventoryResolutionStatus || '')) return null
  const confirmInventoryReturn = () => {
    if (!canPlanReturn || !returnDate || returnDate < minReturnDate || (removalLast && returnDate > removalLast)) {
      setReturnDateError('Vui lòng chọn ngày trả kho hợp lệ.')
      return
    }
    setReturnDateError('')
    setReturnPlannerOpen(false)
    onResolve('CANCEL_AND_RETURN', returnDate)
  }
  return (
    <div className={`rounded-lg border p-3 text-left text-xs ${hasVariance || activeCountdown === 'Đã quá hạn xử lý' ? 'border-red-300 bg-red-50 text-red-950' : 'border-blue-300 bg-blue-50 text-blue-950'}`}>
      <p className="font-bold">{returnRequested ? 'Đã yêu cầu trả kho do kiểm kê sai lệch' : partialAccepted ? 'Đang chờ Staff xác nhận phần hàng dư' : 'Kiểm kê cần bạn xác nhận'}</p>
      <p className="mt-1">{partialAccepted
        ? 'Bạn đã chọn nhận phần hàng có thể xếp. Vui lòng đưa phần còn lại ra khỏi gian kho và chờ Staff xác nhận bằng chứng.'
        : returnRequested
          ? 'Cơ sở đã tiếp nhận yêu cầu trả kho. Nếu lỡ lịch hẹn, bạn vẫn có thể đổi lịch trong hạn trả hàng. Hết hạn, hồ sơ chuyển sang chờ thu hồi.'
        : hasVariance ? `Nhân viên đã ghi nhận sai lệch giữa hàng thực tế và thông tin đặt kho. ${detail.inventoryMismatchSummary || 'Vui lòng chọn phương án xử lý.'}` : 'Hàng hóa đã được kiểm kê và phù hợp với khai báo. Vui lòng xem và xác nhận kết quả.'}</p>
      {returnRequested && detail.reservation.setupReturnScheduledDate && <p className="mt-1 font-semibold">Ngày hẹn trả kho: {formatDisplayDate(detail.reservation.setupReturnScheduledDate)}</p>}
      {detail.inventorySuggestedPackageCount != null && <p className="mt-1">Số kiện có thể tiếp nhận theo phương án xếp: <b>{detail.inventorySuggestedPackageCount}</b></p>}
      {comparison && (
        <div className="mt-2 grid gap-2 rounded-lg border border-red-200 bg-white/70 p-2 sm:grid-cols-2">
          <div><p className="font-semibold">Thông tin đã khai báo</p><p>Số kiện: {displayValue(comparison.declared?.packageCount)} · Khối lượng: {displayValue(comparison.declared?.weightKg)} kg · Thể tích: {displayValue(comparison.declared?.volumeM3)} m³</p><p>Loại hàng: {Array.isArray(comparison.declared?.category) ? comparison.declared?.category.join(', ') || 'Chưa ghi nhận' : displayValue(comparison.declared?.category)}</p><p>Chất liệu chính: {Array.isArray(comparison.declared?.material) ? comparison.declared?.material.join(', ') || 'Chưa ghi nhận' : displayValue(comparison.declared?.material)}</p></div>
          <div><p className="font-semibold">Thông tin kiểm kê thực tế</p><p>Số kiện: {displayValue(comparison.actual?.packageCount)} · Khối lượng: {displayValue(comparison.actual?.weightKg)} kg · Thể tích: {displayValue(comparison.actual?.volumeM3)} m³</p><p>Loại hàng: {displayValue(comparison.actual?.category)}</p><p>Chất liệu chính: {displayValue(comparison.actual?.material)}</p></div>
        </div>
      )}
      {!partialAccepted && (returnPlannerOpen || returnRequested) && <div className="mt-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-orange-950">
        <p className="font-bold">Trả kho do hàng hóa sai khai báo</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Tính tiền theo ngày lịch từ ngày nhận kho đến ngày bàn giao kho trống, tính cả hai ngày. Không cộng ngày cơ sở chậm thu hồi sau hạn trả hàng.</li>
          <li>Tiền sử dụng = đơn giá tháng × số ngày / 30, khấu trừ vào tiền đã đóng. Không thu phí chấm dứt sớm cố định.</li>
          <li>Manager duyệt bảng kê, khách xác nhận trước khi hoàn tiền hoặc thu thêm.</li>
        </ul>
        {detail.reservation.monthlyPrice != null && <p className="mt-1 font-semibold">Đơn giá tham chiếu: {formatVnd(detail.reservation.monthlyPrice)} / tháng.</p>}
      </div>}
      {activeDeadline && <p className="mt-1 font-bold">{activeCountdown || 'Hạn xử lý'} · {formatCustomerDateTime(new Date(activeDeadline))}</p>}
      {!partialAccepted && !returnRequested && !returnPlannerOpen && <div className="mt-3 flex flex-wrap justify-end gap-2">
        {detail.inventoryFullFit && <Button size="sm" disabled={submitting} onClick={() => onResolve('ACCEPT_FULL')}>Nhận toàn bộ hàng</Button>}
        {!detail.inventoryFullFit && detail.inventoryPartialFitAvailable && <Button size="sm" variant="outline" disabled={submitting || inventoryExpired} onClick={() => setPartialConfirmOpen(true)}>Chỉ nhận phần vừa kho, lấy hàng dư ra</Button>}
        {!detail.inventoryFullFit && <Button size="sm" variant="danger" disabled={submitting || !canPlanReturn} onClick={() => { setPartialConfirmOpen(false); setReturnPlannerOpen(true) }}>Tạo yêu cầu trả kho ngay</Button>}
      </div>}
      {partialConfirmOpen && !partialAccepted && !returnRequested && !returnPlannerOpen && <div className="mt-3 space-y-3 rounded-lg border border-amber-300 bg-white p-3">
        <p className="font-bold">Xác nhận chỉ nhận phần hàng vừa kho</p>
        <p>Tiếp nhận theo phương án xếp {detail.inventorySuggestedPackageCount ?? 'được nhân viên ghi nhận'} kiện. Bạn có trách nhiệm lấy phần hàng dư ra; nhân viên sẽ kiểm tra và xác nhận trước khi hoàn tất kiểm kê.</p>
        <div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" disabled={submitting} onClick={() => setPartialConfirmOpen(false)}>Quay lại</Button><Button size="sm" disabled={submitting || inventoryExpired} onClick={() => onResolve('ACCEPT_PARTIAL')}>Xác nhận nhận phần vừa kho</Button></div>
      </div>}
      {!partialAccepted && !returnRequested && returnPlannerOpen && <div className="mt-3 space-y-3 rounded-lg border border-red-300 bg-white p-3">
        <p className="font-bold text-red-950">Chọn ngày trả kho dự kiến</p>
        <VietnameseDateInput label="Ngày hẹn trả kho" value={returnDate} min={minReturnDate} max={removalLast} onChange={(value) => { setReturnDate(value); setReturnDateError('') }} />
        {removalLast && <p className="font-semibold">Hạn cuối trả hàng: {formatDisplayDate(removalLast)}. Đổi lịch không kéo dài hạn này.</p>}
        {returnDateError && <p role="alert" className="font-semibold text-red-700">{returnDateError}</p>}
        <p className="text-red-950">Ngày chọn là lịch hẹn bàn giao. Tiền dự kiến có thể thay đổi theo ngày bàn giao thực tế nhưng không cộng ngày cơ sở chậm thu hồi sau hạn. Bạn được xem và xác nhận bảng kê trước khi hoàn tiền hoặc thu thêm.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={submitting} onClick={() => setReturnPlannerOpen(false)}>Hủy</Button>
          <Button size="sm" variant="danger" disabled={submitting || !returnDate || !canPlanReturn} onClick={confirmInventoryReturn}>{submitting ? 'Đang gửi…' : 'Xác nhận yêu cầu trả kho'}</Button>
        </div>
      </div>}
    </div>
  )
}

export function InventoryLineInspectionResult({ detail }: { detail: CustomerReservationDetail }) {
  let lines: CheckInInventoryLine[] = []
  try {
    const value: unknown = detail.inventoryActualJson ? JSON.parse(detail.inventoryActualJson) : null
    if (value && typeof value === 'object' && 'lines' in value && Array.isArray(value.lines))
      lines = value.lines.filter((line): line is CheckInInventoryLine => Boolean(line && typeof line === 'object' && typeof line.goodsItemId === 'string' && typeof line.actualQuantity === 'number'))
  } catch { return null }
  if (!lines.length) return null
  return <section className="space-y-2 rounded-lg border border-stone-300 p-3 text-left text-sm">
    <h4 className="font-bold">Đối chiếu kiểm kê từng dòng hàng</h4>
    {lines.map((line, index) => {
      const declared = detail.goodsItems?.find(item => item.id === line.goodsItemId)
      const actual = line.actualGoods
      const matches = declared && actual && declared.catalogCategoryId === actual.catalogCategoryId && declared.catalogMaterialId === actual.catalogMaterialId && declared.quantity === line.actualQuantity
      return <div key={line.goodsItemId} className="space-y-1 border-t border-stone-200 pt-2">
        <p className="font-semibold">Dòng {index + 1} · {matches ? 'Khớp loại hàng, chất liệu và số kiện' : 'Xem kết quả đối chiếu thực tế'}</p>
        <p>Đã khai: {declared?.categoryName || declared?.description || 'Chưa ghi nhận'} · {declared?.materialName || declared?.customMaterial || 'Chưa ghi nhận'} · {declared?.quantity ?? 'Chưa ghi nhận'} kiện</p>
        <p>Thực tế: {line.actualQuantity === 0 ? 'Không có hàng' : `${actual?.categoryName || actual?.customGoodsName || 'Chưa ghi nhận loại hàng'} · ${actual?.materialName || actual?.customMaterial || 'Không áp dụng hoặc chưa ghi nhận chất liệu'}`} · {line.actualQuantity} kiện</p>
        {line.measurements && <p>Kích thước mỗi kiện: {line.measurements.lengthCm} × {line.measurements.widthCm} × {line.measurements.heightCm} cm · Khối lượng cả dòng: {line.measurements.weightKg} kg</p>}
        {actual && <p>Điều kiện thực tế: {actual.fragile ? 'Dễ vỡ' : 'Không dễ vỡ'} · {actual.stackable ? `Xếp chồng tối đa ${actual.maxStackLayers || 1} lớp` : 'Không xếp chồng'} · {actual.allowHorizontalPlacement ? 'Được đặt nằm ngang' : 'Giữ chiều đứng'}</p>}
        <p>Tình trạng: {line.condition === 'INTACT' ? 'Nguyên vẹn' : line.condition === 'DAMAGED' ? 'Có hư hỏng' : 'Không có kiện nào'}</p>
        {line.note && <p>Ghi nhận: {line.note}</p>}
      </div>
    })}
  </section>
}

export function PackagingInspectionResult({ detail }: { detail: CustomerReservationDetail }) {
  let actual: { packagingMethod?: string; packagingCondition?: string } | null = null
  try { actual = detail.inventoryActualJson ? JSON.parse(detail.inventoryActualJson) : null } catch { return null }
  if (!actual?.packagingMethod && !actual?.packagingCondition) return null
  const conditions: Record<string, string> = { INTACT: 'Nguyên vẹn', MINOR_DAMAGE: 'Hư hỏng nhẹ', MAJOR_DAMAGE: 'Hư hỏng nặng', UNPACKAGED: 'Chưa đóng gói' }
  const declared = detail.goodsCondition
  const mismatch = Boolean(declared && actual.packagingMethod && declared.trim().toLocaleLowerCase('vi') !== actual.packagingMethod.trim().toLocaleLowerCase('vi'))
  return <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-left text-xs text-stone-800">
    <p className="font-bold">Kết quả kiểm kê đóng gói</p>
    <p className="mt-1">Phương thức đã khai: <b>{declared || 'Chưa ghi nhận'}</b></p>
    <p className="mt-1">Phương thức thực tế: <b>{actual.packagingMethod || 'Chưa ghi nhận'}</b></p>
    {declared && actual.packagingMethod && <p className={mismatch ? 'mt-1 font-semibold text-red-700' : 'mt-1 font-semibold text-emerald-700'}>{mismatch ? 'Không khớp phương thức đã khai báo' : 'Khớp phương thức đã khai báo'}</p>}
    <p className="mt-1">Tình trạng đóng gói: <b>{conditions[actual.packagingCondition || ''] || 'Chưa ghi nhận'}</b></p>
  </div>
}

export default function CustomerReservationCard({ reservation: r, facilityName, unitTypeName, facilityDetails, unitTypeDetails, facility, unitType, onVerify, onCancel, onDelete, onRefresh, onReceiptConfirmed, onRequestSupport, visualTone = 'active' }: Props) {
  const [activeSection, setActiveSection] = useState<'information' | 'quote'>('information')
  const [detail, setDetail] = useState<CustomerReservationDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const receiptLock = useRef(false)
  const [confirmingPreparation, setConfirmingPreparation] = useState(false)
  const [resolvingInventory, setResolvingInventory] = useState(false)
  const preparationLock = useRef(false)
  const [bookingDocument, setBookingDocument] = useState<BookingDocument | null>(null)
  const [bookingDocumentOpen, setBookingDocumentOpen] = useState(false)
  const [handoverDocuments, setHandoverDocuments] = useState<CheckInDocument[]>([])
  const [handoverDocumentsOpen, setHandoverDocumentsOpen] = useState(false)
  const [paymentReceipt, setPaymentReceipt] = useState<ReservationPaymentResult | null>(null)
  const [appointmentInput, setAppointmentInput] = useState(() => localDateTimeInput(r.appointmentAt))
  const [appointmentErrors, setAppointmentErrors] = useState<{ date?: string; time?: string }>({})
  const [savedAppointmentAt, setSavedAppointmentAt] = useState(r.appointmentAt)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
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
      .catch(error => { if (!disposed) setMessage(userFacingError(error, 'Không thể tải chi tiết đơn.')) })
    return () => { disposed = true }
  }, [r.id, r.status])
  const countdown = paymentCountdown(detail?.paymentExpiresAt || r.holdExpiresAt, now)
  const receiptCountdown = receiptConfirmationCountdown(detail?.receiptConfirmationDueAt, now)
  const appointmentWindow = plannedCheckInWindow(
    r.createdAt,
    r.goodsReviewStatus !== 'NOT_REQUIRED',
  )
  const [showContact, setShowContact] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const progress = reservationProgress(r.status)
  const checkInStatus = detail?.reservation.id === r.id ? detail.checkInStatus : undefined
  const awaitingInventory = r.status === 'PREPARING' && (checkInStatus === 'setup_completed' || checkInStatus === 'completed')
  const partialInventoryPending = detail?.inventoryResolutionStatus === 'PARTIAL_ACCEPTED'
  const inventoryReturnRequested = detail?.inventoryResolutionStatus === 'RETURN_REQUESTED'
  const inventoryMismatchPending = detail?.inventoryResolutionStatus === 'PENDING_CUSTOMER' || inventoryReturnRequested
  const prepaymentPaid = detail?.payments?.some(item => item.purpose === 'RESERVATION_DEPOSIT' && item.paymentStatus === 'PAID')
    || ['CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'PREPARING', 'COMPLETED'].includes(r.status)
  const inactive = progress === null
  const remainingPayment = detail?.payments?.find(payment => payment.purpose === 'RENTAL_BALANCE' && payment.paymentStatus === 'PAID') || null
  const goodsItems = detail?.goodsItems ?? []
  const totalGoodsQuantity = goodsItems.reduce((total, item) => total + item.quantity, 0)
  const calculatedGoodsVolumeM3 = totalGoodsVolumeM3(goodsItems)
  const calculatedGoodsWeightKg = goodsItems.reduce((total, item) => total + item.quantity * item.weightPerItemKg, 0)
  const formatMeasurement = formatGoodsVolume
  const savedQuote = savedReservationQuote(detail?.reservation ?? r)
  const displayedFacility = r.facilitySnapshot || detail?.currentFacility || facilityDetails
  const displayedUnitType = r.unitTypeSnapshot || detail?.currentUnitType || unitTypeDetails
  const displayedFacilityName = r.facilitySnapshot?.name || detail?.currentFacility?.name || facilityName
  const displayedUnitTypeName = r.unitTypeSnapshot?.name || detail?.currentUnitType?.name || unitTypeName
  const beginSetupGoodsEdit = () => {
    setSetupGoodsDraft(goodsItems.map(item => ({
      catalogCategoryId: item.catalogCategoryId,
      catalogMaterialId: item.catalogMaterialId,
      categoryCode: item.categoryCode,
      categoryName: item.categoryName,
      materialCode: item.materialCode,
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
      stackable: item.stackable ?? (item.maxStackLayers ?? 1) > 1,
      maxStackLayers: item.maxStackLayers,
      allowHorizontalPlacement: item.allowHorizontalPlacement ?? false,
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
      setMessage(userFacingError(error, 'Không thể cập nhật khai báo hàng trong thời gian chuẩn bị.'))
    } finally { setBusy(false) }
  }
  const steps = [
    { label: 'Phê duyệt hồ sơ', detail: goodsReviewLabels[r.goodsReviewStatus] },
    { label: ['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) ? 'Đối soát thanh toán' : 'Thanh toán khoản trả trước 20% (giữ chỗ)', detail: r.status === 'PAYMENT_GRACE' ? 'Chờ khách hàng gửi chứng từ' : r.status === 'PAYMENT_REVIEW' ? 'Đang kiểm tra chứng từ thanh toán' : 'Hoàn tất khoản trả trước 20% (giữ chỗ)' },
    { label: 'Quản lý phân kho', detail: r.assignedUnitCode ? `Đã phân ${r.assignedUnitCode}` : 'Chờ phân gian kho cụ thể' },
    { label: 'Nhận kho và ký', detail: 'Đối chiếu và ký tại cơ sở' },
    { label: 'Đã bàn giao', detail: 'Nhận kho và mã ra vào' },
  ]
  const prepareBookingDocument = async () => {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      const result: BookingDocument = await generateBookingDocument(r.id)
      setBookingDocument(result)
      setBookingDocumentOpen(true)
    } catch (error) { setMessage(userFacingError(error, 'Không thể tạo phiếu xác nhận giữ kho.')) }
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
      setMessage(userFacingError(error, 'Không thể xem phiếu xác nhận giữ kho.'))
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
    } catch (error) { setMessage(userFacingError(error, 'Không thể tải phiếu xác nhận giữ kho.')) }
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
      setMessage(userFacingError(error, 'Không thể xác nhận nhận kho.'))
      try { await onRefresh() } catch { /* Preserve the command error if readback is also unavailable. */ }
    }
    finally { receiptLock.current = false; setConfirmingReceipt(false) }
  }
  const confirmPreparation = async () => {
    if (preparationLock.current) return
    preparationLock.current = true
    setConfirmingPreparation(true); setMessage(null)
    try {
      const updated = await markCustomerPreparationComplete(r.id, 'Khách hàng đã sắp xếp hàng và sẵn sàng để nhân viên kiểm kê.')
      setDetail(updated)
      setMessage('Đã báo sẵn sàng để kiểm kê. Nhân viên sẽ thực hiện kiểm kê hàng hóa.')
      try { await onRefresh() } catch { /* The preparation command has already succeeded. */ }
    } catch (error) {
      setMessage(userFacingError(error, 'Không thể báo đã chuẩn bị xong.'))
      try {
        const current = await getCustomerReservation(r.id)
        setDetail(current)
        if (current.checkInStatus === 'setup_completed' || current.checkInStatus === 'completed') setMessage(null)
      } catch { /* Preserve the command error if readback is also unavailable. */ }
    }
    finally { preparationLock.current = false; setConfirmingPreparation(false) }
  }
  const resolveInventoryDecision = async (decision: 'ACCEPT_FULL' | 'ACCEPT_PARTIAL' | 'CANCEL_AND_RETURN', scheduledDate?: string) => {
    if (resolvingInventory) return
    setResolvingInventory(true)
    setMessage(null)
    try {
      const updated = await resolveCustomerInventory(r.id, decision,
        decision === 'CANCEL_AND_RETURN' ? 'Khách yêu cầu xử lý trả kho do kết quả kiểm kê không phù hợp.' : undefined,
        scheduledDate)
      setDetail(updated)
      setMessage(decision === 'CANCEL_AND_RETURN'
        ? 'Đã gửi yêu cầu trả kho. Cơ sở sẽ tiếp nhận và kiểm tra hiện trạng theo quy trình trả kho.'
        : decision === 'ACCEPT_PARTIAL'
          ? 'Đã xác nhận nhận phần hàng có thể xếp trong gian kho.'
          : 'Đã xác nhận nhận toàn bộ hàng hóa.')
      try { await onRefresh() } catch { /* The resolution command has already succeeded. */ }
    } catch (error) {
      setMessage(userFacingError(error, 'Không thể ghi nhận phương án xử lý kiểm kê.'))
    } finally {
      setResolvingInventory(false)
    }
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
      errors.date = `Ngày nhận kho phải từ ${formatCustomerDate(appointmentWindow.availableAt)} đến ${formatCustomerDate(appointmentWindow.deadlineAt)}.`
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)) {
      errors.time = 'Vui lòng chọn giờ nhận kho hợp lệ.'
    } else {
      if (!errors.date && appointmentDate === earliestDate && appointment < appointmentWindow.availableAt) {
        errors.time = `Trong ngày ${formatCustomerDate(appointmentWindow.availableAt)}, giờ nhận kho sớm nhất là ${policyTimeInput(appointmentWindow.availableAt)}.`
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
    } catch (error) { setMessage(userFacingError(error, 'Không thể lưu lịch hẹn.')) }
    finally { setBusy(false) }
  }
  const loadHandoverDocuments = async () => {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      setHandoverDocuments(await getCustomerCheckInDocuments(r.id))
      setHandoverDocumentsOpen(true)
    } catch (error) { setMessage(userFacingError(error, 'Không thể tải văn bản bàn giao.')) }
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
      setMessage(userFacingError(error, 'Không thể mở văn bản bàn giao.'))
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
      setMessage(userFacingError(error, 'Không thể mở hình ảnh hàng hóa.'))
    }
  }
  const saveHandoverDocument = async (fileDocument: CheckInDocument) => {
    try {
      const file = await downloadCustomerCheckInDocument(fileDocument.id)
      const url = URL.createObjectURL(file.blob)
      const link = window.document.createElement('a')
      link.href = url; link.download = file.fileName || fileDocument.originalName; window.document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch (error) { setMessage(userFacingError(error, 'Không thể tải văn bản bàn giao.')) }
  }
  return (
  <Card
    id={`customer-reservation-${r.id}`}
    tabIndex={-1}
    className={`p-6 !border-l-8 transition-all duration-200 ${
      inactive
        ? 'border-l-stone-300 text-stone-500'
        : inventoryMismatchPending
          ? 'border-l-red-700 bg-red-50/20'
          : 'border-l-amber-500'
    } ${inventoryMismatchPending
      ? '!border-l-red-700 hover:!border-l-red-900'
      : visualTone === 'expired'
      ? '!border-l-red-400 hover:!border-l-red-700'
      : visualTone === 'completed'
        ? '!border-l-emerald-400 hover:!border-l-emerald-700'
        : '!border-l-amber-400 hover:!border-l-amber-700'}`}
  >
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-5 border-b border-stone-200 pb-4 md:flex-row">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-amber-700">{r.reservationCode}</span>
          <span className={`rounded px-2.5 py-1 text-xs font-bold ${inventoryMismatchPending ? 'bg-red-700 text-white' : awaitingInventory ? (partialInventoryPending ? 'bg-amber-100 text-amber-900' : checkInStatus === 'completed' ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900') : visualTone === 'completed' ? 'bg-emerald-700 text-white' : visualTone === 'expired' ? 'bg-red-100 text-red-900' : progress !== null && progress >= 3 ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{inventoryReturnRequested ? 'Buộc trả kho do kiểm kê sai lệch' : inventoryMismatchPending ? 'Cần xử lý sai lệch kiểm kê' : awaitingInventory ? (partialInventoryPending ? 'Chờ xử lý phần hàng dư' : checkInStatus === 'completed' ? 'Đã kiểm kê' : 'Chờ kiểm kê') : reservationStatusLabels[r.status]}</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-stone-900">{displayedUnitTypeName} · {displayedFacilityName}</h2>
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-5 text-stone-600">{savedQuote?.rentalPeriodConfirmed ? 'Kỳ thuê đã chốt:' : 'Kỳ thuê dự kiến sau thời gian chuẩn bị:'} <b className="text-stone-900">{formatDisplayDate(savedQuote?.startDate || r.startDate)} đến {formatDisplayDate(rentalEndDateForDisplay(savedQuote?.endDate || r.endDate))}</b></p>
          <p className="text-xs leading-5 text-blue-800">Lịch nhận kho khách đặt: <b>{savedAppointmentAt ? formatCustomerDateTime(new Date(savedAppointmentAt)) : 'Chưa đặt lịch'}</b></p>
        </div>
      </div>
        <div className="reservation-card-actions flex w-full min-w-0 flex-col items-end gap-2 md:w-64 md:shrink-0">
        <div className="text-right"><p className="text-xs text-stone-500">Tổng thu cả kỳ (gồm tiền cọc đảm bảo kho)</p><p className="text-xl font-bold text-stone-900">{(r.totalInitialObligation == null ? "Chưa xác định" : formatVnd(r.totalInitialObligation))}</p><p className="text-xs text-amber-800">Trả lúc giữ chỗ: {(r.reservationDepositAmount == null ? "Chưa xác định" : formatVnd(r.reservationDepositAmount))}</p></div>
        {r.status === 'AWAITING_REVIEW' && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
          <p className="font-bold">Đang chờ nhân viên cơ sở duyệt hàng hóa</p>
          <p className="mt-1">Thời gian duyệt còn lại (không phải hạn thanh toán)</p>
          <p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p>
          <p className="mt-1">Nhân viên duyệt trong tối đa {STAFF_REVIEW_HOURS} giờ từ khi gửi đơn. Sau khi được duyệt, bạn có thể thanh toán cọc.</p>
        </div>}
        <CustomerReservationPayment reservation={r} facilityName={displayedFacilityName} unitTypeName={displayedUnitTypeName} paymentStartedAt={detail?.paymentStartedAt} paymentExpiresAt={detail?.paymentExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />
        {r.status === 'AWAITING_CUSTOMER_RECEIPT' && <div className={`rounded-lg border p-3 text-right text-xs ${receiptCountdown.expired ? 'border-red-400 bg-red-50 text-red-950' : receiptCountdown.urgent ? 'border-red-300 bg-red-50/70 text-red-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
          <p className="font-bold">Nhân viên đã hoàn tất bàn giao kho trống</p>
          <p className="mt-1">Vui lòng kiểm tra kho và mã ra vào, sau đó xác nhận đã nhận kho để bắt đầu thời gian chuẩn bị.</p>
          {detail?.handoverCompletedAt && <p className="mt-1">Bàn giao lúc: <b>{formatCustomerDateTime(new Date(detail.handoverCompletedAt))}</b></p>}
          {detail?.receiptConfirmationDueAt && <p className="mt-1 font-bold">{receiptCountdown.text} · Hạn xác nhận: {formatCustomerDateTime(new Date(detail.receiptConfirmationDueAt))}</p>}
          {receiptCountdown.expired && <p className="mt-1 font-semibold">Hồ sơ đang chờ cơ sở xử lý tiếp. Bạn vẫn có thể xác nhận nhận kho hoặc liên hệ cơ sở để được hỗ trợ.</p>}
          <Button type="button" className="mt-2" size="sm" disabled={confirmingReceipt} onClick={() => void confirmReceipt()}>{confirmingReceipt ? 'Đang xác nhận…' : 'Xác nhận đã nhận kho'}</Button>
        </div>}
        {r.status === 'PREPARING' && checkInStatus !== 'setup_completed' && !detail?.inventoryEscalatedAt && <ReservationPreparationNotice checkInStatus={checkInStatus} submitting={confirmingPreparation} onReady={() => void confirmPreparation()} />}
        {checkInStatus === 'setup_completed' && !detail?.inventoryMismatchJson && detail?.inventoryFinalDeadlineAt && (
          <InventoryAppointmentPanel detail={detail} now={now} onSaved={setDetail} />
        )}
        {detail && <PackagingInspectionResult detail={detail} />}
        {detail && <InventoryLineInspectionResult detail={detail} />}
        {detail && <InventoryResolutionNotice detail={detail} now={now} submitting={resolvingInventory} onResolve={(decision, scheduledDate) => void resolveInventoryDecision(decision, scheduledDate)} />}
        {documentAvailable && <Button variant="outline" size="sm" className="reservation-action reservation-action-document min-h-10 w-full justify-center" disabled={busy} onClick={() => void prepareBookingDocument()}>{busy ? 'Đang chuẩn bị…' : 'Xem phiếu giữ kho'}</Button>}
        {handoverDocumentsAvailable && <Button variant="outline" size="sm" className="min-h-10 w-full justify-center" disabled={busy} onClick={() => void loadHandoverDocuments()}>{busy ? 'Đang tải…' : 'Xem hợp đồng đã ký'}</Button>}
        {onRequestSupport && <Button type="button" variant="outline" size="sm" className="min-h-10 w-full justify-center" onClick={onRequestSupport}>Hỗ trợ đơn này</Button>}
        {['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) && <CustomerPaymentComplaint reservation={r} complaintExpiresAt={detail?.complaintExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />}
        {APPOINTMENT_EDITABLE_STATUSES.some(status => status === r.status) && <Button variant="ghost" size="sm" className="reservation-action reservation-action-cancel" onClick={() => setCancelConfirmOpen(true)}>Hủy giữ kho</Button>}
        {['EXPIRED', 'COMPLETED'].includes(r.status) && onDelete && <Button variant="danger" size="sm" className="min-h-10 w-full justify-center" onClick={() => setDeleteConfirmOpen(true)}>Xóa đơn đặt giữ kho</Button>}
      </div>
      </div>
      <button type="button" className="text-sm font-semibold text-amber-800 underline underline-offset-4" aria-expanded={detailsOpen} aria-controls={`reservation-details-${r.id}`} onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? 'Thu gọn chi tiết' : 'Xem chi tiết đơn và báo giá'}</button>
      <div id={`reservation-details-${r.id}`} hidden={!detailsOpen} className="space-y-4">
        <div role="tablist" aria-label={`Nội dung đơn ${r.reservationCode}`} className="flex gap-2">
          <button type="button" role="tab" id={`reservation-info-tab-${r.id}`} aria-controls={`reservation-info-${r.id}`} aria-selected={activeSection === 'information'} onClick={() => setActiveSection('information')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeSection === 'information' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700'}`}>Thông tin đơn</button>
          <button type="button" role="tab" id={`reservation-quote-tab-${r.id}`} aria-controls={`reservation-quote-${r.id}`} aria-selected={activeSection === 'quote'} onClick={() => setActiveSection('quote')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeSection === 'quote' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700'}`}>Báo giá đặt kho</button>
        </div>
      <section role="tabpanel" id={`reservation-info-${r.id}`} aria-labelledby={`reservation-info-tab-${r.id}`} hidden={activeSection !== 'information'} className="w-full min-w-0">
        <div className="mt-3 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700 md:grid-cols-2">
          <section>
            <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-stone-900">Thông tin khách hàng</h3><button type="button" className="text-sm underline" onClick={() => setShowContact(!showContact)}>{showContact ? 'Ẩn liên hệ' : 'Xem liên hệ'}</button></div>
            <div className="mt-2 space-y-1"><p><b>Họ tên:</b> {r.customerName || 'Chưa cập nhật'}</p><p><b>Email:</b> {r.customerEmail ? (showContact ? r.customerEmail : r.customerEmail.replace(/^(.).*(@.*)$/, '$1•••$2')) : 'Chưa cập nhật'}</p><p><b>Số điện thoại:</b> {r.customerPhone ? (showContact ? r.customerPhone : '••••••' + r.customerPhone.slice(-4)) : 'Chưa cập nhật'}</p><p><b>CCCD/Hộ chiếu:</b> {maskIdentityDocument(r.identityDocumentNumber)}</p><p><b>Địa chỉ:</b> {r.customerAddress || 'Chưa cập nhật'}</p></div>
          </section>
          <section>
            <h3 className="font-bold text-stone-900">Thông tin kho</h3>
            <div className="mt-2 space-y-1">
              <p><b>Địa chỉ:</b> {[displayedFacility?.address, displayedFacility?.city].filter(Boolean).join(', ') || 'Chưa cập nhật'}</p>
              {displayedFacility?.phone && <p><b>Liên hệ:</b> {displayedFacility.phone}</p>}
              <p><b>Giờ hoạt động:</b> {'24/24 mỗi ngày'}</p>
              {displayedUnitType && <>
                <p><b>Kích thước kho:</b> {displayedUnitType.lengthM != null && displayedUnitType.widthM != null && displayedUnitType.heightM != null
                  ? `${displayedUnitType.lengthM.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} × ${displayedUnitType.widthM.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} × ${displayedUnitType.heightM.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} m` : 'Chưa cập nhật'}
                  {displayedUnitType.volumeM3 != null && ` · ${displayedUnitType.volumeM3.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} m³`}</p>
                {displayedUnitType.rackCount != null && <p><b>Khung:</b> {displayedUnitType.rackCount} khung{displayedUnitType.rackLengthM != null && displayedUnitType.rackWidthM != null && displayedUnitType.rackHeightM != null
                  ? ` · ${displayedUnitType.rackLengthM.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} × ${displayedUnitType.rackWidthM.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} × ${displayedUnitType.rackHeightM.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} m/khung` : ''}</p>}
                {displayedUnitType.maxLoadKg != null && <p><b>Tải trọng:</b> {displayedUnitType.maxLoadKg.toLocaleString('vi-VN')} kg</p>}
              </>}
              {r.assignedUnitCode && <p><b>Gian kho đã phân:</b> {r.assignedUnitCode}{r.assignedUnitStatus ? ` (${r.assignedUnitStatus})` : ''}</p>}
            </div>
          </section>
        </div>
        <div className="mt-3 space-y-4">
          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-stone-900">Thông tin hàng hóa đã khai báo</h3></div>{r.status === 'READY_FOR_CHECKIN' && !r.setupGoodsRevisionUsedAt && !setupGoodsEditOpen && <Button type="button" variant="outline" size="sm" disabled={!goodsItems.length || busy} onClick={beginSetupGoodsEdit}>Sửa khai báo một lần</Button>}</div>
            {!detail && <p className="mt-3 text-stone-500">Đang tải chi tiết hàng hóa…</p>}
            {detail && <>
              {setupGoodsEditOpen && <div className="mt-3 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><p className="font-bold">Cập nhật khai báo trong thời gian chuẩn bị</p><p>Đây là lần sửa duy nhất. Sau khi lưu hoặc sau khi Staff kiểm kê, hệ thống sẽ khóa khai báo.</p>{setupGoodsDraft.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:grid-cols-4"><label className="sm:col-span-2">Mô tả<input className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5" value={item.description || ''} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, description: event.target.value } : value))} /></label><label>Số lượng<input className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5" type="number" min="1" value={item.quantity} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, quantity: Number(event.target.value) } : value))} /></label><label>Cân nặng/kiện<input className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5" type="number" min="0.01" step="0.01" value={item.weightPerItemKg} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, weightPerItemKg: Number(event.target.value) } : value))} /></label><label>Dài × Rộng × Cao (cm)<span className="mt-1 flex gap-1"><input className="w-full rounded border border-stone-300 px-1 py-1.5" type="number" min="0.01" value={item.lengthCm} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, lengthCm: Number(event.target.value) } : value))} /><input className="w-full rounded border border-stone-300 px-1 py-1.5" type="number" min="0.01" value={item.widthCm} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, widthCm: Number(event.target.value) } : value))} /><input className="w-full rounded border border-stone-300 px-1 py-1.5" type="number" min="0.01" value={item.heightCm} onChange={event => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, heightCm: Number(event.target.value) } : value))} /></span></label><fieldset className="sm:col-span-2"><legend>Được phép xếp chồng?</legend><label className="mr-3"><input type="radio" checked={item.stackable === false} onChange={() => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, stackable: false } : value))} /> Không</label><label><input type="radio" checked={item.stackable === true} disabled={item.fragile} onChange={() => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, stackable: true } : value))} /> Có</label>{item.fragile && <span className="ml-2 text-amber-800">Hàng dễ vỡ chỉ được xếp một lớp.</span>}</fieldset><fieldset className="sm:col-span-2"><legend>Được phép xoay và đặt nằm ngang?</legend><label className="mr-3"><input type="radio" checked={item.allowHorizontalPlacement === false} onChange={() => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, allowHorizontalPlacement: false } : value))} /> Không</label><label><input type="radio" checked={item.allowHorizontalPlacement === true} onChange={() => setSetupGoodsDraft(current => current.map((value, i) => i === index ? { ...value, allowHorizontalPlacement: true } : value))} /> Có</label></fieldset></div>)}<div className="flex gap-2"><Button type="button" size="sm" disabled={busy} onClick={() => void saveSetupGoods()}>{busy ? 'Đang lưu…' : 'Lưu thay đổi và khóa khai báo'}</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setSetupGoodsEditOpen(false)}>Hủy</Button></div></div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng loại hàng</span><b className="mt-1 block text-base text-stone-900">{goodsItems.length}</b></div>
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng số lượng</span><b className="mt-1 block text-base text-stone-900">{totalGoodsQuantity.toLocaleString('vi-VN')} kiện</b></div>
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng kích thước cần dùng</span><b className="mt-1 block text-base text-stone-900">{formatMeasurement(calculatedGoodsVolumeM3)} m³</b></div>
                <div className="rounded-lg border border-stone-200 bg-white p-3"><span className="text-xs text-stone-500">Tổng cân nặng</span><b className="mt-1 block text-base text-stone-900">{formatMeasurement(calculatedGoodsWeightKg)} kg</b></div>
              </div>
              <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3"><b className="text-stone-900">Phương thức đóng gói chung:</b> {detail.goodsCondition || 'Không có mô tả'}</div>
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
                      <p><b>Được phép xếp chồng:</b> {item.stackable ? 'Có, hệ thống tự tính số lớp' : 'Không, giới hạn 1 lớp'}</p>
                      <p><b>Được phép đặt nằm ngang:</b> {item.allowHorizontalPlacement ? 'Có, hệ thống có thể thử các hướng đặt' : 'Không, giữ nguyên chiều đứng'}</p>
                      <div><b>Hình ảnh:</b> {item.images.length ? <span className="mt-1 flex flex-wrap gap-1.5">{item.images.map(image => <button key={image.id} type="button" className="rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-left text-[11px] text-stone-700 hover:border-amber-400 hover:bg-amber-50" onClick={() => void viewGoodsImage(image.id)}>{image.originalName}</button>)}</span> : 'Chưa có ảnh. Nên bổ sung ảnh hàng hóa làm bằng chứng đối chiếu khi nhận và trả kho.'}</div>
                      {item.customerNote && <p className="sm:col-span-2"><b>Ghi chú:</b> {item.customerNote}</p>}
                    </div>
                  </article>
                })}
              </div>
              <p className="mt-3 text-[11px] text-stone-500">Số liệu đối chiếu đã lưu: {formatMeasurement(r.totalGoodsVolumeM3)} m³ · {formatMeasurement(r.totalGoodsWeightKg)} kg.</p>
            </>}
          </section>


        </div>
        {APPOINTMENT_EDITABLE_STATUSES.some(status => status === r.status) && <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
          <h3 className="w-full text-sm font-bold">Lịch nhận kho</h3>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <div><VietnameseDateInput value={appointmentInput.split('T')[0] || ''} min={policyDateTimeInput(appointmentWindow.availableAt).slice(0, 10)} max={policyDateTimeInput(appointmentWindow.deadlineAt).slice(0, 10)}
              onChange={date => { setAppointmentInput(`${date}T${appointmentInput.split('T')[1] || '00:00'}`); setAppointmentErrors(current => ({ ...current, date: undefined })); setMessage(null) }} />
              {appointmentErrors.date && <p className="mt-1 text-xs text-red-700">{appointmentErrors.date}</p>}</div>
            <label className="block text-sm font-medium text-stone-700">Giờ nhận kho mong muốn<input aria-invalid={Boolean(appointmentErrors.time)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-normal" type="text" inputMode="numeric" placeholder="19:30" step="60" value={appointmentInput.split('T')[1] || ''}
              onChange={event => { setAppointmentInput(`${appointmentInput.split('T')[0] || ''}T${event.target.value}`); setAppointmentErrors(current => ({ ...current, time: undefined })); setMessage(null) }} />{appointmentErrors.time && <p className="mt-1 text-xs text-red-700">{appointmentErrors.time}</p>}</label>
          </div>
          <Button size="sm" disabled={!appointmentInput || busy} onClick={() => void saveAppointment()}>{busy ? 'Đang lưu…' : r.appointmentAt ? 'Đổi lịch nhận kho' : 'Lưu lịch nhận kho'}</Button>
          <span className="basis-full text-[11px]">Bạn có thể nhận kho từ {formatPolicyDateTime(appointmentWindow.availableAt)} đến {formatPolicyDateTime(appointmentWindow.deadlineAt)}. Kỳ thuê có tính tiền bắt đầu sau thời gian chuẩn bị miễn phí, tính từ ngày bàn giao thực tế. Trước bàn giao, ngày bắt đầu và kết thúc chỉ là dự kiến. Mọi thay đổi lịch sẽ được thông báo cho nhân viên tại cơ sở.</span>
          {message && <p role="status" className="basis-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
        </div>}
        {progress !== null && <div className="mt-4 border-t border-stone-200 pt-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-black">Tiến trình đơn đặt kho</p><p className="mt-0.5 text-[11px] text-stone-500">Đã hoàn thành {progress}/{steps.length} bước</p></div>{steps[progress] && <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-300">Đang thực hiện: {steps[progress].label}</span>}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{steps.map((step, index) => {
            const completed = index < progress
            const current = index === progress
            return <div key={step.label} aria-current={current ? 'step' : undefined} className={`relative rounded-xl border p-3 transition ${completed ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : current ? 'border-amber-500 bg-amber-500 text-white shadow-lg ring-2 ring-amber-200' : 'border-stone-200 bg-stone-50 text-stone-400'}`}>
              <div className="mb-2 flex items-center justify-between gap-1"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${completed ? 'bg-emerald-600 text-white' : current ? 'bg-white text-amber-700' : 'bg-stone-200 text-stone-500'}`}>{index + 1}</span><span className="text-[9px] font-bold">{completed ? 'Đã xong' : current ? 'Hiện tại' : 'Sắp tới'}</span></div><p className="text-[11px] font-bold leading-4">{step.label}</p><p className="mt-1 text-[10px] leading-4">{step.detail}</p>
            </div>
          })}</div>
        </div>}
      </section>
      <section role="tabpanel" id={`reservation-quote-${r.id}`} aria-labelledby={`reservation-quote-tab-${r.id}`} hidden={activeSection !== 'quote'} className="w-full min-w-0 space-y-4">
          {savedQuote ? <ReservationQuoteSummary quote={{ ...savedQuote, facilityName: savedQuote.facilityName || facilityName, unitTypeName: savedQuote.unitTypeName || unitTypeName }} needsReview={false} context="reservation" /> : <p role="status">{MISSING_RESERVATION_SNAPSHOT}</p>}
            {r.setupExitReviewRequired && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><b>Đang chờ Ban điều hành quyết định hoàn tiền</b><p className="mt-1 text-xs">Yêu cầu hủy/trả trong thời gian chuẩn bị không tự động hoàn tiền. Khoản hoàn và bước kiểm tra trả kho sẽ được quyết định theo tình trạng hàng thực tế.</p></div>}
            {remainingPayment && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
              <p className="font-bold">Biên lai thanh toán phần còn lại</p>
              <p className="mt-1">Đã ghi nhận {formatVnd(remainingPayment.amount)} bằng {remainingPayment.paymentMethod ? paymentMethodLabel(remainingPayment.paymentMethod) : 'phương thức tại quầy'}.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setPaymentReceipt(remainingPayment)}>Xem biên lai</Button>
            </div>}
      </section>
      </div>

    </div>
    {message && <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <Modal open={bookingDocumentOpen} onClose={() => setBookingDocumentOpen(false)} title="Phiếu xác nhận giữ kho">
      {bookingDocument && <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-bold">Phiếu xác nhận giữ kho đã được phát hành</p>
          <p className="mt-2">Đơn giữ kho: <b>{bookingDocument.reservationCode}</b></p>
          <p>Tệp: <b>{bookingDocument.fileName}</b></p>
          <p>Ngày phát hành: <b>{formatCustomerDateTime(new Date(bookingDocument.issuedAt))}</b></p>
        </div>
        <p className="text-sm text-stone-600">Phiếu ghi nhận loại kho đã giữ và khoản trả trước 20% (giữ chỗ) đã thanh toán. Đây không phải hợp đồng thuê và không xác nhận một gian kho vật lý cụ thể.</p>
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
          {prepaymentPaid
            ? `Đơn ${r.reservationCode} đã được xác nhận thanh toán khoản trả trước 20% (giữ chỗ). Hủy trước khi nhận kho không được hoàn khoản trả trước theo điều khoản đã chấp nhận. Bạn chắc chắn muốn hủy?`
            : `Bạn có chắc muốn hủy ${r.reservationCode}? Suất kho đang giữ sẽ được giải phóng. ${['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) ? 'Nếu đã thanh toán, hãy chờ đối soát hoặc liên hệ Hỗ trợ trước khi hủy.' : 'Bạn chưa thanh toán; hủy ngay không mất phí.'}`}
        </p>
        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
          <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>Quay lại</Button>
          <Button variant="danger" onClick={() => { setCancelConfirmOpen(false); onCancel() }}>Xác nhận hủy giữ kho</Button>
        </div>
      </div>
    </Modal>
    <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Xóa đơn đặt giữ kho" closeLabel="Đóng xác nhận xóa">
      <div className="space-y-5">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">Xóa đơn {r.reservationCode} khỏi danh sách đơn {r.status === 'COMPLETED' ? 'hoàn thành' : 'hết hạn'}?</p>
        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4"><Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Quay lại</Button><Button variant="danger" onClick={() => { setDeleteConfirmOpen(false); onDelete?.() }}>Xóa đơn đặt giữ kho</Button></div>
      </div>
    </Modal>
 </Card>
  )
}
