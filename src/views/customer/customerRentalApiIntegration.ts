// Customer Rental and Renewal share the existing rental-records page.
export const CUSTOMER_RENTAL_API_PAGE = "rental-records"

export function resolveCustomerInitialPage(search: string, fallbackPage: string): string {
  const params = new URLSearchParams(search)
  const emailSection = params.get('emailSection')
  if (emailSection && ['reservations', 'rental-records', 'payments', 'policies'].includes(emailSection)) return emailSection
  if (params.get("vnpayReturn") === "true") {
    if (params.get("reservationId")) return "reservations"
    if (params.get("renewalId")) return CUSTOMER_RENTAL_API_PAGE
  }
  return params.get("page") === "rental-renewals" ? CUSTOMER_RENTAL_API_PAGE : fallbackPage
}
