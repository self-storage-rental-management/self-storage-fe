import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function CustomerRentalsApiPanel({ focusStorageUnitId, onRequestSupport, onBrowseUnits }: {
  focusStorageUnitId?: string
  onRequestSupport?: (id: string, unitCode: string) => void
  onBrowseUnits?: () => void
}) {
  return <RentalApiWorkspace role="customer" focusStorageUnitId={focusStorageUnitId} onRequestSupport={onRequestSupport} onBrowseUnits={onBrowseUnits} />
}
