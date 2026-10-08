import { apiRequest, ApiClientError } from './apiClient'
import type { ApiFacilityScopeLevel, ApiRoleCode, ApiUserStatus } from './authApi'

export interface AdminApiUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: ApiUserStatus
  roles: ApiRoleCode[]
  facilityScopes: Record<string, ApiFacilityScopeLevel>
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminApiFacility {
  id: string
  code: string
  name: string
  status: string
}

export interface AdminApiRole {
  code: ApiRoleCode
  name: string
  parentRole: ApiRoleCode | null
  permissions: string[]
  directPermissions: string[]
  inheritedPermissions: string[]
  userCount: number
}

export interface AdminApiLoginHistory {
  id: string
  userId: string | null
  fullName: string | null
  email: string
  roles: ApiRoleCode[]
  success: boolean
  ipAddress: string | null
  userAgent: string | null
  failureReason: string | null
  occurredAt: string
}

export interface AdminApiSession {
  id: string
  userId: string
  fullName: string
  email: string
  createdIp: string | null
  userAgent: string | null
  createdAt: string
  lastSeenAt: string | null
  expiresAt: string
  revokedAt: string | null
  active: boolean
}

export interface AdminApiActivityLog {
  id: string
  actorId: string | null
  actorName: string
  actorEmail: string | null
  actorRoles: ApiRoleCode[]
  facilityId: string | null
  action: string
  entityType: string
  entityId: string
  beforeState: string | null
  afterState: string | null
  correlationId: string
  createdAt: string
}

export interface AdminApiSetting {
  id: string
  group: string
  description: string | null
  label: string
  type: 'text' | 'select' | 'toggle' | 'number'
  value: string | number | boolean
  options: string[]
  updatedAt: string
}

export interface AdminUserPage {
  data: AdminApiUser[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface AdminUserListParams {
  page: number
  size: number
  search?: string
  role?: ApiRoleCode | 'all'
  status?: ApiUserStatus | 'all'
  facilityId?: string
}

interface ApiEnvelope<T> {
  data: T
}

function readData<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Backend trả về dữ liệu không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as { data: T }).data
}

function readPage<T>(payload: unknown): { data: T[]; pagination: AdminUserPage['pagination'] } {
  const value = payload as { data?: unknown; pagination?: unknown } | null
  const pagination = value?.pagination as Partial<AdminUserPage['pagination']> | null
  if (!value || !Array.isArray(value.data)
    || !pagination
    || typeof pagination.page !== 'number'
    || typeof pagination.pageSize !== 'number'
    || typeof pagination.totalItems !== 'number'
    || typeof pagination.totalPages !== 'number') {
    throw new ApiClientError('Backend trả về danh sách không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return {
    data: value.data as T[],
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: pagination.totalItems,
      totalPages: pagination.totalPages,
    },
  }
}

function queryString(params: AdminUserListParams) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) })
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.role && params.role !== 'all') query.set('role', params.role)
  if (params.status && params.status !== 'all') query.set('status', params.status)
  if (params.facilityId && params.facilityId !== 'all') query.set('facilityId', params.facilityId)
  return query.toString()
}

export async function listAdminUsers(params: AdminUserListParams) {
  const response = await apiRequest<unknown>(`/api/admin/users?${queryString(params)}`)
  return readPage<AdminApiUser>(response)
}

export async function listAdminRoles() {
  const response = await apiRequest<ApiEnvelope<AdminApiRole[]>>('/api/admin/roles')
  return readData<AdminApiRole[]>(response)
}

export async function listAdminLoginHistory(params: { page: number; size: number; search?: string; success?: boolean; userId?: string }) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) })
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.success !== undefined) query.set('success', String(params.success))
  if (params.userId && params.userId !== 'all') query.set('userId', params.userId)
  const response = await apiRequest<unknown>(`/api/admin/login-history?${query.toString()}`)
  return readPage<AdminApiLoginHistory>(response)
}

export async function listAdminSessions(params: { page: number; size: number; userId?: string }) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) })
  if (params.userId && params.userId !== 'all') query.set('userId', params.userId)
  const response = await apiRequest<unknown>(`/api/admin/sessions?${query.toString()}`)
  return readPage<AdminApiSession>(response)
}

export async function revokeAdminSession(id: string) {
  const response = await apiRequest<ApiEnvelope<AdminApiSession>>(`/api/admin/sessions/${encodeURIComponent(id)}/revoke`, { method: 'PATCH' })
  return readData<AdminApiSession>(response)
}

export async function listAdminActivityLogs(params: { page: number; size: number; search?: string; entityType?: string; actorId?: string; from?: string; to?: string }) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) })
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.entityType && params.entityType !== 'all') query.set('entityType', params.entityType)
  if (params.actorId && params.actorId !== 'all') query.set('actorId', params.actorId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  const response = await apiRequest<unknown>(`/api/admin/activity-logs?${query.toString()}`)
  return readPage<AdminApiActivityLog>(response)
}

export async function listAdminSettings() {
  const response = await apiRequest<ApiEnvelope<AdminApiSetting[]>>('/api/admin/settings')
  return readData<AdminApiSetting[]>(response)
}

export async function updateAdminSetting(key: string, value: string | number | boolean) {
  const response = await apiRequest<ApiEnvelope<AdminApiSetting>>(`/api/admin/settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  })
  return readData<AdminApiSetting>(response)
}

export async function updateAdminRolePermissions(role: ApiRoleCode, permissions: string[]) {
  const response = await apiRequest<ApiEnvelope<AdminApiRole>>(`/api/admin/roles/${role}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  })
  return readData<AdminApiRole>(response)
}

export async function getAdminUser(id: string) {
  const response = await apiRequest<ApiEnvelope<AdminApiUser>>(`/api/admin/users/${encodeURIComponent(id)}`)
  return readData<AdminApiUser>(response)
}

export async function createAdminUser(input: {
  email: string
  password: string
  fullName: string
  phone?: string
  roles: ApiRoleCode[]
  facilityScopes: Record<string, ApiFacilityScopeLevel>
}) {
  const response = await apiRequest<ApiEnvelope<AdminApiUser>>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return readData<AdminApiUser>(response)
}

export async function patchAdminUser(id: string, input: { email?: string; fullName?: string; phone?: string }) {
  const response = await apiRequest<ApiEnvelope<AdminApiUser>>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return readData<AdminApiUser>(response)
}

export async function updateAdminUserRoles(id: string, roles: ApiRoleCode[]) {
  const response = await apiRequest<ApiEnvelope<AdminApiUser>>(`/api/admin/users/${encodeURIComponent(id)}/roles`, {
    method: 'PATCH',
    body: JSON.stringify({ roles }),
  })
  return readData<AdminApiUser>(response)
}

export async function updateAdminUserFacilities(id: string, facilityScopes: Record<string, ApiFacilityScopeLevel>) {
  const response = await apiRequest<ApiEnvelope<AdminApiUser>>(`/api/admin/users/${encodeURIComponent(id)}/facilities`, {
    method: 'PATCH',
    body: JSON.stringify({ facilityScopes }),
  })
  return readData<AdminApiUser>(response)
}

export async function updateAdminUserStatus(id: string, status: ApiUserStatus) {
  const response = await apiRequest<ApiEnvelope<AdminApiUser>>(`/api/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return readData<AdminApiUser>(response)
}

export async function resetAdminUserPassword(id: string, temporaryPassword: string) {
  const response = await apiRequest<ApiEnvelope<AdminApiUser>>(`/api/admin/users/${encodeURIComponent(id)}/password-reset`, {
    method: 'POST',
    body: JSON.stringify({ temporaryPassword }),
  })
  return readData<AdminApiUser>(response)
}

export async function listAdminFacilities() {
  const response = await apiRequest<unknown>('/api/facilities?page=0&size=100')
  return readPage<AdminApiFacility>(response)
}

