import { useState, useMemo, useCallback, useEffect } from "react"

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
  Tabs,
  ProgressBar,
  Input,
  Select,
} from "../../components/ui"

import type { User } from "../../types"

import type {
  PromotionItem,
  PricingTierItem,
  MonthlyRevenueRecord,
} from "../../data/demoDatabase"
import {
  UNIT_SPECS,
  REVENUE_DATA,
  REVENUE_BREAKDOWN,
  CONVERSION_DATA,
  PRICING_TIERS,
  DISCOUNTS,
  POLICIES,
  FEES,
} from "../../data/demoDatabase"

import { formatVnd } from "../../i18n/currency"

import { exportRevenueExcel } from "../../utils/excelExport"

import { useStorageHub, sanitizeFacilityStrings } from "../../store/StorageHubContext"
import type { FacilityCustomUnitSpec } from "../../types/storageHub"

import ProfileView from "../ProfileView"
import {
  getUnitTypeVehicleStandard,
  validateVehicleLaneWidth,
} from "../../domain/facilityRules"
import { generateDefaultRentalPackages } from "../../domain/packageRules"
import { UnitAllocationTable } from "./facility/UnitAllocationTable"
import { AddUnitSpecModal } from "./facility/AddUnitSpecModal"
import {
  FacilityGeneralInfo,
  FacilityOperations,
  FacilityImageManager,
} from "./facility/FacilityFormFields"
import { DEMO_DATA_ENABLED } from "../../config/runtime"
import { createFacilityApi, listAllFacilitiesApi } from "../../services/facilityApi"

const RUNTIME_REVENUE_DATA = DEMO_DATA_ENABLED ? REVENUE_DATA : []
const RUNTIME_REVENUE_BREAKDOWN = DEMO_DATA_ENABLED ? REVENUE_BREAKDOWN : []
const RUNTIME_CONVERSION_DATA = DEMO_DATA_ENABLED ? CONVERSION_DATA : []
const RUNTIME_PRICING_TIERS = DEMO_DATA_ENABLED ? PRICING_TIERS : []
const RUNTIME_DISCOUNTS = DEMO_DATA_ENABLED ? DISCOUNTS : []
const RUNTIME_FEES = DEMO_DATA_ENABLED ? FEES : []

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
}

export interface DurationDiscountItem {
  id: string
  months: number | 'other'
  title: string
  label: string
  discountPercent: number
  renewalDiscountPercent: number
  description: string
  appliesTo: string
  status: 'active' | 'inactive'
  scopeType?: 'all' | 'specific'
  facilityIds?: string[]
}

export const DEFAULT_DURATION_DISCOUNTS: DurationDiscountItem[] = [
  {
    id: "pkg-3m",
    months: 3,
    title: "Gói thuê 3 tháng",
    label: "3 tháng",
    discountPercent: 3,
    renewalDiscountPercent: 2,
    description: "Giảm 3% khi ký hợp đồng mới từ 3 tháng và giảm 2% khi gia hạn hợp đồng.",
    appliesTo: "Đặt mới & Gia hạn",
    status: "active",
  },
  {
    id: "pkg-6m",
    months: 6,
    title: "Gói thuê 6 tháng",
    label: "6 tháng",
    discountPercent: 5,
    renewalDiscountPercent: 3,
    description: "Giảm 5% cho hợp đồng mới và giảm 3% khi khách gia hạn kỳ hạn 6 tháng.",
    appliesTo: "Đặt mới & Gia hạn",
    status: "active",
  },
  {
    id: "pkg-12m",
    months: 12,
    title: "Gói thuê 12 tháng (1 năm)",
    label: "12 tháng",
    discountPercent: 8,
    renewalDiscountPercent: 5,
    description: "Giảm 8% cho hợp đồng mới và giảm 5% khi khách gia hạn kỳ hạn 12 tháng.",
    appliesTo: "Đặt kho & Gia hạn",
    status: "active",
  },
  {
    id: "pkg-24m",
    months: 24,
    title: "Gói thuê 24 tháng (2 năm)",
    label: "24 tháng",
    discountPercent: 12,
    renewalDiscountPercent: 8,
    description: "Giảm 12% cho hợp đồng dài hạn 2 năm và giảm 8% khi khách gia hạn kỳ hạn 24 tháng.",
    appliesTo: "Đặt mới & Gia hạn",
    status: "active",
  },
  {
    id: "pkg-other",
    months: "other",
    title: "Kỳ hạn khác (dưới 3 tháng hoặc linh hoạt)",
    label: "Dưới 3 tháng / Khác",
    discountPercent: 0,
    renewalDiscountPercent: 0,
    description: "Áp dụng cho các kỳ hạn dưới 3 tháng (1-2 tháng) hoặc thời hạn linh hoạt. Không áp dụng chiết khấu kỳ hạn.",
    appliesTo: "Không áp dụng giảm",
    status: "active",
  },
]

const WAREHOUSE_PHOTO_PRESETS = [
  {
    id: "preset-std",
    title: "Kho tiêu chuẩn hiện đại",
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80",
    description: "Hệ thống kệ thép công nghiệp, lối xe rộng",
  },
  {
    id: "preset-logistics",
    title: "Kho Logistics & Pallet",
    url: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&auto=format&fit=crop&q=80",
    description: "Khu vực bốc xếp pallet, sàn chịu tải trọng cao",
  },
  {
    id: "preset-smart",
    title: "Kho tự quản thông minh 24/7",
    url: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=800&auto=format&fit=crop&q=80",
    description: "Khóa số điện tử, điều hòa nhiệt ẩm tự động",
  },
  {
    id: "preset-mini",
    title: "Kho mini cá nhân & gia đình",
    url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80",
    description: "Ngăn kho nhỏ gọn, bảo quản đồ dùng gia đình",
  },
]

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
  // Trigger strings are already in Vietnamese in FEES data — return as-is
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

  const {
    facilities: facilitiesList,
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

  useEffect(() => {
    let isMounted = true
    listAllFacilitiesApi()
      .then((backendFacs) => {
        if (!isMounted || !Array.isArray(backendFacs)) return
        backendFacs.forEach((bf) => {
          const cleanBf = sanitizeFacilityStrings(bf)
          const matching = facilitiesList.find(
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
                status: cleanBf.status === "maintenance" ? "maintenance" : "active",
                units: 20,
                available: 20,
                occupied: 0,
              },
              user,
            )
          } else if (
            matching.name !== cleanBf.name ||
            matching.address !== cleanBf.address ||
            matching.city !== cleanBf.city
          ) {
            updateFacility(matching.id, {
              name: cleanBf.name,
              address: cleanBf.address,
              city: cleanBf.city,
            })
          }
        })
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  const getFacilityOccupiedCount = useCallback(
    (fac: any) => {
      if (!fac) return 0
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
    [unitsList],
  )

  const getFacilityTotalUnits = useCallback(
    (fac: any) => {
      if (!fac) return 0
      const facUnits = unitsList.filter(
        (u) => u.facilityId === fac.id || u.facilityId === fac.code,
      )
      return facUnits.length > 0 ? facUnits.length : fac.units || 0
    },
    [unitsList],
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
    {
      id: "facilities",
      label: "Quản lý cơ sở",
      icon: Icon.building,
      group: "Danh mục",
      permission: "facilities:read",
    },

    {
      id: "performance",
      label: "Hiệu suất vận hành",
      icon: Icon.eye,
      group: "Danh mục",
      permission: "reports:read",
    },

    {
      id: "policies",
      label: "Chính sách thuê",
      icon: Icon.policy,
      group: "Thương mại",
      permission: "policies:read",
    },

    {
      id: "pricing",
      label: "Bảng giá & Phí",
      icon: Icon.dollar,
      group: "Thương mại",
      permission: "policies:read",
    },

    // Ẩn tab Khuyến mãi & Voucher trên UI (giữ nguyên logic nghiệp vụ bên dưới)

    // { id: 'discounts', label: 'Khuyến mãi & Voucher', icon: Icon.tag, group: 'Thương mại', permission: 'policies:read' },

    {
      id: "revenue",
      label: "Báo cáo doanh thu",
      icon: Icon.chart,
      group: "Báo cáo",
      permission: "reports:read",
    },
  ]

  const [page, setPage] = useState(() => getInitialPage(NAV, "facilities"))

  const [pricingModal, setPricingModal] = useState(false)

  const [discountModal, setDiscountModal] = useState(false)

  const [policiesList, setPoliciesList] = useState<PolicyItem[]>(() => {
    try {
      const stored = localStorage.getItem("storagehub:policies")

      if (stored) {
        const parsed = JSON.parse(stored)

        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((item: PolicyItem) => {
            const name = (item.name || "").trim().toLowerCase()
            const desc = (item.description || "").trim().toLowerCase()
            const scope = (item.scope || "").trim().toLowerCase()
            if (name.includes("trốn thuế") || desc === "abc" || name === "test") return false
            if ((name === "thời gian gia hạn" || name === "thoi gian gia han") && (desc === "abc" || !desc)) return false
            if (scope.includes("vũng tàu") && (desc === "abc" || name === "test" || !name)) return false
            return true
          })

          return valid.map((item: PolicyItem) => {
            const def = (DEMO_DATA_ENABLED ? POLICIES : []).find(p => p.id === item.id)
            if (def && (!item.description || item.value === '650.000 ₫ / month' || item.value === '5 days' || item.name === 'Grace Period' || item.name === 'Thời gian gia hạn nợ')) {
              return { ...item, name: def.name, value: def.value, description: item.description || def.description }
            }
            return item
          })
        }
      }
    } catch {
      // fallback
    }

    return (DEMO_DATA_ENABLED ? POLICIES : []).map((p) => ({ ...p, description: p.description || "" }))
  })

  const [policyModal, setPolicyModal] = useState(false)

  const [createPolicyModal, setCreatePolicyModal] = useState(false)

  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null)

  const [policyFormName, setPolicyFormName] = useState("")

  const [policyFormValue, setPolicyFormValue] = useState("")

  const [policyFormScope, setPolicyFormScope] = useState("Toàn bộ cơ sở")

  const [policyFormScopeType, setPolicyFormScopeType] = useState<'all' | 'specific'>('all')

  const [policyFormFacilityIds, setPolicyFormFacilityIds] = useState<string[]>([])

  const [policyFacilityFilter, setPolicyFacilityFilter] = useState<string>('all')

  const filteredPoliciesList = useMemo(() => {
    if (policyFacilityFilter === 'all') return policiesList
    const targetFac = facilitiesList.find((f) => f.id === policyFacilityFilter)
    if (!targetFac) return policiesList

    return policiesList.filter((p) => {
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
  }, [policiesList, policyFacilityFilter, facilitiesList])

  const [policyFormDesc, setPolicyFormDesc] = useState("")

  const savePolicies = (next: PolicyItem[]) => {
    setPoliciesList(next)

    localStorage.setItem("storagehub:policies", JSON.stringify(next))
  }

  const handleOpenCreatePolicy = () => {
    setPolicyFormName("")

    setPolicyFormValue("")

    setPolicyFormScopeType("all")

    setPolicyFormFacilityIds([])

    setPolicyFormScope(lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities")

    setPolicyFormDesc("")

    setCreatePolicyModal(true)
  }

  const handleSaveNewPolicy = () => {
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

      scope: computedScope,

      scopeType: policyFormScopeType,

      facilityIds: policyFormScopeType === 'specific' ? policyFormFacilityIds : [],

      editable: true,

      description: policyFormDesc.trim(),

      lastUpdated: new Date().toLocaleDateString("vi-VN"),
    }

    const next = [...policiesList, newPolicy]

    savePolicies(next)

    // Đồng bộ cấu hình vận hành hệ thống nếu chính sách liên quan
    const lowerName = newPolicy.name.toLowerCase()
    if (lowerName.includes("grace") || lowerName.includes("gia hạn") || lowerName.includes("ân hạn")) {
      const num = parseInt(newPolicy.value.replace(/\D/g, ""), 10)
      if (!isNaN(num) && num > 0) {
        try { updateBusinessConfig({ gracePeriodDays: num }, user) } catch { }
      }
    } else if (lowerName.includes("late") || lowerName.includes("trễ")) {
      const num = parseInt(newPolicy.value.replace(/\D/g, ""), 10)
      try { updateBusinessConfig({ lateFeeAmount: !isNaN(num) && num > 0 ? num : 650000 }, user) } catch { }
    } else if (lowerName.includes("deposit") || lowerName.includes("đặt cọc")) {
      try { updateBusinessConfig({ defaultDepositRatio: 0.4 }, user) } catch { }
    }

    setCreatePolicyModal(false)

    showToast(
      lang === "vi"
        ? `Đã thêm chính sách "${newPolicy.name}" thành công!`
        : `Policy added successfully!`,
    )
  }

  const handleOpenEditPolicy = (policy: PolicyItem) => {
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

    let detectedScopeType: 'all' | 'specific' = 'all'
    let detectedFacilityIds: string[] = []

    if (policy.scopeType) {
      detectedScopeType = policy.scopeType
      detectedFacilityIds = policy.facilityIds || []
    } else if (policy.facilityIds && policy.facilityIds.length > 0) {
      detectedScopeType = 'specific'
      detectedFacilityIds = policy.facilityIds
    } else {
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

  const handleUpdatePolicy = () => {
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

          scope: computedScope,

          scopeType: policyFormScopeType,

          facilityIds: policyFormScopeType === 'specific' ? policyFormFacilityIds : [],

          description: policyFormDesc.trim(),

          lastUpdated: new Date().toLocaleDateString("vi-VN"),
        }
        : p,
    )

    savePolicies(next)

    // Đồng bộ cấu hình vận hành hệ thống nếu chính sách liên quan
    const lowerName = (policyFormName || selectedPolicy.name).toLowerCase()
    if (lowerName.includes("grace") || lowerName.includes("gia hạn") || lowerName.includes("ân hạn")) {
      const num = parseInt(policyFormValue.replace(/\D/g, ""), 10)
      if (!isNaN(num) && num > 0) {
        try { updateBusinessConfig({ gracePeriodDays: num }, user) } catch { }
      }
    } else if (lowerName.includes("late") || lowerName.includes("trễ")) {
      const num = parseInt(policyFormValue.replace(/\D/g, ""), 10)
      try { updateBusinessConfig({ lateFeeAmount: !isNaN(num) && num > 0 ? num : 650000 }, user) } catch { }
    } else if (lowerName.includes("deposit") || lowerName.includes("đặt cọc")) {
      try { updateBusinessConfig({ defaultDepositRatio: 0.4 }, user) } catch { }
    }

    setPolicyModal(false)

    showToast(
      lang === "vi"
        ? "Cập nhật chính sách thành công!"
        : "Policy updated successfully!",
    )
  }

  const handleDeletePolicy = (policyId: string) => {
    const target = policiesList.find((p) => p.id === policyId)

    if (!target) return

    if (
      window.confirm(
        lang === "vi"
          ? `Bạn có chắc chắn muốn xóa chính sách "${target.name}"?`
          : `Delete policy "${target.name}"?`,
      )
    ) {
      const next = policiesList.filter((p) => p.id !== policyId)

      savePolicies(next)

      showToast(
        lang === "vi"
          ? `Đã xóa chính sách "${target.name}"!`
          : `Policy deleted!`,
      )
    }
  }

  const [durationDiscounts, setDurationDiscounts] = useState<DurationDiscountItem[]>(() => {
    try {
      const stored = localStorage.getItem("storagehub:durationDiscounts")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sanitize any test data where discountPercent was set to 50% on 3m, or missing renewalDiscount
          let sanitized = parsed.map((item: DurationDiscountItem) => {
            if (item.id === "pkg-3m" && item.discountPercent === 50) {
              return {
                ...item,
                discountPercent: 3,
                renewalDiscountPercent: 2,
                description: "Giảm 3% khi ký hợp đồng mới từ 3 tháng và giảm 2% khi gia hạn hợp đồng.",
                appliesTo: "Đặt mới & Gia hạn",
              }
            }
            if (item.id === "pkg-3m" && (item.renewalDiscountPercent === 0 || item.renewalDiscountPercent === undefined)) {
              return { ...item, renewalDiscountPercent: 2, appliesTo: "Đặt mới & Gia hạn" }
            }
            if (item.id === "pkg-other" || item.months === "other") {
              return {
                ...item,
                title: "Kỳ hạn khác (dưới 3 tháng hoặc linh hoạt)",
                label: "Dưới 3 tháng / Khác",
                discountPercent: 0,
                renewalDiscountPercent: 0,
                description: "Áp dụng cho các kỳ hạn dưới 3 tháng (1-2 tháng) hoặc thời hạn linh hoạt. Không áp dụng chiết khấu kỳ hạn.",
                appliesTo: "Không áp dụng giảm",
              }
            }
            return item
          })

          if (!sanitized.some((p: DurationDiscountItem) => p.id === "pkg-24m" || p.months === 24)) {
            const pkg24: DurationDiscountItem = {
              id: "pkg-24m",
              months: 24,
              title: "Gói thuê 24 tháng (2 năm)",
              label: "24 tháng",
              discountPercent: 12,
              renewalDiscountPercent: 8,
              description: "Giảm 12% cho hợp đồng dài hạn 2 năm và giảm 8% khi khách gia hạn kỳ hạn 24 tháng.",
              appliesTo: "Đặt mới & Gia hạn",
              status: "active",
            }
            const otherIdx = sanitized.findIndex((p: DurationDiscountItem) => p.id === "pkg-other")
            if (otherIdx !== -1) {
              const updated = [...sanitized]
              updated.splice(otherIdx, 0, pkg24)
              return updated
            }
            return [...sanitized, pkg24]
          }
          return sanitized
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_DURATION_DISCOUNTS
  })

  // ── QUẢN LÝ GÓI THUÊ & CHIẾT KHẤU KỲ HẠN ──
  const [createDurationModal, setCreateDurationModal] = useState(false)
  const [formCreateDurationTitle, setFormCreateDurationTitle] = useState("")
  const [formCreateDurationLabel, setFormCreateDurationLabel] = useState("")
  const [formCreateDurationMonths, setFormCreateDurationMonths] = useState<number | string>(9)
  const [formCreateDurationPercent, setFormCreateDurationPercent] = useState<number>(6)
  const [formCreateDurationRenewalPercent, setFormCreateDurationRenewalPercent] = useState<number>(4)
  const [formCreateDurationAppliesTo, setFormCreateDurationAppliesTo] = useState("Đặt mới & Gia hạn")
  const [formCreateDurationScopeType, setFormCreateDurationScopeType] = useState<'all' | 'specific'>('all')
  const [formCreateDurationFacilityIds, setFormCreateDurationFacilityIds] = useState<string[]>([])
  const [formCreateDurationDesc, setFormCreateDurationDesc] = useState("")
  const [formCreateDurationStatus, setFormCreateDurationStatus] = useState<'active' | 'inactive'>('active')

  const [editDurationModal, setEditDurationModal] = useState(false)
  const [selectedDurationItem, setSelectedDurationItem] = useState<DurationDiscountItem | null>(null)
  const [formDurationTitle, setFormDurationTitle] = useState("")
  const [formDurationLabel, setFormDurationLabel] = useState("")
  const [formDurationPercent, setFormDurationPercent] = useState<number>(0)
  const [formDurationRenewalPercent, setFormDurationRenewalPercent] = useState<number>(0)
  const [formDurationAppliesTo, setFormDurationAppliesTo] = useState("Đặt mới & Gia hạn")
  const [formDurationScopeType, setFormDurationScopeType] = useState<'all' | 'specific'>('all')
  const [formDurationFacilityIds, setFormDurationFacilityIds] = useState<string[]>([])
  const [formDurationDesc, setFormDurationDesc] = useState<string>("")
  const [formDurationStatus, setFormDurationStatus] = useState<'active' | 'inactive'>('active')

  const handleOpenCreateDuration = () => {
    setFormCreateDurationTitle("")
    setFormCreateDurationLabel("")
    setFormCreateDurationMonths(9)
    setFormCreateDurationPercent(6)
    setFormCreateDurationRenewalPercent(4)
    setFormCreateDurationAppliesTo("Đặt mới & Gia hạn")
    setFormCreateDurationScopeType("all")
    setFormCreateDurationFacilityIds([])
    setFormCreateDurationDesc("")
    setFormCreateDurationStatus("active")
    setCreateDurationModal(true)
  }

  const handleSaveNewDurationDiscount = () => {
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
      description: formCreateDurationDesc.trim() || `Giảm ${formCreateDurationPercent}% cho hợp đồng mới và giảm ${formCreateDurationRenewalPercent}% khi gia hạn ${label}.`,
      appliesTo: formCreateDurationAppliesTo,
      status: formCreateDurationStatus,
      scopeType: formCreateDurationScopeType,
      facilityIds: formCreateDurationScopeType === 'specific' ? formCreateDurationFacilityIds : [],
    }

    const next = [...durationDiscounts, newPkg]
    setDurationDiscounts(next)
    localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
    setCreateDurationModal(false)
    showToast(lang === 'vi' ? `Đã tạo gói thuê "${newPkg.title}" thành công!` : `Created package "${newPkg.title}"!`)
  }

  const handleOpenEditDuration = (item: DurationDiscountItem) => {
    setSelectedDurationItem(item)
    setFormDurationTitle(item.title)
    setFormDurationLabel(item.label)
    setFormDurationPercent(item.discountPercent)
    setFormDurationRenewalPercent(item.renewalDiscountPercent)
    setFormDurationAppliesTo(item.appliesTo || "Đặt mới & Gia hạn")
    setFormDurationScopeType(item.scopeType || "all")
    setFormDurationFacilityIds(item.facilityIds || [])
    setFormDurationDesc(item.description)
    setFormDurationStatus(item.status)
    setEditDurationModal(true)
  }

  const handleSaveDurationDiscount = () => {
    if (!selectedDurationItem) return

    if (formDurationScopeType === 'specific' && formDurationFacilityIds.length === 0) {
      showToast(lang === 'vi' ? 'Vui lòng chọn ít nhất 1 cơ sở áp dụng gói thuê này!' : 'Please select at least one facility!')
      return
    }

    const next = durationDiscounts.map((d) => {
      if (d.id === selectedDurationItem.id) {
        return {
          ...d,
          title: formDurationTitle.trim() || d.title,
          label: formDurationLabel.trim() || d.label,
          discountPercent: Math.max(0, Math.min(100, Number(formDurationPercent) || 0)),
          renewalDiscountPercent: Math.max(0, Math.min(100, Number(formDurationRenewalPercent) || 0)),
          appliesTo: formDurationAppliesTo,
          scopeType: formDurationScopeType,
          facilityIds: formDurationScopeType === 'specific' ? formDurationFacilityIds : [],
          description: formDurationDesc.trim() || d.description,
          status: formDurationStatus,
        }
      }
      return d
    })
    setDurationDiscounts(next)
    localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
    setEditDurationModal(false)
    showToast(
      lang === "vi"
        ? `Đã cập nhật cấu hình cho ${formDurationTitle.trim() || selectedDurationItem.title}!`
        : `Updated package ${selectedDurationItem.title}!`,
    )
  }

  const handleDeleteDurationDiscount = (id: string) => {
    const item = durationDiscounts.find((d) => d.id === id)
    if (!item) return

    if (window.confirm(lang === 'vi' ? `Bạn có chắc muốn xóa gói "${item.title}"?` : `Delete package "${item.title}"?`)) {
      const next = durationDiscounts.filter((d) => d.id !== id)
      setDurationDiscounts(next)
      localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
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
    localStorage.setItem("storagehub:durationDiscounts", JSON.stringify(next))
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

  // Map ngày thanh toán vào tháng báo cáo (Tháng 4 – Tháng 9)
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
      const isSeed =
        fac.id === "fac-001" ||
        fac.id === "fac-002" ||
        fac.code === "HCM-Q1-F01" ||
        fac.code === "BD-F01"

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

      if (isSeed) {
        return (fac.revenue || 0) + facPaid
      }
      return facPaid
    },
    [holdsList, rentalsList, paymentsList, isFacilityMatching],
  )

  const activeRevenueData: MonthlyRevenueRecord[] = useMemo(() => {
    if (!selectedRevenueFacility) {
      // "Toàn bộ cơ sở": Giữ nguyên số liệu REVENUE_DATA chuẩn của hệ thống demo,
      // cộng thêm các khoản thanh toán thực tế mới phát sinh từ các cơ sở mới
      const newFacilityPaidPayments = (paymentsList || []).filter((p) => {
        if (p.status !== "PAID" || p.type === "REFUND") return false
        const isSeedPayment = (rentalsList || []).some(
          (r) =>
            (r.id === p.rentalId || r.holdId === p.reservationId) &&
            (r.facilityId === "fac-001" ||
              r.facilityId === "fac-002" ||
              r.facilityName?.includes("Quận 1") ||
              r.facilityName?.includes("Bình Dương")),
        )
        return !isSeedPayment
      })

      return RUNTIME_REVENUE_DATA.map((item) => {
        const extraRevenue = newFacilityPaidPayments.reduce((sum, p) => {
          if (
            getPaymentReportingMonth(p.paidAt || p.receivedAt) === item.month
          ) {
            return sum + (p.amount || 0)
          }
          return sum
        }, 0)

        return {
          ...item,
          revenue: item.revenue + extraRevenue,
        }
      })
    }

    const isQ1 =
      selectedRevenueFacility.id === "fac-001" ||
      selectedRevenueFacility.code === "HCM-Q1-F01" ||
      selectedRevenueFacility.name?.includes("Quận 1")

    const isBD =
      selectedRevenueFacility.id === "fac-002" ||
      selectedRevenueFacility.code === "BD-F01" ||
      selectedRevenueFacility.name?.includes("Bình Dương")

    if (isQ1) {
      // Cơ sở Quận 1: Khớp nối 3 hợp đồng thực tế (S: 5.5M, M: 9.5M, L: 15.0M -> MTD 30.000.000 đ)
      // T4: 2 HĐ (S + L = 20.500.000 đ, 9% lấp đầy)
      // T5 - T9: 3 HĐ (S + M + L = 30.000.000 đ, 13% lấp đầy)
      const q1Base: MonthlyRevenueRecord[] = [
        { month: "Tháng 4", revenue: 20500000, growth: "—", growthNumber: 0, contracts: 2, occupancyRate: "9%", occupancyNumber: 2 / 23 },
        { month: "Tháng 5", revenue: 30000000, growth: "+46,3%", growthNumber: 0.463, contracts: 3, occupancyRate: "13%", occupancyNumber: 3 / 23 },
        { month: "Tháng 6", revenue: 30000000, growth: "0%", growthNumber: 0, contracts: 3, occupancyRate: "13%", occupancyNumber: 3 / 23 },
        { month: "Tháng 7", revenue: 30000000, growth: "0%", growthNumber: 0, contracts: 3, occupancyRate: "13%", occupancyNumber: 3 / 23 },
        { month: "Tháng 8", revenue: 30000000, growth: "0%", growthNumber: 0, contracts: 3, occupancyRate: "13%", occupancyNumber: 3 / 23 },
        { month: "Tháng 9", revenue: 30000000, growth: "0%", growthNumber: 0, contracts: 3, occupancyRate: "13%", occupancyNumber: 3 / 23 },
      ]

      return q1Base.map((item) => {
        const extraMonthPaid = selectedFacilityPaidPayments
          .filter(
            (p) =>
              getPaymentReportingMonth(p.paidAt || p.receivedAt) === item.month,
          )
          .reduce((sum, p) => sum + (p.amount || 0), 0)

        return {
          ...item,
          revenue: item.revenue + extraMonthPaid,
        }
      })
    }

    if (isBD) {
      // Cơ sở Bình Dương: 5 gian kho lấp đầy -> MTD 57.500.000 đ (25% lấp đầy)
      const bdBase: MonthlyRevenueRecord[] = [
        { month: "Tháng 4", revenue: 48000000, growth: "—", growthNumber: 0, contracts: 4, occupancyRate: "20%", occupancyNumber: 4 / 20 },
        { month: "Tháng 5", revenue: 52000000, growth: "+8,3%", growthNumber: 0.083, contracts: 4, occupancyRate: "20%", occupancyNumber: 4 / 20 },
        { month: "Tháng 6", revenue: 55000000, growth: "+5,8%", growthNumber: 0.058, contracts: 5, occupancyRate: "25%", occupancyNumber: 5 / 20 },
        { month: "Tháng 7", revenue: 56000000, growth: "+1,8%", growthNumber: 0.018, contracts: 5, occupancyRate: "25%", occupancyNumber: 5 / 20 },
        { month: "Tháng 8", revenue: 57000000, growth: "+1,8%", growthNumber: 0.018, contracts: 5, occupancyRate: "25%", occupancyNumber: 5 / 20 },
        { month: "Tháng 9", revenue: 57500000, growth: "+0,9%", growthNumber: 0.009, contracts: 5, occupancyRate: "25%", occupancyNumber: 5 / 20 },
      ]

      return bdBase.map((item) => {
        const extraMonthPaid = selectedFacilityPaidPayments
          .filter(
            (p) =>
              getPaymentReportingMonth(p.paidAt || p.receivedAt) === item.month,
          )
          .reduce((sum, p) => sum + (p.amount || 0), 0)

        return {
          ...item,
          revenue: item.revenue + extraMonthPaid,
        }
      })
    }

    // ── CƠ SỞ MỚI ĐƯỢC TẠO: ──
    // Doanh thu PHẢI dựa trên thanh toán thực tế (status === 'PAID')
    // Nếu chưa có giao dịch thanh toán thành công, doanh thu của cơ sở BẮT BUỘC PHẢI = 0 ₫!
    const facOccPct =
      selectedRevenueFacility.units > 0 && selectedRevenueFacility.occupied > 0
        ? Math.round(
          (selectedRevenueFacility.occupied /
            selectedRevenueFacility.units) *
          100,
        )
        : 0

    const activeContractsCount = Math.max(
      selectedRevenueFacility.occupied || 0,
      selectedFacilityContracts.length,
      selectedFacilityRentals.length,
    )

    let previousMonthRevenue = 0

    return RUNTIME_REVENUE_DATA.map((item, idx) => {
      // Khoản thanh toán thực tế đã thu trong tháng
      const monthPayments = selectedFacilityPaidPayments.filter(
        (p) =>
          getPaymentReportingMonth(p.paidAt || p.receivedAt) === item.month,
      )
      const monthRevenue = monthPayments.reduce(
        (sum, p) => sum + (p.amount || 0),
        0,
      )

      // Số hợp đồng:
      // Các tháng quá khứ (Tháng 4 - 8): 0 (do cơ sở mới được tạo, quá khứ chưa thành lập)
      // Tháng 9 (tháng hiện tại): Hiển thị số hợp đồng thực tế đã ký / hồ sơ thuê (nếu có)
      const monthContracts =
        idx === RUNTIME_REVENUE_DATA.length - 1 ? activeContractsCount : 0

      // Tỷ lệ lấp đầy:
      const monthOccRate =
        idx === RUNTIME_REVENUE_DATA.length - 1 && facOccPct > 0
          ? `${facOccPct}%`
          : "0%"
      const monthOccNumber =
        idx === RUNTIME_REVENUE_DATA.length - 1 && facOccPct > 0 ? facOccPct / 100 : 0

      // Tính tăng trưởng so với tháng trước
      let growthStr = "—"
      let growthNum = 0
      if (idx > 0) {
        if (previousMonthRevenue === 0 && monthRevenue > 0) {
          growthStr = "+100%"
          growthNum = 1
        } else if (previousMonthRevenue > 0 && monthRevenue === 0) {
          growthStr = "-100%"
          growthNum = -1
        } else if (previousMonthRevenue > 0 && monthRevenue > 0) {
          const diff =
            ((monthRevenue - previousMonthRevenue) / previousMonthRevenue) *
            100
          growthStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}%`
          growthNum = diff / 100
        }
      }

      previousMonthRevenue = monthRevenue

      return {
        month: item.month,
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
    rentalsList,
    selectedFacilityPaidPayments,
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
    try {
      const stored = localStorage.getItem("storagehub:pricingTiers")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
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

  const handleOpenFacilityPriceModal = (fac: any) => {
    setEditingPriceFacility(fac)
    const currentOverrides = facilityPricingOverrides[fac.id] || {}
    setFacilityPricesForm({
      S: currentOverrides["tier-1"]?.basePrice ?? 5500000,
      M: currentOverrides["tier-2"]?.basePrice ?? 9500000,
      L: currentOverrides["tier-3"]?.basePrice ?? 15000000,
      XL: currentOverrides["tier-4"]?.basePrice ?? 22500000,
    })
    setFacilityMultiplierForm({
      S: currentOverrides["tier-1"]?.highDemandMultiplier ?? 1.0,
      M: currentOverrides["tier-2"]?.highDemandMultiplier ?? 1.0,
      L: currentOverrides["tier-3"]?.highDemandMultiplier ?? 1.0,
      XL: currentOverrides["tier-4"]?.highDemandMultiplier ?? 1.0,
    })
    setFacilityPriceModalOpen(true)
  }

  const handleSaveFacilityPrices = () => {
    if (!editingPriceFacility) return
    const facId = editingPriceFacility.id
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
    } catch {}

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
        } catch {}
      })
    })

    try {
      updateFacility(facId, { price: `${formatCurrency(facilityPricesForm.S)}` }, user)
    } catch {}

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
    } catch {}
    setFacilityPriceModalOpen(false)
    showToast(
      lang === "vi"
        ? `Đã khôi phục giá mặc định cho "${editingPriceFacility.name}"!`
        : `Reset pricing for ${editingPriceFacility.name}!`,
    )
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
    [facilityPricingOverrides, unitsList, pricingTiers],
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
    const parsedPrice = Number(formTierBasePrice)
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

  // Discounts & Promotions interactive state

  const [promotionsList, setPromotionsList] =
    useState<PromotionItem[]>(RUNTIME_DISCOUNTS)

  const [promoTab, setPromoTab] = useState("All")

  const [promoSearch, setPromoSearch] = useState("")

  const [newPromoCode, setNewPromoCode] = useState("SPECIAL20")

  const [newPromoName, setNewPromoName] = useState("")

  const [newPromoDesc, setNewPromoDesc] = useState("")

  const [newPromoType, setNewPromoType] =
    useState<"percentage" | "fixed-amount" | "first-month-free" | "seasonal">(
      "percentage",
    )

  const [newPromoValue, setNewPromoValue] = useState("20% OFF")

  const [newPromoMaxUses, setNewPromoMaxUses] = useState("50")

  const [newPromoMinMonths, setNewPromoMinMonths] = useState("3")

  const [newPromoExpiry, setNewPromoExpiry] = useState("2026-12-31")

  // ── State Quản Lý Cơ Sở (CRUD Facilities qua StorageHubContext) ──

  const [createFacilityModal, setCreateFacilityModal] = useState<boolean>(false)

  const [editFacilityModal, setEditFacilityModal] = useState<boolean>(false)

  const [deleteFacilityModal, setDeleteFacilityModal] = useState<boolean>(false)

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

  const [formFacImage, setFormFacImage] = useState<string>(
    WAREHOUSE_PHOTO_PRESETS[0].url,
  )
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
    "06:00 - 22:00 hàng ngày",
  )

  const [formFacStatus, setFormFacStatus] = useState<"active" | "maintenance">(
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

  // Toast

  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)

    setTimeout(() => setToast(null), 3000)
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

  // Tự động gợi ý mã cơ sở chuẩn theo tỉnh/thành phố

  const suggestFacilityCode = (cityName: string) => {
    let prefix = "FAC"

    const lower = cityName.toLowerCase()

    if (lower.includes("hà nội") || lower.includes("ha noi")) prefix = "HN"
    else if (
      lower.includes("hồ chí minh") ||
      lower.includes("hcm") ||
      lower.includes("sài gòn") ||
      lower.includes("q1") ||
      lower.includes("quận")
    )
      prefix = "HCM"
    else if (lower.includes("bình dương") || lower.includes("binh duong"))
      prefix = "BD"
    else if (lower.includes("đà nẵng") || lower.includes("da nang"))
      prefix = "DN"
    else if (lower.includes("hải phòng") || lower.includes("hai phong"))
      prefix = "HP"
    else if (lower.includes("cần thơ") || lower.includes("can tho"))
      prefix = "CT"
    else if (lower.includes("đồng nai") || lower.includes("dong nai"))
      prefix = "DNAI"
    else {
      prefix =
        cityName
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .toUpperCase() || "FAC"
    }

    const regex = new RegExp(`^${prefix}-F?(\\d+)`, "i")

    const existingNums = facilitiesList

      .map((f) => (f.code || f.id || "").toUpperCase())

      .map((c) => {
        const m = c.match(regex)

        return m ? parseInt(m[1], 10) : 0
      })

      .filter((n) => n > 0)

    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1

    return `${prefix}-F${String(nextNum).padStart(2, "0")}`
  }

  // Mở modal thêm cơ sở mới với dữ liệu mẫu trực quan

  const handleOpenCreateFacility = () => {
    const defaultCity = "Hà Nội"

    const autoCode = suggestFacilityCode(defaultCity)

    setFormFacCode(autoCode)

    setFormFacName("Kho Việt – Cơ sở Hà Nội")

    setFormFacAddress("Số 123 Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy")

    setFormFacCity(defaultCity)

    setFormFacManager("Trần Văn Quản Lý")

    setFormFacPhone("024 3822 9999")

    setFormFacUnitS(0)

    setFormFacUnitM(0)

    setFormFacUnitL(0)

    setFormFacUnitXL(0)

    setFormFacUnits(0)

    setFormFacPriceS("5.500.000đ")
    setFormFacPriceM("9.500.000đ")
    setFormFacPriceL("15.000.000đ")
    setFormFacPriceXL("22.500.000đ")
    setFormFacPrice("5.500.000đ")

    setFormFacLoadS(1000)
    setFormFacLoadM(1600)
    setFormFacLoadL(2800)
    setFormFacLoadXL(4000)

    setFormFacLengthS(UNIT_SPECS.S.lengthM)
    setFormFacLengthM(UNIT_SPECS.M.lengthM)
    setFormFacLengthL(UNIT_SPECS.L.lengthM)
    setFormFacLengthXL(UNIT_SPECS.XL.lengthM)

    setFormFacWidthS(UNIT_SPECS.S.widthM)
    setFormFacWidthM(UNIT_SPECS.M.widthM)
    setFormFacWidthL(UNIT_SPECS.L.widthM)
    setFormFacWidthXL(UNIT_SPECS.XL.widthM)

    setFormFacLaneS(UNIT_SPECS.S.vehicleLaneWidthM)
    setFormFacLaneM(UNIT_SPECS.M.vehicleLaneWidthM)
    setFormFacLaneL(UNIT_SPECS.L.vehicleLaneWidthM)
    setFormFacLaneXL(UNIT_SPECS.XL.vehicleLaneWidthM)

    setFormFacImage(WAREHOUSE_PHOTO_PRESETS[0].url)

    setFormFacClimate(false)

    setFormFacSecurity("Khóa riêng tự quản, Bảo vệ cổng")

    setFormFacAccessHours("06:00 - 22:00 hàng ngày")

    setFormFacStatus("active")

    const defaultSpecs = DEFAULT_FACILITY_UNIT_SPECS.map((s) => ({
      ...s,
      count: 5,
      rentalPackages: generateDefaultRentalPackages('', s.sizeCode, s.monthlyPrice),
    }))
    setFormFacUnitSpecs(defaultSpecs)
    setFormFacUnits(20)
    setFormFacUnitS(5)
    setFormFacUnitM(5)
    setFormFacUnitL(5)
    setFormFacUnitXL(5)

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

    if (totalCalculatedUnits <= 0) {
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
    try {
      const unitSpecsPayload = formFacUnitSpecs.map((s) => ({
        sizeCode: s.sizeCode,
        name: s.name,
        count: s.count,
        monthlyPrice: s.monthlyPrice,
        lengthM: s.lengthM,
        widthM: s.widthM,
        heightM: s.heightM,
        maxLoadKg: s.maxLoadKg,
      }))

      const apiRes = await createFacilityApi({
        code,
        name: formFacName.trim(),
        address: formFacAddress.trim(),
        city: formFacCity.trim(),
        status: formFacStatus,
        unitSpecs: unitSpecsPayload,
      })
      if (apiRes?.id) {
        backendFacilityId = apiRes.id
      }
    } catch (err) {
      console.warn("Backend create facility API failed/offline:", err)
    }

    const created = createFacility(
      {
        id: backendFacilityId,
        code,

        name: formFacName.trim(),

        address: formFacAddress.trim(),

        city: formFacCity.trim(),

        manager: formFacManager.trim() || "Quản lý cơ sở",

        phone: formFacPhone.trim() || "1900 6868",

        units: totalCalculatedUnits,

        unitDistribution,

        price: (() => {
          const parsed = parseInt(formFacPrice.replace(/\D/g, ""), 10)
          return !isNaN(parsed) && parsed > 0
            ? `${Math.round(parsed).toLocaleString("vi-VN")}đ`
            : `${Math.round(minPrice).toLocaleString("vi-VN")}đ`
        })(),

        unitPrices: newUnitPrices,

        unitLoadLimits,

        unitDimensions,

        unitLaneWidths,

        unitFrameCounts,

        unitFrameDimensions,

        unitCustomSpecs: formFacUnitSpecs,

        totalDesignLoadTon,

        image: formFacImage || WAREHOUSE_PHOTO_PRESETS[0].url,

        climate: formFacClimate,

        security: formFacSecurity,

        accessHours: formFacAccessHours,

        status: formFacStatus,

        occupied: 0,

        available: totalCalculatedUnits,

        revenue: 0,

        growth: 0,
      },
      user,
    )

    // Đồng bộ vào facilityPricingOverrides
    const nextOverrides = {
      ...facilityPricingOverrides,
      [created.id]: {
        "tier-1": { basePrice: pS, highDemandMultiplier: 1.15 },
        "tier-2": { basePrice: pM, highDemandMultiplier: 1.15 },
        "tier-3": { basePrice: pL, highDemandMultiplier: 1.15 },
        "tier-4": { basePrice: pXL, highDemandMultiplier: 1.15 },
      },
    }
    setFacilityPricingOverrides(nextOverrides)
    try {
      localStorage.setItem(
        "storagehub:facility-pricing",
        JSON.stringify(nextOverrides),
      )
    } catch { }

    setCreateFacilityModal(false)

    const breakdownStr =
      formFacUnitSpecs
        .filter((s) => s.count > 0)
        .map((s) => `${s.sizeCode}: ${s.count}`)
        .join(" · ") || `Tổng: ${created.units} kho`

    showToast(
      lang === "vi"
        ? `Đã thêm cơ sở "${created.name}" (${created.code}) với ${created.units} gian kho (${breakdownStr})!`
        : `Facility "${created.name}" created successfully!`,
    )
  }

  const handleOpenEditFacility = (f: any) => {
    setSelectedFacility(f)

    setFormFacCode(f.code || f.id)

    setFormFacName(f.name)

    setFormFacAddress(f.address)

    setFormFacCity(f.city)

    setFormFacManager(f.manager)

    setFormFacPhone(f.phone || "1900 6868")

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
    } else {
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
        const specFallback = UNIT_SPECS[s.sizeCode as keyof typeof UNIT_SPECS]
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
          monthlyPrice: f.unitPrices?.[s.sizeCode] ?? s.monthlyPrice ?? 5500000,
          lengthM: f.unitDimensions?.[s.sizeCode]?.lengthM ?? s.lengthM,
          widthM: f.unitDimensions?.[s.sizeCode]?.widthM ?? s.widthM,
          heightM: (f.unitDimensions?.[s.sizeCode] as any)?.heightM ?? s.heightM ?? 5,
          laneWidthM: f.unitLaneWidths?.[s.sizeCode] ?? s.laneWidthM ?? 4,
          maxLoadKg: f.unitLoadLimits?.[s.sizeCode] ?? s.maxLoadKg ?? 1000,
          frameCount: s.frameCount ?? f.unitFrameCounts?.[s.sizeCode] ?? specFallback?.frameCount ?? 0,
          frameDimensions: rawDims ? {
            lengthM: rawDims.lengthM ?? (rawDims as any).depthM ?? 1,
            widthM: rawDims.widthM ?? 1,
            heightM: rawDims.heightM ?? 1,
            depthM: (rawDims as any).depthM ?? rawDims.lengthM ?? 1,
          } : undefined
        }
      })
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
      1000
    const mLoad =
      f.unitLoadLimits?.M ??
      facUnits.find(
        (u) => ((u as any).size || (u.type === "Medium" ? "M" : "")) === "M",
      )?.maxLoadKg ??
      1600
    const lLoad =
      f.unitLoadLimits?.L ??
      facUnits.find(
        (u) => ((u as any).size || (u.type === "Large" ? "L" : "")) === "L",
      )?.maxLoadKg ??
      2800
    const xlLoad =
      f.unitLoadLimits?.XL ??
      facUnits.find(
        (u) =>
          ((u as any).size || (u.type === "Extra Large" ? "XL" : "")) === "XL",
      )?.maxLoadKg ??
      4000

    setFormFacLoadS(sLoad)
    setFormFacLoadM(mLoad)
    setFormFacLoadL(lLoad)
    setFormFacLoadXL(xlLoad)

    const sUnit = facUnits.find((u) => ((u as any).size || (u.type === "Small" ? "S" : "")) === "S")
    const mUnit = facUnits.find((u) => ((u as any).size || (u.type === "Medium" ? "M" : "")) === "M")
    const lUnit = facUnits.find((u) => ((u as any).size || (u.type === "Large" ? "L" : "")) === "L")
    const xlUnit = facUnits.find((u) => ((u as any).size || (u.type === "Extra Large" ? "XL" : "")) === "XL")

    const sLength = f.unitDimensions?.S?.lengthM ?? sUnit?.dimensions?.lengthM ?? UNIT_SPECS.S.lengthM
    const mLength = f.unitDimensions?.M?.lengthM ?? mUnit?.dimensions?.lengthM ?? UNIT_SPECS.M.lengthM
    const lLength = f.unitDimensions?.L?.lengthM ?? lUnit?.dimensions?.lengthM ?? UNIT_SPECS.L.lengthM
    const xlLength = f.unitDimensions?.XL?.lengthM ?? xlUnit?.dimensions?.lengthM ?? UNIT_SPECS.XL.lengthM

    const sWidth = f.unitDimensions?.S?.widthM ?? sUnit?.dimensions?.widthM ?? UNIT_SPECS.S.widthM
    const mWidth = f.unitDimensions?.M?.widthM ?? mUnit?.dimensions?.widthM ?? UNIT_SPECS.M.widthM
    const lWidth = f.unitDimensions?.L?.widthM ?? lUnit?.dimensions?.widthM ?? UNIT_SPECS.L.widthM
    const xlWidth = f.unitDimensions?.XL?.widthM ?? xlUnit?.dimensions?.widthM ?? UNIT_SPECS.XL.widthM

    setFormFacLengthS(sLength)
    setFormFacLengthM(mLength)
    setFormFacLengthL(lLength)
    setFormFacLengthXL(xlLength)

    setFormFacWidthS(sWidth)
    setFormFacWidthM(mWidth)
    setFormFacWidthL(lWidth)
    setFormFacWidthXL(xlWidth)

    const sLane = f.unitLaneWidths?.S ?? UNIT_SPECS.S.vehicleLaneWidthM
    const mLane = f.unitLaneWidths?.M ?? UNIT_SPECS.M.vehicleLaneWidthM
    const lLane = f.unitLaneWidths?.L ?? UNIT_SPECS.L.vehicleLaneWidthM
    const xlLane = f.unitLaneWidths?.XL ?? UNIT_SPECS.XL.vehicleLaneWidthM

    setFormFacLaneS(sLane)
    setFormFacLaneM(mLane)
    setFormFacLaneL(lLane)
    setFormFacLaneXL(xlLane)

    setFormFacImage(f.image || WAREHOUSE_PHOTO_PRESETS[0].url)

    setFormFacClimate(Boolean(f.climate))

    setFormFacSecurity(f.security || "Khóa riêng tự quản, Bảo vệ cổng")

    setFormFacAccessHours(
      f.accessHours || "06:00 - 22:00 hàng ngày",
    )

    setFormFacStatus(f.status)
    setEditValidationErrors([])
    setHighlightSpecCode(null)
    setEditFacilityModal(true)
  }

  const handleUpdateFacility = () => {
    if (!selectedFacility) return

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

    if (totalCalculatedUnits <= 0) {
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

    updateFacility(
      selectedFacility.id,
      {
        code,

        name: formFacName.trim(),

        address: formFacAddress.trim(),

        city: formFacCity.trim(),

        manager: formFacManager.trim(),

        phone: formFacPhone.trim(),

        units: totalCalculatedUnits,

        unitDistribution,

        price: finalPriceStr,

        unitPrices: updatedUnitPrices,

        unitLoadLimits,

        unitDimensions,

        unitLaneWidths,

        unitFrameCounts,

        unitFrameDimensions,

        unitCustomSpecs: formFacUnitSpecs,

        totalDesignLoadTon,

        image: formFacImage,

        climate: formFacClimate,

        security: formFacSecurity,

        accessHours: formFacAccessHours,

        status: formFacStatus,
      },
      user,
    )

    // Cập nhật facilityPricingOverrides để tab Bảng giá cũng đồng bộ
    const nextOverrides = {
      ...facilityPricingOverrides,
      [selectedFacility.id]: {
        ...facilityPricingOverrides[selectedFacility.id],
        "tier-1": { basePrice: pS, highDemandMultiplier: 1.15 },
        "tier-2": { basePrice: pM, highDemandMultiplier: 1.15 },
        "tier-3": { basePrice: pL, highDemandMultiplier: 1.15 },
        "tier-4": { basePrice: pXL, highDemandMultiplier: 1.15 },
      },
    }
    setFacilityPricingOverrides(nextOverrides)
    try {
      localStorage.setItem(
        "storagehub:facility-pricing",
        JSON.stringify(nextOverrides),
      )
    } catch { }

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

  const handleDeleteFacility = () => {
    if (!selectedFacility) return

    const result = deleteFacility(selectedFacility.id, user)

    if (!result.success) {
      showToast(
        lang === "vi"
          ? result.reason || "Không thể xóa cơ sở!"
          : result.reason || "Cannot delete facility!",
      )

      return
    }

    setDeleteFacilityModal(false)

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

  const totalUnits =
    unitsList.length || facilitiesList.reduce((s, f) => s + (f.units || 0), 0)

  const totalOccupied =
    unitsList.filter((u) => u.status === "occupied").length ||
    facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0)

  return (
    <Layout
      user={user}
      navItems={NAV}
      currentPage={page}
      onNavigate={setPage}
      onLogout={onLogout}
      canAccess={(permission) => (hub?.can ? hub.can(user, permission) : true)}
      roleLabel={"Giám Đốc Thương Mại"}
      roleColor="bg-amber-100 text-amber-700"
    >
      {/* ── QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ──────────────────── */}
      {page === "facilities" && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={lang === "vi" ? "Quản Lý Cơ Sở" : "Facility Management"}
            subtitle={
              lang === "vi"
                ? `${facilitiesList.length} cơ sở trong hệ thống – Thêm, sửa, xóa và theo dõi vận hành`
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <StatCard
              title={lang === "vi" ? "Tỷ lệ lấp đầy TB" : "Portfolio Occupancy"}
              value={`${totalUnits ? Math.round((totalOccupied / totalUnits) * 100) : 0
                }%`}
              icon={Icon.chart}
              iconBg="bg-green-50"
            />
            <StatCard
              title={
                lang === "vi" ? "Doanh thu tháng (MTD)" : "Total Revenue MTD"
              }
              value={formatCurrency(totalRevenue)}
              icon={Icon.dollar}
              iconBg="bg-amber-50"
            />
          </div>
          {/* Thanh Công Cụ: Tìm kiếm & Lọc Đa Tiêu Chí */}
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

                          {/* Hàng 2: Địa chỉ + Quản lý + Hotline + Giờ mở cửa */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-600">
                            <div className="flex items-start gap-1.5">
                              <span className="truncate" title={cleanF.address}>
                                {cleanF.address} ·{" "}
                                <b className="text-slate-800">{cleanF.city}</b>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span>
                                Quản lý:{" "}
                                <b className="text-slate-800">{cleanF.manager}</b>{" "}
                                {cleanF.phone ? `(${cleanF.phone})` : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="truncate"
                                title={cleanF.accessHours || "06:00 - 22:00"}
                              >
                                {cleanF.accessHours || "06:00 - 22:00 hàng ngày"}
                              </span>
                            </div>
                          </div>

                          {/* Hàng 2.5: Cơ cấu quy mô gian kho (S, M, L, XL) */}
                          {(() => {
                            const facUnits = unitsList.filter(
                              (u) =>
                                u.facilityId === f.id || u.facilityId === f.code,
                            )

                            const s =
                              f.unitDistribution?.S ??
                              facUnits.filter(
                                (u) =>
                                  ((u as any).size ||
                                    (u.type === "Small" ? "S" : "")) === "S",
                              ).length

                            const m =
                              f.unitDistribution?.M ??
                              facUnits.filter(
                                (u) =>
                                  ((u as any).size ||
                                    (u.type === "Medium" ? "M" : "")) === "M",
                              ).length

                            const l =
                              f.unitDistribution?.L ??
                              facUnits.filter(
                                (u) =>
                                  ((u as any).size ||
                                    (u.type === "Large" ? "L" : "")) === "L",
                              ).length

                            const xl =
                              f.unitDistribution?.XL ??
                              facUnits.filter(
                                (u) =>
                                  ((u as any).size ||
                                    (u.type === "Extra Large" ? "XL" : "")) ===
                                  "XL",
                              ).length

                            const totalLoad =
                              f.totalDesignLoadTon ??
                              Math.round(
                                ((s * (f.unitLoadLimits?.S ?? 1000)) +
                                  (m * (f.unitLoadLimits?.M ?? 1600)) +
                                  (l * (f.unitLoadLimits?.L ?? 2800)) +
                                  (xl * (f.unitLoadLimits?.XL ?? 4000))) /
                                1000 *
                                10,
                              ) / 10

                            return (
                              <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                                <span className="text-slate-400 font-medium text-[11px]">
                                  {lang === "vi"
                                    ? "Quy mô chi tiết:"
                                    : "Unit sizes:"}
                                </span>
                                {s > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[11px] font-semibold">
                                    {s} Kho Nhỏ (S)
                                  </span>
                                )}
                                {m > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-green-50 text-green-800 border border-green-200 font-mono text-[11px] font-semibold">
                                    {m} Kho Vừa (M)
                                  </span>
                                )}
                                {l > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-mono text-[11px] font-semibold">
                                    {l} Kho Lớn (L)
                                  </span>
                                )}
                                {xl > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-mono text-[11px] font-semibold">
                                    {xl} Kho Rất Lớn (XL)
                                  </span>
                                )}
                                {totalLoad > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-mono text-[11px] font-semibold">
                                    Tải trọng sàn: {totalLoad} tấn
                                  </span>
                                )}
                                {s + m + l + xl === 0 && (
                                  <span className="text-slate-400 italic text-[11px]">
                                    {f.units} kho tiêu chuẩn
                                  </span>
                                )}
                              </div>
                            )
                          })()}

                          {/* Hàng 3: Thước đo vận hành (Lấp đầy, Doanh thu, Đơn giá từ) */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50/80 p-3 rounded-xl border border-stone-200/60">
                            <div>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {lang === "vi" ? "Tỷ lệ lấp đầy" : "Occupancy"}
                              </p>
                              <p className="font-bold text-slate-900 text-sm">
                                {occupiedInFac}/{totalUnitsInFac} kho{" "}
                                <span className="text-slate-500 font-normal text-xs">
                                  ({occupancyRate}%)
                                </span>
                              </p>
                              <ProgressBar
                                value={occupiedInFac}
                                max={totalUnitsInFac || 1}
                                color={
                                  occupancyRate >= 80
                                    ? "bg-emerald-500"
                                    : occupancyRate >= 40
                                      ? "bg-blue-500"
                                      : "bg-amber-500"
                                }
                              />
                            </div>

                            <div>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {lang === "vi"
                                  ? "Doanh thu tháng (MTD)"
                                  : "Revenue MTD"}
                              </p>
                              <p className="font-bold text-slate-900 text-sm">
                                {formatCurrency(getFacilityActualRevenue(f))}
                              </p>
                              <p className="text-[10px] text-emerald-700 font-semibold">
                                {getFacilityActualRevenue(f) === 0
                                  ? "Chưa phát sinh doanh thu"
                                  : f.growth
                                    ? `+${f.growth}% so với kỳ trước`
                                    : "Doanh thu ổn định"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {lang === "vi" ? "Cước cơ sở từ" : "Base Rate"}
                              </p>
                              <p className="font-bold text-emerald-800 text-sm">
                                {f.price}/tháng
                              </p>
                              <p className="text-[10px] text-slate-500">
                                Kỳ thuê từ 1 tháng
                              </p>
                            </div>
                          </div>

                          {/* Hàng 2.8: Chính sách đang áp dụng */}
                          {(() => {
                            const activePoliciesForFac = policiesList.filter((p) => {
                              if (p.scopeType === "all") return true
                              if (Array.isArray(p.facilityIds) && p.facilityIds.length > 0) {
                                return p.facilityIds.includes(f.id) || (f.code && p.facilityIds.includes(f.code))
                              }
                              const s = (p.scope || "").trim().toLowerCase()
                              if (["all facilities", "toàn bộ cơ sở", "all", "toàn bộ"].includes(s)) return true
                              return s.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(s)
                            })
                            const specificCount = activePoliciesForFac.filter(
                              (p) => p.scopeType === "specific" || (p.facilityIds && p.facilityIds.length > 0),
                            ).length

                            return (
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPolicyFacilityFilter(cleanF.id)
                                    setPage("policies")
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50/80 text-amber-900 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition cursor-pointer"
                                  title={lang === "vi" ? "Xem và quản lý các chính sách của cơ sở này" : "View and manage policies for this facility"}
                                >
                                  <span>📜</span>
                                  <span>
                                    {lang === "vi"
                                      ? `${activePoliciesForFac.length} chính sách áp dụng`
                                      : `${activePoliciesForFac.length} policies`}
                                  </span>
                                  {specificCount > 0 && (
                                    <span className="bg-amber-200/90 text-amber-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                      {specificCount} {lang === "vi" ? "riêng" : "custom"}
                                    </span>
                                  )}
                                  <span className="text-amber-700 text-[11px] font-bold">→</span>
                                </button>
                              </div>
                            )
                          })()}
                        </div>

                      {/* Các nút hành động */}
                      <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold"
                          onClick={() => {
                            setSelectedFacility(cleanF)

                            setViewFacilityModal(true)
                          }}
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

                            setDeleteFacilityModal(true)
                          }}
                        >
                          {lang === "vi" ? "Xóa cơ sở" : "Delete"}
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

      {/* ── RENTAL POLICIES ───────────────────────────────────── */}
      {page === "policies" && (
        <div className="fade-in space-y-6">
          <SectionHeader
            title={
              lang === "vi"
                ? "Quy Định & Chính Sách Thuê Kho"
                : "Rental Policies"
            }
            subtitle={
              lang === "vi"
                ? "Các điều khoản, gói kỳ hạn ưu đãi và quy chế thương mại áp dụng thống nhất toàn hệ thống"
                : "Company-wide rental terms, duration packages, and conditions"
            }
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreatePolicy}
              >
                {Icon.plus} {lang === "vi" ? "Thêm Chính Sách" : "Add Policy"}
              </Button>
            }
          />

          {/* ── KHỐI 1: GÓI THUÊ & MỨC GIẢM GIÁ THEO KỲ HẠN ── */}
          <Card className="p-5 border border-stone-200/90 shadow-sm bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    Gói Thuê & Mức Giảm Giá Kỳ Hạn
                  </h3>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Áp dụng tự động trên hệ thống
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tỷ lệ giảm giá (%) được tự động áp dụng vào đơn giá khi khách hàng đặt kho hoặc gia hạn theo các mốc thời gian dưới đây.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 self-start sm:self-auto flex items-center gap-1.5 shrink-0"
                onClick={handleOpenCreateDuration}
              >
                {Icon.plus} {lang === "vi" ? "Thêm Gói Thuê Mới" : "Add Rental Package"}
              </Button>
            </div>

            {/* Cards Tóm Tắt Nhanh Các Gói */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 my-4">
              {durationDiscounts.map((item) => {
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
                        <button
                          type="button"
                          onClick={() => handleToggleDurationStatus(item.id)}
                          title={isActive ? (lang === 'vi' ? "Bấm để tạm dừng gói này" : "Click to pause") : (lang === 'vi' ? "Bấm để kích hoạt lại" : "Click to activate")}
                          className="cursor-pointer transition-transform hover:scale-105"
                        >
                          <Badge
                            variant={
                              !isActive
                                ? "warning"
                                : hasDiscount || hasRenewal
                                  ? "success"
                                  : "muted"
                            }
                          >
                            {!isActive
                              ? "Tạm dừng"
                              : hasDiscount
                                ? `Giảm ${item.discountPercent}%`
                                : "Không giảm"}
                          </Badge>
                        </button>
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
                      </div>

                      <p className="text-[11px] text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]" title={item.appliesTo}>
                        {item.appliesTo}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDuration(item)}
                          className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDurationDiscount(item.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-800 underline cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* ── KHỐI 2: QUY ĐỊNH & CHÍNH SÁCH CHUNG ── */}
          <Card className="p-5 border border-stone-200/90 shadow-sm bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Quy Định & Điều Khoản Thuê Chung
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các điều khoản về tiền đặt cọc, thời gian ân hạn thanh toán, phí trễ hạn và thông báo trả kho
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  {lang === "vi" ? "Lọc theo cơ sở:" : "Filter by facility:"}
                </span>
                <select
                  value={policyFacilityFilter}
                  onChange={(e) => setPolicyFacilityFilter(e.target.value)}
                  className="text-xs font-semibold border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">
                    {lang === "vi"
                      ? `Tất cả cơ sở (${policiesList.length} chính sách)`
                      : `All Facilities (${policiesList.length})`}
                  </option>
                  {facilitiesList.map((f) => {
                    const count = policiesList.filter((p) => {
                      if (p.scopeType === "all") return true
                      if (Array.isArray(p.facilityIds) && p.facilityIds.length > 0) {
                        return p.facilityIds.includes(f.id) || (f.code && p.facilityIds.includes(f.code))
                      }
                      const s = (p.scope || "").trim().toLowerCase()
                      if (["all facilities", "toàn bộ cơ sở", "all", "toàn bộ"].includes(s)) return true
                      return s.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(s)
                    }).length
                    return (
                      <option key={f.id} value={f.id}>
                        {f.name} ({count} chính sách)
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            <Table>
              <Thead>
                <tr>
                  <Th>{lang === "vi" ? "Tên Chính Sách" : "Policy Name"}</Th>
                  <Th>{lang === "vi" ? "Giá Trị Áp Dụng" : "Current Value"}</Th>
                  <Th>{lang === "vi" ? "Phạm Vi Áp Dụng" : "Scope"}</Th>
                  <Th>
                    {lang === "vi"
                      ? "Ghi Chú / Căn Cứ"
                      : "Notes / Justification"}
                  </Th>
                  <Th className="text-right">
                    {lang === "vi" ? "Thao Tác" : "Action"}
                  </Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredPoliciesList.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8 text-slate-400">
                      {lang === "vi"
                        ? policyFacilityFilter === "all"
                          ? 'Chưa có chính sách nào. Hãy bấm "Thêm Chính Sách" để bắt đầu.'
                          : 'Cơ sở này hiện chưa có chính sách riêng nào. Các chính sách toàn hệ thống sẽ áp dụng mặc định.'
                        : "No policies found."}
                    </Td>
                  </Tr>
                ) : (
                  filteredPoliciesList.map((p) => {
                    const displayName =
                      lang === "vi"
                        ? p.name === "Grace Period" || p.name === "Thời gian gia hạn nợ" || p.name === "Thời gian ân hạn thanh toán"
                          ? "Thời gian ân hạn thanh toán"
                          : p.name === "Late Fee" || p.name === "Mức phí phạt trễ hạn"
                            ? "Mức phí phạt trễ hạn"
                            : p.name === "Security Deposit" || p.name === "Tiền đặt cọc an ninh"
                              ? "Tiền đặt cọc an ninh"
                              : p.name === "Notice to Vacate" || p.name === "Thời hạn báo trước khi trả kho sớm"
                                ? "Thời hạn báo trước khi trả kho sớm"
                                : p.name === "Minimum Lease" || p.name === "Thời hạn thuê tối thiểu"
                                  ? "Thời hạn thuê tối thiểu"
                                  : p.name
                        : p.name

                    const displayValue =
                      lang === "vi"
                        ? p.value.includes("days")
                          ? p.value.replace("days", "ngày")
                          : p.value === "1 month"
                            ? (p.name.includes("Deposit") || p.name.includes("cọc") ? "1 tháng tiền thuê" : "1 tháng")
                            : (p.value ?? "—")
                        : (p.value ?? "—")

                    return (
                      <Tr key={p.id}>
                        <Td className="font-medium text-slate-800">
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {displayName}
                            </span>
                            {p.lastUpdated && (
                              <span className="text-[10px] text-slate-400">
                                Cập nhật: {p.lastUpdated}
                              </span>
                            )}
                          </div>
                        </Td>

                        <Td>
                          <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-xs">
                            {displayValue}
                          </span>
                        </Td>

                        <Td>
                          {(() => {
                            const isGlobal =
                              p.scopeType === "all" ||
                              (!p.scopeType &&
                                (!p.facilityIds || p.facilityIds.length === 0) &&
                                (p.scope === "All Facilities" || p.scope === "Toàn bộ cơ sở"))

                            if (isGlobal) {
                              return (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                  {lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"}
                                </span>
                              )
                            }

                            // Match specific facilities
                            const matchedFacs = facilitiesList.filter(
                              (f) =>
                                p.facilityIds?.includes(f.id) ||
                                (f.code && p.facilityIds?.includes(f.code)) ||
                                (p.scope &&
                                  (p.scope.toLowerCase().includes(f.name.toLowerCase()) ||
                                    f.name.toLowerCase().includes(p.scope.toLowerCase()))),
                            )

                            if (matchedFacs.length === 1) {
                              return (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                  {matchedFacs[0].name}
                                </span>
                              )
                            }

                            return (
                              <div className="space-y-1">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {matchedFacs.length > 0 ? `${matchedFacs.length} cơ sở áp dụng` : p.scope}
                                </span>
                                {matchedFacs.length > 0 && (
                                  <div className="flex flex-wrap gap-1 max-w-[240px]">
                                    {matchedFacs.map((f) => (
                                      <span
                                        key={f.id}
                                        className="text-[10px] bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded border border-stone-200 font-medium"
                                      >
                                        {f.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </Td>
                        <Td className="text-xs text-slate-500 max-w-[250px] truncate">
                          {p.description || "—"}
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditPolicy(p)}
                            >
                              {lang === "vi" ? "Sửa" : "Edit"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDeletePolicy(p.id)}
                            >
                              {lang === "vi" ? "Xóa" : "Delete"}
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                    )
                  })
                )}
              </Tbody>
            </Table>
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
                    {selectedPricingFacility.price || "5.500.000đ"}/tháng
                  </b>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenFacilityPriceModal(selectedPricingFacility)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <span className="show-icon">✏️</span>
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

          {/* ── Pricing Cards: per-facility when "all", single facility when selected ── */}
          {selectedPricingFacility === null ? (
            /* "Toàn bộ cơ sở" — render một block per facility */
            <div className="space-y-6">
              {facilitiesList.map((fac) => (
                <div key={fac.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] border border-amber-200">
                        {fac.code || fac.id}
                      </span>
                      <span className="font-semibold text-slate-900">{fac.name}</span>
                      <span className="text-xs text-slate-400">{fac.address}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenFacilityPriceModal(fac)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
                    >
                      <span className="show-icon">✏️</span>
                      <span>Chỉnh giá cơ sở này</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-5">
                    {pricingTiers.map((rawTier) => {
                      const tierOverride = facilityPricingOverrides[fac.id]?.[rawTier.id]
                      const effectivePrice = tierOverride ? tierOverride.basePrice : rawTier.basePrice
                      const displayName =
                        rawTier.sizeCode === 'S' ? 'Kho Nhỏ (S)'
                          : rawTier.sizeCode === 'M' ? 'Kho Vừa (M)'
                            : rawTier.sizeCode === 'L' ? 'Kho Lớn (L)'
                              : 'Kho Rất Lớn (XL)'
                      const unitCount =
                        fac.unitDistribution?.[rawTier.sizeCode] ??
                        unitsList.filter(u =>
                          (u.facilityId === fac.id || u.facilityId === fac.code) &&
                          ((u as any).size === rawTier.sizeCode ||
                            u.type === (rawTier.sizeCode === 'S' ? 'Small' : rawTier.sizeCode === 'M' ? 'Medium' : rawTier.sizeCode === 'L' ? 'Large' : 'Extra Large'))
                        ).length
                      return (
                        <Card key={rawTier.id} className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-slate-900 text-sm">{displayName}</h4>
                            {tierOverride && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Giá riêng</span>
                            )}
                          </div>
                          <p className="text-lg font-bold text-emerald-700">{formatCurrency(effectivePrice)}<span className="text-xs font-normal text-slate-500">/th</span></p>
                          <p className="text-xs text-slate-400 mt-1">{unitCount} gian kho</p>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Một cơ sở cụ thể — render 4 card có nút Sửa */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              {pricingTiers.map((rawTier) => {
                const tier = getEffectiveTier(rawTier)
                const displayName =
                  lang === "vi"
                    ? tier.name.includes("Small")
                      ? "Kho Nhỏ (S)"
                      : tier.name.includes("Medium")
                        ? "Kho Vừa (M)"
                        : tier.name.includes("Large") &&
                          !tier.name.includes("Extra") &&
                          !tier.name.includes("XL")
                          ? "Kho Lớn (L)"
                          : tier.name.includes("XL") ||
                            tier.name.includes("Extra") ||
                            tier.name.includes("Rất Lớn")
                            ? "Kho Rất Lớn (XL)"
                            : tier.name
                    : tier.name

                const sizeKey =
                  tier.sizeCode ||
                  (tier.name.includes("(S)")
                    ? "S"
                    : tier.name.includes("(M)")
                      ? "M"
                      : tier.name.includes("(XL)")
                        ? "XL"
                        : "L")

                const unitCountInFac =
                  selectedPricingFacility.unitDistribution?.[
                  sizeKey as "S" | "M" | "L" | "XL"
                  ] ??
                  unitsList.filter(
                    (u) =>
                      (u.facilityId === selectedPricingFacility.id ||
                        u.facilityId === selectedPricingFacility.code) &&
                      ((u as any).size === sizeKey ||
                        u.type ===
                        (sizeKey === "S"
                          ? "Small"
                          : sizeKey === "M"
                            ? "Medium"
                            : sizeKey === "L"
                              ? "Large"
                              : "Extra Large")),
                  ).length

                return (
                  <Card key={tier.id} className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {displayName}
                        </h3>
                        {tier.size ? (
                          <p className="text-xs text-slate-400">{tier.size}</p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTier({ ...tier, name: displayName })
                          setFormTierBasePrice(tier.basePrice.toString())
                          setFormTierMultiplier(
                            tier.highDemandMultiplier.toString(),
                          )
                          setPricingModal(true)
                        }}
                      >
                        {lang === "vi" ? "Sửa" : "Edit"}
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">
                          {lang === "vi" ? "Giá cơ sở" : "Base price"}
                        </span>
                        <span className="font-semibold text-emerald-800">
                          {formatCurrency(tier.basePrice)}/
                          {lang === "vi" ? "th" : "mo"}
                        </span>
                      </div>
                      {unitCountInFac !== null && (
                        <div className="flex justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                          <span>
                            {lang === "vi" ? "Số lượng tại kho:" : "Units in facility:"}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {unitCountInFac} gian kho
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ── GÓI THUÊ & CHÍNH SÁCH GIẢM GIÁ THEO KỲ HẠN (3, 6, 12, 24 THÁNG) ── */}
          <Card className="p-5 border border-amber-200/80 bg-linear-to-b from-amber-50/20 to-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    {lang === "vi"
                      ? "Chính Sách Giá Theo Thời Hạn & Gói Thuê Dài Hạn"
                      : "Rental Packages & Long-Term Duration Discounts"}
                  </h3>
                  <Badge variant="success">
                    {lang === "vi" ? "Đồng bộ giá Customer" : "Live customer pricing"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  {lang === "vi"
                    ? "Hệ thống tự động áp dụng tỷ lệ chiết khấu giảm giá vào đơn giá khi khách hàng thuê theo gói 3 tháng, 6 tháng, 12 tháng hoặc 24 tháng. Bạn có thể nhấn 'Sửa' để cấu hình lại mức giảm."
                    : "Automatic discounts applied to units when customers lease for 3, 6, 12, or 24 months."}
                </p>
              </div>
            </div>

            {/* Quick Cards Gói Thuê */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 my-4">
              {durationDiscounts.map((item) => {
                const isActive = item.status === "active"
                const hasDiscount = item.discountPercent > 0
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isActive
                        ? hasDiscount
                          ? "border-emerald-200 bg-white hover:border-emerald-400 shadow-2xs"
                          : "border-stone-200 bg-white"
                        : "border-stone-200 bg-stone-100 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {item.label}
                        </span>
                        <Badge variant={!isActive ? "warning" : hasDiscount ? "success" : "muted"}>
                          {!isActive ? "Tạm dừng" : hasDiscount ? `-${item.discountPercent}%` : "0%"}
                        </Badge>
                      </div>

                      {/* Phân tách rõ: Đặt mới vs Gia hạn */}
                      <div className="space-y-1 py-1.5 px-2 rounded-lg bg-stone-50 border border-stone-200/60 text-xs my-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-medium">Đặt mới:</span>
                          <span className={`font-mono font-bold text-xs ${hasDiscount ? "text-emerald-700" : "text-slate-500"}`}>
                            {hasDiscount ? `-${item.discountPercent}%` : "0% (Niêm yết)"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-1">
                          <span className="text-[10px] text-slate-500 font-medium">Gia hạn:</span>
                          <span className={`font-mono font-bold text-xs ${item.renewalDiscountPercent > 0 ? "text-blue-700" : "text-slate-500"}`}>
                            {item.renewalDiscountPercent > 0 ? `-${item.renewalDiscountPercent}%` : "0%"}
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 truncate">
                        {item.months === "other" ? "Linh hoạt" : `${item.months} tháng`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditDuration(item)}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                      >
                        {lang === "vi" ? "Sửa" : "Edit"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bảng Ma Trận Báo Giá Quy Đổi Cho Từng Cỡ Kho */}
            <div className="mt-4 border border-stone-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  📐 Bảng Tra Cứu Đơn Giá Từng Loại Kho Sau Giảm Giá
                  {selectedPricingFacility ? ` · Tại ${selectedPricingFacility.name}` : " · Mức Chuẩn Hệ Thống"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Đơn giá thực tế hiển thị cho Khách hàng
                </span>
              </div>
              <Table>
                <Thead>
                  <tr>
                    <Th>Phân Loại Kho</Th>
                    <Th className="text-right">Giá Gốc (1 Tháng)</Th>
                    <Th className="text-right">Gói 3 Tháng</Th>
                    <Th className="text-right">Gói 6 Tháng</Th>
                    <Th className="text-right">Gói 12 Tháng</Th>
                    <Th className="text-right">Gói 24 Tháng</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {(['S', 'M', 'L', 'XL'] as const).map((sz) => {
                    const tierId = sz === 'S' ? 'tier-1' : sz === 'M' ? 'tier-2' : sz === 'L' ? 'tier-3' : 'tier-4'
                    const rawTier = pricingTiers.find(t => t.id === tierId) || pricingTiers[0]
                    const effective = getEffectiveTier(rawTier)
                    const base = effective.basePrice
                    const spec = UNIT_SPECS[sz]

                    const getDiscountForMonths = (m: number) => {
                      const item = durationDiscounts.find(d => d.months === m && d.status === 'active')
                      return item ? item.discountPercent : 0
                    }

                    const d3 = getDiscountForMonths(3)
                    const p3 = Math.round(base * (1 - d3 / 100))
                    const d6 = getDiscountForMonths(6)
                    const p6 = Math.round(base * (1 - d6 / 100))
                    const d12 = getDiscountForMonths(12)
                    const p12 = Math.round(base * (1 - d12 / 100))
                    const d24 = getDiscountForMonths(24)
                    const p24 = Math.round(base * (1 - d24 / 100))

                    return (
                      <Tr key={sz}>
                        <Td className="font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                              sz === 'S' ? 'bg-blue-100 text-blue-900' :
                              sz === 'M' ? 'bg-green-100 text-green-900' :
                              sz === 'L' ? 'bg-purple-100 text-purple-900' :
                              'bg-amber-100 text-amber-900'
                            }`}>
                              {sz}
                            </span>
                            <span>{spec.name}</span>
                            <span className="text-xs text-slate-400 font-normal">({spec.dimensions})</span>
                          </div>
                        </Td>
                        <Td className="text-right font-mono font-bold text-slate-900">
                          {formatCurrency(base)}<span className="text-xs font-normal text-slate-400">/th</span>
                        </Td>
                        <Td className="text-right">
                          <p className="font-mono font-bold text-emerald-700">{formatCurrency(p3)}<span className="text-xs font-normal text-slate-500">/th</span></p>
                          <p className="text-[10px] text-slate-400 font-mono">Tổng: {formatCurrency(p3 * 3)}</p>
                        </Td>
                        <Td className="text-right">
                          <p className="font-mono font-bold text-emerald-700">{formatCurrency(p6)}<span className="text-xs font-normal text-slate-500">/th</span></p>
                          <p className="text-[10px] text-slate-400 font-mono">Tổng: {formatCurrency(p6 * 6)}</p>
                        </Td>
                        <Td className="text-right">
                          <p className="font-mono font-bold text-emerald-700">{formatCurrency(p12)}<span className="text-xs font-normal text-slate-500">/th</span></p>
                          <p className="text-[10px] text-slate-400 font-mono">Tổng: {formatCurrency(p12 * 12)}</p>
                        </Td>
                        <Td className="text-right">
                          <p className="font-mono font-bold text-emerald-700">{formatCurrency(p24)}<span className="text-xs font-normal text-slate-500">/th</span></p>
                          <p className="text-[10px] text-slate-400 font-mono">Tổng: {formatCurrency(p24 * 24)}</p>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </div>
          </Card>

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
                {RUNTIME_FEES.map((f) => (
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
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── DISCOUNTS & PROMOTIONS ─────────────────────────── */}
      {page === "discounts" &&
        (() => {
          const activePromos = promotionsList.filter(
            (p) => p.status === "active",
          )

          const totalRedemptions = promotionsList.reduce(
            (sum, p) => sum + p.uses,
            0,
          )

          const totalCapacity = promotionsList.reduce(
            (sum, p) => sum + p.maxUses,
            0,
          )

          const filteredPromos = promotionsList.filter((p) => {
            const matchTab =
              promoTab === "All" ||
              promoTab === "Tất cả" ||
              ((promoTab === "active" || promoTab === "Đang chạy") &&
                p.status === "active") ||
              ((promoTab === "paused" || promoTab === "Tạm dừng") &&
                p.status === "paused") ||
              ((promoTab === "expired" || promoTab === "Hết hạn") &&
                p.status === "expired")

            const query = promoSearch.toLowerCase().trim()

            const matchSearch =
              !query ||
              p.name.toLowerCase().includes(query) ||
              p.code.toLowerCase().includes(query) ||
              p.applicableUnitType.toLowerCase().includes(query)

            return matchTab && matchSearch
          })

          const copyCodeToClipboard = (code: string) => {
            navigator.clipboard?.writeText(code)

            showToast(
              lang === "vi"
                ? `Đã sao chép mã ưu đãi "${code}" vào clipboard!`
                : `Promo code "${code}" copied to clipboard!`,
            )
          }

          const togglePromoStatus = (id: string) => {
            setPromotionsList((prev) =>
              prev.map((p) => {
                if (p.id !== id) return p

                const nextStatus = p.status === "active" ? "paused" : "active"

                return {
                  ...p,
                  status: nextStatus,
                  active: nextStatus === "active",
                }
              }),
            )

            showToast(
              lang === "vi"
                ? "Đã chuyển đổi trạng thái chiến dịch."
                : "Campaign status toggled.",
            )
          }

          const deletePromo = (id: string) => {
            setPromotionsList((prev) => prev.filter((p) => p.id !== id))

            showToast(
              lang === "vi"
                ? "Đã gỡ bỏ chiến dịch khuyến mãi."
                : "Promotional campaign removed.",
            )
          }

          return (
            <div className="fade-in space-y-6">
              <SectionHeader
                title={
                  lang === "vi"
                    ? "Chiến Dịch Khuyến Mãi & Voucher"
                    : "Discounts & Commercial Promotions"
                }
                subtitle={
                  lang === "vi"
                    ? "Thiết lập mã giảm giá, quản lý hạn ngạch voucher và theo dõi tỷ lệ chuyển đổi khách mới"
                    : "Design targeted voucher campaigns, manage concession rules, and track tenant acquisition redemption rates"
                }
                action={
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        showToast(
                          lang === "vi"
                            ? "Đã xuất dữ liệu hiệu quả chiến dịch!"
                            : "Campaign performance analytics exported!",
                        )
                      }
                    >
                      {lang === "vi" ? "Xuất báo cáo" : "Export Report"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setDiscountModal(true)}
                    >
                      {Icon.plus}{" "}
                      {lang === "vi" ? "Tạo Khuyến Mãi Mới" : "New Promotion"}
                    </Button>
                  </div>
                }
              />

              {/* Campaign Analytics KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title={
                    lang === "vi" ? "Chiến dịch đang chạy" : "Active Campaigns"
                  }
                  value={activePromos.length}
                  delta={
                    lang === "vi"
                      ? `${promotionsList.length} tổng đã tạo`
                      : `${promotionsList.length} total created`
                  }
                  deltaPositive
                  icon={Icon.tag}
                  iconBg="bg-amber-50 text-amber-800"
                />
                <StatCard
                  title={
                    lang === "vi"
                      ? "Lượt áp dụng thành công"
                      : "Total Redemptions"
                  }
                  value={totalRedemptions}
                  delta={`${Math.round((totalRedemptions / (totalCapacity || 1)) * 100)}% ${lang === "vi" ? "hạn ngạch đã nhận" : "quota claimed"
                    }`}
                  deltaPositive
                  icon={Icon.chart}
                  iconBg="bg-blue-50 text-blue-700"
                />
                <StatCard
                  title={
                    lang === "vi"
                      ? "Ước tính ưu đãi đã trao"
                      : "Granted Savings Est."
                  }
                  ///value={`$${(totalRedemptions * 32).toLocaleString()}`}

                  value={formatCurrency(totalRedemptions * 32)}
                  delta={
                    lang === "vi"
                      ? "Khuyến khích khách thuê"
                      : "Tenant incentive"
                  }
                  icon={Icon.dollar}
                  iconBg="bg-emerald-50 text-emerald-700"
                />
                <StatCard
                  title={
                    lang === "vi" ? "Gia tăng chuyển đổi" : "Conversion Lift"
                  }
                  value="+18.4%"
                  delta={
                    lang === "vi"
                      ? "so với không áp mã"
                      : "vs non-promo bookings"
                  }
                  deltaPositive
                  icon={Icon.refresh}
                  iconBg="bg-purple-50 text-purple-700"
                />
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Tabs
                  tabs={
                    lang === "vi"
                      ? ["Tất cả", "Đang chạy", "Tạm dừng", "Hết hạn"]
                      : ["All", "active", "paused", "expired"]
                  }
                  active={
                    promoTab === "All" && lang === "vi"
                      ? "Tất cả"
                      : promoTab === "active" && lang === "vi"
                        ? "Đang chạy"
                        : promoTab === "paused" && lang === "vi"
                          ? "Tạm dừng"
                          : promoTab === "expired" && lang === "vi"
                            ? "Hết hạn"
                            : promoTab
                  }
                  onChange={(val) => {
                    if (val === "Tất cả") setPromoTab("All")
                    else if (val === "Đang chạy") setPromoTab("active")
                    else if (val === "Tạm dừng") setPromoTab("paused")
                    else if (val === "Hết hạn") setPromoTab("expired")
                    else setPromoTab(val)
                  }}
                />
                <div className="w-full sm:w-72">
                  <input
                    type="text"
                    placeholder={
                      lang === "vi"
                        ? "Tìm tên chương trình, mã voucher..."
                        : "Search promo name, code, units..."
                    }
                    value={promoSearch}
                    onChange={(e) => setPromoSearch(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Campaign Cards Grid */}
              <div className="space-y-4">
                {filteredPromos.length === 0 ? (
                  <Card className="p-10 text-center text-stone-400">
                    <p className="font-semibold text-stone-700">
                      {lang === "vi"
                        ? "Không tìm thấy chiến dịch khuyến mãi nào"
                        : "No promotion campaigns found in this view"}
                    </p>
                    <p className="text-xs mt-1">
                      {lang === "vi"
                        ? "Tạo mã voucher mới hoặc đổi bộ lọc trạng thái."
                        : "Create a new voucher code or switch the status filter."}
                    </p>
                  </Card>
                ) : (
                  filteredPromos.map((p) => (
                    <Card
                      key={p.id}
                      className="p-5 hover:border-stone-300 transition"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Left: Campaign details */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="font-bold text-stone-900 text-base">
                              {p.name}
                            </h3>
                            <Badge
                              variant={
                                p.status === "active"
                                  ? "success"
                                  : p.status === "paused"
                                    ? "warning"
                                    : "muted"
                              }
                            >
                              {p.status === "active"
                                ? lang === "vi"
                                  ? "Đang chạy"
                                  : "active"
                                : p.status === "paused"
                                  ? lang === "vi"
                                    ? "Tạm dừng"
                                    : "paused"
                                  : lang === "vi"
                                    ? "Hết hạn"
                                    : "expired"}
                            </Badge>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                              {lang === "vi"
                                ? p.type === "percentage"
                                  ? "Giảm theo %"
                                  : p.type === "first-month-free"
                                    ? "Tháng đầu 0đ"
                                    : p.type === "fixed-amount"
                                      ? "Giảm số tiền"
                                      : "Ưu đãi mùa vụ"
                                : p.typeLabel}
                            </span>
                          </div>

                          <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                            {p.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-stone-400">
                                {lang === "vi" ? "Mã voucher:" : "Code:"}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyCodeToClipboard(p.code)}
                                className="font-mono font-bold bg-[#fbfaf6] hover:bg-amber-100 hover:text-amber-900 border border-stone-300 px-2 py-0.5 rounded text-stone-800 transition flex items-center gap-1 group"
                                title={
                                  lang === "vi"
                                    ? "Bấm để copy mã"
                                    : "Click to copy code"
                                }
                              >
                                <span>{p.code}</span>
                                <svg
                                  className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-700"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              </button>
                            </div>
                            <span>•</span>
                            <span>
                              {lang === "vi" ? "Ưu đãi:" : "Benefit:"}{" "}
                              <strong className="text-stone-800">
                                {p.discount}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              {lang === "vi"
                                ? "Hợp đồng tối thiểu:"
                                : "Commitment:"}{" "}
                              {p.minLeaseMonths}{" "}
                              {lang === "vi" ? "tháng" : "mo min"}
                            </span>
                            <span>•</span>
                            <span>
                              {lang === "vi" ? "Phạm vi:" : "Scope:"}{" "}
                              {lang === "vi" &&
                                p.applicableFacility === "All facilities"
                                ? "Toàn bộ cơ sở"
                                : p.applicableFacility}{" "}
                              ({p.applicableUnitType})
                            </span>
                          </div>
                        </div>

                        {/* Right: Usage Quota & Actions */}
                        <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 flex-shrink-0">
                          <div className="w-48 text-right">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-stone-400">
                                {lang === "vi"
                                  ? "Hạn ngạch đã dùng"
                                  : "Claims Quota"}
                              </span>
                              <span className="font-bold text-stone-800">
                                {p.uses} / {p.maxUses}
                              </span>
                            </div>
                            <ProgressBar
                              value={p.uses}
                              max={p.maxUses}
                              color={
                                p.status === "expired"
                                  ? "bg-stone-300"
                                  : "bg-[#e9a12c]"
                              }
                            />
                            <p className="text-[10px] text-stone-400 mt-1">
                              {lang === "vi" ? "Hiệu lực:" : "Valid:"}{" "}
                              {p.startDate} – {p.expires}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant={
                                p.status === "active" ? "outline" : "primary"
                              }
                              size="sm"
                              onClick={() => togglePromoStatus(p.id)}
                            >
                              {p.status === "active"
                                ? lang === "vi"
                                  ? "Tạm dừng"
                                  : "Pause"
                                : lang === "vi"
                                  ? "Kích hoạt"
                                  : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => deletePromo(p.id)}
                            >
                              {lang === "vi" ? "Xóa" : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })()}

      {/* ── REVENUE REPORTS ───────────────────────────────────── */}
      {page === "revenue" && (
        <div className="fade-in space-y-6">
          <SectionHeader
            title="Báo Cáo Doanh Thu"
            subtitle="Hiệu quả tài chính chu kỳ Tháng 4 – Tháng 9 toàn hệ thống StorageHub"
            action={
              <Button
                variant="primary"
                size="sm"
                disabled={downloadingExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-sm cursor-pointer"
                onClick={() => {
                  setDownloadingExcel(true)

                  setTimeout(() => {
                    try {
                      const fileName = exportRevenueExcel({
                        facilityName: selectedRevenueFacilityName,

                        revenueData: activeRevenueData,
                      })

                      setDownloadedFileName(fileName)

                      showToast(`Đã xuất báo cáo Excel: ${fileName}`)
                    } catch {
                      showToast("Lỗi khi xuất file Excel!")
                    } finally {
                      setDownloadingExcel(false)
                    }
                  }, 350)
                }}
              >
                <span>{downloadingExcel ? "⏳" : "📥"}</span>
                <span>
                  {downloadingExcel
                    ? "Đang tạo file..."
                    : "Xuất Báo Cáo Excel (.xlsx)"}
                </span>
              </Button>
            }
          />

          {/* Download Notification Banner */}
          {downloadedFileName && !downloadingExcel && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  📊
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-emerald-950 text-sm">
                      {downloadedFileName}
                    </p>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-200 text-emerald-800">
                      Đã tải về máy (.xlsx)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Tệp Excel 2 trang tính: Báo cáo doanh thu Tháng 4 – Tháng 9
                    & Cơ cấu doanh thu
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold cursor-pointer"
                  onClick={() => {
                    exportRevenueExcel({
                      facilityName: selectedRevenueFacilityName,

                      revenueData: activeRevenueData,
                    })
                  }}
                >
                  📥 Tải lại file
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  onClick={() => setDownloadedFileName(null)}
                >
                  ✕
                </Button>
              </div>
            </div>
          )}

          {/* Filter Cơ Sở - Tự động cập nhật mọi cơ sở mới thêm vào hệ thống */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cơ sở:
              </span>
              <div className="w-64">
                <Select
                  value={
                    selectedRevenueFacility
                      ? selectedRevenueFacility.id
                      : "Toàn bộ cơ sở"
                  }
                  onChange={(e) => setRevenueFacilityFilter(e.target.value)}
                >
                  <option value="Toàn bộ cơ sở">Toàn bộ cơ sở</option>
                  {facilitiesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Phạm vi chu kỳ:{" "}
              <strong className="text-slate-800">Tháng 4 – Tháng 9</strong>
            </span>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 stat-card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500 font-medium">
                    Doanh thu lũy kế
                  </p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">
                    {currentTotalRevenue.toLocaleString("vi-VN")} ₫
                  </p>
                  <p className="text-xs text-stone-400 mt-1 font-medium">
                    Tháng 4 đến Tháng 9
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-green-50 text-emerald-600">
                  {Icon.dollar}
                </div>
              </div>
            </Card>

            <Card className="p-5 stat-card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500 font-medium">
                    Doanh thu trung bình/tháng
                  </p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">
                    {currentAvgRevenue.toLocaleString("vi-VN")} ₫
                  </p>
                  <p className="text-xs text-stone-400 mt-1 font-medium">
                    {currentTotalRevenue.toLocaleString("vi-VN")} ₫ / 6 tháng
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  {Icon.chart}
                </div>
              </div>
            </Card>

            <Card className="p-5 stat-card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500 font-medium">
                    Tháng doanh thu cao nhất
                  </p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">
                    {currentHighestItem.revenue.toLocaleString("vi-VN")} ₫
                  </p>
                  <p className="text-xs text-emerald-600 mt-1 font-semibold">
                    {currentHighestItem.month}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                  {Icon.check}
                </div>
              </div>
            </Card>

            <Card className="p-5 stat-card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500 font-medium">
                    Dự báo tháng tới
                  </p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">
                    {currentForecast}
                  </p>
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    {hasAnyRevenue
                      ? "Dựa trên xu hướng doanh thu gần đây"
                      : "Chưa có dữ liệu giao dịch"}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                  {Icon.refresh}
                </div>
              </div>
            </Card>
          </div>

          {/* Biểu Đồ Doanh Thu */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-base">
                Biểu Đồ Doanh Thu{" "}
                {selectedRevenueFacility
                  ? `– ${selectedRevenueFacility.name}`
                  : "Toàn Hệ Thống"}
              </h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md font-medium">
                Đơn vị: Triệu VNĐ
              </span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={activeRevenueData}
                margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, chartYMax]}
                  ticks={[
                    0,
                    Math.round(chartYMax * 0.25),
                    Math.round(chartYMax * 0.5),
                    Math.round(chartYMax * 0.75),
                    chartYMax,
                  ]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v === 0 ? "0" : `${Math.round(v / 1000000)} triệu`
                  }
                />
                <Tooltip
                  formatter={(value: any) => [
                    `${Number(value).toLocaleString("vi-VN")} ₫`,
                    "Doanh thu",
                  ]}
                  labelFormatter={(label: any) => `${label}`}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  name="Doanh thu"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Bảng Chi Tiết Doanh Thu */}
          <Card>
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">
                Bảng Chi Tiết Doanh Thu
              </h3>
              <span className="text-xs text-slate-400">
                Đơn vị tiền tệ: VNĐ (₫)
              </span>
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>Tháng</Th>
                  <Th>Doanh thu</Th>
                  <Th>Tăng trưởng</Th>
                  <Th>Số hợp đồng</Th>
                  <Th>Tỷ lệ lấp đầy</Th>
                </tr>
              </Thead>
              <Tbody>
                {activeRevenueData.map((r) => (
                  <Tr key={r.month}>
                    <Td className="font-semibold text-slate-900">{r.month}</Td>
                    <Td className="font-bold text-slate-900 font-mono">
                      {r.revenue.toLocaleString("vi-VN")} ₫
                    </Td>
                    <Td>
                      {r.growth === "—" ? (
                        <span className="text-slate-400 font-medium">—</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold font-mono bg-emerald-50 px-2 py-0.5 rounded text-xs">
                          {r.growth}
                        </span>
                      )}
                    </Td>
                    <Td className="font-medium text-slate-700">
                      {r.contracts}
                    </Td>
                    <Td className="font-semibold text-slate-800">
                      {r.occupancyRate}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>

          {/* 2 Cột: Hiệu Suất Kho & Cơ Cấu Doanh Thu */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Section 6: Hiệu Suất Kho */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 text-base">
                  Hiệu Suất Kho
                </h3>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md">
                  Vận hành ổn định
                </span>
              </div>
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">
                      Tỷ lệ lấp đầy hiện tại
                    </p>
                    <p className="text-xl font-bold text-stone-900 mt-0.5">
                      {selectedRevenueFacility
                        ? `${Math.round((selectedRevenueFacility.occupied / Math.max(1, selectedRevenueFacility.units)) * 100)}%`
                        : `${facilitiesList.reduce((s, f) => s + (f.units || 0), 0) > 0 ? Math.round((facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0) / facilitiesList.reduce((s, f) => s + (f.units || 0), 0)) * 100) : 19}%`}
                    </p>
                  </div>
                  <div className="w-32">
                    <ProgressBar
                      value={
                        selectedRevenueFacility
                          ? Math.round(
                            (selectedRevenueFacility.occupied /
                              Math.max(1, selectedRevenueFacility.units)) *
                            100,
                          )
                          : facilitiesList.reduce((s, f) => s + (f.units || 0), 0) > 0
                            ? Math.round((facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0) / facilitiesList.reduce((s, f) => s + (f.units || 0), 0)) * 100)
                            : 19
                      }
                      max={100}
                      color="bg-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">
                      Hợp đồng đang hoạt động
                    </p>
                    <p className="text-xl font-bold text-stone-900 mt-0.5">
                      {selectedRevenueFacility
                        ? Math.max(
                          selectedRevenueFacility.occupied,
                          selectedFacilityContracts.length,
                          selectedFacilityRentals.length,
                        )
                        : facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                    {selectedRevenueFacility
                      ? `${Math.max(
                        selectedRevenueFacility.occupied,
                        selectedFacilityContracts.length,
                        selectedFacilityRentals.length,
                      )} / ${selectedRevenueFacility.units} gian`
                      : `${facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0)} / ${facilitiesList.reduce((s, f) => s + (f.units || 0), 0)} gian`}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">
                      Tỷ lệ gia hạn
                    </p>
                    <p className="text-xl font-bold text-stone-900 mt-0.5">
                      91%
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                    Rất cao
                  </span>
                </div>
              </div>
            </Card>

            {/* Section 7: Cơ Cấu Doanh Thu */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 text-base">
                  Cơ Cấu Doanh Thu
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Tỷ trọng nguồn thu
                </span>
              </div>
              <div className="space-y-3.5">
                {RUNTIME_REVENUE_BREAKDOWN.map((item) => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {item.category}
                      </span>
                      <span className="font-bold text-slate-900">
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── PERFORMANCE REPORTS ───────────────────────────────── */}
      {page === "performance" && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={
              lang === "vi"
                ? "Báo Cáo Hiệu Suất Hoạt Động"
                : "Performance Reports"
            }
            subtitle={
              lang === "vi"
                ? "Các chỉ số KPI vận hành trọng yếu trên toàn bộ hệ thống cơ sở"
                : "Operational KPIs across all facilities"
            }
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={lang === "vi" ? "Lấp đầy trung bình" : "Avg Occupancy"}
              value={`${totalUnits ? Math.round((totalOccupied / totalUnits) * 100) : 0}%`}
              icon={Icon.chart}
              iconBg="bg-blue-50"
            />
            <StatCard
              title={lang === "vi" ? "Tỷ lệ chuyển đổi" : "Conversion Rate"}
              value="68.5%"
              icon={Icon.check}
              iconBg="bg-green-50"
            />
            <StatCard
              title={lang === "vi" ? "Thời gian thuê TB" : "Avg Tenure"}
              value={lang === "vi" ? "14.2 tháng" : "14.2 mo"}
              icon={Icon.calendar}
              iconBg="bg-purple-50"
            />
            <StatCard
              title={lang === "vi" ? "Tỷ lệ rời bỏ (Churn)" : "Churn Rate"}
              value="3.8%"
              icon={Icon.refresh}
              iconBg="bg-amber-50"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">
                {lang === "vi"
                  ? "Tỷ Lệ Chuyển Đổi Khách Thăm Kho"
                  : "Inquiry Conversion Rate"}
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={RUNTIME_CONVERSION_DATA}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={
                      ((v: number) => [
                        `${v}%`,
                        lang === "vi" ? "Chuyển đổi" : "Conversion",
                      ]) as any
                    }
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">
                {lang === "vi"
                  ? "Điểm Hiệu Suất Từng Cơ Sở"
                  : "Facility Performance Scores"}
              </h3>
              {facilitiesList
                .filter((f) => f.status === "active")
                .map((f) => {
                  const occ = getFacilityOccupiedCount(f)
                  const tot = getFacilityTotalUnits(f)
                  const pct = tot > 0 ? Math.round((occ / tot) * 100) : 0
                  return (
                    <div key={f.id} className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium">
                          {f.name}
                        </span>
                        <span className="text-slate-800 font-semibold">
                          {pct}%
                        </span>
                      </div>
                      <ProgressBar
                        value={occ}
                        max={tot || 1}
                        color={pct >= 85 ? "bg-green-500" : "bg-blue-500"}
                      />
                    </div>
                  )
                })}
            </Card>
          </div>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === "vi" ? "Cơ Sở" : "Facility"}</Th>
                  <Th>{lang === "vi" ? "Tỷ Lệ Lấp Đầy" : "Occupancy"}</Th>
                  <Th>{lang === "vi" ? "Thời Hạn TB" : "Avg Length"}</Th>
                  <Th>{lang === "vi" ? "Rời Bỏ" : "Churn"}</Th>
                  <Th>{lang === "vi" ? "Độ Hài Lòng" : "Satisfaction"}</Th>
                  <Th>
                    {lang === "vi" ? "Doanh Thu / Năm" : "Revenue / Year"}
                  </Th>
                </tr>
              </Thead>
              <Tbody>
                {facilitiesList
                  .filter((f) => f.status === "active")
                  .map((f) => {
                    const occ = getFacilityOccupiedCount(f)
                    const tot = getFacilityTotalUnits(f)
                    const pct = tot > 0 ? Math.round((occ / tot) * 100) : 0
                    return (
                      <Tr key={f.id}>
                        <Td className="font-medium">{f.name}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {pct}%
                            </span>
                            <ProgressBar
                              value={occ}
                              max={tot || 1}
                              color="bg-blue-500"
                            />
                          </div>
                        </Td>
                        <Td>{lang === "vi" ? "14.2 tháng" : "14.2 mo"}</Td>
                        <Td>3.4%</Td>
                        <Td>
                          <div className="flex items-center gap-1 text-amber-500">
                            ★ 4.8
                          </div>
                        </Td>
                        <Td className="font-semibold text-slate-800 font-mono">
                          {formatCurrency(getFacilityActualRevenue(f) * 12)} /{" "}
                          {lang === "vi" ? "năm" : "yr"}
                        </Td>
                      </Tr>
                    )
                  })}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── PROFILE PAGE ─────────────────────────────────────── */}
      {page === "profile" && (
        <div className="fade-in">
          <ProfileView user={user} />
        </div>
      )}

      {/* ── TOAST MESSAGE ──────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#292a27] text-white px-5 py-3 rounded-lg shadow-2xl border border-amber-500/50 flex items-center gap-3 fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e9a12c] animate-ping" />
          <p className="text-sm font-medium">{toast}</p>
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
                  <span>{selectedPricingFacility ? '🏢' : '🌐'}</span>
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
              type="number"
              value={formTierBasePrice}
              onChange={(e) => setFormTierBasePrice(e.target.value)}
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
                  📍 {editingPriceFacility.address} · {editingPriceFacility.city}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                Quy mô: {editingPriceFacility.units} gian kho
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Thiết lập đơn giá cước thuê theo tháng cho từng loại kho tại cơ sở này. Đơn giá sẽ tự động được áp dụng vào các gói thuê (3, 6, 12, 24 tháng) theo tỷ lệ chiết khấu của hệ thống.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(['S', 'M', 'L', 'XL'] as const).map((sz) => {
                const spec = UNIT_SPECS[sz]
                const val = facilityPricesForm[sz]

                return (
                  <div key={sz} className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                          sz === 'S' ? 'bg-blue-100 text-blue-900' :
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
                        type="number"
                        min={100000}
                        step={50000}
                        value={val}
                        onChange={(e) => {
                          const n = Number(e.target.value) || 0
                          setFacilityPricesForm((prev) => ({ ...prev, [sz]: n }))
                        }}
                        className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="VD: 5500000"
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                className="text-stone-500 hover:text-red-700"
                onClick={handleResetFacilityPrices}
              >
                Khôi phục giá chuẩn hệ thống
              </Button>
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

      {/* Enhanced New Promotion Modal */}
      <Modal
        open={discountModal}
        onClose={() => setDiscountModal(false)}
        title={
          lang === "vi"
            ? "Tạo Chiến Dịch Khuyến Mãi Mới"
            : "Create Promotional Campaign"
        }
      >
        <div className="space-y-4">
          <Input
            label={
              lang === "vi"
                ? "Tên chiến dịch ưu đãi"
                : "Promotion Campaign Name"
            }
            placeholder={
              lang === "vi"
                ? "Ví dụ: Tri ân khách hàng cuối năm"
                : "e.g. End of Year Flash Sale"
            }
            value={newPromoName}
            onChange={(e) => setNewPromoName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">
                {lang === "vi" ? "Mã voucher" : "Promo Code"}
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newPromoCode}
                  onChange={(e) =>
                    setNewPromoCode(e.target.value.toUpperCase())
                  }
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setNewPromoCode(
                      `SAVE${Math.floor(10 + Math.random() * 40)}`,
                    )
                  }
                >
                  {lang === "vi" ? "Tạo mã" : "Gen"}
                </Button>
              </div>
            </div>

            <Select
              label={lang === "vi" ? "Loại hình ưu đãi" : "Benefit Type"}
              value={newPromoType}
              onChange={(e) => setNewPromoType(e.target.value as any)}
            >
              <option value="percentage">
                {lang === "vi"
                  ? "Giảm theo % (% OFF)"
                  : "Percentage Discount (% OFF)"}
              </option>
              <option value="fixed-amount">
                {lang === "vi"
                  ? "Giảm số tiền cố định ($ OFF)"
                  : "Fixed Dollar Amount ($ OFF)"}
              </option>
              <option value="first-month-free">
                {lang === "vi"
                  ? "Miễn phí 100% tháng đầu"
                  : "First Month 100% Free"}
              </option>
              <option value="seasonal">
                {lang === "vi"
                  ? "Voucher ưu đãi mùa vụ"
                  : "Seasonal Flash Voucher"}
              </option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={
                lang === "vi" ? "Giá trị hiển thị" : "Discount Value / Text"
              }
              placeholder={
                lang === "vi"
                  ? "Ví dụ: GIẢM 20% hoặc GIẢM $30"
                  : "e.g. 20% OFF or $30 OFF"
              }
              value={newPromoValue}
              onChange={(e) => setNewPromoValue(e.target.value)}
            />
            <Input
              label={
                lang === "vi"
                  ? "Hạn mức sử dụng tối đa"
                  : "Redemption Cap (Max uses)"
              }
              type="number"
              placeholder="50"
              value={newPromoMaxUses}
              onChange={(e) => setNewPromoMaxUses(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={
                lang === "vi"
                  ? "Hạn hợp đồng tối thiểu (tháng)"
                  : "Min Lease Commitment (Months)"
              }
              type="number"
              placeholder="3"
              value={newPromoMinMonths}
              onChange={(e) => setNewPromoMinMonths(e.target.value)}
            />
            <Input
              label={lang === "vi" ? "Ngày hết hạn" : "Expiry Date"}
              type="date"
              value={newPromoExpiry}
              onChange={(e) => setNewPromoExpiry(e.target.value)}
            />
          </div>

          <Input
            label={
              lang === "vi"
                ? "Mô tả điều khoản chiến dịch"
                : "Campaign Description"
            }
            placeholder={
              lang === "vi"
                ? "Ví dụ: Áp dụng cho hợp đồng từ 3 tháng trở lên trên tất cả gian kho 10ft"
                : "Brief terms for customers (e.g. Valid on all 10ft units with 3-month min lease)"
            }
            value={newPromoDesc}
            onChange={(e) => setNewPromoDesc(e.target.value)}
          />

          <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
            <Button variant="outline" onClick={() => setDiscountModal(false)}>
              {lang === "vi" ? "Hủy" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              disabled={!newPromoName.trim() || !newPromoCode.trim()}
              onClick={() => {
                const newPromo: PromotionItem = {
                  id: `DSC-${Date.now().toString().slice(-4)}`,

                  code: newPromoCode.trim().toUpperCase(),

                  name: newPromoName.trim(),

                  description:
                    newPromoDesc.trim() ||
                    `${newPromoValue} off eligible storage units.`,

                  value: newPromoValue.trim(),

                  discount: newPromoValue.trim(),

                  type: newPromoType,

                  typeLabel:
                    newPromoType === "percentage"
                      ? lang === "vi"
                        ? "Giảm %"
                        : "Percentage Off"
                      : newPromoType === "first-month-free"
                        ? lang === "vi"
                          ? "Miễn tháng đầu"
                          : "Free Month"
                        : newPromoType === "fixed-amount"
                          ? lang === "vi"
                            ? "Giảm tiền"
                            : "Fixed Amount"
                          : lang === "vi"
                            ? "Mùa vụ"
                            : "Seasonal",

                  active: true,

                  status: "active",

                  uses: 0,

                  maxUses: Number(newPromoMaxUses) || 50,

                  minLeaseMonths: Number(newPromoMinMonths) || 1,

                  applicableFacility: "All facilities",

                  applicableUnitType: "All Sizes",

                  startDate: "Sep 18, 2026",

                  expires: newPromoExpiry || "Dec 31, 2026",
                }

                setPromotionsList([newPromo, ...promotionsList])

                setDiscountModal(false)

                setNewPromoName("")

                setNewPromoDesc("")

                showToast(
                  lang === "vi"
                    ? `Chiến dịch "${newPromo.code}" đã được kích hoạt thành công!`
                    : `Promotion "${newPromo.code}" published successfully!`,
                )
              }}
            >
              {lang === "vi" ? "Phát hành chiến dịch" : "Publish Campaign"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: CHỈNH SỬA CHÍNH SÁCH ─────────────────────── */}
      <Modal
        open={policyModal}
        onClose={() => setPolicyModal(false)}
        title={
          lang === "vi" ? "Chỉnh Sửa Chính Sách Thương Mại" : "Edit Policy"
        }
      >
        {selectedPolicy && (
          <div className="space-y-4">
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800 block">
                {lang === "vi" ? "Phạm vi áp dụng chính sách" : "Policy Application Scope"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    policyFormScopeType === "all"
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
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    policyFormScopeType === "specific"
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
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isChecked
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
              <Button variant="primary" onClick={handleUpdatePolicy}>
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

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800 block">
              {lang === "vi" ? "Phạm vi áp dụng chính sách" : "Policy Application Scope"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  policyFormScopeType === "all"
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
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  policyFormScopeType === "specific"
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
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked
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
            <Button variant="primary" onClick={handleSaveNewPolicy}>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={lang === "vi" ? "Số tháng kỳ hạn" : "Months"}
              type="number"
              min={1}
              max={120}
              value={formCreateDurationMonths.toString()}
              onChange={(e) => setFormCreateDurationMonths(Number(e.target.value))}
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
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                  formCreateDurationScopeType === "all"
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
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                  formCreateDurationScopeType === "specific"
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
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked
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

            <div className="grid grid-cols-2 gap-3">
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
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    formDurationScopeType === "all"
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
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    formDurationScopeType === "specific"
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
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isChecked
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
          if (formFacManager.trim() !== (orig.manager || "").trim()) return true
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
              <div className="space-y-4">
                {/* Thông tin cơ sở */}
                <FacilityGeneralInfo
                  isEditing={false}
                  code={formFacCode}
                  onChangeCode={setFormFacCode}
                  city={formFacCity}
                  onChangeCity={(newCity) => {
                    setFormFacCity(newCity)
                    const autoCode = suggestFacilityCode(newCity)
                    setFormFacCode(autoCode)
                    if (formFacName.includes("Cơ sở")) {
                      setFormFacName(`Kho Việt – Cơ sở ${newCity}`)
                    }
                  }}
                  name={formFacName}
                  onChangeName={setFormFacName}
                  address={formFacAddress}
                  onChangeAddress={setFormFacAddress}
                  manager={formFacManager}
                  onChangeManager={setFormFacManager}
                  phone={formFacPhone}
                  onChangePhone={setFormFacPhone}
                  existingFacilities={facilitiesList}
                  onResetCode={() => setFormFacCode(suggestFacilityCode(formFacCity))}
                  isAutoCode={true}
                  lang={lang}
                />

                {/* Hình ảnh cơ sở & kho bãi */}
                <FacilityImageManager
                  image={formFacImage}
                  onChangeImage={setFormFacImage}
                  lang={lang}
                />

                {/* Quy mô & phân bổ kho */}
                <UnitAllocationTable
                  specs={formFacUnitSpecs}
                  onChangeSpecs={handleSyncUnitSpecs}
                  isEditing={false}
                  onOpenAddSpec={() => setShowAddUnitSpecModal(true)}
                  lang={lang}
                  onValidationChange={(_hasErrors, errors) => setCreateValidationErrors(errors)}
                  highlightSpecCode={highlightSpecCode}
                />

                {/* Thông số vận hành */}
                <FacilityOperations
                  accessHours={formFacAccessHours}
                  onChangeAccessHours={setFormFacAccessHours}
                  status={formFacStatus}
                  onChangeStatus={setFormFacStatus}
                  lang={lang}
                />

                {/* Sticky footer */}
                <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 z-10">
                  <div className="text-xs text-stone-500">
                    {formFacUnits <= 0 ? (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Cần ít nhất 1 loại kho có số lượng &gt; 0
                      </span>
                    ) : createValidationErrors.length > 0 ? (
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
                        formFacUnits <= 0 ||
                        createValidationErrors.length > 0 ||
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
                        manager={formFacManager}
                        onChangeManager={setFormFacManager}
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

                      {/* Quy mô & phân bổ kho */}
                      <UnitAllocationTable
                        specs={formFacUnitSpecs}
                        onChangeSpecs={handleSyncUnitSpecs}
                        isEditing={true}
                        occupiedMap={occMap}
                        initialSpecs={editInitialSpecs}
                        onOpenAddSpec={() => setShowAddUnitSpecModal(true)}
                        lang={lang}
                        onValidationChange={(_hasErrors, errors) => setEditValidationErrors(errors)}
                        highlightSpecCode={highlightSpecCode}
                      />

                      {/* Thông số vận hành */}
                      <FacilityOperations
                        accessHours={formFacAccessHours}
                        onChangeAccessHours={setFormFacAccessHours}
                        status={formFacStatus}
                        onChangeStatus={setFormFacStatus}
                        lang={lang}
                      />

                      {/* Sticky footer */}
                      <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 z-10">
                        <div className="text-xs text-stone-500">
                          {formFacUnits <= 0 ? (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Cần ít nhất 1 loại kho có số lượng &gt; 0
                            </span>
                          ) : editValidationErrors.length > 0 ? (
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
                          >
                            {lang === "vi" ? "Hủy" : "Cancel"}
                          </Button>
                          <Button
                            variant="primary"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                            disabled={
                              !isEditDirty ||
                              !formFacName.trim() ||
                              !formFacCode.trim() ||
                              !formFacAddress.trim() ||
                              formFacUnits <= 0 ||
                              hasDuplicateCode ||
                              editValidationErrors.length > 0
                            }
                            onClick={handleUpdateFacility}
                          >
                            {lang === "vi" ? "Lưu Thay Đổi" : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
            </Modal>

            {/* Modal Thêm Loại Kho Mới Vào Cơ Sở */}
            <AddUnitSpecModal
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
            />

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

      {/* 3. Modal Xác Nhận Xóa Cơ Sở Có Kiểm Tra An Toàn */}
      <Modal
        open={deleteFacilityModal}
        onClose={() => setDeleteFacilityModal(false)}
        title={lang === "vi" ? "Xác Nhận Xóa Cơ Sở" : "Confirm Delete Facility"}
      >
        {selectedFacility && (
          <div className="space-y-4">
            {selectedFacility.occupied > 0 ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-base">
                  CẢNH BÁO AN TOÀN HỢP ĐỒNG:
                </div>
                <p>
                  Cơ sở{" "}
                  <b>
                    {selectedFacility.name} (
                    {selectedFacility.code || selectedFacility.id})
                  </b>{" "}
                  hiện đang có{" "}
                  <b>
                    {selectedFacility.occupied} gian kho có khách thuê hoạt động
                  </b>
                  .
                </p>
                <p className="text-xs text-red-600">
                  Hệ thống từ chối xóa cơ sở này để bảo vệ dữ liệu hợp đồng
                  khách hàng và tính toàn vẹn tài chính.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Bạn có chắc chắn muốn xóa cơ sở{" "}
                  <b className="text-slate-900">{selectedFacility.name}</b> khỏi
                  hệ thống?
                </p>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 space-y-1">
                  <div>
                    <b>Mã cơ sở:</b>{" "}
                    <span className="font-mono">
                      {selectedFacility.code || selectedFacility.id}
                    </span>
                  </div>
                  <div>
                    <b>Địa điểm:</b> {selectedFacility.address},{" "}
                    {selectedFacility.city}
                  </div>
                  <div>
                    <b>Quy mô:</b> {selectedFacility.units} gian kho (Hiện không
                    có khách thuê)
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Hành động này sẽ xóa cơ sở và toàn bộ các gian kho trống trực
                  thuộc khỏi danh mục hệ thống.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setDeleteFacilityModal(false)}
              >
                {lang === "vi" ? "Đóng" : "Cancel"}
              </Button>
              {selectedFacility.occupied === 0 && (
                <Button
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  onClick={handleDeleteFacility}
                >
                  {lang === "vi" ? "Xác Nhận Xóa Cơ Sở" : "Delete Facility"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

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

            const totalFacilityLoadTon =
              selectedFacility.totalDesignLoadTon ??
              Math.round(
                (((selectedFacility.unitDistribution?.S ?? 0) * defaultLoadS +
                  (selectedFacility.unitDistribution?.M ?? 0) * defaultLoadM +
                  (selectedFacility.unitDistribution?.L ?? 0) * defaultLoadL +
                  (selectedFacility.unitDistribution?.XL ?? 0) * defaultLoadXL) /
                  1000) *
                10,
              ) / 10

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
                        (e.currentTarget as HTMLImageElement).src =
                          WAREHOUSE_PHOTO_PRESETS[0].url
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
                      {selectedFacility.status === "active"
                        ? lang === "vi"
                          ? "Đang hoạt động"
                          : "Active"
                        : lang === "vi"
                          ? "Bảo trì"
                          : "Maintenance"}
                    </Badge>
                  </div>
                </div>

                {/* Thông số kỹ thuật & Vận hành */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">
                      Người quản lý:
                    </span>
                    <b className="text-slate-800 block text-sm">
                      {selectedFacility.manager}
                    </b>
                    <span className="text-slate-500">
                      {selectedFacility.phone || "1900 6868"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">
                      Tỷ lệ lấp đầy:
                    </span>
                    <b className="text-slate-800 block text-sm">
                      {getFacilityOccupiedCount(selectedFacility)} /{" "}
                      {getFacilityTotalUnits(selectedFacility)} kho
                    </b>
                    <span className="text-emerald-700 font-semibold">
                      {occupancyRate}% công suất
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">
                      Doanh thu tháng (MTD):
                    </span>
                    <b className="text-slate-800 block text-sm">
                      {formatCurrency(getFacilityActualRevenue(selectedFacility))}
                    </b>
                    <span className="text-slate-500">
                      {selectedFacility.price}/tháng từ
                    </span>
                  </div>
                  <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200/80">
                    <span className="text-amber-800/80 block mb-0.5 font-medium">
                      {lang === "vi" ? "Tải trọng sàn:" : "Floor Load Limit:"}
                    </span>
                    <b className="text-amber-950 block text-sm font-bold font-mono">
                      {totalFacilityLoadTon} tấn
                    </b>
                    <span className="text-amber-700 font-medium text-[11px]">
                      {lang === "vi" ? "Thiết kế chịu tải" : "Max floor load"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    <span className="text-slate-400 block mb-0.5">
                      Giờ hoạt động:
                    </span>
                    <b className="text-slate-800 block text-xs">
                      {selectedFacility.accessHours || "06:00 - 22:00"}
                    </b>
                    <span className="text-slate-500">
                      Kho tự quản tiêu chuẩn
                    </span>
                  </div>
                </div>

                {/* Bảng phân bổ các gian kho thuộc cơ sở (S, M, L, XL) */}
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <div className="bg-stone-50 px-3 py-2 border-b border-stone-200 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">
                      Danh Mục Gian Kho Thuộc Cơ Sở (
                      {facilityUnits.length || selectedFacility.units} kho quy
                      hoạch)
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      Chuẩn S, M, L, XL
                    </span>
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-100 text-slate-700 font-semibold border-b border-stone-200">
                      <tr>
                        <th className="p-2.5">Phân loại</th>
                        <th className="p-2.5">Kích thước kho</th>
                        <th className="p-2.5">Thể tích</th>
                        <th className="p-2.5 text-center font-bold text-amber-900 bg-amber-50/50">Tải trọng (kg)</th>
                        <th className="p-2.5 text-blue-900 bg-blue-50/40">Kích thước khung</th>
                        <th className="p-2.5 text-center text-blue-900 bg-blue-50/40">Số khung</th>
                        <th className="p-2.5 hidden md:table-cell">Lối xe / Xe đẩy</th>
                        <th className="p-2.5">Số lượng</th>
                        <th className="p-2.5">Đang thuê</th>
                        <th className="p-2.5">Còn trống</th>
                        <th className="p-2.5">Đơn giá / tháng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(() => {
                        const customSpecs =
                          selectedFacility.unitCustomSpecs &&
                          Array.isArray(selectedFacility.unitCustomSpecs) &&
                          selectedFacility.unitCustomSpecs.length > 0
                            ? selectedFacility.unitCustomSpecs
                            : null

                        const allSizes: string[] = customSpecs
                          ? customSpecs.map((cs: FacilityCustomUnitSpec) => cs.sizeCode)
                          : Array.from(
                              new Set<string>([
                                ...Object.keys(selectedFacility.unitDistribution || {}),
                                ...facilityUnits.map((u) => (u as any).size || (u.type === "Small" ? "S" : u.type === "Medium" ? "M" : u.type === "Large" ? "L" : u.type === "Extra Large" ? "XL" : (u as any).sizeCode || "S")),
                                "S",
                                "M",
                                "L",
                                "XL",
                              ]),
                            )

                        return allSizes.map((size: string) => {
                          const customSpec = customSpecs?.find((cs: FacilityCustomUnitSpec) => cs.sizeCode === size)
                          const stdSpec = UNIT_SPECS[size as keyof typeof UNIT_SPECS]

                          const unitsOfSize = facilityUnits.filter(
                            (u) =>
                              ((u as any).size ||
                                (u as any).sizeCode ||
                                (u.type === "Small"
                                  ? "S"
                                  : u.type === "Medium"
                                    ? "M"
                                    : u.type === "Large"
                                      ? "L"
                                      : u.type === "Extra Large"
                                        ? "XL"
                                        : String(u.type))) === size,
                          )

                          const totalSize =
                            facilityUnits.length > 0
                              ? unitsOfSize.length
                              : (selectedFacility.unitDistribution?.[size] ?? customSpec?.count ?? 0)

                          const occupiedSize = unitsOfSize.filter(
                            (u) => u.status === "occupied" || (u.status as string) === "rented",
                          ).length

                          const availableSize =
                            unitsOfSize.filter((u) => u.status === "available").length ||
                            Math.max(0, totalSize - occupiedSize)

                          const loadKg =
                            customSpec?.maxLoadKg ??
                            selectedFacility.unitLoadLimits?.[size] ??
                            (unitsOfSize[0]?.maxLoadKg ??
                              (stdSpec?.maxLoadKg ??
                                (size === "S" ? 1000 : size === "M" ? 1600 : size === "L" ? 2800 : 4000)))

                          const lengthM =
                            customSpec?.lengthM ??
                            selectedFacility.unitDimensions?.[size]?.lengthM ??
                            stdSpec?.lengthM ??
                            8
                          const widthM =
                            customSpec?.widthM ??
                            selectedFacility.unitDimensions?.[size]?.widthM ??
                            stdSpec?.widthM ??
                            10
                          const heightM =
                            customSpec?.heightM ??
                            (selectedFacility.unitDimensions?.[size] as any)?.heightM ??
                            stdSpec?.heightM ??
                            5
                          const dimensionsStr = `${lengthM} × ${widthM} × ${heightM} m`
                          const volumeM3 = Math.round(lengthM * widthM * heightM * 10) / 10

                          // Frame info
                          const frameCount =
                            customSpec?.frameCount ??
                            selectedFacility.unitFrameCounts?.[size] ??
                            stdSpec?.frameCount ??
                            0
                          const rawFrameDims =
                            customSpec?.frameDimensions ??
                            selectedFacility.unitFrameDimensions?.[size] ??
                            (stdSpec?.frameDimensions
                              ? {
                                  lengthM: stdSpec.frameDimensions.lengthM ?? stdSpec.frameDimensions.depthM,
                                  widthM: stdSpec.frameDimensions.widthM,
                                  heightM: stdSpec.frameDimensions.heightM,
                                }
                              : undefined)

                          const frameDimStr = rawFrameDims
                            ? `${rawFrameDims.lengthM ?? (rawFrameDims as any).depthM} × ${rawFrameDims.widthM} × ${rawFrameDims.heightM} m`
                            : "-"

                          const laneWidth =
                            customSpec?.laneWidthM ??
                            selectedFacility.unitLaneWidths?.[size] ??
                            stdSpec?.vehicleLaneWidthM ??
                            4

                          const cartText = stdSpec?.cartEquipment ?? "Xe đẩy tiêu chuẩn"
                          const displayName = customSpec?.name ?? (stdSpec?.name || `Kho ${size}`)
                          const badgeClass =
                            customSpec?.badgeClass ||
                            (size === "S"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : size === "M"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : size === "L"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : size === "XL"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-rose-50 text-rose-800 border-rose-200")

                          return (
                            <tr key={size} className="hover:bg-amber-50/50">
                              <td className="p-2.5">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded font-mono text-xs font-bold border ${badgeClass}`}
                                >
                                  {size} · {displayName}
                                </span>
                              </td>
                              <td className="p-2.5 font-medium text-slate-700 font-mono">
                                {dimensionsStr}
                              </td>
                              <td className="p-2.5 text-slate-600 font-mono">
                                {volumeM3} m³
                              </td>
                              <td className="p-2.5 text-center font-bold text-stone-800 bg-amber-50/20 font-mono">
                                {loadKg.toLocaleString("vi-VN")} kg
                              </td>
                              <td className="p-2.5 font-mono text-blue-900 font-semibold bg-blue-50/30">
                                {frameDimStr}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-blue-950 bg-blue-50/30">
                                {frameCount} khung
                              </td>
                              <td className="p-2.5 hidden md:table-cell text-slate-600">
                                <div>{cartText}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  lối xe {laneWidth} m · cao {heightM} m
                                </div>
                              </td>
                              <td className="p-2.5 font-bold text-slate-800 font-mono">
                                {totalSize} kho
                              </td>
                              <td className="p-2.5 text-blue-700 font-semibold font-mono">
                                {occupiedSize} kho
                              </td>
                              <td className="p-2.5 text-emerald-700 font-semibold font-mono">
                                {availableSize} kho
                              </td>
                              <td className="p-2.5 font-mono font-bold text-emerald-800">
                                {getFacilitySizePriceFormatted(selectedFacility, size)}
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                    <tfoot className="bg-stone-50 border-t border-stone-200 font-semibold text-slate-800">
                      <tr>
                        <td colSpan={3} className="p-2.5 font-bold">
                          {lang === "vi" ? "Tổng cộng" : "Total"}
                        </td>
                        <td className="p-2.5 text-center font-bold text-amber-900 bg-amber-50/40 font-mono">
                          {totalFacilityLoadTon} tấn
                        </td>
                        <td colSpan={3} className="hidden md:table-cell"></td>
                        <td className="p-2.5 font-bold text-amber-800">
                          {selectedFacility.units} kho
                        </td>
                        <td className="p-2.5 text-blue-700 font-bold">
                          {selectedFacility.occupied || 0} kho
                        </td>
                        <td className="p-2.5 text-emerald-700 font-bold">
                          {Math.max(
                            0,
                            (selectedFacility.units || 0) -
                            (selectedFacility.occupied || 0),
                          )}{" "}
                          kho
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-800">
                          {selectedFacility.price}/tháng từ
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Khối chính sách đang áp dụng tại cơ sở này */}
                {(() => {
                  const activePoliciesForFac = policiesList.filter((p) => {
                    if (p.scopeType === "all") return true
                    if (Array.isArray(p.facilityIds) && p.facilityIds.length > 0) {
                      return (
                        p.facilityIds.includes(selectedFacility.id) ||
                        (selectedFacility.code && p.facilityIds.includes(selectedFacility.code))
                      )
                    }
                    const s = (p.scope || "").trim().toLowerCase()
                    if (["all facilities", "toàn bộ cơ sở", "all", "toàn bộ"].includes(s)) return true
                    return (
                      s.includes(selectedFacility.name.toLowerCase()) ||
                      selectedFacility.name.toLowerCase().includes(s)
                    )
                  })

                  return (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📜</span>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {lang === "vi" ? "Chính Sách & Quy Định Đang Áp Dụng" : "Active Policies & Rules"}
                          </h4>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            {activePoliciesForFac.length} {lang === "vi" ? "chính sách" : "policies"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setViewFacilityModal(false)
                            setPolicyFacilityFilter(selectedFacility.id)
                            setPage("policies")
                          }}
                          className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                        >
                          {lang === "vi" ? "Quản lý chính sách kho này →" : "Manage Policies →"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {activePoliciesForFac.map((pol) => {
                          const isGlobal =
                            pol.scopeType === "all" ||
                            (!pol.scopeType &&
                              (!pol.facilityIds || pol.facilityIds.length === 0) &&
                              (pol.scope === "All Facilities" || pol.scope === "Toàn bộ cơ sở"))

                          return (
                            <div
                              key={pol.id}
                              className="p-3 rounded-lg border border-stone-200 bg-white space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-slate-900 text-xs truncate">
                                  {pol.name}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                    isGlobal
                                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                                      : "bg-amber-50 text-amber-900 border border-amber-200"
                                  }`}
                                >
                                  {isGlobal
                                    ? lang === "vi"
                                      ? "Toàn hệ thống"
                                      : "Global"
                                    : lang === "vi"
                                      ? "Riêng cơ sở"
                                      : "Branch-specific"}
                                </span>
                              </div>
                              <div className="text-xs font-mono font-bold text-amber-800">
                                {pol.value}
                              </div>
                              {pol.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                  {pol.description}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
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
