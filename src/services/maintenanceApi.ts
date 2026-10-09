import { apiRequest } from './apiClient'

export type MaintenanceTaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'

export interface MaintenanceTask {
  id: string
  facilityId: string
  facilityName: string
  storageUnitId: string | null
  unitCode: string | null
  returnCaseId: string | null
  title: string
  reason: string
  priority: string
  damageClassification: string | null
  reportedById: string
  reportedByName: string
  assignedStaffId: string | null
  assignedStaffName: string | null
  status: MaintenanceTaskStatus
  dueAt: string | null
  startedAt: string | null
  completedAt: string | null
  resultReport: string | null
  evidencePhotos: string[]
  createdAt: string
  updatedAt: string
}

export interface MaintenanceTaskPage {
  data: MaintenanceTask[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string
}

interface TaskFilters {
  facilityId?: string
  assignedStaffId?: string
  page?: number
  pageSize?: number
}

function toQuery(filters: TaskFilters) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 0),
    pageSize: String(filters.pageSize ?? 100),
  })
  if (filters.facilityId) params.set('facilityId', filters.facilityId)
  if (filters.assignedStaffId) params.set('assignedStaffId', filters.assignedStaffId)
  return params.toString()
}

export function listStaffMaintenanceTasks(filters: TaskFilters = {}) {
  return apiRequest<MaintenanceTaskPage>(`/api/staff/maintenance-tasks?${toQuery(filters)}`)
}

export function listManagerMaintenanceTasks(filters: TaskFilters = {}) {
  return apiRequest<MaintenanceTaskPage>(`/api/manager/maintenance-tasks?${toQuery(filters)}`)
}
