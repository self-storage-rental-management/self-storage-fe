import { describe, expect, it } from 'vitest'
import { PaymentHistoryDossier, paymentHistoryTimestamp, visibleCustomerPaymentWarnings } from './CustomerPaymentHistory'
import { formatHistoryPaymentMethod, paymentMethodLabel } from './paymentLabels'
import { renderToStaticMarkup } from 'react-dom/server'
import ReservationReceipt from './ReservationReceipt'
import { bookingDepositAccepted, paymentRecordLabel } from './paymentPresentation'
import type { ReservationPaymentResult, ReservationStatus } from '../../services/customerReservationApi'
import type { HistoryEntry } from '../../services/customerPaymentHistory'

const paid: ReservationPaymentResult = {
  paymentId: 'payment-test', reservationId: 'reservation-test', transactionReference: 'intent-test',
  gatewayTransactionNo: 'transaction-test', amount: 600000, currency: 'VND', refundedAmount: 0,
  paymentStatus: 'PAID', reservationStatus: 'CONFIRMED', responseCode: '00', transactionStatus: '00',
  gatewayPayDate: '20261011080000', message: '', processedAt: '2026-10-11T01:00:00Z', lastReconciledAt: null,
}

describe('Số hóa đơn trên biên lai', () => {
  it.each([[null, 'Chưa cấp'], ['   ', 'Chưa cấp'], ['INV-OLD-123', 'INV-OLD-123']])(
    'shows the persisted invoice or its missing state for %s', (invoiceNumber, label) => {
      const html = renderToStaticMarkup(<ReservationReceipt payment={{ ...paid, invoiceNumber }} reservationCode="RSV-TEST" />)
      expect(html).toContain(`>${label}</dd>`)
      expect(html).toContain('>transaction-test</dd>')
      expect(html).toContain('>RSV-TEST</dd>')
    },
  )
})

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
      expect(paymentRecordLabel(payment)).toBe('Thanh toán thành công')
      const html = renderToStaticMarkup(<ReservationReceipt payment={payment} reservationCode="RSV-TEST" />)
      expect(html).toContain('Chi tiết giao dịch cần đối soát')
      expect(html).toContain('Đơn chưa xác nhận')
      expect(html).not.toContain('Biên lai đặt cọc giữ chỗ')
      expect(html).not.toContain('Đơn đã xác nhận cọc')
    },
  )
  it('does not treat a failed transaction with a confirmed Reservation as paid', () => {
    const payment: ReservationPaymentResult = { ...paid, paymentStatus: 'FAILED' }
    expect(bookingDepositAccepted(payment)).toBe(false)
    expect(paymentRecordLabel(payment)).toBe('Thanh toán thất bại')
  })
})

describe('customer payment warning presentation', () => {
  it('hides the obsolete reservation-history warning but keeps other warnings', () => {
    expect(visibleCustomerPaymentWarnings([
      'Chưa tải được đầy đủ lịch sử thanh toán đơn giữ kho.',
      'Chưa tải được đầy đủ danh sách gia hạn.',
    ])).toEqual(['Chưa tải được đầy đủ danh sách gia hạn.'])
  })
})

describe('renewal dossier identity in payment history', () => {
  it('shows the rental dossier and occurrence without exposing the unit code or renewal UUID', () => {
    const entry = {
      id: 'payment', reference: 'SH-184033 · Gia hạn lần 2', category: 'renewal', amount: 5500000,
      currency: 'VND', timestamp: null, status: 'SUCCEEDED', method: 'VNPay', renewalId: 'renewal-uuid',
      rentalId: 'rental-uuid', unitCode: 'HCM-Q1-F01-M-001', facilityName: 'Kho Việt – Cơ sở Quận 1',
    } satisfies HistoryEntry
    const html = renderToStaticMarkup(<PaymentHistoryDossier entry={entry} onOpenRentals={() => undefined} />)

    expect(html).toContain('SH-184033 · Gia hạn lần 2')
    expect(html).not.toContain('HCM-Q1-F01-M-001')
    expect(html).not.toContain('renewal-uuid')
    expect(html).not.toContain('Kho Việt')
  })
})

describe('VNPay history nullable processing timestamp', () => {
  it('keeps missing payment metadata unknown for a deposit from the older payment API', () => {
    const html = renderToStaticMarkup(<ReservationReceipt payment={paid} reservationCode="RSV-TEST" />)
    expect(html).toContain('Phương thức thanh toán')
    expect(html).not.toContain('Hệ thống tự động qua VNPay')
    expect(html).not.toContain('>VNPay<')
    expect(html).toMatch(/Phương thức thanh toán<\/dt><dd[^>]*>Chưa có thông tin<\/dd>/)
    expect(html).toMatch(/Người ghi nhận<\/dt><dd[^>]*>-<\/dd>/)
  })
  it('shows a consistent Vietnamese method for a bank returned by VNPay', () => {
    const html = renderToStaticMarkup(<ReservationReceipt payment={{ ...paid, paymentMethod: 'NCB' }} reservationCode="RSV-TEST" />)
    expect(html).toContain('>Thanh toán trực tuyến<')
    expect(html).not.toContain('>NCB<')
  })
  it('keeps the counter payment method and employee on the remaining rental receipt', () => {
    const html = renderToStaticMarkup(<ReservationReceipt payment={{ ...paid, purpose: 'RENTAL_BALANCE', paymentMethod: 'Tiền mặt', initiatedByName: 'Nhân viên cơ sở' }} reservationCode="RSV-TEST" />)
    expect(html).toContain('Tiền mặt')
    expect(html).toContain('Nhân viên cơ sở')
    expect(html).not.toContain('Hệ thống tự động qua VNPay')
  })
  it('never invents an epoch date for pending transactions', () => {
    expect(paymentHistoryTimestamp(null)).toBe('Chưa ghi nhận')
    expect(paymentHistoryTimestamp('invalid')).toBe('Chưa ghi nhận')
  })
})

describe('standardized payment method labels in payment history', () => {
  it.each([
    ['CASH', 'Tiền mặt'],
    ['Tiền mặt', 'Tiền mặt'],
    ['Tiền mặt tại cơ sở', 'Tiền mặt'],
    ['Tiền mặt tại quầy', 'Tiền mặt'],
    ['TIEN_MAT', 'Tiền mặt'],
    ['NCB', 'VNPay'],
    ['VNPAY', 'VNPay'],
    ['VNPay', 'VNPay'],
    ['VNPAY_SANDBOX', 'VNPay'],
    ['ONLINE_GATEWAY', 'VNPay'],
    ['BANK_TRANSFER', 'Chuyển khoản'],
    ['CHUYEN_KHOAN', 'Chuyển khoản'],
    ['Chuyển khoản', 'Chuyển khoản'],
    ['DEPOSIT_OFFSET', 'Đối trừ quyết toán'],
    ['Đối trừ quyết toán', 'Đối trừ quyết toán'],
    [null, '-'],
    [undefined, '-'],
    ['', '-'],
    ['Chưa có', '-'],
    ['Chưa có thông tin', '-'],
  ])('formats %s to %s', (input, expected) => {
    expect(formatHistoryPaymentMethod(input)).toBe(expected)
  })

  it('standardizes paymentMethodLabel for common aliases', () => {
    expect(paymentMethodLabel('CASH')).toBe('Tiền mặt')
    expect(paymentMethodLabel('Tiền mặt tại cơ sở')).toBe('Tiền mặt')
    expect(paymentMethodLabel('BANK_TRANSFER')).toBe('Chuyển khoản')
    expect(paymentMethodLabel('VNPAY')).toBe('Thanh toán trực tuyến')
    expect(paymentMethodLabel(null)).toBe('Chưa có thông tin')
  })
})
