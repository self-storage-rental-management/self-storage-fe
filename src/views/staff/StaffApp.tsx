import { useEffect, useRef, useState } from 'react'
import Layout, { getInitialPage, Icon } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Tabs, Avatar, Input } from '../../components/ui'
import ProfileView from '../ProfileView'
import { useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import { RESERVATIONS, CHECKINS, RETURNS, SUPPORT_TICKETS, MY_RENTALS, type TicketItem } from "../../data/demoDatabase"

type ReservationStatus = 'CREATED' | 'DEPOSIT_PAID' | 'UNIT_RESERVED' | 'READY_FOR_CHECKIN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
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

const addDays = (dateLabel: string, days: number) => {
  const date = new Date(dateLabel)
  if (Number.isNaN(date.getTime())) return dateLabel
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const reservationSeed: StaffReservation[] = RESERVATIONS.map((item, index) => ({
  ...item,
  status: item.paid ? (item.unit ? 'UNIT_RESERVED' : 'DEPOSIT_PAID') : 'CREATED',
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
    CREATED: 'Chờ thanh toán cọc',
    DEPOSIT_PAID: 'Đã cọc · Chờ phân kho',
    UNIT_RESERVED: 'Đã phân kho',
    READY_FOR_CHECKIN: 'Sẵn sàng Check-in',
    COMPLETED: 'Đã kích hoạt thuê',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Đã hết hạn',
    'waiting-customer': 'Chờ Customer phản hồi',
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
  const { lang, t } = useLanguage()

  const NAV = [
    { id: 'dashboard', label: lang === 'vi' ? 'Tổng quan ca làm việc' : 'Staff Dashboard', icon: Icon.home, group: lang === 'vi' ? 'Ca làm việc' : 'Work Queue' },
    { id: 'tasks', label: lang === 'vi' ? 'Nhiệm vụ trong ngày' : 'Daily Tasks', icon: Icon.tasks, group: lang === 'vi' ? 'Ca làm việc' : 'Work Queue' },
    { id: 'reservations', label: lang === 'vi' ? 'Xác nhận đặt kho' : 'Reservations', icon: Icon.calendar, group: lang === 'vi' ? 'Dịch vụ khách hàng' : 'Customer Service' },
    { id: 'checkin', label: lang === 'vi' ? 'Bàn giao & Nhận kho' : 'Check-in / Handover', icon: Icon.truck, group: lang === 'vi' ? 'Dịch vụ khách hàng' : 'Customer Service' },
    { id: 'return', label: lang === 'vi' ? 'Nghiệm thu trả kho' : 'Return Inspection', icon: Icon.clipboard, group: lang === 'vi' ? 'Dịch vụ khách hàng' : 'Customer Service' },
    { id: 'support', label: lang === 'vi' ? 'Hỗ trợ khách hàng' : 'Support Tickets', icon: Icon.support, group: lang === 'vi' ? 'Chăm sóc & Hỗ trợ' : 'Support' },
  ]

  const [page, setPage] = useState(() => getInitialPage(NAV, 'dashboard'))
  const [reservations] = useState<StaffReservation[]>(reservationSeed)
  const [checkins, setCheckins] = useState<StaffCheckin[]>(checkinSeed)
  const [returns, setReturns] = useState<StaffReturn[]>(returnSeed)
  const [inspectModal, setInspectModal] = useState(false)
  const [checkinModal, setCheckinModal] = useState(false)
  const [reservationModal, setReservationModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<StaffReservation | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<StaffReturn | null>(null)
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
  const [scheduleOverrideReason, setScheduleOverrideReason] = useState('')
  const [noShowTarget, setNoShowTarget] = useState<StaffCheckin | null>(null)
  const [noShowReason, setNoShowReason] = useState('')
  const [returnInventory, setReturnInventory] = useState('match')
  const [returnClassification, setReturnClassification] = useState('no-damage')
  const [returnEvidence, setReturnEvidence] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnActualPackages, setReturnActualPackages] = useState('')
  const [returnKeys, setReturnKeys] = useState('')
  const [returnDamageFee, setReturnDamageFee] = useState('0')
  const [returnCleaningFee, setReturnCleaningFee] = useState('0')
  const [returnLostItemFee, setReturnLostItemFee] = useState('0')
  const [returnOverdueFee, setReturnOverdueFee] = useState('0')
  const [returnOtherDebt, setReturnOtherDebt] = useState('0')

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
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const activeStaffTicket = selectedStaffTicket
    ? staffTickets.find(ticket => ticket.id === selectedStaffTicket.id) ?? selectedStaffTicket
    : null

  useEffect(() => {
    if (!respondModal || !activeStaffTicket) return
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [respondModal, activeStaffTicket?.messages.length])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const s = (v: string, map: Record<string, string>) => {
    const label = statusLabelMap[lang]?.[v] || (v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, ' '))
    return <Badge variant={map[v] ?? 'muted'}>{label}</Badge>
  }

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
  const operationalTasks = [
    ...reservations.filter(r => r.status === 'DEPOSIT_PAID').map(r => ({ id: `allocation-${r.id}`, title: lang === 'vi' ? `Theo dõi Manager phân kho ${r.id}` : `Track unit allocation ${r.id}`, customer: r.customer, time: `${r.appointmentDate} ${r.appointmentTime}`, sla: lang === 'vi' ? 'Chờ Manager phân kho' : 'Awaiting manager allocation', priority: 'medium', page: 'reservations' })),
    ...eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').map(c => ({ id: `checkin-${c.id}`, title: lang === 'vi' ? `Check-in & bàn giao ${c.unit}` : `Check-in & handover ${c.unit}`, customer: c.customer, time: `${c.appointmentDate} ${c.appointmentTime}`, sla: c.scheduleChanged ? (lang === 'vi' ? 'Lịch đã thay đổi' : 'Schedule changed') : (lang === 'vi' ? `Hạn ${c.checkInDeadline}` : `Deadline ${c.checkInDeadline}`), priority: c.scheduleChanged ? 'high' : 'medium', page: 'checkin' })),
    ...returns.filter(r => r.status !== 'refunded').map(r => ({ id: `return-${r.id}`, title: lang === 'vi' ? `Kiểm tra trả kho ${r.unit}` : `Return inspection ${r.unit}`, customer: r.customer, time: returnScheduleDrafts[r.id] || r.returnDate, sla: scheduledReturnIds.has(r.id) ? (lang === 'vi' ? 'Đã xác nhận lịch' : 'Scheduled') : (lang === 'vi' ? 'Cần xác nhận lịch' : 'Schedule required'), priority: scheduledReturnIds.has(r.id) ? 'medium' : 'high', page: 'return' })),
    ...facilityTickets.filter(ticket => ticket.status !== 'resolved').map(ticket => ({ id: `support-${ticket.id}`, title: lang === 'vi' ? `Xử lý hỗ trợ ${ticket.id}` : `Handle support ${ticket.id}`, customer: ticket.customer, time: ticket.created, sla: ticket.status === 'waiting-customer' ? (lang === 'vi' ? 'Chờ Customer phản hồi' : 'Waiting for customer') : ticket.priority === 'high' ? (lang === 'vi' ? 'Xử lý ngay' : 'Immediate') : (lang === 'vi' ? 'Trong ca' : 'Within shift'), priority: ticket.priority, page: 'support' })),
    ...expiringRentals.map(rental => ({ id: `expiry-${rental.id}`, title: lang === 'vi' ? `Hợp đồng ${rental.unit} sắp hết hạn` : `Lease ${rental.unit} expiring`, customer: lang === 'vi' ? 'Khách thuê hiện tại' : 'Current tenant', time: rental.nextDue, sla: lang === 'vi' ? 'Theo dõi nhắc gia hạn' : 'Track renewal reminder', priority: 'low', page: 'tasks' }))
  ].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
  const totalCount = operationalTasks.length
  const completedCount = reservations.filter(r => r.status === 'COMPLETED').length + checkins.filter(c => c.status === 'completed').length + returns.filter(r => r.status === 'waiting-customer' || r.status === 'refunded').length + facilityTickets.filter(ticket => ticket.status === 'resolved').length


  return (
    <Layout
      user={user} navItems={NAV} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      roleLabel="Staff" roleColor="bg-green-100 text-green-700"
    >
      {page === 'dashboard' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            eyebrow={lang === 'vi' ? 'CỔNG NHÂN VIÊN · TỔNG QUAN VẬN HÀNH' : 'STAFF PORTAL · OPERATIONS OVERVIEW'}
            title={lang === 'vi' ? 'Tổng Quan Ca Làm Việc' : 'Staff Home / Dashboard'}
            subtitle={`${user.facility ?? (lang === 'vi' ? 'Cơ sở được phân quyền' : 'Authorized facility')} · ${new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}`}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={lang === 'vi' ? 'Chờ Manager phân kho' : 'Awaiting Unit Allocation'} value={reservations.filter(r => r.status === 'DEPOSIT_PAID').length} icon={Icon.alert} iconBg="bg-amber-50" />
            <StatCard title={lang === 'vi' ? 'Check-in sắp tới' : 'Upcoming Check-ins'} value={eligibleCheckins.filter(c => c.status !== 'completed' && c.status !== 'no-show').length} icon={Icon.truck} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Trả kho cần xử lý' : 'Returns to Process'} value={returns.filter(r => r.status !== 'refunded').length} icon={Icon.clipboard} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Hỗ trợ đang mở' : 'Open Support Cases'} value={staffTickets.filter(ticket => ticket.status !== 'resolved').length} icon={Icon.support} iconBg="bg-red-50" />
          </div>
          <Card>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3"><div><h3 className="font-bold">{lang === 'vi' ? 'Việc ưu tiên theo lịch vận hành' : 'Priority Operational Tasks'}</h3><p className="text-xs text-stone-500">{lang === 'vi' ? 'Lịch nhận/trả kho, hỗ trợ và hợp đồng sắp hết hạn.' : 'Check-ins, returns, support and expiring leases.'}</p></div><Button variant="outline" size="sm" onClick={() => setPage('tasks')}>{lang === 'vi' ? 'Xem toàn bộ' : 'View all'}</Button></div>
            <Table><Thead><tr><Th>{lang === 'vi' ? 'Ưu tiên' : 'Priority'}</Th><Th>{lang === 'vi' ? 'Nhiệm vụ' : 'Task'}</Th><Th>{lang === 'vi' ? 'Khách hàng' : 'Customer'}</Th><Th>{lang === 'vi' ? 'Lịch / SLA' : 'Schedule / SLA'}</Th><Th></Th></tr></Thead><Tbody>
              {operationalTasks.slice(0, 6).map(task => <Tr key={task.id}><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td><b>{task.title}</b><p className="text-[11px] text-stone-400">{task.id}</p></Td><Td>{task.customer}</Td><Td><p className="text-xs">{task.time}</p><p className="text-[11px] font-semibold text-amber-700">{task.sla}</p></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => setPage(task.page)}>{lang === 'vi' ? 'Xử lý' : 'Open'}</Button></Td></Tr>)}
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
            <StatCard title={t('tasks.remaining', 'Remaining')} value={Math.max(0, totalCount)} icon={Icon.alert} iconBg="bg-amber-50" />
          </div>

          <Card><Table><Thead><tr><Th>{lang === 'vi' ? 'Nhiệm vụ được giao' : 'Assigned Task'}</Th><Th>{lang === 'vi' ? 'Khách hàng' : 'Customer'}</Th><Th>{lang === 'vi' ? 'Lịch' : 'Schedule'}</Th><Th>SLA</Th><Th>{lang === 'vi' ? 'Ưu tiên' : 'Priority'}</Th><Th></Th></tr></Thead><Tbody>
            {operationalTasks.map(task => <Tr key={task.id}><Td><b>{task.title}</b></Td><Td>{task.customer}</Td><Td className="text-xs">{task.time}</Td><Td className="text-xs font-semibold text-amber-700">{task.sla}</Td><Td>{s(task.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => setPage(task.page)}>{lang === 'vi' ? 'Mở hồ sơ' : 'Open record'}</Button></Td></Tr>)}
          </Tbody></Table></Card>
        </div>
      )}

      {/* ── RESERVATIONS ──────────────────────────────────────── */}
      {page === 'reservations' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Theo Dõi Đơn Đặt Giữ Kho' : 'Reservation Tracking'}
            subtitle={lang === 'vi' ? 'Staff chỉ theo dõi trạng thái và chuẩn bị Check-in; đơn hợp lệ không cần Staff phê duyệt.' : 'Staff monitors progress and prepares check-in; valid reservations require no staff approval.'}
          />
          <Card className="p-4 mb-4"><div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3"><Input label={lang === 'vi' ? 'Tìm hồ sơ' : 'Search records'} value={reservationSearch} onChange={event => setReservationSearch(event.target.value)} placeholder={lang === 'vi' ? 'Mã đơn, tên, SĐT, email, CCCD, cơ sở, mã kho' : 'Code, name, phone, email, ID, facility, unit'} /><div><label className="text-sm font-medium text-stone-700">{lang === 'vi' ? 'Trạng thái chuẩn' : 'Canonical status'}</label><select value={reservationStatus} onChange={event => setReservationStatus(event.target.value)} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="all">{lang === 'vi' ? 'Tất cả' : 'All'}</option>{(['CREATED', 'DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as ReservationStatus[]).map(status => <option key={status} value={status}>{statusLabelMap[lang][status]}</option>)}</select></div></div><p className="mt-2 text-xs text-stone-500">{filteredReservations.length}/{reservations.length} {lang === 'vi' ? 'hồ sơ phù hợp' : 'matching records'}</p></Card>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{t('reservations.col.id', 'Reservation')}</Th>
                  <Th>{t('reservations.col.customer', 'Customer')}</Th>
                  <Th>{t('reservations.col.unit', 'Unit')}</Th>
                  <Th>{lang === 'vi' ? 'Lịch Check-in hiện tại' : 'Current Check-in'}</Th>
                  <Th>{t('reservations.col.payment', 'Payment')}</Th>
                  <Th>{t('reservations.col.status', 'Status')}</Th>
                  <Th>{t('reservations.col.actions', 'Actions')}</Th>
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
                    <Td><p>{r.appointmentDate} · {r.appointmentTime}</p><p className="text-[11px] text-stone-500">{lang === 'vi' ? 'Hạn cuối' : 'Deadline'}: {r.checkInDeadline}</p>{r.previousAppointment && <p className="text-[11px] text-amber-700">{lang === 'vi' ? 'Lịch cũ' : 'Previous'}: {r.previousAppointment}</p>}</Td>
                    <Td>{r.paid ? <Badge variant="success">{t('reservations.paid', 'Paid')}</Badge> : <Badge variant="error">{t('reservations.unpaid', 'Unpaid')}</Badge>}</Td>
                    <Td>{s(r.status, { CREATED: 'warning', DEPOSIT_PAID: 'info', UNIT_RESERVED: 'info', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'muted', EXPIRED: 'error' })}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReservation(r); setReservationModal(true) }}>{t('reservations.view', 'View')}</Button>
                        {r.status === 'CREATED' && <Badge variant="warning">{lang === 'vi' ? 'Chỉ theo dõi · chờ cọc' : 'Monitor only'}</Badge>}
                        {r.status === 'DEPOSIT_PAID' && <Badge variant="info">{lang === 'vi' ? 'Manager đang phân kho' : 'Manager allocation'}</Badge>}
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
            title={t('checkin.title', 'Check-in / Handover')}
            subtitle={t('checkin.subtitle', 'Process customer move-ins and unit handovers')}
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
                        <p className="text-[11px] text-slate-500">{lang === 'vi' ? 'Hạn cuối Check-in' : 'Check-in deadline'}: {c.checkInDeadline}</p>
                        {c.previousAppointment && <p className="text-[11px] text-amber-700">{lang === 'vi' ? 'Lịch cũ' : 'Previous schedule'}: {c.previousAppointment}</p>}
                        {c.scheduleChanged && <Badge variant="warning">{lang === 'vi' ? 'Customer đã đổi lịch' : 'Customer rescheduled'}</Badge>}
                        <p className="mt-1 text-xs font-medium text-slate-600">{c.goodsType} · {c.packageCount} kiện · {c.weightKg} kg · DIM {c.dimWeightKg} kg</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s(c.status, { scheduled: 'info', 'pending-payment': 'warning', completed: 'success', 'no-show': 'error' })}
                    {c.status !== 'completed' && (
                      <Button variant="primary" size="sm" onClick={() => {
                        setSelectedCheckin(c)
                        setCheckinChecks({ identity: false, reservation: false, contract: false, payment: c.status !== 'pending-payment', measurement: false, walkthrough: false, condition: false, credential: false })
                        setActualDimensions(c.dimensionsCm)
                        setActualWeight(String(c.weightKg))
                        setActualMaterial(c.material)
                        setActualCondition(c.initialCondition)
                        setCheckinEvidence('')
                        setCheckinNotes('')
                        setContractFile('')
                        setPaymentReference('')
                        setPaymentEvidence('')
                        setScheduleOverrideReason('')
                        setCheckinModal(true)
                      }}>
                        {t('checkin.process', 'Process Check-in')}
                      </Button>
                    )}
                    {c.status !== 'completed' && <Button variant="danger" size="sm" disabled={!canMarkNoShow} onClick={() => { setNoShowTarget(c); setNoShowReason('') }}>{lang === 'vi' ? 'Đánh dấu No-show' : 'Mark No-show'}</Button>}
                    {c.status === 'completed' && <Button variant="ghost" size="sm">{t('checkin.viewRecord', 'View Record')}</Button>}
                  </div>
                </div>
              </Card>
              )
            })}
          </div>
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
                    <Td className="font-semibold">${r.deposit}</Td>
                    <Td>{s(r.status, { pending: 'warning', 'waiting-customer': 'info', refunded: 'success' })}</Td>
                    <Td>
                      {r.status === 'pending' && !scheduledReturnIds.has(r.id) && <Button variant="primary" size="sm" onClick={() => { setScheduledReturnIds(previous => new Set(previous).add(r.id)); showToast(lang === 'vi' ? 'Đã xác nhận lịch kiểm tra trả kho.' : 'Return inspection schedule confirmed.') }}>{lang === 'vi' ? 'Xác nhận lịch' : 'Confirm schedule'}</Button>}
                      {r.status === 'pending' && scheduledReturnIds.has(r.id) && (
                        <Button variant="primary" size="sm" onClick={() => { setSelectedReturn(r); setReturnInventory('match'); setReturnClassification('no-damage'); setReturnEvidence(''); setReturnNotes(r.finalCondition); setReturnActualPackages(String(r.packageCount)); setReturnKeys('Đã thu hồi đủ PIN/thẻ/chìa khóa'); setReturnDamageFee('0'); setReturnCleaningFee('0'); setReturnLostItemFee('0'); setReturnOverdueFee('0'); setReturnOtherDebt('0'); setInspectModal(true) }}>
                          {t('return.action.inspect', 'Inspect')}
                        </Button>
                      )}
                      {r.status !== 'pending' && <Button variant="ghost" size="sm">{t('return.action.details', 'Details')}</Button>}
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
        const tabList = lang === 'vi' ? ['Mở Mới', 'Đang Xử Lý', 'Chờ Customer', 'Đã Giải Quyết'] : ['Open', 'In Progress', 'Waiting for Customer', 'Resolved']
        const tabStatus: Record<string, TicketStatus> = {
          'Mở Mới': 'open', Open: 'open',
          'Đang Xử Lý': 'in-progress', 'In Progress': 'in-progress',
          'Chờ Customer': 'waiting-customer', 'Waiting for Customer': 'waiting-customer',
          'Đã Giải Quyết': 'resolved', Resolved: 'resolved',
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
              <StatCard title={lang === 'vi' ? 'Chờ Customer' : 'Waiting for Customer'} value={waitingCustomerCount} icon={Icon.support} iconBg="bg-violet-50 text-violet-700" />
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
                    <Th>{t('support.col.id', 'Ticket ID')}</Th>
                    <Th>{t('support.col.tenant', 'Tenant Customer')}</Th>
                    <Th>{t('support.col.subject', 'Subject & Facility')}</Th>
                    <Th>{t('support.col.category', 'Category')}</Th>
                    <Th>{t('support.col.priority', 'Priority')}</Th>
                    <Th>{t('support.col.opened', 'Opened Date')}</Th>
                    <Th>{lang === 'vi' ? 'Staff phụ trách' : 'Assigned Staff'}</Th>
                    <Th>{t('support.col.status', 'Status')}</Th>
                    <Th className="text-right">{t('support.col.action', 'Action')}</Th>
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
                          <p className="text-xs text-stone-400">{tItem.facility} · Unit {tItem.unit}</p>
                        </Td>
                        <Td><Badge variant="muted">{tItem.category}</Badge></Td>
                        <Td>{s(tItem.priority, { high: 'error', medium: 'warning', low: 'muted' })}</Td>
                        <Td className="text-xs text-stone-500">{tItem.created}</Td>
                        <Td>
                          {assignedStaffByTicket[tItem.id]
                            ? <div className="flex items-center gap-2"><Avatar name={assignedStaffByTicket[tItem.id]} size="sm" /><span className="text-xs font-medium text-stone-700">{assignedStaffByTicket[tItem.id]}</span></div>
                            : <span className="text-xs italic text-stone-400">{lang === 'vi' ? 'Chưa có Staff nhận' : 'Unassigned'}</span>}
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
        <div className="fixed bottom-6 right-6 z-50 bg-[#292a27] text-white px-5 py-3 rounded-lg shadow-2xl border border-amber-500/50 flex items-center gap-3 fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e9a12c] animate-ping" />
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}
      <Modal open={reservationModal} onClose={() => setReservationModal(false)} size="xl" title={lang === 'vi' ? 'Hồ Sơ Yêu Cầu Giữ Kho' : 'Storage Hold Request'}>
        {selectedReservation && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Khách hàng</p><b>{selectedReservation.customer}</b><p className="text-xs">{selectedReservation.phone}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Email</p><b>{selectedReservation.email}</b><p className="text-xs">{selectedReservation.emailVerified ? '✓ Đã xác nhận' : '⚠ Chưa xác nhận'}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Cơ sở / kho</p><b>{selectedReservation.facility} · {selectedReservation.unit}</b><p className="text-xs">{selectedReservation.facilityAddress}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">CCCD</p><b>{selectedReservation.identityId}</b><p className="text-xs">Đối chiếu bản gốc khi check-in</p></div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{lang === 'vi' ? 'Trạng thái chuẩn' : 'Canonical status'}:</b> {statusLabelMap[lang][selectedReservation.status]}</span><span><b>{lang === 'vi' ? 'Lịch Check-in' : 'Check-in'}:</b> {selectedReservation.appointmentDate} · {selectedReservation.appointmentTime}</span><span><b>{lang === 'vi' ? 'Hạn cuối' : 'Deadline'}:</b> {selectedReservation.checkInDeadline}</span></div><p className="mt-2 text-xs text-blue-800">{lang === 'vi' ? 'Staff không phê duyệt đơn hợp lệ. CREATED chỉ theo dõi thanh toán; DEPOSIT_PAID chờ Manager phân kho.' : 'Staff does not approve valid reservations. CREATED is monitored for payment; DEPOSIT_PAID awaits manager allocation.'}</p></div>
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

      <Modal open={inspectModal} onClose={() => setInspectModal(false)} size="xl" title={lang === 'vi' ? 'Nghiệm Thu Phòng Kho Trả' : 'Unit Inspection'}>
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
                <span className="text-slate-500">{t('return.col.deposit', 'Deposit')}</span>
                <span className="font-semibold">${selectedReturn.deposit}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
                <span><b>{lang === 'vi' ? 'Kỳ thuê' : 'Lease term'}:</b> {selectedReturn.contractStart} → {selectedReturn.contractEnd}</span>
                <span><b>{lang === 'vi' ? 'Ngày Customer yêu cầu trả' : 'Requested return'}:</b> {selectedReturn.returnDate}</span>
                <span className="sm:col-span-2"><b>{lang === 'vi' ? 'Lý do' : 'Reason'}:</b> {selectedReturn.requestReason}</span>
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
              <div><label className="text-sm font-medium">{lang === 'vi' ? 'Kết quả kiểm kê' : 'Inventory result'}</label><select value={returnInventory} onChange={event => setReturnInventory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="match">{lang === 'vi' ? 'Khớp khai báo' : 'Matches declaration'}</option><option value="missing">{lang === 'vi' ? 'Thiếu / đã lấy ra' : 'Missing / removed'}</option><option value="damaged">{lang === 'vi' ? 'Có hàng hư hỏng' : 'Damaged goods'}</option><option value="abandoned">{lang === 'vi' ? 'Có hàng bỏ lại' : 'Abandoned goods'}</option></select></div>
              <div><label className="text-sm font-medium">{lang === 'vi' ? 'Phân loại hiện trạng' : 'Condition classification'}</label><select value={returnClassification} onChange={event => setReturnClassification(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="no-damage">{lang === 'vi' ? 'Không hư hại' : 'No Damage'}</option><option value="minor-damage">{lang === 'vi' ? 'Hư hại nhẹ' : 'Minor Damage'}</option><option value="major-damage">{lang === 'vi' ? 'Hư hại nặng' : 'Major Damage'}</option><option value="requires-maintenance">{lang === 'vi' ? 'Cần bảo trì' : 'Requires Maintenance'}</option></select></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input label={lang === 'vi' ? 'Số kiện thực tế lúc trả' : 'Actual returned packages'} type="number" value={returnActualPackages} onChange={event => setReturnActualPackages(event.target.value)} /><Input label={lang === 'vi' ? 'PIN/thẻ/chìa khóa thu hồi' : 'Returned PIN/card/keys'} value={returnKeys} onChange={event => setReturnKeys(event.target.value)} /></div>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><b>{lang === 'vi' ? 'Bằng chứng bàn giao ban đầu (bất biến)' : 'Immutable initial handover evidence'}:</b> {selectedReturn.evidence.join(' · ')}</div>
            <Input label={lang === 'vi' ? 'Ảnh/bằng chứng trả kho mới (mã tệp hoặc đường dẫn)' : 'New return evidence (file reference or URL)'} value={returnEvidence} onChange={event => setReturnEvidence(event.target.value)} />
            <div className="rounded-lg border border-stone-200 p-3"><p className="mb-3 text-sm font-semibold">{lang === 'vi' ? 'Các khoản khấu trừ đề xuất' : 'Proposed deductions'}</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Input label={lang === 'vi' ? 'Hư hại' : 'Damage'} type="number" value={returnDamageFee} onChange={event => setReturnDamageFee(event.target.value)} /><Input label={lang === 'vi' ? 'Vệ sinh' : 'Cleaning'} type="number" value={returnCleaningFee} onChange={event => setReturnCleaningFee(event.target.value)} /><Input label={lang === 'vi' ? 'Thất lạc' : 'Lost items'} type="number" value={returnLostItemFee} onChange={event => setReturnLostItemFee(event.target.value)} /><Input label={lang === 'vi' ? 'Quá hạn' : 'Overdue'} type="number" value={returnOverdueFee} onChange={event => setReturnOverdueFee(event.target.value)} /><Input label={lang === 'vi' ? 'Công nợ khác' : 'Other debt'} type="number" value={returnOtherDebt} onChange={event => setReturnOtherDebt(event.target.value)} /></div><div className="mt-3 flex flex-wrap justify-between gap-2 rounded bg-slate-50 p-3 text-sm"><span>{lang === 'vi' ? 'Tổng khấu trừ' : 'Total deductions'}: <b>${returnTotalDeductions.toFixed(2)}</b></span><span>{lang === 'vi' ? 'Tiền cọc hoàn lại đề xuất' : 'Proposed refund'}: <b className="text-emerald-700">${returnRefund.toFixed(2)}</b></span></div></div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'vi' ? 'Biên Bản Ghi Chú Hiện Trường' : 'Inspection Notes'}
              </label>
              <textarea
                rows={3}
                value={returnNotes}
                onChange={event => setReturnNotes(event.target.value)}
                placeholder={lang === 'vi' ? 'Ghi rõ chi tiết hư hại, đồ còn sót lại hoặc vết bẩn...' : 'Document any damage or issues...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{lang === 'vi' ? 'Sau khi Staff gửi, hồ sơ chuyển sang “Chờ Customer xác nhận”. Staff không đóng hồ sơ hoặc hoàn cọc thay Customer.' : 'After submission, the record moves to “Waiting for Customer”. Staff cannot close the record or refund the deposit for the customer.'}</div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setInspectModal(false)}>{t('btn.cancel', 'Cancel')}</Button>
              <Button
                variant="primary"
                disabled={!returnEvidence.trim() || !returnNotes.trim() || !returnKeys.trim() || Number(returnActualPackages) < 0}
                onClick={() => {
                  setReturns(items => items.map(item => item.id === selectedReturn.id ? { ...item, status: 'waiting-customer', finalCondition: returnNotes.trim(), packageCount: Number(returnActualPackages), classification: returnClassification, evidence: [...item.evidence, returnEvidence.trim(), `EV-OUT-${Date.now()} · ${user.name} lập biên bản ${returnInventory}, ${returnClassification}; thu hồi ${returnKeys}; khấu trừ $${returnTotalDeductions}; hoàn đề xuất $${returnRefund}`] } : item))
                  setInspectModal(false)
                  showToast(lang === 'vi' ? 'Đã gửi biên bản; đang chờ Customer xác nhận trước khi hoàn cọc.' : 'Inspection submitted; waiting for customer confirmation before refund.')
                }}
              >
                {t('return.submit', 'Submit Inspection')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={checkinModal} onClose={() => setCheckinModal(false)} size="xl" title={lang === 'vi' ? 'Đối Chiếu & Xác Nhận Check-in Kho' : 'Verify Storage Check-in'}>
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
                <span><b>Email:</b> {selectedCheckin.email}</span><span><b>SĐT:</b> {selectedCheckin.phone}</span>
                <span><b>CCCD:</b> {selectedCheckin.identityId}</span><span><b>Cơ sở:</b> {selectedCheckin.facility}</span>
                <span><b>Hàng:</b> {selectedCheckin.goodsType}</span><span><b>Chất liệu:</b> {selectedCheckin.material}</span>
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
              ] as Array<[string, string]>).map(([key, label]) => <label key={key} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={Boolean(checkinChecks[key])} onChange={event => setCheckinChecks(previous => ({ ...previous, [key]: event.target.checked }))} className="w-4 h-4 accent-blue-600" /><span className="text-sm text-slate-700">{label}</span></label>)}
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs"><b>{lang === 'vi' ? 'Thông tin credential' : 'Credential record'}:</b> {`PIN-${selectedCheckin.id}`} · {selectedCheckin.unit} · {selectedCheckin.customer} · {user.name} · {lang === 'vi' ? 'kích hoạt khi hoàn tất check-in' : 'activates on check-in completion'}</div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{lang === 'vi' ? 'Staff hoàn tất Check-in để kích hoạt rental. Customer sẽ tự bấm “Tôi đã nhận kho”; trước thời điểm đó hồ sơ mang nhãn “Chờ khách xác nhận bàn giao”.' : 'Staff completes check-in to activate the rental. Customer confirms receipt separately; until then the record remains “Awaiting customer handover confirmation”.'}</div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">{lang === 'vi' ? 'Ghi chú bàn giao' : 'Handover notes'}</label><textarea rows={2} value={checkinNotes} onChange={event => setCheckinNotes(event.target.value)} placeholder={lang === 'vi' ? 'Ghi rõ chênh lệch hàng hóa hoặc lưu ý vận hành...' : 'Record goods variances or operational notes...'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCheckinModal(false)}>{t('btn.cancel', 'Cancel')}</Button>
              <Button
                variant="primary"
                disabled={!checkinCanComplete}
                onClick={() => {
                  setCheckins(items => items.map(item => item.id === selectedCheckin.id ? { ...item, status: 'completed', customerHandoverStatus: 'pending', dimensionsCm: actualDimensions.trim(), weightKg: Number(actualWeight), material: actualMaterial.trim(), initialCondition: actualCondition.trim(), evidence: [...item.evidence, checkinEvidence.trim(), contractFile.trim(), paymentEvidence.trim(), `RECEIPT-${Date.now()} · ${paymentReference.trim()} · ${user.name} thu phần còn lại`, `CHECKIN-${Date.now()} · ${user.name} xác nhận đối chiếu, cấp credential và bàn giao${scheduleOverrideReason.trim() ? ` · Override: ${scheduleOverrideReason.trim()}` : ''}${checkinNotes.trim() ? ` · ${checkinNotes.trim()}` : ''}`] } : item))
                  setCheckinModal(false)
                  showToast(lang === 'vi' ? 'Đã kích hoạt rental; đang chờ Customer tự xác nhận đã nhận kho.' : 'Rental activated; awaiting the customer’s own handover confirmation.')
                }}
              >
                {t('checkin.complete', 'Complete Check-in')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(noShowTarget)} onClose={() => setNoShowTarget(null)} title={lang === 'vi' ? 'Xác nhận Customer No-show' : 'Confirm Customer No-show'}>
        {noShowTarget && <div className="space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>{noShowTarget.customer}</b> · {noShowTarget.unit}<br />{lang === 'vi' ? 'Lịch Check-in' : 'Appointment'}: {noShowTarget.appointmentDate} · {noShowTarget.appointmentTime}<br />{lang === 'vi' ? 'Hạn cuối' : 'Deadline'}: {noShowTarget.checkInDeadline}</div><Input label={lang === 'vi' ? 'Lý do No-show (bắt buộc)' : 'No-show reason (required)'} value={noShowReason} onChange={event => setNoShowReason(event.target.value)} /><p className="text-xs text-stone-500">{lang === 'vi' ? 'Thao tác này hủy Check-in và ghi nhận yêu cầu giải phóng gian kho/thu hồi credential chờ kích hoạt.' : 'This cancels check-in and records the unit release and pending credential revocation.'}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNoShowTarget(null)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button><Button variant="danger" disabled={!noShowReason.trim()} onClick={() => { setCheckins(items => items.map(item => item.id === noShowTarget.id ? { ...item, status: 'no-show', evidence: [...item.evidence, `NO-SHOW-${Date.now()} · ${user.name}: ${noShowReason.trim()} · hủy Check-in, giải phóng kho, thu hồi credential`] } : item)); setNoShowTarget(null); showToast(lang === 'vi' ? 'Đã ghi nhận No-show và yêu cầu giải phóng gian kho.' : 'No-show recorded and unit release requested.') }}>{lang === 'vi' ? 'Xác nhận No-show' : 'Confirm No-show'}</Button></div></div>}
      </Modal>

      {/* Staff Ticket Resolution Modal */}
      <Modal open={respondModal} onClose={() => setRespondModal(false)} title={t('support.modal.title', 'Staff Ticket Response & Resolution')}>
        {activeStaffTicket && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#292a27] p-4 text-white">
              <div className="flex justify-between items-center text-xs font-mono text-[#e9a12c]">
                <span>{activeStaffTicket.id}</span>
                <span>{activeStaffTicket.facility}</span>
              </div>
              <h3 className="font-bold text-base mt-1 text-stone-100">{activeStaffTicket.subject}</h3>
              <p className="text-xs text-stone-300 mt-1">
                {lang === 'vi' ? 'Khách thuê: ' : 'Tenant: '}{activeStaffTicket.customer} ({activeStaffTicket.email}) · Unit {activeStaffTicket.unit}
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
                          <span>{msg.role === 'staff' ? (lang === 'vi' ? 'Staff hỗ trợ' : 'Support Staff') : msg.role === 'customer' ? (lang === 'vi' ? 'Khách hàng' : 'Customer') : (lang === 'vi' ? 'Hệ thống' : 'System')}</span>
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
                  {lang === 'vi' ? 'Cập Nhật Trạng Thái' : 'Update Ticket Status'}
                </label>
                <select
                  value={ticketNewStatus}
                  onChange={e => setTicketNewStatus(e.target.value as TicketStatus)}
                  className="w-full border border-stone-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="open">{lang === 'vi' ? 'Mở Mới / Chờ xử lý' : 'Open / Awaiting Action'}</option>
                  <option value="in-progress">{lang === 'vi' ? 'Đang Khắc Phục' : 'In Progress / Investigating'}</option>
                  <option value="waiting-customer">{lang === 'vi' ? 'Chờ Customer Phản Hồi' : 'Waiting for Customer'}</option>
                  <option value="resolved">{lang === 'vi' ? 'Đã Giải Quyết Xong' : 'Resolved / Case Closed'}</option>
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
                    value={assignedStaffByTicket[activeStaffTicket.id] || (lang === 'vi' ? 'Chưa có Staff nhận xử lý' : 'No staff assigned')}
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
                    time: lang === 'vi' ? 'Vừa xong' : 'Just now',
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
