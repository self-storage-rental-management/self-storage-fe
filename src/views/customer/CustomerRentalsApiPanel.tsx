import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function CustomerRentalsApiPanel({ focusStorageUnitId, recoveryTarget, initialRentalId, onRequestSupport, onBrowseUnits }: {
  recoveryTarget?: { id: string; request: number }
  focusStorageUnitId?: string
  initialRentalId?: string
  onRequestSupport?: (id: string, unitCode: string) => void
  onBrowseUnits?: () => void
}) {
  return <RentalApiWorkspace role="customer" recoveryTarget={recoveryTarget} focusStorageUnitId={focusStorageUnitId} initialRentalId={initialRentalId} onRequestSupport={onRequestSupport} onBrowseUnits={onBrowseUnits} />
}
