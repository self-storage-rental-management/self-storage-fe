import { useEffect, useRef, useState } from 'react'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Avatar, Input, Select } from '../../components/ui'
import StaffFeeField from './StaffFeeField'
import StaffPaymentUpload from './StaffPaymentUpload'
import StaffSupportPanel from './StaffSupportPanel'
import ProfileView from '../ProfileView'
import type { User } from '../../types'
import type { CheckInRecord, Facility, FacilityTask, ReturnCase, StorageReservation, StorageUnit } from '../../types/storageHub'
import { RESERVATIONS, CHECKINS, RETURNS, SUPPORT_TICKETS, MY_RENTALS, type TicketItem } from "../../data/demoDatabase"
import StaffFileUpload from './StaffFileUpload'
import { formatVnd } from '../../i18n/currency'
import { useStorageHub } from '../../store/StorageHubContext'
import { isFacilityVisible } from '../../domain/managerRules'

type ReservationStatus = 'CREATED' | 'REVIEW_REQUIRED' | 'AWAITING_DEPOSIT' | 'DEPOSIT_PAID' | 'UNIT_RESERVED' | 'READY_FOR_CHECKIN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
type StaffReservation = Omit<(typeof RESERVATIONS)[number], 'status'> & {
  status: ReservationStatus
  sizeCode?: string
  sizeUnit?: 'm²' | 'ft²'
  appointmentDate: string
  appointmentTime: string
  checkInDeadline: string
  reviewDueAt?: string
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
type StaffListSort = 'deadline-asc' | 'deadline-desc' | 'name-asc'

const formatDate = (value?: string) => { if (!value) return 'Chưa xác định'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN') }
const formatExactDateTime = (value?: string) => { if (!value) return 'Chưa xác định'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN') }
const formatDateTime = (value: string) => { const [date, time] = value.split(' · '); return `${formatDate(date)}${time ? ' · ' + formatTime(time) : ''}` }
const formatTime = (value?: string) => { if (!value) return 'Chưa xác định'; const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i); return match ? `${String(Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}` : value }

const formatMoney = formatVnd

const addDays = (dateLabel: string, days: number) => {
  const date = new Date(dateLabel)
  if (Number.isNaN(date.getTime())) return dateLabel
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', year: 'numeric' })
}

const toDateInputValue = (dateLabel: string) => {
  const date = new Date(dateLabel)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const sortStaffList = <T,>(items: T[], sort: StaffListSort, deadlineOf: (item: T) => string, nameOf: (item: T) => string) =>
  [...items].sort((left, right) => {
    if (sort === 'name-asc') return nameOf(left).localeCompare(nameOf(right), 'vi')
    const leftTime = new Date(deadlineOf(left)).getTime()
    const rightTime = new Date(deadlineOf(right)).getTime()
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0
    if (Number.isNaN(leftTime)) return 1
    if (Number.isNaN(rightTime)) return -1
    return sort === 'deadline-desc' ? rightTime - leftTime : leftTime - rightTime
  })

const reservationDeadline = (reservation: StaffReservation) =>
  reservation.status === 'REVIEW_REQUIRED' && reservation.reviewDueAt
    ? reservation.reviewDueAt
    : reservation.checkInDeadline || reservation.appointmentDate

const staffTaskTypeLabel: Record<FacilityTask['type'], string> = { general: 'Chung', checkin: 'Nhận kho', return: 'Trả kho', maintenance: 'Bảo trì', support: 'Hỗ trợ' }

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
    reviewDueAt: reservation.goodsReviewDueAt,
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
  'HCM-Q1-F01-S-001': { doorWidth: 200, doorHeight: 240, inner: [560, 600, 320], maxWeight: 600 },
  'HCM-Q1-F01-M-002': { doorWidth: 200, doorHeight: 240, inner: [900, 640, 340], maxWeight: 1200 },
  'HCM-Q1-F01-M-001': { doorWidth: 200, doorHeight: 240, inner: [900, 640, 340], maxWeight: 1200 },
  'HCM-Q1-F01-L-001': { doorWidth: 200, doorHeight: 240, inner: [1350, 680, 360], maxWeight: 2400 },
  'HCM-Q1-F01-XL-001': { doorWidth: 200, doorHeight: 240, inner: [1900, 720, 400], maxWeight: 3600 },
  'BD-F01-S-001': { doorWidth: 200, doorHeight: 240, inner: [560, 600, 320], maxWeight: 600 },
  'BD-F01-S-002': { doorWidth: 200, doorHeight: 240, inner: [560, 600, 320], maxWeight: 600 },
  'BD-F01-M-001': { doorWidth: 200, doorHeight: 240, inner: [900, 640, 340], maxWeight: 1200 },
  'BD-F01-L-001': { doorWidth: 200, doorHeight: 240, inner: [1350, 680, 360], maxWeight: 2400 },
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

const statusLabelMap: Record<string, string> = {
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
    CREATED: 'Chờ khách hàng xác minh thư điện tử',
    REVIEW_REQUIRED: 'Cần nhân viên rà soát ngoại lệ',
    AWAITING_DEPOSIT: 'Đã duyệt · Chờ thanh toán cọc',
    DEPOSIT_PAID: 'Đã cọc · Chờ Nhận kho',
    UNIT_RESERVED: 'Đã giữ gian kho',
    READY_FOR_CHECKIN: 'Sẵn sàng Nhận kho',
    COMPLETED: 'Đã kích hoạt thuê',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Đã hết hạn',
    'waiting-customer': 'Chờ khách hàng phản hồi',
    'no-show': 'Không đến nhận kho',
    high: 'Khẩn cấp',
    medium: 'Trung bình',
    low: 'Tiêu chuẩn',
}

export default function StaffApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const hub = useStorageHub()
  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Tổng quan ca làm việc', icon: Icon.home, group: 'Ca làm việc', permission: 'view_dashboard' },
    { id: 'tasks', label: 'Nhiệm vụ được giao', icon: Icon.tasks, group: 'Ca làm việc', permission: 'view_dashboard' },
    { id: 'reservations', label: 'Duyệt yêu cầu đặt kho', icon: Icon.calendar, group: 'Vận hành', permission: 'approve_reservations' },
    { id: 'checkin', label: 'Nhận kho & bàn giao', icon: Icon.truck, group: 'Vận hành', permission: 'view_checkins' },
    { id: 'return', label: 'Nghiệm thu trả kho', icon: Icon.clipboard, group: 'Vận hành', permission: 'view_returns' },
    { id: 'support', label: 'Hỗ trợ khách hàng', icon: Icon.support, group: 'Chăm sóc', permission: 'view_support' },
  ]

  const [page, setPage] = useState(() => getInitialPage(nav, 'dashboard'))
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
  const [reservationSearch, setReservationSearch] = useState('')
  const [reservationStatus, setReservationStatus] = useState('all')
  const [reservationDateFilter, setReservationDateFilter] = useState('')
  const [reservationSort, setReservationSort] = useState<StaffListSort>('deadline-asc')
  const [checkinStatusFilter, setCheckinStatusFilter] = useState('all')
  const [checkinDateFilter, setCheckinDateFilter] = useState('')
  const [checkinSort, setCheckinSort] = useState<StaffListSort>('deadline-asc')
  const [returnStatusFilter, setReturnStatusFilter] = useState('all')
  const [returnDateFilter, setReturnDateFilter] = useState('')
  const [returnSort, setReturnSort] = useState<StaffListSort>('deadline-asc')
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
  const [contractFileName, setContractFileName] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentEvidence, setPaymentEvidence] = useState('')
  const [paymentEvidenceName, setPaymentEvidenceName] = useState('')
  const [selectedRenewal, setSelectedRenewal] = useState<(typeof hub.renewals)[number] | null>(null)
  const [renewalContractFile, setRenewalContractFile] = useState('')
  const [renewalContractFileName, setRenewalContractFileName] = useState('')
  const [renewalContractNumber, setRenewalContractNumber] = useState('')
  const [renewalPaymentReference, setRenewalPaymentReference] = useState('')
  const [renewalIdentityVerified, setRenewalIdentityVerified] = useState(false)
  const [renewalTermsVerified, setRenewalTermsVerified] = useState(false)
  const [pendingCheckinCompletionId, setPendingCheckinCompletionId] = useState<string | null>(null)
  const [scheduleOverrideReason, setScheduleOverrideReason] = useState('')
  const [earlyCheckinConfirmed, setEarlyCheckinConfirmed] = useState(false)
  const [noShowTarget, setNoShowTarget] = useState<StaffCheckin | null>(null)
  const [noShowReason, setNoShowReason] = useState('')
  const [returnInventory, setReturnInventory] = useState('match')
  const [returnClassification, setReturnClassification] = useState('no-damage')
  const [returnEvidence, setReturnEvidence] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnActualPackages, setReturnActualPackages] = useState('')
  const [returnKeys, setReturnKeys] = useState('')
  const [returnDamageFee, setReturnDamageFee] = useState('')
  const [returnCleaningFee, setReturnCleaningFee] = useState('')
  const [returnLostItemFee, setReturnLostItemFee] = useState('')
  const [returnOverdueFee, setReturnOverdueFee] = useState('')
  const [returnOtherDebt, setReturnOtherDebt] = useState('')
  const [feeDetails, setFeeDetails] = useState<Record<string, string>>({})

  // Support Tickets state
  const hasFacilityScope = user.role !== 'staff' || Boolean(
    (user.facilityId && user.facilityId !== 'ALL') ||
    (user.facility && user.facility !== 'All facilities')
  )
  const [staffTickets, setStaffTickets] = useState<StaffTicket[]>(() => hasFacilityScope
    ? SUPPORT_TICKETS.filter(item => isFacilityVisible(user, item.facilityId, item.facility))
    : [])
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
  }, [hub.holds, hub.units, user.facility])

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
  }, [hub.checkins, hub.holds, hub.units, hub.facilities, user.facility])

  useEffect(() => {
    const sharedReturns = hub.returns
      .filter(item => isFacilityVisible(user, item.facilityId, item.facilityName))
      .map(mapSharedReturn)
    const sharedIds = new Set(sharedReturns.map(item => item.id))
    setReturns(previous => [...sharedReturns, ...previous.filter(item => !sharedIds.has(item.id))])
  }, [hub.returns, user.facility])

  const showToast = (message: string) => {
    setToast(message.replace(/Check-in|check-in/g, 'nhận kho').replace(/Customer/g, 'khách hàng').replace(/Staff/g, 'nhân viên').replace(/Manager/g, 'quản lý').replace(/Rental|rental/g, 'hợp đồng thuê').replace(/credential/g, 'quyền truy cập').replace(/email/g, 'thư điện tử'))
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 7000)
  }

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
    const evidence = [checkinEvidence.trim(), contractFile.trim(), paymentEvidenceName.trim(), `RECEIPT-${Date.now()} · ${paymentReference.trim()} · ${user.name} thu phần còn lại`, `CHECKIN-${Date.now()} · ${user.name} xác nhận đối chiếu, cấp quyền truy cập và bàn giao${earlyCheckinConfirmed ? ' · ĐÃ XÁC NHẬN NHẬN KHO SỚM' : ''}${scheduleOverrideReason.trim() ? ` · Lý do điều chỉnh: ${scheduleOverrideReason.trim()}` : ''}${checkinNotes.trim() ? ` · ${checkinNotes.trim()}` : ''}`]
    try {
      hub.completeCheckIn({
        holdId: selectedCheckin.reservationId,
        staffUser: user,
        checklist: { identityVerified: Boolean(checkinChecks.identity), termsAccepted: Boolean(checkinChecks.contract), paymentConfirmed: Boolean(checkinChecks.payment), unitWalkthrough: Boolean(checkinChecks.walkthrough), accessCodeIssued: Boolean(checkinChecks.credential) },
        actualMeasurements: { lengthCm: dimensions[0], widthCm: dimensions[1], heightCm: dimensions[2], weightKg: Number(actualWeight), actualVolumeM3: (dimensions[0] * dimensions[1] * dimensions[2] * Math.max(1, selectedCheckin.packageCount)) / 1_000_000, dimWeightKg: selectedCheckin.dimWeightKg, varianceAccepted: true, varianceNotes: checkinNotes.trim() || undefined },
        initialCondition: actualCondition.trim(),
        evidencePhotos: evidence,
        goodsHandover: { packageCount: selectedCheckin.packageCount, category: selectedCheckin.goodsType, estimatedWeightKg: Number(actualWeight), notes: `${actualMaterial.trim()}${checkinNotes.trim() ? ` · ${checkinNotes.trim()}` : ''}` },
        handedOverItems: [`PIN/thẻ/chìa khóa kho ${selectedCheckin.unit}`, contractFileName, paymentEvidenceName],
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

  const normalizedSearch = reservationSearch.trim().toLowerCase()
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const filteredReservations = sortStaffList(
    reservations.filter(r => {
      const matchesStatus = reservationStatus === 'all' || r.status === reservationStatus
      const matchesDate = !reservationDateFilter || toDateInputValue(reservationDeadline(r)) === reservationDateFilter
      const searchText = [r.id, r.customer, r.phone, r.email, r.identityId, r.facility, r.unit].join(' ').toLowerCase()
      return matchesStatus && matchesDate && (!normalizedSearch || searchText.includes(normalizedSearch))
    }),
    reservationSort,
    reservationDeadline,
    r => r.customer,
  )
  const facilityTickets = hasFacilityScope
    ? staffTickets.filter(ticket => isFacilityVisible(user, ticket.facilityId, ticket.facility))
    : []
  const fitEvaluation = selectedCheckin ? evaluateFit(actualDimensions, Number(actualWeight), selectedCheckin.unit) : null
  const reservationForCheckin = selectedCheckin ? reservations.find(reservation => reservation.id === selectedCheckin.reservationId) : null
  const appointmentAt = selectedCheckin ? new Date(`${toDateInputValue(selectedCheckin.appointmentDate)}T${formatTime(selectedCheckin.appointmentTime) || '00:00'}`) : null
  const isEarlyCheckin = Boolean(appointmentAt && !Number.isNaN(appointmentAt.getTime()) && Date.now() < appointmentAt.getTime())
  const isOutsideAppointmentDate = Boolean(selectedCheckin && (toDateInputValue(selectedCheckin.appointmentDate) !== toDateInputValue(new Date().toISOString()) || isEarlyCheckin))
  const checkinCanComplete = Boolean(
    selectedCheckin &&
    Object.values(checkinChecks).every(Boolean) &&
    actualDimensions.trim() && Number(actualWeight) > 0 && actualMaterial.trim() && actualCondition.trim() &&
    checkinEvidence.trim() && contractFile.trim() && paymentReference.trim() && paymentEvidence.trim() &&
    fitEvaluation?.doorFits && fitEvaluation.volumeFits && fitEvaluation.weightFits &&
    (!isOutsideAppointmentDate || scheduleOverrideReason.trim()) &&
    (!isEarlyCheckin || earlyCheckinConfirmed)
  )
  const returnFeesValid = [returnDamageFee, returnCleaningFee, returnLostItemFee, returnOverdueFee, returnOtherDebt].every(value => value === '' || (value !== 'invalid' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= Number.MAX_SAFE_INTEGER / 100))
  const returnTotalDeductions = [returnDamageFee, returnCleaningFee, returnLostItemFee, returnOverdueFee, returnOtherDebt]
    .reduce((total, value) => total + Math.max(0, Number(value) || 0), 0)
  const returnRefund = selectedReturn ? Math.max(0, selectedReturn.deposit - returnTotalDeductions) : 0
  const expiringRentals = MY_RENTALS.filter(rental => isFacilityVisible(user, undefined, rental.facility)).filter(rental => {
    const due = new Date(rental.nextDue)
    if (Number.isNaN(due.getTime())) return false
    const days = Math.ceil((due.getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 30
  })
  const eligibleCheckins = checkins.filter(checkin => {
    const reservation = reservations.find(item => item.id === checkin.reservationId)
    return !reservation || (reservation.status !== 'CANCELLED' && reservation.status !== 'EXPIRED')
  })
  const displayedCheckins = sortStaffList(
    eligibleCheckins.filter(checkin => checkin.status !== 'no-show' && (checkinStatusFilter === 'all' || checkin.status === checkinStatusFilter) && (!checkinDateFilter || toDateInputValue(checkin.checkInDeadline || checkin.appointmentDate) === checkinDateFilter)),
    checkinSort,
    checkin => checkin.checkInDeadline || checkin.appointmentDate,
    checkin => checkin.customer,
  )
  const displayedReturns = sortStaffList(
    returns.filter(returnItem => (returnStatusFilter === 'all' || returnItem.status === returnStatusFilter) && (!returnDateFilter || toDateInputValue(returnScheduleDrafts[returnItem.id] || returnItem.returnDate) === returnDateFilter)),
    returnSort,
    returnItem => returnScheduleDrafts[returnItem.id] || returnItem.returnDate,
    returnItem => returnItem.customer,
  )
  const assignedFacilityTasks = hub.staffTasks
    .filter(task => isFacilityVisible(user, task.facilityId, task.facilityName) && (task.assignedStaffId === user.id || task.assignedStaffName === user.name))
    .sort((left, right) => {
      if (left.status === 'completed' && right.status !== 'completed') return 1
      if (left.status !== 'completed' && right.status === 'completed') return -1
      const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority]
      return priorityDifference || new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
    })
  const openAssignedFacilityTasks = assignedFacilityTasks.filter(task => task.status !== 'completed')
  const updateAssignedTaskStatus = (task: FacilityTask, status: 'in_progress' | 'completed') => {
    try {
      hub.updateFacilityTask(task.id, { status }, user)
      showToast(status === 'completed' ? `Đã hoàn thành nhiệm vụ “${task.title}”. Manager có thể xem kết quả ngay.` : `Đã nhận nhiệm vụ “${task.title}”.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật nhiệm vụ được giao.')
    }
  }
  const scheduledRenewals = hub.renewals.filter(renewal =>
    renewal.status === 'appointment_scheduled' &&
    isFacilityVisible(user, renewal.facilityId, hub.rentals.find(rental => rental.id === renewal.rentalId)?.facilityName)
  )
  const openCheckinRecord = (checkin: StaffCheckin) => {
    setSelectedCheckin(checkin)
    setCheckinChecks({ identity: false, reservation: false, contract: false, payment: checkin.status !== 'pending-payment', measurement: false, walkthrough: false, condition: false, credential: false })
    setActualDimensions(checkin.dimensionsCm)
    setActualWeight(String(checkin.weightKg))
    setActualMaterial(checkin.material)
    setActualCondition(checkin.initialCondition)
    setCheckinEvidence('')
    setCheckinNotes('')
    setContractFile(''); setContractFileName('')
    setPaymentReference('')
    setPaymentEvidence(''); setPaymentEvidenceName('')
    setScheduleOverrideReason('')
    setEarlyCheckinConfirmed(false)
    setCheckinModal(true)
  }
  const operationalTasks = [
    ...reservations.filter(r => r.status === 'REVIEW_REQUIRED').map(r => ({ id: `review-${r.id}`, title: `Rà soát hồ sơ ${r.id}`, customer: r.customer, time: `${formatDate(r.appointmentDate)} ${formatTime(r.appointmentTime)}`, sla: 'Cần nhân viên duyệt hàng hóa', priority: 'high', page: 'reservations' })),
    ...reservations.filter(r => r.status === 'DEPOSIT_PAID').map(r => ({ id: `allocation-${r.id}`, title: `Theo dõi Nhận kho ${r.id}`, customer: r.customer, time: `${formatDate(r.appointmentDate)} ${formatTime(r.appointmentTime)}`, sla: 'Chuẩn bị nhận kho', priority: 'medium', page: 'reservations' })),
    ...eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').map(c => ({ id: `checkin-${c.id}`, title: `Nhận kho & bàn giao ${c.unit}`, customer: c.customer, time: `${formatDate(c.appointmentDate)} ${formatTime(c.appointmentTime)}`, sla: c.scheduleChanged ? ('Lịch đã thay đổi') : (`Hạn ${formatDate(c.checkInDeadline)}`), priority: c.scheduleChanged ? 'high' : 'medium', page: 'checkin' })),
    ...returns.filter(r => r.status !== 'refunded').map(r => ({ id: `return-${r.id}`, title: `Kiểm tra trả kho ${r.unit}`, customer: r.customer, time: formatDate(returnScheduleDrafts[r.id] || r.returnDate), sla: scheduledReturnIds.has(r.id) ? ('Đã xác nhận lịch') : ('Cần xác nhận lịch'), priority: scheduledReturnIds.has(r.id) ? 'medium' : 'high', page: 'return' })),
    ...facilityTickets.filter(ticket => ticket.status !== 'resolved').map(ticket => ({ id: `support-${ticket.id}`, title: `Xử lý hỗ trợ ${ticket.id}`, customer: ticket.customer, time: formatDateTime(ticket.created), sla: ticket.status === 'waiting-customer' ? ('Chờ khách hàng phản hồi') : ticket.priority === 'high' ? ('Xử lý ngay') : ('Trong ca'), priority: ticket.priority, page: 'support' })),
    ...expiringRentals.map(rental => ({ id: `expiry-${rental.id}`, title: `Hợp đồng ${rental.unit} sắp hết hạn`, customer: 'Khách thuê hiện tại', time: formatDate(rental.nextDue), sla: 'Theo dõi nhắc gia hạn', priority: 'low', page: 'tasks' }))
  ].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
  const openOperationalTask = (task: (typeof operationalTasks)[number]) => {
    if (task.id.startsWith('allocation-')) {
      const reservation = reservations.find(item => item.id === task.id.replace('allocation-', ''))
      if (reservation) { setSelectedReservation(reservation); setReservationModal(true) }
      return
    }
    if (task.id.startsWith('review-')) {
      const reservation = reservations.find(item => item.id === task.id.replace('review-', ''))
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
    if (task.id.startsWith('return-')) showToast(`Đã mở danh sách hồ sơ trả kho cho ${task.customer}.`)
    if (task.id.startsWith('expiry-')) showToast(`Đã mở nhiệm vụ theo dõi gia hạn cho ${task.customer}.`)
  }
  const operationalCompletedCount = reservations.filter(r => r.status === 'COMPLETED').length + checkins.filter(c => c.status === 'completed').length + returns.filter(r => r.status === 'waiting-customer' || r.status === 'refunded').length + facilityTickets.filter(ticket => ticket.status === 'resolved').length
  const totalCount = operationalTasks.length + operationalCompletedCount + assignedFacilityTasks.length
  const completedCount = operationalCompletedCount + assignedFacilityTasks.filter(task => task.status === 'completed').length
  const remainingTaskCount = operationalTasks.length + openAssignedFacilityTasks.length
  const assignedTaskNotifications = openAssignedFacilityTasks.map(task => ({ id: `assigned-task-${task.id}`, title: `Manager giao: ${task.title}`, message: `${task.priority === 'high' ? 'Ưu tiên cao · ' : ''}Hạn ${formatDate(task.dueAt)} · ${task.status === 'open' ? 'Chờ nhận việc' : 'Đang thực hiện'}`, page: 'tasks' }))


  return (
    <Layout
      user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      notifications={[...assignedTaskNotifications, ...operationalTasks.filter(task => task.page !== 'tasks').map(task => ({ id: task.id, title: task.title, message: task.customer + ' · ' + task.sla, page: task.page }))]}
      onNotificationClick={notification => { if (notification.id.startsWith('assigned-task-')) { setPage('tasks'); return } const task = operationalTasks.find(item => item.id === notification.id); if (task) openOperationalTask(task) }}
      roleLabel="Nhân viên" roleColor="bg-green-100 text-green-700"
    >
      {page === 'dashboard' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            eyebrow={'CỔNG NHÂN VIÊN · TỔNG QUAN VẬN HÀNH'}
            title={'Tổng Quan Ca Làm Việc'}
            subtitle={`${user.facility ?? ('Cơ sở được phân quyền')} · ${new Date().toLocaleDateString('vi-VN')}`}
          />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title={'Đơn đã cọc · Chờ Nhận kho'} value={reservations.filter(r => r.status === 'DEPOSIT_PAID').length} icon={Icon.alert} iconBg="bg-amber-50" />
            <StatCard title={'Nhận kho sắp tới'} value={eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').length} icon={Icon.truck} iconBg="bg-blue-50" />
            <StatCard title={'Trả kho cần xử lý'} value={returns.filter(r => r.status !== 'refunded').length} icon={Icon.clipboard} iconBg="bg-purple-50" />
            <StatCard title={'Hỗ trợ đang mở'} value={facilityTickets.filter(ticket => ticket.status !== 'resolved').length} icon={Icon.support} iconBg="bg-red-50" />
            <StatCard title={'Manager giao · Chưa xong'} value={openAssignedFacilityTasks.length} icon={Icon.tasks} iconBg="bg-red-50" />
          </div>
          {openAssignedFacilityTasks.length > 0 && <Card><div className="flex items-center justify-between gap-3 border-b border-stone-200 p-4"><div><h3 className="font-bold">{'Nhiệm vụ Manager giao'}</h3><p className="text-xs text-stone-500">{'Nhận việc và cập nhật hoàn thành để Manager theo dõi.'}</p></div><Button variant="outline" size="sm" onClick={() => setPage('tasks')}>{'Xem toàn bộ'}</Button></div><Table><Thead><tr><Th>{'Nhiệm vụ'}</Th><Th>{'Loại'}</Th><Th>{'Hạn xử lý'}</Th><Th>{'Ưu tiên'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>{openAssignedFacilityTasks.slice(0, 5).map(task => <Tr key={task.id}><Td><p className="font-semibold text-stone-900">{task.title}</p>{task.notes && <p className="mt-1 text-xs text-stone-500">{task.notes}</p>}</Td><Td>{staffTaskTypeLabel[task.type]}</Td><Td className="text-xs">{formatDate(task.dueAt)}</Td><Td><Badge variant={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'}>{statusLabelMap[task.priority]}</Badge></Td><Td><Badge variant={task.status === 'in_progress' ? 'info' : 'warning'}>{task.status === 'in_progress' ? 'Đang thực hiện' : 'Chờ nhận việc'}</Badge></Td><Td className="text-right">{task.status === 'open' ? <Button size="sm" onClick={() => updateAssignedTaskStatus(task, 'in_progress')}>{'Nhận việc'}</Button> : <Button size="sm" onClick={() => updateAssignedTaskStatus(task, 'completed')}>{'Hoàn thành'}</Button>}</Td></Tr>)}</Tbody></Table></Card>}
          <Card>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3"><div><h3 className="font-bold">{'Việc ưu tiên theo lịch vận hành'}</h3><p className="text-xs text-stone-500">{'Lịch nhận/trả kho, hỗ trợ và hợp đồng sắp hết hạn.'}</p></div><Button variant="outline" size="sm" onClick={() => setPage('tasks')}>{'Xem toàn bộ'}</Button></div>
            <Table><Thead><tr><Th>{'Ưu tiên'}</Th><Th>{'Nhiệm vụ'}</Th><Th>{'Khách hàng'}</Th><Th>{'Lịch / Thời hạn xử lý'}</Th><Th></Th></tr></Thead><Tbody>
              {operationalTasks.slice(0, 6).map(task => <Tr key={task.id}><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td><b>{task.title}</b></Td><Td>{task.customer}</Td><Td><p className="text-xs">{task.time}</p><p className="text-[11px] font-semibold text-amber-700">{task.sla}</p></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{'Xử lý'}</Button></Td></Tr>)}
            </Tbody></Table>
          </Card>
        </div>
      )}

      {/* ── DAILY TASKS ───────────────────────────────────────── */}
      {page === 'tasks' && (
        <div className="fade-in">
          <SectionHeader
            eyebrow={'CỔNG NHÂN VIÊN · XÁC NHẬN NGHIỆP VỤ'}
            title={"Nhiệm vụ trong ngày"}
            subtitle={`${new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <StatCard title={"Tổng số nhiệm vụ"} value={totalCount} icon={Icon.tasks} iconBg="bg-blue-50" />
            <StatCard title={"Manager giao"} value={assignedFacilityTasks.length} icon={Icon.users} iconBg="bg-purple-50" />
            <StatCard title={"Đã hoàn thành"} value={completedCount} icon={Icon.check} iconBg="bg-green-50" />
            <StatCard title={"Còn lại"} value={remainingTaskCount} icon={Icon.alert} iconBg="bg-amber-50" />
          </div>

          <Card className="mb-6"><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">{'Nhiệm vụ Manager giao'}</h3><p className="mt-1 text-xs text-stone-500">{'Nhiệm vụ được đồng bộ theo đúng tài khoản và cơ sở của bạn.'}</p></div><Table><Thead><tr><Th>{'Nhiệm vụ'}</Th><Th>{'Loại'}</Th><Th>{'Ghi chú'}</Th><Th>{'Hạn xử lý'}</Th><Th>{'Ưu tiên'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>
            {assignedFacilityTasks.map(task => <Tr key={task.id}><Td><p className="font-semibold text-stone-900">{task.title}</p><p className="text-xs text-stone-400">{task.id}{task.referenceId ? ` · ${task.referenceId}` : ''}</p></Td><Td>{staffTaskTypeLabel[task.type]}</Td><Td className="max-w-xs text-xs">{task.notes || '—'}</Td><Td className="text-xs"><span className={task.status !== 'completed' && new Date(task.dueAt).getTime() < Date.now() ? 'font-semibold text-red-700' : ''}>{formatDate(task.dueAt)}</span></Td><Td><Badge variant={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'}>{statusLabelMap[task.priority]}</Badge></Td><Td><Badge variant={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : 'warning'}>{task.status === 'completed' ? 'Đã hoàn thành' : task.status === 'in_progress' ? 'Đang thực hiện' : 'Chờ nhận việc'}</Badge>{task.completedAt && <p className="mt-1 text-[11px] text-emerald-700">{formatExactDateTime(task.completedAt)}</p>}</Td><Td className="text-right">{task.status === 'open' && <Button size="sm" onClick={() => updateAssignedTaskStatus(task, 'in_progress')}>{'Nhận việc'}</Button>}{task.status === 'in_progress' && <Button size="sm" onClick={() => updateAssignedTaskStatus(task, 'completed')}>{'Đánh dấu hoàn thành'}</Button>}{task.status === 'completed' && <span className="text-xs font-semibold text-emerald-700">{'Đã gửi Manager'}</span>}</Td></Tr>)}
            {!assignedFacilityTasks.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">{'Manager chưa giao nhiệm vụ nào cho bạn.'}</td></tr>}
          </Tbody></Table></Card>

          <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">{'Nhiệm vụ vận hành'}</h3><p className="mt-1 text-xs text-stone-500">{'Các hồ sơ nhận kho, trả kho, hỗ trợ và công việc phát sinh trong ca.'}</p></div><Table><Thead><tr><Th>{'Nhiệm vụ'}</Th><Th>{'Khách hàng'}</Th><Th>{'Lịch'}</Th><Th>Thời hạn xử lý</Th><Th>{'Ưu tiên'}</Th><Th></Th></tr></Thead><Tbody>
            {operationalTasks.map(task => <Tr key={task.id}><Td><b>{task.title}</b></Td><Td>{task.customer}</Td><Td className="text-xs">{task.time}</Td><Td className="text-xs font-semibold text-amber-700">{task.sla}</Td><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{'Mở hồ sơ'}</Button></Td></Tr>)}
          </Tbody></Table></Card>
        </div>
      )}

      {/* ── RESERVATIONS ──────────────────────────────────────── */}
      {page === 'reservations' && (
        <div className="fade-in">
          <SectionHeader
            title={'Theo Dõi Đơn Đặt Giữ Kho'}
            subtitle={'Nhân viên theo dõi trạng thái và chuẩn bị Nhận kho; hồ sơ hàng hóa “Khác” do quản lý duyệt.'}
          />
            <Card className="p-4 mb-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_210px_190px_210px]"><Input label={'Tìm hồ sơ'} value={reservationSearch} onChange={event => setReservationSearch(event.target.value)} placeholder={'Mã đơn, tên, SĐT, thư điện tử, CCCD, cơ sở, mã kho'} /><Select label={'Trạng thái'} value={reservationStatus} onChange={event => setReservationStatus(event.target.value)}><option value="all">{'Tất cả'}</option>{(['CREATED', 'REVIEW_REQUIRED', 'AWAITING_DEPOSIT', 'DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as ReservationStatus[]).map(status => <option key={status} value={status}>{statusLabelMap[status]}</option>)}</Select><Input label={'Ngày đến hạn'} type="date" value={reservationDateFilter} onChange={event => setReservationDateFilter(event.target.value)} /><Select label={'Sắp xếp'} value={reservationSort} onChange={event => setReservationSort(event.target.value as StaffListSort)}><option value="deadline-asc">{'Sắp đến hạn trước'}</option><option value="deadline-desc">{'Hạn xa nhất trước'}</option><option value="name-asc">{'Tên khách hàng A–Z'}</option></Select></div><p className="mt-2 text-xs text-stone-500">{filteredReservations.length}/{reservations.length} {'hồ sơ phù hợp · mặc định ưu tiên hạn gần nhất'}</p></Card>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{'Mã đơn'}</Th>
                  <Th>{'Khách hàng'}</Th>
                  <Th>{'Gian kho'}</Th>
                  <Th>{'Lịch Nhận kho hiện tại'}</Th>
                  <Th>{'Thanh toán'}</Th>
                  <Th>{'Trạng thái'}</Th>
                  <Th>{'Thao tác'}</Th>
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
                      <p className="text-xs text-slate-400">{r.size} {r.sizeUnit || (r.sizeCode ? 'm²' : 'ft²')}</p>
                    </Td>
                    <Td><p>{formatDate(r.appointmentDate)} · {formatTime(r.appointmentTime)}</p><p className={`text-[11px] ${r.status === 'REVIEW_REQUIRED' ? 'font-semibold text-red-700' : 'text-stone-500'}`}>{r.status === 'REVIEW_REQUIRED' ? 'Hạn duyệt hàng hóa trong 12 giờ' : 'Hạn cuối'}: {r.status === 'REVIEW_REQUIRED' ? formatExactDateTime(r.reviewDueAt) : formatDate(r.checkInDeadline)}</p>{r.previousAppointment && <p className="text-[11px] text-amber-700">{'Lịch cũ'}: {r.previousAppointment}</p>}</Td>
                    <Td>{r.paid ? <Badge variant="success">{'Đã thanh toán'}</Badge> : <Badge variant="error">{'Chưa thanh toán'}</Badge>}</Td>
                    <Td>{s(r.status, { CREATED: 'warning', REVIEW_REQUIRED: 'error', AWAITING_DEPOSIT: 'warning', DEPOSIT_PAID: 'info', UNIT_RESERVED: 'info', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'muted', EXPIRED: 'error' })}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{'Xem'}</Button>
                        {r.status === 'REVIEW_REQUIRED' && <Button variant="primary" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{'Rà soát ngoại lệ'}</Button>}
                        {r.status === 'CREATED' && <Badge variant="warning">{'Theo dõi · chờ cọc'}</Badge>}
                        {r.status === 'AWAITING_DEPOSIT' && <Badge variant="warning">{'Chờ khách hàng thanh toán'}</Badge>}
                        {r.status === 'DEPOSIT_PAID' && <Badge variant="info">{'Đã cọc · Chờ Nhận kho'}</Badge>}
                      </div>
                    </Td>
                  </Tr>
                ))}
                {filteredReservations.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-stone-500">{'Không có hồ sơ phù hợp.'}</td></tr>}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── CHECK-IN / HANDOVER ───────────────────────────────── */}
      {page === 'checkin' && (
        <div className="fade-in">
          <SectionHeader
            title={'Nhận kho / Bàn giao'}
            subtitle={'Xử lý nhận kho và bàn giao kho cho khách'}
          />
          <Card className="mb-4 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Select label={'Lọc theo trạng thái'} value={checkinStatusFilter} onChange={event => setCheckinStatusFilter(event.target.value)}><option value="all">{'Tất cả trạng thái'}</option><option value="scheduled">{'Đã lên lịch'}</option><option value="pending-payment">{'Chờ thanh toán'}</option><option value="completed">{'Hoàn tất'}</option></Select><Input label={'Ngày đến hạn'} type="date" value={checkinDateFilter} onChange={event => setCheckinDateFilter(event.target.value)} /><Select label={'Sắp xếp'} value={checkinSort} onChange={event => setCheckinSort(event.target.value as StaffListSort)}><option value="deadline-asc">{'Sắp đến hạn trước'}</option><option value="deadline-desc">{'Hạn xa nhất trước'}</option><option value="name-asc">{'Tên khách hàng A–Z'}</option></Select></div><p className="mt-2 text-xs text-stone-500">{displayedCheckins.length}/{eligibleCheckins.filter(checkin => checkin.status !== 'no-show').length} {'hồ sơ phù hợp'}</p></Card>
          <div className="space-y-3">
            {displayedCheckins.map(c => {
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
                        <p className="text-xs text-slate-500">{c.facility} · Kho {c.unit} · {formatDate(c.appointmentDate)} lúc {formatTime(c.appointmentTime)}</p>
                        <p className="text-[11px] text-slate-500">{'Hạn cuối Nhận kho'}: {formatDate(c.checkInDeadline)}</p>
                        {c.previousAppointment && <p className="text-[11px] text-amber-700">{'Lịch cũ'}: {c.previousAppointment}</p>}
                        {c.scheduleChanged && <Badge variant="warning">{'khách hàng đã đổi lịch'}</Badge>}
                        <p className="mt-1 text-xs font-medium text-slate-600">{c.goodsType} · {c.packageCount} kiện · {c.weightKg} kg · Khối lượng quy đổi {c.dimWeightKg} kg</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s(c.status, { scheduled: 'info', 'pending-payment': 'warning', completed: 'success', 'no-show': 'error' })}
                    {c.status !== 'completed' && (
                      <Button variant="primary" size="sm" onClick={() => openCheckinRecord(c)}>
                        {'Xử lý Nhận kho'}
                      </Button>
                    )}
                    {c.status !== 'completed' && <Button variant="danger" size="sm" disabled={!canMarkNoShow} onClick={() => { setNoShowTarget(c); setNoShowReason('') }}>{'Đánh dấu khách không đến'}</Button>}
                    {c.status === 'completed' && <Button variant="ghost" size="sm" onClick={() => showToast(`Hồ sơ ${c.id}: đã kích hoạt hợp đồng thuê, đã lưu bằng chứng và đang chờ khách hàng xác nhận.`)}>{'Xem hồ sơ'}</Button>}
                  </div>
                </div>
              </Card>
              )
            })}
          </div>
          {scheduledRenewals.length > 0 && <div className="mt-8 space-y-3"><SectionHeader title="Lịch ký phụ lục gia hạn" subtitle="Thu phần tiền còn lại, tải phụ lục đã ký và kích hoạt thời hạn mới" />{scheduledRenewals.map(renewal => <Card key={renewal.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-slate-900">{renewal.unitId} · {renewal.customerName}</p><p className="text-xs text-slate-500">Hẹn {formatDate(renewal.appointmentDate)} lúc {formatTime(renewal.appointmentTime)} · Gia hạn đến {formatDate(renewal.newEndDate)}</p><p className="mt-1 text-xs font-medium text-amber-800">Còn thu tại cơ sở: {formatMoney(renewal.remainingAmount ?? 0)}</p></div><Button size="sm" onClick={() => { setSelectedRenewal(renewal); setRenewalContractFile(''); setRenewalContractFileName(''); setRenewalContractNumber(`PL-${renewal.id}`); setRenewalPaymentReference(''); setRenewalIdentityVerified(false); setRenewalTermsVerified(false) }}>Hoàn tất gia hạn</Button></div></Card>)}</div>}
        </div>
      )}

      {/* ── RETURN INSPECTION ────────────────────────────────── */}
      {page === 'return' && (
        <div className="fade-in">
          <SectionHeader
            eyebrow={'CỔNG NHÂN VIÊN · KIỂM KÊ & BẰNG CHỨNG'}
            title={"Nghiệm thu trả kho"}
            subtitle={'Đối chiếu hiện trạng trước–sau, kiểm kê hàng hóa, phân loại và lưu bằng chứng'}
          />
          <Card className="mb-4 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Select label={'Lọc theo trạng thái'} value={returnStatusFilter} onChange={event => setReturnStatusFilter(event.target.value)}><option value="all">{'Tất cả trạng thái'}</option><option value="pending">{'Chờ xử lý'}</option><option value="waiting-customer">{'Chờ khách hàng phản hồi'}</option><option value="refunded">{'Đã hoàn cọc'}</option></Select><Input label={'Ngày trả kho'} type="date" value={returnDateFilter} onChange={event => setReturnDateFilter(event.target.value)} /><Select label={'Sắp xếp'} value={returnSort} onChange={event => setReturnSort(event.target.value as StaffListSort)}><option value="deadline-asc">{'Sắp đến hạn trước'}</option><option value="deadline-desc">{'Hạn xa nhất trước'}</option><option value="name-asc">{'Tên khách hàng A–Z'}</option></Select></div><p className="mt-2 text-xs text-stone-500">{displayedReturns.length}/{returns.length} {'hồ sơ phù hợp'}</p></Card>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{"Mã trả kho"}</Th>
                  <Th>{"Khách hàng"}</Th>
                  <Th>{"Gian kho"}</Th>
                  <Th>{"Ngày trả kho"}</Th>
                  <Th>{"Hiện trạng"}</Th>
                  <Th>{"Tiền cọc"}</Th>
                  <Th>{"Trạng thái"}</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {displayedReturns.map(r => (
                  <Tr key={r.id}>
                    <Td><span className="font-mono text-xs text-slate-500">{r.id}</span></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.customer} size="sm" />
                        <span className="text-sm font-medium">{r.customer}</span>
                      </div>
                    </Td>
                    <Td className="font-medium">{r.unit}</Td>
                    <Td>{r.status === 'pending' && !scheduledReturnIds.has(r.id) ? <input type="date" value={toDateInputValue(returnScheduleDrafts[r.id] ?? r.returnDate)} onChange={event => setReturnScheduleDrafts(previous => ({ ...previous, [r.id]: event.target.value }))} className="w-36 rounded border border-stone-300 px-2 py-1 text-xs" aria-label={'Chọn ngày kiểm tra trả kho'} /> : formatDate(returnScheduleDrafts[r.id] ?? r.returnDate)}</Td>
                    <Td>
                      {r.condition === 'good'
                        ? <Badge variant="success">{'Tốt'}</Badge>
                        : <Badge variant="error">{'Hư hỏng'}</Badge>}
                      {r.damageNotes && <p className="text-xs text-red-500 mt-0.5">{r.damageNotes}</p>}
                    </Td>
                    <Td className="font-semibold">{formatMoney(r.deposit)}</Td>
                    <Td>{s(r.status, { pending: 'warning', 'waiting-customer': 'info', refunded: 'success' })}</Td>
                    <Td>
                      {r.status === 'pending' && (
                        <Button variant="primary" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(false); setReturnInventory('match'); setReturnClassification('no-damage'); setReturnEvidence(''); setReturnNotes(r.finalCondition); setReturnActualPackages(r.packageCount > 0 ? String(r.packageCount) : ''); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setFeeDetails({}); setReturnDamageFee(''); setReturnCleaningFee(''); setReturnLostItemFee(''); setReturnOverdueFee(''); setReturnOtherDebt(''); setInspectModal(true) }}>
                          {'Nghiệm thu'}
                        </Button>
                      )}
                      {r.status !== 'pending' && <Button variant="ghost" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(true); const saved = hub.returns.find(item => item.id === r.id); setReturnDamageFee(String(saved?.damageFee ?? 0)); setReturnCleaningFee(String(saved?.cleaningFee ?? 0)); setReturnLostItemFee(String(saved?.lostItemFee ?? 0)); setReturnOverdueFee(String(saved?.overdueFee ?? 0)); setReturnOtherDebt(String(saved?.outstandingFee ?? 0)); setReturnInventory('match'); setReturnClassification(r.classification === 'Chờ phân loại' ? 'no-damage' : r.classification.replace(/_/g, '-')); setReturnEvidence(r.evidence[r.evidence.length - 1] ?? ''); setReturnNotes(r.finalCondition); setReturnActualPackages(String(r.packageCount)); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setInspectModal(true) }}>{'Chi tiết'}</Button>}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── SUPPORT ───────────────────────────────────────────── */}
      {page === 'support' && (
        <StaffSupportPanel
          user={user}
          tickets={hub.tickets}
          respondSupportTicket={hub.respondSupportTicket}
          canManageSupport={true}
          showToast={showToast}
        />
      )}

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
      <Modal closeLabel="Đóng hộp thoại" open={reservationModal} onClose={() => setReservationModal(false)} size="xl" title={'Hồ Sơ Yêu Cầu Giữ Kho'}>
        {selectedReservation && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Khách hàng</p><b>{selectedReservation.customer}</b><p className="text-xs">{selectedReservation.phone}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Thư điện tử</p><b>{selectedReservation.email}</b><p className="text-xs">{selectedReservation.emailVerified ? '✓ Đã xác nhận' : '⚠ Chưa xác nhận'}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Cơ sở / kho</p><b>{selectedReservation.facility} · {selectedReservation.unit}</b><p className="text-xs">{selectedReservation.facilityAddress}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">CCCD</p><b>{selectedReservation.identityId}</b><p className="text-xs">Đối chiếu bản gốc khi nhận kho</p></div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{'Trạng thái chuẩn'}:</b> {statusLabelMap[selectedReservation.status]}</span><span><b>{'Lịch Nhận kho'}:</b> {formatDate(selectedReservation.appointmentDate)} · {formatTime(selectedReservation.appointmentTime)}</span><span><b>{selectedReservation.status === 'REVIEW_REQUIRED' ? 'Hạn duyệt 12 giờ' : 'Hạn cuối'}:</b> {selectedReservation.status === 'REVIEW_REQUIRED' ? formatExactDateTime(selectedReservation.reviewDueAt) : formatDate(selectedReservation.checkInDeadline)}</span></div><p className="mt-2 text-xs text-blue-800">{'nhân viên theo dõi hồ sơ và chuẩn bị Nhận kho. Gian kho cụ thể đã được khách chọn từ đầu.'}</p></div>
            {selectedReservation.status === 'REVIEW_REQUIRED' && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">{'Hồ sơ hàng hóa “Khác” cần Staff xác nhận trong 12 giờ'}</p><p className="mt-1">{'Nhân viên kiểm tra thông tin, hàng khai báo và bằng chứng trước khi quyết định.'}</p><p className="mt-1 font-semibold">{'Hạn xác nhận'}: {formatExactDateTime(selectedReservation.reviewDueAt)}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="sm" onClick={() => { try { if (hub.holds.some(item => item.id === selectedReservation.id)) hub.approveReservation(selectedReservation.id, user); const updated = { ...selectedReservation, status: 'AWAITING_DEPOSIT' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast('Đã duyệt hồ sơ; khách hàng được mở bước thanh toán cọc.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể duyệt hồ sơ.') } }}>{'Duyệt → chờ cọc'}</Button>{(!hub.holds.some(item => item.id === selectedReservation.id)) && <Button variant="danger" size="sm" onClick={() => { try { const updated = { ...selectedReservation, status: 'CANCELLED' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast('Đã từ chối ngoại lệ và giải phóng yêu cầu giữ kho.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể từ chối hồ sơ.') } }}>{'Từ chối'}</Button>}</div></div>}
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

      <Modal closeLabel="Đóng hộp thoại" open={inspectModal} onClose={() => setInspectModal(false)} size="xl" title={'Nghiệm Thu Phòng Kho Trả'}>
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{"Khách hàng"}</span>
                <span className="font-medium">{selectedReturn.customer}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{"Gian kho"}</span>
                <span className="font-medium">{selectedReturn.unit}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{'Tiền cọc'}</span>
                <span className="font-semibold">{formatMoney(selectedReturn.deposit)}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>{'Kỳ thuê'}:</b> {formatDate(selectedReturn.contractStart)} → {formatDate(selectedReturn.contractEnd)}</span>
                <span><b>{'Ngày khách hàng yêu cầu trả'}:</b> {formatDate(selectedReturn.returnDate)}</span>
                <span className="sm:col-span-2"><b>{'Lý do'}:</b> {selectedReturn.requestReason}</span>
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
              <div><label className="text-sm font-medium">{'Kết quả kiểm kê'}</label><select disabled={returnDetailsOnly} value={returnInventory} onChange={event => setReturnInventory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="match">{'Khớp khai báo'}</option><option value="missing">{'Thiếu / đã lấy ra'}</option><option value="damaged">{'Có hàng hư hỏng'}</option><option value="abandoned">{'Có hàng bỏ lại'}</option></select></div>
              <div><label className="text-sm font-medium">{'Phân loại hiện trạng'}</label><select disabled={returnDetailsOnly} value={returnClassification} onChange={event => setReturnClassification(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="no-damage">{'Không hư hại'}</option><option value="minor-damage">{'Hư hại nhẹ'}</option><option value="major-damage">{'Hư hại nặng'}</option><option value="requires-maintenance">{'Cần bảo trì'}</option></select></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input disabled={returnDetailsOnly} label={'Số kiện thực tế lúc trả'} type="number" value={returnActualPackages} onChange={event => setReturnActualPackages(event.target.value)} /><Input disabled={returnDetailsOnly} label={'Mã truy cập/thẻ/chìa khóa thu hồi'} value={returnKeys} onChange={event => setReturnKeys(event.target.value)} /></div>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><b>{'Bằng chứng bàn giao ban đầu (bất biến)'}:</b> {selectedReturn.evidence.join(' · ')}</div>
            <StaffFileUpload key={selectedReturn.id + String(returnDetailsOnly)} label="Ảnh hoặc tài liệu nghiệm thu trả kho" value={returnEvidence} onChange={setReturnEvidence} disabled={returnDetailsOnly} />
            <section className="rounded-xl border border-stone-200 p-4" aria-label="Chi tiết các khoản khấu trừ">
              <h3 className="font-semibold">Chi tiết các khoản khấu trừ đề xuất</h3>
              <p className="mt-1 text-xs leading-5 text-stone-600">Đơn vị: Việt Nam đồng (₫). Nhập số lượng và đơn giá theo hợp đồng hoặc chứng từ để hệ thống tự tính thành tiền; khoản không phát sinh có thể để trống.</p>
              <div className="mt-4 grid auto-rows-fr gap-3 lg:grid-cols-2">
                {[
                  { label: 'Phí hư hại', hint: 'Số hạng mục hư hỏng × chi phí sửa chữa hoặc thay thế từng hạng mục.', value: returnDamageFee, set: setReturnDamageFee },
                  { label: 'Phí vệ sinh', hint: 'Số lần hoặc diện tích cần vệ sinh × đơn giá đã thỏa thuận.', value: returnCleaningFee, set: setReturnCleaningFee },
                  { label: 'Phí thất lạc', hint: 'Số chìa khóa, thẻ hoặc vật dụng bị mất × đơn giá cấp lại.', value: returnLostItemFee, set: setReturnLostItemFee },
                  { label: 'Phí quá hạn', hint: 'Số ngày quá hạn × mức phí mỗi ngày theo hợp đồng.', value: returnOverdueFee, set: setReturnOverdueFee },
                  { label: 'Công nợ khác', hint: 'Tổng các khoản chưa thanh toán; ghi rõ từng khoản, không tính trùng phí ở trên.', value: returnOtherDebt, set: setReturnOtherDebt },
                ].map(fee => <StaffFeeField key={selectedReturn.id + String(returnDetailsOnly) + fee.label} label={fee.label} hint={fee.hint} value={fee.value} onChange={fee.set} onDetailChange={detail => setFeeDetails(previous => ({ ...previous, [fee.label]: detail }))} disabled={returnDetailsOnly} />)}
              </div>
              {!returnFeesValid && <p role="alert" className="mt-3 text-sm text-red-700">Số lượng và đơn giá phải là số hợp lệ, không được âm.</p>}
              <dl className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between gap-3"><dt>Tiền cọc đã thu</dt><dd>{formatMoney(selectedReturn.deposit)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Tổng khấu trừ (cộng 5 khoản phí)</dt><dd className="font-semibold">{formatMoney(returnTotalDeductions)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-stone-200 pt-2"><dt>Tiền cọc hoàn lại = tiền cọc − khấu trừ (tối thiểu 0)</dt><dd className="font-bold text-emerald-700">{formatMoney(returnRefund)}</dd></div>
                {returnTotalDeductions > selectedReturn.deposit && <div className="flex justify-between gap-3 text-red-700"><dt>Khách cần thanh toán thêm</dt><dd className="font-bold">{formatMoney(returnTotalDeductions - selectedReturn.deposit)}</dd></div>}
              </dl>
            </section>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {'Biên Bản Ghi Chú Hiện Trường'}
              </label>
              <textarea
                rows={3}
                disabled={returnDetailsOnly}
                value={returnNotes}
                onChange={event => setReturnNotes(event.target.value)}
                placeholder={'Ghi rõ chi tiết hư hại, đồ còn sót lại hoặc vết bẩn...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{'Sau khi nhân viên gửi, hồ sơ chuyển sang “Chờ khách hàng xác nhận”. Nhân viên không đóng hồ sơ hoặc hoàn cọc thay khách hàng.'}</div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setInspectModal(false)}>{returnDetailsOnly ? ('Đóng') : "Hủy"}</Button>
              {!returnDetailsOnly && <Button
                variant="primary"
                disabled={!returnFeesValid || !returnActualPackages.trim() || !returnEvidence.trim() || !returnNotes.trim() || !returnKeys.trim() || Number(returnActualPackages) < 0}
                onClick={() => {
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
                }}
              >
                {"Lưu biên bản"}
              </Button>}
            </div>
          </div>
        )}
      </Modal>

      <Modal closeLabel="Đóng hộp thoại" open={checkinModal} onClose={() => setCheckinModal(false)} size="xl" title={'Đối chiếu và xác nhận nhận kho'}>
        {selectedCheckin && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{"Khách hàng"}</span>
                <span className="font-medium">{selectedCheckin.customer}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{"Gian kho"}</span>
                <span className="font-medium">{selectedCheckin.unit}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>Thư điện tử:</b> {selectedCheckin.email}</span><span><b>SĐT:</b> {selectedCheckin.phone}</span>
                <span><b>CCCD:</b> {selectedCheckin.identityId}</span><span><b>Cơ sở:</b> {selectedCheckin.facility}</span>
                <span><b>Hàng:</b> {selectedCheckin.goodsType}</span><span><b>Chất liệu:</b> {selectedCheckin.material}</span>
                <span><b>Số kiện:</b> {selectedCheckin.packageCount}</span><span><b>Khối lượng thực tế / quy đổi:</b> {selectedCheckin.weightKg} / {selectedCheckin.dimWeightKg} kg</span>
                <span><b>{'Lịch hiện tại'}:</b> {formatDate(selectedCheckin.appointmentDate)} · {formatTime(selectedCheckin.appointmentTime)}</span><span><b>{'Hạn Nhận kho'}:</b> {formatDate(selectedCheckin.checkInDeadline)}</span>
              </div>
            </div>
            {selectedCheckin.scheduleChanged && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>{'khách hàng đã đổi lịch.'}</b> {selectedCheckin.previousAppointment && `${'Lịch cũ'}: ${selectedCheckin.previousAppointment}. `}{'Hãy dùng lịch mới nhất và kiểm tra lại xung đột gian kho.'}</div>}
            {isOutsideAppointmentDate && <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"><div><p className="font-semibold text-amber-950">{isEarlyCheckin ? 'Khách đang đến sớm hơn lịch hẹn' : 'Khách đến ngoài ngày đã đăng ký'}</p><p className="mt-1 text-sm text-amber-800">Nhân viên cần xác minh đủ điều kiện nhận kho và ghi lý do điều chỉnh trước khi tiếp tục.</p></div>{isEarlyCheckin && <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-white p-3 text-sm text-stone-800"><input type="checkbox" checked={earlyCheckinConfirmed} onChange={event => setEarlyCheckinConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" /><span><b>{'Xác nhận cho phép nhận kho sớm'}</b><br /><span className="text-xs text-stone-600">{'Đã kiểm tra gian kho sẵn sàng, đơn đã được duyệt, cọc và các điều kiện bàn giao hợp lệ.'}</span></span></label>}<Input label={isEarlyCheckin ? 'Lý do cho phép nhận kho sớm (bắt buộc)' : 'Lý do nhận kho khác lịch hẹn (bắt buộc)'} value={scheduleOverrideReason} onChange={event => setScheduleOverrideReason(event.target.value)} /></div>}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><b>{'Khai báo cần đối chiếu'}:</b> {selectedCheckin.dimensionsCm} cm · {selectedCheckin.weightKg} kg · {selectedCheckin.material} · {selectedCheckin.initialCondition}</div>
            <div className="rounded-lg border border-stone-200 p-3 space-y-3"><p className="font-semibold text-sm">{'Số đo và tình trạng thực tế'}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label={'Kích thước thực tế (D × R × C cm)'} value={actualDimensions} onChange={event => setActualDimensions(event.target.value)} /><Input label={'Khối lượng thực tế (kg)'} type="number" value={actualWeight} onChange={event => setActualWeight(event.target.value)} /><Input label={'Vật liệu thực tế'} value={actualMaterial} onChange={event => setActualMaterial(event.target.value)} /><Input label={'Hiện trạng kho ban đầu / hư hại có sẵn'} value={actualCondition} onChange={event => setActualCondition(event.target.value)} /></div><StaffFileUpload key={selectedCheckin.id + "-handover"} label="Ảnh hoặc tài liệu bàn giao" value={checkinEvidence} onChange={setCheckinEvidence} /></div>
            {fitEvaluation && <div className="rounded-lg border border-stone-200 p-3 text-sm"><p className="font-semibold">{'Kiểm tra khả năng tiếp nhận thực tế'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span>{'Cửa kho'}: {fitEvaluation.spec.doorWidth} × {fitEvaluation.spec.doorHeight} cm</span><span>{'Lọt lòng'}: {fitEvaluation.spec.inner.join(' × ')} cm</span><span>{'Tải trọng tối đa'}: {fitEvaluation.spec.maxWeight} kg</span><span>{'Kích thước kiện lớn nhất'}: {actualDimensions || '—'} cm</span></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant={fitEvaluation.doorFits ? 'success' : 'error'}>{fitEvaluation.doorFits ? ('Đã kiểm tra lọt cửa khi xoay') : ('Không lọt cửa')}</Badge><Badge variant={fitEvaluation.weightFits ? 'success' : 'error'}>{fitEvaluation.weightFits ? ('Đạt tải trọng') : ('Vượt tải trọng')}</Badge><Badge variant={fitEvaluation.volumeFits ? 'success' : 'error'}>{fitEvaluation.volumeFits ? ('Đạt thể tích/kích thước') : ('Vượt thể tích')}</Badge></div>{(!fitEvaluation.doorFits || !fitEvaluation.weightFits || !fitEvaluation.volumeFits) && <p className="mt-2 font-medium text-red-700">{'Không thể hoàn tất Nhận kho. Hãy yêu cầu quản lý đổi cỡ kho hoặc gian kho khác.'}</p>}</div>}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm"><p className="font-semibold text-emerald-900">{'Hợp đồng và thanh toán phần còn lại'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span><b>{'Mã đơn'}:</b> {selectedCheckin.reservationId}</span><span><b>{'Mã hợp đồng'}:</b> CTR-{selectedCheckin.reservationId}</span><span><b>{'Cơ sở / gian kho'}:</b> {selectedCheckin.facility} · {selectedCheckin.unit}</span><span><b>{'Ngày bàn giao'}:</b> {formatDate(selectedCheckin.appointmentDate)} · {formatTime(selectedCheckin.appointmentTime)}</span><span><b>{'Tiền cọc'}:</b> {reservationForCheckin?.paid ? '20% · đã thu' : 'Chưa xác nhận'}</span><span><b>{'Người thu'}:</b> {user.name}</span></div><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><StaffFileUpload key={selectedCheckin.id + "-contract"} label="Bản chụp hợp đồng đã ký" value={contractFile} onChange={setContractFile} onNameChange={setContractFileName} /><Input label={'Mã giao dịch phần còn lại'} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} /><StaffPaymentUpload key={selectedCheckin.id} value={paymentEvidence} onChange={setPaymentEvidence} onNameChange={setPaymentEvidenceName} /></div></div>
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
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCheckinModal(false)}>{"Hủy"}</Button>
              <Button
                variant="primary"
                disabled={!checkinCanComplete}
                onClick={() => {
                  const sharedHold = hub.holds.find(item => item.id === selectedCheckin.reservationId)
                  if (!sharedHold) { showToast('Không tìm thấy đơn đặt kho dùng chung.'); return }
                  try {
                    const hasSignedContract = hub.contracts.some(item => item.reservationId === sharedHold.id && item.status === 'SIGNED')
                    if (!hasSignedContract) hub.signPaperContract({ holdId: sharedHold.id, staffUser: user, identityVerified: Boolean(checkinChecks.identity), contractNumber: `CTR-${sharedHold.id}`, signedAt: new Date().toISOString(), startDate: sharedHold.startDate, endDate: sharedHold.endDate, scannedFileUrl: contractFile, scannedFileName: contractFileName })
                    if (sharedHold.remainingAmount > 0) hub.recordRemainingPayment(sharedHold.id, user, { amount: sharedHold.remainingAmount, paymentMethod: 'BANK_TRANSFER', transactionReference: paymentReference.trim(), proofImage: paymentEvidence.trim() })
                    setPendingCheckinCompletionId(selectedCheckin.id)
                    showToast('Đã ghi nhận hợp đồng và thanh toán. Hệ thống đang hoàn tất Nhận kho…')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể chuẩn bị hồ sơ Nhận kho.')
                  }
                }}
              >
                {isEarlyCheckin ? 'Xác nhận nhận kho sớm & hoàn tất' : 'Hoàn tất Nhận kho'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal closeLabel="Đóng hộp thoại" open={Boolean(selectedRenewal)} onClose={() => setSelectedRenewal(null)} title="Hoàn tất gia hạn tại cơ sở">
        {selectedRenewal && <div className="space-y-4"><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><b>{selectedRenewal.unitId}</b> · {selectedRenewal.customerName}<br />Thời hạn mới: {selectedRenewal.newEndDate}</div><Input label="Số phụ lục / hợp đồng gia hạn" value={renewalContractNumber} onChange={event => setRenewalContractNumber(event.target.value)} /><Input label="Mã phiếu thu phần còn lại" value={renewalPaymentReference} onChange={event => setRenewalPaymentReference(event.target.value)} /><StaffFileUpload key={selectedRenewal.id} label="Bản chụp phụ lục đã ký" value={renewalContractFile} onChange={setRenewalContractFile} onNameChange={setRenewalContractFileName} /><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={renewalIdentityVerified} onChange={event => setRenewalIdentityVerified(event.target.checked)} />Đã đối chiếu giấy tờ khách hàng</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={renewalTermsVerified} onChange={event => setRenewalTermsVerified(event.target.checked)} />Đã đối chiếu gian kho và điều khoản gia hạn</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedRenewal(null)}>Hủy</Button><Button disabled={!renewalContractFile || !renewalContractNumber.trim() || !renewalPaymentReference.trim() || !renewalIdentityVerified || !renewalTermsVerified} onClick={() => { try { hub.completeRenewalAtFacility({ renewalId: selectedRenewal.id, staffUser: user, transactionReference: renewalPaymentReference.trim(), identityVerified: renewalIdentityVerified, unitAndTermsVerified: renewalTermsVerified, contractNumber: renewalContractNumber.trim(), signedAt: new Date().toISOString(), scannedFileUrl: renewalContractFile, scannedFileName: renewalContractFileName }); setSelectedRenewal(null); showToast('Đã hoàn tất gia hạn. khách hàng đã nhận thời hạn hợp đồng và biên nhận mới.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể hoàn tất gia hạn.') } }}>Xác nhận hoàn tất</Button></div></div>}
      </Modal>

      <Modal closeLabel="Đóng hộp thoại" open={Boolean(noShowTarget)} onClose={() => setNoShowTarget(null)} title={'Xác nhận khách hàng khách không đến'}>
        {noShowTarget && <div className="space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>{noShowTarget.customer}</b> · {noShowTarget.unit}<br />{'Lịch Nhận kho'}: {formatDate(noShowTarget.appointmentDate)} · {formatTime(noShowTarget.appointmentTime)}<br />{'Hạn cuối'}: {formatDate(noShowTarget.checkInDeadline)}</div><Input label={'Lý do khách không đến (bắt buộc)'} value={noShowReason} onChange={event => setNoShowReason(event.target.value)} /><p className="text-xs text-stone-500">{'Thao tác này hủy Nhận kho và ghi nhận yêu cầu giải phóng gian kho/thu hồi quyền truy cập chờ kích hoạt.'}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNoShowTarget(null)}>{'Hủy'}</Button><Button variant="danger" disabled={!noShowReason.trim()} onClick={() => { try { hub.expireReservation(noShowTarget.reservationId, 'NO_SHOW'); setCheckins(items => items.map(item => item.id === noShowTarget.id ? { ...item, status: 'no-show', evidence: [...item.evidence, `NO-SHOW-${Date.now()} · ${user.name}: ${noShowReason.trim()} · hủy Nhận kho, giải phóng kho, thu hồi quyền truy cập`] } : item)); setNoShowTarget(null); showToast('Đã ghi nhận khách không đến; khách hàng và kho đã được cập nhật.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể ghi nhận khách không đến.') } }}>{'Xác nhận khách không đến'}</Button></div></div>}
      </Modal>

      {/* Staff Ticket Resolution Modal */}
      <Modal
        closeLabel="Đóng hộp thoại"
        open={respondModal}
        onClose={() => setRespondModal(false)}
        size="xl"
        className="!p-0 overflow-hidden bg-[#f4f1ea] border border-[#e7e2d8]"
        contentClassName="p-5 sm:p-6 bg-[#f4f1ea] space-y-4"
        customHeader={
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#e7e2d8] sticky top-0 z-20">
            <h2
              id="modal-title"
              className="text-[15px] font-semibold text-[#191b20]"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Phiếu hỗ trợ
            </h2>
            <button
              type="button"
              aria-label="Đóng"
              className="text-[#767268] hover:text-[#191b20] hover:bg-[#f4f1ea] p-1.5 rounded-lg transition flex items-center justify-center cursor-pointer"
              onClick={() => setRespondModal(false)}
            >
              <svg className="w-5 h-5 show-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        }
      >
        {activeStaffTicket && (
          <div className="space-y-4">
            {/* Card thông tin ticket */}
            <div className="rounded-[10px] border border-[#e7e2d8] bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded font-mono font-bold tracking-wide text-[11.5px]"
                  style={{ background: '#efece3', color: 'var(--ink)' }}
                >
                  {activeStaffTicket.id}
                </span>
                {activeStaffTicket.status === 'resolved' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#edf7f0] text-[#2f9e5c] border border-[#bfe7ce]">
                    Đã giải quyết
                  </span>
                ) : activeStaffTicket.status === 'in-progress' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#fef3eb] text-[#e0680f] border border-[#fcd9bd]">
                    Đang xử lý
                  </span>
                ) : activeStaffTicket.status === 'waiting-customer' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#efece3] text-[#767268] border border-[#deddd2]">
                    Chờ khách hàng
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#efece3] text-[#767268] border border-[#deddd2]">
                    Chờ xử lý
                  </span>
                )}
              </div>

              <h3
                className="mt-3 text-[19px] font-bold leading-snug text-[#191b20]"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {activeStaffTicket.subject}
              </h3>

              <div className="mt-3 pt-3 border-t border-[#e7e2d8]/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[13px] text-[#767268]">
                <div>
                  <span>{activeStaffTicket.customer}</span>
                  <span className="mx-1.5">·</span>
                  <span>{activeStaffTicket.email}</span>
                </div>
                <div className="font-medium text-[#191b20] sm:text-right">
                  <span>{activeStaffTicket.facility}</span>
                  <span className="mx-1.5">·</span>
                  <span>Gian kho <b className="font-bold text-[#191b20]">{activeStaffTicket.unit}</b></span>
                </div>
              </div>
            </div>

            {/* Chatbox */}
            <div className="max-h-72 overflow-y-auto rounded-[10px] border border-[#e7e2d8] bg-[#faf8f4] p-4 space-y-3.5">
              {activeStaffTicket.messages?.map(msg => {
                const isStaff = msg.role === 'staff'
                const isCustomer = msg.role === 'customer'

                return (
                  <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                    <div className="mb-1 px-1 flex items-center gap-1.5 text-[11px] text-[#767268]">
                      <span className="font-semibold text-[#191b20]">{msg.sender}</span>
                      <span>·</span>
                      <span>{isStaff ? 'Nhân viên hỗ trợ' : isCustomer ? 'Khách hàng' : 'Hệ thống'}</span>
                      <span>·</span>
                      <span>{formatDateTime(msg.time)}</span>
                    </div>
                    <div
                      className={`max-w-[75%] rounded-[10px] px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                        isStaff
                          ? 'bg-[#fdece0] text-[#191b20] rounded-br-[3px] border border-[#fcd9bd]/60'
                          : 'bg-white text-[#191b20] border border-[#e7e2d8] rounded-bl-[3px]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed break-words">{msg.text}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Status and current owner (Gộp 1 hàng ngang duy nhất) */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-[#e7e2d8]">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#191b20] whitespace-nowrap">
                  Trạng thái:
                </label>
                <select
                  value={ticketNewStatus}
                  onChange={e => setTicketNewStatus(e.target.value as TicketStatus)}
                  className="rounded-[6px] border border-[#e7e2d8] bg-white px-3 py-1.5 text-xs text-[#191b20] font-medium focus:outline-none focus:ring-2 focus:ring-[#e0680f] cursor-pointer"
                >
                  <option value="in-progress">Đang xử lý</option>
                  <option value="waiting-customer">Chờ khách hàng phản hồi</option>
                  <option value="resolved">Đã giải quyết xong</option>
                  <option value="open">Mở mới / Chờ xử lý</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#191b20] whitespace-nowrap">
                  Phụ trách:
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#e0680f] text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                    {(activeStaffTicket.assignedStaff || assignedStaffByTicket[activeStaffTicket.id] || user.name || 'DS').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-[#191b20]">
                    {activeStaffTicket.assignedStaff || assignedStaffByTicket[activeStaffTicket.id] || user.name || 'Chưa gán'}
                  </span>
                </div>
              </div>
            </div>

            {/* Staff Reply */}
            <div>
              <label className="block text-xs font-semibold text-[#191b20] mb-1.5">
                Nội dung phản hồi chính thức *
              </label>
              <textarea
                rows={3}
                placeholder="Nhập hướng dẫn khắc phục sự cố, cấp lại mã PIN hoặc thông báo cho khách..."
                value={staffReplyText}
                onChange={e => setStaffReplyText(e.target.value)}
                className="w-full rounded-[6px] border border-[#e7e2d8] bg-white px-3 py-2 text-xs text-[#191b20] placeholder:text-[#767268]/60 focus:outline-none focus:ring-2 focus:ring-[#e0680f] focus:border-[#e0680f] transition resize-none leading-relaxed"
              />
            </div>

            <Input label={'Bằng chứng đính kèm (mã tệp/đường dẫn)'} value={ticketEvidence} onChange={event => setTicketEvidence(event.target.value)} />
            <div className="rounded-[8px] border border-amber-200 bg-amber-50/70 p-3 space-y-2">
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ticketEscalated} onChange={event => { setTicketEscalated(event.target.checked); if (event.target.checked) setTicketNewStatus('in-progress') }} />
                <span>Chuyển cấp cho quản lý/đội kỹ thuật</span>
              </label>
              {ticketEscalated && <Input label={'Lý do chuyển cấp'} value={ticketEscalationReason} onChange={event => setTicketEscalationReason(event.target.value)} />}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e7e2d8]">
              <button
                type="button"
                onClick={() => setRespondModal(false)}
                className="rounded-[6px] border border-[#e7e2d8] bg-white px-4 py-2 text-xs font-semibold text-[#191b20] hover:bg-[#faf8f4] transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!staffReplyText.trim() || (ticketEscalated && !ticketEscalationReason.trim())}
                onClick={() => {
                  const newMsg = staffReplyText.trim() ? {
                    id: `msg-${Date.now()}`,
                    sender: user.name,
                    role: 'staff' as const,
                    time: 'Vừa xong',
                    text: `${staffReplyText.trim()}${ticketEvidence.trim() ? `\n[Bằng chứng: ${ticketEvidence.trim()}]` : ''}${ticketEscalated ? `\n[Chuyển cấp: ${ticketEscalationReason.trim()}]` : ''}`
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
                  setAssignedStaffByTicket(previous => ({
                    ...previous,
                    [activeStaffTicket.id]: previous[activeStaffTicket.id] || activeStaffTicket.assignedStaff || user.name
                  }))
                  setStaffReplyText('')
                  setTicketEvidence('')
                  setTicketEscalated(false)
                  setTicketEscalationReason('')
                  setRespondModal(false)
                  showToast(`${user.name} đã gửi phản hồi cho ${activeStaffTicket.id}.`)
                }}
                className={`rounded-[6px] px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                  !staffReplyText.trim() || (ticketEscalated && !ticketEscalationReason.trim())
                    ? 'bg-[#d8d4c9] text-[#767268] cursor-not-allowed border-none'
                    : 'bg-[#e0680f] text-white hover:bg-[#b8540c] shadow-sm cursor-pointer border-none'
                }`}
              >
                Gửi phản hồi &amp; Cập nhật
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
