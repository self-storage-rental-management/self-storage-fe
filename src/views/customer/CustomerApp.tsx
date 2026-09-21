import { useState, useEffect, useRef } from 'react'
import Layout, { getInitialPage, Icon, type LayoutNotification, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Input, Select, Tabs, Avatar } from '../../components/ui'
import { formatVnd, USD_TO_VND_RATE } from '../../i18n/currency'
import type { User } from '../../types'
import type { Facility, StorageUnit, StorageHold, UnitType } from '../../types/storageHub'
import { useStorageHub } from '../../store/StorageHubContext'
import ProfileView from '../ProfileView'
import type { TicketItem } from '../../data/demoDatabase'

const CUSTOMER_FACILITY_DISPLAY: Record<string, { code: string; name: string; address: string }> = {
  'fac-001': {
    code: 'HCM-Q1-F01',
    name: 'Kho Việt – Cơ sở Quận 1',
    address: '125 Nguyễn Bỉnh Khiêm, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  },
  'fac-002': {
    code: 'BD-F01',
    name: 'Kho Việt – Cơ sở Bình Dương',
    address: '468 Đại lộ Bình Dương, Phường Lái Thiêu, TP. Thuận An, Bình Dương',
  },
}
type CustomerCatalogUnit = StorageUnit & {
  sizeCode: 'S' | 'M' | 'L' | 'XL'
  rackCount: number
  rackDimensions: string
  aisleWidthM: number
  smallBoxCapacity: number
  largeBoxCapacity: number
  trolley: string
}
const CUSTOMER_UNIT_SPECS = {
  S: { type: 'Small', dimensions: [5.6, 6, 3.2], volumeM3: 107.52, rackCount: 4, aisleWidthM: 1.8, smallBoxCapacity: 256, largeBoxCapacity: 96, trolley: 'Xe đẩy tay / xe sàn nhỏ (0,8×0,5 m)', price: 5_500_000 / USD_TO_VND_RATE, maxLoadKg: 600 },
  M: { type: 'Medium', dimensions: [9, 6.4, 3.4], volumeM3: 195.84, rackCount: 6, aisleWidthM: 2.2, smallBoxCapacity: 384, largeBoxCapacity: 144, trolley: 'Platform trolley (0,9×0,6 m)', price: 9_500_000 / USD_TO_VND_RATE, maxLoadKg: 1200 },
  L: { type: 'Large', dimensions: [13.5, 6.8, 3.6], volumeM3: 330.48, rackCount: 8, aisleWidthM: 2.6, smallBoxCapacity: 576, largeBoxCapacity: 224, trolley: 'Pallet jack tay (1,6×0,7 m)', price: 15_000_000 / USD_TO_VND_RATE, maxLoadKg: 2400 },
  XL: { type: 'Extra Large', dimensions: [19, 7.2, 4], volumeM3: 547.2, rackCount: 10, aisleWidthM: 3, smallBoxCapacity: 800, largeBoxCapacity: 320, trolley: 'Electric walkie pallet truck (1,8×0,8 m)', price: 22_500_000 / USD_TO_VND_RATE, maxLoadKg: 3600 },
} as const

const CUSTOMER_CATALOG_UNITS: CustomerCatalogUnit[] = Object.entries({ 'fac-001': 'HCM-Q1-F01', 'fac-002': 'BD-F01' }).flatMap(([facilityId, prefix]) =>
  (Object.entries(CUSTOMER_UNIT_SPECS) as [CustomerCatalogUnit['sizeCode'], (typeof CUSTOMER_UNIT_SPECS)[keyof typeof CUSTOMER_UNIT_SPECS]][]).flatMap(([sizeCode, spec]) =>
    Array.from({ length: 5 }, (_, index) => {
      const code = `${prefix}-${sizeCode}-${String(index + 1).padStart(3, '0')}`
      const [lengthM, widthM, heightM] = spec.dimensions
      return {
        id: code,
        code,
        facilityId,
        facilityName: CUSTOMER_FACILITY_DISPLAY[facilityId].name,
        floor: 1,
        zone: `Khu ${sizeCode}`,
        type: spec.type,
        sizeCode,
        areaM2: lengthM * widthM,
        dimensions: { lengthM, widthM, heightM },
        doorDimensions: { widthM: 2, heightM: 2.4 },
        volumeM3: spec.volumeM3,
        maxLoadKg: spec.maxLoadKg,
        rackCount: spec.rackCount,
        rackDimensions: '0,8×2,0 m',
        aisleWidthM: spec.aisleWidthM,
        smallBoxCapacity: spec.smallBoxCapacity,
        largeBoxCapacity: spec.largeBoxCapacity,
        trolley: spec.trolley,
        allowedGoods: ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
        prohibitedGoods: ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
        price: spec.price,
        deposit: spec.price,
        climate: true,
        status: 'available' as const,
        reservedPeriods: [],
        version: 1,
      }
    })
  )
)

const CUSTOMER_DEMO_HELD_UNIT_ID = 'HCM-Q1-F01-S-001'
const CUSTOMER_UNITS_PER_PAGE = 6
type GoodsDeclarationItem = {
  id: string
  category: string
  materialType: '' | 'NORMAL' | 'FRAGILE'
  materialName: string
  customGoodsName: string
  description: string
  customMaterial: string
  quantity: string
  lengthCm: string
  widthCm: string
  heightCm: string
  weightKg: string
  fragile: '' | 'yes' | 'no'
  customerNote: string
  images: string[]
}
type PackageSample = { id: string; quantity: string; lengthCm: string; widthCm: string; heightCm: string; sourceLabel?: string }
type PackageSampleField = keyof Omit<PackageSample, 'id'>
type CapacityStatus = 'invalid' | 'fits' | 'not-fit'

const GOODS_CATEGORY_OPTIONS = [
  ['FURNITURE', 'Đồ gia dụng & nội thất'], ['KITCHENWARE', 'Đồ dùng nhà bếp'], ['DECOR', 'Đồ trang trí & thủ công'],
  ['ELECTRONICS', 'Đồ điện tử & thiết bị điện'], ['OFFICE', 'Thiết bị văn phòng'], ['TOYS', 'Đồ chơi & đồ trẻ em'],
  ['SPORTS', 'Đồ thể thao'], ['GIFTS', 'Quà tặng & đồ lưu niệm'], ['MUSICAL_INSTRUMENTS', 'Nhạc cụ'],
  ['CAMERA_EQUIPMENT', 'Thiết bị chụp ảnh / quay phim'], ['EVENT_EQUIPMENT', 'Thiết bị sự kiện / triển lãm'],
  ['STORE_FIXTURES', 'Kệ, tủ & vật dụng cửa hàng'], ['FINE_ART', 'Đồ mỹ thuật'], ['CERAMIC_GLASS', 'Đồ gốm / thủy tinh'],
  ['MOVING_ITEMS', 'Vật dụng chuyển nhà'], ['OTHER', 'Khác'],
] as const
type GoodsCategoryCode = typeof GOODS_CATEGORY_OPTIONS[number][0]
const MATERIALS_BY_CATEGORY: Record<Exclude<GoodsCategoryCode, 'OTHER'>, { normal: string[]; fragile: string[] }> = {
  FURNITURE: { normal: ['Gỗ', 'Nhựa', 'Kim loại', 'Vải', 'Da', 'Cao su'], fragile: ['Kính', 'Gương', 'Đá tự nhiên', 'Đá nhân tạo'] },
  KITCHENWARE: { normal: ['Inox', 'Kim loại', 'Nhựa', 'Gỗ'], fragile: ['Thủy tinh', 'Pha lê', 'Gốm', 'Sứ'] },
  DECOR: { normal: ['Gỗ', 'Nhựa', 'Kim loại', 'Vải', 'Giấy'], fragile: ['Thủy tinh', 'Pha lê', 'Gốm', 'Sứ'] },
  ELECTRONICS: { normal: ['Nhựa', 'Kim loại', 'Cao su'], fragile: ['Kính màn hình', 'Tấm kính', 'Màn hình LCD/LED'] },
  OFFICE: { normal: ['Nhựa', 'Kim loại', 'Gỗ', 'Giấy'], fragile: ['Kính'] },
  TOYS: { normal: ['Nhựa', 'Gỗ', 'Vải', 'Cao su', 'Kim loại'], fragile: ['Kính hoặc chi tiết thủy tinh nếu có'] },
  SPORTS: { normal: ['Nhựa', 'Cao su', 'Kim loại', 'Vải', 'Da', 'Composite'], fragile: ['Kính', 'Vật liệu carbon mỏng cần bảo vệ đặc biệt'] },
  GIFTS: { normal: ['Gỗ', 'Nhựa', 'Kim loại', 'Vải', 'Giấy'], fragile: ['Thủy tinh', 'Pha lê', 'Gốm', 'Sứ'] },
  MUSICAL_INSTRUMENTS: { normal: ['Gỗ', 'Kim loại', 'Nhựa', 'Da', 'Vải'], fragile: ['Bộ phận kính hoặc vật liệu mỏng, dễ nứt'] },
  CAMERA_EQUIPMENT: { normal: ['Nhựa', 'Kim loại', 'Cao su'], fragile: ['Kính quang học', 'Ống kính'] },
  EVENT_EQUIPMENT: { normal: ['Kim loại', 'Nhựa', 'Vải', 'Gỗ'], fragile: ['Kính', 'Mica cứng dễ nứt'] },
  STORE_FIXTURES: { normal: ['Kim loại', 'Gỗ', 'Nhựa'], fragile: ['Kính', 'Gương'] },
  FINE_ART: { normal: ['Giấy', 'Vải', 'Canvas', 'Gỗ'], fragile: ['Kính khung tranh', 'Gốm', 'Tượng dễ vỡ'] },
  CERAMIC_GLASS: { normal: [], fragile: ['Thủy tinh', 'Pha lê', 'Gốm', 'Sứ'] },
  MOVING_ITEMS: { normal: ['Gỗ', 'Nhựa', 'Kim loại', 'Vải', 'Carton'], fragile: ['Kính', 'Gương', 'Gốm', 'Sứ'] },
}
const createGoodsDeclarationItem = (id = `goods-${Date.now()}`): GoodsDeclarationItem => ({ id, category: '', materialType: '', materialName: '', customGoodsName: '', description: '', customMaterial: '', quantity: '', lengthCm: '', widthCm: '', heightCm: '', weightKg: '', fragile: '', customerNote: '', images: [] })

const rentalDiscountRate = (months: number) => months === 3 ? 0.03 : months === 6 ? 0.05 : months === 12 ? 0.08 : 0
const parsePositiveNumber = (rawValue: string) => {
  if (rawValue.trim() === '') return null
  const value = Number(rawValue)
  return Number.isFinite(value) && value > 0 ? value : null
}
const isPackageSampleValid = (sample: PackageSample) => {
  const quantity = parsePositiveNumber(sample.quantity)
  return quantity !== null
    && Number.isInteger(quantity)
    && parsePositiveNumber(sample.lengthCm) !== null
    && parsePositiveNumber(sample.widthCm) !== null
    && parsePositiveNumber(sample.heightCm) !== null
}
const packageCapacityPerFrame = (sample: PackageSample, frameHeight: number) => {
  if (!isPackageSampleValid(sample)) return 0
  const dimensions = [Number(sample.lengthCm) / 100, Number(sample.widthCm) / 100, Number(sample.heightCm) / 100]
  const [a, b, c] = dimensions
  const orientations = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]
  return Math.max(...orientations.map(([x, y, z]) => Math.floor(0.8 / x) * Math.floor(2 / y) * Math.floor(frameHeight / z)))
}
const CUSTOMER_UNIT_IMAGE_BY_SIZE: Record<CustomerCatalogUnit['sizeCode'], string> = {
  S: '/images/customer-units/kho-s.jpg',
  M: '/images/customer-units/kho-m.jpg',
  L: '/images/customer-units/kho-l.jpg',
  XL: '/images/customer-units/kho-xl.jpg',
}
const CUSTOMER_UNIT_DETAIL_IMAGE_BY_SIZE: Record<CustomerCatalogUnit['sizeCode'], string> = {
  S: '/images/customer-units/details/kho-s-chi-tiet.png',
  M: '/images/customer-units/details/kho-m-chi-tiet.png',
  L: '/images/customer-units/details/kho-l-chi-tiet.png',
  XL: '/images/customer-units/details/kho-xl-chi-tiet.png',
}
const SearchIcon = <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>

const statusLabelMap: Record<string, string> = {
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
}
interface SizeCategoryCardProps {
  facility: Facility
  unitType: UnitType
  availableCount: number
  onReserve: (facility: Facility, unitType: UnitType) => void
  onViewSpecs: (facility: Facility, unitType: UnitType, availableCount: number) => void
}

function SizeCategoryCard({ facility, unitType, availableCount, onReserve, onViewSpecs }: SizeCategoryCardProps) {
  const isAvailable = availableCount > 0
  const usableCapacity = Math.round(unitType.volumeM3 * 0.75 * 10) / 10

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-lg">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-stone-500">{'Cỡ kho'}</p>
            <h3 className="mt-1 text-xl font-bold leading-tight text-black">{unitType.name}</h3>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${isAvailable ? 'border-stone-300 bg-white text-black' : 'border-red-700 bg-red-700 text-white'}`}>
            {isAvailable ? `${availableCount} ${'kho trống'}` : ('Hết kho')}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-stone-200 py-4 text-sm">
          <div><p className="text-xs text-stone-500">{'Diện tích'}</p><p className="mt-0.5 font-bold text-black">{unitType.areaM2} m²</p></div>
          <div><p className="text-xs text-stone-500">{'Kích thước'}</p><p className="mt-0.5 font-bold text-black">{unitType.lengthM} × {unitType.widthM} × {unitType.heightM} m</p></div>
          <div><p className="text-xs text-stone-500">{'Sức chứa tham khảo'}</p><p className="mt-0.5 font-bold text-black">~{usableCapacity} m³</p></div>
          <div><p className="text-xs text-stone-500">{'Tải trọng tối đa'}</p><p className="mt-0.5 font-bold text-black">{unitType.maxLoadKg} kg</p></div>
        </div>
        <p className="mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-stone-600">{unitType.descriptionVi}</p>
        <div className="mt-auto pt-5">
          <p className="text-xs text-stone-500">{'Giá thuê từ'}</p>
          <p className="text-2xl font-bold tracking-tight text-black">{formatVnd(unitType.monthlyPrice)}<span className="text-sm font-normal text-stone-500">/{'tháng'}</span></p>
          <p className="mt-1 text-xs text-stone-600">{'Cọc 20% tổng giá trị kỳ thuê'}</p>
          <p className="mt-1 text-xs text-stone-600">{`Tiền đảm bảo kho: ${formatVnd(unitType.monthlyPrice)} (hoàn sau nghiệm thu nếu không phát sinh khấu trừ)`}</p>
          {!isAvailable && <p className="mt-2 text-xs font-bold text-red-700">{'Cỡ kho này hiện chưa thể đặt.'}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => onViewSpecs(facility, unitType, availableCount)}>{'Xem chi tiết'}</Button>
            <Button size="sm" disabled={!isAvailable} onClick={() => onReserve(facility, unitType)}>{isAvailable ? ('Bắt đầu đặt') : ('Hết kho')}</Button>
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
  const hub = useStorageHub()
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

  const NAV: NavItem[] = [
    { id: 'overview', label: 'Tổng quan', icon: Icon.home, group: 'Kho của tôi', permission: 'view_dashboard' },
    { id: 'browse-facilities', label: 'Tìm cơ sở kho', icon: Icon.building, group: 'Tìm gian kho', permission: 'view_facilities' },
    { id: 'browse-units', label: 'Cỡ kho khả dụng', icon: Icon.box, group: 'Tìm gian kho', permission: 'view_units' },
    { id: 'reservations', label: 'Đơn đặt giữ kho', icon: Icon.calendar, group: 'Đặt giữ kho', permission: 'view_reservations' },
    { id: 'rental-records', label: 'Hồ sơ thuê của tôi', icon: Icon.key, group: 'Đặt giữ kho', permission: 'view_rentals' },
    { id: 'payments', label: 'Lịch sử thanh toán', icon: Icon.credit, group: 'Tài khoản', permission: 'view_payments' },
    { id: 'policies', label: 'Quy định & Chính sách', icon: Icon.policy, group: 'Tài khoản', permission: 'view_policies' },
    { id: 'support', label: 'Hỗ trợ khách hàng', icon: Icon.support, group: 'Hỗ trợ', permission: 'view_support' }
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
  const [bookedCustomerUnitIds, setBookedCustomerUnitIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('customerBookedUnitIds') || '[]') } catch { return [] }
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
  const [unitSearch, setUnitSearch] = useState('')
  const [unitPages, setUnitPages] = useState<Record<string, number>>({})

  useEffect(() => setUnitPages({}), [selectedFacilityId, sizeFilter, unitSearch])

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
      resetBookingForm()
      setBookOpen(false)
      showToast('Thời gian tạm giữ 30 phút đã hết. Suất kho đã được mở lại.')
    }
  }, [bookOpen, temporaryHoldExpiresAt, now])

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
  const [goodsItems, setGoodsItems] = useState<GoodsDeclarationItem[]>([createGoodsDeclarationItem('goods-1')])
  const [packageSamples, setPackageSamples] = useState<PackageSample[]>([{ id: 'package-1', quantity: '', lengthCm: '', widthCm: '', heightCm: '' }])
  const [touchedPackageFields, setTouchedPackageFields] = useState<Record<string, boolean>>({})
  const [goodsWeight, setGoodsWeight] = useState('80')
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
  const resetBookingForm = () => {
    setGoodsItems([createGoodsDeclarationItem('goods-1')])
    setPackageSamples([{ id: 'package-1', quantity: '', lengthCm: '', widthCm: '', heightCm: '' }])
    setTouchedPackageFields({})
    setGoodsWeight('80')
    setGoodsCondition('6 kiện nguyên vẹn, bao gói cẩn thận')
    setMoveInDate('2026-09-22')
    setBookingAppointmentTime('09:00')
    setRentalMonths(3)
    setCustomerIdCard('079203009988')
    setCustomerPhone('+84 908 123 456')
    setCustomerAddress('Quận 1, TP. Hồ Chí Minh')
    setBookingErrors({})
    setValidationViolation(null)
    setBookingReview(false)
  }
  const otherGoodsPackageSamples: PackageSample[] = goodsItems.filter(item => item.category === 'OTHER').map(item => ({ id: `other-${item.id}`, quantity: item.quantity, lengthCm: item.lengthCm, widthCm: item.widthCm, heightCm: item.heightCm, sourceLabel: item.customGoodsName || 'Hàng hóa khác' }))
  const enteredPackageSamples = packageSamples.filter(sample => [sample.quantity, sample.lengthCm, sample.widthCm, sample.heightCm].some(value => value.trim() !== ''))
  const capacitySamples = [...enteredPackageSamples, ...otherGoodsPackageSamples]
  const packageCountNumber = capacitySamples.reduce((sum, sample) => sum + (Number(sample.quantity) || 0), 0)
  const goodsWeightNumber = Number(goodsWeight)
  const largestPackage = capacitySamples.reduce<PackageSample | null>((largest, sample) => {
    const volume = Number(sample.lengthCm) * Number(sample.widthCm) * Number(sample.heightCm)
    if (!largest) return sample
    const largestVolume = Number(largest.lengthCm) * Number(largest.widthCm) * Number(largest.heightCm)
    return volume > largestVolume ? sample : largest
  }, null)
  const cargoLength = largestPackage?.lengthCm ?? ''
  const cargoWidth = largestPackage?.widthCm ?? ''
  const cargoHeight = largestPackage?.heightCm ?? ''
  const cargoLengthNumber = Number(cargoLength)
  const cargoWidthNumber = Number(cargoWidth)
  const cargoHeightNumber = Number(cargoHeight)
  const goodsType = goodsItems.map(item => GOODS_CATEGORY_OPTIONS.find(option => option[0] === item.category)?.[1]).filter(Boolean).join(', ')
  const goodsMaterial = goodsItems.map(item => item.category === 'OTHER' ? item.customMaterial : item.materialName).filter(Boolean).join(', ')
  const hasOtherGoods = goodsItems.some(item => item.category === 'OTHER')
  const markPackageFieldTouched = (sampleId: string, field: PackageSampleField) => setTouchedPackageFields(current => ({ ...current, [`${sampleId}-${field}`]: true }))
  const updatePackageSample = (sampleId: string, field: PackageSampleField, rawValue: string) => {
    markPackageFieldTouched(sampleId, field)
    setPackageSamples(items => items.map(item => item.id === sampleId ? { ...item, [field]: rawValue } : item))
  }

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
    const label = statusLabelMap[status] || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '))
    return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${statusClass[status] ?? 'bg-stone-700 text-white'}`}>{label}</span>
  }

  const featureLabel = (unit: StorageUnit) => {
    return unit.climate ? 'Có điều hòa & kiểm soát độ ẩm' : 'Thông gió tự nhiên'
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
    if (hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING') return true
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
    return [{ id: `expiry-${rental.id}`, date: reminderDate.toISOString(), title: 'Hợp đồng sắp hết hạn', message: `${rental.unitId} · ${remainingDays} ${'ngày còn lại'} · ${'Hết hạn'} ${rental.endDate}`, page: 'rental-records', targetId: rental.id }]
  })
  const customerNotifications: LayoutNotification[] = [
    ...myHolds.filter(hold => hold.goodsReviewStatus === 'PENDING').map(hold => ({ id: `goods-review-submitted-${hold.id}`, date: hold.goodsReviewSubmittedAt || hold.createdAt, title: 'Yêu cầu hàng hóa đã được gửi', message: `${hold.id} · Kho đang được giữ · Chưa yêu cầu tiền cọc`, page: 'reservations', targetId: hold.id })),
    ...myHolds.filter(hold => hold.goodsReviewStatus === 'APPROVED').map(hold => ({ id: `goods-review-approved-${hold.id}`, date: hold.reviewedAt || hold.createdAt, title: 'Hàng hóa đã được chấp thuận', message: `${hold.id} · Vui lòng thanh toán tiền cọc để hoàn tất đặt kho`, page: 'reservations', targetId: hold.id })),
    ...myHolds.filter(hold => hold.goodsReviewStatus === 'REJECTED').map(hold => ({ id: `goods-review-rejected-${hold.id}`, date: hold.reviewedAt || hold.createdAt, title: 'Hàng hóa chưa được chấp thuận', message: `${hold.id} · Lý do: ${hold.staffReviewNotes || 'Hàng hóa chưa phù hợp điều kiện lưu trữ'}`, page: 'reservations', targetId: hold.id })),
    ...contractExpiryNotifications,
    ...visibleMyHolds.filter(h => h.assignedUnitId).map(h => {
      const assignmentActivity = activities.find(activity => activity.action === 'UNIT_ASSIGNED' && activity.entityId === h.id)
      return { id: `unit-${h.id}-${h.assignedUnitId}`, date: h.unitAssignedAt || assignmentActivity?.timestamp || h.reviewedAt || h.createdAt, title: 'Đã phân gian kho', message: `${h.assignedUnitId} · ${h.facilityName}`, page: 'reservations', targetId: h.id }
    }),
    ...visibleMyRentals.filter(rental => rental.status !== 'completed').map(rental => {
      const hold = myHolds.find(item => item.id === rental.holdId)
      const checkin = checkins.find(item => item.holdId === rental.holdId)
      const confirmed = Boolean(rental.receiptConfirmedAt)
      return { id: `receipt-${rental.id}-${confirmed ? rental.receiptConfirmedAt : 'pending'}`, date: rental.receiptConfirmedAt || hold?.checkedInAt || checkin?.completedAt || rental.startDate, title: confirmed ? ('Đã xác nhận nhận kho') : ('Vui lòng xác nhận đã nhận kho'), message: `${rental.unitId} · ${rental.facilityName}`, page: 'rental-records', targetId: rental.id }
    }),
    ...renewals.filter(r => r.customerId === user.id && r.status !== 'pending').map(r => {
      const title = r.status === 'rejected'
        ? ('Gia hạn bị từ chối')
        : r.status === 'approved'
          ? ('Gia hạn đã duyệt · Chờ thanh toán')
          : r.status === 'payment_expired'
            ? ('Yêu cầu gia hạn đã hết hạn thanh toán')
            : r.status === 'completed'
              ? ('Gia hạn đã có hiệu lực')
              : ('Cập nhật yêu cầu gia hạn')
      return { id: `renewal-${r.id}-${r.status}-${r.paidAt || r.approvedAt || r.requestedAt}`, date: r.paidAt || r.approvedAt || r.requestedAt, title, message: r.status === 'rejected' && r.notes ? `${r.unitId} · ${'Lý do'}: ${r.notes}` : `${r.unitId} · ${r.newEndDate}`, page: 'rental-records', targetId: r.rentalId }
    }),
    ...myReturns.filter(r => visibleMyRentalIds.has(r.rentalId) && ['awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'].includes(r.status)).map(r => ({ id: `return-${r.id}-${r.status}-${r.completedAt || r.customerConfirmedAt || r.inspectedAt || r.requestedAt}`, date: r.completedAt || r.customerConfirmedAt || r.inspectedAt || r.requestedAt, title: r.status === 'awaiting_customer_confirmation' ? ('Cần xác nhận quyết toán') : r.status === 'payment_due' ? ('Cần thanh toán phần quyết toán còn thiếu') : r.status === 'refund_pending' ? ('Hồ sơ thuê hết hiệu lực · Chờ hoàn cọc') : r.status === 'completed' ? ('Hồ sơ thuê đã hết hiệu lực') : ('Đang xem xét khiếu nại'), message: `${r.unitId} · ${r.status === 'payment_due' ? ('Cần đóng thêm') : ('Hoàn cọc dự kiến')} ${formatVnd(r.status === 'payment_due' ? (r.amountDueFromCustomer ?? 0) : r.netRefundAmount)}`, page: 'rental-records', targetId: r.rentalId })),
    ...myTickets.flatMap(ticket => {
      const latestStaffMessage = [...ticket.messages].reverse().find(message => message.role === 'staff')
      const notificationTitle = ticket.status === 'resolved'
        ? ('Yêu cầu đã được xử lý thành công')
        : ('Yêu cầu đang được Staff xử lý')
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

  useEffect(() => {
    visibleMyHolds
      .filter(hold => ['CANCELLED', 'EXPIRED'].includes(hold.status))
      .forEach(hold => {
        try { archiveReservationHistory(hold.id, user) } catch { /* already archived */ }
      })
  }, [archiveReservationHistory, user, visibleMyHolds])

  useEffect(() => {
    visibleMyRentals
      .filter(rental => rental.status === 'completed' && myReturns.some(returnCase => returnCase.rentalId === rental.id && returnCase.status === 'completed'))
      .forEach(rental => {
        try { archiveRentalHistory(rental.id, user) } catch { /* already archived or still reconciling */ }
      })
  }, [archiveRentalHistory, myReturns, user, visibleMyRentals])

  const selectedFacility = facilities.find(facility => facility.id === selectedFacilityId) ?? null
  const availableUnits = units.filter(unit =>
    (!selectedFacility || unit.facilityName === selectedFacility.name || unit.facilityId === selectedFacility.id) &&
    (sizeFilter === 'All' || unit.type === sizeFilter)
  )
  const matchingFacilities = facilities.filter(facility => {
    const display = CUSTOMER_FACILITY_DISPLAY[facility.id]
    return `${display?.code ?? facility.id} ${display?.name ?? facility.name} ${display?.address ?? facility.address} ${facility.city}`
      .toLowerCase()
      .includes(searchFacility.toLowerCase())
  })
  const customerHeldUnitIds = new Set([
    CUSTOMER_DEMO_HELD_UNIT_ID,
    ...bookedCustomerUnitIds,
    ...holds.filter(item => !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(item.status) && item.assignedUnitId).map(item => item.assignedUnitId as string),
  ])
  const customerRentedUnitIds = new Set(rentals.filter(item => ['active', 'return_requested', 'return_inspection', 'closing'].includes(item.status)).map(item => item.unitId))

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

  const handleStartReservation = (facility: Facility, unitType: UnitType, exactUnit?: StorageUnit) => {
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
    const repUnit: StorageUnit = exactUnit ?? {
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

  const handleOpenSpecs = (facility: Facility, unitType: UnitType, availableCount: number, exactUnit?: StorageUnit) => {
    setSelectedTarget({ facility, unitType })
    const repUnit: StorageUnit = exactUnit ?? {
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

  const selectedCatalogUnit = selectedUnit ? CUSTOMER_CATALOG_UNITS.find(unit => unit.id === selectedUnit.id) : undefined
  const selectedRackCount = selectedCatalogUnit?.rackCount ?? 0
  const allPackageSamplesValid = capacitySamples.length > 0 && capacitySamples.every(isPackageSampleValid)
  const packageCapacityResults = allPackageSamplesValid ? capacitySamples.map(sample => {
    const capacityPerFrame = selectedUnit ? packageCapacityPerFrame(sample, selectedUnit.dimensions.heightM) : 0
    const quantity = Number(sample.quantity)
    return { ...sample, capacityPerFrame, framesRequired: capacityPerFrame > 0 && quantity > 0 ? Math.ceil(quantity / capacityPerFrame) : 0 }
  }) : []
  const totalFramesRequired = packageCapacityResults.reduce((sum, sample) => sum + sample.framesRequired, 0)
  const warehouseRecommendation = allPackageSamplesValid
    ? (Object.entries(CUSTOMER_UNIT_SPECS) as [CustomerCatalogUnit['sizeCode'], (typeof CUSTOMER_UNIT_SPECS)[keyof typeof CUSTOMER_UNIT_SPECS]][]).find(([, spec]) => {
        const framesRequired = capacitySamples.reduce((sum, sample) => {
          const capacity = packageCapacityPerFrame(sample, spec.dimensions[2])
          return sum + (capacity > 0 ? Math.ceil(Number(sample.quantity) / capacity) : Number.POSITIVE_INFINITY)
        }, 0)
        return framesRequired <= spec.rackCount
      })
    : undefined
  const capacityStatus: CapacityStatus = !allPackageSamplesValid ? 'invalid' : warehouseRecommendation ? 'fits' : 'not-fit'
  const packagesFitSelectedUnit = capacityStatus === 'fits' && packageCapacityResults.every(sample => sample.capacityPerFrame > 0) && totalFramesRequired <= selectedRackCount
  const discountRate = rentalDiscountRate(rentalMonths)
  const grossTermValue = currentQuote ? currentQuote.baseMonthlyPrice * rentalMonths : 0
  const promotionDiscount = Math.round(grossTermValue * discountRate * 100) / 100

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
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const latestCheckIn = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    const requestedDate = moveInDate ? new Date(`${moveInDate}T00:00:00`) : null

    if (customerIdCard.trim().length < 9) errors.identity = 'CCCD/Hộ chiếu phải có ít nhất 9 ký tự.'
    if (customerPhone.replace(/\D/g, '').length < 9) errors.phone = 'Số điện thoại phải có ít nhất 9 chữ số.'
    if (!customerAddress.trim()) errors.address = 'Vui lòng nhập địa chỉ.'
    goodsItems.forEach((item, index) => {
      if (!item.category) errors[`goodsCategory-${item.id}`] = `Dòng hàng hóa ${index + 1}: Vui lòng chọn loại hàng hóa.`
      if (item.category && item.category !== 'OTHER' && !item.materialType) errors[`goodsMaterial-${item.id}`] = `Dòng hàng hóa ${index + 1}: Vui lòng chọn chất liệu chính.`
      if (item.category === 'OTHER') {
        if (!item.customGoodsName.trim()) errors[`customGoodsName-${item.id}`] = 'Vui lòng nhập tên hàng hóa.'
        if (!item.description.trim()) errors[`customDescription-${item.id}`] = 'Vui lòng nhập mô tả hàng hóa.'
        if (!item.customMaterial.trim()) errors[`customMaterial-${item.id}`] = 'Vui lòng nhập chất liệu chính.'
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) errors[`customQuantity-${item.id}`] = 'Số lượng phải là số nguyên lớn hơn 0.'
        if (parsePositiveNumber(item.lengthCm) === null) errors[`customLength-${item.id}`] = 'Chiều dài phải lớn hơn 0 để kiểm tra sức chứa.'
        if (parsePositiveNumber(item.widthCm) === null) errors[`customWidth-${item.id}`] = 'Chiều rộng phải lớn hơn 0 để kiểm tra sức chứa.'
        if (parsePositiveNumber(item.heightCm) === null) errors[`customHeight-${item.id}`] = 'Chiều cao phải lớn hơn 0 để kiểm tra sức chứa.'
        if (!item.fragile) errors[`customFragile-${item.id}`] = 'Vui lòng chọn hàng hóa có dễ bể / dễ vỡ hay không.'
      }
    })
    if (!goodsCondition.trim()) errors.condition = 'Vui lòng mô tả tình trạng đóng gói.'
    enteredPackageSamples.forEach((sample, index) => {
      if (!Number.isInteger(Number(sample.quantity)) || Number(sample.quantity) <= 0) errors[`packageQuantity-${sample.id}`] = `Mẫu hàng ${index + 1}: Số lượng phải là số nguyên lớn hơn 0.`
      if (![sample.lengthCm, sample.widthCm, sample.heightCm].every(value => Number(value) > 0)) errors[`packageDimensions-${sample.id}`] = `Mẫu hàng ${index + 1}: Dài, rộng và cao phải lớn hơn 0.`
      if (isPackageSampleValid(sample) && packageCapacityPerFrame(sample, selectedUnit.dimensions.heightM) === 0) errors[`packageFit-${sample.id}`] = `Mẫu hàng ${index + 1} không thể xếp vào khung 0,8 × 2,0 × ${selectedUnit.dimensions.heightM} m theo bất kỳ hướng xoay nào.`
    })
    if (capacitySamples.length === 0) errors.packageSamples = 'Vui lòng khai báo ít nhất một mẫu hàng với số lượng và kích thước đầy đủ.'
    if (allPackageSamplesValid && totalFramesRequired > selectedRackCount) errors.capacity = `Kho không chứa vừa: cần ${totalFramesRequired} khung nhưng kho chỉ có ${selectedRackCount} khung.`
    if (!goodsWeight.trim() || !Number.isFinite(goodsWeightNumber) || goodsWeightNumber <= 0) errors.weight = 'Cân nặng phải lớn hơn 0.'
    if (goodsWeightNumber > selectedUnit.maxLoadKg) errors.weightLimit = `${'Tổng cân nặng vượt tải trọng sàn'} (${selectedUnit.maxLoadKg} kg).`
    if (!requestedDate || Number.isNaN(requestedDate.getTime()) || requestedDate < today || requestedDate > latestCheckIn) errors.moveInDate = 'Ngày dự kiến Check-in phải từ hôm nay đến tối đa 14 ngày tới.'
    if (!bookingAppointmentTime) errors.appointmentTime = 'Vui lòng chọn khung giờ Check-in.'
    setBookingErrors(errors)
    if (Object.keys(errors).length) {
      setTouchedPackageFields(current => {
        const next = { ...current }
        packageSamples.forEach(sample => {
          ;(['quantity', 'lengthCm', 'widthCm', 'heightCm'] as PackageSampleField[]).forEach(field => { next[`${sample.id}-${field}`] = true })
        })
        return next
      })
      showToast('Vui lòng kiểm tra lại các thông tin được đánh dấu.')
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
        notes: goodsItems.filter(item => item.category === 'OTHER').map(item => `${item.customGoodsName} ${item.description} ${item.customMaterial} ${item.customerNote}`).join(' | '),
        fragile: goodsItems.some(item => item.materialType === 'FRAGILE' || item.fragile === 'yes'),
        items: goodsItems.map(item => ({
          id: item.id,
          category: item.category,
          materialType: item.materialType,
          materialName: item.materialName || item.customMaterial || undefined,
          customGoodsName: item.customGoodsName || undefined,
          description: item.description || undefined,
          customMaterial: item.customMaterial || undefined,
          quantity: item.quantity ? Number(item.quantity) : undefined,
          dimensions: item.lengthCm || item.widthCm || item.heightCm ? { lengthCm: Number(item.lengthCm) || undefined, widthCm: Number(item.widthCm) || undefined, heightCm: Number(item.heightCm) || undefined } : undefined,
          weightKg: item.weightKg ? Number(item.weightKg) : undefined,
          fragile: item.fragile ? item.fragile === 'yes' : item.materialType === 'FRAGILE',
          customerNote: item.customerNote || undefined,
          images: item.images,
          requiresStaffReview: item.category === 'OTHER',
          reviewStatus: item.category === 'OTHER' ? 'PENDING' : 'NOT_REQUIRED',
        }))
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
      },
      capacityValidatedByFrames: packagesFitSelectedUnit,
      customerCatalogUnit: {
        id: selectedUnit.id,
        facilityName: selectedUnit.facilityName,
        doorWidthM: selectedUnit.doorDimensions.widthM,
        doorHeightM: selectedUnit.doorDimensions.heightM,
      }
    })

    if (result.outcome === 'HARD_VIOLATION') {
      setValidationViolation({
        reason: result.rejectionReason,
        suggestedUnitTypeId: result.suggestedUnitTypeId,
        suggestedUnitTypeName: result.suggestedUnitTypeName,
        suggestedVolumeM3: result.suggestedVolumeM3
      })
      setBookingReview(false)
      showToast('Vi phạm quy chuẩn! Không thể giữ gian kho này.')
      return
    }

    setValidationViolation(null)
    localStorage.removeItem('customerTemporaryHoldExpiresAt')
    localStorage.removeItem('customerTemporaryHoldTarget')
    setTemporaryHoldExpiresAt(null)
    setTemporaryHoldTarget(null)
    resetBookingForm()
    setBookOpen(false)
    setSelectedUnit(null)
    if (result.outcome === 'SOFT_EXCEPTION') {
      setPage('reservations')
      showToast('Cỡ kho này chưa phù hợp với thông tin hàng hóa. Vui lòng chọn cỡ khác.')
    } else {
      if (selectedUnit.id) {
        setBookedCustomerUnitIds(previous => {
          const next = previous.includes(selectedUnit.id) ? previous : [...previous, selectedUnit.id]
          localStorage.setItem('customerBookedUnitIds', JSON.stringify(next))
          return next
        })
      }
      setPage('reservations')
      if (result.hold) {
        if (result.hold.goodsReviewStatus === 'PENDING') {
          showToast('Yêu cầu hàng hóa đã được gửi. Kho đang được giữ và chưa yêu cầu tiền cọc.')
        } else {
          setActiveHoldForEmail(result.hold)
          setInputToken(result.hold.emailVerification?.token || '')
          setEmailModalOpen(true)
          showToast('Đã tạo yêu cầu. Hãy xác minh email trước khi cơ sở phê duyệt.')
        }
      }
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
      canAccess={permission => hub.can(user, permission)}
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
                <p className="text-xs font-bold uppercase tracking-[.22em] text-white/60">StorageHub · {'Hệ thống cơ sở lưu kho'}</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
                  {'Không gian phù hợp cho những điều bạn muốn giữ gìn.'}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                  {'Chọn cơ sở, chọn cỡ kho và kiểm tra sức chứa theo DIM. Bạn có 30 phút để hoàn tất yêu cầu, 12 giờ để thanh toán cọc và 14 ngày để Check-in.'}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button onClick={() => navigateTo('browse-units')} className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-stone-200">
                    {'Xem kho còn trống'}
                  </button>
                  <button onClick={() => navigateTo('browse-facilities')} className="rounded-lg border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                    {'Khám phá cơ sở'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                {[
                  ['30', 'phút tạm giữ suất kho'],
                  ['12', 'giờ thanh toán cọc'],
                  ['14', 'ngày để Check-in']
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
              <p className="text-xs font-bold uppercase tracking-[.16em] text-stone-500">{'Tài khoản của bạn'}</p>
              <h2 className="mt-1 text-2xl font-bold text-black">{`Xin chào, ${user.name}`}</h2>
              <p className="mt-1 text-sm text-stone-600">{'Theo dõi đơn đặt kho, hợp đồng và quyền truy cập tại một nơi.'}</p>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
            <StatCard title={'Hồ sơ thuê đang hoạt động'} value={activeRentals.length} icon={Icon.key} iconBg="bg-blue-50 text-blue-700" />
            <StatCard title={'Đơn đặt giữ kho'} value={visibleMyHolds.length} icon={Icon.calendar} iconBg="bg-amber-50 text-amber-700" />
            <StatCard title={'Kho đang giữ chờ hoàn tất'} value={visibleMyHolds.filter(h => !['CANCELLED', 'EXPIRED', 'COMPLETED', 'checked_in', 'rejected'].includes(h.status)).length} icon={Icon.clock} iconBg="bg-stone-100 text-black" />
            <StatCard title={'Yêu cầu hỗ trợ đang mở'} value={tickets.filter(t => t.status === 'open').length} icon={Icon.support} />
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                <div>
                  <p className="eyebrow">{'Kho hiện tại'}</p>
                  <h2 className="mt-1 font-bold text-stone-900">{'Các kho bạn đang thuê'}</h2>
                </div>
              </div>
              {activeRentals.length ? (
                <div className="divide-y divide-stone-200">
                  {activeRentals.map(rental => (
                    <div key={rental.id} className="grid gap-5 p-5 transition hover:bg-stone-50 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[.08em] text-amber-700">
                            {`Gian kho ${rental.unitId}`}
                          </p>
                          {rental.status === 'return_requested' && <Badge variant="warning">{'Đang chờ trả kho'}</Badge>}
                        </div>
                        <p className="mt-2 text-xl font-bold text-stone-900">{rental.facilityName}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {rental.unitType} · {rental.areaM2} m² · {'Kỳ hạn tiếp theo:'} {rental.nextDue}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 rounded-lg bg-[#292a27] px-3 py-1.5 text-sm font-bold text-white">
                            <span>{'Mã mở cổng:'}</span>
                            <span className="text-[#e9a12c]">{rental.gateCode || '—'}</span>
                          </div>
                          <Badge variant="muted">{'Quyền vào 24/7'}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => {
                          navigateTo('rental-records')
                          revealNotificationTarget(rental.id)
                        }}>
                          {'Chi tiết hồ sơ thuê'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="font-semibold text-stone-700">{'Bạn chưa có hồ sơ thuê kho đang hoạt động'}</p>
                  <p className="mt-1 text-sm text-stone-500">{'Hãy khám phá các gian kho còn trống và giữ kho phù hợp với hàng hóa của bạn.'}</p>
                  <Button className="mt-4" onClick={() => navigateTo('browse-units')}>
                    {'Xem các gian kho còn trống'}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <p className="eyebrow">{'Thao tác nhanh'}</p>
              <h2 className="mt-1 font-bold text-stone-900">{'Quy trình thuê kho khép kín'}</h2>
              <div className="mt-4 grid gap-2">
                <button onClick={() => navigateTo('browse-units')} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.building}</span>
                  <span>
                    <b className="block text-sm">{'1. Chọn kho & Khai báo hàng hóa'}</b>
                    <small className="text-stone-500 group-hover:text-white">{'Giữ tạm một suất trong 30 phút để hoàn tất thông tin'}</small>
                  </span>
                </button>
                <button onClick={() => navigateTo('reservations')} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.calendar}</span>
                  <span>
                    <b className="block text-sm">{'2. Tiến độ đơn đặt giữ kho'}</b>
                    <small className="text-stone-500 group-hover:text-white">{'Cọc 20% trong 12 giờ, sau đó cơ sở phân kho vật lý'}</small>
                  </span>
                </button>
                <button onClick={() => setTicketOpen(true)} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.support}</span>
                  <span>
                    <b className="block text-sm">{'3. Hỗ trợ kỹ thuật & Mở cổng'}</b>
                    <small className="text-stone-500 group-hover:text-white">{'Đội ngũ trực cơ sở hỗ trợ 24/7'}</small>
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
            title={'Hệ Thống Cơ Sở Lưu Kho'}
            subtitle={'So sánh và lựa chọn vị trí kho bãi StorageHub gần bạn nhất'}
            action={
              <label className="relative block w-full sm:w-72">
                <span className="sr-only">Search facilities</span>
                <input
                  value={searchFacility}
                  onChange={event => setSearchFacility(event.target.value)}
                  placeholder={'Tìm theo thành phố, quận hoặc địa chỉ...'}
                  className="pl-10 w-full border border-stone-300 rounded-lg py-2 text-sm focus:ring-2 focus:ring-amber-500"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-stone-400">{SearchIcon}</span>
              </label>
            }
          />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {matchingFacilities.map(facility => {
              const facilityCatalogUnits = CUSTOMER_CATALOG_UNITS.filter(unit => unit.facilityId === facility.id)
              const availCount = facilityCatalogUnits.filter(unit => !customerHeldUnitIds.has(unit.id) && !customerRentedUnitIds.has(unit.id)).length
              const minimumMonthlyPrice = Math.min(...facilityCatalogUnits.map(unit => unit.price))
              const display = CUSTOMER_FACILITY_DISPLAY[facility.id]
              const displayCode = display?.code ?? facility.id.toUpperCase()
              const displayName = display?.name ?? facility.name
              const displayAddress = display?.address ?? facility.address

              return (
                <Card key={facility.id} className="overflow-hidden stat-card-hover">
                  <div className="relative h-44 bg-stone-200">
                    <img src={`https://images.unsplash.com/${facility.image}?w=720&h=352&fit=crop&auto=format`} alt={`${displayName} storage facility`} className="h-full w-full object-cover" />
                    <div className="absolute left-3 top-3 z-10">
                      <span className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-extrabold backdrop-blur-sm ${availCount > 0 ? 'border-emerald-300 bg-emerald-700/95 text-white shadow-[0_8px_22px_rgba(4,120,87,0.55)]' : 'border-red-300 bg-red-700/95 text-white shadow-[0_8px_22px_rgba(185,28,28,0.5)]'}`}>
                        {availCount} {'gian kho còn trống'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-amber-700">{displayCode}</p>
                        <h2 className="font-bold text-stone-900">{displayName}</h2>
                        <p className="mt-1 text-xs text-stone-500">{displayAddress}</p>
                      </div>
                      <span className="text-sm font-semibold text-amber-700"> {facility.rating}</span>
                    </div>
                    <div className="my-4 flex flex-wrap gap-2">
                      <Badge variant="muted">{'Camera 24/7'}</Badge>
                      {facility.climate && <Badge variant="info">{'Điều hòa độ ẩm'}</Badge>}
                    </div>
                    <div className="flex items-end justify-between border-t border-stone-100 pt-4">
                      <div>
                        <p className="text-xs text-stone-500">{'Giá chỉ từ'}</p>
                        <p className="text-xl font-bold text-stone-900">{formatVnd(minimumMonthlyPrice)}<span className="text-xs font-normal text-stone-500">/{'tháng'}</span></p>
                      </div>
                      <Button size="sm" onClick={() => navigateTo('browse-units', { facilityId: facility.id })}>
                        {'Xem các gian kho'}
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

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={selectedFacility
                ? (`Kho còn trống tại ${CUSTOMER_FACILITY_DISPLAY[selectedFacility.id]?.name ?? selectedFacility.name}`)
                : ('Kho còn trống')}
              subtitle={selectedFacility
                ? `${CUSTOMER_FACILITY_DISPLAY[selectedFacility.id]?.address ?? selectedFacility.address} · Chọn trực tiếp mã kho còn trống.`
                : ('Kho được giữ vẫn hiển thị trạng thái; kho đang thuê sẽ được ẩn cho đến khi hoàn tất nghiệm thu.')}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={sizeFilter} onChange={event => setSizeFilter(event.target.value)} className="w-full sm:w-56">
                    <option value="All">{'Tất cả kích thước'}</option>
                    <option value="Small">{'Size S'}</option>
                    <option value="Medium">{'Size M'}</option>
                    <option value="Large">{'Size L'}</option>
                    <option value="Extra Large">{'Size XL'}</option>
                  </Select>
                </div>
              }
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={!selectedFacilityId ? 'primary' : 'outline'} onClick={() => setSelectedFacilityId(null)}>Tất cả cơ sở</Button>
                {facilities.map(facility => <Button key={facility.id} size="sm" variant={selectedFacilityId === facility.id ? 'primary' : 'outline'} onClick={() => setSelectedFacilityId(facility.id)}>{facility.id === 'fac-001' ? 'Xem kho Hồ Chí Minh' : 'Xem kho Bình Dương'}</Button>)}
              </div>
              <label className="relative ml-auto block w-full lg:w-[420px]"><span className="sr-only">Tìm kiếm kho</span><input value={unitSearch} onChange={event => setUnitSearch(event.target.value)} placeholder="Tìm theo mã kho hoặc size S, M, L, XL..." className="w-full rounded-xl border border-stone-300 py-2.5 pl-10 pr-4 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200" /><span className="pointer-events-none absolute left-3 top-3 text-stone-400">{SearchIcon}</span></label>
            </div>

            {/* List Facilities with their 3-4 Unit Sizes */}
            <div className="space-y-8">
              {displayedFacilities.map(facility => {
                const display = CUSTOMER_FACILITY_DISPLAY[facility.id]
                const heldIds = customerHeldUnitIds
                const rentedIds = customerRentedUnitIds
                const matchingCatalogUnits = CUSTOMER_CATALOG_UNITS.filter(unit =>
                  unit.facilityId === facility.id &&
                  !rentedIds.has(unit.id) &&
                  (sizeFilter === 'All' || unit.type === sizeFilter) &&
                  `${unit.code} ${unit.sizeCode} ${unit.type}`.toLowerCase().includes(unitSearch.trim().toLowerCase())
                )
                const pageCount = Math.max(1, Math.ceil(matchingCatalogUnits.length / CUSTOMER_UNITS_PER_PAGE))
                const currentPage = Math.min(unitPages[facility.id] ?? 1, pageCount)
                const visibleCatalogUnits = matchingCatalogUnits.slice((currentPage - 1) * CUSTOMER_UNITS_PER_PAGE, currentPage * CUSTOMER_UNITS_PER_PAGE)
                const availableCount = matchingCatalogUnits.filter(unit => !heldIds.has(unit.id)).length

                return (
                  <section key={facility.id} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-stone-300 bg-stone-50 px-2 py-0.5 text-xs font-bold text-black">
                            {display?.code ?? facility.id.toUpperCase()}
                          </span>
                          <h3 className="text-xl font-bold text-black">{display?.name ?? facility.name}</h3>
                          <span className="text-xs font-semibold text-black">★ {facility.rating}</span>
                        </div>
                        <p className="mt-1 text-sm text-stone-600">{display?.address ?? `${facility.address}, ${facility.city}`}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${availableCount > 0 ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-red-700 bg-red-700 text-white'}`}>{availableCount} {'kho còn trống'}</span>
                        {!selectedFacility && (
                          <Button size="sm" variant="outline" onClick={() => setSelectedFacilityId(facility.id)}>
                            {'Lọc riêng cơ sở này'}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {visibleCatalogUnits.map(unit => {
                        const catalogUnit = unit as CustomerCatalogUnit
                        const isHeld = heldIds.has(unit.id)
                        const displayUnit: CustomerCatalogUnit = { ...catalogUnit, status: isHeld ? 'held' : 'available' }
                        const unitType = unitTypes.find(item => item.id === (catalogUnit.sizeCode === 'XL' ? 'xlarge' : catalogUnit.sizeCode.toLowerCase())) ?? unitTypes[0]
                        return <article key={unit.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl">
                          <div className="relative h-44 overflow-hidden bg-stone-800">
                            <img src={CUSTOMER_UNIT_IMAGE_BY_SIZE[catalogUnit.sizeCode]} alt={`Kho size ${catalogUnit.sizeCode} - ${unit.code}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/15 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white"><div><p className="text-xs font-bold tracking-wide text-amber-300">{unit.code}</p><h4 className="mt-1 text-xl font-bold">Kho size {catalogUnit.sizeCode}</h4></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm ${isHeld ? 'border-amber-300/70 bg-amber-700/80 text-amber-50' : 'border-emerald-300/70 bg-emerald-700/80 text-emerald-50'}`}>● {isHeld ? 'Được giữ' : 'Còn trống'}</span></div>
                          </div>
                          <div className="flex flex-1 flex-col p-5">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] text-stone-500">Kích thước D×R×C</p><b className="mt-1 block text-stone-950">{unit.dimensions.lengthM}×{unit.dimensions.widthM}×{unit.dimensions.heightM} m</b></div>
                              <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] text-stone-500">Thể tích kho</p><b className="mt-1 block text-stone-950">{unit.volumeM3.toLocaleString('vi-VN')} m³</b></div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-800">❄ Có máy lạnh</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">● An ninh 24/7</span><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-800">PCCC tự động</span></div>
                            <div className="mt-5 border-t border-stone-200 pt-4"><p className="text-xs text-stone-500">Giá thuê mỗi tháng</p><p className="mt-0.5 text-2xl font-extrabold text-stone-950">{formatVnd(unit.price)}<span className="text-xs font-normal text-stone-500">/tháng</span></p><p className="mt-1 text-[11px] font-medium text-amber-800">Cọc trước 20% tổng giá trị kỳ thuê</p></div>
                          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                            <Button size="sm" variant="outline" onClick={() => handleOpenSpecs(facility, unitType, isHeld ? 0 : 1, displayUnit)}>Xem chi tiết</Button>
                            <Button size="sm" disabled={isHeld} onClick={() => handleStartReservation(facility, unitType, displayUnit)}>{isHeld ? 'Đang được giữ' : 'Chọn kho này'}</Button>
                          </div>
                          </div>
                        </article>
                      })}
                    </div>
                    {matchingCatalogUnits.length === 0 && <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">Không tìm thấy kho phù hợp tại cơ sở này.</div>}
                    {matchingCatalogUnits.length > CUSTOMER_UNITS_PER_PAGE && <div className="flex flex-wrap items-center justify-center gap-2 border-t border-stone-200 pt-5"><Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setUnitPages(pages => ({ ...pages, [facility.id]: Math.max(1, currentPage - 1) }))}>← Trang trước</Button><span className="px-2 text-sm font-semibold text-stone-600">Trang {currentPage}/{pageCount}</span><Button size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setUnitPages(pages => ({ ...pages, [facility.id]: Math.min(pageCount, currentPage + 1) }))}>Trang sau →</Button></div>}
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
            title={'Đơn Đặt Giữ Kho Của Tôi'}
            subtitle={'Tạm giữ 30 phút → Chờ cọc 12 giờ → Phân kho vật lý → Check-in trong 14 ngày'}
            action={<Button size="sm" onClick={() => navigateTo('browse-units')}>{Icon.plus} {'Đặt giữ kho mới'}</Button>}
          />

          {visibleMyHolds.length ? (
            <div className="grid gap-4">
              {visibleMyHolds.map(hold => {
                const linkedRental = myRentals.find(rental => rental.holdId === hold.id)
                const receiptConfirmed = Boolean(linkedRental?.receiptConfirmedAt)
                const linkedRentalEnded = rentals.some(rental => rental.holdId === hold.id && rental.status === 'completed')
                const holdInactive = ['CANCELLED', 'EXPIRED'].includes(hold.status) || linkedRentalEnded
                return (
                <Card id={`customer-record-${hold.id}`} tabIndex={-1} key={hold.id} className={`p-6 border-l-4 ${holdInactive ? 'inactive-record-card border-l-stone-300 bg-white text-stone-500' : 'border-l-amber-500'} ${focusedNotificationTarget === hold.id ? 'notification-target-reveal' : ''}`}>
                  <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-700">{hold.id}</span>
                        {badgeFor(hold.status)}
                        {hold.payment.status === 'paid' && <span className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white">{'Đã cọc giữ chỗ 20%'}</span>}
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-stone-900">
                        {hold.unitTypeName || hold.unitId} · {hold.facilityName}
                      </h2>
                      <p className="text-xs text-stone-500">
                        {'Lịch Check-in hiện tại:'} <b>{hold.appointmentDate || hold.moveInDate}{hold.appointmentTime ? ` · ${hold.appointmentTime}` : ''}</b> · {'Thời hạn:'} {hold.rentalMonths} {'tháng'}
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
                        <p><b>{'Kích thước kiện & Thể tích:'}</b> {hold.goods.lengthCm}×{hold.goods.widthCm}×{hold.goods.heightCm}cm (~{Math.round((hold.goods.lengthCm * hold.goods.widthCm * hold.goods.heightCm * hold.goods.packageCount) / 1000) / 1000} m³)</p>
                        {(() => { const unitSpec = units.find(unit => unit.id === hold.assignedUnitId) || units.find(unit => unit.facilityId === hold.facilityId && unitTypeMatches(unit.type, hold.unitTypeName)); return unitSpec ? <p><b>{'Cửa kho thông thủy:'}</b> {unitSpec.doorDimensions.widthM}m × {unitSpec.doorDimensions.heightM}m ({'rộng × cao'}) · <span className="font-semibold text-emerald-700">✓ {'Kiện đã qua kiểm tra lọt cửa'}</span></p> : null })()}
                        
                        {/* Financial breakdown: Reservation Deposit vs Security Deposit */}
                        {(() => {
                          const rentTotal = hold.quote.baseMonthlyPrice * hold.rentalMonths
                          const bookingDeposit = hold.reservationDepositAmount ?? Math.round(rentTotal * 0.2 * 100) / 100
                          const rentBalance = Math.max(0, rentTotal - bookingDeposit)
                          return <div className="mt-2 grid gap-2 border-t border-stone-200/80 pt-3 text-[11px] sm:grid-cols-2">
                            <div className="rounded-lg bg-white/70 p-3 leading-5"><p className="font-bold text-stone-900">{'Tiền thuê và cọc giữ chỗ'}</p><p>{`Tiền thuê: ${formatVnd(hold.quote.baseMonthlyPrice)} × ${hold.rentalMonths} tháng = ${formatVnd(rentTotal)}`}</p><p>{`Cọc 20%: ${formatVnd(rentTotal)} × 20% = ${formatVnd(bookingDeposit)}`}</p><p>{`Tiền thuê còn lại: ${formatVnd(rentTotal)} − ${formatVnd(bookingDeposit)} = ${formatVnd(rentBalance)}`}</p></div>
                            <div className="rounded-lg bg-amber-50 p-3 leading-5"><p className="font-bold text-stone-900">{'Khoản thu tại Check-in'}</p><p>{`Tiền thuê còn lại: ${formatVnd(rentBalance)}`}</p><p>{`+ Tiền đảm bảo kho: ${formatVnd(hold.securityDepositAmount)}`}</p><p className="border-t border-amber-200 pt-1 font-bold">{`Tổng thu tại Check-in: ${formatVnd(hold.remainingAmount)}`}</p></div>
                          </div>
                        })()}

                        {hold.payment.status === 'paid' && <p className="pt-1 text-[11px] font-medium text-black">{'Cọc đã thanh toán. Cơ sở sẽ phân kho vật lý trước Check-in; hạn hoàn tất Check-in là 14 ngày từ ngày cọc.'}</p>}

                        {hold.generatedAccessPin && !holdInactive && (
                          <div className="mt-2 rounded bg-[#292a27] p-2 text-white text-xs flex items-center justify-between">
                            <span>{'Mã PIN hệ thống cấp (Kích hoạt sau check-in):'}</span>
                            <span className="text-[#e9a12c] font-bold text-sm tracking-widest">{hold.generatedAccessPin}</span>
                          </div>
                        )}
                      </div>

                      {!['CANCELLED', 'EXPIRED'].includes(hold.status) && (() => {
                        const progressSteps = [
                          { label: 'Xác minh email', detail: 'Xác nhận địa chỉ liên hệ' },
                          { label: 'Phê duyệt hồ sơ', detail: 'Cơ sở kiểm tra yêu cầu' },
                          { label: 'Thanh toán cọc', detail: 'Hoàn tất cọc giữ chỗ 20%' },
                          { label: 'Cơ sở phân kho', detail: 'Cơ sở đang chọn gian kho phù hợp' },
                          { label: 'Check-in & ký', detail: 'Đối chiếu và ký tại cơ sở' },
                          { label: 'Đã bàn giao', detail: 'Nhận kho và mã ra vào' }
                        ]
                        // COMPLETED + chưa xác nhận nhận kho → bước 5 ("Đã bàn giao" = Hiện tại)
                        // COMPLETED + đã xác nhận → 6 (tất cả Đã xong)
                        const currentIndex = hold.status === 'awaiting_email' ? 0 : hold.status === 'awaiting_review' ? 1 : hold.status === 'awaiting_payment' ? 2 : hold.status === 'DEPOSIT_PAID' ? 3 : hold.status === 'UNIT_RESERVED' ? 4 : hold.status === 'READY_FOR_CHECKIN' ? 4 : hold.status === 'COMPLETED' ? (receiptConfirmed ? 6 : 5) : -1
                        const activeStep = progressSteps[currentIndex]

                        return <div className="mt-4 border-t border-stone-200 pt-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-black">{'Tiến trình đơn đặt kho'}</p>
                              <p className="mt-0.5 text-[11px] text-stone-500">{`Đã hoàn thành ${Math.max(0, currentIndex)}/6 bước`}</p>
                            </div>
                            {activeStep && <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-300">
                              {'Đang thực hiện: '} {activeStep.label}
                            </span>}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            {progressSteps.map((step, index) => {
                              const completed = index < currentIndex || currentIndex === progressSteps.length
                              const current = index === currentIndex && currentIndex < progressSteps.length
                              return <div key={step.label} aria-current={current ? 'step' : undefined} className={`relative rounded-xl border p-3 transition ${completed ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : current ? 'border-amber-500 bg-amber-500 text-white shadow-lg ring-2 ring-amber-200' : 'border-stone-200 bg-stone-50 text-stone-400'}`}>
                                <div className="mb-2 flex items-center justify-between gap-1">
                                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${completed ? 'bg-emerald-600 text-white' : current ? 'bg-white text-amber-700' : 'bg-stone-200 text-stone-500'}`}>{completed ? '✓' : index + 1}</span>
                                  <span className={`text-[9px] font-bold uppercase tracking-wide ${completed ? 'text-emerald-700' : current ? 'text-white' : 'text-stone-400'}`}>{completed ? ('Đã xong') : current ? ('Hiện tại') : ('Sắp tới')}</span>
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
                        {hold.goodsReviewStatus === 'PENDING' ? <><p className="text-xs text-stone-500">Tiền cọc</p><p className="text-lg font-bold text-blue-900">Chưa yêu cầu</p><p className="text-xs text-blue-800">Chỉ tính và mở thanh toán sau khi Staff chấp thuận.</p></> : <><p className="text-xs text-stone-500">{'Tổng thu cả kỳ (gồm tiền đảm bảo kho):'}</p><p className="text-xl font-bold text-stone-900">{formatVnd(hold.totalInitialAmount ?? hold.quote.totalFirstPayment)}</p><p className="text-xs text-amber-800">{'Trả lúc giữ chỗ'}: {formatVnd(hold.reservationDepositAmount ?? hold.payment.amount)} · {'Thu tại Check-in'}: {formatVnd(hold.remainingAmount)}</p></>}
                      </div>

                      {hold.status === 'awaiting_email' && (
                        <div className="min-w-[220px] rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-xs text-amber-950">
                          <p className="font-bold">{'Cần xác minh email'}</p>
                          <Button className="mt-2" size="sm" onClick={() => { setActiveHoldForEmail(hold); setInputToken(hold.emailVerification?.token || ''); setEmailModalOpen(true) }}>{'Xác minh email'}</Button>
                        </div>
                      )}

                      {hold.status === 'awaiting_review' && (
                        <div className="min-w-[260px] rounded-lg border border-blue-200 bg-blue-50 p-3 text-right text-xs text-blue-950">
                          <p className="font-bold">{hold.goodsReviewStatus === 'PENDING' ? 'Đang chờ duyệt hàng hóa' : 'Đang chờ cơ sở phê duyệt'}</p>
                          <p className="mt-1">Kho đang được giữ cho bạn · Tiền cọc: Chưa yêu cầu</p>
                          {hold.goodsReviewSubmittedAt && <p className="mt-1">Gửi lúc: {new Date(hold.goodsReviewSubmittedAt).toLocaleString('vi-VN')}</p>}
                          {hold.goodsReviewDueAt && <p className="mt-1">{new Date(hold.goodsReviewDueAt).getTime() < now ? 'Yêu cầu đang được xử lý lâu hơn dự kiến; kho vẫn được giữ.' : `Dự kiến xử lý trước: ${new Date(hold.goodsReviewDueAt).toLocaleString('vi-VN')}`}</p>}
                        </div>
                      )}

                      {hold.goodsReviewStatus === 'REJECTED' && (
                        <div className="min-w-[260px] rounded-lg border border-red-200 bg-red-50 p-3 text-right text-xs text-red-900">
                          <p className="font-bold">Hàng hóa chưa được chấp thuận</p>
                          <p className="mt-1">Lý do: {hold.staffReviewNotes || 'Hàng hóa chưa phù hợp điều kiện lưu trữ của kho.'}</p>
                          <p className="mt-1">Kho tạm giữ đã được giải phóng và không phát sinh tiền cọc.</p>
                        </div>
                      )}

                      {hold.status === 'awaiting_payment' && hold.payment.status !== 'paid' && (
                        <div className="min-w-[220px] rounded-lg border border-red-700 bg-red-700 p-3 text-right text-xs text-white shadow-sm">
                          <p className="font-bold text-white">{'Cần thanh toán cọc trong 12 giờ'}</p>
                          <p className="mt-1 text-lg font-bold text-white">{formatCountdown(hold.paymentExpiresAt).text}</p>
                          <Button className="mt-2" size="sm" disabled={formatCountdown(hold.paymentExpiresAt).isExpired} onClick={() => { setActiveHoldForPayment(hold); setPayModalOpen(true) }}>{'Thanh toán cọc 20%'}</Button>
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
                          {'Xem điều khoản & biên lai'}
                        </Button>
                      )}

                      {['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(hold.status) && (
                        <Button variant="outline" size="sm" onClick={() => { setActiveHoldForSchedule(hold); setAppointmentDate(hold.appointmentDate || hold.moveInDate || ''); setAppointmentTime(/^\d{2}:\d{2}$/.test(hold.appointmentTime || '') ? hold.appointmentTime! : '09:00'); setScheduleModalOpen(true) }}>
                          {hold.appointmentDate && hold.appointmentTime ? (`Đổi lịch: ${hold.appointmentDate} ${hold.appointmentTime}`) : ('Đặt lịch Check-in')}
                        </Button>
                      )}

                      {/* UNIT_RESERVED: Manager assigned, prompt customer to visit facility */}
                      {hold.status === 'UNIT_RESERVED' && (
                        <div className="rounded-lg border border-blue-700 bg-blue-700 p-2.5 text-right text-xs text-white space-y-1">
                          <p className="font-semibold text-white">
                            {'Đã phân bổ kho! Vui lòng đến cơ sở:'}
                          </p>
                          <p className="text-[11px] text-white">
                            {'• Xuất trình CCCD/Hộ chiếu gốc'}<br />
                            {'• Ký hợp đồng giấy tại quầy'}<br />
                            {`• Thanh toán phần còn lại (${formatVnd(hold.remainingAmount)})`}
                          </p>
                        </div>
                      )}

                      {/* READY_FOR_CHECKIN: Contract & payment complete, ready for handover */}
                      {hold.status === 'READY_FOR_CHECKIN' && (
                        <div className="rounded-lg bg-stone-50 border border-stone-300 p-2.5 text-right text-xs space-y-1">
                          <p className="font-bold text-black">
                             {'Sẵn sàng nhận bàn giao kho'}
                          </p>
                          <p className="text-[11px] text-stone-600">
                            {'Nhân viên sẽ chụp ảnh hiện trạng và kích hoạt mã PIN mở cửa.'}
                          </p>
                        </div>
                      )}

                      {/* COMPLETED: Check-in complete, show rental */}
                      {hold.status === 'COMPLETED' && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {linkedRental && !receiptConfirmed && <Button variant="primary" size="sm" onClick={() => { try { confirmUnitReceipt(linkedRental.id, user); archiveReservationHistory(hold.id, user); setPage('rental-records'); showToast('Đã xác nhận nhận kho. Đơn giữ kho đã được chuyển sang Hồ sơ thuê của tôi.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận bàn giao.') } }}>Xác nhận đã nhận kho</Button>}
                          <Button variant="outline" size="sm" onClick={() => navigateTo('rental-records')}>{'Xem hồ sơ thuê kho'}</Button>
                        </div>
                      )}

                      {/* Cancel Reservation Action */}
                      {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 text-xs"
                          onClick={() => {
                            const warning = hold.payment.status === 'paid'
                              ? ('Đơn đã thanh toán cọc giữ chỗ. Nếu hủy trước Check-in, khoản cọc này KHÔNG ĐƯỢC HOÀN. Bạn chắc chắn muốn hủy?')
                              : ('Bạn có chắc chắn muốn hủy giữ kho? Suất kho đang giữ sẽ được trả lại ngay.')
                            if (window.confirm(warning)) {
                              cancelReservation(hold.id, user, 'Khách hàng chủ động hủy')
                              showToast('Đã hủy đơn đặt giữ kho thành công.')
                            }
                          }}
                        >
                          ✕ {'Hủy giữ kho'}
                        </Button>
                      )}

                      {hold.status === 'CANCELLED' && (
                        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-right text-xs text-red-800 shadow-sm">
                          <p className="font-bold text-red-800">✕ {'Đơn đã hủy'}</p>
                          <p className="mt-0.5 text-[11px] text-red-700">{'Gian kho đã được giải phóng.'}</p>
                          {hold.payment.status === 'paid' && <p className="mt-1 font-semibold text-red-800">{'Cọc giữ chỗ không hoàn lại do hủy trước Check-in.'}</p>}
                        </div>
                      )}

                      {hold.status === 'EXPIRED' && (
                        <div className="rounded-lg bg-stone-100 border border-stone-300 px-3 py-1.5 text-xs text-stone-600 text-right">
                          <p className="font-bold text-stone-700"> {'Đơn đã hết hạn (Quá hạn/No-show)'}</p>
                          <p className="text-[11px] mt-0.5">{'Gian kho đã được hoàn lại danh mục.'}</p>
                        </div>
                      )}
                      {linkedRentalEnded && <div className="inactive-record-alert rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-right text-xs text-red-800"><p className="font-bold">{'Hồ sơ giữ kho đã hết hiệu lực'}</p><p className="mt-0.5">{'Hợp đồng đã hoàn tất trả kho; mã PIN đã bị thu hồi.'}</p></div>}
                      {holdInactive && <Button variant="outline" size="sm" onClick={() => { if (!window.confirm('Xóa lịch sử này khỏi danh sách của bạn? Dữ liệu đối soát hệ thống vẫn được lưu.')) return; try { archiveReservationHistory(hold.id, user); showToast('Đã xóa lịch sử giữ kho khỏi danh sách.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử.') } }}><span aria-hidden="true">🗑</span> {'Xóa lịch sử'}</Button>}
                    </div>
                  </div>
                </Card>
              )})}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto w-fit text-stone-300">{Icon.calendar}</div>
              <h2 className="mt-3 font-semibold text-stone-700">{'Chưa có đơn đặt giữ kho nào'}</h2>
              <p className="mt-1 text-sm text-stone-500">{'Đơn đặt giữ kho của bạn sẽ hiển thị tại đây.'}</p>
              <Button className="mt-4" size="sm" onClick={() => navigateTo('browse-units')}>
                {'Khám phá gian kho'}
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ── MY RENTALS (HỒ SƠ THUÊ CỦA TÔI) ───────────────────── */}
      {page === 'rental-records' && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={'Hồ Sơ Thuê Kho Của Tôi'}
            subtitle={'Hồ sơ thuê thực tế (kích hoạt sau check-in), mã mở cửa và thủ tục trả kho'}
            action={<Button variant="outline" size="sm" onClick={() => setPage(previousPage || 'overview')}>← {'Quay lại'}</Button>}
          />

          {visibleMyRentals.length ? (
            <div className="grid gap-4">
              {visibleMyRentals.map(rental => (
                <Card id={`customer-record-${rental.id}`} tabIndex={-1} key={rental.id} className={`overflow-hidden ${rental.status === 'completed' ? 'inactive-record-card border-stone-300 bg-white text-stone-500' : ''} ${focusedNotificationTarget === rental.id ? 'notification-target-reveal' : ''}`}>
                  <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-amber-700">{rental.id}</span>
                        <h2 className="text-lg font-bold text-stone-900">{`Gian kho ${rental.unitId}`}</h2>
                        {badgeFor(rental.status)}
                        {(() => {
                          const end = parseCustomerDate(rental.endDate)
                          if (!end || rental.status !== 'active') return null
                          const today = new Date(now); today.setHours(0, 0, 0, 0)
                          end.setHours(0, 0, 0, 0)
                          if (today.getTime() <= end.getTime()) return null
                          const overdueDays = Math.floor((today.getTime() - end.getTime()) / 86_400_000)
                          return <span className="inline-flex rounded bg-red-700 px-2.5 py-1 text-xs font-bold text-white">{`Quá hạn ${overdueDays} ngày`}</span>
                        })()}
                      </div>
                      <p className="mt-1 text-sm text-stone-600">{rental.facilityName} · {rental.unitType} ({rental.areaM2} m² · {rental.volumeM3 || 15} m³)</p>
                      <p className="mt-2 text-xs text-stone-400">
                        {'Kỳ thuê: '} {rental.startDate} → {rental.endDate} · {'Hạn đóng cước: '} {rental.nextDue}
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="rounded-md bg-[#292a27] px-3 py-1 text-white text-xs flex items-center gap-2">
                          <span className="text-stone-400">{'Mã mở cổng:'}</span>
                          <span className="text-[#e9a12c] font-bold tracking-wider">{rental.gateCode}</span>
                        </div>
                        <span className="text-xs text-stone-500">{'Tiền đảm bảo kho:'} <b>{formatVnd(rental.securityDeposit ?? rental.deposit)}</b></span>
                      </div>
                    </div>

                    <div className="md:text-right">
                      <p className="text-2xl font-bold text-stone-900">{formatVnd(rental.monthlyRate)}<span className="text-sm font-normal text-stone-500">/{'tháng'}</span></p>
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
                          {'Hợp đồng thuê'}
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
                               {renewals.some(item => item.rentalId === rental.id && ['pending', 'approved', 'payment_processing'].includes(item.status)) ? ('Đang xử lý gia hạn') : ('Yêu cầu gia hạn')}
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
                               {'Yêu cầu trả kho'}
                            </Button>
                          </>
                        )}
                        {rental.status === 'return_requested' && (
                          <Badge variant="warning">{'Đã gửi yêu cầu trả kho'}</Badge>
                        )}
                        {rental.status === 'completed' && (
                          <><span className="inactive-record-alert rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-xs font-bold text-red-800">{'Hồ sơ hết hiệu lực · PIN đã thu hồi'}</span><Button variant="outline" size="sm" onClick={() => { if (!window.confirm('Xóa hồ sơ thuê này khỏi danh sách của bạn? Dữ liệu đối soát vẫn được lưu.')) return; try { archiveRentalHistory(rental.id, user); showToast('Đã xóa lịch sử hồ sơ thuê khỏi danh sách.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử hồ sơ thuê.') } }}><span aria-hidden="true">🗑</span> {'Xóa lịch sử'}</Button></>
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
                      return <div className="border-t border-red-300 bg-red-50 px-5 py-4 text-xs text-red-900"><p className="font-bold">⚠ {`Hợp đồng đã quá hạn ${overdueDays} ngày`}</p><p className="mt-1">{`Hợp đồng đã hết hạn ngày ${rental.endDate}. Phí muộn tạm tính hiện tại: ${overdueDays} ngày × ${formatVnd(lateFeePerDay)} = ${formatVnd(currentLateFee)}. Bạn vẫn có thể gửi yêu cầu gia hạn; phí cuối cùng được tính đến ngày thanh toán hoặc ngày ký hợp đồng gia hạn, tùy ngày nào muộn hơn.`}</p></div>
                    }
                    if (remainingDays > reminderWindow) return null
                    return <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-950"><p className="font-bold">⚠ {'Hợp đồng sắp hết hạn'}</p><p className="mt-1">{`Còn ${remainingDays} ngày đến ${rental.endDate}. Vui lòng gửi yêu cầu gia hạn nếu bạn muốn tiếp tục thuê kho.`}</p></div>
                  })()}
                  {!rental.receiptConfirmedAt && rental.status !== 'completed' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-200 bg-blue-50 px-5 py-4 text-xs">
                      <div><p className="font-bold text-blue-950">{'Xác nhận bàn giao'}</p><p className="mt-0.5 text-blue-800">{'Kiểm tra đúng gian kho và mã truy cập trước khi xác nhận.'}</p></div>
                      <Button size="sm" onClick={() => { try { confirmUnitReceipt(rental.id, user); showToast('Đã xác nhận nhận kho và mã truy cập.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận bàn giao.') } }}>{'Tôi đã nhận kho'}</Button>
                    </div>
                  )}
                  {rental.receiptConfirmedAt && <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-semibold text-emerald-800">✓ {`Đã xác nhận nhận kho lúc ${new Date(rental.receiptConfirmedAt).toLocaleString('vi-VN')}`}</div>}
                  {(() => {
                    const rentalRenewals = renewals.filter(r => r.rentalId === rental.id)
                    if (!rentalRenewals.length) return null
                    return <div className="space-y-2 border-t border-stone-200 px-5 py-4">
                      <p className="text-xs font-bold text-stone-900">{'Yêu cầu gia hạn'}</p>
                      {rentalRenewals.map(renewal => {
                        const paymentExpired = renewal.paymentDueAt ? new Date(renewal.paymentDueAt).getTime() <= now : false
                        const contractOverdue = new Date(`${renewal.oldEndDate}T23:59:59`).getTime() < now
                        return <div key={renewal.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-stone-900">{`Gói gia hạn ${renewal.renewalMonths || 1} tháng`} · {renewal.oldEndDate} → {renewal.newEndDate}</p>
                              <p className="mt-1 text-stone-500">{renewal.id} · {badgeFor(renewal.status)}</p>
                              {renewal.invoiceNumber && <p className="mt-1 text-stone-600">{'Hóa đơn'}: <b>{renewal.invoiceNumber}</b></p>}
                              {renewal.status === 'approved' && renewal.paymentDueAt && <p className={`mt-1 font-semibold ${paymentExpired ? 'text-red-700' : 'text-amber-700'}`}>{'Hạn thanh toán cọc 72 giờ'}: {new Date(renewal.paymentDueAt).toLocaleString('vi-VN')}</p>}
                              {renewal.status === 'approved' && renewal.paymentDueAt && !paymentExpired && <p className="mt-1 text-sm font-extrabold text-red-700">⏱ {'Còn lại'}: {formatCountdown(renewal.paymentDueAt).text}</p>}
                              {renewal.status === 'approved' && contractOverdue && <p className="mt-1 font-semibold text-red-700">{'Hợp đồng cũ đã hết hạn; phí muộn được tính từ ngày kế tiếp ngày hết hạn đến ngày thanh toán/ký thực tế.'}</p>}
                              {renewal.status === 'pending' && <p className="mt-1 text-blue-700">{'Bạn có thể sửa hoặc hủy trước khi Manager duyệt. Mọi thay đổi sẽ được ghi nhận cho Manager.'}</p>}
                              {renewal.updatedAt && <p className="mt-1 text-stone-500">{'Cập nhật gần nhất'}: {new Date(renewal.updatedAt).toLocaleString('vi-VN')}</p>}
                              {renewal.status === 'payment_expired' && <p className="mt-1 text-red-700">{'Yêu cầu đã hết hiệu lực. Hãy gửi yêu cầu mới để Manager kiểm tra lại khả dụng.'}</p>}
                              {renewal.status === 'rejected' && renewal.notes && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 font-semibold text-red-800">{'Lý do Manager từ chối'}: {renewal.notes}</p>}
                              {renewal.status === 'appointment_scheduled' && <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-900"><p className="font-bold">{`Đã cọc 20% · Hẹn ký ${renewal.appointmentDate} lúc ${renewal.appointmentTime}`}</p><p className="mt-1">{`Còn thu tại cơ sở: ${formatVnd(renewal.remainingAmount ?? 0)}${renewal.lateFeeAmount ? ` + phụ thu trễ ${formatVnd(renewal.lateFeeAmount)}` : ''}. Hợp đồng chưa được kéo dài.`}</p></div>}
                              {renewal.status === 'completed' && <p className="mt-1 text-emerald-700">{`Phụ lục ${renewal.addendumNumber} · Hiệu lực từ ${renewal.effectiveAt ? new Date(renewal.effectiveAt).toLocaleString('vi-VN') : renewal.paidAt}`}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <b>{formatVnd(renewal.totalAmount ?? renewal.renewalFee)}</b>
                              {renewal.status === 'pending' && <><Button variant="outline" size="sm" onClick={() => { setActiveRentalForRenewal(rental); setRenewalMonths(renewal.renewalMonths); setEditingRenewalId(renewal.id); setRenewalModalOpen(true) }}>{'Chỉnh sửa'}</Button><Button variant="outline" size="sm" className="border-red-300 text-red-700" onClick={() => { if (!window.confirm('Bạn chắc chắn muốn hủy yêu cầu gia hạn này?')) return; try { cancelRenewalRequest(renewal.id, user); showToast('Đã hủy yêu cầu. Manager đã nhận được cập nhật.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể hủy yêu cầu.') } }}>{'Hủy yêu cầu'}</Button></>}
                              {renewal.status === 'approved' && !paymentExpired && <Button size="sm" onClick={() => {
                                setActiveRenewalForPayment(renewal)
                                setRenewalPaymentMethod('BANK_TRANSFER')
                                setRenewalTermsAccepted(false)
                                const suggestedSigningDate = new Date()
                                if (new Date(`${renewal.oldEndDate}T23:59:59`).getTime() >= now) suggestedSigningDate.setDate(suggestedSigningDate.getDate() + 1)
                                setRenewalAppointmentDate(dateInputValue(suggestedSigningDate))
                                setRenewalAppointmentTime('09:00')
                                setRenewalPaymentOpen(true)
                              }}>{'Xem hóa đơn & thanh toán'}</Button>}
                              {renewal.status === 'approved' && !paymentExpired && <Button variant="outline" size="sm" className="border-red-300 text-red-700" onClick={() => {
                                if (!window.confirm(`Hủy yêu cầu đã được duyệt sẽ làm hóa đơn ${renewal.invoiceNumber || ''} mất hiệu lực. Bạn chắc chắn muốn tiếp tục?`)) return
                                try {
                                  cancelRenewalRequest(renewal.id, user)
                                  setRenewalPaymentOpen(false)
                                  showToast('Đã hủy gia hạn và vô hiệu hóa hóa đơn. Manager đã nhận được thông báo.')
                                } catch (error) {
                                  showToast(error instanceof Error ? error.message : 'Không thể hủy yêu cầu gia hạn.')
                                }
                              }}>{'Hủy gia hạn'}</Button>}
                              {renewal.status === 'appointment_scheduled' && <Button variant="outline" size="sm" className="border-red-300 text-red-700" onClick={() => { if (!window.confirm(`Hủy sau khi đã cọc sẽ không được hoàn lại ${formatVnd(renewal.bookingDepositAmount ?? 0)}. Manager sẽ nhận được thông báo. Bạn vẫn muốn hủy?`)) return; try { cancelRenewalRequest(renewal.id, user); showToast('Đã hủy gia hạn. Cọc gia hạn không hoàn lại và Manager đã được thông báo.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể hủy gia hạn.') } }}>{'Hủy lịch gia hạn'}</Button>}
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
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-stone-950">{'Nghiệm thu và quyết toán trả kho'}</p><p className="mt-1 text-stone-500">{returnCase.id} · {badgeFor(returnCase.status)}</p></div>{returnCase.refundTransaction && <span className="rounded-lg bg-emerald-100 px-3 py-2 font-bold text-emerald-800">{'Đã hoàn cọc'} {formatVnd(returnCase.refundTransaction.amount)}</span>}</div>
                      {['awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'].includes(returnCase.status) && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Hiện trạng ban đầu'}</p><p className="mt-1 font-semibold">{returnCase.initialConditionSnapshot}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Kết quả nghiệm thu'}</p><p className="mt-1 font-semibold">{returnCase.damageClassification || '—'} · {returnCase.staffNotes || '—'}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{`Phí quá hạn (${returnCase.overdueDays || 0} ngày)`}</p><p className="mt-1 font-bold text-red-700">{formatVnd(returnCase.overdueFee || 0)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Cọc được hoàn'}</p><p className="mt-1 font-bold text-emerald-700">{formatVnd(returnCase.netRefundAmount)}</p></div><div className={`rounded-lg p-3 ${(returnCase.amountDueFromCustomer || 0) > 0 ? 'bg-red-100' : 'bg-white'}`}><p className="text-stone-500">{'Khách phải đóng thêm'}</p><p className="mt-1 font-bold text-red-700">{formatVnd(returnCase.amountDueFromCustomer || 0)}</p></div></div>}
                      {returnCase.evidence.length > 0 && <p className="mt-3 text-stone-600">{'Minh chứng'}: {returnCase.evidence.join(' · ')}</p>}
                      {returnCase.status === 'awaiting_customer_confirmation' && <div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { const reason = window.prompt('Nhập lý do cần xem xét lại:'); if (reason !== null) { try { confirmReturnSettlement(returnCase.id, user, 'disputed', reason); showToast('Đã gửi yêu cầu xem xét lại.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu.') } } }}>{'Yêu cầu xem xét lại'}</Button><Button size="sm" onClick={() => { const due = returnCase.amountDueFromCustomer || 0; if (window.confirm((due > 0 ? `Tổng phí vượt tiền đảm bảo. Xác nhận quyết toán và tiếp tục đóng thêm ${formatVnd(due)}?` : `Xác nhận quyết toán và yêu cầu hoàn cọc ${formatVnd(returnCase.netRefundAmount)}?`))) { try { confirmReturnSettlement(returnCase.id, user, 'accepted'); showToast(due > 0 ? (`Đã xác nhận. Vui lòng thanh toán thêm ${formatVnd(due)}.`) : ('Đã xác nhận quyết toán. Hồ sơ và PIN đã hết hiệu lực; đang chờ Staff chuyển hoàn cọc.')) } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận quyết toán.') } } }}>{'Đồng ý quyết toán'}</Button></div>}
                      {returnCase.status === 'payment_due' && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3"><div><p className="font-bold text-red-900">{`Cần thanh toán thêm ${formatVnd(returnCase.amountDueFromCustomer ?? 0)}`}</p><p className="mt-1 text-red-700">{'Sau khi thanh toán, hệ thống sẽ đóng hồ sơ và phát hành biên nhận trong Lịch sử thanh toán.'}</p></div><Button size="sm" onClick={() => { const reference = `RET-BAL-${Date.now()}`; if (!window.confirm(`Thanh toán ${formatVnd(returnCase.amountDueFromCustomer ?? 0)} bằng chuyển khoản?`)) return; try { payReturnBalance(returnCase.id, user, 'BANK_TRANSFER', reference); showToast('Đã thanh toán phần thiếu và phát hành biên nhận.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể thanh toán.') } }}>{'Thanh toán phần thiếu'}</Button></div>}
                      {returnCase.status === 'disputed' && <p className="mt-3 rounded-lg bg-amber-100 p-3 font-semibold text-amber-900">{'Đang chờ Facility Manager xem xét lại'}: {returnCase.customerDecisionNote}</p>}
                      {returnCase.status === 'refund_pending' && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">{'Hồ sơ thuê và mã PIN đã hết hiệu lực. Staff đang chuyển hoàn cọc; biên nhận sẽ xuất hiện sau khi xác nhận giao dịch.'}</p>}
                      {rental.status === 'completed' && units.find(unit => unit.id === rental.unitId)?.status === 'maintenance' && <p className="mt-3 rounded-lg border border-stone-300 bg-stone-100 p-3 font-semibold text-stone-700">{'Gian kho đang chờ Manager nghiệm thu vệ sinh/bảo trì. Kho chưa được tính vào số lượng còn trống.'}</p>}
                    </div>
                  })()}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto w-fit text-stone-300">{Icon.key}</div>
              <h2 className="mt-3 font-semibold text-stone-700">{'Chưa có hồ sơ thuê nào đang hoạt động'}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {'Hồ sơ thuê chỉ được tạo sau khi đơn giữ kho được nhân viên bàn giao thành công.'}
              </p>
              <Button className="mt-4" size="sm" onClick={() => navigateTo('browse-units')}>
                {'Tìm gian kho trống'}
              </Button>
            </Card>
          )}
        </div>
      )}

      {page === 'contracts' && <div className="fade-in space-y-4">
        <SectionHeader title={'Hợp đồng của tôi'} subtitle={'Bản scan hợp đồng giấy đã ký tại cơ sở'} />
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
              <p className="mt-auto text-[9px] text-stone-500">{'Ảnh xem trước hồ sơ hợp đồng'}</p>
            </div>
          </div>
          <div className="space-y-2 p-4 text-black">
            <div className="flex items-center justify-between gap-3"><div><p className="font-bold">{c.contractNumber}</p>{c.contractType === 'RENEWAL' && <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{'Hợp đồng gia hạn'}</p>}</div><span className="rounded border border-black px-2 py-0.5 text-xs font-semibold">{c.status}</span></div>
            <p>{'Ngày ký'}: {c.signedAt}</p><p>{'Hiệu lực'}: {c.startDate} – {c.endDate}</p>
            <p className="truncate text-stone-600">{c.scannedFileName}</p>
            <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-3"><a href={c.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-black">{'Xem bản scan'}</a><a href={c.scannedFileUrl} download={c.scannedFileName} className="font-bold underline text-black">{'Tải xuống'}</a>{contractInactive && <Button variant="outline" size="sm" onClick={() => { if (!window.confirm('Xóa hợp đồng hết hiệu lực này khỏi danh sách của bạn? Bản lưu đối soát vẫn được giữ.')) return; try { archiveContractHistory(c.id, user); showToast('Đã xóa hợp đồng khỏi danh sách.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử hợp đồng.') } }}><span aria-hidden="true">🗑</span> {'Xóa lịch sử'}</Button>}</div>
          </div>
        </Card>})}</div> : <Card className="p-4 text-sm text-stone-500">{'Chưa có hợp đồng giấy đã ký. Hợp đồng sẽ xuất hiện sau khi nhân viên lưu bản scan.'}</Card>}
      </div>}

      {/* ── PAYMENTS ─────────────────────────────────────────── */}
      {page === 'payments' && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={'Lịch Sử Thanh Toán & Quyết Toán'}
            subtitle={'Hóa đơn tiền thuê, phí giữ kho và quyết toán hoàn cọc'}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-stone-500">{'Đã thanh toán'}</p><p className="mt-1 text-2xl font-extrabold text-stone-950">{formatVnd(myPayments.filter(p => p.type !== 'REFUND' && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0))}</p></Card>
            <Card className="p-4"><p className="text-xs text-stone-500">{'Đã hoàn cọc'}</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{formatVnd(myPayments.filter(p => p.type === 'REFUND' && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0))}</p></Card>
            <Card className="p-4"><p className="text-xs text-stone-500">{'Gia hạn chờ thanh toán'}</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{renewals.filter(r => r.customerId === user.id && r.status === 'approved').length}</p></Card>
          </div>

          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{'Mã Giao Dịch'}</Th>
                  <Th>{'Gian Kho'}</Th>
                  <Th>{'Nội Dung'}</Th>
                  <Th>{'Phương Thức'}</Th>
                  <Th>{'Số Tiền'}</Th>
                  <Th>{'Trạng Thái'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {myPayments.map(payment => {
                  const rental = myRentals.find(r => r.id === payment.rentalId)
                  const hold = myHolds.find(h => h.id === payment.reservationId)
                  const labels: Record<string, string> = { RESERVATION_DEPOSIT: 'Cọc giữ chỗ 20%', INITIAL_RENT: 'Phần còn lại tại cơ sở', RENEWAL: 'Thanh toán gia hạn', DAMAGE_FEE: 'Thanh toán quyết toán trả kho', REFUND: 'Hoàn cọc sau quyết toán' }
                  return <Tr key={payment.id}><Td><span className="text-xs text-stone-600">{payment.transactionReference || payment.id}</span><p className="mt-0.5 text-[10px] text-stone-400">{payment.paidAt ? new Date(payment.paidAt).toLocaleString('vi-VN') : '—'}</p></Td><Td><b>{rental?.unitId || hold?.assignedUnitId || hold?.unitTypeName || '—'}</b><p className="text-[10px] text-stone-400">{rental?.facilityName || hold?.facilityName}</p></Td><Td>{labels[payment.type] || payment.type}</Td><Td><span className="text-xs text-stone-500">{payment.paymentMethod || '—'}</span></Td><Td><b className={payment.type === 'REFUND' ? 'text-emerald-700' : 'text-stone-950'}>{payment.type === 'REFUND' ? '+' : ''}{formatVnd(payment.amount)}</b></Td><Td><span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${payment.status === 'PAID' ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{payment.status === 'PAID' ? ('Hoàn tất') : ('Đang xử lý')}</span></Td></Tr>
                })}
                {!myPayments.length && <tr><td colSpan={6}><p className="py-6 text-center text-sm text-stone-500">{'Chưa có giao dịch nào.'}</p></td></tr>}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── SUPPORT ─────────────────────────────────────────── */}
      {page === 'support' && (() => {
        const categoryLabels: Record<string, string> = {
          'Access & Entry': 'Ra vào & mã PIN',
          'Billing & Invoices': 'Thanh toán & hóa đơn',
          'Unit Condition': 'Hiện trạng gian kho',
          'General Inquiry': 'Tư vấn chung'
        }
        const tabOptions = [
          { value: 'All', label: 'Tất cả', count: myTickets.length },
          { value: 'open', label: 'Chờ tiếp nhận', count: myTickets.filter(t => t.status === 'open').length },
          { value: 'in-progress', label: 'Đang xử lý', count: myTickets.filter(t => t.status === 'in-progress').length },
          { value: 'resolved', label: 'Đã giải quyết', count: myTickets.filter(t => t.status === 'resolved').length }
        ]
        const formatTicketTime = (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
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
              title={'Tổng Đài Hỗ Trợ Khách Hàng'}
              subtitle={'Gửi yêu cầu đổi mã PIN, hỏi cước phí hoặc xử lý sự cố ra vào kho'}
              action={
                <Button size="sm" onClick={() => setTicketOpen(true)}>
                  {Icon.plus} {'Tạo yêu cầu mới'}
                </Button>
              }
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4"><p className="text-xs text-stone-500">{'Tổng yêu cầu'}</p><p className="mt-1 text-2xl font-extrabold">{myTickets.length}</p></Card>
              <Card className="p-4"><p className="text-xs text-stone-500">{'Đang cần xử lý'}</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{myTickets.filter(t => t.status !== 'resolved').length}</p></Card>
              <Card className="p-4"><p className="text-xs text-stone-500">{'Đã giải quyết'}</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{myTickets.filter(t => t.status === 'resolved').length}</p></Card>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {tabOptions.map(tab => <button key={tab.value} type="button" onClick={() => setSupportTab(tab.value)} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${supportTab === tab.value ? 'border-amber-500 bg-amber-500 text-stone-950 shadow-sm' : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300'}`}>{tab.label} <span className={`ml-1 rounded-full px-1.5 py-0.5 ${supportTab === tab.value ? 'bg-white/60' : 'bg-stone-100'}`}>{tab.count}</span></button>)}
              </div>
              <label className="relative ml-auto block w-full xl:w-80">
                <span className="sr-only">Tìm phiếu hỗ trợ</span>
                <input type="search" placeholder={'Tìm phiếu...'} value={supportSearch} onChange={e => setSupportSearch(e.target.value)} className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-4 text-sm" />
                <span className="pointer-events-none absolute left-3 top-3 text-stone-400">{SearchIcon}</span>
              </label>
            </div>

            <div className="space-y-3">
              {filteredTickets.map(ticket => {
                const latestMessage = ticket.messages[ticket.messages.length - 1]
                const priorityLabel = ticket.priority === 'high' ? ('Ảnh hưởng cao') : ticket.priority === 'medium' ? ('Ảnh hưởng vừa') : ('Ảnh hưởng thấp')
                return <Card id={`customer-record-${ticket.id}`} tabIndex={-1} key={ticket.id} className={`overflow-hidden ${focusedNotificationTarget === ticket.id ? 'notification-target-reveal' : ''}`}>
                  <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-amber-700">{ticket.id}</span>{badgeFor(ticket.status)}<Badge variant={ticket.priority === 'high' ? 'error' : ticket.priority === 'medium' ? 'warning' : 'muted'}>{priorityLabel}</Badge></div>
                      <h2 className="mt-2 text-base font-bold text-stone-950">{ticket.subject}</h2>
                      <p className="mt-1 text-xs text-stone-500">{categoryLabels[ticket.category] || ticket.category} · {ticket.facility}{ticket.unit && ticket.unit !== '—' ? ` · ${ticket.unit}` : ''}</p>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          { label: 'Đã gửi yêu cầu', done: true, current: ticket.status === 'open' },
                          { label: 'Staff đang xử lý', done: ticket.status !== 'open', current: ticket.status === 'in-progress' },
                          { label: 'Xử lý thành công', done: ticket.status === 'resolved', current: ticket.status === 'resolved' }
                        ].map((step, index) => <div key={step.label} className={`rounded-lg border px-3 py-2 text-center text-[11px] font-bold ${step.current ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm' : step.done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-50 text-stone-400'}`}><span className="block text-sm">{step.done ? '✓' : index + 1}</span>{step.label}</div>)}
                      </div>
                      {latestMessage && <div className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600"><b>{latestMessage.role === 'staff' ? ('Staff phản hồi:') : ('Bạn:')}</b> <span className="line-clamp-1">{latestMessage.text}</span></div>}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end"><p className="text-xs text-stone-400">{formatTicketTime(ticket.updatedAt || ticket.created)}</p>{ticket.assignedStaff && <p className="text-xs text-stone-500">{'Phụ trách'}: <b>{ticket.assignedStaff}</b></p>}<Button variant="outline" size="sm" onClick={() => { setSelectedTicket(ticket); setConversationOpen(true) }}>{'Mở trao đổi'} · {ticket.messages.length}</Button></div>
                  </div>
                </Card>
              })}
              {!filteredTickets.length && <Card className="p-10 text-center"><p className="font-semibold text-stone-700">{'Không có yêu cầu phù hợp'}</p><p className="mt-1 text-sm text-stone-500">{'Thử đổi bộ lọc hoặc tạo một yêu cầu hỗ trợ mới.'}</p></Card>}
            </div>
          </div>
        )
      })()}

      {/* ── POLICIES PAGE ─────────────────────────────────────── */}
      {page === 'policies' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            title={'Quy Định & Chính Sách Thuê Kho'}
            subtitle={'Quy định về thuê kho, Check-in, gia hạn, trả kho, thanh toán và xử lý trễ hạn'}
          />

          <div className="overflow-hidden rounded-2xl bg-[#292a27] text-white shadow-lg">
            <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-400">StorageHub</p><h2 className="mt-2 text-xl font-bold">{'Quy trình thuê kho và thanh toán rõ ràng'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-300">{'Mỗi giai đoạn đều có thời hạn, khoản thanh toán và điều kiện hoàn tất cụ thể để khách hàng chủ động theo dõi.'}</p></div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-white/10 px-4 py-3"><b className="block text-lg text-amber-400">30</b>{'phút tạm giữ'}</div><div className="rounded-xl bg-white/10 px-4 py-3"><b className="block text-lg text-amber-400">12</b>{'giờ trả cọc'}</div><div className="rounded-xl bg-white/10 px-4 py-3"><b className="block text-lg text-amber-400">14</b>{'ngày check-in'}</div></div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="border-b border-amber-200 px-5 py-4 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-800">{'Hiểu đúng các khoản tiền'}</p>
              <h2 className="mt-1 text-lg font-bold text-stone-950">{'Cọc giữ chỗ và tiền đảm bảo kho là hai khoản khác nhau'}</h2>
            </div>
            <div className="grid gap-px bg-amber-200 md:grid-cols-3">
              <div className="bg-white p-5"><p className="text-sm font-bold text-blue-800">{'1. Cọc giữ chỗ 20%'}</p><p className="mt-2 text-sm leading-6 text-stone-600">{'Tính trên toàn bộ tiền thuê của kỳ đã chọn. Khoản này được trừ vào tiền thuê, không cộng thêm vào giá thuê và không hoàn nếu khách hủy trước Check-in.'}</p></div>
              <div className="bg-white p-5"><p className="text-sm font-bold text-emerald-800">{'2. Tiền đảm bảo kho'}</p><p className="mt-2 text-sm leading-6 text-stone-600">{'Bằng một tháng tiền thuê và được thu riêng tại Check-in. Đây không phải tiền thuê; khoản còn lại được hoàn sau khi trả kho và hoàn tất nghiệm thu.'}</p></div>
              <div className="bg-white p-5"><p className="text-sm font-bold text-amber-800">{'3. Số tiền thu tại Check-in'}</p><p className="mt-2 text-sm leading-6 text-stone-600">{'Tiền thuê còn lại sau khi trừ cọc giữ chỗ + tiền đảm bảo kho. Mọi khoản thu phải có mã giao dịch hoặc biên nhận trong hồ sơ.'}</p></div>
            </div>
            <div className="px-5 py-3 text-sm font-semibold text-amber-950 sm:px-6">{'Công thức: Tổng cần chuẩn bị = Tổng tiền thuê kỳ đầu + Tiền đảm bảo kho. Cọc giữ chỗ 20% chỉ là phần trả trước của tiền thuê.'}</div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-extrabold text-amber-800">1</span><div><h3 className="font-bold text-stone-950">{'Thuê kho và thanh toán ban đầu'}</h3><p className="text-xs text-stone-500">{'Từ lúc chọn kho đến khi xác nhận đặt giữ'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              'Suất theo cỡ kho được tạm giữ 30 phút trong lúc hoàn tất khai báo.',
              'Sau khi tạo đơn, khách có 12 giờ để thanh toán cọc giữ chỗ bằng 20% tổng giá trị kỳ thuê.',
              'Cọc giữ chỗ được trừ vào tiền thuê; nếu khách hủy trước Check-in thì khoản này không được hoàn.',
              'Đơn tự hết hiệu lực nếu không thanh toán cọc giữ chỗ trong 12 giờ.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-emerald-700">✓</span><span>{item}</span></p>)}</div></Card>

            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-extrabold text-blue-800">2</span><div><h3 className="font-bold text-stone-950">{'Check-in và nhận kho'}</h3><p className="text-xs text-stone-500">{'Hoàn tất trong thời hạn nhận kho'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              'Khách đặt lịch và hoàn tất Check-in trong tối đa 14 ngày kể từ ngày cọc.',
              'Khi Check-in, khách hoàn tất hợp đồng và xác nhận hiện trạng gian kho trước khi nhận quyền truy cập.',
              'Khoản phải trả tại Check-in gồm tiền thuê còn lại sau khi trừ cọc giữ chỗ và tiền đảm bảo kho bằng một tháng tiền thuê.',
              'Check-in chỉ hoàn tất sau khi các khoản đến hạn đã được thanh toán và khách xác nhận nhận đúng gian kho.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-blue-700">✓</span><span>{item}</span></p>)}</div></Card>

            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-extrabold text-emerald-800">3</span><div><h3 className="font-bold text-stone-950">{'Gia hạn thuê kho'}</h3><p className="text-xs text-stone-500">{'Hoàn tất trước khi kỳ thuê mới có hiệu lực'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              'Khách gửi yêu cầu, chọn số tháng muốn gia hạn và theo dõi trạng thái xác nhận trên hồ sơ thuê.',
              'Khi yêu cầu được chấp thuận, khách thanh toán trước 20% giá trị kỳ gia hạn trong thời hạn hiển thị.',
              'Khách thanh toán 80% còn lại và hoàn tất phụ lục trước khi kỳ gia hạn có hiệu lực.',
              'Nếu quá hạn thanh toán, yêu cầu gia hạn hết hiệu lực và khách cần gửi yêu cầu mới.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-emerald-700">✓</span><span>{item}</span></p>)}</div></Card>

            <Card className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 font-extrabold text-violet-800">4</span><div><h3 className="font-bold text-stone-950">{'Trả kho và hoàn tiền đảm bảo'}</h3><p className="text-xs text-stone-500">{'Quyết toán khi kết thúc thuê'}</p></div></div><div className="space-y-3 text-sm text-stone-700">{[
              'Khách gửi yêu cầu trả kho và hoàn tất bàn giao theo lịch đã xác nhận.',
              'Gian kho phải được dọn trống; hiện trạng và các khoản còn phải thanh toán được ghi nhận khi trả kho.',
              'Tiền đảm bảo kho được hoàn sau khi trừ các khoản hư hại, vệ sinh, thất lạc, trễ hạn hoặc công nợ đã xác nhận.',
              'Việc trả kho hoàn tất khi quyết toán được xác nhận, tiền hoàn được xử lý và quyền truy cập kho chấm dứt.'
            ].map(item => <p key={item} className="flex gap-2"><span className="text-violet-700">✓</span><span>{item}</span></p>)}</div></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-rose-200 p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-rose-700">{'Quy định trễ hạn'}</p><h3 className="mt-2 font-bold text-stone-950">{'Thời hạn và phụ thu được tính theo từng giai đoạn'}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600"><li>• {'Quá 12 giờ chưa thanh toán cọc giữ chỗ: đơn thuê hết hiệu lực.'}</li><li>• {'Quá 14 ngày kể từ ngày cọc mà chưa Check-in: không thể kích hoạt hồ sơ thuê và cọc giữ chỗ không được hoàn.'}</li><li>• {'Hợp đồng quá hạn không có thời gian ân hạn; từ ngày sau ngày hết hạn, phụ thu mỗi ngày bằng 50% đơn giá thuê ngày.'}</li><li>• {'Gia hạn hợp đồng đã quá hạn phải hoàn tất trong 3 ngày kể từ khi thanh toán cọc gia hạn.'}</li></ul></Card>
            <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">{'Tóm tắt thanh toán'}</p><h3 className="mt-2 font-bold text-stone-950">{'Khoản phải trả theo từng mốc'}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600"><li>• {'Đặt giữ: 20% tổng tiền thuê của kỳ đầu.'}</li><li>• {'Check-in: 80% tiền thuê còn lại + tiền đảm bảo kho bằng một tháng tiền thuê.'}</li><li>• {'Gia hạn: trả trước 20%, sau đó thanh toán 80% còn lại trước khi gia hạn có hiệu lực.'}</li><li>• {'Trả kho: thanh toán công nợ và phí phát sinh; phần tiền đảm bảo còn lại được hoàn.'}</li></ul></Card>
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
        title={selectedUnit?.id ? (`Chi tiết kho ${selectedUnit.code}`) : selectedTarget ? (`Hồ Sơ Kỹ Thuật: ${selectedTarget.unitType.name} · ${selectedTarget.facility.name}`) : (selectedUnit ? (`Hồ Sơ Kỹ Thuật & Chi Tiết Cỡ Kho`) : '')}
      >
        {selectedUnit && (() => {
          const catalogUnit = CUSTOMER_CATALOG_UNITS.find(unit => unit.id === selectedUnit.id)

          return (
            <div className="flex flex-col gap-5">
              {/* Top Banner */}
              <div className="order-1 rounded-2xl bg-gradient-to-br from-[#242521] to-[#3a3b37] p-5 text-white shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[.1em] text-[#e9a12c]">
                    {selectedTarget ? `${CUSTOMER_FACILITY_DISPLAY[selectedTarget.facility.id]?.name ?? selectedTarget.facility.name} · ${CUSTOMER_FACILITY_DISPLAY[selectedTarget.facility.id]?.address ?? selectedTarget.facility.address}` : selectedUnit.facilityName}
                  </p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${selectedUnit.status === 'available' ? 'border-white text-white' : 'border-amber-300 bg-amber-700 text-white'}`}>{selectedUnit.status === 'available' ? ('Kho đang còn trống') : ('Kho đang được giữ')}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold">{selectedUnit.code}</h3>
                    <p className="mt-1 text-sm font-semibold text-amber-300">Size {catalogUnit?.sizeCode ?? selectedUnit.type}</p>
                    <p className="mt-1 text-sm text-stone-300">{'Kích thước'}: {selectedUnit.dimensions.lengthM} × {selectedUnit.dimensions.widthM} × {selectedUnit.dimensions.heightM} m ({'dài × rộng × cao'})</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{formatVnd(selectedUnit.price)}<span className="text-sm font-normal text-stone-300">/{'tháng'}</span></p>
                    <p className="text-xs font-medium text-white/70">{'Tiền cọc = 20% tổng giá trị kỳ thuê đã chọn'}</p>
                  </div>
                </div>
              </div>

              {catalogUnit && <figure className="order-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <img src={CUSTOMER_UNIT_DETAIL_IMAGE_BY_SIZE[catalogUnit.sizeCode]} alt={`Sơ đồ chi tiết kho size ${catalogUnit.sizeCode}`} className="max-h-[520px] w-full object-contain bg-white" />
                <figcaption className="border-t border-stone-200 px-4 py-3 text-center text-xs font-medium text-stone-600">Sơ đồ bố trí kho size {catalogUnit.sizeCode} · Kích thước và lối đi theo hồ sơ kho</figcaption>
              </figure>}

              <div className="order-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-amber-800">1. Thông tin kho chi tiết</p>
                {catalogUnit && <ul className="divide-y divide-amber-200/70 overflow-hidden rounded-xl border border-amber-200 bg-white text-sm">
                  {[
                    ['Mã kho', selectedUnit.code],
                    ['Size', catalogUnit.sizeCode],
                    ['Kích thước kho (D × R × C)', `${selectedUnit.dimensions.lengthM} × ${selectedUnit.dimensions.widthM} × ${selectedUnit.dimensions.heightM} m`],
                    ['Thể tích kho', `${selectedUnit.volumeM3.toLocaleString('vi-VN')} m³`],
                    ['Số khung', `${catalogUnit.rackCount} khung`],
                    ['Kích thước mỗi khung', catalogUnit.rackDimensions],
                    ['Lối đi', `${catalogUnit.aisleWidthM.toLocaleString('vi-VN')} m`],
                    ['Xe đẩy phù hợp', catalogUnit.trolley],
                    ['Giá thuê', `${formatVnd(selectedUnit.price)}/tháng`],
                  ].map(([label, value]) => <li key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr]"><span className="font-medium text-stone-500">{label}</span><b className="text-stone-950">{value}</b></li>)}
                </ul>}
              </div>

              <div className="order-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">2. Sức chứa thùng hàng</p>
                {catalogUnit && <ul className="space-y-3 text-sm">
                  <li className="rounded-xl border border-stone-200 bg-white p-4"><b className="block text-stone-950">Thùng nhỏ</b><ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600"><li>Kích thước: 50 × 40 × 40 cm</li><li>Số lượng tối đa: <b className="text-stone-950">{catalogUnit.smallBoxCapacity} thùng</b></li></ul></li>
                  <li className="rounded-xl border border-stone-200 bg-white p-4"><b className="block text-stone-950">Thùng to</b><ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600"><li>Kích thước: 70 × 50 × 50 cm</li><li>Số lượng tối đa: <b className="text-stone-950">{catalogUnit.largeBoxCapacity} thùng</b></li></ul></li>
                </ul>}
              </div>

              <div className="order-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Ưu đãi thuê dài hạn</p>
                <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <li className="rounded-xl border border-emerald-200 bg-white p-3"><b>Thuê 3 tháng</b><span className="mt-1 block text-emerald-700">Giảm 3% tiền thuê</span></li>
                  <li className="rounded-xl border border-emerald-200 bg-white p-3"><b>Thuê 6 tháng</b><span className="mt-1 block text-emerald-700">Giảm 5% tiền thuê</span></li>
                  <li className="rounded-xl border border-emerald-200 bg-white p-3"><b>Thuê 12 tháng</b><span className="mt-1 block text-emerald-700">Giảm 8% tiền thuê</span></li>
                </ul>
              </div>

              {/* 3. Safety, Security & Operating Standards */}
              <div className="order-5">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  {'3. An ninh và tiện ích vận hành'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-1">
                    <p className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="text-blue-600"></span> {'An ninh & Ra vào độc quyền 24/7'}
                    </p>
                    <p className="text-stone-500 text-[11px]">
                      {'Cổng tự động mở bằng mã PIN số cá nhân hóa do bạn sở hữu. Camera CCTV Full-HD góc rộng giám sát 24/7 từng hành lang và cửa kho.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-1">
                    <p className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="text-rose-600"></span> {'Hệ thống PCCC tự động đạt chuẩn'}
                    </p>
                    <p className="text-stone-500 text-[11px]">
                      {'Tích hợp cảm biến khói nhiệt quang học và đầu phun nước tự động Sprinkler riêng biệt cho từng gian kho, thẩm duyệt PCCC định kỳ.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Reservation & Financial Transparency Guarantee */}
              <div className="order-6 rounded-2xl border border-stone-300 bg-white p-4 text-xs text-black sm:p-5">
                <p className="font-bold text-sm text-black mb-1 flex items-center gap-1.5">
                  <span></span> {'4. Quy trình đặt kho và thanh toán'}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {[
                    'Chọn cỡ kho phù hợp',
                    'Tạm giữ suất trong 30 phút',
                    'Thanh toán cọc 20% trong 12 giờ',
                    'Cơ sở phân kho và Check-in trong 14 ngày'
                  ].map((item, index) => <div key={item} className="flex gap-2 rounded-xl bg-stone-50 p-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[10px] font-bold text-white">{index + 1}</span><span className="font-medium leading-4 text-stone-700">{item}</span></div>)}
                </div>
              </div>

              <div className="order-7 flex justify-end gap-2 border-t border-stone-100 pt-4">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>{'Đóng lại'}</Button>
                <Button
                  disabled={selectedUnit.status !== 'available'}
                  onClick={() => {
                    if (selectedTarget) {
                      handleStartReservation(selectedTarget.facility, selectedTarget.unitType, selectedUnit)
                    } else {
                      setDetailOpen(false)
                      setBookOpen(true)
                    }
                  }}
                >
                  {selectedUnit.status === 'available' ? ('Khai báo hàng & Đặt kho này') : ('Kho đang được giữ')}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── MODAL 2: GOODS DECLARATION & HOLD (P0.1, P0.3, P1.1) ─ */}
      <Modal
        open={bookOpen}
        onClose={() => { releaseTemporaryReservationSlot(); resetBookingForm(); setBookOpen(false); showToast('Đã thoát form và trả lại suất kho đang tạm giữ.') }}
        size="xl"
        title={selectedUnit?.id ? (`Đặt kho ${selectedUnit.code}`) : selectedTarget ? (`Đặt Kho: ${selectedTarget.unitType.name}`) : (selectedUnit ? ('Đặt kho') : '')}
      >
        {selectedUnit && currentQuote && (
          <div className="space-y-4">
            <div className="sticky top-0 z-10 rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-4 border-b border-stone-200 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-500">{'Đang tạm giữ kho đã chọn'}</p>
                  <p className="mt-1 font-bold text-black">{selectedUnit.code} · {selectedUnit.facilityName}</p>
                </div>
                <p className={`shrink-0 text-xl font-bold ${formatCountdown(temporaryHoldExpiresAt || undefined).isUrgent ? 'text-red-700' : 'text-black'}`}>⏱ {formatCountdown(temporaryHoldExpiresAt || undefined).text}</p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-700">{'Cỡ kho đã chọn:'}</span>
                <b>{`${selectedUnit.code} · ${selectedUnit.type} (${selectedUnit.areaM2.toLocaleString('vi-VN')} m²)`}</b>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-stone-700">{'Kích thước & Sức chịu tải:'}</span>
                <span>{selectedUnit.dimensions.lengthM}m × {selectedUnit.dimensions.widthM}m × {selectedUnit.dimensions.heightM}m (~{selectedUnit.volumeM3} m³) · Max {selectedUnit.maxLoadKg} kg</span>
              </div>
              <div className="mt-3 rounded-lg bg-stone-100 p-3 text-xs leading-5 text-stone-700">
                {`Bạn đang tạm giữ đúng kho ${selectedUnit.code} trong 30 phút. Kho này sẽ được ẩn khỏi danh sách còn trống sau khi đơn đặt được tạo thành công.`}
              </div>
            </div>

            <div className={bookingReview ? 'hidden' : 'space-y-4'}>
            {Object.keys(bookingErrors).length > 0 && (
              <div ref={bookingErrorRef} role="alert" tabIndex={-1} className="rounded-xl border border-red-700 bg-red-700 p-4 text-sm text-white shadow-lg">
                <p className="font-bold">{'Thông tin chưa hợp lệ'}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{Object.values(bookingErrors).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={'Họ và tên người thuê'} value={user.name} disabled />
              <Input label={'Số CCCD / Hộ chiếu (Đối chiếu lúc check-in)'} value={customerIdCard} onChange={e => setCustomerIdCard(e.target.value)} />
              <Input label={'Số điện thoại liên hệ'} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              <Input label="Email" value={customerEmail} disabled />
              <Input label={'Địa chỉ'} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              <Input label={'Ngày Check-in mong muốn'} type="date" value={moveInDate} min={dateInputValue(new Date())} max={dateInputValue(new Date(now + 14 * 86_400_000))} onChange={e => setMoveInDate(e.target.value)} />
              <div><Input label={'Giờ Check-in (đang mở 24/7 để kiểm thử)'} type="time" min="00:00" max="23:59" step="1800" value={bookingAppointmentTime} onChange={e => setBookingAppointmentTime(e.target.value)} /><p className="mt-1 text-[11px] text-blue-700">{'Bạn có thể chọn bất kỳ giờ nào trong ngày; giới hạn 14 ngày Check-in vẫn được áp dụng.'}</p></div>
              <Select label={'Thời hạn thuê'} value={rentalMonths.toString()} onChange={e => setRentalMonths(Number(e.target.value))}>
                <option value="1">1 {'tháng'}</option>
                <option value="3">3 {'tháng'}</option>
                <option value="6">6 {'tháng'}</option>
                <option value="12">12 {'tháng'}</option>
              </Select>
            </div>

            {/* Goods Declaration */}
            <div className="border-t border-stone-200 pt-3">
              <p className="mb-3 text-sm font-semibold text-stone-900">Khai báo hàng hóa</p>
              <div className="space-y-3">
                {goodsItems.map((item, index) => <div key={item.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                    <div><Select label="Loại hàng hóa" value={item.category} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, category: e.target.value, materialType: '', materialName: '' } : row))}><option value="">Chọn loại hàng hóa</option>{GOODS_CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>{bookingErrors[`goodsCategory-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`goodsCategory-${item.id}`]}</p>}</div>
                    {item.category !== 'OTHER' ? <div><Select label="Chất liệu chính" value={item.materialName} disabled={!item.category} onChange={e => { const materialName = e.target.value; const categoryMaterials = MATERIALS_BY_CATEGORY[item.category as Exclude<GoodsCategoryCode, 'OTHER'>]; const materialType: GoodsDeclarationItem['materialType'] = categoryMaterials?.fragile.includes(materialName) ? 'FRAGILE' : materialName ? 'NORMAL' : ''; setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, materialName, materialType } : row)) }}><option value="">Chọn chất liệu cụ thể</option>{item.category && MATERIALS_BY_CATEGORY[item.category as Exclude<GoodsCategoryCode, 'OTHER'>]?.normal.length > 0 && <optgroup label="Chất liệu thông thường">{MATERIALS_BY_CATEGORY[item.category as Exclude<GoodsCategoryCode, 'OTHER'>].normal.map(material => <option key={`normal-${material}`} value={material}>{material}</option>)}</optgroup>}{item.category && <optgroup label="Chất liệu dễ bể / dễ vỡ">{MATERIALS_BY_CATEGORY[item.category as Exclude<GoodsCategoryCode, 'OTHER'>]?.fragile.map(material => <option key={`fragile-${material}`} value={material}>{material}</option>)}</optgroup>}</Select>{bookingErrors[`goodsMaterial-${item.id}`] && <p className="mt-1 text-xs text-red-700">Vui lòng chọn chất liệu chính.</p>}</div> : <div className="self-end rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Cần Staff duyệt trước khi thu cọc</div>}
                    <Button type="button" size="sm" variant="outline" onClick={() => setGoodsItems(items => items.length === 1 ? [createGoodsDeclarationItem('goods-1')] : items.filter(row => row.id !== item.id))}>Xóa</Button>
                  </div>
                  {item.category === 'OTHER' && <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
                    <p className="font-bold text-stone-900">Thông tin hàng hóa khác</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Input label="Tên hàng hóa *" value={item.customGoodsName} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, customGoodsName: e.target.value } : row))} />{bookingErrors[`customGoodsName-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customGoodsName-${item.id}`]}</p>}</div>
                      <div><Input label="Chất liệu chính *" value={item.customMaterial} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, customMaterial: e.target.value } : row))} />{bookingErrors[`customMaterial-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customMaterial-${item.id}`]}</p>}</div>
                    </div>
                    <div><label className="text-sm font-medium text-stone-700">Mô tả hàng hóa *</label><textarea className="mt-1 min-h-20 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={item.description} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, description: e.target.value } : row))} />{bookingErrors[`customDescription-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customDescription-${item.id}`]}</p>}</div>
                    <div className="grid gap-3 sm:grid-cols-5"><div><Input type="number" min="1" step="1" label="Số lượng *" value={item.quantity} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, quantity: e.target.value } : row))} />{bookingErrors[`customQuantity-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customQuantity-${item.id}`]}</p>}</div><div><Input type="number" min="0.1" label="Dài (cm) *" value={item.lengthCm} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, lengthCm: e.target.value } : row))} />{bookingErrors[`customLength-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customLength-${item.id}`]}</p>}</div><div><Input type="number" min="0.1" label="Rộng (cm) *" value={item.widthCm} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, widthCm: e.target.value } : row))} />{bookingErrors[`customWidth-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customWidth-${item.id}`]}</p>}</div><div><Input type="number" min="0.1" label="Cao (cm) *" value={item.heightCm} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, heightCm: e.target.value } : row))} />{bookingErrors[`customHeight-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customHeight-${item.id}`]}</p>}</div><Input type="number" min="0" label="Khối lượng (kg)" value={item.weightKg} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, weightKg: e.target.value } : row))} /></div>
                    <div><p className="text-sm font-medium text-stone-700">Hàng có dễ bể / dễ vỡ không? *</p><div className="mt-2 flex gap-5"><label className="flex items-center gap-2 text-sm"><input type="radio" name={`fragile-${item.id}`} checked={item.fragile === 'no'} onChange={() => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, fragile: 'no' } : row))} />Không</label><label className="flex items-center gap-2 text-sm"><input type="radio" name={`fragile-${item.id}`} checked={item.fragile === 'yes'} onChange={() => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, fragile: 'yes' } : row))} />Có</label></div>{bookingErrors[`customFragile-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customFragile-${item.id}`]}</p>}</div>
                    <Input label="Ghi chú bổ sung" value={item.customerNote} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, customerNote: e.target.value } : row))} />
                    <div><label className="text-sm font-medium text-stone-700">Hình ảnh hàng hóa</label><input type="file" accept="image/*" multiple className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" onChange={e => { const names = Array.from(e.target.files || []).map(file => file.name); setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, images: names } : row)) }} />{item.images.length > 0 && <p className="mt-1 text-xs text-stone-500">{item.images.join(', ')}</p>}</div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><b>ℹ Yêu cầu cần được nhân viên duyệt</b><p className="mt-1 leading-5">Yêu cầu sẽ được xem xét trong vòng 24 giờ. Kho đã chọn vẫn được tạm giữ và bạn chưa cần thanh toán tiền cọc. Sau khi được chấp thuận, hệ thống sẽ thông báo để bạn tiếp tục thanh toán.</p></div>
                  </div>}
                </div>)}
              </div>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setGoodsItems(items => [...items, createGoodsDeclarationItem()])}>+ Thêm hàng hóa</Button>

              <div className="my-6 border-t-2 border-dashed border-stone-300" />
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-sm font-bold text-stone-900">Mẫu thùng / hàng hóa dùng để kiểm tra sức chứa</p>
              <p className="mb-3 mt-1 text-xs leading-5 text-stone-600">Phần này dùng khai báo thêm các mẫu kiện khác để tính số khung. Số lượng và kích thước đã nhập trong “Thông tin hàng hóa khác” được tự động cộng vào sức chứa, nên không cần nhập lại tại đây.</p>
              <div className="space-y-3">
                {packageSamples.map((sample, index) => <div key={sample.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-[.8fr_1fr_1fr_1fr_auto] sm:items-start">
                    <div><Input type="number" min="1" step="1" label="Số lượng" value={sample.quantity} onChange={e => updatePackageSample(sample.id, 'quantity', e.target.value)} />{touchedPackageFields[`${sample.id}-quantity`] && (!parsePositiveNumber(sample.quantity) || !Number.isInteger(Number(sample.quantity))) && <p className="mt-1 text-xs text-red-700">Số lượng phải là số nguyên lớn hơn 0.</p>}</div>
                    <div><Input type="number" min="0.1" label="Dài (cm)" value={sample.lengthCm} onChange={e => updatePackageSample(sample.id, 'lengthCm', e.target.value)} />{touchedPackageFields[`${sample.id}-lengthCm`] && parsePositiveNumber(sample.lengthCm) === null && <p className="mt-1 text-xs text-red-700">Chiều dài phải lớn hơn 0.</p>}</div>
                    <div><Input type="number" min="0.1" label="Rộng (cm)" value={sample.widthCm} onChange={e => updatePackageSample(sample.id, 'widthCm', e.target.value)} />{touchedPackageFields[`${sample.id}-widthCm`] && parsePositiveNumber(sample.widthCm) === null && <p className="mt-1 text-xs text-red-700">Chiều rộng phải lớn hơn 0.</p>}</div>
                    <div><Input type="number" min="0.1" label="Cao (cm)" value={sample.heightCm} onChange={e => updatePackageSample(sample.id, 'heightCm', e.target.value)} />{touchedPackageFields[`${sample.id}-heightCm`] && parsePositiveNumber(sample.heightCm) === null && <p className="mt-1 text-xs text-red-700">Chiều cao phải lớn hơn 0.</p>}</div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPackageSamples(items => items.length === 1 ? [{ id: 'package-1', quantity: '', lengthCm: '', widthCm: '', heightCm: '' }] : items.filter(row => row.id !== sample.id))}>Xóa</Button>
                  </div>
                  {bookingErrors[`packageFit-${sample.id}`] && <p className="mt-2 text-xs text-red-700">{bookingErrors[`packageFit-${sample.id}`]}</p>}
                </div>)}
              </div>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setPackageSamples(items => [...items, { id: `package-${Date.now()}`, quantity: '', lengthCm: '', widthCm: '', heightCm: '' }])}>+ Thêm mẫu hàng</Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label={'Tổng cân nặng thực tế (kg)'} type="number" value={goodsWeight} onChange={e => setGoodsWeight(e.target.value)} />
                <Input label={'Mô tả hàng hóa và tình trạng đóng gói'} value={goodsCondition} onChange={e => setGoodsCondition(e.target.value)} />
              </div>

            </div>

            {/* Storage Space & Cost Breakdown */}
            {(() => {
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
                      <p className="font-bold text-sm text-stone-900">Kiểm tra sức chứa theo khung & dự toán chi phí</p>
                      <p className="text-[11px] text-stone-500">Mỗi khung rộng 0,8 m × dài 2,0 m × cao theo kho; hệ thống thử đủ 6 hướng xoay.</p>
                    </div>
                    {capacityStatus !== 'invalid' && <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${capacityStatus === 'fits' && !isOverload ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-red-700 bg-red-700 text-white'}`}>{capacityStatus === 'fits' ? 'Kho chứa vừa' : 'Kho không chứa vừa'}</span>}
                  </div>

                  {capacityStatus === 'invalid' ? <div className="rounded-lg border border-stone-300 bg-stone-100 p-4 text-center font-medium text-stone-600">Chưa đủ dữ liệu để kiểm tra sức chứa. Vui lòng nhập đầy đủ số lượng và kích thước hàng hóa hợp lệ.</div> : <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
                    {packageCapacityResults.map((sample, index) => <div key={sample.id} className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-2 last:border-0 last:pb-0"><span>{sample.sourceLabel ? `Hàng “Khác”: ${sample.sourceLabel}` : `Mẫu ${index + 1}`}: {sample.quantity || '—'} kiện · {sample.lengthCm || '—'} × {sample.widthCm || '—'} × {sample.heightCm || '—'} cm</span><b>Xếp {Math.min(Number(sample.quantity), sample.capacityPerFrame)} kiện/khung đầu · cần {sample.framesRequired} khung</b></div>)}
                    <div className="flex justify-between pt-1 text-sm"><b>Tổng khung cần dùng</b><b className={packagesFitSelectedUnit ? 'text-emerald-700' : 'text-red-700'}>{totalFramesRequired} / {selectedRackCount} khung</b></div>
                    {warehouseRecommendation && <p className="border-t border-stone-100 pt-2 text-emerald-700">Cỡ kho nhỏ nhất phù hợp: <b>{warehouseRecommendation[0]}</b></p>}
                  </div>}

                  {/* Floor Weight Check */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-600">{'Tải trọng hàng hóa thực tế:'}</span>
                    <span className={isOverload ? 'font-bold text-red-700' : 'font-semibold text-black'}>{goodsWeight || '—'} kg / Sức chịu tải sàn {selectedUnit.maxLoadKg} kg {isOverload ? '(Vượt tải trọng)' : ''}</span>
                  </div>

                  {capacityStatus !== 'invalid' && (hasOtherGoods ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><b>Chưa yêu cầu thanh toán tiền cọc</b><p className="mt-1">Booking có hàng hóa “Khác” sẽ được giữ kho và chuyển cho Staff duyệt. Dự toán và bước thanh toán chỉ mở sau khi toàn bộ hàng hóa cần xét duyệt được chấp thuận.</p></div> : <div className="space-y-2 border-t border-stone-200 pt-3"><p className="font-bold text-stone-900">Cách tính số tiền</p><div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2"><div className="flex justify-between gap-4"><span>Tiền thuê gốc</span><b>{formatVnd(grossTermValue)}</b></div><div className="flex justify-between gap-4 text-emerald-700"><span>Ưu đãi {Math.round(discountRate * 100)}%</span><b>− {formatVnd(promotionDiscount)}</b></div><div className="flex justify-between gap-4"><span>Tiền thuê sau giảm</span><b>{formatVnd(totalTermValue)}</b></div><div className="flex justify-between gap-4"><span>Cọc giữ chỗ 20% (được trừ vào tiền thuê)</span><b>{formatVnd(reservationDeposit)}</b></div><div className="flex justify-between gap-4 text-amber-800"><span>Tiền cọc đảm bảo kho (bằng 1 tháng tiền thuê)</span><b>{formatVnd(conditionSecurityDeposit)}</b></div><div className="flex justify-between gap-4"><span>Thu tại Check-in (tiền thuê còn lại + cọc đảm bảo)</span><b>{formatVnd(dueAtCheckIn)}</b></div><div className="flex justify-between gap-4 border-t border-stone-200 pt-2"><span>Tổng nghĩa vụ kỳ thuê và cọc đảm bảo</span><b>{formatVnd(initialObligation)}</b></div></div></div>)}

                  <div className="rounded-lg bg-stone-100 p-3 text-[11px] text-black"><b>Cam kết minh bạch của StorageHub:</b><ul className="mt-1 list-disc space-y-0.5 pl-5 text-stone-600"><li>Tạm giữ một suất theo cỡ kho trong 30 phút để hoàn tất thông tin.</li><li>{hasOtherGoods ? 'Hàng hóa “Khác” được Staff xét duyệt trước; chưa thu cọc trong thời gian chờ.' : 'Sau khi xác nhận, bạn có 12 giờ để thanh toán cọc 20%.'}</li><li>Sau khi cọc, cơ sở phân kho và bạn cần hoàn tất Check-in trong 14 ngày.</li></ul></div>
                </div>
              )
            })()}

            {validationViolation && (
              <div className="rounded-xl border-2 border-red-700 bg-red-700 p-4 text-xs text-white space-y-3 fade-in">
                <div className="flex items-center gap-2 text-white font-bold text-sm"><span></span><span>Cỡ kho này không phù hợp</span></div>
                <p className="text-white leading-relaxed font-medium">
                  {validationViolation.reason}
                </p>

                {validationViolation.suggestedUnitTypeId && (
                  <div className="rounded-lg border border-amber-700 bg-amber-700 p-3 space-y-2 text-white">
                    <p className="font-bold flex items-center gap-1.5">
                      <span></span>
                      <span>{'Hệ thống đề xuất nâng cấp loại gian kho phù hợp:'}</span>
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      {`Kiện hàng của bạn cần thể tích kho lớn hơn hoặc chiều dài rộng hơn. Hãy chuyển sang gian kho `}
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
                            showToast(`Đã chuyển sang cỡ kho ${upgradeType.name}!`)
                          } else {
                            showToast('Không tìm thấy cỡ kho nâng cấp phù hợp.')
                          }
                        }}
                      >
                         {`Chuyển ngay sang ${validationViolation.suggestedUnitTypeName}`}
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
              return (
                <div className="space-y-6 rounded-2xl border-2 border-black bg-white p-6 text-sm text-black sm:p-8">
                  <div className="flex items-start justify-between gap-6 border-b border-stone-200 pb-5">
                    <div><p className="text-xs font-bold uppercase tracking-[.12em] text-stone-500">{'Bước cuối'}</p><h3 className="mt-1 text-lg font-bold">{'Xác nhận thông tin đặt kho'}</h3></div>
                    <button className="text-xs font-bold underline" onClick={() => setBookingReview(false)}>{'Quay lại chỉnh sửa'}</button>
                  </div>

                  <div className={`rounded-lg border p-3 ${packagesFitSelectedUnit ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className={`font-bold ${packagesFitSelectedUnit ? 'text-emerald-900' : 'text-red-900'}`}>Kiểm tra sức chứa theo khung</p><p className="mt-0.5 text-[11px] text-stone-600">Cần {totalFramesRequired} / {selectedRackCount} khung · tính riêng từng mẫu và thử đủ 6 hướng xoay</p></div>
                      <span className={`rounded-full px-3 py-1 font-bold ${packagesFitSelectedUnit ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>{packagesFitSelectedUnit ? '✓ Kho chứa vừa' : '✕ Kho không chứa vừa'}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-stone-200 border-y border-stone-200">
                    <section className="space-y-1 py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Người thuê</p><p><b>Họ và tên:</b> {user.name}</p><p><b>CCCD/Hộ chiếu:</b> {customerIdCard}</p><p><b>Số điện thoại:</b> {customerPhone}</p><p><b>Email:</b> {customerEmail}</p><p><b>Địa chỉ:</b> {customerAddress}</p></section>
                    <section className="space-y-1 py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Kho đã chọn</p><p><b>Cỡ kho và cơ sở:</b> {selectedTarget?.unitType.name || selectedUnit.type} · {selectedUnit.facilityName}</p><p><b>Kích thước kho:</b> {selectedUnit.dimensions.lengthM} × {selectedUnit.dimensions.widthM} × {selectedUnit.dimensions.heightM} m</p><p><b>Khung chứa hàng:</b> {selectedRackCount} khung · 0,8 × 2,0 × {selectedUnit.dimensions.heightM} m/khung</p></section>
                    <section className="py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Hàng hóa</p><ul className="list-disc space-y-1 pl-5">{goodsItems.map((item, index) => <li key={item.id}><b>Dòng {index + 1}:</b> {GOODS_CATEGORY_OPTIONS.find(option => option[0] === item.category)?.[1]} · {item.category === 'OTHER' ? item.customMaterial : item.materialName}</li>)}</ul><ul className="mt-3 list-disc space-y-1 pl-5">{packageCapacityResults.map((sample, index) => <li key={sample.id}>{sample.sourceLabel ? `Hàng “Khác”: ${sample.sourceLabel}` : `Mẫu ${index + 1}`}: {sample.quantity} kiện · {sample.lengthCm} × {sample.widthCm} × {sample.heightCm} cm · cần {sample.framesRequired} khung</li>)}</ul><p className="mt-3"><b>Tổng số kiện tính sức chứa:</b> {packageCountNumber}</p><p><b>Tổng cân nặng:</b> {goodsWeight} kg</p><p><b>Tình trạng đóng gói:</b> {goodsCondition}</p></section>
                    <section className="space-y-1 py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Thời gian thuê</p><p><b>Lịch Check-in:</b> {moveInDate} · {bookingAppointmentTime}</p><p><b>Kỳ thuê:</b> {rentalMonths} tháng</p><p className="pt-1 font-semibold text-red-700">Nếu đổi lịch, ngày mới vẫn phải nằm trong 14 ngày sau khi thanh toán cọc.</p></section>
                  </div>
                  {hasOtherGoods ? <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center text-blue-950"><b>Gửi Staff duyệt hàng hóa · Chưa thu tiền cọc</b><p className="mt-1 text-xs">Kho sẽ được giữ cho bạn trong thời gian xét duyệt, dự kiến trong vòng 24 giờ.</p></div> : <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-100 p-4 text-center sm:grid-cols-5">
                    <div><p className="text-xs text-stone-500">Giảm giá ({Math.round(discountRate * 100)}%)</p><p className="mt-1 font-bold text-emerald-700">− {formatVnd(promotionDiscount)}</p><p className="text-[10px] text-stone-500">Gốc {formatVnd(grossTermValue)}</p></div>
                    <div><p className="text-xs text-stone-500">Tiền thuê sau giảm</p><p className="mt-1 font-bold">{formatVnd(totalValue)}</p></div>
                    <div><p className="text-xs text-stone-500">{'Cọc giữ chỗ 20%'}</p><p className="mt-1 font-bold">{formatVnd(deposit)}</p></div>
                    <div><p className="text-xs text-stone-500">Tiền cọc đảm bảo kho</p><p className="mt-1 font-bold text-amber-800">{formatVnd(securityDeposit)}</p><p className="text-[10px] text-stone-500">Bằng 1 tháng tiền thuê</p></div>
                    <div><p className="text-xs text-stone-500">{'Thu tại Check-in'}</p><p className="mt-1 font-bold">{formatVnd(dueAtCheckIn)}</p></div>
                  </div>}
                  <p className="mt-4 text-xs leading-5 text-stone-600">{hasOtherGoods ? 'Sau khi Staff chấp thuận, hệ thống mới mở bước thanh toán cọc 20%. Nếu bị từ chối, kho sẽ được giải phóng và lý do sẽ hiển thị trong thông báo.' : 'Cọc giữ chỗ được trừ vào tiền thuê và không hoàn nếu khách hủy trước Check-in. Tiền đảm bảo kho được thu riêng tại Check-in để bảo đảm nghĩa vụ về hư hại, vệ sinh và công nợ; khoản còn lại được hoàn sau biên bản nghiệm thu trả kho.'}</p>
                </div>
              )
            })()}

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              {bookingReview ? (
                <Button variant="outline" onClick={() => setBookingReview(false)}>{'Quay lại chỉnh sửa'}</Button>
              ) : (
                <Button variant="outline" onClick={() => { releaseTemporaryReservationSlot(); resetBookingForm(); setBookOpen(false); showToast('Đã hủy thao tác, xóa thông tin form và trả lại suất kho.'); }}>{'Hủy và trả lại suất kho'}</Button>
              )}
              <Button onClick={confirmReservation}>
                {bookingReview ? (hasOtherGoods ? 'Gửi yêu cầu Staff duyệt' : 'Xác nhận đặt kho') : ('Xác nhận thông tin')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 3: EMAIL VERIFICATION SIMULATION (P0.4) ─────── */}
      <Modal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title={'Xác Nhận Địa Chỉ Email Giữ Kho'}
      >
        {activeHoldForEmail && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-700 p-4 text-xs text-white">
              <p className="font-bold text-sm mb-1"> {'Địa chỉ nhận xác minh:'} {activeHoldForEmail.customerEmail}</p>
              <p>{'Để tránh tình trạng giữ kho ảo, hệ thống yêu cầu xác nhận email trước khi nhân viên tiếp nhận phê duyệt hồ sơ.'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 block">
                {'Mã token xác minh (Trích xuất từ đường link trong email):'}
              </label>
              <input
                value={inputToken}
                onChange={e => setInputToken(e.target.value)}
                className="w-full text-xs border border-stone-300 rounded-lg p-2.5 bg-stone-50"
              />
              <p className="text-[11px] text-stone-400">
                {'Token có hiệu lực trong 24 giờ. Hết hạn sẽ tự động giải phóng gian kho.'}
              </p>
              <p className="text-[11px] font-medium text-amber-800">{'Bản frontend demo: mã xác minh được điền sẵn vì chưa kết nối dịch vụ gửi email.'}</p>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputToken(resendHoldEmail(activeHoldForEmail.id, user))
                  showToast('Đã tạo lại mã demo trên phiên hiện tại; chưa gửi email thật.')
                }}
              >
                 {'Tạo lại mã demo'}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(false)}>
                  {'Để sau'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const success = verifyHoldEmail(activeHoldForEmail.id, inputToken, user)
                    if (success) {
                      setEmailModalOpen(false)
                      showToast('Email đã được xác nhận thành công! Hồ sơ đã gửi tới nhân viên ca trực.')
                    } else {
                      showToast('Mã token không hợp lệ hoặc đã hết hạn!')
                    }
                  }}
                >
                   {'Xác thực ngay'}
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
        title={'Thanh Toán Cọc Giữ Chỗ'}
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
                    <p className="font-bold text-sm text-stone-900">{`Thanh toán cho đơn giữ kho ${activeHoldForPayment.id}`}</p>
                    <p className="text-stone-500">{'Loại kho'}: <b>{activeHoldForPayment.unitTypeName}</b> · {'Cơ sở'}: <b>{activeHoldForPayment.facilityName}</b></p>
                  </div>
                  <Badge variant="info">{activeHoldForPayment.unitTypeName || 'Standard'}</Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between"><span className="text-stone-600">{'Giá thuê mỗi tháng:'}</span><span className="font-semibold text-black">{formatVnd(originalRent)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-600">{'Thời hạn thuê:'}</span><span className="font-semibold text-black">{activeHoldForPayment.rentalMonths} {'tháng'}</span></div>

                  <div className="flex justify-between text-base font-bold text-black pt-2 border-t border-stone-300">
                    <span>{'Tổng giá trị kỳ thuê:'}</span>
                    <span className="">{formatVnd(totalDue)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black"><span>{'Cọc cần thanh toán (20%):'}</span><span>{formatVnd(reservationDeposit)}</span></div>
                  <div className="flex justify-between"><span>{'Tiền đảm bảo kho:'}</span><span className="font-semibold text-emerald-700">{formatVnd(securityDeposit)}</span></div>
                  <div className="flex justify-between"><span>{'Còn thu tại Check-in:'}</span><span>{formatVnd(dueAtCheckIn)}</span></div>
                  <p className="border-t border-stone-200 pt-2 text-xs text-stone-600">{'Cọc giữ chỗ 20% được khấu trừ vào tiền thuê. Tiền đảm bảo kho được thu riêng tại Check-in, dùng để bảo đảm hư hại, vệ sinh và công nợ; phần không bị khấu trừ sẽ hoàn sau nghiệm thu trả kho.'}</p>
                </div>
              </div>

              <Select
                label={'Phương thức thanh toán'}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="Chuyển khoản VietQR">Chuyển khoản VietQR (Khuyên dùng)</option>
                <option value="Thẻ tín dụng Visa/MasterCard">Thẻ tín dụng Visa/MasterCard</option>
                <option value="Ví điện tử MoMo / ZaloPay">Ví điện tử MoMo / ZaloPay</option>
              </Select>

              <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
                <Button variant="outline" onClick={() => setPayModalOpen(false)}>{'Hủy'}</Button>
                <Button
                  onClick={() => {
                    payStorageHold(activeHoldForPayment.id, paymentMethod, user)
                    setPayModalOpen(false)
                    setActiveHoldForPayment(null)
                    showToast('Đã thanh toán cọc. Đơn đã chuyển sang bước xem điều khoản và chờ cơ sở phân kho.')
                  }}
                >
                   {'Xác nhận thanh toán'}
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
        title={'Hợp đồng thuê & biên nhận'}
        size="xl"
      >
        {activeHoldForContract && (
          <div className="space-y-4">
            {/* Notification alert */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">i</div>
              <div className="space-y-1 text-xs text-black">
                <p className="font-bold text-sm text-black">
                  {'Hồ sơ thanh toán và điều khoản của '}
                  <span className="underline">{activeHoldForContract.customerEmail}</span>
                </p>
                <p className="text-stone-700">
                  {'Đã ghi nhận cọc giữ chỗ. Hợp đồng giấy chỉ xuất hiện sau khi hai bên ký và nhân viên lưu bản scan; phần còn lại thu tại cơ sở.'}
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
                <span>{'Hợp Đồng Thuê'}</span>
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
                <span>{'Biên nhận & Thanh toán'}</span>
              </button>
            </div>

            {/* Tab 1: Official Digital Lease Agreement */}
            {contractTab === 'contract' && <div className="overflow-hidden rounded-xl border border-stone-200 bg-white text-xs shadow-sm">
              {(() => {
                const signed = contracts.find(c => c.reservationId === activeHoldForContract.id && c.status === 'SIGNED' && c.contractType !== 'RENEWAL')
                const deposit = activeHoldForContract.reservationDepositAmount ?? activeHoldForContract.payment.amount
                const securityDeposit = activeHoldForContract.securityDepositAmount ?? activeHoldForContract.quote.depositAmount
                const appointment = activeHoldForContract.appointmentDate ? `${activeHoldForContract.appointmentDate} ${activeHoldForContract.appointmentTime ?? ''}` : ('Chưa đặt lịch')
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
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">{'Hồ sơ hợp đồng'}</p>
                      <p className="mt-1 text-base font-bold text-stone-950">{activeHoldForContract.id} · {activeHoldForContract.unitTypeName ?? activeHoldForContract.unitId}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 font-bold ${signed ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'}`}>
                      {signed ? ('Đã ký hợp đồng') : ('Chờ ký tại cơ sở')}
                    </span>
                  </div>
                  <div className="space-y-5 p-5">
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'1. Chủ thể hợp đồng'}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-stone-200 p-3"><p className="font-bold text-stone-950">{'Bên cho thuê: StorageHub'}</p><p className="mt-1 leading-5 text-stone-600">{activeHoldForContract.facilityName}<br />{facilities.find(item => item.id === activeHoldForContract.facilityId)?.address || '—'}<br />{'Đại diện ký: Facility Manager / nhân viên được ủy quyền'}</p></div><div className="rounded-lg border border-stone-200 p-3"><p className="font-bold text-stone-950">{`Bên thuê: ${activeHoldForContract.customerName}`}</p><p className="mt-1 leading-5 text-stone-600">CCCD/Hộ chiếu: {activeHoldForContract.identityId}<br />{activeHoldForContract.customerPhone} · {activeHoldForContract.customerEmail}<br />{activeHoldForContract.customerAddress || ('Địa chỉ: cập nhật khi ký')}<br />{`Mã khách hàng: ${activeHoldForContract.customerId}`}</p></div></div></section>
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'2. Đối tượng thuê & lịch bàn giao'}</p><div className="grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-2">{[
                      ['Số hợp đồng / mã đơn', `${signed?.contractNumber ?? ('Cấp sau khi ký')} · ${activeHoldForContract.id}`],
                      ['Gian kho / cỡ kho', activeHoldForContract.assignedUnitId ?? activeHoldForContract.unitTypeName ?? '—'],
                      ['Kích thước kiện lớn nhất', `${activeHoldForContract.goods.lengthCm} × ${activeHoldForContract.goods.widthCm} × ${activeHoldForContract.goods.heightCm} cm`],
                      ['Hàng hóa khai báo', `${activeHoldForContract.goods.category} · ${activeHoldForContract.goods.packageCount} kiện · ${activeHoldForContract.goods.weightKg} kg`],
                      ['Thời hạn thuê hiện hành', `${activeHoldForContract.startDate} → ${effectiveEndDate} · ${totalRentalMonths} ${'tháng'}`],
                      ['Lịch Check-in / bàn giao', appointment]
                    ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 font-bold leading-5 text-stone-900">{value}</p></div>)}</div></section>
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'3. Điều khoản chính'}</p><div className="grid gap-2 sm:grid-cols-2">{[
                      `Đơn giá hiện hành: ${formatVnd(activeHoldForContract.quote.baseMonthlyPrice)}/tháng; tổng giá trị tiền thuê sau gia hạn là ${formatVnd(currentTermValue)}.`,
                      `Tổng cọc giữ chỗ 20% đã ghi nhận (${formatVnd(totalBookingDeposit)}) được trừ vào tiền thuê; tiền đảm bảo kho ${formatVnd(securityDeposit)} là khoản riêng, dùng để bảo đảm hư hại, vệ sinh và công nợ, phần còn lại được hoàn sau nghiệm thu.`,
                      'Khách hoàn tất Check-in trong 14 ngày sau khi thanh toán cọc; đổi lịch cũng phải nằm trong thời hạn này.',
                      'Khách chỉ lưu hàng đã khai báo, tuân thủ tải trọng, kích thước cửa kho, PCCC và danh mục hàng cấm.',
                      'Gia hạn theo gói tháng, chỉ thanh toán sau khi Facility Manager kiểm tra lịch và phê duyệt.',
                      'Khi trả kho, Staff lập biên bản trước–sau; khấu trừ phải có nội dung, số tiền và minh chứng.',
                      'Khách được xem, đồng ý hoặc yêu cầu xem xét lại quyết toán trước khi đóng hồ sơ.'
                    ].map((term, index) => <div key={term} className="flex gap-2 rounded-lg bg-stone-50 p-3 leading-5"><span className="font-bold text-amber-700">{index + 1}.</span><span>{term}</span></div>)}</div></section>
                    {completedRenewals.length > 0 && <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'4. Hợp đồng gia hạn đã phát hành'}</p><div className="space-y-2">{completedRenewals.map(renewal => {
                      const renewalContract = contracts.find(contract => contract.id === renewal.renewalContractId || contract.renewalId === renewal.id)
                      return <article key={renewal.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-emerald-950">{renewal.renewalContractNumber || renewalContract?.contractNumber || renewal.addendumNumber || renewal.id}</p><p className="mt-1 text-emerald-800">{renewal.oldEndDate} → {renewal.newEndDate} · {renewal.renewalMonths} {'tháng'}</p></div><p className="font-bold text-emerald-900">{formatVnd(renewal.totalAmount ?? renewal.renewalFee)}</p></div><div className="mt-3 grid gap-2 text-stone-700 sm:grid-cols-2"><p>{'Hóa đơn'}: <b>{renewal.invoiceNumber}</b></p><p>{'Thanh toán hoàn tất'}: <b>{renewal.signedAt ? new Date(renewal.signedAt).toLocaleDateString('vi-VN') : '—'}</b></p></div>{renewalContract && <div className="mt-3 flex gap-2 border-t border-emerald-200 pt-3"><a href={renewalContract.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-900 underline">{'Xem hợp đồng đã ký'}</a><a href={renewalContract.scannedFileUrl} download={renewalContract.scannedFileName} className="font-bold text-emerald-900 underline">{'Tải xuống'}</a></div>}</article>
                    })}</div></section>}
                  </div>
                  <div className="grid gap-3 border-t border-stone-200 p-5 sm:grid-cols-4">
                    <div className="rounded-lg bg-stone-50 p-3"><p className="text-stone-500">{'Tổng giá trị thuê hiện hành'}</p><p className="mt-1 text-base font-bold text-stone-950">{formatVnd(currentTermValue)}</p><p className="mt-1 text-[10px] text-stone-500">{totalRentalMonths} {'tháng, gồm các kỳ gia hạn đã hoàn tất'}</p></div>
                    <div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">{'Tổng cọc giữ chỗ 20%'}</p><p className="mt-1 text-base font-bold text-blue-800">{formatVnd(totalBookingDeposit)}</p>{depositDueNow > 0 && <p className="mt-1 text-[10px] font-semibold text-blue-700">{`Cần thanh toán ngay: ${formatVnd(depositDueNow)}`}</p>}</div>
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">{'Tiền đảm bảo kho'}</p><p className="mt-1 text-base font-bold text-emerald-800">{formatVnd(securityDeposit)}</p></div>
                    <div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-800">{'Còn thanh toán tại cơ sở'}</p><p className="mt-1 text-base font-bold text-amber-900">{formatVnd(balance)}</p><p className="mt-1 text-[10px] text-amber-700">{balance > 0 ? ('Theo lịch gia hạn đang chờ hoàn tất') : ('Không còn khoản gia hạn phải thanh toán')}</p></div>
                  </div>
                  <section className="border-t border-stone-200 bg-stone-50 p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div><p className="font-bold text-stone-950">Hợp đồng thuê PDF</p><p className="mt-1 text-stone-500">Mẫu hợp đồng được hiển thị thống nhất cho hồ sơ PDF tải lên.</p></div>
                      <div className="flex gap-2"><a href="/documents/Hop-dong-thue.pdf" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-bold text-stone-800">Xem PDF</a><a href="/documents/Hop-dong-thue.pdf" download="Hop-dong-thue.pdf" className="rounded-lg bg-stone-900 px-3 py-2 font-bold text-white">Tải xuống</a></div>
                    </div>
                    <a href="/documents/Hop-dong-thue.pdf" target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                      <img src="/documents/Hop-dong-thue-preview.png" alt="Xem trước Hợp đồng cho thuê nhà xưởng và kho bãi" className="mx-auto block w-full max-w-2xl object-contain" />
                    </a>
                    {completedRenewals.length > 0 && <div className="mt-5 space-y-4 border-t border-stone-200 pt-5">
                      <p className="font-bold text-stone-950">PDF hợp đồng gia hạn</p>
                      {completedRenewals.map(renewal => {
                        const renewalContract = contracts.find(contract => contract.id === renewal.renewalContractId || contract.renewalId === renewal.id)
                        return <article key={`renewal-pdf-${renewal.id}`} className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3"><div><p className="font-bold text-emerald-950">{renewal.renewalContractNumber || renewalContract?.contractNumber || renewal.addendumNumber || renewal.id}</p><p className="mt-1 text-emerald-800">{renewal.oldEndDate} → {renewal.newEndDate} · {renewal.renewalMonths} tháng</p></div><div className="flex gap-2"><a href={renewalContract?.scannedFileUrl || '/documents/Hop-dong-thue.pdf'} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-bold text-emerald-900">Xem PDF gia hạn</a><a href={renewalContract?.scannedFileUrl || '/documents/Hop-dong-thue.pdf'} download={renewalContract?.scannedFileName || 'Hop-dong-thue-gia-han.pdf'} className="rounded-lg bg-emerald-800 px-3 py-2 font-bold text-white">Tải xuống</a></div></div>
                          <img src="/documents/Hop-dong-thue-preview.png" alt={`Xem trước hợp đồng gia hạn ${renewal.id}`} className="mx-auto block w-full max-w-2xl object-contain" />
                        </article>
                      })}
                    </div>}
                  </section>
                  {signed ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-4">
                    <div><p className="font-bold text-stone-900">{signed.scannedFileName}</p><p className="mt-0.5 text-stone-500">{`Đã ký ${signed.signedAt} · Hiệu lực hiện hành ${signed.startDate} – ${effectiveEndDate}`}</p></div>
                    <div className="flex gap-2"><a href={signed.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-stone-300 px-3 py-2 font-bold text-stone-800 hover:bg-stone-50">{'Xem bản ký'}</a><a href={signed.scannedFileUrl} download={signed.scannedFileName} className="rounded-lg bg-stone-900 px-3 py-2 font-bold text-white hover:bg-black">{'Tải xuống'}</a></div>
                  </div> : <p className="border-t border-stone-200 px-5 py-4 text-stone-600">{'Bản PDF đã ký sẽ hiển thị tại đây sau khi hai bên hoàn tất ký hợp đồng tại cơ sở.'}</p>}
                </>
              })()}
            </div>}
            {contractTab === 'receipt' && (() => {
              const receiptPayments = payments
                .filter(payment => payment.reservationId === activeHoldForContract.id)
                .sort((a, b) => {
                  const rank = (payment: (typeof payments)[number]) => payment.type === 'RESERVATION_DEPOSIT' ? 0 : payment.type === 'INITIAL_RENT' ? 1 : payment.type === 'RENEWAL' && !payment.id.startsWith('PAY-RNW-BAL-') ? 2 : payment.type === 'RENEWAL' ? 3 : 4
                  return rank(a) - rank(b)
                })
              const relatedRental = rentals.find(rental => rental.holdId === activeHoldForContract.id || (rental.customerId === activeHoldForContract.customerId && rental.unitId === (activeHoldForContract.assignedUnitId || activeHoldForContract.unitId)))
              const completedRenewals = renewals.filter(renewal => renewal.rentalId === relatedRental?.id && renewal.status === 'completed')
              const rentalValue = activeHoldForContract.quote.baseMonthlyPrice * activeHoldForContract.rentalMonths + completedRenewals.reduce((sum, renewal) => sum + (renewal.totalAmount ?? renewal.renewalFee), 0)
              const securityDeposit = activeHoldForContract.securityDepositAmount ?? activeHoldForContract.quote.depositAmount
              const totalValue = rentalValue + securityDeposit
              const totalPaid = receiptPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + payment.amount, 0)
              const balance = Math.max(0, totalValue - totalPaid)
              const renewalReceiptAudit = completedRenewals.map(renewal => {
                const renewalPayments = receiptPayments.filter(payment => payment.renewalId === renewal.id && payment.status === 'PAID')
                return { renewal, hasDeposit: renewalPayments.some(payment => !payment.id.startsWith('PAY-RNW-BAL-')), hasCounterBalance: renewalPayments.some(payment => payment.id.startsWith('PAY-RNW-BAL-')) }
              })
              return <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">{'Hồ sơ biên nhận thanh toán'}</p><p className="mt-1 text-lg font-bold text-stone-950">{activeHoldForContract.id}</p><p className="mt-1 text-stone-600">{activeHoldForContract.customerName} · {activeHoldForContract.customerEmail}</p></div><div className="text-right"><p className="text-stone-500">{'Đơn vị nhận tiền'}</p><p className="font-bold">StorageHub · {activeHoldForContract.facilityName}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Tiền thuê theo kỳ'}</p><p className="mt-1 text-lg font-bold">{formatVnd(rentalValue)}</p></div><div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">{'Tiền đảm bảo kho'}</p><p className="mt-1 text-lg font-bold text-emerald-800">{formatVnd(securityDeposit)}</p></div><div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">{'Đã thu'}</p><p className="mt-1 text-lg font-bold text-blue-800">{formatVnd(totalPaid)}</p></div><div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-800">{'Còn phải thu'}</p><p className="mt-1 text-lg font-bold text-amber-900">{formatVnd(balance)}</p></div></div></div>
                {renewalReceiptAudit.map(({ renewal, hasDeposit, hasCounterBalance }) => <div key={`receipt-audit-${renewal.id}`} className={`rounded-xl border p-4 ${hasDeposit && hasCounterBalance ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900'}`}><p className="font-bold">Đối soát biên lai gia hạn · {renewal.renewalContractNumber || renewal.id}</p><p className="mt-1">{hasDeposit ? '✓ Có biên lai cọc gia hạn' : '✕ Thiếu biên lai cọc gia hạn'} · {hasCounterBalance ? '✓ Có biên lai đóng đủ tiền tại quầy' : '✕ Thiếu biên lai đóng đủ tiền tại quầy'}</p></div>)}
                {receiptPayments.map(payment => <article key={payment.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{payment.type === 'RESERVATION_DEPOSIT' ? 'Biên lai cọc' : payment.type === 'INITIAL_RENT' ? 'Biên lai Check-in' : payment.type === 'RENEWAL' && payment.id.startsWith('PAY-RNW-BAL-') ? 'Biên lai đóng đủ tiền gia hạn tại quầy' : payment.type === 'RENEWAL' ? 'Biên lai cọc gia hạn' : 'Biên nhận điện tử'}</p><p className="mt-1 text-sm font-bold">{payment.transactionReference || payment.id}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800">{payment.status === 'PAID' ? ('Đã thanh toán') : ('Đang xử lý')}</span></div><div className="grid gap-px bg-stone-200 sm:grid-cols-2">{[
                  ['Số biên nhận', payment.id],
                  ['Ngày giờ thanh toán', payment.paidAt ? new Date(payment.paidAt).toLocaleString('vi-VN') : '—'],
                  ['Người nộp tiền', `${activeHoldForContract.customerName} · ${activeHoldForContract.customerEmail}`],
                  ['Đơn vị nhận tiền', `StorageHub · ${activeHoldForContract.facilityName}`],
                  ['Nội dung thanh toán', payment.type === 'RENEWAL' && payment.id.startsWith('PAY-RNW-BAL-') ? (`Thanh toán phần còn lại của kỳ gia hạn: ${formatVnd(payment.amount)}`) : payment.description || (payment.type === 'RESERVATION_DEPOSIT' ? ('Cọc giữ chỗ 20% giá trị kỳ thuê') : payment.type === 'INITIAL_RENT' ? ('Thanh toán phần còn lại tại Check-in') : payment.type === 'RENEWAL' ? ('Thanh toán gia hạn hợp đồng') : payment.type)],
                  ['Số hóa đơn', payment.invoiceNumber || '—'],
                  ['Mã đơn / hợp đồng', `${activeHoldForContract.id} · ${contracts.find(item => item.reservationId === activeHoldForContract.id)?.contractNumber || '—'}`],
                  ['Phương thức', payment.paymentMethod || activeHoldForContract.payment.method || '—'],
                  ['Mã giao dịch đối soát', payment.transactionReference || activeHoldForContract.payment.transactionId || payment.id],
                  ['Số tiền / tiền tệ', `${formatVnd(payment.amount)} · VND`],
                  ['Người ghi nhận', payment.receivedBy || payment.recordedBy || 'StorageHub System']
                ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 font-bold leading-5 text-stone-900">{value}</p></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-4"><p className="text-stone-600">{'Biên nhận được lưu trong hồ sơ khách hàng và dùng để đối chiếu thanh toán.'}</p><p className="text-lg font-extrabold text-emerald-700">{formatVnd(payment.amount)}</p></div></article>)}
                {!receiptPayments.length && <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">{'Chưa có giao dịch để phát hành biên nhận.'}</div>}
              </div>
            })()}
          </div>
        )}
      </Modal>

      {/* ── MODAL 5: SCHEDULE CHECK-IN ────────────────────────── */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={'Đặt Lịch Hẹn Bàn Giao & Check-in'}
      >
        {activeHoldForSchedule && (
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              {'Chọn ngày giờ bạn sẽ đến cơ sở để cùng nhân viên đối chiếu CCCD, cân đo hàng hóa thực tế và nhận mã PIN mở cửa:'}
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><b>{'Hạn đổi lịch:'}</b> {activeHoldForSchedule.checkInDeadline ? dateInputValue(new Date(activeHoldForSchedule.checkInDeadline)) : ('14 ngày sau khi thanh toán cọc')}. {'Ngày dự kiến trên đơn sẽ được cập nhật theo lịch mới.'}</div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={'Ngày hẹn'}
                type="date"
                value={appointmentDate}
                min={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })}
                max={activeHoldForSchedule.checkInDeadline ? dateInputValue(new Date(activeHoldForSchedule.checkInDeadline)) : undefined}
                onChange={e => setAppointmentDate(e.target.value)}
              />
              <div><Input label={'Giờ Check-in (24/7)'} type="time" min="00:00" max="23:59" step="1800" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} /><p className="mt-1 text-[11px] text-blue-700">{'Tạm mở toàn bộ khung giờ để kiểm thử nghiệp vụ Check-in.'}</p></div>
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>{'Hủy'}</Button>
              <Button
                disabled={!appointmentDate || !appointmentTime}
                onClick={() => {
                  try {
                    scheduleCheckIn(activeHoldForSchedule.id, appointmentDate, appointmentTime, user)
                    setScheduleModalOpen(false)
                    showToast(`Đã lên lịch check-in vào ${appointmentTime} ngày ${appointmentDate}!`)
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể đặt lịch hẹn.')
                  }
                }}
              >
                 {'Xác nhận lịch hẹn'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 6: REQUEST RETURN ───────────────────────────── */}
      <Modal
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title={'Yêu Cầu Thanh Lý & Trả Kho'}
      >
        {activeRentalForReturn && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-700 p-3 text-xs text-white">
              <p className="font-semibold">{`Gian kho ${activeRentalForReturn.unitId} (${activeRentalForReturn.facilityName})`}</p>
              <p>{'Tiền đảm bảo kho sẽ được hoàn đầy đủ sau khi nghiệm thu xác nhận không có hư hại, phí vệ sinh hoặc công nợ.'}</p>
            </div>

            <Input
              label={'Ngày dự kiến dọn đồ & bàn giao'}
              type="date"
              value={returnTargetDate}
              min={dateInputValue(new Date())}
              max={parseCustomerDate(activeRentalForReturn.endDate) ? dateInputValue(parseCustomerDate(activeRentalForReturn.endDate)!) : undefined}
              onChange={e => setReturnTargetDate(e.target.value)}
            />
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">{`Ngày trả kho phải nằm trong thời hạn hợp đồng, từ hôm nay đến ${activeRentalForReturn.endDate}.`}</p>

            <Select
              label={'Lý do kết thúc'}
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
            >
              <option value="Hết nhu cầu lưu trữ">Hết nhu cầu lưu trữ</option>
              <option value="Chuyển sang nhà/văn phòng mới">Chuyển sang nhà/văn phòng mới</option>
              <option value="Đổi sang gian kho kích thước khác">Đổi sang gian kho kích thước khác</option>
              <option value="Khác">Lý do khác</option>
            </Select>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button variant="outline" onClick={() => setReturnModalOpen(false)}>{'Hủy'}</Button>
              <Button
                variant="danger"
                disabled={!returnTargetDate || Boolean(parseCustomerDate(activeRentalForReturn.endDate) && new Date(`${returnTargetDate}T00:00:00`).getTime() > parseCustomerDate(activeRentalForReturn.endDate)!.getTime())}
                onClick={() => {
                  const confirmed = window.confirm(`Xác nhận gửi yêu cầu trả gian kho ${activeRentalForReturn.unitId} vào ngày ${returnTargetDate}? Sau khi gửi, hợp đồng sẽ chuyển sang quy trình nghiệm thu.`)
                  if (!confirmed) return
                  try {
                    requestReturn(activeRentalForReturn.id, returnTargetDate, user, returnReason)
                    setReturnModalOpen(false)
                    showToast('Yêu cầu trả kho đã được tiếp nhận. Nhân viên sẽ chuẩn bị biên bản nghiệm thu!')
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu trả kho.')
                  }
                }}
              >
                 {'Gửi yêu cầu trả kho'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: REQUEST RENEWAL ────────────────────────────── */}
      <Modal
        open={renewalModalOpen}
        onClose={() => { setRenewalModalOpen(false); setEditingRenewalId(null) }}
        title={editingRenewalId ? ('Chỉnh Sửa Yêu Cầu Gia Hạn') : ('Yêu Cầu Gia Hạn Hợp Đồng Thuê')}
      >
        {activeRentalForRenewal && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-700 bg-blue-700 p-3 text-xs text-white space-y-1">
              <p className="font-semibold">{`Gian kho ${activeRentalForRenewal.unitId} (${activeRentalForRenewal.facilityName})`}</p>
              <p>{`Hạn hợp đồng hiện tại: ${activeRentalForRenewal.endDate}. Giá thuê: ${formatVnd(activeRentalForRenewal.monthlyRate)}/tháng.`}</p>
              <p className="text-[11px] text-white">
                {'Facility Manager sẽ kiểm tra xung đột lịch đặt trước khi phê duyệt gia hạn cho bạn.'}
              </p>
            </div>

            <Select label={'Chọn gói gia hạn'} value={renewalMonths.toString()} onChange={e => setRenewalMonths(Number(e.target.value))}>
              <option value="1">1 {'tháng'}</option>
              <option value="3">3 {'tháng'}</option>
              <option value="6">6 {'tháng'}</option>
              <option value="12">12 {'tháng'}</option>
            </Select>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs"><div><p className="text-stone-500">{'Ngày hết hạn mới dự kiến'}</p><p className="mt-1 font-bold">{addMonthsForPreview(activeRentalForRenewal.endDate, renewalMonths)}</p></div><div><p className="text-stone-500">{'Phí gia hạn'}</p><p className="mt-1 font-bold">{formatVnd(activeRentalForRenewal.monthlyRate * renewalMonths)}</p></div></div>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button variant="outline" onClick={() => setRenewalModalOpen(false)}>{'Hủy'}</Button>
              <Button
                onClick={() => {
                  try {
                    if (editingRenewalId) updateRenewalRequest(editingRenewalId, renewalMonths, user)
                    else requestRenewal(activeRentalForRenewal.id, renewalMonths, user)
                    setRenewalModalOpen(false)
                    setEditingRenewalId(null)
                    showToast(editingRenewalId ? ('Đã cập nhật yêu cầu và thông báo lại cho Manager.') : ('Đã gửi yêu cầu gia hạn tới Facility Manager!'))
                  } catch (err: any) {
                    showToast(err?.message || 'Error requesting renewal')
                  }
                }}
              >
                 {editingRenewalId ? ('Lưu thay đổi') : ('Gửi yêu cầu gia hạn')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={renewalPaymentOpen}
        onClose={() => setRenewalPaymentOpen(false)}
        title={'Xác Nhận Thanh Toán Gia Hạn'}
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
                <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'Hóa đơn gia hạn đã được duyệt'}</p><p className="mt-1 text-lg font-bold text-stone-950">{activeRenewalForPayment.invoiceNumber}</p><p className="mt-1 text-stone-600">{activeRenewalForPayment.unitId} · {activeRenewalForPayment.renewalMonths} {'tháng'}</p></div>
                <div className="text-right"><p className="text-xs text-stone-500">{'Cọc gia hạn 20%'}</p><p className="text-2xl font-extrabold text-stone-950">{formatVnd(renewalDeposit)}</p></div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Thời hạn cuối thuê kho'}</p><p className="mt-1 font-bold">{activeRenewalForPayment.oldEndDate}</p></div>
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Kỳ gia hạn liên tục'}</p><p className="mt-1 font-bold">{dateInputValue(renewalEffectiveAt)} → {activeRenewalForPayment.newEndDate}</p></div>
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Đơn giá giữ nguyên'}</p><p className="mt-1 font-bold">{formatVnd(activeRenewalForPayment.originalMonthlyRate ?? rental?.monthlyRate ?? 0)}/{'tháng'}</p></div>
                <div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Hạn thanh toán cọc 72 giờ'}</p><p className={`mt-1 font-bold ${paymentExpired ? 'text-red-700' : 'text-amber-800'}`}>{activeRenewalForPayment.paymentDueAt ? new Date(activeRenewalForPayment.paymentDueAt).toLocaleString('vi-VN') : '—'}</p></div>
              </div>
              {!paymentExpired && activeRenewalForPayment.paymentDueAt && <div className="mt-3 rounded-lg bg-red-700 px-4 py-3 text-center text-white"><p className="text-[10px] font-bold uppercase tracking-widest">{'Thời gian thanh toán cọc còn lại'}</p><p className="mt-1 text-2xl font-extrabold">{formatCountdown(activeRenewalForPayment.paymentDueAt).text}</p></div>}
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 leading-5 text-blue-950">{`Khoản ${formatVnd(renewalDeposit)} chỉ giữ kỳ gia hạn. Thời hạn thuê chưa được kéo dài cho đến khi bạn đến cơ sở ký hợp đồng gia hạn mới và đóng ${formatVnd(remainingAtFacility)} còn lại.`}</div>
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 leading-5 text-red-900">
              <p className="font-bold">{'Chính sách phụ thu quá hạn'}</p>
              <p className="mt-1">{`Thời hạn thuê hiện tại kết thúc ngày ${activeRenewalForPayment.oldEndDate}. Nếu hợp đồng gia hạn được ký sau ngày này, phụ thu được tính từ ngày kế tiếp sau khi hết hạn đến ngày ký thực tế.`}</p>
              <p className="mt-2 font-semibold">{`Mức phụ thu: ${formatVnd(lateFeePerDay)} cho mỗi ngày quá hạn (tương đương 50% đơn giá thuê ngày: ${formatVnd(renewalMonthlyRate)} ÷ 30 ngày = ${formatVnd(dailyRentalRate)}/ngày).`}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={'Ngày đến cơ sở ký hợp đồng gia hạn'} type="date" min={dateInputValue(new Date(now))} max={dateInputValue(latestAppointment)} value={renewalAppointmentDate} onChange={event => setRenewalAppointmentDate(event.target.value)} />
              <Input label={'Giờ hẹn'} type="time" min="08:00" max="17:00" value={renewalAppointmentTime} onChange={event => setRenewalAppointmentTime(event.target.value)} />
            </div>
            <p className={`rounded-lg p-3 leading-5 ${isOverdue || projectedOverdueDays > 0 ? 'border border-red-300 bg-red-50 font-semibold text-red-800' : 'bg-stone-100 text-stone-700'}`}>{`Bạn được chọn lịch trong 7 ngày, chậm nhất ${dateInputValue(latestAppointment)}. Hợp đồng cũ hết hạn ${activeRenewalForPayment.oldEndDate}; thanh toán hoặc ký sau ngày này sẽ tính phí muộn. Kỳ mới vẫn có hiệu lực liên tục từ ${dateInputValue(renewalEffectiveAt)}, không có ngày trống.`}</p>
            <Select label={'Phương thức thanh toán'} value={renewalPaymentMethod} onChange={event => setRenewalPaymentMethod(event.target.value as 'BANK_TRANSFER' | 'ONLINE_GATEWAY')}>
              <option value="BANK_TRANSFER">{'Chuyển khoản ngân hàng / VietQR'}</option>
              <option value="ONLINE_GATEWAY">{'Cổng thanh toán trực tuyến'}</option>
            </Select>
            <div className="overflow-hidden rounded-xl border border-stone-300 bg-white">
              <p className="border-b border-stone-200 bg-stone-100 px-4 py-2 font-bold text-stone-900">{'Chi tiết số tiền trước khi xác nhận'}</p>
              <div className="space-y-2 p-4 text-stone-700"><div className="flex justify-between"><span>{'Tổng giá trị kỳ gia hạn'}</span><b>{formatVnd(renewalTotal)}</b></div><div className="flex justify-between text-blue-700"><span>{'Thanh toán cọc ngay (20%)'}</span><b>{formatVnd(renewalDeposit)}</b></div><div className="flex justify-between"><span>{'Phần còn lại tại cơ sở (80%)'}</span><b>{formatVnd(remainingAtFacility)}</b></div><div className={`flex justify-between ${projectedLateFee > 0 ? 'font-semibold text-red-700' : ''}`}><span>{`Phí muộn dự kiến (${projectedOverdueDays} ngày × ${formatVnd(lateFeePerDay)})`}</span><b>{formatVnd(projectedLateFee)}</b></div><div className="flex justify-between border-t border-stone-200 pt-2 text-base font-extrabold text-stone-950"><span>{'Dự kiến đóng tại cơ sở'}</span><span>{formatVnd(projectedOnSiteTotal)}</span></div></div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-3 leading-5"><input type="checkbox" className="mt-1" checked={renewalTermsAccepted} onChange={event => setRenewalTermsAccepted(event.target.checked)} /><span>{'Tôi đồng ý cọc 20% để giữ kỳ gia hạn, đến cơ sở đúng lịch để ký và đóng 80% còn lại; tôi đã biết phí sẽ tăng theo từng ngày nếu lịch hẹn sau ngày hết hạn.'}</span></label>
            {paymentExpired && <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">{'Đã quá thời hạn thanh toán 72 giờ. Vui lòng gửi yêu cầu gia hạn mới.'}</p>}
            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3"><Button variant="outline" onClick={() => setRenewalPaymentOpen(false)}>{'Đóng'}</Button><Button disabled={paymentExpired || !renewalAppointmentDate || !renewalAppointmentTime || !renewalTermsAccepted} onClick={() => {
              try {
                const reference = `${renewalPaymentMethod === 'ONLINE_GATEWAY' ? 'GW' : 'BANK'}-${Date.now()}`
                payRenewal(activeRenewalForPayment.id, user, renewalPaymentMethod, reference, renewalTermsAccepted, renewalAppointmentDate, renewalAppointmentTime)
                setRenewalPaymentOpen(false)
                setRenewalTermsAccepted(false)
                showToast('Đã cọc 20% và đặt lịch ký. Hợp đồng chỉ được gia hạn sau khi Staff xác nhận ký và thu phần còn lại.')
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Không thể xác minh thanh toán gia hạn.')
              }
            }}>{'Thanh toán cọc & đặt lịch'}</Button></div>
          </div>
        })()}
      </Modal>

      {/* ── MODAL 7: SUPPORT TICKET CONVERSATION ───────────────── */}
      <Modal
        open={conversationOpen}
        onClose={() => setConversationOpen(false)}
        title={'Trao Đổi Trực Tuyến Hỗ Trợ'}
      >
        {selectedTicket && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#292a27] p-4 text-white">
              <div className="flex justify-between items-center text-xs text-[#e9a12c]">
                <span>{selectedTicket.id}</span>
                <span>{selectedTicket.category}</span>
              </div>
              <h3 className="font-bold text-base mt-1 text-stone-100">{selectedTicket.subject}</h3>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {(tickets.find(ticket => ticket.id === selectedTicket.id)?.messages || selectedTicket.messages).map(msg => {
                const isMine = msg.role === 'customer' || msg.sender === user.name || msg.sender === selectedTicket.customer
                return <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs shadow-sm ${isMine ? 'rounded-br-sm bg-amber-500 text-stone-950' : 'rounded-bl-sm border border-blue-200 bg-blue-50 text-blue-950'}`}><div className={`mb-1 flex items-center gap-3 text-[10px] ${isMine ? 'justify-end text-amber-950/70' : 'justify-between text-blue-700'}`}><b>{isMine ? ('Bạn') : msg.sender}</b><span>{msg.time}</span></div><p className="whitespace-pre-wrap leading-5">{msg.text}</p></div></div>
              })}
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-2">
              <textarea
                rows={2}
                placeholder={'Nhập tin nhắn của bạn...'}
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
                      showToast(selectedTicket.status === 'resolved' ? ('Đã gửi tin nhắn và mở lại yêu cầu.') : ('Đã gửi tin nhắn!'))
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Không thể gửi tin nhắn.')
                    }
                  }}
                >
                  {'Gửi tin nhắn'}
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
        title={'Tạo Yêu Cầu Hỗ Trợ Mới'}
      >
        <div className="space-y-4">
          <Select label={'Hồ sơ cần hỗ trợ'} value={ticketRelatedRecord} onChange={e => setTicketRelatedRecord(e.target.value)}>
            <option value="general">{'Tư vấn chung · Không gắn với kho cụ thể'}</option>
            {myRentals.map(rental => <option key={rental.id} value={`rental:${rental.id}`}>{'Hợp đồng'} {rental.id} · {rental.facilityName} · {rental.unitId}</option>)}
            {myHolds.filter(hold => !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status)).map(hold => <option key={hold.id} value={`reservation:${hold.id}`}>{'Đơn giữ kho'} {hold.id} · {hold.facilityName} · {hold.assignedUnitId || hold.unitTypeName}</option>)}
          </Select>
          <Input
            label={'Tiêu đề yêu cầu'}
            value={ticketSubject}
            onChange={e => setTicketSubject(e.target.value)}
            placeholder={'Tóm tắt sự cố (ví dụ: Khóa cổng không nhận mã PIN)'}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label={'Phân loại'} value={ticketCategory} onChange={e => setTicketCategory(e.target.value)}>
              <option value="Access & Entry">{'Ra vào & mã PIN'}</option>
              <option value="Billing & Invoices">{'Thanh toán & hóa đơn'}</option>
              <option value="Unit Condition">{'Hiện trạng gian kho'}</option>
              <option value="General Inquiry">{'Tư vấn chung'}</option>
            </Select>
            <Select label={'Mức độ ảnh hưởng'} value={ticketPriority} onChange={e => setTicketPriority(e.target.value as any)}>
              <option value="low">{'Thấp · Chỉ cần tư vấn'}</option>
              <option value="medium">{'Vừa · Ảnh hưởng sử dụng'}</option>
              <option value="high">{'Cao · Không thể ra vào kho'}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">{'Chi tiết'}</label>
            <textarea
              rows={3}
              value={ticketDescription}
              onChange={e => setTicketDescription(e.target.value)}
              className="w-full border border-stone-300 rounded-lg p-2 text-xs"
              placeholder={'Mô tả vấn đề bạn đang gặp phải...'}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
            <Button variant="outline" onClick={() => setTicketOpen(false)}>{'Hủy'}</Button>
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
                    facility: relatedRental?.facilityName || relatedHold?.facilityName || ('Không áp dụng'),
                    unit: relatedRental?.unitId || relatedHold?.assignedUnitId || relatedHold?.unitTypeName || '—',
                    facilityId: relatedRental?.facilityId || relatedHold?.facilityId,
                    relatedType: relatedType as 'rental' | 'reservation' | 'general',
                    relatedId: relatedId || undefined
                  }, ticketDescription.trim(), user)
                  setTicketOpen(false)
                  setTicketSubject('')
                  setTicketDescription('')
                  setTicketRelatedRecord('general')
                  showToast('Đã gửi yêu cầu hỗ trợ tới ban quản lý!')
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Không thể tạo yêu cầu hỗ trợ.')
                }
              }}
            >
              {'Gửi yêu cầu'}
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </Layout>
  )
}

