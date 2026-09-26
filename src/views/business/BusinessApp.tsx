import { useState, useMemo } from 'react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, ProgressBar, Input, Select } from '../../components/ui'
import type { User } from '../../types'
import { FACILITIES, UNIT_SPECS, REVENUE_DATA, REVENUE_BREAKDOWN, CONVERSION_DATA, PRICING_TIERS, DISCOUNTS, POLICIES, FEES, type PromotionItem } from "../../data/demoDatabase"
import { formatVnd } from '../../i18n/currency'
import { exportRevenueExcel } from '../../utils/excelExport'
import { useStorageHub } from '../../store/StorageHubContext'
import ProfileView from '../ProfileView'

export interface PolicyItem {
  id: string
  name: string
  value: string
  scope: string
  editable: boolean
  description?: string
  lastUpdated?: string
}

export default function BusinessApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const hub = useStorageHub()
  const {
    facilities: facilitiesList,
    units: unitsList,
    createFacility,
    updateFacility,
    deleteFacility,
    createUnit,
    updateUnit,
    deleteUnit
  } = hub
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

  const [policiesList, setPoliciesList] = useState<PolicyItem[]>(() => {
    try {
      const stored = localStorage.getItem('storagehub:policies')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // fallback
    }
    return POLICIES.map(p => ({ ...p, description: '' }))
  })

  const [policyModal, setPolicyModal] = useState(false)
  const [createPolicyModal, setCreatePolicyModal] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null)
  const [policyFormName, setPolicyFormName] = useState('')
  const [policyFormValue, setPolicyFormValue] = useState('')
  const [policyFormScope, setPolicyFormScope] = useState('Toàn bộ cơ sở')
  const [policyFormDesc, setPolicyFormDesc] = useState('')

  const savePolicies = (next: PolicyItem[]) => {
    setPoliciesList(next)
    localStorage.setItem('storagehub:policies', JSON.stringify(next))
  }

  const handleOpenCreatePolicy = () => {
    setPolicyFormName('')
    setPolicyFormValue('')
    setPolicyFormScope(lang === 'vi' ? 'Toàn bộ cơ sở' : 'All Facilities')
    setPolicyFormDesc('')
    setCreatePolicyModal(true)
  }

  const handleSaveNewPolicy = () => {
    if (!policyFormName.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập tên chính sách!' : 'Please enter policy name!')
      return
    }
    if (!policyFormValue.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập giá trị áp dụng!' : 'Please enter policy value!')
      return
    }
    const newPolicy: PolicyItem = {
      id: `pol-${Date.now()}`,
      name: policyFormName.trim(),
      value: policyFormValue.trim(),
      scope: policyFormScope || (lang === 'vi' ? 'Toàn bộ cơ sở' : 'All Facilities'),
      editable: true,
      description: policyFormDesc.trim(),
      lastUpdated: new Date().toLocaleDateString('vi-VN')
    }
    const next = [...policiesList, newPolicy]
    savePolicies(next)
    setCreatePolicyModal(false)
    showToast(lang === 'vi' ? `Đã thêm chính sách "${newPolicy.name}" thành công!` : `Policy added successfully!`)
  }

  const handleOpenEditPolicy = (policy: PolicyItem) => {
    setSelectedPolicy(policy)
    setPolicyFormName(policy.name)
    setPolicyFormValue(policy.value)
    setPolicyFormScope(policy.scope)
    setPolicyFormDesc(policy.description || '')
    setPolicyModal(true)
  }

  const handleUpdatePolicy = () => {
    if (!selectedPolicy) return
    if (!policyFormValue.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập giá trị áp dụng!' : 'Please enter policy value!')
      return
    }
    const next = policiesList.map(p => p.id === selectedPolicy.id ? {
      ...p,
      name: policyFormName.trim() || p.name,
      value: policyFormValue.trim(),
      scope: policyFormScope || p.scope,
      description: policyFormDesc.trim(),
      lastUpdated: new Date().toLocaleDateString('vi-VN')
    } : p)
    savePolicies(next)
    setPolicyModal(false)
    showToast(lang === 'vi' ? 'Cập nhật chính sách thành công!' : 'Policy updated successfully!')
  }

  const handleDeletePolicy = (policyId: string) => {
    const target = policiesList.find(p => p.id === policyId)
    if (!target) return
    if (window.confirm(lang === 'vi' ? `Bạn có chắc chắn muốn xóa chính sách "${target.name}"?` : `Delete policy "${target.name}"?`)) {
      const next = policiesList.filter(p => p.id !== policyId)
      savePolicies(next)
      showToast(lang === 'vi' ? `Đã xóa chính sách "${target.name}"!` : `Policy deleted!`)
    }
  }

  const [revenueFacilityFilter, setRevenueFacilityFilter] = useState('Toàn bộ cơ sở')
  // Dynamic ratio for any facility (existing ones or newly created: Đà Nẵng, Quy Nhơn...)
  const activeRevenueData = useMemo(() => {
    if (revenueFacilityFilter === 'Toàn bộ cơ sở') return REVENUE_DATA

    const targetFac = facilitiesList.find(f => f.name === revenueFacilityFilter || f.id === revenueFacilityFilter)
    let ratio = 0.5
    if (targetFac) {
      const totalUnitsAll = facilitiesList.reduce((s, f) => s + (f.units || 20), 0) || 1
      const facUnits = targetFac.units || 20
      ratio = Math.min(0.9, Math.max(0.15, facUnits / totalUnitsAll))
    } else if (revenueFacilityFilter.includes('Quận 1') || revenueFacilityFilter.includes('Q1')) {
      ratio = 0.58
    } else if (revenueFacilityFilter.includes('Bình Dương')) {
      ratio = 0.42
    }

    return REVENUE_DATA.map(item => ({
      ...item,
      revenue: Math.round(item.revenue * ratio),
      contracts: Math.max(1, Math.round(item.contracts * ratio))
    }))
  }, [revenueFacilityFilter, facilitiesList])

  const currentTotalRevenue = activeRevenueData.reduce((s, i) => s + i.revenue, 0)
  const currentAvgRevenue = Math.round(currentTotalRevenue / (activeRevenueData.length || 1))
  const currentHighestItem = [...activeRevenueData].sort((a, b) => b.revenue - a.revenue)[0] || { month: 'Tháng 9', revenue: 18450000 }
  const currentForecast = revenueFacilityFilter === 'Toàn bộ cơ sở' ? '~19.000.000 ₫' : `~${Math.round(currentHighestItem.revenue * 1.03).toLocaleString('vi-VN')} ₫`

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

  // ── State Quản Lý Cơ Sở (CRUD Facilities qua StorageHubContext) ──
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
  const [formFacPrice, setFormFacPrice] = useState<string>('5.500.000 ₫')
  const [formFacStatus, setFormFacStatus] = useState<'active' | 'maintenance'>('active')

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleCreateFacility = () => {
    if (!formFacName.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập tên cơ sở!' : 'Please enter facility name!')
      return
    }
    const created = createFacility({
      name: formFacName.trim(),
      address: formFacAddress.trim() || 'TP. Hồ Chí Minh',
      city: formFacCity.trim(),
      manager: formFacManager.trim() || 'Quản lý cơ sở',
      units: Number(formFacUnits) || 20,
      price: formFacPrice || '5.500.000 ₫',
      climate: false,
      status: formFacStatus,
      security: '24/7'
    }, user)
    setCreateFacilityModal(false)
    showToast(lang === 'vi' ? `Đã thêm cơ sở "${created.name}" thành công!` : `Facility "${created.name}" created!`)
  }

  const handleUpdateFacility = () => {
    if (!selectedFacility) return
    updateFacility(selectedFacility.id, {
      name: formFacName.trim(),
      address: formFacAddress.trim(),
      city: formFacCity.trim(),
      manager: formFacManager.trim(),
      units: Number(formFacUnits) || selectedFacility.units,
      price: formFacPrice,
      climate: false,
      status: formFacStatus
    }, user)
    setEditFacilityModal(false)
    showToast(lang === 'vi' ? `Đã cập nhật cơ sở "${formFacName}"!` : `Facility updated!`)
  }

  const handleDeleteFacility = () => {
    if (!selectedFacility) return
    const result = deleteFacility(selectedFacility.id, user)
    if (!result.success) {
      showToast(lang === 'vi' ? (result.reason || 'Không thể xóa cơ sở!') : (result.reason || 'Cannot delete facility!'))
      return
    }
    setDeleteFacilityModal(false)
    showToast(lang === 'vi' ? `Đã xóa cơ sở "${selectedFacility.name}"!` : `Facility deleted!`)
  }

  // ── Helper sinh mã kho chuẩn: <MÃ_CƠ_SỞ>-<SIZE>-001 ──
  const generateUnitCode = (facilityId: string, sizeCode: 'S' | 'M' | 'L' | 'XL', existingUnits: any[]) => {
    const targetFac = facilitiesList.find(f => f.id === facilityId || f.code === facilityId)
    const facCode = targetFac?.code || (facilityId.startsWith('fac-') ? (facilityId === 'fac-001' ? 'HCM-Q1-F01' : facilityId === 'fac-002' ? 'BD-F01' : (targetFac?.name ? targetFac.name.slice(0, 8).toUpperCase() : 'FAC')) : facilityId)
    const prefix = `${facCode}-${sizeCode}-`

    const existingNums = existingUnits
      .map(u => (u.code || u.id || ''))
      .filter(c => c.startsWith(prefix))
      .map(c => parseInt(c.slice(prefix.length), 10))
      .filter(n => !isNaN(n))

    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1
    return `${prefix}${String(nextNum).padStart(3, '0')}`
  }

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
  const [formFacilityId, setFormFacilityId] = useState<string>('fac-001')
  const [formSize, setFormSize] = useState<'S' | 'M' | 'L' | 'XL'>('S')
  const [formSizeInput, setFormSizeInput] = useState<string>('Kho Nhỏ (S)')
  const [formDimensions, setFormDimensions] = useState<string>('5,6 × 6,0 × 3,2 m')
  const [formVolumeM3, setFormVolumeM3] = useState<number>(107.52)
  const [formAisleM, setFormAisleM] = useState<number>(1.8)
  const [formCapacity, setFormCapacity] = useState<string>('384 thùng nhỏ · 160 thùng to')
  const [formEquipment, setFormEquipment] = useState<string>('Xe đẩy tay / xe sàn nhỏ')
  const [formFloor, setFormFloor] = useState<number>(1)
  const [formZone, setFormZone] = useState<string>('Khu A')
  const [formPrice, setFormPrice] = useState<number>(5500000)
  const [formStatus, setFormStatus] = useState<'available' | 'maintenance'>('available')

  const handleSizeChange = (size: 'S' | 'M' | 'L' | 'XL') => {
    setFormSize(size)
    const spec = UNIT_SPECS[size]
    setFormSizeInput(spec.name)
    setFormDimensions(spec.dimensions)
    setFormVolumeM3(spec.volumeM3)
    setFormAisleM(spec.aisleM)
    setFormCapacity(`${spec.smallBoxes} thùng nhỏ · ${spec.largeBoxes} thùng to`)
    setFormEquipment(spec.cartEquipment)
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

    const targetFac = facilitiesList.find(f => f.id === formFacilityId || f.code === formFacilityId)
    const facName = targetFac ? targetFac.name : 'Kho Việt'

    const nums = formDimensions.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)/g)
    const lengthM = nums && nums[0] ? parseFloat(nums[0]) : (formSize === 'S' ? 5.6 : formSize === 'M' ? 9.0 : formSize === 'L' ? 13.5 : 19.0)
    const widthM = nums && nums[1] ? parseFloat(nums[1]) : (formSize === 'S' ? 6.0 : formSize === 'M' ? 6.4 : formSize === 'L' ? 6.8 : 7.2)
    const heightM = nums && nums[2] ? parseFloat(nums[2]) : (formSize === 'S' ? 3.2 : formSize === 'M' ? 3.4 : formSize === 'L' ? 3.6 : 4.0)
    const volumeM3 = Number(formVolumeM3) || Math.round(lengthM * widthM * heightM * 100) / 100

    createUnit({
      id: code,
      code,
      facilityId: targetFac ? targetFac.id : formFacilityId,
      facilityName: facName,
      type: formSize === 'S' || formSizeInput.includes('(S)') ? 'Small' :
            formSize === 'M' || formSizeInput.includes('(M)') ? 'Medium' :
            formSize === 'L' || formSizeInput.includes('(L)') ? 'Large' : 'Extra Large',
      floor: Number(formFloor) || 1,
      zone: formZone,
      price: Number(formPrice),
      deposit: Number(formPrice),
      climate: false,
      status: formStatus,
      dimensions: { lengthM, widthM, heightM },
      volumeM3
    }, user)

    setCreateUnitModal(false)
    showToast(lang === 'vi' ? `Đã thêm gian kho ${code} thành công!` : `Unit ${code} created successfully!`)
  }

  const handleUpdateUnit = () => {
    if (!selectedUnit) return
    updateUnit(selectedUnit.id, {
      price: Number(formPrice),
      status: formStatus
    }, user)
    setEditUnitModal(false)
    showToast(lang === 'vi' ? `Đã cập nhật gian kho ${selectedUnit.code || selectedUnit.id}!` : `Unit updated!`)
  }

  const handleDeleteUnit = () => {
    if (!selectedUnit) return
    const result = deleteUnit(selectedUnit.id, user)
    if (!result.success) {
      showToast(lang === 'vi' ? (result.reason || 'Không thể xóa kho!') : (result.reason || 'Cannot delete unit!'))
      return
    }
    setDeleteConfirmModal(false)
    showToast(lang === 'vi' ? `Đã xóa gian kho ${selectedUnit.code || selectedUnit.id}!` : `Unit deleted!`)
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
                  setFormFacCity('TP. Hồ Chí Minh')
                  setFormFacManager('')
                  setFormFacUnits(100)
                  setFormFacPrice('5.500.000 ₫')
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
          if (unitFilterFacility !== 'All') {
            const fac = facilitiesList.find(f => f.id === unitFilterFacility || f.code === unitFilterFacility)
            const matchesId = u.facilityId === unitFilterFacility || (fac && u.facilityId === fac.id) || (fac?.code && u.facilityId === fac.code)
            const matchesName = fac && (u.facilityName === fac.name || (u as any).facility === fac.name)
            if (!matchesId && !matchesName) return false
          }
          if (unitFilterType !== 'All') {
            const size = (u as any).size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : 'XL')
            if (size !== unitFilterType && u.type !== unitFilterType) return false
          }
          if (unitFilterStatus !== 'All' && u.status !== unitFilterStatus) return false
          if (unitSearch.trim()) {
            const q = unitSearch.toLowerCase()
            return (u.code || u.id).toLowerCase().includes(q) || (u.zone || '').toLowerCase().includes(q) || (u.facilityName || (u as any).facility || '').toLowerCase().includes(q)
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
              subtitle={lang === 'vi' ? `${unitsList.length} gian kho phân bổ trên ${facilitiesList.length} cơ sở theo 4 phân loại S, M, L, XL` : `${unitsList.length} standardized units across ${facilitiesList.length} facilities in 4 size tiers`}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const defaultFac = facilitiesList[0]?.id || 'fac-001'
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
                            <span className={`inline-block px-2.5 py-0.5 rounded font-mono text-xs font-bold ${s === 'S' ? 'bg-blue-100 text-blue-800' :
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{lang === 'vi' ? `Cơ sở (${facilitiesList.length} cơ sở)` : 'Facility'}</label>
                  <Select value={unitFilterFacility} onChange={e => setUnitFilterFacility(e.target.value)}>
                    <option value="All">{lang === 'vi' ? `Tất cả cơ sở (${facilitiesList.length} cơ sở)` : 'All Facilities'}</option>
                    {facilitiesList.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.code ? `${f.code} – ` : ''}{f.name}
                      </option>
                    ))}
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
                    <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
                    <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filtered.length === 0 ? (
                    <Tr>
                      <Td colSpan={8} className="text-center py-8 text-slate-400">
                        {lang === 'vi' ? 'Không tìm thấy gian kho phù hợp với bộ lọc.' : 'No units matching your filter criteria.'}
                      </Td>
                    </Tr>
                  ) : (
                    filtered.map(u => {
                      const sizeCode: 'S' | 'M' | 'L' | 'XL' =
                        u.type === 'Small' || u.code.includes('-S-') ? 'S' :
                        u.type === 'Large' || u.code.includes('-L-') ? 'L' :
                        u.type === 'Extra Large' || u.code.includes('-XL-') ? 'XL' : 'M'
                      const spec = UNIT_SPECS[sizeCode] || UNIT_SPECS.S
                      const sizeBadgeColor =
                        sizeCode === 'S' ? 'bg-blue-100 text-blue-800' :
                        sizeCode === 'M' ? 'bg-green-100 text-green-800' :
                        sizeCode === 'L' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-900'

                      return (
                        <Tr key={u.id}>
                          <Td className="font-mono font-bold text-slate-900 whitespace-nowrap">{u.code || u.id}</Td>
                          <Td>
                            <span className="font-semibold text-slate-800 block">{u.facilityName || (u as any).facility}</span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                              {facilitiesList.find(f => f.id === u.facilityId || f.code === u.facilityId)?.address || ((u.facilityName || (u as any).facility || '').includes('Quận 1') || (u.code || '').startsWith('HCM')
                                ? '125 Nguyễn Bỉnh Khiêm, Q1, TP.HCM'
                                : '468 Đại lộ Bình Dương, Lái Thiêu')}
                            </span>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${sizeBadgeColor}`}>
                                {sizeCode}
                              </span>
                              <span className="font-semibold text-slate-800 text-xs">
                                {sizeCode === 'S' ? 'Kho Nhỏ' :
                                  sizeCode === 'M' ? 'Kho Trung' :
                                    sizeCode === 'L' ? 'Kho Lớn' : 'Kho Rất Lớn'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-medium">
                              {u.dimensions ? (typeof u.dimensions === 'string' ? u.dimensions : `${(u.dimensions as any).lengthM || 0} × ${(u.dimensions as any).widthM || 0} × ${(u.dimensions as any).heightM || 0} m`) : spec.dimensions} · {u.volumeM3 ? `${u.volumeM3} m³` : `${spec.volumeM3} m³`}
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
                            {formatCurrency(u.price)}/tháng
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
                                setFormPrice(u.price < 10000 ? Math.round(u.price * 26000) : u.price)
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
            action={<Button variant="primary" size="sm" onClick={handleOpenCreatePolicy}>{Icon.plus} {lang === 'vi' ? 'Thêm Chính Sách' : 'Add Policy'}</Button>}
          />
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Tên Chính Sách' : 'Policy Name'}</Th>
                  <Th>{lang === 'vi' ? 'Giá Trị Áp Dụng' : 'Current Value'}</Th>
                  <Th>{lang === 'vi' ? 'Phạm Vi' : 'Scope'}</Th>
                  <Th>{lang === 'vi' ? 'Ghi Chú / Căn Cứ' : 'Notes / Justification'}</Th>
                  <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {policiesList.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8 text-slate-400">
                      {lang === 'vi' ? 'Chưa có chính sách nào. Hãy bấm "Thêm Chính Sách" để bắt đầu.' : 'No policies found.'}
                    </Td>
                  </Tr>
                ) : (
                  policiesList.map(p => {
                    const displayName = lang === 'vi' ? (
                      p.name === 'Grace Period' ? 'Thời gian gia hạn nợ' :
                        p.name === 'Late Fee' ? 'Mức phí phạt trễ hạn' :
                          p.name === 'Security Deposit' ? 'Tiền đặt cọc an ninh' :
                            p.name === 'Notice to Vacate' ? 'Thời hạn báo trước khi trả phòng' :
                              p.name === 'Minimum Lease' ? 'Thời hạn thuê tối thiểu' : p.name
                    ) : p.name

                    const displayValue = lang === 'vi' ? (
                      p.value.includes('days') ? p.value.replace('days', 'ngày') :
                        p.value.includes('month')
                          ? p.value.replace('$25', '650.000 ₫').replace('month', 'tháng')
                          : (p.value ?? '—')
                    ) : (p.value ?? '—')

                    return (
                      <Tr key={p.id}>
                        <Td className="font-medium text-slate-800">
                          <div>
                            <span className="font-semibold text-slate-900 block">{displayName}</span>
                            {p.lastUpdated && <span className="text-[10px] text-slate-400">Cập nhật: {p.lastUpdated}</span>}
                          </div>
                        </Td>

                        <Td>
                          <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-xs">
                            {displayValue}
                          </span>
                        </Td>

                        <Td><Badge variant="muted">{lang === 'vi' ? (p.scope === 'All Facilities' ? 'Toàn bộ cơ sở' : p.scope) : p.scope}</Badge></Td>
                        <Td className="text-xs text-slate-500 max-w-[250px] truncate">{p.description || '—'}</Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEditPolicy(p)}>
                              {lang === 'vi' ? 'Sửa' : 'Edit'}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDeletePolicy(p.id)}>
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
                        facilityName: revenueFacilityFilter,
                        revenueData: activeRevenueData
                      })
                      setDownloadedFileName(fileName)
                      showToast(`Đã xuất báo cáo Excel: ${fileName}`)
                    } catch (err) {
                      showToast('Lỗi khi xuất file Excel!')
                    } finally {
                      setDownloadingExcel(false)
                    }
                  }, 350)
                }}
              >
                <span>{downloadingExcel ? '⏳' : '📥'}</span>
                <span>{downloadingExcel ? 'Đang tạo file...' : 'Xuất Báo Cáo Excel (.xlsx)'}</span>
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
                    <p className="font-bold text-emerald-950 text-sm">{downloadedFileName}</p>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-200 text-emerald-800">
                      Đã tải về máy (.xlsx)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Tệp Excel 2 trang tính: Báo cáo doanh thu Tháng 4 – Tháng 9 & Cơ cấu doanh thu
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
                      facilityName: revenueFacilityFilter,
                      revenueData: activeRevenueData
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

          {/* Filter Cơ Sở */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cơ sở:</span>
              <div className="w-64">
                <Select
                  value={revenueFacilityFilter}
                  onChange={e => setRevenueFacilityFilter(e.target.value)}
                >
                  <option value="Toàn bộ cơ sở">Toàn bộ cơ sở</option>
                  {facilitiesList.map(f => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Phạm vi chu kỳ: <strong className="text-slate-800">Tháng 4 – Tháng 9</strong>
            </span>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 stat-card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500 font-medium">Doanh thu lũy kế</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">
                    {currentTotalRevenue.toLocaleString('vi-VN')} ₫
                  </p>
                  <p className="text-xs text-stone-400 mt-1 font-medium">Tháng 4 đến Tháng 9</p>
                </div>
                <div className="p-2.5 rounded-xl bg-green-50 text-emerald-600">
                  {Icon.dollar}
                </div>
              </div>
            </Card>

            <Card className="p-5 stat-card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500 font-medium">Doanh thu trung bình/tháng</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">
                    {currentAvgRevenue.toLocaleString('vi-VN')} ₫
                  </p>
                  <p className="text-xs text-stone-400 mt-1 font-medium">
                    {currentTotalRevenue.toLocaleString('vi-VN')} / 6
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
                  <p className="text-sm text-stone-500 font-medium">Tháng doanh thu cao nhất</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">
                    {revenueFacilityFilter === 'Toàn bộ cơ sở' ? '18.450.000 ₫' : `${currentHighestItem.revenue.toLocaleString('vi-VN')} ₫`}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1 font-semibold">{currentHighestItem.month}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                  {Icon.check}
                </div>
              </div>
            </Card>

            <Card className="p-5 stat-card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500 font-medium">Dự báo tháng tới</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">{currentForecast}</p>
                  <p className="text-xs text-amber-600 mt-1 font-medium">Dựa trên xu hướng doanh thu gần đây</p>
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
              <h3 className="font-semibold text-slate-800 text-base">Biểu Đồ Doanh Thu Toàn Hệ Thống</h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md font-medium">
                Đơn vị: Triệu VNĐ
              </span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activeRevenueData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 20000000]}
                  ticks={[0, 5000000, 10000000, 15000000, 20000000]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v === 0 ? '0' : `${v / 1000000} triệu`}
                />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString('vi-VN')} ₫`, 'Doanh thu']}
                  labelFormatter={(label: any) => `${label}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" name="Doanh thu" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Bảng Chi Tiết Doanh Thu */}
          <Card>
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">Bảng Chi Tiết Doanh Thu</h3>
              <span className="text-xs text-slate-400">Đơn vị tiền tệ: VNĐ (₫)</span>
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
                {activeRevenueData.map((r, i) => (
                  <Tr key={r.month}>
                    <Td className="font-semibold text-slate-900">{r.month}</Td>
                    <Td className="font-bold text-slate-900 font-mono">
                      {r.revenue.toLocaleString('vi-VN')} ₫
                    </Td>
                    <Td>
                      {r.growth === '—' ? (
                        <span className="text-slate-400 font-medium">—</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold font-mono bg-emerald-50 px-2 py-0.5 rounded text-xs">
                          {r.growth}
                        </span>
                      )}
                    </Td>
                    <Td className="font-medium text-slate-700">{r.contracts}</Td>
                    <Td className="font-semibold text-slate-800">{r.occupancyRate}</Td>
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
                <h3 className="font-semibold text-slate-800 text-base">Hiệu Suất Kho</h3>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md">
                  Vận hành ổn định
                </span>
              </div>
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Tỷ lệ lấp đầy hiện tại</p>
                    <p className="text-xl font-bold text-stone-900 mt-0.5">84%</p>
                  </div>
                  <div className="w-32">
                    <ProgressBar value={84} max={100} color="bg-blue-600" />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Hợp đồng đang hoạt động</p>
                    <p className="text-xl font-bold text-stone-900 mt-0.5">116</p>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                    116 / 138 gian
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Tỷ lệ gia hạn</p>
                    <p className="text-xl font-bold text-stone-900 mt-0.5">91%</p>
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
                <h3 className="font-semibold text-slate-800 text-base">Cơ Cấu Doanh Thu</h3>
                <span className="text-xs text-slate-500 font-medium">Tỷ trọng nguồn thu</span>
              </div>
              <div className="space-y-3.5">
                {REVENUE_BREAKDOWN.map(item => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.category}</span>
                      <span className="font-bold text-slate-900">{item.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
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

      {/* ── MODAL: CHỈNH SỬA CHÍNH SÁCH ─────────────────────── */}
      <Modal open={policyModal} onClose={() => setPolicyModal(false)} title={lang === 'vi' ? 'Chỉnh Sửa Chính Sách Thương Mại' : 'Edit Policy'}>
        {selectedPolicy && (
          <div className="space-y-4">
            <Input
              label={lang === 'vi' ? 'Tên chính sách' : 'Policy Name'}
              value={policyFormName}
              onChange={e => setPolicyFormName(e.target.value)}
            />

            <Input
              label={lang === 'vi' ? 'Giá trị hiện hành' : 'Current Value'}
              value={policyFormValue}
              onChange={e => setPolicyFormValue(e.target.value)}
            />

            <Select
              label={lang === 'vi' ? 'Phạm vi áp dụng' : 'Scope'}
              value={policyFormScope}
              onChange={e => setPolicyFormScope(e.target.value)}
            >
              <option value={lang === 'vi' ? 'Toàn bộ cơ sở' : 'All Facilities'}>
                {lang === 'vi' ? 'Toàn bộ cơ sở' : 'All Facilities'}
              </option>
              {facilitiesList.map(f => (
                <option key={f.id} value={f.name}>
                  {f.name} ({f.city})
                </option>
              ))}
            </Select>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'vi' ? 'Căn cứ / Ghi chú điều chỉnh' : 'Justification / Notes'}
              </label>
              <textarea
                rows={3}
                value={policyFormDesc}
                onChange={e => setPolicyFormDesc(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder={lang === 'vi' ? 'Lý do thay đổi chính sách...' : 'Reason for policy change...'}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setPolicyModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button variant="primary" onClick={handleUpdatePolicy}>
                {lang === 'vi' ? 'Cập nhật chính sách' : 'Update Policy'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: THÊM MỚI CHÍNH SÁCH ─────────────────────── */}
      <Modal open={createPolicyModal} onClose={() => setCreatePolicyModal(false)} title={lang === 'vi' ? 'Thêm Chính Sách Thuê Mới' : 'Add New Rental Policy'}>
        <div className="space-y-4">
          <Input
            label={lang === 'vi' ? 'Tên chính sách' : 'Policy Name'}
            placeholder={lang === 'vi' ? 'VD: Thời gian gia hạn nợ, Phí phạt trễ hạn, Tiền cọc an ninh...' : 'E.g. Grace Period, Late Fee...'}
            value={policyFormName}
            onChange={e => setPolicyFormName(e.target.value)}
          />

          <Input
            label={lang === 'vi' ? 'Giá trị áp dụng' : 'Current Value'}
            placeholder={lang === 'vi' ? 'VD: 5 ngày, 650.000 ₫ / tháng, 1 tháng tiền thuê...' : 'E.g. 5 days, 1 month...'}
            value={policyFormValue}
            onChange={e => setPolicyFormValue(e.target.value)}
          />

          <Select
            label={lang === 'vi' ? 'Phạm vi áp dụng' : 'Scope'}
            value={policyFormScope}
            onChange={e => setPolicyFormScope(e.target.value)}
          >
            <option value={lang === 'vi' ? 'Toàn bộ cơ sở' : 'All Facilities'}>
              {lang === 'vi' ? 'Toàn bộ cơ sở' : 'All Facilities'}
            </option>
            {facilitiesList.map(f => (
              <option key={f.id} value={f.name}>
                {f.name} ({f.city})
              </option>
            ))}
          </Select>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              {lang === 'vi' ? 'Căn cứ / Ghi chú điều chỉnh' : 'Justification / Notes'}
            </label>
            <textarea
              rows={3}
              value={policyFormDesc}
              onChange={e => setPolicyFormDesc(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder={lang === 'vi' ? 'Ghi chú lý do, điều kiện áp dụng chính sách này...' : 'Reason for policy...'}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreatePolicyModal(false)}>
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleSaveNewPolicy}>
              {lang === 'vi' ? 'Lưu Chính Sách' : 'Save Policy'}
            </Button>
          </div>
        </div>
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
              {facilitiesList.map(f => (
                <option key={f.id} value={f.id}>
                  {f.code ? `${f.code} – ` : ''}{f.name} ({f.city})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'vi' ? 'Kích thước & Phân loại kho (S / M / L / XL)' : 'Unit Size & Tier'}
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 mr-1">{lang === 'vi' ? 'Chọn nhanh:' : 'Quick pick:'}</span>
                {(['S', 'M', 'L', 'XL'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      handleSizeChange(size)
                      setFormCode(generateUnitCode(formFacilityId, size, unitsList))
                    }}
                    className={`px-2 py-0.5 text-xs font-bold rounded cursor-pointer transition-all ${
                      formSize === size
                        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="VD: Kho Nhỏ (S), Kho Trung (M), Kho Tùy Chỉnh..."
                value={formSizeInput}
                onChange={e => {
                  const val = e.target.value
                  setFormSizeInput(val)
                  const matched = val.match(/\b(S|M|L|XL)\b/i)?.[0]?.toUpperCase()
                  if (matched && ['S', 'M', 'L', 'XL'].includes(matched)) {
                    setFormSize(matched as any)
                    setFormCode(generateUnitCode(formFacilityId, matched as any, unitsList))
                  }
                }}
              />
              <Input
                label={lang === 'vi' ? 'Đơn giá thuê / tháng (VNĐ)' : 'Monthly Price (VNĐ)'}
                type="number"
                value={String(formPrice)}
                onChange={e => setFormPrice(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Thông số kỹ thuật cho phép tài khoản BO tự điền */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3.5 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>📐</span> {lang === 'vi' ? 'Thông số không gian kho (Cho phép tự điền/chỉnh sửa)' : 'Space Specifications (Customizable)'}
              </span>
              <span className="text-[11px] text-amber-700">
                {lang === 'vi' ? 'Tự động tính hoặc tùy chỉnh' : 'Customizable'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  {lang === 'vi' ? 'Kích thước D×R×C (m):' : 'Dimensions L×W×H (m):'}
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  value={formDimensions}
                  onChange={e => {
                    const val = e.target.value
                    setFormDimensions(val)
                    const nums = val.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)/g)
                    if (nums && nums.length >= 3) {
                      const l = parseFloat(nums[0])
                      const w = parseFloat(nums[1])
                      const h = parseFloat(nums[2])
                      if (!isNaN(l) && !isNaN(w) && !isNaN(h)) {
                        setFormVolumeM3(Math.round(l * w * h * 100) / 100)
                      }
                    }
                  }}
                  placeholder="VD: 5,6 × 6,0 × 3,2 m"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  {lang === 'vi' ? 'Thể tích lưu trữ (m³):' : 'Volume (m³):'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  value={formVolumeM3}
                  onChange={e => setFormVolumeM3(Number(e.target.value))}
                  placeholder="107.52"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  {lang === 'vi' ? 'Độ rộng lối đi xe (m):' : 'Aisle Clearance (m):'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 text-slate-800 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  value={formAisleM}
                  onChange={e => setFormAisleM(Number(e.target.value))}
                  placeholder="1.8"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  {lang === 'vi' ? 'Sức chứa ước tính:' : 'Estimated Capacity:'}
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 text-slate-800 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  value={formCapacity}
                  onChange={e => setFormCapacity(e.target.value)}
                  placeholder="384 thùng nhỏ · 160 thùng to"
                />
              </div>
            </div>
            <div className="pt-0.5">
              <label className="block text-slate-600 font-medium mb-1">
                {lang === 'vi' ? 'Thiết bị xe đẩy hỗ trợ:' : 'Cart Equipment:'}
              </label>
              <input
                type="text"
                className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 text-emerald-800 font-medium text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                value={formEquipment}
                onChange={e => setFormEquipment(e.target.value)}
                placeholder="Xe đẩy tay / xe sàn nhỏ"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'vi' ? 'Tầng' : 'Floor'}
              type="number"
              value={String(formFloor)}
              onChange={e => setFormFloor(Number(e.target.value))}
            />
            <Input
              label={lang === 'vi' ? 'Phân khu' : 'Zone'}
              value={formZone}
              onChange={e => setFormZone(e.target.value)}
            />
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
              value={String(formPrice)}
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

      {/* Modal Xác Nhận Xóa Gian Kho */}
      <Modal open={deleteConfirmModal} onClose={() => setDeleteConfirmModal(false)} title={lang === 'vi' ? 'Xác Nhận Xóa Gian Kho' : 'Confirm Delete Unit'}>
        {selectedUnit && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {lang === 'vi'
                ? `Bạn có chắc chắn muốn xóa gian kho "${selectedUnit.code || selectedUnit.id}" khỏi hệ thống không?`
                : `Are you sure you want to delete unit "${selectedUnit.code || selectedUnit.id}"?`}
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setDeleteConfirmModal(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button variant="primary" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteUnit}>
                {lang === 'vi' ? 'Xóa Gian Kho' : 'Delete Unit'}
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
              value={String(formFacUnits)}
              onChange={e => setFormFacUnits(Number(e.target.value))}
            />
            <Input
              label={lang === 'vi' ? 'Giá cơ sở từ (VNĐ/tháng)' : 'Starting Price (VND/month)'}
              placeholder="VD: 5.500.000 ₫"
              value={formFacPrice}
              onChange={e => setFormFacPrice(e.target.value)}
            />
          </div>
          <div className="pt-1">
            <Select
              label={lang === 'vi' ? 'Trạng thái hoạt động' : 'Status'}
              value={formFacStatus}
              onChange={e => setFormFacStatus(e.target.value as any)}
            >
              <option value="active">{lang === 'vi' ? 'Đang hoạt động' : 'Active'}</option>
              <option value="maintenance">{lang === 'vi' ? 'Bảo trì / Sắp khai trương' : 'Maintenance'}</option>
            </Select>
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
                value={String(formFacUnits)}
                onChange={e => setFormFacUnits(Number(e.target.value))}
              />
              <Input
                label={lang === 'vi' ? 'Giá cơ sở (VNĐ/tháng)' : 'Starting Price (VND/month)'}
                placeholder="VD: 5.500.000 ₫"
                value={formFacPrice}
                onChange={e => setFormFacPrice(e.target.value)}
              />
            </div>
            <div className="pt-1">
              <Select
                label={lang === 'vi' ? 'Trạng thái' : 'Status'}
                value={formFacStatus}
                onChange={e => setFormFacStatus(e.target.value as any)}
              >
                <option value="active">{lang === 'vi' ? 'Đang hoạt động' : 'Active'}</option>
                <option value="maintenance">{lang === 'vi' ? 'Bảo trì' : 'Maintenance'}</option>
              </Select>
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
                <span className="font-semibold text-slate-800">{lang === 'vi' ? 'Camera an ninh 24/7' : 'Security Camera 24/7'}</span>
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
