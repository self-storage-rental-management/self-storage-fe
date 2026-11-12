import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  SectionHeader,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import LocalizedDateInput from '../../components/LocalizedDateInput'
import { formatVndAmount } from '../../i18n/currency'
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

interface Props {
  lang?: string
  facilitiesList: Array<{ id: string; name: string; code?: string }>
  showToast: (msg: string) => void
}

const RUNTIME_BADGE: Record<DiscountRuntimeStatus, { label: string; variant: 'muted' | 'info' | 'success' | 'warning' | 'error' }> = {
  DRAFT: { label: 'Bản nháp', variant: 'muted' },
  SCHEDULED: { label: 'Chờ hiệu lực', variant: 'info' },
  ACTIVE: { label: 'Đang áp dụng', variant: 'success' },
  EXPIRED: { label: 'Hết hạn', variant: 'warning' },
  INACTIVE: { label: 'Ngừng áp dụng', variant: 'error' },
}

const SCOPE_LABELS: Record<DiscountScope, string> = {
  GLOBAL: 'Toàn hệ thống',
  FACILITY: 'Theo cơ sở',
  POLICY: 'Theo chính sách / gói',
}

function toLocalInputDateTime(iso?: string | null) {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function toBackendInstant(dateValue: string, endOfDay = false) {
  if (!dateValue.trim()) return ''
  if (dateValue.includes('T')) return dateValue
  return endOfDay ? `${dateValue}T23:59:59Z` : `${dateValue}T00:00:00Z`
}

export default function BusinessDiscountCodesPanel({ lang = 'vi', facilitiesList, showToast }: Props) {
  const isVi = lang === 'vi'
  const [items, setItems] = useState<DiscountCodeApi[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facilityFilter, setFacilityFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DiscountRuntimeStatus>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DiscountCodeApi | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DiscountCodeApi | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<DiscountScope>('GLOBAL')
  const [facilityId, setFacilityId] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('10')
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [effectiveTo, setEffectiveTo] = useState('')
  const [publicationStatus, setPublicationStatus] = useState<DiscountPublicationStatus>('PUBLISHED')
  const [maxUses, setMaxUses] = useState('')

  const reload = useCallback(async () => {
    if (!isApiAuthenticated()) return
    setLoading(true)
    setError(null)
    try {
      const data = await listDiscountCodes(facilityFilter !== 'all' ? facilityFilter : undefined)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách mã giảm giá.')
    } finally {
      setLoading(false)
    }
  }, [facilityFilter])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(item => {
      if (statusFilter !== 'all' && item.runtimeStatus !== statusFilter) return false
      if (!q) return true
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.facilityName || '').toLowerCase().includes(q)
      )
    })
  }, [items, search, statusFilter])

  const openCreateModal = () => {
    setEditingItem(null)
    setCode('')
    setName('')
    setDescription('')
    setScope('GLOBAL')
    setFacilityId(facilitiesList[0]?.id || '')
    setPolicyId('')
    setDiscountType('PERCENTAGE')
    setDiscountValue('10')
    setEffectiveFrom(new Date().toISOString().slice(0, 10))
    setEffectiveTo('')
    setPublicationStatus('PUBLISHED')
    setMaxUses('')
    setModalOpen(true)
  }

  const openEditModal = (item: DiscountCodeApi) => {
    setEditingItem(item)
    setCode(item.code)
    setName(item.name)
    setDescription(item.description || '')
    setScope(item.scope)
    setFacilityId(item.facilityId || facilitiesList[0]?.id || '')
    setPolicyId(item.policyId || '')
    setDiscountType(item.discountType)
    setDiscountValue(String(item.discountValue))
    setEffectiveFrom(toLocalInputDateTime(item.effectiveFrom))
    setEffectiveTo(toLocalInputDateTime(item.effectiveTo))
    setPublicationStatus(item.publicationStatus)
    setMaxUses(item.maxUses != null ? String(item.maxUses) : '')
    setModalOpen(true)
  }

  const handleSave = async () => {
    const cleanCode = code.trim().toUpperCase()
    const numericVal = Number(discountValue)
    const numericMaxUses = maxUses.trim() ? Number(maxUses.trim()) : null
    if (!cleanCode || !name.trim() || !effectiveFrom.trim()) {
      showToast('Vui lòng nhập đầy đủ mã voucher, tên chương trình và ngày hiệu lực.')
      return
    }
    if (!Number.isFinite(numericVal) || numericVal <= 0) {
      showToast('Giá trị giảm phải lớn hơn 0.')
      return
    }
    if (discountType === 'PERCENTAGE' && numericVal > 100) {
      showToast('Giảm theo phần trăm không được vượt quá 100%.')
      return
    }
    if (scope === 'FACILITY' && !facilityId) {
      showToast('Vui lòng chọn cơ sở áp dụng cho voucher theo cơ sở.')
      return
    }
    if (numericMaxUses !== null && (!Number.isSafeInteger(numericMaxUses) || numericMaxUses <= 0)) {
      showToast('Giới hạn lượt sử dụng phải là số nguyên dương.')
      return
    }

    const input: DiscountCodeInput = {
      code: cleanCode,
      name: name.trim(),
      description: description.trim() || null,
      scope,
      facilityId: scope === 'FACILITY' ? facilityId : null,
      policyId: scope === 'POLICY' && policyId.trim() ? policyId.trim() : null,
      discountType,
      discountValue: numericVal,
      effectiveFrom: toBackendInstant(effectiveFrom, false),
      effectiveTo: effectiveTo.trim() ? toBackendInstant(effectiveTo, true) : null,
      publicationStatus,
      maxUses: numericMaxUses,
    }

    setSaving(true)
    try {
      if (editingItem) {
        await updateDiscountCode(editingItem.id, input)
        showToast(`Đã cập nhật voucher ${cleanCode}.`)
      } else {
        await createDiscountCode(input)
        showToast(`Đã tạo mới voucher ${cleanCode}.`)
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể lưu mã giảm giá.')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePublication = async (item: DiscountCodeApi) => {
    try {
      if (item.publicationStatus === 'PUBLISHED') {
        await inactiveDiscountCode(item.id)
        showToast(`Đã tạm ngừng áp dụng voucher ${item.code}.`)
      } else {
        await publishDiscountCode(item.id)
        showToast(`Đã kích hoạt voucher ${item.code}.`)
      }
      await reload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể đổi trạng thái voucher.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await deleteDiscountCode(deleteTarget.id)
      showToast(`Đã xóa voucher ${deleteTarget.code}.`)
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xóa voucher.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        eyebrow="Giá & Khuyến Mãi"
        title={isVi ? 'Quản Lý Mã Giảm Giá (Voucher)' : 'Discount Vouchers'}
        subtitle={
          isVi
            ? 'Tạo, phát hành và theo dõi lượt sử dụng mã giảm giá toàn hệ thống hoặc theo từng cơ sở.'
            : 'Create, publish, and monitor discount voucher codes across facilities.'
        }
        action={
          <Button onClick={openCreateModal}>
            + Tạo Voucher Mới
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Tìm kiếm"
            placeholder="Nhập mã voucher hoặc tên chương trình..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Select label="Phạm vi cơ sở" value={facilityFilter} onChange={e => setFacilityFilter(e.target.value)}>
            <option value="all">Tất cả cơ sở / Toàn hệ thống</option>
            {facilitiesList.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
          <Select label="Trạng thái hiệu lực" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | DiscountRuntimeStatus)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang áp dụng</option>
            <option value="SCHEDULED">Chờ hiệu lực</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="INACTIVE">Ngừng áp dụng</option>
            <option value="EXPIRED">Hết hạn</option>
          </Select>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </Card>
      )}

      <Card className="overflow-x-auto">
        <Table>
          <Thead>
            <tr>
              <Th>Mã Voucher</Th>
              <Th>Chương trình</Th>
              <Th>Phạm vi</Th>
              <Th>Mức giảm</Th>
              <Th>Lượt dùng</Th>
              <Th>Thời hạn</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Thao tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={8} className="py-8 text-center text-stone-500">Đang tải danh sách mã giảm giá...</Td></tr>
            ) : filtered.length === 0 ? (
              <tr><Td colSpan={8} className="py-8 text-center text-stone-500">Chưa có mã giảm giá nào phù hợp.</Td></tr>
            ) : (
              filtered.map(item => {
                const badge = RUNTIME_BADGE[item.runtimeStatus] || RUNTIME_BADGE.DRAFT
                return (
                  <Tr key={item.id}>
                    <Td className="font-mono font-bold text-stone-900">{item.code}</Td>
                    <Td>
                      <p className="font-semibold text-stone-900">{item.name}</p>
                      {item.description && <p className="text-xs text-stone-500">{item.description}</p>}
                    </Td>
                    <Td>
                      <p className="text-sm text-stone-700">{SCOPE_LABELS[item.scope]}</p>
                      {item.facilityName && <p className="text-xs text-stone-500">{item.facilityName}</p>}
                    </Td>
                    <Td className="font-mono font-semibold text-amber-700">
                      {item.discountType === 'PERCENTAGE'
                        ? `-${item.discountValue}%`
                        : `-${formatVndAmount(item.discountValue)} đ`}
                    </Td>
                    <Td className="tabular-nums text-sm">
                      {item.currentUses} / {item.maxUses ?? 'Không giới hạn'}
                    </Td>
                    <Td className="text-xs text-stone-600">
                      <div>Từ: {toLocalInputDateTime(item.effectiveFrom)}</div>
                      <div>Đến: {item.effectiveTo ? toLocalInputDateTime(item.effectiveTo) : 'Không giới hạn'}</div>
                    </Td>
                    <Td>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openEditModal(item)}>Sửa</Button>
                        <Button size="sm" variant="outline" onClick={() => void handleTogglePublication(item)}>
                          {item.publicationStatus === 'PUBLISHED' ? 'Tạm ngừng' : 'Kích hoạt'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}>Xóa</Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false) }}
        title={editingItem ? `Cập nhật Voucher ${editingItem.code}` : 'Tạo Mã Giảm Giá Mới'}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Mã Voucher *"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="VD: SUMMER20"
            />
            <Input
              label="Tên chương trình *"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ưu đãi mùa hè"
            />
          </div>
          <Input
            label="Mô tả"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Điều kiện áp dụng voucher..."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Phạm vi áp dụng" value={scope} onChange={e => setScope(e.target.value as DiscountScope)}>
              <option value="GLOBAL">Toàn hệ thống</option>
              <option value="FACILITY">Theo cơ sở</option>
              <option value="POLICY">Theo chính sách</option>
            </Select>
            {scope === 'FACILITY' && (
              <Select label="Cơ sở áp dụng *" value={facilityId} onChange={e => setFacilityId(e.target.value)}>
                {facilitiesList.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            )}
            {scope === 'POLICY' && (
              <Input
                label="Mã chính sách / gói (UUID, tùy chọn)"
                value={policyId}
                onChange={e => setPolicyId(e.target.value)}
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Loại giảm giá" value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}>
              <option value="PERCENTAGE">Phần trăm (%)</option>
              <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
            </Select>
            <Input
              label={discountType === 'PERCENTAGE' ? 'Giá trị (%) *' : 'Số tiền giảm (đ) *'}
              type="number"
              min={1}
              max={discountType === 'PERCENTAGE' ? 100 : undefined}
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
            />
            <Input
              label="Giới hạn lượt dùng"
              type="number"
              min={1}
              placeholder="Không giới hạn"
              value={maxUses}
              onChange={e => setMaxUses(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Ngày bắt đầu *</label>
              <LocalizedDateInput
                type="date"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Ngày kết thúc</label>
              <LocalizedDateInput
                type="date"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                value={effectiveTo}
                onChange={e => setEffectiveTo(e.target.value)}
              />
            </div>
            <Select label="Trạng thái phát hành" value={publicationStatus} onChange={e => setPublicationStatus(e.target.value as DiscountPublicationStatus)}>
              <option value="PUBLISHED">Phát hành ngay</option>
              <option value="DRAFT">Lưu nháp</option>
              <option value="INACTIVE">Tạm ngừng</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <Button variant="outline" disabled={saving} onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Đang lưu...' : editingItem ? 'Lưu thay đổi' : 'Tạo Voucher'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => { if (!saving) setDeleteTarget(null) }} title="Xác nhận xóa voucher">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-stone-700">
              Bạn có chắc chắn muốn xóa mã giảm giá <strong className="font-mono">{deleteTarget.code}</strong> ({deleteTarget.name})?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setDeleteTarget(null)}>Hủy</Button>
              <Button variant="danger" disabled={saving} onClick={() => void handleConfirmDelete()}>
                {saving ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
