import { useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import RecoveryTaskDetail from './RecoveryTaskDetail'
import type { RecoveryAudience } from '../../services/recoveryTasksApi'
import { getAuthenticatedActor } from '../../services/authApi'
import RecoveryStaffAssignment from '../manager/RecoveryStaffAssignment'

export default function RecoveryTaskLink({ role, taskId, facilityId, rentalDisplayCode, onChanged, disabled = false }: {
  role: RecoveryAudience; taskId: string; facilityId: string; rentalDisplayCode?: string; onChanged?: () => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const guard = useRef<() => boolean>(() => false)
  const assigning = useRef(false)
  const [revision, setRevision] = useState(0)
  const actor = getAuthenticatedActor()
  const canAssign = role === 'manager' && actor?.permissions.includes('staff_tasks:update') && actor.facilityScopes[facilityId] === 'MANAGE'
  return <>
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { if (!disabled) setOpen(true) }}>Xem nhiệm vụ thu hồi</Button>
    {open && <Modal open size="xl" title="Chi tiết nhiệm vụ thu hồi" onClose={() => { if (!assigning.current && !guard.current()) setOpen(false) }}>
      {actor && canAssign && <RecoveryStaffAssignment taskId={taskId} facilityId={facilityId} identity={actor.id}
        onLocked={locked => { assigning.current = locked }} onChanged={() => { setRevision(value => value + 1); onChanged?.() }} />}
      <RecoveryTaskDetail key={revision} role={role} id={taskId} facilityId={facilityId} rentalDisplayCode={rentalDisplayCode} closeGuard={guard} onChanged={onChanged} />
    </Modal>}
  </>
}
