import { useState } from 'react'
import Layout, { getInitialPage, Icon } from '../../components/Layout'
import { Card, StatCard } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import ProfileView from '../ProfileView'
import StaffReservationsPanel from './StaffReservationsPanel'
import StaffCheckinsPanel from './StaffCheckinsPanel'
import StaffReturnsPanel from './StaffReturnsPanel'
import StaffSupportPanel from './StaffSupportPanel'

export default function StaffApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang } = useLanguage()
  const hub = useStorageHub()
  const nav = [
    { id: 'dashboard', label: lang === 'vi' ? 'Tổng quan ca làm việc' : 'Shift overview', icon: Icon.home, group: lang === 'vi' ? 'Ca làm việc' : 'Shift' },
    { id: 'reservations', label: lang === 'vi' ? 'Duyệt yêu cầu đặt kho' : 'Reservation review', icon: Icon.calendar, group: lang === 'vi' ? 'Vận hành' : 'Operations' },
    { id: 'checkin', label: lang === 'vi' ? 'Check-in & bàn giao' : 'Check-in & handover', icon: Icon.truck, group: lang === 'vi' ? 'Vận hành' : 'Operations' },
    { id: 'return', label: lang === 'vi' ? 'Nghiệm thu trả kho' : 'Return inspection', icon: Icon.clipboard, group: lang === 'vi' ? 'Vận hành' : 'Operations' },
    { id: 'support', label: lang === 'vi' ? 'Hỗ trợ khách hàng' : 'Customer support', icon: Icon.support, group: lang === 'vi' ? 'Chăm sóc' : 'Support' },
  ]
  const [page, setPage] = useState(() => getInitialPage(nav, 'dashboard'))
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }
  const belongsToFacility = (facilityId?: string, facilityName?: string) => !user.facility || user.facility === 'All facilities' || user.facility === facilityId || user.facility === facilityName
  const reservations = hub.holds.filter(item => belongsToFacility(item.facilityId, item.facilityName))
  const checkins = hub.checkins.filter(item => belongsToFacility(item.facilityId, hub.facilities.find(facility => facility.id === item.facilityId)?.name))
  const returns = hub.returns.filter(item => belongsToFacility(item.facilityId, item.facilityName))
  const tickets = hub.tickets.filter(item => belongsToFacility(item.facilityId, item.facility))

  return <Layout user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout} roleLabel={lang === 'vi' ? 'Nhân Viên Cơ Sở' : 'Facility Staff'} roleColor="bg-green-100 text-green-700">
    {page === 'dashboard' && <div className="fade-in space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title={lang === 'vi' ? 'Chờ phê duyệt' : 'Awaiting approval'} value={reservations.filter(item => item.status === 'awaiting_review').length} icon={Icon.calendar} />
        <StatCard title={lang === 'vi' ? 'Lịch Check-in' : 'Scheduled check-ins'} value={checkins.filter(item => item.status === 'scheduled').length} icon={Icon.truck} />
        <StatCard title={lang === 'vi' ? 'Yêu cầu trả kho' : 'Return requests'} value={returns.filter(item => item.status === 'requested').length} icon={Icon.clipboard} />
        <StatCard title={lang === 'vi' ? 'Ticket đang mở' : 'Open tickets'} value={tickets.filter(item => item.status !== 'resolved').length} icon={Icon.support} />
      </div>
      <Card className="p-5"><h2 className="font-bold text-stone-900">{lang === 'vi' ? 'Dữ liệu ca làm việc đã đồng bộ' : 'Shift data is synchronized'}</h2><p className="mt-2 text-sm text-stone-600">{lang === 'vi' ? 'Mọi thao tác tại đây cập nhật cùng dữ liệu mà Customer và Manager đang sử dụng.' : 'Every action here updates the same data used by Customer and Manager.'}</p></Card>
    </div>}
    {page === 'reservations' && <StaffReservationsPanel user={user} reservations={reservations} approveReservation={hub.approveReservation} showToast={showToast} />}
    {page === 'checkin' && <StaffCheckinsPanel user={user} checkins={checkins} holds={hub.holds} signPaperContract={hub.signPaperContract} payRemainingBalance={hub.payRemainingBalance} completeCheckIn={hub.completeCheckIn} showToast={showToast} />}
    {page === 'return' && <StaffReturnsPanel user={user} returns={returns} completeReturnInspection={hub.completeReturnInspection} showToast={showToast} />}
    {page === 'support' && <StaffSupportPanel user={user} tickets={tickets} respondSupportTicket={hub.respondSupportTicket} showToast={showToast} />}
    {page === 'profile' && <ProfileView user={user} />}
    {toast && <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-lg bg-[#292a27] px-5 py-3 text-sm font-medium text-white shadow-2xl">{toast}</div>}
  </Layout>
}
