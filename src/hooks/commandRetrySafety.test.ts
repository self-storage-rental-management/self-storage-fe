import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiClientError } from "../services/apiClient"
import { useRenewalCommand } from "./useRenewalCommand"
import { useSupportCommand, supportAttemptFor, type SupportSubmission } from "./useSupportCommand"

// Hook lifecycle harness only: real command hooks, controlled transport, no DB or browser claims.
const harness = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, create: vi.fn(), send: vi.fn() }))
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => {
    const slot = harness.cursor++
    return harness.slots[slot] ??= { current: initial }
  },
  useState: (initial: unknown) => {
    const slot = harness.cursor++
    if (!(slot in harness.slots)) harness.slots[slot] = initial
    return [harness.slots[slot], (next: unknown) => { harness.slots[slot] = next }]
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}))
vi.mock("../services/supportApi", () => ({
  createSupportTicket: (...args: unknown[]) => harness.create(...args),
  sendSupportCommand: (...args: unknown[]) => harness.send(...args),
}))
function render<T>(hook: () => T): T { harness.cursor = 0; return hook() }
const submission: SupportSubmission = { kind: "create", body: { subject: "Test", description: "Test", facilityId: "00000000-0000-0000-0000-000000000001" } }
beforeEach(() => { harness.slots = []; harness.cursor = 0; harness.create.mockReset(); harness.send.mockReset() })
describe("uncertain command result survives subsequent rejection", () => {
  it.each([400, 401, 403, 404, 409])("renewal 503 then %i retains the original key until success", async status => {
    const send = vi.fn().mockRejectedValueOnce(new ApiClientError("Lost", { status: 503 }))
      .mockRejectedValueOnce(new ApiClientError("Retry denied", { status })).mockResolvedValue({})
    const success = vi.fn()
    let hook = render(useRenewalCommand)
    await hook.run("original payload", send, success)
    hook = render(useRenewalCommand)
    expect(hook.uncertain).toBe(true)
    await hook.run("original payload", send, success)
    hook = render(useRenewalCommand)
    expect(hook.uncertain).toBe(true)
    expect(hook.conflict).toBe(false)
    expect(success).not.toHaveBeenCalled()
    await hook.run("original payload", send, success)
    expect(send.mock.calls.map(args => args[0])).toEqual(Array(3).fill(send.mock.calls[0][0]))
    expect(success).toHaveBeenCalledTimes(1)
    hook = render(useRenewalCommand)
    expect(hook.uncertain).toBe(false)
    await hook.run("new payload", send, success)
    expect(send.mock.calls[3][0]).not.toBe(send.mock.calls[0][0])
  })
  it.each([400, 401, 403, 404, 409])("Support 503 then %i preserves body/key through remount", async status => {
    const scope = `retry-test:${crypto.randomUUID()}`, success = vi.fn()
    harness.create.mockRejectedValueOnce(new ApiClientError("Lost", { status: 503 }))
      .mockRejectedValueOnce(new ApiClientError("Denied", { status })).mockResolvedValue({})
    const hookFactory = () => useSupportCommand(scope, success)
    let hook = render(hookFactory)
    await hook.run(submission)
    hook = render(hookFactory)
    await hook.run(structuredClone(submission))
    harness.slots = [] // New component instance; actor-scoped attempt survives.
    hook = render(hookFactory)
    expect(hook.uncertain).toBe(true)
    expect(hook.locked).toBe(true)
    expect(hook.conflict).toBe(false)
    expect(supportAttemptFor(scope).uncertain).toBe(true)
    await hook.run({ ...submission, body: { ...submission.body, subject: "Changed" } })
    expect(harness.create).toHaveBeenCalledTimes(2)
    expect(success).not.toHaveBeenCalled()
    await hook.run(submission)
    expect(harness.create.mock.calls.map(args => args.slice(0, 2))).toEqual(Array(3).fill([submission.body, harness.create.mock.calls[0][1]]))
    expect(success).toHaveBeenCalledTimes(1)
    expect(supportAttemptFor(scope).pending).toBeUndefined()
    expect(render(hookFactory).uncertain).toBe(false)
  })
  it("a first definite rejection releases its key; a first conflict remains blocked", async () => {
    const send = vi.fn().mockRejectedValueOnce(new ApiClientError("Denied", { status: 403 })).mockResolvedValue({})
    let hook = render(useRenewalCommand)
    await hook.run("old", send, vi.fn())
    hook = render(useRenewalCommand)
    expect(hook.uncertain).toBe(false)
    await hook.run("new", send, vi.fn())
    expect(send.mock.calls[1][0]).not.toBe(send.mock.calls[0][0])
    send.mockRejectedValueOnce(new ApiClientError("Stale", { status: 409 }))
    await render(useRenewalCommand).run("stale", send, vi.fn())
    expect(render(useRenewalCommand).conflict).toBe(true)
  })
})
