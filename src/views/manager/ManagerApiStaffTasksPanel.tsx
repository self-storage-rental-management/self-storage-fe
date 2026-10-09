import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { managerDisplayError } from './managerPresentation'
import ManagerActionNotice from './ManagerActionNotice'
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
  facilityId: string
  showToast: (message: string) => void
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

export default function ManagerApiStaffTasksPanel({ facilityId, showToast }: Props) {
  const [tasks, setTasks] = useState<MaintenanceTaskApi[]>([])
  const [units, setUnits] = useState<MaintenanceStorageUnit[]>([])
  const [staff, setStaff] = useState<MaintenanceStaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
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
      setError(new Error('Tài khoản quản lý chưa được gán cơ sở.'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [taskPage, unitPage, staffOptions] = await Promise.all([
        listManagerMaintenanceTasks(facilityId),
        listFacilityStorageUnits(facilityId),
        listMaintenanceStaff(facilityId),
      ])
      setTasks(taskPage.data)
      setUnits(unitPage.data.filter(unit => ['available', 'maintenance'].includes(unit.status)))
      setStaff(staffOptions)
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  useEffect(() => {
    void reload()
  }, [reload])

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
        subtitle="Tạo và giao nhiệm vụ bảo trì bằng dữ liệu thật từ cơ sở đang được cấp quyền."
        action={<Button disabled={loading || !units.length || !staff.length} onClick={() => setModalOpen(true)}>Tạo nhiệm vụ</Button>}
      />

      {error && <ManagerActionNotice tone="warning">{managerDisplayError(error)} <Button size="sm" variant="outline" onClick={() => void reload()}>Tải lại</Button></ManagerActionNotice>}
      {!error && !loading && !staff.length && <ManagerActionNotice tone="info">Chưa có Staff ACTIVE với phạm vi OPERATE/MANAGE tại cơ sở này.</ManagerActionNotice>}
      {!error && !loading && !units.length && <ManagerActionNotice tone="info">Chưa có gian kho khả dụng để tạo nhiệm vụ bảo trì.</ManagerActionNotice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-stone-500">Tổng nhiệm vụ</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : tasks.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-stone-500">Đang xử lý</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : openTasks.length}</p></Card>
        <Card className="col-span-2 p-4 lg:col-span-1"><p className="text-sm text-stone-500">Nhân viên đủ điều kiện</p><p className="mt-1 text-2xl font-bold">{loading ? '…' : staff.length}</p></Card>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <Thead><tr><Th>Nhiệm vụ</Th><Th>Gian kho</Th><Th>Người phụ trách</Th><Th>Hạn</Th><Th>Trạng thái</Th></tr></Thead>
          <Tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-stone-500">Đang tải dữ liệu nhiệm vụ…</td></tr>}
            {!loading && !tasks.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-stone-500">Chưa có nhiệm vụ tại cơ sở này.</td></tr>}
            {!loading && tasks.map(task => (
              <Tr key={task.id}>
                <Td><p className="font-semibold text-stone-900">{task.title}</p><p className="text-xs text-stone-500">{task.id} · {taskPriorityLabel[task.priority]}</p><p className="mt-1 text-xs text-stone-500">{task.reason}</p></Td>
                <Td>{task.unitCode}</Td>
                <Td>
                  {task.status === 'completed' || task.status === 'cancelled'
                    ? (task.assignedStaffName || 'Chưa phân công')
                    : <Select label="" value={task.assignedStaffId || ''} onChange={event => void reassign(task.id, event.target.value)}><option value="" disabled>Chọn Staff</option>{staff.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}</Select>}
                </Td>
                <Td>{task.dueAt || 'Chưa đặt hạn'}</Td>
                <Td><Badge variant={statusVariant(task.status)}>{taskStatusLabel[task.status]}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

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
