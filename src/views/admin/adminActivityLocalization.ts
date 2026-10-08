const ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Đăng ký tài khoản',
  USER_REGISTERED_GOOGLE: 'Đăng ký tài khoản bằng Google',
  EMAIL_VERIFICATION_SENT: 'Gửi email xác minh',
  EMAIL_VERIFICATION_RESENT: 'Gửi lại email xác minh',
  EMAIL_VERIFIED: 'Xác minh email',
  PASSWORD_RESET: 'Đặt lại mật khẩu',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  USER_PROFILE_UPDATED: 'Cập nhật hồ sơ',
  INVALID_CREDENTIALS: 'Thông tin đăng nhập không hợp lệ',
  SESSION_CREATED: 'Tạo phiên đăng nhập',
  SESSION_REFRESHED: 'Gia hạn phiên đăng nhập',
  SESSION_REVOKED: 'Thu hồi phiên đăng nhập',
  ADMIN_SESSION_REVOKED: 'Quản trị viên thu hồi phiên',
  ADMIN_USER_CREATED: 'Tạo tài khoản người dùng',
  ADMIN_USER_UPDATED: 'Cập nhật tài khoản người dùng',
  ADMIN_USER_ROLES_UPDATED: 'Cập nhật vai trò tài khoản',
  ADMIN_USER_FACILITY_SCOPES_UPDATED: 'Cập nhật phạm vi cơ sở',
  ADMIN_USER_STATUS_CHANGED: 'Cập nhật trạng thái tài khoản',
  ADMIN_USER_PASSWORD_RESET: 'Đặt lại mật khẩu tài khoản',
  ADMIN_ROLE_PERMISSIONS_UPDATED: 'Cập nhật quyền vai trò',
  ADMIN_SETTING_UPDATED: 'Cập nhật cấu hình hệ thống',
  UNLOCK_ACCOUNT: 'Mở khóa tài khoản',
  SECURITY_ALERT_EMAIL_SENT: 'Gửi cảnh báo bảo mật',
  ACCOUNT_CREATED_EMAIL_SENT: 'Gửi email tạo tài khoản',
  ACCOUNT_CHANGED_EMAIL_SENT: 'Gửi email thay đổi tài khoản',
  ACCOUNT_PASSWORD_RESET_EMAIL_SENT: 'Gửi email đặt lại mật khẩu',
  NEW_LOGIN_EMAIL_SENT: 'Gửi thông báo đăng nhập mới',
  PASSWORD_RESET_EMAIL_SENT: 'Gửi email đặt lại mật khẩu',
  RESERVATION_CREATED: 'Tạo yêu cầu đặt kho',
  RESERVATION_CANCELLED: 'Hủy yêu cầu đặt kho',
  RESERVATION_EXPIRED: 'Yêu cầu đặt kho hết hạn',
  STORAGE_UNIT_STATUS_UPDATED: 'Cập nhật trạng thái gian kho',
  FILE_UPLOADED: 'Tải tệp lên',
  BUSINESS_CONFIG_UPDATED: 'Cập nhật cấu hình kinh doanh',
  BOOKING_CONFIRMATION_ISSUED: 'Phát hành xác nhận đặt kho',
  RESERVATION_EMAIL_VERIFIED: 'Xác minh email đặt kho',
  RESERVATION_PAYMENT_GRACE_STARTED: 'Bắt đầu thời gian gia hạn thanh toán',
  RESERVATION_GOODS_REVIEWED: 'Duyệt hàng hóa đặt kho',
  RESERVATION_UNIT_RELEASED: 'Giải phóng gian kho đặt trước',
  CUSTOMER_RETURN_REQUESTED: 'Khách hàng yêu cầu trả kho',
  RETURN_INSPECTED: 'Kiểm tra trả kho',
  RETURN_SETTLEMENT_CONFIRMED: 'Xác nhận quyết toán trả kho',
  RETURN_SETTLEMENT_DISPUTED: 'Ghi nhận tranh chấp quyết toán',
  RETURN_SETTLEMENT_PAID: 'Hoàn tất thanh toán quyết toán',
  RETURN_REFUND_COMPLETED: 'Hoàn tất hoàn tiền',
  MAINTENANCE_TASK_CREATED: 'Tạo nhiệm vụ bảo trì',
  MAINTENANCE_TASK_ASSIGNED: 'Phân công nhiệm vụ bảo trì',
  MAINTENANCE_TASK_STARTED: 'Bắt đầu nhiệm vụ bảo trì',
  MAINTENANCE_TASK_COMPLETED: 'Hoàn tất nhiệm vụ bảo trì',
  MAINTENANCE_TASK_CANCELLED: 'Hủy nhiệm vụ bảo trì',
  PAYMENT_COMPLAINT_SUBMITTED: 'Gửi khiếu nại thanh toán',
  PAYMENT_COMPLAINT_WITHDRAWN: 'Rút khiếu nại thanh toán',
  PAYMENT_COMPLAINT_OVERDUE: 'Khiếu nại thanh toán quá hạn',
  SIMULATED_PAYMENT_PROCESSED: 'Ghi nhận thanh toán mô phỏng',
}

const ENTITY_LABELS: Record<string, string> = {
  User: 'Tài khoản',
  Session: 'Phiên đăng nhập',
  Role: 'Vai trò',
  SystemSetting: 'Cấu hình hệ thống',
  Facility: 'Cơ sở kho',
  UnitType: 'Loại kho',
  StorageUnit: 'Gian kho',
  Reservation: 'Yêu cầu đặt kho',
  Rental: 'Hợp đồng thuê',
  Payment: 'Thanh toán',
  SupportTicket: 'Yêu cầu hỗ trợ',
  FileAsset: 'Tệp đính kèm',
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  MANAGER: 'Quản lý',
  BUSINESS: 'Kinh doanh',
  ADMIN: 'Quản trị viên',
}

export function activityActionLabel(action: string) {
  return ACTION_LABELS[action] ?? 'Thực hiện thao tác nghiệp vụ'
}

export function activityEntityLabel(entityType: string) {
  return ENTITY_LABELS[entityType] ?? entityType
}

export function activityRoleLabel(role: string) {
  return ROLE_LABELS[role] ?? role
}

export function activityPermissionLabel(permission: string, fallback: string) {
  return fallback || permission
}
