import { apiRequest, ApiClientError } from './apiClient'

export const PUBLIC_SUPPORT_UNKNOWN = 'Mình không biết câu trả lời từ nguồn công khai đã được xác nhận của StorageHub. Bạn có thể chọn Nhân viên để được hỗ trợ hoặc kiểm tra trường hợp cụ thể.'
export interface PublicSupportEntry {
  id: string
  question: string
  aliases: string[]
  answer: string
  sources: { label: string; path: string }[]
}
export async function getPublicSupportKnowledge(): Promise<PublicSupportEntry[]> {
  const envelope = await apiRequest<{ data?: { version?: unknown; entries?: unknown } }>('/api/public/support/knowledge', { skipAuth: true })
  const catalog = envelope?.data
  if (!catalog || catalog.version !== 'support-public/2026-10-26-v2' || !Array.isArray(catalog.entries)
    || catalog.entries.length === 0 || catalog.entries.length > 100
    || !catalog.entries.every((entry: PublicSupportEntry) => entry && typeof entry.id === 'string' && /^faq-[a-z-]+$/.test(entry.id)
      && typeof entry.question === 'string' && typeof entry.answer === 'string' && entry.answer.trim() && entry.answer.length <= 4000
      && Array.isArray(entry.aliases) && entry.aliases.every(a => typeof a === 'string') && Array.isArray(entry.sources) && entry.sources.length > 0
      && entry.sources.every(s => s && typeof s.label === 'string' && typeof s.path === 'string' && /^\/api\/(public|customer|auth)\/[a-zA-Z0-9/-]+$/.test(s.path)))
    || new Set(catalog.entries.map((e: PublicSupportEntry) => e.id)).size !== catalog.entries.length) {
    throw new ApiClientError('Chưa xác nhận được nguồn hướng dẫn công khai.', { code: 'INVALID_RESPONSE' })
  }
  return catalog.entries as PublicSupportEntry[]
}
