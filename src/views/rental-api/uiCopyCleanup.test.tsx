import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { ApiActor } from "../../services/authApi"
import type { useSupportCommand } from "../../hooks/useSupportCommand"
import { ApiClientError } from "../../services/apiClient"
import ManagerOverdueApiPanel from "../manager/ManagerOverdueApiPanel"
import StaffRenewalOperationsApiPanel from "../staff/StaffRenewalOperationsApiPanel"
import RenewalOperationsPanel, { OperationEventCard } from "./RenewalOperationsPanel"
import SupportTicketDetail, { SupportTicketSummary } from "../support-api/SupportTicketDetail"
import SupportApiWorkspace from "../support-api/SupportApiWorkspace"
import ApiReadState from "./ApiReadState"
import { ManagerPresentationProvider } from "../manager/managerPresentation"
import { rentalError } from "./presentation"
import { supportError, supportReceiverLabels } from "../support-api/presentation"
import { apiPage, ids, operationEvent, operationState, operationsActor, overduePage, signingState } from "../../../tests/rentalOperationsApiFixtures"
import { supportActive, supportActor, supportIds, supportMessage, supportPage, supportTicket } from "../../../tests/supportApiFixtures"

// Isolated SSR test inputs, never used as an authenticated runtime API fallback.
const state = vi.hoisted(() => ({
  actor: null as ApiActor | null,
  mode: "overdue" as "overdue" | "operations" | "support" | "staff",
  data: undefined as unknown,
  error: undefined as unknown,
  loading: false,
  uncertain: false,
  locked: false,
}))
vi.mock("../../services/authApi", () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: (key: string) => ({
    loading: state.loading, error: state.error, refresh: vi.fn(),
    data: state.mode === "operations"
      ? /:(payments|refunds|facility-incidents):/.test(key) ? apiPage([]) : key.endsWith(":proposal") ? null : state.data
      : state.mode === "support" && key.includes(":messages:")
        ? supportPage([{ ...supportMessage, evidenceFileIds: [ids.file] }])
        : state.data,
  }),
}))
vi.mock("../../hooks/useSupportCommand", () => ({
  useSupportCommand: () => ({ run: vi.fn(), retry: vi.fn(), clearError: vi.fn(), busy: false, uncertain: state.uncertain, locked: state.locked, error: state.error }),
}))
beforeEach(() => {
  state.actor = null; state.mode = "overdue"; state.data = undefined
  state.error = undefined; state.loading = false; state.uncertain = false; state.locked = false
  vi.clearAllMocks()
})

describe("Dương delete-first UI copy regression", () => {
  it("D4 heading is followed by filters, with NO replacement subtitle", () => {
    state.actor = operationsActor("manager")
    state.data = { ...overduePage, ...apiPage([]) }
    const html = renderToStaticMarkup(<ManagerOverdueApiPanel />)
    expect(html).toMatch(/<h1[^>]*>Theo dõi quá hạn<\/h1><div class="app-card/)
    expect(html).not.toContain("Tách quá hạn thuê và quá hạn thanh toán")
    expect(html).not.toContain("Theo dõi các hồ sơ quá hạn")
    expect(html).toContain("Quá hạn thanh toán")
    expect(html).toContain("Quá thời hạn thuê")
    expect(html).toContain("Mã theo dõi có sẵn")
  })
  it("D4 partial empty list is not the verified complete empty state", () => {
    state.actor = operationsActor("manager")
    state.data = { ...overduePage, ...apiPage([]), completeness: "PARTIAL", missingSources: ["AUTHORITATIVE_OBLIGATIONS_ALLOCATIONS"] }
    let html = renderToStaticMarkup(<ManagerOverdueApiPanel />)
    expect(html).toContain("dữ liệu quá hạn còn thiếu")
    expect(html).not.toContain("Không có hồ sơ quá hạn phù hợp")
    expect(html).not.toContain("AUTHORITATIVE_OBLIGATIONS_ALLOCATIONS")
    expect(html).not.toContain("0 đ")
    state.data = { ...overduePage, ...apiPage([]), completeness: "COMPLETE", missingSources: [] }
    html = renderToStaticMarkup(<ManagerOverdueApiPanel />)
    expect(html).toContain("Không có hồ sơ quá hạn phù hợp")
    expect(html).not.toContain("dữ liệu quá hạn còn thiếu")
  })
  it("D4 denied actor still gets an alert, no filters or actions", () => {
    const html = renderToStaticMarkup(<ManagerOverdueApiPanel />)
    expect(html).toContain('role="alert"')
    expect(html).toContain("chưa có quyền")
    expect(html).not.toContain("<select")
  })
  it("D3 Customer always sees the simulation disclosure and missing-source guard", () => {
    state.actor = operationsActor("customer"); state.mode = "operations"
    state.data = { ...operationState, missingSources: ["BO_SIGNING_POLICY"] }
    const html = renderToStaticMarkup(<RenewalOperationsPanel id={ids.renewal} role="customer" customerId={ids.customer} facilityId={ids.facility} />)
    expect(html).toContain("Thanh toán thử nghiệm - không thu tiền thật.")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Thanh toán cọc thử nghiệm<\/button>/)
    expect(html).toContain("Chưa đủ thông tin")
    expect(html).not.toContain("BO_SIGNING_POLICY")
    expect(html).not.toContain("(D3)")
  })
  it("D3 unreadable exception proposal remains blocked with a truthful reason", () => {
    state.actor = operationsActor("customer"); state.mode = "operations"
    state.data = { ...signingState, pendingExceptionRef: ids.event }
    const html = renderToStaticMarkup(<RenewalOperationsPanel id={ids.renewal} role="customer" customerId={ids.customer} facilityId={ids.facility} />)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Xác nhận đề xuất ngoại lệ<\/button>/)
    expect(html).toContain("Chưa tải được nội dung đề xuất")
    expect(html).not.toContain("BE")
  })
  it("D3 history never exposes an unknown raw status as user copy", () => {
    const html = renderToStaticMarkup(<OperationEventCard event={{ ...operationEvent, data: { outcome: "SECRET_INTERNAL_STATUS" } }} />)
    expect(html).toContain("Chưa rõ trạng thái")
    expect(html).not.toContain("SECRET_INTERNAL_STATUS")
  })
  it("D3 deposit history discloses simulation, without labeling an actual CASH receipt as simulated", () => {
    let html = renderToStaticMarkup(<OperationEventCard event={operationEvent} />)
    expect(html).toContain("Kết quả thanh toán cọc thử nghiệm")
    expect(html).toContain("Thanh toán thử nghiệm - không thu tiền thật.")
    expect(html).toContain("3.201.000 đ")
    html = renderToStaticMarkup(<OperationEventCard event={{ ...operationEvent, kind: "CASH" }} />)
    expect(html).toContain("Biên nhận tiền mặt")
    expect(html).not.toContain("thử nghiệm")
  })
  it("D3 Manager has no empty reload wrapper after presentation cleanup", () => {
    state.actor = operationsActor("manager"); state.mode = "operations"; state.data = operationState
    const html = renderToStaticMarkup(<ManagerPresentationProvider><RenewalOperationsPanel id={ids.renewal} role="manager" customerId={ids.customer} facilityId={ids.facility} /></ManagerPresentationProvider>)
    expect(html).not.toContain('<div class="flex gap-2"></div>')
    expect(html).not.toContain("Tải lại tiến độ")
    expect(html).toContain("Xem xét ngoại lệ")
  })
  it.each(["customer", "staff", "manager"] as const)("D5 %s summary retains unknown/blocked state without workflow/version/SLA internals", role => {
    const html = renderToStaticMarkup(<SupportTicketSummary role={role} ticket={{ ...supportActive, subject: "Cần hỗ trợ", description: "Nội dung yêu cầu", workflowReady: false, version: null }} />)
    expect(html).toContain("hiện chỉ có thể xem")
    expect(html).toContain("Chưa đủ thông tin để xác định hạn xử lý")
    expect(html).not.toMatch(/workflow|version 0|DEFERRED_SOURCE|\bSLA\b|\bBE\b/)
    if (role === "customer") {
      expect(html).not.toContain(supportIds.staff)
      expect(html).not.toContain(supportIds.customer)
    } else expect(html).toContain("Mã khách hàng")
  })
  it("D5 attachment notice is truthful, without file UUID or fake download", () => {
    state.actor = supportActor("customer"); state.mode = "support"
    state.data = { ...supportTicket, subject: "Cần hỗ trợ", description: "Nội dung yêu cầu" }
    const command = { run: vi.fn(), retry: vi.fn(), clearError: vi.fn(), busy: false, uncertain: false, conflict: false, locked: false, error: undefined } as ReturnType<typeof useSupportCommand>
    const html = renderToStaticMarkup(<SupportTicketDetail id={supportIds.ticket} role="customer" command={command} onFollowUp={vi.fn()} />)
    expect(html).toContain("Có tệp đính kèm, hiện chưa thể tải xuống.")
    expect(html).toContain("Khách hàng")
    expect(html).not.toContain(ids.file)
    expect(html).not.toContain("FileAsset")
    expect(html).not.toContain('download=')
  })
  it("D5 uncertain response retains retry instructions and no new request or key wording", () => {
    state.actor = supportActor("customer"); state.mode = "support"; state.data = supportPage([])
    state.uncertain = true; state.locked = true
    const html = renderToStaticMarkup(<SupportApiWorkspace role="customer" />)
    expect(html).toContain("Giữ nguyên nội dung và bấm thử lại")
    expect(html).toContain("không tải lại trang hoặc gửi yêu cầu mới")
    expect(html).toContain("Kiểm tra lại bằng yêu cầu cũ")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Tạo yêu cầu<\/button>/)
    expect(html).not.toContain("Idempotency-Key")
  })
  it("Staff D3 error is natural Vietnamese, without changing the shared Staff helper", () => {
    state.actor = operationsActor("staff"); state.mode = "staff"
    state.error = new ApiClientError("SECRET_INTERNAL FileAsset UUID", { status: 500 })
    const html = renderToStaticMarkup(<StaffRenewalOperationsApiPanel />)
    expect(html).toContain("Chưa nhận được kết quả")
    expect(html).not.toContain("SECRET_INTERNAL")
    expect(html).not.toContain("(D3)")
  })
  it("loading stays visible and does not become an empty success", () => {
    const html = renderToStaticMarkup(<ApiReadState loading retry={vi.fn()} />)
    expect(html).toContain('role="status"')
    expect(html).toContain("Đang tải dữ liệu")
    expect(html).not.toContain("Không có")
  })
  it.each([rentalError, supportError])("errors preserve distinctions and do not print raw server details", present => {
    const values = [401, 403, 404, 409, 500, null].map(status => present(new ApiClientError("SECRET_INTERNAL FileAsset UUID", { status })))
    expect(new Set(values).size).toBe(5) // server + network share uncertain wording, but not auth/conflict/empty
    expect(values.join(" ")).not.toMatch(/SECRET_INTERNAL|FileAsset|UUID/)
    expect(values[0]).toContain("đăng nhập")
    expect(values[1]).toContain("quyền")
    expect(values[3]).toContain("thay đổi")
    expect(present(new ApiClientError("private detail", { status: 409, code: "DEFERRED_SOURCE" }))).toContain("Chưa đủ dữ liệu")
  })
  it("queued receiving status is not labeled completed or delivered", () => {
    expect(supportReceiverLabels.QUEUED).toBe("Đang chờ tiếp nhận")
    expect(supportReceiverLabels.QUEUED).not.toMatch(/hoàn tất|đã gửi/i)
  })
})
