import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ManagerRecoveryCards from './ManagerRecoveryCards'

const state = vi.hoisted(() => ({
  recovery: [] as unknown[],
  overdue: [] as unknown[],
  tasks: [] as unknown[],
  recoveryError: undefined as unknown,
}))
vi.mock('../../services/authApi', () => ({
  getAuthenticatedActor: () => ({ id: 'manager', status: 'ACTIVE', roles: ['MANAGER'], permissions: ['rentals:read'], facilityScopes: {} }),
}))
vi.mock('./ManagerOverdueApiPanel', async importOriginal => ({
  ...await importOriginal<typeof import('./ManagerOverdueApiPanel')>(),
  OverdueDetail: ({ caseRef }: { caseRef: string }) => <p>Chi tiết {caseRef}</p>,
}))
vi.mock('../../hooks/useRentalApiResource', () => ({
  useRentalApiResource: (key: string) => key.includes(':recovery:')
    ? { data: state.recovery, error: state.recoveryError, loading: false, refresh: () => {} }
    : key.includes(':overdue-recovery-tasks:')
      ? { data: state.tasks, loading: false, refresh: () => {} }
      : { data: { rows: state.overdue, partial: false }, loading: false, refresh: () => {} },
}))

const recovery = {
  id: 'recovery-1', taskId: 'task-1', reservationCode: 'RSV-RECOVERY', unitCode: 'UNIT-A', customerName: 'Khách thu hồi',
  staffName: 'Nhân viên A', stage: 'AWAITING_ATTENDANCE', reason: 'REMOVAL_OVERDUE',
  actionDueAt: '2099-12-01T03:00:00Z', deadlineAt: '2099-12-01T03:00:00Z', scheduledAt: '2099-11-30T03:00:00Z',
}
const overdue = {
  caseRef: 'overdue-1', displayCode: 'SH-312102', rentalDisplayCode: 'SH-349647', customerName: 'Khách quá hạn', storageUnitCode: 'UNIT-B',
  kind: 'RENTAL_TERM', overdueDays: 9, priority: 'RECOVERY', workflowStatus: 'WAITING_RECOVERY',
  recoveryCutoff: '2026-11-01T03:00:00Z',
}
const render = () => renderToStaticMarkup(<ManagerRecoveryCards facilityId="facility" canCoordinate canViewOverdue onLocked={() => {}} />)

describe('combined manager recovery cards', () => {
  beforeEach(() => {
    state.recovery = [{ ...recovery }]
    state.overdue = [{ ...overdue }]
    state.tasks = []
    state.recoveryError = undefined
  })
  it('shows both sources together as cards', () => {
    const html = render()
    expect(html).toContain('RSV-RECOVERY')
    expect(html).toContain(overdue.rentalDisplayCode)
    expect(html).not.toContain(overdue.displayCode)
    expect(html).toContain('Khách thu hồi')
    expect(html).toContain('Khách quá hạn')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('role="tablist"')
  })
  it('does not duplicate a task that is already represented by a recovery record', () => {
    state.overdue = [{ ...overdue, recoveryTaskId: 'task-1' }]
    const html = render()
    expect(html).toContain('RSV-RECOVERY')
    expect(html).not.toContain(overdue.rentalDisplayCode)
  })
  it('shows a recovery task absent from the overdue feed and deduplicates linked tasks', () => {
    state.tasks = [
      { id: 'q02', storageUnitCode: 'DEMO-Q02', facilityId: 'facility', status: 'OPEN', reason: 'AUTO_OVERDUE_DAY_8' },
      { id: 'q03', storageUnitCode: 'DEMO-Q03', facilityId: 'facility', status: 'OPEN', reason: 'AUTO_OVERDUE_DAY_8', assignedStaffName: 'Demo Staff' },
    ]
    state.overdue = [{ ...overdue, recoveryTaskId: 'q02' }]
    const html = render()
    expect(html).toContain(overdue.rentalDisplayCode)
    expect(html).not.toContain('DEMO-Q02')
    expect(html).toContain('DEMO-Q03')
    expect(html).toContain('Demo Staff')
    expect(html).toContain('Xem nhiệm vụ thu hồi')
  })
  it('keeps overdue cards visible when recovery loading fails', () => {
    state.recovery = []
    state.recoveryError = new Error('Network unavailable')
    const html = render()
    expect(html).toContain(overdue.rentalDisplayCode)
    expect(html).toContain('Chưa tải được hồ sơ thu hồi')
    expect(html).not.toContain('Không có hồ sơ phù hợp')
  })
  it('includes completed cases by default', () => {
    state.overdue = [{ ...overdue, workflowStatus: 'COMPLETED' }]
    expect(render()).toContain(overdue.rentalDisplayCode)
  })
  it('shows pickup dates for stored goods and completion for handed-over goods', () => {
    state.recovery = [
      { ...recovery, stage: 'COMPLETED', items: [{ disposition: 'STORED' }],
        pickupAppointmentAt: '2099-12-01T03:00:00Z', pickupDueAt: '2099-12-02T03:00:00Z' },
      { ...recovery, id: 'recovery-2', reservationCode: 'RSV-HANDED-OVER', stage: 'COMPLETED',
        items: [{ disposition: 'STORED', releasedAt: '2099-12-01T03:00:00Z' }] },
    ]
    const html = render()
    expect(html).toContain('RSV-RECOVERY')
    expect(html).toContain('Lịch nhận hàng')
    expect(html).toContain('Hạn nhận hàng')
    expect(html).toContain('RSV-HANDED-OVER')
    expect(html).toContain('Đã kết thúc xử lý')
  })
  it('opens the notification target even when the case is absent from the current list', () => {
    const caseRef = 'RENTAL_TERM:00000000-0000-4000-8000-000000000002'
    const html = renderToStaticMarkup(<ManagerRecoveryCards facilityId="facility" canCoordinate canViewOverdue
      initialOverdue={{ caseRef }} onLocked={() => {}} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain(`Chi tiết ${caseRef}`)
  })
})
