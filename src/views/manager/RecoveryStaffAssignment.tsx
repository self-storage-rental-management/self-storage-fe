import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Select } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { listMaintenanceStaff } from '../../services/maintenanceApi'
import { assignRecoveryTask, getRecoveryTask, type RecoveryTask } from '../../services/recoveryTasksApi'
import { managerDisplayError } from './managerPresentation'

export default function RecoveryStaffAssignment({ taskId, facilityId, identity, onLocked, onChanged }: {
  taskId: string; facilityId: string; identity: string; onLocked: (locked: boolean) => void; onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [staffId, setStaffId] = useState('')
  const [assigned, setAssigned] = useState<RecoveryTask>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>()
  const lock = useRef(false)
  const read = useRentalApiResource(`${identity}:${taskId}:assignment`, () => getRecoveryTask('manager', taskId, facilityId))
  const staff = useRentalApiResource(`${identity}:${facilityId}:assignment-options:${editing}`,
    () => editing ? listMaintenanceStaff(facilityId) : Promise.resolve([]))
  const task = assigned ?? read.data

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !task || !staffId) return
    lock.current = true
    setSaving(true)
    setError(undefined)
    onLocked(true)
    try {
      setAssigned(await assignRecoveryTask(task, staffId))
      setEditing(false)
      onChanged()
    } catch (failure) {
      setError(failure)
      read.refresh()
    } finally {
      lock.current = false
      setSaving(false)
      onLocked(false)
    }
  }

  if (read.error != null) return <p role="alert">{managerDisplayError(read.error)} <Button variant="outline" size="sm" onClick={read.refresh}>Tải lại</Button></p>
  if (task?.assignedStaffId) return <p role="status">Nhân viên phụ trách <strong>{task.assignedStaffName || 'Đã phân công'}</strong></p>
  if (task?.status !== 'OPEN') return null
  if (!editing) return <Button size="sm" onClick={() => setEditing(true)}>Giao nhân viên</Button>
  return <form className="w-full space-y-3" onSubmit={submit}>
    <Select label="Nhân viên phụ trách" value={staffId} disabled={saving || staff.loading} onChange={event => setStaffId(event.target.value)}>
      <option value="">{staff.loading ? 'Đang tải nhân viên…' : 'Chọn nhân viên'}</option>
      {staff.data?.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}
    </Select>
    {staff.error != null && <p role="alert">{managerDisplayError(staff.error)} <Button type="button" variant="outline" size="sm" onClick={staff.refresh}>Tải lại</Button></p>}
    {staff.data?.length === 0 && <p>Chưa có nhân viên tại cơ sở.</p>}
    {error != null && <p role="alert">{managerDisplayError(error)}</p>}
    <div className="flex gap-2">
      <Button type="submit" size="sm" disabled={saving || !staffId}>{saving ? 'Đang giao…' : 'Xác nhận giao'}</Button>
      <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => { setEditing(false); setStaffId(''); setError(undefined) }}>Hủy</Button>
    </div>
  </form>
}
