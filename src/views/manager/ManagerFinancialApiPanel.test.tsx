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
  it.each([
    { transactionStatus: 'RECONCILIATION_REQUIRED', receiptAvailable: false },
    { reconciliationRequired: true, receiptAvailable: true },
  ])('keeps an unreconciled transaction blocked even when it has a receipt file: %j', metadata => {
    state.list = { data: paymentPage([{ ...item, type: 'RENEWAL', renewalId: 'renewal-id', receiptFileId: 'saved-file', ...metadata }]) }
    const html = render()
    expect(html).toContain('Chờ đối soát')
    expect(html).not.toContain('>Đã thu<')
    expect(html).not.toContain('Xem trước')
    expect(html).not.toContain('Tải xuống')
    expect(html).not.toContain('Hoàn VNPay')
  })
  it('does not present a raw PAID renewal needing reconciliation as collected or offer a receipt', () => {
    state.list = { data: paymentPage([{ ...item, type: 'RENEWAL', renewalId: 'renewal-id', transactionStatus: 'RECONCILIATION_REQUIRED', receiptAvailable: false }]) }
    const html = render()
    expect(html).toContain('Chờ đối soát')
    expect(html).not.toContain('>Đã thu<')
    expect(html).not.toContain('aria-label="Xem biên lai')
    expect(html).not.toContain('aria-label="Tải biên lai')
  })
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

  it('shows the full transaction reference, Vietnam time and receipt action for a paid transaction', () => {
    const transactionReference = 'TM-94036D0AAE914B739-LONG-REFERENCE'
    state.list = { data: paymentPage([{ ...item, transactionReference, occurredAt: '2026-10-22T17:27:00Z' }]) }
    const html = render()
    expect(html).toContain(`>${transactionReference}</code>`)
    expect(html).toContain('23/10/2026')
    expect(html).toContain('00:27')
    expect(html).toContain(`aria-label="Xem biên lai ${transactionReference}"`)
    expect(html).toContain(`aria-label="Tải biên lai ${transactionReference}"`)
    expect(html).toContain('VNPay')
  })

  it('distinguishes refunds from collections and does not offer receipts for pending payments', () => {
    state.list = { data: paymentPage([{ ...item, type: 'RETURN_REFUND', status: 'REFUNDED' }]) }
    let html = render()
    expect(html).toContain('Hoàn cọc')
    expect(html).toContain('Đã hoàn tiền')
    expect(html).toContain('-6.600.000')
    expect(html).toContain('Xem trước')
    state.list = { data: paymentPage([{ ...item, status: 'PENDING', paymentMethod: null }]) }
    html = render()
    expect(html).toContain('Chờ thanh toán')
    expect(html).toContain('Chưa ghi nhận')
    expect(html).toContain('Chưa có')
    expect(html).not.toContain('Xem trước')
    expect(html).not.toContain('Tải xuống')
  })

  it('offers preview and original download when a receipt file is available', () => {
    state.list = { data: paymentPage([{ ...item, receiptFileId: 'receipt-file' }]) }
    const html = render()
    expect(html).toContain('Xem trước')
    expect(html).toContain('Tải xuống')
  })
})
