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
    const html = renderToStaticMarkup(<ReturnSummary record={{ ...record, settlementBlocker: 'UNKNOWN' }} />)
    expect(html).toContain('Hồ sơ chưa được xác nhận thanh toán/hoàn tiền thành công')
  })
})
