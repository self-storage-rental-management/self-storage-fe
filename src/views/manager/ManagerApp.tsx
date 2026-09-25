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
import { isManagerFacilityVisible } from '../../domain/managerRules'
import { managerStatusLabel } from './managerI18n'

export default function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
    const hub = useStorageHub()
  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Bảng điều khiển', icon: Icon.home, group: 'Tổng quan', permission: 'view_dashboard' },
    { id: 'inventory', label: 'Tồn kho gian kho', icon: Icon.box, group: 'Vận hành', permission: 'manage_inventory' },
    { id: 'rentals', label: 'Hợp đồng & Gia hạn', icon: Icon.policy, group: 'Vận hành', permission: 'manage_rentals' },
    { id: 'moves', label: 'Nhận kho & Trả kho', icon: Icon.truck, group: 'Vận hành', permission: 'view_checkins' },
    { id: 'payments', label: 'Lịch sử thanh toán & Công nợ', icon: Icon.dollar, group: 'Tài chính', permission: 'manage_payments' },
    { id: 'staff-tasks', label: 'Nhân viên & Nhiệm vụ', icon: Icon.users, group: 'Điều phối', permission: 'manage_staff_tasks' },
    { id: 'reports', label: 'Báo cáo cơ sở', icon: Icon.chart, group: 'Báo cáo', permission: 'view_reports' }
  ]
  const [page, setPage] = useState(() => getInitialPage(nav, 'dashboard'))
  const [toast, setToast] = useState<string | null>(null)
  const [staffTaskDraft, setStaffTaskDraft] = useState<{ referenceId: string; title: string; notes: string } | null>(null)
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      available: 'success', occupied: 'info', maintenance: 'warning', reserved: 'purple', held: 'purple', assigned: 'purple',
      active: 'success', paid: 'success', overdue: 'error', pending: 'warning', completed: 'success', cancelled: 'error', scheduled: 'info',
      requested: 'warning', inspected: 'warning', disputed: 'error', refund_pending: 'purple', payment_due: 'error', awaiting_customer_confirmation: 'warning', 'in-progress': 'info', resolved: 'success', no_show: 'muted',
      CREATED: 'info', DEPOSIT_PAID: 'success', UNIT_RESERVED: 'purple', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'error', EXPIRED: 'muted'
    }
    return <Badge variant={variants[status] || 'muted'}>{managerStatusLabel(status, 'vi')}</Badge>
  }

  const facility = hub.facilities.find(item => item.id === user.facilityId || item.name === user.facility || item.id === user.facility)
  const managerFacilityId = user.facilityId || facility?.id
  const facilityRenewals = hub.renewals.filter(renewal => {
    const rental = hub.rentals.find(item => item.id === renewal.rentalId)
    const renewalFacilityId = renewal.facilityId || rental?.facilityId
    const renewalFacilityName = rental?.facilityName
    return isManagerFacilityVisible({ ...user, facilityId: managerFacilityId }, renewalFacilityId, renewalFacilityName)
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
  const returnDisputeNotifications: LayoutNotification[] = hub.returns
    .filter(item => item.status === 'disputed' && isManagerFacilityVisible({ ...user, facilityId: managerFacilityId }, item.facilityId, item.facilityName))
    .map(item => ({ id: `manager-return-dispute-${item.id}`, date: item.customerConfirmedAt || item.inspectedAt || item.requestedAt, title: 'Customer yêu cầu xem xét lại quyết toán', message: `${item.customerName} · ${item.unitId} · ${item.customerDecisionNote || 'Cần Manager xử lý'}`, page: 'moves', targetId: item.id }))
  const managerNotifications = [...renewalNotifications, ...returnDisputeNotifications]

  return <Layout user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout} additionalNotifications={managerNotifications} canAccess={permission => hub.can(user, permission)} roleLabel={'Quản Lý Cơ Sở'} roleColor="bg-purple-100 text-purple-700">
    {page === 'dashboard' && <ManagerDashboardPanel user={user} setPage={setPage} />}
    {page === 'inventory' && <ManagerInventoryPanel user={user} units={hub.units} rentals={hub.rentals} reservations={hub.holds} checkins={hub.checkins} returns={hub.returns} activities={hub.activities} maintenanceTasks={hub.maintenanceTasks} unitTypes={hub.unitTypes} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} createUnit={hub.createUnit} updateUnit={hub.updateUnit} deleteUnit={hub.deleteUnit} updateUnitStatus={hub.updateUnitStatus} onCreateMaintenanceWork={draft => { setStaffTaskDraft(draft); setPage('staff-tasks') }} showToast={showToast} />}
    {page === 'rentals' && <ManagerRentalsPanel user={user} rentals={hub.rentals} contracts={hub.contracts} renewals={hub.renewals} reservations={hub.holds} units={hub.units} assignUnitToHold={hub.assignUnitToHold} approveRenewal={hub.approveRenewal} rejectRenewal={hub.rejectRenewal} showToast={showToast} />}
    {page === 'moves' && <ManagerMovesPanel user={user} showToast={showToast} statusBadge={statusBadge} onNavigate={setPage} />}
    {page === 'payments' && <ManagerPaymentsPanel user={user} rentals={hub.rentals} payments={hub.payments} config={hub.config} recordRentalPayment={hub.recordRentalPayment} applyRentalLateFee={hub.applyRentalLateFee} waiveRentalLateFee={hub.waiveRentalLateFee} setRentalOverlock={hub.setRentalOverlock} sendDelinquencyReminder={hub.sendDelinquencyReminder} showToast={showToast} />}
    {page === 'staff-tasks' && <ManagerStaffTasksPanel user={user} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} tasks={hub.staffTasks} createFacilityTask={hub.createFacilityTask} updateFacilityTask={hub.updateFacilityTask} initialDraft={staffTaskDraft} onDraftConsumed={() => setStaffTaskDraft(null)} showToast={showToast} />}
    {page === 'reports' && <ManagerReportsPanel user={user} units={hub.units} reservations={hub.holds} rentals={hub.rentals} payments={hub.payments} activities={hub.activities} checkins={hub.checkins} returns={hub.returns} />}
    {page === 'profile' && <ProfileView user={user} />}
    {toast && <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-lg border border-amber-500/50 bg-[#292a27] px-5 py-3 text-white shadow-2xl"><p className="text-sm font-medium">{toast}</p></div>}
  </Layout>
}
