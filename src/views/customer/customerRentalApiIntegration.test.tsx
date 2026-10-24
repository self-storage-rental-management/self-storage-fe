import { readFileSync } from "node:fs"
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
  it("shows one Hồ sơ thuê navigation item", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source.match(/\{\s*id:\s*'rental-records',\s*label:\s*'Hồ sơ thuê'/g)).toHaveLength(1)
    expect(source).not.toContain("...customerRentalApiNav(")
  })
  it("keeps the Customer API workspace implemented and customer-scoped", () => {
    const html = renderToStaticMarkup(<CustomerRentalsApiPanel />)
    expect(html).toContain('data-role="customer"')
    expect(html).toContain("D1–D4 API workspace")
  })
  it("keeps the demo lifecycle page separate from the authenticated API workspace", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain("{page === 'rental-records' && isApiAuthenticated() && <CustomerRentalsApiPanel")
    expect(source).toContain("{page === 'rental-records' && !isApiAuthenticated() && (")
    expect(source).toContain("open={renewalModalOpen && !isApiAuthenticated()}")
    expect(source).toContain("open={renewalPaymentOpen && !isApiAuthenticated()}")
    for (const action of ["Yêu cầu trả kho", "Đồng ý quyết toán", "Thanh toán phần thiếu"])
      expect(source).toContain(action)
  })
  it("preserves Return/receipt notifications but excludes demo D1/D2/D5 notifications from API sessions", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain("...(isApiAuthenticated() ? [] : contractExpiryNotifications),")
    expect(source).toContain("...visibleMyRentals.filter")
    expect(source).toContain("...(isApiAuthenticated() ? [] : renewals).filter")
    expect(source).toContain("...(isApiAuthenticated() ? [] : myTickets).flatMap")
    expect(source).toContain("...myReturns.filter")
  })
  it("mounts the API workspace once on the shared rental-records page", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source.match(/<CustomerRentalsApiPanel\b/g)).toHaveLength(1)
    expect(source).toContain("page === 'rental-records' && isApiAuthenticated() && <CustomerRentalsApiPanel")
    expect(source).not.toContain("page === CUSTOMER_RENTAL_API_PAGE && isApiAuthenticated()")
  })
  it("keeps Staff renewal-signing as an additive route alongside existing operations", () => {
    const source = readFileSync(new URL("../staff/StaffApp.tsx", import.meta.url), "utf8")
    expect(source).toContain('page === "renewal-signing" && isApiAuthenticated()')
    expect(source).toContain("StaffCheckInOperationsPanel")
    expect(source).toContain('page === "return" && (')
    expect(source).toContain('!isApiAuthenticated() && scheduledRenewals.length > 0')
    expect(source).toContain('open={Boolean(selectedRenewal) && !isApiAuthenticated()}')
  })
  it("keeps Staff Support as a page while Customer uses only the floating widget", () => {
    const customer = readFileSync(new URL('./CustomerApp.tsx', import.meta.url), 'utf8')
    expect(customer).toContain('<CustomerSupportWidget openRequest={supportWidgetRequest}')
    expect(customer).not.toContain('<SupportApiRoute')
    expect(customer).not.toContain("{ id: 'support', label:")
    for (const role of ["staff"] as const) {
      const source = readFileSync(new URL(`../${role}/StaffApp.tsx`, import.meta.url), "utf8")
      const routes = source.match(/<SupportApiRoute\b[^>]*>/g) ?? []
      expect(routes.some(route => route.includes('apiAuthenticated={isApiAuthenticated()}') && route.includes(`role="${role}"`))).toBe(true)
    }
  })
  it("uses API-only D1/D5 metrics and routes rental overview away from demo PIN/status fields", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain('isApiAuthenticated() ? <CustomerApiMetric metric="active-rentals"')
    expect(source).toContain('isApiAuthenticated() ? <CustomerApiMetric metric="open-support"')
    expect(source).toContain('isApiAuthenticated() ? <CustomerRentalApiLink onOpen={(storageUnitId)')
    expect(source).toContain("setReceiptRentalTarget(storageUnitId); navigateTo('rental-records')")
    expect(source).toContain("if (isApiAuthenticated()) { navigateTo('rental-records'); return }")
  })
})
