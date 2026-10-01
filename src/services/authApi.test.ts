import { afterEach, describe, expect, it, vi } from 'vitest'
import { changePasswordWithApi } from './authApi'
import { clearAuthTokens, getRefreshToken, hasAccessToken } from './apiClient'

describe('changePasswordWithApi', () => {
  afterEach(() => {
    clearAuthTokens()
    vi.unstubAllGlobals()
  })

  it('changes the password through the authenticated endpoint and stores rotated tokens', async () => {
    const actor = {
      id: 'admin-1',
      email: 'admin@example.com',
      fullName: 'StorageHub Administrator',
      phone: null,
      status: 'ACTIVE',
      roles: ['ADMIN'],
      facilityScopes: {},
      mustChangePassword: false,
      permissions: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        accessToken: 'rotated-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        sessionId: 'session-1',
        actor,
        refreshToken: 'rotated-refresh-token',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await changePasswordWithApi('current-password', 'new-password-12')

    expect(result).toEqual(actor)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/auth/password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'current-password', newPassword: 'new-password-12' }),
    }))
    expect(hasAccessToken()).toBe(true)
    expect(getRefreshToken()).toBe('rotated-refresh-token')
  })
})
