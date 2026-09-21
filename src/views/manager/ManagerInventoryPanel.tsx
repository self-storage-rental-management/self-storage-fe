import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import type { MaintenanceTask, StorageUnit } from '../../types/storageHub'
import { managerStatusLabel, managerUnitTypeLabel } from './managerI18n'

interface Props {
  user: User
  units: StorageUnit[]
  maintenanceTasks: MaintenanceTask[]
  updateUnitStatus: (unitId: string, status: 'available' | 'maintenance', manager: User, reason?: string) => void
  showToast: (message: string) => void
}

const variants: Record<string, string> = { available: 'success', occupied: 'info', reserved: 'purple', maintenance: 'warning', held: 'purple', assigned: 'purple' }

export default function ManagerInventoryPanel({ user, units, maintenanceTasks, updateUnitStatus, showToast }: Props) {
  const { lang, formatCurrency } = useLanguage()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedUnit, setSelectedUnit] = useState<StorageUnit | null>(null)
  const [targetStatus, setTargetStatus] = useState<'available' | 'maintenance'>('maintenance')
  const [reason, setReason] = useState('')

  const facilityUnits = useMemo(() => units.filter(unit => !user.facility || user.facility === 'All facilities' || unit.facilityName === user.facility || unit.facilityId === user.facility), [units, user.facility])
  const visibleUnits = facilityUnits.filter(unit => {
    const normalized = query.trim().toLowerCase()
    return (filter === 'all' || unit.status === filter) && (!normalized || [unit.code, unit.type, unit.zone].some(value => value.toLowerCase().includes(normalized)))
  })

  const openStatusModal = (unit: StorageUnit, status: 'available' | 'maintenance') => {
    setSelectedUnit(unit)
    setTargetStatus(status)
    setReason(status === 'maintenance' ? (lang === 'vi' ? 'Kiểm tra/bảo trì theo yêu cầu vận hành' : 'Operational inspection or maintenance') : (lang === 'vi' ? 'Đã nghiệm thu, gian kho sẵn sàng khai thác' : 'Inspection passed; unit ready for service'))
  }

  const saveStatus = () => {
    if (!selectedUnit) return
    try {
      updateUnitStatus(selectedUnit.id, targetStatus, user, reason)
      showToast(lang === 'vi' ? `Đã chuyển ${selectedUnit.code} sang trạng thái ${managerStatusLabel(targetStatus, lang)}.` : `${selectedUnit.code} moved to ${managerStatusLabel(targetStatus, lang)}.`)
      setSelectedUnit(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật gian kho.')
    }
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={lang === 'vi' ? 'Tồn kho vật lý' : 'Physical inventory'} title={lang === 'vi' ? 'Tồn kho gian kho' : 'Storage Inventory'} subtitle={lang === 'vi' ? 'Theo dõi trạng thái khai thác, thông số và hàng đợi bảo trì của cơ sở.' : 'Facility-scoped unit availability, specifications and maintenance queue.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title={lang === 'vi' ? 'Tổng gian' : 'Total units'} value={facilityUnits.length} icon={Icon.box} />
      <StatCard title={lang === 'vi' ? 'Khả dụng' : 'Available'} value={facilityUnits.filter(unit => unit.status === 'available').length} icon={Icon.check} />
      <StatCard title={lang === 'vi' ? 'Đang khai thác' : 'Occupied'} value={facilityUnits.filter(unit => unit.status === 'occupied').length} icon={Icon.key} />
      <StatCard title={lang === 'vi' ? 'Bảo trì' : 'Maintenance'} value={facilityUnits.filter(unit => unit.status === 'maintenance').length} icon={Icon.tasks} />
    </div>
    <div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === 'vi' ? 'Tìm mã gian, loại hoặc khu…' : 'Search code, type or zone…'} /><Select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{lang === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>{['available', 'reserved', 'occupied', 'maintenance'].map(status => <option key={status} value={status}>{managerStatusLabel(status, lang)}</option>)}</Select></div>
    <Card><Table><Thead><tr><Th>{lang === 'vi' ? 'Gian kho' : 'Unit'}</Th><Th>{lang === 'vi' ? 'Loại / kích thước' : 'Type / dimensions'}</Th><Th>{lang === 'vi' ? 'Vị trí' : 'Location'}</Th><Th>{lang === 'vi' ? 'Giá' : 'Price'}</Th><Th>{lang === 'vi' ? 'Lịch khả dụng' : 'Availability'}</Th><Th>{lang === 'vi' ? 'Trạng thái' : 'Status'}</Th><Th /></tr></Thead><Tbody>
      {visibleUnits.map(unit => {
        const activeTask = maintenanceTasks.find(task => task.unitId === unit.id && task.status !== 'completed')
        return <Tr key={unit.id}><Td><p className="font-mono font-bold text-stone-900">{unit.code}</p><p className="text-xs text-stone-400">v{unit.version}</p></Td><Td><p className="font-semibold">{managerUnitTypeLabel(unit.type, lang)}</p><p className="text-xs text-stone-400">{unit.dimensions.lengthM} × {unit.dimensions.widthM} × {unit.dimensions.heightM}m · {unit.areaM2}m²</p></Td><Td>{lang === 'vi' ? `Tầng ${unit.floor}` : `Floor ${unit.floor}`} · {unit.zone}</Td><Td className="font-mono">{formatCurrency(unit.price)}/{lang === 'vi' ? 'tháng' : 'mo'}</Td><Td>{unit.nextAvailableDate || (unit.status === 'available' ? (lang === 'vi' ? 'Ngay bây giờ' : 'Now') : '—')}</Td><Td><Badge variant={variants[unit.status] || 'muted'}>{managerStatusLabel(unit.status, lang)}</Badge>{activeTask && <p className="mt-1 max-w-48 text-xs text-amber-700">{activeTask.reason}</p>}</Td><Td className="text-right">{unit.status === 'available' && <Button size="sm" variant="outline" onClick={() => openStatusModal(unit, 'maintenance')}>{lang === 'vi' ? 'Đưa vào bảo trì' : 'Start maintenance'}</Button>}{unit.status === 'maintenance' && <Button size="sm" onClick={() => openStatusModal(unit, 'available')}>{lang === 'vi' ? 'Nghiệm thu & mở lại' : 'Release unit'}</Button>}</Td></Tr>
      })}
      {!visibleUnits.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">{lang === 'vi' ? 'Không có gian kho phù hợp.' : 'No matching units.'}</td></tr>}
    </Tbody></Table></Card>
    <Modal open={Boolean(selectedUnit)} onClose={() => setSelectedUnit(null)} title={targetStatus === 'maintenance' ? (lang === 'vi' ? 'Chuyển sang bảo trì' : 'Start maintenance') : (lang === 'vi' ? 'Nghiệm thu và mở lại gian kho' : 'Inspect and release unit')}>
      {selectedUnit && <div className="space-y-4"><div className="rounded-lg bg-stone-50 p-3 text-sm"><b className="font-mono">{selectedUnit.code}</b> · {managerUnitTypeLabel(selectedUnit.type, lang)} · {selectedUnit.facilityName}</div><Input label={lang === 'vi' ? 'Lý do / ghi chú nghiệm thu' : 'Reason / inspection note'} value={reason} onChange={event => setReason(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedUnit(null)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button><Button disabled={!reason.trim()} onClick={saveStatus}>{lang === 'vi' ? 'Xác nhận' : 'Confirm'}</Button></div></div>}
    </Modal>
  </div>
}
