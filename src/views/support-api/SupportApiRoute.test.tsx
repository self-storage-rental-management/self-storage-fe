import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiActor } from "../../services/authApi"
import { ApiClientError } from "../../services/apiClient"
import { supportActor, supportTicket, supportIds } from "../../../tests/supportApiFixtures"
import { page } from "../../../tests/rentalApiFixtures"
import { SupportApiRoute } from "./SupportApiEntry"

const state = vi.hoisted(() => ({ actor: null as ApiActor | null, read: {} as Record<string, unknown> }))
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: () => ({ loading: false, refresh: vi.fn(), ...state.read }),
}))
beforeEach(() => { state.actor = null; state.read = {}; vi.clearAllMocks() })

describe("primary D5 Support data boundary", () => {
  it.each(["customer", "staff"] as const)("preserves the exact demo child for %s", role => {
    const html = renderToStaticMarkup(<SupportApiRoute apiAuthenticated={false} role={role}><p>Demo-only ticket</p></SupportApiRoute>)
    expect(html).toBe("<p>Demo-only ticket</p>")
  })
  it.each(["customer", "staff"] as const)("renders verified API records, never Context children, for %s", role => {
    state.actor = supportActor(role)
    state.read = { data: page([{ ...supportTicket, subject: "Persisted API ticket", assignedStaffId: role === "staff" ? supportIds.staff : null }]) }
    const html = renderToStaticMarkup(<SupportApiRoute apiAuthenticated role={role}><p>Demo-only ticket</p></SupportApiRoute>)
    expect(html).toContain("Persisted API ticket")
    expect(html).not.toContain("Demo-only ticket")
  })
  it.each([null, 401, 403, 404, 409, 500] as const)("never falls back on API failure %s", status => {
    state.actor = supportActor("customer")
    state.read = { error: new ApiClientError("Backend unavailable", { status }) }
    const html = renderToStaticMarkup(<SupportApiRoute apiAuthenticated role="customer"><p>Demo-only ticket</p></SupportApiRoute>)
    expect(html).toContain('role="alert"')
    expect(html).not.toContain("Demo-only ticket")
    expect(html).not.toContain("Không có yêu cầu phù hợp")
  })
  it("distinguishes successful empty data from unavailability", () => {
    state.actor = supportActor("customer")
    state.read = { data: page([]) }
    const html = renderToStaticMarkup(<SupportApiRoute apiAuthenticated role="customer"><p>Demo-only ticket</p></SupportApiRoute>)
    expect(html).toContain("Không có yêu cầu hỗ trợ phù hợp")
    expect(html).not.toContain("Demo-only ticket")
  })
  it("does not display a previous customer's ticket or grant Staff missing permissions", () => {
    state.actor = supportActor("customer")
    state.read = { data: page([{ ...supportTicket, customerId: supportIds.foreign, subject: "Private foreign ticket" }]) }
    let html = renderToStaticMarkup(<SupportApiRoute apiAuthenticated role="customer"><p>Demo-only ticket</p></SupportApiRoute>)
    expect(html).not.toContain("Private foreign ticket")
    expect(html).toContain("ngoài phạm vi")
    state.actor = { ...supportActor("staff"), permissions: ["support:read"] }
    html = renderToStaticMarkup(<SupportApiRoute apiAuthenticated role="staff"><p>Demo-only ticket</p></SupportApiRoute>)
    expect(html).toContain("Bạn chưa có quyền truy cập hỗ trợ")
    expect(html).not.toContain("manage_support")
    expect(html).not.toContain("Private foreign ticket")
    expect(html).not.toContain("Demo-only ticket")
  })
  it("removes competing Support tabs from rental/signing entry points", () => {
    for (const file of ["../customer/CustomerRentalsApiPanel.tsx", "../staff/StaffRenewalOperationsApiPanel.tsx"]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toContain("SupportApiEntry")
    }
  })
})
