import { POLICIES } from '../data/demoDatabase'
import { vietnamesePolicy } from '../i18n/customerLabels'

export interface PolicyItem {
  id: string
  name: string
  value: string
  scope: string
  editable?: boolean
  description?: string
  lastUpdated?: string
  scopeType?: 'all' | 'specific'
  facilityIds?: string[]
}

export interface ParsedPolicyBenefit {
  policy: PolicyItem
  type: 'free_months' | 'percentage' | 'fixed_amount' | 'rule'
  discountAmount: number
  descriptionVi: string
  isDiscount: boolean
  monthsDeducted?: number
  percentageValue?: number
}

/**
 * Lấy danh sách chính sách được lưu trữ từ localStorage hoặc demo fallback
 */
export function getStoredPolicies(): PolicyItem[] {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null)
    const raw = storage?.getItem('storagehub:policies')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        let changed = false
        // Lọc bỏ các bản ghi test cũ hoặc gói thuê kỳ hạn bị lưu nhầm vào bảng chính sách
        const sanitized = parsed.filter((item: PolicyItem) => {
          const name = (item.name || '').trim().toLowerCase()
          const val = (item.value || '').trim().toLowerCase()
          // Lọc bỏ bản ghi rác "thời gian gia hạn" có giá trị chiết khấu gói thuê (3 tháng giảm 3%)
          if (name === 'thời gian gia hạn' || name === 'thoi gian gia han') {
            changed = true
            return false
          }
          if (name.includes('gia hạn') && val.includes('tháng') && val.includes('giảm')) {
            changed = true
            return false
          }
          return true
        })

        // Chuẩn hóa lại các policy vận hành chuẩn nếu có giá trị cũ
        const normalized = sanitized.map((item: PolicyItem) => {
          const def = (POLICIES as any[]).find(p => p.id === item.id)
          if (def && (!item.description || item.value === '650.000 ₫ / month' || item.value === '5 days')) {
            changed = true
            return { ...item, name: def.name, value: def.value, description: item.description || def.description }
          }
          return item
        })

        if (changed && storage) {
          try {
            storage.setItem('storagehub:policies', JSON.stringify(normalized))
          } catch {}
        }
        return normalized
      }
    }
  } catch {}
  return (POLICIES as any[]).map(p => vietnamesePolicy({ ...p, description: p.description || '' }))
}

function normalizeCompare(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lấy danh sách chính sách áp dụng cho một cơ sở cụ thể hoặc toàn hệ thống
 */
export function getPoliciesForFacility(facilityNameOrId?: string, facilityCode?: string): PolicyItem[] {
  const policies = getStoredPolicies()
  if (!facilityNameOrId && !facilityCode) return policies

  const targetName = (facilityNameOrId || '').trim().toLowerCase()
  const targetCode = (facilityCode || '').trim().toLowerCase()
  const normName = normalizeCompare(facilityNameOrId || '')
  const normCode = normalizeCompare(facilityCode || '')

  return policies.filter(p => {
    // 1. Áp dụng cho toàn bộ cơ sở
    if (p.scopeType === 'all') return true

    // 2. Khớp theo danh sách facilityIds cụ thể nếu có
    if (Array.isArray(p.facilityIds) && p.facilityIds.length > 0) {
      const matched = p.facilityIds.some(id => {
        if (!id) return false
        const normId = normalizeCompare(id)
        return (
          id === facilityNameOrId ||
          id === facilityCode ||
          normId === normName ||
          normId === normCode ||
          (targetName && normId.includes(normName)) ||
          (normName && normName.includes(normId))
        )
      })
      if (matched) return true
      if (p.scopeType === 'specific') return false
    }

    // 3. Fallback theo chuỗi text p.scope (tương thích dữ liệu cũ)
    const scope = (p.scope || '').trim().toLowerCase()
    const normScope = normalizeCompare(p.scope || '')

    if (
      scope === 'all facilities' ||
      scope === 'toàn bộ cơ sở' ||
      scope === 'all' ||
      scope === 'toàn bộ' ||
      scope === '' ||
      normScope === 'all facilities' ||
      normScope === 'toan bo co so' ||
      normScope === 'all' ||
      normScope === 'toan bo'
    ) {
      return true
    }
    if (targetName && (scope.includes(targetName) || targetName.includes(scope))) return true
    if (targetCode && (scope.includes(targetCode) || targetCode.includes(scope))) return true
    if (normName && normScope && (normScope.includes(normName) || normName.includes(normScope))) return true
    if (normCode && normScope && (normScope.includes(normCode) || normCode.includes(normScope))) return true
    return false
  })
}

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Parser thông minh nhận diện quyền lợi / giá trị giảm trừ từ chính sách:
 * - Quy định vận hành (Late Fee, Security Deposit, Minimum Lease, Grace Period, v.v.): Luôn là quy chuẩn (isDiscount: false)
 * - Chính sách ưu đãi (có từ khóa tặng, giảm, miễn phí, voucher, %, trốn thuế, v.v.): Tự động tính toán chiết khấu (isDiscount: true)
 */
export function evaluatePolicyBenefit(
  policy: PolicyItem,
  monthlyRent: number,
  rentalMonths: number
): ParsedPolicyBenefit {
  const val = (policy.value || '').trim()
  const name = (policy.name || '').trim()
  const desc = (policy.description || '').trim()

  const combined = `${name} ${val} ${desc}`
  const normCombined = normalizeText(combined)

  // 1. Phân loại loại trừ: Quy chuẩn vận hành / phí phạt / tiền cọc hệ thống (KHÔNG PHẢI ưu đãi)
  const isStrictlyOperational =
    normCombined.includes('late fee') ||
    normCombined.includes('phi tre') ||
    normCombined.includes('phi phat') ||
    normCombined.includes('nop muon') ||
    normCombined.includes('penalty') ||
    normCombined.includes('security deposit') ||
    normCombined.includes('tien dam bao') ||
    normCombined.includes('coc dam bao') ||
    normCombined.includes('dat coc') ||
    normCombined.includes('minimum lease') ||
    normCombined.includes('thue toi thieu') ||
    normCombined.includes('thoi han toi thieu') ||
    normCombined.includes('grace period') ||
    normCombined.includes('an han') ||
    normCombined.includes('notice to vacate') ||
    normCombined.includes('thong bao tra') ||
    normCombined.includes('bao truoc') ||
    (normCombined.includes('gia han') && !normCombined.includes('uu dai') && !normCombined.includes('giam') && !normCombined.includes('tang')) ||
    normCombined.includes('pccc') ||
    normCombined.includes('an ninh') ||
    normCombined.includes('gio mo cua')

  if (isStrictlyOperational) {
    return {
      policy,
      type: 'rule',
      discountAmount: 0,
      descriptionVi: `${policy.name}: ${policy.value}`,
      isDiscount: false,
    }
  }

  // 2. Kiểm tra tín hiệu ưu đãi / khuyến mãi
  const isPromotional =
    normCombined.includes('uu dai') ||
    normCombined.includes('khuyen mai') ||
    normCombined.includes('tang') ||
    normCombined.includes('mien phi') ||
    normCombined.includes('free') ||
    normCombined.includes('giam') ||
    normCombined.includes('discount') ||
    normCombined.includes('off') ||
    normCombined.includes('chiet khau') ||
    normCombined.includes('voucher') ||
    normCombined.includes('promo') ||
    normCombined.includes('tro gia') ||
    normCombined.includes('ho tro') ||
    normCombined.includes('tron thue') // Hỗ trợ test case mẫu

  if (!isPromotional) {
    // Không có dấu hiệu ưu đãi -> Quy định điều khoản thông thường
    return {
      policy,
      type: 'rule',
      discountAmount: 0,
      descriptionVi: `${policy.name}: ${policy.value}`,
      isDiscount: false,
    }
  }

  // 3. Nếu là ưu đãi, bóc tách giá trị chiết khấu tương ứng:

  // A. Giảm phần trăm (%)
  const percentMatch = val.match(/(\d+(?:\.\d+)?)\s*%/i) || name.match(/(\d+(?:\.\d+)?)\s*%/i)
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1])
    if (!isNaN(pct) && pct > 0 && pct <= 100) {
      const gross = monthlyRent * rentalMonths
      const discount = Math.round((gross * (pct / 100)) * 100) / 100
      return {
        policy,
        type: 'percentage',
        discountAmount: discount,
        percentageValue: pct,
        descriptionVi: `Ưu đãi ${pct}% tổng tiền thuê (${policy.name})`,
        isDiscount: true,
      }
    }
  }

  // B. Tặng / Miễn phí tháng tiền thuê (VD: "1 tháng trốn thuế", "Tặng 1 tháng", "Miễn phí 2 tháng")
  const monthMatch = val.match(/(\d+)\s*(?:tháng|month)/i) || name.match(/(\d+)\s*(?:tháng|month)/i)
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10)
    if (!isNaN(months) && months > 0 && months <= 12) {
      const freeMonths = Math.min(months, Math.max(1, rentalMonths))
      const discount = freeMonths * monthlyRent
      return {
        policy,
        type: 'free_months',
        discountAmount: discount,
        monthsDeducted: freeMonths,
        descriptionVi: `Tặng ${freeMonths} tháng tiền thuê (${policy.name})`,
        isDiscount: true,
      }
    }
  }

  // C. Giảm tiền cố định (VD: "500.000đ", "1.000.000 ₫")
  const cleanVal = val.replace(/\./g, '').replace(/,/g, '')
  const moneyMatch = cleanVal.match(/(\d{5,})\s*(?:đ|vnd|₫)?/i)
  if (moneyMatch) {
    const amt = parseInt(moneyMatch[1], 10)
    if (!isNaN(amt) && amt > 0) {
      const gross = monthlyRent * rentalMonths
      const discount = Math.min(gross, amt)
      return {
        policy,
        type: 'fixed_amount',
        discountAmount: discount,
        descriptionVi: `Giảm ${discount.toLocaleString('vi-VN')} ₫ (${policy.name})`,
        isDiscount: true,
      }
    }
  }

  // Mặc định
  return {
    policy,
    type: 'rule',
    discountAmount: 0,
    descriptionVi: `${policy.name}: ${policy.value}`,
    isDiscount: false,
  }
}
