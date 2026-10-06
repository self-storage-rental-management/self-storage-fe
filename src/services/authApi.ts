import type { Role, User } from '../types'
import type { PermissionKey } from '../types'
import { DEFAULT_ROLE_PERMISSIONS } from '../auth/rbac'
import { ApiClientError, apiRequest, clearAuthTokens, getRefreshToken, hasAccessToken, setAccessToken, setRefreshToken } from './apiClient'

export type ApiRoleCode = 'CUSTOMER' | 'STAFF' | 'MANAGER' | 'BUSINESS' | 'ADMIN'
export type ApiUserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_VERIFICATION'
export type ApiFacilityScopeLevel = 'READ' | 'OPERATE' | 'MANAGE'

export interface ApiActor {
  id: string
  email: string
  fullName: string
  phone: string | null
  permanentAddress: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  avatarUrl: string | null
  status: ApiUserStatus
  roles: ApiRoleCode[]
  facilityScopes: Record<string, ApiFacilityScopeLevel>
  facilityNames?: Record<string, string>
  mustChangePassword: boolean
  permissions: string[]
}

interface ApiAuthResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  sessionId: string
  actor: ApiActor
  refreshToken: string
}

interface ApiEnvelope<T> {
  data: T
}

export interface ApiRegistrationResponse {
  actor: ApiActor
  verificationRequired: boolean
  debugCode: string | null
}

export interface ApiChallengeResponse {
  accepted: boolean
  verificationRequired: boolean
  debugCode: string | null
}

let currentActor: ApiActor | null = null

const rolePriority: ApiRoleCode[] = ['ADMIN', 'BUSINESS', 'MANAGER', 'STAFF', 'CUSTOMER']

export function primaryRole(roles: readonly ApiRoleCode[]): Role {
  const role = rolePriority.find(candidate => roles.includes(candidate)) || 'CUSTOMER'
  return role.toLowerCase() as Role
}

export function actorToUser(actor: ApiActor): User {
  const assignedFacilityIds = Object.keys(actor.facilityScopes)
  const assignedFacilityNames = assignedFacilityIds
    .map(id => actor.facilityNames?.[id])
    .filter((name): name is string => Boolean(name))
  return {
    id: actor.id,
    name: actor.fullName,
    email: actor.email,
    phone: actor.phone || undefined,
    permanentAddress: actor.permanentAddress || undefined,
    emergencyContactName: actor.emergencyContactName || undefined,
    emergencyContactPhone: actor.emergencyContactPhone || undefined,
    avatar: actor.avatarUrl || undefined,
    role: primaryRole(actor.roles),
    facility: assignedFacilityNames.join(', ') || undefined,
    facilityId: assignedFacilityIds[0],
    facilityScopes: actor.facilityScopes,
    facilityNames: actor.facilityNames,
    mustChangePassword: actor.mustChangePassword,
  }
}

function completeApiLogin(response: ApiEnvelope<ApiAuthResponse>, invalidMessage: string): ApiActor {
  if (!response?.data?.accessToken || !response.data.refreshToken || !response.data.actor) {
    throw new Error(invalidMessage)
  }
  setAccessToken(response.data.accessToken)
  setRefreshToken(response.data.refreshToken)
  currentActor = response.data.actor
  return currentActor
}

export async function loginWithApi(email: string, password: string): Promise<ApiActor> {
  clearAuthTokens()
  currentActor = null
  const response = await apiRequest<ApiEnvelope<ApiAuthResponse>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
    timeoutMs: 10_000,
  })
  return completeApiLogin(response, 'Backend trả về dữ liệu đăng nhập không hợp lệ.')
}

export async function loginWithGoogleApi(idToken: string): Promise<ApiActor> {
  clearAuthTokens()
  currentActor = null
  const response = await apiRequest<ApiEnvelope<ApiAuthResponse>>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
    skipAuth: true,
    timeoutMs: 10_000,
  })
  return completeApiLogin(response, 'Backend trả về dữ liệu đăng nhập Google không hợp lệ.')
}

export async function changePasswordWithApi(currentPassword: string, newPassword: string): Promise<ApiActor> {
  const response = await apiRequest<ApiEnvelope<ApiAuthResponse>>('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!response?.data?.accessToken || !response.data.refreshToken || !response.data.actor) {
    throw new Error('Backend trả về dữ liệu đổi mật khẩu không hợp lệ.')
  }
  setAccessToken(response.data.accessToken)
  setRefreshToken(response.data.refreshToken)
  currentActor = response.data.actor
  return currentActor
}

export async function registerWithApi(input: {
  email: string
  password: string
  fullName: string
  phone?: string
  permanentAddress?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
}) {
  const response = await apiRequest<ApiEnvelope<ApiRegistrationResponse>>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  })
  if (!response?.data?.actor) throw new Error('Backend trả về dữ liệu đăng ký không hợp lệ.')
  return response.data
}

export interface ApiSession {
  id: string
  createdIp: string | null
  userAgent: string | null
  createdAt: string
  lastSeenAt: string | null
  expiresAt: string
  revokedAt: string | null
  active: boolean
}

export async function updateCurrentProfileWithApi(input: {
  fullName: string
  phone?: string
  permanentAddress?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  avatarUrl?: string
}): Promise<ApiActor> {
  const response = await apiRequest<ApiEnvelope<ApiActor>>('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  if (!response?.data) throw new Error('Backend trả về dữ liệu hồ sơ không hợp lệ.')
  currentActor = response.data
  window.dispatchEvent(new Event('storagehub:actor-updated'))
  return currentActor
}

export async function listMySessions(): Promise<ApiSession[]> {
  const response = await apiRequest<ApiEnvelope<ApiSession[]>>('/api/auth/sessions')
  if (!response?.data) throw new Error('Backend trả về dữ liệu phiên đăng nhập không hợp lệ.')
  return response.data
}

export async function verifyEmailWithApi(email: string | undefined, codeOrToken: string) {
  const response = await apiRequest<ApiEnvelope<ApiActor>>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ ...(email ? { email } : {}), codeOrToken }),
    skipAuth: true,
  })
  if (!response?.data) throw new Error('Backend trả về dữ liệu xác minh không hợp lệ.')
  return response.data
}

export async function requestPasswordResetWithApi(email: string) {
  const response = await apiRequest<ApiEnvelope<ApiChallengeResponse>>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuth: true,
  })
  if (!response?.data?.accepted) throw new Error('Không thể tạo yêu cầu đặt lại mật khẩu.')
  return response.data
}

export async function resetPasswordWithApi(email: string | undefined, codeOrToken: string, newPassword: string) {
  const response = await apiRequest<ApiEnvelope<{ passwordReset: boolean }>>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, codeOrToken, newPassword }),
    skipAuth: true,
  })
  if (!response?.data?.passwordReset) throw new Error('Không thể đặt lại mật khẩu.')
  return response.data
}

export async function logoutFromApi() {
  if (!hasAccessToken() && !getRefreshToken()) {
    currentActor = null
    return
  }
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' })
  } finally {
    clearAuthTokens()
    currentActor = null
  }
}

export async function refreshApiSession(): Promise<ApiActor> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new ApiClientError('Phiên đăng nhập đã hết hạn.', { code: 'NO_REFRESH_TOKEN' })
  const response = await apiRequest<ApiEnvelope<ApiAuthResponse>>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    skipAuth: true,
  })
  if (!response?.data?.accessToken || !response.data.refreshToken || !response.data.actor) {
    throw new Error('Backend trả về dữ liệu refresh không hợp lệ.')
  }
  setAccessToken(response.data.accessToken)
  setRefreshToken(response.data.refreshToken)
  currentActor = response.data.actor
  return currentActor
}

export function getAuthenticatedActor() {
  return currentActor
}

export function isApiAuthenticated() {
  return hasAccessToken() && Boolean(currentActor)
}

// Customer navigation uses role capabilities, not the local demo user registry.
// Backend endpoints remain authoritative for ownership and authorization.
export function canApiCustomerNavigate(user: User, permission: PermissionKey): boolean {
  return isApiAuthenticated() && currentActor?.id === user.id
    && currentActor.status === 'ACTIVE' && primaryRole(currentActor.roles) === 'customer'
    && Boolean(DEFAULT_ROLE_PERMISSIONS.customer[permission])
}

export function canApiActor(user: User, permission: PermissionKey): boolean {
  return isApiAuthenticated() && currentActor?.id === user.id && currentActor.status === 'ACTIVE'
    && currentActor.permissions.includes(permission)
}

export async function updateProfileWithApi(input: { fullName: string; phone: string }): Promise<ApiActor> {
  const response = await apiRequest<ApiEnvelope<ApiActor>>('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ ...input, avatarUrl: currentActor?.avatarUrl ?? null }),
  })
  if (!response?.data?.id || response.data.id !== currentActor?.id) {
    throw new Error('Backend trả về dữ liệu hồ sơ không hợp lệ.')
  }
  currentActor = response.data
  return currentActor
}

