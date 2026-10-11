import { apiRequest } from './apiClient'
import { readRentalEnvelope, readRentalPage } from './rentalApi'

export type MaintenanceTaskPriority = 'low' | 'medium' | 'high'
export type MaintenanceTaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'
export type StorageUnitStatus = 'available' | 'reserved' | 'occupied' | 'maintenance' | 'held' | 'assigned'

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
    isUuidLike(value.reportedById) && isText(value.reportedByName) &&
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
  page?: number
  pageSize?: number
}

async function listMaintenanceTasks(filters: MaintenanceTaskFilters = {}) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 0),
    pageSize: String(filters.pageSize ?? 100),
  })
  if (filters.facilityId) params.set('facilityId', filters.facilityId)
  if (filters.assignedStaffId) params.set('assignedStaffId', filters.assignedStaffId)

  return readRentalPage<MaintenanceTaskApi>(
    await apiRequest(`/api/staff/maintenance-tasks?${params.toString()}`),
    isMaintenanceTask,
    filters.page ?? 0,
  )
}

export function listManagerMaintenanceTasks(facilityId: string): ReturnType<typeof listMaintenanceTasks>
export function listManagerMaintenanceTasks(filters: MaintenanceTaskFilters): ReturnType<typeof listMaintenanceTasks>
export function listManagerMaintenanceTasks(facilityIdOrFilters: string | MaintenanceTaskFilters) {
  return listMaintenanceTasks(typeof facilityIdOrFilters === 'string'
    ? { facilityId: facilityIdOrFilters }
    : facilityIdOrFilters)
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
    await apiRequest('/api/staff/maintenance-tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    isMaintenanceTask,
  )
}

export async function assignMaintenanceTask(taskId: string, assignedStaffId: string) {
  return readRentalEnvelope<MaintenanceTaskApi>(
    await apiRequest(`/api/staff/maintenance-tasks/${encodeURIComponent(taskId)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedStaffId }),
    }),
    isMaintenanceTask,
  )
}
