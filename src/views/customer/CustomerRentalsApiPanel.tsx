import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
import SupportApiEntry from "../support-api/SupportApiEntry"
export default function CustomerRentalsApiPanel() {
  return <SupportApiEntry role="customer"><RentalApiWorkspace role="customer" /></SupportApiEntry>
}
