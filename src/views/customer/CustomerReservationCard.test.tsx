import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerReservationCard, { ReservationPreparationNotice } from './CustomerReservationCard'
import InventoryAppointmentPanel from './InventoryAppointmentPanel'
import { paymentCountdown, paymentCountdownUrgency, reservationProgress, reservationStatusLabels } from './reservationPresentation'
import ReservationReceipt from './ReservationReceipt'
import type { CustomerReservation, CustomerReservationDetail, ReservationPaymentResult, ReservationStatus } from '../../services/customerReservationApi'

beforeEach(() => { vi.useFakeTimers().setSystemTime(new Date('2026-11-01T09:55:00Z')) })
afterEach(() => { vi.useRealTimers() })

const base: CustomerReservation = {
  id: 'reservation-1', reservationCode: 'RSV-TEST', quoteId: 'quote-1', facilityId: 'facility-1', unitTypeId: 'type-1',
  pricingSnapshotStatus: 'COMPLETE', pricingPolicyVersion: 'v1', rentalMonths: 3, freeSetupDays: 3,
  monthlyPrice: 1000000, grossRentalAmount: 3000000, discountRate: 0, discountAmount: 0, voucherDiscountAmount: 0,
  pricingQuotedAt: '2026-11-01T09:50:00Z', pricingExpiresAt: '2026-11-01T10:00:00Z',
  status: 'AWAITING_EMAIL', goodsReviewStatus: 'NOT_REQUIRED', compatibilityResult: 'COMPATIBLE',
  startDate: '2026-11-01', endDate: '2027-02-01', totalRentalAmount: 3000000,
  reservationDepositAmount: 600000, securityDepositAmount: 1000000, remainingRentalAmount: 2400000,
  dueAtCheckIn: 3400000, totalInitialObligation: 4000000, totalGoodsVolumeM3: 0.1,
  totalGoodsWeightKg: 10, holdExpiresAt: '2026-11-01T10:00:00Z', createdAt: '2026-11-01T09:50:00Z',
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T09:50:00Z')) })
afterEach(() => { vi.useRealTimers() })
function render(status: ReservationStatus, overrides: Partial<CustomerReservation> = {}) {
  return renderToStaticMarkup(<CustomerReservationCard reservation={{ ...base, status, ...overrides }} facilityName="Kho HCM" unitTypeName="Kho nhỏ"
    onVerify={() => {}} onCancel={() => {}} onRefresh={async () => {}} />)
}
describe('customer reservation layout regression', () => {
  it('keeps the selected appointment visible while goods await review and after staff approval', () => {
    const appointmentAt = '2026-11-24T03:00:00Z'
    const waiting = render('AWAITING_REVIEW', { appointmentAt, goodsReviewStatus: 'PENDING' })
    const approved = render('AWAITING_PAYMENT', { appointmentAt, goodsReviewStatus: 'APPROVED' })
    for (const html of [waiting, approved]) {
      expect(html).toContain('24/11/2026')
      expect(html).toContain('10:00')
    }
    expect(waiting).toContain('tối đa 6 giờ')
    expect(waiting).not.toContain('>Thanh toán đặt cọc giữ chỗ</button>')
    expect(approved).toContain('Nhân viên cơ sở đã duyệt hàng hóa')
    expect(approved).toContain('>Thanh toán đặt cọc giữ chỗ</button>')
  })
  it('counts down against the backend deadline and blocks expired or invalid deadlines', () => {
    const deadline = '2026-11-01T10:00:00Z'
    const timestamp = Date.parse(deadline)
    expect(paymentCountdown(deadline, timestamp - 600_000)).toEqual({ text: '10:00', expired: false })
      expect(paymentCountdownUrgency(deadline, timestamp - 600_000)).toBe('normal')
    expect(paymentCountdown(deadline, timestamp - 599_000).text).toBe('09:59')
    expect(paymentCountdown(deadline, timestamp + 1)).toEqual({ text: '00:00', expired: true })
      expect(paymentCountdownUrgency(deadline, timestamp + 1)).toBe('danger')
    expect(paymentCountdown('invalid', timestamp).expired).toBe(true)
  })

  it('renders a receipt only for a recorded PAID payment', () => {
    const payment: ReservationPaymentResult = { paymentId: 'transaction-1', reservationId: base.id,
      transactionReference: 'SH-REFERENCE', gatewayTransactionNo: '12345678', amount: 6402000,
      currency: 'VND', refundedAmount: 0, paymentStatus: 'PAID', reservationStatus: 'CONFIRMED',
      responseCode: '00', transactionStatus: '00', gatewayPayDate: '20261101165500', message: '',
      processedAt: '2026-11-01T09:55:00Z', lastReconciledAt: null }
    const html = renderToStaticMarkup(<ReservationReceipt payment={payment} reservationCode={base.reservationCode} />)
    for (const text of ['Biên lai đặt cọc giữ chỗ (thanh toán trước 20%)', 'transaction-1', 'RSV-TEST', 'Thời điểm VNPay ghi nhận', '01/11/2026 16:55:00', 'Đơn đã xác nhận cọc (khoản trả trước)']) expect(html).toContain(text)
    expect(html).toContain('6.402.000 ₫')
    expect(html).not.toContain('166.452.000.000')
    for (const paymentStatus of ['FAILED', 'NOT_RECEIVED'] as const) {
      const failedHtml = renderToStaticMarkup(<ReservationReceipt payment={{ ...payment, paymentStatus }} reservationCode={base.reservationCode} />)
      expect(failedHtml).toContain('chưa có biên lai thanh toán')
      expect(failedHtml).not.toContain('Đơn đã xác nhận cọc (khoản trả trước)')
    }
  })

  it('shows countdown rather than only the expiry date', () => {
    const html = render('AWAITING_PAYMENT')
    expect(html).toContain('role="timer"')
    expect(html).toContain('Hạn thanh toán trước 20% (giữ chỗ)')
    expect(html).not.toContain('Thanh toán mô phỏng')
  })
  it('restores the amber card, financial breakdown and five-step progress for real reservations', () => {
    const html = render('AWAITING_EMAIL')
    for (const text of ['border-l-amber-500', 'RSV-TEST', 'Kho HCM', 'Báo giá đặt kho', 'Số tiền còn lại phải thanh toán khi bàn giao kho', 'Tiến trình đơn đặt kho', 'Phê duyệt hồ sơ', 'Quản lý phân kho', 'Nhận kho và ký', 'Đã bàn giao']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('aria-current="step"')
    expect(html).not.toContain('Chưa có đơn')
  })
  it('opens payment only for backend AWAITING_PAYMENT, not for email/review/confirmed', () => {
    expect(render('AWAITING_PAYMENT')).toContain('>Thanh toán đặt cọc giữ chỗ</button>')
    for (const status of ['AWAITING_EMAIL', 'AWAITING_REVIEW', 'CONFIRMED', 'EXPIRED'] as const) {
      expect(render(status)).not.toContain('>Thanh toán đặt cọc giữ chỗ</button>')
    }
  })
  it('shows hold confirmation only after the reservation deposit is confirmed', () => {
    expect(render('AWAITING_PAYMENT')).not.toContain('Xem phiếu giữ kho')
    for (const status of ['CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'COMPLETED'] as const) {
      expect(render(status)).toContain('Xem phiếu giữ kho')
    }
  })
  it('allows customers to set or change the appointment until check-in starts', () => {
    for (const status of ['AWAITING_EMAIL', 'AWAITING_REVIEW', 'AWAITING_PAYMENT', 'PAYMENT_GRACE', 'PAYMENT_REVIEW', 'CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'] as const) {
      expect(render(status)).toContain('Lưu lịch nhận kho')
    }
    expect(render('AWAITING_CUSTOMER_RECEIPT')).not.toContain('Lưu lịch nhận kho')
  })
  it('shows the two customer gates before inventory', () => {
    expect(render('AWAITING_CUSTOMER_RECEIPT')).toContain('Xác nhận đã nhận kho')
    expect(render('PREPARING')).not.toContain('Đã setup xong')

    const notice = (checkInStatus: string) => renderToStaticMarkup(
      <ReservationPreparationNotice checkInStatus={checkInStatus} submitting={false} onReady={() => {}} />,
    )
    expect(notice('setup_in_progress')).toContain('Đã setup xong')
    expect(notice('handover_pending_receipt')).toContain('Đã setup xong')
    expect(notice('setup_completed')).toContain('Đang chờ nhân viên kiểm kê')
    expect(notice('setup_completed')).not.toContain('Đã setup xong')
    expect(notice('completed')).toContain('Đã hoàn tất kiểm kê')
  })

  it('shows the booked inventory time in Vietnam and keeps it distinct from the deadline', () => {
    const detail = {
      reservation: base, setupCompletedAt: '2026-11-01T08:00:00Z', inventoryAppointmentAt: '2026-11-02T09:30:00Z',
      inventoryDueAt: '2026-11-05T08:00:00Z', inventoryFinalDeadlineAt: '2026-11-08T08:00:00Z',
      inventoryResolutionStatus: 'NOT_STARTED',
    } as CustomerReservationDetail
    const html = renderToStaticMarkup(<InventoryAppointmentPanel detail={detail} now={Date.now()} onSaved={vi.fn()} />)
    expect(html).toContain('02/11/2026 16:30')
    expect(html).toContain('05/11/2026 15:00')
    expect(html).toContain('08/11/2026 15:00')
    expect(html).toContain('Đổi lịch kiểm kê')
  })

  it('hides appointment changes after arrival, after expiry and after a result is published', () => {
    const detail = {
      reservation: base, inventoryAppointmentAt: '2026-11-02T09:30:00Z',
      inventoryFinalDeadlineAt: '2026-11-08T08:00:00Z', inventoryResolutionStatus: 'NOT_STARTED',
    } as CustomerReservationDetail
    const cases: Array<[Partial<CustomerReservationDetail>, number, string]> = [
      [{ inventoryArrivedAt: '2026-11-02T09:00:00Z' }, Date.parse('2026-11-02T09:05:00Z'), 'Đang chờ xác minh danh tính.'],
      [{}, Date.parse('2026-11-08T08:00:00Z'), 'Đã quá hạn kiểm kê'],
      [{ inventoryResolutionStatus: 'PENDING_CUSTOMER' }, Date.now(), 'Staff đã công bố kết quả kiểm kê'],
    ]
    for (const [overrides, now, text] of cases) {
      const html = renderToStaticMarkup(<InventoryAppointmentPanel detail={{ ...detail, ...overrides }} now={now} onSaved={vi.fn()} />)
      expect(html).toContain(text)
      expect(html).not.toContain('Đổi lịch kiểm kê')
    }
  })
  it('requires an explicit cancellation confirmation', () => {
    const html = render('AWAITING_EMAIL')
    expect(html).toContain('Hủy giữ kho')
    expect(html).not.toContain('Xác nhận hủy giữ kho')
  })
  it('describes PAYMENT_GRACE as a complaint window instead of a payment extension', () => {
    expect(reservationStatusLabels.PAYMENT_GRACE).toBe('Chờ khiếu nại thanh toán')
    const html = render('PAYMENT_GRACE')
    expect(html).toContain('Đối soát thanh toán')
    expect(html).toContain('Chờ khách hàng gửi chứng từ')
    expect(html).not.toContain('Gia hạn thanh toán')
  })
  it.each([
    ['AWAITING_EMAIL', 0], ['AWAITING_REVIEW', 0], ['AWAITING_PAYMENT', 1],
    ['PAYMENT_GRACE', 1], ['PAYMENT_REVIEW', 1], ['CONFIRMED', 2],
    ['UNIT_RESERVED', 3], ['READY_FOR_CHECKIN', 3], ['AWAITING_CUSTOMER_RECEIPT', 4],
    ['COMPLETED', 5], ['CANCELLED', null], ['EXPIRED', null], ['REJECTED', null],
  ] as const)('maps backend status %s to progress %s', (status, step) => {
    expect(reservationProgress(status)).toBe(step)
  })
})

it('pre-handover reservation shows setup-adjusted estimated dates without repricing', () => {
 const html = renderToStaticMarkup(<CustomerReservationCard reservation={{ ...base, rentalPeriodConfirmed: false, appointmentAt: '2026-10-30T03:00:00Z', freeSetupDays: 6 }} facilityName="Kho HCM" unitTypeName="Kho nhỏ" onVerify={() => {}} onCancel={() => {}} onRefresh={async () => {}} />)
 expect(html).toContain('05/11/2026')
 expect(html).toContain('Kỳ thuê dự kiến sau thời gian chuẩn bị')
 expect(html).toContain('4.000.000 ₫')
 expect(html).not.toContain('Kỳ thuê bắt đầu từ ngày kho có thể sẵn sàng sớm nhất')
})

 it('separates booking information from the invoice without duplicating customer details', () => {
   const html = render('AWAITING_PAYMENT')
   expect(html).toContain('role="tab" id="reservation-info-tab-reservation-1"')
   expect(html).toContain('aria-selected="true"')
   expect(html).toContain('role="tab" id="reservation-quote-tab-reservation-1"')
   expect(html).toContain('aria-labelledby="reservation-quote-tab-reservation-1" hidden=""')
   const invoice = html.slice(html.indexOf('role="tabpanel" id="reservation-quote-reservation-1"'))
   expect(invoice).toContain('Tổng chi phí phải thanh toán')
   expect(html).toContain('Thanh toán trước 20% (giữ chỗ)')
   expect(invoice).not.toContain('Thông tin hàng hóa đã khai báo')
   expect(html.split('>Thông tin khách hàng</h3>')).toHaveLength(2)
 })
