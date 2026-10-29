import { apiRequest } from './apiClient'
import { readRentalEnvelope } from './rentalApi'
import { isUuid, isInstant } from './renewalOperationsApi'

export interface RenewalReceiptData {
  paymentId: string; renewalId: string; transactionReference: string | null; gatewayTransactionNo: string | null
  amount: number; currency: string; paymentStatus: 'PAID'; paymentMethod: string | null; gatewayPayDate: string | null
  paidAt: string; processedAt: string | null; initiatedByName: string; kind: 'DEPOSIT' | 'FULL_RENT' | 'REMAINING_RENT' | 'INSTALLMENT'
  environment: 'SANDBOX' | 'PRODUCTION'; invoiceNumber: string | null
  invoiceStatus: 'DRAFT' | 'PAID' | 'VOID' | 'REFUNDED'; invoiceIssuedAt: string | null
}
export async function getRenewalReceipt(role: 'customer' | 'manager',id: string,paymentId: string) {
  if(!['customer','manager'].includes(role)||!isUuid(id)||!isUuid(paymentId))throw new Error('Giao dịch không hợp lệ.')
  return readRentalEnvelope<RenewalReceiptData>(await apiRequest(`/api/${role}/renewals/${id}/payments/${paymentId}/receipt`),value => {
    const v=value as RenewalReceiptData | null
    return !!v && v.renewalId===id && v.paymentId===paymentId && v.paymentStatus==='PAID' && v.currency==='VND'
      && typeof v.amount==='number' && Number.isFinite(v.amount) && v.amount>0 && isInstant(v.paidAt)
      && (v.processedAt===null||isInstant(v.processedAt)) && typeof v.initiatedByName==='string'
       && ['DEPOSIT','FULL_RENT','REMAINING_RENT','INSTALLMENT'].includes(v.kind) && ['SANDBOX','PRODUCTION'].includes(v.environment)
       && (v.invoiceNumber===null||typeof v.invoiceNumber==='string')
       && ['DRAFT','PAID','VOID','REFUNDED'].includes(v.invoiceStatus)
       && (v.invoiceIssuedAt===null||isInstant(v.invoiceIssuedAt))
      && [v.transactionReference,v.gatewayTransactionNo,v.paymentMethod,v.gatewayPayDate].every(x=>x===null||typeof x==='string')
  })
}
