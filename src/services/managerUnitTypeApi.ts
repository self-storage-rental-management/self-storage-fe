import { apiRequest } from './apiClient'
import type { CustomerUnitType } from './customerReservationApi'

export interface ManagerUnitTypeInput {
  code?: string | null
  name: string
  description?: string | null
  lengthM: number
  widthM: number
  heightM: number
  maxLoadKg: number
  rackCount: number
  rackLengthM: number
  rackWidthM: number
  rackHeightM: number
  aisleWidthM: number
  trolleyType: string
  smallBoxCapacity: number
  largeBoxCapacity: number
  imageUrl?: string | null
  detailImageUrl?: string | null
  physicalUnitCount: number
  floor?: string | null
  zone?: string | null
  acceptedGoodsCategoryIds: string[]
  acceptedGoodsMaterialIds: string[]
}

type Envelope<T> = { data: T; correlationId: string }

export async function archiveManagerUnitType(unitTypeId: string) {
  return apiRequest(`/api/manager/unit-types/${encodeURIComponent(unitTypeId)}`, { method: 'DELETE' })
}

/** @deprecated Use archiveManagerUnitType; the endpoint now performs a soft archive. */
export const deleteManagerUnitType = archiveManagerUnitType

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
