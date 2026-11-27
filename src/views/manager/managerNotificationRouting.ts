import type { ApiNotification } from '../../services/notificationApi'

export function managerNotificationPage(notification: ApiNotification): string {
  if (notification.type === 'SYSTEM' && notification.relatedEntityId &&
    /^(?:(?:Khẩn cấp · )?Báo|Đã gửi báo) cáo nghi vấn hàng cấm$/.test(notification.title)) return 'suspicion-report'
  if (notification.relatedEntityType === 'VIOLATION_RECOVERY') return 'staff-tasks'
  if (notification.type === 'SUPPORT') return 'support'
  if (notification.type === 'RETURN') return 'returns'
  if (notification.type === 'CHECKIN') {
    return notification.title === 'Khách hàng đã cập nhật lịch nhận kho' ? 'unit-assignment' : 'dashboard'
  }
  if (notification.type === 'RESERVATION') return 'unit-assignment'
  if (notification.type === 'RENEWAL') return 'rentals'
  if (notification.type === 'PAYMENT' || notification.type === 'OVERDUE') {
    return notification.type === 'OVERDUE' ? 'overdue-cases' : 'payment-complaints'
  }
  return 'dashboard'
}
