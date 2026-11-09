import { describe, expect, it } from 'vitest'
import { formatCustomerDate, formatCustomerDateTime } from './customerDate'
describe('customer Vietnamese dates', () => {
  it.each(['2026-01-05', '5/1/2026'])('pads day and month with a four digit year for %s', value => {
    expect(formatCustomerDate(value)).toBe('05/01/2026')
  })
  it('uses the Vietnamese calendar date across UTC midnight', () => {
    expect(formatCustomerDate('2026-10-30T18:00:00Z')).toBe('31/10/2026')
    expect(formatCustomerDateTime('2026-10-30T18:00:00Z')).toBe('31/10/2026 01:00:00')
  })
  it('does not display invalid dates', () => {
    expect(formatCustomerDate('invalid')).toBe('Chưa có')
  })
})
