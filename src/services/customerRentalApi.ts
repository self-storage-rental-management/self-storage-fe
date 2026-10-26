import { apiRequest } from './apiClient'
import type { ApiRentalStatus } from '../types/statusContracts'

export type CustomerRentalStatus = ApiRentalStatus

export interface CustomerRental {
  id: string
  reservationId?: string
  facilityId?: string
  facilityName?: string
  facilityAddress?: string
  storageUnitId?: string
  storageUnitCode?: string
  facility?: {
    id: string
    code?: string
    name: string
  }
  storageUnit?: {
    id: string
    code: string
  }
  unitType?: {
    id: string
    code?: string
    name: string
  }
  status: CustomerRentalStatus
  startDate?: string
  contractEndDate?: string | null
  setupStartedAt?: string | null
  setupEndsAt?: string | null
  inventoryDueAt?: string | null
  inventoryPending?: boolean
  moveInCompletedAt?: string | null
  setupExitReviewRequired?: boolean
  monthlyPrice?: number
  currency?: string
  actualReturnedAt?: string | null
  completedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

interface CustomerRentalPage {
  data: CustomerRental[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string
}

export async function listCustomerRentals(status?: CustomerRentalStatus, page = 0, size = 100) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (status) params.set('status', status)
  return checkedStatusPage(await apiRequest<CustomerRentalPage>(`/api/customer/rentals?${params.toString()}`), checkedRental)
}

export async function listAllCustomerRentals() {
  const firstPage = await listCustomerRentals(undefined, 0, 100)
  const totalPages = Math.max(firstPage.pagination.totalPages, 1)
  if (totalPages === 1) return firstPage.data

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => listCustomerRentals(undefined, index + 1, 100)),
  )
  return [firstPage, ...remainingPages].flatMap(page => page.data)
}
