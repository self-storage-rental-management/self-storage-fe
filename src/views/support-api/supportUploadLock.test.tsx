import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import SupportApiWorkspace from "./SupportApiWorkspace"
import SupportCreateForm from "./SupportCreateForm"
import SupportActionForm from "./SupportActionForm"
import SupportTicketDetail from "./SupportTicketDetail"
import SupportReadState from "./SupportReadState"
import { EvidenceUpload } from "../rental-support-integration/EvidenceControls"
import { Button } from "../../components/ui"
import { ApiClientError } from "../../services/apiClient"
import { supportActor, supportActive, supportPage, supportTicket, supportIds } from "../../../tests/supportApiFixtures"

// Exercise actual event handlers and form -> detail/workspace lock propagation.
// Controlled hook lifecycle/transport; not a browser or real file-storage E2E test.
const harness = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, data: undefined as any, refresh: vi.fn(), upload: vi.fn(), role: "customer" as "customer" | "staff" }))
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: any) => {
    const slots = harness.slots, slot = harness.cursor++
    if (!(slot in slots)) slots[slot] = initial
    return [slots[slot], (next: any) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next }]
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++
    return harness.slots[slot] ??= { current: initial }
  },
  useEffect: () => undefined,
}))
vi.mock("../manager/managerPresentation", () => ({ useManagerPresentation: () => ({ manager: false, copy: (v: string) => v, errorText: () => "Test" }) }))
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => supportActor(harness.role) }))
vi.mock("../../hooks/useRentalApiResource", () => ({ useRentalApiResource: () => ({ data: harness.data, loading: false, error: undefined, refresh: harness.refresh }) }))
vi.mock("../../hooks/useSupportCommand", () => ({ useSupportCommand: () => ({ locked: false, busy: false, uncertain: false, conflict: false, run: vi.fn(), clearError: vi.fn(), retry: vi.fn() }) }))
vi.mock("../../services/duongIntegrationApi", async original => ({ ...await original<typeof import("../../services/duongIntegrationApi")>(), uploadDuongEvidence: (...args: unknown[]) => harness.upload(...args) }))
function render<T>(fn: () => T, slots: any[] = []): T { harness.slots = slots; harness.cursor = 0; return fn() }
function nodes(node: any): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== "object" || !("type" in node)) return []
  return [node, ...nodes(node.props.children), ...nodes(node.props.composer), ...nodes(node.props.internalComposer)]
}
function find(tree: unknown, type: unknown) { return nodes(tree).find(node => node.type === type)! }
beforeEach(() => { harness.refresh.mockReset(); harness.upload.mockReset(); harness.data = supportPage([supportTicket]); harness.role = "customer" })
describe("D5 upload preserves its form until response is handled", () => {
  it("blocks an empty reply and waits for upload before sending a file-only Staff message", () => {
    harness.role = "staff"
    const run = vi.fn(), formSlots: any[] = []
    const command = { run, locked: false, busy: false, conflict: false } as any
    const form = () => render(() => SupportActionForm({ role: "staff", ticket: supportActive, command, mode: "message" }), formSlots)
    const report = (tree: unknown) => nodes(tree).find(node => node.type === Button && node.props.type === 'submit')!
    let tree = form()
    expect(report(tree).props.disabled).toBe(true)
    find(tree, 'form').props.onSubmit({ preventDefault: vi.fn() })
    expect(run).not.toHaveBeenCalled()
    find(tree, EvidenceUpload).props.onBusy(true)
    find(tree, EvidenceUpload).props.onChange([supportIds.message])
    tree = form()
    expect(report(tree).props.disabled).toBe(true)
    find(tree, 'form').props.onSubmit({ preventDefault: vi.fn() })
    expect(run).not.toHaveBeenCalled()
    find(tree, EvidenceUpload).props.onBusy(false)
    tree = form()
    expect(report(tree).props.disabled).toBe(false)
    find(tree, 'form').props.onSubmit({ preventDefault: vi.fn() })
    expect(run).toHaveBeenCalledWith({ kind: "command", role: "staff", id: supportActive.id, command: {
      kind: "message", body: "", visibility: 'PUBLIC', evidenceFileIds: [supportIds.message],
    } })
  })
  it.each(["create", "message"])("%s upload prevents leaving the inline chat and reload, then retains returned file", async kind => {
    const onLocked = vi.fn(), root = SupportApiWorkspace({ role: "customer", onLocked }) as ReactElement<any>
    const sessionSlots: any[] = [], session = () => render(() => (root.type as any)(root.props), sessionSlots)
    let tree = session()
    const open = nodes(tree).find(node => kind === "create" ? node.type === Button && node.props.children === "Cuộc trò chuyện mới" : node.type === "button" && node.props["aria-label"]?.startsWith("Mở hội thoại:"))!
    open.props.onClick()
    tree = session()
    const back = nodes(tree).find(node => node.type === Button && node.props.children === "Quay lại danh sách")!
    let form = find(tree, SupportCreateForm)
    if (kind === "message") {
      const detail = find(tree, SupportTicketDetail)
      harness.data = supportTicket
      form = find(render(() => SupportTicketDetail(detail.props)), SupportActionForm)
    }
    const formSlots: any[] = [], formTree = render(() => (form.type as any)(form.props), formSlots)
    const evidence = find(formTree, EvidenceUpload)
    const uploadTree = render(() => EvidenceUpload(evidence.props))
    let finish!: (value: unknown) => void
    harness.upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const file = new File(["test-only"], "evidence.pdf")
    const pending = find(uploadTree, "input").props.onChange({ target: { files: [file], value: "file" } })
    await find(uploadTree, "input").props.onChange({ target: { files: [file], value: "file" } })
    expect(harness.upload).toHaveBeenCalledTimes(1)
    expect(onLocked).toHaveBeenLastCalledWith(true)
    // Invoke stale callbacks before a React rerender: synchronous upload ref must protect close/reload.
    back.props.onClick()
    find(tree, SupportReadState).props.retry()
    expect(harness.refresh).not.toHaveBeenCalled()
    harness.data = supportPage([supportTicket])
    tree = session()
    expect(find(tree, kind === "create" ? SupportCreateForm : SupportTicketDetail)).toBeDefined()
    expect(find(tree, kind === "create" ? SupportCreateForm : SupportTicketDetail).props.command.locked).toBe(true)
    finish({ id: supportIds.message })
    await pending
    // Message drafts are controlled by the workspace, so receive its new props
    // after the upload callback rather than rerendering with a stale draft.
    if (kind === "message") {
      tree = session()
      const detail = find(tree, SupportTicketDetail)
      harness.data = supportTicket
      form = find(render(() => SupportTicketDetail(detail.props)), SupportActionForm)
      harness.data = supportPage([supportTicket])
    }
    const updatedForm = render(() => (form.type as any)(form.props), formSlots)
    expect(find(updatedForm, EvidenceUpload).props.value).toEqual([supportIds.message])
    expect(harness.upload).toHaveBeenCalledTimes(1)
    tree = session()
    expect(find(tree, kind === "create" ? SupportCreateForm : SupportTicketDetail).props.command.locked).toBe(false)
    nodes(tree).find(node => node.type === Button && node.props.children === "Quay lại danh sách")!.props.onClick()
    expect(find(session(), kind === "create" ? SupportCreateForm : SupportTicketDetail)).toBeUndefined()
  })
  it("failed upload releases its busy lock without selecting an unconfirmed file", async () => {
    const onBusy = vi.fn(), onChange = vi.fn()
    harness.upload.mockRejectedValue(new ApiClientError("Test network failure", { status: 503 }))
    const tree = render(() => EvidenceUpload({ entityType: "DUONG_SUPPORT_PUBLIC", value: [], onBusy, onChange }))
    await find(tree, "input").props.onChange({ target: { files: [new File(["test"], "a.pdf")], value: "file" } })
    expect(onBusy.mock.calls).toEqual([[true], [false]])
    expect(onChange).not.toHaveBeenCalled()
  })
})
