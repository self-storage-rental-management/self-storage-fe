import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerReservationCard from './CustomerReservationCard'
import { paymentCountdown, reservationProgress } from './reservationPresentation'
import ReservationReceipt from './ReservationReceipt'
import type { CustomerReservation, ReservationPaymentResult, ReservationStatus } from '../../services/customerReservationApi'

const base: CustomerReservation = {
  id: 'reservation-1', reservationCode: 'RSV-TEST', quoteId: 'quote-1', facilityId: 'facility-1', unitTypeId: 'type-1',
  status: 'AWAITING_EMAIL', goodsReviewStatus: 'NOT_REQUIRED', compatibilityResult: 'COMPATIBLE',
  startDate: '2026-11-01', endDate: '2027-02-01', totalRentalAmount: 3000000,
  reservationDepositAmount: 600000, securityDepositAmount: 1000000, remainingRentalAmount: 2400000,
  dueAtCheckIn: 3400000, totalInitialObligation: 4000000, totalGoodsVolumeM3: 0.1,
  totalGoodsWeightKg: 10, holdExpiresAt: '2026-11-01T10:00:00Z', createdAt: '2026-11-01T09:50:00Z',
}
function render(status: ReservationStatus) {
  return renderToStaticMarkup(<CustomerReservationCard reservation={{ ...base, status }} facilityName="Kho HCM" unitTypeName="Kho nhỏ"
    onVerify={() => {}} onCancel={() => {}} onRefresh={async () => {}} />)
}
describe('customer reservation layout regression', () => {
  it('counts down against the backend deadline and blocks expired or invalid deadlines', () => {
    const deadline = '2026-11-01T10:00:00Z'
    const timestamp = Date.parse(deadline)
    expect(paymentCountdown(deadline, timestamp - 600_000)).toEqual({ text: '10:00', expired: false })
    expect(paymentCountdown(deadline, timestamp - 599_000).text).toBe('09:59')
    expect(paymentCountdown(deadline, timestamp + 1)).toEqual({ text: '00:00', expired: true })
    expect(paymentCountdown('invalid', timestamp).expired).toBe(true)
  })

  it('renders a receipt only for a recorded PAID payment', () => {
    const payment: ReservationPaymentResult = { paymentId: 'transaction-1', reservationId: base.id,
    amount: 6402000, currency: 'VND', outcome: 'SUCCESS', paymentStatus: 'PAID',
      reservationStatus: 'CONFIRMED', message: '', processedAt: '2026-11-01T09:55:00Z' }
    const html = renderToStaticMarkup(<ReservationReceipt payment={payment} reservationCode={base.reservationCode} />)
    for (const text of ['Biên lai cọc giữ chỗ', 'transaction-1', 'RSV-TEST', 'Ngày giờ ghi nhận', 'Đã thanh toán']) expect(html).toContain(text)
    expect(html).toContain('6.402.000 ₫')
    expect(html).not.toContain('166.452.000.000')
    for (const outcome of ['FAILED', 'NOT_RECEIVED'] as const) {
      const failedHtml = renderToStaticMarkup(<ReservationReceipt payment={{ ...payment, outcome, paymentStatus: outcome }} reservationCode={base.reservationCode} />)
      expect(failedHtml).toContain('chưa có biên lai thanh toán')
      expect(failedHtml).not.toContain('Đã thanh toán')
    }
  })

  it('shows countdown rather than only the expiry date', () => {
    const html = render('AWAITING_PAYMENT')
    expect(html).toContain('role="timer"')
    expect(html).toContain('Thời gian thanh toán cọc còn lại')
    expect(html).not.toContain('Thanh toán mô phỏng')
  })
  it('restores the amber card, financial breakdown and six-step progress for real reservations', () => {
    const html = render('AWAITING_EMAIL')
    for (const text of ['border-l-amber-500', 'RSV-TEST', 'Kho HCM', 'Tiền thuê và cọc giữ chỗ', 'Khoản thu khi nhận kho', 'Tiến trình đơn đặt kho', 'quản lý phân kho', 'Nhận kho và ký', 'Đã bàn giao', 'Xác minh email']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('aria-current="step"')
    expect(html).not.toContain('Chưa có đơn')
  })
  it('opens payment only for backend AWAITING_PAYMENT, not for email/review/confirmed', () => {
    expect(render('AWAITING_PAYMENT')).toContain('>Thanh toán cọc</button>')
    for (const status of ['AWAITING_EMAIL', 'AWAITING_REVIEW', 'CONFIRMED', 'EXPIRED'] as const) {
      expect(render(status)).not.toContain('>Thanh toán cọc</button>')
    }
  })
  it.each([
    ['AWAITING_EMAIL', 0], ['AWAITING_REVIEW', 1], ['AWAITING_PAYMENT', 2],
    ['PAYMENT_GRACE', 2], ['PAYMENT_REVIEW', 2], ['CONFIRMED', 3],
    ['UNIT_RESERVED', 4], ['READY_FOR_CHECKIN', 4], ['AWAITING_CUSTOMER_RECEIPT', 5],
    ['COMPLETED', 6], ['CANCELLED', null], ['EXPIRED', null], ['REJECTED', null],
  ] as const)('maps backend status %s to progress %s', (status, step) => {
    expect(reservationProgress(status)).toBe(step)
  })
})
