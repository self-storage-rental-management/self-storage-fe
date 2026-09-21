import { useState } from 'react'
import Layout, { getInitialPage, Icon } from '../../components/Layout'
import { Badge } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import ProfileView from '../ProfileView'
import ManagerDashboardPanel from './ManagerDashboardPanel'
import ManagerInventoryPanel from './ManagerInventoryPanel'
import ManagerMovesPanel from './ManagerMovesPanel'
import ManagerPaymentsPanel from './ManagerPaymentsPanel'
import ManagerRentalsPanel from './ManagerRentalsPanel'
import ManagerReportsPanel from './ManagerReportsPanel'
import ManagerStaffTasksPanel from './ManagerStaffTasksPanel'
import ManagerUnitsPanel from './ManagerUnitsPanel'

export default function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang } = useLanguage()
  const hub = useStorageHub()
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: Icon.home, group: lang === 'vi' ? 'Tổng quan' : 'Overview' },
    { id: 'reservations', label: 'Reservations & Unit Assignment', icon: Icon.calendar, group: lang === 'vi' ? 'Vận hành' : 'Operations' },
    { id: 'inventory', label: 'Storage Inventory', icon: Icon.box, group: lang === 'vi' ? 'Vận hành' : 'Operations' },
    { id: 'rentals', label: 'Rentals', icon: Icon.policy, group: lang === 'vi' ? 'Vận hành' : 'Operations' },
    { id: 'moves', label: 'Move-ins & Move-outs', icon: Icon.truck, group: lang === 'vi' ? 'Vận hành' : 'Operations' },
    { id: 'payments', label: 'Payments & Delinquency', icon: Icon.dollar, group: lang === 'vi' ? 'Tài chính' : 'Finance' },
    { id: 'staff-tasks', label: 'Staff & Tasks', icon: Icon.users, group: lang === 'vi' ? 'Điều phối' : 'Workforce' },
    { id: 'reports', label: 'Facility Reports', icon: Icon.chart, group: lang === 'vi' ? 'Báo cáo' : 'Reporting' }
  ]
  const [page, setPage] = useState(() => getInitialPage(nav, 'dashboard'))
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      available: 'success', occupied: 'info', maintenance: 'warning', reserved: 'purple', held: 'purple', assigned: 'purple',
      active: 'success', paid: 'success', overdue: 'error', pending: 'warning', completed: 'success', cancelled: 'error', scheduled: 'info',
      requested: 'warning', inspected: 'warning', disputed: 'error', refund_pending: 'purple', payment_due: 'error', awaiting_customer_confirmation: 'warning',
      CREATED: 'info', DEPOSIT_PAID: 'success', UNIT_RESERVED: 'purple', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'error', EXPIRED: 'muted'
    }
    return <Badge variant={variants[status] || 'muted'}>{status.replace(/_/g, ' ')}</Badge>
  }

  const facility = hub.facilities.find(item => item.name === user.facility || item.id === user.facility) || hub.facilities[0]

  return <Layout user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout} roleLabel={lang === 'vi' ? 'Quản Lý Cơ Sở' : 'Facility Manager'} roleColor="bg-purple-100 text-purple-700">
    {page === 'dashboard' && <ManagerDashboardPanel user={user} setPage={setPage} />}
    {page === 'reservations' && <ManagerUnitsPanel user={user} storeHolds={hub.holds} storeUnits={hub.units} storeRentals={hub.rentals} assignUnitToHold={hub.assignUnitToHold} showToast={showToast} />}
    {page === 'inventory' && <ManagerInventoryPanel user={user} units={hub.units} maintenanceTasks={hub.maintenanceTasks} updateUnitStatus={hub.updateUnitStatus} showToast={showToast} />}
    {page === 'rentals' && <ManagerRentalsPanel user={user} rentals={hub.rentals} contracts={hub.contracts} renewals={hub.renewals} approveRenewal={hub.approveRenewal} rejectRenewal={hub.rejectRenewal} showToast={showToast} />}
    {page === 'moves' && <ManagerMovesPanel user={user} showToast={showToast} statusBadge={statusBadge} />}
    {page === 'payments' && <ManagerPaymentsPanel user={user} rentals={hub.rentals} payments={hub.payments} config={hub.config} recordRentalPayment={hub.recordRentalPayment} applyRentalLateFee={hub.applyRentalLateFee} waiveRentalLateFee={hub.waiveRentalLateFee} setRentalOverlock={hub.setRentalOverlock} sendDelinquencyReminder={hub.sendDelinquencyReminder} showToast={showToast} />}
    {page === 'staff-tasks' && <ManagerStaffTasksPanel user={user} facilityId={facility?.id || ''} facilityName={facility?.name || user.facility || ''} tasks={hub.staffTasks} createFacilityTask={hub.createFacilityTask} updateFacilityTask={hub.updateFacilityTask} showToast={showToast} />}
    {page === 'reports' && <ManagerReportsPanel user={user} units={hub.units} reservations={hub.holds} rentals={hub.rentals} payments={hub.payments} activities={hub.activities} showToast={showToast} />}
    {page === 'profile' && <ProfileView user={user} />}
    {toast && <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-lg border border-amber-500/50 bg-[#292a27] px-5 py-3 text-white shadow-2xl"><p className="text-sm font-medium">{toast}</p></div>}
  </Layout>
}
