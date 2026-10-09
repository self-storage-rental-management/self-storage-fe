import { describe, expect, it, vi } from "vitest"
import { ApiClientError } from "../services/apiClient"
import {
  SupportAttempt,
  supportAttemptFor,
  uncertainSupportOutcome,
  type SupportSubmission,
} from "./useSupportCommand"
const request: SupportSubmission = {
  kind: "create",
  body: {
    subject: "Test-only",
    description: "Request",
    facilityId: "00000000-0000-0000-0000-000000000001",
  },
}
describe("D5 retry safety", () => {
  it("reuses the exact key/body until outcome is known", () => {
    const attempt = new SupportAttempt()
    const first = attempt.prepare(request)
    expect(attempt.prepare(structuredClone(request))).toBe(first)
    expect(() =>
      attempt.prepare({
        ...request,
        body: { ...request.body, subject: "Changed" },
      }),
    ).toThrow("Cần xác định")
  })
  it("snapshots payload, preventing edited fields from mutating an uncertain request", () => {
    const input = structuredClone(request),
      attempt = new SupportAttempt()
    attempt.prepare(input)
    input.body.subject = "Changed outside"
    expect(attempt.pending?.submission).toEqual(request)
  })
  it("retains pending request through workspace unmount/remount, isolated by actor/role", () => {
    const key = `test-only:${crypto.randomUUID()}`
    const a = supportAttemptFor(key)
    a.prepare(request)
    expect(supportAttemptFor(key).pending?.key).toBe(a.pending?.key)
    expect(supportAttemptFor(`${key}:other-actor`).pending).toBeUndefined()
    a.clear()
  })
  it("notifies remounted observers when another in-flight request finishes", () => {
    const attempt = new SupportAttempt(),
      listener = vi.fn()
    const unsubscribe = attempt.subscribe(listener)
    const first = attempt.prepare(request)
    attempt.clear(first.key)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(attempt.snapshot()).toBeUndefined()
    unsubscribe()
  })
  it("a late response cannot clear a newer pending command", () => {
    const attempt = new SupportAttempt(),
      first = attempt.prepare(request)
    attempt.clear(first.key)
    const second = attempt.prepare(request)
    attempt.clear(first.key)
    expect(attempt.pending?.key).toBe(second.key)
  })
  it.each([
    new ApiClientError("timeout"),
    new ApiClientError("gateway", { status: 503 }),
    new ApiClientError("Invalid response", { code: "INVALID_RESPONSE" }),
  ])("retains key for uncertain network/server/response result", (error) => {
    expect(uncertainSupportOutcome(error)).toBe(true)
  })
  it.each([400, 401, 403, 404, 409])(
    "HTTP %i is a known rejection, not successful commit",
    (status) => {
      expect(
        uncertainSupportOutcome(new ApiClientError("Rejected", { status })),
      ).toBe(false)
    },
  )
})
