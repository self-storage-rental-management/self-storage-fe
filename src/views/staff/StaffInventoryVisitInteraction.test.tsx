import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import StaffInventoryVisitPanel from './StaffInventoryVisitPanel'
import type { CheckInCase } from '../../services/checkInApi'

const state = vi.hoisted(() => ({ index: 0, values: [] as unknown[], arrival: vi.fn(), upload: vi.fn(), verify: vi.fn() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: () => [state.values[state.index++], vi.fn()],
  useRef: (value: unknown) => ({ current: value }),
}))
vi.mock('../../services/checkInApi', async original => ({
  ...await original<typeof import('../../services/checkInApi')>(),
  recordInventoryArrival: (...args: unknown[]) => state.arrival(...args),
  uploadCheckInEvidence: (...args: unknown[]) => state.upload(...args),
  verifyInventoryIdentity: (...args: unknown[]) => state.verify(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  state.index = 0
  state.values = ['P1234567', { name: 'customer.png' }, undefined, true, '']
})

function panel(arrived = false) {
  const item = { checkInId: 'checkin', checkInStatus: 'setup_completed', inventoryResolutionStatus: 'NOT_STARTED',
    inventoryFinalDeadlineAt: '2026-12-01T00:00:00Z', inventoryVisit: { appointmentAt: '2026-11-25T00:00:00Z',
      arrivedAt: arrived ? '2026-11-24T00:00:00Z' : null } } as CheckInCase
  const onSaved = vi.fn()
  state.arrival.mockResolvedValue({ ...item, inventoryVisit: { ...item.inventoryVisit, arrivedAt: '2026-11-24T00:00:00Z' } })
  state.upload.mockResolvedValue({ id: 'photo' })
  state.verify.mockResolvedValue({ ...item, inventoryVisit: { ...item.inventoryVisit, identityVerifiedAt: '2026-11-24T00:00:01Z' } })
  const tree = StaffInventoryVisitPanel({ item, now: Date.parse('2026-11-24T00:00:00Z'), busy: false,
    onBusyChange: vi.fn(), onSaved, onPreview: vi.fn() })
  function find(node: unknown): (() => void) | undefined {
    if (Array.isArray(node)) { for (const child of node) { const match = find(child); if (match) return match } }
    if (!node || typeof node !== 'object') return
    const props = (node as ReactElement<{ children?: unknown; onClick?: () => void }>).props
    return props?.onClick ?? find(props?.children)
  }
  return { click: find(tree)!, onSaved }
}

it('records arrival before uploading and verifying from the initially visible identity form', async () => {
  const { click, onSaved } = panel()
  click()
  await vi.waitFor(() => expect(state.verify).toHaveBeenCalledWith('checkin', {
    identityDocumentNumber: 'P1234567', photoId: 'photo', bookingCustomerPresent: true,
  }))
  expect(state.arrival.mock.invocationCallOrder[0]).toBeLessThan(state.upload.mock.invocationCallOrder[0])
  expect(state.upload.mock.invocationCallOrder[0]).toBeLessThan(state.verify.mock.invocationCallOrder[0])
  expect(onSaved).toHaveBeenCalledTimes(2)
})

it('does not record arrival again for a customer already marked present', async () => {
  panel(true).click()
  await vi.waitFor(() => expect(state.verify).toHaveBeenCalled())
  expect(state.arrival).not.toHaveBeenCalled()
})

it('stops before upload and identity verification if arrival cannot be recorded', async () => {
  const { click } = panel()
  state.arrival.mockRejectedValue(new Error('Không thể ghi nhận khách đến.'))
  click()
  await vi.waitFor(() => expect(state.arrival).toHaveBeenCalled())
  expect(state.upload).not.toHaveBeenCalled()
  expect(state.verify).not.toHaveBeenCalled()
})
