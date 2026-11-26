import { describe, expect, it } from 'vitest'
import { recoveryPickupBounds, recoveryPickupError } from './recoveryPickup'

const now = Date.parse('2026-11-27T03:12:45Z')
const deadline = '2026-12-03T16:05:27Z'

describe('temporary goods pickup window', () => {
  it('bounds the picker in Vietnam time, including the exact last day and minute', () => {
    expect(recoveryPickupBounds(deadline, now)).toEqual({
      min: '2026-11-27T10:13', max: '2026-12-03T23:05', available: true,
    })
    expect(recoveryPickupError('2026-12-03T23:05', deadline, now)).toBeNull()
    expect(recoveryPickupError('2026-12-03T23:06', deadline, now)).toContain('vượt quá hạn')
    expect(recoveryPickupError('2026-12-04T00:00', deadline, now)).toContain('vượt quá hạn')
  })
  it('rejects past times, invalid input and a missing deadline', () => {
    expect(recoveryPickupError('2026-11-27T10:12', deadline, now)).toContain('quá khứ')
    expect(recoveryPickupError('invalid', deadline, now)).toContain('không hợp lệ')
    expect(recoveryPickupError('', deadline, now)).toContain('chọn ngày và giờ')
    expect(recoveryPickupError('2026-11-28T10:00', null, now)).toContain('Chưa có hạn')
  })
  it('closes an open scheduling form when its deadline passes', () => {
    const expired = Date.parse(deadline)
    expect(recoveryPickupBounds(deadline, expired).available).toBe(false)
    expect(recoveryPickupError('2026-12-03T23:05', deadline, expired)).toContain('Đã hết thời gian')
  })
  it('does not offer a minute outside the remaining window across midnight', () => {
    expect(recoveryPickupBounds('2026-11-27T17:00:10Z', Date.parse('2026-11-27T16:59:45Z')))
      .toEqual({ min: '2026-11-28T00:00', max: '2026-11-28T00:00', available: true })
  })
})
