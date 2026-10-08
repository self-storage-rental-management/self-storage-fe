import { apiRequest } from './apiClient'

export type CustomerRentalStatus = 'active' | 'return_requested' | 'return_inspection' | 'closing' | 'completed'

export interface CustomerRental {
  id: string
  reservationId: string
  facilityId: string
  facilityName: string
  facilityAddress: string
  storageUnitId: string
  storageUnitCode: string
  status: CustomerRentalStatus
  startDate: string
  contractEndDate: string
  monthlyPrice: number
  actualReturnedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
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
  return apiRequest<CustomerRentalPage>(`/api/customer/rentals?${params.toString()}`)
}
