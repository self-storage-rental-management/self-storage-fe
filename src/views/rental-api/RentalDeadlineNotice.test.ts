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
})
