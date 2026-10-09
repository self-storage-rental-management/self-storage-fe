import { afterEach, describe, expect, it, vi } from "vitest"
import { clearAuthTokens, setAccessToken } from "./apiClient"
import {
  getRenewalOperations,
  getRenewalPayableStatement,
  listRenewalAppointments,
  listRenewalOperationEvents,
  sendRenewalOperation,
} from "./renewalOperationsApi"
import {
  getOverdueCase,
  listOverdueCases,
  listOverdueFollowUps,
  sendOverdueFollowUp,
} from "./overdueApi"
import type { RenewalOperationCommand } from "../types/renewalOperationsApi"
import {
  apiPage,
  debtCase,
  followUp,
  ids,
  instant,
  operationEvent,
  operationState,
  overduePage,
  payableStatement,
  signingState,
  termCase,
} from "../../tests/rentalOperationsApiFixtures"

function respond(value: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    )
  vi.stubGlobal("fetch", fetch)
  return fetch
}
afterEach(() => {
  vi.unstubAllGlobals()
  clearAuthTokens()
})
describe("D3 real API transport", () => {
  it.each(["customer", "manager", "staff"] as const)(
    "reads %s operational route without demo fallback",
    async (role) => {
      setAccessToken("token")
      const fetch = respond({ data: signingState })
      expect(await getRenewalOperations(role, ids.renewal)).toEqual(
        signingState,
      )
      expect(fetch.mock.calls[0][0]).toContain(
        `/api/${role}/renewals/${ids.renewal}${
          role === "staff" ? "" : "/operations"
        }`,
      )
      expect(
        new Headers(fetch.mock.calls[0][1].headers).get("Authorization"),
      ).toBe("Bearer token")
    },
  )
  it("keeps null version and deferred sources, never fabricates zero", async () => {
    const data = {
      ...operationState,
      phase: "UNKNOWN",
      expectedVersion: null,
      missingSources: ["BO_SIGNING_POLICY", "RENEWAL_ACCOUNTING"],
    }
    respond({ data })
    expect(await getRenewalOperations("customer", ids.renewal)).toEqual(data)
  })
  it.each([
    { expectedVersion: -1 },
    { expectedVersion: "4" },
    { phase: "ACTIVE" },
    { missingSources: null },
    { renewalId: ids.rental },
    { appointmentRef: ids.event },
    { ...signingState, appointmentEnd: "2026-10-09T02:00:00Z" },
  ])("rejects invalid operational response %j", async (patch) => {
    respond({ data: { ...operationState, ...patch } })
    await expect(
      getRenewalOperations("manager", ids.renewal),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("passes only supported Staff queue filters; no check-in endpoint", async () => {
    const fetch = respond(apiPage([signingState]))
    await listRenewalAppointments({
      facilityId: ids.facility,
      date: "2026-10-08",
      status: "SIGNING",
      page: 2,
      size: 10,
    })
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.pathname).toBe("/api/staff/renewal-appointments")
    expect([...url.searchParams.keys()].sort()).toEqual([
      "date",
      "facilityId",
      "page",
      "size",
      "status",
    ])
  })
  it.each([
    { size: 101 },
    { page: -1 },
    { facilityId: "fake" },
    { status: "pending" },
    { date: "08/10/2026" },
  ])("rejects invalid queue input %j before fetch", async (q) => {
    const fetch = respond(apiPage([]))
    await expect(
      listRenewalAppointments(
        q as Parameters<typeof listRenewalAppointments>[0],
      ),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  const commands: [RenewalOperationCommand, string, string, string][] = [
    [
      { action: "deposit", body: { expectedVersion: 4 } },
      "customer",
      "POST",
      "simulated-payment",
    ],
    [
      {
        action: "appointment",
        body: { expectedVersion: 4, appointmentAt: instant },
      },
      "customer",
      "POST",
      "appointment",
    ],
    [
      {
        action: "reschedule",
        body: { expectedVersion: 4, appointmentAt: instant, reason: "Đổi giờ" },
      },
      "customer",
      "PATCH",
      "appointment",
    ],
    [
      {
        action: "confirmation",
        body: { expectedVersion: 4, decisionRef: ids.event },
      },
      "customer",
      "POST",
      "exception-confirmations",
    ],
    [
      {
        action: "arrival",
        body: {
          expectedVersion: 4,
          appointmentRef: ids.event,
          evidenceFileIds: [ids.file],
        },
      },
      "staff",
      "POST",
      "arrival",
    ],
    [
      {
        action: "incident",
        body: {
          expectedVersion: 4,
          appointmentRef: ids.event,
          reason: "Sự cố",
          evidenceFileIds: [],
        },
      },
      "staff",
      "POST",
      "facility-incidents",
    ],
    [
      {
        action: "cash",
        body: {
          expectedVersion: 4,
          payableStatementRef: ids.statement,
          receiptReference: "REAL-RECEIPT",
          received: true,
        },
      },
      "staff",
      "POST",
      "cash-receipts",
    ],
    [
      {
        action: "completion",
        body: {
          expectedVersion: 4,
          identityVerified: true,
          arrivalRef: ids.event,
          signedDocumentFileId: ids.file,
        },
      },
      "staff",
      "POST",
      "completion",
    ],
    [
      {
        action: "exception",
        body: {
          expectedVersion: 4,
          incidentId: ids.event,
          action: "REJECT",
          reason: "Không đủ điều kiện",
          evidenceFileIds: [],
        },
      },
      "manager",
      "POST",
      "exception-decisions",
    ],
    [
      {
        action: "refund",
        body: {
          expectedVersion: 4,
          incidentId: ids.event,
          decision: "REJECT",
          reason: "Không đủ điều kiện",
          evidenceFileIds: [],
        },
      },
      "manager",
      "POST",
      "refund-decisions",
    ],
  ]
  it.each(commands)("rejects injected actor/amount fields for $action before transport", async command => {
    const fetch = respond({ data: { state: { ...signingState, expectedVersion: 5 }, event: operationEvent } })
    const injected = { ...command, body: { ...command.body, actorId: ids.customer, amount: 1 } } as unknown as RenewalOperationCommand
    await expect(sendRenewalOperation(ids.renewal, injected, "injected-fields")).rejects.toThrow("Trường lệnh")
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(commands)(
    "sends exact action $action role/payload/version/key",
    async (command, role, method, route) => {
      const kinds = {
        deposit: "DEPOSIT",
        appointment: "APPOINTMENT",
        reschedule: "APPOINTMENT",
        confirmation: "CONFIRMATION",
        arrival: "ARRIVAL",
        incident: "INCIDENT",
        cash: "CASH",
        completion: "COMPLETION",
        exception: "EXCEPTION",
        refund: "REFUND",
      }
      const data =
        command.action === "deposit"
          ? operationEvent.data
          : command.action === "cash"
            ? {
                reference: ids.event,
                renewalId: ids.renewal,
                statementRef: ids.statement,
                amount: 12804000,
                currency: "VND",
                receivedAt: instant,
              }
            : command.action === "refund"
              ? { status: "REJECTED" }
              : command.body
      const fetch = respond({
        data: {
          state: { ...signingState, expectedVersion: 5 },
          event: { ...operationEvent, kind: kinds[command.action], data },
        },
      })
      await sendRenewalOperation(ids.renewal, command, "same-retry-key")
      const [url, options] = fetch.mock.calls[0]
      expect(url).toContain(`/api/${role}/renewals/${ids.renewal}/${route}`)
      expect(options.method).toBe(method)
      expect(JSON.parse(options.body)).toEqual(command.body)
      expect(new Headers(options.headers).get("Idempotency-Key")).toBe(
        "same-retry-key",
      )
      expect(options.body).not.toContain('"amount"')
      expect(options.body).not.toContain('"outcome"')
    },
  )
  it.each([
    { action: "deposit", body: { expectedVersion: null } },
    {
      action: "arrival",
      body: {
        expectedVersion: 4,
        appointmentRef: ids.event,
        evidenceFileIds: [ids.file, ids.file],
      },
    },
    {
      action: "arrival",
      body: {
        expectedVersion: 4,
        appointmentRef: ids.event,
        evidenceFileIds: ["https://example.test/proof"],
      },
    },
    {
      action: "incident",
      body: {
        expectedVersion: 4,
        appointmentRef: ids.event,
        evidenceFileIds: [],
        reason: " ",
      },
    },
    {
      action: "reschedule",
      body: { expectedVersion: 4, appointmentAt: instant },
    },
    {
      action: "appointment",
      body: { expectedVersion: 4, appointmentAt: "2026-10-08T10:00" },
    },
    {
      action: "cash",
      body: {
        expectedVersion: 4,
        payableStatementRef: ids.statement,
        receiptReference: "x",
        received: false,
      },
    },
    {
      action: "completion",
      body: {
        expectedVersion: 4,
        identityVerified: false,
        arrivalRef: ids.event,
        signedDocumentFileId: ids.file,
      },
    },
    {
      action: "exception",
      body: {
        expectedVersion: 4,
        incidentId: ids.event,
        action: "REJECT",
        reason: "Không đồng ý",
        evidenceFileIds: [],
        revisedDeadline: instant,
      },
    },
    {
      action: "exception",
      body: {
        expectedVersion: 4,
        incidentId: ids.event,
        action: "APPROVE_RESCHEDULE_BEFORE_CUTOFF",
        reason: "Đổi giờ",
        evidenceFileIds: [],
      },
    },
  ])("blocks malformed mutation before request %j", async (command) => {
    const fetch = respond({ data: {} })
    await expect(
      sendRenewalOperation(
        ids.renewal,
        command as RenewalOperationCommand,
        "key",
      ),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("passes proposed dates only on reschedule decision", async () => {
    const body = {
      expectedVersion: 4,
      incidentId: ids.event,
      action: "APPROVE_RESCHEDULE_BEFORE_CUTOFF" as const,
      reason: "Sự cố cơ sở",
      evidenceFileIds: [ids.file],
      appointmentAt: instant,
      revisedDeadline: "2026-10-11T03:00:00Z",
    }
    const fetch = respond({
      data: {
        state: { ...signingState, expectedVersion: 5 },
        event: { ...operationEvent, kind: "EXCEPTION", data: body },
      },
    })
    await sendRenewalOperation(
      ids.renewal,
      { action: "exception", body },
      "key",
    )
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body)
  })
  it("reads authoritative payable statement without calculating remainder", async () => {
    const fetch = respond({ data: payableStatement })
    expect(await getRenewalPayableStatement(ids.renewal)).toEqual(
      payableStatement,
    )
    expect(fetch.mock.calls[0][0]).toContain(
      `/staff/renewals/${ids.renewal}/payable-statement`,
    )
  })
  it.each([
    { amount: -1 },
    { amount: "100" },
    { renewalId: ids.rental },
    { requiredObligations: [] },
    { requiredObligations: [ids.obligation, ids.obligation] },
    { currency: "USD" },
  ])("rejects inconsistent statement %j", async (patch) => {
    respond({ data: { ...payableStatement, ...patch } })
    await expect(getRenewalPayableStatement(ids.renewal)).rejects.toMatchObject(
      { code: "INVALID_RESPONSE" },
    )
  })
  it("uses paged event contract and refuses wrong category/role", async () => {
    const fetch = respond(apiPage([operationEvent]))
    await listRenewalOperationEvents("customer", ids.renewal, "payments", 3, 10)
    expect(fetch.mock.calls[0][0]).toContain("/payments?page=3&size=10")
    await expect(
      listRenewalOperationEvents("customer", ids.renewal, "facility-incidents"),
    ).rejects.toThrow()
    await expect(
      listRenewalOperationEvents("staff", ids.renewal, "refunds"),
    ).rejects.toThrow()
    respond(apiPage([{ ...operationEvent, kind: "INCIDENT" }]))
    await expect(
      listRenewalOperationEvents("customer", ids.renewal, "payments"),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("preserves 409 missing source without showing payment success", async () => {
    respond(
      {
        error: {
          code: "CONFLICT",
          message: "DEFERRED_SOURCE: Renewal accounting missing",
        },
      },
      409,
    )
    await expect(
      sendRenewalOperation(
        ids.renewal,
        { action: "deposit", body: { expectedVersion: 4 } },
        "key",
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("DEFERRED_SOURCE"),
    })
  })
  it.each([
    { event: { ...operationEvent, kind: "COMPLETION" } },
    {
      event: {
        ...operationEvent,
        data: { ...operationEvent.data as object, renewalId: ids.rental },
      },
    },
    {
      event: {
        ...operationEvent,
        data: { ...operationEvent.data as object, amount: "100" },
      },
    },
    { state: { ...signingState, expectedVersion: 4 } },
  ])(
    "rejects unrelated event/money/stale mutation result %j",
    async (patch) => {
      respond({
        data: {
          state: { ...signingState, expectedVersion: 5 },
          event: operationEvent,
          ...patch,
        },
      })
      await expect(
        sendRenewalOperation(
          ids.renewal,
          { action: "deposit", body: { expectedVersion: 4 } },
          "key",
        ),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
    },
  )
})
describe("D4 real overdue transport", () => {
  it("retains null term money and authoritative debt, server completeness/asOf", async () => {
    const fetch = respond(overduePage)
    expect(
      await listOverdueCases({
        kind: "ALL",
        sort: "priority,desc",
        page: 0,
        size: 20,
      }),
    ).toEqual(overduePage)
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("sort")).toBe(
      "priority,desc",
    )
  })
  it("keeps PARTIAL empty result and missing sources", async () => {
    const data = {
      ...overduePage,
      ...apiPage([]),
      completeness: "PARTIAL",
      missingSources: ["AUTHORITATIVE_OBLIGATIONS_ALLOCATIONS"],
    }
    respond(data)
    expect(await listOverdueCases()).toEqual(data)
  })
  it.each([
    { asOf: null },
    { completeness: "UNKNOWN" },
    { completeness: "PARTIAL" },
    { missingSources: ["source"] },
    { data: [{ ...termCase, outstanding: 0 }] },
    { data: [{ ...debtCase, outstanding: -1 }] },
    { data: [{ ...debtCase, recoveryEligible: true }] },
    { data: [{ ...debtCase, obligationRef: ids.event }] },
  ])("rejects inconsistent list %j", async (patch) => {
    respond({ ...overduePage, ...patch })
    await expect(listOverdueCases()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("encodes stable reference path and preserves follow-up stream version", async () => {
    const fetch = respond({ data: termCase })
    expect(await getOverdueCase(termCase.caseRef)).toEqual(termCase)
    expect(fetch.mock.calls[0][0]).toContain(
      encodeURIComponent(termCase.caseRef),
    )
  })
  it.each(["NOTE", "REMINDER", "RECOVERY_HANDOFF"] as const)(
    "sends %s without fee/amount/financial version",
    async (type) => {
      const fetch = respond(
        {
          data: {
            ...followUp,
            type,
            externalRef: type === "NOTE" ? null : ids.event,
          },
        },
        201,
      )
      await sendOverdueFollowUp(
        termCase.caseRef,
        type,
        "Nội dung thật",
        2,
        "key",
      )
      const [url, options] = fetch.mock.calls[0]
      expect(url).toContain(
        `/${encodeURIComponent(termCase.caseRef)}/${
          type === "RECOVERY_HANDOFF" ? "recovery-handoffs" : "follow-ups"
        }`,
      )
      expect(JSON.parse(options.body)).toEqual(
        type === "RECOVERY_HANDOFF"
          ? { reason: "Nội dung thật", expectedVersion: 2 }
          : { type, content: "Nội dung thật", expectedVersion: 2 },
      )
      expect(new Headers(options.headers).get("Idempotency-Key")).toBe("key")
    },
  )
  it("reads immutable history independently after resolved current case", async () => {
    respond(
      { error: { code: "CONFLICT", message: "Case is no longer overdue" } },
      409,
    )
    await expect(getOverdueCase(termCase.caseRef)).rejects.toMatchObject({
      status: 409,
    })
    const fetch = respond(apiPage([followUp]))
    expect((await listOverdueFollowUps(termCase.caseRef, 0, 10)).data).toEqual([
      followUp,
    ])
    expect(fetch.mock.calls[0][0]).toContain("/follow-ups?page=0&size=10")
  })
  it("rejects legacy or fabricated references and invalid versions before fetch", async () => {
    const fetch = respond({ data: followUp })
    await expect(getOverdueCase("CASE-01")).rejects.toThrow()
    await expect(
      sendOverdueFollowUp(termCase.caseRef, "NOTE", " ", 2, "key"),
    ).rejects.toThrow()
    await expect(
      sendOverdueFollowUp(termCase.caseRef, "NOTE", "note", -1, "key"),
    ).rejects.toThrow()
    await expect(
      sendOverdueFollowUp(termCase.caseRef, "NOTE", "note", 2, ""),
    ).rejects.toThrow()
    await expect(
      listOverdueCases({ sort: "monthlyPrice,desc" }),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("does not accept reminder/recovery success without external ACK", async () => {
    respond({ data: { ...followUp, type: "REMINDER" } }, 201)
    await expect(
      sendOverdueFollowUp(termCase.caseRef, "REMINDER", "Nhắc nợ", 2, "key"),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("keeps key/body identical on explicit network retry", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: followUp }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
    vi.stubGlobal("fetch", fetch)
    await expect(
      sendOverdueFollowUp(termCase.caseRef, "NOTE", "Nội dung", 2, "retry-key"),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" })
    await sendOverdueFollowUp(
      termCase.caseRef,
      "NOTE",
      "Nội dung",
      2,
      "retry-key",
    )
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body)
    expect(
      new Headers(fetch.mock.calls[0][1].headers).get("Idempotency-Key"),
    ).toBe(new Headers(fetch.mock.calls[1][1].headers).get("Idempotency-Key"))
  })
})
