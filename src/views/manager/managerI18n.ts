export type Language = 'en' | 'vi'

type BilingualLabel = { en: string; vi: string }

const labels = (en: string, vi: string): BilingualLabel => ({ en, vi })

const statusLabels: Record<string, BilingualLabel> = {
  available: labels('Available', 'Còn trống'),
  reserved: labels('Reserved', 'Đã giữ chỗ'),
  occupied: labels('Occupied', 'Đang sử dụng'),
  maintenance: labels('Maintenance', 'Bảo trì'),
  held: labels('Held', 'Đang giữ'),
  assigned: labels('Assigned', 'Đã phân công'),
  active: labels('Active', 'Đang hiệu lực'),
  paid: labels('Paid', 'Đã thanh toán'),
  refunded: labels('Refunded', 'Đã hoàn tiền'),
  overdue: labels('Overdue', 'Quá hạn'),
  pending: labels('Pending', 'Đang chờ'),
  completed: labels('Completed', 'Hoàn tất'),
  cancelled: labels('Cancelled', 'Đã hủy'),
  scheduled: labels('Scheduled', 'Đã lên lịch'),
  open: labels('Open', 'Đang mở'),
  in_progress: labels('In progress', 'Đang thực hiện'),
  'in-progress': labels('In progress', 'Đang thực hiện'),
  resolved: labels('Resolved', 'Đã xử lý'),
  'on-duty': labels('On duty', 'Đang trực'),
  no_show: labels('No-show', 'Không đến'),
  awaiting_deposit: labels('Awaiting deposit', 'Chờ thanh toán tiền cọc'),
  contract_signed: labels('Contract signed', 'Đã ký hợp đồng'),
  fully_paid: labels('Fully paid', 'Đã thanh toán đủ'),
  unit_assigned: labels('Unit assigned', 'Đã phân gian kho'),
  review_required: labels('Review required', 'Cần duyệt hồ sơ'),
  confirmed: labels('Confirmed', 'Đã xác nhận'),
  expired: labels('Expired', 'Đã hết hạn'),
  draft: labels('Draft', 'Bản nháp'),
  checked_in: labels('Checked in', 'Đã nhận kho'),
  return_requested: labels('Return requested', 'Đã yêu cầu trả kho'),
  return_inspection: labels('Return inspection', 'Đang nghiệm thu trả kho'),
  closing: labels('Closing', 'Đang tất toán'),
  requested: labels('Requested', 'Đã yêu cầu'),
  inspected: labels('Inspected', 'Đã nghiệm thu'),
  disputed: labels('Disputed', 'Đang khiếu nại'),
  refund_pending: labels('Refund pending', 'Chờ hoàn tiền'),
  payment_due: labels('Payment due', 'Chờ thanh toán'),
  awaiting_customer_confirmation: labels('Awaiting customer confirmation', 'Chờ khách xác nhận'),
  CREATED: labels('Created', 'Đã tạo'),
  DEPOSIT_PAID: labels('Deposit paid', 'Đã thanh toán cọc'),
  UNIT_RESERVED: labels('Unit reserved', 'Đã giữ gian kho'),
  READY_FOR_CHECKIN: labels('Ready for move-in', 'Sẵn sàng nhận kho'),
  COMPLETED: labels('Completed', 'Hoàn tất'),
  CANCELLED: labels('Cancelled', 'Đã hủy'),
  EXPIRED: labels('Expired', 'Hết hạn'),
  PENDING: labels('Pending', 'Đang chờ'),
  PAID: labels('Paid', 'Đã thanh toán'),
  ACTIVE: labels('Active', 'Đang hoạt động'),
  SUSPENDED: labels('Suspended', 'Đã khóa'),
  REVOKED: labels('Revoked', 'Đã thu hồi'),
  NOT_REQUIRED: labels('Not required', 'Không cần duyệt'),
  APPROVED: labels('Approved', 'Đã duyệt'),
  REJECTED: labels('Rejected', 'Đã từ chối'),
  approved: labels('Approved', 'Đã duyệt'),
  rejected: labels('Rejected', 'Đã từ chối'),
  deposit_paid: labels('Deposit paid', 'Đã thanh toán cọc'),
  appointment_scheduled: labels('Appointment scheduled', 'Đã hẹn lịch'),
  payment_processing: labels('Payment processing', 'Đang xử lý thanh toán'),
  payment_failed: labels('Payment failed', 'Thanh toán thất bại'),
  payment_expired: labels('Payment expired', 'Thanh toán hết hạn'),
  awaiting_email: labels('Awaiting email verification', 'Chờ xác minh thư điện tử'),
  awaiting_review: labels('Awaiting review', 'Chờ duyệt hồ sơ'),
  awaiting_payment: labels('Awaiting deposit payment', 'Chờ thanh toán cọc')
}

const unitTypes: Record<string, BilingualLabel> = {
  small: labels('Small', 'Nhỏ'),
  medium: labels('Medium', 'Vừa'),
  large: labels('Large', 'Lớn'),
  'extra large': labels('Extra Large', 'Rất lớn'),
  xlarge: labels('Extra Large', 'Rất lớn')
}

const paymentTypes: Record<string, BilingualLabel> = {
  RESERVATION_DEPOSIT: labels('Reservation deposit', 'Cọc giữ chỗ'),
  INITIAL_RENT: labels('Initial rent', 'Tiền thuê ban đầu'),
  RENT: labels('Rent', 'Tiền thuê định kỳ'),
  RENTAL_PAYMENT: labels('Rental payment', 'Thanh toán tiền thuê'),
  RENEWAL: labels('Renewal', 'Gia hạn'),
  DAMAGE_FEE: labels('Damage fee', 'Phí hư hỏng'),
  REFUND: labels('Refund', 'Hoàn tiền'),
  RETURN_BALANCE: labels('Return balance', 'Thanh toán khi trả kho')
}

const methods: Record<string, BilingualLabel> = {
  BANK_TRANSFER: labels('Bank transfer', 'Chuyển khoản'),
  CASH: labels('Cash', 'Tiền mặt'),
  ONLINE_GATEWAY: labels('Online gateway', 'Cổng thanh toán trực tuyến')
}

const taskTypes: Record<string, BilingualLabel> = {
  general: labels('General', 'Chung'),
  checkin: labels('Move-in', 'Nhận kho'),
  return: labels('Move-out', 'Trả kho'),
  maintenance: labels('Maintenance', 'Bảo trì'),
  support: labels('Support', 'Hỗ trợ')
}

const priorities: Record<string, BilingualLabel> = {
  low: labels('Low', 'Thấp'),
  medium: labels('Medium', 'Trung bình'),
  high: labels('High', 'Cao')
}

const activities: Record<string, BilingualLabel> = {
  RESERVATION_CREATED: labels('Reservation created', 'Đã tạo đơn đặt chỗ'),
  RESERVATION_APPROVED: labels('Reservation approved', 'Đã duyệt đơn đặt chỗ'),
  RESERVATION_CANCELLED: labels('Reservation cancelled', 'Đã hủy đơn đặt chỗ'),
  UNIT_ASSIGNED: labels('Unit selected', 'Gian kho đã được xác định'),
  UNIT_MAINTENANCE_STARTED: labels('Maintenance started', 'Đã đưa gian kho vào bảo trì'),
  UNIT_RELEASED: labels('Unit released', 'Đã mở lại gian kho'),
  PAPER_CONTRACT_SIGNED: labels('Paper contract signed', 'Đã ký hợp đồng giấy'),
  INITIAL_BALANCE_PAID: labels('Initial balance paid', 'Đã thanh toán số dư ban đầu'),
  CHECKIN_COMPLETED: labels('Move-in completed', 'Đã hoàn tất nhận kho'),
  UNIT_RECEIPT_CONFIRMED: labels('Unit receipt confirmed', 'Đã xác nhận nhận gian kho'),
  RENEWAL_REQUESTED: labels('Renewal requested', 'Đã yêu cầu gia hạn'),
  RENEWAL_REQUEST_UPDATED: labels('Renewal request updated', 'Đã cập nhật yêu cầu gia hạn'),
  RENEWAL_REQUEST_CANCELLED: labels('Renewal request cancelled', 'Đã hủy yêu cầu gia hạn'),
  RENEWAL_APPROVED: labels('Renewal approved', 'Đã duyệt gia hạn'),
  RENEWAL_REJECTED: labels('Renewal rejected', 'Đã từ chối gia hạn'),
  RENEWAL_DEPOSIT_PAID: labels('Renewal deposit paid', 'Đã thanh toán cọc gia hạn'),
  RENEWAL_COMPLETED_AT_FACILITY: labels('Renewal completed at facility', 'Đã hoàn tất gia hạn tại cơ sở'),
  RETURN_INSPECTION_COMPLETED: labels('Move-out inspection completed', 'Đã nghiệm thu trả kho'),
  RETURN_SETTLEMENT_CONFIRMED: labels('Settlement confirmed', 'Đã xác nhận quyết toán'),
  RETURN_SETTLEMENT_DISPUTED: labels('Settlement disputed', 'Đã khiếu nại quyết toán'),
  RETURN_DISPUTE_REVIEWED: labels('Dispute reviewed', 'Đã xử lý khiếu nại'),
  RETURN_BALANCE_PAID: labels('Return balance paid', 'Đã thanh toán số dư trả kho'),
  RETURN_REFUND_COMPLETED: labels('Refund completed', 'Đã hoàn tiền cọc'),
  RENT_PAYMENT_RECORDED: labels('Rental payment recorded', 'Đã ghi nhận tiền thuê'),
  LATE_FEE_APPLIED: labels('Late fee applied', 'Đã áp dụng phí trễ'),
  LATE_FEE_WAIVED: labels('Late fee waived', 'Đã miễn phí trễ'),
  RENTAL_ACCESS_SUSPENDED: labels('Rental access suspended', 'Đã khóa quyền truy cập'),
  RENTAL_ACCESS_RESTORED: labels('Rental access restored', 'Đã mở lại quyền truy cập'),
  DELINQUENCY_REMINDER_SENT: labels('Delinquency reminder sent', 'Đã gửi nhắc nợ'),
  FACILITY_TASK_CREATED: labels('Facility task created', 'Đã tạo nhiệm vụ cơ sở'),
  FACILITY_TASK_UPDATED: labels('Facility task updated', 'Đã cập nhật nhiệm vụ cơ sở'),
  MAINTENANCE_COMPLETED: labels('Maintenance completed', 'Đã hoàn tất bảo trì'),
  POLICY_UPDATE: labels('Policy updated', 'Đã cập nhật chính sách'),
  GOODS_REVIEW_REJECTED: labels('Goods review rejected', 'Đã từ chối hồ sơ hàng hóa'),
  ROLE_PERMISSIONS_UPDATED: labels('Role permissions updated', 'Đã cập nhật quyền vai trò'),
  CUSTOMER_PROFILE_UPDATED: labels('Customer profile updated', 'Đã cập nhật hồ sơ khách hàng'),
  PROFILE_CHANGE_REQUESTED: labels('Profile change requested', 'Đã yêu cầu thay đổi hồ sơ'),
  CUSTOMER_PASSWORD_RESET_REQUESTED: labels('Customer password reset requested', 'Đã yêu cầu đặt lại mật khẩu khách hàng'),
  PASSWORD_RESET_REQUESTED: labels('Password reset requested', 'Đã yêu cầu đặt lại mật khẩu'),
  INTERNAL_ACCOUNT_UPDATED: labels('Internal account updated', 'Đã cập nhật tài khoản nội bộ'),
  ACCOUNT_DELETED: labels('Account deleted', 'Đã xóa tài khoản'),
  CUSTOMER_ACCOUNT_DELETED: labels('Customer account deleted', 'Đã xóa tài khoản khách hàng'),
  SESSION_REVOKED: labels('Session revoked', 'Đã thu hồi phiên đăng nhập'),
  ALL_SESSIONS_REVOKED: labels('All sessions revoked', 'Đã thu hồi toàn bộ phiên đăng nhập')
}

const entities: Record<string, BilingualLabel> = {
  hold: labels('Reservation', 'Đơn đặt chỗ'),
  unit: labels('Unit', 'Gian kho'),
  rental: labels('Rental', 'Hợp đồng thuê'),
  payment: labels('Payment', 'Thanh toán'),
  return: labels('Return', 'Hồ sơ trả kho'),
  checkin: labels('Move-in', 'Hồ sơ nhận kho'),
  task: labels('Task', 'Nhiệm vụ'),
  policy: labels('Policy', 'Chính sách'),
  user: labels('User', 'Người dùng'),
  system: labels('System', 'Hệ thống')
}

function labelFrom(map: Record<string, BilingualLabel>, value: string, lang: Language) {
  if (!value) return lang === 'vi' ? 'Chưa ghi nhận' : 'Not recorded'
  return map[value]?.[lang] || (lang === 'vi' ? 'Chưa phân loại' : value.replace(/_/g, ' '))
}

export const managerStatusLabel = (value: string, lang: Language) => labelFrom(statusLabels, value, lang)

export const managerUnitTypeLabel = (value: string, lang: Language) => {
  const normalized = value.toLowerCase()
  if (lang === 'en') return unitTypes[normalized]?.en || value
  if (normalized.includes('extra large') || normalized.includes('xlarge')) return 'Gian kho rất lớn'
  if (normalized.includes('large')) return 'Gian kho lớn'
  if (normalized.includes('medium')) return 'Gian kho vừa'
  if (normalized.includes('small')) return 'Gian kho nhỏ'
  return 'Loại gian kho khác'
}

export const managerPaymentTypeLabel = (value: string, lang: Language) => labelFrom(paymentTypes, value, lang)
export const managerPaymentMethodLabel = (value: string, lang: Language) => labelFrom(methods, value, lang)
export const managerTaskTypeLabel = (value: string, lang: Language) => labelFrom(taskTypes, value, lang)
export const managerPriorityLabel = (value: string, lang: Language) => labelFrom(priorities, value, lang)
export const managerActivityLabel = (value: string, lang: Language) => labelFrom(activities, value, lang)
export const managerEntityLabel = (value: string, lang: Language) => labelFrom(entities, value, lang)

export const managerDateLabel = (value: string | undefined, lang: Language, includeTime = false) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return includeTime
    ? parsed.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
    : parsed.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')
}

export const managerTimeLabel = (value: string | undefined, lang: Language) => {
  if (!value) return '—'
  const parsed = new Date(`1970-01-01 ${value}`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: lang !== 'vi'
  })
}
