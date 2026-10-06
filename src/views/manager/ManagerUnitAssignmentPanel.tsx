import { useEffect, useState } from 'react'
import {
  createUnitAssignment,
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
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

export default function ManagerUnitAssignmentPanel({ showToast }: { showToast: (message: string) => void }) {
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
        if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải reservation chờ phân kho.')
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
    setLoadingUnits(true)
    setError(null)
    try {
      const response = await listAssignableUnits(item.reservationId)
      setUnits(response.data)
      setStorageUnitId(response.data[0]?.storageUnitId || '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách gian kho khả dụng.')
    } finally {
      setLoadingUnits(false)
    }
  }

  const submitAssignment = async () => {
    if (!selected || !storageUnitId) return
    setSubmitting(true)
    try {
      const result = await createUnitAssignment(selected.reservationId, storageUnitId)
      showToast(`Đã phân gian ${result.storageUnitCode} cho reservation ${result.reservationCode}.`)
      setSelected(null)
      setRefreshKey(value => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo assignment.')
    } finally {
      setSubmitting(false)
    }
  }

  const search = () => {
    setPage(0)
    setQuery(queryInput.trim())
  }

  return <div className="space-y-6">
    <SectionHeader
      eyebrow="Nghiệp vụ Trâm"
      title="Phân kho cho reservation"
      subtitle="Chọn gian kho còn trống, cùng cơ sở và đúng loại kho cho reservation đã xác nhận."
    />

    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          className="sm:min-w-80"
          value={queryInput}
          placeholder="Mã reservation, khách hàng hoặc email"
          onChange={event => setQueryInput(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') search() }}
        />
        <Button onClick={search}>Tìm kiếm</Button>
        <Button variant="outline" onClick={() => setRefreshKey(value => value + 1)}>Tải lại</Button>
      </div>
    </Card>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

    <Card>
      <Table>
        <Thead><Tr>
          <Th>Reservation</Th>
          <Th>Khách hàng</Th>
          <Th>Cơ sở / loại kho</Th>
          <Th>Thời hạn</Th>
          <Th>Trạng thái</Th>
          <Th className="text-right">Thao tác</Th>
        </Tr></Thead>
        <Tbody>
          {items.map(item => <Tr key={item.reservationId}>
            <Td><b className="font-mono">{item.reservationCode}</b><p className="mt-1 text-xs text-stone-500">Xác nhận {formatDate(item.confirmedAt)}</p></Td>
            <Td><b>{item.customerName}</b><p className="mt-1 text-xs text-stone-500">{item.customerEmail}</p></Td>
            <Td><b>{item.facilityName}</b><p className="mt-1 text-xs text-stone-500">{item.unitTypeName}</p></Td>
            <Td>{formatDate(item.startDate)} – {formatDate(item.endDate)}</Td>
            <Td><Badge variant="success">CONFIRMED</Badge></Td>
            <Td className="text-right"><Button size="sm" onClick={() => void openAssignment(item)}>Chọn gian kho</Button></Td>
          </Tr>)}
          {!loading && !items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">Không có reservation đã xác nhận đang chờ phân kho.</td></tr>}
          {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">Đang tải danh sách…</td></tr>}
        </Tbody>
      </Table>
      {totalPages > 1 && <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4 text-sm text-stone-500">
        <span>{totalItems} hồ sơ · Trang {page + 1}/{totalPages}</span>
        <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))}>Trước</Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(value => value + 1)}>Sau</Button>
      </div>}
    </Card>

    <Modal open={Boolean(selected)} onClose={() => { if (!submitting) setSelected(null) }} title="Chọn gian kho cho reservation">
      {selected && <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          <p><b>Reservation:</b> {selected.reservationCode}</p>
          <p><b>Khách hàng:</b> {selected.customerName}</p>
          <p><b>Yêu cầu:</b> {selected.unitTypeName} · {selected.facilityName}</p>
        </div>
        {loadingUnits
          ? <p className="text-sm text-stone-500">Đang kiểm tra gian kho khả dụng…</p>
          : units.length
            ? <Select label="Gian kho khả dụng" value={storageUnitId} onChange={event => setStorageUnitId(event.target.value)}>
                {units.map(unit => <option key={unit.storageUnitId} value={unit.storageUnitId}>
                  {unit.storageUnitCode} · Tầng {unit.floor || '—'} · Khu {unit.zone || '—'}
                </option>)}
              </Select>
            : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Không có gian kho `available` phù hợp tại cơ sở này.</div>}
        <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
          Xác nhận sẽ tạo assignment ACTIVE, chuyển reservation sang UNIT_RESERVED và gian kho sang reserved.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={() => setSelected(null)}>Đóng</Button>
          <Button disabled={submitting || loadingUnits || !storageUnitId} onClick={() => void submitAssignment()}>
            {submitting ? 'Đang phân kho…' : 'Xác nhận phân kho'}
          </Button>
        </div>
      </div>}
    </Modal>
  </div>
}
