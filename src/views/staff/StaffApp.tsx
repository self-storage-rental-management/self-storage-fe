import { useState } from 'react'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
<<<<<<< Updated upstream
import { Card, StatCard } from '../../components/ui'
=======
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Tabs, Avatar, Input } from '../../components/ui'
import StaffFeeField from './StaffFeeField'
import StaffPaymentUpload from './StaffPaymentUpload'
import ProfileView from '../ProfileView'
import type { User } from '../../types'
import type { CheckInRecord, Facility, ReturnCase, StorageReservation, StorageUnit } from '../../types/storageHub'
import { RESERVATIONS, CHECKINS, RETURNS, SUPPORT_TICKETS, MY_RENTALS, type TicketItem } from "../../data/demoDatabase"
>>>>>>> Stashed changes
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import { RESERVATIONS, CHECKINS, RETURNS, SUPPORT_TICKETS, MY_RENTALS, type TicketItem } from "../../data/demoDatabase"

type ReservationStatus = 'CREATED' | 'REVIEW_REQUIRED' | 'AWAITING_DEPOSIT' | 'DEPOSIT_PAID' | 'UNIT_RESERVED' | 'READY_FOR_CHECKIN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
type StaffReservation = Omit<(typeof RESERVATIONS)[number], 'status'> & {
  status: ReservationStatus
  appointmentDate: string
  appointmentTime: string
  checkInDeadline: string
  previousAppointment?: string
}
type StaffCheckin = Omit<(typeof CHECKINS)[number], 'status'> & {
  status: 'scheduled' | 'pending-payment' | 'completed' | 'no-show'
  appointmentDate: string
  appointmentTime: string
  checkInDeadline: string
  previousAppointment?: string
  scheduleChanged: boolean
  customerHandoverStatus: 'pending' | 'confirmed'
}
type StaffReturn = Omit<(typeof RETURNS)[number], 'status'> & {
  status: 'pending' | 'waiting-customer' | 'refunded'
  contractStart: string
  contractEnd: string
  requestReason: string
}
type TicketStatus = 'open' | 'in-progress' | 'waiting-customer' | 'resolved'
type StaffTicket = Omit<TicketItem, 'status'> & { status: TicketStatus }

const formatDate = (value?: string) => { if (!value) return 'Chưa xác định'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN') }
const formatDateTime = (value: string) => { const [date, time] = value.split(' · '); return `${formatDate(date)}${time ? ' · ' + formatTime(time) : ''}` }
const formatTime = (value?: string) => { if (!value) return 'Chưa xác định'; const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i); return match ? `${String(Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}` : value }

const formatMoney = (value: number) => `${value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} đô la Mỹ`

const addDays = (dateLabel: string, days: number) => {
  const date = new Date(dateLabel)
  if (Number.isNaN(date.getTime())) return dateLabel
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

<<<<<<< Updated upstream
=======
const toDateInputValue = (dateLabel: string) => {
  const date = new Date(dateLabel)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const sharedReservationStatus = (reservation: StorageReservation): ReservationStatus => {
  if (reservation.status === 'awaiting_review') return 'REVIEW_REQUIRED'
  if (reservation.status === 'awaiting_email') return 'CREATED'
  if (reservation.status === 'awaiting_payment') return 'AWAITING_DEPOSIT'
  if (reservation.status === 'DEPOSIT_PAID') return 'DEPOSIT_PAID'
  if (reservation.status === 'UNIT_RESERVED') return 'UNIT_RESERVED'
  if (reservation.status === 'READY_FOR_CHECKIN') return 'READY_FOR_CHECKIN'
  if (reservation.status === 'COMPLETED') return 'COMPLETED'
  if (reservation.status === 'CANCELLED') return 'CANCELLED'
  if (reservation.status === 'EXPIRED') return 'EXPIRED'
  return 'CREATED'
}

const mapSharedReservation = (reservation: StorageReservation, units: StorageUnit[], facilities: Facility[]): StaffReservation => {
  const assignedUnit = reservation.assignedUnitId
    ? units.find(item => item.id === reservation.assignedUnitId)
    : undefined
  const matchingTypeUnit = units.find(item => item.facilityId === reservation.facilityId && item.type.toLowerCase().startsWith(reservation.unitTypeId.toLowerCase().replace('xlarge', 'extra large')))
  const facility = facilities.find(item => item.id === reservation.facilityId || item.name === reservation.facilityName)
  const appointmentDate = reservation.appointmentDate || reservation.moveInDate
  return {
    id: reservation.id,
    customer: reservation.customerName,
    email: reservation.customerEmail,
    phone: reservation.customerPhone,
    identityId: reservation.identityId,
    unit: assignedUnit?.code || reservation.assignedUnitId || 'Chưa xác định gian kho',
    facility: reservation.facilityName,
    facilityAddress: facility?.address || '—',
    size: assignedUnit?.areaM2 || matchingTypeUnit?.areaM2 || 0,
    sizeCode: assignedUnit?.type || matchingTypeUnit?.type || reservation.unitTypeName || 'Standard',
    sizeUnit: 'm²',
    moveIn: appointmentDate,
    payment: reservation.payment.status === 'paid' ? 'paid' : 'pending',
    paid: reservation.payment.status === 'paid',
    status: sharedReservationStatus(reservation),
    emailVerified: reservation.emailVerification?.verified ?? false,
    goodsType: reservation.goods.category,
    material: reservation.goods.material,
    packageCount: reservation.goods.packageCount,
    weightKg: reservation.goods.weightKg,
    dimensionsCm: `${reservation.goods.lengthCm} × ${reservation.goods.widthCm} × ${reservation.goods.heightCm}`,
    dimWeightKg: reservation.goods.dimWeightKg,
    initialCondition: reservation.goods.condition,
    evidence: reservation.evidence,
    appointmentDate,
    appointmentTime: reservation.appointmentTime || '09:00',
    checkInDeadline: reservation.checkInDeadline || addDays(appointmentDate, 14),
  }
}

const mapSharedCheckin = (record: CheckInRecord, reservation: StorageReservation | undefined, units: StorageUnit[], facilities: Facility[]): StaffCheckin => {
  const unit = units.find(item => item.id === record.unitId || item.code === record.unitId)
  const facility = facilities.find(item => item.id === record.facilityId)
  const lengthCm = record.actualMeasurements.lengthCm || reservation?.goods.lengthCm || 0
  const widthCm = record.actualMeasurements.widthCm || reservation?.goods.widthCm || 0
  const heightCm = record.actualMeasurements.heightCm || reservation?.goods.heightCm || 0
  const status: StaffCheckin['status'] = record.status === 'completed' ? 'completed' : 'scheduled'

  return {
    id: record.id,
    reservationId: record.holdId,
    customer: record.customerName,
    email: reservation?.customerEmail || '—',
    phone: reservation?.customerPhone || '—',
    identityId: reservation?.identityId || '—',
    unit: unit?.code || record.unitId,
    facility: reservation?.facilityName || facility?.name || record.facilityId,
    date: record.scheduledDate,
    time: record.scheduledTime,
    status,
    goodsType: reservation?.goods.category || record.goodsHandover?.category || 'Hàng hóa đã khai báo',
    material: reservation?.goods.material || '—',
    packageCount: reservation?.goods.packageCount || record.goodsHandover?.packageCount || 0,
    weightKg: record.actualMeasurements.weightKg || reservation?.goods.weightKg || 0,
    dimensionsCm: `${lengthCm} × ${widthCm} × ${heightCm}`,
    dimWeightKg: record.actualMeasurements.dimWeightKg || reservation?.goods.dimWeightKg || 0,
    initialCondition: record.initialCondition || reservation?.goods.condition || 'Chờ kiểm tra khi nhận kho',
    evidence: record.evidencePhotos,
    appointmentDate: record.scheduledDate,
    appointmentTime: record.scheduledTime,
    checkInDeadline: reservation?.checkInDeadline || addDays(record.scheduledDate, 14),
    scheduleChanged: false,
    customerHandoverStatus: record.customerConfirmationTimestamp ? 'confirmed' : 'pending',
  }
}

const mapSharedReturn = (item: ReturnCase): StaffReturn => ({
  id: item.id,
  customer: item.customerName,
  email: item.customerEmail,
  phone: item.customerPhone,
  unit: item.unitId,
  facility: item.facilityName,
  date: item.requestedAt,
  returnDate: item.scheduledDate,
  condition: item.damageClassification && item.damageClassification !== 'no_damage' ? 'damaged' : 'good',
  status: item.status === 'requested' || item.status === 'scheduled'
    ? 'pending'
    : item.status === 'completed'
      ? 'refunded'
      : 'waiting-customer',
  deposit: item.depositAmount,
  damageNotes: item.staffNotes || '',
  goodsType: 'Hàng hóa trong hồ sơ thuê',
  material: 'Theo biên bản Nhận kho',
  packageCount: item.packageCount,
  initialWeightKg: item.initialWeightKg,
  finalWeightKg: item.initialWeightKg,
  initialCondition: item.initialConditionSnapshot,
  finalCondition: item.staffNotes || 'Chờ kiểm kê',
  classification: item.damageClassification || 'Chờ phân loại',
  evidence: item.evidence,
  contractStart: item.requestedAt,
  contractEnd: item.scheduledDate,
  requestReason: 'khách hàng yêu cầu trả kho',
})

>>>>>>> Stashed changes
const reservationSeed: StaffReservation[] = RESERVATIONS.map((item, index) => ({
  ...item,
  // Keep one realistic exception in the Staff queue so the REVIEW_REQUIRED
  // workflow can be exercised without changing the shared demo data.
  status: item.id === 'RSV-2049' ? 'REVIEW_REQUIRED' : item.paid ? (item.unit ? 'UNIT_RESERVED' : 'DEPOSIT_PAID') : 'CREATED',
  appointmentDate: item.moveIn,
  appointmentTime: index === 0 ? '11:00 AM' : '09:00 AM',
  checkInDeadline: addDays(item.moveIn, 14),
}))

const checkinSeed: StaffCheckin[] = CHECKINS.map(item => ({
  ...item,
  status: item.status as StaffCheckin['status'],
  appointmentDate: item.date,
  appointmentTime: item.time,
  checkInDeadline: addDays(item.date, 14),
  scheduleChanged: false,
  customerHandoverStatus: 'pending',
}))

const returnSeed: StaffReturn[] = RETURNS.map(item => ({
  ...item,
  status: item.status === 'refunded' ? 'refunded' : 'pending',
  contractStart: 'Jan 15, 2026',
  contractEnd: item.returnDate,
  requestReason: 'khách hàng chủ động kết thúc kỳ thuê đúng hạn',
}))

const unitOperationSpecs: Record<string, { doorWidth: number; doorHeight: number; inner: [number, number, number]; maxWeight: number }> = {
  'A-104': { doorWidth: 90, doorHeight: 200, inner: [220, 220, 230], maxWeight: 500 },
  'B-112': { doorWidth: 110, doorHeight: 210, inner: [300, 300, 240], maxWeight: 900 },
}

const parseDimensions = (value: string): [number, number, number] | null => {
  const dimensions = value.match(/\d+(?:\.\d+)?/g)?.map(Number)
  return dimensions && dimensions.length >= 3 ? [dimensions[0], dimensions[1], dimensions[2]] : null
}

const evaluateFit = (dimensionsText: string, weight: number, unit: string) => {
  const dimensions = parseDimensions(dimensionsText)
  const spec = unitOperationSpecs[unit] ?? { doorWidth: 90, doorHeight: 200, inner: [220, 220, 230] as [number, number, number], maxWeight: 500 }
  if (!dimensions) return { spec, doorFits: false, volumeFits: false, weightFits: weight > 0 && weight <= spec.maxWeight }
  const [a, b, c] = dimensions
  const doorFits = [[a, b], [a, c], [b, c]].some(([x, y]) =>
    (x <= spec.doorWidth && y <= spec.doorHeight) || (y <= spec.doorWidth && x <= spec.doorHeight)
  )
  const sortedGoods = [...dimensions].sort((x, y) => x - y)
  const sortedInner = [...spec.inner].sort((x, y) => x - y)
  return {
    spec,
    doorFits,
    volumeFits: sortedGoods.every((dimension, index) => dimension <= sortedInner[index]),
    weightFits: weight > 0 && weight <= spec.maxWeight,
  }
}

const statusLabelMap: Record<string, Record<string, string>> = {
  vi: {
    confirmed: 'Đã xác nhận',
    pending: 'Chờ xử lý',
    rejected: 'Đã từ chối',
    completed: 'Hoàn tất',
    scheduled: 'Đã lên lịch',
    'pending-payment': 'Chờ thanh toán',
    inspected: 'Đã nghiệm thu',
    refunded: 'Đã hoàn cọc',
    open: 'Chờ xử lý',
    'in-progress': 'Đang xử lý',
    resolved: 'Đã giải quyết',
    closed: 'Đã đóng',
<<<<<<< Updated upstream
    CREATED: 'Chờ thanh toán cọc',
    REVIEW_REQUIRED: 'Cần Staff rà soát ngoại lệ',
    AWAITING_DEPOSIT: 'Đã duyệt · Chờ thanh toán cọc',
    DEPOSIT_PAID: 'Đã cọc · Chờ phân kho',
    UNIT_RESERVED: 'Đã phân kho',
    READY_FOR_CHECKIN: 'Sẵn sàng Check-in',
=======
    CREATED: 'Chờ khách hàng xác minh thư điện tử',
    REVIEW_REQUIRED: 'Cần nhân viên rà soát ngoại lệ',
    AWAITING_DEPOSIT: 'Đã duyệt · Chờ thanh toán cọc',
    DEPOSIT_PAID: 'Đã cọc · Chờ Nhận kho',
    UNIT_RESERVED: 'Đã giữ gian kho',
    READY_FOR_CHECKIN: 'Sẵn sàng Nhận kho',
>>>>>>> Stashed changes
    COMPLETED: 'Đã kích hoạt thuê',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Đã hết hạn',
    'waiting-customer': 'Chờ khách hàng phản hồi',
    'no-show': 'Không đến nhận kho',
    high: 'Khẩn cấp',
    medium: 'Trung bình',
    low: 'Tiêu chuẩn',
  },
  en: {
    confirmed: 'Confirmed',
    pending: 'Pending',
    rejected: 'Rejected',
    completed: 'Completed',
    scheduled: 'Scheduled',
    'pending-payment': 'Pending Payment',
    inspected: 'Inspected',
    refunded: 'Refunded',
    open: 'Open',
    'in-progress': 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    CREATED: 'Awaiting Deposit',
    REVIEW_REQUIRED: 'Review Required',
    AWAITING_DEPOSIT: 'Approved · Awaiting Deposit',
    DEPOSIT_PAID: 'Deposit Paid · Awaiting Unit',
    UNIT_RESERVED: 'Unit Reserved',
    READY_FOR_CHECKIN: 'Ready for Check-in',
    COMPLETED: 'Rental Activated',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
    'waiting-customer': 'Waiting for Customer',
    'no-show': 'No-show',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }
}

export default function StaffApp({ user, onLogout }: { user: User; onLogout: () => void }) {
    const hub = useStorageHub()
  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Tổng quan ca làm việc', icon: Icon.home, group: 'Ca làm việc', permission: 'view_dashboard' },
    { id: 'reservations', label: 'Duyệt yêu cầu đặt kho', icon: Icon.calendar, group: 'Vận hành', permission: 'approve_reservations' },
    { id: 'checkin', label: 'Nhận kho & bàn giao', icon: Icon.truck, group: 'Vận hành', permission: 'view_checkins' },
    { id: 'return', label: 'Nghiệm thu trả kho', icon: Icon.clipboard, group: 'Vận hành', permission: 'view_returns' },
    { id: 'support', label: 'Hỗ trợ khách hàng', icon: Icon.support, group: 'Chăm sóc', permission: 'view_support' },
  ]

  const [page, setPage] = useState(() => getInitialPage(NAV, 'dashboard'))
  const [reservations, setReservations] = useState<StaffReservation[]>(reservationSeed)
  const [checkins, setCheckins] = useState<StaffCheckin[]>(checkinSeed)
  const [returns, setReturns] = useState<StaffReturn[]>(returnSeed)
  const [inspectModal, setInspectModal] = useState(false)
  const [checkinModal, setCheckinModal] = useState(false)
  const [reservationModal, setReservationModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<StaffReservation | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<StaffReturn | null>(null)
  const [returnDetailsOnly, setReturnDetailsOnly] = useState(false)
  const [selectedCheckin, setSelectedCheckin] = useState<StaffCheckin | null>(null)
  const [ticketTab, setTicketTab] = useState('Open')
  const [reservationSearch, setReservationSearch] = useState('')
  const [reservationStatus, setReservationStatus] = useState('all')
  const [scheduledReturnIds, setScheduledReturnIds] = useState<Set<string>>(new Set())
  const [returnScheduleDrafts, setReturnScheduleDrafts] = useState<Record<string, string>>({})
  const [checkinChecks, setCheckinChecks] = useState<Record<string, boolean>>({})
  const [checkinEvidence, setCheckinEvidence] = useState('')
  const [checkinNotes, setCheckinNotes] = useState('')
  const [actualDimensions, setActualDimensions] = useState('')
  const [actualWeight, setActualWeight] = useState('')
  const [actualMaterial, setActualMaterial] = useState('')
  const [actualCondition, setActualCondition] = useState('')
  const [contractFile, setContractFile] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentEvidence, setPaymentEvidence] = useState('')
<<<<<<< Updated upstream
=======
  const [paymentEvidenceName, setPaymentEvidenceName] = useState('')
  const [selectedRenewal, setSelectedRenewal] = useState<(typeof hub.renewals)[number] | null>(null)
  const [renewalContractFile, setRenewalContractFile] = useState('')
  const [renewalContractNumber, setRenewalContractNumber] = useState('')
  const [renewalPaymentReference, setRenewalPaymentReference] = useState('')
  const [renewalIdentityVerified, setRenewalIdentityVerified] = useState(false)
  const [renewalTermsVerified, setRenewalTermsVerified] = useState(false)
  const [pendingCheckinCompletionId, setPendingCheckinCompletionId] = useState<string | null>(null)
>>>>>>> Stashed changes
  const [scheduleOverrideReason, setScheduleOverrideReason] = useState('')
  const [noShowTarget, setNoShowTarget] = useState<StaffCheckin | null>(null)
  const [noShowReason, setNoShowReason] = useState('')
  const [returnInventory, setReturnInventory] = useState('match')
  const [returnClassification, setReturnClassification] = useState('no-damage')
  const [returnEvidence, setReturnEvidence] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnActualPackages, setReturnActualPackages] = useState('')
  const [returnKeys, setReturnKeys] = useState('')
<<<<<<< Updated upstream
  const [returnDamageFee, setReturnDamageFee] = useState('0')
  const [returnCleaningFee, setReturnCleaningFee] = useState('0')
  const [returnLostItemFee, setReturnLostItemFee] = useState('0')
  const [returnOverdueFee, setReturnOverdueFee] = useState('0')
  const [returnOtherDebt, setReturnOtherDebt] = useState('0')
=======
  const [returnDamageFee, setReturnDamageFee] = useState('')
  const [returnCleaningFee, setReturnCleaningFee] = useState('')
  const [returnLostItemFee, setReturnLostItemFee] = useState('')
  const [returnOverdueFee, setReturnOverdueFee] = useState('')
  const [returnOtherDebt, setReturnOtherDebt] = useState('')
  const [feeDetails, setFeeDetails] = useState<Record<string, string>>({})
>>>>>>> Stashed changes

  // Support Tickets state
  const [staffTickets, setStaffTickets] = useState<StaffTicket[]>(SUPPORT_TICKETS)
  const [selectedStaffTicket, setSelectedStaffTicket] = useState<StaffTicket | null>(null)
  const [assignedStaffByTicket, setAssignedStaffByTicket] = useState<Record<string, string>>(() =>
    Object.fromEntries(SUPPORT_TICKETS.map(ticket => {
      const latestStaffMessage = [...ticket.messages].reverse().find(message => message.role === 'staff')
      return [ticket.id, latestStaffMessage?.sender ?? '']
    }))
  )
  const [respondModal, setRespondModal] = useState(false)
  const [staffReplyText, setStaffReplyText] = useState('')
  const [ticketNewStatus, setTicketNewStatus] = useState<TicketStatus>('in-progress')
  const [ticketEvidence, setTicketEvidence] = useState('')
  const [ticketEscalated, setTicketEscalated] = useState(false)
  const [ticketEscalationReason, setTicketEscalationReason] = useState('')
  const [toast, setToast] = useState<string | null>(null)
<<<<<<< Updated upstream
=======
  const toastTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => { window.clearTimeout(toastTimer.current) }, [])
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const activeStaffTicket = selectedStaffTicket
    ? staffTickets.find(ticket => ticket.id === selectedStaffTicket.id) ?? selectedStaffTicket
    : null

  useEffect(() => {
    if (!respondModal || !activeStaffTicket) return
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [respondModal, activeStaffTicket?.messages.length])

  useEffect(() => {
    const sharedReservations = hub.holds
      .filter(reservation => isFacilityVisible(user, reservation.facilityId, reservation.facilityName))
      .map(reservation => mapSharedReservation(reservation, hub.units, hub.facilities))
    const sharedIds = new Set(sharedReservations.map(reservation => reservation.id))
    setReservations(previous => [...sharedReservations, ...previous.filter(reservation => !sharedIds.has(reservation.id) && isFacilityVisible(user, undefined, reservation.facility))])
  }, [hub.holds, hub.units, user.facility, user.facilityId])

  useEffect(() => {
    const sharedCheckins = hub.checkins
      .filter(record => record.status !== 'cancelled')
      .map(record => {
        const reservation = hub.holds.find(item => item.id === record.holdId)
        return { record, reservation }
      })
      .filter(({ record, reservation }) => isFacilityVisible(user, record.facilityId, reservation?.facilityName))
      .map(({ record, reservation }) => mapSharedCheckin(record, reservation, hub.units, hub.facilities))
    const sharedIds = new Set(sharedCheckins.map(checkin => checkin.id))
    setCheckins(previous => [...sharedCheckins, ...previous.filter(checkin => !sharedIds.has(checkin.id))])
  }, [hub.checkins, hub.holds, hub.units, hub.facilities, user.facility, user.facilityId])

  useEffect(() => {
    const sharedReturns = hub.returns
      .filter(item => isFacilityVisible(user, item.facilityId, item.facilityName))
      .map(mapSharedReturn)
    const sharedIds = new Set(sharedReturns.map(item => item.id))
    setReturns(previous => [...sharedReturns, ...previous.filter(item => !sharedIds.has(item.id))])
  }, [hub.returns, user.facility, user.facilityId])

>>>>>>> Stashed changes
  const showToast = (message: string) => {
    setToast(message.replace(/Check-in|check-in/g, 'nhận kho').replace(/Customer/g, 'khách hàng').replace(/Staff/g, 'nhân viên').replace(/Manager/g, 'quản lý').replace(/Rental|rental/g, 'hợp đồng thuê').replace(/credential/g, 'quyền truy cập').replace(/email/g, 'thư điện tử'))
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 7000)
  }

<<<<<<< Updated upstream
=======
  useEffect(() => {
    if (!pendingCheckinCompletionId || !selectedCheckin || selectedCheckin.id !== pendingCheckinCompletionId) return
    const sharedHold = hub.holds.find(item => item.id === selectedCheckin.reservationId)
    if (!sharedHold || sharedHold.status !== 'READY_FOR_CHECKIN') return
    const dimensions = parseDimensions(actualDimensions)
    if (!dimensions) {
      setPendingCheckinCompletionId(null)
      showToast('Kích thước thực tế chưa hợp lệ.')
      return
    }
    const evidence = [checkinEvidence.trim(), contractFile.trim(), paymentEvidenceName.trim(), `RECEIPT-${Date.now()} · ${paymentReference.trim()} · ${user.name} thu phần còn lại`, `CHECKIN-${Date.now()} · ${user.name} xác nhận đối chiếu, cấp quyền truy cập và bàn giao${scheduleOverrideReason.trim() ? ` · Lý do điều chỉnh: ${scheduleOverrideReason.trim()}` : ''}${checkinNotes.trim() ? ` · ${checkinNotes.trim()}` : ''}`]
    try {
      hub.completeCheckIn({
        holdId: selectedCheckin.reservationId,
        staffUser: user,
        checklist: { identityVerified: Boolean(checkinChecks.identity), termsAccepted: Boolean(checkinChecks.contract), paymentConfirmed: Boolean(checkinChecks.payment), unitWalkthrough: Boolean(checkinChecks.walkthrough), accessCodeIssued: Boolean(checkinChecks.credential) },
        actualMeasurements: { lengthCm: dimensions[0], widthCm: dimensions[1], heightCm: dimensions[2], weightKg: Number(actualWeight), actualVolumeM3: (dimensions[0] * dimensions[1] * dimensions[2] * Math.max(1, selectedCheckin.packageCount)) / 1_000_000, dimWeightKg: selectedCheckin.dimWeightKg, varianceAccepted: true, varianceNotes: checkinNotes.trim() || undefined },
        initialCondition: actualCondition.trim(),
        evidencePhotos: evidence,
        goodsHandover: { packageCount: selectedCheckin.packageCount, category: selectedCheckin.goodsType, estimatedWeightKg: Number(actualWeight), notes: `${actualMaterial.trim()}${checkinNotes.trim() ? ` · ${checkinNotes.trim()}` : ''}` },
        handedOverItems: [`PIN/thẻ/chìa khóa kho ${selectedCheckin.unit}`, contractFile.trim(), paymentEvidence.trim()],
      })
      setCheckins(items => items.map(item => item.id === selectedCheckin.id ? { ...item, status: 'completed', customerHandoverStatus: 'pending', dimensionsCm: actualDimensions.trim(), weightKg: Number(actualWeight), material: actualMaterial.trim(), initialCondition: actualCondition.trim(), evidence: [...item.evidence, ...evidence] } : item))
      setReservations(items => items.map(item => item.id === selectedCheckin.reservationId ? { ...item, status: 'COMPLETED' } : item))
      setPendingCheckinCompletionId(null)
      setCheckinModal(false)
      showToast('Đã kích hoạt hợp đồng thuê; khách hàng có thể xác nhận đã nhận kho trong Đơn đặt giữ kho.')
    } catch (error) {
      setPendingCheckinCompletionId(null)
      showToast(error instanceof Error ? error.message : 'Không thể hoàn tất Nhận kho.')
    }
  }, [pendingCheckinCompletionId, hub.holds])

  const s = (value: string, variants: Record<string, string>) => {
    const label = statusLabelMap[value] || value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ')
    return <Badge variant={variants[value] ?? 'muted'}>{label}</Badge>
  }

>>>>>>> Stashed changes
  const normalizedSearch = reservationSearch.trim().toLowerCase()
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const filteredReservations = reservations.filter(r => {
    const matchesStatus = reservationStatus === 'all' || r.status === reservationStatus
    const searchText = [r.id, r.customer, r.phone, r.email, r.identityId, r.facility, r.unit].join(' ').toLowerCase()
    return matchesStatus && (!normalizedSearch || searchText.includes(normalizedSearch))
  })
  const facilityTickets = staffTickets.filter(ticket => !user.facility || ticket.facility === user.facility)
  const fitEvaluation = selectedCheckin ? evaluateFit(actualDimensions, Number(actualWeight), selectedCheckin.unit) : null
  const reservationForCheckin = selectedCheckin ? reservations.find(reservation => reservation.id === selectedCheckin.reservationId) : null
  const selectedAppointmentDate = selectedCheckin ? new Date(selectedCheckin.appointmentDate) : null
  const isOutsideAppointmentDate = Boolean(selectedAppointmentDate && !Number.isNaN(selectedAppointmentDate.getTime()) && selectedAppointmentDate.toDateString() !== new Date().toDateString())
  const checkinCanComplete = Boolean(
    selectedCheckin &&
    Object.values(checkinChecks).every(Boolean) &&
    actualDimensions.trim() && Number(actualWeight) > 0 && actualMaterial.trim() && actualCondition.trim() &&
    checkinEvidence.trim() && contractFile.trim() && paymentReference.trim() && paymentEvidence.trim() &&
    fitEvaluation?.doorFits && fitEvaluation.volumeFits && fitEvaluation.weightFits &&
    (!isOutsideAppointmentDate || scheduleOverrideReason.trim())
  )
  const returnFeesValid = [returnDamageFee, returnCleaningFee, returnLostItemFee, returnOverdueFee, returnOtherDebt].every(value => value === '' || (/^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) <= Number.MAX_SAFE_INTEGER / 100))
  const returnTotalDeductions = [returnDamageFee, returnCleaningFee, returnLostItemFee, returnOverdueFee, returnOtherDebt]
    .reduce((total, value) => total + Math.max(0, Number(value) || 0), 0)
  const returnRefund = selectedReturn ? Math.max(0, selectedReturn.deposit - returnTotalDeductions) : 0
  const expiringRentals = MY_RENTALS.filter(rental => {
    const due = new Date(rental.nextDue)
    if (Number.isNaN(due.getTime())) return false
    const days = Math.ceil((due.getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 30
  })
  const eligibleCheckins = checkins.filter(checkin => {
    const reservation = reservations.find(item => item.id === checkin.reservationId)
    return !reservation || (reservation.status !== 'CANCELLED' && reservation.status !== 'EXPIRED')
  })
  const openCheckinRecord = (checkin: StaffCheckin) => {
    setSelectedCheckin(checkin)
    setCheckinChecks({ identity: false, reservation: false, contract: false, payment: checkin.status !== 'pending-payment', measurement: false, walkthrough: false, condition: false, credential: false })
    setActualDimensions(checkin.dimensionsCm)
    setActualWeight(String(checkin.weightKg))
    setActualMaterial(checkin.material)
    setActualCondition(checkin.initialCondition)
    setCheckinEvidence('')
    setCheckinNotes('')
    setContractFile('')
    setPaymentReference('')
    setPaymentEvidence(''); setPaymentEvidenceName('')
    setScheduleOverrideReason('')
    setCheckinModal(true)
  }
  const operationalTasks = [
<<<<<<< Updated upstream
    ...reservations.filter(r => r.status === 'DEPOSIT_PAID').map(r => ({ id: `allocation-${r.id}`, title: lang === 'vi' ? `Theo dõi Manager phân kho ${r.id}` : `Track unit allocation ${r.id}`, customer: r.customer, time: `${r.appointmentDate} ${r.appointmentTime}`, sla: lang === 'vi' ? 'Chờ Manager phân kho' : 'Awaiting manager allocation', priority: 'medium', page: 'reservations' })),
    ...eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').map(c => ({ id: `checkin-${c.id}`, title: lang === 'vi' ? `Check-in & bàn giao ${c.unit}` : `Check-in & handover ${c.unit}`, customer: c.customer, time: `${c.appointmentDate} ${c.appointmentTime}`, sla: c.scheduleChanged ? (lang === 'vi' ? 'Lịch đã thay đổi' : 'Schedule changed') : (lang === 'vi' ? `Hạn ${c.checkInDeadline}` : `Deadline ${c.checkInDeadline}`), priority: c.scheduleChanged ? 'high' : 'medium', page: 'checkin' })),
    ...returns.filter(r => r.status !== 'refunded').map(r => ({ id: `return-${r.id}`, title: lang === 'vi' ? `Kiểm tra trả kho ${r.unit}` : `Return inspection ${r.unit}`, customer: r.customer, time: returnScheduleDrafts[r.id] || r.returnDate, sla: scheduledReturnIds.has(r.id) ? (lang === 'vi' ? 'Đã xác nhận lịch' : 'Scheduled') : (lang === 'vi' ? 'Cần xác nhận lịch' : 'Schedule required'), priority: scheduledReturnIds.has(r.id) ? 'medium' : 'high', page: 'return' })),
    ...facilityTickets.filter(ticket => ticket.status !== 'resolved').map(ticket => ({ id: `support-${ticket.id}`, title: lang === 'vi' ? `Xử lý hỗ trợ ${ticket.id}` : `Handle support ${ticket.id}`, customer: ticket.customer, time: ticket.created, sla: ticket.status === 'waiting-customer' ? (lang === 'vi' ? 'Chờ Customer phản hồi' : 'Waiting for customer') : ticket.priority === 'high' ? (lang === 'vi' ? 'Xử lý ngay' : 'Immediate') : (lang === 'vi' ? 'Trong ca' : 'Within shift'), priority: ticket.priority, page: 'support' })),
    ...expiringRentals.map(rental => ({ id: `expiry-${rental.id}`, title: lang === 'vi' ? `Hợp đồng ${rental.unit} sắp hết hạn` : `Lease ${rental.unit} expiring`, customer: lang === 'vi' ? 'Khách thuê hiện tại' : 'Current tenant', time: rental.nextDue, sla: lang === 'vi' ? 'Theo dõi nhắc gia hạn' : 'Track renewal reminder', priority: 'low', page: 'tasks' }))
=======
    ...reservations.filter(r => r.status === 'REVIEW_REQUIRED').map(r => ({ id: `review-${r.id}`, title: `Rà soát hồ sơ ${r.id}`, customer: r.customer, time: `${formatDate(r.appointmentDate)} ${formatTime(r.appointmentTime)}`, sla: 'Cần nhân viên duyệt hàng hóa', priority: 'high', page: 'reservations' })),
    ...reservations.filter(r => r.status === 'DEPOSIT_PAID').map(r => ({ id: `allocation-${r.id}`, title: `Theo dõi Nhận kho ${r.id}`, customer: r.customer, time: `${formatDate(r.appointmentDate)} ${formatTime(r.appointmentTime)}`, sla: 'Chuẩn bị nhận kho', priority: 'medium', page: 'reservations' })),
    ...eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').map(c => ({ id: `checkin-${c.id}`, title: `Nhận kho & bàn giao ${c.unit}`, customer: c.customer, time: `${formatDate(c.appointmentDate)} ${formatTime(c.appointmentTime)}`, sla: c.scheduleChanged ? ('Lịch đã thay đổi') : (`Hạn ${formatDate(c.checkInDeadline)}`), priority: c.scheduleChanged ? 'high' : 'medium', page: 'checkin' })),
    ...returns.filter(r => r.status !== 'refunded').map(r => ({ id: `return-${r.id}`, title: `Kiểm tra trả kho ${r.unit}`, customer: r.customer, time: formatDate(returnScheduleDrafts[r.id] || r.returnDate), sla: scheduledReturnIds.has(r.id) ? ('Đã xác nhận lịch') : ('Cần xác nhận lịch'), priority: scheduledReturnIds.has(r.id) ? 'medium' : 'high', page: 'return' })),
    ...facilityTickets.filter(ticket => ticket.status !== 'resolved').map(ticket => ({ id: `support-${ticket.id}`, title: `Xử lý hỗ trợ ${ticket.id}`, customer: ticket.customer, time: formatDateTime(ticket.created), sla: ticket.status === 'waiting-customer' ? ('Chờ khách hàng phản hồi') : ticket.priority === 'high' ? ('Xử lý ngay') : ('Trong ca'), priority: ticket.priority, page: 'support' })),
    ...expiringRentals.map(rental => ({ id: `expiry-${rental.id}`, title: `Hợp đồng ${rental.unit} sắp hết hạn`, customer: 'Khách thuê hiện tại', time: formatDate(rental.nextDue), sla: 'Theo dõi nhắc gia hạn', priority: 'low', page: 'tasks' }))
>>>>>>> Stashed changes
  ].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
  const openOperationalTask = (task: (typeof operationalTasks)[number]) => {
    if (task.id.startsWith('allocation-')) {
      const reservation = reservations.find(item => item.id === task.id.replace('allocation-', ''))
      if (reservation) { setSelectedReservation(reservation); setReservationModal(true) }
      return
    }
    if (task.id.startsWith('checkin-')) {
      const checkin = checkins.find(item => item.id === task.id.replace('checkin-', ''))
      if (checkin) { setPage('checkin'); openCheckinRecord(checkin) }
      return
    }
    if (task.id.startsWith('support-')) {
      const ticket = staffTickets.find(item => item.id === task.id.replace('support-', ''))
      if (ticket) {
        setSelectedStaffTicket(ticket)
        setTicketNewStatus(ticket.status)
        setTicketEvidence('')
        setTicketEscalated(false)
        setTicketEscalationReason('')
        setPage('support')
        setRespondModal(true)
      }
      return
    }
    setPage(task.page)
    if (task.id.startsWith('return-')) showToast(lang === 'vi' ? `Đã mở danh sách hồ sơ trả kho cho ${task.customer}.` : `Opened the return records for ${task.customer}.`)
    if (task.id.startsWith('expiry-')) showToast(lang === 'vi' ? `Đã mở nhiệm vụ theo dõi gia hạn cho ${task.customer}.` : `Opened the renewal follow-up task for ${task.customer}.`)
  }
  const totalCount = operationalTasks.length
  const completedCount = reservations.filter(r => r.status === 'COMPLETED').length + checkins.filter(c => c.status === 'completed').length + returns.filter(r => r.status === 'waiting-customer' || r.status === 'refunded').length + facilityTickets.filter(ticket => ticket.status === 'resolved').length
  const remainingTaskCount = Math.max(0, totalCount - completedCount)


  return (
    <Layout
<<<<<<< Updated upstream
      user={user} navItems={NAV} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      roleLabel="Staff" roleColor="bg-green-100 text-green-700"
=======
      user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      notifications={operationalTasks.filter(task => task.page !== 'tasks').map(task => ({ id: task.id, title: task.title, message: task.customer + ' · ' + task.sla, page: task.page }))}
      onNotificationClick={notification => { const task = operationalTasks.find(item => item.id === notification.id); if (task) openOperationalTask(task) }}
      roleLabel="Nhân viên" roleColor="bg-green-100 text-green-700"
>>>>>>> Stashed changes
    >
      {page === 'dashboard' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            eyebrow={lang === 'vi' ? 'CỔNG NHÂN VIÊN · TỔNG QUAN VẬN HÀNH' : 'STAFF PORTAL · OPERATIONS OVERVIEW'}
            title={lang === 'vi' ? 'Tổng Quan Ca Làm Việc' : 'Staff Home / Dashboard'}
            subtitle={`${user.facility ?? (lang === 'vi' ? 'Cơ sở được phân quyền' : 'Authorized facility')} · ${new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}`}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
<<<<<<< Updated upstream
            <StatCard title={lang === 'vi' ? 'Chờ Manager phân kho' : 'Awaiting Unit Allocation'} value={reservations.filter(r => r.status === 'DEPOSIT_PAID').length} icon={Icon.alert} iconBg="bg-amber-50" />
            <StatCard title={lang === 'vi' ? 'Check-in sắp tới' : 'Upcoming Check-ins'} value={eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').length} icon={Icon.truck} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Trả kho cần xử lý' : 'Returns to Process'} value={returns.filter(r => r.status !== 'refunded').length} icon={Icon.clipboard} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Hỗ trợ đang mở' : 'Open Support Cases'} value={staffTickets.filter(ticket => ticket.status !== 'resolved').length} icon={Icon.support} iconBg="bg-red-50" />
          </div>
          <Card>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3"><div><h3 className="font-bold">{lang === 'vi' ? 'Việc ưu tiên theo lịch vận hành' : 'Priority Operational Tasks'}</h3><p className="text-xs text-stone-500">{lang === 'vi' ? 'Lịch nhận/trả kho, hỗ trợ và hợp đồng sắp hết hạn.' : 'Check-ins, returns, support and expiring leases.'}</p></div><Button variant="outline" size="sm" onClick={() => setPage('tasks')}>{lang === 'vi' ? 'Xem toàn bộ' : 'View all'}</Button></div>
            <Table><Thead><tr><Th>{lang === 'vi' ? 'Ưu tiên' : 'Priority'}</Th><Th>{lang === 'vi' ? 'Nhiệm vụ' : 'Task'}</Th><Th>{lang === 'vi' ? 'Khách hàng' : 'Customer'}</Th><Th>{lang === 'vi' ? 'Lịch / SLA' : 'Schedule / SLA'}</Th><Th></Th></tr></Thead><Tbody>
              {operationalTasks.slice(0, 6).map(task => <Tr key={task.id}><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td><b>{task.title}</b><p className="text-[11px] text-stone-400">{task.id}</p></Td><Td>{task.customer}</Td><Td><p className="text-xs">{task.time}</p><p className="text-[11px] font-semibold text-amber-700">{task.sla}</p></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{lang === 'vi' ? 'Xử lý' : 'Open'}</Button></Td></Tr>)}
=======
            <StatCard title={'Đơn đã cọc · Chờ Nhận kho'} value={reservations.filter(r => r.status === 'DEPOSIT_PAID').length} icon={Icon.alert} iconBg="bg-amber-50" />
            <StatCard title={'Nhận kho sắp tới'} value={eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').length} icon={Icon.truck} iconBg="bg-blue-50" />
            <StatCard title={'Trả kho cần xử lý'} value={returns.filter(r => r.status !== 'refunded').length} icon={Icon.clipboard} iconBg="bg-purple-50" />
            <StatCard title={'Hỗ trợ đang mở'} value={facilityTickets.filter(ticket => ticket.status !== 'resolved').length} icon={Icon.support} iconBg="bg-red-50" />
          </div>
          <Card>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3"><div><h3 className="font-bold">{'Việc ưu tiên theo lịch vận hành'}</h3><p className="text-xs text-stone-500">{'Lịch nhận/trả kho, hỗ trợ và hợp đồng sắp hết hạn.'}</p></div><Button variant="outline" size="sm" onClick={() => setPage('tasks')}>{'Xem toàn bộ'}</Button></div>
            <Table><Thead><tr><Th>{'Ưu tiên'}</Th><Th>{'Nhiệm vụ'}</Th><Th>{'Khách hàng'}</Th><Th>{'Lịch / Thời hạn xử lý'}</Th><Th></Th></tr></Thead><Tbody>
              {operationalTasks.slice(0, 6).map(task => <Tr key={task.id}><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td><b>{task.title}</b></Td><Td>{task.customer}</Td><Td><p className="text-xs">{task.time}</p><p className="text-[11px] font-semibold text-amber-700">{task.sla}</p></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{'Xử lý'}</Button></Td></Tr>)}
>>>>>>> Stashed changes
            </Tbody></Table>
          </Card>
        </div>
      )}

      {/* ── DAILY TASKS ───────────────────────────────────────── */}
      {page === 'tasks' && (
        <div className="fade-in">
          <SectionHeader
            eyebrow={lang === 'vi' ? 'CỔNG NHÂN VIÊN · XÁC NHẬN NGHIỆP VỤ' : 'STAFF PORTAL · OPERATIONAL VERIFICATION'}
            title={t('tasks.title', 'Daily Tasks')}
            subtitle={`${new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard title={t('tasks.total', 'Total Tasks')} value={totalCount} icon={Icon.tasks} iconBg="bg-blue-50" />
            <StatCard title={t('tasks.completed', 'Completed')} value={completedCount} icon={Icon.check} iconBg="bg-green-50" />
            <StatCard title={t('tasks.remaining', 'Remaining')} value={remainingTaskCount} icon={Icon.alert} iconBg="bg-amber-50" />
          </div>

<<<<<<< Updated upstream
          <Card><Table><Thead><tr><Th>{lang === 'vi' ? 'Nhiệm vụ được giao' : 'Assigned Task'}</Th><Th>{lang === 'vi' ? 'Khách hàng' : 'Customer'}</Th><Th>{lang === 'vi' ? 'Lịch' : 'Schedule'}</Th><Th>SLA</Th><Th>{lang === 'vi' ? 'Ưu tiên' : 'Priority'}</Th><Th></Th></tr></Thead><Tbody>
            {operationalTasks.map(task => <Tr key={task.id}><Td><b>{task.title}</b></Td><Td>{task.customer}</Td><Td className="text-xs">{task.time}</Td><Td className="text-xs font-semibold text-amber-700">{task.sla}</Td><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{lang === 'vi' ? 'Mở hồ sơ' : 'Open record'}</Button></Td></Tr>)}
=======
          <Card><Table><Thead><tr><Th>{'Nhiệm vụ được giao'}</Th><Th>{'Khách hàng'}</Th><Th>{'Lịch'}</Th><Th>Thời hạn xử lý</Th><Th>{'Ưu tiên'}</Th><Th></Th></tr></Thead><Tbody>
            {operationalTasks.map(task => <Tr key={task.id}><Td><b>{task.title}</b></Td><Td>{task.customer}</Td><Td className="text-xs">{task.time}</Td><Td className="text-xs font-semibold text-amber-700">{task.sla}</Td><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{'Mở hồ sơ'}</Button></Td></Tr>)}
>>>>>>> Stashed changes
          </Tbody></Table></Card>
        </div>
      )}

      {/* ── RESERVATIONS ──────────────────────────────────────── */}
      {page === 'reservations' && (
        <div className="fade-in">
          <SectionHeader
<<<<<<< Updated upstream
            title={lang === 'vi' ? 'Theo Dõi Đơn Đặt Giữ Kho' : 'Reservation Tracking'}
            subtitle={lang === 'vi' ? 'Staff chỉ theo dõi trạng thái và chuẩn bị Check-in; đơn hợp lệ không cần Staff phê duyệt.' : 'Staff monitors progress and prepares check-in; valid reservations require no staff approval.'}
          />
          <Card className="p-4 mb-4"><div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3"><Input label={lang === 'vi' ? 'Tìm hồ sơ' : 'Search records'} value={reservationSearch} onChange={event => setReservationSearch(event.target.value)} placeholder={lang === 'vi' ? 'Mã đơn, tên, SĐT, email, CCCD, cơ sở, mã kho' : 'Code, name, phone, email, ID, facility, unit'} /><div><label className="text-sm font-medium text-stone-700">{lang === 'vi' ? 'Trạng thái chuẩn' : 'Canonical status'}</label><select value={reservationStatus} onChange={event => setReservationStatus(event.target.value)} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="all">{lang === 'vi' ? 'Tất cả' : 'All'}</option>{(['CREATED', 'REVIEW_REQUIRED', 'AWAITING_DEPOSIT', 'DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as ReservationStatus[]).map(status => <option key={status} value={status}>{statusLabelMap[lang][status]}</option>)}</select></div></div><p className="mt-2 text-xs text-stone-500">{filteredReservations.length}/{reservations.length} {lang === 'vi' ? 'hồ sơ phù hợp' : 'matching records'}</p></Card>
=======
            title={'Theo Dõi Đơn Đặt Giữ Kho'}
            subtitle={'Nhân viên theo dõi trạng thái và chuẩn bị Nhận kho; hồ sơ hàng hóa “Khác” do quản lý duyệt.'}
          />
            <Card className="p-4 mb-4"><div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3"><Input label={'Tìm hồ sơ'} value={reservationSearch} onChange={event => setReservationSearch(event.target.value)} placeholder={'Mã đơn, tên, SĐT, thư điện tử, CCCD, cơ sở, mã kho'} /><div><label className="text-sm font-medium text-stone-700">{'Trạng thái chuẩn'}</label><select value={reservationStatus} onChange={event => setReservationStatus(event.target.value)} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="all">{'Tất cả'}</option>{(['CREATED', 'REVIEW_REQUIRED', 'AWAITING_DEPOSIT', 'DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as ReservationStatus[]).map(status => <option key={status} value={status}>{statusLabelMap[status]}</option>)}</select></div></div><p className="mt-2 text-xs text-stone-500">{filteredReservations.length}/{reservations.length} {'hồ sơ phù hợp'}</p></Card>
>>>>>>> Stashed changes
          <Card>
            <Table>
              <Thead>
                <tr>
<<<<<<< Updated upstream
                  <Th>{t('reservations.col.id', 'Reservation')}</Th>
                  <Th>{t('reservations.col.customer', 'Customer')}</Th>
                  <Th>{t('reservations.col.unit', 'Unit')}</Th>
                  <Th>{lang === 'vi' ? 'Lịch Check-in hiện tại' : 'Current Check-in'}</Th>
                  <Th>{t('reservations.col.payment', 'Payment')}</Th>
                  <Th>{t('reservations.col.status', 'Status')}</Th>
                  <Th>{t('reservations.col.actions', 'Actions')}</Th>
=======
                  <Th>{'Mã đơn'}</Th>
                  <Th>{'Khách hàng'}</Th>
                  <Th>{'Gian kho'}</Th>
                  <Th>{'Lịch Nhận kho hiện tại'}</Th>
                  <Th>{'Thanh toán'}</Th>
                  <Th>{'Trạng thái'}</Th>
                  <Th>{'Thao tác'}</Th>
>>>>>>> Stashed changes
                </tr>
              </Thead>
              <Tbody>
                {filteredReservations.map(r => (
                  <Tr key={r.id}>
                    <Td><span className="font-mono text-xs text-slate-500">{r.id}</span></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.customer} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{r.customer}</p>
                          <p className="text-xs text-slate-400">{r.phone}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="font-medium">{r.unit}</p>
                      <p className="text-xs text-slate-400">{r.size} ft²</p>
                    </Td>
<<<<<<< Updated upstream
                    <Td><p>{r.appointmentDate} · {r.appointmentTime}</p><p className="text-[11px] text-stone-500">{lang === 'vi' ? 'Hạn cuối' : 'Deadline'}: {r.checkInDeadline}</p>{r.previousAppointment && <p className="text-[11px] text-amber-700">{lang === 'vi' ? 'Lịch cũ' : 'Previous'}: {r.previousAppointment}</p>}</Td>
                    <Td>{r.paid ? <Badge variant="success">{t('reservations.paid', 'Paid')}</Badge> : <Badge variant="error">{t('reservations.unpaid', 'Unpaid')}</Badge>}</Td>
                    <Td>{s(r.status, { CREATED: 'warning', REVIEW_REQUIRED: 'error', AWAITING_DEPOSIT: 'warning', DEPOSIT_PAID: 'info', UNIT_RESERVED: 'info', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'muted', EXPIRED: 'error' })}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{t('reservations.view', 'View')}</Button>
                        {r.status === 'REVIEW_REQUIRED' && <Button variant="primary" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{lang === 'vi' ? 'Rà soát ngoại lệ' : 'Review exception'}</Button>}
                        {r.status === 'CREATED' && <Badge variant="warning">{lang === 'vi' ? 'Theo dõi · chờ cọc' : 'Monitor only'}</Badge>}
                        {r.status === 'AWAITING_DEPOSIT' && <Badge variant="warning">{lang === 'vi' ? 'Chờ Customer thanh toán' : 'Awaiting customer deposit'}</Badge>}
                        {r.status === 'DEPOSIT_PAID' && <Badge variant="info">{lang === 'vi' ? 'Manager đang phân kho' : 'Manager allocation'}</Badge>}
=======
                    <Td><p>{formatDate(r.appointmentDate)} · {formatTime(r.appointmentTime)}</p><p className="text-[11px] text-stone-500">{'Hạn cuối'}: {formatDate(r.checkInDeadline)}</p>{r.previousAppointment && <p className="text-[11px] text-amber-700">{'Lịch cũ'}: {r.previousAppointment}</p>}</Td>
                    <Td>{r.paid ? <Badge variant="success">{'Đã thanh toán'}</Badge> : <Badge variant="error">{'Chưa thanh toán'}</Badge>}</Td>
                    <Td>{s(r.status, { CREATED: 'warning', REVIEW_REQUIRED: 'error', AWAITING_DEPOSIT: 'warning', DEPOSIT_PAID: 'info', UNIT_RESERVED: 'info', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'muted', EXPIRED: 'error' })}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{'Xem'}</Button>
                        {r.status === 'REVIEW_REQUIRED' && <Button variant="primary" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{'Rà soát ngoại lệ'}</Button>}
                        {r.status === 'CREATED' && <Badge variant="warning">{'Theo dõi · chờ cọc'}</Badge>}
                        {r.status === 'AWAITING_DEPOSIT' && <Badge variant="warning">{'Chờ khách hàng thanh toán'}</Badge>}
                        {r.status === 'DEPOSIT_PAID' && <Badge variant="info">{'Đã cọc · Chờ Nhận kho'}</Badge>}
>>>>>>> Stashed changes
                      </div>
                    </Td>
                  </Tr>
                ))}
                {filteredReservations.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-stone-500">{lang === 'vi' ? 'Không có hồ sơ phù hợp.' : 'No matching reservations.'}</td></tr>}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── CHECK-IN / HANDOVER ───────────────────────────────── */}
      {page === 'checkin' && (
        <div className="fade-in">
          <SectionHeader
<<<<<<< Updated upstream
            title={t('checkin.title', 'Check-in / Handover')}
            subtitle={t('checkin.subtitle', 'Process customer move-ins and unit handovers')}
=======
            title={'Nhận kho / Bàn giao'}
            subtitle={'Xử lý nhận kho và bàn giao kho cho khách'}
>>>>>>> Stashed changes
          />
          <div className="space-y-3">
            {eligibleCheckins.filter(c => c.status !== 'no-show').map(c => {
              const appointmentAt = new Date(`${c.appointmentDate} ${c.appointmentTime}`)
              const deadlineAt = new Date(c.checkInDeadline)
              const canMarkNoShow = (!Number.isNaN(appointmentAt.getTime()) && Date.now() > appointmentAt.getTime()) || (!Number.isNaN(deadlineAt.getTime()) && Date.now() > deadlineAt.getTime())
              return (
              <Card key={c.id} className="p-5">
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <Avatar name={c.customer} size="sm" />
                      <div>
                        <h3 className="font-semibold text-slate-900">{c.customer}</h3>
                        <p className="text-xs text-slate-500">{c.phone} · {c.email}</p>
<<<<<<< Updated upstream
                        <p className="text-xs text-slate-500">{c.facility} · Kho {c.unit} · {c.appointmentDate} lúc {c.appointmentTime}</p>
                        <p className="text-[11px] text-slate-500">{lang === 'vi' ? 'Hạn cuối Check-in' : 'Check-in deadline'}: {c.checkInDeadline}</p>
                        {c.previousAppointment && <p className="text-[11px] text-amber-700">{lang === 'vi' ? 'Lịch cũ' : 'Previous schedule'}: {c.previousAppointment}</p>}
                        {c.scheduleChanged && <Badge variant="warning">{lang === 'vi' ? 'Customer đã đổi lịch' : 'Customer rescheduled'}</Badge>}
                        <p className="mt-1 text-xs font-medium text-slate-600">{c.goodsType} · {c.packageCount} kiện · {c.weightKg} kg · DIM {c.dimWeightKg} kg</p>
=======
                        <p className="text-xs text-slate-500">{c.facility} · Kho {c.unit} · {formatDate(c.appointmentDate)} lúc {formatTime(c.appointmentTime)}</p>
                        <p className="text-[11px] text-slate-500">{'Hạn cuối Nhận kho'}: {formatDate(c.checkInDeadline)}</p>
                        {c.previousAppointment && <p className="text-[11px] text-amber-700">{'Lịch cũ'}: {c.previousAppointment}</p>}
                        {c.scheduleChanged && <Badge variant="warning">{'khách hàng đã đổi lịch'}</Badge>}
                        <p className="mt-1 text-xs font-medium text-slate-600">{c.goodsType} · {c.packageCount} kiện · {c.weightKg} kg · Khối lượng quy đổi {c.dimWeightKg} kg</p>
>>>>>>> Stashed changes
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s(c.status, { scheduled: 'info', 'pending-payment': 'warning', completed: 'success', 'no-show': 'error' })}
                    {c.status !== 'completed' && (
                      <Button variant="primary" size="sm" onClick={() => openCheckinRecord(c)}>
<<<<<<< Updated upstream
                        {t('checkin.process', 'Process Check-in')}
                      </Button>
                    )}
                    {c.status !== 'completed' && <Button variant="danger" size="sm" disabled={!canMarkNoShow} onClick={() => { setNoShowTarget(c); setNoShowReason('') }}>{lang === 'vi' ? 'Đánh dấu No-show' : 'Mark No-show'}</Button>}
                    {c.status === 'completed' && <Button variant="ghost" size="sm" onClick={() => showToast(lang === 'vi' ? `Hồ sơ ${c.id}: đã kích hoạt rental, đã lưu bằng chứng và đang chờ Customer xác nhận.` : `${c.id}: rental activated, evidence saved, awaiting customer confirmation.`)}>{t('checkin.viewRecord', 'View Record')}</Button>}
=======
                        {'Xử lý Nhận kho'}
                      </Button>
                    )}
                    {c.status !== 'completed' && <Button variant="danger" size="sm" disabled={!canMarkNoShow} onClick={() => { setNoShowTarget(c); setNoShowReason('') }}>{'Đánh dấu khách không đến'}</Button>}
                    {c.status === 'completed' && <Button variant="ghost" size="sm" onClick={() => showToast(`Hồ sơ ${c.id}: đã kích hoạt hợp đồng thuê, đã lưu bằng chứng và đang chờ khách hàng xác nhận.`)}>{'Xem hồ sơ'}</Button>}
>>>>>>> Stashed changes
                  </div>
                </div>
              </Card>
              )
            })}
          </div>
<<<<<<< Updated upstream
=======
          {scheduledRenewals.length > 0 && <div className="mt-8 space-y-3"><SectionHeader title="Lịch ký phụ lục gia hạn" subtitle="Thu phần tiền còn lại, tải phụ lục đã ký và kích hoạt thời hạn mới" />{scheduledRenewals.map(renewal => <Card key={renewal.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-slate-900">{renewal.unitId} · {renewal.customerName}</p><p className="text-xs text-slate-500">Hẹn {formatDate(renewal.appointmentDate)} lúc {formatTime(renewal.appointmentTime)} · Gia hạn đến {formatDate(renewal.newEndDate)}</p><p className="mt-1 text-xs font-medium text-amber-800">Còn thu tại cơ sở: {formatMoney(renewal.remainingAmount ?? 0)}</p></div><Button size="sm" onClick={() => { setSelectedRenewal(renewal); setRenewalContractFile(''); setRenewalContractNumber(`PL-${renewal.id}`); setRenewalPaymentReference(''); setRenewalIdentityVerified(false); setRenewalTermsVerified(false) }}>Hoàn tất gia hạn</Button></div></Card>)}</div>}
>>>>>>> Stashed changes
        </div>
      )}

      {/* ── RETURN INSPECTION ────────────────────────────────── */}
      {page === 'return' && (
        <div className="fade-in">
          <SectionHeader
            eyebrow={lang === 'vi' ? 'CỔNG NHÂN VIÊN · KIỂM KÊ & BẰNG CHỨNG' : 'STAFF PORTAL · INVENTORY & EVIDENCE'}
            title={t('return.title', 'Return Inspection')}
            subtitle={lang === 'vi' ? 'Đối chiếu hiện trạng trước–sau, kiểm kê hàng hóa, phân loại và lưu bằng chứng' : 'Compare before/after condition, inventory goods, classify and retain evidence'}
          />
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{t('return.col.id', 'Return ID')}</Th>
                  <Th>{t('return.col.customer', 'Customer')}</Th>
                  <Th>{t('return.col.unit', 'Unit')}</Th>
                  <Th>{t('return.col.date', 'Return Date')}</Th>
                  <Th>{t('return.col.condition', 'Condition')}</Th>
                  <Th>{t('return.col.deposit', 'Deposit')}</Th>
                  <Th>{t('return.col.status', 'Status')}</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {returns.map(r => (
                  <Tr key={r.id}>
                    <Td><span className="font-mono text-xs text-slate-500">{r.id}</span></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.customer} size="sm" />
                        <span className="text-sm font-medium">{r.customer}</span>
                      </div>
                    </Td>
                    <Td className="font-medium">{r.unit}</Td>
                    <Td>{r.status === 'pending' && !scheduledReturnIds.has(r.id) ? <input value={returnScheduleDrafts[r.id] ?? r.returnDate} onChange={event => setReturnScheduleDrafts(previous => ({ ...previous, [r.id]: event.target.value }))} className="w-32 rounded border border-stone-300 px-2 py-1 text-xs" aria-label={lang === 'vi' ? 'Lịch kiểm tra trả kho' : 'Return inspection schedule'} /> : (returnScheduleDrafts[r.id] ?? r.returnDate)}</Td>
                    <Td>
                      {r.condition === 'good'
                        ? <Badge variant="success">{lang === 'vi' ? 'Tốt' : 'Good'}</Badge>
                        : <Badge variant="error">{lang === 'vi' ? 'Hư hỏng' : 'Damaged'}</Badge>}
                      {r.damageNotes && <p className="text-xs text-red-500 mt-0.5">{r.damageNotes}</p>}
                    </Td>
                    <Td className="font-semibold">{formatMoney(r.deposit)}</Td>
                    <Td>{s(r.status, { pending: 'warning', 'waiting-customer': 'info', refunded: 'success' })}</Td>
                    <Td>
<<<<<<< Updated upstream
                      {r.status === 'pending' && !scheduledReturnIds.has(r.id) && <Button variant="primary" size="sm" onClick={() => { setScheduledReturnIds(previous => new Set(previous).add(r.id)); showToast(lang === 'vi' ? 'Đã xác nhận lịch kiểm tra trả kho.' : 'Return inspection schedule confirmed.') }}>{lang === 'vi' ? 'Xác nhận lịch' : 'Confirm schedule'}</Button>}
                      {r.status === 'pending' && scheduledReturnIds.has(r.id) && (
                        <Button variant="primary" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(false); setReturnInventory('match'); setReturnClassification('no-damage'); setReturnEvidence(''); setReturnNotes(r.finalCondition); setReturnActualPackages(String(r.packageCount)); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setReturnDamageFee('0'); setReturnCleaningFee('0'); setReturnLostItemFee('0'); setReturnOverdueFee('0'); setReturnOtherDebt('0'); setInspectModal(true) }}>
                          {t('return.action.inspect', 'Inspect')}
                        </Button>
                      )}
                      {r.status !== 'pending' && <Button variant="ghost" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(true); setReturnInventory('match'); setReturnClassification(r.classification === 'Chờ phân loại' ? 'no-damage' : r.classification); setReturnEvidence(r.evidence[r.evidence.length - 1] ?? ''); setReturnNotes(r.finalCondition); setReturnActualPackages(String(r.packageCount)); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setInspectModal(true) }}>{t('return.action.details', 'Details')}</Button>}
=======
                      {r.status === 'pending' && (
                        <Button variant="primary" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(false); setReturnInventory('match'); setReturnClassification('no-damage'); setReturnEvidence(''); setReturnNotes(r.finalCondition); setReturnActualPackages(r.packageCount > 0 ? String(r.packageCount) : ''); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setFeeDetails({}); setReturnDamageFee(''); setReturnCleaningFee(''); setReturnLostItemFee(''); setReturnOverdueFee(''); setReturnOtherDebt(''); setInspectModal(true) }}>
                          {'Nghiệm thu'}
                        </Button>
                      )}
                      {r.status !== 'pending' && <Button variant="ghost" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(true); const saved = hub.returns.find(item => item.id === r.id); setReturnDamageFee(String(saved?.damageFee ?? 0)); setReturnCleaningFee(String(saved?.cleaningFee ?? 0)); setReturnLostItemFee(String(saved?.lostItemFee ?? 0)); setReturnOverdueFee(String(saved?.overdueFee ?? 0)); setReturnOtherDebt(String(saved?.outstandingFee ?? 0)); setReturnInventory('match'); setReturnClassification(r.classification === 'Chờ phân loại' ? 'no-damage' : r.classification.replace(/_/g, '-')); setReturnEvidence(r.evidence[r.evidence.length - 1] ?? ''); setReturnNotes(r.finalCondition); setReturnActualPackages(String(r.packageCount)); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setInspectModal(true) }}>{'Chi tiết'}</Button>}
>>>>>>> Stashed changes
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── SUPPORT ───────────────────────────────────────────── */}
      {page === 'support' && (() => {
        const openCount = facilityTickets.filter(tItem => tItem.status === 'open').length
        const inProgressCount = facilityTickets.filter(tItem => tItem.status === 'in-progress').length
        const waitingCustomerCount = facilityTickets.filter(tItem => tItem.status === 'waiting-customer').length
        const resolvedCount = facilityTickets.filter(tItem => tItem.status === 'resolved').length
<<<<<<< Updated upstream
        const tabList = lang === 'vi' ? ['Mở Mới', 'Đang Xử Lý', 'Chờ Customer', 'Đã Giải Quyết'] : ['Open', 'In Progress', 'Waiting for Customer', 'Resolved']
        const tabStatus: Record<string, TicketStatus> = {
          'Mở Mới': 'open', Open: 'open',
          'Đang Xử Lý': 'in-progress', 'In Progress': 'in-progress',
          'Chờ Customer': 'waiting-customer', 'Waiting for Customer': 'waiting-customer',
          'Đã Giải Quyết': 'resolved', Resolved: 'resolved',
=======
        const tabList = ['Mở Mới', 'Đang Xử Lý', 'Chờ khách hàng', 'Đã Giải Quyết']
        const tabStatus: Record<string, TicketStatus> = {
          'Mở Mới': 'open',
          'Đang Xử Lý': 'in-progress',
          'Chờ khách hàng': 'waiting-customer',
          'Đã Giải Quyết': 'resolved',
>>>>>>> Stashed changes
        }
        const currentActiveTab = tabStatus[ticketTab] ?? 'open'
        const displayedTickets = facilityTickets.filter(tItem => tItem.status === currentActiveTab)
        const tabActive = tabList.find(tab => tabStatus[tab] === currentActiveTab) ?? tabList[0]

        return (
          <div className="fade-in space-y-5">
            <SectionHeader
              title={t('support.title', 'Support Queue & Dispatch')}
              subtitle={t('support.subtitle', 'Triage incoming tenant inquiries, resolve access glitches, and log resolutions')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title={t('support.stat.awaiting', 'Awaiting Response')}
                value={openCount}
                delta={openCount > 0 ? (lang === 'vi' ? 'Cần xử lý gấp' : 'Urgent triage') : (lang === 'vi' ? 'Đã giải quyết hết' : 'Clear queue')}
                deltaPositive={openCount === 0}
                icon={Icon.alert}
                iconBg="bg-amber-50 text-amber-800"
              />
              <StatCard
                title={t('support.stat.inProgress', 'In Progress')}
                value={inProgressCount}
                icon={Icon.refresh}
                iconBg="bg-blue-50 text-blue-700"
              />
<<<<<<< Updated upstream
              <StatCard title={lang === 'vi' ? 'Chờ Customer' : 'Waiting for Customer'} value={waitingCustomerCount} icon={Icon.support} iconBg="bg-violet-50 text-violet-700" />
=======
              <StatCard title={'Chờ khách hàng'} value={waitingCustomerCount} icon={Icon.support} iconBg="bg-violet-50 text-violet-700" />
>>>>>>> Stashed changes
              <StatCard
                title={t('support.stat.resolved', 'Resolved Tickets')}
                value={resolvedCount}
                icon={Icon.check}
                iconBg="bg-emerald-50 text-emerald-700"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Tabs
                tabs={tabList}
                active={tabActive}
                onChange={setTicketTab}
              />
            </div>

            <Card>
              <Table>
                <Thead>
                  <tr>
<<<<<<< Updated upstream
                    <Th>{t('support.col.id', 'Ticket ID')}</Th>
                    <Th>{t('support.col.tenant', 'Tenant Customer')}</Th>
                    <Th>{t('support.col.subject', 'Subject & Facility')}</Th>
                    <Th>{t('support.col.category', 'Category')}</Th>
                    <Th>{t('support.col.priority', 'Priority')}</Th>
                    <Th>{t('support.col.opened', 'Opened Date')}</Th>
                    <Th>{lang === 'vi' ? 'Staff phụ trách' : 'Assigned Staff'}</Th>
                    <Th>{t('support.col.status', 'Status')}</Th>
                    <Th className="text-right">{t('support.col.action', 'Action')}</Th>
=======
                    <Th>{'Mã phiếu'}</Th>
                    <Th>{'Khách hàng'}</Th>
                    <Th>{'Nội dung và cơ sở'}</Th>
                    <Th>{'Danh mục'}</Th>
                    <Th>{'Mức độ'}</Th>
                    <Th>{'Ngày mở'}</Th>
                    <Th>{'nhân viên phụ trách'}</Th>
                    <Th>{'Trạng thái'}</Th>
                    <Th className="text-right">{'Thao tác'}</Th>
>>>>>>> Stashed changes
                  </tr>
                </Thead>
                <Tbody>
                  {displayedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-stone-400 text-sm">
                        {t('support.empty', 'No tickets currently in this queue.')}
                      </td>
                    </tr>
                  ) : (
                    displayedTickets.map(tItem => (
                      <Tr key={tItem.id}>
                        <Td><span className="font-mono text-xs font-semibold text-stone-600">{tItem.id}</span></Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Avatar name={tItem.customer} size="sm" />
                            <div>
                              <span className="text-sm font-medium text-stone-900 block">{tItem.customer}</span>
                              <span className="text-[11px] text-stone-400">{tItem.email}</span>
                            </div>
                          </div>
                        </Td>
                        <Td className="max-w-xs">
                          <p className="font-medium text-sm text-stone-800 truncate">{tItem.subject}</p>
                          <p className="text-xs text-stone-400">{tItem.facility} · Gian kho {tItem.unit}</p>
                        </Td>
                        <Td><Badge variant="muted">{tItem.category}</Badge></Td>
                        <Td>{s(tItem.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td>
                        <Td className="text-xs text-stone-500">{formatDateTime(tItem.created)}</Td>
                        <Td>
                          {assignedStaffByTicket[tItem.id]
                            ? <div className="flex items-center gap-2"><Avatar name={assignedStaffByTicket[tItem.id]} size="sm" /><span className="text-xs font-medium text-stone-700">{assignedStaffByTicket[tItem.id]}</span></div>
<<<<<<< Updated upstream
                            : <span className="text-xs italic text-stone-400">{lang === 'vi' ? 'Chưa có Staff nhận' : 'Unassigned'}</span>}
=======
                            : <span className="text-xs italic text-stone-400">{'Chưa có nhân viên nhận'}</span>}
>>>>>>> Stashed changes
                        </Td>
                        <Td>{s(tItem.status, { open: 'info', 'in-progress': 'warning', 'waiting-customer': 'info', resolved: 'success' })}</Td>
                        <Td className="text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedStaffTicket(tItem)
                              setTicketNewStatus(tItem.status)
                              setTicketEvidence('')
                              setTicketEscalated(false)
                              setTicketEscalationReason('')
                              setRespondModal(true)
                            }}
                          >
                            {t('support.respond', 'Respond')} ({tItem.messages?.length ?? 1})
                          </Button>
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </Card>
          </div>
        )
      })()}

      {/* ── PROFILE PAGE ─────────────────────────────────────── */}
      {page === 'profile' && (
        <div className="fade-in">
          <ProfileView user={user} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-[100] bg-white text-stone-800 p-4 rounded-xl shadow-2xl border border-stone-200 flex items-start gap-3 fade-in">
          <span className="rounded-full bg-blue-50 px-2 py-1 font-bold text-blue-700" aria-hidden="true">i</span>
          <div className="flex-1"><p className="mb-1 text-sm font-bold">Thông báo xử lý</p><p className="text-sm leading-relaxed">{toast}</p></div><button type="button" aria-label="Đóng thông báo" className="px-2 text-stone-500" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}
<<<<<<< Updated upstream
      <Modal open={reservationModal} onClose={() => setReservationModal(false)} size="xl" title={lang === 'vi' ? 'Hồ Sơ Yêu Cầu Giữ Kho' : 'Storage Hold Request'}>
=======
      <Modal closeLabel="Đóng hộp thoại" open={reservationModal} onClose={() => setReservationModal(false)} size="xl" title={'Hồ Sơ Yêu Cầu Giữ Kho'}>
>>>>>>> Stashed changes
        {selectedReservation && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Khách hàng</p><b>{selectedReservation.customer}</b><p className="text-xs">{selectedReservation.phone}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Thư điện tử</p><b>{selectedReservation.email}</b><p className="text-xs">{selectedReservation.emailVerified ? '✓ Đã xác nhận' : '⚠ Chưa xác nhận'}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Cơ sở / kho</p><b>{selectedReservation.facility} · {selectedReservation.unit}</b><p className="text-xs">{selectedReservation.facilityAddress}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">CCCD</p><b>{selectedReservation.identityId}</b><p className="text-xs">Đối chiếu bản gốc khi nhận kho</p></div>
            </div>
<<<<<<< Updated upstream
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{lang === 'vi' ? 'Trạng thái chuẩn' : 'Canonical status'}:</b> {statusLabelMap[lang][selectedReservation.status]}</span><span><b>{lang === 'vi' ? 'Lịch Check-in' : 'Check-in'}:</b> {selectedReservation.appointmentDate} · {selectedReservation.appointmentTime}</span><span><b>{lang === 'vi' ? 'Hạn cuối' : 'Deadline'}:</b> {selectedReservation.checkInDeadline}</span></div><p className="mt-2 text-xs text-blue-800">{lang === 'vi' ? 'Staff không phê duyệt đơn hợp lệ. CREATED chỉ theo dõi thanh toán; DEPOSIT_PAID chờ Manager phân kho.' : 'Staff does not approve valid reservations. CREATED is monitored for payment; DEPOSIT_PAID awaits manager allocation.'}</p></div>
            {selectedReservation.status === 'REVIEW_REQUIRED' && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">{lang === 'vi' ? 'Ngoại lệ cần rà soát' : 'Review-required exception'}</p><p className="mt-1">{lang === 'vi' ? 'Email Customer chưa xác nhận và hồ sơ chưa đủ điều kiện thanh toán cọc. Staff phải kiểm tra thông tin, hàng khai báo và lý do ngoại lệ trước khi quyết định.' : 'Customer email is not verified and the reservation is not ready for deposit. Staff must review the customer, declared goods and exception reason before deciding.'}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="sm" onClick={() => { const updated = { ...selectedReservation, status: 'AWAITING_DEPOSIT' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast(lang === 'vi' ? 'Đã duyệt ngoại lệ; hồ sơ chuyển sang chờ Customer thanh toán cọc.' : 'Exception approved; reservation is awaiting the customer deposit.') }}>{lang === 'vi' ? 'Duyệt → chờ cọc' : 'Approve → Awaiting Deposit'}</Button><Button variant="danger" size="sm" onClick={() => { const updated = { ...selectedReservation, status: 'CANCELLED' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast(lang === 'vi' ? 'Đã từ chối ngoại lệ và hủy hồ sơ.' : 'Exception rejected and reservation cancelled.') }}>{lang === 'vi' ? 'Từ chối' : 'Reject'}</Button></div></div>}
=======
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{'Trạng thái chuẩn'}:</b> {statusLabelMap[selectedReservation.status]}</span><span><b>{'Lịch Nhận kho'}:</b> {formatDate(selectedReservation.appointmentDate)} · {formatTime(selectedReservation.appointmentTime)}</span><span><b>{'Hạn cuối'}:</b> {formatDate(selectedReservation.checkInDeadline)}</span></div><p className="mt-2 text-xs text-blue-800">{'nhân viên theo dõi hồ sơ và chuẩn bị Nhận kho. Gian kho cụ thể đã được khách chọn từ đầu.'}</p></div>
            {selectedReservation.status === 'REVIEW_REQUIRED' && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">{'Hồ sơ cần nhân viên rà soát'}</p><p className="mt-1">{'Nhân viên kiểm tra thông tin, hàng khai báo và bằng chứng trước khi quyết định.'}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="sm" onClick={() => { try { if (hub.holds.some(item => item.id === selectedReservation.id)) hub.approveReservation(selectedReservation.id, user); const updated = { ...selectedReservation, status: 'AWAITING_DEPOSIT' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast('Đã duyệt hồ sơ; khách hàng được mở bước thanh toán cọc.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể duyệt hồ sơ.') } }}>{'Duyệt → chờ cọc'}</Button>{(!hub.holds.some(item => item.id === selectedReservation.id) || hub.holds.find(item => item.id === selectedReservation.id)?.goodsReviewStatus === 'PENDING') && <Button variant="danger" size="sm" onClick={() => { try { if (hub.holds.some(item => item.id === selectedReservation.id)) hub.rejectGoodsReview(selectedReservation.id, user, 'Hàng hóa chưa phù hợp điều kiện lưu trữ.'); const updated = { ...selectedReservation, status: 'CANCELLED' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast('Đã từ chối ngoại lệ và giải phóng yêu cầu giữ kho.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể từ chối hồ sơ.') } }}>{'Từ chối'}</Button>}</div></div>}
>>>>>>> Stashed changes
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-slate-500">Loại hàng</p><b>{selectedReservation.goodsType}</b></div>
              <div><p className="text-xs text-slate-500">Chất liệu</p><b>{selectedReservation.material}</b></div>
              <div><p className="text-xs text-slate-500">Số kiện / cân thực</p><b>{selectedReservation.packageCount} / {selectedReservation.weightKg} kg</b></div>
              <div><p className="text-xs text-slate-500">Kích thước / DIM</p><b>{selectedReservation.dimensionsCm} cm / {selectedReservation.dimWeightKg} kg</b></div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><b>Hiện trạng khai báo ban đầu:</b> {selectedReservation.initialCondition}</div>
            <div><p className="mb-2 text-sm font-semibold">Dẫn chứng hoạt động</p>{selectedReservation.evidence.map(item => <p key={item} className="mb-1 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">✓ {item}</p>)}</div>
            {!selectedReservation.emailVerified && <Button onClick={() => showToast(`Đã gửi lại thư điện tử xác nhận đến ${selectedReservation.email}`)}>Gửi lại thư điện tử xác nhận</Button>}
          </div>
        )}
      </Modal>

<<<<<<< Updated upstream
      <Modal open={inspectModal} onClose={() => setInspectModal(false)} size="xl" title={lang === 'vi' ? 'Nghiệm Thu Phòng Kho Trả' : 'Unit Inspection'}>
=======
      <Modal closeLabel="Đóng hộp thoại" open={inspectModal} onClose={() => setInspectModal(false)} size="xl" title={'Nghiệm Thu Phòng Kho Trả'}>
>>>>>>> Stashed changes
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('return.col.customer', 'Customer')}</span>
                <span className="font-medium">{selectedReturn.customer}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{t('return.col.unit', 'Unit')}</span>
                <span className="font-medium">{selectedReturn.unit}</span>
              </div>
              <div className="flex justify-between mt-1">
<<<<<<< Updated upstream
                <span className="text-slate-500">{t('return.col.deposit', 'Deposit')}</span>
                <span className="font-semibold">${selectedReturn.deposit}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>{lang === 'vi' ? 'Kỳ thuê' : 'Lease term'}:</b> {selectedReturn.contractStart} → {selectedReturn.contractEnd}</span>
                <span><b>{lang === 'vi' ? 'Ngày Customer yêu cầu trả' : 'Requested return'}:</b> {selectedReturn.returnDate}</span>
                <span className="sm:col-span-2"><b>{lang === 'vi' ? 'Lý do' : 'Reason'}:</b> {selectedReturn.requestReason}</span>
=======
                <span className="text-slate-500">{'Tiền cọc'}</span>
                <span className="font-semibold">{formatMoney(selectedReturn.deposit)}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>{'Kỳ thuê'}:</b> {formatDate(selectedReturn.contractStart)} → {formatDate(selectedReturn.contractEnd)}</span>
                <span><b>{'Ngày khách hàng yêu cầu trả'}:</b> {formatDate(selectedReturn.returnDate)}</span>
                <span className="sm:col-span-2"><b>{'Lý do'}:</b> {selectedReturn.requestReason}</span>
>>>>>>> Stashed changes
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="mb-2 font-semibold">Đối chiếu giao dịch trước – sau</p>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-slate-500">Lúc nhận kho</p><p>{selectedReturn.initialCondition}</p><p>{selectedReturn.packageCount} kiện · {selectedReturn.initialWeightKg} kg</p></div>
                <div><p className="text-xs text-slate-500">Lúc trả kho</p><p>{selectedReturn.finalCondition}</p><p>{selectedReturn.packageCount} kiện · {selectedReturn.finalWeightKg} kg</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">{lang === 'vi' ? 'Kết quả kiểm kê' : 'Inventory result'}</label><select disabled={returnDetailsOnly} value={returnInventory} onChange={event => setReturnInventory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="match">{lang === 'vi' ? 'Khớp khai báo' : 'Matches declaration'}</option><option value="missing">{lang === 'vi' ? 'Thiếu / đã lấy ra' : 'Missing / removed'}</option><option value="damaged">{lang === 'vi' ? 'Có hàng hư hỏng' : 'Damaged goods'}</option><option value="abandoned">{lang === 'vi' ? 'Có hàng bỏ lại' : 'Abandoned goods'}</option></select></div>
              <div><label className="text-sm font-medium">{lang === 'vi' ? 'Phân loại hiện trạng' : 'Condition classification'}</label><select disabled={returnDetailsOnly} value={returnClassification} onChange={event => setReturnClassification(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="no-damage">{lang === 'vi' ? 'Không hư hại' : 'No Damage'}</option><option value="minor-damage">{lang === 'vi' ? 'Hư hại nhẹ' : 'Minor Damage'}</option><option value="major-damage">{lang === 'vi' ? 'Hư hại nặng' : 'Major Damage'}</option><option value="requires-maintenance">{lang === 'vi' ? 'Cần bảo trì' : 'Requires Maintenance'}</option></select></div>
            </div>
<<<<<<< Updated upstream
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input label={lang === 'vi' ? 'Số kiện thực tế lúc trả' : 'Actual returned packages'} type="number" value={returnActualPackages} onChange={event => setReturnActualPackages(event.target.value)} /><Input label={lang === 'vi' ? 'PIN/thẻ/chìa khóa thu hồi' : 'Returned PIN/card/keys'} value={returnKeys} onChange={event => setReturnKeys(event.target.value)} /></div>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><b>{lang === 'vi' ? 'Bằng chứng bàn giao ban đầu (bất biến)' : 'Immutable initial handover evidence'}:</b> {selectedReturn.evidence.join(' · ')}</div>
            <Input disabled={returnDetailsOnly} label={lang === 'vi' ? 'Ảnh/bằng chứng trả kho mới (mã tệp hoặc đường dẫn)' : 'New return evidence (file reference or URL)'} value={returnEvidence} onChange={event => setReturnEvidence(event.target.value)} />
            <div className="rounded-lg border border-stone-200 p-3"><p className="mb-3 text-sm font-semibold">{lang === 'vi' ? 'Các khoản khấu trừ đề xuất' : 'Proposed deductions'}</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Input label={lang === 'vi' ? 'Hư hại' : 'Damage'} type="number" value={returnDamageFee} onChange={event => setReturnDamageFee(event.target.value)} /><Input label={lang === 'vi' ? 'Vệ sinh' : 'Cleaning'} type="number" value={returnCleaningFee} onChange={event => setReturnCleaningFee(event.target.value)} /><Input label={lang === 'vi' ? 'Thất lạc' : 'Lost items'} type="number" value={returnLostItemFee} onChange={event => setReturnLostItemFee(event.target.value)} /><Input label={lang === 'vi' ? 'Quá hạn' : 'Overdue'} type="number" value={returnOverdueFee} onChange={event => setReturnOverdueFee(event.target.value)} /><Input label={lang === 'vi' ? 'Công nợ khác' : 'Other debt'} type="number" value={returnOtherDebt} onChange={event => setReturnOtherDebt(event.target.value)} /></div><div className="mt-3 flex flex-wrap justify-between gap-2 rounded bg-slate-50 p-3 text-sm"><span>{lang === 'vi' ? 'Tổng khấu trừ' : 'Total deductions'}: <b>${returnTotalDeductions.toFixed(2)}</b></span><span>{lang === 'vi' ? 'Tiền cọc hoàn lại đề xuất' : 'Proposed refund'}: <b className="text-emerald-700">${returnRefund.toFixed(2)}</b></span></div></div>
=======
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input disabled={returnDetailsOnly} label={'Số kiện thực tế lúc trả'} type="number" value={returnActualPackages} onChange={event => setReturnActualPackages(event.target.value)} /><Input disabled={returnDetailsOnly} label={'Mã truy cập/thẻ/chìa khóa thu hồi'} value={returnKeys} onChange={event => setReturnKeys(event.target.value)} /></div>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><b>{'Bằng chứng bàn giao ban đầu (bất biến)'}:</b> {selectedReturn.evidence.join(' · ')}</div>
            <Input disabled={returnDetailsOnly} label={'Ảnh/bằng chứng trả kho mới (mã tệp hoặc đường dẫn)'} value={returnEvidence} onChange={event => setReturnEvidence(event.target.value)} />
            <section className="rounded-xl border border-stone-200 p-4" aria-label="Chi tiết các khoản khấu trừ">
              <h3 className="font-semibold">Chi tiết các khoản khấu trừ đề xuất</h3>
              <p className="mt-1 text-xs text-stone-600">Đơn vị: đô la Mỹ, theo hồ sơ thuê. Nhập chi phí thực tế theo hợp đồng hoặc chứng từ; khoản không phát sinh để 0. Nhập số lượng và đơn giá để tự tính thành tiền. Ghi căn cứ tính phí trong biên bản bên dưới.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Phí hư hại', hint: 'Số hạng mục hư hỏng × chi phí sửa chữa hoặc thay thế từng hạng mục.', value: returnDamageFee, set: setReturnDamageFee },
                  { label: 'Phí vệ sinh', hint: 'Số lần hoặc diện tích cần vệ sinh × đơn giá đã thỏa thuận.', value: returnCleaningFee, set: setReturnCleaningFee },
                  { label: 'Phí thất lạc', hint: 'Số chìa khóa, thẻ hoặc vật dụng bị mất × đơn giá cấp lại.', value: returnLostItemFee, set: setReturnLostItemFee },
                  { label: 'Phí quá hạn', hint: 'Số ngày quá hạn × mức phí mỗi ngày theo hợp đồng.', value: returnOverdueFee, set: setReturnOverdueFee },
                  { label: 'Công nợ khác', hint: 'Tổng các khoản chưa thanh toán; ghi rõ từng khoản, không tính trùng phí ở trên.', value: returnOtherDebt, set: setReturnOtherDebt },
                ].map(fee => <StaffFeeField key={selectedReturn.id + String(returnDetailsOnly) + fee.label} label={fee.label} hint={fee.hint} value={fee.value} onChange={fee.set} onDetailChange={detail => setFeeDetails(previous => ({ ...previous, [fee.label]: detail }))} disabled={returnDetailsOnly} />)}
              </div>
              {!returnFeesValid && <p role="alert" className="mt-3 text-sm text-red-700">Mỗi khoản phí phải là số tiền hợp lệ, không âm và có tối đa hai chữ số thập phân.</p>}
              <dl className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between gap-3"><dt>Tiền cọc đã thu</dt><dd>{formatMoney(selectedReturn.deposit)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Tổng khấu trừ (cộng 5 khoản phí)</dt><dd className="font-semibold">{formatMoney(returnTotalDeductions)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-stone-200 pt-2"><dt>Tiền cọc hoàn lại = tiền cọc − khấu trừ (tối thiểu 0)</dt><dd className="font-bold text-emerald-700">{formatMoney(returnRefund)}</dd></div>
                {returnTotalDeductions > selectedReturn.deposit && <div className="flex justify-between gap-3 text-red-700"><dt>Khách cần thanh toán thêm</dt><dd className="font-bold">{formatMoney(returnTotalDeductions - selectedReturn.deposit)}</dd></div>}
              </dl>
            </section>
>>>>>>> Stashed changes
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'vi' ? 'Biên Bản Ghi Chú Hiện Trường' : 'Inspection Notes'}
              </label>
              <textarea
                rows={3}
                disabled={returnDetailsOnly}
                value={returnNotes}
                onChange={event => setReturnNotes(event.target.value)}
                placeholder={lang === 'vi' ? 'Ghi rõ chi tiết hư hại, đồ còn sót lại hoặc vết bẩn...' : 'Document any damage or issues...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

<<<<<<< Updated upstream
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{lang === 'vi' ? 'Sau khi Staff gửi, hồ sơ chuyển sang “Chờ Customer xác nhận”. Staff không đóng hồ sơ hoặc hoàn cọc thay Customer.' : 'After submission, the record moves to “Waiting for Customer”. Staff cannot close the record or refund the deposit for the customer.'}</div>
=======
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{'Sau khi nhân viên gửi, hồ sơ chuyển sang “Chờ khách hàng xác nhận”. Nhân viên không đóng hồ sơ hoặc hoàn cọc thay khách hàng.'}</div>
>>>>>>> Stashed changes
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setInspectModal(false)}>{returnDetailsOnly ? (lang === 'vi' ? 'Đóng' : 'Close') : t('btn.cancel', 'Cancel')}</Button>
              {!returnDetailsOnly && <Button
                variant="primary"
                disabled={!returnFeesValid || !returnActualPackages.trim() || !returnEvidence.trim() || !returnNotes.trim() || !returnKeys.trim() || Number(returnActualPackages) < 0}
                onClick={() => {
<<<<<<< Updated upstream
                  setReturns(items => items.map(item => item.id === selectedReturn.id ? { ...item, status: 'waiting-customer', finalCondition: returnNotes.trim(), packageCount: Number(returnActualPackages), classification: returnClassification, evidence: [...item.evidence, returnEvidence.trim(), `EV-OUT-${Date.now()} · ${user.name} lập biên bản ${returnInventory}, ${returnClassification}; thu hồi ${returnKeys}; khấu trừ $${returnTotalDeductions}; hoàn đề xuất $${returnRefund}`] } : item))
                  setInspectModal(false)
                  showToast(lang === 'vi' ? 'Đã gửi biên bản; đang chờ Customer xác nhận trước khi hoàn cọc.' : 'Inspection submitted; waiting for customer confirmation before refund.')
=======
                  if (!returnFeesValid) { showToast('Vui lòng kiểm tra lại các khoản phí trước khi lưu biên bản.'); return }
                  const damageClassification = returnClassification === 'minor-damage'
                    ? 'minor_damage'
                    : returnClassification === 'major-damage'
                      ? 'major_damage'
                      : returnClassification === 'requires-maintenance'
                        ? 'major_damage'
                        : 'no_damage'
                  try {
                    hub.completeReturnInspection({
                      returnId: selectedReturn.id,
                      staffUser: user,
                      inventoryMatch: returnInventory as 'match' | 'missing' | 'excess',
                      damageClassification,
                      damageFee: Number(returnDamageFee) || 0,
                      cleaningFee: Number(returnCleaningFee) || 0,
                      lostItemFee: Number(returnLostItemFee) || 0,
                      overdueFee: Number(returnOverdueFee) || 0,
                      outstandingFee: Number(returnOtherDebt) || 0,
                      staffNotes: [returnNotes.trim(), ...Object.values(feeDetails)].filter(Boolean).join('\n'),
                      evidencePhotos: [returnEvidence.trim(), `EV-OUT-${Date.now()} · ${user.name} lập biên bản; thu hồi ${returnKeys}`],
                      returnedItems: { key: true, card: true, lock: true },
                    })
                    setInspectModal(false)
                    showToast('Đã gửi biên bản; khách hàng đã nhận được yêu cầu xác nhận quyết toán.')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể hoàn tất nghiệm thu trả kho.')
                  }
>>>>>>> Stashed changes
                }}
              >
                {t('return.submit', 'Submit Inspection')}
              </Button>}
            </div>
          </div>
        )}
      </Modal>

<<<<<<< Updated upstream
      <Modal open={checkinModal} onClose={() => setCheckinModal(false)} size="xl" title={lang === 'vi' ? 'Đối Chiếu & Xác Nhận Check-in Kho' : 'Verify Storage Check-in'}>
=======
      <Modal closeLabel="Đóng hộp thoại" open={checkinModal} onClose={() => setCheckinModal(false)} size="xl" title={'Đối chiếu và xác nhận nhận kho'}>
>>>>>>> Stashed changes
        {selectedCheckin && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('reservations.col.customer', 'Customer')}</span>
                <span className="font-medium">{selectedCheckin.customer}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{t('reservations.col.unit', 'Unit')}</span>
                <span className="font-medium">{selectedCheckin.unit}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>Thư điện tử:</b> {selectedCheckin.email}</span><span><b>SĐT:</b> {selectedCheckin.phone}</span>
                <span><b>CCCD:</b> {selectedCheckin.identityId}</span><span><b>Cơ sở:</b> {selectedCheckin.facility}</span>
                <span><b>Hàng:</b> {selectedCheckin.goodsType}</span><span><b>Chất liệu:</b> {selectedCheckin.material}</span>
<<<<<<< Updated upstream
                <span><b>Số kiện:</b> {selectedCheckin.packageCount}</span><span><b>Cân thực / DIM:</b> {selectedCheckin.weightKg} / {selectedCheckin.dimWeightKg} kg</span>
                <span><b>{lang === 'vi' ? 'Lịch hiện tại' : 'Current appointment'}:</b> {selectedCheckin.appointmentDate} · {selectedCheckin.appointmentTime}</span><span><b>{lang === 'vi' ? 'Hạn Check-in' : 'Check-in deadline'}:</b> {selectedCheckin.checkInDeadline}</span>
              </div>
            </div>
            {selectedCheckin.scheduleChanged && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>{lang === 'vi' ? 'Customer đã đổi lịch.' : 'Customer rescheduled.'}</b> {selectedCheckin.previousAppointment && `${lang === 'vi' ? 'Lịch cũ' : 'Previous'}: ${selectedCheckin.previousAppointment}. `}{lang === 'vi' ? 'Hãy dùng lịch mới nhất và kiểm tra lại xung đột gian kho.' : 'Use the latest appointment and recheck unit conflicts.'}</div>}
            {isOutsideAppointmentDate && <Input label={lang === 'vi' ? 'Lý do override ngoài ngày hẹn (bắt buộc)' : 'Out-of-schedule override reason (required)'} value={scheduleOverrideReason} onChange={event => setScheduleOverrideReason(event.target.value)} />}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><b>{lang === 'vi' ? 'Khai báo cần đối chiếu' : 'Declared goods'}:</b> {selectedCheckin.dimensionsCm} cm · {selectedCheckin.weightKg} kg · {selectedCheckin.material} · {selectedCheckin.initialCondition}</div>
            <div className="rounded-lg border border-stone-200 p-3 space-y-3"><p className="font-semibold text-sm">{lang === 'vi' ? 'Số đo và tình trạng thực tế' : 'Actual goods measurement & condition'}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label={lang === 'vi' ? 'Kích thước thực tế (D × R × C cm)' : 'Actual dimensions (L × W × H cm)'} value={actualDimensions} onChange={event => setActualDimensions(event.target.value)} /><Input label={lang === 'vi' ? 'Khối lượng thực tế (kg)' : 'Actual weight (kg)'} type="number" value={actualWeight} onChange={event => setActualWeight(event.target.value)} /><Input label={lang === 'vi' ? 'Vật liệu thực tế' : 'Actual material'} value={actualMaterial} onChange={event => setActualMaterial(event.target.value)} /><Input label={lang === 'vi' ? 'Hiện trạng kho ban đầu / hư hại có sẵn' : 'Initial unit condition / existing damage'} value={actualCondition} onChange={event => setActualCondition(event.target.value)} /></div><Input label={lang === 'vi' ? 'Ảnh/bằng chứng bàn giao (mã tệp hoặc đường dẫn)' : 'Handover evidence (file reference or URL)'} value={checkinEvidence} onChange={event => setCheckinEvidence(event.target.value)} /></div>
            {fitEvaluation && <div className="rounded-lg border border-stone-200 p-3 text-sm"><p className="font-semibold">{lang === 'vi' ? 'Kiểm tra khả năng tiếp nhận thực tế' : 'Actual fit validation'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span>{lang === 'vi' ? 'Cửa kho' : 'Door'}: {fitEvaluation.spec.doorWidth} × {fitEvaluation.spec.doorHeight} cm</span><span>{lang === 'vi' ? 'Lọt lòng' : 'Interior'}: {fitEvaluation.spec.inner.join(' × ')} cm</span><span>{lang === 'vi' ? 'Tải trọng tối đa' : 'Maximum load'}: {fitEvaluation.spec.maxWeight} kg</span><span>{lang === 'vi' ? 'Kích thước kiện lớn nhất' : 'Largest package'}: {actualDimensions || '—'} cm</span></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant={fitEvaluation.doorFits ? 'success' : 'error'}>{fitEvaluation.doorFits ? (lang === 'vi' ? 'Đã kiểm tra lọt cửa khi xoay' : 'Fits door when rotated') : (lang === 'vi' ? 'Không lọt cửa' : 'Does not fit door')}</Badge><Badge variant={fitEvaluation.weightFits ? 'success' : 'error'}>{fitEvaluation.weightFits ? (lang === 'vi' ? 'Đạt tải trọng' : 'Within load') : (lang === 'vi' ? 'Vượt tải trọng' : 'Overweight')}</Badge><Badge variant={fitEvaluation.volumeFits ? 'success' : 'error'}>{fitEvaluation.volumeFits ? (lang === 'vi' ? 'Đạt thể tích/kích thước' : 'Fits interior') : (lang === 'vi' ? 'Vượt thể tích' : 'Exceeds interior')}</Badge></div>{(!fitEvaluation.doorFits || !fitEvaluation.weightFits || !fitEvaluation.volumeFits) && <p className="mt-2 font-medium text-red-700">{lang === 'vi' ? 'Không thể hoàn tất Check-in. Hãy yêu cầu Manager đổi cỡ kho hoặc gian kho khác.' : 'Check-in is blocked. Request a different size or unit from the manager.'}</p>}</div>}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm"><p className="font-semibold text-emerald-900">{lang === 'vi' ? 'Hợp đồng và thanh toán phần còn lại' : 'Contract and remaining payment'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span><b>{lang === 'vi' ? 'Mã đơn' : 'Reservation'}:</b> {selectedCheckin.reservationId}</span><span><b>{lang === 'vi' ? 'Mã hợp đồng' : 'Contract'}:</b> CTR-{selectedCheckin.reservationId}</span><span><b>{lang === 'vi' ? 'Cơ sở / gian kho' : 'Facility / unit'}:</b> {selectedCheckin.facility} · {selectedCheckin.unit}</span><span><b>{lang === 'vi' ? 'Ngày bàn giao' : 'Handover'}:</b> {selectedCheckin.appointmentDate} · {selectedCheckin.appointmentTime}</span><span><b>{lang === 'vi' ? 'Tiền cọc' : 'Deposit'}:</b> {reservationForCheckin?.paid ? '20% · đã thu' : 'Chưa xác nhận'}</span><span><b>{lang === 'vi' ? 'Người thu' : 'Collected by'}:</b> {user.name}</span></div><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><Input label={lang === 'vi' ? 'File scan hợp đồng đã ký' : 'Signed contract scan'} value={contractFile} onChange={event => setContractFile(event.target.value)} /><Input label={lang === 'vi' ? 'Mã giao dịch phần còn lại' : 'Remaining-payment reference'} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} /><Input label={lang === 'vi' ? 'Ảnh/chứng từ thanh toán' : 'Payment evidence'} value={paymentEvidence} onChange={event => setPaymentEvidence(event.target.value)} /></div></div>
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              {([
                ['identity', lang === 'vi' ? 'Đã đối chiếu CCCD/Hộ chiếu gốc' : 'Original ID/passport verified'],
                ['reservation', lang === 'vi' ? 'Đơn ở trạng thái UNIT_RESERVED/READY_FOR_CHECKIN, đúng cơ sở và lịch' : 'Reservation is UNIT_RESERVED/READY_FOR_CHECKIN with correct facility and schedule'],
                ['contract', lang === 'vi' ? 'Hợp đồng đã được Customer ký và lưu bản scan' : 'Contract signed by Customer and scan retained'],
                ['payment', lang === 'vi' ? 'Đã thu đủ phần còn lại và phát hành biên nhận' : 'Remaining balance collected and receipt issued'],
                ['measurement', lang === 'vi' ? 'Đã đo hàng thực tế và xử lý chênh lệch' : 'Actual goods measured and variances reviewed'],
                ['walkthrough', lang === 'vi' ? 'Đã walkthrough gian kho với Customer' : 'Unit walkthrough completed with Customer'],
                ['condition', lang === 'vi' ? 'Đã kiểm tra tường, sàn, cửa, khóa, đèn, vệ sinh và hư hại sẵn có' : 'Walls, floor, door, lock, lighting, cleanliness and existing damage checked'],
                ['credential', lang === 'vi' ? `Đã cấp PIN/thẻ/chìa khóa cho kho ${selectedCheckin.unit}` : `PIN/card/key issued for unit ${selectedCheckin.unit}`]
              ] as Array<[string, string]>).map(([key, label]) => <label key={key} className="flex items-start gap-3 cursor-pointer text-left"><input type="checkbox" checked={Boolean(checkinChecks[key])} onChange={event => setCheckinChecks(previous => ({ ...previous, [key]: event.target.checked }))} className="!w-4 !h-4 flex-none shrink-0 mt-0.5 accent-blue-600" /><span className="min-w-0 flex-1 text-left text-sm leading-5 text-slate-700">{label}</span></label>)}
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs"><b>{lang === 'vi' ? 'Thông tin credential' : 'Credential record'}:</b> {`PIN-${selectedCheckin.id}`} · {selectedCheckin.unit} · {selectedCheckin.customer} · {user.name} · {lang === 'vi' ? 'kích hoạt khi hoàn tất check-in' : 'activates on check-in completion'}</div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{lang === 'vi' ? 'Staff hoàn tất Check-in để kích hoạt rental. Customer sẽ tự bấm “Tôi đã nhận kho”; trước thời điểm đó hồ sơ mang nhãn “Chờ khách xác nhận bàn giao”.' : 'Staff completes check-in to activate the rental. Customer confirms receipt separately; until then the record remains “Awaiting customer handover confirmation”.'}</div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">{lang === 'vi' ? 'Ghi chú bàn giao' : 'Handover notes'}</label><textarea rows={2} value={checkinNotes} onChange={event => setCheckinNotes(event.target.value)} placeholder={lang === 'vi' ? 'Ghi rõ chênh lệch hàng hóa hoặc lưu ý vận hành...' : 'Record goods variances or operational notes...'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
=======
                <span><b>Số kiện:</b> {selectedCheckin.packageCount}</span><span><b>Khối lượng thực tế / quy đổi:</b> {selectedCheckin.weightKg} / {selectedCheckin.dimWeightKg} kg</span>
                <span><b>{'Lịch hiện tại'}:</b> {formatDate(selectedCheckin.appointmentDate)} · {formatTime(selectedCheckin.appointmentTime)}</span><span><b>{'Hạn Nhận kho'}:</b> {formatDate(selectedCheckin.checkInDeadline)}</span>
              </div>
            </div>
            {selectedCheckin.scheduleChanged && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>{'khách hàng đã đổi lịch.'}</b> {selectedCheckin.previousAppointment && `${'Lịch cũ'}: ${selectedCheckin.previousAppointment}. `}{'Hãy dùng lịch mới nhất và kiểm tra lại xung đột gian kho.'}</div>}
            {isOutsideAppointmentDate && <Input label={'Lý do nhận kho ngoài ngày hẹn (bắt buộc)'} value={scheduleOverrideReason} onChange={event => setScheduleOverrideReason(event.target.value)} />}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><b>{'Khai báo cần đối chiếu'}:</b> {selectedCheckin.dimensionsCm} cm · {selectedCheckin.weightKg} kg · {selectedCheckin.material} · {selectedCheckin.initialCondition}</div>
            <div className="rounded-lg border border-stone-200 p-3 space-y-3"><p className="font-semibold text-sm">{'Số đo và tình trạng thực tế'}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label={'Kích thước thực tế (D × R × C cm)'} value={actualDimensions} onChange={event => setActualDimensions(event.target.value)} /><Input label={'Khối lượng thực tế (kg)'} type="number" value={actualWeight} onChange={event => setActualWeight(event.target.value)} /><Input label={'Vật liệu thực tế'} value={actualMaterial} onChange={event => setActualMaterial(event.target.value)} /><Input label={'Hiện trạng kho ban đầu / hư hại có sẵn'} value={actualCondition} onChange={event => setActualCondition(event.target.value)} /></div><Input label={'Ảnh/bằng chứng bàn giao (mã tệp hoặc đường dẫn)'} value={checkinEvidence} onChange={event => setCheckinEvidence(event.target.value)} /></div>
            {fitEvaluation && <div className="rounded-lg border border-stone-200 p-3 text-sm"><p className="font-semibold">{'Kiểm tra khả năng tiếp nhận thực tế'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span>{'Cửa kho'}: {fitEvaluation.spec.doorWidth} × {fitEvaluation.spec.doorHeight} cm</span><span>{'Lọt lòng'}: {fitEvaluation.spec.inner.join(' × ')} cm</span><span>{'Tải trọng tối đa'}: {fitEvaluation.spec.maxWeight} kg</span><span>{'Kích thước kiện lớn nhất'}: {actualDimensions || '—'} cm</span></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant={fitEvaluation.doorFits ? 'success' : 'error'}>{fitEvaluation.doorFits ? ('Đã kiểm tra lọt cửa khi xoay') : ('Không lọt cửa')}</Badge><Badge variant={fitEvaluation.weightFits ? 'success' : 'error'}>{fitEvaluation.weightFits ? ('Đạt tải trọng') : ('Vượt tải trọng')}</Badge><Badge variant={fitEvaluation.volumeFits ? 'success' : 'error'}>{fitEvaluation.volumeFits ? ('Đạt thể tích/kích thước') : ('Vượt thể tích')}</Badge></div>{(!fitEvaluation.doorFits || !fitEvaluation.weightFits || !fitEvaluation.volumeFits) && <p className="mt-2 font-medium text-red-700">{'Không thể hoàn tất Nhận kho. Hãy yêu cầu quản lý đổi cỡ kho hoặc gian kho khác.'}</p>}</div>}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm"><p className="font-semibold text-emerald-900">{'Hợp đồng và thanh toán phần còn lại'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span><b>{'Mã đơn'}:</b> {selectedCheckin.reservationId}</span><span><b>{'Mã hợp đồng'}:</b> CTR-{selectedCheckin.reservationId}</span><span><b>{'Cơ sở / gian kho'}:</b> {selectedCheckin.facility} · {selectedCheckin.unit}</span><span><b>{'Ngày bàn giao'}:</b> {formatDate(selectedCheckin.appointmentDate)} · {formatTime(selectedCheckin.appointmentTime)}</span><span><b>{'Tiền cọc'}:</b> {reservationForCheckin?.paid ? '20% · đã thu' : 'Chưa xác nhận'}</span><span><b>{'Người thu'}:</b> {user.name}</span></div><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Bản chụp hợp đồng đã ký</span><span className="block cursor-pointer rounded-lg border border-slate-300 bg-white p-2 font-semibold text-emerald-800">Chọn tệp từ thiết bị</span><input type="file" accept="application/pdf,image/*" onChange={event => setContractFile(event.target.files?.[0]?.name || '')} className="sr-only" />{contractFile && <span className="mt-1 block text-xs text-emerald-800">Đã chọn: {contractFile}</span>}</label><Input label={'Mã giao dịch phần còn lại'} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} /><StaffPaymentUpload key={selectedCheckin.id} value={paymentEvidence} onChange={setPaymentEvidence} onNameChange={setPaymentEvidenceName} /></div></div>
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              {([
                ['identity', 'Đã đối chiếu CCCD/Hộ chiếu gốc'],
                ['reservation', 'Đơn đã giữ gian kho hoặc sẵn sàng nhận kho, đúng cơ sở và lịch'],
                ['contract', 'Hợp đồng đã được khách hàng ký và lưu bản chụp'],
                ['payment', 'Đã thu đủ phần còn lại và phát hành biên nhận'],
                ['measurement', 'Đã đo hàng thực tế và xử lý chênh lệch'],
                ['walkthrough', 'Đã kiểm tra trực tiếp gian kho với khách hàng'],
                ['condition', 'Đã kiểm tra tường, sàn, cửa, khóa, đèn, vệ sinh và hư hại sẵn có'],
                ['credential', `Đã cấp PIN/thẻ/chìa khóa cho kho ${selectedCheckin.unit}`]
              ] as Array<[string, string]>).map(([key, label]) => <label key={key} className="flex items-start gap-3 cursor-pointer text-left"><input type="checkbox" checked={Boolean(checkinChecks[key])} onChange={event => setCheckinChecks(previous => ({ ...previous, [key]: event.target.checked }))} className="!w-4 !h-4 flex-none shrink-0 mt-0.5 accent-blue-600" /><span className="min-w-0 flex-1 text-left text-sm leading-5 text-slate-700">{label}</span></label>)}
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs"><b>{'Thông tin quyền truy cập'}:</b> {`PIN-${selectedCheckin.id}`} · {selectedCheckin.unit} · {selectedCheckin.customer} · {user.name} · {'kích hoạt khi hoàn tất nhận kho'}</div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{'Nhân viên hoàn tất Nhận kho để kích hoạt hợp đồng thuê. Khách hàng sẽ tự bấm “Tôi đã nhận kho”; trước thời điểm đó hồ sơ mang nhãn “Chờ khách xác nhận bàn giao”.'}</div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">{'Ghi chú bàn giao'}</label><textarea rows={2} value={checkinNotes} onChange={event => setCheckinNotes(event.target.value)} placeholder={'Ghi rõ chênh lệch hàng hóa hoặc lưu ý vận hành...'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
>>>>>>> Stashed changes
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCheckinModal(false)}>{t('btn.cancel', 'Cancel')}</Button>
              <Button
                variant="primary"
                disabled={!checkinCanComplete}
                onClick={() => {
<<<<<<< Updated upstream
                  setCheckins(items => items.map(item => item.id === selectedCheckin.id ? { ...item, status: 'completed', customerHandoverStatus: 'pending', dimensionsCm: actualDimensions.trim(), weightKg: Number(actualWeight), material: actualMaterial.trim(), initialCondition: actualCondition.trim(), evidence: [...item.evidence, checkinEvidence.trim(), contractFile.trim(), paymentEvidence.trim(), `RECEIPT-${Date.now()} · ${paymentReference.trim()} · ${user.name} thu phần còn lại`, `CHECKIN-${Date.now()} · ${user.name} xác nhận đối chiếu, cấp credential và bàn giao${scheduleOverrideReason.trim() ? ` · Override: ${scheduleOverrideReason.trim()}` : ''}${checkinNotes.trim() ? ` · ${checkinNotes.trim()}` : ''}`] } : item))
                  setReservations(items => items.map(item => item.id === selectedCheckin.reservationId ? { ...item, status: 'COMPLETED' } : item))
                  setCheckinModal(false)
                  showToast(lang === 'vi' ? 'Đã kích hoạt rental; đang chờ Customer tự xác nhận đã nhận kho.' : 'Rental activated; awaiting the customer’s own handover confirmation.')
                }}
              >
                {t('checkin.complete', 'Complete Check-in')}
=======
                  const sharedHold = hub.holds.find(item => item.id === selectedCheckin.reservationId)
                  if (!sharedHold) { showToast('Không tìm thấy đơn đặt kho dùng chung.'); return }
                  try {
                    const hasSignedContract = hub.contracts.some(item => item.reservationId === sharedHold.id && item.status === 'SIGNED')
                    if (!hasSignedContract) hub.signPaperContract({ holdId: sharedHold.id, staffUser: user, identityVerified: Boolean(checkinChecks.identity), contractNumber: `CTR-${sharedHold.id}`, signedAt: new Date().toISOString(), startDate: sharedHold.startDate, endDate: sharedHold.endDate, scannedFileUrl: `local-upload://${encodeURIComponent(contractFile.trim())}`, scannedFileName: contractFile.trim() })
                    if (sharedHold.remainingAmount > 0) hub.recordRemainingPayment(sharedHold.id, user, { amount: sharedHold.remainingAmount, paymentMethod: 'BANK_TRANSFER', transactionReference: paymentReference.trim(), proofImage: paymentEvidence.trim() })
                    setPendingCheckinCompletionId(selectedCheckin.id)
                    showToast('Đã ghi nhận hợp đồng và thanh toán. Hệ thống đang hoàn tất Nhận kho…')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể chuẩn bị hồ sơ Nhận kho.')
                  }
                }}
              >
                {'Hoàn tất Nhận kho'}
>>>>>>> Stashed changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

<<<<<<< Updated upstream
      <Modal open={Boolean(noShowTarget)} onClose={() => setNoShowTarget(null)} title={lang === 'vi' ? 'Xác nhận Customer No-show' : 'Confirm Customer No-show'}>
        {noShowTarget && <div className="space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>{noShowTarget.customer}</b> · {noShowTarget.unit}<br />{lang === 'vi' ? 'Lịch Check-in' : 'Appointment'}: {noShowTarget.appointmentDate} · {noShowTarget.appointmentTime}<br />{lang === 'vi' ? 'Hạn cuối' : 'Deadline'}: {noShowTarget.checkInDeadline}</div><Input label={lang === 'vi' ? 'Lý do No-show (bắt buộc)' : 'No-show reason (required)'} value={noShowReason} onChange={event => setNoShowReason(event.target.value)} /><p className="text-xs text-stone-500">{lang === 'vi' ? 'Thao tác này hủy Check-in và ghi nhận yêu cầu giải phóng gian kho/thu hồi credential chờ kích hoạt.' : 'This cancels check-in and records the unit release and pending credential revocation.'}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNoShowTarget(null)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button><Button variant="danger" disabled={!noShowReason.trim()} onClick={() => { setCheckins(items => items.map(item => item.id === noShowTarget.id ? { ...item, status: 'no-show', evidence: [...item.evidence, `NO-SHOW-${Date.now()} · ${user.name}: ${noShowReason.trim()} · hủy Check-in, giải phóng kho, thu hồi credential`] } : item)); setNoShowTarget(null); showToast(lang === 'vi' ? 'Đã ghi nhận No-show và yêu cầu giải phóng gian kho.' : 'No-show recorded and unit release requested.') }}>{lang === 'vi' ? 'Xác nhận No-show' : 'Confirm No-show'}</Button></div></div>}
      </Modal>

      {/* Staff Ticket Resolution Modal */}
      <Modal open={respondModal} onClose={() => setRespondModal(false)} title={t('support.modal.title', 'Staff Ticket Response & Resolution')}>
=======
      <Modal closeLabel="Đóng hộp thoại" open={Boolean(selectedRenewal)} onClose={() => setSelectedRenewal(null)} title="Hoàn tất gia hạn tại cơ sở">
        {selectedRenewal && <div className="space-y-4"><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><b>{selectedRenewal.unitId}</b> · {selectedRenewal.customerName}<br />Thời hạn mới: {selectedRenewal.newEndDate}</div><Input label="Số phụ lục / hợp đồng gia hạn" value={renewalContractNumber} onChange={event => setRenewalContractNumber(event.target.value)} /><Input label="Mã phiếu thu phần còn lại" value={renewalPaymentReference} onChange={event => setRenewalPaymentReference(event.target.value)} /><label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Bản chụp phụ lục đã ký</span><span className="block cursor-pointer rounded-lg border border-slate-300 bg-white p-2 font-semibold text-emerald-800">Chọn tệp từ thiết bị</span><input type="file" accept="application/pdf,image/*" onChange={event => setRenewalContractFile(event.target.files?.[0]?.name || '')} className="sr-only" />{renewalContractFile && <span className="mt-1 block text-xs text-emerald-700">Đã chọn: {renewalContractFile}</span>}</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={renewalIdentityVerified} onChange={event => setRenewalIdentityVerified(event.target.checked)} />Đã đối chiếu giấy tờ khách hàng</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={renewalTermsVerified} onChange={event => setRenewalTermsVerified(event.target.checked)} />Đã đối chiếu gian kho và điều khoản gia hạn</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedRenewal(null)}>Hủy</Button><Button disabled={!renewalContractFile || !renewalContractNumber.trim() || !renewalPaymentReference.trim() || !renewalIdentityVerified || !renewalTermsVerified} onClick={() => { try { hub.completeRenewalAtFacility({ renewalId: selectedRenewal.id, staffUser: user, transactionReference: renewalPaymentReference.trim(), identityVerified: renewalIdentityVerified, unitAndTermsVerified: renewalTermsVerified, contractNumber: renewalContractNumber.trim(), signedAt: new Date().toISOString(), scannedFileUrl: `local-upload://${encodeURIComponent(renewalContractFile)}`, scannedFileName: renewalContractFile }); setSelectedRenewal(null); showToast('Đã hoàn tất gia hạn. khách hàng đã nhận thời hạn hợp đồng và biên nhận mới.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể hoàn tất gia hạn.') } }}>Xác nhận hoàn tất</Button></div></div>}
      </Modal>

      <Modal closeLabel="Đóng hộp thoại" open={Boolean(noShowTarget)} onClose={() => setNoShowTarget(null)} title={'Xác nhận khách hàng khách không đến'}>
        {noShowTarget && <div className="space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>{noShowTarget.customer}</b> · {noShowTarget.unit}<br />{'Lịch Nhận kho'}: {formatDate(noShowTarget.appointmentDate)} · {formatTime(noShowTarget.appointmentTime)}<br />{'Hạn cuối'}: {formatDate(noShowTarget.checkInDeadline)}</div><Input label={'Lý do khách không đến (bắt buộc)'} value={noShowReason} onChange={event => setNoShowReason(event.target.value)} /><p className="text-xs text-stone-500">{'Thao tác này hủy Nhận kho và ghi nhận yêu cầu giải phóng gian kho/thu hồi quyền truy cập chờ kích hoạt.'}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNoShowTarget(null)}>{'Hủy'}</Button><Button variant="danger" disabled={!noShowReason.trim()} onClick={() => { try { hub.expireReservation(noShowTarget.reservationId, 'NO_SHOW'); setCheckins(items => items.map(item => item.id === noShowTarget.id ? { ...item, status: 'no-show', evidence: [...item.evidence, `NO-SHOW-${Date.now()} · ${user.name}: ${noShowReason.trim()} · hủy Nhận kho, giải phóng kho, thu hồi quyền truy cập`] } : item)); setNoShowTarget(null); showToast('Đã ghi nhận khách không đến; khách hàng và kho đã được cập nhật.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể ghi nhận khách không đến.') } }}>{'Xác nhận khách không đến'}</Button></div></div>}
      </Modal>

      {/* Staff Ticket Resolution Modal */}
      <Modal closeLabel="Đóng hộp thoại" open={respondModal} onClose={() => setRespondModal(false)} title={'Phản hồi và xử lý phiếu hỗ trợ'}>
>>>>>>> Stashed changes
        {activeStaffTicket && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#292a27] p-4 text-white">
              <div className="flex justify-between items-center text-xs font-mono text-[#e9a12c]">
                <span>{activeStaffTicket.id}</span>
                <span>{activeStaffTicket.facility}</span>
              </div>
              <h3 className="font-bold text-base mt-1 text-stone-100">{activeStaffTicket.subject}</h3>
              <p className="text-xs text-stone-300 mt-1">
<<<<<<< Updated upstream
                {lang === 'vi' ? 'Khách thuê: ' : 'Tenant: '}{activeStaffTicket.customer} ({activeStaffTicket.email}) · Unit {activeStaffTicket.unit}
=======
                {'Khách thuê: '}{activeStaffTicket.customer} ({activeStaffTicket.email}) · Gian kho {activeStaffTicket.unit}
>>>>>>> Stashed changes
              </p>
            </div>

            {/* Chatbox */}
            <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-stone-100/80 p-3 shadow-inner">
              <div className="space-y-3">
                {activeStaffTicket.messages?.map(msg => {
                  const isStaff = msg.role === 'staff'
                  const isSystem = msg.role === 'system'
                  return (
                    <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isStaff ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                        isSystem
                          ? 'bg-stone-200 text-stone-600'
                          : isStaff
                            ? 'rounded-br-md bg-blue-600 text-white'
                            : 'rounded-bl-md border border-amber-200 bg-amber-50 text-stone-800'
                      }`}>
                        <div className={`mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${isStaff ? 'text-blue-100' : 'text-stone-500'}`}>
                          <span className={`font-bold ${isStaff ? 'text-white' : 'text-stone-800'}`}>{msg.sender}</span>
<<<<<<< Updated upstream
                          <span>{msg.role === 'staff' ? (lang === 'vi' ? 'Staff hỗ trợ' : 'Support Staff') : msg.role === 'customer' ? (lang === 'vi' ? 'Khách hàng' : 'Customer') : (lang === 'vi' ? 'Hệ thống' : 'System')}</span>
                          <span>· {msg.time}</span>
=======
                          <span>{msg.role === 'staff' ? ('nhân viên hỗ trợ') : msg.role === 'customer' ? ('Khách hàng') : ('Hệ thống')}</span>
                          <span>· {formatDateTime(msg.time)}</span>
>>>>>>> Stashed changes
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Status Changer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  {lang === 'vi' ? 'Cập Nhật Trạng Thái' : 'Update Ticket Status'}
                </label>
                <select
                  value={ticketNewStatus}
                  onChange={e => setTicketNewStatus(e.target.value as TicketStatus)}
                  className="w-full border border-stone-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-amber-500"
                >
<<<<<<< Updated upstream
                  <option value="open">{lang === 'vi' ? 'Mở Mới / Chờ xử lý' : 'Open / Awaiting Action'}</option>
                  <option value="in-progress">{lang === 'vi' ? 'Đang Khắc Phục' : 'In Progress / Investigating'}</option>
                  <option value="waiting-customer">{lang === 'vi' ? 'Chờ Customer Phản Hồi' : 'Waiting for Customer'}</option>
                  <option value="resolved">{lang === 'vi' ? 'Đã Giải Quyết Xong' : 'Resolved / Case Closed'}</option>
=======
                  <option value="open">{'Mở Mới / Chờ xử lý'}</option>
                  <option value="in-progress">{'Đang Khắc Phục'}</option>
                  <option value="waiting-customer">{'Chờ khách hàng Phản Hồi'}</option>
                  <option value="resolved">{'Đã Giải Quyết Xong'}</option>
>>>>>>> Stashed changes
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  {lang === 'vi' ? 'Nhân Viên Tiếp Nhận' : 'Assigned Handler'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
<<<<<<< Updated upstream
                    value={assignedStaffByTicket[activeStaffTicket.id] || (lang === 'vi' ? 'Chưa có Staff nhận xử lý' : 'No staff assigned')}
=======
                    value={assignedStaffByTicket[activeStaffTicket.id] || ('Chưa có nhân viên nhận xử lý')}
>>>>>>> Stashed changes
                    className="min-w-0 flex-1 border border-stone-200 rounded-lg p-2 text-xs bg-stone-100 text-stone-600"
                  />
                  {assignedStaffByTicket[activeStaffTicket.id] !== user.name && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setAssignedStaffByTicket(previous => ({ ...previous, [activeStaffTicket.id]: user.name }))
                      setTicketNewStatus('in-progress')
                      showToast(lang === 'vi' ? `${user.name} đã nhận xử lý ${activeStaffTicket.id}.` : `${user.name} is now handling ${activeStaffTicket.id}.`)
                    }}>{lang === 'vi' ? 'Nhận xử lý' : 'Assign me'}</Button>
                  )}
                </div>
              </div>
            </div>

            {/* Staff Reply */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700">
                {lang === 'vi' ? 'Nội Dung Phản Hồi Chính Thức Tới Khách' : 'Official Staff Response to Tenant'}
              </label>
              <textarea
                rows={3}
                placeholder={lang === 'vi' ? 'Nhập hướng dẫn khắc phục sự cố, cấp lại mã PIN hoặc thông báo cho khách...' : 'Type resolution instructions, gate code update, or notes for tenant...'}
                value={staffReplyText}
                onChange={e => setStaffReplyText(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-2.5 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <Input label={lang === 'vi' ? 'Bằng chứng đính kèm (mã tệp/đường dẫn)' : 'Evidence attachment (file reference/URL)'} value={ticketEvidence} onChange={event => setTicketEvidence(event.target.value)} />
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><label className="text-xs font-semibold text-amber-900"><input type="checkbox" checked={ticketEscalated} onChange={event => { setTicketEscalated(event.target.checked); if (event.target.checked) setTicketNewStatus('in-progress') }} /> {lang === 'vi' ? 'Chuyển cấp cho quản lý/đội kỹ thuật' : 'Escalate to manager/technical team'}</label>{ticketEscalated && <Input label={lang === 'vi' ? 'Lý do chuyển cấp' : 'Escalation reason'} value={ticketEscalationReason} onChange={event => setTicketEscalationReason(event.target.value)} />}</div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <Button variant="outline" onClick={() => setRespondModal(false)}>{t('btn.cancel', 'Cancel')}</Button>
              <Button
                variant="primary"
                disabled={!staffReplyText.trim() || (ticketEscalated && !ticketEscalationReason.trim())}
                onClick={() => {
                  const newMsg = staffReplyText.trim() ? {
                    id: `msg-${Date.now()}`,
                    sender: user.name,
                    role: 'staff' as const,
<<<<<<< Updated upstream
                    time: lang === 'vi' ? 'Vừa xong' : 'Just now',
                    text: `${staffReplyText.trim()}${ticketEvidence.trim() ? `\n[Evidence: ${ticketEvidence.trim()}]` : ''}${ticketEscalated ? `\n[Escalated: ${ticketEscalationReason.trim()}]` : ''}`
=======
                    time: 'Vừa xong',
                    text: `${staffReplyText.trim()}${ticketEvidence.trim() ? `\n[Bằng chứng: ${ticketEvidence.trim()}]` : ''}${ticketEscalated ? `\n[Chuyển cấp: ${ticketEscalationReason.trim()}]` : ''}`
>>>>>>> Stashed changes
                  } : null

                  setStaffTickets(prev =>
                    prev.map(ticket => {
                      if (ticket.id !== activeStaffTicket.id) return ticket
                      return {
                        ...ticket,
                        status: ticketEscalated ? 'in-progress' as const : ticketNewStatus,
                        messages: newMsg ? [...(ticket.messages || []), newMsg] : ticket.messages
                      }
                    })
                  )
                  setAssignedStaffByTicket(previous => ({ ...previous, [activeStaffTicket.id]: user.name }))
                  setStaffReplyText('')
                  setTicketEvidence('')
                  setTicketEscalated(false)
                  setTicketEscalationReason('')
                  showToast(lang === 'vi' ? `${user.name} đã gửi phản hồi cho ${activeStaffTicket.id}.` : `${user.name} replied to ${activeStaffTicket.id}.`)
                }}
              >
                {t('support.modal.dispatch', 'Save & Dispatch Response')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
