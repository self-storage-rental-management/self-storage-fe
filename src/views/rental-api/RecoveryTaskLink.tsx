import { useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import RecoveryTaskDetail from './RecoveryTaskDetail'
import type { RecoveryAudience } from '../../services/recoveryTasksApi'

export default function RecoveryTaskLink({ role, taskId, facilityId, onChanged, disabled = false }: {
  role: RecoveryAudience; taskId: string; facilityId: string; onChanged?: () => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const guard = useRef<() => boolean>(() => false)
  return <>
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { if (!disabled) setOpen(true) }}>Xem và xử lý thu hồi</Button>
    {open && <Modal open size="xl" title="Chi tiết nhiệm vụ thu hồi" onClose={() => { if (!guard.current()) setOpen(false) }}>
      <RecoveryTaskDetail role={role} id={taskId} facilityId={facilityId} closeGuard={guard} onChanged={onChanged} />
    </Modal>}
  </>
}
