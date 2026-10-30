import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renewal } from '../../../tests/rentalApiFixtures'
import { isRenewalStatusSummary, type RenewalStatusSummary } from '../../types/renewalStatus'
import { reconciledRenewalPayment, renewalPaymentDisplayLabel, renewalProgress } from './renewalStatusPresentation'
import type { RenewalVnpayPaymentResponse } from '../../types/renewalApi'
import RenewalStatusPanel from './RenewalStatusPanel'

export const summary: RenewalStatusSummary = {
  workflowStatus: 'AWAITING_SIGNING', checkedAt: '2026-10-25T08:00:00Z',
  invoice: { status: 'PARTIALLY_PAID', refundStatus: 'NONE', totalBeforeAdjustments: 5000000, discountAmount: 0, adjustmentAmount: 0,
    totalAfterAdjustments: 5000000, paidAmount: 1000000, outstandingAmount: 4000000, dueNowAmount: 0, overdueAmount: 0, refundedAmount: 0, currency: 'VND', reason: null },
  transactions: [{ paymentId: 'p1', reference: 'tx1', purpose: 'RENEWAL', status: 'SUCCEEDED', amount: 1000000, refundedAmount: 0,
    currency: 'VND', paidAt: '2026-10-25T07:00:00Z', paymentDeadline: '2026-10-25T07:30:00Z', deadlineExpired: true, receiptAvailable: true }],
}
const payment: RenewalVnpayPaymentResponse = { paymentId: 'p1', renewalId: renewal.id, acceptedRevisionId: 'v1', transactionReference: 'tx1',
  amount: 1000000, currency: 'VND', paymentStatus: 'PAID', paymentDeadline: null, paidAt: '2026-10-25T07:00:00Z', reconciliationRequired: true,
  message: '', paymentUrl: null, invoiceNumber: null, invoiceStatus: 'DRAFT', invoiceIssuedAt: null,
  settlementStage: 'VERIFIED_AWAITING_ALLOCATION', transactionStatus: 'RECONCILIATION_REQUIRED', receiptAvailable: false }

describe('independent renewal states', () => {
  it('keeps calculation and transaction references in collapsed details', () => {
    const html = renderToStaticMarkup(<RenewalStatusPanel summary={summary} onReceipt={() => {}} />)
    expect(html).toContain('Thanh toán gia hạn')
    expect(html).toContain('Tổng phải trả')
    expect(html).toContain('Còn lại')
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Chi tiết tính tiền/)
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Mã giao dịch/)
    expect(html).not.toContain('<details open')
    expect(html).toContain('Xem biên lai')
  })
  it('omits removed adjustment, due-date and explanatory content', () => {
    const html = renderToStaticMarkup(<RenewalStatusPanel summary={{ ...summary,
      invoice: { ...summary.invoice, dueNowAmount: 2000000, overdueAmount: 1000000 },
    }} onReceipt={() => {}} />)
    expect(html).not.toContain('Điều chỉnh giảm đã ghi nhận')
    expect(html).not.toContain('Đến hạn')
    expect(html).not.toContain('quá hạn thanh toán')
    expect(html).not.toContain('Số đã thanh toán là tiền')
    expect(html).not.toContain('không đồng nghĩa đã hoàn tất ký gia hạn')
  })
  it('does not advance progress or expose a receipt based on PAID without reconciliation', () => {
    expect(reconciledRenewalPayment(payment)).toBe(false)
    expect(renewalPaymentDisplayLabel(payment)).toBe('Chờ đối soát')
    expect(renewalProgress({ ...renewal, status: 'accepted' }, payment)).toBe(2)
    expect(reconciledRenewalPayment({ ...payment, reconciliationRequired: false, settlementStage: 'COMPLETED' })).toBe(false)
  })
  it('shows a partial invoice independently of a successful prepayment and signing workflow', () => {
    expect(isRenewalStatusSummary(summary)).toBe(true)
    const html = renderToStaticMarkup(<RenewalStatusPanel summary={summary} onReceipt={() => {}} />)
    expect(html).toContain('Đã thanh toán cọc gia hạn')
    expect(html).toContain('Thanh toán thành công')
    expect(html).toContain('4.000.000 đ')
    expect(html).not.toContain('trả theo tháng')
    expect(renewalProgress({ ...renewal, status: 'deposit_paid', statusSummary: summary }, null)).toBe(4)
  })
  it('rejects inconsistent or falsely receipted financial responses', () => {
    expect(isRenewalStatusSummary({ ...summary, invoice: { ...summary.invoice, outstandingAmount: 0 } })).toBe(false)
    expect(isRenewalStatusSummary({ ...summary, transactions: [{ ...summary.transactions[0], status: 'RECONCILIATION_REQUIRED' }] })).toBe(false)
  })
  it('keeps unknown money unknown rather than treating it as zero or paid', () => {
    const unknown: RenewalStatusSummary = { ...summary, invoice: { status: 'UNKNOWN', refundStatus: 'UNKNOWN', totalBeforeAdjustments: null, discountAmount: null,
      adjustmentAmount: null, totalAfterAdjustments: null, paidAmount: null, outstandingAmount: null, dueNowAmount: null, overdueAmount: null, refundedAmount: null, currency: 'VND', reason: 'LEGACY' } }
    expect(isRenewalStatusSummary(unknown)).toBe(true)
    const html = renderToStaticMarkup(<RenewalStatusPanel summary={unknown} onReceipt={() => {}} />)
    expect(html).toContain('Chưa xác minh khoản phải thu')
    expect(html).not.toContain('>0 đ<')
  })
})
