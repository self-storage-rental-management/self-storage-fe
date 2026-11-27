import { ApiClientError } from '../../services/apiClient'

export function formatAuthError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error || '')
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('timeout') ||
    message.includes('Không thể kết nối') ||
    message.includes('ERR_CONNECTION')
  ) {
    return 'Không thể kết nối, vui lòng thử lại sau.'
  }

  // Extract detailed field validation messages if available from ApiClientError
  if (error && typeof error === 'object' && 'details' in error) {
    const details = (error as { details?: unknown }).details
    if (typeof details === 'string' && details.trim()) {
      return fallback
    }
    if (details && typeof details === 'object') {
      const fieldTranslations: Record<string, string> = {
        password: 'Mật khẩu phải từ 8-128 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (!@#$%^&*...) không có khoảng trắng.',
        email: 'Địa chỉ email không hợp lệ hoặc đã được đăng ký trong hệ thống.',
        phone: 'Số điện thoại phải gồm 10 chữ số viết liền và đúng đầu số di động Việt Nam.',
        fullName: 'Họ và tên tối thiểu 2 ký tự và không vượt quá 160 ký tự.',
        permanentAddress: 'Địa chỉ thường trú không hợp lệ hoặc để trống.',
        emergencyContactName: 'Họ tên người liên hệ khẩn cấp không hợp lệ hoặc để trống.',
        emergencyContactPhone: 'Số điện thoại người liên hệ khẩn cấp phải gồm 10 chữ số viết liền và đúng đầu số di động Việt Nam.',
      }
      const entries = Object.entries(details as Record<string, string>)
      if (entries.length > 0) {
        const [field] = entries[0]
        return fieldTranslations[field] || fallback
      }
    }
  }

  const translations: Record<string, string> = {
    'The email delivery service is unavailable': 'Dịch vụ gửi email hiện không khả dụng. Vui lòng thử lại sau.',
    'The email delivery service is not configured': 'Dịch vụ gửi email chưa được cấu hình. Vui lòng báo Admin.',
    'An account with this email already exists': 'Email này đã được đăng ký trong hệ thống.',
    'Email or password is incorrect': 'Email hoặc mật khẩu không chính xác.',
    'The account is not active': 'Tài khoản chưa được kích hoạt hoặc đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
    'Google account email is not verified': 'Email của tài khoản Google chưa được xác minh.',
    'Google identity token is invalid': 'Thông tin đăng nhập Google không hợp lệ. Vui lòng thử lại.',
    'The refresh token is invalid or expired': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    'The session actor is invalid': 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
    'Invalid email or password': 'Email hoặc mật khẩu không chính xác.',
    'User not found': 'Không tìm thấy tài khoản với thông tin đã cung cấp.',
    'Account is disabled': 'Tài khoản của bạn tạm thời bị khóa. Vui lòng liên hệ hỗ trợ.',
    'Request validation failed': 'Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra lại các trường thông tin.',
  }
  return translations[error instanceof ApiClientError ? error.diagnosticMessage : message] || (/[À-ỹĐđ]/u.test(message) && !message.includes('http') && !message.includes('Error:') ? message : fallback)
}

