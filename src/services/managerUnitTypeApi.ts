import { apiRequest } from './apiClient'
import type { CustomerUnitType } from './customerReservationApi'

export interface ManagerUnitTypeInput {
  code: string
  name: string
  lengthM: number
  widthM: number
  heightM: number
  maxLoadKg: number
  rackCount: number
  rackLengthM: number
  rackWidthM: number
  rackHeightM: number
  imageUrl?: string | null
  physicalUnitCount: number
  floor?: string | null
  zone?: string | null
}

type Envelope<T> = { data: T; correlationId: string }

export async function createManagerUnitType(facilityId: string, input: ManagerUnitTypeInput) {
  const response = await apiRequest<Envelope<CustomerUnitType>>(
    `/api/manager/facilities/${encodeURIComponent(facilityId)}/unit-types`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return response.data
}

export async function updateManagerUnitType(unitTypeId: string, input: ManagerUnitTypeInput) {
  const response = await apiRequest<Envelope<CustomerUnitType>>(
    `/api/manager/unit-types/${encodeURIComponent(unitTypeId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return response.data
}
