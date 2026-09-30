import type { RentalPackage } from '../types/storageHub'

export const DEFAULT_PACKAGE_DURATIONS = [1, 3, 6, 12, 24] as const

export const DEFAULT_PACKAGE_DISCOUNTS: Record<number, number> = {
  1: 0,
  3: 3,
  6: 5,
  12: 8,
  24: 12,
}

/**
 * Tính toán giá gói và giá tương đương theo tháng dựa trên giá cơ bản và % chiết khấu
 */
export function calculatePackagePrice(
  monthlyPrice: number,
  months: number,
  discountPercent: number
): { packagePrice: number; monthlyEquivalentPrice: number } {
  const safeMonths = Math.max(1, months)
  const safePrice = Math.max(0, monthlyPrice)
  const discountRate = Math.max(0, Math.min(100, discountPercent)) / 100
  const grossTotal = safePrice * safeMonths
  const packagePrice = Math.round(grossTotal * (1 - discountRate))
  const monthlyEquivalentPrice = Math.round(packagePrice / safeMonths)

  return { packagePrice, monthlyEquivalentPrice }
}

/**
 * Tính toán % chiết khấu dựa trên giá gói tổng và giá niêm yết theo tháng
 */
export function calculateDiscountPercent(
  monthlyPrice: number,
  months: number,
  packagePrice: number
): number {
  const safeMonths = Math.max(1, months)
  const safeBaseTotal = Math.max(0, monthlyPrice) * safeMonths
  if (safeBaseTotal <= 0 || packagePrice >= safeBaseTotal) return 0
  const discountRatio = (safeBaseTotal - packagePrice) / safeBaseTotal
  return Math.round(discountRatio * 100 * 10) / 10
}

/**
 * Sinh danh sách các gói thuê mặc định (1, 3, 6, 12 tháng) cho một cỡ kho
 */
export function generateDefaultRentalPackages(
  facilityId: string = '',
  unitTypeId: string = 'S',
  monthlyPrice: number = 0
): RentalPackage[] {
  const safeMonthlyPrice = Math.max(0, monthlyPrice)
  const prefix = facilityId ? `${facilityId}-` : ''
  const safeUnitType = (unitTypeId || 'S').toLowerCase()

  return DEFAULT_PACKAGE_DURATIONS.map((months) => {
    const discount = DEFAULT_PACKAGE_DISCOUNTS[months] ?? 0
    const { packagePrice, monthlyEquivalentPrice } = calculatePackagePrice(
      safeMonthlyPrice,
      months,
      discount
    )

    return {
      id: `pkg-${prefix}${safeUnitType}-${months}m`,
      facilityId: facilityId || undefined,
      unitTypeId: unitTypeId || 'S',
      months,
      name: `Gói ${months} tháng`,
      packagePrice,
      monthlyEquivalentPrice,
      discountPercent: discount,
      description:
        discount > 0
          ? `Tiết kiệm ${discount}% khi thanh toán kỳ hạn ${months} tháng`
          : `Gói thuê linh hoạt theo kỳ hạn ${months} tháng`,
      status: 'active' as const,
    }
  })
}

/**
 * Lấy danh sách gói thuê của kho, nếu chưa có sẽ sinh tự động từ giá tháng
 */
export function resolveRentalPackagesForUnit(
  unitOrSpec?: {
    rentalPackages?: RentalPackage[]
    monthlyPrice?: number
    price?: number
    sizeCode?: string
    size?: string
    facilityId?: string
  }
): RentalPackage[] {
  if (!unitOrSpec) return []

  const price = unitOrSpec.monthlyPrice ?? unitOrSpec.price ?? 0
  const size = unitOrSpec.sizeCode ?? unitOrSpec.size ?? 'S'
  const facId = unitOrSpec.facilityId ?? ''

  if (unitOrSpec.rentalPackages && unitOrSpec.rentalPackages.length > 0) {
    return unitOrSpec.rentalPackages
  }

  return generateDefaultRentalPackages(facId, size, price)
}
