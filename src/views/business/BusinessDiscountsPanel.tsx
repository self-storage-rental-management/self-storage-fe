import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, Select, Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import { isApiAuthenticated } from '../../services/authApi'
import {
  createDiscountCode,
  deleteDiscountCode,
  inactiveDiscountCode,
  listDiscountCodes,
  publishDiscountCode,
  updateDiscountCode,
  type DiscountCodeApi,
  type DiscountCodeInput,
  type DiscountPublicationStatus,
  type DiscountRuntimeStatus,
  type DiscountScope,
  type DiscountType,
} from '../../services/discountApi'
import type { User } from '../../types'
import { notifyBell } from '../../services/notificationApi'

interface Props {
  user: User
  lang?: string
  facilitiesList: Array<{ id: string; name: string; code?: string }>
}

const scopeLabels: Record<DiscountScope, { vi: string; en: string }> = {
  GLOBAL: { vi: 'Toàn hệ thống', en: 'Global' },
  FACILITY: { vi: 'Theo cơ sở', en: 'Facility' },
  POLICY: { vi: 'Theo chính sách', en: 'Policy' },
}

const runtimeBadgeVariant = (status: DiscountRuntimeStatus): 'muted' | 'info' | 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'SCHEDULED':
      return 'info'
    case 'EXPIRED':
      return 'error'
    case 'INACTIVE':
      return 'warning'
    case 'DRAFT':
    default:
      return 'muted'
  }
}

const runtimeLabels: Record<DiscountRuntimeStatus, { vi: string; en: string }> = {
  DRAFT: { vi: 'Bản nháp', en: 'Draft' },
  SCHEDULED: { vi: 'Lên lịch tương lai', en: 'Scheduled' },
  ACTIVE: { vi: 'Đang hiệu lực', en: 'Active' },
  EXPIRED: { vi: 'Đã hết hạn', en: 'Expired' },
  INACTIVE: { vi: 'Tạm dừng', en: 'Inactive' },
}

export default function BusinessDiscountsPanel({ user, lang = 'vi', facilitiesList }: Props) {
  const isVi = lang === 'vi'

  // User facility restriction check
  const allowedFacilityId = user.facilityId || undefined
  const isRestrictedToFacility = !!allowedFacilityId
  const displayFacilities = useMemo(() => {
    if (allowedFacilityId) {
      return facilitiesList.filter(f => f.id === allowedFacilityId)
    }
    return facilitiesList
  }, [facilitiesList, allowedFacilityId])

  // Filters
  const [selectedFacility, setSelectedFacility] = useState<string>(allowedFacilityId || 'all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Data & loading
  const [discounts, setDiscounts] = useState<DiscountCodeApi[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const showToast = (msg: string) => {
    notifyBell({
      title: isVi ? 'Khuyến mãi & Voucher' : 'Discount Codes',
      message: msg,
      page: 'discounts',
      date: new Date().toISOString()
    })
  }

  const fetchDiscounts = async () => {
    if (!isApiAuthenticated()) return
    setLoading(true)
    try {
      const facilityIdParam = selectedFacility !== 'all' ? selectedFacility : allowedFacilityId
      const data = await listDiscountCodes(facilityIdParam)
      setDiscounts(data)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể tải danh sách khuyến mãi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDiscounts()
  }, [selectedFacility])

  // Filtered in-memory
  const filteredDiscounts = useMemo(() => {
    return discounts.filter(d => {
      if (statusFilter !== 'all' && d.runtimeStatus !== statusFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.facilityName && d.facilityName.toLowerCase().includes(q))
      )
    })
  }, [discounts, statusFilter, searchQuery])

  // Stats
  const stats = useMemo(() => {
    const total = discounts.length
    const active = discounts.filter(d => d.runtimeStatus === 'ACTIVE').length
    const totalUses = discounts.reduce((sum, d) => sum + (d.currentUses || 0), 0)
    const maxUsesTotal = discounts.reduce((sum, d) => sum + (d.maxUses || 0), 0)
    return { total, active, totalUses, maxUsesTotal }
  }, [discounts])

  // Form Modal States
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DiscountCodeApi | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formScope, setFormScope] = useState<DiscountScope>('GLOBAL')
  const [formFacilityId, setFormFacilityId] = useState<string>('')
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [formDiscountValue, setFormDiscountValue] = useState<number>(10)
  const [formEffectiveFrom, setFormEffectiveFrom] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [formEffectiveTo, setFormEffectiveTo] = useState<string>('')
  const [formMaxUses, setFormMaxUses] = useState<string>('')
  const [formPublishAction, setFormPublishAction] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED')
  const [submitting, setSubmitting] = useState(false)

  const handleOpenCreate = () => {
    setEditingItem(null)
    setFormCode('')
    setFormName('')
    setFormDesc('')
    setFormScope(isRestrictedToFacility ? 'FACILITY' : 'GLOBAL')
    setFormFacilityId(allowedFacilityId || (displayFacilities[0]?.id ?? ''))
    setFormDiscountType('PERCENTAGE')
    setFormDiscountValue(10)
    setFormEffectiveFrom(new Date().toISOString().slice(0, 10))
    setFormEffectiveTo('')
    setFormMaxUses('')
    setFormPublishAction('PUBLISHED')
    setModalOpen(true)
  }

  const handleOpenEdit = (item: DiscountCodeApi) => {
    if (item.publicationStatus === 'PUBLISHED') {
      showToast(isVi
        ? 'Cấu hình đã xuất bản không được sửa trực tiếp. Vui lòng bấm [Tạm dừng] trước khi chỉnh sửa!'
        : 'Published configuration cannot be edited directly. Pause (INACTIVE) first!')
      return
    }
    setEditingItem(item)
    setFormCode(item.code)
    setFormName(item.name)
    setFormDesc(item.description || '')
    setFormScope(item.scope)
    setFormFacilityId(item.facilityId || (displayFacilities[0]?.id ?? ''))
    setFormDiscountType(item.discountType)
    setFormDiscountValue(Number(item.discountValue))
    setFormEffectiveFrom(item.effectiveFrom)
    setFormEffectiveTo(item.effectiveTo || '')
    setFormMaxUses(item.maxUses != null ? String(item.maxUses) : '')
    setFormPublishAction(item.publicationStatus === 'DRAFT' ? 'DRAFT' : 'PUBLISHED')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formCode.trim()) {
      showToast(isVi ? 'Vui lòng nhập mã voucher (ví dụ: HELLO2026).' : 'Please enter discount code.')
      return
    }
    if (!formName.trim()) {
      showToast(isVi ? 'Vui lòng nhập tên chương trình ưu đãi.' : 'Please enter promotion name.')
      return
    }
    if (formScope === 'FACILITY' && !formFacilityId) {
      showToast(isVi ? 'Vui lòng chọn cơ sở áp dụng.' : 'Please select facility.')
      return
    }
    if (formDiscountValue <= 0) {
      showToast(isVi ? 'Giá trị giảm giá phải lớn hơn 0.' : 'Discount value must be > 0.')
      return
    }
    if (formDiscountType === 'PERCENTAGE' && formDiscountValue > 100) {
      showToast(isVi ? 'Chiết khấu phần trăm không được vượt quá 100%.' : 'Percentage discount cannot exceed 100%.')
      return
    }

    setSubmitting(true)
    try {
      const payload: DiscountCodeInput = {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        description: formDesc.trim() || null,
        scope: formScope,
        facilityId: formScope === 'FACILITY' ? formFacilityId : null,
        discountType: formDiscountType,
        discountValue: formDiscountValue,
        effectiveFrom: formEffectiveFrom,
        effectiveTo: formEffectiveTo.trim() || null,
        publicationStatus: formPublishAction,
        maxUses: formMaxUses.trim() ? parseInt(formMaxUses, 10) : null,
      }

      if (editingItem) {
        await updateDiscountCode(editingItem.id, payload)
        showToast(isVi ? `Đã cập nhật mã ưu đãi [${payload.code}]!` : 'Discount updated!')
      } else {
        await createDiscountCode(payload)
        showToast(isVi ? `Đã tạo mã ưu đãi [${payload.code}] thành công!` : 'Discount created!')
      }
      setModalOpen(false)
      await fetchDiscounts()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi lưu mã ưu đãi.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async (item: DiscountCodeApi) => {
    try {
      await publishDiscountCode(item.id)
      showToast(isVi ? `Đã xuất bản mã [${item.code}]!` : `Published code [${item.code}]!`)
      await fetchDiscounts()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xuất bản mã.')
    }
  }

  const handleInactive = async (item: DiscountCodeApi) => {
    try {
      await inactiveDiscountCode(item.id)
      showToast(isVi ? `Đã chuyển mã [${item.code}] sang TẠM DỪNG (INACTIVE). Bây giờ bạn có thể chỉnh sửa!` : `Inactivated code [${item.code}]!`)
      await fetchDiscounts()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể tạm dừng mã.')
    }
  }

  const handleDelete = async (item: DiscountCodeApi) => {
    if (!window.confirm(isVi ? `Bạn có chắc muốn xóa mã [${item.code}]?` : `Delete code [${item.code}]?`)) return
    try {
      await deleteDiscountCode(item.id)
      showToast(isVi ? `Đã xóa mã [${item.code}]!` : 'Discount deleted!')
      await fetchDiscounts()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xóa mã.')
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
    showToast(isVi ? `Đã sao chép mã [${code}] vào clipboard!` : `Copied [${code}]!`)
  }

  return (
    <div className="space-y-6 fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <span>🏷️</span>
            {isVi ? 'Chiến Dịch Khuyến Mãi & Voucher' : 'Discount Codes & Promotions'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {isVi
              ? 'Quản lý mã giảm giá booking, phạm vi áp dụng (Toàn hệ thống/Cơ sở/Gói) và vòng đời cấu hình xuất bản.'
              : 'Configure booking discount codes, scope levels (Global/Facility/Policy), and publication lifecycle.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDiscounts} disabled={loading}>
            🔄 {isVi ? 'Làm mới' : 'Refresh'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            ➕ {isVi ? 'Tạo Mã Giảm Giá Mới' : 'Create Discount'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-stone-200 bg-white">
          <div className="text-xs text-stone-500 font-medium">{isVi ? 'Tổng số chiến dịch' : 'Total Campaigns'}</div>
          <div className="text-2xl font-bold text-stone-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">{isVi ? 'Tất cả trạng thái' : 'All statuses'}</div>
        </Card>
        <Card className="p-4 border border-emerald-200 bg-emerald-50/50">
          <div className="text-xs text-emerald-800 font-medium">{isVi ? 'Đang hiệu lực (Active)' : 'Active Now'}</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{stats.active}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">{isVi ? 'Khách hàng có thể nhập' : 'Customer redeemable'}</div>
        </Card>
        <Card className="p-4 border border-blue-200 bg-blue-50/50">
          <div className="text-xs text-blue-800 font-medium">{isVi ? 'Lượt áp dụng thành công' : 'Total Redemptions'}</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{stats.totalUses}</div>
          <div className="text-[11px] text-blue-700 mt-0.5">{isVi ? 'Số booking đã dùng mã' : 'Redeemed bookings'}</div>
        </Card>
        <Card className="p-4 border border-purple-200 bg-purple-50/50">
          <div className="text-xs text-purple-800 font-medium">{isVi ? 'Quy tắc khấu trừ' : 'Deduction Cascade'}</div>
          <div className="text-sm font-bold text-purple-900 mt-2">Áp dụng sau gói kỳ hạn</div>
          <div className="text-[11px] text-purple-700 mt-0.5">{isVi ? 'Không giảm tiền cọc giữ kho' : 'No discount on deposit'}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 border border-stone-200 bg-stone-50/70">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              {isVi ? 'Cơ sở' : 'Facility'}
            </label>
            <select
              value={selectedFacility}
              onChange={e => setSelectedFacility(e.target.value)}
              disabled={isRestrictedToFacility}
              className="w-full text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-amber-500"
            >
              {!isRestrictedToFacility && <option value="all">{isVi ? 'Toàn bộ cơ sở' : 'All Facilities'}</option>}
              {displayFacilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              {isVi ? 'Trạng thái hiệu lực' : 'Runtime Status'}
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">{isVi ? 'Tất cả trạng thái' : 'All Statuses'}</option>
              {(Object.keys(runtimeLabels) as DiscountRuntimeStatus[]).map(st => (
                <option key={st} value={st}>{runtimeLabels[st][isVi ? 'vi' : 'en']}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              {isVi ? 'Tìm kiếm' : 'Search'}
            </label>
            <input
              type="text"
              placeholder={isVi ? 'Tìm mã code, tên chiến dịch...' : 'Search voucher code, name...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-lg px-3 py-1.5 bg-white focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="border border-stone-200 overflow-hidden bg-white shadow-sm">
        <Table>
          <Thead>
            <Tr>
              <Th className="text-xs py-3 px-3">{isVi ? 'Mã Voucher' : 'Code'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Tên chương trình' : 'Name & Description'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Phạm vi' : 'Scope'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Mức giảm' : 'Value'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Thời gian áp dụng' : 'Validity'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Đã dùng' : 'Usage'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Trạng thái' : 'Status'}</Th>
              <Th className="text-xs py-3 px-3 text-right">{isVi ? 'Thao tác' : 'Actions'}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr>
                <Td colSpan={8} className="text-center py-8 text-stone-400 text-sm">
                  {isVi ? 'Đang tải dữ liệu...' : 'Loading discounts...'}
                </Td>
              </Tr>
            ) : filteredDiscounts.length === 0 ? (
              <Tr>
                <Td colSpan={8} className="text-center py-8 text-stone-400 text-sm">
                  {isVi ? 'Chưa có mã giảm giá nào phù hợp.' : 'No discount codes found.'}
                </Td>
              </Tr>
            ) : (
              filteredDiscounts.map(d => {
                const isPublished = d.publicationStatus === 'PUBLISHED'
                const isDraft = d.publicationStatus === 'DRAFT'
                const isInactive = d.publicationStatus === 'INACTIVE'
                const badgeVariant = runtimeBadgeVariant(d.runtimeStatus)
                const isExpired = d.runtimeStatus === 'EXPIRED'

                return (
                  <Tr key={d.id} className="hover:bg-stone-50/70 transition border-b border-stone-100">
                    <Td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyCode(d.code)}
                          className="font-mono font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded cursor-pointer transition"
                          title={isVi ? 'Bấm để copy mã' : 'Click to copy code'}
                        >
                          {d.code}
                        </button>
                      </div>
                    </Td>
                    <Td className="py-3 px-3">
                      <div className="font-semibold text-xs text-stone-900">{d.name}</div>
                      {d.description && (
                        <div className="text-[11px] text-stone-500 line-clamp-1">{d.description}</div>
                      )}
                    </Td>
                    <Td className="py-3 px-3 text-xs">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        d.scope === 'GLOBAL' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        d.scope === 'FACILITY' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-purple-50 text-purple-800 border border-purple-200'
                      }`}>
                        {scopeLabels[d.scope]?.[isVi ? 'vi' : 'en'] || d.scope}
                      </span>
                      {d.facilityName && (
                        <div className="text-[10px] text-stone-500 mt-0.5 truncate max-w-[120px]">{d.facilityName}</div>
                      )}
                    </Td>
                    <Td className="py-3 px-3 font-mono font-bold text-xs text-emerald-700">
                      {d.discountType === 'PERCENTAGE' ? `-${d.discountValue}%` : `-${formatVnd(d.discountValue)}`}
                    </Td>
                    <Td className="py-3 px-3 text-xs text-stone-600">
                      <div>{d.effectiveFrom}</div>
                      {d.effectiveTo ? (
                        <div className="text-[10px] text-stone-400">đến {d.effectiveTo}</div>
                      ) : (
                        <div className="text-[10px] text-emerald-600">Vô thời hạn</div>
                      )}
                    </Td>
                    <Td className="py-3 px-3 text-xs">
                      <span className="font-bold text-stone-900">{d.currentUses}</span>
                      <span className="text-stone-400">/{d.maxUses != null ? d.maxUses : '∞'}</span>
                    </Td>
                    <Td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={badgeVariant}>
                          {runtimeLabels[d.runtimeStatus]?.[isVi ? 'vi' : 'en'] || d.runtimeStatus}
                        </Badge>
                        <span className="text-[9px] text-stone-400">
                          [{d.publicationStatus}]
                        </span>
                      </div>
                    </Td>
                    <Td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Publish / Inactive lifecycle buttons */}
                        {isPublished ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-700 border-amber-300 hover:bg-amber-50 text-[11px] py-1 px-2"
                            onClick={() => handleInactive(d)}
                            title={isVi ? 'Chuyển về INACTIVE để có thể chỉnh sửa' : 'Pause configuration to allow edits'}
                          >
                            ⏸️ {isVi ? 'Tạm dừng' : 'Pause'}
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] py-1 px-2"
                            onClick={() => handlePublish(d)}
                            title={isVi ? 'Xuất bản mã này' : 'Publish configuration'}
                          >
                            🚀 {isVi ? 'Xuất bản' : 'Publish'}
                          </Button>
                        )}

                        {/* Edit button */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPublished}
                          className={`text-[11px] py-1 px-2 ${
                            isPublished
                              ? 'opacity-40 cursor-not-allowed text-stone-400 border-stone-200'
                              : 'text-stone-700 hover:bg-stone-100'
                          }`}
                          onClick={() => handleOpenEdit(d)}
                          title={isPublished ? (isVi ? 'Phải chuyển sang INACTIVE trước khi sửa!' : 'Must inactivate first!') : ''}
                        >
                          ✏️ {isVi ? 'Sửa' : 'Edit'}
                        </Button>

                        {/* Delete button (only if not active/published) */}
                        {!isPublished && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 text-[11px] py-1 px-2"
                            onClick={() => handleDelete(d)}
                          >
                            🗑️
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>
      </Card>

      {/* Modal: Create / Edit Discount */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingItem ? (isVi ? 'Chỉnh Sửa Mã Khuyến Mãi' : 'Edit Discount Code') : (isVi ? 'Tạo Mã Khuyến Mãi Mới' : 'Create New Discount Code')}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Mã ưu đãi (Voucher Code) *' : 'Voucher Code *'}
                </label>
                <Input
                  placeholder="VD: CHAOHEXUAN, VIP2026..."
                  value={formCode}
                  onChange={e => setFormCode(e.target.value.toUpperCase())}
                  disabled={!!editingItem}
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Tên chương trình ưu đãi *' : 'Promotion Name *'}
                </label>
                <Input
                  placeholder="VD: Tri ân khách hàng mới 2026..."
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Mô tả chi tiết' : 'Description'}
              </label>
              <textarea
                rows={2}
                placeholder="VD: Giảm ngay 10% trên tổng tiền thuê sau chiết khấu kỳ hạn..."
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-2 bg-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Phạm vi áp dụng (Scope) *' : 'Application Scope *'}
                </label>
                <select
                  value={formScope}
                  onChange={e => setFormScope(e.target.value as DiscountScope)}
                  disabled={isRestrictedToFacility}
                  className="w-full border border-stone-300 rounded-lg p-2 bg-white"
                >
                  {!isRestrictedToFacility && <option value="GLOBAL">{isVi ? 'Toàn hệ thống (GLOBAL)' : 'Global'}</option>}
                  <option value="FACILITY">{isVi ? 'Theo cơ sở (FACILITY)' : 'Specific Facility'}</option>
                  <option value="POLICY">{isVi ? 'Theo gói thuê (POLICY)' : 'Specific Policy'}</option>
                </select>
                {isRestrictedToFacility && (
                  <span className="text-[10px] text-amber-700 mt-0.5 block">
                    {isVi ? 'Bạn bị giới hạn phạm vi cơ sở được phân quyền.' : 'Restricted to your assigned facility.'}
                  </span>
                )}
              </div>

              {formScope === 'FACILITY' && (
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    {isVi ? 'Cơ sở áp dụng *' : 'Facility *'}
                  </label>
                  <select
                    value={formFacilityId}
                    onChange={e => setFormFacilityId(e.target.value)}
                    disabled={isRestrictedToFacility}
                    className="w-full border border-stone-300 rounded-lg p-2 bg-white"
                  >
                    {displayFacilities.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Loại chiết khấu *' : 'Discount Type *'}
                </label>
                <select
                  value={formDiscountType}
                  onChange={e => setFormDiscountType(e.target.value as DiscountType)}
                  className="w-full border border-stone-300 rounded-lg p-2 bg-white"
                >
                  <option value="PERCENTAGE">{isVi ? 'Phần trăm (%)' : 'Percentage (%)'}</option>
                  <option value="FIXED_AMOUNT">{isVi ? 'Số tiền cố định (VNĐ)' : 'Fixed Amount (VND)'}</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {formDiscountType === 'PERCENTAGE' ? (isVi ? 'Tỷ lệ giảm (%) *' : 'Rate (%) *') : (isVi ? 'Số tiền giảm (VNĐ) *' : 'Amount (VND) *')}
                </label>
                <Input
                  type="number"
                  min="1"
                  max={formDiscountType === 'PERCENTAGE' ? '100' : undefined}
                  value={formDiscountValue.toString()}
                  onChange={e => setFormDiscountValue(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Ngày bắt đầu hiệu lực *' : 'Effective From *'}
                </label>
                <input
                  type="date"
                  value={formEffectiveFrom}
                  onChange={e => setFormEffectiveFrom(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg p-2 bg-white text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Ngày kết thúc (Tùy chọn)' : 'Effective To (Optional)'}
                </label>
                <input
                  type="date"
                  value={formEffectiveTo}
                  onChange={e => setFormEffectiveTo(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg p-2 bg-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Giới hạn số lượt dùng (Tùy chọn)' : 'Max Redemptions'}
                </label>
                <Input
                  type="number"
                  placeholder={isVi ? 'Để trống = không giới hạn' : 'Unlimited if empty'}
                  value={formMaxUses}
                  onChange={e => setFormMaxUses(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Trạng thái khi lưu *' : 'Publication Status *'}
                </label>
                <select
                  value={formPublishAction}
                  onChange={e => setFormPublishAction(e.target.value as 'DRAFT' | 'PUBLISHED')}
                  className="w-full border border-stone-300 rounded-lg p-2 bg-white"
                >
                  <option value="PUBLISHED">{isVi ? 'Xuất bản ngay (PUBLISHED)' : 'Publish immediately'}</option>
                  <option value="DRAFT">{isVi ? 'Lưu nháp (DRAFT)' : 'Save as Draft'}</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                {isVi ? 'Hủy' : 'Cancel'}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={submitting}>
                {submitting ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Lưu cấu hình' : 'Save')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
