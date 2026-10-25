import { apiRequest, ApiClientError } from './apiClient'
import { isUuid, isInstant } from './renewalOperationsApi'
export type ReadRole = 'customer' | 'staff'
export type SupportReadStatus = { ticketId: string; unreadCount: number; lastMessageAt: string | null }
function status(value: unknown): value is SupportReadStatus {
  const r = value as SupportReadStatus | null
  return !!r && isUuid(r.ticketId) && Number.isSafeInteger(r.unreadCount) && r.unreadCount >= 0 && (r.lastMessageAt === null || isInstant(r.lastMessageAt))
}
export async function listSupportReadStatus(role: ReadRole, ticketIds: string[]) {
  if (!ticketIds.length) return []
  if (!['customer', 'staff'].includes(role) || ticketIds.length > 100 || !ticketIds.every(isUuid)) throw new Error('Invalid read query')
  const result = await apiRequest<{ data: unknown }>(`/api/${role}/support-workflows/read-status?ticketIds=${ticketIds.join(',')}`)
  if (!Array.isArray(result.data) || !result.data.every(status) || result.data.some(r => !ticketIds.includes(r.ticketId))) throw new ApiClientError('Không thể đọc trạng thái tin nhắn.', { code: 'INVALID_RESPONSE' })
  return result.data as SupportReadStatus[]
}
export async function markSupportMessagesRead(role: ReadRole, ticketId: string, messageIds: string[]) {
  if (!['customer', 'staff'].includes(role) || !isUuid(ticketId) || !messageIds.length || messageIds.length > 100 || !messageIds.every(isUuid)) throw new Error('Invalid read marker')
  const result = await apiRequest<{ data: unknown }>(`/api/${role}/support-workflows/${ticketId}/read`, { method: 'PUT', body: JSON.stringify({ messageIds }) })
  if (!status(result.data) || result.data.ticketId !== ticketId) throw new ApiClientError('Chưa xác nhận đã đọc tin nhắn.', { code: 'INVALID_RESPONSE' })
  window.dispatchEvent(new Event('storagehub:support-read'))
  return result.data
}
