import { useState } from 'react'
import { Avatar, Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import type { User } from '../../types'
import type { FacilityTask } from '../../types/storageHub'
import { useStorageHub } from '../../store/StorageHubContext'
import { isFacilityVisible } from '../../domain/managerRules'
import { managerPriorityLabel, managerStatusLabel, managerTaskTypeLabel } from './managerI18n'

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
    const { users } = useStorageHub()
    const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<FacilityTask['type']>('general')
  const [priority, setPriority] = useState<FacilityTask['priority']>('medium')
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
  const [staffId, setStaffId] = useState('')
  const [notes, setNotes] = useState('')

  const facilityTasks = tasks.filter(task => isFacilityVisible(user, task.facilityId, task.facilityName))
  const staff = users.filter(member => member.role === 'staff' && isFacilityVisible(user, member.facilityId, member.facility))

  const run = (action: () => void, success: string) => {
    try { action(); showToast(success) } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể cập nhật nhiệm vụ.') }
  }

  const createTask = () => {
    const selectedStaff = staff.find(item => item.id === staffId)
    run(() => createFacilityTask({ facilityId, facilityName, type, title, dueAt, priority, assignedStaffId: selectedStaff?.id, assignedStaffName: selectedStaff?.name, notes }, user), 'Đã tạo và lưu nhiệm vụ.')
    setModalOpen(false)
    setTitle('')
    setNotes('')
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={'Điều phối ca làm việc'} title="Nhân viên & Nhiệm vụ" subtitle={'Tạo, phân công và theo dõi nhiệm vụ vận hành của cơ sở.'} action={<Button onClick={() => setModalOpen(true)}>{'Tạo nhiệm vụ'}</Button>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Nhân viên'} value={staff.length} icon={Icon.users} /><StatCard title={'Đang trực'} value={staff.filter(item => item.status === 'on-duty').length} icon={Icon.check} /><StatCard title={'Task đang mở'} value={facilityTasks.filter(task => task.status !== 'completed').length} icon={Icon.tasks} /><StatCard title={'Task khẩn cấp'} value={facilityTasks.filter(task => task.priority === 'high' && task.status !== 'completed').length} icon={Icon.alert} /></div>

    <div className="grid gap-4 lg:grid-cols-3">{staff.map(member => <Card key={member.id} className="p-4"><div className="flex items-start gap-3"><Avatar name={member.name} size="lg" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-bold text-stone-900">{member.name}</p><Badge variant={member.status === 'on-duty' ? 'success' : 'muted'}>{managerStatusLabel(member.status, 'vi')}</Badge></div><p className="text-xs text-stone-500">{member.role} · {'shift' in member && typeof member.shift === 'string' ? member.shift : '—'}</p><p className="mt-2 text-xs text-stone-600">{member.email} · {member.phone}</p><p className="mt-2 font-semibold text-amber-800">{facilityTasks.filter(task => task.assignedStaffId === member.id && task.status !== 'completed').length} {'nhiệm vụ đang mở'}</p></div></div></Card>)}</div>

    <Card><Table><Thead><tr><Th>{'Nhiệm vụ'}</Th><Th>{'Loại'}</Th><Th>{'Người phụ trách'}</Th><Th>{'Hạn xử lý'}</Th><Th>{'Ưu tiên'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>
      {facilityTasks.map(task => <Tr key={task.id}><Td><p className="font-semibold text-stone-900">{task.title}</p><p className="text-xs text-stone-400">{task.id}{task.referenceId ? ` · ${task.referenceId}` : ''}</p>{task.notes && <p className="mt-1 max-w-md text-xs text-stone-500">{task.notes}</p>}</Td><Td>{managerTaskTypeLabel(task.type, 'vi')}</Td><Td><Select value={task.assignedStaffId || ''} onChange={event => { const selected = staff.find(item => item.id === event.target.value); run(() => updateFacilityTask(task.id, { assignedStaffId: selected?.id, assignedStaffName: selected?.name, status: selected ? 'in_progress' : 'open' }, user), 'Đã cập nhật người phụ trách.') }}><option value="">{'Chưa phân công'}</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></Td><Td>{task.dueAt}</Td><Td><Badge variant={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'}>{managerPriorityLabel(task.priority, 'vi')}</Badge></Td><Td><Badge variant={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : 'warning'}>{managerStatusLabel(task.status, 'vi')}</Badge></Td><Td className="text-right">{task.status !== 'completed' && <Button size="sm" variant="outline" onClick={() => run(() => updateFacilityTask(task.id, { status: 'completed' }, user), 'Đã hoàn tất nhiệm vụ.')}>{'Hoàn tất'}</Button>}</Td></Tr>)}
      {!facilityTasks.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">{'Chưa có nhiệm vụ. Tạo nhiệm vụ đầu tiên cho ca làm việc.'}</td></tr>}
    </Tbody></Table></Card>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={'Tạo nhiệm vụ vận hành'}><div className="space-y-4"><Input label={'Tiêu đề'} value={title} onChange={event => setTitle(event.target.value)} /><div className="grid grid-cols-2 gap-3"><Select label={'Loại'} value={type} onChange={event => setType(event.target.value as FacilityTask['type'])}><option value="general">Chung</option><option value="checkin">Nhận kho</option><option value="return">Trả kho</option><option value="maintenance">Bảo trì</option><option value="support">Hỗ trợ</option></Select><Select label={'Ưu tiên'} value={priority} onChange={event => setPriority(event.target.value as FacilityTask['priority'])}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></Select></div><Input label={'Hạn xử lý'} type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} /><Select label={'Người phụ trách'} value={staffId} onChange={event => setStaffId(event.target.value)}><option value="">{'Chưa phân công'}</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select><Input label={'Ghi chú'} value={notes} onChange={event => setNotes(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModalOpen(false)}>{'Hủy'}</Button><Button disabled={!title.trim() || !dueAt} onClick={createTask}>{'Tạo nhiệm vụ'}</Button></div></div></Modal>
  </div>
}
