import { apiRequest } from './apiClient'
import { readRentalEnvelope } from './rentalApi'
import { isInstant, isUuid } from './renewalOperationsApi'

export interface RentalPaymentReceipt {
  paymentId: string; rentalId: string; renewalId: string | null; purpose: 'RESERVATION_DEPOSIT' | 'RENTAL_BALANCE' | 'MONTHLY_RENT' | 'RENEWAL'
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'NOT_RECEIVED' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
  amount: number; currency: string; refundedAmount: number; transactionReference: string | null; gatewayTransactionNo: string | null
  paymentMethod: string | null; gatewayPayDate: string | null; paidAt: string | null; processedAt: string | null; createdAt: string
  initiatedByName: string; verification: 'VERIFIED' | 'SANDBOX' | 'SIMULATED' | 'UNVERIFIED' | 'DISPUTED' | 'ATTEMPT'
}
export async function listRentalPayments(id: string) {
  if(!isUuid(id))throw new Error('Hồ sơ không hợp lệ.')
  return readRentalEnvelope<RentalPaymentReceipt[]>(await apiRequest(`/api/manager/rentals/${id}/payments`),value =>
    Array.isArray(value) && value.every((p: RentalPaymentReceipt) => p && isUuid(p.paymentId) && p.rentalId===id
      && (p.renewalId===null || isUuid(p.renewalId)) && ['RESERVATION_DEPOSIT','RENTAL_BALANCE','MONTHLY_RENT','RENEWAL'].includes(p.purpose)
      && ['PENDING','PROCESSING','PAID','NOT_RECEIVED','FAILED','CANCELLED','REFUNDED'].includes(p.status)
      && ['VERIFIED','SANDBOX','SIMULATED','UNVERIFIED','DISPUTED','ATTEMPT'].includes(p.verification)
      && Number.isFinite(p.amount) && p.amount>=0 && Number.isFinite(p.refundedAmount) && p.refundedAmount>=0
      && p.currency==='VND' && typeof p.initiatedByName==='string' && isInstant(p.createdAt)
      && [p.paidAt,p.processedAt].every(date=>date===null || isInstant(date))
      && [p.transactionReference,p.gatewayTransactionNo,p.paymentMethod,p.gatewayPayDate].every(x=>x===null || typeof x==='string')))
}
