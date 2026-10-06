import { apiRequest } from './apiClient'
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
  reviewDueAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
  goodsItems: ReservationGoodsItem[]
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
