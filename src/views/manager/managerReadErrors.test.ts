import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../services/apiClient'
import { managerDisplayError } from './managerPresentation'

describe('Manager read errors', () => {
  it('explains an outdated backend image size limit', () => {
    expect(managerDisplayError(new ApiClientError('Request validation failed', {
      status: 400, code: 'VALIDATION_ERROR', details: { imageUrl: 'size must be between 0 and 1000' },
    }))).toContain('khởi động lại Backend')
  })
  it('preserves specific Vietnamese review conflict messages', () => {
    expect(managerDisplayError(new ApiClientError('Loại kho đang có yêu cầu chờ BO duyệt.', {
      status: 409, code: 'CONFLICT',
    }))).toBe('Loại kho đang có yêu cầu chờ BO duyệt.')
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
