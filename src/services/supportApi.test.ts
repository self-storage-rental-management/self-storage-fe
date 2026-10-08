import { afterEach, describe, expect, it, vi } from "vitest"
import { clearAuthTokens, setAccessToken } from "./apiClient"
import {
  createSupportTicket,
  getSupportTicket,
  listSupportEscalations,
  listSupportEvents,
  listSupportMessages,
  listSupportStaff,
  listSupportTickets,
  sendSupportCommand,
} from "./supportApi"
import type {
  SupportCommand,
  SupportQuery,
  SupportRole,
} from "../types/supportApi"
import {
  supportActive,
  supportEscalation,
  supportEvent,
  supportIds as ids,
  supportMessage,
  supportPage,
  supportTicket,
} from "../../tests/supportApiFixtures"

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
describe("D5 transport and response boundaries", () => {
  it.each(["customer", "manager", "staff"] as const)(
    "uses real %s endpoint and existing Bearer transport",
    async (role) => {
      setAccessToken("test-token")
      const fetch = respond(supportPage([supportTicket]))
      const result = await listSupportTickets(role, {
        status: "open",
        search: "literal %",
        sort: "createdAt,desc",
      })
      expect(result.data[0].sla).toBeNull()
      expect(result.data[0].slaCompleteness).toBe("UNKNOWN")
      const [url, init] = fetch.mock.calls[0]
      expect(url).toContain(`/api/${role}/support-tickets`)
      expect(new URL(url).searchParams.get("search")).toBe("literal %")
      expect(new Headers(init.headers).get("Authorization")).toBe(
        "Bearer test-token",
      )
    },
  )
  it.each([
    { page: -1 },
    { size: 101 },
    { page: 2147483647 },
    { sort: "priority,desc" },
    { status: "ACTIVE" },
    { priority: "HIGH" },
    { staffId: ids.staff },
  ])("rejects unsupported Customer filter %j before fetch", async (query) => {
    const fetch = respond(supportPage([]))
    await expect(
      listSupportTickets("customer", query as SupportQuery),
    ).rejects.toMatchObject({ code: "CLIENT_VALIDATION" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("passes Manager facility/staff filters, no scope chosen by name", async () => {
    const fetch = respond(supportPage([]))
    await listSupportTickets("manager", {
      facilityId: ids.facility,
      staffId: ids.staff,
    })
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.searchParams.get("facilityId")).toBe(ids.facility)
    expect(url.searchParams.get("staffId")).toBe(ids.staff)
  })
  it.each([
    { version: null },
    { assignmentRevision: -1 },
    { status: "completed" },
    { slaCompleteness: "COMPLETE", sla: null },
    { createdAt: "yesterday" },
    { linkedId: ids.foreign, linkedType: null },
  ])("fails closed on malformed ticket %j", async (patch) => {
    respond({ data: { ...supportTicket, ...patch } })
    await expect(
      getSupportTicket("customer", ids.ticket),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("rejects a different ticket returned by detail", async () => {
    respond({ data: { ...supportTicket, id: ids.foreign } })
    await expect(getSupportTicket("manager", ids.ticket)).rejects.toMatchObject(
      { code: "INVALID_RESPONSE" },
    )
  })
  it("retains unknown legacy version, never fills zero", async () => {
    respond({
      data: {
        ...supportTicket,
        workflowReady: false,
        version: null,
        assignmentRevision: null,
      },
    })
    expect((await getSupportTicket("manager", ids.ticket)).version).toBeNull()
  })
  it("rejects inconsistent pagination rather than fabricating empty success", async () => {
    const p = supportPage([supportTicket])
    respond({ ...p, pagination: { ...p.pagination, totalItems: 0 } })
    await expect(listSupportTickets("manager")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("Customer cannot read internal message response", async () => {
    respond(
      supportPage([
        {
          ...supportMessage,
          authorRole: "STAFF",
          visibility: "INTERNAL",
          body: "Private",
        },
      ]),
    )
    await expect(
      listSupportMessages("customer", ids.ticket),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("Staff can read explicitly internal messages", async () => {
    respond(
      supportPage([
        { ...supportMessage, authorRole: "STAFF", visibility: "INTERNAL" },
      ]),
    )
    expect(
      (await listSupportMessages("staff", ids.ticket)).data[0].visibility,
    ).toBe("INTERNAL")
  })
  it("does not infer readable attachment IDs from missing source", async () => {
    respond(
      supportPage([
        {
          ...supportMessage,
          evidenceCompleteness: "UNKNOWN",
          evidenceFileIds: null,
        },
      ]),
    )
    expect(
      (await listSupportMessages("customer", ids.ticket)).data[0]
        .evidenceFileIds,
    ).toBeNull()
  })
  it("rejects foreign-ticket timeline data", async () => {
    respond(supportPage([{ ...supportMessage, ticketId: ids.foreign }]))
    await expect(
      listSupportMessages("manager", ids.ticket),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it.each(["events", "escalations"])(
    "never calls Customer internal %s endpoint",
    async (kind) => {
      const fetch = respond(supportPage([]))
      const request =
        kind === "events" ? listSupportEvents : listSupportEscalations
      await expect(request("customer", ids.ticket)).rejects.toMatchObject({
        code: "CLIENT_VALIDATION",
      })
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it("reads separate internal events and escalation pages for Manager", async () => {
    const fetch = respond(supportPage([supportEvent]))
    await listSupportEvents("manager", ids.ticket)
    expect(fetch.mock.calls[0][0]).toContain(
      `/${ids.ticket}/events?page=0&size=20`,
    )
    respond(supportPage([supportEscalation]))
    expect(
      (await listSupportEscalations("manager", ids.ticket)).data[0].resultRef,
    ).toBeNull()
  })
  it("ROUTED is not fabricated as receiver completion", async () => {
    respond(
      supportPage([
        { ...supportEscalation, status: "ROUTED", receiverRef: ids.foreign },
      ]),
    )
    const e = (await listSupportEscalations("manager", ids.ticket)).data[0]
    expect(e.receiverStatus).toBeNull()
    expect(e.resultRef).toBeNull()
  })
  it("receiver COMPLETED requires actual result reference", async () => {
    respond(
      supportPage([
        {
          ...supportEscalation,
          receiverStatus: "COMPLETED",
          receiverRef: ids.foreign,
        },
      ]),
    )
    await expect(
      listSupportEscalations("manager", ids.ticket),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("eligible Staff comes from backend options and is paginated", async () => {
    const fetch = respond(
      supportPage([{ id: ids.staff, fullName: "Test-only Staff" }]),
    )
    expect((await listSupportStaff(ids.facility)).data[0].id).toBe(ids.staff)
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("facilityId")).toBe(
      ids.facility,
    )
  })
})
describe("D5 commands: exact DTO, idempotency and role restrictions", () => {
  const cases: { role: SupportRole command: SupportCommand route: string }[] = [
    {
      role: "manager",
      command: {
        kind: "assign",
        assignedStaffId: ids.staff,
        expectedVersion: 0,
        reason: "Test assignment",
      },
      route: "assignment",
    },
    {
      role: "staff",
      command: { kind: "accept", expectedVersion: 1 },
      route: "accept",
    },
    {
      role: "customer",
      command: { kind: "message", body: "Test reply", expectedVersion: 2 },
      route: "messages",
    },
    {
      role: "staff",
      command: {
        kind: "message",
        body: "Internal note",
        visibility: "INTERNAL",
      },
      route: "messages",
    },
    {
      role: "staff",
      command: {
        kind: "information",
        message: "Need information",
        expectedVersion: 2,
      },
      route: "request-information",
    },
    {
      role: "staff",
      command: {
        kind: "resolve",
        summary: "Verified answer",
        expectedVersion: 2,
      },
      route: "resolution",
    },
    {
      role: "customer",
      command: { kind: "close", feedback: "Confirmed", expectedVersion: 3 },
      route: "close",
    },
    {
      role: "customer",
      command: { kind: "reopen", reason: "Still broken", expectedVersion: 3 },
      route: "reopen",
    },
    {
      role: "staff",
      command: {
        kind: "escalate",
        targetModule: "PAYMENT",
        reason: "Need owner",
        expectedVersion: 2,
      },
      route: "escalations",
    },
    {
      role: "manager",
      command: {
        kind: "decision",
        escalationId: ids.escalation,
        action: "ROUTE",
        reason: "Coordinate",
        expectedVersion: 3,
      },
      route: `escalations/${ids.escalation}/decision`,
    },
  ]
  it.each(cases)(
    "serializes $role/$route with required key and no UI fields",
    async ({ role, command, route }) => {
      const data =
        command.kind === "message"
          ? supportMessage
          : ["decision", "escalate"].includes(command.kind)
            ? supportEscalation
            : supportActive
      const fetch = respond({ data })
      await sendSupportCommand(role, ids.ticket, command, "stable-test-key")
      const [url, init] = fetch.mock.calls[0]
      expect(new URL(url).pathname).toBe(
        `/api/${role}/support-tickets/${ids.ticket}/${route}`,
      )
      expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
        "stable-test-key",
      )
      const payload = JSON.parse(init.body)
      expect(payload).not.toHaveProperty("kind")
      expect(payload).not.toHaveProperty("escalationId")
      if (command.kind !== "message")
        expect(payload.expectedVersion).toBe(command.expectedVersion)
      if (role === "customer") expect(payload).not.toHaveProperty("visibility")
    },
  )
  it.each([
    ["manager", { kind: "resolve", summary: "Forbidden", expectedVersion: 0 }],
    [
      "customer",
      {
        kind: "assign",
        assignedStaffId: ids.staff,
        reason: "Forbidden",
        expectedVersion: 0,
      },
    ],
    ["staff", { kind: "close", expectedVersion: 0 }],
  ] as const)("blocks role override %s before fetch", async (role, command) => {
    const fetch = respond({ data: supportTicket })
    await expect(
      sendSupportCommand(role, ids.ticket, command, "key"),
    ).rejects.toMatchObject({ code: "CLIENT_VALIDATION" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([
    { kind: "message", body: "Private", visibility: "INTERNAL" },
    {
      kind: "message",
      body: "Blank file",
      evidenceFileIds: [ids.foreign, ids.foreign],
    },
    { kind: "reopen", reason: "Changed", expectedVersion: -1 },
    { kind: "close", expectedVersion: 0, result: "COMPLETED" },
  ])("rejects malicious Customer DTO %j", async (command) => {
    const fetch = respond({ data: supportTicket })
    await expect(
      sendSupportCommand(
        "customer",
        ids.ticket,
        command as SupportCommand,
        "key",
      ),
    ).rejects.toMatchObject({ code: "CLIENT_VALIDATION" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("does not assign without a Staff UUID", async () => {
    const fetch = respond({ data: supportTicket })
    await expect(
      sendSupportCommand(
        "manager",
        ids.ticket,
        {
          kind: "assign",
          assignedStaffId: "",
          reason: "Missing",
          expectedVersion: 0,
        },
        "key",
      ),
    ).rejects.toMatchObject({ code: "CLIENT_VALIDATION" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("requires explicit Staff message visibility", async () => {
    const fetch = respond({ data: supportMessage })
    await expect(
      sendSupportCommand(
        "staff",
        ids.ticket,
        { kind: "message", body: "Ambiguous" },
        "key",
      ),
    ).rejects.toMatchObject({ code: "CLIENT_VALIDATION" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("creates linked owned record without fabricated facility or priority", async () => {
    const fetch = respond({ data: supportTicket })
    await createSupportTicket(
      {
        subject: "Question",
        description: "Help",
        linkedRecord: { type: "RENTAL", id: ids.foreign },
      },
      "create-key",
    )
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.linkedRecord.id).toBe(ids.foreign)
    expect(body).not.toHaveProperty("facilityId")
    expect(body).not.toHaveProperty("priority")
  })
  it("new unlinked ticket requires active facility selection, not null default", async () => {
    const fetch = respond({ data: supportTicket })
    await expect(
      createSupportTicket({ subject: "Question", description: "Help" }, "key"),
    ).rejects.toMatchObject({ code: "CLIENT_VALIDATION" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("follow-up uses closed parent route and lets BE derive parent facility", async () => {
    const fetch = respond({
      data: { ...supportTicket, id: ids.foreign, parentTicketId: ids.ticket },
    })
    await createSupportTicket(
      { subject: "Follow-up", description: "Issue persists" },
      "follow-key",
      ids.ticket,
    )
    expect(fetch.mock.calls[0][0]).toContain(`/${ids.ticket}/follow-ups`)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty(
      "facilityId",
    )
  })
  it.each([400, 401, 403, 404, 409, 503])(
    "propagates HTTP %i, no demo fallback or false success",
    async (status) => {
      respond(
        {
          error: {
            code: "CONFLICT",
            message: "DEFERRED_SOURCE: test-only shared policy",
          },
        },
        status,
      )
      await expect(
        sendSupportCommand(
          "customer",
          ids.ticket,
          { kind: "close", expectedVersion: 3 },
          "key",
        ),
      ).rejects.toMatchObject({
        status,
        message: "DEFERRED_SOURCE: test-only shared policy",
      })
    },
  )
})
