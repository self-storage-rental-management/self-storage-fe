import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../services/apiClient'
import { formatAuthError } from './formatAuthError'

const fallback = 'Đăng nhập thất bại. Vui lòng thử lại.'
describe('Vietnamese authentication errors', () => {
  it('translates incorrect credentials from the running backend', () => {
    expect(formatAuthError(new ApiClientError('Email or password is incorrect'), fallback)).toBe('Email hoặc mật khẩu không chính xác.')
  })
  it('translates diagnostics even when the public message is generic', () => {
    expect(formatAuthError(new ApiClientError('Thất bại', { diagnosticMessage: 'The account is not active' }), fallback)).toContain('Tài khoản chưa được kích hoạt')
  })
  it('uses Vietnamese fallback for unknown English and preserves Vietnamese errors', () => {
    expect(formatAuthError(new Error('Unexpected authentication failure'), fallback)).toBe(fallback)
    expect(formatAuthError(new Error('Mật khẩu tạm đã hết hạn.'), fallback)).toBe('Mật khẩu tạm đã hết hạn.')
  })
  it('translates network failures and backend field validation', () => {
    expect(formatAuthError(new Error('Failed to fetch'), fallback)).toBe('Không thể kết nối, vui lòng thử lại sau.')
    expect(formatAuthError(new ApiClientError('Validation failed', { details: { email: 'must be valid' } }), fallback)).toContain('Địa chỉ email không hợp lệ')
  })
})
