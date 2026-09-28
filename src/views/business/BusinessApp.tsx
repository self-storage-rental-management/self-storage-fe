import { useState, useMemo, useCallback } from "react"

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

import { useStorageHub } from "../../store/StorageHubContext"

import ProfileView from "../ProfileView"

export interface PolicyItem {
  id: string

  name: string

  value: string

  scope: string

  editable: boolean

  description?: string

  lastUpdated?: string
}

export const WAREHOUSE_PHOTO_PRESETS = [
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
      permission: "view_facilities",
    },

    {
      id: "performance",
      label: "Hiệu suất vận hành",
      icon: Icon.eye,
      group: "Danh mục",
      permission: "view_reports",
    },

    {
      id: "policies",
      label: "Chính sách thuê",
      icon: Icon.policy,
      group: "Thương mại",
      permission: "view_policies",
    },

    {
      id: "pricing",
      label: "Bảng giá & Phí",
      icon: Icon.dollar,
      group: "Thương mại",
      permission: "view_policies",
    },

    // Ẩn tab Khuyến mãi & Voucher trên UI (giữ nguyên logic nghiệp vụ bên dưới)

    // { id: 'discounts', label: 'Khuyến mãi & Voucher', icon: Icon.tag, group: 'Thương mại', permission: 'view_policies' },

    {
      id: "revenue",
      label: "Báo cáo doanh thu",
      icon: Icon.chart,
      group: "Báo cáo",
      permission: "view_reports",
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

        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // fallback
    }

    return POLICIES.map((p) => ({ ...p, description: "" }))
  })

  const [policyModal, setPolicyModal] = useState(false)

  const [createPolicyModal, setCreatePolicyModal] = useState(false)

  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null)

  const [policyFormName, setPolicyFormName] = useState("")

  const [policyFormValue, setPolicyFormValue] = useState("")

  const [policyFormScope, setPolicyFormScope] = useState("Toàn bộ cơ sở")

  const [policyFormDesc, setPolicyFormDesc] = useState("")

  const savePolicies = (next: PolicyItem[]) => {
    setPoliciesList(next)

    localStorage.setItem("storagehub:policies", JSON.stringify(next))
  }

  const handleOpenCreatePolicy = () => {
    setPolicyFormName("")

    setPolicyFormValue("")

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

    const newPolicy: PolicyItem = {
      id: `pol-${Date.now()}`,

      name: policyFormName.trim(),

      value: policyFormValue.trim(),

      scope:
        policyFormScope || (lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"),

      editable: true,

      description: policyFormDesc.trim(),

      lastUpdated: new Date().toLocaleDateString("vi-VN"),
    }

    const next = [...policiesList, newPolicy]

    savePolicies(next)

    // Đồng bộ cấu hình vận hành hệ thống nếu chính sách liên quan
    const lowerName = newPolicy.name.toLowerCase()
    if (lowerName.includes("grace") || lowerName.includes("gia hạn")) {
      const num = parseInt(newPolicy.value.replace(/\D/g, ""), 10)
      if (!isNaN(num) && num > 0) {
        try { updateBusinessConfig({ gracePeriodDays: num }, user) } catch {}
      }
    } else if (lowerName.includes("late") || lowerName.includes("trễ")) {
      const num = parseInt(newPolicy.value.replace(/\D/g, ""), 10)
      try { updateBusinessConfig({ lateFeeAmount: !isNaN(num) && num > 0 ? num : 650000 }, user) } catch {}
    } else if (lowerName.includes("deposit") || lowerName.includes("đặt cọc")) {
      try { updateBusinessConfig({ defaultDepositRatio: 0.2 }, user) } catch {}
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

    setPolicyFormName(policy.name)

    setPolicyFormValue(policy.value)

    setPolicyFormScope(policy.scope)

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

    const next = policiesList.map((p) =>
      p.id === selectedPolicy.id
        ? {
            ...p,

            name: policyFormName.trim() || p.name,

            value: policyFormValue.trim(),

            scope: policyFormScope || p.scope,

            description: policyFormDesc.trim(),

            lastUpdated: new Date().toLocaleDateString("vi-VN"),
          }
        : p,
    )

    savePolicies(next)

    // Đồng bộ cấu hình vận hành hệ thống nếu chính sách liên quan
    const lowerName = (policyFormName || selectedPolicy.name).toLowerCase()
    if (lowerName.includes("grace") || lowerName.includes("gia hạn")) {
      const num = parseInt(policyFormValue.replace(/\D/g, ""), 10)
      if (!isNaN(num) && num > 0) {
        try { updateBusinessConfig({ gracePeriodDays: num }, user) } catch {}
      }
    } else if (lowerName.includes("late") || lowerName.includes("trễ")) {
      const num = parseInt(policyFormValue.replace(/\D/g, ""), 10)
      try { updateBusinessConfig({ lateFeeAmount: !isNaN(num) && num > 0 ? num : 650000 }, user) } catch {}
    } else if (lowerName.includes("deposit") || lowerName.includes("đặt cọc")) {
      try { updateBusinessConfig({ defaultDepositRatio: 0.2 }, user) } catch {}
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

      return REVENUE_DATA.map((item) => {
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

    return REVENUE_DATA.map((item, idx) => {
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
        idx === REVENUE_DATA.length - 1 ? activeContractsCount : 0

      // Tỷ lệ lấp đầy:
      const monthOccRate =
        idx === REVENUE_DATA.length - 1 && facOccPct > 0
          ? `${facOccPct}%`
          : "0%"
      const monthOccNumber =
        idx === REVENUE_DATA.length - 1 && facOccPct > 0 ? facOccPct / 100 : 0

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

  const [pricingTiers, setPricingTiers] =
    useState<PricingTierItem[]>(PRICING_TIERS)

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
    } catch {}
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

  const getEffectiveTier = (tier: PricingTierItem) => {
    if (
      selectedPricingFacility &&
      facilityPricingOverrides[selectedPricingFacility.id]?.[tier.id]
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

  // Helper lấy giá thực tế theo từng cỡ kho (S, M, L, XL) của một cơ sở
  const getFacilitySizePrice = useCallback(
    (fac: any, size: "S" | "M" | "L" | "XL"): number => {
      if (!fac) return UNIT_SPECS[size].priceMonthly

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

      // 5. Mặc định theo quy chuẩn UNIT_SPECS
      return UNIT_SPECS[size].priceMonthly
    },
    [facilityPricingOverrides, unitsList],
  )

  const getFacilitySizePriceFormatted = useCallback(
    (fac: any, size: "S" | "M" | "L" | "XL"): string => {
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
      } catch {}

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
        } catch {}
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
      setPricingTiers((prev) =>
        prev.map((t) =>
          t.id === selectedTier.id
            ? {
                ...t,
                basePrice: updatedPrice,
                highDemandMultiplier: updatedMultiplier,
              }
            : t,
        ),
      )

      // Đồng bộ ngược lại UNIT_SPECS
      const sizeCode =
        selectedTier.sizeCode ||
        (selectedTier.name.includes("(S)")
          ? "S"
          : selectedTier.name.includes("(M)")
            ? "M"
            : selectedTier.name.includes("(XL)")
              ? "XL"
              : "L")

      if (sizeCode && UNIT_SPECS[sizeCode as keyof typeof UNIT_SPECS]) {
        UNIT_SPECS[sizeCode as keyof typeof UNIT_SPECS].priceMonthly = updatedPrice
        UNIT_SPECS[sizeCode as keyof typeof UNIT_SPECS].priceFormatted = `${Math.round(updatedPrice).toLocaleString("vi-VN")}đ`
      }

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
          } catch {}
        })
    }

    setPricingModal(false)
    showToast(
      lang === "vi"
        ? `Đã cập nhật bảng giá "${selectedTier.name}"${
            selectedPricingFacility
              ? ` cho ${selectedPricingFacility.name}`
              : " (Toàn hệ thống)"
          }: ${formatCurrency(updatedPrice)}/tháng!`
        : "Pricing tier updated!",
    )
  }

  // Discounts & Promotions interactive state

  const [promotionsList, setPromotionsList] =
    useState<PromotionItem[]>(DISCOUNTS)

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

  const [formFacUnits, setFormFacUnits] = useState<number>(20)

  const [formFacUnitS, setFormFacUnitS] = useState<number>(5)

  const [formFacUnitM, setFormFacUnitM] = useState<number>(5)

  const [formFacUnitL, setFormFacUnitL] = useState<number>(5)

  const [formFacUnitXL, setFormFacUnitXL] = useState<number>(5)

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

  const [formFacClimate, setFormFacClimate] = useState<boolean>(false)

  const [formFacSecurity, setFormFacSecurity] = useState<string>(
    "Khóa riêng tự quản, Bảo vệ cổng",
  )

  const [formFacAccessHours, setFormFacAccessHours] = useState<string>(
    "06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)",
  )

  const [formFacStatus, setFormFacStatus] = useState<"active" | "maintenance">(
    "active",
  )

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

    setFormFacUnitS(5)

    setFormFacUnitM(5)

    setFormFacUnitL(5)

    setFormFacUnitXL(5)

    setFormFacUnits(20)

    setFormFacPriceS("5.500.000đ")
    setFormFacPriceM("9.500.000đ")
    setFormFacPriceL("15.000.000đ")
    setFormFacPriceXL("22.500.000đ")
    setFormFacPrice("5.500.000đ")

    setFormFacLoadS(1000)
    setFormFacLoadM(1600)
    setFormFacLoadL(2800)
    setFormFacLoadXL(4000)
    setFormFacImage(WAREHOUSE_PHOTO_PRESETS[0].url)

    setFormFacClimate(false)

    setFormFacSecurity("Khóa riêng tự quản, Bảo vệ cổng")

    setFormFacAccessHours("06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)")

    setFormFacStatus("active")

    setCreateFacilityModal(true)
  }

  const handleCreateFacility = () => {
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

    const totalCalculatedUnits =
      formFacUnitS + formFacUnitM + formFacUnitL + formFacUnitXL

    if (totalCalculatedUnits <= 0) {
      showToast(
        lang === "vi"
          ? "Vui lòng chỉ định ít nhất 1 gian kho cho cơ sở!"
          : "Please specify at least 1 storage unit!",
      )

      return
    }

    const parseVnd = (str: string) => {
      const n = parseInt(str.replace(/\D/g, ""), 10)
      return isNaN(n) ? 0 : n
    }
    let pS = parseVnd(formFacPriceS) || UNIT_SPECS.S.priceMonthly
    let pM = parseVnd(formFacPriceM) || UNIT_SPECS.M.priceMonthly
    let pL = parseVnd(formFacPriceL) || UNIT_SPECS.L.priceMonthly
    let pXL = parseVnd(formFacPriceXL) || UNIT_SPECS.XL.priceMonthly

    const activeSizes = (["S", "M", "L", "XL"] as const).filter((s) => {
      if (s === "S") return formFacUnitS > 0
      if (s === "M") return formFacUnitM > 0
      if (s === "L") return formFacUnitL > 0
      return formFacUnitXL > 0
    })

    const enteredStartPrice = parseVnd(formFacPrice)
    if (enteredStartPrice > 0) {
      if (activeSizes.length === 1) {
        const only = activeSizes[0]
        if (only === "XL") pXL = enteredStartPrice
        else if (only === "L") pL = enteredStartPrice
        else if (only === "M") pM = enteredStartPrice
        else if (only === "S") pS = enteredStartPrice
      } else if (activeSizes.length > 1) {
        const first = activeSizes[0]
        if (first === "S") pS = enteredStartPrice
        else if (first === "M") pM = enteredStartPrice
        else if (first === "L") pL = enteredStartPrice
        else if (first === "XL") pXL = enteredStartPrice
      }
    }

    const newUnitPrices = { S: pS, M: pM, L: pL, XL: pXL }

    const totalDesignLoadTon = Math.round(
      ((formFacUnitS * formFacLoadS) +
       (formFacUnitM * formFacLoadM) +
       (formFacUnitL * formFacLoadL) +
       (formFacUnitXL * formFacLoadXL)) / 1000 * 10
    ) / 10

    const unitLoadLimits = {
      S: formFacLoadS,
      M: formFacLoadM,
      L: formFacLoadL,
      XL: formFacLoadXL,
    }

    const created = createFacility(
      {
        code,

        name: formFacName.trim(),

        address: formFacAddress.trim(),

        city: formFacCity.trim(),

        manager: formFacManager.trim() || "Quản lý cơ sở",

        phone: formFacPhone.trim() || "1900 6868",

        units: totalCalculatedUnits,

        unitDistribution: {
          S: formFacUnitS,

          M: formFacUnitM,

          L: formFacUnitL,

          XL: formFacUnitXL,
        },

        price:
          formFacPrice.trim() ||
          `${Math.round(enteredStartPrice || pS).toLocaleString("vi-VN")}đ`,

        unitPrices: newUnitPrices,

        unitLoadLimits,

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
    } catch {}

    setCreateFacilityModal(false)

    const breakdownStr = `S: ${formFacUnitS} · M: ${formFacUnitM} · L: ${formFacUnitL} · XL: ${formFacUnitXL} · Tải trọng sàn: ${totalDesignLoadTon} tấn`

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
    setFormFacImage(f.image || WAREHOUSE_PHOTO_PRESETS[0].url)

    setFormFacClimate(Boolean(f.climate))

    setFormFacSecurity(f.security || "Khóa riêng tự quản, Bảo vệ cổng")

    setFormFacAccessHours(
      f.accessHours || "06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)",
    )

    setFormFacStatus(f.status)

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

    const totalCalculatedUnits =
      formFacUnitS + formFacUnitM + formFacUnitL + formFacUnitXL

    if (totalCalculatedUnits <= 0) {
      showToast(
        lang === "vi"
          ? "Vui lòng chỉ định ít nhất 1 gian kho cho cơ sở!"
          : "Please specify at least 1 storage unit!",
      )

      return
    }

    // Validation: không cho phép giảm số lượng thấp hơn số gian kho đang được thuê (occupied)

    const facUnits = unitsList.filter(
      (u) =>
        u.facilityId === selectedFacility.id ||
        u.facilityId === selectedFacility.code,
    )

    const getOcc = (size: "S" | "M" | "L" | "XL") =>
      facUnits.filter((u) => {
        const s =
          (u as any).size ||
          (u.type === "Small"
            ? "S"
            : u.type === "Medium"
              ? "M"
              : u.type === "Large"
                ? "L"
                : "XL")

        return (
          s === size &&
          (u.status === "occupied" || (u.status as string) === "rented")
        )
      }).length

    const occS = getOcc("S")

    const occM = getOcc("M")

    const occL = getOcc("L")

    const occXL = getOcc("XL")

    if (formFacUnitS < occS) {
      showToast(
        lang === "vi"
          ? `Không thể giảm Kho S xuống ${formFacUnitS} vì hiện có ${occS} gian kho đang được thuê.`
          : `Cannot reduce Unit S to ${formFacUnitS} because ${occS} units are occupied.`,
      )

      return
    }

    if (formFacUnitM < occM) {
      showToast(
        lang === "vi"
          ? `Không thể giảm Kho M xuống ${formFacUnitM} vì hiện có ${occM} gian kho đang được thuê.`
          : `Cannot reduce Unit M to ${formFacUnitM} because ${occM} units are occupied.`,
      )

      return
    }

    if (formFacUnitL < occL) {
      showToast(
        lang === "vi"
          ? `Không thể giảm Kho L xuống ${formFacUnitL} vì hiện có ${occL} gian kho đang được thuê.`
          : `Cannot reduce Unit L to ${formFacUnitL} because ${occL} units are occupied.`,
      )

      return
    }

    if (formFacUnitXL < occXL) {
      showToast(
        lang === "vi"
          ? `Không thể giảm Kho XL xuống ${formFacUnitXL} vì hiện có ${occXL} gian kho đang được thuê.`
          : `Cannot reduce Unit XL to ${formFacUnitXL} because ${occXL} units are occupied.`,
      )

      return
    }

    const parseVnd = (str: string) => {
      const n = parseInt(str.replace(/\D/g, ""), 10)
      return isNaN(n) ? 0 : n
    }
    let pS = parseVnd(formFacPriceS) || UNIT_SPECS.S.priceMonthly
    let pM = parseVnd(formFacPriceM) || UNIT_SPECS.M.priceMonthly
    let pL = parseVnd(formFacPriceL) || UNIT_SPECS.L.priceMonthly
    let pXL = parseVnd(formFacPriceXL) || UNIT_SPECS.XL.priceMonthly

    const activeSizes = (["S", "M", "L", "XL"] as const).filter((s) => {
      if (s === "S") return formFacUnitS > 0
      if (s === "M") return formFacUnitM > 0
      if (s === "L") return formFacUnitL > 0
      return formFacUnitXL > 0
    })

    const enteredStartPrice = parseVnd(formFacPrice)
    if (enteredStartPrice > 0) {
      if (activeSizes.length === 1) {
        const only = activeSizes[0]
        if (only === "XL") pXL = enteredStartPrice
        else if (only === "L") pL = enteredStartPrice
        else if (only === "M") pM = enteredStartPrice
        else if (only === "S") pS = enteredStartPrice
      } else if (activeSizes.length > 1) {
        const first = activeSizes[0]
        if (first === "S") pS = enteredStartPrice
        else if (first === "M") pM = enteredStartPrice
        else if (first === "L") pL = enteredStartPrice
        else if (first === "XL") pXL = enteredStartPrice
      }
    }

    const updatedUnitPrices = { S: pS, M: pM, L: pL, XL: pXL }

    const totalDesignLoadTon = Math.round(
      ((formFacUnitS * formFacLoadS) +
       (formFacUnitM * formFacLoadM) +
       (formFacUnitL * formFacLoadL) +
       (formFacUnitXL * formFacLoadXL)) / 1000 * 10
    ) / 10

    const unitLoadLimits = {
      S: formFacLoadS,
      M: formFacLoadM,
      L: formFacLoadL,
      XL: formFacLoadXL,
    }

    const finalPriceStr =
      formFacPrice.trim() ||
      `${Math.round(enteredStartPrice || pS).toLocaleString("vi-VN")}đ`

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

        unitDistribution: {
          S: formFacUnitS,

          M: formFacUnitM,

          L: formFacUnitL,

          XL: formFacUnitXL,
        },

        price: finalPriceStr,

        unitPrices: updatedUnitPrices,

        unitLoadLimits,

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
    } catch {}

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
          } catch {}
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
                : `${facilitiesList.length} ${
                    facilitiesList.length === 1 ? "facility" : "facilities"
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
              value={`${
                totalUnits ? Math.round((totalOccupied / totalUnits) * 100) : 0
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
                const facCode = f.code || f.id

                const totalUnitsInFac = getFacilityTotalUnits(f)
                const occupiedInFac = getFacilityOccupiedCount(f)
                const occupancyRate = totalUnitsInFac
                  ? Math.round((occupiedInFac / totalUnitsInFac) * 100)
                  : 0

                return (
                  <Card
                    key={f.id}
                    className="p-5 hover:border-amber-400/70 transition-all border border-stone-200/90 shadow-sm bg-white"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Facility photo */}
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0 hidden sm:block">
                          <img
                            src={
                              f.image?.startsWith("http") || f.image?.startsWith("data:")
                                ? f.image
                                : `https://images.unsplash.com/${f.image || "photo-1586528116311-ad8dd3c8310d"}?w=240&auto=format&fit=crop`
                            }
                            alt={f.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                WAREHOUSE_PHOTO_PRESETS[0].url
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                        {/* Hàng 1: Mã cơ sở + Tên + Badge trạng thái */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-100/80 text-amber-900 border border-amber-300">
                            {facCode}
                          </span>
                          <h3 className="font-bold text-slate-900 text-lg leading-snug">
                            {f.name}
                          </h3>
                          <Badge
                            variant={
                              f.status === "active" ? "success" : "warning"
                            }
                          >
                            {f.status === "active"
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
                            <span className="truncate" title={f.address}>
                              {f.address} ·{" "}
                              <b className="text-slate-800">{f.city}</b>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>
                              Quản lý:{" "}
                              <b className="text-slate-800">{f.manager}</b>{" "}
                              {f.phone ? `(${f.phone})` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="truncate"
                              title={f.accessHours || "06:00 - 22:00"}
                            >
                              {f.accessHours || "06:00 - 22:00 (24/7 VIP)"}
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
                      </div>
                    </div>

                      {/* Các nút hành động */}
                      <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold"
                          onClick={() => {
                            setSelectedFacility(f)

                            setViewFacilityModal(true)
                          }}
                        >
                          {lang === "vi" ? "Chi tiết" : "Details"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold border-amber-300 text-amber-800 hover:bg-amber-50"
                          onClick={() => handleOpenEditFacility(f)}
                        >
                          {lang === "vi" ? "Chỉnh sửa" : "Edit"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                          onClick={() => {
                            setSelectedFacility(f)

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
        <div className="fade-in">
          <SectionHeader
            title={
              lang === "vi"
                ? "Quy Định & Chính Sách Thuê Kho"
                : "Rental Policies"
            }
            subtitle={
              lang === "vi"
                ? "Các điều khoản, quy chế thương mại áp dụng thống nhất toàn hệ thống"
                : "Company-wide rental terms and conditions"
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
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === "vi" ? "Tên Chính Sách" : "Policy Name"}</Th>
                  <Th>{lang === "vi" ? "Giá Trị Áp Dụng" : "Current Value"}</Th>
                  <Th>{lang === "vi" ? "Phạm Vi" : "Scope"}</Th>
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
                {policiesList.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8 text-slate-400">
                      {lang === "vi"
                        ? 'Chưa có chính sách nào. Hãy bấm "Thêm Chính Sách" để bắt đầu.'
                        : "No policies found."}
                    </Td>
                  </Tr>
                ) : (
                  policiesList.map((p) => {
                    const displayName =
                      lang === "vi"
                        ? p.name === "Grace Period"
                          ? "Thời gian gia hạn nợ"
                          : p.name === "Late Fee"
                            ? "Mức phí phạt trễ hạn"
                            : p.name === "Security Deposit"
                              ? "Tiền đặt cọc an ninh"
                              : p.name === "Notice to Vacate"
                                ? "Thời hạn báo trước khi trả phòng"
                                : p.name === "Minimum Lease"
                                  ? "Thời hạn thuê tối thiểu"
                                  : p.name
                        : p.name

                    const displayValue =
                      lang === "vi"
                        ? p.value.includes("days")
                          ? p.value.replace("days", "ngày")
                          : p.value.includes("month")
                            ? p.value
                                .replace("$25", "650.000 ₫")
                                .replace("month", "tháng")
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
                          <Badge variant="muted">
                            {lang === "vi"
                              ? p.scope === "All Facilities"
                                ? "Toàn bộ cơ sở"
                                : p.scope
                              : p.scope}
                          </Badge>
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
                      onClick={() => setPricingFacilityFilter(fac.id)}
                      className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                    >
                      Chỉnh giá cơ sở này
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
                {FEES.map((f) => (
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
                  delta={`${Math.round((totalRedemptions / (totalCapacity || 1)) * 100)}% ${
                    lang === "vi" ? "hạn ngạch đã nhận" : "quota claimed"
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
                {REVENUE_BREAKDOWN.map((item) => (
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
                  data={CONVERSION_DATA}
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
        title={lang === "vi" ? "Chỉnh Sửa Phân Tầng Giá" : "Edit Pricing Tier"}
      >
        {selectedTier && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                {lang === "vi" ? "Đang chỉnh sửa:" : "Editing:"}{" "}
                <strong className="text-slate-900">{selectedTier.name}</strong>
              </p>
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 mt-1.5 inline-block">
                {lang === "vi" ? "Cơ sở áp dụng: " : "Target facility: "}
                <strong>
                  {selectedPricingFacility
                    ? `${selectedPricingFacility.name} (${selectedPricingFacility.code || selectedPricingFacility.id})`
                    : lang === "vi"
                      ? "Toàn bộ hệ thống cơ sở"
                      : "All facilities"}
                </strong>
              </p>
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

            <Select
              label={lang === "vi" ? "Phạm vi áp dụng" : "Scope"}
              value={policyFormScope}
              onChange={(e) => setPolicyFormScope(e.target.value)}
            >
              <option
                value={lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"}
              >
                {lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"}
              </option>
              {facilitiesList.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name} ({f.city})
                </option>
              ))}
            </Select>

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
                ? "VD: Thời gian gia hạn nợ, Phí phạt trễ hạn, Tiền cọc an ninh..."
                : "E.g. Grace Period, Late Fee..."
            }
            value={policyFormName}
            onChange={(e) => setPolicyFormName(e.target.value)}
          />

          <Input
            label={lang === "vi" ? "Giá trị áp dụng" : "Current Value"}
            placeholder={
              lang === "vi"
                ? "VD: 5 ngày, 650.000 ₫ / tháng, 1 tháng tiền thuê..."
                : "E.g. 5 days, 1 month..."
            }
            value={policyFormValue}
            onChange={(e) => setPolicyFormValue(e.target.value)}
          />

          <Select
            label={lang === "vi" ? "Phạm vi áp dụng" : "Scope"}
            value={policyFormScope}
            onChange={(e) => setPolicyFormScope(e.target.value)}
          >
            <option value={lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"}>
              {lang === "vi" ? "Toàn bộ cơ sở" : "All Facilities"}
            </option>
            {facilitiesList.map((f) => (
              <option key={f.id} value={f.name}>
                {f.name} ({f.city})
              </option>
            ))}
          </Select>

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

      {/* ── MODALS QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ─────────── */}
      {(() => {
        // Shared size specifications for compact form table — derived from UNIT_SPECS
        const FACILITY_SIZE_SPECS = (
          [
            { size: "S" as const, name: "Kho Nhỏ", badgeClass: "bg-sky-50 text-sky-700 border-sky-200" },
            { size: "M" as const, name: "Kho Trung", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { size: "L" as const, name: "Kho Lớn", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
            { size: "XL" as const, name: "Rất Lớn", badgeClass: "bg-amber-50 text-amber-800 border-amber-200" },
          ] as const
        ).map(({ size, name, badgeClass }) => {
          const s = UNIT_SPECS[size]
          return {
            size,
            name,
            dimensions: `${s.lengthM} × ${s.widthM} × ${s.heightM} m`,
            areaM2: `${s.areaM2} m²`,
            volumeM3: `${s.volumeM3} m³`,
            heightM: `${s.heightM} m`,
            frameCount: s.frameCount,
            frameDistanceM: s.frameDistanceM,
            vehicleLaneWidthM: s.vehicleLaneWidthM,
            smallBox: s.smallBox,
            largeBox: s.largeBox,
            cartEquipment: s.cartEquipment,
            badgeClass,
          }
        })

        const getFormUnitQty = (size: "S" | "M" | "L" | "XL") => {
          if (size === "S") return formFacUnitS

          if (size === "M") return formFacUnitM

          if (size === "L") return formFacUnitL

          return formFacUnitXL
        }

        const calculatedTotalLoadTon =
          Math.round(
            ((formFacUnitS * formFacLoadS +
              formFacUnitM * formFacLoadM +
              formFacUnitL * formFacLoadL +
              formFacUnitXL * formFacLoadXL) /
              1000) *
              10,
          ) / 10

        const renderUnitAllocationSection = (
          isEditing: boolean,
          occupiedMap: Record<"S" | "M" | "L" | "XL", number> = {
            S: 0,
            M: 0,
            L: 0,
            XL: 0,
          },
        ) => {
          return (
            <div className="space-y-3 pt-2">
              {/* Highlight Header cho Section Phân Bổ Gian Kho */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-3.5 rounded-xl border border-amber-200/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 font-bold flex items-center justify-center shrink-0 shadow-xs">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                      {lang === "vi"
                        ? "Phân Bổ Gian Kho & Quy Mô Thiết Kế"
                        : "Unit Allocation & Design Scale"}
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {lang === "vi"
                        ? "Cấu hình số lượng, tải trọng tối đa và đơn giá thuê theo từng chuẩn kích thước gian kho"
                        : "Configure quantity, max load capacity, and monthly rates per unit size"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-300 text-sky-900 font-mono text-xs font-bold shadow-2xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block animate-pulse"></span>
                    <span>
                      {lang === "vi" ? "Tải trọng sàn:" : "Floor Load:"}{" "}
                      <b className="text-sky-950 font-extrabold text-sm">
                        {calculatedTotalLoadTon}
                      </b>{" "}
                      tấn
                    </span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-mono text-xs font-bold shadow-2xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>
                    <span>
                      {lang === "vi" ? "Tổng quy mô:" : "Total Units:"}{" "}
                      <b className="text-amber-950 font-extrabold text-sm">
                        {formFacUnits}
                      </b>{" "}
                      kho
                    </span>
                  </div>
                </div>
              </div>

              {/* Bảng phân bổ gian kho rộng rãi, thoáng mắt */}
              <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100/90 border-b border-stone-200 text-stone-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 min-w-[200px]">
                        {lang === "vi" ? "Cỡ & Loại Kho" : "Size & Type"}
                      </th>
                      <th className="py-3 px-3 min-w-[140px]">
                        {lang === "vi"
                          ? "Quy Cách & Thể Tích"
                          : "Dimensions & Volume"}
                      </th>
                      <th className="py-3 px-3 text-center min-w-[150px]">
                        {lang === "vi" ? "Tải Trọng Tối Đa" : "Max Load"}
                      </th>
                      <th className="py-3 px-3 text-center min-w-[170px]">
                        {lang === "vi"
                          ? "Đơn Giá Thuê / Tháng"
                          : "Monthly Rate"}
                      </th>
                      <th className="py-3 px-4 text-right min-w-[150px]">
                        {lang === "vi" ? "Số Lượng Kho" : "Quantity"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/80">
                    {FACILITY_SIZE_SPECS.map((spec) => {
                      const qty = getFormUnitQty(spec.size)
                      const occ = occupiedMap[spec.size] || 0
                      const isBelowOcc = isEditing && qty < occ

                      return (
                        <tr
                          key={spec.size}
                          className="hover:bg-amber-50/20 transition-colors"
                        >
                          {/* 1. Cỡ & Loại kho */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-9 h-9 flex items-center justify-center rounded-lg font-mono font-bold text-sm border shrink-0 shadow-2xs ${spec.badgeClass}`}
                              >
                                {spec.size}
                              </span>
                              <div>
                                <div className="font-bold text-stone-900 text-sm leading-tight">
                                  {spec.name}
                                </div>
                                <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                                  Chuẩn cỡ {spec.size}
                                </div>
                                {isEditing && occ > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 mt-1">
                                    Đang cho thuê: {occ} kho
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Quy cách & Thể tích */}
                          <td className="py-4 px-3">
                            <div className="space-y-1">
                              <div className="font-mono font-semibold text-stone-800 text-xs">
                                {spec.dimensions}
                              </div>
                              <div className="text-xs text-stone-500 font-medium">
                                Thể tích:{" "}
                                <b className="text-stone-800 font-mono">
                                  {spec.volumeM3} m³
                                </b>
                              </div>
                              <div className="text-[11px] text-stone-400 font-mono">
                                Cao {spec.heightM} · Lối xe{" "}
                                {spec.vehicleLaneWidthM} m
                              </div>
                            </div>
                          </td>

                          {/* 3. Tải trọng tối đa (kg) */}
                          <td className="py-4 px-3 text-center">
                            <div className="flex items-center justify-center">
                              <div className="relative flex items-center w-full max-w-[140px]">
                                <input
                                  type="number"
                                  min={100}
                                  step={50}
                                  className="w-full h-10 pl-3 pr-9 text-right border border-stone-300 rounded-lg font-mono font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 text-stone-900 shadow-2xs transition"
                                  value={
                                    spec.size === "S"
                                      ? formFacLoadS
                                      : spec.size === "M"
                                        ? formFacLoadM
                                        : spec.size === "L"
                                          ? formFacLoadL
                                          : formFacLoadXL
                                  }
                                  onChange={(e) => {
                                    const val = Math.max(
                                      0,
                                      parseInt(e.target.value, 10) || 0,
                                    )
                                    if (spec.size === "S") setFormFacLoadS(val)
                                    else if (spec.size === "M")
                                      setFormFacLoadM(val)
                                    else if (spec.size === "L")
                                      setFormFacLoadL(val)
                                    else setFormFacLoadXL(val)
                                  }}
                                />
                                <span className="absolute right-2.5 text-xs text-stone-400 font-bold pointer-events-none">
                                  kg
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 4. Đơn giá thuê / tháng */}
                          <td className="py-4 px-3 text-center">
                            <div className="flex items-center justify-center">
                              <div className="relative flex items-center w-full max-w-[170px]">
                                <input
                                  type="text"
                                  className="w-full h-10 px-3.5 text-right border border-stone-300 rounded-lg font-mono font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 text-emerald-800 shadow-2xs transition"
                                  value={
                                    spec.size === "S"
                                      ? formFacPriceS
                                      : spec.size === "M"
                                        ? formFacPriceM
                                        : spec.size === "L"
                                          ? formFacPriceL
                                          : formFacPriceXL
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value
                                    if (spec.size === "S") setFormFacPriceS(val)
                                    else if (spec.size === "M")
                                      setFormFacPriceM(val)
                                    else if (spec.size === "L")
                                      setFormFacPriceL(val)
                                    else setFormFacPriceXL(val)

                                    const activeSizes = (
                                      ["S", "M", "L", "XL"] as const
                                    ).filter((s) => {
                                      if (s === "S")
                                        return (
                                          (spec.size === "S"
                                            ? qty
                                            : formFacUnitS) > 0
                                        )
                                      if (s === "M")
                                        return (
                                          (spec.size === "M"
                                            ? qty
                                            : formFacUnitM) > 0
                                        )
                                      if (s === "L")
                                        return (
                                          (spec.size === "L"
                                            ? qty
                                            : formFacUnitL) > 0
                                        )
                                      return (
                                        (spec.size === "XL"
                                          ? qty
                                          : formFacUnitXL) > 0
                                      )
                                    })
                                    if (
                                      activeSizes.length > 0 &&
                                      activeSizes[0] === spec.size
                                    ) {
                                      setFormFacPrice(val)
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 5. Số lượng kho */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isEditing ? qty <= occ : qty <= 0}
                                  onClick={() =>
                                    handleUnitSizeChange(
                                      spec.size,
                                      Math.max(isEditing ? occ : 0, qty - 1),
                                    )
                                  }
                                  className="w-9 h-10 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-200 active:scale-95 font-bold text-stone-700 flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-base shadow-2xs"
                                  title="Giảm 1 kho"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  className={`w-16 h-10 text-center border rounded-lg font-mono font-bold text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 shadow-2xs transition ${
                                    isBelowOcc
                                      ? "border-red-400 text-red-700 bg-red-50"
                                      : "border-stone-300 text-stone-900"
                                  }`}
                                  value={qty}
                                  onChange={(e) => {
                                    const parsed = parseInt(e.target.value, 10)
                                    handleUnitSizeChange(
                                      spec.size,
                                      isNaN(parsed) ? 0 : Math.max(0, parsed),
                                    )
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUnitSizeChange(spec.size, qty + 1)
                                  }
                                  className="w-9 h-10 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-200 active:scale-95 font-bold text-stone-700 flex items-center justify-center transition cursor-pointer text-base shadow-2xs"
                                  title="Tăng 1 kho"
                                >
                                  +
                                </button>
                              </div>
                              {isBelowOcc && (
                                <div className="text-[11px] font-semibold text-red-600 text-right mt-1">
                                  Tối thiểu {occ} (đang thuê)
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-stone-50 border-t-2 border-stone-200 font-semibold text-stone-800">
                    <tr>
                      <td colSpan={2} className="py-3.5 px-4">
                        <div className="font-bold text-stone-900 text-sm">
                          {lang === "vi"
                            ? "Tổng cộng thiết kế quy hoạch"
                            : "Total Facility Plan"}
                        </div>
                        <div className="text-[11px] text-stone-500 font-normal">
                          {lang === "vi"
                            ? "Toàn bộ gian kho thuộc cơ sở lưu trữ"
                            : "All storage units in facility"}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100/80 border border-sky-300 text-sky-950 font-extrabold text-sm shadow-2xs">
                          <span className="text-xs font-semibold text-sky-800">
                            {lang === "vi" ? "Tổng tải:" : "Total load:"}
                          </span>
                          <span>{calculatedTotalLoadTon}</span>
                          <span className="text-xs font-semibold text-sky-800">
                            tấn
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center text-xs text-stone-400">
                        <span className="font-mono text-stone-600 font-medium">
                          {lang === "vi" ? "Từ" : "From"} {formFacPrice}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-extrabold text-sm shadow-2xs">
                          <span className="text-base font-black">
                            {formFacUnits}
                          </span>
                          <span className="text-xs font-bold text-amber-900">
                            {lang === "vi" ? "kho" : "units"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        }

        const renderFacilityImageSection = () => (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {lang === "vi" ? "Hình ảnh cơ sở & kho bãi" : "Facility & Warehouse Photos"}
              </h4>
              <span className="text-[11px] text-stone-400">
                {lang === "vi" ? "Đồng bộ hiển thị lên thẻ kho khách hàng" : "Synced with customer warehouse card"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div className="relative w-full sm:w-44 h-32 rounded-lg overflow-hidden bg-stone-200 border border-stone-300 shrink-0 group">
                  <img
                    src={formFacImage || WAREHOUSE_PHOTO_PRESETS[0].url}
                    alt="Facility preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = WAREHOUSE_PHOTO_PRESETS[0].url
                    }}
                  />
                  <div className="absolute inset-0 bg-stone-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="cursor-pointer bg-white/95 text-stone-800 text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-white flex items-center gap-1.5 transition">
                      <svg className="w-3.5 h-3.5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>{lang === "vi" ? "Đổi ảnh" : "Change"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileUpload}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      {lang === "vi" ? "Tải ảnh từ máy tính hoặc dán link ảnh (URL)" : "Upload from device or paste image URL"}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="https://... hoặc chọn file từ máy tính"
                        value={formFacImage}
                        onChange={(e) => setFormFacImage(e.target.value)}
                      />
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold rounded-lg text-xs shrink-0 transition shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>{lang === "vi" ? "Chọn file" : "Upload"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-medium text-stone-500 mb-1">
                      {lang === "vi" ? "Hoặc chọn nhanh từ thư viện ảnh kho mẫu chuẩn:" : "Or select from preset warehouse photos:"}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {WAREHOUSE_PHOTO_PRESETS.map((p) => {
                        const isSelected = formFacImage === p.url
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setFormFacImage(p.url)}
                            className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition ${
                              isSelected
                                ? "border-amber-500 bg-amber-50/80 ring-1 ring-amber-400"
                                : "border-stone-200 bg-white hover:border-stone-300"
                            }`}
                          >
                            <img src={p.url} alt={p.title} className="w-8 h-8 rounded object-cover shrink-0" />
                            <span className="text-[10px] font-medium text-stone-700 truncate leading-tight">
                              {p.title}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

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
              size="2xl"
            >
              <div className="space-y-4">
                {/* Thông tin cơ sở */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                    {lang === "vi" ? "Thông tin cơ sở" : "Facility Information"}
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          {lang === "vi"
                            ? "Mã cơ sở / Mã kho *"
                            : "Facility Code *"}
                        </label>
                        <input
                          type="text"
                          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                          placeholder="VD: HN-F02"
                          value={formFacCode}
                          onChange={(e) =>
                            setFormFacCode(e.target.value.toUpperCase())
                          }
                        />
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          Quy chuẩn: Tỉnh/TP - Số thứ tự (VD: HN-F02)
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          {lang === "vi"
                            ? "Tỉnh / Thành phố *"
                            : "City / Province *"}
                        </label>
                        <Select
                          value={formFacCity}
                          onChange={(e) => {
                            const newCity = e.target.value

                            setFormFacCity(newCity)

                            const autoCode = suggestFacilityCode(newCity)

                            setFormFacCode(autoCode)

                            if (formFacName.includes("Cơ sở")) {
                              setFormFacName(`Kho Việt – Cơ sở ${newCity}`)
                            }
                          }}
                        >
                          <option value="Hà Nội">Hà Nội</option>
                          <option value="TP. Hồ Chí Minh">
                            TP. Hồ Chí Minh
                          </option>
                          <option value="Bình Dương">Bình Dương</option>
                          <option value="Đà Nẵng">Đà Nẵng</option>
                          <option value="Cần Thơ">Cần Thơ</option>
                          <option value="Hải Phòng">Hải Phòng</option>
                          <option value="Đồng Nai">Đồng Nai</option>
                          <option value="Vũng Tàu">Vũng Tàu</option>
                          <option value="Nha Trang">Nha Trang</option>
                        </Select>
                      </div>
                    </div>

                    <Input
                      label={
                        lang === "vi"
                          ? "Tên cơ sở / Chi nhánh kho *"
                          : "Facility Name *"
                      }
                      placeholder="VD: Kho Việt – Cơ sở Hà Nội..."
                      value={formFacName}
                      onChange={(e) => setFormFacName(e.target.value)}
                    />

                    <Input
                      label={
                        lang === "vi"
                          ? "Địa điểm / Địa chỉ chi tiết *"
                          : "Street Address *"
                      }
                      placeholder="VD: Số 123 Đường Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy..."
                      value={formFacAddress}
                      onChange={(e) => setFormFacAddress(e.target.value)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={
                          lang === "vi"
                            ? "Người quản lý chi nhánh"
                            : "Facility Manager"
                        }
                        placeholder="VD: Trần Văn Quản Lý..."
                        value={formFacManager}
                        onChange={(e) => setFormFacManager(e.target.value)}
                      />
                      <Input
                        label={
                          lang === "vi" ? "Hotline liên hệ" : "Phone / Hotline"
                        }
                        placeholder="VD: 024 3822 9999..."
                        value={formFacPhone}
                        onChange={(e) => setFormFacPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Hình ảnh cơ sở & kho bãi */}
                {renderFacilityImageSection()}

                {/* Quy mô & phân bổ kho */}
                {renderUnitAllocationSection(false)}

                {/* Thông số vận hành */}
                <div className="pt-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                    {lang === "vi" ? "Thông số vận hành" : "Operation Settings"}
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label={
                          lang === "vi"
                            ? "Giá cơ sở từ / tháng"
                            : "Starting Price"
                        }
                        placeholder="5.500.000đ"
                        value={formFacPrice}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormFacPrice(val)
                          const activeSizes = (["S", "M", "L", "XL"] as const).filter((s) => {
                            if (s === "S") return formFacUnitS > 0
                            if (s === "M") return formFacUnitM > 0
                            if (s === "L") return formFacUnitL > 0
                            return formFacUnitXL > 0
                          })
                          if (activeSizes.length === 1) {
                            const only = activeSizes[0]
                            if (only === "XL") setFormFacPriceXL(val)
                            else if (only === "L") setFormFacPriceL(val)
                            else if (only === "M") setFormFacPriceM(val)
                            else if (only === "S") setFormFacPriceS(val)
                          } else if (activeSizes.length > 1) {
                            const first = activeSizes[0]
                            if (first === "S") setFormFacPriceS(val)
                            else if (first === "M") setFormFacPriceM(val)
                            else if (first === "L") setFormFacPriceL(val)
                            else if (first === "XL") setFormFacPriceXL(val)
                          }
                        }}
                      />
                      <Input
                        label={
                          lang === "vi"
                            ? "Khung giờ ra vào / Giờ mở cửa"
                            : "Access Hours"
                        }
                        placeholder="06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)"
                        value={formFacAccessHours}
                        onChange={(e) => setFormFacAccessHours(e.target.value)}
                      />
                      <Select
                        label={
                          lang === "vi"
                            ? "Trạng thái ban đầu"
                            : "Initial Status"
                        }
                        value={formFacStatus}
                        onChange={(e) =>
                          setFormFacStatus(e.target.value as any)
                        }
                      >
                        <option value="active">
                          {lang === "vi" ? "Đang hoạt động (Active)" : "Active"}
                        </option>
                        <option value="maintenance">
                          {lang === "vi" ? "Bảo trì" : "Maintenance"}
                        </option>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Sticky footer */}
                <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex justify-end items-center gap-2 z-10">
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
                      formFacUnits <= 0
                    }
                    onClick={handleCreateFacility}
                  >
                    {lang === "vi" ? "Lưu Cơ Sở Mới" : "Save Facility"}
                  </Button>
                </div>
              </div>
            </Modal>

            {/* 2. Modal Chỉnh Sửa Cơ Sở (Edit Facility) */}
            <Modal
              open={editFacilityModal}
              onClose={() => setEditFacilityModal(false)}
              title={
                lang === "vi" ? "Chỉnh Sửa Thông Tin Cơ Sở" : "Edit Facility"
              }
              size="2xl"
            >
              {selectedFacility &&
                (() => {
                  const facUnits = unitsList.filter(
                    (u) =>
                      u.facilityId === selectedFacility.id ||
                      u.facilityId === selectedFacility.code,
                  )

                  const occMap = {
                    S: facUnits.filter(
                      (u) =>
                        ((u as any).size === "S" || u.type === "Small") &&
                        (u.status === "occupied" ||
                          u.status as string === "rented"),
                    ).length,

                    M: facUnits.filter(
                      (u) =>
                        ((u as any).size === "M" || u.type === "Medium") &&
                        (u.status === "occupied" ||
                          u.status as string === "rented"),
                    ).length,

                    L: facUnits.filter(
                      (u) =>
                        ((u as any).size === "L" || u.type === "Large") &&
                        (u.status === "occupied" ||
                          u.status as string === "rented"),
                    ).length,

                    XL: facUnits.filter(
                      (u) =>
                        ((u as any).size === "XL" ||
                          u.type === "Extra Large") &&
                        (u.status === "occupied" ||
                          u.status as string === "rented"),
                    ).length,
                  }

                  return (
                    <div className="space-y-4">
                      {/* Thông tin cơ sở */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                          {lang === "vi"
                            ? "Thông tin cơ sở"
                            : "Facility Information"}
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-stone-700 mb-1">
                                {lang === "vi"
                                  ? "Mã cơ sở / Mã kho *"
                                  : "Facility Code *"}
                              </label>
                              <input
                                type="text"
                                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                                value={formFacCode}
                                onChange={(e) =>
                                  setFormFacCode(e.target.value.toUpperCase())
                                }
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-stone-700 mb-1">
                                {lang === "vi"
                                  ? "Tỉnh / Thành phố *"
                                  : "City / Province *"}
                              </label>
                              <input
                                type="text"
                                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={formFacCity}
                                onChange={(e) => setFormFacCity(e.target.value)}
                              />
                            </div>
                          </div>

                          <Input
                            label={
                              lang === "vi"
                                ? "Tên cơ sở / Chi nhánh kho *"
                                : "Facility Name *"
                            }
                            value={formFacName}
                            onChange={(e) => setFormFacName(e.target.value)}
                          />

                          <Input
                            label={
                              lang === "vi"
                                ? "Địa điểm / Địa chỉ chi tiết *"
                                : "Address *"
                            }
                            value={formFacAddress}
                            onChange={(e) => setFormFacAddress(e.target.value)}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              label={
                                lang === "vi"
                                  ? "Người quản lý chi nhánh"
                                  : "Manager"
                              }
                              value={formFacManager}
                              onChange={(e) =>
                                setFormFacManager(e.target.value)
                              }
                            />
                            <Input
                              label={
                                lang === "vi" ? "Hotline liên hệ" : "Phone"
                              }
                              value={formFacPhone}
                              onChange={(e) => setFormFacPhone(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Hình ảnh cơ sở & kho bãi */}
                      {renderFacilityImageSection()}

                      {/* Quy mô & phân bổ kho */}
                      {renderUnitAllocationSection(true, occMap)}

                      {/* Thông số vận hành */}
                      <div className="pt-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                          {lang === "vi"
                            ? "Thông số vận hành"
                            : "Operation Settings"}
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Input
                              label={
                                lang === "vi"
                                  ? "Giá cơ sở từ"
                                  : "Starting Price"
                              }
                              value={formFacPrice}
                              onChange={(e) => {
                                const val = e.target.value
                                setFormFacPrice(val)
                                const activeSizes = (["S", "M", "L", "XL"] as const).filter((s) => {
                                  if (s === "S") return formFacUnitS > 0
                                  if (s === "M") return formFacUnitM > 0
                                  if (s === "L") return formFacUnitL > 0
                                  return formFacUnitXL > 0
                                })
                                if (activeSizes.length === 1) {
                                  const only = activeSizes[0]
                                  if (only === "XL") setFormFacPriceXL(val)
                                  else if (only === "L") setFormFacPriceL(val)
                                  else if (only === "M") setFormFacPriceM(val)
                                  else if (only === "S") setFormFacPriceS(val)
                                } else if (activeSizes.length > 1) {
                                  const first = activeSizes[0]
                                  if (first === "S") setFormFacPriceS(val)
                                  else if (first === "M") setFormFacPriceM(val)
                                  else if (first === "L") setFormFacPriceL(val)
                                  else if (first === "XL") setFormFacPriceXL(val)
                                }
                              }}
                            />
                            <Input
                              label={
                                lang === "vi"
                                  ? "Khung giờ ra vào"
                                  : "Access Hours"
                              }
                              value={formFacAccessHours}
                              onChange={(e) =>
                                setFormFacAccessHours(e.target.value)
                              }
                            />
                            <Select
                              label={
                                lang === "vi"
                                  ? "Trạng thái hoạt động"
                                  : "Status"
                              }
                              value={formFacStatus}
                              onChange={(e) =>
                                setFormFacStatus(e.target.value as any)
                              }
                            >
                              <option value="active">
                                {lang === "vi"
                                  ? "Đang hoạt động (Active)"
                                  : "Active"}
                              </option>
                              <option value="maintenance">
                                {lang === "vi" ? "Bảo trì" : "Maintenance"}
                              </option>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Sticky footer */}
                      <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex justify-end items-center gap-2 z-10">
                        <Button
                          variant="outline"
                          onClick={() => setEditFacilityModal(false)}
                        >
                          {lang === "vi" ? "Hủy" : "Cancel"}
                        </Button>
                        <Button
                          variant="primary"
                          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                          disabled={
                            !formFacName.trim() ||
                            !formFacCode.trim() ||
                            formFacUnits <= 0
                          }
                          onClick={handleUpdateFacility}
                        >
                          {lang === "vi" ? "Lưu Thay Đổi" : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  )
                })()}
            </Modal>
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
                        <th className="p-2.5">Kích thước D×R×C</th>
                        <th className="p-2.5">Thể tích</th>
                        <th className="p-2.5 text-center font-bold text-amber-900 bg-amber-50/50">Tải trọng (kg)</th>
                        <th className="p-2.5 hidden md:table-cell">Khung kệ / Lối xe</th>
                        <th className="p-2.5 hidden lg:table-cell">Xe đẩy</th>
                        <th className="p-2.5">Số lượng</th>
                        <th className="p-2.5">Đang thuê</th>
                        <th className="p-2.5">Còn trống</th>
                        <th className="p-2.5">Đơn giá / tháng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(["S", "M", "L", "XL"] as const).map((size) => {
                        const spec = UNIT_SPECS[size]

                        const unitsOfSize = facilityUnits.filter(
                          (u) =>
                            ((u as any).size ||
                              (u.type === "Small"
                                ? "S"
                                : u.type === "Medium"
                                  ? "M"
                                  : u.type === "Large"
                                    ? "L"
                                    : "XL")) === size,
                        )

                        const totalSize =
                          facilityUnits.length > 0
                            ? unitsOfSize.length
                            : (selectedFacility.unitDistribution?.[size] ?? 0)

                        const occupiedSize = unitsOfSize.filter(
                          (u) => u.status === "occupied",
                        ).length

                        const availableSize =
                          unitsOfSize.filter((u) => u.status === "available")
                            .length || Math.max(0, totalSize - occupiedSize)

                        const loadKg =
                          selectedFacility.unitLoadLimits?.[size] ??
                          (unitsOfSize[0]?.maxLoadKg ??
                            (size === "S"
                              ? 1000
                              : size === "M"
                                ? 1600
                                : size === "L"
                                  ? 2800
                                  : 4000))

                        return (
                          <tr key={size} className="hover:bg-amber-50/50">
                            <td className="p-2.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-mono text-xs font-bold ${
                                  size === "S"
                                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                                    : size === "M"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : size === "L"
                                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                                        : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {size} · {spec.name}
                              </span>
                            </td>
                            <td className="p-2.5 font-medium text-slate-700">
                              {spec.dimensions}
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {spec.volumeM3} m³
                            </td>
                            <td className="p-2.5 text-center font-bold text-stone-800 bg-amber-50/20 font-mono">
                              {loadKg.toLocaleString("vi-VN")} kg
                            </td>
                            <td className="p-2.5 hidden md:table-cell">
                              <div className="text-slate-700 font-mono">{spec.frameCount} khung · {spec.frameDimensions.widthM}×{spec.frameDimensions.depthM}×{spec.frameDimensions.heightM} m</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">lối xe {spec.vehicleLaneWidthM} m · cao {spec.heightM} m</div>
                            </td>
                            <td className="p-2.5 hidden lg:table-cell text-slate-600">
                              <div>{spec.cartEquipment}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">thùng nhỏ {spec.smallBox.count} · thùng to {spec.largeBox.count}</div>
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">
                              {totalSize} kho
                            </td>
                            <td className="p-2.5 text-blue-700 font-semibold">
                              {occupiedSize} kho
                            </td>
                            <td className="p-2.5 text-emerald-700 font-semibold">
                              {availableSize} kho
                            </td>
                            <td className="p-2.5 font-mono font-bold text-emerald-800">
                              {getFacilitySizePriceFormatted(selectedFacility, size)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-stone-50 border-t border-stone-200 font-semibold text-slate-800">
                      <tr>
                        <td colSpan={3} className="p-2.5 font-bold">
                          {lang === "vi" ? "Tổng cộng" : "Total"}
                        </td>
                        <td className="p-2.5 text-center font-bold text-amber-900 bg-amber-50/40 font-mono">
                          {totalFacilityLoadTon} tấn
                        </td>
                        <td colSpan={2} className="hidden md:table-cell"></td>
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
