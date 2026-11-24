import { afterEach, expect, it, vi } from 'vitest'
import { apiDownload, apiRequest } from './apiClient'

afterEach(() => vi.unstubAllGlobals())

it.each([apiRequest, apiDownload])('preserves the server message and structured error fields', async request => {
  const diagnostic = 'SQL exception khi cập nhật hồ sơ'
  const details = { field: 'profile', reason: 'stale' }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ error: { code: 'CONFLICT', message: diagnostic, details } }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  )))
  await expect(request('/api/test')).rejects.toMatchObject({
    message: diagnostic,
    diagnosticMessage: diagnostic,
    code: 'CONFLICT',
    details,
  })
})
