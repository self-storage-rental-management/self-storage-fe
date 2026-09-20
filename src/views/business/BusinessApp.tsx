import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'
import Layout, { getInitialPage, Icon } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Tabs, ProgressBar, Input, Select } from '../../components/ui'
import type { User } from '../../types'
import { FACILITIES, REVENUE_TREND, CONVERSION_DATA, PRICING_TIERS, DISCOUNTS, POLICIES, FEES, type PromotionItem } from "../../data/demoDatabase"
import { useLanguage } from '../../i18n/LanguageContext'
import ProfileView from '../ProfileView'


export default function BusinessApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang, formatCurrency } = useLanguage()

  const NAV = [
    { id: 'facilities', label: lang === 'vi' ? 'Tổng quan cơ sở' : 'Facilities Overview', icon: Icon.building, group: lang === 'vi' ? 'Danh mục' : 'Portfolio' },
    { id: 'performance', label: lang === 'vi' ? 'Hiệu suất vận hành' : 'Performance Reports', icon: Icon.eye, group: lang === 'vi' ? 'Danh mục' : 'Portfolio' },
    { id: 'policies', label: lang === 'vi' ? 'Chính sách thuê' : 'Rental Policies', icon: Icon.policy, group: lang === 'vi' ? 'Thương mại' : 'Commercial' },
    { id: 'pricing', label: lang === 'vi' ? 'Bảng giá & Phí' : 'Pricing & Fees', icon: Icon.dollar, group: lang === 'vi' ? 'Thương mại' : 'Commercial' },
    { id: 'discounts', label: lang === 'vi' ? 'Khuyến mãi & Voucher' : 'Discounts & Promotions', icon: Icon.tag, group: lang === 'vi' ? 'Thương mại' : 'Commercial' },
    { id: 'revenue', label: lang === 'vi' ? 'Báo cáo doanh thu' : 'Revenue Reports', icon: Icon.chart, group: lang === 'vi' ? 'Báo cáo' : 'Reporting' },
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

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const totalRevenue = FACILITIES.reduce((s, f) => s + f.revenue, 0)
  const totalUnits = FACILITIES.reduce((s, f) => s + f.units, 0)
  const totalOccupied = FACILITIES.reduce((s, f) => s + f.occupied, 0)

  return (
    <Layout
      user={user} navItems={NAV} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      roleLabel={lang === 'vi' ? 'Giám Đốc Thương Mại' : 'Business Manager'} roleColor="bg-amber-100 text-amber-700"
    >
      {/* ── FACILITIES OVERVIEW ───────────────────────────────── */}
      {page === 'facilities' && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title={lang === 'vi' ? 'Tổng Quan Danh Mục Cơ Sở' : 'Facilities Overview'}
            subtitle={lang === 'vi' ? `${FACILITIES.length} cơ sở trong mạng lưới toàn hệ thống` : `${FACILITIES.length} ${FACILITIES.length === 1 ? 'facility' : 'facilities'} in the portfolio`}
            action={<Button variant="primary" size="sm" onClick={() => showToast(lang === 'vi' ? 'Chức năng thêm cơ sở mới đang được xử lý.' : 'Facility creation dialog.')}>{Icon.plus} {lang === 'vi' ? 'Thêm Cơ Sở' : 'Add Facility'}</Button>}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={lang === 'vi' ? 'Tổng số địa điểm' : 'Total Locations'} value={FACILITIES.length} icon={Icon.building} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Tổng số gian kho' : 'Total Units'} value={totalUnits} icon={Icon.box} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Tỷ lệ lấp đầy TB' : 'Portfolio Occupancy'} value={`${totalUnits ? Math.round(totalOccupied / totalUnits * 100) : 0}%`} icon={Icon.chart} iconBg="bg-green-50" />
            <StatCard title={lang === 'vi' ? 'Doanh thu tháng (MTD)' : 'Total Revenue MTD'} value={formatCurrency(totalRevenue)} icon={Icon.dollar} iconBg="bg-amber-50" />
          </div>
          <div className="space-y-4">
            {FACILITIES.map(f => (
              <Card key={f.id} className="p-5">
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900">{f.name}</h3>
                      <Badge variant={f.status === 'active' ? 'success' : 'warning'}>
                        {f.status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (lang === 'vi' ? 'Sắp khai trương' : 'Opening Soon')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">{f.city} · {lang === 'vi' ? 'Quản lý' : 'Manager'}: {f.manager}</p>
                    {f.status === 'active' && (
                      <div className="mt-3 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-slate-400">{lang === 'vi' ? 'Tỷ lệ lấp đầy' : 'Occupancy'}</p>
                          <p className="font-semibold text-slate-800">{f.occupied}/{f.units} <span className="text-slate-400 text-xs">({Math.round(f.occupied / f.units * 100)}%)</span></p>
                          <ProgressBar value={f.occupied} max={f.units} color="bg-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{lang === 'vi' ? 'Doanh thu tháng' : 'Revenue MTD'}</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(f.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{lang === 'vi' ? 'Tăng trưởng MoM' : 'Growth MoM'}</p>
                          <p className={`font-semibold ${f.growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {f.growth >= 0 ? '+' : ''}{f.growth}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? `Xem chi tiết cơ sở ${f.name}` : `View details for ${f.name}`)}>
                      {lang === 'vi' ? 'Chi tiết' : 'View Details'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

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
            title={lang === 'vi' ? 'Báo Cáo Phân Tích Doanh Thu' : 'Revenue Reports'}
            subtitle={REVENUE_TREND.length ? (lang === 'vi' ? `Hiệu quả doanh thu chu kỳ ${REVENUE_TREND[0].month}–${REVENUE_TREND[REVENUE_TREND.length - 1].month}` : `${REVENUE_TREND[0].month}–${REVENUE_TREND[REVENUE_TREND.length - 1].month} revenue performance`) : 'Revenue period unavailable'}
            action={<Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã xuất dữ liệu doanh thu!' : 'Exported revenue file!')}>{lang === 'vi' ? 'Xuất báo cáo' : 'Export'}</Button>}
          />
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
    </Layout>
  )
}
