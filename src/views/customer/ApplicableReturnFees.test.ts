import { describe, expect, it } from 'vitest'
import { isUsableApplicableSchedule } from './ApplicableReturnFees'

describe('applicable return fee schedule validation', () => {
  const valid = { revision: 1, prices: { clean: 0, minor: 100000 }, details: { minor: { label: 'Vệ sinh', trigger: 'Bụi', applies: 'Trả kho' } } }
  it('accepts a historical schedule including zero prices and missing descriptions', () => {
    expect(isUsableApplicableSchedule(valid)).toBe(true)
  })
  it('accepts the legacy baseline with revision zero and no publication date', () => {
    expect(isUsableApplicableSchedule({ ...valid, revision: 0, publishedAt: null })).toBe(true)
  })
  it('rejects malformed data instead of presenting it as a schedule', () => {
    expect(isUsableApplicableSchedule({ ...valid, revision: -1 })).toBe(false)
    expect(isUsableApplicableSchedule({ ...valid, prices: { clean: -1 } })).toBe(false)
    expect(isUsableApplicableSchedule({ ...valid, prices: [] })).toBe(false)
    expect(isUsableApplicableSchedule({ ...valid, details: { minor: { label: {} } } })).toBe(false)
  })
})
