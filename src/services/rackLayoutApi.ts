import { apiRequest } from './apiClient'
import type { PageResponse, PalletPlan } from './customerReservationApi'

export interface RackInput {
  code: string
  lengthCm: number
  widthCm: number
  heightCm: number
  xCm: number
  yCm: number
  orientationDeg: number
  uprightFrameCount: number
  uprightSizeCm: number
  levelCount: number
  beamHeightCm: number
  firstBeamBottomCm: number
  palletsPerCompartment: number
  maxLoadedPalletKg?: number
  maxRackLoadKg: number
  beamOuterSpanCm?: number
  maxBeamPairLoadKg?: number
}

export interface RackClearances {
  palletGapCm: number
  palletEndCm: number
  palletSideCm: number
  handlingCm: number
  maxPalletOverhangCm?: number
  rackWallClearanceCm?: number
}

export interface RackConfiguration {
  racks: RackInput[]
  clearances: RackClearances
  /** Backend tự sinh kích thước và tải trọng tấm kê từ hình học khung. */
  pallet?: RackPallet
  autoGeneratePallet?: boolean
  requestedRackCount?: number
  layoutMode?: string
}

export interface RackPallet {
  lengthCm: number
  widthCm: number
  heightCm: number
  emptyKg: number
  maxPayloadKg?: number
}

export const storageHubRules = {
  version: '8.1-demo',
  uprightSizeCm: 8,
  beamHeightCm: 15,
  firstBeamBottomCm: 15,
  handlingClearanceCm: 15,
  palletEndClearanceCm: 9,
  palletGapCm: 10,
  wallClearanceCm: 30,
  maxPalletOverhangCm: 5,
  minCargoHeightCm: 80,
  minPalletWidthCm: 80,
  palletHeightCm: 18,
  palletWeightPerM2Kg: 9,
} as const

export function calculatePalletEmptyWeightKg(lengthCm: number, widthCm: number) {
  return Number(((lengthCm * widthCm / 10_000) * storageHubRules.palletWeightPerM2Kg).toFixed(2))
}

export const defaultRackPallet: RackPallet = { lengthCm: 210, widthCm: 170, heightCm: 18, emptyKg: calculatePalletEmptyWeightKg(210, 170), maxPayloadKg: 500 }
export const sampleRackPallet: RackPallet = { lengthCm: 210, widthCm: 170, heightCm: 18, emptyKg: calculatePalletEmptyWeightKg(210, 170), maxPayloadKg: 500 }

/**
 * Computes the maximum number of rack levels from the fixed vertical rules.
 * The result intentionally depends on the rack height; three is only the
 * result for the 450 cm example, not a global business limit.
 */
export function maxLevelCountForHeightCm(
  heightCm: number,
  firstBeamBottomCm = storageHubRules.firstBeamBottomCm,
  beamHeightCm = storageHubRules.beamHeightCm,
  palletHeightCm = storageHubRules.palletHeightCm,
  handlingClearanceCm = storageHubRules.handlingClearanceCm,
  minCargoHeightCm = storageHubRules.minCargoHeightCm,
) {
  const numerator = heightCm - firstBeamBottomCm
  const denominator = beamHeightCm + palletHeightCm + handlingClearanceCm + minCargoHeightCm
  return Number.isFinite(numerator) && numerator > 0 && denominator > 0
    ? Math.floor(numerator / denominator)
    : 0
}

interface BoxSample {
  name: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  maxLayers: number
}

export interface RackResult {
  configuration: RackConfiguration
  rulesVersion?: string | number
  palletSlotCount: number
  smallBoxesPerUnit: number
  largeBoxesPerUnit: number
  warehouseAreaM2?: number
  unitCargoLimitKg: number
  minCargoHeightCm: number
  palletHeightCm: number
  palletEmptyKg: number
  palletMaxPayloadKg?: number
  rackCount?: number
  levelsPerRack?: number
  maxLevelsByHeight?: number
  compartmentsPerLevel?: number
  totalCompartments?: number
  totalPallets?: number
  compartmentClearLengthCm?: number
  compartmentClearWidthCm?: number
  compartmentClearHeightCm?: number
  palletLengthCm?: number
  palletWidthCm?: number
  palletEmptyWeightKg?: number
  totalPalletEmptyWeightKg?: number
  maxPalletPayloadKg?: number
  maxBeamPairLoadKg?: number
  maxRackLoadKg?: number
  effectiveRackLoadKg?: number
  maxCargoLengthCm?: number
  maxCargoWidthCm?: number
  maxCargoHeightCm?: number
  maxCargoWeightPerCompartmentKg?: number
  maxCargoWeightPerRackKg?: number
  maxCargoWeightPerWarehouseKg?: number
  maxStoredLoadAtCapacityKg?: number
  maxPalletCountByLoad?: number
  maxPalletCountByGeometry?: number
  maxFeasiblePalletCount?: number | null
  palletRatingOptions?: {
    palletsPerCompartment: number
    lengthCm: number
    widthCm: number
    heightCm: number
    ratingConfigured: boolean
    feasible: boolean
    emptyKg?: number | null
    maxPayloadKg?: number | null
    reason: string
  }[]
  actualPalletOverhangCm?: number
  geometryStatus?: string
  operationStatus?: string
  palletRatingConfigured?: boolean
  availabilityStatus?: string
  warnings?: string[]
  smallBox: BoxSample
  largeBox: BoxSample
  smallBoxPlan?: PalletPlan
  largeBoxPlan?: PalletPlan
  mixedBoxExample?: {
    smallBoxQuantity: number
    largeBoxQuantity: number
    plan: PalletPlan | null
    issue: string | null
  }
  racks: {
    code: string
    bayCount: number
    levels: { number: number; supportTopCm: number; clearHeightCm: number; maxCargoHeightCm?: number }[]
    compartmentCount: number
    palletSlotCount: number
    bayLengthCm: number
    bayWidthCm: number
    maxCargoHeightCm: number
    palletAlongRackCm: number
    palletAcrossRackCm: number
    smallBoxesPerPallet: number
    largeBoxesPerPallet: number
    smallBoxesPerRack: number
    largeBoxesPerRack: number
    effectiveRackLoadKg?: number
    maxBeamPairLoadKg?: number
    maxPalletCountByGeometry?: number
    actualPalletOverhangCm?: number
    geometryStatus?: string
    operationStatus?: string
  }[]
}

export type RackPreview = { previewKey: string; result: RackResult }
export type SavedRackLayout = { result: RackResult; savedAt: string }
export type RackLayoutType = { id: string; code: string; name: string; facilityName: string }
export type RackSpecification = {
  lengthCm: number
  widthCm: number
  heightCm: number
  uprightFrameCount: number
  levelCount: number
  palletsPerCompartment: number
  maxRackLoadKg: number
  maxBeamPairLoadKg: number
}
export type RackLayoutDraft = {
  lengthM?: number
  widthM?: number
  heightM?: number
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
  maxLoadKg: number
  maxStoredLoadKg?: number | null
  storageAisleWidthM?: number | null
  gateWidthM?: number | null
  gateHeightM?: number | null
  lowestObstructionHeightM?: number | null
  overheadClearanceM?: number | null
  storageAisleWidthCm?: number | null
  gateWidthCm?: number | null
  gateHeightCm?: number | null
  lowestObstructionHeightCm?: number | null
  overheadClearanceCm?: number | null
  rackCount?: number | null
  aisleWidthM?: number | null
  rackSpecification?: RackSpecification
}
export type ConfirmedRackLayout = { configuration: RackConfiguration; previewKey: string }
type Envelope<T> = { data: T }

const managerPath = (id: string) => `/api/manager/unit-types/${encodeURIComponent(id)}/rack-layout`

export async function getManagerRackLayout(id: string) {
  return (await apiRequest<Envelope<SavedRackLayout | null>>(managerPath(id))).data
}

export async function previewRackLayout(id: string, configuration: RackConfiguration) {
  return (await apiRequest<Envelope<RackPreview>>(`${managerPath(id)}/preview`, {
    method: 'POST', body: JSON.stringify(configuration),
  })).data
}

export async function previewRackLayoutDraft(facilityId: string, draft: RackLayoutDraft, configuration?: RackConfiguration) {
  const path = `/api/manager/facilities/${encodeURIComponent(facilityId)}/unit-types/rack-layout/preview`
  return (await apiRequest<Envelope<RackPreview>>(path, {
    method: 'POST', body: JSON.stringify(configuration ? { ...draft, configuration } : draft),
  })).data
}

export async function previewRackLayoutDraftForUnitType(unitTypeId: string, draft: RackLayoutDraft) {
  const path = `/api/manager/unit-types/${encodeURIComponent(unitTypeId)}/rack-layout/preview-draft`
  return (await apiRequest<Envelope<RackPreview>>(path, {
    method: 'POST', body: JSON.stringify(draft),
  })).data
}

export async function saveRackLayout(id: string, configuration: RackConfiguration, previewKey: string) {
  return (await apiRequest<Envelope<SavedRackLayout>>(managerPath(id), {
    method: 'PUT', body: JSON.stringify({ configuration, previewKey }),
  })).data
}

export function listBusinessRackLayouts(page: number) {
  return apiRequest<PageResponse<RackLayoutType>>(`/api/business/rack-layouts?page=${page}`)
}

export async function getBusinessRackLayout(id: string) {
  return (await apiRequest<Envelope<SavedRackLayout>>(`/api/business/rack-layouts/${encodeURIComponent(id)}`)).data
}

export async function getCustomerRackLayout(facilityId: string, unitTypeId: string) {
  const path = `/api/customer/facilities/${encodeURIComponent(facilityId)}/unit-types/${encodeURIComponent(unitTypeId)}/rack-layout`
  return (await apiRequest<Envelope<RackResult | null>>(path)).data
}

export function rackLayoutError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Không xử lý được cấu hình kệ.'
  return { message, details: [] as string[] }
}
