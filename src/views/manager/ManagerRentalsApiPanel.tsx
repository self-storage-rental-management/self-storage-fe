import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function ManagerRentalsApiPanel({ initialRentalId, initialRenewalId, onSuspicionReportSubmitted }: {
  initialRentalId?: string
  initialRenewalId?: string
  onSuspicionReportSubmitted?: (reportId: string) => void
}) {
  return <RentalApiWorkspace role="manager" initialRentalId={initialRentalId} initialRenewalId={initialRenewalId} onSuspicionReportSubmitted={onSuspicionReportSubmitted} />
}
