import { describe, expect, it } from 'vitest'
import type { ApiNotification } from '../../services/notificationApi'
import { managerNotificationPage, managerOverdueNotificationRef } from './managerNotificationRouting'

const notice = { type: 'RETURN', title: 'Cần phân công nhân viên thu hồi', relatedEntityId: 'recovery-10' } as ApiNotification

describe('manager recovery notification destination', () => {
  it.each([
    'Hợp đồng hết hạn, khách chưa trả kho',
    'CẢNH BÁO BÀN GIAO: Hợp đồng hết hạn nhưng kho chưa được bàn giao',
  ])('opens the matching overdue rental for %s', title => {
    const relatedEntityId = '00000000-0000-4000-8000-000000000001'
    const alert: ApiNotification = { ...notice, type: 'SYSTEM', title, relatedEntityId }
    expect(managerNotificationPage(alert)).toBe('overdue-cases')
    expect(managerOverdueNotificationRef(alert)).toBe(`RENTAL_TERM:${relatedEntityId}`)
    expect(managerOverdueNotificationRef({ ...alert, relatedEntityId: null })).toBeUndefined()
  })
  it('opens staff tasks for recovery records regardless of old or new title', () => {
    for (const title of ['Cần phân công nhân viên thu hồi', 'Yêu cầu thu hồi chờ phân công', 'Cần rà soát căn cứ thu hồi']) {
      expect(managerNotificationPage({ ...notice, title, relatedEntityType: 'VIOLATION_RECOVERY' })).toBe('staff-tasks')
    }
  })
  it('opens the referenced suspicion report from a system notice', () => {
    expect(managerNotificationPage({ ...notice, type: 'SYSTEM', title: 'Báo cáo nghi vấn hàng cấm' })).toBe('suspicion-report')
  })
  it('keeps ordinary return notices on the return workspace', () => {
    expect(managerNotificationPage(notice)).toBe('returns')
  })
  it('keeps check-in appointment and support routes', () => {
    expect(managerNotificationPage({ ...notice, type: 'CHECKIN', title: 'Khách hàng đã cập nhật lịch nhận kho' })).toBe('unit-assignment')
    expect(managerNotificationPage({ ...notice, type: 'SUPPORT' })).toBe('support')
  })
})
