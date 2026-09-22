import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { MaintenanceTask, StorageUnit } from '../../types/storageHub'
import { isFacilityVisible } from '../../domain/managerRules'

interface Props {
  user: User
  units: StorageUnit[]
  maintenanceTasks: MaintenanceTask[]
  updateUnitStatus: (unitId: string, status: 'available' | 'maintenance', manager: User, reason?: string) => void
  showToast: (message: string) => void
}

const variants: Record<string, string> = { available: 'success', occupied: 'info', reserved: 'purple', maintenance: 'warning', held: 'purple', assigned: 'purple' }

export default function ManagerInventoryPanel({ user, units, maintenanceTasks, updateUnitStatus, showToast }: Props) {
    const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedUnit, setSelectedUnit] = useState<StorageUnit | null>(null)
  const [targetStatus, setTargetStatus] = useState<'available' | 'maintenance'>('maintenance')
  const [reason, setReason] = useState('')

  const facilityUnits = useMemo(() => units.filter(unit => isFacilityVisible(user, unit.facilityId, unit.facilityName)), [units, user])
  const visibleUnits = facilityUnits.filter(unit => {
    const normalized = query.trim().toLowerCase()
    return (filter === 'all' || unit.status === filter) && (!normalized || [unit.code, unit.type, unit.zone].some(value => value.toLowerCase().includes(normalized)))
  })

  const openStatusModal = (unit: StorageUnit, status: 'available' | 'maintenance') => {
    setSelectedUnit(unit)
    setTargetStatus(status)
    setReason(status === 'maintenance' ? ('Kiểm tra/bảo trì theo yêu cầu vận hành') : ('Đã nghiệm thu, gian kho sẵn sàng khai thác'))
  }

  const saveStatus = () => {
    if (!selectedUnit) return
    try {
      updateUnitStatus(selectedUnit.id, targetStatus, user, reason)
      showToast(`Đã chuyển ${selectedUnit.code} sang ${targetStatus.toUpperCase()}.`)
      setSelectedUnit(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật gian kho.')
    }
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={'Tồn kho vật lý'} title="Storage Inventory" subtitle={'Theo dõi trạng thái khai thác, thông số và hàng đợi bảo trì của cơ sở.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title={'Tổng gian'} value={facilityUnits.length} icon={Icon.box} />
      <StatCard title={'Khả dụng'} value={facilityUnits.filter(unit => unit.status === 'available').length} icon={Icon.check} />
      <StatCard title={'Đang khai thác'} value={facilityUnits.filter(unit => unit.status === 'occupied').length} icon={Icon.key} />
      <StatCard title={'Bảo trì'} value={facilityUnits.filter(unit => unit.status === 'maintenance').length} icon={Icon.tasks} />
    </div>
    <div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={'Tìm mã gian, loại hoặc khu…'} /><Select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{'Tất cả trạng thái'}</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option></Select></div>
    <Card><Table><Thead><tr><Th>{'Gian kho'}</Th><Th>{'Loại / kích thước'}</Th><Th>{'Vị trí'}</Th><Th>{'Giá'}</Th><Th>{'Lịch khả dụng'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>
      {visibleUnits.map(unit => {
        const activeTask = maintenanceTasks.find(task => task.unitId === unit.id && task.status !== 'completed')
        return <Tr key={unit.id}><Td><p className="font-mono font-bold text-stone-900">{unit.code}</p><p className="text-xs text-stone-400">v{unit.version}</p></Td><Td><p className="font-semibold">{unit.type}</p><p className="text-xs text-stone-400">{unit.dimensions.lengthM} × {unit.dimensions.widthM} × {unit.dimensions.heightM}m · {unit.areaM2}m²</p></Td><Td>{`Tầng ${unit.floor}`} · {unit.zone}</Td><Td className="font-mono">{formatVnd(unit.price)}/tháng</Td><Td>{unit.nextAvailableDate || (unit.status === 'available' ? ('Ngay bây giờ') : '—')}</Td><Td><Badge variant={variants[unit.status] || 'muted'}>{unit.status.toUpperCase()}</Badge>{activeTask && <p className="mt-1 max-w-48 text-xs text-amber-700">{activeTask.reason}</p>}</Td><Td className="text-right">{unit.status === 'available' && <Button size="sm" variant="outline" onClick={() => openStatusModal(unit, 'maintenance')}>{'Đưa vào bảo trì'}</Button>}{unit.status === 'maintenance' && <Button size="sm" onClick={() => openStatusModal(unit, 'available')}>{'Nghiệm thu & mở lại'}</Button>}</Td></Tr>
      })}
      {!visibleUnits.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">{'Không có gian kho phù hợp.'}</td></tr>}
    </Tbody></Table></Card>
    <Modal open={Boolean(selectedUnit)} onClose={() => setSelectedUnit(null)} title={targetStatus === 'maintenance' ? ('Chuyển sang bảo trì') : ('Nghiệm thu và mở lại gian kho')}>
      {selectedUnit && <div className="space-y-4"><div className="rounded-lg bg-stone-50 p-3 text-sm"><b className="font-mono">{selectedUnit.code}</b> · {selectedUnit.type} · {selectedUnit.facilityName}</div><Input label={'Lý do / ghi chú nghiệm thu'} value={reason} onChange={event => setReason(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedUnit(null)}>{'Hủy'}</Button><Button disabled={!reason.trim()} onClick={saveStatus}>{'Xác nhận'}</Button></div></div>}
    </Modal>
  </div>
}
