import { apiRequest } from './apiClient'

export interface PublicFacilitySummary {
  id: string
  code: string
  name: string
  address: string
  city: string
  status: 'active' | 'maintenance' | 'inactive' | 'coming_soon'
  totalUnits: number
  availableUnits: number
  startingMonthlyPrice: number | null
  createdAt: string
  updatedAt: string
}

export interface PublicUnitTypeSummary {
  id: string
  facilityId: string
  code: string
  name: string
  lengthM: number
  widthM: number
  heightM: number
  areaM2: number
  volumeM3: number
  monthlyPrice: number
  maxLoadKg: number
  rackCount: number
  rackLengthM: number
  rackWidthM: number
  rackHeightM: number
  availableCount: number
}

interface PublicFacilityPage {
  data: PublicFacilitySummary[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  correlationId: string
}

interface PublicUnitTypePage {
  data: PublicUnitTypeSummary[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  correlationId: string
}

export async function listPublicFacilities(page = 0, size = 50) {
  const response = await apiRequest<PublicFacilityPage>(
    `/api/public/facilities?page=${page}&size=${size}`,
    { skipAuth: true },
  )
  return response.data
}

export async function listPublicUnitTypes(page = 0, size = 50) {
  const response = await apiRequest<PublicUnitTypePage>(
    `/api/public/unit-types?page=${page}&size=${size}`,
    { skipAuth: true },
  )
  return response.data
}
