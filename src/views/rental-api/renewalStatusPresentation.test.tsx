import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renewal } from '../../../tests/rentalApiFixtures'
import { isRenewalStatusSummary, type RenewalStatusSummary } from '../../types/renewalStatus'
import { reconciledRenewalPayment, renewalPaymentDisplayLabel, renewalProgress } from './renewalStatusPresentation'
import type { RenewalApiRecord, RenewalVnpayPaymentResponse } from '../../types/renewalApi'
import RenewalDetail from './RenewalDetail'
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

const renderDetail = (record: Partial<RenewalApiRecord>, role: 'customer' | 'staff' = 'customer') =>
  renderToStaticMarkup(<RenewalDetail role={role} renewal={{ ...renewal, ...record }} onAction={() => {}} />)

describe('renewal detail progress', () => {
  it.each([
    ['rejected', 'REJECTED', 'Yêu cầu bị từ chối'],
    ['cancelled', 'CANCELLED', 'Yêu cầu đã hủy'],
    ['payment_expired', 'PAYMENT_WINDOW_EXPIRED', 'Đã hết hạn thanh toán'],
    ['payment_expired', 'AWAITING_RECONCILIATION', 'Đã hết hạn thanh toán'],
    ['deposit_paid', 'SIGNING_EXPIRED', 'Đã hết hạn ký'],
    ['deposit_paid', 'NO_SHOW', 'Khách không đến'],
    ['pending', 'ON_HOLD', 'Tạm dừng xử lý'],
  ] as const)('shows %s / %s without an active step', (status, workflowStatus, label) => {
    for (const role of ['customer', 'staff'] as const) {
      const html = renderDetail({ status, statusSummary: { ...summary, workflowStatus } }, role)
      expect(html).toContain(`aria-label="Trạng thái hồ sơ gia hạn">${label}</span>`)
      expect(html).not.toContain('aria-current="step"')
      expect(html).not.toContain('Đang thực hiện:')
      if (workflowStatus === 'AWAITING_RECONCILIATION') {
        expect(html).toContain('Cơ sở đang đối soát thanh toán.')
      }
      if (workflowStatus === 'SIGNING_EXPIRED' || workflowStatus === 'NO_SHOW') {
        expect(html).toContain(role === 'customer' ? 'Đã hoàn thành 2/3 bước' : 'Đã hoàn thành 4/5 bước')
        expect(html).toContain(workflowStatus === 'NO_SHOW' ? '>Khách không đến</span>' : '>Hết hạn</span>')
      }
    }
  })

  it('keeps the active step while signing and completes all steps when the renewal is finalized', () => {
    const signing = renderDetail({ status: 'deposit_paid', statusSummary: summary })
    expect(signing.match(/aria-current="step"/g)).toHaveLength(1)
    expect(signing).toContain('Đã hoàn thành 2/3 bước')

    const completed = renderDetail({ status: 'completed', statusSummary: { ...summary, workflowStatus: 'COMPLETED' } })
    expect(completed).toContain('Đã hoàn thành 3/3 bước')
    expect(completed).not.toContain('aria-current="step"')
  })
})

describe('independent renewal states', () => {
  it('keeps calculation details while hiding transaction references', () => {
    const html = renderToStaticMarkup(<RenewalStatusPanel summary={summary} onReceipt={() => {}} />)
    expect(html).toContain('Thanh toán gia hạn')
    expect(html).toContain('Tổng phải trả')
    expect(html).toContain('Còn lại')
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Chi tiết tính tiền/)
    expect(html).not.toContain('Mã giao dịch')
    expect(html).not.toContain('Số hóa đơn')
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
    expect(html).toContain('Đã thanh toán một phần')
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
