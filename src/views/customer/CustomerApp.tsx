import { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react'
import Layout, { getInitialPage, Icon, type LayoutNotification, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Input, Select, Tabs, Avatar } from '../../components/ui'
import { formatVnd, vndToLegacyBase } from '../../i18n/currency'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import CustomerUnitDetails from './CustomerUnitDetails'
import CustomerRentalRulesPage from './CustomerRentalRulesPage'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import { customerFacilityName, customerFacilityAddress } from '../../i18n/customerLabels'
import type { User } from '../../types'
import type { TicketItem } from '../../types/support'
import type { Facility, StorageUnit, StorageHold, UnitType, RentalPackage, ReturnCase } from '../../types/storageHub'
import { useStorageHub } from '../../store/StorageHubContext'
import ProfileView from '../ProfileView'
import CustomerReservationCard from './CustomerReservationCard'
import CustomerPaymentHistory from './CustomerPaymentHistory'
import CustomerRentalsApiPanel from './CustomerRentalsApiPanel'
import { CustomerApiMetric, CustomerRentalApiLink } from '../rental-api/CustomerApiOverview'
import { resolveCustomerInitialPage } from './customerRentalApiIntegration'
import CustomerReservationOtpModal from './CustomerReservationOtpModal'
import { canApiCustomerNavigate, isApiAuthenticated } from '../../services/authApi'
import { ApiClientError } from '../../services/apiClient'
import { listNotifications, markNotificationRead, type ApiNotification } from '../../services/notificationApi'
import { reservationProgress } from './reservationPresentation'
import { requestReturn as requestReturnApi } from '../../services/returnApi'
import ReturnSettlementModal from '../../components/ReturnSettlementModal'
import { generateDefaultRentalPackages, resolveRentalPackagesForUnit } from '../../domain/packageRules'
import { LEGACY_RENEWAL_NOTICE, LEGACY_RENEWAL_HISTORY_NOTICE, legacyRenewalMoney, isLegacyRenewalPayment } from '../../domain/legacyRenewal'
import LegacyRenewalPaymentRecord from '../rental-api/LegacyRenewalPaymentRecord'
import { formatPolicyDateTime, isCheckInAppointmentAllowed, plannedCheckInWindow, policyDateInput, policyTimeInput, PAYMENT_WINDOW_MINUTES, MANAGER_ASSIGNMENT_HOURS, CHECK_IN_WINDOW_DAYS } from '../../domain/reservationCheckInPolicy'
import { withinFacilityHours } from '../../domain/facilityAppointmentHours'
import CustomerSupportChatbot from '../../components/support/CustomerSupportChatbot'
import CustomerSupportWidget from '../../components/support/CustomerSupportWidget'
import { paymentCurrencyLabel, paymentMethodLabel } from './paymentLabels'
import { storageSizeCode, unitTypeMatches } from '../../domain/facilityRules'
import { customerFacilityImage, customerUnitAmenities } from './customerPresentation'
import { isVietnamesePhone, VIETNAMESE_PHONE_ERROR_MESSAGE } from '../../domain/vietnamesePhone'
import {
  dimensionalWeightKg,
  isPackageSampleValid,
  packageCapacityPerRack,
  packageVolumeM3,
  requiredRackCountForSamples,
  usableRackVolumeM3,
  type ReservationPackageSample,
} from '../../domain/reservationCapacity'
import {
  listCustomerFacilities,
  listCustomerUnitTypes,
  listReservationRentalPackages,
  getAvailability,
  getGoodsCatalog,
  checkCompatibility,
  recommendReservationUnitType,
  cancelCustomerReservation,
  createCustomerReservation,
  createReservationQuote,
  getCustomerReservation,
  listCustomerReservations,
  resendReservationOtp,
  uploadReservationGoodsImage,
  verifyReservationOtp,
  type CustomerFacility,
  type CustomerReservation,
  type CustomerUnitType,
  type CompatibilityCheckResult,
  type ReservationRecommendation,
  type GoodsCategory,
  type GoodsItemInput,
  type GoodsCatalog,
  type ReservationQuote,
  type ReservationRentalPackage,
} from '../../services/customerReservationApi'


type CustomerCatalogUnit = StorageUnit & {
  sizeCode: string
  rackCount: number
  rackDimensions: string
  aisleWidthM: number
  smallBoxCapacity: number
  largeBoxCapacity: number
  trolley: string
  trolleyDetail: string
}
type CustomerConfirmation = {
  title: string
  message: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
}

const uniqueRentalPackagesByDuration = (packages: ReservationRentalPackage[]) => {
  const seen = new Set<number>()
  return packages.filter(pkg => {
    if (seen.has(pkg.rentalMonths)) return false
    seen.add(pkg.rentalMonths)
    return true
  })
}

const isIdentityDocumentFormatValid = (value: string) =>
  /^[0-9A-Za-z][0-9A-Za-z .-]{8,29}$/.test(value.trim())

const customerTrolleyVi = (sizeCode?: string, originalTrolley?: string): string => {
  if (!originalTrolley || originalTrolley === 'Chưa cập nhật') return 'Chưa cập nhật'
  const t = originalTrolley.toLowerCase()
  if (t.includes('electric') || t.includes('walkie')) return 'Xe nâng điện dắt bộ'
  if (t.includes('platform')) return 'Xe đẩy sàn phẳng'
  if (t.includes('pallet')) return 'Xe nâng tay pallet'
  return originalTrolley
}

const storageTypeLabelVi = (value?: string) => {
  const normalized = (value || '').toLowerCase()
  if (normalized.includes('4xl')) return 'Kho đặc biệt lớn (4XL)'
  if (normalized.includes('xxl')) return 'Kho cực lớn (XXL)'
  if (normalized.includes('extra large') || /(^|\W)xl(\W|$)/.test(normalized)) return 'Kho rất lớn (XL)'
  if (normalized.includes('medium') || /(^|\W)m(\W|$)/.test(normalized)) return 'Kho vừa (M)'
  if (normalized.includes('small') || /(^|\W)s(\W|$)/.test(normalized)) return 'Kho nhỏ (S)'
  if (normalized.includes('large') || /(^|\W)l(\W|$)/.test(normalized)) return 'Kho lớn (L)'
  return value || 'Kho chưa xác định cỡ'
}


const CUSTOMER_UNIT_TYPES_PER_PAGE = 6
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
  images: File[]
}
type PackageSample = ReservationPackageSample & { id: string; sourceLabel?: string }
type CapacityStatus = 'invalid' | 'fits' | 'not-fit'

type GoodsCategoryCode = string
const createGoodsDeclarationItem = (id = `goods-${Date.now()}`): GoodsDeclarationItem => ({ id, category: '', materialType: '', materialName: '', customGoodsName: '', description: '', customMaterial: '', quantity: '', lengthCm: '', widthCm: '', heightCm: '', weightKg: '', fragile: '', customerNote: '', images: [] })

const rentalDiscountRate = (months: number, customPackages?: RentalPackage[]) => {
  if (customPackages && customPackages.length > 0) {
    const pkg = customPackages.find(p => p.months === months)
    if (pkg) {
      return pkg.status === 'active' && typeof pkg.discountPercent === 'number'
        ? pkg.discountPercent / 100
        : 0
    }
  }
  return months === 3 ? 0.03 : months === 6 ? 0.05 : months === 12 ? 0.08 : months === 24 ? 0.12 : 0
}

const parsePositiveNumber = (rawValue: string) => {
  if (rawValue.trim() === '') return null
  const value = Number(rawValue)
  return Number.isFinite(value) && value > 0 ? value : null
}
const CUSTOMER_UNIT_IMAGE_BY_SIZE: Record<string, string> = {
  S: '/images/customer-units/kho-s.jpg',
  M: '/images/customer-units/kho-m.jpg',
  L: '/images/customer-units/kho-l.jpg',
  XL: '/images/customer-units/kho-xl.jpg',
}
const CUSTOMER_UNIT_DETAIL_IMAGE_BY_SIZE: Record<string, string> = {
  S: '/images/customer-units/details/kho-s-chi-tiet.png',
  M: '/images/customer-units/details/kho-m-chi-tiet.png',
  L: '/images/customer-units/details/kho-l-chi-tiet.png',
  XL: '/images/customer-units/details/kho-xl-chi-tiet.png',
}
const getCustomerUnitImage = (sizeCode?: string) => {
  if (sizeCode && CUSTOMER_UNIT_IMAGE_BY_SIZE[sizeCode]) {
    return CUSTOMER_UNIT_IMAGE_BY_SIZE[sizeCode]
  }
  return CUSTOMER_UNIT_IMAGE_BY_SIZE.XL
}
const getCustomerUnitDetailImage = (sizeCode?: string) => {
  if (sizeCode && CUSTOMER_UNIT_DETAIL_IMAGE_BY_SIZE[sizeCode]) {
    return CUSTOMER_UNIT_DETAIL_IMAGE_BY_SIZE[sizeCode]
  }
  return CUSTOMER_UNIT_DETAIL_IMAGE_BY_SIZE.XL
}
const SearchIcon = <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>

const statusLabelMap: Record<string, string> = {
    active: 'Đang hoạt động',
    available: 'Còn trống',
    held: 'Đang giữ kho',
    assigned: 'Đã xác định gian kho',
    occupied: 'Đã thuê',
    inspection: 'Đang kiểm tra',
    maintenance: 'Bảo trì',
    paid: 'Đã thanh toán',
    resolved: 'Đã xử lý thành công',
    pending: 'Chờ xử lý',
    awaiting_email: 'Chờ xác nhận email',
    awaiting_review: 'Chờ nhân viên cơ sở duyệt',
    awaiting_payment: 'Chờ thanh toán cọc',
    approved: 'Đã duyệt',
    payment_processing: 'Đang xác minh thanh toán',
    payment_failed: 'Thanh toán thất bại',
    payment_expired: 'Hết hạn thanh toán',
    confirmed: 'Đã xác nhận',
    deposit_paid: 'Đã cọc giữ chỗ',
    full_rent_paid: 'Đã thanh toán toàn kỳ gia hạn',
    contract_signed: 'Đã ký hợp đồng',
    fully_paid: 'Đã thanh toán đủ',
    unit_assigned: 'Đã xác định gian kho',
    scheduled: 'Đã lên lịch nhận kho',
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
    open: 'Chờ nhân viên tiếp nhận',
    'in-progress': 'Đang được xử lý',
    ended: 'Đã kết thúc',
    closed: 'Đã đóng',
    low: 'Tiêu chuẩn',
    CREATED: 'Chờ xác nhận',
    DEPOSIT_PAID: 'Đã thanh toán cọc',
    UNIT_RESERVED: 'Đã giữ gian kho',
    READY_FOR_CHECKIN: 'Sẵn sàng nhận kho',
    COMPLETED: 'Đã hoàn tất nhận kho',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Đã hết hạn',
}
interface SizeCategoryCardProps {
  apiSpec?: CustomerUnitType
  facility: Facility
  unitType: UnitType
  availableCount: number
  onReserve: (facility: Facility, unitType: UnitType) => void
  onViewSpecs: (facility: Facility, unitType: UnitType, availableCount: number) => void
}

function SizeCategoryCard({ facility, unitType, apiSpec, availableCount, onReserve, onViewSpecs }: SizeCategoryCardProps) {
  const isAvailable = availableCount > 0
  const usableCapacity = Math.round(unitType.volumeM3 * 0.75 * 10) / 10
  const sizeCode = storageSizeCode(unitType.name)
  const amenities = apiSpec ? {
    aisleWidthM: apiSpec.aisleWidthM ?? 0,
    trolley: apiSpec.trolleyType || 'Chưa cập nhật',
    smallBoxCapacity: apiSpec.smallBoxCapacity ?? 0,
    largeBoxCapacity: apiSpec.largeBoxCapacity ?? 0,
  } : isApiAuthenticated() ? {
    aisleWidthM: 0,
    trolley: 'Chưa cập nhật',
    smallBoxCapacity: 0,
    largeBoxCapacity: 0,
  } : customerUnitAmenities(sizeCode)

  const resolvedImage = apiSpec?.imageUrl || facility.image || (isApiAuthenticated() ? '' : getCustomerUnitImage(sizeCode))
  const [imgSrc, setImgSrc] = useState(resolvedImage)

  useEffect(() => {
    setImgSrc(apiSpec?.imageUrl || facility.image || (isApiAuthenticated() ? '' : getCustomerUnitImage(sizeCode)))
  }, [apiSpec?.imageUrl, facility.image, sizeCode])

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-lg">
      <div className="relative h-44 overflow-hidden bg-stone-200">
        {imgSrc ? <img
          src={imgSrc}
          alt={`Không gian kho loại ${sizeCode}`}
          className="h-full w-full object-cover transition duration-300 hover:scale-105"
          onError={() => setImgSrc(isApiAuthenticated() ? '' : getCustomerUnitImage(sizeCode))}
        /> : <div className="flex h-full items-center justify-center px-4 text-center text-sm text-stone-500">Chưa có hình ảnh loại kho</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/65 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur-sm shadow flex items-center gap-1">
           {facility.name}
        </span>
        <span className="absolute bottom-3 left-4 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">Kho size {sizeCode}</span>
      </div>
      <div className="flex flex-col p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-amber-700 truncate mb-0.5">{facility.name}</p>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-stone-500">{'Cỡ kho'}</p>
            <h3 className="mt-0.5 text-xl font-bold leading-tight text-black">{storageTypeLabelVi(unitType.name)}</h3>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${isAvailable ? 'border-stone-300 bg-white text-black' : 'border-red-700 bg-red-700 text-white'}`}>
            {isAvailable ? `${availableCount} ${'kho trống'}` : ('Hết kho')}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-stone-200 py-4 text-sm">
          <div><p className="text-xs text-stone-500">{'Diện tích'}</p><p className="mt-0.5 font-bold text-black">{unitType.areaM2} m²</p></div>
          <div><p className="text-xs text-stone-500">{'Kích thước (D×R×C)'}</p><p className="mt-0.5 font-bold text-black">{unitType.lengthM} × {unitType.widthM} × {unitType.heightM} m</p></div>
          <div><p className="text-xs text-stone-500">{'Thể tích kho'}</p><p className="mt-0.5 font-bold text-black">{unitType.volumeM3} m³</p></div>
          <div><p className="text-xs text-stone-500">{'Số khung kệ'}</p><p className="mt-0.5 font-bold text-black">{apiSpec?.rackCount ?? '—'} khung</p></div>
          <div><p className="text-xs text-stone-500">{'Chiều rộng lối đi'}</p><p className="mt-0.5 font-bold text-black">{amenities ? `${amenities.aisleWidthM} m` : 'Chưa có dữ liệu'}</p></div>
          <div><p className="text-xs text-stone-500">{'Tải trọng tối đa'}</p><p className="mt-0.5 font-bold text-black">{unitType.maxLoadKg.toLocaleString('vi-VN')} kg</p></div>
        </div>
        {amenities && <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5 text-xs">
          <div>
            <p className="text-stone-500">Xe đẩy hỗ trợ</p>
            <p className="mt-0.5 font-bold text-stone-800">{amenities.trolley}</p>
          </div>
        </div>}
        {unitType.descriptionVi && <p className="mt-4 line-clamp-3 text-sm leading-5 text-stone-600">{unitType.descriptionVi}</p>}
        <div className="pt-5">
          <p className="text-xs text-stone-500">{'Giá thuê từ'}</p>
          <p className="text-2xl font-bold tracking-tight text-black">{formatVnd(unitType.monthlyPrice)}<span className="text-sm font-normal text-stone-500">/{'tháng'}</span></p>
          <p className="mt-1 text-xs text-stone-600">Cọc giữ chỗ theo báo giá hệ thống</p>
          <p className="mt-1 text-xs text-stone-600">{`Tiền cọc đảm bảo kho: ${apiSpec?.securityDepositAmount != null ? formatVnd(apiSpec.securityDepositAmount) : isApiAuthenticated() ? 'Chưa có dữ liệu' : formatVnd(unitType.monthlyPrice)} (hoàn sau nghiệm thu nếu không phát sinh khấu trừ)`}</p>
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

interface CustomerAppProps { user: User; onLogout: () => void; onUpdateUser?: (updated: Partial<User>) => void }

function parseCustomerDate(value?: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function dateInputValue(value: Date): string {
  return value.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function displayDateValue(value?: string): string {
  if (!value) return 'Chưa có'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.replace(/-/g, '/')
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
  if (!date || months <= 0) return '—'
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  const targetYear = year + Math.floor((month + months) / 12)
  const targetMonth = (month + months) % 12
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const targetDay = Math.min(day, daysInTargetMonth)

  const correspondingDate = new Date(targetYear, targetMonth, targetDay)
  // Calendar-month inclusive end date: ends at the close of day before corresponding date (e.g. 15/10/2026 + 3M -> 14/01/2027)
  correspondingDate.setDate(correspondingDate.getDate() - 1)
  return dateInputValue(correspondingDate)
}

export default function CustomerApp({ user, onLogout, onUpdateUser }: CustomerAppProps) {
  const hub = useStorageHub()
  const {
    facilities: sharedFacilities,
    units: sharedUnits,
    holds,
    checkins,
    rentals,
    returns,
    activities,
    tickets,
    config,
    unitTypes: sharedUnitTypes,
    validateAndCreateReservation,
    calculateDIMAndQuote,
    verifyHoldEmail,
    resendHoldEmail,
    payStorageHold,
    contracts,
    payments,
    scheduleCheckIn,
    requestReturn,
    cancelRenewalRequest,
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
    replySupportTicket,
    deleteResolvedSupportTicket
  } = hub

  const [backendFacilities, setBackendFacilities] = useState<CustomerFacility[]>([])
  const [backendUnitTypes, setBackendUnitTypes] = useState<CustomerUnitType[]>([])
  const [goodsCatalog, setGoodsCatalog] = useState<GoodsCatalog | null>(null)
  const GOODS_CATEGORY_OPTIONS = useMemo(() => goodsCatalog?.categories.map(category => [category.code, category.label] as const) ?? [], [goodsCatalog])
  const MATERIALS_BY_CATEGORY = useMemo(() => Object.fromEntries((goodsCatalog?.categories ?? []).map(category => [category.code, {
    normal: category.materials.filter(material => !material.fragile).map(material => material.label),
    fragile: category.materials.filter(material => material.fragile).map(material => material.label),
  }])) as Record<GoodsCategoryCode, { normal: string[]; fragile: string[] }>, [goodsCatalog])
  const catalogCategoryFor = (code: string) => goodsCatalog?.categories.find(category => category.code === code)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [availabilityByUnitType, setAvailabilityByUnitType] = useState<Record<string, number>>({})
  const [availabilityRevision, setAvailabilityRevision] = useState(0)
  const [availabilityPeriod, setAvailabilityPeriod] = useState(() => {
    const startDate = dateInputValue(new Date(Date.now() + 2 * 86_400_000))
    return { startDate, endDate: addMonthsForPreview(startDate, 3) }
  })
  const [serverQuote, setServerQuote] = useState<ReservationQuote | null>(null)
  const [acceptedSetupQuoteId, setAcceptedSetupQuoteId] = useState<string | null>(null)
  const [serverCompatibility, setServerCompatibility] = useState<CompatibilityCheckResult | null>(null)
  const [serverRecommendation, setServerRecommendation] = useState<ReservationRecommendation | null>(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationError, setRecommendationError] = useState<string | null>(null)
  const [recommendationRetry, setRecommendationRetry] = useState(0)
  const [bookingVoucherCode, setBookingVoucherCode] = useState('')
  const [backendRentalPackages, setBackendRentalPackages] = useState<ReservationRentalPackage[]>([])
  const [rentalPackagesLoading, setRentalPackagesLoading] = useState(false)
  const [backendReservations, setBackendReservations] = useState<CustomerReservation[]>([])
  const [backendNotifications, setBackendNotifications] = useState<ApiNotification[]>([])
  const [reservationSubmitting, setReservationSubmitting] = useState(false)
  const [backendOtpReservation, setBackendOtpReservation] = useState<CustomerReservation | null>(null)
  const [backendOtpCode, setBackendOtpCode] = useState('')
  const [backendOtpBusy, setBackendOtpBusy] = useState(false)
  const [backendOtpMessage, setBackendOtpMessage] = useState<string | null>(null)
  const [backendOtpDevelopmentCode, setBackendOtpDevelopmentCode] = useState<string | null>(null)
  const [backendOtpNextResendAt, setBackendOtpNextResendAt] = useState<Record<string, number>>({})
  const [settlementModalOpen, setSettlementModalOpen] = useState(false)
  const [selectedSettlementReturn, setSelectedSettlementReturn] = useState<ReturnCase | null>(null)
  const reservationIdempotencyKey = useRef<string | null>(null)

  const facilities: Facility[] = useMemo(() => backendFacilities.length
    ? backendFacilities.map(facility => ({
        id: facility.id,
        code: facility.code,
        name: isApiAuthenticated() ? facility.name : customerFacilityName(facility.code, facility.name),
        address: isApiAuthenticated() ? facility.address : customerFacilityAddress(facility.code, facility.name, facility.address),
        city: facility.city,
        rating: 0,
        available: backendUnitTypes
          .filter(unitType => unitType.facilityId === facility.id)
          .reduce((total, unitType) => total + (availabilityByUnitType[unitType.id] ?? unitType.availableCount ?? 0), 0),
        price: '',
        climate: Boolean(facility.climateControlled),
        security: facility.securityDescription || '',
        image: facility.imageUrl || (isApiAuthenticated() ? '' : customerFacilityImage(facility.code)),
        units: backendUnitTypes.filter(unitType => unitType.facilityId === facility.id).length,
        occupied: 0,
        revenue: 0,
        growth: 0,
        manager: '',
        status: facility.status === 'maintenance' ? 'maintenance' : 'active',
        accessHours: facility.accessHours || 'Chưa cập nhật',
        timezone: 'Asia/Ho_Chi_Minh',
      }))
    : isApiAuthenticated() ? [] : sharedFacilities, [backendFacilities, backendUnitTypes, availabilityByUnitType, sharedFacilities])

  const units: StorageUnit[] = useMemo(() => backendUnitTypes.length
    ? backendUnitTypes.map(unitType => {
        const facility = backendFacilities.find(item => item.id === unitType.facilityId)
        const sizeCode = storageSizeCode(unitType.name || unitType.code)
        return {
          id: unitType.id,
          code: unitType.code,
          size: sizeCode,
          sizeCode,
          facilityId: unitType.facilityId,
          facilityName: facility
            ? (isApiAuthenticated() ? facility.name : customerFacilityName(facility.code, facility.name))
            : (isApiAuthenticated() ? 'Chưa cập nhật' : 'Cơ sở lưu trữ'),
          floor: 1,
          zone: 'Tiêu chuẩn',
          type: unitType.name,
          areaM2: unitType.areaM2,
          dimensions: {
            lengthM: unitType.lengthM,
            widthM: unitType.widthM,
            heightM: unitType.heightM,
          },
          doorDimensions: { widthM: 0, heightM: 0 },
          volumeM3: unitType.volumeM3,
          maxLoadKg: unitType.maxLoadKg,
          allowedGoods: [],
          prohibitedGoods: [],
          price: vndToLegacyBase(unitType.monthlyPrice),
          deposit: vndToLegacyBase(unitType.securityDepositAmount),
          rackCount: unitType.rackCount,
          climate: Boolean(facility?.climateControlled),
          status: (unitType.availableCount ?? 0) > 0 ? 'available' : 'reserved',
          reservedPeriods: [],
          version: 1,
        }
      })
    : isApiAuthenticated() ? [] : sharedUnits, [backendFacilities, backendUnitTypes, sharedUnits])

  const unitTypes: UnitType[] = useMemo(() => backendUnitTypes.length
    ? backendUnitTypes.map(unitType => ({
        id: unitType.id,
        name: unitType.name,
        lengthM: unitType.lengthM,
        widthM: unitType.widthM,
        heightM: unitType.heightM,
        areaM2: unitType.areaM2,
        volumeM3: unitType.volumeM3,
        pricePerM3: unitType.volumeM3 > 0 ? vndToLegacyBase(unitType.monthlyPrice) / unitType.volumeM3 : 0,
        monthlyPrice: vndToLegacyBase(unitType.monthlyPrice),
        maxLoadKg: unitType.maxLoadKg,
        descriptionVi: unitType.description || '',
        descriptionEn: '',
      }))
    : isApiAuthenticated() ? [] : sharedUnitTypes, [backendUnitTypes, sharedUnitTypes])

  const CUSTOMER_FACILITY_DISPLAY = useMemo(() => {
    const map: Record<string, { code: string; name: string; address: string }> = {}
    for (const f of facilities) {
      map[f.id] = { code: f.code || f.id.toUpperCase(), name: f.name, address: f.address }
      if (f.code) {
        map[f.code] = { code: f.code, name: f.name, address: f.address }
      }
    }
    return new Proxy(map, {
      get(target, prop: string) {
        if (prop in target) return target[prop]
        const found = facilities.find(f => f.id === prop || f.code === prop)
        if (found) {
          return { code: found.code || found.id.toUpperCase(), name: found.name, address: found.address }
        }
        return { code: String(prop).toUpperCase(), name: String(prop), address: '' }
      }
    })
  }, [facilities])

  const CUSTOMER_CATALOG_UNITS: CustomerCatalogUnit[] = useMemo(() => {
    return units.map(unit => {
      let sizeCode = (unit as any).sizeCode || ''
      if (!sizeCode) {
        if (unit.type === 'Small' || unit.code.includes('-S-') || unit.code.includes('-S')) sizeCode = 'S'
        else if (unit.type === 'Large' || unit.code.includes('-L-') || unit.code.includes('-L')) sizeCode = 'L'
        else if (unit.type === 'Extra Large' || unit.code.includes('-XL-') || unit.code.includes('-XL')) sizeCode = 'XL'
        else if (unit.type === 'Medium' || unit.code.includes('-M-') || unit.code.includes('-M')) sizeCode = 'M'
        else {
          const match = unit.code.match(/-([A-Za-z0-9]+)-\d+$/)
          sizeCode = match ? match[1] : (unit.type ? unit.type.replace(/^Kho\s+/i, '') : 'M')
        }
      }

      const backendSpec = backendUnitTypes.find(item => item.id === unit.id)
      const amenities = backendSpec ? {
        aisleWidthM: backendSpec.aisleWidthM ?? 0,
        trolley: backendSpec.trolleyType || 'Chưa cập nhật',
        smallBoxCapacity: backendSpec.smallBoxCapacity ?? 0,
        largeBoxCapacity: backendSpec.largeBoxCapacity ?? 0,
      } : isApiAuthenticated() ? {
        aisleWidthM: 0,
        trolley: 'Chưa cập nhật',
        smallBoxCapacity: 0,
        largeBoxCapacity: 0,
      } : customerUnitAmenities(sizeCode)
      const fac = facilities.find(f => f.id === unit.facilityId || f.code === unit.facilityId)
      const facilityName = fac?.name || unit.facilityName || (isApiAuthenticated() ? 'Chưa cập nhật' : 'Kho StorageHub')
      const lengthM = unit.dimensions?.lengthM ?? backendSpec?.lengthM ?? 0
      const widthM = unit.dimensions?.widthM ?? backendSpec?.widthM ?? 0
      const heightM = unit.dimensions?.heightM ?? backendSpec?.heightM ?? 0
      const areaM2 = unit.areaM2 || (lengthM * widthM)
      const volumeM3 = unit.volumeM3 || (lengthM * widthM * heightM)
      const aisleWidthM = amenities?.aisleWidthM ?? 0
      const maxLoadKg = unit.maxLoadKg || backendSpec?.maxLoadKg || 0
      const price = unit.price

      const rackCount = backendSpec?.rackCount ?? (unit as any).rackCount ?? 0
      const smallBoxCapacity = amenities?.smallBoxCapacity ?? 0
      const largeBoxCapacity = amenities?.largeBoxCapacity ?? 0

      return {
        ...unit,
        facilityName,
        sizeCode,
        areaM2,
        rackCount,
        rackDimensions: backendSpec
          ? `${backendSpec.rackLengthM}×${backendSpec.rackWidthM}×${backendSpec.rackHeightM} m`
          : 'Chưa có dữ liệu',
        aisleWidthM,
        smallBoxCapacity,
        largeBoxCapacity,
        trolley: customerTrolleyVi(sizeCode, amenities?.trolley),
        trolleyDetail: customerTrolleyVi(sizeCode, amenities?.trolley),
        dimensions: { lengthM, widthM, heightM },
        volumeM3,
        maxLoadKg,
        price,
        deposit: backendSpec?.securityDepositAmount ?? unit.deposit ?? 0,
        rentalPackages: isApiAuthenticated()
          ? []
          : unit.rentalPackages || fac?.unitCustomSpecs?.find(s => s.sizeCode === sizeCode)?.rentalPackages || generateDefaultRentalPackages(fac?.id || unit.facilityId, sizeCode, price),
        allowedGoods: isApiAuthenticated() ? [] : (unit.allowedGoods?.length ? unit.allowedGoods : ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử']),
        prohibitedGoods: isApiAuthenticated() ? [] : (unit.prohibitedGoods?.length ? unit.prohibitedGoods : ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống']),
      }
    })
  }, [units, facilities, backendUnitTypes])

  const NAV: NavItem[] = [
    { id: 'overview', label: 'Tổng quan', icon: Icon.home, group: 'Thông tin chung', permission: 'dashboard:read' },
    { id: 'browse-facilities', label: 'Tìm cơ sở kho', icon: Icon.building, group: 'Tìm và đặt kho', permission: 'facilities:read' },
    { id: 'browse-units', label: 'Cỡ kho khả dụng', icon: Icon.box, group: 'Tìm và đặt kho', permission: 'storage_units:read' },
    { id: 'reservations', label: 'Đơn đặt giữ kho', icon: Icon.calendar, group: 'Tìm và đặt kho', permission: 'reservations:read' },
    { id: 'rental-records', label: 'Hồ sơ thuê', icon: Icon.key, group: 'Thuê kho và thanh toán', permission: 'rentals:read' },
    { id: 'payments', label: 'Lịch sử thanh toán', icon: Icon.credit, group: 'Thuê kho và thanh toán', permission: 'payments:read' },
    { id: 'policies', label: 'Quy định thuê kho', icon: Icon.policy, group: 'Quy định và hỗ trợ', permission: 'policies:read' },
  ]

  const [page, setPage] = useState(() =>
    resolveCustomerInitialPage(window.location.search, getInitialPage(NAV, 'overview')))
  const [previousPage, setPreviousPage] = useState('overview')
  const [paymentRentalId, setPaymentRentalId] = useState<string | undefined>()
  useEffect(() => {
    if (page !== 'rental-records') setPaymentRentalId(undefined)
  }, [page])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('facilityId') || new URLSearchParams(window.location.search).get('facility')
  })
  const [selectedTarget, setSelectedTarget] = useState<{ facility: Facility; unitType: UnitType } | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<StorageUnit | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4>(1)
  const [bookingReview, setBookingReview] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [activeHoldForEmail, setActiveHoldForEmail] = useState<StorageHold | null>(null)
  const [inputToken, setInputToken] = useState('')

  useEffect(() => {
    if (!isApiAuthenticated()) return
    let cancelled = false
    const load = async () => {
      try {
        const result = await listNotifications(0, 50)
        if (!cancelled) setBackendNotifications(result.data)
      } catch { /* The reservation screens remain usable if notifications are temporarily unavailable. */ }
    }
    void load()
    const refreshAfterPayment = () => void load()
    window.addEventListener('storagehub:notifications-refresh', refreshAfterPayment)
    const timer = window.setInterval(() => void load(), 10_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('storagehub:notifications-refresh', refreshAfterPayment)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let initialLoad = true
    const loadReservations = async () => {
      try {
        const result = await listCustomerReservations(undefined, 0, 50)
        if (!cancelled) setBackendReservations(result.data)
      } catch (error) {
        if (!cancelled && initialLoad) {
          showToast(error instanceof Error ? error.message : 'Không thể tải danh sách đặt kho.')
        }
      } finally {
        initialLoad = false
      }
    }
    void loadReservations()
    const timer = window.setInterval(() => void loadReservations(), 5_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [activeHoldForPayment, setActiveHoldForPayment] = useState<StorageHold | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản VietQR')

  // Post-payment Digital Contract & Receipt Email Modal
  const [contractEmailModalOpen, setContractEmailModalOpen] = useState(false)
  const [activeHoldForContract, setActiveHoldForContract] = useState<StorageHold | null>(null)
  const [contractTab, setContractTab] = useState<'contract' | 'receipt'>('contract')
  const [contractFilter, setContractFilter] = useState<'all' | 'active' | 'completed'>('all')

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [activeHoldForSchedule, setActiveHoldForSchedule] = useState<StorageHold | null>(null)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')

  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [activeRentalForReturn, setActiveRentalForReturn] = useState<typeof rentals[0] | null>(null)
  const [returnTargetDate, setReturnTargetDate] = useState('2026-09-30')
  const [returnReason, setReturnReason] = useState('Hết nhu cầu lưu trữ')
  const [confirmation, setConfirmation] = useState<CustomerConfirmation | null>(null)
  const [returnDisputeTargetId, setReturnDisputeTargetId] = useState<string | null>(null)
  const [returnDisputeReason, setReturnDisputeReason] = useState('')

  const requestConfirmation = (nextConfirmation: CustomerConfirmation) => setConfirmation(nextConfirmation)
  const closeConfirmation = () => setConfirmation(null)
  const runConfirmedAction = () => {
    const action = confirmation?.onConfirm
    setConfirmation(null)
    action?.()
  }

  const [renewalModalOpen, setRenewalModalOpen] = useState(false)
  const [activeRentalForRenewal, setActiveRentalForRenewal] = useState<typeof rentals[0] | null>(null)
  const [, setRenewalMonths] = useState(1)
  const [editingRenewalId, setEditingRenewalId] = useState<string | null>(null)
  const [renewalPaymentOpen, setRenewalPaymentOpen] = useState(false)
  const [activeRenewalForPayment, setActiveRenewalForPayment] = useState<typeof renewals[0] | null>(null)
  const [, setRenewalTermsAccepted] = useState(false)
  const [, setRenewalAppointmentDate] = useState('')
  const [, setRenewalAppointmentTime] = useState('09:00')

  // Search & Filter state
  const [sizeFilter, setSizeFilter] = useState('All')
  const [searchFacility, setSearchFacility] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [reservationFacilityFilter, setReservationFacilityFilter] = useState('all')
  const [receiptRentalTarget, setReceiptRentalTarget] = useState<string>()
  const [rentalMenuVisit, setRentalMenuVisit] = useState(0)
  const [paymentHistoryFilter, setPaymentHistoryFilter] = useState<'all' | 'payments' | 'settlement'>('all')
  const [reservationSizeFilter, setReservationSizeFilter] = useState('all')
  const [rentalFacilityFilter, setRentalFacilityFilter] = useState('all')
  const [rentalTypeFilter, setRentalTypeFilter] = useState('all')
  const [rentalDeadlineFilter, setRentalDeadlineFilter] = useState<'all' | 'upcoming' | 'overdue'>('all')
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
    if (isApiAuthenticated()) return
    renewals
      .filter(renewal => renewal.customerId === user.id && renewal.status === 'approved' && renewal.paymentDueAt && new Date(renewal.paymentDueAt).getTime() <= now)
      .forEach(renewal => expireRenewalPayment(renewal.id))
  }, [expireRenewalPayment, now, renewals, user.id])

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
  const [goodsCondition, setGoodsCondition] = useState('')
  const [moveInDate, setMoveInDate] = useState(availabilityPeriod.startDate)
  const [bookingAppointmentTime, setBookingAppointmentTime] = useState('09:00')
  const [bookingStartedAt, setBookingStartedAt] = useState(() => Date.now())
  const [schedulePolicyMessage, setSchedulePolicyMessage] = useState<string | null>(null)
  const [rentalMonths, setRentalMonths] = useState(3)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [customerIdCard, setCustomerIdCard] = useState('')
  const [customerPhone, setCustomerPhone] = useState(user.phone ?? '')
  const [customerEmail] = useState(user.email)
  const [customerAddress, setCustomerAddress] = useState(user.permanentAddress ?? '')
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({})
  const [reservationSubmitError, setReservationSubmitError] = useState<string | null>(null)
  const bookingErrorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!backendUnitTypes.length) return
    let cancelled = false
    void Promise.all(backendUnitTypes.map(unitType => getAvailability({
      facilityId: unitType.facilityId, unitTypeId: unitType.id, ...availabilityPeriod,
    }))).then(results => {
      if (!cancelled) setAvailabilityByUnitType(Object.fromEntries(results.map(result => [result.unitTypeId, result.availableCount])))
    }).catch(error => { if (!cancelled) showToast(error instanceof Error ? error.message : 'Không thể cập nhật số kho trống.') })
    return () => { cancelled = true }
  }, [backendUnitTypes, availabilityPeriod, availabilityRevision])
  const resetBookingForm = () => {
    setGoodsItems([createGoodsDeclarationItem('goods-1')])
    setGoodsCondition('')
    setMoveInDate(availabilityPeriod.startDate)
    setBookingAppointmentTime('09:00')
    setRentalMonths(3)
    setSelectedPackageId('')
    setCustomerIdCard('')
    setCustomerPhone(user.phone ?? '')
    setCustomerAddress(user.permanentAddress ?? '')
    setBookingErrors({})
    setSchedulePolicyMessage(null)
    setReservationSubmitError(null)
    setValidationViolation(null)
    setServerRecommendation(null)
    setRecommendationLoading(false)
    setRecommendationError(null)
    setBookingStep(1)
    setBookingReview(false)
    setTermsAccepted(false)
    setBookingVoucherCode('')
  }
  const capacitySamples: PackageSample[] = goodsItems.map((item, index) => ({
    id: item.id, quantity: item.quantity, lengthCm: item.lengthCm, widthCm: item.widthCm,
    heightCm: item.heightCm, weightKg: item.weightKg,
    sourceLabel: item.customGoodsName || GOODS_CATEGORY_OPTIONS.find(option => option[0] === item.category)?.[1] || `Hàng hóa ${index + 1}`,
  }))
  const packageCountNumber = capacitySamples.reduce((sum, sample) => sum + (Number(sample.quantity) || 0), 0)
  const goodsWeightNumber = capacitySamples.reduce((sum, sample) => sum + ((Number(sample.quantity) || 0) * (Number(sample.weightKg) || 0)), 0)
  const goodsVolumeM3 = capacitySamples.reduce((sum, sample) => sum + packageVolumeM3(sample), 0)
  const formatVolumeM3 = (value: number) => value.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const formatRackDimensions = (dimensions: [number, number, number]) => dimensions.map(value => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })).join(' × ')
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
  const goodsMaterial = goodsItems.map(item => catalogCategoryFor(item.category)?.custom || item.category === 'OTHER' ? item.customMaterial : item.materialName).filter(Boolean).join(', ')
  const hasOtherGoods = goodsItems.some(item => catalogCategoryFor(item.category)?.custom || item.category === 'OTHER')
  const checkInWindow = useMemo(
    () => plannedCheckInWindow(bookingStartedAt, hasOtherGoods),
    [bookingStartedAt, hasOtherGoods],
  )
  const earliestCheckInDate = policyDateInput(checkInWindow.availableAt)
  const earliestCheckInTime = policyTimeInput(checkInWindow.availableAt)
  const latestCheckInDate = policyDateInput(checkInWindow.deadlineAt)
  const latestCheckInTime = policyTimeInput(checkInWindow.deadlineAt)
  const previousReviewRequirement = useRef(hasOtherGoods)
  const previousBookingStart = useRef<number | null>(null)

  const apiGoodsItems = useMemo<GoodsItemInput[]>(() => goodsItems.map(item => {
    const quantity = Math.max(1, Number(item.quantity) || packageCountNumber || 1)
    const selectedGoodsCategory = catalogCategoryFor(item.category)
    const selectedGoodsMaterial = selectedGoodsCategory?.materials.find(material => material.label === item.materialName)
    return {
      catalogCategoryId: selectedGoodsCategory?.id,
      catalogMaterialId: selectedGoodsMaterial?.id || null,
      categoryCode: selectedGoodsCategory?.code || item.category || null,
      categoryName: selectedGoodsCategory?.label || null,
      materialCode: selectedGoodsMaterial?.code || null,
      category: selectedGoodsCategory?.reservationCategory || item.category as GoodsCategory,
      customGoodsName: item.customGoodsName.trim() || null,
      materialName: item.materialName.trim() || null,
      customMaterial: item.customMaterial.trim() || null,
      description: item.description.trim() || null,
      customerNote: item.customerNote.trim() || null,
      quantity,
      lengthCm: Number(item.lengthCm) || cargoLengthNumber,
      widthCm: Number(item.widthCm) || cargoWidthNumber,
      heightCm: Number(item.heightCm) || cargoHeightNumber,
      weightPerItemKg: Number(item.weightKg) || Math.max(0.01, goodsWeightNumber / quantity),
      fragile: item.fragile ? item.fragile === 'yes' : item.materialType === 'FRAGILE',
    }
  }), [goodsItems, goodsCatalog, packageCountNumber, cargoLengthNumber, cargoWidthNumber, cargoHeightNumber, goodsWeightNumber])

  const recommendationInput = useMemo(() => {
    const endDate = addMonthsForPreview(earliestCheckInDate, rentalMonths)
    if (!selectedTarget || endDate === '—' || !selectedPackageId.trim()) return null
    return {
      facilityId: selectedTarget.facility.id,
      startDate: earliestCheckInDate,
      endDate,
      pricingPackageCode: selectedPackageId,
      goodsCondition,
      goodsItems: apiGoodsItems,
    }
  }, [selectedTarget, earliestCheckInDate, rentalMonths, selectedPackageId, goodsCondition, apiGoodsItems])

  useEffect(() => {
    if (!bookOpen) return
    if (previousReviewRequirement.current === hasOtherGoods && previousBookingStart.current === bookingStartedAt) return
    previousBookingStart.current = bookingStartedAt
    const selectedAt = moveInDate && bookingAppointmentTime
      ? new Date(`${moveInDate}T${bookingAppointmentTime}:00`)
      : null
    const invalid = !selectedAt || !isCheckInAppointmentAllowed(selectedAt, checkInWindow)
    if (invalid) {
      setMoveInDate(earliestCheckInDate)
      setBookingAppointmentTime(earliestCheckInTime)
      if (!previousReviewRequirement.current && hasOtherGoods) {
        setSchedulePolicyMessage(`Do hàng hóa “Khác” cần nhân viên duyệt trong tối đa 6 giờ, lịch cũ không còn hợp lệ. Hệ thống đã chuyển sang thời điểm sớm nhất ${formatPolicyDateTime(checkInWindow.availableAt)}.`)
      }
    }
    previousReviewRequirement.current = hasOtherGoods
  }, [bookOpen, hasOtherGoods, checkInWindow.availableAt, checkInWindow.deadlineAt, earliestCheckInDate, earliestCheckInTime, moveInDate, bookingAppointmentTime])

  useEffect(() => {
    if (!bookOpen || rentalMonths <= 0) return
    const endDate = addMonthsForPreview(earliestCheckInDate, rentalMonths)
    if (endDate !== '—') setAvailabilityPeriod({ startDate: earliestCheckInDate, endDate })
  }, [bookOpen, earliestCheckInDate, rentalMonths])

  useEffect(() => {
    if (!isApiAuthenticated() || !bookOpen || !selectedTarget) return
    let cancelled = false
    setRentalPackagesLoading(true)
    setReservationSubmitError(null)
    void listReservationRentalPackages(selectedTarget.facility.id, earliestCheckInDate)
      .then(packages => {
        if (cancelled) return
        const uniquePackages = uniqueRentalPackagesByDuration(packages)
        setBackendRentalPackages(uniquePackages)
        const selected = uniquePackages.find(item => item.code === selectedPackageId)
          || uniquePackages.find(item => item.rentalMonths === rentalMonths)
          || uniquePackages.find(item => item.rentalMonths === 3)
          || uniquePackages[0]
        if (selected) {
          setSelectedPackageId(selected.code)
          setRentalMonths(selected.rentalMonths)
        } else {
          setSelectedPackageId('')
          setReservationSubmitError('Cơ sở chưa có gói thuê đang hiệu lực cho ngày bắt đầu kỳ thuê.')
        }
      })
      .catch(error => {
        if (cancelled) return
        setBackendRentalPackages([])
        setSelectedPackageId('')
        setReservationSubmitError(error instanceof Error ? error.message : 'Không thể tải gói thuê từ hệ thống.')
      })
      .finally(() => { if (!cancelled) setRentalPackagesLoading(false) })
    return () => { cancelled = true }
  }, [bookOpen, earliestCheckInDate, selectedTarget?.facility.id, selectedTarget?.unitType.id])

  // Support
  const [supportChatbotOpen, setSupportChatbotOpen] = useState(false)
  const [supportWidgetRequest, setSupportWidgetRequest] = useState<{ request: number; ticketId?: string } | undefined>(() =>
    isApiAuthenticated() && new URLSearchParams(window.location.search).get('page') === 'support' ? { request: 1 } : undefined)
  const openSupportWidget = (ticketId?: string) => {
    if (isApiAuthenticated()) setSupportWidgetRequest(previous => ({ request: (previous?.request ?? 0) + 1, ticketId }))
    else setSupportChatbotOpen(true)
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('page') !== 'support') return
    const url = new URL(window.location.href)
    url.searchParams.set('page', 'overview')
    window.history.replaceState(null, '', url)
    setPage('overview')
    if (!isApiAuthenticated()) setSupportChatbotOpen(true)
  }, [])
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

  useEffect(() => {
    let cancelled = false
    let initialLoad = true
    const loadCatalog = async () => {
      if (initialLoad) {
        setCatalogLoading(true)
        setCatalogError(null)
      }
      try {
        const [facilityPage, loadedGoodsCatalog] = await Promise.all([listCustomerFacilities(), getGoodsCatalog()])
        const activeFacilities = facilityPage.data
        const unitTypePages = await Promise.all(
          activeFacilities.map(facility => listCustomerUnitTypes(facility.id)),
        )
        if (cancelled) return
        setBackendFacilities(activeFacilities)
        setBackendUnitTypes(unitTypePages.flatMap(result => result.data))
        setGoodsCatalog(loadedGoodsCatalog)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Không thể tải danh mục kho. Vui lòng thử lại.'
        if (initialLoad) {
          setCatalogError(message)
          showToast(message)
        }
      } finally {
        if (!cancelled && initialLoad) setCatalogLoading(false)
        initialLoad = false
      }
    }
    void loadCatalog()
    const timer = window.setInterval(() => void loadCatalog(), 10_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])

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
  }

  const unitTypeLabel = storageTypeLabelVi

  // Data scoping for Customer (P1.4)
  const myHolds = holds.filter(h => h.customerId === user.id || h.customerName === user.name || h.customerEmail === user.email)
  const visibleMyHolds = myHolds.filter(hold => !hold.customerArchivedAt && !['completed', 'COMPLETED'].includes(hold.status))
  const myRentals = rentals.filter(r => r.customerId === user.id || r.customerName === user.name || r.customerEmail === user.email)
  const visibleMyRentals = myRentals.filter(rental => !rental.customerArchivedAt && rental.status !== 'completed')
  const visibleMyContracts = contracts.filter(contract => !contract.customerArchivedAt && (
    contract.customerId === user.id ||
    myHolds.some(hold => hold.id === contract.reservationId) ||
    myRentals.some(rental => rental.holdId === contract.reservationId || rental.contractId === contract.id)
  ))
  const sortedMyContracts = visibleMyContracts.filter(contract => {
    const rental = myRentals.find(item => item.contractId === contract.id || item.holdId === contract.reservationId)
    return contractFilter === 'all' || (contractFilter === 'completed' ? rental?.status === 'completed' : rental?.status !== 'completed')
  }).sort((left, right) => new Date(left.endDate).getTime() - new Date(right.endDate).getTime())
  const myReturns = returns.filter(r => r.customerId === user.id || r.customerEmail === user.email)
  const myTickets = tickets.filter(t => t.email === user.email || t.customer === user.name)
  const myRentalIds = new Set(myRentals.map(r => r.id))
  const visibleMyRentalIds = new Set(visibleMyRentals.map(r => r.id))
  const myHoldIds = new Set(myHolds.map(h => h.id))
  const myPayments = payments.filter(p => myHoldIds.has(p.reservationId) || Boolean(p.rentalId && myRentalIds.has(p.rentalId)))
  const activeRentals = visibleMyRentals.filter(r => ['setup', 'active', 'return_requested'].includes(r.status))
  const rentalDeadlineInfo = (rental: (typeof rentals)[number]) => {
    const start = parseCustomerDate(rental.startDate)
    const end = parseCustomerDate(rental.endDate)
    if (!end) return { state: 'normal' as const, remainingDays: Number.POSITIVE_INFINITY }
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const remainingDays = Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
    const totalDays = start ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000)) : 32
    const reminderWindow = totalDays > 31 ? 30 : 7
    if (remainingDays < 0) return { state: 'overdue' as const, remainingDays }
    if (remainingDays <= reminderWindow) return { state: 'upcoming' as const, remainingDays }
    return { state: 'normal' as const, remainingDays }
  }
  const filteredAndSortedRentals = visibleMyRentals
    .filter(rental => rentalFacilityFilter === 'all' || rental.facilityId === rentalFacilityFilter)
    .filter(rental => rentalTypeFilter === 'all' || storageSizeCode(units.find(unit => unit.id === rental.unitId || unit.code === rental.unitId)?.type || rental.unitType) === rentalTypeFilter)
    .filter(rental => rentalDeadlineFilter === 'all' || rentalDeadlineInfo(rental).state === rentalDeadlineFilter)
    .sort((left, right) => {
      const leftInfo = rentalDeadlineInfo(left)
      const rightInfo = rentalDeadlineInfo(right)
      const priority = { overdue: 0, upcoming: 1, normal: 2 }
      const priorityDifference = priority[leftInfo.state] - priority[rightInfo.state]
      if (priorityDifference !== 0) return priorityDifference
      return leftInfo.remainingDays - rightInfo.remainingDays
    })
  const filteredReservationHolds = visibleMyHolds.filter(hold => {
    if (reservationFacilityFilter !== 'all' && hold.facilityId !== reservationFacilityFilter) return false
    const assignedUnit = units.find(unit => unit.id === hold.assignedUnitId || unit.code === hold.assignedUnitId)
    const holdSize = storageSizeCode(assignedUnit?.type || hold.unitTypeName || hold.unitId)
    return reservationSizeFilter === 'all' || holdSize === reservationSizeFilter
  })
  const pendingHandoverReservations = backendReservations.filter(reservation => reservation.status !== 'COMPLETED')
  const filteredBackendReservations = pendingHandoverReservations.filter(reservation => {
    if (reservationFacilityFilter !== 'all' && reservation.facilityId !== reservationFacilityFilter) return false
    const unitType = backendUnitTypes.find(item => item.id === reservation.unitTypeId)
    return reservationSizeFilter === 'all' || storageSizeCode(unitType?.name || unitType?.code || '') === reservationSizeFilter
  })

  const activeUnassignedCapacityHolds = holds.filter(hold => {
    if (hold.assignedUnitId || ['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status)) return false
    if (hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING') return true
    if (['awaiting_email', 'awaiting_review', 'awaiting_payment'].includes(hold.status)) return Boolean(hold.paymentExpiresAt && new Date(hold.paymentExpiresAt).getTime() > now)
    return hold.status === 'DEPOSIT_PAID'
  })
  const effectiveAvailableCount = (facilityId: string, unitTypeName?: string) => {
    if (backendUnitTypes.length) {
      return backendUnitTypes
        .filter(unitType => unitType.facilityId === facilityId)
        .filter(unitType => !unitTypeName || unitTypeMatches(unitType.name, unitTypeName) || unitTypeMatches(unitType.code, unitTypeName))
        .reduce((total, unitType) => total + (availabilityByUnitType[unitType.id] ?? unitType.availableCount ?? 0), 0)
    }
    const facCode = facilities.find(f => f.id === facilityId)?.code
    const physical = units.filter(unit => (unit.facilityId === facilityId || (facCode && unit.facilityId === facCode)) && unit.status === 'available' && !rentals.some(rental => rental.unitId === unit.id && ['setup', 'active', 'return_requested', 'return_inspection', 'closing'].includes(rental.status)) && (!unitTypeName || unitTypeMatches(unit.type, unitTypeName) || (unit.size && unitTypeMatches(unit.size, unitTypeName)) || (unit.sizeCode && unitTypeMatches(unit.sizeCode, unitTypeName)))).length
    const capacityHeld = activeUnassignedCapacityHolds.filter(hold => (hold.facilityId === facilityId || (facCode && hold.facilityId === facCode)) && (!unitTypeName || unitTypeMatches(hold.unitTypeName, unitTypeName))).length
    return Math.max(0, physical - capacityHeld)
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
    ...backendNotifications.map(notification => ({
      id: `api-notification-${notification.id}`,
      date: notification.createdAt,
      title: notification.title,
      message: notification.content,
      page: notification.title === 'Biên bản bàn giao đang chờ xác nhận' ? 'reservations'
        : notification.type === 'RENEWAL' || notification.type === 'OVERDUE' ? 'rental-records'
        : notification.type === 'RETURN' || notification.type === 'CHECKIN' ? 'rental-records'
        : notification.type === 'SUPPORT' ? 'support'
          : notification.type === 'SYSTEM' ? 'overview' : 'reservations',
      targetId: notification.relatedEntityId || undefined,
      isRead: notification.isRead,
    })),
    ...(isApiAuthenticated() ? [] : myHolds.filter(hold => hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING').map(hold => ({ id: `goods-review-submitted-${hold.id}`, date: hold.goodsReviewSubmittedAt || hold.createdAt, title: 'Yêu cầu hàng hóa đã được gửi', message: `${hold.id} · Kho đang được giữ · Chưa yêu cầu tiền cọc`, page: 'reservations', targetId: hold.id }))),
    ...(isApiAuthenticated() ? [] : myHolds.filter(hold => hold.goodsReviewStatus === 'APPROVED').map(hold => ({ id: `goods-review-approved-${hold.id}`, date: hold.reviewedAt || hold.createdAt, title: 'Hàng hóa đã được chấp thuận', message: `${hold.id} · Vui lòng thanh toán tiền cọc để hoàn tất đặt kho`, page: 'reservations', targetId: hold.id }))),
    ...(isApiAuthenticated() ? [] : myHolds.filter(hold => hold.goodsReviewStatus === 'REJECTED').map(hold => ({ id: `goods-review-rejected-${hold.id}`, date: hold.reviewedAt || hold.createdAt, title: 'Hàng hóa chưa được chấp thuận', message: `${hold.id} · Lý do: ${hold.staffReviewNotes || 'Hàng hóa chưa phù hợp điều kiện lưu trữ'}`, page: 'reservations', targetId: hold.id }))),
    ...(isApiAuthenticated() ? [] : contractExpiryNotifications),
    ...(isApiAuthenticated() ? [] : visibleMyHolds.filter(h => h.assignedUnitId).map(h => {
      const assignmentActivity = activities.find(activity => activity.action === 'UNIT_ASSIGNED' && activity.entityId === h.id)
      return { id: `unit-${h.id}-${h.assignedUnitId}`, date: h.unitAssignedAt || assignmentActivity?.timestamp || h.reviewedAt || h.createdAt, title: 'Gian kho đã được xác định', message: `${h.assignedUnitId} · ${h.facilityName}`, page: 'reservations', targetId: h.id }
    })),
    ...(isApiAuthenticated() ? [] : visibleMyRentals.filter(rental => rental.status !== 'completed').map(rental => {
      const hold = myHolds.find(item => item.id === rental.holdId)
      const checkin = checkins.find(item => item.holdId === rental.holdId)
      const confirmed = Boolean(rental.receiptConfirmedAt)
      return { id: `receipt-${rental.id}-${confirmed ? rental.receiptConfirmedAt : 'pending'}`, date: rental.receiptConfirmedAt || hold?.checkedInAt || checkin?.completedAt || rental.startDate, title: confirmed ? ('Đã xác nhận nhận kho') : ('Vui lòng xác nhận đã nhận kho'), message: `${rental.unitId} · ${rental.facilityName}`, page: 'rental-records', targetId: rental.id }
    })),
    ...(isApiAuthenticated() ? [] : renewals).filter(r => r.customerId === user.id && r.status !== 'pending').map(r => {
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
    ...(isApiAuthenticated() ? [] : myReturns.filter(r => visibleMyRentalIds.has(r.rentalId) && ['awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'].includes(r.status)).map(r => ({ id: `return-${r.id}-${r.status}-${r.completedAt || r.customerConfirmedAt || r.inspectedAt || r.requestedAt}`, date: r.completedAt || r.customerConfirmedAt || r.inspectedAt || r.requestedAt, title: r.status === 'awaiting_customer_confirmation' ? ('Cần xác nhận quyết toán') : r.status === 'payment_due' ? ('Cần thanh toán phần quyết toán còn thiếu') : r.status === 'refund_pending' ? ('Hồ sơ thuê hết hiệu lực · Chờ hoàn cọc') : r.status === 'completed' ? ('Hồ sơ thuê đã hết hiệu lực') : ('Đang xem xét khiếu nại'), message: `${r.unitId} · ${r.status === 'payment_due' ? ('Cần đóng thêm') : ('Hoàn cọc dự kiến')} ${formatVnd(r.status === 'payment_due' ? (r.amountDueFromCustomer ?? 0) : r.netRefundAmount)}`, page: 'rental-records', targetId: r.rentalId }))),
    ...(isApiAuthenticated() ? [] : myTickets).flatMap(ticket => {
      const latestStaffMessage = [...ticket.messages].reverse().find(message => message.role === 'staff')
      const notificationTitle = ticket.status === 'resolved'
        ? ('Yêu cầu đã được xử lý thành công')
        : ('Yêu cầu đang được nhân viên xử lý')
      return latestStaffMessage ? [{ id: `ticket-${ticket.id}-${latestStaffMessage.id}-${ticket.status}`, date: latestStaffMessage.time || ticket.created, title: notificationTitle, message: `${ticket.id} · ${ticket.subject}`, page: 'support', targetId: ticket.id }] : []
    })
  ].sort((a, b) => notificationTimestamp(b.date) - notificationTimestamp(a.date))

  useEffect(() => {
    if (isApiAuthenticated()) return
    myHolds.forEach(hold => {
      const emailExpired = hold.status === 'awaiting_email' && hold.emailVerification && new Date(hold.emailVerification.expiresAt).getTime() <= now
      const reviewExpired = hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING' && hold.goodsReviewDueAt && new Date(hold.goodsReviewDueAt).getTime() <= now
      const paymentExpired = hold.status === 'awaiting_payment' && hold.paymentExpiresAt && new Date(hold.paymentExpiresAt).getTime() <= now
      if (emailExpired || reviewExpired || paymentExpired) {
        expireReservation(hold.id, 'PAYMENT_EXPIRED')
      }
    })
  }, [now, myHolds, expireReservation])

  useEffect(() => {
    if (isApiAuthenticated()) return
    visibleMyHolds
      .filter(hold => ['CANCELLED', 'EXPIRED'].includes(hold.status))
      .forEach(hold => {
        try { archiveReservationHistory(hold.id, user) } catch { /* already archived */ }
      })
  }, [archiveReservationHistory, user, visibleMyHolds])

  useEffect(() => {
    if (isApiAuthenticated()) return
    visibleMyRentals
      .filter(rental => rental.status === 'completed' && myReturns.some(returnCase => returnCase.rentalId === rental.id && returnCase.status === 'completed'))
      .forEach(rental => {
        try { archiveRentalHistory(rental.id, user) } catch { /* already archived or still reconciling */ }
      })
  }, [archiveRentalHistory, myReturns, user, visibleMyRentals])

  const selectedFacility = facilities.find(facility => facility.id === selectedFacilityId) ?? null
  const availableUnits = units.filter(unit =>
    (!selectedFacility || unit.facilityName === selectedFacility.name || unit.facilityId === selectedFacility.id || unit.facilityId === selectedFacility.code) &&
    (sizeFilter === 'All' || unit.type === sizeFilter || unit.size === sizeFilter || unit.sizeCode === sizeFilter || storageSizeCode(unit.type) === sizeFilter)
  )
  const matchingFacilities = facilities.filter(facility => {
    const display = CUSTOMER_FACILITY_DISPLAY[facility.id]
    return `${display?.code ?? facility.id} ${display?.name ?? facility.name} ${display?.address ?? facility.address} ${facility.city}`
      .toLowerCase()
      .includes(searchFacility.toLowerCase())
  })
  const resetReservationDraft = () => {
    setBookingReview(false)
    setServerQuote(null)
    setServerCompatibility(null)
    setServerRecommendation(null)
    setRecommendationLoading(false)
    setRecommendationError(null)
    reservationIdempotencyKey.current = null
    setValidationViolation(null)
    setBookingErrors({})
  }

  const navigateTo = (nextPage: string, options?: { facilityId?: string | null }) => {
    if (nextPage === 'support') { openSupportWidget(); return }
    setPreviousPage(page)
    if (nextPage === 'browse-units') {
      setSelectedFacilityId(options?.facilityId ?? null)
    }
    setPage(nextPage)
  }

  const handleLayoutNavigate = (nextPage: string) => {
    if (nextPage === 'support') { openSupportWidget(); return }
    notificationRevealTimers.current.forEach(timer => window.clearTimeout(timer))
    notificationRevealTimers.current = []
    setFocusedNotificationTarget(null)
    setReceiptRentalTarget(undefined)
    if (nextPage === 'rental-records') setRentalMenuVisit(visit => visit + 1)
    if (nextPage === page) return
    if (bookOpen) {
      resetReservationDraft()
      setBookOpen(false)
    }
    setPreviousPage(page)
    if (nextPage === 'browse-units') setSelectedFacilityId(null)
    setPage(nextPage)
  }

  const handleStartReservation = (facility: Facility, unitType: UnitType, exactUnit?: StorageUnit, initialStep: 1 | 2 = 1) => {
    const hasAvailablePhysicalUnit = effectiveAvailableCount(facility.id, unitType.name) > 0
    if (!hasAvailablePhysicalUnit) {
      showToast('Cơ sở hiện không còn gian kho trống cho loại này trong thời gian đã chọn.')
      return
    }
    const startedAt = Date.now()
    const suggestedCheckIn = plannedCheckInWindow(startedAt, false).availableAt
    setBookingStartedAt(startedAt)
    setMoveInDate(policyDateInput(suggestedCheckIn))
    setBookingAppointmentTime(policyTimeInput(suggestedCheckIn))
    setSchedulePolicyMessage(null)
    setBookingStep(initialStep)
    setBookingReview(false)
    setServerQuote(null)
    setServerCompatibility(null)
    setServerRecommendation(null)
    setRecommendationLoading(false)
    setRecommendationError(null)
    reservationIdempotencyKey.current = crypto.randomUUID()
    setBookingErrors({})
    setSelectedTarget({ facility, unitType })
    const sizeCode = storageSizeCode(unitType.name)
    const backendSpec = backendUnitTypes.find(item => item.id === unitType.id)
    const customSpec = facility.unitCustomSpecs?.find(s => s.sizeCode === sizeCode)
    const unitRentalPackages = isApiAuthenticated()
      ? []
      : exactUnit?.rentalPackages || customSpec?.rentalPackages || generateDefaultRentalPackages(facility.id, sizeCode, unitType.monthlyPrice)
    if (isApiAuthenticated()) {
      const activeBackendPkg = (selectedPackageId ? backendRentalPackages.find(p => p.code === selectedPackageId) : undefined)
        || backendRentalPackages.find(p => p.rentalMonths === rentalMonths)
        || backendRentalPackages.find(p => p.rentalMonths === 3)
        || backendRentalPackages[0]
      if (activeBackendPkg) {
        setSelectedPackageId(activeBackendPkg.code)
        setRentalMonths(activeBackendPkg.rentalMonths)
      } else {
        setSelectedPackageId('')
        setRentalMonths(3)
      }
    } else {
      const activePackages = unitRentalPackages.filter(p => p.status === 'active')
      const initialPkg = activePackages.find(p => p.months === 3) || activePackages[0]
      if (initialPkg) {
        setSelectedPackageId(initialPkg.id)
        setRentalMonths(initialPkg.months)
      } else {
        setSelectedPackageId('')
        setRentalMonths(3)
      }
    }
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
      doorDimensions: isApiAuthenticated() ? { widthM: 0, heightM: 0 } : { widthM: 1.1, heightM: 2.2 },
      volumeM3: unitType.volumeM3,
      maxLoadKg: unitType.maxLoadKg,
      allowedGoods: isApiAuthenticated() ? [] : ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
      prohibitedGoods: isApiAuthenticated() ? [] : ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
      price: unitType.monthlyPrice,
      deposit: isApiAuthenticated() ? backendSpec?.securityDepositAmount ?? 0 : unitType.monthlyPrice,
      climate: isApiAuthenticated() ? facility.climate : true,
      status: 'available',
      rentalPackages: unitRentalPackages,
      reservedPeriods: [],
      version: 1
    }
    setSelectedUnit(repUnit)
    setDetailOpen(false)
    setBookOpen(true)
  }

  const handleOpenSpecs = (facility: Facility, unitType: UnitType, availableCount: number, exactUnit?: StorageUnit) => {
    setSelectedTarget({ facility, unitType })
    const sizeCode = storageSizeCode(unitType.name)
    const backendSpec = backendUnitTypes.find(item => item.id === unitType.id)
    const customSpec = facility.unitCustomSpecs?.find(s => s.sizeCode === sizeCode)
    const unitRentalPackages = isApiAuthenticated()
      ? []
      : exactUnit?.rentalPackages || customSpec?.rentalPackages || generateDefaultRentalPackages(facility.id, sizeCode, unitType.monthlyPrice)
    const repUnit: StorageUnit = exactUnit ?? {
      id: '',
      code: `${CUSTOMER_FACILITY_DISPLAY[facility.id]?.code ?? facility.code ?? facility.id.toUpperCase()}-${storageSizeCode(unitType.name)}`,
      facilityId: facility.id,
      facilityName: facility.name,
      floor: 1,
      zone: 'Tiêu chuẩn',
      type: unitType.name.split(' ')[0] as any,
      areaM2: unitType.areaM2,
      dimensions: { lengthM: unitType.lengthM, widthM: unitType.widthM, heightM: unitType.heightM },
      doorDimensions: isApiAuthenticated() ? { widthM: 0, heightM: 0 } : { widthM: 1.1, heightM: 2.2 },
      volumeM3: unitType.volumeM3,
      maxLoadKg: unitType.maxLoadKg,
      allowedGoods: isApiAuthenticated() ? [] : ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
      prohibitedGoods: isApiAuthenticated() ? [] : ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
      price: unitType.monthlyPrice,
      deposit: isApiAuthenticated() ? backendSpec?.securityDepositAmount ?? 0 : unitType.monthlyPrice,
      climate: isApiAuthenticated() ? facility.climate : true,
      status: availableCount > 0 ? 'available' : 'reserved',
      rentalPackages: unitRentalPackages,
      reservedPeriods: [],
      version: 1
    }
    setSelectedUnit(repUnit)
    setDetailOpen(true)
  }

  // Quote preview for currently open booking modal
  const currentQuote = serverQuote
    ? {
        quoteId: serverQuote.quoteId,
        unitId: serverQuote.unitTypeId,
        facilityId: serverQuote.facilityId,
        baseMonthlyPrice: vndToLegacyBase(serverQuote.monthlyPrice),
        depositAmount: vndToLegacyBase(serverQuote.securityDepositAmount),
        dimSurcharge: 0,
        discountAmount: vndToLegacyBase(serverQuote.discountAmount),
        totalFirstPayment: vndToLegacyBase(serverQuote.totalInitialObligation),
        dimWeightKg: 0,
        actualWeightKg: goodsWeightNumber,
        billableWeightKg: goodsWeightNumber,
        dimDivisor: 5000,
        quotedAt: serverQuote.quotedAt,
        expiresAt: serverQuote.expiresAt,
      }
    : isApiAuthenticated()
    ? null
    : selectedUnit
    ? (typeof calculateDIMAndQuote === 'function'
        ? calculateDIMAndQuote(selectedUnit, {
            lengthCm: cargoLengthNumber,
            widthCm: cargoWidthNumber,
            heightCm: cargoHeightNumber,
            weightKg: goodsWeightNumber,
            packageCount: packageCountNumber,
            volumeM3: goodsVolumeM3,
          })
        : {
            quoteId: `QUO-${Date.now().toString().slice(-4)}`,
            unitId: selectedUnit.id,
            facilityId: selectedUnit.facilityId,
            baseMonthlyPrice: selectedUnit.price,
            depositAmount: selectedUnit.deposit || selectedUnit.price,
            dimSurcharge: 0,
            totalFirstPayment: (selectedUnit.price * 2),
            dimWeightKg: dimensionalWeightKg(capacitySamples),
            actualWeightKg: goodsWeightNumber,
            billableWeightKg: Math.max(goodsWeightNumber, dimensionalWeightKg(capacitySamples)),
            dimDivisor: 5000,
            quotedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
    : null

  const selectedSizeCode = storageSizeCode(selectedTarget?.unitType.name || selectedUnit?.type) as CustomerCatalogUnit['sizeCode']
  const selectedCatalogUnit = selectedUnit ? CUSTOMER_CATALOG_UNITS.find(unit =>
    unit.sizeCode === selectedSizeCode && (!selectedTarget || unit.facilityId === selectedTarget.facility.id)) : undefined
  const selectedBackendUnitType = backendUnitTypes.find(item => item.id === selectedTarget?.unitType.id)
  const bookingCategories = (goodsCatalog?.categories || []).filter(category =>
    !selectedBackendUnitType?.acceptedGoodsCategoryIds?.length || selectedBackendUnitType.acceptedGoodsCategoryIds.includes(category.id))
  const bookingCategoryOptions = bookingCategories.map(category => [category.code, category.label] as const)
  const bookingMaterials = (categoryCode: string) => {
    const category = bookingCategories.find(item => item.code === categoryCode)
    if (!category) return []
    return category.materials.filter(material =>
      !selectedBackendUnitType?.acceptedGoodsMaterialIds?.length || selectedBackendUnitType.acceptedGoodsMaterialIds.includes(material.id))
  }
  const selectedRackCount = selectedBackendUnitType?.rackCount ?? selectedCatalogUnit?.rackCount ?? 0
  const selectedRackDimensions: [number, number, number] = selectedBackendUnitType
    ? [selectedBackendUnitType.rackLengthM, selectedBackendUnitType.rackWidthM, selectedBackendUnitType.rackHeightM]
    : isApiAuthenticated() ? [0, 0, 0] : [4, 2, 4.5]
  const selectedUsableRackVolumeM3 = usableRackVolumeM3(selectedRackDimensions) * selectedRackCount
  const allPackageSamplesValid = capacitySamples.length > 0 && capacitySamples.every(isPackageSampleValid)
  const recommendationFormReady = allPackageSamplesValid
    && Boolean(goodsCondition.trim())
    && goodsItems.every(item => {
      const category = catalogCategoryFor(item.category)
      return Boolean(item.category && item.description.trim()
        && (category?.custom ? item.customGoodsName.trim() && item.customMaterial.trim() : item.materialName.trim()))
    })
  useEffect(() => {
    if (!isApiAuthenticated() || !bookOpen || !selectedTarget || !recommendationFormReady || !recommendationInput) {
      setRecommendationLoading(false)
      setServerRecommendation(null)
      setRecommendationError(null)
      return
    }
    let cancelled = false
    setRecommendationLoading(true)
    setRecommendationError(null)
    const timer = window.setTimeout(() => {
      void recommendReservationUnitType(recommendationInput)
        .then(result => {
          if (cancelled) return
          setServerRecommendation(result)
          setRecommendationError(null)
        })
        .catch(error => {
          if (cancelled) return
          setServerRecommendation(null)
          setRecommendationError(error instanceof Error && error.message.trim()
            ? error.message
            : 'Không thể kiểm tra kho phù hợp lúc này.')
        })
        .finally(() => { if (!cancelled) setRecommendationLoading(false) })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [bookOpen, selectedTarget?.facility.id, selectedTarget?.unitType.id, recommendationFormReady, recommendationInput, recommendationRetry])
  const packageCapacityResults = allPackageSamplesValid ? capacitySamples.map(sample => {
    const capacityPerFrame = selectedUnit ? packageCapacityPerRack(sample, selectedRackDimensions) : 0
    return {
      ...sample,
      capacityPerFrame,
      canFitFrame: capacityPerFrame > 0,
    }
  }) : []
  const hasUnplaceablePackage = packageCapacityResults.some(sample => !sample.canFitFrame)
  const totalFramesRequired = hasUnplaceablePackage
    ? Number.POSITIVE_INFINITY
    : requiredRackCountForSamples(capacitySamples, selectedRackDimensions)
  const localWarehouseRecommendation = allPackageSamplesValid && !isApiAuthenticated()
    ? backendUnitTypes
      .filter(candidate => !selectedTarget || candidate.facilityId === selectedTarget.facility.id)
      .filter(candidate => (availabilityByUnitType[candidate.id] ?? candidate.availableCount ?? 0) > 0)
      .sort((left, right) => left.volumeM3 - right.volumeM3)
      .find(candidate => {
        const candidateRackDimensions: [number, number, number] = [candidate.rackLengthM, candidate.rackWidthM, candidate.rackHeightM]
        const everyPackageFits = capacitySamples.every(sample => packageCapacityPerRack(sample, candidateRackDimensions) > 0)
        const framesRequired = everyPackageFits
          ? requiredRackCountForSamples(capacitySamples, candidateRackDimensions)
          : Number.POSITIVE_INFINITY
        return framesRequired <= candidate.rackCount && goodsWeightNumber <= candidate.maxLoadKg
      })
    : undefined
  const serverRecommendedUnitType = serverRecommendation?.recommendedUnitTypeId
    ? backendUnitTypes.find(candidate => candidate.id === serverRecommendation.recommendedUnitTypeId)
    : undefined
  const warehouseRecommendation = allPackageSamplesValid
    ? isApiAuthenticated() ? serverRecommendedUnitType : localWarehouseRecommendation
    : undefined
  const recommendedUnitType = warehouseRecommendation
    ? unitTypes.find(candidate => candidate.id === warehouseRecommendation.id)
    : undefined
  const smallerWarehouseRecommendation = selectedTarget && warehouseRecommendation && recommendedUnitType
    && warehouseRecommendation.id !== selectedTarget.unitType.id
    && warehouseRecommendation.volumeM3 < selectedTarget.unitType.volumeM3
    ? recommendedUnitType
    : undefined
  const largerWarehouseRecommendation = selectedTarget && warehouseRecommendation && recommendedUnitType
    && warehouseRecommendation.id !== selectedTarget.unitType.id
    && warehouseRecommendation.volumeM3 > selectedTarget.unitType.volumeM3
    ? recommendedUnitType
    : undefined
  const availableLargerUnitTypes = selectedTarget
    ? backendUnitTypes
      .filter(candidate => candidate.facilityId === selectedTarget.facility.id)
      .filter(candidate => candidate.volumeM3 > selectedTarget.unitType.volumeM3)
      .filter(candidate => (availabilityByUnitType[candidate.id] ?? candidate.availableCount ?? 0) > 0)
      .sort((left, right) => right.volumeM3 - left.volumeM3)
    : []
  const largestAvailableLargerUnitType = availableLargerUnitTypes[0]
  const largestAvailableLargerUnitUsableVolumeM3 = largestAvailableLargerUnitType
    ? largestAvailableLargerUnitType.rackLengthM * largestAvailableLargerUnitType.rackWidthM * largestAvailableLargerUnitType.rackHeightM * 0.8 * largestAvailableLargerUnitType.rackCount
    : 0
  const noValidLargerUnitAvailable = Boolean(
    isApiAuthenticated()
      && allPackageSamplesValid
      && recommendationFormReady
      && !recommendationError
      && !warehouseRecommendation
      && largestAvailableLargerUnitType
      && (goodsWeightNumber > largestAvailableLargerUnitType.maxLoadKg || goodsVolumeM3 > largestAvailableLargerUnitUsableVolumeM3),
  )
  const selectedUnitTypeIncompatible = Boolean(
    isApiAuthenticated()
      && selectedTarget?.unitType.id
      && serverRecommendation?.incompatibleUnitTypeIds.includes(selectedTarget.unitType.id),
  )
  const recommendationNeedsReview = Boolean(
    isApiAuthenticated() && serverRecommendation?.result === 'REVIEW_REQUIRED',
  )
  const capacityStatus: CapacityStatus = !allPackageSamplesValid ? 'invalid' : warehouseRecommendation ? 'fits' : 'not-fit'
  const packagesFitSelectedUnit = capacityStatus === 'fits' && packageCapacityResults.every(sample => sample.capacityPerFrame > 0) && totalFramesRequired <= selectedRackCount
  const selectedUnitCapacityFits = Boolean(selectedUnit && allPackageSamplesValid
    && !hasUnplaceablePackage
    && totalFramesRequired <= selectedRackCount
    && goodsWeightNumber <= selectedUnit.maxLoadKg)
  const selectedUnitNeedsAlternative = allPackageSamplesValid && (!selectedUnitCapacityFits || selectedUnitTypeIncompatible)

  // Active rental packages for the selected unit
  const selectedUnitActivePackages = useMemo(() => {
    if (!selectedUnit || isApiAuthenticated()) return []
    const fac = facilities.find(f => f.id === selectedUnit.facilityId || f.code === selectedUnit.facilityId)
    const customSpec = fac?.unitCustomSpecs?.find(s => s.sizeCode === selectedSizeCode)
    const packages = resolveRentalPackagesForUnit({
      rentalPackages: selectedUnit.rentalPackages || customSpec?.rentalPackages,
      monthlyPrice: selectedUnit.price,
      sizeCode: selectedSizeCode,
      facilityId: selectedUnit.facilityId
    })
    return packages.filter(p => p.status === 'active')
  }, [selectedUnit, facilities, selectedSizeCode])

  // Selected package for quote calculation
  const selectedActivePackage = useMemo(() => {
    if (selectedPackageId) {
      const match = selectedUnitActivePackages.find(p => p.id === selectedPackageId)
      if (match) return match
    }
    return selectedUnitActivePackages.find(p => p.months === rentalMonths)
  }, [selectedPackageId, selectedUnitActivePackages, rentalMonths])

  const selectedBackendRentalPackage = useMemo(() => {
    if (!backendRentalPackages.length) return undefined
    if (selectedPackageId) {
      const match = backendRentalPackages.find(item => item.code === selectedPackageId)
      if (match) return match
    }
    return (
      backendRentalPackages.find(item => item.rentalMonths === rentalMonths) ||
      backendRentalPackages.find(item => item.rentalMonths === 3) ||
      backendRentalPackages[0]
    )
  }, [backendRentalPackages, selectedPackageId, rentalMonths])

  useEffect(() => {
    if (isApiAuthenticated() && selectedBackendRentalPackage && selectedPackageId !== selectedBackendRentalPackage.code) {
      setSelectedPackageId(selectedBackendRentalPackage.code)
      setRentalMonths(selectedBackendRentalPackage.rentalMonths)
    }
  }, [selectedBackendRentalPackage, selectedPackageId])

  const discountRate = selectedActivePackage
    ? (selectedActivePackage.discountPercent ?? 0) / 100
    : rentalDiscountRate(rentalMonths, selectedUnitActivePackages)

  const grossTermValue = currentQuote ? currentQuote.baseMonthlyPrice * rentalMonths : 0
  const promotionDiscount = selectedActivePackage
    ? Math.max(0, grossTermValue - selectedActivePackage.packagePrice)
    : Math.round(grossTermValue * discountRate * 100) / 100

  // Facility policies and discounts for an authenticated booking are already
  // included in the server quote. The Customer FE must not recalculate them.
  const evaluatedPolicyBenefits: Array<{
    policy: { id: string; name: string; value: string }
    isDiscount: boolean
    discountAmount: number
    descriptionVi: string
  }> = []
  const facilityPolicyDiscount = 0

  const totalCombinedDiscount = Math.min(grossTermValue, Math.round((promotionDiscount + facilityPolicyDiscount) * 100) / 100)

  const handleNotificationClick = (notification: LayoutNotification) => {
    setReceiptRentalTarget(undefined)
    if (notification.id.startsWith('api-notification-')) {
      const notificationId = notification.id.slice('api-notification-'.length)
      void markNotificationRead(notificationId).then(updated => {
        setBackendNotifications(current => current.map(item => item.id === updated.id ? updated : item))
      }).catch(() => undefined)
    }
    if (notification.page === 'support') { openSupportWidget(notification.targetId); return }
    navigateTo(notification.page)
    if (notification.page === 'reservations') {
      setReservationFacilityFilter('all')
      setReservationSizeFilter('all')
    }
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
        || document.getElementById(`customer-reservation-${targetId}`)
        || document.getElementById(`rental-api-record-${targetId}`)
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
    const requestedAt = moveInDate && bookingAppointmentTime
      ? new Date(`${moveInDate}T${bookingAppointmentTime}:00`)
      : null
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(moveInDate)
      ? new Date(`${moveInDate}T00:00:00`)
      : null

    if (!isIdentityDocumentFormatValid(customerIdCard)) errors.identity = 'CCCD/Hộ chiếu phải có 9–30 ký tự hợp lệ.'
    if (!isVietnamesePhone(customerPhone)) errors.phone = VIETNAMESE_PHONE_ERROR_MESSAGE
    if (!customerAddress.trim()) errors.address = 'Vui lòng nhập địa chỉ.'
    goodsItems.forEach((item, index) => {
      const selectedGoodsCategory = catalogCategoryFor(item.category)
      const isFreeformGoods = selectedGoodsCategory?.custom === true
      if (!item.category) errors[`goodsCategory-${item.id}`] = `Dòng hàng hóa ${index + 1}: Vui lòng chọn loại hàng hóa.`
      if (item.category && !isFreeformGoods && !item.materialType) errors[`goodsMaterial-${item.id}`] = `Dòng hàng hóa ${index + 1}: Vui lòng chọn chất liệu chính.`
      if (!item.description.trim()) errors[`goodsDescription-${item.id}`] = 'Vui lòng nhập mô tả hàng hóa.'
      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) errors[`goodsQuantity-${item.id}`] = 'Số lượng phải là số nguyên lớn hơn 0.'
      if (parsePositiveNumber(item.lengthCm) === null) errors[`goodsLength-${item.id}`] = 'Chiều dài phải lớn hơn 0.'
      if (parsePositiveNumber(item.widthCm) === null) errors[`goodsWidth-${item.id}`] = 'Chiều rộng phải lớn hơn 0.'
      if (parsePositiveNumber(item.heightCm) === null) errors[`goodsHeight-${item.id}`] = 'Chiều cao phải lớn hơn 0.'
      if (parsePositiveNumber(item.weightKg) === null) errors[`goodsWeight-${item.id}`] = 'Cân nặng mỗi kiện phải lớn hơn 0.'
      if (!item.fragile) errors[`goodsFragile-${item.id}`] = 'Vui lòng chọn hàng có dễ vỡ hay không.'
      if (item.images.length > 10) errors[`goodsImages-${item.id}`] = 'Mỗi loại hàng hóa được tải tối đa 10 ảnh.'
      if (isFreeformGoods) {
        if (!item.customGoodsName.trim()) errors[`customGoodsName-${item.id}`] = 'Vui lòng nhập tên hàng hóa.'
        if (!item.customMaterial.trim()) errors[`customMaterial-${item.id}`] = 'Vui lòng nhập chất liệu chính.'
      }
    })
    if (!goodsCondition.trim()) errors.condition = 'Vui lòng mô tả tình trạng đóng gói.'
    capacitySamples.forEach((sample, index) => {
      if (isPackageSampleValid(sample) && packageCapacityPerRack(sample, selectedRackDimensions) === 0) errors[`goodsFit-${sample.id}`] = `Hàng hóa ${index + 1} không thể xếp vào khung theo bất kỳ hướng xoay nào.`
    })
    if (!isApiAuthenticated() && allPackageSamplesValid && !hasUnplaceablePackage && totalFramesRequired > selectedRackCount) errors.capacity = `Kho không chứa vừa: cần ${totalFramesRequired} khung nhưng kho chỉ có ${selectedRackCount} khung.`
    if (!Number.isFinite(goodsWeightNumber) || goodsWeightNumber <= 0) errors.weight = 'Vui lòng nhập cân nặng mỗi kiện cho tất cả mẫu hàng.'
    if (goodsWeightNumber > selectedUnit.maxLoadKg) errors.weightLimit = `${'Tổng cân nặng vượt tải trọng sàn'} (${selectedUnit.maxLoadKg} kg).`
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(moveInDate)
      && requestedDate !== null
      && !Number.isNaN(requestedDate.getTime())
      && policyDateInput(requestedDate) === moveInDate
    const timeIsValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(bookingAppointmentTime)

    if (!dateIsValid) {
      errors.moveInDate = 'Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY.'
    } else if (moveInDate < earliestCheckInDate || moveInDate > latestCheckInDate) {
      errors.moveInDate = `Ngày nhận kho phải từ ${checkInWindow.availableAt.toLocaleDateString('vi-VN')} đến ${checkInWindow.deadlineAt.toLocaleDateString('vi-VN')}.`
    }

    if (!timeIsValid) {
      errors.appointmentTime = 'Vui lòng nhập giờ hợp lệ theo định dạng HH:mm (24 giờ).'
    } else if (requestedAt && dateIsValid && !errors.moveInDate && !isCheckInAppointmentAllowed(requestedAt, checkInWindow)) {
      const isFirstAvailableDate = moveInDate === earliestCheckInDate
      errors.appointmentTime = isFirstAvailableDate && requestedAt < checkInWindow.availableAt
        ? `Trong ngày ${checkInWindow.availableAt.toLocaleDateString('vi-VN')}, giờ nhận kho sớm nhất là ${earliestCheckInTime}.`
        : 'Thời gian nhận kho nằm ngoài thời hạn cho phép.'
    }
    setBookingErrors(errors)
    if (Object.keys(errors).length) {
      showToast('Vui lòng kiểm tra lại các thông tin được đánh dấu.')
      requestAnimationFrame(() => bookingErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return false
    }
    return true
  }

  const continueFromPersonalDetails = () => {
    const errors: Record<string, string> = {}
    if (!isIdentityDocumentFormatValid(customerIdCard)) errors.identity = 'CCCD/Hộ chiếu phải có 9–30 ký tự hợp lệ.'
    if (!isVietnamesePhone(customerPhone)) errors.phone = VIETNAMESE_PHONE_ERROR_MESSAGE
    if (!customerAddress.trim()) errors.address = 'Vui lòng nhập địa chỉ.'
    setBookingErrors(errors)
    if (Object.keys(errors).length) {
      showToast('Vui lòng kiểm tra lại thông tin cá nhân.')
      requestAnimationFrame(() => bookingErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }
    setBookingStep(2)
  }

  const selectGoodsImages = (goodsItemId: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    const errorKey = `goodsImages-${goodsItemId}`
    if (files.length > 10) {
      event.currentTarget.value = ''
      setBookingErrors(current => ({
        ...current,
        [errorKey]: `Bạn đã chọn ${files.length} ảnh. Mỗi loại hàng hóa chỉ được tải tối đa 10 ảnh.`,
      }))
      showToast('Bạn chỉ được chọn tối đa 10 ảnh cho mỗi loại hàng hóa.')
      return
    }
    setGoodsItems(items => items.map(row => row.id === goodsItemId ? { ...row, images: files } : row))
    setBookingErrors(current => {
      if (!current[errorKey]) return current
      const next = { ...current }
      delete next[errorKey]
      return next
    })
  }

  const confirmReservation = async () => {
    if (!selectedUnit || !selectedTarget || reservationSubmitting) return
    setReservationSubmitError(null)
    if (isApiAuthenticated() && !selectedBackendRentalPackage && backendRentalPackages.length === 0) {
      setReservationSubmitError('Vui lòng chọn một gói thuê đang hiệu lực trước khi lấy báo giá.')
      return
    }
    if (!validateBookingForm()) return

    const endDate = addMonthsForPreview(earliestCheckInDate, rentalMonths)
    if (endDate === '—') return

    if (!isApiAuthenticated()) {
      const primaryItem = goodsItems[0]
      const legacyGoods = {
        category: primaryItem?.category || '',
        packageCount: packageCountNumber,
        lengthCm: cargoLengthNumber,
        widthCm: cargoWidthNumber,
        heightCm: cargoHeightNumber,
        weightKg: goodsWeightNumber,
        dimWeightKg: dimensionalWeightKg(capacitySamples),
        material: primaryItem?.materialName || primaryItem?.customMaterial || '',
        condition: goodsCondition,
        fragile: goodsItems.some(item => item.fragile === 'yes' || item.materialType === 'FRAGILE'),
        notes: goodsItems.map(item => item.customerNote).filter(Boolean).join(' | '),
        items: goodsItems.map(item => ({
          id: item.id,
          category: item.category,
          materialType: item.materialType,
          materialName: item.materialName,
          customGoodsName: item.customGoodsName,
          description: item.description,
          customMaterial: item.customMaterial,
          quantity: Number(item.quantity) || 1,
          dimensions: {
            lengthCm: Number(item.lengthCm) || cargoLengthNumber,
            widthCm: Number(item.widthCm) || cargoWidthNumber,
            heightCm: Number(item.heightCm) || cargoHeightNumber,
          },
          weightKg: Number(item.weightKg) || goodsWeightNumber,
          fragile: item.fragile === 'yes' || item.materialType === 'FRAGILE',
          customerNote: item.customerNote,
        })),
      }
      setReservationSubmitting(true)
      try {
        const result = validateAndCreateReservation({
          customer: user,
          unitTypeId: selectedTarget.unitType.id,
          facilityId: selectedTarget.facility.id,
          goods: legacyGoods,
          rentalMonths,
          moveInDate: earliestCheckInDate,
          identityId: customerIdCard.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          appointmentTime: bookingAppointmentTime,
          largestItemDimensionsCm: {
            lengthCm: cargoLengthNumber,
            widthCm: cargoWidthNumber,
            heightCm: cargoHeightNumber,
          },
          capacityValidatedByFrames: packagesFitSelectedUnit,
          customerCatalogUnit: selectedCatalogUnit ? {
            id: selectedCatalogUnit.id,
            facilityName: selectedCatalogUnit.facilityName,
            doorWidthM: selectedCatalogUnit.doorDimensions.widthM,
            doorHeightM: selectedCatalogUnit.doorDimensions.heightM,
            physicalUnitId: selectedCatalogUnit.id,
          } : undefined,
          packageId: selectedActivePackage?.id,
          packageName: selectedActivePackage?.name,
          packagePrice: selectedActivePackage?.packagePrice,
          freeSetupDays: selectedActivePackage?.freeSetupDays,
        })
        if (result.outcome === 'HARD_VIOLATION') {
          setValidationViolation({
            reason: result.rejectionReason,
            suggestedUnitTypeId: result.suggestedUnitTypeId,
            suggestedUnitTypeName: result.suggestedUnitTypeName,
            suggestedVolumeM3: result.suggestedVolumeM3,
          })
          showToast(result.messageVi)
          return
        }
        resetBookingForm()
        setBookOpen(false)
        setSelectedUnit(null)
        setPage('reservations')
        showToast(result.messageVi)
      } finally {
        setReservationSubmitting(false)
      }
      return
    }

    const selection = {
      facilityId: selectedTarget.facility.id,
      unitTypeId: selectedTarget.unitType.id,
      startDate: earliestCheckInDate,
      endDate,
      goodsCondition,
      goodsItems: apiGoodsItems,
    }

    setReservationSubmitting(true)
    try {
      if (!bookingReview || !serverQuote) {
        const compatibility = await checkCompatibility(selection)
        setServerCompatibility(compatibility)
        if (compatibility.result === 'INCOMPATIBLE' || compatibility.availableUnitCount <= 0) {
          const recommendation = isApiAuthenticated() && recommendationInput
            ? await recommendReservationUnitType(recommendationInput).catch(() => null)
            : null
          if (recommendation) setServerRecommendation(recommendation)
          const suggestedType = recommendation?.recommendedUnitTypeId
            ? backendUnitTypes.find(item => item.id === recommendation.recommendedUnitTypeId)
            : undefined
          setValidationViolation({
            reason: compatibility.issues.join(' ') || 'Loại kho không phù hợp hoặc đã hết chỗ.',
            suggestedUnitTypeId: suggestedType?.id,
            suggestedUnitTypeName: suggestedType?.name,
            suggestedVolumeM3: suggestedType?.volumeM3,
          })
          showToast(compatibility.issues.join(' ') || 'Loại kho không phù hợp hoặc đã hết chỗ.')
          return
        }
        const packageCode = selectedBackendRentalPackage?.code
          || backendRentalPackages[0]?.code
          || selectedActivePackage?.id
          || `${rentalMonths}_MONTHS`
        const quote = await createReservationQuote({
          ...selection,
          pricingPackageCode: packageCode,
          voucherCode: bookingVoucherCode.trim() || undefined,
        })
        setServerQuote(quote)
        setTermsAccepted(false)
        setValidationViolation(null)
        setBookingReview(true)
        setBookingStep(3)
        return
      }

      if (!serverQuote.setupEarlyExitPolicyVersion || serverQuote.setupEarlyExitFee == null) {
        throw new Error('Báo giá chưa có điều khoản trả kho trong setup. Vui lòng lấy lại báo giá hoặc liên hệ cơ sở.')
      }
      if (acceptedSetupQuoteId !== serverQuote.quoteId) {
        throw new Error('Vui lòng đọc và đồng ý điều khoản trả kho trong setup trước khi xác nhận đặt kho.')
      }
      const idempotencyKey = reservationIdempotencyKey.current || crypto.randomUUID()
      reservationIdempotencyKey.current = idempotencyKey
      const reservation = await createCustomerReservation({
        quoteId: serverQuote.quoteId,
        acceptedSetupEarlyExitPolicyVersion: serverQuote.setupEarlyExitPolicyVersion,
        identityDocumentNumber: customerIdCard.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        goodsCondition: goodsCondition.trim(),
        notes: goodsItems.map(item => item.customerNote).filter(Boolean).join(' | ') || null,
        goodsItems: apiGoodsItems,
        appointmentAt: bookingAppointmentTime
          ? new Date(`${moveInDate}T${bookingAppointmentTime}:00`).toISOString()
          : undefined,
        acceptedTerms: termsAccepted,
      }, idempotencyKey)
      let goodsImageError = ''
      const imageCount = goodsItems.reduce((total, item) => total + item.images.length, 0)
      if (imageCount > 0) {
        try {
          const detail = await getCustomerReservation(reservation.id)
          await Promise.all(detail.goodsItems.flatMap((savedItem, index) =>
            (goodsItems[index]?.images ?? []).map(file => uploadReservationGoodsImage(savedItem.id, file)),
          ))
        } catch (error) {
          goodsImageError = `Đơn đã được tạo nhưng chưa tải đủ ảnh hàng hóa: ${error instanceof Error ? error.message : 'Lỗi tải ảnh'}.`
        }
      }
      // Creation does not send an email in the current BE contract. Issue the first OTP here.
      setBackendReservations(current => [reservation, ...current.filter(item => item.id !== reservation.id)])
      setAvailabilityRevision(value => value + 1)
      resetBookingForm()
      setBookOpen(false)
      setSelectedUnit(null)
      setPage('reservations')
      if (reservation.status === 'AWAITING_EMAIL') {
        setBackendOtpReservation(reservation)
        setBackendOtpCode('')
        setBackendOtpDevelopmentCode(null)
        setBackendOtpMessage(null)
        setBackendOtpBusy(true)
        try {
          const sent = await resendReservationOtp(reservation.id)
          setBackendOtpNextResendAt(current => ({ ...current, [reservation.id]: new Date(sent.nextResendAt).getTime() }))
          if (sent.developmentCode) {
            setBackendOtpDevelopmentCode(sent.developmentCode)
          }
          setBackendOtpMessage(goodsImageError || null)
        } catch (error) {
          setBackendOtpMessage(`Đơn đã tạo, nhưng gửi OTP chưa thành công: ${error instanceof Error ? error.message : 'Lỗi kết nối'}. Bạn có thể gửi lại.${goodsImageError ? ` ${goodsImageError}` : ''}`)
        } finally { setBackendOtpBusy(false) }
      }
      showToast(`${reservation.reservationCode} đã được tạo. Hãy xác minh OTP để tiếp tục.`)
    } catch (error) {
      const backendMessage = error instanceof Error ? error.message : ''
      const validationDetails = error instanceof ApiClientError && error.details && typeof error.details === 'object' && !Array.isArray(error.details)
        ? error.details as Record<string, unknown>
        : null
      const validationLabels: Record<string, string> = {
        quoteId: 'Báo giá không hợp lệ hoặc đã hết hạn.',
        identityDocumentNumber: 'CCCD/Hộ chiếu phải có từ 9 đến 30 ký tự hợp lệ.',
        customerPhone: 'Vui lòng nhập số điện thoại liên hệ.',
        customerPhoneValid: VIETNAMESE_PHONE_ERROR_MESSAGE,
        customerAddress: 'Vui lòng nhập địa chỉ.',
        goodsCondition: 'Vui lòng mô tả tình trạng đóng gói.',
        goodsItems: 'Đơn phải có ít nhất một loại hàng hóa.',
        appointmentAt: 'Thời gian nhận kho chưa hợp lệ.',
      }
      const validationMessage = validationDetails
        ? Object.entries(validationDetails).map(([field, detail]) => {
            const itemMatch = field.match(/goodsItems\[(\d+)]\.(.+)/)
            if (itemMatch) {
              const itemNumber = Number(itemMatch[1]) + 1
              const itemField = ({ category: 'loại hàng', description: 'mô tả', quantity: 'số lượng', lengthCm: 'chiều dài', widthCm: 'chiều rộng', heightCm: 'chiều cao', weightPerItemKg: 'cân nặng', materialName: 'vật liệu' } as Record<string, string>)[itemMatch[2]] || itemMatch[2]
              return `Hàng hóa ${itemNumber}: ${itemField} chưa hợp lệ.`
            }
            return validationLabels[field] || (typeof detail === 'string' && !detail.match(/must not|size must|failed/i) ? detail : `Thông tin ${field} chưa hợp lệ.`)
          }).join(' ')
        : ''
      const message = backendMessage.includes('Rental package was not found')
        ? 'Gói thuê đã chọn không còn khả dụng. Vui lòng chọn lại gói thuê và lấy báo giá mới.'
        : backendMessage.includes('Rental package is not effective')
          ? 'Gói thuê không còn hiệu lực vào ngày nhận kho đã chọn. Vui lòng chọn gói hoặc ngày nhận kho khác.'
          : error instanceof ApiClientError && error.status === 409
        ? backendMessage.includes('No storage unit is available')
          ? 'Loại kho này vừa hết chỗ trong kỳ thuê đã chọn. Vui lòng chọn kỳ thuê hoặc loại kho khác.'
          : backendMessage
        : error instanceof ApiClientError && error.code === 'VALIDATION_ERROR'
          ? validationMessage || 'Thông tin đặt kho chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.'
        : backendMessage || 'Không thể tạo đơn đặt kho.'
      setReservationSubmitError(message)
      showToast(message)
    } finally {
      setReservationSubmitting(false)
    }
  }

  const cancelBackendReservation = (reservation: CustomerReservation) => {
    void cancelCustomerReservation(reservation.id, 'Khách hàng chủ động hủy trên cổng khách hàng')
      .then(() => listCustomerReservations(undefined, 0, 50))
      .then(result => {
        setBackendReservations(result.data)
        setAvailabilityRevision(value => value + 1)
        showToast(`Đã hủy ${reservation.reservationCode}.`)
      })
      .catch(error => showToast(error instanceof Error ? error.message : 'Không thể hủy đơn đặt kho.'))
  }

  const refreshBackendReservations = async () => {
    const result = await listCustomerReservations(undefined, 0, 50)
    setBackendReservations(result.data)
    setAvailabilityRevision(value => value + 1)
  }

  useEffect(() => {
    if (!isApiAuthenticated() || !['browse-units', 'reservations', 'contracts'].includes(page)) return
    const refresh = () => { void refreshBackendReservations().catch(error => showToast(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái đơn.')) }
    refresh()
    const timer = window.setInterval(refresh, 30_000)
    return () => window.clearInterval(timer)
  }, [page, user.id])

  const verifyBackendReservationOtp = async () => {
    if (!backendOtpReservation || backendOtpBusy) return
    if (!/^\d{6}$/.test(backendOtpCode)) {
      setBackendOtpMessage('OTP phải gồm đúng 6 chữ số.')
      return
    }
    setBackendOtpBusy(true)
    try {
      const result = await verifyReservationOtp(backendOtpReservation.id, backendOtpCode)
      await refreshBackendReservations()
      setBackendOtpReservation(null)
      setBackendOtpCode('')
      setBackendOtpDevelopmentCode(null)
      setBackendOtpMessage(null)
      showToast(result.reservationStatus === 'AWAITING_REVIEW'
        ? 'Email đã xác minh. Hồ sơ đang chờ nhân viên duyệt.'
        : 'Email đã xác minh. Bạn có thể tiếp tục thanh toán.')
    } catch (error) {
      setBackendOtpMessage(error instanceof Error ? error.message : 'Không thể xác minh OTP.')
    } finally {
      setBackendOtpBusy(false)
    }
  }

  const resendBackendReservationOtp = async () => {
    if (!backendOtpReservation || backendOtpBusy) return
    setBackendOtpBusy(true)
    try {
      const result = await resendReservationOtp(backendOtpReservation.id)
      setBackendOtpCode('')
      setBackendOtpNextResendAt(current => ({ ...current, [backendOtpReservation.id]: new Date(result.nextResendAt).getTime() }))
      if (result.developmentCode) {
        setBackendOtpDevelopmentCode(result.developmentCode)
      }
      setBackendOtpMessage(null)
    } catch (error) {
      setBackendOtpMessage(error instanceof Error ? error.message : 'Không thể gửi lại OTP.')
    } finally {
      setBackendOtpBusy(false)
    }
  }

  return (
    <Layout
      user={user}
      navItems={NAV}
      currentPage={page}
      onNavigate={handleLayoutNavigate}
      onLogout={onLogout}
      roleLabel="Khách hàng"
      roleColor="bg-blue-100 text-blue-700"
      notifications={customerNotifications}
      onNotificationClick={handleNotificationClick}
      canAccess={permission => isApiAuthenticated() ? canApiCustomerNavigate(user, permission) : hub.can(user, permission)}
    >
      <div className="customer-page min-w-0 w-full max-w-full overflow-x-hidden font-sans">
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
                  {'Chọn cơ sở, khai báo hàng hóa và xác nhận đặt kho. Kho chỉ được giữ sau khi yêu cầu được hệ thống ghi nhận thành công.'}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 sm:gap-3">
                {[
                  [String(PAYMENT_WINDOW_MINUTES), 'phút', 'Hoàn tất cọc, giữ chỗ an tâm', 'Tính từ khi mở thanh toán.'],
                  [String(MANAGER_ASSIGNMENT_HOURS), 'giờ', 'Quản lý bố trí gian kho', 'Tính liên tục từ khi xác nhận thanh toán.'],
                  [String(CHECK_IN_WINDOW_DAYS), 'ngày', 'Chủ động lịch đến nhận kho', 'Tính từ thời điểm kho có thể sẵn sàng.']
                ].map(([value, unit, label, note]) => (
                  <div key={label} className="grid min-h-[104px] grid-cols-[96px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-4 backdrop-blur sm:grid-cols-1 lg:grid-cols-[96px_minmax(0,1fr)]">
                    <div className="flex min-h-[64px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[.08] px-2 py-2 text-center"><p className="text-3xl font-bold leading-none tabular-nums text-white">{value}</p><p className="mt-2 whitespace-nowrap text-[11px] font-medium leading-4 text-white/65">{unit}</p></div>
                    <div className="min-w-0"><p className="text-sm font-semibold leading-5 text-white">{label}</p>{note && <p className="mt-1.5 text-xs leading-4 text-white/55">{note}</p>}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-stone-500">{'Tài khoản của bạn'}</p>
              <h2 className="mt-1 text-2xl font-bold text-black">{`Xin chào, ${user.name}`}</h2>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
            {isApiAuthenticated() ? <CustomerApiMetric metric="active-rentals" /> : <StatCard title={'Hồ sơ thuê đang hoạt động'} value={activeRentals.length} icon={Icon.key} iconBg="bg-blue-50 text-blue-700" />}
            {isApiAuthenticated() ? <CustomerApiMetric metric="reservations" /> : <StatCard title={'Đơn đặt giữ kho'} value={visibleMyHolds.length} icon={Icon.calendar} iconBg="bg-amber-50 text-amber-700" />}
            {isApiAuthenticated() ? <CustomerApiMetric metric="returning-rentals" /> : <StatCard title={'Kho đang yêu cầu trả'} value={activeRentals.filter(rental => rental.status === 'return_requested').length} icon={Icon.clock} iconBg="bg-stone-100 text-black" />}
            {isApiAuthenticated() ? <CustomerApiMetric metric="open-support" /> : <StatCard title={'Yêu cầu hỗ trợ đang mở'} value={tickets.filter(t => t.status === 'open').length} icon={Icon.support} />}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
            {isApiAuthenticated() ? <CustomerRentalApiLink onOpen={(storageUnitId) => { setReceiptRentalTarget(storageUnitId); navigateTo('rental-records') }} /> : (
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
            )}

            <Card className="p-5">
              <p className="eyebrow">{'Thao tác nhanh'}</p>
              <h2 className="mt-1 font-bold text-stone-900">{'Quy trình thuê kho khép kín'}</h2>
              <div className="mt-4 grid gap-2">
                <button onClick={() => navigateTo('browse-units')} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.building}</span>
                  <span>
                    <b className="block text-sm">{'1. Chọn kho & Khai báo hàng hóa'}</b>
                    <small className="text-stone-500 group-hover:text-white">{'Kho được giữ khi yêu cầu đặt kho được ghi nhận thành công'}</small>
                  </span>
                </button>
                <button onClick={() => navigateTo('reservations')} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
                  <span className="text-amber-700 group-hover:text-white">{Icon.calendar}</span>
                  <span>
                    <b className="block text-sm">{'2. Tiến độ đơn đặt giữ kho'}</b>
                    <small className="text-stone-500 group-hover:text-white">{'Cọc giữ chỗ 20% theo báo giá trong 15 phút'}</small>
                  </span>
                </button>
                <button onClick={() => navigateTo('support')} className="group flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-amber-600 hover:bg-amber-600 hover:text-white">
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
               const facilityCatalogUnits = CUSTOMER_CATALOG_UNITS.filter(unit => unit.facilityId === facility.id || unit.facilityId === facility.code)
               const availCount = effectiveAvailableCount(facility.id)
              const minimumMonthlyPrice = facilityCatalogUnits.length ? Math.min(...facilityCatalogUnits.map(unit => unit.price)) : null
              const display = CUSTOMER_FACILITY_DISPLAY[facility.id]
              const displayCode = display?.code ?? facility.id.toUpperCase()
              const displayName = display?.name ?? facility.name
              const displayAddress = display?.address ?? facility.address
              const facilityImage = facility.image
                ? (facility.image.startsWith('/') || facility.image.startsWith('http') || facility.image.startsWith('data:')
                  ? facility.image
                  : `https://images.unsplash.com/${facility.image}?w=720&h=352&fit=crop&auto=format`)
                : null

              return (
                <Card key={facility.id} className="overflow-hidden stat-card-hover">
                  <div className="relative h-44 bg-stone-200">
                    {facilityImage ? <img
                      src={facilityImage}
                      alt={`Hình ảnh ${displayName}`}
                      className="h-full w-full object-cover"
                      onError={e => {
                        if (!isApiAuthenticated()) (e.currentTarget as HTMLImageElement).src = '/images/facilities/binh-duong.jpg'
                      }}
                    /> : <div className="flex h-full items-center justify-center px-4 text-center text-sm text-stone-500">Chưa có hình ảnh cơ sở</div>}
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
                      {facility.rating > 0 && <span className="text-sm font-semibold text-amber-700">Đánh giá: {facility.rating}</span>}
                    </div>
                    <div className="my-4 flex flex-wrap gap-2">
                      {!isApiAuthenticated() && <Badge variant="muted">{'Camera 24/7'}</Badge>}
                      {facility.climate && <Badge variant="info">{'Điều hòa độ ẩm'}</Badge>}
                      {isApiAuthenticated() && facility.security && <Badge variant="muted">{facility.security}</Badge>}
                    </div>
                    <div className="flex items-end justify-between border-t border-stone-100 pt-4">
                      <div>
                        <p className="text-xs text-stone-500">{'Giá chỉ từ'}</p>
                        <p className="text-xl font-bold text-stone-900">{minimumMonthlyPrice === null ? 'Chưa có gian kho' : <>{formatVnd(minimumMonthlyPrice)}<span className="text-xs font-normal text-stone-500">/{'tháng'}</span></>}</p>
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
            {catalogLoading && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                Đang tải cơ sở và loại kho từ StorageHub...
              </div>
            )}
            {catalogError && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                <b>Không thể tải danh mục kho.</b> {catalogError}
              </div>
            )}
            <SectionHeader
              title={selectedFacility
                ? (`Kho còn trống tại ${CUSTOMER_FACILITY_DISPLAY[selectedFacility.id]?.name ?? selectedFacility.name}`)
                : ('Kho còn trống')}
              subtitle={selectedFacility
                ? (CUSTOMER_FACILITY_DISPLAY[selectedFacility.id]?.address ?? selectedFacility.address)
                : undefined}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={sizeFilter} onChange={event => setSizeFilter(event.target.value)} className="w-full sm:w-56">
                    <option value="All">{'Tất cả kích thước'}</option>
                    <option value="S">{'Size S'}</option>
                    <option value="M">{'Size M'}</option>
                    <option value="L">{'Size L'}</option>
                    <option value="XL">{'Size XL'}</option>
                    {Array.from(new Set(CUSTOMER_CATALOG_UNITS.map(u => u.sizeCode?.toUpperCase()).filter(Boolean))).filter(code => !['S', 'M', 'L', 'XL'].includes(code)).map(code => (
                      <option key={code} value={code}>{`Size ${code}`}</option>
                    ))}
                  </Select>
                </div>
              }
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={!selectedFacilityId ? 'primary' : 'outline'} onClick={() => setSelectedFacilityId(null)}>Tất cả cơ sở</Button>
                {facilities.map(facility => <Button key={facility.id} size="sm" variant={selectedFacilityId === facility.id ? 'primary' : 'outline'} onClick={() => setSelectedFacilityId(facility.id)}>{facility.id === 'fac-001' ? 'Xem kho Hồ Chí Minh' : facility.id === 'fac-002' ? 'Xem kho Bình Dương' : `Xem kho ${facility.name}`}</Button>)}
              </div>
              <label className="relative ml-auto block w-full lg:w-[420px]"><span className="sr-only">Tìm kiếm loại kho</span><input value={unitSearch} onChange={event => setUnitSearch(event.target.value)} placeholder="Tìm theo loại kho..." className="w-full rounded-xl border border-stone-300 py-2.5 pl-10 pr-4 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200" /><span className="pointer-events-none absolute left-3 top-3 text-stone-400">{SearchIcon}</span></label>
            </div>

            {/* List Facilities with their 3-4 Unit Sizes */}
            <div className="space-y-8">
              {displayedFacilities.map(facility => {
                const display = CUSTOMER_FACILITY_DISPLAY[facility.id]
                const matchingUnitTypes = unitTypes.filter(unitType => {
                  const backendUnitType = backendUnitTypes.find(item => item.id === unitType.id)
                  if (backendUnitType && backendUnitType.facilityId !== facility.id) return false
                  const sizeCode = storageSizeCode(unitType.name)
                  return (
                    sizeFilter === 'All' ||
                    unitType.name === sizeFilter ||
                    sizeCode.toUpperCase() === sizeFilter.toUpperCase() ||
                    (sizeFilter === 'S' && (unitType.name === 'Small' || sizeCode === 'S')) ||
                    (sizeFilter === 'M' && (unitType.name === 'Medium' || sizeCode === 'M')) ||
                    (sizeFilter === 'L' && (unitType.name === 'Large' || sizeCode === 'L')) ||
                    (sizeFilter === 'XL' && (unitType.name === 'Extra Large' || sizeCode === 'XL'))
                  ) && `${unitType.name} ${sizeCode} ${storageTypeLabelVi(unitType.name)}`.toLowerCase().includes(unitSearch.trim().toLowerCase())
                })
                const pageCount = Math.max(1, Math.ceil(matchingUnitTypes.length / CUSTOMER_UNIT_TYPES_PER_PAGE))
                const currentPage = Math.min(unitPages[facility.id] ?? 1, pageCount)
                const visibleUnitTypes = matchingUnitTypes.slice((currentPage - 1) * CUSTOMER_UNIT_TYPES_PER_PAGE, currentPage * CUSTOMER_UNIT_TYPES_PER_PAGE)
                const availableCount = matchingUnitTypes.reduce((total, unitType) => total + effectiveAvailableCount(facility.id, unitType.name), 0)

                return (
                  <section key={facility.id} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-stone-300 bg-stone-50 px-2 py-0.5 text-xs font-bold text-black">
                            {display?.code ?? facility.id.toUpperCase()}
                          </span>
                          <h3 className="text-xl font-bold text-black">{display?.name ?? facility.name}</h3>
                          {facility.rating > 0 && <span className="text-xs font-semibold text-black">Đánh giá: {facility.rating}</span>}
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
                      {visibleUnitTypes.map(unitType => (
                        <SizeCategoryCard
                          key={unitType.id}
                          facility={facility}
                          unitType={unitType}
                          apiSpec={backendUnitTypes.find(item => item.id === unitType.id)}
                          availableCount={effectiveAvailableCount(facility.id, unitType.name)}
                          onReserve={handleStartReservation}
                          onViewSpecs={handleOpenSpecs}
                        />
                      ))}
                    </div>
                    {matchingUnitTypes.length === 0 && <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">Không tìm thấy loại kho phù hợp tại cơ sở này.</div>}
                    {matchingUnitTypes.length > CUSTOMER_UNIT_TYPES_PER_PAGE && <div className="flex flex-wrap items-center justify-center gap-2 border-t border-stone-200 pt-5"><Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setUnitPages(pages => ({ ...pages, [facility.id]: Math.max(1, currentPage - 1) }))}>← Trang trước</Button><span className="px-2 text-sm font-semibold text-stone-600">Trang {currentPage}/{pageCount}</span><Button size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setUnitPages(pages => ({ ...pages, [facility.id]: Math.min(pageCount, currentPage + 1) }))}>Trang sau →</Button></div>}
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
            action={<Button size="sm" onClick={() => navigateTo('browse-units')}>{Icon.plus} {'Đặt giữ kho mới'}</Button>}
          />

          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[260px_1fr_auto] md:items-end">
              <Select label="Lọc theo cơ sở" value={reservationFacilityFilter} onChange={event => setReservationFacilityFilter(event.target.value)}><option value="all">Tất cả cơ sở</option>{facilities.map(facility => <option key={facility.id} value={facility.id}>{CUSTOMER_FACILITY_DISPLAY[facility.id]?.name || facility.name}</option>)}</Select>
              <Select label="Lọc theo kích thước kho" value={reservationSizeFilter} onChange={event => setReservationSizeFilter(event.target.value)}><option value="all">Tất cả kích thước</option><option value="S">Kho nhỏ (S)</option><option value="M">Kho vừa (M)</option><option value="L">Kho lớn (L)</option><option value="XL">Kho rất lớn (XL)</option></Select>
              <Button variant="outline" disabled={reservationFacilityFilter === 'all' && reservationSizeFilter === 'all'} onClick={() => { setReservationFacilityFilter('all'); setReservationSizeFilter('all') }}>Xóa bộ lọc</Button>
            </div>
            <p className="mt-3 text-xs text-stone-500">Hiển thị {isApiAuthenticated() ? filteredBackendReservations.length : filteredReservationHolds.length}/{isApiAuthenticated() ? pendingHandoverReservations.length : visibleMyHolds.length} đơn đặt giữ kho.</p>
          </Card>

          {isApiAuthenticated() ? (
            <div className="grid gap-4">
              {filteredBackendReservations.map(reservation => <CustomerReservationCard
                key={reservation.id}
                reservation={reservation}
                facilityName={facilities.find(item => item.id === reservation.facilityId)?.name || reservation.facilityId}
                unitTypeName={reservation.unitTypeName || unitTypes.find(item => item.id === reservation.unitTypeId)?.name || reservation.unitTypeId}
                facilityDetails={backendFacilities.find(item => item.id === reservation.facilityId) || null}
                unitTypeDetails={backendUnitTypes.find(item => item.id === reservation.unitTypeId) || null}
                facility={facilities.find(item => item.id === reservation.facilityId)}
                unitType={unitTypes.find(item => item.id === reservation.unitTypeId)}
                onVerify={() => {
                  setBackendOtpReservation(reservation)
                  setBackendOtpCode('')
                  setBackendOtpDevelopmentCode(null)
                  setBackendOtpMessage(null)
                  void resendReservationOtp(reservation.id).then(res => {
                    setBackendOtpNextResendAt(current => ({ ...current, [reservation.id]: new Date(res.nextResendAt).getTime() }))
                    if (res.developmentCode) {
                      setBackendOtpDevelopmentCode(res.developmentCode)
                    }
                    setBackendOtpMessage(`Đã gửi OTP tới ${reservation.customerEmail || 'email tài khoản của bạn'}. Vui lòng kiểm tra cả hộp thư rác.`)
                  }).catch(error => {
                    setBackendOtpMessage(error instanceof Error ? error.message : 'Không thể gửi OTP. Hãy kiểm tra kết nối tới backend và thử lại.')
                  })
                }}
                onCancel={() => cancelBackendReservation(reservation)}
                onRefresh={refreshBackendReservations}
                onReceiptConfirmed={reservationId => {
                  setReceiptRentalTarget(reservationId)
                  navigateTo('rental-records')
                }}
              />)}
              {!filteredBackendReservations.length && <Card className="p-10 text-center"><h2 className="font-semibold text-stone-700">{pendingHandoverReservations.length ? 'Không tìm thấy đơn phù hợp' : 'Không có đơn đặt giữ kho đang chờ bàn giao'}</h2><p className="mt-1 text-sm text-stone-500">{pendingHandoverReservations.length ? 'Hãy chọn lại cơ sở hoặc kích thước kho.' : 'Kho đã bàn giao được theo dõi trong Hồ sơ thuê.'}</p></Card>}
            </div>
          ) : filteredReservationHolds.length ? (
            <div className="grid gap-4">
              {filteredReservationHolds.map(hold => {
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
                        {unitTypeLabel(hold.unitTypeName || hold.unitId)} · {hold.facilityName}
                      </h2>
                      <p className="text-xs font-semibold text-blue-800">{hold.assignedUnitId ? 'Gian kho quản lý cơ sở đã phân:' : 'Trạng thái phân kho:'} {hold.assignedUnitId ? (units.find(unit => unit.id === hold.assignedUnitId)?.code || hold.assignedUnitId) : 'Chưa phân gian kho cụ thể'}</p>
                      <p className="text-xs text-stone-500">
                        {'Lịch nhận kho hiện tại:'} <b>{hold.appointmentDate || hold.moveInDate}{hold.appointmentTime ? ` · ${hold.appointmentTime}` : ''}</b> · {'Thời hạn:'} {hold.rentalMonths} {'tháng'}
                      </p>

                      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p><b>Hàng hóa khai báo:</b> {hold.goods.category} ({hold.goods.packageCount} kiện, {hold.goods.weightKg}kg)</p>
                          {hold.assignedUnitId ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <span className="rounded bg-blue-700 px-2 py-1 text-[11px] font-bold text-white">Quản lý cơ sở đã phân: <b>{units.find(unit => unit.id === hold.assignedUnitId)?.code || hold.assignedUnitId}</b></span>
                              {hold.status === 'awaiting_email' && <span className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white">Chờ xác minh email</span>}
                              {hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING' && <span className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white">Chờ nhân viên cơ sở duyệt hàng hóa</span>}
                            </div>
                          ) : hold.status === 'awaiting_email' ? (
                            <span className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white">
                              Chờ xác minh email
                            </span>
                          ) : hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING' ? (
                            <span className="rounded bg-blue-700 px-2 py-1 text-[11px] font-semibold text-white">
                              Chờ nhân viên cơ sở duyệt hàng hóa
                            </span>
                          ) : hold.status === 'awaiting_payment' ? (
                            <span className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white">
                              Chờ thanh toán cọc
                            </span>
                          ) : (
                            <span className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white">
                              {hold.payment.status === 'paid' ? 'Đã cọc · Chờ quản lý cơ sở phân kho' : 'Chờ hoàn tất đặt loại kho'}
                            </span>
                          )}
                        </div>
                        <p><b>{'Kích thước kiện & Thể tích:'}</b> {hold.goods.lengthCm}×{hold.goods.widthCm}×{hold.goods.heightCm}cm (~{Math.round((hold.goods.lengthCm * hold.goods.widthCm * hold.goods.heightCm * hold.goods.packageCount) / 1000) / 1000} m³)</p>
                        {/* Financial breakdown: Reservation Deposit vs Security Deposit */}
                        {(() => {
                          const grossRent = hold.quote.baseMonthlyPrice * hold.rentalMonths
                          const discountAmount = hold.discountAmount ?? 0
                          const rentTotal = Math.max(0, grossRent - discountAmount)
                          const rentBeforeDiscount = grossRent
                          const bookingDeposit = hold.reservationDepositAmount ?? Math.round(rentTotal * 0.2 * 100) / 100
                          const rentBalance = Math.max(0, rentTotal - bookingDeposit)
                          return <div className="mt-2 grid gap-2 border-t border-stone-200/80 pt-3 text-[11px] sm:grid-cols-2">
                            <div className="rounded-lg bg-white/70 p-3 leading-5"><p className="font-bold text-stone-900">{'Tiền thuê và cọc giữ chỗ'}</p><p>{`Tiền thuê trước giảm: ${formatVnd(rentBeforeDiscount)}`}</p><p className="text-emerald-700">{`Giảm giá: − ${formatVnd(discountAmount)}`}</p><p>{`Tiền thuê sau giảm: ${formatVnd(rentTotal)} (${formatVnd(hold.quote.baseMonthlyPrice)} × ${hold.rentalMonths} tháng)`}</p><p>{`Cọc 20%: ${formatVnd(rentTotal)} × 20% = ${formatVnd(bookingDeposit)}`}</p><p>{`Tiền thuê còn lại: ${formatVnd(rentTotal)} − ${formatVnd(bookingDeposit)} = ${formatVnd(rentBalance)}`}</p></div>
                            <div className="rounded-lg bg-amber-50 p-3 leading-5"><p className="font-bold text-stone-900">{'Khoản thu khi nhận kho'}</p><p>{`Tiền thuê còn lại: ${formatVnd(rentBalance)}`}</p><p>{`+ Tiền cọc đảm bảo kho: ${formatVnd(hold.securityDepositAmount)}`}</p><p className="border-t border-amber-200 pt-1 font-bold">{`Tổng thu khi nhận kho: ${formatVnd(hold.remainingAmount)}`}</p></div>
                          </div>
                        })()}

                        {hold.payment.status === 'paid' && <p className="pt-1 text-[11px] font-medium text-black">{hold.assignedUnitId ? 'Cọc đã thanh toán. Quản lý cơ sở đã phân gian kho. Vui lòng nhận kho trong thời hạn 7 ngày.' : 'Cọc đã thanh toán. Quản lý cơ sở có tối đa 6 giờ để phân gian kho cụ thể.'}</p>}

                        {hold.generatedAccessPin && !holdInactive && (
                          <div className="mt-2 rounded bg-[#292a27] p-2 text-white text-xs flex items-center justify-between">
                            <span>{'Mã ra vào do hệ thống cấp (kích hoạt sau khi nhận kho):'}</span>
                            <span className="text-[#e9a12c] font-bold text-sm tracking-widest">{hold.generatedAccessPin}</span>
                          </div>
                        )}
                      </div>

                      {!['CANCELLED', 'EXPIRED'].includes(hold.status) && (() => {
                        const progressSteps = [
                          { label: 'Xác minh email', detail: 'Xác nhận địa chỉ liên hệ' },
                          { label: 'Phê duyệt hồ sơ', detail: hold.goodsReviewStatus === 'PENDING' ? 'Nhân viên kiểm tra hàng hóa trong tối đa 6 giờ' : 'Hồ sơ được duyệt tự động' },
                          { label: 'Thanh toán cọc', detail: 'Hoàn tất cọc giữ chỗ 20%' },
                          { label: 'Quản lý cơ sở phân kho', detail: hold.assignedUnitId ? `Đã phân ${units.find(unit => unit.id === hold.assignedUnitId)?.code || hold.assignedUnitId}` : 'Chờ phân gian kho cụ thể' },
                          { label: 'Nhận kho và ký', detail: 'Đối chiếu và ký tại cơ sở' },
                          { label: 'Đã bàn giao', detail: 'Nhận kho và mã ra vào' }
                        ]
                        const currentIndex = hold.status === 'awaiting_email' ? 0 : hold.status === 'awaiting_review' ? 1 : hold.status === 'awaiting_payment' ? 2 : hold.status === 'DEPOSIT_PAID' ? 3 : ['UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(hold.status) ? 4 : hold.status === 'COMPLETED' ? (receiptConfirmed ? 6 : 5) : -1
                        const activeStep = progressSteps[currentIndex]

                        return <div className="mt-4 border-t border-stone-200 pt-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-black">{'Tiến trình đơn đặt kho'}</p>
                              <p className="mt-0.5 text-[11px] text-stone-500">{`Đã hoàn thành ${Math.max(0, currentIndex)}/${progressSteps.length} bước`}</p>
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
                        {hold.goodsReviewStatus === 'PENDING' ? <><p className="text-xs text-stone-500">Tiền cọc</p><p className="text-lg font-bold text-blue-900">Chưa yêu cầu</p><p className="text-xs text-blue-800">Chỉ tính và mở thanh toán sau khi nhân viên chấp thuận.</p></> : <><p className="text-xs text-stone-500">{'Tổng thu cả kỳ (gồm tiền cọc đảm bảo kho):'}</p><p className="text-xl font-bold text-stone-900">{formatVnd(hold.totalInitialAmount ?? hold.quote.totalFirstPayment)}</p><p className="text-xs text-amber-800">{'Trả lúc giữ chỗ'}: {formatVnd(hold.reservationDepositAmount ?? hold.payment.amount)} · {'Thu khi nhận kho'}: {formatVnd(hold.remainingAmount)}</p></>}
                      </div>

                      {hold.status === 'awaiting_email' && (
                        <div className="min-w-[220px] rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-xs text-amber-950">
                          <p className="font-bold">{'Cần xác minh email'}</p>
                          <Button className="mt-2" size="sm" onClick={() => { setActiveHoldForEmail(hold); setInputToken(hold.emailVerification?.token || ''); setEmailModalOpen(true) }}>{'Xác minh email'}</Button>
                        </div>
                      )}

                      {hold.status === 'awaiting_review' && (
                        <div className="min-w-[260px] rounded-lg border border-blue-200 bg-blue-50 p-3 text-right text-xs text-blue-950">
                          <p className="font-bold">{hold.goodsReviewStatus === 'PENDING' ? 'Đang chờ nhân viên cơ sở duyệt hàng hóa' : 'Đang chờ xác nhận hồ sơ'}</p>
                          <p className="mt-1">Kho đang được giữ cho bạn · Tiền cọc: Chưa yêu cầu</p>
                          {hold.goodsReviewSubmittedAt && <p className="mt-1">Gửi lúc: {new Date(hold.goodsReviewSubmittedAt).toLocaleString('vi-VN')}</p>}
                          {hold.goodsReviewDueAt && <p className="mt-1">{new Date(hold.goodsReviewDueAt).getTime() < now ? 'Yêu cầu đang được xử lý lâu hơn dự kiến, kho vẫn được giữ.' : `Dự kiến xử lý trước: ${new Date(hold.goodsReviewDueAt).toLocaleString('vi-VN')}`}</p>}
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
                          <p className="font-bold text-white">{'Cần thanh toán cọc trong 15 phút'}</p>
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
                          {hold.appointmentDate && hold.appointmentTime ? (`Đổi lịch: ${hold.appointmentDate} ${hold.appointmentTime}`) : ('Đặt lịch nhận kho')}
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
                            {'Nhân viên sẽ chụp ảnh hiện trạng và kích hoạt mã mở cửa.'}
                          </p>
                        </div>
                      )}

                      {/* COMPLETED: Check-in complete, show rental */}
                      {hold.status === 'COMPLETED' && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="primary" size="sm" onClick={() => { try { confirmUnitReceipt(hold.id, user); setPage('rental-records'); showToast('Đã xác nhận nhận kho. Đơn giữ kho đã được chuyển sang Hồ sơ thuê của tôi.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận bàn giao.') } }}>Xác nhận đã nhận kho</Button>
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
                              ? ('Đơn đã thanh toán cọc giữ chỗ. Nếu hủy trước khi nhận kho, khoản cọc này KHÔNG ĐƯỢC HOÀN. Bạn chắc chắn muốn hủy?')
                              : ('Bạn có chắc chắn muốn hủy giữ kho? Suất kho đang giữ sẽ được trả lại ngay.')
                            requestConfirmation({ title: 'Xác nhận hủy giữ kho', message: warning, confirmLabel: 'Hủy giữ kho', tone: 'danger', onConfirm: () => { cancelReservation(hold.id, user, 'Khách hàng chủ động hủy'); showToast('Đã hủy đơn đặt giữ kho thành công.') } })
                          }}
                        >
                          {'Hủy giữ kho'}
                        </Button>
                      )}

                      {hold.status === 'CANCELLED' && (
                        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-right text-xs text-red-800 shadow-sm">
                          <p className="font-bold text-red-800">{'Đơn đã hủy'}</p>
                          <p className="mt-0.5 text-[11px] text-red-700">{'Gian kho đã được giải phóng.'}</p>
                          {hold.payment.status === 'paid' && <p className="mt-1 font-semibold text-red-800">{'Cọc giữ chỗ không hoàn lại do hủy trước khi nhận kho.'}</p>}
                        </div>
                      )}

                      {hold.status === 'EXPIRED' && (
                        <div className="rounded-lg bg-stone-100 border border-stone-300 px-3 py-1.5 text-xs text-stone-600 text-right">
                          <p className="font-bold text-stone-700"> {'Đơn đã hết hạn (quá hạn/vắng mặt)'}</p>
                          <p className="text-[11px] mt-0.5">{'Gian kho đã được hoàn lại danh mục.'}</p>
                        </div>
                      )}
                      {linkedRentalEnded && <div className="inactive-record-alert rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-right text-xs text-red-800"><p className="font-bold">{'Hồ sơ giữ kho đã hết hiệu lực'}</p><p className="mt-0.5">{'Hợp đồng đã hoàn tất trả kho. Mã ra vào đã bị thu hồi.'}</p></div>}
                      {holdInactive && <Button variant="outline" size="sm" onClick={() => requestConfirmation({ title: 'Xóa lịch sử giữ kho', message: 'Xóa lịch sử này khỏi danh sách của bạn? Dữ liệu đối soát hệ thống vẫn được lưu.', confirmLabel: 'Xóa lịch sử', tone: 'danger', onConfirm: () => { try { archiveReservationHistory(hold.id, user); showToast('Đã xóa lịch sử giữ kho khỏi danh sách.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử.') } } })}> {'Xóa lịch sử'}</Button>}
                    </div>
                  </div>
                </Card>
              )})}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto w-fit text-stone-300">{Icon.calendar}</div>
              <h2 className="mt-3 font-semibold text-stone-700">{visibleMyHolds.length ? 'Không tìm thấy đơn phù hợp' : 'Chưa có đơn đặt giữ kho nào'}</h2>
              <p className="mt-1 text-sm text-stone-500">{visibleMyHolds.length ? 'Hãy chọn lại cơ sở hoặc kích thước kho.' : 'Đơn đặt giữ kho của bạn sẽ hiển thị tại đây.'}</p>
              {visibleMyHolds.length ? <Button className="mt-4" size="sm" variant="outline" onClick={() => { setReservationFacilityFilter('all'); setReservationSizeFilter('all') }}>Xóa bộ lọc</Button> : <Button className="mt-4" size="sm" onClick={() => navigateTo('browse-units')}>{'Khám phá gian kho'}</Button>}
            </Card>
          )}
        </div>
      )}

      {/* ── MY RENTALS (HỒ SƠ THUÊ CỦA TÔI) ───────────────────── */}
      {page === 'rental-records' && isApiAuthenticated() && <CustomerRentalsApiPanel key={`${user.id}:${rentalMenuVisit}`} focusStorageUnitId={receiptRentalTarget} />}
      {page === 'rental-records' && !isApiAuthenticated() && (
        <div className="fade-in space-y-4">
          <section className="space-y-4">
          <SectionHeader
            title={'Hồ Sơ Thuê Kho Của Tôi'}
            action={<Button variant="outline" size="sm" onClick={() => setPage(previousPage || 'overview')}>← {'Quay lại'}</Button>}
          />

          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
              <Select label="Lọc theo cơ sở" value={rentalFacilityFilter} onChange={event => setRentalFacilityFilter(event.target.value)}><option value="all">Tất cả cơ sở</option>{facilities.map(facility => <option key={facility.id} value={facility.id}>{CUSTOMER_FACILITY_DISPLAY[facility.id]?.name || facility.name}</option>)}</Select>
              <Select label="Lọc theo loại kho" value={rentalTypeFilter} onChange={event => setRentalTypeFilter(event.target.value)}><option value="all">Tất cả loại kho</option><option value="S">Kho nhỏ (S)</option><option value="M">Kho vừa (M)</option><option value="L">Kho lớn (L)</option><option value="XL">Kho rất lớn (XL)</option></Select>
              <Select label="Lọc theo thời hạn" value={rentalDeadlineFilter} onChange={event => setRentalDeadlineFilter(event.target.value as 'all' | 'upcoming' | 'overdue')}><option value="all">Tất cả thời hạn</option><option value="upcoming">Kho sắp đến hạn</option><option value="overdue">Kho đã quá hạn</option></Select>
              <Button variant="outline" disabled={rentalFacilityFilter === 'all' && rentalTypeFilter === 'all' && rentalDeadlineFilter === 'all'} onClick={() => { setRentalFacilityFilter('all'); setRentalTypeFilter('all'); setRentalDeadlineFilter('all') }}>Xóa bộ lọc</Button>
            </div>
            <div className="mt-3 text-xs text-stone-500">Hiển thị {filteredAndSortedRentals.length}/{visibleMyRentals.length} hồ sơ thuê.</div>
          </Card>

          {filteredAndSortedRentals.length ? (
            <div className="grid gap-4">
              {filteredAndSortedRentals.map(rental => (
                <Card id={`customer-record-${rental.id}`} tabIndex={-1} key={rental.id} className={`overflow-hidden ${focusedNotificationTarget === rental.id ? 'notification-target-reveal' : ''}`}>
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
                      <p className="mt-1 text-sm text-stone-600">{rental.facilityName} · {unitTypeLabel(rental.unitType)} ({rental.areaM2} m² · {rental.volumeM3 || 15} m³)</p>
                      <p className="mt-2 text-xs text-stone-400">
                        {'Kỳ thuê: '} {rental.startDate} → {rental.endDate} · {'Hạn đóng cước: '} {rental.nextDue}
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="rounded-md bg-[#292a27] px-3 py-1 text-white text-xs flex items-center gap-2">
                          <span className="text-stone-400">{'Mã mở cổng:'}</span>
                          <span className="text-[#e9a12c] font-bold tracking-wider">{rental.gateCode}</span>
                        </div>
                        <span className="text-xs text-stone-500">{'Tiền cọc đảm bảo kho:'} <b>{formatVnd(rental.securityDeposit ?? rental.deposit)}</b></span>
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

                        {['setup', 'active'].includes(rental.status) && (
                          <>
                            {rental.status === 'active' && <Button
                              variant="outline"
                              size="sm"
                              disabled={!isApiAuthenticated() && renewals.some(item => item.rentalId === rental.id && ['pending', 'approved', 'payment_processing'].includes(item.status))}
                              onClick={() => {
                                if (isApiAuthenticated()) { navigateTo('rental-records'); return }
                                setActiveRentalForRenewal(rental)
                                setRenewalMonths(1)
                                setEditingRenewalId(null)
                                setRenewalModalOpen(true)
                              }}
                            >
                               {!isApiAuthenticated() && renewals.some(item => item.rentalId === rental.id && ['pending', 'approved', 'payment_processing'].includes(item.status)) ? ('Đang xử lý gia hạn') : ('Yêu cầu gia hạn')}
                            </Button>}
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
                        {rental.status === 'setup' && (
                          <Badge variant="warning">Đang setup miễn phí</Badge>
                        )}
                        {rental.status === 'return_requested' && (
                          <Badge variant="warning">{'Đã gửi yêu cầu trả kho'}</Badge>
                        )}
                        {rental.status === 'completed' && (
                          <><span className="inactive-record-alert rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-xs font-bold text-red-800">{'Hồ sơ hết hiệu lực · Mã ra vào đã thu hồi'}</span><Button variant="outline" size="sm" onClick={() => requestConfirmation({ title: 'Xóa lịch sử hồ sơ thuê', message: 'Xóa hồ sơ thuê này khỏi danh sách của bạn? Dữ liệu đối soát vẫn được lưu.', confirmLabel: 'Xóa lịch sử', tone: 'danger', onConfirm: () => { try { archiveRentalHistory(rental.id, user); showToast('Đã xóa lịch sử hồ sơ thuê khỏi danh sách.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử hồ sơ thuê.') } } })}> {'Xóa lịch sử'}</Button></>
                        )}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const start = parseCustomerDate(rental.startDate)
                    if (isApiAuthenticated()) return null
                    const end = parseCustomerDate(rental.endDate)
                    if (!start || !end || rental.status !== 'active') return null
                    const today = new Date(now); today.setHours(0, 0, 0, 0)
                    end.setHours(0, 0, 0, 0)
                    const remainingDays = Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
                    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000)
                    const reminderWindow = totalDays > 31 ? 30 : 7
                    const unfinishedRenewal = renewals.find(item => item.rentalId === rental.id && ['pending', 'approved', 'deposit_paid', 'full_rent_paid', 'appointment_scheduled', 'payment_processing'].includes(item.status))
                    if (remainingDays < 0) {
                      const overdueDays = Math.abs(remainingDays)
                      const lateFeePerDay = Math.round(((rental.monthlyRate / 30) * 0.5) * 100) / 100
                      const currentLateFee = Math.round(overdueDays * lateFeePerDay * 100) / 100
                      return <div className="border-t border-red-300 bg-red-50 px-5 py-4 text-xs text-red-900"><p className="font-bold"> {`Hợp đồng đã quá hạn ${overdueDays} ngày`}</p><p className="mt-1">{`Hợp đồng đã hết hạn ngày ${rental.endDate}. Phí muộn tạm tính hiện tại: ${overdueDays} ngày × ${formatVnd(lateFeePerDay)} = ${formatVnd(currentLateFee)}. ${unfinishedRenewal ? 'Yêu cầu gia hạn vẫn chưa có hiệu lực. Bạn phải đến cơ sở ký tiếp hợp đồng để hoàn tất.' : 'Bạn vẫn có thể gửi yêu cầu gia hạn.'} Phí cuối cùng được tính đến ngày thanh toán hoặc ngày ký hợp đồng gia hạn, tùy ngày nào muộn hơn.`}</p></div>
                    }
                    if (remainingDays > reminderWindow) return null
                    return <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-950"><p className="font-bold"> {'Hợp đồng sắp hết hạn'}</p><p className="mt-1">{`Còn ${remainingDays} ngày đến ${rental.endDate}. ${unfinishedRenewal ? 'Yêu cầu gia hạn chưa thành công. Hãy đến cơ sở ký tiếp hợp đồng và hoàn tất thanh toán.' : 'Vui lòng gửi yêu cầu gia hạn nếu bạn muốn tiếp tục thuê kho.'}`}</p></div>
                  })()}
                  {rental.receiptConfirmedAt && <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-semibold text-emerald-800">{`Đã xác nhận nhận kho lúc ${new Date(rental.receiptConfirmedAt).toLocaleString('vi-VN')}`}</div>}
                  {(() => {
                    const rentalRenewals = renewals.filter(r => r.rentalId === rental.id)
                    if (isApiAuthenticated()) return null
                    if (!rentalRenewals.length) return null
                    return <div className="space-y-2 border-t border-stone-200 px-5 py-4">
                      <p className="text-xs font-bold text-stone-900">{'Yêu cầu gia hạn'}</p>
                      <p className="text-stone-600">{LEGACY_RENEWAL_HISTORY_NOTICE}</p>
                      {rentalRenewals.map(renewal => <div key={renewal.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-bold text-stone-900">{renewal.id} · Kỳ đề nghị đã lưu: {renewal.oldEndDate} → {renewal.newEndDate}</p>
                            <p>Trạng thái đã lưu: {badgeFor(renewal.status)}</p>
                            {renewal.invoiceNumber && <p>Mã chứng từ cũ: <b>{renewal.invoiceNumber}</b></p>}
                            {renewal.paymentDueAt && <p>Hạn thanh toán đã lưu: {new Date(renewal.paymentDueAt).toLocaleString('vi-VN')}</p>}
                            <p>Tiền thuê đã lưu: <b>{legacyRenewalMoney(renewal.totalAmount ?? renewal.renewalFee)}</b></p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => { setActiveRenewalForPayment(renewal); setRenewalPaymentOpen(true) }}>Xem dữ liệu đã lưu</Button>
                        </div>
                      </div>)}

                    </div>
                  })()}
                  {(() => {
                    const returnCase = myReturns.find(item => item.rentalId === rental.id)
                    if (!returnCase) return null
                    const totalDeductions = (returnCase.damageFee || 0) + (returnCase.cleaningFee || 0) + (returnCase.lostItemFee || 0) + (returnCase.overdueFee || 0) + (returnCase.outstandingFee || 0)
                    return <div className="border-t border-stone-200 bg-stone-50 px-5 py-4 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-stone-950">{'Nghiệm thu và quyết toán trả kho'}</p>
                          <p className="mt-1 text-stone-500">{returnCase.id} · {badgeFor(returnCase.status)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-medium text-amber-800 border-amber-300 hover:bg-amber-50"
                            onClick={() => {
                              setSelectedSettlementReturn(returnCase)
                              setSettlementModalOpen(true)
                            }}
                          >
                              Xem hóa đơn & biên lai quyết toán
                          </Button>
                          {returnCase.refundTransaction && (
                            <span className="rounded-lg bg-emerald-100 px-3 py-2 font-bold text-emerald-800">
                              {'Đã hoàn cọc'} {formatVnd(returnCase.refundTransaction.amount)}
                            </span>
                          )}
                        </div>
                      </div>
                      {['awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'].includes(returnCase.status) && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Hiện trạng ban đầu'}</p><p className="mt-1 font-semibold">{returnCase.initialConditionSnapshot}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Kết quả nghiệm thu'}</p><p className="mt-1 font-semibold">{returnCase.damageClassification || '—'} · {returnCase.staffNotes || '—'}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{`Phí quá hạn (${returnCase.overdueDays || 0} ngày)`}</p><p className="mt-1 font-bold text-red-700">{formatVnd(returnCase.overdueFee || 0)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Cọc được hoàn'}</p><p className="mt-1 font-bold text-emerald-700">{formatVnd(returnCase.netRefundAmount)}</p></div><div className={`rounded-lg p-3 ${(returnCase.amountDueFromCustomer || 0) > 0 ? 'bg-red-100' : 'bg-white'}`}><p className="text-stone-500">{'Khách phải đóng thêm'}</p><p className="mt-1 font-bold text-red-700">{formatVnd(returnCase.amountDueFromCustomer || 0)}</p></div></div>}
                      {returnCase.structuralInspection && (
                        <div className="mt-2.5 rounded-lg border border-stone-200 bg-white p-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-stone-700">Kiểm tra kết cấu:</span>
                            <span>Trần: {returnCase.structuralInspection.ceiling === 'leaking' ? 'Dột nước (Lỗi cơ sở)' : returnCase.structuralInspection.ceiling === 'stained' ? 'Loang ố' : 'Khô ráo'}</span>
                            <span>·</span>
                            <span>Vách: {returnCase.structuralInspection.wall === 'damp_seepage' ? 'Thấm ẩm ngoài vào (Lỗi cơ sở)' : 'Khô ráo'}</span>
                            <span>·</span>
                            <span>Sàn: {returnCase.structuralInspection.floor === 'cracked' ? 'Nứt vỡ sàn' : returnCase.structuralInspection.floor === 'water_pooling' ? 'Đọng nước' : 'Khô ráo'}</span>
                          </div>
                          {returnCase.moistureOrigin && returnCase.moistureOrigin !== 'none' && (
                            <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              returnCase.moistureOrigin === 'facility_fault' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {returnCase.moistureOrigin === 'facility_fault' ? 'Xác nhận do lỗi dột thấm cơ sở kho (Được bồi thường)' : 'Do đóng gói ẩm / hàng cấm (Khách chịu phí khử trùng)'}
                            </span>
                          )}
                        </div>
                      )}
                      {returnCase.customerDecisionNote?.includes('Auto-Settlement SLA') && (
                        <div className="mt-2.5 rounded-lg border border-purple-200 bg-purple-50 p-2.5 text-xs text-purple-900 flex items-center gap-2">
                          <span className="font-bold">⚡ Tự động chốt quyết toán (SLA 72h):</span>
                          <span>Hồ sơ đã tự động được nghiệm thu và quyết toán sau 72 giờ không có phản hồi khiếu nại.</span>
                        </div>
                      )}
                      {returnCase.status === 'awaiting_customer_confirmation' && (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                            <span className="text-base leading-none">⏱️</span>
                            <div>
                              <p className="font-bold">Thời hạn phản hồi (SLA 72 giờ)</p>
                              <p className="mt-0.5 text-amber-800">Quý khách vui lòng kiểm tra kỹ biên bản và phản hồi trong 72 giờ. Sau thời hạn này, hệ thống sẽ tự động chốt quyết toán theo biên bản nghiệm thu của nhân viên.</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setReturnDisputeTargetId(returnCase.id); setReturnDisputeReason('') }}>{'Yêu cầu xem xét lại'}</Button>
                            <Button size="sm" onClick={() => { const due = returnCase.amountDueFromCustomer || 0; requestConfirmation({ title: 'Xác nhận quyết toán trả kho', message: due > 0 ? `Tổng phí vượt tiền cọc đảm bảo kho. Sau khi xác nhận, bạn cần đóng thêm ${formatVnd(due)}.` : `Xác nhận quyết toán và yêu cầu hoàn cọc ${formatVnd(returnCase.netRefundAmount)}?`, confirmLabel: 'Đồng ý quyết toán', onConfirm: () => { try { confirmReturnSettlement(returnCase.id, user, 'accepted'); showToast(due > 0 ? (`Đã xác nhận. Vui lòng thanh toán thêm ${formatVnd(due)}.`) : ('Đã xác nhận quyết toán. Hồ sơ và mã ra vào đã hết hiệu lực, đang chờ nhân viên chuyển hoàn cọc.')) } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận quyết toán.') } } }) }}>{'Đồng ý quyết toán'}</Button>
                          </div>
                        </div>
                      )}
                      {returnCase.status === 'payment_due' && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3"><div><p className="font-bold text-red-900">{`Cần thanh toán thêm ${formatVnd(returnCase.amountDueFromCustomer ?? 0)}`}</p><p className="mt-1 text-red-700">{'Sau khi thanh toán, hệ thống sẽ đóng hồ sơ và phát hành biên nhận trong Lịch sử thanh toán.'}</p></div><Button size="sm" onClick={() => requestConfirmation({ title: 'Xác nhận thanh toán', message: `Thanh toán ${formatVnd(returnCase.amountDueFromCustomer ?? 0)} bằng chuyển khoản?`, confirmLabel: 'Thanh toán', onConfirm: () => { const reference = `RET-BAL-${Date.now()}`; try { payReturnBalance(returnCase.id, user, 'BANK_TRANSFER', reference); showToast('Đã thanh toán phần thiếu và phát hành biên nhận.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể thanh toán.') } } })}>{'Thanh toán phần thiếu'}</Button></div>}
                      {returnCase.status === 'disputed' && <p className="mt-3 rounded-lg bg-amber-100 p-3 font-semibold text-amber-900">{'Đang chờ quản lý cơ sở xem xét lại'}: {returnCase.customerDecisionNote}</p>}
                      {returnCase.status === 'refund_pending' && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">{'Hồ sơ thuê và mã ra vào đã hết hiệu lực. Nhân viên đang chuyển hoàn cọc, biên nhận sẽ xuất hiện sau khi xác nhận giao dịch.'}</p>}
                      {rental.status === 'completed' && units.find(unit => unit.id === rental.unitId)?.status === 'maintenance' && <p className="mt-3 rounded-lg border border-stone-300 bg-stone-100 p-3 font-semibold text-stone-700">{'Gian kho đang chờ quản lý cơ sở nghiệm thu vệ sinh hoặc bảo trì. Kho chưa được tính vào số lượng còn trống.'}</p>}
                    </div>
                  })()}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto w-fit text-stone-300">{Icon.key}</div>
              <h2 className="mt-3 font-semibold text-stone-700">{visibleMyRentals.length ? 'Không tìm thấy hồ sơ phù hợp' : 'Chưa có hồ sơ thuê nào đang hoạt động'}</h2>
              <p className="mt-1 text-sm text-stone-500">{visibleMyRentals.length ? 'Hãy chọn lại cơ sở, loại kho hoặc tình trạng thời hạn.' : 'Hồ sơ thuê chỉ được tạo sau khi đơn giữ kho được nhân viên bàn giao thành công.'}</p>
              {visibleMyRentals.length ? <Button className="mt-4" size="sm" variant="outline" onClick={() => { setRentalFacilityFilter('all'); setRentalTypeFilter('all'); setRentalDeadlineFilter('all') }}>Xóa bộ lọc</Button> : <Button className="mt-4" size="sm" onClick={() => navigateTo('browse-units')}>{'Tìm gian kho trống'}</Button>}
            </Card>
          )}
          </section>
        </div>
      )}

      {page === 'contracts' && isApiAuthenticated() && <div className="fade-in space-y-4">
        <SectionHeader title="Hợp đồng của tôi" subtitle="Hồ sơ hợp đồng và văn bản bàn giao được lưu theo reservation trên hệ thống." />
        <Card className="space-y-4 p-5 text-sm text-stone-700">
          <p>Hợp đồng ký và văn bản bàn giao không lấy từ dữ liệu demo. Hãy mở từng hồ sơ đặt kho để xem hoặc tải phiếu xác nhận, văn bản bàn giao và bằng chứng đã lưu trên backend.</p>
          {backendReservations.length > 0 ? <div className="space-y-2">{backendReservations.map(reservation => <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3"><div><p className="font-bold text-stone-900">{reservation.reservationCode}</p><p className="text-xs text-stone-600">{reservation.startDate} → {reservation.endDate} · {reservation.status}</p></div><Button size="sm" variant="outline" onClick={() => { setPage('reservations'); window.setTimeout(() => revealNotificationTarget(reservation.id), 0) }}>Mở hồ sơ</Button></div>)}</div> : <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-500">Chưa có reservation từ backend.</p>}
        </Card>
      </div>}
      {page === 'contracts' && !isApiAuthenticated() && <div className="fade-in space-y-4">
        <SectionHeader title={'Hợp đồng của tôi'} subtitle={'Bản scan hợp đồng giấy đã ký tại cơ sở'} />
        <div className="flex flex-wrap gap-2" aria-label="Lọc hợp đồng">{([['all', 'Tất cả'], ['active', 'Còn hiệu lực'], ['completed', 'Đã kết thúc']] as const).map(([value, label]) => <Button key={value} size="sm" variant={contractFilter === value ? 'primary' : 'outline'} onClick={() => setContractFilter(value)}>{label}</Button>)}</div>
        <Card className="p-4 text-sm text-stone-700"><p className="font-bold">Các điều khoản áp dụng cùng hợp đồng giấy</p><p className="mt-2">Cọc giữ chỗ theo báo giá được trừ vào tiền thuê. Mã xác minh có hiệu lực 10 phút. Sau khi xác minh, hoặc sau khi hàng “Khác” được duyệt, thời hạn thanh toán là 15 phút. Hồ sơ hàng hóa cần duyệt được xử lý theo thứ tự đến trước. Khách đến sớm chỉ được nhận kho sau khi nhân viên xác minh danh tính, hợp đồng, thanh toán và hiện trạng. Khi trả kho, hai bên đối chiếu biên bản, ảnh và từng khoản phí. Khách có quyền yêu cầu xem xét lại trước khi quyết toán. Tiền cọc đảm bảo kho còn lại được hoàn theo chứng từ giao dịch, sau khi trừ công nợ và phí phát sinh đã xác nhận.</p></Card>
        {sortedMyContracts.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sortedMyContracts.map(c => {
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
            <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-3"><a href={c.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-black">{'Xem bản scan'}</a><a href={c.scannedFileUrl} download={c.scannedFileName} className="font-bold underline text-black">{'Tải xuống'}</a>{contractInactive && <Button variant="outline" size="sm" onClick={() => requestConfirmation({ title: 'Xóa lịch sử hợp đồng', message: 'Xóa hợp đồng hết hiệu lực này khỏi danh sách của bạn? Bản lưu đối soát vẫn được giữ.', confirmLabel: 'Xóa lịch sử', tone: 'danger', onConfirm: () => { try { archiveContractHistory(c.id, user); showToast('Đã xóa hợp đồng khỏi danh sách.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa lịch sử hợp đồng.') } } })}> {'Xóa lịch sử'}</Button>}</div>
          </div>
        </Card>})}</div> : <Card className="p-4 text-sm text-stone-500">{'Chưa có hợp đồng giấy đã ký. Hợp đồng sẽ xuất hiện sau khi nhân viên lưu bản scan.'}</Card>}
      </div>}

      {/* ── PAYMENTS ─────────────────────────────────────────── */}
      {page === 'payments' && isApiAuthenticated() && <CustomerPaymentHistory onOpenRentals={(rentalId) => { setPaymentRentalId(rentalId); navigateTo('rental-records') }} />}
      {page === 'payments' && !isApiAuthenticated() && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={'Lịch Sử Thanh Toán & Quyết Toán'}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-stone-500">{'Đã thanh toán'}</p><p className="mt-1 text-2xl font-extrabold text-stone-950">{formatVnd(myPayments.filter(p => p.type !== 'REFUND' && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0))}</p></Card>
            <Card className="p-4"><p className="text-xs text-stone-500">{'Đã hoàn cọc'}</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{formatVnd(myPayments.filter(p => p.type === 'REFUND' && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0))}</p></Card>
            <Card className="p-4"><p className="text-xs text-stone-500">{'Gia hạn chờ thanh toán'}</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{renewals.filter(r => r.customerId === user.id && r.status === 'approved').length}</p></Card>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc lịch sử thanh toán">
            <Button variant={paymentHistoryFilter === 'all' ? 'primary' : 'outline'} onClick={() => setPaymentHistoryFilter('all')}>Tất cả</Button>
            <Button variant={paymentHistoryFilter === 'payments' ? 'primary' : 'outline'} onClick={() => setPaymentHistoryFilter('payments')}>Lịch sử thanh toán</Button>
            <Button variant={paymentHistoryFilter === 'settlement' ? 'primary' : 'outline'} onClick={() => setPaymentHistoryFilter('settlement')}>Quyết toán</Button>
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
                {myPayments.filter(payment => paymentHistoryFilter === 'all' || (paymentHistoryFilter === 'settlement' ? ['DAMAGE_FEE', 'REFUND'].includes(payment.type) : !['DAMAGE_FEE', 'REFUND'].includes(payment.type))).map(payment => {
                  const rental = myRentals.find(r => r.id === payment.rentalId)
                  const hold = myHolds.find(h => h.id === payment.reservationId)
                  const labels: Record<string, string> = { RESERVATION_DEPOSIT: 'Cọc giữ chỗ 20%', INITIAL_RENT: 'Phần còn lại tại cơ sở', RENEWAL: 'Thanh toán gia hạn', DAMAGE_FEE: 'Thanh toán quyết toán trả kho', REFUND: 'Hoàn cọc sau quyết toán' }
                  return <Tr key={payment.id}><Td><span className="text-xs text-stone-600">{payment.transactionReference || payment.id}</span><p className="mt-0.5 text-[10px] text-stone-400">{payment.paidAt ? new Date(payment.paidAt).toLocaleString('vi-VN') : '—'}</p></Td><Td><b>{rental?.unitId || hold?.assignedUnitId || hold?.unitTypeName || '—'}</b><p className="text-[10px] text-stone-400">{rental?.facilityName || hold?.facilityName}</p></Td><Td>{labels[payment.type] || 'Giao dịch thanh toán'}</Td><Td><span className="text-xs text-stone-500">{paymentMethodLabel(payment.paymentMethod)}</span></Td><Td><b className={payment.type === 'REFUND' ? 'text-emerald-700' : 'text-stone-950'}>{payment.type === 'REFUND' ? '+' : ''}{formatVnd(payment.amount)}</b></Td><Td><span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${payment.status === 'PAID' ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{payment.status === 'PAID' ? ('Hoàn tất') : ('Đang xử lý')}</span></Td></Tr>
                })}
                {!myPayments.length && <tr><td colSpan={6}><p className="py-6 text-center text-sm text-stone-500">{'Chưa có giao dịch nào.'}</p></td></tr>}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── POLICIES PAGE ─────────────────────────────────────── */}
      {page === 'policies' && (
        <CustomerRentalRulesPage />
      )}

      {/* ── PROFILE PAGE ─────────────────────────────────────── */}
      {page === 'profile' && (
        <div className="fade-in">
          <ProfileView user={user} onUpdateUser={onUpdateUser} />
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
        title={selectedTarget ? (`Hồ Sơ Kỹ Thuật: ${unitTypeLabel(selectedTarget.unitType.name)} · ${selectedTarget.facility.name}`) : (selectedUnit ? (`Hồ Sơ Kỹ Thuật & Chi Tiết Cỡ Kho`) : '')}
      >
        {selectedUnit && (() => {
          const backendSpec = backendUnitTypes.find(item => item.id === selectedTarget?.unitType.id)
          if (isApiAuthenticated() && selectedTarget) {
            if (!backendSpec) return <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Không tìm thấy thông tin loại kho từ Backend. Vui lòng tải lại dữ liệu trước khi tiếp tục.</div>
            return <CustomerUnitDetails
              unitType={backendSpec} facilityName={selectedTarget.facility.name} facilityCode={selectedTarget.facility.code} address={selectedTarget.facility.address}
              availableCount={availabilityByUnitType[backendSpec.id] ?? backendSpec.availableCount ?? 0}
              rentalPackages={backendRentalPackages}
              allowDefaultImage={false}
              isUserSelected
              onClose={() => setDetailOpen(false)} onReserve={() => handleStartReservation(selectedTarget.facility, selectedTarget.unitType)} />
          }
          const catalogUnit = CUSTOMER_CATALOG_UNITS.find(unit => unit.sizeCode === storageSizeCode(selectedTarget?.unitType.name || selectedUnit.type))

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
                    <h3 className="text-2xl font-bold">{unitTypeLabel(selectedTarget?.unitType.name || selectedUnit.type)}</h3>
                    <p className="mt-1 text-sm font-semibold text-amber-300">Kích thước (Size) {catalogUnit?.sizeCode ?? storageSizeCode(selectedUnit.type)}</p>
                    <p className="mt-1 text-sm text-stone-300">{'Kích thước kho'}: {selectedUnit.dimensions.lengthM} × {selectedUnit.dimensions.widthM} × {selectedUnit.dimensions.heightM} m ({'dài × rộng × cao'})</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{formatVnd(selectedUnit.price)}<span className="text-sm font-normal text-stone-300">/{'tháng'}</span></p>
                    <p className="text-xs font-medium text-white/70">{isApiAuthenticated() ? 'Cọc giữ chỗ theo báo giá của hệ thống' : 'Tiền cọc = 20% tổng giá trị kỳ thuê đã chọn'}</p>
                  </div>
                </div>
              </div>

              {catalogUnit && <figure className="order-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <img src={getCustomerUnitDetailImage(catalogUnit.sizeCode)} alt={`Sơ đồ chi tiết kho size ${catalogUnit.sizeCode}`} className="max-h-[520px] w-full object-contain bg-white" />
                <figcaption className="border-t border-stone-200 px-4 py-3 text-center text-xs font-medium text-stone-600">Sơ đồ bố trí kho size {catalogUnit.sizeCode} · Kích thước và lối đi theo hồ sơ kho</figcaption>
              </figure>}

              <div className="order-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-amber-800">1. Thông tin kho chi tiết</p>
                {catalogUnit && (() => {
                  const displayUnitCode = selectedUnit.code && !selectedUnit.code.toLowerCase().includes('storage')
                    ? selectedUnit.code
                    : `${CUSTOMER_FACILITY_DISPLAY[selectedUnit.facilityId]?.code ?? selectedUnit.facilityId.toUpperCase()}-${catalogUnit.sizeCode}`
                  return (
                    <ul className="divide-y divide-amber-200/70 overflow-hidden rounded-xl border border-amber-200 bg-white text-sm">
                      {[
                        ['Mã kho', displayUnitCode],
                        ['Kích thước / Size', catalogUnit.sizeCode],
                        ['Kích thước kho (D × R × C)', `${selectedUnit.dimensions.lengthM} × ${selectedUnit.dimensions.widthM} × ${selectedUnit.dimensions.heightM} m`],
                        ['Thể tích kho', `${selectedUnit.volumeM3.toLocaleString('vi-VN')} m³`],
                        ['Số khung kệ', `${catalogUnit.rackCount} khung`],
                        ['Kích thước mỗi khung (R × S × C)', catalogUnit.rackDimensions],
                        ['Chiều rộng lối đi', catalogUnit.aisleWidthM > 0 ? `${catalogUnit.aisleWidthM} m` : 'Chưa có dữ liệu'],
                        ['Tải trọng tối đa', `${selectedUnit.maxLoadKg.toLocaleString('vi-VN')} kg`],
                        ['Xe đẩy hỗ trợ', customerTrolleyVi(catalogUnit.sizeCode, catalogUnit.trolley)],
                        ['Giá thuê', `${formatVnd(selectedUnit.price)}/tháng`],
                      ].map(([label, value]) => <li key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr]"><span className="font-medium text-stone-500">{label}</span><b className="text-stone-950">{value}</b></li>)}
                    </ul>
                  )
                })()}
              </div>

              <div className="order-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">2. Thiết bị hỗ trợ</p>
                {catalogUnit && (
                  <div className="space-y-3">
                    {/* Trolley card */}
                    <div className="rounded-xl border border-stone-200 bg-white p-4">
                      <p className="text-xs font-bold text-stone-700 mb-2">Xe đẩy hỗ trợ tại cơ sở</p>
                      <div className="flex items-start gap-3">
                        <div>
                          <p className="font-bold text-stone-950 text-sm">{customerTrolleyVi(catalogUnit.sizeCode, catalogUnit.trolley)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Box capacity */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-bold text-stone-700">Thùng nhỏ (50×40×40 cm)</p>
                        <p className="mt-2 text-2xl font-extrabold text-stone-950">{catalogUnit.smallBoxCapacity}<span className="text-sm font-normal text-stone-500"> thùng</span></p>
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-bold text-stone-700">Thùng to (70×50×50 cm)</p>
                        <p className="mt-2 text-2xl font-extrabold text-stone-950">{catalogUnit.largeBoxCapacity}<span className="text-sm font-normal text-stone-500"> thùng</span></p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Rental Packages Configured by BO */}
              {(() => {
                const fac = facilities.find(f => f.id === selectedUnit.facilityId || f.code === selectedUnit.facilityId)
                const unitSpec = fac?.unitCustomSpecs?.find(s => s.sizeCode === catalogUnit?.sizeCode)
                const activePackages = resolveRentalPackagesForUnit({
                  rentalPackages: selectedUnit.rentalPackages || unitSpec?.rentalPackages,
                  monthlyPrice: selectedUnit.price,
                  sizeCode: catalogUnit?.sizeCode,
                  facilityId: selectedUnit.facilityId
                }).filter(p => p.status === 'active')

                if (activePackages.length === 0) return null

                return (
                  <div className="order-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">

                          <span>Gói thuê ưu đãi cho loại kho này</span>
                        </p>
                        <p className="mt-0.5 text-xs text-emerald-950">
                          Được thiết lập bởi cơ sở cho cỡ kho {catalogUnit?.sizeCode}. Thuê dài hạn để nhận mức giá ưu đãi nhất.
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                        {activePackages.length} gói khả dụng
                      </span>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      {activePackages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-stone-900 text-sm">{pkg.name}</span>
                              {(pkg.discountPercent ?? 0) > 0 ? (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                  Giảm {pkg.discountPercent}%
                                </span>
                              ) : (
                                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                                  Tiêu chuẩn
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-base font-extrabold text-emerald-900">
                              {formatVnd(pkg.packagePrice)}
                            </p>
                            <p className="text-[11px] text-stone-500">
                              ~ {formatVnd(pkg.monthlyEquivalentPrice)}/tháng
                            </p>
                          </div>
                          {pkg.description && (
                            <p className="mt-2 text-[10px] text-stone-600 border-t border-stone-100 pt-1.5 line-clamp-2">
                              {pkg.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-emerald-800">
                      Giá và ưu đãi gia hạn được xác định trong báo giá khi đăng nhập và mở Hồ sơ thuê.
                    </p>
                  </div>
                )
              })()}

              {/* 3. Reservation & Financial Transparency Guarantee */}
              <div className="order-5 rounded-2xl border border-stone-300 bg-white p-4 text-xs text-black sm:p-5">
                <p className="font-bold text-sm text-black mb-1 flex items-center gap-1.5">
                  <span></span> {'3. Quy trình đặt kho và thanh toán'}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {[
                    'Chọn cỡ kho phù hợp',
                    'Xác nhận giữ suất theo loại kho',
                    'Thanh toán cọc 20% trong 15 phút',
                    'Quản lý phân gian trong 6 giờ. Khách nhận kho trong 7 ngày'
                  ].map((item, index) => <div key={item} className="flex gap-2 rounded-xl bg-stone-50 p-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[10px] font-bold text-white">{index + 1}</span><span className="font-medium leading-4 text-stone-700">{item}</span></div>)}
                </div>
              </div>

              <div className="order-6 flex justify-end gap-2 border-t border-stone-100 pt-4">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>{'Đóng lại'}</Button>
                <Button
                  disabled={selectedUnit.status !== 'available' || effectiveAvailableCount(selectedUnit.facilityId, selectedUnit.type) === 0}
                  onClick={() => {
                    if (selectedTarget) {
                      handleStartReservation(selectedTarget.facility, selectedTarget.unitType)
                    } else {
                      setDetailOpen(false)
                      setBookingStartedAt(Date.now())
                      setBookOpen(true)
                    }
                  }}
                >
                  {selectedUnit.status !== 'available' ? ('Loại kho đang hết chỗ') : effectiveAvailableCount(selectedUnit.facilityId, selectedUnit.type) === 0 ? ('Hết kho') : ('Khai báo hàng & Đặt loại kho này')}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── MODAL 2: GOODS DECLARATION & HOLD (P0.1, P0.3, P1.1) ─ */}
      <Modal
        open={bookOpen}
        onClose={() => { resetReservationDraft(); resetBookingForm(); setBookOpen(false); showToast('Đã thoát biểu mẫu đặt kho.') }}
        size="xl"
        title={selectedTarget ? (`Đặt Kho: ${unitTypeLabel(selectedTarget.unitType.name)}`) : (selectedUnit ? ('Đặt kho') : '')}
      >
        {selectedUnit && (
          <div className="space-y-4">
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4" aria-label="Các bước đặt kho">
              {[
                [1, 'Thông tin cá nhân'],
                [2, 'Hàng hóa & số liệu'],
                [3, 'Báo giá'],
                [4, 'Lịch check-in'],
              ].map(([step, label]) => {
                const stepNumber = Number(step)
                const active = bookingStep === stepNumber
                const completed = bookingStep > stepNumber
                return <li key={stepNumber} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${active ? 'border-amber-500 bg-amber-50 text-amber-950' : completed ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-500'}`}>
                  <span className="mr-1.5">{completed ? '✓' : stepNumber}.</span>{label}
                </li>
              })}
            </ol>

            {bookingStep === 2 && <div className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <div className="mb-3 border-b border-stone-200 pb-3">
                <p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-500">Loại kho bạn đang chọn</p>
                <p className="mt-1 font-bold text-black">{unitTypeLabel(selectedTarget?.unitType.name || selectedUnit.type)} · {selectedUnit.facilityName}</p>
              </div>
              <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between sm:gap-2">
                <span className="text-stone-700">Cỡ kho đã chọn:</span>
                <b>{`${unitTypeLabel(selectedTarget?.unitType.name || selectedUnit.type)} (${selectedUnit.areaM2.toLocaleString('vi-VN')} m²)`}</b>
              </div>
              <div className="mt-2 flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between sm:gap-2">
                <span className="text-stone-700">Kích thước & Sức chịu tải:</span>
                <span className="font-medium text-stone-900">{selectedUnit.dimensions.lengthM}m × {selectedUnit.dimensions.widthM}m × {selectedUnit.dimensions.heightM}m (~{selectedUnit.volumeM3} m³) · Max {selectedUnit.maxLoadKg} kg</span>
              </div>
            </div>}

            <div className="space-y-4">
            {Object.keys(bookingErrors).length > 0 && (
              <div ref={bookingErrorRef} role="alert" tabIndex={-1} className="rounded-xl border border-red-700 bg-red-700 p-4 text-sm text-white shadow-lg">
                <p className="font-bold">{'Thông tin chưa hợp lệ'}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{Object.values(bookingErrors).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
              </div>
            )}
            {bookingStep === 1 && <section className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div><p className="font-bold text-stone-900">Thông tin cá nhân</p><p className="mt-1 text-xs text-stone-500">Thông tin dùng để lập hồ sơ và đối chiếu khi nhận kho.</p></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={'Họ và tên người thuê'} value={user.name} disabled />
              <Input label={'Số CCCD / Hộ chiếu * (Đối chiếu lúc nhận kho)'} value={customerIdCard} onChange={e => setCustomerIdCard(e.target.value)} />
              <Input label={'Số điện thoại liên hệ *'} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              {bookingErrors.phone && <p className="text-xs leading-5 text-red-700 sm:col-span-2">{bookingErrors.phone}</p>}
              <Input label="Email" value={customerEmail} disabled />
              <Input label={'Địa chỉ *'} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              </div>
            </section>}

            {bookingStep === 2 && <>
              <section className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="mb-3 font-bold text-stone-900">Nhu cầu thuê kho</p>
              <Select
                label={'Gói thuê & Kỳ hạn'}
                value={isApiAuthenticated() ? selectedPackageId : selectedPackageId || selectedActivePackage?.id || rentalMonths.toString()}
                disabled={isApiAuthenticated() && rentalPackagesLoading}
                onChange={e => {
                  const val = e.target.value
                  if (isApiAuthenticated()) {
                    const pkg = backendRentalPackages.find(item => item.code === val)
                    if (pkg) {
                      setSelectedPackageId(pkg.code)
                      setRentalMonths(pkg.rentalMonths)
                      setServerQuote(null)
                      setServerCompatibility(null)
                      setReservationSubmitError(null)
                    }
                    return
                  }
                  const pkg = selectedUnitActivePackages.find(p => p.id === val || p.months.toString() === val)
                  if (pkg) {
                    setSelectedPackageId(pkg.id)
                    setRentalMonths(pkg.months)
                  } else {
                    const m = Number(val)
                    if (!isNaN(m) && m > 0) {
                      setRentalMonths(m)
                    }
                  }
                }}
              >
                {isApiAuthenticated() ? <>
                  {rentalPackagesLoading && <option value="">Đang tải gói thuê…</option>}
                  {!rentalPackagesLoading && backendRentalPackages.length === 0 && <option value="">Không có gói thuê khả dụng</option>}
                  {backendRentalPackages.map(pkg => <option key={pkg.code} value={pkg.code}>
                    {pkg.rentalMonths} tháng - giảm {Math.round(pkg.discountRate * 100)}%
                  </option>)}
                </> : selectedUnitActivePackages.length > 0 ? (
                  selectedUnitActivePackages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {formatVnd(pkg.packagePrice)} {pkg.discountPercent ? `(Giảm ${pkg.discountPercent}%)` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="1">1 tháng — {formatVnd(currentQuote?.baseMonthlyPrice || selectedUnit?.price || 0)}</option>
                    <option value="3">3 tháng — Giảm 3%</option>
                    <option value="6">6 tháng — Giảm 5%</option>
                    <option value="12">12 tháng — Giảm 8%</option>
                  </>
                )}
              </Select>
              </section>

            {/* Goods Declaration */}
            <div className="border-t border-stone-200 pt-3">
              <p className="mb-3 text-sm font-semibold text-stone-900">Khai báo hàng hóa</p>
              <div className="space-y-3">
                {goodsItems.map((item, index) => <div key={item.id} className="relative rounded-xl border border-stone-200 bg-stone-50 p-3 pr-10">
                  <button type="button" aria-label={`Xóa loại hàng hóa ${index + 1}`} title="Xóa loại hàng hóa" className="absolute right-3 top-2 flex h-7 w-7 items-center justify-center bg-transparent p-0 text-2xl leading-none text-stone-400 transition hover:text-red-700" onClick={() => setGoodsItems(items => items.length === 1 ? [createGoodsDeclarationItem('goods-1')] : items.filter(row => row.id !== item.id))}>×</button>
                  <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                    <div><Select label="Loại hàng hóa" value={item.category} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, category: e.target.value, materialType: '', materialName: '' } : row))}><option value="">Chọn loại hàng hóa</option>{bookingCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>{bookingErrors[`goodsCategory-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`goodsCategory-${item.id}`]}</p>}</div>
                     {!catalogCategoryFor(item.category)?.custom ? <div><Select label="Chất liệu chính" value={item.materialName} disabled={!item.category} onChange={e => { const materialName = e.target.value; const material = bookingMaterials(item.category).find(value => value.label === materialName); const materialType: GoodsDeclarationItem['materialType'] = !materialName ? '' : material?.fragile ? 'FRAGILE' : 'NORMAL'; setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, materialName, materialType, fragile: materialType === 'FRAGILE' ? 'yes' : row.fragile } : row)) }}><option value="">Chọn chất liệu cụ thể</option>{item.category && bookingMaterials(item.category).map(material => <option key={material.id} value={material.label}>{material.label}</option>)}</Select>{bookingErrors[`goodsMaterial-${item.id}`] && <p className="mt-1 text-xs text-red-700">Vui lòng chọn chất liệu chính.</p>}</div> : <div className="self-end rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Cần nhân viên cơ sở duyệt trước khi thu cọc</div>}
                  </div>
                   <div className="mt-4"><label className="text-sm font-medium text-stone-700">Mô tả hàng hóa *</label><textarea className="mt-1 min-h-20 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={item.description} placeholder="Mô tả tên đồ vật, tình trạng hoặc đặc điểm cần lưu ý" onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, description: e.target.value } : row))} />{bookingErrors[`goodsDescription-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`goodsDescription-${item.id}`]}</p>}</div>
                  <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-950">Kích thước tính theo từng kiện/chiếc. Với tủ lạnh hoặc đồ cồng kềnh, hãy nhập kích thước phủ bì thực tế của từng chiếc; hệ thống sẽ cộng theo số lượng.</p>
                  <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-5 sm:items-start">
                     <div className="flex h-full flex-col"><Input type="number" min="1" step="1" label="Số lượng *" value={item.quantity} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, quantity: e.target.value } : row))} /><p className="mt-1 min-h-8 text-xs text-red-700">{bookingErrors[`goodsQuantity-${item.id}`] || ''}</p></div>
                     <div className="flex h-full flex-col"><Input type="number" min="0.1" label="Dài (cm) *" value={item.lengthCm} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, lengthCm: e.target.value } : row))} /><p className="mt-1 min-h-8 text-xs text-red-700">{bookingErrors[`goodsLength-${item.id}`] || ''}</p></div>
                     <div className="flex h-full flex-col"><Input type="number" min="0.1" label="Rộng (cm) *" value={item.widthCm} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, widthCm: e.target.value } : row))} /><p className="mt-1 min-h-8 text-xs text-red-700">{bookingErrors[`goodsWidth-${item.id}`] || ''}</p></div>
                     <div className="flex h-full flex-col"><Input type="number" min="0.1" label="Cao (cm) *" value={item.heightCm} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, heightCm: e.target.value } : row))} /><p className="mt-1 min-h-8 text-xs text-red-700">{bookingErrors[`goodsHeight-${item.id}`] || ''}</p></div>
                     <div className="flex h-full flex-col"><Input type="number" min="0.1" label="Nặng/kiện (kg) *" value={item.weightKg} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, weightKg: e.target.value } : row))} /><p className="mt-1 min-h-8 text-xs text-red-700">{bookingErrors[`goodsWeight-${item.id}`] || ''}</p></div>
                  </div>
                  <div className="mt-3"><p className="text-sm font-medium text-stone-700">Hàng dễ bể / dễ vỡ? *</p><div className="mt-2 flex gap-5"><label className="flex items-center gap-2 text-sm"><input type="radio" name={`fragile-${item.id}`} checked={item.fragile === 'no'} onChange={() => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, fragile: 'no' } : row))} />Không</label><label className="flex items-center gap-2 text-sm"><input type="radio" name={`fragile-${item.id}`} checked={item.fragile === 'yes'} onChange={() => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, fragile: 'yes' } : row))} />Có</label></div>{bookingErrors[`goodsFragile-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`goodsFragile-${item.id}`]}</p>}{bookingErrors[`goodsFit-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`goodsFit-${item.id}`]}</p>}</div>
                   <details open className="mt-4 rounded-lg border border-stone-200 bg-white p-3">
                    <summary className="cursor-pointer font-bold text-stone-900">Thông tin bổ sung và hình ảnh hàng hóa</summary>
                    <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
                      {catalogCategoryFor(item.category)?.custom && <div className="grid gap-3 sm:grid-cols-2">
                        <div><Input label="Tên hàng hóa *" value={item.customGoodsName} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, customGoodsName: e.target.value } : row))} />{bookingErrors[`customGoodsName-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customGoodsName-${item.id}`]}</p>}</div>
                        <div><Input label="Chất liệu chính *" value={item.customMaterial} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, customMaterial: e.target.value } : row))} />{bookingErrors[`customMaterial-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`customMaterial-${item.id}`]}</p>}</div>
                      </div>}
                      <Input label="Ghi chú bổ sung" value={item.customerNote} onChange={e => setGoodsItems(items => items.map(row => row.id === item.id ? { ...row, customerNote: e.target.value } : row))} />
                      <div><label className="text-sm font-medium text-stone-700">Hình ảnh hàng hóa</label><p className="mt-1 text-xs text-stone-500">Tối đa 10 ảnh PNG, JPEG hoặc WebP. Ảnh được gắn với đúng hàng hóa sau khi tạo đơn.</p><input type="file" accept="image/png,image/jpeg,image/webp" multiple className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" onChange={event => selectGoodsImages(item.id, event)} />{item.images.length > 0 && <p className="mt-1 text-xs text-stone-500">Đã chọn {item.images.length}/10 ảnh: {item.images.map(file => file.name).join(', ')}</p>}{bookingErrors[`goodsImages-${item.id}`] && <p className="mt-1 text-xs text-red-700">{bookingErrors[`goodsImages-${item.id}`]}</p>}</div>
                      {catalogCategoryFor(item.category)?.custom && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><b>Yêu cầu cần nhân viên cơ sở duyệt</b><p className="mt-1 leading-5">Sau khi xác nhận thư điện tử, yêu cầu sẽ được xem xét trong tối đa 6 giờ. Sau khi hồ sơ được duyệt, khách hàng có 15 phút để thanh toán. Quản lý cơ sở có tối đa 6 giờ tiếp theo để phân kho.</p></div>}
                    </div>
                  </details>
                </div>)}
              </div>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setGoodsItems(items => [...items, createGoodsDeclarationItem()])}>+ Thêm hàng hóa</Button>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <Input label={'Tình trạng đóng gói chung *'} value={goodsCondition} onChange={e => setGoodsCondition(e.target.value)} />
              </div>

            </div>

            {allPackageSamplesValid && isApiAuthenticated() && recommendationLoading && (
              <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                Đang kiểm tra dữ liệu kho, kích thước, tải trọng và kỳ thuê trên hệ thống…
              </div>
            )}
            {allPackageSamplesValid && warehouseRecommendation && (
              <div className={`rounded-xl border p-4 text-sm ${selectedUnitTypeIncompatible ? 'border-red-300 bg-red-50 text-red-950' : warehouseRecommendation.id === selectedTarget?.unitType.id ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{smallerWarehouseRecommendation ? 'Hệ thống đề xuất kho nhỏ hơn' : largerWarehouseRecommendation ? 'Hệ thống đề xuất kho lớn hơn' : isApiAuthenticated() ? (recommendationNeedsReview ? 'Hệ thống đề xuất kho — cần nhân viên duyệt' : 'Hệ thống đề xuất kho phù hợp') : 'Gợi ý kho phù hợp theo số lượng và kích thước đã nhập'}</p>
                    <p className="mt-1 text-xs leading-5">Cỡ nhỏ nhất còn chỗ và chứa vừa toàn bộ hàng hóa là <b>{unitTypeLabel(warehouseRecommendation.name || warehouseRecommendation.code)}</b> (~{warehouseRecommendation.volumeM3.toLocaleString('vi-VN')} m³, {warehouseRecommendation.rackCount} khung).</p>
                    {selectedUnitTypeIncompatible && <p className="mt-1 text-xs font-semibold text-red-800">Kho bạn tự chọn không còn phù hợp với hàng hóa hoặc không còn chỗ trong kỳ thuê này.</p>}
                    {warehouseRecommendation.id === selectedTarget?.unitType.id
                      ? <p className="mt-1 text-xs font-semibold">Kho bạn đang chọn cũng chính là kho hệ thống đề xuất.</p>
                      : largerWarehouseRecommendation
                        ? <p className="mt-1 text-xs">Kho bạn đang chọn không đủ sức chứa; hãy chuyển sang kho lớn hơn được đề xuất.</p>
                        : <p className="mt-1 text-xs">Kho hiện tại vẫn phù hợp; hệ thống đề xuất kho nhỏ hơn để tránh dư dung tích và chi phí.</p>}
                  </div>
                  {warehouseRecommendation.id !== selectedTarget?.unitType.id && selectedTarget && recommendedUnitType && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleStartReservation(selectedTarget.facility, recommendedUnitType, undefined, 2)
                        showToast(`Đã chuyển sang cỡ kho gợi ý: ${unitTypeLabel(recommendedUnitType.name)}`)
                      }}
                    >
                      {smallerWarehouseRecommendation ? 'Chuyển sang kho nhỏ hơn' : largerWarehouseRecommendation ? 'Chuyển sang kho lớn hơn' : 'Chọn cỡ kho được gợi ý'}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {allPackageSamplesValid && isApiAuthenticated() && recommendationFormReady && !recommendationLoading && recommendationError && (
              <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <b>Không thể kiểm tra kho phù hợp</b>
                <p className="mt-1 text-xs">{recommendationError}</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setRecommendationRetry(value => value + 1)}>
                  Thử lại
                </Button>
              </div>
            )}
            {allPackageSamplesValid && (!isApiAuthenticated() || recommendationFormReady) && !recommendationLoading && !recommendationError && !warehouseRecommendation && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              <b>Chưa có cỡ kho còn trống phù hợp</b>
              <p className="mt-1 text-xs">
                {noValidLargerUnitAvailable && largestAvailableLargerUnitType
                  ? `Kho lớn nhất còn chỗ là ${unitTypeLabel(largestAvailableLargerUnitType.name)}, nhưng chỉ đáp ứng tối đa ${largestAvailableLargerUnitType.maxLoadKg.toLocaleString('vi-VN')} kg và khoảng ${largestAvailableLargerUnitUsableVolumeM3.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m³ hữu dụng; hàng đang khai báo ${goodsWeightNumber.toLocaleString('vi-VN')} kg và ${goodsVolumeM3.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m³. Vui lòng giảm số lượng, kích thước hoặc trọng lượng hàng hóa, hoặc chia thành nhiều kho.`
                  : isApiAuthenticated() ? (serverRecommendation?.issues.join(' ') || 'Dữ liệu hàng hóa không phù hợp với các loại kho đang còn chỗ tại cơ sở này.') : 'Kích thước, số lượng hoặc tổng tải trọng hàng hóa vượt khả năng của các cỡ kho đang còn chỗ tại cơ sở này.'}
              </p>
            </div>}

            {/* Check-in schedule is intentionally placed after goods declaration because OTHER goods add a review stage. */}
            </>}

            {bookingStep === 4 && <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">Chọn ngày giờ nhận kho</p>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  Lịch hợp lệ từ <b>{formatPolicyDateTime(checkInWindow.availableAt)}</b> đến <b>{formatPolicyDateTime(checkInWindow.deadlineAt)}</b>.
                </p>
              </div>
              {schedulePolicyMessage && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950">{schedulePolicyMessage}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><VietnameseDateInput value={moveInDate} min={earliestCheckInDate} max={latestCheckInDate} onChange={value => { setMoveInDate(value); setSchedulePolicyMessage(null); setBookingErrors(current => { const next = { ...current }; delete next.moveInDate; return next }) }} />{bookingErrors.moveInDate && <p className="mt-1 text-xs text-red-700">{bookingErrors.moveInDate}</p>}</div>
                <div><Input label="Giờ nhận kho mong muốn" type="time" step="60" value={bookingAppointmentTime} onChange={e => { setBookingAppointmentTime(e.target.value); setSchedulePolicyMessage(null); setBookingErrors(current => { const next = { ...current }; delete next.appointmentTime; return next }) }} />{bookingErrors.appointmentTime && <p className="mt-1 text-xs text-red-700">{bookingErrors.appointmentTime}</p>}</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">
                <b>Ngày bắt đầu tính kỳ thuê:</b> {earliestCheckInDate}. Kỳ thuê bắt đầu từ ngày kho sẵn sàng sớm nhất, không phụ thuộc việc bạn chọn đến muộn hơn trong thời hạn 7 ngày.
              </div>
              {isApiAuthenticated() && serverQuote && <div className="space-y-2 text-xs leading-5 text-stone-600">
                {serverQuote.setupEarlyExitPolicyVersion && serverQuote.setupEarlyExitFee != null ? <>
                  <p><b className="text-stone-900">Điều khoản trả kho trong setup:</b> nếu khách chủ động trả kho sau bàn giao và kho được nghiệm thu trống trước khi hết setup, phí chấm dứt sớm một lần là <b>{formatVnd(serverQuote.setupEarlyExitFee)}</b> theo báo giá đã chốt. Tiền thuê và cọc bảo đảm thực thu được quyết toán sau khi trừ phí này, chi phí có chứng cứ và công nợ đã xác minh. Khoản trả trước đã nằm trong tiền thuê. Trả thực tế sau setup áp dụng quyết toán kỳ thuê đã bắt đầu.</p>
                  <label className="flex items-start gap-2 text-stone-700">
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-amber-600" checked={acceptedSetupQuoteId === serverQuote.quoteId} disabled={reservationSubmitting} onChange={event => setAcceptedSetupQuoteId(event.target.checked ? serverQuote.quoteId : null)} />
                    <span>Tôi đã đọc và đồng ý điều khoản trả kho trong setup của báo giá này.</span>
                  </label>
                </> : <p role="status">Báo giá chưa có điều khoản trả kho trong setup. Vui lòng quay lại lấy báo giá mới hoặc liên hệ cơ sở.</p>}
              </div>}
            </div>}

            {bookingStep === 2 && <>

            {/* Storage Space & Cost Breakdown */}
            <p className="text-xs leading-5 text-stone-600">Thể tích mỗi loại hàng (m³) = số lượng × dài × rộng × cao (cm) ÷ 1.000.000. Tổng thể tích là tổng của tất cả loại hàng; kích thước khai báo là kích thước mỗi kiện sau đóng gói.</p>
            {(() => {
              if (isApiAuthenticated()) return <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-sm text-stone-700">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-stone-900">Kiểm tra sức chứa theo khung và cân nặng</p>{capacityStatus !== 'invalid' && <span className={`rounded-full px-3 py-1 text-xs font-bold ${packagesFitSelectedUnit && goodsWeightNumber <= selectedUnit.maxLoadKg ? smallerWarehouseRecommendation ? 'bg-amber-600 text-white' : 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>{packagesFitSelectedUnit && goodsWeightNumber <= selectedUnit.maxLoadKg ? smallerWarehouseRecommendation ? 'Phù hợp — có thể dùng kho nhỏ hơn' : 'Phù hợp' : 'Không phù hợp'}</span>}</div>
                {capacityStatus === 'invalid' ? <p className="rounded-lg bg-white p-3 text-stone-500">Nhập đủ số lượng, kích thước và cân nặng ở từng hàng hóa để tính.</p> : <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">{packageCapacityResults.map(sample => <div key={sample.id} className="grid gap-1 border-b border-stone-100 pb-2 last:border-0 sm:grid-cols-[1fr_auto]"><span><b>{sample.sourceLabel}</b>: {sample.quantity} kiện · {sample.lengthCm} × {sample.widthCm} × {sample.heightCm} cm · {sample.weightKg} kg/kiện · <b>{formatVolumeM3(packageVolumeM3(sample))} m³</b></span>{!sample.canFitFrame && <b className="text-red-700">Không xếp vừa khung</b>}</div>)}<div className="grid gap-2 border-t border-stone-200 pt-3 sm:grid-cols-3"><p><b>Tổng thể tích cần lưu:</b> <span>{formatVolumeM3(serverCompatibility?.totalGoodsVolumeM3 ?? goodsVolumeM3)} m³</span></p><p><b>Sức chứa khung hữu dụng:</b> <span>{formatVolumeM3(serverCompatibility?.usableVolumePerRackM3 ? serverCompatibility.usableVolumePerRackM3 * selectedRackCount : selectedUsableRackVolumeM3)} m³</span></p><p><b>Khung cần dùng:</b> <span className={packagesFitSelectedUnit ? 'text-emerald-700' : 'text-red-700'}>{hasUnplaceablePackage ? 'Không xác định' : totalFramesRequired} khung / {selectedRackCount} khung</span></p><p><b>Tổng cân nặng:</b> <span className={goodsWeightNumber <= selectedUnit.maxLoadKg ? 'text-emerald-700' : 'text-red-700'}>{goodsWeightNumber.toLocaleString('vi-VN')} / {selectedUnit.maxLoadKg.toLocaleString('vi-VN')} kg</span></p></div></div>}
                {hasOtherGoods && <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950"><p className="font-bold">Hồ sơ cần được thẩm định</p><p className="mt-1 leading-5">Hàng hóa thuộc nhóm “Khác” được nhân viên cơ sở xem xét trong tối đa 6 giờ kể từ khi bạn xác minh email. Sau khi chấp thuận, bạn có 15 phút để hoàn tất tiền cọc giữ chỗ.</p></div>}
                {selectedUnitNeedsAlternative && smallerWarehouseRecommendation && selectedTarget && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                    <p className="font-bold">Kho đang chọn không phù hợp</p>
                    <p className="mt-1 leading-5">Hệ thống tìm thấy kho nhỏ hơn vẫn đáp ứng kích thước, sức chứa và tải trọng của hàng hóa: <b>{unitTypeLabel(smallerWarehouseRecommendation.name)}</b>.</p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        handleStartReservation(selectedTarget.facility, smallerWarehouseRecommendation, undefined, 2)
                        showToast(`Đã chuyển sang kho nhỏ hơn: ${unitTypeLabel(smallerWarehouseRecommendation.name)}`)
                      }}
                    >
                      Chuyển sang kho nhỏ hơn
                    </Button>
                  </div>
                )}
              </div>
              const isOverload = goodsWeightNumber > selectedUnit.maxLoadKg
              const totalTermValue = Math.max(0, currentQuote!.baseMonthlyPrice * rentalMonths - totalCombinedDiscount)
              const reservationDeposit = Math.round(totalTermValue * 0.2 * 100) / 100
              const remainingPayment = Math.max(0, totalTermValue - reservationDeposit)
              const conditionSecurityDeposit = currentQuote!.depositAmount || currentQuote!.baseMonthlyPrice
              const dueAtCheckIn = remainingPayment + conditionSecurityDeposit
              const initialObligation = totalTermValue + conditionSecurityDeposit

              return (
                <div className="rounded-xl border border-stone-200 bg-gradient-to-b from-stone-50/90 to-amber-50/40 p-4 text-xs text-stone-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <div>
                      <p className="font-bold text-sm text-stone-900">Kiểm tra sức chứa theo khung & dự toán chi phí</p>
                      <p className="text-[11px] text-stone-500">Mỗi khung {formatRackDimensions(selectedRackDimensions)} m. Sức chứa hữu dụng tính tối đa 80% thể tích; hệ thống thử đủ 6 hướng xoay.</p>
                    </div>
                    {capacityStatus !== 'invalid' && <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${packagesFitSelectedUnit && !isOverload ? smallerWarehouseRecommendation ? 'border-amber-600 bg-amber-600 text-white' : 'border-emerald-700 bg-emerald-700 text-white' : 'border-red-700 bg-red-700 text-white'}`}>{packagesFitSelectedUnit && !isOverload ? smallerWarehouseRecommendation ? 'Kho chứa vừa — có thể dùng kho nhỏ hơn' : 'Kho chứa vừa' : 'Kho không chứa vừa'}</span>}
                  </div>

                  {capacityStatus === 'invalid' ? <div className="rounded-lg border border-stone-300 bg-stone-100 p-4 text-center font-medium text-stone-600">Chưa đủ dữ liệu để kiểm tra sức chứa. Vui lòng nhập đầy đủ số lượng và kích thước hàng hóa hợp lệ.</div> : <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
                    {packageCapacityResults.map((sample, index) => <div key={sample.id} className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-2 last:border-0 last:pb-0"><span>{sample.sourceLabel || `Mẫu ${index + 1}`}: {sample.quantity || '—'} kiện · {sample.lengthCm || '—'} × {sample.widthCm || '—'} × {sample.heightCm || '—'} cm · {sample.weightKg || '—'} kg/kiện · tổng {(Number(sample.quantity) * Number(sample.weightKg)).toLocaleString('vi-VN')} kg · <b>{formatVolumeM3(packageVolumeM3(sample))} m³</b></span>{!sample.canFitFrame && <b className="text-red-700">Không thể xếp vào khung {formatRackDimensions(selectedRackDimensions)} m</b>}</div>)}
                    <div className="grid gap-2 border-t border-stone-100 pt-2 text-sm sm:grid-cols-2"><span><b>Tổng thể tích cần lưu:</b> {formatVolumeM3(serverCompatibility?.totalGoodsVolumeM3 ?? goodsVolumeM3)} m³</span><span><b>Sức chứa khung hữu dụng:</b> {formatVolumeM3(serverCompatibility?.usableVolumePerRackM3 ? serverCompatibility.usableVolumePerRackM3 * selectedRackCount : selectedUsableRackVolumeM3)} m³</span><span className="sm:text-right"><b>Khung cần dùng:</b> <b className={packagesFitSelectedUnit ? 'text-emerald-700' : 'text-red-700'}>{hasUnplaceablePackage ? 'Không xác định' : totalFramesRequired} khung / {selectedRackCount} khung</b></span></div>
                    {warehouseRecommendation && <p className="border-t border-stone-100 pt-2 text-emerald-700">Cỡ kho nhỏ nhất phù hợp: <b>{storageSizeCode(warehouseRecommendation.name || warehouseRecommendation.code)}</b></p>}
                  </div>}

                  {/* Floor Weight Check */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-600">{'Tải trọng hàng hóa thực tế:'}</span>
                    <span className={isOverload ? 'font-bold text-red-700' : 'font-semibold text-black'}>{goodsWeightNumber > 0 ? goodsWeightNumber.toLocaleString('vi-VN') : '—'} kg / Sức chịu tải sàn {selectedUnit.maxLoadKg} kg {isOverload ? '(Vượt tải trọng)' : ''}</span>
                  </div>

                  {capacityStatus !== 'invalid' && (hasOtherGoods ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><b>Chưa yêu cầu thanh toán tiền cọc</b><p className="mt-1">Đơn đặt kho có hàng hóa “Khác” sẽ được giữ kho và chuyển cho nhân viên cơ sở duyệt. Dự toán và bước thanh toán chỉ mở sau khi hồ sơ được chấp thuận.</p></div> : <div className="space-y-2 border-t border-stone-200 pt-3"><p className="font-bold text-stone-900">Cách tính số tiền</p><div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2"><div className="flex justify-between gap-4"><span>Tiền thuê gốc</span><b>{formatVnd(grossTermValue)}</b></div>{promotionDiscount > 0 && <div className="flex justify-between gap-4 text-emerald-700"><span>Ưu đãi thời hạn ({Math.round(discountRate * 100)}%)</span><b>{formatVnd(promotionDiscount)}</b></div>}{evaluatedPolicyBenefits.filter(b => b.isDiscount).map(b => <div key={b.policy.id} className="flex justify-between gap-4 text-emerald-700"><span className="flex items-center gap-1"><span>Ưu đãi cơ sở ({b.policy.name}): {b.policy.value}</span></span><b>{formatVnd(b.discountAmount)}</b></div>)}<div className="flex justify-between gap-4"><span>Tiền thuê sau giảm</span><b>{formatVnd(totalTermValue)}</b></div><div className="flex justify-between gap-4"><span>Cọc giữ chỗ 20% (được trừ vào tiền thuê)</span><b>{formatVnd(reservationDeposit)}</b></div><div className="flex justify-between gap-4 text-amber-800"><span>Tiền cọc đảm bảo kho (bằng 1 tháng tiền thuê)</span><b>{formatVnd(conditionSecurityDeposit)}</b></div><div className="flex justify-between gap-4"><span>Thu tại nhận kho (tiền thuê còn lại + tiền cọc đảm bảo kho)</span><b>{formatVnd(dueAtCheckIn)}</b></div><div className="flex justify-between gap-4 border-t border-stone-200 pt-2 font-bold"><span>Tổng tiền thuê và tiền cọc đảm bảo kho</span><b>{formatVnd(initialObligation)}</b></div></div></div>)}

                    <div className="rounded-lg bg-stone-100 p-3 text-[11px] text-black"><b>Cam kết minh bạch của StorageHub:</b><ul className="mt-1 list-disc space-y-0.5 pl-5 text-stone-600"><li>Mã OTP có hiệu lực 10 phút. Thời hạn thanh toán bắt đầu sau khi xác minh hoặc sau khi hồ sơ hàng “Khác” được duyệt.</li><li>{hasOtherGoods ? 'Hàng hóa “Khác” được xét duyệt trong tối đa 6 giờ. Sau khi duyệt có 15 phút để thanh toán.' : 'Sau khi xác minh email, bạn có 15 phút để thanh toán cọc 20% theo báo giá.'}</li><li>Quản lý cơ sở có tối đa 6 giờ để phân kho. Khách hàng chọn lịch nhận kho trong thời hạn 7 ngày từ thời điểm kho có thể sẵn sàng.</li></ul></div>
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
                          const upgradeType = validationViolation.suggestedUnitTypeId
                            ? unitTypes.find(ut => ut.id === validationViolation.suggestedUnitTypeId)
                            : undefined
                          if (upgradeType && selectedTarget) {
                            handleStartReservation(selectedTarget.facility, upgradeType, undefined, 2)
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
            </>}
            </div>

            {bookingStep === 3 && bookingReview && isApiAuthenticated() && serverQuote && <ReservationQuoteSummary quote={serverQuote} needsReview={hasOtherGoods} />}
            {bookingStep === 3 && bookingReview && isApiAuthenticated() && serverQuote && <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" className="mt-1 h-4 w-4" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} /><span>Tôi đã đọc và đồng ý với báo giá, ngày setup miễn phí, phí chấm dứt sớm và cách tính lại ưu đãi nêu trên. Bản điều khoản này sẽ được lưu cùng hồ sơ trước khi thanh toán.</span></label>}
            {bookingStep === 3 && bookingReview && !isApiAuthenticated() && (() => {
              const totalValue = Math.max(0, currentQuote!.baseMonthlyPrice * rentalMonths - totalCombinedDiscount)
              const deposit = Math.round(totalValue * 0.2 * 100) / 100
              const securityDeposit = currentQuote!.depositAmount || currentQuote!.baseMonthlyPrice
              const dueAtCheckIn = totalValue - deposit + securityDeposit
              return (
                <div className="space-y-6 rounded-2xl border-2 border-black bg-white p-6 text-sm text-black sm:p-8">
                  <div className="flex items-start justify-between gap-6 border-b border-stone-200 pb-5">
                    <div><p className="text-xs font-bold uppercase tracking-[.12em] text-stone-500">{'Bước cuối'}</p><h3 className="mt-1 text-lg font-bold">{'Xác nhận thông tin đặt kho'}</h3></div>
                    <button className="text-xs font-bold underline" onClick={() => setBookingReview(false)}>{'Quay lại chỉnh sửa'}</button>
                  </div>

                  <div className={`rounded-lg border p-3 ${packagesFitSelectedUnit ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className={`font-bold ${packagesFitSelectedUnit ? 'text-emerald-900' : 'text-red-900'}`}>Kiểm tra sức chứa theo khung</p><p className="mt-0.5 text-[11px] text-stone-600">Cần {totalFramesRequired} / {selectedRackCount} khung · gộp tổng thể tích ở mức sử dụng 80%, từng kiện được thử đủ 6 hướng xoay</p></div>
                      <span className={`font-bold ${packagesFitSelectedUnit ? 'text-emerald-800' : 'text-red-800'}`}>{packagesFitSelectedUnit ? 'Kho chứa vừa' : 'Kho không chứa vừa'}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-stone-200 border-y border-stone-200">
                    <section className="space-y-1 py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Người thuê</p><p><b>Họ và tên:</b> {user.name}</p><p><b>CCCD/Hộ chiếu:</b> {customerIdCard}</p><p><b>Số điện thoại:</b> {customerPhone}</p><p><b>Email:</b> {customerEmail}</p><p><b>Địa chỉ:</b> {customerAddress}</p></section>
                    <section className="space-y-1 py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Kho đã chọn</p><p><b>Cỡ kho và cơ sở:</b> {selectedTarget?.unitType.name || selectedUnit.type} · {selectedUnit.facilityName}</p><p><b>Kích thước kho:</b> {selectedUnit.dimensions.lengthM} × {selectedUnit.dimensions.widthM} × {selectedUnit.dimensions.heightM} m</p><p><b>Khung chứa hàng:</b> {selectedRackCount} khung · {formatRackDimensions(selectedRackDimensions)} m/khung</p></section>
                    <section className="py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Hàng hóa và sức chứa</p><ul className="list-disc space-y-1 pl-5">{packageCapacityResults.map((sample, index) => <li key={sample.id}><b>{sample.sourceLabel || `Hàng hóa ${index + 1}`}:</b> {sample.quantity} kiện · {sample.lengthCm} × {sample.widthCm} × {sample.heightCm} cm · {sample.weightKg} kg/kiện · tổng {(Number(sample.quantity) * Number(sample.weightKg)).toLocaleString('vi-VN')} kg{!sample.canFitFrame && ' · không thể xếp vừa khung'}</li>)}</ul><p className="mt-3"><b>Tổng số kiện:</b> {packageCountNumber}</p><p><b>Tổng thể tích:</b> {formatVolumeM3(serverCompatibility?.totalGoodsVolumeM3 ?? goodsVolumeM3)} m³</p><p><b>Sức chứa khung hữu dụng:</b> {formatVolumeM3(serverCompatibility?.usableVolumePerRackM3 ? serverCompatibility.usableVolumePerRackM3 * selectedRackCount : selectedUsableRackVolumeM3)} m³</p><p><b>Khung cần dùng:</b> {hasUnplaceablePackage ? 'Không xác định' : totalFramesRequired} khung / {selectedRackCount} khung</p><p className="text-xs text-stone-500">Mỗi kiện được tính theo kích thước thực tế; tổng thể tích = số lượng × dài × rộng × cao. Sức chứa khung đã trừ 20% khoảng trống.</p><p><b>Tổng cân nặng:</b> {goodsWeightNumber.toLocaleString('vi-VN')} / {selectedUnit.maxLoadKg.toLocaleString('vi-VN')} kg</p><p><b>Tình trạng đóng gói:</b> {goodsCondition}</p></section>
                    <section className="space-y-1 py-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Thời gian thuê</p><p><b>Lịch nhận kho:</b> {displayDateValue(moveInDate)} · {bookingAppointmentTime}</p><p><b>Ngày bắt đầu kỳ thuê:</b> {displayDateValue(earliestCheckInDate)}</p><p><b>Gói thuê đã chọn:</b> {selectedActivePackage?.name || `${rentalMonths} tháng`} · {formatVnd(selectedActivePackage?.packagePrice || totalValue)}</p><p className="pt-1 font-semibold text-red-700">Nếu đổi lịch, thời điểm mới vẫn phải nằm trong thời hạn nhận kho 7 ngày.</p></section>
                  </div>
                  {hasOtherGoods ? <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center text-blue-950"><b>Xác minh email trước khi nhân viên duyệt · Chưa thu tiền cọc</b><p className="mt-1 text-xs">Kho chưa bị khóa khi chờ duyệt. Sau khi xác minh email, nhân viên có tối đa 6 giờ để xét duyệt.</p></div> : <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-100 p-4 text-center sm:grid-cols-5">
                    <div><p className="text-xs text-stone-500">Giảm giá {facilityPolicyDiscount > 0 ? '(Gồm ưu đãi cơ sở)' : `(${Math.round(discountRate * 100)}%)`}</p><p className="mt-1 font-bold text-emerald-700">{formatVnd(totalCombinedDiscount)}</p><p className="text-[10px] text-stone-500">Gốc {formatVnd(grossTermValue)}</p></div>
                    <div><p className="text-xs text-stone-500">Tiền thuê sau giảm</p><p className="mt-1 font-bold">{formatVnd(totalValue)}</p></div>
                    <div><p className="text-xs text-stone-500">{'Cọc giữ chỗ 20%'}</p><p className="mt-1 font-bold">{formatVnd(deposit)}</p></div>
                    <div><p className="text-xs text-stone-500">Tiền cọc đảm bảo kho</p><p className="mt-1 font-bold text-amber-800">{formatVnd(securityDeposit)}</p><p className="text-[10px] text-stone-500">Bằng 1 tháng tiền thuê</p></div>
                    <div><p className="text-xs text-stone-500">{'Thu tại nhận kho'}</p><p className="mt-1 font-bold">{formatVnd(dueAtCheckIn)}</p></div>
                  </div>}
                  {evaluatedPolicyBenefits.some(b => b.isDiscount) && (
                    <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950">
                      <p className="font-bold flex items-center gap-1.5 text-emerald-900">

                        <span>Chính sách ưu đãi cơ sở được áp dụng:</span>
                      </p>
                      <div className="mt-2 space-y-1 pl-4">
                        {evaluatedPolicyBenefits.filter(b => b.isDiscount).map(b => (
                          <div key={b.policy.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span>• <b>{b.policy.name}</b> ({b.policy.value}): {b.descriptionVi}</span>
                            <span className="font-bold text-emerald-800">{formatVnd(b.discountAmount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="mt-4 text-xs leading-5 text-stone-600">{hasOtherGoods ? 'Sau khi nhân viên cơ sở chấp thuận, hệ thống mới mở bước thanh toán cọc 20%. Nếu bị từ chối, suất kho sẽ được giải phóng và lý do sẽ hiển thị trong thông báo.' : 'Cọc giữ chỗ được trừ vào tiền thuê và không hoàn nếu khách hàng hủy trước nhận kho. Tiền cọc đảm bảo kho được thu riêng tại nhận kho để bảo đảm trách nhiệm về hư hại, vệ sinh và công nợ. Khoản còn lại được hoàn sau biên bản nghiệm thu trả kho.'}</p>
                </div>
              )
            })()}

            {reservationSubmitError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-bold">Chưa thể xác nhận đặt kho</p>
              <p className="mt-1 leading-5">{reservationSubmitError}</p>
            </div>}

            <div className="flex flex-wrap justify-between gap-2 border-t border-stone-100 pt-3">
              <div>
                {bookingStep === 1
                  ? <Button variant="outline" onClick={() => { resetReservationDraft(); resetBookingForm(); setBookOpen(false); showToast('Đã hủy thao tác đặt kho.'); }}>Hủy đặt kho</Button>
                  : <Button variant="outline" disabled={reservationSubmitting} onClick={() => {
                      if (bookingStep === 3) {
                        setBookingReview(false)
                        setServerQuote(null)
                        setServerCompatibility(null)
                        setReservationSubmitError(null)
                      }
                      setBookingStep(current => Math.max(1, current - 1) as 1 | 2 | 3 | 4)
                    }}>Quay lại</Button>}
              </div>
              {bookingStep === 1 && <Button onClick={continueFromPersonalDetails}>Tiếp theo: Hàng hóa</Button>}
              {bookingStep === 2 && (
                <Button
                  disabled={
                    reservationSubmitting ||
                    (isApiAuthenticated() && (rentalPackagesLoading || (!selectedBackendRentalPackage && backendRentalPackages.length === 0)))
                  }
                  onClick={() => void confirmReservation()}
                >
                  {reservationSubmitting ? 'Đang lập báo giá...' : 'Kiểm tra và lấy báo giá'}
                </Button>
              )}
              {bookingStep === 3 && <Button disabled={!termsAccepted} onClick={() => setBookingStep(4)}>Tiếp theo: Chọn lịch check-in</Button>}
              {bookingStep === 4 && <Button disabled={reservationSubmitting || !termsAccepted} onClick={() => void confirmReservation()}>{reservationSubmitting ? 'Đang xử lý...' : hasOtherGoods ? 'Gửi yêu cầu nhân viên cơ sở duyệt' : 'Xác nhận đặt kho'}</Button>}
            </div>
          </div>
        )}
      </Modal>

      <CustomerReservationOtpModal
        reservation={backendOtpReservation}
        code={backendOtpCode}
        developmentCode={backendOtpDevelopmentCode}
        busy={backendOtpBusy}
        message={backendOtpMessage}
        nextResendAt={backendOtpReservation ? backendOtpNextResendAt[backendOtpReservation.id] || 0 : 0}
        now={now}
        onCodeChange={setBackendOtpCode}
        onClose={() => {
          if (!backendOtpBusy) {
            setBackendOtpReservation(null)
            setBackendOtpDevelopmentCode(null)
          }
        }}
        onResend={() => void resendBackendReservationOtp()}
        onVerify={() => void verifyBackendReservationOtp()}
      />

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
              <p>{'Để tránh tình trạng giữ kho ảo, hệ thống yêu cầu xác nhận email trước khi mở bước thanh toán cọc.'}</p>
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
                {'Mã xác minh có hiệu lực trong 10 phút. Hết hạn sẽ tự động giải phóng gian kho.'}
              </p>
              <p className="text-[11px] font-medium text-amber-800">{'Mã xác minh được cung cấp trực tiếp trong môi trường kiểm thử.'}</p>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputToken(resendHoldEmail(activeHoldForEmail.id, user))
                  showToast('Đã tạo lại mã thử nghiệm trên phiên hiện tại. Hệ thống chưa gửi thư điện tử thật.')
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
                      showToast(activeHoldForEmail.goodsReviewStatus === 'PENDING'
                        ? 'Email đã được xác nhận. Hồ sơ hàng hóa đã được gửi nhân viên duyệt trong tối đa 6 giờ.'
                        : 'Email đã được xác nhận thành công! Bước thanh toán cọc đã được mở.')
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
          const grossTotal = originalRent * activeHoldForPayment.rentalMonths
          const discountAmount = activeHoldForPayment.discountAmount ?? 0
          const totalDue = Math.max(0, grossTotal - discountAmount)
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
                    <p className="text-stone-500">{'Loại kho'}: <b>{unitTypeLabel(activeHoldForPayment.unitTypeName)}</b> · {'Cơ sở'}: <b>{activeHoldForPayment.facilityName}</b></p>
                  </div>
                  <Badge variant="info">{unitTypeLabel(activeHoldForPayment.unitTypeName)}</Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between"><span className="text-stone-600">{'Giá thuê mỗi tháng:'}</span><span className="font-semibold text-black">{formatVnd(originalRent)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-600">{'Thời hạn thuê:'}</span><span className="font-semibold text-black">{activeHoldForPayment.rentalMonths} {'tháng'}</span></div>
                  <div className="flex justify-between text-emerald-700"><span>{'Giảm giá:'}</span><span className="font-semibold">− {formatVnd(discountAmount)}</span></div>

                  <div className="flex justify-between text-base font-bold text-black pt-2 border-t border-stone-300">
                    <span>{'Tổng giá trị kỳ thuê:'}</span>
                    <span className="">{formatVnd(totalDue)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black"><span>{'Cọc cần thanh toán (20%):'}</span><span>{formatVnd(reservationDeposit)}</span></div>
                  <div className="flex justify-between"><span>{'Tiền cọc đảm bảo kho:'}</span><span className="font-semibold text-emerald-700">{formatVnd(securityDeposit)}</span></div>
                  <div className="flex justify-between"><span>{'Còn thu tại nhận kho:'}</span><span>{formatVnd(dueAtCheckIn)}</span></div>
                  <p className="border-t border-stone-200 pt-2 text-xs text-stone-600">{'Cọc giữ chỗ 20% được khấu trừ vào tiền thuê. Tiền cọc đảm bảo kho được thu riêng khi nhận kho, dùng để bảo đảm hư hại, vệ sinh và công nợ. Phần không bị khấu trừ sẽ hoàn sau nghiệm thu trả kho.'}</p>
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
                    showToast('Đã thanh toán cọc. Đơn đã chuyển sang bước xem điều khoản và nhận kho tại gian kho đã chọn.')
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
                  {'Đã ghi nhận cọc giữ chỗ. Hợp đồng giấy chỉ xuất hiện sau khi hai bên ký và nhân viên lưu bản chụp. Phần còn lại thu tại cơ sở.'}
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
                const currentTermValue = completedRenewals.length ? null : initialTermValue
                const totalBookingDeposit = pricedRenewals.length ? null : deposit
                const balance = activeRenewals.length ? null : 0
                const totalRentalMonths = activeHoldForContract.rentalMonths + completedRenewals.reduce((sum, renewal) => sum + renewal.renewalMonths, 0)
                return <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">{'Hồ sơ hợp đồng'}</p>
                      <p className="mt-1 text-base font-bold text-stone-950">{activeHoldForContract.id} · {unitTypeLabel(activeHoldForContract.unitTypeName ?? activeHoldForContract.unitId)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 font-bold ${signed ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'}`}>
                      {signed ? ('Đã ký hợp đồng') : ('Chờ ký tại cơ sở')}
                    </span>
                  </div>
                  <div className="space-y-5 p-5">
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'1. Chủ thể hợp đồng'}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-stone-200 p-3"><p className="font-bold text-stone-950">{'Bên cho thuê: StorageHub'}</p><p className="mt-1 leading-5 text-stone-600">{activeHoldForContract.facilityName}<br />{facilities.find(item => item.id === activeHoldForContract.facilityId)?.address || '—'}<br />{'Đại diện ký: quản lý cơ sở / nhân viên được ủy quyền'}</p></div><div className="rounded-lg border border-stone-200 p-3"><p className="font-bold text-stone-950">{`Bên thuê: ${activeHoldForContract.customerName}`}</p><p className="mt-1 leading-5 text-stone-600">CCCD/Hộ chiếu: {activeHoldForContract.identityId}<br />{activeHoldForContract.customerPhone} · {activeHoldForContract.customerEmail}<br />{activeHoldForContract.customerAddress || ('Địa chỉ: cập nhật khi ký')}<br />{`Mã khách hàng: ${activeHoldForContract.customerId}`}</p></div></div></section>
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'2. Đối tượng thuê & lịch bàn giao'}</p><div className="grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-2">{[
                      ['Số hợp đồng / mã đơn', `${signed?.contractNumber ?? ('Cấp sau khi ký')} · ${activeHoldForContract.id}`],
                      ['Gian kho / cỡ kho', activeHoldForContract.assignedUnitId ?? unitTypeLabel(activeHoldForContract.unitTypeName)],
                      ['Kích thước kiện lớn nhất', `${activeHoldForContract.goods.lengthCm} × ${activeHoldForContract.goods.widthCm} × ${activeHoldForContract.goods.heightCm} cm`],
                      ['Hàng hóa khai báo', `${activeHoldForContract.goods.category} · ${activeHoldForContract.goods.packageCount} kiện · ${activeHoldForContract.goods.weightKg} kg`],
                      ['Thời hạn thuê hiện hành', `${activeHoldForContract.startDate} → ${effectiveEndDate} · ${totalRentalMonths} ${'tháng'}`],
                      ['Lịch nhận kho / bàn giao', appointment]
                    ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 font-bold leading-5 text-stone-900">{value}</p></div>)}</div></section>
                    <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'3. Điều khoản chính'}</p><div className="grid gap-2 sm:grid-cols-2">{[
                      `Đơn giá đã lưu: ${formatVnd(activeHoldForContract.quote.baseMonthlyPrice)}/tháng. Tổng giá trị tiền thuê sau gia hạn cần được đối soát trong Hồ sơ thuê.`,
                      `Khoản giữ chỗ ban đầu đã lưu (${formatVnd(deposit)}) được trừ vào tiền thuê. Tiền cọc đảm bảo kho ${formatVnd(securityDeposit)} là khoản riêng, dùng để bảo đảm hư hại, vệ sinh và công nợ. Phần còn lại được hoàn sau nghiệm thu.`,
                      'Khách hoàn tất nhận kho trong vòng 7 ngày. Việc đổi lịch cũng phải nằm trong thời hạn này.',
                      'Khách chỉ lưu hàng đã khai báo, tuân thủ tải trọng, kích thước cửa kho, PCCC và danh mục hàng cấm.',
                      'Gia hạn theo gói tháng. Hệ thống kiểm tra điều kiện và mở thanh toán khi các nguồn cần thiết sẵn sàng; quản lý cơ sở theo dõi hồ sơ.',
                      'Khi trả kho, nhân viên lập biên bản trước–sau; khấu trừ phải có nội dung, số tiền và minh chứng.',
                      'Khách được xem, đồng ý hoặc yêu cầu xem xét lại quyết toán trước khi đóng hồ sơ.',
                      'Sự cố kết cấu hạ tầng: Cơ sở chịu 100% trách nhiệm, xử lý khẩn cấp trong 4 đến 12 giờ. Cơ sở kích hoạt di dời khẩn cấp miễn phí sang kho tương đương và giữ nguyên hợp đồng.',
                      'Phân định trách nhiệm ẩm mốc khi trả kho: Hoàn 100% cọc và đền bù nếu do thấm dột hoặc hỏng máy lạnh của cơ sở. Khách hàng tự chịu và bị khấu trừ phí khử trùng 1.500.000₫ nếu do đóng gói ẩm hoặc vi phạm hàng cấm.'
                    ].map((term, index) => <div key={term} className="flex gap-2 rounded-lg bg-stone-50 p-3 leading-5"><span className="font-bold text-amber-700">{index + 1}.</span><span>{term}</span></div>)}</div></section>
                    {completedRenewals.length > 0 && <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">{'4. Hợp đồng gia hạn đã phát hành'}</p><div className="space-y-2">{completedRenewals.map(renewal => {
                      const renewalContract = contracts.find(contract => contract.id === renewal.renewalContractId || contract.renewalId === renewal.id)
                      return <article key={renewal.id} className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
                        <p className="font-bold">{renewal.renewalContractNumber || renewalContract?.contractNumber || renewal.addendumNumber || renewal.id}</p>
                        <p className="text-sm text-stone-600">{LEGACY_RENEWAL_HISTORY_NOTICE}</p>
                        <p>Kỳ đã lưu: {renewal.oldEndDate} → {renewal.newEndDate} · {renewal.renewalMonths} tháng</p>
                        <p>Tiền thuê đã lưu: {legacyRenewalMoney(renewal.totalAmount ?? renewal.renewalFee)}</p>
                        <p>Mã chứng từ cũ: {renewal.invoiceNumber || '—'}</p>
                        <p>Ngày ký đã lưu: {renewal.signedAt ? new Date(renewal.signedAt).toLocaleDateString('vi-VN') : '—'}</p>
                        {renewalContract && <div className="flex gap-2 border-t border-stone-200 pt-3"><a href={renewalContract.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="underline">Xem tệp hợp đồng đã lưu</a><a href={renewalContract.scannedFileUrl} download={renewalContract.scannedFileName} className="underline">Tải xuống</a></div>}
                      </article>
                    })}</div></section>}
                  </div>
                  <div className="grid gap-3 border-t border-stone-200 p-5 sm:grid-cols-4">
                    <div className="rounded-lg bg-stone-50 p-3"><p className="text-stone-500">{'Tổng giá trị thuê hiện hành'}</p><p className="mt-1 text-base font-bold text-stone-950">{legacyRenewalMoney(currentTermValue)}</p><p className="mt-1 text-[10px] text-stone-500">{totalRentalMonths} {'tháng, gồm các kỳ gia hạn đã hoàn tất'}</p></div>
                    <div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">{'Tổng cọc giữ chỗ đã ghi nhận'}</p><p className="mt-1 text-base font-bold text-blue-800">{legacyRenewalMoney(totalBookingDeposit)}</p></div>
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">{'Tiền cọc đảm bảo kho'}</p><p className="mt-1 text-base font-bold text-emerald-800">{formatVnd(securityDeposit)}</p></div>
                    <div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-800">{'Còn thanh toán tại cơ sở'}</p><p className="mt-1 text-base font-bold text-amber-900">{legacyRenewalMoney(balance)}</p><p className="mt-1 text-[10px] text-amber-700">{balance === null ? 'Đăng nhập để đối soát công nợ gia hạn' : 'Không có yêu cầu gia hạn đang mở'}</p></div>
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
              const rentalValue = completedRenewals.length ? null : activeHoldForContract.quote.baseMonthlyPrice * activeHoldForContract.rentalMonths
              const securityDeposit = activeHoldForContract.securityDepositAmount ?? activeHoldForContract.quote.depositAmount
              const totalValue = rentalValue === null ? null : rentalValue + securityDeposit
              const totalPaid = receiptPayments.some(payment => payment.renewalId || payment.type === 'RENEWAL') ? null : receiptPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + payment.amount, 0)
              const balance = totalValue === null || totalPaid === null ? null : Math.max(0, totalValue - totalPaid)
              return <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">{'Hồ sơ biên nhận thanh toán'}</p><p className="mt-1 text-lg font-bold text-stone-950">{activeHoldForContract.id}</p><p className="mt-1 text-stone-600">{activeHoldForContract.customerName} · {activeHoldForContract.customerEmail}</p></div><div className="text-right"><p className="text-stone-500">{'Đơn vị nhận tiền'}</p><p className="font-bold">StorageHub · {activeHoldForContract.facilityName}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="text-stone-500">{'Tiền thuê theo kỳ'}</p><p className="mt-1 text-lg font-bold">{legacyRenewalMoney(rentalValue)}</p></div><div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">{'Tiền cọc đảm bảo kho'}</p><p className="mt-1 text-lg font-bold text-emerald-800">{formatVnd(securityDeposit)}</p></div><div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">{'Đã thu'}</p><p className="mt-1 text-lg font-bold text-blue-800">{legacyRenewalMoney(totalPaid)}</p></div><div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-800">{'Còn phải thu'}</p><p className="mt-1 text-lg font-bold text-amber-900">{legacyRenewalMoney(balance)}</p></div></div></div>
                {receiptPayments.map(payment => isLegacyRenewalPayment(payment) ? <LegacyRenewalPaymentRecord key={payment.id} payment={payment} /> : <article key={payment.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{payment.type === 'RESERVATION_DEPOSIT' ? 'Biên lai cọc' : payment.type === 'INITIAL_RENT' ? 'Biên lai nhận kho' : payment.type === 'RENEWAL' && payment.id.startsWith('PAY-RNW-BAL-') ? 'Biên lai thanh toán số dư gia hạn' : payment.type === 'RENEWAL' ? 'Biên lai thanh toán gia hạn' : 'Biên nhận điện tử'}</p><p className="mt-1 text-sm font-bold">{payment.transactionReference || payment.id}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800">{payment.status === 'PAID' ? ('Đã thanh toán') : ('Đang xử lý')}</span></div><div className="grid gap-px bg-stone-200 sm:grid-cols-2">{[
                  ['Số biên nhận', payment.id],
                  ['Ngày giờ thanh toán', payment.paidAt ? new Date(payment.paidAt).toLocaleString('vi-VN') : '—'],
                  ['Người nộp tiền', `${activeHoldForContract.customerName} · ${activeHoldForContract.customerEmail}`],
                  ['Đơn vị nhận tiền', `StorageHub · ${activeHoldForContract.facilityName}`],
                  ['Nội dung thanh toán', payment.type === 'RENEWAL' && payment.id.startsWith('PAY-RNW-BAL-') ? (`Thanh toán phần còn lại của kỳ gia hạn: ${formatVnd(payment.amount)}`) : payment.description || (payment.type === 'RESERVATION_DEPOSIT' ? ('Cọc giữ chỗ 20% giá trị kỳ thuê') : payment.type === 'INITIAL_RENT' ? ('Thanh toán phần còn lại tại nhận kho') : payment.type === 'RENEWAL' ? ('Thanh toán gia hạn hợp đồng') : 'Giao dịch thanh toán')],
                  ['Số hóa đơn', payment.invoiceNumber || '—'],
                  ['Mã đơn / hợp đồng', `${activeHoldForContract.id} · ${contracts.find(item => item.reservationId === activeHoldForContract.id)?.contractNumber || '—'}`],
                  ['Phương thức', paymentMethodLabel(payment.paymentMethod || activeHoldForContract.payment.method)],
                  ['Mã giao dịch đối soát', payment.transactionReference || activeHoldForContract.payment.transactionId || payment.id],
                  ['Số tiền / tiền tệ', `${formatVnd(payment.amount)} · ${paymentCurrencyLabel('VND')}`],
                  ['Người ghi nhận', payment.receivedBy || payment.recordedBy || 'Hệ thống StorageHub']
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
        title={'Đặt Lịch Hẹn Bàn Giao & nhận kho'}
      >
        {activeHoldForSchedule && (
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              {'Chọn ngày giờ bạn sẽ đến cơ sở để cùng nhân viên đối chiếu CCCD, cân đo hàng hóa thực tế và nhận mã mở cửa:'}
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><b>{'Hạn đổi lịch:'}</b> {activeHoldForSchedule.checkInDeadline ? dateInputValue(new Date(activeHoldForSchedule.checkInDeadline)) : ('trong thời hạn nhận kho 7 ngày')}. {'Ngày dự kiến trên đơn sẽ được cập nhật theo lịch mới.'}</div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={'Ngày hẹn'}
                type="date"
                value={appointmentDate}
                min={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })}
                max={activeHoldForSchedule.checkInDeadline ? dateInputValue(new Date(activeHoldForSchedule.checkInDeadline)) : undefined}
                onChange={e => setAppointmentDate(e.target.value)}
              />
              <div><Input label={'Giờ nhận kho (24/7)'} type="time" min="00:00" max="23:59" step="60" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} /><p className="mt-1 text-[11px] text-blue-700">Có thể chọn chính xác đến từng phút.</p></div>
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>{'Hủy'}</Button>
              <Button
                disabled={!appointmentDate || !appointmentTime}
                onClick={() => {
                  try {
                    scheduleCheckIn(activeHoldForSchedule.id, appointmentDate, appointmentTime, user)
                    setScheduleModalOpen(false)
                    showToast(`Đã lên lịch nhận kho vào ${appointmentTime} ngày ${appointmentDate}!`)
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
              <p>{'Tiền cọc đảm bảo kho sẽ được hoàn đầy đủ sau khi nghiệm thu xác nhận không có hư hại, phí vệ sinh hoặc công nợ.'}</p>
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
                onClick={async () => {
                  try {
                    if (isApiAuthenticated()) {
                      await requestReturnApi(activeRentalForReturn.id, returnTargetDate, returnReason || '')
                    }
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

      <Modal open={renewalModalOpen && !isApiAuthenticated()} onClose={() => { setRenewalModalOpen(false); setEditingRenewalId(null) }} title="Gia hạn hồ sơ cũ">
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{LEGACY_RENEWAL_HISTORY_NOTICE} {LEGACY_RENEWAL_NOTICE}</p>
          {activeRentalForRenewal && <p className="text-sm">Gian kho {activeRentalForRenewal.unitId} · Hạn thuê đã lưu: {activeRentalForRenewal.endDate}</p>}
          <div className="flex justify-end"><Button variant="outline" onClick={() => setRenewalModalOpen(false)}>Đóng</Button></div>
        </div>
      </Modal>
      <Modal open={renewalPaymentOpen && !isApiAuthenticated()} onClose={() => setRenewalPaymentOpen(false)} title="Thông tin gia hạn đã lưu">
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{LEGACY_RENEWAL_HISTORY_NOTICE} {LEGACY_RENEWAL_NOTICE}</p>
          {activeRenewalForPayment && <dl className="space-y-2 text-sm">
            <div><dt>Mã gia hạn</dt><dd>{activeRenewalForPayment.id}</dd></div>
            <div><dt>Tiền thuê đã lưu</dt><dd>{legacyRenewalMoney(activeRenewalForPayment.totalAmount ?? activeRenewalForPayment.renewalFee)}</dd></div>
            <div><dt>Khoản trả trước đã lưu</dt><dd>{legacyRenewalMoney(activeRenewalForPayment.bookingDepositAmount)}</dd></div>
            <div><dt>Phần còn lại đã lưu</dt><dd>{legacyRenewalMoney(activeRenewalForPayment.remainingAmount)}</dd></div>
            <div><dt>Phí quá hạn đã lưu</dt><dd>{legacyRenewalMoney(activeRenewalForPayment.lateFeeAmount)}</dd></div>
          </dl>}
          <div className="flex justify-end"><Button variant="outline" onClick={() => setRenewalPaymentOpen(false)}>Đóng</Button></div>
        </div>
      </Modal>

      <Modal open={Boolean(confirmation)} onClose={closeConfirmation} title={confirmation?.title || 'Xác nhận thao tác'}>
        {confirmation && <div className="space-y-5">
          <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">{confirmation.message}</p>
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <Button variant="outline" onClick={closeConfirmation}>{'Quay lại'}</Button>
            <Button variant={confirmation.tone === 'danger' ? 'danger' : 'primary'} onClick={runConfirmedAction}>{confirmation.confirmLabel}</Button>
          </div>
        </div>}
      </Modal>

      <Modal open={Boolean(returnDisputeTargetId)} onClose={() => { setReturnDisputeTargetId(null); setReturnDisputeReason('') }} title="Yêu cầu xem xét lại quyết toán">
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-slate-700 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-600 text-white font-bold text-[11px]">2</span>
              <p className="font-bold text-sky-950">Căn cứ: Phân định trách nhiệm ẩm mốc khi trả kho</p>
            </div>
            <ul className="space-y-1 pl-1 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-sky-600 font-bold shrink-0">•</span>
                <span><strong>Lỗi cơ sở (vách/trần loang ố, dột hoặc máy lạnh hỏng):</strong> Hoàn 100% cọc + bồi thường hàng + khóa kho sửa chữa.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-sky-600 font-bold shrink-0">•</span>
                <span><strong>Lỗi khách hàng (kho khô 100%, đồ mốc do khách cất ẩm/hàng cấm):</strong> Khách tự chịu 100% + trừ phí khử trùng 1.500.000₫ vào cọc.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-sky-600 font-bold shrink-0">•</span>
                <span><strong>Kho thường:</strong> Miễn trừ trách nhiệm độ ẩm tự nhiên theo cam kết hợp đồng.</span>
              </li>
            </ul>
          </div>

          <div><label className="text-sm font-medium text-stone-700">Lý do cần xem xét lại *</label><textarea rows={4} value={returnDisputeReason} onChange={event => setReturnDisputeReason(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" placeholder="Mô tả khoản phí hoặc kết quả nghiệm thu cần kiểm tra lại..." /></div>
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4"><Button variant="outline" onClick={() => { setReturnDisputeTargetId(null); setReturnDisputeReason('') }}>{'Hủy'}</Button><Button disabled={!returnDisputeReason.trim()} onClick={() => { if (!returnDisputeTargetId) return; try { confirmReturnSettlement(returnDisputeTargetId, user, 'disputed', returnDisputeReason.trim()); setReturnDisputeTargetId(null); setReturnDisputeReason(''); showToast('Đã gửi yêu cầu xem xét lại.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu.') } }}>{'Gửi yêu cầu'}</Button></div>
        </div>
      </Modal>

      {/* ── MODAL 7: SUPPORT TICKET CONVERSATION ───────────────── */}
      <Modal
        open={conversationOpen && !isApiAuthenticated()}
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
        open={ticketOpen && !isApiAuthenticated()}
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
            placeholder={'Tóm tắt sự cố (ví dụ: Khóa cổng không nhận mã mở cửa)'}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label={'Phân loại'} value={ticketCategory} onChange={e => setTicketCategory(e.target.value)}>
              <option value="Access & Entry">{'Ra vào và mã mở cửa'}</option>
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
                    facility: relatedRental?.facilityName || relatedHold?.facilityName || user.facility || 'Kho Việt – Cơ sở Quận 1',
                    unit: relatedRental?.unitId || relatedHold?.assignedUnitId || relatedHold?.unitTypeName || 'Tư vấn chung',
                    facilityId: relatedRental?.facilityId || relatedHold?.facilityId || user.facilityId || 'fac-001',
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

      {isApiAuthenticated() && <CustomerSupportWidget openRequest={supportWidgetRequest} />}

      {!isApiAuthenticated() && <CustomerSupportChatbot
        user={user}
        isOpen={supportChatbotOpen}
        onToggleOpen={setSupportChatbotOpen}
        onOpenTicketList={() => setSupportChatbotOpen(true)}
        showToast={showToast}
      />}

      <ReturnSettlementModal
        open={settlementModalOpen}
        onClose={() => setSettlementModalOpen(false)}
        returnCase={selectedSettlementReturn}
        payments={payments}
        role="customer"
      />
      </div>
    </Layout>
  )
}

