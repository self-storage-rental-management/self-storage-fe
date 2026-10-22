import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CUSTOMER_RENTAL_API_PAGE, resolveCustomerInitialPage } from "./customerRentalApiIntegration"
import CustomerRentalsApiPanel from "./CustomerRentalsApiPanel"

vi.mock("../rental-api/RentalApiWorkspace", () => ({
  default: ({ role }: { role: string }) => <div data-role={role}>D1–D4 API workspace</div>,
}))

describe("Customer Rental API integration", () => {
  it("uses the existing rental-records route", () => {
    expect(CUSTOMER_RENTAL_API_PAGE).toBe("rental-records")
  })
  it.each([
    ["?page=rental-renewals", "overview", "rental-records"],
    ["?page=payments&vnpayReturn=true&reservationId=reservation-1", "payments", "reservations"],
    ["?vnpayReturn=true&renewalId=renewal-1", "overview", "rental-records"],
    ["?page=support", "support", "support"],
    ["?reservationId=reservation-1", "overview", "overview"],
  ])("opens the correct customer page for %s", (search, fallback, expected) => {
    expect(resolveCustomerInitialPage(search, fallback)).toBe(expected)
  })

  it("keeps the Customer API workspace implemented and customer-scoped", () => {
    const html = renderToStaticMarkup(<CustomerRentalsApiPanel />)
    expect(html).toContain('data-role="customer"')
    expect(html).toContain("D1–D4 API workspace")
  })

})
