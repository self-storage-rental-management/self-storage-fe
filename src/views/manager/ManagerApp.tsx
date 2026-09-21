import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import Layout, { getInitialPage, Icon } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Select, ProgressBar, Avatar, Input, Tabs } from '../../components/ui'
import type { User } from '../../types'
import { OCCUPANCY_DATA, REVENUE_DATA, UNIT_TYPE_DATA, UNITS, RENTALS, STAFF_LIST, OVERDUE, UTILIZATION, SUPPORT_METRICS, POLICIES } from "../../data/demoDatabase"
import { useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub, UNIT_TYPES, checkDateOverlap } from '../../store/StorageHubContext'

import ProfileView from '../ProfileView'
import type { RentalRecord, OverdueAccount } from '../../data/demoDatabase'

export default function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang, t } = useLanguage()

  const NAV = [
    { id: 'dashboard', label: lang === 'vi' ? 'Bảng điều khiển' : 'Dashboard', icon: Icon.home, group: lang === 'vi' ? 'Tổng quan' : 'Overview' },
    { id: 'reports', label: lang === 'vi' ? 'Báo cáo cơ sở' : 'Facility Reports', icon: Icon.chart, group: lang === 'vi' ? 'Tổng quan' : 'Overview' },
    { id: 'units', label: lang === 'vi' ? 'Quản lý gian kho' : 'Unit Management', icon: Icon.box, group: lang === 'vi' ? 'Vận hành cơ sở' : 'Facility Operations' },
    { id: 'maintenance', label: lang === 'vi' ? 'Bảo trì & Nghiệm thu' : 'Maintenance Tasks', icon: Icon.clipboard, group: lang === 'vi' ? 'Vận hành cơ sở' : 'Facility Operations' },
    { id: 'staff', label: lang === 'vi' ? 'Phân công nhân viên' : 'Staff Assignment', icon: Icon.users, group: lang === 'vi' ? 'Vận hành cơ sở' : 'Facility Operations' },
    { id: 'policies', label: lang === 'vi' ? 'Chính sách cơ sở' : 'Facility Policies', icon: Icon.policy, group: lang === 'vi' ? 'Vận hành cơ sở' : 'Facility Operations' },
    { id: 'rentals', label: lang === 'vi' ? 'Hợp đồng & Cước' : 'Rentals & Payments', icon: Icon.dollar, group: lang === 'vi' ? 'Hợp đồng & Tài chính' : 'Rentals & Finance' },
    { id: 'overdue', label: lang === 'vi' ? 'Quản lý nợ quá hạn' : 'Overdue Management', icon: Icon.alert, group: lang === 'vi' ? 'Hợp đồng & Tài chính' : 'Rentals & Finance' },
  ]

  const sb = (v: string) => {
    const m: Record<string, string> = { occupied: 'info', available: 'success', maintenance: 'warning', reserved: 'purple', active: 'success', overdue: 'error', paid: 'success', pending: 'warning', 'on-duty': 'success', 'off-duty': 'muted' }
    const viLabels: Record<string, string> = {
      occupied: 'Đã thuê',
      available: 'Còn trống',
      maintenance: 'Bảo trì',
      reserved: 'Đã đặt',
      active: 'Hiệu lực',
      overdue: 'Quá hạn',
      paid: 'Đã đóng',
      pending: 'Chờ xử lý',
      'on-duty': 'Đang trực',
      'off-duty': 'Nghỉ ca'
    }
    return <Badge variant={m[v] ?? 'muted'}>{lang === 'vi' && viLabels[v] ? viLabels[v] : v.charAt(0).toUpperCase() + v.slice(1)}</Badge>
  }

  const [page, setPage] = useState(() => getInitialPage(NAV, 'dashboard'))
  const [unitTab, setUnitTab] = useState('All')
  const [editModal, setEditModal] = useState(false)
  const [reminderModal, setReminderModal] = useState(false)
  const [selectedOverdue, setSelectedOverdue] = useState<OverdueAccount | null>(null)

  // Rentals interactive state
  const [rentalsList, setRentalsList] = useState<RentalRecord[]>(RENTALS)
  const [rentalSearch, setRentalSearch] = useState('')
  const [rentalTab, setRentalTab] = useState('All')
  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null)
  const [viewRentalModal, setViewRentalModal] = useState(false)
  const [recordPaymentModal, setRecordPaymentModal] = useState(false)
  const [newLeaseModal, setNewLeaseModal] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantEmail, setNewTenantEmail] = useState('')
  const [newTenantPhone, setNewTenantPhone] = useState('')
  const [newTenantUnit, setNewTenantUnit] = useState('A-104')
  const [newTenantAmount, setNewTenantAmount] = useState('89')

  // Overdue interactive state
  const [overdueList, setOverdueList] = useState<OverdueAccount[]>(OVERDUE)
  const [overdueSearch, setOverdueSearch] = useState('')
  const [overdueTab, setOverdueTab] = useState('All')
  const [reminderTemplate, setReminderTemplate] = useState('Friendly Reminder')
  const [reportPeriod, setReportPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const {
    units: storeUnits,
    rentals: storeRentals,
    holds: storeHolds,
    contracts: storeContracts,
    renewals: storeRenewals,
    maintenanceTasks: storeMaintenanceTasks,
    releaseMaintenanceUnit,
    assignUnitToHold,
    approveRenewal,
    rejectRenewal,
    completeMaintenanceTask
  } = useStorageHub()
  const [selectedHoldToAssign, setSelectedHoldToAssign] = useState<string | null>(null)
  const [targetUnitForHold, setTargetUnitForHold] = useState<string>('')

  const facilityUnits = storeUnits.filter(u => !user.facility || u.facilityName === user.facility || user.facility === 'All facilities')
  const occupiedCount = facilityUnits.filter(u => u.status === 'occupied').length
  const totalUnits = facilityUnits.length

  const filteredUnits = facilityUnits.filter(u => {
    if (unitTab === 'All' || unitTab === 'Tất cả') return true
    if (unitTab === 'Available' || unitTab === 'Còn trống') return u.status === 'available'
    if (unitTab === 'Occupied' || unitTab === 'Đã thuê') return u.status === 'occupied'
    if (unitTab === 'Maintenance' || unitTab === 'Bảo trì') return u.status === 'maintenance'
    if (unitTab === 'Reserved' || unitTab === 'Đã đặt') return u.status === 'reserved' || u.status === 'held' || (u.reservedPeriods && u.reservedPeriods.length > 0)
    return u.status === unitTab.toLowerCase()
  })

  return (
    <Layout
      user={user} navItems={NAV} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      roleLabel={lang === 'vi' ? 'Quản Lý Cơ Sở' : 'Facility Manager'} roleColor="bg-purple-100 text-purple-700"
    >
      {/* ── DASHBOARD ─────────────────────────────────────────── */}
      {page === 'dashboard' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            title={lang === 'vi' ? 'Bảng Điều Khiển Cơ Sở' : 'Facility Dashboard'}
            subtitle={user.facility ?? (lang === 'vi' ? 'Chưa chỉ định cơ sở' : 'No facility assigned')}
            action={<Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đang kết xuất báo cáo cơ sở...' : 'Exporting facility report...')}>{lang === 'vi' ? 'Xuất báo cáo' : 'Export Report'}</Button>}
          />
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3">{lang === 'vi' ? 'Hợp đồng giấy đã ký' : 'Signed paper contracts'}</h3>
            {storeContracts.filter(c => storeHolds.some(h => h.id === c.reservationId && (!user.facility || h.facilityName === user.facility || user.facility === 'All facilities'))).map(c => <p key={c.id} className="text-sm py-1">
              {c.contractNumber} · {c.signedAt} · <a href={c.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="underline text-amber-800">{lang === 'vi' ? 'Xem bản scan' : 'View scan'}</a>
            </p>)}
            {!storeContracts.length && <p className="text-sm text-stone-500">{lang === 'vi' ? 'Chưa có hợp đồng đã ký.' : 'No signed contracts yet.'}</p>}
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={lang === 'vi' ? 'Tổng gian kho' : 'Total Units'} value={totalUnits} icon={Icon.box} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Tỷ lệ lấp đầy' : 'Occupancy'} value={`${totalUnits ? Math.round((occupiedCount / totalUnits) * 100) : 0}%`} icon={Icon.chart} iconBg="bg-green-50" />
            <StatCard title={lang === 'vi' ? 'Doanh thu tháng' : 'Monthly Revenue'} value="$14,280" icon={Icon.dollar} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Nợ quá hạn' : 'Overdue Accounts'} value={OVERDUE.length} icon={Icon.alert} iconBg="bg-red-50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2 p-5">
              <h3 className="font-semibold text-slate-800 mb-4">{lang === 'vi' ? 'Doanh Thu Hàng Tháng' : 'Monthly Revenue'}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={REVENUE_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={((v: number) => [`$${v.toLocaleString()}`, lang === 'vi' ? 'Doanh thu' : 'Revenue']) as any} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">{lang === 'vi' ? 'Cơ Cấu Gian Kho' : 'Unit Mix'}</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={UNIT_TYPE_DATA} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {UNIT_TYPE_DATA.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={((v: number) => [`${v} ${lang === 'vi' ? 'gian' : 'units'}`]) as any} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {UNIT_TYPE_DATA.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600 flex-1 truncate">{d.name}</span>
                    <span className="font-semibold text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">{lang === 'vi' ? 'Xu Hướng Lấp Đầy Kho' : 'Occupancy Trend'}</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={OCCUPANCY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[60, 100]} />
                  <Tooltip formatter={((v: number) => [`${v}%`, lang === 'vi' ? 'Lấp đầy' : 'Occupancy']) as any} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-3">{lang === 'vi' ? 'Tài Khoản Quá Hạn Gần Đây' : 'Overdue Accounts'}</h3>
              <div className="space-y-3">
                {OVERDUE.slice(0, 3).map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{o.customer}</p>
                      <p className="text-xs text-slate-400">{lang === 'vi' ? `Kho ${o.unit} · Quá hạn ${o.overdueDays} ngày` : `${o.unit} · ${o.overdueDays} days overdue`}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">${o.amount + o.lateFee}</p>
                      <p className="text-xs text-slate-400">{lang === 'vi' ? 'gồm phí phạt' : 'incl. late fee'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setPage('overdue')}>
                {lang === 'vi' ? 'Xử Lý Nợ Quá Hạn →' : 'Manage All Overdue →'}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* ── FACILITY REPORTS ───────────────────────────────────── */}
      {page === 'reports' && (() => {
        const heldCount = facilityUnits.filter(u => u.status === 'held').length
        const maintenanceCount = facilityUnits.filter(u => u.status === 'maintenance').length
        const availableCount = facilityUnits.filter(u => u.status === 'available').length
        const actualRevenue = storeRentals
          .filter(r => (!user.facility || r.facilityName === user.facility || user.facility === 'All facilities') && r.status === 'active')
          .reduce((sum, r) => sum + r.monthlyRate, 0)
        const occupancyRate = totalUnits ? Math.round((occupiedCount / totalUnits) * 100) : 0

        const monthlyFinancials = [
          { month: lang === 'vi' ? 'Thg 4' : 'Apr', revenue: 11200, target: 12000, cost: 3200 },
          { month: lang === 'vi' ? 'Thg 5' : 'May', revenue: 12400, target: 12500, cost: 3400 },
          { month: lang === 'vi' ? 'Thg 6' : 'Jun', revenue: 13100, target: 13000, cost: 3300 },
          { month: lang === 'vi' ? 'Thg 7' : 'Jul', revenue: 13800, target: 13500, cost: 3500 },
          { month: lang === 'vi' ? 'Thg 8' : 'Aug', revenue: 14100, target: 14000, cost: 3600 },
          { month: lang === 'vi' ? 'Thg 9' : 'Sep', revenue: actualRevenue || 14500, target: 14500, cost: 3650 },
        ]

        const turnoverData = [
          { month: lang === 'vi' ? 'Thg 4' : 'Apr', moveIn: 12, moveOut: 4 },
          { month: lang === 'vi' ? 'Thg 5' : 'May', moveIn: 15, moveOut: 6 },
          { month: lang === 'vi' ? 'Thg 6' : 'Jun', moveIn: 14, moveOut: 5 },
          { month: lang === 'vi' ? 'Thg 7' : 'Jul', moveIn: 18, moveOut: 7 },
          { month: lang === 'vi' ? 'Thg 8' : 'Aug', moveIn: 16, moveOut: 6 },
          { month: lang === 'vi' ? 'Thg 9' : 'Sep', moveIn: 19, moveOut: 8 },
        ]

        // Group by zone/floor
        const zones = Array.from(new Set(facilityUnits.map(u => `Tầng ${u.floor} · ${u.zone}`))).map(zoneLabel => {
          const zUnits = facilityUnits.filter(u => `Tầng ${u.floor} · ${u.zone}` === zoneLabel)
          const zOcc = zUnits.filter(u => u.status === 'occupied').length
          const zHeld = zUnits.filter(u => u.status === 'held').length
          const zAvail = zUnits.filter(u => u.status === 'available').length
          const zMaint = zUnits.filter(u => u.status === 'maintenance').length
          const zRev = zUnits.filter(u => u.status === 'occupied').reduce((sum, u) => sum + u.price, 0)
          return {
            zone: zoneLabel,
            total: zUnits.length,
            occupied: zOcc,
            held: zHeld,
            available: zAvail,
            maintenance: zMaint,
            rate: zUnits.length ? Math.round((zOcc / zUnits.length) * 100) : 0,
            revenue: zRev
          }
        })

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              eyebrow={lang === 'vi' ? 'BÁO CÁO CƠ SỞ · QUẢN LÝ VẬN HÀNH' : 'FACILITY REPORTS · OPERATIONAL ANALYTICS'}
              title={lang === 'vi' ? 'Báo Cáo Hiệu Suất & Vận Hành Cơ Sở' : 'Facility Performance Reports'}
              subtitle={`${user.facility ?? 'Downtown Storage'} · ${lang === 'vi' ? 'Số liệu lấp đầy, dòng tiền, tỷ lệ quay vòng và chỉ số dịch vụ' : 'Occupancy, cashflow, unit turnover and service benchmarks'}`}
              action={
                <div className="flex gap-2">
                  <Select value={reportPeriod} onChange={e => setReportPeriod(e.target.value as any)} className="text-xs">
                    <option value="month">{lang === 'vi' ? 'Tháng này (Thg 9/2026)' : 'Current Month'}</option>
                    <option value="quarter">{lang === 'vi' ? 'Quý 3/2026' : 'Q3 2026'}</option>
                    <option value="year">{lang === 'vi' ? 'Cả năm 2026' : 'Full Year 2026'}</option>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã xuất báo cáo PDF & bảng biểu Excel!' : 'Report exported to PDF & Excel!')}>
                     {lang === 'vi' ? 'Xuất báo cáo' : 'Export'}
                  </Button>
                </div>
              }
            />

            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={lang === 'vi' ? 'Tỷ lệ lấp đầy thực tế' : 'Occupancy Rate'}
                value={`${occupancyRate}%`}
                delta={`${occupiedCount}/${totalUnits} ${lang === 'vi' ? 'gian kho đang thuê' : 'units occupied'}`}
                deltaPositive={occupancyRate >= 75}
                icon={Icon.chart}
                iconBg="bg-blue-50 text-blue-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Doanh thu tháng (MTD)' : 'Monthly Revenue'}
                value={`$${(actualRevenue || 14280).toLocaleString()}`}
                delta={`+$650 ${lang === 'vi' ? 'so với tháng trước' : 'vs last month'}`}
                deltaPositive
                icon={Icon.dollar}
                iconBg="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Kho đang giữ & chờ giao' : 'Held / Pending'}
                value={heldCount}
                delta={lang === 'vi' ? 'Chờ hoàn tất check-in' : 'Awaiting handover'}
                deltaPositive={heldCount > 0}
                icon={Icon.clock}
                iconBg="bg-amber-50 text-amber-800"
              />
              <StatCard
                title={lang === 'vi' ? 'Kho sẵn sàng cho thuê' : 'Available for Rent'}
                value={availableCount}
                delta={`${maintenanceCount} ${lang === 'vi' ? 'kho đang bảo trì' : 'under maintenance'}`}
                deltaPositive={availableCount > 0}
                icon={Icon.box}
                iconBg="bg-purple-50 text-purple-700"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{lang === 'vi' ? 'Doanh Thu vs Mục Tiêu Ngân Sách' : 'Revenue vs Budget Target'}</h3>
                    <p className="text-xs text-slate-500">{lang === 'vi' ? 'So sánh dòng tiền thực tế và mục tiêu' : 'Actual revenue vs targeted goal'}</p>
                  </div>
                  <Badge variant="success">{lang === 'vi' ? 'Đạt 102% mục tiêu' : '102% of goal'}</Badge>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyFinancials} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={((v: number) => [`$${v.toLocaleString()}`, '']) as any} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" name={lang === 'vi' ? 'Thực tế' : 'Actual'} stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="target" name={lang === 'vi' ? 'Mục tiêu' : 'Target'} stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorTarget)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{lang === 'vi' ? 'Lưu Chuyển Nhận Kho vs Trả Kho' : 'Move-in vs Move-out Velocity'}</h3>
                    <p className="text-xs text-slate-500">{lang === 'vi' ? 'Tỷ lệ xoay vòng khách thuê theo tháng' : 'Monthly tenant turnover rate'}</p>
                  </div>
                  <Badge variant="info">{lang === 'vi' ? 'Tăng trưởng ròng dương' : 'Net positive'}</Badge>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={turnoverData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="moveIn" name={lang === 'vi' ? 'Check-in mới' : 'Move-in'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="moveOut" name={lang === 'vi' ? 'Trả kho' : 'Move-out'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Floor / Zone Breakdown Table */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{lang === 'vi' ? 'Hiệu Suất Theo Tầng & Khu Vực' : 'Floor & Zone Performance Breakdown'}</h3>
                  <p className="text-xs text-slate-500">{lang === 'vi' ? 'Chi tiết lấp đầy, số kho bảo trì và doanh thu đóng góp theo phân khu' : 'Granular breakdown by building section and floor'}</p>
                </div>
              </div>
              <Table>
                <Thead>
                  <tr>
                    <Th>{lang === 'vi' ? 'Khu Vực / Tầng' : 'Zone & Floor'}</Th>
                    <Th>{lang === 'vi' ? 'Tổng Kho' : 'Total Units'}</Th>
                    <Th>{lang === 'vi' ? 'Đang Thuê' : 'Occupied'}</Th>
                    <Th>{lang === 'vi' ? 'Đang Giữ' : 'Held'}</Th>
                    <Th>{lang === 'vi' ? 'Còn Trống' : 'Available'}</Th>
                    <Th>{lang === 'vi' ? 'Bảo Trì' : 'Maintenance'}</Th>
                    <Th>{lang === 'vi' ? 'Tỷ Lệ Lấp Đầy' : 'Occupancy'}</Th>
                    <Th className="text-right">{lang === 'vi' ? 'Doanh Thu Tháng' : 'Revenue'}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {zones.map(z => (
                    <Tr key={z.zone}>
                      <Td><span className="font-bold text-sm text-stone-900">{z.zone}</span></Td>
                      <Td><span className="font-semibold">{z.total}</span></Td>
                      <Td><span className="text-emerald-700 font-semibold">{z.occupied}</span></Td>
                      <Td><span className="text-amber-700 font-semibold">{z.held}</span></Td>
                      <Td><span className="text-blue-700 font-semibold">{z.available}</span></Td>
                      <Td>
                        {z.maintenance > 0 ? (
                          <Badge variant="error">{z.maintenance} {lang === 'vi' ? 'kho' : 'units'}</Badge>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold w-9">{z.rate}%</span>
                          <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${z.rate}%` }} />
                          </div>
                        </div>
                      </Td>
                      <Td className="text-right font-bold font-mono text-stone-900">${z.revenue.toLocaleString()}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Card>

            {/* Operational Quality & Incident Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Thời gian Check-in trung bình' : 'Avg. Check-in Time'}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">14.2 <span className="text-sm font-normal text-stone-500">{lang === 'vi' ? 'phút' : 'min'}</span></p>
                <p className="text-[11px] text-emerald-600 mt-1 font-medium"> Nhanh hơn 18% so với KPI chuẩn</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Tỷ lệ trả kho đạt chuẩn (Không hư hại)' : 'Clean Return Pass Rate'}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">94.6%</p>
                <p className="text-[11px] text-stone-500 mt-1">Hoàn cọc 100% trong vòng 24 giờ</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Thời gian xử lý bảo trì/làm sạch kho' : 'Avg. Maintenance Turnaround'}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">1.2 <span className="text-sm font-normal text-stone-500">{lang === 'vi' ? 'ngày' : 'days'}</span></p>
                <p className="text-[11px] text-emerald-600 mt-1 font-medium"> Kho nhanh chóng sẵn sàng cho thuê lại</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Điểm hài lòng dịch vụ khách hàng' : 'Customer Satisfaction (CSAT)'}</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">4.8 <span className="text-sm font-normal text-stone-400">/ 5.0 </span></p>
                <p className="text-[11px] text-stone-500 mt-1">Dựa trên 142 lượt phản hồi khảo sát</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── UNIT MANAGEMENT ───────────────────────────────────── */}
      {(page === 'units' || page === 'browse-units') && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Quản Lý Gian Kho' : 'Unit Management'}
            subtitle={lang === 'vi' ? `Tổng cộng ${totalUnits} gian kho · ${occupiedCount} đang có khách thuê` : `${totalUnits} units total · ${occupiedCount} occupied`}
            action={<Button variant="primary" size="sm" onClick={() => setEditModal(true)}>{Icon.plus} {lang === 'vi' ? 'Thêm Gian Kho' : 'Add Unit'}</Button>}
          />

          {/* 1. Unit Type DIM Pricing Breakdown (Standard Business Rule) */}
          <div className="mb-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <span></span>
                  <span>{lang === 'vi' ? 'Quy Chuẩn Định Giá Thể Tích DIM Theo Loại Kho (Unit Type DIM Pricing)' : 'Unit Type DIM Pricing Configuration'}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {lang === 'vi'
                    ? 'Giá thuê cơ sở hàng tháng được cố định theo thể tích DIM (Dài × Rộng × Cao × Đơn giá/m³), tính 1 lần khi tạo loại kho.'
                    : 'Base monthly rental price is determined once per unit type by multiplying DIM volume by price per cubic meter.'}
                </p>
              </div>
              <Badge variant="info">
                {lang === 'vi' ? 'Quy tắc định giá chuẩn SWP391' : 'Fixed UnitType DIM Rule'}
              </Badge>
            </div>

            {/* Business Rule Formula Callout */}
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 text-xs text-stone-700 space-y-1">
              <p className="font-semibold text-stone-900 font-mono">
                DIM = Length × Width × Height (m) &nbsp;|&nbsp; Base Monthly Price = DIM × Price Per Cubic Meter
              </p>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                {lang === 'vi'
                  ? 'Khách hàng chỉ nhìn thấy loại gian kho và giá thuê niêm yết cố định (ví dụ: Medium 15m³: $150/tháng). Khai báo hàng hóa chỉ sử dụng trong kiểm tra tương thích vật lý (DIM & Trọng tải sàn), không làm thay đổi giá thuê cơ sở.'
                  : 'Customers only see the fixed package price. Cargo declaration is strictly evaluated for physical fit, not dynamic repricing.'}
              </p>
            </div>

            {/* Unit Types Table */}
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>{lang === 'vi' ? 'Loại Gian Kho' : 'Unit Type'}</Th>
                    <Th>{lang === 'vi' ? 'Kích Thước Chuẩn (D × R × C)' : 'Dimensions (L × W × H)'}</Th>
                    <Th>{lang === 'vi' ? 'Thể Tích DIM (m³)' : 'DIM Volume (m³)'}</Th>
                    <Th>{lang === 'vi' ? 'Đơn Giá Cơ Sở ($/m³)' : 'Price Per m³'}</Th>
                    <Th className="text-right">{lang === 'vi' ? 'Giá Niêm Yết Cố Định / Tháng' : 'Base Monthly Price'}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {UNIT_TYPES.map(ut => (
                    <Tr key={ut.id}>
                      <Td className="font-bold text-stone-900">
                        {ut.name}
                        <span className="block text-[11px] font-normal text-stone-500">ID: {ut.id}</span>
                      </Td>
                      <Td className="font-mono text-xs">{ut.length}m × {ut.width}m × {ut.height}m</Td>
                      <Td className="font-bold text-stone-800">{ut.volumeM3} m³</Td>
                      <Td className="font-mono">${ut.pricePerM3}/m³</Td>
                      <Td className="text-right font-mono font-bold text-emerald-700 text-sm">
                        ${ut.monthlyPrice} <span className="text-[11px] font-normal text-stone-500">/ {lang === 'vi' ? 'tháng' : 'mo'}</span>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </div>

          {/* 2. Unassigned Units Queue (Holds paid & confirmed awaiting specific unit assignment) */}
          {(() => {
            const unassignedHolds = storeHolds.filter(
              h => (h.status === 'DEPOSIT_PAID' || h.status === 'deposit_paid') && !h.assignedUnitId &&
                   (!user.facility || h.facilityName === user.facility || user.facility === 'All facilities')
            )
            if (!unassignedHolds.length) return null

            return (
              <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50/70 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-800 font-bold text-sm"> {lang === 'vi' ? 'Hàng Đợi Phân Bổ Gian Kho Cụ Thể (Unassigned Holds)' : 'Pending Unit Assignment Queue'}</span>
                    <Badge variant="warning">{unassignedHolds.length} {lang === 'vi' ? 'đơn cần xếp kho' : 'pending'}</Badge>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    {lang === 'vi'
                      ? 'Kiểm tra xung đột ngày: newStart < existingEnd AND newEnd > existingStart. Chỉ gán khi không có overlap.'
                      : 'Date conflict rule: newStart < existingEnd AND newEnd > existingStart.'}
                  </p>
                </div>

                <div className="space-y-2">
                  {unassignedHolds.map(hold => {
                    // Filter suitable units at facility matching type, not in maintenance, and no date overlap
                    const suitableAvailableUnits = facilityUnits.filter(u => {
                      if (u.facilityId !== hold.facilityId) return false
                      if (!u.type.toLowerCase().includes((hold.unitTypeName || '').split(' ')[0].toLowerCase())) return false
                      if (u.status === 'maintenance') return false

                      const hasReservationOverlap = storeHolds.some(
                        h => h.id !== hold.id && h.assignedUnitId === u.id &&
                             ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status) &&
                             checkDateOverlap(hold.startDate, hold.endDate, h.startDate, h.endDate)
                      )
                      const hasRentalOverlap = storeRentals.some(
                        r => r.unitId === u.id && r.status === 'active' &&
                             checkDateOverlap(hold.startDate, hold.endDate, r.startDate, r.endDate)
                      )
                      return !hasReservationOverlap && !hasRentalOverlap
                    })

                    return (
                      <div key={hold.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-800">{hold.id}</span>
                            <span className="font-semibold text-stone-900">{hold.customerName}</span>
                            <Badge variant="purple">{hold.unitTypeName || 'Gian kho'}</Badge>
                          </div>
                          <p className="text-stone-500 text-[11px] mt-0.5">
                            Cơ sở: <b>{hold.facilityName}</b> · Khoảng thuê: <b className="text-stone-800">{hold.startDate} → {hold.endDate}</b> ({hold.rentalMonths} tháng) · Đã cọc 20%: <b className="text-emerald-700">${hold.reservationDepositAmount ?? hold.payment.amount}</b>
                          </p>
                          <p className="text-amber-800 text-[11px]">
                            {lang === 'vi' ? `Kho khả dụng không xung đột ngày: ${suitableAvailableUnits.length} gian kho` : `${suitableAvailableUnits.length} conflict-free units available`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            className="rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs"
                            value={selectedHoldToAssign === hold.id ? targetUnitForHold : ''}
                            onChange={e => {
                              setSelectedHoldToAssign(hold.id)
                              setTargetUnitForHold(e.target.value)
                            }}
                          >
                            <option value="">-- {lang === 'vi' ? 'Chọn gian kho không xung đột' : 'Select conflict-free unit'} --</option>
                            {suitableAvailableUnits.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.code} ({u.type} · {u.areaM2} m² · Tầng {u.floor})
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            disabled={selectedHoldToAssign !== hold.id || !targetUnitForHold}
                            onClick={() => {
                              if (selectedHoldToAssign && targetUnitForHold) {
                                try {
                                  assignUnitToHold(selectedHoldToAssign, targetUnitForHold, user)
                                  showToast(lang === 'vi' ? `Đã phân kho ${targetUnitForHold} cho đơn ${selectedHoldToAssign}!` : `Unit assigned!`)
                                  setSelectedHoldToAssign(null)
                                  setTargetUnitForHold('')
                                } catch (err: any) {
                                  showToast(err?.message || 'Error assigning unit')
                                }
                              }
                            }}
                          >
                             {lang === 'vi' ? 'Phân Bổ' : 'Assign'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="mb-4">
            <Tabs
              tabs={lang === 'vi' ? ['Tất cả', 'Còn trống', 'Đã thuê', 'Bảo trì', 'Đã đặt giữ'] : ['All', 'Available', 'Occupied', 'Maintenance', 'Reserved']}
              active={unitTab === 'All' && lang === 'vi' ? 'Tất cả' : unitTab}
              onChange={val => {
                if (val === 'Tất cả') setUnitTab('All')
                else if (val === 'Còn trống') setUnitTab('Available')
                else if (val === 'Đã thuê') setUnitTab('Occupied')
                else if (val === 'Bảo trì') setUnitTab('Maintenance')
                else if (val === 'Đã đặt giữ') setUnitTab('Reserved')
                else setUnitTab(val)
              }}
            />
          </div>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Gian Kho' : 'Unit'}</Th>
                  <Th>{lang === 'vi' ? 'Kích Thước & Diện Tích' : 'Size & Dimensions'}</Th>
                  <Th>{lang === 'vi' ? 'Tầng / Khu' : 'Floor / Zone'}</Th>
                  <Th>{lang === 'vi' ? 'Giá / Tháng' : 'Price / Mo'}</Th>
                  <Th>{lang === 'vi' ? 'Trạng Thái & Lịch Thuê / Đặt Kho' : 'Status & Reservation Schedule'}</Th>
                  <Th>{lang === 'vi' ? 'Khách Hàng Hiện Tại' : 'Current Tenant / Booker'}</Th>
                  <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredUnits.map(u => {
                  const activeRental = storeRentals.find(r => r.unitId === u.id && r.status === 'active')
                  const activeHold = storeHolds.find(h => h.assignedUnitId === u.id && ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status))
                  const periods = u.reservedPeriods || []

                  return (
                    <Tr key={u.id}>
                      <Td>
                        <span className="font-mono font-bold text-base text-stone-900">{u.code}</span>
                      </Td>
                      <Td>
                        <p className="font-semibold text-sm text-stone-900">{u.type} · {u.areaM2} m²</p>
                        <p className="font-mono text-xs text-stone-500">{u.dimensions.lengthM}m × {u.dimensions.widthM}m × {u.dimensions.heightM}m ({u.volumeM3} m³)</p>
                      </Td>
                      <Td>
                        <p className="text-xs font-medium text-stone-700">{lang === 'vi' ? `Tầng ${u.floor}` : `Floor ${u.floor}`}</p>
                        <p className="text-[11px] text-stone-400">{u.zone} · {u.climate ? 'Có điều hòa' : 'Thông gió'}</p>
                      </Td>
                      <Td className="font-mono font-bold text-stone-900">${u.price}</Td>
                      <Td>
                        {/* Canonical Time-bound status as requested by user */}
                        {u.status === 'maintenance' ? (
                          <Badge variant="error">{lang === 'vi' ? 'Đang bảo trì' : 'Maintenance'}</Badge>
                        ) : activeRental ? (
                          <div>
                            <Badge variant="info">{lang === 'vi' ? 'Đang thuê (OCCUPIED)' : 'Occupied'}</Badge>
                            <div className="mt-1 text-[11px] text-stone-700 bg-blue-50/70 p-1.5 rounded border border-blue-100">
                              <p className="font-semibold text-blue-900">📅 {activeRental.startDate} → {activeRental.endDate}</p>
                              <p className="text-stone-500 mt-0.5">{lang === 'vi' ? 'Hạn kế tiếp:' : 'Next due:'} {activeRental.nextDue}</p>
                            </div>
                          </div>
                        ) : periods.length > 0 || u.status === 'reserved' || u.status === 'held' ? (
                          <div>
                            <Badge variant="purple">{lang === 'vi' ? 'Đã đặt giữ (RESERVED)' : 'Reserved'}</Badge>
                            {periods.map((p, idx) => (
                              <div key={idx} className="mt-1 text-[11px] text-stone-700 bg-purple-50 p-1.5 rounded border border-purple-100">
                                <p className="font-semibold text-purple-900">📅 {p.startDate} → {p.endDate}</p>
                                <p className="text-stone-600">👤 {p.customerName}</p>
                                <p className="text-stone-500">{lang === 'vi' ? 'Trống tiếp theo:' : 'Next available:'} <b>{u.nextAvailableDate || p.endDate}</b></p>
                              </div>
                            ))}
                            {!periods.length && activeHold && (
                              <div className="mt-1 text-[11px] text-stone-700 bg-purple-50 p-1.5 rounded border border-purple-100">
                                <p className="font-semibold text-purple-900">📅 {activeHold.startDate} → {activeHold.endDate}</p>
                                <p className="text-stone-600">👤 {activeHold.customerName}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <Badge variant="success">{lang === 'vi' ? 'Còn trống (AVAILABLE)' : 'Available'}</Badge>
                            <p className="text-[11px] text-stone-400 mt-0.5">{lang === 'vi' ? 'Sẵn sàng nhận khách' : 'Ready to assign'}</p>
                          </div>
                        )}
                      </Td>
                      <Td>
                        {activeRental ? (
                          <div>
                            <p className="text-xs font-semibold text-stone-900">{activeRental.customerName}</p>
                            <p className="text-[11px] text-stone-400">{activeRental.customerPhone}</p>
                          </div>
                        ) : activeHold ? (
                          <div>
                            <p className="text-xs font-semibold text-amber-900">{activeHold.customerName} <span className="text-[10px] font-normal text-amber-700">(Đã cọc 20%)</span></p>
                            <p className="text-[11px] text-stone-400">{activeHold.customerPhone}</p>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-xs">—</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {u.status === 'maintenance' ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              releaseMaintenanceUnit(u.id, user)
                              showToast(lang === 'vi' ? `Đã hoàn tất bảo trì cho kho ${u.id}!` : `Unit ${u.id} ready!`)
                            }}
                          >
                             {lang === 'vi' ? 'Mở lại kho' : 'Clear'}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setEditModal(true)}>{lang === 'vi' ? 'Sửa' : 'Edit'}</Button>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── MAINTENANCE TASKS ─────────────────────────────────── */}
      {page === 'maintenance' && (
        <div className="fade-in space-y-4">
          <SectionHeader
            title={lang === 'vi' ? 'Quản Lý Nhiệm Vụ Bảo Trì Gian Kho' : 'Unit Maintenance Tasks'}
            subtitle={lang === 'vi' ? 'Nghiệm thu chất lượng sửa chữa, vệ sinh sau trả kho và mở lại trạng thái AVAILABLE' : 'Inspect repair/cleaning quality post-checkout and restore AVAILABLE status'}
          />

          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Mã Nhiệm Vụ' : 'Task ID'}</Th>
                  <Th>{lang === 'vi' ? 'Gian Kho' : 'Unit'}</Th>
                  <Th>{lang === 'vi' ? 'Lý Do Bảo Trì / Hư Hại' : 'Reason / Damage'}</Th>
                  <Th>{lang === 'vi' ? 'Phân Loại' : 'Classification'}</Th>
                  <Th>{lang === 'vi' ? 'Thời Gian Tạo' : 'Created'}</Th>
                  <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
                  <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {storeMaintenanceTasks.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="text-center py-8 text-stone-500">
                      {lang === 'vi' ? 'Không có nhiệm vụ bảo trì nào đang tồn đọng. Tất cả gian kho đều đạt chuẩn vận hành.' : 'No pending maintenance tasks.'}
                    </Td>
                  </Tr>
                ) : (
                  storeMaintenanceTasks.map(task => (
                    <Tr key={task.id}>
                      <Td><span className="font-mono font-bold text-xs text-amber-800">{task.id}</span></Td>
                      <Td><span className="font-mono font-bold text-stone-900">{task.unitId}</span></Td>
                      <Td><p className="text-xs text-stone-700 max-w-xs">{task.reason}</p></Td>
                      <Td>
                        <Badge variant={task.damageClassification === 'no_damage' ? 'muted' : 'warning'}>
                          {task.damageClassification || 'Vệ sinh định kỳ'}
                        </Badge>
                      </Td>
                      <Td><span className="text-xs text-stone-500">{new Date(task.createdAt).toLocaleDateString('vi-VN')}</span></Td>
                      <Td>
                        <Badge variant={task.status === 'completed' ? 'success' : 'warning'}>
                          {task.status === 'completed' ? (lang === 'vi' ? 'Đã hoàn tất' : 'Completed') : (lang === 'vi' ? 'Chờ nghiệm thu' : 'Pending')}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {task.status !== 'completed' ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              completeMaintenanceTask(task.id, user)
                              showToast(lang === 'vi' ? `Đã nghiệm thu xong kho ${task.unitId}! Trạng thái kho chuyển sang AVAILABLE.` : `Maintenance completed! Unit is now AVAILABLE.`)
                            }}
                          >
                             {lang === 'vi' ? 'Nghiệm thu & Mở kho' : 'Complete & Open'}
                          </Button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-semibold"> Đạt chuẩn</span>
                        )}
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── RENTALS & PAYMENTS ───────────────────────────────── */}
      {page === 'rentals' && (() => {
        const activeRentals = rentalsList.filter(r => r.status === 'active')
        const paidRentals = rentalsList.filter(r => r.paid === 'paid')
        const overdueRentals = rentalsList.filter(r => r.paid === 'overdue')
        const mrr = activeRentals.reduce((sum, r) => sum + r.amount, 0)

        const filteredRentals = rentalsList.filter(r => {
          const matchTab =
            rentalTab === 'All' || rentalTab === 'Tất cả' ||
            ((rentalTab === 'active' || rentalTab === 'Hiệu lực') && r.status === 'active') ||
            ((rentalTab === 'paid' || rentalTab === 'Đã nộp') && r.paid === 'paid') ||
            ((rentalTab === 'overdue' || rentalTab === 'Quá hạn') && r.paid === 'overdue') ||
            ((rentalTab === 'pending' || rentalTab === 'Chờ xử lý') && (r.status === 'pending' || r.paid === 'pending'))
          const query = rentalSearch.toLowerCase().trim()
          const matchSearch =
            !query ||
            r.customer.toLowerCase().includes(query) ||
            r.unit.toLowerCase().includes(query) ||
            r.id.toLowerCase().includes(query) ||
            r.phone.includes(query)
          return matchTab && matchSearch
        })

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={lang === 'vi' ? 'Giám Sát Hợp Đồng Thuê & Cước Phí' : 'Rentals & Payment Monitoring'}
              subtitle={lang === 'vi' ? 'Sổ cái tổng hợp các hợp đồng thuê kho, kỳ thu cước định kỳ và quyết toán thu ngân' : 'Comprehensive ledger of facility leases, recurring billings, and payment settlements'}
              action={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã xuất dữ liệu hợp đồng ra file CSV!' : 'Lease records exported to CSV!')}>
                    {lang === 'vi' ? 'Xuất file CSV' : 'Export CSV'}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setNewLeaseModal(true)}>
                    {Icon.plus} {lang === 'vi' ? 'Hợp đồng mới' : 'New Agreement'}
                  </Button>
                </div>
              }
            />

            {/* Pending Renewal Approval Queue */}
            {(() => {
              const pendingRenewals = storeRenewals.filter(r => r.status === 'pending')
              if (!pendingRenewals.length) return null

              return (
                <div className="rounded-xl border-2 border-blue-400 bg-blue-50/70 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-900 font-bold text-sm"> {lang === 'vi' ? 'Hàng Đợi Duyệt Yêu Cầu Gia Hạn Thuê (Renewals Queue)' : 'Pending Renewal Approvals'}</span>
                      <Badge variant="info">{pendingRenewals.length} {lang === 'vi' ? 'yêu cầu' : 'requests'}</Badge>
                    </div>
                    <p className="text-[11px] text-blue-800">
                      {lang === 'vi' ? 'Manager kiểm tra xung đột ngày trước khi duyệt. Sau khi duyệt, khách thanh toán cước gia hạn.' : 'Check date conflicts before approving.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {pendingRenewals.map(rnw => {
                      const hasConflict = storeHolds.some(
                        h => h.assignedUnitId === rnw.unitId &&
                             ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status) &&
                             checkDateOverlap(rnw.oldEndDate, rnw.newEndDate, h.startDate, h.endDate)
                      )

                      return (
                        <div key={rnw.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-white p-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-900">{rnw.id}</span>
                              <span className="font-semibold text-stone-900">{rnw.customerName}</span>
                              <span className="font-mono font-bold text-emerald-800">Kho {rnw.unitId}</span>
                            </div>
                            <p className="text-stone-500 text-[11px] mt-0.5">
                              Hạn cũ: <b>{rnw.oldEndDate}</b> → Hạn mới mong muốn: <b className="text-blue-900">{rnw.newEndDate}</b> · Cước: <b>${rnw.renewalFee}</b>
                            </p>
                            {hasConflict ? (
                              <p className="text-red-600 font-bold text-[11px]">
                                ⚠️ Cảnh báo: Trùng lịch với đơn đặt giữ kho khác trên kho {rnw.unitId}!
                              </p>
                            ) : (
                              <p className="text-emerald-700 font-semibold text-[11px]">
                                 Không có xung đột lịch. Đủ điều kiện phê duyệt.
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 hover:bg-red-50 border-red-300"
                              onClick={() => {
                                rejectRenewal(rnw.id, user, 'Trùng lịch đặt kho khác')
                                showToast(lang === 'vi' ? `Đã từ chối yêu cầu gia hạn ${rnw.id}!` : `Renewal rejected.`)
                              }}
                            >
                              ✕ {lang === 'vi' ? 'Từ chối' : 'Reject'}
                            </Button>
                            <Button
                              size="sm"
                              disabled={hasConflict}
                              onClick={() => {
                                try {
                                  approveRenewal(rnw.id, user)
                                  showToast(lang === 'vi' ? `Đã phê duyệt gia hạn kho ${rnw.unitId} đến ${rnw.newEndDate}!` : `Renewal approved!`)
                                } catch (err: any) {
                                  showToast(err?.message || 'Error approving renewal')
                                }
                              }}
                            >
                               {lang === 'vi' ? 'Duyệt Gia Hạn' : 'Approve'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={lang === 'vi' ? 'Hợp đồng hiệu lực' : 'Active Leases'}
                value={activeRentals.length}
                delta={lang === 'vi' ? '+2 trong tháng' : '+2 this month'}
                deltaPositive
                icon={Icon.key}
                iconBg="bg-blue-50 text-blue-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Đã thu trong tháng' : 'Paid MTD'}
                value={`${paidRentals.length} / ${rentalsList.length}`}
                delta={`${Math.round((paidRentals.length / (rentalsList.length || 1)) * 100)}% ${lang === 'vi' ? 'đã thu' : 'collected'}`}
                deltaPositive
                icon={Icon.check}
                iconBg="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Chờ thu / Quá hạn' : 'Pending / Overdue'}
                value={overdueRentals.length}
                delta={lang === 'vi' ? 'Cần xử lý' : 'Requires attention'}
                deltaPositive={false}
                icon={Icon.alert}
                iconBg="bg-red-50 text-red-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Doanh thu tháng (MRR)' : 'Projected MRR'}
                value={`$${mrr.toLocaleString()}`}
                delta={lang === 'vi' ? '+$420 so với tháng trước' : '+$420 vs last month'}
                deltaPositive
                icon={Icon.dollar}
                iconBg="bg-amber-50 text-amber-800"
              />
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <Tabs
                tabs={lang === 'vi' ? ['Tất cả', 'Hiệu lực', 'Đã nộp', 'Quá hạn', 'Chờ xử lý'] : ['All', 'active', 'paid', 'overdue', 'pending']}
                active={
                  rentalTab === 'All' && lang === 'vi' ? 'Tất cả' :
                  rentalTab === 'active' && lang === 'vi' ? 'Hiệu lực' :
                  rentalTab === 'paid' && lang === 'vi' ? 'Đã nộp' :
                  rentalTab === 'overdue' && lang === 'vi' ? 'Quá hạn' :
                  rentalTab === 'pending' && lang === 'vi' ? 'Chờ xử lý' : rentalTab
                }
                onChange={val => {
                  if (val === 'Tất cả') setRentalTab('All')
                  else if (val === 'Hiệu lực') setRentalTab('active')
                  else if (val === 'Đã nộp') setRentalTab('paid')
                  else if (val === 'Quá hạn') setRentalTab('overdue')
                  else if (val === 'Chờ xử lý') setRentalTab('pending')
                  else setRentalTab(val)
                }}
              />
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder={lang === 'vi' ? 'Tìm theo khách, kho, SĐT, mã...' : 'Search tenant, unit, phone, ID...'}
                  value={rentalSearch}
                  onChange={e => setRentalSearch(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Rentals Table */}
            <Card>
              <Table>
                <Thead>
                  <tr>
                    <Th>{lang === 'vi' ? 'Mã Hợp Đồng' : 'Agreement'}</Th>
                    <Th>{lang === 'vi' ? 'Khách Thuê' : 'Tenant Details'}</Th>
                    <Th>{lang === 'vi' ? 'Thông Số Kho' : 'Unit Specs'}</Th>
                    <Th>{lang === 'vi' ? 'Kỳ Hợp Đồng' : 'Contract Dates'}</Th>
                    <Th>{lang === 'vi' ? 'Cước Tháng' : 'Monthly Rate'}</Th>
                    <Th>{lang === 'vi' ? 'Trạng Thái Cước' : 'Payment Status'}</Th>
                    <Th>{lang === 'vi' ? 'Tự Động Trừ' : 'Auto-Pay'}</Th>
                    <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Actions'}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filteredRentals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-stone-400 text-sm">
                        {lang === 'vi' ? 'Không tìm thấy hợp đồng nào theo bộ lọc hiện tại.' : 'No lease agreements found matching current filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRentals.map(r => (
                      <Tr key={r.id}>
                        <Td>
                          <span className="font-mono text-xs font-semibold text-stone-600">{r.id}</span>
                          <p className="text-[11px] text-stone-400">{r.facility}</p>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.customer} size="sm" />
                            <div>
                              <p className="font-medium text-sm text-stone-900">{r.customer}</p>
                              <p className="text-xs text-stone-400">{r.phone}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded text-xs">
                              {r.unit}
                            </span>
                            <span className="text-xs text-stone-500">{r.unitType}</span>
                          </div>
                          <p className="text-[11px] text-stone-400">{r.unitType || r.unit} · {r.areaM2 ? `${r.areaM2} m²` : ''}</p>
                        </Td>
                        <Td>
                          <div className="text-xs">
                            <p className="text-stone-700">{lang === 'vi' ? 'Từ' : 'From'}: {r.startDate}</p>
                            <p className="text-stone-400">{lang === 'vi' ? 'Hạn' : 'Due'}: <span className="font-semibold text-stone-800">{r.nextDue}</span></p>
                          </div>
                        </Td>
                        <Td>
                          <span className="font-bold text-sm text-stone-900">${r.amount}</span>
                          <span className="text-xs text-stone-400">/{lang === 'vi' ? 'th' : 'mo'}</span>
                        </Td>
                        <Td>
                          {r.paid === 'paid' && <Badge variant="success">{lang === 'vi' ? 'Đã đóng' : 'Paid'}</Badge>}
                          {r.paid === 'pending' && <Badge variant="warning">{lang === 'vi' ? 'Chờ xử lý' : 'Pending'}</Badge>}
                          {r.paid === 'overdue' && <Badge variant="error">{lang === 'vi' ? 'Quá hạn' : 'Overdue'}</Badge>}
                        </Td>
                        <Td>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.autoRenew ? 'text-emerald-700' : 'text-stone-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${r.autoRenew ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                            {lang === 'vi' ? (r.autoRenew ? 'Kích hoạt' : 'Thủ công') : (r.autoRenew ? 'Enrolled' : 'Manual')}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRental(r)
                                setViewRentalModal(true)
                              }}
                            >
                              {lang === 'vi' ? 'Chi tiết' : 'Details'}
                            </Button>
                            {r.paid !== 'paid' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedRental(r)
                                  setRecordPaymentModal(true)
                                }}
                              >
                                {lang === 'vi' ? 'Thu cước' : 'Collect'}
                              </Button>
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
      })()}

      {/* ── STAFF ASSIGNMENT ─────────────────────────────────── */}
      {page === 'staff' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Phân Công Nhân Viên Ca Trực' : 'Staff Assignment'}
            subtitle={lang === 'vi' ? 'Quản lý lịch trực ca, phân bổ khu vực và nhiệm vụ vận hành kho bãi' : 'Manage staff shifts and task assignments'}
          />
          <div className="space-y-4">
            {STAFF_LIST.map(s => (
              <Card key={s.id} className="p-5">
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size="lg" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{s.name}</h3>
                        {sb(s.status)}
                      </div>
                      <p className="text-sm text-slate-500">
                        {s.role} · {lang === 'vi' ? `Ca ${s.shift === 'Morning' ? 'Sáng' : s.shift === 'Evening' ? 'Chiều' : 'Đêm'}` : `${s.shift} Shift`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-900">{s.tasks}</p>
                      <p className="text-xs text-slate-400">{lang === 'vi' ? 'nhiệm vụ hôm nay' : 'tasks today'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? `Đã mở lịch trực của ${s.name}` : `Opened schedule for ${s.name}`)}>
                        {lang === 'vi' ? 'Sửa ca trực' : 'Edit Schedule'}
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => showToast(lang === 'vi' ? `Đã gửi giao việc mới cho ${s.name}` : `Dispatched task to ${s.name}`)}>
                        {lang === 'vi' ? 'Giao việc' : 'Assign Task'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── OVERDUE MANAGEMENT ───────────────────────────────── */}
      {page === 'overdue' && (() => {
        const totalOverdueRent = overdueList.reduce((sum, o) => sum + o.baseAmount, 0)
        const totalLateFees = overdueList.reduce((sum, o) => sum + o.lateFee, 0)
        const totalDueCombined = totalOverdueRent + totalLateFees
        const overlockedCount = overdueList.filter(o => o.overlocked).length
        const criticalCount = overdueList.filter(o => o.overdueDays >= 15).length

        const filteredOverdue = overdueList.filter(o => {
          const matchTab =
            overdueTab === 'All' || overdueTab === 'Tất cả' ||
            ((overdueTab === 'grace' || overdueTab.includes('Gia hạn')) && o.stage === 'grace') ||
            ((overdueTab === 'notice' || overdueTab.includes('Thông báo')) && o.stage === 'notice') ||
            ((overdueTab === 'overlocked' || overdueTab.includes('Khóa cổng')) && (o.stage === 'overlocked' || o.overlocked)) ||
            ((overdueTab === 'lien' || overdueTab.includes('Đấu giá')) && o.stage === 'lien')
          const query = overdueSearch.toLowerCase().trim()
          const matchSearch =
            !query ||
            o.customer.toLowerCase().includes(query) ||
            o.unit.toLowerCase().includes(query) ||
            o.email.toLowerCase().includes(query) ||
            o.phone.includes(query)
          return matchTab && matchSearch
        })

        const toggleOverlockStatus = (account: OverdueAccount) => {
          const updated = !account.overlocked
          setOverdueList(prev =>
            prev.map(item =>
              item.id === account.id
                ? {
                    ...item,
                    overlocked: updated,
                    stage: updated ? 'overlocked' : item.overdueDays >= 30 ? 'lien' : item.overdueDays >= 8 ? 'notice' : 'grace'
                  }
                : item
            )
          )
          showToast(
            updated
              ? (lang === 'vi' ? `Đã khóa cổng gian kho ${account.unit}. Vô hiệu mã PIN.` : `Overlock placed on Unit ${account.unit}. Gate PIN disabled.`)
              : (lang === 'vi' ? `Đã gỡ khóa cổng gian kho ${account.unit}. Khôi phục quyền ra vào.` : `Overlock removed from Unit ${account.unit}. Access restored.`)
          )
        }

        const handleApplyLateFee = (account: OverdueAccount) => {
          setOverdueList(prev =>
            prev.map(item =>
              item.id === account.id ? { ...item, lateFee: item.lateFee + 25 } : item
            )
          )
          showToast(lang === 'vi' ? `Đã tính thêm $25.00 phí phạt trễ hạn cho ${account.customer}` : `Applied $25.00 late penalty fee to ${account.customer}`)
        }

        const handleWaiveLateFee = (account: OverdueAccount) => {
          setOverdueList(prev =>
            prev.map(item =>
              item.id === account.id ? { ...item, lateFee: 0 } : item
            )
          )
          showToast(lang === 'vi' ? `Đã miễn toàn bộ phí phạt trễ hạn cho ${account.customer}` : `Waived late penalty fees for ${account.customer}`)
        }

        const handleSettleAccount = (account: OverdueAccount) => {
          setOverdueList(prev => prev.filter(item => item.id !== account.id))
          // Also mark paid in rentalsList
          setRentalsList(prev =>
            prev.map(r => r.unit === account.unit ? { ...r, paid: 'paid', paymentStatus: 'paid' } : r)
          )
          showToast(lang === 'vi' ? `Đã tất toán toàn bộ dư nợ cho gian kho ${account.unit}!` : `Full balance collected for Unit ${account.unit}! Account resolved.`)
        }

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={lang === 'vi' ? 'Quản Trị Nợ Quá Hạn & Thu Hồi' : 'Delinquency & Collections Management'}
              subtitle={lang === 'vi' ? 'Theo dõi tài khoản chậm nộp, áp dụng khóa cổng điện tử và gửi thông báo leo thang' : 'Monitor delinquent accounts, enforce digital gate overlocks, and track collection notices'}
              action={
                <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã xuất sổ nhật ký theo dõi nợ!' : 'Delinquency aging report exported!')}>
                  {lang === 'vi' ? 'Xuất sổ nợ' : 'Export Delinquency Log'}
                </Button>
              }
            />

            {/* Overview Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={lang === 'vi' ? 'Tài khoản nợ quá hạn' : 'Delinquent Accounts'}
                value={overdueList.length}
                delta={lang === 'vi' ? `${criticalCount} trường hợp nghiêm trọng` : `${criticalCount} at high risk`}
                deltaPositive={false}
                icon={Icon.alert}
                iconBg="bg-red-50 text-red-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Tổng dư nợ quá hạn' : 'Total Past Due'}
                value={`$${totalDueCombined.toLocaleString()}`}
                delta={lang === 'vi' ? `$${totalLateFees} tiền phạt trễ` : `$${totalLateFees} in late fees`}
                icon={Icon.dollar}
                iconBg="bg-amber-50 text-amber-800"
              />
              <StatCard
                title={lang === 'vi' ? 'Kho đang bị khóa cổng' : 'Units Overlocked'}
                value={overlockedCount}
                delta={lang === 'vi' ? 'Đã khóa quyền mở cổng' : 'Access denied at gate'}
                icon={Icon.shield}
                iconBg="bg-stone-100 text-stone-800"
              />
              <StatCard
                title={lang === 'vi' ? 'Nguy cơ đấu giá (30n+)' : 'Lien Stage (30d+)'}
                value={overdueList.filter(o => o.overdueDays >= 30).length}
                delta={lang === 'vi' ? 'Cần thông báo pháp lý' : 'Legal notice required'}
                deltaPositive={false}
                icon={Icon.policy}
                iconBg="bg-rose-50 text-rose-800"
              />
            </div>

            {/* Delinquency Aging Stage Summary Bar */}
            <Card className="p-4 bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-red-50/70 border-amber-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="eyebrow text-amber-900">{lang === 'vi' ? 'Quy Trình Xử Lý Nợ Quá Hạn' : 'Delinquency Protocol'}</p>
                  <p className="text-sm font-semibold text-stone-900 mt-0.5">
                    {lang === 'vi' ? 'Khung Thời Gian Leo Thang Pháp Lý Tiêu Chuẩn' : 'Standard Facility Escalation Timeline'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-medium">{lang === 'vi' ? '1–7n: Gia hạn nhắc nhở' : '1–7d: Grace'}</span>
                  <span className="px-2.5 py-1 rounded bg-orange-100 text-orange-900 font-medium">{lang === 'vi' ? '8–14n: Thông báo + Phạt' : '8–14d: Notice'}</span>
                  <span className="px-2.5 py-1 rounded bg-red-100 text-red-900 font-medium">{lang === 'vi' ? '15–30n: Khóa cổng số' : '15–30d: Overlock'}</span>
                  <span className="px-2.5 py-1 rounded bg-rose-200 text-rose-950 font-bold">{lang === 'vi' ? '30n+: Niêm phong đấu giá' : '30d+: Lien Auction'}</span>
                </div>
              </div>
            </Card>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <Tabs
                tabs={lang === 'vi' ? ['Tất cả', 'Gia hạn (1-7n)', 'Thông báo (8-14n)', 'Khóa cổng (15-30n)', 'Đấu giá (30n+)'] : ['All', 'grace', 'notice', 'overlocked', 'lien']}
                active={
                  overdueTab === 'All' && lang === 'vi' ? 'Tất cả' :
                  overdueTab === 'grace' && lang === 'vi' ? 'Gia hạn (1-7n)' :
                  overdueTab === 'notice' && lang === 'vi' ? 'Thông báo (8-14n)' :
                  overdueTab === 'overlocked' && lang === 'vi' ? 'Khóa cổng (15-30n)' :
                  overdueTab === 'lien' && lang === 'vi' ? 'Đấu giá (30n+)' : overdueTab
                }
                onChange={val => {
                  if (val === 'Tất cả') setOverdueTab('All')
                  else if (val.includes('Gia hạn')) setOverdueTab('grace')
                  else if (val.includes('Thông báo')) setOverdueTab('notice')
                  else if (val.includes('Khóa cổng')) setOverdueTab('overlocked')
                  else if (val.includes('Đấu giá')) setOverdueTab('lien')
                  else setOverdueTab(val)
                }}
              />
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder={lang === 'vi' ? 'Tìm theo khách nợ, gian kho, SĐT...' : 'Search delinquent tenant, unit, phone...'}
                  value={overdueSearch}
                  onChange={e => setOverdueSearch(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Delinquent Cards List */}
            <div className="space-y-4">
              {filteredOverdue.length === 0 ? (
                <Card className="p-10 text-center text-stone-400">
                  <p className="text-base font-semibold text-stone-700">{lang === 'vi' ? 'Không có tài khoản quá hạn trong mục này' : 'No overdue accounts in this category'}</p>
                  <p className="text-xs mt-1">{lang === 'vi' ? 'Tất cả khách hàng trong danh mục đã được thanh toán hoặc ở trạng thái tốt.' : 'All tenant accounts within this filter are settled or in good standing.'}</p>
                </Card>
              ) : (
                filteredOverdue.map(o => (
                  <Card
                    key={o.id}
                    className={`p-5 transition-all border-l-4 ${
                      o.overdueDays >= 30
                        ? 'border-l-rose-700 bg-rose-50/20'
                        : o.overdueDays >= 15
                        ? 'border-l-red-500 bg-red-50/15'
                        : o.overdueDays >= 8
                        ? 'border-l-amber-500'
                        : 'border-l-yellow-400'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Tenant Profile */}
                      <div className="flex items-start gap-3.5">
                        <Avatar name={o.customer} size="md" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-stone-900 text-base">{o.customer}</h3>
                            <span className="font-mono text-xs px-2 py-0.5 rounded font-bold bg-stone-100 text-stone-800">
                              {lang === 'vi' ? `Kho ${o.unit}` : `Unit ${o.unit}`}
                            </span>
                            <Badge variant={o.overdueDays >= 30 ? 'error' : o.overdueDays >= 15 ? 'error' : 'warning'}>
                              {lang === 'vi' ? (o.overdueDays >= 30 ? 'Niêm phong đấu giá' : o.overdueDays >= 15 ? 'Khóa cổng số' : o.overdueDays >= 8 ? 'Thông báo lần 2' : 'Gia hạn nhắc nhở') : o.stageLabel}
                            </Badge>
                            {o.overlocked && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                                 {lang === 'vi' ? 'ĐÃ KHÓA CỔNG' : 'OVERLOCKED'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 mt-1">
                            {o.email} • {o.phone} • {o.facility}
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {lang === 'vi' ? 'Lần thông báo gần nhất:' : 'Last notice dispatch:'} <span className="text-stone-600 font-medium">{o.lastContact}</span> ({lang === 'vi' ? 'Đã gửi:' : 'Total reminders:'} {o.remindersSent})
                          </p>
                        </div>
                      </div>

                      {/* Middle: Financial Breakdown */}
                      <div className="flex items-center gap-5 bg-white px-4 py-2 rounded-lg border border-stone-200/80">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-stone-400 font-mono">{lang === 'vi' ? 'Số ngày trễ' : 'Days Past'}</p>
                          <p className="text-base font-bold text-red-600">{o.overdueDays} {lang === 'vi' ? 'ngày' : 'days'}</p>
                        </div>
                        <div className="h-8 w-px bg-stone-200" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-stone-400 font-mono">{lang === 'vi' ? 'Cước gốc' : 'Base Rent'}</p>
                          <p className="text-base font-semibold text-stone-700">${o.baseAmount}</p>
                        </div>
                        <div className="h-8 w-px bg-stone-200" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-stone-400 font-mono">{lang === 'vi' ? 'Phí phạt trễ' : 'Late Penalty'}</p>
                          <p className="text-base font-semibold text-red-700">+${o.lateFee}</p>
                        </div>
                        <div className="h-8 w-px bg-stone-200" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-stone-400 font-mono">{lang === 'vi' ? 'Tổng cần nộp' : 'Total Due'}</p>
                          <p className="text-lg font-bold text-stone-900">${o.baseAmount + o.lateFee}</p>
                        </div>
                      </div>

                      {/* Right: Operational Actions */}
                      <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
                        <Button
                          variant={o.overlocked ? 'secondary' : 'danger'}
                          size="sm"
                          onClick={() => toggleOverlockStatus(o)}
                        >
                          {lang === 'vi' ? (o.overlocked ? 'Mở khóa cổng' : 'Khóa cổng') : (o.overlocked ? 'Release Lock' : 'Overlock Unit')}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOverdue(o)
                            setReminderModal(true)
                          }}
                        >
                          {lang === 'vi' ? 'Gửi thông báo' : 'Send Notice'}
                        </Button>

                        {o.lateFee === 0 ? (
                          <Button variant="ghost" size="sm" onClick={() => handleApplyLateFee(o)}>
                            {lang === 'vi' ? '+ Phạt' : '+ Fee'}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleWaiveLateFee(o)}>
                            {lang === 'vi' ? 'Miễn phạt' : 'Waive Fee'}
                          </Button>
                        )}

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSettleAccount(o)}
                        >
                          {lang === 'vi' ? 'Tất toán' : 'Settle'}
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar indicator */}
                    <div className="mt-3 pt-3 border-t border-stone-100">
                      <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                        <span>{lang === 'vi' ? `Chỉ số quá hạn (${o.overdueDays} / 45 ngày tối đa trước khi niêm phong đấu giá)` : `Delinquency Aging Index (${o.overdueDays} / 45 days max before public auction)`}</span>
                        <span className="font-semibold text-stone-600">
                          {o.overdueDays >= 30 ? (lang === 'vi' ? 'Giai đoạn đấu giá tài sản · Cần hành động ngay' : 'Lien Stage · Action Required') : o.overdueDays >= 15 ? (lang === 'vi' ? 'Quá hạn nghiêm trọng' : 'Severe Delinquency') : (lang === 'vi' ? 'Chậm nộp thông thường' : 'Moderate Late')}
                        </span>
                      </div>
                      <ProgressBar
                        value={o.overdueDays}
                        max={45}
                        color={o.overdueDays >= 30 ? 'bg-rose-700' : o.overdueDays >= 15 ? 'bg-red-500' : 'bg-amber-500'}
                      />
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )
      })()}

      {/* ── FACILITY POLICIES & OPERATIONAL RULES ──────────────── */}
      {page === 'policies' && (
        <div className="fade-in space-y-6">
          <SectionHeader
            title={lang === 'vi' ? 'Quy Định & Chính Sách Vận Hành Cơ Sở' : 'Facility Operational Policies'}
            subtitle={`${user.facility ?? 'Downtown Storage'} · ${lang === 'vi' ? 'Quy chế lưu kho, quy trình leo thang nợ, an toàn PCCC và chuẩn nghiệm thu bàn giao' : 'Storage terms, delinquency escalation, fire safety standards and move-out inspection protocol'}`}
            action={
              <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã tải cẩm nang chính sách vận hành (PDF)!' : 'Downloaded operational handbook (PDF)!')}>
                 {lang === 'vi' ? 'Tải Cẩm Nang Vận Hành' : 'Download Handbook'}
              </Button>
            }
          />

          {/* Quick Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Gia hạn thanh toán nợ' : 'Grace Period'}</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">7 <span className="text-sm font-normal text-stone-500">{lang === 'vi' ? 'ngày' : 'days'}</span></p>
              <p className="text-[11px] text-stone-500 mt-1">{lang === 'vi' ? 'Sau ngày đến hạn mới áp dụng phí phạt' : 'Before late penalty applies'}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Mức phạt trễ hạn cố định' : 'Fixed Late Fee'}</p>
              <p className="text-2xl font-bold text-red-600 mt-1">$25.00</p>
              <p className="text-[11px] text-stone-500 mt-1">{lang === 'vi' ? 'Áp dụng vào ngày thứ 8 quá hạn' : 'Charged on day 8 past due'}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Thời gian khóa giữ kho' : 'Unit Hold TTL'}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">24 <span className="text-sm font-normal text-stone-500">{lang === 'vi' ? 'giờ' : 'hours'}</span></p>
              <p className="text-[11px] text-stone-500 mt-1">{lang === 'vi' ? 'Tự động nhả kho nếu chưa nộp cọc' : 'Auto-releases if unpaid'}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 font-medium">{lang === 'vi' ? 'Thời gian cam kết hoàn cọc' : 'Deposit Refund SLA'}</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">24 <span className="text-sm font-normal text-stone-500">{lang === 'vi' ? 'giờ' : 'hours'}</span></p>
              <p className="text-[11px] text-stone-500 mt-1">{lang === 'vi' ? 'Sau nghiệm thu trả kho đạt chuẩn' : 'Post clean move-out inspection'}</p>
            </div>
          </div>

          {/* Detailed Policies Table */}
          <Card className="p-5">
            <h3 className="font-bold text-stone-900 text-base mb-3">{lang === 'vi' ? 'Danh Mục Quy Định Áp Dụng Cho Khách Thuê & Nhân Viên' : 'Operational Policy Matrix'}</h3>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Chính Sách' : 'Policy'}</Th>
                  <Th>{lang === 'vi' ? 'Mô Tả & Quy Chuẩn Áp Dụng' : 'Description & Enforcement'}</Th>
                  <Th>{lang === 'vi' ? 'Giá Trị Chuẩn' : 'Standard Value'}</Th>
                  <Th>{lang === 'vi' ? 'Quy Trình Kiểm Tra' : 'Enforcement Protocol'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {POLICIES.map(p => (
                  <Tr key={p.id}>
                    <Td><span className="font-bold text-sm text-stone-900">{p.name}</span></Td>
                    <Td><p className="text-xs text-stone-600 max-w-lg">{p.description}</p></Td>
                    <Td><span className="font-mono font-bold text-amber-800">{p.value}</span></Td>
                    <Td>
                      <Badge variant={p.status === 'active' ? 'success' : 'muted'}>
                        {lang === 'vi' ? 'Đang áp dụng' : 'Active'}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── PROFILE PAGE ─────────────────────────────────────── */}
      {page === 'profile' && (
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
      <Modal open={editModal} onClose={() => setEditModal(false)} title={lang === 'vi' ? 'Chỉnh Sửa Thông Số Gian Kho' : 'Edit Unit Specifications'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label={lang === 'vi' ? 'Mã gian kho' : 'Unit ID'} placeholder="U-XXX" />
            <Input label={lang === 'vi' ? 'Kích thước (ft)' : 'Size (ft)'} placeholder="10x10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={lang === 'vi' ? 'Tầng' : 'Floor'}><option>1</option><option>2</option><option>3</option><option>4</option></Select>
            <Select label={lang === 'vi' ? 'Trạng thái' : 'Status'}>
              <option>{lang === 'vi' ? 'Còn trống' : 'Available'}</option>
              <option>{lang === 'vi' ? 'Đã thuê' : 'Occupied'}</option>
              <option>{lang === 'vi' ? 'Bảo trì' : 'Maintenance'}</option>
              <option>{lang === 'vi' ? 'Đã đặt' : 'Reserved'}</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={lang === 'vi' ? 'Giá thuê/tháng ($)' : 'Monthly Price ($)'} placeholder="89" type="number" />
            <Select label={lang === 'vi' ? 'Hệ thống điều hòa' : 'Climate Control'}>
              <option>{lang === 'vi' ? 'Có điều hòa' : 'Yes'}</option>
              <option>{lang === 'vi' ? 'Không' : 'No'}</option>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setEditModal(false)}>
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button variant="primary" onClick={() => { setEditModal(false); showToast(lang === 'vi' ? 'Đã lưu thay đổi thông số gian kho!' : 'Unit specifications saved!') }}>
              {lang === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lease Details Modal */}
      <Modal open={viewRentalModal} onClose={() => setViewRentalModal(false)} title={lang === 'vi' ? 'Chi Tiết Hợp Đồng & Mã Cổng' : 'Lease Agreement & Access Details'}>
        {selectedRental && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#292a27] p-4 text-white">
              <div className="flex justify-between items-center text-xs font-mono text-[#e9a12c]">
                <span>{lang === 'vi' ? 'HỢP ĐỒNG' : 'AGREEMENT'} {selectedRental.id}</span>
                <span className="uppercase">{selectedRental.facility}</span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold font-mono">{lang === 'vi' ? `Kho ${selectedRental.unit}` : `Unit ${selectedRental.unit}`}</p>
                  <p className="text-xs text-stone-300">{selectedRental.unitType} · {selectedRental.areaM2 ? `${selectedRental.areaM2} m²` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-amber-300">${selectedRental.amount}<span className="text-xs text-stone-400">/{lang === 'vi' ? 'th' : 'mo'}</span></p>
                  <p className="text-[11px] text-stone-400">{lang === 'vi' ? 'Đặt cọc' : 'Deposit'}: ${selectedRental.deposit}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Tên khách thuê' : 'Tenant Name'}</span>
                <span className="font-semibold text-stone-800 text-sm">{selectedRental.customer}</span>
              </div>
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Số điện thoại' : 'Contact Phone'}</span>
                <span className="font-semibold text-stone-800 text-sm">{selectedRental.phone}</span>
              </div>
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Ngày bắt đầu' : 'Start Date'}</span>
                <span className="font-medium text-stone-700">{selectedRental.startDate}</span>
              </div>
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Hạn kỳ tiếp theo' : 'Current Expiry / Term'}</span>
                <span className="font-medium text-stone-700">{selectedRental.endDate}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-900">{lang === 'vi' ? 'Mã Khóa Cổng Số (Digital PIN)' : 'Digital Gate PIN Passcode'}</p>
                <p className="text-xs text-amber-700 font-mono font-bold mt-0.5">{selectedRental.gateCode}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => showToast(lang === 'vi' ? `Mã PIN ${selectedRental.gateCode} đã được tạo mới & gửi SMS đến khách!` : `Gate PIN ${selectedRental.gateCode} regenerated & dispatched via SMS!`)}
              >
                {lang === 'vi' ? 'Đặt lại mã PIN' : 'Reset PIN'}
              </Button>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-stone-100 text-xs text-stone-500">
              <span>{lang === 'vi' ? 'Tự động trừ nợ:' : 'Auto-Pay:'} {selectedRental.autoRenew ? (lang === 'vi' ? 'Đã kích hoạt' : 'Active (Visa ending 4242)') : (lang === 'vi' ? 'Chưa bật' : 'Disabled')}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewRentalModal(false)}>
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setRentalsList(prev => prev.map(r => r.id === selectedRental.id ? { ...r, status: 'terminated' } : r))
                    setViewRentalModal(false)
                    showToast(lang === 'vi' ? `Hợp đồng thuê ${selectedRental.id} đã được chấm dứt.` : `Lease agreement ${selectedRental.id} terminated.`)
                  }}
                >
                  {lang === 'vi' ? 'Chấm dứt hợp đồng' : 'Terminate Lease'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal open={recordPaymentModal} onClose={() => setRecordPaymentModal(false)} title={lang === 'vi' ? 'Ghi Nhận Thu Cước Thuê Kho' : 'Record Rent Settlement'}>
        {selectedRental && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-sm flex justify-between items-center">
              <div>
                <p className="font-semibold text-emerald-900">{lang === 'vi' ? `Kho ${selectedRental.unit}` : `Unit ${selectedRental.unit}`} · {selectedRental.customer}</p>
                <p className="text-xs text-emerald-700">{lang === 'vi' ? 'Hạn thu:' : 'Next Due:'} {selectedRental.nextDue}</p>
              </div>
              <p className="text-xl font-bold text-emerald-900">${selectedRental.amount}.00</p>
            </div>

            <Select label={lang === 'vi' ? 'Phương thức thanh toán' : 'Payment Method'}>
              <option>{lang === 'vi' ? 'Tiền mặt tại quầy' : 'Cash at Counter'}</option>
              <option>{lang === 'vi' ? 'Chuyển khoản VietQR' : 'Bank Transfer / VietQR'}</option>
              <option>{lang === 'vi' ? 'Quẹt thẻ máy POS' : 'POS Terminal Card Swipe'}</option>
              <option>{lang === 'vi' ? 'Thanh toán trực tuyến thẻ quốc tế' : 'Manual Card Charge'}</option>
            </Select>

            <Input
              label={lang === 'vi' ? 'Mã chứng từ / Biên lai' : 'Receipt / Transaction Reference'}
              placeholder="REC-2026-XXXX"
              defaultValue={`REC-${Date.now().toString().slice(-5)}`}
            />

            <div className="flex gap-2 justify-end pt-2 border-t border-stone-100">
              <Button variant="outline" onClick={() => setRecordPaymentModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setRentalsList(prev =>
                    prev.map(r => r.id === selectedRental.id ? { ...r, paid: 'paid', paymentStatus: 'paid' } : r)
                  )
                  setRecordPaymentModal(false)
                  showToast(lang === 'vi' ? `Đã ghi nhận thu $${selectedRental.amount} thành công cho gian kho ${selectedRental.unit}!` : `Payment of $${selectedRental.amount} recorded successfully for Unit ${selectedRental.unit}!`)
                }}
              >
                {lang === 'vi' ? 'Xác nhận thu cước' : 'Confirm Settlement'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Lease Agreement Modal */}
      <Modal open={newLeaseModal} onClose={() => setNewLeaseModal(false)} title={lang === 'vi' ? 'Tạo Hợp Đồng Thuê Kho Mới' : 'Create New Lease Agreement'}>
        <div className="space-y-4">
          <Input
            label={lang === 'vi' ? 'Họ và tên khách thuê' : 'Tenant Full Name'}
            placeholder="e.g. Nguyễn Thu Trang"
            value={newTenantName}
            onChange={e => setNewTenantName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              placeholder="tenant@email.com"
              value={newTenantEmail}
              onChange={e => setNewTenantEmail(e.target.value)}
            />
            <Input
              label={lang === 'vi' ? 'Số điện thoại' : 'Phone Number'}
              placeholder="+84 900 000 000"
              value={newTenantPhone}
              onChange={e => setNewTenantPhone(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={lang === 'vi' ? 'Chỉ định gian kho' : 'Assign Unit'}
              value={newTenantUnit}
              onChange={e => setNewTenantUnit(e.target.value)}
            >
              <option value="A-104">{lang === 'vi' ? 'Gian A-104 (Nhỏ · 2.25 m² · $89/tháng)' : 'Unit A-104 (Small · 2.25 m² · $89/mo)'}</option>
              <option value="C-301">{lang === 'vi' ? 'Gian C-301 (Lớn · 12.0 m² · $270/tháng)' : 'Unit C-301 (Large · 12.0 m² · $270/mo)'}</option>
              <option value="B-112">{lang === 'vi' ? 'Gian B-112 (Vừa · 6.0 m² · $150/tháng)' : 'Unit B-112 (Medium · 6.0 m² · $150/mo)'}</option>
            </Select>
            <Input
              label={lang === 'vi' ? 'Giá thuê/tháng ($)' : 'Monthly Rate ($)'}
              value={newTenantAmount}
              onChange={e => setNewTenantAmount(e.target.value)}
              type="number"
            />
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
            <Button variant="outline" onClick={() => setNewLeaseModal(false)}>
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              disabled={!newTenantName.trim()}
              onClick={() => {
                const newRec: RentalRecord = {
                  id: `RNT-2026-${Math.floor(100 + Math.random() * 900)}`,
                  customer: newTenantName,
                  tenant: newTenantName,
                  email: newTenantEmail || 'tenant@demo.storagehub',
                  phone: newTenantPhone || '+84 908 000 111',
                  unit: newTenantUnit,
                  unitType: 'Standard Climate',
                  size: 10,
                  facility: 'Downtown Storage',
                  amount: Number(newTenantAmount) || 89,
                  deposit: Number(newTenantAmount) || 89,
                  status: 'active',
                  paid: 'paid',
                  paymentStatus: 'paid',
                  startDate: 'Sep 18, 2026',
                  nextDue: 'Oct 18, 2026',
                  dueDate: 'Oct 18, 2026',
                  endDate: 'Sep 18, 2027',
                  autoRenew: true,
                  gateCode: `${Math.floor(1000 + Math.random() * 9000)}#`
                }
                setRentalsList([newRec, ...rentalsList])
                setNewLeaseModal(false)
                setNewTenantName('')
                showToast(lang === 'vi' ? `Hợp đồng mới ${newRec.id} cho khách ${newRec.customer} đã được kích hoạt!` : `New lease ${newRec.id} executed for ${newRec.customer}!`)
              }}
            >
              {lang === 'vi' ? 'Phát hành hợp đồng' : 'Issue Lease Contract'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Enhanced Overdue Reminder Modal */}
      <Modal open={reminderModal} onClose={() => setReminderModal(false)} title={lang === 'vi' ? 'Gửi Thông Báo Leo Thang Nợ Quá Hạn' : 'Delinquency Collection Notice Dispatch'}>
        {selectedOverdue && (
          <div className="space-y-4">
            <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1.5 border border-stone-200">
              <div className="flex justify-between">
                <span className="text-stone-500">{lang === 'vi' ? 'Khách hàng nhận' : 'Recipient'}</span>
                <span className="font-semibold text-stone-900">{selectedOverdue.customer} ({selectedOverdue.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">{lang === 'vi' ? 'Mã gian kho' : 'Unit Number'}</span>
                <span className="font-mono font-bold text-stone-800">{selectedOverdue.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">{lang === 'vi' ? 'Tổng nợ quá hạn' : 'Total Outstanding'}</span>
                <span className="font-bold text-red-600">${selectedOverdue.amount + selectedOverdue.lateFee} ({selectedOverdue.overdueDays} {lang === 'vi' ? 'ngày trễ' : 'days late'})</span>
              </div>
            </div>

            <Select
              label={lang === 'vi' ? 'Mẫu thông báo' : 'Notice Template'}
              value={reminderTemplate}
              onChange={e => setReminderTemplate(e.target.value)}
            >
              <option value="Friendly Reminder">{lang === 'vi' ? 'Nhắc nhở nhẹ nhàng (SMS & Email)' : 'Friendly Reminder (SMS & Email)'}</option>
              <option value="Second Notice">{lang === 'vi' ? 'Thông báo lần 2 (Cảnh báo phí phạt chậm nộp)' : 'Second Formal Notice (Late fee warning)'}</option>
              <option value="Overlock Warning">{lang === 'vi' ? 'Cảnh báo khóa cổng điện tử (Hạn 48 giờ)' : 'Digital Gate Overlock Warning (48-hour cutoff)'}</option>
              <option value="Lien Notice">{lang === 'vi' ? 'Thông báo pháp lý niêm phong & đấu giá tài sản' : 'Final Legal Notice of Lien & Public Auction'}</option>
            </Select>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">{lang === 'vi' ? 'Nội dung thông báo dự kiến' : 'Notice Body Preview'}</label>
              <textarea
                rows={4}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                defaultValue={
                  reminderTemplate.includes('Friendly') || reminderTemplate.includes('Nhắc')
                    ? (lang === 'vi' ? `Xin chào ${selectedOverdue.customer}, ban quản lý StorageHub xin nhắc cước phí thuê gian kho ${selectedOverdue.unit} với số tiền $${selectedOverdue.amount + selectedOverdue.lateFee} đã đến hạn thanh toán ngày ${selectedOverdue.dueDate}. Vui lòng thanh toán trực tuyến hoặc liên hệ quầy lễ tân.` : `Hi ${selectedOverdue.customer}, this is a polite reminder from Downtown Storage that rent of $${selectedOverdue.amount + selectedOverdue.lateFee} for unit ${selectedOverdue.unit} was due on ${selectedOverdue.dueDate}. Please click here to settle online.`)
                    : reminderTemplate.includes('Overlock') || reminderTemplate.includes('khóa')
                    ? (lang === 'vi' ? `CẢNH BÁO KHẨN: Quý khách ${selectedOverdue.customer}, gian kho ${selectedOverdue.unit} đã quá hạn ${selectedOverdue.overdueDays} ngày. Nếu không thanh toán trong 48 giờ tới, hệ thống sẽ tự động khóa cổng số (Overlock).` : `URGENT NOTICE: Tenant ${selectedOverdue.customer}, unit ${selectedOverdue.unit} is ${selectedOverdue.overdueDays} days past due. If not settled within 48 hours, digital gate keypad access will be suspended (Overlocked).`)
                    : (lang === 'vi' ? `THÔNG BÁO NIÊM PHONG PHÁP LÝ: Căn cứ quy chế thuê kho StorageHub, tài sản tại gian kho ${selectedOverdue.unit} sẽ bị niêm phong và tiến hành các thủ tục đấu giá công khai để thu hồi nợ đọng $${selectedOverdue.amount + selectedOverdue.lateFee}.` : `OFFICIAL LIEN NOTICE: Pursuant to the Self-Storage Facility Act, your stored property in unit ${selectedOverdue.unit} is subject to a possessory lien for unpaid rent of $${selectedOverdue.amount + selectedOverdue.lateFee}. Immediate payment is required.`)
                }
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-stone-100">
              <Button variant="outline" onClick={() => setReminderModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setReminderModal(false)
                  showToast(lang === 'vi' ? `Thông báo đã được gửi thành công đến ${selectedOverdue.customer} qua SMS & Email!` : `Notice successfully dispatched to ${selectedOverdue.customer} via Email & SMS!`)
                }}
              >
                {lang === 'vi' ? 'Gửi thông báo ngay' : 'Dispatch Notice Now'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
