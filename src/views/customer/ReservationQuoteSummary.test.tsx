import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import type { ReservationQuote } from '../../services/customerReservationApi'

const quote: ReservationQuote = {
  quoteId: 'q1', facilityId: 'f1', unitTypeId: 'u1', startDate: '2026-10-07', endDate: '2027-01-07',
  rentalMonths: 3, monthlyPrice: 5500000, subtotal: 16500000, discountRate: 0.03, discountAmount: 495000,
  totalAfterDiscount: 16005000, reservationDepositAmount: 6402000, remainingRentalAmount: 9603000,
  securityDepositAmount: 5500000, dueAtCheckIn: 15103000, totalInitialObligation: 21505000,
  policyVersion: 'v1', quotedAt: '2026-10-05T00:00:00Z', expiresAt: '2026-10-05T00:10:00Z',
}
describe('authoritative backend pricing', () => {
  it('renders all snapshot amounts in VND with the actual 40% deposit', () => {
    const html = renderToStaticMarkup(<ReservationQuoteSummary quote={quote} needsReview={false} />)
    for (const amount of ['5.500.000 ₫', '16.500.000 ₫', '495.000 ₫', '16.005.000 ₫', '6.402.000 ₫', '9.603.000 ₫', '15.103.000 ₫', '21.505.000 ₫']) expect(html).toContain(amount)
    expect(html).toContain('Cọc giữ chỗ (40%)')
    expect(html).not.toContain('20%')
    expect(html).not.toContain('166.452.000.000')
  })
  it('requires OTP and staff approval for OTHER without opening payment early', () => {
    const html = renderToStaticMarkup(<ReservationQuoteSummary quote={quote} needsReview />)
    expect(html).toContain('xác minh OTP')
    expect(html).toContain('nhân viên cơ sở duyệt')
    expect(html).toContain('Chưa thu cọc')
  })
})
