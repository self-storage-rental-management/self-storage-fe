import type { ApiNotification } from './notificationApi'
import { isUuid } from './renewalOperationsApi'

export type NotificationRecordTarget = {
  kind: 'rental' | 'recovery-task' | 'violation-recovery' | 'return' | 'payment'
  id: string
}

const handoverTitles = new Set([
  'Hợp đồng hết hạn, khách chưa trả kho',
  'CẢNH BÁO BÀN GIAO: Hợp đồng hết hạn nhưng kho chưa được bàn giao',
])
const rentalExpiryTitles = new Set([
  'Hợp đồng thuê sắp hết hạn', 'Hợp đồng thuê đã hết hạn',
  'Hợp đồng thuê kho còn 14 ngày', 'Hợp đồng thuê kho còn 3 ngày', 'Hợp đồng thuê kho đã hết hạn',
  'Nhắc nhở: Hợp đồng thuê kho sắp hết hạn (còn 14 ngày)',
  'Cảnh báo: Hợp đồng thuê kho sắp hết hạn (còn 3 ngày)',
  'Thông báo: Hợp đồng thuê kho đã hết hạn',
  'Hồ sơ thuê đã chuyển sang xử lý thu hồi', 'Đã hoàn tất hồ sơ thu hồi kho',
])
const paymentReviewTitles = new Set([
  'Cần xem xét khoản thanh toán quá hạn',
  'CẦN MANAGER XEM XÉT (D+7): Hồ sơ quá hạn thanh toán kéo dài',
])

export function notificationRecordTarget(notification: ApiNotification, role: 'staff' | 'manager' | 'customer'): NotificationRecordTarget | undefined {
  if (!isUuid(notification.relatedEntityId)) return
  const id = notification.relatedEntityId.toLowerCase()
  const { type, title, relatedEntityType } = notification
  if (type === 'SYSTEM' && handoverTitles.has(title)) return { kind: 'rental', id }
  if (type === 'OVERDUE' && title === 'Hồ sơ quá hạn đã chuyển sang xử lý thu hồi' && role !== 'customer') return { kind: 'rental', id }
  if (type === 'OVERDUE' && role === 'manager' && paymentReviewTitles.has(title)) return { kind: 'payment', id }
  if (role === 'staff' && type === 'SYSTEM' && title === 'Được giao nhiệm vụ thu hồi kho') return { kind: 'recovery-task', id }
  if (role === 'customer' && (type === 'SYSTEM' || type === 'OVERDUE') && rentalExpiryTitles.has(title)) return { kind: 'rental', id }
  if (type === 'RETURN' && relatedEntityType === 'VIOLATION_RECOVERY') return { kind: 'violation-recovery', id }
  // Inventory mismatch reminders and extensions may carry the reservation ID.
  if (type === 'RETURN' && title !== 'Nhắc hạn trả kho do kiểm kê sai lệch'
    && !title.startsWith('Đã gia hạn thời gian trả kho lần ') && role !== 'manager') return { kind: 'return', id }
}
