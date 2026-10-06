import { apiRequest } from './apiClient'
import type { PageResponse } from './customerReservationApi'

export type ApiNotificationType = 'RESERVATION' | 'PAYMENT' | 'CHECKIN' | 'RETURN' | 'OVERDUE' | 'SUPPORT' | 'SYSTEM'

export interface ApiNotification {
  id: string
  userId: string
  type: ApiNotificationType
  title: string
  content: string
  relatedEntityId: string | null
  isRead: boolean
  createdAt: string
}

interface ApiEnvelope<T> { data: T }

export async function listNotifications(page = 0, size = 50) {
  return apiRequest<PageResponse<ApiNotification>>(`/api/notifications?page=${page}&size=${size}`)
}

export async function markNotificationRead(id: string) {
  const response = await apiRequest<ApiEnvelope<ApiNotification>>(`/api/notifications/${id}/read`, { method: 'PATCH' })
  return response.data
}
