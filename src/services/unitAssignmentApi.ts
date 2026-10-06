import { ApiClientError, apiRequest } from './apiClient'

export type AssignmentReservationStatus = 'CONFIRMED' | 'UNIT_RESERVED'
export type AssignmentStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED'
export type AssignmentUnitStatus = 'available' | 'reserved'

export interface UnitAssignmentCandidate {
  reservationId: string
  reservationCode: string
  reservationStatus: 'CONFIRMED'
  customerId: string
  customerName: string
  customerEmail: string
  facilityId: string
  facilityName: string
  unitTypeId: string
  unitTypeName: string
  startDate: string
  endDate: string
  confirmedAt: string | null
  totalGoodsVolumeM3: number
  totalGoodsWeightKg: number
}

export interface AssignableUnit {
  storageUnitId: string
  storageUnitCode: string
  floor: string | null
  zone: string | null
  status: 'available'
}

export interface UnitAssignmentResult {
  assignmentId: string
  assignmentStatus: AssignmentStatus
  assignedAt: string
  assignedBy: string
  reservationId: string
  reservationCode: string
  reservationStatus: AssignmentReservationStatus
  storageUnitId: string
  storageUnitCode: string
  storageUnitStatus: AssignmentUnitStatus
}

export interface ApiPage<T> {
  data: T[]
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

function assertPage<T>(payload: unknown, message: string): ApiPage<T> {
  const value = payload as Partial<ApiPage<T>> | null
  if (!value || !Array.isArray(value.data)
    || !value.pagination
    || typeof value.pagination.page !== 'number'
    || typeof value.pagination.pageSize !== 'number'
    || typeof value.pagination.totalItems !== 'number'
    || typeof value.pagination.totalPages !== 'number') {
    throw new ApiClientError(message, { code: 'INVALID_API_RESPONSE' })
  }
  return value as ApiPage<T>
}

function assertEnvelope<T>(payload: unknown): ApiEnvelope<T> {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Backend trả về assignment không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return payload as ApiEnvelope<T>
}

export async function listUnitAssignmentCandidates(params: {
  page?: number
  pageSize?: number
  q?: string
} = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    pageSize: String(params.pageSize ?? 20),
  })
  if (params.q?.trim()) query.set('q', params.q.trim())
  return assertPage<UnitAssignmentCandidate>(
    await apiRequest<unknown>(`/api/staff/unit-assignments/candidates?${query}`),
    'Backend trả về danh sách reservation chờ phân kho không hợp lệ.',
  )
}

export async function listAssignableUnits(reservationId: string, q = '') {
  const query = new URLSearchParams({ page: '0', pageSize: '100' })
  if (q.trim()) query.set('q', q.trim())
  return assertPage<AssignableUnit>(
    await apiRequest<unknown>(
      `/api/staff/unit-assignments/candidates/${encodeURIComponent(reservationId)}/available-units?${query}`,
    ),
    'Backend trả về danh sách gian kho khả dụng không hợp lệ.',
  )
}

export async function createUnitAssignment(reservationId: string, storageUnitId: string) {
  const payload = await apiRequest<unknown>(
    `/api/staff/unit-assignments/${encodeURIComponent(reservationId)}`,
    { method: 'POST', body: JSON.stringify({ storageUnitId }) },
  )
  return assertEnvelope<UnitAssignmentResult>(payload).data
}
