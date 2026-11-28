import { recordDisplayCode } from '../../utils/recordDisplayCode'
import { compareWorkQueue } from '../../utils/workQueueSort'
import { displayStatusLabel } from '../../presentation/statusLabels'
import EmergencyContactsPanel from '../../components/EmergencyContactsPanel'
import './managerStaffTasks.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { vietnamDateInput } from '../../utils/vietnamTime'
import { ApiClientError } from '../../services/apiClient'
import { managerDisplayError, managerDisplayText } from './managerPresentation'
import { managerStatusLabel } from './managerI18n'
import ManagerActionNotice from './ManagerActionNotice'
import { listAllRecoveryTasks, type RecoveryTask } from '../../services/recoveryTasksApi'
import RecoveryTaskDetail, { recoveryStatusLabels } from '../rental-api/RecoveryTaskDetail'
import { rentalDate } from '../rental-api/presentation'
import { managerFacilityNotice, singleManagerFacility } from './managerFacilityUi'
import ManagerRecoveryCards from './ManagerRecoveryCards'
import {
  assignMaintenanceTask,
  cancelMaintenanceTask,
  createMaintenanceTask,
  listFacilityStorageUnits,
  listMaintenanceStaff,
  listManagerMaintenanceTasks,
  updateStorageUnitStatus,
  type MaintenanceStaffOption,
  type MaintenanceStorageUnit,
  type MaintenanceTaskApi,
  type MaintenanceTaskPriority,
} from '../../services/maintenanceApi'

interface Props {
  showToast: (message: string) => void
  initialUnit?: { unitId: string; unitCode: string } | null
  onInitialUnitConsumed?: () => void
  initialRecovery?: { id: string; request: number }
  initialOverdue?: { caseRef: string }
  onOverdueClosed?: () => void
  canCoordinate: boolean
  canViewOverdue: boolean
  showOverdue: boolean
  onSelectOverdue: (selected: boolean) => void
}

const taskStatusLabel: Record<MaintenanceTaskApi['status'], string> = {
  open: 'Chờ nhận',
  in_progress: 'Đang thực hiện',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
}

const taskPriorityLabel: Record<MaintenanceTaskPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
}

function statusVariant(status: MaintenanceTaskApi['status']) {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'error'
  if (status === 'in_progress') return 'info'
  return 'warning'
}

export default function ManagerApiStaffTasksPanel({
  showToast, initialUnit, onInitialUnitConsumed, initialRecovery, initialOverdue, onOverdueClosed,
  canCoordinate, canViewOverdue, showOverdue, onSelectOverdue,
}: Props) {
  const [coordinationTab, setCoordinationTab] = useState<'tasks' | 'recovery'>(initialRecovery ? 'recovery' : 'tasks')
  const [overdueLocked, setOverdueLocked] = useState(false)
  const overdueSelected = canViewOverdue && showOverdue
  const activeTab = overdueSelected ? 'recovery' : coordinationTab
  useEffect(() => { if (initialRecovery) setCoordinationTab('recovery') }, [initialRecovery])
  const selectCoordinationTab = (tab: 'tasks' | 'recovery') => {
    if (overdueLocked) return
    setCoordinationTab(tab)
    if (showOverdue) onSelectOverdue(false)
  }
  const actor = getAuthenticatedActor()
  const facilityId = singleManagerFacility(actor)
  const [tasks, setTasks] = useState<MaintenanceTaskApi[]>([])
  const [recoveryTasks, setRecoveryTasks] = useState<RecoveryTask[]>([])
  const [recoveryError, setRecoveryError] = useState<unknown>(null)
  const [recoveryDisabled, setRecoveryDisabled] = useState(false)
  const [selectedRecovery, setSelectedRecovery] = useState<RecoveryTask | null>(null)
  const recoveryCloseGuard = useRef<() => boolean>(() => false)
  const [units, setUnits] = useState<MaintenanceStorageUnit[]>([])
  const [staff, setStaff] = useState<MaintenanceStaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [taskError, setTaskError] = useState<unknown>(null)
  const [unitReadFailed, setUnitReadFailed] = useState(false)
  const [staffReadFailed, setStaffReadFailed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [storageUnitId, setStorageUnitId] = useState('')
  const [assignedStaffId, setAssignedStaffId] = useState('')
  const [priority, setPriority] = useState<MaintenanceTaskPriority>('medium')
  const [dueAt, setDueAt] = useState(() => vietnamDateInput(Date.now() + 86_400_000))
  const earliestDueDate = vietnamDateInput()
  const dueDateInPast = Boolean(dueAt && dueAt < earliestDueDate)
  const [saving, setSaving] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<MaintenanceTaskApi | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [unitStatusTargetId, setUnitStatusTargetId] = useState('')
  const [unitStatusTargetValue, setUnitStatusTargetValue] = useState<'available' | 'maintenance'>('maintenance')
  const [unitStatusReason, setUnitStatusReason] = useState('')
  const [unitStatusCreateTask, setUnitStatusCreateTask] = useState(true)
  const [unitStatusStaffId, setUnitStatusStaffId] = useState('')

  const reload = useCallback(async () => {
    if (!canCoordinate) return
    if (!facilityId) {
      setTaskError(new Error(managerFacilityNotice(actor)))
      setLoading(false)
      return
    }
    setLoading(true)
    setTaskError(null)
    setRecoveryError(null)
    setRecoveryDisabled(false)
    setUnitReadFailed(false)
    setStaffReadFailed(false)
    const results = await Promise.allSettled([
      listManagerMaintenanceTasks(facilityId),
      listFacilityStorageUnits(facilityId),
      listMaintenanceStaff(facilityId),
      listAllRecoveryTasks('manager',facilityId),
    ])
    const [taskResult, unitResult, staffResult, recoveryResult] = results
    if (recoveryResult.status === 'fulfilled') setRecoveryTasks(recoveryResult.value)
    else {
      setRecoveryTasks([])
      if (recoveryResult.reason instanceof ApiClientError && recoveryResult.reason.code === 'FEATURE_DISABLED') setRecoveryDisabled(true)
      else setRecoveryError(recoveryResult.reason)
    }
    if (taskResult.status === 'fulfilled') setTasks(taskResult.value.data.filter(task => task.recoveryType !== 'VIOLATION'))
    else {
      setTasks([])
      setTaskError(taskResult.reason)
    }
    if (unitResult.status === 'fulfilled') {
      setUnits(unitResult.value.data.filter(unit => ['available', 'maintenance'].includes(unit.status)))
    } else {
      setUnits([])
      setUnitReadFailed(true)
    }
    if (staffResult.status === 'fulfilled') setStaff(staffResult.value)
    else {
      setStaff([])
      setStaffReadFailed(true)
    }
    setLoading(false)
  }, [actor, facilityId, canCoordinate])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!canCoordinate || !initialUnit || loading || unitReadFailed || staffReadFailed) return
    if (units.some(unit => unit.id === initialUnit.unitId) && staff.length) {
      setStorageUnitId(initialUnit.unitId)
      setTitle(`Bảo trì ${initialUnit.unitCode}`)
      setModalOpen(true)
    } else {
      showToast('Gian kho chưa đủ điều kiện tạo nhiệm vụ bảo trì hoặc chưa có nhân viên phù hợp.')
    }
    onInitialUnitConsumed?.()
  }, [initialUnit, loading, unitReadFailed, staffReadFailed, units, staff, canCoordinate])

  const openTasks = useMemo(() => tasks.filter(task => !['completed', 'cancelled'].includes(task.status)), [tasks])
  const queueRows = [
    ...recoveryTasks.map(task => ({ kind: 'recovery' as const, task, order: {
      id: `recovery-${task.id}`, closed: task.status === 'CLOSED', waitingSince: task.receivedAt,
    } })),
    ...tasks.map(task => ({ kind: 'maintenance' as const, task, order: {
      id: `maintenance-${task.id}`, closed: ['completed', 'cancelled'].includes(task.status),
      urgent: task.priority === 'high', dueAt: task.deadlineAt ?? task.dueAt,
      waitingSince: task.createdAt, completedAt: task.completedAt,
    } })),
  ].sort((a, b) => compareWorkQueue(a.order, b.order))

  const resetForm = () => {
    setTitle('')
    setReason('')
    setStorageUnitId('')
    setAssignedStaffId('')
    setPriority('medium')
    setDueAt(vietnamDateInput(Date.now() + 86_400_000))
  }

  const createTask = async () => {
    if (!title.trim() || !reason.trim() || !storageUnitId || !assignedStaffId || !dueAt) return
    if (dueAt < vietnamDateInput()) {
      showToast('Hạn xử lý phải từ hôm nay trở đi.')
      return
    }
    setSaving(true)
    try {
      await createMaintenanceTask({
        storageUnitId,
        title: title.trim(),
        reason: reason.trim(),
        priority,
        assignedStaffId,
        dueAt,
      })
      setModalOpen(false)
      resetForm()
      showToast('Đã tạo và giao nhiệm vụ bảo trì.')
      await reload()
    } catch (nextError) {
      showToast(managerDisplayError(nextError))
    } finally {
      setSaving(false)
    }
  }

  const reassign = async (taskId: string, nextStaffId: string) => {
    try {
      await assignMaintenanceTask(taskId, nextStaffId)
      showToast('Đã giao lại nhiệm vụ cho nhân viên.')
      await reload()
    } catch (nextError) {
      showToast(managerDisplayError(nextError))
    }
  }

  const handleCancelTask = async () => {
    if (!cancelTarget) return
    setSaving(true)
    try {
      await cancelMaintenanceTask(cancelTarget.id, cancelReason)
      showToast('Đã hủy nhiệm vụ bảo trì.')
      setCancelTarget(null)
      setCancelReason('')
      await reload()
    } catch (nextError) {
      showToast(managerDisplayError(nextError))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateUnitStatus = async () => {
    if (!unitStatusTargetId) return
    setSaving(true)
    try {
      await updateStorageUnitStatus(unitStatusTargetId, {
        status: unitStatusTargetValue,
        reason: unitStatusReason.trim() || undefined,
        createMaintenanceTask: unitStatusTargetValue === 'maintenance' ? unitStatusCreateTask : undefined,
        assignedStaffId: unitStatusTargetValue === 'maintenance' && unitStatusCreateTask && unitStatusStaffId ? unitStatusStaffId : undefined,
      })
      showToast('Đã cập nhật trạng thái gian kho.')
      setStatusModalOpen(false)
      setUnitStatusTargetId('')
      setUnitStatusReason('')
      setUnitStatusStaffId('')
      await reload()
    } catch (nextError) {
      showToast(managerDisplayError(nextError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manager-staff-tasks fade-in space-y-5">
      <SectionHeader
        eyebrow="Điều phối ca làm việc"
        title="Nhân viên & Nhiệm vụ"
        subtitle="Theo dõi nhiệm vụ bảo trì, hợp đồng quá hạn và thu hồi kho tại cơ sở."
        action={canCoordinate && activeTab === 'tasks' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={loading || !facilityId || unitReadFailed || !units.length}
              onClick={() => setStatusModalOpen(true)}
            >
              Đổi trạng thái kho
            </Button>
            <Button
              disabled={loading || !facilityId || unitReadFailed || staffReadFailed || !units.length || !staff.length}
              onClick={() => setModalOpen(true)}
            >
              Tạo nhiệm vụ
            </Button>
          </div>
        )}
      />

      <div className="flex flex-wrap gap-2 border-b border-stone-200" role="tablist" aria-label="Nội dung điều phối">
        {canCoordinate && <button type="button" role="tab" id="staff-tasks-tab" disabled={overdueLocked} aria-selected={activeTab === 'tasks'} aria-controls="staff-tasks-panel"
          className={['border-b-2 px-4 py-3 text-sm font-semibold', activeTab === 'tasks' ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'].join(' ')}
          onClick={() => selectCoordinationTab('tasks')}>Nhiệm vụ</button>}
        {(canCoordinate || canViewOverdue) && <button type="button" role="tab" id="staff-recovery-tab" aria-selected={activeTab === 'recovery'} aria-controls="staff-recovery-panel"
          className={['border-b-2 px-4 py-3 text-sm font-semibold', activeTab === 'recovery' ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'].join(' ')}
          onClick={() => { if (activeTab !== 'recovery') selectCoordinationTab('recovery') }}>Thu hồi kho</button>}
      </div>

      {(canCoordinate || canViewOverdue) && <div id="staff-recovery-panel" role="tabpanel" aria-labelledby="staff-recovery-tab" hidden={activeTab !== 'recovery'} className="space-y-5">
        {activeTab === 'recovery' && <>
          <ManagerRecoveryCards
            key={JSON.stringify([actor?.id, facilityId])}
            facilityId={facilityId}
            canCoordinate={canCoordinate}
            canViewOverdue={canViewOverdue}
            initialRecovery={initialRecovery}
            initialOverdue={initialOverdue}
            onOverdueClosed={onOverdueClosed}
            onLocked={setOverdueLocked}
          />
        </>}
      </div>}

      {canCoordinate && <>
      <div id="staff-tasks-panel" role="tabpanel" aria-labelledby="staff-tasks-tab" hidden={activeTab !== 'tasks'} className="space-y-5">
      {!loading && !taskError && !staffReadFailed && !staff.length && <ManagerActionNotice tone="info">Chưa có nhân viên được phân công để nhận nhiệm vụ tại cơ sở này.</ManagerActionNotice>}
      {!loading && !taskError && !unitReadFailed && !units.length && <ManagerActionNotice tone="info">Chưa có gian kho khả dụng để tạo nhiệm vụ bảo trì.</ManagerActionNotice>}
      {!loading && (unitReadFailed || staffReadFailed) && <p className="text-xs text-stone-500">Chưa tải được danh sách kho hoặc nhân viên để tạo nhiệm vụ. Dữ liệu nhiệm vụ vẫn được tải riêng.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-stone-500">Tổng nhiệm vụ</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : taskError || recoveryError ? '-' : tasks.length + recoveryTasks.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-stone-500">Đang xử lý</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : taskError || recoveryError ? '-' : openTasks.length + recoveryTasks.filter(task => task.status !== 'CLOSED').length}</p></Card>
        <Card className="col-span-2 p-4 lg:col-span-1"><p className="text-sm text-stone-500">Nhân viên đủ điều kiện</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : staffReadFailed ? '-' : staff.length}</p></Card>
      </div>

      <Card className="manager-staff-task-table overflow-hidden !rounded-2xl !shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-5 py-5">
          <h2 className="text-lg font-semibold text-stone-900">Danh sách nhiệm vụ</h2>
          {!loading && !taskError && !recoveryError && <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-sm tabular-nums text-stone-600">{tasks.length + recoveryTasks.length} nhiệm vụ</span>}
        </div>
        <Table tableClassName="min-w-[1050px] table-fixed">
          <colgroup><col className="w-[29%]" /><col className="w-[10%]" /><col className="w-[19%]" /><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[8%]" /></colgroup>
          <Thead><tr><Th>Nhiệm vụ</Th><Th>Loại</Th><Th>Gian kho</Th><Th>Người phụ trách</Th><Th>Thời gian</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr></Thead>
          <Tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">Đang tải dữ liệu nhiệm vụ…</td></tr>}
            {!loading && Boolean(taskError) && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-amber-800"><span>Chưa tải được nhiệm vụ bảo trì. {managerDisplayError(taskError)}</span><Button className="ml-3" size="sm" variant="outline" onClick={() => void reload()}>Thử lại</Button></td></tr>}
            {!loading && Boolean(recoveryError) && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-amber-800"><span>Chưa tải được nhiệm vụ thu hồi kho. {managerDisplayError(recoveryError)}</span><Button className="ml-3" size="sm" variant="outline" onClick={() => void reload()}>Thử lại</Button></td></tr>}
            {!loading && !taskError && !recoveryError && !tasks.length && !recoveryTasks.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">{recoveryDisabled ? 'Chưa có nhiệm vụ bảo trì tại cơ sở này.' : 'Chưa có nhiệm vụ tại cơ sở này.'}</td></tr>}
            {!loading && queueRows.map(row => row.kind === 'recovery' ? ((task: RecoveryTask) => <Tr key={`recovery-${task.id}`}>
              <Td><p className="font-semibold text-stone-900">Thu hồi kho - {task.customerName}</p><p className="mt-1 text-xs text-stone-500">{task.reason === 'AUTO_OVERDUE_DAY_8' ? 'Hợp đồng quá hạn, chưa gia hạn.' : managerDisplayText(task.reason)}</p></Td>
              <Td><Badge variant="warning">Thu hồi kho</Badge></Td>
              <Td>{task.storageUnitCode}</Td>
              <Td><span className="text-sm text-stone-600">Cơ sở</span></Td>
              <Td className="tabular-nums"><p className="text-xs text-stone-500">Tiếp nhận</p>{rentalDate(task.receivedAt)}</Td>
              <Td><Badge variant={task.status === 'CLOSED' ? 'muted' : task.status === 'IN_PROGRESS' ? 'info' : 'warning'}>{recoveryStatusLabels[task.status]}</Badge></Td>
              <Td><Button size="sm" variant="outline" onClick={() => setSelectedRecovery(task)}>Chi tiết</Button></Td>
            </Tr>)(row.task) : ((task: MaintenanceTaskApi) => (
              <Tr key={task.id}>
                <Td><p className="font-semibold text-stone-900">{task.title}</p><p className="mt-1 text-xs text-stone-500">Ưu tiên: {taskPriorityLabel[task.priority]}</p><details className="mt-1 text-xs text-stone-600"><summary className="w-fit cursor-pointer">Xem nội dung</summary><p className="mt-1 whitespace-pre-wrap">{task.reason}</p><p className="mt-1 break-all">Mã nhiệm vụ: {task.displayCode || recordDisplayCode(task.id)}</p></details></Td>
                <Td><Badge variant="muted">Bảo trì</Badge></Td>
                <Td>{task.unitCode}<div className="manager-task-contacts mt-1"><EmergencyContactsPanel key={task.storageUnitId} unitId={task.storageUnitId} /></div></Td>
                <Td>
                  {task.status === 'completed' || task.status === 'cancelled'
                    ? (task.assignedStaffName || 'Chưa phân công')
                    : <Select label="" value={task.assignedStaffId || ''} onChange={event => void reassign(task.id, event.target.value)}><option value="" disabled>Chọn nhân viên</option>{staff.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}</Select>}
                </Td>
                <Td className="tabular-nums">{task.dueAt ? rentalDate(task.dueAt) : 'Chưa đặt hạn'}</Td>
                <Td><Badge variant={statusVariant(task.status)}>{taskStatusLabel[task.status]}</Badge></Td>
                <Td>
                  {(task.status === 'open' || task.status === 'in_progress') ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setCancelTarget(task)
                        setCancelReason('')
                      }}
                    >
                      Hủy
                    </Button>
                  ) : (
                    <span className="text-stone-400">-</span>
                  )}
                </Td>
              </Tr>
            ))(row.task))}
          </Tbody>
        </Table>
      </Card>
      </div>

      </>}

      {selectedRecovery && <Modal open size="xl" title="Chi tiết nhiệm vụ thu hồi" onClose={() => { if (!recoveryCloseGuard.current()) setSelectedRecovery(null) }}>
        <RecoveryTaskDetail key={selectedRecovery.id} role="manager" id={selectedRecovery.id} facilityId={selectedRecovery.facilityId} closeGuard={recoveryCloseGuard} onChanged={() => { void reload() }} />
      </Modal>}
      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Tạo nhiệm vụ bảo trì">
        <div className="space-y-4">
          <Input label="Tiêu đề" value={title} onChange={event => setTitle(event.target.value)} maxLength={255} />
          <Input label="Lý do / nội dung xử lý" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} />
          <Select label="Gian kho" value={storageUnitId} onChange={event => setStorageUnitId(event.target.value)}><option value="">Chọn gian kho</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {managerStatusLabel(unit.status, 'vi')}</option>)}</Select>
          <Select label="Nhân viên phụ trách" value={assignedStaffId} onChange={event => setAssignedStaffId(event.target.value)}><option value="">Chọn nhân viên</option>{staff.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}</Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Mức ưu tiên" value={priority} onChange={event => setPriority(event.target.value as MaintenanceTaskPriority)}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></Select>
            <div className="space-y-1">
              <Input label="Hạn xử lý" type="date" min={earliestDueDate} value={dueAt} aria-invalid={dueDateInPast} aria-describedby={dueDateInPast ? 'maintenance-due-date-error' : undefined} onChange={event => setDueAt(event.target.value)} />
              {dueDateInPast && <p id="maintenance-due-date-error" className="text-xs text-red-700">Hạn xử lý phải từ hôm nay trở đi.</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setModalOpen(false)}>Đóng</Button><Button disabled={saving || !title.trim() || !reason.trim() || !storageUnitId || !assignedStaffId || !dueAt || dueDateInPast} onClick={() => void createTask()}>{saving ? 'Đang tạo…' : 'Tạo & giao nhiệm vụ'}</Button></div>
        </div>
      </Modal>

      <Modal open={Boolean(cancelTarget)} onClose={() => !saving && setCancelTarget(null)} title="Hủy nhiệm vụ bảo trì">
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-stone-700">
              Xác nhận hủy nhiệm vụ <strong>{cancelTarget.title}</strong> ({cancelTarget.unitCode})?
            </p>
            <Input
              label="Lý do hủy (tùy chọn)"
              value={cancelReason}
              onChange={event => setCancelReason(event.target.value)}
              maxLength={500}
              placeholder="Ví dụ: Không cần bảo trì, tạo nhầm gian kho..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setCancelTarget(null)}>Đóng</Button>
              <Button variant="danger" disabled={saving} onClick={() => void handleCancelTask()}>
                {saving ? 'Đang hủy…' : 'Xác nhận hủy'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={statusModalOpen} onClose={() => !saving && setStatusModalOpen(false)} title="Cập nhật trạng thái bảo trì gian kho">
        <div className="space-y-4">
          <Select label="Gian kho" value={unitStatusTargetId} onChange={event => setUnitStatusTargetId(event.target.value)}>
            <option value="">Chọn gian kho</option>
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>{unit.code} · {displayStatusLabel(unit.status)}</option>
            ))}
          </Select>
          <Select label="Trạng thái mới" value={unitStatusTargetValue} onChange={event => setUnitStatusTargetValue(event.target.value as 'available' | 'maintenance')}>
            <option value="maintenance">Đưa vào bảo trì (maintenance)</option>
            <option value="available">Mở lại sẵn sàng (available)</option>
          </Select>
          <Input
            label="Lý do / Ghi chú"
            value={unitStatusReason}
            onChange={event => setUnitStatusReason(event.target.value)}
            maxLength={2000}
            placeholder="Nhập lý do chuyển trạng thái..."
          />
          {unitStatusTargetValue === 'maintenance' && (
            <>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={unitStatusCreateTask}
                  onChange={event => setUnitStatusCreateTask(event.target.checked)}
                />
                <span>Tự động tạo phiếu nhiệm vụ bảo trì</span>
              </label>
              {unitStatusCreateTask && (
                <Select label="Phân công nhân viên (tùy chọn)" value={unitStatusStaffId} onChange={event => setUnitStatusStaffId(event.target.value)}>
                  <option value="">Chưa phân công</option>
                  {staff.map(member => (
                    <option key={member.id} value={member.id}>{member.fullName}</option>
                  ))}
                </Select>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={saving} onClick={() => setStatusModalOpen(false)}>Đóng</Button>
            <Button disabled={saving || !unitStatusTargetId} onClick={() => void handleUpdateUnitStatus()}>
              {saving ? 'Đang cập nhật…' : 'Xác nhận'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
