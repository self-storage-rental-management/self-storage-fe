import { useEffect } from 'react'
import { Button } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { ApiClientError } from '../../services/apiClient'
import { getAuthenticatedActor } from '../../services/authApi'
import { listAllRecoveryTasks } from '../../services/recoveryTasksApi'
import ApiReadState from '../rental-api/ApiReadState'
import { recoveryStatusLabels, recoveryTaskReason } from '../rental-api/RecoveryTaskDetail'
import RecoveryTaskLink from '../rental-api/RecoveryTaskLink'
import { rentalDate } from '../rental-api/presentation'
import '../return-api/ViolationRecoveryPanel.css'

const statusStyles = { OPEN: 'awaiting_assignment', IN_PROGRESS: 'in_progress', CLOSED: 'completed' } as const

export default function AssignedRecoveryTasks({ identity }: { identity: string }) {
  const actor = getAuthenticatedActor()
  const canView = actor?.roles.includes('STAFF') && actor.permissions.includes('rentals:read')
  const read = useRentalApiResource(`${identity}:assigned-recovery`, async () => {
    if (!actor || !canView) return []
    const scopes = Object.entries(actor.facilityScopes)
      .filter(([, level]) => level === 'OPERATE' || level === 'MANAGE')
    const results = await Promise.all(scopes.map(([facilityId]) => listAllRecoveryTasks('staff', facilityId)))
    return results.flat().filter(task => task.assignedStaffId === actor.id)
  }, { retainDataOnRefresh: true })
  const refresh = read.refresh
  useEffect(() => {
    if (!canView) return
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [canView, refresh])

  if (!canView || (read.error instanceof ApiClientError && read.error.code === 'FEATURE_DISABLED')) return null
  return <>
    <div className="col-span-full space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Hồ sơ thu hồi</h3>
          {!read.loading && !read.error && read.data?.length === 0 && <p className="text-xs text-stone-600">Chưa có nhiệm vụ thu hồi do quá hạn thuê được giao cho bạn.</p>}
        </div>
        <Button type="button" size="sm" variant="outline" disabled={read.loading} onClick={refresh}>Tải lại nhiệm vụ</Button>
      </div>
      <ApiReadState {...read} retry={refresh} />
    </div>
      {read.data?.map(task => <section key={task.id} className="recovery-case" aria-label={`Nhiệm vụ thu hồi gian kho ${task.storageUnitCode}`}>
        <div className="recovery-case-header">
          <div className="min-w-0 break-words">
            <h4 className="recovery-case-title">{task.storageUnitCode}</h4>
            <p className="recovery-reason">{recoveryTaskReason(task.reason)}</p>
          </div>
          <div className="recovery-status-group">
            <span className={`recovery-status recovery-status--${statusStyles[task.status]}`}>{recoveryStatusLabels[task.status]}</span>
          </div>
        </div>
        <dl className="recovery-case-facts">
          <div><dt>Khách hàng</dt><dd>{task.customerName || 'Chưa cập nhật'}</dd></div>
          <div><dt>Tiếp nhận nhiệm vụ</dt><dd>{rentalDate(task.receivedAt)}</dd></div>
        </dl>
        <div className="recovery-case-footer">
          <div className="recovery-case-actions ml-auto">
            <RecoveryTaskLink role="staff" taskId={task.id} facilityId={task.facilityId} onChanged={refresh} />
          </div>
        </div>
      </section>)}
  </>
}
