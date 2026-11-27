import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function ManagerRentalsApiPanel({ initialRentalId }: { initialRentalId?: string }) {
  return <RentalApiWorkspace role="manager" initialRentalId={initialRentalId} />
}
