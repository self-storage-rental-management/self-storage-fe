import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import type { ReservationQuote } from '../../services/customerReservationApi'

const quote: ReservationQuote = {
  quoteId: 'q1', facilityId: 'f1', unitTypeId: 'u1', startDate: '2026-10-07', endDate: '2027-01-07',
  rentalMonths: 3, monthlyPrice: 5500000, subtotal: 16500000, discountRate: 0.03, discountAmount: 495000,
  totalAfterDiscount: 16005000, reservationDepositAmount: 4301000, remainingRentalAmount: 11704000,
  securityDepositAmount: 5500000, dueAtCheckIn: 17204000, totalInitialObligation: 21505000,
  setupEarlyExitPolicyVersion: 'SETUP_EARLY_EXIT_ONE_MONTH_V1', setupEarlyExitFee: 5500000,
  policyVersion: 'v1', quotedAt: '2026-10-05T00:00:00Z', expiresAt: '2026-10-05T00:10:00Z',
}
describe('authoritative backend pricing', () => {
  it('renders all snapshot amounts in VND with the actual 20% deposit', () => {
    const html = renderToStaticMarkup(<ReservationQuoteSummary quote={quote} needsReview={false} />)
    for (const amount of ['5.500.000 ₫', '16.500.000 ₫', '495.000 ₫', '4.301.000 ₫', '17.204.000 ₫', '21.505.000 ₫']) expect(html).toContain(amount)
    expect(html).toContain('Phí giữ chỗ (20%)')
    expect(html).toContain('Tiền cọc đảm bảo kho')
    expect(html).not.toContain('40%')
    expect(html).not.toContain('166.452.000.000')
  })
  it('requires OTP and staff approval for OTHER without opening payment early', () => {
    const html = renderToStaticMarkup(<ReservationQuoteSummary quote={quote} needsReview />)
    expect(html).toContain('xác minh OTP')
    expect(html).toContain('nhân viên cơ sở duyệt')
    expect(html).toContain('Chưa thu cọc')
  })
  it('renders custom deposit rate configured by BO (e.g. 15%)', () => {
    const customQuote: ReservationQuote = {
      ...quote,
      reservationDepositAmount: 3225750,
      remainingRentalAmount: 13604250,
      reservationDepositRate: 0.15,
    }
    const html = renderToStaticMarkup(<ReservationQuoteSummary quote={customQuote} needsReview={false} />)
    expect(html).toContain('Phí giữ chỗ (15%)')
    expect(html).toContain('3.225.750 ₫')
    expect(html).toContain('15% × tổng tiền')
  })
  it.each(['quote', 'reservation'] as const)('shows the accepted early-exit fee in %s without charging it at booking', context => {
    const html = renderToStaticMarkup(<ReservationQuoteSummary quote={quote} needsReview={false} context={context} />)
    expect(html).not.toContain('Trả kho sớm trong setup')
    expect(html).not.toContain('một tháng đơn giá đã chốt')
    expect(html).toContain('21.505.000')
    expect(html).not.toContain('27.005.000')
  })
  it('does not invent an early-exit fee for historical quotes without accepted terms', () => {
    const html = renderToStaticMarkup(<ReservationQuoteSummary quote={{ ...quote, setupEarlyExitPolicyVersion: null, setupEarlyExitFee: null }} needsReview={false} context="reservation" />)
    expect(html).not.toContain('chưa có điều khoản')
    expect(html).not.toContain('phí chấm dứt sớm một lần')
  })

})

describe('deposit including security deposit', () => { it('charges 20 percent of 38 million and leaves 30.4 million at check-in', () => {
const html = renderToStaticMarkup(<ReservationQuoteSummary quote={{ ...quote, monthlyPrice: 9500000, subtotal: 28500000, discountRate: 0, discountAmount: 0, totalAfterDiscount: 28500000, securityDepositAmount: 9500000, totalInitialObligation: 38000000, reservationDepositAmount: 7600000, dueAtCheckIn: 30400000 }} needsReview={false} />)
expect(html).toContain('20% × tổng tiền')
expect(html).toContain('7.600.000 ₫')
expect(html).toContain('30.400.000 ₫')
}) })

it('keeps the discounted total inclusive of security deposit', () => {
const html = renderToStaticMarkup(<ReservationQuoteSummary quote={{ ...quote, monthlyPrice: 9500000, rentalMonths: 6, subtotal: 57000000, discountRate: 0.05, discountAmount: 2850000, totalAfterDiscount: 54150000, securityDepositAmount: 9500000, totalInitialObligation: 63650000, reservationDepositAmount: 12730000, dueAtCheckIn: 50920000 }} needsReview={false} />)
expect(html).toContain('66.500.000 ₫')
expect(html).toContain('63.650.000 ₫')
expect(html).toContain('12.730.000 ₫')
expect(html).toContain('50.920.000 ₫')
expect(html).toContain('Phí giữ chỗ (20%)')
expect(html).not.toContain('54.150.000 ₫')
})
