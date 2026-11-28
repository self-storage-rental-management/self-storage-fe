import { useBackendNotifications } from '../../hooks/useBackendNotifications'
import { useCallback, useEffect, useState } from 'react'
import { ManagerPresentationProvider } from './managerPresentation'
import './managerTypography.css'
import Layout, { getInitialPage, Icon, type LayoutNotification, type NavItem } from '../../components/Layout'
import { Badge } from '../../components/ui'
import ManagerSuspicionReport from './ManagerSuspicionReport'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import ProfileView from '../ProfileView'
import ManagerDashboardApiPanel from './ManagerDashboardApiPanel'
import ManagerDashboardPanel from './ManagerDashboardPanel'
import ManagerInventoryApiPanel from './ManagerInventoryApiPanel'
import ManagerInventoryPanel from './ManagerInventoryPanel'
import ManagerAssignmentWorkspace from './ManagerAssignmentWorkspace'
import ManagerPaymentsPanel from './ManagerPaymentsPanel'
import ManagerFinancialApiPanel from './ManagerFinancialApiPanel'
import ManagerRentalsPanel from './ManagerRentalsPanel'
import ManagerRentalsApiPanel from './ManagerRentalsApiPanel'
import ManagerReportsPanel from './ManagerReportsPanel'
import ManagerStaffTasksPanel from './ManagerStaffTasksPanel'
import ManagerApiStaffTasksPanel from './ManagerApiStaffTasksPanel'
import ManagerPaymentComplaintsPanel from './ManagerPaymentComplaintsPanel'
import ManagerComplaintsWorkspace, { type ManagerComplaintsTab } from './ManagerComplaintsWorkspace'
import ManagerReturnsPanel from './ManagerReturnsPanel'
import SupportApiWorkspace from '../support-api/SupportApiWorkspace'
import { canApiActor, getAuthenticatedActor, isApiAuthenticated } from '../../services/authApi'
import { isFacilityTaskOverdue, isManagerFacilityVisible } from '../../domain/managerRules'
import { managerStatusLabel } from './managerI18n'
import { listNotifications, markNotificationRead, notifyBell, type ApiNotification } from '../../services/notificationApi'
import { managerNotificationPage, managerOverdueNotificationRef } from './managerNotificationRouting'
import { notificationRecordTarget } from '../../services/notificationRecordTarget'
import { listManagerPaymentComplaints } from '../../services/managerPaymentComplaintApi'
import { listReturns } from '../../services/returnApi'

const overduePageAlias = { 'overdue-cases': 'staff-tasks' } as const

export default function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const hub = useStorageHub()
  const [complaintCount, setComplaintCount] = useState<number>(0)
  const [complaintInitialTab, setComplaintInitialTab] = useState<ManagerComplaintsTab>('payment')

  const refreshComplaintCount = useCallback(async () => {
    if (!isApiAuthenticated()) {
      const mockDisputes = hub.returns.filter(
        item => item.status === 'disputed' && isManagerFacilityVisible(user, item.facilityId, item.facilityName)
      ).length
      setComplaintCount(mockDisputes)
      return
    }
    try {
      const [res, returnsRes] = await Promise.allSettled([
        listManagerPaymentComplaints(0, 100),
        listReturns('manager', 0, 100)
      ])
      let total = 0
      if (res.status === 'fulfilled') {
        total += res.value.data?.filter(item => item.status === 'PENDING' || item.status === 'REVIEW_OVERDUE').length ?? 0
      }
      if (returnsRes.status === 'fulfilled') {
        total += returnsRes.value.data?.filter(item => item.status === 'disputed').length ?? 0
      }
      setComplaintCount(total)
    } catch {
      // ignore
    }
  }, [hub.returns, user])

  useEffect(() => {
    void refreshComplaintCount()
    const timer = setInterval(() => void refreshComplaintCount(), 8000)
    const handleUpdate = () => void refreshComplaintCount()
    window.addEventListener('storagehub:complaints-updated', handleUpdate)
    window.addEventListener('storagehub:notifications-refresh', handleUpdate)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storagehub:complaints-updated', handleUpdate)
      window.removeEventListener('storagehub:notifications-refresh', handleUpdate)
    }
  }, [refreshComplaintCount])

  const canViewOverdue = isApiAuthenticated() && canApiActor(user, 'rentals:read')
  const canCoordinateTasks = !isApiAuthenticated() || canApiActor(user, 'staff_tasks:update')
  const pageAliases = canViewOverdue ? overduePageAlias : undefined
  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: Icon.home, group: 'Tổng quan', permission: 'dashboard:read' },
    { id: 'inventory', label: 'Thông tin kho', icon: Icon.box, group: 'Vận hành', permission: 'inventory:update' },
    ...(isApiAuthenticated() ? [{ id: 'unit-assignment', label: 'Phân gian', icon: Icon.policy, group: 'Vận hành', permission: 'storage_units:assign' as const }] : []),
    { id: 'rentals', label: 'Hồ sơ thuê & Gia hạn', icon: Icon.policy, group: 'Vận hành', permission: isApiAuthenticated() ? 'rentals:read' : 'rentals:update' },
    { id: 'returns', label: 'Trả kho & Quyết toán', icon: Icon.clipboard, group: 'Vận hành', permission: 'returns:read' as const },
    { id: 'payments', label: isApiAuthenticated() ? 'Lịch sử thanh toán' : 'Lịch sử thanh toán & Công nợ', icon: Icon.dollar, group: 'Tài chính', permission: isApiAuthenticated() ? 'payments:read' : 'payments:collect' },
    ...(isApiAuthenticated()
      ? [{ id: 'complaints', label: 'Khiếu nại và báo cáo', icon: Icon.alert, group: 'Tài chính', permission: 'payments:confirm' as const, badgeCount: complaintCount }]
      : [{ id: 'complaints', label: 'Khiếu nại và báo cáo', icon: Icon.alert, group: 'Tài chính', permission: 'payments:collect' as const, badgeCount: complaintCount }]),
    { id: 'staff-tasks', label: 'Nhân viên & Nhiệm vụ', icon: Icon.users, group: 'Điều phối', permission: canCoordinateTasks ? 'staff_tasks:update' : 'rentals:read' },
    ...(isApiAuthenticated() ? [{ id: 'support', label: 'Yêu cầu hỗ trợ', icon: Icon.support, group: 'Điều phối', permission: 'support:read' as const }] : []),
  ]
  const [page, setPage] = useState(() => getInitialPage(nav, 'dashboard', pageAliases))
  const [supportTarget, setSupportTarget] = useState<{ id: string; request: number }>()
  const [recoveryTarget, setRecoveryTarget] = useState<{ id: string; request: number }>()
  const [renewalTarget, setRenewalTarget] = useState<{ id: string; request: number }>()
  const [overdueTarget, setOverdueTarget] = useState<{ caseRef: string }>()
  const [paymentTarget, setPaymentTarget] = useState<{ id: string }>()
  useEffect(() => { if (page !== 'staff-tasks') setRecoveryTarget(undefined) }, [page])
  useEffect(() => { if (page !== 'overdue-cases') setOverdueTarget(undefined) }, [page])
  useEffect(() => { if (page !== 'payments') setPaymentTarget(undefined) }, [page])
  const notificationFeed = useBackendNotifications(user.id, isApiAuthenticated())
  const { items: backendNotifications, setItems: setBackendNotifications } = notificationFeed


  const [staffTaskDraft, setStaffTaskDraft] = useState<{ referenceId: string; title: string; notes: string } | null>(null)
  const [returnReviewTarget, setReturnReviewTarget] = useState<{ id: string; request: number }>()
  const [suspicionReportId, setSuspicionReportId] = useState<string>()
  const openSuspicionReport = (id: string) => {
    setComplaintInitialTab('reports')
    setPage('complaints')
    setSuspicionReportId(id)
  }
  const [inventoryRentalId, setInventoryRentalId] = useState<string | undefined>()
  const [inventoryMaintenanceDraft, setInventoryMaintenanceDraft] = useState<{ unitId: string; unitCode: string } | null>(null)
  useEffect(() => {
    if (page !== 'rentals') setInventoryRentalId(undefined)
    if (page !== 'rentals') setRenewalTarget(undefined)
  }, [page])
  useEffect(() => {
    if (page !== 'returns') setReturnReviewTarget(undefined)
  }, [page])
  const showToast = (message: string) => {
    const pageTitles: Record<string, string> = {
      dashboard: 'Tổng quan cơ sở',
      inventory: 'Thông tin kho',
      'unit-assignment': 'Phân gian',
      rentals: 'Hồ sơ thuê & Gia hạn',
      returns: 'Trả kho & Quyết toán',
      payments: 'Lịch sử thanh toán',
      'overdue-cases': 'Theo dõi quá hạn',
      complaints: 'Khiếu nại và báo cáo',
      'payment-complaints': 'Khiếu nại và báo cáo',
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
      requested: 'warning', inspected: 'warning', awaiting_business_review: 'error', disputed: 'error', refund_pending: 'purple', payment_due: 'error', awaiting_customer_confirmation: 'warning', 'in-progress': 'info', resolved: 'success', no_show: 'muted',
      CREATED: 'info', DEPOSIT_PAID: 'success', UNIT_RESERVED: 'purple', READY_FOR_CHECKIN: 'success', COMPLETED: 'success', CANCELLED: 'error', EXPIRED: 'muted'
    }
    return <Badge variant={variants[status] || 'muted'}>{managerStatusLabel(status, 'vi')}</Badge>
  }

  const facility = isApiAuthenticated()
    ? undefined
    : hub.facilities.find(item => item.id === user.facilityId || item.name === user.facility || item.id === user.facility)
  const actor = getAuthenticatedActor()
  const resolvedFacilityName = user.facility || (actor?.facilityNames && (actor.facilityNames[user.facilityId || ''] || Object.values(actor.facilityNames)[0])) || (!isApiAuthenticated() ? facility?.name : '') || ''
  const resolvedFacilityId = user.facilityId || (actor?.facilityScopes && Object.keys(actor.facilityScopes)[0]) || (!isApiAuthenticated() ? facility?.id : '') || ''
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
  const returnDisputeNotifications: LayoutNotification[] = (isApiAuthenticated() ? [] : hub.returns)
    .filter(item => item.status === 'disputed' && isManagerFacilityVisible({ ...user, facilityId: managerFacilityId }, item.facilityId, item.facilityName))
    .map(item => ({ id: `manager-return-dispute-${item.id}`, date: item.customerConfirmedAt || item.inspectedAt || item.requestedAt, title: "khách hàng yêu cầu xem xét lại quyết toán", message: `${item.customerName} · ${item.unitId} · ${item.customerDecisionNote || "Cần quản lý cơ sở xử lý"}`, page: 'complaints', targetId: item.id }))
  const managerTaskNotifications: LayoutNotification[] = (isApiAuthenticated() ? [] : hub.staffTasks)
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
  const managerApiNotifications: LayoutNotification[] = backendNotifications.map(notification => ({
    id: `api-notification-${notification.id}`,
    title: notification.title,
    message: notification.content,
    date: notification.createdAt,
    page: managerNotificationPage(notification),
    targetId: notification.relatedEntityId ?? undefined,
    isRead: notification.isRead,
  }))

  return <ManagerPresentationProvider><div className="manager-role-layout h-full font-sans text-sm"><Layout user={resolvedUser} navItems={nav} currentPage={page} pageAliases={pageAliases} onNavigate={setPage} onLogout={onLogout} notifications={[...managerApiNotifications, ...managerNotifications]} notificationError={notificationFeed.error} notificationsLoading={notificationFeed.loading} hasMoreNotifications={notificationFeed.hasMore} onLoadMoreNotifications={notificationFeed.loadMore} onRetryNotifications={notificationFeed.refresh} onNotificationClick={(notification) => {
    if (notification.id.startsWith('api-notification-')) {
      const notificationId = notification.id.replace('api-notification-', '')
      const source = backendNotifications.find(item => item.id === notificationId)
      if (source && notification.page === 'payments') {
        const target = notificationRecordTarget(source, 'manager')
        setPaymentTarget(target?.kind === 'payment' ? { id: target.id } : undefined)
      }
      if (notification.page === 'suspicion-report' && notification.targetId) {
        openSuspicionReport(notification.targetId)
      } else {
        setSuspicionReportId(undefined)
        setPage(notification.page === 'overdue-cases' && !canViewOverdue ? 'dashboard' : notification.page)
      }
      if (notification.page === 'overdue-cases' && canViewOverdue && source) {
        const caseRef = managerOverdueNotificationRef(source)
        setOverdueTarget(caseRef ? { caseRef } : undefined)
      }
      if (notification.page === 'staff-tasks' && notification.targetId
        && source?.relatedEntityType === 'VIOLATION_RECOVERY') {
        setRecoveryTarget({ id: notification.targetId, request: Date.now() })
      }
      if (notification.page === 'returns' && notification.targetId && notification.title === 'Cần đối soát danh tính trả kho') {
        setReturnReviewTarget({ id: notification.targetId, request: Date.now() })
      }
      if (notification.page === 'support' && notification.targetId) setSupportTarget({ id: notification.targetId, request: Date.now() })
      if (notification.page === 'rentals' && notification.targetId) setRenewalTarget({ id: notification.targetId, request: Date.now() })
      setBackendNotifications(current => current.map(item =>
        item.id === notificationId ? { ...item, isRead: true } : item
      ))
      void markNotificationRead(notificationId).catch(reason => {
        notificationFeed.reportFailure(reason)
        notificationFeed.refresh()
      })
      return
    }
    setPage(notification.page)
  }} canAccess={permission => isApiAuthenticated() ? canApiActor(user, permission) : hub.can(user, permission)} roleLabel={'Quản Lý Cơ Sở'} roleColor="bg-purple-100 text-purple-700">
    {suspicionReportId && <ManagerSuspicionReport key={suspicionReportId} id={suspicionReportId}
      onClose={() => setSuspicionReportId(undefined)}
      onOpenRental={id => { setSuspicionReportId(undefined); setInventoryRentalId(id); setPage('rentals') }}
      onOpenRecovery={canApiActor(user, 'staff_tasks:update')
        ? id => { setSuspicionReportId(undefined); setRecoveryTarget({ id, request: Date.now() }); setPage('staff-tasks') }
        : undefined} />}
    {page === 'dashboard' && (isApiAuthenticated() ? <ManagerDashboardApiPanel setPage={setPage} /> : <ManagerReportsPanel user={user} units={hub.units} reservations={hub.holds} rentals={hub.rentals} payments={hub.payments} activities={hub.activities} checkins={hub.checkins} returns={hub.returns} />)}
    {page === 'inventory' && (isApiAuthenticated()
      ? <ManagerInventoryApiPanel onOpenRental={rentalId => { setInventoryRentalId(rentalId); setPage('rentals') }} onOpenMaintenance={(unitId, unitCode) => { setInventoryMaintenanceDraft({ unitId, unitCode }); setPage('staff-tasks') }} />
      : <ManagerInventoryPanel user={user} units={hub.units} rentals={hub.rentals} reservations={hub.holds} checkins={hub.checkins} returns={hub.returns} activities={hub.activities} maintenanceTasks={hub.maintenanceTasks} unitTypes={hub.unitTypes} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} createUnit={hub.createUnit} updateUnit={hub.updateUnit} deleteUnit={hub.deleteUnit} updateUnitStatus={hub.updateUnitStatus} onCreateMaintenanceWork={draft => { setStaffTaskDraft(draft); setPage('staff-tasks') }} onOpenRental={rentalId => { setInventoryRentalId(rentalId); setPage('rentals') }} onOpenMaintenance={(unitId, unitCode) => { setInventoryMaintenanceDraft({ unitId, unitCode }); setPage('staff-tasks') }} showToast={showToast} />)}
    {page === 'unit-assignment' && isApiAuthenticated() && <ManagerAssignmentWorkspace showToast={showToast} onOpenRental={rentalId => { setInventoryRentalId(rentalId); setPage('rentals') }} onOpenMaintenance={(unitId, unitCode) => { setInventoryMaintenanceDraft({ unitId, unitCode }); setPage('staff-tasks') }} />}
    {page === 'rentals' && (isApiAuthenticated() ? <ManagerRentalsApiPanel key={`${user.id}:${JSON.stringify(getAuthenticatedActor()?.facilityScopes)}:${renewalTarget?.request ?? 0}`} initialRentalId={inventoryRentalId} initialRenewalId={renewalTarget?.id} onSuspicionReportSubmitted={openSuspicionReport} /> : <ManagerRentalsPanel user={user} rentals={hub.rentals} renewals={hub.renewals} reservations={hub.holds} units={hub.units} unitTypes={hub.unitTypes} assignUnitToHold={hub.assignUnitToHold} showToast={showToast} />)}
    {page === 'returns' && (
      <ManagerReturnsPanel
        reviewTarget={returnReviewTarget}
        user={user}
        showToast={showToast}
        sb={statusBadge}
        onOpenRecovery={() => { setRecoveryTarget(undefined); setPage('staff-tasks') }}
        onCreateMaintenanceWork={draft => { setStaffTaskDraft(draft); setPage('staff-tasks') }}
        onNavigateToComplaints={tab => {
          setComplaintInitialTab(tab || 'returns')
          setPage('complaints')
        }}
      />
    )}

    {page === 'payments' && (isApiAuthenticated() ? <ManagerFinancialApiPanel paymentTarget={paymentTarget}
      onPaymentClosed={() => setPaymentTarget(undefined)} /> : <ManagerPaymentsPanel user={user} rentals={hub.rentals} payments={hub.payments} config={hub.config} applyRentalLateFee={hub.applyRentalLateFee} setRentalOverlock={hub.setRentalOverlock} sendDelinquencyReminder={hub.sendDelinquencyReminder} showToast={showToast} />)}
    {(page === 'complaints' || page === 'payment-complaints') && (
      <ManagerComplaintsWorkspace
        user={resolvedUser}
        showToast={showToast}
        activeTab={complaintInitialTab}
        onOpenReport={setSuspicionReportId}
        onTabChange={setComplaintInitialTab}
      />
    )}
    {(page === 'staff-tasks' || (page === 'overdue-cases' && canViewOverdue)) && (isApiAuthenticated()
      ? <ManagerApiStaffTasksPanel showToast={showToast} initialUnit={inventoryMaintenanceDraft}
          onInitialUnitConsumed={() => setInventoryMaintenanceDraft(null)} initialRecovery={recoveryTarget}
          initialOverdue={overdueTarget} onOverdueClosed={() => setOverdueTarget(undefined)}
          canCoordinate={canCoordinateTasks} canViewOverdue={canViewOverdue}
          showOverdue={page === 'overdue-cases' || !canCoordinateTasks}
          onSelectOverdue={selected => setPage(selected ? 'overdue-cases' : 'staff-tasks')} />
      : <ManagerStaffTasksPanel user={user} facilityId={managerFacilityId || ''} facilityName={facility?.name || user.facility || ''} tasks={hub.staffTasks} createFacilityTask={hub.createFacilityTask} updateFacilityTask={hub.updateFacilityTask} initialDraft={staffTaskDraft} onDraftConsumed={() => setStaffTaskDraft(null)} showToast={showToast} />)}
    {page === 'profile' && <ProfileView user={user} />}
    {page === 'support' && isApiAuthenticated() && <SupportApiWorkspace role="manager" openTicket={supportTarget} />}
  </Layout></div></ManagerPresentationProvider>
}
