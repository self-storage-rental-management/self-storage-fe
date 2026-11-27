import { describe, expect, it } from 'vitest'
import type { ApiNotification } from './notificationApi'
import { notificationRecordTarget } from './notificationRecordTarget'
import { managerNotificationPage, managerOverdueNotificationRef } from '../views/manager/managerNotificationRouting'

const id = '00000000-0000-4000-8000-000000000001'
const notice = (type: ApiNotification['type'], title: string, relatedEntityType?: string): ApiNotification => ({
  id, userId: id, type, title, relatedEntityType, relatedEntityId: id, content: '', isRead: false, createdAt: '',
})

describe('notification record links', () => {
  it.each([
    ['staff', 'SYSTEM', 'Được giao nhiệm vụ thu hồi kho', undefined, 'recovery-task'],
    ['staff', 'SYSTEM', 'Hợp đồng hết hạn, khách chưa trả kho', undefined, 'rental'],
    ['staff', 'RETURN', 'Cần bàn giao sau đối soát', undefined, 'return'],
    ['staff', 'RETURN', 'Cần xử lý thu hồi', 'VIOLATION_RECOVERY', 'violation-recovery'],
    ['customer', 'SYSTEM', 'Hợp đồng thuê kho còn 3 ngày', undefined, 'rental'],
    ['customer', 'OVERDUE', 'Hợp đồng thuê sắp hết hạn', undefined, 'rental'],
    ['customer', 'RETURN', 'Đã cập nhật lịch bàn giao trả kho', undefined, 'return'],
  ] as const)('uses the correct ID for %s %s %s', (role, type, title, entity, kind) => {
    expect(notificationRecordTarget(notice(type, title, entity), role)).toEqual({ kind, id })
  })

  it('opens different resources for automatic recovery and a legacy payment escalation', () => {
    const recovery = notice('OVERDUE', 'Hồ sơ quá hạn đã chuyển sang xử lý thu hồi')
    expect(managerOverdueNotificationRef(recovery)).toBe(`RENTAL_TERM:${id}`)
    expect(managerNotificationPage(recovery)).toBe('overdue-cases')
    const payment = notice('OVERDUE', 'Cần xem xét khoản thanh toán quá hạn')
    expect(managerNotificationPage(payment)).toBe('payments')
    expect(notificationRecordTarget(payment, 'manager')).toEqual({ kind: 'payment', id })
    expect(managerOverdueNotificationRef(payment)).toBeUndefined()
  })

  it('does not treat a reservation reference as a return ID', () => {
    expect(notificationRecordTarget(notice('RETURN', 'Đã gia hạn thời gian trả kho lần 1'), 'customer')).toBeUndefined()
  })
})
