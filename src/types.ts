export type Role = 'customer' | 'staff' | 'manager' | 'business' | 'admin'

export const PERMISSION_KEYS = [
  'view_dashboard',
  'view_facilities',
  'view_units',
  'book_storage',
  'view_reservations',
  'approve_reservations',
  'assign_units',
  'view_contracts',
  'view_checkins',
  'perform_checkin',
  'view_rentals',
  'manage_rentals',
  'view_returns',
  'process_returns',
  'view_payments',
  'view_policies',
  'manage_payments',
  'view_support',
  'manage_support',
  'manage_inventory',
  'manage_policies',
  'manage_staff_tasks',
  'view_reports',
  'view_audit_logs',
  'manage_users',
  'manage_roles',
  'manage_settings',
] as const

export type PermissionKey = typeof PERMISSION_KEYS[number]
export type RolePermissions = Record<PermissionKey, boolean>
export type RolePermissionsState = Record<Role, RolePermissions>

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: Role
  avatar?: string
  facility?: string
  /** Stable facility key used for authorization and cross-screen filtering. */
  facilityId?: string
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
