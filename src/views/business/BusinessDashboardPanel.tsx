import { useEffect, useMemo, useState, useCallback } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  SectionHeader,
  Select,
  StatCard,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "../../components/ui"
import { Icon } from "../../components/Layout"
import { formatVnd, formatVndAmount } from "../../i18n/currency"
import { useStorageHub } from "../../store/StorageHubContext"
import type { User } from "../../types"
import type { Facility } from "../../types/storageHub"
import {
  getBusinessPerformanceReportApi,
  getBusinessRevenueReportApi,
  type BusinessPerformanceReport,
  type BusinessRevenueReport,
} from "../../services/businessReportingApi"
import { isApiAuthenticated } from "../../services/authApi"
import { exportRevenueExcel } from "../../utils/excelExport"

interface Props {
  user: User
  lang?: string
  facilitiesList: Facility[]
  backendFacilityStats?: Record<string, { total: number; occupied: number; price: number | null; revenue: number }>
  onNavigate?: (page: string, params?: Record<string, string>) => void
}

const PURPOSE_LABELS: Record<string, { label: string; color: string }> = {
  RENTAL_BALANCE: { label: "Tiền thuê kho định kỳ", color: "#2563eb" },
  RESERVATION_DEPOSIT: { label: "Tiền cọc giữ chỗ", color: "#10b981" },
  RENEWAL: { label: "Gia hạn hợp đồng", color: "#8b5cf6" },
  SECURITY_DEPOSIT: { label: "Tiền cọc đảm bảo", color: "#059669" },
  SURCHARGE: { label: "Phụ phí / Dịch vụ", color: "#f59e0b" },
  RETURN_COMPENSATION: { label: "Bồi thường hư hại", color: "#ef4444" },
  FEE: { label: "Phí dịch vụ phát sinh", color: "#6b7280" },
}

export default function BusinessDashboardPanel({
  user: _user,
  lang = "vi",
  facilitiesList,
  backendFacilityStats = {},
  onNavigate,
}: Props) {
  const isVi = lang === "vi"
  const hub = useStorageHub()

  // State filters
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("all")
  const [timeRangeMonths, setTimeRangeMonths] = useState<number>(6)

  // Remote data state
  const [revenueReport, setRevenueReport] = useState<BusinessRevenueReport | null>(null)
  const [performanceReport, setPerformanceReport] = useState<BusinessPerformanceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!isApiAuthenticated()) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [rev, perf] = await Promise.all([
        getBusinessRevenueReportApi(timeRangeMonths),
        getBusinessPerformanceReportApi(),
      ])
      setRevenueReport(rev)
      setPerformanceReport(perf)
    } catch (err) {
      console.error("Failed to load business dashboard reports:", err)
      setError(
        err instanceof Error ? err.message : "Không thể tải số liệu báo cáo tự động từ máy chủ."
      )
    } finally {
      setLoading(false)
    }
  }, [timeRangeMonths])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Filtered facility object
  const currentFacility = useMemo(() => {
    if (selectedFacilityId === "all") return null
    return facilitiesList.find((f) => f.id === selectedFacilityId) || null
  }, [facilitiesList, selectedFacilityId])

  // Aggregate metrics (incorporating API + Local fallback)
  const metrics = useMemo(() => {
    // 1. Capacity & Units
    let totalUnits = 0
    let occupiedUnits = 0
    let totalFacilities = facilitiesList.length

    if (performanceReport && selectedFacilityId === "all") {
      totalCapacityUnits: totalUnits = performanceReport.totalCapacityUnits
      occupiedUnits = performanceReport.totalOccupiedUnits
      totalFacilities = performanceReport.totalFacilities
    } else if (currentFacility) {
      const code = (currentFacility.code || "").toUpperCase()
      const stat = backendFacilityStats[code]
      if (stat) {
        totalUnits = stat.total
        occupiedUnits = stat.occupied
      } else {
        totalUnits = currentFacility.units || 0
        occupiedUnits = currentFacility.occupied || 0
      }
    } else {
      // Sum from backendFacilityStats or facilitiesList
      facilitiesList.forEach((f) => {
        const code = (f.code || "").toUpperCase()
        const stat = backendFacilityStats[code]
        if (stat) {
          totalUnits += stat.total
          occupiedUnits += stat.occupied
        } else {
          totalUnits += f.units || 0
          occupiedUnits += f.occupied || 0
        }
      })
    }

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0

    // 2. Revenue calculations
    let totalRevenue = 0
    let currentMonthRevenue = 0
    let securityDepositsHeld = 0

    if (revenueReport) {
      if (selectedFacilityId === "all") {
        totalRevenue = Number(revenueReport.netRevenue ?? revenueReport.totalRevenueCollected ?? 0)

        // Find current month revenue from breakdown (last item)
        const lastMonth = revenueReport.monthlyBreakdown[revenueReport.monthlyBreakdown.length - 1]
        currentMonthRevenue = lastMonth ? Number(lastMonth.revenue) : 0

        // Find security deposits from purpose breakdown
        const depItem = revenueReport.paymentPurposeBreakdown.find(
          (p) => p.purpose === "RESERVATION_DEPOSIT" || p.purpose === "SECURITY_DEPOSIT"
        )
        securityDepositsHeld = depItem ? Number(depItem.amount) : 0
      } else {
        // Find specific facility revenue in breakdown
        const facRev = revenueReport.facilityBreakdown.find((f) => f.facilityId === selectedFacilityId)
        if (facRev) {
          totalRevenue = Number(facRev.revenue)
        } else {
          const code = (currentFacility?.code || "").toUpperCase()
          totalRevenue = backendFacilityStats[code]?.revenue || 0
        }
        currentMonthRevenue = Math.round(totalRevenue * 0.15)
        securityDepositsHeld = Math.round(totalRevenue * 0.2)
      }
    } else {
      // Fallback from backendFacilityStats or hub
      if (selectedFacilityId === "all") {
        Object.values(backendFacilityStats).forEach((s) => {
          totalRevenue += s.revenue || 0
        })
        if (totalRevenue === 0 && hub.payments) {
          totalRevenue = hub.payments
            .filter((p) => String(p.status).toUpperCase() === "PAID" || String(p.status).toUpperCase() === "COMPLETED")
            .reduce((sum, p) => sum + (p.amount || 0), 0)
        }
      } else {
        const code = (currentFacility?.code || "").toUpperCase()
        totalRevenue = backendFacilityStats[code]?.revenue || 0
      }
      currentMonthRevenue = Math.round(totalRevenue * 0.15)
      securityDepositsHeld = Math.round(totalRevenue * 0.2)
    }

    return {
      totalRevenue,
      currentMonthRevenue,
      securityDepositsHeld,
      totalUnits,
      occupiedUnits,
      availableUnits: Math.max(0, totalUnits - occupiedUnits),
      occupancyRate,
      totalFacilities,
    }
  }, [
    facilitiesList,
    selectedFacilityId,
    performanceReport,
    currentFacility,
    backendFacilityStats,
    revenueReport,
    hub.payments,
  ])

  // Chart data for monthly trend
  const chartMonthlyData = useMemo(() => {
    if (revenueReport && revenueReport.monthlyBreakdown && revenueReport.monthlyBreakdown.length > 0) {
      return revenueReport.monthlyBreakdown.map((m) => {
        const [year, month] = m.month.split("-")
        const label = month ? `Th${month}/${year.slice(2)}` : m.month
        return {
          month: label,
          fullMonth: m.month,
          revenue: Number(m.revenue),
          transactions: m.transactionsCount,
        }
      })
    }

    // Default trend mock fallback if no backend records
    const now = new Date()
    const result = []
    for (let i = timeRangeMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mStr = `Th${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
      result.push({
        month: mStr,
        fullMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        revenue: i === 0 ? metrics.currentMonthRevenue : Math.max(0, Math.round(metrics.totalRevenue / timeRangeMonths)),
        transactions: 1,
      })
    }
    return result
  }, [revenueReport, timeRangeMonths, metrics])

  // Purpose breakdown chart
  const purposeChartData = useMemo(() => {
    if (revenueReport && revenueReport.paymentPurposeBreakdown && revenueReport.paymentPurposeBreakdown.length > 0) {
      return revenueReport.paymentPurposeBreakdown.map((p) => {
        const meta = PURPOSE_LABELS[p.purpose] || { label: p.purpose, color: "#64748b" }
        return {
          name: meta.label,
          purposeCode: p.purpose,
          value: Number(p.amount),
          count: p.count,
          color: meta.color,
        }
      })
    }

    return [
      { name: "Tiền thuê kho định kỳ", value: metrics.totalRevenue * 0.7, count: 4, color: "#2563eb" },
      { name: "Tiền cọc giữ chỗ", value: metrics.totalRevenue * 0.2, count: 2, color: "#10b981" },
      { name: "Gia hạn hợp đồng", value: metrics.totalRevenue * 0.1, count: 1, color: "#8b5cf6" },
    ]
  }, [revenueReport, metrics.totalRevenue])

  // Facilities table data
  const facilitiesSummaryTable = useMemo(() => {
    return facilitiesList.map((fac) => {
      const code = (fac.code || "").toUpperCase()
      const stat = backendFacilityStats[code]
      const perf = performanceReport?.facilityComparisons.find((p) => p.facilityId === fac.id)
      const rev = revenueReport?.facilityBreakdown.find((r) => r.facilityId === fac.id)

      const totalUnits = perf?.totalUnits ?? stat?.total ?? fac.units ?? 0
      const occupiedUnits = perf?.occupiedUnits ?? stat?.occupied ?? fac.occupied ?? 0
      const occupancyRate =
        perf?.occupancyRate ??
        (totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0)
      const revenue = rev?.revenue != null ? Number(rev.revenue) : stat?.revenue || 0
      const activeRentals = perf?.activeRentals ?? 0
      const openReturns = perf?.openReturns ?? 0
      const openMaintenance = perf?.openMaintenance ?? 0

      return {
        id: fac.id,
        code: fac.code || fac.id,
        name: fac.name,
        city: fac.city || "—",
        address: fac.address,
        totalUnits,
        occupiedUnits,
        occupancyRate,
        revenue,
        activeRentals,
        openReturns,
        openMaintenance,
      }
    })
  }, [facilitiesList, backendFacilityStats, performanceReport, revenueReport])

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      const exportedData = chartMonthlyData.map((d) => ({
        month: d.month,
        revenue: d.revenue,
        growth: "—",
        growthNumber: 0,
        contracts: d.transactions,
        occupancyRate: `${metrics.occupancyRate}%`,
        occupancyNumber: metrics.occupancyRate,
      }))
      const filename = exportRevenueExcel({
        facilityName: currentFacility ? currentFacility.name : "Toàn bộ cơ sở StorageHub",
        revenueData: exportedData,
      })
      setExportNotice(`Đã xuất báo cáo tài chính thành công: ${filename}`)
      setTimeout(() => setExportNotice(null), 4000)
    } catch (err) {
      console.error("Export error:", err)
      setExportNotice("Xuất báo cáo thất bại, vui lòng thử lại.")
      setTimeout(() => setExportNotice(null), 4000)
    }
  }

  return (
    <div className="fade-in space-y-6">
      {/* ── TOP HEADER & CONTROLS ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          title={isVi ? "Bảng Điều Khiển & Doanh Thu" : "Business Dashboard & Revenue"}
          subtitle={
            isVi
              ? "Tổng quan doanh thu thực thu, tiền cọc, tỷ lệ lấp đầy kho và hiệu suất toàn bộ chi nhánh"
              : "Financial metrics, security deposits, occupancy and multi-facility performance"
          }
        />
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Facility Select */}
          <div className="w-48 sm:w-56">
            <Select
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              aria-label="Lọc theo cơ sở"
            >
              <option value="all">{isVi ? "Toàn bộ chi nhánh" : "All Facilities"}</option>
              {facilitiesList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code || f.id})
                </option>
              ))}
            </Select>
          </div>

          {/* Time range select */}
          <div className="w-36">
            <Select
              value={String(timeRangeMonths)}
              onChange={(e) => setTimeRangeMonths(Number(e.target.value))}
              aria-label="Thời gian báo cáo"
            >
              <option value="3">{isVi ? "3 tháng gần đây" : "Last 3 months"}</option>
              <option value="6">{isVi ? "6 tháng gần đây" : "Last 6 months"}</option>
              <option value="12">{isVi ? "12 tháng gần đây" : "Last 12 months"}</option>
            </Select>
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
            title="Làm mới số liệu từ máy chủ"
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </Button>

          {/* Export Excel button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <span>Xuất Excel</span>
          </Button>
        </div>
      </div>

      {/* Export notification badge */}
      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-xs">
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-900 font-bold hover:underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Error alert if any */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Thử lại
          </Button>
        </div>
      )}

      {/* ── TOP FINANCIAL & OPERATIONAL KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Net Revenue */}
        <Card className="p-4 bg-linear-to-br from-white to-emerald-50/50 border-emerald-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {isVi ? "Tổng Doanh Thu Thực Thu" : "Net Collected Revenue"}
            </span>
            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
              VND
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-950 font-mono tracking-tight">
              {formatVndAmount(metrics.totalRevenue)}
            </span>
            <span className="text-xs text-emerald-700 font-medium">đ</span>
          </div>
          <p className="mt-2 text-[11px] text-stone-500 flex items-center justify-between">
            <span>
              {revenueReport?.paymentPurposeBreakdown?.reduce((sum, p) => sum + p.count, 0) || 0} giao dịch thanh toán
            </span>
            <span className="text-emerald-700 font-semibold font-mono">Đã đối soát</span>
          </p>
        </Card>

        {/* KPI 2: Current Month Expected / Collected */}
        <Card className="p-4 bg-linear-to-br from-white to-blue-50/50 border-blue-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {isVi ? "Doanh Thu Tháng Này" : "Current Month"}
            </span>
            <span className="p-2 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
              {new Date().toLocaleDateString("vi-VN", { month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-950 font-mono tracking-tight">
              {formatVndAmount(metrics.currentMonthRevenue)}
            </span>
            <span className="text-xs text-blue-700 font-medium">đ</span>
          </div>
          <p className="mt-2 text-[11px] text-stone-500 flex items-center justify-between">
            <span>Thu định kỳ & gia hạn</span>
            <Badge variant="info">Ổn định</Badge>
          </p>
        </Card>

        {/* KPI 3: Security Deposits Held */}
        <Card className="p-4 bg-linear-to-br from-white to-purple-50/50 border-purple-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {isVi ? "Tiền Cọc Đang Quản Lý" : "Security Deposits Held"}
            </span>
            <span className="p-2 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs">
              Bảo Chứng
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-950 font-mono tracking-tight">
              {formatVndAmount(metrics.securityDepositsHeld)}
            </span>
            <span className="text-xs text-purple-700 font-medium">đ</span>
          </div>
          <p className="mt-2 text-[11px] text-stone-500 flex items-center justify-between">
            <span>Cọc giữ chỗ & đảm bảo kho</span>
            <span className="text-purple-700 font-semibold text-[11px]">Quyết toán khi trả kho</span>
          </p>
        </Card>

        {/* KPI 4: Occupancy Rate */}
        <Card className="p-4 bg-linear-to-br from-white to-amber-50/50 border-amber-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {isVi ? "Tỷ Lệ Lấp Đầy Kho" : "System Occupancy Rate"}
            </span>
            <span className="p-2 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
              {metrics.occupancyRate}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-stone-900 tracking-tight">
              {metrics.occupiedUnits} <span className="text-base text-stone-400 font-normal">/ {metrics.totalUnits} gian</span>
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar value={metrics.occupancyRate} max={100} />
            <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500">
              <span>Còn trống: {metrics.availableUnits} gian</span>
              <span>{metrics.totalFacilities} cơ sở</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── CHARTS ROW: REVENUE TREND & PURPOSE BREAKDOWN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Monthly Trend Chart (2 cols) */}
        <Card className="lg:col-span-2 p-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {isVi ? "Xu Hướng Doanh Thu Thu Được" : "Revenue Trend Over Time"}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {isVi
                  ? `Biểu đồ biến động doanh thu các tháng (${timeRangeMonths} tháng gần nhất)`
                  : `Monthly revenue progression for the past ${timeRangeMonths} months`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-stone-600 font-medium">Doanh thu thu về (VND)</span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartMonthlyData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${Math.round(val / 1000000)}tr`
                    if (val >= 1000) return `${Math.round(val / 1000)}k`
                    return String(val)
                  }}
                />
                <Tooltip
                  formatter={(value: any) => [`${formatVndAmount(Number(value))} đ`, "Doanh thu"]}
                  labelFormatter={(label) => `Thời gian: ${label}`}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Right: Revenue Breakdown by Purpose (1 col) */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-stone-900 text-base">
              {isVi ? "Cơ Cấu Nguồn Tiền" : "Revenue by Purpose"}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {isVi ? "Phân bổ theo mục đích thanh toán" : "Breakdown by collection purpose"}
            </p>

            {/* List of items */}
            <div className="mt-5 space-y-3.5">
              {purposeChartData.map((item) => {
                const total = metrics.totalRevenue || 1
                const pct = Math.round((item.value / total) * 100)
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-stone-800">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-stone-900">
                          {formatVndAmount(item.value)} đ
                        </span>
                        <span className="text-stone-400 text-[10px] ml-1">({pct}%)</span>
                      </div>
                    </div>
                    <ProgressBar value={pct} max={100} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span>Tổng đối soát:</span>
            <span className="font-bold text-stone-900 font-mono text-sm">
              {formatVndAmount(metrics.totalRevenue)} đ
            </span>
          </div>
        </Card>
      </div>

      {/* ── FACILITY PERFORMANCE COMPARISON TABLE ── */}
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-stone-900 text-base">
              {isVi ? "Hiệu Suất Kinh Doanh Từng Cơ Sở" : "Facility Business Performance"}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {isVi
                ? "Theo dõi doanh thu, tỷ lệ lấp đầy gian kho và các vụ việc đang giải quyết tại mỗi cơ sở"
                : "Compare revenues, occupancy, active leases and open operational tickets"}
            </p>
          </div>
          <div className="text-xs text-stone-500">
            Tổng cộng: <b>{facilitiesSummaryTable.length} cơ sở</b>
          </div>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Mã / Tên Cơ Sở</Th>
              <Th>Khu Vực</Th>
              <Th>Tỷ Lệ Lấp Đầy</Th>
              <Th>Gian Kho (Đang thuê / Tổng)</Th>
              <Th>Doanh Thu Thực Thu</Th>
              <Th>HĐ Thuê Hiệu Lực</Th>
              <Th>Thao Tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {facilitiesSummaryTable.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="text-center py-6 text-stone-400">
                  Chưa có cơ sở nào được cấu hình.
                </Td>
              </Tr>
            ) : (
              facilitiesSummaryTable.map((fac) => (
                <Tr key={fac.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-bold text-stone-900">{fac.name}</span>
                      <span className="text-[11px] font-mono text-stone-500">{fac.code}</span>
                    </div>
                  </Td>
                  <Td className="text-stone-600">{fac.city}</Td>
                  <Td>
                    <div className="w-32 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold font-mono text-stone-800">
                          {fac.occupancyRate}%
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {fac.totalUnits - fac.occupiedUnits} trống
                        </span>
                      </div>
                      <ProgressBar value={fac.occupancyRate} max={100} />
                    </div>
                  </Td>
                  <Td className="font-mono text-stone-800">
                    <b>{fac.occupiedUnits}</b> / {fac.totalUnits}
                  </Td>
                  <Td className="font-mono font-bold text-emerald-800">
                    {fac.revenue > 0 ? `${formatVndAmount(fac.revenue)} đ` : "Chưa có phát sinh"}
                  </Td>
                  <Td className="text-center font-mono">
                    <Badge variant={fac.activeRentals > 0 ? "success" : "muted"}>
                      {fac.activeRentals} HĐ
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate("pricing", { facilityId: fac.id })}
                          className="text-xs px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold cursor-pointer"
                        >
                          Xem giá
                        </button>
                      )}
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate("facilities", { facilityId: fac.id })}
                          className="text-xs px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold cursor-pointer"
                        >
                          Cơ sở
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  )
}
