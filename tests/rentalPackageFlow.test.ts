import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateDefaultRentalPackages,
  calculatePackagePrice,
  calculateDiscountPercent,
  resolveRentalPackagesForUnit,
} from '../src/domain/packageRules'
import type { FacilityCustomUnitSpec, RentalPackage, StorageUnit } from '../src/types/storageHub'

describe('Rental Package Flow: BO Customization to Customer Selection', () => {
  it('1. Generates standard rental packages for 1, 3, 6, 12, 24 months with correct discounts', () => {
    const monthlyPrice = 5000000 // 5,000,000 VND/month
    const packages = generateDefaultRentalPackages('FAC-01', 'S', monthlyPrice)

    expect(packages).toHaveLength(5)

    const pkg1m = packages.find((p) => p.months === 1)
    const pkg3m = packages.find((p) => p.months === 3)
    const pkg6m = packages.find((p) => p.months === 6)
    const pkg12m = packages.find((p) => p.months === 12)
    const pkg24m = packages.find((p) => p.months === 24)

    expect(pkg1m).toBeDefined()
    expect(pkg1m?.discountPercent).toBe(0)
    expect(pkg1m?.packagePrice).toBe(5000000)
    expect(pkg1m?.monthlyEquivalentPrice).toBe(5000000)
    expect(pkg1m?.status).toBe('active')

    expect(pkg3m).toBeDefined()
    expect(pkg3m?.discountPercent).toBe(3)
    // 5,000,000 * 3 * 0.97 = 14,550,000
    expect(pkg3m?.packagePrice).toBe(14550000)
    expect(pkg3m?.monthlyEquivalentPrice).toBe(4850000)
    expect(pkg3m?.status).toBe('active')

    expect(pkg6m).toBeDefined()
    expect(pkg6m?.discountPercent).toBe(5)
    // 5,000,000 * 6 * 0.95 = 28,500,000
    expect(pkg6m?.packagePrice).toBe(28500000)
    expect(pkg6m?.monthlyEquivalentPrice).toBe(4750000)
    expect(pkg6m?.status).toBe('active')

    expect(pkg12m).toBeDefined()
    expect(pkg12m?.discountPercent).toBe(8)
    // 5,000,000 * 12 * 0.92 = 55,200,000
    expect(pkg12m?.packagePrice).toBe(55200000)
    expect(pkg12m?.monthlyEquivalentPrice).toBe(4600000)
    expect(pkg12m?.status).toBe('active')

    expect(pkg24m).toBeDefined()
    expect(pkg24m?.discountPercent).toBe(12)
    // 5,000,000 * 24 * 0.88 = 105,600,000
    expect(pkg24m?.packagePrice).toBe(105600000)
    expect(pkg24m?.monthlyEquivalentPrice).toBe(4400000)
    expect(pkg24m?.status).toBe('active')
  })

  it('2. Correctly calculates flat package prices and derived discount percentages', () => {
    // BO gives custom flat package price: 13,500,000 for 3 months instead of 15,000,000
    const monthlyPrice = 5000000
    const customPrice = 13500000
    const discount = calculateDiscountPercent(monthlyPrice, 3, customPrice)
    // 15,000,000 - 13,500,000 = 1,500,000 discount (10%)
    expect(discount).toBe(10)

    const recalculated = calculatePackagePrice(monthlyPrice, 3, discount)
    expect(recalculated.packagePrice).toBe(13500000)
    expect(recalculated.monthlyEquivalentPrice).toBe(4500000)
  })

  it('3. BO configures custom packages on Unit Spec S and deactivates 6-month package', () => {
    const defaultPkgs = generateDefaultRentalPackages('FAC-01', 'S', 5000000)

    // BO modifies 3-month package discount to 7% and sets 6-month package to inactive
    const modifiedPkgs: RentalPackage[] = defaultPkgs.map((pkg) => {
      if (pkg.months === 3) {
        const { packagePrice, monthlyEquivalentPrice } = calculatePackagePrice(5000000, 3, 7)
        return {
          ...pkg,
          discountPercent: 7,
          packagePrice,
          monthlyEquivalentPrice,
          name: 'Gói 3 tháng (Ưu đãi đặc biệt)',
        }
      }
      if (pkg.months === 6) {
        return {
          ...pkg,
          status: 'inactive',
        }
      }
      return pkg
    })

    const specS: FacilityCustomUnitSpec = {
      sizeCode: 'S',
      name: 'Kho Nhỏ (S)',
      lengthM: 8,
      widthM: 10,
      heightM: 5,
      maxLoadKg: 1000,
      monthlyPrice: 5000000,
      count: 5,
      rentalPackages: modifiedPkgs,
    }

    // Resolving packages for this spec returns the customized packages
    const resolved = resolveRentalPackagesForUnit(specS)
    expect(resolved).toHaveLength(5)

    const activeResolved = resolved.filter((p) => p.status === 'active')
    // 6-month package is inactive, so 4 active packages remain (1m, 3m, 12m, 24m)
    expect(activeResolved).toHaveLength(4)

    const active3m = activeResolved.find((p) => p.months === 3)
    expect(active3m?.name).toBe('Gói 3 tháng (Ưu đãi đặc biệt)')
    expect(active3m?.discountPercent).toBe(7)
    // 5,000,000 * 3 * 0.93 = 13,950,000
    expect(active3m?.packagePrice).toBe(13950000)

    // 6-month package must not be in active packages
    const active6m = activeResolved.find((p) => p.months === 6)
    expect(active6m).toBeUndefined()
  })

  it('4. Customer sees unit active packages and selects 3-month package with custom pricing', () => {
    const unit: Partial<StorageUnit> = {
      id: 'FAC-01-S-001',
      code: 'FAC-01-S-001',
      sizeCode: 'S',
      price: 5000000,
      facilityId: 'FAC-01',
      rentalPackages: [
        {
          id: 'pkg-s-3m-custom',
          facilityId: 'FAC-01',
          unitTypeId: 'S',
          months: 3,
          name: 'Gói 3 tháng Siêu Tiết Kiệm',
          packagePrice: 13500000,
          monthlyEquivalentPrice: 4500000,
          discountPercent: 10,
          status: 'active',
        },
        {
          id: 'pkg-s-6m-custom',
          facilityId: 'FAC-01',
          unitTypeId: 'S',
          months: 6,
          name: 'Gói 6 tháng',
          packagePrice: 28500000,
          monthlyEquivalentPrice: 4750000,
          discountPercent: 5,
          status: 'inactive',
        },
      ],
    }

    const activePackages = resolveRentalPackagesForUnit(unit as any).filter((p) => p.status === 'active')
    expect(activePackages).toHaveLength(1)
    expect(activePackages[0].id).toBe('pkg-s-3m-custom')
    expect(activePackages[0].packagePrice).toBe(13500000)

    // Gross price: 5,000,000 * 3 = 15,000,000
    const grossPrice = 5000000 * 3
    const discount = grossPrice - activePackages[0].packagePrice
    expect(discount).toBe(1500000)

    // Net price matches the BO configured package price exactly
    const netPrice = grossPrice - discount
    expect(netPrice).toBe(13500000)

    // Deposit is 20% of net price
    const deposit20Pct = Math.round(netPrice * 0.2)
    expect(deposit20Pct).toBe(2700000)
  })
})
