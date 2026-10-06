import { apiRequest } from './apiClient'
import type { PageResponse, PaymentComplaint } from './customerReservationApi'

interface ApiEnvelope<T> { data: T }

export async function listManagerPaymentComplaints(page = 0, size = 20) {
  return apiRequest<PageResponse<PaymentComplaint>>(`/api/manager/payment-complaints?page=${page}&size=${size}`)
}

export async function getManagerPaymentComplaint(complaintId: string) {
  const response = await apiRequest<ApiEnvelope<PaymentComplaint>>(`/api/manager/payment-complaints/${complaintId}`)
  return response.data
}

export async function decideManagerPaymentComplaint(complaintId: string, decision: 'APPROVE' | 'REJECT', reason: string) {
  const response = await apiRequest<ApiEnvelope<PaymentComplaint>>(`/api/manager/payment-complaints/${complaintId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason: reason.trim() || null }),
  })
  return response.data
}
