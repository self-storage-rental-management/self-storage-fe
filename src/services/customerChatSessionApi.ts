import { apiRequest, ApiClientError } from './apiClient'
import { isUuid } from './renewalOperationsApi'

export type ChatSessionMessage = { id: number; role: 'assistant' | 'customer'; body: string; status?: 'pending' | 'failed'; truncated?: boolean; source?: 'FAQ' | 'GEMINI' }
export type ChatSessionSnapshot = { messages: ChatSessionMessage[]; ticketId: string | null; autoReturn: boolean }
export type CustomerChatSession = { version: number; snapshot: ChatSessionSnapshot }

function session(value: unknown): CustomerChatSession {
  const data = value as CustomerChatSession | null
  if (!data || !Number.isSafeInteger(data.version) || data.version < 0 || !data.snapshot || !Array.isArray(data.snapshot.messages)
    || data.snapshot.messages.length > 200 || typeof data.snapshot.autoReturn !== 'boolean'
    || data.snapshot.ticketId !== null && !isUuid(data.snapshot.ticketId)
    || data.snapshot.messages.some(m => !m || !Number.isSafeInteger(m.id) || m.id < 0 || !['customer', 'assistant'].includes(m.role)
      || typeof m.body !== 'string' || !m.body.trim() || m.body.length > 4000
      || m.status != null && !['pending', 'failed'].includes(m.status) || m.source != null && !['FAQ', 'GEMINI'].includes(m.source)
      || m.truncated != null && typeof m.truncated !== 'boolean')
    || new Set(data.snapshot.messages.map(m => m.id)).size !== data.snapshot.messages.length
    || data.snapshot.messages.reduce((sum, m) => sum + m.body.length, 0) > 200000) {
    throw new ApiClientError('Không thể đọc phiên chat đã lưu.', { code: 'INVALID_RESPONSE' })
  }
  return { version: data.version, snapshot: { ...data.snapshot, messages: data.snapshot.messages.map(m => ({
    id: m.id, role: m.role, body: m.body, ...(m.status ? { status: m.status } : {}),
    ...(m.source ? { source: m.source } : {}), ...(m.truncated != null ? { truncated: m.truncated } : {}),
  })) } }
}
export async function loadCustomerChatSession() {
  return session((await apiRequest<{ data: unknown }>('/api/customer/chat/session')).data)
}
export async function saveCustomerChatSession(snapshot: ChatSessionSnapshot, expectedVersion: number, mutationId: string) {
  return session((await apiRequest<{ data: unknown }>('/api/customer/chat/session', {
    method: 'PUT', body: JSON.stringify({ snapshot, expectedVersion, mutationId }),
  })).data)
}
