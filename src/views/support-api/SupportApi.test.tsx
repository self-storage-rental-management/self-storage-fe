import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiActor } from "../../services/authApi"
import type { useSupportCommand } from "../../hooks/useSupportCommand"
import {
  supportActor,
  supportActive,
  supportIds,
  supportTicket,
} from "../../../tests/supportApiFixtures"
import SupportActionForm from "./SupportActionForm"
import SupportApiEntry from "./SupportApiEntry"
import SupportApiWorkspace from "./SupportApiWorkspace"
import { SupportTicketSummary } from "./SupportTicketDetail"
import {
  canReadSupport,
  supportActions,
  supportTicketVisible,
} from "./presentation"

const session = vi.hoisted(() => ({ actor: null as ApiActor | null }))
vi.mock("../../services/authApi", () => ({
  getAuthenticatedActor: () => session.actor,
}))

const command = {
  run: vi.fn(),
  retry: vi.fn(),
  clearError: vi.fn(),
  busy: false,
  uncertain: false,
  conflict: false,
  error: undefined,
  locked: false,
} as ReturnType<typeof useSupportCommand>

beforeEach(() => {
  session.actor = null
  vi.clearAllMocks()
})

describe("D5 role and lifecycle boundaries", () => {
  it("does not promise auto-close from resolved timestamp or invent a delivery deadline", () => {
    const html = renderToStaticMarkup(<SupportTicketSummary ticket={{
      ...supportActive, status: "resolved", resolvedAt: "2026-10-08T03:00:00Z",
      resolvedBy: supportIds.staff,
    }} />)
    expect(html).toContain("Đã xử lý xong, chưa đóng")
    expect(html).toContain("bằng chứng notification đúng lần xử lý này")
    expect(html).not.toContain("Tự đóng sau 7 ngày")
  })
  it("Manager coordinates only; cannot resolve, reply or accept as Staff", () => {
    expect(
      supportActions(supportActor("manager"), "manager", supportActive),
    ).toEqual(["assign", "decision"])
  })
  it.each(["READ", "OPERATE"] as const)(
    "Manager %s scope is read-only",
    (scope) => {
      const actor = {
        ...supportActor("manager"),
        facilityScopes: { [supportIds.facility]: scope },
      }
      expect(canReadSupport(actor, "manager")).toBe(true)
      expect(supportActions(actor, "manager", supportActive)).toEqual([])
    },
  )
  it.each(["resolved", "closed"] as const)(
    "Manager cannot reassign terminal %s tickets",
    (status) => {
      expect(
        supportActions(supportActor("manager"), "manager", {
          ...supportActive,
          status,
        }),
      ).toEqual([])
    },
  )
  it("Staff must receive real manage_support permission from BE", () => {
    const actor = { ...supportActor("staff"), permissions: ["view_support"] }
    expect(canReadSupport(actor, "staff")).toBe(false)
    expect(supportActions(actor, "staff", supportActive)).toEqual([])
  })
  it("Staff must accept an open assignment before processing", () => {
    expect(
      supportActions(supportActor("staff"), "staff", {
        ...supportTicket,
        assignedStaffId: supportIds.staff,
      }),
    ).toEqual(["accept"])
    expect(
      supportActions(supportActor("staff"), "staff", supportActive),
    ).toEqual(["message", "information", "resolve", "escalate"])
    expect(
      supportActions(supportActor("staff"), "staff", {
        ...supportActive,
        acceptedAt: null,
      }),
    ).toEqual([])
  })
  it("old Staff loses both visibility and actions after reassignment", () => {
    const ticket = { ...supportActive, assignedStaffId: supportIds.foreign }
    expect(supportTicketVisible(supportActor("staff"), "staff", ticket)).toBe(
      false,
    )
    expect(supportActions(supportActor("staff"), "staff", ticket)).toEqual([])
  })
  it("waiting Customer allows accepted Staff conversation, not another resolution", () => {
    expect(
      supportActions(supportActor("staff"), "staff", {
        ...supportActive,
        status: "waiting_customer",
      }),
    ).toEqual(["message"])
  })
  it.each(["resolved", "closed"] as const)(
    "Staff cannot mutate %s tickets",
    (status) => {
      expect(
        supportActions(supportActor("staff"), "staff", {
          ...supportActive,
          status,
        }),
      ).toEqual([])
    },
  )
  it("Customer resolved reply is separate from explicit reopen/confirmation", () => {
    expect(
      supportActions(supportActor("customer"), "customer", {
        ...supportActive,
        status: "resolved",
      }),
    ).toEqual(["message", "reopen", "close"])
  })
  it("closed Customer ticket only allows a new follow-up", () => {
    expect(
      supportActions(supportActor("customer"), "customer", {
        ...supportActive,
        status: "closed",
      }),
    ).toEqual(["follow-up"])
  })
  it("Customer cannot read or operate a foreign ticket", () => {
    const actor = { ...supportActor("customer"), id: supportIds.foreign }
    expect(supportTicketVisible(actor, "customer", supportActive)).toBe(false)
    expect(supportActions(actor, "customer", supportActive)).toEqual([])
  })
  it("legacy metadata remains read-only and is never assigned version zero", () => {
    expect(
      supportActions(supportActor("manager"), "manager", {
        ...supportTicket,
        version: null,
        assignmentRevision: null,
        workflowReady: false,
      }),
    ).toEqual([])
  })
  it.each(["customer", "staff", "manager"] as const)(
    "inactive/wrong-role %s sessions are rejected",
    (role) => {
      const actor = supportActor(role)
      expect(canReadSupport(null, role)).toBe(false)
      expect(canReadSupport({ ...actor, status: "SUSPENDED" }, role)).toBe(
        false,
      )
      expect(canReadSupport({ ...actor, roles: [] }, role)).toBe(false)
    },
  )
  it("missing and foreign facilities do not acquire implied Manager scope", () => {
    const actor = supportActor("manager")
    expect(
      supportTicketVisible(actor, "manager", {
        ...supportTicket,
        facilityId: null,
      }),
    ).toBe(false)
    expect(
      supportTicketVisible(actor, "manager", {
        ...supportTicket,
        facilityId: supportIds.foreign,
      }),
    ).toBe(false)
  })
})

describe("D5 presentation and additive integration (server-rendered checks)", () => {
  it("renders unknown SLA honestly, Vietnamese dates and escaped user content", () => {
    const html = renderToStaticMarkup(
      <SupportTicketSummary
        ticket={{ ...supportTicket, subject: "<script>alert(1)</script>" }}
      />,
    )
    expect(html).toContain("Không kết luận yêu cầu đang đúng hạn hoặc quá hạn")
    expect(html).toContain("8/10/2026")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("9004#")
  })
  it("Manager assignment submit stays disabled until an actual Staff ID and reason are selected", () => {
    session.actor = supportActor("manager")
    const html = renderToStaticMarkup(
      <SupportActionForm
        role="manager"
        ticket={supportTicket}
        command={command}
      />,
    )
    expect(html).toContain("Chọn Staff theo mã")
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/)
    expect(html).not.toContain("Báo kết quả xử lý")
    expect(html).not.toContain("Nhận xử lý")
  })
  it("shows a Staff permission gate without impersonation or demo fallback", () => {
    session.actor = { ...supportActor("staff"), permissions: ["view_support"] }
    const html = renderToStaticMarkup(<SupportApiWorkspace role="staff" />)
    expect(html).toContain("manage_support hiện phải được owner cấp trên BE")
    expect(html).toContain("Không lấy yêu cầu demo để thay thế dữ liệu API")
    expect(html).not.toContain("Tạo yêu cầu</button>")
  })
  it.each(["customer", "staff"] as const)(
    "preserves the existing %s workspace as the default tab",
    (role) => {
      const html = renderToStaticMarkup(
        <SupportApiEntry role={role}>
          <div data-owner="unchanged">Original workspace</div>
        </SupportApiEntry>,
      )
      expect(html).toContain('data-owner="unchanged"')
      expect(html).toContain("Original workspace")
      expect(html).toContain("Hỗ trợ (D5 API)")
      expect(html).not.toContain("Hỗ trợ vận hành (D5 API)")
    },
  )
})
