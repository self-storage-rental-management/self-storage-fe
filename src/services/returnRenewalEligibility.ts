import { apiRequest } from './apiClient'
import { readRentalEnvelope } from './rentalApi'

export interface ReturnRenewalEligibility {
  rentalId: string
  allowed: boolean
  renewalId: string | null
  state: 'ALLOWED' | 'UNPAID' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'RECONCILIATION_REQUIRED'
  message: string | null
  paidAmount: number
  depositAmount: number
}

function read(value: unknown, rentalId?: string, renewalId?: string) {
  return readRentalEnvelope<ReturnRenewalEligibility>(value, data => {
    const gate = data as ReturnRenewalEligibility | null
    return !!gate && typeof gate.rentalId === 'string' && (!rentalId || gate.rentalId === rentalId)
      && (!renewalId || gate.renewalId === renewalId) && typeof gate.allowed === 'boolean'
      && ['ALLOWED', 'UNPAID', 'DEPOSIT_PAID', 'FULLY_PAID', 'RECONCILIATION_REQUIRED'].includes(gate.state)
      && Number.isFinite(gate.paidAmount) && gate.paidAmount >= 0 && Number.isFinite(gate.depositAmount) && gate.depositAmount >= 0
      && (gate.allowed ? gate.state === 'ALLOWED' && gate.renewalId === null && gate.message === null
        : gate.state !== 'ALLOWED' && typeof gate.renewalId === 'string' && typeof gate.message === 'string' && !!gate.message.trim())
  })
}

export async function getReturnRenewalEligibility(rentalId: string) {
  return read(await apiRequest(`/api/customer/rentals/${encodeURIComponent(rentalId)}/return-eligibility`), rentalId)
}

export async function getRenewalCancellationPolicy(renewalId: string) {
  return read(await apiRequest(`/api/customer/renewals/${encodeURIComponent(renewalId)}/cancellation-policy`), undefined, renewalId)
}
