import { apiRequest, ApiClientError } from './apiClient'
import type { CustomerFacility, PageResponse } from './customerReservationApi'
import { isApiAuthenticated } from './authApi'
import type { PublicFacilitySummary } from './publicCatalogApi'

export interface FacilityUnitSpecInput {
  sizeCode: string
  name?: string
  count: number
  monthlyPrice: number
  lengthM?: number
  widthM?: number
  heightM?: number
  maxLoadKg?: number
}

export interface CreateFacilityInput {
  code: string
  name: string
  address: string
  city: string
  phone?: string | null
  accessHours?: string | null
  imageUrl?: string | null
  climateControlled?: boolean
  securityDescription?: string | null
  status?: string
  unitSpecs?: FacilityUnitSpecInput[]
}

export async function createFacilityApi(input: CreateFacilityInput): Promise<CustomerFacility> {
  const response = await apiRequest<{ data: CustomerFacility; correlationId: string }>('/api/facilities', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function listAllFacilitiesApi(): Promise<CustomerFacility[]> {
  try {
    if (isApiAuthenticated()) {
      const response = await apiRequest<PageResponse<CustomerFacility>>('/api/facilities?page=0&size=100')
      return (response.data || []).map(f => ({
        ...f,
        totalUnits: f.totalUnits ?? 0,
        occupiedUnits: f.occupiedUnits ?? Math.max(0, (f.totalUnits ?? 0) - (f.availableUnits ?? 0)),
        availableUnits: f.availableUnits ?? Math.max(0, (f.totalUnits ?? 0) - (f.occupiedUnits ?? 0)),
        monthRevenue: f.monthRevenue ?? 0,
      }))
    }
  } catch (error) {
    if (error instanceof ApiClientError && error.status !== 401 && error.status !== 403) {
      throw error
    }
  }

  const publicResponse = await apiRequest<PageResponse<PublicFacilitySummary>>(
    '/api/public/facilities?page=0&size=100',
    { skipAuth: true },
  )
  return (publicResponse.data || []).map(pub => ({
    id: pub.id,
    code: pub.code,
    name: pub.name,
    address: pub.address,
    city: pub.city,
    status: pub.status as CustomerFacility['status'],
    totalUnits: pub.totalUnits ?? 0,
    availableUnits: pub.availableUnits ?? 0,
    occupiedUnits: Math.max(0, (pub.totalUnits ?? 0) - (pub.availableUnits ?? 0)),
    minimumMonthlyPrice: pub.startingMonthlyPrice ?? null,
    monthRevenue: 0,
    createdAt: pub.createdAt,
    updatedAt: pub.updatedAt,
  }))
}

export async function deleteBusinessFacilityApi(facilityId: string) {
  return apiRequest(`/api/business/facilities/${encodeURIComponent(facilityId)}`, { method: 'DELETE' })
}

export async function updateBusinessFacilityApi(
  facilityId: string,
  input: Pick<CreateFacilityInput, 'name' | 'address' | 'city' | 'phone' | 'accessHours' | 'imageUrl' | 'climateControlled' | 'securityDescription' | 'status'>,
): Promise<CustomerFacility> {
  const response = await apiRequest<{ data: CustomerFacility; correlationId: string }>(
    `/api/business/facilities/${encodeURIComponent(facilityId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return response.data
}

export async function publishBusinessFacilityApi(facilityId: string): Promise<CustomerFacility> {
  const response = await apiRequest<{ data: CustomerFacility; correlationId: string }>(
    `/api/business/facilities/${encodeURIComponent(facilityId)}/publish`,
    { method: 'POST' },
  )
  return response.data
}

export async function priceBusinessUnitTypeApi(
  unitTypeId: string,
  input: { monthlyPrice: number; securityDepositAmount: number },
) {
  const response = await apiRequest<{ data: import('./customerReservationApi').CustomerUnitType; correlationId: string }>(
    `/api/business/unit-types/${encodeURIComponent(unitTypeId)}/pricing`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return response.data
}
