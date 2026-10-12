import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { ApiActor } from "../../services/authApi"
import { LedgerContent, ledgerReadError, canReconcileSandboxPayment } from "./LedgerPanel"
import { ApiClientError } from "../../services/apiClient"
import RenewalCoordinationPanel, {
  canCoordinateRenewal,
  RenewalAssignmentSummary,
} from "./RenewalCoordinationPanel"
import DuongPolicyWorkspace, {
  buildPolicyInput,
  policyDraft,
  policyMatches,
} from "./DuongPolicyWorkspace"
import { EvidenceUpload, EvidenceDownload } from "./EvidenceControls"
import type {
  LedgerView,
  RenewalPolicy,
} from "../../services/duongIntegrationApi"
import { policyPendingKey, retainPendingPolicy, readPendingPolicy, clearPendingPolicy } from "./pendingPolicyPublication"
import {
  ids,
  instant,
  operationState,
  operationsActor,
} from "../../../tests/rentalOperationsApiFixtures"
const state = vi.hoisted(() => ({ actor: null as ApiActor | null }))
it("requires explicit server Sandbox policy eligibility before exposing reconciliation", () => {
  const payment = { paymentId: ids.event, provenance: "SANDBOX" as const, linkedReceipt: false, refundUnreconciled: false }
  expect(canReconcileSandboxPayment(payment)).toBe(false)
  expect(canReconcileSandboxPayment({ ...payment, eligibleForReconciliation: false })).toBe(false)
  expect(canReconcileSandboxPayment({ ...payment, eligibleForReconciliation: true })).toBe(true)
  expect(canReconcileSandboxPayment({ ...payment, eligibleForReconciliation: true, linkedReceipt: true })).toBe(false)
  expect(canReconcileSandboxPayment({ ...payment, eligibleForReconciliation: true, refundUnreconciled: true })).toBe(false)
  expect(canReconcileSandboxPayment({ ...payment, eligibleForReconciliation: true, provenance: "SIMULATED" })).toBe(false)
})
vi.mock("../../services/authApi", () => ({
  getAuthenticatedActor: () => state.actor,
}))
beforeEach(() => {
  state.actor = null
})
it("renders an authenticated Sandbox receipt as project collection, distinct from internal simulation", () => {
  const html = renderToStaticMarkup(<LedgerContent data={{ ...unknown, completeness: "PARTIAL", revision: 2,
    obligations: [], refunds: [], receipts: [{ id: ids.event, method: "VNPAY_SANDBOX", amount: 20, receivedAt: instant, simulated: false }] }} />)
  expect(html).toContain("VNPay Sandbox đã đối soát trong dự án - không thu tiền thật")
  expect(html).not.toContain("Chuyển khoản đã xác minh")
})
const unknown: LedgerView = {
  rentalId: ids.rental,
  completeness: "UNKNOWN",
  currency: "VND",
  revision: null,
  obligations: null,
  receipts: null,
  refunds: null,
  reason: "Internal ledger unavailable",
}
const draft = {
  expectedRevision: "0",
  effectiveFrom: "2026-10-10",
  quoteTtlMinutes: "5",
  paymentWindowHours: "24",
  requestWindowDays: "30",
  depositRate: "0.2",
  eligiblePackageIds: "",
}
describe("Dương integration presentation and safe policy builders", () => {
  it("explains partial inventory without rendering technical references or a zero-debt claim", () => {
    const html = renderToStaticMarkup(<LedgerContent data={{ ...unknown, completeness: "PARTIAL", revision: 0,
      obligations: [], receipts: [], refunds: [], coverageInventory: { rentalId: ids.rental, ledgerRevision: 0,
        completeness: "PARTIAL", gaps: ["INITIAL_OBLIGATION_UNPOSTED_OR_INVALID:RENT", "PAYMENT_REFUND_EXECUTION_UNRECONCILED"],
        payments: [], consistentThroughApproval: false } }} />)
    expect(html).toContain("Nghĩa vụ tiền thuê hoặc cọc chưa được đối soát")
    expect(html).toContain("Chưa xác minh hoàn tiền đã được chuyển")
    expect(html).not.toContain("INITIAL_OBLIGATION")
    expect(html).not.toContain("0 ₫")
  })
  it.each([
    new ApiClientError("Internal private server detail", { status: 500 }),
    new ApiClientError("Gateway unavailable", { status: 503 }),
    new ApiClientError("Network unavailable", { code: "NETWORK_ERROR" }),
    new ApiClientError("Response timeout", { code: "TIMEOUT" }),
    new ApiClientError("Invalid ledger response", { code: "INVALID_API_RESPONSE" }),
    new Error("Private unexpected error"),
  ])("uses read-only feedback for ledger failure instead of uncertain mutation instructions: %j", error => {
    expect(ledgerReadError(error)).toBe("Không tải được dữ liệu tài chính. Vui lòng thử lại.")
    expect(ledgerReadError(error)).not.toMatch(/cùng nội dung|không tạo yêu cầu|Private|Internal/)
  })
  it.each([
    [401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."],
    [403, "Bạn không có quyền thực hiện thao tác này."],
    [404, "Chưa có dữ liệu, chức năng chưa được bật hoặc hồ sơ không thuộc quyền truy cập."],
    [409, "Dữ liệu đã thay đổi hoặc chưa đủ điều kiện xử lý. Kiểm tra lại hồ sơ trước khi tiếp tục."],
  ])("preserves ledger authentication, authorization and blocked-state feedback for HTTP %i", (status, message) => {
    expect(ledgerReadError(new ApiClientError("Raw backend detail", { status: Number(status) }))).toBe(message)
  })
  it.each(["completed", "cancelled", "rejected", "payment_expired"])("terminal %s does not expose a new coordination command", status => {
    state.actor = operationsActor("manager")
    expect(renderToStaticMarkup(<RenewalCoordinationPanel state={operationState} facilityId={ids.facility} status={status} onLocked={vi.fn()} onChanged={vi.fn()} />)).toBe("")
  })
  it("renders a persisted assignment rather than relying on the last local command event", () => {
    const html = renderToStaticMarkup(<RenewalAssignmentSummary assignment={{ renewalId: ids.renewal, expectedVersion: 1, status: "ASSIGNED", staffId: ids.staff, staffName: "Nhân viên phụ trách thật" }} expectedVersion={1} />)
    expect(html).toContain("Nhân viên phụ trách thật")
    expect(html).not.toContain(ids.staff)
  })
  it("stale, ambiguous and revoked assignments never claim a currently eligible signing Staff", () => {
    const assignment = { renewalId: ids.renewal, expectedVersion: 1, status: "ASSIGNED" as const, staffId: ids.staff, staffName: "Tên cũ" }
    expect(renderToStaticMarkup(<RenewalAssignmentSummary assignment={assignment} expectedVersion={2} />)).toContain("Chưa xác minh")
    expect(renderToStaticMarkup(<RenewalAssignmentSummary assignment={{ ...assignment, status: "UNAVAILABLE", staffId: null, staffName: null }} expectedVersion={1} />)).toContain("Chưa xác minh")
    expect(renderToStaticMarkup(<RenewalAssignmentSummary assignment={{ ...assignment, status: "INELIGIBLE" }} expectedVersion={1} />)).toContain("không đủ điều kiện")
    expect(renderToStaticMarkup(<RenewalAssignmentSummary assignment={{ ...assignment, status: "UNASSIGNED", staffId: null, staffName: null }} expectedVersion={1} />)).toContain("Chưa phân công")
  })
  it("uncertain policy payload survives navigation and remains scoped to actor/facility/kind", () => {
    const key = policyPendingKey(ids.manager, ids.facility, "renewal")
    const input = buildPolicyInput("renewal", draft)
    retainPendingPolicy(key, input, true)
    input.effectiveFrom = "2099-01-01"
    expect(readPendingPolicy(key)?.input.effectiveFrom).toBe(draft.effectiveFrom)
    expect(readPendingPolicy(key)?.conflict).toBe(true)
    expect(readPendingPolicy(policyPendingKey(ids.customer, ids.facility, "renewal"))).toBeUndefined()
    expect(readPendingPolicy(policyPendingKey(ids.manager, ids.facility, "communication"))).toBeUndefined()
    expect(policyDraft(readPendingPolicy(key)!.input).expectedRevision).toBe("0")
    clearPendingPolicy(key)
    expect(readPendingPolicy(key)).toBeUndefined()
  })
  it("unknown financial data is not zero debt or internal narration", () => {
    const html = renderToStaticMarkup(<LedgerContent data={unknown} />)
    expect(html).toContain("Không có dữ liệu")
    expect(html).not.toMatch(/0 đ|đã thanh toán|Internal ledger/i)
  })
  it("partial empty rows remain explicitly unverified, not a complete zero debt", () => {
    const html = renderToStaticMarkup(
      <LedgerContent
        data={{
          ...unknown,
          completeness: "PARTIAL",
          revision: 0,
          obligations: [],
          receipts: [],
          refunds: [],
        }}
      />,
    )
    expect(html).toContain("chưa được xác minh đầy đủ")
    expect(html).not.toContain("0 đ")
  })
  it("simulation never claims actual payment and reserved refund never claims payout", () => {
    const html = renderToStaticMarkup(
      <LedgerContent
        data={{
          ...unknown,
          completeness: "PARTIAL",
          revision: 1,
          obligations: [],
          receipts: [
            {
              id: ids.event,
              method: "SIMULATED",
              simulated: true,
              amount: 100,
              receivedAt: instant,
            },
          ],
          refunds: [{ id: ids.file, amount: 10, status: "RESERVED" }],
        }}
      />,
    )
    expect(html).toContain("Thanh toán thử nghiệm - không thu tiền thật")
    expect(html).toContain("chưa chuyển tiền")
    expect(html).not.toMatch(/SIMULATED|RESERVED|Đã ghi nhận chi hoàn tiền/)
  })
  it("requires active manager read/update grants and MANAGE scope for coordination", () => {
    expect(canCoordinateRenewal(ids.facility)).toBe(false)
    state.actor = operationsActor("manager")
    expect(canCoordinateRenewal(ids.facility)).toBe(true)
    state.actor = { ...state.actor, facilityScopes: { [ids.facility]: "READ" } }
    expect(canCoordinateRenewal(ids.facility)).toBe(false)
    state.actor = operationsActor("staff")
    expect(canCoordinateRenewal(ids.facility)).toBe(false)
    state.actor = {
      ...operationsActor("manager"),
      permissions: ["rentals:read"],
    }
    expect(canCoordinateRenewal(ids.facility)).toBe(false)
  })
  it("does not enable assignment before authoritative approval or after arrival", () => {
    state.actor = operationsActor("manager")
    const html = renderToStaticMarkup(
      <RenewalCoordinationPanel
        state={operationState}
        facilityId={ids.facility}
        status="pending"
        onLocked={vi.fn()}
        onChanged={vi.fn()}
      />,
    )
    expect(html).toContain("Chỉ phân công khi")
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Ghi nhận phân công<\/button>/,
    )
    expect(
      renderToStaticMarkup(
        <RenewalCoordinationPanel
          state={operationState}
          facilityId={ids.facility}
          status="completed"
          onLocked={vi.fn()}
          onChanged={vi.fn()}
        />,
      ),
    ).toBe("")
  })
  it("new policy workspace denies demo/unauthenticated account without editing old policy engine", () => {
    const html = renderToStaticMarkup(<DuongPolicyWorkspace />)
    expect(html).toContain("Cần đăng nhập")
    expect(html).not.toContain("Lưu chính sách")
  })
  it("blank policy does not seed deadline, revision, rates or packages", () => {
    expect(() => buildPolicyInput("renewal", {})).toThrow()
    expect(() => buildPolicyInput("communication", {})).toThrow()
    expect(() =>
      buildPolicyInput("renewal", { ...draft, expectedRevision: "" }),
    ).toThrow()
    expect(() =>
      buildPolicyInput("renewal", { ...draft, quoteTtlMinutes: "" }),
    ).toThrow()
  })
  it("explicit zero request window/rate and empty package set are not fabricated defaults", () => {
    const p = buildPolicyInput("renewal", {
      ...draft,
      requestWindowDays: "0",
      depositRate: "0",
    })
    expect(p).toMatchObject({
      expectedRevision: 0,
      requestWindowDays: 0,
      depositRate: 0,
      eligiblePackageIds: [],
      signing: null,
      term: null,
    })
  })
  it("requires full signing and sequential calendar-day term policy", () => {
    expect(() =>
      buildPolicyInput("renewal", { ...draft, signingEnabled: "true" }),
    ).toThrow()
    expect(() =>
      buildPolicyInput("renewal", {
        ...draft,
        termEnabled: "true",
        warningThroughDay: "1",
        seriousThroughDay: "2",
        urgentThroughDay: "3",
        recoveryFromDay: "5",
        recoveryCutoffTime: "12:00",
        recoveryStartTime: "13:00",
      }),
    ).toThrow()
  })
  it("support close permission is not silently true or inferred from checkbox alone", () => {
    expect(() =>
      buildPolicyInput("communication", {
        expectedRevision: "0",
        effectiveFrom: "2026-10-10",
        supportEnabled: "true",
        supportReviewDays: "7",
      }),
    ).toThrow()
    expect(
      buildPolicyInput("communication", {
        expectedRevision: "0",
        effectiveFrom: "2026-10-10",
        supportEnabled: "true",
        supportReviewDays: "7",
        customerMayClose: "false",
      }),
    ).toMatchObject({
      customerMayClose: false,
      supportReviewDays: 7,
      reminderCooldownMinutes: null,
    })
  })
  it("readback reconciles only same publisher, revision and exact input fields", () => {
    const p = buildPolicyInput("renewal", draft)
    const stored = {
      ...p,
      schema: "RENEWAL_POLICY_V1",
      facilityId: ids.facility,
      revision: 1,
      version: "v1",
      publishedBy: ids.manager,
      publishedAt: instant,
    } as RenewalPolicy
    expect(policyMatches(stored, p, ids.manager)).toBe(true)
    expect(policyMatches({ ...stored, revision: 2 }, p, ids.manager)).toBe(
      false,
    )
    expect(policyMatches({ ...stored, depositRate: 0.5 }, p, ids.manager)).toBe(
      false,
    )
    expect(policyMatches(stored, p, ids.customer)).toBe(false)
    expect(policyDraft(stored).expectedRevision).toBe("1")
    expect(buildPolicyInput("renewal", policyDraft(stored))).toMatchObject({
      ...p,
      expectedRevision: 1,
    })
  })
  it("file inputs and downloads have natural labels, no rendered raw UUID or public fake href", () => {
    let html = renderToStaticMarkup(
      <EvidenceUpload
        entityType="DUONG_RENEWAL_INCIDENT"
        entityId={ids.renewal}
        value={[]}
        onChange={vi.fn()}
      />,
    )
    expect(html).toContain("Đính kèm minh chứng")
    expect(html).toContain('type="file"')
    expect(html).not.toContain(ids.renewal)
    html = renderToStaticMarkup(<EvidenceDownload id={ids.file} />)
    expect(html).toContain("Tải minh chứng 1")
    expect(html).toContain('type="button"')
    expect(html).not.toContain(ids.file)
    expect(html).not.toContain("href=")
  })
})
