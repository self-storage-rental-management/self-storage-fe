import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../services/apiClient'
import { adminUserFieldErrors } from './adminUserValidation'
import { isOptionalVietnamesePhone } from '../../domain/vietnamesePhone'

describe('admin account validation', () => {
  it('maps backend validation errors to the account form fields', () => {
    const error = new ApiClientError('Thông tin gửi lên chưa hợp lệ', { details: { phoneValid: 'Số điện thoại không hợp lệ', fullName: 'Thiếu họ tên', email: 'Email không hợp lệ', password: 'Mật khẩu không hợp lệ' } })
    expect(adminUserFieldErrors(error)).toEqual({ phone: 'Số điện thoại không hợp lệ', name: 'Thiếu họ tên', email: 'Email không hợp lệ', password: 'Mật khẩu không hợp lệ' })
  })
  it('rejects the eleven-digit mobile number from the reported form', () => {
    expect(isOptionalVietnamesePhone('09133345678')).toBe(false)
    expect(isOptionalVietnamesePhone('0913334567')).toBe(true)
    expect(isOptionalVietnamesePhone('')).toBe(true)
  })
  it('handles errors without field details', () => {
    expect(adminUserFieldErrors(new Error('Offline'))).toEqual({})
    expect(adminUserFieldErrors(new ApiClientError('Error', { details: null }))).toEqual({})
  })
})
