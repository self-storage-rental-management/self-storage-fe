import { apiRequest } from './apiClient'

export interface MonthlyRevenue {
  month: string
  revenue: number
  transactionsCount: number
}

export interface FacilityRevenue {
  facilityId: string
  facilityName: string
  revenue: number
  occupancyRate: number
  activeRentalsCount: number
}

export interface PurposeRevenue {
  purpose: string
  amount: number
  count: number
}

export interface BusinessRevenueReport {
  totalRevenueCollected: number
  totalRefunds: number
  netRevenue: number
  monthlyBreakdown: MonthlyRevenue[]
  facilityBreakdown: FacilityRevenue[]
  paymentPurposeBreakdown: PurposeRevenue[]
}

export interface FacilityPerformance {
  facilityId: string
  facilityName: string
  city: string
  totalUnits: number
  occupiedUnits: number
  occupancyRate: number
  activeRentals: number
  openReturns: number
  openMaintenance: number
}

export interface BusinessPerformanceReport {
  totalFacilities: number
  totalCapacityUnits: number
  totalOccupiedUnits: number
  systemOccupancyRate: number
  facilityComparisons: FacilityPerformance[]
}

export async function getBusinessRevenueReportApi(
  months = 6,
  facilityId?: string
): Promise<BusinessRevenueReport> {
  const params = new URLSearchParams({ months: String(months) })
  if (facilityId) {
    params.set('facilityId', facilityId)
  }
  const res = await apiRequest<{ data: BusinessRevenueReport } | BusinessRevenueReport>(
    `/api/business/reports/revenue?${params.toString()}`
  )
  if (res && typeof res === 'object' && 'data' in res && res.data) {
    return res.data
  }
  return res as BusinessRevenueReport
}

export async function getBusinessPerformanceReportApi(): Promise<BusinessPerformanceReport> {
  const res = await apiRequest<{ data: BusinessPerformanceReport } | BusinessPerformanceReport>(
    '/api/business/reports/performance'
  )
  if (res && typeof res === 'object' && 'data' in res && res.data) {
    return res.data
  }
  return res as BusinessPerformanceReport
}
