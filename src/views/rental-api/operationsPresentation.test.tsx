import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  operationBlockedReason,
  vietnamLocalInstant,
} from "./operationsPresentation"
import {
  OperationEventCard,
  RenewalOperationsSummary,
} from "./RenewalOperationsPanel"
import {
  OverdueCaseSummary,
  OverdueCompleteness,
  OverdueFollowUpCard,
} from "../manager/ManagerOverdueApiPanel"
import { rentalError } from "./presentation"
import { ApiClientError } from "../../services/apiClient"
import {
  isUncertainRenewalOutcome,
  RenewalAttempt,
} from "../../hooks/useRenewalCommand"
import {
  apiPage,
  debtCase,
  followUp,
  ids,
  operationEvent,
  operationState,
  operationsActor,
  overduePage,
  signingState,
  termCase,
} from "../../../tests/rentalOperationsApiFixtures"

describe("D3 operation prerequisites and truthful UI", () => {
  it.each([null, 500, 502, 503])(
    "unknown/server outcome %s must retain original key",
    (status) => {
      expect(
        isUncertainRenewalOutcome(
          new ApiClientError("response uncertain", { status }),
        ),
      ).toBe(true)
      const attempt = new RenewalAttempt()
      expect(attempt.key("frozen-body")).toBe(attempt.key("frozen-body"))
      expect(() => attempt.key("new-body")).toThrow()
    },
  )
  it.each([400, 403, 404, 409])(
    "known rejection %s may release form for refresh",
    (status) => {
      expect(
        isUncertainRenewalOutcome(new ApiClientError("rejected", { status })),
      ).toBe(false)
    },
  )
  it("only Customer can initiate deposit, and it must belong to that Customer", () => {
    expect(
      operationBlockedReason(
        operationState,
        "customer",
        "deposit",
        operationsActor("customer"),
        ids.facility,
        ids.customer,
      ),
    ).toBeNull()
    expect(
      operationBlockedReason(
        operationState,
        "customer",
        "deposit",
        operationsActor("customer"),
        ids.facility,
        ids.staff,
      ),
    ).not.toBeNull()
    expect(
      operationBlockedReason(
        operationState,
        "manager",
        "deposit",
        operationsActor("manager"),
      ),
    ).not.toBeNull()
  })
  it("blocks only the needed missing sources, not unrelated refund port", () => {
    expect(
      operationBlockedReason(
        { ...operationState, missingSources: ["REFUND_ENTITLEMENT_EXECUTION"] },
        "customer",
        "deposit",
        operationsActor("customer"),
        ids.facility,
        ids.customer,
      ),
    ).toBeNull()
    expect(
      operationBlockedReason(
        { ...operationState, missingSources: ["RENEWAL_ACCOUNTING"] },
        "customer",
        "deposit",
        operationsActor("customer"),
        ids.facility,
        ids.customer,
      ),
    ).toContain("Chưa đủ thông tin")
  })
  it("does not invent legacy version or allow Manager completion", () => {
    expect(
      operationBlockedReason(
        { ...signingState, expectedVersion: null },
        "staff",
        "arrival",
        operationsActor("staff"),
      ),
    ).toContain("chưa đủ thông tin")
    expect(
      operationBlockedReason(
        { ...signingState, arrivalRef: ids.event },
        "manager",
        "completion",
        operationsActor("manager"),
        ids.facility,
      ),
    ).not.toBeNull()
  })
  it("blocks new ordinary appointment after arrival and completion without arrival", () => {
    expect(
      operationBlockedReason(
        { ...signingState, arrivalRef: ids.event },
        "customer",
        "reschedule",
        operationsActor("customer"),
        ids.facility,
        ids.customer,
      ),
    ).toContain("khách đến")
    expect(
      operationBlockedReason(
        signingState,
        "staff",
        "completion",
        operationsActor("staff"),
      ),
    ).toContain("Chưa có lượt")
  })
  it.each([
    "SIGNING_EXPIRY_PENDING",
    "SIGNING_EXPIRED",
    "PAYMENT_EXPIRED",
    "COMPLETED",
  ] as const)("expired/terminal %s cannot complete ordinarily", (phase) => {
    expect(
      operationBlockedReason(
        { ...signingState, phase, arrivalRef: ids.event },
        "staff",
        "completion",
        operationsActor("staff"),
      ),
    ).not.toBeNull()
  })
  it("requires Manager actual MANAGE scope and base permission, not name", () => {
    const actor = operationsActor("manager")
    expect(
      operationBlockedReason(
        signingState,
        "manager",
        "exception",
        actor,
        ids.facility,
      ),
    ).toBeNull()
    expect(
      operationBlockedReason(
        signingState,
        "manager",
        "exception",
        { ...actor, permissions: [] },
        ids.facility,
      ),
    ).not.toBeNull()
    expect(
      operationBlockedReason(
        signingState,
        "manager",
        "exception",
        { ...actor, facilityScopes: { [ids.facility]: "READ" } },
        ids.facility,
      ),
    ).not.toBeNull()
    expect(
      operationBlockedReason(
        signingState,
        "manager",
        "exception",
        { ...actor, status: "SUSPENDED" },
        ids.facility,
      ),
    ).not.toBeNull()
  })
  it("Staff still needs backend specialized assignment source; no Check-in permission fallback", () => {
    const actor = {
      ...operationsActor("staff"),
      permissions: ["checkins:process"],
    }
    expect(
      operationBlockedReason(
        { ...signingState, missingSources: ["STAFF_PERMISSION_ASSIGNMENT"] },
        "staff",
        "arrival",
        actor,
      ),
    ).toContain("phân công")
  })
  it("Customer cannot blindly confirm an exception from ref alone", () => {
    expect(
      operationBlockedReason(
        { ...signingState, pendingExceptionRef: ids.event },
        "customer",
        "confirmation",
        operationsActor("customer"),
        ids.facility,
        ids.customer,
      ),
    ).toContain("nội dung đề xuất")
  })
  it("does not hide missing sources or claim money/completion on awaiting state", () => {
    const html = renderToStaticMarkup(
      <RenewalOperationsSummary
        state={{ ...operationState, missingSources: ["RENEWAL_ACCOUNTING"] }}
      />,
    )
    expect(html).toContain("Chờ thanh toán cọc")
    expect(html).toContain("Thanh toán và phân bổ tiền gia hạn")
    expect(html).toContain("Chưa đủ thông tin để xử lý")
    expect(html).not.toContain("không dùng dữ liệu demo")
    expect(html).not.toContain("RENEWAL_ACCOUNTING")
    expect(html).not.toContain("0 đ")
    expect(html).not.toContain("Đã hoàn tất gia hạn")
  })
  it("FAILED deposit event is not displayed as paid", () => {
    const html = renderToStaticMarkup(
      <OperationEventCard
        event={{ ...operationEvent, data: { outcome: "FAILED" } }}
      />,
    )
    expect(html).toContain("Thất bại")
    expect(html).not.toContain("Thành công")
  })
  it("refund approval is not claimed to be a transfer; Customer-safe payload has no internal reason", () => {
    const html = renderToStaticMarkup(
      <OperationEventCard
        event={{
          ...operationEvent,
          kind: "REFUND",
          actorId: null,
          data: {
            status: "APPROVED_AWAITING_EXECUTION",
            reservation: { amount: 100000, currency: "VND" },
          },
        }}
      />,
    )
    expect(html).toContain("chưa chuyển tiền")
    expect(html).not.toContain("Người thực hiện")
    expect(html).not.toContain("undefined")
  })
  it("datetime-local is interpreted in Vietnam, not the browser timezone", () => {
    expect(vietnamLocalInstant("2026-10-08T10:00")).toBe(
      "2026-10-08T03:00:00.000Z",
    )
    expect(() => vietnamLocalInstant("2026-02-30T10:00")).toThrow()
    expect(() => vietnamLocalInstant("2026-10-08")).toThrow()
  })
})
describe("D4 truthful overdue presentation", () => {
  it("PARTIAL zero list does not claim no debt", () => {
    const html = renderToStaticMarkup(
      <OverdueCompleteness
        page={{
          ...overduePage,
          ...apiPage([]),
          completeness: "PARTIAL",
          missingSources: ["AUTHORITATIVE_OBLIGATIONS_ALLOCATIONS"],
        }}
      />,
    )
    expect(html).toContain("một phần")
    expect(html).toContain("Chưa đủ dữ liệu để xác định tất cả khoản nợ")
    expect(html).not.toContain("0 đ")
  })
  it("term case null money is not presented as zero debt or invented fees", () => {
    const html = renderToStaticMarkup(<OverdueCaseSummary record={termCase} />)
    expect(html).toContain("Quá thời hạn thuê")
    expect(html).not.toContain("không tự có một khoản nợ tiền")
    expect(html).not.toContain("0 đ")
    expect(html).not.toContain("term-policy")
  })
  it("debt uses real outstanding only, not USD conversion or rental-month calculation", () => {
    const html = renderToStaticMarkup(<OverdueCaseSummary record={debtCase} />)
    expect(html).toContain("5.500.000 đ")
    expect(html).not.toContain("143.000.000.000")
  })
  it("reminder queued is not delivered; Recovery ACK is not physical recovery", () => {
    const reminder = renderToStaticMarkup(
      <OverdueFollowUpCard
        event={{ ...followUp, type: "REMINDER", externalRef: ids.event }}
      />,
    )
    expect(reminder).toContain("không xác nhận đã gửi")
    const recovery = renderToStaticMarkup(
      <OverdueFollowUpCard
        event={{
          ...followUp,
          type: "RECOVERY_HANDOFF",
          externalRef: ids.event,
        }}
      />,
    )
    expect(recovery).toContain("chưa có nghĩa gian kho đã được thu hồi hoặc giải phóng")
  })
  it("reports deferred code even when backend message lacks the marker", () => {
    expect(
      rentalError(
        new ApiClientError("Chờ nguồn policy", {
          code: "DEFERRED_SOURCE",
          status: 409,
        }),
      ),
    ).toContain("Chưa đủ dữ liệu hoặc chính sách")
  })
})
