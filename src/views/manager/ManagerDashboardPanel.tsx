import { Badge, Button, Card, ProgressBar, SectionHeader, StatCard } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'

interface Props { user: User; setPage: (page: string) => void }

export default function ManagerDashboardPanel({ user, setPage }: Props) {
  const { lang } = useLanguage()
  const { units, holds, rentals, checkins, returns, payments, maintenanceTasks, staffTasks } = useStorageHub()
  const facilityUnits = units.filter(unit => !user.facility || user.facility === 'All facilities' || unit.facilityName === user.facility || unit.facilityId === user.facility)
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
    { label: lang === 'vi' ? 'Đơn đã cọc chờ phân kho' : 'Deposits awaiting assignment', count: unassigned.length, page: 'reservations', variant: unassigned.length ? 'warning' : 'success' },
    { label: lang === 'vi' ? 'Lịch move-in sắp tới' : 'Scheduled move-ins', count: upcomingMoves.length, page: 'moves', variant: 'info' },
    { label: lang === 'vi' ? 'Hồ sơ move-out đang mở' : 'Open move-outs', count: openReturns.length, page: 'moves', variant: openReturns.some(item => item.status === 'disputed') ? 'error' : 'warning' },
    { label: lang === 'vi' ? 'Tài khoản quá hạn' : 'Overdue accounts', count: overdue.length, page: 'payments', variant: overdue.length ? 'error' : 'success' },
    { label: lang === 'vi' ? 'Gian kho chờ bảo trì/nghiệm thu' : 'Maintenance queue', count: maintenance.length, page: 'inventory', variant: maintenance.length ? 'warning' : 'success' },
    { label: lang === 'vi' ? 'Nhiệm vụ nhân viên đang mở' : 'Open staff tasks', count: openTasks.length, page: 'staff-tasks', variant: 'info' }
  ]

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={lang === 'vi' ? 'Tổng quan cơ sở' : 'Facility overview'} title="Dashboard" subtitle={user.facility || (lang === 'vi' ? 'Chưa gán cơ sở' : 'No facility assigned')} action={<Button variant="outline" onClick={() => setPage('reports')}>{lang === 'vi' ? 'Mở báo cáo' : 'View reports'}</Button>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={lang === 'vi' ? 'Tổng gian kho' : 'Total units'} value={facilityUnits.length} icon={Icon.box} /><StatCard title={lang === 'vi' ? 'Tỷ lệ lấp đầy' : 'Occupancy'} value={`${occupancy}%`} icon={Icon.chart} /><StatCard title={lang === 'vi' ? 'Doanh thu định kỳ' : 'Monthly recurring'} value={`$${monthlyRevenue.toFixed(2)}`} icon={Icon.dollar} /><StatCard title={lang === 'vi' ? 'Đã thu thực tế' : 'Collected payments'} value={`$${collected.toFixed(2)}`} icon={Icon.credit} /></div>
    <Card className="p-5"><div className="mb-2 flex items-center justify-between"><h3 className="font-bold">{lang === 'vi' ? 'Công suất cơ sở' : 'Facility capacity'}</h3><b>{occupied}/{facilityUnits.length}</b></div><ProgressBar value={occupied} max={Math.max(1, facilityUnits.length)} /><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span>Available: <b>{facilityUnits.filter(item => item.status === 'available').length}</b></span><span>Reserved: <b>{facilityUnits.filter(item => item.status === 'reserved').length}</b></span><span>Occupied: <b>{occupied}</b></span><span>Maintenance: <b>{facilityUnits.filter(item => item.status === 'maintenance').length}</b></span></div></Card>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{queues.map(item => <Card key={item.page + item.label} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-stone-900">{item.label}</p><p className="mt-1 text-2xl font-extrabold">{item.count}</p></div><Badge variant={item.variant}>{item.count ? (lang === 'vi' ? 'Cần xử lý' : 'Action needed') : 'OK'}</Badge></div><Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => setPage(item.page)}>{lang === 'vi' ? 'Mở hàng đợi' : 'Open queue'}</Button></Card>)}</div>
  </div>
}
