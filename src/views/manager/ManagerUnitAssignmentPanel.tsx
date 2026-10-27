import { managerDisplayError } from './managerPresentation'
import { useEffect, useState } from 'react'
import { managerUnitTypeLabel } from './managerI18n'
import {
  createUnitAssignment,
  changeUnitAssignment,
  listAssignableUnits,
  listUnitAssignmentCandidates,
  type AssignableUnit,
  type UnitAssignmentCandidate,
} from '../../services/unitAssignmentApi'
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  SectionHeader,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

export default function ManagerUnitAssignmentPanel({ showToast, embedded = false, onAssigned }: {
  showToast: (message: string) => void
  embedded?: boolean
  onAssigned?: () => void
}) {
  const [items, setItems] = useState<UnitAssignmentCandidate[]>([])
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected, setSelected] = useState<UnitAssignmentCandidate | null>(null)
  const [units, setUnits] = useState<AssignableUnit[]>([])
  const [storageUnitId, setStorageUnitId] = useState('')
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flow, setFlow] = useState<'select' | 'suggested' | 'confirm' | 'change'>('select')
  const [changeReason, setChangeReason] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void listUnitAssignmentCandidates({ page, pageSize: 20, q: query })
      .then(response => {
        if (!active) return
        setItems(response.data)
        setTotalItems(response.pagination.totalItems)
        setTotalPages(response.pagination.totalPages)
      })
      .catch(reason => {
        if (active) setError(managerDisplayError(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [page, query, refreshKey])

  const openAssignment = async (item: UnitAssignmentCandidate) => {
    setSelected(item)
    setUnits([])
    setStorageUnitId('')
    setChangeReason('')
    setFlow(item.assignedStorageUnitId ? 'change' : 'select')
    setLoadingUnits(true)
    setError(null)
    try {
      const response = await listAssignableUnits(item.reservationId)
      setUnits(response.data)
      setStorageUnitId(response.data[0]?.storageUnitId || '')
      setFlow(item.assignedStorageUnitId ? 'change' : 'suggested')
    } catch (reason) {
      setError(managerDisplayError(reason))
    } finally {
      setLoadingUnits(false)
    }
  }

  const submitAssignment = async () => {
    if (!selected || !storageUnitId || (flow === 'change' && !changeReason.trim())) return
    setSubmitting(true)
    try {
      const result = selected.assignedStorageUnitId
        ? await changeUnitAssignment(selected.reservationId, storageUnitId, changeReason.trim())
        : await createUnitAssignment(selected.reservationId, storageUnitId)
      showToast(selected.assignedStorageUnitId
        ? `Đã đổi sang gian ${result.storageUnitCode} cho đơn đặt chỗ ${result.reservationCode}.`
        : `Đã phân gian ${result.storageUnitCode} cho đơn đặt chỗ ${result.reservationCode}.`)
      setSelected(null)
      setRefreshKey(value => value + 1)
      onAssigned?.()
    } catch (reason) {
      setError(managerDisplayError(reason))
    } finally {
      setSubmitting(false)
    }
  }

  const search = () => {
    setPage(0)
    setQuery(queryInput.trim())
  }

  return <div className="space-y-6">
    {!embedded && <SectionHeader
      eyebrow="Vận hành nhận kho"
      title="Phân gian"
      subtitle="Các đơn đã thanh toán và đang chờ gian được xếp trước. Chọn gian phù hợp và xem đầy đủ vị trí, kích thước, tải trọng trước khi xác nhận."
    />}

    {embedded && <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Cần xử lý trước</p><h3 className="mt-1 text-lg font-bold text-stone-900">Đơn đã thanh toán cọc đang chờ phân gian</h3><p className="mt-1 text-sm text-stone-500">Đơn chờ lâu nhất được xếp lên trước. Chọn một gian còn trống phù hợp ngay tại trang quản lý kho.</p></div>
      {totalItems > 0 && <Badge variant="warning">{totalItems} đơn chờ phân</Badge>}
    </div>}

    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          className="sm:min-w-80"
          value={queryInput}
          placeholder="Mã đặt chỗ, khách hàng hoặc thư điện tử"
          onChange={event => setQueryInput(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') search() }}
        />
        <Button onClick={search}>Tìm kiếm</Button>

      </div>
    </Card>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

    <Card>
      <Table>
        <Thead><Tr>
          <Th>Đặt chỗ</Th>
          <Th>Khách hàng</Th>
          <Th>Cơ sở / loại kho</Th>
          <Th>Thời hạn</Th>
          <Th>Trạng thái</Th>
          <Th className="text-right">Thao tác</Th>
        </Tr></Thead>
        <Tbody>
          {items.map(item => <Tr key={item.reservationId}>
            <Td><b className="font-mono">{item.reservationCode}</b><p className="mt-1 text-xs text-stone-500">Xác nhận {formatDateTime(item.confirmedAt)}</p></Td>
            <Td><b>{item.customerName}</b><p className="mt-1 text-xs text-stone-500">{item.customerEmail}</p></Td>
            <Td><b>{item.facilityName}</b><p className="mt-1 text-xs text-stone-500">{managerUnitTypeLabel(item.unitTypeName, 'vi')}</p></Td>
            <Td><p>{formatDate(item.startDate)} - {formatDate(item.endDate)}</p>{!item.assignedStorageUnitId && <p className={`mt-1 text-xs font-semibold ${item.assignmentDueAt && new Date(item.assignmentDueAt).getTime() < Date.now() ? 'text-red-700' : 'text-amber-700'}`}>{item.assignmentDueAt && new Date(item.assignmentDueAt).getTime() < Date.now() ? 'Đã quá hạn phân gian: ' : 'Hạn phân gian: '}{formatDateTime(item.assignmentDueAt)}</p>}</Td>
            <Td><Badge variant={item.assignedStorageUnitId ? 'info' : 'success'}>
              {item.assignedStorageUnitId ? `Đã phân ${item.assignedStorageUnitCode}` : 'Đã thanh toán cọc, chờ phân gian'}
            </Badge></Td>
            <Td className="text-right"><Button size="sm" onClick={() => void openAssignment(item)}>
              {item.assignedStorageUnitId ? 'Xem / đổi gian' : 'Chọn gian kho'}
            </Button></Td>
          </Tr>)}
          {!loading && !items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">Không có đơn đã thanh toán cọc đang chờ phân gian.</td></tr>}
          {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">Đang tải danh sách…</td></tr>}
        </Tbody>
      </Table>
      {totalPages > 1 && <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4 text-sm text-stone-500">
        <span>{totalItems} hồ sơ · Trang {page + 1}/{totalPages}</span>
        <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))}>Trước</Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(value => value + 1)}>Sau</Button>
      </div>}
    </Card>

    <Modal open={Boolean(selected)} onClose={() => { if (!submitting) setSelected(null) }} title={flow === 'change' ? 'Đổi gian kho' : 'Phân gian kho'}>
      {selected && <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          <p><b>Đặt chỗ:</b> {selected.reservationCode}</p>
          <p><b>Khách hàng:</b> {selected.customerName}</p>
          <p><b>Yêu cầu:</b> {managerUnitTypeLabel(selected.unitTypeName, 'vi')} · {selected.facilityName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            ['select', '1. Chọn gian'],
            ['suggested', '2. Xem gợi ý'],
            ['confirm', '3. Xác nhận'],
            ...(selected.assignedStorageUnitId ? [['change', '4. Đổi khi không phù hợp']] : []),
          ].map(([key, label]) => <span key={key} className={`rounded-full border px-2 py-1 ${flow === key ? 'border-amber-400 bg-amber-50 font-semibold text-amber-900' : 'border-stone-200 text-stone-500'}`}>{label}</span>)}
        </div>
        {selected.assignedStorageUnitId && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Gian hiện tại: <b className="font-mono">{selected.assignedStorageUnitCode}</b> · {selected.assignedStorageUnitStatus || 'đang sử dụng'}.
          Chỉ đổi khi gian bảo trì hoặc không còn phù hợp.
        </div>}
        {loadingUnits
          ? <p className="text-sm text-stone-500">Đang kiểm tra gian kho khả dụng…</p>
          : units.length
            ? <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Gian được gợi ý</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {units.map(unit => <button type="button" key={unit.storageUnitId} onClick={() => { setStorageUnitId(unit.storageUnitId); setFlow(selected.assignedStorageUnitId ? 'change' : 'confirm') }} className={`rounded-lg border p-3 text-left ${storageUnitId === unit.storageUnitId ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-100' : 'border-stone-200 bg-white hover:border-amber-300'}`}>
                    <b className="font-mono">{unit.storageUnitCode}</b>
                    <p className="mt-1 text-xs text-stone-500">Tầng {unit.floor || '-'} · Khu {unit.zone || '-'}</p>
                  </button>)}
                </div>
              </div>
            : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Không có gian kho còn trống phù hợp tại cơ sở này.</div>}
        {flow === 'confirm' && storageUnitId && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          Đã chọn <b className="font-mono">{units.find(unit => unit.storageUnitId === storageUnitId)?.storageUnitCode}</b>. Kiểm tra lại rồi xác nhận để giữ gian cho khách hàng.
        </div>}
        {flow === 'change' && <Input label="Lý do đổi gian *" value={changeReason} onChange={event => setChangeReason(event.target.value)} placeholder="Ví dụ: gian đang bảo trì hoặc không còn phù hợp kích thước" />}
        {units.find(unit => unit.storageUnitId === storageUnitId) && (() => {
          const unit = units.find(item => item.storageUnitId === storageUnitId)!
          return <dl className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-stone-500">Loại gian</dt><dd className="font-semibold">{unit.unitTypeName}</dd></div>
            <div><dt className="text-xs text-stone-500">Vị trí</dt><dd className="font-semibold">Tầng {unit.floor || '-'} · {unit.zone || 'Chưa có khu'}</dd></div>
            <div><dt className="text-xs text-stone-500">Kích thước</dt><dd className="font-semibold">{unit.lengthM} × {unit.widthM} × {unit.heightM} m</dd></div>
            <div><dt className="text-xs text-stone-500">Diện tích / thể tích</dt><dd className="font-semibold">{unit.areaM2} m² · {unit.volumeM3} m³</dd></div>
            <div><dt className="text-xs text-stone-500">Tải trọng tối đa</dt><dd className="font-semibold">{unit.maxLoadKg.toLocaleString('vi-VN')} kg</dd></div>
            <div><dt className="text-xs text-stone-500">Trạng thái</dt><dd><Badge variant="success">Còn trống</Badge></dd></div>
          </dl>
        })()}
        <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
          Xác nhận để phân gian kho đã chọn cho đặt chỗ này. Gian kho sẽ được giữ cho khách hàng.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={() => setSelected(null)}>Đóng</Button>
          <Button disabled={submitting || loadingUnits || !storageUnitId || flow === 'suggested' || (flow === 'change' && !changeReason.trim())} onClick={() => void submitAssignment()}>
            {submitting ? 'Đang lưu…' : selected.assignedStorageUnitId ? 'Xác nhận đổi gian' : 'Xác nhận phân gian'}
          </Button>
        </div>
      </div>}
    </Modal>
  </div>
}
