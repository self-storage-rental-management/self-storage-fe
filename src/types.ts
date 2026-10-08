export type Role = 'customer' | 'staff' | 'manager' | 'business' | 'admin'

export const PERMISSION_KEYS = [
  'dashboard:read',
  'facilities:read',
  'storage_units:read',
  'reservations:create',
  'reservations:read',
  'reservations:approve',
  'storage_units:assign',
  'contracts:read',
  'checkins:read',
  'checkins:process',
  'rentals:read',
  'rentals:update',
  'returns:read',
  'returns:process',
  'payments:read',
  'policies:read',
  'payments:collect',
  'support:read',
  'support:update',
  'inventory:update',
  'policies:update',
  'staff_tasks:update',
  'reports:read',
  'audit_logs:read',
  'users:manage',
  'roles:manage',
  'settings:manage',
] as const

export type PermissionKey = typeof PERMISSION_KEYS[number]
export type RolePermissions = Record<PermissionKey, boolean>
export type RolePermissionsState = Record<Role, RolePermissions>

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  permanentAddress?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  role: Role
  avatar?: string
  facility?: string
  /** Stable facility key used for authorization and cross-screen filtering. */
  facilityId?: string
  mustChangePassword?: boolean
  /** Permissions returned by the backend for the current authenticated actor. */
  permissions?: PermissionKey[]
}

export type LoginEventStatus = 'success' | 'failed' | 'logout'

export interface LoginHistoryRecord {
  id: string
  userId?: string
  user: string
  email: string
  role?: Role
  timestamp: string
  ip: string
  location: string
  device: string
  status: LoginEventStatus
  reason?: string
  suspicious?: boolean
}

export type SessionStatus = 'active' | 'signed_out' | 'revoked'

export interface SessionRecord {
  id: string
  userId: string
  userName: string
  email: string
  role: Role
  createdAt: string
  lastSeenAt: string
  ip: string
  location: string
  device: string
  status: SessionStatus
  revokedAt?: string
}

export interface SecurityAlert {
  id: string
  userId?: string
  email: string
  type: 'failed_login_burst' | 'unknown_device'
  severity: 'warning' | 'critical'
  message: string
  createdAt: string
  resolvedAt?: string
}

export interface ProfileChangeRequest {
  id: string
  requesterId: string
  requesterName: string
  requesterEmail: string
  requesterRole: Exclude<Role, 'customer'>
  facility?: string
  requestedFields: string[]
  reason: string
  status: 'pending' | 'resolved'
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
}
