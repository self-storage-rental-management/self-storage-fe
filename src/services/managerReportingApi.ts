import { apiRequest } from './apiClient'

export interface ManagerReportSummary {
  facilityId: string
  facilityName: string
  totalUnits: number
  availableUnits: number
  occupiedUnits: number
  maintenanceUnits: number
  reservedUnits: number
  occupancyRate: number
  monthlyRecurringRevenue: number
  collectedRevenue: number
  overdueRentalsCount: number
  monthCheckinsCount: number
  openReturnsCount: number
  openMaintenanceTasksCount: number
}

interface ApiEnvelope<T> {
  data: T
  correlationId: string
}

export function getManagerReportSummary(facilityId?: string) {
  const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ''
  return apiRequest<ApiEnvelope<ManagerReportSummary>>(`/api/manager/reports/summary${query}`)
}
