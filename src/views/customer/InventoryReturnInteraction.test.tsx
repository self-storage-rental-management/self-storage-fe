import { expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import CustomerReservationCard from './CustomerReservationCard'
import type { CustomerReservation } from '../../services/customerReservationApi'

const state = vi.hoisted(() => ({ index: 0, resolve: vi.fn(), detail: { reservation: { id: 'order', status: 'PREPARING' }, inventoryResolutionStatus: 'PENDING_CUSTOMER' } }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [++state.index === 2 ? state.detail : typeof value === 'function' ? value() : value, () => {}],
}))
vi.mock('../../services/customerReservationApi', async original => ({
  ...await original<typeof import('../../services/customerReservationApi')>(),
  resolveCustomerInventory: (...args: unknown[]) => state.resolve(...args),
}))

it('forwards the chosen return date through the actual customer card callback to the API command', async () => {
  state.index = 0
  state.resolve.mockResolvedValue(state.detail)
  const reservation = { id: 'order', status: 'PREPARING', reservationCode: 'TEST', totalGoodsVolumeM3: 1, totalGoodsWeightKg: 10, startDate: '2026-11-01', endDate: '2027-02-01', createdAt: '2026-11-01T00:00:00Z', goodsReviewStatus: 'NOT_REQUIRED' } as CustomerReservation
  const tree = CustomerReservationCard({ reservation, facilityName: 'TEST', unitTypeName: 'TEST', onVerify: () => {}, onCancel: () => {}, onRefresh: async () => {} })
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
