import { apiRequest } from './apiClient'

export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'INACTIVE'
export type RuntimePolicyStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE'

export interface RentalPackagePolicyApi {
  id: string
  facilityId: string
  facilityName: string
  code: string
  name: string
  rentalMonths: number
  rentalYears?: number | null
  freeSetupDays?: number | null
  description?: string | null
  discountRate: number
  depositRate?: number
  earlyTerminationFeeCapMonths?: number
  earlyTerminationFeeCoefficient?: number
  earlyTerminationNoticeDays?: number
  policyVersion: string
  publicationStatus?: PublicationStatus
  runtimeStatus?: RuntimePolicyStatus
  active: boolean
  effectiveFrom: string
  effectiveTo: string | null
  createdAt: string
  updatedAt: string
}

export interface RentalPackagePolicyInput {
  facilityId: string
  code: string
  name: string
  rentalMonths?: number
  rentalYears?: number | null
  freeSetupDays?: number | null
  description?: string | null
  discountRate: number
  depositRate?: number
  earlyTerminationFeeCapMonths?: number
  earlyTerminationFeeCoefficient?: number
  earlyTerminationNoticeDays?: number
  policyVersion: string
  publicationStatus?: PublicationStatus
  active?: boolean
  effectiveFrom: string
  effectiveTo?: string | null
}

type Envelope<T> = { data: T; correlationId: string }

export async function listBusinessPackagePolicies(facilityId?: string) {
  const params = new URLSearchParams()
  if (facilityId) params.set('facilityId', facilityId)
  const suffix = params.size ? `?${params}` : ''
  const response = await apiRequest<Envelope<RentalPackagePolicyApi[]>>(`/api/business/policies/packages${suffix}`)
  return response.data
}

export async function createBusinessPackagePolicy(input: RentalPackagePolicyInput) {
  const response = await apiRequest<Envelope<RentalPackagePolicyApi>>('/api/business/policies/packages', {
    method: 'POST', body: JSON.stringify(input),
  })
  return response.data
}

export async function updateBusinessPackagePolicy(id: string, input: RentalPackagePolicyInput) {
  const response = await apiRequest<Envelope<RentalPackagePolicyApi>>(`/api/business/policies/packages/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(input),
  })
  return response.data
}

export async function publishBusinessPackagePolicy(id: string) {
  const response = await apiRequest<Envelope<RentalPackagePolicyApi>>(`/api/business/policies/packages/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  })
  return response.data
}

export async function inactiveBusinessPackagePolicy(id: string) {
  const response = await apiRequest<Envelope<RentalPackagePolicyApi>>(`/api/business/policies/packages/${encodeURIComponent(id)}/inactive`, {
    method: 'POST',
  })
  return response.data
}

export async function deactivateBusinessPackagePolicy(id: string) {
  await apiRequest(`/api/business/policies/packages/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
