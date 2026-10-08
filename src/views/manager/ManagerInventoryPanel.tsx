import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, ProgressBar, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { ActivityRecord, CheckInRecord, MaintenanceTask, RentalRecord, ReturnCase, StorageReservation, StorageUnit, UnitType } from '../../types/storageHub'
import { isManagerFacilityVisible, isManagerRentalOverdue, managerUnitHasOperationalLock, parseManagerActivityTimestamp } from '../../domain/managerRules'
import { managerActivityLabel, managerStatusLabel, managerUnitTypeLabel } from './managerI18n'
import ManagerUnitEditor from './ManagerUnitEditor'
import ManagerActionNotice from './ManagerActionNotice'
import ManagerPagination from './ManagerPagination'
import { formatManagerMoney, matchesManagerSearch, normalizeManagerMoney, paginateManagerItems } from './managerList'
import useManagerSoftDelete from './useManagerSoftDelete'

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
const operationalRentalStatuses: RentalRecord['status'][] = ['active', 'return_requested', 'return_inspection', 'closing']

interface AvailabilityPeriod {
  id: string
  label: string
  customer: string
  startDate: string
  endDate: string
  variant: string
}

const unitStatusLabel = (status: StorageUnit['status']) => {
  if (status === 'reserved' || status === 'assigned') return 'Đã phân gian'
  if (status === 'held') return 'Đang giữ tạm thời'
  return managerStatusLabel(status, 'vi')
}

const datePart = (value?: string) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ''

const parseDisplayDate = (value?: string) => {
  if (!value) return null
  const isoDate = datePart(value)
  const parsed = new Date(isoDate ? `${isoDate}T00:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDate = (value?: string) => {
  const parsed = parseDisplayDate(value)
  return parsed ? parsed.toLocaleDateString('vi-VN') : 'Chưa xác định'
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
  const [sortBy, setSortBy] = useState('attention')
  const [unitPage, setUnitPage] = useState(1)
  const [unitPageSize, setUnitPageSize] = useState(10)
  const [availabilityPage, setAvailabilityPage] = useState(1)
  const [availabilityPageSize, setAvailabilityPageSize] = useState(10)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [statusUnitId, setStatusUnitId] = useState<string | null>(null)
  const [targetStatus, setTargetStatus] = useState<'available' | 'maintenance'>('maintenance')
  const [reason, setReason] = useState('')
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; unitId?: string } | null>(null)
  const maintenanceHistory = useManagerSoftDelete(`storagehub:manager:${user.id}:hidden-maintenance`)
  const activityHistory = useManagerSoftDelete(`storagehub:manager:${user.id}:hidden-activities`)

  const facilityUnits = useMemo(
    () => units.filter(unit => isManagerFacilityVisible(user, unit.facilityId, unit.facilityName)),
    [units, user]
  )
  const facilityIds = useMemo(() => new Set(facilityUnits.map(unit => unit.facilityId)), [facilityUnits])
  const facilityRentals = useMemo(() => rentals.filter(item => facilityIds.has(item.facilityId)), [rentals, facilityIds])
  const facilityReservations = useMemo(() => reservations.filter(item => facilityIds.has(item.facilityId)), [reservations, facilityIds])
  const facilityMaintenance = useMemo(() => maintenanceTasks.filter(item => facilityIds.has(item.facilityId)), [maintenanceTasks, facilityIds])
  const facilityReturns = useMemo(() => returns.filter(item => facilityIds.has(item.facilityId)), [returns, facilityIds])
  const facilityActivities = useMemo(() => activities.filter(item => facilityIds.has(item.facilityId)), [activities, facilityIds])

  const matchesUnit = (value: string | undefined, unit: StorageUnit) => value === unit.id || value === unit.code
  const operationalRentalFor = (unit: StorageUnit) => facilityRentals.find(item => matchesUnit(item.unitId, unit) && operationalRentalStatuses.includes(item.status))
  const activeReservationFor = (unit: StorageUnit) => facilityReservations.find(item => matchesUnit(item.assignedUnitId, unit) && activeReservationStatuses.includes(item.status))
  const openMaintenanceFor = (unit: StorageUnit) => facilityMaintenance.find(item => matchesUnit(item.unitId, unit) && item.status !== 'completed')
  const pendingReturnFor = (unit: StorageUnit, rental?: RentalRecord) => facilityReturns.find(item => (
    matchesUnit(item.unitId, unit) || item.rentalId === rental?.id
  ) && item.status !== 'completed')

  const scheduledPeriodsFor = (unit: StorageUnit): AvailabilityPeriod[] => [
    ...facilityRentals
      .filter(rental => matchesUnit(rental.unitId, unit) && operationalRentalStatuses.includes(rental.status))
      .map(rental => ({ id: rental.id, label: 'Hồ sơ thuê', customer: rental.customerName, startDate: rental.startDate, endDate: rental.endDate, variant: 'info' })),
    ...facilityReservations
      .filter(reservation => matchesUnit(reservation.assignedUnitId, unit) && activeReservationStatuses.includes(reservation.status))
      .map(reservation => ({ id: reservation.id, label: 'Đặt chỗ', customer: reservation.customerName, startDate: reservation.startDate, endDate: reservation.endDate, variant: 'warning' }))
  ].sort((left, right) => left.startDate.localeCompare(right.startDate))

  const availabilityFor = (unit: StorageUnit, periods = scheduledPeriodsFor(unit)) => {
    const rental = operationalRentalFor(unit)
    const pendingReturn = pendingReturnFor(unit, rental)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const futurePeriodStarts = periods
      .map(period => parseDisplayDate(period.startDate))
      .filter((date): date is Date => Boolean(date && date >= today))
      .sort((left, right) => left.getTime() - right.getTime())
    const futureReleaseDates = [unit.nextAvailableDate, ...periods.map(period => period.endDate)]
      .map(value => parseDisplayDate(value))
      .filter((date): date is Date => Boolean(date && date >= today))
      .sort((left, right) => right.getTime() - left.getTime())
    const plannedRentalEnd = parseDisplayDate(rental?.endDate)

    if (unit.status === 'available') {
      return {
        label: 'Khả dụng ngay',
        detail: futurePeriodStarts[0] ? `Có lịch sử dụng từ ${futurePeriodStarts[0].toLocaleDateString('vi-VN')}` : undefined,
        sortKey: '0'
      }
    }
    if (unit.status === 'maintenance') return { label: 'Chờ hoàn tất bảo trì', detail: undefined, sortKey: '9-maintenance' }
    if (unit.status === 'occupied') {
      const detail = plannedRentalEnd ? `Dự kiến kết thúc thuê: ${plannedRentalEnd.toLocaleDateString('vi-VN')}` : undefined
      if (pendingReturn || rental?.status === 'return_requested' || rental?.status === 'return_inspection' || rental?.status === 'closing') {
        return { label: 'Chờ trả kho / kiểm tra', detail, sortKey: '8-return' }
      }
      return {
        label: 'Chưa xác định',
        detail: detail || 'Chưa có ngày kết thúc thuê hợp lệ',
        sortKey: plannedRentalEnd && plannedRentalEnd >= today ? `7-${datePart(rental?.endDate)}` : '8-occupied'
      }
    }
    if (unit.status === 'held') {
      return {
        label: 'Chưa xác định',
        detail: unit.heldUntil ? `Giữ tạm thời đến ${formatDateTime(unit.heldUntil)}` : 'Đang giữ tạm thời',
        sortKey: '6-held'
      }
    }
    if (unit.status === 'reserved' || unit.status === 'assigned') {
      const releaseDate = futureReleaseDates[0]
      return releaseDate
        ? { label: `Dự kiến từ ${releaseDate.toLocaleDateString('vi-VN')}`, detail: undefined, sortKey: `5-${releaseDate.toISOString()}` }
        : { label: 'Chưa xác định', detail: 'Chưa đủ dữ liệu kỳ sử dụng', sortKey: '8-allocated' }
    }
    return { label: 'Chưa xác định', detail: undefined, sortKey: '9-unknown' }
  }

  const types = useMemo(() => Array.from(new Set(facilityUnits.map(unit => unit.type))).sort(), [facilityUnits])
  const floors = useMemo(() => Array.from(new Set(facilityUnits.map(unit => unit.floor))).sort((a, b) => a - b), [facilityUnits])
  const zones = useMemo(() => Array.from(new Set(facilityUnits.map(unit => unit.zone))).sort(), [facilityUnits])

  const visibleUnits = useMemo(() => {
    const filtered = facilityUnits.filter(unit => {
      const rental = operationalRentalFor(unit)
      const reservation = activeReservationFor(unit)
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
        (statusFilter === 'all' || (statusFilter === 'allocated' ? ['reserved', 'assigned'].includes(unit.status) : unit.status === statusFilter)) &&
        (typeFilter === 'all' || unit.type === typeFilter) &&
        (floorFilter === 'all' || String(unit.floor) === floorFilter) &&
        (zoneFilter === 'all' || unit.zone === zoneFilter) &&
        (climateFilter === 'all' || (climateFilter === 'yes' ? unit.climate : !unit.climate)) &&
        (maintenanceFilter === 'all' || (maintenanceFilter === 'maintenance' ? unit.status === 'maintenance' : unit.status !== 'maintenance')) &&
        matchesManagerSearch(query, searchValues)
      )
    })

    return filtered.sort((left, right) => {
      if (sortBy === 'attention') {
        const rank = (unit: StorageUnit) => openMaintenanceFor(unit) || unit.status === 'maintenance' ? 0 : ['held', 'reserved', 'assigned'].includes(unit.status) ? 1 : unit.status === 'occupied' ? 2 : 3
        const difference = rank(left) - rank(right)
        if (difference) return difference
      }
      if (sortBy === 'area-desc') return right.areaM2 - left.areaM2
      if (sortBy === 'price-asc') return left.price - right.price
      if (sortBy === 'price-desc') return right.price - left.price
      if (sortBy === 'availability') {
        return availabilityFor(left).sortKey.localeCompare(availabilityFor(right).sortKey)
      }
      return left.code.localeCompare(right.code)
    })
  }, [facilityUnits, facilityRentals, facilityReservations, facilityMaintenance, facilityReturns, query, statusFilter, typeFilter, floorFilter, zoneFilter, climateFilter, maintenanceFilter, sortBy])
  const unitPagination = paginateManagerItems(visibleUnits, unitPage, unitPageSize)

  const availableCount = facilityUnits.filter(unit => unit.status === 'available').length
  const occupiedCount = facilityUnits.filter(unit => unit.status === 'occupied').length
  const reservedCount = facilityUnits.filter(unit => ['reserved', 'assigned'].includes(unit.status)).length
  const heldCount = facilityUnits.filter(unit => unit.status === 'held').length
  const maintenanceCount = facilityUnits.filter(unit => unit.status === 'maintenance').length
  const classifiedUnitCount = availableCount + occupiedCount + reservedCount + heldCount + maintenanceCount
  const knownUnitStatuses: StorageUnit['status'][] = ['available', 'reserved', 'assigned', 'held', 'occupied', 'maintenance']
  const unclassifiedUnits = facilityUnits.filter(unit => !knownUnitStatuses.includes(unit.status))
  const inconsistentOccupiedUnits = facilityUnits.filter(unit => unit.status === 'occupied' && !operationalRentalFor(unit))
  const occupancy = facilityUnits.length ? Math.round((occupiedCount / facilityUnits.length) * 100) : 0
  const totalArea = facilityUnits.reduce((sum, unit) => sum + unit.areaM2, 0)
  const totalVolume = facilityUnits.reduce((sum, unit) => sum + unit.volumeM3, 0)
  const totalLoad = facilityUnits.reduce((sum, unit) => sum + unit.maxLoadKg, 0)
  const totalListedRent = facilityUnits.reduce((sum, unit) => sum + (normalizeManagerMoney(unit.price) ?? 0), 0)

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
        reserved: typeUnits.filter(unit => ['reserved', 'assigned'].includes(unit.status)).length,
        held: typeUnits.filter(unit => unit.status === 'held').length,
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
        reserved: zoneUnits.filter(unit => ['reserved', 'assigned'].includes(unit.status)).length,
        held: zoneUnits.filter(unit => unit.status === 'held').length,
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
      : 'Gian kho đang có ràng buộc đặt chỗ hoặc hồ sơ thuê.'

  const openStatusModal = (unit: StorageUnit, status: 'available' | 'maintenance') => {
    const hasOperationalLock = managerUnitHasOperationalLock(unit.id, facilityReservations, facilityRentals)
    const hasOpenMaintenance = Boolean(openMaintenanceFor(unit))
    if (status === 'maintenance' && (unit.status !== 'available' || hasOperationalLock)) {
      return showToast('Chỉ có thể chuyển sang bảo trì khi gian đang còn trống và không có ràng buộc thuê hoặc đặt chỗ.')
    }
    if (status === 'available' && (unit.status !== 'maintenance' || hasOperationalLock || hasOpenMaintenance)) {
      return showToast('Chỉ có thể mở lại gian bảo trì sau khi Staff hoàn tất nhiệm vụ và không còn ràng buộc vận hành.')
    }
    setSelectedUnitId(null)
    setStatusUnitId(unit.id)
    setTargetStatus(status)
    setReason(status === 'maintenance' ? 'Kiểm tra và bảo trì theo yêu cầu vận hành' : 'Nhiệm vụ bảo trì đã hoàn tất; Manager xác nhận gian sẵn sàng khai thác')
  }

  const saveStatus = () => {
    if (!statusUnit) return
    const hasOperationalLock = managerUnitHasOperationalLock(statusUnit.id, facilityReservations, facilityRentals)
    const hasOpenMaintenance = Boolean(openMaintenanceFor(statusUnit))
    if (targetStatus === 'maintenance' && (statusUnit.status !== 'available' || hasOperationalLock)) {
      return showToast('Trạng thái gian đã thay đổi hoặc đang có ràng buộc vận hành. Không thể chuyển sang bảo trì.')
    }
    if (targetStatus === 'available' && (statusUnit.status !== 'maintenance' || hasOperationalLock || hasOpenMaintenance)) {
      return showToast('Chưa thể mở lại gian kho khi nhiệm vụ bảo trì hoặc ràng buộc vận hành chưa hoàn tất.')
    }
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
    setSortBy('attention')
  }

  const openMaintenanceTasks = facilityMaintenance
    .filter(task => task.status !== 'completed')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const availabilityTimeline = visibleUnits.map(unit => {
    return { unit, periods: scheduledPeriodsFor(unit) }
  })
  const availabilityPagination = paginateManagerItems(availabilityTimeline, availabilityPage, availabilityPageSize)

  useEffect(() => {
    setUnitPage(1)
    setAvailabilityPage(1)
  }, [query, statusFilter, typeFilter, floorFilter, zoneFilter, climateFilter, maintenanceFilter, sortBy, unitPageSize, availabilityPageSize])

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        eyebrow="Vận hành cơ sở"
        title="Quản lý gian kho"
        subtitle="Theo dõi trạng thái, vị trí, loại gian, khả dụng và tình trạng vận hành của các gian kho thuộc cơ sở đang quản lý."
        action={<Button onClick={() => setEditor({ mode: 'create' })}>Thêm gian kho</Button>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard title="Tổng số gian" value={facilityUnits.length} icon={Icon.box} />
        <StatCard title="Còn trống" value={availableCount} icon={Icon.check} />
        <StatCard title="Đang sử dụng" value={occupiedCount} icon={Icon.key} />
        <StatCard title="Đã phân gian" value={reservedCount} icon={Icon.calendar} />
        <StatCard title="Đang bảo trì" value={maintenanceCount} icon={Icon.tasks} />
      </div>

      {inconsistentOccupiedUnits.length > 0 && <ManagerActionNotice tone="warning">
        {inconsistentOccupiedUnits.length} gian đang có trạng thái “Đang sử dụng” nhưng chưa tìm thấy hồ sơ thuê vận hành tương ứng: {inconsistentOccupiedUnits.map(unit => unit.code).join(', ')}. Dữ liệu dùng chung không bị tự động sửa.
      </ManagerActionNotice>}
      {unclassifiedUnits.length > 0 && <ManagerActionNotice tone="warning">
        Đã phân loại {classifiedUnitCount}/{facilityUnits.length} gian. Không thể phân loại trạng thái của {unclassifiedUnits.length} gian: {unclassifiedUnits.map(unit => unit.code).join(', ')}. Tổng số theo trạng thái không được tự động điều chỉnh.
      </ManagerActionNotice>}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã gian, khách hàng, hồ sơ thuê hoặc đơn đặt chỗ…" />
          </div>
          <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Còn trống</option>
            <option value="allocated">Đã phân gian</option>
            <option value="held">Đang giữ tạm thời</option>
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
          <Select label="Trạng thái bảo trì" value={maintenanceFilter} onChange={event => setMaintenanceFilter(event.target.value)}>
            <option value="all">Tất cả gian kho</option>
            <option value="maintenance">Kho đang bảo trì</option>
            <option value="none">Kho không bảo trì</option>
          </Select>
          <Select value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="attention">Cần chú ý trước</option>
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
              <Th>Gian kho</Th><Th>Loại / Kích thước</Th><Th>Vị trí</Th><Th>Trạng thái</Th><Th>Thuê hiện tại</Th><Th>Giá áp dụng</Th><Th>Khả dụng</Th><Th>Thao tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {unitPagination.items.map(unit => {
              const rental = operationalRentalFor(unit)
              const reservation = activeReservationFor(unit)
              const maintenance = openMaintenanceFor(unit)
              const availability = availabilityFor(unit)
              return (
                <Tr key={unit.id}>
                  <Td>
                    <p className="font-mono font-bold text-stone-900">{unit.code}</p>
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
                    <Badge variant={statusVariants[unit.status] || 'muted'}>{unitStatusLabel(unit.status)}</Badge>
                    {unit.status === 'maintenance' && maintenance && <p className="mt-1 text-xs text-amber-700">Có phiếu bảo trì đang mở</p>}
                  </Td>
                  <Td>
                    {rental ? <><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="text-xs text-stone-500">Hồ sơ thuê {rental.id}</p><p className="mt-1 text-xs text-stone-500">Dự kiến kết thúc {formatDate(rental.endDate)} · {managerStatusLabel(rental.status, 'vi')}</p></> : reservation ? <><p className="font-semibold text-stone-900">{reservation.customerName}</p><p className="text-xs text-stone-500">Đơn đặt chỗ {reservation.id}</p></> : unit.status === 'occupied' ? <p className="text-xs font-medium text-red-700">Thiếu hồ sơ thuê tương ứng với trạng thái đang sử dụng</p> : <p className="text-sm text-stone-500">Chưa có người sử dụng</p>}
                  </Td>
                  <Td>
                    <p className="font-semibold">{formatManagerMoney(unit.price)}/tháng</p>
                    <p className="mt-1 text-xs text-stone-500">Giá chuẩn theo loại gian</p>
                  </Td>
                  <Td>
                    <p className="font-medium">{availability.label}</p>
                    {availability.detail && <p className="mt-1 text-xs text-stone-500">{availability.detail}</p>}
                  </Td>
                  <Td className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedUnitId(unit.id)}>Xem chi tiết</Button></Td>
                </Tr>
              )
            })}
            {!visibleUnits.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">Không có gian kho phù hợp với bộ lọc.</td></tr>}
          </Tbody>
        </Table>
        <ManagerPagination {...unitPagination} pageSize={unitPageSize} onPageChange={setUnitPage} onPageSizeChange={setUnitPageSize} />
      </Card>

      <Card>
        <div className="border-b border-stone-200 p-4"><h2 className="font-bold text-stone-900">Lịch khả dụng tương lai</h2><p className="mt-1 text-xs text-stone-500">Đối chiếu các kỳ thuê và đặt chỗ đã có; đây là màn hình theo dõi, không thực hiện phân gian kho.</p></div>
        <Table>
          <Thead><tr><Th>Gian kho</Th><Th>Hiện tại</Th><Th>Các kỳ sử dụng / đặt trước</Th><Th>Khả dụng tiếp theo</Th></tr></Thead>
          <Tbody>
            {availabilityPagination.items.map(({ unit, periods }) => {
              const availability = availabilityFor(unit, periods)
              return <Tr key={`availability-${unit.id}`}>
                <Td><p className="font-mono font-bold">{unit.code}</p><p className="text-xs text-stone-500">{managerUnitTypeLabel(unit.type, 'vi')} · Tầng {unit.floor}</p></Td>
                <Td><Badge variant={statusVariants[unit.status] || 'muted'}>{unitStatusLabel(unit.status)}</Badge></Td>
                <Td>{periods.length ? <div className="space-y-2">{periods.map(period => {
                  const hasCompletePeriod = Boolean(parseDisplayDate(period.startDate) && parseDisplayDate(period.endDate))
                  return <div key={`${unit.id}-${period.id}`} className="rounded-lg border border-stone-200 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2"><b>{period.label} · {period.id}</b>{hasCompletePeriod ? <Badge variant={period.variant}>{formatDate(period.startDate)} – {formatDate(period.endDate)}</Badge> : <Badge variant="warning">Thiếu ngày bắt đầu/kết thúc</Badge>}</div>
                    <p className="mt-1 text-stone-500">{period.customer}</p>
                  </div>
                })}</div> : <span className="text-sm text-stone-500">Chưa có kỳ sử dụng hoặc đặt trước</span>}</Td>
                <Td><b>{availability.label}</b>{availability.detail && <p className="mt-1 text-xs text-stone-500">{availability.detail}</p>}</Td>
              </Tr>
            })}
          </Tbody>
        </Table>
        <ManagerPagination {...availabilityPagination} pageSize={availabilityPageSize} onPageChange={setAvailabilityPage} onPageSizeChange={setAvailabilityPageSize} />
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

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-stone-900">Năng lực khai thác hiện có</h2>
            <p className="mt-1 text-xs text-stone-500">Phân tích thứ cấp, tổng hợp trực tiếp từ các gian kho thuộc cơ sở</p>
          </div>
          <b>{occupiedCount}/{facilityUnits.length} gian đang sử dụng · {occupancy}% lấp đầy</b>
        </div>
        <ProgressBar value={occupiedCount} max={Math.max(1, facilityUnits.length)} />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">Tổng diện tích</p><b className="mt-1 block text-lg">{totalArea.toLocaleString('vi-VN')} m²</b></div>
          <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">Tổng thể tích</p><b className="mt-1 block text-lg">{totalVolume.toLocaleString('vi-VN')} m³</b></div>
          <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">Tổng tải trọng cho phép</p><b className="mt-1 block text-lg">{totalLoad.toLocaleString('vi-VN')} kg</b></div>
          <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-700">Tổng giá niêm yết của toàn bộ gian / tháng</p><b className="mt-1 block text-lg text-amber-900">{formatVnd(totalListedRent)}</b><p className="mt-1 text-[11px] text-amber-700">Không phải doanh thu thực thu</p></div>
        </div>
      </Card>

      <div className="grid items-start gap-4 2xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-stone-200 p-4">
            <h2 className="font-bold text-stone-900">Công suất theo loại gian kho</h2>
            <p className="mt-1 text-xs text-stone-500">Tỷ lệ sử dụng và cơ cấu trạng thái của từng loại gian.</p>
          </div>
          <div className="divide-y divide-stone-200">
            {capacityByType.map(item => (
              <div key={item.key} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-stone-900">{item.label}</p>
                    <p className="mt-1 text-xs text-stone-500">Tổng cộng {item.total} gian</p>
                  </div>
                  <div className="w-36 max-w-full">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-stone-500">Lấp đầy</span>
                      <b className="text-stone-900">{item.occupancy}%</b>
                    </div>
                    <ProgressBar value={item.occupancy} />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-3">
                  {[
                    ['Tổng', item.total],
                    ['Trống', item.available],
                    ['Đang dùng', item.used],
                    ['Đã phân', item.reserved],
                    ['Giữ tạm', item.held],
                    ['Bảo trì', item.maintenance]
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-stone-50 px-3 py-2">
                      <p className="text-[11px] text-stone-500">{label}</p>
                      <b className="mt-0.5 block text-stone-900">{value}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-stone-200 p-4">
            <h2 className="font-bold text-stone-900">Phân bổ theo khu vực</h2>
            <p className="mt-1 text-xs text-stone-500">Số lượng gian và trạng thái vận hành theo từng khu vực.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-1">
            {capacityByZone.map(item => (
              <div key={item.zone} className="rounded-xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-stone-900">{item.zone}</p>
                    <p className="mt-1 text-xs text-stone-500">Tầng {item.floors || 'Chưa xác định'}</p>
                  </div>
                  <Badge variant="muted">{item.total} gian</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {[
                    ['Trống', item.available],
                    ['Đang dùng', item.occupied],
                    ['Đã phân', item.reserved],
                    ['Giữ tạm', item.held],
                    ['Bảo trì', item.maintenance]
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
                      <span className="text-xs text-stone-500">{label}</span>
                      <b className="text-sm text-stone-900">{value}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
              <Td><b>{formatManagerMoney(definition.monthlyPrice)}/tháng</b><p className="mt-1 text-xs text-stone-500">{formatManagerMoney(definition.pricePerM3)}/m³</p></Td>
              <Td><b>{actualUnits.length} gian</b><p className="mt-1 text-xs text-stone-500">{actualUnits.filter(unit => unit.status === 'available').length} trống · {actualUnits.filter(unit => unit.status === 'occupied').length} đang dùng · {actualUnits.filter(unit => unit.status === 'maintenance').length} bảo trì</p></Td>
            </Tr>
          })}</Tbody>
        </Table>
      </Card>

      <Modal open={Boolean(selectedUnit)} onClose={() => setSelectedUnitId(null)} title="Chi tiết gian kho" size="xl">
        {selectedUnit && (() => {
          const rental = operationalRentalFor(selectedUnit)
          const reservation = activeReservationFor(selectedUnit)
          const availability = availabilityFor(selectedUnit)
          const unitCheckins = checkins.filter(item => matchesUnit(item.unitId, selectedUnit)).sort((left, right) => (right.completedAt || right.scheduledDate).localeCompare(left.completedAt || left.scheduledDate))
          const latestCheckin = unitCheckins[0]
          const unitReturns = returns.filter(item => matchesUnit(item.unitId, selectedUnit)).sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
          const latestReturn = unitReturns[0]
          const unitMaintenance = facilityMaintenance.filter(item => matchesUnit(item.unitId, selectedUnit)).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          const visibleUnitMaintenance = unitMaintenance.filter(item => !maintenanceHistory.isHidden(item.id))
          const hiddenMaintenanceCount = unitMaintenance.length - visibleUnitMaintenance.length
          const hasOpenMaintenance = unitMaintenance.some(item => item.status !== 'completed')
          const allUnitActivities = facilityActivities.filter(item => item.entityType === 'unit' && matchesUnit(item.entityId, selectedUnit)).sort((left, right) => parseManagerActivityTimestamp(right.timestamp) - parseManagerActivityTimestamp(left.timestamp))
          const unitActivities = allUnitActivities.filter(item => !activityHistory.isHidden(item.id)).slice(0, 5)
          const hiddenActivityCount = allUnitActivities.length - allUnitActivities.filter(item => !activityHistory.isHidden(item.id)).length
          const hasOperationalLock = managerUnitHasOperationalLock(selectedUnit.id, facilityReservations, facilityRentals)
          return <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4"><div><p className="font-mono text-lg font-bold text-stone-900">{selectedUnit.code}</p><p className="mt-1 text-stone-500">{selectedUnit.facilityName} · Tầng {selectedUnit.floor} · {selectedUnit.zone}</p></div><Badge variant={statusVariants[selectedUnit.status] || 'muted'}>{unitStatusLabel(selectedUnit.status)}</Badge></div>

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
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Chi phí và khả dụng</h3><div className="space-y-2"><p className="flex justify-between gap-3"><span className="text-stone-500">Giá áp dụng hiện tại</span><b>{formatManagerMoney(selectedUnit.price)}</b></p><p className="flex justify-between gap-3"><span className="text-stone-500">Tiền đảm bảo theo chính sách hiện hành</span><b>{formatManagerMoney(selectedUnit.deposit)}</b></p><div className="flex justify-between gap-3"><span className="text-stone-500">Khả dụng thực tế</span><div className="text-right"><b>{availability.label}</b>{availability.detail && <p className="mt-1 text-xs font-normal text-stone-500">{availability.detail}</p>}</div></div>{selectedUnit.heldUntil && <p className="flex justify-between gap-3"><span className="text-stone-500">Thời hạn giữ tạm</span><b>{formatDateTime(selectedUnit.heldUntil)}</b></p>}</div></Card>
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Tình trạng khai thác</h3>{rental ? <div className="space-y-2"><p>Khách hàng: <b>{rental.customerName}</b></p><p>Mã hồ sơ thuê: <b className="font-mono">{rental.id}</b></p><p>Thời hạn: <b>{parseDisplayDate(rental.startDate) && parseDisplayDate(rental.endDate) ? `${formatDate(rental.startDate)} – ${formatDate(rental.endDate)}` : 'Chưa đủ dữ liệu kỳ thuê'}</b></p><p>Trạng thái hồ sơ: <Badge variant="info">{managerStatusLabel(rental.status, 'vi')}</Badge></p><p>Kỳ thanh toán tiếp theo: <b>{formatDate(rental.nextDue)}</b></p><p>Thanh toán: <Badge variant={isManagerRentalOverdue(rental) ? 'error' : rental.paymentStatus === 'paid' ? 'success' : 'warning'}>{managerStatusLabel(isManagerRentalOverdue(rental) ? 'overdue' : rental.paymentStatus, 'vi')}</Badge></p></div> : reservation ? <div className="space-y-2"><p>Khách hàng: <b>{reservation.customerName}</b></p><p>Mã đơn đặt chỗ: <b className="font-mono">{reservation.id}</b></p><p>Thời gian dự kiến: <b>{parseDisplayDate(reservation.startDate) && parseDisplayDate(reservation.endDate) ? `${formatDate(reservation.startDate)} – ${formatDate(reservation.endDate)}` : 'Chưa đủ dữ liệu kỳ thuê'}</b></p><p>Trạng thái: <Badge variant="warning">{managerStatusLabel(reservation.status, 'vi')}</Badge></p></div> : selectedUnit.status === 'occupied' ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"><b>Dữ liệu trạng thái chưa nhất quán</b><p className="mt-1 text-xs">Gian được đánh dấu đang sử dụng nhưng không tìm thấy hồ sơ thuê vận hành tương ứng.</p></div> : <p className="text-stone-500">Gian kho chưa có hồ sơ thuê hoặc đơn đặt chỗ hiệu lực.</p>}</Card>
            </div>

            {selectedUnit.reservedPeriods?.length ? <div><h3 className="mb-3 font-bold text-stone-900">Các kỳ sử dụng / đặt trước</h3><div className="grid gap-2 sm:grid-cols-2">{selectedUnit.reservedPeriods.map(period => {
              const hasCompletePeriod = Boolean(parseDisplayDate(period.startDate) && parseDisplayDate(period.endDate))
              return <div key={`${period.reservationId}-${period.startDate}`} className="rounded-lg border border-stone-200 p-3"><p className="font-semibold">{period.customerName}</p><p className="mt-1 font-mono text-xs text-stone-500">{period.reservationId}</p><p className={`mt-1 text-xs ${hasCompletePeriod ? '' : 'font-medium text-amber-700'}`}>{hasCompletePeriod ? `${formatDate(period.startDate)} – ${formatDate(period.endDate)}` : 'Chưa đủ dữ liệu kỳ thuê'}</p></div>
            })}</div></div> : null}

            {latestCheckin && <div><h3 className="mb-3 font-bold text-stone-900">Biên bản nhận kho gần nhất</h3><div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-stone-500">Trạng thái</span><br /><b>{managerStatusLabel(latestCheckin.status, 'vi')}</b></p><p><span className="text-stone-500">Khối lượng thực tế</span><br /><b>{latestCheckin.actualMeasurements.weightKg.toLocaleString('vi-VN')} kg</b></p><p><span className="text-stone-500">Thể tích thực tế</span><br /><b>{latestCheckin.actualMeasurements.actualVolumeM3.toLocaleString('vi-VN')} m³</b></p><p><span className="text-stone-500">Số kiện bàn giao</span><br /><b>{latestCheckin.goodsHandover?.packageCount ?? 'Chưa ghi nhận'}</b></p><p className="sm:col-span-2 lg:col-span-4"><span className="text-stone-500">Tình trạng ban đầu</span><br /><b>{normalizeOperationalText(latestCheckin.initialCondition)}</b></p></div></div>}

            {latestReturn && <div><h3 className="mb-3 font-bold text-stone-900">Hồ sơ trả kho gần nhất</h3><div className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-stone-500">Trạng thái</span><br /><b>{managerStatusLabel(latestReturn.status, 'vi')}</b></p><p><span className="text-stone-500">Ngày dự kiến trả</span><br /><b>{formatDate(latestReturn.scheduledDate)}</b></p><p><span className="text-stone-500">Đối chiếu hàng hóa</span><br /><b>{latestReturn.inventoryMatch === 'match' ? 'Khớp' : latestReturn.inventoryMatch === 'missing' ? 'Thiếu' : latestReturn.inventoryMatch === 'excess' ? 'Thừa' : 'Chưa ghi nhận'}</b></p><p><span className="text-stone-500">Phân loại hư hỏng</span><br /><b>{damageLabel(latestReturn.damageClassification)}</b></p></div></div>}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Hàng hóa được phép</h3><ul className="space-y-2">{selectedUnit.allowedGoods.map(item => <li key={item} className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{item}</li>)}</ul></Card>
              <Card className="p-4"><h3 className="mb-3 font-bold text-stone-900">Hàng hóa bị cấm</h3><ul className="space-y-2">{selectedUnit.prohibitedGoods.map(item => <li key={item} className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{item}</li>)}</ul></Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-bold text-stone-900">Lịch sử bảo trì</h3>{hiddenMaintenanceCount > 0 && <Button size="sm" variant="outline" onClick={() => maintenanceHistory.restoreAll()}>Khôi phục</Button>}</div>{visibleUnitMaintenance.length ? <div className="space-y-3">{visibleUnitMaintenance.slice(0, 5).map(task => <div key={task.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><b>{formatDateTime(task.createdAt)}</b><div className="flex items-center gap-2"><Badge variant={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : 'warning'}>{managerStatusLabel(task.status, 'vi')}</Badge>{task.status === 'completed' && <Button size="sm" variant="danger" onClick={() => { maintenanceHistory.hide(task.id); showToast(`Đã ẩn lịch sử bảo trì ${task.id}.`) }}>Xóa</Button>}</div></div><p className="mt-1 text-stone-600">{normalizeOperationalText(task.reason)}</p><p className="mt-1 text-xs text-stone-500">Người phụ trách: {task.assignedStaffName || 'Chưa phân công'}</p></div>)}</div> : <p className="text-stone-500">{hiddenMaintenanceCount ? 'Các nhiệm vụ bảo trì cũ đang được ẩn.' : 'Chưa có nhiệm vụ bảo trì.'}</p>}</Card>
              <Card className="p-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-bold text-stone-900">Hoạt động gần đây</h3>{hiddenActivityCount > 0 && <Button size="sm" variant="outline" onClick={() => activityHistory.restoreAll()}>Khôi phục</Button>}</div>{unitActivities.length ? <div className="space-y-3">{unitActivities.map(activity => <div key={activity.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{managerActivityLabel(activity.action, 'vi')}</p><p className="mt-1 text-xs text-stone-500">{formatDateTime(activity.timestamp)} · {activity.actorName}</p></div><Button size="sm" variant="danger" onClick={() => { activityHistory.hide(activity.id); showToast('Đã ẩn bản ghi hoạt động khỏi giao diện Manager.') }}>Xóa</Button></div></div>)}</div> : <p className="text-stone-500">{hiddenActivityCount ? 'Các hoạt động cũ đang được ẩn.' : 'Chưa có hoạt động nào được ghi nhận.'}</p>}</Card>
            </div>

            {selectedUnit.conditionNotes && <div className="rounded-lg bg-amber-50 p-4"><p className="font-semibold text-amber-900">Ghi chú tình trạng</p><p className="mt-1 text-amber-800">{normalizeOperationalText(selectedUnit.conditionNotes)}</p></div>}

            {hasOperationalLock && <ManagerActionNotice tone="warning">Không thể sửa thông tin hoặc đổi trạng thái vì gian kho còn đặt chỗ, hồ sơ thuê hoặc hồ sơ trả kho chưa hoàn tất.</ManagerActionNotice>}
            {selectedUnit.status === 'maintenance' && hasOpenMaintenance && <ManagerActionNotice tone="warning">Staff cần hoàn tất nhiệm vụ bảo trì trước khi Manager xác nhận mở lại gian kho.</ManagerActionNotice>}
            {!hasOperationalLock && !['available', 'maintenance'].includes(selectedUnit.status) && <ManagerActionNotice>Trạng thái hiện tại được điều khiển bởi luồng đặt chỗ hoặc bàn giao. Manager chỉ thao tác lại khi gian kho chuyển sang còn trống hoặc bảo trì.</ManagerActionNotice>}
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setSelectedUnitId(null)}>Đóng</Button>{!hasOperationalLock && ['available', 'maintenance'].includes(selectedUnit.status) && <Button variant="outline" onClick={() => { setSelectedUnitId(null); setEditor({ mode: 'edit', unitId: selectedUnit.id }) }}>Sửa thông tin</Button>}{selectedUnit.status === 'available' && !hasOperationalLock && <Button variant="outline" onClick={() => openStatusModal(selectedUnit, 'maintenance')}>Đưa vào bảo trì</Button>}{selectedUnit.status === 'maintenance' && !hasOperationalLock && !hasOpenMaintenance && <Button onClick={() => openStatusModal(selectedUnit, 'available')}>Xác nhận mở lại</Button>}</div>
          </div>
        })()}
      </Modal>

      <Modal open={Boolean(statusUnit)} onClose={() => setStatusUnitId(null)} title={targetStatus === 'maintenance' ? 'Chuyển sang bảo trì' : 'Xác nhận mở lại gian kho'}>
        {statusUnit && <div className="space-y-4"><div className="rounded-lg bg-stone-50 p-3 text-sm"><b className="font-mono">{statusUnit.code}</b> · {managerUnitTypeLabel(statusUnit.type, 'vi')} · {statusUnit.facilityName}</div><Input label="Lý do hoặc ghi chú xác nhận" value={reason} onChange={event => setReason(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStatusUnitId(null)}>Hủy</Button><Button disabled={!reason.trim()} onClick={saveStatus}>Xác nhận</Button></div></div>}
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
