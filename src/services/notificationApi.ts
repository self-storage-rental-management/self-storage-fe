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

export async function markAllNotificationsRead() {
  const response = await apiRequest<ApiEnvelope<{ updated: number }>>('/api/notifications/read-all', { method: 'PATCH' })
  return response.data
}

export interface BellNotificationPayload {
  id?: string
  title?: string
  message: string
  date?: string
  page?: string
  targetId?: string
}

export function notifyBell(payload: BellNotificationPayload | string) {
  const notif = typeof payload === 'string'
    ? {
        id: `bell-action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: 'Thông báo hệ thống',
        message: payload,
        date: new Date().toISOString(),
        page: 'dashboard',
        isRead: false
      }
    : {
        id: payload.id || `bell-action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: payload.title || 'Thông báo hệ thống',
        message: payload.message,
        date: payload.date || new Date().toISOString(),
        page: payload.page || 'dashboard',
        targetId: payload.targetId,
        isRead: false
      }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storagehub:bell-notification', { detail: notif }))
  }
  return notif
}
