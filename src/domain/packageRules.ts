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
 * Lấy mức chiết khấu kỳ hạn từ localStorage nếu có, fallback về DEFAULT_PACKAGE_DISCOUNTS
 */
export function getActiveDurationDiscounts(facilityId?: string): Record<number, number> {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null)
    const raw = storage?.getItem('storagehub:durationDiscounts')
    if (raw) {
      const list = JSON.parse(raw)
      if (Array.isArray(list) && list.length > 0) {
        const discounts: Record<number, number> = { ...DEFAULT_PACKAGE_DISCOUNTS }
        list.forEach((item: any) => {
          if (!item || typeof item.months !== 'number') return
          // Kiểm tra cơ sở áp dụng nếu có chỉ định facilityId
          if (
            facilityId &&
            item.scopeType === 'specific' &&
            Array.isArray(item.facilityIds) &&
            item.facilityIds.length > 0
          ) {
            if (!item.facilityIds.includes(facilityId)) return
          }
          if (item.status === 'active' && typeof item.discountPercent === 'number') {
            discounts[item.months] = item.discountPercent
          } else if (item.status === 'inactive') {
            discounts[item.months] = 0
          }
        })
        return discounts
      }
    }
  } catch {}
  return DEFAULT_PACKAGE_DISCOUNTS
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
 * Sinh danh sách các gói thuê mặc định (1, 3, 6, 12, 24 tháng) cho một cỡ kho
 */
export function generateDefaultRentalPackages(
  facilityId: string = '',
  unitTypeId: string = 'S',
  monthlyPrice: number = 0
): RentalPackage[] {
  const safeMonthlyPrice = Math.max(0, monthlyPrice)
  const prefix = facilityId ? `${facilityId}-` : ''
  const safeUnitType = (unitTypeId || 'S').toLowerCase()
  const activeDiscounts = getActiveDurationDiscounts(facilityId)

  return DEFAULT_PACKAGE_DURATIONS.map((months) => {
    const discount = activeDiscounts[months] ?? DEFAULT_PACKAGE_DISCOUNTS[months] ?? 0
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

function readConfiguredLocalDurationDiscounts(facilityId?: string): Array<{ months: number; discountPercent: number }> {
  try {
    const storage = typeof window !== 'undefined'
      ? window.localStorage
      : (typeof localStorage !== 'undefined' ? localStorage : null)
    const raw = storage?.getItem('storagehub:durationDiscounts')
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []

    return list
      .filter((item: any) => {
        if (!item || item.status !== 'active' || typeof item.months !== 'number' || item.months <= 0) return false
        if (
          facilityId &&
          item.scopeType === 'specific' &&
          Array.isArray(item.facilityIds) &&
          item.facilityIds.length > 0 &&
          !item.facilityIds.includes(facilityId)
        ) return false
        return true
      })
      .map((item: any) => ({
        months: Math.round(item.months),
        discountPercent: Math.max(0, Math.min(100, Number(item.discountPercent) || 0)),
      }))
      .filter((item, index, items) => items.findIndex(candidate => candidate.months === item.months) === index)
  } catch {
    return []
  }
}

function generateConfiguredRentalPackages(
  facilityId: string = '',
  unitTypeId: string = 'S',
  monthlyPrice: number = 0,
): RentalPackage[] {
  const safeMonthlyPrice = Math.max(0, monthlyPrice)
  const safeUnitType = unitTypeId || 'S'

  return readConfiguredLocalDurationDiscounts(facilityId).map(({ months, discountPercent }) => {
    const { packagePrice, monthlyEquivalentPrice } = calculatePackagePrice(
      safeMonthlyPrice,
      months,
      discountPercent,
    )
    return {
      id: `pkg-configured-${facilityId || 'all'}-${safeUnitType.toLowerCase()}-${months}m`,
      facilityId: facilityId || undefined,
      unitTypeId: safeUnitType,
      months,
      name: `Gói ${months} tháng`,
      packagePrice,
      monthlyEquivalentPrice,
      discountPercent,
      description: discountPercent > 0
        ? `Tiết kiệm ${discountPercent}% khi thanh toán kỳ hạn ${months} tháng`
        : `Gói thuê theo kỳ hạn ${months} tháng`,
      status: 'active' as const,
    }
  })
}

/**
 * Kiểm tra danh sách có đúng là bộ gói mặc định do phiên bản cũ tự sinh hay không.
 * Các gói này không phải cấu hình do BO tạo nên không được công bố cho Customer.
 */
export function isGeneratedDefaultRentalPackageList(
  packages?: RentalPackage[],
  facilityId?: string,
  unitTypeId?: string,
): boolean {
  if (!Array.isArray(packages) || packages.length !== DEFAULT_PACKAGE_DURATIONS.length) return false

  const expectedMonths = new Set<number>(DEFAULT_PACKAGE_DURATIONS)
  const safeUnitType = (unitTypeId || '').toLowerCase()
  const prefix = facilityId ? `${facilityId}-` : ''

  return packages.every((pkg) => {
    if (!expectedMonths.has(pkg.months) || pkg.name !== `Gói ${pkg.months} tháng`) return false
    if (pkg.id.startsWith('pkg-configured-')) return false

    const exactGeneratedId = safeUnitType
      ? `pkg-${prefix}${safeUnitType}-${pkg.months}m`
      : undefined
    const generatedIdPattern = /^pkg-(?:.+-)?[a-z0-9]+-\d+m$/i

    return pkg.id === exactGeneratedId || generatedIdPattern.test(pkg.id)
  })
}

/**
 * Chỉ trả về các gói đã được cấu hình. Không tự tạo gói mặc định khi chưa có cấu hình.
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
  if (Array.isArray(unitOrSpec.rentalPackages) && unitOrSpec.rentalPackages.length > 0) {
    return unitOrSpec.rentalPackages
  }

  return generateConfiguredRentalPackages(
    unitOrSpec.facilityId ?? '',
    unitOrSpec.sizeCode ?? unitOrSpec.size ?? 'S',
    unitOrSpec.monthlyPrice ?? unitOrSpec.price ?? 0,
  )
}
