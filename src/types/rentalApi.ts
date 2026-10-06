export type RentalApiRole = "customer" | "manager"
export type RentalApiStatus = "active" | "return_requested" | "return_inspection" | "closing" | "completed"
export interface RentalApiPage<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string | null
}
export interface RentalApiRecord {
  id: string
  customer: {
    id: string
    fullName: string
  }
  facility: {
    id: string
    code: string
    name: string
  }
  storageUnit: {
    id: string
    code: string
  }
  unitType: {
    id: string
    code: string
    name: string
  }
  status: RentalApiStatus
  startDate: string | null
  contractEndDate: string | null
  monthlyPrice: number | null
  currency: string
  dataWarnings: {
    field: string
    reason: string
  }[]
}
export interface RentalApiDetail extends RentalApiRecord {
  reservationId: string | null
  actualReturnedAt: string | null
  completedAt: string | null
  financialSummary: {
    completeness: string
    currency: string
    outstandingAmount: number | null
    overdueAmount: number | null
    nextDueDate: string | null
    reason: string | null
  }
  access: {
    completeness: string
    status: string | null
    reason: string | null
  }
}
export interface RentalApiQuery {
  page?: number
  size?: number
  status?: RentalApiStatus
  search?: string
  endFrom?: string
  endTo?: string
  sort?: string
  facilityId?: string
}
