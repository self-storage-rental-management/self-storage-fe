import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  loadCustomerPaymentHistory,
  reservationPaymentCategory,
  sortPaymentHistory,
  latestPaymentRecords,
  type HistoryEntry,
} from "./customerPaymentHistory"
import {
  listCustomerPaymentHistory,
  type ReservationPaymentResult,
} from "./customerReservationApi"
import { listRenewals } from "./renewalApi"
import { listRenewalOperationEvents } from "./renewalOperationsApi"
import { apiRequest } from "./apiClient"

vi.mock("./customerReservationApi", () => ({
  listCustomerPaymentHistory: vi.fn(),
}))
vi.mock("./renewalApi", () => ({ listRenewals: vi.fn() }))
vi.mock("./renewalOperationsApi", () => ({
  listRenewalOperationEvents: vi.fn(),
}))
vi.mock("./apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./apiClient")>()),
  apiRequest: vi.fn(),
}))
vi.mock("./authApi", () => ({
  getAuthenticatedActor: () => ({ id: "customer" }),
}))
const page = (data: unknown[], index = 0, totalPages = data.length ? 1 : 0) => ({
  data,
  pagination: {
    page: index,
    pageSize: 50,
    totalItems: data.length,
    totalPages,
    sort: "createdAt,desc",
  },
})
const payment = (
  id: string,
  purpose: string,
  timestamp: string,
): ReservationPaymentResult => ({
  paymentId: id,
  reservationId: "reservation",
  transactionReference: id,
  gatewayTransactionNo: null,
  amount: 100,
  currency: "VND",
  refundedAmount: 0,
  paymentStatus: "PAID",
  reservationStatus: "CONFIRMED",
  responseCode: "00",
  transactionStatus: "00",
  gatewayPayDate: null,
  message: "",
  processedAt: timestamp,
  lastReconciledAt: null,
  purpose,
})

describe("Customer payment history", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listCustomerPaymentHistory).mockResolvedValue(page([
      { ...payment("deposit", "RESERVATION_DEPOSIT", "2026-10-12T08:00:00Z"), reservationCode: "RSV" },
    ]) as never)
    vi.mocked(listRenewals).mockResolvedValue(page([]) as never)
    vi.mocked(apiRequest).mockResolvedValue(page([]))
  })
  it.each([
    ["RESERVATION_DEPOSIT", "deposit"],
    ["RENTAL_BALANCE", "checkin"],
    ["RENEWAL", "renewal"],
    ["DAMAGE_FEE", "damage"],
    ["OTHER", "other"],
  ])(
    "classifies %s without calling every payment a deposit",
    (purpose, expected) => {
      expect(reservationPaymentCategory(payment("p", purpose, ""))).toBe(
        expected,
      )
    },
  )
  it("sorts all records newest first, puts missing dates last, and preserves its input", () => {
    const input = [
      { id: "old", timestamp: "2026-10-11T08:00:00Z" },
      { id: "unknown", timestamp: null },
      { id: "new", timestamp: "2026-10-12T08:00:00Z" },
    ] as HistoryEntry[]
    expect(sortPaymentHistory(input).map((e) => e.id)).toEqual([
      "new",
      "old",
      "unknown",
    ])
    expect(input[0].id).toBe("old")
  })
  it("combines reservation, renewal deposit, signing cash and recorded return payments", async () => {
    vi.mocked(listRenewals).mockResolvedValue(
      page([{ id: "renewal" }]) as never,
    )
    vi.mocked(listRenewalOperationEvents).mockResolvedValue(
      page([
        {
          kind: "DEPOSIT",
          occurredAt: "2026-10-13T08:00:00Z",
          data: {
            paymentRef: "renewal-deposit",
            amount: 200,
            outcome: "SUCCESS",
            paidAt: "2026-10-13T08:00:00Z",
          },
        },
        {
          kind: "CASH",
          data: {
            reference: "cash",
            amount: 300,
            receivedAt: "2026-10-14T08:00:00Z",
          },
        },
      ]) as never,
    )
    vi.mocked(apiRequest).mockResolvedValue(
      page([
        {
          id: "return",
          customerId: "customer",
          unitNumber: "A1",
          settlementPaymentId: "settlement",
          settlementPaidAt: "2026-10-15T08:00:00Z",
          amountDueFromCustomer: 400,
        },
        {
          id: "unpaid-return",
          customerId: "customer",
          unitNumber: "A2",
          settlementPaymentId: null,
          settlementPaidAt: null,
          amountDueFromCustomer: 500,
        },
      ]),
    )
    const result = await loadCustomerPaymentHistory()
    expect(result.entries.map((e) => e.category)).toEqual([
      "damage",
      "renewalSigning",
      "renewal",
      "deposit",
    ])
    expect(result.warnings).toEqual([])
  })
  it("preserves other payment history and reports a missing renewal source", async () => {
    vi.mocked(listRenewals).mockRejectedValue(new Error("unavailable"))
    const result = await loadCustomerPaymentHistory()
    expect(result.entries.map((e) => e.id)).toEqual(["deposit"])
    expect(result.warnings).toEqual([
      "Chưa tải được đầy đủ danh sách gia hạn.",
    ])
  })
  it("refuses return records belonging to another customer", async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      page([
        {
          id: "return",
          customerId: "other",
          unitNumber: "A1",
          settlementPaymentId: "settlement",
          settlementPaidAt: "2026-10-15T08:00:00Z",
          amountDueFromCustomer: 400,
        },
      ]),
    )
    const result = await loadCustomerPaymentHistory()
    expect(result.entries.map((e) => e.id)).toEqual(["deposit"])
    expect(result.warnings).toHaveLength(1)
  })
  it("keeps the newest update of the same transaction even if old events arrive last", () => {
    const newest = { id: 'same', timestamp: '2026-10-12T08:00:00Z', updatedAt: '2026-10-13T08:00:00Z', status: 'PAID' } as HistoryEntry
    const old = { ...newest, updatedAt: '2026-10-12T08:00:00Z', status: 'NOT_RECEIVED' }
    expect(latestPaymentRecords([newest, old])).toEqual([newest])
    expect(latestPaymentRecords([old, newest])).toEqual([newest])
  })
  it("keeps loaded pages when a later payment history page fails", async () => {
    vi.mocked(listCustomerPaymentHistory).mockResolvedValueOnce(page([
      payment('deposit', 'RESERVATION_DEPOSIT', '2026-10-12T08:00:00Z'),
    ], 0, 2) as never).mockRejectedValueOnce(new Error('unavailable'))
    const result = await loadCustomerPaymentHistory()
    expect(result.entries.map(e => e.id)).toEqual(['deposit'])
    expect(result.warnings).toEqual(['Chưa tải được đầy đủ lịch sử thanh toán đơn giữ kho.'])
  })
  it("keeps payments for other renewals when one renewal fails to load", async () => {
    vi.mocked(listRenewals).mockResolvedValue(page([{ id: 'failed' }, { id: 'loaded' }]) as never)
    vi.mocked(listRenewalOperationEvents).mockImplementation(async (_role, id) => {
      if (id === 'failed') throw new Error('unavailable')
      return page([{ kind: 'DEPOSIT', occurredAt: '2026-10-13T08:00:00Z', data: { paymentRef: 'renewal-payment', outcome: 'SUCCESS', amount: 200, paidAt: '2026-10-13T08:00:00Z' } }]) as never
    })
    const result = await loadCustomerPaymentHistory()
    expect(result.entries.map(e => e.id)).toEqual(['renewal-payment', 'deposit'])
    expect(result.warnings).toEqual(['Chưa tải được đầy đủ thanh toán của đơn gia hạn failed.'])
  })
  it("still loads renewal payments when the reservation history source fails", async () => {
    vi.mocked(listCustomerPaymentHistory).mockRejectedValue(new Error('unavailable'))
    vi.mocked(listRenewals).mockResolvedValue(page([{ id: 'renewal' }]) as never)
    vi.mocked(listRenewalOperationEvents).mockResolvedValue(page([{ kind: 'CASH', occurredAt: '2026-10-13T08:00:00Z', data: { reference: 'cash', amount: 200, receivedAt: '2026-10-13T08:00:00Z' } }]) as never)
    const result = await loadCustomerPaymentHistory()
    expect(result.entries.map(e => e.id)).toEqual(['cash'])
    expect(result.warnings).toHaveLength(1)
  })
})
