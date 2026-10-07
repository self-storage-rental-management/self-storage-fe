import { ApiClientError, apiRequest } from './apiClient'

export type CheckInStatus = 'scheduled' | 'completed' | 'rejected' | 'no_show' | 'cancelled' | null
export type CheckInReservationStatus = 'UNIT_RESERVED' | 'READY_FOR_CHECKIN' | 'AWAITING_CUSTOMER_RECEIPT'

export interface CheckInChecklist {
  identityVerified: boolean
  reservationMatched: boolean
  contractVerified: boolean
  paymentVerified: boolean
  measurementVerified: boolean
  unitWalkthrough: boolean
  conditionRecorded: boolean
  accessHandedOver: boolean
}

export interface CompleteCheckInRequest {
  checklist: CheckInChecklist
  actualMeasurements: {
    lengthCm: number
    widthCm: number
    heightCm: number
    weightKg: number
    actualVolumeM3: number
    varianceAccepted: boolean
  }
  initialUnitCondition: string
  goodsCondition: string
  packageCount: number
  goodsCategory: string
  evidenceReferences: string[]
  handedOverItems: string[]
  notes: string
}

export interface CheckInCase {
  checkInId: string | null
  checkInStatus: CheckInStatus
  scheduledAt: string | null
  checkedInAt: string | null
  readinessNote: string | null
  performedBy: string | null
  performedByName: string | null
  reservationId: string
  reservationCode: string
  reservationStatus: CheckInReservationStatus
  customerId: string
  customerName: string
  customerEmail: string
  facilityId: string
  facilityName: string
  storageUnitId: string
  storageUnitCode: string
  storageUnitStatus: 'reserved' | 'assigned'
  assignmentId: string
  assignmentStatus: 'ACTIVE' | 'COMPLETED'
  startDate: string
  endDate: string
  handover: CompleteCheckInRequest | null
}

export interface CheckInPage {
  data: CheckInCase[]
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

export interface CheckInEvidenceAsset {
  id: string
  originalName: string
  contentType: string
  sizeBytes: number
  entityType: 'CHECK_IN'
  entityId: string
  status: string
}

function assertPage(payload: unknown): CheckInPage {
  const value = payload as Partial<CheckInPage> | null
  if (!value || !Array.isArray(value.data) || !value.pagination
    || typeof value.pagination.page !== 'number'
    || typeof value.pagination.totalItems !== 'number'
    || typeof value.pagination.totalPages !== 'number') {
    throw new ApiClientError('Backend trả về danh sách check-in không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return value as CheckInPage
}

function assertEnvelope(payload: unknown): CheckInCase {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Backend trả về hồ sơ check-in không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as ApiEnvelope<CheckInCase>).data
}

export async function listCheckIns(params: { page?: number; pageSize?: number; q?: string } = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    pageSize: String(params.pageSize ?? 20),
  })
  if (params.q?.trim()) query.set('q', params.q.trim())
  return assertPage(await apiRequest<unknown>(`/api/staff/check-ins?${query}`))
}

export async function scheduleCheckIn(
  reservationId: string,
  request: { scheduledAt: string; contractVerified: boolean; paymentVerified: boolean; note: string },
) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/reservations/${encodeURIComponent(reservationId)}/schedule`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function completeCheckIn(checkInId: string, request: CompleteCheckInRequest) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/complete`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function markCheckInNoShow(checkInId: string, reason: string) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/no-show`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  ))
}

export async function uploadCheckInEvidence(checkInId: string, file: File) {
  const form = new FormData()
  form.set('file', file)
  form.set('entityType', 'CHECK_IN')
  form.set('entityId', checkInId)
  const payload = await apiRequest<unknown>('/api/files', { method: 'POST', body: form })
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Backend trả về bằng chứng check-in không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as ApiEnvelope<CheckInEvidenceAsset>).data
}
