import type { PermissionKey, Role, RolePermissions, RolePermissionsState } from '../types'
import { PERMISSION_KEYS } from '../types'

export interface PermissionDefinition {
  key: PermissionKey
  label: string
  group: string
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'dashboard:read', label: 'Xem tổng quan', group: 'Điều hướng' },
  { key: 'facilities:read', label: 'Xem danh sách cơ sở', group: 'Điều hướng' },
  { key: 'storage_units:read', label: 'Xem gian kho', group: 'Điều hướng' },
  { key: 'reservations:read', label: 'Xem yêu cầu đặt giữ kho', group: 'Điều hướng' },
  { key: 'contracts:read', label: 'Xem hợp đồng', group: 'Điều hướng' },
  { key: 'checkins:read', label: 'Xem lịch check-in', group: 'Điều hướng' },
  { key: 'rentals:read', label: 'Xem hồ sơ thuê', group: 'Điều hướng' },
  { key: 'returns:read', label: 'Xem hồ sơ trả kho', group: 'Điều hướng' },
  { key: 'payments:read', label: 'Xem thanh toán', group: 'Điều hướng' },
  { key: 'policies:read', label: 'Xem chính sách thuê', group: 'Điều hướng' },
  { key: 'support:read', label: 'Xem hỗ trợ', group: 'Điều hướng' },
  { key: 'reports:read', label: 'Xem báo cáo', group: 'Điều hướng' },
  { key: 'audit_logs:read', label: 'Xem nhật ký kiểm toán', group: 'Điều hướng' },
  { key: 'reservations:create', label: 'Tạo yêu cầu đặt giữ kho', group: 'Nghiệp vụ' },
  { key: 'reservations:approve', label: 'Phê duyệt yêu cầu', group: 'Nghiệp vụ' },
  { key: 'storage_units:assign', label: 'Phân kho vật lý', group: 'Nghiệp vụ' },
  { key: 'checkins:process', label: 'Thực hiện check-in và bàn giao', group: 'Nghiệp vụ' },
  { key: 'returns:process', label: 'Nghiệm thu và xử lý trả kho', group: 'Nghiệp vụ' },
  { key: 'rentals:update', label: 'Quản lý hợp đồng và gia hạn', group: 'Nghiệp vụ' },
  { key: 'payments:collect', label: 'Quản lý thu cước và công nợ', group: 'Nghiệp vụ' },
  { key: 'support:update', label: 'Phản hồi yêu cầu hỗ trợ', group: 'Nghiệp vụ' },
  { key: 'inventory:update', label: 'Quản lý tồn kho và bảo trì', group: 'Nghiệp vụ' },
  { key: 'policies:update', label: 'Cập nhật chính sách và biểu phí', group: 'Nghiệp vụ' },
  { key: 'staff_tasks:update', label: 'Điều phối nhiệm vụ nhân viên', group: 'Nghiệp vụ' },
  { key: 'users:manage', label: 'Quản lý tài khoản', group: 'Quản trị' },
  { key: 'roles:manage', label: 'Quản lý bảng quyền', group: 'Quản trị' },
  { key: 'settings:manage', label: 'Cập nhật cài đặt hệ thống', group: 'Quản trị' },
]

const makePermissions = (...enabled: PermissionKey[]): RolePermissions => {
  const enabledSet = new Set(enabled)
  return Object.fromEntries(PERMISSION_KEYS.map(key => [key, enabledSet.has(key)])) as RolePermissions
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsState = {
  customer: makePermissions(
    'dashboard:read', 'facilities:read', 'storage_units:read', 'reservations:create', 'reservations:read',
    'contracts:read', 'rentals:read', 'payments:read', 'support:read'
  ),
  staff: makePermissions(
    'dashboard:read', 'facilities:read', 'storage_units:read', 'reservations:read', 'contracts:read',
    'checkins:read', 'checkins:process', 'rentals:read', 'returns:read', 'returns:process',
    'support:read', 'support:update'
  ),
  manager: makePermissions(
    'dashboard:read', 'facilities:read', 'storage_units:read', 'reservations:read',
    'reservations:approve', 'storage_units:assign', 'contracts:read', 'checkins:read', 'rentals:read',
    'returns:read', 'payments:read', 'payments:collect', 'support:read', 'support:update',
    'inventory:update', 'policies:read', 'staff_tasks:update', 'reports:read'
  ),
  business: makePermissions(
    'dashboard:read', 'facilities:read', 'storage_units:read', 'reservations:read', 'contracts:read',
    'rentals:read', 'payments:read', 'reports:read', 'support:read', 'policies:read', 'policies:update'
  ),
  admin: makePermissions('users:manage', 'roles:manage', 'settings:manage', 'audit_logs:read'),
}

export const normalizeRolePermissions = (value: unknown): RolePermissionsState => {
  const source = value && typeof value === 'object' ? value as Partial<Record<Role, Partial<Record<PermissionKey, unknown>>>> : {}
  const normalized = {} as RolePermissionsState
  for (const role of ['customer', 'staff', 'manager', 'business', 'admin'] as Role[]) {
    normalized[role] = { ...DEFAULT_ROLE_PERMISSIONS[role] }
    const candidate = source[role]
    if (!candidate || typeof candidate !== 'object') continue
    for (const key of PERMISSION_KEYS) {
      if (typeof candidate[key] === 'boolean') normalized[role][key] = candidate[key] as boolean
    }
  }
  // Keep customer access portal-only and protect the internal SoD defaults
  // when reading legacy localStorage data.
  normalized.customer['returns:process'] = false
  normalized.customer['rentals:update'] = false
  normalized.staff['reservations:approve'] = false
  normalized.staff['payments:collect'] = false
  normalized.staff['policies:update'] = false
  normalized.staff['staff_tasks:update'] = false
  normalized.manager['policies:update'] = false
  normalized.manager['policies:read'] = true
  normalized.business['policies:read'] = true
  normalized.business['policies:update'] = true
  normalized.business['settings:manage'] = false
  normalized.business['payments:collect'] = false
  normalized.business['reservations:approve'] = false
  normalized.admin = { ...DEFAULT_ROLE_PERMISSIONS.admin }
  return normalized
}
