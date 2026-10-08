import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { customerRentalApiNav, CUSTOMER_RENTAL_API_PAGE } from "./customerRentalApiIntegration"
import CustomerRentalsApiPanel from "./CustomerRentalsApiPanel"

vi.mock("../rental-api/RentalApiWorkspace", () => ({
  default: ({ role }: { role: string }) => <div data-role={role}>D1–D4 API workspace</div>,
}))

describe("additive D1–D4 Customer integration", () => {
  it("adds a separate API route without reusing the team rental-records route", () => {
    const nav = customerRentalApiNav(true)
    expect(nav).toHaveLength(1)
    expect(nav[0].id).toBe(CUSTOMER_RENTAL_API_PAGE)
    expect(nav[0].id).not.toBe("rental-records")
    expect(nav[0].permission).toBe("view_rentals")
  })
  it("does not expose an API-only navigation item in demo sessions", () => {
    expect(customerRentalApiNav(false)).toEqual([])
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
    expect(source).toContain("open={renewalModalOpen}")
    expect(source).toContain("open={renewalPaymentOpen}")
    for (const action of ["Yêu cầu trả kho", "Đồng ý quyết toán", "Thanh toán phần thiếu"])
      expect(source).toContain(action)
  })
  it("does not suppress owner notifications to accommodate the API workspace", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain("...contractExpiryNotifications,")
    expect(source).toContain("...visibleMyRentals.filter")
    expect(source).toContain("...renewals.filter")
    expect(source).not.toContain("...(isApiAuthenticated() ? [] : contractExpiryNotifications)")
  })
  it("mounts D1–D4 only on the separate authenticated route", () => {
    const source = readFileSync(new URL("./CustomerApp.tsx", import.meta.url), "utf8")
    expect(source).toContain("...customerRentalApiNav(isApiAuthenticated()),")
    expect(source).toContain("page === CUSTOMER_RENTAL_API_PAGE && isApiAuthenticated() && <CustomerRentalsApiPanel")
  })
  it("keeps Staff renewal-signing as an additive route alongside existing operations", () => {
    const source = readFileSync(new URL("../staff/StaffApp.tsx", import.meta.url), "utf8")
    expect(source).toContain('page === "renewal-signing" && isApiAuthenticated()')
    expect(source).toContain("StaffCheckInOperationsPanel")
    expect(source).toContain('page === "return" && (')
  })
})
