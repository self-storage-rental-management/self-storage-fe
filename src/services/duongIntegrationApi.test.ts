import { afterEach, describe, expect, it, vi } from "vitest"
import * as auth from "./authApi"
import { clearAuthTokens, setAccessToken, ApiClientError } from "./apiClient"
import {
  acknowledgeNotification,
  getNotificationAcknowledgement,
  coordinateRenewal,
  getRentalLedger,
  getIntegrationPolicy,
  getStoredIntegrationPolicy,
  getRenewalAssignment,
  publishIntegrationPolicy,
  uploadDuongEvidence,
  downloadDuongEvidence,
  integrationError,
  validPolicyInput,
  type RenewalPolicyInput,
} from "./duongIntegrationApi"
import {
  ids,
  instant,
  operationState,
  operationEvent,
  operationsActor,
} from "../../tests/rentalOperationsApiFixtures"

function respond(data: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    )
  vi.stubGlobal("fetch", fetch)
  setAccessToken("integration-token")
  return fetch
}
describe("authoritative acknowledgement read", () => {
  it.each([
    { status: "AVAILABLE", acknowledgementAllowed: true, receivedAt: null },
    { status: "UNTRACKED", acknowledgementAllowed: false, receivedAt: null },
    { status: "ACKNOWLEDGED", acknowledgementAllowed: false, receivedAt: instant },
  ])("reads $status without posting acknowledgement", async state => {
    const data = { notificationId: ids.event, ...state }, fetch = respond({ data })
    expect(await getNotificationAcknowledgement(ids.event)).toEqual(data)
    expect(fetch.mock.calls[0][0]).toContain(`/api/customer/notifications/${ids.event}/acknowledgement`)
    expect(fetch.mock.calls[0][1].method ?? "GET").toBe("GET")
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer integration-token")
  })
  it.each([
    { notificationId: ids.staff, status: "AVAILABLE", acknowledgementAllowed: true, receivedAt: null },
    { notificationId: ids.event, status: "UNTRACKED", acknowledgementAllowed: true, receivedAt: null },
    { notificationId: ids.event, status: "ACKNOWLEDGED", acknowledgementAllowed: false, receivedAt: null },
    { notificationId: ids.event, status: "AVAILABLE", acknowledgementAllowed: true, receivedAt: instant },
  ])("rejects mismatched or contradictory state without inventing permission", async data => {
    respond({ data })
    await expect(getNotificationAcknowledgement(ids.event)).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it.each([401, 403, 404, 409, 503])("HTTP %i does not become AVAILABLE or ACKNOWLEDGED", async status => {
    respond({ error: { message: "Test" } }, status)
    await expect(getNotificationAcknowledgement(ids.event)).rejects.toMatchObject({ status })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearAuthTokens()
})
const unknownLedger = {
  rentalId: ids.rental,
  completeness: "UNKNOWN",
  currency: "VND",
  revision: null,
  obligations: null,
  receipts: null,
  refunds: null,
  reason: "Chưa có dữ liệu.",
}
const partialLedger = {
  ...unknownLedger,
  completeness: "PARTIAL",
  revision: 1,
  obligations: [
    {
      id: ids.obligation,
      renewalId: ids.renewal,
      kind: "RENT",
      amount: 100,
      outstanding: 100,
      dueAt: instant,
    },
  ],
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
}
const input: RenewalPolicyInput = {
  expectedRevision: 0,
  effectiveFrom: "2026-10-10",
  effectiveTo: null,
  quoteTtlMinutes: 5,
  paymentWindowHours: 24,
  requestWindowDays: 30,
  depositRate: 0.2,
  eligiblePackageIds: [],
  signing: null,
  term: null,
}
const policy = {
  ...input,
  expectedRevision: undefined,
  schema: "RENEWAL_POLICY_V1",
  facilityId: ids.facility,
  revision: 1,
  version: "published-v1",
  publishedBy: ids.manager,
  publishedAt: instant,
}
describe("Dương integration real transport contracts", () => {
  it("management readback uses stored snapshot, not the effective-policy endpoint", async () => {
    const fetch = respond({ data: { ...policy, effectiveFrom: "2099-01-01" } })
    await getStoredIntegrationPolicy("renewal", ids.facility, 1)
    expect(fetch.mock.calls[0][0]).toContain(`/renewal-policy/stored?revision=1`)
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer integration-token")
  })
  it("communication management can read an expired persisted snapshot", async () => {
    const { schema: _schema, ...base } = policy
    const data = { ...base, effectiveFrom: "2000-01-01", effectiveTo: "2001-01-01", reminderCooldownMinutes: null, supportReviewDays: 7, customerMayClose: false }
    const fetch = respond({ data })
    expect(await getStoredIntegrationPolicy("communication", ids.facility)).toEqual(data)
    expect(fetch.mock.calls[0][0]).toContain("/communication-policy/stored")
  })
  it("cannot use a later publication as proof of an uncertain earlier publication", async () => {
    respond({ data: { ...policy, revision: 2 } })
    await expect(getStoredIntegrationPolicy("renewal", ids.facility, 1)).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("missing readback never fabricates policy or a successful publication", async () => {
    respond({ error: { message: "not found" } }, 404)
    await expect(getStoredIntegrationPolicy("communication", ids.facility, 1)).rejects.toMatchObject({ status: 404 })
  })
  it.each([0, -1, 1.5, NaN])("invalid management revision %s never calls HTTP", async revision => {
    const fetch = respond({ data: policy })
    await expect(getStoredIntegrationPolicy("renewal", ids.facility, revision)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("assignment is read from the renewal resource on each detail load", async () => {
    const data = { renewalId: ids.renewal, expectedVersion: 1, status: "ASSIGNED", staffId: ids.staff, staffName: "Nhân viên kiểm thử" }
    const fetch = respond({ data })
    expect(await getRenewalAssignment(ids.renewal)).toEqual(data)
    await getRenewalAssignment(ids.renewal)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toContain(`/api/manager/renewals/${ids.renewal}/staff-assignment`)
  })
  it.each([
    { renewalId: ids.rental }, { status: "UNASSIGNED" }, { staffId: "bad" }, { expectedVersion: -1 },
  ])("rejects unbound or inconsistent assignment %j", async patch => {
    respond({ data: { renewalId: ids.renewal, expectedVersion: 1, status: "ASSIGNED", staffId: ids.staff, staffName: null, ...patch } })
    await expect(getRenewalAssignment(ids.renewal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it.each(["customer", "manager", "business"] as const)(
    "reads %s ledger using auth, without converting UNKNOWN into zero",
    async (role) => {
      const fetch = respond({ data: unknownLedger })
      expect(await getRentalLedger(role, ids.rental)).toEqual(unknownLedger)
      expect(fetch.mock.calls[0][0]).toContain(
        `/api/${role}/rentals/${ids.rental}/ledger`,
      )
      expect(
        new Headers(fetch.mock.calls[0][1].headers).get("Authorization"),
      ).toBe("Bearer integration-token")
    },
  )
  it("retains partial, simulation and reserved-refund semantics", async () => {
    respond({ data: partialLedger })
    expect(await getRentalLedger("customer", ids.rental)).toEqual(partialLedger)
  })
  it.each([
    { rentalId: ids.renewal },
    { completeness: "COMPLETE" },
    { revision: 0, receipts: [] },
    { obligations: [] },
  ])("rejects invented/misbound unknown ledger %j", async (patch) => {
    respond({ data: { ...unknownLedger, ...patch } })
    await expect(getRentalLedger("manager", ids.rental)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it.each([
    { receipts: [{ ...partialLedger.receipts[0], simulated: false }] },
    {
      obligations: [
        {
          ...partialLedger.obligations[0],
          amount: Number.MAX_SAFE_INTEGER + 1,
        },
      ],
    },
    { refunds: [{ ...partialLedger.refunds[0], status: "APPROVED" }] },
  ])(
    "rejects financial response that could mislead users %j",
    async (patch) => {
      respond({ data: { ...partialLedger, ...patch } })
      await expect(
        getRentalLedger("customer", ids.rental),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
    },
  )
  it.each([403, 404, 409, 500])(
    "does not replace ledger HTTP %s with demo",
    async (status) => {
      const fetch = respond({ message: "private-source-port" }, status)
      await expect(
        getRentalLedger("customer", ids.rental),
      ).rejects.toMatchObject({ status })
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )
  it("acknowledges only receipt, with no body and no ticket-close/read PATCH", async () => {
    const result = {
        notificationId: ids.event,
        status: "ACKNOWLEDGED",
        receivedAt: instant,
      },
      fetch = respond({ data: result })
    expect(await acknowledgeNotification(ids.event)).toEqual(result)
    expect(await acknowledgeNotification(ids.event)).toEqual(result)
    for (const call of fetch.mock.calls) {
      expect(call[0]).toContain(
        `/api/customer/notifications/${ids.event}/acknowledgement`,
      )
      expect(call[1].method).toBe("POST")
      expect(call[1].body).toBeUndefined()
    }
  })
  it.each([
    { notificationId: ids.file },
    { status: "DELIVERED" },
    { receivedAt: null },
  ])("rejects invalid receipt %j", async (patch) => {
    respond({
      data: {
        notificationId: ids.event,
        status: "ACKNOWLEDGED",
        receivedAt: instant,
        ...patch,
      },
    })
    await expect(acknowledgeNotification(ids.event)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  const assignment = {
    kind: "assignment" as const,
    expectedVersion: 4,
    assignedStaffId: ids.staff,
    reason: "Phân công tại cơ sở",
  }
  const assignmentResult = {
    state: { ...operationState, expectedVersion: 5 },
    event: {
      ...operationEvent,
      kind: "STAFF_ASSIGNMENT",
      data: {
        renewalId: ids.renewal,
        facilityId: ids.facility,
        staffId: ids.staff,
        acceptedQuoteId: ids.file,
        workflowRevision: 5,
      },
    },
  }
  it("sends allowlisted assignment and preserves retry idempotency key", async () => {
    const fetch = respond({ data: assignmentResult }, 201)
    await coordinateRenewal(
      ids.renewal,
      assignment,
      "original-coordination-key",
    )
    await coordinateRenewal(
      ids.renewal,
      assignment,
      "original-coordination-key",
    )
    for (const [url, init] of fetch.mock.calls) {
      expect(url).toContain("/staff-assignment")
      expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
        "original-coordination-key",
      )
      expect(JSON.parse(init.body)).toEqual({
        expectedVersion: 4,
        assignedStaffId: ids.staff,
        reason: assignment.reason,
      })
    }
  })
  it.each([
    { state: { ...operationState, expectedVersion: 4 } },
    { state: { ...operationState, expectedVersion: 5, renewalId: ids.rental } },
    {
      event: {
        ...assignmentResult.event,
        data: { ...assignmentResult.event.data, staffId: ids.customer },
      },
    },
  ])("rejects unverified assignment success %j", async (patch) => {
    respond({ data: { ...assignmentResult, ...patch } })
    await expect(
      coordinateRenewal(ids.renewal, assignment, "coordination-key"),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("sends explicit false fault verdict with real incident/file references", async () => {
    const command = {
      kind: "fault" as const,
      expectedVersion: 4,
      incidentId: ids.event,
      facilityFault: false,
      reason: "Không đủ căn cứ",
      evidenceFileIds: [ids.file],
    }
    const fetch = respond(
      {
        data: {
          state: { ...operationState, expectedVersion: 5 },
          event: {
            ...operationEvent,
            kind: "FAULT_REVIEW",
            data: { ...command },
          },
        },
      },
      201,
    )
    await coordinateRenewal(ids.renewal, command, "review-key")
    expect(fetch.mock.calls[0][0]).toContain("/facility-fault-reviews")
    expect(JSON.parse(fetch.mock.calls[0][1].body).facilityFault).toBe(false)
  })
  it("rejects unsupported assignment payload before sending HTTP", async () => {
    const fetch = respond({})
    await expect(
      coordinateRenewal(
        ids.renewal,
        { ...assignment, role: "STAFF" } as typeof assignment,
        "coordination-key",
      ),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("reads and publishes renewal policy through separate BO endpoint", async () => {
    const fetch = respond({ data: policy })
    expect(await getIntegrationPolicy("renewal", ids.facility)).toEqual(policy)
    expect(
      await publishIntegrationPolicy("renewal", ids.facility, input),
    ).toEqual(policy)
    expect(fetch.mock.calls[1][0]).toContain(
      `/api/business/facilities/${ids.facility}/renewal-policy`,
    )
    expect(fetch.mock.calls[1][1].method).toBe("PUT")
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(input)
  })
  it.each([
    { revision: 2 },
    { facilityId: ids.rental },
    { schema: "OTHER" },
    { signing: {} },
  ])("rejects malformed/wrong revision policy success %j", async (patch) => {
    respond({ data: { ...policy, ...patch } })
    await expect(
      publishIntegrationPolicy("renewal", ids.facility, input),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("connects communication policy while preserving null/missing policy distinctions", async () => {
    const body = {
      expectedRevision: 0,
      effectiveFrom: "2026-10-10",
      effectiveTo: null,
      reminderCooldownMinutes: null,
      supportReviewDays: 7,
      customerMayClose: false,
    }
    const data = {
      ...body,
      ...policy,
      schema: undefined,
      quoteTtlMinutes: undefined,
      paymentWindowHours: undefined,
      requestWindowDays: undefined,
      depositRate: undefined,
      eligiblePackageIds: undefined,
      signing: undefined,
      term: undefined,
      supportReviewDays: 7,
      customerMayClose: false,
      reminderCooldownMinutes: null,
    }
    const fetch = respond({ data })
    await getIntegrationPolicy("communication", ids.facility)
    await publishIntegrationPolicy("communication", ids.facility, body)
    expect(fetch.mock.calls[1][0]).toContain("/communication-policy")
    expect(JSON.parse(fetch.mock.calls[1][1].body).customerMayClose).toBe(false)
  })
  it.each([
    { effectiveFrom: "2026-02-30" },
    { expectedRevision: -1 },
    { depositRate: 1.01 },
    {
      signing: { signingWindowMinutes: 0, exceptionExtensionLimitMinutes: 10 },
    },
  ])("rejects invalid policy input before request %j", async (patch) => {
    const fetch = respond({})
    await expect(
      publishIntegrationPolicy("renewal", ids.facility, { ...input, ...patch }),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("does not infer policy revision zero or seed defaults on 404", async () => {
    const fetch = respond({}, 404)
    await expect(
      getIntegrationPolicy("renewal", ids.facility),
    ).rejects.toMatchObject({ status: 404 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it("requires paired support policy, at least 7 days and explicit close decision", () => {
    const base = {
      expectedRevision: 0,
      effectiveFrom: "2026-10-10",
      effectiveTo: null,
      reminderCooldownMinutes: null,
      supportReviewDays: null,
      customerMayClose: null,
    }
    expect(validPolicyInput("communication", base)).toBe(true)
    expect(
      validPolicyInput("communication", { ...base, supportReviewDays: 7 }),
    ).toBe(false)
    expect(
      validPolicyInput("communication", {
        ...base,
        supportReviewDays: 6,
        customerMayClose: true,
      }),
    ).toBe(false)
  })
  it("uploads real multipart evidence, never an invented file ID", async () => {
    const data = {
      id: ids.file,
      originalName: "bien-ban.pdf",
      entityType: "DUONG_RENEWAL_INCIDENT",
      entityId: ids.renewal,
      status: "ACTIVE",
    }
    const fetch = respond({ data }, 201)
    const file = new File(["file"], "bien-ban.pdf", { type: "application/pdf" })
    expect(
      await uploadDuongEvidence(file, data.entityType, ids.renewal),
    ).toEqual(data)
    const body = fetch.mock.calls[0][1].body as FormData
    expect(body.get("entityId")).toBe(ids.renewal)
    expect(body.get("entityType")).toBe(data.entityType)
    expect(body.get("file")).toBeInstanceOf(File)
    expect(
      new Headers(fetch.mock.calls[0][1].headers).get("Content-Type"),
    ).not.toBe("application/json")
  })
  it("rejects a file response bound to another resource", async () => {
    respond({
      data: {
        id: ids.file,
        originalName: "a.pdf",
        entityType: "DUONG_RENEWAL_INCIDENT",
        entityId: ids.rental,
        status: "ACTIVE",
      },
    })
    await expect(
      uploadDuongEvidence(
        new File(["x"], "a.pdf"),
        "DUONG_RENEWAL_INCIDENT",
        ids.renewal,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("stages Customer support evidence only for the actual uploader", async () => {
    vi.spyOn(auth, "getAuthenticatedActor").mockReturnValue(
      operationsActor("customer"),
    )
    const data = {
      id: ids.file,
      originalName: "a.pdf",
      entityType: "DUONG_SUPPORT_UPLOAD",
      entityId: ids.customer,
      status: "ACTIVE",
    }
    respond({ data })
    expect(
      await uploadDuongEvidence(
        new File(["x"], "a.pdf"),
        "DUONG_SUPPORT_PUBLIC",
      ),
    ).toEqual(data)
    respond({ data: { ...data, entityId: ids.staff } })
    await expect(
      uploadDuongEvidence(new File(["x"], "a.pdf"), "DUONG_SUPPORT_PUBLIC"),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("does not stage new Customer evidence under a Staff/demo account", async () => {
    vi.spyOn(auth, "getAuthenticatedActor").mockReturnValue(
      operationsActor("staff"),
    )
    const fetch = respond({})
    await expect(
      uploadDuongEvidence(new File(["x"], "a.pdf"), "DUONG_SUPPORT_PUBLIC"),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("downloads through authenticated transport instead of public/static URLs", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("evidence", {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="bien-ban.pdf"',
          },
        }),
      )
    vi.stubGlobal("fetch", fetch)
    setAccessToken("token")
    const file = await downloadDuongEvidence(ids.file)
    expect(file.blob.size).toBeGreaterThan(0)
    expect(fetch.mock.calls[0][0]).toContain(`/api/files/${ids.file}`)
    expect(
      new Headers(fetch.mock.calls[0][1].headers).get("Authorization"),
    ).toBe("Bearer token")
  })
  it.each([401, 403, 404, 409, 500])(
    "redacts raw server internals while retaining HTTP %s meaning",
    (status) => {
      const message = integrationError(
        new ApiClientError("private-source-port-secret", { status }),
      )
      expect(message).not.toContain("private-source-port-secret")
      expect(message.length).toBeGreaterThan(10)
    },
  )
})
