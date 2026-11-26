import type { InventoryDecision } from './inventoryDecision'
import { ApiClientError, apiDownload, apiRequest } from './apiClient'
import type { GoodsItemInput, GoodsCategory } from './customerReservationApi'
import { isCheckInStatus, isReservationStatus, isPaymentStatus, type CheckInStatus as WorkflowCheckInStatus, type ReservationStatus, type PaymentStatus } from '../types/statusContracts'
import { renameEvidenceFile } from '../utils/evidenceFileName'

export type CheckInStatus = WorkflowCheckInStatus | null
export type CheckInListStatus = 'UNSCHEDULED' | 'RECOVERY_TRANSFERRED' | NonNullable<CheckInStatus>
export type CheckInGroup = 'ONGOING' | 'PROCESSED'
export type CheckInReservationStatus = ReservationStatus
export type InventoryVisit = {
  access?: { completionDeadlineAt: string | null; writable: boolean; blockedReason: string | null; recoveryTransferred?: boolean } | null
  appointmentAt: string | null
  arrivedAt: string | null
  identityVerifiedAt: string | null
  verifiedByName: string | null
  photoId: string | null
}
export type InventoryResolutionStatus =
  | 'NOT_STARTED'
  | 'PENDING_CUSTOMER'
  | 'PENDING_STAFF_RESOLUTION'
  | 'ACCEPTED'
  | 'PARTIAL_ACCEPTED'
  | 'TRANSFER_REQUESTED'
  | 'RETURN_REQUESTED'
  | 'RECOVERY_REQUIRED'

export interface CheckInChecklist {
  identityVerified: boolean
  reservationMatched: boolean
  contractVerified: boolean
  paymentVerified: boolean
  measurementVerified: boolean
  unitWalkthrough: boolean
  conditionRecorded: boolean
  accessHandedOver: boolean
}

export interface CheckInInventoryLine {
  actualGoods?: GoodsItemInput | null
  actualCategoryId?: string | null
  actualMaterialId?: string | null
  goodsItemId: string
  actualQuantity: number
  condition: 'INTACT' | 'DAMAGED' | 'NOT_PRESENT'
  note: string | null
  measurements?: {
    lengthCm: number
    widthCm: number
    heightCm: number
    weightKg: number
  } | null
}

export interface CompleteCheckInRequest {
  inventoryLines?: CheckInInventoryLine[] | null
  checklist: CheckInChecklist
  identityDocumentNumber: string
  identityVerificationNote: string | null
  actualMeasurements: {
    lengthCm: number
    widthCm: number
    heightCm: number
    weightKg: number
    actualVolumeM3: number
    varianceAccepted: boolean
  }
  varianceReason: string | null
  initialUnitCondition: string
  goodsCondition: string
  packageCount: number
  goodsCategory: string
  goodsMaterial: string
  actualPackagingMethod?: string | null
  packagingCondition?: 'INTACT' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'UNPACKAGED' | null
  evidenceReferences: string[]
  handedOverItems: string[]
  notes: string
  lockReference: string
}

export interface HandoverRecord {
  facilityName: string
  facilityAddress: string
  handedOverBy: string
  handedOverByName: string
  handedOverAt: string
  items: { name: string; quantity: number }[]
  signedRecordReference: string | null
  note: string | null
  rackCount?: number | null
  palletCount?: number | null
}

export interface CheckInCase {
  handoverRecord?: HandoverRecord | null
  customerReceiptConfirmedAt?: string | null
  facilityAddress?: string | null
  inventoryReturnWindowDays?: number | null
  inventoryRemovalPublishedAt?: string | null
  inventoryRemovalDeadlineAt?: string | null
  inventoryReturnLastReminderAt?: string | null
  equipment?: { rackCount: number; frameCount: number; palletCount: number | null }
  intakeAction: 'START' | 'CONTINUE' | 'NONE'
  declaredGoodsLines?: {
    id: string
    code: string | null
    name: string | null
    categoryName?: string | null
    materialName?: string | null
    catalogCategoryId?: string | null
    catalogMaterialId?: string | null
    category?: GoodsCategory | null
    fragile?: boolean
    stackable?: boolean
    allowHorizontalPlacement?: boolean
    maxStackLayers?: number
    quantity: number
    lengthCm: number | null
    widthCm: number | null
    heightCm: number | null
    weightPerPackageKg?: number | null
  }[]
  setupEarlyExitPolicyVersion?: string | null
  setupEarlyExitFee?: number | null
  checkInId: string | null
  checkInStatus: CheckInStatus
  scheduledAt: string | null
  appointmentAt: string | null
  checkedInAt: string | null
  identityVerifiedAt: string | null
  inventoryVisit?: InventoryVisit | null
  verifiedIdentityDocument: string | null
  identityVerificationNote: string | null
  contractSignedAt: string | null
  contractEvidenceReference: string | null
  paymentEvidenceReference: string | null
  paymentCollectedAt: string | null
  setupStartedAt: string | null
  setupDueAt: string | null
  freeSetupDays: number | null
  paidRentalStartsOn: string | null
  setupCompletedAt: string | null
  inventoryVerifiedAt: string | null
  inventoryDueAt: string | null
  inventoryFinalDeadlineAt?: string | null
  inventoryPending: boolean
  inventoryDecision?: InventoryDecision | null
  inventoryResolutionStatus?: InventoryResolutionStatus | null
  inventoryRefusalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  inventoryFullFit?: boolean
  inventoryPartialFitAvailable?: boolean
  inventorySuggestedPackageCount?: number | null
  inventoryMismatchSummary?: string | null
  inventoryAcceptedQuantitiesJson?: string | null
  inventoryRemainderDeadlineAt?: string | null
  inventoryRemainderRemovedAt?: string | null
  inventoryRemainderRemovalNote?: string | null
  inventoryActualJson?: string | null
  inventoryMismatchJson?: string | null
  inventorySuggestedQuantitiesJson?: string | null
  /** Version of the published inspection record; an at-site confirmation is bound to it. */
  inventoryResultVersion?: number
  /** Who recorded the at-site arrangement with the verified customer. */
  inventoryAtSiteConfirmedBy?: string | null
  inventoryAtSiteConfirmedByName?: string | null
  inventoryDecisionAt?: string | null
  /** True only when this case still waits for an online customer confirmation. */
  inventoryAwaitingOnlineConfirmation?: boolean
  receiptConfirmationDueAt: string | null
  receiptConfirmationOverdue: boolean
  receiptConfirmationReleaseAt?: string | null
  receiptReleaseEligible?: boolean
  declaredPackagingMethod?: string | null
  storageCapacity?: {
    volumeM3: number | null
    maxLoadKg: number | null
    maxCargoLengthCm?: number | null
    maxCargoWidthCm?: number | null
    maxCargoHeightCm?: number | null
    maxCargoWeightKg?: number | null
  } | null
  lockReference: string | null
  attendance?: import('../domain/reservationCheckInPolicy').HandoverAttendance | null
  readinessNote: string | null
  rejectionReason: string | null
  rejectionDisposition: 'AVAILABLE' | 'MAINTENANCE' | null
  performedBy: string | null
  performedByName: string | null
  assignedStaff: string | null
  assignedStaffName: string | null
  reservationId: string
  reservationCode: string
  reservationStatus: CheckInReservationStatus
  customerId: string
  customerName: string
  customerEmail: string
  identityDocumentNumber: string | null
  declaredIdentityMasked?: string | null
  identityCorrected?: boolean
  customerPhone: string | null
  facilityId: string
  facilityName: string
  storageUnitId: string
  storageUnitCode: string
  storageUnitStatus: 'reserved' | 'assigned' | 'available' | 'maintenance'
  assignmentId: string
  assignmentStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  declaredPackageCount: number | null
  declaredGoodsWeightKg: number
  declaredGoodsVolumeM3: number
  declaredGoodsLengthCm: number | null
  declaredGoodsWidthCm: number | null
  declaredGoodsHeightCm: number | null
  dueAtCheckIn: number | null
  handover: CompleteCheckInRequest | null
  checkInDeadline?: string | null
}

export interface ReceiptReminderResponse {
  sent: boolean
  sentAt: string | null
  receiptConfirmationDueAt: string | null
  receiptConfirmationOverdue: boolean
}

export interface CheckInPage {
  data: CheckInCase[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string
}

interface ApiEnvelope<T> {
  data: T
  correlationId: string
}

export interface CheckInEvidenceAsset {
  id: string
  createdAt?: string
  originalName: string
  contentType: string
  sizeBytes: number
  entityType: 'CHECK_IN'
  entityId: string
  status: string
}

export const isCheckInEvidenceAssetId = (value: unknown): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export function checkInEvidenceAssetIds(references: readonly unknown[]) {
  return Array.from(new Set(references.filter(isCheckInEvidenceAssetId)))
}

export type AccessCredentialType = 'PIN' | 'CARD' | 'KEY' | 'LOCK'
export type AccessCredentialStatus = 'ACTIVE' | 'REVOKED'

export interface AccessCredential {
  id: string
  reservationId: string
  reservationCode: string
  rentalId: string | null
  facilityId: string
  facilityName: string
  storageUnitId: string
  storageUnitCode: string
  customerId: string
  customerName: string
  type: AccessCredentialType
  status: AccessCredentialStatus
  reference: string
  issuedBy: string
  issuedByName: string
  issuedAt: string
  revokedBy: string | null
  revokedByName: string | null
  revokedAt: string | null
  note: string | null
}

export interface CredentialAlert {
  id: string
  action: 'ISSUE' | 'REVOKE'
  reservationId: string
  reservationCode: string
  rentalId: string | null
  facilityId: string
  facilityName: string
  storageUnitId: string
  storageUnitCode: string
  customerId: string
  customerName: string
  credentialType: AccessCredentialType | null
  reference: string | null
  dueAt: string | null
  reason: string
}

export type CredentialAccessEventType = 'ENTRY' | 'EXIT'
export interface CredentialAccessResponse {
  credentialId: string
  rentalId: string | null
  accessedAt: string
  allowed: boolean
  duringSetup: boolean
  reason: string
  accessHours: string
}
export interface CredentialAccessEvent {
  credentialId: string
  rentalId: string | null
  facilityId: string
  eventType: CredentialAccessEventType
  occurredAt: string
  allowed: boolean
  reason: string
}

function assertPage(payload: unknown): CheckInPage {
  const value = payload as Partial<CheckInPage> | null
  if (!value || !Array.isArray(value.data) || !value.pagination
    || typeof value.pagination.page !== 'number'
    || typeof value.pagination.totalItems !== 'number'
    || typeof value.pagination.totalPages !== 'number') {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  value.data.forEach(assertCaseStatus)
  return value as CheckInPage
}

function assertCaseStatus(value: CheckInCase): CheckInCase {
  if (!value || !isReservationStatus(value.reservationStatus) || (value.checkInStatus !== null && !isCheckInStatus(value.checkInStatus))) {
    throw new ApiClientError('Trạng thái nhận kho hoặc đặt kho không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  }
  return value
}

function assertEnvelope(payload: unknown): CheckInCase {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  return assertCaseStatus((payload as ApiEnvelope<CheckInCase>).data)
}

function assertPaymentEnvelope(payload: unknown): CheckInPayment {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  const payment = (payload as ApiEnvelope<CheckInPayment>).data
  if (!payment || !isPaymentStatus(payment.status)) throw new ApiClientError('Trạng thái thanh toán không hợp lệ.', { code: 'INVALID_API_RESPONSE' })
  return payment
}

export async function listCheckIns(params: {
  group?: CheckInGroup
  page?: number
  pageSize?: number
  q?: string
  status?: CheckInListStatus
  scheduledFrom?: string
  scheduledTo?: string
} = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    pageSize: String(params.pageSize ?? 20),
  })
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.group) query.set('group', params.group)
  if (params.status) query.set('status', params.status)
  if (params.scheduledFrom) query.set('scheduledFrom', params.scheduledFrom)
  if (params.scheduledTo) query.set('scheduledTo', params.scheduledTo)
  return assertPage(await apiRequest<unknown>(`/api/staff/check-ins?${query}`))
}

export async function sendCustomerReceiptReminder(checkInId: string): Promise<ReceiptReminderResponse> {
  const payload = await apiRequest<ApiEnvelope<ReceiptReminderResponse>>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/receipt-reminder`,
    { method: 'POST' },
  )
  if (!payload?.data || typeof payload.data.sent !== 'boolean' || typeof payload.data.receiptConfirmationOverdue !== 'boolean') {
    throw new ApiClientError('Không thể gửi nhắc xác nhận nhận kho.', { code: 'INVALID_API_RESPONSE' })
  }
  return payload.data
}

export async function releaseCustomerReceiptTimeout(checkInId: string): Promise<CheckInCase> {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/receipt-release`,
    { method: 'POST' },
  ))
}

export async function scheduleCheckIn(
  reservationId: string,
  request: {
    scheduledAt: string
    contractVerified: boolean
    paymentVerified: boolean
    note: string
    assignedStaffId?: string
  },
) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/reservations/${encodeURIComponent(reservationId)}/schedule`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function completeCheckIn(checkInId: string, request: CompleteCheckInRequest) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/complete`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export type IdentityComparison = 'MATCH' | 'CORRECTABLE' | 'REJECT'

export async function compareCheckInIdentity(checkInId: string, identityDocumentNumber: string, bookingOwnerConfirmed: boolean): Promise<IdentityComparison> {
  const response = await apiRequest<ApiEnvelope<IdentityComparison>>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/identity-comparison`,
    { method: 'POST', body: JSON.stringify({ identityDocumentNumber, bookingOwnerConfirmed }) },
  )
  const result = response?.data
  if (result !== 'MATCH' && result !== 'CORRECTABLE' && result !== 'REJECT') {
    throw new ApiClientError('Không thể đối chiếu CCCD.', { code: 'INVALID_API_RESPONSE' })
  }
  return result
}

export async function verifyCheckInIdentity(checkInId: string, request: {
  identityDocumentNumber: string
  note?: string
  bookingOwnerConfirmed?: boolean
  adulthoodConfirmed?: boolean
  correctionConfirmed?: boolean
}) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/identity-verification`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function correctCheckInIdentity(checkInId: string, request: { identityDocumentNumber: string; note: string; bookingOwnerConfirmed?: boolean; adulthoodConfirmed?: boolean }) {
  return assertEnvelope(await apiRequest<unknown>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/identity-correction`, {
    method: 'POST', body: JSON.stringify(request),
  }))
}

export async function signCheckInContract(checkInId: string, contractEvidenceFileId: string, confirmedSetupEarlyExitPolicyVersion?: string | null) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/contract-signing`,
    { method: 'POST', body: JSON.stringify({ contractEvidenceFileId, confirmedSetupEarlyExitPolicyVersion }) },
  ))
}

export async function confirmCheckInPayment(checkInId: string, note?: string) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/payment-confirmation`,
    { method: 'POST', body: JSON.stringify({ note }) },
  ))
}

export async function startCheckInSetup(checkInId: string, request: {
  lockReference: string
  note?: string
  initialUnitCondition?: string
  evidenceReferences?: string[]
  handedOverItems?: { name: string; quantity: number }[]
  signedRecordReference?: string
  rackCount?: number
  palletCount?: number
}) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/setup/start`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function completeCheckInSetup(checkInId: string, note?: string) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/setup/complete`,
    { method: 'POST', body: JSON.stringify({ note }) },
  ))
}

export async function archiveCompletedCheckIn(checkInId: string) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}`,
    { method: 'DELETE' },
  ))
}

export interface CheckInPayment {
  paymentId: string
  reservationId: string
  amount: number
  currency: string
  purpose: 'RENTAL_BALANCE'
  status: PaymentStatus
  transactionReference: string
  paymentMethod: CheckInPaymentMethod
  paidAt: string | null
  processedAt: string | null
  initiatedByName: string
  receiptCode?: string | null
  invoiceNumber: string | null
  invoiceStatus: 'DRAFT' | 'PAID' | 'VOID' | 'REFUNDED'
  invoiceIssuedAt: string | null
}

export type CheckInPaymentMethod = 'CASH' | 'BANK_TRANSFER'

export async function recordCheckInRemainingPayment(checkInId: string, request: {
  amount: number
  paymentMethod: CheckInPaymentMethod
  paymentEvidenceFileId: string
  transactionReference?: string
  note?: string
}) {
  return assertPaymentEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/remaining-payment`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export interface PendingArrival { checkInId: string; reservationCode: string; actualArrivedAt: string; evidence: string }

export interface RefusalWitness { id: string; name: string }
export interface InventoryRefusalInput {
  customerPresent: boolean
  witnessId: string
  evidenceId: string
  grounds: string
  discussion: string
  customerReason?: string
  resultVersion: number
}
export interface InventoryRefusalReview {
  checkInId: string
  reservationCode: string
  facilityName: string
  submittedAt: string
  report: InventoryRefusalInput & { staffName: string; witness: RefusalWitness }
}
export async function listRefusalWitnesses(id: string) {
  return (await apiRequest<ApiEnvelope<RefusalWitness[]>>(`/api/staff/check-ins/${encodeURIComponent(id)}/refusal-witnesses`)).data
}
export async function submitInventoryRefusal(id: string, request: InventoryRefusalInput) {
  return assertEnvelope(await apiRequest<unknown>(`/api/staff/check-ins/${encodeURIComponent(id)}/signature-refusal`, {
    method: 'POST', body: JSON.stringify(request),
  }))
}
export async function listInventoryRefusals() {
  return (await apiRequest<ApiEnvelope<InventoryRefusalReview[]>>('/api/staff/check-ins/signature-refusal-reviews')).data
}
export async function reviewInventoryRefusal(id: string, submittedAt: string, approved: boolean, reason: string) {
  return assertEnvelope(await apiRequest<unknown>(`/api/staff/check-ins/${encodeURIComponent(id)}/signature-refusal-review`, {
    method: 'POST', body: JSON.stringify({ submittedAt, approved, reason }),
  }))
}

export async function listArrivalReviews() {
  const result = await apiRequest<ApiEnvelope<PendingArrival[]>>('/api/staff/check-ins/arrival-reviews')
  return result.data
}

export async function resolveArrivalReview(id: string, accepted: boolean, reason: string) {
  return assertEnvelope(await apiRequest<unknown>(`/api/staff/check-ins/${encodeURIComponent(id)}/arrival-review`, {
    method: 'POST', body: JSON.stringify({ accepted, reason }),
  }))
}

export async function recordCheckInArrival(checkInId: string, review?: { actualArrivedAt: string; evidence: string; disputed?: boolean }) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/arrival`,
    { method: 'POST', ...(review && { body: JSON.stringify(review) }) },
  ))
}

export async function rejectCheckIn(
  checkInId: string,
  request: {
    reason: string
    disposition: 'AVAILABLE' | 'MAINTENANCE'
    evidenceReferences: string[]
    mismatchedIdentityDocument?: string
  },
) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/reject`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function recordInventoryArrival(checkInId: string) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-arrival`,
    { method: 'POST' },
  ))
}

export async function verifyInventoryIdentity(checkInId: string, request: {
  identityDocumentNumber: string
  photoId: string
  bookingCustomerPresent: boolean
}) {
  return assertEnvelope(await apiRequest<unknown>(
    `/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-identity`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function uploadCheckInEvidence(
  checkInId: string,
  file: File,
  purpose: 'CHECK_IN' | 'CHECK_IN_IDENTITY' = 'CHECK_IN',
  fileNamePurpose?: string,
  fileNameContext?: string,
) {
  if (file.size > 25 * 1024 * 1024) {
    throw new ApiClientError(
      "Tệp vượt quá dung lượng tối đa 25MB. Vui lòng chọn tệp nhỏ hơn.",
      { code: 'FILE_TOO_LARGE', status: 413 }
    )
  }
  const form = new FormData()
  const namedFile = fileNamePurpose
    ? renameEvidenceFile(file, fileNamePurpose, fileNameContext)
    : file
  form.set('file', namedFile)
  form.set('entityType', purpose)
  form.set('entityId', checkInId)
  const payload = await apiRequest<unknown>('/api/files', { method: 'POST', body: form })
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as ApiEnvelope<CheckInEvidenceAsset>).data
}

export async function downloadCheckInEvidence(assetId: string) {
  return apiDownload(`/api/files/${encodeURIComponent(assetId)}`)
}

function assertCredentialEnvelope(payload: unknown): AccessCredential {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as ApiEnvelope<AccessCredential>).data
}

function assertCredentialAccessEventEnvelope(payload: unknown): CredentialAccessEvent {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as ApiEnvelope<CredentialAccessEvent>).data
}

export async function recordCredentialAccessEvent(
  credentialId: string,
  eventType: CredentialAccessEventType,
  note?: string,
) {
  if (!credentialId.trim() || !['ENTRY', 'EXIT'].includes(eventType) || (note?.length ?? 0) > 500) {
    throw new Error('Thông tin log truy cập không hợp lệ.')
  }
  return assertCredentialAccessEventEnvelope(await apiRequest<unknown>(
    `/api/staff/access-credentials/${encodeURIComponent(credentialId)}/access-events`,
    { method: 'POST', body: JSON.stringify({ eventType, note: note?.trim() || undefined }) },
  ))
}

export async function revokeAccessCredential(credentialId: string, reason: string) {
  return assertCredentialEnvelope(await apiRequest<unknown>(
    `/api/staff/access-credentials/${encodeURIComponent(credentialId)}/revoke`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  ))
}

export async function recordCredentialAccess(credentialId: string, request: {
  source?: string
  note?: string
  accessedAt?: string
} = {}) {
  const payload = await apiRequest<unknown>(
    `/api/staff/access-credentials/${encodeURIComponent(credentialId)}/access`,
    { method: 'POST', body: JSON.stringify(request) },
  )
  if (!payload || typeof payload !== 'object' || !('data' in payload) ||
    !payload.data || typeof payload.data !== 'object') {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  return (payload as ApiEnvelope<CredentialAccessResponse>).data
}

export interface ReissueAccessCredentialRequest {
  credentialId: string
  identityVerified: boolean
  verificationMethod: 'ID_DOCUMENT' | 'CUSTOMER_ACCOUNT' | 'AUTHORIZED_REPRESENTATIVE' | 'OTHER'
  reason: string
  reference: string
  secret?: string
  note?: string
}

export async function reissueAccessCredential(rentalId: string, request: ReissueAccessCredentialRequest) {
  if (!rentalId.trim() || !request.credentialId.trim() || !request.identityVerified || !request.reason.trim() || !request.reference.trim()) {
    throw new Error('Xác minh khách hàng, lý do và mã tham chiếu là bắt buộc.')
  }
  if (request.reason.length > 1000 || request.reference.length > 160 ||
    (request.secret?.length ?? 0) > 200 || (request.note?.length ?? 0) > 1000) {
    throw new Error('Thông tin thay quyền truy cập vượt quá giới hạn cho phép.')
  }
  return assertCredentialEnvelope(await apiRequest<unknown>(
    `/api/staff/rentals/${encodeURIComponent(rentalId)}/credentials/reissue`,
    { method: 'POST', body: JSON.stringify(request) },
  ))
}

export async function listCredentialAlerts(facilityId?: string) {
  const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ''
  const payload = await apiRequest<unknown>(`/api/staff/credential-alerts${query}`)
  if (!Array.isArray(payload)) {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  return payload as CredentialAlert[]
}

async function listAccessCredentialsAt(path: string, params: {
  facilityId?: string
  q?: string
  status?: AccessCredentialStatus
  page?: number
  pageSize?: number
} = {}) {
  const query = new URLSearchParams({ page: String(params.page ?? 0), pageSize: String(params.pageSize ?? 20) })
  if (params.facilityId && params.facilityId !== 'ALL') query.set('facilityId', params.facilityId)
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.status) query.set('status', params.status)
  const payload = await apiRequest<unknown>(`${path}?${query}`)
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) {
    throw new ApiClientError('Chưa tải được thông tin. Vui lòng thử lại.', { code: 'INVALID_API_RESPONSE' })
  }
  return payload as {
    data: AccessCredential[]
    pagination: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
      sort: string
    }
    correlationId: string
  }
}

export function listAccessCredentials(params: {
  facilityId?: string
  q?: string
  status?: AccessCredentialStatus
  page?: number
  pageSize?: number
} = {}) {
  return listAccessCredentialsAt('/api/manager/access-credentials', params)
}

export function listStaffAccessCredentials(params: {
  facilityId?: string
  q?: string
  status?: AccessCredentialStatus
  page?: number
  pageSize?: number
} = {}) {
  return listAccessCredentialsAt('/api/staff/access-credentials', params)
}

export interface SavedInventoryDraft {
  request: CompleteCheckInRequest | null
  revision: number
  savedAt: string | null
}
export async function getInventoryDraft(checkInId: string) {
  return (await apiRequest<{ data: SavedInventoryDraft }>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-draft`)).data
}
export async function saveInventoryDraft(checkInId: string, request: CompleteCheckInRequest, expectedRevision: number) {
  return (await apiRequest<{ data: SavedInventoryDraft }>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-draft`,
    { method: 'POST', body: JSON.stringify({ request, expectedRevision }) })).data
}
export async function prepareInventoryResolution(checkInId: string, expectedRevision: number) {
  return assertEnvelope(await apiRequest<unknown>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-draft/resolve`,
    { method: 'POST', body: JSON.stringify({ expectedRevision }) }))
}

export const publishInventoryDraft = prepareInventoryResolution
export type AtSiteInventoryDecision = 'REQUEST_TRANSFER' | 'ACCEPT_FULL' | 'CANCEL_AND_RETURN'
export async function resolveInventoryAtSite(checkInId: string, request: { decision: AtSiteInventoryDecision; customerPresent: boolean; note?: string; scheduledDate?: string; evidenceReferences?: string[]; resultVersion?: number }) {
  return assertEnvelope(await apiRequest<unknown>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-resolution-at-site`,
    { method: 'POST', body: JSON.stringify(request) }))
}

export async function sendInventoryReturnReminder(checkInId: string) {
  return assertEnvelope(await apiRequest<unknown>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-return-reminder`,
    { method: 'POST' }))
}
