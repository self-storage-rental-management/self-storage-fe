import { describe, expect, it } from 'vitest'
import {
  attendanceReviewHint,
  canChangeFacilityDeadline,
  canResolveAttendanceReview,
} from './intakePermissions'

describe('intake workflow permissions', () => {
  it('lets only a Manager conclude the attendance review', () => {
    // Staff used to see these buttons, pressed them and got a backend rejection.
    expect(canResolveAttendanceReview('MANAGER')).toBe(true)
    expect(canResolveAttendanceReview('STAFF')).toBe(false)
    expect(canResolveAttendanceReview('BUSINESS')).toBe(false)
    expect(canResolveAttendanceReview('CUSTOMER')).toBe(false)
  })

  it('lets only a Manager change the facility deadline', () => {
    expect(canChangeFacilityDeadline('MANAGER')).toBe(true)
    expect(canChangeFacilityDeadline('STAFF')).toBe(false)
  })

  it('tells Staff to wait for a Manager instead of inviting them to act', () => {
    expect(attendanceReviewHint('STAFF')).toContain('Đang chờ Quản lý')
    expect(attendanceReviewHint('STAFF')).not.toContain('Nhân viên có thể xác nhận')
    expect(attendanceReviewHint('MANAGER')).toContain('Quản lý có thể xác nhận')
  })
})
