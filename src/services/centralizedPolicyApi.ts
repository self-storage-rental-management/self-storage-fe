import { apiRequest } from './apiClient'

export interface CentralizedPolicyApi {
  id: string
  policyVersion: string
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'INACTIVE' | 'ARCHIVED'
  runtimeStatus: 'ACTIVE' | 'SCHEDULED' | 'DRAFT' | 'EXPIRED' | 'ARCHIVED'
  publishedAt: string | null
  publishedById: string | null
  publishedByName: string | null
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
  changeSummary: string | null

  // Rule 1 & 2: Mandatory Deposit & Calculation
  depositMandatory: boolean
  depositCalculationMethod: 'MONTHLY_RENT_MULTIPLE' | 'FIXED_AMOUNT' | 'PERCENTAGE_OF_TOTAL_RENT' | string
  depositMonthlyMultiple: number
  depositFixedAmount: number
  depositPercentageRate: number
  minimumDepositAmount: number

  // Rule 3: Refund Conditions
  fullRefundConditions: string | null
  partialRefundConditions: string | null
  noRefundConditions: string | null
  refundProcessingDays: number

  // Rule 4 & 8: Early Renewal / Extension
  allowEarlyRenewal: boolean
  availableExtensionPeriods: number[]
  renewalAdvanceNoticeDays: number
  requireStorageAvailabilityCheck: boolean
  renewalDiscountRate: number

  // Rule 5: Early Contract Termination
  allowEarlyTermination: boolean
  earlyTerminationNoticeDays: number
  earlyTerminationFeeCoefficient: number
  earlyTerminationFeeCapMonths: number
  earlyTerminationMinFee: number

  // Rule 6: Late Payment Penalty
  gracePeriodDays: number
  latePenaltyCalculationMethod: 'FIXED_DAILY_AMOUNT' | 'PERCENTAGE_DAILY_RATE' | string
  lateFeeAmount: number
  lateFeePercentageRate: number
  maxOverdueGraceDaysBeforeRepossession: number

  // Rule 7: Security Deposit Deduction
  deductionCategories: string | null
  requireEvidenceForDeduction: boolean
  requireManagerApprovalForDeduction: boolean
  excludeNormalWearAndTear: boolean

  // Rule 9: Pricing Protection
  pricingProtectionEnforced: boolean
  pricingVersion: string

  createdAt: string
  updatedAt: string
}

export interface PolicyDiffItemApi {
  category: string
  fieldKey: string
  fieldLabel: string
  oldValue: string
  newValue: string
  changed: boolean
}

export interface PublishPolicyInput {
  effectiveFrom: string
  effectiveTo?: string | null
  changeSummary: string
}

export interface PolicySimulationInput {
  monthlyRent: number
  rentalMonths: number
  overdueDays: number
}

export interface PolicySimulationResult {
  monthlyRent: number
  rentalMonths: number
  totalRentValue: number
  depositCalculationMethod: string
  calculatedDepositAmount: number
  depositFormulaDescription: string
  overdueDays: number
  gracePeriodDays: number
  chargeableOverdueDays: number
  latePenaltyMethod: string
  calculatedPenaltyAmount: number
  penaltyFormulaDescription: string
}

type Envelope<T> = { data: T; correlationId: string }

export async function getActiveCentralizedPolicyApi(): Promise<CentralizedPolicyApi> {
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>('/api/business/centralized-policy/active')
  return response.data
}

export async function getDraftCentralizedPolicyApi(): Promise<CentralizedPolicyApi> {
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>('/api/business/centralized-policy/draft')
  return response.data
}

export async function saveDraftCentralizedPolicyApi(
  input: Partial<CentralizedPolicyApi>
): Promise<CentralizedPolicyApi> {
  const payload = {
    ...input,
    availableExtensionPeriods: Array.isArray(input.availableExtensionPeriods)
      ? input.availableExtensionPeriods.join(',')
      : input.availableExtensionPeriods,
  }
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>('/api/business/centralized-policy/draft', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return response.data
}

export async function previewPolicyChangesApi(draftId?: string): Promise<PolicyDiffItemApi[]> {
  const url = draftId
    ? `/api/business/centralized-policy/preview-changes?draftId=${encodeURIComponent(draftId)}`
    : '/api/business/centralized-policy/preview-changes'
  const response = await apiRequest<Envelope<PolicyDiffItemApi[]>>(url, {
    method: 'POST',
  })
  return response.data
}

export async function publishCentralizedPolicyApi(
  draftId: string | undefined,
  input: PublishPolicyInput
): Promise<CentralizedPolicyApi> {
  const url = draftId
    ? `/api/business/centralized-policy/publish?draftId=${encodeURIComponent(draftId)}`
    : '/api/business/centralized-policy/publish'
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>(url, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function rollbackCentralizedPolicyApi(versionId: string): Promise<CentralizedPolicyApi> {
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>(
    `/api/business/centralized-policy/rollback/${encodeURIComponent(versionId)}`,
    { method: 'POST' }
  )
  return response.data
}

export async function listCentralizedPolicyHistoryApi(): Promise<CentralizedPolicyApi[]> {
  const response = await apiRequest<Envelope<CentralizedPolicyApi[]>>('/api/business/centralized-policy/history')
  return response.data
}

export async function getCentralizedPolicyVersionApi(id: string): Promise<CentralizedPolicyApi> {
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>(
    `/api/business/centralized-policy/history/${encodeURIComponent(id)}`
  )
  return response.data
}

export async function simulatePolicyCalculationApi(
  input: PolicySimulationInput
): Promise<PolicySimulationResult> {
  const response = await apiRequest<Envelope<PolicySimulationResult>>(
    '/api/business/centralized-policy/simulate',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  )
  return response.data
}

export async function getCustomerActivePolicyApi(): Promise<CentralizedPolicyApi> {
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>('/api/customer/centralized-policy/active')
  return response.data
}

export async function getFacilityActivePolicyApi(): Promise<CentralizedPolicyApi> {
  const response = await apiRequest<Envelope<CentralizedPolicyApi>>('/api/facility/centralized-policy/active')
  return response.data
}

export const updateDraftCentralizedPolicyApi = saveDraftCentralizedPolicyApi
export const previewCentralizedPolicyDiffApi = previewPolicyChangesApi
