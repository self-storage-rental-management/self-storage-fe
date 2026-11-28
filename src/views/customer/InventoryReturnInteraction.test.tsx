import { expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerReservationCard from './CustomerReservationCard'
import RentalDetail from '../rental-api/RentalDetail'
import type { CustomerReservation } from '../../services/customerReservationApi'
import type { RentalApiDetail } from '../../types/rentalApi'

const state = vi.hoisted(() => ({
  mode: 'rental' as 'rental' | 'card',
  index: 0,
  resolve: vi.fn(),
  detail: { reservation: { id: 'order', status: 'PREPARING' }, lockReference: 'LOCK-018', inventoryResolutionStatus: 'PENDING_CUSTOMER', inventoryFinalDeadlineAt: '2026-12-10T00:00:00Z' },
}))
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>()
  return {
    ...actual,
    useEffect: () => {},
    useLayoutEffect: () => {},
    useContext: () => false,
    useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => {
      const initial = typeof value === 'function' ? value() : value
      if (state.mode === 'card') {
        return [++state.index === 3 ? state.detail : initial, () => {}]
      }
      return [initial === undefined ? state.detail : initial, () => {}]
    },
  }
})
vi.mock('../../services/customerReservationApi', async original => ({
  ...await original<typeof import('../../services/customerReservationApi')>(),
  resolveCustomerInventory: (...args: unknown[]) => state.resolve(...args),
}))

it('forwards the chosen return date through the lease file RentalDetail callback to the API command', async () => {
  state.resolve.mockResolvedValue(state.detail)
  const rental = {
    id: 'rental-1',
    reservationId: 'order',
    status: 'setup',
    displayCode: 'RNT-001',
    moveInCompletedAt: '2026-11-01T00:00:00Z',
    inventoryPending: true,
    facility: { id: 'f1', name: 'Facility' },
    customer: { id: 'c1', fullName: 'Customer' },
    storageUnit: { id: 'u1', code: 'A-01' },
    unitType: { id: 'ut1', name: 'Type' },
    access: { completeness: 'COMPLETE', status: 'ACTIVE', reason: null, reference: 'LOCK-1' },
    monthlyPrice: 1000000,
    currency: 'VND',
    dataWarnings: [],
  } as unknown as RentalApiDetail
  const tree = RentalDetail({ rental, role: 'customer' })
  function find(node: unknown): ((decision: string, date: string) => void) | undefined {
    if (Array.isArray(node)) { for (const child of node) { const match = find(child); if (match) return match } }
    if (!node || typeof node !== 'object') return undefined
    const props = (node as ReactElement<{ children?: unknown; onResolve?: (decision: string, date: string) => void }>).props
    return props?.onResolve ?? find(props?.children)
  }
  const resolve = find(tree)
  expect(resolve).toBeDefined()
  resolve!('CANCEL_AND_RETURN', '2026-12-05')
  await vi.waitFor(() => expect(state.resolve).toHaveBeenCalledWith('order', 'CANCEL_AND_RETURN', expect.any(String), '2026-12-05'))
})

it('does not render inventory appointment or resolution controls on the warehouse reservation card after receipt confirmation', () => {
  state.mode = 'card'
  state.index = 0
  const reservation = { id: 'order', status: 'PREPARING', reservationCode: 'RSV-FGBD-89QV-J44R', assignedUnitCode: 'Q1-A-05', totalGoodsVolumeM3: 1, totalGoodsWeightKg: 10, startDate: '2026-11-01', endDate: '2027-02-01', createdAt: '2026-11-01T00:00:00Z', goodsReviewStatus: 'NOT_REQUIRED' } as CustomerReservation
  const html = renderToStaticMarkup(<CustomerReservationCard reservation={reservation} facilityName="TEST" unitTypeName="TEST" onVerify={() => {}} onCancel={() => {}} onRefresh={async () => {}} />)
  expect(html).toContain('Gian kho đã phân:')
  expect(html).toContain('Q1-A-05')
  expect(html).toContain('Mã ổ khóa đã bàn giao:')
  expect(html).toContain('LOCK-018')
  expect(html).not.toContain('Chọn lịch kiểm kê')
  expect(html).not.toContain('Đổi lịch kiểm kê')
  expect(html).not.toContain('Kiểm kê cần bạn xác nhận')
  expect(html).toContain('Hồ sơ thuê')
})
