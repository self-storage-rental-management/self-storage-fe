import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, ProgressBar, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { ActivityRecord, CheckInRecord, MaintenanceTask, RentalRecord, ReturnCase, StorageReservation, StorageUnit, UnitType } from '../../types/storageHub'
import { isManagerFacilityVisible, isManagerRentalOverdue, managerUnitHasOperationalLock, parseManagerActivityTimestamp } from '../../domain/managerRules'
import { managerActivityLabel, managerStatusLabel, managerUnitTypeLabel } from './managerI18n'
import ManagerUnitEditor from './ManagerUnitEditor'
import ManagerActionNotice from './ManagerActionNotice'

interface Props {
  user: User
  units: StorageUnit[]
  rentals: RentalRecord[]
  reservations: StorageReservation[]
  checkins: CheckInRecord[]
  returns: ReturnCase[]
  activities: ActivityRecord[]
  maintenanceTasks: MaintenanceTask[]
  unitTypes: UnitType[]
  facilityId: string
  facilityName: string
  createUnit: (data: Partial<StorageUnit>, actor: User) => StorageUnit
  updateUnit: (unitId: string, updates: Partial<StorageUnit>, actor: User) => void
  deleteUnit: (unitId: string, actor: User) => { success: boolean; reason?: string }
  updateUnitStatus: (unitId: string, status: 'available' | 'maintenance', manager: User, reason?: string) => void
  onCreateMaintenanceWork: (draft: { referenceId: string; title: string; notes: string }) => void
  showToast: (message: string) => void
}

const statusVariants: Record<string, string> = {
  available: 'success',
  occupied: 'info',
  reserved: 'purple',
  maintenance: 'warning',
  held: 'purple',
  assigned: 'purple'
}

const activeReservationStatuses = ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN']

const datePart = (value?: string) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ''

const formatDate = (value?: string) => {
  const date = datePart(value)
  if (!date) return 'Chưa xác định'
  return new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN')
}

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa xác định'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return formatDate(value)
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const damageLabel = (value?: string) => {
  const labels: Record<string, string> = {
    no_damage: 'Không hư hỏng',
    minor_damage: 'Hư hỏng nhẹ',
    major_damage: 'Hư hỏng nghiêm trọng',
    abandoned_goods: 'Có hàng hóa bị bỏ lại'
  }
  return value ? labels[value] || 'Chưa phân loại' : 'Chưa ghi nhận'
}

const normalizeOperationalText = (value?: string) => {
  if (!value) return 'Chưa ghi nhận'
  return value
    .replace(/\bManager\b/gi, 'Quản lý')
    .replace(/\bAVAILABLE\b/g, 'còn trống')
    .replace(/\bMAINTENANCE\b/g, 'bảo trì')
    .replace(/\bOCCUPIED\b/g, 'đang sử dụng')
    .replace(/\bRESERVED\b/g, 'đã giữ chỗ')
}

export default function ManagerInventoryPanel({
  user,
  units,
  rentals,
  reservations,
  checkins,
  returns,
  activities,
  maintenanceTasks,
  unitTypes,
  facilityId,
  facilityName,
  createUnit,
  updateUnit,
  deleteUnit,
  updateUnitStatus,
  onCreateMaintenanceWork,
  showToast
}: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [climateFilter, setClimateFilter] = useState('all')
  const [maintenanceFilter, setMaintenanceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('code')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [statusUnitId, setStatusUnitId] = useState<string | null>(null)
  const [targetStatus, setTargetStatus] = useState<'available' | 'maintenance'>('maintenance')
  const [reason, setReason] = useState('')
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; unitId?: string } | null>(null)

  const facilityUnits = useMemo(
    () => units.filter(unit => isManagerFacilityVisible(user, unit.facilityId, unit.facilityName)),
    [units, user]
  )
  const facilityIds = useMemo(() => new Set(facilityUnits.map(unit => unit.facilityId)), [facilityUnits])
  const facilityRentals = useMemo(() => rentals.filter(item => facilityIds.has(item.facilityId)), [rentals, facilityIds])
  const facilityReservations = useMemo(() => reservations.filter(item => facilityIds.has(item.facilityId)), [reservations, facilityIds])
  const facilityMaintenance = useMemo(() => maintenanceTasks.filter(item => facilityIds.has(item.facilityId)), [maintenanceTasks, facilityIds])
  const facilityActivities = useMemo(() => activities.filter(item => facilityIds.has(item.facilityId)), [activities, facilityIds])

  const matchesUnit = (value: string | undefined, unit: StorageUnit) => value === unit.id || value === unit.code
  const activeRentalFor = (unit: StorageUnit) => facilityRentals.find(item => matchesUnit(item.unitId, unit) && item.status === 'active')
  const activeReservationFor = (unit: StorageUnit) => facilityReservations.find(item => matchesUnit(item.assignedUnitId, unit) && activeReservationStatuses.includes(item.status))
  const openMaintenanceFor = (unit: StorageUnit) => facilityMaintenance.find(item => matchesUnit(item.unitId, unit) && item.status !== 'completed')

  const types = useMemo(() => Array.from(new Set(facilityUnits.map(unit => unit.type))).sort(), [facilityUnits])
  const floors = useMemo(() => Array.from(new Set(facilityUnits.map(unit => unit.floor))).sort((a, b) => a - b), [facilityUnits])
  const zones = useMemo(() => Array.from(new Set(facilityUnits.map(unit => unit.zone))).sort(), [facilityUnits])

  const visibleUnits = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN')
    const filtered = facilityUnits.filter(unit => {
      const rental = activeRentalFor(unit)
      const reservation = activeReservationFor(unit)
      const maintenance = openMaintenanceFor(unit)
      const searchValues = [
        unit.code,
        managerUnitTypeLabel(unit.type, 'vi'),
        unit.zone,
        `Tầng ${unit.floor}`,
        rental?.customerName,
        rental?.id,
        reservation?.customerName,
        reservation?.id
      ]
      return (
        (statusFilter === 'all' || unit.status === statusFilter) &&
        (typeFilter === 'all' || unit.type === typeFilter) &&
        (floorFilter === 'all' || String(unit.floor) === floorFilter) &&
        (zoneFilter === 'all' || unit.zone === zoneFilter) &&
        (climateFilter === 'all' || (climateFilter === 'yes' ? unit.climate : !unit.climate)) &&
        (maintenanceFilter === 'all' || (maintenanceFilter === 'open' ? Boolean(maintenance) : !maintenance)) &&
        (!normalized || searchValues.some(value => value?.toLocaleLowerCase('vi-VN').includes(normalized)))
      )
    })

    return filtered.sort((left, right) => {
      if (sortBy === 'area-desc') return right.areaM2 - left.areaM2
      if (sortBy === 'price-asc') return left.price - right.price
      if (sortBy === 'price-desc') return right.price - left.price
      if (sortBy === 'availability') {
        const leftDate = left.status === 'available' ? '0000-00-00' : left.nextAvailableDate || '9999-99-99'
        const rightDate = right.status === 'available' ? '0000-00-00' : right.nextAvailableDate || '9999-99-99'
        return leftDate.localeCompare(rightDate)
      }
      return left.code.localeCompare(right.code)
    })
  }, [facilityUnits, facilityRentals, facilityReservations, facilityMaintenance, query, statusFilter, typeFilter, floorFilter, zoneFilter, climateFilter, maintenanceFilter, sortBy])

  const availableCount = facilityUnits.filter(unit => unit.status === 'available').length
  const occupiedCount = facilityUnits.filter(unit => unit.status === 'occupied').length
  const reservedCount = facilityUnits.filter(unit => ['reserved', 'held', 'assigned'].includes(unit.status)).length
  const maintenanceCount = facilityUnits.filter(unit => unit.status === 'maintenance').length
  const occupancy = facilityUnits.length ? Math.round((occupiedCount / facilityUnits.length) * 100) : 0
  const totalArea = facilityUnits.reduce((sum, unit) => sum + unit.areaM2, 0)
  const totalVolume = facilityUnits.reduce((sum, unit) => sum + unit.volumeM3, 0)
  const totalLoad = facilityUnits.reduce((sum, unit) => sum + unit.maxLoadKg, 0)
  const totalListedRent = facilityUnits.reduce((sum, unit) => sum + unit.price, 0)

  const capacityByType = useMemo(() => {
    return types.map(type => {
      const typeUnits = facilityUnits.filter(unit => unit.type === type)
      const used = typeUnits.filter(unit => unit.status === 'occupied').length
      return {
        key: type,
        label: managerUnitTypeLabel(type, 'vi'),
        total: typeUnits.length,
        available: typeUnits.filter(unit => unit.status === 'available').length,
        used,
        reserved: typeUnits.filter(unit => ['reserved', 'held', 'assigned'].includes(unit.status)).length,
        maintenance: typeUnits.filter(unit => unit.status === 'maintenance').length,
        occupancy: typeUnits.length ? Math.round((used / typeUnits.length) * 100) : 0
      }
    })
  }, [facilityUnits, types])

  const capacityByZone = useMemo(() => {
    return zones.map(zone => {
      const zoneUnits = facilityUnits.filter(unit => unit.zone === zone)
      return {
        zone,
        floors: Array.from(new Set(zoneUnits.map(unit => unit.floor))).sort((a, b) => a - b).join(', '),
        total: zoneUnits.length,
        available: zoneUnits.filter(unit => unit.status === 'available').length,
        occupied: zoneUnits.filter(unit => unit.status === 'occupied').length,
        maintenance: zoneUnits.filter(unit => unit.status === 'maintenance').length
      }
    })
  }, [facilityUnits, zones])

  const selectedUnit = facilityUnits.find(unit => unit.id === selectedUnitId) || null
  const statusUnit = facilityUnits.find(unit => unit.id === statusUnitId) || null
  const editorUnit = editor?.mode === 'edit' ? facilityUnits.find(unit => unit.id === editor.unitId) || null : null
  const editorUnitHasHistory = editorUnit ? (
    facilityReservations.some(item => matchesUnit(item.assignedUnitId, editorUnit) || matchesUnit(item.unitId, editorUnit)) ||
    facilityRentals.some(item => matchesUnit(item.unitId, editorUnit)) ||
    checkins.some(item => matchesUnit(item.unitId, editorUnit)) ||
    returns.some(item => matchesUnit(item.unitId, editorUnit)) ||
    facilityMaintenance.some(item => matchesUnit(item.unitId, editorUnit))
  ) : false
  const canDeleteEditorUnit = Boolean(editorUnit && editorUnit.status === 'available' && !editorUnitHasHistory && !managerUnitHasOperationalLock(editorUnit.id, facilityReservations, facilityRentals))
  const deleteBlockedReason = !editorUnit ? '' : editorUnit.status !== 'available'
    ? 'Gian kho phải ở trạng thái còn trống trước khi xóa.'
    : editorUnitHasHistory
      ? 'Gian kho đã phát sinh dữ liệu nghiệp vụ nên cần được giữ lại để bảo toàn lịch sử.'
      : 'Gian kho đang có ràng buộc đặt chỗ hoặc hợp đồng.'

  const openStatusModal = (unit: StorageUnit, status: 'available' | 'maintenance') => {
    setSelectedUnitId(null)
    setStatusUnitId(unit.id)
    setTargetStatus(status)
    setReason(status === 'maintenance' ? 'Kiểm tra và bảo trì theo yêu cầu vận hành' : 'Đã nghiệm thu, gian kho sẵn sàng khai thác')
  }

  const saveStatus = () => {
    if (!statusUnit) return
    try {
      updateUnitStatus(statusUnit.id, targetStatus, user, reason)
      showToast(`Đã chuyển ${statusUnit.code} sang ${managerStatusLabel(targetStatus, 'vi')}.`)
      setStatusUnitId(null)
    } catch (error) {
      showToast(error instanceof Error ? normalizeOperationalText(error.message) : 'Không thể cập nhật gian kho.')
    }
  }

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setTypeFilter('all')
    setFloorFilter('all')
    setZoneFilter('all')
    setClimateFilter('all')
    setMaintenanceFilter('all')
    setSortBy('code')
  }

  const openMaintenanceTasks = facilityMaintenance
    .filter(task => task.status !== 'completed')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const availabilityTimeline = visibleUnits.map(unit => {
    const periods = [
      ...facilityRentals
        .filter(rental => matchesUnit(rental.unitId, unit) && ['active', 'return_requested', 'return_inspection', 'closing'].includes(rental.status))
        .map(rental => ({ id: rental.id, label: 'Hợp đồng thuê', customer: rental.customerName, startDate: rental.startDate, endDate: rental.endDate, variant: 'info' })),
      ...facilityReservations
        .filter(reservation => matchesUnit(reservation.assignedUnitId, unit) && activeReservationStatuses.includes(reservation.status))
        .map(reservation => ({ id: reservation.id, label: 'Đặt chỗ', customer: reservation.customerName, startDate: reservation.startDate, endDate: reservation.endDate, variant: 'warning' }))
    ].sort((left, right) => left.startDate.localeCompare(right.startDate))
    return { unit, periods }
  })

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        eyebrow="Tồn kho vật lý"
        title="Tồn kho gian kho"
        subtitle="Theo dõi công suất, thông số, tình trạng khai thác và bảo trì bằng dữ liệu hiện có."
        action={<Button onClick={() => setEditor({ mode: 'create' })}>Thêm gian kho</Button>}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Tổng gian kho" value={facilityUnits.length} icon={Icon.box} />
        <StatCard title="Còn trống" value={availableCount} icon={Icon.check} />
        <StatCard title="Đang sử dụng" value={occupiedCount} icon={Icon.key} />
        <StatCard title="Đã giữ hoặc có lịch" value={reservedCount} icon={Icon.calendar} />
        <StatCard title="Đang bảo trì" value={maintenanceCount} icon={Icon.tasks} />
        <StatCard title="Tỷ lệ lấp đầy" value={`${occupancy}%`} icon={Icon.chart} />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-stone-900">Năng lực khai thác hiện có</h2>
            <p className="mt-1 text-xs text-stone-500">Tổng hợp trực tiếp từ thông số của các gian kho thuộc cơ sở</p>
          </div>
          <b>{occupiedCount}/{facilityUnits.length} gian đang sử dụng</b>
        </div>
        <ProgressBar value={occupiedCount} max={Math.max(1, facilityUnits.length)} />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">Tổng diện tích</p><b className="mt-1 block text-lg">{totalArea.toLocaleString('vi-VN')} m²</b></div>
          <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">Tổng thể tích</p><b className="mt-1 block text-lg">{totalVolume.toLocaleString('vi-VN')} m³</b></div>
          <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">Tổng tải trọng cho phép</p><b className="mt-1 block text-lg">{totalLoad.toLocaleString('vi-VN')} kg</b></div>
          <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-700">Tổng giá thuê niêm yết mỗi tháng</p><b className="mt-1 block text-lg text-amber-900">{formatVnd(totalListedRent)}</b></div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã gian, khách hàng, hợp đồng hoặc đơn đặt chỗ…" />
          </div>
          <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Còn trống</option>
            <option value="reserved">Đã giữ chỗ</option>
            <option value="held">Đang giữ tạm thời</option>
            <option value="assigned">Được hệ thống cấp</option>
            <option value="occupied">Đang sử dụng</option>
            <option value="maintenance">Bảo trì</option>
          </Select>
          <Select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
            <option value="all">Tất cả loại gian kho</option>
            {types.map(type => <option key={type} value={type}>{managerUnitTypeLabel(type, 'vi')}</option>)}
          </Select>
          <Select value={floorFilter} onChange={event => setFloorFilter(event.target.value)}>
            <option value="all">Tất cả tầng</option>
            {floors.map(floor => <option key={floor} value={floor}>Tầng {floor}</option>)}
          </Select>
          <Select value={zoneFilter} onChange={event => setZoneFilter(event.target.value)}>
            <option value="all">Tất cả khu vực</option>
            {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </Select>
          <Select value={climateFilter} onChange={event => setClimateFilter(event.target.value)}>
            <option value="all">Mọi điều kiện nhiệt độ</option>
            <option value="yes">Có kiểm soát nhiệt độ</option>
            <option value="no">Không kiểm soát nhiệt độ</option>
          </Select>
          <Select value={maintenanceFilter} onChange={event => setMaintenanceFilter(event.target.value)}>
            <option value="all">Mọi tình trạng bảo trì</option>
            <option value="open">Có nhiệm vụ bảo trì</option>
            <option value="none">Không có nhiệm vụ bảo trì</option>
          </Select>
          <Select value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="code">Sắp xếp theo mã gian</option>
            <option value="area-desc">Diện tích từ lớn đến nhỏ</option>
            <option value="price-asc">Giá từ thấp đến cao</option>
            <option value="price-desc">Giá từ cao đến thấp</option>
            <option value="availability">Khả dụng sớm nhất</option>
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-500">
          <span>Hiển thị {visibleUnits.length} trên {facilityUnits.length} gian kho</span>
          <Button size="sm" variant="ghost" onClick={clearFilters}>Xóa bộ lọc</Button>
        </div>
      </Card>

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Gian kho</Th><Th>Sức chứa</Th><Th>Vị trí và điều kiện</Th><Th>Đang khai thác</Th><Th>Chi phí</Th><Th>Khả dụng</Th><Th>Thao tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {visibleUnits.map(unit => {
              const rental = activeRentalFor(unit)
              const reservation = activeReservationFor(unit)
              const maintenance = openMaintenanceFor(unit)
              return (
                <Tr key={unit.id}>
                  <Td>
                    <p className="font-mono font-bold text-stone-900">{unit.code}</p>
                    <div className="mt-1"><Badge variant={statusVariants[unit.status] || 'muted'}>{managerStatusLabel(unit.status, 'vi')}</Badge></div>
                    <p className="mt-1 text-xs text-stone-400">Lần cập nhật {unit.version}</p>
                  </Td>
                  <Td>
                    <p className="font-semibold">{managerUnitTypeLabel(unit.type, 'vi')}</p>
                    <p className="mt-1 text-xs text-stone-500">{unit.areaM2.toLocaleString('vi-VN')} m² · {unit.volumeM3.toLocaleString('vi-VN')} m³</p>
                    <p className="text-xs text-stone-500">Tối đa {unit.maxLoadKg.toLocaleString('vi-VN')} kg</p>
                  </Td>
                  <Td>
                    <p>Tầng {unit.floor} · {unit.zone}</p>
                    <p className="mt-1 text-xs text-stone-500">{unit.climate ? 'Có kiểm soát nhiệt độ' : 'Không kiểm soát nhiệt độ'}</p>
                  </Td>
                  <Td>
                    {rental ? <><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="text-xs text-stone-500">Hợp đồng {rental.id}</p></> : reservation ? <><p className="font-semibold text-stone-900">{reservation.customerName}</p><p className="text-xs text-stone-500">Đơn đặt chỗ {reservation.id}</p></> : <p className="text-sm text-stone-500">Chưa có người sử dụng</p>}
                    {maintenance && <p className="mt-1 text-xs text-amber-700">Có nhiệm vụ bảo trì</p>}
                  </Td>
                  <Td>
                    <p className="font-semibold">{formatVnd(unit.price)}/tháng</p>
                    <p className="mt-1 text-xs text-stone-500">Tiền đảm bảo {formatVnd(unit.deposit)}</p>
                  </Td>
                  <Td>
                    <p>{unit.status === 'available' ? 'Khả dụng ngay' : unit.nextAvailableDate ? formatDate(unit.nextAvailableDate) : 'Chưa xác định'}</p>
                    {unit.heldUntil && <p className="mt-1 text-xs text-stone-500">Giữ đến {formatDateTime(unit.heldUntil)}</p>}
                  </Td>
                  <Td className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedUnitId(unit.id)}>Xem chi tiết</Button></Td>
                </Tr>
              )
            })}
            {!visibleUnits.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">Không có gian kho phù hợp với bộ lọc.</td></tr>}
          </Tbody>
        </Table>
      </Card>

      <Card>
        <div className="border-b border-stone-200 p-4"><h2 className="font-bold text-stone-900">Lịch khả dụng tương lai</h2><p className="mt-1 text-xs text-stone-500">Đối chiếu các kỳ thuê và đặt chỗ đã có; đây là màn hình theo dõi, không thực hiện phân gian kho.</p></div>
        <Table>
          <Thead><tr><Th>Gian kho</Th><Th>Hiện tại</Th><Th>Các khoảng đã giữ</Th><Th>Khả dụng tiếp theo</Th></tr></Thead>
          <Tbody>{availabilityTimeline.map(({ unit, periods }) => <Tr key={`availability-${unit.id}`}><Td><p className="font-mono font-bold">{unit.code}</p><p className="text-xs text-stone-500">{managerUnitTypeLabel(unit.type, 'vi')} · Tầng {unit.floor}</p></Td><Td><Badge variant={statusVariants[unit.status] || 'muted'}>{managerStatusLabel(unit.status, 'vi')}</Badge></Td><Td>{periods.length ? <div className="space-y-2">{periods.map(period => <div key={`${unit.id}-${period.id}`} className="rounded-lg border border-stone-200 p-2 text-xs"><div className="flex items-center justify-between gap-2"><b>{period.label} · {period.id}</b><Badge variant={period.variant}>{formatDate(period.startDate)} – {formatDate(period.endDate)}</Badge></div><p className="mt-1 text-stone-500">{period.customer}</p></div>)}</div> : <span className="text-sm text-stone-500">Không có kỳ giữ chỗ</span>}</Td><Td><b>{unit.status === 'available' && !periods.length ? 'Khả dụng ngay' : formatDate(unit.nextAvailableDate || periods.at(-1)?.endDate)}</b>{unit.status === 'maintenance' && <p className="mt-1 text-xs text-amber-700">Chờ nghiệm thu bảo trì</p>}</Td></Tr>)}</Tbody>
        </Table>
      </Card>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Theo dõi xử lý</p>
          <h2 className="mt-1 text-lg font-bold text-stone-900">Hàng đợi bảo trì</h2>
        </div>
        {openMaintenanceTasks.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {openMaintenanceTasks.map(task => {
              const unit = facilityUnits.find(item => matchesUnit(task.unitId, item))
              return <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-mono font-bold text-stone-900">{unit?.code || task.unitId}</p><p className="mt-1 text-xs text-stone-500">Tạo lúc {formatDateTime(task.createdAt)}</p></div><Badge variant={task.status === 'in_progress' ? 'info' : 'warning'}>{managerStatusLabel(task.status, 'vi')}</Badge></div>
                <p className="mt-3 text-sm text-stone-700">{normalizeOperationalText(task.reason)}</p>
                <div className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500"><p>Người phụ trách: <b className="text-stone-700">{task.assignedStaffName || 'Chưa phân công'}</b></p><p className="mt-1">Mức hư hỏng: <b className="text-stone-700">{damageLabel(task.damageClassification)}</b></p></div>
                {unit && <div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedUnitId(unit.id)}>Xem gian kho</Button><Button size="sm" onClick={() => onCreateMaintenanceWork({ referenceId: task.id, title: `Bảo trì hoặc vệ sinh gian ${unit.code}`, notes: normalizeOperationalText(task.reason) })}>Phân công staff</Button></div>}
              </Card>
            })}
          </div>
        ) : <Card className="p-8 text-center text-sm text-stone-500">Không có nhiệm vụ bảo trì đang mở.</Card>}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-stone-200 p-4"><h2 className="font-bold text-stone-900">Công suất theo loại gian kho</h2></div>
          <Table>
            <Thead><tr><Th>Loại gian</Th><Th>Tổng</Th><Th>Trống</Th><Th>Đang dùng</Th><Th>Đã giữ</Th><Th>Bảo trì</Th><Th>Lấp đầy</Th></tr></Thead>
            <Tbody>{capacityByType.map(item => <Tr key={item.key}><Td className="font-semibold">{item.label}</Td><Td>{item.total}</Td><Td>{item.available}</Td><Td>{item.used}</Td><Td>{item.reserved}</Td><Td>{item.maintenance}</Td><Td><div className="min-w-20"><span className="text-xs">{item.occupancy}%</span><ProgressBar value={item.occupancy} /></div></Td></Tr>)}</Tbody>
          </Table>
        </Card>
        <Card>
          <div className="border-b border-stone-200 p-4"><h2 className="font-bold text-stone-900">Phân bổ theo khu vực</h2></div>
          <Table>
            <Thead><tr><Th>Khu vực</Th><Th>Tầng</Th><Th>Tổng</Th><Th>Trống</Th><Th>Đang dùng</Th><Th>Bảo trì</Th></tr></Thead>
            <Tbody>{capacityByZone.map(item => <Tr key={item.zone}><Td className="font-semibold">{item.zone}</Td><Td>{item.floors}</Td><Td>{item.total}</Td><Td>{item.available}</Td><Td>{item.occupied}</Td><Td>{item.maintenance}</Td></Tr>)}</Tbody>
          </Table>
        </Card>
      </div>

      <Card>
        <div className="border-b border-stone-200 p-4">
          <h2 className="font-bold text-stone-900">Danh mục loại kho dùng chung</h2>
          <p className="mt-1 text-xs text-stone-500">Thông số chuẩn được đọc trực tiếp từ dữ liệu hệ thống và được áp dụng khi thêm gian kho. Manager không thay đổi bảng giá hoặc định nghĩa loại kho trung tâm tại màn hình này.</p>
        </div>
        <Table>
          <Thead><tr><Th>Loại kho</Th><Th>Kích thước chuẩn</Th><Th>Diện tích / thể tích</Th><Th>Tải trọng</Th><Th>Giá chuẩn</Th><Th>Tại cơ sở</Th></tr></Thead>
          <Tbody>{unitTypes.map(definition => {
            const type: StorageUnit['type'] = definition.id === 'xlarge' ? 'Extra Large' : definition.id === 'large' ? 'Large' : definition.id === 'medium' ? 'Medium' : 'Small'
            const actualUnits = facilityUnits.filter(unit => unit.type === type)
            return <Tr key={definition.id}>
              <Td><p className="font-semibold text-stone-900">{definition.name}</p><p className="mt-1 max-w-xs text-xs text-stone-500">{definition.descriptionVi}</p></Td>
              <Td>{definition.lengthM} × {definition.widthM} × {definition.heightM} m</Td>
              <Td>{definition.areaM2.toLocaleString('vi-VN')} m² · {definition.volumeM3.toLocaleString('vi-VN')} m³</Td>
              <Td>{definition.maxLoadKg.toLocaleString('vi-VN')} kg</Td>
              <Td><b>{formatVnd(definition.monthlyPrice)}/tháng</b><p className="mt-1 text-xs text-stone-500">{formatVnd(definition.pricePerM3)}/m³</p></Td>
              <Td><b>{actualUnits.length} gian</b><p className="mt-1 text-xs text-stone-500">{actualUnits.filter(unit => unit.status === 'available').length} trống · {actualUnits.filter(unit => unit.status === 'occupied').length} đang dùng · {actualUnits.filter(unit => unit.status === 'maintenance').length} bảo trì</p></Td>
            </Tr>
          })}</Tbody>
        </Table>
      </Card>

      <Modal open={Boolean(selectedUnit)} onClose={() => setSelectedUnitId(null)} title="Chi tiết gian kho" size="xl">
        {selectedUnit && (() => {
          const rental = activeRentalFor(selectedUnit)
          const reservation = activeReservationFor(selectedUnit)
          const unitCheckins = checkins.filter(item => matchesUnit(item.unitId, selectedUnit)).sort((left, right) => (right.completedAt || right.scheduledDate).localeCompare(left.completedAt || left.scheduledDate))
          const latestCheckin = unitCheckins[0]
          const unitReturns = returns.filter(item => matchesUnit(item.unitId, selectedUnit)).sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
          const latestReturn = unitReturns[0]
          const unitMaintenance = facilityMaintenance.filter(item => matchesUnit(item.unitId, selectedUnit)).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          const unitActivities = facilityActivities.filter(item => item.entityType === 'unit' && matchesUnit(item.entityId, selectedUnit)).sort((left, right) => parseManagerActivityTimestamp(right.timestamp) - parseManagerActivityTimestamp(left.timestamp)).slice(0, 5)
          const hasOperationalLock = managerUnitHasOperationalLock(selectedUnit.id, facilityReservations, facilityRentals)
          return <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4"><div><p className="font-mono text-lg font-bold text-stone-900">{selectedUnit.code}</p><p className="mt-1 text-stone-500">{selectedUnit.facilityName} · Tầng {selectedUnit.floor} · {selectedUnit.zone}</p></div><Badge variant={statusVariants[selectedUnit.status] || 'muted'}>{managerStatusLabel(selectedUnit.status, 'vi')}</Badge></div>

            <div>
              <h3 className="mb-3 font-bold text-stone-900">Thông số vật lý</h3>
              <div className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="text-stone-500">Loại gian kho</span><br /><b>{managerUnitTypeLabel(selectedUnit.type, 'vi')}</b></p>
                <p><span className="text-stone-500">Kích thước trong</span><br /><b>{selectedUnit.dimensions.lengthM} × {selectedUnit.dimensions.widthM} × {selectedUnit.dimensions.heightM} m</b></p>
                <p><span className="text-stone-500">Kích thước cửa</span><br /><b>{selectedUnit.doorDimensions.widthM} × {selectedUnit.doorDimensions.heightM} m</b></p>
                <p><span className="text-stone-500">Diện tích</span><br /><b>{selectedUnit.areaM2.toLocaleString('vi-VN')} m²</b></p>
                <p><span className="text-stone-500">Thể tích</span><br /><b>{selectedUnit.volumeM3.toLocaleString('vi-VN')} m³</b></p>
                <p><span className="text-stone-500">Tải trọng tối đa</span><br /><b>{selectedUnit.maxLoadKg.toLocaleString('vi-VN')} kg</b></p>
                <p><span className="text-stone-500">Điều kiện nhiệt độ</span><br /><b>{selectedUnit.climate ? 'Có kiểm soát nhiệt độ' : 'Không kiểm soát nhiệt độ'}</b></p>
                <p><span className="text-stone-500">Lần cập nhật</span><br /><b>{selectedUnit.version}</b></p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Chi phí và khả dụng</h3><div className="space-y-2"><p className="flex justify-between gap-3"><span className="text-stone-500">Giá thuê mỗi tháng</span><b>{formatVnd(selectedUnit.price)}</b></p><p className="flex justify-between gap-3"><span className="text-stone-500">Tiền đảm bảo</span><b>{formatVnd(selectedUnit.deposit)}</b></p><p className="flex justify-between gap-3"><span className="text-stone-500">Ngày khả dụng tiếp theo</span><b>{selectedUnit.status === 'available' ? 'Khả dụng ngay' : formatDate(selectedUnit.nextAvailableDate)}</b></p><p className="flex justify-between gap-3"><span className="text-stone-500">Giữ tạm thời đến</span><b>{selectedUnit.heldUntil ? formatDateTime(selectedUnit.heldUntil) : 'Không có'}</b></p></div></Card>
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Tình trạng khai thác</h3>{rental ? <div className="space-y-2"><p>Khách hàng: <b>{rental.customerName}</b></p><p>Mã hợp đồng: <b className="font-mono">{rental.id}</b></p><p>Thời hạn: <b>{formatDate(rental.startDate)} – {formatDate(rental.endDate)}</b></p><p>Kỳ thanh toán tiếp theo: <b>{formatDate(rental.nextDue)}</b></p><p>Thanh toán: <Badge variant={isManagerRentalOverdue(rental) ? 'error' : rental.paymentStatus === 'paid' ? 'success' : 'warning'}>{managerStatusLabel(isManagerRentalOverdue(rental) ? 'overdue' : rental.paymentStatus, 'vi')}</Badge></p></div> : reservation ? <div className="space-y-2"><p>Khách hàng: <b>{reservation.customerName}</b></p><p>Mã đơn đặt chỗ: <b className="font-mono">{reservation.id}</b></p><p>Thời gian dự kiến: <b>{formatDate(reservation.startDate)} – {formatDate(reservation.endDate)}</b></p><p>Trạng thái: <Badge variant="warning">{managerStatusLabel(reservation.status, 'vi')}</Badge></p></div> : <p className="text-stone-500">Gian kho chưa có hợp đồng hoặc đơn đặt chỗ hiệu lực.</p>}</Card>
            </div>

            {selectedUnit.reservedPeriods?.length ? <div><h3 className="mb-3 font-bold text-stone-900">Các khoảng thời gian đã giữ</h3><div className="grid gap-2 sm:grid-cols-2">{selectedUnit.reservedPeriods.map(period => <div key={`${period.reservationId}-${period.startDate}`} className="rounded-lg border border-stone-200 p-3"><p className="font-semibold">{period.customerName}</p><p className="mt-1 font-mono text-xs text-stone-500">{period.reservationId}</p><p className="mt-1 text-xs">{formatDate(period.startDate)} – {formatDate(period.endDate)}</p></div>)}</div></div> : null}

            {latestCheckin && <div><h3 className="mb-3 font-bold text-stone-900">Biên bản nhận kho gần nhất</h3><div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-stone-500">Trạng thái</span><br /><b>{managerStatusLabel(latestCheckin.status, 'vi')}</b></p><p><span className="text-stone-500">Khối lượng thực tế</span><br /><b>{latestCheckin.actualMeasurements.weightKg.toLocaleString('vi-VN')} kg</b></p><p><span className="text-stone-500">Thể tích thực tế</span><br /><b>{latestCheckin.actualMeasurements.actualVolumeM3.toLocaleString('vi-VN')} m³</b></p><p><span className="text-stone-500">Số kiện bàn giao</span><br /><b>{latestCheckin.goodsHandover?.packageCount ?? 'Chưa ghi nhận'}</b></p><p className="sm:col-span-2 lg:col-span-4"><span className="text-stone-500">Tình trạng ban đầu</span><br /><b>{normalizeOperationalText(latestCheckin.initialCondition)}</b></p></div></div>}

            {latestReturn && <div><h3 className="mb-3 font-bold text-stone-900">Hồ sơ trả kho gần nhất</h3><div className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-stone-500">Trạng thái</span><br /><b>{managerStatusLabel(latestReturn.status, 'vi')}</b></p><p><span className="text-stone-500">Ngày dự kiến trả</span><br /><b>{formatDate(latestReturn.scheduledDate)}</b></p><p><span className="text-stone-500">Đối chiếu hàng hóa</span><br /><b>{latestReturn.inventoryMatch === 'match' ? 'Khớp' : latestReturn.inventoryMatch === 'missing' ? 'Thiếu' : latestReturn.inventoryMatch === 'excess' ? 'Thừa' : 'Chưa ghi nhận'}</b></p><p><span className="text-stone-500">Phân loại hư hỏng</span><br /><b>{damageLabel(latestReturn.damageClassification)}</b></p></div></div>}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Hàng hóa được phép</h3><ul className="space-y-2">{selectedUnit.allowedGoods.map(item => <li key={item} className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{item}</li>)}</ul></Card>
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Hàng hóa bị cấm</h3><ul className="space-y-2">{selectedUnit.prohibitedGoods.map(item => <li key={item} className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{item}</li>)}</ul></Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Lịch sử bảo trì</h3>{unitMaintenance.length ? <div className="space-y-3">{unitMaintenance.slice(0, 5).map(task => <div key={task.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><b>{formatDateTime(task.createdAt)}</b><Badge variant={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : 'warning'}>{managerStatusLabel(task.status, 'vi')}</Badge></div><p className="mt-1 text-stone-600">{normalizeOperationalText(task.reason)}</p><p className="mt-1 text-xs text-stone-500">Người phụ trách: {task.assignedStaffName || 'Chưa phân công'}</p></div>)}</div> : <p className="text-stone-500">Chưa có nhiệm vụ bảo trì.</p>}</Card>
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Hoạt động gần đây</h3>{unitActivities.length ? <div className="space-y-3">{unitActivities.map(activity => <div key={activity.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0"><p className="font-semibold">{managerActivityLabel(activity.action, 'vi')}</p><p className="mt-1 text-xs text-stone-500">{formatDateTime(activity.timestamp)} · {activity.actorName}</p></div>)}</div> : <p className="text-stone-500">Chưa có hoạt động nào được ghi nhận.</p>}</Card>
            </div>

            {selectedUnit.conditionNotes && <div className="rounded-lg bg-amber-50 p-4"><p className="font-semibold text-amber-900">Ghi chú tình trạng</p><p className="mt-1 text-amber-800">{normalizeOperationalText(selectedUnit.conditionNotes)}</p></div>}

            {hasOperationalLock && <ManagerActionNotice tone="warning">Không thể sửa thông tin hoặc đổi trạng thái vì gian kho còn đặt chỗ, hợp đồng thuê hoặc hồ sơ trả kho chưa hoàn tất.</ManagerActionNotice>}
            {!hasOperationalLock && !['available', 'maintenance'].includes(selectedUnit.status) && <ManagerActionNotice>Trạng thái hiện tại được điều khiển bởi luồng đặt chỗ hoặc bàn giao. Manager chỉ thao tác lại khi gian kho chuyển sang còn trống hoặc bảo trì.</ManagerActionNotice>}
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setSelectedUnitId(null)}>Đóng</Button>{!hasOperationalLock && ['available', 'maintenance'].includes(selectedUnit.status) && <Button variant="outline" onClick={() => { setSelectedUnitId(null); setEditor({ mode: 'edit', unitId: selectedUnit.id }) }}>Sửa thông tin</Button>}{selectedUnit.status === 'available' && <Button variant="outline" onClick={() => openStatusModal(selectedUnit, 'maintenance')}>Đưa vào bảo trì</Button>}{selectedUnit.status === 'maintenance' && !hasOperationalLock && <Button onClick={() => openStatusModal(selectedUnit, 'available')}>Nghiệm thu và mở lại</Button>}</div>
          </div>
        })()}
      </Modal>

      <Modal open={Boolean(statusUnit)} onClose={() => setStatusUnitId(null)} title={targetStatus === 'maintenance' ? 'Chuyển sang bảo trì' : 'Nghiệm thu và mở lại gian kho'}>
        {statusUnit && <div className="space-y-4"><div className="rounded-lg bg-stone-50 p-3 text-sm"><b className="font-mono">{statusUnit.code}</b> · {managerUnitTypeLabel(statusUnit.type, 'vi')} · {statusUnit.facilityName}</div><Input label="Lý do hoặc ghi chú nghiệm thu" value={reason} onChange={event => setReason(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStatusUnitId(null)}>Hủy</Button><Button disabled={!reason.trim()} onClick={saveStatus}>Xác nhận</Button></div></div>}
      </Modal>

      <ManagerUnitEditor
        open={Boolean(editor)}
        mode={editor?.mode || 'create'}
        unit={editorUnit}
        unitTypes={unitTypes}
        facilityUnits={facilityUnits}
        policyUnits={units}
        allUnitCodes={units.map(unit => unit.code)}
        facilityId={facilityId}
        facilityName={facilityName}
        user={user}
        canDelete={canDeleteEditorUnit}
        deleteBlockedReason={deleteBlockedReason}
        createUnit={createUnit}
        updateUnit={updateUnit}
        deleteUnit={deleteUnit}
        onClose={() => setEditor(null)}
        onSaved={unitId => { setEditor(null); setSelectedUnitId(unitId) }}
        showToast={showToast}
      />
    </div>
  )
}
