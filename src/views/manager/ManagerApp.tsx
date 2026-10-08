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
import ManagerRentalsApiPanel from './ManagerRentalsApiPanel'
import ManagerOverdueApiPanel from './ManagerOverdueApiPanel'
import SupportApiWorkspace from '../support-api/SupportApiWorkspace'
import ManagerReportsPanel from './ManagerReportsPanel'
import ManagerStaffTasksPanel from './ManagerStaffTasksPanel'
import ManagerUnitAssignmentPanel from './ManagerUnitAssignmentPanel'
import ManagerUnitReleasePanel from './ManagerUnitReleasePanel'
import ManagerPaymentComplaintsPanel from './ManagerPaymentComplaintsPanel'
import { canApiActor, getAuthenticatedActor, isApiAuthenticated } from '../../services/authApi'
import { isFacilityTaskOverdue, isManagerFacilityVisible } from '../../domain/managerRules'
import { managerStatusLabel } from './managerI18n'

export default function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
    const hub = useStorageHub()
const nav: NavItem[] = [
  { id: 'dashboard', label: 'Bảng điều khiển', icon: Icon.home, group: 'Tổng quan', permission: 'dashboard:read' },
  { id: 'inventory', label: 'Quản lý gian kho', icon: Icon.box, group: 'Vận hành', permission: 'inventory:update' },
  { id: 'unit-assignments', label: 'Phân kho reservation', icon: Icon.box, group: 'Vận hành', permission: 'storage_units:assign' },
  { id: 'unit-releases', label: 'Giải phóng kho đã hủy', icon: Icon.alert, group: 'Vận hành', permission: 'storage_units:assign' },
  { id: 'rentals', label: 'Hồ sơ thuê & Gia hạn', icon: Icon.policy, group: 'Vận hành', permission: isApiAuthenticated() ? 'rentals:read' : 'rentals:update' },
  { id: 'moves', label: 'Nhận kho & Trả kho', icon: Icon.truck, group: 'Vận hành', permission: 'checkins:read' },
  { id: 'payments', label: 'Lịch sử thanh toán & Công nợ', icon: Icon.dollar, group: 'Tài chính', permission: 'payments:collect' },
  { id: 'overdue-cases', label: 'Theo dõi quá hạn', icon: Icon.alert, group: 'Tài chính', permission: 'rentals:read' },
  { id: 'payment-complaints', label: 'Khiếu nại thanh toán', icon: Icon.alert, group: 'Tài chính', permission: 'payments:collect' },
  { id: 'support-api', label: 'Hỗ trợ', icon: Icon.support, group: 'Điều phối', permission: 'support:read' },
  { id: 'staff-tasks', label: 'Nhân viên & Nhiệm vụ', icon: Icon.users, group: 'Điều phối', permission: 'staff_tasks:update' },
  { id: 'reports', label: 'Báo cáo cơ sở', icon: Icon.chart, group: 'Báo cáo', permission: 'reports:read' }
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
  const renewalNotifications: LayoutNotification[] = (isApiAuthenticated() ? [] : facilityRenewals)
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
  const managerTaskNotifications: LayoutNotification[] = hub.staffTasks
    .filter(task => isManagerFacilityVisible({ ...user, facilityId: managerFacilityId }, task.facilityId, task.facilityName))
    .flatMap(task => {
      const notifications: LayoutNotification[] = []
      if (task.startedAt) notifications.push({ id: `manager-task-accepted-${task.id}-${task.startedAt}`, date: task.startedAt, title: 'Staff đã nhận nhiệm vụ', message: `${task.assignedStaffName || 'Staff'} · ${task.title}`, page: 'staff-tasks', targetId: task.id })
      if (task.completedAt) notifications.push({ id: `manager-task-completed-${task.id}-${task.completedAt}`, date: task.completedAt, title: 'Staff đã hoàn thành nhiệm vụ', message: `${task.completedByName || task.assignedStaffName || 'Staff'} · ${task.title}`, page: 'staff-tasks', targetId: task.id })
      if (task.reportedUnableAt) notifications.push({ id: `manager-task-unable-${task.id}-${task.reportedUnableAt}`, date: task.reportedUnableAt, title: 'Staff báo không thể thực hiện', message: `${task.assignedStaffName || 'Staff'} · ${task.title} · ${task.unableReason || 'Chưa có lý do'}`, page: 'staff-tasks', targetId: task.id })
      if (isFacilityTaskOverdue(task)) notifications.push({ id: `manager-task-overdue-${task.id}-${task.dueAt}`, date: task.dueAt, title: 'Nhiệm vụ đã quá hạn', message: `${task.title} · ${task.assignedStaffName || 'Chưa phân công'}`, page: 'staff-tasks', targetId: task.id })
      return notifications
    })
  const managerNotifications = [...renewalNotifications, ...returnDisputeNotifications, ...managerTaskNotifications]

  return <Layout user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout} additionalNotifications={managerNotifications} canAccess={permission => isApiAuthenticated() ? canApiActor(user, permission) : hub.can(user, permission)} roleLabel={'Quản Lý Cơ Sở'} roleColor="bg-purple-100 text-purple-700">
    {page === 'dashboard' && <ManagerDashboardPanel user={user} setPage={setPage} />}
    {page === 'inventory' && <ManagerInventoryPanel user={user} units={hub.units} rentals={hub.rentals} reservations={hub.holds} checkins={hub.checkins} returns={hub.returns} activities={hub.activities} maintenanceTasks={hub.maintenanceTasks} unitTypes={hub.unitTypes} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} createUnit={hub.createUnit} updateUnit={hub.updateUnit} deleteUnit={hub.deleteUnit} updateUnitStatus={hub.updateUnitStatus} onCreateMaintenanceWork={draft => { setStaffTaskDraft(draft); setPage('staff-tasks') }} showToast={showToast} />}
    {page === 'unit-assignments' && <ManagerUnitAssignmentPanel showToast={showToast} />}
    {page === 'unit-releases' && <ManagerUnitReleasePanel showToast={showToast} />}
    {page === 'rentals' && (isApiAuthenticated() ? <ManagerRentalsApiPanel key={`${user.id}:${JSON.stringify(getAuthenticatedActor()?.facilityScopes)}`} /> : <ManagerRentalsPanel user={user} rentals={hub.rentals} renewals={hub.renewals} reservations={hub.holds} units={hub.units} unitTypes={hub.unitTypes} assignUnitToHold={hub.assignUnitToHold} approveRenewal={hub.approveRenewal} rejectRenewal={hub.rejectRenewal} showToast={showToast} />)}

    {page === 'moves' && <ManagerMovesPanel user={user} showToast={showToast} statusBadge={statusBadge} onNavigate={setPage} />}
    {page === 'payments' && <ManagerPaymentsPanel user={user} rentals={hub.rentals} payments={hub.payments} config={hub.config} applyRentalLateFee={hub.applyRentalLateFee} setRentalOverlock={hub.setRentalOverlock} sendDelinquencyReminder={hub.sendDelinquencyReminder} showToast={showToast} />}
    {page === 'overdue-cases' && isApiAuthenticated() && <ManagerOverdueApiPanel key={user.id} />}
    {page === 'support-api' && isApiAuthenticated() && <SupportApiWorkspace role="manager" />}
    {page === 'payment-complaints' && <ManagerPaymentComplaintsPanel showToast={showToast} />}
    {page === 'staff-tasks' && <ManagerStaffTasksPanel user={user} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} tasks={hub.staffTasks} createFacilityTask={hub.createFacilityTask} updateFacilityTask={hub.updateFacilityTask} initialDraft={staffTaskDraft} onDraftConsumed={() => setStaffTaskDraft(null)} showToast={showToast} />}
    {page === 'reports' && <ManagerReportsPanel user={user} units={hub.units} reservations={hub.holds} rentals={hub.rentals} payments={hub.payments} activities={hub.activities} checkins={hub.checkins} returns={hub.returns} />}
    {page === 'profile' && <ProfileView user={user} />}
    {toast && <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-lg border border-amber-500/50 bg-[#292a27] px-5 py-3 text-white shadow-2xl"><p className="text-sm font-medium">{toast}</p></div>}
  </Layout>
}
