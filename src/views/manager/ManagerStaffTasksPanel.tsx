import { useEffect, useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import type { User } from '../../types'
import type { ActivityRecord, FacilityTask } from '../../types/storageHub'
import { useStorageHub } from '../../store/StorageHubContext'
import {
  canManagerAssignStaff,
  canManagerCancelFacilityTask,
  canManagerReassignFacilityTask,
  isFacilityTaskOverdue,
  isManagerFacilityVisible
} from '../../domain/managerRules'
import { managerDateLabel, managerPriorityLabel, managerStatusLabel, managerTaskTypeLabel } from './managerI18n'
import ManagerActionNotice from './ManagerActionNotice'

interface Props {
  user: User
  facilityId: string
  facilityName: string
  tasks: FacilityTask[]
  createFacilityTask: (task: Omit<FacilityTask, 'id' | 'createdAt' | 'status'>, manager: User) => FacilityTask
  updateFacilityTask: (taskId: string, updates: Partial<Pick<FacilityTask, 'assignedStaffId' | 'assignedStaffName' | 'dueAt' | 'priority' | 'status' | 'notes' | 'resultReport' | 'evidence' | 'unableReason' | 'cancellationReason'>>, manager: User) => void
  initialDraft?: { referenceId: string; title: string; notes: string } | null
  onDraftConsumed?: () => void
  showToast: (message: string) => void
}

type TaskFilter = 'all' | 'unassigned' | 'open' | 'in_progress' | 'completed' | 'overdue' | 'cancelled'

interface ReferenceOption {
  id: string
  type: Exclude<FacilityTask['type'], 'general'>
  label: string
  summary: string
  suggestedTitle: string
}

const taskStatusVariant = (task: FacilityTask) => {
  if (task.status === 'completed') return 'success'
  if (task.status === 'cancelled' || isFacilityTaskOverdue(task)) return 'error'
  if (task.status === 'in_progress') return 'info'
  return 'warning'
}

const deriveTaskProgress = (task: FacilityTask, activities: ActivityRecord[]) => {
  const history = activities.filter(activity => activity.entityType === 'task' && activity.entityId === task.id)
  const assignedActivity = history.find(activity => ['FACILITY_TASK_REASSIGNED', 'FACILITY_TASK_CREATED'].includes(activity.action))
  const acceptedActivity = history.find(activity => activity.action === 'FACILITY_TASK_ACCEPTED' || (activity.beforeState?.status === 'open' && activity.afterState?.status === 'in_progress'))
  const completedActivity = history.find(activity => activity.action === 'FACILITY_TASK_COMPLETED' || (activity.beforeState?.status !== 'completed' && activity.afterState?.status === 'completed'))
  const unableActivity = history.find(activity => activity.action === 'FACILITY_TASK_UNABLE_REPORTED')
  const evidence = Array.from(new Set([
    ...(task.evidence || []),
    ...history.flatMap(activity => activity.evidence || [])
  ]))
  return {
    assignedAt: task.assignedAt || (task.assignedStaffId ? assignedActivity?.timestamp || task.createdAt : undefined),
    startedAt: task.startedAt || acceptedActivity?.timestamp,
    completedAt: task.completedAt || completedActivity?.timestamp,
    completedByName: task.completedByName || completedActivity?.actorName,
    resultReport: task.resultReport || completedActivity?.afterState?.resultReport,
    evidence,
    reportedUnableAt: task.reportedUnableAt || unableActivity?.timestamp,
    unableReason: task.unableReason || unableActivity?.afterState?.unableReason
  }
}

export default function ManagerStaffTasksPanel({ user, facilityId, facilityName, tasks, createFacilityTask, updateFacilityTask, initialDraft, onDraftConsumed, showToast }: Props) {
  const { users, activities, facilities, checkins, returns, maintenanceTasks, tickets } = useStorageHub()
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<FacilityTask['type']>('general')
  const [priority, setPriority] = useState<FacilityTask['priority']>('medium')
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
  const [staffId, setStaffId] = useState('')
  const [notes, setNotes] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskFilter>('all')
  const [staffFilter, setStaffFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | FacilityTask['priority']>('all')
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [cancelTaskId, setCancelTaskId] = useState<string | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')

  useEffect(() => {
    if (!initialDraft) return
    setTitle(initialDraft.title)
    setType('maintenance')
    setNotes(initialDraft.notes)
    setReferenceId(initialDraft.referenceId)
    setModalOpen(true)
    onDraftConsumed?.()
  }, [initialDraft, onDraftConsumed])

  const facilityTasks = useMemo(
    () => tasks.filter(task => isManagerFacilityVisible(user, task.facilityId, task.facilityName)),
    [tasks, user]
  )
  const staff = useMemo(
    () => users.filter(member => canManagerAssignStaff(user, member)),
    [users, user]
  )
  const referenceOptions = useMemo(() => {
    const inManagerFacility = (recordFacilityId?: string, recordFacilityName?: string) =>
      isManagerFacilityVisible(user, recordFacilityId, recordFacilityName)
    const options: ReferenceOption[] = [
      ...checkins
        .filter(item => inManagerFacility(item.facilityId))
        .map(item => ({
          id: item.id,
          type: 'checkin' as const,
          label: `${item.id} · ${item.customerName} · gian ${item.unitId} · ${managerStatusLabel(item.status, 'vi')}`,
          summary: `Hồ sơ nhận kho ${item.id}, đặt chỗ ${item.holdId}, khách ${item.customerName}, gian ${item.unitId}.`,
          suggestedTitle: `Xử lý hồ sơ nhận kho ${item.id}`
        })),
      ...returns
        .filter(item => inManagerFacility(item.facilityId, item.facilityName))
        .map(item => ({
          id: item.id,
          type: 'return' as const,
          label: `${item.id} · ${item.customerName} · gian ${item.unitId} · ${managerStatusLabel(item.status, 'vi')}`,
          summary: `Hồ sơ trả kho ${item.id}, hợp đồng ${item.rentalId}, khách ${item.customerName}, gian ${item.unitId}.`,
          suggestedTitle: `Xử lý hồ sơ trả kho ${item.id}`
        })),
      ...maintenanceTasks
        .filter(item => inManagerFacility(item.facilityId))
        .map(item => ({
          id: item.id,
          type: 'maintenance' as const,
          label: `${item.id} · gian ${item.unitId} · ${managerStatusLabel(item.status, 'vi')}`,
          summary: `Hồ sơ bảo trì ${item.id}, gian ${item.unitId}. Lý do: ${item.reason}`,
          suggestedTitle: `Xử lý bảo trì gian ${item.unitId}`
        })),
      ...tickets
        .filter(item => {
          const ticketFacilityId = item.facilityId || facilities.find(facility => facility.name === item.facility)?.id
          return inManagerFacility(ticketFacilityId, item.facility)
        })
        .map(item => ({
          id: item.id,
          type: 'support' as const,
          label: `${item.id} · ${item.subject} · ${managerStatusLabel(item.status, 'vi')}`,
          summary: `Yêu cầu hỗ trợ ${item.id}, khách ${item.customer}, gian ${item.unit || 'chưa ghi nhận'}. Nội dung: ${item.subject}`,
          suggestedTitle: `Theo dõi yêu cầu hỗ trợ ${item.id}`
        }))
    ]
    return options
      .filter(option => type === 'general' || option.type === type)
      .sort((left, right) => left.id.localeCompare(right.id))
  }, [checkins, facilities, maintenanceTasks, returns, tickets, type, user])
  const selectedReference = referenceOptions.find(option => option.id === referenceId)
  const today = new Date().toISOString().slice(0, 10)
  const overdueTasks = facilityTasks.filter(task => isFacilityTaskOverdue(task, today))
  const filteredTasks = facilityTasks
    .filter(task => {
      if (statusFilter === 'unassigned') return !task.assignedStaffId && task.status !== 'cancelled'
      if (statusFilter === 'overdue') return isFacilityTaskOverdue(task, today)
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      if (staffFilter !== 'all' && task.assignedStaffId !== staffFilter && task.lastAssignedStaffId !== staffFilter) return false
      if (dateFilter && task.dueAt !== dateFilter) return false
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
      return true
    })
    .sort((left, right) => {
      const overdueDifference = Number(isFacilityTaskOverdue(right, today)) - Number(isFacilityTaskOverdue(left, today))
      return overdueDifference || left.dueAt.localeCompare(right.dueAt) || right.createdAt.localeCompare(left.createdAt)
    })
  const detailTask = detailTaskId ? facilityTasks.find(task => task.id === detailTaskId) : undefined
  const detailProgress = detailTask ? deriveTaskProgress(detailTask, activities) : undefined
  const cancelTask = cancelTaskId ? facilityTasks.find(task => task.id === cancelTaskId) : undefined

  const run = (action: () => void, success: string) => {
    try {
      action()
      showToast(success)
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật nhiệm vụ.')
      return false
    }
  }

  const resetCreateForm = () => {
    setTitle('')
    setStaffId('')
    setNotes('')
    setReferenceId('')
  }

  const changeTaskType = (nextType: FacilityTask['type']) => {
    setType(nextType)
    setReferenceId('')
  }

  const selectReference = (nextReferenceId: string) => {
    setReferenceId(nextReferenceId)
    const selected = referenceOptions.find(option => option.id === nextReferenceId)
    if (!selected) return
    if (!title.trim()) setTitle(selected.suggestedTitle)
    if (!notes.trim()) setNotes(selected.summary)
  }

  const createTask = () => {
    const selectedStaff = staff.find(item => item.id === staffId)
    if (!selectedStaff) {
      showToast('Vui lòng chọn nhân viên thuộc cơ sở trước khi tạo nhiệm vụ.')
      return
    }
    const created = run(
      () => createFacilityTask({ facilityId, facilityName, type, title, referenceId: referenceId.trim() || undefined, dueAt, priority, assignedStaffId: selectedStaff.id, notes }, user),
      `Đã giao nhiệm vụ cho ${selectedStaff.name}; đang chờ Staff nhận việc.`
    )
    if (!created) return
    setModalOpen(false)
    resetCreateForm()
  }

  const reassignTask = (task: FacilityTask, nextStaffId: string) => {
    const selectedStaff = staff.find(item => item.id === nextStaffId)
    if (!selectedStaff) {
      showToast('Nhân viên không hợp lệ hoặc không thuộc cơ sở của bạn.')
      return
    }
    run(() => updateFacilityTask(task.id, { assignedStaffId: selectedStaff.id }, user), `Đã giao lại nhiệm vụ cho ${selectedStaff.name}; trạng thái trở về chờ nhận.`)
  }

  const cancelTaskWithReason = () => {
    if (!cancelTask) return
    const cancelled = run(() => updateFacilityTask(cancelTask.id, { status: 'cancelled', cancellationReason }, user), 'Đã hủy nhiệm vụ và lưu lý do vào nhật ký.')
    if (!cancelled) return
    setCancelTaskId(null)
    setCancellationReason('')
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow="Điều phối ca làm việc" title="Nhân viên & Nhiệm vụ" subtitle="Giao việc theo đúng cơ sở, theo dõi tiến độ và kết quả do Staff cập nhật." action={<Button disabled={!staff.length} onClick={() => setModalOpen(true)}>Tạo nhiệm vụ</Button>} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard title="Chưa phân công" value={facilityTasks.filter(task => !task.assignedStaffId && task.status !== 'cancelled').length} icon={Icon.alert} />
      <StatCard title="Chờ nhận" value={facilityTasks.filter(task => task.status === 'open' && Boolean(task.assignedStaffId)).length} icon={Icon.tasks} />
      <StatCard title="Đang thực hiện" value={facilityTasks.filter(task => task.status === 'in_progress').length} icon={Icon.users} />
      <StatCard title="Đã hoàn thành" value={facilityTasks.filter(task => task.status === 'completed').length} icon={Icon.check} />
      <StatCard title="Quá hạn" value={overdueTasks.length} icon={Icon.alert} />
    </div>

    {!staff.length && <ManagerActionNotice tone="warning">Cơ sở chưa có tài khoản Staff phù hợp. Manager không thể tạo nhiệm vụ cho đến khi có người phụ trách hợp lệ.</ManagerActionNotice>}
    {overdueTasks.length > 0 && <ManagerActionNotice tone="warning">Có {overdueTasks.length} nhiệm vụ quá hạn cần theo dõi hoặc giao lại.</ManagerActionNotice>}

    <div className="grid gap-4 lg:grid-cols-3">{staff.map(member => <Card key={member.id} className="p-4"><div className="flex items-start gap-3"><Avatar name={member.name} size="lg" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-bold text-stone-900">{member.name}</p><Badge variant={member.status === 'on-duty' ? 'success' : 'muted'}>{managerStatusLabel(member.status, 'vi')}</Badge></div><p className="text-xs text-stone-500">Staff · {'shift' in member && typeof member.shift === 'string' ? member.shift : '—'}</p><p className="mt-2 text-xs text-stone-600">{member.email} · {member.phone || 'Chưa có SĐT'}</p><p className="mt-2 font-semibold text-amber-800">{facilityTasks.filter(task => task.assignedStaffId === member.id && ['open', 'in_progress'].includes(task.status)).length} nhiệm vụ đang mở</p></div></div></Card>)}</div>

    <Card className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Select label="Trạng thái" value={statusFilter} onChange={event => setStatusFilter(event.target.value as TaskFilter)}><option value="all">Tất cả</option><option value="unassigned">Chưa phân công</option><option value="open">Chờ nhận</option><option value="in_progress">Đang thực hiện</option><option value="completed">Đã hoàn thành</option><option value="overdue">Quá hạn</option><option value="cancelled">Đã hủy</option></Select>
      <Select label="Nhân viên" value={staffFilter} onChange={event => setStaffFilter(event.target.value)}><option value="all">Tất cả nhân viên</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select>
      <Input label="Ngày đến hạn" type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
      <Select label="Mức ưu tiên" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as 'all' | FacilityTask['priority'])}><option value="all">Tất cả mức ưu tiên</option><option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option></Select>
    </div></Card>

    <Card className="overflow-x-auto"><Table><Thead><tr><Th>Nhiệm vụ</Th><Th>Người phụ trách</Th><Th>Tiến độ</Th><Th>Hạn & ưu tiên</Th><Th>Kết quả</Th><Th>Trạng thái</Th><Th /></tr></Thead><Tbody>
      {filteredTasks.map(task => {
        const displayedAssignee = task.assignedStaffName || task.lastAssignedStaffName
        const canReassign = canManagerReassignFacilityTask(task)
        const progress = deriveTaskProgress(task, activities)
        return <Tr key={task.id}>
          <Td><p className="font-semibold text-stone-900">{task.title}</p><p className="text-xs text-stone-400">{task.id}{task.referenceId ? ` · ${task.referenceId}` : ''}</p><p className="mt-1 text-xs text-stone-500">{managerTaskTypeLabel(task.type, 'vi')}</p></Td>
          <Td>{task.status === 'cancelled' ? <div><p className="font-medium">{displayedAssignee || '—'}</p><p className="text-xs text-red-600">Đã ngừng phân công</p></div> : <Select disabled={!canReassign} value={task.assignedStaffId || ''} onChange={event => reassignTask(task, event.target.value)}><option value="" disabled>Chọn Staff để giao</option>{task.assignedStaffId && !staff.some(member => member.id === task.assignedStaffId) && <option value={task.assignedStaffId}>{task.assignedStaffName || task.assignedStaffId}</option>}{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select>}</Td>
          <Td className="min-w-44 text-xs"><p>Giao: <b>{managerDateLabel(progress.assignedAt, 'vi', true)}</b></p><p className="mt-1">Nhận: <b>{managerDateLabel(progress.startedAt, 'vi', true)}</b></p><p className="mt-1">Hoàn thành: <b>{managerDateLabel(progress.completedAt, 'vi', true)}</b></p></Td>
          <Td><p className={isFacilityTaskOverdue(task, today) ? 'font-semibold text-red-700' : 'text-stone-700'}>{managerDateLabel(task.dueAt, 'vi')}</p><div className="mt-2"><Badge variant={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'}>{managerPriorityLabel(task.priority, 'vi')}</Badge></div></Td>
          <Td className="max-w-52 text-xs"><p className="line-clamp-2">{progress.resultReport || 'Chưa có báo cáo kết quả'}</p><p className="mt-1 text-stone-500">{progress.evidence.length ? `${progress.evidence.length} minh chứng` : 'Chưa có minh chứng'}</p>{progress.unableReason && <p className="mt-1 font-semibold text-red-700">Không thể thực hiện: {progress.unableReason}</p>}</Td>
          <Td><Badge variant={taskStatusVariant(task)}>{isFacilityTaskOverdue(task, today) ? `Quá hạn · ${managerStatusLabel(task.status, 'vi')}` : managerStatusLabel(task.status, 'vi')}</Badge></Td>
          <Td className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setDetailTaskId(task.id)}>Chi tiết</Button>{canManagerCancelFacilityTask(task) && <Button size="sm" variant="danger" onClick={() => { setCancelTaskId(task.id); setCancellationReason('') }}>Hủy</Button>}</div></Td>
        </Tr>
      })}
      {!filteredTasks.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">Không có nhiệm vụ phù hợp bộ lọc.</td></tr>}
    </Tbody></Table></Card>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tạo nhiệm vụ vận hành"><div className="space-y-4">
      <Input label="Tiêu đề" value={title} onChange={event => setTitle(event.target.value)} />
      <div className="grid grid-cols-2 gap-3"><Select label="Loại" value={type} onChange={event => changeTaskType(event.target.value as FacilityTask['type'])}><option value="general">Chung</option><option value="checkin">Nhận kho</option><option value="return">Trả kho</option><option value="maintenance">Bảo trì</option><option value="support">Hỗ trợ</option></Select><Select label="Ưu tiên" value={priority} onChange={event => setPriority(event.target.value as FacilityTask['priority'])}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></Select></div>
      <Select label="Hồ sơ liên quan (nếu có)" value={referenceId} onChange={event => selectReference(event.target.value)}><option value="">Không liên kết hồ sơ</option>{referenceOptions.map(option => <option key={`${option.type}-${option.id}`} value={option.id}>{option.label}</option>)}</Select>
      {selectedReference && <ManagerActionNotice compact tone="info">Đã liên kết <b>{selectedReference.id}</b>: {selectedReference.summary}</ManagerActionNotice>}
      {!referenceOptions.length && type !== 'general' && <ManagerActionNotice compact tone="warning">Cơ sở hiện không có hồ sơ {managerTaskTypeLabel(type, 'vi').toLowerCase()} để liên kết.</ManagerActionNotice>}
      <Input label="Hạn xử lý" type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} />
      <Select label="Người phụ trách (bắt buộc)" value={staffId} onChange={event => setStaffId(event.target.value)}><option value="">Chọn nhân viên</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select>
      <Input label="Ghi chú" value={notes} onChange={event => setNotes(event.target.value)} />
      <ManagerActionNotice compact tone="info">Nhiệm vụ mới ở trạng thái “Chờ nhận”. Chỉ Staff được giao mới có thể nhận và hoàn thành.</ManagerActionNotice>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModalOpen(false)}>Đóng</Button><Button disabled={!title.trim() || !dueAt || !staff.some(member => member.id === staffId)} onClick={createTask}>Tạo & giao nhiệm vụ</Button></div>
    </div></Modal>

    <Modal open={Boolean(cancelTask)} onClose={() => { setCancelTaskId(null); setCancellationReason('') }} title="Hủy nhiệm vụ"><div className="space-y-4"><p className="text-sm text-stone-600">Bạn đang hủy nhiệm vụ <b>{cancelTask?.title}</b>. Lý do sẽ được lưu vào nhật ký.</p><label className="block text-sm font-semibold text-stone-700">Lý do hủy<textarea className="mt-1 min-h-28 w-full rounded-lg border border-stone-300 p-3 font-normal outline-none focus:border-amber-500" value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} /></label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCancelTaskId(null)}>Đóng</Button><Button variant="danger" disabled={!cancellationReason.trim()} onClick={cancelTaskWithReason}>Xác nhận hủy</Button></div></div></Modal>

    <Modal open={Boolean(detailTask)} onClose={() => setDetailTaskId(null)} title="Chi tiết tiến độ nhiệm vụ" size="lg">{detailTask && detailProgress && <div className="space-y-5 text-sm">
      <div><h3 className="text-lg font-bold text-stone-900">{detailTask.title}</h3><p className="text-stone-500">{detailTask.id} · {managerTaskTypeLabel(detailTask.type, 'vi')}</p></div>
      <div className="grid gap-3 rounded-lg bg-stone-50 p-4 sm:grid-cols-2"><p>Người phụ trách: <b>{detailTask.assignedStaffName || detailTask.lastAssignedStaffName || 'Chưa ghi nhận'}</b></p><p>Ưu tiên: <b>{managerPriorityLabel(detailTask.priority, 'vi')}</b></p><p>Giao việc: <b>{managerDateLabel(detailProgress.assignedAt, 'vi', true)}</b></p><p>Staff nhận: <b>{managerDateLabel(detailProgress.startedAt, 'vi', true)}</b></p><p>Hoàn thành: <b>{managerDateLabel(detailProgress.completedAt, 'vi', true)}</b></p><p>Người hoàn thành: <b>{detailProgress.completedByName || 'Chưa ghi nhận'}</b></p></div>
      <div><h4 className="font-bold text-stone-900">Ghi chú giao việc</h4><p className="mt-1 whitespace-pre-wrap text-stone-600">{detailTask.notes || 'Không có ghi chú.'}</p></div>
      <div><h4 className="font-bold text-stone-900">Báo cáo kết quả</h4><p className="mt-1 whitespace-pre-wrap text-stone-600">{detailProgress.resultReport || 'Staff chưa gửi báo cáo kết quả.'}</p></div>
      <div><h4 className="font-bold text-stone-900">Minh chứng / tệp đính kèm</h4>{detailProgress.evidence.length ? <ul className="mt-2 space-y-1">{detailProgress.evidence.map((item, index) => <li key={`${item}-${index}`} className="rounded bg-stone-50 px-3 py-2 text-stone-700">{item}</li>)}</ul> : <p className="mt-1 text-stone-500">Chưa có minh chứng.</p>}</div>
      {detailProgress.unableReason && <ManagerActionNotice tone="warning">Staff báo không thể thực hiện lúc {managerDateLabel(detailProgress.reportedUnableAt, 'vi', true)}: {detailProgress.unableReason}</ManagerActionNotice>}
      {detailTask.cancellationReason && <ManagerActionNotice tone="warning">Đã hủy lúc {managerDateLabel(detailTask.cancelledAt, 'vi', true)} bởi {detailTask.cancelledByName || 'Manager'}. Lý do: {detailTask.cancellationReason}</ManagerActionNotice>}
      <div className="flex justify-end"><Button variant="outline" onClick={() => setDetailTaskId(null)}>Đóng</Button></div>
    </div>}</Modal>
  </div>
}
