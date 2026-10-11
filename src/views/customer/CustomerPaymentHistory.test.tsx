import { describe, expect, it } from 'vitest'
import { paymentHistoryTimestamp } from './CustomerPaymentHistory'
import { renderToStaticMarkup } from 'react-dom/server'
import ReservationReceipt from './ReservationReceipt'
import { bookingDepositAccepted, paymentRecordLabel } from './paymentPresentation'
import type { ReservationPaymentResult, ReservationStatus } from '../../services/customerReservationApi'

const paid: ReservationPaymentResult = {
  paymentId: 'payment-test', reservationId: 'reservation-test', transactionReference: 'intent-test',
  gatewayTransactionNo: 'transaction-test', amount: 600000, currency: 'VND', refundedAmount: 0,
  paymentStatus: 'PAID', reservationStatus: 'CONFIRMED', responseCode: '00', transactionStatus: '00',
  gatewayPayDate: '20261011080000', message: '', processedAt: '2026-10-11T01:00:00Z', lastReconciledAt: null,
}

describe('Booking acceptance uses Payment and Reservation response fields', () => {
  it.each(['CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'COMPLETED'] as ReservationStatus[])(
    'keeps an accepted %s reservation as a Booking deposit', reservationStatus => {
      expect(bookingDepositAccepted({ ...paid, reservationStatus })).toBe(true)
    },
  )
  it.each(['AWAITING_PAYMENT', 'PAYMENT_GRACE', 'PAYMENT_REVIEW', 'EXPIRED', 'CANCELLED', 'REJECTED'] as ReservationStatus[])(
    'does not call PAID with %s a confirmed Booking deposit', reservationStatus => {
      const payment = { ...paid, reservationStatus }
      expect(bookingDepositAccepted(payment)).toBe(false)
      expect(paymentRecordLabel(payment)).toContain('Giao dịch đã ghi nhận')
      const html = renderToStaticMarkup(<ReservationReceipt payment={payment} reservationCode="RSV-TEST" />)
      expect(html).toContain('Chi tiết giao dịch cần đối soát')
      expect(html).toContain('Đơn chưa xác nhận')
      expect(html).not.toContain('Biên lai cọc giữ chỗ')
      expect(html).not.toContain('Đơn đã xác nhận cọc')
    },
  )
  it('does not treat a failed transaction with a confirmed Reservation as paid', () => {
    const payment = { ...paid, paymentStatus: 'FAILED' }
    expect(bookingDepositAccepted(payment)).toBe(false)
    expect(paymentRecordLabel(payment)).toBe('Thanh toán thất bại')
  })
})

describe('VNPay history nullable processing timestamp', () => {
  it('never invents an epoch date for pending transactions', () => {
    expect(paymentHistoryTimestamp(null)).toBe('Chưa ghi nhận')
    expect(paymentHistoryTimestamp('invalid')).toBe('Chưa ghi nhận')
  })
  it('uses the actual processing timestamp when available', () => {
    const value = '2026-10-11T01:00:00Z'
    expect(paymentHistoryTimestamp(value)).toBe(new Date(value).toLocaleString('vi-VN'))
  })
})
