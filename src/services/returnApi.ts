import { apiRequest, ApiClientError } from './apiClient'
import { getAuthenticatedActor } from './authApi'
import { readRentalEnvelope, readRentalPage } from './rentalApi'
import { isUuid } from './renewalOperationsApi'

export type ReturnRole = 'customer' | 'staff' | 'manager' | 'business'
export const returnStatuses = ['requested', 'scheduled', 'inspected', 'awaiting_business_review', 'awaiting_customer_confirmation', 'disputed', 'payment_due', 'refund_pending', 'completed'] as const
export interface OverdueSettlement {
  accruedAmount: number | null
  settlementAmount: number | null
  overdueDays: number | null
  calculatedAt: string | null
  requiresReconciliation: boolean
}
export interface ReturnSettlementReceiptView {
  direction: 'COLLECTION' | 'REFUND' | 'OFFSET'
  amount: number
  paymentMethod: string
  transactionReference: string
  receiptFileId: string | null
  recordedAt: string
}
export interface EarlyTerminationPolicyView {
  type: 'NO_GOODS_MOVED_IN' | 'GOODS_MOVED_IN' | string
  earlyTerminationFee: number
  billableSetupDays: number
  usedGoodsCharge: number
  totalRentalCharge: number
  rentalRefundAmount: number
  noticeDays: number
}
export interface ActiveReturnPolicyView {
  recalculationRequired: boolean
  completedRentalMonths: number
  pricingTierMonths: number | null
  setupDaysUsed: number
  chargeableSetupDays: number
  rentalDaysUsed: number
  noticeShortfallDays: number
  dailyPrice: number
  earlyTerminationFee: number
  noticeCharge: number
  totalRentalCharge: number
  rentalRefundAmount: number
  noticeDays: number
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
  setupExitRequested?: boolean
  setupEarlyExit?: boolean
  setupReturnedAt?: string | null
  setupEarlyExitPolicyVersion?: string | null
  rentalRefundCredit?: number | null
  earlyTerminationFee?: number | null
  id: string; rentalId: string; facilityId: string; customerId: string
  facilityName: string; unitNumber: string; customerName: string
  storageUnitId?: string
  customerEmail?: string | null
  customerPhone?: string | null
  requestedAt?: string | null
  completedAt?: string | null
  settlementPaymentId?: string | null
  settlementPaidAt?: string | null
  returnedKey?: boolean
  returnedCard?: boolean
  returnedLock?: boolean
  inventoryMatch?: 'match' | 'missing' | 'excess' | null
  damageClassification?: 'no_damage' | 'minor_damage' | 'major_damage' | 'abandoned_goods' | null
  settlementReceipt?: { direction: string; amount: number; paymentMethod: string; transactionReference: string; receiptFileId: string | null; recordedAt: string } | null
  status: typeof returnStatuses[number]; scheduledDate: string
  returnType?: 'CANCELLED_IN_SETUP' | 'RETURN_IN_SETUP' | 'EARLY_RETURN' | 'NORMAL'
  settlementMode?: 'AUTO' | 'MANUAL_REVIEW'
  inspectionNotes: string | null; managerResolutionNote: string | null
  customerNotes?: string | null
  customerDecisionNote?: string | null
  inspectedAt?: string | null
  depositAmount: number | null; totalDeductions: number; netRefundAmount: number | null; amountDueFromCustomer: number | null
  settlementBlocker?: string | null; customerConfirmed: boolean
  damageFee: number; cleaningFee: number; lostItemFee: number; overdueFee: number; outstandingFee: number
  proposedUnitStatus: 'available' | 'maintenance' | null
  evidencePhotos?: string[]
  sourceType?: 'CUSTOMER_RETURN' | 'RECOVERY'
  recoveryTaskId?: string | null
  recoveryTaskStatus?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | null
  recoveryCompletedAt?: string | null
  settlementPaymentId?: string | null
  settlementPaidAt?: string | null
  completedAt?: string | null
  setupExitReviewRequired?: boolean
  moveInCompletedAt?: string | null
  settlementReceipt?: ReturnSettlementReceiptView | null
  overdueSettlement?: OverdueSettlement | null
  earlyTerminationPolicy?: EarlyTerminationPolicyView | null
  activeReturnPolicy?: ActiveReturnPolicyView | null
  legacyPricingReviewRequired?: boolean
  legacyPricingSnapshotAvailable?: boolean
  legacyPricingEvidenceFileId?: string | null
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const money = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 999999999999.99 && Math.abs(v * 100 - Math.round(v * 100)) < 0.01
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
export function isApiReturn(v: unknown): v is ApiReturn {
  const rawTerminationPolicy = object(v) ? v.earlyTerminationPolicy : undefined
  const terminationPolicy = object(rawTerminationPolicy) ? rawTerminationPolicy : null
  const rawActivePolicy = object(v) ? v.activeReturnPolicy : undefined
  const activePolicy = object(rawActivePolicy) ? rawActivePolicy : null
  return object(v) && ['id', 'rentalId', 'facilityId', 'customerId'].every(k => isUuid(v[k])) &&
    (v.returnType === undefined || ['CANCELLED_IN_SETUP', 'RETURN_IN_SETUP', 'EARLY_RETURN', 'NORMAL'].includes(String(v.returnType))) &&
    (v.settlementMode === undefined || ['AUTO', 'MANUAL_REVIEW'].includes(String(v.settlementMode))) &&
    (v.overdueSettlement == null || isOverdueSettlement(v.overdueSettlement)) &&
    (terminationPolicy == null || (
      typeof terminationPolicy.type === 'string' &&
      (['earlyTerminationFee', 'usedGoodsCharge', 'totalRentalCharge', 'rentalRefundAmount'] as const).every(k => money(terminationPolicy[k])) &&
      Number.isInteger(terminationPolicy.billableSetupDays) && Number(terminationPolicy.billableSetupDays) >= 0 &&
      Number.isInteger(terminationPolicy.noticeDays) && Number(terminationPolicy.noticeDays) >= 0
    )) &&
    (activePolicy == null || (
      typeof activePolicy.recalculationRequired === 'boolean' &&
      Number.isInteger(activePolicy.completedRentalMonths) && Number(activePolicy.completedRentalMonths) >= 0 &&
      (activePolicy.pricingTierMonths === null || Number.isInteger(activePolicy.pricingTierMonths)) &&
      ['setupDaysUsed', 'chargeableSetupDays', 'rentalDaysUsed', 'noticeShortfallDays'].every(k => Number.isInteger(activePolicy[k]) && Number(activePolicy[k]) >= 0) &&
      ['dailyPrice', 'earlyTerminationFee', 'noticeCharge', 'totalRentalCharge', 'rentalRefundAmount'].every(k => money(activePolicy[k])) &&
      Number.isInteger(activePolicy.noticeDays) && Number(activePolicy.noticeDays) >= 0
    )) &&
    (v.settlementReceipt == null || (
      object(v.settlementReceipt) &&
      ['COLLECTION', 'REFUND', 'OFFSET'].includes(String(v.settlementReceipt.direction)) &&
      money(v.settlementReceipt.amount) &&
      typeof v.settlementReceipt.paymentMethod === 'string' &&
      typeof v.settlementReceipt.transactionReference === 'string' &&
      (v.settlementReceipt.receiptFileId === null || isUuid(v.settlementReceipt.receiptFileId)) &&
      typeof v.settlementReceipt.recordedAt === 'string' &&
      Number.isFinite(Date.parse(v.settlementReceipt.recordedAt))
    )) &&
    (v.settlementPaymentId === undefined || v.settlementPaymentId === null || typeof v.settlementPaymentId === 'string') &&
    (v.settlementPaidAt === undefined || v.settlementPaidAt === null || (typeof v.settlementPaidAt === 'string' && Number.isFinite(Date.parse(v.settlementPaidAt)))) &&
    (v.completedAt === undefined || v.completedAt === null || (typeof v.completedAt === 'string' && Number.isFinite(Date.parse(v.completedAt)))) &&
    (v.setupExitReviewRequired === undefined || typeof v.setupExitReviewRequired === 'boolean') &&
    (v.legacyPricingReviewRequired === undefined || typeof v.legacyPricingReviewRequired === 'boolean') &&
    (v.legacyPricingSnapshotAvailable === undefined || typeof v.legacyPricingSnapshotAvailable === 'boolean') &&
    (v.legacyPricingEvidenceFileId === undefined || v.legacyPricingEvidenceFileId === null || isUuid(v.legacyPricingEvidenceFileId)) &&
    (v.moveInCompletedAt === undefined || v.moveInCompletedAt === null || (typeof v.moveInCompletedAt === 'string' && Number.isFinite(Date.parse(v.moveInCompletedAt)))) &&
    ['facilityName', 'unitNumber', 'customerName'].every(k => typeof v[k] === 'string') && date(v.scheduledDate) &&
    returnStatuses.includes(v.status as ApiReturn['status']) && typeof v.customerConfirmed === 'boolean' && money(v.totalDeductions) &&
    ['damageFee', 'cleaningFee', 'lostItemFee', 'overdueFee', 'outstandingFee'].every(k => money(v[k])) &&
    (v.proposedUnitStatus === null || v.proposedUnitStatus === 'available' || v.proposedUnitStatus === 'maintenance') &&
    (v.evidencePhotos === undefined || (Array.isArray(v.evidencePhotos) && v.evidencePhotos.every(item => typeof item === 'string'))) &&
    ['depositAmount', 'netRefundAmount', 'amountDueFromCustomer'].every(k => v[k] === null || money(v[k])) &&
    ['inspectionNotes', 'managerResolutionNote', 'settlementBlocker', 'customerDecisionNote', 'customerNotes', 'inspectedAt'].every(k => v[k] === undefined || v[k] === null || typeof v[k] === 'string') &&
    (v.sourceType === undefined ? v.recoveryTaskId == null && v.recoveryTaskStatus == null && v.recoveryCompletedAt == null :
      v.sourceType === 'CUSTOMER_RETURN' ? v.recoveryTaskId == null && v.recoveryTaskStatus == null && v.recoveryCompletedAt == null :
        v.sourceType === 'RECOVERY' && isUuid(v.recoveryTaskId) && ['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(String(v.recoveryTaskStatus)) &&
        (v.recoveryTaskStatus === 'CLOSED' ? v.status === 'completed' && typeof v.recoveryCompletedAt === 'string' && Number.isFinite(Date.parse(v.recoveryCompletedAt)) : v.recoveryCompletedAt === null))
}
type ReturnScope = 'READ' | 'OPERATE' | 'MANAGE'
const scopeRank: Record<ReturnScope, number> = { READ: 1, OPERATE: 2, MANAGE: 3 }
function facilityAllowed(a: NonNullable<ReturnType<typeof getAuthenticatedActor>>, facilityId: string, required: ReturnScope = 'READ') {
  if (a.roles.includes('ADMIN')) return true
  if (a.roles.includes('BUSINESS')) {
    if (!a.facilityScopes || Object.keys(a.facilityScopes).length === 0) return true
    const actual = a.facilityScopes[facilityId]
    return !!actual && scopeRank[actual] >= scopeRank[required]
  }
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
  unitVacated?: boolean
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
export async function completeRefund(id: string, body: {
  transactionReference?: string
  notes?: string
  receiptFileId?: string
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'VNPAY'
  originalPaymentId?: string
} = {}) {
  const business = getAuthenticatedActor()?.roles.includes('BUSINESS') === true
  const role: ReturnRole = business ? 'business' : 'staff'
  const a = actor(role, true)
  if (!a.permissions.includes('refunds:execute')) {
    throw new ApiClientError('Bạn chưa có quyền thực hiện hoàn tiền.', { status: 403 })
  }
  if (body.transactionReference !== undefined && body.transactionReference.length > 120) {
    throw new Error('Mã giao dịch hoàn cọc không được vượt quá 120 ký tự.')
  }
  if (body.notes !== undefined && body.notes.length > 1000) {
    throw new Error('Ghi chú hoàn cọc không được vượt quá 1000 ký tự.')
  }
  const gateway = body.paymentMethod === 'VNPAY'
  if (!isUuid(id) || (!business && !gateway && !isUuid(body.receiptFileId)) || (gateway && !isUuid(body.originalPaymentId))) throw new Error('Mã hồ sơ hoặc giao dịch gốc hoàn tiền không hợp lệ.')
  if ((!gateway && !body.transactionReference?.trim()) || (!business && !gateway && !body.paymentMethod) || (gateway && !body.originalPaymentId)) {
    throw new Error('Cần mã giao dịch, phương thức thanh toán và biên lai thực tế.')
  }
  return bound(await apiRequest(`/api/${role}/returns/${id}/complete-refund`, {
    method: 'POST', body: JSON.stringify(body),
  }), role, id, undefined, business ? 'MANAGE' : 'OPERATE')
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
export async function recordReturnSettlement(id: string, body: ReturnSettlementReceipt, key: string, role: ReturnRole = 'staff') {
  const a = actor(role, true)
  if (!a.permissions.includes('payments:collect') && !a.permissions.includes('refunds:execute')) throw new ApiClientError('Bạn chưa có quyền ghi nhận thu hoặc hoàn tiền.', { status: 403 })
  if (!isUuid(id)) throw new Error('Mã hồ sơ trả kho không hợp lệ.')
  validateReturnSettlementReceipt(body)

  if (role === 'business') return completeRefund(id, body)
  return bound(await apiRequest(`/api/${role}/returns/${id}/settlement-receipts`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body),
  }), role, id)
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

export async function uploadReturnEvidence(returnId: string, file: File, role: ReturnRole = 'staff') {
  actor(role, true)
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
export async function decideSetupExit(id: string, approvedRefundAmount: number, resolutionNote: string, approvedRentalRefundAmount?: number) {
  const a = actor('business')
  if (!a.permissions.includes('refunds:approve')) throw new ApiClientError('Bạn chưa có quyền duyệt hoàn tiền.', { status: 403 })
  if (!isUuid(id) || !money(approvedRefundAmount) || (approvedRentalRefundAmount !== undefined && !money(approvedRentalRefundAmount)) || !resolutionNote.trim() || resolutionNote.length > 2000) {
    throw new Error('Nhập số tiền hoàn hợp lệ và lý do quyết định.')
  }
  return bound(await apiRequest(`/api/business/returns/${id}/setup-exit-decision`, {
    method: 'POST',
    body: JSON.stringify({ approvedRefundAmount, approvedRentalRefundAmount, resolutionNote: resolutionNote.trim() }),
  }), 'business', id, undefined, 'MANAGE')
}
export async function decideLegacyPricing(id: string, body: {
  approvedRentalCharge: number
  approvedRentalRefund: number
  resolutionNote: string
  pricingSnapshotJson: string
  sourceDocumentFileId: string
}) {
  const a = actor('business')
  if (!a.permissions.includes('refunds:approve')) throw new ApiClientError('Bạn chưa có quyền duyệt hoàn tiền.', { status: 403 })
  if (!isUuid(id) || !money(body.approvedRentalCharge) || !money(body.approvedRentalRefund) ||
    !body.resolutionNote.trim() || body.resolutionNote.length > 2000 ||
    !body.pricingSnapshotJson.trim() || body.pricingSnapshotJson.length > 12000 ||
    !isUuid(body.sourceDocumentFileId)) {
    throw new Error('Thiếu snapshot giá cũ hoặc bằng chứng hợp đồng/báo giá.')
  }
  try {
    const parsed = JSON.parse(body.pricingSnapshotJson)
    if (parsed === null || (typeof parsed !== 'object')) throw new Error('invalid')
  } catch {
    throw new Error('Snapshot giá cũ phải là JSON hợp lệ.')
  }
  return bound(await apiRequest(`/api/business/returns/${id}/legacy-pricing-decision`, {
    method: 'POST',
    body: JSON.stringify({ ...body, resolutionNote: body.resolutionNote.trim() }),
  }), 'business', id, undefined, 'MANAGE')
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
      if (msg.includes('verified paid security deposit')) {
        return 'Tiền cọc đảm bảo chưa xác nhận thành công.'
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
