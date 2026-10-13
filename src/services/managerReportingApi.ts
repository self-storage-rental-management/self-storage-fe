import { ApiClientError, apiRequest } from './apiClient'

export interface ManagerReportActivity {
  id: string
  action: string
  actionLabel: string
  entityType: string
  entityId: string
  actorName: string
  actorRole: string
  facilityId: string
  facilityName: string
  notes: string | null
  beforeStateJson: string | null
  afterStateJson: string | null
  correlationId: string | null
  timestamp: string
}

export interface ManagerReportActivityPage {
  data: ManagerReportActivity[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string
}

function invalidResponse(): never {
  throw new ApiClientError('Phản hồi báo cáo cơ sở không đúng contract.', {
    code: 'INVALID_RESPONSE',
  })
}

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
  collectedRevenue: number | null
  overdueRentalsCount: number
  monthCheckinsCount: number
  openReturnsCount: number
  openMaintenanceTasksCount: number
  unitStatusBreakdown: { status: string; name: string; count: number; percentage: number }[]
  unitTypeBreakdown: { typeCode: string; typeName: string; totalUnits: number; occupiedUnits: number; occupancyRate: number }[]
}

interface ApiEnvelope<T> {
  data: T
  correlationId: string
}

export async function getManagerReportSummary(facilityId?: string) {
  const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ''
  const response = await apiRequest<unknown>(`/api/manager/reports/summary${query}`)
  const data = response && typeof response === 'object'
    ? (response as Partial<ApiEnvelope<ManagerReportSummary>>).data
    : undefined
  const counts = data && [
    data.totalUnits, data.availableUnits, data.occupiedUnits, data.maintenanceUnits,
    data.reservedUnits, data.overdueRentalsCount, data.monthCheckinsCount,
    data.openReturnsCount, data.openMaintenanceTasksCount,
  ]
  const validBreakdowns = data && Array.isArray(data.unitStatusBreakdown) &&
    data.unitStatusBreakdown.every(row => typeof row.status === 'string' && typeof row.name === 'string' && Number.isFinite(row.count) && Number.isFinite(row.percentage)) &&
    Array.isArray(data.unitTypeBreakdown) && data.unitTypeBreakdown.every(row =>
      typeof row.typeCode === 'string' && typeof row.typeName === 'string' &&
      Number.isFinite(row.totalUnits) && Number.isFinite(row.occupiedUnits) && Number.isFinite(row.occupancyRate))
  if (!data || typeof data.facilityId !== 'string' || typeof data.facilityName !== 'string' ||
    !counts?.every(value => Number.isSafeInteger(value) && value >= 0) ||
    !Number.isFinite(data.occupancyRate) || !Number.isFinite(data.monthlyRecurringRevenue) ||
    !(data.collectedRevenue === null || Number.isFinite(data.collectedRevenue)) || !validBreakdowns) return invalidResponse()
  return response as ApiEnvelope<ManagerReportSummary>
}

export async function listManagerReportActivities({
  facilityId,
  page,
  pageSize,
  search,
}: {
  facilityId: string
  page: number
  pageSize: number
  search?: string
}): Promise<ManagerReportActivityPage> {
  if (!facilityId || !Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApiClientError('Bộ lọc nhật ký hoạt động không hợp lệ.', { code: 'INVALID_QUERY' })
  }
  const params = new URLSearchParams({ facilityId, page: String(page), pageSize: String(pageSize) })
  const normalizedSearch = search?.trim()
  if (normalizedSearch) params.set('search', normalizedSearch)
  const result = await apiRequest<unknown>(`/api/manager/reports/activities?${params.toString()}`)
  if (!result || typeof result !== 'object') return invalidResponse()
  const response = result as Partial<ManagerReportActivityPage>
  const pagination = response.pagination
  const validActivity = (row: ManagerReportActivity) => Boolean(row &&
    typeof row.id === 'string' && typeof row.action === 'string' &&
    typeof row.actionLabel === 'string' && typeof row.entityType === 'string' &&
    typeof row.entityId === 'string' && typeof row.actorName === 'string' &&
    typeof row.actorRole === 'string' && typeof row.facilityId === 'string' &&
    typeof row.facilityName === 'string' &&
    (row.notes === null || typeof row.notes === 'string') &&
    (row.beforeStateJson === null || typeof row.beforeStateJson === 'string') &&
    (row.afterStateJson === null || typeof row.afterStateJson === 'string') &&
    (row.correlationId === null || typeof row.correlationId === 'string') &&
    typeof row.timestamp === 'string' && Number.isFinite(Date.parse(row.timestamp)))
  if (!Array.isArray(response.data) || !response.data.every(validActivity) ||
    !pagination || pagination.page !== page || pagination.pageSize !== pageSize ||
    !Number.isSafeInteger(pagination.totalItems) || pagination.totalItems < 0 ||
    !Number.isSafeInteger(pagination.totalPages) ||
    pagination.totalPages !== Math.ceil(pagination.totalItems / pagination.pageSize) ||
    typeof pagination.sort !== 'string' || typeof response.correlationId !== 'string') {
    return invalidResponse()
  }
  return response as ManagerReportActivityPage
}
