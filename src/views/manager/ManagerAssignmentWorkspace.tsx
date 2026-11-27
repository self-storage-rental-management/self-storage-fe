import ManagerUnitAssignmentPanel from './ManagerUnitAssignmentPanel'

export default function ManagerAssignmentWorkspace({ showToast }: {
  showToast: (message: string) => void
  onOpenRental?: (rentalId: string) => void
  onOpenMaintenance?: (unitId: string, unitCode: string) => void
}) {
  return <ManagerUnitAssignmentPanel showToast={showToast} />
}
