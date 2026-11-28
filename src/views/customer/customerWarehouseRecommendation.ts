import type { CustomerUnitType, ReservationRecommendation } from '../../services/customerReservationApi'
import { ApiClientError } from '../../services/apiClient'

export function bookingAvailabilityIssue(error: unknown): string | undefined {
  if (!(error instanceof ApiClientError)) return
  const message = error.message
  if (message === 'Facility is not available for reservations' || message === 'Cơ sở hiện không nhận đơn đặt kho mới.') {
    return 'Cơ sở đã chọn hiện không nhận đơn đặt kho mới. Vui lòng đóng biểu mẫu và chọn cơ sở khác đang hoạt động.'
  }
  if (message === 'Unit type is not available for reservations') {
    return 'Loại kho đã chọn hiện không nhận đơn mới. Vui lòng chọn loại kho khác.'
  }
  if (message.includes('Rental package was not found')) {
    return 'Gói thuê đã chọn không còn khả dụng. Vui lòng chọn lại gói thuê và lấy báo giá mới.'
  }
  if (message.includes('Rental package is not effective')) {
    return 'Gói thuê đã chọn không áp dụng cho kỳ thuê này. Vui lòng chọn gói thuê hoặc ngày nhận kho khác.'
  }
  if (error.status === 409 && message.includes('No storage unit is available')) {
    return 'Loại kho này vừa hết chỗ trong kỳ thuê đã chọn. Vui lòng chọn kỳ thuê hoặc loại kho khác.'
  }
}

export function resolveWarehouseRecommendation(
  recommendation: ReservationRecommendation | null | undefined,
  facilityId: string | undefined,
  unitTypes: CustomerUnitType[],
) {
  if (!recommendation || recommendation.facilityId !== facilityId || !recommendation.recommendedUnitTypeId) return
  const id = recommendation.recommendedUnitTypeId
  const check = recommendation.checksByUnitType?.[id]
  const plan = check?.palletPlan
  if (!check || !plan || check.facilityId !== facilityId || check.unitTypeId !== id
    || check.result === 'INCOMPATIBLE' || check.availableUnitCount <= 0) return
  const type = unitTypes.find(candidate => candidate.facilityId === facilityId && candidate.id === id)
  if (type) return { type, plan, check }
}
