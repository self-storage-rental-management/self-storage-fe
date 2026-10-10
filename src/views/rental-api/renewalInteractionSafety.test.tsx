import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import RenewalOperationsPanel from "./RenewalOperationsPanel"
import RentalApiWorkspace from "./RentalApiWorkspace"
import ApiReadState from "./ApiReadState"
import RenewalDetail from "./RenewalDetail"
import StaffPanel from "../staff/StaffRenewalOperationsApiPanel"
import RenewalCoordinationPanel from "../duong-integration/RenewalCoordinationPanel"
import { EvidenceUpload } from "../duong-integration/EvidenceControls"
import { Button, Modal } from "../../components/ui"
import { ApiClientError } from "../../services/apiClient"
import { apiPage, ids, operationEvent, operationsActor, signingState } from "../../../tests/rentalOperationsApiFixtures"

// Actual components, handlers and useRenewalCommand with a controlled hook lifecycle.
// Transport fixtures are test-only; this is not browser/DB E2E verification.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0, effects: [] as (() => void)[],
  actor: undefined as any, state: undefined as any, proposal: undefined as any,
  operationLoading: false, detail: undefined as any, staffPage: undefined as any,
  refresh: vi.fn(), send: vi.fn(), upload: vi.fn(),
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
  if (key.endsWith(":proposal")) return { ...h.proposal, refresh: h.refresh }
  if (key.includes(":renewal:")) return { data: h.detail, loading: false, refresh: h.refresh }
  if (key.includes(':"size":20') || key.includes('{"page":0,"size":20}')) return { data: h.staffPage, loading: false, refresh: h.refresh }
  if (/:(statement|incidents:|coordination:|assignment:|counts|rental:)/.test(key)) return { loading: false, refresh: h.refresh }
  return { data: h.operationLoading ? undefined : h.state, loading: h.operationLoading, refresh: h.refresh }
} }))
vi.mock("../../services/renewalOperationsApi", async original => ({ ...await original<typeof import("../../services/renewalOperationsApi")>(), sendRenewalOperation: (...args: unknown[]) => h.send(...args) }))
vi.mock("../../services/duongIntegrationApi", async original => ({
  ...await original<typeof import("../../services/duongIntegrationApi")>(),
  uploadDuongEvidence: (...args: unknown[]) => h.upload(...args),
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
  h.operationLoading = false; h.detail = undefined; h.staffPage = undefined
  h.refresh.mockReset(); h.send.mockReset(); h.upload.mockReset()
})

describe("D3 form identity and original retry request", () => {
  it("retains form, body and idempotency key across late proposal/read responses and blocks stale reload/cancel", async () => {
    const parentLock = vi.fn(), slots: any[] = []
    const panel = () => render(() => RenewalOperationsPanel({ id: ids.renewal, role: "customer", customerId: ids.customer, onLocked: parentLock }), slots)
    let tree = panel()
    const reload = button(tree, "Tải lại tiến độ")
    const proposalRetry = nodes(tree).filter(n => n.type === ApiReadState)[1]
    const open = button(tree, "Đổi lịch ký")
    expect(open.props.disabled).toBe(false)
    open.props.onClick()
    const original = form(panel()), formSlots: any[] = []
    let fields = invoke(original, formSlots)
    const delayedMountEffects = [...h.effects]
    find(fields, "textarea").props.onChange({ target: { value: "Lý do đổi lịch" } })
    nodes(fields).find(n => n.type === "input" && n.props.type === "datetime-local")!.props.onChange({ target: { value: "2026-10-11T09:00" } })
    fields = invoke(original, formSlots, true)
    const cancel = button(fields, "Đóng biểu mẫu")
    h.send.mockRejectedValueOnce(new ApiClientError("Uncertain result", { status: 503 }))
    button(fields, "Gửi yêu cầu").props.onClick()
    delayedMountEffects.forEach(effect => effect())
    // Stale closures must already be guarded before effects/React rerender.
    proposalRetry.props.retry(); reload.props.onClick(); cancel.props.onClick(); open.props.onClick()
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
    find(fields, "textarea").props.onChange({ target: { value: "Nội dung khác" } })
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
      find(fields, "input").props.onChange({ target: { value: ids.staff } })
      find(fields, "textarea").props.onChange({ target: { value: "Phân công nhân viên" } })
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
      const session = StaffPanel() as ReactElement<any>, workspace = invoke(session)
      owner = () => invoke(workspace, ownerSlots)
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
      const initial = invoke(child, childSlots)
      nodes(initial).find(n => n.type === "select" && n.props.value === "assignment")!.props.onChange({ target: { value: "fault" } })
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
      button(before, "Tải lại").props.onClick()
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
