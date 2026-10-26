import { apiRequest } from "./apiClient"
import { getAuthenticatedActor } from "./authApi"
import { readRentalPage } from "./rentalApi"
import { listRenewals } from "./renewalApi"
import { listRenewalOperationEvents } from "./renewalOperationsApi"
import { isOverdueSettlement, type OverdueSettlement } from "./returnApi"
import { isUuid } from "./renewalOperationsApi"
import { isRenewalTransactionStatus, renewalTransactionLabels } from '../types/renewalStatus'
import {
  listCustomerPaymentHistory,
  type ReservationPaymentResult,
} from "./customerReservationApi"

export const paymentCategories = {
  deposit: "Thanh toán cọc giữ chỗ",
  renewal: "Thanh toán tiền thuê gia hạn trả trước",
  damage: "Thanh toán bổ sung khi trả kho",
  refund: "Hoàn tiền trả kho",
  returnOffset: "Đối trừ quyết toán trả kho",
  checkin: "Thanh toán tại chỗ khi nhận kho",
  renewalSigning: "Thanh toán tại chỗ khi ký gia hạn",
  other: "Thanh toán khác",
} as const
export type PaymentCategory = keyof typeof paymentCategories
export interface HistoryEntry {
  id: string
  reference: string
  category: PaymentCategory
  amount: number | null
  currency: string
  timestamp: string | null
  updatedAt?: string | null
  status: string
  statusSource?: 'RENEWAL_PROJECTION'
  receiptAvailable?: boolean
  refundedAmount?: number | null
  paymentReference?: string | null
  method: string | null
  reservationPayment?: ReservationPaymentResult
  renewalId?: string
  rentalId?: string
  unitCode?: string
  facilityName?: string
  returnSettlement?: {
    rentalRefundCredit?: number | null
    earlyTerminationFee?: number | null
    setupEarlyExit?: boolean
    depositAmount: number | null
    totalDeductions: number | null
    damageFee: number | null
    cleaningFee: number | null
    lostItemFee: number | null
    overdueFee: number | null
    outstandingFee: number | null
    overdueSettlement: OverdueSettlement | null
    receiptFileId: string | null
  }
}
export function isRenewalHistoryEntry(entry: HistoryEntry): boolean {
  return !!entry.renewalId || entry.category === 'renewal' || entry.category === 'renewalSigning'
    || entry.reservationPayment?.purpose === 'RENEWAL'
}
export function customerHistoryStatusLabel(entry: HistoryEntry): string {
  return entry.statusSource === 'RENEWAL_PROJECTION' && isRenewalTransactionStatus(entry.status)
    ? renewalTransactionLabels[entry.status]
    : 'Chưa đối soát'
}
export function canViewCustomerHistoryReceipt(entry: HistoryEntry): boolean {
  if (isRenewalHistoryEntry(entry)) return entry.statusSource === 'RENEWAL_PROJECTION'
    && entry.receiptAvailable === true && !!entry.renewalId
    && ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(entry.status)
  return ['PAID', 'REFUNDED', 'SETTLED'].includes(entry.status)
}
export function reservationPaymentCategory(
  payment: ReservationPaymentResult,
): PaymentCategory {
  switch (payment.purpose) {
    case undefined:
    case "RESERVATION_DEPOSIT":
      return "deposit"
    case "RENTAL_BALANCE":
      return "checkin"
    case "RENEWAL":
      return "renewal"
    case "DAMAGE_FEE":
      return "damage"
    default:
      return "other"
  }
}
export function sortPaymentHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const time = (value: string | null) =>
    value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
  return [...entries].sort(
    (a, b) => time(b.timestamp) - time(a.timestamp) || a.id.localeCompare(b.id),
  )
}
export function latestPaymentRecords(entries: HistoryEntry[]): HistoryEntry[] {
  const latest = new Map<string, HistoryEntry>()
  const updateTime = (entry: HistoryEntry) => {
    const value = entry.updatedAt || entry.timestamp
    return value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
  }
  const priority = (value: HistoryEntry) => value.statusSource === 'RENEWAL_PROJECTION' ? 2 : value.renewalId ? 1 : 0
  for (const entry of entries) {
    const existing = latest.get(entry.id)
    // Current backend projection wins even when an old event has a later metadata timestamp.
    if (!existing || priority(entry) > priority(existing)
      || priority(entry) === priority(existing) && updateTime(entry) > updateTime(existing)) latest.set(entry.id, entry)
  }
  return sortPaymentHistory([...latest.values()])
}
async function allPages<T>(
  load: (
    page: number,
  ) => Promise<{
    data: T[]
    pagination: { totalPages: number }
  }>,
  onError?: () => void,
): Promise<T[]> {
  const entries: T[] = []
  let page = 0,
    totalPages = 1
  do {
    let result
    try {
      result = await load(page++)
    } catch (error) {
      if (!onError) throw error
      onError()
      break
    }
    entries.push(...result.data)
    totalPages = result.pagination.totalPages
  } while (page < totalPages)
  return entries
}
interface ReturnPayment {
  setupExitRequested?: boolean
  setupEarlyExit?: boolean
  rentalRefundCredit?: number | null
  earlyTerminationFee?: number | null
  id: string
  customerId: string
  unitNumber: string
  settlementPaymentId: string | null
  settlementPaidAt: string | null
  amountDueFromCustomer: number | null
  netRefundAmount?: number | null
  depositAmount?: number | null
  totalDeductions?: number | null
  damageFee?: number | null
  cleaningFee?: number | null
  lostItemFee?: number | null
  overdueFee?: number | null
  outstandingFee?: number | null
  overdueSettlement?: OverdueSettlement | null
  settlementReceipt?: {
    direction: "COLLECTION" | "REFUND" | "OFFSET"
    amount: number
    paymentMethod: "CASH" | "BANK_TRANSFER" | "DEPOSIT_OFFSET"
    transactionReference: string
    receiptFileId?: string | null
    recordedAt?: string | null
  } | null
}
function isReturnPayment(value: unknown): value is ReturnPayment {
  if (!value || typeof value !== "object") return false
  const r = value as ReturnPayment
  return (
    typeof r.id === "string" &&
    r.customerId === getAuthenticatedActor()?.id &&
    typeof r.unitNumber === "string" &&
    [r.rentalRefundCredit, r.earlyTerminationFee, r.depositAmount, r.totalDeductions, r.damageFee, r.cleaningFee, r.lostItemFee, r.overdueFee, r.outstandingFee]
      .every(value => value == null || typeof value === "number" && Number.isFinite(value) && value >= 0) &&
    (r.overdueSettlement == null || isOverdueSettlement(r.overdueSettlement)) &&
    (r.settlementPaymentId === null ||
      typeof r.settlementPaymentId === "string") &&
    (r.settlementPaidAt === null ||
      (typeof r.settlementPaidAt === "string" &&
        Number.isFinite(Date.parse(r.settlementPaidAt)))) &&
    (r.amountDueFromCustomer === null ||
      (typeof r.amountDueFromCustomer === "number" &&
        Number.isFinite(r.amountDueFromCustomer) &&
        r.amountDueFromCustomer >= 0)) &&
    (r.netRefundAmount == null ||
      (typeof r.netRefundAmount === "number" &&
        Number.isFinite(r.netRefundAmount) && r.netRefundAmount >= 0)) &&
    (r.settlementReceipt == null ||
      (typeof r.settlementReceipt === "object" &&
        ["COLLECTION", "REFUND", "OFFSET"].includes(r.settlementReceipt.direction) &&
        typeof r.settlementReceipt.amount === "number" &&
        Number.isFinite(r.settlementReceipt.amount) && r.settlementReceipt.amount > 0 &&
        (r.settlementReceipt.direction === "OFFSET"
          ? r.settlementReceipt.paymentMethod === "DEPOSIT_OFFSET" && r.settlementReceipt.transactionReference === `OFFSET:${r.id}`
          : ["CASH", "BANK_TRANSFER"].includes(r.settlementReceipt.paymentMethod) && r.settlementReceipt.transactionReference === r.settlementPaymentId) &&
        (r.settlementReceipt.recordedAt == null || typeof r.settlementReceipt.recordedAt === "string" && Number.isFinite(Date.parse(r.settlementReceipt.recordedAt))) &&
        (r.settlementReceipt.receiptFileId == null || isUuid(r.settlementReceipt.receiptFileId))))
  )
}
export async function loadCustomerPaymentHistory(): Promise<{
  entries: HistoryEntry[]
  warnings: string[]
}> {
  const warnings: string[] = []
  const payments = await allPages(
    page => listCustomerPaymentHistory(page, 50),
    () => warnings.push("Chưa tải được đầy đủ lịch sử thanh toán đơn giữ kho."),
  )
  const reservationEntries: HistoryEntry[] = payments.map(payment => ({
    id: payment.paymentId,
    reference: payment.reservationCode || payment.reservationId,
    category: reservationPaymentCategory(payment), amount: payment.amount, currency: payment.currency,
    timestamp: payment.paidAt || payment.processedAt || payment.createdAt || null,
    updatedAt: payment.processedAt || payment.createdAt || null,
    status: payment.purpose === 'RENEWAL' ? 'UNKNOWN' : payment.paymentStatus,
    receiptAvailable: payment.purpose === 'RENEWAL' ? false : undefined,
    method: payment.paymentMethod || null, reservationPayment: payment,
  }))
  const originalPayments = new Map(reservationEntries.map(entry => [entry.id, entry]))
  const supplemental = await Promise.allSettled([
    (async (): Promise<HistoryEntry[]> => {
      const renewals = await allPages((page) =>
        listRenewals("customer", { page, size: 50 }),
        () => warnings.push("Chưa tải được đầy đủ danh sách gia hạn."),
      )
      return (
        await Promise.all(
          renewals.map(async (renewal) => {
            const events = await allPages((page) =>
              listRenewalOperationEvents(
                "customer",
                renewal.id,
                "payments",
                page,
                50,
              ),
              () => warnings.push(`Chưa tải được đầy đủ thanh toán của đơn gia hạn ${renewal.id}.`),
            )
            const metadata: HistoryEntry[] = events.flatMap((event) => {
              const data = event.data as Record<string, unknown>
              const cash = event.kind === "CASH"
              const paymentId = cash ? data.paymentId || data.reference : data.paymentRef
              if (typeof paymentId !== 'string' || !paymentId.trim()) return []
              const recordedAt = cash ? data.receivedAt : data.paidAt
              return [{
                id: paymentId,
                reference: `Gia hạn ${renewal.id}`,
                renewalId: renewal.id,
                rentalId: renewal.rentalId,
                unitCode: renewal.storageUnit.code,
                facilityName: renewal.facility.name,
                category: cash ? 'renewalSigning' : 'renewal',
                amount: typeof data.amount === 'number' ? data.amount : null,
                currency: 'VND',
                timestamp: typeof recordedAt === 'string' ? recordedAt : event.occurredAt,
                updatedAt: event.occurredAt,
                status: 'UNKNOWN',
                receiptAvailable: false,
                refundedAmount: null,
                method: cash ? data.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt tại cơ sở' : 'VNPay',
              } satisfies HistoryEntry]
            })
            const byId = new Map(latestPaymentRecords(metadata).map(entry => [entry.id, entry]))
            const projected = renewal.statusSummary?.transactions ?? []
            const projectedIds = new Set(projected.map(transaction => transaction.paymentId))
            const transactions: HistoryEntry[] = projected.map(transaction => {
              const event = byId.get(transaction.paymentId)
              const original = originalPayments.get(transaction.paymentId)
              return {
                id: transaction.paymentId,
                reference: `Gia hạn ${renewal.id}`,
                renewalId: renewal.id,
                rentalId: renewal.rentalId,
                unitCode: renewal.storageUnit.code,
                facilityName: renewal.facility.name,
                category: transaction.purpose === 'RENTAL_BALANCE' ? 'renewalSigning' : 'renewal',
                amount: transaction.amount,
                refundedAmount: transaction.refundedAmount,
                currency: transaction.currency,
                timestamp: transaction.paidAt ?? event?.timestamp ?? original?.timestamp ?? null,
                updatedAt: renewal.statusSummary!.checkedAt,
                status: transaction.status,
                statusSource: 'RENEWAL_PROJECTION',
                receiptAvailable: transaction.receiptAvailable,
                paymentReference: transaction.reference ?? original?.reservationPayment?.transactionReference ?? null,
                method: event?.method ?? original?.method ?? null,
              }
            })
            // Unmatched historical events remain visible, but never certify a successful payment.
            return [...transactions, ...metadata.filter(entry => !projectedIds.has(entry.id))]
          }),
        )
      ).flat()
    })(),
    (async (): Promise<HistoryEntry[]> => {
      const returns = await allPages((page) =>
        apiRequest(`/api/customer/returns?page=${page}&pageSize=50`).then(
          (result) =>
            readRentalPage<ReturnPayment>(result, isReturnPayment, page),
        ),
        () => warnings.push("Chưa tải được đầy đủ lịch sử quyết toán trả kho."),
      )
      return returns
        .filter(
          (r) =>
            r.settlementReceipt,
        )
        .flatMap((r): HistoryEntry[] => {
          const receipt = r.settlementReceipt
          const offset = receipt?.direction === "OFFSET"
          const refund = receipt ? receipt.direction === "REFUND" : (r.netRefundAmount ?? 0) > 0
          const amount = receipt?.amount ?? (refund ? r.netRefundAmount : r.amountDueFromCustomer)
          // A zero balance does not represent a collection or a refund.
          if (amount == null || amount <= 0) return []
          return [{
            id: receipt?.transactionReference ?? r.settlementPaymentId!,
            reference: `Trả kho ${r.unitNumber}`,
            category: offset ? "returnOffset" : refund ? "refund" : "damage",
            amount,
            currency: "VND",
            timestamp: r.settlementPaidAt ?? receipt?.recordedAt ?? null,
            status: offset ? "SETTLED" : refund ? "REFUNDED" : "PAID",
            method: offset ? "Đối trừ quyết toán" : receipt ? receipt.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản" : null,
            returnSettlement: {
              rentalRefundCredit: r.rentalRefundCredit ?? null,
              earlyTerminationFee: r.earlyTerminationFee ?? null,
              setupEarlyExit: r.setupEarlyExit,
              depositAmount: r.depositAmount ?? null,
              totalDeductions: r.totalDeductions ?? null,
              damageFee: r.damageFee ?? null,
              cleaningFee: r.cleaningFee ?? null,
              lostItemFee: r.lostItemFee ?? null,
              overdueFee: r.overdueFee ?? null,
              outstandingFee: r.outstandingFee ?? null,
              overdueSettlement: r.overdueSettlement ?? null,
              receiptFileId: receipt?.receiptFileId ?? null,
            },
          }]
        })
    })(),
  ])
  const entries: HistoryEntry[] = [...reservationEntries]
  supplemental.forEach((result, index) => {
    if (result.status === "fulfilled") entries.push(...result.value)
    else
      warnings.push(
        index === 0
          ? "Chưa tải được lịch sử thanh toán gia hạn."
          : "Chưa tải được lịch sử quyết toán trả kho.",
      )
  })
  return {
    entries: latestPaymentRecords(entries),
    warnings,
  }
}
