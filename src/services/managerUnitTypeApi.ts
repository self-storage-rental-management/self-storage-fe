import { apiRequest } from './apiClient'
import type { CustomerUnitType } from './customerReservationApi'
import type { ConfirmedRackLayout } from './rackLayoutApi'

export interface ManagerUnitTypeInput {
  code?: string | null
  name: string
  description?: string | null
  lengthM: number
  widthM: number
  heightM: number
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
  maxLoadKg: number
  maxStoredLoadKg?: number | null
  rackCount: number
  rackLengthM: number
  rackWidthM: number
  rackHeightM: number
  aisleWidthM: number
  rackLengthCm?: number | null
  rackWidthCm?: number | null
  rackHeightCm?: number | null
  aisleWidthCm?: number | null
  storageAisleWidthM?: number | null
  gateWidthM?: number | null
  gateHeightM?: number | null
  lowestObstructionHeightM?: number | null
  overheadClearanceM?: number | null
  storageAisleWidthCm?: number | null
  gateWidthCm?: number | null
  gateHeightCm?: number | null
  lowestObstructionHeightCm?: number | null
  overheadClearanceCm?: number | null
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
  rackLayout?: ConfirmedRackLayout | null
}

type Envelope<T> = { data: T; correlationId: string }

export async function archiveManagerUnitType(unitTypeId: string) {
  return apiRequest(`/api/manager/unit-types/${encodeURIComponent(unitTypeId)}`, { method: 'DELETE' })
}

export async function restoreManagerUnitType(unitTypeId: string) {
  const response = await apiRequest<Envelope<CustomerUnitType>>(
    `/api/manager/unit-types/${encodeURIComponent(unitTypeId)}/restore`,
    { method: 'POST' },
  )
  return response.data
}

export async function createManagerUnitType(facilityId: string, input: ManagerUnitTypeInput & { rackLayout: ConfirmedRackLayout }) {
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
