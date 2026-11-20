import type { CustomerUnitType, ReservationRecommendation } from '../../services/customerReservationApi'

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
