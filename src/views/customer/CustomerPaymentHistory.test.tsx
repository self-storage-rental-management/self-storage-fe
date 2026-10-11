import { describe, expect, it } from 'vitest'
import { paymentHistoryTimestamp } from './CustomerPaymentHistory'

describe('VNPay history nullable processing timestamp', () => {
  it('never invents an epoch date for pending transactions', () => {
    expect(paymentHistoryTimestamp(null)).toBe('Chưa ghi nhận')
    expect(paymentHistoryTimestamp('invalid')).toBe('Chưa ghi nhận')
  })
  it('uses the actual processing timestamp when available', () => {
    const value = '2026-10-11T01:00:00Z'
    expect(paymentHistoryTimestamp(value)).toBe(new Date(value).toLocaleString('vi-VN'))
  })
})
