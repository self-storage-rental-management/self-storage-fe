import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import CustomerReservationCard from './CustomerReservationCard'
import type { CustomerReservation } from '../../services/customerReservationApi'

// Executes the real component command handler with a hook harness, not browser E2E.
const state = vi.hoisted(() => ({ confirm: vi.fn(), messages: [] as unknown[] }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [typeof value === 'function' ? value() : value, (next: unknown) => state.messages.push(next)],
}))
vi.mock('../../services/customerReservationApi', async original => ({
  ...await original<typeof import('../../services/customerReservationApi')>(),
  confirmCustomerReceipt: (...args: unknown[]) => state.confirm(...args),
}))
const reservation: CustomerReservation = {
  id: 'reservation-test', reservationCode: 'TEST', quoteId: 'quote-test', facilityId: 'facility-test', unitTypeId: 'type-test',
  status: 'AWAITING_CUSTOMER_RECEIPT', goodsReviewStatus: 'NOT_REQUIRED', compatibilityResult: 'COMPATIBLE',
  startDate: '2026-11-01', endDate: '2027-02-01', totalRentalAmount: 300,
  reservationDepositAmount: 60, securityDepositAmount: 100, remainingRentalAmount: 240,
  dueAtCheckIn: 340, totalInitialObligation: 400, totalGoodsVolumeM3: 1, totalGoodsWeightKg: 1,
  holdExpiresAt: '2026-11-01T00:00:00Z', createdAt: '2026-10-11T00:00:00Z',
}
function command(refresh: () => Promise<void>) {
  const tree = CustomerReservationCard({ reservation, facilityName: 'TEST', unitTypeName: 'TEST',
    onVerify: () => {}, onCancel: () => {}, onRefresh: refresh })
  function find(value: unknown): (() => void) | undefined {
    if (Array.isArray(value)) { for (const child of value) { const result = find(child); if (result) return result } }
    if (!value || typeof value !== 'object') return undefined
    const props = (value as ReactElement<{ children?: unknown; onClick?: () => void }>).props
    if (props?.children === 'Xác nhận đã nhận kho') return props.onClick
    return find(props?.children)
  }
  const click = find(tree); if (!click) throw new Error('Receipt command is missing'); return click
}
beforeEach(() => { state.confirm.mockReset(); state.messages = [] })
describe('merged Customer receipt command', () => {
  it('locks same-render duplicate clicks and refreshes actual BE state after success', async () => {
    let resolve!: (value: unknown) => void
    state.confirm.mockReturnValue(new Promise(done => { resolve = done }))
    const refresh = vi.fn().mockResolvedValue(undefined); const click = command(refresh)
    click(); click(); expect(state.confirm).toHaveBeenCalledTimes(1)
    expect(state.confirm).toHaveBeenCalledWith(reservation.id)
    resolve({}); await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(state.messages.at(-1)).toBe(false))
  })
  it('keeps rejection visible, refreshes state and allows retry only after failure finishes', async () => {
    state.confirm.mockRejectedValueOnce(new Error('Receipt conflict')).mockResolvedValue({})
    const refresh = vi.fn().mockResolvedValue(undefined); const click = command(refresh)
    click(); await vi.waitFor(() => expect(state.messages).toContain('Receipt conflict'))
    await vi.waitFor(() => expect(state.messages.at(-1)).toBe(false))
    expect(refresh).toHaveBeenCalledTimes(1)
    click(); await vi.waitFor(() => expect(state.confirm).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
  })
})
