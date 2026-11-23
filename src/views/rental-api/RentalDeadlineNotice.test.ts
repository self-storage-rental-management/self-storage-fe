import { describe, expect, it } from 'vitest'
import { rentalDeadlineState, RentalDeadlineBanner, getRentalRenewalEligibility } from './RentalDeadlineNotice'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RentalApiRecord } from '../../types/rentalApi'
describe('rental deadline notices', () => {
  const rental = (date: string, status = 'active') => ({ contractEndDate: date, status } as RentalApiRecord)
  const now = new Date('2026-10-14T05:00:00Z')
  it('distinguishes overdue from upcoming and normal rentals', () => {
    expect(rentalDeadlineState(rental('2026-10-13'), now)).toBe('overdue')
    expect(rentalDeadlineState(rental('2026-10-14'), now)).toBe('upcoming')
    expect(rentalDeadlineState(rental('2026-10-21'), now)).toBe('upcoming')
    expect(rentalDeadlineState(rental('2026-10-22'), now)).toBe(null)
    expect(rentalDeadlineState(rental('2026-10-01', 'completed'), now)).toBe(null)
  })
  it('shows a yellow warning seven days before expiry', () => {
    const html = renderToStaticMarkup(createElement(RentalDeadlineBanner, { rental: rental('2026-10-21'), role: 'customer', now }))
    expect(html).toContain('Hồ sơ sắp hết hạn')
    expect(html).toContain('bg-amber-200')
    expect(html).toContain('Còn 7 ngày đến hết hạn')
    expect(html).toContain('Gia hạn chỉ thành công khi bạn đến cơ sở ký hợp đồng gia hạn')
  })
  it('shows an orange financial notice before day eight without inventing amounts', () => {
    const html = renderToStaticMarkup(createElement(RentalDeadlineBanner, { rental: rental('2026-10-13'), role: 'customer', now }))
    expect(html).toContain('Hồ sơ đã quá hạn')
    expect(html).toContain('bg-orange-700')
    expect(html).not.toContain('bg-red-800')
    expect(html).toContain('text-white')
    expect(html).not.toContain('sử dụng - hạn')
    expect(html).toContain('Gia hạn chỉ thành công khi bạn đến cơ sở ký hợp đồng gia hạn')
    expect(html).toContain('Chỉ thanh toán tiền thuê gia hạn trả trước chưa được tính là gia hạn thành công')
    expect(html).not.toContain('Chưa có dữ liệu xác thực')
    expect(html).toContain('Đã quá hạn 1 ngày')
    expect(html).toContain('Đang tải…')
  })
  it.each([
    ['2026-10-07', 'bg-orange-700', 'Đã quá hạn 7 ngày'],
    ['2026-10-06', 'bg-red-800', 'Đã quá hạn 8 ngày'],
    ['2026-10-05', 'bg-red-800', 'Đã quá hạn 9 ngày'],
  ])('uses the correct warning color for a contract ending %s', (date, color, message) => {
    const html = renderToStaticMarkup(createElement(RentalDeadlineBanner, { rental: rental(date), role: 'customer', now }))
    expect(html).toContain(color)
    expect(html).toContain(message)
  })
  it('has no warning for a contract far from expiry', () => {
    expect(renderToStaticMarkup(createElement(RentalDeadlineBanner, { rental: rental('2026-11-14'), role: 'customer', now }))).toBe('')
  })
  it('clearly labels the final permitted day', () => {
    const html = renderToStaticMarkup(createElement(RentalDeadlineBanner, { rental: rental('2026-10-14'), role: 'customer', now }))
    expect(html).toContain('Hết hạn hôm nay · còn 0 ngày')
  })

  describe('getRentalRenewalEligibility', () => {
    it('disables renewal button when contract has more than 7 days left', () => {
      // Contract ends in 10 days (2026-10-24, now is 2026-10-14)
      const res = getRentalRenewalEligibility({ id: 'r1', status: 'active', contractEndDate: '2026-10-24' }, [], now)
      expect(res.canRenew).toBe(false)
      expect(res.remainingDays).toBe(10)
      expect(res.reason).toBe('Chỉ có thể gia hạn khi hợp đồng còn 7 ngày trước ngày hết hạn.')
    })

    it('enables renewal button when contract has 7 days or less remaining', () => {
      // Exactly 7 days (2026-10-21)
      const res7 = getRentalRenewalEligibility({ id: 'r1', status: 'active', contractEndDate: '2026-10-21' }, [], now)
      expect(res7.canRenew).toBe(true)
      expect(res7.remainingDays).toBe(7)

      // 3 days (2026-10-17)
      const res3 = getRentalRenewalEligibility({ id: 'r1', status: 'active', contractEndDate: '2026-10-17' }, [], now)
      expect(res3.canRenew).toBe(true)
      expect(res3.remainingDays).toBe(3)

      // Today (2026-10-14)
      const res0 = getRentalRenewalEligibility({ id: 'r1', status: 'active', contractEndDate: '2026-10-14' }, [], now)
      expect(res0.canRenew).toBe(true)
      expect(res0.remainingDays).toBe(0)
    })

    it('disables renewal when contract status is not active', () => {
      const res = getRentalRenewalEligibility({ id: 'r1', status: 'setup', contractEndDate: '2026-10-16' }, [], now)
      expect(res.canRenew).toBe(false)
      expect(res.reason).toBe('Chỉ có thể gia hạn khi hợp đồng đang hoạt động.')
    })

    it('detects open renewal and disables duplicate renewal request', () => {
      const openRenewals = [{ rentalId: 'r1', status: 'pending' }]
      const res = getRentalRenewalEligibility(
        { id: 'r1', status: 'active', contractEndDate: '2026-10-16' },
        openRenewals,
        now
      )
      expect(res.canRenew).toBe(false)
      expect(res.hasOpenRenewal).toBe(true)
      expect(res.reason).toBe('Hợp đồng này đã có yêu cầu gia hạn đang được xử lý.')
    })

    it('ignores terminal renewal status (completed, rejected, cancelled, payment_expired)', () => {
      const closedRenewals = [
        { rentalId: 'r1', status: 'cancelled' },
        { rentalId: 'r1', status: 'rejected' },
        { rentalId: 'r1', status: 'completed' },
        { rentalId: 'r1', status: 'payment_expired' },
      ]
      const res = getRentalRenewalEligibility(
        { id: 'r1', status: 'active', contractEndDate: '2026-10-16' },
        closedRenewals,
        now
      )
      expect(res.canRenew).toBe(true)
      expect(res.hasOpenRenewal).toBe(false)
    })
  })
})
