import { afterEach, describe, expect, it, vi } from 'vitest'
import { actorToUser, canApiActor, canApiCustomerNavigate, changePasswordWithApi, getAuthenticatedActor, loginWithApi, updateProfileWithApi, type ApiActor } from './authApi'
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

describe('backend customer navigation and profile', () => {
  const actor: ApiActor = {
    id: 'real-customer', email: 'customer@example.com', fullName: 'Customer', phone: null,
    permanentAddress: null, emergencyContactName: null, emergencyContactPhone: null,
    avatarUrl: 'https://example.com/avatar.png', status: 'ACTIVE', roles: ['CUSTOMER'],
    facilityScopes: {}, mustChangePassword: false, permissions: [],
  }

  afterEach(() => {
    clearAuthTokens()
    vi.unstubAllGlobals()
  })

  async function authenticate() {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: {
      actor, accessToken: 'access', refreshToken: 'refresh',
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await loginWithApi(actor.email, 'test-password')
    return fetchMock
  }

  it('shows customer navigation without a demo user or internal permissions', async () => {
    await authenticate()
    const user = actorToUser(actor)
    for (const permission of ['view_dashboard', 'view_facilities', 'view_units', 'view_reservations', 'view_payments', 'view_support'] as const) {
      expect(canApiCustomerNavigate(user, permission)).toBe(true)
    }
    expect(canApiCustomerNavigate(user, 'manage_roles')).toBe(false)
    expect(canApiCustomerNavigate({ ...user, id: 'another-user' }, 'view_reservations')).toBe(false)
    clearAuthTokens()
    expect(canApiCustomerNavigate(user, 'view_reservations')).toBe(false)
  })

  it('saves to auth/me, preserves avatar and replaces the authenticated actor', async () => {
    const fetchMock = await authenticate()
    const updated = { ...actor, fullName: 'Updated Customer', phone: '0901234567' }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: updated }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    expect(await updateProfileWithApi({ fullName: updated.fullName, phone: updated.phone })).toEqual(updated)
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:8080/api/auth/me', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ fullName: updated.fullName, phone: updated.phone, avatarUrl: actor.avatarUrl }),
    }))
    expect(new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get('Authorization')).toBe('Bearer access')
    expect(getAuthenticatedActor()).toEqual(updated)
  })

  it('keeps current profile when backend rejects the update', async () => {
    const fetchMock = await authenticate()
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid phone' }), { status: 400 }))
    await expect(updateProfileWithApi({ fullName: actor.fullName, phone: 'invalid' })).rejects.toThrow()
    expect(getAuthenticatedActor()).toEqual(actor)
  })

  it('uses backend staff permissions without trusting a local role or demo identity', async () => {
    const staff: ApiActor = { ...actor, roles: ['STAFF'], permissions: ['view_reservations', 'approve_reservations'] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { actor: staff, accessToken: 'access', refreshToken: 'refresh' } }), { headers: { 'Content-Type': 'application/json' } })))
    await loginWithApi(staff.email, 'password')
    expect(canApiActor(actorToUser(staff), 'approve_reservations')).toBe(true)
    expect(canApiActor(actorToUser(staff), 'manage_roles')).toBe(false)
    expect(canApiActor({ ...actorToUser(staff), id: 'forged-id' }, 'approve_reservations')).toBe(false)
  })
})
