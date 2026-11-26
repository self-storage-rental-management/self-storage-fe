/**
 * Who may act on the unified intake workflow.
 *
 * Concluding a last-minute attendance review and changing the facility deadline are
 * Manager-only operations in the backend (`IntakeWorkflowService.manager(...)`). The panel used
 * to render those buttons for Staff as well, so Staff could press them and only got a
 * "Chỉ Manager được xử lý thao tác này" rejection from the server.
 */
export type IntakeRole = 'STAFF' | 'MANAGER' | 'BUSINESS' | 'CUSTOMER'

/** Concluding the attendance review (approve on time / confirm absent / facility exception). */
export function canResolveAttendanceReview(role: IntakeRole) {
  return role === 'MANAGER'
}

/** Changing the inspection deadline and reminding the customer. */
export function canChangeFacilityDeadline(role: IntakeRole) {
  return role === 'MANAGER'
}

/**
 * What to tell an operator who is waiting for the review to be concluded.
 * Staff must be told to wait for a Manager rather than be invited to act.
 */
export function attendanceReviewHint(role: IntakeRole) {
  return canResolveAttendanceReview(role)
    ? 'Quản lý có thể xác nhận khách đến để tiếp tục xác minh & kiểm kê ngay, hoặc chốt vắng mặt.'
    : 'Đang chờ Quản lý kết luận đối soát. Nhân viên chưa thể tiếp tục xác minh và kiểm kê.'
}
