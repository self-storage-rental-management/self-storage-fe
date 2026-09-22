import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Tabs, ProgressBar, Input, Select } from '../../components/ui'
import type { User } from '../../types'
import { FACILITIES, UNITS, RENTALS, UNIT_SPECS, REVENUE_TREND, CONVERSION_DATA, PRICING_TIERS, DISCOUNTS, POLICIES, FEES, type PromotionItem } from "../../data/demoDatabase"
import { formatVnd, USD_TO_VND_RATE } from '../../i18n/currency'
import { exportRevenueExcel } from '../../utils/excelExport'
import { useStorageHub } from '../../store/StorageHubContext'
import ProfileView from '../ProfileView'

export default function BusinessApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const hub = useStorageHub()
  const lang = 'vi'

  const formatCurrency = (amount: number): string => {
    if (amount >= 10000) {
      return `${Math.round(amount).toLocaleString('vi-VN')} ₫`
    }
    return formatVnd(amount)
  }

  const NAV: NavItem[] = [
    { id: 'facilities', label: 'Quản lý cơ sở', icon: Icon.building, group: 'Danh mục', permission: 'view_facilities' },
    { id: 'units', label: 'Quản lý kho', icon: Icon.box, group: 'Danh mục', permission: 'view_facilities' },
    { id: 'performance', label: 'Hiệu suất vận hành', icon: Icon.eye, group: 'Danh mục', permission: 'view_reports' },
    { id: 'policies', label: 'Chính sách thuê', icon: Icon.policy, group: 'Thương mại', permission: 'view_policies' },
    { id: 'pricing', label: 'Bảng giá & Phí', icon: Icon.dollar, group: 'Thương mại', permission: 'view_policies' },
    // Ẩn tab Khuyến mãi & Voucher trên UI (giữ nguyên logic nghiệp vụ bên dưới)
    // { id: 'discounts', label: 'Khuyến mãi & Voucher', icon: Icon.tag, group: 'Thương mại', permission: 'view_policies' },
    { id: 'revenue', label: 'Báo cáo doanh thu', icon: Icon.chart, group: 'Báo cáo', permission: 'view_reports' },
  ]
  const [page, setPage] = useState(() => getInitialPage(NAV, 'facilities'))
  const [pricingModal, setPricingModal] = useState(false)
  const [discountModal, setDiscountModal] = useState(false)
  const [policyModal, setPolicyModal] = useState(false)
  const [revenueTab, setRevenueTab] = useState('All Facilities')
  const [selectedPolicy, setSelectedPolicy] = useState<typeof POLICIES[0] | null>(null)
  const [selectedTier, setSelectedTier] = useState<typeof PRICING_TIERS[0] | null>(null)

  // Discounts & Promotions interactive state
  const [promotionsList, setPromotionsList] = useState<PromotionItem[]>(DISCOUNTS)
  const [promoTab, setPromoTab] = useState('All')
  const [promoSearch, setPromoSearch] = useState('')
  const [newPromoCode, setNewPromoCode] = useState('SPECIAL20')
  const [newPromoName, setNewPromoName] = useState('')
  const [newPromoDesc, setNewPromoDesc] = useState('')
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'fixed-amount' | 'first-month-free' | 'seasonal'>('percentage')
  const [newPromoValue, setNewPromoValue] = useState('20% OFF')
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('50')
  const [newPromoMinMonths, setNewPromoMinMonths] = useState('3')
  const [newPromoExpiry, setNewPromoExpiry] = useState('2026-12-31')

  // ── State Quản Lý Cơ Sở (CRUD Facilities: HCM-Q1-F01 & BD-F01) ──
  const [facilitiesList, setFacilitiesList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('storagehub:facilities')
      if (saved) {
        const parsed = JSON.parse(saved)
        const hasOfficial = parsed.some((f: any) => f.id === 'HCM-Q1-F01' && f.address?.includes('Bỉnh Khiêm')) &&
                            parsed.some((f: any) => f.id === 'BD-F01' && f.address?.includes('Lái Thiêu'))
        if (hasOfficial) return parsed
      }
    } catch {}
    return FACILITIES
  })

  useEffect(() => {
    try {
      localStorage.setItem('storagehub:facilities', JSON.stringify(facilitiesList))
    } catch {}
  }, [facilitiesList])

  const [createFacilityModal, setCreateFacilityModal] = useState<boolean>(false)
  const [editFacilityModal, setEditFacilityModal] = useState<boolean>(false)
  const [deleteFacilityModal, setDeleteFacilityModal] = useState<boolean>(false)
  const [viewFacilityModal, setViewFacilityModal] = useState<boolean>(false)
  const [selectedFacility, setSelectedFacility] = useState<any | null>(null)
  const [downloadingExcel, setDownloadingExcel] = useState<boolean>(false)
  const [downloadedFileName, setDownloadedFileName] = useState<string | null>(null)

  // Form thêm / sửa cơ sở
  const [formFacName, setFormFacName] = useState<string>('')
  const [formFacAddress, setFormFacAddress] = useState<string>('')
  const [formFacCity, setFormFacCity] = useState<string>('TP. Hồ Chí Minh')
  const [formFacManager, setFormFacManager] = useState<string>('')
  const [formFacUnits, setFormFacUnits] = useState<number>(20)
  const [formFacPrice, setFormFacPrice] = useState<string>('5.500.000đ')
  const [formFacClimate, setFormFacClimate] = useState<boolean>(true)
  const [formFacStatus, setFormFacStatus] = useState<'active' | 'maintenance'>('active')

  const handleCreateFacility = () => {
    if (!formFacName.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập tên cơ sở!' : 'Please enter facility name!')
      return
    }
    const newFac = {
      id: `FAC-${Date.now().toString().slice(-4)}`,
      name: formFacName.trim(),
      address: formFacAddress.trim() || 'TP. Hồ Chí Minh',
      city: formFacCity.trim(),
      manager: formFacManager.trim() || 'Quản lý cơ sở',
      units: Number(formFacUnits) || 20,
      occupied: 0,
      revenue: 0,
      growth: 0,
      rating: 4.9,
      price: formFacPrice,
      climate: formFacClimate,
      status: formFacStatus,
      security: '24/7',
      image: 'photo-1553413077-190dd305871c'
    }
    setFacilitiesList([newFac, ...facilitiesList])
    setCreateFacilityModal(false)
    showToast(lang === 'vi' ? `Đã thêm cơ sở "${newFac.name}" thành công!` : `Facility "${newFac.name}" created!`)
  }

  const handleUpdateFacility = () => {
    if (!selectedFacility) return
    setFacilitiesList(facilitiesList.map(f => f.id === selectedFacility.id ? {
      ...f,
      name: formFacName.trim(),
      address: formFacAddress.trim(),
      city: formFacCity.trim(),
      manager: formFacManager.trim(),
      units: Number(formFacUnits) || f.units,
      price: formFacPrice,
      climate: formFacClimate,
      status: formFacStatus
    } : f))
    setEditFacilityModal(false)
    showToast(lang === 'vi' ? `Đã cập nhật cơ sở "${formFacName}"!` : `Facility updated!`)
  }

  const handleDeleteFacility = () => {
    if (!selectedFacility) return
    if (selectedFacility.occupied > 0) {
      showToast(lang === 'vi' ? 'Không thể xóa cơ sở đang có khách thuê!' : 'Cannot delete facility with active tenants!')
      return
    }
    setFacilitiesList(facilitiesList.filter(f => f.id !== selectedFacility.id))
    setDeleteFacilityModal(false)
    showToast(lang === 'vi' ? `Đã xóa cơ sở "${selectedFacility.name}"!` : `Facility deleted!`)
  }

  // ── Helper sinh mã kho chuẩn: HCM-Q1-F01-S-001 hoặc BD-F01-M-001 ──
  const generateUnitCode = (facilityId: string, sizeCode: 'S' | 'M' | 'L' | 'XL', existingUnits: any[]) => {
    const isBD = facilityId === 'BD-F01' || facilityId.includes('BD') || facilityId.includes('Bình Dương')
    const prefix = isBD ? `BD-F01-${sizeCode}-` : `HCM-Q1-F01-${sizeCode}-`

    const existingNums = existingUnits
      .map(u => (u.code || u.id || ''))
      .filter(c => c.startsWith(prefix))
      .map(c => parseInt(c.slice(prefix.length), 10))
      .filter(n => !isNaN(n))

    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1
    return `${prefix}${String(nextNum).padStart(3, '0')}`
  }

  // ── State Quản Lý Kho (40 Kho Chuẩn: 20 HCM-Q1-F01 & 20 BD-F01) ──
  const [unitsList, setUnitsList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('storagehub:units')
      if (saved) {
        const parsed = JSON.parse(saved)
        const hasOfficialCodes = parsed.length >= 40 &&
          parsed.some((u: any) => u.code?.startsWith('HCM-Q1-F01')) &&
          parsed.some((u: any) => u.code?.startsWith('BD-F01')) &&
          parsed.some((u: any) => u.price === 5500000)
        if (hasOfficialCodes) {
          return parsed
        }
      }
    } catch {}
    const init = UNITS.map(u => {
      const spec = UNIT_SPECS[u.size as 'S' | 'M' | 'L' | 'XL'] || UNIT_SPECS.S
      return {
        ...u,
        code: u.id,
        facilityName: u.facility,
        areaM2: spec.areaM2,
        volumeM3: spec.volumeM3,
        aisleM: spec.aisleM,
        smallBoxes: spec.smallBoxes,
        largeBoxes: spec.largeBoxes,
        cartEquipment: spec.cartEquipment,
        dimensions: spec.dimensions,
        priceFormatted: `${Number(u.price).toLocaleString('vi-VN')}đ`
      }
    })
    try {
      localStorage.setItem('storagehub:units', JSON.stringify(init))
    } catch {}
    return init
  })

  // Lưu tự động vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('storagehub:units', JSON.stringify(unitsList))
    } catch {}
  }, [unitsList])

  // Bộ lọc danh sách kho
  const [unitFilterFacility, setUnitFilterFacility] = useState<string>('All')
  const [unitFilterType, setUnitFilterType] = useState<string>('All')
  const [unitFilterStatus, setUnitFilterStatus] = useState<string>('All')
  const [unitSearch, setUnitSearch] = useState<string>('')

  // Modals CRUD kho
  const [createUnitModal, setCreateUnitModal] = useState<boolean>(false)
  const [editUnitModal, setEditUnitModal] = useState<boolean>(false)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<boolean>(false)
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null)

  // Form thêm / sửa kho
  const [formCode, setFormCode] = useState<string>('HCM-Q1-F01-S-006')
  const [formFacilityId, setFormFacilityId] = useState<string>('HCM-Q1-F01')
  const [formSize, setFormSize] = useState<'S' | 'M' | 'L' | 'XL'>('S')
  const [formFloor, setFormFloor] = useState<number>(1)
  const [formZone, setFormZone] = useState<string>('Khu A')
  const [formPrice, setFormPrice] = useState<number>(5500000)
  const [formClimate, setFormClimate] = useState<boolean>(true)
  const [formStatus, setFormStatus] = useState<'available' | 'maintenance'>('available')

  const handleSizeChange = (size: 'S' | 'M' | 'L' | 'XL') => {
    setFormSize(size)
    const spec = UNIT_SPECS[size]
    setFormPrice(spec.priceMonthly)
  }

  // Thao tác CRUD Kho
  const handleCreateUnit = () => {
    const code = formCode.trim().toUpperCase()
    if (!code) {
      showToast(lang === 'vi' ? 'Vui lòng nhập mã gian kho!' : 'Please enter unit code!')
      return
    }
    if (unitsList.some(u => (u.code || u.id) === code)) {
      showToast(lang === 'vi' ? `Mã kho ${code} đã tồn tại trong hệ thống!` : `Unit code ${code} already exists!`)
      return
    }

    const isBD = formFacilityId === 'BD-F01' || formFacilityId.includes('BD') || formFacilityId.includes('Bình Dương')
    const facName = isBD ? 'Kho Việt – Cơ sở Bình Dương' : 'Kho Việt – Cơ sở Quận 1'
    const spec = UNIT_SPECS[formSize]

    const newUnit = {
      id: code,
      code,
      facility: facName,
      facilityName: facName,
      facilityId: formFacilityId,
      size: formSize,
      type: formSize === 'S' ? 'Small' : formSize === 'M' ? 'Medium' : formSize === 'L' ? 'Large' : 'Extra Large',
      dimensions: spec.dimensions,
      areaM2: spec.areaM2,
      volumeM3: spec.volumeM3,
      aisleM: spec.aisleM,
      smallBoxes: spec.smallBoxes,
      largeBoxes: spec.largeBoxes,
      cartEquipment: spec.cartEquipment,
      floor: formFloor,
      zone: formZone,
      price: formPrice,
      priceFormatted: `${Number(formPrice).toLocaleString('vi-VN')}đ`,
      climate: formClimate,
      status: formStatus
    }

    setUnitsList([newUnit, ...unitsList])
    setCreateUnitModal(false)
    showToast(lang === 'vi' ? `Đã thêm gian kho ${code} thành công!` : `Unit ${code} created successfully!`)
  }

  const handleUpdateUnit = () => {
    if (!selectedUnit) return
    setUnitsList(unitsList.map(u => (u.id === selectedUnit.id ? { ...u, price: formPrice, status: formStatus } : u)))
    setEditUnitModal(false)
    showToast(lang === 'vi' ? `Đã cập nhật gian kho ${selectedUnit.code || selectedUnit.id}!` : `Unit updated!`)
  }

  const handleDeleteUnit = () => {
    if (!selectedUnit) return
    if (selectedUnit.status === 'occupied') {
      showToast(lang === 'vi' ? 'Không thể xóa kho đang có khách thuê hoạt động!' : 'Cannot delete occupied unit!')
      return
    }
    setUnitsList(unitsList.filter(u => u.id !== selectedUnit.id))
    setDeleteConfirmModal(false)
    showToast(lang === 'vi' ? `Đã xóa gian kho ${selectedUnit.code || selectedUnit.id}!` : `Unit deleted!`)
  }

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const totalRevenue = facilitiesList.reduce((s, f) => s + (f.revenue || 0), 0)
  const totalUnits = unitsList.length || facilitiesList.reduce((s, f) => s + (f.units || 0), 0)
  const totalOccupied = unitsList.filter(u => u.status === 'occupied').length || facilitiesList.reduce((s, f) => s + (f.occupied || 0), 0)

  return (
    <Layout
      user={user} navItems={NAV} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      canAccess={permission => hub?.can ? hub.can(user, permission) : true}
      roleLabel={'Giám Đốc Thương Mại'} roleColor="bg-amber-100 text-amber-700"
    >
      {/* ── QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ──────────────────── */}
      {page === 'facilities' && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={lang === 'vi' ? 'Quản Lý Cơ Sở' : 'Facility Management'}
            subtitle={lang === 'vi' ? `${facilitiesList.length} cơ sở trong hệ thống – Thêm, sửa, xóa và theo dõi vận hành` : `${facilitiesList.length} ${facilitiesList.length === 1 ? 'facility' : 'facilities'} in the portfolio`}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setFormFacName('')
                  setFormFacAddress('')
                  setFormFacCity('Ho Chi Minh City')
                  setFormFacManager('')
                  setFormFacUnits(100)
                  setFormFacPrice('$89')
                  setFormFacClimate(true)
                  setFormFacStatus('active')
                  setCreateFacilityModal(true)
                }}
              >
                {Icon.plus} {lang === 'vi' ? 'Thêm Cơ Sở' : 'Add Facility'}
              </Button>
            }
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={lang === 'vi' ? 'Tổng số cơ sở' : 'Total Locations'} value={facilitiesList.length} icon={Icon.building} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Tổng số gian kho' : 'Total Units'} value={totalUnits} icon={Icon.box} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Tỷ lệ lấp đầy TB' : 'Portfolio Occupancy'} value={`${totalUnits ? Math.round(totalOccupied / totalUnits * 100) : 0}%`} icon={Icon.chart} iconBg="bg-green-50" />
            <StatCard title={lang === 'vi' ? 'Doanh thu tháng (MTD)' : 'Total Revenue MTD'} value={formatCurrency(totalRevenue)} icon={Icon.dollar} iconBg="bg-amber-50" />
          </div>
          <div className="space-y-4">
            {facilitiesList.map(f => (
              <Card key={f.id} className="p-5">
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900 text-base">{f.name}</h3>
                      <Badge variant={f.status === 'active' ? 'success' : 'warning'}>
                        {f.status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (lang === 'vi' ? 'Bảo trì / Sắp mở' : 'Maintenance')}
                      </Badge>
                      {f.climate && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                          {lang === 'vi' ? 'Điều hòa 24/7' : 'Climate'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{f.address} · {f.city} · {lang === 'vi' ? 'Quản lý' : 'Manager'}: <b className="text-slate-700">{f.manager}</b></p>
                    {f.status === 'active' && (
                      <div className="mt-3 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-slate-400">{lang === 'vi' ? 'Tỷ lệ lấp đầy' : 'Occupancy'}</p>
                          <p className="font-semibold text-slate-800">{f.occupied || 0}/{f.units} <span className="text-slate-400 text-xs">({f.units ? Math.round((f.occupied || 0) / f.units * 100) : 0}%)</span></p>
                          <ProgressBar value={f.occupied || 0} max={f.units} color="bg-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{lang === 'vi' ? 'Doanh thu tháng' : 'Revenue MTD'}</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(f.revenue || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{lang === 'vi' ? 'Giá cơ sở từ' : 'From'}</p>
                          <p className="font-semibold text-emerald-700">{f.price}/tháng</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedFacility(f); setViewFacilityModal(true) }}>
                      {lang === 'vi' ? 'Chi tiết' : 'View Details'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-400 text-amber-800 hover:bg-amber-50 font-medium"
                      onClick={() => {
                        setSelectedFacility(f)
                        setFormFacName(f.name)
                        setFormFacAddress(f.address)
                        setFormFacCity(f.city)
                        setFormFacManager(f.manager)
                        setFormFacUnits(f.units)
                        setFormFacPrice(f.price)
                        setFormFacClimate(f.climate ?? true)
                        setFormFacStatus(f.status)
                        setEditFacilityModal(true)
                      }}
                    >
                      ✏️ {lang === 'vi' ? 'Sửa' : 'Edit'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-medium"
                      onClick={() => {
                        setSelectedFacility(f)
                        setDeleteFacilityModal(true)
                      }}
                    >
                      🗑️ {lang === 'vi' ? 'Xóa' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── QUẢN LÝ GIAN KHO (CRUD THEO 2 CƠ SỞ & 4 LOẠI KHO) ── */}
      {page === 'units' && (() => {
        const filtered = unitsList.filter(u => {
          if (unitFilterFacility !== 'All' && u.facilityId !== unitFilterFacility && !u.facility?.includes(unitFilterFacility === 'fac-001' ? 'Downtown' : 'Riverside')) return false
          if (unitFilterType !== 'All' && u.type !== unitFilterType) return false
          if (unitFilterStatus !== 'All' && u.status !== unitFilterStatus) return false
          if (unitSearch.trim()) {
            const q = unitSearch.toLowerCase()
            return (u.code || u.id).toLowerCase().includes(q) || (u.zone || '').toLowerCase().includes(q) || (u.facilityName || u.facility || '').toLowerCase().includes(q)
          }
          return true
        })

        const totalCount = unitsList.length
        const availableCount = unitsList.filter(u => u.status === 'available').length
        const occupiedCount = unitsList.filter(u => u.status === 'occupied').length
        const maintenanceCount = unitsList.filter(u => u.status === 'maintenance').length

        return (
          <div className="fade-in space-y-5">
            <SectionHeader
              title={lang === 'vi' ? 'Quản Lý Danh Mục Gian Kho' : 'Storage Unit Management'}
              subtitle={lang === 'vi' ? 'Hệ thống 40 gian kho chuẩn hóa phân bổ 2 cơ sở (Quận 1 & Bình Dương) theo 4 phân loại S, M, L, XL' : '40 standardized units across 2 facilities (District 1 & Binh Duong) in 4 size tiers'}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const defaultFac = 'HCM-Q1-F01'
                    const defaultSize: 'S' = 'S'
                    setFormFacilityId(defaultFac)
                    handleSizeChange(defaultSize)
                    setFormCode(generateUnitCode(defaultFac, defaultSize, unitsList))
                    setCreateUnitModal(true)
                  }}
                >
                  {Icon.plus} {lang === 'vi' ? 'Thêm Gian Kho Mới' : 'Add New Unit'}
                </Button>
              }
            />

            {/* Thẻ KPI Thống Kê Gian Kho */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title={lang === 'vi' ? 'Tổng số gian kho' : 'Total Units'} value={totalCount} icon={Icon.box} iconBg="bg-blue-50" />
              <StatCard title={lang === 'vi' ? 'Đang có khách thuê' : 'Occupied'} value={occupiedCount} icon={Icon.check} iconBg="bg-green-50" />
              <StatCard title={lang === 'vi' ? 'Kho đang còn trống' : 'Available'} value={availableCount} icon={Icon.home} iconBg="bg-amber-50" />
              <StatCard title={lang === 'vi' ? 'Kho đang bảo trì' : 'Maintenance'} value={maintenanceCount} icon={Icon.alert} iconBg="bg-red-50" />
            </div>

            {/* Bảng Quy Chuẩn Thông Số Không Gian Kho (4 Phân Loại S / M / L / XL) */}
            <Card className="p-4 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 border border-amber-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📐</span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {lang === 'vi' ? 'Bảng Quy Chuẩn Thông Số Không Gian Kho (S / M / L / XL)' : 'Standard Storage Unit Space Specifications'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {lang === 'vi' ? 'Quy chuẩn kích thước, thể tích lưu trữ, lối đi xe và thiết bị xe đẩy hỗ trợ từng phân loại' : 'Standard dimensions, volume, aisle clearance, and trolley equipment'}
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-amber-100 text-amber-900 font-semibold px-2.5 py-1 rounded-full border border-amber-200">
                  {lang === 'vi' ? 'Định mức chuẩn 2026' : 'Standard 2026'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-amber-100/60 border-b border-amber-200 text-slate-800 font-semibold">
                      <th className="p-2.5 rounded-l">Size</th>
                      <th className="p-2.5">Kích thước kho D×R×C</th>
                      <th className="p-2.5">Thể tích</th>
                      <th className="p-2.5">Lối đi</th>
                      <th className="p-2.5">Giá thuê / tháng</th>
                      <th className="p-2.5">Thùng nhỏ</th>
                      <th className="p-2.5">Thùng to</th>
                      <th className="p-2.5 rounded-r">Xe đẩy hỗ trợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/70 bg-white/70">
                    {(['S', 'M', 'L', 'XL'] as const).map(s => {
                      const spec = UNIT_SPECS[s]
                      return (
                        <tr key={s} className="hover:bg-amber-50/80 transition-colors">
                          <td className="p-2.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded font-mono text-xs font-bold ${
                              s === 'S' ? 'bg-blue-100 text-blue-800' :
                              s === 'M' ? 'bg-green-100 text-green-800' :
                              s === 'L' ? 'bg-purple-100 text-purple-800' :
                              'bg-amber-100 text-amber-900'
                            }`}>{s}</span>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">{spec.dimensions}</td>
                          <td className="p-2.5 font-bold text-slate-700">{spec.volumeM3} m³</td>
                          <td className="p-2.5 text-slate-600">{spec.aisleM} m</td>
                          <td className="p-2.5 font-bold text-emerald-700">{spec.priceFormatted}</td>
                          <td className="p-2.5 font-mono text-slate-700">{spec.smallBoxes} thùng</td>
                          <td className="p-2.5 font-mono text-slate-700">{spec.largeBoxes} thùng</td>
                          <td className="p-2.5 font-medium text-slate-600">{spec.cartEquipment}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Thanh Bộ Lọc Đa Tiêu Chí */}
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{lang === 'vi' ? 'Tìm kiếm mã kho' : 'Search'}</label>
                  <Input
                    placeholder={lang === 'vi' ? 'Mã kho (VD: HCM-Q1, BD-F01)...' : 'Search code, zone...'}
                    value={unitSearch}
                    onChange={e => setUnitSearch(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{lang === 'vi' ? 'Cơ sở (2 cơ sở)' : 'Facility'}</label>
                  <Select value={unitFilterFacility} onChange={e => setUnitFilterFacility(e.target.value)}>
                    <option value="All">{lang === 'vi' ? 'Tất cả cơ sở (2 cơ sở)' : 'All Facilities'}</option>
                    <option value="HCM-Q1-F01">HCM-Q1-F01 – Kho Việt – Cơ sở Quận 1 (TP.HCM)</option>
                    <option value="BD-F01">BD-F01 – Kho Việt – Cơ sở Bình Dương</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{lang === 'vi' ? 'Kích thước kho (4 loại)' : 'Unit Size & Type'}</label>
                  <Select value={unitFilterType} onChange={e => setUnitFilterType(e.target.value)}>
                    <option value="All">{lang === 'vi' ? 'Tất cả 4 loại kho (S, M, L, XL)' : 'All Types'}</option>
                    <option value="S">{lang === 'vi' ? 'Kho Nhỏ (S · 5,6×6,0×3,2m · 5.500.000đ)' : 'Small (S · 5.6×6.0×3.2m · 5.500.000đ)'}</option>
                    <option value="M">{lang === 'vi' ? 'Kho Trung (M · 9,0×6,4×3,4m · 9.500.000đ)' : 'Medium (M · 9.0×6.4×3.4m · 9.500.000đ)'}</option>
                    <option value="L">{lang === 'vi' ? 'Kho Lớn (L · 13,5×6,8×3,6m · 15.000.000đ)' : 'Large (L · 13.5×6.8×3.6m · 15.000.000đ)'}</option>
                    <option value="XL">{lang === 'vi' ? 'Kho Rất Lớn (XL · 19,0×7,2×4,0m · 22.500.000đ)' : 'Extra Large (XL · 19.0×7.2×4.0m · 22.500.000đ)'}</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{lang === 'vi' ? 'Trạng thái' : 'Status'}</label>
                  <Select value={unitFilterStatus} onChange={e => setUnitFilterStatus(e.target.value)}>
                    <option value="All">{lang === 'vi' ? 'Tất cả trạng thái' : 'All Statuses'}</option>
                    <option value="available">{lang === 'vi' ? 'Còn trống' : 'Available'}</option>
                    <option value="occupied">{lang === 'vi' ? 'Đang thuê' : 'Occupied'}</option>
                    <option value="reserved">{lang === 'vi' ? 'Đã đặt giữ' : 'Reserved'}</option>
                    <option value="maintenance">{lang === 'vi' ? 'Bảo trì' : 'Maintenance'}</option>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Bảng Danh Sách Kho (CRUD Table) */}
            <Card>
              <Table>
                <Thead>
                  <tr>
                    <Th>{lang === 'vi' ? 'Mã Kho' : 'Unit Code'}</Th>
                    <Th>{lang === 'vi' ? 'Cơ Sở' : 'Facility'}</Th>
                    <Th>{lang === 'vi' ? 'Loại & Kích Thước D×R×C' : 'Type & Dimensions'}</Th>
                    <Th>{lang === 'vi' ? 'Sức Chứa & Xe Đẩy' : 'Capacity & Equipment'}</Th>
                    <Th>{lang === 'vi' ? 'Vị Trí' : 'Location'}</Th>
                    <Th>{lang === 'vi' ? 'Giá Thuê/Tháng' : 'Monthly Rate'}</Th>
                    <Th>{lang === 'vi' ? 'Máy Lạnh' : 'Climate'}</Th>
                    <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
                    <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filtered.length === 0 ? (
                    <Tr>
                      <Td colSpan={9} className="text-center py-8 text-slate-400">
                        {lang === 'vi' ? 'Không tìm thấy gian kho phù hợp với bộ lọc.' : 'No units matching your filter criteria.'}
                      </Td>
                    </Tr>
                  ) : (
                    filtered.map(u => {
                      const spec = UNIT_SPECS[u.size as 'S' | 'M' | 'L' | 'XL'] || UNIT_SPECS.S
                      const sizeBadgeColor =
                        u.size === 'S' ? 'bg-blue-100 text-blue-800' :
                        u.size === 'M' ? 'bg-green-100 text-green-800' :
                        u.size === 'L' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-900'

                      return (
                        <Tr key={u.id}>
                          <Td className="font-mono font-bold text-slate-900 whitespace-nowrap">{u.code || u.id}</Td>
                          <Td>
                            <span className="font-semibold text-slate-800 block">{u.facilityName || u.facility}</span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                              {(u.facilityName || u.facility || '').includes('Quận 1') || (u.code || '').startsWith('HCM')
                                ? '125 Nguyễn Bỉnh Khiêm, Q1, TP.HCM'
                                : '468 Đại lộ Bình Dương, Lái Thiêu'}
                            </span>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${sizeBadgeColor}`}>
                                {u.size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : 'XL')}
                              </span>
                              <span className="font-semibold text-slate-800 text-xs">
                                {u.size === 'S' || u.type === 'Small' ? 'Kho Nhỏ' :
                                 u.size === 'M' || u.type === 'Medium' ? 'Kho Trung' :
                                 u.size === 'L' || u.type === 'Large' ? 'Kho Lớn' : 'Kho Rất Lớn'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-medium">
                              {spec.dimensions} · {spec.volumeM3} m³
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Lối đi: {spec.aisleM} m
                            </p>
                          </Td>
                          <Td className="text-xs">
                            <span className="text-slate-800 font-semibold block">{spec.smallBoxes} nhỏ / {spec.largeBoxes} to</span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[140px]" title={spec.cartEquipment}>
                              {spec.cartEquipment}
                            </span>
                          </Td>
                          <Td className="text-xs text-slate-600 whitespace-nowrap">
                            {lang === 'vi' ? `Tầng ${u.floor || 1} · ${u.zone || 'Khu A'}` : `Floor ${u.floor || 1} · ${u.zone || 'Zone A'}`}
                          </Td>
                          <Td className="font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {Number(u.price).toLocaleString('vi-VN')}đ/tháng
                          </Td>
                          <Td>
                            <Badge variant={u.climate ? 'info' : 'muted'}>
                              {u.climate ? (lang === 'vi' ? 'Máy lạnh 24/7' : 'Climate') : (lang === 'vi' ? 'Thường' : 'Standard')}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge variant={u.status === 'available' ? 'success' : u.status === 'occupied' ? 'info' : u.status === 'maintenance' ? 'error' : 'warning'}>
                              {u.status === 'available' ? (lang === 'vi' ? 'Còn trống' : 'Available') :
                               u.status === 'occupied' ? (lang === 'vi' ? 'Đang thuê' : 'Occupied') :
                               u.status === 'maintenance' ? (lang === 'vi' ? 'Bảo trì' : 'Maintenance') : (lang === 'vi' ? 'Đã đặt' : 'Reserved')}
                            </Badge>
                          </Td>
                          <Td className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              <Button variant="ghost" size="sm" onClick={() => {
                                setSelectedUnit(u)
                                setFormPrice(u.price)
                                setFormStatus(u.status as any)
                                setEditUnitModal(true)
                              }}>
                                {lang === 'vi' ? 'Sửa' : 'Edit'}
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => {
                                setSelectedUnit(u)
                                setDeleteConfirmModal(true)
                              }}>
                                {lang === 'vi' ? 'Xóa' : 'Delete'}
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
        )
      })()}

      {/* ── RENTAL POLICIES ───────────────────────────────────── */}
      {page === 'policies' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Quy Định & Chính Sách Thuê Kho' : 'Rental Policies'}
            subtitle={lang === 'vi' ? 'Các điều khoản, quy chế thương mại áp dụng thống nhất toàn hệ thống' : 'Company-wide rental terms and conditions'}
            action={<Button variant="primary" size="sm" onClick={() => showToast(lang === 'vi' ? 'Tạo chính sách mới.' : 'New policy dialog.')}>{Icon.plus} {lang === 'vi' ? 'Thêm Chính Sách' : 'Add Policy'}</Button>}
          />
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Tên Chính Sách' : 'Policy Name'}</Th>
                  <Th>{lang === 'vi' ? 'Giá Trị Áp Dụng' : 'Current Value'}</Th>
                  <Th>{lang === 'vi' ? 'Phạm Vi' : 'Scope'}</Th>
                  <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {POLICIES.map(p => (
                  <Tr key={p.id}>
                    <Td className="font-medium text-slate-800">
                      {lang === 'vi' ? (
                        p.name === 'Grace Period' ? 'Thời gian gia hạn nợ' :
                          p.name === 'Late Fee' ? 'Mức phí phạt trễ hạn' :
                            p.name === 'Security Deposit' ? 'Tiền đặt cọc an ninh' :
                              p.name === 'Notice to Vacate' ? 'Thời hạn báo trước khi trả phòng' :
                                p.name === 'Minimum Lease' ? 'Thời hạn thuê tối thiểu' : p.name
                      ) : p.name}
                    </Td>

                    <Td>
                      {lang === 'vi' ? (
                        p.value.includes('days') ? p.value.replace('days', 'ngày') :
                          p.value.includes('month')
                            ? p.value.replace('$25', '650.000 ₫').replace('month', 'tháng')
                            : (p.value ?? '—')
                      ) : (p.value ?? '—')}
                    </Td>

                    <Td><Badge variant="muted">{lang === 'vi' ? (p.scope === 'All Facilities' ? 'Toàn bộ cơ sở' : p.scope) : p.scope}</Badge></Td>
                    <Td className="text-right">
                      {p.editable && (
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedPolicy(p); setPolicyModal(true) }}>
                          {lang === 'vi' ? 'Sửa' : 'Edit'}
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── PRICING & FEES ────────────────────────────────────── */}
      {page === 'pricing' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Bảng Giá Niêm Yết & Biểu Phí' : 'Pricing & Fees'}
            subtitle={lang === 'vi' ? 'Quản lý các phân tầng giá theo kích thước và biểu phí dịch vụ phát sinh' : 'Manage unit pricing tiers and fee schedules'}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {PRICING_TIERS.map(tier => (
              // <Card key={tier.type} className="p-5"> 
              <Card key={tier.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {/* <h3 className="font-bold text-slate-900">{tier.type}</h3> */}
                    <h3 className="font-bold text-slate-900">{tier.name}</h3>
                    {/* <p className="text-xs text-slate-400">{tier.sizes} ft</p> */}
                    <p className="text-xs text-slate-400">{tier.size}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedTier(tier); setPricingModal(true) }}>
                    {lang === 'vi' ? 'Sửa' : 'Edit'}
                  </Button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'vi' ? 'Giá cơ sở' : 'Base price'}</span>
                    <span className="font-semibold">{formatCurrency(tier.basePrice)}/{lang === 'vi' ? 'th' : 'mo'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'vi' ? 'Phụ phí điều hòa' : 'Climate adder'}</span>
                    <span className="font-semibold">+{formatCurrency(tier.climateAdder)}/{lang === 'vi' ? 'th' : 'mo'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <span className="text-slate-500">{lang === 'vi' ? 'Hệ số cao điểm' : 'High demand'}</span>
                    <span className="font-semibold text-blue-600">×{tier.highDemandMultiplier}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4">{lang === 'vi' ? 'Biểu Phí Dịch Vụ Quy Định' : 'Fee Schedule'}</h3>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Loại Phí' : 'Fee Type'}</Th>
                  <Th>{lang === 'vi' ? 'Mức Phí' : 'Amount'}</Th>
                  <Th>{lang === 'vi' ? 'Điều Kiện Áp Dụng' : 'Trigger'}</Th>
                  <Th>{lang === 'vi' ? 'Đối Tượng' : 'Applies To'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {FEES.map(f => (
                  <Tr key={f.type}>
                    <Td className="font-medium">
                      {lang === 'vi' ? (
                        f.type.includes('Late') ? 'Phí nộp muộn' :
                          f.type.includes('Admin') ? 'Phí hồ sơ ban đầu' :
                            f.type.includes('Lock') ? 'Phí cắt khóa số' :
                              f.type.includes('Cleaning') ? 'Phí dọn vệ sinh kho' : f.type
                      ) : f.type}
                    </Td>
                    {/* <Td className="font-semibold text-blue-700">{f.amount}</Td> */}
                    <Td className="font-semibold text-blue-700">
                      {formatCurrency(parseFloat(f.amount.replace(/[^0-9.-]+/g, '')) || 0)}
                    </Td>
                    <Td className="text-slate-500">
                      {lang === 'vi' ? (
                        f.trigger.includes('past due') ? 'Quá hạn thanh toán 7 ngày' :
                          f.trigger.includes('Move-in') ? 'Khi ký hợp đồng nhận kho' :
                            f.trigger.includes('Lost key') ? 'Quên mã PIN hoặc kẹt khóa' :
                              f.trigger.includes('Move-out') ? 'Trả kho còn rác bẩn' : f.trigger
                      ) : f.trigger}
                    </Td>
                    <Td><Badge variant="muted">{lang === 'vi' ? (f.applies === 'All Facilities' ? 'Toàn bộ cơ sở' : f.applies) : f.applies}</Badge></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── DISCOUNTS & PROMOTIONS ─────────────────────────── */}
      {page === 'discounts' && (() => {
        const activePromos = promotionsList.filter(p => p.status === 'active')
        const totalRedemptions = promotionsList.reduce((sum, p) => sum + p.uses, 0)
        const totalCapacity = promotionsList.reduce((sum, p) => sum + p.maxUses, 0)

        const filteredPromos = promotionsList.filter(p => {
          const matchTab =
            promoTab === 'All' || promoTab === 'Tất cả' ||
            ((promoTab === 'active' || promoTab === 'Đang chạy') && p.status === 'active') ||
            ((promoTab === 'paused' || promoTab === 'Tạm dừng') && p.status === 'paused') ||
            ((promoTab === 'expired' || promoTab === 'Hết hạn') && p.status === 'expired')
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
          showToast(lang === 'vi' ? `Đã sao chép mã ưu đãi "${code}" vào clipboard!` : `Promo code "${code}" copied to clipboard!`)
        }

        const togglePromoStatus = (id: string) => {
          setPromotionsList(prev =>
            prev.map(p => {
              if (p.id !== id) return p
              const nextStatus = p.status === 'active' ? 'paused' : 'active'
              return { ...p, status: nextStatus, active: nextStatus === 'active' }
            })
          )
          showToast(lang === 'vi' ? 'Đã chuyển đổi trạng thái chiến dịch.' : 'Campaign status toggled.')
        }

        const deletePromo = (id: string) => {
          setPromotionsList(prev => prev.filter(p => p.id !== id))
          showToast(lang === 'vi' ? 'Đã gỡ bỏ chiến dịch khuyến mãi.' : 'Promotional campaign removed.')
        }

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={lang === 'vi' ? 'Chiến Dịch Khuyến Mãi & Voucher' : 'Discounts & Commercial Promotions'}
              subtitle={lang === 'vi' ? 'Thiết lập mã giảm giá, quản lý hạn ngạch voucher và theo dõi tỷ lệ chuyển đổi khách mới' : 'Design targeted voucher campaigns, manage concession rules, and track tenant acquisition redemption rates'}
              action={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã xuất dữ liệu hiệu quả chiến dịch!' : 'Campaign performance analytics exported!')}>
                    {lang === 'vi' ? 'Xuất báo cáo' : 'Export Report'}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setDiscountModal(true)}>
                    {Icon.plus} {lang === 'vi' ? 'Tạo Khuyến Mãi Mới' : 'New Promotion'}
                  </Button>
                </div>
              }
            />

            {/* Campaign Analytics KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={lang === 'vi' ? 'Chiến dịch đang chạy' : 'Active Campaigns'}
                value={activePromos.length}
                delta={lang === 'vi' ? `${promotionsList.length} tổng đã tạo` : `${promotionsList.length} total created`}
                deltaPositive
                icon={Icon.tag}
                iconBg="bg-amber-50 text-amber-800"
              />
              <StatCard
                title={lang === 'vi' ? 'Lượt áp dụng thành công' : 'Total Redemptions'}
                value={totalRedemptions}
                delta={`${Math.round((totalRedemptions / (totalCapacity || 1)) * 100)}% ${lang === 'vi' ? 'hạn ngạch đã nhận' : 'quota claimed'}`}
                deltaPositive
                icon={Icon.chart}
                iconBg="bg-blue-50 text-blue-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Ước tính ưu đãi đã trao' : 'Granted Savings Est.'}
                ///value={`$${(totalRedemptions * 32).toLocaleString()}`}
                value={formatCurrency(totalRedemptions * 32)}
                delta={lang === 'vi' ? 'Khuyến khích khách thuê' : 'Tenant incentive'}
                icon={Icon.dollar}
                iconBg="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Gia tăng chuyển đổi' : 'Conversion Lift'}
                value="+18.4%"
                delta={lang === 'vi' ? 'so với không áp mã' : 'vs non-promo bookings'}
                deltaPositive
                icon={Icon.refresh}
                iconBg="bg-purple-50 text-purple-700"
              />
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <Tabs
                tabs={lang === 'vi' ? ['Tất cả', 'Đang chạy', 'Tạm dừng', 'Hết hạn'] : ['All', 'active', 'paused', 'expired']}
                active={
                  promoTab === 'All' && lang === 'vi' ? 'Tất cả' :
                    promoTab === 'active' && lang === 'vi' ? 'Đang chạy' :
                      promoTab === 'paused' && lang === 'vi' ? 'Tạm dừng' :
                        promoTab === 'expired' && lang === 'vi' ? 'Hết hạn' : promoTab
                }
                onChange={val => {
                  if (val === 'Tất cả') setPromoTab('All')
                  else if (val === 'Đang chạy') setPromoTab('active')
                  else if (val === 'Tạm dừng') setPromoTab('paused')
                  else if (val === 'Hết hạn') setPromoTab('expired')
                  else setPromoTab(val)
                }}
              />
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder={lang === 'vi' ? 'Tìm tên chương trình, mã voucher...' : 'Search promo name, code, units...'}
                  value={promoSearch}
                  onChange={e => setPromoSearch(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Campaign Cards Grid */}
            <div className="space-y-4">
              {filteredPromos.length === 0 ? (
                <Card className="p-10 text-center text-stone-400">
                  <p className="font-semibold text-stone-700">{lang === 'vi' ? 'Không tìm thấy chiến dịch khuyến mãi nào' : 'No promotion campaigns found in this view'}</p>
                  <p className="text-xs mt-1">{lang === 'vi' ? 'Tạo mã voucher mới hoặc đổi bộ lọc trạng thái.' : 'Create a new voucher code or switch the status filter.'}</p>
                </Card>
              ) : (
                filteredPromos.map(p => (
                  <Card key={p.id} className="p-5 hover:border-stone-300 transition">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left: Campaign details */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-bold text-stone-900 text-base">{p.name}</h3>
                          <Badge variant={p.status === 'active' ? 'success' : p.status === 'paused' ? 'warning' : 'muted'}>
                            {p.status === 'active' ? (lang === 'vi' ? 'Đang chạy' : 'active') : p.status === 'paused' ? (lang === 'vi' ? 'Tạm dừng' : 'paused') : (lang === 'vi' ? 'Hết hạn' : 'expired')}
                          </Badge>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                            {lang === 'vi' ? (
                              p.type === 'percentage' ? 'Giảm theo %' :
                                p.type === 'first-month-free' ? 'Tháng đầu 0đ' :
                                  p.type === 'fixed-amount' ? 'Giảm số tiền' : 'Ưu đãi mùa vụ'
                            ) : p.typeLabel}
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                          {p.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-stone-400">{lang === 'vi' ? 'Mã voucher:' : 'Code:'}</span>
                            <button
                              type="button"
                              onClick={() => copyCodeToClipboard(p.code)}
                              className="font-mono font-bold bg-[#fbfaf6] hover:bg-amber-100 hover:text-amber-900 border border-stone-300 px-2 py-0.5 rounded text-stone-800 transition flex items-center gap-1 group"
                              title={lang === 'vi' ? 'Bấm để copy mã' : 'Click to copy code'}
                            >
                              <span>{p.code}</span>
                              <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                          <span>•</span>
                          <span>{lang === 'vi' ? 'Ưu đãi:' : 'Benefit:'} <strong className="text-stone-800">{p.discount}</strong></span>
                          <span>•</span>
                          <span>{lang === 'vi' ? 'Hợp đồng tối thiểu:' : 'Commitment:'} {p.minLeaseMonths} {lang === 'vi' ? 'tháng' : 'mo min'}</span>
                          <span>•</span>
                          <span>{lang === 'vi' ? 'Phạm vi:' : 'Scope:'} {lang === 'vi' && p.applicableFacility === 'All facilities' ? 'Toàn bộ cơ sở' : p.applicableFacility} ({p.applicableUnitType})</span>
                        </div>
                      </div>

                      {/* Right: Usage Quota & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 flex-shrink-0">
                        <div className="w-48 text-right">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-stone-400">{lang === 'vi' ? 'Hạn ngạch đã dùng' : 'Claims Quota'}</span>
                            <span className="font-bold text-stone-800">{p.uses} / {p.maxUses}</span>
                          </div>
                          <ProgressBar
                            value={p.uses}
                            max={p.maxUses}
                            color={p.status === 'expired' ? 'bg-stone-300' : 'bg-[#e9a12c]'}
                          />
                          <p className="text-[10px] text-stone-400 mt-1">{lang === 'vi' ? 'Hiệu lực:' : 'Valid:'} {p.startDate} – {p.expires}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant={p.status === 'active' ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() => togglePromoStatus(p.id)}
                          >
                            {p.status === 'active' ? (lang === 'vi' ? 'Tạm dừng' : 'Pause') : (lang === 'vi' ? 'Kích hoạt' : 'Activate')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => deletePromo(p.id)}
                          >
                            {lang === 'vi' ? 'Xóa' : 'Delete'}
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
      {page === 'revenue' && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={lang === 'vi' ? 'Báo Cáo Doanh Thu' : 'Revenue Reports'}
            subtitle={REVENUE_TREND.length ? (lang === 'vi' ? `Hiệu quả doanh thu chu kỳ ${REVENUE_TREND[0].month}–${REVENUE_TREND[REVENUE_TREND.length - 1].month}` : `${REVENUE_TREND[0].month}–${REVENUE_TREND[REVENUE_TREND.length - 1].month} revenue performance`) : 'Revenue period unavailable'}
            action={
              <Button
                variant="primary"
                size="sm"
                disabled={downloadingExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                onClick={() => {
                  setDownloadingExcel(true)
                  const targetFac = revenueTab === 'All Facilities' || revenueTab === 'Toàn bộ cơ sở' ? 'Toàn bộ cơ sở' : revenueTab
                  const dateStr = new Date().toISOString().slice(0, 10)
                  const fileName = `Bao_Cao_Doanh_Thu_StorageHub_${dateStr}.xlsx`

                  setTimeout(() => {
                    try {
                      exportRevenueExcel({
                        facilityName: targetFac,
                        filterUnitType: 'Tất cả 4 loại kho',
                        period: 'Tháng 9/2026',
                        totalRevenue: 29340,
                        units: unitsList,
                        rentals: RENTALS
                      })
                      setDownloadedFileName(fileName)
                      showToast(lang === 'vi' ? `Đã tải xuống file: ${fileName}` : `File downloaded: ${fileName}`)
                    } catch (err) {
                      showToast(lang === 'vi' ? 'Lỗi khi xuất file Excel!' : 'Failed to export Excel file!')
                    } finally {
                      setDownloadingExcel(false)
                    }
                  }, 450)
                }}
              >
                {downloadingExcel ? (lang === 'vi' ? '⏳ Đang tải file...' : '⏳ Downloading...') : `${Icon.check} ${lang === 'vi' ? 'Xuất Báo Cáo Excel (.xlsx)' : 'Export Excel (.xlsx)'}`}
              </Button>
            }
          />

          {/* Download Notification Banner */}
          {downloadingExcel && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 animate-pulse">
              <span className="text-2xl animate-spin">⏳</span>
              <div>
                <p className="font-bold text-amber-900 text-sm">{lang === 'vi' ? 'Đang tạo và tải file Excel báo cáo doanh thu...' : 'Generating and downloading Excel report...'}</p>
                <p className="text-xs text-amber-700">{lang === 'vi' ? 'Tổng hợp 3 sheet: Tổng quan doanh thu, Chi tiết hợp đồng và Hiệu suất kho...' : 'Compiling 3 sheets: Revenue Overview, Active Rentals, and Unit Roster...'}</p>
              </div>
            </div>
          )}

          {downloadedFileName && !downloadingExcel && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  📊
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-emerald-950 text-sm">{downloadedFileName}</p>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-200 text-emerald-800">
                      {lang === 'vi' ? 'Đã tải về máy' : 'Downloaded'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {lang === 'vi' ? 'Tệp Excel đa trang tính: Tổng quan doanh thu · Chi tiết hợp đồng · Hiệu suất gian kho' : 'Excel file with 3 worksheets: Revenue Overview · Rentals · Unit Roster'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold"
                  onClick={() => {
                    exportRevenueExcel({
                      facilityName: revenueTab === 'All Facilities' || revenueTab === 'Toàn bộ cơ sở' ? 'Toàn bộ cơ sở' : revenueTab,
                      filterUnitType: 'Tất cả 4 loại kho',
                      period: 'Tháng 9/2026',
                      totalRevenue: 29340,
                      units: unitsList,
                      rentals: RENTALS
                    })
                  }}
                >
                  📥 {lang === 'vi' ? 'Tải lại file' : 'Re-download'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-600 text-xs"
                  onClick={() => setDownloadedFileName(null)}
                >
                  ✕
                </Button>
              </div>
            </div>
          )}

          <div className="mb-2">
            <Tabs tabs={lang === 'vi' ? ['Toàn bộ cơ sở'] : ['All Facilities']} active={lang === 'vi' ? 'Toàn bộ cơ sở' : revenueTab} onChange={setRevenueTab} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={lang === 'vi' ? 'Doanh thu năm' : 'YTD Revenue'} value={formatCurrency(192500)} icon={Icon.dollar} iconBg="bg-green-50" />
            <StatCard title={lang === 'vi' ? 'TB hàng tháng' : 'Avg Monthly'} value={formatCurrency(32080)} icon={Icon.chart} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Tháng đỉnh điểm' : 'Best Month'} value={formatCurrency(35200)} icon={Icon.check} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Dự báo quý tới' : 'Forecast'} value={formatCurrency(38000)} icon={Icon.refresh} iconBg="bg-amber-50" />
          </div>
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4">{lang === 'vi' ? 'Biểu Đồ Doanh Thu Toàn Hệ Thống' : 'Revenue by Facility'}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={REVENUE_TREND} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={((v: number) => [`$${v.toLocaleString()}`, lang === 'vi' ? 'Doanh thu' : 'Revenue']) as any} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#dbeafe" name={lang === 'vi' ? 'Doanh thu' : 'Revenue'} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Tháng' : 'Month'}</Th>
                  <Th>{lang === 'vi' ? 'Doanh Thu' : 'Revenue'}</Th>
                  <Th>{lang === 'vi' ? 'Tăng Trưởng' : 'Growth'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {REVENUE_TREND.map((r, i) => {
                  const total = r.revenue
                  const prev = i > 0 ? REVENUE_TREND[i - 1].revenue : total
                  const growth = i === 0 ? 0 : ((total - prev) / prev * 100)
                  return (
                    <Tr key={r.month}>
                      <Td className="font-medium">{r.month}</Td>
                      <Td className="font-bold">${total.toLocaleString()}</Td>
                      <Td>
                        {i === 0 ? '—' : <span className={growth >= 0 ? 'text-green-600' : 'text-red-500'}>{growth >= 0 ? '+' : ''}{growth.toFixed(1)}%</span>}
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── PERFORMANCE REPORTS ───────────────────────────────── */}
      {page === 'performance' && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={lang === 'vi' ? 'Báo Cáo Hiệu Suất Hoạt Động' : 'Performance Reports'}
            subtitle={lang === 'vi' ? 'Các chỉ số KPI vận hành trọng yếu trên toàn bộ hệ thống cơ sở' : 'Operational KPIs across all facilities'}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={lang === 'vi' ? 'Lấp đầy trung bình' : 'Avg Occupancy'} value="89.2%" icon={Icon.chart} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Tỷ lệ chuyển đổi' : 'Conversion Rate'} value="68.5%" icon={Icon.check} iconBg="bg-green-50" />
            <StatCard title={lang === 'vi' ? 'Thời gian thuê TB' : 'Avg Tenure'} value={lang === 'vi' ? '14.2 tháng' : '14.2 mo'} icon={Icon.calendar} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Tỷ lệ rời bỏ (Churn)' : 'Churn Rate'} value="3.8%" icon={Icon.refresh} iconBg="bg-amber-50" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">{lang === 'vi' ? 'Tỷ Lệ Chuyển Đổi Khách Thăm Kho' : 'Inquiry Conversion Rate'}</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={CONVERSION_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={((v: number) => [`${v}%`, lang === 'vi' ? 'Chuyển đổi' : 'Conversion']) as any} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">{lang === 'vi' ? 'Điểm Hiệu Suất Từng Cơ Sở' : 'Facility Performance Scores'}</h3>
              {FACILITIES.filter(f => f.status === 'active').map(f => (
                <div key={f.id} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{f.name}</span>
                    <span className="text-slate-800 font-semibold">{Math.round(f.occupied / f.units * 100)}%</span>
                  </div>
                  <ProgressBar value={f.occupied} max={f.units} color={f.occupied / f.units >= 0.85 ? 'bg-green-500' : 'bg-blue-500'} />
                </div>
              ))}
            </Card>
          </div>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Cơ Sở' : 'Facility'}</Th>
                  <Th>{lang === 'vi' ? 'Tỷ Lệ Lấp Đầy' : 'Occupancy'}</Th>
                  <Th>{lang === 'vi' ? 'Thời Hạn TB' : 'Avg Length'}</Th>
                  <Th>{lang === 'vi' ? 'Rời Bỏ' : 'Churn'}</Th>
                  <Th>{lang === 'vi' ? 'Độ Hài Lòng' : 'Satisfaction'}</Th>
                  <Th>{lang === 'vi' ? 'Doanh Thu/Gian' : 'Revenue/Unit'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {FACILITIES.filter(f => f.status === 'active').map(f => (
                  <Tr key={f.id}>
                    <Td className="font-medium">{f.name}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{Math.round(f.occupied / f.units * 100)}%</span>
                        <ProgressBar value={f.occupied} max={f.units} color="bg-blue-500" />
                      </div>
                    </Td>
                    <Td>{lang === 'vi' ? '14.2 tháng' : '14.2 mo'}</Td>
                    <Td>3.4%</Td>
                    <Td>
                      <div className="flex items-center gap-1 text-amber-500">★ 4.8</div>
                    </Td>
                    <Td className="font-semibold">${Math.round(f.revenue / f.occupied)}/{lang === 'vi' ? 'th' : 'mo'}</Td>
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
      <Modal open={pricingModal} onClose={() => setPricingModal(false)} title={lang === 'vi' ? 'Chỉnh Sửa Phân Tầng Giá' : 'Edit Pricing Tier'}>
        {selectedTier && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{lang === 'vi' ? 'Đang chỉnh sửa:' : 'Editing:'} <strong>{selectedTier.name}</strong> ({selectedTier.size})</p>
            <Input label={lang === 'vi' ? 'Giá cơ sở ($/tháng)' : 'Base Price ($/mo)'} type="number" defaultValue={selectedTier.basePrice.toString()} />
            <Input label={lang === 'vi' ? 'Phụ phí điều hòa ($/tháng)' : 'Climate Control Adder ($/mo)'} type="number" defaultValue={selectedTier.climateAdder.toString()} />
            <Input label={lang === 'vi' ? 'Hệ số cao điểm' : 'High Demand Multiplier'} type="number" defaultValue={selectedTier.highDemandMultiplier.toString()} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setPricingModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button variant="primary" onClick={() => { setPricingModal(false); showToast(lang === 'vi' ? 'Đã lưu phân tầng giá mới!' : 'Pricing tier updated!') }}>
                {lang === 'vi' ? 'Lưu bảng giá' : 'Save Pricing'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Enhanced New Promotion Modal */}
      <Modal open={discountModal} onClose={() => setDiscountModal(false)} title={lang === 'vi' ? 'Tạo Chiến Dịch Khuyến Mãi Mới' : 'Create Promotional Campaign'}>
        <div className="space-y-4">
          <Input
            label={lang === 'vi' ? 'Tên chiến dịch ưu đãi' : 'Promotion Campaign Name'}
            placeholder={lang === 'vi' ? 'Ví dụ: Tri ân khách hàng cuối năm' : 'e.g. End of Year Flash Sale'}
            value={newPromoName}
            onChange={e => setNewPromoName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">{lang === 'vi' ? 'Mã voucher' : 'Promo Code'}</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newPromoCode}
                  onChange={e => setNewPromoCode(e.target.value.toUpperCase())}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setNewPromoCode(`SAVE${Math.floor(10 + Math.random() * 40)}`)}
                >
                  {lang === 'vi' ? 'Tạo mã' : 'Gen'}
                </Button>
              </div>
            </div>

            <Select
              label={lang === 'vi' ? 'Loại hình ưu đãi' : 'Benefit Type'}
              value={newPromoType}
              onChange={e => setNewPromoType(e.target.value as any)}
            >
              <option value="percentage">{lang === 'vi' ? 'Giảm theo % (% OFF)' : 'Percentage Discount (% OFF)'}</option>
              <option value="fixed-amount">{lang === 'vi' ? 'Giảm số tiền cố định ($ OFF)' : 'Fixed Dollar Amount ($ OFF)'}</option>
              <option value="first-month-free">{lang === 'vi' ? 'Miễn phí 100% tháng đầu' : 'First Month 100% Free'}</option>
              <option value="seasonal">{lang === 'vi' ? 'Voucher ưu đãi mùa vụ' : 'Seasonal Flash Voucher'}</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'vi' ? 'Giá trị hiển thị' : 'Discount Value / Text'}
              placeholder={lang === 'vi' ? 'Ví dụ: GIẢM 20% hoặc GIẢM $30' : 'e.g. 20% OFF or $30 OFF'}
              value={newPromoValue}
              onChange={e => setNewPromoValue(e.target.value)}
            />
            <Input
              label={lang === 'vi' ? 'Hạn mức sử dụng tối đa' : 'Redemption Cap (Max uses)'}
              type="number"
              placeholder="50"
              value={newPromoMaxUses}
              onChange={e => setNewPromoMaxUses(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'vi' ? 'Hạn hợp đồng tối thiểu (tháng)' : 'Min Lease Commitment (Months)'}
              type="number"
              placeholder="3"
              value={newPromoMinMonths}
              onChange={e => setNewPromoMinMonths(e.target.value)}
            />
            <Input
              label={lang === 'vi' ? 'Ngày hết hạn' : 'Expiry Date'}
              type="date"
              value={newPromoExpiry}
              onChange={e => setNewPromoExpiry(e.target.value)}
            />
          </div>

          <Input
            label={lang === 'vi' ? 'Mô tả điều khoản chiến dịch' : 'Campaign Description'}
            placeholder={lang === 'vi' ? 'Ví dụ: Áp dụng cho hợp đồng từ 3 tháng trở lên trên tất cả gian kho 10ft' : 'Brief terms for customers (e.g. Valid on all 10ft units with 3-month min lease)'}
            value={newPromoDesc}
            onChange={e => setNewPromoDesc(e.target.value)}
          />

          <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
            <Button variant="outline" onClick={() => setDiscountModal(false)}>
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              disabled={!newPromoName.trim() || !newPromoCode.trim()}
              onClick={() => {
                const newPromo: PromotionItem = {
                  id: `DSC-${Date.now().toString().slice(-4)}`,
                  code: newPromoCode.trim().toUpperCase(),
                  name: newPromoName.trim(),
                  description: newPromoDesc.trim() || `${newPromoValue} off eligible storage units.`,
                  value: newPromoValue.trim(),
                  discount: newPromoValue.trim(),
                  type: newPromoType,
                  typeLabel: newPromoType === 'percentage' ? (lang === 'vi' ? 'Giảm %' : 'Percentage Off') : newPromoType === 'first-month-free' ? (lang === 'vi' ? 'Miễn tháng đầu' : 'Free Month') : newPromoType === 'fixed-amount' ? (lang === 'vi' ? 'Giảm tiền' : 'Fixed Amount') : (lang === 'vi' ? 'Mùa vụ' : 'Seasonal'),
                  active: true,
                  status: 'active',
                  uses: 0,
                  maxUses: Number(newPromoMaxUses) || 50,
                  minLeaseMonths: Number(newPromoMinMonths) || 1,
                  applicableFacility: 'All facilities',
                  applicableUnitType: 'All Sizes',
                  startDate: 'Sep 18, 2026',
                  expires: newPromoExpiry || 'Dec 31, 2026'
                }
                setPromotionsList([newPromo, ...promotionsList])
                setDiscountModal(false)
                setNewPromoName('')
                setNewPromoDesc('')
                showToast(lang === 'vi' ? `Chiến dịch "${newPromo.code}" đã được kích hoạt thành công!` : `Promotion "${newPromo.code}" published successfully!`)
              }}
            >
              {lang === 'vi' ? 'Phát hành chiến dịch' : 'Publish Campaign'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={policyModal} onClose={() => setPolicyModal(false)} title={lang === 'vi' ? 'Chỉnh Sửa Chính Sách Thương Mại' : 'Edit Policy'}>
        {selectedPolicy && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 font-medium">{selectedPolicy.name}</p>
            <Input label={lang === 'vi' ? 'Giá trị hiện hành' : 'Current Value'} defaultValue={selectedPolicy.value} />
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">{lang === 'vi' ? 'Căn cứ / Ghi chú điều chỉnh' : 'Justification / Notes'}</label>
              <textarea rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" placeholder={lang === 'vi' ? 'Lý do thay đổi chính sách...' : 'Reason for policy change...'} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPolicyModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button variant="primary" onClick={() => { setPolicyModal(false); showToast(lang === 'vi' ? 'Chính sách thương mại đã được cập nhật!' : 'Commercial policy updated!') }}>
                {lang === 'vi' ? 'Cập nhật chính sách' : 'Update Policy'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 1: THÊM MỚI GIAN KHO (CREATE) ──────────────── */}
      <Modal open={createUnitModal} onClose={() => setCreateUnitModal(false)} title={lang === 'vi' ? 'Thêm Gian Kho Mới' : 'Create New Storage Unit'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'vi' ? 'Mã gian kho (chuẩn HCM-Q1-F01 / BD-F01)' : 'Unit Code'}
              placeholder="VD: HCM-Q1-F01-S-006..."
              value={formCode}
              onChange={e => setFormCode(e.target.value.toUpperCase())}
            />
            <Select
              label={lang === 'vi' ? 'Cơ sở quản lý' : 'Facility'}
              value={formFacilityId}
              onChange={e => {
                const newFac = e.target.value
                setFormFacilityId(newFac)
                setFormCode(generateUnitCode(newFac, formSize, unitsList))
              }}
            >
              <option value="HCM-Q1-F01">HCM-Q1-F01 – Kho Việt – Cơ sở Quận 1 (TP.HCM)</option>
              <option value="BD-F01">BD-F01 – Kho Việt – Cơ sở Bình Dương</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={lang === 'vi' ? 'Kích thước & Phân loại kho (S / M / L / XL)' : 'Unit Size & Tier'}
              value={formSize}
              onChange={e => {
                const newSize = e.target.value as 'S' | 'M' | 'L' | 'XL'
                handleSizeChange(newSize)
                setFormCode(generateUnitCode(formFacilityId, newSize, unitsList))
              }}
            >
              <option value="S">Kho Nhỏ (S) · 5,6 × 6,0 × 3,2 m · 107,52 m³</option>
              <option value="M">Kho Trung (M) · 9,0 × 6,4 × 3,4 m · 195,84 m³</option>
              <option value="L">Kho Lớn (L) · 13,5 × 6,8 × 3,6 m · 330,48 m³</option>
              <option value="XL">Kho Rất Lớn (XL) · 19,0 × 7,2 × 4,0 m · 547,20 m³</option>
            </Select>

            <Input
              label={lang === 'vi' ? 'Đơn giá thuê / tháng (VNĐ)' : 'Monthly Price (VNĐ)'}
              type="number"
              value={formPrice}
              onChange={e => setFormPrice(Number(e.target.value))}
            />
          </div>

          {/* Thông số kỹ thuật tự động điền */}
          {(() => {
            const spec = UNIT_SPECS[formSize] || UNIT_SPECS.S
            return (
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">Kích thước D×R×C:</span>
                  <span className="font-bold text-slate-900">{spec.dimensions}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">Thể tích lưu trữ:</span>
                  <span className="font-bold text-slate-900">{spec.volumeM3} m³</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">Độ rộng lối đi xe:</span>
                  <span className="font-bold text-slate-900">{spec.aisleM} m</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">Sức chứa tối đa:</span>
                  <span className="font-bold text-slate-900">{spec.smallBoxes} thùng nhỏ · {spec.largeBoxes} thùng to</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">Thiết bị xe đẩy hỗ trợ:</span>
                  <span className="font-semibold text-emerald-800">{spec.cartEquipment}</span>
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'vi' ? 'Tầng' : 'Floor'}
              type="number"
              value={formFloor}
              onChange={e => setFormFloor(Number(e.target.value))}
            />
            <Input
              label={lang === 'vi' ? 'Phân khu' : 'Zone'}
              value={formZone}
              onChange={e => setFormZone(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={formClimate}
                onChange={e => setFormClimate(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="font-medium text-slate-700">{lang === 'vi' ? 'Kho có máy lạnh điều hòa nhiệt độ 24/7' : 'Climate Controlled'}</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateUnitModal(false)}>
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              disabled={!formCode.trim()}
              onClick={handleCreateUnit}
            >
              {lang === 'vi' ? 'Lưu Gian Kho' : 'Save Unit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 2: CHỈNH SỬA GIAN KHO (UPDATE) ─────────────── */}
      <Modal open={editUnitModal} onClose={() => setEditUnitModal(false)} title={lang === 'vi' ? 'Chỉnh Sửa Gian Kho' : 'Edit Storage Unit'}>
        {selectedUnit && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã gian kho:</span>
                <b className="font-mono text-slate-900 text-sm">{selectedUnit.code || selectedUnit.id}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cơ sở:</span>
                <b className="text-slate-800">{selectedUnit.facilityName || selectedUnit.facility}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phân loại & Kích thước:</span>
                <b className="text-slate-800">
                  Size {selectedUnit.size || 'S'} · {UNIT_SPECS[(selectedUnit.size as 'S' | 'M' | 'L' | 'XL')]?.dimensions || '5,6 × 6,0 × 3,2 m'}
                </b>
              </div>
            </div>
            <Input
              label={lang === 'vi' ? 'Đơn giá thuê / tháng (VNĐ)' : 'Monthly Price (VNĐ)'}
              type="number"
              value={formPrice}
              onChange={e => setFormPrice(Number(e.target.value))}
            />
            <Select
              label={lang === 'vi' ? 'Trạng thái gian kho' : 'Unit Status'}
              value={formStatus}
              onChange={e => setFormStatus(e.target.value as any)}
            >
              <option value="available">{lang === 'vi' ? 'Còn trống (Available)' : 'Available'}</option>
              <option value="occupied">{lang === 'vi' ? 'Đang có khách thuê (Occupied)' : 'Occupied'}</option>
              <option value="reserved">{lang === 'vi' ? 'Đã đặt trước (Reserved)' : 'Reserved'}</option>
              <option value="maintenance">{lang === 'vi' ? 'Bảo trì / Sửa chữa (Maintenance)' : 'Maintenance'}</option>
            </Select>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setEditUnitModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateUnit}
              >
                {lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODALS QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ─────────── */}
      {/* 1. Modal Thêm Mới Cơ Sở */}
      <Modal open={createFacilityModal} onClose={() => setCreateFacilityModal(false)} title={lang === 'vi' ? 'Thêm Cơ Sở Mới' : 'Create New Facility'}>
        <div className="space-y-4">
          <Input
            label={lang === 'vi' ? 'Tên cơ sở' : 'Facility Name'}
            placeholder="VD: Landmark Storage, Eastside Hub..."
            value={formFacName}
            onChange={e => setFormFacName(e.target.value)}
          />
          <Input
            label={lang === 'vi' ? 'Địa chỉ chi tiết' : 'Street Address'}
            placeholder="VD: 125 Nguyễn Huệ, Phường Bến Nghé, Quận 1"
            value={formFacAddress}
            onChange={e => setFormFacAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'vi' ? 'Thành phố' : 'City'}
              value={formFacCity}
              onChange={e => setFormFacCity(e.target.value)}
            />
            <Input
              label={lang === 'vi' ? 'Người quản lý cơ sở' : 'Facility Manager'}
              placeholder="VD: Mai Tran, Nguyen Van A..."
              value={formFacManager}
              onChange={e => setFormFacManager(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'vi' ? 'Tổng số gian kho' : 'Total Units'}
              type="number"
              value={formFacUnits}
              onChange={e => setFormFacUnits(Number(e.target.value))}
            />
            <Input
              label={lang === 'vi' ? 'Giá cơ sở từ ($/tháng)' : 'Starting Price'}
              placeholder="$89"
              value={formFacPrice}
              onChange={e => setFormFacPrice(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Select
              label={lang === 'vi' ? 'Trạng thái hoạt động' : 'Status'}
              value={formFacStatus}
              onChange={e => setFormFacStatus(e.target.value as any)}
            >
              <option value="active">{lang === 'vi' ? 'Đang hoạt động' : 'Active'}</option>
              <option value="maintenance">{lang === 'vi' ? 'Bảo trì / Sắp khai trương' : 'Maintenance'}</option>
            </Select>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formFacClimate}
                  onChange={e => setFormFacClimate(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>{lang === 'vi' ? 'Hệ thống điều hòa 24/7' : 'Climate Controlled'}</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateFacilityModal(false)}>
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button variant="primary" disabled={!formFacName.trim()} onClick={handleCreateFacility}>
              {lang === 'vi' ? 'Lưu Cơ Sở' : 'Save Facility'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Modal Chỉnh Sửa Cơ Sở */}
      <Modal open={editFacilityModal} onClose={() => setEditFacilityModal(false)} title={lang === 'vi' ? 'Chỉnh Sửa Cơ Sở' : 'Edit Facility'}>
        {selectedFacility && (
          <div className="space-y-4">
            <Input
              label={lang === 'vi' ? 'Tên cơ sở' : 'Facility Name'}
              value={formFacName}
              onChange={e => setFormFacName(e.target.value)}
            />
            <Input
              label={lang === 'vi' ? 'Địa chỉ' : 'Address'}
              value={formFacAddress}
              onChange={e => setFormFacAddress(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={lang === 'vi' ? 'Thành phố' : 'City'}
                value={formFacCity}
                onChange={e => setFormFacCity(e.target.value)}
              />
              <Input
                label={lang === 'vi' ? 'Người quản lý' : 'Manager'}
                value={formFacManager}
                onChange={e => setFormFacManager(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={lang === 'vi' ? 'Tổng số kho' : 'Total Units'}
                type="number"
                value={formFacUnits}
                onChange={e => setFormFacUnits(Number(e.target.value))}
              />
              <Input
                label={lang === 'vi' ? 'Giá cơ sở' : 'Starting Price'}
                value={formFacPrice}
                onChange={e => setFormFacPrice(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Select
                label={lang === 'vi' ? 'Trạng thái' : 'Status'}
                value={formFacStatus}
                onChange={e => setFormFacStatus(e.target.value as any)}
              >
                <option value="active">{lang === 'vi' ? 'Đang hoạt động' : 'Active'}</option>
                <option value="maintenance">{lang === 'vi' ? 'Bảo trì' : 'Maintenance'}</option>
              </Select>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formFacClimate}
                    onChange={e => setFormFacClimate(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>{lang === 'vi' ? 'Máy lạnh 24/7' : 'Climate Controlled'}</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setEditFacilityModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button variant="primary" onClick={handleUpdateFacility}>
                {lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Modal Xác Nhận Xóa Cơ Sở Có Kiểm Tra An Toàn */}
      <Modal open={deleteFacilityModal} onClose={() => setDeleteFacilityModal(false)} title={lang === 'vi' ? 'Xác Nhận Xóa Cơ Sở' : 'Confirm Delete Facility'}>
        {selectedFacility && (
          <div className="space-y-4">
            {selectedFacility.occupied > 0 ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-lg text-sm">
                <b>CẢNH BÁO:</b> Cơ sở <b>{selectedFacility.name}</b> hiện đang có <b>{selectedFacility.occupied} gian kho có khách thuê hoạt động</b>! Hệ thống từ chối xóa để bảo vệ an toàn cho hợp đồng khách hàng.
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa cơ sở <b className="text-slate-900">{selectedFacility.name}</b> ({selectedFacility.address}) khỏi danh mục hệ thống không?
              </p>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setDeleteFacilityModal(false)}>
                {lang === 'vi' ? 'Đóng' : 'Cancel'}
              </Button>
              {selectedFacility.occupied === 0 && (
                <Button
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDeleteFacility}
                >
                  {lang === 'vi' ? 'Xác Nhận Xóa' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 4. Modal Chi Tiết Cơ Sở */}
      <Modal open={viewFacilityModal} onClose={() => setViewFacilityModal(false)} title={lang === 'vi' ? 'Thông Tin Chi Tiết Cơ Sở' : 'Facility Details'}>
        {selectedFacility && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedFacility.name}</h3>
                <p className="text-xs text-slate-500">{selectedFacility.address} · {selectedFacility.city}</p>
              </div>
              <Badge variant={selectedFacility.status === 'active' ? 'success' : 'warning'}>
                {selectedFacility.status === 'active' ? 'Đang hoạt động' : 'Bảo trì'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-400 block">Người quản lý:</span>
                <span className="font-semibold text-slate-800">{selectedFacility.manager}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-400 block">Số lượng gian kho:</span>
                <span className="font-semibold text-slate-800">{selectedFacility.occupied || 0} / {selectedFacility.units} kho</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-400 block">Cước thuê cơ sở từ:</span>
                <span className="font-semibold text-emerald-700">{selectedFacility.price}/tháng</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-400 block">Tiện ích an ninh & kho:</span>
                <span className="font-semibold text-slate-800">{selectedFacility.climate ? 'Máy lạnh 24/7 · Camera' : 'Camera an ninh'}</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setViewFacilityModal(false)}>
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
