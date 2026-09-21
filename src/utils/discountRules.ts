import type { DiscountRule } from '../types/storageHub'

export const DISCOUNT_MAP: Record<string, DiscountRule> = {
  WELCOME10: {
    code: 'WELCOME10',
    type: 'PERCENT',
    value: 10,
    firstRentalOnly: true,
    active: true,
  },
  FIRSTFREE: {
    code: 'FIRSTFREE',
    type: 'PERCENT',
    value: 100,
    firstRentalOnly: true,
    minRentalMonths: 3,
    active: true,
  },
  FALLSTORAGE25: {
    code: 'FALLSTORAGE25',
    type: 'PERCENT',
    value: 25,
    startAt: '2026-09-01T00:00:00',
    expiresAt: '2026-11-30T23:59:59',
    active: true,
  },
}

export interface DiscountValidationContext {
  monthlyRate: number
  deposit: number
  rentalMonths?: number
  facilityId?: string
  unitTypeId?: string
  hasPriorRentals?: boolean
  currentDate?: Date
}

export interface DiscountValidationResult {
  valid: boolean
  rule?: DiscountRule
  discountAmount: number
  originalMonthlyRate: number
  discountedMonthlyRate: number
  deposit: number
  amountDue: number
  messageVi: string
  messageEn: string
}

export function validateAndCalculateDiscount(
  code: string,
  context: DiscountValidationContext
): DiscountValidationResult {
  const normalizedCode = code.trim().toUpperCase()
  const monthlyRate = Math.max(0, context.monthlyRate)
  const deposit = Math.max(0, context.deposit)

  const emptyResult = (msgVi: string, msgEn: string): DiscountValidationResult => ({
    valid: false,
    discountAmount: 0,
    originalMonthlyRate: monthlyRate,
    discountedMonthlyRate: monthlyRate,
    deposit,
    amountDue: monthlyRate + deposit,
    messageVi: msgVi,
    messageEn: msgEn,
  })

  if (!normalizedCode) {
    return emptyResult('Vui lòng nhập mã giảm giá.', 'Please enter a discount code.')
  }

  const rule = DISCOUNT_MAP[normalizedCode]
  if (!rule) {
    return emptyResult(`Mã giảm giá "${normalizedCode}" không tồn tại.`, `Discount code "${normalizedCode}" not found.`)
  }

  if (!rule.active) {
    return emptyResult('Mã giảm giá này hiện đang tạm dừng.', 'This discount code is currently inactive.')
  }

  const now = context.currentDate ? context.currentDate.getTime() : Date.now()
  if (rule.startAt && now < new Date(rule.startAt).getTime()) {
    return emptyResult('Chương trình khuyến mãi này chưa bắt đầu.', 'This promotion has not started yet.')
  }
  if (rule.expiresAt && now > new Date(rule.expiresAt).getTime()) {
    return emptyResult('Mã giảm giá đã hết hạn sử dụng.', 'This discount code has expired.')
  }

  if (rule.firstRentalOnly && context.hasPriorRentals) {
    return emptyResult(
      'Mã này chỉ áp dụng cho hợp đồng thuê kho đầu tiên của khách hàng mới.',
      'This discount code is valid only for first-time customer rentals.'
    )
  }

  if (rule.minRentalMonths && (context.rentalMonths ?? 1) < rule.minRentalMonths) {
    return emptyResult(
      `Mã này yêu cầu thời gian thuê tối thiểu từ ${rule.minRentalMonths} tháng trở lên.`,
      `This discount requires a minimum rental period of ${rule.minRentalMonths} months.`
    )
  }

  if (rule.facilityIds && rule.facilityIds.length > 0 && context.facilityId) {
    if (!rule.facilityIds.includes(context.facilityId)) {
      return emptyResult('Mã giảm giá không áp dụng cho cơ sở kho này.', 'This code is not applicable at this facility.')
    }
  }

  if (rule.unitTypeIds && rule.unitTypeIds.length > 0 && context.unitTypeId) {
    if (!rule.unitTypeIds.includes(context.unitTypeId)) {
      return emptyResult('Mã giảm giá không áp dụng cho loại gian kho này.', 'This code is not valid for this unit type.')
    }
  }

  // Calculate discount amount (Applies only on monthlyRent, deposit is untouched)
  let discountAmount = 0
  if (rule.type === 'PERCENT') {
    discountAmount = Math.round((monthlyRate * rule.value) / 100)
  } else {
    discountAmount = Math.min(rule.value, monthlyRate)
  }

  if (rule.maxDiscountAmount && discountAmount > rule.maxDiscountAmount) {
    discountAmount = rule.maxDiscountAmount
  }

  discountAmount = Math.min(monthlyRate, Math.max(0, discountAmount))
  const discountedMonthlyRate = Math.max(0, monthlyRate - discountAmount)
  const amountDue = discountedMonthlyRate + deposit

  return {
    valid: true,
    rule,
    discountAmount,
    originalMonthlyRate: monthlyRate,
    discountedMonthlyRate,
    deposit,
    amountDue,
    messageVi: `Áp dụng thành công mã ${rule.code}: giảm ${rule.type === 'PERCENT' ? `${rule.value}%` : `$${rule.value}`} tiền thuê tháng đầu (-$${discountAmount}).`,
    messageEn: `Code ${rule.code} applied: ${rule.type === 'PERCENT' ? `${rule.value}%` : `$${rule.value}`} off first month rent (-$${discountAmount}).`,
  }
}
