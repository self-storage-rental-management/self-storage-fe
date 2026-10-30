import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiActor } from "../../services/authApi"
import type { useSupportCommand } from "../../hooks/useSupportCommand"
import { ApiClientError } from "../../services/apiClient"
import { page } from "../../../tests/rentalApiFixtures"
import { ids, operationState, operationsActor } from "../../../tests/rentalOperationsApiFixtures"
import { supportActor, supportIds, supportTicket } from "../../../tests/supportApiFixtures"
import RentalApiWorkspace from "./RentalApiWorkspace"
import RenewalOperationsPanel from "./RenewalOperationsPanel"
import CustomerRenewalRequestModal from "../customer/CustomerRenewalRequestModal"
import StaffRenewalOperationsApiPanel from "../staff/StaffRenewalOperationsApiPanel"
import SupportApiWorkspace from "../support-api/SupportApiWorkspace"
import SupportCreateForm from "../support-api/SupportCreateForm"
import SupportStaffPicker from "../support-api/SupportStaffPicker"
import SupportTicketDetail from "../support-api/SupportTicketDetail"

// Test-only API results; no fixture is imported by runtime presentation.
const state = vi.hoisted(() => ({
  actor: null as ApiActor | null,
  mode: "page" as "page" | "rental" | "options" | "operations" | "ticket",
  loading: false,
  error: undefined as unknown,
}))
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock('../../hooks/useSupportMessageReads', () => ({ useSupportUnread: () => new Map(), useSupportMessageReads: () => {} }))
vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: (key: string) => ({
    loading: state.loading,
    error: state.error,
    refresh: vi.fn(),
    data: state.loading || state.error ? undefined
      : key.includes(':staff-inbox:') ? { ...page([]), counts: { queue: 0, mine: 0, all: 0, history: 0 } }
      : key.endsWith(':payment-events') || key.includes(':coordination:') ? page([])
      : key.includes(':support-notices:') ? { data: [], pagination: { page: 0, size: 20, totalElements: 0, totalPages: 0 } }
      : key.includes(":summary:") ? { counts: { open: 0, in_progress: 0, resolved: 0, closed: 0 }, unassignedOpen: 0 }
      : state.mode === "rental" ? key.endsWith(":counts") ? [0, 0, 0, 0] : { kind: "rental", page: page([]) }
      : state.mode === "options" ? []
      : state.mode === "operations" ? /:(payments|refunds|facility-incidents):/.test(key) ? page([]) : key.endsWith(":proposal") ? null : operationState
      : state.mode === "ticket" ? /:(messages|events|escalations):/.test(key) ? page([]) : supportTicket
      : page([]),
  }),
}))
const command = {
  run: vi.fn(), retry: vi.fn(), clearError: vi.fn(), busy: false, uncertain: false,
  conflict: false, locked: false, error: undefined,
} as ReturnType<typeof useSupportCommand>
beforeEach(() => {
  state.actor = null; state.mode = "page"; state.loading = false; state.error = undefined
  vi.clearAllMocks()
})

function verifyLoadingAndErrors(view: ReactElement, emptyText = "Không có dữ liệu") {
  state.loading = true
  let html = renderToStaticMarkup(view)
  expect(html).toContain("Đang tải")
  expect(html).not.toContain(emptyText)
  state.loading = false
  for (const status of [null, 401, 403, 409, 500] as const) {
    state.error = new ApiClientError("Private internal detail", { status })
    html = renderToStaticMarkup(view)
    expect(html).toContain('role="alert"')
    expect(html).not.toContain(emptyText)
    expect(html).not.toContain("Private internal detail")
  }
}

function verifyEmptyOnlyAfterSuccess(view: ReactElement, emptyText = "Không có dữ liệu") {
  expect(renderToStaticMarkup(view)).toContain(emptyText)
  verifyLoadingAndErrors(view, emptyText)
}

describe("Dương verified empty-data presentation", () => {
  it.each(["customer", "manager"] as const)("D1 %s empty rental list", role => {
    state.actor = operationsActor(role); state.mode = "rental"
    verifyEmptyOnlyAfterSuccess(<RentalApiWorkspace role={role} />, role === 'customer' ? 'Không có hồ sơ thuê đang diễn ra.' : 'Không có dữ liệu')
  })
  it("D2 Customer empty renewal options", () => {
    state.actor = operationsActor("customer"); state.mode = "options"
    const modal = <CustomerRenewalRequestModal actorId={ids.customer} rentalId={ids.rental} onClose={vi.fn()} onSuccess={vi.fn()} />
    verifyEmptyOnlyAfterSuccess(modal, "Cơ sở hiện chưa có gói thuê còn hiệu lực để gia hạn.")
    expect(renderToStaticMarkup(modal)).not.toContain("Lấy báo giá mới")
  })
  it("D3 Staff empty appointment list", () => {
    state.actor = operationsActor("staff")
    const view = <StaffRenewalOperationsApiPanel />
    const html = renderToStaticMarkup(view)
    expect(html).toContain('Đang diễn ra')
    expect(html).toContain('Đã kết thúc')
    verifyEmptyOnlyAfterSuccess(view, 'Không có lịch ký đang diễn ra.')
    state.error = undefined
    verifyEmptyOnlyAfterSuccess(view, 'Chưa có lịch ký đã kết thúc.')
  })
  it.each(["customer", "staff", "manager"] as const)("D3 %s hides verified empty event history and preserves loading/errors", role => {
    state.actor = operationsActor(role); state.mode = "operations"
    const view = <RenewalOperationsPanel id={ids.renewal} role={role} customerId={ids.customer} facilityId={ids.facility} />
    const html = renderToStaticMarkup(view)
    expect(html).not.toContain("Lịch sử thanh toán gia hạn")
    expect(html).not.toContain("Lịch sử quyết định hoàn tiền")
    expect(html).not.toContain("Sự cố &amp; xem xét ngoại lệ")
    verifyLoadingAndErrors(view)
  })
  it.each(["customer", "staff", "manager"] as const)("D5 %s empty ticket list", role => {
    state.actor = supportActor(role)
    verifyEmptyOnlyAfterSuccess(<SupportApiWorkspace role={role} />, role === "staff" ? "Bạn chưa có cuộc trò chuyện đang hỗ trợ." : "Chưa có cuộc trò chuyện phù hợp")
  })
  it("D5 Customer empty available records", () => {
    state.actor = supportActor("customer")
    verifyEmptyOnlyAfterSuccess(<SupportCreateForm command={command} />)
  })
  it("D5 Manager empty eligible Staff list", () => {
    state.actor = supportActor("manager")
    verifyEmptyOnlyAfterSuccess(<SupportStaffPicker facilityId={supportIds.facility} value="" onChange={vi.fn()} />)
  })
  it("D5 Customer empty conversation history", () => {
    state.actor = supportActor("customer"); state.mode = "ticket"
    verifyEmptyOnlyAfterSuccess(<SupportTicketDetail id={supportIds.ticket} role="customer" command={command} onFollowUp={vi.fn()} />, 'Chưa có trao đổi mới.')
  })
  it("denied rental and Support sessions never show a successful empty state", () => {
    for (const view of [<RentalApiWorkspace role="manager" />, <SupportApiWorkspace role="manager" />]) {
      const html = renderToStaticMarkup(view)
      expect(html).toContain("quyền")
      expect(html).not.toContain("Không có dữ liệu")
    }
  })
})
