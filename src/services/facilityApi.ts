import { apiRequest } from './apiClient'
import type { CustomerFacility, PageResponse } from './customerReservationApi'

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
  const response = await apiRequest<PageResponse<CustomerFacility>>('/api/facilities?page=0&size=100')
  return response.data
}
