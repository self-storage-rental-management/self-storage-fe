import { useEffect } from 'react'
import { Button, Card } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { ApiClientError } from '../../services/apiClient'
import { getAuthenticatedActor } from '../../services/authApi'
import { listAllRecoveryTasks } from '../../services/recoveryTasksApi'
import ApiReadState from '../rental-api/ApiReadState'
import { recoveryStatusLabels } from '../rental-api/RecoveryTaskDetail'
import RecoveryTaskLink from '../rental-api/RecoveryTaskLink'

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
  return <section aria-label="Thu hồi kho được giao" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-bold">Thu hồi kho được giao</h3>
      <Button type="button" size="sm" variant="outline" disabled={read.loading} onClick={refresh}>Tải lại nhiệm vụ</Button>
    </div>
    <ApiReadState {...read} retry={refresh} />
    {!read.loading && read.data?.length === 0 && <p className="text-sm text-stone-600">Chưa có nhiệm vụ thu hồi được giao cho bạn.</p>}
    <div className="grid gap-3 lg:grid-cols-2">
      {read.data?.map(task => <Card key={task.id} className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">{task.storageUnitCode}</h4>
          <span className="text-sm text-stone-600">{recoveryStatusLabels[task.status]}</span>
        </div>
        <p className="text-sm">{task.customerName}</p>
        <RecoveryTaskLink role="staff" taskId={task.id} facilityId={task.facilityId} onChanged={refresh} />
      </Card>)}
    </div>
  </section>
}
