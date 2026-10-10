import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { clearAuthTokens, setAccessToken } from "../../services/apiClient"
import { getRenewalExceptionProposal, isExceptionProposal, sendRenewalOperation } from "../../services/renewalOperationsApi"
import type { RenewalExceptionProposal } from "../../types/renewalOperationsApi"
import { exceptionConfirmationBlockedReason, exceptionConfirmationCommand, operationBlockedReason } from "./operationsPresentation"
import ProposalCard from "./RenewalExceptionProposalCard"
import { ids, signingState, operationsActor } from "../../../tests/rentalOperationsApiFixtures"

const now = Date.parse("2026-10-09T02:00:00Z")
const state = { ...signingState, pendingExceptionRef: ids.file }
const proposal: RenewalExceptionProposal = {
  renewalId: ids.renewal, expectedVersion: state.expectedVersion, decisionRef: ids.file,
  status: "AVAILABLE", checkedAt: new Date(now).toISOString(),
  currentAppointmentStart: state.appointmentStart, currentAppointmentEnd: state.appointmentEnd,
  currentSigningDeadline: state.effectiveSigningDeadline,
  proposedAppointmentStart: "2026-10-10T03:00:00Z", proposedAppointmentEnd: "2026-10-10T04:00:00Z",
  proposedSigningDeadline: "2026-10-12T02:00:00Z", validUntil: "2026-10-10T03:00:00Z",
  confirmationAllowed: true, disabledReasons: [],
}
function response(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); clearAuthTokens() })
describe("D3 authorized Customer exception confirmation", () => {
  it("reads only the Customer-safe endpoint with authentication", async () => {
    setAccessToken("TEST-token")
    const fetch = response({ data: proposal })
    expect(await getRenewalExceptionProposal(ids.renewal)).toEqual(proposal)
    expect(fetch.mock.calls[0][0]).toContain(`/api/customer/renewals/${ids.renewal}/exception-proposal`)
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer TEST-token")
    expect(fetch.mock.calls[0][0]).not.toContain("facility-incidents")
  })
  it.each([401, 403, 404, 409, 500])("does not fabricate a proposal on HTTP %s", async status => {
    response({ message: "TEST denied" }, status)
    await expect(getRenewalExceptionProposal(ids.renewal)).rejects.toThrow()
  })
  it.each([
    { renewalId: ids.rental }, { expectedVersion: -1 }, { decisionRef: "user-input" },
    { checkedAt: "invalid" }, { proposedAppointmentEnd: proposal.proposedAppointmentStart },
    { proposedSigningDeadline: proposal.proposedAppointmentStart }, { validUntil: proposal.checkedAt },
    { confirmationAllowed: false }, { disabledReasons: ["UNKNOWN_SOURCE"] },
  ])("rejects invalid successful response %j", async patch => {
    response({ data: { ...proposal, ...patch } })
    await expect(getRenewalExceptionProposal(ids.renewal)).rejects.toThrow("contract")
  })
  it("retains honest empty and unavailable states", () => {
    expect(isExceptionProposal({ ...proposal, decisionRef: null, status: "NONE", confirmationAllowed: false, disabledReasons: ["NO_CURRENT_PROPOSAL"] })).toBe(true)
    expect(isExceptionProposal({ ...proposal, status: "UNAVAILABLE", proposedAppointmentEnd: null, confirmationAllowed: false, disabledReasons: ["SOURCE_UNAVAILABLE"] })).toBe(true)
    expect(isExceptionProposal({ ...proposal, status: "UNAVAILABLE", confirmationAllowed: true })).toBe(false)
  })
  it("only enables the correct Customer with current visible proposal", () => {
    expect(operationBlockedReason(state, "customer", "confirmation", operationsActor("customer"), ids.facility, ids.customer, proposal, now)).toBeNull()
    expect(operationBlockedReason(state, "customer", "confirmation", operationsActor("customer"), ids.facility, ids.staff, proposal, now)).toContain("của bạn")
    expect(operationBlockedReason(state, "manager", "confirmation", operationsActor("manager"), ids.facility, ids.customer, proposal, now)).toContain("không có quyền")
    expect(operationBlockedReason({ ...state, missingSources: ["SERVICE_CALENDAR"] }, "customer", "confirmation", operationsActor("customer"), ids.facility, ids.customer, proposal, now)).toContain("Chưa đủ thông tin")
  })
  it.each([undefined, null])("never confirms from a reference without a readable proposal", p => {
    expect(exceptionConfirmationBlockedReason(state, p, now)).toContain("nội dung đề xuất")
    expect(() => exceptionConfirmationCommand(state, p, now)).toThrow()
  })
  it.each([{ renewalId: ids.rental }, { decisionRef: ids.event }, { expectedVersion: 3 }])("blocks stale/foreign/superseded proposal %j", patch => {
    expect(exceptionConfirmationBlockedReason(state, { ...proposal, ...patch }, now)).toContain("thay đổi")
    expect(() => exceptionConfirmationCommand(state, { ...proposal, ...patch }, now)).toThrow()
  })
  it("expires confirmation while the page stays open", () => {
    expect(exceptionConfirmationBlockedReason(state, proposal, Date.parse(proposal.validUntil!) - 1)).toBeNull()
    expect(exceptionConfirmationBlockedReason(state, proposal, Date.parse(proposal.validUntil!))).toContain("hết hạn")
  })
  it("blocks revoked/unavailable proposals without guessing readiness", () => {
    expect(() => exceptionConfirmationCommand(state, { ...proposal, status: "UNAVAILABLE", confirmationAllowed: false, disabledReasons: ["SOURCE_UNAVAILABLE"] }, now)).toThrow()
  })
  it("sends only exact reference/version and idempotency key, no proposed dates or internal fields", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const nextState = { ...state, expectedVersion: state.expectedVersion! + 1, pendingExceptionRef: null, confirmedExceptionRef: proposal.decisionRef }
    const fetch = response({ data: { state: nextState, event: { id: ids.event, kind: "CONFIRMATION", occurredAt: proposal.checkedAt, actorId: null, data: { decisionRef: proposal.decisionRef, appointmentRef: ids.event } } } })
    const command = exceptionConfirmationCommand(state, proposal, now)
    await sendRenewalOperation(ids.renewal, command, "TEST-same-key")
    expect(fetch.mock.calls[0][0]).toContain("/exception-confirmations")
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ decisionRef: ids.file, expectedVersion: state.expectedVersion })
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Idempotency-Key")).toBe("TEST-same-key")
  })
  it("renders old/new appointment and signing deadline in Vietnam time, never raw metadata", () => {
    const html = renderToStaticMarkup(<ProposalCard proposal={{ ...proposal, reason: "SECRET_INTERNAL", evidenceFileIds: [ids.file] } as RenewalExceptionProposal} />)
    expect(html).toContain("Lịch hiện tại"); expect(html).toContain("Lịch được đề xuất")
    expect(html).toContain("Hạn ký được đề xuất"); expect(html).toContain("10/10/2026"); expect(html).toContain("10:00")
    expect(html).not.toContain("SECRET_INTERNAL"); expect(html).not.toContain(ids.file)
  })
})
