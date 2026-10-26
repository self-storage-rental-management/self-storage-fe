import { apiRequest } from './apiClient'
import { readRentalEnvelope, readRentalPage } from './rentalApi'

export type MaintenanceTaskPriority = 'low' | 'medium' | 'high'
export type MaintenanceTaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'
export type StorageUnitStatus = 'available' | 'reserved' | 'occupied' | 'maintenance' | 'held' | 'assigned' | 'inactive' | 'archived'

export interface MaintenanceTaskApi {
  id: string
  facilityId: string
  facilityName: string
  storageUnitId: string
  unitCode: string
  returnCaseId: string | null
  title: string
  reason: string
  priority: MaintenanceTaskPriority
  damageClassification: string | null
  reportedById: string | null
  reportedByName: string | null
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

export interface MaintenanceStaffOption {
  id: string
  fullName: string
}

export interface MaintenanceStorageUnit {
  id: string
  facilityId: string
  unitTypeId: string
  code: string
  floor: string | null
  zone: string | null
  status: StorageUnitStatus
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object')
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isNullableText = (value: unknown): value is string | null => value === null || typeof value === 'string'
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isUuidLike = (value: unknown): value is string => isText(value)

function isMaintenanceTask(value: unknown): value is MaintenanceTaskApi {
  if (!isRecord(value)) return false
  return isUuidLike(value.id) && isUuidLike(value.facilityId) && isText(value.facilityName) &&
    isUuidLike(value.storageUnitId) && isText(value.unitCode) && isText(value.title) && isText(value.reason) &&
    ['low', 'medium', 'high'].includes(String(value.priority)) &&
    ['open', 'in_progress', 'completed', 'cancelled'].includes(String(value.status)) &&
    isNullableText(value.returnCaseId) && isNullableText(value.damageClassification) &&
    isNullableText(value.reportedById) && isNullableText(value.reportedByName) &&
    isNullableText(value.assignedStaffId) && isNullableText(value.assignedStaffName) &&
    (value.dueAt === null || typeof value.dueAt === 'string') &&
    (value.startedAt === null || isInstant(value.startedAt)) &&
    (value.completedAt === null || isInstant(value.completedAt)) &&
    isNullableText(value.resultReport) && Array.isArray(value.evidencePhotos) && value.evidencePhotos.every(isText) &&
    isInstant(value.createdAt) && isInstant(value.updatedAt)
}

function isStorageUnit(value: unknown): value is MaintenanceStorageUnit {
  if (!isRecord(value)) return false
  return isUuidLike(value.id) && isUuidLike(value.facilityId) && isUuidLike(value.unitTypeId) && isText(value.code) &&
    isNullableText(value.floor) && isNullableText(value.zone) &&
    ['available', 'reserved', 'occupied', 'maintenance', 'held', 'assigned'].includes(String(value.status))
}

export type MaintenanceTask = MaintenanceTaskApi

interface MaintenanceTaskFilters {
  facilityId?: string
  assignedStaffId?: string
  status?: MaintenanceTaskStatus
  q?: string
  page?: number
  pageSize?: number
}

async function listMaintenanceTasks(
  filters: MaintenanceTaskFilters = {},
  endpoint = '/api/staff/maintenance-tasks',
) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 0),
    pageSize: String(filters.pageSize ?? 100),
  })
  if (filters.facilityId) params.set('facilityId', filters.facilityId)
  if (filters.assignedStaffId) params.set('assignedStaffId', filters.assignedStaffId)
  if (filters.status) params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)

  return readRentalPage<MaintenanceTaskApi>(
    await apiRequest(`${endpoint}?${params.toString()}`),
    isMaintenanceTask,
    filters.page ?? 0,
  )
}

export function listManagerMaintenanceTasks(facilityId: string): ReturnType<typeof listMaintenanceTasks>
export function listManagerMaintenanceTasks(filters: MaintenanceTaskFilters): ReturnType<typeof listMaintenanceTasks>
export function listManagerMaintenanceTasks(facilityIdOrFilters: string | MaintenanceTaskFilters) {
  return listMaintenanceTasks(typeof facilityIdOrFilters === 'string'
    ? { facilityId: facilityIdOrFilters }
    : facilityIdOrFilters, '/api/manager/maintenance-tasks')
}

export function listStaffMaintenanceTasks(filters: MaintenanceTaskFilters = {}) {
  return listMaintenanceTasks(filters)
}

export async function listFacilityStorageUnits(facilityId: string) {
  const encoded = encodeURIComponent(facilityId)
  return readRentalPage<MaintenanceStorageUnit>(
    await apiRequest(`/api/storage-units?facilityId=${encoded}&page=0&size=100&sort=code,asc`),
    isStorageUnit,
    0,
  )
}

export async function listMaintenanceStaff(facilityId: string) {
  const encoded = encodeURIComponent(facilityId)
  return readRentalEnvelope<MaintenanceStaffOption[]>(
    await apiRequest(`/api/staff/maintenance-tasks/staff-options?facilityId=${encoded}`),
    value => Array.isArray(value) && value.every(item => isRecord(item) && isUuidLike(item.id) && isText(item.fullName)),
  )
}

export async function createMaintenanceTask(body: {
  storageUnitId: string
  title: string
  reason: string
  priority: MaintenanceTaskPriority
  assignedStaffId: string
  dueAt: string
}) {
  return readRentalEnvelope<MaintenanceTaskApi>(
    await apiRequest('/api/manager/maintenance-tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    isMaintenanceTask,
  )
}

export async function assignMaintenanceTask(taskId: string, assignedStaffId: string) {
  return readRentalEnvelope<MaintenanceTaskApi>(
    await apiRequest(`/api/manager/maintenance-tasks/${encodeURIComponent(taskId)}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedStaffId }),
    }),
    isMaintenanceTask,
  )
}

export interface CompleteMaintenanceTaskRequest {
  resultReport: string
  evidencePhotos: string[]
  makeUnitAvailable: boolean
}

export interface MaintenanceEvidenceAsset {
  id: string
  originalName: string
  contentType: string
  sizeBytes: number
}

function readMaintenanceEvidenceAsset(value: unknown): MaintenanceEvidenceAsset {
  if (!isRecord(value) || !isRecord(value.data) || !isUuidLike(value.data.id) ||
    !isText(value.data.originalName) || !isText(value.data.contentType) ||
    typeof value.data.sizeBytes !== 'number' || !Number.isFinite(value.data.sizeBytes)) {
    throw new Error('Backend trả về tệp bằng chứng bảo trì không hợp lệ.')
  }
  return {
    id: value.data.id,
    originalName: value.data.originalName,
    contentType: value.data.contentType,
    sizeBytes: value.data.sizeBytes,
  }
}

export async function startMaintenanceTask(taskId: string) {
  return readRentalEnvelope<MaintenanceTaskApi>(
    await apiRequest(`/api/staff/maintenance-tasks/${encodeURIComponent(taskId)}/start`, {
      method: 'POST',
    }),
    isMaintenanceTask,
  )
}

export async function completeMaintenanceTask(taskId: string, request: CompleteMaintenanceTaskRequest) {
  if (!request.resultReport.trim()) throw new Error('Nhập báo cáo kết quả bảo trì.')
  if (request.resultReport.length > 4000) throw new Error('Báo cáo kết quả không được vượt quá 4000 ký tự.')
  return readRentalEnvelope<MaintenanceTaskApi>(
    await apiRequest(`/api/staff/maintenance-tasks/${encodeURIComponent(taskId)}/complete`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
    isMaintenanceTask,
  )
}

export async function uploadMaintenanceEvidence(taskId: string, file: File) {
  if (!file || file.size <= 0) throw new Error('Tệp ảnh bảo trì không được để trống.')
  const form = new FormData()
  form.set('file', file)
  form.set('entityType', 'MAINTENANCE_TASK')
  form.set('entityId', taskId)
  return readMaintenanceEvidenceAsset(await apiRequest('/api/files', { method: 'POST', body: form }))
}
