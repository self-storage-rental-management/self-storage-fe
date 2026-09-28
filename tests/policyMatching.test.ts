import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getStoredPolicies,
  getPoliciesForFacility,
  evaluatePolicyBenefit,
  type PolicyItem
} from '../src/domain/policyMatching'

describe('StorageHub Policy Matching & Discount Benefit Engine', () => {
  const samplePolicies: PolicyItem[] = [
    {
      id: 'pol-user-test',
      name: 'trốn thuế',
      value: '1 tháng trốn thuế',
      scope: 'Kho Việt – Cơ sở Hà Nội',
      description: 'abc',
      editable: true,
      lastUpdated: '2026-09-29'
    },
    {
      id: 'pol-discount-pct',
      name: 'Ưu đãi khai trương cơ sở',
      value: '15%',
      scope: 'Kho Việt – Cơ sở Quận 1',
      description: 'Giảm 15% tổng giá trị thuê kỳ đầu',
      editable: true
    },
    {
      id: 'pol-fixed-cash',
      name: 'Trợ giá chuyển kho',
      value: '500.000đ',
      scope: 'Kho Việt – Cơ sở Bình Dương',
      description: 'Hỗ trợ 500k cho khách thuê mới',
      editable: true
    },
    {
      id: 'pol-general-rule',
      name: 'Quy định giờ mở cửa',
      value: '24/7 với mã PIN bảo mật',
      scope: 'Toàn bộ cơ sở',
      description: 'Áp dụng cho tất cả gian kho',
      editable: true
    }
  ]

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {
      'storagehub:policies': JSON.stringify(samplePolicies)
    }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Policy Storage & Scope Matching (getPoliciesForFacility)', () => {
    it('retrieves stored policies from localStorage', () => {
      const all = getStoredPolicies()
      expect(all.length).toBe(4)
      expect(all.find(p => p.name === 'trốn thuế')).toBeDefined()
    })

    it('matches facility-specific policy with exact name', () => {
      const hanoiPolicies = getPoliciesForFacility('Kho Việt – Cơ sở Hà Nội')
      expect(hanoiPolicies.some(p => p.name === 'trốn thuế')).toBe(true)
      // Also includes general policies (Toàn bộ cơ sở)
      expect(hanoiPolicies.some(p => p.name === 'Quy định giờ mở cửa')).toBe(true)
      // Does not include policies for other facilities
      expect(hanoiPolicies.some(p => p.name === 'Ưu đãi khai trương cơ sở')).toBe(false)
      expect(hanoiPolicies.some(p => p.name === 'Trợ giá chuyển kho')).toBe(false)
    })

    it('matches facility-specific policy with accent-insensitive or partial query', () => {
      const matched = getPoliciesForFacility('Kho Viet - Co so Ha Noi')
      expect(matched.some(p => p.name === 'trốn thuế')).toBe(true)

      const matchedPartial = getPoliciesForFacility('Cơ sở Hà Nội')
      expect(matchedPartial.some(p => p.name === 'trốn thuế')).toBe(true)
    })

    it('matches general policies for any facility', () => {
      const q1Policies = getPoliciesForFacility('Kho Việt – Cơ sở Quận 1')
      expect(q1Policies.some(p => p.name === 'Ưu đãi khai trương cơ sở')).toBe(true)
      expect(q1Policies.some(p => p.name === 'Quy định giờ mở cửa')).toBe(true)
      expect(q1Policies.some(p => p.name === 'trốn thuế')).toBe(false)
    })
  })

  describe('Smart Benefit Parsing & Financial Evaluation (evaluatePolicyBenefit)', () => {
    it('correctly evaluates "1 tháng trốn thuế" as 1 free month rent discount', () => {
      const userPolicy = samplePolicies.find(p => p.name === 'trốn thuế')!
      const monthlyRent = 3_000_000
      const rentalMonths = 3

      const benefit = evaluatePolicyBenefit(userPolicy, monthlyRent, rentalMonths)
      expect(benefit.isDiscount).toBe(true)
      expect(benefit.type).toBe('free_months')
      expect(benefit.monthsDeducted).toBe(1)
      expect(benefit.discountAmount).toBe(3_000_000) // 1 month free = 3.000.000 ₫
      expect(benefit.descriptionVi).toContain('trốn thuế')
    })

    it('caps free month discount to actual rental duration if renting for 1 month', () => {
      const twoMonthPolicy: PolicyItem = {
        id: 'pol-2m',
        name: 'Tặng 2 tháng',
        value: '2 tháng miễn phí',
        scope: 'Kho Việt – Cơ sở Hà Nội'
      }
      const monthlyRent = 2_500_000
      const benefit1Month = evaluatePolicyBenefit(twoMonthPolicy, monthlyRent, 1)
      expect(benefit1Month.discountAmount).toBe(2_500_000)

      const benefit3Month = evaluatePolicyBenefit(twoMonthPolicy, monthlyRent, 3)
      expect(benefit3Month.discountAmount).toBe(5_000_000)
    })

    it('evaluates percentage discount correctly', () => {
      const pctPolicy = samplePolicies.find(p => p.name === 'Ưu đãi khai trương cơ sở')!
      const monthlyRent = 2_000_000
      const rentalMonths = 3 // Gross = 6.000.000
      const benefit = evaluatePolicyBenefit(pctPolicy, monthlyRent, rentalMonths)
      expect(benefit.isDiscount).toBe(true)
      expect(benefit.type).toBe('percentage')
      expect(benefit.discountAmount).toBe(900_000) // 15% of 6.000.000
    })

    it('evaluates fixed cash discount correctly', () => {
      const cashPolicy = samplePolicies.find(p => p.name === 'Trợ giá chuyển kho')!
      const monthlyRent = 1_500_000
      const rentalMonths = 1
      const benefit = evaluatePolicyBenefit(cashPolicy, monthlyRent, rentalMonths)
      expect(benefit.isDiscount).toBe(true)
      expect(benefit.type).toBe('fixed_amount')
      expect(benefit.discountAmount).toBe(500_000)
    })

    it('treats operational rule without monetary benefit as rule (isDiscount: false)', () => {
      const rulePolicy = samplePolicies.find(p => p.name === 'Quy định giờ mở cửa')!
      const benefit = evaluatePolicyBenefit(rulePolicy, 3_000_000, 3)
      expect(benefit.isDiscount).toBe(false)
      expect(benefit.type).toBe('rule')
      expect(benefit.discountAmount).toBe(0)
    })

    it('correctly classifies system operational policies as rules (NEVER as discounts)', () => {
      const operationalCases: PolicyItem[] = [
        { id: 'pol-late', name: 'Late Fee', value: '650.000 ₫ / month', scope: 'All Facilities' },
        { id: 'pol-deposit', name: 'Security Deposit', value: '1 month', scope: 'All Facilities' },
        { id: 'pol-min', name: 'Minimum Lease', value: '1 month', scope: 'All Facilities' },
        { id: 'pol-renew', name: 'thời gian gia hạn', value: '5 ngày 500.00vnd', scope: 'All Facilities' },
        { id: 'pol-grace', name: 'Grace Period', value: '5 days', scope: 'All Facilities' },
        { id: 'pol-vacate', name: 'Notice to Vacate', value: '15 days', scope: 'All Facilities' },
      ]

      for (const op of operationalCases) {
        const benefit = evaluatePolicyBenefit(op, 12_500_000, 3)
        expect(benefit.isDiscount).toBe(false)
        expect(benefit.type).toBe('rule')
        expect(benefit.discountAmount).toBe(0)
      }
    })
  })

  describe('End-to-End Financial Calculations with Policy Discounts', () => {
    it('calculates gross, total discount, net rent, and 20% deposit accurately', () => {
      const userPolicy = samplePolicies.find(p => p.name === 'trốn thuế')!
      const monthlyPrice = 2_000_000
      const rentalMonths = 3

      // Duration discount: 3% for 3 months
      const durationDiscountRate = 0.03
      const grossTermValue = monthlyPrice * rentalMonths // 6.000.000
      const durationDiscount = grossTermValue * durationDiscountRate // 180.000

      // Facility policy benefit
      const policyBenefit = evaluatePolicyBenefit(userPolicy, monthlyPrice, rentalMonths)
      const facilityDiscount = policyBenefit.discountAmount // 2.000.000 (1 free month)

      // Total combined discount
      const totalCombinedDiscount = Math.min(grossTermValue, durationDiscount + facilityDiscount) // 2.180.000
      expect(totalCombinedDiscount).toBe(2_180_000)

      // Net rental term value
      const netRentalTerm = grossTermValue - totalCombinedDiscount // 3.820.000
      expect(netRentalTerm).toBe(3_820_000)

      // 20% reservation deposit
      const deposit = Math.round(netRentalTerm * 0.2 * 100) / 100 // 764.000
      expect(deposit).toBe(764_000)

      // Security deposit (1 month rent)
      const securityDeposit = monthlyPrice // 2.000.000

      // Due at Check-in = remaining rent + security deposit
      const dueAtCheckIn = (netRentalTerm - deposit) + securityDeposit // (3.820.000 - 764.000) + 2.000.000 = 5.056.000
      expect(dueAtCheckIn).toBe(5_056_000)
    })
  })
})
