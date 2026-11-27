import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { manager, renewal } from '../../../tests/rentalApiFixtures'
import RenewalDecisionModal from './RenewalDecisionModal'

const state = vi.hoisted(() => ({ kind: 'UNPAID', loading: false, error: undefined as unknown }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => ({ ...manager, id: 'c1', roles: ['CUSTOMER'] }) }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: () => ({ loading: state.loading, error: state.error,
  data: { rentalId: 'r1', renewalId: 'n1', state: state.kind, depositAmount: 200000, paidAmount: 200000 } }) }))
vi.mock('../../hooks/useRenewalCommand', () => ({ useRenewalCommand: () => ({ busy: false, uncertain: false, conflict: false, run: vi.fn() }) }))

beforeEach(() => { state.kind = 'UNPAID'; state.loading = false; state.error = undefined })
const render = () => renderToStaticMarkup(<RenewalDecisionModal renewal={renewal} action="CANCEL" onClose={vi.fn()} onSuccess={vi.fn()} onRefresh={vi.fn()} />)

it('requires explicit acknowledgement of the nonrefundable renewal deposit', () => {
  state.kind = 'DEPOSIT_PAID'
  const html = render()
  expect(html).toContain('tiền cọc gia hạn không được hoàn lại')
  expect(html).toContain('Tôi xác nhận tự hủy gia hạn')
  expect(html).toContain('200.000 đ')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Xác nhận<\/button>/)
  expect(html).not.toContain('checked=""')
})
it('explains unpaid cancellation without a deposit forfeiture checkbox', () => {
  const html = render()
  expect(html).toContain('Hủy yêu cầu gia hạn chưa thanh toán')
  expect(html).not.toContain('Tôi xác nhận tự hủy gia hạn')
})
it('requires acknowledgement that the entire fully paid renewal is nonrefundable', () => {
  state.kind = 'FULLY_PAID'
  const html = render()
  expect(html).toContain('Bạn đã thanh toán đủ tiền gia hạn')
  expect(html).toContain('Tổng tiền gia hạn không hoàn lại')
  expect(html).toContain('đồng ý toàn bộ tiền gia hạn đã thanh toán không được hoàn lại')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Xác nhận<\/button>/)
  expect(html).not.toContain('checked=""')
})
it('blocks cancellation when the facility must reconcile the money', () => {
  state.kind = 'RECONCILIATION_REQUIRED'
  const html = render()
  expect(html).toContain('cơ sở đối soát trước khi hủy')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Xác nhận<\/button>/)
})
