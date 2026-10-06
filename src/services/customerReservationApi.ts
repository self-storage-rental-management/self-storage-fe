import { apiDownload, apiRequest } from './apiClient'

export type FacilityStatus = 'active' | 'maintenance' | 'inactive' | 'coming_soon'
export type UnitTypeStatus = 'active' | 'inactive'
export type CompatibilityResult = 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'REVIEW_REQUIRED'
export type ReservationStatus =
  | 'AWAITING_EMAIL' | 'AWAITING_REVIEW' | 'AWAITING_PAYMENT'
  | 'PAYMENT_GRACE' | 'PAYMENT_REVIEW' | 'CONFIRMED' | 'UNIT_RESERVED'
  | 'READY_FOR_CHECKIN' | 'AWAITING_CUSTOMER_RECEIPT' | 'COMPLETED'
  | 'CANCELLED' | 'EXPIRED' | 'REJECTED'

export interface Pagination {
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface PageResponse<T> {
  data: T[]
  pagination: Pagination
  correlationId: string
}

interface ApiEnvelope<T> {
  data: T
  correlationId: string
}

export interface CustomerFacility {
  id: string
  code: string
  name: string
  address: string
  city: string
  status: FacilityStatus
  createdAt: string
  updatedAt: string
}

export interface CustomerUnitType {
  id: string
  facilityId: string
  code: string
  name: string
  lengthM: number
  widthM: number
  heightM: number
  areaM2: number
  volumeM3: number
  monthlyPrice: number
  securityDepositAmount: number
  imageUrl: string | null
  maxLoadKg: number
  rackCount: number
  rackLengthM: number
  rackWidthM: number
  rackHeightM: number
  status: UnitTypeStatus
  availableCount: number | null
  createdAt: string
  updatedAt: string
}

export interface AvailabilityResult {
  facilityId: string
  unitTypeId: string
  startDate: string
  endDate: string
  availableCount: number
  available: boolean
}

export type GoodsCategory =
  | 'FURNITURE' | 'KITCHENWARE' | 'DECOR' | 'ELECTRONICS' | 'OFFICE'
  | 'TOYS' | 'SPORTS' | 'GIFTS' | 'MUSICAL_INSTRUMENTS' | 'CAMERA_EQUIPMENT'
  | 'EVENT_EQUIPMENT' | 'STORE_FIXTURES' | 'FINE_ART' | 'CERAMIC_GLASS'
  | 'MOVING_ITEMS' | 'OTHER'

export interface GoodsItemInput {
  category: GoodsCategory
  customGoodsName?: string | null
  materialName?: string | null
  customMaterial?: string | null
  description?: string | null
  customerNote?: string | null
  quantity: number
  lengthCm: number
  widthCm: number
  heightCm: number
  weightPerItemKg: number
  fragile: boolean
}

export interface ReservationSelectionInput {
  facilityId: string
  unitTypeId: string
  startDate: string
  endDate: string
  goodsCondition?: string | null
  goodsItems: GoodsItemInput[]
}

export interface CompatibilityCheckResult {
  facilityId: string
  unitTypeId: string
  startDate: string
  endDate: string
  result: CompatibilityResult
  totalGoodsVolumeM3: number
  totalGoodsWeightKg: number
  unitVolumeM3: number
  unitMaxLoadKg: number
  availableUnitCount: number
  staffReviewRequired: boolean
  issues: string[]
}

export interface ReservationQuoteInput extends ReservationSelectionInput {
  pricingPackageCode: string
}

export interface ReservationQuote {
  quoteId: string
  facilityId: string
  unitTypeId: string
  startDate: string
  endDate: string
  rentalMonths: number
  monthlyPrice: number
  subtotal: number
  discountRate: number
  discountAmount: number
  totalAfterDiscount: number
  reservationDepositAmount: number
  securityDepositAmount: number
  remainingRentalAmount: number
  dueAtCheckIn: number
  totalInitialObligation: number
  policyVersion: string
  quotedAt: string
  expiresAt: string
}

export interface CreateReservationInput {
  quoteId: string
  goodsCondition?: string | null
  notes?: string | null
  goodsItems: GoodsItemInput[]
}

export interface CustomerReservation {
  id: string
  reservationCode: string
  quoteId: string
  facilityId: string
  unitTypeId: string
  status: ReservationStatus
  goodsReviewStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  compatibilityResult: CompatibilityResult
  startDate: string
  endDate: string
  totalRentalAmount: number
  reservationDepositAmount: number
  securityDepositAmount: number
  remainingRentalAmount: number
  dueAtCheckIn: number
  totalInitialObligation: number
  totalGoodsVolumeM3: number
  totalGoodsWeightKg: number
  holdExpiresAt: string
  createdAt: string
}

export interface ReservationGoodsItem extends GoodsItemInput {
  id: string
  requiresStaffReview: boolean
  reviewStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewNote: string | null
}

export interface CustomerReservationDetail {
  reservation: CustomerReservation
  goodsCondition: string | null
  notes: string | null
  paymentExpiresAt: string | null
  complaintExpiresAt: string | null
  archivedAt: string | null
  confirmedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  goodsItems: ReservationGoodsItem[]
}

export interface ReservationEmailVerificationResult {
  reservationId: string
  reservationStatus: ReservationStatus
  verified: boolean
  expiresAt: string
  nextResendAt: string
  developmentCode: string | null
}

export interface ReservationPaymentResult {
  paymentId: string
  reservationId: string
  amount: number
  currency: string
  outcome: 'SUCCESS' | 'FAILED' | 'NOT_RECEIVED'
  paymentStatus: string
  reservationStatus: ReservationStatus
  message: string
  processedAt: string
}

export type PaymentComplaintStatus = 'PENDING' | 'REVIEW_OVERDUE' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface PaymentComplaint {
  id: string
  reservationId: string
  reservationCode: string
  status: PaymentComplaintStatus
  paymentStatus: string
  reservationStatus: ReservationStatus
  reason: string
  imageIds: string[]
  depositAmount: number
  netRentalAmount: number | null
  images: Array<{ id: string; originalName: string; contentType: string; sizeBytes: number; downloadUrl: string }>
  submittedAt: string
  reviewDueAt: string
  reviewedAt: string | null
  withdrawnAt: string | null
  decisionReason: string | null
}

export interface BookingDocument {
  id: string
  reservationId: string
  reservationCode: string
  documentType: 'BOOKING_CONFIRMATION'
  fileId: string
  fileName: string
  contentType: string
  sizeBytes: number
  checksumSha256: string
  issuedAt: string
  downloadUrl: string
}

export async function generateBookingDocument(reservationId: string) {
  const response = await apiRequest<ApiEnvelope<BookingDocument>>(
    `/api/customer/reservations/${reservationId}/booking-document`, { method: 'POST' },
  )
  return response.data
}

export async function getBookingDocument(reservationId: string) {
  const response = await apiRequest<ApiEnvelope<BookingDocument>>(
    `/api/customer/reservations/${reservationId}/booking-document`,
  )
  return response.data
}

export function downloadBookingDocument(reservationId: string) {
  return apiDownload(`/api/customer/reservations/${reservationId}/booking-document/download`)
}

export async function uploadComplaintImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await apiRequest<ApiEnvelope<{ id: string }>>('/api/files', { method: 'POST', body })
  return response.data
}

export async function submitPaymentComplaint(reservationId: string, reason: string, imageIds: string[]) {
  const response = await apiRequest<ApiEnvelope<PaymentComplaint>>(
    `/api/customer/reservations/${reservationId}/payment-complaints`,
    { method: 'POST', body: JSON.stringify({ reason, imageIds }) },
  )
  return response.data
}

export async function getPaymentComplaint(reservationId: string) {
  const response = await apiRequest<ApiEnvelope<PaymentComplaint>>(`/api/customer/reservations/${reservationId}/payment-complaint`)
  return response.data
}

export async function withdrawPaymentComplaint(complaintId: string) {
  const response = await apiRequest<ApiEnvelope<PaymentComplaint>>(
    `/api/customer/payment-complaints/${complaintId}/withdraw`, { method: 'POST' },
  )
  return response.data
}

export async function payReservationDeposit(reservationId: string, idempotencyKey: string) {
  const response = await apiRequest<ApiEnvelope<ReservationPaymentResult>>(
    `/api/customer/reservations/${reservationId}/simulated-payment`,
    { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}

export async function getReservationPayment(reservationId: string) {
  const response = await apiRequest<ApiEnvelope<ReservationPaymentResult>>(`/api/customer/reservations/${reservationId}/payment`)
  return response.data
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ''
}

export async function listCustomerFacilities(page = 0, size = 50) {
  return apiRequest<PageResponse<CustomerFacility>>(`/api/facilities${query({ status: 'active', page, size })}`)
}

export async function listCustomerUnitTypes(facilityId: string, options: {
  startDate?: string
  endDate?: string
  page?: number
  size?: number
} = {}) {
  const suffix = query({
    status: 'active',
    startDate: options.startDate,
    endDate: options.endDate,
    page: options.page ?? 0,
    size: options.size ?? 50,
  })
  return apiRequest<PageResponse<CustomerUnitType>>(`/api/facilities/${facilityId}/unit-types${suffix}`)
}

export async function getAvailability(input: Omit<ReservationSelectionInput, 'goodsCondition' | 'goodsItems'>) {
  const suffix = query(input)
  const response = await apiRequest<ApiEnvelope<AvailabilityResult>>(`/api/availability${suffix}`)
  return response.data
}

export async function checkCompatibility(input: ReservationSelectionInput) {
  const response = await apiRequest<ApiEnvelope<CompatibilityCheckResult>>(
    '/api/customer/reservations/compatibility-check',
    { method: 'POST', body: JSON.stringify(input) },
  )
  return response.data
}

export async function createReservationQuote(input: ReservationQuoteInput) {
  const response = await apiRequest<ApiEnvelope<ReservationQuote>>('/api/customer/reservations/quote', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function createCustomerReservation(input: CreateReservationInput, idempotencyKey: string) {
  const response = await apiRequest<ApiEnvelope<CustomerReservation>>('/api/customer/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  })
  return response.data
}

export async function listCustomerReservations(status?: ReservationStatus, page = 0, size = 20) {
  return apiRequest<PageResponse<CustomerReservation>>(
    `/api/customer/reservations${query({ status, page, size })}`,
  )
}

export async function getCustomerReservation(reservationId: string) {
  const response = await apiRequest<ApiEnvelope<CustomerReservationDetail>>(
    `/api/customer/reservations/${reservationId}`,
  )
  return response.data
}

export async function cancelCustomerReservation(reservationId: string, reason: string) {
  const response = await apiRequest<ApiEnvelope<CustomerReservationDetail>>(
    `/api/customer/reservations/${reservationId}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  )
  return response.data
}

export async function resendReservationOtp(reservationId: string) {
  const response = await apiRequest<ApiEnvelope<ReservationEmailVerificationResult>>(
    `/api/customer/reservations/${reservationId}/email-verification/resend`,
    { method: 'POST' },
  )
  return response.data
}

export async function verifyReservationOtp(reservationId: string, code: string) {
  const response = await apiRequest<ApiEnvelope<ReservationEmailVerificationResult>>(
    `/api/customer/reservations/${reservationId}/email-verification`,
    { method: 'POST', body: JSON.stringify({ code }) },
  )
  return response.data
}
