import { DISCOUNTS, type PromotionItem } from '../data/demoDatabase'
import { DISCOUNT_MAP, validateAndCalculateDiscount } from './discountRules'

export interface PromotionResult {
  promotion: PromotionItem | null
  discountAmount: number
  messageVi: string
  messageEn: string
}

interface PromotionContext {
  facilityName: string
  unitType: string
  rentalMonths: number
  baseMonthlyPrice: number
  dimSurcharge?: number
  hasPriorRentals?: boolean
  facilityId?: string
  unitTypeId?: string
}

export function evaluatePromotion(code: string, context: PromotionContext): PromotionResult {
  const normalizedCode = code.trim().toUpperCase()

  // First check if it exists in the primary DISCOUNT_MAP
  if (DISCOUNT_MAP[normalizedCode]) {
    const result = validateAndCalculateDiscount(normalizedCode, {
      monthlyRate: context.baseMonthlyPrice,
      deposit: context.baseMonthlyPrice, // standard deposit
      rentalMonths: context.rentalMonths,
      facilityId: context.facilityId,
      unitTypeId: context.unitTypeId,
      hasPriorRentals: context.hasPriorRentals ?? false
    })

    const dbItem = DISCOUNTS.find(item => item.code.toUpperCase() === normalizedCode)
    const fallbackItem: PromotionItem = dbItem ?? {
      id: `DSC-${result.rule!.code}`,
      code: result.rule!.code,
      name: result.rule!.code === 'WELCOME10' ? 'Welcome Discount' : result.rule!.code === 'FIRSTFREE' ? 'First Month Free' : 'Autumn Special',
      description: result.rule!.type === 'PERCENT' ? `${result.rule!.value}% off first month` : `$${result.rule!.value} off`,
      value: `${result.rule!.value}% OFF`,
      discount: `${result.rule!.value}% off`,
      type: result.rule!.type === 'PERCENT' ? 'percentage' : 'fixed-amount',
      typeLabel: result.rule!.type === 'PERCENT' ? 'Percentage Off' : 'Fixed Amount',
      active: result.rule!.active,
      status: result.rule!.active ? 'active' : 'paused',
      uses: 1,
      maxUses: 999,
      minLeaseMonths: result.rule!.minRentalMonths ?? 1,
      applicableFacility: 'All facilities',
      applicableUnitType: 'All Sizes',
      startDate: result.rule!.startAt ?? '2026-01-01',
      expires: result.rule!.expiresAt ?? '2026-12-31'
    }

    return {
      promotion: result.valid ? fallbackItem : null,
      discountAmount: result.valid ? result.discountAmount : 0,
      messageVi: result.messageVi,
      messageEn: result.messageEn
    }
  }

  const promotion = DISCOUNTS.find(item => item.code.toUpperCase() === normalizedCode) ?? null

  if (!promotion) {
    return { promotion: null, discountAmount: 0, messageVi: 'Mã giảm giá không tồn tại.', messageEn: 'Promotion code not found.' }
  }

  const now = Date.now()
  const isWithinCampaign = now >= new Date(promotion.startDate).getTime() && now <= new Date(promotion.expires).getTime()
  if (!promotion.active || promotion.status !== 'active' || promotion.uses >= promotion.maxUses || !isWithinCampaign) {
    return { promotion, discountAmount: 0, messageVi: 'Mã giảm giá đã hết hạn hoặc tạm dừng.', messageEn: 'This promotion is expired or unavailable.' }
  }

  if (context.rentalMonths < promotion.minLeaseMonths) {
    return {
      promotion,
      discountAmount: 0,
      messageVi: `Mã này yêu cầu kỳ thuê tối thiểu ${promotion.minLeaseMonths} tháng.`,
      messageEn: `This promotion requires a minimum ${promotion.minLeaseMonths}-month lease.`
    }
  }

  if (promotion.applicableFacility !== 'All facilities' && promotion.applicableFacility !== context.facilityName) {
    return { promotion, discountAmount: 0, messageVi: 'Mã không áp dụng tại cơ sở này.', messageEn: 'This promotion is not valid at this facility.' }
  }

  const allowedTypes = promotion.applicableUnitType.toLowerCase()
  if (allowedTypes !== 'all sizes' && !allowedTypes.includes(context.unitType.toLowerCase())) {
    return { promotion, discountAmount: 0, messageVi: 'Mã không áp dụng cho loại kho này.', messageEn: 'This promotion is not valid for this unit type.' }
  }

  if (promotion.code === 'BIZBULK15') {
    return { promotion, discountAmount: 0, messageVi: 'Mã này chỉ dành cho hợp đồng doanh nghiệp từ 2 kho.', messageEn: 'This code requires an enterprise lease of at least two units.' }
  }

  const chargeBeforeDeposit = context.baseMonthlyPrice + (context.dimSurcharge ?? 0)
  let discountAmount = 0
  if (promotion.type === 'percentage') {
    discountAmount = context.baseMonthlyPrice * (Number.parseFloat(promotion.value) / 100)
  } else if (promotion.type === 'first-month-free') {
    discountAmount = context.baseMonthlyPrice
  } else {
    discountAmount = Number.parseFloat(promotion.value.replace(/[^0-9.]/g, '')) || 0
  }

  discountAmount = Math.min(chargeBeforeDeposit, Math.round(discountAmount * 100) / 100)
  return {
    promotion,
    discountAmount,
    messageVi: `Đã áp dụng ${promotion.code}: giảm $${discountAmount.toFixed(2)}.`,
    messageEn: `${promotion.code} applied: $${discountAmount.toFixed(2)} off.`
  }
}
