import { useState } from 'react'
import Layout, { getInitialPage, Icon, type LayoutNotification, type NavItem } from '../../components/Layout'
import { Badge } from '../../components/ui'
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
import ManagerPoliciesPanel from './ManagerPoliciesPanel'
import ManagerSupportPanel from './ManagerSupportPanel'
import { isFacilityVisible } from '../../domain/managerRules'

export default function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
    const hub = useStorageHub()
  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Icon.home, group: 'Tổng quan', permission: 'view_dashboard' },
    { id: 'reservations', label: 'Reservations & Unit Assignment', icon: Icon.calendar, group: 'Vận hành', permission: 'assign_units' },
    { id: 'inventory', label: 'Storage Inventory', icon: Icon.box, group: 'Vận hành', permission: 'manage_inventory' },
    { id: 'rentals', label: 'Rentals', icon: Icon.policy, group: 'Vận hành', permission: 'manage_rentals' },
    { id: 'moves', label: 'Move-ins & Move-outs', icon: Icon.truck, group: 'Vận hành', permission: 'view_checkins' },
    { id: 'payments', label: 'Payments & Delinquency', icon: Icon.dollar, group: 'Tài chính', permission: 'manage_payments' },
    { id: 'staff-tasks', label: 'Staff & Tasks', icon: Icon.users, group: 'Điều phối', permission: 'manage_staff_tasks' },
    { id: 'support', label: 'Support', icon: Icon.support, group: 'Chăm sóc', permission: 'view_support' },
    { id: 'policies', label: 'Policies', icon: Icon.policy, group: 'Điều hành', permission: 'manage_policies' },
    { id: 'reports', label: 'Facility Reports', icon: Icon.chart, group: 'Báo cáo', permission: 'view_reports' }
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

  const facility = hub.facilities.find(item => item.id === user.facilityId || item.name === user.facility || item.id === user.facility) || hub.facilities[0]
  const managerFacilityId = user.facilityId || facility?.id
  const facilityRenewals = hub.renewals.filter(renewal => {
    const rental = hub.rentals.find(item => item.id === renewal.rentalId)
    const renewalFacilityId = renewal.facilityId || rental?.facilityId
    const renewalFacilityName = rental?.facilityName
    return isFacilityVisible({ ...user, facilityId: managerFacilityId }, renewalFacilityId, renewalFacilityName)
  })
  const renewalNotifications: LayoutNotification[] = facilityRenewals
    .filter(renewal => ['pending', 'appointment_scheduled'].includes(renewal.status))
    .map(renewal => ({
      id: `manager-renewal-${renewal.id}-${renewal.status}`,
      date: renewal.requestedAt || renewal.paidAt,
      title: renewal.status === 'pending' ? 'Có yêu cầu gia hạn chờ duyệt' : 'Có lịch ký gia hạn tại cơ sở',
      message: `${renewal.customerName} · ${renewal.unitId} · ${renewal.newEndDate}`,
      page: 'rentals',
      targetId: renewal.rentalId
    }))

  return <Layout user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout} additionalNotifications={renewalNotifications} canAccess={permission => hub.can(user, permission)} roleLabel={'Quản Lý Cơ Sở'} roleColor="bg-purple-100 text-purple-700">
    {page === 'dashboard' && <ManagerDashboardPanel user={user} setPage={setPage} />}
    {page === 'reservations' && <ManagerUnitsPanel user={user} storeHolds={hub.holds} storeUnits={hub.units} storeRentals={hub.rentals} assignUnitToHold={hub.assignUnitToHold} showToast={showToast} />}
    {page === 'inventory' && <ManagerInventoryPanel user={user} units={hub.units} maintenanceTasks={hub.maintenanceTasks} updateUnitStatus={hub.updateUnitStatus} showToast={showToast} />}
    {page === 'rentals' && <ManagerRentalsPanel user={user} rentals={hub.rentals} contracts={hub.contracts} renewals={hub.renewals} approveRenewal={hub.approveRenewal} rejectRenewal={hub.rejectRenewal} showToast={showToast} />}
    {page === 'moves' && <ManagerMovesPanel user={user} showToast={showToast} statusBadge={statusBadge} />}
    {page === 'payments' && <ManagerPaymentsPanel user={user} rentals={hub.rentals} payments={hub.payments} config={hub.config} recordRentalPayment={hub.recordRentalPayment} applyRentalLateFee={hub.applyRentalLateFee} waiveRentalLateFee={hub.waiveRentalLateFee} setRentalOverlock={hub.setRentalOverlock} sendDelinquencyReminder={hub.sendDelinquencyReminder} showToast={showToast} />}
    {page === 'staff-tasks' && <ManagerStaffTasksPanel user={user} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} tasks={hub.staffTasks} createFacilityTask={hub.createFacilityTask} updateFacilityTask={hub.updateFacilityTask} showToast={showToast} />}
    {page === 'support' && <ManagerSupportPanel user={user} showToast={showToast} sb={statusBadge} />}
    {page === 'policies' && <ManagerPoliciesPanel user={user} showToast={showToast} />}
    {page === 'reports' && <ManagerReportsPanel user={user} units={hub.units} reservations={hub.holds} rentals={hub.rentals} payments={hub.payments} activities={hub.activities} showToast={showToast} />}
    {page === 'profile' && <ProfileView user={user} />}
    {toast && <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-lg border border-amber-500/50 bg-[#292a27] px-5 py-3 text-white shadow-2xl"><p className="text-sm font-medium">{toast}</p></div>}
  </Layout>
}
