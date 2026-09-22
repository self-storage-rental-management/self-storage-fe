import { useState } from 'react'
import { Tabs } from '../../components/ui'
import type { User } from '../../types'
import ManagerCheckinsPanel from './ManagerCheckinsPanel'
import ManagerReturnsPanel from './ManagerReturnsPanel'

interface Props {
  user: User
  showToast: (message: string) => void
  statusBadge: (status: string) => React.ReactNode
}

export default function ManagerMovesPanel({ user, showToast, statusBadge }: Props) {
    const [tab, setTab] = useState<'move-ins' | 'move-outs'>('move-ins')
  const labels = ['Nhận kho', 'Trả kho']
  return <div className="space-y-5">
    <Tabs tabs={labels} active={tab === 'move-ins' ? labels[0] : labels[1]} onChange={value => setTab(value === labels[0] ? 'move-ins' : 'move-outs')} />
    {tab === 'move-ins' ? <ManagerCheckinsPanel user={user} sb={statusBadge} /> : <ManagerReturnsPanel user={user} showToast={showToast} sb={statusBadge} />}
  </div>
}
