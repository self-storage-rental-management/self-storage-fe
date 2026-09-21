import type { Language } from '../../i18n/LanguageContext'

const statusLabels: Record<string, { en: string; vi: string }> = {
  available: { en: 'Available', vi: 'Khả dụng' },
  reserved: { en: 'Reserved', vi: 'Đã giữ chỗ' },
  occupied: { en: 'Occupied', vi: 'Đang sử dụng' },
  maintenance: { en: 'Maintenance', vi: 'Bảo trì' },
  held: { en: 'Held', vi: 'Đang giữ' },
  assigned: { en: 'Assigned', vi: 'Đã phân công' },
  active: { en: 'Active', vi: 'Đang hiệu lực' },
  paid: { en: 'Paid', vi: 'Đã thanh toán' },
  overdue: { en: 'Overdue', vi: 'Quá hạn' },
  pending: { en: 'Pending', vi: 'Đang chờ' },
  completed: { en: 'Completed', vi: 'Hoàn tất' },
  cancelled: { en: 'Cancelled', vi: 'Đã hủy' },
  scheduled: { en: 'Scheduled', vi: 'Đã lên lịch' },
  open: { en: 'Open', vi: 'Đang mở' },
  in_progress: { en: 'In progress', vi: 'Đang thực hiện' },
  return_requested: { en: 'Return requested', vi: 'Đã yêu cầu trả kho' },
  return_inspection: { en: 'Return inspection', vi: 'Đang nghiệm thu trả kho' },
  closing: { en: 'Closing', vi: 'Đang tất toán' },
  requested: { en: 'Requested', vi: 'Đã yêu cầu' },
  inspected: { en: 'Inspected', vi: 'Đã nghiệm thu' },
  disputed: { en: 'Disputed', vi: 'Đang khiếu nại' },
  refund_pending: { en: 'Refund pending', vi: 'Chờ hoàn tiền' },
  payment_due: { en: 'Payment due', vi: 'Chờ thanh toán' },
  awaiting_customer_confirmation: { en: 'Awaiting customer confirmation', vi: 'Chờ khách xác nhận' },
  CREATED: { en: 'Created', vi: 'Đã tạo' },
  DEPOSIT_PAID: { en: 'Deposit paid', vi: 'Đã thanh toán cọc' },
  UNIT_RESERVED: { en: 'Unit reserved', vi: 'Đã phân gian kho' },
  READY_FOR_CHECKIN: { en: 'Ready for move-in', vi: 'Sẵn sàng nhận kho' },
  COMPLETED: { en: 'Completed', vi: 'Hoàn tất' },
  CANCELLED: { en: 'Cancelled', vi: 'Đã hủy' },
  EXPIRED: { en: 'Expired', vi: 'Hết hạn' },
  PENDING: { en: 'Pending', vi: 'Đang chờ' },
  PAID: { en: 'Paid', vi: 'Đã thanh toán' },
  ACTIVE: { en: 'Active', vi: 'Đang hoạt động' },
  SUSPENDED: { en: 'Suspended', vi: 'Đã khóa' },
  REVOKED: { en: 'Revoked', vi: 'Đã thu hồi' },
  approved: { en: 'Approved', vi: 'Đã duyệt' },
  rejected: { en: 'Rejected', vi: 'Đã từ chối' },
  deposit_paid: { en: 'Deposit paid', vi: 'Đã thanh toán cọc' },
  appointment_scheduled: { en: 'Appointment scheduled', vi: 'Đã hẹn lịch' },
  payment_processing: { en: 'Payment processing', vi: 'Đang xử lý thanh toán' },
  payment_failed: { en: 'Payment failed', vi: 'Thanh toán thất bại' },
  payment_expired: { en: 'Payment expired', vi: 'Thanh toán hết hạn' }
}

const unitTypes: Record<string, { en: string; vi: string }> = {
  small: { en: 'Small', vi: 'Nhỏ' },
  medium: { en: 'Medium', vi: 'Vừa' },
  large: { en: 'Large', vi: 'Lớn' },
  'extra large': { en: 'Extra Large', vi: 'Rất lớn' },
  xlarge: { en: 'Extra Large', vi: 'Rất lớn' }
}

const paymentTypes: Record<string, { en: string; vi: string }> = {
  RESERVATION_DEPOSIT: { en: 'Reservation deposit', vi: 'Cọc giữ chỗ' },
  INITIAL_RENT: { en: 'Initial rent', vi: 'Tiền thuê ban đầu' },
  RENTAL_PAYMENT: { en: 'Rental payment', vi: 'Thanh toán tiền thuê' },
  RENEWAL: { en: 'Renewal', vi: 'Gia hạn' },
  REFUND: { en: 'Refund', vi: 'Hoàn tiền' },
  RETURN_BALANCE: { en: 'Return balance', vi: 'Thanh toán khi trả kho' }
}

const methods: Record<string, { en: string; vi: string }> = {
  BANK_TRANSFER: { en: 'Bank transfer', vi: 'Chuyển khoản' },
  CASH: { en: 'Cash', vi: 'Tiền mặt' },
  ONLINE_GATEWAY: { en: 'Online gateway', vi: 'Cổng thanh toán trực tuyến' }
}

const taskTypes: Record<string, { en: string; vi: string }> = {
  general: { en: 'General', vi: 'Chung' },
  checkin: { en: 'Move-in', vi: 'Nhận kho' },
  return: { en: 'Move-out', vi: 'Trả kho' },
  maintenance: { en: 'Maintenance', vi: 'Bảo trì' },
  support: { en: 'Support', vi: 'Hỗ trợ' }
}

const priorities: Record<string, { en: string; vi: string }> = {
  low: { en: 'Low', vi: 'Thấp' },
  medium: { en: 'Medium', vi: 'Trung bình' },
  high: { en: 'High', vi: 'Cao' }
}

const activities: Record<string, { en: string; vi: string }> = {
  RESERVATION_CREATED: { en: 'Reservation created', vi: 'Đã tạo đơn đặt chỗ' },
  RESERVATION_APPROVED: { en: 'Reservation approved', vi: 'Đã duyệt đơn đặt chỗ' },
  RESERVATION_CANCELLED: { en: 'Reservation cancelled', vi: 'Đã hủy đơn đặt chỗ' },
  UNIT_ASSIGNED: { en: 'Unit assigned', vi: 'Đã phân gian kho' },
  UNIT_MAINTENANCE_STARTED: { en: 'Maintenance started', vi: 'Đã đưa gian kho vào bảo trì' },
  UNIT_RELEASED: { en: 'Unit released', vi: 'Đã mở lại gian kho' },
  PAPER_CONTRACT_SIGNED: { en: 'Paper contract signed', vi: 'Đã ký hợp đồng giấy' },
  INITIAL_BALANCE_PAID: { en: 'Initial balance paid', vi: 'Đã thanh toán số dư ban đầu' },
  CHECKIN_COMPLETED: { en: 'Move-in completed', vi: 'Đã hoàn tất nhận kho' },
  UNIT_RECEIPT_CONFIRMED: { en: 'Unit receipt confirmed', vi: 'Đã xác nhận nhận gian kho' },
  RENEWAL_REQUESTED: { en: 'Renewal requested', vi: 'Đã yêu cầu gia hạn' },
  RENEWAL_REQUEST_UPDATED: { en: 'Renewal request updated', vi: 'Đã cập nhật yêu cầu gia hạn' },
  RENEWAL_REQUEST_CANCELLED: { en: 'Renewal request cancelled', vi: 'Đã hủy yêu cầu gia hạn' },
  RENEWAL_APPROVED: { en: 'Renewal approved', vi: 'Đã duyệt gia hạn' },
  RENEWAL_REJECTED: { en: 'Renewal rejected', vi: 'Đã từ chối gia hạn' },
  RENEWAL_DEPOSIT_PAID: { en: 'Renewal deposit paid', vi: 'Đã thanh toán cọc gia hạn' },
  RENEWAL_COMPLETED_AT_FACILITY: { en: 'Renewal completed at facility', vi: 'Đã hoàn tất gia hạn tại cơ sở' },
  RETURN_INSPECTION_COMPLETED: { en: 'Move-out inspection completed', vi: 'Đã nghiệm thu trả kho' },
  RETURN_SETTLEMENT_CONFIRMED: { en: 'Settlement confirmed', vi: 'Đã xác nhận quyết toán' },
  RETURN_SETTLEMENT_DISPUTED: { en: 'Settlement disputed', vi: 'Đã khiếu nại quyết toán' },
  RETURN_DISPUTE_REVIEWED: { en: 'Dispute reviewed', vi: 'Đã xử lý khiếu nại' },
  RETURN_BALANCE_PAID: { en: 'Return balance paid', vi: 'Đã thanh toán số dư trả kho' },
  RETURN_REFUND_COMPLETED: { en: 'Refund completed', vi: 'Đã hoàn tiền cọc' },
  RENT_PAYMENT_RECORDED: { en: 'Rental payment recorded', vi: 'Đã ghi nhận tiền thuê' },
  LATE_FEE_APPLIED: { en: 'Late fee applied', vi: 'Đã áp dụng phí trễ' },
  LATE_FEE_WAIVED: { en: 'Late fee waived', vi: 'Đã miễn phí trễ' },
  RENTAL_ACCESS_SUSPENDED: { en: 'Rental access suspended', vi: 'Đã khóa quyền truy cập' },
  RENTAL_ACCESS_RESTORED: { en: 'Rental access restored', vi: 'Đã mở lại quyền truy cập' },
  DELINQUENCY_REMINDER_SENT: { en: 'Delinquency reminder sent', vi: 'Đã gửi nhắc nợ' },
  FACILITY_TASK_CREATED: { en: 'Facility task created', vi: 'Đã tạo nhiệm vụ cơ sở' },
  FACILITY_TASK_UPDATED: { en: 'Facility task updated', vi: 'Đã cập nhật nhiệm vụ cơ sở' },
  MAINTENANCE_COMPLETED: { en: 'Maintenance completed', vi: 'Đã hoàn tất bảo trì' },
  POLICY_UPDATE: { en: 'Policy updated', vi: 'Đã cập nhật chính sách' }
}

const entities: Record<string, { en: string; vi: string }> = {
  hold: { en: 'Reservation', vi: 'Đơn đặt chỗ' },
  unit: { en: 'Unit', vi: 'Gian kho' },
  rental: { en: 'Rental', vi: 'Hợp đồng thuê' },
  payment: { en: 'Payment', vi: 'Thanh toán' },
  return: { en: 'Return', vi: 'Hồ sơ trả kho' },
  task: { en: 'Task', vi: 'Nhiệm vụ' },
  policy: { en: 'Policy', vi: 'Chính sách' }
}

function labelFrom(map: Record<string, { en: string; vi: string }>, value: string, lang: Language) {
  return map[value]?.[lang] || value.replace(/_/g, ' ')
}

export const managerStatusLabel = (value: string, lang: Language) => labelFrom(statusLabels, value, lang)
export const managerUnitTypeLabel = (value: string, lang: Language) => {
  const normalized = value.toLowerCase()
  if (lang === 'en') return unitTypes[normalized]?.en || value
  if (normalized.includes('extra large') || normalized.includes('xlarge')) return 'Gian kho rất lớn'
  if (normalized.includes('large')) return 'Gian kho lớn'
  if (normalized.includes('medium')) return 'Gian kho vừa'
  if (normalized.includes('small')) return 'Gian kho nhỏ'
  return value
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
  return parsed.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: lang !== 'vi' })
}
