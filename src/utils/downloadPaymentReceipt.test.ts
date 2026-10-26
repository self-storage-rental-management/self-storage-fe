import { describe, expect, it } from 'vitest'
import { paymentReceiptHtml } from './downloadPaymentReceipt'

describe('payment receipt export', () => {
  it('preserves Vietnamese content and escapes all untrusted receipt fields', () => {
    const html = paymentReceiptHtml({ title: 'Biên lai <img src=x onerror=alert(1)>', reference: 'test', status: 'Đã thu', fields: [['Khách hàng', '<script>alert(1)</script>'], ['Số tiền', '800.000 ₫']], footer: 'Đối chiếu & lưu trữ' })
    expect(html).toContain('charset="utf-8"')
    expect(html).toContain('800.000 ₫')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Đối chiếu &amp; lưu trữ')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
  })
})
