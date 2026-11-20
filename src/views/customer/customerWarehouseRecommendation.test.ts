import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { CompatibilityCheckResult, CustomerUnitType, PalletPlan, ReservationRecommendation } from '../../services/customerReservationApi'
import { sampleRackPallet } from '../../services/rackLayoutApi'
import { bookingAvailabilityIssue, resolveWarehouseRecommendation } from './customerWarehouseRecommendation'
import { ApiClientError } from '../../services/apiClient'
import CustomerWarehouseSuggestion from './CustomerWarehouseSuggestion'

const type: CustomerUnitType = {
  id: 'large', facilityId: 'facility', code: 'L', name: 'Kho lớn', status: 'active',
  lengthM: 12, widthM: 10, heightM: 5, areaM2: 120, volumeM3: 600, maxLoadKg: 1200,
  rackCount: 6, rackLengthM: 4, rackWidthM: 2, rackHeightM: 4.5,
  monthlyPrice: 9000000, securityDepositAmount: 9000000, imageUrl: null, availableCount: 0, createdAt: '', updatedAt: '',
}
const plan: PalletPlan = {
  palletLengthCm: sampleRackPallet.lengthCm, palletWidthCm: sampleRackPallet.widthCm,
  palletHeightCm: sampleRackPallet.heightCm, emptyPalletKg: sampleRackPallet.emptyKg,
  requiredPallets: 9, availableSlots: 36, totalLoadedWeightKg: 830, items: [], racks: [],
}
const check: CompatibilityCheckResult = {
  facilityId: 'facility', unitTypeId: 'large', startDate: '2026-11-17', endDate: '2027-02-17',
  result: 'COMPATIBLE', totalGoodsVolumeM3: 1, totalGoodsWeightKg: 605, unitVolumeM3: 600, unitMaxLoadKg: 1200,
  requiredRackCount: 1, unitRackCount: 6, availableUnitCount: 2, staffReviewRequired: false, issues: [], palletPlan: plan,
}
const recommendation: ReservationRecommendation = {
  facilityId: 'facility', recommendedUnitTypeId: 'large', pricingPackageCode: 'G3', policyVersion: null, rentalMonths: 3,
  result: 'COMPATIBLE', totalGoodsVolumeM3: 1, totalGoodsWeightKg: 605, recommendedAvailableUnitCount: 2,
  evaluatedUnitTypeIds: ['small', 'large'], incompatibleUnitTypeIds: ['small'], issues: [],
  checksByUnitType: { large: check },
}

it.each([
  ['Facility is not available for reservations', 'chọn cơ sở khác đang hoạt động'],
  ['Cơ sở hiện không nhận đơn đặt kho mới.', 'chọn cơ sở khác đang hoạt động'],
  ['Unit type is not available for reservations', 'chọn loại kho khác'],
  ['Rental package is not effective for the selected facility and date', 'chọn gói thuê hoặc ngày nhận kho khác'],
])('hướng dẫn bước tiếp theo khi API trả %s', (message, expected) => {
  expect(bookingAvailabilityIssue(new ApiClientError(message, { status: 409 }))).toContain(expected)
})

it('dùng kết quả còn gian của phép tính mới khi danh sách cũ báo hết gian', () => {
  expect(resolveWarehouseRecommendation(recommendation, 'facility', [type])).toEqual({ type, plan, check })
})

it('chỉ cho đổi sang loại kho cùng cơ sở, có cách xếp và còn gian', () => {
  expect(resolveWarehouseRecommendation(recommendation, 'other', [type])).toBeUndefined()
  for (const rejected of [{ ...check, palletPlan: null }, { ...check, availableUnitCount: 0 }]) {
    expect(resolveWarehouseRecommendation({ ...recommendation, checksByUnitType: { large: rejected } }, 'facility', [type])).toBeUndefined()
  }
})

it('giải thích vì sao kho được gợi ý vừa hàng và so sánh chi phí', () => {
  const html = renderToStaticMarkup(createElement(CustomerWarehouseSuggestion, {
    currentName: 'Kho S',
    suggestedName: 'Kho M', suggestedCheck: check, plan,
    priceComparison: {
      rentalMonths: 6,
      current: { discountRate: 0.05, rentAfterPackageDiscount: 31350000, securityDepositAmount: 5500000, reservationDepositAmount: 7370000 },
      suggested: { discountRate: 0.05, rentAfterPackageDiscount: 54150000, securityDepositAmount: 9500000, reservationDepositAmount: 12730000 },
    },
    actionLabel: 'Chuyển sang kho lớn hơn', disabled: false, onChoose: () => {},
  }))
  for (const expected of [
    'Kho M chứa tối đa 1.200 kg hàng', 'Đơn nặng 605 kg, nằm trong giới hạn của gian',
    'chiều dài 210 cm và chiều rộng 170 cm', '9 trong 36 khoang',
    'Có 2 gian phù hợp trong kỳ thuê đã chọn', 'Chuyển sang kho lớn hơn',
    'So sánh chi phí kỳ thuê 6 tháng', 'mức giảm 5%', '31.350.000 ₫', '54.150.000 ₫', '+22.800.000 ₫',
    'Tiền cọc đảm bảo kho', '+4.000.000 ₫', 'Phí giữ chỗ', '+5.360.000 ₫',
  ]) expect(html).toContain(expected)
})

it('nêu cách xoay kiện rộng 133 cm để vừa kho có tấm kê dài 140 cm', () => {
  const largerPlan = {
    ...plan, palletLengthCm: 140, palletWidthCm: 80, requiredPallets: 2, availableSlots: 12,
    items: [{ itemNumber: 1, quantity: 12, requiredPallets: 2, maxPiecesOnOnePallet: 6, allowedStackLayers: 1 }],
  }
  const html = renderToStaticMarkup(createElement(CustomerWarehouseSuggestion, {
    currentName: 'Kho S', suggestedName: 'Kho M',
    suggestedCheck: { ...check, totalGoodsWeightKg: 144, palletPlan: largerPlan }, plan: largerPlan,
    goodsItems: [{ category: 'FURNITURE', lengthCm: 12, widthCm: 133, heightCm: 12, quantity: 12, weightPerItemKg: 12, fragile: true }],
    actionLabel: 'Chuyển sang kho lớn hơn', disabled: false, onChoose: () => {},
  }))
  expect(html).toContain('Tấm kê của Kho M có chiều dài 140 cm và chiều rộng 80 cm.')
  expect(html).toContain('Hàng 1 xếp vừa khi xoay ngang. Chiều rộng kiện 133 cm đặt theo chiều dài tấm kê.')
  expect(html).toContain('2 trong 12 khoang')
})
