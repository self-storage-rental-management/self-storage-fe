import { useEffect, useState } from 'react'
import { Tabs } from '../../components/ui'
import type { User } from '../../types'
import ManagerCheckinsPanel from './ManagerCheckinsPanel'
import ManagerReturnsPanel from './ManagerReturnsPanel'
import { useStorageHub } from '../../store/StorageHubContext'
import { isFacilityVisible } from '../../domain/managerRules'

interface Props {
  user: User
  showToast: (message: string) => void
  statusBadge: (status: string) => React.ReactNode
}

export default function ManagerMovesPanel({ user, showToast, statusBadge }: Props) {
  const hub = useStorageHub()
  const hasDispute = hub.returns.some(item => item.status === 'disputed' && isFacilityVisible(user, item.facilityId, item.facilityName))
  const [tab, setTab] = useState<'move-ins' | 'move-outs'>(() => hasDispute ? 'move-outs' : 'move-ins')
  useEffect(() => { if (hasDispute) setTab('move-outs') }, [hasDispute])
  const labels = ['Nhận kho', 'Trả kho']
  return <div className="space-y-5">
    <Tabs tabs={labels} active={tab === 'move-ins' ? labels[0] : labels[1]} onChange={value => setTab(value === labels[0] ? 'move-ins' : 'move-outs')} />
    {tab === 'move-ins' ? <ManagerCheckinsPanel user={user} sb={statusBadge} /> : <ManagerReturnsPanel user={user} showToast={showToast} sb={statusBadge} />}
  </div>
}
