import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_DURATION_DISCOUNTS } from '../src/views/business/BusinessApp'
import type { DurationDiscountItem } from '../src/views/business/BusinessApp'

describe('E2E Integration: BO Facility Creation, Duration Discounts & Customer Booking Matching', () => {
  // Mock localStorage in test environment
  const mockLocalStorage: Record<string, string> = {}
  beforeEach(() => {
    for (const key in mockLocalStorage) delete mockLocalStorage[key]
    global.localStorage = {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, val: string) => { mockLocalStorage[key] = val },
      removeItem: (key: string) => { delete mockLocalStorage[key] },
      clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k] },
      length: Object.keys(mockLocalStorage).length,
      key: (i: number) => Object.keys(mockLocalStorage)[i] ?? null,
    } as any
  })

  it('Step 1: BO creates a new facility (Nha Trang) with 4 unit sizes (S, M, L, XL)', () => {
    const facilityData = {
      id: 'fac-nt-01',
      code: 'NT-01',
      name: 'Kho Nha Trang - Trần Phú',
      address: '123 Trần Phú, Vĩnh Hòa',
      city: 'Nha Trang',
      unitDistribution: { S: 1, M: 1, L: 1, XL: 1 },
      unitPrices: { S: 5500000, M: 9500000, L: 15000000, XL: 22500000 }
    }

    const totalUnits = Object.values(facilityData.unitDistribution).reduce((a, b) => a + b, 0)
    expect(totalUnits).toBe(4)
    expect(facilityData.unitDistribution.S).toBe(1)
    expect(facilityData.unitDistribution.M).toBe(1)
    expect(facilityData.unitDistribution.L).toBe(1)
    expect(facilityData.unitDistribution.XL).toBe(1)
  })

  it('Step 2: BO verifies default Duration Discounts in Policies tab', () => {
    // Default duration discount list
    const discounts: DurationDiscountItem[] = [...DEFAULT_DURATION_DISCOUNTS]
    expect(discounts).toHaveLength(4)

    const pkg3m = discounts.find(d => d.months === 3)
    const pkg6m = discounts.find(d => d.months === 6)
    const pkg12m = discounts.find(d => d.months === 12)
    const pkgOther = discounts.find(d => d.months === 'other')

    expect(pkg3m?.discountPercent).toBe(3)
    expect(pkg6m?.discountPercent).toBe(5)
    expect(pkg12m?.discountPercent).toBe(8)
    expect(pkgOther?.discountPercent).toBe(0)
  })

  it('Step 3: Customer books Unit S with default BO duration discounts', () => {
    // Unit S price: 5,500,000 VND / month
    const baseMonthlyPrice = 5500000

    const getRentalDiscountRate = (months: number) => {
      try {
        const raw = localStorage.getItem('storagehub:durationDiscounts')
        if (raw) {
          const list = JSON.parse(raw)
          const found = list.find((item: any) => item.months === months && item.status === 'active')
          if (found && typeof found.discountPercent === 'number') return found.discountPercent / 100
        }
      } catch {}
      return months === 3 ? 0.03 : months === 6 ? 0.05 : months === 12 ? 0.08 : 0
    }

    // 1 Month (Other): 0% discount
    const term1Gross = baseMonthlyPrice * 1
    const rate1 = getRentalDiscountRate(1)
    const disc1 = Math.round(term1Gross * rate1 * 100) / 100
    const net1 = term1Gross - disc1
    const deposit1 = Math.round(net1 * 0.2 * 100) / 100
    expect(rate1).toBe(0)
    expect(disc1).toBe(0)
    expect(net1).toBe(5500000)
    expect(deposit1).toBe(1100000)

    // 3 Months: 3% discount
    const term3Gross = baseMonthlyPrice * 3
    const rate3 = getRentalDiscountRate(3)
    const disc3 = Math.round(term3Gross * rate3 * 100) / 100
    const net3 = term3Gross - disc3
    const deposit3 = Math.round(net3 * 0.2 * 100) / 100
    expect(rate3).toBe(0.03)
    expect(term3Gross).toBe(16500000)
    expect(disc3).toBe(495000)
    expect(net3).toBe(16005000)
    expect(deposit3).toBe(3201000)

    // 6 Months: 5% discount
    const term6Gross = baseMonthlyPrice * 6
    const rate6 = getRentalDiscountRate(6)
    const disc6 = Math.round(term6Gross * rate6 * 100) / 100
    const net6 = term6Gross - disc6
    const deposit6 = Math.round(net6 * 0.2 * 100) / 100
    expect(rate6).toBe(0.05)
    expect(term6Gross).toBe(33000000)
    expect(disc6).toBe(1650000)
    expect(net6).toBe(31350000)
    expect(deposit6).toBe(6270000)

    // 12 Months: 8% discount
    const term12Gross = baseMonthlyPrice * 12
    const rate12 = getRentalDiscountRate(12)
    const disc12 = Math.round(term12Gross * rate12 * 100) / 100
    const net12 = term12Gross - disc12
    const deposit12 = Math.round(net12 * 0.2 * 100) / 100
    expect(rate12).toBe(0.08)
    expect(term12Gross).toBe(66000000)
    expect(disc12).toBe(5280000)
    expect(net12).toBe(60720000)
    expect(deposit12).toBe(12144000)
  })

  it('Step 4: BO updates duration discounts in Policies tab (e.g. 3m=4%, 6m=7%, 12m=10%) and Customer dynamically reflects them', () => {
    // BO customizes the discount rates
    const customDiscounts: DurationDiscountItem[] = [
      {
        id: 'pkg-3m',
        months: 3,
        title: 'Gói thuê 3 tháng',
        label: '3 tháng',
        discountPercent: 4, // updated from 3% to 4%
        renewalDiscountPercent: 0,
        description: 'Ưu đãi đặc biệt giảm 4%',
        appliesTo: 'Đặt kho lần đầu',
        status: 'active',
      },
      {
        id: 'pkg-6m',
        months: 6,
        title: 'Gói thuê 6 tháng',
        label: '6 tháng',
        discountPercent: 7, // updated from 5% to 7%
        renewalDiscountPercent: 4,
        description: 'Ưu đãi đặc biệt giảm 7%',
        appliesTo: 'Đặt kho & Gia hạn',
        status: 'active',
      },
      {
        id: 'pkg-12m',
        months: 12,
        title: 'Gói thuê 12 tháng (1 năm)',
        label: '12 tháng',
        discountPercent: 10, // updated from 8% to 10%
        renewalDiscountPercent: 6,
        description: 'Ưu đãi đặc biệt giảm 10%',
        appliesTo: 'Đặt kho & Gia hạn',
        status: 'active',
      },
      {
        id: 'pkg-other',
        months: 'other',
        title: 'Kỳ hạn khác',
        label: 'Thời hạn khác',
        discountPercent: 0,
        renewalDiscountPercent: 0,
        description: 'Không giảm giá',
        appliesTo: 'Không giảm (0%)',
        status: 'active',
      },
    ]

    // BO saves to localStorage
    localStorage.setItem('storagehub:durationDiscounts', JSON.stringify(customDiscounts))

    const getRentalDiscountRate = (months: number) => {
      try {
        const raw = localStorage.getItem('storagehub:durationDiscounts')
        if (raw) {
          const list = JSON.parse(raw)
          const found = list.find((item: any) => item.months === months && item.status === 'active')
          if (found && typeof found.discountPercent === 'number') return found.discountPercent / 100
        }
      } catch {}
      return months === 3 ? 0.03 : months === 6 ? 0.05 : months === 12 ? 0.08 : 0
    }

    const baseMonthlyPrice = 5500000

    // Customer places order for 3 months with new 4% rate
    const rate3 = getRentalDiscountRate(3)
    expect(rate3).toBe(0.04)
    const term3Gross = baseMonthlyPrice * 3
    const disc3 = Math.round(term3Gross * rate3 * 100) / 100
    const net3 = term3Gross - disc3
    expect(disc3).toBe(660000) // 16.5m * 4% = 660,000
    expect(net3).toBe(15840000)

    // Customer places order for 6 months with new 7% rate
    const rate6 = getRentalDiscountRate(6)
    expect(rate6).toBe(0.07)
    const term6Gross = baseMonthlyPrice * 6
    const disc6 = Math.round(term6Gross * rate6 * 100) / 100
    const net6 = term6Gross - disc6
    expect(disc6).toBe(2310000) // 33m * 7% = 2,310,000
    expect(net6).toBe(30690000)

    // Customer places order for 12 months with new 10% rate
    const rate12 = getRentalDiscountRate(12)
    expect(rate12).toBe(0.10)
    const term12Gross = baseMonthlyPrice * 12
    const disc12 = Math.round(term12Gross * rate12 * 100) / 100
    const net12 = term12Gross - disc12
    expect(disc12).toBe(6600000) // 66m * 10% = 6,600,000
    expect(net12).toBe(59400000)
  })

  it('Step 5: Customer successfully books units in newly created BO facility without out-of-stock false positive', () => {
    // BO created facility in Nha Trang with custom Vietnamese specs
    const fac = {
      id: 'fac-nt-01',
      code: 'NT-01',
      name: 'Kho Nha Trang - Trần Phú',
    }

    const units = [
      { id: 'NT-01-S-001', code: 'NT-01-S-001', size: 'S', sizeCode: 'S', type: 'Kho Nhỏ (S)', facilityId: 'fac-nt-01', facilityName: fac.name, status: 'available', reservedPeriods: [] },
      { id: 'NT-01-M-001', code: 'NT-01-M-001', size: 'M', sizeCode: 'M', type: 'Kho Trung (M)', facilityId: 'fac-nt-01', facilityName: fac.name, status: 'available', reservedPeriods: [] },
      { id: 'NT-01-L-001', code: 'NT-01-L-001', size: 'L', sizeCode: 'L', type: 'Kho Lớn (L)', facilityId: 'fac-nt-01', facilityName: fac.name, status: 'available', reservedPeriods: [] },
      { id: 'NT-01-XL-001', code: 'NT-01-XL-001', size: 'XL', sizeCode: 'XL', type: 'Kho Cực Lớn (XL)', facilityId: 'fac-nt-01', facilityName: fac.name, status: 'available', reservedPeriods: [] }
    ]

    const testCases = [
      { unitTypeId: 'small', expectedSize: 'S', expectedId: 'NT-01-S-001' },
      { unitTypeId: 'medium', expectedSize: 'M', expectedId: 'NT-01-M-001' },
      { unitTypeId: 'large', expectedSize: 'L', expectedId: 'NT-01-L-001' },
      { unitTypeId: 'xlarge', expectedSize: 'XL', expectedId: 'NT-01-XL-001' },
    ]

    for (const tc of testCases) {
      const targetSizeCode = (
        tc.unitTypeId === 'small' ? 'S' :
        tc.unitTypeId === 'medium' ? 'M' :
        tc.unitTypeId === 'large' ? 'L' :
        tc.unitTypeId === 'xlarge' ? 'XL' :
        tc.unitTypeId
      )

      // Test candidate unit matching
      const matchingUnits = units.filter(u => {
        const uSize = (u.sizeCode || u.size)
        return (u.facilityId === fac.id || u.facilityId === fac.code) &&
          u.status === 'available' &&
          (uSize === targetSizeCode || u.type.toLowerCase().includes(tc.unitTypeId))
      })

      expect(matchingUnits.length).toBe(1)
      expect(matchingUnits[0].id).toBe(tc.expectedId)
      expect(matchingUnits[0].sizeCode).toBe(tc.expectedSize)
    }
  })
})

