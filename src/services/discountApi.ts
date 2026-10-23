import { apiRequest } from './apiClient'

export type DiscountScope = 'GLOBAL' | 'FACILITY' | 'POLICY'
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'
export type DiscountPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'INACTIVE'
export type DiscountRuntimeStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE'

export interface DiscountCodeApi {
  id: string
  code: string
  name: string
  description?: string | null
  scope: DiscountScope
  facilityId?: string | null
  facilityName?: string | null
  policyId?: string | null
  policyName?: string | null
  discountType: DiscountType
  discountValue: number
  effectiveFrom: string
  effectiveTo?: string | null
  publicationStatus: DiscountPublicationStatus
  runtimeStatus: DiscountRuntimeStatus
  maxUses?: number | null
  currentUses: number
  createdById?: string | null
  createdByName?: string | null
  createdAt: string
  updatedAt: string
}

export interface DiscountCodeInput {
  code: string
  name: string
  description?: string | null
  scope: DiscountScope
  facilityId?: string | null
  policyId?: string | null
  discountType: DiscountType
  discountValue: number
  effectiveFrom: string
  effectiveTo?: string | null
  publicationStatus?: DiscountPublicationStatus
  maxUses?: number | null
}

type Envelope<T> = { data: T; correlationId: string }

export async function listDiscountCodes(facilityId?: string) {
  const params = new URLSearchParams()
  if (facilityId) params.set('facilityId', facilityId)
  const suffix = params.size ? `?${params}` : ''
  const response = await apiRequest<Envelope<DiscountCodeApi[]>>(`/api/business/discounts${suffix}`)
  return response.data
}

export async function getDiscountCode(id: string) {
  const response = await apiRequest<Envelope<DiscountCodeApi>>(`/api/business/discounts/${encodeURIComponent(id)}`)
  return response.data
}

export async function createDiscountCode(input: DiscountCodeInput) {
  const response = await apiRequest<Envelope<DiscountCodeApi>>('/api/business/discounts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function updateDiscountCode(id: string, input: DiscountCodeInput) {
  const response = await apiRequest<Envelope<DiscountCodeApi>>(`/api/business/discounts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function publishDiscountCode(id: string) {
  const response = await apiRequest<Envelope<DiscountCodeApi>>(`/api/business/discounts/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  })
  return response.data
}

export async function inactiveDiscountCode(id: string) {
  const response = await apiRequest<Envelope<DiscountCodeApi>>(`/api/business/discounts/${encodeURIComponent(id)}/inactive`, {
    method: 'POST',
  })
  return response.data
}

export async function deleteDiscountCode(id: string) {
  await apiRequest(`/api/business/discounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
