import { describe, expect, it } from 'vitest'
import { paymentMethodLabel } from './paymentLabels'

describe('customer payment method labels', () => {
  it.each([
    ['CASH', 'Tiền mặt'],
    ['Tiền mặt tại cơ sở', 'Tiền mặt'],
    ['BANK_TRANSFER', 'Chuyển khoản'],
    ['Chuyển khoản đã xác minh', 'Chuyển khoản'],
    ['NCB', 'Thanh toán trực tuyến'],
    ['VNPAY', 'Thanh toán trực tuyến'],
    ['VNPay', 'Thanh toán trực tuyến'],
    ['DEPOSIT_OFFSET', 'Đối trừ quyết toán'],
  ])('renders %s consistently as %s', (stored, label) => {
    expect(paymentMethodLabel(stored)).toBe(label)
  })

  it('keeps future gateway bank codes in the same Vietnamese category', () => {
    expect(paymentMethodLabel('BANK_CODE_NEW', true)).toBe('Thanh toán trực tuyến')
    expect(paymentMethodLabel('BANK_CODE_NEW')).toBe('Phương thức khác')
    expect(paymentMethodLabel(null)).toBe('Chưa có thông tin')
  })
})
