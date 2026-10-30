import { ApiClientError } from '../services/apiClient'
import { displayText } from './displayText'

const FALLBACK = 'Không thể thực hiện yêu cầu. Vui lòng kiểm tra thông tin và thử lại.'
const technical = /(?:\b(?:exception|stacktrace|java\.|jdbc|sql|backend|frontend|FileAsset|UUID|ApiEnvelope|TypeError|ReferenceError)\b|goodsItems\[|expectedVersion|Idempotency-Key|Request body|Cannot deserialize)/i

export function userFacingError(error: unknown, fallback = FALLBACK): string {
  if (error instanceof Error && error.message === 'The email delivery service is not configured') return 'Dịch vụ gửi email chưa được cấu hình. Vui lòng liên hệ quản trị hoặc thử lại sau.'
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') return 'Chưa kết nối được hệ thống. Vui lòng thử lại.'
    if (error.status !== null && error.status >= 500) return 'Hệ thống chưa xử lý được yêu cầu. Vui lòng thử lại sau.'
  }
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/[À-ỹ]/u.test(raw) && !technical.test(raw)) return displayText(raw)
  if (error instanceof ApiClientError) {
    if (error.status === 404) return 'Không tìm thấy thông tin yêu cầu. Vui lòng tải lại trang.'
    if (error.status === 409) return 'Thông tin đã thay đổi hoặc chưa đủ điều kiện xử lý. Vui lòng kiểm tra lại trước khi tiếp tục.'
    if (error.status === 400 || error.status === 422) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các mục đã nhập.'
  }
  return displayText(fallback)
}
