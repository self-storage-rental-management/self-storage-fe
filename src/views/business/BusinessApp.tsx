import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Tabs, ProgressBar, Input, Select } from '../../components/ui'
import type { User } from '../../types'
import { FACILITIES, UNITS, RENTALS, UNIT_SPECS, REVENUE_DATA, REVENUE_TREND, REVENUE_BREAKDOWN, WAREHOUSE_PERFORMANCE, CONVERSION_DATA, PRICING_TIERS, DISCOUNTS, POLICIES, FEES, type PromotionItem } from "../../data/demoDatabase"
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
    deleteFacility
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

  // Tìm cơ sở đang được chọn (hỗ trợ match ID, tên hoặc mã kho linh hoạt)
  const selectedRevenueFacility = useMemo(() => {
    if (revenueFacilityFilter === 'Toàn bộ cơ sở' || revenueFacilityFilter === 'ALL') return null
    return facilitiesList.find(f =>
      f.id === revenueFacilityFilter ||
      f.name === revenueFacilityFilter ||
      f.code === revenueFacilityFilter ||
      (revenueFacilityFilter.includes('Q1') && (f.code?.includes('HCM-Q1') || f.name.includes('Quận 1'))) ||
      (revenueFacilityFilter.includes('Bình Dương') && (f.code?.includes('BD') || f.name.includes('Bình Dương')))
    ) || null
  }, [facilitiesList, revenueFacilityFilter])

  const selectedRevenueFacilityName = selectedRevenueFacility ? selectedRevenueFacility.name : 'Toàn bộ cơ sở'

  const totalFacilityPortfolioRevenue = useMemo(() => {
    return facilitiesList.reduce((sum, f) => sum + (f.revenue || 0), 0) || 1
  }, [facilitiesList])

  const activeRevenueData = useMemo(() => {
    if (!selectedRevenueFacility) {
      return REVENUE_DATA
    }

    // Tỷ trọng doanh thu tự động phân bổ theo doanh thu khai báo hoặc quy mô gian kho
    let ratio = 1
    if (selectedRevenueFacility.revenue && selectedRevenueFacility.revenue > 0) {
      ratio = selectedRevenueFacility.revenue / totalFacilityPortfolioRevenue
    } else {
      const totalUnits = facilitiesList.reduce((s, f) => s + (f.units || 0), 0) || 1
      ratio = (selectedRevenueFacility.units || 20) / totalUnits
    }
    ratio = Math.max(0.05, Math.min(1, ratio))

    const facOccupancyPct = selectedRevenueFacility.units > 0
      ? Math.round((selectedRevenueFacility.occupied / selectedRevenueFacility.units) * 100)
      : 75

    return REVENUE_DATA.map(item => {
      const revenue = Math.round(item.revenue * ratio)
      const contracts = Math.max(1, Math.round(item.contracts * ratio))
      const occNumber = Math.min(0.99, Math.max(0.2, (item.occupancyNumber / 0.84) * (facOccupancyPct / 100)))
      const occRateStr = `${Math.round(occNumber * 100)}%`
      return {
        ...item,
        revenue,
        contracts,
        occupancyRate: occRateStr,
        occupancyNumber: occNumber
      }
    })
  }, [selectedRevenueFacility, totalFacilityPortfolioRevenue, facilitiesList])

  const currentTotalRevenue = activeRevenueData.reduce((s, i) => s + i.revenue, 0)
  const currentAvgRevenue = Math.round(currentTotalRevenue / (activeRevenueData.length || 1))
  const currentHighestItem = [...activeRevenueData].sort((a, b) => b.revenue - a.revenue)[0] || { month: 'Tháng 9', revenue: 18450000 }
  const currentForecast = !selectedRevenueFacility
    ? '~19.000.000 ₫'
    : `~${Math.round(currentHighestItem.revenue * 1.03).toLocaleString('vi-VN')} ₫`

  const maxRevenueValue = Math.max(...activeRevenueData.map(d => d.revenue), 10000000)
  const chartYMax = Math.ceil(maxRevenueValue / 5000000) * 5000000

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

  // Bộ lọc và tìm kiếm cơ sở
  const [facSearch, setFacSearch] = useState<string>('')
  const [facFilterCity, setFacFilterCity] = useState<string>('All')
  const [facFilterStatus, setFacFilterStatus] = useState<string>('All')

  // Form thêm / sửa cơ sở
  const [formFacCode, setFormFacCode] = useState<string>('HN-F01')
  const [formFacName, setFormFacName] = useState<string>('')
  const [formFacAddress, setFormFacAddress] = useState<string>('')
  const [formFacCity, setFormFacCity] = useState<string>('Hà Nội')
  const [formFacManager, setFormFacManager] = useState<string>('')
  const [formFacPhone, setFormFacPhone] = useState<string>('024 3822 9999')
  const [formFacUnits, setFormFacUnits] = useState<number>(20)
  const [formFacUnitS, setFormFacUnitS] = useState<number>(5)
  const [formFacUnitM, setFormFacUnitM] = useState<number>(5)
  const [formFacUnitL, setFormFacUnitL] = useState<number>(5)
  const [formFacUnitXL, setFormFacUnitXL] = useState<number>(5)
  const [formFacPrice, setFormFacPrice] = useState<string>('5.500.000đ')
  const [formFacClimate, setFormFacClimate] = useState<boolean>(false)
  const [formFacSecurity, setFormFacSecurity] = useState<string>('Khóa riêng tự quản, Bảo vệ cổng')
  const [formFacAccessHours, setFormFacAccessHours] = useState<string>('06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)')
  const [formFacStatus, setFormFacStatus] = useState<'active' | 'maintenance'>('active')

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Tự do chỉ định số lượng từng cỡ kho (S, M, L, XL)
  const handleUnitSizeChange = (size: 'S' | 'M' | 'L' | 'XL', val: number) => {
    const safeVal = Math.max(0, Math.floor(val || 0))
    let s = formFacUnitS
    let m = formFacUnitM
    let l = formFacUnitL
    let xl = formFacUnitXL
    if (size === 'S') s = safeVal
    if (size === 'M') m = safeVal
    if (size === 'L') l = safeVal
    if (size === 'XL') xl = safeVal
    setFormFacUnitS(s)
    setFormFacUnitM(m)
    setFormFacUnitL(l)
    setFormFacUnitXL(xl)
    setFormFacUnits(s + m + l + xl)
  }

  // Phân bổ nhanh theo các kịch bản thực tế
  const handleApplyPreset = (preset: 'equal' | 'mini' | 'large' | 'small-only') => {
    const total = formFacUnits > 0 ? formFacUnits : 10
    if (preset === 'equal') {
      const base = Math.floor(total / 4)
      let rem = total % 4
      const s = base + (rem-- > 0 ? 1 : 0)
      const m = base + (rem-- > 0 ? 1 : 0)
      const l = base + (rem-- > 0 ? 1 : 0)
      const xl = base + (rem-- > 0 ? 1 : 0)
      setFormFacUnitS(s)
      setFormFacUnitM(m)
      setFormFacUnitL(l)
      setFormFacUnitXL(xl)
      setFormFacUnits(s + m + l + xl)
    } else if (preset === 'mini') {
      const s = Math.ceil(total * 0.6)
      const m = Math.max(0, total - s)
      setFormFacUnitS(s)
      setFormFacUnitM(m)
      setFormFacUnitL(0)
      setFormFacUnitXL(0)
      setFormFacUnits(s + m)
    } else if (preset === 'large') {
      const l = Math.floor(total * 0.5)
      const xl = Math.max(0, total - l)
      setFormFacUnitS(0)
      setFormFacUnitM(0)
      setFormFacUnitL(l)
      setFormFacUnitXL(xl)
      setFormFacUnits(l + xl)
    } else if (preset === 'small-only') {
      setFormFacUnitS(total)
      setFormFacUnitM(0)
      setFormFacUnitL(0)
      setFormFacUnitXL(0)
      setFormFacUnits(total)
    }
  }

  // Tự động phân bổ khi sửa tổng số kho
  const handleTotalUnitsChange = (newTotal: number) => {
    const target = Math.max(0, Math.floor(newTotal || 0))
    setFormFacUnits(target)
    const currentSum = formFacUnitS + formFacUnitM + formFacUnitL + formFacUnitXL
    if (currentSum > 0) {
      let s = Math.round((formFacUnitS / currentSum) * target)
      let m = Math.round((formFacUnitM / currentSum) * target)
      let l = Math.round((formFacUnitL / currentSum) * target)
      let xl = Math.max(0, target - (s + m + l))
      setFormFacUnitS(s)
      setFormFacUnitM(m)
      setFormFacUnitL(l)
      setFormFacUnitXL(xl)
    } else {
      const base = Math.floor(target / 4)
      let rem = target % 4
      const s = base + (rem-- > 0 ? 1 : 0)
      const m = base + (rem-- > 0 ? 1 : 0)
      const l = base + (rem-- > 0 ? 1 : 0)
      const xl = base + (rem-- > 0 ? 1 : 0)
      setFormFacUnitS(s)
      setFormFacUnitM(m)
      setFormFacUnitL(l)
      setFormFacUnitXL(xl)
    }
  }

  // Tự động gợi ý mã cơ sở chuẩn theo tỉnh/thành phố
  const suggestFacilityCode = (cityName: string) => {
    let prefix = 'FAC'
    const lower = cityName.toLowerCase()
    if (lower.includes('hà nội') || lower.includes('ha noi')) prefix = 'HN'
    else if (lower.includes('hồ chí minh') || lower.includes('hcm') || lower.includes('sài gòn') || lower.includes('q1') || lower.includes('quận')) prefix = 'HCM'
    else if (lower.includes('bình dương') || lower.includes('binh duong')) prefix = 'BD'
    else if (lower.includes('đà nẵng') || lower.includes('da nang')) prefix = 'DN'
    else if (lower.includes('hải phòng') || lower.includes('hai phong')) prefix = 'HP'
    else if (lower.includes('cần thơ') || lower.includes('can tho')) prefix = 'CT'
    else if (lower.includes('đồng nai') || lower.includes('dong nai')) prefix = 'DNAI'
    else {
      prefix = cityName.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase() || 'FAC'
    }

    const regex = new RegExp(`^${prefix}-F?(\\d+)`, 'i')
    const existingNums = facilitiesList
      .map(f => (f.code || f.id || '').toUpperCase())
      .map(c => {
        const m = c.match(regex)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter(n => n > 0)

    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1
    return `${prefix}-F${String(nextNum).padStart(2, '0')}`
  }

  // Mở modal thêm cơ sở mới với dữ liệu mẫu trực quan
  const handleOpenCreateFacility = () => {
    const defaultCity = 'Hà Nội'
    const autoCode = suggestFacilityCode(defaultCity)
    setFormFacCode(autoCode)
    setFormFacName('Kho Việt – Cơ sở Hà Nội')
    setFormFacAddress('Số 123 Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy')
    setFormFacCity(defaultCity)
    setFormFacManager('Trần Văn Quản Lý')
    setFormFacPhone('024 3822 9999')
    setFormFacUnitS(5)
    setFormFacUnitM(5)
    setFormFacUnitL(5)
    setFormFacUnitXL(5)
    setFormFacUnits(20)
    setFormFacPrice('5.500.000đ')
    setFormFacClimate(false)
    setFormFacSecurity('Khóa riêng tự quản, Bảo vệ cổng')
    setFormFacAccessHours('06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)')
    setFormFacStatus('active')
    setCreateFacilityModal(true)
  }

  const handleCreateFacility = () => {
    const code = formFacCode.trim().toUpperCase()
    if (!code) {
      showToast(lang === 'vi' ? 'Vui lòng nhập mã cơ sở / kho!' : 'Please enter facility code!')
      return
    }
    if (facilitiesList.some(f => (f.code || f.id).toUpperCase() === code)) {
      showToast(lang === 'vi' ? `Mã cơ sở "${code}" đã tồn tại! Vui lòng chọn mã khác.` : `Facility code "${code}" already exists!`)
      return
    }
    if (!formFacName.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập tên cơ sở / chi nhánh kho!' : 'Please enter facility name!')
      return
    }
    if (!formFacAddress.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập địa chỉ cơ sở!' : 'Please enter facility address!')
      return
    }
    if (!formFacCity.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng chọn hoặc nhập Tỉnh/Thành phố!' : 'Please enter city!')
      return
    }

    const totalCalculatedUnits = formFacUnitS + formFacUnitM + formFacUnitL + formFacUnitXL
    if (totalCalculatedUnits <= 0) {
      showToast(lang === 'vi' ? 'Vui lòng chỉ định ít nhất 1 gian kho cho cơ sở!' : 'Please specify at least 1 storage unit!')
      return
    }

    const created = createFacility({
      code,
      name: formFacName.trim(),
      address: formFacAddress.trim(),
      city: formFacCity.trim(),
      manager: formFacManager.trim() || 'Quản lý cơ sở',
      phone: formFacPhone.trim() || '1900 6868',
      units: totalCalculatedUnits,
      unitDistribution: {
        S: formFacUnitS,
        M: formFacUnitM,
        L: formFacUnitL,
        XL: formFacUnitXL
      },
      price: formFacPrice || '5.500.000đ',
      climate: formFacClimate,
      security: formFacSecurity,
      accessHours: formFacAccessHours,
      status: formFacStatus,
      occupied: 0,
      available: totalCalculatedUnits,
      revenue: 0,
      growth: 0
    }, user)

    setCreateFacilityModal(false)
    const breakdownStr = `S: ${formFacUnitS} · M: ${formFacUnitM} · L: ${formFacUnitL} · XL: ${formFacUnitXL}`
    showToast(lang === 'vi' ? `Đã thêm cơ sở "${created.name}" (${created.code}) với ${created.units} gian kho (${breakdownStr})!` : `Facility "${created.name}" created successfully!`)
  }

  const handleOpenEditFacility = (f: any) => {
    setSelectedFacility(f)
    setFormFacCode(f.code || f.id)
    setFormFacName(f.name)
    setFormFacAddress(f.address)
    setFormFacCity(f.city)
    setFormFacManager(f.manager)
    setFormFacPhone(f.phone || '1900 6868')

    // Find current unit breakdown
    const facUnits = unitsList.filter(u => u.facilityId === f.id || u.facilityId === f.code)
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
      sCount = facUnits.filter(u => ((u as any).size || (u.type === 'Small' ? 'S' : '')) === 'S').length
      mCount = facUnits.filter(u => ((u as any).size || (u.type === 'Medium' ? 'M' : '')) === 'M').length
      lCount = facUnits.filter(u => ((u as any).size || (u.type === 'Large' ? 'L' : '')) === 'L').length
      xlCount = facUnits.filter(u => ((u as any).size || (u.type === 'Extra Large' ? 'XL' : '')) === 'XL').length
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
    setFormFacPrice(f.price)
    setFormFacClimate(Boolean(f.climate))
    setFormFacSecurity(f.security || 'Khóa riêng tự quản, Bảo vệ cổng')
    setFormFacAccessHours(f.accessHours || '06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)')
    setFormFacStatus(f.status)
    setEditFacilityModal(true)
  }

  const handleUpdateFacility = () => {
    if (!selectedFacility) return
    const code = formFacCode.trim().toUpperCase()
    if (!code) {
      showToast(lang === 'vi' ? 'Vui lòng nhập mã cơ sở / kho!' : 'Please enter facility code!')
      return
    }
    const duplicate = facilitiesList.find(f => (f.code || f.id).toUpperCase() === code && f.id !== selectedFacility.id)
    if (duplicate) {
      showToast(lang === 'vi' ? `Mã cơ sở "${code}" đã thuộc về cơ sở khác!` : `Facility code "${code}" already exists!`)
      return
    }
    if (!formFacName.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập tên cơ sở!' : 'Please enter facility name!')
      return
    }
    if (!formFacAddress.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập địa chỉ cơ sở!' : 'Please enter facility address!')
      return
    }

    const totalCalculatedUnits = formFacUnitS + formFacUnitM + formFacUnitL + formFacUnitXL
    if (totalCalculatedUnits <= 0) {
      showToast(lang === 'vi' ? 'Vui lòng chỉ định ít nhất 1 gian kho cho cơ sở!' : 'Please specify at least 1 storage unit!')
      return
    }

    // Validation: không cho phép giảm số lượng thấp hơn số gian kho đang được thuê (occupied)
    const facUnits = unitsList.filter(u => u.facilityId === selectedFacility.id || u.facilityId === selectedFacility.code)
    const getOcc = (size: 'S' | 'M' | 'L' | 'XL') => facUnits.filter(u => {
      const s = (u as any).size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : 'XL')
      return s === size && (u.status === 'occupied' || (u.status as string) === 'rented')
    }).length

    const occS = getOcc('S')
    const occM = getOcc('M')
    const occL = getOcc('L')
    const occXL = getOcc('XL')

    if (formFacUnitS < occS) {
      showToast(lang === 'vi' ? `Không thể giảm Kho S xuống ${formFacUnitS} vì hiện có ${occS} gian kho đang được thuê.` : `Cannot reduce Unit S to ${formFacUnitS} because ${occS} units are occupied.`)
      return
    }
    if (formFacUnitM < occM) {
      showToast(lang === 'vi' ? `Không thể giảm Kho M xuống ${formFacUnitM} vì hiện có ${occM} gian kho đang được thuê.` : `Cannot reduce Unit M to ${formFacUnitM} because ${occM} units are occupied.`)
      return
    }
    if (formFacUnitL < occL) {
      showToast(lang === 'vi' ? `Không thể giảm Kho L xuống ${formFacUnitL} vì hiện có ${occL} gian kho đang được thuê.` : `Cannot reduce Unit L to ${formFacUnitL} because ${occL} units are occupied.`)
      return
    }
    if (formFacUnitXL < occXL) {
      showToast(lang === 'vi' ? `Không thể giảm Kho XL xuống ${formFacUnitXL} vì hiện có ${occXL} gian kho đang được thuê.` : `Cannot reduce Unit XL to ${formFacUnitXL} because ${occXL} units are occupied.`)
      return
    }

    updateFacility(selectedFacility.id, {
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
        XL: formFacUnitXL
      },
      price: formFacPrice,
      climate: formFacClimate,
      security: formFacSecurity,
      accessHours: formFacAccessHours,
      status: formFacStatus
    }, user)

    setEditFacilityModal(false)
    const breakdownStr = `S: ${formFacUnitS} · M: ${formFacUnitM} · L: ${formFacUnitL} · XL: ${formFacUnitXL}`
    showToast(lang === 'vi' ? `Đã cập nhật cơ sở "${formFacName}" thành công (${totalCalculatedUnits} kho · ${breakdownStr})!` : `Facility updated!`)
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

  // Danh sách cơ sở sau khi lọc & tìm kiếm
  const filteredFacilities = useMemo(() => {
    return facilitiesList.filter(f => {
      if (facFilterCity !== 'All' && f.city !== facFilterCity) return false
      if (facFilterStatus !== 'All' && f.status !== facFilterStatus) return false
      if (facSearch.trim()) {
        const q = facSearch.toLowerCase()
        const code = (f.code || f.id || '').toLowerCase()
        const name = (f.name || '').toLowerCase()
        const addr = (f.address || '').toLowerCase()
        const mgr = (f.manager || '').toLowerCase()
        const city = (f.city || '').toLowerCase()
        return code.includes(q) || name.includes(q) || addr.includes(q) || mgr.includes(q) || city.includes(q)
      }
      return true
    })
  }, [facilitiesList, facFilterCity, facFilterStatus, facSearch])

  // Danh sách các thành phố duy nhất trong hệ thống cơ sở
  const availableCities = useMemo(() => {
    const set = new Set<string>()
    facilitiesList.forEach(f => { if (f.city) set.add(f.city) })
    return Array.from(set)
  }, [facilitiesList])


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
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm flex items-center gap-1.5"
                onClick={handleOpenCreateFacility}
              >
                {Icon.plus} {lang === 'vi' ? 'Thêm Cơ Sở Mới' : 'Add New Facility'}
              </Button>
            }
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={lang === 'vi' ? 'Tổng số cơ sở' : 'Total Locations'} value={facilitiesList.length} icon={Icon.building} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Tổng số gian kho' : 'Total Units'} value={totalUnits} icon={Icon.box} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Tỷ lệ lấp đầy TB' : 'Portfolio Occupancy'} value={`${totalUnits ? Math.round(totalOccupied / totalUnits * 100) : 0}%`} icon={Icon.chart} iconBg="bg-green-50" />
            <StatCard title={lang === 'vi' ? 'Doanh thu tháng (MTD)' : 'Total Revenue MTD'} value={formatCurrency(totalRevenue)} icon={Icon.dollar} iconBg="bg-amber-50" />
          </div>
          {/* Thanh Công Cụ: Tìm kiếm & Lọc Đa Tiêu Chí */}
          <Card className="p-4 border border-stone-200/90 shadow-sm bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  🔍 {lang === 'vi' ? 'Tìm kiếm cơ sở' : 'Search Facility'}
                </label>
                <Input
                  placeholder={lang === 'vi' ? 'Nhập mã cơ sở (VD: HN-F01, HCM-Q1), tên kho, địa chỉ, người quản lý...' : 'Search code, name, address, manager...'}
                  value={facSearch}
                  onChange={e => setFacSearch(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  📍 {lang === 'vi' ? 'Tỉnh / Thành phố' : 'City / Province'}
                </label>
                <Select
                  value={facFilterCity}
                  onChange={e => setFacFilterCity(e.target.value)}
                >
                  <option value="All">{lang === 'vi' ? `Tất cả thành phố (${availableCities.length})` : 'All Cities'}</option>
                  {availableCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ⚡ {lang === 'vi' ? 'Trạng thái hoạt động' : 'Status'}
                </label>
                <Select
                  value={facFilterStatus}
                  onChange={e => setFacFilterStatus(e.target.value)}
                >
                  <option value="All">{lang === 'vi' ? 'Tất cả trạng thái' : 'All Statuses'}</option>
                  <option value="active">{lang === 'vi' ? 'Đang hoạt động' : 'Active'}</option>
                  <option value="maintenance">{lang === 'vi' ? 'Chuẩn bị khai trương / Bảo trì' : 'Maintenance'}</option>
                </Select>
              </div>
            </div>

            {(facSearch || facFilterCity !== 'All' || facFilterStatus !== 'All') && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Đang lọc thấy <b>{filteredFacilities.length}</b> / {facilitiesList.length} cơ sở kho trong hệ thống
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFacSearch('')
                    setFacFilterCity('All')
                    setFacFilterStatus('All')
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
                  🏢
                </div>
                <h4 className="font-bold text-slate-800 text-base">
                  {lang === 'vi' ? 'Không tìm thấy cơ sở phù hợp' : 'No matching facility found'}
                </h4>
                <p className="text-xs text-slate-500">
                  {lang === 'vi' ? 'Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc bấm Thêm Cơ Sở Mới để mở rộng mạng lưới cơ sở lưu trữ tại địa điểm mới.' : 'Try adjusting filters or create a new facility location.'}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreateFacility}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  + {lang === 'vi' ? 'Thêm Cơ Sở Mới Ngay' : 'Add New Facility'}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFacilities.map(f => {
                const facCode = f.code || f.id
                const occupancyRate = f.units ? Math.round((f.occupied || 0) / f.units * 100) : 0
                return (
                  <Card key={f.id} className="p-5 hover:border-amber-400/70 transition-all border border-stone-200/90 shadow-sm bg-white">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Hàng 1: Mã cơ sở + Tên + Badge trạng thái */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-100/80 text-amber-900 border border-amber-300">
                            {facCode}
                          </span>
                          <h3 className="font-bold text-slate-900 text-lg leading-snug">
                            {f.name}
                          </h3>
                          <Badge variant={f.status === 'active' ? 'success' : 'warning'}>
                            {f.status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (lang === 'vi' ? 'Sắp mở / Bảo trì' : 'Maintenance')}
                          </Badge>
                        </div>

                        {/* Hàng 2: Địa chỉ + Quản lý + Hotline + Giờ mở cửa */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-600">
                          <div className="flex items-start gap-1.5">
                            <span className="text-amber-600 shrink-0">📍</span>
                            <span className="truncate" title={f.address}>{f.address} · <b className="text-slate-800">{f.city}</b></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-600 shrink-0">👤</span>
                            <span>Quản lý: <b className="text-slate-800">{f.manager}</b> {f.phone ? `(${f.phone})` : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-600 shrink-0">🕒</span>
                            <span className="truncate" title={f.accessHours || '06:00 - 22:00'}>{f.accessHours || '06:00 - 22:00 (24/7 VIP)'}</span>
                          </div>
                        </div>

                        {/* Hàng 2.5: Cơ cấu quy mô gian kho (S, M, L, XL) */}
                        {(() => {
                          const facUnits = unitsList.filter(u => u.facilityId === f.id || u.facilityId === f.code)
                          const s = f.unitDistribution?.S ?? facUnits.filter(u => ((u as any).size || (u.type === 'Small' ? 'S' : '')) === 'S').length
                          const m = f.unitDistribution?.M ?? facUnits.filter(u => ((u as any).size || (u.type === 'Medium' ? 'M' : '')) === 'M').length
                          const l = f.unitDistribution?.L ?? facUnits.filter(u => ((u as any).size || (u.type === 'Large' ? 'L' : '')) === 'L').length
                          const xl = f.unitDistribution?.XL ?? facUnits.filter(u => ((u as any).size || (u.type === 'Extra Large' ? 'XL' : '')) === 'XL').length

                          return (
                            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                              <span className="text-slate-400 font-medium text-[11px]">{lang === 'vi' ? 'Quy mô chi tiết:' : 'Unit sizes:'}</span>
                              {s > 0 && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[11px] font-semibold">{s} Kho Nhỏ (S)</span>}
                              {m > 0 && <span className="px-2 py-0.5 rounded bg-green-50 text-green-800 border border-green-200 font-mono text-[11px] font-semibold">{m} Kho Vừa (M)</span>}
                              {l > 0 && <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-mono text-[11px] font-semibold">{l} Kho Lớn (L)</span>}
                              {xl > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-mono text-[11px] font-semibold">{xl} Kho Rất Lớn (XL)</span>}
                              {(s + m + l + xl === 0) && <span className="text-slate-400 italic text-[11px]">{f.units} kho tiêu chuẩn</span>}
                            </div>
                          )
                        })()}

                        {/* Hàng 3: Thước đo vận hành (Lấp đầy, Doanh thu, Đơn giá từ) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50/80 p-3 rounded-xl border border-stone-200/60">
                          <div>
                            <p className="text-[11px] text-slate-500 font-medium">{lang === 'vi' ? 'Tỷ lệ lấp đầy' : 'Occupancy'}</p>
                            <p className="font-bold text-slate-900 text-sm">
                              {f.occupied || 0}/{f.units} kho <span className="text-slate-500 font-normal text-xs">({occupancyRate}%)</span>
                            </p>
                            <ProgressBar value={f.occupied || 0} max={f.units} color={occupancyRate >= 80 ? 'bg-emerald-500' : occupancyRate >= 40 ? 'bg-blue-500' : 'bg-amber-500'} />
                          </div>

                          <div>
                            <p className="text-[11px] text-slate-500 font-medium">{lang === 'vi' ? 'Doanh thu tháng (MTD)' : 'Revenue MTD'}</p>
                            <p className="font-bold text-slate-900 text-sm">{formatCurrency(f.revenue || 0)}</p>
                            <p className="text-[10px] text-emerald-700 font-semibold">{f.growth ? `+${f.growth}% so với kỳ trước` : 'Doanh thu ổn định'}</p>
                          </div>

                          <div>
                            <p className="text-[11px] text-slate-500 font-medium">{lang === 'vi' ? 'Cước cơ sở từ' : 'Base Rate'}</p>
                            <p className="font-bold text-emerald-800 text-sm">{f.price}/tháng</p>
                            <p className="text-[10px] text-slate-500">Kỳ thuê từ 1 tháng</p>
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
                          👁️ {lang === 'vi' ? 'Chi tiết' : 'Details'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs font-semibold border-amber-300 text-amber-800 hover:bg-amber-50"
                          onClick={() => handleOpenEditFacility(f)}
                        >
                          ✏️ {lang === 'vi' ? 'Chỉnh sửa' : 'Edit'}
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
                          🗑️ {lang === 'vi' ? 'Xóa cơ sở' : 'Delete'}
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
                        facilityName: selectedRevenueFacilityName,
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
                      facilityName: selectedRevenueFacilityName,
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

          {/* Filter Cơ Sở - Tự động cập nhật mọi cơ sở mới thêm vào hệ thống */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cơ sở:</span>
              <div className="w-64">
                <Select
                  value={selectedRevenueFacility ? selectedRevenueFacility.id : 'Toàn bộ cơ sở'}
                  onChange={e => setRevenueFacilityFilter(e.target.value)}
                >
                  <option value="Toàn bộ cơ sở">Toàn bộ cơ sở</option>
                  {facilitiesList.map(f => (
                    <option key={f.id} value={f.id}>
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
                    {currentHighestItem.revenue.toLocaleString('vi-VN')} ₫
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
              <h3 className="font-semibold text-slate-800 text-base">Biểu Đồ Doanh Thu {selectedRevenueFacility ? `– ${selectedRevenueFacility.name}` : 'Toàn Hệ Thống'}</h3>
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
                  domain={[0, chartYMax]}
                  ticks={[0, Math.round(chartYMax * 0.25), Math.round(chartYMax * 0.5), Math.round(chartYMax * 0.75), chartYMax]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v === 0 ? '0' : `${Math.round(v / 1000000)} triệu`}
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
                    <p className="text-xl font-bold text-stone-900 mt-0.5">
                      {selectedRevenueFacility
                        ? `${Math.round((selectedRevenueFacility.occupied / Math.max(1, selectedRevenueFacility.units)) * 100)}%`
                        : '84%'}
                    </p>
                  </div>
                  <div className="w-32">
                    <ProgressBar
                      value={selectedRevenueFacility
                        ? Math.round((selectedRevenueFacility.occupied / Math.max(1, selectedRevenueFacility.units)) * 100)
                        : 84}
                      max={100}
                      color="bg-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Hợp đồng đang hoạt động</p>
                    <p className="text-xl font-bold text-stone-900 mt-0.5">
                      {selectedRevenueFacility ? selectedRevenueFacility.occupied : 116}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                    {selectedRevenueFacility
                      ? `${selectedRevenueFacility.occupied} / ${selectedRevenueFacility.units} gian`
                      : '116 / 138 gian'}
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
              {facilitiesList.filter(f => f.status === 'active').map(f => (
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
                {facilitiesList.filter(f => f.status === 'active').map(f => (
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

      {/* ── MODALS QUẢN LÝ CƠ SỞ (CRUD FACILITIES) ─────────── */}
      {(() => {
        // Shared size specifications for compact form table
        const FACILITY_SIZE_SPECS = [
          {
            size: 'S' as const,
            name: 'Kho Nhỏ',
            dimensions: '5.6 × 6.0 m',
            areaM2: '33.6 m²',
            volumeM3: '107 m³',
            badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
          },
          {
            size: 'M' as const,
            name: 'Kho Trung',
            dimensions: '9.0 × 6.4 m',
            areaM2: '57.6 m²',
            volumeM3: '195 m³',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
          },
          {
            size: 'L' as const,
            name: 'Kho Lớn',
            dimensions: '13.5 × 6.8 m',
            areaM2: '91.8 m²',
            volumeM3: '330 m³',
            badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
          },
          {
            size: 'XL' as const,
            name: 'Rất Lớn',
            dimensions: '19.0 × 7.2 m',
            areaM2: '136.8 m²',
            volumeM3: '547 m³',
            badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
          }
        ]

        const getFormUnitQty = (size: 'S' | 'M' | 'L' | 'XL') => {
          if (size === 'S') return formFacUnitS
          if (size === 'M') return formFacUnitM
          if (size === 'L') return formFacUnitL
          return formFacUnitXL
        }

        const renderUnitAllocationSection = (
          isEditing: boolean,
          occupiedMap: Record<'S' | 'M' | 'L' | 'XL', number> = { S: 0, M: 0, L: 0, XL: 0 }
        ) => {
          return (
            <div className="space-y-3 pt-1">
              {/* Section Header */}
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                  <span>📐</span> {lang === 'vi' ? 'Phân bổ gian kho' : 'Storage Unit Allocation'}
                </h4>
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-mono">
                  {lang === 'vi' ? `Tổng: ${formFacUnits} kho` : `Total: ${formFacUnits} units`}
                </span>
              </div>

              {/* Compact Table */}
              <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100/75 border-b border-stone-200 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">{lang === 'vi' ? 'Kích thước' : 'Size'}</th>
                      <th className="py-2.5 px-3 text-center">{lang === 'vi' ? 'Diện tích' : 'Area'}</th>
                      <th className="py-2.5 px-3 text-center">{lang === 'vi' ? 'Thể tích' : 'Volume'}</th>
                      <th className="py-2.5 px-3 text-right">{lang === 'vi' ? 'Số lượng' : 'Quantity'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {FACILITY_SIZE_SPECS.map(spec => {
                      const qty = getFormUnitQty(spec.size)
                      const occ = occupiedMap[spec.size] || 0
                      const isBelowOcc = isEditing && qty < occ

                      return (
                        <tr key={spec.size} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-7 h-7 flex items-center justify-center rounded font-mono font-bold text-xs border shrink-0 ${spec.badgeClass}`}>
                                {spec.size}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-stone-800">{spec.name}</span>
                                  <span className="text-[11px] text-stone-400 font-mono">({spec.dimensions})</span>
                                </div>
                                {isEditing && occ > 0 && (
                                  <div className="text-[11px] font-medium text-amber-700">
                                    Đang thuê: {occ} kho
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-stone-600">
                            {spec.areaM2}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-stone-500">
                            {spec.volumeM3}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isEditing ? qty <= occ : qty <= 0}
                                onClick={() => handleUnitSizeChange(spec.size, Math.max(isEditing ? occ : 0, qty - 1))}
                                className="w-7 h-7 rounded border border-stone-300 bg-white hover:bg-stone-100 font-bold text-stone-700 flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                className={`w-14 h-7 text-center border rounded font-mono font-bold text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                                  isBelowOcc ? 'border-red-400 text-red-700 bg-red-50' : 'border-stone-300 text-stone-800'
                                }`}
                                value={qty}
                                onChange={e => {
                                  const parsed = parseInt(e.target.value, 10)
                                  handleUnitSizeChange(spec.size, isNaN(parsed) ? 0 : Math.max(0, parsed))
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleUnitSizeChange(spec.size, qty + 1)}
                                className="w-7 h-7 rounded border border-stone-300 bg-white hover:bg-stone-100 font-bold text-stone-700 flex items-center justify-center transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            {isBelowOcc && (
                              <div className="text-[10px] text-red-600 text-right mt-0.5">
                                Tối thiểu {occ} (đang thuê)
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-stone-50/90 border-t border-stone-200 font-semibold text-stone-800">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3">
                        {lang === 'vi' ? 'Tổng cộng' : 'Total'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-mono text-sm font-bold text-amber-700">{formFacUnits}</span>{' '}
                        <span className="text-stone-500 font-normal text-xs">{lang === 'vi' ? 'kho' : 'units'}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

            </div>
          )
        }

        return (
          <>
            {/* 1. Modal Thêm Mới Cơ Sở (Create Facility) */}
            <Modal
              open={createFacilityModal}
              onClose={() => setCreateFacilityModal(false)}
              title={lang === 'vi' ? 'Thêm Cơ Sở Kho Mới' : 'Create New Storage Facility'}
              size="lg"
            >
              <div className="space-y-4">
                {/* Thông tin cơ sở */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                    {lang === 'vi' ? 'Thông tin cơ sở' : 'Facility Information'}
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          {lang === 'vi' ? 'Mã cơ sở / Mã kho *' : 'Facility Code *'}
                        </label>
                        <input
                          type="text"
                          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                          placeholder="VD: HN-F02"
                          value={formFacCode}
                          onChange={e => setFormFacCode(e.target.value.toUpperCase())}
                        />
                        <p className="text-[11px] text-stone-400 mt-0.5">Quy chuẩn: Tỉnh/TP - Số thứ tự (VD: HN-F02)</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          {lang === 'vi' ? 'Tỉnh / Thành phố *' : 'City / Province *'}
                        </label>
                        <Select
                          value={formFacCity}
                          onChange={e => {
                            const newCity = e.target.value;
                            setFormFacCity(newCity);
                            const autoCode = suggestFacilityCode(newCity);
                            setFormFacCode(autoCode);
                            if (formFacName.includes('Cơ sở')) {
                              setFormFacName(`Kho Việt – Cơ sở ${newCity}`);
                            }
                          }}
                        >
                          <option value="Hà Nội">Hà Nội</option>
                          <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
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
                      label={lang === 'vi' ? 'Tên cơ sở / Chi nhánh kho *' : 'Facility Name *'}
                      placeholder="VD: Kho Việt – Cơ sở Hà Nội..."
                      value={formFacName}
                      onChange={e => setFormFacName(e.target.value)}
                    />

                    <Input
                      label={lang === 'vi' ? 'Địa điểm / Địa chỉ chi tiết *' : 'Street Address *'}
                      placeholder="VD: Số 123 Đường Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy..."
                      value={formFacAddress}
                      onChange={e => setFormFacAddress(e.target.value)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={lang === 'vi' ? 'Người quản lý chi nhánh' : 'Facility Manager'}
                        placeholder="VD: Trần Văn Quản Lý..."
                        value={formFacManager}
                        onChange={e => setFormFacManager(e.target.value)}
                      />
                      <Input
                        label={lang === 'vi' ? 'Hotline liên hệ' : 'Phone / Hotline'}
                        placeholder="VD: 024 3822 9999..."
                        value={formFacPhone}
                        onChange={e => setFormFacPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Quy mô & phân bổ kho */}
                {renderUnitAllocationSection(false)}

                {/* Thông số vận hành */}
                <div className="pt-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                    {lang === 'vi' ? 'Thông số vận hành' : 'Operation Settings'}
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={lang === 'vi' ? 'Giá cơ sở từ / tháng' : 'Starting Price'}
                        placeholder="5.500.000đ"
                        value={formFacPrice}
                        onChange={e => setFormFacPrice(e.target.value)}
                      />
                      <Input
                        label={lang === 'vi' ? 'Khung giờ ra vào / Giờ mở cửa' : 'Access Hours'}
                        placeholder="06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)"
                        value={formFacAccessHours}
                        onChange={e => setFormFacAccessHours(e.target.value)}
                      />
                    </div>

                    <div>
                      <Select
                        label={lang === 'vi' ? 'Trạng thái ban đầu' : 'Initial Status'}
                        value={formFacStatus}
                        onChange={e => setFormFacStatus(e.target.value as any)}
                      >
                        <option value="active">{lang === 'vi' ? 'Đang hoạt động (Active)' : 'Active'}</option>
                        <option value="maintenance">{lang === 'vi' ? 'Chuẩn bị khai trương / Bảo trì' : 'Maintenance / Pre-opening'}</option>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Sticky footer */}
                <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex justify-end items-center gap-2 z-10">
                  <Button variant="outline" onClick={() => setCreateFacilityModal(false)}>
                    {lang === 'vi' ? 'Hủy' : 'Cancel'}
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    disabled={!formFacName.trim() || !formFacCode.trim() || !formFacAddress.trim() || formFacUnits <= 0}
                    onClick={handleCreateFacility}
                  >
                    {lang === 'vi' ? 'Lưu Cơ Sở Mới' : 'Save Facility'}
                  </Button>
                </div>
              </div>
            </Modal>

            {/* 2. Modal Chỉnh Sửa Cơ Sở (Edit Facility) */}
            <Modal
              open={editFacilityModal}
              onClose={() => setEditFacilityModal(false)}
              title={lang === 'vi' ? 'Chỉnh Sửa Thông Tin Cơ Sở' : 'Edit Facility'}
              size="lg"
            >
              {selectedFacility && (() => {
                const facUnits = unitsList.filter(u => u.facilityId === selectedFacility.id || u.facilityId === selectedFacility.code)
                const occMap = {
                  S: facUnits.filter(u => ((u as any).size === 'S' || u.type === 'Small') && (u.status === 'occupied' || (u.status as string) === 'rented')).length,
                  M: facUnits.filter(u => ((u as any).size === 'M' || u.type === 'Medium') && (u.status === 'occupied' || (u.status as string) === 'rented')).length,
                  L: facUnits.filter(u => ((u as any).size === 'L' || u.type === 'Large') && (u.status === 'occupied' || (u.status as string) === 'rented')).length,
                  XL: facUnits.filter(u => ((u as any).size === 'XL' || u.type === 'Extra Large') && (u.status === 'occupied' || (u.status as string) === 'rented')).length,
                }

                return (
                  <div className="space-y-4">
                    {/* Thông tin cơ sở */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                        {lang === 'vi' ? 'Thông tin cơ sở' : 'Facility Information'}
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              {lang === 'vi' ? 'Mã cơ sở / Mã kho *' : 'Facility Code *'}
                            </label>
                            <input
                              type="text"
                              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                              value={formFacCode}
                              onChange={e => setFormFacCode(e.target.value.toUpperCase())}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              {lang === 'vi' ? 'Tỉnh / Thành phố *' : 'City / Province *'}
                            </label>
                            <input
                              type="text"
                              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                              value={formFacCity}
                              onChange={e => setFormFacCity(e.target.value)}
                            />
                          </div>
                        </div>

                        <Input
                          label={lang === 'vi' ? 'Tên cơ sở / Chi nhánh kho *' : 'Facility Name *'}
                          value={formFacName}
                          onChange={e => setFormFacName(e.target.value)}
                        />

                        <Input
                          label={lang === 'vi' ? 'Địa điểm / Địa chỉ chi tiết *' : 'Address *'}
                          value={formFacAddress}
                          onChange={e => setFormFacAddress(e.target.value)}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label={lang === 'vi' ? 'Người quản lý chi nhánh' : 'Manager'}
                            value={formFacManager}
                            onChange={e => setFormFacManager(e.target.value)}
                          />
                          <Input
                            label={lang === 'vi' ? 'Hotline liên hệ' : 'Phone'}
                            value={formFacPhone}
                            onChange={e => setFormFacPhone(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quy mô & phân bổ kho */}
                    {renderUnitAllocationSection(true, occMap)}

                    {/* Thông số vận hành */}
                    <div className="pt-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                        {lang === 'vi' ? 'Thông số vận hành' : 'Operation Settings'}
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label={lang === 'vi' ? 'Giá cơ sở từ' : 'Starting Price'}
                            value={formFacPrice}
                            onChange={e => setFormFacPrice(e.target.value)}
                          />
                          <Input
                            label={lang === 'vi' ? 'Khung giờ ra vào' : 'Access Hours'}
                            value={formFacAccessHours}
                            onChange={e => setFormFacAccessHours(e.target.value)}
                          />
                        </div>

                        <div>
                          <Select
                            label={lang === 'vi' ? 'Trạng thái hoạt động' : 'Status'}
                            value={formFacStatus}
                            onChange={e => setFormFacStatus(e.target.value as any)}
                          >
                            <option value="active">{lang === 'vi' ? 'Đang hoạt động (Active)' : 'Active'}</option>
                            <option value="maintenance">{lang === 'vi' ? 'Chuẩn bị khai trương / Bảo trì' : 'Maintenance'}</option>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Sticky footer */}
                    <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex justify-end items-center gap-2 z-10">
                      <Button variant="outline" onClick={() => setEditFacilityModal(false)}>
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                      </Button>
                      <Button
                        variant="primary"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        disabled={!formFacName.trim() || !formFacCode.trim() || formFacUnits <= 0}
                        onClick={handleUpdateFacility}
                      >
                        {lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes'}
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
      <Modal open={deleteFacilityModal} onClose={() => setDeleteFacilityModal(false)} title={lang === 'vi' ? 'Xác Nhận Xóa Cơ Sở' : 'Confirm Delete Facility'}>
        {selectedFacility && (
          <div className="space-y-4">
            {selectedFacility.occupied > 0 ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-base">
                  <span>⛔</span> CẢNH BÁO AN TOÀN HỢP ĐỒNG:
                </div>
                <p>
                  Cơ sở <b>{selectedFacility.name} ({selectedFacility.code || selectedFacility.id})</b> hiện đang có <b>{selectedFacility.occupied} gian kho có khách thuê hoạt động</b>.
                </p>
                <p className="text-xs text-red-600">
                  Hệ thống từ chối xóa cơ sở này để bảo vệ dữ liệu hợp đồng khách hàng và tính toàn vẹn tài chính.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Bạn có chắc chắn muốn xóa cơ sở <b className="text-slate-900">{selectedFacility.name}</b> khỏi hệ thống?
                </p>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 space-y-1">
                  <div><b>Mã cơ sở:</b> <span className="font-mono">{selectedFacility.code || selectedFacility.id}</span></div>
                  <div><b>Địa điểm:</b> {selectedFacility.address}, {selectedFacility.city}</div>
                  <div><b>Quy mô:</b> {selectedFacility.units} gian kho (Hiện không có khách thuê)</div>
                </div>
                <p className="text-xs text-slate-500">
                  Hành động này sẽ xóa cơ sở và toàn bộ các gian kho trống trực thuộc khỏi danh mục hệ thống.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setDeleteFacilityModal(false)}>
                {lang === 'vi' ? 'Đóng' : 'Cancel'}
              </Button>
              {selectedFacility.occupied === 0 && (
                <Button
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  onClick={handleDeleteFacility}
                >
                  {lang === 'vi' ? 'Xác Nhận Xóa Cơ Sở' : 'Delete Facility'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 4. Modal Chi Tiết Cơ Sở & Danh Mục Gian Kho Quy Hoạch */}
      <Modal open={viewFacilityModal} onClose={() => setViewFacilityModal(false)} title={lang === 'vi' ? 'Thông Tin Chi Tiết Cơ Sở' : 'Facility Details'} size="lg">
        {selectedFacility && (() => {
          const facCode = selectedFacility.code || selectedFacility.id;
          const facilityUnits = unitsList.filter(u => u.facilityId === selectedFacility.id || u.facilityId === facCode);
          const occupancyRate = selectedFacility.units ? Math.round((selectedFacility.occupied || 0) / selectedFacility.units * 100) : 0;

          return (
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
              {/* Header chi tiết cơ sở */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {facCode}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{selectedFacility.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">📍 {selectedFacility.address} · {selectedFacility.city}</p>
                </div>
                <Badge variant={selectedFacility.status === 'active' ? 'success' : 'warning'}>
                  {selectedFacility.status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (lang === 'vi' ? 'Bảo trì / Sắp mở' : 'Maintenance')}
                </Badge>
              </div>

              {/* Thông số kỹ thuật & Vận hành */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <span className="text-slate-400 block mb-0.5">Người quản lý:</span>
                  <b className="text-slate-800 block text-sm">{selectedFacility.manager}</b>
                  <span className="text-slate-500">{selectedFacility.phone || '1900 6868'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <span className="text-slate-400 block mb-0.5">Tỷ lệ lấp đầy:</span>
                  <b className="text-slate-800 block text-sm">{selectedFacility.occupied || 0} / {selectedFacility.units} kho</b>
                  <span className="text-emerald-700 font-semibold">{occupancyRate}% công suất</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <span className="text-slate-400 block mb-0.5">Doanh thu tháng (MTD):</span>
                  <b className="text-slate-800 block text-sm">{formatCurrency(selectedFacility.revenue || 0)}</b>
                  <span className="text-slate-500">{selectedFacility.price}/tháng từ</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <span className="text-slate-400 block mb-0.5">Giờ hoạt động:</span>
                  <b className="text-slate-800 block text-xs">{selectedFacility.accessHours || '06:00 - 22:00'}</b>
                  <span className="text-slate-500">Kho tự quản tiêu chuẩn</span>
                </div>
              </div>

              {/* Bảng phân bổ các gian kho thuộc cơ sở (S, M, L, XL) */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="bg-stone-50 px-3 py-2 border-b border-stone-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">
                    📐 Danh Mục Gian Kho Thuộc Cơ Sở ({facilityUnits.length || selectedFacility.units} kho quy hoạch)
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">Chuẩn S, M, L, XL</span>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-100 text-slate-700 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="p-2.5">Phân loại</th>
                      <th className="p-2.5">Kích thước D×R×C</th>
                      <th className="p-2.5">Thể tích</th>
                      <th className="p-2.5">Số lượng</th>
                      <th className="p-2.5">Đang thuê</th>
                      <th className="p-2.5">Còn trống</th>
                      <th className="p-2.5">Đơn giá / tháng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(['S', 'M', 'L', 'XL'] as const).map(size => {
                      const spec = UNIT_SPECS[size];
                      const unitsOfSize = facilityUnits.filter(u => ((u as any).size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : 'XL')) === size);
                      const totalSize = facilityUnits.length > 0
                        ? unitsOfSize.length
                        : (selectedFacility.unitDistribution?.[size] ?? 0);
                      const occupiedSize = unitsOfSize.filter(u => u.status === 'occupied').length;
                      const availableSize = unitsOfSize.filter(u => u.status === 'available').length || Math.max(0, totalSize - occupiedSize);

                      return (
                        <tr key={size} className="hover:bg-amber-50/50">
                          <td className="p-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded font-mono text-xs font-bold ${
                              size === 'S' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                              size === 'M' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              size === 'L' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {size} · {spec.name}
                            </span>
                          </td>
                          <td className="p-2.5 font-medium text-slate-700">{spec.dimensions}</td>
                          <td className="p-2.5 text-slate-600">{spec.volumeM3} m³</td>
                          <td className="p-2.5 font-bold text-slate-800">{totalSize} kho</td>
                          <td className="p-2.5 text-blue-700 font-semibold">{occupiedSize} kho</td>
                          <td className="p-2.5 text-emerald-700 font-semibold">{availableSize} kho</td>
                          <td className="p-2.5 font-mono font-bold text-emerald-800">{spec.priceFormatted}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-stone-50 border-t border-stone-200 font-semibold text-slate-800">
                    <tr>
                      <td colSpan={3} className="p-2.5 font-bold">Tổng cộng</td>
                      <td className="p-2.5 font-bold text-amber-800">{selectedFacility.units} kho</td>
                      <td className="p-2.5 text-blue-700 font-bold">{selectedFacility.occupied || 0} kho</td>
                      <td className="p-2.5 text-emerald-700 font-bold">{Math.max(0, (selectedFacility.units || 0) - (selectedFacility.occupied || 0))} kho</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button variant="outline" onClick={() => setViewFacilityModal(false)}>
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

    </Layout>
  )
}
