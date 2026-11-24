import { afterEach, expect, it, vi } from 'vitest'
import { apiDownload, apiRequest } from './apiClient'

afterEach(() => vi.unstubAllGlobals())

it.each([apiRequest, apiDownload])('keeps server diagnostics out of the displayed error', async request => {
  const diagnostic = 'SQL exception khi cập nhật hồ sơ'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ error: { code: 'CONFLICT', message: diagnostic } }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  )))
  await expect(request('/api/test')).rejects.toMatchObject({
    message: 'Hồ sơ đã thay đổi hoặc chưa đủ điều kiện. Vui lòng kiểm tra lại.',
    diagnosticMessage: diagnostic,
    code: 'CONFLICT',
  })
})
