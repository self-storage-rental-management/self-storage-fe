import { apiDownload, apiRequest } from './apiClient'
import type { PageResponse, ReservationGoodsItem, ReservationStatus } from './customerReservationApi'

export interface ReservationReview {
  reservationId: string
  reservationCode: string
  facilityId: string
  unitTypeId: string
  customerId: string
  customerEmail: string
  reservationStatus: ReservationStatus
  goodsReviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED'
  startDate: string
  endDate: string
  goodsCondition: string | null
  reservationNotes: string | null
  reviewDueAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
  goodsItems: ReservationGoodsItem[]
}

export interface StaffReservationProgress {
  reservationId: string
  reservationCode: string
  customerId: string
  customerName: string
  customerEmail: string
  facilityId: string
  facilityName: string
  unitTypeId: string
  unitTypeName: string
  assignedUnitId: string | null
  assignedUnitCode: string | null
  status: ReservationStatus
  goodsReviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED'
  startDate: string
  endDate: string
  appointmentAt: string | null
  holdExpiresAt: string | null
  paymentExpiresAt: string | null
  createdAt: string
}

export async function listStaffReservationReviews(page = 0, size = 20) {
  return apiRequest<PageResponse<ReservationReview>>(`/api/staff/reservation-reviews?page=${page}&size=${size}`)
}

export async function decideStaffReservationReview(reservationId: string, decision: 'APPROVE' | 'REJECT', note: string) {
  if (decision === 'REJECT' && !note.trim()) throw new Error('Vui lòng nhập lý do từ chối.')
  const result = await apiRequest<{ data: ReservationReview }>(`/api/staff/reservation-reviews/${reservationId}/decision`, {
    method: 'POST', body: JSON.stringify({ decision, note: note.trim() || null }),
  })
  return result.data
}

export async function listStaffActiveReservations(params: {
  page?: number
  size?: number
  q?: string
  status?: ReservationStatus | ''
} = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? 10))
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.status) query.set('status', params.status)
  return apiRequest<PageResponse<StaffReservationProgress>>(`/api/staff/reservations?${query}`)
}

export function downloadStaffReservationGoodsImage(fileId: string) {
  return apiDownload(`/api/files/${encodeURIComponent(fileId)}`)
}
