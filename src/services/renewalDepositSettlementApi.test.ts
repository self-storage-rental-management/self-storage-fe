import { afterEach, describe, expect, it, vi } from "vitest"
import { clearAuthTokens } from "./apiClient"
import { executeDepositRefund, getDepositSettlement, isDepositSettlement } from "./renewalDepositSettlementApi"
import { ids, instant, operationEvent, signingState } from "../../tests/rentalOperationsApiFixtures"

const settlement = { renewalId: ids.renewal, expectedVersion: 4, status: "REFUND_APPROVED", amount: 40, refundedAmount: 0, currency: "VND", environment: "SANDBOX", refundId: ids.event, signingDeadline: instant, checkedAt: instant }
const body = { refundId: ids.event, receiptFileId: ids.file, transactionReference: "sandbox-proof-1", transferred: true as const, expectedVersion: 4 }
function respond(data: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}
afterEach(() => { vi.unstubAllGlobals(); clearAuthTokens() })
describe("Renewal deposit settlement API", () => {
  it("reads the authorized role route and retains Sandbox identity", async () => {
    const fetch = respond(settlement)
    expect(await getDepositSettlement("manager",ids.renewal)).toEqual(settlement)
    expect(fetch.mock.calls[0][0]).toContain(`/api/manager/renewals/${ids.renewal}/deposit-settlement`)
  })
  it("rejects a response belonging to another renewal", async () => {
    respond({ ...settlement, renewalId: ids.rental })
    await expect(getDepositSettlement("customer",ids.renewal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it.each([{ refundedAmount: 41 }, { amount: -1 }, { environment: null }, { refundId: null }, { refundedAmount: Infinity }])("rejects inconsistent financial evidence %j", change => {
    expect(isDepositSettlement({ ...settlement,...change })).toBe(false)
  })
  it("records proof against the approved refund with an idempotency key", async () => {
    const event = { ...operationEvent, kind: "REFUND_EXECUTION", data: { reference: ids.event, renewalId: ids.renewal, amount: 40, currency: "VND", executedAt: instant, environment: "SANDBOX" } }
    const fetch = respond({ state: signingState,event })
    expect((await executeDepositRefund(ids.renewal,body,"refund-test-key")).event).toEqual(event)
    const init = fetch.mock.calls[0][1]
    expect(JSON.parse(init.body)).toEqual(body)
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("refund-test-key")
  })
  it("refuses client supplied amounts before sending a money command", async () => {
    const fetch = respond(settlement)
    await expect(executeDepositRefund(ids.renewal,{ ...body,amount: 400 } as typeof body,"refund-test-key")).rejects.toThrow("Trường hoàn tiền")
    expect(fetch).not.toHaveBeenCalled()
  })
  it("does not turn an API failure into a successful refund", async () => {
    respond({},503)
    await expect(executeDepositRefund(ids.renewal,body,"refund-test-key")).rejects.toMatchObject({ status: 503 })
  })
})
