import { describe, expect, it } from 'vitest'
import { rentalDeadlineState, RentalDeadlineBanner } from './RentalDeadlineNotice'
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
    expect(html).toContain('bg-amber-50')
  })
  it('shows red financial notice after expiry without inventing amounts', () => {
    const html = renderToStaticMarkup(createElement(RentalDeadlineBanner, { rental: rental('2026-10-13'), role: 'customer', now }))
    expect(html).toContain('Hồ sơ đã quá hạn')
    expect(html).toContain('bg-red-50')
    expect(html).toContain('Chưa có dữ liệu xác thực')
  })
  it('has no warning for a contract far from expiry', () => {
    expect(renderToStaticMarkup(createElement(RentalDeadlineBanner, { rental: rental('2026-11-14'), role: 'customer', now }))).toBe('')
  })
})
