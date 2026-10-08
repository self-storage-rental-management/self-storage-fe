import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ApiClientError,
  clearAuthTokens,
  setAccessToken,
  setRefreshToken,
} from "./apiClient"
import { getRental, listRentals } from "./rentalApi"
import {
  cancelRenewal,
  decideRenewal,
  getRenewal,
  getRenewalOptions,
  listRenewals,
  quoteRenewal,
  reviseRenewal,
  submitRenewal,
} from "./renewalApi"
import { page, quote, rental, renewal } from "../../tests/rentalApiFixtures"
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
function response(data: unknown) {
  const mock = vi.fn().mockImplementation(async () => json(data))
  vi.stubGlobal("fetch", mock)
  return mock
}
afterEach(() => {
  vi.unstubAllGlobals()
  clearAuthTokens()
})

describe("D1/D2 wire contracts", () => {
  it("reads additive financial fields without converting or calculating deposit", async () => {
    const data={...rental,financialSummary:{...rental.financialSummary,completeness:"COMPLETE",outstandingAmount:0,overdueAmount:0,securityDepositAmount:1234567,billingMode:"PREPAID_FULL_PERIOD"}}
    response({data})
    expect((await getRental("manager","r1")).financialSummary).toEqual(data.financialSummary)
  })
  it.each([
    {securityDepositAmount:-1},
    {securityDepositAmount:"100"},
    {billingMode:"FAKE_RECURRING"},
    {billingMode:"PREPAID_FULL_PERIOD",nextDueDate:"2026-11-01"},
  ])("rejects invalid additive D1 fields %j", async fields => {
    response({data:{...rental,financialSummary:{...rental.financialSummary,...fields}}})
    await expect(getRental("manager","r1")).rejects.toMatchObject({code:"INVALID_RESPONSE"})
  })
  it.each(["customer","manager"] as const)("reads nested accepted terms and cancellation reason for %s",async role=>{
    const data={...renewal,amount:quote.totalAfterDiscount,acceptedTerms:quote,cancellationReason:"Đổi kế hoạch"}
    response({data})
    expect(await getRenewal(role,"n1")).toEqual(data)
  })
  it("accepts null additive fields from legacy Renewal",async()=>{
    response({data:{...renewal,acceptedTerms:null,cancellationReason:null}})
    expect((await getRenewal("manager","n1")).acceptedTerms).toBeNull()
  })
  it.each([
    {monthlyPrice:"5500000"}, {renewalDepositAmount:-1}, {rentalMonths:0},
    {facilityId:"another-facility"}, {storageUnitId:"another-unit"},
    {newEndDate:"2027-02-01"}, {totalAfterDiscount:1},
    {renewalPolicyVersion:null},
  ])("rejects malformed or mismatched accepted snapshot %j",async fields=>{
    response({data:{...renewal,amount:quote.totalAfterDiscount,acceptedTerms:{...quote,...fields}}})
    await expect(getRenewal("manager","n1")).rejects.toMatchObject({code:"INVALID_RESPONSE"})
  })
  it("rejects invalid cancellation reason instead of crashing detail",async()=>{
    response({data:{...renewal,cancellationReason:{text:"not a string"}}})
    await expect(getRenewal("customer","n1")).rejects.toMatchObject({code:"INVALID_RESPONSE"})
  })
  it.each(["customer", "manager"] as const)(
    "loads scoped %s Rental records without a demo source",
    async (role) => {
      const fetch = response(page([rental]))
      expect(
        await listRentals(role, {
          page: 0,
          size: 20,
          search: " A-01 ",
          sort: "monthlyPrice,desc",
        }),
      ).toEqual(page([rental]))
      const url = new URL(fetch.mock.calls[0][0])
      expect(url.pathname).toBe(`/api/${role}/rentals`)
      expect(url.searchParams.get("search")).toBe("A-01")
      expect(url.searchParams.get("page")).toBe("0")
    },
  )
  it("uses BE pagination field names and rejects Booking pagination", async () => {
    response({
      data: [rental],
      pagination: { page: 0, size: 20, totalElements: 1, totalPages: 1 },
    })
    await expect(listRentals("manager")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("preserves UNKNOWN/null on detail and sends no query", async () => {
    const fetch = response({ data: rental })
    expect(await getRental("customer", "r1")).toEqual(rental)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/customer\/rentals\/r1$/)
  })
  it("whitelists queries, including Customer Renewal without search/facility", async () => {
    const fetch = response(page([]))
    await listRentals("customer", {
      facilityId: "f1",
      ...{ needsAttention: true },
      size: 20,
    })
    expect(fetch.mock.calls[0][0]).not.toMatch(/facilityId|needsAttention/)
    await listRenewals("customer", {
      facilityId: "f1",
      search: "name",
      status: "pending",
    })
    expect(fetch.mock.calls[1][0]).not.toMatch(/search|facilityId/)
  })
  it.each([
    { size: 101 },
    { page: -1 },
    { sort: "needsAttention,desc" },
    { search: "x".repeat(201) },
  ])("rejects invalid query locally %j", async (query) => {
    const fetch = response(page([]))
    await expect(listRentals("manager", query)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("loads renewal options only from backend", async () => {
    response({ data: [{ pricingPackageCode: "P3", rentalMonths: 3 }] })
    expect(await getRenewalOptions("r1")).toEqual([
      { pricingPackageCode: "P3", rentalMonths: 3 },
    ])
  })
  it("keeps flattened quote.id and applied VND amounts unchanged", async () => {
    const fetch = response({ data: quote })
    expect(await quoteRenewal("r1", "P3")).toEqual(quote)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      pricingPackageCode: "P3",
    })
  })
  it("does not accept the Booking quoteId shape", async () => {
    response({ data: { ...quote, id: undefined, quoteId: "q1" } })
    await expect(quoteRenewal("r1", "P3")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("submits only accepted quote/note with original idempotency key", async () => {
    const fetch = response({ data: renewal })
    await submitRenewal("r1", "q1", "note", "key-1")
    expect(fetch.mock.calls[0][0]).toMatch(/\/rentals\/r1\/renewal-requests$/)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      renewalQuoteId: "q1",
      note: "note",
    })
    expect(
      new Headers(fetch.mock.calls[0][1].headers).get("Idempotency-Key"),
    ).toBe("key-1")
  })
  it("PATCH accepts revision with actual version; no computed price/endDate", async () => {
    const fetch = response({ data: renewal })
    await reviseRenewal("n1", "q2", "note", 2, "key-2")
    expect(fetch.mock.calls[0][1].method).toBe("PATCH")
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      renewalQuoteId: "q2",
      note: "note",
      expectedVersion: 2,
    })
  })
  it.each(["APPROVE", "REJECT"] as const)(
    "sends Manager %s without extending Rental",
    async (decision) => {
      const fetch = response({ data: renewal })
      await decideRenewal("n1", decision, "reason", 2, "key-3")
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch.mock.calls[0][0]).toMatch(
        /\/api\/manager\/renewals\/n1\/decision$/,
      )
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
        decision,
        reason: "reason",
        expectedVersion: 2,
      })
    },
  )
  it("cancel is pending workflow command, not a refund/delete", async () => {
    const fetch = response({ data: renewal })
    await cancelRenewal("n1", "reason", 2, "key-4")
    expect(fetch.mock.calls[0][0]).toMatch(
      /\/api\/customer\/renewals\/n1\/cancel$/,
    )
  })
  it("does not fabricate legacy version0", async () => {
    response({ data: { ...renewal, version: null } })
    expect((await getRenewal("manager", "n1")).version).toBeNull()
    expect(() =>
      reviseRenewal("n1", "q1", "", null as unknown as number, "key"),
    ).toThrow()
  })
  it("enforces reject/cancel reason and 2000 character bound", async () => {
    expect(() => decideRenewal("n1", "REJECT", "", 2, "key")).toThrow()
    expect(() => cancelRenewal("n1", "", 2, "key")).toThrow()
    expect(() => submitRenewal("r1", "q1", "x".repeat(2001), "key")).toThrow()
  })
  it.each([403, 404, 409])("does not fallback on HTTP %i", async (status) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        json(
          { error: { code: "CONFLICT", message: "DEFERRED_SOURCE: policy" } },
          status,
        ),
      )
    vi.stubGlobal("fetch", fetch)
    await expect(listRenewals("manager")).rejects.toBeInstanceOf(ApiClientError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it("preserves key/body across existing Auth 401 refresh", async () => {
    setAccessToken("old")
    setRefreshToken("refresh")
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "Expired" } }, 401))
      .mockResolvedValueOnce(
        json({ data: { accessToken: "new", refreshToken: "refresh2" } }),
      )
      .mockResolvedValueOnce(json({ data: renewal }))
    vi.stubGlobal("fetch", fetch)
    await decideRenewal("n1", "REJECT", "reason", 2, "stable-key")
    const first = fetch.mock.calls[0][1]
    const replay = fetch.mock.calls[2][1]
    expect(first.body).toBe(replay.body)
    expect(new Headers(first.headers).get("Idempotency-Key")).toBe(
      new Headers(replay.headers).get("Idempotency-Key"),
    )
    expect(new Headers(replay.headers).get("Authorization")).toBe("Bearer new")
  })
})
