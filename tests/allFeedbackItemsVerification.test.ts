import { describe, it, expect } from 'vitest'
import { POLICIES, FEES } from '../src/data/demoDatabase'
import { DEFAULT_DURATION_DISCOUNTS } from '../src/views/business/BusinessApp'

describe('Verification of All Recorded Feedback Items', () => {
  describe('Group 1: Bảng giá & Biểu phí / Quản lý giá', () => {
    it('1.1 & 1.2: Duration discounts must include long-term packages (3m, 6m, 12m, 24m) with clear discounts', () => {
      const pkg3m = DEFAULT_DURATION_DISCOUNTS.find(p => p.months === 3)
      const pkg6m = DEFAULT_DURATION_DISCOUNTS.find(p => p.months === 6)
      const pkg12m = DEFAULT_DURATION_DISCOUNTS.find(p => p.months === 12)
      const pkg24m = DEFAULT_DURATION_DISCOUNTS.find(p => p.months === 24)

      expect(pkg3m).toBeDefined()
      expect(pkg3m?.discountPercent).toBe(3)
      expect(pkg3m?.renewalDiscountPercent).toBe(2)

      expect(pkg6m).toBeDefined()
      expect(pkg6m?.discountPercent).toBe(5)
      expect(pkg6m?.renewalDiscountPercent).toBe(3)

      expect(pkg12m).toBeDefined()
      expect(pkg12m?.discountPercent).toBe(8)
      expect(pkg12m?.renewalDiscountPercent).toBe(5)

      expect(pkg24m).toBeDefined()
      expect(pkg24m?.discountPercent).toBe(12)
      expect(pkg24m?.renewalDiscountPercent).toBe(8)
      expect(pkg24m?.title).toContain('24 tháng')

      const pkgOther = DEFAULT_DURATION_DISCOUNTS.find(p => p.id === 'pkg-other' || p.months === 'other')
      expect(pkgOther).toBeDefined()
      expect(pkgOther?.discountPercent).toBe(0)
      expect(pkgOther?.renewalDiscountPercent).toBe(0)
    })
  })

  describe('Group 2: Quy định & Chính sách thuê kho', () => {
    it('2.1: Late fee calculation must be per-day and harmonized between POLICIES and FEES', () => {
      const latePolicy = POLICIES.find(p => p.name === 'Late Fee')
      const lateFee = FEES.find(f => f.type === 'Phí nộp muộn')

      expect(latePolicy).toBeDefined()
      expect(lateFee).toBeDefined()

      // Both must calculate per-day: 50% daily rate / late day
      expect(latePolicy?.value).toContain('50% đơn giá ngày / ngày trễ')
      expect(lateFee?.amount).toContain('50% đơn giá ngày / ngày trễ')
      expect(latePolicy?.description).toContain('Cước thuê tháng ÷ 30')
      expect(lateFee?.trigger).toContain('Công thức: (giá thuê tháng ÷ 30)')
    })

    it('2.2: Grace period must be clearly defined (3 days)', () => {
      const gracePolicy = POLICIES.find(p => p.name === 'Grace Period')
      expect(gracePolicy).toBeDefined()
      expect(gracePolicy?.value).toBe('3 days')
      expect(gracePolicy?.description).toContain('3 ngày')
      expect(gracePolicy?.description).toContain('Thời gian ân hạn thanh toán')
    })

    it('2.3: Notice to vacate must NOT contain "trả phòng" and must be clear for self-storage', () => {
      const vacatePolicy = POLICIES.find(p => p.name === 'Notice to Vacate')
      expect(vacatePolicy).toBeDefined()
      expect(vacatePolicy?.value).toBe('15 days')
      expect(vacatePolicy?.description).not.toContain('trả phòng')
      expect(vacatePolicy?.description).toContain('trả kho sớm')
    })

    it('2.4: Security deposit must specify 1 month base rate with refund within 24h', () => {
      const depositPolicy = POLICIES.find(p => p.name === 'Security Deposit')
      expect(depositPolicy).toBeDefined()
      expect(depositPolicy?.value).toBe('1 month')
      expect(depositPolicy?.description).toContain('100% trong 24h')
    })

    it('2.5: Minimum lease must be 1 month', () => {
      const minLease = POLICIES.find(p => p.name === 'Minimum Lease')
      expect(minLease).toBeDefined()
      expect(minLease?.value).toBe('1 month')
    })
  })
})
