import { apiRequest } from "./apiClient"
import { readRentalEnvelope } from "./rentalApi"
import { isInstant, isUuid, isVersion, isOperationState, isOperationEvent, validateMutation, validateText } from "./renewalOperationsApi"
import type { RenewalOperationsRole, RenewalOperationResult } from "../types/renewalOperationsApi"

export interface DepositSettlement {
  renewalId: string
  expectedVersion: number | null
  status: "UNKNOWN" | "NOT_APPLICABLE" | "HELD" | "AWAITING_RECOVERY_DEADLINE" | "AWAITING_FAULT_REVIEW" | "FACILITY_FAULT" | "APPLIED_TO_RENT" | "REVIEW_REQUIRED" | "FORFEITED" | "REFUND_ELIGIBLE" | "REFUND_APPROVED" | "REFUNDED" | "PREPARATION_BLOCKED"
  amount: number | null
  refundedAmount: number | null
  currency: "VND"
  environment: "SANDBOX" | "PRODUCTION" | null
  refundId: string | null
  signingDeadline: string | null
  checkedAt: string
  preparationPaymentId?: string | null
  preparationRetryAllowed?: boolean
}
export function isDepositSettlement(value: unknown): value is DepositSettlement {
  const v = value as DepositSettlement | null
  return !!v && isUuid(v.renewalId) && (v.expectedVersion === null || isVersion(v.expectedVersion))
    && ["UNKNOWN","NOT_APPLICABLE","HELD","AWAITING_RECOVERY_DEADLINE","AWAITING_FAULT_REVIEW","FACILITY_FAULT","APPLIED_TO_RENT","REVIEW_REQUIRED","FORFEITED","REFUND_ELIGIBLE","REFUND_APPROVED","REFUNDED","PREPARATION_BLOCKED"].includes(v.status)
    && (v.preparationPaymentId == null || isUuid(v.preparationPaymentId))
    && (v.preparationRetryAllowed === undefined || typeof v.preparationRetryAllowed === 'boolean')
    && (v.status !== 'PREPARATION_BLOCKED' || isUuid(v.preparationPaymentId))
    && v.currency === "VND" && isInstant(v.checkedAt) && (v.signingDeadline === null || isInstant(v.signingDeadline))
    && (v.refundId === null || isUuid(v.refundId))
    && (["UNKNOWN","NOT_APPLICABLE"].includes(v.status)
      ? v.amount === null && v.refundedAmount === null && v.environment === null && v.refundId === null
      : typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount > 0
        && typeof v.refundedAmount === "number" && Number.isFinite(v.refundedAmount) && v.refundedAmount >= 0 && v.refundedAmount <= v.amount
        && ["SANDBOX","PRODUCTION"].includes(v.environment ?? "")
        && (!["REFUND_APPROVED","REFUNDED"].includes(v.status) || isUuid(v.refundId)))
}
export async function getDepositSettlement(role: RenewalOperationsRole, id: string) {
  if (!isUuid(id) || !["customer","manager","staff"].includes(role)) throw new Error("Hồ sơ hoặc vai trò không hợp lệ.")
  return readRentalEnvelope<DepositSettlement>(await apiRequest(`/api/${role}/renewals/${id}/deposit-settlement`),
    value => isDepositSettlement(value) && value.renewalId === id)
}
export interface RefundExecutionBody {
  refundId: string; receiptFileId: string; transactionReference: string; transferred: true; expectedVersion: number
}
export interface PreparationResolutionBody {
  paymentId: string; action: 'RETRY' | 'REFUND'; serviceUnavailable: boolean; reason: string
  evidenceFileIds: string[]; expectedVersion: number
}
export async function resolvePreparation(id: string, body: PreparationResolutionBody, key: string) {
  if (!isUuid(id) || !isUuid(body.paymentId) || !['RETRY','REFUND'].includes(body.action)
    || typeof body.serviceUnavailable !== 'boolean' || body.action === 'REFUND' && !body.serviceUnavailable)
    throw new Error('Cần xác nhận cơ sở không thể thực hiện gia hạn trước khi duyệt hoàn tiền.')
  if (Object.keys(body).some(field => !['paymentId','action','serviceUnavailable','reason','evidenceFileIds','expectedVersion'].includes(field)))
    throw new Error('Trường xử lý khoản gia hạn không hợp lệ.')
  validateMutation(body.expectedVersion,key); validateText(body.reason,true,2000)
  if (!Array.isArray(body.evidenceFileIds) || !body.evidenceFileIds.length || body.evidenceFileIds.length > 10
    || !body.evidenceFileIds.every(isUuid) || new Set(body.evidenceFileIds).size !== body.evidenceFileIds.length)
    throw new Error('Cần từ 1 đến 10 minh chứng khác nhau gắn với hồ sơ.')
  return readRentalEnvelope<RenewalOperationResult>(await apiRequest(`/api/manager/renewals/${id}/preparation-resolutions`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body),
  }), value => {
    const result = value as RenewalOperationResult | null
    return !!result && isOperationState(result.state) && result.state.renewalId === id && isOperationEvent(result.event)
      && result.event.kind === (body.action === 'REFUND' ? 'REFUND' : 'PREPARATION_RESOLUTION')
      && (result.event.data as { paymentId?: unknown }).paymentId === body.paymentId
  })
}
export async function executeDepositRefund(id: string, body: RefundExecutionBody, key: string) {
  if (!isUuid(id) || !isUuid(body.refundId) || !isUuid(body.receiptFileId)) throw new Error("Cần khoản hoàn đã duyệt và chứng từ hợp lệ.")
  if (Object.keys(body).some(field => !["refundId","receiptFileId","transactionReference","transferred","expectedVersion"].includes(field))) throw new Error("Trường hoàn tiền không hợp lệ.")
  validateMutation(body.expectedVersion,key); validateText(body.transactionReference,true,100)
  if (body.transferred !== true) throw new Error("Cần xác nhận khoản hoàn đã được thực hiện.")
  return readRentalEnvelope<RenewalOperationResult>(await apiRequest(`/api/staff/renewals/${id}/refund-executions`,{
    method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body),
  }), value => {
    const result = value as RenewalOperationResult | null
    return !!result && isOperationState(result.state) && result.state.renewalId === id && isOperationEvent(result.event)
      && result.event.kind === "REFUND_EXECUTION" && (result.event.data as { reference?: unknown;renewalId?: unknown }).reference === body.refundId
      && (result.event.data as { renewalId?: unknown }).renewalId === id
  })
}
