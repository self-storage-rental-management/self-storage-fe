import { afterEach, describe, expect, it, vi } from "vitest"
import { clearAuthTokens, setAccessToken } from "./apiClient"
import { getRecoveryTask, listRecoveryTasks, isRecoveryTask } from "./recoveryTasksApi"
import { validRenewalRisk } from "../views/rental-api/RenewalRiskNotice"

const id = "00000000-0000-4000-8000-000000000001"
const rentalId = "00000000-0000-4000-8000-000000000002"
const facilityId = "00000000-0000-4000-8000-000000000003"
const otherId = "00000000-0000-4000-8000-000000000004"
const receivedAt = "2026-10-18T01:00:00Z"
const task = { id, rentalId, facilityId, caseRef: `RENTAL_TERM:${rentalId}`, status: "OPEN", reason: "AUTO_OVERDUE_DAY_8", receivedAt, customerName: "Customer", storageUnitCode: "UNIT-01" }
function respond(value: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}
const page = (data: unknown[]) => ({ data, pagination: { page: 0, pageSize: 20, totalItems: data.length, totalPages: data.length ? 1 : 0, sort: "receivedAt,desc" } })
afterEach(() => { vi.unstubAllGlobals(); clearAuthTokens() })

describe("Recovery task transport and evidence", () => {
  it.each(["manager", "staff"] as const)("reads the %s queue with authentication and the selected facility", async role => {
    setAccessToken("token")
    const fetch = respond(page([task]))
    expect((await listRecoveryTasks(role, facilityId)).data).toEqual([task])
    expect(fetch.mock.calls[0][0]).toContain(`/api/${role}/recovery-tasks?facilityId=${facilityId}`)
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer token")
  })
  it("rejects tasks from a different facility", async () => {
    respond(page([{ ...task, facilityId: otherId }]))
    await expect(listRecoveryTasks("manager", facilityId)).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("rejects a detail response for a different task", async () => {
    respond({ data: { ...task, id: otherId } })
    await expect(getRecoveryTask("staff", id, facilityId)).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("keeps connection failures distinct from an empty queue", async () => {
    respond({ message: "Unavailable" }, 503)
    await expect(listRecoveryTasks("manager", facilityId)).rejects.toThrow()
  })
  it.each([{ status: "UNKNOWN" }, { caseRef: `RENTAL_TERM:${otherId}` }, { receivedAt: null }])("rejects incomplete receiver evidence %j", patch => {
    expect(isRecoveryTask({ ...task, ...patch })).toBe(false)
  })
  const risk = { rentalId, renewalId: null, checkedAt: receivedAt, completeness: "COMPLETE", overdueDays: 8, severity: "RENEWAL_CLOSED", signingDeadline: null, repossessionDeadline: "2026-10-17T10:00:00Z", repossessionStartsAt: "2026-10-17T17:00:00Z", withinOrdinaryRenewalWindow: false, remainingRentalAmount: null, estimatedOverdueFee: null, currency: "VND" }
  it("does not equate day eight with a persisted Recovery receipt", () => {
    expect(validRenewalRisk({ ...risk, repossessionStatus: "NOT_CONFIRMED", repossessionStartedAt: null, recoveryTaskId: null })).toBe(true)
    expect(validRenewalRisk({ ...risk, repossessionStatus: "REPOSSESSION_STARTED", repossessionStartedAt: null, recoveryTaskId: null })).toBe(false)
  })
  it("requires the ordinary renewal flow to be blocked when a task exists", () => {
    const started = { ...risk, repossessionStatus: "REPOSSESSION_STARTED", repossessionStartedAt: receivedAt, recoveryTaskId: id }
    expect(validRenewalRisk(started)).toBe(true)
    expect(validRenewalRisk({ ...started, withinOrdinaryRenewalWindow: true })).toBe(false)
  })
})
