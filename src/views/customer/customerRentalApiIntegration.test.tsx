import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CUSTOMER_RENTAL_API_PAGE } from "./customerRentalApiIntegration"
import CustomerRentalsApiPanel from "./CustomerRentalsApiPanel"

vi.mock("../rental-api/RentalApiWorkspace", () => ({
  default: ({ role }: { role: string }) => <div data-role={role}>D1–D4 API workspace</div>,
}))

describe("Customer Rental API integration", () => {
  it("uses the existing rental-records route", () => {
    expect(CUSTOMER_RENTAL_API_PAGE).toBe("rental-records")
  })
  it("shows one Hồ sơ Thuê navigation item", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain("{ id: 'rental-records', label: 'Hồ sơ Thuê'")
    expect(source).not.toContain("...customerRentalApiNav(")
  })
  it("keeps the Customer API workspace implemented and customer-scoped", () => {
    const html = renderToStaticMarkup(<CustomerRentalsApiPanel />)
    expect(html).toContain('data-role="customer"')
    expect(html).toContain("D1–D4 API workspace")
  })
  it("keeps the owner Rental/Return/Settlement page and dialogs ungated by D1–D4", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain("{page === 'rental-records' && (")
    expect(source).not.toContain("page === 'rental-records' && isApiAuthenticated()")
    expect(source).not.toContain("page === 'rental-records' && !isApiAuthenticated()")
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
  it("mounts the API workspace inside the shared rental-records page", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain("{page === 'rental-records' && (")
    expect(source).toContain("isApiAuthenticated() && <CustomerRentalsApiPanel key={user.id} />")
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
  it("mounts primary Customer/Staff Support through the API/demo boundary", () => {
    for (const role of ["customer", "staff"] as const) {
      const source = readFileSync(new URL(`../${role}/${role === "customer" ? "Customer" : "Staff"}App.tsx`, import.meta.url), "utf8")
      expect(source).toContain(`<SupportApiRoute apiAuthenticated={isApiAuthenticated()} role="${role}">`)
    }
  })
  it("uses API-only D1/D5 metrics and routes rental overview away from demo PIN/status fields", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain('isApiAuthenticated() ? <CustomerApiMetric metric="active-rentals"')
    expect(source).toContain('isApiAuthenticated() ? <CustomerApiMetric metric="open-support"')
    expect(source).toContain('isApiAuthenticated() ? <CustomerRentalApiLink onOpen={() => navigateTo(CUSTOMER_RENTAL_API_PAGE)}')
    expect(source).toContain("if (isApiAuthenticated()) { navigateTo(CUSTOMER_RENTAL_API_PAGE); return }")
  })
})
