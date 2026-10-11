import { ApiClientError, apiDownload, apiRequest } from './apiClient'

export type CheckInStatus = 'scheduled' | 'completed' | 'rejected' | 'no_show' | 'cancelled' | null
export type CheckInListStatus = 'UNSCHEDULED' | 'scheduled' | 'completed' | 'no_show'
export type CheckInReservationStatus = 'UNIT_RESERVED' | 'READY_FOR_CHECKIN' | 'AWAITING_CUSTOMER_RECEIPT' | 'REJECTED'

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
  varianceReason: string | null
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
  appointmentAt: string | null
  checkedInAt: string | null
  readinessNote: string | null
  rejectionReason: string | null
  rejectionDisposition: 'AVAILABLE' | 'MAINTENANCE' | null
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
  storageUnitStatus: 'reserved' | 'assigned' | 'available' | 'maintenance'
  assignmentId: string
  assignmentStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  declaredPackageCount: number | null
  declaredGoodsWeightKg: number
  declaredGoodsVolumeM3: number
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

export type AccessCredentialType = 'PIN' | 'CARD' | 'KEY' | 'LOCK'
export type AccessCredentialStatus = 'ACTIVE' | 'REVOKED'

export interface AccessCredential {
  id: string
  reservationId: string
  reservationCode: string
  rentalId: string | null
  facilityId: string
  facilityName: string
  storageUnitId: string
  storageUnitCode: string
  customerId: string
  customerName: string
  type: AccessCredentialType
  status: AccessCredentialStatus
  reference: string
  issuedBy: string
  issuedByName: string
  issuedAt: string
  revokedBy: string | null
  revokedByName: string | null
  revokedAt: string | null
  note: string | null
}

export interface CredentialAlert {
  id: string
  action: 'ISSUE' | 'REVOKE'
  reservationId: string
  reservationCode: string
  rentalId: string | null
  facilityId: string
  facilityName: string
  storageUnitId: string
  storageUnitCode: string
  customerId: string
  customerName: string
  credentialType: AccessCredentialType | null
  reference: string | null
  dueAt: string | null
  reason: string
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

export async function listCheckIns(params: {
  page?: number
  pageSize?: number
  q?: string
  status?: CheckInListStatus
  scheduledFrom?: string
  scheduledTo?: string
} = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    pageSize: String(params.pageSize ?? 20),
  })
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.status) query.set('status', params.status)
  if (params.scheduledFrom) query.set('scheduledFrom', params.scheduledFrom)
  if (params.scheduledTo) query.set('scheduledTo', params.scheduledTo)
  return assertPage(await apiRequest<unknown>(`/api/staff/check-ins?${query}`))
}

export async function scheduleCheckIn(
  reservationId: string,
  request: {
    scheduledAt: string
    contractVerified: boolean
    paymentVerified: boolean
    note: string
  },
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

export async function rejectCheckIn(
  checkInId: string,
  request: {
    reason: string
    disposition: 'AVAILABLE' | 'MAINTENANCE'
    evidenceReferences: string[]
  },
) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/reject`,
    { method: 'POST', body: JSON.stringify(request) },
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

export async function downloadCheckInEvidence(assetId: string) {
  return apiDownload(`/api/files/${encodeURIComponent(assetId)}`)
}

function assertCredentialEnvelope(payload: unknown): AccessCredential {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Backend trả về quyền truy cập không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as ApiEnvelope<AccessCredential>).data
}

export async function issueAccessCredential(checkInId: string, request: {
  type: AccessCredentialType
  reference: string
  secret?: string
  note?: string
}) {
  return assertCredentialEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/credentials`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function revokeAccessCredential(credentialId: string, reason: string) {
  return assertCredentialEnvelope(await apiRequest<unknown>(
    `/api/staff/access-credentials/${encodeURIComponent(credentialId)}/revoke`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  ))
}

export async function listCredentialAlerts(facilityId?: string) {
  const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ''
  const payload = await apiRequest<unknown>(`/api/staff/credential-alerts${query}`)
  if (!Array.isArray(payload)) {
    throw new ApiClientError('Backend trả về cảnh báo quyền truy cập không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return payload as CredentialAlert[]
}

export async function listAccessCredentials(params: {
  facilityId?: string
  q?: string
  status?: AccessCredentialStatus
  page?: number
  pageSize?: number
} = {}) {
  const query = new URLSearchParams({ page: String(params.page ?? 0), pageSize: String(params.pageSize ?? 20) })
  if (params.facilityId && params.facilityId !== 'ALL') query.set('facilityId', params.facilityId)
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.status) query.set('status', params.status)
  const payload = await apiRequest<unknown>(`/api/manager/access-credentials?${query}`)
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) {
    throw new ApiClientError('Backend trả về lịch sử quyền truy cập không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return payload as {
    data: AccessCredential[]
    pagination: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
      sort: string
    }
    correlationId: string
  }
}
