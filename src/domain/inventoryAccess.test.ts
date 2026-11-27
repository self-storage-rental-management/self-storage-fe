import { expect, it } from 'vitest'
import { canOpenInventory, canAccessInventory, inventoryInspectionBlockReason, isCheckInRecoveryTransferred } from './inventoryAccess'

it('keeps inventory locked until customer receipt confirmation', () => {
  for (const status of [null, undefined, 'scheduled', 'identity_verified', 'contract_signed', 'payment_collected', 'handover_pending_receipt', 'no_show', 'rejected']) {
    expect(canOpenInventory(status)).toBe(false)
  }
})

const completion = Date.parse('2026-11-26T12:20:00Z')
const pending = {
  checkInStatus: 'setup_completed', inventoryResolutionStatus: 'NOT_STARTED',
  inventoryFinalDeadlineAt: '2026-11-28T13:20:00Z',
  inventoryVisit: { access: { completionDeadlineAt: '2026-11-26T12:20:00Z', writable: true, blockedReason: null } },
}

it('locks unfinished inspection immediately after 72h even if the arrival deadline is still in the future', () => {
  expect(canAccessInventory(pending, completion + 1)).toBe(false)
  expect(inventoryInspectionBlockReason(pending, completion + 1)).toContain('72 giờ')
})

it('keeps the exact 72h boundary valid and locks a form that stays open beyond it', () => {
  expect(inventoryInspectionBlockReason(pending, completion - 1)).toBeNull()
  expect(inventoryInspectionBlockReason(pending, completion)).toBeNull()
  expect(inventoryInspectionBlockReason(pending, completion + 1)).toBeTruthy()
})

it('honors the server recovery lock without relying on the check-in status changing', () => {
  const item = { ...pending, inventoryVisit: { access: { ...pending.inventoryVisit.access,
    writable: false, blockedReason: 'Hồ sơ đã chuyển sang thu hồi.' } } }
  expect(canAccessInventory(item, completion - 1)).toBe(false)
})

it('uses the actual recovery transfer to lock even previously published inventory', () => {
  const item = { ...pending, checkInStatus: 'completed', inventoryResolutionStatus: 'ACCEPTED',
    inventoryVisit: { access: { ...pending.inventoryVisit.access, writable: false, recoveryTransferred: true } } }
  expect(isCheckInRecoveryTransferred(item)).toBe(true)
  expect(canAccessInventory(item, completion + 1)).toBe(false)
  expect(inventoryInspectionBlockReason(item, completion + 1)).toContain('đã chuyển sang thu hồi')
  expect(isCheckInRecoveryTransferred(pending)).toBe(false)
  expect(isCheckInRecoveryTransferred({ ...item, inventoryVisit: {
    access: { ...item.inventoryVisit.access, recoveryTransferred: false },
  } })).toBe(false)
})

it('does not confuse the elapsed arrival deadline with the 72h completion window', () => {
  expect(canAccessInventory({ ...pending, inventoryFinalDeadlineAt: '2026-11-24T00:00:00Z' }, completion - 1)).toBe(true)
})

it('preserves access to published reports while preventing their inspection data from being edited after the deadline', () => {
  const item = { ...pending, checkInStatus: 'completed', inventoryResolutionStatus: 'ACCEPTED' }
  expect(canAccessInventory(item, completion + 1)).toBe(true)
  expect(inventoryInspectionBlockReason(item, completion + 1)).toBeTruthy()
})

it('requires customer readiness and a confirmed inventory appointment', () => {
  expect(canOpenInventory('setup_in_progress', '2026-11-24T08:00:00Z')).toBe(true)
  expect(canOpenInventory('setup_in_progress')).toBe(true)
  expect(canOpenInventory('setup_completed')).toBe(true)
  expect(canOpenInventory('setup_completed', 'invalid')).toBe(true)
  expect(canOpenInventory('setup_completed', '2026-11-24T08:00:00Z')).toBe(true)
  expect(canOpenInventory('completed')).toBe(true)
})
