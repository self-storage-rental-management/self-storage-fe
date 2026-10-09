import { ApiClientError } from '../../services/apiClient'
import type { ApiActor } from '../../services/authApi'
import { getRental, listRentals } from '../../services/rentalApi'
import { listRenewals } from '../../services/renewalApi'
import { listOverdueCases } from '../../services/overdueApi'
import { listSupportTickets } from '../../services/supportApi'
import type { RentalApiQuery } from '../../types/rentalApi'

export type ManagerApiMetric = 'rentals' | 'active-rentals' | 'pending-renewals' | 'open-support' | 'payment-overdue' | 'term-overdue'
export interface ManagerApiCount {
  value: number | null
  completeness: 'COMPLETE' | 'PARTIAL'
  reason?: string
}

export function managerApiIdentity(actor: ApiActor) {
  return JSON.stringify([actor.id, actor.status, actor.roles, actor.permissions, actor.facilityScopes])
}

export function requireManagerRead(actor: ApiActor | null, permission: 'rentals:read' | 'support:read') {
  if (!actor || actor.status !== 'ACTIVE' || !actor.roles.includes('MANAGER') ||
    !actor.permissions.includes(permission) || !Object.values(actor.facilityScopes).some(level => ['READ', 'OPERATE', 'MANAGE'].includes(level))) {
    throw new ApiClientError('Bạn chưa có quyền xem dữ liệu tại cơ sở này.', { status: 403, code: 'FORBIDDEN' })
  }
  return actor
}

function requireVisible(actor: ApiActor, facilityId: string | null | undefined) {
  if (!facilityId || !['READ', 'OPERATE', 'MANAGE'].includes(actor.facilityScopes[facilityId])) {
    throw new ApiClientError('Phản hồi chứa hồ sơ ngoài phạm vi cơ sở được phép truy cập.', { code: 'INVALID_RESPONSE' })
  }
}

function requireFiltered(valid: boolean) {
  if (!valid) throw new ApiClientError('Phản hồi không khớp bộ lọc đã yêu cầu.', { code: 'INVALID_RESPONSE' })
}

/** Uses existing validated clients and server totals, without business-data fallbacks. */
export async function loadManagerApiCount(metric: ManagerApiMetric, actor: ApiActor): Promise<ManagerApiCount> {
  requireManagerRead(actor, metric === 'open-support' ? 'support:read' : 'rentals:read')
  const query = { page: 0, size: 1 }
  if (metric === 'open-support') {
    const result = await listSupportTickets('manager', { ...query, status: 'open' })
    result.data.forEach(row => { requireVisible(actor, row.facilityId); requireFiltered(row.status === 'open') })
    return { value: result.pagination.totalItems, completeness: 'COMPLETE' }
  }
  if (metric === 'pending-renewals') {
    const result = await listRenewals('manager', { ...query, status: 'pending' })
    result.data.forEach(row => { requireVisible(actor, row.facility.id); requireFiltered(row.status === 'pending') })
    return { value: result.pagination.totalItems, completeness: 'COMPLETE' }
  }
  if (metric === 'payment-overdue' || metric === 'term-overdue') {
    const kind = metric === 'payment-overdue' ? 'PAYMENT_DUE' : 'RENTAL_TERM'
    const result = await listOverdueCases({ ...query, kind })
    requireFiltered(result.pagination.page === 0 && result.pagination.pageSize === 1)
    result.data.forEach(row => { requireVisible(actor, row.facilityId); requireFiltered(row.kind === kind) })
    if (result.completeness !== 'COMPLETE') return {
      value: null, completeness: 'PARTIAL',
      reason: 'Chưa đủ dữ liệu để xác định tổng số hồ sơ quá hạn. Xem chi tiết tại Theo dõi quá hạn.',
    }
    return { value: result.pagination.totalItems, completeness: 'COMPLETE' }
  }
  const result = await listRentals('manager', { ...query, ...(metric === 'active-rentals' ? { status: 'active' as const } : {}) })
  result.data.forEach(row => { requireVisible(actor, row.facility.id); requireFiltered(metric !== 'active-rentals' || row.status === 'active') })
  return { value: result.pagination.totalItems, completeness: 'COMPLETE' }
}

export async function loadManagerRentalPage(actor: ApiActor, query: RentalApiQuery) {
  requireManagerRead(actor, 'rentals:read')
  if (query.facilityId) requireVisible(actor, query.facilityId)
  const result = await listRentals('manager', query)
  result.data.forEach(row => {
    requireVisible(actor, row.facility.id)
    requireFiltered(!query.facilityId || row.facility.id === query.facilityId)
  })
  return result
}

export async function loadManagerRentalFinancial(actor: ApiActor, rentalId: string) {
  requireManagerRead(actor, 'rentals:read')
  const detail = await getRental('manager', rentalId)
  requireVisible(actor, detail.facility.id)
  return detail
}
