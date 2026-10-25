import { ApiClientError, apiRequest } from './apiClient'
import { isInstant, isUuid } from './renewalOperationsApi'

export interface SupportAiHistoryMessage { role: 'user' | 'assistant'; content: string }
export interface SupportAiRequest { message: string; history: SupportAiHistoryMessage[] }
export interface SupportAiReply {
  requestId: string
  authorRole: 'AI'
  source?: 'FAQ' | 'GEMINI'
  answer: string
  model: string
  knowledgeVersion: string
  generatedAt: string
  truncated: boolean
}

export function newSupportAiRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // UUID v4 also works on LAN HTTP where randomUUID may be unavailable.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function requestSupportAiReply(body: SupportAiRequest, key: string): Promise<SupportAiReply> {
  if (!isUuid(key) || !body.message.trim() || body.message.length > 1000 || body.history.length > 10
    || body.history.some(message => !['user', 'assistant'].includes(message.role) || !message.content.trim() || message.content.length > 1000)
    || body.message.length + body.history.reduce((sum, message) => sum + message.content.length, 0) > 8000) {
    throw new ApiClientError('Câu hỏi hoặc lịch sử vượt giới hạn cho phép.', { status: 400, code: 'CLIENT_VALIDATION' })
  }
  const envelope = await apiRequest<{ data?: unknown }>('/api/customer/chat/replies', {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body), timeoutMs: 40_000,
  })
  const reply = envelope?.data as Partial<SupportAiReply> | null
  if (!reply || reply.requestId !== key || reply.authorRole !== 'AI'
    || (reply.source !== undefined && reply.source !== 'FAQ' && reply.source !== 'GEMINI')
    || typeof reply.answer !== 'string' || !reply.answer.trim() || reply.answer.length > 4000
    || typeof reply.model !== 'string' || !reply.model || typeof reply.knowledgeVersion !== 'string'
    || !isInstant(reply.generatedAt) || typeof reply.truncated !== 'boolean') {
    throw new ApiClientError('Chưa xác nhận được phản hồi AI. Hãy kiểm tra lại cùng câu hỏi.', { code: 'INVALID_AI_RESPONSE' })
  }
  return reply as SupportAiReply
}

export function supportAiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) return 'Chưa kết nối được trợ lý AI. Bạn có thể kiểm tra lại hoặc gặp nhân viên.'
  switch (error.code) {
    case 'FEATURE_DISABLED': return 'Trợ lý AI chưa được bật trên máy chủ. Bạn có thể gặp nhân viên để được hỗ trợ.'
    case 'AI_UNAVAILABLE': return 'Trợ lý AI tạm thời chưa sẵn sàng. Vui lòng thử lại sau hoặc chọn tab Nhân viên.'
    case 'AI_RATE_LIMITED': return 'Đã đạt giới hạn lượt hỏi hoặc trợ lý đang bận. Vui lòng chờ hoặc gặp nhân viên.'
    case 'AI_TIMEOUT': return 'Trợ lý AI phản hồi quá lâu nên chưa có câu trả lời. Bạn có thể gặp nhân viên hoặc gửi câu hỏi khác.'
    case 'AI_PROVIDER_ERROR': return 'Gemini chưa trả lời được lúc này. Bạn có thể nhập lại sau hoặc chọn tab Nhân viên.'
    case 'UNAUTHORIZED': return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
    case 'FORBIDDEN': return 'Tài khoản hiện tại không có quyền sử dụng trợ lý này.'
    case 'VALIDATION_ERROR':
    case 'CLIENT_VALIDATION': return 'Câu hỏi hoặc lịch sử không hợp lệ. Vui lòng nhập câu hỏi ngắn hơn.'
    case 'CONFLICT': return 'Yêu cầu cần được kiểm tra lại bằng cùng mã gửi. Không gửi lặp câu hỏi mới.'
    case 'INVALID_AI_RESPONSE': return 'Chưa xác nhận được phản hồi AI. Hãy kiểm tra lại cùng câu hỏi.'
    default: return error.status === 404
      ? 'Máy chủ chưa có API trợ lý AI. Vui lòng cập nhật và khởi động lại backend.'
      : 'Chưa xác nhận được kết quả gửi. Bạn có thể kiểm tra lại cùng câu hỏi hoặc gặp nhân viên.'
  }
}
