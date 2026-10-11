import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import type { ApiActor } from "../../services/authApi"
import { manager, page } from "../../../tests/rentalApiFixtures"
import { Button } from "../../components/ui"
import RentalApiWorkspace from "../rental-api/RentalApiWorkspace"
import SupportApiWorkspace from "../support-api/SupportApiWorkspace"
import ApiPager from "../rental-api/ApiPager"
import ManagerOverdueApiPanel from "./ManagerOverdueApiPanel"
import ManagerFinancialApiPanel from "./ManagerFinancialApiPanel"
import ManagerInventoryApiPanel from "./ManagerInventoryApiPanel"
import ManagerFacilityCatalog from "./ManagerFacilityCatalog"
import ManagerPagination from "./ManagerPagination"
import { managerFacilityNotice, singleManagerFacility } from "./managerFacilityUi"

// Controlled component lifecycle and transport spies, not browser/DB E2E.
const h = vi.hoisted(() => ({
  actor: null as ApiActor | null,
  slots: [] as unknown[], cursor: 0,
  loaders: [] as (() => Promise<unknown>)[],
  rental: vi.fn(), renewal: vi.fn(), support: vi.fn(), overdue: vi.fn(), financial: vi.fn(),
}))
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const slots = h.slots, index = h.cursor++
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
    return [slots[index], (next: unknown) => {
      slots[index] = typeof next === "function" ? next(slots[index]) : next
    }]
  },
  useRef: (value: unknown) => {
    const index = h.cursor++
    return h.slots[index] ??= { current: value }
  },
  useEffect: () => {},
}))
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => h.actor }))
vi.mock("./managerPresentation", () => ({
  useManagerPresentation: () => ({ manager: false, copy: (s: string) => s, errorText: () => "Lỗi" }),
  managerDisplayError: () => "Lỗi", managerDisplayText: (s: string) => s,
}))
vi.mock("../../hooks/useSupportCommand", () => ({ useSupportCommand: () => ({ locked: false, clearError: vi.fn() }) }))
vi.mock("../../services/rentalApi", async original => ({
  ...await original<typeof import("../../services/rentalApi")>(), listRentals: (...args: unknown[]) => h.rental(...args),
}))
vi.mock("../../services/renewalApi", async original => ({
  ...await original<typeof import("../../services/renewalApi")>(), listRenewals: (...args: unknown[]) => h.renewal(...args),
}))
vi.mock("../../services/supportApi", async original => ({
  ...await original<typeof import("../../services/supportApi")>(), listSupportTickets: (...args: unknown[]) => h.support(...args),
}))
vi.mock("../../services/overdueApi", async original => ({
  ...await original<typeof import("../../services/overdueApi")>(), listOverdueCases: (...args: unknown[]) => h.overdue(...args),
}))
vi.mock("./managerD1D5Api", async original => ({
  ...await original<typeof import("./managerD1D5Api")>(), loadManagerRentalPage: (...args: unknown[]) => h.financial(...args),
}))
vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: (identity: string, loader: () => Promise<unknown>) => {
    h.loaders.push(loader)
    const pagination = { page: 0, pageSize: 10, totalItems: 21, totalPages: 3 }
    return { loading: false, refresh: vi.fn(), data: identity.endsWith(":counts") ? [0, 0, 0, 0]
      : identity.includes(":rental:") || identity.includes(":renewal:")
        ? { kind: identity.includes(":rental:") ? "rental" : "renewal", page: { data: [], pagination } }
        : { data: [], pagination, completeness: "COMPLETE", missingSources: [], asOf: "2026-10-10T00:00:00Z" } }
  },
}))

type Element = ReactElement<any>
function render(fn: () => Element, slots: unknown[] = []) {
  h.slots = slots; h.cursor = 0; h.loaders = []
  return fn()
}
function invoke(element: Element, slots: unknown[] = []) {
  return render(() => (element.type as (props: unknown) => Element)(element.props), slots)
}
function nodes(node: any): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== "object" || !("type" in node)) return []
  return [node, ...nodes(node.props.children)]
}
function text(node: any): string {
  if (Array.isArray(node)) return node.map(text).join(" ")
  if (typeof node === "string" || typeof node === "number") return String(node)
  return node?.props ? text(node.props.children) : ""
}
const named = (tree: Element, name: string) => nodes(tree).find(n => typeof n.type === "function" && n.type.name === name)!
const label = (tree: Element, name: string) => nodes(tree).find(n => n.type === "label" && text(n).includes(name))!
const control = (tree: Element, type: string) => nodes(tree).find(n => n.type === type)!
const byText = (tree: Element, value: string) => nodes(tree).find(n => n.type === Button && n.props.children === value)!
const load = async () => { for (const fn of h.loaders) await fn() }

beforeEach(() => {
  h.actor = { ...manager, permissions: [...manager.permissions, "support:read"] }
  h.slots = []; h.cursor = 0; h.loaders = []
  for (const mock of [h.rental, h.renewal, h.support, h.overdue, h.financial]) mock.mockReset().mockResolvedValue(page([]))
})

describe("single assigned Manager facility", () => {
  const ambiguousActors: (Pick<ApiActor, "facilityScopes"> | null)[] = [
    null, { facilityScopes: {} }, { facilityScopes: { f1: "READ", f2: "MANAGE" } },
  ]
  it.each(["READ", "OPERATE", "MANAGE"] as const)("accepts one %s scope without changing permissions", level => {
    expect(singleManagerFacility({ facilityScopes: { f1: level } })).toBe("f1")
  })
  it.each(ambiguousActors)("does not select an arbitrary facility for %j", actor => {
    expect(singleManagerFacility(actor)).toBeUndefined()
    expect(managerFacilityNotice(actor)).toContain(actor && Object.keys(actor.facilityScopes).length > 1 ? "nhiều cơ sở" : "chưa được phân công")
  })
  it.each(["rentals", "support", "overdue", "financial", "inventory", "catalog"])("blocks %s reads for multiple assignments", screen => {
    h.actor = { ...h.actor!, facilityScopes: { f1: "MANAGE", f2: "READ" } }
    let tree: Element
    if (screen === "rentals") tree = invoke(render(() => RentalApiWorkspace({ role: "manager" })))
    else if (screen === "support") tree = render(() => SupportApiWorkspace({ role: "manager" }))
    else if (screen === "overdue") tree = render(() => ManagerOverdueApiPanel())
    else if (screen === "financial") tree = render(() => ManagerFinancialApiPanel({ setPage: vi.fn() }))
    else if (screen === "inventory") tree = render(() => ManagerInventoryApiPanel())
    else tree = render(() => ManagerFacilityCatalog())
    expect(text(tree)).toContain("nhiều cơ sở")
    expect(h.loaders).toHaveLength(0)
    expect(nodes(tree).some(n => n.type === "select")).toBe(false)
  })
})

describe("Manager rental and renewal filters", () => {
  function workspace(role: "manager" | "customer" = "manager") {
    const outer = render(() => RentalApiWorkspace({ role }))
    const slots: unknown[] = []
    const session = () => invoke(outer, slots)
    const data = () => invoke(session())
    return { session, data }
  }
  it("uses 10 records and the assigned facility for both tabs and preserves scope in totals", async () => {
    const w = workspace()
    let tree = w.data()
    await load()
    expect(h.rental).toHaveBeenCalledWith("manager", expect.objectContaining({ size: 10, facilityId: "f1" }))
    expect(h.rental.mock.calls.every(([, q]) => q.facilityId === "f1")).toBe(true)
    expect(h.renewal.mock.calls.every(([, q]) => q.facilityId === "f1")).toBe(true)
    byText(tree, "Yêu cầu gia hạn").props.onClick()
    tree = w.data(); await load()
    expect(h.renewal).toHaveBeenCalledWith("manager", expect.objectContaining({ size: 10, facilityId: "f1" }))
    expect(text(tree)).not.toContain("Tất cả cơ sở")
  })
  it("keeps the previous/next buttons without a Manager size selector", async () => {
    const w = workspace(), tree = w.data()
    const pager = invoke(named(tree, "Pager"))
    expect(nodes(pager).some(n => n.type === "select")).toBe(false)
    expect(byText(pager, "Trước").props.disabled).toBe(true)
    byText(pager, "Sau").props.onClick()
    w.data(); await load()
    expect(h.rental).toHaveBeenCalledWith("manager", expect.objectContaining({ page: 1, size: 10, facilityId: "f1" }))
  })
  it("renames expiry labels while retaining endFrom/endTo and sort request fields", async () => {
    const w = workspace()
    let tree = w.data()
    expect(text(tree)).toContain("Hết hạn trong 30 ngày")
    expect(text(tree)).not.toContain("kết thúc đã lưu")
    control(label(tree, "Ngày hết hạn từ"), "input").props.onChange({ target: { value: "2026-11-01" } })
    tree = w.data()
    control(label(tree, "Ngày hết hạn đến"), "input").props.onChange({ target: { value: "2026-11-30" } })
    tree = w.data()
    control(label(tree, "Sắp xếp"), "select").props.onChange({ target: { value: "contractEndDate,asc" } })
    w.data(); await load()
    expect(h.rental).toHaveBeenCalledWith("manager", expect.objectContaining({ facilityId: "f1", size: 10,
      endFrom: "2026-11-01", endTo: "2026-11-30", sort: "contractEndDate,asc" }))
  })
  it("keeps the Customer page size and its selector unchanged", async () => {
    h.actor = { ...manager, roles: ["CUSTOMER"], facilityScopes: {} }
    const w = workspace("customer"), tree = w.data()
    await load()
    expect(h.rental).toHaveBeenCalledWith("customer", expect.objectContaining({ size: 20, facilityId: undefined }))
    const pager = invoke(named(tree, "Pager"))
    expect(named(tree, "Pager").props.fixedSize).toBe(false)
    expect(nodes(pager).filter(n => n.type === "option").map(n => n.props.value)).toEqual([10, 20, 50])
  })
})

describe("Support and overdue pagination", () => {
  function support(role: "manager" | "staff" | "customer") {
    const outer = render(() => SupportApiWorkspace({ role })), slots: unknown[] = []
    return () => invoke(outer, slots)
  }
  it("retains the Manager facility and size after reset and page navigation", async () => {
    const renderSupport = support("manager")
    let tree = renderSupport(); await load()
    expect(h.support).toHaveBeenLastCalledWith("manager", expect.objectContaining({ facilityId: "f1", size: 10 }))
    expect(text(tree)).not.toContain("Cơ sở được cấp quyền")
    expect(text(tree)).not.toContain("Số yêu cầu / trang")
    control(label(tree, "Trạng thái"), "select").props.onChange({ target: { value: "open" } })
    tree = renderSupport()
    byText(tree, "Xóa bộ lọc").props.onClick()
    tree = renderSupport(); await load()
    expect(h.support).toHaveBeenLastCalledWith("manager", { page: 0, size: 10, facilityId: "f1", sort: "createdAt,desc" })
    nodes(tree).find(n => n.type === ApiPager)!.props.onPage(1)
    renderSupport(); await load()
    expect(h.support).toHaveBeenLastCalledWith("manager", expect.objectContaining({ page: 1, size: 10, facilityId: "f1" }))
  })
  it.each(["customer", "staff"] as const)("does not remove %s pagination options or force a Manager scope", async role => {
    h.actor = { ...h.actor!, roles: [role === "customer" ? "CUSTOMER" : "STAFF"], permissions: ["support:read", "support:update"] }
    const tree = support(role)(); await load()
    expect(text(tree)).toContain("Số yêu cầu / trang")
    expect(h.support).toHaveBeenLastCalledWith(role, expect.objectContaining({ size: 20, facilityId: undefined }))
  })
  it("keeps overdue categories separate and preserves fixed scope on filtering and paging", async () => {
    const outer = render(() => ManagerOverdueApiPanel()), slots: unknown[] = []
    const rerender = () => invoke(outer, slots)
    let tree = rerender(); await load()
    expect(h.overdue).toHaveBeenLastCalledWith(expect.objectContaining({ size: 10, facilityId: "f1", kind: "ALL" }))
    expect(text(tree)).not.toContain("Các cơ sở được đọc")
    expect(text(tree)).not.toContain("Số hồ sơ")
    expect(text(tree)).toContain("Quá hạn thanh toán")
    expect(text(tree)).toContain("Quá thời hạn thuê")
    control(label(tree, "Loại"), "select").props.onChange({ target: { value: "PAYMENT_DUE" } })
    tree = rerender()
    nodes(tree).find(n => n.type === ApiPager)!.props.onPage(1)
    rerender(); await load()
    expect(h.overdue).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 10, facilityId: "f1", kind: "PAYMENT_DUE" }))
  })
  it("uses 10 records and an explicit scope on the financial list", async () => {
    const outer = render(() => ManagerFinancialApiPanel({ setPage: vi.fn() }))
    invoke(outer); await load()
    expect(h.financial).toHaveBeenLastCalledWith(h.actor, expect.objectContaining({ size: 10, facilityId: "f1" }))
  })
  it("keeps record range and page navigation on legacy Manager lists without a size control", () => {
    const onPageChange = vi.fn()
    const tree = render(() => ManagerPagination({ page: 2, pageCount: 3, total: 21, pageSize: 10, onPageChange })!)
    expect(text(tree)).toMatch(/11\s*-\s*20/)
    expect(text(tree)).toMatch(/Trang\s+2\s*\/\s*3/)
    expect(nodes(tree).some(n => n.type === "select")).toBe(false)
    byText(tree, "Sau").props.onClick()
    expect(onPageChange).toHaveBeenLastCalledWith(3)
  })
})
