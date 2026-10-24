import { useEffect, useState } from 'react'
import { ManagerPresentationProvider } from './managerPresentation'
import './managerTypography.css'
import Layout, { getInitialPage, Icon, type LayoutNotification, type NavItem } from '../../components/Layout'
import { Badge } from '../../components/ui'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import ProfileView from '../ProfileView'
import ManagerDashboardApiPanel from './ManagerDashboardApiPanel'
import ManagerDashboardPanel from './ManagerDashboardPanel'
import ManagerInventoryPanel from './ManagerInventoryPanel'
import ManagerMovesPanel from './ManagerMovesPanel'
import ManagerPaymentsPanel from './ManagerPaymentsPanel'
import ManagerFinancialApiPanel from './ManagerFinancialApiPanel'
import ManagerRentalsPanel from './ManagerRentalsPanel'
import ManagerRentalsApiPanel from './ManagerRentalsApiPanel'
import ManagerOverdueApiPanel from './ManagerOverdueApiPanel'
import ManagerReportsPanel from './ManagerReportsPanel'
import ManagerStaffTasksPanel from './ManagerStaffTasksPanel'
import ManagerApiStaffTasksPanel from './ManagerApiStaffTasksPanel'
import ManagerUnitAssignmentPanel from './ManagerUnitAssignmentPanel'
import ManagerPaymentComplaintsPanel from './ManagerPaymentComplaintsPanel'
import { canApiActor, getAuthenticatedActor, isApiAuthenticated } from '../../services/authApi'
import { isFacilityTaskOverdue, isManagerFacilityVisible } from '../../domain/managerRules'
import { managerStatusLabel } from './managerI18n'
import { listNotifications, markNotificationRead, notifyBell, type ApiNotification } from '../../services/notificationApi'

export default function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
    const hub = useStorageHub()
  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: Icon.home, group: 'Tổng quan', permission: 'dashboard:read' },
    { id: 'inventory', label: 'Quản lý gian kho', icon: Icon.box, group: 'Vận hành', permission: 'inventory:update' },
    { id: 'unit-assignments', label: "Phân kho đặt chỗ", icon: Icon.box, group: 'Vận hành', permission: 'storage_units:assign' },
    { id: 'rentals', label: 'Hồ sơ thuê & Gia hạn', icon: Icon.policy, group: 'Vận hành', permission: isApiAuthenticated() ? 'rentals:read' : 'rentals:update' },
    { id: 'moves', label: 'Nhận kho & Trả kho', icon: Icon.truck, group: 'Vận hành', permission: 'checkins:read' },
    { id: 'payments', label: isApiAuthenticated() ? 'Lịch sử thanh toán' : 'Lịch sử thanh toán & Công nợ', icon: Icon.dollar, group: 'Tài chính', permission: isApiAuthenticated() ? 'payments:read' : 'payments:collect' },
    ...(isApiAuthenticated() ? [{ id: 'overdue-cases', label: 'Theo dõi quá hạn', icon: Icon.alert, group: 'Tài chính', permission: 'rentals:read' as const }] : []),
    { id: 'payment-complaints', label: 'Khiếu nại thanh toán', icon: Icon.alert, group: 'Tài chính', permission: 'payments:confirm' },
    { id: 'staff-tasks', label: 'Nhân viên & Nhiệm vụ', icon: Icon.users, group: 'Điều phối', permission: 'staff_tasks:update' },
  ]
  const [page, setPage] = useState(() => getInitialPage(nav, 'dashboard'))
  const [backendNotifications, setBackendNotifications] = useState<ApiNotification[]>([])

  useEffect(() => {
    if (!isApiAuthenticated()) return
    let cancelled = false
    const loadNotifications = async () => {
      try {
        const result = await listNotifications(0, 50)
        if (!cancelled) setBackendNotifications(result.data)
      } catch {
        // Manager operations remain available if notifications are temporarily unavailable.
      }
    }
    void loadNotifications()
    const refreshNotifications = () => void loadNotifications()
    window.addEventListener('storagehub:notifications-refresh', refreshNotifications)
    const timer = window.setInterval(refreshNotifications, 10_000)
    return () => {
      cancelled = true
      window.removeEventListener('storagehub:notifications-refresh', refreshNotifications)
      window.clearInterval(timer)
    }
  }, [])
  const [staffTaskDraft, setStaffTaskDraft] = useState<{ referenceId: string; title: string; notes: string } | null>(null)
  const [inventoryRentalId, setInventoryRentalId] = useState<string | undefined>()
  const [inventoryMaintenanceDraft, setInventoryMaintenanceDraft] = useState<{ unitId: string; unitCode: string } | null>(null)
  useEffect(() => {
    if (page !== 'rentals') setInventoryRentalId(undefined)
  }, [page])
  const showToast = (message: string) => {
    const pageTitles: Record<string, string> = {
      dashboard: 'Tổng quan cơ sở',
      inventory: 'Quản lý gian kho',
      'unit-assignments': 'Phân kho đặt chỗ',
      rentals: 'Hồ sơ thuê & Gia hạn',
      moves: 'Nhận kho & Trả kho',
      payments: 'Lịch sử thanh toán',
      'overdue-cases': 'Theo dõi quá hạn',
      'payment-complaints': 'Khiếu nại thanh toán',
      'staff-tasks': 'Nhân viên & Nhiệm vụ',
      reports: 'Báo cáo cơ sở'
    }
    notifyBell({
      title: pageTitles[page] || 'Thông báo quản lý cơ sở',
      message,
      page,
      date: new Date().toISOString()
    })
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
  const actor = getAuthenticatedActor()
  const resolvedFacilityName = user.facility || (actor?.facilityNames && (actor.facilityNames[user.facilityId || ''] || Object.values(actor.facilityNames)[0])) || facility?.name || ''
  const resolvedFacilityId = user.facilityId || (actor?.facilityScopes && Object.keys(actor.facilityScopes)[0]) || facility?.id || ''
  const resolvedUser = { ...user, facility: resolvedFacilityName || user.facility, facilityId: resolvedFacilityId || user.facilityId }
  const managerFacilityId = resolvedFacilityId || user.facilityId || facility?.id
  const facilityRenewals = hub.renewals.filter(renewal => {
    const rental = hub.rentals.find(item => item.id === renewal.rentalId)
    const renewalFacilityId = renewal.facilityId || rental?.facilityId
    const renewalFacilityName = rental?.facilityName
    return isManagerFacilityVisible({ ...resolvedUser, facilityId: managerFacilityId }, renewalFacilityId, renewalFacilityName)
  })
  const renewalNotifications: LayoutNotification[] = (isApiAuthenticated() ? [] : facilityRenewals)
    .filter(renewal => ['pending', 'appointment_scheduled'].includes(renewal.status))
    .map(renewal => ({
      id: `manager-renewal-${renewal.id}-${renewal.status}`,
      date: renewal.requestedAt || renewal.paidAt,
      title: renewal.status === 'pending' ? 'Có yêu cầu gia hạn cần theo dõi' : 'Có lịch ký gia hạn tại cơ sở',
      message: `${renewal.customerName} · ${renewal.unitId} · ${renewal.newEndDate}`,
      page: 'rentals',
      targetId: renewal.rentalId
    }))
  const returnDisputeNotifications: LayoutNotification[] = hub.returns
    .filter(item => item.status === 'disputed' && isManagerFacilityVisible({ ...user, facilityId: managerFacilityId }, item.facilityId, item.facilityName))
    .map(item => ({ id: `manager-return-dispute-${item.id}`, date: item.customerConfirmedAt || item.inspectedAt || item.requestedAt, title: "khách hàng yêu cầu xem xét lại quyết toán", message: `${item.customerName} · ${item.unitId} · ${item.customerDecisionNote || "Cần quản lý cơ sở xử lý"}`, page: 'moves', targetId: item.id }))
  const managerTaskNotifications: LayoutNotification[] = hub.staffTasks
    .filter(task => isManagerFacilityVisible({ ...user, facilityId: managerFacilityId }, task.facilityId, task.facilityName))
    .flatMap(task => {
      const notifications: LayoutNotification[] = []
      if (task.startedAt) notifications.push({ id: `manager-task-accepted-${task.id}-${task.startedAt}`, date: task.startedAt, title: "nhân viên đã nhận nhiệm vụ", message: `${task.assignedStaffName || 'Nhân viên'} · ${task.title}`, page: 'staff-tasks', targetId: task.id })
      if (task.completedAt) notifications.push({ id: `manager-task-completed-${task.id}-${task.completedAt}`, date: task.completedAt, title: "nhân viên đã hoàn thành nhiệm vụ", message: `${task.completedByName || task.assignedStaffName || 'Nhân viên'} · ${task.title}`, page: 'staff-tasks', targetId: task.id })
      if (task.reportedUnableAt) notifications.push({ id: `manager-task-unable-${task.id}-${task.reportedUnableAt}`, date: task.reportedUnableAt, title: "nhân viên báo không thể thực hiện", message: `${task.assignedStaffName || 'Nhân viên'} · ${task.title} · ${task.unableReason || 'Chưa có lý do'}`, page: 'staff-tasks', targetId: task.id })
      if (isFacilityTaskOverdue(task)) notifications.push({ id: `manager-task-overdue-${task.id}-${task.dueAt}`, date: task.dueAt, title: 'Nhiệm vụ đã quá hạn', message: `${task.title} · ${task.assignedStaffName || 'Chưa phân công'}`, page: 'staff-tasks', targetId: task.id })
      return notifications
    })
  const managerNotifications = [...renewalNotifications, ...returnDisputeNotifications, ...managerTaskNotifications]
  const managerNotificationPage = (type: ApiNotification['type']) => {
    if (type === 'CHECKIN' || type === 'RETURN') return 'moves'
    if (type === 'RESERVATION') return 'unit-assignments'
    if (type === 'RENEWAL') return 'rentals'
    if (type === 'PAYMENT' || type === 'OVERDUE') return type === 'OVERDUE' ? 'overdue-cases' : 'payment-complaints'
    return 'dashboard'
  }
  const managerApiNotifications: LayoutNotification[] = backendNotifications.filter(notification => notification.type !== 'SUPPORT').map(notification => ({
    id: `api-notification-${notification.id}`,
    title: notification.title,
    message: notification.content,
    date: notification.createdAt,
    page: managerNotificationPage(notification.type),
    targetId: notification.relatedEntityId ?? undefined,
    isRead: notification.isRead,
  }))

  return <ManagerPresentationProvider><div className="manager-role-layout h-full font-sans text-sm"><Layout user={resolvedUser} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout} notifications={[...managerApiNotifications, ...managerNotifications]} onNotificationClick={(notification) => {
    if (notification.id.startsWith('api-notification-')) {
      const notificationId = notification.id.replace('api-notification-', '')
      setPage(notification.page)
      setBackendNotifications(current => current.map(item =>
        item.id === notificationId ? { ...item, isRead: true } : item
      ))
      void markNotificationRead(notificationId).catch(() => undefined)
      return
    }
    setPage(notification.page)
  }} canAccess={permission => isApiAuthenticated() ? canApiActor(user, permission) : hub.can(user, permission)} roleLabel={'Quản Lý Cơ Sở'} roleColor="bg-purple-100 text-purple-700">
    {page === 'dashboard' && (isApiAuthenticated() ? <ManagerDashboardApiPanel setPage={setPage} /> : <ManagerReportsPanel user={user} units={hub.units} reservations={hub.holds} rentals={hub.rentals} payments={hub.payments} activities={hub.activities} checkins={hub.checkins} returns={hub.returns} />)}
    {page === 'inventory' && <ManagerInventoryPanel user={user} units={hub.units} rentals={hub.rentals} reservations={hub.holds} checkins={hub.checkins} returns={hub.returns} activities={hub.activities} maintenanceTasks={hub.maintenanceTasks} unitTypes={hub.unitTypes} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} createUnit={hub.createUnit} updateUnit={hub.updateUnit} deleteUnit={hub.deleteUnit} updateUnitStatus={hub.updateUnitStatus} onCreateMaintenanceWork={draft => { setStaffTaskDraft(draft); setPage('staff-tasks') }} onOpenRental={rentalId => { setInventoryRentalId(rentalId); setPage('rentals') }} onOpenMaintenance={(unitId, unitCode) => { setInventoryMaintenanceDraft({ unitId, unitCode }); setPage('staff-tasks') }} showToast={showToast} />}
    {page === 'unit-assignments' && <ManagerUnitAssignmentPanel showToast={showToast} />}
    {page === 'rentals' && (isApiAuthenticated() ? <ManagerRentalsApiPanel key={`${user.id}:${JSON.stringify(getAuthenticatedActor()?.facilityScopes)}`} initialRentalId={inventoryRentalId} /> : <ManagerRentalsPanel user={user} rentals={hub.rentals} renewals={hub.renewals} reservations={hub.holds} units={hub.units} unitTypes={hub.unitTypes} assignUnitToHold={hub.assignUnitToHold} showToast={showToast} />)}

    {page === 'moves' && <ManagerMovesPanel user={user} showToast={showToast} statusBadge={statusBadge} onNavigate={setPage} onCreateMaintenanceWork={draft => { setStaffTaskDraft(draft); setPage('staff-tasks') }} />}
    {page === 'payments' && (isApiAuthenticated() ? <ManagerFinancialApiPanel /> : <ManagerPaymentsPanel user={user} rentals={hub.rentals} payments={hub.payments} config={hub.config} applyRentalLateFee={hub.applyRentalLateFee} setRentalOverlock={hub.setRentalOverlock} sendDelinquencyReminder={hub.sendDelinquencyReminder} showToast={showToast} />)}
    {page === 'overdue-cases' && isApiAuthenticated() && <ManagerOverdueApiPanel key={user.id} />}
    {page === 'payment-complaints' && <ManagerPaymentComplaintsPanel showToast={showToast} />}
    {page === 'staff-tasks' && (isApiAuthenticated()
      ? <ManagerApiStaffTasksPanel showToast={showToast} initialUnit={inventoryMaintenanceDraft} onInitialUnitConsumed={() => setInventoryMaintenanceDraft(null)} />
      : <ManagerStaffTasksPanel user={user} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} tasks={hub.staffTasks} createFacilityTask={hub.createFacilityTask} updateFacilityTask={hub.updateFacilityTask} initialDraft={staffTaskDraft} onDraftConsumed={() => setStaffTaskDraft(null)} showToast={showToast} />)}
    {page === 'profile' && <ProfileView user={user} />}
  </Layout></div></ManagerPresentationProvider>
}
