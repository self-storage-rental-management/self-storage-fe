import { useState, useMemo, useCallback, useEffect } from "react"
import DuongPolicyWorkspace from "../rental-support-integration/DuongPolicyWorkspace"
import UnitTypeReviewModal from "./UnitTypeReviewModal"
import { listFacilityContentPolicies, saveFacilityContentPolicies, type FacilityContentPolicy } from "../../services/facilityContentPolicyApi"
import BusinessReturnsPanel from "./BusinessReturnsPanel"
import BusinessRefundRequestsPanel from "./BusinessRefundRequestsPanel"
import BusinessDamageIncidentsPanel from "./BusinessDamageIncidentsPanel"
import BusinessRentalRegulationsPanel from "./BusinessRentalRegulationsPanel"

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts"

import Layout, {
  getInitialPage,
  Icon,
} from "../../components/Layout"
import type { NavItem } from "../../components/Layout"

import {
  Badge,
  Button,
  Card,
  StatCard,
  Table,
  Thead,
  Tbody,
  Th,
  Td,
  Tr,
  SectionHeader,
  Modal,
  ProgressBar,
  Input,
  Select,
} from "../../components/ui"

import type { User } from "../../types"

import type {
  PricingTierItem,
  MonthlyRevenueRecord,
} from "../../data/demoDatabase"
import {
  UNIT_SPECS,
  REVENUE_DATA,
  REVENUE_BREAKDOWN,
  CONVERSION_DATA,
  PRICING_TIERS,
  POLICIES,
  FEES,
} from "../../data/demoDatabase"

import { formatVnd, formatVndAmount } from "../../i18n/currency"

import { exportRevenueExcel } from "../../utils/excelExport"

import { useStorageHub, sanitizeFacilityStrings } from "../../store/StorageHubContext"
import type { Facility, FacilityCustomUnitSpec } from "../../types/storageHub"

import ProfileView from "../ProfileView"
import {
  getUnitTypeVehicleStandard,
  validateVehicleLaneWidth,
} from "../../domain/facilityRules"
import { generateDefaultRentalPackages } from "../../domain/packageRules"
import { resolveBusinessFacilityIds } from "../../domain/businessFacilityIds"
import { UnitAllocationTable } from "./facility/UnitAllocationTable"
import { AddUnitSpecModal } from "./facility/AddUnitSpecModal"
import {
  FacilityGeneralInfo,
  FacilityOperations,
  FacilityImageManager,
} from "./facility/FacilityFormFields"
import { DEMO_DATA_ENABLED } from "../../config/runtime"
import { createFacilityApi, listAllFacilitiesApi, priceBusinessUnitTypeApi, updateBusinessFacilityApi, deleteBusinessFacilityApi, publishBusinessFacilityApi } from "../../services/facilityApi"
import { listAccessibleUnitTypes } from "../../services/customerReservationApi"
import type { CustomerUnitType } from "../../services/customerReservationApi"
import { isApiAuthenticated, canApiActor } from "../../services/authApi"
import { listNotifications, markNotificationRead, notifyBell, type ApiNotification } from "../../services/notificationApi"
import {
  createBusinessPackagePolicy,
  deactivateBusinessPackagePolicy,
  listBusinessPackagePolicies,
  updateBusinessPackagePolicy,
  publishBusinessPackagePolicy,
  inactiveBusinessPackagePolicy,
} from "../../services/businessPolicyApi"

const RUNTIME_REVENUE_DATA = DEMO_DATA_ENABLED ? REVENUE_DATA : []
const RUNTIME_REVENUE_BREAKDOWN = DEMO_DATA_ENABLED ? REVENUE_BREAKDOWN : []
const RUNTIME_CONVERSION_DATA = DEMO_DATA_ENABLED ? CONVERSION_DATA : []
const RUNTIME_PRICING_TIERS = DEMO_DATA_ENABLED ? PRICING_TIERS : []
const RUNTIME_FEES = DEMO_DATA_ENABLED ? FEES : []

const facilityStatusLabel = (status: Facility['status']) => ({
  setup: 'Đang thiết lập',
  active: 'Đang hoạt động',
  maintenance: 'Bảo trì',
  inactive: 'Ngừng hoạt động',
}[status])

const DEFAULT_FACILITY_UNIT_SPECS: FacilityCustomUnitSpec[] = [
  {
    sizeCode: "S",
    name: "Kho Nhỏ (S)",
    lengthM: UNIT_SPECS.S.lengthM,
    widthM: UNIT_SPECS.S.widthM,
    heightM: UNIT_SPECS.S.heightM,
    laneWidthM: UNIT_SPECS.S.vehicleLaneWidthM,
    maxLoadKg: UNIT_SPECS.S.maxLoadKg,
    monthlyPrice: UNIT_SPECS.S.priceMonthly,
    count: 5,
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    floor: 1,
    zone: "Khu A",
    frameCount: UNIT_SPECS.S.frameCount,
    frameDimensions: {
      lengthM: UNIT_SPECS.S.frameDimensions.lengthM ?? UNIT_SPECS.S.frameDimensions.depthM,
      widthM: UNIT_SPECS.S.frameDimensions.widthM,
      heightM: UNIT_SPECS.S.frameDimensions.heightM,
      depthM: UNIT_SPECS.S.frameDimensions.depthM,
    },
    rentalPackages: generateDefaultRentalPackages('', 'S', UNIT_SPECS.S.priceMonthly),
  },
  {
    sizeCode: "M",
    name: "Kho Trung (M)",
    lengthM: UNIT_SPECS.M.lengthM,
    widthM: UNIT_SPECS.M.widthM,
    heightM: UNIT_SPECS.M.heightM,
    laneWidthM: UNIT_SPECS.M.vehicleLaneWidthM,
    maxLoadKg: UNIT_SPECS.M.maxLoadKg,
    monthlyPrice: UNIT_SPECS.M.priceMonthly,
    count: 5,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    floor: 2,
    zone: "Khu B",
    frameCount: UNIT_SPECS.M.frameCount,
    frameDimensions: {
      lengthM: UNIT_SPECS.M.frameDimensions.lengthM ?? UNIT_SPECS.M.frameDimensions.depthM,
      widthM: UNIT_SPECS.M.frameDimensions.widthM,
      heightM: UNIT_SPECS.M.frameDimensions.heightM,
      depthM: UNIT_SPECS.M.frameDimensions.depthM,
    },
    rentalPackages: generateDefaultRentalPackages('', 'M', UNIT_SPECS.M.priceMonthly),
  },
  {
    sizeCode: "L",
    name: "Kho Lớn (L)",
    lengthM: UNIT_SPECS.L.lengthM,
    widthM: UNIT_SPECS.L.widthM,
    heightM: UNIT_SPECS.L.heightM,
    laneWidthM: UNIT_SPECS.L.vehicleLaneWidthM,
    maxLoadKg: UNIT_SPECS.L.maxLoadKg,
    monthlyPrice: UNIT_SPECS.L.priceMonthly,
    count: 5,
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    floor: 3,
    zone: "Khu C",
    frameCount: UNIT_SPECS.L.frameCount,
    frameDimensions: {
      lengthM: UNIT_SPECS.L.frameDimensions.lengthM ?? UNIT_SPECS.L.frameDimensions.depthM,
      widthM: UNIT_SPECS.L.frameDimensions.widthM,
      heightM: UNIT_SPECS.L.frameDimensions.heightM,
      depthM: UNIT_SPECS.L.frameDimensions.depthM,
    },
    rentalPackages: generateDefaultRentalPackages('', 'L', UNIT_SPECS.L.priceMonthly),
  },
  {
    sizeCode: "XL",
    name: "Kho Rất Lớn (XL)",
    lengthM: UNIT_SPECS.XL.lengthM,
    widthM: UNIT_SPECS.XL.widthM,
    heightM: UNIT_SPECS.XL.heightM,
    laneWidthM: UNIT_SPECS.XL.vehicleLaneWidthM,
    maxLoadKg: UNIT_SPECS.XL.maxLoadKg,
    monthlyPrice: UNIT_SPECS.XL.priceMonthly,
    count: 5,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    floor: 4,
    zone: "Khu D",
    frameCount: UNIT_SPECS.XL.frameCount,
    frameDimensions: {
      lengthM: UNIT_SPECS.XL.frameDimensions.lengthM ?? UNIT_SPECS.XL.frameDimensions.depthM,
      widthM: UNIT_SPECS.XL.frameDimensions.widthM,
      heightM: UNIT_SPECS.XL.frameDimensions.heightM,
      depthM: UNIT_SPECS.XL.frameDimensions.depthM,
    },
    rentalPackages: generateDefaultRentalPackages('', 'XL', UNIT_SPECS.XL.priceMonthly),
  },
]

export interface PolicyItem {
  id: string

  name: string

  value: string

  scope: string

  editable: boolean

  description?: string

  lastUpdated?: string

  scopeType?: 'all' | 'specific'

  facilityIds?: string[]

  category?: 'billing' | 'climate' | 'prohibited' | 'maintenance'
}

export function isExcludedPolicy(p: { id?: string; name?: string; description?: string; category?: string }): boolean {
  const cat = (p.category || '').toLowerCase()
  if (cat === 'climate' || cat === 'prohibited') return true
  const id = (p.id || '').toLowerCase()
  if (['pol-6', 'pol-7', 'pol-8', 'pol-9'].includes(id)) return true
  // Lọc bỏ toàn bộ các chính sách mặc định cũ
  if (['pol-1', 'pol-2', 'pol-3', 'pol-4', 'pol-5', 'pol-10'].includes(id)) return true
  const name = (p.name || '').toLowerCase().trim()
  const desc = (p.description || '').toLowerCase()
  if (name.includes('độ ẩm') || name.includes('kho mát') || name.includes('hàng cấm') || name.includes('khử trùng')) return true
  if (desc.includes('độ ẩm') || desc.includes('kho mát') || desc.includes('hàng cấm') || desc.includes('khử trùng')) return true
  if (name === 'thời gian ân hạn thanh toán' || name === 'grace period' || name === 'thời gian gia hạn nợ') return true
  if (name === 'mức phí phạt trễ hạn' || name === 'late fee') return true
  if (name === 'tiền đặt cọc an ninh' || name === 'security deposit') return true
  if (name === 'thời hạn báo trước khi trả kho sớm' || name === 'notice to vacate') return true
  if (name === 'thời hạn thuê tối thiểu' || name === 'minimum lease') return true
  if (name.includes('khắc phục sự cố') || name.includes('di dời')) return true
  return false
}

export const DEFAULT_BUSINESS_POLICIES: PolicyItem[] = []

export const loadInitialPolicies = (): PolicyItem[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem("storagehub:policies") : null
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Dọn bỏ các policy bị loại trừ và dọn sạch 'yêu kim' cũ nếu còn sót lại trong cache
        const sanitized = parsed
          .filter(p => !isExcludedPolicy(p))
          .filter(p => (p.name || '').trim().toLowerCase() !== 'yêu kim' && p.id !== 'pol-yeu-kim')
        if (sanitized.length > 0) {
          try {
            localStorage.setItem("storagehub:policies", JSON.stringify(sanitized))
          } catch {}
          return sanitized
        }
      }
    }
  } catch {}
  if (isApiAuthenticated()) return []
  try {
    localStorage.setItem("storagehub:policies", JSON.stringify(DEFAULT_BUSINESS_POLICIES))
  } catch {}
  return DEFAULT_BUSINESS_POLICIES
}

export interface DurationDiscountItem {
  id: string
  months: number | 'other'
  rentalYears?: number | null
  freeSetupDays?: number | null
  title: string
  label: string
  discountPercent: number
  renewalDiscountPercent: number
  depositPercent?: number
  description: string
  appliesTo: string
  status: 'active' | 'inactive'
  publicationStatus?: 'DRAFT' | 'PUBLISHED' | 'INACTIVE'
  runtimeStatus?: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE'
  effectiveFrom?: string
  effectiveTo?: string | null
  scopeType?: 'all' | 'specific'
  facilityIds?: string[]
  backendPolicyIds?: Record<string, string>
}

export const DEFAULT_DURATION_DISCOUNTS: DurationDiscountItem[] = []

const WAREHOUSE_PHOTO_PRESETS: Array<{
  id: string
  title: string
  url: string
  description: string
}> = []

const getFeeType = (type: string, lang: string) => {
  if (lang !== "vi") return type

  const lower = type.toLowerCase()

  if (lower.includes("late") || lower.includes("muộn")) return "Phí nộp muộn"

  if (lower.includes("emergency") || lower.includes("khẩn cấp"))
    return "Phí hỗ trợ mở khóa khẩn cấp"

  if (
    lower.includes("lock") ||
    lower.includes("thay thế khóa") ||
    lower.includes("khóa số")
  )
    return "Phí thay thế khóa số"

  if (lower.includes("cleaning") || lower.includes("vệ sinh"))
    return "Phí dọn vệ sinh kho"

  if (lower.includes("admin") || lower.includes("hồ sơ"))
    return "Phí hồ sơ ban đầu"

  return type
}

const getFeeTrigger = (trigger: string, lang: string) => {
  if (lang !== "vi") return trigger
  // Trigger strings are already in Vietnamese in FEES data - return as-is
  return trigger
}

const getFeeApplies = (applies: string, lang: string) => {
  if (lang !== "vi") return applies

  const lower = applies.toLowerCase()

  if (lower.includes("all tenants") || lower.includes("tất cả"))
    return "Tất cả khách thuê"

  if (lower.includes("responsibility") || lower.includes("trách nhiệm"))
    return "Trách nhiệm khách thuê"

  if (
    lower.includes("inspection") ||
    lower.includes("nghiệm thu") ||
    lower.includes("kiểm tra")
  )
    return "Kiểm tra khi trả kho"

  if (lower.includes("call-out") || lower.includes("yêu cầu"))
    return "Mỗi lần yêu cầu"

  if (lower.includes("all facilities") || lower.includes("toàn bộ"))
    return "Toàn bộ cơ sở"

  return applies
}

export default function BusinessApp({
  user,
  onLogout,
}: {
  user: User
  onLogout: () => void
}) {
  const hub = useStorageHub()
  const visibleRuntimeFees = isApiAuthenticated() ? [] : RUNTIME_FEES

  const {
    facilities: localFacilitiesList,
    units: unitsList,
    rentals: rentalsList = [],
    contracts: contractsList = [],
    payments: paymentsList = [],
    holds: holdsList = [],
    createFacility,
    updateFacility,
    deleteFacility,
    updateUnit,
    updateBusinessConfig,
  } = hub

  // Local/demo data may use the facility code as its id. Keep the canonical
  // backend UUID by code so edit requests always target the persisted record.
  const [backendFacilityIdsByCode, setBackendFacilityIdsByCode] = useState<Record<string, string>>({})
  const [apiFacilitiesReady, setApiFacilitiesReady] = useState(() => !isApiAuthenticated())
  const [backendFacilityStats, setBackendFacilityStats] = useState<Record<string, { total: number; occupied: number; price: number | null; revenue: number }>>({})
  const [backendDetailCounts, setBackendDetailCounts] = useState<Record<string, { total: number; occupied: number; available: number }>>({})
  const [facilityDetailTypes, setFacilityDetailTypes] = useState<CustomerUnitType[]>([])
  const [facilityDataError, setFacilityDataError] = useState<string>()
  const [businessNotifications, setBusinessNotifications] = useState<ApiNotification[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null)

  // Authenticated Business screens must not render the local/demo catalog while
  // the backend catalog is still being loaded or unavailable.
  const facilitiesList = isApiAuthenticated()
    ? !apiFacilitiesReady
      ? []
      : localFacilitiesList.filter(facility => {
        const code = (facility.code || '').trim().toUpperCase()
        return Object.values(backendFacilityIdsByCode).includes(facility.id)
          || (code !== '' && backendFacilityIdsByCode[code] === facility.id)
      })
    : localFacilitiesList

  useEffect(() => {
    if (!isApiAuthenticated()) return
    let mounted = true
    const refresh = async () => {
      try { const response = await listNotifications(); if (mounted) setBusinessNotifications(response.data) }
      catch { /* A failed refresh must not invent notifications. */ }
    }
    void refresh()
    window.addEventListener('storagehub:notifications-refresh', refresh)
    const timer = window.setInterval(() => void refresh(), 10000)
    return () => {
      mounted = false
      window.removeEventListener('storagehub:notifications-refresh', refresh)
      window.clearInterval(timer)
    }
  }, [user.id])

  useEffect(() => {
    if (!isApiAuthenticated()) return
    let mounted = true
    const refresh = async () => {
      try {
        const facilities = await listAllFacilitiesApi()
        if (mounted) setFacilityDataError(undefined)
        if (mounted) setBackendFacilityStats(Object.fromEntries(facilities.map(facility => [facility.code.trim().toUpperCase(), {
          total: facility.totalUnits ?? 0, occupied: facility.occupiedUnits ?? 0, price: facility.minimumMonthlyPrice ?? null, revenue: facility.monthRevenue ?? 0,
        }])))
      } catch (error) {
        if (mounted && isApiAuthenticated()) {
          setFacilityDataError(error instanceof Error ? error.message : 'Không thể tải số liệu cơ sở.')
        }
      }
    }
    const timer = window.setInterval(() => void refresh(), 30000)
    window.addEventListener('focus', refresh)
    return () => { mounted = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  useEffect(() => {
    let isMounted = true
    listAllFacilitiesApi()
      .then((backendFacs) => {
        if (!isMounted || !Array.isArray(backendFacs)) return
        if (isApiAuthenticated()) setApiFacilitiesReady(true)
        if (isMounted) setFacilityDataError(undefined)
        setBackendFacilityIdsByCode(Object.fromEntries(
          backendFacs.map((facility) => [facility.code.trim().toUpperCase(), facility.id]),
        ))
        setBackendFacilityStats(Object.fromEntries(backendFacs.map(facility => [facility.code.trim().toUpperCase(), {
          total: facility.totalUnits ?? 0,
          occupied: facility.occupiedUnits ?? 0,
          price: facility.minimumMonthlyPrice ?? null,
          revenue: facility.monthRevenue ?? 0,
        }])))

        if (isApiAuthenticated()) {
          const backendIds = new Set(backendFacs.map(bf => bf.id))
          const backendCodes = new Set(backendFacs.map(bf => (bf.code || '').trim().toUpperCase()))
          localFacilitiesList.forEach(f => {
            const code = (f.code || '').trim().toUpperCase()
            if (!backendIds.has(f.id) && !backendCodes.has(code)) {
              deleteFacility(f.id, user, true)
            }
          })
        }
        backendFacs.forEach((bf) => {
          const cleanBf = sanitizeFacilityStrings(bf)
          const matching = localFacilitiesList.find(
            (f) => f.id === cleanBf.id || (f.code && f.code.toUpperCase() === (cleanBf.code || '').toUpperCase()),
          )
          if (!matching) {
            createFacility(
              {
                id: cleanBf.id,
                code: cleanBf.code,
                name: cleanBf.name,
                address: cleanBf.address,
                city: cleanBf.city,
                phone: cleanBf.phone || '',
                accessHours: cleanBf.accessHours || '',
                image: cleanBf.imageUrl || '',
                climate: Boolean(cleanBf.climateControlled),
                security: cleanBf.securityDescription || '',
                manager: cleanBf.managerNames?.join(', ') || 'Chưa phân công',
                status: cleanBf.status,
                units: cleanBf.totalUnits || 0,
                available: cleanBf.availableUnits || 0,
                occupied: cleanBf.occupiedUnits || 0,
              },
              user,
            )
          } else if (
            matching.name !== cleanBf.name ||
            matching.address !== cleanBf.address ||
            matching.city !== cleanBf.city ||
            matching.status !== cleanBf.status ||
            matching.manager !== (cleanBf.managerNames?.join(', ') || 'Chưa phân công') ||
            (cleanBf.status === 'setup' && matching.units !== 0)
          ) {
            updateFacility(matching.id, {
              name: cleanBf.name,
              address: cleanBf.address,
              city: cleanBf.city,
              phone: cleanBf.phone || '',
              accessHours: cleanBf.accessHours || '',
              image: cleanBf.imageUrl || '',
              climate: Boolean(cleanBf.climateControlled),
              security: cleanBf.securityDescription || '',
              manager: cleanBf.managerNames?.join(', ') || 'Chưa phân công',
              status: cleanBf.status,
              ...(cleanBf.status === 'setup' ? {
                units: 0,
                available: 0,
                occupied: 0,
                unitDistribution: {},
                unitPrices: {},
                unitLoadLimits: {},
                unitDimensions: {},
                unitLaneWidths: {},
                unitFrameCounts: {},
                unitFrameDimensions: {},
                unitCustomSpecs: [],
                totalDesignLoadTon: 0,
              } : {}),
            })
          }
        })
      })
      .catch(error => {
        if (!isMounted) return
        if (isApiAuthenticated()) {
          setApiFacilitiesReady(false)
          setFacilityDataError(error instanceof Error ? error.message : 'Không thể tải số liệu cơ sở.')
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  const getFacilityOccupiedCount = useCallback(
    (fac: any) => {
      if (!fac) return 0
      const stats = backendFacilityStats[(fac.code || '').trim().toUpperCase()]
      if (stats) return stats.occupied
      if (isApiAuthenticated()) return 0
      const facUnits = unitsList.filter(
        (u) => u.facilityId === fac.id || u.facilityId === fac.code,
      )
      if (facUnits.length > 0) {
        return facUnits.filter(
          (u) =>
            u.status === "occupied" || (u.status as string) === "rented",
        ).length
      }
      return fac.occupied || 0
    },
    [unitsList, backendFacilityStats],
  )

  const getFacilityTotalUnits = useCallback(
    (fac: any) => {
      if (!fac) return 0
      const stats = backendFacilityStats[(fac.code || '').trim().toUpperCase()]
      if (stats) return stats.total
      if (isApiAuthenticated()) return 0
      const facUnits = unitsList.filter(
        (u) => u.facilityId === fac.id || u.facilityId === fac.code,
      )
      return facUnits.length > 0 ? facUnits.length : fac.units || 0
    },
    [unitsList, backendFacilityStats],
  )

  const getFacilityAvailableCount = useCallback(
    (fac: any) => {
      const total = getFacilityTotalUnits(fac)
      const occ = getFacilityOccupiedCount(fac)
      return Math.max(0, total - occ)
    },
    [getFacilityTotalUnits, getFacilityOccupiedCount],
  )

  const lang = "vi"
  const USD_TO_VND_RATE = 26000

  const formatCurrency = (amount: number): string => {
    if (amount >= 10000) {
      return `${Math.round(amount).toLocaleString("vi-VN")} ₫`
    }

    return formatVnd(amount)
  }

  const NAV: NavItem[] = [
    // ── CƠ SỞ & MẶT BẰNG ──
    {
      id: "facilities",
      label: "Quản Lý Cơ Sở",
      icon: Icon.building,
      group: "Cơ Sở & Mặt Bằng",
      permission: "facilities:read",
    },

    // ── GIÁ & KHUYẾN MÃI ──
    {
      id: "pricing",
      label: "Bảng Giá Loại Kho",
      icon: Icon.dollar,
      group: "Giá & Khuyến Mãi",
      permission: "policies:read",
    },
    {
      id: "policies",
      label: "Gói Thuê",
      icon: Icon.calendar,
      group: "Giá & Khuyến Mãi",
      permission: "policies:read",
    },
    // ── QUY ĐỊNH & PHÁP LÝ ──
    {
      id: "rental-regulations",
      label: "Quy Định Cho Thuê",
      icon: Icon.clipboard,
      group: "Quy Định & Pháp Lý",
      permission: "policies:read",
    },
    {
      id: "rental-source-policies",
      label: "Chính Sách Gia Hạn",
      icon: Icon.policy,
      group: "Quy Định & Pháp Lý",
      permission: "policies:read",
    },

    // ── VẬN HÀNH & HẬU MÃI ──
    {
      id: "returns",
      label: "Trả Kho & Quyết Toán",
      icon: Icon.clipboard,
      group: "Vận Hành & Hậu Mãi",
      permission: "returns:read",
    },
    {
      id: "damage-incidents",
      label: "Xử Lý Sự Cố Kho",
      icon: Icon.alert,
      group: "Vận Hành & Hậu Mãi",
      permission: "facilities:read",
    },
  ]

  const [page, setPage] = useState(() => getInitialPage(NAV, "facilities"))
  const [integrationLocked, setIntegrationLocked] = useState(false)

  const [pricingModal, setPricingModal] = useState(false)

  const [policiesList, setPoliciesList] = useState<PolicyItem[]>(() =>
    isApiAuthenticated() ? [] : loadInitialPolicies(),
  )

  const [policyModal, setPolicyModal] = useState(false)

  const [createPolicyModal, setCreatePolicyModal] = useState(false)

  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null)

  const [policyFormName, setPolicyFormName] = useState("")

  const [policyFormValue, setPolicyFormValue] = useState("")

  const [policyFormScope, setPolicyFormScope] = useState("Toàn bộ cơ sở")

  const [policyFormScopeType, setPolicyFormScopeType] = useState<'all' | 'specific'>('all')

  const [policyFormFacilityIds, setPolicyFormFacilityIds] = useState<string[]>([])

  const [policyFacilityFilter, setPolicyFacilityFilter] = useState<string>('all')
  const [policyCategoryFilter, setPolicyCategoryFilter] = useState<'all' | 'billing' | 'maintenance'>('all')

  const [policyFormCategory, setPolicyFormCategory] = useState<'billing' | 'maintenance'>('billing')

  const getPolicyCategory = (p: PolicyItem): 'billing' | 'maintenance' => {
    if (p.category === 'maintenance') return 'maintenance'
    if (p.category === 'billing') return 'billing'
    const id = (p.id || '').toLowerCase()
    const name = (p.name || '').toLowerCase()
    if (id === 'pol-10' || name.includes('maintenance') || name.includes('relocation') || name.includes('bảo trì') || name.includes('sự cố')) return 'maintenance'
    return 'billing'
  }

  const filteredPoliciesList = useMemo(() => {
    return policiesList.filter((p) => {
      // Exclude prohibited and climate
      if (isExcludedPolicy(p)) return false

      // Category filter
      if (policyCategoryFilter !== 'all' && getPolicyCategory(p) !== policyCategoryFilter) {
        return false
      }

      // Facility filter
      if (policyFacilityFilter === 'all') return true
      const targetFac = facilitiesList.find((f) => f.id === policyFacilityFilter)
      if (!targetFac) return true

      if (p.scopeType === 'all') return true
      if (Array.isArray(p.facilityIds) && p.facilityIds.length > 0) {
        return (
          p.facilityIds.includes(targetFac.id) ||
          (targetFac.code && p.facilityIds.includes(targetFac.code))
        )
      }
      const s = (p.scope || '').trim().toLowerCase()
      if (['all facilities', 'toàn bộ cơ sở', 'all', 'toàn bộ'].includes(s)) return true
      return (
        s.includes(targetFac.name.toLowerCase()) ||
        targetFac.name.toLowerCase().includes(s)
      )
    })
  }, [policiesList, policyFacilityFilter, policyCategoryFilter, facilitiesList])

  const [policyFormDesc, setPolicyFormDesc] = useState("")

  const [policyCatalogVersion, setPolicyCatalogVersion] = useState(-1)
  const [policyCatalogReady, setPolicyCatalogReady] = useState(!isApiAuthenticated())
  const [policyCatalogBusy, setPolicyCatalogBusy] = useState(false)
  const [policyCatalogError, setPolicyCatalogError] = useState('')
  useEffect(() => {
    if (!isApiAuthenticated()) return
    let disposed = false
    void listFacilityContentPolicies().then(catalog => {
      if (disposed) return
      setPolicyCatalogVersion(catalog.version)
      if (catalog.version >= 0) setPoliciesList(catalog.policies.filter(p => !isExcludedPolicy(p)))
      setPolicyCatalogReady(true)
    }).catch(error => { if (!disposed) setPolicyCatalogError(error instanceof Error ? error.message : 'Không tải được chính sách từ hệ thống.') })
    return () => { disposed = true }
  }, [user.id])
  const savePolicies = async (next: PolicyItem[]) => {
    if (policyCatalogBusy) return false
    if (isApiAuthenticated() && !policyCatalogReady) {
      showToast('Chưa tải được chính sách từ hệ thống. Vui lòng tải lại trang trước khi lưu.')
      return false
    }
    const sanitized = next.filter(p => !isExcludedPolicy(p))
    setPolicyCatalogBusy(true); setPolicyCatalogError('')
    try {
      if (isApiAuthenticated()) {
        const persisted = await listAllFacilitiesApi()
        const policies: FacilityContentPolicy[] = sanitized.map(policy => {
          const scopeType = policy.scopeType || (/toàn|all/i.test(policy.scope) ? 'all' : 'specific')
          const selected = policy.facilityIds?.length ? policy.facilityIds : facilitiesList.filter(f =>
            [f.id, f.code, f.name].some(text => text && text.toLowerCase() === policy.scope.toLowerCase())).map(f => f.id)
          const facilityIds = scopeType === 'all' ? [] : resolveBusinessFacilityIds('specific', selected, facilitiesList, persisted)
          if (scopeType === 'specific' && !facilityIds.length) throw new Error(`Chính sách “${policy.name}” chưa xác định được cơ sở. Vui lòng chỉnh phạm vi áp dụng.`)
          return { ...policy, scopeType, facilityIds, category: policy.category || 'billing', description: policy.description || '', lastUpdated: policy.lastUpdated || '' }
        })
        const saved = await saveFacilityContentPolicies(policyCatalogVersion, policies)
        setPolicyCatalogVersion(saved.version)
        setPoliciesList(saved.policies)
      } else {
        setPoliciesList(sanitized)
        localStorage.setItem("storagehub:policies", JSON.stringify(sanitized))
      }
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không lưu được chính sách.'
      setPolicyCatalogError(message); showToast(message)
      return false
    } finally { setPolicyCatalogBusy(false) }
  }

  const handleOpenCreatePolicy = () => {
    setPolicyCatalogError('')
    setPolicyFormName("")

    setPolicyFormValue("")

    setPolicyFormCategory(policyCategoryFilter === 'maintenance' ? 'maintenance' : 'billing')

    setPolicyFormScopeType("all")

    setPolicyFormFacilityIds([])

    setPolicyFormScope(lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities")

    setPolicyFormDesc("")

    setCreatePolicyModal(true)
  }

  const handleSaveNewPolicy = async () => {
    if (!policyFormName.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập tên chính sách!"
          : "Please enter policy name!",
      )

      return
    }

    if (!policyFormValue.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập giá trị áp dụng!"
          : "Please enter policy value!",
      )

      return
    }

    if (policyFormScopeType === 'specific' && policyFormFacilityIds.length === 0) {
      showToast(
        lang === "vi"
          ? "Vui lòng chọn ít nhất một cơ sở áp dụng chính sách này!"
          : "Please select at least one facility!",
      )
      return
    }

    let computedScope = lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"
    if (policyFormScopeType === 'specific') {
      const selectedNames = facilitiesList
        .filter((f) => policyFormFacilityIds.includes(f.id) || (f.code && policyFormFacilityIds.includes(f.code)))
        .map((f) => f.name)

      if (selectedNames.length === 1) {
        computedScope = selectedNames[0]
      } else if (selectedNames.length > 1) {
        computedScope = `${selectedNames.length} cơ sở áp dụng`
      } else {
        computedScope = lang === "vi" ? "Cơ sở chỉ định" : "Specific Facilities"
      }
    }

    const newPolicy: PolicyItem = {
      id: `pol-${Date.now()}`,

      name: policyFormName.trim(),

      value: policyFormValue.trim(),

      category: policyFormCategory,

      scope: computedScope,

      scopeType: policyFormScopeType,

      facilityIds: policyFormScopeType === 'specific' ? policyFormFacilityIds : [],

      editable: true,

      description: policyFormDesc.trim(),

      lastUpdated: new Date().toLocaleDateString("vi-VN"),
    }

    const next = [newPolicy, ...policiesList]

    if (!await savePolicies(next)) return

    // Tự động chuyển bộ lọc sang nhóm của chính sách mới (hoặc 'all') để chính sách vừa tạo hiển thị ngay trước mắt
    if (policyCategoryFilter !== 'all' && policyCategoryFilter !== policyFormCategory) {
      setPolicyCategoryFilter(policyFormCategory)
    }

    // Chính sách nội dung không tự suy diễn điều khoản tính tiền từ tên/chuỗi mô tả.

    setCreatePolicyModal(false)

    showToast(
      lang === "vi"
        ? `Đã thêm chính sách "${newPolicy.name}" thành công!`
        : `Policy added successfully!`,
    )
  }

  const handleOpenEditPolicy = (policy: PolicyItem) => {
    setPolicyCatalogError('')
    setSelectedPolicy(policy)

    const displayName =
      lang === "vi"
        ? policy.name === "Grace Period" || policy.name === "Thời gian gia hạn nợ" || policy.name === "Thời gian ân hạn thanh toán"
          ? "Thời gian ân hạn thanh toán"
          : policy.name === "Late Fee" || policy.name === "Mức phí phạt trễ hạn"
            ? "Mức phí phạt trễ hạn"
            : policy.name === "Security Deposit" || policy.name === "Tiền đặt cọc an ninh"
              ? "Tiền đặt cọc an ninh"
              : policy.name === "Notice to Vacate" || policy.name === "Thời hạn báo trước khi trả kho sớm"
                ? "Thời hạn báo trước khi trả kho sớm"
                : policy.name === "Minimum Lease" || policy.name === "Thời hạn thuê tối thiểu"
                  ? "Thời hạn thuê tối thiểu"
                  : policy.name
        : policy.name

    setPolicyFormName(displayName)
    setPolicyFormValue(policy.value)
    setPolicyFormCategory(getPolicyCategory(policy))

    let detectedScopeType: 'all' | 'specific' = 'all'
    let detectedFacilityIds: string[] = []

    if (policy.scopeType) {
      detectedScopeType = policy.scopeType
      detectedFacilityIds = policy.facilityIds || []
    } else if (policy.facilityIds && policy.facilityIds.length > 0) {
      detectedScopeType = 'specific'
      detectedFacilityIds = policy.facilityIds
    } else if (!isApiAuthenticated()) {
      const s = (policy.scope || '').trim().toLowerCase()
      if (s && !['all facilities', 'toàn bộ cơ sở', 'all', 'toàn bộ'].includes(s)) {
        detectedScopeType = 'specific'
        const matched = facilitiesList.filter((f) =>
          f.name.toLowerCase().includes(s) ||
          s.includes(f.name.toLowerCase()) ||
          (f.code && f.code.toLowerCase() === s) ||
          f.id.toLowerCase() === s
        )
        detectedFacilityIds = matched.map((f) => f.id)
      }
    }

    setPolicyFormScopeType(detectedScopeType)
    setPolicyFormFacilityIds(detectedFacilityIds)
    setPolicyFormScope(policy.scope === "All Facilities" ? "Toàn bộ cơ sở" : policy.scope)
    setPolicyFormDesc(policy.description || "")
    setPolicyModal(true)
  }

  const handleUpdatePolicy = async () => {
    if (!selectedPolicy) return

    if (!policyFormValue.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập giá trị áp dụng!"
          : "Please enter policy value!",
      )

      return
    }

    if (policyFormScopeType === 'specific' && policyFormFacilityIds.length === 0) {
      showToast(
        lang === "vi"
          ? "Vui lòng chọn ít nhất một cơ sở áp dụng chính sách này!"
          : "Please select at least one facility!",
      )
      return
    }

    let computedScope = lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"
    if (policyFormScopeType === 'specific') {
      const selectedNames = facilitiesList
        .filter((f) => policyFormFacilityIds.includes(f.id) || (f.code && policyFormFacilityIds.includes(f.code)))
        .map((f) => f.name)

      if (selectedNames.length === 1) {
        computedScope = selectedNames[0]
      } else if (selectedNames.length > 1) {
        computedScope = `${selectedNames.length} cơ sở áp dụng`
      } else {
        computedScope = lang === "vi" ? "Cơ sở chỉ định" : "Specific Facilities"
      }
    }

    const next = policiesList.map((p) =>
      p.id === selectedPolicy.id
        ? {
          ...p,

          name: policyFormName.trim() || p.name,

          value: policyFormValue.trim(),

          category: policyFormCategory,

          scope: computedScope,

          scopeType: policyFormScopeType,

          facilityIds: policyFormScopeType === 'specific' ? policyFormFacilityIds : [],

          description: policyFormDesc.trim(),

          lastUpdated: new Date().toLocaleDateString("vi-VN"),
        }
        : p,
    )

    if (!await savePolicies(next)) return

    // Chính sách nội dung không tự suy diễn điều khoản tính tiền từ tên/chuỗi mô tả.

    setPolicyModal(false)

    showToast(
      lang === "vi"
        ? "Cập nhật chính sách thành công!"
        : "Policy updated successfully!",
    )
  }

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ kind: 'package' | 'policy'; id: string; title: string } | null>(null)
  const [deleteConfirmationBusy, setDeleteConfirmationBusy] = useState(false)
  const [deleteConfirmationError, setDeleteConfirmationError] = useState('')
  const handleDeletePolicy = async (policyId: string, confirmed = false) => {
    const target = policiesList.find((p) => p.id === policyId)

    if (!target) return

    if (!confirmed) {
      setDeleteConfirmationError('')
      setDeleteConfirmation({ kind: 'policy', id: policyId, title: target.name })
      return
    }
    {
      const next = policiesList.filter((p) => p.id !== policyId)

      if (!await savePolicies(next)) return false

      showToast(
        lang === "vi"
          ? `Đã xóa chính sách "${target.name}"!`
          : `Policy deleted!`,
      )
    }
  }

  const [packageSort, setPackageSort] = useState('months-asc')
  const [packageStatusFilter, setPackageStatusFilter] = useState('all')
  const [durationDiscounts, setDurationDiscounts] = useState<DurationDiscountItem[]>([])

  const reloadPackagePolicies = useCallback(async () => {
    if (!isApiAuthenticated()) return
    try {
      const policies = await listBusinessPackagePolicies()
      const grouped = new Map<string, DurationDiscountItem>()
      policies.forEach(policy => {
        const key = `${policy.code}:${policy.rentalMonths}:${policy.discountRate}:${policy.effectiveFrom}:${policy.effectiveTo ?? ''}`
        const current = grouped.get(key)
        const facilityIds = [...(current?.facilityIds ?? []), policy.facilityId]
        const pubStatus = policy.publicationStatus || (policy.active ? 'PUBLISHED' : 'INACTIVE')
        const runStatus = policy.runtimeStatus || (policy.active ? 'ACTIVE' : 'INACTIVE')
        grouped.set(key, {
          id: current?.id ?? `api-${policy.code}-${policy.rentalMonths}`,
          months: policy.rentalMonths,
          rentalYears: policy.rentalYears,
          freeSetupDays: policy.freeSetupDays,
          title: policy.name,
          label: policy.rentalYears ? `${policy.rentalYears} năm (${policy.rentalMonths} tháng)` : `${policy.rentalMonths} tháng`,
          discountPercent: Number(policy.discountRate) * 100,
          depositPercent: policy.depositRate !== undefined ? Math.round(Number(policy.depositRate) * 100) : 20,
          renewalDiscountPercent: 0,
          description: policy.name,
          appliesTo: 'Đặt mới',
          status: (pubStatus === 'PUBLISHED' && runStatus === 'ACTIVE') ? 'active' : 'inactive',
          publicationStatus: pubStatus,
          runtimeStatus: runStatus,
          effectiveFrom: policy.effectiveFrom,
          effectiveTo: policy.effectiveTo,
          scopeType: 'specific',
          facilityIds,
          backendPolicyIds: { ...(current?.backendPolicyIds ?? {}), [policy.facilityId]: policy.id },
        })
      })
      setDurationDiscounts([...grouped.values()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể tải gói thuê từ backend.')
    }
  }, [])

  useEffect(() => {
    void reloadPackagePolicies()
  }, [reloadPackagePolicies])

  const handlePublishDurationDiscount = async (item: DurationDiscountItem) => {
    if (!item.backendPolicyIds || Object.keys(item.backendPolicyIds).length === 0) return
    try {
      await Promise.all(Object.values(item.backendPolicyIds).map(pid => publishBusinessPackagePolicy(pid)))
      showToast(lang === 'vi' ? `Đã xuất bản gói thuê "${item.title}"!` : `Published package "${item.title}"!`)
      await reloadPackagePolicies()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xuất bản gói thuê.')
    }
  }

  const handleInactiveDurationDiscount = async (item: DurationDiscountItem) => {
    if (!item.backendPolicyIds || Object.keys(item.backendPolicyIds).length === 0) return
    try {
      await Promise.all(Object.values(item.backendPolicyIds).map(pid => inactiveBusinessPackagePolicy(pid)))
      showToast(lang === 'vi' ? `Đã chuyển gói thuê "${item.title}" sang TẠM DỪNG (INACTIVE). Bây giờ bạn có thể chỉnh sửa!` : `Paused package "${item.title}". Edits allowed now!`)
      await reloadPackagePolicies()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể tạm dừng gói thuê.')
    }
  }

  // ── QUẢN LÝ GÓI THUÊ & CHIẾT KHẤU KỲ HẠN ──
  const [createDurationModal, setCreateDurationModal] = useState(false)
  const [formCreateDurationTitle, setFormCreateDurationTitle] = useState("")
  const [formCreateDurationLabel, setFormCreateDurationLabel] = useState("")
  const [formCreateDurationMonths, setFormCreateDurationMonths] = useState<number | string>(9)
  const [formCreateDurationSetupDays, setFormCreateDurationSetupDays] = useState<number | string>('')
  const [formCreateDurationPercent, setFormCreateDurationPercent] = useState<number>(6)
  const [formCreateDurationRenewalPercent, setFormCreateDurationRenewalPercent] = useState<number>(4)
  const [formCreateDurationDepositPercent, setFormCreateDurationDepositPercent] = useState<number>(20)
  const [formCreateDurationAppliesTo, setFormCreateDurationAppliesTo] = useState("Đặt mới & Gia hạn")
  const [formCreateDurationScopeType, setFormCreateDurationScopeType] = useState<'all' | 'specific'>('all')
  const [formCreateDurationFacilityIds, setFormCreateDurationFacilityIds] = useState<string[]>([])
  const [formCreateDurationDesc, setFormCreateDurationDesc] = useState("")
  const [formCreateDurationStatus, setFormCreateDurationStatus] = useState<'active' | 'inactive'>('active')

  const [editDurationModal, setEditDurationModal] = useState(false)
  const [packageFormError, setPackageFormError] = useState<string>()
  const [facilityEditError, setFacilityEditError] = useState<string>()
  const [isUpdatingFacility, setIsUpdatingFacility] = useState(false)

  const resolvePackageFacilities = async (scope: 'all' | 'specific', selectedIds: string[]) => {
    const persisted = await listAllFacilitiesApi()
    return resolveBusinessFacilityIds(scope, selectedIds, facilitiesList, persisted)
  }
  const [selectedDurationItem, setSelectedDurationItem] = useState<DurationDiscountItem | null>(null)
  const [formDurationTitle, setFormDurationTitle] = useState("")
  const [formDurationLabel, setFormDurationLabel] = useState("")
  const [formDurationSetupDays, setFormDurationSetupDays] = useState<number | string>('')
  const [formDurationPercent, setFormDurationPercent] = useState<number>(0)
  const [formDurationRenewalPercent, setFormDurationRenewalPercent] = useState<number>(0)
  const [formDurationDepositPercent, setFormDurationDepositPercent] = useState<number>(20)
  const [formDurationAppliesTo, setFormDurationAppliesTo] = useState("Đặt mới & Gia hạn")
  const [formDurationScopeType, setFormDurationScopeType] = useState<'all' | 'specific'>('all')
  const [formDurationFacilityIds, setFormDurationFacilityIds] = useState<string[]>([])
  const [formDurationDesc, setFormDurationDesc] = useState<string>("")
  const [formDurationStatus, setFormDurationStatus] = useState<'active' | 'inactive'>('active')

  const handleOpenCreateDuration = () => {
    setPackageFormError(undefined)
    setFormCreateDurationTitle("")
    setFormCreateDurationLabel("")
    setFormCreateDurationMonths(9)
    setFormCreateDurationSetupDays('')
    setFormCreateDurationPercent(6)
    setFormCreateDurationRenewalPercent(4)
    setFormCreateDurationDepositPercent(20)
    setFormCreateDurationAppliesTo("Đặt mới & Gia hạn")
    setFormCreateDurationScopeType("all")
    setFormCreateDurationFacilityIds([])
    setFormCreateDurationDesc("")
    setFormCreateDurationStatus("active")
    setCreateDurationModal(true)
  }

  const handleSaveNewDurationDiscount = async () => {
    setPackageFormError(undefined)
    const rawMonths = formCreateDurationMonths
    const parsedMonths = typeof rawMonths === 'number' ? rawMonths : parseInt(String(rawMonths), 10)
    const validMonths = !isNaN(parsedMonths) && parsedMonths > 0 ? parsedMonths : 'other'

    const title = formCreateDurationTitle.trim() || (typeof validMonths === 'number' ? `Gói thuê ${validMonths} tháng` : 'Gói thuê linh hoạt')
    const label = formCreateDurationLabel.trim() || (typeof validMonths === 'number' ? `${validMonths} tháng` : 'Kỳ hạn khác')

    if (formCreateDurationScopeType === 'specific' && formCreateDurationFacilityIds.length === 0) {
      showToast(lang === 'vi' ? 'Vui lòng chọn ít nhất 1 cơ sở áp dụng gói thuê này!' : 'Please select at least one facility!')
      return
    }

    const newPkg: DurationDiscountItem = {
      id: `pkg-${validMonths}m-${Date.now().toString().slice(-4)}`,
      months: validMonths,
      title,
      label,
      discountPercent: Math.max(0, Math.min(100, Number(formCreateDurationPercent) || 0)),
      renewalDiscountPercent: Math.max(0, Math.min(100, Number(formCreateDurationRenewalPercent) || 0)),
      depositPercent: Math.max(5, Math.min(50, Number(formCreateDurationDepositPercent) || 20)),
      description: formCreateDurationDesc.trim() || `Giảm ${formCreateDurationPercent}% cho hợp đồng mới và giảm ${formCreateDurationRenewalPercent}% khi gia hạn ${label}.`,
      appliesTo: formCreateDurationAppliesTo,
      status: formCreateDurationStatus,
      scopeType: formCreateDurationScopeType,
      facilityIds: formCreateDurationScopeType === 'specific' ? formCreateDurationFacilityIds : [],
      freeSetupDays: formCreateDurationSetupDays === '' ? null : Math.max(0, Number(formCreateDurationSetupDays) || 0),
    }

    if (isApiAuthenticated()) {
      try {
        const targetFacilityIds = await resolvePackageFacilities(formCreateDurationScopeType, formCreateDurationFacilityIds)
        if (!targetFacilityIds.length) throw new Error('Chưa có cơ sở để áp dụng gói thuê.')
        const effectiveFrom = new Date().toISOString().slice(0, 10)
        const rentalMonthsNumber = typeof validMonths === 'number' ? validMonths : 1
        const rentalYears = (rentalMonthsNumber % 12 === 0) ? rentalMonthsNumber / 12 : null
        const pubStatus = formCreateDurationStatus === 'active' ? 'PUBLISHED' : 'DRAFT'
        const created = await Promise.all(targetFacilityIds.map(facilityId => createBusinessPackagePolicy({
          facilityId,
          code: `PKG-${validMonths}M-${Date.now().toString().slice(-6)}`,
          name: title,
          rentalMonths: rentalMonthsNumber,
          rentalYears,
          freeSetupDays: newPkg.freeSetupDays,
          discountRate: newPkg.discountPercent / 100,
          depositRate: (newPkg.depositPercent ?? 20) / 100,
          policyVersion: `v${Date.now()}`,
          publicationStatus: pubStatus,
          active: pubStatus === 'PUBLISHED',
          effectiveFrom,
          effectiveTo: null,
        })))
        newPkg.facilityIds = targetFacilityIds
        newPkg.scopeType = 'specific'
        newPkg.rentalYears = rentalYears
        newPkg.publicationStatus = pubStatus
        newPkg.runtimeStatus = pubStatus === 'PUBLISHED' ? 'ACTIVE' : 'DRAFT'
        newPkg.backendPolicyIds = Object.fromEntries(created.map(policy => [policy.facilityId, policy.id]))
      } catch (error) {
        setPackageFormError(error instanceof Error ? error.message : 'Không thể tạo gói thuê.')
        showToast(error instanceof Error ? error.message : 'Không thể tạo gói thuê.')
        return
      }
    }
    const next = [...durationDiscounts, newPkg]
    setDurationDiscounts(next)
    if (!isApiAuthenticated()) localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
    setCreateDurationModal(false)
    showToast(lang === 'vi' ? `Đã tạo gói thuê "${newPkg.title}" thành công!` : `Created package "${newPkg.title}"!`)
  }

  const handleOpenEditDuration = (item: DurationDiscountItem) => {
    if (item.publicationStatus === 'PUBLISHED') {
      showToast(lang === 'vi'
        ? 'Chính sách đang ở trạng thái ĐÃ XUẤT BẢN (PUBLISHED). Theo quy định, cấu hình đã xuất bản không được chỉnh sửa trực tiếp. Vui lòng bấm [Tạm dừng] trước khi chỉnh sửa!'
        : 'Published configuration cannot be edited directly. Pause (INACTIVE) first!')
      return
    }
    setPackageFormError(undefined)
    setSelectedDurationItem(item)
    setFormDurationTitle(item.title)
    setFormDurationLabel(item.label)
    setFormDurationSetupDays(item.freeSetupDays ?? '')
    setFormDurationPercent(item.discountPercent)
    setFormDurationRenewalPercent(item.renewalDiscountPercent)
    setFormDurationDepositPercent(item.depositPercent ?? 20)
    setFormDurationAppliesTo(item.appliesTo || "Đặt mới & Gia hạn")
    setFormDurationScopeType(item.scopeType || "all")
    setFormDurationFacilityIds(item.facilityIds || [])
    setFormDurationDesc(item.description)
    setFormDurationStatus(item.status)
    setEditDurationModal(true)
  }

  const handleSaveDurationDiscount = async () => {
    if (!selectedDurationItem) return
    setPackageFormError(undefined)

    if (formDurationScopeType === 'specific' && formDurationFacilityIds.length === 0) {
      showToast(lang === 'vi' ? 'Vui lòng chọn ít nhất 1 cơ sở áp dụng gói thuê này!' : 'Please select at least one facility!')
      return
    }

    let savedPolicyIds = selectedDurationItem.backendPolicyIds
    let savedFacilityIds = formDurationFacilityIds
    if (isApiAuthenticated()) {
      try {
        const targetIds = await resolvePackageFacilities(formDurationScopeType, formDurationFacilityIds)
        if (!targetIds.length) throw new Error('Chưa chọn cơ sở áp dụng.')
        const currentPolicies = await listBusinessPackagePolicies()
        const saved = []
        const effectiveFrom = new Date().toISOString().slice(0, 10)
        for (const facilityId of targetIds) {
          const id = selectedDurationItem.backendPolicyIds?.[facilityId]
          const existing = currentPolicies.find(p => p.id === id)
          const input = {
          facilityId,
          code: existing?.code || selectedDurationItem.id.replace(/^api-/, '').slice(0, 30),
          name: formDurationTitle.trim() || selectedDurationItem.title,
          rentalMonths: typeof selectedDurationItem.months === 'number' ? selectedDurationItem.months : 1,
          freeSetupDays: formDurationSetupDays === '' ? undefined : Math.max(0, Number(formDurationSetupDays) || 0),
          discountRate: Math.max(0, Math.min(100, Number(formDurationPercent) || 0)) / 100,
          depositRate: Math.max(5, Math.min(50, Number(formDurationDepositPercent) || 20)) / 100,
          policyVersion: `v${Date.now()}`,
          active: formDurationStatus === 'active',
          effectiveFrom,
          effectiveTo: null,
          }
          saved.push(existing ? await updateBusinessPackagePolicy(existing.id, input) : await createBusinessPackagePolicy(input))
        }
        for (const [facilityId, id] of Object.entries(selectedDurationItem.backendPolicyIds || {})) {
          if (!targetIds.includes(facilityId)) await deactivateBusinessPackagePolicy(id)
        }
        savedPolicyIds = Object.fromEntries(saved.map(p => [p.facilityId, p.id]))
        savedFacilityIds = targetIds
      } catch (error) {
        setPackageFormError(error instanceof Error ? error.message : 'Không thể cập nhật gói thuê.')
        showToast(error instanceof Error ? error.message : 'Không thể cập nhật gói thuê.')
        return
      }
    }
    const next = durationDiscounts.map((d) => {
      if (d.id === selectedDurationItem.id) {
        return {
          ...d,
          title: formDurationTitle.trim() || d.title,
          label: formDurationLabel.trim() || d.label,
          freeSetupDays: formDurationSetupDays === '' ? d.freeSetupDays : Math.max(0, Number(formDurationSetupDays) || 0),
          discountPercent: Math.max(0, Math.min(100, Number(formDurationPercent) || 0)),
          renewalDiscountPercent: Math.max(0, Math.min(100, Number(formDurationRenewalPercent) || 0)),
          depositPercent: Math.max(5, Math.min(50, Number(formDurationDepositPercent) || 20)),
          appliesTo: formDurationAppliesTo,
          scopeType: formDurationScopeType,
          facilityIds: isApiAuthenticated() ? savedFacilityIds : formDurationScopeType === 'specific' ? formDurationFacilityIds : [],
          backendPolicyIds: savedPolicyIds,
          description: formDurationDesc.trim() || d.description,
          status: formDurationStatus,
        }
      }
      return d
    })
    setDurationDiscounts(next)
    if (!isApiAuthenticated()) localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
    setEditDurationModal(false)
    showToast(
      lang === "vi"
        ? `Đã cập nhật cấu hình cho ${formDurationTitle.trim() || selectedDurationItem.title}!`
        : `Updated package ${selectedDurationItem.title}!`,
    )
  }

  const handleDeleteDurationDiscount = async (id: string, confirmed = false) => {
    const item = durationDiscounts.find((d) => d.id === id)
    if (!item) return

    if (!confirmed) {
      setDeleteConfirmationError('')
      setDeleteConfirmation({ kind: 'package', id, title: item.title })
      return
    }
    {
      if (isApiAuthenticated() && item.backendPolicyIds) {
        try {
          await Promise.all(Object.values(item.backendPolicyIds).map(policyId => deactivateBusinessPackagePolicy(policyId)))
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Không thể ngừng gói thuê.')
          setDeleteConfirmationError(error instanceof Error ? error.message : 'Không thể ngừng gói thuê.')
          return false
        }
      }
      const next = durationDiscounts.filter((d) => d.id !== id)
      setDurationDiscounts(next)
      if (!isApiAuthenticated()) localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
      if (selectedDurationItem?.id === id) setEditDurationModal(false)
      showToast(lang === 'vi' ? `Đã xóa gói "${item.title}"!` : `Package deleted!`)
    }
  }

  const handleToggleDurationStatus = (id: string) => {
    const next = durationDiscounts.map((d) => {
      if (d.id === id) {
        const nextStatus = d.status === 'active' ? 'inactive' : 'active'
        showToast(
          lang === 'vi'
            ? `${nextStatus === 'active' ? 'Đã kích hoạt' : 'Đã tạm dừng'} gói "${d.title}"!`
            : `Package "${d.title}" is now ${nextStatus}!`
        )
        return { ...d, status: nextStatus as 'active' | 'inactive' }
      }
      return d
    })
    setDurationDiscounts(next)
    if (!isApiAuthenticated()) localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
  }

  const [revenueFacilityFilter, setRevenueFacilityFilter] =
    useState("Toàn bộ cơ sở")

  // Tìm cơ sở đang được chọn (hỗ trợ match ID, tên hoặc mã kho linh hoạt)

  const selectedRevenueFacility = useMemo(() => {
    if (
      revenueFacilityFilter === "Toàn bộ cơ sở" ||
      revenueFacilityFilter === "ALL"
    )
      return null

    return (
      facilitiesList.find(
        (f) =>
          f.id === revenueFacilityFilter ||
          f.name === revenueFacilityFilter ||
          f.code === revenueFacilityFilter ||
          (revenueFacilityFilter.includes("Q1") &&
            (f.code?.includes("HCM-Q1") || f.name.includes("Quận 1"))) ||
          (revenueFacilityFilter.includes("Bình Dương") &&
            (f.code?.includes("BD") || f.name.includes("Bình Dương"))),
      ) || null
    )
  }, [facilitiesList, revenueFacilityFilter])

  const selectedRevenueFacilityName = selectedRevenueFacility
    ? selectedRevenueFacility.name
    : "Toàn bộ cơ sở"

  // Helper kiểm tra xem cơ sở có khớp ID / code / tên không
  const isFacilityMatching = useCallback(
    (fac: any, candidateFacId?: string, candidateFacName?: string) => {
      if (!fac) return false
      if (candidateFacId && candidateFacId === fac.id) return true
      if (
        candidateFacId &&
        fac.code &&
        candidateFacId.toUpperCase() === fac.code.toUpperCase()
      )
        return true
      if (
        candidateFacName &&
        fac.name &&
        candidateFacName.trim().toLowerCase() === fac.name.trim().toLowerCase()
      )
        return true
      return false
    },
    [],
  )

  // Map ngày thanh toán vào tháng báo cáo (Tháng 4 - Tháng 9)
  const getPaymentReportingMonth = useCallback((dateStr?: string): string => {
    if (!dateStr) return "Tháng 9"
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "Tháng 9"
    const m = d.getMonth() + 1
    if (m >= 4 && m <= 9) return `Tháng ${m}`
    return m < 4 ? "Tháng 4" : "Tháng 9"
  }, [])

  // Holds/Reservations của cơ sở đang chọn
  const selectedFacilityHolds = useMemo(() => {
    if (!selectedRevenueFacility) return []
    return (holdsList || []).filter((h) =>
      isFacilityMatching(selectedRevenueFacility, h.facilityId, h.facilityName),
    )
  }, [selectedRevenueFacility, holdsList, isFacilityMatching])

  const selectedFacilityHoldIds = useMemo(() => {
    return new Set(selectedFacilityHolds.map((h) => h.id))
  }, [selectedFacilityHolds])

  // Rentals của cơ sở đang chọn
  const selectedFacilityRentals = useMemo(() => {
    if (!selectedRevenueFacility) return []
    return (rentalsList || []).filter(
      (r) =>
        isFacilityMatching(
          selectedRevenueFacility,
          r.facilityId,
          r.facilityName,
        ) || selectedFacilityHoldIds.has(r.holdId),
    )
  }, [
    selectedRevenueFacility,
    rentalsList,
    selectedFacilityHoldIds,
    isFacilityMatching,
  ])

  const selectedFacilityRentalIds = useMemo(() => {
    return new Set(selectedFacilityRentals.map((r) => r.id))
  }, [selectedFacilityRentals])

  // Contracts của cơ sở đang chọn
  const selectedFacilityContracts = useMemo(() => {
    if (!selectedRevenueFacility) return []
    return (contractsList || []).filter(
      (c) =>
        selectedFacilityHoldIds.has(c.reservationId) ||
        selectedFacilityRentals.some(
          (r) =>
            r.contractId === c.id || r.id === c.id || r.unitId === c.unitId,
        ),
    )
  }, [
    selectedRevenueFacility,
    contractsList,
    selectedFacilityHoldIds,
    selectedFacilityRentals,
  ])

  // Thanh toán thực tế đã hoàn tất (status === 'PAID') của cơ sở đang chọn
  const selectedFacilityPaidPayments = useMemo(() => {
    if (!selectedRevenueFacility) return []
    return (paymentsList || []).filter((p) => {
      if (p.status !== "PAID" || p.type === "REFUND") return false
      if (p.rentalId && selectedFacilityRentalIds.has(p.rentalId)) return true
      if (p.reservationId && selectedFacilityHoldIds.has(p.reservationId))
        return true
      return false
    })
  }, [
    selectedRevenueFacility,
    paymentsList,
    selectedFacilityRentalIds,
    selectedFacilityHoldIds,
  ])

  // Tính doanh thu thực tế MTD của từng cơ sở
  const getFacilityActualRevenue = useCallback(
    (fac: any) => {
      if (!fac) return 0
      const stats = backendFacilityStats[(fac.code || '').trim().toUpperCase()]
      if (stats) return stats.revenue
      if (isApiAuthenticated()) return 0

      const facHoldIds = new Set(
        (holdsList || [])
          .filter((h) => isFacilityMatching(fac, h.facilityId, h.facilityName))
          .map((h) => h.id),
      )
      const facRentalIds = new Set(
        (rentalsList || [])
          .filter(
            (r) =>
              isFacilityMatching(fac, r.facilityId, r.facilityName) ||
              facHoldIds.has(r.holdId),
          )
          .map((r) => r.id),
      )
      const facPaid = (paymentsList || [])
        .filter((p) => {
          if (p.status !== "PAID" || p.type === "REFUND") return false
          if (p.rentalId && facRentalIds.has(p.rentalId)) return true
          if (p.reservationId && facHoldIds.has(p.reservationId)) return true
          return false
        })
        .reduce((s, p) => s + (p.amount || 0), 0)

      return facPaid
    },
    [holdsList, rentalsList, paymentsList, isFacilityMatching, backendFacilityStats],
  )

  const activeRevenueData: MonthlyRevenueRecord[] = useMemo(() => {
    if (isApiAuthenticated()) return []
    const months = ["Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9"]
    const relevantPayments = (paymentsList || []).filter((p) => {
      if (p.status !== "PAID" || p.type === "REFUND") return false
      if (!selectedRevenueFacility) return true
      return selectedFacilityPaidPayments.some((sp) => sp.id === p.id)
    })

    const facOccPct = selectedRevenueFacility
      ? (selectedRevenueFacility.units > 0 && selectedRevenueFacility.occupied > 0
          ? Math.round((selectedRevenueFacility.occupied / selectedRevenueFacility.units) * 100)
          : 0)
      : (facilitiesList.reduce((s, f) => s + (f.units || 0), 0) > 0
          ? Math.round((facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0) / facilitiesList.reduce((s, f) => s + (f.units || 0), 0)) * 100)
          : 0)

    const activeContractsCount = selectedRevenueFacility
      ? Math.max(selectedRevenueFacility.occupied || 0, selectedFacilityContracts.length, selectedFacilityRentals.length)
      : facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0)

    let previousMonthRevenue = 0

    return months.map((monthName, idx) => {
      const monthPayments = relevantPayments.filter(
        (p) => getPaymentReportingMonth(p.paidAt || p.receivedAt) === monthName
      )
      const monthRevenue = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      const monthContracts = idx === months.length - 1 ? activeContractsCount : 0
      const monthOccRate = idx === months.length - 1 && facOccPct > 0 ? `${facOccPct}%` : "0%"
      const monthOccNumber = idx === months.length - 1 && facOccPct > 0 ? facOccPct / 100 : 0

      let growthStr = "0%"
      let growthNum = 0
      if (idx > 0) {
        if (previousMonthRevenue === 0 && monthRevenue > 0) {
          growthStr = "+100%"
          growthNum = 1
        } else if (previousMonthRevenue > 0 && monthRevenue === 0) {
          growthStr = "-100%"
          growthNum = -1
        } else if (previousMonthRevenue > 0 && monthRevenue > 0) {
          const diff = ((monthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
          growthStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}%`
          growthNum = diff / 100
        }
      } else {
        growthStr = "-"
      }

      previousMonthRevenue = monthRevenue

      return {
        month: monthName,
        revenue: monthRevenue,
        growth: growthStr,
        growthNumber: growthNum,
        contracts: monthContracts,
        occupancyRate: monthOccRate,
        occupancyNumber: monthOccNumber,
      }
    })
  }, [
    selectedRevenueFacility,
    paymentsList,
    selectedFacilityPaidPayments,
    facilitiesList,
    selectedFacilityContracts,
    selectedFacilityRentals,
    getPaymentReportingMonth,
  ])

  const currentTotalRevenue = activeRevenueData.reduce(
    (s, i) => s + i.revenue,
    0,
  )

  const currentAvgRevenue = Math.round(
    currentTotalRevenue / (activeRevenueData.length || 1),
  )

  const hasAnyRevenue = currentTotalRevenue > 0

  const currentHighestItem = useMemo(() => {
    if (!hasAnyRevenue) {
      return { month: "Chưa phát sinh", revenue: 0 }
    }
    const nonZeroItems = activeRevenueData.filter((d) => d.revenue > 0)
    if (nonZeroItems.length === 0) {
      return { month: "Chưa phát sinh", revenue: 0 }
    }
    return [...nonZeroItems].sort((a, b) => b.revenue - a.revenue)[0]
  }, [activeRevenueData, hasAnyRevenue])

  const currentForecast = useMemo(() => {
    if (!hasAnyRevenue) {
      return "0 ₫"
    }
    const forecastVal = Math.round(currentHighestItem.revenue * 1.03)
    return `~${forecastVal.toLocaleString("vi-VN")} ₫`
  }, [hasAnyRevenue, currentHighestItem])

  const maxRevenueValue = Math.max(
    ...activeRevenueData.map((d) => d.revenue),
    0,
  )

  const chartYMax =
    maxRevenueValue > 0
      ? Math.ceil(maxRevenueValue / 5000000) * 5000000
      : 10000000

  const [pricingTiers, setPricingTiers] = useState<PricingTierItem[]>(() => {
    if (isApiAuthenticated()) return []
    try {
      const stored = localStorage.getItem("storagehub:pricingTiers")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { }
    return RUNTIME_PRICING_TIERS
  })

  const [selectedTier, setSelectedTier] =
    useState<PricingTierItem | null>(null)

  const [formTierBasePrice, setFormTierBasePrice] = useState<string>("0")

  const [formTierMultiplier, setFormTierMultiplier] = useState<string>("1")

  const [pricingFacilityFilter, setPricingFacilityFilter] =
    useState<string>("all")

  const [facilityPricingOverrides, setFacilityPricingOverrides] = useState<
    Record<
      string,
      Record<string, { basePrice: number; highDemandMultiplier: number }>
    >
  >(() => {
    if (isApiAuthenticated()) return {}
    try {
      const stored = localStorage.getItem("storagehub:facility-pricing")
      if (stored) return JSON.parse(stored)
    } catch { }
    return {}
  })

  const selectedPricingFacility = useMemo(() => {
    if (pricingFacilityFilter === "all") return null
    return (
      facilitiesList.find(
        (f) =>
          f.id === pricingFacilityFilter || f.code === pricingFacilityFilter,
      ) || null
    )
  }, [facilitiesList, pricingFacilityFilter])

  const [facilityPriceModalOpen, setFacilityPriceModalOpen] = useState(false)
  const [editingPriceFacility, setEditingPriceFacility] = useState<any | null>(null)
  const [backendPricingUnitTypes, setBackendPricingUnitTypes] = useState<CustomerUnitType[]>([])
  const [pricingCatalogByCode, setPricingCatalogByCode] = useState<Record<string, CustomerUnitType[]>>({})
  const [pricingCatalogLoading, setPricingCatalogLoading] = useState(false)
  const [pricingCatalogError, setPricingCatalogError] = useState<string>()
  const [pricingCatalogVersion, setPricingCatalogVersion] = useState(0)

  useEffect(() => {
    if (page !== 'pricing' || !isApiAuthenticated()) return
    let mounted = true
    setPricingCatalogLoading(true)
    setPricingCatalogError(undefined)
    listAllFacilitiesApi().then(async facilities => {
      const entries = await Promise.all(facilities.map(async facility => {
        const types = await listAccessibleUnitTypes(facility.id, 0, 100)
        return [facility.code.toUpperCase(), types.data] as const
      }))
      if (mounted) setPricingCatalogByCode(Object.fromEntries(entries))
    }).catch(error => {
      if (mounted) { setPricingCatalogByCode({}); setPricingCatalogError(error instanceof Error ? error.message : 'Không thể tải bảng giá cơ sở.') }
    }).finally(() => { if (mounted) setPricingCatalogLoading(false) })
    return () => { mounted = false }
  }, [page, pricingCatalogVersion])
  const [backendPricingValues, setBackendPricingValues] = useState<Record<string, { monthlyPrice: number; securityDepositAmount: number }>>({})
  const [backendPricingLoading, setBackendPricingLoading] = useState(false)
  const [facilityPricesForm, setFacilityPricesForm] = useState<{ S: number; M: number; L: number; XL: number }>({
    S: 5500000,
    M: 9500000,
    L: 15000000,
    XL: 22500000,
  })
  const [facilityMultiplierForm, setFacilityMultiplierForm] = useState<{ S: number; M: number; L: number; XL: number }>({
    S: 1.0,
    M: 1.0,
    L: 1.0,
    XL: 1.0,
  })

  const handleOpenFacilityPriceModal = async (fac: any) => {
    setEditingPriceFacility(fac)
    const currentOverrides = facilityPricingOverrides[fac.id] || {}
    setFacilityPricesForm({
      S: isApiAuthenticated() ? 0 : currentOverrides["tier-1"]?.basePrice ?? 5500000,
      M: isApiAuthenticated() ? 0 : currentOverrides["tier-2"]?.basePrice ?? 9500000,
      L: isApiAuthenticated() ? 0 : currentOverrides["tier-3"]?.basePrice ?? 15000000,
      XL: isApiAuthenticated() ? 0 : currentOverrides["tier-4"]?.basePrice ?? 22500000,
    })
    setFacilityMultiplierForm({
      S: currentOverrides["tier-1"]?.highDemandMultiplier ?? 1.0,
      M: currentOverrides["tier-2"]?.highDemandMultiplier ?? 1.0,
      L: currentOverrides["tier-3"]?.highDemandMultiplier ?? 1.0,
      XL: currentOverrides["tier-4"]?.highDemandMultiplier ?? 1.0,
    })
    setFacilityPriceModalOpen(true)
    if (isApiAuthenticated()) {
      setBackendPricingLoading(true)
      try {
        const page = await listAccessibleUnitTypes(fac.id, 0, 100)
        setBackendPricingUnitTypes(page.data)
        setBackendPricingValues(Object.fromEntries(page.data.map(unitType => [unitType.id, {
          monthlyPrice: Number(unitType.monthlyPrice) || 0,
          securityDepositAmount: Number(unitType.securityDepositAmount) || 0,
        }])))
      } catch (error) {
        setBackendPricingUnitTypes([])
        setBackendPricingValues({})
        showToast(error instanceof Error ? error.message : 'Không thể tải danh sách loại kho của cơ sở.')
      } finally {
        setBackendPricingLoading(false)
      }
    }
  }

  const handleSaveFacilityPrices = async () => {
    if (!editingPriceFacility) return
    const facId = editingPriceFacility.id
    if (isApiAuthenticated()) {
      if (!backendPricingUnitTypes.length) {
        showToast('Manager chưa khai báo loại kho thực tế cho cơ sở này.')
        return
      }
      const invalid = backendPricingUnitTypes.some(unitType => {
        const value = backendPricingValues[unitType.id]
        return !value || value.monthlyPrice <= 0 || value.securityDepositAmount < 0
      })
      if (invalid) {
        showToast('Giá thuê phải lớn hơn 0 và tiền cọc đảm bảo kho không được âm.')
        return
      }
      try {
        await Promise.all(backendPricingUnitTypes.map(unitType =>
          priceBusinessUnitTypeApi(unitType.id, backendPricingValues[unitType.id])))
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Không thể lưu biểu giá lên backend.')
        return
      }
    }
    if (isApiAuthenticated()) {
      setFacilityPriceModalOpen(false)
      setPricingCatalogVersion(version => version + 1)
      showToast(
        lang === "vi"
          ? `Đã cập nhật biểu giá cho cơ sở "${editingPriceFacility.name}"! Nếu cơ sở đang ở trạng thái Thiết lập, bạn có thể bấm [🚀 Công bố cơ sở] để xuất bản ngay lên Cổng khách hàng.`
          : `Updated pricing for "${editingPriceFacility.name}"!`
      )
      return
    }
    const nextOverrides = {
      ...facilityPricingOverrides,
      [facId]: {
        "tier-1": { basePrice: Number(facilityPricesForm.S) || 5500000, highDemandMultiplier: Number(facilityMultiplierForm.S) || 1.0 },
        "tier-2": { basePrice: Number(facilityPricesForm.M) || 9500000, highDemandMultiplier: Number(facilityMultiplierForm.M) || 1.0 },
        "tier-3": { basePrice: Number(facilityPricesForm.L) || 15000000, highDemandMultiplier: Number(facilityMultiplierForm.L) || 1.0 },
        "tier-4": { basePrice: Number(facilityPricesForm.XL) || 22500000, highDemandMultiplier: Number(facilityMultiplierForm.XL) || 1.0 },
      },
    }
    setFacilityPricingOverrides(nextOverrides)
    try {
      localStorage.setItem("storagehub:facility-pricing", JSON.stringify(nextOverrides))
    } catch { }

    const sizes: Array<"S" | "M" | "L" | "XL"> = ["S", "M", "L", "XL"]
    sizes.forEach((sz) => {
      const p = facilityPricesForm[sz]
      const uList = unitsList.filter(
        (u) =>
          (u.facilityId === facId || u.facilityId === editingPriceFacility.code) &&
          ((u as any).size === sz ||
            u.type === (sz === "S" ? "Small" : sz === "M" ? "Medium" : sz === "L" ? "Large" : "Extra Large")),
      )
      uList.forEach((u) => {
        try {
          updateUnit(u.id, { price: p }, user)
        } catch { }
      })
    })

    try {
      updateFacility(facId, { price: `${formatCurrency(facilityPricesForm.S)}` }, user)
    } catch { }

    setFacilityPriceModalOpen(false)
    showToast(
      lang === "vi"
        ? `Đã cập nhật biểu giá cho cơ sở "${editingPriceFacility.name}"!`
        : `Updated pricing for ${editingPriceFacility.name}!`,
    )
  }

  const handleResetFacilityPrices = () => {
    if (!editingPriceFacility) return
    const facId = editingPriceFacility.id
    const nextOverrides = { ...facilityPricingOverrides }
    delete nextOverrides[facId]
    setFacilityPricingOverrides(nextOverrides)
    try {
      localStorage.setItem("storagehub:facility-pricing", JSON.stringify(nextOverrides))
    } catch { }
    setFacilityPriceModalOpen(false)
    showToast(
      lang === "vi"
        ? `Đã khôi phục giá mặc định cho "${editingPriceFacility.name}"!`
        : `Reset pricing for ${editingPriceFacility.name}!`,
    )
  }

  const handleOpenFacilityDetails = async (facility: Facility) => {
    if (!isApiAuthenticated()) {
      setSelectedFacility(facility)
      setViewFacilityModal(true)
      return
    }
    try {
      const page = await listAccessibleUnitTypes(facility.id, 0, 100)
      setFacilityDetailTypes(page.data)
      setBackendDetailCounts(Object.fromEntries(page.data.map(type => [type.code, {
        total: type.totalCount ?? 0, occupied: type.occupiedCount ?? 0, available: type.availableCount ?? 0,
      }])))
      const specs: FacilityCustomUnitSpec[] = page.data.map((type) => ({
        id: type.id,
        sizeCode: type.code,
        name: type.name,
        lengthM: Number(type.lengthM),
        widthM: Number(type.widthM),
        heightM: Number(type.heightM),
        laneWidthM: Number(type.aisleWidthM || 0),
        maxLoadKg: Number(type.maxLoadKg),
        monthlyPrice: Number(type.monthlyPrice),
        count: Number(type.totalCount || 0),
        frameCount: type.rackCount,
        frameDimensions: {
          lengthM: Number(type.rackLengthM),
          widthM: Number(type.rackWidthM),
          heightM: Number(type.rackHeightM),
        },
      }))
      const totalUnits = specs.reduce((sum, spec) => sum + spec.count, 0)
      setSelectedFacility({
        ...facility,
        units: totalUnits,
        occupied: backendFacilityStats[(facility.code || '').trim().toUpperCase()]?.occupied ?? facility.occupied,
        available: page.data.reduce((sum, type) => sum + Number(type.availableCount || 0), 0),
        unitCustomSpecs: specs,
        unitDistribution: Object.fromEntries(specs.map((spec) => [spec.sizeCode, spec.count])),
        unitPrices: Object.fromEntries(specs.map((spec) => [spec.sizeCode, spec.monthlyPrice])),
      })
      setViewFacilityModal(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể tải thông tin kho của cơ sở.')
    }
  }

  const getEffectiveTier = (tier: PricingTierItem) => {
    if (!tier) {
      return {
        id: "tier-1",
        name: "Kho Nhỏ (S)",
        basePrice: 5500000,
        highDemandMultiplier: 1.15,
        facility: "Toàn bộ cơ sở",
        sizeCode: "S",
      } as PricingTierItem
    }
    if (
      selectedPricingFacility?.id &&
      facilityPricingOverrides?.[selectedPricingFacility.id]?.[tier.id]
    ) {
      const override =
        facilityPricingOverrides[selectedPricingFacility.id][tier.id]
      return {
        ...tier,
        basePrice: override.basePrice,
        highDemandMultiplier: override.highDemandMultiplier,
        facility: selectedPricingFacility.name,
      }
    }
    return {
      ...tier,
      facility: selectedPricingFacility
        ? selectedPricingFacility.name
        : "Toàn bộ cơ sở",
    }
  }

  // Helper lấy giá thực tế theo từng cỡ kho (S, M, L, XL, custom) của một cơ sở
  const getFacilitySizePrice = useCallback(
    (fac: any, size: "S" | "M" | "L" | "XL" | string): number => {
      if (isApiAuthenticated()) {
        const backendTypes = pricingCatalogByCode[(fac?.code || fac?.id || '').toUpperCase()] || []
        const backendType = backendTypes.find(type => {
          const normalized = (type.code || type.name || '').toUpperCase()
          return normalized === size.toUpperCase() || normalized.includes(`-${size.toUpperCase()}-`) || normalized.includes(`(${size.toUpperCase()})`)
        })
        return backendType?.monthlyPrice ?? 0
      }
      if (!fac) return (UNIT_SPECS as any)[size]?.priceMonthly || 5500000

      // 1. Kiểm tra override trong bảng giá (Bảng giá & Biểu phí)
      const tierId =
        size === "S"
          ? "tier-1"
          : size === "M"
            ? "tier-2"
            : size === "L"
              ? "tier-3"
              : "tier-4"
      const override = facilityPricingOverrides[fac.id]?.[tierId]
      if (override?.basePrice && override.basePrice > 0) return override.basePrice

      // 2. Kiểm tra giá riêng theo size được lưu trên cơ sở (unitPrices)
      if (fac.unitPrices?.[size] && fac.unitPrices[size] > 0)
        return fac.unitPrices[size]

      // 3. Kiểm tra giá thực tế của gian kho thuộc cơ sở này trong unitsList
      const facCode = fac.code || fac.id
      const matchingUnits = unitsList.filter(
        (u) =>
          (u.facilityId === fac.id || u.facilityId === facCode) &&
          (((u as any).size ||
            (u.type === "Small"
              ? "S"
              : u.type === "Medium"
                ? "M"
                : u.type === "Large"
                  ? "L"
                  : "XL")) === size),
      )
      if (matchingUnits.length > 0 && matchingUnits[0].price) {
        const rawP = matchingUnits[0].price
        return rawP > 10000 ? rawP : Math.round(rawP * USD_TO_VND_RATE)
      }

      // 4. Nếu cơ sở chỉ có 1 phân loại kho duy nhất (ví dụ toàn bộ 25 kho là XL),
      // thì giá cơ sở từ (fac.price) chính là giá của phân loại kho đó
      const dist = fac.unitDistribution
      const activeSizes = dist
        ? (["S", "M", "L", "XL"] as const).filter((s) => (dist[s] ?? 0) > 0)
        : []
      if (activeSizes.length === 1 && activeSizes[0] === size && fac.price) {
        const parsed = parseInt(fac.price.replace(/\D/g, ""), 10)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }

      // 5. Mặc định theo quy chuẩn pricingTiers hoặc custom spec hoặc UNIT_SPECS
      const customP = fac.unitCustomSpecs?.find((cs: any) => cs.sizeCode === size)?.monthlyPrice
      if (customP && customP > 0) return customP

      const tierMatch = pricingTiers.find((t) => t.sizeCode === size || t.name.includes(`(${size})`))
      if (tierMatch && tierMatch.basePrice > 0) return tierMatch.basePrice

      return (UNIT_SPECS as any)[size]?.priceMonthly || 5500000
    },
    [facilityPricingOverrides, pricingCatalogByCode, unitsList, pricingTiers],
  )

  const getFacilitySizePriceFormatted = useCallback(
    (fac: any, size: "S" | "M" | "L" | "XL" | string): string => {
      const price = getFacilitySizePrice(fac, size)
      return `${Math.round(price).toLocaleString("vi-VN")}đ`
    },
    [getFacilitySizePrice],
  )

  const handleSavePricingTier = () => {
    if (!selectedTier) return
    const parsedPrice = Number(String(formTierBasePrice).replace(/\D/g, ''))
    const parsedMultiplier = Number(formTierMultiplier)
    const updatedPrice =
      parsedPrice > 0 ? parsedPrice : selectedTier.basePrice
    const updatedMultiplier =
      parsedMultiplier > 0
        ? parsedMultiplier
        : selectedTier.highDemandMultiplier

    if (selectedPricingFacility) {
      // Lưu phân tầng giá riêng biệt cho cơ sở được chọn và persist vào localStorage
      const nextOverrides = {
        ...facilityPricingOverrides,
        [selectedPricingFacility.id]: {
          ...facilityPricingOverrides[selectedPricingFacility.id],
          [selectedTier.id]: {
            basePrice: updatedPrice,
            highDemandMultiplier: updatedMultiplier,
          },
        },
      }
      setFacilityPricingOverrides(nextOverrides)
      try {
        localStorage.setItem("storagehub:facility-pricing", JSON.stringify(nextOverrides))
      } catch { }

      // Cập nhật giá gian kho của cơ sở được chọn trong context
      const sizeCode =
        selectedTier.sizeCode ||
        (selectedTier.name.includes("(S)")
          ? "S"
          : selectedTier.name.includes("(M)")
            ? "M"
            : selectedTier.name.includes("(XL)")
              ? "XL"
              : "L")

      const facUnits = unitsList.filter(
        (u) =>
          (u.facilityId === selectedPricingFacility.id ||
            u.facilityId === selectedPricingFacility.code) &&
          ((u as any).size === sizeCode ||
            u.type ===
            (sizeCode === "S"
              ? "Small"
              : sizeCode === "M"
                ? "Medium"
                : sizeCode === "L"
                  ? "Large"
                  : "Extra Large")),
      )
      facUnits.forEach((u) => {
        try {
          updateUnit(u.id, { price: updatedPrice }, user)
        } catch { }
      })

      // Nếu cập nhật Kho S (cước khởi điểm của cơ sở), cập nhật luôn price của facility
      if (selectedTier.id === "tier-1" || selectedTier.name.includes("(S)")) {
        updateFacility(
          selectedPricingFacility.id,
          { price: `${Math.round(updatedPrice).toLocaleString("vi-VN")}đ` },
          user,
        )
      }
    } else {
      // Cập nhật giá niêm yết chuẩn toàn hệ thống
      const nextTiers = pricingTiers.map((t) =>
        t.id === selectedTier.id
          ? {
            ...t,
            basePrice: updatedPrice,
            highDemandMultiplier: updatedMultiplier,
          }
          : t,
      )
      setPricingTiers(nextTiers)
      try {
        localStorage.setItem("storagehub:pricingTiers", JSON.stringify(nextTiers))
      } catch { }

      const sizeCode =
        selectedTier.sizeCode ||
        (selectedTier.name.includes("(S)")
          ? "S"
          : selectedTier.name.includes("(M)")
            ? "M"
            : selectedTier.name.includes("(XL)")
              ? "XL"
              : "L")

      // Không mutate trực tiếp object UNIT_SPECS!
      // Cập nhật giá cho các gian kho chưa bị override riêng
      unitsList
        .filter(
          (u) =>
            ((u as any).size === sizeCode ||
              u.type ===
              (sizeCode === "S"
                ? "Small"
                : sizeCode === "M"
                  ? "Medium"
                  : sizeCode === "L"
                    ? "Large"
                    : "Extra Large")) &&
            !facilityPricingOverrides[u.facilityId]?.[selectedTier.id],
        )
        .forEach((u) => {
          try {
            updateUnit(u.id, { price: updatedPrice }, user)
          } catch { }
        })
    }

    setPricingModal(false)
    showToast(
      lang === "vi"
        ? `Đã cập nhật bảng giá "${selectedTier.name}"${selectedPricingFacility
          ? ` cho ${selectedPricingFacility.name}`
          : " (Toàn hệ thống)"
        }: ${formatCurrency(updatedPrice)}/tháng!`
        : "Pricing tier updated!",
    )
  }

  // ── State Quản Lý Cơ Sở (CRUD Facilities qua StorageHubContext) ──

  const [createFacilityModal, setCreateFacilityModal] = useState<boolean>(false)

  const [editFacilityModal, setEditFacilityModal] = useState<boolean>(false)

  const [deleteFacilityModal, setDeleteFacilityModal] = useState<boolean>(false)
  const [deleteFacilityBusy, setDeleteFacilityBusy] = useState<boolean>(false)
  const [deleteFacilityError, setDeleteFacilityError] = useState<string | null>(null)

  const [viewFacilityModal, setViewFacilityModal] = useState<boolean>(false)

  const [selectedFacility, setSelectedFacility] = useState<any | null>(null)

  const [downloadingExcel, setDownloadingExcel] = useState<boolean>(false)

  const [downloadedFileName, setDownloadedFileName] = useState<string | null>(
    null,
  )

  // Bộ lọc và tìm kiếm cơ sở

  const [facSearch, setFacSearch] = useState<string>("")

  const [facFilterCity, setFacFilterCity] = useState<string>("All")

  const [facFilterStatus, setFacFilterStatus] = useState<string>("All")

  // Form thêm / sửa cơ sở

  const [formFacCode, setFormFacCode] = useState<string>("HN-F01")

  const [formFacName, setFormFacName] = useState<string>("")

  const [formFacAddress, setFormFacAddress] = useState<string>("")

  const [formFacCity, setFormFacCity] = useState<string>("Hà Nội")

  const [formFacManager, setFormFacManager] = useState<string>("")

  const [formFacPhone, setFormFacPhone] = useState<string>("024 3822 9999")

  const [formFacUnits, setFormFacUnits] = useState<number>(0)

  const [formFacUnitS, setFormFacUnitS] = useState<number>(0)

  const [formFacUnitM, setFormFacUnitM] = useState<number>(0)

  const [formFacUnitL, setFormFacUnitL] = useState<number>(0)

  const [formFacUnitXL, setFormFacUnitXL] = useState<number>(0)

  const [formFacPrice, setFormFacPrice] = useState<string>("5.500.000đ")
  const [formFacPriceS, setFormFacPriceS] = useState<string>("5.500.000đ")
  const [formFacPriceM, setFormFacPriceM] = useState<string>("9.500.000đ")
  const [formFacPriceL, setFormFacPriceL] = useState<string>("15.000.000đ")
  const [formFacPriceXL, setFormFacPriceXL] = useState<string>("22.500.000đ")

  const [formFacImage, setFormFacImage] = useState<string>("")
  const [formFacLoadS, setFormFacLoadS] = useState<number>(1000)
  const [formFacLoadM, setFormFacLoadM] = useState<number>(1600)
  const [formFacLoadL, setFormFacLoadL] = useState<number>(2800)
  const [formFacLoadXL, setFormFacLoadXL] = useState<number>(4000)

  const [formFacLengthS, setFormFacLengthS] = useState<number>(UNIT_SPECS.S.lengthM)
  const [formFacLengthM, setFormFacLengthM] = useState<number>(UNIT_SPECS.M.lengthM)
  const [formFacLengthL, setFormFacLengthL] = useState<number>(UNIT_SPECS.L.lengthM)
  const [formFacLengthXL, setFormFacLengthXL] = useState<number>(UNIT_SPECS.XL.lengthM)

  const [formFacWidthS, setFormFacWidthS] = useState<number>(UNIT_SPECS.S.widthM)
  const [formFacWidthM, setFormFacWidthM] = useState<number>(UNIT_SPECS.M.widthM)
  const [formFacWidthL, setFormFacWidthL] = useState<number>(UNIT_SPECS.L.widthM)
  const [formFacWidthXL, setFormFacWidthXL] = useState<number>(UNIT_SPECS.XL.widthM)

  const [formFacLaneS, setFormFacLaneS] = useState<number>(UNIT_SPECS.S.vehicleLaneWidthM)
  const [formFacLaneM, setFormFacLaneM] = useState<number>(UNIT_SPECS.M.vehicleLaneWidthM)
  const [formFacLaneL, setFormFacLaneL] = useState<number>(UNIT_SPECS.L.vehicleLaneWidthM)
  const [formFacLaneXL, setFormFacLaneXL] = useState<number>(UNIT_SPECS.XL.vehicleLaneWidthM)

  const [formFacClimate, setFormFacClimate] = useState<boolean>(false)

  const [formFacSecurity, setFormFacSecurity] = useState<string>(
    "Khóa riêng tự quản, Bảo vệ cổng",
  )

  const [formFacAccessHours, setFormFacAccessHours] = useState<string>(
    "08:00 - 17:00",
  )

  const [formFacStatus, setFormFacStatus] = useState<Facility['status']>(
    "active",
  )

  // Quản lý quy cách / loại gian kho động cho cơ sở (hỗ trợ thêm XXL, Mini, tùy biến D-R-C, giá, xóa an toàn)
  const [formFacUnitSpecs, setFormFacUnitSpecs] = useState<FacilityCustomUnitSpec[]>(() =>
    DEFAULT_FACILITY_UNIT_SPECS.map((s) => ({ ...s })),
  )
  const [showAddUnitSpecModal, setShowAddUnitSpecModal] = useState<boolean>(false)
  const [newSpecSizeCode, setNewSpecSizeCode] = useState<string>("XXL")
  const [newSpecName, setNewSpecName] = useState<string>("Kho Ngoại Khổ (XXL)")
  const [newSpecLength, setNewSpecLength] = useState<number>(25.0)
  const [newSpecWidth, setNewSpecWidth] = useState<number>(12.0)
  const [newSpecHeight, setNewSpecHeight] = useState<number>(5.0)
  const [newSpecLane, setNewSpecLane] = useState<number>(5.0)
  const [newSpecMaxLoad, setNewSpecMaxLoad] = useState<number>(4500)
  const [newSpecPrice, setNewSpecPrice] = useState<string>("28.000.000đ")
  const [newSpecCount, setNewSpecCount] = useState<number>(5)
  const [newSpecFrameCount, setNewSpecFrameCount] = useState<number>(12)
  const [newSpecFrameLength, setNewSpecFrameLength] = useState<number>(4.0)
  const [newSpecFrameWidth, setNewSpecFrameWidth] = useState<number>(2.0)
  const [newSpecFrameHeight, setNewSpecFrameHeight] = useState<number>(4.5)
  const [confirmDeleteSpec, setConfirmDeleteSpec] = useState<{
    sizeCode: string
    name: string
    occ: number
    isEditing: boolean
  } | null>(null)

  const [createValidationErrors, setCreateValidationErrors] = useState<string[]>([])
  const [editValidationErrors, setEditValidationErrors] = useState<string[]>([])
  const [editInitialSpecs, setEditInitialSpecs] = useState<FacilityCustomUnitSpec[]>([])
  const [editInitialFacility, setEditInitialFacility] = useState<any>(null)
  const [highlightSpecCode, setHighlightSpecCode] = useState<string | null>(null)
  const [showConfirmCloseEdit, setShowConfirmCloseEdit] = useState<boolean>(false)

  const handleConfirmAddUnitSpec = () => {
    const rawCode = newSpecSizeCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "")
    if (!rawCode) {
      showToast(lang === "vi" ? "Vui lòng nhập mã loại kho (VD: XXL, MINI, LCK)!" : "Please enter unit size code!")
      return
    }
    if (formFacUnitSpecs.some((s) => s.sizeCode.toUpperCase() === rawCode)) {
      showToast(lang === "vi" ? `Loại kho "${rawCode}" đã tồn tại trong danh mục!` : `Unit type "${rawCode}" already exists!`)
      return
    }
    const cleanName = newSpecName.trim() || `Kho ${rawCode}`
    const len = Math.max(1, Number(newSpecLength) || 1)
    const wid = Math.max(1, Number(newSpecWidth) || 1)
    const hei = Math.max(1, Number(newSpecHeight) || 1)
    const std = getUnitTypeVehicleStandard(rawCode, wid, len)
    const lane = Math.max(std.minLaneM, Number(newSpecLane) || std.minLaneM)
    const maxLoad = Math.max(100, Number(newSpecMaxLoad) || 2000)
    const priceNum = parseInt(newSpecPrice.replace(/\D/g, ""), 10) || 10000000
    const qty = Math.max(0, Number(newSpecCount) || 0)
    const frameCount = Math.max(0, Math.floor(Number(newSpecFrameCount) || 0))
    const frameLen = Math.max(0.1, Number(newSpecFrameLength) || 1)
    const frameWid = Math.max(0.1, Number(newSpecFrameWidth) || 1)
    const frameHei = Math.max(0.1, Number(newSpecFrameHeight) || 1)

    const newSpec: FacilityCustomUnitSpec = {
      sizeCode: rawCode,
      name: cleanName,
      lengthM: len,
      widthM: wid,
      heightM: hei,
      laneWidthM: lane,
      maxLoadKg: maxLoad,
      monthlyPrice: priceNum,
      count: qty,
      badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
      floor: ((formFacUnitSpecs.length % 4) + 1),
      zone: `Khu ${String.fromCharCode(65 + (formFacUnitSpecs.length % 4))}`,
      frameCount,
      frameDimensions: {
        lengthM: frameLen,
        widthM: frameWid,
        heightM: frameHei,
        depthM: frameLen,
      },
    }

    setFormFacUnitSpecs((prev) => [...prev, newSpec])
    setShowAddUnitSpecModal(false)
    showToast(lang === "vi" ? `Đã thêm loại kho "${rawCode}" (${cleanName}) vào cơ sở!` : `Added unit type "${rawCode}"!`)
  }

  const handleDeleteUnitSpec = (sizeCode: string, occCount: number, isEditing: boolean) => {
    if (isEditing && occCount > 0) {
      showToast(
        lang === "vi"
          ? `Không thể xóa loại kho "${sizeCode}" vì đang có ${occCount} gian kho đang được khách thuê!`
          : `Cannot delete unit type "${sizeCode}" because ${occCount} units are occupied!`,
      )
      return
    }
    setFormFacUnitSpecs((prev) => prev.filter((s) => s.sizeCode !== sizeCode))
    showToast(lang === "vi" ? `Đã xóa loại kho "${sizeCode}" khỏi cơ sở!` : `Removed unit type "${sizeCode}"!`)
  }

  const handleUpdateSpecField = (
    sizeCode: string,
    updates: Partial<FacilityCustomUnitSpec>,
  ) => {
    setFormFacUnitSpecs((prev) =>
      prev.map((s) => (s.sizeCode === sizeCode ? { ...s, ...updates } : s)),
    )
  }

  // Toast -> Routed to Topbar Bell
  const showToast = (msg: string) => {
    const pageTitles: Record<string, string> = {
      facilities: 'Quản Lý Cơ Sở',
      performance: 'Hiệu Suất Mặt Bằng',
      pricing: 'Bảng Giá Loại Kho',
      policies: 'Gói Thuê',
      'rental-regulations': 'Quy Định Cho Thuê',
      'rental-source-policies': 'Chính Sách Gia Hạn',
      returns: 'Trả Kho & Quyết Toán',
      'damage-incidents': 'Xử Lý Sự Cố Kho',
      revenue: 'Báo Cáo Doanh Thu',
    }
    notifyBell({
      title: pageTitles[page] || (lang === 'vi' ? 'Thông báo kinh doanh' : 'Business Notice'),
      message: msg,
      page,
      date: new Date().toISOString()
    })
  }

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      showToast(
        lang === "vi"
          ? "Vui lòng chọn file hình ảnh hợp lệ!"
          : "Please select an image file!",
      )
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(
        lang === "vi"
          ? "Dung lượng ảnh tối đa 5MB!"
          : "Max image size is 5MB!",
      )
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const res = ev.target?.result as string
      if (res) {
        setFormFacImage(res)
        showToast(
          lang === "vi"
            ? "Đã tải ảnh kho lên thành công!"
            : "Image uploaded successfully!",
        )
      }
    }
    reader.readAsDataURL(file)
  }

  // Tự do chỉ định số lượng từng cỡ kho (S, M, L, XL)

  const handleUnitSizeChange = (size: "S" | "M" | "L" | "XL", val: number) => {
    const safeVal = Math.max(0, Math.floor(val || 0))

    let s = formFacUnitS
    let m = formFacUnitM
    let l = formFacUnitL
    let xl = formFacUnitXL

    if (size === "S") s = safeVal
    if (size === "M") m = safeVal
    if (size === "L") l = safeVal
    if (size === "XL") xl = safeVal

    setFormFacUnitS(s)
    setFormFacUnitM(m)
    setFormFacUnitL(l)
    setFormFacUnitXL(xl)
    setFormFacUnits(s + m + l + xl)

    // Tự động đồng bộ "Giá cơ sở từ" theo cỡ kho nhỏ nhất có số lượng > 0
    const activeSizes = (["S", "M", "L", "XL"] as const).filter((sz) => {
      if (sz === "S") return s > 0
      if (sz === "M") return m > 0
      if (sz === "L") return l > 0
      return xl > 0
    })
    if (activeSizes.length > 0) {
      const minSz = activeSizes[0]
      const p =
        minSz === "S"
          ? formFacPriceS
          : minSz === "M"
            ? formFacPriceM
            : minSz === "L"
              ? formFacPriceL
              : formFacPriceXL
      if (p) setFormFacPrice(p)
    }
  }

  // Mở modal thêm cơ sở mới với thông tin nhận diện để trống cho BO khai báo.

  const handleOpenCreateFacility = () => {
    const apiMode = isApiAuthenticated()
    setFormFacCode("")
    setFormFacName("")
    setFormFacAddress("")
    setFormFacCity("")
    setFormFacManager("")
    setFormFacPhone("")

    setFormFacUnitS(0)

    setFormFacUnitM(0)

    setFormFacUnitL(0)

    setFormFacUnitXL(0)

    setFormFacUnits(0)

    setFormFacPriceS(apiMode ? "" : "5.500.000đ")
    setFormFacPriceM(apiMode ? "" : "9.500.000đ")
    setFormFacPriceL(apiMode ? "" : "15.000.000đ")
    setFormFacPriceXL(apiMode ? "" : "22.500.000đ")
    setFormFacPrice(apiMode ? "" : "5.500.000đ")

    setFormFacLoadS(apiMode ? 0 : 1000)
    setFormFacLoadM(apiMode ? 0 : 1600)
    setFormFacLoadL(apiMode ? 0 : 2800)
    setFormFacLoadXL(apiMode ? 0 : 4000)

    setFormFacLengthS(apiMode ? 0 : UNIT_SPECS.S.lengthM)
    setFormFacLengthM(apiMode ? 0 : UNIT_SPECS.M.lengthM)
    setFormFacLengthL(apiMode ? 0 : UNIT_SPECS.L.lengthM)
    setFormFacLengthXL(apiMode ? 0 : UNIT_SPECS.XL.lengthM)

    setFormFacWidthS(apiMode ? 0 : UNIT_SPECS.S.widthM)
    setFormFacWidthM(apiMode ? 0 : UNIT_SPECS.M.widthM)
    setFormFacWidthL(apiMode ? 0 : UNIT_SPECS.L.widthM)
    setFormFacWidthXL(apiMode ? 0 : UNIT_SPECS.XL.widthM)

    setFormFacLaneS(apiMode ? 0 : UNIT_SPECS.S.vehicleLaneWidthM)
    setFormFacLaneM(apiMode ? 0 : UNIT_SPECS.M.vehicleLaneWidthM)
    setFormFacLaneL(apiMode ? 0 : UNIT_SPECS.L.vehicleLaneWidthM)
    setFormFacLaneXL(apiMode ? 0 : UNIT_SPECS.XL.vehicleLaneWidthM)

    setFormFacImage("")

    setFormFacClimate(false)

    setFormFacSecurity(apiMode ? "" : "Khóa riêng tự quản, Bảo vệ cổng")

    setFormFacAccessHours(apiMode ? "" : "08:00 - 17:00")

    setFormFacStatus(apiMode ? "setup" : "active")

    const defaultSpecs = (apiMode ? [] : DEFAULT_FACILITY_UNIT_SPECS).map((s) => ({
      ...s,
      count: 5,
      rentalPackages: generateDefaultRentalPackages('', s.sizeCode, s.monthlyPrice),
    }))
    setFormFacUnitSpecs(defaultSpecs)
    setFormFacUnits(isApiAuthenticated() ? 0 : 20)
    setFormFacUnitS(isApiAuthenticated() ? 0 : 5)
    setFormFacUnitM(isApiAuthenticated() ? 0 : 5)
    setFormFacUnitL(isApiAuthenticated() ? 0 : 5)
    setFormFacUnitXL(isApiAuthenticated() ? 0 : 5)

    setCreateFacilityModal(true)
  }

  const handleCreateFacility = async () => {
    const code = formFacCode.trim().toUpperCase()

    if (!code) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập mã cơ sở / kho!"
          : "Please enter facility code!",
      )

      return
    }

    if (facilitiesList.some((f) => (f.code || f.id).toUpperCase() === code)) {
      showToast(
        lang === "vi"
          ? `Mã cơ sở "${code}" đã tồn tại! Vui lòng chọn mã khác.`
          : `Facility code "${code}" already exists!`,
      )

      return
    }

    if (!formFacName.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập tên cơ sở / chi nhánh kho!"
          : "Please enter facility name!",
      )

      return
    }

    if (!formFacAddress.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập địa chỉ cơ sở!"
          : "Please enter facility address!",
      )

      return
    }

    if (!formFacCity.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng chọn hoặc nhập Tỉnh/Thành phố!"
          : "Please enter city!",
      )

      return
    }

    const totalCalculatedUnits = formFacUnitSpecs.reduce((sum, s) => sum + s.count, 0)

    if (!isApiAuthenticated() && totalCalculatedUnits <= 0) {
      showToast(
        lang === "vi"
          ? "Vui lòng chỉ định ít nhất 1 gian kho cho cơ sở!"
          : "Please specify at least 1 storage unit!",
      )

      return
    }

    const unitDistribution: Record<string, number> = {}
    const newUnitPrices: Record<string, number> = {}
    const unitLoadLimits: Record<string, number> = {}
    const unitDimensions: Record<string, { lengthM: number; widthM: number; heightM: number }> = {}
    const unitLaneWidths: Record<string, number> = {}
    const unitFrameCounts: Record<string, number> = {}
    const unitFrameDimensions: Record<string, { lengthM: number; widthM: number; heightM: number }> = {}

    formFacUnitSpecs.forEach((s) => {
      const std = getUnitTypeVehicleStandard(s.sizeCode, s.widthM, s.lengthM)
      const validLane = Math.max(std.minLaneM, s.laneWidthM ?? std.minLaneM)
      unitDistribution[s.sizeCode] = s.count
      newUnitPrices[s.sizeCode] = s.monthlyPrice
      unitLoadLimits[s.sizeCode] = s.maxLoadKg
      unitDimensions[s.sizeCode] = { lengthM: s.lengthM, widthM: s.widthM, heightM: s.heightM }
      unitLaneWidths[s.sizeCode] = validLane
      if (s.frameCount !== undefined) {
        unitFrameCounts[s.sizeCode] = s.frameCount
      }
      if (s.frameDimensions) {
        unitFrameDimensions[s.sizeCode] = {
          lengthM: s.frameDimensions.lengthM ?? s.frameDimensions.depthM ?? 1,
          widthM: s.frameDimensions.widthM ?? 1,
          heightM: s.frameDimensions.heightM ?? 1,
        }
      }
    })

    const totalDesignLoadTon =
      Math.round(
        (formFacUnitSpecs.reduce((sum, s) => sum + s.count * s.maxLoadKg, 0) / 1000) *
        10,
      ) / 10

    const activeSpecs = formFacUnitSpecs.filter((s) => s.count > 0)
    const minPrice = activeSpecs.length > 0
      ? Math.min(...activeSpecs.map((s) => s.monthlyPrice))
      : formFacUnitSpecs[0]?.monthlyPrice || 5500000

    const pS = newUnitPrices.S || 5500000
    const pM = newUnitPrices.M || 9500000
    const pL = newUnitPrices.L || 15000000
    const pXL = newUnitPrices.XL || 22500000

    let backendFacilityId: string | undefined
    let backendFacilityStatus: Facility['status'] | undefined
    try {
      const apiRes = await createFacilityApi({
        code,
        name: formFacName.trim(),
        address: formFacAddress.trim(),
        city: formFacCity.trim(),
        phone: formFacPhone.trim() || null,
        accessHours: formFacAccessHours.trim() || null,
        imageUrl: formFacImage || null,
        climateControlled: formFacClimate,
        securityDescription: formFacSecurity.trim() || null,
      })
      if (apiRes?.id) {
        backendFacilityId = apiRes.id
        backendFacilityStatus = apiRes.status
      }
    } catch (err) {
      if (isApiAuthenticated()) {
        showToast(err instanceof Error ? err.message : 'Không thể tạo cơ sở trên backend.')
        return
      }
      console.warn("Backend create facility API failed/offline:", err)
    }

    const created = createFacility(
      {
        id: backendFacilityId,
        code,

        name: formFacName.trim(),

        address: formFacAddress.trim(),

        city: formFacCity.trim(),

        manager: isApiAuthenticated() ? "Chưa phân công" : (formFacManager.trim() || "Quản lý cơ sở"),

        phone: formFacPhone.trim() || (isApiAuthenticated() ? "" : "1900 6868"),

        units: isApiAuthenticated() ? 0 : totalCalculatedUnits,

        unitDistribution: isApiAuthenticated() ? {} : unitDistribution,

        price: isApiAuthenticated() ? "" : (() => {
          const parsed = parseInt(formFacPrice.replace(/\D/g, ""), 10)
          return !isNaN(parsed) && parsed > 0
            ? `${Math.round(parsed).toLocaleString("vi-VN")}đ`
            : `${Math.round(minPrice).toLocaleString("vi-VN")}đ`
        })(),

        unitPrices: isApiAuthenticated() ? {} : newUnitPrices,

        unitLoadLimits: isApiAuthenticated() ? {} : unitLoadLimits,

        unitDimensions: isApiAuthenticated() ? {} : unitDimensions,

        unitLaneWidths: isApiAuthenticated() ? {} : unitLaneWidths,

        unitFrameCounts: isApiAuthenticated() ? {} : unitFrameCounts,

        unitFrameDimensions: isApiAuthenticated() ? {} : unitFrameDimensions,

        unitCustomSpecs: isApiAuthenticated() ? [] : formFacUnitSpecs,

        totalDesignLoadTon: isApiAuthenticated() ? 0 : totalDesignLoadTon,

        image: formFacImage || "",

        climate: formFacClimate,

        security: formFacSecurity,

        accessHours: formFacAccessHours,

        status: backendFacilityStatus || (isApiAuthenticated() ? "setup" : formFacStatus),

        occupied: 0,

        available: isApiAuthenticated() ? 0 : totalCalculatedUnits,

        revenue: 0,

        growth: 0,
      },
      user,
    )

    // Đồng bộ vào facilityPricingOverrides
    const nextOverrides = isApiAuthenticated() ? facilityPricingOverrides : {
      ...facilityPricingOverrides,
      [created.id]: {
        "tier-1": { basePrice: pS, highDemandMultiplier: 1.15 },
        "tier-2": { basePrice: pM, highDemandMultiplier: 1.15 },
        "tier-3": { basePrice: pL, highDemandMultiplier: 1.15 },
        "tier-4": { basePrice: pXL, highDemandMultiplier: 1.15 },
      },
    }
    if (!isApiAuthenticated()) {
      setFacilityPricingOverrides(nextOverrides)
      try {
        localStorage.setItem("storagehub:facility-pricing", JSON.stringify(nextOverrides))
      } catch { }
    }

    setCreateFacilityModal(false)

    const breakdownStr =
      (isApiAuthenticated() ? [] : formFacUnitSpecs)
        .filter((s) => s.count > 0)
        .map((s) => `${s.sizeCode}: ${s.count}`)
        .join(" · ") || `Tổng: ${created.units} kho`

    showToast(
      lang === "vi"
        ? isApiAuthenticated()
          ? `Đã thêm cơ sở "${created.name}" (${created.code}) ở trạng thái đang thiết lập.`
          : `Đã thêm cơ sở "${created.name}" (${created.code}) với ${created.units} gian kho (${breakdownStr})!`
        : `Facility "${created.name}" created successfully!`,
    )
  }

  const handleOpenEditFacility = (f: any) => {
    const apiMode = isApiAuthenticated()
    setFacilityEditError(undefined)
    setSelectedFacility(f)

    setFormFacCode(f.code || f.id)

    setFormFacName(f.name)

    setFormFacAddress(f.address)

    setFormFacCity(f.city)

    setFormFacManager(f.manager)

    setFormFacPhone(f.phone || (isApiAuthenticated() ? "" : "1900 6868"))

    // Find current unit breakdown

    const facUnits = unitsList.filter(
      (u) => u.facilityId === f.id || u.facilityId === f.code,
    )

    let sCount = 0

    let mCount = 0

    let lCount = 0

    let xlCount = 0

    if (f.unitDistribution) {
      sCount = f.unitDistribution.S ?? 0

      mCount = f.unitDistribution.M ?? 0

      lCount = f.unitDistribution.L ?? 0

      xlCount = f.unitDistribution.XL ?? 0
    } else if (facUnits.length > 0) {
      sCount = facUnits.filter(
        (u) => ((u as any).size || (u.type === "Small" ? "S" : "")) === "S",
      ).length

      mCount = facUnits.filter(
        (u) => ((u as any).size || (u.type === "Medium" ? "M" : "")) === "M",
      ).length

      lCount = facUnits.filter(
        (u) => ((u as any).size || (u.type === "Large" ? "L" : "")) === "L",
      ).length

      xlCount = facUnits.filter(
        (u) =>
          ((u as any).size || (u.type === "Extra Large" ? "XL" : "")) === "XL",
      ).length
    } else if (!isApiAuthenticated()) {
      const base = Math.floor((f.units || 20) / 4)

      sCount = base

      mCount = base

      lCount = base

      xlCount = Math.max(0, (f.units || 20) - base * 3)
    }

    // Nạp danh mục quy cách loại kho động (hỗ trợ cả các loại kho tùy biến như XXL)
    let loadedSpecs: FacilityCustomUnitSpec[] = []
    if (f.unitCustomSpecs && Array.isArray(f.unitCustomSpecs) && f.unitCustomSpecs.length > 0) {
      loadedSpecs = (f.unitCustomSpecs as FacilityCustomUnitSpec[]).map((s: FacilityCustomUnitSpec) => {
        const specFallback = apiMode ? undefined : UNIT_SPECS[s.sizeCode as keyof typeof UNIT_SPECS]
        const fallbackDims = specFallback?.frameDimensions
        const rawDims = s.frameDimensions || f.unitFrameDimensions?.[s.sizeCode] || (fallbackDims ? {
          lengthM: fallbackDims.lengthM ?? fallbackDims.depthM,
          widthM: fallbackDims.widthM,
          heightM: fallbackDims.heightM,
          depthM: fallbackDims.depthM,
        } : undefined)

        return {
          ...s,
          count: f.unitDistribution?.[s.sizeCode] ?? s.count ?? 0,
          monthlyPrice: f.unitPrices?.[s.sizeCode] ?? s.monthlyPrice ?? (apiMode ? 0 : 5500000),
          lengthM: f.unitDimensions?.[s.sizeCode]?.lengthM ?? s.lengthM,
          widthM: f.unitDimensions?.[s.sizeCode]?.widthM ?? s.widthM,
          heightM: (f.unitDimensions?.[s.sizeCode] as any)?.heightM ?? s.heightM ?? (apiMode ? 0 : 5),
          laneWidthM: f.unitLaneWidths?.[s.sizeCode] ?? s.laneWidthM ?? (apiMode ? 0 : 4),
          maxLoadKg: f.unitLoadLimits?.[s.sizeCode] ?? s.maxLoadKg ?? (apiMode ? 0 : 1000),
          frameCount: s.frameCount ?? f.unitFrameCounts?.[s.sizeCode] ?? specFallback?.frameCount ?? 0,
          frameDimensions: rawDims ? {
            lengthM: rawDims.lengthM ?? (rawDims as any).depthM ?? 1,
            widthM: rawDims.widthM ?? 1,
            heightM: rawDims.heightM ?? 1,
            depthM: (rawDims as any).depthM ?? rawDims.lengthM ?? 1,
          } : undefined
        }
      })
    } else if (isApiAuthenticated()) {
      loadedSpecs = []
    } else {
      const dist = f.unitDistribution || {}
      const sizeKeys = Array.from(new Set<string>([
        ...Object.keys(dist),
        ...facUnits.map(u => (u as any).size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : u.type === 'Extra Large' ? 'XL' : (u as any).sizeCode || 'S')),
        'S', 'M', 'L', 'XL'
      ]))

      loadedSpecs = sizeKeys.map((sz, idx) => {
        const spec = UNIT_SPECS[sz as keyof typeof UNIT_SPECS]
        const unit = facUnits.find(u => ((u as any).size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : u.type === 'Extra Large' ? 'XL' : '')) === sz)
        const count = dist[sz] ?? facUnits.filter(u => ((u as any).size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : u.type === 'Extra Large' ? 'XL' : '')) === sz).length
        const p = getFacilitySizePrice(f, sz as any)
        const load = f.unitLoadLimits?.[sz] ?? unit?.maxLoadKg ?? spec?.maxLoadKg ?? 1000
        const len = f.unitDimensions?.[sz]?.lengthM ?? unit?.dimensions?.lengthM ?? spec?.lengthM ?? 8
        const wid = f.unitDimensions?.[sz]?.widthM ?? unit?.dimensions?.widthM ?? spec?.widthM ?? 10
        const hei = (f.unitDimensions?.[sz] as any)?.heightM ?? unit?.dimensions?.heightM ?? spec?.heightM ?? 5
        const lane = f.unitLaneWidths?.[sz] ?? spec?.vehicleLaneWidthM ?? 4
        const fallbackDims = spec?.frameDimensions
        const rawDims = f.unitFrameDimensions?.[sz] || (fallbackDims ? {
          lengthM: fallbackDims.lengthM ?? fallbackDims.depthM,
          widthM: fallbackDims.widthM,
          heightM: fallbackDims.heightM,
          depthM: fallbackDims.depthM,
        } : undefined)

        const badgeClass = sz === 'S' ? 'bg-sky-50 text-sky-700 border-sky-200'
          : sz === 'M' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : sz === 'L' ? 'bg-purple-50 text-purple-700 border-purple-200'
              : sz === 'XL' ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'

        const name = sz === 'S' ? 'Kho Nhỏ (S)' : sz === 'M' ? 'Kho Trung (M)' : sz === 'L' ? 'Kho Lớn (L)' : sz === 'XL' ? 'Kho Rất Lớn (XL)' : `Kho ${sz}`

        return {
          sizeCode: sz,
          name,
          lengthM: len,
          widthM: wid,
          heightM: hei,
          laneWidthM: lane,
          maxLoadKg: load,
          monthlyPrice: p,
          count,
          badgeClass,
          floor: ((idx % 4) + 1),
          zone: `Khu ${String.fromCharCode(65 + (idx % 4))}`,
          frameCount: f.unitFrameCounts?.[sz] ?? spec?.frameCount ?? 0,
          frameDimensions: rawDims ? {
            lengthM: rawDims.lengthM ?? (rawDims as any).depthM ?? 1,
            widthM: rawDims.widthM ?? 1,
            heightM: rawDims.heightM ?? 1,
            depthM: (rawDims as any).depthM ?? rawDims.lengthM ?? 1,
          } : undefined,
          rentalPackages: generateDefaultRentalPackages(f.id, sz, p),
        }
      })
    }
    setFormFacUnitSpecs(loadedSpecs)
    setEditInitialSpecs(loadedSpecs.map((s) => ({
      ...s,
      frameDimensions: s.frameDimensions ? { ...s.frameDimensions } : undefined,
    })))
    setEditInitialFacility(f)

    setFormFacUnitS(sCount)

    setFormFacUnitM(mCount)

    setFormFacUnitL(lCount)

    setFormFacUnitXL(xlCount)

    setFormFacUnits(sCount + mCount + lCount + xlCount)

    const sPrice = getFacilitySizePrice(f, "S")
    const mPrice = getFacilitySizePrice(f, "M")
    const lPrice = getFacilitySizePrice(f, "L")
    const xlPrice = getFacilitySizePrice(f, "XL")

    setFormFacPriceS(`${Math.round(sPrice).toLocaleString("vi-VN")}đ`)
    setFormFacPriceM(`${Math.round(mPrice).toLocaleString("vi-VN")}đ`)
    setFormFacPriceL(`${Math.round(lPrice).toLocaleString("vi-VN")}đ`)
    setFormFacPriceXL(`${Math.round(xlPrice).toLocaleString("vi-VN")}đ`)

    const activeSizes = (["S", "M", "L", "XL"] as const).filter((s) => {
      if (s === "S") return sCount > 0
      if (s === "M") return mCount > 0
      if (s === "L") return lCount > 0
      return xlCount > 0
    })

    if (f.price) {
      setFormFacPrice(f.price)
      if (activeSizes.length === 1) {
        const only = activeSizes[0]
        if (only === "XL") setFormFacPriceXL(f.price)
        else if (only === "L") setFormFacPriceL(f.price)
        else if (only === "M") setFormFacPriceM(f.price)
        else if (only === "S") setFormFacPriceS(f.price)
      }
    } else {
      const startSize = activeSizes[0] || "S"
      const startPrice =
        startSize === "S"
          ? sPrice
          : startSize === "M"
            ? mPrice
            : startSize === "L"
              ? lPrice
              : xlPrice
      setFormFacPrice(`${Math.round(startPrice).toLocaleString("vi-VN")}đ`)
    }

    const sLoad =
      f.unitLoadLimits?.S ??
      facUnits.find(
        (u) => ((u as any).size || (u.type === "Small" ? "S" : "")) === "S",
      )?.maxLoadKg ??
      (apiMode ? 0 : 1000)
    const mLoad =
      f.unitLoadLimits?.M ??
      facUnits.find(
        (u) => ((u as any).size || (u.type === "Medium" ? "M" : "")) === "M",
      )?.maxLoadKg ??
      (apiMode ? 0 : 1600)
    const lLoad =
      f.unitLoadLimits?.L ??
      facUnits.find(
        (u) => ((u as any).size || (u.type === "Large" ? "L" : "")) === "L",
      )?.maxLoadKg ??
      (apiMode ? 0 : 2800)
    const xlLoad =
      f.unitLoadLimits?.XL ??
      facUnits.find(
        (u) =>
          ((u as any).size || (u.type === "Extra Large" ? "XL" : "")) === "XL",
      )?.maxLoadKg ??
      (apiMode ? 0 : 4000)

    setFormFacLoadS(sLoad)
    setFormFacLoadM(mLoad)
    setFormFacLoadL(lLoad)
    setFormFacLoadXL(xlLoad)

    const sUnit = facUnits.find((u) => ((u as any).size || (u.type === "Small" ? "S" : "")) === "S")
    const mUnit = facUnits.find((u) => ((u as any).size || (u.type === "Medium" ? "M" : "")) === "M")
    const lUnit = facUnits.find((u) => ((u as any).size || (u.type === "Large" ? "L" : "")) === "L")
    const xlUnit = facUnits.find((u) => ((u as any).size || (u.type === "Extra Large" ? "XL" : "")) === "XL")

    const sLength = f.unitDimensions?.S?.lengthM ?? sUnit?.dimensions?.lengthM ?? (apiMode ? 0 : UNIT_SPECS.S.lengthM)
    const mLength = f.unitDimensions?.M?.lengthM ?? mUnit?.dimensions?.lengthM ?? (apiMode ? 0 : UNIT_SPECS.M.lengthM)
    const lLength = f.unitDimensions?.L?.lengthM ?? lUnit?.dimensions?.lengthM ?? (apiMode ? 0 : UNIT_SPECS.L.lengthM)
    const xlLength = f.unitDimensions?.XL?.lengthM ?? xlUnit?.dimensions?.lengthM ?? (apiMode ? 0 : UNIT_SPECS.XL.lengthM)

    const sWidth = f.unitDimensions?.S?.widthM ?? sUnit?.dimensions?.widthM ?? (apiMode ? 0 : UNIT_SPECS.S.widthM)
    const mWidth = f.unitDimensions?.M?.widthM ?? mUnit?.dimensions?.widthM ?? (apiMode ? 0 : UNIT_SPECS.M.widthM)
    const lWidth = f.unitDimensions?.L?.widthM ?? lUnit?.dimensions?.widthM ?? (apiMode ? 0 : UNIT_SPECS.L.widthM)
    const xlWidth = f.unitDimensions?.XL?.widthM ?? xlUnit?.dimensions?.widthM ?? (apiMode ? 0 : UNIT_SPECS.XL.widthM)

    setFormFacLengthS(sLength)
    setFormFacLengthM(mLength)
    setFormFacLengthL(lLength)
    setFormFacLengthXL(xlLength)

    setFormFacWidthS(sWidth)
    setFormFacWidthM(mWidth)
    setFormFacWidthL(lWidth)
    setFormFacWidthXL(xlWidth)

    const sLane = f.unitLaneWidths?.S ?? (apiMode ? 0 : UNIT_SPECS.S.vehicleLaneWidthM)
    const mLane = f.unitLaneWidths?.M ?? (apiMode ? 0 : UNIT_SPECS.M.vehicleLaneWidthM)
    const lLane = f.unitLaneWidths?.L ?? (apiMode ? 0 : UNIT_SPECS.L.vehicleLaneWidthM)
    const xlLane = f.unitLaneWidths?.XL ?? (apiMode ? 0 : UNIT_SPECS.XL.vehicleLaneWidthM)

    setFormFacLaneS(sLane)
    setFormFacLaneM(mLane)
    setFormFacLaneL(lLane)
    setFormFacLaneXL(xlLane)

    setFormFacImage(f.image || "")

    setFormFacClimate(Boolean(f.climate))

    setFormFacSecurity(f.security || (apiMode ? "" : "Khóa riêng tự quản, Bảo vệ cổng"))

    setFormFacAccessHours(
      f.accessHours || (isApiAuthenticated() ? "" : "08:00 - 17:00"),
    )

    setFormFacStatus(f.status)
    setEditValidationErrors([])
    setHighlightSpecCode(null)
    setFacilityEditError(undefined)
    setEditFacilityModal(true)
  }

  const handleUpdateFacility = async () => {
    if (!selectedFacility || isUpdatingFacility) return
    setFacilityEditError(undefined)
    setIsUpdatingFacility(true)

    if (isApiAuthenticated()) {
      try {
        const persisted = (await listAllFacilitiesApi()).find(f => f.id === selectedFacility.id || f.code.toUpperCase() === (selectedFacility.code || '').toUpperCase())
        if (!persisted) throw new Error('Không tìm thấy cơ sở trên hệ thống. Vui lòng tải lại trang.')
        const saved = await updateBusinessFacilityApi(persisted.id, {
          name: formFacName.trim(), address: formFacAddress.trim(), city: formFacCity.trim(),
          phone: formFacPhone.trim() || null, accessHours: formFacAccessHours.trim() || null,
          imageUrl: formFacImage || null, climateControlled: formFacClimate,
          securityDescription: formFacSecurity.trim() || null, status: formFacStatus,
        })
        updateFacility(selectedFacility.id, {
          name: saved.name, address: saved.address, city: saved.city, phone: saved.phone || '',
          accessHours: saved.accessHours || '', image: saved.imageUrl || '', status: saved.status,
          climate: Boolean(saved.climateControlled), security: saved.securityDescription || '',
        })
        setEditFacilityModal(false)
        showToast('Đã lưu thông tin cơ sở.')
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Không thể lưu thông tin cơ sở.'
        setFacilityEditError(errorMsg)
        showToast(errorMsg)
      } finally {
        setIsUpdatingFacility(false)
      }
      return
    }

    const code = formFacCode.trim().toUpperCase()

    if (!code) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập mã cơ sở / kho!"
          : "Please enter facility code!",
      )

      return
    }

    const duplicate = facilitiesList.find(
      (f) =>
        (f.code || f.id).toUpperCase() === code && f.id !== selectedFacility.id,
    )

    if (duplicate) {
      showToast(
        lang === "vi"
          ? `Mã cơ sở "${code}" đã thuộc về cơ sở khác!`
          : `Facility code "${code}" already exists!`,
      )

      return
    }

    if (!formFacName.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập tên cơ sở!"
          : "Please enter facility name!",
      )

      return
    }

    if (!formFacAddress.trim()) {
      showToast(
        lang === "vi"
          ? "Vui lòng nhập địa chỉ cơ sở!"
          : "Please enter facility address!",
      )

      return
    }

    const totalCalculatedUnits = formFacUnitSpecs.reduce((sum, s) => sum + s.count, 0)

    if (!isApiAuthenticated() && totalCalculatedUnits <= 0) {
      showToast(
        lang === "vi"
          ? "Vui lòng chỉ định ít nhất 1 gian kho cho cơ sở!"
          : "Please specify at least 1 storage unit!",
      )

      return
    }

    // Validation an toàn: Không cho phép giảm số lượng thấp hơn số gian kho đang được khách thuê (occupied)
    const facUnits = unitsList.filter(
      (u) =>
        u.facilityId === selectedFacility.id ||
        u.facilityId === selectedFacility.code,
    )

    for (const spec of formFacUnitSpecs) {
      const occForSpec = facUnits.filter((u) => {
        const s =
          (u as any).sizeCode ||
          (u as any).size ||
          (u.type === "Small"
            ? "S"
            : u.type === "Medium"
              ? "M"
              : u.type === "Large"
                ? "L"
                : u.type === "Extra Large"
                  ? "XL"
                  : String(u.type))
        return (
          (s === spec.sizeCode ||
            (spec.sizeCode === "S" && u.type === "Small") ||
            (spec.sizeCode === "M" && u.type === "Medium") ||
            (spec.sizeCode === "L" && u.type === "Large") ||
            (spec.sizeCode === "XL" && u.type === "Extra Large")) &&
          (u.status === "occupied" || (u.status as string) === "rented")
        )
      }).length

      if (spec.count < occForSpec) {
        showToast(
          lang === "vi"
            ? `Không thể giảm Loại kho "${spec.name}" (${spec.sizeCode}) xuống ${spec.count} vì hiện có ${occForSpec} gian kho đang được khách thuê.`
            : `Cannot reduce Unit "${spec.sizeCode}" to ${spec.count} because ${occForSpec} units are occupied.`,
        )
        return
      }
    }
    const unitDistribution: Record<string, number> = {}
    const updatedUnitPrices: Record<string, number> = {}
    const unitLoadLimits: Record<string, number> = {}
    const unitDimensions: Record<string, { lengthM: number; widthM: number; heightM: number }> = {}
    const unitLaneWidths: Record<string, number> = {}
    const unitFrameCounts: Record<string, number> = {}
    const unitFrameDimensions: Record<string, { lengthM: number; widthM: number; heightM: number }> = {}

    formFacUnitSpecs.forEach((s) => {
      const std = getUnitTypeVehicleStandard(s.sizeCode, s.widthM, s.lengthM)
      const validLane = Math.max(std.minLaneM, s.laneWidthM ?? std.minLaneM)
      unitDistribution[s.sizeCode] = s.count
      updatedUnitPrices[s.sizeCode] = s.monthlyPrice
      unitLoadLimits[s.sizeCode] = s.maxLoadKg
      unitDimensions[s.sizeCode] = { lengthM: s.lengthM, widthM: s.widthM, heightM: s.heightM }
      unitLaneWidths[s.sizeCode] = validLane
      if (s.frameCount !== undefined) {
        unitFrameCounts[s.sizeCode] = s.frameCount
      }
      if (s.frameDimensions) {
        unitFrameDimensions[s.sizeCode] = {
          lengthM: s.frameDimensions.lengthM ?? s.frameDimensions.depthM ?? 1,
          widthM: s.frameDimensions.widthM ?? 1,
          heightM: s.frameDimensions.heightM ?? 1,
        }
      }
    })

    const totalDesignLoadTon =
      Math.round(
        (formFacUnitSpecs.reduce((sum, s) => sum + s.count * s.maxLoadKg, 0) / 1000) *
        10,
      ) / 10

    const activeSpecs = formFacUnitSpecs.filter((s) => s.count > 0)
    const minPrice = activeSpecs.length > 0
      ? Math.min(...activeSpecs.map((s) => s.monthlyPrice))
      : formFacUnitSpecs[0]?.monthlyPrice || 5500000

    const finalPriceStr = (() => {
      const parsed = parseInt(formFacPrice.replace(/\D/g, ""), 10)
      return !isNaN(parsed) && parsed > 0
        ? `${Math.round(parsed).toLocaleString("vi-VN")}đ`
        : `${Math.round(minPrice).toLocaleString("vi-VN")}đ`
    })()

    const pS = updatedUnitPrices.S || 5500000
    const pM = updatedUnitPrices.M || 9500000
    const pL = updatedUnitPrices.L || 15000000
    const pXL = updatedUnitPrices.XL || 22500000

    if (isApiAuthenticated()) {
      try {
        let backendFacilityId = backendFacilityIdsByCode[code] || selectedFacility.id
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(backendFacilityId)) {
          const backendFacilities = await listAllFacilitiesApi()
          const persistedFacility = backendFacilities.find(
            (facility) => facility.code.trim().toUpperCase() === code,
          )
          if (!persistedFacility) {
            throw new Error(`Không tìm thấy cơ sở "${code}" trên backend. Vui lòng tải lại trang.`)
          }
          backendFacilityId = persistedFacility.id
          setBackendFacilityIdsByCode((current) => ({ ...current, [code]: persistedFacility.id }))
        }
        await updateBusinessFacilityApi(backendFacilityId, {
          name: formFacName.trim(),
          address: formFacAddress.trim(),
          city: formFacCity.trim(),
          phone: formFacPhone.trim() || null,
          accessHours: formFacAccessHours.trim() || null,
          imageUrl: formFacImage || null,
          climateControlled: formFacClimate,
          securityDescription: formFacSecurity.trim() || null,
          status: formFacStatus,
        })
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Không thể cập nhật cơ sở trên backend.')
        return
      }
    }

    updateFacility(
      selectedFacility.id,
      {
        code,

        name: formFacName.trim(),

        address: formFacAddress.trim(),

        city: formFacCity.trim(),

        manager: isApiAuthenticated() ? selectedFacility.manager : formFacManager.trim(),

        phone: formFacPhone.trim(),

        units: isApiAuthenticated() ? selectedFacility.units : totalCalculatedUnits,

        unitDistribution: isApiAuthenticated() ? selectedFacility.unitDistribution : unitDistribution,

        price: finalPriceStr,

        unitPrices: isApiAuthenticated() ? selectedFacility.unitPrices : updatedUnitPrices,

        unitLoadLimits: isApiAuthenticated() ? selectedFacility.unitLoadLimits : unitLoadLimits,

        unitDimensions: isApiAuthenticated() ? selectedFacility.unitDimensions : unitDimensions,

        unitLaneWidths: isApiAuthenticated() ? selectedFacility.unitLaneWidths : unitLaneWidths,

        unitFrameCounts: isApiAuthenticated() ? selectedFacility.unitFrameCounts : unitFrameCounts,

        unitFrameDimensions: isApiAuthenticated() ? selectedFacility.unitFrameDimensions : unitFrameDimensions,

        unitCustomSpecs: isApiAuthenticated() ? selectedFacility.unitCustomSpecs : formFacUnitSpecs,

        totalDesignLoadTon: isApiAuthenticated() ? selectedFacility.totalDesignLoadTon : totalDesignLoadTon,

        image: formFacImage,

        climate: formFacClimate,

        security: formFacSecurity,

        accessHours: formFacAccessHours,

        status: formFacStatus,
      },
      user,
    )

    // Cập nhật facilityPricingOverrides để tab Bảng giá cũng đồng bộ
    const nextOverrides = isApiAuthenticated() ? facilityPricingOverrides : {
      ...facilityPricingOverrides,
      [selectedFacility.id]: {
        ...facilityPricingOverrides[selectedFacility.id],
        "tier-1": { basePrice: pS, highDemandMultiplier: 1.15 },
        "tier-2": { basePrice: pM, highDemandMultiplier: 1.15 },
        "tier-3": { basePrice: pL, highDemandMultiplier: 1.15 },
        "tier-4": { basePrice: pXL, highDemandMultiplier: 1.15 },
      },
    }
    if (!isApiAuthenticated()) {
      setFacilityPricingOverrides(nextOverrides)
      try {
        localStorage.setItem("storagehub:facility-pricing", JSON.stringify(nextOverrides))
      } catch { }
    }

    // Cập nhật giá từng kho trong unitsList qua updateUnit
    unitsList
      .filter(
        (u) =>
          u.facilityId === selectedFacility.id ||
          u.facilityId === selectedFacility.code ||
          u.facilityId === code,
      )
      .forEach((u) => {
        const s = ((u as any).size ||
          (u.type === "Small"
            ? "S"
            : u.type === "Medium"
              ? "M"
              : u.type === "Large"
                ? "L"
                : "XL")) as "S" | "M" | "L" | "XL"
        const pVnd = updatedUnitPrices[s]
        if (pVnd && pVnd > 0) {
          const normP = pVnd > 10000 ? pVnd / USD_TO_VND_RATE : pVnd
          try {
            updateUnit(u.id, { price: normP, deposit: normP }, user)
          } catch { }
        }
      })

    // Cập nhật ngay selectedFacility trong state để modal view đồng bộ ngay
    setSelectedFacility((prev: any) =>
      prev
        ? {
          ...prev,
          code,
          name: formFacName.trim(),
          address: formFacAddress.trim(),
          city: formFacCity.trim(),
          price: finalPriceStr,
          unitPrices: updatedUnitPrices,
          unitLoadLimits,
          totalDesignLoadTon,
          image: formFacImage,
          unitDistribution: {
            S: formFacUnitS,
            M: formFacUnitM,
            L: formFacUnitL,
            XL: formFacUnitXL,
          },
        }
        : prev,
    )

    setEditFacilityModal(false)

    const breakdownStr = `S: ${formFacUnitS} · M: ${formFacUnitM} · L: ${formFacUnitL} · XL: ${formFacUnitXL} · Tải trọng sàn: ${totalDesignLoadTon} tấn`

    showToast(
      lang === "vi"
        ? `Đã cập nhật cơ sở "${formFacName}" thành công (${totalCalculatedUnits} kho · ${breakdownStr})!`
        : `Facility updated!`,
    )
  }

  const handleDeactivateFacility = async () => {
    if (!selectedFacility) return
    setDeleteFacilityBusy(true)
    setDeleteFacilityError(null)

    try {
      if (isApiAuthenticated()) {
        const persisted = (await listAllFacilitiesApi()).find(
          f => f.id === selectedFacility.id || (f.code && f.code.toUpperCase() === (selectedFacility.code || '').toUpperCase())
        )
        if (persisted) {
          await updateBusinessFacilityApi(persisted.id, {
            name: persisted.name,
            address: persisted.address,
            city: persisted.city,
            phone: persisted.phone || null,
            accessHours: persisted.accessHours || null,
            imageUrl: persisted.imageUrl || null,
            climateControlled: persisted.climateControlled,
            securityDescription: persisted.securityDescription || null,
            status: 'inactive',
          })
        }
      }
      updateFacility(selectedFacility.id, { status: 'inactive' }, user)
      setDeleteFacilityModal(false)
      showToast(
        lang === "vi"
          ? `Đã chuyển cơ sở "${selectedFacility.name}" sang trạng thái Ngừng hoạt động.`
          : `Facility "${selectedFacility.name}" deactivated.`
      )
      // Đồng bộ lại danh sách cơ sở từ backend
      try {
        const backendFacs = await listAllFacilitiesApi()
        if (Array.isArray(backendFacs)) {
          backendFacs.forEach(bf => {
            const cleanBf = sanitizeFacilityStrings(bf)
            const matching = facilitiesList.find(
              f => f.id === cleanBf.id || (f.code && f.code.toUpperCase() === (cleanBf.code || '').toUpperCase())
            )
            if (matching) {
              updateFacility(matching.id, { status: cleanBf.status }, user)
            }
          })
        }
      } catch {}
    } catch (error) {
      setDeleteFacilityError(error instanceof Error ? error.message : 'Không thể chuyển trạng thái cơ sở.')
    } finally {
      setDeleteFacilityBusy(false)
    }
  }

  const handlePublishFacility = async (facility: Facility) => {
    try {
      if (isApiAuthenticated()) {
        const persisted = (await listAllFacilitiesApi()).find(
          f => f.id === facility.id || (f.code && f.code.toUpperCase() === (facility.code || '').toUpperCase())
        )
        if (!persisted) throw new Error('Không tìm thấy cơ sở trên hệ thống. Vui lòng tải lại trang.')
        const published = await publishBusinessFacilityApi(persisted.id)
        updateFacility(facility.id, { status: published.status }, user)
      } else {
        updateFacility(facility.id, { status: 'active' }, user)
      }
      showToast(
        lang === "vi"
          ? `Đã công bố cơ sở "${facility.name}" thành công! Cơ sở đã sẵn sàng hiển thị trên Cổng khách hàng.`
          : `Facility "${facility.name}" published successfully!`
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể công bố cơ sở.')
    }
  }

  const handleDeleteFacility = async () => {
    if (!selectedFacility) return
    setDeleteFacilityBusy(true)
    setDeleteFacilityError(null)

    if (isApiAuthenticated()) {
      try {
        const persisted = (await listAllFacilitiesApi()).find(
          f => f.id === selectedFacility.id || (f.code && f.code.toUpperCase() === (selectedFacility.code || '').toUpperCase())
        )
        if (persisted) {
          await deleteBusinessFacilityApi(persisted.id)
        }
        deleteFacility(selectedFacility.id, user, true)
        setDeleteFacilityModal(false)
        showToast(
          lang === "vi"
            ? `Đã xóa cơ sở "${selectedFacility.name}" thành công.`
            : `Facility "${selectedFacility.name}" deleted.`
        )
        // Đồng bộ lại danh mục
        try {
          const backendFacs = await listAllFacilitiesApi()
          if (Array.isArray(backendFacs)) {
            const backendIds = new Set(backendFacs.map(bf => bf.id))
            const backendCodes = new Set(backendFacs.map(bf => (bf.code || '').trim().toUpperCase()))
            facilitiesList.forEach(f => {
              const code = (f.code || '').trim().toUpperCase()
              if (!backendIds.has(f.id) && !backendCodes.has(code)) {
                deleteFacility(f.id, user, true)
              }
            })
          }
        } catch {}
      } catch (error) {
        setDeleteFacilityError(error instanceof Error ? error.message : 'Không thể xóa cơ sở.')
      } finally {
        setDeleteFacilityBusy(false)
      }
      return
    }

    const result = deleteFacility(selectedFacility.id, user, true)

    if (!result.success) {
      setDeleteFacilityError(
        lang === "vi"
          ? result.reason || "Không thể xóa cơ sở!"
          : result.reason || "Cannot delete facility!",
      )
      setDeleteFacilityBusy(false)
      return
    }

    setDeleteFacilityModal(false)
    setDeleteFacilityBusy(false)

    showToast(
      lang === "vi"
        ? `Đã xóa cơ sở "${selectedFacility.name}"!`
        : `Facility deleted!`,
    )
  }

  // Danh sách cơ sở sau khi lọc & tìm kiếm

  const filteredFacilities = useMemo(() => {
    return facilitiesList.filter((f) => {
      if (facFilterCity !== "All" && f.city !== facFilterCity) return false

      if (facFilterStatus !== "All" && f.status !== facFilterStatus)
        return false

      if (facSearch.trim()) {
        const q = facSearch.toLowerCase()

        const code = (f.code || f.id || "").toLowerCase()

        const name = (f.name || "").toLowerCase()

        const addr = (f.address || "").toLowerCase()

        const mgr = (f.manager || "").toLowerCase()

        const city = (f.city || "").toLowerCase()

        return (
          code.includes(q) ||
          name.includes(q) ||
          addr.includes(q) ||
          mgr.includes(q) ||
          city.includes(q)
        )
      }

      return true
    })
  }, [facilitiesList, facFilterCity, facFilterStatus, facSearch])

  // Danh sách các thành phố duy nhất trong hệ thống cơ sở

  const availableCities = useMemo(() => {
    const set = new Set<string>()

    facilitiesList.forEach((f) => {
      if (f.city) set.add(f.city)
    })

    return Array.from(set)
  }, [facilitiesList])

  const totalRevenue = facilitiesList.reduce(
    (s, f) => s + getFacilityActualRevenue(f),
    0,
  )

  const totalUnits = facilitiesList.reduce((sum, facility) => sum + getFacilityTotalUnits(facility), 0)

  const totalOccupied = facilitiesList.reduce((sum, facility) => sum + getFacilityOccupiedCount(facility), 0)

  return (
    <Layout
      user={user}
      notifications={businessNotifications.map(item => ({ id: item.id, title: item.title, message: item.content, date: item.createdAt, isRead: item.isRead, page: item.type === 'SYSTEM' ? 'pricing' : 'facilities' }))}
      onNotificationClick={item => {
        const notification = businessNotifications.find(n => n.id === item.id)
        if (notification) {
          if (notification.title === 'Yêu cầu duyệt thay đổi loại kho' && notification.relatedEntityId) {
            setPage('facilities')
            setReviewRequestId(notification.relatedEntityId)
            setReviewOpen(true)
          } else if (notification.title === 'Manager cập nhật ảnh hoặc thông tin loại kho' || notification.title === 'Loại kho cần BO duyệt lại') {
            setPage('facilities')
            setReviewRequestId(null)
            setReviewOpen(true)
          } else {
            setPage(item.page || 'facilities')
          }
          void markNotificationRead(item.id).then(saved => setBusinessNotifications(current => current.map(n => n.id === saved.id ? saved : n))).catch(() => {})
          return
        }
        if (item.page) {
          setPage(item.page)
        }
      }}
      navItems={NAV}
      currentPage={page}
      onNavigate={next => { if (!integrationLocked) setPage(next) }}
      onLogout={() => { if (!integrationLocked) onLogout() }}
      canAccess={(permission) => {
        if (isApiAuthenticated()) return canApiActor(user, permission)
        if (user.role === 'business' || user.role === 'admin') return true
        return hub?.can ? hub.can(user, permission) : true
      }}
      roleLabel={"Giám Đốc Thương Mại"}
      roleColor="bg-amber-100 text-amber-700"
    >
      {page === "rental-source-policies" && <DuongPolicyWorkspace user={user} onLocked={setIntegrationLocked} />}
      {page === "returns" && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={lang === "vi" ? "Hồ Sơ Trả Kho & Quyết Toán" : "Return & Settlement Management"}
            subtitle={
              lang === "vi"
                ? "Theo dõi, giám sát và thẩm định hồ sơ nghiệm thu trả kho toàn hệ thống"
                : "Monitor, supervise, and resolve warehouse return cases and deposit settlements across all facilities"
            }
          />
          <BusinessRefundRequestsPanel />
          <BusinessReturnsPanel user={user} />
        </div>
      )}
      {/* ── QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ──────────────────── */}
      {page === "facilities" && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={lang === "vi" ? "Quản Lý Cơ Sở" : "Facility Management"}
            subtitle={
              lang === "vi"
                ? `${facilitiesList.length} cơ sở trong hệ thống - Thêm, sửa, xóa và theo dõi vận hành`
                : `${facilitiesList.length} ${facilitiesList.length === 1 ? "facility" : "facilities"
                } in the portfolio`
            }
            action={
              <Button
                variant="primary"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm flex items-center gap-1.5"
                onClick={handleOpenCreateFacility}
              >
                {Icon.plus}{" "}
                {lang === "vi" ? "Thêm Cơ Sở Mới" : "Add New Facility"}
              </Button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              title={lang === "vi" ? "Tổng số cơ sở" : "Total Locations"}
              value={facilitiesList.length}
              icon={Icon.building}
              iconBg="bg-blue-50"
            />
            <StatCard
              title={lang === "vi" ? "Tổng số gian kho" : "Total Units"}
              value={totalUnits}
              icon={Icon.box}
              iconBg="bg-purple-50"
            />
          </div>
          {/* Thanh Công Cụ: Tìm kiếm & Lọc Đa Tiêu Chí */}
          {facilityDataError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{facilityDataError}</p>}
          <Card className="p-4 border border-stone-200/90 shadow-sm bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === "vi" ? "Tìm kiếm cơ sở" : "Search Facility"}
                </label>
                <Input
                  placeholder={
                    lang === "vi"
                      ? "Nhập mã cơ sở (VD: HN-F01, HCM-Q1), tên kho, địa chỉ, người quản lý..."
                      : "Search code, name, address, manager..."
                  }
                  value={facSearch}
                  onChange={(e) => setFacSearch(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === "vi" ? "Tỉnh / Thành phố" : "City / Province"}
                </label>
                <Select
                  value={facFilterCity}
                  onChange={(e) => setFacFilterCity(e.target.value)}
                >
                  <option value="All">
                    {lang === "vi"
                      ? `Tất cả thành phố (${availableCities.length})`
                      : "All Cities"}
                  </option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === "vi" ? "Trạng thái hoạt động" : "Status"}
                </label>
                <Select
                  value={facFilterStatus}
                  onChange={(e) => setFacFilterStatus(e.target.value)}
                >
                  <option value="All">
                    {lang === "vi" ? "Tất cả trạng thái" : "All Statuses"}
                  </option>
                  <option value="active">
                    {lang === "vi" ? "Đang hoạt động" : "Active"}
                  </option>
                  <option value="maintenance">
                    {lang === "vi" ? "Bảo trì" : "Maintenance"}
                  </option>
                </Select>
              </div>
            </div>

            {(facSearch ||
              facFilterCity !== "All" ||
              facFilterStatus !== "All") && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Đang lọc thấy <b>{filteredFacilities.length}</b> /{" "}
                    {facilitiesList.length} cơ sở kho trong hệ thống
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFacSearch("")

                      setFacFilterCity("All")

                      setFacFilterStatus("All")
                    }}
                    className="text-amber-700 hover:text-amber-900 font-medium underline cursor-pointer"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              )}
          </Card>

          {/* Danh Sách Thẻ Cơ Sở */}
          {filteredFacilities.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2 border-stone-300">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-xl">
                  {Icon.building}
                </div>
                <h4 className="font-bold text-slate-800 text-base">
                  {lang === "vi"
                    ? "Không tìm thấy cơ sở phù hợp"
                    : "No matching facility found"}
                </h4>
                <p className="text-xs text-slate-500">
                  {lang === "vi"
                    ? "Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc bấm Thêm Cơ Sở Mới để mở rộng mạng lưới cơ sở lưu trữ tại địa điểm mới."
                    : "Try adjusting filters or create a new facility location."}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreateFacility}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  + {lang === "vi" ? "Thêm Cơ Sở Mới Ngay" : "Add New Facility"}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFacilities.map((f) => {
                const cleanF = sanitizeFacilityStrings(f)
                const facCode = cleanF.code || cleanF.id

                const totalUnitsInFac = getFacilityTotalUnits(cleanF)
                const occupiedInFac = getFacilityOccupiedCount(cleanF)
                const occupancyRate = totalUnitsInFac
                  ? Math.round((occupiedInFac / totalUnitsInFac) * 100)
                  : 0

                return (
                  <Card
                    key={cleanF.id}
                    className="p-5 hover:border-amber-400/70 transition-all border border-stone-200/90 shadow-sm bg-white"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Hàng 1: Mã cơ sở + Tên + Badge trạng thái */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-100/80 text-amber-900 border border-amber-300">
                            {facCode}
                          </span>
                          <h3 className="font-bold text-slate-900 text-lg leading-snug">
                            {cleanF.name}
                          </h3>
                          <Badge
                            variant={
                              cleanF.status === "active" ? "success" : "warning"
                            }
                          >
                            {cleanF.status === "active"
                              ? lang === "vi"
                                ? "Đang hoạt động"
                                : "Active"
                              : lang === "vi"
                                ? "Bảo trì"
                                : "Maintenance"}
                          </Badge>
                        </div>

                        {/* Thông tin cơ sở */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs text-slate-600">
                          <div>{cleanF.address} · <b>{cleanF.city}</b></div>
                          <div>Quản lý: <b>{cleanF.manager}</b></div>
                          <div>Hotline: <b>{cleanF.phone || "Chưa cập nhật"}</b></div>
                          <div>Khung giờ mở cửa: <b>{cleanF.accessHours || (isApiAuthenticated() ? "Chưa cập nhật" : "08:00 - 17:00")}</b></div>
                        </div>
                        {/* Cơ cấu gian kho */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {(["S", "M", "L", "XL"] as const).map(size => {
                            const count = cleanF.unitDistribution?.[size] ?? unitsList.filter(u =>
                              (u.facilityId === f.id || u.facilityId === f.code) &&
                              ((u as any).sizeCode || (u as any).size || ({ Small: "S", Medium: "M", Large: "L", "Extra Large": "XL" } as Record<string, string>)[String(u.type)]) === size
                            ).length
                            return count > 0 ? <span key={size} className="rounded border border-stone-200 bg-stone-50 px-2 py-1">{size}: {count} kho</span> : null
                          })}
                        </div>

                        {/* Hàng 2.8: Gói thuê đang áp dụng */}
                        {(() => {
                          const activePackagesForFac = durationDiscounts.filter((p) => {
                            if (p.status !== "active") return false
                            if (p.scopeType === "all") return true
                            if (Array.isArray(p.facilityIds) && p.facilityIds.length > 0) {
                              return p.facilityIds.includes(f.id) || (f.code && p.facilityIds.includes(f.code))
                            }
                            return true
                          })

                          return (
                            <div className="flex items-center justify-between pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setPage("policies")
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition cursor-pointer"
                                title={lang === "vi" ? "Xem và quản lý các gói thuê của cơ sở này" : "View and manage packages for this facility"}
                              >
                                <span>
                                  {lang === "vi"
                                    ? `${activePackagesForFac.length} gói thuê áp dụng`
                                    : `${activePackagesForFac.length} rental packages`}
                                </span>
                                <span className="text-emerald-700 text-[11px] font-bold">→</span>
                              </button>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Các nút hành động */}
                      <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        {cleanF.status === "setup" && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full justify-center text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            onClick={() => void handlePublishFacility(cleanF)}
                            title={lang === "vi" ? "Công bố cơ sở này lên Cổng khách hàng" : "Publish facility to customer portal"}
                          >
                            🚀 {lang === "vi" ? "Công bố cơ sở" : "Publish"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold"
                          onClick={() => void handleOpenFacilityDetails(cleanF)}
                        >
                          {lang === "vi" ? "Chi tiết" : "Details"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold border-amber-300 text-amber-800 hover:bg-amber-50"
                          onClick={() => handleOpenEditFacility(cleanF)}
                        >
                          {lang === "vi" ? "Chỉnh sửa" : "Edit"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                          onClick={() => {
                            setSelectedFacility(cleanF)
                            setDeleteFacilityError(null)
                            setDeleteFacilityBusy(false)
                            setDeleteFacilityModal(true)
                          }}
                        >
                          {lang === "vi" ? (cleanF.status === "inactive" ? "Quản lý / Xóa" : "Xóa / Ngừng HĐ") : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── QUY ĐỊNH CHO THUÊ KHO STORAGEHUB ─────────────────── */}
      {page === "rental-regulations" && (
        <BusinessRentalRegulationsPanel user={user} lang={lang} />
      )}

      {/* ── RENTAL POLICIES & PACKAGES ───────────────────────── */}
      {page === "policies" && (
        <div className="fade-in space-y-6">
          <SectionHeader
            title={
              lang === "vi"
                ? "Gói Thuê & Chiết Khấu"
                : "Rental Packages & Discounts"
            }
            subtitle={
              lang === "vi"
                ? "Cấu hình kỳ hạn thuê (1M, 3M, 6M, 12M) và tỷ lệ giảm giá (%) tự động áp dụng khi khách hàng đặt kho mới hoặc gia hạn hợp đồng"
                : "Configure rental duration tiers and automated discount rates for bookings and renewals"
            }
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateDuration}
                className="flex items-center gap-1.5 shadow-sm"
              >
                {Icon.plus} {lang === "vi" ? "Thêm Gói Thuê Mới" : "Add Rental Package"}
              </Button>
            }
          />

          {/* ── KHỐI 1: GÓI THUÊ & MỨC GIẢM GIÁ THEO KỲ HẠN ── */}
          <Card className="p-5 border border-stone-200/90 shadow-sm bg-white">
            <div className="border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  {lang === "vi" ? "Danh Sách Gói Thuê & Mức Chiết Khấu" : "Rental Packages & Discount Schedule"}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tỷ lệ giảm giá (%) được tự động áp dụng vào đơn giá khi khách hàng đặt kho hoặc gia hạn theo các mốc thời gian dưới đây.
              </p>
            </div>

            {/* Cards Tóm Tắt Nhanh Các Gói */}
            <div className="mt-4 flex flex-wrap gap-4">
              <label className="text-sm font-medium text-stone-700">Trạng thái
                <select className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2" value={packageStatusFilter} onChange={e => setPackageStatusFilter(e.target.value)}>
                  <option value="all">Tất cả</option><option value="active">Đang áp dụng</option><option value="inactive">Tạm dừng</option>
                </select>
              </label>
              <label className="text-sm font-medium text-stone-700">Sắp xếp
                <select className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2" value={packageSort} onChange={e => setPackageSort(e.target.value)}>
                  <option value="months-asc">Kỳ hạn tăng dần</option><option value="months-desc">Kỳ hạn giảm dần</option>
                  <option value="discount-desc">Mức giảm cao nhất</option><option value="discount-asc">Mức giảm thấp nhất</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 my-4">
              {[...durationDiscounts].filter(item => packageStatusFilter === 'all' ||
                (packageStatusFilter === 'active' ? item.status === 'active' : item.status !== 'active')).length === 0 ? (
                <div className="col-span-full py-8 text-center text-sm text-stone-500">
                  {lang === "vi" ? "Chưa có gói thuê nào được cấu hình (0 gói)." : "No rental packages configured."}
                </div>
              ) : (
                [...durationDiscounts].filter(item => packageStatusFilter === 'all' ||
                  (packageStatusFilter === 'active' ? item.status === 'active' : item.status !== 'active'))
                  .sort((a, b) => {
                    const monthsA = a.months === 'other' ? Number.MAX_SAFE_INTEGER : Number(a.months)
                    const monthsB = b.months === 'other' ? Number.MAX_SAFE_INTEGER : Number(b.months)
                    const primary = packageSort === 'discount-desc' ? b.discountPercent - a.discountPercent
                      : packageSort === 'discount-asc' ? a.discountPercent - b.discountPercent
                      : packageSort === 'months-desc' ? monthsB - monthsA : monthsA - monthsB
                    return primary || Number(b.status === 'active') - Number(a.status === 'active') || a.label.localeCompare(b.label, 'vi') || a.id.localeCompare(b.id)
                  }).map((item) => {
                const isActive = item.status === "active"
                const hasDiscount = item.discountPercent > 0
                const hasRenewal = item.renewalDiscountPercent > 0
                const isSpecific = item.scopeType === "specific"
                const facCount = item.facilityIds?.length || 0

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isActive
                        ? hasDiscount || hasRenewal
                          ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 shadow-2xs"
                          : "border-stone-200 bg-stone-50/70"
                        : "border-stone-200 bg-stone-100/80 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="font-bold text-slate-900 text-sm truncate" title={item.title}>
                          {item.label}
                        </span>
                        <div className="flex flex-col items-end gap-0.5">
                          <Badge
                            variant={
                              item.runtimeStatus === 'ACTIVE'
                                ? "success"
                                : item.runtimeStatus === 'SCHEDULED'
                                  ? "info"
                                  : item.runtimeStatus === 'EXPIRED'
                                    ? "error"
                                    : item.runtimeStatus === 'INACTIVE'
                                      ? "warning"
                                      : "muted"
                            }
                          >
                            {item.runtimeStatus === 'ACTIVE'
                              ? "Đang hiệu lực"
                              : item.runtimeStatus === 'SCHEDULED'
                                ? "Lên lịch"
                                : item.runtimeStatus === 'EXPIRED'
                                  ? "Hết hạn"
                                  : item.runtimeStatus === 'INACTIVE'
                                    ? "Tạm dừng"
                                    : "Bản nháp"}
                          </Badge>
                          <span className="text-[9px] text-stone-400 font-mono">
                            [{item.publicationStatus || (isActive ? 'PUBLISHED' : 'INACTIVE')}]
                          </span>
                        </div>
                      </div>

                      {/* Huy hiệu phạm vi cơ sở áp dụng */}
                      <div className="mb-2">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isSpecific
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isSpecific ? `${facCount} cơ sở` : "Toàn hệ thống"}
                        </span>
                      </div>

                      {/* Phân tách rõ ràng: Đặt mới vs Gia hạn */}
                      <div className="space-y-1.5 py-2 px-2.5 rounded-lg bg-white/80 border border-stone-200/70 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-600 font-medium">Đặt mới:</span>
                          <span className={`font-mono font-bold ${hasDiscount ? "text-emerald-700" : "text-slate-500"}`}>
                            {hasDiscount ? `-${item.discountPercent}%` : "0% (Niêm yết)"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-1.5">
                          <span className="text-[11px] text-slate-600 font-medium">Gia hạn:</span>
                          <span className={`font-mono font-bold ${hasRenewal ? "text-blue-700" : "text-slate-500"}`}>
                            {hasRenewal ? `-${item.renewalDiscountPercent}%` : "0% (Không giảm)"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-1.5">
                          <span className="text-[11px] text-slate-600 font-medium">Cọc giữ chỗ:</span>
                          <span className="font-mono font-bold text-amber-800">
                            {item.depositPercent ?? 20}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-1.5">
                          <span className="text-[11px] text-slate-600 font-medium">Setup miễn phí:</span>
                          <span className="font-mono font-bold text-blue-800">
                            {item.freeSetupDays == null ? 'Theo kỳ hạn' : `${item.freeSetupDays} ngày`}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                        {item.description.replace(/\s*·?\s*phiên bản\s+[^·\n]+/gi, '').trim()}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[80px]" title={item.appliesTo}>
                        {item.appliesTo}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.publicationStatus === 'PUBLISHED' ? (
                          <button
                            type="button"
                            onClick={() => handleInactiveDurationDiscount(item)}
                            title="Chuyển về INACTIVE để có thể chỉnh sửa"
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                          >
                            Tạm dừng
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePublishDurationDiscount(item)}
                            title="Xuất bản chính sách này"
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                          >
                            Xuất bản
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditDuration(item)}
                          disabled={item.publicationStatus === 'PUBLISHED'}
                          title={item.publicationStatus === 'PUBLISHED' ? "Chính sách đang PUBLISHED. Vui lòng bấm [Tạm dừng] trước khi sửa!" : "Chỉnh sửa gói thuê"}
                          className={`text-[11px] font-bold underline ${
                            item.publicationStatus === 'PUBLISHED'
                              ? "opacity-40 cursor-not-allowed text-stone-400"
                              : "text-blue-700 hover:text-blue-900 cursor-pointer"
                          }`}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDurationDiscount(item.id)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-800 underline cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }))}
            </div>
          </Card>
        </div>
      )}

      {/* ── PRICING & FEES ────────────────────────────────────── */}
      {page === "pricing" && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={
              lang === "vi" ? "Bảng Giá Niêm Yết & Biểu Phí" : "Pricing & Fees"
            }
            subtitle={
              lang === "vi"
                ? "Quản lý các phân tầng giá theo kích thước và biểu phí dịch vụ phát sinh"
                : "Manage unit pricing tiers and fee schedules"
            }
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  {lang === "vi" ? "Cơ sở áp dụng:" : "Facility:"}
                </span>
                <div className="w-56 sm:w-64">
                  <Select
                    value={pricingFacilityFilter}
                    onChange={(e) => setPricingFacilityFilter(e.target.value)}
                  >
                    <option value="all">
                      {lang === "vi"
                        ? "Toàn bộ cơ sở"
                        : "All Facilities"}
                    </option>
                    {facilitiesList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.code || f.id})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            }
          />

          {selectedPricingFacility && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-mono text-[11px] border border-amber-300">
                  {selectedPricingFacility.code || selectedPricingFacility.id}
                </span>
                <span className="font-semibold text-slate-900 text-sm">
                  {selectedPricingFacility.name}
                </span>
                <span className="text-slate-500">
                  · {selectedPricingFacility.address} ({selectedPricingFacility.city})
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-slate-600">
                  Quy mô: <b>{selectedPricingFacility.units} gian kho</b>
                </span>
                <span className="text-slate-600">
                  Cước cơ sở từ:{" "}
                  <b className="text-emerald-700">
                    {backendFacilityStats[(selectedPricingFacility.code || '').toUpperCase()]?.price != null
                      ? `${formatVndAmount(backendFacilityStats[(selectedPricingFacility.code || '').toUpperCase()].price!)}/tháng`
                      : 'Chưa cấu hình'}
                  </b>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenFacilityPriceModal(selectedPricingFacility)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-2xs cursor-pointer flex items-center gap-1.5"
                >

                  <span>Chỉnh biểu giá cơ sở</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPricingFacilityFilter("all")}
                  className="text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer"
                >
                  {lang === "vi" ? "Xem toàn bộ cơ sở" : "View all facilities"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {pricingCatalogError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{pricingCatalogError}</p>}
            {pricingCatalogLoading && <p role="status" className="p-4 text-sm text-stone-600">Đang tải bảng giá cơ sở...</p>}
            {(selectedPricingFacility ? [selectedPricingFacility] : facilitiesList).map(fac => {
              const types = pricingCatalogByCode[(fac.code || '').toUpperCase()] || []
              return <Card key={fac.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 p-4">
                  <div><b>{fac.name}</b><p className="mt-1 text-xs text-stone-500">{fac.code} · {fac.address}</p></div>
                  <Button variant="outline" onClick={() => void handleOpenFacilityPriceModal(fac)}>Chỉnh giá cơ sở này</Button>
                </div>
                {!pricingCatalogLoading && !pricingCatalogError && types.length === 0 && <p className="p-5 text-sm text-stone-500">Chưa có loại kho thực tế để cấu hình giá.</p>}
                {types.length > 0 && <Table><Thead><tr><Th>Loại kho</Th><Th>Kích thước (D × R × C)</Th><Th>Số gian</Th><Th>Giá thuê / tháng</Th><Th>Tiền cọc đảm bảo kho</Th></tr></Thead>
                  <Tbody>{types.map(type => <Tr key={type.id}>
                    <Td><b>{type.code}</b> · {type.name}</Td>
                    <Td>{type.lengthM} × {type.widthM} × {type.heightM} m</Td>
                    <Td>{type.totalCount ?? 0}</Td>
                    <Td>{type.monthlyPrice > 0 ? formatVndAmount(type.monthlyPrice) : 'Chưa cấu hình'}</Td>
                    <Td>{type.monthlyPrice > 0 ? formatVndAmount(type.securityDepositAmount) : 'Chưa cấu hình'}</Td>
                  </Tr>)}</Tbody></Table>}
              </Card>
            })}
          </div>
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4">
              {lang === "vi" ? "Biểu Phí Dịch Vụ Quy Định" : "Fee Schedule"}
            </h3>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === "vi" ? "Loại Phí" : "Fee Type"}</Th>
                  <Th>{lang === "vi" ? "Mức Phí" : "Amount"}</Th>
                  <Th>{lang === "vi" ? "Điều Kiện Áp Dụng" : "Trigger"}</Th>
                  <Th>{lang === "vi" ? "Đối Tượng" : "Applies To"}</Th>
                </tr>
              </Thead>
              <Tbody>
                {visibleRuntimeFees.length === 0 ? (
                  <Tr>
                    <Td colSpan={4} className="text-center py-6 text-slate-400">
                      {lang === "vi" ? "Chưa có biểu phí dịch vụ phát sinh ngoài giá thuê & cọc." : "No fee schedule configured."}
                    </Td>
                  </Tr>
                ) : (
                  visibleRuntimeFees.map((f) => (
                    <Tr key={f.type}>
                      <Td className="font-medium text-slate-900">
                        {getFeeType(f.type, lang)}
                      </Td>
                      <Td className="font-semibold text-emerald-700 font-mono">
                        {f.amount}
                      </Td>
                      <Td className="text-slate-600">
                        {getFeeTrigger(f.trigger, lang)}
                      </Td>
                      <Td>
                        <Badge variant="muted">
                          {getFeeApplies(f.applies, lang)}
                        </Badge>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}


      {/* ── DAMAGE INCIDENTS (NHÓM 3) ── */}
      {page === "damage-incidents" && (
        <BusinessDamageIncidentsPanel
          user={user}
          lang={lang}
          facilitiesList={facilitiesList}
        />
      )}


      {/* ── PROFILE PAGE ─────────────────────────────────────── */}
      {page === "profile" && (
        <div className="fade-in">
          <ProfileView user={user} />
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}
      <Modal
        open={pricingModal}
        onClose={() => setPricingModal(false)}
        title={
          selectedPricingFacility
            ? (lang === "vi" ? `Chỉnh Sửa Biểu Giá: ${selectedPricingFacility.name}` : `Edit Facility Pricing: ${selectedPricingFacility.name}`)
            : (lang === "vi" ? "Chỉnh Sửa Bảng Giá Cơ Sở Toàn Hệ Thống (Global Base Pricing)" : "Edit Global Base Pricing Tier")
        }
      >
        {selectedTier && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                {lang === "vi" ? "Đang chỉnh sửa:" : "Editing:"}{" "}
                <strong className="text-slate-900">{selectedTier.name}</strong>
              </p>
              <div className={`p-3 rounded-xl border text-xs mt-2 ${selectedPricingFacility ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-amber-50 text-amber-950 border-amber-200'}`}>
                <p className="font-bold flex items-center gap-1.5">

                  <span>
                    {selectedPricingFacility
                      ? `Cơ sở áp dụng: ${selectedPricingFacility.name} (${selectedPricingFacility.code || selectedPricingFacility.id})`
                      : "Phạm vi: Bảng giá cơ sở toàn hệ thống (Global Pricing)"}
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  {selectedPricingFacility
                    ? `Giá này sẽ chỉ áp dụng riêng cho cơ sở ${selectedPricingFacility.name}, không ảnh hưởng đến các cơ sở khác.`
                    : "Lưu ý: Mức giá cơ sở này áp dụng chung cho toàn hệ thống đối với các cơ sở không có cấu hình giá riêng."}
                </p>
              </div>
            </div>
            <Input
              label={
                lang === "vi" ? "Giá cơ sở (VNĐ/tháng)" : "Base Price (VND/mo)"
              }
              type="text"
              inputMode="numeric"
              value={formTierBasePrice ? (parseInt(String(formTierBasePrice).replace(/\D/g, ''), 10) || 0).toLocaleString('vi-VN') : ''}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                setFormTierBasePrice(n ? n.toLocaleString('vi-VN') : '')
              }}
              placeholder="VD: 5.000.000"
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setPricingModal(false)}>
                {lang === "vi" ? "Hủy" : "Cancel"}
              </Button>
              <Button variant="primary" onClick={handleSavePricingTier}>
                {lang === "vi" ? "Lưu bảng giá" : "Save Pricing"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: CHỈNH SỬA TOÀN BỘ BIỂU GIÁ CƠ SỞ ── */}
      <Modal
        open={facilityPriceModalOpen}
        onClose={() => setFacilityPriceModalOpen(false)}
        size="2xl"
        title={
          editingPriceFacility
            ? `Chỉnh Sửa Biểu Giá: ${editingPriceFacility.name} (${editingPriceFacility.code || editingPriceFacility.id})`
            : "Chỉnh Sửa Biểu Giá Cơ Sở"
        }
      >
        {editingPriceFacility && (
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-sm text-slate-900 block">
                  {editingPriceFacility.name}
                </span>
                <span className="text-slate-600">
                   {editingPriceFacility.address} · {editingPriceFacility.city}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                Quy mô: {editingPriceFacility.units} gian kho
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Thiết lập đơn giá cước thuê theo tháng cho từng loại kho tại cơ sở này. Đơn giá sẽ tự động được áp dụng vào các gói thuê (3, 6, 12, 24 tháng) theo tỷ lệ chiết khấu của hệ thống.
            </p>

            {isApiAuthenticated() ? (
              <div className="space-y-3">
                {backendPricingLoading && <p className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">Đang tải danh sách loại kho Manager đã khai báo...</p>}
                {!backendPricingLoading && backendPricingUnitTypes.length === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Manager chưa khai báo loại kho thực tế. BO chỉ có thể định giá sau khi danh sách này tồn tại.</p>}
                {!backendPricingLoading && backendPricingUnitTypes.map(unitType => {
                  const value = backendPricingValues[unitType.id] || { monthlyPrice: 0, securityDepositAmount: 0 }
                  return <div key={unitType.id} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-2xs sm:grid-cols-[1fr_190px_190px] sm:items-end">
                    <div>
                      <div className="flex items-center gap-2"><span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">{unitType.code}</span><b className="text-sm text-slate-900">{unitType.name}</b></div>
                      <p className="mt-2 text-xs text-slate-500">{unitType.lengthM} × {unitType.widthM} × {unitType.heightM} m · tải tối đa {unitType.maxLoadKg.toLocaleString('vi-VN')} kg · {unitType.availableCount ?? 0} gian khả dụng</p>
                    </div>
                    <label className="text-[11px] font-semibold text-slate-700">Giá thuê (VNĐ/tháng)
                      <div className="relative mt-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={value.monthlyPrice > 0 ? value.monthlyPrice.toLocaleString('vi-VN') : ''}
                          placeholder="0"
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '')
                            const num = raw ? parseInt(raw, 10) : 0
                            setBackendPricingValues(prev => ({ ...prev, [unitType.id]: { ...value, monthlyPrice: num } }))
                          }}
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-2 pr-7 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-400">
                          ₫
                        </span>
                      </div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-700">Tiền cọc đảm bảo kho (VNĐ)
                      <div className="relative mt-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={value.securityDepositAmount > 0 ? value.securityDepositAmount.toLocaleString('vi-VN') : ''}
                          placeholder="0"
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '')
                            const num = raw ? parseInt(raw, 10) : 0
                            setBackendPricingValues(prev => ({ ...prev, [unitType.id]: { ...value, securityDepositAmount: num } }))
                          }}
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-2 pr-7 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-400">
                          ₫
                        </span>
                      </div>
                    </label>
                  </div>
                })}
              </div>
            ) : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(['S', 'M', 'L', 'XL'] as const).map((sz) => {
                const spec = UNIT_SPECS[sz]
                const val = facilityPricesForm[sz]

                return (
                  <div key={sz} className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${sz === 'S' ? 'bg-blue-100 text-blue-900' :
                            sz === 'M' ? 'bg-green-100 text-green-900' :
                              sz === 'L' ? 'bg-purple-100 text-purple-900' :
                                'bg-amber-100 text-amber-900'
                          }`}>
                          {sz}
                        </span>
                        <div>
                          <p className="font-bold text-xs text-slate-900">{spec.name}</p>
                          <p className="text-[10px] text-slate-400">{spec.dimensions} · {spec.volumeM3} m³</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        Tải: {spec.maxLoadKg.toLocaleString()}kg
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        Đơn giá niêm yết (VNĐ/tháng)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={val ? val.toLocaleString('vi-VN') : ''}
                        onChange={(e) => {
                          const n = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                          setFacilityPricesForm((prev) => ({ ...prev, [sz]: n }))
                        }}
                        className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="VD: 5.500.000"
                      />
                      <p className="text-[10px] text-emerald-700 font-mono text-right">
                        = {formatCurrency(val)}/tháng
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Ước tính gói 3T (-3%):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatCurrency(Math.round(val * 0.97))}/th
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              {!isApiAuthenticated() && <Button
                variant="ghost"
                size="sm"
                className="text-stone-500 hover:text-red-700"
                onClick={handleResetFacilityPrices}
              >
                Khôi phục giá chuẩn hệ thống
              </Button>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setFacilityPriceModalOpen(false)}>
                  Hủy
                </Button>
                <Button variant="primary" onClick={handleSaveFacilityPrices}>
                  Lưu Biểu Giá Cơ Sở
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>


      {/* ── MODAL: CHỈNH SỬA CHÍNH SÁCH ─────────────────────── */}
      <Modal
        open={policyModal}
        onClose={() => { if (!policyCatalogBusy) setPolicyModal(false) }}
        title={
          lang === "vi" ? "Chỉnh Sửa Chính Sách Thương Mại" : "Edit Policy"
        }
      >
        {selectedPolicy && (
          <div className="space-y-4">
            {policyCatalogError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{policyCatalogError}</p>}
            <Input
              label={lang === "vi" ? "Tên chính sách" : "Policy Name"}
              value={policyFormName}
              onChange={(e) => setPolicyFormName(e.target.value)}
            />

            <Input
              label={lang === "vi" ? "Giá trị hiện hành" : "Current Value"}
              value={policyFormValue}
              onChange={(e) => setPolicyFormValue(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-800 block">
                {lang === "vi" ? "Nhóm chính sách" : "Policy Category"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "billing", label: lang === "vi" ? "Thuê & Đặt cọc" : "Billing & Deposit" },
                  { id: "maintenance", label: lang === "vi" ? "Sự cố & Di dời kho" : "Facility SLA & Relocation" },
                ].map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                      policyFormCategory === cat.id
                        ? "border-amber-500 bg-amber-50/70 font-semibold text-slate-900 ring-1 ring-amber-500 shadow-2xs"
                        : "border-stone-200 bg-white hover:bg-stone-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="editPolicyCategoryRadio"
                      checked={policyFormCategory === cat.id}
                      onChange={() => setPolicyFormCategory(cat.id as any)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800 block">
                {lang === "vi" ? "Phạm vi áp dụng chính sách" : "Policy Application Scope"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${policyFormScopeType === "all"
                      ? "border-amber-500 bg-amber-50/60 ring-1 ring-amber-500"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                >
                  <input
                    type="radio"
                    name="editPolicyScopeType"
                    checked={policyFormScopeType === "all"}
                    onChange={() => setPolicyFormScopeType("all")}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      {lang === "vi"
                        ? "Áp dụng chung cho tất cả cơ sở kho hiện có & tạo mới"
                        : "Apply universally across all current & future facilities"}
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${policyFormScopeType === "specific"
                      ? "border-amber-500 bg-amber-50/60 ring-1 ring-amber-500"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                >
                  <input
                    type="radio"
                    name="editPolicyScopeType"
                    checked={policyFormScopeType === "specific"}
                    onChange={() => setPolicyFormScopeType("specific")}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {lang === "vi" ? "Chỉ định cơ sở kho" : "Specific Facilities"}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      {lang === "vi"
                        ? "Chỉ áp dụng cho các cơ sở kho được tick chọn"
                        : "Apply only to designated facilities selected below"}
                    </span>
                  </div>
                </label>
              </div>

              {policyFormScopeType === "specific" && (
                <div className="mt-2.5 p-3 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {lang === "vi"
                        ? `Chọn cơ sở áp dụng (${policyFormFacilityIds.length}/${facilitiesList.length})`
                        : `Select Facilities (${policyFormFacilityIds.length}/${facilitiesList.length})`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPolicyFormFacilityIds(facilitiesList.map((f) => f.id))}
                        className="text-amber-800 hover:text-amber-950 font-medium underline cursor-pointer text-[11px]"
                      >
                        {lang === "vi" ? "Chọn tất cả" : "Select All"}
                      </button>
                      <span className="text-stone-300">|</span>
                      <button
                        type="button"
                        onClick={() => setPolicyFormFacilityIds([])}
                        className="text-stone-500 hover:text-stone-800 font-medium underline cursor-pointer text-[11px]"
                      >
                        {lang === "vi" ? "Bỏ chọn" : "Deselect All"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {facilitiesList.map((f) => {
                      const isChecked = policyFormFacilityIds.includes(f.id)
                      return (
                        <label
                          key={f.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${isChecked
                              ? "border-amber-300 bg-white shadow-2xs font-medium text-slate-900 ring-1 ring-amber-300"
                              : "border-stone-200 bg-white/70 text-slate-600 hover:bg-white"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPolicyFormFacilityIds([...policyFormFacilityIds, f.id])
                              } else {
                                setPolicyFormFacilityIds(policyFormFacilityIds.filter((id) => id !== f.id))
                              }
                            }}
                            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="min-w-0 flex-1 truncate">
                            <div className="font-semibold text-slate-900 truncate">{f.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {f.city} • Mã: {f.code || f.id}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {lang === "vi"
                  ? "Căn cứ / Ghi chú điều chỉnh"
                  : "Justification / Notes"}
              </label>
              <textarea
                rows={3}
                value={policyFormDesc}
                onChange={(e) => setPolicyFormDesc(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder={
                  lang === "vi"
                    ? "Lý do thay đổi chính sách..."
                    : "Reason for policy change..."
                }
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setPolicyModal(false)}>
                {lang === "vi" ? "Hủy" : "Cancel"}
              </Button>
              <Button variant="primary" disabled={policyCatalogBusy || (isApiAuthenticated() && !policyCatalogReady)} onClick={handleUpdatePolicy}>
                {lang === "vi" ? "Cập nhật chính sách" : "Update Policy"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: THÊM MỚI CHÍNH SÁCH ─────────────────────── */}
      <Modal
        open={createPolicyModal}
        onClose={() => setCreatePolicyModal(false)}
        title={
          lang === "vi" ? "Thêm Chính Sách Thuê Mới" : "Add New Rental Policy"
        }
      >
        <div className="space-y-4">
          <Input
            label={lang === "vi" ? "Tên chính sách" : "Policy Name"}
            placeholder={
              lang === "vi"
                ? "VD: Thời gian ân hạn thanh toán, Phí phạt trễ hạn, Tiền cọc an ninh..."
                : "E.g. Grace Period, Late Fee..."
            }
            value={policyFormName}
            onChange={(e) => setPolicyFormName(e.target.value)}
          />

          <Input
            label={lang === "vi" ? "Giá trị áp dụng" : "Current Value"}
            placeholder={
              lang === "vi"
                ? "VD: 3 ngày, 50% đơn giá ngày / ngày trễ, 1 tháng tiền thuê..."
                : "E.g. 3 days, 1 month..."
            }
            value={policyFormValue}
            onChange={(e) => setPolicyFormValue(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-800 block">
              {lang === "vi" ? "Nhóm chính sách" : "Policy Category"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: "billing", label: lang === "vi" ? "Thuê & Đặt cọc" : "Billing & Deposit" },
                { id: "maintenance", label: lang === "vi" ? "Sự cố & Di dời kho" : "Facility SLA & Relocation" },
              ].map((cat) => (
                <label
                  key={cat.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    policyFormCategory === cat.id
                      ? "border-amber-500 bg-amber-50/70 font-semibold text-slate-900 ring-1 ring-amber-500 shadow-2xs"
                      : "border-stone-200 bg-white hover:bg-stone-50 text-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="createPolicyCategoryRadio"
                    checked={policyFormCategory === cat.id}
                    onChange={() => setPolicyFormCategory(cat.id as any)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800 block">
              {lang === "vi" ? "Phạm vi áp dụng chính sách" : "Policy Application Scope"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${policyFormScopeType === "all"
                    ? "border-amber-500 bg-amber-50/60 ring-1 ring-amber-500"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
              >
                <input
                  type="radio"
                  name="createPolicyScopeType"
                  checked={policyFormScopeType === "all"}
                  onChange={() => setPolicyFormScopeType("all")}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"}
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    {lang === "vi"
                      ? "Áp dụng chung cho tất cả cơ sở kho hiện có & tạo mới"
                      : "Apply universally across all current & future facilities"}
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${policyFormScopeType === "specific"
                    ? "border-amber-500 bg-amber-50/60 ring-1 ring-amber-500"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
              >
                <input
                  type="radio"
                  name="createPolicyScopeType"
                  checked={policyFormScopeType === "specific"}
                  onChange={() => setPolicyFormScopeType("specific")}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {lang === "vi" ? "Chỉ định cơ sở kho" : "Specific Facilities"}
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    {lang === "vi"
                      ? "Chỉ áp dụng cho các cơ sở kho được tick chọn"
                      : "Apply only to designated facilities selected below"}
                  </span>
                </div>
              </label>
            </div>

            {policyFormScopeType === "specific" && (
              <div className="mt-2.5 p-3 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {lang === "vi"
                      ? `Chọn cơ sở áp dụng (${policyFormFacilityIds.length}/${facilitiesList.length})`
                      : `Select Facilities (${policyFormFacilityIds.length}/${facilitiesList.length})`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPolicyFormFacilityIds(facilitiesList.map((f) => f.id))}
                      className="text-amber-800 hover:text-amber-950 font-medium underline cursor-pointer text-[11px]"
                    >
                      {lang === "vi" ? "Chọn tất cả" : "Select All"}
                    </button>
                    <span className="text-stone-300">|</span>
                    <button
                      type="button"
                      onClick={() => setPolicyFormFacilityIds([])}
                      className="text-stone-500 hover:text-stone-800 font-medium underline cursor-pointer text-[11px]"
                    >
                      {lang === "vi" ? "Bỏ chọn" : "Deselect All"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {facilitiesList.map((f) => {
                    const isChecked = policyFormFacilityIds.includes(f.id)
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${isChecked
                            ? "border-amber-300 bg-white shadow-2xs font-medium text-slate-900 ring-1 ring-amber-300"
                            : "border-stone-200 bg-white/70 text-slate-600 hover:bg-white"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPolicyFormFacilityIds([...policyFormFacilityIds, f.id])
                            } else {
                              setPolicyFormFacilityIds(policyFormFacilityIds.filter((id) => id !== f.id))
                            }
                          }}
                          className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="min-w-0 flex-1 truncate">
                          <div className="font-semibold text-slate-900 truncate">{f.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {f.city} • Mã: {f.code || f.id}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              {lang === "vi"
                ? "Căn cứ / Ghi chú điều chỉnh"
                : "Justification / Notes"}
            </label>
            <textarea
              rows={3}
              value={policyFormDesc}
              onChange={(e) => setPolicyFormDesc(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder={
                lang === "vi"
                  ? "Ghi chú lý do, điều kiện áp dụng chính sách này..."
                  : "Reason for policy..."
              }
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setCreatePolicyModal(false)}
            >
              {lang === "vi" ? "Hủy" : "Cancel"}
            </Button>
            <Button variant="primary" disabled={policyCatalogBusy || (isApiAuthenticated() && !policyCatalogReady)} onClick={handleSaveNewPolicy}>
              {lang === "vi" ? "Lưu Chính Sách" : "Save Policy"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: THÊM GÓI THUÊ MỚI ── */}
      <Modal
        open={createDurationModal}
        onClose={() => setCreateDurationModal(false)}
        title={lang === "vi" ? "Thêm Gói Thuê Mới" : "Add New Rental Package"}
      >
        {packageFormError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{packageFormError}</p>}
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
            <p className="font-bold text-sm text-slate-900">
              {lang === "vi" ? "Thiết lập gói kỳ hạn mới" : "Set up new duration package"}
            </p>
            <p className="text-slate-600 leading-relaxed">
              {lang === "vi"
                ? "Gói thuê mới sẽ được hiển thị khi khách hàng chọn thời gian thuê kho hoặc gia hạn trên giao diện đặt kho."
                : "The new package will be available when customers choose rental or renewal duration."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={lang === "vi" ? "Tên gói thuê đầy đủ" : "Package Title"}
              placeholder="VD: Gói thuê 9 tháng"
              value={formCreateDurationTitle}
              onChange={(e) => setFormCreateDurationTitle(e.target.value)}
            />
            <Input
              label={lang === "vi" ? "Nhãn ngắn gọn (Hiển thị thẻ)" : "Short Label"}
              placeholder="VD: 9 tháng"
              value={formCreateDurationLabel}
              onChange={(e) => setFormCreateDurationLabel(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input
              label={lang === "vi" ? "Số tháng kỳ hạn" : "Months"}
              type="number"
              min={1}
              max={120}
              value={formCreateDurationMonths.toString()}
              onChange={(e) => setFormCreateDurationMonths(Number(e.target.value))}
            />
            <Input
              label={lang === "vi" ? "Setup miễn phí (ngày)" : "Free setup (days)"}
              type="number"
              min={0}
              max={365}
              placeholder={lang === "vi" ? "Để trống = theo kỳ hạn" : "Blank = duration default"}
              value={formCreateDurationSetupDays.toString()}
              onChange={(e) => setFormCreateDurationSetupDays(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <Input
              label={lang === "vi" ? "Giảm giá đặt mới (%)" : "New Booking (%)"}
              type="number"
              min={0}
              max={100}
              value={formCreateDurationPercent.toString()}
              onChange={(e) => setFormCreateDurationPercent(Number(e.target.value))}
            />
            <Input
              label={lang === "vi" ? "Giảm giá gia hạn (%)" : "Renewal (%)"}
              type="number"
              min={0}
              max={100}
              value={formCreateDurationRenewalPercent.toString()}
              onChange={(e) => setFormCreateDurationRenewalPercent(Number(e.target.value))}
            />
            <Input
              label={lang === "vi" ? "Cọc giữ chỗ (%)" : "Deposit (%)"}
              type="number"
              min={5}
              max={50}
              value={formCreateDurationDepositPercent.toString()}
              onChange={(e) => setFormCreateDurationDepositPercent(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={lang === "vi" ? "Phạm vi giao dịch áp dụng" : "Applies To"}
              value={formCreateDurationAppliesTo}
              onChange={(e) => setFormCreateDurationAppliesTo(e.target.value)}
            >
              <option value="Đặt mới & Gia hạn">Đặt mới & Gia hạn</option>
              <option value="Chỉ đặt mới">Chỉ đặt mới</option>
              <option value="Chỉ gia hạn">Chỉ gia hạn</option>
              <option value="Không áp dụng giảm">Không áp dụng giảm</option>
            </Select>

            <Select
              label={lang === "vi" ? "Trạng thái ban đầu" : "Status"}
              value={formCreateDurationStatus}
              onChange={(e) => setFormCreateDurationStatus(e.target.value as "active" | "inactive")}
            >
              <option value="active">{lang === "vi" ? "Đang áp dụng (Có hiệu lực)" : "Active"}</option>
              <option value="inactive">{lang === "vi" ? "Tạm dừng (Chưa kích hoạt)" : "Inactive"}</option>
            </Select>
          </div>

          {/* Phạm vi cơ sở áp dụng gói thuê */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800 flex items-center justify-between">
              <span>{lang === "vi" ? "Phạm vi cơ sở áp dụng gói thuê" : "Applicable Facilities"}</span>
              <span className="text-xs font-normal text-slate-500">
                {formCreateDurationScopeType === "all"
                  ? (lang === "vi" ? "Áp dụng cho toàn bộ cơ sở" : "Applies to all facilities")
                  : (lang === "vi" ? `${formCreateDurationFacilityIds.length} cơ sở đã chọn` : `${formCreateDurationFacilityIds.length} facilities selected`)}
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${formCreateDurationScopeType === "all"
                    ? "border-emerald-300 bg-emerald-50/50 font-semibold text-slate-900 ring-1 ring-emerald-300"
                    : "border-stone-200 bg-white hover:bg-stone-50 text-slate-600"
                  }`}
              >
                <input
                  type="radio"
                  name="createDurationScope"
                  checked={formCreateDurationScopeType === "all"}
                  onChange={() => setFormCreateDurationScopeType("all")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    {lang === "vi" ? "Toàn bộ cơ sở kho (Toàn hệ thống)" : "All facilities"}
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {lang === "vi"
                      ? "Áp dụng đồng bộ cho tất cả các chi nhánh kho StorageHub"
                      : "Uniformly applied across all branches"}
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${formCreateDurationScopeType === "specific"
                    ? "border-emerald-300 bg-emerald-50/50 font-semibold text-slate-900 ring-1 ring-emerald-300"
                    : "border-stone-200 bg-white hover:bg-stone-50 text-slate-600"
                  }`}
              >
                <input
                  type="radio"
                  name="createDurationScope"
                  checked={formCreateDurationScopeType === "specific"}
                  onChange={() => setFormCreateDurationScopeType("specific")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    {lang === "vi" ? "Chỉ định cơ sở cụ thể" : "Specific facilities"}
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {lang === "vi"
                      ? "Chỉ áp dụng cho các cơ sở kho được tick chọn"
                      : "Apply only to designated facilities selected below"}
                  </span>
                </div>
              </label>
            </div>

            {formCreateDurationScopeType === "specific" && (
              <div className="mt-2.5 p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {lang === "vi"
                      ? `Chọn cơ sở áp dụng (${formCreateDurationFacilityIds.length}/${facilitiesList.length})`
                      : `Select Facilities (${formCreateDurationFacilityIds.length}/${facilitiesList.length})`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormCreateDurationFacilityIds(facilitiesList.map((f) => f.id))}
                      className="text-emerald-800 hover:text-emerald-950 font-medium underline cursor-pointer text-[11px]"
                    >
                      {lang === "vi" ? "Chọn tất cả" : "Select All"}
                    </button>
                    <span className="text-stone-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFormCreateDurationFacilityIds([])}
                      className="text-stone-500 hover:text-stone-800 font-medium underline cursor-pointer text-[11px]"
                    >
                      {lang === "vi" ? "Bỏ chọn" : "Deselect All"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {facilitiesList.map((f) => {
                    const isChecked = formCreateDurationFacilityIds.includes(f.id)
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${isChecked
                            ? "border-emerald-300 bg-white shadow-2xs font-medium text-slate-900 ring-1 ring-emerald-300"
                            : "border-stone-200 bg-white/70 text-slate-600 hover:bg-white"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormCreateDurationFacilityIds([...formCreateDurationFacilityIds, f.id])
                            } else {
                              setFormCreateDurationFacilityIds(formCreateDurationFacilityIds.filter((id) => id !== f.id))
                            }
                          }}
                          className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="min-w-0 flex-1 truncate">
                          <div className="font-semibold text-slate-900 truncate">{f.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {f.city} • Mã: {f.code || f.id}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              {lang === "vi" ? "Ghi chú điều khoản & mô tả gói" : "Description / Terms"}
            </label>
            <textarea
              rows={3}
              value={formCreateDurationDesc}
              onChange={(e) => setFormCreateDurationDesc(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder={lang === "vi" ? "VD: Giảm 6% khi khách thuê hoặc gia hạn kỳ hạn 9 tháng..." : "Package terms description..."}
            />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateDurationModal(false)}>
              {lang === "vi" ? "Hủy" : "Cancel"}
            </Button>
            <Button variant="primary" onClick={handleSaveNewDurationDiscount}>
              {lang === "vi" ? "Tạo Gói Thuê" : "Create Package"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: CHỈNH SỬA GÓI THUÊ & MỨC GIẢM GIÁ KỲ HẠN ── */}
      <Modal
        open={editDurationModal}
        onClose={() => setEditDurationModal(false)}
        title={
          selectedDurationItem
            ? `Chỉnh Sửa Gói Thuê: ${selectedDurationItem.title}`
            : "Chỉnh Sửa Gói Thuê"
        }
      >
        {packageFormError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{packageFormError}</p>}
        {selectedDurationItem && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1">
              <p className="font-bold text-sm text-slate-900">
                {selectedDurationItem.title} ({selectedDurationItem.label})
              </p>
              <p className="text-slate-600 leading-relaxed">
                Tỷ lệ chiết khấu (%) thiết lập ở đây sẽ được đồng bộ trực tiếp vào công thức tính tiền và báo giá trên ứng dụng của Khách Hàng.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tên gói thuê"
                value={formDurationTitle}
                onChange={(e) => setFormDurationTitle(e.target.value)}
              />
              <Input
                label="Nhãn ngắn gọn"
                value={formDurationLabel}
                onChange={(e) => setFormDurationLabel(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                label="Setup miễn phí (ngày)"
                type="number"
                min={0}
                max={365}
                placeholder="Để trống = theo kỳ hạn"
                value={formDurationSetupDays.toString()}
                onChange={(e) => setFormDurationSetupDays(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <Input
                label="Giảm giá khi đặt mới (%)"
                type="number"
                min={0}
                max={100}
                value={formDurationPercent.toString()}
                onChange={(e) => setFormDurationPercent(Number(e.target.value))}
              />

              <Input
                label="Giảm giá khi gia hạn (%)"
                type="number"
                min={0}
                max={100}
                value={formDurationRenewalPercent.toString()}
                onChange={(e) => setFormDurationRenewalPercent(Number(e.target.value))}
              />

              <Input
                label="Cọc giữ chỗ (%)"
                type="number"
                min={5}
                max={50}
                value={formDurationDepositPercent.toString()}
                onChange={(e) => setFormDurationDepositPercent(Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Phạm vi giao dịch áp dụng"
                value={formDurationAppliesTo}
                onChange={(e) => setFormDurationAppliesTo(e.target.value)}
              >
                <option value="Đặt mới & Gia hạn">Đặt mới & Gia hạn</option>
                <option value="Chỉ đặt mới">Chỉ đặt mới</option>
                <option value="Chỉ gia hạn">Chỉ gia hạn</option>
                <option value="Không áp dụng giảm">Không áp dụng giảm</option>
              </Select>

              <Select
                label="Trạng thái chính sách"
                value={formDurationStatus}
                onChange={(e) => setFormDurationStatus(e.target.value as "active" | "inactive")}
              >
                <option value="active">Đang áp dụng (Có hiệu lực)</option>
                <option value="inactive">Tạm dừng (Không chiết khấu)</option>
              </Select>
            </div>

            {/* Phạm vi cơ sở áp dụng gói thuê */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800 flex items-center justify-between">
                <span>Phạm vi cơ sở áp dụng</span>
                <span className="text-xs font-normal text-slate-500">
                  {formDurationScopeType === "all"
                    ? "Áp dụng cho toàn bộ cơ sở"
                    : `${formDurationFacilityIds.length} cơ sở đã chọn`}
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${formDurationScopeType === "all"
                      ? "border-amber-300 bg-amber-50/50 font-semibold text-slate-900 ring-1 ring-amber-300"
                      : "border-stone-200 bg-white hover:bg-stone-50 text-slate-600"
                    }`}
                >
                  <input
                    type="radio"
                    name="editDurationScope"
                    checked={formDurationScopeType === "all"}
                    onChange={() => setFormDurationScopeType("all")}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Toàn bộ cơ sở kho (Toàn hệ thống)
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Áp dụng đồng bộ cho tất cả các chi nhánh kho
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${formDurationScopeType === "specific"
                      ? "border-amber-300 bg-amber-50/50 font-semibold text-slate-900 ring-1 ring-amber-300"
                      : "border-stone-200 bg-white hover:bg-stone-50 text-slate-600"
                    }`}
                >
                  <input
                    type="radio"
                    name="editDurationScope"
                    checked={formDurationScopeType === "specific"}
                    onChange={() => setFormDurationScopeType("specific")}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Chỉ định cơ sở cụ thể
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Chỉ áp dụng cho các cơ sở kho được tick chọn
                    </span>
                  </div>
                </label>
              </div>

              {formDurationScopeType === "specific" && (
                <div className="mt-2.5 p-3 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Chọn cơ sở áp dụng ({formDurationFacilityIds.length}/{facilitiesList.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormDurationFacilityIds(facilitiesList.map((f) => f.id))}
                        className="text-amber-800 hover:text-amber-950 font-medium underline cursor-pointer text-[11px]"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-stone-300">|</span>
                      <button
                        type="button"
                        onClick={() => setFormDurationFacilityIds([])}
                        className="text-stone-500 hover:text-stone-800 font-medium underline cursor-pointer text-[11px]"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {facilitiesList.map((f) => {
                      const isChecked = formDurationFacilityIds.includes(f.id)
                      return (
                        <label
                          key={f.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${isChecked
                              ? "border-amber-300 bg-white shadow-2xs font-medium text-slate-900 ring-1 ring-amber-300"
                              : "border-stone-200 bg-white/70 text-slate-600 hover:bg-white"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormDurationFacilityIds([...formDurationFacilityIds, f.id])
                              } else {
                                setFormDurationFacilityIds(formDurationFacilityIds.filter((id) => id !== f.id))
                              }
                            }}
                            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="min-w-0 flex-1 truncate">
                            <div className="font-semibold text-slate-900 truncate">{f.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {f.city} • Mã: {f.code || f.id}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Ghi chú điều khoản & diễn giải
              </label>
              <textarea
                rows={3}
                value={formDurationDesc}
                onChange={(e) => setFormDurationDesc(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="Nhập ghi chú điều khoản áp dụng gói thuê..."
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs font-semibold"
                onClick={() => handleDeleteDurationDiscount(selectedDurationItem.id)}
              >
                Xóa Gói Này
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditDurationModal(false)}>
                  Hủy
                </Button>
                <Button variant="primary" onClick={handleSaveDurationDiscount}>
                  Lưu Thay Đổi
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODALS QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ─────────── */}
      {/* ── MODALS QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ─────────── */}
      {(() => {
        const handleSyncUnitSpecs = (newSpecs: FacilityCustomUnitSpec[]) => {
          setFormFacUnitSpecs(newSpecs)
          const total = newSpecs.reduce((sum, s) => sum + s.count, 0)
          setFormFacUnits(total)

          newSpecs.forEach((s) => {
            if (s.sizeCode === "S") {
              setFormFacUnitS(s.count)
              setFormFacLengthS(s.lengthM)
              setFormFacWidthS(s.widthM)
              setFormFacLaneS(s.laneWidthM || 4)
              setFormFacLoadS(s.maxLoadKg)
              setFormFacPriceS(`${Math.round(s.monthlyPrice).toLocaleString("vi-VN")}đ`)
            } else if (s.sizeCode === "M") {
              setFormFacUnitM(s.count)
              setFormFacLengthM(s.lengthM)
              setFormFacWidthM(s.widthM)
              setFormFacLaneM(s.laneWidthM || 4)
              setFormFacLoadM(s.maxLoadKg)
              setFormFacPriceM(`${Math.round(s.monthlyPrice).toLocaleString("vi-VN")}đ`)
            } else if (s.sizeCode === "L") {
              setFormFacUnitL(s.count)
              setFormFacLengthL(s.lengthM)
              setFormFacWidthL(s.widthM)
              setFormFacLaneL(s.laneWidthM || 4)
              setFormFacLoadL(s.maxLoadKg)
              setFormFacPriceL(`${Math.round(s.monthlyPrice).toLocaleString("vi-VN")}đ`)
            } else if (s.sizeCode === "XL") {
              setFormFacUnitXL(s.count)
              setFormFacLengthXL(s.lengthM)
              setFormFacWidthXL(s.widthM)
              setFormFacLaneXL(s.laneWidthM || 4)
              setFormFacLoadXL(s.maxLoadKg)
              setFormFacPriceXL(`${Math.round(s.monthlyPrice).toLocaleString("vi-VN")}đ`)
            }
          })

          const active = newSpecs.filter((s) => s.count > 0)
          if (active.length > 0) {
            const minP = Math.min(...active.map((s) => s.monthlyPrice))
            setFormFacPrice(`${Math.round(minP).toLocaleString("vi-VN")}đ`)
          }
        }

        const isEditDirty = (() => {
          if (!selectedFacility || !editInitialFacility) return false
          const orig = editInitialFacility
          if (formFacCode.trim().toUpperCase() !== (orig.code || orig.id || "").toUpperCase()) return true
          if (formFacName.trim() !== (orig.name || "").trim()) return true
          if (formFacAddress.trim() !== (orig.address || "").trim()) return true
          if (formFacCity.trim() !== (orig.city || "").trim()) return true
          if (formFacPhone.trim() !== (orig.phone || "").trim()) return true
          if (formFacAccessHours.trim() !== (orig.accessHours || "").trim()) return true
          if (formFacStatus !== orig.status) return true
          if (formFacImage !== (orig.image || "")) return true

          if (formFacUnitSpecs.length !== editInitialSpecs.length) return true
          for (const s of formFacUnitSpecs) {
            const o = editInitialSpecs.find((x) => x.sizeCode === s.sizeCode)
            if (!o) return true
            if (s.name !== o.name) return true
            if (s.count !== o.count) return true
            if (s.lengthM !== o.lengthM) return true
            if (s.widthM !== o.widthM) return true
            if (s.heightM !== o.heightM) return true
            if (s.laneWidthM !== o.laneWidthM) return true
            if (s.maxLoadKg !== o.maxLoadKg) return true
            if (s.monthlyPrice !== o.monthlyPrice) return true
            if (s.frameCount !== o.frameCount) return true
            if (s.frameDimensions?.lengthM !== o.frameDimensions?.lengthM) return true
            if (s.frameDimensions?.widthM !== o.frameDimensions?.widthM) return true
            if (s.frameDimensions?.heightM !== o.frameDimensions?.heightM) return true
          }
          return false
        })()

        const handleRequestCloseEdit = () => {
          if (isEditDirty) {
            setShowConfirmCloseEdit(true)
          } else {
            setEditFacilityModal(false)
          }
        }

        return (
          <>
            {/* 1. Modal Thêm Mới Cơ Sở (Create Facility) */}
            <Modal
              open={createFacilityModal}
              onClose={() => setCreateFacilityModal(false)}
              title={
                lang === "vi"
                  ? "Thêm Cơ Sở Kho Mới"
                  : "Create New Storage Facility"
              }
              size="full"
              className="max-w-[95vw] xl:max-w-6xl 2xl:max-w-7xl"
            >
              {facilityEditError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{facilityEditError}</p>}
              <div className="space-y-4">
                {/* Thông tin cơ sở */}
                <FacilityGeneralInfo
                  isEditing={false}
                  code={formFacCode}
                  onChangeCode={setFormFacCode}
                  city={formFacCity}
                  onChangeCity={setFormFacCity}
                  name={formFacName}
                  onChangeName={setFormFacName}
                  address={formFacAddress}
                  onChangeAddress={setFormFacAddress}
                  phone={formFacPhone}
                  onChangePhone={setFormFacPhone}
                  existingFacilities={facilitiesList}
                  lang={lang}
                />

                {/* Hình ảnh cơ sở & kho bãi */}
                <FacilityImageManager
                  image={formFacImage}
                  onChangeImage={setFormFacImage}
                  lang={lang}
                />

                {!isApiAuthenticated() && <UnitAllocationTable
                  specs={formFacUnitSpecs}
                  onChangeSpecs={handleSyncUnitSpecs}
                  isEditing={false}
                  onOpenAddSpec={() => setShowAddUnitSpecModal(true)}
                  lang={lang}
                  onValidationChange={(_hasErrors, errors) => setCreateValidationErrors(errors)}
                  highlightSpecCode={highlightSpecCode}
                />}

                {/* Thông số vận hành */}
                <FacilityOperations
                  accessHours={formFacAccessHours}
                  onChangeAccessHours={setFormFacAccessHours}
                  status={formFacStatus}
                  onChangeStatus={setFormFacStatus}
                  statusReadOnly={isApiAuthenticated()}
                  lang={lang}
                />

                {/* Sticky footer */}
                <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 z-10">
                  <div className="text-xs text-stone-500">
                    {!isApiAuthenticated() && formFacUnits <= 0 ? (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Cần ít nhất 1 loại kho có số lượng &gt; 0
                      </span>
                    ) : !isApiAuthenticated() && createValidationErrors.length > 0 ? (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {createValidationErrors[0]}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      onClick={() => setCreateFacilityModal(false)}
                    >
                      {lang === "vi" ? "Hủy" : "Cancel"}
                    </Button>
                    <Button
                      variant="primary"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                      disabled={
                        !formFacName.trim() ||
                        !formFacCode.trim() ||
                        !formFacAddress.trim() ||
                        (!isApiAuthenticated() && formFacUnits <= 0) ||
                        (!isApiAuthenticated() && createValidationErrors.length > 0) ||
                        facilitiesList.some(
                          (f) => (f.code || f.id).toUpperCase() === formFacCode.trim().toUpperCase()
                        )
                      }
                      onClick={handleCreateFacility}
                    >
                      {lang === "vi" ? "Lưu Cơ Sở Mới" : "Save Facility"}
                    </Button>
                  </div>
                </div>
              </div>
            </Modal>

            {/* 2. Modal Chỉnh Sửa Cơ Sở (Edit Facility) */}
            <Modal
              open={editFacilityModal}
              onClose={handleRequestCloseEdit}
              title={
                lang === "vi" ? "Chỉnh Sửa Thông Tin Cơ Sở" : "Edit Facility"
              }
              size="full"
              className="max-w-[95vw] xl:max-w-6xl 2xl:max-w-7xl"
            >
              {selectedFacility &&
                (() => {
                  const facUnits = unitsList.filter(
                    (u) =>
                      u.facilityId === selectedFacility.id ||
                      u.facilityId === selectedFacility.code,
                  )

                  const occMap: Record<string, number> = {}
                  facUnits.forEach((u) => {
                    const isOccupied =
                      u.status === "occupied" ||
                      (u.status as string) === "rented"
                    if (!isOccupied) return
                    const rawCode =
                      (u as any).sizeCode ||
                      (u as any).size ||
                      (u.type === "Small"
                        ? "S"
                        : u.type === "Medium"
                          ? "M"
                          : u.type === "Large"
                            ? "L"
                            : u.type === "Extra Large"
                              ? "XL"
                              : String(u.type))
                    occMap[rawCode] = (occMap[rawCode] || 0) + 1
                    if (rawCode === "Small") occMap["S"] = (occMap["S"] || 0) + 1
                    if (rawCode === "Medium") occMap["M"] = (occMap["M"] || 0) + 1
                    if (rawCode === "Large") occMap["L"] = (occMap["L"] || 0) + 1
                    if (rawCode === "Extra Large") occMap["XL"] = (occMap["XL"] || 0) + 1
                  })

                  const hasDuplicateCode = facilitiesList.some(
                    (f) =>
                      (f.code || f.id).toUpperCase() === formFacCode.trim().toUpperCase() &&
                      f.id !== selectedFacility.id
                  )

                  return (
                    <div className="space-y-4">
                      {facilityEditError && (
                        <div
                          role="alert"
                          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 font-medium flex items-start gap-3 shadow-xs animate-shake"
                        >
                          <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="flex-1 space-y-1">
                            <p className="font-bold text-red-900">Không thể cập nhật cơ sở</p>
                            <p className="text-red-700 leading-relaxed font-normal">{facilityEditError}</p>
                          </div>
                        </div>
                      )}

                      {/* Thông tin cơ sở */}
                      <FacilityGeneralInfo
                        isEditing={true}
                        code={formFacCode}
                        onChangeCode={setFormFacCode}
                        city={formFacCity}
                        onChangeCity={setFormFacCity}
                        name={formFacName}
                        onChangeName={setFormFacName}
                        address={formFacAddress}
                        onChangeAddress={setFormFacAddress}
                        phone={formFacPhone}
                        onChangePhone={setFormFacPhone}
                        existingFacilities={facilitiesList}
                        currentFacilityId={selectedFacility.id}
                        initialCode={editInitialFacility?.code || editInitialFacility?.id}
                        lang={lang}
                      />

                      {/* Hình ảnh cơ sở & kho bãi */}
                      <FacilityImageManager
                        image={formFacImage}
                        onChangeImage={setFormFacImage}
                        lang={lang}
                      />

                      {!isApiAuthenticated() && <UnitAllocationTable
                        specs={formFacUnitSpecs}
                        onChangeSpecs={handleSyncUnitSpecs}
                        isEditing={true}
                        occupiedMap={occMap}
                        initialSpecs={editInitialSpecs}
                        onOpenAddSpec={() => setShowAddUnitSpecModal(true)}
                        lang={lang}
                        onValidationChange={(_hasErrors, errors) => setEditValidationErrors(errors)}
                        highlightSpecCode={highlightSpecCode}
                      />}

                      {/* Thông số vận hành */}
                      <FacilityOperations
                        accessHours={formFacAccessHours}
                        onChangeAccessHours={setFormFacAccessHours}
                        status={formFacStatus}
                        onChangeStatus={setFormFacStatus}
                        statusReadOnly={false}
                        initialStatus={selectedFacility.status}
                        lang={lang}
                      />

                      {/* Sticky footer */}
                      <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 z-10">
                        <div className="text-xs text-stone-500">
                          {!isApiAuthenticated() && formFacUnits <= 0 ? (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Cần ít nhất 1 loại kho có số lượng &gt; 0
                            </span>
                          ) : !isApiAuthenticated() && editValidationErrors.length > 0 ? (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {editValidationErrors[0]}
                            </span>
                          ) : !isEditDirty ? (
                            <span className="text-stone-400 italic">
                              Chưa có thay đổi nào so với dữ liệu gốc
                            </span>
                          ) : (
                            <span className="text-amber-800 font-semibold">
                              Có thay đổi chưa lưu
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            variant="outline"
                            onClick={handleRequestCloseEdit}
                            disabled={isUpdatingFacility}
                          >
                            {lang === "vi" ? "Hủy" : "Cancel"}
                          </Button>
                          <Button
                            variant="primary"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-2"
                            disabled={
                              isUpdatingFacility ||
                              !isEditDirty ||
                              !formFacName.trim() ||
                              !formFacCode.trim() ||
                              !formFacAddress.trim() ||
                              (!isApiAuthenticated() && formFacUnits <= 0) ||
                              hasDuplicateCode ||
                              (!isApiAuthenticated() && editValidationErrors.length > 0)
                            }
                            onClick={handleUpdateFacility}
                          >
                            {isUpdatingFacility ? (
                              <>
                                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>{lang === "vi" ? "Đang lưu..." : "Saving..."}</span>
                              </>
                            ) : (
                              lang === "vi" ? "Lưu Thay Đổi" : "Save Changes"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
            </Modal>

            {/* Modal Thêm Loại Kho Mới Vào Cơ Sở */}
            {!isApiAuthenticated() && <AddUnitSpecModal
              open={showAddUnitSpecModal}
              onClose={() => setShowAddUnitSpecModal(false)}
              onConfirm={(newSpec) => {
                handleSyncUnitSpecs([...formFacUnitSpecs, newSpec])
                setHighlightSpecCode(newSpec.sizeCode)
                showToast(
                  lang === "vi"
                    ? `Đã thêm loại kho "${newSpec.sizeCode}" (${newSpec.name}) vào cơ sở!`
                    : `Added unit type "${newSpec.sizeCode}"!`,
                )
              }}
              existingSpecs={formFacUnitSpecs}
              lang={lang}
            />}

            {/* Modal Xác Nhận Rời Đi Khi Có Unsaved Changes */}
            {showConfirmCloseEdit && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
                onClick={() => setShowConfirmCloseEdit(false)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-stone-900">
                        {lang === "vi" ? "Hủy bỏ các thay đổi?" : "Discard Unsaved Changes?"}
                      </h3>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        {lang === "vi"
                          ? "Bạn có những thay đổi chưa được lưu trên cơ sở này. Nếu đóng bây giờ, các thay đổi vừa chỉnh sửa sẽ bị mất."
                          : "You have unsaved changes. Are you sure you want to discard them and close?"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setShowConfirmCloseEdit(false)}
                      className="px-4 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition cursor-pointer"
                    >
                      {lang === "vi" ? "Tiếp tục chỉnh sửa" : "Keep Editing"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfirmCloseEdit(false)
                        setEditFacilityModal(false)
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-lg transition cursor-pointer shadow-xs"
                    >
                      {lang === "vi" ? "Hủy thay đổi & Đóng" : "Discard & Close"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* 3. Modal Quản Lý Vòng Đời: Xóa hoặc Ngừng Hoạt Động Cơ Sở */}
      <Modal
        open={deleteFacilityModal}
        onClose={() => {
          if (!deleteFacilityBusy) {
            setDeleteFacilityModal(false)
            setDeleteFacilityError(null)
          }
        }}
        title={lang === "vi" ? "Quản Lý Vòng Đời Cơ Sở" : "Facility Lifecycle Management"}
      >
        {selectedFacility && (
          <div className="space-y-4">
            {/* TH 1: Đang có khách thuê hoạt động */}
            {selectedFacility.occupied > 0 ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-base text-red-700">
                  ⚠️ CẢNH BÁO AN TOÀN HỢP ĐỒNG:
                </div>
                <p>
                  Cơ sở <b>{selectedFacility.name} ({selectedFacility.code || selectedFacility.id})</b> hiện đang có{" "}
                  <b className="text-red-700">{selectedFacility.occupied} gian kho có hợp đồng khách thuê đang hoạt động</b>.
                </p>
                <p className="text-xs text-red-600 leading-relaxed">
                  Hệ thống <b>từ chối xóa hoặc ngừng hoạt động</b> cơ sở này nhằm bảo đảm toàn vẹn hợp đồng khách hàng, an ninh tài sản và tính pháp lý kế toán. Toàn bộ hợp đồng phải được hoàn tất thanh lý và nghiệm thu tại mục <b>Trả kho & Quyết toán</b> trước khi thao tác.
                </p>
              </div>
            ) : selectedFacility.status === "inactive" ? (
              /* TH 2: Cơ sở đã ở trạng thái Ngừng hoạt động */
              <div className="space-y-3">
                <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl text-xs text-stone-700 space-y-2">
                  <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-stone-400 inline-block"></span>
                    Cơ sở hiện đang ở trạng thái: Ngừng hoạt động
                  </div>
                  <p>
                    Cơ sở <b>{selectedFacility.name}</b> đã được ẩn khỏi danh mục tìm kiếm của khách hàng. Tất cả số liệu lịch sử hợp đồng và kiểm toán được lưu trữ an toàn.
                  </p>
                  {selectedFacility.units > 0 && (
                    <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      Cơ sở đang có <b>{selectedFacility.units} gian kho</b>. Do ràng buộc kiểm toán và lịch sử dữ liệu, hệ thống khuyến nghị lưu trữ ở trạng thái này thay vì xóa cứng.
                    </p>
                  )}
                </div>
              </div>
            ) : selectedFacility.units > 0 ? (
              /* TH 3: Không có khách thuê (occupied = 0) nhưng đã có gian kho / phân công */
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Bạn đang thao tác với cơ sở <b className="text-slate-900">{selectedFacility.name}</b>.
                </p>
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 space-y-1.5">
                  <div className="font-bold text-amber-950 flex items-center gap-1">
                    ℹ️ Thông tin hiện trạng cơ sở:
                  </div>
                  <div><b>Mã cơ sở:</b> <span className="font-mono">{selectedFacility.code || selectedFacility.id}</span></div>
                  <div><b>Địa điểm:</b> {selectedFacility.address}, {selectedFacility.city}</div>
                  <div><b>Quy mô:</b> {selectedFacility.units} gian kho (Hiện 0 khách thuê)</div>
                  <p className="text-amber-800 pt-1 leading-relaxed">
                    Cơ sở đã được khởi tạo cấu hình gian kho (hiện không có hợp đồng khách thuê). Bạn có thể chọn <b>Chuyển sang Ngừng hoạt động</b> để tạm ẩn, hoặc bấm <b>Xác Nhận Xóa Cơ Sở</b> để xóa bỏ hoàn toàn cơ sở cùng danh mục kho liên quan.
                  </p>
                </div>
              </div>
            ) : (
              /* TH 4: Cơ sở mới tạo (Setup / Draft), 0 gian kho, 0 khách */
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Bạn có chắc chắn muốn xóa vĩnh viễn cơ sở <b className="text-slate-900">{selectedFacility.name}</b> khỏi hệ thống?
                </p>
                <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg text-xs text-stone-600 space-y-1">
                  <div><b>Mã cơ sở:</b> <span className="font-mono">{selectedFacility.code || selectedFacility.id}</span></div>
                  <div><b>Địa điểm:</b> {selectedFacility.address}, {selectedFacility.city}</div>
                  <div><b>Trạng thái:</b> Đang thiết lập (0 gian kho)</div>
                </div>
                <p className="text-xs text-stone-500">
                  Hành động này sẽ xóa hoàn toàn cơ sở khỏi danh mục hệ thống.
                </p>
              </div>
            )}

            {/* Thông báo lỗi inline nếu có */}
            {deleteFacilityError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <span>❌</span>
                  <span>{deleteFacilityError}</span>
                </div>
                {deleteFacilityError.includes("Ngừng hoạt động") && selectedFacility.occupied === 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleDeactivateFacility}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Bấm vào đây để chuyển sang Ngừng hoạt động ngay
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                disabled={deleteFacilityBusy}
                onClick={() => {
                  setDeleteFacilityModal(false)
                  setDeleteFacilityError(null)
                }}
              >
                {lang === "vi" ? "Đóng" : "Cancel"}
              </Button>

              {/* Nút Chuyển sang Ngừng hoạt động */}
              {selectedFacility.occupied === 0 && selectedFacility.status !== "inactive" && (
                <Button
                  variant="primary"
                  disabled={deleteFacilityBusy}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
                  onClick={handleDeactivateFacility}
                >
                  {deleteFacilityBusy ? "Đang xử lý..." : (lang === "vi" ? "Chuyển sang Ngừng hoạt động" : "Deactivate Facility")}
                </Button>
              )}

              {/* Nút Xóa vĩnh viễn */}
              {selectedFacility.occupied === 0 && (
                <Button
                  variant="primary"
                  disabled={deleteFacilityBusy}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs"
                  onClick={handleDeleteFacility}
                >
                  {deleteFacilityBusy ? "Đang xóa..." : (lang === "vi" ? "Xác Nhận Xóa Cơ Sở" : "Delete Facility")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteConfirmation} onClose={() => { if (!deleteConfirmationBusy) setDeleteConfirmation(null) }} title={deleteConfirmation?.kind === 'package' ? 'Xóa gói thuê' : 'Xóa chính sách'}>
        <div className="space-y-4">
          <p>Bạn có chắc muốn xóa <b>{deleteConfirmation?.title}</b>?</p>
          {deleteConfirmation?.kind === 'package' && <p className="text-sm text-stone-500">Gói sẽ ngừng áp dụng cho lượt thuê mới. Hồ sơ thuê và hóa đơn đã tạo vẫn được giữ nguyên.</p>}
          {deleteConfirmationError && <p role="alert" className="text-sm text-red-700">{deleteConfirmationError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={deleteConfirmationBusy} onClick={() => setDeleteConfirmation(null)}>Hủy</Button>
            <Button variant="danger" disabled={deleteConfirmationBusy} onClick={async () => {
              if (!deleteConfirmation) return
              setDeleteConfirmationBusy(true)
              setDeleteConfirmationError('')
              try {
                const result = deleteConfirmation.kind === 'package'
                  ? await handleDeleteDurationDiscount(deleteConfirmation.id, true)
                  : await handleDeletePolicy(deleteConfirmation.id, true)
                if (result !== false) setDeleteConfirmation(null)
              } catch (error) {
                setDeleteConfirmationError(error instanceof Error ? error.message : 'Không thể xóa. Vui lòng thử lại.')
              } finally { setDeleteConfirmationBusy(false) }
            }}>{deleteConfirmationBusy ? 'Đang xử lý…' : 'Xác nhận xóa'}</Button>
          </div>
        </div>
      </Modal>
      <UnitTypeReviewModal open={reviewOpen} requestId={reviewRequestId} onClose={() => setReviewOpen(false)} />
      {/* 4. Modal Chi Tiết Cơ Sở & Danh Mục Gian Kho Quy Hoạch */}
      <Modal
        open={viewFacilityModal}
        onClose={() => setViewFacilityModal(false)}
        title={lang === "vi" ? "Thông Tin Chi Tiết Cơ Sở" : "Facility Details"}
        size="2xl"
      >
        {selectedFacility &&
          (() => {
            const facCode = selectedFacility.code || selectedFacility.id

            const facilityUnits = unitsList.filter(
              (u) =>
                u.facilityId === selectedFacility.id ||
                u.facilityId === facCode,
            )

            const occupancyRate = selectedFacility.units
              ? Math.round(
                (getFacilityOccupiedCount(selectedFacility) /
                  Math.max(1, getFacilityTotalUnits(selectedFacility))) *
                100,
              )
              : 0

            const defaultLoadS = selectedFacility.unitLoadLimits?.S ?? 1000
            const defaultLoadM = selectedFacility.unitLoadLimits?.M ?? 1600
            const defaultLoadL = selectedFacility.unitLoadLimits?.L ?? 2800
            const defaultLoadXL = selectedFacility.unitLoadLimits?.XL ?? 4000

            const totalFacilityLoadTon = isApiAuthenticated()
              ? Math.round(
                facilityDetailTypes.reduce(
                  (total, type) => total + (Number(type.totalCount) || 0) * (Number(type.maxLoadKg) || 0),
                  0,
                ) / 100,
              ) / 10
              : selectedFacility.totalDesignLoadTon ??
                Math.round(
                  (((selectedFacility.unitDistribution?.S ?? 0) * defaultLoadS +
                    (selectedFacility.unitDistribution?.M ?? 0) * defaultLoadM +
                    (selectedFacility.unitDistribution?.L ?? 0) * defaultLoadL +
                    (selectedFacility.unitDistribution?.XL ?? 0) * defaultLoadXL) /
                    1000) *
                  10,
                ) / 10

            const hasWarehouseInfo = isApiAuthenticated()
              ? facilityDetailTypes.length > 0
              : facilityUnits.length > 0 ||
                (Array.isArray(selectedFacility.unitCustomSpecs) && selectedFacility.unitCustomSpecs.length > 0) ||
                Object.values(selectedFacility.unitDistribution || {}).some((count) => Number(count || 0) > 0)

            return (
              <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                {/* Ảnh kho bãi của cơ sở */}
                {selectedFacility.image && (
                  <div className="relative h-44 sm:h-52 w-full rounded-xl overflow-hidden border border-stone-200 shadow-xs group">
                    <img
                      src={
                        selectedFacility.image.startsWith("http") ||
                          selectedFacility.image.startsWith("data:")
                          ? selectedFacility.image
                          : `https://images.unsplash.com/${selectedFacility.image}?w=800&auto=format&fit=crop`
                      }
                      alt={selectedFacility.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none"
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-900/30 to-transparent flex items-end p-4">
                      <div className="text-white">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-stone-950 shadow-xs">
                            {facCode}
                          </span>
                          <span className="text-xs text-amber-200 font-medium">
                            {selectedFacility.city}
                          </span>
                          {totalFacilityLoadTon > 0 && (
                            <span className="text-xs text-sky-200 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-400/30 font-mono">
                              Tải trọng sàn: {totalFacilityLoadTon} tấn
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-white drop-shadow-sm">
                          {selectedFacility.name}
                        </h3>
                        <p className="text-xs text-stone-300 mt-0.5">
                          {selectedFacility.address}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Header chi tiết cơ sở */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    {!selectedFacility.image && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          {facCode}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900">
                          {selectedFacility.name}
                        </h3>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedFacility.address} · {selectedFacility.city}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {totalFacilityLoadTon > 0 && !selectedFacility.image && (
                      <span className="px-2.5 py-1 rounded bg-sky-50 text-sky-800 border border-sky-200 font-mono text-xs font-bold">
                        Tải trọng sàn: {totalFacilityLoadTon} tấn
                      </span>
                    )}
                    <Badge
                      variant={
                        selectedFacility.status === "active"
                          ? "success"
                          : "warning"
                      }
                    >
                      {facilityStatusLabel(selectedFacility.status)}
                    </Badge>
                  </div>
                </div>

                {/* Thông số kỹ thuật & Vận hành */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">
                      Người quản lý:
                    </span>
                    <b className="text-slate-800 block text-sm">
                      {selectedFacility.manager}
                    </b>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">Hotline cơ sở:</span>
                    <b className="text-slate-800 block text-sm">
                      {selectedFacility.phone || "Chưa cập nhật"}
                    </b>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">
                      {lang === "vi" ? "Cước cơ sở từ:" : "Base rate from:"}
                    </span>
                    <b className="text-slate-800 block text-sm">
                      {hasWarehouseInfo ? `${selectedFacility.price}/tháng từ` : "Chưa cấu hình giá"}
                    </b>
                  </div>
                  <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200/80">
                    <span className="text-amber-800/80 block mb-0.5 font-medium">
                      {lang === "vi" ? "Tải trọng sàn:" : "Floor Load Limit:"}
                    </span>
                    <b className="text-amber-950 block text-sm font-bold font-mono">
                      {hasWarehouseInfo ? `${totalFacilityLoadTon} tấn` : "Chưa cấu hình"}
                    </b>
                    <span className="text-amber-700 font-medium text-[11px]">
                      {lang === "vi" ? "Thiết kế chịu tải" : "Max floor load"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">
                      Khung giờ mở cửa:
                    </span>
                    <b className="text-slate-800 block text-xs">
                      {selectedFacility.accessHours || (isApiAuthenticated() ? "Chưa cập nhật" : "08:00 - 17:00")}
                    </b>
                  </div>
                </div>

                {/* Thông số thực tế của từng loại kho, lấy trực tiếp từ API Manager. */}
                {facilityDetailTypes.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Loại kho thuộc cơ sở</h3>
                    {facilityDetailTypes.map(type => {
                      const missing = "Chưa khai báo"
                      const measure = (value: number | null | undefined, unit: string) =>
                        value == null ? missing : `${Number(value).toLocaleString("vi-VN")} ${unit}`
                      const dimensions = (length: number, width: number, height: number) =>
                        [length, width, height].some(value => value == null) ? missing : `${length} × ${width} × ${height} m`
                      const groups = [
                        { title: "Kích thước và tải trọng", fields: [
                          ["Kích thước kho (D × R × C)", dimensions(type.lengthM, type.widthM, type.heightM)],
                          ["Diện tích", measure(type.areaM2, "m²")],
                          ["Thể tích", measure(type.volumeM3, "m³")],
                          ["Tải trọng tối đa", measure(type.maxLoadKg, "kg")],
                        ]},
                        { title: "Khung kệ và thiết bị hỗ trợ", fields: [
                          ["Số khung kệ", measure(type.rackCount, "khung")],
                          ["Kích thước khung (D × R × C)", dimensions(type.rackLengthM, type.rackWidthM, type.rackHeightM)],
                          ["Chiều rộng lối đi", measure(type.aisleWidthM, "m")],
                          ["Xe đẩy hỗ trợ", type.trolleyType || missing],
                          ["Sức chứa thùng nhỏ", measure(type.smallBoxCapacity, "thùng")],
                          ["Sức chứa thùng lớn", measure(type.largeBoxCapacity, "thùng")],
                        ]},
                        { title: "Số lượng và giá thuê", fields: [
                          ["Tổng số gian", measure(type.totalCount, "gian")],
                          ["Đang sử dụng", measure(type.occupiedCount, "gian")],
                          ["Còn trống", measure(type.availableCount, "gian")],
                          ["Giá thuê mỗi tháng", Number(type.monthlyPrice) > 0 ? formatCurrency(type.monthlyPrice) : "Chờ BO định giá"],
                          ["Tiền cọc đảm bảo kho", Number(type.securityDepositAmount) > 0 ? formatCurrency(type.securityDepositAmount) : "Chưa cấu hình"],
                          ["Trạng thái loại kho", ({ active: "Đã công bố", awaiting_pricing: "Chờ BO định giá / duyệt", draft: "Đang thiết lập", inactive: "Ngừng hoạt động" } as Record<string, string>)[type.status] || type.status],
                        ]},
                      ]
                      return (
                        <article key={type.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                          <div className="flex flex-col gap-4 border-b border-stone-200 bg-stone-50 p-4 sm:flex-row">
                            {type.imageUrl && <img src={type.imageUrl} alt={type.name} className="h-28 w-full rounded-lg object-cover sm:w-40" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-slate-500 break-words">{type.code}</p>
                              <h4 className="mt-1 text-base font-semibold break-words">{type.name}</h4>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{type.description || "Chưa có mô tả"}</p>
                              {type.imageUrl && <a href={type.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-amber-700 underline">Xem ảnh gốc</a>}
                            </div>
                          </div>
                          {type.detailImageUrl && <figure className="border-b border-stone-200 p-4">
                            <figcaption className="mb-2 text-sm font-semibold">Ảnh chi tiết / sơ đồ bố trí</figcaption>
                            <img src={type.detailImageUrl} alt={`Sơ đồ ${type.name}`} className="max-h-72 w-full rounded-lg object-contain" />
                          </figure>}
                          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                            {groups.map((group, groupIndex) => (
                              <section key={group.title} className={`min-w-0 overflow-hidden rounded-xl border border-stone-200 ${groupIndex === 2 ? 'lg:col-span-2' : ''}`}>
                                <h5 className="border-b border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-slate-800">{group.title}</h5>
                                <dl className={groupIndex === 2 ? "grid gap-px bg-stone-200 sm:grid-cols-2 lg:grid-cols-3" : "divide-y divide-stone-100 px-4"}>
                                  {group.fields.map(([label, value]) => (
                                    <div key={label} className={groupIndex === 2 ? "min-w-0 bg-white px-4 py-3" : "grid grid-cols-1 gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-3"}>
                                      <dt className={groupIndex === 2 ? "mb-1 text-xs text-slate-500" : "text-slate-500"}>{label}</dt>
                                      <dd className={`min-w-0 whitespace-pre-wrap break-words font-medium ${groupIndex === 2 ? 'text-base text-slate-900' : 'text-sm text-slate-800'}`}>{value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </section>
                            ))}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center">
                    <p className="font-semibold text-stone-700">Chưa có thông tin loại kho</p>
                  </div>
                )}

                {/* Khối gói thuê đang áp dụng tại cơ sở này */}
                {(() => {
                  const activePackagesForFac = durationDiscounts.filter((p) => {
                    if (p.status !== "active") return false
                    if (p.scopeType === "all") return true
                    if (Array.isArray(p.facilityIds) && p.facilityIds.length > 0) {
                      return (
                        p.facilityIds.includes(selectedFacility.id) ||
                        (selectedFacility.code && p.facilityIds.includes(selectedFacility.code))
                      )
                    }
                    return true
                  })

                  return (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {lang === "vi" ? "Gói Thuê & Chiết Khấu Kỳ Hạn Áp Dụng" : "Active Rental Packages"}
                          </h4>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                            {activePackagesForFac.length} {lang === "vi" ? "gói thuê" : "packages"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setViewFacilityModal(false)
                            setPage("policies")
                          }}
                          className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                        >
                          {lang === "vi" ? "Quản lý gói thuê →" : "Manage Packages →"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {activePackagesForFac.map((pkg) => (
                          <div
                            key={pkg.id}
                            className="p-3 rounded-lg border border-stone-200 bg-white space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-slate-900 text-xs truncate">
                                {pkg.label}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {pkg.discountPercent > 0 ? `-${pkg.discountPercent}%` : "Gốc"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {pkg.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* 4. Chính sách và quy định áp dụng (Đồng bộ trực quan với Customer Portal) */}
                {(() => {
                  const repType = facilityDetailTypes.find(t => Number(t.monthlyPrice) > 0) || facilityDetailTypes[0]
                  const samplePrice = isApiAuthenticated() ? null : repType && Number(repType.monthlyPrice) > 0 ? Number(repType.monthlyPrice) : null
                  const overdueFeePerDay = samplePrice == null ? null : samplePrice / 30 * 0.5
                  const overdueExampleDays = 4

                  return (
                    <>
                      <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-blue-900">4. Chính sách và quy định áp dụng</h4>
                            <p className="mt-0.5 text-xs text-stone-600">
                              Áp dụng cho khách thuê tại {selectedFacility.name} (hiển thị trực tiếp cho khách trên cổng Customer Portal).
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            Quy chế công bố
                          </span>
                        </div>

                        <div className="grid gap-3.5 sm:grid-cols-2">
                          <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-2xs">
                            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700">Phí quá hạn</h5>
                            <p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">
                              {isApiAuthenticated() ? 'Chưa có chính sách phí quá hạn từ backend.' : '50% đơn giá thuê ngày cho mỗi ngày trễ'}
                            </p>
                            <p className="text-xs leading-5 text-stone-600">
                              {isApiAuthenticated() ? 'Chi tiết phí quá hạn chỉ hiển thị khi backend có dữ liệu chính sách.' : 'Phí mỗi ngày = 50% × (đơn giá thuê tháng ÷ 30). Tổng phí = số ngày quá hạn × phí mỗi ngày.'}
                            </p>
                          </article>

                          <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-2xs">
                            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700">Tiền cọc đảm bảo kho</h5>
                            <p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">
                              {repType && Number(repType.securityDepositAmount) > 0
                                ? formatVndAmount(repType.securityDepositAmount)
                                : "Theo biểu giá từng loại kho"}
                            </p>
                            <p className="text-xs leading-5 text-stone-600">
                              {isApiAuthenticated() ? 'Số tiền cọc được lấy từ loại kho backend, điều kiện quyết toán hiển thị theo hồ sơ thực tế.' : 'Thu khi nhận kho, hoàn trả lại cho khách hàng sau khi nghiệm thu bàn giao trả kho (trừ công nợ, hư hại nếu có).'}
                            </p>
                          </article>

                          <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-2xs">
                            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700">Thời hạn thuê tối thiểu</h5>
                            <p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">
                              {isApiAuthenticated()
                                ? (durationDiscounts.filter(item => item.status === 'active' && typeof item.months === 'number').map(item => item.months as number).sort((a, b) => a - b)[0]
                                  ? `${durationDiscounts.filter(item => item.status === 'active' && typeof item.months === 'number').map(item => item.months as number).sort((a, b) => a - b)[0]} tháng`
                                  : 'Chưa có dữ liệu')
                                : '01 tháng'}
                            </p>
                            <p className="text-xs leading-5 text-stone-600">
                              {isApiAuthenticated() ? 'Kỳ hạn và ưu đãi cụ thể lấy từ các gói đang hiệu lực trên backend.' : 'Kỳ thuê sử dụng trọn tháng. Thời gian và ưu đãi cụ thể được xác nhận trong báo giá.'}
                            </p>
                          </article>

                          <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-2xs">
                            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700">Gia hạn quá hạn</h5>
                            <p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">
                              {isApiAuthenticated() ? 'Chưa có dữ liệu' : 'Tối đa 7 ngày'}
                            </p>
                            <p className="text-xs leading-5 text-stone-600">
                              {isApiAuthenticated() ? 'Chưa có dữ liệu thời hạn xử lý quá hạn từ backend.' : 'Sau khi hợp đồng hết hạn, khách có tối đa 7 ngày để hoàn tất gia hạn. Nếu đến ngày thứ 8 vẫn chưa hoàn tất, kho sẽ được chuyển sang quy trình thu hồi.'}
                            </p>
                          </article>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 space-y-3">
                        <h4 className="font-bold text-rose-900">Quy định trả kho và gia hạn</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <article className="rounded-xl border border-rose-200 bg-white p-4 text-xs">
                            <b className="text-slate-800 text-sm">Trả kho sau ngày hết hạn</b>
                            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-stone-700 leading-relaxed">
                              {isApiAuthenticated() ? <li>Chưa có chính sách phí quá hạn được backend công bố cho cơ sở này.</li> : <>
                                <li>Thời gian quá hạn tính từ ngày kế tiếp ngày hết hạn đến khi bàn giao và nghiệm thu kho thực tế.</li>
                                <li>Phí mỗi ngày = 50% × (đơn giá thuê tháng ÷ 30 ngày).</li>
                                <li>Tổng phí bằng số ngày quá hạn nhân với phí mỗi ngày. Khoản còn thiếu sau khấu trừ tiền cọc đảm bảo kho được đưa vào quyết toán.</li>
                              </>}
                            </ul>
                          </article>

                          <article className="rounded-xl border border-amber-200 bg-white p-4 text-xs">
                            <b className="text-slate-800 text-sm">Gia hạn kỳ thuê</b>
                            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-stone-700 leading-relaxed">
                              {isApiAuthenticated() ? <li>Chi tiết gia hạn được lấy theo chính sách backend của từng cơ sở.</li> : <>
                                <li>Yêu cầu gia hạn không tự động kéo dài kỳ thuê và cần được cơ sở xác nhận.</li>
                                <li>Khách hàng hoàn tất hồ sơ và các khoản phải thu trước khi kỳ gia hạn có hiệu lực.</li>
                              </>}
                            </ul>
                          </article>
                        </div>

                        <p className="rounded-lg bg-rose-100 p-3 text-xs leading-5 text-rose-950 font-medium">
                          {isApiAuthenticated()
                            ? 'Chưa có chính sách phí quá hạn từ backend để tính ví dụ.'
                            : samplePrice == null || overdueFeePerDay == null
                              ? 'Chưa có đơn giá loại kho để tính ví dụ phí quá hạn.'
                            : `Theo giá hiện tại (${repType ? repType.name : 'Loại kho'}): ${formatVndAmount(samplePrice)} ÷ 30 × 50% = ${formatVndAmount(overdueFeePerDay)}/ngày. Trễ ${overdueExampleDays} ngày tương ứng ${formatVndAmount(overdueFeePerDay * overdueExampleDays)}.`}
                        </p>
                      </section>
                    </>
                  )
                })()}

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    onClick={() => setViewFacilityModal(false)}
                  >
                    {lang === "vi" ? "Đóng" : "Close"}
                  </Button>
                </div>
              </div>
            )
          })()}
      </Modal>
    </Layout>
  )
}
