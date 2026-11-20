import { apiRequest } from './apiClient'
import type { CustomerFacility, FacilityStatus } from './customerReservationApi'

export interface FacilityLifecycleSummary {
  facilityId: string
  status: FacilityStatus
  pendingHoldCount: number
  processingReservationCount: number
  activeContractCount: number
  outstandingPaymentCount: number
  outstandingRefundCount: number
}

export interface FacilityLifecycleChangeRequest {
  id: string
  facilityId: string
  facilityName: string
  requestedBy: string
  requesterName: string
  createdAt: string
  requestedStatus: 'maintenance' | 'inactive'
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedBy: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  summary: FacilityLifecycleSummary
}

interface ApiEnvelope<T> {
  data: T
  correlationId: string
}

const facilityPath = (facilityId: string) => encodeURIComponent(facilityId)

export async function getManagerFacilityLifecycleSummary(facilityId: string) {
  const response = await apiRequest<ApiEnvelope<FacilityLifecycleSummary>>(
    `/api/manager/facilities/${facilityPath(facilityId)}/lifecycle-summary`,
  )
  return response.data
}

export async function requestManagerFacilityLifecycle(
  facilityId: string,
  requestedStatus: 'maintenance' | 'inactive',
  reason?: string,
) {
  const response = await apiRequest<ApiEnvelope<FacilityLifecycleChangeRequest>>(
    `/api/manager/facilities/${facilityPath(facilityId)}/lifecycle-requests`,
    {
      method: 'POST',
      body: JSON.stringify({ requestedStatus, reason: reason?.trim() || null }),
    },
  )
  return response.data
}

export async function listBusinessFacilityLifecycleRequests() {
  const response = await apiRequest<ApiEnvelope<FacilityLifecycleChangeRequest[]>>(
    '/api/business/facility-lifecycle-requests',
  )
  return response.data
}

export async function reviewBusinessFacilityLifecycleRequest(
  requestId: string,
  approved: boolean,
  reason?: string,
) {
  const response = await apiRequest<ApiEnvelope<FacilityLifecycleChangeRequest>>(
    `/api/business/facility-lifecycle-requests/${encodeURIComponent(requestId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ approved, reason: reason?.trim() || null }),
    },
  )
  return response.data
}

export async function getBusinessFacilityLifecycleSummary(facilityId: string) {
  const response = await apiRequest<ApiEnvelope<FacilityLifecycleSummary>>(
    `/api/business/facilities/${facilityPath(facilityId)}/lifecycle-summary`,
  )
  return response.data
}

export async function restoreBusinessFacility(facilityId: string) {
  const response = await apiRequest<ApiEnvelope<CustomerFacility>>(
    `/api/business/facilities/${facilityPath(facilityId)}/restore`,
    { method: 'POST' },
  )
  return response.data
}

export async function archiveBusinessFacility(facilityId: string) {
  const response = await apiRequest<ApiEnvelope<CustomerFacility>>(
    `/api/business/facilities/${facilityPath(facilityId)}/archive`,
    { method: 'POST' },
  )
  return response.data
}
