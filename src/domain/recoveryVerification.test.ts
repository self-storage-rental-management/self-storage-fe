import { describe, expect, it } from 'vitest'
import { canHandOverRecovery } from './recoveryVerification'

describe('recovery handover permission', () => {
  const arrivedAt = '2026-11-27T13:20:00Z'
  const entry = {
    arrivedAt, verifiedAt: '2026-11-27T13:21:00Z',
    verification: { used: 1, limit: 2, remaining: 1, matched: true, canReceiveItems: true, message: 'Đã xác minh' },
  }
  it('only offers direct handover within the verified thirty-minute arrival session', () => {
    expect(canHandOverRecovery(entry, Date.parse(arrivedAt) + 29 * 60 * 1000)).toBe(true)
    expect(canHandOverRecovery(entry, Date.parse(arrivedAt) + 30 * 60 * 1000)).toBe(false)
  })
  it('keeps unverified or exhausted attempts restricted to storage even with a recorded arrival', () => {
    const now = Date.parse(arrivedAt) + 2 * 60 * 1000
    expect(canHandOverRecovery({ ...entry, verifiedAt: null }, now)).toBe(false)
    expect(canHandOverRecovery({ ...entry, verification: { ...entry.verification, used: 2, remaining: 0, matched: false, canReceiveItems: false } }, now)).toBe(false)
    expect(canHandOverRecovery({ ...entry, verification: null }, now)).toBe(false)
  })
})
