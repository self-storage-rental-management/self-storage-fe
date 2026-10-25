import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAuthenticatedActor, loginWithApi, logoutFromApi } from './authApi'
import { clearAuthTokens, getAccessToken } from './apiClient'
import { registerChatSessionWriter, trackChatSessionSave } from './chatSessionSaveQueue'

const cleanup: (() => void)[] = []
const response = (id: string) => new Response(JSON.stringify({ data: {
  actor: { id, roles: ['CUSTOMER'], status: 'ACTIVE', permissions: [], facilityScopes: {} },
  accessToken: `access-${id}`, refreshToken: `refresh-${id}`,
} }), { headers: { 'Content-Type': 'application/json' } })

afterEach(() => { cleanup.splice(0).forEach(fn => fn()); clearAuthTokens(); vi.unstubAllGlobals() })

describe('Logout chat and session safety', () => {
  it('preserves authentication when chat saving fails, then allows logout after a successful retry', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response('one')).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await loginWithApi('one', 'test')
    const flush = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined)
    cleanup.push(registerChatSessionWriter('one', flush))
    await expect(logoutFromApi()).rejects.toThrow('Offline')
    expect(getAuthenticatedActor()?.id).toBe('one')
    expect(getAccessToken()).toBe('access-one')
    expect(fetch).toHaveBeenCalledTimes(1)
    await expect(logoutFromApi()).resolves.toBe(true)
    expect(getAuthenticatedActor()).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(new Headers(fetch.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer access-one')
  })

  it('does not send the old logout using a new login after waiting for chat', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response('one')).mockResolvedValueOnce(response('two'))
    vi.stubGlobal('fetch', fetch)
    await loginWithApi('one', 'test')
    let finish!: () => void
    trackChatSessionSave('one', new Promise<void>(resolve => { finish = resolve }))
    const logout = logoutFromApi()
    await loginWithApi('two', 'test')
    finish()
    await expect(logout).resolves.toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(getAuthenticatedActor()?.id).toBe('two')
    expect(getAccessToken()).toBe('access-two')
  })

  it('does not clear or refresh a new session when the old logout response arrives late', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockResolvedValueOnce(response('one'))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
      .mockResolvedValueOnce(response('two'))
    vi.stubGlobal('fetch', fetch)
    await loginWithApi('one', 'test')
    const logout = logoutFromApi()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await loginWithApi('two', 'test')
    finish(new Response(null, { status: 401 }))
    await expect(logout).resolves.toBe(false)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(getAuthenticatedActor()?.id).toBe('two')
    expect(getAccessToken()).toBe('access-two')
  })

  it('still clears local credentials when saved chat is safe but server logout is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response('one')).mockRejectedValueOnce(new Error('Offline')))
    await loginWithApi('one', 'test')
    await expect(logoutFromApi()).resolves.toBe(true)
    expect(getAccessToken()).toBeNull()
  })
})
