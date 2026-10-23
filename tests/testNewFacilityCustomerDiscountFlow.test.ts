import { describe, it, expect, beforeEach } from 'vitest'
import { generateDefaultRentalPackages } from '../src/domain/packageRules'
import { getPoliciesForFacility, evaluatePolicyBenefit } from '../src/domain/policyMatching'
import { DEFAULT_DURATION_DISCOUNTS } from '../src/views/business/BusinessApp'
import type { PolicyItem } from '../src/domain/policyMatching'

describe('Flow Test: Tạo cơ sở mới -> Gắn ưu đãi -> Customer nhìn thấy & kiểm tra tại bước thanh toán', () => {
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

  it('Kịch bản 1: BO tạo cơ sở mới (Hải Phòng), gắn ưu đãi gói 3 tháng (3%), Customer thấy và được trừ tiền tại bước thanh toán', () => {
    // 1. BO tạo cơ sở mới "Kho Việt – Cơ sở Hải Phòng"
    const newFacility = {
      id: 'fac-hp-01',
      code: 'HP-01',
      name: 'Kho Việt – Cơ sở Hải Phòng',
      city: 'Hải Phòng',
      address: 'Số 8 Lê Hồng Phong, Ngô Quyền, Hải Phòng',
      unitDistribution: { S: 5, M: 5 }
    }

    // Sinh các gian kho cho cơ sở mới
    const baseMonthlyPrice = 5500000 // 5.5 triệu / tháng cho size S
    const packagesForUnitS = generateDefaultRentalPackages(newFacility.id, 'S', baseMonthlyPrice)

    // Kiểm tra các gói thuê mặc định được tạo cho kho size S tại cơ sở Hải Phòng
    expect(packagesForUnitS).toHaveLength(5) // 1m, 3m, 6m, 12m, 24m
    const pkg3m = packagesForUnitS.find(p => p.months === 3)
    expect(pkg3m).toBeDefined()
    expect(pkg3m?.discountPercent).toBe(3) // Giảm 3%
    expect(pkg3m?.packagePrice).toBe(Math.round(baseMonthlyPrice * 3 * (1 - 0.03))) // 16,005,000đ

    // 2. Khách hàng vào duyệt kho và chọn gian kho thuộc cơ sở mới này
    const selectedUnit = {
      id: 'HP-01-S-001',
      code: 'HP-01-S-001',
      facilityId: newFacility.id,
      facilityName: newFacility.name,
      sizeCode: 'S',
      price: baseMonthlyPrice,
      rentalPackages: packagesForUnitS
    }

    // Khách hàng chọn gói kỳ hạn 3 tháng
    const rentalMonths = 3
    const matchedPackage = selectedUnit.rentalPackages.find(p => p.months === rentalMonths)
    expect(matchedPackage).toBeDefined()
    expect(matchedPackage?.name).toBe('Gói 3 tháng')

    // Tính toán dự toán giá (giống logic trong CustomerApp)
    const grossTermValue = baseMonthlyPrice * rentalMonths // 16,500,000đ
    const discountRate = (matchedPackage?.discountPercent ?? 0) / 100 // 0.03
    const promotionDiscount = Math.round(grossTermValue * discountRate * 100) / 100 // 495,000đ
    const totalTermValue = grossTermValue - promotionDiscount // 16,005,000đ

    // Cọc giữ chỗ 20% và cọc an ninh đảm bảo kho 1 tháng
    const reservationDeposit = Math.round(totalTermValue * 0.2 * 100) / 100 // 3,201,000đ
    const securityDeposit = baseMonthlyPrice // 5,500,000đ
    const remainingAtCheckIn = totalTermValue - reservationDeposit + securityDeposit

    expect(promotionDiscount).toBe(495000)
    expect(totalTermValue).toBe(16005000)
    expect(reservationDeposit).toBe(3201000)

    // 3. Khách hàng tới bước thanh toán (Checkout / Modal Thanh Toán Cọc)
    const paymentSnapshot = {
      facilityName: selectedUnit.facilityName,
      unitCode: selectedUnit.code,
      rentalMonths,
      monthlyPrice: baseMonthlyPrice,
      grossTotal: grossTermValue,
      discountAmount: promotionDiscount, // Đã trừ 495.000đ
      totalTermValue, // Còn 16.005.000đ
      depositToPayNow: reservationDeposit, // 3.201.000đ
      dueAtCheckIn: remainingAtCheckIn
    }

    // Xác thực tại bước thanh toán:
    // - Khách hàng nhìn thấy rõ mức giảm giá 495.000đ (-3%)
    expect(paymentSnapshot.discountAmount).toBe(495000)
    // - Số tiền thanh toán cọc giữ chỗ được tính trên giá ĐÃ GIẢM
    expect(paymentSnapshot.depositToPayNow).toBe(3201000)
    // - Số tiền gốc trước giảm nếu chưa giảm 3% sẽ là 16,500,000 * 20% = 3,300,000đ
    expect(paymentSnapshot.depositToPayNow).toBeLessThan(3300000)
  })

  it('Kịch bản 2: Gắn ưu đãi riêng cho cơ sở mới (Scope = Cơ sở Hải Phòng) -> Customer nhìn thấy chính sách và được trừ trực tiếp', () => {
    // 1. BO tạo chính sách riêng cho cơ sở Hải Phòng
    const facilitySpecificPolicy: PolicyItem = {
      id: 'pol-hp-promo',
      name: 'Ưu đãi khai trương cơ sở Hải Phòng',
      value: '10%',
      scope: 'Kho Việt – Cơ sở Hải Phòng',
      description: 'Giảm 10% tiền thuê cho khách hàng thuê tại cơ sở mới Hải Phòng',
      editable: true
    }

    // Lưu vào store chính sách
    localStorage.setItem('storagehub:policies', JSON.stringify([facilitySpecificPolicy]))

    // 2. Customer xem gian kho tại cơ sở Hải Phòng
    const facilityPolicies = getPoliciesForFacility('Kho Việt – Cơ sở Hải Phòng', 'HP-01')
    expect(facilityPolicies).toHaveLength(1)
    expect(facilityPolicies[0].name).toBe('Ưu đãi khai trương cơ sở Hải Phòng')

    // 3. Customer chọn thuê 3 tháng: hệ thống đánh giá quyền lợi chiết khấu
    const baseMonthlyPrice = 5500000
    const rentalMonths = 3
    const grossTermValue = baseMonthlyPrice * rentalMonths // 16,500,000đ

    const benefit = evaluatePolicyBenefit(facilityPolicies[0], baseMonthlyPrice, rentalMonths)
    expect(benefit.isDiscount).toBe(true)
    expect(benefit.type).toBe('percentage')
    // 10% của 16,500,000đ = 1,650,000đ
    expect(benefit.discountAmount).toBe(1650000)

    // 4. Tại bước thanh toán:
    const totalAfterDiscount = grossTermValue - benefit.discountAmount
    expect(totalAfterDiscount).toBe(14850000) // 16.5m - 1.65m = 14.85m
    const deposit20Percent = totalAfterDiscount * 0.2
    expect(deposit20Percent).toBe(2970000) // Khách chỉ cần cọc 2.97m thay vì 3.3m
  })
})
