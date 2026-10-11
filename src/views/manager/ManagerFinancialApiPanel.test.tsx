import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiActor } from '../../services/authApi'
import { ApiClientError } from '../../services/apiClient'
import { manager, page, rental } from '../../../tests/rentalApiFixtures'
import ManagerFinancialApiPanel, { ManagerRentalFinancialDetail } from './ManagerFinancialApiPanel'
import { ManagerPresentationProvider } from './managerPresentation'

const state = vi.hoisted(() => ({ actor: null as ApiActor | null, list: {} as Record<string, unknown>, detail: {} as Record<string, unknown>, identities: [] as string[] }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: (identity: string) => {
  state.identities.push(identity)
  return { loading: false, refresh: () => {}, ...(identity.includes(':financial-detail:') ? state.detail : state.list) }
} }))
beforeEach(() => { state.actor = manager; state.list = {}; state.detail = {}; state.identities = [] })
const render = () => renderToStaticMarkup(<ManagerPresentationProvider><ManagerFinancialApiPanel setPage={() => {}} /></ManagerPresentationProvider>)
const detail = () => renderToStaticMarkup(<ManagerPresentationProvider><ManagerRentalFinancialDetail actor={state.actor!} rentalId={rental.id} /></ManagerPresentationProvider>)

describe('Manager financial API screen', () => {
  it('shows server rental records and clearly separates missing payment history', () => {
    state.list = { data: page([rental]) }
    const html = render()
    expect(html).toContain('Customer')
    expect(html).toContain('A-01')
    expect(html).toContain('Lịch sử các lần thu và hoàn tiền chưa được kết nối')
    expect(html).toContain('Xem hồ sơ quá hạn')
    expect(html).toContain('Tìm kiếm hồ sơ thuê')
    for (const action of ['Gửi nhắc', 'Khóa truy cập', 'Áp dụng phí', 'Tải lại', 'Xóa lịch sử']) expect(html).not.toContain(action)
  })
  it('does not render stale records, zero totals or empty-list success after a request error', () => {
    state.list = { error: new ApiClientError('Offline', { code: 'NETWORK_ERROR' }), data: page([rental]) }
    const html = render()
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('A-01')
    expect(html).not.toContain('Không có dữ liệu')
    expect(html).not.toContain('0 bản ghi')
  })
  it('shows the honest empty state only for a successful verified list', () => {
    state.list = { data: page([]) }
    expect(render()).toContain('Không có dữ liệu')
    state.list = { loading: true, data: page([]) }
    expect(render()).not.toContain('Không có dữ liệu')
  })
  it('does not invent financial or access facts for UNKNOWN detail or expose a raw PIN', () => {
    state.detail = { data: { ...rental, accessCode: '9004#' } }
    const html = detail()
    expect(html).toContain('Chưa có dữ liệu xác thực')
    expect(html).not.toContain('9004#')
    expect(html).not.toContain('0 ₫')
    expect(html).not.toContain('Đã thanh toán')
  })
  it('preserves PARTIAL financial data without inventing a security deposit', () => {
    state.detail = { data: { ...rental, financialSummary: { completeness: 'PARTIAL', currency: 'VND', outstandingAmount: 700000, overdueAmount: 100000, securityDepositAmount: null, nextDueDate: null, billingMode: 'OTHER', reason: 'Chưa có dữ liệu cọc bảo đảm.' } } }
    const html = detail()
    expect(html).toContain('700.000')
    expect(html).toContain('100.000')
    expect(html).not.toContain('Chưa có dữ liệu cọc bảo đảm.')
    expect(html).toContain('Đã xác minh một phần')
    expect(html).toContain('Chưa có dữ liệu xác thực')
  })
  it('discards stale detail on error or loading', () => {
    state.detail = { error: new Error('Offline'), data: rental }
    expect(detail()).not.toContain('A-01')
    state.detail = { loading: true, data: rental }
    expect(detail()).not.toContain('A-01')
  })
  it('does not load financial records for an unauthorized actor', () => {
    state.actor = { ...manager, permissions: [] }
    expect(render()).toContain('role="alert"')
    expect(state.identities).toHaveLength(0)
  })
  it('resets account/scope/permission-bound list and detail identities', () => {
    render(); detail()
    const previous = state.identities.slice()
    state.actor = { ...manager, id: 'another-manager', facilityScopes: { f2: 'READ' } }
    state.identities = []
    render(); detail()
    expect(state.identities.every(id => !previous.includes(id))).toBe(true)
  })
})
