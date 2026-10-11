import { useEffect, useState } from 'react'
import { Tabs } from '../../components/ui'
import type { User } from '../../types'
import ManagerCheckinsPanel from './ManagerCheckinsPanel'
import ManagerReturnsPanel from './ManagerReturnsPanel'
import ManagerExceptionsPanel from './ManagerExceptionsPanel'
import { useStorageHub } from '../../store/StorageHubContext'
import { isManagerFacilityVisible } from '../../domain/managerRules'

interface Props {
  user: User
  showToast: (message: string) => void
  statusBadge: (status: string) => React.ReactNode
  onNavigate: (page: string) => void
}

export default function ManagerMovesPanel({ user, showToast, statusBadge, onNavigate }: Props) {
  const hub = useStorageHub()
  const hasDispute = hub.returns.some(item => item.status === 'disputed' && isManagerFacilityVisible(user, item.facilityId, item.facilityName))
  const [tab, setTab] = useState<'move-ins' | 'move-outs' | 'exceptions'>(() => hasDispute ? 'move-outs' : 'move-ins')
  useEffect(() => { if (hasDispute) setTab('move-outs') }, [hasDispute])
  const labels = ['Nhận kho', 'Trả kho', 'Ngoại lệ vận hành']
  return <div className="space-y-5">
    <Tabs tabs={labels} active={tab === 'move-ins' ? labels[0] : tab === 'move-outs' ? labels[1] : labels[2]} onChange={value => setTab(value === labels[0] ? 'move-ins' : value === labels[1] ? 'move-outs' : 'exceptions')} />
    {tab === 'move-ins' ? <ManagerCheckinsPanel user={user} sb={statusBadge} /> : tab === 'move-outs' ? <ManagerReturnsPanel user={user} showToast={showToast} sb={statusBadge} /> : <ManagerExceptionsPanel user={user} onOpen={destination => {
      if (destination === 'move-ins' || destination === 'move-outs') setTab(destination)
      else onNavigate(destination)
    }} />}
  </div>
}
