import { expect, it } from 'vitest'
import { canOpenInventory } from './inventoryAccess'

it('keeps inventory locked until customer receipt confirmation', () => {
  for (const status of [null, undefined, 'scheduled', 'identity_verified', 'contract_signed', 'payment_collected', 'handover_pending_receipt', 'no_show', 'rejected']) {
    expect(canOpenInventory(status)).toBe(false)
  }
})

it('requires customer readiness and a confirmed inventory appointment', () => {
  expect(canOpenInventory('setup_in_progress', '2026-11-24T08:00:00Z')).toBe(false)
  expect(canOpenInventory('setup_completed')).toBe(false)
  expect(canOpenInventory('setup_completed', 'invalid')).toBe(false)
  expect(canOpenInventory('setup_completed', '2026-11-24T08:00:00Z')).toBe(true)
  expect(canOpenInventory('completed')).toBe(true)
})
