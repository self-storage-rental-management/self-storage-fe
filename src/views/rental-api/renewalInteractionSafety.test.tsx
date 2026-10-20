import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import RenewalOperationsPanel from "./RenewalOperationsPanel"
import RenewalDepositSettlementPanel from "./RenewalDepositSettlementPanel"
import RentalApiWorkspace from "./RentalApiWorkspace"
import ApiReadState from "./ApiReadState"
import RenewalDetail from "./RenewalDetail"
import StaffPanel from "../staff/StaffRenewalOperationsApiPanel"
import RenewalCoordinationPanel from "../rental-support-integration/RenewalCoordinationPanel"
import { EvidenceUpload, EvidenceDownload } from "../rental-support-integration/EvidenceControls"
import { Button, Modal } from "../../components/ui"
import { ApiClientError } from "../../services/apiClient"
import { apiPage, ids, operationEvent, operationsActor, signingState } from "../../../tests/rentalOperationsApiFixtures"

// Actual components, handlers and useRenewalCommand with a controlled hook lifecycle.
// Transport fixtures are test-only; this is not browser/DB E2E verification.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0, effects: [] as (() => void)[],
  actor: undefined as any, state: undefined as any, proposal: undefined as any,
  operationLoading: false, detail: undefined as any, staffPage: undefined as any, settlement: undefined as any,
  refresh: vi.fn(), send: vi.fn(), upload: vi.fn(), download: vi.fn(),
}))
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: any) => {
    const slots = h.slots, slot = h.cursor++
    if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial
    return [slots[slot], (next: any) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next }]
  },
  useRef: (initial: any) => { const slot = h.cursor++; return h.slots[slot] ??= { current: initial } },
  useCallback: (fn: any, deps: any[]) => {
    const slot = h.cursor++, prev = h.slots[slot]
    if (!prev || deps.some((v, i) => v !== prev.deps[i])) h.slots[slot] = { fn, deps }
    return h.slots[slot].fn
  },
  useEffect: (fn: () => void, deps: any[]) => {
    const slot = h.cursor++, prev = h.slots[slot]
    if (!prev || deps.some((v, i) => v !== prev[i])) { h.slots[slot] = deps; h.effects.push(fn) }
  },
}))
vi.mock("../manager/managerPresentation", () => ({ useManagerPresentation: () => ({ manager: false, copy: (s: string) => s, errorText: () => "Lỗi thử nghiệm" }) }))
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => h.actor }))
vi.mock("../../hooks/useRentalApiResource", () => ({ useRentalApiResource: (key: string) => {
  if (key.endsWith(':payment-events')) return { data: apiPage([]), loading: false, refresh: h.refresh }
  if (key.includes(":deposit-settlement:")) return { data: h.settlement, loading: false, refresh: h.refresh }
  if (key.endsWith(":proposal")) return { ...h.proposal, refresh: h.refresh }
  if (key.includes(":renewal:")) return { data: h.detail, loading: false, refresh: h.refresh }
  if (key.includes(':"size":20') || key.includes('{"page":0,"size":20}')) return { data: h.staffPage, loading: false, refresh: h.refresh }
  if (key.includes(":coordination:")) return { data: apiPage([{ ...operationEvent, kind: "INCIDENT" }]), loading: false, refresh: h.refresh }
  if (/:(statement|incidents:|assignment:|counts|rental:)/.test(key)) return { loading: false, refresh: h.refresh }
  return { data: h.operationLoading ? undefined : h.state, loading: h.operationLoading, refresh: h.refresh }
} }))
vi.mock("../../services/renewalOperationsApi", async original => ({ ...await original<typeof import("../../services/renewalOperationsApi")>(), sendRenewalOperation: (...args: unknown[]) => h.send(...args) }))
vi.mock("../../services/renewalDepositSettlementApi", async original => ({ ...await original<typeof import("../../services/renewalDepositSettlementApi")>(), executeDepositRefund: (...args: unknown[]) => h.send(...args) }))
vi.mock("../../services/duongIntegrationApi", async original => ({
  ...await original<typeof import("../../services/duongIntegrationApi")>(),
  uploadDuongEvidence: (...args: unknown[]) => h.upload(...args),
  downloadDuongEvidence: (...args: unknown[]) => h.download(...args),
  coordinateRenewal: (...args: unknown[]) => h.send(...args),
}))

function render<T>(fn: () => T, slots: any[] = [], effects = false): T {
  h.slots = slots; h.cursor = 0; h.effects = []
  const tree = fn()
  if (effects) h.effects.forEach(fn => fn())
  return tree
}
function nodes(node: any): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== "object" || !("type" in node)) return []
  return [node, ...nodes(node.props.children)]
}
const find = (tree: unknown, type: unknown) => nodes(tree).find(n => n.type === type)!
const button = (tree: unknown, text: string) => nodes(tree).find(n => n.type === Button && n.props.children === text)!
const form = (tree: unknown) => nodes(tree).find(n => typeof n.type === "function" && n.type.name === "OperationForm")!
const invoke = (element: ReactElement<any>, slots: any[] = [], effects = false) => render(() => (element.type as any)(element.props), slots, effects)
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  h.actor = operationsActor("customer")
  h.state = { ...signingState, pendingExceptionRef: ids.file }
  h.proposal = { loading: false, error: new ApiClientError("proposal unavailable", { status: 503 }) }
  h.operationLoading = false; h.detail = undefined; h.staffPage = undefined; h.settlement = undefined
  h.refresh.mockReset(); h.send.mockReset(); h.upload.mockReset(); h.download.mockReset()
})

describe("Deposit refund command safety", () => {
  function approved() {
    h.actor = { ...operationsActor("manager"), permissions: ["rentals:read", "rentals:update", "payments:collect"] }
    h.settlement = { renewalId: ids.renewal, expectedVersion: 4, status: "REFUND_APPROVED", amount: 40, refundedAmount: 0, currency: "VND", environment: "SANDBOX", refundId: ids.event, signingDeadline: signingState.effectiveSigningDeadline, checkedAt: operationEvent.occurredAt }
  }
  function ready(panel: () => ReactElement<any> | null) {
    const tree = panel()
    nodes(tree).find(n => n.type === "input" && n.props.type !== "checkbox")!.props.onChange({ target: { value: "sandbox-refund-proof" } })
    find(tree,EvidenceUpload).props.onChange([ids.file])
    nodes(tree).find(n => n.type === "input" && n.props.type === "checkbox")!.props.onChange({ target: { checked: true } })
  }
  it("unlocks immediately after a known denial and sends no client amount", async () => {
    approved()
    const slots: any[] = [], onLocked = vi.fn()
    const panel = () => render(() => RenewalDepositSettlementPanel({ id: ids.renewal, role: "manager", revision: 4, onLocked, onChanged: vi.fn() }),slots)
    ready(panel)
    h.send.mockRejectedValueOnce(new ApiClientError("denied",{ status: 400 }))
    const click = button(panel(),"Xác nhận đã hoàn cọc").props.onClick
    click(); click()
    expect(onLocked).toHaveBeenLastCalledWith(true)
    await settle()
    expect(h.send).toHaveBeenCalledOnce()
    expect(h.send.mock.calls[0][1]).not.toHaveProperty("amount")
    expect(onLocked).toHaveBeenLastCalledWith(false)
  })
  it("retains the original refund body and key after uncertain results", async () => {
    approved()
    const slots: any[] = [], onLocked = vi.fn()
    const panel = () => render(() => RenewalDepositSettlementPanel({ id: ids.renewal, role: "manager", revision: 4, onLocked, onChanged: vi.fn() }),slots)
    ready(panel)
    h.send.mockRejectedValueOnce(new ApiClientError("unknown",{ status: 503 }))
    button(panel(),"Xác nhận đã hoàn cọc").props.onClick()
    await settle()
    const original = h.send.mock.calls[0]
    expect(onLocked).toHaveBeenLastCalledWith(true)
    h.settlement = { ...h.settlement, expectedVersion: 9 }
    const tree = panel()
    expect(find(tree,"fieldset").props.disabled).toBe(true)
    h.send.mockResolvedValueOnce({ event: operationEvent })
    button(tree,"Thử lại cùng yêu cầu").props.onClick()
    await settle()
    expect(h.send.mock.calls[1]).toEqual(original)
    expect(onLocked).toHaveBeenLastCalledWith(false)
  })
})

describe("Evidence download request safety", () => {
  it("blocks repeated clicks before rerender and unlocks after a denied download", async () => {
    const slots: any[] = []
    const view = () => render(() => EvidenceDownload({ id: ids.file }), slots)
    let reject!: (reason: unknown) => void
    h.download.mockImplementation(() => new Promise((_, fail) => { reject = fail }))
    const click = find(view(), Button).props.onClick
    const first = click()
    await click()
    expect(h.download).toHaveBeenCalledTimes(1)
    expect(h.download).toHaveBeenCalledWith(ids.file)
    expect(find(view(), Button).props.disabled).toBe(true)
    reject(new ApiClientError("denied-file-private-detail", { status: 404 }))
    await first
    expect(find(view(), Button).props.disabled).toBe(false)
    h.download.mockRejectedValue(new ApiClientError("scope-revoked", { status: 403 }))
    await find(view(), Button).props.onClick()
    expect(h.download).toHaveBeenCalledTimes(2)
    expect(find(view(), Button).props.disabled).toBe(false)
    expect(JSON.stringify(view())).not.toContain("scope-revoked")
  })
})

describe("D3 form identity and original retry request", () => {
  it("retains form, body and idempotency key across late proposal/read responses and blocks stale reload/cancel", async () => {
    const parentLock = vi.fn(), slots: any[] = []
    const panel = () => render(() => RenewalOperationsPanel({ id: ids.renewal, role: "customer", customerId: ids.customer, onLocked: parentLock }), slots)
    let tree = panel()
    const proposalRetry = nodes(tree).filter(n => n.type === ApiReadState)[1]
    const open = button(tree, "Đổi lịch ký")
    expect(open.props.disabled).toBe(false)
    open.props.onClick()
    const original = form(panel()), formSlots: any[] = []
    let fields = invoke(original, formSlots)
    const delayedMountEffects = [...h.effects]
    expect(nodes(fields).some(n => n.type === "textarea")).toBe(false)
    const picker = nodes(fields).find(n => typeof n.type === "function" && n.type.name === "RenewalAppointmentPicker")!
    picker.props.onChange("2026-10-11T09:00")
    picker.props.onReadyChange(true)
    fields = invoke(original, formSlots, true)
    expect(button(fields, "Đóng biểu mẫu")).toBeUndefined()
    h.send.mockRejectedValueOnce(new ApiClientError("Uncertain result", { status: 503 }))
    button(fields, "Lưu lịch ký").props.onClick()
    delayedMountEffects.forEach(effect => effect())
    // Stale closures must already be guarded before effects/React rerender.
    proposalRetry.props.retry(); open.props.onClick()
    expect(h.refresh).not.toHaveBeenCalled()
    expect(parentLock).toHaveBeenLastCalledWith(true)
    await settle()
    fields = invoke(original, formSlots, true)
    expect(button(fields, "Thử lại cùng yêu cầu")).toBeDefined()
    const sent = h.send.mock.calls[0]
    h.proposal = { loading: false, data: { decisionRef: ids.event, expectedVersion: 9 } }
    h.state = { ...h.state, expectedVersion: 9 }
    let retained = form(panel())
    expect(retained.key).toBe(original.key)
    expect(retained.props.state.expectedVersion).toBe(4)
    expect(retained.props.proposal).toBeUndefined()
    h.operationLoading = true
    retained = form(panel())
    expect(retained.key).toBe(original.key)
    fields = invoke(retained, formSlots, true)
    // Even a stale input callback cannot replace the original uncertain request.
    picker.props.onChange("2026-10-11T10:00")
    h.send.mockResolvedValueOnce({ event: operationEvent })
    fields = invoke(retained, formSlots, true)
    button(fields, "Thử lại cùng yêu cầu").props.onClick()
    await settle()
    expect(h.send.mock.calls[1]).toEqual(sent)
    expect(form(panel())).toBeUndefined()
    expect(parentLock).toHaveBeenLastCalledWith(false)
  })

  it("allows proposal reload before selecting an action", () => {
    const tree = render(() => RenewalOperationsPanel({ id: ids.renewal, role: "customer", customerId: ids.customer }))
    nodes(tree).filter(n => n.type === ApiReadState)[1].props.retry()
    expect(h.refresh).toHaveBeenCalledTimes(2)
  })

  it.each(["operation", "coordination"])("%s releases a fast known rejection without requiring a busy render/effect", async kind => {
    const onLocked = vi.fn(), slots: any[] = []
    let selected: ReactElement<any>
    if (kind === "coordination") {
      h.actor = operationsActor("manager")
      selected = <RenewalCoordinationPanel state={h.state} facilityId={ids.facility} status="approved" onLocked={onLocked} onChanged={vi.fn()} />
    } else {
      h.actor = operationsActor("staff")
      const panelSlots: any[] = []
      const panel = () => render(() => RenewalOperationsPanel({ id: ids.renewal, role: "staff", onLocked }), panelSlots)
      button(panel(), "Ghi nhận khách đến").props.onClick()
      selected = form(panel())
    }
    let fields = invoke(selected, slots)
    if (kind === "coordination") {
      const selects = nodes(fields).filter(n => n.type === "select")
      selects[0].props.onChange({ target: { value: ids.event } })
      selects[1].props.onChange({ target: { value: "true" } })
      find(fields, "textarea").props.onChange({ target: { value: "Đã xác minh sự cố" } })
      fields = invoke(selected, slots)
    }
    h.send.mockRejectedValue(new ApiClientError("known rejection", { status: 400 }))
    if (kind === "coordination") find(fields, "form").props.onSubmit({ preventDefault: vi.fn() })
    else button(fields, "Gửi yêu cầu").props.onClick()
    expect(onLocked).toHaveBeenLastCalledWith(true)
    await settle()
    expect(h.send).toHaveBeenCalledOnce()
    expect(onLocked).toHaveBeenLastCalledWith(false)
  })
})

function detailElement(role: "customer" | "manager") {
  const session = RentalApiWorkspace({ role }) as ReactElement<any>
  const data = invoke(session)
  // Reach the real private detail component through the workspace's JSX, without exporting it for tests.
  h.operationLoading = true
  const tree = render(() => (data.type as any)({ ...data.props, detail: { kind: "renewal", id: ids.renewal } }))
  return nodes(tree).find(n => typeof n.type === "function" && n.type.name === "DetailModal")!
}

describe("D3 upload synchronously protects its owning modal", () => {
  it.each(["customer", "manager", "staff"] as const)("%s operation/upload lock blocks stale modal callbacks; confirmed file is retained when uploaded", async role => {
    h.actor = operationsActor(role)
    let ownerSlots: any[] = [], owner: () => ReactElement<any>, panelElement: ReactElement<any>
    let close: ReturnType<typeof vi.fn> | undefined, action: ReturnType<typeof vi.fn> | undefined
    if (role === "staff") {
      h.staffPage = apiPage([h.state])
      const session = StaffPanel() as ReactElement<any>, workspace = invoke(session), tabs = invoke(workspace)
      const staffSession = nodes(tabs).find(n => typeof n.type === "function" && n.type.name === "StaffSession")!
      owner = () => invoke(staffSession, ownerSlots)
      button(owner(), "Xử lý").props.onClick()
      panelElement = find(owner(), RenewalOperationsPanel)
    } else {
      const originalDetail = detailElement(role)
      close = vi.fn(); action = vi.fn()
      const detail = { ...originalDetail, props: { ...originalDetail.props, onClose: close, onAction: action } }
      h.operationLoading = false
      h.detail = { kind: "renewal", record: { facility: { id: ids.facility }, customer: { id: ids.customer }, status: "approved" } }
      owner = () => invoke(detail, ownerSlots, true)
      owner(); panelElement = find(owner(), RenewalOperationsPanel)
    }
    const before = owner(), modal = find(before, Modal), panelSlots: any[] = []
    const panel = () => invoke(panelElement, panelSlots)
    let child: ReactElement<any>, childSlots: any[] = []
    if (role === "manager") {
      child = find(panel(), RenewalCoordinationPanel)
    } else {
      const tree = panel()
      button(tree, role === "staff" ? "Ghi nhận khách đến" : "Đổi lịch ký").props.onClick()
      child = form(panel())
      if (role === "customer") {
        // Customer does not upload in this form: test the immediate command-lock propagation instead.
        child.props.onLocked(true)
        modal.props.onClose()
        expect(close).not.toHaveBeenCalled()
        find(before, ApiReadState).props.retry()
        expect(h.refresh).not.toHaveBeenCalled()
        find(before, RenewalDetail).props.onAction("CANCEL")
        expect(action).not.toHaveBeenCalled()
        child.props.onLocked(false)
        modal.props.onClose()
        expect(close).toHaveBeenCalledOnce()
        return
      }
    }
    const fields = invoke(child, childSlots), delayedMountEffects = [...h.effects]
    const upload = find(fields, EvidenceUpload), uploadSlots: any[] = []
    const uploadTree = invoke(upload, uploadSlots)
    let finish!: (value: unknown) => void
    h.upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const input = find(uploadTree, "input")
    const pending = input.props.onChange({ target: { files: [new File(["test-only"], "proof.pdf")], value: "file" } })
    delayedMountEffects.forEach(effect => effect())
    modal.props.onClose()
    if (role === "staff") {
      find(before, "select").props.onChange({ target: { value: "other" } })
      expect(find(owner(), Modal)).toBeDefined()
    } else {
      expect(close).not.toHaveBeenCalled()
      find(before, ApiReadState).props.retry()
      find(before, RenewalDetail).props.onAction("CANCEL")
      expect(action).not.toHaveBeenCalled()
    }
    expect(h.refresh).not.toHaveBeenCalled()
    expect(find(invoke(child, childSlots), "fieldset").props.disabled).toBe(true)
    finish({ id: ids.file }); await pending
    expect(find(invoke(child, childSlots), EvidenceUpload).props.value).toEqual([ids.file])
    modal.props.onClose()
    if (role === "staff") expect(find(owner(), Modal)).toBeUndefined()
    else expect(close).toHaveBeenCalledOnce()
  })

  it("failed Staff upload unlocks without adding an unconfirmed evidence reference", async () => {
    h.actor = operationsActor("staff")
    const slots: any[] = [], lock = vi.fn()
    const tree = render(() => RenewalOperationsPanel({ id: ids.renewal, role: "staff", onLocked: lock }), slots)
    button(tree, "Ghi nhận khách đến").props.onClick()
    const selected = form(render(() => RenewalOperationsPanel({ id: ids.renewal, role: "staff", onLocked: lock }), slots))
    const childSlots: any[] = [], evidence = find(invoke(selected, childSlots), EvidenceUpload)
    h.upload.mockRejectedValue(new ApiClientError("upload failure", { status: 503 }))
    const upload = invoke(evidence)
    await find(upload, "input").props.onChange({ target: { files: [new File(["test"], "proof.pdf")], value: "file" } })
    expect(lock.mock.calls.slice(-2)).toEqual([[true], [false]])
    expect(find(invoke(selected, childSlots), EvidenceUpload).props.value).toEqual([])
    expect(h.send).not.toHaveBeenCalled()
  })
})
