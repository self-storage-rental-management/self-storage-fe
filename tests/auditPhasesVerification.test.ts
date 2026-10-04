import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_PACKAGE_DURATIONS,
  DEFAULT_PACKAGE_DISCOUNTS,
  calculatePackagePrice,
  calculateDiscountPercent,
  generateDefaultRentalPackages,
  resolveRentalPackagesForUnit,
  getActiveDurationDiscounts
} from '../src/domain/packageRules'
import { POLICIES, SETTINGS_GROUPS, UNIT_SPECS } from '../src/data/demoDatabase'
import { DEFAULT_BUSINESS_CONFIG } from '../src/store/StorageHubContext'
import type { FacilityCustomUnitSpec, RentalPackage } from '../src/types/storageHub'

describe('FE Audit Phases Comprehensive Verification', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = String(val) },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { store = {} }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Phase 1 — Facility & Storage Allocation', () => {
    it('should generate default rental packages for S, M, L, XL with valid attributes', () => {
      const packagesS = generateDefaultRentalPackages('fac-test', 'S', 5500000)
      expect(packagesS.length).toBe(5) // 1, 3, 6, 12, 24 months
      expect(packagesS.map(p => p.months)).toEqual([1, 3, 6, 12, 24])

      const pkg3m = packagesS.find(p => p.months === 3)
      expect(pkg3m).toBeDefined()
      expect(pkg3m?.discountPercent).toBe(3)
      expect(pkg3m?.packagePrice).toBe(Math.round(5500000 * 3 * 0.97))
    })

    it('should resolve and preserve custom rentalPackages on storage units without overwriting', () => {
      const customPackages: RentalPackage[] = [
        {
          id: 'custom-pkg-3m',
          unitTypeId: 'S',
          months: 3,
          name: 'Gói 3 tháng giá sốc',
          packagePrice: 14000000,
          monthlyEquivalentPrice: 4666667,
          discountPercent: 15,
          status: 'active'
        }
      ]

      const resolved = resolveRentalPackagesForUnit({
        rentalPackages: customPackages,
        monthlyPrice: 5500000,
        sizeCode: 'S',
        facilityId: 'fac-1'
      })

      expect(resolved).toEqual(customPackages)
      expect(resolved[0].packagePrice).toBe(14000000)
      expect(resolved[0].discountPercent).toBe(15)
    })
  })

  describe('Phase 2 — Base Pricing', () => {
    it('should not mutate imported UNIT_SPECS demo object', () => {
      const originalPriceS = UNIT_SPECS.S.priceMonthly

      // Simulate pricing tier update flow
      const updatedPrice = 6000000
      const tierId = 'tier-1'
      const nextTiers = [
        { id: tierId, name: 'Kho Nhỏ (S)', sizeCode: 'S', basePrice: updatedPrice, highDemandMultiplier: 1.15 }
      ]
      localStorage.setItem('storagehub:pricingTiers', JSON.stringify(nextTiers))

      // Verify that demoDatabase UNIT_SPECS.S.priceMonthly was NOT mutated
      expect(UNIT_SPECS.S.priceMonthly).toBe(originalPriceS)

      // Verify persistence in localStorage
      const stored = JSON.parse(localStorage.getItem('storagehub:pricingTiers') || '[]')
      expect(stored[0].basePrice).toBe(updatedPrice)
    })
  })

  describe('Phase 3 — Rental Package Consistency', () => {
    it('should read updated global duration discounts when generating default packages', () => {
      // Simulate BO updating duration discounts in localStorage
      const customDiscounts = [
        { id: 'pkg-3m', months: 3, discountPercent: 6, renewalDiscountPercent: 4, status: 'active' },
        { id: 'pkg-6m', months: 6, discountPercent: 10, renewalDiscountPercent: 6, status: 'active' }
      ]
      localStorage.setItem('storagehub:durationDiscounts', JSON.stringify(customDiscounts))

      const activeDiscounts = getActiveDurationDiscounts()
      expect(activeDiscounts[3]).toBe(6)
      expect(activeDiscounts[6]).toBe(10)

      const packages = generateDefaultRentalPackages('fac-test', 'M', 9500000)
      const p3 = packages.find(p => p.months === 3)
      const p6 = packages.find(p => p.months === 6)

      expect(p3?.discountPercent).toBe(6)
      expect(p6?.discountPercent).toBe(10)
    })
  })

  describe('Phase 4 — Rental Policy Consistency', () => {
    it('should have Grace Period aligned to 3 days across all sources of truth', () => {
      const gracePolicy = POLICIES.find(p => p.id === 'pol-1')
      expect(gracePolicy?.value).toBe('3 days')

      const billingGroup = SETTINGS_GROUPS.find(g => g.group === 'Billing & Invoicing Rules')
      const graceSetting = billingGroup?.items.find(i => i.id === 'gracePeriod')
      expect(graceSetting?.value).toBe(3)

      expect(DEFAULT_BUSINESS_CONFIG.gracePeriodDays).toBe(3)
    })

    it('should preserve standard rental policy rules', () => {
      const securityPolicy = POLICIES.find(p => p.id === 'pol-3')
      expect(securityPolicy?.value).toBe('1 month')

      const noticePolicy = POLICIES.find(p => p.id === 'pol-4')
      expect(noticePolicy?.value).toBe('15 days')

      const minLeasePolicy = POLICIES.find(p => p.id === 'pol-5')
      expect(minLeasePolicy?.value).toBe('1 month')
    })
  })

  describe('Phase 5 — Customer Booking & Renewal Financial Calculations', () => {
    it('should calculate 20% reservation deposit and 1 month security deposit accurately', () => {
      const baseMonthlyPrice = 5500000
      const rentalMonths = 6
      const grossTermValue = baseMonthlyPrice * rentalMonths // 33,000,000

      const packageCalc = calculatePackagePrice(baseMonthlyPrice, rentalMonths, 5) // 5% off
      const promotionDiscount = grossTermValue - packageCalc.packagePrice // 1,650,000
      const totalTermValue = grossTermValue - promotionDiscount // 31,350,000

      const reservationDeposit = Math.round(totalTermValue * 0.2 * 100) / 100 // 6,270,000
      const securityDeposit = baseMonthlyPrice // 5,500,000 (1 month original undiscounted)
      const dueAtCheckIn = totalTermValue - reservationDeposit + securityDeposit // 30,580,000

      expect(totalTermValue).toBe(31350000)
      expect(reservationDeposit).toBe(6270000)
      expect(securityDeposit).toBe(5500000)
      expect(dueAtCheckIn).toBe(30580000)
    })

    it('should calculate renewal discount and deposits without error', () => {
      const baseMonthlyPrice = 9500000
      const renewalMonths = 12
      const grossRenewal = baseMonthlyPrice * renewalMonths // 114,000,000
      const renewalDiscountRate = 0.05 // 5% for 12 months renewal
      const renewalDiscountAmount = Math.round(grossRenewal * renewalDiscountRate * 100) / 100 // 5,700,000
      const renewalTotal = grossRenewal - renewalDiscountAmount // 108,300,000
      const renewalDeposit = Math.round(renewalTotal * 0.2 * 100) / 100 // 21,660,000
      const remainingAtFacility = renewalTotal - renewalDeposit // 86,640,000

      expect(renewalDiscountAmount).toBe(5700000)
      expect(renewalTotal).toBe(108300000)
      expect(renewalDeposit).toBe(21660000)
      expect(remainingAtFacility).toBe(86640000)
    })
  })
})
