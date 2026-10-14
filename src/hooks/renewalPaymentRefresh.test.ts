import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useRentalApiResource } from "./useRentalApiResource"
import { useRenewalPayment } from "./useRenewalPayment"
import { renewal } from "../../tests/rentalApiFixtures"

// Exercise the real hooks with controlled effects and transport, including version refreshes.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as (() => void)[], payment: vi.fn(), operations: vi.fn() }))
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: any) => {
    const i = h.cursor++
    if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial
    return [h.slots[i], (value: any) => { h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value }]
  },
  useRef: (initial: any) => h.slots[h.cursor++] ??= { current: initial },
  useCallback: (fn: any) => fn,
  useEffect: (fn: () => void | (() => void), deps: any[]) => {
    const i = h.cursor++, old = h.slots[i]
    if (!old || deps.some((v, j) => v !== old.deps[j])) {
      h.slots[i] = { deps, cleanup: undefined }
      h.effects.push(() => { old?.cleanup?.(); h.slots[i].cleanup = fn() })
    }
  },
}))
vi.mock("../services/renewalApi", () => ({
  getRenewalVnpayPayment: (...args: any[]) => h.payment(...args),
  createRenewalVnpayPaymentIntent: vi.fn(),
  renewalPaymentRedirectUrl: vi.fn(),
}))
vi.mock("../services/renewalOperationsApi", () => ({ getRenewalOperations: (...args: any[]) => h.operations(...args) }))
function render<T>(hook: () => T) {
  h.cursor = 0
  const result = hook()
  h.effects.splice(0).forEach(effect => effect())
  return result
}
beforeEach(() => {
  vi.useFakeTimers()
  h.slots = []; h.effects = []
  h.operations.mockReset().mockResolvedValue({ appointmentRef: "slot", appointmentStart: "2099-01-01T01:00:00Z" })
  h.payment.mockReset().mockResolvedValue({ paymentStatus: "PAID", settlementStage: "VERIFIED_AWAITING_ALLOCATION", reconciliationRequired: true })
  vi.stubGlobal("document", { visibilityState: "visible" })
})
afterEach(() => { h.slots.forEach(slot => slot?.cleanup?.()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

it("keeps detail mounted during same-resource refresh and hides old data when identity changes", async () => {
  let finish!: (value: string) => void
  const load = vi.fn().mockResolvedValueOnce("old detail").mockImplementation(() => new Promise<string>(resolve => { finish = resolve }))
  const hook = (id = "renewal-a") => () => useRentalApiResource(id, load, { retainDataOnRefresh: true })
  render(hook()); await vi.advanceTimersByTimeAsync(0)
  const loaded = render(hook()); expect(loaded.data).toBe("old detail")
  loaded.refresh(); render(hook())
  expect(render(hook())).toMatchObject({ data: "old detail", loading: true })
  finish("new detail"); await vi.advanceTimersByTimeAsync(0)
  expect(render(hook()).data).toBe("new detail")
  expect(render(hook("renewal-b")).data).toBeUndefined()
})

it("refreshes a paid detail once per payment change across workflow version reloads", async () => {
  const refresh = vi.fn(), record = { ...renewal, status: "accepted" as const }
  const hook = (version = record.version, id = record.id) => () => useRenewalPayment({ ...record, version, id }, true, refresh)
  render(hook()); await vi.advanceTimersByTimeAsync(0)
  expect(refresh).toHaveBeenCalledTimes(1)
  render(hook((record.version ?? 0) + 1)); await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(10_000)
  expect(refresh).toHaveBeenCalledTimes(1)
  h.payment.mockResolvedValue({ paymentStatus: "PAID", settlementStage: "AWAITING_SIGNING", reconciliationRequired: false })
  await vi.advanceTimersByTimeAsync(5_000)
  expect(refresh).toHaveBeenCalledTimes(2)
  render(hook((record.version ?? 0) + 2)); await vi.advanceTimersByTimeAsync(0)
  expect(refresh).toHaveBeenCalledTimes(2)
  render(hook(0, "other-renewal")); await vi.advanceTimersByTimeAsync(0)
  expect(refresh).toHaveBeenCalledTimes(3)
})
