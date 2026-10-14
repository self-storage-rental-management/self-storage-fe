import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function CustomerRentalsApiPanel({ initialRentalId }: { initialRentalId?: string }) {
  return <RentalApiWorkspace role="customer" initialRentalId={initialRentalId} />
}
