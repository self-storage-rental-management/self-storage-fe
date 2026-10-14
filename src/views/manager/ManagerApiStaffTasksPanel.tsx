import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { managerDisplayError } from './managerPresentation'
import ManagerActionNotice from './ManagerActionNotice'
import { listAllRecoveryTasks, type RecoveryTask } from '../../services/recoveryTasksApi'
import RecoveryTaskDetail, { recoveryStatusLabels } from '../rental-api/RecoveryTaskDetail'
import { rentalDate } from '../rental-api/presentation'
import { managerFacilityNotice, singleManagerFacility } from './managerFacilityUi'
import {
  assignMaintenanceTask,
  createMaintenanceTask,
  listFacilityStorageUnits,
  listMaintenanceStaff,
  listManagerMaintenanceTasks,
  type MaintenanceStaffOption,
  type MaintenanceStorageUnit,
  type MaintenanceTaskApi,
  type MaintenanceTaskPriority,
} from '../../services/maintenanceApi'

interface Props {
  showToast: (message: string) => void
  initialUnit?: { unitId: string; unitCode: string } | null
  onInitialUnitConsumed?: () => void
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

export default function ManagerApiStaffTasksPanel({ showToast, initialUnit, onInitialUnitConsumed }: Props) {
  const actor = getAuthenticatedActor()
  const facilityId = singleManagerFacility(actor)
  const [tasks, setTasks] = useState<MaintenanceTaskApi[]>([])
  const [recoveryTasks, setRecoveryTasks] = useState<RecoveryTask[]>([])
  const [recoveryError, setRecoveryError] = useState<unknown>(null)
  const [selectedRecovery, setSelectedRecovery] = useState<RecoveryTask | null>(null)
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
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!facilityId) {
      setTaskError(new Error(managerFacilityNotice(actor)))
      setLoading(false)
      return
    }
    setLoading(true)
    setTaskError(null)
    setRecoveryError(null)
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
    else { setRecoveryTasks([]);setRecoveryError(recoveryResult.reason) }
    if (taskResult.status === 'fulfilled') setTasks(taskResult.value.data)
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
  }, [actor, facilityId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!initialUnit || loading || unitReadFailed || staffReadFailed) return
    if (units.some(unit => unit.id === initialUnit.unitId) && staff.length) {
      setStorageUnitId(initialUnit.unitId)
      setTitle(`Bảo trì ${initialUnit.unitCode}`)
      setModalOpen(true)
    } else {
      showToast('Gian kho chưa đủ điều kiện tạo nhiệm vụ bảo trì hoặc chưa có nhân viên phù hợp.')
    }
    onInitialUnitConsumed?.()
  }, [initialUnit, loading, unitReadFailed, staffReadFailed, units, staff])

  const openTasks = useMemo(() => tasks.filter(task => !['completed', 'cancelled'].includes(task.status)), [tasks])

  const resetForm = () => {
    setTitle('')
    setReason('')
    setStorageUnitId('')
    setAssignedStaffId('')
    setPriority('medium')
    setDueAt(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
  }

  const createTask = async () => {
    if (!title.trim() || !reason.trim() || !storageUnitId || !assignedStaffId || !dueAt) return
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

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        eyebrow="Điều phối ca làm việc"
        title="Nhân viên & Nhiệm vụ"
        subtitle="Theo dõi công việc bảo trì và thu hồi kho tại cơ sở."
        action={<Button disabled={loading || !facilityId || unitReadFailed || staffReadFailed || !units.length || !staff.length} onClick={() => setModalOpen(true)}>Tạo nhiệm vụ</Button>}
      />

      {!loading && !taskError && !staffReadFailed && !staff.length && <ManagerActionNotice tone="info">Chưa có Staff ACTIVE với phạm vi OPERATE/MANAGE tại cơ sở này.</ManagerActionNotice>}
      {!loading && !taskError && !unitReadFailed && !units.length && <ManagerActionNotice tone="info">Chưa có gian kho khả dụng để tạo nhiệm vụ bảo trì.</ManagerActionNotice>}
      {!loading && (unitReadFailed || staffReadFailed) && <p className="text-xs text-stone-500">Chưa tải được danh sách kho hoặc nhân viên để tạo nhiệm vụ. Dữ liệu nhiệm vụ vẫn được tải riêng.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-stone-500">Tổng nhiệm vụ</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : taskError || recoveryError ? '-' : tasks.length + recoveryTasks.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-stone-500">Đang xử lý</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : taskError || recoveryError ? '-' : openTasks.length + recoveryTasks.filter(task => task.status !== 'CLOSED').length}</p></Card>
        <Card className="col-span-2 p-4 lg:col-span-1"><p className="text-sm text-stone-500">Nhân viên đủ điều kiện</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : staffReadFailed ? '—' : staff.length}</p></Card>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <Thead><tr><Th>Nhiệm vụ</Th><Th>Loại</Th><Th>Gian kho</Th><Th>Người phụ trách</Th><Th>Thời gian</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr></Thead>
          <Tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">Đang tải dữ liệu nhiệm vụ…</td></tr>}
            {!loading && Boolean(taskError || recoveryError) && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-amber-800"><span>Chưa tải được đầy đủ nhiệm vụ. {managerDisplayError(taskError || recoveryError)}</span><Button className="ml-3" size="sm" variant="outline" onClick={() => void reload()}>Thử lại</Button></td></tr>}
            {!loading && !taskError && !recoveryError && !tasks.length && !recoveryTasks.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">Chưa có nhiệm vụ tại cơ sở này.</td></tr>}
            {!loading && recoveryTasks.map(task => <Tr key={`recovery-${task.id}`}>
              <Td><p className="font-semibold text-stone-900">Thu hồi kho - {task.customerName}</p><p className="mt-1 text-xs text-stone-500">{task.reason === 'AUTO_OVERDUE_DAY_8' ? 'Hợp đồng quá hạn, chưa hoàn tất gia hạn.' : task.reason}</p></Td>
              <Td><Badge variant="warning">Thu hồi kho</Badge></Td>
              <Td>{task.storageUnitCode}</Td>
              <Td><span className="text-sm text-stone-500">Cơ sở tiếp nhận</span></Td>
              <Td><p className="text-xs text-stone-500">Tiếp nhận lúc</p>{rentalDate(task.receivedAt)}</Td>
              <Td><Badge variant={task.status === 'CLOSED' ? 'muted' : task.status === 'IN_PROGRESS' ? 'info' : 'warning'}>{recoveryStatusLabels[task.status]}</Badge></Td>
              <Td><Button size="sm" variant="outline" onClick={() => setSelectedRecovery(task)}>Chi tiết</Button></Td>
            </Tr>)}
            {!loading && tasks.map(task => (
              <Tr key={task.id}>
                <Td><p className="font-semibold text-stone-900">{task.title}</p><p className="text-xs text-stone-500">{task.id} · {taskPriorityLabel[task.priority]}</p><p className="mt-1 text-xs text-stone-500">{task.reason}</p></Td>
                <Td><Badge variant="muted">Bảo trì</Badge></Td>
                <Td>{task.unitCode}</Td>
                <Td>
                  {task.status === 'completed' || task.status === 'cancelled'
                    ? (task.assignedStaffName || 'Chưa phân công')
                    : <Select label="" value={task.assignedStaffId || ''} onChange={event => void reassign(task.id, event.target.value)}><option value="" disabled>Chọn Staff</option>{staff.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}</Select>}
                </Td>
                <Td>{task.dueAt || 'Chưa đặt hạn'}</Td>
                <Td><Badge variant={statusVariant(task.status)}>{taskStatusLabel[task.status]}</Badge></Td>
                <Td><span className="text-stone-400">-</span></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      {selectedRecovery && <Modal open title="Chi tiết nhiệm vụ thu hồi" onClose={() => setSelectedRecovery(null)}>
        <RecoveryTaskDetail key={selectedRecovery.id} role="manager" id={selectedRecovery.id} facilityId={selectedRecovery.facilityId} />
      </Modal>}
      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Tạo nhiệm vụ bảo trì">
        <div className="space-y-4">
          <Input label="Tiêu đề" value={title} onChange={event => setTitle(event.target.value)} maxLength={255} />
          <Input label="Lý do / nội dung xử lý" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} />
          <Select label="Gian kho" value={storageUnitId} onChange={event => setStorageUnitId(event.target.value)}><option value="">Chọn gian kho</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {unit.status}</option>)}</Select>
          <Select label="Nhân viên phụ trách" value={assignedStaffId} onChange={event => setAssignedStaffId(event.target.value)}><option value="">Chọn Staff</option>{staff.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}</Select>
          <div className="grid gap-3 sm:grid-cols-2"><Select label="Mức ưu tiên" value={priority} onChange={event => setPriority(event.target.value as MaintenanceTaskPriority)}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></Select><Input label="Hạn xử lý" type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setModalOpen(false)}>Đóng</Button><Button disabled={saving || !title.trim() || !reason.trim() || !storageUnitId || !assignedStaffId || !dueAt} onClick={() => void createTask()}>{saving ? 'Đang tạo…' : 'Tạo & giao nhiệm vụ'}</Button></div>
        </div>
      </Modal>
    </div>
  )
}
