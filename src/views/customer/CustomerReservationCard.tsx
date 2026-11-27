import InventoryDecisionSummary from '../../components/InventoryDecisionSummary'
import InventoryMismatchEvidence, { parseInventoryInspectionReport } from '../staff/InventoryMismatchEvidence'
import { intakeDecisionLabels } from '../../services/inventoryDecision'
import { rentalEndDateForDisplay } from '../../domain/rentalTimeline'
import type { CheckInInventoryLine } from '../../services/checkInApi'
import { formatCustomerDate, formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { savedReservationQuote, MISSING_RESERVATION_SNAPSHOT } from '../../services/reservationSnapshot'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { downloadBookingDocument, downloadCustomerCheckInDocument, downloadCustomerReservationGoodsImage, generateBookingDocument, getCustomerCheckInDocuments, getCustomerReservation, setCustomerCheckInAppointment, type BookingDocument, type CheckInDocument, type CustomerFacility, type CustomerReservation, type CustomerReservationDetail, type CustomerUnitType } from '../../services/customerReservationApi'
import { goodsReviewLabels, paymentCountdown, reservationProgress, reservationStatusLabels } from './reservationPresentation'
import CustomerPaymentComplaint from './CustomerPaymentComplaint'
import CustomerReservationPayment from './CustomerReservationPayment'
import { paymentMethodLabel } from './paymentLabels'
import { formatPolicyDateTime, isCheckInAppointmentAllowed, plannedCheckInWindow, policyDateInput, policyDateTimeInput, policyTimeInput, STAFF_REVIEW_HOURS } from '../../domain/reservationCheckInPolicy'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import InventoryAppointmentPanel, { inventoryDeadlineText } from './InventoryAppointmentPanel'
import type { User } from '../../types'
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
  user?: User
  reservation: CustomerReservation
  facilityName: string
  unitTypeName: string
  facilityDetails?: Pick<CustomerFacility, 'address' | 'city' | 'phone' | 'accessHours'> | null
  unitTypeDetails?: Pick<CustomerUnitType, 'lengthM' | 'widthM' | 'heightM' | 'volumeM3' | 'rackCount' | 'rackLengthM' | 'rackWidthM' | 'rackHeightM' | 'maxLoadKg'> | null
  onBookAgain?: () => void
  onRequestSupport?: () => void
  facility?: Facility
  unitType?: UnitType
  onVerify: () => void
  onCancel: () => void
  onDelete?: () => void
  onRefresh: () => Promise<void>
  onOpenReturns?: () => void
  onReceiptConfirmed?: (reservationId: string) => void
  visualTone?: 'active' | 'expired' | 'completed'
}

export function ReservationPreparationNotice({ checkInStatus, submitting, onReady }: {
  checkInStatus: string | null | undefined
  submitting: boolean
  onReady: () => void
}) {
  const waitingForInventory = checkInStatus === 'setup_completed' || checkInStatus === 'completed'
  const canReportPreparation = checkInStatus === 'setup_in_progress'

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
                {submitting ? 'Đang gửi…' : 'Đã chuẩn bị xong'}
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


export function InventoryResolutionNotice({ detail, now, submitting, onResolve, onExtendReturnWindow, onOpenReturns }: {
  detail: CustomerReservationDetail
  now: number
  submitting: boolean
  onOpenReturns?: () => void
  onExtendReturnWindow?: () => void
  onResolve: (decision: 'ACCEPT_FULL' | 'CANCEL_AND_RETURN', scheduledDate?: string) => void
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
      ? null
      : resultConfirmationDeadlineIso || detail.inventoryFinalDeadlineAt
  const activeCountdown = inventoryDeadlineText(activeDeadline, now)
  const hasVariance = Boolean(detail.inventoryMismatchSummary) || !detail.inventoryFullFit
  const removalDeadline = detail.inventoryRemovalDeadlineAt
  const removalDeadlineMs = removalDeadline ? Date.parse(removalDeadline) : null
  const inventoryExpired = Boolean(detail.inventoryEscalatedAt)
    || Boolean(detail.inventoryFinalDeadlineAt && Date.parse(detail.inventoryFinalDeadlineAt) <= now)
    || (removalDeadlineMs != null && removalDeadlineMs <= now)
  const canPlanReturn = !detail.inventoryEscalatedAt
    && (removalDeadlineMs == null ? !inventoryExpired : now < removalDeadlineMs)
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false)
  if (detail.inventoryDecision) {
    return <InventoryDecisionSummary decision={detail.inventoryDecision} onOpenReturns={onOpenReturns} />
  }
  if (detail.inventoryResolutionStatus === 'PENDING_CUSTOMER' && resultConfirmationDeadline != null && now >= resultConfirmationDeadline) {
    return <p role="status" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950">
      Đã hết 48 giờ phản hồi kết quả kiểm kê. Hồ sơ chuyển sang thu hồi kho.
    </p>
  }
  if (partialAccepted && detail.checkInStatus === 'completed') return <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">Đã hoàn tất kiểm kê theo phương án tiếp nhận trước đây.</p>
  if (detail.inventoryResolutionStatus === 'TRANSFER_REQUESTED') return <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">Cơ sở đã nhận yêu cầu thu xếp chuyển hàng. Bạn có thể theo dõi tại mục hỗ trợ.</p>
  if (!['PENDING_CUSTOMER', 'PARTIAL_ACCEPTED', 'RETURN_REQUESTED'].includes(detail.inventoryResolutionStatus || '')) return null
  return (
    <div className={`rounded-lg border p-3 text-left text-xs ${hasVariance || activeCountdown === 'Đã quá hạn xử lý' ? 'border-red-300 bg-red-50 text-red-950' : 'border-blue-300 bg-blue-50 text-blue-950'}`}>
      <p className="font-bold">{returnRequested ? 'Đã yêu cầu trả kho do kiểm kê sai lệch' : partialAccepted ? 'Phương án kiểm kê cần cập nhật' : 'Kiểm kê cần bạn xác nhận'}</p>
      <p className="mt-1">{partialAccepted
        ? 'Phương án nhận một phần đã ngừng áp dụng. Vui lòng liên hệ nhân viên để chọn chuyển hàng hoặc trả kho.'
        : returnRequested
          ? 'Cơ sở đã tiếp nhận yêu cầu trả kho. Vui lòng dọn hết hàng và báo cơ sở khi sẵn sàng bàn giao. Hết hạn, hồ sơ chuyển sang chờ thu hồi.'
        : hasVariance ? `Nhân viên đã ghi nhận sai lệch giữa hàng thực tế và thông tin đặt kho. ${detail.inventoryMismatchSummary || 'Vui lòng chọn phương án xử lý.'}` : 'Hàng hóa đã được kiểm kê và phù hợp với khai báo. Vui lòng xem và xác nhận kết quả.'}</p>
      {detail.inventoryFullFit && detail.inventorySuggestedPackageCount != null && <p className="mt-1">Số kiện có thể tiếp nhận theo phương án xếp: <b>{detail.inventorySuggestedPackageCount}</b></p>}
      {(detail.inventoryReturnExtensionCount ?? 0) > 0 && <p className="mt-1 font-semibold">Đã kéo dài thời gian trả kho: {detail.inventoryReturnExtensionCount} lần.</p>}
      {!partialAccepted && !returnRequested && !confirmReturnOpen && <div className="mt-3 flex flex-wrap justify-end gap-2">
        {detail.inventoryFullFit && <Button size="sm" disabled={submitting} onClick={() => onResolve('ACCEPT_FULL')}>Nhận toàn bộ hàng</Button>}
        {!detail.inventoryFullFit && detail.inventoryReturnCanExtend && onExtendReturnWindow && (
          <Button size="sm" variant="outline" disabled={submitting} onClick={onExtendReturnWindow}>Yêu cầu kéo dài thời gian</Button>
        )}
        {!detail.inventoryFullFit && <Button size="sm" variant="danger" disabled={submitting || !canPlanReturn} onClick={() => { setConfirmReturnOpen(true) }}>Tạo yêu cầu trả kho ngay</Button>}
      </div>}
      {!partialAccepted && !returnRequested && confirmReturnOpen && <div className="mt-3 space-y-3 rounded-lg border border-red-300 bg-white p-3">
        <p className="font-bold text-red-950">Xác nhận gửi yêu cầu trả kho</p>
        <p className="text-red-950">Vui lòng dọn hết hàng trong thời hạn trả kho và báo cơ sở khi sẵn sàng bàn giao.</p>
        <div className="flex flex-wrap justify-end gap-2">
          {detail.inventoryReturnCanExtend && onExtendReturnWindow && (
            <Button size="sm" variant="outline" disabled={submitting} onClick={onExtendReturnWindow}>Yêu cầu kéo dài thời gian</Button>
          )}
          <Button size="sm" variant="outline" disabled={submitting} onClick={() => setConfirmReturnOpen(false)}>Hủy</Button>
          <Button size="sm" variant="danger" disabled={submitting || !canPlanReturn} onClick={() => { setConfirmReturnOpen(false); onResolve('CANCEL_AND_RETURN') }}>{submitting ? 'Đang gửi…' : 'Xác nhận yêu cầu trả kho'}</Button>
        </div>
      </div>}
    </div>
  )
}

type InspectionDetail = {
  inventoryActualJson?: string | null
  acceptedQuantitiesJson?: string | null
  suggestedQuantitiesJson?: string | null
  goodsItems?: { id: string; categoryName?: string | null; materialName?: string | null; description?: string | null; customMaterial?: string | null; catalogCategoryId?: string | null; catalogMaterialId?: string | null; quantity: number }[]
}
export function InventoryLineInspectionResult({ detail, presentation = 'detail' }: { detail: InspectionDetail; presentation?: 'detail' | 'spreadsheet' }) {
  let lines: CheckInInventoryLine[] = []
  try {
    const value: unknown = detail.inventoryActualJson ? JSON.parse(detail.inventoryActualJson) : null
    if (value && typeof value === 'object' && 'lines' in value && Array.isArray(value.lines))
      lines = value.lines.filter((line): line is CheckInInventoryLine => Boolean(line && typeof line === 'object' && typeof line.goodsItemId === 'string' && typeof line.actualQuantity === 'number'))
  } catch { return null }
  if (!lines.length) return null
  let retained: Record<string, number> | null = null
  try { retained = JSON.parse(detail.acceptedQuantitiesJson || 'null') } catch { /* Older records may lack per-line quantities. */ }
  if (presentation === 'spreadsheet') return <section className="space-y-3 text-left text-sm">
    <div>
      <h4 className="font-bold">Bảng đối chiếu kiểm kê</h4>
      <p className="mt-1 text-xs text-stone-600">Mỗi dòng là một loại hàng đã kiểm kê. Thông tin được gộp theo nhóm để bảng luôn nằm gọn trong khung.</p>
    </div>
    <div className="rounded-md border border-stone-200">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[33%]" />
          <col className="w-[12%]" />
          <col className="w-[23%]" />
          <col className="w-[25%]" />
        </colgroup>
        <thead className="bg-stone-100 text-left text-stone-700">
          <tr>
            {['Dòng', 'Hàng hóa', 'Thực tế', 'Quy cách', 'Tình trạng / ghi chú'].map(label => <th key={label} scope="col" className="border-b border-r border-stone-200 px-2 py-2 font-semibold break-words last:border-r-0">{label}</th>)}
          </tr>
        </thead>
        <tbody className="text-stone-900">
          {lines.map((line, index) => {
            const declared = detail.goodsItems?.find(item => item.id === line.goodsItemId)
            const actual = line.actualGoods
            const actualName = line.actualQuantity === 0 ? 'Không có hàng' : actual?.categoryName || actual?.customGoodsName || 'Chưa ghi nhận'
            const actualMaterial = actual?.customMaterial || actual?.materialName
            const dimensions = line.measurements ? `${line.measurements.lengthCm} × ${line.measurements.widthCm} × ${line.measurements.heightCm} cm` : 'Chưa ghi nhận'
            const weight = line.measurements?.weightKg == null ? 'Chưa ghi nhận' : `${line.measurements.weightKg} kg/dòng`
            const condition = line.condition === 'INTACT' ? 'Nguyên vẹn' : line.condition === 'DAMAGED' ? 'Có hư hỏng' : 'Không có kiện nào'
            return <tr key={line.goodsItemId} className="odd:bg-white even:bg-stone-50/70 align-top">
              <th scope="row" className="border-b border-r border-stone-200 px-2 py-2.5 text-left font-semibold break-words">{index + 1}</th>
              <td className="border-b border-r border-stone-200 px-2 py-2.5 break-words"><span className="block font-medium">{declared?.categoryName || declared?.description || 'Chưa ghi nhận'}</span><span className="mt-1 block text-stone-500">Khai: {declared?.materialName || declared?.customMaterial || '–'} · {declared?.quantity ?? '–'} kiện</span><span className="mt-1 block">Thực tế: {actualName}</span><span className="mt-1 block text-stone-500">{actualMaterial || 'Chưa ghi nhận'}</span></td>
              <td className="border-b border-r border-stone-200 px-2 py-2.5 break-words tabular-nums">{line.actualQuantity}<span className="block text-stone-500">kiện</span></td>
              <td className="border-b border-r border-stone-200 px-2 py-2.5 break-words"><span className="block">{dimensions}</span><span className="mt-1 block text-stone-500">{weight}</span></td>
              <td className="border-b border-stone-200 px-2 py-2.5 break-words"><span className="block font-medium">{condition}</span><span className="mt-1 block whitespace-pre-wrap text-stone-600">{line.note || 'Không có ghi chú'}</span></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  </section>
  return <section className="space-y-2 rounded-lg border border-stone-300 p-3 text-left text-sm">
    <h4 className="font-bold">Đối chiếu kiểm kê từng dòng hàng</h4>
    {lines.map((line, index) => {
      const declared = detail.goodsItems?.find(item => item.id === line.goodsItemId)
      const actual = line.actualGoods
      const matches = declared?.catalogCategoryId && actual && declared.catalogCategoryId === actual.catalogCategoryId && declared.catalogMaterialId === actual.catalogMaterialId && declared.quantity === line.actualQuantity
      return <div key={line.goodsItemId} className="space-y-1 border-t border-stone-200 pt-2">
        <p className="font-semibold">Dòng {index + 1} · {matches ? 'Khớp loại hàng, chất liệu và số kiện' : 'Xem kết quả đối chiếu thực tế'}</p>
        <p>Đã khai: {declared?.categoryName || declared?.description || 'Chưa ghi nhận'} · {declared?.materialName || declared?.customMaterial || 'Chưa ghi nhận'} · {declared?.quantity ?? 'Chưa ghi nhận'} kiện</p>
        <dl className="divide-y divide-stone-100">
          {[
            ['Loại hàng thực tế', line.actualQuantity === 0 ? 'Không có hàng' : actual?.categoryName || actual?.customGoodsName],
            ['Chất liệu chính', actual?.customMaterial || actual?.materialName],
            ['Mô tả hàng hóa', actual?.description],
            ['Số lượng thực tế', line.actualQuantity],
            ...(retained ? [['Số kiện giữ lại', retained[line.goodsItemId] ?? 0], ['Số kiện đưa ra', Math.max(0, line.actualQuantity - (retained[line.goodsItemId] ?? 0))]] : []),
            ['Chiều dài mỗi kiện', line.measurements && line.measurements.lengthCm + ' cm'],
            ['Chiều rộng mỗi kiện', line.measurements && line.measurements.widthCm + ' cm'],
            ['Chiều cao mỗi kiện', line.measurements && line.measurements.heightCm + ' cm'],
            ['Khối lượng mỗi kiện', actual && actual.weightPerItemKg != null ? actual.weightPerItemKg + ' kg' : null],
            ['Khối lượng cả dòng', line.measurements && line.measurements.weightKg + ' kg'],
            ['Dễ vỡ', actual ? (actual.fragile ? 'Có' : 'Không') : null],
            ['Được xếp chồng', actual?.stackable == null ? null : actual.stackable ? 'Có' : 'Không'],
            ...(actual?.stackable ? [['Số lớp xếp tối đa', actual.maxStackLayers]] : []),
            ['Được xoay và đặt nằm ngang', actual?.allowHorizontalPlacement == null ? null : actual.allowHorizontalPlacement ? 'Có' : 'Không'],
            ['Tình trạng hàng hóa', line.condition === 'INTACT' ? 'Nguyên vẹn' : line.condition === 'DAMAGED' ? 'Có hư hỏng' : line.condition === 'NOT_PRESENT' ? 'Không có kiện nào' : null],
            ['Ghi chú kiểm kê', line.note],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4">
              <dt className="font-medium text-stone-600">{label}</dt>
              <dd className="whitespace-pre-wrap break-words">{value || (value === 0 ? 0 : 'Chưa ghi nhận')}</dd>
            </div>
          ))}
        </dl>
      </div>
    })}
  </section>
}

export function PackagingInspectionResult({ detail }: { detail: { inventoryActualJson?: string | null; goodsCondition?: string | null } }) {
  let actual: { packagingMethod?: string; packagingCondition?: string } | null = null
  try { actual = detail.inventoryActualJson ? JSON.parse(detail.inventoryActualJson) : null } catch { return null }
  if (!actual?.packagingMethod && !actual?.packagingCondition) return null
  const conditions: Record<string, string> = { INTACT: 'Nguyên vẹn', MINOR_DAMAGE: 'Hư hỏng nhẹ', MAJOR_DAMAGE: 'Hư hỏng nặng', UNPACKAGED: 'Chưa đóng gói' }
  const declared = detail.goodsCondition
  const mismatch = Boolean(declared && actual.packagingMethod && declared.trim().toLocaleLowerCase('vi') !== actual.packagingMethod.trim().toLocaleLowerCase('vi'))
  return <div className="text-left text-xs text-stone-800">
    <p className="font-bold">Kết quả kiểm kê đóng gói</p>
    <p className="mt-1">Phương thức đã khai: <b>{declared || 'Chưa ghi nhận'}</b></p>
    <p className="mt-1">Phương thức thực tế: <b>{actual.packagingMethod || 'Chưa ghi nhận'}</b></p>
    {declared && actual.packagingMethod && <p className={mismatch ? 'mt-1 font-semibold text-red-700' : 'mt-1 font-semibold text-emerald-700'}>{mismatch ? 'Không khớp phương thức đã khai báo' : 'Khớp phương thức đã khai báo'}</p>}
    <p className="mt-1">Tình trạng đóng gói: <b>{conditions[actual.packagingCondition || ''] || 'Chưa ghi nhận'}</b></p>
  </div>
}

type CheckInDocumentSection = 'contract' | 'records'

export default function CustomerReservationCard({ user, reservation: r, facilityName, unitTypeName, facilityDetails, unitTypeDetails, facility, unitType, onVerify, onCancel, onDelete, onRefresh, onReceiptConfirmed, onOpenReturns, onRequestSupport, onBookAgain, visualTone = 'active' }: Props) {
  const [receiptSlot, setReceiptSlot] = useState<HTMLDivElement | null>(null)
  const [activeSection, setActiveSection] = useState<'information' | 'quote'>('information')
  const [detail, setDetail] = useState<CustomerReservationDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const receiptLock = useRef(false)
  const [bookingDocument, setBookingDocument] = useState<BookingDocument | null>(null)
  const [bookingDocumentOpen, setBookingDocumentOpen] = useState(false)
  const [bookingPdfUrl, setBookingPdfUrl] = useState<string | null>(null)
  const [handoverDocuments, setHandoverDocuments] = useState<CheckInDocument[]>([])
  const [documentSection, setDocumentSection] = useState<CheckInDocumentSection | null>(null)
  const [appointmentInput, setAppointmentInput] = useState(() => localDateTimeInput(r.appointmentAt))
  const [appointmentErrors, setAppointmentErrors] = useState<{ date?: string; time?: string }>({})
  const [savedAppointmentAt, setSavedAppointmentAt] = useState(r.appointmentAt)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => () => {
    if (bookingPdfUrl) URL.revokeObjectURL(bookingPdfUrl)
  }, [bookingPdfUrl])
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
    const load = (initial = false) => {
      if (!initial && document.visibilityState === 'hidden') return
      void getCustomerReservation(r.id).then(value => { if (!disposed) setDetail(value) })
        .catch(error => { if (!disposed && initial) setMessage(userFacingError(error, 'Không thể tải chi tiết đơn.')) })
    }
    load(true)
    const timer = window.setInterval(() => load(), 15_000)
    const focus = () => load()
    window.addEventListener('focus', focus)
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', focus) }
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
  const checkInStatus = detail?.reservation?.id === r.id ? detail.checkInStatus : undefined
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
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      const file = await downloadBookingDocument(r.id)
      setBookingPdfUrl(URL.createObjectURL(file.blob))
    } catch (error) {
      setMessage(userFacingError(error, 'Không thể xem phiếu xác nhận giữ kho.'))
    } finally { setBusy(false) }
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

  const documentAvailable = ['CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'COMPLETED'].includes(r.status)
  const handoverDocumentsAvailable = Boolean(detail?.handoverCompletedAt)
    || ['AWAITING_CUSTOMER_RECEIPT', 'PREPARING', 'COMPLETED'].includes(r.status)
  const recordsAvailable = handoverDocumentsAvailable || Boolean(detail?.inventoryActualJson || detail?.inventoryDecision)
  const inspectionReport = documentSection === 'records' ? parseInventoryInspectionReport(detail?.inventoryActualJson) : null
  const decisionEvidence = new Set(detail?.inventoryDecision?.evidenceReferences)
  const inspectionEvidence = new Set(inspectionReport?.evidenceReferences)
  const documentGroups = documentSection === 'records' ? [
    { key: 'handover', title: 'Biên bản bàn giao', empty: 'Chưa có biên bản bàn giao đã lưu.',
      files: handoverDocuments.filter(document => document.kind === 'SIGNED_HANDOVER_RECORD' || document.kind === 'HANDOVER_EVIDENCE') },
    { key: 'inventory', title: 'Biên bản kiểm kê', empty: 'Chưa có biên bản kiểm kê đã lưu.',
      files: handoverDocuments.filter(document => document.kind === 'INVENTORY_EVIDENCE'
      || document.kind === 'INVENTORY_DECISION_EVIDENCE' || decisionEvidence.has(document.id) || inspectionEvidence.has(document.id)
      ) },
  ] : [{ key: 'contract', title: null, empty: 'Chưa có văn bản bàn giao được tải lên.', files: handoverDocuments }]
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
  const loadHandoverDocuments = async (section: CheckInDocumentSection) => {
    if (busy) return
    setDocumentSection(section)
    setHandoverDocuments([])
    setBusy(true); setMessage(null)
    try {
      setHandoverDocuments(await getCustomerCheckInDocuments(r.id))
    } catch (error) { setMessage(userFacingError(error, 'Không thể tải tài liệu của đơn giữ kho.')) }
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
    className={`p-5 transition-all duration-200 border border-stone-200 bg-white rounded-xl shadow-xs hover:shadow-md ${
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
    <div className="space-y-4">
      {/* Hàng định danh: Mã đơn & thông tin kho/ổ khóa bên trái, Trạng thái đưa ra phải cùng */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-amber-700">{r.reservationCode}</span>
          {r.assignedUnitCode && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">
              Gian kho đã phân: <span className="font-mono">{r.assignedUnitCode}</span>
            </span>
          )}
          {detail?.lockReference && r.status !== 'AWAITING_CUSTOMER_RECEIPT' && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-950">
              Mã ổ khóa đã bàn giao: <span className="font-mono">{detail.lockReference}</span>
            </span>
          )}
          {prepaymentPaid && r.status !== 'COMPLETED' && r.status !== 'AWAITING_CUSTOMER_RECEIPT' && (
            <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
              Đã cọc 20%
            </span>
          )}
        </div>
        <span className={`rounded px-2.5 py-1 text-xs font-bold shrink-0 ${inventoryMismatchPending ? 'bg-red-700 text-white' : awaitingInventory ? (partialInventoryPending ? 'bg-amber-100 text-amber-900' : checkInStatus === 'completed' ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900') : visualTone === 'completed' ? 'bg-emerald-700 text-white' : visualTone === 'expired' ? 'bg-red-100 text-red-900' : progress !== null && progress >= 3 ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{detail?.inventoryDecision ? intakeDecisionLabels[detail.inventoryDecision.outcome] : detail?.inventoryResolutionStatus === 'TRANSFER_REQUESTED' ? 'Chờ thu xếp chuyển hàng' : inventoryReturnRequested ? 'Buộc trả kho do kiểm kê sai lệch' : inventoryMismatchPending ? 'Cần xử lý sai lệch kiểm kê' : awaitingInventory ? (partialInventoryPending ? (checkInStatus === 'completed' ? 'Đã kiểm kê theo phương án cũ' : 'Chờ xử lý lại kết quả kiểm kê') : checkInStatus === 'completed' ? 'Đã kiểm kê' : 'Chờ kiểm kê') : reservationStatusLabels[r.status]}</span>
      </div>

      <div className="flex flex-col items-start justify-between gap-5 border-b border-stone-200 pb-4 md:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className="mt-1 text-lg font-bold text-stone-900">{displayedUnitTypeName} · {displayedFacilityName}</h2>
          <div className="mt-3 space-y-2">
            <p className="text-xs leading-5 text-stone-600">{savedQuote?.rentalPeriodConfirmed ? 'Kỳ thuê có tính phí (đã chốt):' : 'Kỳ thuê có tính phí (dự kiến):'} <b className="text-stone-900">{formatDisplayDate(savedQuote?.startDate || r.startDate)} đến {formatDisplayDate(rentalEndDateForDisplay(savedQuote?.endDate || r.endDate))}</b></p>
            <p className="text-xs leading-5 text-blue-800">Lịch hẹn đến nhận kho: <b>{savedAppointmentAt ? formatCustomerDateTime(new Date(savedAppointmentAt)) : 'Chưa đặt lịch'}</b></p>
          </div>
          {r.status === 'AWAITING_CUSTOMER_RECEIPT' && <p className="mt-3 text-sm text-stone-600">Staff đã lưu bàn giao. Hệ thống đang cập nhật hồ sơ chuẩn bị hàng; bạn không cần xác nhận nhận kho.</p>}
          <CustomerReservationPayment receiptSlot={receiptSlot} remainingPayment={remainingPayment} attendanceDeadline={detail?.attendance?.deadline} handoverTermsVersion={detail?.attendance?.termsVersion} reservation={r} facilityName={displayedFacilityName} unitTypeName={displayedUnitTypeName} paymentStartedAt={detail?.paymentStartedAt} paymentExpiresAt={detail?.paymentExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />
          {r.violationRecovery && <p className="mt-3 text-sm font-medium text-amber-900">Mở mục Thu hồi kho để xem tiến độ và phản hồi.</p>}
          {inventoryReturnRequested && onOpenReturns && <Button className="mt-3" type="button" size="sm" variant="outline" onClick={onOpenReturns}>Theo dõi trả kho</Button>}
        </div>
        <div className="reservation-card-actions flex w-full min-w-0 flex-col items-end gap-2 md:w-64 md:shrink-0">
          <div className="text-right"><p className="text-xs text-stone-500">Tổng thu cả kỳ (gồm tiền cọc đảm bảo kho)</p><p className="text-xl font-bold text-stone-900">{(r.totalInitialObligation == null ? "Chưa xác định" : formatVnd(r.totalInitialObligation))}</p><p className="text-xs text-amber-800">Trả lúc giữ chỗ: {(r.reservationDepositAmount == null ? "Chưa xác định" : formatVnd(r.reservationDepositAmount))}</p></div>
          {r.status === 'AWAITING_REVIEW' && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
            <p className="font-bold">Đang chờ nhân viên cơ sở duyệt hàng hóa</p>
            <p className="mt-1">Thời gian duyệt còn lại (không phải hạn thanh toán)</p>
            <p role="timer" className="mt-1 text-xl font-extrabold tabular-nums">{countdown.text}</p>
            <p className="mt-1">Nhân viên duyệt trong tối đa {STAFF_REVIEW_HOURS} giờ từ khi gửi đơn. Sau khi được duyệt, bạn có thể thanh toán cọc.</p>
          </div>}
          {detail?.attendance && ['UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(r.status) && (!checkInStatus || checkInStatus === 'scheduled') && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold">{detail.attendance.arrivalUnderReview ? 'Quản lý cơ sở đang đối soát giờ đến của bạn' : detail.attendance.arrivedAt ? 'Cơ sở đã ghi nhận bạn đến nhận kho' : 'Đến nhận kho và mang theo CCCD gốc'}</p>
              {detail.attendance.deadline && <p>Hạn tiếp nhận: {formatCustomerDateTime(new Date(detail.attendance.deadline))}</p>}
            </div>
          )}
          {detail?.attendance?.completionDeadline && r.status === 'READY_FOR_CHECKIN' && <p>Hạn hoàn tất bàn giao: {formatCustomerDateTime(new Date(detail.attendance.completionDeadline))}</p>}
          {detail?.cancellationType === 'HANDOVER_COMPLETION_TIMEOUT' && <p>Đơn đã hủy do quá hạn 72 giờ để hoàn tất bàn giao. Cơ sở sẽ đối soát các khoản đã thu.</p>}
          {detail?.cancellationType === 'HANDOVER_ATTENDANCE_TIMEOUT' && <div className="rounded-lg border border-stone-200 p-3 text-sm">
            <p><b>Đơn đã hủy.</b> {detail.cancelReason}. Khoản giữ chỗ không hoàn lại: {formatVnd(detail.cancellationChargeAmount ?? 0)}.</p>
            {onBookAgain && <Button className="mt-2" size="sm" onClick={onBookAgain}>Đặt kho mới</Button>}
          </div>}
          {detail?.cancellationType === 'HANDOVER_IDENTITY_MISMATCH' && <div className="rounded-lg border border-stone-200 p-3 text-sm">
            <p className="font-semibold">Bàn giao bị từ chối do CCCD vượt giới hạn điều chỉnh.</p>
            <p>Khoản giữ chỗ không hoàn lại: {formatVnd(detail.cancellationChargeAmount ?? 0)}.</p>
            {onBookAgain && <Button className="mt-2" size="sm" onClick={onBookAgain}>Đặt kho mới</Button>}
          </div>}
          <div ref={setReceiptSlot} className="reservation-receipt-slot contents" />
          {r.status === 'PREPARING' && <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-left text-xs text-violet-950">Đơn đã bàn giao sang <b>Hồ sơ thuê</b>. Vui lòng thực hiện xác nhận chuẩn bị, chọn lịch kiểm kê và cập nhật hồ sơ sau kiểm kê tại mục <b>Hồ sơ thuê</b>.</p>}
          {documentAvailable && <Button variant="outline" size="sm" className="reservation-action reservation-action-document min-h-10 w-full justify-center" disabled={busy} onClick={() => void prepareBookingDocument()}>{busy ? 'Đang chuẩn bị…' : 'Xem phiếu giữ kho'}</Button>}
          {handoverDocumentsAvailable && <Button variant="outline" size="sm" className="min-h-10 w-full justify-center" disabled={busy} onClick={() => void loadHandoverDocuments('contract')}>Xem hợp đồng đã ký</Button>}
          {recordsAvailable && <Button variant="outline" size="sm" className="min-h-10 w-full justify-center" disabled={busy} onClick={() => void loadHandoverDocuments('records')}>Xem biên bản</Button>}
          {onRequestSupport && <Button type="button" variant="outline" size="sm" className="min-h-10 w-full justify-center" onClick={onRequestSupport}>Hỗ trợ đơn này</Button>}
          {['PAYMENT_GRACE', 'PAYMENT_REVIEW'].includes(r.status) && <CustomerPaymentComplaint reservation={r} complaintExpiresAt={detail?.complaintExpiresAt} now={now} onMessage={setMessage} onRefresh={onRefresh} />}
          {APPOINTMENT_EDITABLE_STATUSES.some(status => status === r.status) && <Button variant="ghost" size="sm" className="reservation-action reservation-action-cancel" onClick={() => setCancelConfirmOpen(true)}>Hủy giữ kho</Button>}
          {['EXPIRED', 'COMPLETED'].includes(r.status) && onDelete && <Button variant="danger" size="sm" className="min-h-10 w-full justify-center" onClick={() => setDeleteConfirmOpen(true)}>Xóa đơn đặt giữ kho</Button>}
        </div>
      </div>
      <button type="button" className="text-sm font-semibold text-amber-800 underline underline-offset-4" aria-expanded={detailsOpen} aria-controls={`reservation-details-${r.id}`} onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? 'Thu gọn chi tiết' : 'Xem chi tiết đơn và báo giá'}</button>
      <div id={`reservation-details-${r.id}`} hidden={!detailsOpen} className="mt-4 border-t border-stone-100 pt-4 space-y-4">
        <div role="tablist" aria-label={`Nội dung đơn ${r.reservationCode}`} className="flex gap-2">
          <button type="button" role="tab" id={`reservation-info-tab-${r.id}`} aria-controls={`reservation-info-${r.id}`} aria-selected={activeSection === 'information'} onClick={() => setActiveSection('information')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeSection === 'information' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700'}`}>Thông tin đơn</button>
          <button type="button" role="tab" id={`reservation-quote-tab-${r.id}`} aria-controls={`reservation-quote-${r.id}`} aria-selected={activeSection === 'quote'} onClick={() => setActiveSection('quote')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeSection === 'quote' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700'}`}>Báo giá đặt kho</button>
        </div>
      <section role="tabpanel" id={`reservation-info-${r.id}`} aria-labelledby={`reservation-info-tab-${r.id}`} hidden={activeSection !== 'information'} className="w-full min-w-0">
        <div className="mt-3 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700 md:grid-cols-2">
          <section>
            <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-stone-900">Thông tin khách hàng</h3><button type="button" className="text-sm underline" onClick={() => setShowContact(!showContact)}>{showContact ? 'Ẩn liên hệ' : 'Xem liên hệ'}</button></div>
            <div className="mt-2 space-y-1">
              <p><b>Họ tên:</b> {r.customerName || 'Chưa cập nhật'}</p>
              <p><b>Email:</b> {r.customerEmail ? (showContact ? r.customerEmail : r.customerEmail.replace(/^(.).*(@.*)$/, '$1•••$2')) : 'Chưa cập nhật'}</p>
              <p><b>Số điện thoại:</b> {r.customerPhone ? (showContact ? r.customerPhone : '••••••' + r.customerPhone.slice(-4)) : 'Chưa cập nhật'}</p>
              <p><b>CCCD/Hộ chiếu:</b> {maskIdentityDocument(detail?.reservation.identityDocumentNumber ?? r.identityDocumentNumber)}</p>
              {detail?.identityCorrectedAtHandover && <p className="text-xs font-medium text-stone-600">CCCD đã được sửa khi bàn giao.</p>}
              <p><b>Địa chỉ:</b> {r.customerAddress || 'Chưa cập nhật'}</p>
            </div>
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
              {r.assignedUnitCode && <p><b>Gian kho đã phân:</b> {r.assignedUnitCode}</p>}
              {detail?.lockReference && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left">
                  <span className="font-semibold text-amber-950">Mã ổ khóa đã bàn giao</span>
                  <b className="font-mono text-base tracking-wider text-amber-900">{detail.lockReference}</b>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-3 space-y-4">
          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            <h3 className="text-sm font-bold text-stone-900">Thông tin hàng hóa đã khai báo</h3>
            {!detail && <p className="mt-3 text-stone-500">Đang tải chi tiết hàng hóa…</p>}
            {detail && <>
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
                      <div><b>Hình ảnh:</b> {item.images?.length ? <span className="mt-1 flex flex-wrap gap-1.5">{item.images.map(image => <button key={image.id} type="button" className="rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-left text-[11px] text-stone-700 hover:border-amber-400 hover:bg-amber-50" onClick={() => void viewGoodsImage(image.id)}>{image.originalName}</button>)}</span> : 'Chưa có ảnh. Nên bổ sung ảnh hàng hóa làm bằng chứng đối chiếu khi nhận và trả kho.'}</div>
                      {item.customerNote && <p className="sm:col-span-2"><b>Ghi chú:</b> {item.customerNote}</p>}
                    </div>
                  </article>
                })}
              </div>
              <p className="mt-3 text-[11px] text-stone-500">Số liệu đối chiếu đã lưu: {formatMeasurement(r.totalGoodsVolumeM3)} m³ · {formatMeasurement(r.totalGoodsWeightKg)} kg.</p>
            </>}
          </section>


        </div>
        {APPOINTMENT_EDITABLE_STATUSES.some(status => status === r.status) && !(detail?.attendance && r.appointmentAt && (Date.parse(r.appointmentAt) <= now || detail.attendance.arrivedAt)) && <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
          <h3 className="w-full text-sm font-bold">Lịch nhận kho</h3>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <div><VietnameseDateInput value={appointmentInput.split('T')[0] || ''} min={policyDateTimeInput(appointmentWindow.availableAt).slice(0, 10)} max={policyDateTimeInput(appointmentWindow.deadlineAt).slice(0, 10)}
              onChange={date => { setAppointmentInput(`${date}T${appointmentInput.split('T')[1] || '00:00'}`); setAppointmentErrors(current => ({ ...current, date: undefined })); setMessage(null) }} />
              {appointmentErrors.date && <p className="mt-1 text-xs text-red-700">{appointmentErrors.date}</p>}</div>
            <label className="block text-sm font-medium text-stone-700">Giờ nhận kho mong muốn<input aria-invalid={Boolean(appointmentErrors.time)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-normal" type="text" inputMode="numeric" placeholder="19:30" step="60" value={appointmentInput.split('T')[1] || ''}
              onChange={event => { setAppointmentInput(`${appointmentInput.split('T')[0] || ''}T${event.target.value}`); setAppointmentErrors(current => ({ ...current, time: undefined })); setMessage(null) }} />{appointmentErrors.time && <p className="mt-1 text-xs text-red-700">{appointmentErrors.time}</p>}</label>
          </div>
          <Button size="sm" disabled={!appointmentInput || busy} onClick={() => void saveAppointment()}>{busy ? 'Đang lưu…' : r.appointmentAt ? 'Đổi lịch nhận kho' : 'Lưu lịch nhận kho'}</Button>
          <span className="basis-full text-[11px]">Bạn có thể nhận kho từ {formatPolicyDateTime(appointmentWindow.availableAt)} đến {formatPolicyDateTime(appointmentWindow.deadlineAt)}. Ngày bắt đầu tính tiền thuê = ngày hẹn nhận kho + số ngày chuẩn bị miễn phí theo gói thuê. Trước khi bàn giao, ngày bắt đầu và kết thúc sẽ được tính lại theo lịch đã chọn. Mọi thay đổi lịch sẽ được thông báo cho nhân viên tại cơ sở.</span>
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
          {savedQuote ? <ReservationQuoteSummary quote={{ ...savedQuote, facilityName: savedQuote.facilityName || facilityName, unitTypeName: savedQuote.unitTypeName || unitTypeName }} needsReview={false} context="reservation" handoverTermsVersion={detail?.attendance?.termsVersion} /> : <p role="status">{MISSING_RESERVATION_SNAPSHOT}</p>}
            {r.setupExitReviewRequired && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><b>Đang chờ Ban điều hành quyết định hoàn tiền</b><p className="mt-1 text-xs">Yêu cầu hủy/trả trong thời gian chuẩn bị không tự động hoàn tiền. Khoản hoàn và bước kiểm tra trả kho sẽ được quyết định theo tình trạng hàng thực tế.</p></div>}
            {remainingPayment && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
              <p className="font-bold">Biên lai thanh toán phần còn lại</p>
              <p className="mt-1">Đã ghi nhận {formatVnd(remainingPayment.amount)} bằng {remainingPayment.paymentMethod ? paymentMethodLabel(remainingPayment.paymentMethod) : 'phương thức tại quầy'}.</p>
              <p className="mt-2 text-[11px] text-emerald-800">Mở nút “Xem biên lai thanh toán” ở phần đầu đơn để chọn biên lai cần xem.</p>
            </div>}
      </section>
      </div>

    </div>
    {message && <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <Modal size="2xl" open={bookingDocumentOpen} onClose={() => setBookingDocumentOpen(false)} title="Phiếu xác nhận giữ kho">
      {bookingDocument && <div className="space-y-5 py-1">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-950 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
            <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Phiếu xác nhận giữ kho đã được phát hành
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-stone-700 bg-white/80 p-4 rounded-xl border border-emerald-100">
            <div>
              <span className="text-xs text-stone-500 block">Đơn giữ kho</span>
              <span className="font-mono font-bold text-stone-900">{bookingDocument.reservationCode}</span>
            </div>
            <div>
              <span className="text-xs text-stone-500 block">Ngày phát hành</span>
              <span className="font-semibold text-stone-900">{formatCustomerDateTime(new Date(bookingDocument.issuedAt))}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-xs text-stone-500 block">Tệp tài liệu</span>
              <span className="font-mono text-xs text-stone-800 break-all">{bookingDocument.fileName}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-stone-600 leading-relaxed">
          Phiếu ghi nhận loại kho đã giữ và khoản trả trước 20% (giữ chỗ) đã thanh toán. Đây không phải hợp đồng thuê và không xác nhận một gian kho vật lý cụ thể.
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-stone-100">
          <Button variant="outline" disabled={busy} onClick={() => void viewBookingDocument()}>{busy ? 'Đang tải…' : 'Xem PDF'}</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-semibold" onClick={() => void saveBookingDocument()}>Tải PDF</Button>
        </div>
      </div>}
    </Modal>
    <Modal
      size="3xl"
      open={Boolean(bookingPdfUrl)}
      onClose={() => setBookingPdfUrl(null)}
      title={`Phiếu giữ kho · ${r.reservationCode}`}
      closeLabel="Đóng phiếu giữ kho"
      contentClassName="p-0"
    >
      {bookingPdfUrl && <iframe title={`Phiếu giữ kho ${r.reservationCode}`} src={bookingPdfUrl} className="h-[75vh] w-full rounded-b-xl border-0" />}
    </Modal>
    <Modal size="2xl" open={documentSection !== null} onClose={() => setDocumentSection(null)} title={documentSection === 'records' ? 'Biên bản bàn giao và kiểm kê' : 'Văn bản hợp đồng và bàn giao'}>
      <div className="space-y-4 py-1">
        {busy && <p role="status" className="text-sm text-stone-600">Đang tải tài liệu…</p>}
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
        {documentGroups.map(group => <section key={group.key} className="space-y-3">
          {group.title && <h3 className="border-b border-stone-200 pb-2 text-sm font-semibold">{group.title}</h3>}
          {group.key === 'inventory' && detail && <>
            {detail.inventoryDecision && <InventoryDecisionSummary decision={detail.inventoryDecision} />}
            {inspectionReport && <InventoryMismatchEvidence item={{
              handover: inspectionReport,
              inventoryFullFit: detail.inventoryFullFit,
              inventoryMismatchJson: detail.inventoryMismatchJson,
              inventoryMismatchSummary: detail.inventoryMismatchSummary,
              declaredPackageCount: detail.goodsItems.length ? detail.goodsItems.reduce((sum, item) => sum + item.quantity, 0) : undefined,
              declaredGoodsWeightKg: detail.reservation.totalGoodsWeightKg,
              declaredGoodsVolumeM3: detail.reservation.totalGoodsVolumeM3,
              declaredGoodsLines: detail.goodsItems.map(item => ({
                ...item, code: item.goodsCode, name: item.customGoodsName || item.categoryName || null,
                weightPerPackageKg: item.weightPerItemKg,
              })),
            }} showEvidence={false} />}
          </>}
          <div className="space-y-2.5">
            {group.files.map((document) => {
              const kind = group.key === 'inventory' && decisionEvidence.has(document.id)
                ? 'INVENTORY_DECISION_EVIDENCE'
                : group.key === 'inventory' && inspectionEvidence.has(document.id)
                  ? 'INVENTORY_EVIDENCE'
                  : document.kind ?? (document.originalName.toLowerCase().startsWith('hop-dong-da-ky-') ? 'SIGNED_CONTRACT' : 'OTHER')
              const badge = kind === 'SIGNED_CONTRACT'
                ? { label: 'Hợp đồng đã ký', cls: 'bg-amber-100 text-amber-900' }
                : kind === 'SIGNED_HANDOVER_RECORD'
                ? { label: 'Biên bản bàn giao đã ký', cls: 'bg-orange-100 text-orange-900' }
                : kind === 'PAYMENT_RECEIPT'
                ? { label: 'Biên lai thanh toán', cls: 'bg-emerald-100 text-emerald-900' }
                : kind === 'HANDOVER_EVIDENCE'
                ? { label: 'Bằng chứng kho trống (bàn giao)', cls: 'bg-blue-100 text-blue-900' }
                : kind === 'INVENTORY_EVIDENCE'
                ? { label: 'Bằng chứng kiểm kê hàng hóa', cls: 'bg-purple-100 text-purple-900' }
                : kind === 'INVENTORY_DECISION_EVIDENCE'
                ? { label: 'Biên bản xác nhận phương án kiểm kê', cls: 'bg-indigo-100 text-indigo-900' }
                : kind === 'IDENTITY_VERIFICATION_PHOTO'
                ? { label: 'Ảnh xác minh danh tính', cls: 'bg-teal-100 text-teal-900' }
                : { label: 'Tài liệu đính kèm khác', cls: 'bg-stone-200 text-stone-800' }
              return (
                <div key={document.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 hover:bg-stone-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-stone-700 break-all leading-relaxed">
                      {document.originalName.replace(/^hop-dong-da-ky-/i, '')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <Button size="sm" variant="outline" onClick={() => void viewHandoverDocument(document)}>Xem</Button>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold" onClick={() => void saveHandoverDocument(document)}>Tải xuống</Button>
                  </div>
                </div>
              )
            })}
          </div>
          {!busy && !message && !group.files.length && !(group.key === 'inventory' && (inspectionReport || detail?.inventoryDecision)) && (
            <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              {group.empty}
            </p>
          )}
        </section>)}
      </div>
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
