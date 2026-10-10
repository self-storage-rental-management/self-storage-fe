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
vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: (key: string) => ({
    loading: state.loading,
    error: state.error,
    refresh: vi.fn(),
    data: state.loading || state.error ? undefined
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

function verifyEmptyOnlyAfterSuccess(view: ReactElement) {
  expect(renderToStaticMarkup(view)).toContain("Không có dữ liệu")
  state.loading = true
  let html = renderToStaticMarkup(view)
  expect(html).toContain("Đang tải")
  expect(html).not.toContain("Không có dữ liệu")
  state.loading = false
  for (const status of [null, 401, 403, 409, 500] as const) {
    state.error = new ApiClientError("Private internal detail", { status })
    html = renderToStaticMarkup(view)
    expect(html).toContain('role="alert"')
    expect(html).not.toContain("Không có dữ liệu")
    expect(html).not.toContain("Private internal detail")
  }
}

describe("Dương verified empty-data presentation", () => {
  it.each(["customer", "manager"] as const)("D1 %s empty rental list", role => {
    state.actor = operationsActor(role); state.mode = "rental"
    verifyEmptyOnlyAfterSuccess(<RentalApiWorkspace role={role} />)
  })
  it("D2 Customer empty renewal options", () => {
    state.actor = operationsActor("customer"); state.mode = "options"
    verifyEmptyOnlyAfterSuccess(<CustomerRenewalRequestModal actorId={ids.customer} rentalId={ids.rental} onClose={vi.fn()} onSuccess={vi.fn()} />)
  })
  it("D3 Staff empty appointment list", () => {
    state.actor = operationsActor("staff")
    verifyEmptyOnlyAfterSuccess(<StaffRenewalOperationsApiPanel />)
  })
  it.each(["customer", "staff", "manager"] as const)("D3 %s empty event history", role => {
    state.actor = operationsActor(role); state.mode = "operations"
    verifyEmptyOnlyAfterSuccess(<RenewalOperationsPanel id={ids.renewal} role={role} customerId={ids.customer} facilityId={ids.facility} />)
  })
  it.each(["customer", "staff", "manager"] as const)("D5 %s empty ticket list", role => {
    state.actor = supportActor(role)
    verifyEmptyOnlyAfterSuccess(<SupportApiWorkspace role={role} />)
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
    verifyEmptyOnlyAfterSuccess(<SupportTicketDetail id={supportIds.ticket} role="customer" command={command} onFollowUp={vi.fn()} />)
  })
  it("denied rental and Support sessions never show a successful empty state", () => {
    for (const view of [<RentalApiWorkspace role="manager" />, <SupportApiWorkspace role="manager" />]) {
      const html = renderToStaticMarkup(view)
      expect(html).toContain("quyền")
      expect(html).not.toContain("Không có dữ liệu")
    }
  })
})
