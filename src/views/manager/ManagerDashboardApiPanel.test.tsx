import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiActor } from '../../services/authApi'
import type { ManagerReportSummary } from '../../services/managerReportingApi'
import { ApiClientError } from '../../services/apiClient'
import { manager } from '../../../tests/rentalApiFixtures'
import ManagerDashboardApiPanel from './ManagerDashboardApiPanel'
import { sortUnitTypeBreakdown } from './ManagerReportsApiPanel'

const state = vi.hoisted(() => ({
  actor: null as ApiActor | null, summary: {} as Record<string, unknown>, identities: [] as string[],
  cashflow: {} as Record<string, unknown>,
}))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock('../../hooks/useRentalApiResource', () => ({
  useRentalApiResource: (identity: string) => {
    state.identities.push(identity)
    return { loading: false, refresh: vi.fn(), ...(identity.includes(':report-summary:') ? state.summary : identity.includes(':cashflow:') ? state.cashflow : {}) }
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
  state.cashflow = { data: { facilityId: 'f1', from: '2026-06-01', to: '2026-11-24', snapshotAt: '2026-11-24T00:00:00Z', completeness: 'PARTIAL', firstPaymentDate: '2026-06-01', collected: 0, refunded: 0, netRetained: 0, pendingRefund: 0, pendingApprovalRefund: 0, securityDepositHeld: null, daily: [], monthly: [], settlements: [], warnings: [] } }
  state.identities = []
})
const render = () => renderToStaticMarkup(<ManagerDashboardApiPanel setPage={() => {}} />)

describe('Manager dashboard uses the current facility report', () => {
  it('shows compact metrics and distinguishes unverified receipts from verified zero', () => {
    const html = render()
    for (const title of ['Gian kho đang sử dụng', 'Hợp đồng quá hạn', 'Nhận kho trong tháng', 'Yêu cầu trả kho', 'Tiền đã thu']) expect(html).toContain(title)
    expect(html).toContain('>2<')
    expect(html).not.toContain('Tỷ lệ lấp đầy')
    expect(html).not.toContain('Tiền thuê dự kiến/tháng')
    expect(html).toContain('Chưa đủ dữ liệu')
    expect(html).toContain('min-h-[112px]')
    expect(html).toContain('xl:grid-cols-4')
    state.summary = { data: { ...summary, collectedRevenue: 0 } }
    state.cashflow = { data: { ...(state.cashflow.data as object), completeness: 'RECORDED', securityDepositHeld: 0 } }
    const verified = render()
    expect(verified).not.toContain('Chưa đủ dữ liệu')
    expect(verified).toContain('>0<')
  })
  it('counts assigned and held units as storage units in use', () => {
    state.summary = { data: {
      ...summary,
      unitStatusBreakdown: [
        { status: 'available', name: 'Sẵn sàng', count: 17, percentage: 85 },
        { status: 'occupied', name: 'Đang thuê', count: 1, percentage: 5 },
        { status: 'assigned', name: 'Đã phân bổ', count: 2, percentage: 10 },
      ],
    } }
    const html = render()
    expect(html).toContain('>3<')
    expect(html).toContain('đã phân bổ')
  })
  it('orders storage capacity charts by S, M, L, XL', () => {
    const ordered = sortUnitTypeBreakdown([
      { typeCode: 'XL', typeName: 'Kho Rất Lớn (XL)', totalUnits: 5, occupiedUnits: 0, occupancyRate: 0 },
      { typeCode: 'L', typeName: 'Kho Lớn (L)', totalUnits: 5, occupiedUnits: 0, occupancyRate: 0 },
      { typeCode: 'M', typeName: 'Kho Trung (M)', totalUnits: 5, occupiedUnits: 0, occupancyRate: 0 },
      { typeCode: 'S', typeName: 'Kho Nhỏ (S)', totalUnits: 5, occupiedUnits: 1, occupancyRate: 20 },
    ])
    expect(ordered.map(row => row.typeCode)).toEqual(['S', 'M', 'L', 'XL'])
  })
  it('places the storage charts before the cashflow report', () => {
    const html = render()
    expect(html.indexOf('Phân bổ trạng thái gian kho')).toBeLessThan(html.indexOf('Quản lý thu và hoàn tiền'))
    expect(html.indexOf('Công suất theo loại kho')).toBeLessThan(html.indexOf('Quản lý thu và hoàn tiền'))
  })
  it('shows Vietnamese business labels instead of raw return type codes', () => {
    state.cashflow = { data: { ...(state.cashflow.data as object), settlements: [{
      id: 'return-1', reservationCode: 'RSV-1', customerName: 'Khách',
      status: 'completed', reason: 'EARLY_RETURN', deposit: 100, rentalCredit: 0,
      deductions: 0, refund: 100, paidAt: '2026-11-24T00:00:00Z',
      reference: 'RF-1', payoutRecorded: true,
    }] } }
    const html = render()
    expect(html).toContain('Trả kho trước hạn')
    expect(html).not.toContain('EARLY_RETURN')
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
    expect(previous).toHaveLength(3)
    const actors: ApiActor[] = [
      { ...state.actor!, id: 'other-manager' },
      { ...state.actor!, permissions: [...state.actor!.permissions, 'support:read'] },
      { ...state.actor!, facilityScopes: { f2: 'MANAGE' } },
    ]
    for (const actor of actors) {
      state.actor = actor
      state.identities = []
      render()
      expect(state.identities).toHaveLength(3)
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
    expect(state.identities).toHaveLength(3)
    expect(state.identities.every(id => id.includes(':report-summary:') || id.includes(':report-activities:') || id.includes(':cashflow:'))).toBe(true)
  })
  it('requires an unambiguous assigned facility before reading reports', () => {
    state.actor = { ...state.actor!, facilityScopes: {} }
    expect(render()).toContain('role="alert"')
    expect(state.identities).toHaveLength(0)
  })
})
