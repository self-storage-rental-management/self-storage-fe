export type UnitStatus = 'available' | 'reserved' | 'occupied' | 'maintenance' | 'held' | 'assigned'

export type ReservationStatus =
  | 'CREATED'
  | 'DEPOSIT_PAID'
  | 'UNIT_RESERVED'
  | 'READY_FOR_CHECKIN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'

// Backward-compatible alias for existing code
export type HoldStatus =
  | ReservationStatus
  | 'awaiting_deposit'
  | 'deposit_paid'
  | 'contract_signed'
  | 'fully_paid'
  | 'unit_assigned'
  | 'review_required'
  | 'confirmed'
  | 'scheduled'
  | 'active'
  | 'return_requested'
  | 'return_inspection'
  | 'completed'
  | 'expired'
  | 'rejected'
  | 'cancelled'
  | 'no_show'
  | 'held'
  | 'draft'
  | 'awaiting_email'
  | 'awaiting_review'
  | 'approved'
  | 'awaiting_payment'
  | 'checked_in'

export type RentalStatus = 'active' | 'return_requested' | 'return_inspection' | 'closing' | 'completed'

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'refunded' | 'cancelled'

export type ReturnStatus = 'requested' | 'scheduled' | 'inspected' | 'awaiting_customer_confirmation' | 'disputed' | 'payment_due' | 'refund_pending' | 'completed'

export type DamageClassification =
  | 'no_damage'
  | 'minor_damage'
  | 'major_damage'
  | 'abandoned_goods'

export interface UnitType {
  id: string
  name: string
  lengthM: number
  widthM: number
  heightM: number
  areaM2: number
  volumeM3: number
  pricePerM3: number
  monthlyPrice: number
  maxLoadKg: number
  descriptionVi: string
  descriptionEn: string
}

export interface Facility {
  id: string
  name: string
  address: string
  city: string
  rating: number
  available?: number
  price: string
  climate: boolean
  security: string
  image: string
  units: number
  occupied: number
  revenue: number
  growth: number
  manager: string
  status: 'active' | 'maintenance'
  accessHours: string
  timezone: string
}

export interface ReservedPeriod {
  reservationId: string
  customerName: string
  startDate: string
  endDate: string
}

export interface StorageUnit {
  id: string
  code: string
  facilityId: string
  facilityName: string
  floor: number
  zone: string
  type: 'Small' | 'Medium' | 'Large' | 'Extra Large'
  areaM2: number
  dimensions: {
    lengthM: number
    widthM: number
    heightM: number
  }
  doorDimensions: {
    widthM: number
    heightM: number
  }
  volumeM3: number
  maxLoadKg: number
  allowedGoods: string[]
  prohibitedGoods: string[]
  price: number
  deposit: number
  climate: boolean
  status: UnitStatus
  reservedPeriods?: ReservedPeriod[]
  nextAvailableDate?: string
  heldUntil?: string
  heldByHoldId?: string
  heldByCustomerName?: string
  currentRentalId?: string
  conditionNotes?: string
  version: number
  // Optional legacy fields for backward-compatibility during refactoring
  size?: number
  sqft?: number
}

export interface GoodsDeclaration {
  category: string
  packageCount: number
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  dimWeightKg: number
  material: string
  condition: string
  fragile: boolean
  specialHandling?: string
  notes?: string
}

export interface PricingQuote {
  quoteId: string
  unitId: string
  facilityId: string
  baseMonthlyPrice: number
  depositAmount: number
  dimSurcharge: number
  discountAmount?: number
  promoCode?: string
  totalFirstPayment: number
  dimWeightKg: number
  actualWeightKg: number
  billableWeightKg: number
  dimDivisor: number
  quotedAt: string
  expiresAt: string
}

export interface DiscountRule {
  code: string
  type: 'PERCENT' | 'FIXED'
  value: number
  startAt?: string
  expiresAt?: string
  firstRentalOnly?: boolean
  minRentalMonths?: number
  facilityIds?: string[]
  unitTypeIds?: string[]
  maxDiscountAmount?: number
  active: boolean
}

export interface PricingSnapshot {
  unitTypeId: string
  unitTypeName: string
  quotedVolumeM3: number
  quotedPricePerM3: number
  quotedMonthlyPrice: number
  depositAmount: number
  discountAmount: number
  finalAmount: number
  originalMonthlyRate?: number
  discountedMonthlyRate?: number
  discountCode?: string
  discountType?: 'PERCENT' | 'FIXED'
  discountValue?: number
  quotedAt: string
}

export interface AccessCredential {
  id: string
  rentalId?: string
  reservationId?: string
  unitId: string
  type: 'PIN' | 'KEY' | 'CARD'
  pinCode?: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
  generatedAt?: string
  activatedAt?: string
  revokedAt?: string
}

export interface StorageReservation {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAddress?: string
  customerArchivedAt?: string
  identityId: string
  facilityId: string
  facilityName: string
  unitId: string
  unitTypeId: string
  unitTypeName: string
  assignedUnitId?: string
  rentalMonths: number
  startDate: string
  endDate: string
  moveInDate: string
  status: ReservationStatus | HoldStatus
  expireReason?: 'NO_SHOW' | 'CUSTOMER_CANCELLED' | 'PAYMENT_EXPIRED'
  reservationDepositAmount: number // 20% paid online to hold booking
  securityDepositAmount: number    // 1-month rent deposit recorded in contract
  depositConvertedAt?: string     // Timestamp when reservation deposit was converted to contract security deposit
  remainingAmount: number          // FirstMonthRent + SecurityDeposit - ReservationDeposit
  firstMonthRent?: number
  totalInitialAmount?: number
  approvalType?: 'AUTO' | 'MANUAL'
  exceptionReason?: 'OVERSIZED_DIM' | 'OVERWEIGHT_LIMIT' | 'RESTRICTED_ITEMS' | 'SPECIAL_REQUEST' | 'NEAR_CAPACITY' | 'OTHER'
  exceptionDetails?: string
  suggestedUnitType?: string
  paymentExpiresAt?: string
  depositPaidAt?: string
  checkInDeadline?: string
  reviewExpiresAt?: string
  largestItemDimensionsCm?: {
    lengthCm: number
    widthCm: number
    heightCm: number
  }
  snapshot?: PricingSnapshot
  goods: GoodsDeclaration
  quote: PricingQuote
  emailVerification?: {
    token: string
    verified: boolean
    sentAt: string
    verifiedAt?: string
    expiresAt: string
    attemptCount: number
  }
  payment: {
    amount: number
    status: PaymentStatus
    method?: string
    transactionId?: string
    paidAt?: string
  }
  contractId?: string
  originalMonthlyRate?: number
  discountedMonthlyRate?: number
  discountCode?: string
  discountType?: 'PERCENT' | 'FIXED'
  discountValue?: number
  discountAmount?: number
  appointmentDate?: string
  appointmentTime?: string
  generatedAccessPin?: string
  unitAssignedAt?: string
  checkedInAt?: string
  checkedInBy?: string
  handoverCompleted?: boolean
  staffReviewNotes?: string
  reviewedByStaffId?: string
  reviewedAt?: string
  expiresAt: string
  evidence: string[]
  createdAt: string
}

// Alias for StorageReservation
export type StorageHold = StorageReservation

export type ReservationValidationResult =
  | {
      outcome: 'PASS'
      hold: StorageReservation
      messageVi: string
      messageEn: string
    }
  | {
      outcome: 'SOFT_EXCEPTION'
      hold: StorageReservation
      reason: string
      reviewExpiresAt: string
      messageVi: string
      messageEn: string
    }
  | {
      outcome: 'HARD_VIOLATION'
      rejectionReason: string
      suggestedUnitTypeId?: string
      suggestedUnitTypeName?: string
      suggestedVolumeM3?: number
      messageVi: string
      messageEn: string
    }

export interface CheckInRecord {
  id: string
  holdId: string
  unitId: string
  facilityId: string
  customerId: string
  customerName: string
  staffId: string
  staffName: string
  scheduledDate: string
  scheduledTime: string
  completedAt?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  checklist: {
    identityVerified: boolean
    termsAccepted: boolean
    paymentConfirmed: boolean
    unitWalkthrough: boolean
    accessCodeIssued: boolean
  }
  actualMeasurements: {
    lengthCm: number
    widthCm: number
    heightCm: number
    weightKg: number
    actualVolumeM3: number
    dimWeightKg?: number
    varianceAccepted: boolean
    varianceNotes?: string
  }
  initialCondition: string
  initialConditionEn?: string
  evidencePhotos: string[]
  accessCodeIssued?: string
  preparedAccessPin?: string
  accessPreparedAt?: string
  customerConfirmationTimestamp?: string
  goodsHandover?: { packageCount: number; category: string; estimatedWeightKg: number; notes: string }
  handedOverItems?: string[]
}

export interface StorageContract {
  id: string
  contractNumber: string
  reservationId: string
  customerId: string
  unitId?: string
  signedAt: string
  startDate: string
  endDate: string
  monthlyRent: number
  securityDeposit: number
  scannedFileUrl: string
  scannedFileName: string
  uploadedAt: string
  uploadedBy: string
  status: 'SIGNED'
  contractType?: 'INITIAL' | 'RENEWAL'
  renewalId?: string
  customerArchivedAt?: string
}

export interface StoragePayment {
  id: string
  reservationId: string
  rentalId?: string
  renewalId?: string
  type: 'RESERVATION_DEPOSIT' | 'INITIAL_RENT' | 'RENT' | 'RENEWAL' | 'DAMAGE_FEE' | 'REFUND'
  amount: number
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY'
  transactionReference?: string
  proofImage?: string
  receivedAt?: string
  receivedBy?: string
  status: 'PAID' | 'PENDING'
  paidAt?: string
  recordedBy: string
  invoiceNumber?: string
  description?: string
  gatewayVerifiedAt?: string
}

export interface RenewalRecord {
  id: string
  rentalId: string
  unitId: string
  facilityId: string
  customerId: string
  customerName: string
  oldEndDate: string
  newEndDate: string
  renewalMonths: number
  renewalFee: number
  status: 'pending' | 'approved' | 'deposit_paid' | 'appointment_scheduled' | 'payment_processing' | 'payment_failed' | 'payment_expired' | 'rejected' | 'cancelled' | 'completed'
  requestedAt: string
  updatedAt?: string
  cancelledAt?: string
  approvedBy?: string
  approvedAt?: string
  paymentDueAt?: string
  invoiceNumber?: string
  invoiceIssuedAt?: string
  paidAt?: string
  paymentMethod?: string
  transactionReference?: string
  paymentId?: string
  addendumNumber?: string
  addendumIssuedAt?: string
  renewalContractId?: string
  renewalContractNumber?: string
  effectiveAt?: string
  originalMonthlyRate?: number
  totalAmount?: number
  bookingDepositAmount?: number
  remainingAmount?: number
  appointmentDate?: string
  appointmentTime?: string
  signingDeadline?: string
  overdueDays?: number
  lateFeePerDay?: number
  lateFeeAmount?: number
  signedAt?: string
  completedBy?: string
  attachmentUrl?: string
  notes?: string
}

export interface MaintenanceTask {
  id: string
  unitId: string
  facilityId: string
  reason: string
  damageClassification?: DamageClassification
  assignedStaffId?: string
  assignedStaffName?: string
  status: 'pending' | 'in_progress' | 'completed'
  createdAt: string
  completedAt?: string
  notes?: string
}

export interface RentalRecord {
  id: string
  holdId: string
  contractId?: string
  unitId: string
  facilityId: string
  facilityName: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  unitType: string
  areaM2: number
  volumeM3?: number
  startDate: string
  endDate: string
  nextDue: string
  monthlyRate: number
  deposit: number // Security deposit amount
  securityDeposit: number
  status: RentalStatus
  paymentStatus: PaymentStatus
  autoRenew: boolean
  gateCode: string
  accessCredentials?: AccessCredential[]
  initialCondition: string
  evidencePhotos: string[]
  originalMonthlyRate?: number
  discountedMonthlyRate?: number
  discountCode?: string
  discountType?: 'PERCENT' | 'FIXED'
  discountValue?: number
  discountAmount?: number
  checkedOutAt?: string
  accessRevokedAt?: string
  receiptConfirmedAt?: string
  receiptConfirmedBy?: string
  customerArchivedAt?: string
  lateFeeAmount?: number
  overlocked?: boolean
  lastReminderAt?: string
  remindersSent?: number
  // Optional legacy fields for backward-compatibility during refactoring
  size?: number
  sqft?: number
}

export interface FacilityTask {
  id: string
  facilityId: string
  facilityName: string
  type: 'checkin' | 'return' | 'maintenance' | 'support' | 'general'
  title: string
  referenceId?: string
  assignedStaffId?: string
  assignedStaffName?: string
  dueAt: string
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'completed'
  notes?: string
  createdAt: string
  completedAt?: string
}

export interface ReturnCase {
  id: string
  rentalId: string
  unitId: string
  facilityId: string
  facilityName: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  requestedAt: string
  scheduledDate: string
  status: ReturnStatus
  initialConditionSnapshot: string
  initialConditionSnapshotEn?: string
  packageCount: number
  initialWeightKg: number
  returnedCondition?: string
  inventoryMatch?: 'match' | 'missing' | 'excess'
  damageClassification?: DamageClassification
  damageFee: number
  outstandingFee: number
  cleaningFee?: number
  lostItemFee?: number
  overdueFee?: number
  depositAmount: number // Security deposit to be refunded from
  netRefundAmount: number
  amountDueFromCustomer?: number
  overdueDays?: number
  settlementPaymentId?: string
  settlementPaidAt?: string
  staffNotes?: string
  evidence: string[]
  customerConfirmed: boolean
  customerConfirmedAt?: string
  customerDecision?: 'accepted' | 'disputed'
  customerDecisionNote?: string
  proposedUnitStatus?: 'available' | 'maintenance'
  inspectedAt?: string
  completedAt?: string
  staffId?: string
  returnedItems?: { key: boolean; card: boolean; lock: boolean }
  refundTransaction?: { id: string; type: 'refund'; amount: number; status: 'pending' | 'paid'; recordedAt: string }
}

export interface ActivityRecord {
  id: string
  correlationId?: string
  action: string
  actorId: string
  actorName: string
  actorRole: string
  facilityId: string
  entityType: 'hold' | 'unit' | 'rental' | 'checkin' | 'return' | 'payment' | 'policy' | 'task' | 'system'
  entityId: string
  beforeState?: any
  afterState?: any
  notes?: string
  evidence?: string[]
  timestamp: string
}

export interface BusinessConfig {
  dimDivisor: number
  gracePeriodDays: number
  lateFeeAmount: number
  defaultDepositRatio: number
  holdExpiryHours: number
}
