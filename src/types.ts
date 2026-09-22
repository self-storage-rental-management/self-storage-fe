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
  role: Role
  avatar?: string
  facility?: string
  /** Stable facility key used for authorization and cross-screen filtering. */
  facilityId?: string
}
