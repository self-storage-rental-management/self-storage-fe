import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  loadCustomerPaymentHistory,
  reservationPaymentCategory,
  sortPaymentHistory,
  type HistoryEntry,
} from "./customerPaymentHistory"
import {
  listCustomerReservations,
  listReservationPayments,
  type ReservationPaymentResult,
} from "./customerReservationApi"
import { listRenewals } from "./renewalApi"
import { listRenewalOperationEvents } from "./renewalOperationsApi"
import { apiRequest } from "./apiClient"

vi.mock("./customerReservationApi", () => ({
  listCustomerReservations: vi.fn(),
  listReservationPayments: vi.fn(),
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
    vi.mocked(listCustomerReservations).mockResolvedValue(
      page([{ id: "reservation", reservationCode: "RSV" }]) as never,
    )
    vi.mocked(listReservationPayments).mockResolvedValue([
      payment("deposit", "RESERVATION_DEPOSIT", "2026-10-12T08:00:00Z"),
    ])
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
      "Chưa tải được lịch sử thanh toán gia hạn.",
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
})
