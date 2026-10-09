import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiActor } from "../../services/authApi"
import { clearAuthTokens, ApiClientError } from "../../services/apiClient"
import { manager, page, rental } from "../../../tests/rentalApiFixtures"
import { supportTicket, supportIds } from "../../../tests/supportApiFixtures"
import { CustomerApiMetric, CustomerRentalApiLink, loadCustomerApiCount } from "./CustomerApiOverview"

const state = vi.hoisted(() => ({ actor: null as ApiActor | null, read: {} as Record<string, unknown>, identities: [] as string[] }))
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock("../../hooks/useRentalApiResource", () => ({ useRentalApiResource: (identity: string) => {
  state.identities.push(identity)
  return { loading: false, refresh: vi.fn(), ...state.read }
} }))
beforeEach(() => { state.actor = { ...manager, id: "c1", roles: ["CUSTOMER"] }; state.read = {}; state.identities = [] })
afterEach(() => { vi.unstubAllGlobals(); clearAuthTokens() })
function respond(value: unknown, status = 200) {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}
describe("D1/D5 overview: authoritative counts only", () => {
  it("requests an active Rental count from the server and uses totalItems, not page length", async () => {
    const p = page([rental])
    p.pagination = { ...p.pagination, pageSize: 1, totalItems: 37, totalPages: 37 }
    const fetch = respond(p)
    expect(await loadCustomerApiCount("active-rentals", "c1")).toBe(37)
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.pathname).toBe("/api/customer/rental-records")
    expect(url.searchParams.get("status")).toBe("active")
    expect(url.searchParams.get("size")).toBe("1")
  })
  it("reads the exact open Support filter with server pagination", async () => {
    const p = page([supportTicket])
    p.pagination = { ...p.pagination, pageSize: 1, totalItems: 9, totalPages: 9 }
    const fetch = respond(p)
    expect(await loadCustomerApiCount("open-support", supportIds.customer)).toBe(9)
    expect(fetch.mock.calls[0][0]).toContain("/api/customer/support-workflows?")
    expect(fetch.mock.calls[0][0]).toContain("status=open")
  })
  it.each(["active-rentals", "open-support"] as const)("accepts a verified empty %s result as zero", async metric => {
    respond(page([]))
    expect(await loadCustomerApiCount(metric, "c1")).toBe(0)
  })
  it.each([403, 409, 500])("propagates backend %s instead of falling back to Context or zero", async status => {
    respond({ error: { code: "CONFLICT", message: "DEFERRED_SOURCE" } }, status)
    await expect(loadCustomerApiCount("active-rentals", "c1")).rejects.toBeInstanceOf(ApiClientError)
  })
  it("rejects malformed pagination and cross-customer records", async () => {
    respond({ data: [] })
    await expect(loadCustomerApiCount("active-rentals", "c1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
    respond(page([rental]))
    await expect(loadCustomerApiCount("active-rentals", "another-customer")).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("shows unknown on unavailable data, keeps verified zero and does not show a stale count on error", () => {
    state.read = { error: new Error("Offline"), data: 42 }
    let html = renderToStaticMarkup(<CustomerApiMetric metric="active-rentals" />)
    expect(html).toContain("Chưa xác minh")
    expect(html).not.toContain(">42<")
    expect(html).not.toContain(">0<")
    state.read = { data: 0 }
    html = renderToStaticMarkup(<CustomerApiMetric metric="active-rentals" />)
    expect(html).toContain(">0<")
  })
  it("re-keys reads after account or facility/permission changes", () => {
    renderToStaticMarkup(<CustomerApiMetric metric="active-rentals" />)
    state.actor = { ...state.actor!, id: "another-customer", facilityScopes: {}, permissions: [] }
    renderToStaticMarkup(<CustomerApiMetric metric="active-rentals" />)
    expect(state.identities[0]).not.toBe(state.identities[1])
    state.actor = null
    const html = renderToStaticMarkup(<CustomerApiMetric metric="active-rentals" />)
    expect(html).toContain("Chưa xác minh")
    expect(state.identities).toHaveLength(2)
  })
  it("directs the overview to the rental workspace without fabricated PIN, access or payment facts", () => {
    const html = renderToStaticMarkup(<CustomerRentalApiLink onOpen={() => {}} />)
    expect(html).toContain("Xem hồ sơ thuê &amp; Gia hạn")
    for (const text of ["24/7", "9004#", "Đã thanh toán", "chưa có hồ sơ thuê"]) expect(html).not.toContain(text)
  })
})
