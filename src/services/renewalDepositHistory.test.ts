import { beforeEach, expect, it, vi } from "vitest"
import { apiRequest } from "./apiClient"
import { listRenewalOperationEvents } from "./renewalOperationsApi"
import { loadCustomerPaymentHistory } from "./customerPaymentHistory"

vi.mock("./apiClient", async original => ({ ...await original<typeof import("./apiClient")>(), apiRequest: vi.fn() }))
vi.mock("./authApi", () => ({ getAuthenticatedActor: () => ({ id: "customer" }) }))
vi.mock("./customerReservationApi", () => ({
  listCustomerPaymentHistory: vi.fn(async () => page([])),
}))
vi.mock("./renewalApi", () => ({ listRenewals: vi.fn(async () => page([{ id: renewalId, storageUnit: { code: "A1" }, facility: { name: "Q1" } }])) }))
const renewalId = "c91aa45b-0320-4133-bff2-86e7d2d512c6"
const event = {
  id: "11111111-1111-4111-8111-111111111111", kind: "DEPOSIT", actorId: null,
  occurredAt: "2026-10-13T06:43:00Z",
  data: {
    paymentRef: "291630d3-6e53-4d2c-8234-e94063cdb8a9", amount: 6600000, currency: "VND",
    paidAt: "2026-10-13T06:43:00Z", paymentDeadline: "2026-10-13T06:59:59Z",
    receiptId: "22222222-2222-4222-8222-222222222222", outcome: "SUCCESS",
  },
}
function page(data: unknown[]) { return { data, pagination: { page: 0, pageSize: 50, totalItems: data.length, totalPages: data.length ? 1 : 0, sort: "occurredAt,desc" } } }
beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockImplementation(async path => path.includes("/payments") ? page([event]) : page([]))
})
it("keeps an old VNPay event visible without certifying it before current reconciliation", async () => {
  const result = await loadCustomerPaymentHistory()
  expect(result.warnings).toEqual([])
  expect(result.entries).toEqual([expect.objectContaining({ id: event.data.paymentRef, category: "renewal", amount: 6600000, status: "UNKNOWN", receiptAvailable: false, method: "VNPay" })])
})
it("also accepts deposits emitted with the corrected Renewal binding", async () => {
  vi.mocked(apiRequest).mockResolvedValue(page([{ ...event, data: { ...event.data, renewalId } }]))
  expect((await listRenewalOperationEvents("customer", renewalId, "payments"))["data"]).toHaveLength(1)
})
it("rejects another Renewal binding and incomplete historical receipt data", async () => {
  vi.mocked(apiRequest).mockResolvedValue(page([{ ...event, data: { ...event.data, renewalId: "33333333-3333-4333-8333-333333333333" } }]))
  await expect(listRenewalOperationEvents("customer", renewalId, "payments")).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  vi.mocked(apiRequest).mockResolvedValue(page([{ ...event, data: { ...event.data, receiptId: null } }]))
  await expect(listRenewalOperationEvents("customer", renewalId, "payments")).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
})
