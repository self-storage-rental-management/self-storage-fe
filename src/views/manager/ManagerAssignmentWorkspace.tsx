import { useState } from 'react'
import { Button } from '../../components/ui'
import ManagerInventoryApiPanel from './ManagerInventoryApiPanel'
import ManagerUnitAssignmentPanel from './ManagerUnitAssignmentPanel'

export default function ManagerAssignmentWorkspace({ showToast, onOpenRental, onOpenMaintenance }: {
  showToast: (message: string) => void
  onOpenRental?: (rentalId: string) => void
  onOpenMaintenance?: (unitId: string, unitCode: string) => void
}) {
  const [tab, setTab] = useState<'waiting' | 'units'>('waiting')
  return <div className="space-y-5">
    <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
      <Button variant={tab === 'waiting' ? 'primary' : 'ghost'} onClick={() => setTab('waiting')}>Đơn chờ phân gian</Button>
      <Button variant={tab === 'units' ? 'primary' : 'ghost'} onClick={() => setTab('units')}>Danh sách gian kho</Button>
    </div>
    {tab === 'waiting'
      ? <ManagerUnitAssignmentPanel showToast={showToast} />
      : <ManagerInventoryApiPanel view="assignment" onOpenRental={onOpenRental} onOpenMaintenance={onOpenMaintenance} />}
  </div>
}
