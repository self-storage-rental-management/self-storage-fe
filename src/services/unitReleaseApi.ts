import { ApiClientError, apiRequest } from './apiClient'

export type UnitReleaseDisposition = 'AVAILABLE' | 'MAINTENANCE'
export type UnitAssignmentStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED'
export type StorageUnitStatus = 'available' | 'reserved' | 'occupied' | 'maintenance' | 'held' | 'assigned'

export interface UnitReleaseEligibility {
  releasable: boolean
  reservationCancelled: boolean
  activeAssignmentPresent: boolean
  completedCheckInPresent: boolean
  activeRentalPresent: boolean
  blockingReasons: string[]
}

export interface UnitReleaseCase {
  reservationId: string
  reservationCode: string
  reservationStatus: 'CANCELLED'
  cancelledAt: string | null
  cancelReason: string | null
  facilityId: string
  facilityName: string
  unitTypeId: string
  assignment: {
    assignmentId: string
    status: UnitAssignmentStatus
    assignedAt: string
    storageUnitId: string
    storageUnitCode: string
    storageUnitStatus: StorageUnitStatus
  }
  eligibility: UnitReleaseEligibility
}

export interface UnitReleaseResult {
  reservationId: string
  reservationStatus: 'CANCELLED'
  assignmentId: string
  assignmentStatus: UnitAssignmentStatus
  assignmentCancelledAt: string
  storageUnitId: string
  storageUnitCode: string
  previousStorageUnitStatus: StorageUnitStatus
  storageUnitStatus: StorageUnitStatus
  disposition: UnitReleaseDisposition
  processedBy: string
  processedAt: string
}

export interface UnitReleasePage {
  data: UnitReleaseCase[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string
}

interface ApiEnvelope<T> {
  data: T
  correlationId: string
}

export interface UnitReleaseListParams {
  page?: number
  pageSize?: number
  q?: string
  blocked?: boolean
}

function assertPage(payload: unknown): UnitReleasePage {
  const value = payload as Partial<UnitReleasePage> | null
  if (!value || !Array.isArray(value.data)
    || !value.pagination
    || typeof value.pagination.page !== 'number'
    || typeof value.pagination.pageSize !== 'number'
    || typeof value.pagination.totalItems !== 'number'
    || typeof value.pagination.totalPages !== 'number') {
    throw new ApiClientError('Backend trả về danh sách giải phóng kho không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return value as UnitReleasePage
}

function assertEnvelope<T>(payload: unknown): ApiEnvelope<T> {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Backend trả về dữ liệu giải phóng kho không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return payload as ApiEnvelope<T>
}

export async function listUnitReleaseCases(params: UnitReleaseListParams = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    pageSize: String(params.pageSize ?? 20),
    blocked: String(params.blocked ?? false),
  })
  if (params.q?.trim()) query.set('q', params.q.trim())
  return assertPage(await apiRequest<unknown>(`/api/staff/cancelled-reservations/unit-releases?${query}`))
}

export async function getUnitReleaseCase(reservationId: string) {
  const payload = await apiRequest<unknown>(
    `/api/staff/cancelled-reservations/${encodeURIComponent(reservationId)}/unit-release`,
  )
  return assertEnvelope<UnitReleaseCase>(payload).data
}

export async function releaseAssignedUnit(
  reservationId: string,
  request: { assignmentId: string; disposition: UnitReleaseDisposition; reason: string },
  idempotencyKey: string,
) {
  const payload = await apiRequest<unknown>(
    `/api/staff/cancelled-reservations/${encodeURIComponent(reservationId)}/unit-release`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(request),
    },
  )
  return assertEnvelope<UnitReleaseResult>(payload).data
}
