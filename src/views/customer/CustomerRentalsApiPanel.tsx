import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function CustomerRentalsApiPanel({ focusStorageUnitId, recoveryTarget, onRequestSupport, onBrowseUnits }: {
  recoveryTarget?: { id: string; request: number }
  focusStorageUnitId?: string
  onRequestSupport?: (id: string, unitCode: string) => void
  onBrowseUnits?: () => void
}) {
  return <RentalApiWorkspace role="customer" recoveryTarget={recoveryTarget} focusStorageUnitId={focusStorageUnitId} onRequestSupport={onRequestSupport} onBrowseUnits={onBrowseUnits} />
}
