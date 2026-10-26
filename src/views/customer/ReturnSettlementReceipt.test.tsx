import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { HistoryEntry } from '../../services/customerPaymentHistory'
import ReturnSettlementReceipt from './ReturnSettlementReceipt'

const entry: HistoryEntry = {
  id: 'SETUP-REFUND-RECEIPT', reference: 'Trả kho A1', category: 'refund', amount: 5700000,
  currency: 'VND', timestamp: '2026-10-26T03:00:00Z', status: 'REFUNDED', method: 'Tiền mặt',
  returnSettlement: {
    setupEarlyExit: true, rentalRefundCredit: 6000000, earlyTerminationFee: 2000000,
    depositAmount: 2000000, totalDeductions: 2300000, damageFee: 300000, cleaningFee: 0,
    lostItemFee: 0, overdueFee: 0, outstandingFee: 0, overdueSettlement: null, receiptFileId: null,
  },
}

describe('setup return settlement receipt', () => {
  it('shows the recorded refund and backend rental/fee breakdown without adding the prepayment again', () => {
    const html = renderToStaticMarkup(<ReturnSettlementReceipt entry={entry} />)
    expect(html).toContain('Biên lai quyết toán trả kho')
    expect(html).toContain('Tiền thuê thực thu được quyết toán')
    expect(html).toContain('Phí chấm dứt sớm một lần')
    expect(html).toContain('6.000.000')
    expect(html).toContain('2.300.000')
    expect(html).toContain('5.700.000')
    expect(html).not.toContain('6.900.000')
  })

  it('keeps ordinary returns free of the setup termination fee row', () => {
    const normal: HistoryEntry = { ...entry, returnSettlement: { ...entry.returnSettlement!, setupEarlyExit: false,
      rentalRefundCredit: 0, earlyTerminationFee: 0 } }
    const html = renderToStaticMarkup(<ReturnSettlementReceipt entry={normal} />)
    expect(html).not.toContain('Phí chấm dứt sớm một lần')
    expect(html).not.toContain('Tiền thuê thực thu được quyết toán')
  })
})
