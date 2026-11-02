import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import StaffFeeField from '../views/staff/StaffFeeField'
import { normalizeManagerMoney, formatManagerMoney } from '../views/manager/managerList'
import { returnScreenRecord } from '../services/returnScreenAdapter'
import type { ApiReturn } from '../services/returnApi'
import { OVERDUE, UNIT_SPECS } from '../data/demoDatabase'

describe('VND money across demo and role boundaries', () => {
  it.each([25, 1000, 5500000, 63650000])('preserves %s without guessing currency from its magnitude', value => {
    expect(normalizeManagerMoney(value)).toBe(value)
    expect(formatManagerMoney(value)).toBe(`${value.toLocaleString('vi-VN')} ₫`)
    const adapted = returnScreenRecord({ depositAmount: value, netRefundAmount: value,
      damageFee: value, cleaningFee: value, lostItemFee: value, overdueFee: value,
      outstandingFee: value, amountDueFromCustomer: value } as ApiReturn)
    expect(adapted.depositAmount).toBe(value)
    expect(adapted.netRefundAmount).toBe(value)
    expect(adapted.damageFee).toBe(value)
  })
  it('keeps the staff fee input and displayed total in VND', () => {
    const html = renderToStaticMarkup(<StaffFeeField label="Vệ sinh" hint="Phí" value="5500000" disabled={false} onChange={() => {}} onDetailChange={() => {}} />)
    expect(html).toContain('value="5500000"')
    expect(html).toContain('5.500.000 ₫')
    expect(html).not.toContain('143.000.000.000')
  })
  it('seeds both warehouse pricing and overdue accounts directly in VND', () => {
    expect(UNIT_SPECS.S.priceMonthly).toBe(5500000)
    expect(OVERDUE[0].amount).toBe(2314000)
    expect(OVERDUE[0].lateFee).toBe(650000)
  })
})
