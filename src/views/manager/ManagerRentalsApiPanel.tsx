import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function ManagerRentalsApiPanel({ initialRentalId, initialRenewalId }: { initialRentalId?: string; initialRenewalId?: string }) {
  return <RentalApiWorkspace role="manager" initialRentalId={initialRentalId} initialRenewalId={initialRenewalId} />
}
