import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReturnSummary } from './ReturnApiPanel'
import type { ApiReturn } from '../../services/returnApi'

describe('Return summary', () => {
  const record = { unitNumber: 'DN-M-001', facilityName: 'Kho Đà Nẵng', status: 'requested', scheduledDate: '2026-10-20', depositAmount: 10000000, totalDeductions: 0, netRefundAmount: null, amountDueFromCustomer: null } as ApiReturn
  it('shows Vietnamese dates, status and compact financial summary', () => {
    const html = renderToStaticMarkup(<ReturnSummary record={record} />)
    expect(html).toContain('DN-M-001')
    expect(html).toContain('20/10/2026')
    expect(html).toContain('Đã yêu cầu trả kho')
    expect(html).toContain('10.000.000')
    expect(html).toContain('Chưa xác định')
  })
  it('preserves settlement blocker warning instead of implying final payment', () => {
    const html = renderToStaticMarkup(<ReturnSummary record={{ ...record, settlementBlocker: 'Đơn cũ thiếu điều khoản setup, cần đối soát thủ công.' }} />)
    expect(html).toContain('Đơn cũ thiếu điều khoản setup, cần đối soát thủ công.')
  })
  it('displays prominent red warning badge when return is disputed', () => {
    const html = renderToStaticMarkup(<ReturnSummary record={{ ...record, status: 'disputed' }} />)
    expect(html).toContain('Đang khiếu nại - Cần BO giải quyết')
    expect(html).toContain('bg-rose-100')
    expect(html).toContain('text-rose-800')
  })
  it('uses the actual inspection cutoff returned by backend rather than the request date', () => {
    const html = renderToStaticMarkup(<ReturnSummary record={{ ...record, setupExitRequested: true,
      setupEarlyExit: false, setupReturnedAt: '2026-10-30T00:00:00Z', rentalRefundCredit: 0, earlyTerminationFee: 0 }} />)
    expect(html).toContain('sau hạn setup')
    expect(html).not.toContain('Phí chấm dứt sớm một lần')
  })

})
