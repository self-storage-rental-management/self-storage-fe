import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { returnRecoveryCountdown, ReturnSummary } from './ReturnApiPanel'
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
    expect(html).toContain('sau hạn chuẩn bị')
    expect(html).not.toContain('Phí chấm dứt sớm một lần')
  })
  it('separates inventory mismatch pricing from a normal return', () => {
    const html = renderToStaticMarkup(<ReturnSummary record={{ ...record, returnType: 'INVENTORY_MISMATCH', earlyTerminationPolicy: {
      type: 'GOODS_MOVED_IN', earlyTerminationFee: 0, billableSetupDays: 2,
      usedGoodsCharge: 200000, totalRentalCharge: 200000, rentalRefundAmount: 5800000, noticeDays: 0,
    }, setupExitRequested: true, setupEarlyExit: true, rentalRefundCredit: 5800000, earlyTerminationFee: 0 }} />)
    expect(html).toContain('Trả kho do hàng hóa sai khai báo')
    expect(html).toContain('Tính tiền từ ngày xác nhận nhận kho đến ngày hẹn trả kho dự kiến.')
    expect(html).toContain('Quản lý cơ sở lập quyết toán, khách xác nhận trước khi hoàn tiền hoặc thu thêm.')
    expect(html).toContain('5.800.000')
    expect(html).not.toContain('Phí chấm dứt sớm một lần')
  })

  it('keeps the fixed fee visible for a normal setup return', () => {
    const html = renderToStaticMarkup(<ReturnSummary record={{ ...record, setupExitRequested: true,
      setupEarlyExit: true, rentalRefundCredit: 5800000, earlyTerminationFee: 5500000 }} />)
    expect(html).toContain('Phí chấm dứt sớm một lần')
    expect(html).toContain('5.500.000')
  })

  it('shows the no-show cutoff and recovery deadline without implying automatic movement', () => {
    const html = renderToStaticMarkup(<ReturnSummary record={{ ...record,
      status: 'recovery_required',
      recoveryEligibleAt: '2026-10-22T17:00:00Z',
      recoveryTaskDeadlineAt: '2026-10-22T21:00:00Z',
    }} />)
    expect(html).toContain('Hàng chưa được tự động di chuyển')
    expect(html).toContain('Hạn xử lý nhiệm vụ thu hồi')
  })

  it('formats the recovery deadline as a live countdown', () => {
    expect(returnRecoveryCountdown('2026-11-26T00:00:00Z', Date.parse('2026-11-24T00:00:00Z'))).toBe('Còn 2 ngày 00:00:00')
    expect(returnRecoveryCountdown('2026-11-24T00:00:00Z', Date.parse('2026-11-24T00:00:01Z'))).toBe('Đã quá hạn')
  })

})
