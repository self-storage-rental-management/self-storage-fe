import type { PermissionKey, Role, RolePermissions, RolePermissionsState } from '../types'
import { PERMISSION_KEYS } from '../types'

export interface PermissionDefinition {
  key: PermissionKey
  label: string
  group: string
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'view_dashboard', label: 'Xem tổng quan', group: 'Điều hướng' },
  { key: 'view_facilities', label: 'Xem danh sách cơ sở', group: 'Điều hướng' },
  { key: 'view_units', label: 'Xem gian kho', group: 'Điều hướng' },
  { key: 'view_reservations', label: 'Xem yêu cầu đặt giữ kho', group: 'Điều hướng' },
  { key: 'view_contracts', label: 'Xem hợp đồng', group: 'Điều hướng' },
  { key: 'view_checkins', label: 'Xem lịch check-in', group: 'Điều hướng' },
  { key: 'view_rentals', label: 'Xem hồ sơ thuê', group: 'Điều hướng' },
  { key: 'view_returns', label: 'Xem hồ sơ trả kho', group: 'Điều hướng' },
  { key: 'view_payments', label: 'Xem thanh toán', group: 'Điều hướng' },
  { key: 'view_policies', label: 'Xem chính sách thuê', group: 'Điều hướng' },
  { key: 'view_support', label: 'Xem hỗ trợ', group: 'Điều hướng' },
  { key: 'view_reports', label: 'Xem báo cáo', group: 'Điều hướng' },
  { key: 'view_audit_logs', label: 'Xem nhật ký kiểm toán', group: 'Điều hướng' },
  { key: 'book_storage', label: 'Tạo yêu cầu đặt giữ kho', group: 'Nghiệp vụ' },
  { key: 'approve_reservations', label: 'Phê duyệt yêu cầu', group: 'Nghiệp vụ' },
  { key: 'assign_units', label: 'Phân kho vật lý', group: 'Nghiệp vụ' },
  { key: 'perform_checkin', label: 'Thực hiện check-in và bàn giao', group: 'Nghiệp vụ' },
  { key: 'process_returns', label: 'Nghiệm thu và xử lý trả kho', group: 'Nghiệp vụ' },
  { key: 'manage_rentals', label: 'Quản lý hợp đồng và gia hạn', group: 'Nghiệp vụ' },
  { key: 'manage_payments', label: 'Quản lý thu cước và công nợ', group: 'Nghiệp vụ' },
  { key: 'manage_support', label: 'Phản hồi yêu cầu hỗ trợ', group: 'Nghiệp vụ' },
  { key: 'manage_inventory', label: 'Quản lý tồn kho và bảo trì', group: 'Nghiệp vụ' },
  { key: 'manage_policies', label: 'Cập nhật chính sách và biểu phí', group: 'Nghiệp vụ' },
  { key: 'manage_staff_tasks', label: 'Điều phối nhiệm vụ nhân viên', group: 'Nghiệp vụ' },
  { key: 'manage_users', label: 'Quản lý tài khoản', group: 'Quản trị' },
  { key: 'manage_roles', label: 'Quản lý bảng quyền', group: 'Quản trị' },
  { key: 'manage_settings', label: 'Cập nhật cài đặt hệ thống', group: 'Quản trị' },
]

const makePermissions = (...enabled: PermissionKey[]): RolePermissions => {
  const enabledSet = new Set(enabled)
  return Object.fromEntries(PERMISSION_KEYS.map(key => [key, enabledSet.has(key)])) as RolePermissions
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsState = {
  customer: makePermissions(
    'view_dashboard', 'view_facilities', 'view_units', 'book_storage', 'view_reservations',
    'view_contracts', 'view_rentals', 'manage_rentals', 'view_returns', 'process_returns', 'view_payments', 'view_support'
  ),
  staff: makePermissions(
    'view_dashboard', 'view_facilities', 'view_units', 'view_reservations', 'approve_reservations',
    'view_checkins', 'perform_checkin', 'view_returns', 'process_returns', 'manage_payments', 'view_support', 'manage_support'
  ),
  manager: makePermissions(
    'view_dashboard', 'view_facilities', 'view_units', 'view_reservations', 'approve_reservations',
    'view_contracts', 'view_checkins', 'perform_checkin', 'view_rentals', 'manage_rentals',
    'view_returns', 'process_returns', 'view_payments', 'manage_payments', 'view_support', 'manage_support',
    'manage_inventory', 'manage_policies', 'manage_staff_tasks', 'view_reports'
  ),
  business: makePermissions(
    'view_dashboard', 'view_facilities', 'view_units', 'view_payments', 'view_reports', 'view_support', 'view_policies'
  ),
  admin: makePermissions(...PERMISSION_KEYS),
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
  // Manager chỉ duyệt hồ sơ hàng hóa; gian cụ thể do khách chọn từ đầu.
  normalized.manager.assign_units = false
  return normalized
}
