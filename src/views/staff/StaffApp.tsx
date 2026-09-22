import { useEffect, useRef, useState } from 'react'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Tabs, Avatar, Input } from '../../components/ui'
import ProfileView from '../ProfileView'
import type { User } from '../../types'
import type { CheckInRecord, Facility, ReturnCase, StorageReservation, StorageUnit } from '../../types/storageHub'
import { RESERVATIONS, CHECKINS, RETURNS, SUPPORT_TICKETS, MY_RENTALS, type TicketItem } from "../../data/demoDatabase"
import { useStorageHub } from '../../store/StorageHubContext'
import { isFacilityVisible } from '../../domain/managerRules'

type ReservationStatus = 'CREATED' | 'REVIEW_REQUIRED' | 'AWAITING_DEPOSIT' | 'DEPOSIT_PAID' | 'UNIT_RESERVED' | 'READY_FOR_CHECKIN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
type StaffReservation = Omit<(typeof RESERVATIONS)[number], 'status'> & {
  status: ReservationStatus
  sizeUnit?: 'm²' | 'ft²'
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
  material: 'Theo biên bản Check-in',
  packageCount: item.packageCount,
  initialWeightKg: item.initialWeightKg,
  finalWeightKg: item.initialWeightKg,
  initialCondition: item.initialConditionSnapshot,
  finalCondition: item.staffNotes || 'Chờ kiểm kê',
  classification: item.damageClassification || 'Chờ phân loại',
  evidence: item.evidence,
  contractStart: item.requestedAt,
  contractEnd: item.scheduledDate,
  requestReason: 'Customer yêu cầu trả kho',
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
  requestReason: 'Customer chủ động kết thúc kỳ thuê đúng hạn',
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
    CREATED: 'Chờ Customer xác minh email',
    REVIEW_REQUIRED: 'Cần Staff rà soát ngoại lệ',
    AWAITING_DEPOSIT: 'Đã duyệt · Chờ thanh toán cọc',
    DEPOSIT_PAID: 'Đã cọc · Chờ Check-in',
    UNIT_RESERVED: 'Đã giữ gian kho',
    READY_FOR_CHECKIN: 'Sẵn sàng Check-in',
    COMPLETED: 'Đã kích hoạt thuê',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Đã hết hạn',
    'waiting-customer': 'Chờ Customer phản hồi',
    'no-show': 'Không đến nhận kho',
    high: 'Khẩn cấp',
    medium: 'Trung bình',
    low: 'Tiêu chuẩn',
}

export default function StaffApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const hub = useStorageHub()
  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Tổng quan ca làm việc', icon: Icon.home, group: 'Ca làm việc', permission: 'view_dashboard' },
    { id: 'reservations', label: 'Duyệt yêu cầu đặt kho', icon: Icon.calendar, group: 'Vận hành', permission: 'approve_reservations' },
    { id: 'checkin', label: 'Check-in & bàn giao', icon: Icon.truck, group: 'Vận hành', permission: 'view_checkins' },
    { id: 'return', label: 'Nghiệm thu trả kho', icon: Icon.clipboard, group: 'Vận hành', permission: 'view_returns' },
    { id: 'support', label: 'Hỗ trợ khách hàng', icon: Icon.support, group: 'Chăm sóc', permission: 'view_support' },
  ]

  const [page, setPage] = useState(() => getInitialPage(nav, 'dashboard'))
  const [reservations, setReservations] = useState<StaffReservation[]>(() => reservationSeed.filter(item => isFacilityVisible(user, undefined, item.facility)))
  const [checkins, setCheckins] = useState<StaffCheckin[]>(() => checkinSeed.filter(item => isFacilityVisible(user, undefined, item.facility)))
  const [returns, setReturns] = useState<StaffReturn[]>(() => returnSeed.filter(item => isFacilityVisible(user, undefined, item.facility)))
  const [inspectModal, setInspectModal] = useState(false)
  const [checkinModal, setCheckinModal] = useState(false)
  const [reservationModal, setReservationModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<StaffReservation | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<StaffReturn | null>(null)
  const [returnDetailsOnly, setReturnDetailsOnly] = useState(false)
  const [selectedCheckin, setSelectedCheckin] = useState<StaffCheckin | null>(null)
  const [ticketTab, setTicketTab] = useState('Mở Mới')
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
  const [selectedRenewal, setSelectedRenewal] = useState<(typeof hub.renewals)[number] | null>(null)
  const [renewalContractFile, setRenewalContractFile] = useState('')
  const [renewalContractNumber, setRenewalContractNumber] = useState('')
  const [renewalPaymentReference, setRenewalPaymentReference] = useState('')
  const [renewalIdentityVerified, setRenewalIdentityVerified] = useState(false)
  const [renewalTermsVerified, setRenewalTermsVerified] = useState(false)
  const [pendingCheckinCompletionId, setPendingCheckinCompletionId] = useState<string | null>(null)
  const [scheduleOverrideReason, setScheduleOverrideReason] = useState('')
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

  // Support Tickets state
  const [staffTickets, setStaffTickets] = useState<StaffTicket[]>(() => SUPPORT_TICKETS.filter(item => isFacilityVisible(user, item.facilityId, item.facility)))
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

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
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
    const evidence = [checkinEvidence.trim(), contractFile.trim(), paymentEvidence.trim(), `RECEIPT-${Date.now()} · ${paymentReference.trim()} · ${user.name} thu phần còn lại`, `CHECKIN-${Date.now()} · ${user.name} xác nhận đối chiếu, cấp credential và bàn giao${scheduleOverrideReason.trim() ? ` · Override: ${scheduleOverrideReason.trim()}` : ''}${checkinNotes.trim() ? ` · ${checkinNotes.trim()}` : ''}`]
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
      showToast('Đã kích hoạt rental; Customer có thể xác nhận đã nhận kho trong Đơn đặt giữ kho.')
    } catch (error) {
      setPendingCheckinCompletionId(null)
      showToast(error instanceof Error ? error.message : 'Không thể hoàn tất Check-in.')
    }
  }, [pendingCheckinCompletionId, hub.holds])

  const s = (value: string, variants: Record<string, string>) => {
    const label = statusLabelMap[value] || value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ')
    return <Badge variant={variants[value] ?? 'muted'}>{label}</Badge>
  }

  const normalizedSearch = reservationSearch.trim().toLowerCase()
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const filteredReservations = reservations.filter(r => {
    const matchesStatus = reservationStatus === 'all' || r.status === reservationStatus
    const searchText = [r.id, r.customer, r.phone, r.email, r.identityId, r.facility, r.unit].join(' ').toLowerCase()
    return matchesStatus && (!normalizedSearch || searchText.includes(normalizedSearch))
  })
  const facilityTickets = staffTickets.filter(ticket => isFacilityVisible(user, ticket.facilityId, ticket.facility))
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
    setContractFile('')
    setPaymentReference('')
    setPaymentEvidence('')
    setScheduleOverrideReason('')
    setCheckinModal(true)
  }
  const operationalTasks = [
    ...reservations.filter(r => r.status === 'REVIEW_REQUIRED').map(r => ({ id: `review-${r.id}`, title: `Rà soát hồ sơ ${r.id}`, customer: r.customer, time: `${r.appointmentDate} ${r.appointmentTime}`, sla: 'Cần Staff duyệt hàng hóa', priority: 'high', page: 'reservations' })),
    ...reservations.filter(r => r.status === 'DEPOSIT_PAID').map(r => ({ id: `allocation-${r.id}`, title: `Theo dõi Check-in ${r.id}`, customer: r.customer, time: `${r.appointmentDate} ${r.appointmentTime}`, sla: 'Chuẩn bị nhận kho', priority: 'medium', page: 'reservations' })),
    ...eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').map(c => ({ id: `checkin-${c.id}`, title: `Check-in & bàn giao ${c.unit}`, customer: c.customer, time: `${c.appointmentDate} ${c.appointmentTime}`, sla: c.scheduleChanged ? ('Lịch đã thay đổi') : (`Hạn ${c.checkInDeadline}`), priority: c.scheduleChanged ? 'high' : 'medium', page: 'checkin' })),
    ...returns.filter(r => r.status !== 'refunded').map(r => ({ id: `return-${r.id}`, title: `Kiểm tra trả kho ${r.unit}`, customer: r.customer, time: returnScheduleDrafts[r.id] || r.returnDate, sla: scheduledReturnIds.has(r.id) ? ('Đã xác nhận lịch') : ('Cần xác nhận lịch'), priority: scheduledReturnIds.has(r.id) ? 'medium' : 'high', page: 'return' })),
    ...facilityTickets.filter(ticket => ticket.status !== 'resolved').map(ticket => ({ id: `support-${ticket.id}`, title: `Xử lý hỗ trợ ${ticket.id}`, customer: ticket.customer, time: ticket.created, sla: ticket.status === 'waiting-customer' ? ('Chờ Customer phản hồi') : ticket.priority === 'high' ? ('Xử lý ngay') : ('Trong ca'), priority: ticket.priority, page: 'support' })),
    ...expiringRentals.map(rental => ({ id: `expiry-${rental.id}`, title: `Hợp đồng ${rental.unit} sắp hết hạn`, customer: 'Khách thuê hiện tại', time: rental.nextDue, sla: 'Theo dõi nhắc gia hạn', priority: 'low', page: 'tasks' }))
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
  const totalCount = operationalTasks.length
  const completedCount = reservations.filter(r => r.status === 'COMPLETED').length + checkins.filter(c => c.status === 'completed').length + returns.filter(r => r.status === 'waiting-customer' || r.status === 'refunded').length + facilityTickets.filter(ticket => ticket.status === 'resolved').length
  const remainingTaskCount = Math.max(0, totalCount - completedCount)


  return (
    <Layout
      user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      roleLabel="Staff" roleColor="bg-green-100 text-green-700"
    >
      {page === 'dashboard' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            eyebrow={'CỔNG NHÂN VIÊN · TỔNG QUAN VẬN HÀNH'}
            title={'Tổng Quan Ca Làm Việc'}
            subtitle={`${user.facility ?? ('Cơ sở được phân quyền')} · ${new Date().toLocaleDateString('vi-VN')}`}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={'Đơn đã cọc · Chờ Check-in'} value={reservations.filter(r => r.status === 'DEPOSIT_PAID').length} icon={Icon.alert} iconBg="bg-amber-50" />
            <StatCard title={'Check-in sắp tới'} value={eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').length} icon={Icon.truck} iconBg="bg-blue-50" />
            <StatCard title={'Trả kho cần xử lý'} value={returns.filter(r => r.status !== 'refunded').length} icon={Icon.clipboard} iconBg="bg-purple-50" />
            <StatCard title={'Hỗ trợ đang mở'} value={facilityTickets.filter(ticket => ticket.status !== 'resolved').length} icon={Icon.support} iconBg="bg-red-50" />
          </div>
          <Card>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3"><div><h3 className="font-bold">{'Việc ưu tiên theo lịch vận hành'}</h3><p className="text-xs text-stone-500">{'Lịch nhận/trả kho, hỗ trợ và hợp đồng sắp hết hạn.'}</p></div><Button variant="outline" size="sm" onClick={() => setPage('tasks')}>{'Xem toàn bộ'}</Button></div>
            <Table><Thead><tr><Th>{'Ưu tiên'}</Th><Th>{'Nhiệm vụ'}</Th><Th>{'Khách hàng'}</Th><Th>{'Lịch / SLA'}</Th><Th></Th></tr></Thead><Tbody>
              {operationalTasks.slice(0, 6).map(task => <Tr key={task.id}><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td><b>{task.title}</b><p className="text-[11px] text-stone-400">{task.id}</p></Td><Td>{task.customer}</Td><Td><p className="text-xs">{task.time}</p><p className="text-[11px] font-semibold text-amber-700">{task.sla}</p></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{'Xử lý'}</Button></Td></Tr>)}
            </Tbody></Table>
          </Card>
        </div>
      )}

      {/* ── DAILY TASKS ───────────────────────────────────────── */}
      {page === 'tasks' && (
        <div className="fade-in">
          <SectionHeader
            eyebrow={'CỔNG NHÂN VIÊN · XÁC NHẬN NGHIỆP VỤ'}
            title={'Nhiệm vụ trong ngày'}
            subtitle={`${new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard title={'Tổng số nhiệm vụ'} value={totalCount} icon={Icon.tasks} iconBg="bg-blue-50" />
            <StatCard title={'Đã hoàn thành'} value={completedCount} icon={Icon.check} iconBg="bg-green-50" />
            <StatCard title={'Còn lại'} value={remainingTaskCount} icon={Icon.alert} iconBg="bg-amber-50" />
          </div>

          <Card><Table><Thead><tr><Th>{'Nhiệm vụ được giao'}</Th><Th>{'Khách hàng'}</Th><Th>{'Lịch'}</Th><Th>SLA</Th><Th>{'Ưu tiên'}</Th><Th></Th></tr></Thead><Tbody>
            {operationalTasks.map(task => <Tr key={task.id}><Td><b>{task.title}</b></Td><Td>{task.customer}</Td><Td className="text-xs">{task.time}</Td><Td className="text-xs font-semibold text-amber-700">{task.sla}</Td><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openOperationalTask(task)}>{'Mở hồ sơ'}</Button></Td></Tr>)}
          </Tbody></Table></Card>
        </div>
      )}

      {/* ── RESERVATIONS ──────────────────────────────────────── */}
      {page === 'reservations' && (
        <div className="fade-in">
          <SectionHeader
            title={'Theo Dõi Đơn Đặt Giữ Kho'}
            subtitle={'Staff theo dõi trạng thái và chuẩn bị Check-in; hồ sơ hàng hóa “Khác” do Manager duyệt.'}
          />
            <Card className="p-4 mb-4"><div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3"><Input label={'Tìm hồ sơ'} value={reservationSearch} onChange={event => setReservationSearch(event.target.value)} placeholder={'Mã đơn, tên, SĐT, email, CCCD, cơ sở, mã kho'} /><div><label className="text-sm font-medium text-stone-700">{'Trạng thái chuẩn'}</label><select value={reservationStatus} onChange={event => setReservationStatus(event.target.value)} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="all">{'Tất cả'}</option>{(['CREATED', 'REVIEW_REQUIRED', 'AWAITING_DEPOSIT', 'DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as ReservationStatus[]).map(status => <option key={status} value={status}>{statusLabelMap[status]}</option>)}</select></div></div><p className="mt-2 text-xs text-stone-500">{filteredReservations.length}/{reservations.length} {'hồ sơ phù hợp'}</p></Card>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{'Mã đơn'}</Th>
                  <Th>{'Khách hàng'}</Th>
                  <Th>{'Gian kho'}</Th>
                  <Th>{'Lịch Check-in hiện tại'}</Th>
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
                    <Td><p>{r.appointmentDate} · {r.appointmentTime}</p><p className="text-[11px] text-stone-500">{'Hạn cuối'}: {r.checkInDeadline}</p>{r.previousAppointment && <p className="text-[11px] text-amber-700">{'Lịch cũ'}: {r.previousAppointment}</p>}</Td>
                    <Td>{r.paid ? <Badge variant="success">{'Đã thanh toán'}</Badge> : <Badge variant="error">{'Chưa thanh toán'}</Badge>}</Td>
                    <Td>{s(r.status, { CREATED: 'warning', REVIEW_REQUIRED: 'error', AWAITING_DEPOSIT: 'warning', DEPOSIT_PAID: 'info', UNIT_RESERVED: 'info', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'muted', EXPIRED: 'error' })}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{'Xem'}</Button>
                        {r.status === 'REVIEW_REQUIRED' && <Button variant="primary" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{'Rà soát ngoại lệ'}</Button>}
                        {r.status === 'CREATED' && <Badge variant="warning">{'Theo dõi · chờ cọc'}</Badge>}
                        {r.status === 'AWAITING_DEPOSIT' && <Badge variant="warning">{'Chờ Customer thanh toán'}</Badge>}
                        {r.status === 'DEPOSIT_PAID' && <Badge variant="info">{'Đã cọc · Chờ Check-in'}</Badge>}
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
            title={'Check-in / Bàn giao'}
            subtitle={'Xử lý nhận kho và bàn giao kho cho khách'}
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
                        <p className="text-xs text-slate-500">{c.facility} · Kho {c.unit} · {c.appointmentDate} lúc {c.appointmentTime}</p>
                        <p className="text-[11px] text-slate-500">{'Hạn cuối Check-in'}: {c.checkInDeadline}</p>
                        {c.previousAppointment && <p className="text-[11px] text-amber-700">{'Lịch cũ'}: {c.previousAppointment}</p>}
                        {c.scheduleChanged && <Badge variant="warning">{'Customer đã đổi lịch'}</Badge>}
                        <p className="mt-1 text-xs font-medium text-slate-600">{c.goodsType} · {c.packageCount} kiện · {c.weightKg} kg · DIM {c.dimWeightKg} kg</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s(c.status, { scheduled: 'info', 'pending-payment': 'warning', completed: 'success', 'no-show': 'error' })}
                    {c.status !== 'completed' && (
                      <Button variant="primary" size="sm" onClick={() => openCheckinRecord(c)}>
                        {'Xử lý Check-in'}
                      </Button>
                    )}
                    {c.status !== 'completed' && <Button variant="danger" size="sm" disabled={!canMarkNoShow} onClick={() => { setNoShowTarget(c); setNoShowReason('') }}>{'Đánh dấu No-show'}</Button>}
                    {c.status === 'completed' && <Button variant="ghost" size="sm" onClick={() => showToast(`Hồ sơ ${c.id}: đã kích hoạt rental, đã lưu bằng chứng và đang chờ Customer xác nhận.`)}>{'Xem hồ sơ'}</Button>}
                  </div>
                </div>
              </Card>
              )
            })}
          </div>
          {scheduledRenewals.length > 0 && <div className="mt-8 space-y-3"><SectionHeader title="Lịch ký phụ lục gia hạn" subtitle="Thu phần tiền còn lại, tải phụ lục đã ký và kích hoạt thời hạn mới" />{scheduledRenewals.map(renewal => <Card key={renewal.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-slate-900">{renewal.unitId} · {renewal.customerName}</p><p className="text-xs text-slate-500">Hẹn {renewal.appointmentDate} lúc {renewal.appointmentTime} · Gia hạn đến {renewal.newEndDate}</p><p className="mt-1 text-xs font-medium text-amber-800">Còn thu tại cơ sở: {renewal.remainingAmount ?? 0}</p></div><Button size="sm" onClick={() => { setSelectedRenewal(renewal); setRenewalContractFile(''); setRenewalContractNumber(`PL-${renewal.id}`); setRenewalPaymentReference(''); setRenewalIdentityVerified(false); setRenewalTermsVerified(false) }}>Hoàn tất gia hạn</Button></div></Card>)}</div>}
        </div>
      )}

      {/* ── RETURN INSPECTION ────────────────────────────────── */}
      {page === 'return' && (
        <div className="fade-in">
          <SectionHeader
            eyebrow={'CỔNG NHÂN VIÊN · KIỂM KÊ & BẰNG CHỨNG'}
            title={'Nghiệm thu trả kho'}
            subtitle={'Đối chiếu hiện trạng trước–sau, kiểm kê hàng hóa, phân loại và lưu bằng chứng'}
          />
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{'Mã trả kho'}</Th>
                  <Th>{'Khách hàng'}</Th>
                  <Th>{'Gian kho'}</Th>
                  <Th>{'Ngày trả kho'}</Th>
                  <Th>{'Hiện trạng'}</Th>
                  <Th>{'Tiền cọc'}</Th>
                  <Th>{'Trạng thái'}</Th>
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
                    <Td>{r.status === 'pending' && !scheduledReturnIds.has(r.id) ? <input type="date" value={toDateInputValue(returnScheduleDrafts[r.id] ?? r.returnDate)} onChange={event => setReturnScheduleDrafts(previous => ({ ...previous, [r.id]: event.target.value }))} className="w-36 cursor-pointer rounded border border-stone-300 px-2 py-1 text-xs" aria-label={'Chọn ngày kiểm tra trả kho'} /> : (returnScheduleDrafts[r.id] ?? r.returnDate)}</Td>
                    <Td>
                      {r.condition === 'good'
                        ? <Badge variant="success">{'Tốt'}</Badge>
                        : <Badge variant="error">{'Hư hỏng'}</Badge>}
                      {r.damageNotes && <p className="text-xs text-red-500 mt-0.5">{r.damageNotes}</p>}
                    </Td>
                    <Td className="font-semibold">${r.deposit}</Td>
                    <Td>{s(r.status, { pending: 'warning', 'waiting-customer': 'info', refunded: 'success' })}</Td>
                    <Td>
                      {r.status === 'pending' && (
                        <Button variant="primary" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(false); setReturnInventory('match'); setReturnClassification('no-damage'); setReturnEvidence(''); setReturnNotes(r.finalCondition); setReturnActualPackages(r.packageCount > 0 ? String(r.packageCount) : ''); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setReturnDamageFee(''); setReturnCleaningFee(''); setReturnLostItemFee(''); setReturnOverdueFee(''); setReturnOtherDebt(''); setInspectModal(true) }}>
                          {'Nghiệm thu'}
                        </Button>
                      )}
                      {r.status !== 'pending' && <Button variant="ghost" size="sm" onClick={() => { setSelectedReturn(r); setReturnDetailsOnly(true); setReturnInventory('match'); setReturnClassification(r.classification === 'Chờ phân loại' ? 'no-damage' : r.classification); setReturnEvidence(r.evidence[r.evidence.length - 1] ?? ''); setReturnNotes(r.finalCondition); setReturnActualPackages(String(r.packageCount)); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setInspectModal(true) }}>{'Chi tiết'}</Button>}
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
        const tabList = ['Mở Mới', 'Đang Xử Lý', 'Chờ Customer', 'Đã Giải Quyết']
        const tabStatus: Record<string, TicketStatus> = {
          'Mở Mới': 'open',
          'Đang Xử Lý': 'in-progress',
          'Chờ Customer': 'waiting-customer',
          'Đã Giải Quyết': 'resolved',
        }
        const currentActiveTab = tabStatus[ticketTab] ?? 'open'
        const displayedTickets = facilityTickets.filter(tItem => tItem.status === currentActiveTab)
        const tabActive = tabList.find(tab => tabStatus[tab] === currentActiveTab) ?? tabList[0]

        return (
          <div className="fade-in space-y-5">
            <SectionHeader
              title={'Hàng đợi và phân công hỗ trợ'}
              subtitle={'Phân loại yêu cầu khách hàng, xử lý sự cố truy cập và lưu kết quả.'}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title={'Chờ phản hồi'}
                value={openCount}
                delta={openCount > 0 ? ('Cần xử lý gấp') : ('Đã giải quyết hết')}
                deltaPositive={openCount === 0}
                icon={Icon.alert}
                iconBg="bg-amber-50 text-amber-800"
              />
              <StatCard
                title={'Đang xử lý'}
                value={inProgressCount}
                icon={Icon.refresh}
                iconBg="bg-blue-50 text-blue-700"
              />
              <StatCard title={'Chờ Customer'} value={waitingCustomerCount} icon={Icon.support} iconBg="bg-violet-50 text-violet-700" />
              <StatCard
                title={'Phiếu đã giải quyết'}
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
                    <Th>{'Mã phiếu'}</Th>
                    <Th>{'Khách hàng'}</Th>
                    <Th>{'Nội dung và cơ sở'}</Th>
                    <Th>{'Danh mục'}</Th>
                    <Th>{'Mức độ'}</Th>
                    <Th>{'Ngày mở'}</Th>
                    <Th>{'Staff phụ trách'}</Th>
                    <Th>{'Trạng thái'}</Th>
                    <Th className="text-right">{'Thao tác'}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {displayedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-stone-400 text-sm">
                        {'Hiện không có phiếu nào trong hàng đợi.'}
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
                          <p className="text-xs text-stone-400">{tItem.facility} · Unit {tItem.unit}</p>
                        </Td>
                        <Td><Badge variant="muted">{tItem.category}</Badge></Td>
                        <Td>{s(tItem.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td>
                        <Td className="text-xs text-stone-500">{tItem.created}</Td>
                        <Td>
                          {assignedStaffByTicket[tItem.id]
                            ? <div className="flex items-center gap-2"><Avatar name={assignedStaffByTicket[tItem.id]} size="sm" /><span className="text-xs font-medium text-stone-700">{assignedStaffByTicket[tItem.id]}</span></div>
                            : <span className="text-xs italic text-stone-400">{'Chưa có Staff nhận'}</span>}
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
                            {'Phản hồi'} ({tItem.messages?.length ?? 1})
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
        <div className="fixed bottom-6 right-6 z-50 bg-[#292a27] text-white px-5 py-3 rounded-lg shadow-2xl border border-amber-500/50 flex items-center gap-3 fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e9a12c] animate-ping" />
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}
      <Modal open={reservationModal} onClose={() => setReservationModal(false)} size="xl" title={'Hồ Sơ Yêu Cầu Giữ Kho'}>
        {selectedReservation && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Khách hàng</p><b>{selectedReservation.customer}</b><p className="text-xs">{selectedReservation.phone}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Email</p><b>{selectedReservation.email}</b><p className="text-xs">{selectedReservation.emailVerified ? '✓ Đã xác nhận' : '⚠ Chưa xác nhận'}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Cơ sở / kho</p><b>{selectedReservation.facility} · {selectedReservation.unit}</b><p className="text-xs">{selectedReservation.facilityAddress}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">CCCD</p><b>{selectedReservation.identityId}</b><p className="text-xs">Đối chiếu bản gốc khi check-in</p></div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{'Trạng thái chuẩn'}:</b> {statusLabelMap[selectedReservation.status]}</span><span><b>{'Lịch Check-in'}:</b> {selectedReservation.appointmentDate} · {selectedReservation.appointmentTime}</span><span><b>{'Hạn cuối'}:</b> {selectedReservation.checkInDeadline}</span></div><p className="mt-2 text-xs text-blue-800">{'Staff theo dõi hồ sơ và chuẩn bị Check-in. Gian kho cụ thể đã được khách chọn từ đầu.'}</p></div>
            {selectedReservation.status === 'REVIEW_REQUIRED' && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">{'Hồ sơ cần Staff rà soát'}</p><p className="mt-1">{'Staff kiểm tra thông tin, hàng khai báo và bằng chứng trước khi quyết định.'}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="sm" onClick={() => { try { if (hub.holds.some(item => item.id === selectedReservation.id)) hub.approveReservation(selectedReservation.id, user); const updated = { ...selectedReservation, status: 'AWAITING_DEPOSIT' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast('Đã duyệt hồ sơ; Customer được mở bước thanh toán cọc.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể duyệt hồ sơ.') } }}>{'Duyệt → chờ cọc'}</Button>{(!hub.holds.some(item => item.id === selectedReservation.id) || hub.holds.find(item => item.id === selectedReservation.id)?.goodsReviewStatus === 'PENDING') && <Button variant="danger" size="sm" onClick={() => { try { if (hub.holds.some(item => item.id === selectedReservation.id)) hub.rejectGoodsReview(selectedReservation.id, user, 'Hàng hóa chưa phù hợp điều kiện lưu trữ.'); const updated = { ...selectedReservation, status: 'CANCELLED' as ReservationStatus }; setReservations(items => items.map(item => item.id === updated.id ? updated : item)); setSelectedReservation(updated); showToast('Đã từ chối ngoại lệ và giải phóng yêu cầu giữ kho.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể từ chối hồ sơ.') } }}>{'Từ chối'}</Button>}</div></div>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-slate-500">Loại hàng</p><b>{selectedReservation.goodsType}</b></div>
              <div><p className="text-xs text-slate-500">Chất liệu</p><b>{selectedReservation.material}</b></div>
              <div><p className="text-xs text-slate-500">Số kiện / cân thực</p><b>{selectedReservation.packageCount} / {selectedReservation.weightKg} kg</b></div>
              <div><p className="text-xs text-slate-500">Kích thước / DIM</p><b>{selectedReservation.dimensionsCm} cm / {selectedReservation.dimWeightKg} kg</b></div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><b>Hiện trạng khai báo ban đầu:</b> {selectedReservation.initialCondition}</div>
            <div><p className="mb-2 text-sm font-semibold">Dẫn chứng hoạt động</p>{selectedReservation.evidence.map(item => <p key={item} className="mb-1 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">✓ {item}</p>)}</div>
            {!selectedReservation.emailVerified && <Button onClick={() => showToast(`Đã gửi lại email xác nhận đến ${selectedReservation.email}`)}>Gửi lại email xác nhận</Button>}
          </div>
        )}
      </Modal>

      <Modal open={inspectModal} onClose={() => setInspectModal(false)} size="xl" title={'Nghiệm Thu Phòng Kho Trả'}>
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{'Khách hàng'}</span>
                <span className="font-medium">{selectedReturn.customer}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{'Gian kho'}</span>
                <span className="font-medium">{selectedReturn.unit}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{'Tiền cọc'}</span>
                <span className="font-semibold">${selectedReturn.deposit}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>{'Kỳ thuê'}:</b> {selectedReturn.contractStart} → {selectedReturn.contractEnd}</span>
                <span><b>{'Ngày Customer yêu cầu trả'}:</b> {selectedReturn.returnDate}</span>
                <span className="sm:col-span-2"><b>{'Lý do'}:</b> {selectedReturn.requestReason}</span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="mb-2 font-semibold">Đối chiếu giao dịch trước – sau</p>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-slate-500">Lúc check-in</p><p>{selectedReturn.initialCondition}</p><p>{selectedReturn.packageCount} kiện · {selectedReturn.initialWeightKg} kg</p></div>
                <div><p className="text-xs text-slate-500">Lúc trả kho</p><p>{selectedReturn.finalCondition}</p><p>{selectedReturn.packageCount} kiện · {selectedReturn.finalWeightKg} kg</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">{'Kết quả kiểm kê'}</label><select disabled={returnDetailsOnly} value={returnInventory} onChange={event => setReturnInventory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="match">{'Khớp khai báo'}</option><option value="missing">{'Thiếu / đã lấy ra'}</option><option value="damaged">{'Có hàng hư hỏng'}</option><option value="abandoned">{'Có hàng bỏ lại'}</option></select></div>
              <div><label className="text-sm font-medium">{'Phân loại hiện trạng'}</label><select disabled={returnDetailsOnly} value={returnClassification} onChange={event => setReturnClassification(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="no-damage">{'Không hư hại'}</option><option value="minor-damage">{'Hư hại nhẹ'}</option><option value="major-damage">{'Hư hại nặng'}</option><option value="requires-maintenance">{'Cần bảo trì'}</option></select></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input label={'Số kiện thực tế lúc trả'} type="number" value={returnActualPackages} onChange={event => setReturnActualPackages(event.target.value)} /><Input label={'PIN/thẻ/chìa khóa thu hồi'} value={returnKeys} onChange={event => setReturnKeys(event.target.value)} /></div>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><b>{'Bằng chứng bàn giao ban đầu (bất biến)'}:</b> {selectedReturn.evidence.join(' · ')}</div>
            <Input disabled={returnDetailsOnly} label={'Ảnh/bằng chứng trả kho mới (mã tệp hoặc đường dẫn)'} value={returnEvidence} onChange={event => setReturnEvidence(event.target.value)} />
            <div className="rounded-lg border border-stone-200 p-3"><p className="mb-3 text-sm font-semibold">{'Các khoản khấu trừ đề xuất'}</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Input label={'Hư hại'} type="number" value={returnDamageFee} onChange={event => setReturnDamageFee(event.target.value)} /><Input label={'Vệ sinh'} type="number" value={returnCleaningFee} onChange={event => setReturnCleaningFee(event.target.value)} /><Input label={'Thất lạc'} type="number" value={returnLostItemFee} onChange={event => setReturnLostItemFee(event.target.value)} /><Input label={'Quá hạn'} type="number" value={returnOverdueFee} onChange={event => setReturnOverdueFee(event.target.value)} /><Input label={'Công nợ khác'} type="number" value={returnOtherDebt} onChange={event => setReturnOtherDebt(event.target.value)} /></div><div className="mt-3 flex flex-wrap justify-between gap-2 rounded bg-slate-50 p-3 text-sm"><span>{'Tổng khấu trừ'}: <b>${returnTotalDeductions.toFixed(2)}</b></span><span>{'Tiền cọc hoàn lại đề xuất'}: <b className="text-emerald-700">${returnRefund.toFixed(2)}</b></span></div></div>
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

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{'Sau khi Staff gửi, hồ sơ chuyển sang “Chờ Customer xác nhận”. Staff không đóng hồ sơ hoặc hoàn cọc thay Customer.'}</div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setInspectModal(false)}>{returnDetailsOnly ? ('Đóng') : 'Hủy'}</Button>
              {!returnDetailsOnly && <Button
                variant="primary"
                disabled={!returnEvidence.trim() || !returnNotes.trim() || !returnKeys.trim() || Number(returnActualPackages) < 0}
                onClick={() => {
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
                      staffNotes: returnNotes.trim(),
                      evidencePhotos: [returnEvidence.trim(), `EV-OUT-${Date.now()} · ${user.name} lập biên bản; thu hồi ${returnKeys}`],
                      returnedItems: { key: true, card: true, lock: true },
                    })
                    setInspectModal(false)
                    showToast('Đã gửi biên bản; Customer đã nhận được yêu cầu xác nhận quyết toán.')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể hoàn tất nghiệm thu trả kho.')
                  }
                }}
              >
                {'Lưu biên bản'}
              </Button>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={checkinModal} onClose={() => setCheckinModal(false)} size="xl" title={'Đối Chiếu & Xác Nhận Check-in Kho'}>
        {selectedCheckin && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{'Khách hàng'}</span>
                <span className="font-medium">{selectedCheckin.customer}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{'Gian kho'}</span>
                <span className="font-medium">{selectedCheckin.unit}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>Email:</b> {selectedCheckin.email}</span><span><b>SĐT:</b> {selectedCheckin.phone}</span>
                <span><b>CCCD:</b> {selectedCheckin.identityId}</span><span><b>Cơ sở:</b> {selectedCheckin.facility}</span>
                <span><b>Hàng:</b> {selectedCheckin.goodsType}</span><span><b>Chất liệu:</b> {selectedCheckin.material}</span>
                <span><b>Số kiện:</b> {selectedCheckin.packageCount}</span><span><b>Cân thực / DIM:</b> {selectedCheckin.weightKg} / {selectedCheckin.dimWeightKg} kg</span>
                <span><b>{'Lịch hiện tại'}:</b> {selectedCheckin.appointmentDate} · {selectedCheckin.appointmentTime}</span><span><b>{'Hạn Check-in'}:</b> {selectedCheckin.checkInDeadline}</span>
              </div>
            </div>
            {selectedCheckin.scheduleChanged && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>{'Customer đã đổi lịch.'}</b> {selectedCheckin.previousAppointment && `${'Lịch cũ'}: ${selectedCheckin.previousAppointment}. `}{'Hãy dùng lịch mới nhất và kiểm tra lại xung đột gian kho.'}</div>}
            {isOutsideAppointmentDate && <Input label={'Lý do override ngoài ngày hẹn (bắt buộc)'} value={scheduleOverrideReason} onChange={event => setScheduleOverrideReason(event.target.value)} />}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><b>{'Khai báo cần đối chiếu'}:</b> {selectedCheckin.dimensionsCm} cm · {selectedCheckin.weightKg} kg · {selectedCheckin.material} · {selectedCheckin.initialCondition}</div>
            <div className="rounded-lg border border-stone-200 p-3 space-y-3"><p className="font-semibold text-sm">{'Số đo và tình trạng thực tế'}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label={'Kích thước thực tế (D × R × C cm)'} value={actualDimensions} onChange={event => setActualDimensions(event.target.value)} /><Input label={'Khối lượng thực tế (kg)'} type="number" value={actualWeight} onChange={event => setActualWeight(event.target.value)} /><Input label={'Vật liệu thực tế'} value={actualMaterial} onChange={event => setActualMaterial(event.target.value)} /><Input label={'Hiện trạng kho ban đầu / hư hại có sẵn'} value={actualCondition} onChange={event => setActualCondition(event.target.value)} /></div><Input label={'Ảnh/bằng chứng bàn giao (mã tệp hoặc đường dẫn)'} value={checkinEvidence} onChange={event => setCheckinEvidence(event.target.value)} /></div>
            {fitEvaluation && <div className="rounded-lg border border-stone-200 p-3 text-sm"><p className="font-semibold">{'Kiểm tra khả năng tiếp nhận thực tế'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span>{'Cửa kho'}: {fitEvaluation.spec.doorWidth} × {fitEvaluation.spec.doorHeight} cm</span><span>{'Lọt lòng'}: {fitEvaluation.spec.inner.join(' × ')} cm</span><span>{'Tải trọng tối đa'}: {fitEvaluation.spec.maxWeight} kg</span><span>{'Kích thước kiện lớn nhất'}: {actualDimensions || '—'} cm</span></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant={fitEvaluation.doorFits ? 'success' : 'error'}>{fitEvaluation.doorFits ? ('Đã kiểm tra lọt cửa khi xoay') : ('Không lọt cửa')}</Badge><Badge variant={fitEvaluation.weightFits ? 'success' : 'error'}>{fitEvaluation.weightFits ? ('Đạt tải trọng') : ('Vượt tải trọng')}</Badge><Badge variant={fitEvaluation.volumeFits ? 'success' : 'error'}>{fitEvaluation.volumeFits ? ('Đạt thể tích/kích thước') : ('Vượt thể tích')}</Badge></div>{(!fitEvaluation.doorFits || !fitEvaluation.weightFits || !fitEvaluation.volumeFits) && <p className="mt-2 font-medium text-red-700">{'Không thể hoàn tất Check-in. Hãy yêu cầu Manager đổi cỡ kho hoặc gian kho khác.'}</p>}</div>}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm"><p className="font-semibold text-emerald-900">{'Hợp đồng và thanh toán phần còn lại'}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><span><b>{'Mã đơn'}:</b> {selectedCheckin.reservationId}</span><span><b>{'Mã hợp đồng'}:</b> CTR-{selectedCheckin.reservationId}</span><span><b>{'Cơ sở / gian kho'}:</b> {selectedCheckin.facility} · {selectedCheckin.unit}</span><span><b>{'Ngày bàn giao'}:</b> {selectedCheckin.appointmentDate} · {selectedCheckin.appointmentTime}</span><span><b>{'Tiền cọc'}:</b> {reservationForCheckin?.paid ? '20% · đã thu' : 'Chưa xác nhận'}</span><span><b>{'Người thu'}:</b> {user.name}</span></div><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">File scan hợp đồng đã ký</span><input type="file" accept="application/pdf,image/*" onChange={event => setContractFile(event.target.files?.[0]?.name || '')} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:font-semibold file:text-white" />{contractFile && <span className="mt-1 block text-xs text-emerald-800">Đã chọn: {contractFile}</span>}</label><Input label={'Mã giao dịch phần còn lại'} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} /><Input label={'Ảnh/chứng từ thanh toán'} value={paymentEvidence} onChange={event => setPaymentEvidence(event.target.value)} /></div></div>
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              {([
                ['identity', 'Đã đối chiếu CCCD/Hộ chiếu gốc'],
                ['reservation', 'Đơn ở trạng thái UNIT_RESERVED/READY_FOR_CHECKIN, đúng cơ sở và lịch'],
                ['contract', 'Hợp đồng đã được Customer ký và lưu bản scan'],
                ['payment', 'Đã thu đủ phần còn lại và phát hành biên nhận'],
                ['measurement', 'Đã đo hàng thực tế và xử lý chênh lệch'],
                ['walkthrough', 'Đã walkthrough gian kho với Customer'],
                ['condition', 'Đã kiểm tra tường, sàn, cửa, khóa, đèn, vệ sinh và hư hại sẵn có'],
                ['credential', `Đã cấp PIN/thẻ/chìa khóa cho kho ${selectedCheckin.unit}`]
              ] as Array<[string, string]>).map(([key, label]) => <label key={key} className="flex items-start gap-3 cursor-pointer text-left"><input type="checkbox" checked={Boolean(checkinChecks[key])} onChange={event => setCheckinChecks(previous => ({ ...previous, [key]: event.target.checked }))} className="!w-4 !h-4 flex-none shrink-0 mt-0.5 accent-blue-600" /><span className="min-w-0 flex-1 text-left text-sm leading-5 text-slate-700">{label}</span></label>)}
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs"><b>{'Thông tin credential'}:</b> {`PIN-${selectedCheckin.id}`} · {selectedCheckin.unit} · {selectedCheckin.customer} · {user.name} · {'kích hoạt khi hoàn tất check-in'}</div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{'Staff hoàn tất Check-in để kích hoạt rental. Customer sẽ tự bấm “Tôi đã nhận kho”; trước thời điểm đó hồ sơ mang nhãn “Chờ khách xác nhận bàn giao”.'}</div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">{'Ghi chú bàn giao'}</label><textarea rows={2} value={checkinNotes} onChange={event => setCheckinNotes(event.target.value)} placeholder={'Ghi rõ chênh lệch hàng hóa hoặc lưu ý vận hành...'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCheckinModal(false)}>{'Hủy'}</Button>
              <Button
                variant="primary"
                disabled={!checkinCanComplete}
                onClick={() => {
                  const sharedHold = hub.holds.find(item => item.id === selectedCheckin.reservationId)
                  if (!sharedHold) { showToast('Không tìm thấy đơn đặt kho dùng chung.'); return }
                  try {
                    const hasSignedContract = hub.contracts.some(item => item.reservationId === sharedHold.id && item.status === 'SIGNED')
                    if (!hasSignedContract) hub.signPaperContract({ holdId: sharedHold.id, staffUser: user, identityVerified: Boolean(checkinChecks.identity), contractNumber: `CTR-${sharedHold.id}`, signedAt: new Date().toISOString(), startDate: sharedHold.startDate, endDate: sharedHold.endDate, scannedFileUrl: `local-upload://${encodeURIComponent(contractFile.trim())}`, scannedFileName: contractFile.trim() })
                    if (sharedHold.remainingAmount > 0) hub.recordRemainingPayment(sharedHold.id, user, { amount: sharedHold.remainingAmount, paymentMethod: 'BANK_TRANSFER', transactionReference: paymentReference.trim(), proofImage: paymentEvidence.trim() })
                    setPendingCheckinCompletionId(selectedCheckin.id)
                    showToast('Đã ghi nhận hợp đồng và thanh toán. Hệ thống đang hoàn tất Check-in…')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể chuẩn bị hồ sơ Check-in.')
                  }
                }}
              >
                {'Hoàn tất Check-in'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(selectedRenewal)} onClose={() => setSelectedRenewal(null)} title="Hoàn tất gia hạn tại cơ sở">
        {selectedRenewal && <div className="space-y-4"><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><b>{selectedRenewal.unitId}</b> · {selectedRenewal.customerName}<br />Thời hạn mới: {selectedRenewal.newEndDate}</div><Input label="Số phụ lục / hợp đồng gia hạn" value={renewalContractNumber} onChange={event => setRenewalContractNumber(event.target.value)} /><Input label="Mã phiếu thu phần còn lại" value={renewalPaymentReference} onChange={event => setRenewalPaymentReference(event.target.value)} /><label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">File scan phụ lục đã ký</span><input type="file" accept="application/pdf,image/*" onChange={event => setRenewalContractFile(event.target.files?.[0]?.name || '')} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-700 file:px-3 file:py-1.5 file:font-semibold file:text-white" />{renewalContractFile && <span className="mt-1 block text-xs text-emerald-700">Đã chọn: {renewalContractFile}</span>}</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={renewalIdentityVerified} onChange={event => setRenewalIdentityVerified(event.target.checked)} />Đã đối chiếu giấy tờ khách hàng</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={renewalTermsVerified} onChange={event => setRenewalTermsVerified(event.target.checked)} />Đã đối chiếu gian kho và điều khoản gia hạn</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedRenewal(null)}>Hủy</Button><Button disabled={!renewalContractFile || !renewalContractNumber.trim() || !renewalPaymentReference.trim() || !renewalIdentityVerified || !renewalTermsVerified} onClick={() => { try { hub.completeRenewalAtFacility({ renewalId: selectedRenewal.id, staffUser: user, transactionReference: renewalPaymentReference.trim(), identityVerified: renewalIdentityVerified, unitAndTermsVerified: renewalTermsVerified, contractNumber: renewalContractNumber.trim(), signedAt: new Date().toISOString(), scannedFileUrl: `local-upload://${encodeURIComponent(renewalContractFile)}`, scannedFileName: renewalContractFile }); setSelectedRenewal(null); showToast('Đã hoàn tất gia hạn. Customer đã nhận thời hạn hợp đồng và biên nhận mới.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể hoàn tất gia hạn.') } }}>Xác nhận hoàn tất</Button></div></div>}
      </Modal>

      <Modal open={Boolean(noShowTarget)} onClose={() => setNoShowTarget(null)} title={'Xác nhận Customer No-show'}>
        {noShowTarget && <div className="space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>{noShowTarget.customer}</b> · {noShowTarget.unit}<br />{'Lịch Check-in'}: {noShowTarget.appointmentDate} · {noShowTarget.appointmentTime}<br />{'Hạn cuối'}: {noShowTarget.checkInDeadline}</div><Input label={'Lý do No-show (bắt buộc)'} value={noShowReason} onChange={event => setNoShowReason(event.target.value)} /><p className="text-xs text-stone-500">{'Thao tác này hủy Check-in và ghi nhận yêu cầu giải phóng gian kho/thu hồi credential chờ kích hoạt.'}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNoShowTarget(null)}>{'Hủy'}</Button><Button variant="danger" disabled={!noShowReason.trim()} onClick={() => { try { hub.expireReservation(noShowTarget.reservationId, 'NO_SHOW'); setCheckins(items => items.map(item => item.id === noShowTarget.id ? { ...item, status: 'no-show', evidence: [...item.evidence, `NO-SHOW-${Date.now()} · ${user.name}: ${noShowReason.trim()} · hủy Check-in, giải phóng kho, thu hồi credential`] } : item)); setNoShowTarget(null); showToast('Đã ghi nhận No-show; Customer và kho đã được cập nhật.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể ghi nhận No-show.') } }}>{'Xác nhận No-show'}</Button></div></div>}
      </Modal>

      {/* Staff Ticket Resolution Modal */}
      <Modal open={respondModal} onClose={() => setRespondModal(false)} title={'Phản hồi và xử lý phiếu hỗ trợ'}>
        {activeStaffTicket && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#292a27] p-4 text-white">
              <div className="flex justify-between items-center text-xs font-mono text-[#e9a12c]">
                <span>{activeStaffTicket.id}</span>
                <span>{activeStaffTicket.facility}</span>
              </div>
              <h3 className="font-bold text-base mt-1 text-stone-100">{activeStaffTicket.subject}</h3>
              <p className="text-xs text-stone-300 mt-1">
                {'Khách thuê: '}{activeStaffTicket.customer} ({activeStaffTicket.email}) · Unit {activeStaffTicket.unit}
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
                          <span>{msg.role === 'staff' ? ('Staff hỗ trợ') : msg.role === 'customer' ? ('Khách hàng') : ('Hệ thống')}</span>
                          <span>· {msg.time}</span>
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
                  {'Cập Nhật Trạng Thái'}
                </label>
                <select
                  value={ticketNewStatus}
                  onChange={e => setTicketNewStatus(e.target.value as TicketStatus)}
                  className="w-full border border-stone-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="open">{'Mở Mới / Chờ xử lý'}</option>
                  <option value="in-progress">{'Đang Khắc Phục'}</option>
                  <option value="waiting-customer">{'Chờ Customer Phản Hồi'}</option>
                  <option value="resolved">{'Đã Giải Quyết Xong'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  {'Nhân Viên Tiếp Nhận'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={assignedStaffByTicket[activeStaffTicket.id] || ('Chưa có Staff nhận xử lý')}
                    className="min-w-0 flex-1 border border-stone-200 rounded-lg p-2 text-xs bg-stone-100 text-stone-600"
                  />
                  {assignedStaffByTicket[activeStaffTicket.id] !== user.name && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setAssignedStaffByTicket(previous => ({ ...previous, [activeStaffTicket.id]: user.name }))
                      setTicketNewStatus('in-progress')
                      showToast(`${user.name} đã nhận xử lý ${activeStaffTicket.id}.`)
                    }}>{'Nhận xử lý'}</Button>
                  )}
                </div>
              </div>
            </div>

            {/* Staff Reply */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700">
                {'Nội Dung Phản Hồi Chính Thức Tới Khách'}
              </label>
              <textarea
                rows={3}
                placeholder={'Nhập hướng dẫn khắc phục sự cố, cấp lại mã PIN hoặc thông báo cho khách...'}
                value={staffReplyText}
                onChange={e => setStaffReplyText(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-2.5 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <Input label={'Bằng chứng đính kèm (mã tệp/đường dẫn)'} value={ticketEvidence} onChange={event => setTicketEvidence(event.target.value)} />
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><label className="text-xs font-semibold text-amber-900"><input type="checkbox" checked={ticketEscalated} onChange={event => { setTicketEscalated(event.target.checked); if (event.target.checked) setTicketNewStatus('in-progress') }} /> {'Chuyển cấp cho quản lý/đội kỹ thuật'}</label>{ticketEscalated && <Input label={'Lý do chuyển cấp'} value={ticketEscalationReason} onChange={event => setTicketEscalationReason(event.target.value)} />}</div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <Button variant="outline" onClick={() => setRespondModal(false)}>{'Hủy'}</Button>
              <Button
                variant="primary"
                disabled={!staffReplyText.trim() || (ticketEscalated && !ticketEscalationReason.trim())}
                onClick={() => {
                  const newMsg = staffReplyText.trim() ? {
                    id: `msg-${Date.now()}`,
                    sender: user.name,
                    role: 'staff' as const,
                    time: 'Vừa xong',
                    text: `${staffReplyText.trim()}${ticketEvidence.trim() ? `\n[Evidence: ${ticketEvidence.trim()}]` : ''}${ticketEscalated ? `\n[Escalated: ${ticketEscalationReason.trim()}]` : ''}`
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
                  showToast(`${user.name} đã gửi phản hồi cho ${activeStaffTicket.id}.`)
                }}
              >
                {'Lưu và chuyển phản hồi'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
