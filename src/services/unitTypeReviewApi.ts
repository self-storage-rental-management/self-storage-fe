import { apiRequest } from './apiClient'
import type { ManagerUnitTypeInput } from './managerUnitTypeApi'

export interface UnitTypeReview {
  id: string
  unitTypeId: string
  facilityId: string
  facilityName: string
  unitTypeCode: string
  requesterName: string
  requestedBy: string
  createdAt: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  before: ManagerUnitTypeInput
  after: ManagerUnitTypeInput
  reviewedAt: string | null
  rejectionReason: string | null
  requiresRepricing: boolean
  currentMonthlyPrice: number | null
  currentSecurityDepositAmount: number | null
}
export async function listUnitTypeReviews() {
  return (await apiRequest<{ data: UnitTypeReview[] }>('/api/business/unit-type-changes')).data
}
export async function getUnitTypeReview(id: string) {
  return (await apiRequest<{ data: UnitTypeReview }>(`/api/business/unit-type-changes/${id}`)).data
}
export async function decideUnitTypeReview(id: string, approved: boolean, reason: string, monthlyPrice?: number, securityDepositAmount?: number) {
  return (await apiRequest<{ data: UnitTypeReview }>(`/api/business/unit-type-changes/${id}/review`, {
    method: 'POST', body: JSON.stringify({ approved, reason, monthlyPrice, securityDepositAmount }),
  })).data
}
