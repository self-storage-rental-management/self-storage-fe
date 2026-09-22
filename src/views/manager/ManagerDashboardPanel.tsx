import { Badge, Button, Card, ProgressBar, SectionHeader, StatCard } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import { isFacilityVisible } from '../../domain/managerRules'

interface Props { user: User; setPage: (page: string) => void }

export default function ManagerDashboardPanel({ user, setPage }: Props) {
    const { units, holds, rentals, checkins, returns, payments, maintenanceTasks, staffTasks } = useStorageHub()
  const facilityUnits = units.filter(unit => isFacilityVisible(user, unit.facilityId, unit.facilityName))
  const facilityIds = new Set(facilityUnits.map(unit => unit.facilityId))
  const facilityHolds = holds.filter(item => facilityIds.has(item.facilityId))
  const facilityRentals = rentals.filter(item => facilityIds.has(item.facilityId))
  const facilityCheckins = checkins.filter(item => facilityIds.has(item.facilityId))
  const facilityReturns = returns.filter(item => facilityIds.has(item.facilityId))
  const rentalIds = new Set(facilityRentals.map(item => item.id))
  const facilityPayments = payments.filter(item => item.rentalId ? rentalIds.has(item.rentalId) : facilityHolds.some(hold => hold.id === item.reservationId))
  const occupied = facilityUnits.filter(item => item.status === 'occupied').length
  const occupancy = facilityUnits.length ? Math.round(occupied / facilityUnits.length * 100) : 0
  const monthlyRevenue = facilityRentals.filter(item => item.status === 'active').reduce((sum, item) => sum + item.monthlyRate, 0)
  const unassigned = facilityHolds.filter(item => item.status === 'DEPOSIT_PAID' && !item.assignedUnitId)
  const upcomingMoves = facilityCheckins.filter(item => item.status === 'scheduled')
  const openReturns = facilityReturns.filter(item => !['completed'].includes(item.status))
  const overdue = facilityRentals.filter(item => item.paymentStatus === 'overdue' && item.status === 'active')
  const maintenance = maintenanceTasks.filter(task => facilityIds.has(task.facilityId) && task.status !== 'completed')
  const openTasks = staffTasks.filter(task => facilityIds.has(task.facilityId) && task.status !== 'completed')
  const collected = facilityPayments.filter(item => item.status === 'PAID' && item.type !== 'REFUND').reduce((sum, item) => sum + item.amount, 0)

  const queues = [
    { label: 'Đơn đã cọc chờ phân kho', count: unassigned.length, page: 'reservations', variant: unassigned.length ? 'warning' : 'success' },
    { label: 'Lịch move-in sắp tới', count: upcomingMoves.length, page: 'moves', variant: 'info' },
    { label: 'Hồ sơ move-out đang mở', count: openReturns.length, page: 'moves', variant: openReturns.some(item => item.status === 'disputed') ? 'error' : 'warning' },
    { label: 'Tài khoản quá hạn', count: overdue.length, page: 'payments', variant: overdue.length ? 'error' : 'success' },
    { label: 'Gian kho chờ bảo trì/nghiệm thu', count: maintenance.length, page: 'inventory', variant: maintenance.length ? 'warning' : 'success' },
    { label: 'Nhiệm vụ nhân viên đang mở', count: openTasks.length, page: 'staff-tasks', variant: 'info' }
  ]

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={'Tổng quan cơ sở'} title="Dashboard" subtitle={user.facility || ('Chưa gán cơ sở')} action={<Button variant="outline" onClick={() => setPage('reports')}>{'Mở báo cáo'}</Button>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Tổng gian kho'} value={facilityUnits.length} icon={Icon.box} /><StatCard title={'Tỷ lệ lấp đầy'} value={`${occupancy}%`} icon={Icon.chart} /><StatCard title={'Doanh thu định kỳ'} value={formatVnd(monthlyRevenue)} icon={Icon.dollar} /><StatCard title={'Đã thu thực tế'} value={formatVnd(collected)} icon={Icon.credit} /></div>
    <Card className="p-5"><div className="mb-2 flex items-center justify-between"><h3 className="font-bold">{'Công suất cơ sở'}</h3><b>{occupied}/{facilityUnits.length}</b></div><ProgressBar value={occupied} max={Math.max(1, facilityUnits.length)} /><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span>Available: <b>{facilityUnits.filter(item => item.status === 'available').length}</b></span><span>Reserved: <b>{facilityUnits.filter(item => item.status === 'reserved').length}</b></span><span>Occupied: <b>{occupied}</b></span><span>Maintenance: <b>{facilityUnits.filter(item => item.status === 'maintenance').length}</b></span></div></Card>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{queues.map(item => <Card key={item.page + item.label} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-stone-900">{item.label}</p><p className="mt-1 text-2xl font-extrabold">{item.count}</p></div><Badge variant={item.variant}>{item.count ? ('Cần xử lý') : 'OK'}</Badge></div><Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => setPage(item.page)}>{'Mở hàng đợi'}</Button></Card>)}</div>
  </div>
}
