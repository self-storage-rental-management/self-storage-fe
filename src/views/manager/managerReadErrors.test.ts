import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../services/apiClient'
import { managerDisplayError } from './managerPresentation'

describe('Manager read errors', () => {
  it('replaces backend validation details with Vietnamese guidance', () => {
    const message = managerDisplayError(new ApiClientError('Request validation failed', {
      status: 400, code: 'VALIDATION_ERROR', details: { imageUrl: 'size must be between 0 and 1000' },
    }))
    expect(message).toBe('Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các mục đã nhập.')
    expect(message).not.toMatch(/Backend|imageUrl|size must|Request validation/)
  })
  it('does not forward raw conflict messages or internal role names', () => {
    const message = managerDisplayError(new ApiClientError('Loại kho đang có yêu cầu chờ BO duyệt.', {
      status: 409, code: 'CONFLICT',
    }))
    expect(message).toBe('Dữ liệu đã thay đổi hoặc chưa đủ điều kiện xử lý. Vui lòng tải lại trước khi tiếp tục.')
    expect(message).not.toContain('BO')
  })
  it('does not describe a backend or malformed response failure as a network failure', () => {
    expect(managerDisplayError(new ApiClientError('internal', { status: 500 }))).toContain('Hệ thống gặp lỗi')
    expect(managerDisplayError(new ApiClientError('invalid', { code: 'INVALID_RESPONSE' }))).toContain('định dạng')
  })
  it('distinguishes a disabled feature from a disconnected request', () => {
    expect(managerDisplayError(new ApiClientError('disabled', { status: 503, code: 'FEATURE_DISABLED' }))).toContain('chưa được bật')
    expect(managerDisplayError(new ApiClientError('network'))).toContain('Không kết nối')
  })
})
