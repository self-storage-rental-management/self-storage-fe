import { useState, useEffect, useRef } from 'react'
import Layout, { getInitialPage, Icon, type LayoutNotification } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Input, Select, Tabs, Avatar, ProgressBar } from '../../components/ui'
import { formatVnd, useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import type { Facility, StorageUnit, StorageHold, UnitType } from '../../types/storageHub'
import { useStorageHub } from '../../store/StorageHubContext'
import ProfileView from '../ProfileView'
import type { TicketItem } from '../../data/demoDatabase'

const statusLabelMap: Record<string, Record<string, string>> = {
  vi: {
    active: 'Đang hoạt động',
    available: 'Còn trống',
    held: 'Đang giữ kho',
    assigned: 'Đã phân kho',
    occupied: 'Đã thuê',
    inspection: 'Đang kiểm tra',
    maintenance: 'Bảo trì',
    paid: 'Đã thanh toán',
    resolved: 'Đã xử lý thành công',
    pending: 'Chờ xử lý',
    awaiting_email: 'Chờ xác nhận email',
    awaiting_review: 'Chờ nhân viên duyệt',
    awaiting_payment: 'Chờ thanh toán cọc',
    approved: 'Đã duyệt',
    payment_processing: 'Đang xác minh thanh toán',
    payment_failed: 'Thanh toán thất bại',
    payment_expired: 'Hết hạn thanh toán',
    confirmed: 'Đã xác nhận',
    deposit_paid: 'Đã cọc giữ chỗ',
    contract_signed: 'Đã ký hợp đồng',
    fully_paid: 'Đã thanh toán đủ',
    unit_assigned: 'Đã phân kho',
    scheduled: 'Đã lên lịch check-in',
    checked_in: 'Đã bàn giao kho',
    rejected: 'Đã từ chối',
    cancelled: 'Đã hủy',
    expired: 'Đã hết hạn',
    return_requested: 'Chờ trả kho',
    refund_pending: 'Chờ chuyển hoàn cọc',
    payment_due: 'Chờ đóng phần thiếu',
    awaiting_customer_confirmation: 'Chờ xác nhận quyết toán',
    completed: 'Đã hoàn tất',
    medium: 'Trung bình',
    overdue: 'Quá hạn',
    high: 'Khẩn cấp',
    open: 'Chờ Staff tiếp nhận',
    'in-progress': 'Đang được xử lý',
    ended: 'Đã kết thúc',
    closed: 'Đã đóng',
    low: 'Tiêu chuẩn',
    CREATED: 'Chờ xác nhận',
    DEPOSIT_PAID: 'Đã thanh toán cọc',
    UNIT_RESERVED: 'Đã phân kho vật lý',
    READY_FOR_CHECKIN: 'Sẵn sàng Check-in',
    COMPLETED: 'Đã hoàn tất Check-in',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Đã hết hạn',
  },
  en: {
    active: 'Active',
    available: 'Available',
    held: 'Held',
    assigned: 'Assigned',
    occupied: 'Occupied',
    inspection: 'Inspection',
    maintenance: 'Maintenance',
    paid: 'Paid',
    resolved: 'Resolved',
    pending: 'Pending',
    awaiting_email: 'Awaiting Email',
    awaiting_review: 'Awaiting Review',
    awaiting_payment: 'Awaiting Payment',
    approved: 'Approved',
    payment_processing: 'Payment verification',
    payment_failed: 'Payment failed',
    payment_expired: 'Payment deadline expired',
    confirmed: 'Confirmed',
    deposit_paid: 'Deposit Paid',
    contract_signed: 'Contract Signed',
    fully_paid: 'Fully Paid',
    unit_assigned: 'Unit Assigned',
    scheduled: 'Scheduled Check-in',
    checked_in: 'Checked In',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    expired: 'Expired',
    return_requested: 'Return Requested',
    refund_pending: 'Refund pending',
    payment_due: 'Additional payment due',
    awaiting_customer_confirmation: 'Awaiting settlement confirmation',
    completed: 'Completed',
    medium: 'Medium',
    overdue: 'Overdue',
    high: 'High',
    open: 'Open',
    'in-progress': 'In Progress',
    ended: 'Ended',
    closed: 'Closed',
    low: 'Low',
    CREATED: 'Awaiting confirmation',
    DEPOSIT_PAID: 'Deposit paid',
    UNIT_RESERVED: 'Physical unit assigned',
    READY_FOR_CHECKIN: 'Ready for check-in',
    COMPLETED: 'Check-in completed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  }
}

interface SizeCategoryCardProps {
  facility: Facility
  unitType: UnitType
  availableCount: number
  lang: 'vi' | 'en'
  onReserve: (facility: Facility, unitType: UnitType) => void
  onViewSpecs: (facility: Facility, unitType: UnitType, availableCount: number) => void
}

function SizeCategoryCard({ facility, unitType, availableCount, lang, onReserve, onViewSpecs }: SizeCategoryCardProps) {
  const isAvailable = availableCount > 0
  const usableCapacity = Math.round(unitType.volumeM3 * 0.75 * 10) / 10

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-lg">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-stone-500">{lang === 'vi' ? 'Cỡ kho' : 'Storage size'}</p>
            <h3 className="mt-1 text-xl font-bold leading-tight text-black">{unitType.name}</h3>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${isAvailable ? 'border-stone-300 bg-white text-black' : 'border-red-700 bg-red-700 text-white'}`}>
            {isAvailable ? `${availableCount} ${lang === 'vi' ? 'kho trống' : 'available'}` : (lang === 'vi' ? 'Hết kho' : 'Sold out')}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-stone-200 py-4 text-sm">
          <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Diện tích' : 'Area'}</p><p className="mt-0.5 font-bold text-black">{unitType.areaM2} m²</p></div>
          <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Kích thước' : 'Dimensions'}</p><p className="mt-0.5 font-bold text-black">{unitType.lengthM} × {unitType.widthM} × {unitType.heightM} m</p></div>
          <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Sức chứa tham khảo' : 'Usable capacity'}</p><p className="mt-0.5 font-bold text-black">~{usableCapacity} m³</p></div>
          <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Tải trọng tối đa' : 'Maximum load'}</p><p className="mt-0.5 font-bold text-black">{unitType.maxLoadKg} kg</p></div>
        </div>
        <p className="mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-stone-600">{lang === 'vi' ? unitType.descriptionVi : unitType.descriptionEn}</p>
        <div className="mt-auto pt-5">
          <p className="text-xs text-stone-500">{lang === 'vi' ? 'Giá thuê từ' : 'Monthly rate'}</p>
          <p className="text-2xl font-bold tracking-tight text-black">{formatVnd(unitType.monthlyPrice)}<span className="text-sm font-normal text-stone-500">/{lang === 'vi' ? 'tháng' : 'mo'}</span></p>
          <p className="mt-1 text-xs text-stone-600">{lang === 'vi' ? 'Cọc 20% tổng giá trị kỳ thuê' : '20% of the full rental term'}</p>
          <p className="mt-1 text-xs text-stone-600">{lang === 'vi' ? `Tiền đảm bảo kho: ${formatVnd(unitType.monthlyPrice)} (hoàn sau nghiệm thu nếu không phát sinh khấu trừ)` : `Storage security deposit: ${formatVnd(unitType.monthlyPrice)} (refunded after inspection if no deductions apply)`}</p>
          {!isAvailable && <p className="mt-2 text-xs font-bold text-red-700">{lang === 'vi' ? 'Cỡ kho này hiện chưa thể đặt.' : 'This size is currently unavailable.'}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => onViewSpecs(facility, unitType, availableCount)}>{lang === 'vi' ? 'Xem chi tiết' : 'Details'}</Button>
            <Button size="sm" disabled={!isAvailable} onClick={() => onReserve(facility, unitType)}>{isAvailable ? (lang === 'vi' ? 'Bắt đầu đặt' : 'Start booking') : (lang === 'vi' ? 'Hết kho' : 'Sold out')}</Button>
          </div>
        </div>
      </div>
    </article>
  )
}

interface CustomerAppProps { user: User; onLogout: () => void }

function parseCustomerDate(value?: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function dateInputValue(value: Date): string {
  return value.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function notificationTimestamp(value?: string): number {
  if (!value) return 0
  const nativeTime = new Date(value).getTime()
  if (!Number.isNaN(nativeTime)) return nativeTime
  const viMatch = value.match(/(?:(\d{1,2}):(?:(\d{1,2}):)?(\d{1,2})\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!viMatch) return 0
  const [, hour = '0', minute = '0', second = '0', day, month, year] = viMatch
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime()
}

function addMonthsForPreview(value: string, months: number): string {
  const date = parseCustomerDate(value)
  if (!date) return '—'
  date.setMonth(date.getMonth() + months)
  return dateInputValue(date)
}

export default function CustomerApp({ user, onLogout }: CustomerAppProps) {
  const { lang, t } = useLanguage()
  const {
    facilities,
    units,
    holds,
    checkins,
    rentals,
    returns,
    activities,
    tickets,
    config,
    unitTypes,
    validateAndCreateReservation,
    calculateDIMAndQuote,
    verifyHoldEmail,
    resendHoldEmail,
    payStorageHold,
    contracts,
    payments,
    scheduleCheckIn,
    requestReturn,
    requestRenewal,
    updateRenewalRequest,
    cancelRenewalRequest,
    payRenewal,
    expireRenewalPayment,
    confirmUnitReceipt,
    confirmReturnSettlement,
    payReturnBalance,
    cancelReservation,
    archiveReservationHistory,
    archiveRentalHistory,
    archiveContractHistory,
    expireReservation,
    renewals,
    createSupportTicket,
    replySupportTicket
  } = useStorageHub()

  const NAV = [
    { id: 'overview', label: lang === 'vi' ? 'Tổng quan' : 'Overview', icon: Icon.home, group: lang === 'vi' ? 'Kho của tôi' : 'My Storage' },
    { id: 'browse-facilities', label: lang === 'vi' ? 'Tìm cơ sở kho' : 'Find a Facility', icon: Icon.building, group: lang === 'vi' ? 'Tìm gian kho' : 'Find Storage' },
    { id: 'browse-units', label: lang === 'vi' ? 'Cỡ kho khả dụng' : 'Available Sizes', icon: Icon.box, group: lang === 'vi' ? 'Tìm gian kho' : 'Find Storage' },
    { id: 'reservations', label: lang === 'vi' ? 'Đơn đặt giữ kho' : 'Storage Reservations', icon: Icon.calendar, group: lang === 'vi' ? 'Đặt giữ kho' : 'Bookings' },
    { id: 'rental-records', label: lang === 'vi' ? 'Hồ sơ thuê của tôi' : 'My Rentals', icon: Icon.key, group: lang === 'vi' ? 'Đặt giữ kho' : 'Bookings' },
    { id: 'contracts', label: lang === 'vi' ? 'Hợp đồng của tôi' : 'My Contracts', icon: Icon.policy, group: lang === 'vi' ? 'Đặt giữ kho' : 'Bookings' },
    { id: 'payments', label: lang === 'vi' ? 'Lịch sử thanh toán' : 'Payments', icon: Icon.credit, group: lang === 'vi' ? 'Tài khoản' : 'Account' },
    { id: 'policies', label: lang === 'vi' ? 'Quy định & Chính sách' : 'Rental Policies', icon: Icon.policy, group: lang === 'vi' ? 'Tài khoản' : 'Account' },
    { id: 'support', label: lang === 'vi' ? 'Hỗ trợ khách hàng' : 'Support', icon: Icon.support, group: lang === 'vi' ? 'Hỗ trợ' : 'Support' }
  ]

  const [page, setPage] = useState(() => getInitialPage(NAV, 'overview'))
  const [previousPage, setPreviousPage] = useState('overview')
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('facilityId') || new URLSearchParams(window.location.search).get('facility')
  })
  const [selectedTarget, setSelectedTarget] = useState<{ facility: Facility; unitType: UnitType } | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<StorageUnit | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [bookingReview, setBookingReview] = useState(false)
  const [temporaryHoldExpiresAt, setTemporaryHoldExpiresAt] = useState<string | null>(() => localStorage.getItem('customerTemporaryHoldExpiresAt'))
  const [temporaryHoldTarget, setTemporaryHoldTarget] = useState<{ facilityId: string; unitTypeId: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem('customerTemporaryHoldTarget') || 'null') } catch { return null }
  })
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [activeHoldForEmail, setActiveHoldForEmail] = useState<StorageHold | null>(null)
  const [inputToken, setInputToken] = useState('')

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [activeHoldForPayment, setActiveHoldForPayment] = useState<StorageHold | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản VietQR')

  // Post-payment Digital Contract & Receipt Email Modal
  const [contractEmailModalOpen, setContractEmailModalOpen] = useState(false)
  const [activeHoldForContract, setActiveHoldForContract] = useState<StorageHold | null>(null)
  const [contractTab, setContractTab] = useState<'contract' | 'receipt'>('contract')

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [activeHoldForSchedule, setActiveHoldForSchedule] = useState<StorageHold | null>(null)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')

  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [activeRentalForReturn, setActiveRentalForReturn] = useState<typeof rentals[0] | null>(null)
  const [returnTargetDate, setReturnTargetDate] = useState('2026-09-30')
  const [returnReason, setReturnReason] = useState('Hết nhu cầu lưu trữ')

  const [renewalModalOpen, setRenewalModalOpen] = useState(false)
  const [activeRentalForRenewal, setActiveRentalForRenewal] = useState<typeof rentals[0] | null>(null)
  const [renewalMonths, setRenewalMonths] = useState(1)
  const [editingRenewalId, setEditingRenewalId] = useState<string | null>(null)
  const [renewalPaymentOpen, setRenewalPaymentOpen] = useState(false)
  const [activeRenewalForPayment, setActiveRenewalForPayment] = useState<typeof renewals[0] | null>(null)
  const [renewalPaymentMethod, setRenewalPaymentMethod] = useState<'BANK_TRANSFER' | 'ONLINE_GATEWAY'>('BANK_TRANSFER')
  const [renewalTermsAccepted, setRenewalTermsAccepted] = useState(false)
  const [renewalAppointmentDate, setRenewalAppointmentDate] = useState('')
  const [renewalAppointmentTime, setRenewalAppointmentTime] = useState('09:00')

  // Search & Filter state
  const [sizeFilter, setSizeFilter] = useState('All')
  const [searchFacility, setSearchFacility] = useState('')

  // Validation violation state in booking modal
  const [validationViolation, setValidationViolation] = useState<{
    reason: string
    suggestedUnitTypeId?: string
    suggestedUnitTypeName?: string
    suggestedVolumeM3?: number
  } | null>(null)

  // Live timer tick
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    renewals
      .filter(renewal => renewal.customerId === user.id && renewal.status === 'approved' && renewal.paymentDueAt && new Date(renewal.paymentDueAt).getTime() <= now)
      .forEach(renewal => expireRenewalPayment(renewal.id))
  }, [expireRenewalPayment, now, renewals, user.id])

  useEffect(() => {
    if (bookOpen && temporaryHoldExpiresAt && now >= new Date(temporaryHoldExpiresAt).getTime()) {
      localStorage.removeItem('customerTemporaryHoldExpiresAt')
      localStorage.removeItem('customerTemporaryHoldTarget')
      setTemporaryHoldExpiresAt(null)
      setTemporaryHoldTarget(null)
      setBookingReview(false)
      setBookOpen(false)
      showToast(lang === 'vi' ? 'Thời gian tạm giữ 30 phút đã hết. Suất kho đã được mở lại.' : 'The 30-minute hold expired and the slot was released.')
    }
  }, [bookOpen, temporaryHoldExpiresAt, now, lang])

  useEffect(() => {
    if (!bookOpen) return
    const releaseOnPageExit = () => {
      localStorage.removeItem('customerTemporaryHoldExpiresAt')
      localStorage.removeItem('customerTemporaryHoldTarget')
    }
    window.addEventListener('pagehide', releaseOnPageExit)
    return () => window.removeEventListener('pagehide', releaseOnPageExit)
  }, [bookOpen])

  const formatCountdown = (expiresAt?: string) => {
    if (!expiresAt) return { text: '--:--', isUrgent: false, isExpired: false }
    const diff = Math.floor((new Date(expiresAt).getTime() - now) / 1000)
    if (diff <= 0) return { text: '00:00 (Hết hạn)', isUrgent: true, isExpired: true }
    const hours = Math.floor(diff / 3600)
    const mins = Math.floor((diff % 3600) / 60)
    const secs = diff % 60
    const text = hours > 0
      ? `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    return { text, isUrgent: diff <= 300, isExpired: false }
  }

  // Goods declaration form in Booking Modal
  const [goodsType, setGoodsType] = useState('Đồ gia dụng & nội thất')
  const [goodsMaterial, setGoodsMaterial] = useState('Gỗ, nhựa, vải')
  const [packageCount, setPackageCount] = useState('6')
  const [goodsWeight, setGoodsWeight] = useState('80')
  const [cargoLength, setCargoLength] = useState('80')
  const [cargoWidth, setCargoWidth] = useState('60')
  const [cargoHeight, setCargoHeight] = useState('70')
  const [goodsCondition, setGoodsCondition] = useState('6 kiện nguyên vẹn, bao gói cẩn thận')
  const [moveInDate, setMoveInDate] = useState('2026-09-22')
  const [bookingAppointmentTime, setBookingAppointmentTime] = useState('09:00')
  const [rentalMonths, setRentalMonths] = useState(3)
  const [customerIdCard, setCustomerIdCard] = useState('079203009988')
  const [customerPhone, setCustomerPhone] = useState('+84 908 123 456')
  const [customerEmail] = useState(user.email)
  const [customerAddress, setCustomerAddress] = useState('Quận 1, TP. Hồ Chí Minh')
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({})
  const bookingErrorRef = useRef<HTMLDivElement | null>(null)
  const packageCountNumber = Number(packageCount)
  const goodsWeightNumber = Number(goodsWeight)
  const cargoLengthNumber = Number(cargoLength)
  const cargoWidthNumber = Number(cargoWidth)
  const cargoHeightNumber = Number(cargoHeight)

  // Support
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketCategory, setTicketCategory] = useState('Access & Entry')
  const [ticketPriority, setTicketPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketRelatedRecord, setTicketRelatedRecord] = useState('general')
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [conversationOpen, setConversationOpen] = useState(false)
  const [focusedNotificationTarget, setFocusedNotificationTarget] = useState<string | null>(null)
  const notificationRevealTimers = useRef<number[]>([])
  const [replyText, setReplyText] = useState('')
  const [supportTab, setSupportTab] = useState('All')
  const [supportSearch, setSupportSearch] = useState('')

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const badgeFor = (status: string) => {
    const statusClass: Record<string, string> = {
      active: 'bg-emerald-700 text-white', available: 'bg-emerald-700 text-white', paid: 'bg-emerald-700 text-white', resolved: 'bg-emerald-700 text-white',
      confirmed: 'bg-emerald-700 text-white', checked_in: 'bg-emerald-700 text-white', approved: 'bg-emerald-700 text-white', completed: 'bg-emerald-700 text-white', COMPLETED: 'bg-emerald-700 text-white',
      CREATED: 'bg-amber-600 text-white', pending: 'bg-amber-600 text-white', awaiting_email: 'bg-amber-600 text-white', awaiting_review: 'bg-amber-600 text-white', awaiting_payment: 'bg-amber-600 text-white', scheduled: 'bg-amber-600 text-white', held: 'bg-amber-600 text-white', return_requested: 'bg-amber-600 text-white', refund_pending: 'bg-amber-600 text-white', payment_due: 'bg-red-700 text-white', awaiting_customer_confirmation: 'bg-amber-600 text-white', 'in-progress': 'bg-amber-600 text-white', medium: 'bg-amber-600 text-white',
      DEPOSIT_PAID: 'bg-blue-700 text-white', UNIT_RESERVED: 'bg-blue-700 text-white', READY_FOR_CHECKIN: 'bg-blue-700 text-white',
      overdue: 'bg-red-700 text-white', rejected: 'bg-red-700 text-white', cancelled: 'bg-stone-200 text-stone-700', expired: 'bg-red-700 text-white', CANCELLED: 'bg-red-700 text-white', EXPIRED: 'bg-red-700 text-white', high: 'bg-red-700 text-white'
    }
    const label = statusLabelMap[lang]?.[status] || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '))
    return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${statusClass[status] ?? 'bg-stone-700 text-white'}`}>{label}</span>
  }

  const featureLabel = (unit: StorageUnit) => {
    if (lang === 'vi') return unit.climate ? 'Có điều hòa & kiểm soát độ ẩm' : 'Thông gió tự nhiên'
    return unit.climate ? 'Climate controlled' : 'Standard ventilation'
  }

  // Data scoping for Customer (P1.4)
  const myHolds = holds.filter(h => h.customerId === user.id || h.customerName === user.name || h.customerEmail === user.email)
  const visibleMyHolds = myHolds.filter(hold => !hold.customerArchivedAt)
  const myRentals = rentals.filter(r => r.customerId === user.id || r.customerName === user.name || r.customerEmail === user.email)
  const visibleMyRentals = myRentals.filter(rental => !rental.customerArchivedAt)
  const visibleMyContracts = contracts.filter(contract => !contract.customerArchivedAt && (
    contract.customerId === user.id ||
    myHolds.some(hold => hold.id === contract.reservationId) ||
    myRentals.some(rental => rental.holdId === contract.reservationId || rental.contractId === contract.id)
  ))
  const myReturns = returns.filter(r => r.customerId === user.id || r.customerEmail === user.email)
  const myTickets = tickets.filter(t => t.email === user.email || t.customer === user.name)
  const myRentalIds = new Set(myRentals.map(r => r.id))
  const visibleMyRentalIds = new Set(visibleMyRentals.map(r => r.id))
  const myHoldIds = new Set(myHolds.map(h => h.id))
  const myPayments = payments.filter(p => myHoldIds.has(p.reservationId) || Boolean(p.rentalId && myRentalIds.has(p.rentalId)))
  const activeRentals = visibleMyRentals.filter(r => r.status === 'active' || r.status === 'return_requested')
  const hasActiveTemporarySlot = Boolean(temporaryHoldExpiresAt && new Date(temporaryHoldExpiresAt).getTime() > now && temporaryHoldTarget)
  const unitTypeMatches = (unitTypeName: string, requestedTypeName: string) => unitTypeName.toLowerCase().startsWith(requestedTypeName.split(' ')[0].toLowerCase())
  const activeUnassignedCapacityHolds = holds.filter(hold => {
    if (hold.assignedUnitId || ['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status)) return false
    if (['awaiting_email', 'awaiting_review', 'awaiting_payment'].includes(hold.status)) return Boolean(hold.paymentExpiresAt && new Date(hold.paymentExpiresAt).getTime() > now)
    return hold.status === 'DEPOSIT_PAID'
  })
  const effectiveAvailableCount = (facilityId: string, unitTypeName?: string) => {
    const physical = units.filter(unit => unit.facilityId === facilityId && unit.status === 'available' && !rentals.some(rental => rental.unitId === unit.id && ['active', 'return_requested', 'return_inspection', 'closing'].includes(rental.status)) && (!unitTypeName || unitTypeMatches(unit.type, unitTypeName))).length
    const capacityHeld = activeUnassignedCapacityHolds.filter(hold => hold.facilityId === facilityId && (!unitTypeName || unitTypeMatches(hold.unitTypeName, unitTypeName))).length
    const heldType = temporaryHoldTarget ? unitTypes.find(type => type.id === temporaryHoldTarget.unitTypeId) : undefined
    const temporaryHeld = hasActiveTemporarySlot && temporaryHoldTarget?.facilityId === facilityId && (!unitTypeName || Boolean(heldType && unitTypeMatches(heldType.name, unitTypeName))) ? 1 : 0
    return Math.max(0, physical - capacityHeld - temporaryHeld)
  }
  const contractExpiryNotifications = myRentals.flatMap(rental => {
    if (rental.status !== 'active') return []
    const start = parseCustomerDate(rental.startDate)
    const end = parseCustomerDate(rental.endDate)
    if (!start || !end) return []
    const remainingDays = Math.ceil((end.getTime() - now) / 86_400_000)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000)
    const reminderWindow = totalDays > 31 ? 30 : 7
    if (remainingDays < 0 || remainingDays > reminderWindow) return []
    const reminderDate = new Date(end)
    reminderDate.setDate(reminderDate.getDate() - reminderWindow)
    return [{ id: `expiry-${rental.id}`, date: reminderDate.toISOString(), title: lang === 'vi' ? 'Hợp đồng sắp hết hạn' : 'Contract expiring soon', message: `${rental.unitId} · ${remainingDays} ${lang === 'vi' ? 'ngày còn lại' : 'days remaining'} · ${lang === 'vi' ? 'Hết hạn' : 'Ends'} ${rental.endDate}`, page: 'rental-records', targetId: rental.id }]
  })
  const customerNotifications: LayoutNotification[] = [
    ...contractExpiryNotifications,
    ...visibleMyHolds.filter(h => h.assignedUnitId).map(h => {
      const assignmentActivity = activities.find(activity => activity.action === 'UNIT_ASSIGNED' && activity.entityId === h.id)
      return { id: `unit-${h.id}-${h.assignedUnitId}`, date: h.unitAssignedAt || assignmentActivity?.timestamp || h.reviewedAt || h.createdAt, title: lang === 'vi' ? 'Đã phân gian kho' : 'Unit assigned', message: `${h.assignedUnitId} · ${h.facilityName}`, page: 'reservations', targetId: h.id }
    }),
    ...visibleMyRentals.filter(rental => rental.status !== 'completed').map(rental => {
      const hold = myHolds.find(item => item.id === rental.holdId)
      const checkin = checkins.find(item => item.holdId === rental.holdId)
      const confirmed = Boolean(rental.receiptConfirmedAt)
      return { id: `receipt-${rental.id}-${confirmed ? rental.receiptConfirmedAt : 'pending'}`, date: rental.receiptConfirmedAt || hold?.checkedInAt || checkin?.completedAt || rental.startDate, title: confirmed ? (lang === 'vi' ? 'Đã xác nhận nhận kho' : 'Unit receipt confirmed') : (lang === 'vi' ? 'Vui lòng xác nhận đã nhận kho' : 'Please confirm unit receipt'), message: `${rental.unitId} · ${rental.facilityName}`, page: 'rental-records', targetId: rental.id }
    }),
    ...renewals.filter(r => r.customerId === user.id && r.status !== 'pending').map(r => {
      const title = r.status === 'rejected'
        ? (lang === 'vi' ? 'Gia hạn bị từ chối' : 'Renewal rejected')
        : r.status === 'approved'
          ? (lang === 'vi' ? 'Gia hạn đã duyệt · Chờ thanh toán' : 'Renewal approved · Payment required')
          : r.status === 'payment_expired'
            ? (lang === 'vi' ? 'Yêu cầu gia hạn đã hết hạn thanh toán' : 'Renewal payment deadline expired')
            : r.status === 'completed'
              ? (lang === 'vi' ? 'Gia hạn đã có hiệu lực' : 'Renewal is now effective')
              : (lang === 'vi' ? 'Cập nhật yêu cầu gia hạn' : 'Renewal updated')
      return { id: `renewal-${r.id}-${r.status}-${r.paidAt || r.approvedAt || r.requestedAt}`, date: r.paidAt || r.approvedAt || r.requestedAt, title, message: r.status === 'rejected' && r.notes ? `${r.unitId} · ${lang === 'vi' ? 'Lý do' : 'Reason'}: ${r.notes}` : `${r.unitId} · ${r.newEndDate}`, page: 'rental-records', targetId: r.rentalId }
    }),
    ...myReturns.filter(r => visibleMyRentalIds.has(r.rentalId) && ['awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'].includes(r.status)).map(r => ({ id: `return-${r.id}-${r.status}-${r.completedAt || r.customerConfirmedAt || r.inspectedAt || r.requestedAt}`, date: r.completedAt || r.customerConfirmedAt || r.inspectedAt || r.requestedAt, title: r.status === 'awaiting_customer_confirmation' ? (lang === 'vi' ? 'Cần xác nhận quyết toán' : 'Settlement confirmation required') : r.status === 'payment_due' ? (lang === 'vi' ? 'Cần thanh toán phần quyết toán còn thiếu' : 'Additional settlement payment required') : r.status === 'refund_pending' ? (lang === 'vi' ? 'Hồ sơ thuê hết hiệu lực · Chờ hoàn cọc' : 'Rental inactive · Refund pending') : r.status === 'completed' ? (lang === 'vi' ? 'Hồ sơ thuê đã hết hiệu lực' : 'Rental record is inactive') : (lang === 'vi' ? 'Đang xem xét khiếu nại' : 'Dispute under review'), message: `${r.unitId} · ${r.status === 'payment_due' ? (lang === 'vi' ? 'Cần đóng thêm' : 'Additional payment') : (lang === 'vi' ? 'Hoàn cọc dự kiến' : 'Expected refund')} ${formatVnd(r.status === 'payment_due' ? (r.amountDueFromCustomer ?? 0) : r.netRefundAmount)}`, page: 'rental-records', targetId: r.rentalId })),
    ...myTickets.flatMap(ticket => {
      const latestStaffMessage = [...ticket.messages].reverse().find(message => message.role === 'staff')
      const notificationTitle = ticket.status === 'resolved'
        ? (lang === 'vi' ? 'Yêu cầu đã được xử lý thành công' : 'Support request resolved')
        : (lang === 'vi' ? 'Yêu cầu đang được Staff xử lý' : 'Support request in progress')
      return latestStaffMessage ? [{ id: `ticket-${ticket.id}-${latestStaffMessage.id}-${ticket.status}`, date: latestStaffMessage.time || ticket.created, title: notificationTitle, message: `${ticket.id} · ${ticket.subject}`, page: 'support', targetId: ticket.id }] : []
    })
  ].sort((a, b) => notificationTimestamp(b.date) - notificationTimestamp(a.date))

  useEffect(() => {
    myHolds.forEach(hold => {
      if (['awaiting_email', 'awaiting_review', 'awaiting_payment'].includes(hold.status) && hold.paymentExpiresAt && new Date(hold.paymentExpiresAt).getTime() <= now) {
        expireReservation(hold.id, 'PAYMENT_EXPIRED')
      }
    })
  }, [now, myHolds, expireReservation])

  const selectedFacility = facilities.find(facility => facility.id === selectedFacilityId) ?? null
  const availableUnits = units.filter(unit =>
    (!selectedFacility || unit.facilityName === selectedFacility.name || unit.facilityId === selectedFacility.id) &&
    (sizeFilter === 'All' || unit.type === sizeFilter)
  )
  const matchingFacilities = facilities.filter(facility =>
    `${facility.name} ${facility.address} ${facility.city}`.toLowerCase().includes(searchFacility.toLowerCase())
  )

  const releaseTemporaryReservationSlot = () => {
    localStorage.removeItem('customerTemporaryHoldExpiresAt')
    localStorage.removeItem('customerTemporaryHoldTarget')
    setTemporaryHoldExpiresAt(null)
    setTemporaryHoldTarget(null)
    setBookingReview(false)
    setValidationViolation(null)
    setBookingErrors({})
  }

  const navigateTo = (nextPage: string, options?: { facilityId?: string | null }) => {
    setPreviousPage(page)
    if (nextPage === 'browse-units') {
      setSelectedFacilityId(options?.facilityId ?? null)
    }
    setPage(nextPage)
  }

  const handleLayoutNavigate = (nextPage: string) => {
    if (nextPage === page) return
    if (bookOpen) {
      releaseTemporaryReservationSlot()
      setBookOpen(false)
    }
    setPreviousPage(page)
    if (nextPage === 'browse-units') setSelectedFacilityId(null)
    setPage(nextPage)
  }

  const handleStartReservation = (facility: Facility, unitType: UnitType) => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const suggestedCheckIn = new Date()
    suggestedCheckIn.setDate(suggestedCheckIn.getDate() + 2)
    localStorage.setItem('customerTemporaryHoldExpiresAt', expiresAt)
    localStorage.setItem('customerTemporaryHoldTarget', JSON.stringify({ facilityId: facility.id, unitTypeId: unitType.id }))
    setTemporaryHoldExpiresAt(expiresAt)
    setTemporaryHoldTarget({ facilityId: facility.id, unitTypeId: unitType.id })
    setMoveInDate(dateInputValue(suggestedCheckIn))
    setBookingAppointmentTime('09:00')
    setBookingReview(false)
    setBookingErrors({})
    setSelectedTarget({ facility, unitType })
    const repUnit: StorageUnit = {
      id: '',
      code: unitType.name,
      facilityId: facility.id,
      facilityName: facility.name,
      floor: 1,
      zone: 'Tiêu chuẩn',
      type: unitType.name.split(' ')[0] as any,
      areaM2: unitType.areaM2,
      dimensions: { lengthM: unitType.lengthM, widthM: unitType.widthM, heightM: unitType.heightM },
      doorDimensions: { widthM: 1.1, heightM: 2.2 },
      volumeM3: unitType.volumeM3,
      maxLoadKg: unitType.maxLoadKg,
      allowedGoods: ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
      prohibitedGoods: ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
      price: unitType.monthlyPrice,
      deposit: unitType.monthlyPrice,
      climate: true,
      status: 'available',
      reservedPeriods: [],
      version: 1
    }
    setSelectedUnit(repUnit)
    setDetailOpen(false)
    setBookOpen(true)
  }

  const handleOpenSpecs = (facility: Facility, unitType: UnitType, availableCount: number) => {
    setSelectedTarget({ facility, unitType })
    const repUnit: StorageUnit = {
      id: '',
      code: unitType.name,
      facilityId: facility.id,
      facilityName: facility.name,
      floor: 1,
      zone: 'Tiêu chuẩn',
      type: unitType.name.split(' ')[0] as any,
      areaM2: unitType.areaM2,
      dimensions: { lengthM: unitType.lengthM, widthM: unitType.widthM, heightM: unitType.heightM },
      doorDimensions: { widthM: 1.1, heightM: 2.2 },
      volumeM3: unitType.volumeM3,
      maxLoadKg: unitType.maxLoadKg,
      allowedGoods: ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
      prohibitedGoods: ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
      price: unitType.monthlyPrice,
      deposit: unitType.monthlyPrice,
      climate: true,
      status: availableCount > 0 ? 'available' : 'reserved',
      reservedPeriods: [],
      version: 1
    }
    setSelectedUnit(repUnit)
    setDetailOpen(true)
  }

  // Quote preview for currently open booking modal
  const currentQuote = selectedUnit
    ? (typeof calculateDIMAndQuote === 'function'
        ? calculateDIMAndQuote(selectedUnit, {
            lengthCm: cargoLengthNumber,
            widthCm: cargoWidthNumber,
            heightCm: cargoHeightNumber,
            weightKg: goodsWeightNumber,
            packageCount: packageCountNumber
          })
        : {
            quoteId: `QUO-${Date.now().toString().slice(-4)}`,
            unitId: selectedUnit.id,
            facilityId: selectedUnit.facilityId,
            baseMonthlyPrice: selectedUnit.price,
            depositAmount: selectedUnit.deposit || selectedUnit.price,
            dimSurcharge: 0,
            totalFirstPayment: (selectedUnit.price * 2),
            dimWeightKg: Math.ceil((cargoLengthNumber * cargoWidthNumber * cargoHeightNumber * packageCountNumber) / 5000),
            actualWeightKg: goodsWeightNumber,
            billableWeightKg: Math.max(goodsWeightNumber, Math.ceil((cargoLengthNumber * cargoWidthNumber * cargoHeightNumber * packageCountNumber) / 5000)),
            dimDivisor: 5000,
            quotedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
    : null

  const promotionDiscount = 0
  const hasValidPackageDimensions = [cargoLengthNumber, cargoWidthNumber, cargoHeightNumber].every(value => Number.isFinite(value) && value > 0)
  const largestPackageFitsDoor = Boolean(selectedUnit && hasValidPackageDimensions && [[0, 1], [0, 2], [1, 2]].some(([a, b]) => {
    const dimensionsM = [cargoLengthNumber / 100, cargoWidthNumber / 100, cargoHeightNumber / 100]
    const first = dimensionsM[a]
    const second = dimensionsM[b]
    return (first <= selectedUnit.doorDimensions.widthM && second <= selectedUnit.doorDimensions.heightM) || (second <= selectedUnit.doorDimensions.widthM && first <= selectedUnit.doorDimensions.heightM)
  }))

  const handleNotificationClick = (notification: LayoutNotification) => {
    navigateTo(notification.page)
    if (notification.id.startsWith('ticket-')) {
      setSupportTab('All')
      setSupportSearch('')
    }
    revealNotificationTarget(notification.targetId)
  }

  const revealNotificationTarget = (targetId?: string) => {
    if (!targetId) return
    notificationRevealTimers.current.forEach(timer => window.clearTimeout(timer))
    notificationRevealTimers.current = []
    setFocusedNotificationTarget(null)

    const scrollTimer = window.setTimeout(() => {
      const target = document.getElementById(`customer-record-${targetId}`)
      const scrollContainer = target?.closest('[data-layout-scroll-container]') as HTMLElement | null
      if (!target || !scrollContainer) return
      const targetRect = target.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()
      const centeredTop = scrollContainer.scrollTop
        + targetRect.top
        - containerRect.top
        - Math.max(0, (scrollContainer.clientHeight - targetRect.height) / 2)
      scrollContainer.scrollTo({ top: Math.max(0, centeredTop), behavior: 'smooth' })
      const highlightTimer = window.setTimeout(() => {
        setFocusedNotificationTarget(targetId)
        target.focus({ preventScroll: true })
        const clearTimer = window.setTimeout(() => setFocusedNotificationTarget(null), 2000)
        notificationRevealTimers.current.push(clearTimer)
      }, 700)
      notificationRevealTimers.current.push(highlightTimer)
    }, 100)
    notificationRevealTimers.current.push(scrollTimer)
  }

  useEffect(() => {
    return () => {
      notificationRevealTimers.current.forEach(timer => window.clearTimeout(timer))
      notificationRevealTimers.current = []
    }
  }, [])

  const validateBookingForm = () => {
    if (!selectedUnit) return false
    const errors: Record<string, string> = {}
    const goodsVolumeM3 = (cargoLengthNumber * cargoWidthNumber * cargoHeightNumber * packageCountNumber) / 1_000_000
    const usableVolumeM3 = selectedUnit.volumeM3 * 0.75
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const latestCheckIn = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    const requestedDate = moveInDate ? new Date(`${moveInDate}T00:00:00`) : null

    if (customerIdCard.trim().length < 9) errors.identity = lang === 'vi' ? 'CCCD/Hộ chiếu phải có ít nhất 9 ký tự.' : 'ID/passport must contain at least 9 characters.'
    if (customerPhone.replace(/\D/g, '').length < 9) errors.phone = lang === 'vi' ? 'Số điện thoại phải có ít nhất 9 chữ số.' : 'Phone must contain at least 9 digits.'
    if (!customerAddress.trim()) errors.address = lang === 'vi' ? 'Vui lòng nhập địa chỉ.' : 'Address is required.'
    if (!goodsType.trim()) errors.goodsType = lang === 'vi' ? 'Vui lòng nhập loại hàng hóa.' : 'Goods type is required.'
    if (!goodsMaterial.trim()) errors.material = lang === 'vi' ? 'Vui lòng nhập chất liệu.' : 'Material is required.'
    if (!goodsCondition.trim()) errors.condition = lang === 'vi' ? 'Vui lòng mô tả tình trạng đóng gói.' : 'Packaging condition is required.'
    if (!packageCount.trim() || !Number.isInteger(packageCountNumber) || packageCountNumber <= 0) errors.packageCount = lang === 'vi' ? 'Số kiện phải là số nguyên lớn hơn 0.' : 'Package count must be a positive integer.'
    if (!goodsWeight.trim() || !Number.isFinite(goodsWeightNumber) || goodsWeightNumber <= 0) errors.weight = lang === 'vi' ? 'Cân nặng phải lớn hơn 0.' : 'Weight must be greater than 0.'
    if (goodsWeightNumber > selectedUnit.maxLoadKg) errors.weightLimit = `${lang === 'vi' ? 'Tổng cân nặng vượt tải trọng sàn' : 'Weight exceeds floor limit'} (${selectedUnit.maxLoadKg} kg).`
    if (![cargoLength, cargoWidth, cargoHeight].every(value => value.trim()) || ![cargoLengthNumber, cargoWidthNumber, cargoHeightNumber].every(value => Number.isFinite(value) && value > 0)) errors.dimensions = lang === 'vi' ? 'Dài, rộng và cao đều phải lớn hơn 0.' : 'Length, width and height must all be greater than 0.'
    if (cargoLengthNumber > selectedUnit.dimensions.lengthM * 100 || cargoWidthNumber > selectedUnit.dimensions.widthM * 100 || cargoHeightNumber > selectedUnit.dimensions.heightM * 100) errors.dimensionFit = lang === 'vi' ? 'Kiện lớn nhất không lọt trong kích thước cỡ kho đã chọn.' : 'The largest package does not fit the selected storage dimensions.'
    const packageDimensionsM = [cargoLengthNumber / 100, cargoWidthNumber / 100, cargoHeightNumber / 100]
    const doorPairs = [[0, 1], [0, 2], [1, 2]]
    const fitsThroughDoor = doorPairs.some(([a, b]) => {
      const first = packageDimensionsM[a]
      const second = packageDimensionsM[b]
      return (first <= selectedUnit.doorDimensions.widthM && second <= selectedUnit.doorDimensions.heightM) || (second <= selectedUnit.doorDimensions.widthM && first <= selectedUnit.doorDimensions.heightM)
    })
    if (!fitsThroughDoor) errors.doorFit = lang === 'vi' ? `Kiện lớn nhất không lọt qua cửa kho ${selectedUnit.doorDimensions.widthM} × ${selectedUnit.doorDimensions.heightM} m, kể cả khi xoay kiện.` : `The largest package cannot pass through the ${selectedUnit.doorDimensions.widthM} × ${selectedUnit.doorDimensions.heightM} m door.`
    if (goodsVolumeM3 > usableVolumeM3) errors.volume = `${lang === 'vi' ? 'Thể tích hàng vượt sức chứa khả dụng' : 'Goods exceed usable capacity'} (~${usableVolumeM3.toFixed(1)} m³).`
    if (!requestedDate || Number.isNaN(requestedDate.getTime()) || requestedDate < today || requestedDate > latestCheckIn) errors.moveInDate = lang === 'vi' ? 'Ngày dự kiến Check-in phải từ hôm nay đến tối đa 14 ngày tới.' : 'Expected check-in must be within the next 14 days.'
    if (!bookingAppointmentTime) errors.appointmentTime = lang === 'vi' ? 'Vui lòng chọn khung giờ Check-in.' : 'Please select a check-in time slot.'
    setBookingErrors(errors)
    if (Object.keys(errors).length) {
      showToast(lang === 'vi' ? 'Vui lòng kiểm tra lại các thông tin được đánh dấu.' : 'Please check the highlighted information.')
      requestAnimationFrame(() => bookingErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return false
    }
    return true
  }

  // Submit reservation: Uses single atomic validation transaction (PASS / SOFT_EXCEPTION / HARD_VIOLATION)
  const confirmReservation = () => {
    if (!selectedUnit || !currentQuote) return

    if (!validateBookingForm()) return

    if (!bookingReview) {
      setBookingReview(true)
      return
    }

    const targetFacilityId = selectedTarget ? selectedTarget.facility.id : selectedUnit.facilityId
    const targetUnitTypeId = selectedTarget
      ? selectedTarget.unitType.id
      : selectedUnit.type === 'Medium'
      ? 'medium'
      : selectedUnit.type === 'Large'
      ? 'large'
      : selectedUnit.type === 'Extra Large'
      ? 'xlarge'
      : 'small'

    const result = validateAndCreateReservation({
      customer: user,
      unitTypeId: targetUnitTypeId,
      facilityId: targetFacilityId,
      goods: {
        category: goodsType,
        packageCount: packageCountNumber,
        lengthCm: cargoLengthNumber,
        widthCm: cargoWidthNumber,
        heightCm: cargoHeightNumber,
        weightKg: goodsWeightNumber,
        dimWeightKg: currentQuote.dimWeightKg,
        material: goodsMaterial,
        condition: goodsCondition,
        fragile: false
      },
      rentalMonths,
      moveInDate,
      identityId: customerIdCard,
      customerPhone,
      customerAddress,
      appointmentTime: bookingAppointmentTime,
      largestItemDimensionsCm: {
        lengthCm: cargoLengthNumber,
        widthCm: cargoWidthNumber,
        heightCm: cargoHeightNumber
      }
    })

    if (result.outcome === 'HARD_VIOLATION') {
      setValidationViolation({
        reason: result.rejectionReason,
        suggestedUnitTypeId: result.suggestedUnitTypeId,
        suggestedUnitTypeName: result.suggestedUnitTypeName,
        suggestedVolumeM3: result.suggestedVolumeM3
      })
      showToast(lang === 'vi' ? 'Vi phạm quy chuẩn! Không thể giữ gian kho này.' : 'Physical incompatibility detected!')
      return
    }

    setValidationViolation(null)
    localStorage.removeItem('customerTemporaryHoldExpiresAt')
    localStorage.removeItem('customerTemporaryHoldTarget')
    setTemporaryHoldExpiresAt(null)
    setTemporaryHoldTarget(null)
    setBookingReview(false)
    setBookOpen(false)
    setSelectedUnit(null)
    if (result.outcome === 'SOFT_EXCEPTION') {
      setPage('reservations')
      showToast(lang === 'vi' ? 'Cỡ kho này chưa phù hợp với thông tin hàng hóa. Vui lòng chọn cỡ khác.' : 'This storage size is not suitable for the declared goods.')
    } else {
      setPage('reservations')
      if (result.hold) {
        setActiveHoldForEmail(result.hold)
        setInputToken(result.hold.emailVerification?.token || '')
        setEmailModalOpen(true)
      }
      showToast(lang === 'vi' ? 'Đã tạo yêu cầu. Hãy xác minh email trước khi cơ sở phê duyệt.' : 'Request created. Verify your email before facility review.')
    }
  }

  return (
    <Layout
      user={user}
      navItems={NAV}
      currentPage={page}
      onNavigate={handleLayoutNavigate}
      onLogout={onLogout}
      roleLabel="Customer"
      roleColor=""
      notifications={customerNotifications}
      onNotificationClick={handleNotificationClick}
    >
      <div className="customer-page font-sans">
      {/* ── OVERVIEW ───────────────────────────────────────────── */}
      {page === 'overview' && (
        <div className="fade-in space-y-8 text-black">
          <section className="relative overflow-hidden rounded-3xl bg-[#111111] px-6 py-10 text-white sm:px-10 sm:py-14 xl:px-14">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -bottom-32 right-24 h-80 w-80 rounded-full border border-white/10" />
            <div className="relative z-10 grid items-end gap-10 lg:grid-cols-[1.35fr_.65fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.22em] text-white/60">StorageHub · {lang === 'vi' ? 'Hệ thống cơ sở lưu kho' : 'Storage facility network'}</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
                  {lang === 'vi' ? 'Không gian phù hợp cho những điều bạn muốn giữ gìn.' : 'The right space for everything worth keeping.'}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                  {lang === 'vi' ? 'Chọn cơ sở, chọn cỡ kho và kiểm tra sức chứa theo DIM. Bạn có 30 phút để hoàn tất yêu cầu, 12 giờ để thanh toán cọc và 14 ngày để Check-in.' : 'Choose a facility and size, then verify capacity by DIM. Complete the request in 30 minutes, pay the deposit in 12 hours and check in within 14 days.'}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button onClick={() => navigateTo('browse-units')} className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-stone-200">
                    {lang === 'vi' ? 'Xem kho còn trống' : 'Browse available storage'}
                  </button>
                  <button onClick={() => navigateTo('browse-facilities')} className="rounded-lg border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                    {lang === 'vi' ? 'Khám phá cơ sở' : 'Explore facilities'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                {[
                  ['30', lang === 'vi' ? 'phút tạm giữ suất kho' : 'minute temporary hold'],
                  ['12', lang === 'vi' ? 'giờ thanh toán cọc' : 'hours to pay deposit'],
                  ['14', lang === 'vi' ? 'ngày để Check-in' : 'days to check in']
                ].map(([value, label]) => (
                  <div key={value} className="rounded-2xl border border-white/15 bg-white/[.06] p-4 backdrop-blur">
                    <p className="text-3xl font-bold">{value}</p>
                    <p className="mt-1 text-xs leading-5 text-white/65">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-stone-500">{lang === 'vi' ? 'Tài khoản của bạn' : 'Your account'}</p>
              <h2 className="mt-1 text-2xl font-bold text-black">{lang === 'vi' ? `Xin chào, ${user.name}` : `Welcome, ${user.name}`}</h2>
              <p className="mt-1 text-sm text-stone-600">{lang === 'vi' ? 'Theo dõi đơn đặt kho, hợp đồng và quyền truy cập tại một nơi.' : 'Track bookings, contracts and access in one place.'}</p>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
            <StatCard title={lang === 'vi' ? 'Hồ sơ thuê đang hoạt động' : 'Active rentals'} value={activeRentals.length} icon={Icon.key} iconBg="bg-blue-50 text-blue-700" />
            <StatCard title={lang === 'vi' ? 'Đơn đặt giữ kho' : 'Storage reservations'} value={visibleMyHolds.length} icon={Icon.calendar} iconBg="bg-amber-50 text-amber-700" />
            <StatCard title={lang === 'vi' ? 'Kho đang giữ chờ hoàn tất' : 'Pending holds'} value={visibleMyHolds.filter(h => !['CANCELLED', 'EXPIRED', 'COMPLETED', 'checked_in', 'rejected'].includes(h.status)).length} icon={Icon.clock} iconBg="bg-stone-100 text-black" />
            <StatCard title={lang === 'vi' ? 'Yêu cầu hỗ trợ đang mở' : 'Open tickets'} value={tickets.filter(t => t.status === 'open').length} icon={Icon.support} />
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                <div>
                  <p className="eyebrow">{lang === 'vi' ? 'Kho hiện tại' : 'Active storage spaces'}</p>
                  <h2 className="mt-1 font-bold text-stone-900">{lang === 'vi' ? 'Các kho bạn đang thuê' : 'Your active storage rentals'}</h2>
                </div>
              </div>
              {activeRentals.length ? (
                <div className="divide-y divide-stone-200">
                  {activeRentals.map(rental => (
                    <div key={rental.id} className="grid gap-5 p-5 transition hover:bg-stone-50 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs font-semibold uppercase tracking-[.08em] text-amber-700">
                            {lang === 'vi' ? `Gian kho ${rental.unitId}` : `Unit ${rental.unitId}`}
                          </p>
                          {rental.status === 'return_requested' && <Badge variant="warning">{lang === 'vi' ? 'Đang chờ trả kho' : 'Return requested'}</Badge>}
                        </div>
                        <p className="mt-2 text-xl font-bold text-stone-900">{rental.facilityName}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {rental.unitType} · {rental.areaM2} m² · {lang === 'vi' ? 'Kỳ hạn tiếp theo:' : 'Next payment:'} {rental.nextDue}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 rounded-lg bg-[#292a27] px-3 py-1.5 font-mono text-sm font-bold text-white">
                            <span>{lang === 'vi' ? 'Mã mở cổng:' : 'Gate PIN:'}</span>
                            <span className="text-[#e9a12c]">{rental.gateCode || '—'}</span>
                          </div>
                          <Badge variant="muted">{lang === 'vi' ? 'Quyền vào 24/7' : '24/7 access'}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => {
                          navigateTo('rental-records')
                          revealNotificationTarget(rental.id)
                        }}>
                          {lang === 'vi' ? 'Chi tiết hồ sơ thuê' : 'Rental details'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="font-semibold text-stone-700">{lang === 'vi' ? 'Bạn chưa có hồ sơ thuê kho đang hoạt động' : 'You do not have an active rental'}</p>
                  <p className="mt-1 text-sm text-stone-500">{lang === 'vi' ? 'Hãy khám phá các gian kho còn trống và giữ kho phù hợp với hàng hóa của bạn.' : 'Browse available units and reserve a unit suited for your items.'}</p>
                  <Button className="mt-4" onClick={() => navigateTo('browse-units')}>
                    {lang === 'vi' ? 'Xem các gian kho còn trống' : 'Browse available units'}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <p className="eyebrow">{lang === 'vi' ? 'Thao tác nhanh' : 'Quick actions'}</p>
              <h2 className="mt-1 font-bold text-stone-900">{lang === 'vi' ? 'Quy trình thuê kho khép kín' : 'Storage lifecycle steps'}</h2>
              <div className="mt-4 grid gap-2">
                <button onClick={() => navigateTo('browse-units')} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.building}</span>
                  <span>
                    <b className="block text-sm">{lang === 'vi' ? '1. Chọn kho & Khai báo hàng hóa' : '1. Choose unit & Goods DIM'}</b>
                    <small className="text-stone-500 group-hover:text-white">{lang === 'vi' ? 'Giữ tạm một suất trong 30 phút để hoàn tất thông tin' : 'Hold one size slot for 30 minutes while you complete the form'}</small>
                  </span>
                </button>
                <button onClick={() => navigateTo('reservations')} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.calendar}</span>
                  <span>
                    <b className="block text-sm">{lang === 'vi' ? '2. Tiến độ đơn đặt giữ kho' : '2. Storage hold progress'}</b>
                    <small className="text-stone-500 group-hover:text-white">{lang === 'vi' ? 'Cọc 20% trong 12 giờ, sau đó cơ sở phân kho vật lý' : 'Pay 20% within 12 hours, then receive a physical unit assignment'}</small>
                  </span>
                </button>
                <button onClick={() => setTicketOpen(true)} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.support}</span>
                  <span>
                    <b className="block text-sm">{lang === 'vi' ? '3. Hỗ trợ kỹ thuật & Mở cổng' : '3. Support desk'}</b>
                    <small className="text-stone-500 group-hover:text-white">{lang === 'vi' ? 'Đội ngũ trực cơ sở hỗ trợ 24/7' : 'Facility staff support round the clock'}</small>
                  </span>
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── BROWSE FACILITIES ──────────────────────────────────── */}
      {page === 'browse-facilities' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Hệ Thống Cơ Sở Lưu Kho' : 'Find a Facility'}
            subtitle={lang === 'vi' ? 'So sánh và lựa chọn vị trí kho bãi StorageHub gần bạn nhất' : 'Compare secure StorageHub locations near you'}
            action={
              <label className="relative block w-full sm:w-72">
                <span className="sr-only">Search facilities</span>
                <input
                  value={searchFacility}
                  onChange={event => setSearchFacility(event.target.value)}
                  placeholder={lang === 'vi' ? 'Tìm theo thành phố, quận hoặc địa chỉ...' : 'Search city, area or address'}
                  className="pl-10 w-full border border-stone-300 rounded-lg py-2 text-sm focus:ring-2 focus:ring-amber-500"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-stone-400">{Icon.search}</span>
              </label>
            }
          />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {matchingFacilities.map(facility => {
              const facUnits = units.filter(u => u.facilityId === facility.id || u.facilityName === facility.name)
              const availCount = effectiveAvailableCount(facility.id)

              return (
                <Card key={facility.id} className="overflow-hidden stat-card-hover">
                  <div className="relative h-44 bg-stone-200">
                    <img src={`https://images.unsplash.com/${facility.image}?w=720&h=352&fit=crop&auto=format`} alt={`${facility.name} storage facility`} className="h-full w-full object-cover" />
                    <div className="absolute left-3 top-3 z-10">
                      <span className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-extrabold backdrop-blur-sm ${availCount > 0 ? 'border-emerald-300 bg-emerald-700/95 text-white shadow-[0_8px_22px_rgba(4,120,87,0.55)]' : 'border-red-300 bg-red-700/95 text-white shadow-[0_8px_22px_rgba(185,28,28,0.5)]'}`}>
                        {availCount} {lang === 'vi' ? 'gian kho còn trống' : 'units available'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] font-semibold text-amber-700">{facility.id.toUpperCase()}</p>
                        <h2 className="font-bold text-stone-900">{facility.name}</h2>
                        <p className="mt-1 text-xs text-stone-500">{facility.address}</p>
                      </div>
                      <span className="text-sm font-semibold text-amber-700"> {facility.rating}</span>
                    </div>
                    <div className="my-4 flex flex-wrap gap-2">
                      <Badge variant="muted">{lang === 'vi' ? 'Camera 24/7' : '24/7 security'}</Badge>
                      {facility.climate && <Badge variant="info">{lang === 'vi' ? 'Điều hòa độ ẩm' : 'Climate control'}</Badge>}
                    </div>
                    <div className="flex items-end justify-between border-t border-stone-100 pt-4">
                      <div>
                        <p className="text-xs text-stone-500">{lang === 'vi' ? 'Giá chỉ từ' : 'Starting from'}</p>
                        <p className="text-xl font-bold text-stone-900">{formatVnd(Number(facility.price.replace(/[^0-9.]/g, '')))}<span className="text-xs font-normal text-stone-500">/{lang === 'vi' ? 'tháng' : 'month'}</span></p>
                      </div>
                      <Button size="sm" onClick={() => navigateTo('browse-units', { facilityId: facility.id })}>
                        {lang === 'vi' ? 'Xem các gian kho' : 'View units'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BROWSE UNITS / SIZES BY FACILITY ─────────────────── */}
      {page === 'browse-units' && (() => {
        const displayedFacilities = selectedFacility
          ? [selectedFacility]
          : facilities.filter(f =>
              `${f.name} ${f.address} ${f.city}`.toLowerCase().includes(searchFacility.toLowerCase())
            )

        const displayedUnitTypes = sizeFilter === 'All'
          ? unitTypes
          : unitTypes.filter(ut => ut.name.toLowerCase().includes(sizeFilter.toLowerCase()))

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={selectedFacility
                ? (lang === 'vi' ? `Kho còn trống tại ${selectedFacility.name}` : `Available storage at ${selectedFacility.name}`)
                : (lang === 'vi' ? 'Kho còn trống' : 'Available storage')}
              subtitle={selectedFacility
                ? `${selectedFacility.address} · ${lang === 'vi' ? 'Chọn cỡ kho; mã kho vật lý được phân sau khi cọc thành công.' : 'Choose a size; the physical unit is assigned after deposit payment.'}`
                : (lang === 'vi' ? 'Chọn cơ sở và cỡ kho phù hợp. Thông tin được trình bày ngắn gọn để bạn dễ so sánh.' : 'Choose a facility and storage size with a clear side-by-side comparison.')}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {selectedFacility && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedFacilityId(null)}
                    >
                      ← {lang === 'vi' ? 'Tất cả cơ sở' : 'All Facilities'}
                    </Button>
                  )}
                  <Select value={sizeFilter} onChange={event => setSizeFilter(event.target.value)} className="w-full sm:w-56">
                    <option value="All">{lang === 'vi' ? 'Tất cả kích thước' : 'All sizes'}</option>
                    <option value="Small">{lang === 'vi' ? 'Nhỏ (Small · ~2.25 m²)' : 'Small (~2.25 m²)'}</option>
                    <option value="Medium">{lang === 'vi' ? 'Vừa (Medium · ~6.0 m²)' : 'Medium (~6.0 m²)'}</option>
                    <option value="Large">{lang === 'vi' ? 'Lớn (Large · ~12.0 m²)' : 'Large (~12.0 m²)'}</option>
                    <option value="Extra Large">{lang === 'vi' ? 'Cực lớn (XL · ~18.0 m²)' : 'Extra Large (~18.0 m²)'}</option>
                  </Select>
                </div>
              }
            />

            {selectedFacility && (
              <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-500">{lang === 'vi' ? 'Cơ sở' : 'Facility'}</span>
                  <b className="text-black">{selectedFacility.name}</b>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFacilityId(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-black hover:underline"
                >
                  {lang === 'vi' ? 'Xem toàn bộ cơ sở' : 'Show all'} ✕
                </button>
              </div>
            )}

            {/* List Facilities with their 3-4 Unit Sizes */}
            <div className="space-y-8">
              {displayedFacilities.map(facility => {
                const facUnits = units.filter(u => u.facilityId === facility.id || u.facilityName === facility.name)
                const totalAvail = effectiveAvailableCount(facility.id)

                return (
                  <section key={facility.id} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-stone-300 bg-stone-50 px-2 py-0.5 text-xs font-bold text-black">
                            {facility.id.toUpperCase()}
                          </span>
                          <h3 className="text-xl font-bold text-black">{facility.name}</h3>
                          <span className="text-xs font-semibold text-black">★ {facility.rating}</span>
                        </div>
                        <p className="mt-1 text-sm text-stone-600">{facility.address}, {facility.city}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${totalAvail > 0 ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-red-700 bg-red-700 text-white'}`}>{totalAvail} {lang === 'vi' ? 'kho trống' : 'available'}</span>
                        {!selectedFacility && (
                          <Button size="sm" variant="outline" onClick={() => setSelectedFacilityId(facility.id)}>
                            {lang === 'vi' ? 'Lọc riêng cơ sở này' : 'View only'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 3-4 Size Categories Grid for this facility */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {displayedUnitTypes.map(ut => {
                        const expectedType = ut.id === 'xlarge' ? 'Extra Large' : ut.id.charAt(0).toUpperCase() + ut.id.slice(1)
                        const targetUnits = facUnits.filter(u => u.type === expectedType)
                        const availableCount = effectiveAvailableCount(facility.id, ut.name)

                        return (
                          <SizeCategoryCard
                            key={ut.id}
                            facility={facility}
                            unitType={ut}
                            availableCount={availableCount}
                            lang={lang}
                            onReserve={handleStartReservation}
                            onViewSpecs={handleOpenSpecs}
                          />
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── STORAGE RESERVATIONS (HOLDS) ─────────────────────── */}
      {page === 'reservations' && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={lang === 'vi' ? 'Đơn Đặt Giữ Kho Của Tôi' : 'Storage Reservations'}
            subtitle={lang === 'vi' ? 'Tạm giữ 30 phút → Chờ cọc 12 giờ → Phân kho vật lý → Check-in trong 14 ngày' : '30-minute hold → 12-hour deposit → unit assignment → check-in within 14 days'}
            action={<Button size="sm" onClick={() => navigateTo('browse-units')}>{Icon.plus} {lang === 'vi' ? 'Đặt giữ kho mới' : 'New hold'}</Button>}
          />

          {visibleMyHolds.length ? (
            <div className="grid gap-4">
              {visibleMyHolds.map(hold => {
                const linkedRentalEnded = rentals.some(rental => rental.holdId === hold.id && rental.status === 'completed')
                const holdInactive = ['CANCELLED', 'EXPIRED'].includes(hold.status) || linkedRentalEnded
                return (
                <Card id={`customer-record-${hold.id}`} tabIndex={-1} key={hold.id} className={`p-6 border-l-4 ${holdInactive ? 'inactive-record-card border-l-stone-300 bg-white text-stone-500' : 'border-l-amber-500'} ${focusedNotificationTarget === hold.id ? 'notification-target-reveal' : ''}`}>
                  <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-700">{hold.id}</span>
                        {badgeFor(hold.status)}
                        {hold.payment.status === 'paid' && <span className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white">{lang === 'vi' ? 'Đã cọc giữ chỗ 20%' : '20% Deposit Paid'}</span>}
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-stone-900">
                        {hold.assignedUnitId ? (lang === 'vi' ? `Gian kho ${hold.assignedUnitId}` : `Unit ${hold.assignedUnitId}`) : (hold.unitTypeName || hold.unitId)} · {hold.facilityName}
                      </h2>
                      <p className="text-xs text-stone-500">
                        {lang === 'vi' ? 'Lịch Check-in hiện tại:' : 'Current check-in schedule:'} <b>{hold.appointmentDate || hold.moveInDate}{hold.appointmentTime ? ` · ${hold.appointmentTime}` : ''}</b> · {lang === 'vi' ? 'Thời hạn:' : 'Term:'} {hold.rentalMonths} {lang === 'vi' ? 'tháng' : 'months'}
                      </p>

                      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p><b>Hàng hóa khai báo:</b> {hold.goods.category} ({hold.goods.packageCount} kiện, {hold.goods.weightKg}kg)</p>
                          {hold.assignedUnitId ? (
                            <span className="rounded bg-blue-700 px-2 py-1 text-[11px] font-bold text-white">
                               Gian kho được phân: <b>{hold.assignedUnitId}</b>
                            </span>
                          ) : (
                            <span className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white">
                              Chờ Facility Manager phân kho theo khoảng ngày
                            </span>
                          )}
                        </div>
                        <p><b>{lang === 'vi' ? 'Kích thước kiện & Thể tích:' : 'Package specs & Volume:'}</b> {hold.goods.lengthCm}×{hold.goods.widthCm}×{hold.goods.heightCm}cm (~{Math.round((hold.goods.lengthCm * hold.goods.widthCm * hold.goods.heightCm * hold.goods.packageCount) / 1000) / 1000} m³)</p>
                        {(() => { const unitSpec = units.find(unit => unit.id === hold.assignedUnitId) || units.find(unit => unit.facilityId === hold.facilityId && unitTypeMatches(unit.type, hold.unitTypeName)); return unitSpec ? <p><b>{lang === 'vi' ? 'Cửa kho thông thủy:' : 'Clear door opening:'}</b> {unitSpec.doorDimensions.widthM}m × {unitSpec.doorDimensions.heightM}m ({lang === 'vi' ? 'rộng × cao' : 'W × H'}) · <span className="font-semibold text-emerald-700">✓ {lang === 'vi' ? 'Kiện đã qua kiểm tra lọt cửa' : 'Package clearance verified'}</span></p> : null })()}
                        
                        {/* Financial breakdown: Reservation Deposit vs Security Deposit */}
                        {(() => {
                          const rentTotal = hold.quote.baseMonthlyPrice * hold.rentalMonths
                          const bookingDeposit = hold.reservationDepositAmount ?? Math.round(rentTotal * 0.2 * 100) / 100
                          const rentBalance = Math.max(0, rentTotal - bookingDeposit)
                          return <div className="mt-2 grid gap-2 border-t border-stone-200/80 pt-3 text-[11px] sm:grid-cols-2">
                            <div className="rounded-lg bg-white/70 p-3 leading-5"><p className="font-bold text-stone-900">{lang === 'vi' ? 'Tiền thuê và cọc giữ chỗ' : 'Rent and booking deposit'}</p><p>{lang === 'vi' ? `Tiền thuê: ${formatVnd(hold.quote.baseMonthlyPrice)} × ${hold.rentalMonths} tháng = ${formatVnd(rentTotal)}` : `Rent: ${formatVnd(hold.quote.baseMonthlyPrice)} × ${hold.rentalMonths} months = ${formatVnd(rentTotal)}`}</p><p>{lang === 'vi' ? `Cọc 20%: ${formatVnd(rentTotal)} × 20% = ${formatVnd(bookingDeposit)}` : `20% deposit: ${formatVnd(rentTotal)} × 20% = ${formatVnd(bookingDeposit)}`}</p><p>{lang === 'vi' ? `Tiền thuê còn lại: ${formatVnd(rentTotal)} − ${formatVnd(bookingDeposit)} = ${formatVnd(rentBalance)}` : `Remaining rent: ${formatVnd(rentTotal)} − ${formatVnd(bookingDeposit)} = ${formatVnd(rentBalance)}`}</p></div>
                            <div className="rounded-lg bg-amber-50 p-3 leading-5"><p className="font-bold text-stone-900">{lang === 'vi' ? 'Khoản thu tại Check-in' : 'Due at check-in'}</p><p>{lang === 'vi' ? `Tiền thuê còn lại: ${formatVnd(rentBalance)}` : `Remaining rent: ${formatVnd(rentBalance)}`}</p><p>{lang === 'vi' ? `+ Tiền đảm bảo kho: ${formatVnd(hold.securityDepositAmount)}` : `+ Storage security deposit: ${formatVnd(hold.securityDepositAmount)}`}</p><p className="border-t border-amber-200 pt-1 font-bold">{lang === 'vi' ? `Tổng thu tại Check-in: ${formatVnd(hold.remainingAmount)}` : `Total due at check-in: ${formatVnd(hold.remainingAmount)}`}</p></div>
                          </div>
                        })()}

                        {hold.payment.status === 'paid' && <p className="pt-1 text-[11px] font-medium text-black">{lang === 'vi' ? 'Cọc đã thanh toán. Cơ sở sẽ phân kho vật lý trước Check-in; hạn hoàn tất Check-in là 14 ngày từ ngày cọc.' : 'Deposit paid. The facility assigns a unit before check-in; check-in must be completed within 14 days.'}</p>}

                        {hold.generatedAccessPin && !holdInactive && (
                          <div className="mt-2 rounded bg-[#292a27] p-2 text-white font-mono text-xs flex items-center justify-between">
                            <span>{lang === 'vi' ? 'Mã PIN hệ thống cấp (Kích hoạt sau check-in):' : 'System-generated Gate PIN:'}</span>
                            <span className="text-[#e9a12c] font-bold text-sm tracking-widest">{hold.generatedAccessPin}</span>
                          </div>
                        )}
                      </div>

                      {!['CANCELLED', 'EXPIRED'].includes(hold.status) && (() => {
                        const progressSteps = [
                          { label: lang === 'vi' ? 'Xác minh email' : 'Email verification', detail: lang === 'vi' ? 'Xác nhận địa chỉ liên hệ' : 'Confirm contact address' },
                          { label: lang === 'vi' ? 'Phê duyệt hồ sơ' : 'Facility review', detail: lang === 'vi' ? 'Cơ sở kiểm tra yêu cầu' : 'Facility reviews request' },
                          { label: lang === 'vi' ? 'Thanh toán cọc' : 'Deposit payment', detail: lang === 'vi' ? 'Hoàn tất cọc giữ chỗ 20%' : 'Complete the 20% deposit' },
                          { label: lang === 'vi' ? 'Cơ sở phân kho' : 'Unit assignment', detail: lang === 'vi' ? 'Cơ sở đang chọn gian kho phù hợp' : 'Facility assigns a suitable unit' },
                          { label: lang === 'vi' ? 'Check-in & ký' : 'Check-in & sign', detail: lang === 'vi' ? 'Đối chiếu và ký tại cơ sở' : 'Verify and sign on site' },
                          { label: lang === 'vi' ? 'Đã bàn giao' : 'Handed over', detail: lang === 'vi' ? 'Nhận kho và mã ra vào' : 'Receive unit and access code' }
                        ]
                        const currentIndex = hold.status === 'awaiting_email' ? 0 : hold.status === 'awaiting_review' ? 1 : hold.status === 'awaiting_payment' ? 2 : hold.status === 'DEPOSIT_PAID' ? 3 : hold.status === 'UNIT_RESERVED' ? 4 : hold.status === 'READY_FOR_CHECKIN' ? 4 : hold.status === 'COMPLETED' ? 6 : -1
                        const activeStep = progressSteps[currentIndex]

                        return <div className="mt-4 border-t border-stone-200 pt-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-black">{lang === 'vi' ? 'Tiến trình đơn đặt kho' : 'Booking progress'}</p>
                              <p className="mt-0.5 text-[11px] text-stone-500">{lang === 'vi' ? `Đã hoàn thành ${Math.max(0, currentIndex)}/6 bước` : `${Math.max(0, currentIndex)} of 6 steps completed`}</p>
                            </div>
                            {activeStep && <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-300">
                              {lang === 'vi' ? 'Đang thực hiện: ' : 'In progress: '} {activeStep.label}
                            </span>}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            {progressSteps.map((step, index) => {
                              const completed = index < currentIndex || hold.status === 'COMPLETED'
                              const current = index === currentIndex && hold.status !== 'COMPLETED'
                              return <div key={step.label} aria-current={current ? 'step' : undefined} className={`relative rounded-xl border p-3 transition ${completed ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : current ? 'border-amber-500 bg-amber-500 text-white shadow-lg ring-2 ring-amber-200' : 'border-stone-200 bg-stone-50 text-stone-400'}`}>
                                <div className="mb-2 flex items-center justify-between gap-1">
                                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${completed ? 'bg-emerald-600 text-white' : current ? 'bg-white text-amber-700' : 'bg-stone-200 text-stone-500'}`}>{completed ? '✓' : index + 1}</span>
                                  <span className={`text-[9px] font-bold uppercase tracking-wide ${completed ? 'text-emerald-700' : current ? 'text-white' : 'text-stone-400'}`}>{completed ? (lang === 'vi' ? 'Đã xong' : 'Done') : current ? (lang === 'vi' ? 'Hiện tại' : 'Current') : (lang === 'vi' ? 'Sắp tới' : 'Upcoming')}</span>
                                </div>
                                <p className="text-[11px] font-bold leading-4">{step.label}</p>
                                <p className={`mt-1 text-[10px] leading-4 ${current ? 'text-amber-50' : completed ? 'text-emerald-700' : 'text-stone-400'}`}>{step.detail}</p>
                              </div>
                            })}
                          </div>
                        </div>
                      })()}
                    </div>

                    {/* Action buttons based on canonical status */}
                    <div className="flex min-w-0 flex-col items-stretch gap-3 lg:items-end">
                      <div className="text-right">
                        <p className="text-xs text-stone-500">{lang === 'vi' ? 'Tổng thu cả kỳ (gồm tiền đảm bảo kho):' : 'Total collected (including security deposit):'}</p>
                        <p className="text-xl font-bold text-stone-900">{formatVnd(hold.totalInitialAmount ?? hold.quote.totalFirstPayment)}</p>
                        <p className="text-xs text-amber-800">
                          {lang === 'vi' ? 'Trả lúc giữ chỗ' : 'Paid at reservation'}: {formatVnd(hold.reservationDepositAmount ?? hold.payment.amount)} · {lang === 'vi' ? 'Thu tại Check-in' : 'Due at check-in'}: {formatVnd(hold.remainingAmount)}
                        </p>
                      </div>

                      {hold.status === 'awaiting_email' && (
                        <div className="min-w-[220px] rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-xs text-amber-950">
                          <p className="font-bold">{lang === 'vi' ? 'Cần xác minh email' : 'Email verification required'}</p>
                          <Button className="mt-2" size="sm" onClick={() => { setActiveHoldForEmail(hold); setInputToken(hold.emailVerification?.token || ''); setEmailModalOpen(true) }}>{lang === 'vi' ? 'Xác minh email' : 'Verify email'}</Button>
                        </div>
                      )}

                      {hold.status === 'awaiting_review' && (
                        <div className="min-w-[220px] rounded-lg border border-stone-300 bg-stone-50 p-3 text-right text-xs text-stone-700">
                          <p className="font-bold">{lang === 'vi' ? 'Đang chờ cơ sở phê duyệt' : 'Awaiting facility approval'}</p>
                          <p className="mt-1">{lang === 'vi' ? 'Thanh toán sẽ mở sau khi hồ sơ được duyệt.' : 'Payment opens after approval.'}</p>
                        </div>
                      )}

                      {hold.status === 'awaiting_payment' && hold.payment.status !== 'paid' && (
                        <div className="min-w-[220px] rounded-lg border border-red-700 bg-red-700 p-3 text-right text-xs text-white shadow-sm">
                          <p className="font-bold text-white">{lang === 'vi' ? 'Cần thanh toán cọc trong 12 giờ' : 'Deposit due within 12 hours'}</p>
                          <p className="mt-1 font-mono text-lg font-bold text-white">{formatCountdown(hold.paymentExpiresAt).text}</p>
                          <Button className="mt-2" size="sm" disabled={formatCountdown(hold.paymentExpiresAt).isExpired} onClick={() => { setActiveHoldForPayment(hold); setPayModalOpen(true) }}>{lang === 'vi' ? 'Thanh toán cọc 20%' : 'Pay 20% deposit'}</Button>
                        </div>
                      )}

                      {/* View Contract & Receipt */}
                      {hold.payment.status === 'paid' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveHoldForContract(hold)
                            setContractEmailModalOpen(true)
                          }}
                        >
                          {lang === 'vi' ? 'Xem điều khoản & biên lai' : 'Terms & receipt'}
                        </Button>
                      )}

                      {['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(hold.status) && (
                        <Button variant="outline" size="sm" onClick={() => { setActiveHoldForSchedule(hold); setAppointmentDate(hold.appointmentDate || hold.moveInDate || ''); setAppointmentTime(/^\d{2}:\d{2}$/.test(hold.appointmentTime || '') ? hold.appointmentTime! : '09:00'); setScheduleModalOpen(true) }}>
                          {hold.appointmentDate && hold.appointmentTime ? (lang === 'vi' ? `Đổi lịch: ${hold.appointmentDate} ${hold.appointmentTime}` : `Reschedule: ${hold.appointmentDate}`) : (lang === 'vi' ? 'Đặt lịch Check-in' : 'Schedule check-in')}
                        </Button>
                      )}

                      {/* UNIT_RESERVED: Manager assigned, prompt customer to visit facility */}
                      {hold.status === 'UNIT_RESERVED' && (
                        <div className="rounded-lg border border-blue-700 bg-blue-700 p-2.5 text-right text-xs text-white space-y-1">
                          <p className="font-semibold text-white">
                            {lang === 'vi' ? 'Đã phân bổ kho! Vui lòng đến cơ sở:' : 'Unit assigned! Please visit facility:'}
                          </p>
                          <p className="text-[11px] text-white">
                            {lang === 'vi' ? '• Xuất trình CCCD/Hộ chiếu gốc' : '• Present original ID/Passport'}<br />
                            {lang === 'vi' ? '• Ký hợp đồng giấy tại quầy' : '• Sign paper contract at desk'}<br />
                            {lang === 'vi' ? `• Thanh toán phần còn lại (${formatVnd(hold.remainingAmount)})` : `• Pay remaining balance (${formatVnd(hold.remainingAmount)})`}
                          </p>
                        </div>
                      )}

                      {/* READY_FOR_CHECKIN: Contract & payment complete, ready for handover */}
                      {hold.status === 'READY_FOR_CHECKIN' && (
                        <div className="rounded-lg bg-stone-50 border border-stone-300 p-2.5 text-right text-xs space-y-1">
                          <p className="font-bold text-black">
                             {lang === 'vi' ? 'Sẵn sàng nhận bàn giao kho' : 'Ready for Check-in'}
                          </p>
                          <p className="text-[11px] text-stone-600">
                            {lang === 'vi' ? 'Nhân viên sẽ chụp ảnh hiện trạng và kích hoạt mã PIN mở cửa.' : 'Staff will inspect unit and activate your gate PIN.'}
                          </p>
                        </div>
                      )}

                      {/* COMPLETED: Check-in complete, show rental */}
                      {hold.status === 'COMPLETED' && (
                        <Button variant="primary" size="sm" onClick={() => navigateTo('rental-records')}>
                          {lang === 'vi' ? 'Xem hồ sơ thuê kho' : 'View active rental'}
                        </Button>
                      )}

                      {/* Cancel Reservation Action */}
                      {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 text-xs"
                          onClick={() => {
                            const warning = hold.payment.status === 'paid'
                              ? (lang === 'vi' ? 'Đơn đã thanh toán cọc giữ chỗ. Nếu hủy trước Check-in, khoản cọc này KHÔNG ĐƯỢC HOÀN. Bạn chắc chắn muốn hủy?' : 'The reservation deposit has been paid. Cancelling before check-in makes this deposit NON-REFUNDABLE. Continue?')
                              : (lang === 'vi' ? 'Bạn có chắc chắn muốn hủy giữ kho? Suất kho đang giữ sẽ được trả lại ngay.' : 'Cancel this reservation and release the held capacity now?')
                            if (window.confirm(warning)) {
                              cancelReservation(hold.id, user, 'Khách hàng chủ động hủy')
                              showToast(lang === 'vi' ? 'Đã hủy đơn đặt giữ kho thành công.' : 'Reservation cancelled.')
                            }
                          }}
                        >
                          ✕ {lang === 'vi' ? 'Hủy giữ kho' : 'Cancel reservation'}
                        </Button>
                      )}

                      {hold.status === 'CANCELLED' && (
                        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-right text-xs text-red-800 shadow-sm">
                          <p className="font-bold text-red-800">✕ {lang === 'vi' ? 'Đơn đã hủy' : 'Cancelled'}</p>
                          <p className="mt-0.5 text-[11px] text-red-700">{lang === 'vi' ? 'Gian kho đã được giải phóng.' : 'Unit capacity released.'}</p>
                          {hold.payment.status === 'paid' && <p className="mt-1 font-semibold text-red-800">{lang === 'vi' ? 'Cọc giữ chỗ không hoàn lại do hủy trước Check-in.' : 'Reservation deposit forfeited for pre-check-in cancellation.'}</p>}
                        </div>
                      )}

                      {hold.status === 'EXPIRED' && (
                        <div className="rounded-lg bg-stone-100 border border-stone-300 px-3 py-1.5 text-xs text-stone-600 text-right">
                          <p className="font-bold text-stone-700"> {lang === 'vi' ? 'Đơn đã hết hạn (Quá hạn/No-show)' : 'Expired (No-show)'}</p>
                          <p className="text-[11px] mt-0.5">{lang === 'vi' ? 'Gian kho đã được hoàn lại danh mục.' : 'Unit capacity returned.'}</p>
                        </div>
                      )}
                      {linkedRentalEnded && <div className="inactive-record-alert rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-right text-xs text-red-800"><p className="font-bold">{lang === 'vi' ? 'Hồ sơ giữ kho đã hết hiệu lực' : 'Reservation record inactive'}</p><p className="mt-0.5">{lang === 'vi' ? 'Hợp đồng đã hoàn tất trả kho; mã PIN đã bị thu hồi.' : 'The rental completed move-out and its PIN was revoked.'}</p></div>}
                      {holdInactive && <Button variant="outline" size="sm" onClick={() => { if (!window.confirm(lang === 'vi' ? 'Xóa lịch sử này khỏi danh sách của bạn? Dữ liệu đối soát hệ thống vẫn được lưu.' : 'Remove this history from your list? Audit data will remain stored.')) return; try { archiveReservationHistory(hold.id, user); showToast(lang === 'vi' ? 'Đã xóa lịch sử giữ kho khỏi danh sách.' : 'Reservation history removed from your list.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử.') } }}><span aria-hidden="true">🗑</span> {lang === 'vi' ? 'Xóa lịch sử' : 'Remove history'}</Button>}
                    </div>
                  </div>
                </Card>
              )})}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto w-fit text-stone-300">{Icon.calendar}</div>
              <h2 className="mt-3 font-semibold text-stone-700">{lang === 'vi' ? 'Chưa có đơn đặt giữ kho nào' : 'No reservations'}</h2>
              <p className="mt-1 text-sm text-stone-500">{lang === 'vi' ? 'Đơn đặt giữ kho của bạn sẽ hiển thị tại đây.' : 'Your next reservation will appear here.'}</p>
              <Button className="mt-4" size="sm" onClick={() => navigateTo('browse-units')}>
                {lang === 'vi' ? 'Khám phá gian kho' : 'Browse units'}
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ── MY RENTALS (HỒ SƠ THUÊ CỦA TÔI) ───────────────────── */}
      {page === 'rental-records' && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={lang === 'vi' ? 'Hồ Sơ Thuê Kho Của Tôi' : 'My Rentals'}
            subtitle={lang === 'vi' ? 'Hồ sơ thuê thực tế (kích hoạt sau check-in), mã mở cửa và thủ tục trả kho' : 'Active storage profiles, gate access codes and move-out procedures'}
            action={<Button variant="outline" size="sm" onClick={() => setPage(previousPage || 'overview')}>← {lang === 'vi' ? 'Quay lại' : 'Back'}</Button>}
          />

          {visibleMyRentals.length ? (
            <div className="grid gap-4">
              {visibleMyRentals.map(rental => (
                <Card id={`customer-record-${rental.id}`} tabIndex={-1} key={rental.id} className={`overflow-hidden ${rental.status === 'completed' ? 'inactive-record-card border-stone-300 bg-white text-stone-500' : ''} ${focusedNotificationTarget === rental.id ? 'notification-target-reveal' : ''}`}>
                  <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-amber-700">{rental.id}</span>
                        <h2 className="text-lg font-bold text-stone-900">{lang === 'vi' ? `Gian kho ${rental.unitId}` : `Unit ${rental.unitId}`}</h2>
                        {badgeFor(rental.status)}
                        {(() => {
                          const end = parseCustomerDate(rental.endDate)
                          if (!end || rental.status !== 'active') return null
                          const today = new Date(now); today.setHours(0, 0, 0, 0)
                          end.setHours(0, 0, 0, 0)
                          if (today.getTime() <= end.getTime()) return null
                          const overdueDays = Math.floor((today.getTime() - end.getTime()) / 86_400_000)
                          return <span className="inline-flex rounded bg-red-700 px-2.5 py-1 text-xs font-bold text-white">{lang === 'vi' ? `Quá hạn ${overdueDays} ngày` : `${overdueDays} days overdue`}</span>
                        })()}
                      </div>
                      <p className="mt-1 text-sm text-stone-600">{rental.facilityName} · {rental.unitType} ({rental.areaM2} m² · {rental.volumeM3 || 15} m³)</p>
                      <p className="mt-2 text-xs text-stone-400">
                        {lang === 'vi' ? 'Kỳ thuê: ' : 'Term: '} {rental.startDate} → {rental.endDate} · {lang === 'vi' ? 'Hạn đóng cước: ' : 'Next due: '} {rental.nextDue}
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="rounded-md bg-[#292a27] px-3 py-1 text-white font-mono text-xs flex items-center gap-2">
                          <span className="text-stone-400">{lang === 'vi' ? 'Mã mở cổng:' : 'PIN:'}</span>
                          <span className="text-[#e9a12c] font-bold tracking-wider">{rental.gateCode}</span>
                        </div>
                        <span className="text-xs text-stone-500">{lang === 'vi' ? 'Tiền đảm bảo kho:' : 'Storage security deposit:'} <b>{formatVnd(rental.securityDeposit ?? rental.deposit)}</b></span>
                      </div>
                    </div>

                    <div className="md:text-right">
                      <p className="text-2xl font-bold text-stone-900">{formatVnd(rental.monthlyRate)}<span className="text-sm font-normal text-stone-500">/{lang === 'vi' ? 'tháng' : 'month'}</span></p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const matchingHold = holds.find(h => h.id === rental.holdId || h.id === rental.id)
                            if (matchingHold) {
                              setActiveHoldForContract(matchingHold)
                            } else {
                              const rentalStart = parseCustomerDate(rental.startDate)
                              const rentalEnd = parseCustomerDate(rental.endDate)
                              const rentalDurationDays = rentalStart && rentalEnd ? Math.max(1, Math.round((rentalEnd.getTime() - rentalStart.getTime()) / 86_400_000)) : 30
                              const syntheticRentalMonths = Math.max(1, Math.round(rentalDurationDays / 30))
                              const syntheticTermValue = rental.monthlyRate * syntheticRentalMonths
                              const syntheticBookingDeposit = Math.round(syntheticTermValue * 0.2 * 100) / 100
                              const syntheticSecurityDeposit = rental.securityDeposit ?? rental.deposit
                              const syntheticHold: StorageHold = {
                                id: `CTR-${rental.id}`,
                                customerId: rental.customerId,
                                customerName: rental.customerName,
                                customerEmail: rental.customerEmail,
                                customerPhone: user.facility || '+84 908 123 456',
                                identityId: '079203009988',
                                facilityId: rental.facilityId,
                                facilityName: rental.facilityName,
                                unitId: rental.unitId,
                                unitTypeId: rental.unitType.toLowerCase().includes('extra') ? 'xlarge' : rental.unitType.toLowerCase().includes('large') ? 'large' : rental.unitType.toLowerCase().includes('medium') ? 'medium' : 'small',
                                unitTypeName: rental.unitType,
                                assignedUnitId: rental.unitId,
                                rentalMonths: syntheticRentalMonths,
                                startDate: rental.startDate,
                                endDate: rental.endDate,
                                moveInDate: rental.startDate,
                                status: 'checked_in',
                                reservationDepositAmount: syntheticBookingDeposit,
                                securityDepositAmount: syntheticSecurityDeposit,
                                remainingAmount: 0,
                                firstMonthRent: rental.monthlyRate,
                                totalInitialAmount: syntheticTermValue + syntheticSecurityDeposit,
                                goods: {
                                  category: 'Đồ gia dụng & nội thất',
                                  packageCount: 6,
                                  lengthCm: 80,
                                  widthCm: 60,
                                  heightCm: 70,
                                  weightKg: 80,
                                  dimWeightKg: 67,
                                  material: 'Gỗ, nhựa, vải',
                                  condition: rental.initialCondition || 'Tiêu chuẩn',
                                  fragile: false
                                },
                                quote: {
                                  quoteId: `Q-${rental.unitId}`,
                                  unitId: rental.unitId,
                                  facilityId: rental.facilityId,
                                  baseMonthlyPrice: rental.monthlyRate,
                                  depositAmount: syntheticSecurityDeposit,
                                  dimSurcharge: 0,
                                  totalFirstPayment: syntheticTermValue + syntheticSecurityDeposit,
                                  dimWeightKg: 67,
                                  actualWeightKg: 80,
                                  billableWeightKg: 80,
                                  dimDivisor: 5000,
                                  quotedAt: rental.startDate,
                                  expiresAt: rental.endDate
                                },
                                emailVerification: {
                                  token: 'VERIFIED',
                                  verified: true,
                                  sentAt: rental.startDate,
                                  expiresAt: rental.endDate,
                                  attemptCount: 1
                                },
                                payment: {
                                  amount: syntheticBookingDeposit,
                                  status: 'paid',
                                  method: 'Chuyển khoản VietQR',
                                  transactionId: `TX-RNT-${rental.unitId}`,
                                  paidAt: rental.startDate
                                },
                                appointmentDate: rental.startDate,
                                appointmentTime: '10:00 AM',
                                expiresAt: rental.endDate,
                                evidence: rental.evidencePhotos || [],
                                createdAt: rental.startDate
                              }
                              setActiveHoldForContract(syntheticHold)
                            }
                            setContractTab('contract')
                            setContractEmailModalOpen(true)
                          }}
                        >
                          {lang === 'vi' ? 'Hợp đồng thuê' : 'Rental contract'}
                        </Button>

                        {rental.status === 'active' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={renewals.some(item => item.rentalId === rental.id && ['pending', 'approved', 'payment_processing'].includes(item.status))}
                              onClick={() => {
                                setActiveRentalForRenewal(rental)
                                setRenewalMonths(1)
                                setEditingRenewalId(null)
                                setRenewalModalOpen(true)
                              }}
                            >
                               {renewals.some(item => item.rentalId === rental.id && ['pending', 'approved', 'payment_processing'].includes(item.status)) ? (lang === 'vi' ? 'Đang xử lý gia hạn' : 'Renewal in progress') : (lang === 'vi' ? 'Yêu cầu gia hạn' : 'Request renewal')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveRentalForReturn(rental)
                                const todayValue = dateInputValue(new Date())
                                const endValue = parseCustomerDate(rental.endDate) ? dateInputValue(parseCustomerDate(rental.endDate)!) : todayValue
                                setReturnTargetDate(todayValue <= endValue ? todayValue : '')
                                setReturnModalOpen(true)
                              }}
                            >
                               {lang === 'vi' ? 'Yêu cầu trả kho' : 'Request move-out'}
                            </Button>
                          </>
                        )}
                        {rental.status === 'return_requested' && (
                          <Badge variant="warning">{lang === 'vi' ? 'Đã gửi yêu cầu trả kho' : 'Move-out requested'}</Badge>
                        )}
                        {rental.status === 'completed' && (
                          <><span className="inactive-record-alert rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-xs font-bold text-red-800">{lang === 'vi' ? 'Hồ sơ hết hiệu lực · PIN đã thu hồi' : 'Inactive record · PIN revoked'}</span><Button variant="outline" size="sm" onClick={() => { if (!window.confirm(lang === 'vi' ? 'Xóa hồ sơ thuê này khỏi danh sách của bạn? Dữ liệu đối soát vẫn được lưu.' : 'Remove this rental history from your list? Audit data will remain stored.')) return; try { archiveRentalHistory(rental.id, user); showToast(lang === 'vi' ? 'Đã xóa lịch sử hồ sơ thuê khỏi danh sách.' : 'Rental history removed from your list.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử hồ sơ thuê.') } }}><span aria-hidden="true">🗑</span> {lang === 'vi' ? 'Xóa lịch sử' : 'Remove history'}</Button></>
                        )}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const start = parseCustomerDate(rental.startDate)
                    const end = parseCustomerDate(rental.endDate)
                    if (!start || !end || rental.status !== 'active') return null
                    const today = new Date(now); today.setHours(0, 0, 0, 0)
                    end.setHours(0, 0, 0, 0)
                    const remainingDays = Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
                    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000)
                    const reminderWindow = totalDays > 31 ? 30 : 7
                    if (remainingDays < 0) {
                      const overdueDays = Math.abs(remainingDays)
                      const lateFeePerDay = Math.round(((rental.monthlyRate / 30) * 0.5) * 100) / 100
                      const currentLateFee = Math.round(overdueDays * lateFeePerDay * 100) / 100
                      return <div className="border-t border-red-300 bg-red-50 px-5 py-4 text-xs text-red-900"><p className="font-bold">⚠ {lang === 'vi' ? `Hợp đồng đã quá hạn ${overdueDays} ngày` : `Contract overdue by ${overdueDays} days`}</p><p className="mt-1">{lang === 'vi' ? `Hợp đồng đã hết hạn ngày ${rental.endDate}. Phí muộn tạm tính hiện tại: ${overdueDays} ngày × ${formatVnd(lateFeePerDay)} = ${formatVnd(currentLateFee)}. Bạn vẫn có thể gửi yêu cầu gia hạn; phí cuối cùng được tính đến ngày thanh toán hoặc ngày ký hợp đồng gia hạn, tùy ngày nào muộn hơn.` : `The contract expired on ${rental.endDate}. Current estimated late fee: ${overdueDays} days × ${formatVnd(lateFeePerDay)} = ${formatVnd(currentLateFee)}. You may still request renewal; the final fee runs through the later of payment or signing.`}</p></div>
                    }
                    if (remainingDays > reminderWindow) return null
                    return <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-950"><p className="font-bold">⚠ {lang === 'vi' ? 'Hợp đồng sắp hết hạn' : 'Contract expiring soon'}</p><p className="mt-1">{lang === 'vi' ? `Còn ${remainingDays} ngày đến ${rental.endDate}. Vui lòng gửi yêu cầu gia hạn nếu bạn muốn tiếp tục thuê kho.` : `${remainingDays} days remain until ${rental.endDate}. Request an extension to continue the rental.`}</p></div>
                  })()}
                  {!rental.receiptConfirmedAt && rental.status !== 'completed' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-200 bg-blue-50 px-5 py-4 text-xs">
                      <div><p className="font-bold text-blue-950">{lang === 'vi' ? 'Xác nhận bàn giao' : 'Handover confirmation'}</p><p className="mt-0.5 text-blue-800">{lang === 'vi' ? 'Kiểm tra đúng gian kho và mã truy cập trước khi xác nhận.' : 'Verify the assigned unit and access PIN before confirming.'}</p></div>
                      <Button size="sm" onClick={() => { try { confirmUnitReceipt(rental.id, user); showToast(lang === 'vi' ? 'Đã xác nhận nhận kho và mã truy cập.' : 'Unit receipt confirmed.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận bàn giao.') } }}>{lang === 'vi' ? 'Tôi đã nhận kho' : 'Confirm receipt'}</Button>
                    </div>
                  )}
                  {rental.receiptConfirmedAt && <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-semibold text-emerald-800">✓ {lang === 'vi' ? `Đã xác nhận nhận kho lúc ${new Date(rental.receiptConfirmedAt).toLocaleString('vi-VN')}` : 'Unit receipt confirmed'}</div>}
                  {(() => {
                    const rentalRenewals = renewals.filter(r => r.rentalId === rental.id)
                    if (!rentalRenewals.length) return null
                    return <div className="space-y-2 border-t border-stone-200 px-5 py-4">
                      <p className="text-xs font-bold text-stone-900">{lang === 'vi' ? 'Yêu cầu gia hạn' : 'Renewal requests'}</p>
                      {rentalRenewals.map(renewal => {
                        const paymentExpired = renewal.paymentDueAt ? new Date(renewal.paymentDueAt).getTime() <= now : false
                        const contractOverdue = new Date(`${renewal.oldEndDate}T23:59:59`).getTime() < now
                        return <div key={renewal.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-stone-900">{lang === 'vi' ? `Gói gia hạn ${renewal.renewalMonths || 1} tháng` : `${renewal.renewalMonths || 1}-month extension`} · {renewal.oldEndDate} → {renewal.newEndDate}</p>
                              <p className="mt-1 text-stone-500">{renewal.id} · {badgeFor(renewal.status)}</p>
                              {renewal.invoiceNumber && <p className="mt-1 text-stone-600">{lang === 'vi' ? 'Hóa đơn' : 'Invoice'}: <b>{renewal.invoiceNumber}</b></p>}
                              {renewal.status === 'approved' && renewal.paymentDueAt && <p className={`mt-1 font-semibold ${paymentExpired ? 'text-red-700' : 'text-amber-700'}`}>{lang === 'vi' ? 'Hạn thanh toán cọc 72 giờ' : '72-hour deposit deadline'}: {new Date(renewal.paymentDueAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</p>}
                              {renewal.status === 'approved' && renewal.paymentDueAt && !paymentExpired && <p className="mt-1 font-mono text-sm font-extrabold text-red-700">⏱ {lang === 'vi' ? 'Còn lại' : 'Remaining'}: {formatCountdown(renewal.paymentDueAt).text}</p>}
                              {renewal.status === 'approved' && contractOverdue && <p className="mt-1 font-semibold text-red-700">{lang === 'vi' ? 'Hợp đồng cũ đã hết hạn; phí muộn được tính từ ngày kế tiếp ngày hết hạn đến ngày thanh toán/ký thực tế.' : 'The previous contract has expired; late fees run from the following day through actual payment/signing.'}</p>}
                              {renewal.status === 'pending' && <p className="mt-1 text-blue-700">{lang === 'vi' ? 'Bạn có thể sửa hoặc hủy trước khi Manager duyệt. Mọi thay đổi sẽ được ghi nhận cho Manager.' : 'You may edit or cancel before Manager approval. Changes are recorded for Manager.'}</p>}
                              {renewal.updatedAt && <p className="mt-1 text-stone-500">{lang === 'vi' ? 'Cập nhật gần nhất' : 'Last updated'}: {new Date(renewal.updatedAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</p>}
                              {renewal.status === 'payment_expired' && <p className="mt-1 text-red-700">{lang === 'vi' ? 'Yêu cầu đã hết hiệu lực. Hãy gửi yêu cầu mới để Manager kiểm tra lại khả dụng.' : 'This request expired. Submit a new request for availability review.'}</p>}
                              {renewal.status === 'rejected' && renewal.notes && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 font-semibold text-red-800">{lang === 'vi' ? 'Lý do Manager từ chối' : 'Manager rejection reason'}: {renewal.notes}</p>}
                              {renewal.status === 'appointment_scheduled' && <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-900"><p className="font-bold">{lang === 'vi' ? `Đã cọc 20% · Hẹn ký ${renewal.appointmentDate} lúc ${renewal.appointmentTime}` : `20% deposit paid · Signing ${renewal.appointmentDate} at ${renewal.appointmentTime}`}</p><p className="mt-1">{lang === 'vi' ? `Còn thu tại cơ sở: ${formatVnd(renewal.remainingAmount)}${renewal.lateFeeAmount ? ` + phụ thu trễ ${formatVnd(renewal.lateFeeAmount)}` : ''}. Hợp đồng chưa được kéo dài.` : `Due on site: ${formatVnd(renewal.remainingAmount)}${renewal.lateFeeAmount ? ` + ${formatVnd(renewal.lateFeeAmount)} late fee` : ''}. The contract has not yet been extended.`}</p></div>}
                              {renewal.status === 'completed' && <p className="mt-1 text-emerald-700">{lang === 'vi' ? `Phụ lục ${renewal.addendumNumber} · Hiệu lực từ ${renewal.effectiveAt ? new Date(renewal.effectiveAt).toLocaleString('vi-VN') : renewal.paidAt}` : `Addendum ${renewal.addendumNumber} · Effective after verified payment`}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <b>{formatVnd(renewal.totalAmount ?? renewal.renewalFee)}</b>
                              {renewal.status === 'pending' && <><Button variant="outline" size="sm" onClick={() => { setActiveRentalForRenewal(rental); setRenewalMonths(renewal.renewalMonths); setEditingRenewalId(renewal.id); setRenewalModalOpen(true) }}>{lang === 'vi' ? 'Chỉnh sửa' : 'Edit'}</Button><Button variant="outline" size="sm" className="border-red-300 text-red-700" onClick={() => { if (!window.confirm(lang === 'vi' ? 'Bạn chắc chắn muốn hủy yêu cầu gia hạn này?' : 'Cancel this renewal request?')) return; try { cancelRenewalRequest(renewal.id, user); showToast(lang === 'vi' ? 'Đã hủy yêu cầu. Manager đã nhận được cập nhật.' : 'Request cancelled. Manager was notified.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể hủy yêu cầu.') } }}>{lang === 'vi' ? 'Hủy yêu cầu' : 'Cancel request'}</Button></>}
                              {renewal.status === 'approved' && !paymentExpired && <Button size="sm" onClick={() => {
                                setActiveRenewalForPayment(renewal)
                                setRenewalPaymentMethod('BANK_TRANSFER')
                                setRenewalTermsAccepted(false)
                                const suggestedSigningDate = new Date()
                                if (new Date(`${renewal.oldEndDate}T23:59:59`).getTime() >= now) suggestedSigningDate.setDate(suggestedSigningDate.getDate() + 1)
                                setRenewalAppointmentDate(dateInputValue(suggestedSigningDate))
                                setRenewalAppointmentTime('09:00')
                                setRenewalPaymentOpen(true)
                              }}>{lang === 'vi' ? 'Xem hóa đơn & thanh toán' : 'Review invoice & pay'}</Button>}
                              {renewal.status === 'approved' && !paymentExpired && <Button variant="outline" size="sm" className="border-red-300 text-red-700" onClick={() => {
                                if (!window.confirm(lang === 'vi' ? `Hủy yêu cầu đã được duyệt sẽ làm hóa đơn ${renewal.invoiceNumber || ''} mất hiệu lực. Bạn chắc chắn muốn tiếp tục?` : 'Cancelling this approved request will invalidate its invoice. Continue?')) return
                                try {
                                  cancelRenewalRequest(renewal.id, user)
                                  setRenewalPaymentOpen(false)
                                  showToast(lang === 'vi' ? 'Đã hủy gia hạn và vô hiệu hóa hóa đơn. Manager đã nhận được thông báo.' : 'Renewal cancelled and invoice invalidated. Manager was notified.')
                                } catch (error) {
                                  showToast(error instanceof Error ? error.message : 'Không thể hủy yêu cầu gia hạn.')
                                }
                              }}>{lang === 'vi' ? 'Hủy gia hạn' : 'Cancel renewal'}</Button>}
                              {renewal.status === 'appointment_scheduled' && <Button variant="outline" size="sm" className="border-red-300 text-red-700" onClick={() => { if (!window.confirm(lang === 'vi' ? `Hủy sau khi đã cọc sẽ không được hoàn lại ${formatVnd(renewal.bookingDepositAmount ?? 0)}. Manager sẽ nhận được thông báo. Bạn vẫn muốn hủy?` : `The ${formatVnd(renewal.bookingDepositAmount ?? 0)} deposit is non-refundable after cancellation. Continue?`)) return; try { cancelRenewalRequest(renewal.id, user); showToast(lang === 'vi' ? 'Đã hủy gia hạn. Cọc gia hạn không hoàn lại và Manager đã được thông báo.' : 'Renewal cancelled. The deposit is forfeited and Manager was notified.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể hủy gia hạn.') } }}>{lang === 'vi' ? 'Hủy lịch gia hạn' : 'Cancel renewal appointment'}</Button>}
                            </div>
                          </div>
                        </div>
                      })}
                    </div>
                  })()}
                  {(() => {
                    const returnCase = myReturns.find(item => item.rentalId === rental.id)
                    if (!returnCase) return null
                    const totalDeductions = (returnCase.damageFee || 0) + (returnCase.cleaningFee || 0) + (returnCase.lostItemFee || 0) + (returnCase.overdueFee || 0) + (returnCase.outstandingFee || 0)
                    return <div className="border-t border-stone-200 bg-stone-50 px-5 py-4 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-stone-950">{lang === 'vi' ? 'Nghiệm thu và quyết toán trả kho' : 'Return inspection and settlement'}</p><p className="mt-1 text-stone-500">{returnCase.id} · {badgeFor(returnCase.status)}</p></div>{returnCase.refundTransaction && <span className="rounded-lg bg-emerald-100 px-3 py-2 font-bold text-emerald-800">{lang === 'vi' ? 'Đã hoàn cọc' : 'Refunded'} {formatVnd(returnCase.refundTransaction.amount)}</span>}</div>
                      {['awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'].includes(returnCase.status) && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Hiện trạng ban đầu' : 'Initial condition'}</p><p className="mt-1 font-semibold">{returnCase.initialConditionSnapshot}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Kết quả nghiệm thu' : 'Inspection result'}</p><p className="mt-1 font-semibold">{returnCase.damageClassification || '—'} · {returnCase.staffNotes || '—'}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? `Phí quá hạn (${returnCase.overdueDays || 0} ngày)` : `Overdue fee (${returnCase.overdueDays || 0} days)`}</p><p className="mt-1 font-bold text-red-700">{formatVnd(returnCase.overdueFee || 0)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Cọc được hoàn' : 'Net refund'}</p><p className="mt-1 font-bold text-emerald-700">{formatVnd(returnCase.netRefundAmount)}</p></div><div className={`rounded-lg p-3 ${(returnCase.amountDueFromCustomer || 0) > 0 ? 'bg-red-100' : 'bg-white'}`}><p className="text-stone-500">{lang === 'vi' ? 'Khách phải đóng thêm' : 'Additional payment due'}</p><p className="mt-1 font-bold text-red-700">{formatVnd(returnCase.amountDueFromCustomer || 0)}</p></div></div>}
                      {returnCase.evidence.length > 0 && <p className="mt-3 text-stone-600">{lang === 'vi' ? 'Minh chứng' : 'Evidence'}: {returnCase.evidence.join(' · ')}</p>}
                      {returnCase.status === 'awaiting_customer_confirmation' && <div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { const reason = window.prompt(lang === 'vi' ? 'Nhập lý do cần xem xét lại:' : 'Enter dispute reason:'); if (reason !== null) { try { confirmReturnSettlement(returnCase.id, user, 'disputed', reason); showToast(lang === 'vi' ? 'Đã gửi yêu cầu xem xét lại.' : 'Dispute submitted.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu.') } } }}>{lang === 'vi' ? 'Yêu cầu xem xét lại' : 'Dispute settlement'}</Button><Button size="sm" onClick={() => { const due = returnCase.amountDueFromCustomer || 0; if (window.confirm(lang === 'vi' ? (due > 0 ? `Tổng phí vượt tiền đảm bảo. Xác nhận quyết toán và tiếp tục đóng thêm ${formatVnd(due)}?` : `Xác nhận quyết toán và yêu cầu hoàn cọc ${formatVnd(returnCase.netRefundAmount)}?`) : 'Accept this settlement?')) { try { confirmReturnSettlement(returnCase.id, user, 'accepted'); showToast(due > 0 ? (lang === 'vi' ? `Đã xác nhận. Vui lòng thanh toán thêm ${formatVnd(due)}.` : `Confirmed. Please pay the additional ${formatVnd(due)}.`) : (lang === 'vi' ? 'Đã xác nhận quyết toán. Hồ sơ và PIN đã hết hiệu lực; đang chờ Staff chuyển hoàn cọc.' : 'Settlement accepted. The rental and PIN are inactive; refund transfer is pending.')) } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận quyết toán.') } } }}>{lang === 'vi' ? 'Đồng ý quyết toán' : 'Accept settlement'}</Button></div>}
                      {returnCase.status === 'payment_due' && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3"><div><p className="font-bold text-red-900">{lang === 'vi' ? `Cần thanh toán thêm ${formatVnd(returnCase.amountDueFromCustomer ?? 0)}` : `Additional payment required: ${formatVnd(returnCase.amountDueFromCustomer ?? 0)}`}</p><p className="mt-1 text-red-700">{lang === 'vi' ? 'Sau khi thanh toán, hệ thống sẽ đóng hồ sơ và phát hành biên nhận trong Lịch sử thanh toán.' : 'After payment, the record closes and a receipt appears in Payment History.'}</p></div><Button size="sm" onClick={() => { const reference = `RET-BAL-${Date.now()}`; if (!window.confirm(lang === 'vi' ? `Thanh toán ${formatVnd(returnCase.amountDueFromCustomer ?? 0)} bằng chuyển khoản?` : `Pay ${formatVnd(returnCase.amountDueFromCustomer ?? 0)} by bank transfer?`)) return; try { payReturnBalance(returnCase.id, user, 'BANK_TRANSFER', reference); showToast(lang === 'vi' ? 'Đã thanh toán phần thiếu và phát hành biên nhận.' : 'Additional balance paid and receipt issued.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể thanh toán.') } }}>{lang === 'vi' ? 'Thanh toán phần thiếu' : 'Pay additional balance'}</Button></div>}
                      {returnCase.status === 'disputed' && <p className="mt-3 rounded-lg bg-amber-100 p-3 font-semibold text-amber-900">{lang === 'vi' ? 'Đang chờ Facility Manager xem xét lại' : 'Awaiting Facility Manager review'}: {returnCase.customerDecisionNote}</p>}
                      {returnCase.status === 'refund_pending' && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">{lang === 'vi' ? 'Hồ sơ thuê và mã PIN đã hết hiệu lực. Staff đang chuyển hoàn cọc; biên nhận sẽ xuất hiện sau khi xác nhận giao dịch.' : 'The rental and PIN are inactive. Staff is processing the refund; a receipt appears after transaction confirmation.'}</p>}
                      {rental.status === 'completed' && units.find(unit => unit.id === rental.unitId)?.status === 'maintenance' && <p className="mt-3 rounded-lg border border-stone-300 bg-stone-100 p-3 font-semibold text-stone-700">{lang === 'vi' ? 'Gian kho đang chờ Manager nghiệm thu vệ sinh/bảo trì. Kho chưa được tính vào số lượng còn trống.' : 'The unit is awaiting Manager inspection/maintenance and is not counted as available yet.'}</p>}
                    </div>
                  })()}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto w-fit text-stone-300">{Icon.key}</div>
              <h2 className="mt-3 font-semibold text-stone-700">{lang === 'vi' ? 'Chưa có hồ sơ thuê nào đang hoạt động' : 'No active rentals'}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {lang === 'vi' ? 'Hồ sơ thuê chỉ được tạo sau khi đơn giữ kho được nhân viên bàn giao thành công.' : 'Rental profiles are activated after staff handover and check-in.'}
              </p>
              <Button className="mt-4" size="sm" onClick={() => navigateTo('browse-units')}>
                {lang === 'vi' ? 'Tìm gian kho trống' : 'Find a unit'}
              </Button>
            </Card>
          )}
        </div>
      )}

      {page === 'contracts' && <div className="fade-in space-y-4">
        <SectionHeader title={lang === 'vi' ? 'Hợp đồng của tôi' : 'My Contracts'} subtitle={lang === 'vi' ? 'Bản scan hợp đồng giấy đã ký tại cơ sở' : 'Signed paper contract scans from the facility'} />
        {visibleMyContracts.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleMyContracts.map(c => {
          const contractRental = myRentals.find(rental => rental.contractId === c.id || rental.holdId === c.reservationId)
          const contractInactive = contractRental?.status === 'completed'
          return <Card key={c.id} className={`overflow-hidden p-0 text-sm ${contractInactive ? 'inactive-record-card border-stone-300 bg-white text-stone-500' : ''}`}>
          <div className="aspect-[3/4] bg-stone-200 p-5">
            <div className="flex h-full flex-col bg-white px-6 py-8 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-black">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
              <p className="mt-1 text-[9px] font-semibold text-black">Độc lập – Tự do – Hạnh phúc</p>
              <div className="my-5 border-t border-black" />
              <p className="text-base font-bold text-black">HỢP ĐỒNG THUÊ KHO</p>
              <p className="mt-2 text-xs font-bold text-black">{c.contractNumber}</p>
              <div className="mt-8 space-y-2 text-left">{[80, 100, 92, 100, 72, 95, 85].map((width, index) => <div key={index} className="h-1 rounded bg-stone-300" style={{ width: `${width}%` }} />)}</div>
              <p className="mt-auto text-[9px] text-stone-500">{lang === 'vi' ? 'Ảnh xem trước hồ sơ hợp đồng' : 'Contract document preview'}</p>
            </div>
          </div>
          <div className="space-y-2 p-4 text-black">
            <div className="flex items-center justify-between gap-3"><div><p className="font-bold">{c.contractNumber}</p>{c.contractType === 'RENEWAL' && <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{lang === 'vi' ? 'Hợp đồng gia hạn' : 'Renewal contract'}</p>}</div><span className="rounded border border-black px-2 py-0.5 text-xs font-semibold">{c.status}</span></div>
            <p>{lang === 'vi' ? 'Ngày ký' : 'Signed'}: {c.signedAt}</p><p>{lang === 'vi' ? 'Hiệu lực' : 'Term'}: {c.startDate} – {c.endDate}</p>
            <p className="truncate text-stone-600">{c.scannedFileName}</p>
            <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-3"><a href={c.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-black">{lang === 'vi' ? 'Xem bản scan' : 'View scan'}</a><a href={c.scannedFileUrl} download={c.scannedFileName} className="font-bold underline text-black">{lang === 'vi' ? 'Tải xuống' : 'Download'}</a>{contractInactive && <Button variant="outline" size="sm" onClick={() => { if (!window.confirm(lang === 'vi' ? 'Xóa hợp đồng hết hiệu lực này khỏi danh sách của bạn? Bản lưu đối soát vẫn được giữ.' : 'Remove this inactive contract from your list? The audit copy will remain stored.')) return; try { archiveContractHistory(c.id, user); showToast(lang === 'vi' ? 'Đã xóa hợp đồng khỏi danh sách.' : 'Contract removed from your list.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử hợp đồng.') } }}><span aria-hidden="true">🗑</span> {lang === 'vi' ? 'Xóa lịch sử' : 'Remove history'}</Button>}</div>
          </div>
        </Card>})}</div> : <Card className="p-4 text-sm text-stone-500">{lang === 'vi' ? 'Chưa có hợp đồng giấy đã ký. Hợp đồng sẽ xuất hiện sau khi nhân viên lưu bản scan.' : 'No signed paper contract scan yet.'}</Card>}
      </div>}

      {/* ── PAYMENTS ─────────────────────────────────────────── */}
      {page === 'payments' && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={lang === 'vi' ? 'Lịch Sử Thanh Toán & Quyết Toán' : 'Payments & Billing'}
            subtitle={lang === 'vi' ? 'Hóa đơn tiền thuê, phí giữ kho và quyết toán hoàn cọc' : 'Invoices, deposits and return settlement receipts'}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-stone-500">{lang === 'vi' ? 'Đã thanh toán' : 'Total paid'}</p><p className="mt-1 text-2xl font-extrabold text-stone-950">{formatVnd(myPayments.filter(p => p.type !== 'REFUND' && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0))}</p></Card>
            <Card className="p-4"><p className="text-xs text-stone-500">{lang === 'vi' ? 'Đã hoàn cọc' : 'Refunded'}</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{formatVnd(myPayments.filter(p => p.type === 'REFUND' && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0))}</p></Card>
            <Card className="p-4"><p className="text-xs text-stone-500">{lang === 'vi' ? 'Gia hạn chờ thanh toán' : 'Renewals awaiting payment'}</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{renewals.filter(r => r.customerId === user.id && r.status === 'approved').length}</p></Card>
          </div>

          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Mã Giao Dịch' : 'Reference'}</Th>
                  <Th>{lang === 'vi' ? 'Gian Kho' : 'Unit'}</Th>
                  <Th>{lang === 'vi' ? 'Nội Dung' : 'Description'}</Th>
                  <Th>{lang === 'vi' ? 'Phương Thức' : 'Method'}</Th>
                  <Th>{lang === 'vi' ? 'Số Tiền' : 'Amount'}</Th>
                  <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {myPayments.map(payment => {
                  const rental = myRentals.find(r => r.id === payment.rentalId)
                  const hold = myHolds.find(h => h.id === payment.reservationId)
                  const labels: Record<string, string> = lang === 'vi' ? { RESERVATION_DEPOSIT: 'Cọc giữ chỗ 20%', INITIAL_RENT: 'Phần còn lại tại cơ sở', RENEWAL: 'Thanh toán gia hạn', DAMAGE_FEE: 'Thanh toán quyết toán trả kho', REFUND: 'Hoàn cọc sau quyết toán' } : { RESERVATION_DEPOSIT: '20% reservation deposit', INITIAL_RENT: 'On-site balance', RENEWAL: 'Renewal payment', DAMAGE_FEE: 'Move-out settlement payment', REFUND: 'Deposit refund' }
                  return <Tr key={payment.id}><Td><span className="font-mono text-xs text-stone-600">{payment.transactionReference || payment.id}</span><p className="mt-0.5 text-[10px] text-stone-400">{payment.paidAt ? new Date(payment.paidAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : '—'}</p></Td><Td><b>{rental?.unitId || hold?.assignedUnitId || hold?.unitTypeName || '—'}</b><p className="text-[10px] text-stone-400">{rental?.facilityName || hold?.facilityName}</p></Td><Td>{labels[payment.type] || payment.type}</Td><Td><span className="text-xs text-stone-500">{payment.paymentMethod || '—'}</span></Td><Td><b className={payment.type === 'REFUND' ? 'text-emerald-700' : 'text-stone-950'}>{payment.type === 'REFUND' ? '+' : ''}{formatVnd(payment.amount)}</b></Td><Td><span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${payment.status === 'PAID' ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{payment.status === 'PAID' ? (lang === 'vi' ? 'Hoàn tất' : 'Completed') : (lang === 'vi' ? 'Đang xử lý' : 'Pending')}</span></Td></Tr>
                })}
                {!myPayments.length && <tr><td colSpan={6}><p className="py-6 text-center text-sm text-stone-500">{lang === 'vi' ? 'Chưa có giao dịch nào.' : 'No transactions yet.'}</p></td></tr>}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── SUPPORT ─────────────────────────────────────────── */}
      {page === 'support' && (() => {
        const categoryLabels: Record<string, string> = {
          'Access & Entry': lang === 'vi' ? 'Ra vào & mã PIN' : 'Access & Entry',
          'Billing & Invoices': lang === 'vi' ? 'Thanh toán & hóa đơn' : 'Billing & Invoices',
          'Unit Condition': lang === 'vi' ? 'Hiện trạng gian kho' : 'Unit Condition',
          'General Inquiry': lang === 'vi' ? 'Tư vấn chung' : 'General Inquiry'
        }
        const tabOptions = [
          { value: 'All', label: lang === 'vi' ? 'Tất cả' : 'All', count: myTickets.length },
          { value: 'open', label: lang === 'vi' ? 'Chờ tiếp nhận' : 'Open', count: myTickets.filter(t => t.status === 'open').length },
          { value: 'in-progress', label: lang === 'vi' ? 'Đang xử lý' : 'In progress', count: myTickets.filter(t => t.status === 'in-progress').length },
          { value: 'resolved', label: lang === 'vi' ? 'Đã giải quyết' : 'Resolved', count: myTickets.filter(t => t.status === 'resolved').length }
        ]
        const formatTicketTime = (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
        }
        const filteredTickets = myTickets.filter(t => {
          const matchTab =
            supportTab === 'All' ||
            (supportTab === 'open' && t.status === 'open') ||
            (supportTab === 'in-progress' && t.status === 'in-progress') ||
            (supportTab === 'resolved' && t.status === 'resolved')
          const query = supportSearch.toLowerCase().trim()
          return matchTab && (!query || t.subject.toLowerCase().includes(query) || t.id.toLowerCase().includes(query))
        }).sort((a, b) => new Date(b.updatedAt || b.created).getTime() - new Date(a.updatedAt || a.created).getTime())

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={lang === 'vi' ? 'Tổng Đài Hỗ Trợ Khách Hàng' : 'Customer Support Desk'}
              subtitle={lang === 'vi' ? 'Gửi yêu cầu đổi mã PIN, hỏi cước phí hoặc xử lý sự cố ra vào kho' : 'Submit questions, report keypad glitches or request assistance'}
              action={
                <Button size="sm" onClick={() => setTicketOpen(true)}>
                  {Icon.plus} {lang === 'vi' ? 'Tạo yêu cầu mới' : 'New Request'}
                </Button>
              }
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4"><p className="text-xs text-stone-500">{lang === 'vi' ? 'Tổng yêu cầu' : 'Total requests'}</p><p className="mt-1 text-2xl font-extrabold">{myTickets.length}</p></Card>
              <Card className="p-4"><p className="text-xs text-stone-500">{lang === 'vi' ? 'Đang cần xử lý' : 'Needs attention'}</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{myTickets.filter(t => t.status !== 'resolved').length}</p></Card>
              <Card className="p-4"><p className="text-xs text-stone-500">{lang === 'vi' ? 'Đã giải quyết' : 'Resolved'}</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{myTickets.filter(t => t.status === 'resolved').length}</p></Card>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {tabOptions.map(tab => <button key={tab.value} type="button" onClick={() => setSupportTab(tab.value)} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${supportTab === tab.value ? 'border-amber-500 bg-amber-500 text-stone-950 shadow-sm' : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300'}`}>{tab.label} <span className={`ml-1 rounded-full px-1.5 py-0.5 ${supportTab === tab.value ? 'bg-white/60' : 'bg-stone-100'}`}>{tab.count}</span></button>)}
              </div>
              <input
                type="text"
                placeholder={lang === 'vi' ? 'Tìm phiếu...' : 'Search tickets...'}
                value={supportSearch}
                onChange={e => setSupportSearch(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm xl:w-80"
              />
            </div>

            <div className="space-y-3">
              {filteredTickets.map(ticket => {
                const latestMessage = ticket.messages[ticket.messages.length - 1]
                const priorityLabel = ticket.priority === 'high' ? (lang === 'vi' ? 'Ảnh hưởng cao' : 'High impact') : ticket.priority === 'medium' ? (lang === 'vi' ? 'Ảnh hưởng vừa' : 'Medium impact') : (lang === 'vi' ? 'Ảnh hưởng thấp' : 'Low impact')
                return <Card id={`customer-record-${ticket.id}`} tabIndex={-1} key={ticket.id} className={`overflow-hidden ${focusedNotificationTarget === ticket.id ? 'notification-target-reveal' : ''}`}>
                  <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-amber-700">{ticket.id}</span>{badgeFor(ticket.status)}<Badge variant={ticket.priority === 'high' ? 'error' : ticket.priority === 'medium' ? 'warning' : 'muted'}>{priorityLabel}</Badge></div>
                      <h2 className="mt-2 text-base font-bold text-stone-950">{ticket.subject}</h2>
                      <p className="mt-1 text-xs text-stone-500">{categoryLabels[ticket.category] || ticket.category} · {ticket.facility}{ticket.unit && ticket.unit !== '—' ? ` · ${ticket.unit}` : ''}</p>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          { label: lang === 'vi' ? 'Đã gửi yêu cầu' : 'Submitted', done: true, current: ticket.status === 'open' },
                          { label: lang === 'vi' ? 'Staff đang xử lý' : 'Staff processing', done: ticket.status !== 'open', current: ticket.status === 'in-progress' },
                          { label: lang === 'vi' ? 'Xử lý thành công' : 'Resolved', done: ticket.status === 'resolved', current: ticket.status === 'resolved' }
                        ].map((step, index) => <div key={step.label} className={`rounded-lg border px-3 py-2 text-center text-[11px] font-bold ${step.current ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm' : step.done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-50 text-stone-400'}`}><span className="block text-sm">{step.done ? '✓' : index + 1}</span>{step.label}</div>)}
                      </div>
                      {latestMessage && <div className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600"><b>{latestMessage.role === 'staff' ? (lang === 'vi' ? 'Staff phản hồi:' : 'Staff replied:') : (lang === 'vi' ? 'Bạn:' : 'You:')}</b> <span className="line-clamp-1">{latestMessage.text}</span></div>}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end"><p className="text-xs text-stone-400">{formatTicketTime(ticket.updatedAt || ticket.created)}</p>{ticket.assignedStaff && <p className="text-xs text-stone-500">{lang === 'vi' ? 'Phụ trách' : 'Assigned'}: <b>{ticket.assignedStaff}</b></p>}<Button variant="outline" size="sm" onClick={() => { setSelectedTicket(ticket); setConversationOpen(true) }}>{lang === 'vi' ? 'Mở trao đổi' : 'Open conversation'} · {ticket.messages.length}</Button></div>
                  </div>
                </Card>
              })}
              {!filteredTickets.length && <Card className="p-10 text-center"><p className="font-semibold text-stone-700">{lang === 'vi' ? 'Không có yêu cầu phù hợp' : 'No matching requests'}</p><p className="mt-1 text-sm text-stone-500">{lang === 'vi' ? 'Thử đổi bộ lọc hoặc tạo một yêu cầu hỗ trợ mới.' : 'Change the filters or create a new support request.'}</p></Card>}
            </div>
          </div>
        )
      })()}

      {/* ── POLICIES PAGE ─────────────────────────────────────── */}
      {page === 'policies' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            title={lang === 'vi' ? 'Quy Định & Chính Sách Thuê Kho' : 'Rental Policies & Tenant Handbook'}
            subtitle={lang === 'vi' ? 'Quy định về thuê kho, Check-in, gia hạn, trả kho, thanh toán và xử lý trễ hạn' : 'Rules for rentals, check-in, renewals, returns, payments and late handling'}
          />

          <div className="overflow-hidden rounded-2xl bg-[#292a27] text-white shadow-lg">
            <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-400">StorageHub</p><h2 className="mt-2 text-xl font-bold">{lang === 'vi' ? 'Quy trình thuê kho và thanh toán rõ ràng' : 'Clear rental and payment process'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-300">{lang === 'vi' ? 'Mỗi giai đoạn đều có thời hạn, khoản thanh toán và điều kiện hoàn tất cụ thể để khách hàng chủ động theo dõi.' : 'Each stage has a clear deadline, payment and completion requirement for customers to follow.'}</p></div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-white/10 px-4 py-3"><b className="block text-lg text-amber-400">30</b>{lang === 'vi' ? 'phút tạm giữ' : 'minute hold'}</div><div className="rounded-xl bg-white/10 px-4 py-3"><b className="block text-lg text-amber-400">12</b>{lang === 'vi' ? 'giờ trả cọc' : 'hours to deposit'}</div><div className="rounded-xl bg-white/10 px-4 py-3"><b className="block text-lg text-amber-400">14</b>{lang === 'vi' ? 'ngày check-in' : 'days to check in'}</div></div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="border-b border-amber-200 px-5 py-4 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-800">{lang === 'vi' ? 'Hiểu đúng các khoản tiền' : 'Understand every payment'}</p>
              <h2 className="mt-1 text-lg font-bold text-stone-950">{lang === 'vi' ? 'Cọc giữ chỗ và tiền đảm bảo kho là hai khoản khác nhau' : 'The booking deposit and storage security deposit are different'}</h2>
            </div>
            <div className="grid gap-px bg-amber-200 md:grid-cols-3">
              <div className="bg-white p-5"><p className="text-sm font-bold text-blue-800">{lang === 'vi' ? '1. Cọc giữ chỗ 20%' : '1. 20% booking deposit'}</p><p className="mt-2 text-sm leading-6 text-stone-600">{lang === 'vi' ? 'Tính trên toàn bộ tiền thuê của kỳ đã chọn. Khoản này được trừ vào tiền thuê, không cộng thêm vào giá thuê và không hoàn nếu khách hủy trước Check-in.' : 'Calculated from the full selected rental term. It is credited toward rent, not added to it, and is non-refundable when the customer cancels before check-in.'}</p></div>
              <div className="bg-white p-5"><p className="text-sm font-bold text-emerald-800">{lang === 'vi' ? '2. Tiền đảm bảo kho' : '2. Storage security deposit'}</p><p className="mt-2 text-sm leading-6 text-stone-600">{lang === 'vi' ? 'Bằng một tháng tiền thuê và được thu riêng tại Check-in. Đây không phải tiền thuê; khoản còn lại được hoàn sau khi trả kho và hoàn tất nghiệm thu.' : 'Equal to one month of rent and collected separately at check-in. It is not rent; the remaining amount is refunded after return inspection.'}</p></div>
              <div className="bg-white p-5"><p className="text-sm font-bold text-amber-800">{lang === 'vi' ? '3. Số tiền thu tại Check-in' : '3. Amount due at check-in'}</p><p className="mt-2 text-sm leading-6 text-stone-600">{lang === 'vi' ? 'Tiền thuê còn lại sau khi trừ cọc giữ chỗ + tiền đảm bảo kho. Mọi khoản thu phải có mã giao dịch hoặc biên nhận trong hồ sơ.' : 'Remaining rent after the booking deposit + storage security deposit. Every collection must have a transaction reference or receipt in the customer record.'}</p></div>
            </div>
            <div className="px-5 py-3 text-sm font-semibold text-amber-950 sm:px-6">{lang === 'vi' ? 'Công thức: Tổng cần chuẩn bị = Tổng tiền thuê kỳ đầu + Tiền đảm bảo kho. Cọc giữ chỗ 20% chỉ là phần trả trước của tiền thuê.' : 'Formula: Initial amount = full first-term rent + storage security deposit. The 20% booking deposit is only prepaid rent.'}</div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-extrabold text-amber-800">1</span><div><h3 className="font-bold text-stone-950">{lang === 'vi' ? 'Thuê kho và thanh toán ban đầu' : 'Rental and initial payment'}</h3><p className="text-xs text-stone-500">{lang === 'vi' ? 'Từ lúc chọn kho đến khi xác nhận đặt giữ' : 'From unit selection to reservation confirmation'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              lang === 'vi' ? 'Suất theo cỡ kho được tạm giữ 30 phút trong lúc hoàn tất khai báo.' : 'The selected size is held for 30 minutes while the declaration is completed.',
              lang === 'vi' ? 'Sau khi tạo đơn, khách có 12 giờ để thanh toán cọc giữ chỗ bằng 20% tổng giá trị kỳ thuê.' : 'After booking, the customer has 12 hours to pay a 20% reservation deposit.',
              lang === 'vi' ? 'Cọc giữ chỗ được trừ vào tiền thuê; nếu khách hủy trước Check-in thì khoản này không được hoàn.' : 'The booking deposit is credited toward rent and is non-refundable if the customer cancels before check-in.',
              lang === 'vi' ? 'Đơn tự hết hiệu lực nếu không thanh toán cọc giữ chỗ trong 12 giờ.' : 'The reservation automatically expires if the booking deposit is not paid within 12 hours.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-emerald-700">✓</span><span>{item}</span></p>)}</div></Card>

            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-extrabold text-blue-800">2</span><div><h3 className="font-bold text-stone-950">{lang === 'vi' ? 'Check-in và nhận kho' : 'Check-in and unit receipt'}</h3><p className="text-xs text-stone-500">{lang === 'vi' ? 'Hoàn tất trong thời hạn nhận kho' : 'Complete within the check-in period'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              lang === 'vi' ? 'Khách đặt lịch và hoàn tất Check-in trong tối đa 14 ngày kể từ ngày cọc.' : 'The customer schedules and completes check-in within 14 days of deposit payment.',
              lang === 'vi' ? 'Khi Check-in, khách hoàn tất hợp đồng và xác nhận hiện trạng gian kho trước khi nhận quyền truy cập.' : 'At check-in, the customer completes the contract and confirms the unit condition before receiving access.',
              lang === 'vi' ? 'Khoản phải trả tại Check-in gồm tiền thuê còn lại sau khi trừ cọc giữ chỗ và tiền đảm bảo kho bằng một tháng tiền thuê.' : 'Payment due at check-in includes the remaining rent after the booking deposit plus a one-month storage security deposit.',
              lang === 'vi' ? 'Check-in chỉ hoàn tất sau khi các khoản đến hạn đã được thanh toán và khách xác nhận nhận đúng gian kho.' : 'Check-in is complete only after all due amounts are paid and the customer confirms receipt of the correct unit.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-blue-700">✓</span><span>{item}</span></p>)}</div></Card>

            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-extrabold text-emerald-800">3</span><div><h3 className="font-bold text-stone-950">{lang === 'vi' ? 'Gia hạn thuê kho' : 'Rental renewal'}</h3><p className="text-xs text-stone-500">{lang === 'vi' ? 'Hoàn tất trước khi kỳ thuê mới có hiệu lực' : 'Complete before the new term takes effect'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              lang === 'vi' ? 'Khách gửi yêu cầu, chọn số tháng muốn gia hạn và theo dõi trạng thái xác nhận trên hồ sơ thuê.' : 'The customer submits a request, selects the renewal term and tracks confirmation in the rental record.',
              lang === 'vi' ? 'Khi yêu cầu được chấp thuận, khách thanh toán trước 20% giá trị kỳ gia hạn trong thời hạn hiển thị.' : 'Once the request is accepted, the customer pays 20% of the renewal value within the displayed deadline.',
              lang === 'vi' ? 'Khách thanh toán 80% còn lại và hoàn tất phụ lục trước khi kỳ gia hạn có hiệu lực.' : 'The customer pays the remaining 80% and completes the addendum before the renewal takes effect.',
              lang === 'vi' ? 'Nếu quá hạn thanh toán, yêu cầu gia hạn hết hiệu lực và khách cần gửi yêu cầu mới.' : 'If payment is late, the renewal request expires and a new request must be submitted.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-emerald-700">✓</span><span>{item}</span></p>)}</div></Card>

            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 font-extrabold text-violet-800">4</span><div><h3 className="font-bold text-stone-950">{lang === 'vi' ? 'Trả kho và hoàn tiền đảm bảo' : 'Return and security-deposit refund'}</h3><p className="text-xs text-stone-500">{lang === 'vi' ? 'Quyết toán khi kết thúc thuê' : 'Settlement at the end of the rental'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              lang === 'vi' ? 'Khách gửi yêu cầu trả kho và hoàn tất bàn giao theo lịch đã xác nhận.' : 'The customer submits a return request and completes handover at the confirmed time.',
              lang === 'vi' ? 'Gian kho phải được dọn trống; hiện trạng và các khoản còn phải thanh toán được ghi nhận khi trả kho.' : 'The unit must be emptied; its condition and any outstanding amounts are recorded at return.',
              lang === 'vi' ? 'Tiền đảm bảo kho được hoàn sau khi trừ các khoản hư hại, vệ sinh, thất lạc, trễ hạn hoặc công nợ đã xác nhận.' : 'The security deposit is refunded after confirmed damage, cleaning, loss, late and outstanding charges are deducted.',
              lang === 'vi' ? 'Việc trả kho hoàn tất khi quyết toán được xác nhận, tiền hoàn được xử lý và quyền truy cập kho chấm dứt.' : 'Return is complete once settlement is confirmed, the refund is processed and unit access ends.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-violet-700">✓</span><span>{item}</span></p>)}</div></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-rose-200 p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-rose-700">{lang === 'vi' ? 'Quy định trễ hạn' : 'Late rules'}</p><h3 className="mt-2 font-bold text-stone-950">{lang === 'vi' ? 'Thời hạn và phụ thu được tính theo từng giai đoạn' : 'Deadlines and late charges apply by stage'}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600"><li>• {lang === 'vi' ? 'Quá 12 giờ chưa thanh toán cọc giữ chỗ: đơn thuê hết hiệu lực.' : 'Booking deposit unpaid after 12 hours: the reservation expires.'}</li><li>• {lang === 'vi' ? 'Quá 14 ngày kể từ ngày cọc mà chưa Check-in: không thể kích hoạt hồ sơ thuê và cọc giữ chỗ không được hoàn.' : 'No check-in within 14 days of the deposit: the rental cannot be activated and the booking deposit is non-refundable.'}</li><li>• {lang === 'vi' ? 'Hợp đồng quá hạn không có thời gian ân hạn; từ ngày sau ngày hết hạn, phụ thu mỗi ngày bằng 50% đơn giá thuê ngày.' : 'There is no grace period after contract expiry; each late day is charged at 50% of the daily rent.'}</li><li>• {lang === 'vi' ? 'Gia hạn hợp đồng đã quá hạn phải hoàn tất trong 3 ngày kể từ khi thanh toán cọc gia hạn.' : 'An overdue-contract renewal must be completed within 3 days of the renewal deposit.'}</li></ul></Card>
            <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">{lang === 'vi' ? 'Tóm tắt thanh toán' : 'Payment summary'}</p><h3 className="mt-2 font-bold text-stone-950">{lang === 'vi' ? 'Khoản phải trả theo từng mốc' : 'Amounts due at each milestone'}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600"><li>• {lang === 'vi' ? 'Đặt giữ: 20% tổng tiền thuê của kỳ đầu.' : 'Reservation: 20% of the first-term rent.'}</li><li>• {lang === 'vi' ? 'Check-in: 80% tiền thuê còn lại + tiền đảm bảo kho bằng một tháng tiền thuê.' : 'Check-in: remaining 80% rent + a security deposit equal to one month of rent.'}</li><li>• {lang === 'vi' ? 'Gia hạn: trả trước 20%, sau đó thanh toán 80% còn lại trước khi gia hạn có hiệu lực.' : 'Renewal: 20% upfront, then the remaining 80% before the renewal takes effect.'}</li><li>• {lang === 'vi' ? 'Trả kho: thanh toán công nợ và phí phát sinh; phần tiền đảm bảo còn lại được hoàn.' : 'Return: pay outstanding balances and applicable charges; the remaining security deposit is refunded.'}</li></ul></Card>
          </div>
        </div>
      )}

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

      {/* ── MODAL 1: UNIT DETAILS ─────────────────────────────── */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="xl"
        title={selectedTarget ? (lang === 'vi' ? `Hồ Sơ Kỹ Thuật: ${selectedTarget.unitType.name} · ${selectedTarget.facility.name}` : `Technical Specifications: ${selectedTarget.unitType.name} · ${selectedTarget.facility.name}`) : (selectedUnit ? (lang === 'vi' ? `Hồ Sơ Kỹ Thuật & Chi Tiết Cỡ Kho` : `Technical Specifications`) : '')}
      >
        {selectedUnit && (() => {
          const areaM2 = selectedUnit.areaM2
          const capacityDetails =
            areaM2 <= 5
              ? {
                  boxes: lang === 'vi' ? '25 – 35 thùng carton tiêu chuẩn (60×40×40cm)' : '25 – 35 standard boxes',
                  items: lang === 'vi' ? '20–30 thùng hàng, 1 xe máy, vali đồ cá nhân, thiết bị gia đình nhỏ, hồ sơ tài liệu' : '20–30 cargo boxes, 1 motorcycle, suitcases, small household gear, file archives',
                  fit: lang === 'vi' ? 'Tương đương thể tích thùng xe bán tải / xe van 1.0 tấn' : 'Equivalent to 1.0-ton van / pickup truck capacity'
                }
              : areaM2 <= 10
              ? {
                  boxes: lang === 'vi' ? '50 – 70 thùng carton tiêu chuẩn (60×40×40cm)' : '50 – 70 standard boxes',
                  items: lang === 'vi' ? 'Bàn ghế, tủ kệ gia đình (sofa, tủ lạnh, máy giặt), tồn kho shop bán lẻ, thiết bị văn phòng' : 'Home furniture (sofa, fridge, washer), retail store inventory, office equipment',
                  fit: lang === 'vi' ? 'Tương đương thể tích thùng xe tải chở hàng 1.5 – 2.0 tấn' : 'Equivalent to 1.5–2.0 ton cargo truck capacity'
                }
              : areaM2 <= 20
              ? {
                  boxes: lang === 'vi' ? '100 – 150 thùng carton tiêu chuẩn (60×40×40cm)' : '100 – 150 standard boxes',
                  items: lang === 'vi' ? 'Toàn bộ đồ đạc dọn nhà, hàng tồn kho thương mại điện tử, lưu trữ chứng từ doanh nghiệp' : 'Full home moving contents, e-commerce business inventory, company archives',
                  fit: lang === 'vi' ? 'Tương đương thể tích 2 xe tải chở hàng 2.5 tấn' : 'Equivalent to two 2.5-ton moving trucks'
                }
              : {
                  boxes: lang === 'vi' ? '150 – 250+ thùng hàng hoặc 6–10 pallet tiêu chuẩn' : '150 – 250+ boxes or 6–10 standard pallets',
                  items: lang === 'vi' ? 'Pallet hàng hóa thương mại, máy móc công nghiệp, vật tư sự kiện, thiết bị cơ điện' : 'Commercial pallets, industrial machinery, event supplies, mechanical equipment',
                  fit: lang === 'vi' ? 'Tương đương thùng xe container 20 feet' : 'Equivalent to a 20ft shipping container'
                }

          return (
            <div className="flex flex-col gap-5">
              {/* Top Banner */}
              <div className="order-1 rounded-2xl bg-gradient-to-br from-[#242521] to-[#3a3b37] p-5 text-white shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-[.1em] text-[#e9a12c]">
                    {selectedTarget ? `${selectedTarget.facility.name} · ${selectedTarget.facility.address}` : selectedUnit.facilityName}
                  </p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${selectedUnit.status === 'available' ? 'border-white text-white' : 'border-red-700 bg-red-700 text-white'}`}>{selectedUnit.status === 'available' ? (lang === 'vi' ? 'Còn suất theo cỡ kho' : 'Size available') : (lang === 'vi' ? 'Cỡ kho đã hết chỗ' : 'Sold out')}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold">{selectedTarget ? selectedTarget.unitType.name : selectedUnit.type}</h3>
                    <p className="text-sm text-stone-300 mt-1">
                      {lang === 'vi' ? `Diện tích sàn: ${areaM2} m² · Thể tích vật lý: ${selectedUnit.volumeM3} m³` : `Floor area: ${areaM2} m² · Physical volume: ${selectedUnit.volumeM3} m³`}
                    </p>
                    <p className="mt-1 text-sm text-stone-300">{lang === 'vi' ? 'Kích thước lọt lòng' : 'Internal dimensions'}: {selectedUnit.dimensions.lengthM} × {selectedUnit.dimensions.widthM} × {selectedUnit.dimensions.heightM} m ({lang === 'vi' ? 'dài × rộng × cao' : 'L × W × H'})</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{formatVnd(selectedUnit.price)}<span className="text-sm font-normal text-stone-300">/{lang === 'vi' ? 'tháng' : 'mo'}</span></p>
                    <p className="text-xs font-medium text-white/70">{lang === 'vi' ? 'Tiền cọc = 20% tổng giá trị kỳ thuê đã chọn' : 'Deposit = 20% of the selected rental term value'}</p>
                  </div>
                </div>
              </div>

              {/* 1. Technical Specs & Structure */}
              <div className="order-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 font-mono">
                  {lang === 'vi' ? '2. Thông số kỹ thuật' : '2. Technical specifications'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                    <p className="text-[11px] text-stone-500 font-medium">{lang === 'vi' ? 'Sức chứa sử dụng tham khảo' : 'Estimated usable capacity'}</p>
                    <p className="mt-1 font-bold text-base text-stone-900">~{(selectedUnit.volumeM3 * 0.75).toFixed(1)} m³</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{lang === 'vi' ? 'Ước tính 75% thể tích vật lý để chừa lối đi' : 'Estimated at 75% of physical volume'}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                    <p className="text-[11px] text-stone-500 font-medium">{lang === 'vi' ? 'Kích thước thông thủy cửa kho' : 'Clear door opening'}</p>
                    <p className="mt-1 font-bold text-base text-stone-900">{selectedUnit.doorDimensions.widthM}m × {selectedUnit.doorDimensions.heightM}m</p>
                    <p className="text-[10px] text-stone-500 mt-0.5">{lang === 'vi' ? 'Rộng × cao · kiện lớn nhất phải lọt qua cửa sau khi xoay' : 'W × H · largest package must pass after rotation'}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                    <p className="text-[11px] text-stone-500 font-medium">{lang === 'vi' ? 'Tải trọng sàn tối đa' : 'Floor Load Capacity'}</p>
                    <p className="mt-1 font-bold text-base text-stone-900">{selectedUnit.maxLoadKg} kg</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{lang === 'vi' ? 'Bê tông phủ Epoxy chống ẩm' : 'Epoxy sealed concrete slab'}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                    <p className="text-[11px] text-stone-500 font-medium">{lang === 'vi' ? 'Hệ thống vi khí hậu' : 'Environment'}</p>
                    <p className="mt-1 font-bold text-base text-black">{featureLabel(selectedUnit)}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{lang === 'vi' ? '22°C–25°C, độ ẩm <60%' : '22°C–25°C, humidity <60%'}</p>
                  </div>
                </div>
              </div>

              {/* 2. Realistic Capacity Estimation */}
              <div className="order-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-bold text-sm text-stone-900">
                    {lang === 'vi' ? '1. Kho này phù hợp với nhu cầu nào?' : '1. What can this unit hold?'}
                  </p>
                  <span className="rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white">{lang === 'vi' ? 'Gợi ý sức chứa' : 'Capacity guide'}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                  <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                    <span className="text-stone-500 block font-medium mb-1">{lang === 'vi' ? 'Có thể chứa khoảng' : 'Estimated box capacity'}</span>
                    <span className="font-bold text-stone-900">{capacityDetails.boxes}</span>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                    <span className="text-stone-500 block font-medium mb-1">{lang === 'vi' ? 'Phù hợp lưu trữ' : 'Suitable items'}</span>
                    <span className="font-bold text-black">{capacityDetails.items}</span>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                    <span className="text-stone-500 block font-medium mb-1">{lang === 'vi' ? 'Tương đương phương tiện' : 'Transport equivalent'}</span>
                    <span className="font-bold text-black">{capacityDetails.fit}</span>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-[11px] font-medium text-black">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800">+</span>
                  <span>{lang === 'vi' ? 'Tại sảnh cơ sở luôn trang bị sẵn xe nâng tay, xe đẩy 4 bánh tải trọng 500kg và thang máy chở hàng cỡ lớn miễn phí cho bạn.' : 'Complimentary 500kg flatbed carts, pallet jacks and large cargo elevators available on-site.'}</span>
                </p>
              </div>

              {/* 3. Safety, Security & Operating Standards */}
              <div className="order-4">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 font-mono">
                  {lang === 'vi' ? '3. An ninh và tiện ích vận hành' : '3. Security and operating amenities'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-1">
                    <p className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="text-blue-600"></span> {lang === 'vi' ? 'An ninh & Ra vào độc quyền 24/7' : '24/7 Secured Gate Access'}
                    </p>
                    <p className="text-stone-500 text-[11px]">
                      {lang === 'vi' ? 'Cổng tự động mở bằng mã PIN số cá nhân hóa do bạn sở hữu. Camera CCTV Full-HD góc rộng giám sát 24/7 từng hành lang và cửa kho.' : 'Automated access via personal gate PIN. 24/7 Full-HD CCTV surveillance covering all corridors.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-1">
                    <p className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="text-rose-600"></span> {lang === 'vi' ? 'Hệ thống PCCC tự động đạt chuẩn' : 'Certified Automated Fire Suppression'}
                    </p>
                    <p className="text-stone-500 text-[11px]">
                      {lang === 'vi' ? 'Tích hợp cảm biến khói nhiệt quang học và đầu phun nước tự động Sprinkler riêng biệt cho từng gian kho, thẩm duyệt PCCC định kỳ.' : 'Equipped with optical smoke/heat detectors and independent overhead sprinkler heads.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Reservation & Financial Transparency Guarantee */}
              <div className="order-5 rounded-2xl border border-stone-300 bg-white p-4 text-xs text-black sm:p-5">
                <p className="font-bold text-sm text-black mb-1 flex items-center gap-1.5">
                  <span></span> {lang === 'vi' ? '4. Quy trình đặt kho và thanh toán' : '4. Booking and payment process'}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {[
                    lang === 'vi' ? 'Chọn cỡ kho phù hợp' : 'Choose a suitable size',
                    lang === 'vi' ? 'Tạm giữ suất trong 30 phút' : 'Hold the slot for 30 minutes',
                    lang === 'vi' ? 'Thanh toán cọc 20% trong 12 giờ' : 'Pay 20% deposit within 12 hours',
                    lang === 'vi' ? 'Cơ sở phân kho và Check-in trong 14 ngày' : 'Unit assignment and check-in within 14 days'
                  ].map((item, index) => <div key={item} className="flex gap-2 rounded-xl bg-stone-50 p-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[10px] font-bold text-white">{index + 1}</span><span className="font-medium leading-4 text-stone-700">{item}</span></div>)}
                </div>
              </div>

              <div className="order-6 flex justify-end gap-2 border-t border-stone-100 pt-4">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>{lang === 'vi' ? 'Đóng lại' : 'Close'}</Button>
                <Button
                  disabled={selectedUnit.status !== 'available'}
                  onClick={() => {
                    if (selectedTarget) {
                      handleStartReservation(selectedTarget.facility, selectedTarget.unitType)
                    } else {
                      setDetailOpen(false)
                      setBookOpen(true)
                    }
                  }}
                >
                  {selectedUnit.status === 'available' ? (lang === 'vi' ? 'Khai báo hàng & Đặt giữ chỗ' : 'Declare goods & Reserve') : (lang === 'vi' ? 'Cỡ kho đã hết chỗ' : 'Storage size sold out')}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── MODAL 2: GOODS DECLARATION & HOLD (P0.1, P0.3, P1.1) ─ */}
      <Modal
        open={bookOpen}
        onClose={() => { releaseTemporaryReservationSlot(); setBookOpen(false); showToast(lang === 'vi' ? 'Đã thoát form và trả lại suất kho đang tạm giữ.' : 'The temporary slot was released when you left the form.') }}
        size="xl"
        title={selectedTarget ? (lang === 'vi' ? `Đặt Kho: ${selectedTarget.unitType.name}` : `Book Storage: ${selectedTarget.unitType.name}`) : (selectedUnit ? (lang === 'vi' ? 'Đặt kho' : 'Book storage') : '')}
      >
        {selectedUnit && currentQuote && (
          <div className="space-y-4">
            <div className="sticky top-0 z-10 rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-4 border-b border-stone-200 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-500">{lang === 'vi' ? 'Đang tạm giữ 1 suất kho' : 'One slot is temporarily held'}</p>
                  <p className="mt-1 font-bold text-black">{selectedTarget?.unitType.name || selectedUnit.type} · {selectedUnit.facilityName}</p>
                </div>
                <p className={`shrink-0 text-xl font-bold ${formatCountdown(temporaryHoldExpiresAt || undefined).isUrgent ? 'text-red-700' : 'text-black'}`}>⏱ {formatCountdown(temporaryHoldExpiresAt || undefined).text}</p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-700">{lang === 'vi' ? 'Cỡ kho đã chọn:' : 'Selected size category:'}</span>
                <b>{selectedTarget ? `${selectedTarget.unitType.name} · ${selectedTarget.facility.name} (${selectedTarget.unitType.areaM2} m²)` : `${selectedUnit.facilityName} (${selectedUnit.type} · ${selectedUnit.areaM2} m²)`}</b>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-stone-700">{lang === 'vi' ? 'Kích thước & Sức chịu tải:' : 'Dimensions & Floor limit:'}</span>
                <span>{selectedUnit.dimensions.lengthM}m × {selectedUnit.dimensions.widthM}m × {selectedUnit.dimensions.heightM}m (~{selectedUnit.volumeM3} m³) · Max {selectedUnit.maxLoadKg} kg</span>
              </div>
              <div className="mt-2 flex justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                <span className="font-semibold text-blue-900">{lang === 'vi' ? 'Cửa kho thông thủy (rộng × cao):' : 'Clear door opening (W × H):'}</span>
                <b className="text-blue-950">{selectedUnit.doorDimensions.widthM}m × {selectedUnit.doorDimensions.heightM}m</b>
              </div>
              <div className="mt-3 rounded-lg bg-stone-100 p-3 text-xs leading-5 text-stone-700">
                {lang === 'vi'
                  ? 'Bạn đang giữ một suất theo cỡ kho, chưa phải mã kho vật lý. Sau khi cọc thành công, cơ sở sẽ phân kho cụ thể trước ngày Check-in.'
                  : 'You are holding a size slot, not a physical unit. The facility assigns a specific unit after deposit payment and before check-in.'}
              </div>
            </div>

            <div className={bookingReview ? 'hidden' : 'space-y-4'}>
            {Object.keys(bookingErrors).length > 0 && (
              <div ref={bookingErrorRef} role="alert" tabIndex={-1} className="rounded-xl border border-red-700 bg-red-700 p-4 text-sm text-white shadow-lg">
                <p className="font-bold">{lang === 'vi' ? 'Thông tin chưa hợp lệ' : 'Invalid information'}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{Object.values(bookingErrors).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={lang === 'vi' ? 'Họ và tên người thuê' : 'Full Name'} value={user.name} disabled />
              <Input label={lang === 'vi' ? 'Số CCCD / Hộ chiếu (Đối chiếu lúc check-in)' : 'ID / Passport'} value={customerIdCard} onChange={e => setCustomerIdCard(e.target.value)} />
              <Input label={lang === 'vi' ? 'Số điện thoại liên hệ' : 'Phone'} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              <Input label="Email" value={customerEmail} disabled />
              <Input label={lang === 'vi' ? 'Địa chỉ' : 'Address'} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              <Input label={lang === 'vi' ? 'Ngày Check-in mong muốn' : 'Preferred check-in date'} type="date" value={moveInDate} min={dateInputValue(new Date())} max={dateInputValue(new Date(now + 14 * 86_400_000))} onChange={e => setMoveInDate(e.target.value)} />
              <div><Input label={lang === 'vi' ? 'Giờ Check-in (đang mở 24/7 để kiểm thử)' : 'Check-in time (temporarily 24/7 for testing)'} type="time" min="00:00" max="23:59" step="1800" value={bookingAppointmentTime} onChange={e => setBookingAppointmentTime(e.target.value)} /><p className="mt-1 text-[11px] text-blue-700">{lang === 'vi' ? 'Bạn có thể chọn bất kỳ giờ nào trong ngày; giới hạn 14 ngày Check-in vẫn được áp dụng.' : 'Any time of day is available; the 14-day check-in deadline still applies.'}</p></div>
              <Select label={lang === 'vi' ? 'Thời hạn thuê' : 'Rental term'} value={rentalMonths.toString()} onChange={e => setRentalMonths(Number(e.target.value))}>
                <option value="1">1 {lang === 'vi' ? 'tháng' : 'month'}</option>
                <option value="3">3 {lang === 'vi' ? 'tháng' : 'months'}</option>
                <option value="6">6 {lang === 'vi' ? 'tháng' : 'months'}</option>
                <option value="12">12 {lang === 'vi' ? 'tháng' : 'months'}</option>
              </Select>
            </div>

            {/* Goods Declaration */}
            <div className="border-t border-stone-200 pt-3">
              <p className="font-semibold text-stone-900 text-sm mb-2">{lang === 'vi' ? 'Khai báo chi tiết hàng hóa lưu trữ' : 'Goods Declaration'}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label={lang === 'vi' ? 'Loại hàng hóa' : 'Goods type'} value={goodsType} onChange={e => setGoodsType(e.target.value)} />
                <Input label={lang === 'vi' ? 'Chất liệu chính' : 'Primary materials'} value={goodsMaterial} onChange={e => setGoodsMaterial(e.target.value)} />
                <Input label={lang === 'vi' ? 'Số kiện hàng' : 'Package count'} type="number" value={packageCount} onChange={e => setPackageCount(e.target.value)} />
                <Input label={lang === 'vi' ? 'Tổng cân nặng thực tế (kg)' : 'Actual total weight (kg)'} type="number" value={goodsWeight} onChange={e => setGoodsWeight(e.target.value)} />
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium text-stone-700 mb-1">{lang === 'vi' ? 'Kích thước kiện hàng lớn nhất (Dài × Rộng × Cao, cm)' : 'Dimensions (L × W × H, cm)'}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" label="Dài (cm)" value={cargoLength} onChange={e => setCargoLength(e.target.value)} />
                  <Input type="number" label="Rộng (cm)" value={cargoWidth} onChange={e => setCargoWidth(e.target.value)} />
                  <Input type="number" label="Cao (cm)" value={cargoHeight} onChange={e => setCargoHeight(e.target.value)} />
                </div>
              </div>

              <div className="mt-2">
                <Input label={lang === 'vi' ? 'Mô tả hàng hóa và tình trạng đóng gói' : 'Goods and packaging description'} value={goodsCondition} onChange={e => setGoodsCondition(e.target.value)} />
              </div>
            </div>

            {/* Storage Space & Cost Breakdown */}
            {(() => {
              const goodsVolM3 = Math.round((cargoLengthNumber * cargoWidthNumber * cargoHeightNumber * packageCountNumber) / 1000) / 1000
              const usableCapacityM3 = Math.round(selectedUnit.volumeM3 * 0.75 * 10) / 10
              const spaceOccupancyPercent = usableCapacityM3 ? Math.min(100, Math.round((goodsVolM3 / usableCapacityM3) * 100)) : 0
              const remainingVol = Math.max(0, Math.round((usableCapacityM3 - goodsVolM3) * 1000) / 1000)
              const isOverload = goodsWeightNumber > selectedUnit.maxLoadKg
              const totalTermValue = Math.max(0, currentQuote.baseMonthlyPrice * rentalMonths - promotionDiscount)
              const reservationDeposit = Math.round(totalTermValue * 0.2 * 100) / 100
              const remainingPayment = Math.max(0, totalTermValue - reservationDeposit)
              const conditionSecurityDeposit = currentQuote.depositAmount || currentQuote.baseMonthlyPrice
              const dueAtCheckIn = remainingPayment + conditionSecurityDeposit
              const initialObligation = totalTermValue + conditionSecurityDeposit

              return (
                <div className="rounded-xl border border-stone-200 bg-gradient-to-b from-stone-50/90 to-amber-50/40 p-4 text-xs text-stone-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <div>
                      <p className="font-bold text-sm text-stone-900">{lang === 'vi' ? 'Dự Toán Chi Phí & Đối Chiếu Không Gian Lưu Trữ' : 'Space & Cost Estimation'}</p>
                      <p className="text-[11px] text-stone-500">{lang === 'vi' ? 'Phân tích mức độ tương thích giữa thể tích hàng và dung tích gian kho' : 'Volume fit and weight check for selected storage unit'}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${spaceOccupancyPercent <= 85 && !isOverload ? 'border-stone-300 text-black' : 'border-red-700 bg-red-700 text-white'}`}>{spaceOccupancyPercent <= 85 && !isOverload ? (lang === 'vi' ? 'Phù hợp' : 'Suitable') : (lang === 'vi' ? 'Cần chú ý' : 'Attention')}</span>
                  </div>

                  {/* Volume and Space Compatibility */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white rounded-lg p-3 border border-stone-100">
                    <div>
                      <span className="text-stone-500 block text-[11px]">{lang === 'vi' ? 'Thể tích hàng hóa khai báo:' : 'Declared goods volume:'}</span>
                      <span className="font-bold text-stone-900 text-sm">{goodsVolM3} m³</span>
                      <span className="text-[10px] text-stone-400 block">({cargoLength}×{cargoWidth}×{cargoHeight}cm · {packageCount} {lang === 'vi' ? 'kiện' : 'pkgs'})</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[11px]">{lang === 'vi' ? 'Dung tích gian kho khả dụng:' : 'Unit usable volume:'}</span>
                      <span className="font-bold text-black text-sm">{usableCapacityM3} m³</span>
                      <span className="text-[10px] text-stone-400 block">{lang === 'vi' ? `Thể tích vật lý ${selectedUnit.volumeM3} m³` : `Physical volume ${selectedUnit.volumeM3} m³`}</span>
                    </div>
                  </div>

                  {/* Occupancy Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                      <span>{lang === 'vi' ? 'Tỷ lệ chiếm dụng thể tích kho:' : 'Space utilization rate:'}</span>
                      <span className="font-semibold text-stone-900">{spaceOccupancyPercent}% ({lang === 'vi' ? `còn trống ${remainingVol} m³` : `${remainingVol} m³ free space`})</span>
                    </div>
                    <ProgressBar value={spaceOccupancyPercent} max={100} color={spaceOccupancyPercent > 85 ? 'bg-red-600' : 'bg-black'} />
                  </div>

                  {/* Floor Weight Check */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-600">{lang === 'vi' ? 'Tải trọng hàng hóa thực tế:' : 'Total actual weight:'}</span>
                    <span className={isOverload ? 'font-bold text-red-700' : 'font-semibold text-black'}>
                      {goodsWeight || '—'} kg / {lang === 'vi' ? 'Sức chịu tải sàn' : 'Floor limit'} {selectedUnit.maxLoadKg} kg {isOverload ? (lang === 'vi' ? '(Vượt tải trọng)' : '(Overloaded)') : ''}
                    </span>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="space-y-2 border-t border-stone-200 pt-3">
                    <p className="font-bold text-stone-900">{lang === 'vi' ? 'Cách tính số tiền' : 'Payment calculation'}</p>
                    <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
                      <div className="flex justify-between gap-4"><span className="text-stone-600">{lang === 'vi' ? `1. Tiền thuê: ${formatVnd(currentQuote.baseMonthlyPrice)} × ${rentalMonths} tháng` : `1. Rent: ${formatVnd(currentQuote.baseMonthlyPrice)} × ${rentalMonths} months`}</span><b>{formatVnd(totalTermValue)}</b></div>
                      <div className="flex justify-between gap-4"><span className="text-stone-600">{lang === 'vi' ? `2. Cọc giữ chỗ: 20% × ${formatVnd(totalTermValue)} tiền thuê` : `2. Booking deposit: 20% × ${formatVnd(totalTermValue)} rent`}</span><b className="text-blue-700">{formatVnd(reservationDeposit)}</b></div>
                      <div className="flex justify-between gap-4"><span className="text-stone-600">{lang === 'vi' ? `3. Tiền thuê còn lại: ${formatVnd(totalTermValue)} − ${formatVnd(reservationDeposit)}` : `3. Remaining rent: ${formatVnd(totalTermValue)} − ${formatVnd(reservationDeposit)}`}</span><b>{formatVnd(remainingPayment)}</b></div>
                      <div className="flex justify-between gap-4"><span className="text-stone-600">{lang === 'vi' ? '4. Tiền đảm bảo kho: bằng 1 tháng tiền thuê' : '4. Storage security deposit: one month of rent'}</span><b className="text-emerald-700">{formatVnd(conditionSecurityDeposit)}</b></div>
                    </div>
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1.5">
                      <div className="flex justify-between gap-4"><span>{lang === 'vi' ? 'Thanh toán ngay để giữ chỗ' : 'Pay now to reserve'}</span><b>{formatVnd(reservationDeposit)}</b></div>
                      <div className="flex justify-between gap-4"><span>{lang === 'vi' ? `Thanh toán tại Check-in: ${formatVnd(remainingPayment)} + ${formatVnd(conditionSecurityDeposit)}` : `Pay at check-in: ${formatVnd(remainingPayment)} + ${formatVnd(conditionSecurityDeposit)}`}</span><b>{formatVnd(dueAtCheckIn)}</b></div>
                    </div>
                    {currentQuote.dimSurcharge > 0 && (
                      <div className="flex justify-between text-amber-800 font-medium">
                        <span>{lang === 'vi' ? 'Phụ phí tăng cường tải trọng sàn:' : 'Floor reinforcement surcharge:'}</span>
                        <span>+{formatVnd(currentQuote.dimSurcharge)}</span>
                      </div>
                    )}
                    <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-base text-stone-900">
                      <span>{lang === 'vi' ? 'Tổng tiền thu cho kỳ thuê (gồm tiền đảm bảo kho):' : 'Total collected for this term (including security deposit):'}</span>
                      <span className="text-black">{formatVnd(initialObligation)}</span>
                    </div>
                    <p className="text-[11px] leading-5 text-stone-600">{lang === 'vi' ? `${formatVnd(totalTermValue)} là tiền thuê. ${formatVnd(conditionSecurityDeposit)} là tiền đảm bảo kho, không phải tiền thuê và phần không bị khấu trừ sẽ được hoàn sau nghiệm thu trả kho.` : `${formatVnd(totalTermValue)} is rent. The ${formatVnd(conditionSecurityDeposit)} security deposit is not rent and any undeducted amount is refunded after move-out inspection.`}</p>
                  </div>

                  <div className="rounded-lg bg-stone-100 p-3 text-[11px] text-black space-y-1">
                    <p className="font-medium">
                       {lang === 'vi' ? 'Cam kết minh bạch của StorageHub:' : 'StorageHub Transparency Guarantee:'}
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                      <li>{lang === 'vi' ? 'Tạm giữ một suất theo cỡ kho trong 30 phút để hoàn tất và xác nhận thông tin.' : 'One size slot is held for 30 minutes while you complete and confirm the request.'}</li>
                      <li>{lang === 'vi' ? 'Sau khi xác nhận, bạn có 12 giờ để thanh toán cọc 20%.' : 'After confirmation, you have 12 hours to pay the 20% deposit.'}</li>
                      <li>{lang === 'vi' ? 'Sau khi cọc, cơ sở phân kho vật lý và bạn cần hoàn tất Check-in trong 14 ngày.' : 'After payment, the facility assigns a unit and you must complete check-in within 14 days.'}</li>
                    </ul>
                  </div>
                </div>
              )
            })()}

            {validationViolation && (
              <div className="rounded-xl border-2 border-red-700 bg-red-700 p-4 text-xs text-white space-y-3 fade-in">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <span></span>
                  <span>{lang === 'vi' ? 'Cỡ kho này không phù hợp' : 'This storage size is not suitable'}</span>
                </div>
                <p className="text-white leading-relaxed font-medium">
                  {validationViolation.reason}
                </p>

                {validationViolation.suggestedUnitTypeId && (
                  <div className="rounded-lg border border-amber-700 bg-amber-700 p-3 space-y-2 text-white">
                    <p className="font-bold flex items-center gap-1.5">
                      <span></span>
                      <span>{lang === 'vi' ? 'Hệ thống đề xuất nâng cấp loại gian kho phù hợp:' : 'Recommended Storage Upgrade:'}</span>
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      {lang === 'vi'
                        ? `Kiện hàng của bạn cần thể tích kho lớn hơn hoặc chiều dài rộng hơn. Hãy chuyển sang gian kho `
                        : `Your declared cargo requires larger volume or length. Upgrade to `}
                      <b className="text-white font-bold">{validationViolation.suggestedUnitTypeName} (~{validationViolation.suggestedVolumeM3} m³)</b>.
                    </p>
                    <div className="pt-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          const targetTypePrefix = validationViolation.suggestedUnitTypeName?.split(' ')[0] || ''
                          const upgradeType = unitTypes.find(
                            ut => ut.id === validationViolation.suggestedUnitTypeId ||
                                  ut.name.toLowerCase().includes(targetTypePrefix.toLowerCase())
                          )
                          if (upgradeType && selectedTarget) {
                            handleStartReservation(selectedTarget.facility, upgradeType)
                            setValidationViolation(null)
                            showToast(lang === 'vi' ? `Đã chuyển sang cỡ kho ${upgradeType.name}!` : `Upgraded to ${upgradeType.name}!`)
                          } else {
                            showToast(lang === 'vi' ? 'Không tìm thấy cỡ kho nâng cấp phù hợp.' : 'No upgrade size found.')
                          }
                        }}
                      >
                         {lang === 'vi' ? `Chuyển ngay sang ${validationViolation.suggestedUnitTypeName}` : `Upgrade to ${validationViolation.suggestedUnitTypeName}`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            {bookingReview && (() => {
              const totalValue = Math.max(0, currentQuote.baseMonthlyPrice * rentalMonths - promotionDiscount)
              const deposit = Math.round(totalValue * 0.2 * 100) / 100
              const securityDeposit = currentQuote.depositAmount || currentQuote.baseMonthlyPrice
              const dueAtCheckIn = totalValue - deposit + securityDeposit
              const goodsVolume = Math.round((cargoLengthNumber * cargoWidthNumber * cargoHeightNumber * packageCountNumber) / 1000) / 1000
              return (
                <div className="rounded-2xl border-2 border-black bg-white p-5 text-sm text-black">
                  <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
                    <div><p className="text-xs font-bold uppercase tracking-[.12em] text-stone-500">{lang === 'vi' ? 'Bước cuối' : 'Final step'}</p><h3 className="mt-1 text-lg font-bold">{lang === 'vi' ? 'Xác nhận thông tin đặt kho' : 'Review your booking'}</h3></div>
                    <button className="text-xs font-bold underline" onClick={() => setBookingReview(false)}>{lang === 'vi' ? 'Quay lại chỉnh sửa' : 'Edit information'}</button>
                  </div>

                  <div className={`rounded-lg border p-3 ${largestPackageFitsDoor ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className={`font-bold ${largestPackageFitsDoor ? 'text-emerald-900' : 'text-red-900'}`}>{lang === 'vi' ? 'Kiểm tra kiện hàng qua cửa kho' : 'Door clearance check'}</p><p className="mt-0.5 text-[11px] text-stone-600">{lang === 'vi' ? `Kiện lớn nhất ${cargoLength || '—'}×${cargoWidth || '—'}×${cargoHeight || '—'} cm · Cửa rộng ${selectedUnit.doorDimensions.widthM}m × cao ${selectedUnit.doorDimensions.heightM}m` : `Largest package ${cargoLength || '—'}×${cargoWidth || '—'}×${cargoHeight || '—'} cm · Door ${selectedUnit.doorDimensions.widthM}m × ${selectedUnit.doorDimensions.heightM}m`}</p></div>
                      <span className={`rounded-full px-3 py-1 font-bold ${largestPackageFitsDoor ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>{largestPackageFitsDoor ? (lang === 'vi' ? '✓ Lọt qua cửa khi xoay' : '✓ Fits through door') : (lang === 'vi' ? '✕ Không lọt qua cửa' : '✕ Does not fit')}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Người thuê' : 'Customer'}</p><p className="font-bold">{user.name}</p><p className="text-stone-600">CCCD/Hộ chiếu: {customerIdCard}</p><p className="text-stone-600">{customerPhone} · {customerEmail}</p><p className="text-stone-600">{customerAddress}</p></div>
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Cỡ kho và cơ sở' : 'Storage and facility'}</p><p className="font-bold">{selectedTarget?.unitType.name || selectedUnit.type} · {selectedUnit.facilityName}</p><p className="text-stone-600">{lang === 'vi' ? 'Diện tích sàn' : 'Floor area'}: {selectedUnit.areaM2} m²</p><p className="text-stone-600">{lang === 'vi' ? 'Kích thước kho' : 'Unit dimensions'}: {selectedUnit.dimensions.lengthM} × {selectedUnit.dimensions.widthM} × {selectedUnit.dimensions.heightM} m</p><p className="text-stone-600">{lang === 'vi' ? 'Cửa kho (rộng × cao)' : 'Door (W × H)'}: <b>{selectedUnit.doorDimensions.widthM} × {selectedUnit.doorDimensions.heightM} m</b></p><p className="font-semibold text-emerald-700">✓ {lang === 'vi' ? 'Kiện lớn nhất đã được kiểm tra lọt qua cửa khi xoay.' : 'Largest package passes the door clearance check.'}</p><p className="text-stone-600">{lang === 'vi' ? 'Thể tích vật lý' : 'Physical volume'}: {selectedUnit.volumeM3} m³ · {lang === 'vi' ? 'Tải sàn' : 'Floor load'}: {selectedUnit.maxLoadKg} kg</p></div>
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Hàng hóa' : 'Goods'}</p><p className="font-bold">{goodsType} · {packageCount} {lang === 'vi' ? 'kiện' : 'packages'}</p><p className="text-stone-600">{lang === 'vi' ? 'Chất liệu' : 'Material'}: {goodsMaterial}</p><p className="text-stone-600">{lang === 'vi' ? 'Kiện lớn nhất' : 'Largest package'}: {cargoLength} × {cargoWidth} × {cargoHeight} cm</p><p className="text-stone-600">{lang === 'vi' ? 'Tổng thể tích khai báo' : 'Declared volume'}: {goodsVolume} m³ · {goodsWeight} kg</p><p className="text-stone-600">{goodsCondition}</p></div>
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Thời gian' : 'Schedule'}</p><p className="font-bold">{lang === 'vi' ? 'Lịch Check-in đã chọn' : 'Selected check-in'}: {moveInDate} · {bookingAppointmentTime}</p><p className="text-stone-600">{lang === 'vi' ? 'Kỳ thuê' : 'Rental term'}: {rentalMonths} {lang === 'vi' ? 'tháng' : 'months'}</p><p className="font-semibold text-red-700">{lang === 'vi' ? 'Nếu đổi lịch, ngày mới vẫn phải nằm trong 14 ngày sau khi thanh toán cọc.' : 'Any rescheduled date must remain within 14 days after deposit payment.'}</p></div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-100 p-4 text-center sm:grid-cols-4">
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Tổng kỳ thuê' : 'Term value'}</p><p className="mt-1 font-bold">{formatVnd(totalValue)}</p></div>
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Cọc giữ chỗ 20%' : '20% booking deposit'}</p><p className="mt-1 font-bold">{formatVnd(deposit)}</p></div>
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Tiền đảm bảo kho' : 'Storage security deposit'}</p><p className="mt-1 font-bold text-emerald-700">{formatVnd(securityDeposit)}</p></div>
                    <div><p className="text-xs text-stone-500">{lang === 'vi' ? 'Thu tại Check-in' : 'Due at check-in'}</p><p className="mt-1 font-bold">{formatVnd(dueAtCheckIn)}</p></div>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-stone-600">{lang === 'vi' ? 'Cọc giữ chỗ được trừ vào tiền thuê và không hoàn nếu khách hủy trước Check-in. Tiền đảm bảo kho được thu riêng tại Check-in để bảo đảm nghĩa vụ về hư hại, vệ sinh và công nợ; khoản còn lại được hoàn sau biên bản nghiệm thu trả kho.' : 'The booking deposit is credited toward rent and is non-refundable for cancellation before check-in. The separate storage security deposit covers damage, cleaning and outstanding balances; the remainder is refunded after the move-out inspection record.'}</p>
                </div>
              )
            })()}

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              {bookingReview ? (
                <Button variant="outline" onClick={() => setBookingReview(false)}>{lang === 'vi' ? 'Quay lại chỉnh sửa' : 'Back to edit'}</Button>
              ) : (
                <Button variant="outline" onClick={() => { releaseTemporaryReservationSlot(); setBookOpen(false); showToast(lang === 'vi' ? 'Đã hủy thao tác và trả lại suất kho.' : 'Booking cancelled and the slot was released.'); }}>{lang === 'vi' ? 'Hủy và trả lại suất kho' : 'Cancel and release slot'}</Button>
              )}
              <Button onClick={confirmReservation}>
                {bookingReview ? (lang === 'vi' ? 'Xác nhận đặt kho' : 'Confirm booking') : (lang === 'vi' ? 'Xác nhận thông tin' : 'Review information')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 3: EMAIL VERIFICATION SIMULATION (P0.4) ─────── */}
      <Modal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title={lang === 'vi' ? 'Xác Nhận Địa Chỉ Email Giữ Kho' : 'Verify Email Address'}
      >
        {activeHoldForEmail && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-700 p-4 text-xs text-white">
              <p className="font-bold text-sm mb-1"> {lang === 'vi' ? 'Email xác minh đã được gửi tới:' : 'Verification email sent to:'} {activeHoldForEmail.customerEmail}</p>
              <p>{lang === 'vi' ? 'Để tránh tình trạng giữ kho ảo, hệ thống yêu cầu xác nhận email trước khi nhân viên tiếp nhận phê duyệt hồ sơ.' : 'To prevent fictitious bookings, email verification is required.'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 block">
                {lang === 'vi' ? 'Mã token xác minh (Trích xuất từ đường link trong email):' : 'Verification Token:'}
              </label>
              <input
                value={inputToken}
                onChange={e => setInputToken(e.target.value)}
                className="w-full font-mono text-xs border border-stone-300 rounded-lg p-2.5 bg-stone-50"
              />
              <p className="text-[11px] text-stone-400">
                {lang === 'vi' ? 'Token có hiệu lực trong 24 giờ. Hết hạn sẽ tự động giải phóng gian kho.' : 'Token is single-use and expires in 24 hours.'}
              </p>
              <p className="text-[11px] font-medium text-amber-800">{lang === 'vi' ? 'Bản frontend demo: mã xác minh được điền sẵn vì chưa kết nối dịch vụ gửi email.' : 'Frontend demo: the code is prefilled because email delivery is not connected yet.'}</p>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputToken(resendHoldEmail(activeHoldForEmail.id))
                  showToast(lang === 'vi' ? 'Đã cấp lại mã token và gửi email mới!' : 'New verification token generated!')
                }}
              >
                 {lang === 'vi' ? 'Gửi lại email' : 'Resend email'}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(false)}>
                  {lang === 'vi' ? 'Để sau' : 'Later'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const success = verifyHoldEmail(activeHoldForEmail.id, inputToken)
                    if (success) {
                      setEmailModalOpen(false)
                      showToast(lang === 'vi' ? 'Email đã được xác nhận thành công! Hồ sơ đã gửi tới nhân viên ca trực.' : 'Email verified! Application forwarded to facility staff.')
                    } else {
                      showToast(lang === 'vi' ? 'Mã token không hợp lệ hoặc đã hết hạn!' : 'Invalid or expired token!')
                    }
                  }}
                >
                   {lang === 'vi' ? 'Xác thực ngay' : 'Verify now'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 4: PAY DEPOSIT (AFTER STAFF REVIEW) ─────────── */}
      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={lang === 'vi' ? 'Thanh Toán Cọc Giữ Chỗ' : 'Pay Reservation Deposit'}
      >
        {activeHoldForPayment && (() => {
          const originalRent = activeHoldForPayment.originalMonthlyRate ?? activeHoldForPayment.quote.baseMonthlyPrice
          const totalDue = originalRent * activeHoldForPayment.rentalMonths
          const reservationDeposit = activeHoldForPayment.reservationDepositAmount ?? Math.round(totalDue * 0.2 * 100) / 100
          const securityDeposit = activeHoldForPayment.securityDepositAmount ?? originalRent
          const dueAtCheckIn = activeHoldForPayment.remainingAmount ?? totalDue - reservationDeposit + securityDeposit

          return (
            <div className="space-y-4">
              {/* Price Snapshot & Detailed Breakdown */}
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-4 text-xs space-y-2.5">
                <div className="flex justify-between items-start border-b border-stone-200 pb-2">
                  <div>
                    <p className="font-bold text-sm text-stone-900">{lang === 'vi' ? `Thanh toán cho đơn giữ kho ${activeHoldForPayment.id}` : `Payment for ${activeHoldForPayment.id}`}</p>
                    <p className="text-stone-500">{lang === 'vi' ? 'Loại kho' : 'Unit type'}: <b>{activeHoldForPayment.unitTypeName}</b> · {lang === 'vi' ? 'Cơ sở' : 'Facility'}: <b>{activeHoldForPayment.facilityName}</b></p>
                  </div>
                  <Badge variant="info">{activeHoldForPayment.unitTypeName || 'Standard'}</Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between"><span className="text-stone-600">{lang === 'vi' ? 'Giá thuê mỗi tháng:' : 'Monthly rent:'}</span><span className="font-semibold text-black">{formatVnd(originalRent)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-600">{lang === 'vi' ? 'Thời hạn thuê:' : 'Rental term:'}</span><span className="font-semibold text-black">{activeHoldForPayment.rentalMonths} {lang === 'vi' ? 'tháng' : 'months'}</span></div>

                  <div className="flex justify-between text-base font-bold text-black pt-2 border-t border-stone-300">
                    <span>{lang === 'vi' ? 'Tổng giá trị kỳ thuê:' : 'Full rental term value:'}</span>
                    <span className="font-mono">{formatVnd(totalDue)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black"><span>{lang === 'vi' ? 'Cọc cần thanh toán (20%):' : 'Deposit due (20%):'}</span><span>{formatVnd(reservationDeposit)}</span></div>
                  <div className="flex justify-between"><span>{lang === 'vi' ? 'Tiền đảm bảo kho:' : 'Storage security deposit:'}</span><span className="font-semibold text-emerald-700">{formatVnd(securityDeposit)}</span></div>
                  <div className="flex justify-between"><span>{lang === 'vi' ? 'Còn thu tại Check-in:' : 'Due at check-in:'}</span><span>{formatVnd(dueAtCheckIn)}</span></div>
                  <p className="border-t border-stone-200 pt-2 text-xs text-stone-600">{lang === 'vi' ? 'Cọc giữ chỗ 20% được khấu trừ vào tiền thuê. Tiền đảm bảo kho được thu riêng tại Check-in, dùng để bảo đảm hư hại, vệ sinh và công nợ; phần không bị khấu trừ sẽ hoàn sau nghiệm thu trả kho.' : 'The 20% booking deposit is credited toward rent. The separate storage security deposit covers damage, cleaning and outstanding balances; any undeducted amount is refunded after move-out inspection.'}</p>
                </div>
              </div>

              <Select
                label={lang === 'vi' ? 'Phương thức thanh toán' : 'Payment Method'}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="Chuyển khoản VietQR">Chuyển khoản VietQR (Khuyên dùng)</option>
                <option value="Thẻ tín dụng Visa/MasterCard">Thẻ tín dụng Visa/MasterCard</option>
                <option value="Ví điện tử MoMo / ZaloPay">Ví điện tử MoMo / ZaloPay</option>
              </Select>

              <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
                <Button variant="outline" onClick={() => setPayModalOpen(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button>
                <Button
                  onClick={() => {
                    payStorageHold(activeHoldForPayment.id, paymentMethod)
                    setPayModalOpen(false)
                    setActiveHoldForPayment(null)
                    showToast(lang === 'vi' ? 'Đã thanh toán cọc. Đơn đã chuyển sang bước xem điều khoản và chờ cơ sở phân kho.' : 'Deposit paid. Terms and receipt are now available while the facility assigns a unit.')
                  }}
                >
                   {lang === 'vi' ? 'Xác nhận thanh toán' : 'Confirm Payment'}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── MODAL 4B: PAPER CONTRACT & PAYMENT RECEIPTS ─── */}
      <Modal
        open={contractEmailModalOpen}
        onClose={() => setContractEmailModalOpen(false)}
        title={lang === 'vi' ? 'Hợp đồng thuê & biên nhận' : 'Rental contract & receipts'}
        size="xl"
      >
        {activeHoldForContract && (
          <div className="space-y-4">
            {/* Notification alert */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">i</div>
              <div className="space-y-1 text-xs text-black">
                <p className="font-bold text-sm text-black">
                  {lang === 'vi' ? 'Hồ sơ thanh toán và điều khoản của ' : 'Payment and terms record for '}
                  <span className="underline font-mono">{activeHoldForContract.customerEmail}</span>
                </p>
                <p className="text-stone-700">
                  {lang === 'vi'
                    ? 'Đã ghi nhận cọc giữ chỗ. Hợp đồng giấy chỉ xuất hiện sau khi hai bên ký và nhân viên lưu bản scan; phần còn lại thu tại cơ sở.'
                    : 'Reservation deposit recorded. The signed paper contract appears after on-site signing and scan upload; the balance is paid on site.'}
                </p>
              </div>
            </div>

            {/* Tab switch */}
            <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setContractTab('contract')}
                className={`flex items-center justify-center rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                  contractTab === 'contract'
                    ? 'bg-white text-stone-950 shadow-sm ring-1 ring-stone-200'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <span>{lang === 'vi' ? 'Hợp Đồng Thuê' : 'Rental Contract'}</span>
              </button>
              <button
                type="button"
                onClick={() => setContractTab('receipt')}
                className={`flex items-center justify-center rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                  contractTab === 'receipt'
                    ? 'bg-white text-stone-950 shadow-sm ring-1 ring-stone-200'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <span>{lang === 'vi' ? 'Biên nhận & Thanh toán' : 'Receipts & Payments'}</span>
              </button>
            </div>

            {/* Tab 1: Official Digital Lease Agreement */}
            {contractTab === 'contract' && <div className="overflow-hidden rounded-xl border border-stone-200 bg-white text-xs shadow-sm">
              {(() => {
                const signed = contracts.find(c => c.reservationId === activeHoldForContract.id && c.status === 'SIGNED' && c.contractType !== 'RENEWAL')
                const deposit = activeHoldForContract.reservationDepositAmount ?? activeHoldForContract.payment.amount
                const securityDeposit = activeHoldForContract.securityDepositAmount ?? activeHoldForContract.quote.depositAmount
                const appointment = activeHoldForContract.appointmentDate ? `${activeHoldForContract.appointmentDate} ${activeHoldForContract.appointmentTime ?? ''}` : (lang === 'vi' ? 'Chưa đặt lịch' : 'Not scheduled yet')
                const relatedRental = rentals.find(rental => rental.holdId === activeHoldForContract.id || (rental.customerId === activeHoldForContract.customerId && rental.unitId === (activeHoldForContract.assignedUnitId || activeHoldForContract.unitId)))
                const completedRenewals = renewals.filter(renewal => renewal.rentalId === relatedRental?.id && renewal.status === 'completed')
                const activeRenewals = renewals.filter(renewal => renewal.rentalId === relatedRental?.id && !['rejected', 'cancelled', 'payment_expired'].includes(renewal.status))
                const pricedRenewals = activeRenewals.filter(renewal => ['approved', 'appointment_scheduled', 'completed'].includes(renewal.status))
                const effectiveEndDate = relatedRental?.endDate || signed?.endDate || activeHoldForContract.endDate
                const initialTermValue = activeHoldForContract.quote.baseMonthlyPrice * activeHoldForContract.rentalMonths
                const completedRenewalValue = completedRenewals.reduce((sum, renewal) => sum + (renewal.totalAmount ?? renewal.renewalFee), 0)
                const currentTermValue = initialTermValue + completedRenewalValue
                const totalBookingDeposit = deposit + pricedRenewals.reduce((sum, renewal) => sum + (renewal.bookingDepositAmount ?? Math.round((renewal.totalAmount ?? renewal.renewalFee) * 0.2 * 100) / 100), 0)
                const depositDueNow = activeRenewals.filter(renewal => renewal.status === 'approved').reduce((sum, renewal) => sum + (renewal.bookingDepositAmount ?? Math.round((renewal.totalAmount ?? renewal.renewalFee) * 0.2 * 100) / 100), 0)
                const balance = activeRenewals.reduce((sum, renewal) => ['approved', 'appointment_scheduled'].includes(renewal.status) ? sum + (renewal.remainingAmount ?? Math.round((renewal.totalAmount ?? renewal.renewalFee) * 0.8 * 100) / 100) + (renewal.lateFeeAmount ?? 0) : sum, 0)
                const totalRentalMonths = activeHoldForContract.rentalMonths + completedRenewals.reduce((sum, renewal) => sum + renewal.renewalMonths, 0)
                return <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">{lang === 'vi' ? 'Hồ sơ hợp đồng' : 'Contract record'}</p>
                      <p className="mt-1 text-base font-bold text-stone-950">{activeHoldForContract.id} · {activeHoldForContract.unitTypeName ?? activeHoldForContract.unitId}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 font-bold ${signed ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'}`}>
                      {signed ? (lang === 'vi' ? 'Đã ký hợp đồng' : 'Contract signed') : (lang === 'vi' ? 'Chờ ký tại cơ sở' : 'Awaiting on-site signing')}
                    </span>
                  </div>
                  <div className="space-y-5 p-5">
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{lang === 'vi' ? '1. Chủ thể hợp đồng' : '1. Contracting parties'}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-stone-200 p-3"><p className="font-bold text-stone-950">{lang === 'vi' ? 'Bên cho thuê: StorageHub' : 'Lessor: StorageHub'}</p><p className="mt-1 leading-5 text-stone-600">{activeHoldForContract.facilityName}<br />{facilities.find(item => item.id === activeHoldForContract.facilityId)?.address || '—'}<br />{lang === 'vi' ? 'Đại diện ký: Facility Manager / nhân viên được ủy quyền' : 'Signatory: Facility Manager / authorized staff'}</p></div><div className="rounded-lg border border-stone-200 p-3"><p className="font-bold text-stone-950">{lang === 'vi' ? `Bên thuê: ${activeHoldForContract.customerName}` : `Tenant: ${activeHoldForContract.customerName}`}</p><p className="mt-1 leading-5 text-stone-600">CCCD/Hộ chiếu: {activeHoldForContract.identityId}<br />{activeHoldForContract.customerPhone} · {activeHoldForContract.customerEmail}<br />{activeHoldForContract.customerAddress || (lang === 'vi' ? 'Địa chỉ: cập nhật khi ký' : 'Address: confirmed at signing')}<br />{lang === 'vi' ? `Mã khách hàng: ${activeHoldForContract.customerId}` : `Customer ID: ${activeHoldForContract.customerId}`}</p></div></div></section>
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{lang === 'vi' ? '2. Đối tượng thuê & lịch bàn giao' : '2. Rental subject and handover'}</p><div className="grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-2">{[
                      [lang === 'vi' ? 'Số hợp đồng / mã đơn' : 'Contract / reservation', `${signed?.contractNumber ?? (lang === 'vi' ? 'Cấp sau khi ký' : 'Issued after signing')} · ${activeHoldForContract.id}`],
                      [lang === 'vi' ? 'Gian kho / cỡ kho' : 'Unit / storage size', activeHoldForContract.assignedUnitId ?? activeHoldForContract.unitTypeName ?? '—'],
                      [lang === 'vi' ? 'Kích thước kiện lớn nhất' : 'Largest package', `${activeHoldForContract.goods.lengthCm} × ${activeHoldForContract.goods.widthCm} × ${activeHoldForContract.goods.heightCm} cm`],
                      [lang === 'vi' ? 'Hàng hóa khai báo' : 'Declared goods', `${activeHoldForContract.goods.category} · ${activeHoldForContract.goods.packageCount} kiện · ${activeHoldForContract.goods.weightKg} kg`],
                      [lang === 'vi' ? 'Thời hạn thuê hiện hành' : 'Current rental term', `${activeHoldForContract.startDate} → ${effectiveEndDate} · ${totalRentalMonths} ${lang === 'vi' ? 'tháng' : 'months'}`],
                      [lang === 'vi' ? 'Lịch Check-in / bàn giao' : 'Check-in / handover', appointment]
                    ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 font-bold leading-5 text-stone-900">{value}</p></div>)}</div></section>
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{lang === 'vi' ? '3. Điều khoản chính' : '3. Key terms'}</p><div className="grid gap-2 sm:grid-cols-2">{[
                      lang === 'vi' ? `Đơn giá hiện hành: ${formatVnd(activeHoldForContract.quote.baseMonthlyPrice)}/tháng; tổng giá trị tiền thuê sau gia hạn là ${formatVnd(currentTermValue)}.` : `Current rate: ${formatVnd(activeHoldForContract.quote.baseMonthlyPrice)}/month; total rent after renewals is ${formatVnd(currentTermValue)}.`,
                      lang === 'vi' ? `Tổng cọc giữ chỗ 20% đã ghi nhận (${formatVnd(totalBookingDeposit)}) được trừ vào tiền thuê; tiền đảm bảo kho ${formatVnd(securityDeposit)} là khoản riêng, dùng để bảo đảm hư hại, vệ sinh và công nợ, phần còn lại được hoàn sau nghiệm thu.` : `Total recorded 20% booking deposits (${formatVnd(totalBookingDeposit)}) are credited toward rent; the separate ${formatVnd(securityDeposit)} storage security deposit covers damage, cleaning and outstanding balances, with the remainder refunded after inspection.`,
                      lang === 'vi' ? 'Khách hoàn tất Check-in trong 14 ngày sau khi thanh toán cọc; đổi lịch cũng phải nằm trong thời hạn này.' : 'Check-in and any rescheduling must remain within 14 days after deposit payment.',
                      lang === 'vi' ? 'Khách chỉ lưu hàng đã khai báo, tuân thủ tải trọng, kích thước cửa kho, PCCC và danh mục hàng cấm.' : 'Only declared goods are permitted, subject to door, load, fire-safety and prohibited-goods rules.',
                      lang === 'vi' ? 'Gia hạn theo gói tháng, chỉ thanh toán sau khi Facility Manager kiểm tra lịch và phê duyệt.' : 'Extensions use monthly packages and are payable after Facility Manager approval.',
                      lang === 'vi' ? 'Khi trả kho, Staff lập biên bản trước–sau; khấu trừ phải có nội dung, số tiền và minh chứng.' : 'At move-out, Staff document before/after condition and itemize evidenced deductions.',
                      lang === 'vi' ? 'Khách được xem, đồng ý hoặc yêu cầu xem xét lại quyết toán trước khi đóng hồ sơ.' : 'The customer may review, accept or dispute the settlement before closure.'
                    ].map((term, index) => <div key={term} className="flex gap-2 rounded-lg bg-stone-50 p-3 leading-5"><span className="font-bold text-amber-700">{index + 1}.</span><span>{term}</span></div>)}</div></section>
                    {completedRenewals.length > 0 && <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{lang === 'vi' ? '4. Hợp đồng gia hạn đã phát hành' : '4. Issued renewal contracts'}</p><div className="space-y-2">{completedRenewals.map(renewal => {
                      const renewalContract = contracts.find(contract => contract.id === renewal.renewalContractId || contract.renewalId === renewal.id)
                      return <article key={renewal.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-emerald-950">{renewal.renewalContractNumber || renewalContract?.contractNumber || renewal.addendumNumber || renewal.id}</p><p className="mt-1 text-emerald-800">{renewal.oldEndDate} → {renewal.newEndDate} · {renewal.renewalMonths} {lang === 'vi' ? 'tháng' : 'months'}</p></div><p className="font-bold text-emerald-900">{formatVnd(renewal.totalAmount ?? renewal.renewalFee)}</p></div><div className="mt-3 grid gap-2 text-stone-700 sm:grid-cols-2"><p>{lang === 'vi' ? 'Hóa đơn' : 'Invoice'}: <b>{renewal.invoiceNumber}</b></p><p>{lang === 'vi' ? 'Thanh toán hoàn tất' : 'Payment completed'}: <b>{renewal.signedAt ? new Date(renewal.signedAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : '—'}</b></p></div>{renewalContract && <div className="mt-3 flex gap-2 border-t border-emerald-200 pt-3"><a href={renewalContract.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-900 underline">{lang === 'vi' ? 'Xem hợp đồng đã ký' : 'View signed contract'}</a><a href={renewalContract.scannedFileUrl} download={renewalContract.scannedFileName} className="font-bold text-emerald-900 underline">{lang === 'vi' ? 'Tải xuống' : 'Download'}</a></div>}</article>
                    })}</div></section>}
                  </div>
                  <div className="grid gap-3 border-t border-stone-200 p-5 sm:grid-cols-4">
                    <div className="rounded-lg bg-stone-50 p-3"><p className="text-stone-500">{lang === 'vi' ? 'Tổng giá trị thuê hiện hành' : 'Current total rental value'}</p><p className="mt-1 text-base font-bold text-stone-950">{formatVnd(currentTermValue)}</p><p className="mt-1 text-[10px] text-stone-500">{totalRentalMonths} {lang === 'vi' ? 'tháng, gồm các kỳ gia hạn đã hoàn tất' : 'months, including completed renewals'}</p></div>
                    <div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">{lang === 'vi' ? 'Tổng cọc giữ chỗ 20%' : 'Total 20% booking deposits'}</p><p className="mt-1 text-base font-bold text-blue-800">{formatVnd(totalBookingDeposit)}</p>{depositDueNow > 0 && <p className="mt-1 text-[10px] font-semibold text-blue-700">{lang === 'vi' ? `Cần thanh toán ngay: ${formatVnd(depositDueNow)}` : `Pay now: ${formatVnd(depositDueNow)}`}</p>}</div>
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">{lang === 'vi' ? 'Tiền đảm bảo kho' : 'Storage security deposit'}</p><p className="mt-1 text-base font-bold text-emerald-800">{formatVnd(securityDeposit)}</p></div>
                    <div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-800">{lang === 'vi' ? 'Còn thanh toán tại cơ sở' : 'Balance due on site'}</p><p className="mt-1 text-base font-bold text-amber-900">{formatVnd(balance)}</p><p className="mt-1 text-[10px] text-amber-700">{balance > 0 ? (lang === 'vi' ? 'Theo lịch gia hạn đang chờ hoàn tất' : 'From pending renewal appointments') : (lang === 'vi' ? 'Không còn khoản gia hạn phải thanh toán' : 'No renewal payment remains')}</p></div>
                  </div>
                  {signed ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-4">
                    <div><p className="font-bold text-stone-900">{signed.scannedFileName}</p><p className="mt-0.5 text-stone-500">{lang === 'vi' ? `Đã ký ${signed.signedAt} · Hiệu lực hiện hành ${signed.startDate} – ${effectiveEndDate}` : `Signed ${signed.signedAt} · Current term ${signed.startDate} – ${effectiveEndDate}`}</p></div>
                    <div className="flex gap-2"><a href={signed.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-stone-300 px-3 py-2 font-bold text-stone-800 hover:bg-stone-50">{lang === 'vi' ? 'Xem bản ký' : 'View signed copy'}</a><a href={signed.scannedFileUrl} download={signed.scannedFileName} className="rounded-lg bg-stone-900 px-3 py-2 font-bold text-white hover:bg-black">{lang === 'vi' ? 'Tải xuống' : 'Download'}</a></div>
                  </div> : <p className="border-t border-stone-200 px-5 py-4 text-stone-600">{lang === 'vi' ? 'Bản PDF đã ký sẽ hiển thị tại đây sau khi hai bên hoàn tất ký hợp đồng tại cơ sở.' : 'The signed PDF will appear here after both parties complete on-site signing.'}</p>}
                </>
              })()}
            </div>}
            {contractTab === 'receipt' && (() => {
              const receiptPayments = payments.filter(payment => payment.reservationId === activeHoldForContract.id)
              const relatedRental = rentals.find(rental => rental.holdId === activeHoldForContract.id || (rental.customerId === activeHoldForContract.customerId && rental.unitId === (activeHoldForContract.assignedUnitId || activeHoldForContract.unitId)))
              const completedRenewals = renewals.filter(renewal => renewal.rentalId === relatedRental?.id && renewal.status === 'completed')
              const rentalValue = activeHoldForContract.quote.baseMonthlyPrice * activeHoldForContract.rentalMonths + completedRenewals.reduce((sum, renewal) => sum + (renewal.totalAmount ?? renewal.renewalFee), 0)
              const securityDeposit = activeHoldForContract.securityDepositAmount ?? activeHoldForContract.quote.depositAmount
              const totalValue = rentalValue + securityDeposit
              const totalPaid = receiptPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + payment.amount, 0)
              const balance = Math.max(0, totalValue - totalPaid)
              return <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">{lang === 'vi' ? 'Hồ sơ biên nhận thanh toán' : 'Payment receipt file'}</p><p className="mt-1 text-lg font-bold text-stone-950">{activeHoldForContract.id}</p><p className="mt-1 text-stone-600">{activeHoldForContract.customerName} · {activeHoldForContract.customerEmail}</p></div><div className="text-right"><p className="text-stone-500">{lang === 'vi' ? 'Đơn vị nhận tiền' : 'Payee'}</p><p className="font-bold">StorageHub · {activeHoldForContract.facilityName}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Tiền thuê theo kỳ' : 'Term rent'}</p><p className="mt-1 text-lg font-bold">{formatVnd(rentalValue)}</p></div><div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">{lang === 'vi' ? 'Tiền đảm bảo kho' : 'Storage security deposit'}</p><p className="mt-1 text-lg font-bold text-emerald-800">{formatVnd(securityDeposit)}</p></div><div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">{lang === 'vi' ? 'Đã thu' : 'Collected'}</p><p className="mt-1 text-lg font-bold text-blue-800">{formatVnd(totalPaid)}</p></div><div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-800">{lang === 'vi' ? 'Còn phải thu' : 'Balance due'}</p><p className="mt-1 text-lg font-bold text-amber-900">{formatVnd(balance)}</p></div></div></div>
                {receiptPayments.map((payment, index) => <article key={payment.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{lang === 'vi' ? 'Biên nhận điện tử' : 'Electronic receipt'} #{index + 1}</p><p className="mt-1 font-mono text-sm font-bold">{payment.transactionReference || payment.id}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800">{payment.status === 'PAID' ? (lang === 'vi' ? 'Đã thanh toán' : 'Paid') : (lang === 'vi' ? 'Đang xử lý' : 'Pending')}</span></div><div className="grid gap-px bg-stone-200 sm:grid-cols-2">{[
                  [lang === 'vi' ? 'Số biên nhận' : 'Receipt number', payment.id],
                  [lang === 'vi' ? 'Ngày giờ thanh toán' : 'Paid at', payment.paidAt ? new Date(payment.paidAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : '—'],
                  [lang === 'vi' ? 'Người nộp tiền' : 'Payer', `${activeHoldForContract.customerName} · ${activeHoldForContract.customerEmail}`],
                  [lang === 'vi' ? 'Đơn vị nhận tiền' : 'Payee', `StorageHub · ${activeHoldForContract.facilityName}`],
                  [lang === 'vi' ? 'Nội dung thanh toán' : 'Payment description', payment.type === 'RENEWAL' && payment.id.startsWith('PAY-RNW-BAL-') ? (lang === 'vi' ? `Thanh toán phần còn lại của kỳ gia hạn: ${formatVnd(payment.amount)}` : `Remaining payment for the renewal term: ${formatVnd(payment.amount)}`) : payment.description || (payment.type === 'RESERVATION_DEPOSIT' ? (lang === 'vi' ? 'Cọc giữ chỗ 20% giá trị kỳ thuê' : '20% reservation deposit') : payment.type === 'INITIAL_RENT' ? (lang === 'vi' ? 'Thanh toán phần còn lại tại Check-in' : 'Remaining balance at check-in') : payment.type === 'RENEWAL' ? (lang === 'vi' ? 'Thanh toán gia hạn hợp đồng' : 'Contract renewal payment') : payment.type)],
                  [lang === 'vi' ? 'Số hóa đơn' : 'Invoice number', payment.invoiceNumber || '—'],
                  [lang === 'vi' ? 'Mã đơn / hợp đồng' : 'Reservation / contract', `${activeHoldForContract.id} · ${contracts.find(item => item.reservationId === activeHoldForContract.id)?.contractNumber || '—'}`],
                  [lang === 'vi' ? 'Phương thức' : 'Payment method', payment.paymentMethod || activeHoldForContract.payment.method || '—'],
                  [lang === 'vi' ? 'Mã giao dịch đối soát' : 'Transaction reference', payment.transactionReference || activeHoldForContract.payment.transactionId || payment.id],
                  [lang === 'vi' ? 'Số tiền / tiền tệ' : 'Amount / currency', `${formatVnd(payment.amount)} · VND`],
                  [lang === 'vi' ? 'Người ghi nhận' : 'Recorded by', payment.receivedBy || payment.recordedBy || 'StorageHub System']
                ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 font-bold leading-5 text-stone-900">{value}</p></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-4"><p className="text-stone-600">{lang === 'vi' ? 'Biên nhận được lưu trong hồ sơ khách hàng và dùng để đối chiếu thanh toán.' : 'This receipt is retained in the customer file for payment reconciliation.'}</p><p className="text-lg font-extrabold text-emerald-700">{formatVnd(payment.amount)}</p></div></article>)}
                {!receiptPayments.length && <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">{lang === 'vi' ? 'Chưa có giao dịch để phát hành biên nhận.' : 'No transaction is available for receipt issuance.'}</div>}
              </div>
            })()}
          </div>
        )}
      </Modal>

      {/* ── MODAL 5: SCHEDULE CHECK-IN ────────────────────────── */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={lang === 'vi' ? 'Đặt Lịch Hẹn Bàn Giao & Check-in' : 'Schedule Move-in Walkthrough'}
      >
        {activeHoldForSchedule && (
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              {lang === 'vi' ? 'Chọn ngày giờ bạn sẽ đến cơ sở để cùng nhân viên đối chiếu CCCD, cân đo hàng hóa thực tế và nhận mã PIN mở cửa:' : 'Pick a time to visit the facility, verify ID, measure actual cargo and receive your gate access code:'}
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><b>{lang === 'vi' ? 'Hạn đổi lịch:' : 'Reschedule deadline:'}</b> {activeHoldForSchedule.checkInDeadline ? dateInputValue(new Date(activeHoldForSchedule.checkInDeadline)) : (lang === 'vi' ? '14 ngày sau khi thanh toán cọc' : '14 days after deposit payment')}. {lang === 'vi' ? 'Ngày dự kiến trên đơn sẽ được cập nhật theo lịch mới.' : 'The expected check-in date on the reservation will update to the new schedule.'}</div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={lang === 'vi' ? 'Ngày hẹn' : 'Appointment Date'}
                type="date"
                value={appointmentDate}
                min={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })}
                max={activeHoldForSchedule.checkInDeadline ? dateInputValue(new Date(activeHoldForSchedule.checkInDeadline)) : undefined}
                onChange={e => setAppointmentDate(e.target.value)}
              />
              <div><Input label={lang === 'vi' ? 'Giờ Check-in (24/7)' : 'Check-in time (24/7)'} type="time" min="00:00" max="23:59" step="1800" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} /><p className="mt-1 text-[11px] text-blue-700">{lang === 'vi' ? 'Tạm mở toàn bộ khung giờ để kiểm thử nghiệp vụ Check-in.' : 'All times are temporarily enabled for check-in testing.'}</p></div>
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button>
              <Button
                disabled={!appointmentDate || !appointmentTime}
                onClick={() => {
                  try {
                    scheduleCheckIn(activeHoldForSchedule.id, appointmentDate, appointmentTime)
                    setScheduleModalOpen(false)
                    showToast(lang === 'vi' ? `Đã lên lịch check-in vào ${appointmentTime} ngày ${appointmentDate}!` : 'Appointment confirmed!')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể đặt lịch hẹn.')
                  }
                }}
              >
                 {lang === 'vi' ? 'Xác nhận lịch hẹn' : 'Confirm Slot'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 6: REQUEST RETURN ───────────────────────────── */}
      <Modal
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title={lang === 'vi' ? 'Yêu Cầu Thanh Lý & Trả Kho' : 'Request Unit Move-Out'}
      >
        {activeRentalForReturn && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-700 p-3 text-xs text-white">
              <p className="font-semibold">{lang === 'vi' ? `Gian kho ${activeRentalForReturn.unitId} (${activeRentalForReturn.facilityName})` : `Unit ${activeRentalForReturn.unitId}`}</p>
              <p>{lang === 'vi' ? 'Tiền đảm bảo kho sẽ được hoàn đầy đủ sau khi nghiệm thu xác nhận không có hư hại, phí vệ sinh hoặc công nợ.' : 'Your storage security deposit will be refunded in full when inspection confirms no damage, cleaning fee or outstanding balance.'}</p>
            </div>

            <Input
              label={lang === 'vi' ? 'Ngày dự kiến dọn đồ & bàn giao' : 'Planned move-out date'}
              type="date"
              value={returnTargetDate}
              min={dateInputValue(new Date())}
              max={parseCustomerDate(activeRentalForReturn.endDate) ? dateInputValue(parseCustomerDate(activeRentalForReturn.endDate)!) : undefined}
              onChange={e => setReturnTargetDate(e.target.value)}
            />
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">{lang === 'vi' ? `Ngày trả kho phải nằm trong thời hạn hợp đồng, từ hôm nay đến ${activeRentalForReturn.endDate}.` : `Move-out must be scheduled within the contract term, from today through ${activeRentalForReturn.endDate}.`}</p>

            <Select
              label={lang === 'vi' ? 'Lý do kết thúc' : 'Reason for move-out'}
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
            >
              <option value="Hết nhu cầu lưu trữ">Hết nhu cầu lưu trữ</option>
              <option value="Chuyển sang nhà/văn phòng mới">Chuyển sang nhà/văn phòng mới</option>
              <option value="Đổi sang gian kho kích thước khác">Đổi sang gian kho kích thước khác</option>
              <option value="Khác">Lý do khác</option>
            </Select>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button variant="outline" onClick={() => setReturnModalOpen(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button>
              <Button
                variant="danger"
                disabled={!returnTargetDate || Boolean(parseCustomerDate(activeRentalForReturn.endDate) && new Date(`${returnTargetDate}T00:00:00`).getTime() > parseCustomerDate(activeRentalForReturn.endDate)!.getTime())}
                onClick={() => {
                  const confirmed = window.confirm(lang === 'vi' ? `Xác nhận gửi yêu cầu trả gian kho ${activeRentalForReturn.unitId} vào ngày ${returnTargetDate}? Sau khi gửi, hợp đồng sẽ chuyển sang quy trình nghiệm thu.` : `Submit the move-out request for unit ${activeRentalForReturn.unitId} on ${returnTargetDate}?`)
                  if (!confirmed) return
                  try {
                    requestReturn(activeRentalForReturn.id, returnTargetDate, user, returnReason)
                    setReturnModalOpen(false)
                    showToast(lang === 'vi' ? 'Yêu cầu trả kho đã được tiếp nhận. Nhân viên sẽ chuẩn bị biên bản nghiệm thu!' : 'Move-out request registered!')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu trả kho.')
                  }
                }}
              >
                 {lang === 'vi' ? 'Gửi yêu cầu trả kho' : 'Submit Move-Out'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: REQUEST RENEWAL ────────────────────────────── */}
      <Modal
        open={renewalModalOpen}
        onClose={() => { setRenewalModalOpen(false); setEditingRenewalId(null) }}
        title={editingRenewalId ? (lang === 'vi' ? 'Chỉnh Sửa Yêu Cầu Gia Hạn' : 'Edit Renewal Request') : (lang === 'vi' ? 'Yêu Cầu Gia Hạn Hợp Đồng Thuê' : 'Request Rental Renewal')}
      >
        {activeRentalForRenewal && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-700 bg-blue-700 p-3 text-xs text-white space-y-1">
              <p className="font-semibold">{lang === 'vi' ? `Gian kho ${activeRentalForRenewal.unitId} (${activeRentalForRenewal.facilityName})` : `Unit ${activeRentalForRenewal.unitId}`}</p>
              <p>{lang === 'vi' ? `Hạn hợp đồng hiện tại: ${activeRentalForRenewal.endDate}. Giá thuê: ${formatVnd(activeRentalForRenewal.monthlyRate)}/tháng.` : `Current end date: ${activeRentalForRenewal.endDate}. Rate: ${formatVnd(activeRentalForRenewal.monthlyRate)}/mo.`}</p>
              <p className="text-[11px] text-white">
                {lang === 'vi' ? 'Facility Manager sẽ kiểm tra xung đột lịch đặt trước khi phê duyệt gia hạn cho bạn.' : 'Facility Manager will verify schedule conflicts before approving your renewal.'}
              </p>
            </div>

            <Select label={lang === 'vi' ? 'Chọn gói gia hạn' : 'Extension package'} value={renewalMonths.toString()} onChange={e => setRenewalMonths(Number(e.target.value))}>
              <option value="1">1 {lang === 'vi' ? 'tháng' : 'month'}</option>
              <option value="3">3 {lang === 'vi' ? 'tháng' : 'months'}</option>
              <option value="6">6 {lang === 'vi' ? 'tháng' : 'months'}</option>
              <option value="12">12 {lang === 'vi' ? 'tháng' : 'months'}</option>
            </Select>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs"><div><p className="text-stone-500">{lang === 'vi' ? 'Ngày hết hạn mới dự kiến' : 'New expected end date'}</p><p className="mt-1 font-bold">{addMonthsForPreview(activeRentalForRenewal.endDate, renewalMonths)}</p></div><div><p className="text-stone-500">{lang === 'vi' ? 'Phí gia hạn' : 'Extension fee'}</p><p className="mt-1 font-bold">{formatVnd(activeRentalForRenewal.monthlyRate * renewalMonths)}</p></div></div>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button variant="outline" onClick={() => setRenewalModalOpen(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button>
              <Button
                onClick={() => {
                  try {
                    if (editingRenewalId) updateRenewalRequest(editingRenewalId, renewalMonths, user)
                    else requestRenewal(activeRentalForRenewal.id, renewalMonths, user)
                    setRenewalModalOpen(false)
                    setEditingRenewalId(null)
                    showToast(editingRenewalId ? (lang === 'vi' ? 'Đã cập nhật yêu cầu và thông báo lại cho Manager.' : 'Request updated and Manager notified.') : (lang === 'vi' ? 'Đã gửi yêu cầu gia hạn tới Facility Manager!' : 'Renewal request submitted to Facility Manager!'))
                  } catch (err: any) {
                    showToast(err?.message || 'Error requesting renewal')
                  }
                }}
              >
                 {editingRenewalId ? (lang === 'vi' ? 'Lưu thay đổi' : 'Save changes') : (lang === 'vi' ? 'Gửi yêu cầu gia hạn' : 'Submit Renewal')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={renewalPaymentOpen}
        onClose={() => setRenewalPaymentOpen(false)}
        title={lang === 'vi' ? 'Xác Nhận Thanh Toán Gia Hạn' : 'Confirm Renewal Payment'}
      >
        {activeRenewalForPayment && (() => {
          const rental = rentals.find(item => item.id === activeRenewalForPayment.rentalId)
          const paymentExpired = Boolean(activeRenewalForPayment.paymentDueAt && new Date(activeRenewalForPayment.paymentDueAt).getTime() <= now)
          const renewalTotal = activeRenewalForPayment.totalAmount ?? activeRenewalForPayment.renewalFee
          const renewalDeposit = activeRenewalForPayment.bookingDepositAmount ?? Math.round(renewalTotal * 0.2 * 100) / 100
          const remainingAtFacility = activeRenewalForPayment.remainingAmount ?? Math.round(renewalTotal * 0.8 * 100) / 100
          const oldEndAt = new Date(`${activeRenewalForPayment.oldEndDate}T23:59:59`)
          const isOverdue = oldEndAt.getTime() < now
          const latestAppointment = new Date(now); latestAppointment.setDate(latestAppointment.getDate() + 7)
          const renewalEffectiveAt = new Date(`${activeRenewalForPayment.oldEndDate}T12:00:00`); renewalEffectiveAt.setDate(renewalEffectiveAt.getDate() + 1)
          const renewalMonthlyRate = activeRenewalForPayment.originalMonthlyRate ?? rental?.monthlyRate ?? 0
          const dailyRentalRate = Math.round((renewalMonthlyRate / 30) * 100) / 100
          const lateFeePerDay = Math.round(((renewalMonthlyRate / 30) * 0.5) * 100) / 100
          const selectedAppointmentDay = renewalAppointmentDate ? new Date(`${renewalAppointmentDate}T00:00:00`) : new Date(now)
          const paymentDay = new Date(now); paymentDay.setHours(0, 0, 0, 0)
          const projectedLateThrough = selectedAppointmentDay.getTime() > paymentDay.getTime() ? selectedAppointmentDay : paymentDay
          const overdueStart = new Date(`${activeRenewalForPayment.oldEndDate}T00:00:00`); overdueStart.setDate(overdueStart.getDate() + 1)
          const projectedOverdueDays = projectedLateThrough.getTime() >= overdueStart.getTime() ? Math.floor((projectedLateThrough.getTime() - overdueStart.getTime()) / 86_400_000) + 1 : 0
          const projectedLateFee = Math.round(projectedOverdueDays * lateFeePerDay * 100) / 100
          const projectedOnSiteTotal = Math.round((remainingAtFacility + projectedLateFee) * 100) / 100
          return <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{lang === 'vi' ? 'Hóa đơn gia hạn đã được duyệt' : 'Approved renewal invoice'}</p><p className="mt-1 text-lg font-bold text-stone-950">{activeRenewalForPayment.invoiceNumber}</p><p className="mt-1 text-stone-600">{activeRenewalForPayment.unitId} · {activeRenewalForPayment.renewalMonths} {lang === 'vi' ? 'tháng' : 'months'}</p></div>
                <div className="text-right"><p className="text-xs text-stone-500">{lang === 'vi' ? 'Cọc gia hạn 20%' : '20% renewal deposit'}</p><p className="text-2xl font-extrabold text-stone-950">{formatVnd(renewalDeposit)}</p></div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Thời hạn cuối thuê kho' : 'Current rental expiry date'}</p><p className="mt-1 font-bold">{activeRenewalForPayment.oldEndDate}</p></div>
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Kỳ gia hạn liên tục' : 'Continuous renewal term'}</p><p className="mt-1 font-bold">{dateInputValue(renewalEffectiveAt)} → {activeRenewalForPayment.newEndDate}</p></div>
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Đơn giá giữ nguyên' : 'Monthly rate'}</p><p className="mt-1 font-bold">{formatVnd(activeRenewalForPayment.originalMonthlyRate ?? rental?.monthlyRate ?? 0)}/{lang === 'vi' ? 'tháng' : 'month'}</p></div>
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{lang === 'vi' ? 'Hạn thanh toán cọc 72 giờ' : '72-hour deposit deadline'}</p><p className={`mt-1 font-bold ${paymentExpired ? 'text-red-700' : 'text-amber-800'}`}>{activeRenewalForPayment.paymentDueAt ? new Date(activeRenewalForPayment.paymentDueAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : '—'}</p></div>
              </div>
              {!paymentExpired && activeRenewalForPayment.paymentDueAt && <div className="mt-3 rounded-lg bg-red-700 px-4 py-3 text-center text-white"><p className="text-[10px] font-bold uppercase tracking-widest">{lang === 'vi' ? 'Thời gian thanh toán cọc còn lại' : 'Deposit payment time remaining'}</p><p className="mt-1 font-mono text-2xl font-extrabold">{formatCountdown(activeRenewalForPayment.paymentDueAt).text}</p></div>}
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 leading-5 text-blue-950">{lang === 'vi' ? `Khoản ${formatVnd(renewalDeposit)} chỉ giữ kỳ gia hạn. Thời hạn thuê chưa được kéo dài cho đến khi bạn đến cơ sở ký hợp đồng gia hạn mới và đóng ${formatVnd(remainingAtFacility)} còn lại.` : `The ${formatVnd(renewalDeposit)} payment only reserves the extension. The rental is not extended until you sign a new renewal contract on site and pay the remaining ${formatVnd(remainingAtFacility)}.`}</div>
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 leading-5 text-red-900">
              <p className="font-bold">{lang === 'vi' ? 'Chính sách phụ thu quá hạn' : 'Overdue surcharge policy'}</p>
              <p className="mt-1">{lang === 'vi' ? `Thời hạn thuê hiện tại kết thúc ngày ${activeRenewalForPayment.oldEndDate}. Nếu hợp đồng gia hạn được ký sau ngày này, phụ thu được tính từ ngày kế tiếp sau khi hết hạn đến ngày ký thực tế.` : `The current rental term ends on ${activeRenewalForPayment.oldEndDate}. If the renewal contract is signed after this date, a surcharge applies from the following day through the actual signing date.`}</p>
              <p className="mt-2 font-semibold">{lang === 'vi' ? `Mức phụ thu: ${formatVnd(lateFeePerDay)} cho mỗi ngày quá hạn (tương đương 50% đơn giá thuê ngày: ${formatVnd(renewalMonthlyRate)} ÷ 30 ngày = ${formatVnd(dailyRentalRate)}/ngày).` : `Surcharge: ${formatVnd(lateFeePerDay)} per overdue day (50% of the daily rental rate: ${formatVnd(renewalMonthlyRate)} ÷ 30 days = ${formatVnd(dailyRentalRate)}/day).`}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={lang === 'vi' ? 'Ngày đến cơ sở ký hợp đồng gia hạn' : 'On-site renewal signing date'} type="date" min={dateInputValue(new Date(now))} max={dateInputValue(latestAppointment)} value={renewalAppointmentDate} onChange={event => setRenewalAppointmentDate(event.target.value)} />
              <Input label={lang === 'vi' ? 'Giờ hẹn' : 'Appointment time'} type="time" min="08:00" max="17:00" value={renewalAppointmentTime} onChange={event => setRenewalAppointmentTime(event.target.value)} />
            </div>
            <p className={`rounded-lg p-3 leading-5 ${isOverdue || projectedOverdueDays > 0 ? 'border border-red-300 bg-red-50 font-semibold text-red-800' : 'bg-stone-100 text-stone-700'}`}>{lang === 'vi' ? `Bạn được chọn lịch trong 7 ngày, chậm nhất ${dateInputValue(latestAppointment)}. Hợp đồng cũ hết hạn ${activeRenewalForPayment.oldEndDate}; thanh toán hoặc ký sau ngày này sẽ tính phí muộn. Kỳ mới vẫn có hiệu lực liên tục từ ${dateInputValue(renewalEffectiveAt)}, không có ngày trống.` : `You may schedule within 7 days, no later than ${dateInputValue(latestAppointment)}. The previous contract ends ${activeRenewalForPayment.oldEndDate}; paying or signing later incurs late fees. The new term remains continuous from ${dateInputValue(renewalEffectiveAt)} with no gap.`}</p>
            <Select label={lang === 'vi' ? 'Phương thức thanh toán' : 'Payment method'} value={renewalPaymentMethod} onChange={event => setRenewalPaymentMethod(event.target.value as 'BANK_TRANSFER' | 'ONLINE_GATEWAY')}>
              <option value="BANK_TRANSFER">{lang === 'vi' ? 'Chuyển khoản ngân hàng / VietQR' : 'Bank transfer / VietQR'}</option>
              <option value="ONLINE_GATEWAY">{lang === 'vi' ? 'Cổng thanh toán trực tuyến' : 'Online payment gateway'}</option>
            </Select>
            <div className="overflow-hidden rounded-xl border border-stone-300 bg-white">
              <p className="border-b border-stone-200 bg-stone-100 px-4 py-2 font-bold text-stone-900">{lang === 'vi' ? 'Chi tiết số tiền trước khi xác nhận' : 'Payment details before confirmation'}</p>
              <div className="space-y-2 p-4 text-stone-700"><div className="flex justify-between"><span>{lang === 'vi' ? 'Tổng giá trị kỳ gia hạn' : 'Renewal term value'}</span><b>{formatVnd(renewalTotal)}</b></div><div className="flex justify-between text-blue-700"><span>{lang === 'vi' ? 'Thanh toán cọc ngay (20%)' : 'Deposit payable now (20%)'}</span><b>{formatVnd(renewalDeposit)}</b></div><div className="flex justify-between"><span>{lang === 'vi' ? 'Phần còn lại tại cơ sở (80%)' : 'Remaining on site (80%)'}</span><b>{formatVnd(remainingAtFacility)}</b></div><div className={`flex justify-between ${projectedLateFee > 0 ? 'font-semibold text-red-700' : ''}`}><span>{lang === 'vi' ? `Phí muộn dự kiến (${projectedOverdueDays} ngày × ${formatVnd(lateFeePerDay)})` : `Estimated late fee (${projectedOverdueDays} days × ${formatVnd(lateFeePerDay)})`}</span><b>{formatVnd(projectedLateFee)}</b></div><div className="flex justify-between border-t border-stone-200 pt-2 text-base font-extrabold text-stone-950"><span>{lang === 'vi' ? 'Dự kiến đóng tại cơ sở' : 'Estimated due on site'}</span><span>{formatVnd(projectedOnSiteTotal)}</span></div></div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-3 leading-5"><input type="checkbox" className="mt-1" checked={renewalTermsAccepted} onChange={event => setRenewalTermsAccepted(event.target.checked)} /><span>{lang === 'vi' ? 'Tôi đồng ý cọc 20% để giữ kỳ gia hạn, đến cơ sở đúng lịch để ký và đóng 80% còn lại; tôi đã biết phí sẽ tăng theo từng ngày nếu lịch hẹn sau ngày hết hạn.' : 'I agree to pay a 20% deposit, sign and pay the remaining 80% on site, and acknowledge the daily late fee after the current expiry date.'}</span></label>
            {paymentExpired && <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">{lang === 'vi' ? 'Đã quá thời hạn thanh toán 72 giờ. Vui lòng gửi yêu cầu gia hạn mới.' : 'The 72-hour payment window has expired. Submit a new renewal request.'}</p>}
            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3"><Button variant="outline" onClick={() => setRenewalPaymentOpen(false)}>{lang === 'vi' ? 'Đóng' : 'Close'}</Button><Button disabled={paymentExpired || !renewalAppointmentDate || !renewalAppointmentTime || !renewalTermsAccepted} onClick={() => {
              try {
                const reference = `${renewalPaymentMethod === 'ONLINE_GATEWAY' ? 'GW' : 'BANK'}-${Date.now()}`
                payRenewal(activeRenewalForPayment.id, user, renewalPaymentMethod, reference, renewalTermsAccepted, renewalAppointmentDate, renewalAppointmentTime)
                setRenewalPaymentOpen(false)
                setRenewalTermsAccepted(false)
                showToast(lang === 'vi' ? 'Đã cọc 20% và đặt lịch ký. Hợp đồng chỉ được gia hạn sau khi Staff xác nhận ký và thu phần còn lại.' : 'The 20% deposit and signing appointment are confirmed. The contract extends only after on-site completion.')
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Không thể xác minh thanh toán gia hạn.')
              }
            }}>{lang === 'vi' ? 'Thanh toán cọc & đặt lịch' : 'Pay deposit & schedule'}</Button></div>
          </div>
        })()}
      </Modal>

      {/* ── MODAL 7: SUPPORT TICKET CONVERSATION ───────────────── */}
      <Modal
        open={conversationOpen}
        onClose={() => setConversationOpen(false)}
        title={lang === 'vi' ? 'Trao Đổi Trực Tuyến Hỗ Trợ' : 'Support Ticket'}
      >
        {selectedTicket && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#292a27] p-4 text-white">
              <div className="flex justify-between items-center text-xs font-mono text-[#e9a12c]">
                <span>{selectedTicket.id}</span>
                <span>{selectedTicket.category}</span>
              </div>
              <h3 className="font-bold text-base mt-1 text-stone-100">{selectedTicket.subject}</h3>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {(tickets.find(ticket => ticket.id === selectedTicket.id)?.messages || selectedTicket.messages).map(msg => {
                const isMine = msg.role === 'customer' || msg.sender === user.name || msg.sender === selectedTicket.customer
                return <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs shadow-sm ${isMine ? 'rounded-br-sm bg-amber-500 text-stone-950' : 'rounded-bl-sm border border-blue-200 bg-blue-50 text-blue-950'}`}><div className={`mb-1 flex items-center gap-3 text-[10px] ${isMine ? 'justify-end text-amber-950/70' : 'justify-between text-blue-700'}`}><b>{isMine ? (lang === 'vi' ? 'Bạn' : 'You') : msg.sender}</b><span>{msg.time}</span></div><p className="whitespace-pre-wrap leading-5">{msg.text}</p></div></div>
              })}
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-2">
              <textarea
                rows={2}
                placeholder={lang === 'vi' ? 'Nhập tin nhắn của bạn...' : 'Type your message...'}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-2 text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  disabled={!replyText.trim()}
                  onClick={() => {
                    try {
                      replySupportTicket(selectedTicket.id, replyText, user)
                      setReplyText('')
                      showToast(selectedTicket.status === 'resolved' ? (lang === 'vi' ? 'Đã gửi tin nhắn và mở lại yêu cầu.' : 'Message sent and request reopened.') : (lang === 'vi' ? 'Đã gửi tin nhắn!' : 'Message sent!'))
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Không thể gửi tin nhắn.')
                    }
                  }}
                >
                  {lang === 'vi' ? 'Gửi tin nhắn' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 8: CREATE TICKET ─────────────────────────────── */}
      <Modal
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        title={lang === 'vi' ? 'Tạo Yêu Cầu Hỗ Trợ Mới' : 'Create New Support Request'}
      >
        <div className="space-y-4">
          <Select label={lang === 'vi' ? 'Hồ sơ cần hỗ trợ' : 'Related storage record'} value={ticketRelatedRecord} onChange={e => setTicketRelatedRecord(e.target.value)}>
            <option value="general">{lang === 'vi' ? 'Tư vấn chung · Không gắn với kho cụ thể' : 'General inquiry · No specific unit'}</option>
            {myRentals.map(rental => <option key={rental.id} value={`rental:${rental.id}`}>{lang === 'vi' ? 'Hợp đồng' : 'Rental'} {rental.id} · {rental.facilityName} · {rental.unitId}</option>)}
            {myHolds.filter(hold => !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status)).map(hold => <option key={hold.id} value={`reservation:${hold.id}`}>{lang === 'vi' ? 'Đơn giữ kho' : 'Reservation'} {hold.id} · {hold.facilityName} · {hold.assignedUnitId || hold.unitTypeName}</option>)}
          </Select>
          <Input
            label={lang === 'vi' ? 'Tiêu đề yêu cầu' : 'Subject'}
            value={ticketSubject}
            onChange={e => setTicketSubject(e.target.value)}
            placeholder={lang === 'vi' ? 'Tóm tắt sự cố (ví dụ: Khóa cổng không nhận mã PIN)' : 'Summary'}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label={lang === 'vi' ? 'Phân loại' : 'Category'} value={ticketCategory} onChange={e => setTicketCategory(e.target.value)}>
              <option value="Access & Entry">{lang === 'vi' ? 'Ra vào & mã PIN' : 'Access & Entry'}</option>
              <option value="Billing & Invoices">{lang === 'vi' ? 'Thanh toán & hóa đơn' : 'Billing & Invoices'}</option>
              <option value="Unit Condition">{lang === 'vi' ? 'Hiện trạng gian kho' : 'Unit Condition'}</option>
              <option value="General Inquiry">{lang === 'vi' ? 'Tư vấn chung' : 'General Inquiry'}</option>
            </Select>
            <Select label={lang === 'vi' ? 'Mức độ ảnh hưởng' : 'Impact level'} value={ticketPriority} onChange={e => setTicketPriority(e.target.value as any)}>
              <option value="low">{lang === 'vi' ? 'Thấp · Chỉ cần tư vấn' : 'Low · Information only'}</option>
              <option value="medium">{lang === 'vi' ? 'Vừa · Ảnh hưởng sử dụng' : 'Medium · Usage affected'}</option>
              <option value="high">{lang === 'vi' ? 'Cao · Không thể ra vào kho' : 'High · Cannot access unit'}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">{lang === 'vi' ? 'Chi tiết' : 'Description'}</label>
            <textarea
              rows={3}
              value={ticketDescription}
              onChange={e => setTicketDescription(e.target.value)}
              className="w-full border border-stone-300 rounded-lg p-2 text-xs"
              placeholder={lang === 'vi' ? 'Mô tả vấn đề bạn đang gặp phải...' : 'Details...'}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
            <Button variant="outline" onClick={() => setTicketOpen(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button>
            <Button
              disabled={!ticketSubject.trim() || !ticketDescription.trim()}
              onClick={() => {
                const [relatedType, relatedId] = ticketRelatedRecord.includes(':') ? ticketRelatedRecord.split(':') : ['general', '']
                const relatedRental = relatedType === 'rental' ? myRentals.find(item => item.id === relatedId) : undefined
                const relatedHold = relatedType === 'reservation' ? myHolds.find(item => item.id === relatedId) : undefined
                try {
                  createSupportTicket({
                    customer: user.name,
                    email: user.email,
                    subject: ticketSubject.trim(),
                    category: ticketCategory,
                    priority: ticketPriority,
                    status: 'open',
                    facility: relatedRental?.facilityName || relatedHold?.facilityName || (lang === 'vi' ? 'Không áp dụng' : 'Not applicable'),
                    unit: relatedRental?.unitId || relatedHold?.assignedUnitId || relatedHold?.unitTypeName || '—',
                    facilityId: relatedRental?.facilityId || relatedHold?.facilityId,
                    relatedType: relatedType as 'rental' | 'reservation' | 'general',
                    relatedId: relatedId || undefined
                  }, ticketDescription.trim())
                  setTicketOpen(false)
                  setTicketSubject('')
                  setTicketDescription('')
                  setTicketRelatedRecord('general')
                  showToast(lang === 'vi' ? 'Đã gửi yêu cầu hỗ trợ tới ban quản lý!' : 'Ticket submitted!')
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Không thể tạo yêu cầu hỗ trợ.')
                }
              }}
            >
              {lang === 'vi' ? 'Gửi yêu cầu' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </Layout>
  )
}
