import { apiRequest, ApiClientError } from './apiClient'
import { getAuthenticatedActor } from './authApi'
import { isUuid } from './renewalOperationsApi'

export type RefundRequestStatus = 'REQUESTED' | 'PENDING_ESCALATION' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'REFUNDED' | 'FAILED'
export interface RefundRequestView {
  id: string
  paymentId: string
  returnCaseId: string | null
  requestedBy: string
  approvedBy: string | null
  amount: number
  reason: string
  status: RefundRequestStatus
  createdAt: string
  approvedAt: string | null
  processedAt: string | null
  gatewayRefundId: string | null
  gatewayTransactionNo: string | null
  gatewayResponseCode: string | null
  rejectionReason: string | null
}
const statuses: RefundRequestStatus[] = ['REQUESTED', 'PENDING_ESCALATION', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED']
const actor = () => {
  const a = getAuthenticatedActor()
  if (!a || a.status !== 'ACTIVE' || (!a.roles.includes('BUSINESS') && !a.roles.includes('ADMIN'))) {
    throw new ApiClientError('Bạn không có quyền duyệt yêu cầu hoàn tiền.', { status: 403 })
  }
  if (!a.permissions.includes('refunds:approve')) throw new ApiClientError('Bạn chưa có quyền duyệt hoàn tiền.', { status: 403 })
  return a
}
const valid = (v: unknown): v is RefundRequestView => {
  if (!v || typeof v !== 'object') return false
  const x = v as RefundRequestView
  return isUuid(x.id) && isUuid(x.paymentId) && isUuid(x.requestedBy) && typeof x.amount === 'number' && x.amount >= 0 &&
    typeof x.reason === 'string' && statuses.includes(x.status) && typeof x.createdAt === 'string' &&
    (x.returnCaseId === null || isUuid(x.returnCaseId)) && (x.approvedBy === null || isUuid(x.approvedBy))
}
export async function listRefundRequests(status?: RefundRequestStatus) {
  actor()
  if (status !== undefined && !statuses.includes(status)) throw new Error('Trạng thái refund không hợp lệ.')
  const suffix = status ? `?status=${encodeURIComponent(status)}` : ''
  const response = await apiRequest<unknown>(`/api/business/refund-requests${suffix}`)
  if (!Array.isArray(response)) throw new ApiClientError('Backend trả về danh sách refund request không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  if (!response.every(valid)) throw new ApiClientError('Backend trả về refund request không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  return response
}
export async function approveRefundRequest(id: string, resolutionNote = '') {
  actor()
  if (!isUuid(id) || resolutionNote.length > 500) throw new Error('Yêu cầu hoàn tiền hoặc ghi chú không hợp lệ.')
  return apiRequest(`/api/business/refund-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNote: resolutionNote.trim() || undefined }),
  })
}
