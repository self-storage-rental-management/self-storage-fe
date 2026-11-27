import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
export default function ManagerRentalsApiPanel({ initialRentalId, onSuspicionReportSubmitted }: {
  initialRentalId?: string
  onSuspicionReportSubmitted: (reportId: string) => void
}) {
  return <RentalApiWorkspace role="manager" initialRentalId={initialRentalId} onSuspicionReportSubmitted={onSuspicionReportSubmitted} />
}
