import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiActor } from '../../services/authApi'
import type { ManagerReportSummary } from '../../services/managerReportingApi'
import { ApiClientError } from '../../services/apiClient'
import { manager } from '../../../tests/rentalApiFixtures'
import ManagerDashboardApiPanel from './ManagerDashboardApiPanel'

const state = vi.hoisted(() => ({
  actor: null as ApiActor | null, summary: {} as Record<string, unknown>, identities: [] as string[],
}))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock('../../hooks/useRentalApiResource', () => ({
  useRentalApiResource: (identity: string) => {
    state.identities.push(identity)
    return { loading: false, refresh: vi.fn(), ...(identity.includes(':report-summary:') ? state.summary : {}) }
  },
}))
const summary: ManagerReportSummary = {
  facilityId: 'f1', facilityName: 'Cơ sở 1',
  totalUnits: 20, availableUnits: 18, occupiedUnits: 1, maintenanceUnits: 0, reservedUnits: 1,
  occupancyRate: 5, monthlyRecurringRevenue: 9500000, collectedRevenue: null,
  overdueRentalsCount: 0, monthCheckinsCount: 1, openReturnsCount: 0, openMaintenanceTasksCount: 0,
  unitStatusBreakdown: [], unitTypeBreakdown: [],
}
beforeEach(() => {
  state.actor = { ...manager, permissions: [...manager.permissions, 'reports:read'], facilityNames: { f1: 'Cơ sở 1' } }
  state.summary = { data: { ...summary } }
  state.identities = []
})
const render = () => renderToStaticMarkup(<ManagerDashboardApiPanel setPage={() => {}} />)

describe('Manager dashboard uses the current facility report', () => {
  it('shows compact metrics and distinguishes unverified receipts from verified zero', () => {
    const html = render()
    for (const title of ['Tỷ lệ lấp đầy', 'Tiền thuê dự kiến/tháng', 'Tiền đã thu', 'Hợp đồng quá hạn', 'Nhận kho trong tháng', 'Yêu cầu trả kho']) expect(html).toContain(title)
    expect(html).toContain('5%')
    expect(html).toContain('9.500.000')
    expect(html).toContain('Chưa xác minh')
    expect(html).toContain('min-h-[112px]')
    expect(html).toContain('2xl:grid-cols-6')
    state.summary = { data: { ...summary, collectedRevenue: 0 } }
    const verified = render()
    expect(verified).not.toContain('Chưa xác minh')
    expect(verified).toContain('>0<')
  })
  it.each(['loading', 'error'])('hides stale metrics while %s without inventing zero amounts', status => {
    state.summary = {
      data: { ...summary, monthlyRecurringRevenue: 888888888 },
      ...(status === 'loading' ? { loading: true } : { error: new ApiClientError('SQL debug UnitType', { status: 500 }) }),
    }
    const html = render()
    expect(html).not.toContain('888.888.888')
    expect(html).not.toContain('Tỷ lệ lấp đầy')
    expect(html).not.toContain('SQL debug')
    expect(html).not.toContain('UnitType')
    expect(html).toContain(status === 'loading' ? 'Đang tải báo cáo cơ sở' : 'Hệ thống gặp lỗi')
    expect(html).toContain('Nhật ký hoạt động cơ sở')
  })
  it('does not request reports without permission or an active Manager account', () => {
    state.actor = { ...manager, permissions: ['support:read'] }
    expect(render()).toContain('role="alert"')
    expect(state.identities).toHaveLength(0)
    state.actor = null
    expect(render()).toContain('Cần đăng nhập')
    expect(state.identities).toHaveLength(0)
    state.actor = { ...manager, status: 'INACTIVE' }
    expect(render()).toContain('Cần đăng nhập')
    expect(state.identities).toHaveLength(0)
  })
  it('re-keys report reads when account, permission or facility scope changes', () => {
    render()
    let previous = state.identities.slice()
    expect(previous).toHaveLength(2)
    const actors: ApiActor[] = [
      { ...state.actor!, id: 'other-manager' },
      { ...state.actor!, permissions: [...state.actor!.permissions, 'support:read'] },
      { ...state.actor!, facilityScopes: { f2: 'MANAGE' } },
    ]
    for (const actor of actors) {
      state.actor = actor
      state.identities = []
      render()
      expect(state.identities).toHaveLength(2)
      expect(state.identities.every(id => !previous.includes(id))).toBe(true)
      previous = state.identities.slice()
    }
    expect(state.identities.some(id => id.endsWith(':report-summary:f2'))).toBe(true)
  })
  it('omits removed work-tracking and setup sections and reads only reports', () => {
    const html = render()
    for (const removed of ['Công việc cần theo dõi', 'Tổng hồ sơ thuê', 'Gia hạn cần theo dõi', 'Yêu cầu hỗ trợ mới', 'Quá thời hạn thuê', 'Thiết lập ban đầu', '(Setup)']) expect(html).not.toContain(removed)
    expect(html).toContain('Thông tin kho')
    expect(html).toContain('Nhật ký hoạt động cơ sở')
    expect(state.identities).toHaveLength(2)
    expect(state.identities.every(id => id.includes(':report-summary:') || id.includes(':report-activities:'))).toBe(true)
  })
  it('requires an unambiguous assigned facility before reading reports', () => {
    state.actor = { ...state.actor!, facilityScopes: {} }
    expect(render()).toContain('role="alert"')
    expect(state.identities).toHaveLength(0)
  })
})
