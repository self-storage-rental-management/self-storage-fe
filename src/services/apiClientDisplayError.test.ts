import { afterEach, expect, it, vi } from 'vitest'
import { apiDownload, apiRequest } from './apiClient'

afterEach(() => vi.unstubAllGlobals())

it.each([apiRequest, apiDownload])('masks server diagnostics while preserving business messages and structured error fields', async request => {
  const diagnostic = 'SQL exception khi cập nhật hồ sơ'
  const details = { field: 'profile', reason: 'stale' }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ error: { code: 'CONFLICT', message: diagnostic, details } }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  )))
  await expect(request('/api/test')).rejects.toMatchObject({
    message: 'Hồ sơ đã thay đổi hoặc chưa đủ điều kiện. Vui lòng kiểm tra lại.',
    diagnosticMessage: diagnostic,
    code: 'CONFLICT',
    details,
  })

  const businessMessage = 'Đơn đặt kho đã quá hạn xác nhận.'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ error: { code: 'CONFLICT', message: businessMessage, details } }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  )))
  await expect(request('/api/test')).rejects.toMatchObject({
    message: businessMessage,
    diagnosticMessage: businessMessage,
    code: 'CONFLICT',
    details,
  })
})
