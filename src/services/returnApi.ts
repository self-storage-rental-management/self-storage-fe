import { apiRequest, ApiClientError } from './apiClient'
import { getAuthenticatedActor } from './authApi'
import { readRentalEnvelope, readRentalPage } from './rentalApi'
import { isUuid } from './renewalOperationsApi'

export type ReturnRole = 'customer' | 'staff' | 'manager' | 'business'
export const returnStatuses = ['requested', 'scheduled', 'inspected', 'awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'] as const
export interface OverdueSettlement {
  accruedAmount: number | null
  settlementAmount: number | null
  overdueDays: number | null
  calculatedAt: string | null
  requiresReconciliation: boolean
}
export function isOverdueSettlement(value: unknown): value is OverdueSettlement {
  if (!value || typeof value !== 'object') return false
  const v = value as OverdueSettlement
  const amount = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
  return typeof v.requiresReconciliation === 'boolean' && (v.requiresReconciliation
    ? v.accruedAmount === null && v.settlementAmount === null && v.overdueDays === null && v.calculatedAt === null
    : amount(v.accruedAmount) && amount(v.settlementAmount) && v.settlementAmount! <= v.accruedAmount!
      && amount(v.overdueDays) && typeof v.calculatedAt === 'string' && Number.isFinite(Date.parse(v.calculatedAt)))
}
export interface ApiReturn {
  id: string; rentalId: string; facilityId: string; customerId: string
  facilityName: string; unitNumber: string; customerName: string
  status: typeof returnStatuses[number]; scheduledDate: string
  inspectionNotes: string | null; managerResolutionNote: string | null
  customerNotes?: string | null
  customerDecisionNote?: string | null
  depositAmount: number | null; totalDeductions: number; netRefundAmount: number | null; amountDueFromCustomer: number | null
  settlementBlocker?: string | null; customerConfirmed: boolean
  damageFee: number; cleaningFee: number; lostItemFee: number; overdueFee: number; outstandingFee: number
  proposedUnitStatus: 'available' | 'maintenance' | null
  evidencePhotos?: string[]
  sourceType?: 'CUSTOMER_RETURN' | 'RECOVERY'
  recoveryTaskId?: string | null
  recoveryTaskStatus?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | null
  recoveryCompletedAt?: string | null
  overdueSettlement?: OverdueSettlement | null
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const money = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 999999999999.99 && Math.abs(v * 100 - Math.round(v * 100)) < 0.01
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
export function isApiReturn(v: unknown): v is ApiReturn {
  return object(v) && ['id', 'rentalId', 'facilityId', 'customerId'].every(k => isUuid(v[k])) &&
    (v.overdueSettlement == null || isOverdueSettlement(v.overdueSettlement)) &&
    ['facilityName', 'unitNumber', 'customerName'].every(k => typeof v[k] === 'string') && date(v.scheduledDate) &&
    returnStatuses.includes(v.status as ApiReturn['status']) && typeof v.customerConfirmed === 'boolean' && money(v.totalDeductions) &&
    ['damageFee', 'cleaningFee', 'lostItemFee', 'overdueFee', 'outstandingFee'].every(k => money(v[k])) &&
    (v.proposedUnitStatus === null || v.proposedUnitStatus === 'available' || v.proposedUnitStatus === 'maintenance') &&
    (v.evidencePhotos === undefined || (Array.isArray(v.evidencePhotos) && v.evidencePhotos.every(item => typeof item === 'string'))) &&
    ['depositAmount', 'netRefundAmount', 'amountDueFromCustomer'].every(k => v[k] === null || money(v[k])) &&
    ['inspectionNotes', 'managerResolutionNote', 'settlementBlocker', 'customerDecisionNote', 'customerNotes'].every(k => v[k] === undefined || v[k] === null || typeof v[k] === 'string') &&
    (v.sourceType === undefined ? v.recoveryTaskId == null && v.recoveryTaskStatus == null && v.recoveryCompletedAt == null :
      v.sourceType === 'CUSTOMER_RETURN' ? v.recoveryTaskId == null && v.recoveryTaskStatus == null && v.recoveryCompletedAt == null :
        v.sourceType === 'RECOVERY' && isUuid(v.recoveryTaskId) && ['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(String(v.recoveryTaskStatus)) &&
        (v.recoveryTaskStatus === 'CLOSED' ? v.status === 'completed' && typeof v.recoveryCompletedAt === 'string' && Number.isFinite(Date.parse(v.recoveryCompletedAt)) : v.recoveryCompletedAt === null))
}
type ReturnScope = 'READ' | 'OPERATE' | 'MANAGE'
const scopeRank: Record<ReturnScope, number> = { READ: 1, OPERATE: 2, MANAGE: 3 }
function facilityAllowed(a: NonNullable<ReturnType<typeof getAuthenticatedActor>>, facilityId: string, required: ReturnScope = 'READ') {
  if (a.roles.includes('ADMIN')) return true
  const actual = a.facilityScopes[facilityId]
  return !!actual && scopeRank[actual] >= scopeRank[required]
}
function actor(role: ReturnRole, write = false) {
  const a = getAuthenticatedActor()
  const roleAllowed = role === 'manager'
    ? a?.roles.some(r => r === 'MANAGER' || r === 'ADMIN')
    : role === 'business'
      ? a?.roles.some(r => r === 'BUSINESS' || r === 'ADMIN')
    : role === 'staff'
      ? a?.roles.some(r => r === 'STAFF' || r === 'ADMIN')
      : a?.roles.includes('CUSTOMER')
  if (!a || a.status !== 'ACTIVE' || !roleAllowed)
    throw new ApiClientError('Bạn không có quyền truy cập hồ sơ trả kho.', { status: 403 })
  const permission = write
    ? role === 'manager' ? 'rentals:update' : role === 'staff' ? 'returns:process' : 'refunds:execute'
    : 'returns:read'
  if (role !== 'customer' && !a.permissions.includes(permission))
    throw new ApiClientError('Bạn chưa có quyền xử lý hồ sơ trả kho.', { status: 403 })
  return a
}
function bound(value: unknown, role: ReturnRole, id?: string, rentalId?: string, requiredScope: ReturnScope = 'READ') {
  const a = actor(role)
  return readRentalEnvelope<ApiReturn>(value, v => isApiReturn(v) && (!id || v.id === id) && (!rentalId || v.rentalId === rentalId) &&
    (role !== 'customer' || v.customerId === a.id) && (role === 'customer' || facilityAllowed(a, v.facilityId, requiredScope)))
}
export async function listReturns(role: ReturnRole, page = 0, pageSize = 20) {
  const a = actor(role)
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Trang không hợp lệ.')
  return readRentalPage<ApiReturn>(await apiRequest(`/api/${role}/returns?page=${page}&pageSize=${pageSize}`),
    v => isApiReturn(v) && (role === 'customer' ? v.customerId === a.id : facilityAllowed(a, v.facilityId)), page)
}
export async function getReturn(role: ReturnRole, id: string) {
  actor(role); if (!isUuid(id)) throw new Error('Mã hồ sơ không hợp lệ.')
  return bound(await apiRequest(`/api/${role}/returns/${id}`), role, id)
}
export async function requestReturn(rentalId: string, scheduledDate: string, notes: string) {
  actor('customer', true)
  if (!isUuid(rentalId) || !date(scheduledDate) || notes.length > 2000) throw new Error('Kiểm tra ngày trả kho và ghi chú.')
  return bound(await apiRequest(`/api/customer/rentals/${rentalId}/return-request`, {
    method: 'POST', body: JSON.stringify({ scheduledDate, notes }),
  }), 'customer', undefined, rentalId)
}
export async function updateReturnRequest(id: string, scheduledDate: string, notes: string) {
  actor('customer', true)
  if (!isUuid(id) || !date(scheduledDate) || !notes.trim() || notes.length > 2000) throw new Error('Kiểm tra ngày trả kho và lý do.')
  return bound(await apiRequest(`/api/customer/returns/${id}/request`, {
    method: 'PATCH', body: JSON.stringify({ scheduledDate, notes }),
  }), 'customer', id)
}
export const feeKeys = ['damageFee', 'cleaningFee', 'lostItemFee', 'overdueFee', 'outstandingFee'] as const
export type ReturnFees = Record<typeof feeKeys[number], number>
export interface InspectionInput extends ReturnFees {
  inventoryMatch: 'match' | 'missing' | 'excess'; damageClassification: 'no_damage' | 'minor_damage' | 'major_damage' | 'abandoned_goods'
  staffNotes: string; evidencePhotos: string[]; returnedKey: boolean; returnedCard: boolean; returnedLock: boolean
  proposedUnitStatus: 'available' | 'maintenance'
}
async function mutate(role: ReturnRole, id: string, action: string, body: object) {
  actor(role, true); if (!isUuid(id)) throw new Error('Mã hồ sơ không hợp lệ.')
  return bound(await apiRequest(`/api/${role}/returns/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) }), role, id)
}
function fees(body: ReturnFees) { if (!feeKeys.every(k => money(body[k]))) throw new Error('Phí phải là số tiền VND không âm, tối đa hai chữ số thập phân.') }
export function inspectReturn(id: string, body: InspectionInput) {
  fees(body)
  if (!['match', 'missing', 'excess'].includes(body.inventoryMatch) ||
    !['no_damage', 'minor_damage', 'major_damage', 'abandoned_goods'].includes(body.damageClassification) ||
    !['available', 'maintenance'].includes(body.proposedUnitStatus) || body.staffNotes.length > 4000 ||
    !Array.isArray(body.evidencePhotos) || !body.evidencePhotos.every(p => typeof p === 'string') ||
    !['returnedKey', 'returnedCard', 'returnedLock'].every(k => typeof body[k as keyof InspectionInput] === 'boolean')) throw new Error('Kiểm tra thông tin nghiệm thu.')
  return mutate('staff', id, 'inspection', body)
}
export async function completeRefund(id: string, body: { transactionReference?: string; notes?: string } = {}) {
  const a = getAuthenticatedActor()
  if (!a || a.status !== 'ACTIVE' || !a.roles.some(role => role === 'STAFF' || role === 'BUSINESS' || role === 'ADMIN' || role === 'MANAGER')) {
    throw new ApiClientError('Bạn chưa có quyền thực hiện hoàn tiền.', { status: 403 })
  }
  if (body.transactionReference !== undefined && body.transactionReference.length > 120) {
    throw new Error('Mã giao dịch hoàn cọc không được vượt quá 120 ký tự.')
  }
  if (body.notes !== undefined && body.notes.length > 1000) {
    throw new Error('Ghi chú hoàn cọc không được vượt quá 1000 ký tự.')
  }
  if (!isUuid(id)) throw new Error('Mã hồ sơ không hợp lệ.')
  const resultRole: ReturnRole = a.roles.includes('BUSINESS') ? 'business' : a.roles.includes('STAFF') ? 'staff' : 'manager'
  const endpointRole = resultRole === 'business' ? 'business' : resultRole === 'manager' ? 'manager' : 'staff'
  const requiredScope: ReturnScope = resultRole === 'business' || resultRole === 'manager' ? 'MANAGE' : 'OPERATE'
  return bound(await apiRequest(`/api/${endpointRole}/returns/${id}/complete-refund`, {
    method: 'POST', body: JSON.stringify(body),
  }), resultRole, id, undefined, requiredScope)
}

export interface ReturnSettlementReceipt {
  amount: number
  paymentMethod: 'CASH' | 'BANK_TRANSFER'
  transactionReference: string
  receiptFileId: string
  confirmed: boolean
}
export function validateReturnSettlementReceipt(body: ReturnSettlementReceipt) {
  if (!money(body.amount) || body.amount <= 0 || !['CASH', 'BANK_TRANSFER'].includes(body.paymentMethod) || !body.transactionReference.trim()
    || body.transactionReference.length > 120 || !isUuid(body.receiptFileId) || body.confirmed !== true)
    throw new Error('Chọn phương thức, nhập mã giao dịch, tải biên lai và xác nhận đã thực thu hoặc thực hoàn tiền.')
}
export async function recordReturnSettlement(id: string, body: ReturnSettlementReceipt, key: string) {
  const a = actor('staff', true)
  if (!a.permissions.includes('payments:collect')) throw new ApiClientError('Bạn chưa có quyền ghi nhận thu hoặc hoàn tiền.', { status: 403 })
  if (!isUuid(id)) throw new Error('Mã hồ sơ trả kho không hợp lệ.')
  validateReturnSettlementReceipt(body)
  if (a.roles.includes('STAFF') && body.paymentMethod !== 'CASH') {
    throw new ApiClientError('Staff chỉ được ghi nhận thu tiền mặt trong phiên thu.', { status: 403 })
  }
  return bound(await apiRequest(`/api/staff/returns/${id}/settlement-receipts`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body),
  }), 'staff', id)
}

export interface ReturnEvidenceAsset {
  id: string
  originalName: string
  contentType: string
  sizeBytes: number
}

function readReturnEvidenceAsset(payload: unknown): ReturnEvidenceAsset {
  if (!object(payload) || !object(payload.data) || !isUuid(payload.data.id) ||
    typeof payload.data.originalName !== 'string' || typeof payload.data.contentType !== 'string' ||
    typeof payload.data.sizeBytes !== 'number') {
    throw new ApiClientError('Backend trả về bằng chứng trả kho không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return {
    id: payload.data.id,
    originalName: payload.data.originalName,
    contentType: payload.data.contentType,
    sizeBytes: payload.data.sizeBytes,
  }
}

export async function uploadReturnEvidence(returnId: string, file: File) {
  actor('staff', true)
  if (!isUuid(returnId)) throw new Error('Mã hồ sơ trả kho không hợp lệ.')
  if (!file || file.size <= 0) throw new Error('Tệp bằng chứng không được để trống.')
  const form = new FormData()
  form.set('file', file)
  form.set('entityType', 'RETURN_CASE')
  form.set('entityId', returnId)
  return readReturnEvidenceAsset(await apiRequest<unknown>('/api/files', { method: 'POST', body: form }))
}
export function reviewDispute(id: string, body: ReturnFees & { resolutionNote: string; proposedUnitStatus: 'available' | 'maintenance' }) {
  fees(body); if (!body.resolutionNote.trim() || body.resolutionNote.length > 2000) throw new Error('Nhập lý do giải quyết khiếu nại.')
  return mutate('manager', id, 'review-dispute', body)
}
export function confirmReturn(id: string, decision: 'accepted' | 'disputed', note: string) {
  if (decision === 'disputed' && !note.trim()) throw new Error('Nhập lý do yêu cầu xem xét lại.')
  if (note.length > 2000) throw new Error('Ghi chú quá dài.')
  return mutate('customer', id, 'confirm', { decision, note })
}
export function paySettlement(id: string, paymentMethod: string, notes = '') {
  if (!paymentMethod.trim() || paymentMethod.length > 40) throw new Error('Nhập phương thức thanh toán hợp lệ.')
  if (notes.length > 1000) throw new Error('Ghi chú thanh toán quá dài.')
  return mutate('customer', id, 'pay-settlement', { paymentMethod: paymentMethod.trim(), notes: notes.trim() || undefined })
}
export function returnError(error: unknown) {
  if (error instanceof ApiClientError) {
    const msg = error.message || ''
    if (error.status === 409 || msg.includes('409')) {
      if (msg === 'Cần đối soát lại phí quá hạn trước khi xác nhận hoặc thu hoàn tiền.') {
        return 'Cần cơ sở đối soát lại phí quá hạn trước khi xác nhận hoặc thu hoàn tiền.'
      }
      if (msg.includes('is not pending refund')) {
        return 'Hồ sơ chưa ở trạng thái chờ hoàn cọc (có thể đang chờ khách duyệt hoặc đang có khiếu nại).'
      }
      if (msg.includes('not in a state awaiting inspection')) {
        return 'Hồ sơ hiện không ở trạng thái chờ nghiệm thu hiện trường.'
      }
      if (msg.includes('not awaiting customer confirmation')) {
        return 'Hồ sơ chưa ở trạng thái chờ khách hàng xác nhận.'
      }
      if (msg.includes('not in disputed status')) {
        return 'Hồ sơ không ở trạng thái khiếu nại.'
      }
      if (msg.includes('Only active rentals')) {
        return 'Chỉ hợp đồng đang hoạt động mới được yêu cầu trả kho.'
      }
      if (msg.includes('Already in progress') || msg.includes('already in progress')) {
        return 'Đã có yêu cầu trả kho đang được xử lý cho hợp đồng này.'
      }
      if (msg && msg !== 'Conflict' && !msg.startsWith('Request failed with status 409')) {
        return msg
      }
      return 'Xung đột trạng thái (409): Vui lòng tải lại hồ sơ để kiểm tra.'
    }
    if (error.status === 403) return 'Bạn chưa có quyền xử lý hồ sơ trả kho tại cơ sở này.'
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 404) return 'Không tìm thấy hồ sơ trong phạm vi được truy cập.'
    return 'Chưa xác nhận được kết quả từ máy chủ. Tải lại hồ sơ trước khi gửi lại thao tác.'
  }
  return error instanceof Error ? error.message : 'Không thể xử lý hồ sơ trả kho.'
}
