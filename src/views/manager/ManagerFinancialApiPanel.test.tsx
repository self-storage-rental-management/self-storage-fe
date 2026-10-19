import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiActor } from '../../services/authApi'
import { ApiClientError } from '../../services/apiClient'
import { manager } from '../../../tests/rentalApiFixtures'
import ManagerFinancialApiPanel from './ManagerFinancialApiPanel'
import { ManagerPresentationProvider } from './managerPresentation'

const state = vi.hoisted(() => ({ actor: null as ApiActor | null, list: {} as Record<string, unknown>, identities: [] as string[] }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: (identity: string) => {
  state.identities.push(identity)
  return { loading: false, refresh: () => {}, ...state.list }
} }))

beforeEach(() => {
  state.actor = { ...manager, permissions: [...manager.permissions, 'payments:read'] }
  state.list = {}
  state.identities = []
})

const render = () => renderToStaticMarkup(<ManagerPresentationProvider><ManagerFinancialApiPanel /></ManagerPresentationProvider>)
const item = {
  id: 'payment-id', transactionReference: 'VNPAY-20261013-001', customerName: 'Demo Customer',
  type: 'RESERVATION_DEPOSIT', status: 'PAID', amount: 6600000, currency: 'VND',
  refundedAmount: 0, paymentMethod: 'VNPAY', occurredAt: '2026-10-13T06:50:14Z',
}
const paymentPage = (data: unknown[]) => ({ data, pagination: {
  page: 0, pageSize: 10, totalItems: data.length, totalPages: data.length ? 1 : 0, sort: 'occurredAt,desc',
}, correlationId: 'test' })

describe('Manager payment history screen', () => {
  it('shows payment transactions without rental record cards or financial detail links', () => {
    state.list = { data: paymentPage([item]) }
    const html = render()
    expect(html).toContain('Lịch sử thanh toán')
    expect(html).toContain('VNPAY-20261013-001')
    expect(html).toContain('Demo Customer')
    expect(html).toContain('Cọc giữ chỗ')
    expect(html).not.toContain('Mã hồ sơ thuê')
    expect(html).not.toContain('A-01')
    expect(html).not.toContain('Xem thông tin tài chính')
    expect(html).not.toContain('chưa được kết nối')
  })

  it('does not show stale transactions after an API error', () => {
    state.list = { error: new ApiClientError('Offline', { code: 'NETWORK_ERROR' }), data: paymentPage([item]) }
    const html = render()
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('VNPAY-20261013-001')
  })

  it('shows an empty state only after a successful empty response', () => {
    state.list = { data: paymentPage([]) }
    expect(render()).toContain('Không tìm thấy giao dịch phù hợp')
    state.list = { loading: true, data: paymentPage([]) }
    expect(render()).not.toContain('Không tìm thấy giao dịch phù hợp')
  })

  it('does not load data without the payment read permission', () => {
    state.actor = { ...manager, permissions: [] }
    expect(render()).toContain('role="alert"')
    expect(state.identities).toHaveLength(0)
  })
})
