import { useState } from 'react'
import { Avatar, Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useLanguage } from '../../i18n/LanguageContext'
import { STAFF_LIST } from '../../data/demoDatabase'
import type { User } from '../../types'
import type { FacilityTask } from '../../types/storageHub'

interface Props {
  user: User
  facilityId: string
  facilityName: string
  tasks: FacilityTask[]
  createFacilityTask: (task: Omit<FacilityTask, 'id' | 'createdAt' | 'status'>, manager: User) => FacilityTask
  updateFacilityTask: (taskId: string, updates: Partial<Pick<FacilityTask, 'assignedStaffId' | 'assignedStaffName' | 'dueAt' | 'priority' | 'status' | 'notes'>>, manager: User) => void
  showToast: (message: string) => void
}

export default function ManagerStaffTasksPanel({ user, facilityId, facilityName, tasks, createFacilityTask, updateFacilityTask, showToast }: Props) {
  const { lang } = useLanguage()
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<FacilityTask['type']>('general')
  const [priority, setPriority] = useState<FacilityTask['priority']>('medium')
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
  const [staffId, setStaffId] = useState('')
  const [notes, setNotes] = useState('')

  const facilityTasks = tasks.filter(task => task.facilityId === facilityId || task.facilityName === facilityName)
  const staff = STAFF_LIST

  const run = (action: () => void, success: string) => {
    try { action(); showToast(success) } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể cập nhật nhiệm vụ.') }
  }

  const createTask = () => {
    const selectedStaff = staff.find(item => item.id === staffId)
    run(() => createFacilityTask({ facilityId, facilityName, type, title, dueAt, priority, assignedStaffId: selectedStaff?.id, assignedStaffName: selectedStaff?.name, notes }, user), lang === 'vi' ? 'Đã tạo và lưu nhiệm vụ.' : 'Task created and saved.')
    setModalOpen(false)
    setTitle('')
    setNotes('')
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={lang === 'vi' ? 'Điều phối ca làm việc' : 'Workforce operations'} title="Staff & Tasks" subtitle={lang === 'vi' ? 'Tạo, phân công và theo dõi nhiệm vụ vận hành của cơ sở.' : 'Create, assign and track facility operational tasks.'} action={<Button onClick={() => setModalOpen(true)}>{lang === 'vi' ? 'Tạo nhiệm vụ' : 'Create task'}</Button>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={lang === 'vi' ? 'Nhân viên' : 'Staff'} value={staff.length} icon={Icon.users} /><StatCard title={lang === 'vi' ? 'Đang trực' : 'On duty'} value={staff.filter(item => item.status === 'on-duty').length} icon={Icon.check} /><StatCard title={lang === 'vi' ? 'Task đang mở' : 'Open tasks'} value={facilityTasks.filter(task => task.status !== 'completed').length} icon={Icon.tasks} /><StatCard title={lang === 'vi' ? 'Task khẩn cấp' : 'High priority'} value={facilityTasks.filter(task => task.priority === 'high' && task.status !== 'completed').length} icon={Icon.alert} /></div>

    <div className="grid gap-4 lg:grid-cols-3">{staff.map(member => <Card key={member.id} className="p-4"><div className="flex items-start gap-3"><Avatar name={member.name} size="lg" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-bold text-stone-900">{member.name}</p><Badge variant={member.status === 'on-duty' ? 'success' : 'muted'}>{member.status}</Badge></div><p className="text-xs text-stone-500">{member.role} · {member.shift}</p><p className="mt-2 text-xs text-stone-600">{member.email} · {member.phone}</p><p className="mt-2 font-semibold text-amber-800">{facilityTasks.filter(task => task.assignedStaffId === member.id && task.status !== 'completed').length} {lang === 'vi' ? 'nhiệm vụ đang mở' : 'open tasks'}</p></div></div></Card>)}</div>

    <Card><Table><Thead><tr><Th>{lang === 'vi' ? 'Nhiệm vụ' : 'Task'}</Th><Th>{lang === 'vi' ? 'Loại' : 'Type'}</Th><Th>{lang === 'vi' ? 'Người phụ trách' : 'Assignee'}</Th><Th>{lang === 'vi' ? 'Hạn xử lý' : 'Due'}</Th><Th>{lang === 'vi' ? 'Ưu tiên' : 'Priority'}</Th><Th>{lang === 'vi' ? 'Trạng thái' : 'Status'}</Th><Th /></tr></Thead><Tbody>
      {facilityTasks.map(task => <Tr key={task.id}><Td><p className="font-semibold text-stone-900">{task.title}</p><p className="text-xs text-stone-400">{task.id}{task.referenceId ? ` · ${task.referenceId}` : ''}</p>{task.notes && <p className="mt-1 max-w-md text-xs text-stone-500">{task.notes}</p>}</Td><Td>{task.type}</Td><Td><Select value={task.assignedStaffId || ''} onChange={event => { const selected = staff.find(item => item.id === event.target.value); run(() => updateFacilityTask(task.id, { assignedStaffId: selected?.id, assignedStaffName: selected?.name, status: selected ? 'in_progress' : 'open' }, user), lang === 'vi' ? 'Đã cập nhật người phụ trách.' : 'Assignee updated.') }}><option value="">{lang === 'vi' ? 'Chưa phân công' : 'Unassigned'}</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></Td><Td>{task.dueAt}</Td><Td><Badge variant={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'}>{task.priority}</Badge></Td><Td><Badge variant={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : 'warning'}>{task.status}</Badge></Td><Td className="text-right">{task.status !== 'completed' && <Button size="sm" variant="outline" onClick={() => run(() => updateFacilityTask(task.id, { status: 'completed' }, user), lang === 'vi' ? 'Đã hoàn tất nhiệm vụ.' : 'Task completed.')}>{lang === 'vi' ? 'Hoàn tất' : 'Complete'}</Button>}</Td></Tr>)}
      {!facilityTasks.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">{lang === 'vi' ? 'Chưa có nhiệm vụ. Tạo nhiệm vụ đầu tiên cho ca làm việc.' : 'No tasks yet. Create the first task for this shift.'}</td></tr>}
    </Tbody></Table></Card>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={lang === 'vi' ? 'Tạo nhiệm vụ vận hành' : 'Create operational task'}><div className="space-y-4"><Input label={lang === 'vi' ? 'Tiêu đề' : 'Title'} value={title} onChange={event => setTitle(event.target.value)} /><div className="grid grid-cols-2 gap-3"><Select label={lang === 'vi' ? 'Loại' : 'Type'} value={type} onChange={event => setType(event.target.value as FacilityTask['type'])}><option value="general">General</option><option value="checkin">Check-in</option><option value="return">Return</option><option value="maintenance">Maintenance</option><option value="support">Support</option></Select><Select label={lang === 'vi' ? 'Ưu tiên' : 'Priority'} value={priority} onChange={event => setPriority(event.target.value as FacilityTask['priority'])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></div><Input label={lang === 'vi' ? 'Hạn xử lý' : 'Due date'} type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} /><Select label={lang === 'vi' ? 'Người phụ trách' : 'Assignee'} value={staffId} onChange={event => setStaffId(event.target.value)}><option value="">{lang === 'vi' ? 'Chưa phân công' : 'Unassigned'}</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select><Input label={lang === 'vi' ? 'Ghi chú' : 'Notes'} value={notes} onChange={event => setNotes(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModalOpen(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button><Button disabled={!title.trim() || !dueAt} onClick={createTask}>{lang === 'vi' ? 'Tạo nhiệm vụ' : 'Create task'}</Button></div></div></Modal>
  </div>
}
