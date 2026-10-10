import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import SupportApiWorkspace from "./SupportApiWorkspace"
import SupportCreateForm from "./SupportCreateForm"
import SupportActionForm from "./SupportActionForm"
import SupportTicketDetail from "./SupportTicketDetail"
import { EvidenceUpload } from "../duong-integration/EvidenceControls"
import { Button, Modal } from "../../components/ui"
import { ApiClientError } from "../../services/apiClient"
import { supportActor, supportPage, supportTicket, supportIds } from "../../../tests/supportApiFixtures"

// Exercise actual event handlers and form -> detail/workspace lock propagation.
// Controlled hook lifecycle/transport; not a browser or real file-storage E2E test.
const harness = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, data: undefined as any, refresh: vi.fn(), upload: vi.fn() }))
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
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => supportActor("customer") }))
vi.mock("../../hooks/useRentalApiResource", () => ({ useRentalApiResource: () => ({ data: harness.data, loading: false, error: undefined, refresh: harness.refresh }) }))
vi.mock("../../hooks/useSupportCommand", () => ({ useSupportCommand: () => ({ locked: false, busy: false, uncertain: false, conflict: false, run: vi.fn(), clearError: vi.fn(), retry: vi.fn() }) }))
vi.mock("../../services/duongIntegrationApi", async original => ({ ...await original<typeof import("../../services/duongIntegrationApi")>(), uploadDuongEvidence: (...args: unknown[]) => harness.upload(...args) }))
function render<T>(fn: () => T, slots: any[] = []): T { harness.slots = slots; harness.cursor = 0; return fn() }
function nodes(node: any): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== "object" || !("type" in node)) return []
  return [node, ...nodes(node.props.children)]
}
function find(tree: unknown, type: unknown) { return nodes(tree).find(node => node.type === type)! }
beforeEach(() => { harness.refresh.mockReset(); harness.upload.mockReset(); harness.data = supportPage([supportTicket]) })
describe("D5 upload preserves its form until response is handled", () => {
  it.each(["create", "message"])("%s upload prevents close and reload, then retains returned file", async kind => {
    const onLocked = vi.fn(), root = SupportApiWorkspace({ role: "customer", onLocked }) as ReactElement<any>
    const sessionSlots: any[] = [], session = () => render(() => (root.type as any)(root.props), sessionSlots)
    let tree = session()
    const open = nodes(tree).find(node => node.type === Button && node.props.children === (kind === "create" ? "Tạo yêu cầu" : "Chi tiết"))!
    open.props.onClick()
    tree = session()
    const modal = find(tree, Modal)
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
    modal.props.onClose()
    nodes(tree).find(node => node.type === Button && node.props.children === "Tải lại")!.props.onClick()
    expect(harness.refresh).not.toHaveBeenCalled()
    harness.data = supportPage([supportTicket])
    tree = session()
    expect(find(tree, Modal)).toBeDefined()
    expect(find(tree, kind === "create" ? SupportCreateForm : SupportTicketDetail).props.command.locked).toBe(true)
    finish({ id: supportIds.message })
    await pending
    const updatedForm = render(() => (form.type as any)(form.props), formSlots)
    expect(find(updatedForm, EvidenceUpload).props.value).toEqual([supportIds.message])
    expect(harness.upload).toHaveBeenCalledTimes(1)
    tree = session()
    expect(find(tree, kind === "create" ? SupportCreateForm : SupportTicketDetail).props.command.locked).toBe(false)
    find(tree, Modal).props.onClose()
    expect(find(session(), Modal)).toBeUndefined()
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
