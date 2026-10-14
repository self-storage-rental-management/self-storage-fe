import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function CustomerRentalsApiPanel({ focusStorageUnitId }: { focusStorageUnitId?: string }) {
  return <RentalApiWorkspace role="customer" focusStorageUnitId={focusStorageUnitId} />
}
