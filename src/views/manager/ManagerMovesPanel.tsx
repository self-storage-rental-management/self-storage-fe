import { useEffect, useState } from 'react'
import { Tabs } from '../../components/ui'
import type { User } from '../../types'
import ManagerCheckinsPanel from './ManagerCheckinsPanel'
import ManagerReturnsPanel from './ManagerReturnsPanel'
import ManagerExceptionsPanel from './ManagerExceptionsPanel'
import ManagerAccessCredentialsPanel from './ManagerAccessCredentialsPanel'
import { isApiAuthenticated } from '../../services/authApi'
import { useStorageHub } from '../../store/StorageHubContext'
import { isManagerFacilityVisible } from '../../domain/managerRules'

interface Props {
  user: User
  showToast: (message: string) => void
  statusBadge: (status: string) => React.ReactNode
  onNavigate: (page: string) => void
  onCreateMaintenanceWork?: (draft: { referenceId: string; title: string; notes: string }) => void
}

export default function ManagerMovesPanel({ user, showToast, statusBadge, onNavigate, onCreateMaintenanceWork }: Props) {
  const hub = useStorageHub()
  const hasDispute = hub.returns.some(item => item.status === 'disputed' && isManagerFacilityVisible(user, item.facilityId, item.facilityName))
  const [tab, setTab] = useState<'move-ins' | 'move-outs' | 'exceptions' | 'credentials'>(() => hasDispute ? 'move-outs' : 'move-ins')
  useEffect(() => { if (hasDispute) setTab('move-outs') }, [hasDispute])
  const labels = isApiAuthenticated() ? ['Nhận kho', 'Trả kho', 'Credential', 'Ngoại lệ vận hành'] : ['Nhận kho', 'Trả kho', 'Ngoại lệ vận hành']
  const activeLabel = tab === 'move-ins' ? labels[0] : tab === 'move-outs' ? labels[1] : tab === 'credentials' && isApiAuthenticated() ? labels[2] : labels[labels.length - 1]
  return <div className="space-y-5">
    <Tabs tabs={labels} active={activeLabel} onChange={value => setTab(value === labels[0] ? 'move-ins' : value === labels[1] ? 'move-outs' : isApiAuthenticated() && value === labels[2] ? 'credentials' : 'exceptions')} />
    {tab === 'move-ins' ? <ManagerCheckinsPanel user={user} sb={statusBadge} /> : tab === 'move-outs' ? <ManagerReturnsPanel user={user} showToast={showToast} sb={statusBadge} onCreateMaintenanceWork={onCreateMaintenanceWork} /> : tab === 'credentials' && isApiAuthenticated() ? <ManagerAccessCredentialsPanel facilityId={user.facilityId} /> : <ManagerExceptionsPanel user={user} onOpen={destination => {
      if (destination === 'move-ins' || destination === 'move-outs') setTab(destination)
      else onNavigate(destination)
    }} />}
  </div>
}
