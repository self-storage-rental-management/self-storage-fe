import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function CustomerRentalsApiPanel({ focusStorageUnitId, onRequestSupport }: {
  focusStorageUnitId?: string
  onRequestSupport?: (id: string, unitCode: string) => void
}) {
  return <RentalApiWorkspace role="customer" focusStorageUnitId={focusStorageUnitId} onRequestSupport={onRequestSupport} />
}
