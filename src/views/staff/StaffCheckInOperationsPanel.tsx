import ProcessingLeaseBoundary from '../../components/ProcessingLeaseBoundary'
import StaffRecordDocuments from './StaffRecordDocuments'
import IntakeWorkflowPanel from '../../components/IntakeWorkflowPanel'
import HandoverEvidenceRow from './HandoverEvidenceRow'
import { intakeDecisionLabels } from '../../services/inventoryDecision'
import InventoryResolutionPanel from './InventoryResolutionPanel'
import InventoryReviewDetails from './InventoryReviewDetails'
import { PACKAGING_METHOD_OPTIONS } from '../../domain/packagingMethods'
import InventoryFieldDifference from './InventoryFieldDifference'
import InventoryResultNotice from './InventoryResultNotice'
import { getGoodsCatalog, type GoodsCatalog } from '../../services/customerReservationApi'
import { validateCccd, normalizeCccd, maskCccd } from '../../domain/cccd'
import { normalizeRentalIdentity, validateRentalIdentity } from '../../domain/rentalIdentity'
import StaffInventoryVisitPanel from './StaffInventoryVisitPanel'
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ARRIVAL_REVIEW_MS, HANDOVER_TERMS_VERSION, isCheckInHandoverExpired, staffCheckInActions } from "../../domain/reservationCheckInPolicy"
import { ApiClientError } from "../../services/apiClient"
import { packageVolumeM3 } from '../../domain/reservationCapacity'
import { inventoryResult } from '../../domain/inventoryResult'
import { canAccessInventory, inventoryInspectionBlockReason, isCheckInRecoveryTransferred } from '../../domain/inventoryAccess'
import { pageAfterRefresh, shouldReplaceVisiblePage } from '../../domain/checkInListPaging'
import { resolveResumeStep, INSPECTION_STEP, handoverStepForStatus } from '../../domain/staffHandoverPosition'
import { canReturnToInventoryStage, isInventoryResultReopenable, isInventoryStageReadOnly, INVENTORY_STAGE_LABELS, type InventoryStage } from '../../domain/inventoryStages'

import {
  archiveCompletedCheckIn,
  getInventoryDraft,
  saveInventoryDraft,
  prepareInventoryResolution,
  resolveInventoryAtSite,
  submitInventoryRefusal,
  confirmCheckInPayment,
  downloadCheckInEvidence,
  listStaffAccessCredentials,
  listCheckIns,
  recordCheckInRemainingPayment,
  recordCheckInArrival,
  rejectCheckIn,
  scheduleCheckIn,
  signCheckInContract,
  startCheckInSetup,
  uploadCheckInEvidence,
  verifyCheckInIdentity,
  compareCheckInIdentity,
  type IdentityComparison,
  correctCheckInIdentity,
  checkInEvidenceAssetIds,
  type CheckInCase,
  type CheckInPaymentMethod,
  type CheckInGroup,
  type CheckInChecklist,
  type CheckInInventoryLine,
  type CheckInListStatus,
} from "../../services/checkInApi"

import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  SectionHeader,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "../../components/ui"

import {
  extractStaffFieldErrors,
  formatStaffDate,
  formatStaffDateTime,
  parseEmptyStorageHandover,
  inventoryReportNote,
  staffCheckInStatusLabel,
  staffErrorMessage,
  staffStorageUnitStatusLabel,
} from "./staffPresentation"
import { FilePreviewList } from "./StaffFileUpload"
import StaffPagination, { STAFF_PAGE_SIZE } from "./StaffPagination"

const checklistLabels: Array<[keyof CheckInChecklist, string]> = [
  ["identityVerified", "Đã đối chiếu giấy tờ tùy thân"],

  ["reservationMatched", "Khách hàng và đơn đặt kho đã được đối chiếu"],

  ["contractVerified", "Hợp đồng đã được ký và kiểm tra"],

  ["paymentVerified", "Các khoản cần thu trước bàn giao đã được xác nhận"],

  ["measurementVerified", "Đã đo và đối chiếu hàng hóa thực tế"],

  ["unitWalkthrough", "Đã bàn giao kho trống, đối chiếu đủ khung và tấm kê với khách hàng"],

  ["conditionRecorded", "Đã ghi nhận tình trạng hàng hóa"],

  ["accessHandedOver", "Đã bàn giao mã truy cập, thẻ hoặc chìa khóa"],
]

const emptyChecklist = () =>
  Object.fromEntries(
    checklistLabels.map(([key]) => [key, false]),
  ) as unknown as CheckInChecklist

function normalizeIdentityDocument(value: string | null | undefined) {
  return normalizeRentalIdentity(value || "")
}

function hasMaterialVariance(
  actual: string,
  declared: number,
  minimumTolerance: number,
) {
  const actualValue = Number(actual)

  const declaredValue = Number(declared)

  if (!Number.isFinite(actualValue) || !Number.isFinite(declaredValue))
    return false

  return (
    Math.abs(actualValue - declaredValue) >
    Math.max(Math.abs(declaredValue) * 0.05, minimumTolerance)
  )
}

function dimensionsMatch(
  actual: [number, number, number],
  declared: [number | null, number | null, number | null],
) {
  if (declared.some((value) => value == null || !Number.isFinite(value))) return null
  const actualSorted = [...actual].sort((left, right) => left - right)
  const declaredSorted = [...declared].sort((left, right) => Number(left) - Number(right))
  return actualSorted.every((value, index) =>
    Math.abs(value - Number(declaredSorted[index])) <=
    Math.max(Math.abs(Number(declaredSorted[index])) * 0.05, 0.5),
  )
}

function localDateBoundary(date: string, nextDay = false) {
  if (!date) return undefined

  const boundary = new Date(`${date}T00:00:00+07:00`)

  if (nextDay) boundary.setUTCDate(boundary.getUTCDate() + 1)

  return boundary.toISOString()
}

function HandoverWorkflowHelp() {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()

  return (
    <div className="shrink-0" onMouseLeave={() => setVisible(false)}>
      <button
        type="button"
        aria-label="Lưu ý về quy trình bàn giao"
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={() => setVisible(true)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible(true)}
        onKeyDown={event => {
          if (event.key === "Escape" && visible) {
            event.stopPropagation()
            setVisible(false)
          }
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-amber-800 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600"
      >
        <svg aria-hidden="true" className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5m0 3.5h.01" />
        </svg>
      </button>
      {visible && (
        <div id={tooltipId} role="tooltip" className="absolute inset-x-4 z-20 max-w-md pt-1 sm:inset-x-6">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 shadow-md">
            Hoàn tất bàn giao kho trống sẽ chuyển sang chờ khách hàng xác nhận nhận kho. Thời gian chuẩn bị chỉ bắt đầu sau khi khách xác nhận. Nhân viên kiểm kê khi khách báo đã chuẩn bị xong.
          </p>
        </div>
      )}
    </div>
  )
}

const appointmentScheduleNote = "Lịch do khách hàng đặt. Có thể bàn giao sớm."

function AppointmentScheduleHelp() {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()

  return (
    <span className="relative inline-flex normal-case tracking-normal" onMouseLeave={() => setVisible(false)}>
      <button
        type="button"
        aria-label={appointmentScheduleNote}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={() => setVisible(true)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible(current => !current)}
        onKeyDown={event => {
          if (event.key === "Escape" && visible) {
            event.stopPropagation()
            setVisible(false)
          }
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
      >
        <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.5v6m0-9h.01" />
        </svg>
      </button>
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-lg bg-stone-900 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg"
        >
          {appointmentScheduleNote}
        </span>
      )}
    </span>
  )
}

function ComparisonBadge({ matches }: { matches: boolean | null }) {
  if (matches === null) {
    return <Badge variant="muted">Chưa đủ dữ liệu</Badge>
  }

  return (
    <Badge variant={matches ? "success" : "error"}>
      {matches ? "Khớp" : "Chênh lệch"}
    </Badge>
  )
}

function normalizeGoodsLabel(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN") || ""
}

function uniqueGoodsLabels(values: Array<string | null | undefined>) {
  const labels = new Map<string, string>()
  values.forEach(value => {
    const label = value?.trim()
    const normalized = normalizeGoodsLabel(label)
    if (label && normalized && !labels.has(normalized)) labels.set(normalized, label)
  })
  return Array.from(labels.values())
}

function declaredGoodsCategoryValues(lines: CheckInCase["declaredGoodsLines"] | undefined) {
  return uniqueGoodsLabels(lines?.map(line => line.categoryName || line.name) ?? [])
}

function declaredGoodsMaterialValues(lines: CheckInCase["declaredGoodsLines"] | undefined) {
  return uniqueGoodsLabels(lines?.map(line => line.materialName) ?? [])
}

function compareGoodsLabel(actual: string, declared: string[]) {
  const normalizedActual = normalizeGoodsLabel(actual)
  if (!normalizedActual || declared.length === 0) return null
  return declared.some(value => normalizeGoodsLabel(value) === normalizedActual)
}

type InventoryDraft = {
  catalogCategoryId?: string
  catalogMaterialId?: string
  fragile?: boolean
  stackable?: boolean
  allowHorizontalPlacement?: boolean
  maxStackLayers?: number
  quantity: string
  condition: CheckInInventoryLine["condition"] | ""
  note: string
  lengthCm: string
  widthCm: string
  heightCm: string
  weightKg: string
  customGoodsName?: string
  customMaterial?: string
  description?: string
  weightEdited?: boolean
  checked: boolean
}

const emptyInventory: InventoryDraft = {
  quantity: "", condition: "", note: "", lengthCm: "", widthCm: "", heightCm: "", weightKg: "", checked: false,
}

type DeclaredInventoryLine = NonNullable<CheckInCase["declaredGoodsLines"]>[number]

function calculateInventoryWeight(weightPerPackageKg: number | null | undefined, quantity: string) {
  const count = Number(quantity)
  if (weightPerPackageKg == null || !quantity.trim() || !Number.isInteger(count) || count < 0) return ""
  return formatInputNumber(Number((weightPerPackageKg * count).toFixed(2)))
}

function inventoryFromDeclaration(line: DeclaredInventoryLine): InventoryDraft {
  const quantity = formatInputNumber(line.quantity)
  return {
    ...emptyInventory,
    catalogCategoryId: line.catalogCategoryId || '',
    catalogMaterialId: line.catalogMaterialId || '',
    customGoodsName: line.category === 'OTHER' ? line.name || '' : '',
    customMaterial: line.category === 'OTHER' ? line.materialName || '' : '',
    fragile: line.fragile ?? false,
    stackable: line.stackable ?? false,
    allowHorizontalPlacement: line.allowHorizontalPlacement ?? false,
    maxStackLayers: line.maxStackLayers ?? 1,
    quantity,
    lengthCm: formatInputNumber(line.lengthCm),
    widthCm: formatInputNumber(line.widthCm),
    heightCm: formatInputNumber(line.heightCm),
    weightKg: calculateInventoryWeight(line.weightPerPackageKg, quantity),
  }
}

function applyInventoryChanges(line: DeclaredInventoryLine, entry: InventoryDraft, changes: Partial<InventoryDraft>): InventoryDraft {
  const next = { ...entry, checked: false, ...changes }
  if (changes.weightKg !== undefined) {
    next.weightEdited = true
  }
  if (!next.weightEdited && changes.quantity !== undefined) {
    next.weightKg = calculateInventoryWeight(line.weightPerPackageKg, next.quantity)
  }
  return next
}

const inventoryDimensions = [
  ["lengthCm", "Dài thực tế (cm)"], ["widthCm", "Rộng thực tế (cm)"], ["heightCm", "Cao thực tế (cm)"],
] as const

function compareInventory(line: DeclaredInventoryLine, entry: InventoryDraft) {
  const quantity = entry.quantity.trim() ? Number(entry.quantity) : NaN
  const dimensions: [number, number, number] = [Number(entry.lengthCm), Number(entry.widthCm), Number(entry.heightCm)]
  const declaredDimensions: [number | null, number | null, number | null] = [line.lengthCm, line.widthCm, line.heightCm]
  const weight = Number(entry.weightKg)
  const measured = [...dimensions, weight].every(value => Number.isFinite(value) && value >= 0.01)
  const volume = quantity === 0 ? 0 : measured ? packageVolumeM3({ quantity, lengthCm: dimensions[0], widthCm: dimensions[1], heightCm: dimensions[2], weightKg: weight / quantity }) : NaN
  const declaredVolume = declaredDimensions.every(value => value != null)
    ? Number(line.lengthCm) * Number(line.widthCm) * Number(line.heightCm) * line.quantity / 1_000_000
    : NaN
  const badges = [
    { label: "Loại hàng", matches: entry.catalogCategoryId ? entry.catalogCategoryId === line.catalogCategoryId : null },
    { label: "Chất liệu chính", matches: entry.catalogMaterialId ? entry.catalogMaterialId === line.catalogMaterialId : !line.catalogMaterialId ? true : null },
    { label: "Điều kiện xếp", matches: Boolean(entry.fragile) === Boolean(line.fragile) && Boolean(entry.stackable) === Boolean(line.stackable) && Boolean(entry.allowHorizontalPlacement) === Boolean(line.allowHorizontalPlacement) },
    { label: "Số kiện", matches: Number.isInteger(quantity) ? quantity === line.quantity : null },
    { label: "Khối lượng", matches: measured && quantity > 0 && line.weightPerPackageKg != null
      ? !hasMaterialVariance(entry.weightKg, line.weightPerPackageKg * line.quantity, 0.1) : null },
    { label: "Thể tích", matches: quantity > 0 && Number.isFinite(volume) && Number.isFinite(declaredVolume)
      ? !hasMaterialVariance(String(volume), declaredVolume, 0.0001) : null },
    { label: "Kích thước", matches: measured && quantity > 0 ? dimensionsMatch(dimensions, declaredDimensions) : null },
  ]
  return { quantity, dimensions, weight, volume, measured, badges, needsNote: badges.some(badge => badge.matches === false) || entry.condition === "DAMAGED" }
}

type InventoryCapacityState = "PENDING" | "UNKNOWN" | "FULL_FIT" | "LESS_THAN_DECLARED" | "MORE_THAN_DECLARED" | "NOT_FIT"

function evaluateInventoryCapacity(
  rows: Array<{ comparison: ReturnType<typeof compareInventory> }>,
  declaredPackageCount: number | null | undefined,
  capacity: CheckInCase["storageCapacity"],
  complete: boolean,
) {
  const totalPackages = rows.reduce((sum, row) => sum + (row.comparison.quantity > 0 ? row.comparison.quantity : 0), 0)
  const totalWeight = rows.reduce((sum, row) => sum + (row.comparison.quantity > 0 && Number.isFinite(row.comparison.weight) ? row.comparison.weight : 0), 0)
  const totalVolume = rows.reduce((sum, row) => sum + (row.comparison.quantity > 0 && Number.isFinite(row.comparison.volume) ? row.comparison.volume : 0), 0)
  const dimensions = rows.reduce<[number, number, number]>((result, row) => {
    if (!(row.comparison.quantity > 0 && row.comparison.measured)) return result
    const sorted = [...row.comparison.dimensions].sort((a, b) => a - b)
    sorted.forEach((value, index) => { result[index] = Math.max(result[index], value) })
    return result
  }, [0, 0, 0])
  const actualSamples = rows
    .filter(({ comparison }) => comparison.quantity > 0 && comparison.measured)
    .map(({ comparison }) => ({
      quantity: comparison.quantity,
      lengthCm: comparison.dimensions[0],
      widthCm: comparison.dimensions[1],
      heightCm: comparison.dimensions[2],
      weightKg: comparison.weight / comparison.quantity,
    }))
  const calculatedVolume = actualSamples.reduce((sum, sample) => sum + packageVolumeM3(sample), 0)
  const volume = Number.isFinite(calculatedVolume) ? calculatedVolume : totalVolume
  const reasons: string[] = []
  if (!complete) return { state: "PENDING" as InventoryCapacityState, totalPackages, totalWeight, totalVolume: volume, dimensions, reasons }
  if (!capacity || !Object.values(capacity).some(value => typeof value === "number" && Number.isFinite(value) && value > 0)) return { state: "UNKNOWN" as InventoryCapacityState, totalPackages, totalWeight, totalVolume: volume, dimensions, reasons }

  if (capacity.maxLoadKg != null && totalWeight > capacity.maxLoadKg + 0.01) reasons.push(`Khối lượng ${totalWeight.toFixed(2)} kg vượt giới hạn ${capacity.maxLoadKg.toFixed(2)} kg`)
  if (capacity.maxCargoWeightKg != null && totalWeight > capacity.maxCargoWeightKg + 0.01) reasons.push(`Tải hàng ${totalWeight.toFixed(2)} kg vượt giới hạn kệ ${capacity.maxCargoWeightKg.toFixed(2)} kg`)
  if (capacity.volumeM3 != null && volume > capacity.volumeM3 + 0.0001) reasons.push(`Thể tích ${volume.toFixed(4)} m³ vượt sức chứa ${capacity.volumeM3.toFixed(4)} m³`)
  const capacityDimensions = [capacity.maxCargoLengthCm, capacity.maxCargoWidthCm, capacity.maxCargoHeightCm]
  if (capacityDimensions.every(value => value != null) && dimensions.some(value => value <= 0)) reasons.push("Chưa có đủ kích thước thực tế để đối chiếu")
  if (capacityDimensions.every(value => value != null) && dimensions.every(value => value > 0)) {
    const actualSorted = [...dimensions].sort((a, b) => a - b)
    const capacitySorted = capacityDimensions.map(value => Number(value)).sort((a, b) => a - b)
    if (actualSorted.some((value, index) => value > capacitySorted[index])) reasons.push("Kích thước kiện lớn hơn kích thước cho phép của gian kho")
  }
  const fits = reasons.length === 0
  const declared = Number(declaredPackageCount)
  const state: InventoryCapacityState = !fits
    ? "NOT_FIT"
    : Number.isFinite(declared) && totalPackages < declared
      ? "LESS_THAN_DECLARED"
      : Number.isFinite(declared) && totalPackages > declared
        ? "MORE_THAN_DECLARED"
        : "FULL_FIT"
  return { state, totalPackages, totalWeight, totalVolume: volume, dimensions, reasons }
}

const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024

const validateUploadFile = (file: File | null, label: string, onError: (msg: string | null) => void): boolean => {
  if (file && file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    onError(`Tệp ${label} "${file.name}" vượt quá dung lượng tối đa 25MB (${(file.size / (1024 * 1024)).toFixed(1)}MB). Vui lòng chọn tệp nhỏ hơn.`)
    return false
  }
  onError(null)
  return true
}

type MeasurementComparisonKey = "packageCount" | "weight" | "volume" | "dimensions" | "goodsCategory" | "goodsMaterial"

const emptyMeasurementChecks = (): Record<MeasurementComparisonKey, boolean> => ({
  packageCount: false, weight: false, volume: false, dimensions: false,
  goodsCategory: false, goodsMaterial: false,
})

function formatVolume(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ""
  return value.toFixed(9).replace(/0+$/, "").replace(/\.$/, "")
}

function formatInputNumber(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? "" : String(value)
}

function volumeFromDimensions(length: string, width: string, height: string) {
  const dimensions = [length, width, height].map(Number)
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) return ""
  return formatVolume((dimensions[0] * dimensions[1] * dimensions[2]) / 1_000_000)
}

function stepForCheckIn(item: CheckInCase) {
  switch (item.checkInStatus) {
    case "identity_verified": return 2
    case "contract_signed": return 3
    case "payment_collected": return 4
    case "handover_pending_receipt": return 5
    case "setup_in_progress":
      return 5
    case "setup_completed": return 6
    case "completed": return 6
    default: return 1
  }
}

const handoverDeadlineMessage = "Đã hết hạn nhận kho. Không thể tiếp tục bàn giao."

function handoverExpired(item: CheckInCase, now = Date.now()) {
  if (item.attendance?.completionDeadline && stepForCheckIn(item) <= 4) return now > Date.parse(item.attendance.completionDeadline)
  if (item.attendance && (item.attendance.arrivedAt || item.identityVerifiedAt)) return false
  return stepForCheckIn(item) <= 4 && isCheckInHandoverExpired(item.appointmentAt || item.scheduledAt, now)
}

function receiptConfirmationState(item: CheckInCase, now = Date.now()) {
  if (item.checkInStatus !== "handover_pending_receipt" || !item.receiptConfirmationDueAt) {
    return { text: null, expired: false, urgent: false }
  }
  const remaining = new Date(item.receiptConfirmationDueAt).getTime() - now
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { text: "Đã quá hạn xác nhận", expired: true, urgent: true }
  }
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  const parts = [
    days > 0 ? `${days} ngày` : "",
    hours > 0 ? `${hours} giờ` : "",
    rest > 0 ? `${rest} phút` : "",
  ].filter(Boolean)
  return {
    text: `Còn ${parts.join(" ")}`,
    expired: false,
    urgent: remaining <= 2 * 60 * 60_000,
  }
}

function receiptReleaseState(item: CheckInCase, now = Date.now()) {
  if (item.checkInStatus !== "handover_pending_receipt" || !item.receiptConfirmationReleaseAt) {
    return { text: null, eligible: false }
  }
  const remaining = new Date(item.receiptConfirmationReleaseAt).getTime() - now
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { text: "Đã đủ điều kiện để quản lý cơ sở giải phóng kho", eligible: true }
  }
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  const parts = [
    days > 0 ? `${days} ngày` : "",
    hours > 0 ? `${hours} giờ` : "",
    rest > 0 ? `${rest} phút` : "",
  ].filter(Boolean)
  return {
    text: "Quản lý cơ sở có thể giải phóng sau " + parts.join(" "),
    eligible: false,
  }
}

const workflowStepLabels = [
  "Xác minh khách",
  "Ký hợp đồng",
  "Thu tiền",
  "Bàn giao kho",
  "Hoàn tất bàn giao",
  "Kiểm kê hàng",

]

type CheckInFilters = Pick<NonNullable<Parameters<typeof listCheckIns>[0]>, "q" | "status" | "scheduledFrom" | "scheduledTo">

const checkInTableColumnWidths = ["18%", "13%", "15%", "19%", "35%"] as const
const checkInActionButtonBaseClass = "h-9 shrink-0 whitespace-nowrap !px-2 !py-0 !text-xs font-medium"
const inventoryActionClass = "!border-0 enabled:!bg-blue-200 enabled:!text-blue-950 enabled:hover:!bg-blue-300 disabled:!bg-sky-100 disabled:!text-sky-900"
const handoverActionClass = "!border-0 enabled:!bg-amber-400 enabled:!text-amber-950 enabled:hover:!bg-amber-500 disabled:!bg-amber-100 disabled:!text-amber-950"
const documentActionClass = "!border-0 enabled:!bg-violet-600 enabled:!text-white enabled:hover:!bg-violet-700"
const dangerActionClass = "enabled:!bg-red-600 enabled:!text-white enabled:hover:!bg-red-700"

function CheckInTableColumns() {
  return (
    <colgroup>
      {checkInTableColumnWidths.map((width, index) => (
        <col key={index} style={{ width }} />
      ))}
    </colgroup>
  )
}

function CheckInWorkList({ group, filters, refreshKey, renderRow }: {
  group: CheckInGroup
  filters: CheckInFilters
  refreshKey: number
  renderRow: (item: CheckInCase, group: CheckInGroup) => React.ReactNode
}) {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<Awaited<ReturnType<typeof listCheckIns>> | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    // Keep the current rows on screen while refreshing so the list does not blank out and
    // re-appear on every refresh, which reads as the rows jumping.
    setError("")
    void listCheckIns({ ...filters, group, page, pageSize: STAFF_PAGE_SIZE }).then(response => {
      if (!active) return
      const nextPage = pageAfterRefresh(page, response.pagination.totalPages)
      if (nextPage !== page) {
        setPage(nextPage)
      } else {
        setResult(response)
      }
    }).catch(reason => {
      if (active) setError(staffErrorMessage(reason, "Không thể tải danh sách nhận kho."))
    })
    return () => { active = false }
  }, [filters, group, page, refreshKey])

  // Only a filter or group change resets to the loading state; a background refresh keeps the
  // rows that are already visible.
  useEffect(() => { setResult(null) }, [filters, group])

  // The customer confirms receipt and reports setup completion on their own portal, so the
  // operator's list must pick those transitions up on its own instead of waiting for a manual
  // reload. Only the list data is replaced; an open form keeps its own state untouched.
  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const response = await listCheckIns({ ...filters, group, page, pageSize: STAFF_PAGE_SIZE })
        if (!active) return
        // Rows move between the ongoing and processed groups while the operator is reading the
        // list. Keep the visible page whenever it still exists so the table never empties and
        // the operator is not moved to another page mid-read.
        if (shouldReplaceVisiblePage(page, response.pagination.totalPages)) setResult(response)
        else setPage(pageAfterRefresh(page, response.pagination.totalPages))
      } catch {
        // Keep the last good list; the next poll can recover from a temporary read error.
      }
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll()
    }, 15_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [filters, group, page])
  const { totalItems = 0, totalPages = 0 } = result?.pagination ?? {}
  const title = group === "ONGOING" ? "Đang diễn ra" : "Đã xử lý"
  return (
    <section aria-label={title}>
      <Card className="overflow-hidden !rounded-2xl !border !border-stone-200 !bg-white !shadow-none">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {result && <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">{totalItems} hồ sơ</span>}
        </div>
        {error ? <p role="alert" className="p-4 text-sm text-red-800">{error}</p>
          : !result ? <p className="py-8 text-center text-sm text-stone-500">Đang tải hồ sơ…</p>
          : result.data.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              {group === "ONGOING" ? "Không có đơn đang diễn ra phù hợp." : "Không có đơn đã xử lý phù hợp."}
            </p>
          ) : (
            <Table tableClassName="min-w-[1060px] table-fixed">
              <CheckInTableColumns />
              <Thead>
                <Tr>
                  <Th>Đơn đặt giữ kho</Th>
                  <Th>Gian kho</Th>
                  <Th>
                    <span className="inline-flex items-center gap-1">
                      Lịch nhận
                      <AppointmentScheduleHelp />
                    </span>
                  </Th>
                  <Th>Trạng thái</Th>
                  <Th className="text-center">Thao tác</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.map(item => renderRow(item, group))}
              </Tbody>
            </Table>
          )}
        {totalPages > 1 && (
          <StaffPagination
            page={page + 1}
            pageCount={totalPages}
            total={totalItems}
            onPageChange={next => setPage(Math.max(0, next - 1))}
          />
        )}
      </Card>
    </section>
  )
}

export default function StaffCheckInOperationsPanel({
  showToast,
  onOpenReturns,
}: {
  showToast: (message: string) => void
  onOpenReturns?: () => void
}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const [filters, setFilters] = useState<CheckInFilters>({})

  const [queryInput, setQueryInput] = useState("")

  const [statusInput, setStatusInput] = useState<CheckInListStatus | "">("")

  const [scheduledFromInput, setScheduledFromInput] = useState("")

  const [scheduledToInput, setScheduledToInput] = useState("")

  const [error, setError] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  const [handoverTarget, setHandoverTarget] = useState<CheckInCase | null>(null)

  const [receiptNoticeOpen, setReceiptNoticeOpen] = useState(false)

  const [handoverStep, setHandoverStep] = useState(1)
  const [inventoryStage, setInventoryStage] = useState<InventoryStage>(1)
  const [highestInventoryStage, setHighestInventoryStage] = useState<InventoryStage>(1)
  const advanceInventoryStage = (stage: InventoryStage) => {
    setInventoryStage(stage)
    setHighestInventoryStage(current => (stage > current ? stage : current))
  }
  const inventoryCommandLock = useRef(false)
  const [inventoryDraftRevision, setInventoryDraftRevision] = useState(0)
  const [inventorySavedAt, setInventorySavedAt] = useState<string | null>(null)
  const [inventoryEditing, setInventoryEditing] = useState(true)
  // True after the operator walks back from a recorded at-site result: the corrected draft must
  // be published again before the case may move on to the discrepancy stage.
  const [inventoryReopened, setInventoryReopened] = useState(false)
  const [confirmedInventoryReview, setConfirmedInventoryReview] = useState<string | null>(null)
  const inventoryMode = handoverStep === 6
  const inventoryRecordedAtSite = Boolean(handoverTarget?.inventoryResolutionStatus && handoverTarget.inventoryResolutionStatus !== "NOT_STARTED" && handoverTarget.inventoryResolutionStatus !== "ACCEPTED") || handoverTarget?.checkInStatus === "completed"
  const inventoryPublished = inventoryRecordedAtSite && !inventoryReopened

  /** Steps already passed stay reachable so a mistaken entry does not trap the operator. */
  const canGoBackToInventoryStage = (stage: InventoryStage) => canReturnToInventoryStage({
    target: stage,
    current: inventoryStage,
    submitting,
    checkInStatus: handoverTarget?.checkInStatus ?? null,
  })

  const returnToInventoryStage = (stage: InventoryStage) => {
    if (!canGoBackToInventoryStage(stage)) return
    setError(null)
    setFieldErrors({})
    if (stage === 2 && !inventoryInspectionBlockReason(handoverTarget)) {
      // Re-open the editable inspection form even when a draft was already saved.
      setInventoryEditing(true)
      setConfirmedInventoryReview(null)
      // A result recorded at the facility was never sent to the customer, so walking back
      // unlocks the record and requires publishing the corrected numbers again.
      if (inventoryRecordedAtSite) setInventoryReopened(true)
    }
    setInventoryStage(stage)
  }

  const [checklist, setChecklist] = useState<CheckInChecklist>(emptyChecklist)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const clearFieldError = (fieldName: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev
      const next = { ...prev }
      delete next[fieldName]
      return next
    })
  }

  const [adulthoodConfirmed, setAdulthoodConfirmed] = useState(false)
  const [identityDocumentNumber, setIdentityDocumentNumber] = useState("")
  const [identityComparison, setIdentityComparison] = useState<IdentityComparison | null>(null)
  const [identityMismatchAcknowledged, setIdentityMismatchAcknowledged] = useState(false)
  const [editingVerifiedIdentity, setEditingVerifiedIdentity] = useState(false)

  const [bookingOwnerConfirmed, setBookingOwnerConfirmed] = useState(false)
  const [disputedArrival, setDisputedArrival] = useState(false)
  const [arrivalEvidence, setArrivalEvidence] = useState("")
  const [actualArrival, setActualArrival] = useState("")
  const [verificationNotes, setVerificationNotes] = useState("")

  const [lengthCm, setLengthCm] = useState("100")

  const [widthCm, setWidthCm] = useState("100")

  const [heightCm, setHeightCm] = useState("100")

  const [weightKg, setWeightKg] = useState("1")

  const [volumeM3, setVolumeM3] = useState("1")

  const [varianceAccepted, setVarianceAccepted] = useState(false)

  const [varianceReason, setVarianceReason] = useState("")

  const [measurementChecks, setMeasurementChecks] = useState(emptyMeasurementChecks)

  const [initialCondition, setInitialCondition] = useState(
    "Gian kho sạch, khóa và đèn hoạt động bình thường",
  )

  const [goodsCondition, setGoodsCondition] = useState(
    "Hàng hóa nguyên vẹn khi tiếp nhận",
  )

  const [packageCount, setPackageCount] = useState("1")
  const [inventoryDraft, setInventoryDraft] = useState<Record<string, InventoryDraft>>({})

  const [goodsCategory, setGoodsCategory] = useState("")

  const [goodsMaterial, setGoodsMaterial] = useState("")
  const [actualPackagingMethod, setActualPackagingMethod] = useState("")
  const [packagingCondition, setPackagingCondition] = useState<'' | 'INTACT' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'UNPACKAGED'>('')

  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])

  const [contractFile, setContractFile] = useState<File | null>(null)
  const [confirmedSetupTerms, setConfirmedSetupTerms] = useState<string | null>(null)
  const setupTermsKey = handoverTarget?.setupEarlyExitPolicyVersion
    ? JSON.stringify([handoverTarget.checkInId, handoverTarget.setupEarlyExitPolicyVersion, handoverTarget.setupEarlyExitFee])
    : null

  const [paymentEvidenceFile, setPaymentEvidenceFile] = useState<File | null>(null)

  const [evidenceReferences, setEvidenceReferences] = useState<string[]>([])
  const evidenceUploadTimes = useRef(new Map<string, string>())

  const [handedOverItems, setHandedOverItems] = useState(
    "Biên nhận bàn giao",
  )

  const [handoverNotes, setHandoverNotes] = useState("")

  const [keyLockReference, setKeyLockReference] = useState("")
  const lockHelpId = useId()
  const [lockChecked, setLockChecked] = useState(false)
  const standardLock = /^LOCK-(?!000$)[0-9]{3}$/i.test(keyLockReference.trim())
  const [handoverRackCount, setHandoverRackCount] = useState("")
  const [handoverPalletCount, setHandoverPalletCount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<CheckInPaymentMethod>("CASH")


  const [rejectTarget, setRejectTarget] = useState<CheckInCase | null>(null)
  const [rejectedIdentityDocument, setRejectedIdentityDocument] = useState<string>()

  const [rejectReason, setRejectReason] = useState("")

  const [rejectDisposition, setRejectDisposition] =
    useState<"AVAILABLE" | "MAINTENANCE">("AVAILABLE")

  const [rejectEvidenceFiles, setRejectEvidenceFiles] = useState<File[]>([])

  const [rejectEvidenceReferences, setRejectEvidenceReferences] =
    useState<string[]>([])

  const [detailTarget, setDetailTarget] = useState<CheckInCase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CheckInCase | null>(null)

  const [downloadingEvidence, setDownloadingEvidence] = useState<string | null>(
    null,
  )

  const [previewEvidence, setPreviewEvidence] = useState<{
    url: string
    contentType: string
    fileName: string
  } | null>(null)
  useEffect(() => () => {
    if (previewEvidence) URL.revokeObjectURL(previewEvidence.url)
  }, [previewEvidence])

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const refreshCheckIns = () => setRefreshKey((value) => value + 1)
    window.addEventListener("storagehub:checkins-refresh", refreshCheckIns)
    return () => {
      window.removeEventListener("storagehub:checkins-refresh", refreshCheckIns)
    }
  }, [])

  const declaredLines = handoverTarget?.declaredGoodsLines ?? []
  const [inventoryCatalog, setInventoryCatalog] = useState<GoodsCatalog>()
  const [catalogError, setCatalogError] = useState(false)
  const [catalogRetry, setCatalogRetry] = useState(0)
  const inventoryTargetId = handoverTarget?.checkInId
  useEffect(() => {
    if (!inventoryTargetId) return
    let current = true
    setCatalogError(false)
    void getGoodsCatalog().then(catalog => {
      if (current) setInventoryCatalog(catalog)
    }).catch(() => { if (current) setCatalogError(true) })
    return () => { current = false }
  }, [inventoryTargetId, catalogRetry])
  const legacyDeclaredLines = declaredLines.filter(line => !line.catalogCategoryId)
  const declaredCategoryValues = useMemo(
    () => declaredGoodsCategoryValues(legacyDeclaredLines),
    [legacyDeclaredLines],
  )
  const declaredMaterialValues = useMemo(
    () => declaredGoodsMaterialValues(legacyDeclaredLines),
    [legacyDeclaredLines],
  )
  const goodsCategoryMatches = compareGoodsLabel(goodsCategory, declaredCategoryValues)
  const goodsMaterialMatches = compareGoodsLabel(goodsMaterial, declaredMaterialValues)
  const lineInventory = declaredLines.length > 0 && (
    handoverTarget?.checkInStatus !== "completed" || Boolean(handoverTarget.handover?.inventoryLines?.some(line => line.measurements))
  )
  // Stable identity: this feeds expensive comparisons and effect dependencies, so rebuilding the
  // array on every render made the open inspection form recompute and flicker.
  const inventoryRows = useMemo(() => declaredLines.map(line => {
    const entry = inventoryDraft[line.id] ?? (
      handoverTarget?.checkInStatus === "completed" ? emptyInventory : inventoryFromDeclaration(line)
    )
    return { line, entry, comparison: compareInventory(line, entry) }
  }), [declaredLines, inventoryDraft, handoverTarget?.checkInStatus])
  const goodsDeclarationVariance = goodsCategoryMatches === false || goodsMaterialMatches === false
    || inventoryRows.some(({ line, entry, comparison }) => comparison.quantity > 0 && inventoryCatalog?.categories.find(category => category.id === entry.catalogCategoryId)?.custom && ((entry.customGoodsName?.trim() || "") !== (line.name || "") || (entry.customMaterial?.trim() || "") !== (line.materialName || "")))
    || inventoryRows.some(({ line, entry, comparison }) => comparison.quantity > 0 && !!line.catalogCategoryId
      && (entry.catalogCategoryId !== line.catalogCategoryId || (entry.catalogMaterialId || null) !== (line.catalogMaterialId || null)))
  const inventoryLinesComplete = inventoryRows.every(({ line, entry, comparison }) => {
    const { quantity, measured } = comparison
    const custom = inventoryCatalog?.categories.find(category => category.id === entry.catalogCategoryId)?.custom
    return (quantity === 0 || !custom || Boolean(entry.customGoodsName?.trim())) && entry.checked && Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647
      && (quantity === 0 || Boolean(entry.catalogCategoryId))
      && Boolean(entry.condition) && (quantity === 0 ? entry.condition === "NOT_PRESENT" : measured && Number.isFinite(comparison.volume) && entry.condition !== "NOT_PRESENT")
      && (entry.condition !== "DAMAGED" || Boolean(entry.note.trim()))
      && (quantity === 0 || !line.catalogCategoryId || Boolean(entry.catalogCategoryId))
  })
  const inventoryCapacity = lineInventory
    ? evaluateInventoryCapacity(
        inventoryRows,
        handoverTarget?.declaredPackageCount,
        handoverTarget?.storageCapacity,
        inventoryLinesComplete,
      )
    : null
  const inventoryReviewKey = JSON.stringify([handoverTarget?.checkInId, inventoryDraft, actualPackagingMethod, packagingCondition, varianceReason, handoverNotes, handoverTarget?.storageCapacity])
  const inventoryReviewConfirmed = confirmedInventoryReview === inventoryReviewKey || Boolean(inventorySavedAt && !inventoryEditing)
  const actualDimensions = [0, 0, 0]
  let actualWeight = 0
  let actualVolume = 0
  for (const { comparison } of inventoryRows) {
    if (!(comparison.quantity > 0 && comparison.measured)) continue
    const sorted = [...comparison.dimensions].sort((a, b) => a - b)
    sorted.forEach((value, index) => { actualDimensions[index] = Math.max(actualDimensions[index], value) })
    actualWeight += comparison.weight
    actualVolume += comparison.volume
  }
  const totalPackages = lineInventory
    ? inventoryRows.reduce((sum, { comparison }) => sum + (comparison.quantity || 0), 0)
    : Number(packageCount)

  const lineDiscrepancies = useMemo(() => {
    if (!lineInventory) return []
    return inventoryRows.flatMap(({ line, entry, comparison }, index) => {
      const lineName = line.name || `Hàng hóa #${index + 1}`
      const diffs: string[] = []
      if (comparison.badges[0].matches === false) {
        diffs.push(`Số kiện: Thực tế ${comparison.quantity} kiện vs Khai báo ${line.quantity} kiện`)
      }
      if (comparison.badges[1].matches === false) {
        diffs.push(`Khối lượng chênh lệch`)
      }
      if (comparison.badges[2].matches === false) {
        diffs.push(`Thể tích chênh lệch`)
      }
      if (comparison.badges[3].matches === false) {
        diffs.push(`Kích thước khác khai báo`)
      }
      if (entry.condition === "DAMAGED") {
        diffs.push(`Tình trạng: Có hư hỏng`)
      } else if (entry.condition === "NOT_PRESENT") {
        diffs.push(`Không có kiện nào`)
      }
      return diffs.map((d) => `${lineName} (${d})`)
    })
  }, [lineInventory, inventoryRows])

  const allChecksComplete = checklistLabels.every(([key]) =>
    lineInventory && (key === "measurementVerified" || key === "conditionRecorded") ? inventoryLinesComplete : checklist[key],
  )

  useEffect(() => {
    const measurementVerified = Object.values(measurementChecks).every(Boolean)
    setChecklist((previous) =>
      previous.measurementVerified === measurementVerified
        ? previous
        : { ...previous, measurementVerified },
    )
  }, [measurementChecks])

  const checkInComparison = useMemo(() => {
    if (!handoverTarget) return null

    const declaredPackageCount = handoverTarget.declaredPackageCount ?? null
    const actualPackageCount = packageCount.trim()
      ? Number(packageCount)
      : Number.NaN
    const actualWeight = weightKg.trim() ? Number(weightKg) : Number.NaN
    const actualVolume = volumeM3.trim() ? Number(volumeM3) : Number.NaN
    const packageCountMatches =
      declaredPackageCount !== null && Number.isFinite(actualPackageCount)
        ? actualPackageCount === declaredPackageCount
        : null
    const weightMatches = Number.isFinite(actualWeight)
      ? !hasMaterialVariance(
          weightKg,
          handoverTarget.declaredGoodsWeightKg,
          0.1,
        )
      : null
    const volumeMatches = Number.isFinite(actualVolume)
      ? !hasMaterialVariance(
          volumeM3,
          handoverTarget.declaredGoodsVolumeM3,
          0.0001,
        )
      : null
    const declaredDimensions: [number | null, number | null, number | null] = [
      handoverTarget.declaredGoodsLengthCm,
      handoverTarget.declaredGoodsWidthCm,
      handoverTarget.declaredGoodsHeightCm,
    ]
    const actualDimensions: [number, number, number] = [
      Number(lengthCm),
      Number(widthCm),
      Number(heightCm),
    ]
    const dimensionMatches = actualDimensions.every((value) => Number.isFinite(value) && value > 0)
      ? dimensionsMatch(actualDimensions, declaredDimensions)
      : null

    return {
      declaredPackageCount,
      actualPackageCount,
      packageCountMatches,
      declaredWeight: handoverTarget.declaredGoodsWeightKg,
      actualWeight,
      weightMatches,
      declaredVolume: handoverTarget.declaredGoodsVolumeM3,
      actualVolume,
      volumeMatches,
      declaredDimensions,
      actualDimensions,
      dimensionMatches,
      declaredDimensionsAvailable: declaredDimensions.every((value) => value != null),
      hasVariance: [packageCountMatches, weightMatches, volumeMatches, dimensionMatches].some(
        (matches) => matches === false,
      ),
    }
  }, [handoverTarget, heightCm, lengthCm, packageCount, volumeM3, weightKg, widthCm])

  const singleDiscrepancies = useMemo(() => {
    if (lineInventory || !checkInComparison) return []
    const diffs: string[] = []
    if (checkInComparison.packageCountMatches === false) {
      diffs.push(`Số kiện: Thực tế ${packageCount} kiện vs Khai báo ${handoverTarget?.declaredPackageCount ?? 0} kiện`)
    }
    if (checkInComparison.weightMatches === false) {
      diffs.push(`Khối lượng: Thực tế ${weightKg} kg vs Khai báo ${handoverTarget?.declaredGoodsWeightKg ?? 0} kg`)
    }
    if (checkInComparison.volumeMatches === false) {
      diffs.push(`Thể tích: Thực tế ${volumeM3} m³ vs Khai báo ${handoverTarget?.declaredGoodsVolumeM3 ?? 0} m³`)
    }
    if (checkInComparison.dimensionMatches === false) {
      diffs.push(`Kích thước thực tế khác khai báo`)
    }
    return diffs
  }, [lineInventory, checkInComparison, packageCount, weightKg, volumeM3, handoverTarget])

  const activeDiscrepancies = lineInventory ? lineDiscrepancies : singleDiscrepancies

  const packageCountValid = Number.isInteger(totalPackages) && totalPackages > 0 && totalPackages <= 2147483647
  const updateInventoryLine = (line: DeclaredInventoryLine, changes: Partial<InventoryDraft>) => {
    const field = `inventory-${line.id}`
    setFieldErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${field}-`) && key !== "packageCount")))
    setInventoryDraft(current => ({
      ...current,
      [line.id]: applyInventoryChanges(line, current[line.id] ?? inventoryFromDeclaration(line), changes),
    }))
    setVarianceAccepted(false)
  }
  const packagingMethodMismatch = Boolean(actualPackagingMethod.trim() && handoverTarget?.declaredPackagingMethod
    && actualPackagingMethod.trim().toLocaleLowerCase('vi') !== handoverTarget.declaredPackagingMethod.trim().toLocaleLowerCase('vi'))
  const measurementVariance = goodsDeclarationVariance || packagingMethodMismatch
    || packagingCondition === 'MINOR_DAMAGE' || packagingCondition === 'MAJOR_DAMAGE' || (lineInventory
    ? inventoryRows.some(({ comparison }) => comparison.badges.some(badge => badge.matches === false))
      || (inventoryLinesComplete && packageCountValid && (totalPackages !== handoverTarget?.declaredPackageCount
        || hasMaterialVariance(String(actualWeight), handoverTarget?.declaredGoodsWeightKg ?? NaN, 0.1)
        || hasMaterialVariance(String(actualVolume), handoverTarget?.declaredGoodsVolumeM3 ?? NaN, 0.0001)
        || dimensionsMatch([actualDimensions[0], actualDimensions[1], actualDimensions[2]], [
          handoverTarget?.declaredGoodsLengthCm ?? null, handoverTarget?.declaredGoodsWidthCm ?? null, handoverTarget?.declaredGoodsHeightCm ?? null,
        ]) === false))
    : checkInComparison?.hasVariance ?? false)
  const packagingNoteRequired = Boolean(packagingCondition && packagingCondition !== "INTACT")
  const effectiveVarianceReason = varianceReason.trim()
  const hasEmptyStorageEvidence = evidenceFiles.length > 0 || evidenceReferences.length > 0
  const validHandoverRackCount = handoverRackCount.trim() !== "" && Number.isInteger(Number(handoverRackCount)) && Number(handoverRackCount) >= 0
  const validHandoverPalletCount = handoverPalletCount.trim() !== "" && Number.isInteger(Number(handoverPalletCount)) && Number(handoverPalletCount) >= 0
  const emptyStorageChecklistReady = Boolean(checklist.unitWalkthrough && checklist.conditionRecorded && checklist.accessHandedOver)
  const emptyStorageHandoverReady = Boolean(
    keyLockReference.trim()
    && initialCondition.trim()
    && validHandoverRackCount
    && validHandoverPalletCount
    && hasEmptyStorageEvidence
    && emptyStorageChecklistReady,
  )

  const workflowCurrentStep = handoverTarget ? stepForCheckIn(handoverTarget) : 1
  const handoverDeadlinePassed = handoverTarget ? handoverExpired(handoverTarget, now) : false
  const arrivalDeadline = handoverTarget?.attendance?.deadline
  const inArrivalReview = !!arrivalDeadline && now > Date.parse(arrivalDeadline)
  const needsHandoverArrival = !inventoryMode && handoverTarget?.checkInStatus === "scheduled"
    && !handoverTarget.attendance?.arrivedAt
  // An at-site result was never sent to the customer, so the operator may still correct the
  // inspection. Anything already sent to the customer keeps the form read-only.
  const inventoryResultReopenable = isInventoryResultReopenable({
    resolutionStatus: handoverTarget?.inventoryResolutionStatus,
    checkInStatus: handoverTarget?.checkInStatus,
  })
  const inventoryBlockedReason = inventoryInspectionBlockReason(handoverTarget, now)
  const inventoryStageReadOnly = inventoryMode && (Boolean(inventoryBlockedReason) || isInventoryStageReadOnly({
    stage: inventoryStage,
    published: inventoryPublished,
    reopenable: inventoryResultReopenable,
  }))
  const isViewingEarlierInventoryStage = inventoryMode && inventoryStage < highestInventoryStage
  const isReviewingCompletedStep = Boolean(
    handoverTarget &&
      (handoverTarget.checkInStatus === "completed" || handoverStep < workflowCurrentStep ||
        (handoverStep === 4 && ["handover_pending_receipt", "setup_in_progress", "setup_completed", "completed"].includes(handoverTarget.checkInStatus || ""))),
  ) || inventoryStageReadOnly || isViewingEarlierInventoryStage

  const handoverEvidenceIds = checkInEvidenceAssetIds(
    isReviewingCompletedStep ? parseEmptyStorageHandover(handoverTarget?.readinessNote).evidenceReferences : evidenceReferences,
  )

  const declaredIdentityDocument = handoverTarget?.identityDocumentNumber?.trim() || ""
  const savedIdentityMismatch = Boolean(
    declaredIdentityDocument &&
      identityDocumentNumber.trim() &&
      normalizeIdentityDocument(declaredIdentityDocument) !==
        normalizeIdentityDocument(identityDocumentNumber),
  )
  const enteredIdentity = normalizeIdentityDocument(identityDocumentNumber)
  const savedIdentity = normalizeIdentityDocument(declaredIdentityDocument)
  const reviewedCorrectionTooLarge = savedIdentityMismatch && (
    !/^[0-9]{12}$/.test(savedIdentity) || !/^[0-9]{12}$/.test(enteredIdentity)
    || Array.from(savedIdentity).filter((digit, index) => digit !== enteredIdentity[index]).length > 1
  )
  const identityMismatch = !isReviewingCompletedStep && (identityComparison === "CORRECTABLE" || identityComparison === "REJECT")
  const identityCorrection = identityComparison === "CORRECTABLE" && identityMismatchAcknowledged
  const identityCanConfirm = identityComparison === "MATCH" || identityCorrection
  const identityValidation = validateRentalIdentity(identityDocumentNumber)
  const identityNeedsNotes = identityCorrection || !declaredIdentityDocument

  const refresh = () => setRefreshKey((value) => value + 1)

  const refreshHandoverTarget = async () => {
    if (!handoverTarget?.checkInId) return

    try {
      const response = await listCheckIns({
        page: 0,
        pageSize: 100,
        q: handoverTarget.reservationCode,
      })
      const latest = response.data.find((item) => item.checkInId === handoverTarget.checkInId)
      if (!latest) return

      setHandoverTarget(latest)
      // Manual refresh keeps the operator in the workflow they are looking at.
      setHandoverStep(current => resolveResumeStep({
        requestedInspection: inventoryMode,
        currentlyInInspection: inventoryMode,
        currentStep: current,
        status: latest.checkInStatus,
      }))
    } catch (reason) {
      fail(reason, "Không thể cập nhật trạng thái bàn giao.")
    }
  }

  // The customer confirms receipt and reports setup completion on their own portal. While the
  // operator has this case open on a customer-waiting step, the form must follow those
  // transitions by itself — closing the waiting popup must not stop the sync.
  const awaitngCustomerTransition = Boolean(
    handoverTarget?.checkInId
    && ["handover_pending_receipt", "setup_in_progress"].includes(handoverTarget.checkInStatus || ""),
  )

  useEffect(() => {
    if (!awaitngCustomerTransition || !handoverTarget?.checkInId) return

    let active = true
    const pollCustomerTransition = async () => {
      try {
        const response = await listCheckIns({
          page: 0,
          pageSize: 100,
          q: handoverTarget.reservationCode,
        })
        const latest = response.data.find((item) => item.checkInId === handoverTarget.checkInId)
        if (!active || !latest) return

        const previousStatus = handoverTarget.checkInStatus
        // Every tick returns a fresh object. Replacing state when nothing changed re-renders the
        // whole form every 3 seconds and makes the open inspection step flicker.
        if (latest.checkInStatus === previousStatus
          && latest.inventoryResolutionStatus === handoverTarget.inventoryResolutionStatus
          && latest.inventoryVisit?.arrivedAt === handoverTarget.inventoryVisit?.arrivedAt
          && latest.inventoryVisit?.identityVerifiedAt === handoverTarget.inventoryVisit?.identityVerifiedAt) {
          return
        }
        setHandoverTarget(latest)
        // Polling must not move the operator. Only a real status transition advances the step;
        // a regular tick that finds the same status leaves the open step untouched.
        if (latest.checkInStatus !== previousStatus) {
          setHandoverStep(current => current === 6 && canAccessInventory(latest) ? 6 : Math.min(5, stepForCheckIn(latest)))
        }
        if (previousStatus === "handover_pending_receipt" && latest.checkInStatus === "setup_in_progress") {
          showToast("Khách hàng đã xác nhận nhận kho. Đang chờ khách chuẩn bị hàng để kiểm kê.")
        } else if (previousStatus === "setup_in_progress" && latest.checkInStatus === "setup_completed") {
          showToast("Khách hàng đã báo sẵn sàng kiểm kê. Bước kiểm kê hàng hóa đã được mở.")
        }
      } catch {
        // Keep the last known state. The next poll can recover from a temporary read error.
      }
    }

    const timer = window.setInterval(() => void pollCustomerTransition(), 3000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [awaitngCustomerTransition, handoverTarget?.checkInId, handoverTarget?.checkInStatus, handoverTarget?.reservationCode, showToast])

  const closeHandover = () => {
    if (submitting) return
    setError(null)
    setFieldErrors({})
    setReceiptNoticeOpen(false)
    setHandoverTarget(null)
  }

  const applyFilters = () => {
    if (
      scheduledFromInput &&
      scheduledToInput &&
      scheduledFromInput > scheduledToInput
    ) {
      setError("Ngày bắt đầu không được sau ngày kết thúc.")

      return
    }

    setError(null)

    setFilters({
      q: queryInput.trim(),
      status: statusInput || undefined,
      scheduledFrom: localDateBoundary(scheduledFromInput),
      scheduledTo: localDateBoundary(scheduledToInput, true),
    })
  }

  const resetFilters = () => {
    setQueryInput("")

    setStatusInput("")

    setScheduledFromInput("")

    setScheduledToInput("")

    setFilters({})

    setError(null)

    refresh()
  }

  const fail = (reason: unknown, fallback: string) => {
    const fields = extractStaffFieldErrors(reason)
    if (Object.keys(fields).length > 0) {
      setFieldErrors(fields)
    }
    const message = staffErrorMessage(reason, fallback)
    setError(message)
    showToast(message)
  }

  const submitHandover = async () => {
    if (submitting || inventoryCommandLock.current) return
    const blocked = inventoryInspectionBlockReason(handoverTarget)
    if (blocked) { setError(blocked); return }
    setFieldErrors({})
    setError(null)

    const errors: Record<string, string> = {}
    if (lineInventory && !inventoryReviewConfirmed) errors.inventoryReview = "Vui lòng xác nhận kết quả kiểm tra hàng hóa và sức chứa."
    if (lineInventory) {
      for (const { line, entry, comparison } of inventoryRows) {
        const field = `inventory-${line.id}`
        const { quantity, measured, needsNote } = comparison
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) {
          errors[`${field}-quantity`] = "Nhập số kiện nguyên từ 0 trở lên"
        }
        if (quantity !== 0) {
          const measurements = [
            ["lengthCm", entry.lengthCm, "Chiều dài thực tế"],
            ["widthCm", entry.widthCm, "Chiều rộng thực tế"],
            ["heightCm", entry.heightCm, "Chiều cao thực tế"],
            ["weightKg", quantity > 0 ? String(Number(entry.weightKg) / quantity) : "", "Nặng/kiện"],
          ] as const
          for (const [measurementKey, value, label] of measurements) {
            if (!Number.isFinite(Number(value)) || Number(value) < 0.01) {
              errors[`${field}-${measurementKey}`] = `${label} phải từ 0,01 trở lên`
            }
          }
        }
        if (quantity !== 0 && !entry.catalogCategoryId) {
          errors[`${field}-category`] = "Chọn loại hàng thực tế từ danh mục"
        }
        if (!entry.condition || (quantity === 0) !== (entry.condition === "NOT_PRESENT")) {
          errors[`${field}-condition`] = "Chọn tình trạng phù hợp với số kiện thực tế"
        }
        if (entry.condition === "DAMAGED" && !entry.note.trim()) {
          errors[`${field}-note`] = "Vui lòng mô tả tình trạng hư hỏng của dòng hàng."
        }
        if (quantity !== 0 && inventoryCatalog?.categories.find(category => category.id === entry.catalogCategoryId)?.custom && !entry.customGoodsName?.trim()) errors[`${field}-name`] = "Vui lòng nhập tên hàng hóa khác."
        if (!entry.checked) {
          errors[`${field}-checked`] = "Xác nhận đã đối chiếu dòng hàng"
        }
      }
    } else {
      const measurements = [
        ["lengthCm", lengthCm, "Chiều dài"], ["widthCm", widthCm, "Chiều rộng"],
        ["heightCm", heightCm, "Chiều cao"], ["weightKg", weightKg, "Khối lượng"],
      ] as const
      for (const [key, value, label] of measurements) {
        if (!Number.isFinite(Number(value)) || Number(value) < 0.01) {
          errors[key] = `${label} thực tế phải từ 0,01 trở lên`
        }
      }
      if (!goodsCondition.trim()) {
        errors.goodsCondition = "Vui lòng nhập tình trạng hàng hóa"
      }
      if (!checklist.conditionRecorded) {
        errors.conditionRecorded = "Vui lòng đánh dấu đã ghi nhận tình trạng hàng hóa"
      }
      if (!Object.values(measurementChecks).every(Boolean)) {
        errors.measurementChecks = "Vui lòng xác nhận đã đối chiếu số liệu"
      }
    }
    if (!packageCountValid) {
      errors.packageCount = "Tổng số kiện thực tế phải là số nguyên từ 1 đến 2.147.483.647"
    }
    if (!lineInventory && !goodsCategory.trim()) errors.goodsCategory = "Vui lòng nhập loại hàng"
    if (!lineInventory && !goodsMaterial.trim()) errors.goodsMaterial = "Vui lòng nhập chất liệu chính"
    if (!actualPackagingMethod.trim()) errors.actualPackagingMethod = "Vui lòng ghi nhận phương thức đóng gói thực tế"
    if (packagingNoteRequired && !handoverNotes.trim()) errors.notes = "Vui lòng mô tả tình trạng đóng gói không nguyên vẹn."
    if (!packagingCondition) errors.packagingCondition = "Vui lòng chọn tình trạng đóng gói thực tế"
    if (!initialCondition.trim()) errors.initialCondition = "Cần ghi nhận hiện trạng kho ở bước bàn giao"
    if (!keyLockReference.trim()) errors.lockReference = "Cần ghi nhận mã ổ khóa hoặc chìa khóa ở bước bàn giao"
    if ((!lineInventory || inventoryLinesComplete) && !allChecksComplete && !Object.keys(errors).length) {
      errors.handoverChecklist = "Cần hoàn tất các bước xác nhận trước khi kiểm kê"
    }
    if (measurementVariance) {
      if (!lineInventory && !varianceAccepted) {
        errors.varianceAccepted = "Cần ghi nhận chấp thuận chênh lệch ở biểu mẫu cũ"
      }
      if (effectiveVarianceReason.length < 10) {
        errors.varianceReason = "Vui lòng mô tả rõ chênh lệch, tối thiểu 10 ký tự"
      }
    }
    const emptyStorageReferences = checkInEvidenceAssetIds(
      parseEmptyStorageHandover(handoverTarget?.readinessNote).evidenceReferences,
    )
    const inventoryEvidenceReferences = checkInEvidenceAssetIds(evidenceReferences)
      .filter(reference => !emptyStorageReferences.includes(reference))
    if (!evidenceFiles.length && !inventoryEvidenceReferences.length) {
      errors.evidenceFiles = "Cần tải lên ít nhất 1 ảnh hoặc tệp PDF bằng chứng kiểm kê"
    }

    const providedIdentity = normalizeIdentityDocument(identityDocumentNumber)
    if (!providedIdentity) {
      errors.identityDocumentNumber = "Cần số CCCD hoặc hộ chiếu."
    } else if (!validateRentalIdentity(providedIdentity).ok) {
      errors.identityDocumentNumber = validateRentalIdentity(providedIdentity).error || "Vui lòng nhập giấy tờ hợp lệ."
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setInventoryStage(errors.identityDocumentNumber ? 1 : 2)
      setError("Một số trường thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu đỏ bên dưới.")
      return
    }

    if (!handoverTarget?.checkInId) return

    inventoryCommandLock.current = true
    setSubmitting(true)

    try {
      // Older readiness notes can contain file names or paths. Completion accepts
      // only uploaded FileAsset UUIDs and must not reuse empty-storage evidence as
      // the required inventory evidence.
      const emptyStorageReferences = checkInEvidenceAssetIds(
        parseEmptyStorageHandover(handoverTarget.readinessNote).evidenceReferences,
      )
      const uploadedEvidence = checkInEvidenceAssetIds(evidenceReferences)
        .filter(reference => !emptyStorageReferences.includes(reference))

      for (const file of evidenceFiles) {
        const asset = await uploadCheckInEvidence(
          handoverTarget.checkInId,
          file,
          'CHECK_IN',
          'bang-chung-kiem-ke-hang-hoa',
          handoverTarget.reservationCode,
        )

        uploadedEvidence.push(asset.id)
      }

      if (evidenceFiles.length) {
        setEvidenceReferences(uploadedEvidence)

        setEvidenceFiles([])
      }

      const savedDraft = await saveInventoryDraft(handoverTarget.checkInId, {
        checklist: lineInventory ? { ...checklist, measurementVerified: true, conditionRecorded: true } : checklist,

        identityDocumentNumber: providedIdentity,

        identityVerificationNote: verificationNotes.trim() || null,

        actualMeasurements: {
          lengthCm: lineInventory ? actualDimensions[0] : Number(lengthCm),

          widthCm: lineInventory ? actualDimensions[1] : Number(widthCm),

          heightCm: lineInventory ? actualDimensions[2] : Number(heightCm),

          weightKg: lineInventory ? actualWeight : Number(weightKg),

          actualVolumeM3: lineInventory ? actualVolume : Number(volumeM3),

          varianceAccepted: lineInventory ? measurementVariance : measurementVariance && varianceAccepted,
        },

        varianceReason: measurementVariance ? effectiveVarianceReason : null,

        initialUnitCondition: initialCondition.trim(),

        goodsCondition: lineInventory ? "Đã ghi nhận tình trạng theo từng dòng hàng" : goodsCondition.trim(),

        packageCount: totalPackages,
        inventoryLines: lineInventory ? inventoryRows.map(({ line, entry, comparison }) => ({
          goodsItemId: line.id,
          actualQuantity: comparison.quantity,
          actualGoods: comparison.quantity > 0 ? {
            category: inventoryCatalog?.categories.find(c => c.id === entry.catalogCategoryId)?.reservationCategory || 'OTHER',
            catalogCategoryId: entry.catalogCategoryId,
            catalogMaterialId: entry.catalogMaterialId || null,
            description: entry.description?.trim() || line.name || 'Hàng hóa thực tế',
            customGoodsName: entry.customGoodsName?.trim() || line.name,
            customMaterial: inventoryCatalog?.categories.find(c => c.id === entry.catalogCategoryId)?.custom ? entry.customMaterial?.trim() || null : null,
            quantity: comparison.quantity,
            lengthCm: comparison.dimensions[0], widthCm: comparison.dimensions[1], heightCm: comparison.dimensions[2],
            weightPerItemKg: comparison.weight / comparison.quantity,
            fragile: Boolean(entry.fragile), stackable: Boolean(entry.stackable),
            allowHorizontalPlacement: Boolean(entry.allowHorizontalPlacement), maxStackLayers: entry.maxStackLayers || 1,
          } : null,
          condition: entry.condition as CheckInInventoryLine["condition"],
          note: [comparison.needsNote && effectiveVarianceReason ? `Lý do chênh lệch: ${effectiveVarianceReason}` : "", entry.condition === "DAMAGED" && entry.note.trim() ? `Mô tả hư hỏng: ${entry.note.trim()}` : ""].filter(Boolean).join("\n").slice(0, 1000) || null,
          measurements: comparison.quantity > 0 ? {
            lengthCm: comparison.dimensions[0],
            widthCm: comparison.dimensions[1],
            heightCm: comparison.dimensions[2],
            weightKg: comparison.weight,
          } : null,
        })) : [],

        goodsCategory: lineInventory ? [...new Set(inventoryRows.filter(r => r.comparison.quantity > 0).map(r => inventoryCatalog?.categories.find(c => c.id === r.entry.catalogCategoryId)?.custom ? r.entry.customGoodsName?.trim() || 'Hàng hóa khác' : inventoryCatalog?.categories.find(c => c.id === r.entry.catalogCategoryId)?.label || goodsCategory.trim()))].join(', ') : goodsCategory.trim(),

        goodsMaterial: lineInventory ? [...new Set(inventoryRows.filter(r => r.comparison.quantity > 0).map(r => inventoryCatalog?.categories.find(c => c.id === r.entry.catalogCategoryId)?.materials.find(m => m.id === r.entry.catalogMaterialId)?.label || r.entry.customMaterial?.trim() || 'Không áp dụng'))].join(', ') : goodsMaterial.trim(),
        actualPackagingMethod: actualPackagingMethod.trim(),
        packagingCondition: packagingCondition || null,

        evidenceReferences: uploadedEvidence,

        handedOverItems: [
          ...handedOverItems.split(",").map((value) => value.trim()).filter(Boolean),
          `Ổ khóa ${keyLockReference.trim()}`,
        ],

        notes: [
          `Kết quả đối chiếu hàng hóa: ${
            activeDiscrepancies.length === 0
              ? "Trùng khớp hoàn toàn giữa hàng hóa khai báo và thực tế kiểm kê."
              : `Có chênh lệch (${activeDiscrepancies.join("; ")}).`
          }`,
          verificationNotes.trim()
            ? `Ghi chú xác minh: ${verificationNotes.trim()}`
            : "",
          inventoryReportNote(handoverNotes, verificationNotes)
            ? `Ghi chú kiểm kê: ${inventoryReportNote(handoverNotes, verificationNotes)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        lockReference: keyLockReference.trim(),
      }, inventoryDraftRevision)

      setContractFile(null)
      setConfirmedSetupTerms(null)

      setPaymentEvidenceFile(null)

      showToast("Đã lưu hàng hóa kiểm kê. Bạn có thể đóng và mở lại hồ sơ hoặc chỉnh sửa trước khi chốt kết quả tiếp nhận.")
      setInventoryDraftRevision(savedDraft.revision)
      setInventorySavedAt(savedDraft.savedAt)
      setInventoryEditing(false)
      advanceInventoryStage(3)

      refresh()
    } catch (reason) {
      fail(reason, "Không thể lưu hàng hóa kiểm kê.")
    } finally {
      inventoryCommandLock.current = false
      setSubmitting(false)
    }
  }

  const continueInventoryResolution = async () => {
    if (!handoverTarget?.checkInId || !inventorySavedAt || inventoryEditing || submitting || inventoryCommandLock.current) return
    const blocked = inventoryInspectionBlockReason(handoverTarget)
    if (blocked) { setError(blocked); return }
    inventoryCommandLock.current = true
    setSubmitting(true); setError(null)
    try {
      const updated = await prepareInventoryResolution(handoverTarget.checkInId, inventoryDraftRevision)
      setHandoverTarget(updated)
      setInventoryReopened(false)
      advanceInventoryStage(4)
      showToast('Đã kiểm tra sức chứa. Ghi nhận phương án xử lý trực tiếp tại cơ sở.')
      refresh()
    } catch (reason) { fail(reason, 'Không thể mở bước kết quả tiếp nhận.') }
    finally { inventoryCommandLock.current = false; setSubmitting(false) }
  }

  const recordHandoverArrival = async () => {
    if (submitting || !handoverTarget?.checkInId || !needsHandoverArrival) return
    setSubmitting(true)
    setError(null)
    try {
      const review = inArrivalReview ? {
        actualArrivedAt: new Date(actualArrival + "+07:00").toISOString(),
        evidence: arrivalEvidence.trim(), disputed: disputedArrival,
      } : undefined
      setHandoverTarget(await recordCheckInArrival(handoverTarget.checkInId, review))
      if (review?.disputed) showToast("Đã gửi căn cứ cho quản lý đối soát giờ đến.")
      refresh()
    } catch (reason) {
      fail(reason, "Không thể ghi nhận khách đã đến.")
    } finally {
      setSubmitting(false)
    }
  }

  const checkIdentity = async () => {
    if (!handoverTarget?.checkInId || !bookingOwnerConfirmed || !identityDocumentNumber.trim() || submitting) return
    setError(null)
    setFieldErrors({})
    if (!identityValidation.ok) {
      setFieldErrors({ identityDocumentNumber: identityValidation.error || "Vui lòng nhập CCCD hợp lệ." })
      return
    }
    setSubmitting(true)
    try {
      setIdentityComparison(await compareCheckInIdentity(handoverTarget.checkInId, enteredIdentity, bookingOwnerConfirmed))
      await refreshHandoverTarget()
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 404
        && reason.diagnosticMessage === "The requested endpoint does not exist") {
        setError("Backend đang chạy chưa có chức năng đối chiếu CCCD. Hãy thử lại sau khi backend được cập nhật.")
      } else {
        setFieldErrors(extractStaffFieldErrors(reason))
        setError(staffErrorMessage(reason, "Không thể đối chiếu CCCD."))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resetIdentityVerificationDraft = (savedDocument = "") => {
    setIdentityDocumentNumber(savedDocument)
    setIdentityComparison(null)
    setIdentityMismatchAcknowledged(false)
    setBookingOwnerConfirmed(false)
    setAdulthoodConfirmed(false)
    setVerificationNotes("")
  }

  const submitVerifiedIdentityCorrection = async () => {
    if (!handoverTarget?.checkInId) return
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const updated = await correctCheckInIdentity(handoverTarget.checkInId, {
        identityDocumentNumber: enteredIdentity,
        note: verificationNotes.trim(),
        adulthoodConfirmed,
        bookingOwnerConfirmed,
      })
      setHandoverTarget(updated)
      resetIdentityVerificationDraft(updated.identityDocumentNumber || "")
      setEditingVerifiedIdentity(false)
      showToast("Đã lưu CCCD sau khi đối chiếu.")
      refresh()
    } catch (reason) {
      fail(reason, "Không thể sửa CCCD.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitWorkflowStep = async () => {
    if (!handoverTarget?.checkInId) return
    if (handoverStep === 1 && (!bookingOwnerConfirmed || !identityCanConfirm)) return
    if (!staffCheckInActions(handoverTarget).canOpen) {
      setError(handoverExpired(handoverTarget) ? handoverDeadlineMessage : "Hồ sơ chưa đủ điều kiện nhận kho.")
      return
    }
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      let updated: CheckInCase | null = null
      if (handoverStep === 1) {
        const normalized = normalizeIdentityDocument(identityDocumentNumber)
        const result = validateRentalIdentity(normalized)
        if (!result.ok) {
          setFieldErrors({ identityDocumentNumber: result.error || "Vui lòng nhập giấy tờ hợp lệ." })
          setError(result.error || "Vui lòng nhập giấy tờ hợp lệ.")
          setSubmitting(false)
          return
        }
        updated = await verifyCheckInIdentity(handoverTarget.checkInId, {
          identityDocumentNumber: normalized,
          bookingOwnerConfirmed,
          note: verificationNotes.trim() || undefined,
          adulthoodConfirmed,
          correctionConfirmed: identityCorrection,
        })
        setChecklist((current) => ({ ...current, identityVerified: true, reservationMatched: true }))
      } else if (handoverStep === 2) {
        if (!contractFile) return
        if (setupTermsKey && (confirmedSetupTerms !== setupTermsKey || handoverTarget.setupEarlyExitFee == null)) {
          throw new Error('Cần đối chiếu điều khoản phí trả kho trong thời gian chuẩn bị trong hợp đồng đã ký trước khi tiếp tục.')
        }
        const asset = await uploadCheckInEvidence(handoverTarget.checkInId, contractFile, 'CHECK_IN', 'hop-dong-da-ky-luc-ban-giao', handoverTarget.reservationCode)
        updated = await signCheckInContract(handoverTarget.checkInId, asset.id, handoverTarget.setupEarlyExitPolicyVersion)
        setChecklist((current) => ({ ...current, contractVerified: true }))
      } else if (handoverStep === 3) {
        const due = handoverTarget.dueAtCheckIn ?? 0
        if (due > 0) {
          if (!paymentEvidenceFile) return
          const asset = await uploadCheckInEvidence(handoverTarget.checkInId, paymentEvidenceFile, 'CHECK_IN', 'bang-chung-thu-tien-luc-ky-hop-dong', handoverTarget.reservationCode)
          await recordCheckInRemainingPayment(handoverTarget.checkInId, {
            amount: due,
            paymentMethod,
            paymentEvidenceFileId: asset.id,
            note: "Thu tiền sau khi hợp đồng đã được ký",
          })
          const pageResult = await listCheckIns({ page: 0, pageSize: 100, q: handoverTarget.reservationCode })
          updated = pageResult.data.find((item) => item.checkInId === handoverTarget.checkInId) ?? null
        } else {
          updated = await confirmCheckInPayment(handoverTarget.checkInId, "Đơn không còn khoản cần thu khi nhận kho")
        }
        setChecklist((current) => ({ ...current, paymentVerified: true }))
      } else if (handoverStep === 4) {
        if (!standardLock) {
          setLockChecked(true)
          throw new Error("Mã bộ khóa phải có đủ 3 chữ số từ 001 đến 999.")
        }
        if (/\b(pin|password|mật khẩu|mat khau)\b/i.test(keyLockReference)) {
          throw new Error("Không nhập mật khẩu hoặc mã PIN vào ô Mã bộ khóa.")
        }
        if (!emptyStorageHandoverReady) {
          throw new Error("Cần nhập mã ổ khóa, số khung, số tấm kê, ghi nhận hiện trạng, tick đủ danh mục kiểm tra bàn giao và chọn ít nhất một ảnh hoặc PDF bằng chứng kho trống.")
        }
        const lockReference = keyLockReference.trim()
        const activeCredentials = await listStaffAccessCredentials({
          facilityId: handoverTarget.facilityId,
          q: lockReference,
          status: "ACTIVE",
          pageSize: 100,
        })
        const normalizedLockReference = lockReference.replace(/\s+/g, " ").toLocaleUpperCase("vi-VN")
        const duplicateLock = activeCredentials.data.some((credential) =>
          credential.type === "LOCK"
          && credential.reservationId !== handoverTarget.reservationId
          && credential.reference.trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN") === normalizedLockReference,
        )
        if (duplicateLock) {
          throw new Error("Mã ổ khóa đang được sử dụng tại cơ sở này.")
        }
        const emptyStorageEvidence = checkInEvidenceAssetIds(evidenceReferences)
        for (const file of evidenceFiles) {
          const asset = await uploadCheckInEvidence(handoverTarget.checkInId, file, 'CHECK_IN', 'bang-chung-ban-giao-kho-luc-ban-giao', handoverTarget.reservationCode)
          emptyStorageEvidence.push(asset.id)
          if (asset.createdAt) evidenceUploadTimes.current.set(asset.id, asset.createdAt)
        }
        setEvidenceReferences(emptyStorageEvidence)
        setEvidenceFiles([])
        updated = await startCheckInSetup(handoverTarget.checkInId, {
          lockReference: keyLockReference.trim(),
          note: "Bàn giao kho trống để khách chuẩn bị hàng",
          initialUnitCondition: initialCondition.trim(),
          evidenceReferences: emptyStorageEvidence,
          rackCount: Number(handoverRackCount),
          palletCount: Number(handoverPalletCount),
        })
        setChecklist((current) => ({ ...current, accessHandedOver: true, unitWalkthrough: true, conditionRecorded: true }))
        if (updated.checkInStatus === "handover_pending_receipt") {
          setReceiptNoticeOpen(true)
        }
      } else if (handoverStep === 5) {
        if (handoverTarget.checkInStatus === "handover_pending_receipt") {
          setReceiptNoticeOpen(true)
          throw new Error("Đang chờ khách hàng xác nhận nhận kho trên cổng khách hàng.")
        }
        return
      }
      if (updated) {
        setHandoverTarget(updated)
        if (handoverStep === 1) resetIdentityVerificationDraft(updated.identityDocumentNumber || "")
        // A finished setup belongs to the inspection workflow, so honour step 6 instead of
        // clamping it back to the last handover step.
        const nextStep = handoverStepForStatus(updated.checkInStatus)
        setHandoverStep(nextStep === INSPECTION_STEP ? nextStep : Math.min(5, nextStep))
      } else {
        setHandoverStep((current) => Math.min(5, current + 1))
      }
      refresh()
    } catch (reason) {
      fail(reason, "Không thể hoàn tất bước nhận kho này.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitRejection = async () => {
    if (!rejectTarget?.checkInId || !rejectReason.trim() || !staffCheckInActions(rejectTarget).canReject) return

    setSubmitting(true)

    try {
      const uploadedEvidence = [...rejectEvidenceReferences]

      for (const file of rejectEvidenceFiles) {
        const asset = await uploadCheckInEvidence(rejectTarget.checkInId, file, 'CHECK_IN', 'bien-ban-tu-choi-nhan-kho', rejectTarget.reservationCode)

        uploadedEvidence.push(asset.id)
      }

      if (!uploadedEvidence.length) {
        setError(
          "Cần ít nhất một ảnh hoặc PDF làm bằng chứng từ chối nhận kho.",
        )

        return
      }

      await rejectCheckIn(rejectTarget.checkInId, {
        reason: rejectReason.trim(),

        disposition: rejectDisposition,

        evidenceReferences: uploadedEvidence,
        mismatchedIdentityDocument: rejectedIdentityDocument,
      })

      showToast(
        rejectDisposition === "MAINTENANCE"
          ? `Đã từ chối nhận kho và chuyển ${rejectTarget.storageUnitCode} sang bảo trì.`
          : `Đã từ chối nhận kho và trả ${rejectTarget.storageUnitCode} về trạng thái sẵn sàng.`,
      )

      if (rejectedIdentityDocument) setHandoverTarget(null)
      setRejectTarget(null)

      setRejectEvidenceFiles([])

      setRejectEvidenceReferences([])

      refresh()
    } catch (reason) {
      fail(reason, "Không thể từ chối nhận kho.")
    } finally {
      setSubmitting(false)
    }
  }

  const openEvidencePreview = (blob: Blob, fileName: string, contentType: string) => {
    setPreviewEvidence({ url: URL.createObjectURL(blob), fileName, contentType })
  }

  const previewEvidenceFile = async (assetId: string) => {
    setDownloadingEvidence(assetId)

    try {
      const result = await downloadCheckInEvidence(assetId)

      openEvidencePreview(result.blob, result.fileName || `bang-chung-nhan-kho-${assetId}`, result.contentType)
    } catch (reason) {
      fail(reason, "Không thể xem trước bằng chứng bàn giao.")
    } finally {
      setDownloadingEvidence(null)
    }
  }

  const openHandover = async (item: CheckInCase, inventory = false) => {
    if (inventory && !canAccessInventory(item)) { showToast(inventoryInspectionBlockReason(item) || 'Hồ sơ chưa đủ điều kiện kiểm kê.'); return }
    // Re-acquiring the processing lease reloads the same case. That must not throw away the
    // operator's position or the draft they are editing, or the form visibly jumps around.
    const reopeningSameCase = handoverTarget?.checkInId != null && handoverTarget.checkInId === item.checkInId
    if (reopeningSameCase) {
      setHandoverTarget(item)
      setHandoverStep(current => resolveResumeStep({
        requestedInspection: inventory,
        currentlyInInspection: inventoryMode,
        currentStep: current,
        status: item.checkInStatus,
      }))
      return
    }
    let draft: Awaited<ReturnType<typeof getInventoryDraft>> | null = null
    const published = Boolean(item.inventoryResolutionStatus && item.inventoryResolutionStatus !== 'NOT_STARTED') || item.checkInStatus === 'completed'
    if (inventory && !published && item.checkInId) {
      try { draft = await getInventoryDraft(item.checkInId) }
      catch (reason) { fail(reason, 'Không thể tải bản kiểm kê đã lưu.'); return }
    }
    const savedReport = draft?.request ?? item.handover
    setInventoryDraftRevision(draft?.revision ?? 0)
    setInventorySavedAt(draft?.savedAt ?? null)
    setInventoryEditing(!draft?.request)
    setInventoryReopened(false)
    setError(null)
    setFieldErrors({})
    setHandoverTarget(item)
    setReceiptNoticeOpen(item.checkInStatus === "handover_pending_receipt")

    setHandoverStep(inventory ? 6 : Math.min(5, stepForCheckIn(item)))
    setConfirmedInventoryReview(null)
    const initialInventoryStage: InventoryStage = published ? 4 : draft?.request ? 3 : item.inventoryVisit?.identityVerifiedAt ? 2 : 1
    setInventoryStage(initialInventoryStage)
    setHighestInventoryStage(initialInventoryStage)
    setHandoverNotes(inventoryReportNote(savedReport?.notes, savedReport?.identityVerificationNote))

    const restoredChecklist = savedReport?.checklist ?? emptyChecklist()
    setChecklist({
      ...restoredChecklist,
      identityVerified: Boolean(item.identityVerifiedAt) || restoredChecklist.identityVerified,
      reservationMatched: Boolean(item.identityVerifiedAt) || restoredChecklist.reservationMatched,
      contractVerified: Boolean(item.contractSignedAt) || restoredChecklist.contractVerified,
      paymentVerified: Boolean(item.paymentCollectedAt) || restoredChecklist.paymentVerified,
      accessHandedOver: Boolean(item.checkedInAt) || restoredChecklist.accessHandedOver,
      unitWalkthrough: Boolean(item.checkedInAt) || restoredChecklist.unitWalkthrough,
      conditionRecorded: Boolean(item.checkedInAt) || restoredChecklist.conditionRecorded,
    })

    setDisputedArrival(false)
    setActualArrival("")
    setArrivalEvidence("")
    setIdentityDocumentNumber(inventory || item.identityVerifiedAt ? item.identityDocumentNumber || "" : "")
    setIdentityComparison(null)
    setIdentityMismatchAcknowledged(false)
    setEditingVerifiedIdentity(false)

    setBookingOwnerConfirmed(false)
    setVerificationNotes("")
    setAdulthoodConfirmed(false)

    setEvidenceFiles([])

    setContractFile(null)
    setConfirmedSetupTerms(null)

    setPaymentEvidenceFile(null)

    const emptyStorageHandover = parseEmptyStorageHandover(item.readinessNote)
    setInitialCondition(emptyStorageHandover.condition || "Gian kho sạch, khóa và đèn hoạt động bình thường")
    setEvidenceReferences(Array.from(new Set([
      ...emptyStorageHandover.evidenceReferences,
      ...(savedReport?.evidenceReferences ?? []),
    ])))

    setLockChecked(false)
    setKeyLockReference(item.lockReference || "")
    setHandoverRackCount(
      item.handoverRecord?.rackCount != null
        ? String(item.handoverRecord.rackCount)
        : item.equipment?.rackCount != null
          ? String(item.equipment.rackCount)
          : ""
    )
    setHandoverPalletCount(
      item.handoverRecord?.palletCount != null
        ? String(item.handoverRecord.palletCount)
        : item.equipment?.palletCount != null
          ? String(item.equipment.palletCount)
          : "100"
    )

    setPaymentMethod("CASH")

    setHandedOverItems("Biên nhận bàn giao")

    const declaredCategories = declaredGoodsCategoryValues(item.declaredGoodsLines)
    const declaredMaterials = declaredGoodsMaterialValues(item.declaredGoodsLines)
    setGoodsCategory(savedReport?.goodsCategory?.trim() || (declaredCategories.length === 1 ? declaredCategories[0] : ""))
    setGoodsMaterial(savedReport?.goodsMaterial?.trim() || (item.checkInStatus === "completed" ? "" : declaredMaterials.length === 1 ? declaredMaterials[0] : ""))
    setActualPackagingMethod(savedReport?.actualPackagingMethod || '')
    setPackagingCondition(savedReport?.packagingCondition || '')

    setLengthCm(formatInputNumber(item.declaredGoodsLengthCm))

    setWidthCm(formatInputNumber(item.declaredGoodsWidthCm))

    setHeightCm(formatInputNumber(item.declaredGoodsHeightCm))

    setWeightKg(formatInputNumber(item.declaredGoodsWeightKg))

    setVolumeM3(formatInputNumber(item.declaredGoodsVolumeM3))

    const savedLines = savedReport?.inventoryLines ?? []
    setInventoryDraft(Object.fromEntries(savedLines.map(line => [line.goodsItemId, {
      quantity: String(line.actualQuantity), condition: line.condition, note: line.condition === "DAMAGED" ? line.note?.match(/Mô tả hư hỏng: ([\s\S]*)/)?.[1] ?? line.note ?? "" : "",
      catalogCategoryId: line.actualGoods?.catalogCategoryId || '', catalogMaterialId: line.actualGoods?.catalogMaterialId || '',
      customGoodsName: line.actualGoods?.customGoodsName || '', customMaterial: line.actualGoods?.customMaterial || '', description: line.actualGoods?.description || '',
      fragile: line.actualGoods?.fragile, stackable: line.actualGoods?.stackable,
      allowHorizontalPlacement: line.actualGoods?.allowHorizontalPlacement, maxStackLayers: line.actualGoods?.maxStackLayers || 1,
      lengthCm: formatInputNumber(line.measurements?.lengthCm),
      widthCm: formatInputNumber(line.measurements?.widthCm),
      heightCm: formatInputNumber(line.measurements?.heightCm),
      weightKg: formatInputNumber(line.measurements?.weightKg),
      checked: true,
    }])))
    setPackageCount(String(savedReport?.packageCount ?? (item.declaredGoodsLines?.length ? 0 : item.declaredPackageCount ?? 1)))

    setMeasurementChecks(emptyMeasurementChecks())

    setVarianceAccepted(false)

    setVarianceReason(savedReport?.varianceReason || "")
  }

  const beginHandover = async (item: CheckInCase) => {
    if (!staffCheckInActions(item).canOpen) {
      setError(handoverExpired(item) ? handoverDeadlineMessage : "Hồ sơ chưa đủ điều kiện nhận kho.")
      return
    }
    if (item.checkInId) {
      openHandover(item)
      return
    }
    const appointmentAt = item.appointmentAt || item.scheduledAt
    if (!appointmentAt) {
      fail(
        new Error("Khách hàng chưa đặt thời gian hẹn nhận kho."),
        "Không thể bắt đầu bàn giao.",
      )
      return
    }
    setSubmitting(true)
    try {
      const scheduled = await scheduleCheckIn(item.reservationId, {
        // Backend pins this to reservation.appointmentAt. The value here is
        // only used for legacy reservations that predate the customer field.
        scheduledAt: appointmentAt,
        contractVerified: false,
        paymentVerified: false,
        note: "Lịch hẹn do khách hàng đặt. Xác nhận tại quầy khi khách đến.",
      })
      openHandover(scheduled)
    } catch (reason) {
      fail(reason, "Không thể bắt đầu bàn giao.")
    } finally {
      setSubmitting(false)
    }
  }

  const openRejection = (item: CheckInCase, mismatchedIdentityDocument?: string) => {
    setError(null)
    setRejectTarget(item)
    setRejectedIdentityDocument(mismatchedIdentityDocument)

    setRejectReason(mismatchedIdentityDocument ? "CCCD trên giấy tờ gốc vượt giới hạn điều chỉnh" : "")

    setRejectDisposition("AVAILABLE")

    setRejectEvidenceFiles([])

    setRejectEvidenceReferences([])
  }

  const renderRow = (item: CheckInCase, group: CheckInGroup) => {
    const recoveryTransferred = isCheckInRecoveryTransferred(item)
    const actions = staffCheckInActions(item, now)
    const receiptState = receiptConfirmationState(item, now)
    const receiptRelease = receiptReleaseState(item, now)
    const showsOngoingActions = !recoveryTransferred && group === "ONGOING" && item.checkInStatus !== "completed"
    const showsDetailAction = recoveryTransferred || ["handover_pending_receipt", "setup_in_progress", "setup_completed"].includes(item.checkInStatus || "")
    const actionButtonCount = 1
      + (showsOngoingActions ? 1 : 0)
      + (showsOngoingActions && actions.canReject ? 1 : 0)
      + (showsDetailAction ? 1 : 0)
      + (!recoveryTransferred && item.checkInStatus === "completed" ? 3 : 0)
    const actionLayoutClass = actionButtonCount === 1
      ? "flex max-w-md flex-wrap items-center justify-center"
      : "grid max-w-[25rem] grid-cols-2"
    const actionButtonClass = `${checkInActionButtonBaseClass} ${actionButtonCount === 1 ? "w-48" : "w-full"}`
    return (
    <Tr key={item.reservationId} title={item.customerName ? `Khách hàng: ${item.customerName}` : undefined}>
      <Td>
        <b className="font-mono [overflow-wrap:anywhere]">{item.reservationCode}</b>
        <p className="mt-1 text-xs text-stone-500">
          {item.facilityName}
        </p>
      </Td>
      <Td>
        <b className="font-mono">{item.storageUnitCode}</b>
        <p className="mt-1 text-xs text-stone-500">
          {staffStorageUnitStatusLabel(item.storageUnitStatus)}
        </p>
      </Td>
      <Td>
        <span>{recoveryTransferred
          ? formatStaffDateTime(item.inventoryVisit?.appointmentAt || item.appointmentAt || item.scheduledAt)
          : item.checkInStatus === "setup_completed"
          ? item.inventoryVisit?.appointmentAt ? formatStaffDateTime(item.inventoryVisit.appointmentAt) : "Chưa đặt lịch kiểm kê"
          : formatStaffDateTime(item.appointmentAt || item.scheduledAt)}</span>
        {!recoveryTransferred && item.checkInStatus === "setup_completed" && item.inventoryVisit?.arrivedAt && (
          <p className="mt-1 text-xs text-stone-600">{item.inventoryVisit.identityVerifiedAt ? "Đã xác minh" : "Đã đến, chờ xác minh"}</p>
        )}
        {!recoveryTransferred && item.inventoryVisit?.access?.completionDeadlineAt && <p className="mt-1 text-xs text-stone-600">Hạn hoàn tất kiểm kê: {formatStaffDateTime(item.inventoryVisit.access.completionDeadlineAt)}</p>}
        {group === "ONGOING" && stepForCheckIn(item) <= 4 && (item.appointmentAt || item.scheduledAt) && handoverExpired(item, now) && (
          <p className="mt-1 text-[11px] font-medium text-red-700">Đã hết hạn nhận kho</p>
        )}
        {item.checkInStatus === "handover_pending_receipt" && item.receiptConfirmationDueAt && (
          <p className={`mt-1 text-[11px] font-semibold ${receiptState.expired || receiptState.urgent ? "text-red-700" : "text-amber-700"}`}>
            {receiptState.text} · Hạn {formatStaffDateTime(item.receiptConfirmationDueAt)}
          </p>
        )}
        {receiptRelease.text && (
          <p className={receiptRelease.eligible ? "mt-1 text-[11px] font-semibold text-red-700" : "mt-1 text-[11px] font-semibold text-amber-700"}>
            {receiptRelease.text}
          </p>
        )}
      </Td>
      <Td className="whitespace-nowrap">
        <Badge
          variant={
            recoveryTransferred ? "info" : item.inventoryDecision?.outcome === 'REFUSED' || receiptRelease.eligible || receiptState.expired
              ? "error"
              : item.checkInStatus === "completed"
              ? "success"
              : item.checkInStatus === "no_show" ||
                  item.checkInStatus === "rejected"
                ? "error"
                : item.checkInStatus === "scheduled"
                  ? "info"
                  : "warning"
          }
        >
          {recoveryTransferred ? staffCheckInStatusLabel(item.checkInStatus, item.reservationStatus, true)
            : item.inventoryDecision ? intakeDecisionLabels[item.inventoryDecision.outcome] : receiptRelease.eligible
            ? "Đủ điều kiện để quản lý cơ sở giải phóng kho"
            : receiptState.expired
            ? "Đã quá hạn xác nhận nhận kho"
            : staffCheckInStatusLabel(item.checkInStatus, item.reservationStatus)}
        </Badge>
      </Td>
      <Td className="whitespace-normal text-center">
        <div className={`mx-auto w-full gap-1.5 ${actionLayoutClass}`}>
          <Button size="sm" variant="outline" className={`${actionButtonClass} ${inventoryActionClass}`} disabled={submitting || !canAccessInventory(item, now)} title={inventoryInspectionBlockReason(item, now) || 'Xem tiến trình kiểm kê'} onClick={() => openHandover(item, true)}>{!canAccessInventory(item, now) && inventoryInspectionBlockReason(item, now) ? 'Kiểm kê đã khóa' : 'Xem tiến trình kiểm kê'}</Button>
          {!recoveryTransferred && inventoryInspectionBlockReason(item, now) && item.checkInStatus !== 'completed' && <p className="text-xs text-red-700">{inventoryInspectionBlockReason(item, now)}</p>}
          {showsOngoingActions && (
            <>
              <Button
                className={`${actionButtonClass} ${handoverActionClass}`}
                size="sm"
                disabled={submitting || !actions.canOpen}
                onClick={() => beginHandover(item)}
              >
                {item.checkInStatus === "setup_in_progress" || stepForCheckIn(item) === 6 ? "Xem tiến trình bàn giao" : actions.label}
              </Button>
              {actions.canReject && <Button
                className={`${actionButtonClass} ${dangerActionClass}`}
                size="sm"
                variant="danger"
                disabled={submitting}
                onClick={() => openRejection(item)}
              >
                Từ chối nhận kho
              </Button>}
            </>
          )}
          {showsDetailAction && (
            <Button
              className={`${actionButtonClass} ${documentActionClass}`}
              size="sm"
              variant="outline"
              onClick={() => setDetailTarget(item)}
            >
              Xem biên bản
            </Button>
          )}
          {!recoveryTransferred && item.checkInStatus === "completed" && (
            <>
              <Button
                className={`${actionButtonClass} ${handoverActionClass}`}
                size="sm"
                variant="outline"
                onClick={() => openHandover(item)}
              >
                Xem tiến trình bàn giao
              </Button>
              <Button
                className={`${actionButtonClass} ${documentActionClass}`}
                size="sm"
                variant="outline"
                onClick={() => setDetailTarget(item)}
              >
                Xem biên bản
              </Button>
              <Button
                className={`${actionButtonClass} ${dangerActionClass}`}
                size="sm"
                variant="danger"
                onClick={() => setDeleteTarget(item)}
              >
                Xóa đơn
              </Button>
            </>
          )}
          {group === "PROCESSED" && !recoveryTransferred && item.checkInStatus !== "completed" && (
            <span className="max-w-60 whitespace-normal text-xs text-stone-600">{item.rejectionReason || staffCheckInStatusLabel(item.checkInStatus, item.reservationStatus)}</span>
          )}
        </div>
      </Td>
    </Tr>
    )
  }

  const workflowForm = handoverTarget && (
          <ProcessingLeaseBoundary target="CHECK_IN" id={handoverTarget.checkInId!} enabled={!!handoverTarget.checkInId && !awaitngCustomerTransition && handoverTarget.checkInStatus !== 'completed'} onAcquired={async () => {
            const response = await listCheckIns({ page: 0, pageSize: 100, q: handoverTarget.reservationCode })
            const latest = response.data.find(item => item.checkInId === handoverTarget.checkInId)
            if (!latest) throw new Error('Không còn tìm thấy hồ sơ bàn giao. Đóng cửa sổ và tải lại danh sách.')
            // Refresh the data only. Opening the form again would reset the workflow position and
            // re-trigger the acquire effect, which made the open case jump.
            setHandoverTarget(latest)
          }}><div className="space-y-5">
            <dl className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Mã đơn giữ kho', handoverTarget.reservationCode], ['Mã gian kho bàn giao', handoverTarget.storageUnitCode],
                ['Khách hàng nhận kho', handoverTarget.customerName], ['Tên cơ sở', handoverTarget.facilityName || 'StorageHub'],
              ].map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-words font-semibold text-stone-900">{value || 'Chưa cập nhật'}</dd></div>)}
            </dl>
            {handoverTarget.attendance?.completionDeadline && stepForCheckIn(handoverTarget) <= 4 &&
              <p>Hạn hoàn tất bàn giao: {formatStaffDateTime(handoverTarget.attendance.completionDeadline)}</p>}
            {handoverTarget.attendance?.arrivalUnderReview && <p>Giờ đến đang chờ quản lý đối soát.</p>}
            {inventoryMode && inventoryBlockedReason && <p role="status" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{inventoryBlockedReason} Chỉ xem lại dữ liệu đã lưu.</p>}
            {handoverDeadlinePassed && !handoverTarget.attendance?.arrivalUnderReview && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">{handoverDeadlineMessage}</p>}
            {error && (inventoryMode || handoverStep !== 1)
              && error !== "Một số trường thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu đỏ bên dưới." && (
              <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3 shadow-sm">
                <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <b className="font-semibold text-red-900">Không thể thực hiện thao tác:</b>
                  <p className="mt-0.5 whitespace-pre-wrap">{error}</p>
                  {Object.keys(fieldErrors).length > 0 && (
                    <div className="mt-2.5 rounded-lg border border-red-200 bg-white/70 p-2.5">
                      <p className="text-xs font-semibold text-red-900 mb-1">Chi tiết các trường cần kiểm tra lại:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs text-red-700">
                        {Object.entries(fieldErrors).map(([key, msg]) => (
                          <li key={key}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setError(null); setFieldErrors({}) }}
                  className="rounded px-1.5 py-0.5 text-xs font-bold text-red-500 hover:bg-red-100 hover:text-red-700"
                  aria-label="Đóng lỗi"
                >
                  ✕
                </button>
              </div>
            )}
            {!inventoryMode && <nav className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Các bước bàn giao">
              {workflowStepLabels.slice(0, 5).map((label, index) => <Button key={label} variant={handoverStep === index + 1 ? "primary" : "outline"} disabled={submitting || editingVerifiedIdentity || index + 1 > Math.min(5, workflowCurrentStep)} onClick={() => { setError(null); setHandoverStep(index + 1) }}>{index + 1}. {label}</Button>)}
            </nav>}
            {inventoryMode && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Tiến độ kiểm kê">
              {([1, 2, 3, 4] as InventoryStage[]).map(step => {
                const current = inventoryStage === step
                return (
                  <div
                    key={step}
                    aria-current={current ? "step" : undefined}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition select-none cursor-default ${
                      current
                        ? "border-amber-500 bg-amber-50 font-semibold text-amber-950"
                        : inventoryStage >= step
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 bg-stone-50 text-stone-500 opacity-70"
                    }`}
                  >
                    <span className="mr-1 font-bold">{step}.</span>{INVENTORY_STAGE_LABELS[step]}
                  </div>
                )
              })}
            </div>}

            {handoverStep === 1 && needsHandoverArrival && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
                <p>Ghi nhận khi khách có mặt tại cơ sở để lưu thời điểm tiếp nhận.</p>
                {inArrivalReview && arrivalDeadline && <div className="space-y-2">
                  <p>Đối soát lượt đến đúng hạn đến {formatStaffDateTime(new Date(Date.parse(arrivalDeadline) + ARRIVAL_REVIEW_MS).toISOString())}.</p>
                  <Input type="datetime-local" step={1} label="Giờ khách thực tế đến (giờ Việt Nam)" value={actualArrival} onChange={e => setActualArrival(e.target.value)} />
                  <label><input type="checkbox" checked={disputedArrival} onChange={e => setDisputedArrival(e.target.checked)} /> Giờ đến có tranh chấp, chuyển quản lý đối soát</label>
                  <Input label="Căn cứ đối soát (ví dụ số dòng sổ quầy)" maxLength={500} value={arrivalEvidence} onChange={e => setArrivalEvidence(e.target.value)} />
                </div>}
                <Button disabled={submitting || handoverDeadlinePassed || (inArrivalReview && (!actualArrival || !arrivalEvidence.trim())) || !staffCheckInActions(handoverTarget, now).canOpen}
                  onClick={() => void recordHandoverArrival()}>{submitting ? "Đang ghi nhận…" : "Ghi nhận khách đã đến"}</Button>
              </div>
            )}
            {handoverStep === 1 && !needsHandoverArrival && (
              <div className="space-y-4">
                {handoverTarget.attendance?.arrivedAt && <p className="text-sm font-medium text-emerald-800">
                  Đã tiếp nhận khách lúc {formatStaffDateTime(handoverTarget.attendance.arrivedAt)}
                </p>}
                <div className="grid gap-3 rounded-lg border border-stone-200 p-4 text-sm md:grid-cols-3">
                  <div><span className="text-stone-500">Khách hàng</span><p className="font-semibold">{handoverTarget.customerName}</p></div>
                  <div>
                    <span className="text-stone-500">CCCD đã khai báo</span>
                    <p className="font-semibold">{isReviewingCompletedStep
                      ? handoverTarget.declaredIdentityMasked || "Chưa có dữ liệu"
                      : declaredIdentityDocument ? maskCccd(declaredIdentityDocument) : "Chưa có dữ liệu"}</p>
                  </div>
                  {isReviewingCompletedStep && !editingVerifiedIdentity ? (
                    <div>
                      <span className="text-stone-500">{handoverTarget.identityCorrected ? "CCCD đã sửa" : "CCCD đã xác minh"}</span>
                      <p className="font-semibold">{declaredIdentityDocument ? maskCccd(declaredIdentityDocument) : "Chưa có dữ liệu"}</p>
                    </div>
                  ) : <Input
                    label="CCCD trên giấy tờ gốc *"
                    error={fieldErrors.identityDocumentNumber}
                    value={identityDocumentNumber}
                    disabled={submitting}
                    onChange={(event) => {
                      setAdulthoodConfirmed(false)
                      clearFieldError("identityDocumentNumber")
                      setBookingOwnerConfirmed(false)
                      setIdentityComparison(null)
                      setIdentityMismatchAcknowledged(false)
                      setIdentityDocumentNumber(event.target.value)
                    }}
                  />}
                </div>
                {isReviewingCompletedStep && !editingVerifiedIdentity && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                    <div>
                      <p className="font-semibold">Đã xác minh khách</p>
                      {handoverTarget.identityVerifiedAt && <p>{formatStaffDateTime(handoverTarget.identityVerifiedAt)}</p>}
                    </div>
                    {handoverTarget.identityCorrected ? (
                      <span>Đã sử dụng lượt sửa CCCD.</span>
                    ) : handoverTarget.identityVerifiedAt && <Button variant="outline" disabled={submitting} onClick={() => {
                      resetIdentityVerificationDraft()
                      setError(null)
                      setFieldErrors({})
                      setEditingVerifiedIdentity(true)
                    }}>Sửa CCCD</Button>}
                  </div>
                )}
                {(!isReviewingCompletedStep || editingVerifiedIdentity && !reviewedCorrectionTooLarge) && (
                  <label className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
                    <input type="checkbox" checked={bookingOwnerConfirmed} disabled={submitting}
                      onChange={event => setBookingOwnerConfirmed(event.target.checked)} />
                    Tôi đã đối chiếu giấy tờ gốc và xác nhận khách là người đặt kho.
                  </label>
                )}
                {identityMismatch && (
                  <div role="status" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-semibold">CCCD trên giấy tờ gốc không khớp với thông tin đã lưu.</p>
                    {!identityMismatchAcknowledged ? (
                      <Button variant="outline" disabled={submitting} onClick={() => setIdentityMismatchAcknowledged(true)}>Sai thông tin</Button>
                    ) : identityComparison === "REJECT" ? (
                      <>
                        <p>CCCD vượt giới hạn sửa 3 chữ số. Kiểm tra lại số đã nhập trước khi từ chối.
                          {handoverTarget.attendance?.termsVersion === HANDOVER_TERMS_VERSION && " Khoản giữ chỗ sẽ không được hoàn lại."}
                        </p>
                        <Button variant="danger" disabled={submitting} onClick={() => openRejection(handoverTarget, enteredIdentity)}>Từ chối bàn giao</Button>
                      </>
                    ) : (
                      <p>Có thể sửa tối đa 3 chữ số. Đối chiếu giấy tờ gốc, xác nhận đúng người đặt kho và ghi căn cứ sửa CCCD.</p>
                    )}
                  </div>
                )}
                {(!isReviewingCompletedStep && identityCanConfirm || editingVerifiedIdentity) && identityValidation.warning && <label className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" checked={adulthoodConfirmed} disabled={submitting} onChange={event => setAdulthoodConfirmed(event.target.checked)} />Đã đối chiếu ngày sinh trên giấy tờ gốc và xác nhận khách đã đủ 18 tuổi *</label>}
                {editingVerifiedIdentity && reviewedCorrectionTooLarge && identityValidation.ok && (
                  <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">CCCD đã xác minh chỉ được sửa tối đa một chữ số.</p>
                )}
                {(!isReviewingCompletedStep && identityCanConfirm && identityNeedsNotes || editingVerifiedIdentity) && (
                  <Input label={identityCorrection || editingVerifiedIdentity ? "Căn cứ sửa CCCD" : "Căn cứ xác minh"}
                    value={verificationNotes} disabled={submitting} maxLength={1000} onChange={(event) => setVerificationNotes(event.target.value)} />
                )}
              </div>
            )}

            {handoverStep === 2 && (
              <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div><p className="font-semibold text-blue-950">Ký và lưu hợp đồng</p><p className="text-sm text-blue-800">Tệp hợp đồng được lưu vào đúng hồ sơ bàn giao.</p></div>
                {handoverTarget.contractEvidenceReference && isReviewingCompletedStep ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <p>Hợp đồng đã ký được lưu. Mã bằng chứng: <b className="font-mono">{handoverTarget.contractEvidenceReference}</b></p>
                    <Button className="mt-2" size="sm" variant="outline" disabled={downloadingEvidence === handoverTarget.contractEvidenceReference} onClick={() => void previewEvidenceFile(handoverTarget.contractEvidenceReference!)}>
                      {downloadingEvidence === handoverTarget.contractEvidenceReference ? 'Đang tải…' : 'Xem lại hợp đồng đã lưu'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-stone-700">Hợp đồng đã ký lúc nhận kho (PDF hoặc ảnh, tối đa 25MB) *<input disabled={submitting || isReviewingCompletedStep} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => {
                      const selected = event.target.files?.[0] || null
                      if (!validateUploadFile(selected, 'hợp đồng', setError)) {
                        event.target.value = ""
                        setContractFile(null)
                        return
                      }
                      setContractFile(selected)
                      setConfirmedSetupTerms(null)
                    }} /></label>
                    <FilePreviewList files={contractFile ? [contractFile] : []} onRemove={() => { setContractFile(null); setConfirmedSetupTerms(null) }} disabled={submitting || isReviewingCompletedStep} />
                    {setupTermsKey && <label className="flex items-start gap-2 text-sm text-blue-950">
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-amber-600" checked={confirmedSetupTerms === setupTermsKey} disabled={submitting || isReviewingCompletedStep || !contractFile || handoverTarget.setupEarlyExitFee == null} onChange={event => setConfirmedSetupTerms(event.target.checked ? setupTermsKey : null)} />
                      <span>
                        Tôi đã kiểm tra hợp đồng đã ký và xác nhận khoản phí khớp với điều khoản khách đồng ý khi đặt kho.
                        <span className="mt-1 block">
                          {handoverTarget.setupEarlyExitFee == null
                            ? 'Chưa xác định được mức phí trả kho trong thời gian chuẩn bị. Cần đối soát trước khi tiếp tục.'
                            : <>Nếu khách trả kho trong thời gian chuẩn bị, hệ thống giữ lại <strong>{handoverTarget.setupEarlyExitFee.toLocaleString('vi-VN')} đồng</strong> (20% tiền thuê sau ưu đãi) và hoàn 80% tiền thuê; tiền cọc đảm bảo quyết toán riêng.</>}
                        </span>
                      </span>
                    </label>}
                  </>
                )}
                {handoverTarget.contractSignedAt && <p className="text-xs text-stone-600">Đã ký lúc: <b>{formatStaffDateTime(handoverTarget.contractSignedAt)}</b></p>}
              </div>
            )}

            {handoverStep === 3 && (
              <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div><p className="font-semibold text-emerald-950">Thu tiền sau khi ký hợp đồng</p><p className="text-sm text-emerald-800">Số tiền cần thu: <b>{Number(handoverTarget.dueAtCheckIn ?? 0).toLocaleString('vi-VN')} đồng</b>.</p></div>
                {(handoverTarget.dueAtCheckIn ?? 0) > 0 && !isReviewingCompletedStep ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select label="Phương thức thanh toán" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as CheckInPaymentMethod)}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></Select>
                    <label className="block text-sm font-medium">Biên lai / bằng chứng giao dịch (tối đa 25MB) *<input className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => {
                      const selected = event.target.files?.[0] || null
                      if (!validateUploadFile(selected, 'biên lai', setError)) {
                        event.target.value = ""
                        setPaymentEvidenceFile(null)
                        return
                      }
                      setPaymentEvidenceFile(selected)
                    }} /></label>
                  </div>
                ) : <div className="space-y-2 text-sm">{isReviewingCompletedStep ? <><p>Đã ghi nhận lúc {formatStaffDateTime(handoverTarget.paymentCollectedAt)}.</p>{handoverTarget.paymentEvidenceReference && <Button size="sm" variant="outline" disabled={downloadingEvidence === handoverTarget.paymentEvidenceReference} onClick={() => void previewEvidenceFile(handoverTarget.paymentEvidenceReference!)}>{downloadingEvidence === handoverTarget.paymentEvidenceReference ? 'Đang tải…' : 'Xem lại biên lai đã lưu'}</Button>}</> : <p>Đơn không còn khoản phải thu. Xác nhận để chuyển sang bàn giao kho.</p>}</div>}
                {!isReviewingCompletedStep && <FilePreviewList files={paymentEvidenceFile ? [paymentEvidenceFile] : []} onRemove={() => setPaymentEvidenceFile(null)} disabled={submitting} />}
              </div>
            )}

            {handoverStep === 4 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-amber-950">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
                    <div>
                      <p className="text-base font-bold text-amber-950">Bàn giao gian kho trống & Kích hoạt quyền ra vào</p>
                      <p className="mt-2 text-sm font-semibold">Thiết bị bàn giao: {handoverTarget.equipment?.palletCount != null
                        ? <>{handoverTarget.equipment.rackCount} bộ kệ / {handoverTarget.equipment.frameCount} khung và {handoverTarget.equipment.palletCount} tấm kê. Đếm và xác nhận cùng khách; khi trả kho phải thu hồi đủ tấm kê.</>
                        : 'Chưa có cấu hình thiết bị trong hồ sơ; cần đối soát trước khi bàn giao.'}</p>
                      <p className="text-xs text-amber-800 mt-0.5">Tiến hành dẫn khách kiểm tra kho thực tế, bàn giao mã mở khóa và xác nhận hiện trạng ban đầu.</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-amber-200 bg-white p-3">
                      <span className="text-xs text-stone-500">Gian kho bàn giao</span>
                      <p className="text-base font-bold text-stone-900 mt-0.5">{handoverTarget.storageUnitCode || "Chưa cập nhật"}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white p-3">
                      <span className="text-xs text-stone-500">Cơ sở lưu kho</span>
                      <p className="text-base font-bold text-stone-900 mt-0.5">{handoverTarget.facilityName || "Cơ sở StorageHub"}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white p-3">
                      <span className="text-xs text-stone-500">Thời gian chuẩn bị miễn phí</span>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">{handoverTarget.freeSetupDays} ngày miễn phí</p>
                    </div>
                  </div>
                </div>


                <div className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4">
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-700">1. Thông tin khóa & Hiện trạng ban đầu</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor={lockHelpId + "-input"} className="text-sm font-medium text-stone-700">Mã bộ khóa *</label>
                        <div className="flex items-center overflow-hidden rounded-lg border border-stone-300 bg-white focus-within:ring-2 focus-within:ring-amber-500">
                          {<span aria-hidden="true" className="self-stretch border-r border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-700">LOCK-</span>}
                          <input
                            id={lockHelpId + "-input"}
                            aria-describedby={lockHelpId}
                            aria-invalid={Boolean(fieldErrors.lockReference || fieldErrors.keyLockReference || (lockChecked && !standardLock))}
                            className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                            inputMode="numeric"
                            spellCheck={false}
                            autoComplete="off"
                            placeholder="018"
                            value={keyLockReference.replace(/^LOCK-/i, "")}
                            disabled={isReviewingCompletedStep}
                            onBlur={() => setLockChecked(true)}
                            onChange={(event) => {
                              const input = event.target.value
                              const digits = input.trim().replace(/^LOCK-/i, "")
                              if (!/^[0-9]{0,3}$/.test(digits)) return
                              clearFieldError("lockReference")
                              clearFieldError("keyLockReference")
                              setLockChecked(false)
                              setKeyLockReference(digits ? "LOCK-" + digits : "")
                            }}
                          />
                        </div>
                        <p id={lockHelpId} aria-live="polite" className="text-xs text-stone-600">
                          {fieldErrors.lockReference || fieldErrors.keyLockReference || (lockChecked && !standardLock
                              ? "Cần nhập đủ 3 chữ số từ 001 đến 999."
                              : "Nhập 3 số sau LOCK- trên tem ổ khóa, ví dụ 018. Không nhập PIN.")}
                        </p>
                      </div>
                      <Input
                        label="Hiện trạng kho trống bàn giao *"
                        error={fieldErrors.initialCondition || fieldErrors.initialUnitCondition}
                        value={initialCondition}
                        disabled={isReviewingCompletedStep}
                        onChange={(event) => {
                          clearFieldError("initialCondition")
                          clearFieldError("initialUnitCondition")
                          setInitialCondition(event.target.value)
                        }}
                        placeholder="Ghi nhận trần, sàn, vách, đèn..."
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="Số khung bàn giao *"
                        type="number"
                        min={0}
                        step={1}
                        error={fieldErrors.rackCount}
                        value={handoverRackCount}
                        disabled={isReviewingCompletedStep}
                        onChange={(event) => {
                          clearFieldError("rackCount")
                          setHandoverRackCount(event.target.value)
                        }}
                        placeholder="Ví dụ: 2"
                      />
                      <Input
                        label="Số tấm kê bàn giao *"
                        type="number"
                        min={0}
                        step={1}
                        error={fieldErrors.palletCount}
                        value={handoverPalletCount}
                        disabled={isReviewingCompletedStep}
                        onChange={(event) => {
                          clearFieldError("palletCount")
                          setHandoverPalletCount(event.target.value)
                        }}
                        placeholder="Ví dụ: 6"
                      />
                      <p className="text-xs text-stone-600 sm:col-span-2">Số tấm kê được gợi ý khi chưa có cấu hình. Vui lòng kiểm đếm thực tế và điều chỉnh trước khi xác nhận bàn giao.</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 border-t border-stone-100 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-700">2. Danh mục kiểm tra bàn giao</p>
                    <div className="grid gap-2 sm:grid-cols-3 text-xs">
                      <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5 cursor-pointer hover:bg-stone-100 transition">
                        <input
                          type="checkbox"
                          className="rounded text-amber-600 focus:ring-amber-500"
                          disabled={isReviewingCompletedStep}
                          checked={checklist.unitWalkthrough}
                          onChange={(e) => setChecklist(cur => ({ ...cur, unitWalkthrough: e.target.checked }))}
                        />
                        <span>Đã dẫn khách kiểm tra gian kho trực tiếp *</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5 cursor-pointer hover:bg-stone-100 transition">
                        <input
                          type="checkbox"
                          className="rounded text-amber-600 focus:ring-amber-500"
                          disabled={isReviewingCompletedStep}
                          checked={checklist.conditionRecorded}
                          onChange={(e) => setChecklist(cur => ({ ...cur, conditionRecorded: e.target.checked }))}
                        />
                        <span>Trần, sàn, vách nguyên vẹn & sạch sẽ *</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5 cursor-pointer hover:bg-stone-100 transition">
                        <input
                          type="checkbox"
                          className="rounded text-amber-600 focus:ring-amber-500"
                          disabled={isReviewingCompletedStep}
                          checked={checklist.accessHandedOver}
                          onChange={(e) => setChecklist(cur => ({ ...cur, accessHandedOver: e.target.checked }))}
                        />
                        <span>Đã bàn giao mã khóa & hướng dẫn ra vào *</span>
                      </label>
                    </div>
                  </div>
                </div>

                {(!isReviewingCompletedStep || handoverEvidenceIds.length > 0) && <section aria-label="Bằng chứng xác nhận" className="space-y-4 rounded-[18px] border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-stone-900">Bằng chứng xác nhận</h3>
                    <span className="text-sm text-stone-600">{handoverEvidenceIds.length + (isReviewingCompletedStep ? 0 : evidenceFiles.length)} tệp đính kèm</span>
                  </div>
                  {!isReviewingCompletedStep && (
                    <>
                      <label className="block text-sm font-semibold text-stone-800">
                        Bằng chứng bàn giao kho lúc bàn giao (ảnh hoặc PDF) *
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                          disabled={submitting}
                          onChange={(event) => {
                            const selected = Array.from(event.target.files ?? [])
                            event.target.value = ""
                            if (selected.some(file => !validateUploadFile(file, "bàn giao", setError))) {
                              return
                            }
                            setEvidenceFiles(selected)
                          }}
                        />
                      </label>
                      <p className="text-xs text-stone-600">Chấp nhận ảnh JPG, PNG, WebP hoặc tệp PDF, tối đa 25 MB mỗi tệp.</p>
                      {!hasEmptyStorageEvidence && <p className="text-xs font-medium text-amber-800">Chọn tệp bằng chứng để có thể xác nhận bàn giao.</p>}
                      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    </>
                  )}
                  <ul className="space-y-2 empty:hidden">
                    {handoverEvidenceIds.map((assetId, index) => <HandoverEvidenceRow key={assetId}
                      source={assetId} index={index} uploadedAt={evidenceUploadTimes.current.get(assetId)}
                      handedOverAt={handoverTarget.handoverRecord?.handedOverAt ?? handoverTarget.checkedInAt}
                      busy={submitting} onPreview={openEvidencePreview}
                      onRemove={isReviewingCompletedStep ? undefined : () => setEvidenceReferences(refs => refs.filter(id => id !== assetId))} />)}
                    {!isReviewingCompletedStep && evidenceFiles.map((file, index) => <HandoverEvidenceRow
                      key={`${file.name}:${file.lastModified}:${file.size}:${index}`} source={file} index={handoverEvidenceIds.length + index}
                      busy={submitting} onPreview={openEvidencePreview}
                      onRemove={() => setEvidenceFiles(files => files.filter((_, current) => current !== index))} />)}
                  </ul>
                </section>}

                {handoverTarget.lockReference && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <div className="flex items-center justify-between">
                      <b>Mã ổ khóa đã bàn giao cho khách hàng</b>
                      <span className="font-mono font-bold bg-white px-2.5 py-1 rounded border border-emerald-300 text-emerald-950">
                        {handoverTarget.lockReference}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-800">
                      Bàn giao lúc: {formatStaffDateTime(handoverTarget.checkedInAt)}. Thời gian chuẩn bị chỉ bắt đầu sau khi khách xác nhận đã nhận kho.
                    </p>
                  </div>
                )}

              </div>
            )}

            {handoverStep === 5 && (
              <div className="space-y-4">
                {handoverTarget.checkInStatus === "handover_pending_receipt" ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
                      <p className="font-bold text-base">Đang chờ khách hàng xác nhận nhận kho</p>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${receiptConfirmationState(handoverTarget, now).expired ? "border-red-300 bg-red-100 text-red-900" : "border-amber-300 bg-white text-amber-900"}`}>
                        {receiptConfirmationState(handoverTarget, now).expired ? "Đã quá hạn" : "Chờ khách xác nhận"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm">Vui lòng chờ khách hàng nhấn <b>“Xác nhận đã nhận kho”</b> trên cổng khách hàng để hoàn tất bàn giao kho. Thời gian chuẩn bị chưa bắt đầu ở bước này.</p>
                    {handoverTarget.checkedInAt && <p className="mt-2 text-xs">Bàn giao lúc: <b>{formatStaffDateTime(handoverTarget.checkedInAt)}</b></p>}
                    {handoverTarget.receiptConfirmationDueAt && <p className={`mt-1 text-xs font-bold ${receiptConfirmationState(handoverTarget, now).expired || receiptConfirmationState(handoverTarget, now).urgent ? "text-red-700" : "text-amber-700"}`}>
                      {receiptConfirmationState(handoverTarget, now).text} · Hạn xác nhận: {formatStaffDateTime(handoverTarget.receiptConfirmationDueAt)}
                    </p>}
                  </div>
                ) : (
                  <>
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-3">
                      <div>
                        <p className="font-bold text-base">Hoàn tất bàn giao kho thành công</p>
                        <p className="text-xs text-emerald-800 mt-0.5">Khách hàng đã bấm <b>“Xác nhận đã nhận kho”</b>. Quá trình bàn giao kho đã hoàn tất.</p>
                      </div>
                      <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800">
                        Đã nhận kho
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                      <span className="text-stone-500">Thời điểm bàn giao:</span>
                      <p className="font-bold text-stone-900 mt-0.5">{handoverTarget.checkedInAt ? formatStaffDateTime(handoverTarget.checkedInAt) : "Chưa ghi nhận"}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                      <span className="text-stone-500">Khách xác nhận nhận kho lúc:</span>
                      <p className="font-bold text-stone-900 mt-0.5">{formatStaffDateTime(handoverTarget.customerReceiptConfirmedAt || handoverTarget.setupStartedAt)}</p>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <span className="text-stone-500">Bắt đầu chuẩn bị:</span>
                      <p className="font-bold text-stone-900 mt-0.5">{formatStaffDateTime(handoverTarget.setupStartedAt)}</p>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <span className="text-stone-500">Thời gian chuẩn bị miễn phí:</span>
                      <p className="font-bold text-emerald-700 mt-0.5">{handoverTarget.freeSetupDays} ngày</p>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <span className="text-stone-500">Tính cước kỳ thuê từ:</span>
                      <p className="font-bold text-stone-900 mt-0.5">{handoverTarget.paidRentalStartsOn ? formatStaffDate(handoverTarget.paidRentalStartsOn) : `Bàn giao + ${handoverTarget.freeSetupDays} ngày`}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700 space-y-2">
                    <p className="font-bold text-stone-900">Quy trình tiếp theo</p>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Khách báo đã chuẩn bị xong và tự chọn lịch. Khi khách đến, Nhân viên ghi nhận giờ đến và xác minh đúng người đặt kho trước khi kiểm kê.
                    </p>
                  </div>
                  </>
                )}
              </div>
            )}

            {inventoryMode && inventoryStage === 1 && (
              <div className="space-y-4">
                {handoverTarget.checkInStatus === "setup_in_progress" ? (
                  <>
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/60 pb-3">
                        <div>
                          <p className="font-bold text-base text-violet-950">Khách hàng đang trong thời gian chuẩn bị</p>
                          <p className="text-xs text-violet-800 mt-0.5">Khách hàng đang chủ động đưa hàng hóa vào gian kho và sắp xếp kiện hàng.</p>
                        </div>
                        <span className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-bold text-violet-900">
                          Đang chuẩn bị
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                        <div className="rounded-lg border border-violet-200 bg-white p-3">
                          <span className="text-stone-500">Bắt đầu chuẩn bị:</span>
                          <p className="font-bold text-stone-900 mt-0.5">{formatStaffDateTime(handoverTarget.setupStartedAt)}</p>
                        </div>
                        <div className="rounded-lg border border-violet-200 bg-white p-3">
                          <span className="text-stone-500">Thời gian chuẩn bị miễn phí:</span>
                          <p className="font-bold text-emerald-700 mt-0.5">{handoverTarget.freeSetupDays} ngày</p>
                        </div>
                        <div className="rounded-lg border border-violet-200 bg-white p-3">
                          <span className="text-stone-500">Tính cước kỳ thuê từ:</span>
                          <p className="font-bold text-stone-900 mt-0.5">{handoverTarget.paidRentalStartsOn ? formatStaffDate(handoverTarget.paidRentalStartsOn) : `Bàn giao + ${handoverTarget.freeSetupDays} ngày`}</p>
                        </div>
                      </div>
                    </div>
                    <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Khách đã xác nhận nhận kho. Đang chờ khách đưa hàng vào, báo chuẩn bị xong và đặt lịch trước khi kiểm kê.</p>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 pb-3">
                        <div>
                          <p className="font-bold text-base text-emerald-950">Khách hàng đã chuẩn bị xong</p>
                          <p className="text-xs text-emerald-800 mt-0.5">Khách đã hoàn tất sắp xếp hàng hóa vào kho và sẵn sàng cho bước kiểm kê.</p>
                        </div>
                        <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800">
                          Đã chuẩn bị xong
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                        <div className="rounded-lg border border-emerald-200 bg-white p-3">
                          <span className="text-stone-500">Bắt đầu chuẩn bị:</span>
                          <p className="font-bold text-stone-900 mt-0.5">{formatStaffDateTime(handoverTarget.setupStartedAt)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-white p-3">
                          <span className="text-stone-500">Thời gian chuẩn bị miễn phí:</span>
                          <p className="font-bold text-emerald-700 mt-0.5">{handoverTarget.freeSetupDays} ngày</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-white p-3">
                          <span className="text-stone-500">Tính cước kỳ thuê từ:</span>
                          <p className="font-bold text-stone-900 mt-0.5">{handoverTarget.paidRentalStartsOn ? formatStaffDate(handoverTarget.paidRentalStartsOn) : `Bàn giao + ${handoverTarget.freeSetupDays} ngày`}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white p-4 text-xs">
                      <span className="text-stone-500">Ngày hẹn kiểm kê:</span>
                      <p className="mt-1 text-sm font-bold text-stone-900">{handoverTarget.inventoryVisit?.appointmentAt ? formatStaffDateTime(handoverTarget.inventoryVisit.appointmentAt) : "Chưa đặt lịch"}</p>
                    </div>
                  </>
                )}
              </div>
            )}
            {inventoryMode && handoverTarget.checkInStatus !== 'setup_in_progress' && inventoryStage === 1 && <StaffInventoryVisitPanel
              key={handoverTarget.checkInId ?? handoverTarget.reservationId}
              item={handoverTarget} now={now} busy={submitting || Boolean(inventoryBlockedReason)} onBusyChange={setSubmitting}
              onSaved={updated => {
                setHandoverTarget(updated)
                if (updated.inventoryVisit?.identityVerifiedAt) {
                  setIdentityDocumentNumber(updated.identityDocumentNumber || "")
                  setChecklist(value => ({ ...value, identityVerified: true, reservationMatched: true }))
                }
                refresh()
              }}
              onPreview={photoId => void previewEvidenceFile(photoId)}
            />}
            {inventoryMode && handoverTarget.reservationId && inventoryStage === 1 && (
              <IntakeWorkflowPanel
                reservationId={handoverTarget.reservationId}
                role="STAFF"
                mode="staff-visit"
                checkInId={handoverTarget.checkInId}
                statusSignal={handoverTarget.checkInStatus}
                onUpdated={refresh}
              />
            )}

            {inventoryMode && handoverTarget.inventoryVisit?.identityVerifiedAt && (
              <div hidden={inventoryStage !== 2}>
              <div className="space-y-4">
                {!lineInventory && <div className={`rounded-xl border p-4 text-sm transition ${
                  activeDiscrepancies.length === 0
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-amber-300 bg-amber-50 text-amber-950"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      activeDiscrepancies.length === 0 ? "bg-emerald-600" : "bg-amber-600"
                    }`}>
                      {activeDiscrepancies.length === 0 ? "✓" : "!"}
                    </span>
                    <b className={`font-semibold ${activeDiscrepancies.length === 0 ? "text-emerald-900" : "text-amber-900"}`}>
                      {activeDiscrepancies.length === 0
                        ? "Kết quả đối chiếu: Hàng hóa thực tế TRÙNG KHỚP HOÀN TOÀN với khai báo của khách hàng"
                        : `Kết quả đối chiếu: Phát hiện ${activeDiscrepancies.length} điểm CHÊNH LỆCH giữa hàng hóa thực tế và khai báo`}
                    </b>
                  </div>
                  {activeDiscrepancies.length === 0 ? (
                    <p className="mt-1.5 pl-8 text-xs text-emerald-800 leading-relaxed">
                      Toàn bộ số kiện, kích thước, khối lượng, thể tích và tình trạng hàng hóa kiểm kê thực tế trùng khớp với thông tin khách hàng đã khai báo.
                    </p>
                  ) : (
                    <div className="mt-2 pl-8">
                      <p className="text-xs font-medium text-amber-900">Chi tiết các mục chênh lệch cần ghi nhận:</p>
                      <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs text-amber-800">
                        {activeDiscrepancies.map((diff, index) => (
                          <li key={index}>{diff}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>}
                {lineInventory ? (
                  <div className="space-y-5">
                    {catalogError && <p role="alert" className="text-red-800">Chưa tải được danh mục loại hàng và chất liệu. Vui lòng tải lại trước khi hoàn tất kiểm kê.</p>}
                    {inventoryRows.map(({ line, entry, comparison }, index) => {
                      const absent = comparison.quantity === 0
                      const actualCategory = inventoryCatalog?.categories.find(c => c.id === entry.catalogCategoryId)
                      const errorKey = `inventory-${line.id}`
                      return (
                        <fieldset key={line.id} className="min-w-0 space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4" disabled={isReviewingCompletedStep || submitting}>
                          <legend className="max-w-full px-1">
                            <span className="inline-block max-w-full break-words rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-950">
                              {line.name || `Hàng hóa ${index + 1}`}
                            </span>
                          </legend>
                          <details className="text-sm text-stone-600"><summary className="cursor-pointer font-medium">Thông tin đã khai báo</summary><p className="mt-2">
                            Khai báo {line.quantity} kiện
                            {(line.categoryName || line.name) && ` · Loại: ${line.categoryName || line.name}`}
                            {line.materialName && ` · Chất liệu: ${line.materialName}`}
                            {line.lengthCm != null && line.widthCm != null && line.heightCm != null && ` · ${line.lengthCm} × ${line.widthCm} × ${line.heightCm} cm/kiện`}
                            {line.weightPerPackageKg != null && ` · ${line.weightPerPackageKg} kg/kiện`}
                          </p></details>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div><Select label="Loại hàng hóa *" value={entry.catalogCategoryId || ''} disabled={absent} onChange={event => updateInventoryLine(line, { catalogCategoryId: event.target.value, catalogMaterialId: '' })}>
                              <option value="">Chọn loại hàng trong danh mục</option>{(inventoryCatalog?.categories ?? []).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </Select><InventoryFieldDifference actual={entry.catalogCategoryId} declared={line.catalogCategoryId} declaredLabel={line.categoryName || line.name || "Loại hàng đã khai"} disabled={absent} />{fieldErrors[`${errorKey}-category`] && <p className="text-xs text-red-700">{fieldErrors[`${errorKey}-category`]}</p>}</div>
                            {!actualCategory?.custom && <div><Select label="Chất liệu chính" value={entry.catalogMaterialId || ''} disabled={absent || !actualCategory} onChange={event => updateInventoryLine(line, { catalogMaterialId: event.target.value })}>
                              <option value="">Chọn chất liệu hoặc không áp dụng</option>{actualCategory?.materials.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </Select><InventoryFieldDifference actual={entry.catalogMaterialId || "Không áp dụng"} declared={line.catalogMaterialId || "Không áp dụng"} declaredLabel={line.materialName || "Không áp dụng"} disabled={absent} /></div>}
                          </div>
                          {actualCategory?.custom && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <div><Input label="Tên hàng hóa khác *" value={entry.customGoodsName || ""} error={fieldErrors[`${errorKey}-name`]} onChange={event => updateInventoryLine(line, { customGoodsName: event.target.value })} /><InventoryFieldDifference actual={entry.customGoodsName} declared={line.category === "OTHER" ? line.name : null} disabled={absent} /></div>
                            <div><Input label="Chất liệu chính (nếu xác định được)" value={entry.customMaterial || ""} onChange={event => updateInventoryLine(line, { customMaterial: event.target.value })} /><InventoryFieldDifference actual={entry.customMaterial} declared={line.category === "OTHER" ? line.materialName : null} disabled={absent} /></div>
                          </div>}
                          <label className="block text-sm font-medium text-stone-700">Mô tả hàng hóa (không bắt buộc)
                            <textarea className="mt-1 min-h-20 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={entry.description ?? line.name ?? ""} onChange={event => updateInventoryLine(line, { description: event.target.value })} />
                          </label>
                          <div className="grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-5">
                            <div><Input label="Số lượng *" type="number" min="0" step="1" value={entry.quantity} error={fieldErrors[`${errorKey}-quantity`]} onChange={event => {
                              const quantity = event.target.value
                              const unitWeight = Number(entry.quantity) > 0 ? Number(entry.weightKg) / Number(entry.quantity) : line.weightPerPackageKg || 0
                              updateInventoryLine(line, { quantity, weightKg: String(unitWeight * Number(quantity)), condition: Number(quantity) === 0 ? "NOT_PRESENT" : entry.condition === "NOT_PRESENT" ? "" : entry.condition })
                            }} /><InventoryFieldDifference actual={entry.quantity} declared={line.quantity} unit="kiện" /></div>
                            {inventoryDimensions.map(([field, label]) => <div key={field}><Input label={label.replace("Dài thực tế", "Chiều dài").replace("Rộng thực tế", "Chiều rộng").replace("Cao thực tế", "Chiều cao") + " *"} error={fieldErrors[`${errorKey}-${field}`]} type="number" min="0.01" step="any" value={entry[field]} disabled={absent} onChange={event => updateInventoryLine(line, { [field]: event.target.value })} /><InventoryFieldDifference actual={entry[field]} declared={line[field]} unit="cm" tolerance={0.01} disabled={absent} /></div>)}
                            <div><Input label="Nặng/kiện (kg) *" error={fieldErrors[`${errorKey}-weightKg`]} type="number" min="0.01" step="any" disabled={absent} value={absent ? "" : String(Number(entry.weightKg) / Number(entry.quantity) || "")} onChange={event => updateInventoryLine(line, { weightKg: String(Number(event.target.value) * Number(entry.quantity)) })} /><InventoryFieldDifference actual={Number(entry.quantity) > 0 ? Number(entry.weightKg) / Number(entry.quantity) : null} declared={line.weightPerPackageKg} unit="kg/kiện" tolerance={0.1} disabled={absent} /></div>
                          </div>
                          <div className="space-y-4 border-t border-stone-200 pt-4">
                            {(['fragile', 'stackable', 'allowHorizontalPlacement'] as const).map((key, i) => <fieldset key={key}>
                              <legend className="text-sm font-medium text-stone-700">{['Hàng dễ bể / dễ vỡ? *', 'Hàng có được phép xếp chồng không? *', 'Được phép xoay và đặt nằm ngang? *'][i]}</legend>
                              <div className="mt-2 flex gap-5">{[false, true].map(value => <label key={String(value)} className="flex items-center gap-2 text-sm"><input type="radio" name={`${line.id}-${key}`} disabled={absent || (key === 'stackable' && value && entry.fragile)} checked={Boolean(entry[key]) === value} onChange={() => updateInventoryLine(line, { [key]: value, ...(key === 'fragile' && value ? { stackable: false, maxStackLayers: 1 } : {}) })} />{value ? 'Có' : 'Không'}</label>)}</div>
                              <InventoryFieldDifference actual={entry[key] ? "Có" : "Không"} declared={line[key] == null ? null : line[key] ? "Có" : "Không"} disabled={absent} />
                            </fieldset>)}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Select label="Tình trạng hàng hóa *" value={entry.condition} onChange={event =>
                                updateInventoryLine(line, { condition: event.target.value as InventoryDraft["condition"] })}>
                                <option value="">Chọn tình trạng</option>
                                <option value="INTACT" disabled={absent}>Nguyên vẹn</option>
                                <option value="DAMAGED" disabled={absent}>Có hư hỏng</option>
                                <option value="NOT_PRESENT" disabled={!absent}>Không có kiện nào</option>
                              </Select>
                              {entry.condition === "DAMAGED" && <p className="mt-1 text-xs font-medium text-amber-800" role="status">Hàng thực tế có hư hỏng. Ghi rõ tình trạng bên dưới.</p>}
                              {entry.condition === "NOT_PRESENT" && <p className="mt-1 text-xs font-medium text-amber-800" role="status">Không có hàng thực tế để tiếp nhận.</p>}
                              {fieldErrors[`${errorKey}-condition`] && <p className="text-xs text-red-700">{fieldErrors[`${errorKey}-condition`]}</p>}
                            </div>
                            {entry.condition === "DAMAGED" && <Input label="Mô tả hư hỏng *" error={fieldErrors[`${errorKey}-note`]} value={entry.note} maxLength={400}
                              onChange={event => updateInventoryLine(line, { note: event.target.value })} />}
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={entry.checked} onChange={event => updateInventoryLine(line, { checked: event.target.checked })} />
                            Đã đối chiếu số liệu và ghi nhận tình trạng *
                          </label>
                          {fieldErrors[`${errorKey}-checked`] && <p className="text-xs text-red-700">{fieldErrors[`${errorKey}-checked`]}</p>}
                        </fieldset>
                      )
                    })}
                    {fieldErrors.packageCount && <p className="text-sm text-red-700">{fieldErrors.packageCount}</p>}
                  </div>
                ) : (<>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Dài thực tế (cm) *"
                    error={fieldErrors.lengthCm}
                    disabled={isReviewingCompletedStep}
                    type="number"
                    min="0.01"
                    value={lengthCm}
                    onChange={(event) => {
                      clearFieldError("lengthCm")
                      const next = event.target.value
                      setLengthCm(next)
                      setVolumeM3(volumeFromDimensions(next, widthCm, heightCm))
                    }}
                  />
                  <Input
                    label="Rộng thực tế (cm) *"
                    error={fieldErrors.widthCm}
                    disabled={isReviewingCompletedStep}
                    type="number"
                    min="0.01"
                    value={widthCm}
                    onChange={(event) => {
                      clearFieldError("widthCm")
                      const next = event.target.value
                      setWidthCm(next)
                      setVolumeM3(volumeFromDimensions(lengthCm, next, heightCm))
                    }}
                  />
                  <Input
                    label="Cao thực tế (cm) *"
                    error={fieldErrors.heightCm}
                    disabled={isReviewingCompletedStep}
                    type="number"
                    min="0.01"
                    value={heightCm}
                    onChange={(event) => {
                      clearFieldError("heightCm")
                      const next = event.target.value
                      setHeightCm(next)
                      setVolumeM3(volumeFromDimensions(lengthCm, widthCm, next))
                    }}
                  />
                  <Input
                    label="Khối lượng (kg) *"
                    error={fieldErrors.weightKg}
                    disabled={isReviewingCompletedStep}
                    type="number"
                    min="0.01"
                    value={weightKg}
                    onChange={(event) => {
                      clearFieldError("weightKg")
                      setWeightKg(event.target.value)
                    }}
                  />
                  <Input
                    label="Thể tích (m³) *"
                    error={fieldErrors.volumeM3}
                    value={volumeM3}
                    readOnly
                  />
                  <Input
                    label="Số kiện *"
                    error={fieldErrors.packageCount}
                    disabled={isReviewingCompletedStep}
                    type="number"
                    min="1"
                    value={packageCount}
                    onChange={(event) => {
                      clearFieldError("packageCount")
                      setPackageCount(event.target.value)
                    }}
                  />
                </div>
                {checkInComparison && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    ['packageCount', 'Số kiện', checkInComparison.packageCountMatches],
                    ['weight', 'Khối lượng', checkInComparison.weightMatches],
                    ['volume', 'Thể tích', checkInComparison.volumeMatches],
                    ['dimensions', 'Kích thước', checkInComparison.dimensionMatches],
                  ] as Array<[MeasurementComparisonKey, string, boolean | null]>).map(([key, label, matches]) => <div key={key} className="rounded-lg border border-stone-200 p-3 text-sm"><div className="mb-2 flex items-center justify-between gap-2"><b>{label}</b><ComparisonBadge matches={matches} /></div></div>)}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="flex items-center gap-2 rounded-lg border border-stone-200 p-3 text-sm cursor-pointer hover:bg-stone-50 transition">
                      <input
                        type="checkbox"
                        disabled={isReviewingCompletedStep}
                        checked={Object.values(measurementChecks).every(Boolean)}
                        onChange={(event) => {
                          clearFieldError("measurementChecks")
                          setMeasurementChecks({
                            packageCount: event.target.checked,
                            weight: event.target.checked,
                            volume: event.target.checked,
                            dimensions: event.target.checked,
                          goodsCategory: event.target.checked,
                          goodsMaterial: event.target.checked,
                          })
                        }}
                      />
                      Đã đối chiếu đủ số kiện, khối lượng, thể tích, kích thước, loại hàng và chất liệu chính *
                    </label>
                    {fieldErrors.measurementChecks && (
                      <p className="text-xs text-red-600 font-medium pl-2">{fieldErrors.measurementChecks}</p>
                    )}
                  </div>
                </div>}
                </>)}
                <div className="grid gap-3 sm:grid-cols-2">
                  {!lineInventory && <>
                  <div className="space-y-1">
                    <Input
                      label="Loại hàng thực tế *"
                      error={fieldErrors.goodsCategory}
                      disabled={isReviewingCompletedStep}
                      value={goodsCategory}
                      onChange={(event) => {
                        clearFieldError("goodsCategory")
                        setGoodsCategory(event.target.value)
                        setVarianceAccepted(false)
                      }}
                    />
                    <div className="flex items-center justify-between gap-2 px-1 text-xs text-stone-600">
                      <span>Đã khai báo: {declaredCategoryValues.join(", ") || "Chưa có dữ liệu"}</span>
                      <ComparisonBadge matches={goodsCategoryMatches} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Input
                      label="Chất liệu chính thực tế *"
                      error={fieldErrors.goodsMaterial}
                      disabled={isReviewingCompletedStep}
                      value={goodsMaterial}
                      onChange={(event) => {
                        clearFieldError("goodsMaterial")
                        setGoodsMaterial(event.target.value)
                        setVarianceAccepted(false)
                      }}
                    />
                    <div className="flex items-center justify-between gap-2 px-1 text-xs text-stone-600">
                      <span>Đã khai báo: {declaredMaterialValues.join(", ") || "Chưa có dữ liệu"}</span>
                      <ComparisonBadge matches={goodsMaterialMatches} />
                    </div>
                  </div>
                  </>}
                  {!lineInventory && <div className={`rounded-lg border ${fieldErrors.initialCondition || fieldErrors.initialUnitCondition ? 'border-red-400 bg-red-50/30' : 'border-stone-200 bg-stone-50'} px-3 py-2 text-sm`}>
                    <span className="text-stone-500">Tình trạng kho trống đã ghi nhận</span>
                    <b className="mt-1 block">{initialCondition || 'Chưa ghi nhận'}</b>
                    {(fieldErrors.initialCondition || fieldErrors.initialUnitCondition) && (
                      <p className="text-xs text-red-600 font-medium mt-1">{fieldErrors.initialCondition || fieldErrors.initialUnitCondition}</p>
                    )}
                  </div>}
                  <div className="space-y-2 rounded-lg border border-stone-200 p-3 md:col-span-2">
                    <p className="text-sm">Phương thức khách khai: <b>{handoverTarget?.declaredPackagingMethod || 'Chưa ghi nhận'}</b></p>
                    <Select label="Phương thức đóng gói thực tế *" value={actualPackagingMethod} disabled={isReviewingCompletedStep} onChange={event => { setActualPackagingMethod(event.target.value); clearFieldError("actualPackagingMethod") }}>
                      <option value="">Chọn phương thức đóng gói</option>
                      {actualPackagingMethod && !(PACKAGING_METHOD_OPTIONS as readonly string[]).includes(actualPackagingMethod) && <option value={actualPackagingMethod}>{actualPackagingMethod}</option>}
                      {PACKAGING_METHOD_OPTIONS.map(method => <option key={method}>{method}</option>)}
                    </Select>
                    {fieldErrors.actualPackagingMethod && <p className="text-xs text-red-700">{fieldErrors.actualPackagingMethod}</p>}
                    {actualPackagingMethod.trim() && handoverTarget?.declaredPackagingMethod && <p className={packagingMethodMismatch ? 'text-sm font-semibold text-red-700' : 'text-sm text-emerald-700'}>{packagingMethodMismatch ? 'Không khớp phương thức đã khai báo' : 'Khớp phương thức đã khai báo'}</p>}
                    <label className="block text-sm font-medium">Tình trạng đóng gói thực tế *
                      <select className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2" value={packagingCondition} disabled={isReviewingCompletedStep}
                        onChange={event => { setPackagingCondition(event.target.value as typeof packagingCondition); clearFieldError('packagingCondition') }}>
                        <option value="">Chọn tình trạng đóng gói</option><option value="INTACT">Nguyên vẹn</option><option value="MINOR_DAMAGE">Hư hỏng nhẹ</option><option value="MAJOR_DAMAGE">Hư hỏng nặng</option><option value="UNPACKAGED">Chưa đóng gói</option>
                      </select>
                    </label>
                    {fieldErrors.packagingCondition && <p className="text-xs text-red-700">{fieldErrors.packagingCondition}</p>}
                  <Input
                    label={packagingNoteRequired ? "Ghi chú tình trạng đóng gói *" : "Ghi chú đóng gói (không bắt buộc)"}
                    error={fieldErrors.notes}
                    disabled={isReviewingCompletedStep}
                    value={handoverNotes}
                    onChange={(event) => {
                      clearFieldError("notes")
                      setHandoverNotes(event.target.value)
                    }}
                  />
                  </div>
                  {!lineInventory && (
                  <Input
                    label="Tình trạng hàng hóa *"
                    error={fieldErrors.goodsCondition}
                    disabled={isReviewingCompletedStep}
                    value={goodsCondition}
                    onChange={(event) => {
                      clearFieldError("goodsCondition")
                      setGoodsCondition(event.target.value)
                    }}
                  />
                  )}
                </div>
                {!lineInventory && (
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isReviewingCompletedStep}
                      checked={checklist.conditionRecorded}
                      onChange={(event) => {
                        clearFieldError("conditionRecorded")
                        setChecklist((value) => ({ ...value, conditionRecorded: event.target.checked }))
                      }}
                    />
                    Đã ghi nhận tình trạng hàng hóa *
                  </label>
                  {fieldErrors.conditionRecorded && (
                    <p className="text-xs text-red-600 font-medium pl-6">{fieldErrors.conditionRecorded}</p>
                  )}
                </div>
                )}
                {(fieldErrors.handoverChecklist || fieldErrors.lockReference) && <p className="text-sm text-red-700">{fieldErrors.handoverChecklist || fieldErrors.lockReference}</p>}
                {!isReviewingCompletedStep && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium">
                      Bằng chứng kiểm kê hàng hóa (ảnh/PDF, tối đa 25MB/tệp) *
                      <input
                        className={`mt-1 block w-full rounded-lg border ${fieldErrors.evidenceFiles || fieldErrors.evidenceReferences ? 'border-red-500 bg-red-50/20' : 'border-stone-300'} bg-white px-3 py-2 text-sm`}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(event) => {
                          clearFieldError("evidenceFiles")
                          clearFieldError("evidenceReferences")
                          const selected = Array.from(event.target.files || [])
                          const tooBig = selected.find((f) => !validateUploadFile(f, 'kiểm kê', setError))
                          if (tooBig) {
                            event.target.value = ""
                            return
                          }
                          setEvidenceFiles(selected)
                        }}
                      />
                    </label>
                    {(fieldErrors.evidenceFiles || fieldErrors.evidenceReferences) && (
                      <p className="text-xs text-red-600 font-medium">{fieldErrors.evidenceFiles || fieldErrors.evidenceReferences}</p>
                    )}
                    <FilePreviewList
                      files={evidenceFiles}
                      onRemove={(index) => {
                        setEvidenceFiles((files) => files.filter((_, current) => current !== index))
                      }}
                      disabled={submitting}
                    />
                  </div>
                )}
                {measurementVariance && (
                  <div className={`space-y-3 rounded-lg border ${fieldErrors.varianceAccepted || fieldErrors.varianceReason ? 'border-red-300 bg-red-50/50' : 'border-amber-300 bg-amber-50'} p-3 text-sm`}>
                    {!lineInventory && <div>
                      <label className="flex gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isReviewingCompletedStep}
                          checked={varianceAccepted}
                          onChange={(event) => {
                            clearFieldError("varianceAccepted")
                            setVarianceAccepted(event.target.checked)
                          }}
                        />
                        {lineInventory ? "Đã ghi nhận sai lệch để khách hàng xác nhận" : "Đã trao đổi với khách và chấp nhận chênh lệch *"}
                      </label>
                      {fieldErrors.varianceAccepted && (
                        <p className="text-xs text-red-600 font-medium mt-1 pl-6">{fieldErrors.varianceAccepted}</p>
                      )}
                    </div>}
                    <Input
                      label="Lý do chênh lệch *"
                      maxLength={500}
                      placeholder="Ví dụ: Thùng carton thay cho thùng nhựa đã khai báo"
                      error={fieldErrors.varianceReason}
                      disabled={isReviewingCompletedStep}
                      value={varianceReason}
                      onChange={(event) => {
                        clearFieldError("varianceReason")
                        setVarianceReason(event.target.value)
                      }}
                    />
                  </div>
                )}
                {lineInventory && !isReviewingCompletedStep && <>
                    {inventoryCapacity && (
                      <section className={`rounded-xl border p-4 ${inventoryCapacity.state === "NOT_FIT" ? "border-red-200 bg-red-50" : inventoryCapacity.state === "PENDING" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`} aria-live="polite">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-stone-900">Kết quả kiểm tra sức chứa</p>
                            <p className="mt-1 text-xs text-stone-600">Đối chiếu sơ bộ số kiện, thể tích, tải trọng và kích thước. Hệ thống xác nhận phương án xếp hàng chính thức khi chuyển sang kết quả tiếp nhận.</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Các kết quả kiểm tra sức chứa">
                          {([
                            ["Khớp khai báo và vừa kho", !measurementVariance && ["FULL_FIT", "LESS_THAN_DECLARED", "MORE_THAN_DECLARED"].includes(inventoryCapacity.state)],
                            ["Có sai lệch nhưng vẫn vừa kho", measurementVariance && ["FULL_FIT", "LESS_THAN_DECLARED", "MORE_THAN_DECLARED"].includes(inventoryCapacity.state)],
                            ["Không vừa kho", inventoryCapacity.state === "NOT_FIT"],
                          ] as const).map(([label, active]) => <div key={label} className={`rounded-lg border p-3 text-sm ${active ? "border-amber-500 bg-white font-semibold text-stone-950 ring-1 ring-amber-400" : "border-stone-200 bg-white/60 text-stone-500"}`}><span aria-hidden="true">{active ? "● " : "○ "}</span>{label}</div>)}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                          <div className="rounded-lg border border-white/80 bg-white/80 p-3"><span className="text-stone-500">Số kiện thực tế / khai báo</span><p className="mt-1 font-bold text-stone-900">{inventoryCapacity.totalPackages} / {handoverTarget?.declaredPackageCount ?? "-"}</p></div>
                          <div className="rounded-lg border border-white/80 bg-white/80 p-3"><span className="text-stone-500">Thể tích thực tế / sức chứa</span><p className="mt-1 font-bold text-stone-900">{inventoryCapacity.totalVolume.toFixed(4)} / {handoverTarget?.storageCapacity?.volumeM3 == null ? "-" : handoverTarget.storageCapacity.volumeM3.toFixed(4)} m³</p></div>
                          <div className="rounded-lg border border-white/80 bg-white/80 p-3"><span className="text-stone-500">Khối lượng thực tế / giới hạn</span><p className="mt-1 font-bold text-stone-900">{inventoryCapacity.totalWeight.toFixed(2)} / {handoverTarget?.storageCapacity?.maxLoadKg == null ? "-" : handoverTarget.storageCapacity.maxLoadKg.toFixed(2)} kg</p></div>
                          <div className="rounded-lg border border-white/80 bg-white/80 p-3"><span className="text-stone-500">Kích thước lớn nhất</span><p className="mt-1 font-bold text-stone-900">{inventoryCapacity.dimensions.every(value => value > 0) ? `${inventoryCapacity.dimensions.join(" × ")} cm` : "-"}</p></div>
                        </div>
                        {inventoryCapacity.state === "PENDING" && <p className="mt-3 text-sm text-stone-600">Nhập đầy đủ số liệu và xác nhận từng dòng hàng để xem kết quả sức chứa.</p>}
                        {inventoryCapacity.reasons.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-red-800">{inventoryCapacity.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
                        {inventoryCapacity.state === "UNKNOWN" && <p className="mt-3 text-xs text-amber-800">Chưa nhận được cấu hình sức chứa của gian kho. Kết quả xếp hàng sẽ có sau khi gửi kiểm kê.</p>}
                        {handoverTarget?.inventoryMismatchSummary && handoverTarget.inventoryResolutionStatus && handoverTarget.inventoryResolutionStatus !== "NOT_STARTED" && <p className="mt-3 border-t border-black/10 pt-3 text-xs text-stone-700"><b>Kết quả lần kiểm kê gần nhất:</b> {handoverTarget.inventoryMismatchSummary}</p>}
                      </section>
                    )}
                    <label className={`flex items-start gap-3 rounded-xl border p-4 text-sm text-amber-950 ${fieldErrors.inventoryReview ? "border-red-400 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
                      <input type="checkbox" className="mt-1" checked={inventoryReviewConfirmed} disabled={submitting || isReviewingCompletedStep || !inventoryLinesComplete} onChange={event => { clearFieldError("inventoryReview"); setConfirmedInventoryReview(event.target.checked ? inventoryReviewKey : null) }} />
                      <span><b>Xác nhận hàng hóa kiểm kê</b><span className="mt-1 block">Đã đối chiếu hàng thực tế, các chênh lệch và kết quả sức chứa bên trên. Tôi xác nhận số liệu kiểm kê để tiếp tục gửi kết quả.</span></span>
                    </label>
                    {fieldErrors.inventoryReview && <p className="text-xs font-medium text-red-700">{fieldErrors.inventoryReview}</p>}
                </>}
                {isReviewingCompletedStep && handoverTarget.handover?.evidenceReferences.length ? <p className="text-xs text-stone-600">Đã lưu {handoverTarget.handover.evidenceReferences.length} tệp bằng chứng kiểm kê trong biên bản.</p> : null}
              </div>
              </div>
            )}

            {error && error !== "Một số trường thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu đỏ bên dưới." && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2 shadow-sm">
                <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 font-medium">
                  {error !== "Một số trường thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu đỏ bên dưới." && <span>{error}</span>}
                  {Object.keys(fieldErrors).length > 0 && (
                    <ul className={`${error !== "Một số trường thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu đỏ bên dưới." ? "mt-1 " : ""}list-disc list-inside space-y-0.5 text-xs text-red-700`}>
                      {Object.entries(fieldErrors).map(([key, msg]) => (
                        <li key={key}>{msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setError(null); setFieldErrors({}) }}
                  className="rounded px-1 text-xs font-bold text-red-500 hover:bg-red-100 hover:text-red-700"
                  aria-label="Đóng lỗi"
                >
                  ✕
                </button>
              </div>
            )}

            {inventoryMode && inventoryStage === 3 && <div>
              {inventorySavedAt && !inventoryPublished && !inventoryBlockedReason && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Đã lưu bản kiểm kê lúc {formatStaffDateTime(inventorySavedAt)}. Có thể chỉnh sửa trước khi chuyển sang kết quả tiếp nhận.</p>}
              {(() => {
                const fit = inventoryPublished ? handoverTarget.inventoryFullFit : !inventoryCapacity || ["UNKNOWN", "PENDING"].includes(inventoryCapacity.state) ? null : inventoryCapacity.state !== "NOT_FIT"
                const result = inventoryResult(fit, inventoryPublished ? Boolean(handoverTarget.inventoryMismatchJson) : measurementVariance)
                const fits = result !== 'NOT_FIT'
                const matches = result === 'MATCHED'
                return <InventoryResultNotice key={handoverTarget.checkInId || handoverTarget.reservationId} result={result} published={inventoryPublished} showAlternatives={false} checkInId={handoverTarget.checkInId} packages={totalPackages} weight={actualWeight} volume={actualVolume}>
                  <InventoryReviewDetails
                    lines={inventoryRows.map(({ line, entry, comparison }) => {
                      const category = inventoryCatalog?.categories.find(value => value.id === entry.catalogCategoryId)
                      return { id: line.id, name: category?.custom ? entry.customGoodsName?.trim() || line.name || 'Hàng hóa khác' : line.name || category?.label || 'Hàng hóa',
                        category: category?.label || line.categoryName || 'Chưa ghi nhận',
                        material: category?.custom ? entry.customMaterial?.trim() || 'Không xác định' : category?.materials.find(value => value.id === entry.catalogMaterialId)?.label || line.materialName || 'Không áp dụng',
                        description: entry.description?.trim() || line.name || '', quantity: comparison.quantity, dimensions: comparison.dimensions,
                        weightPerPackage: comparison.quantity > 0 ? comparison.weight / comparison.quantity : 0,
                        fragile: Boolean(entry.fragile), stackable: Boolean(entry.stackable), horizontal: Boolean(entry.allowHorizontalPlacement),
                        condition: entry.condition === 'DAMAGED' ? 'Có hư hỏng' : entry.condition === 'NOT_PRESENT' ? 'Không có hàng' : 'Nguyên vẹn',
                        damage: entry.condition === 'DAMAGED' ? entry.note : '' }
                    })}
                    packaging={actualPackagingMethod}
                    packagingCondition={{ INTACT: 'Nguyên vẹn', MINOR_DAMAGE: 'Hư hỏng nhẹ', MAJOR_DAMAGE: 'Hư hỏng nặng', UNPACKAGED: 'Chưa đóng gói' }[packagingCondition || 'INTACT']}
                    packagingNote={handoverNotes} reason={measurementVariance ? effectiveVarianceReason : ''}
                    evidence={<div className="flex flex-wrap gap-2">{evidenceFiles.map((file, index) => <span key={index} className="rounded border bg-stone-50 px-3 py-2">{file.name}</span>)}{checkInEvidenceAssetIds(evidenceReferences).filter(id => !checkInEvidenceAssetIds(parseEmptyStorageHandover(handoverTarget.readinessNote).evidenceReferences).includes(id)).map((id, index) => <Button key={id} size="sm" variant="outline" onClick={() => void previewEvidenceFile(id)}>Xem bằng chứng {index + 1}</Button>)}</div>}
                  />
                  {!inventoryPublished && !inventoryBlockedReason && <p className="text-sm text-amber-900">Đã lưu hàng hóa kiểm kê. Tiếp tục để hệ thống kiểm tra sức chứa chính thức và ghi nhận phương án trực tiếp tại cơ sở.</p>}
                </InventoryResultNotice>
              })()}
            </div>}

            {inventoryMode && inventoryStage === 4 && <InventoryResolutionPanel item={handoverTarget} busy={submitting}
              onOpenReturns={onOpenReturns}
              onPreview={assetId => void previewEvidenceFile(assetId)}
              onRefusal={async request => {
                if (!handoverTarget?.checkInId || inventoryCommandLock.current) return
                inventoryCommandLock.current = true
                setSubmitting(true)
                try {
                  setHandoverTarget(await submitInventoryRefusal(handoverTarget.checkInId, request))
                  refresh()
                  showToast('Đã gửi biên bản cho Quản lý xem xét.')
                } finally {
                  inventoryCommandLock.current = false
                  setSubmitting(false)
                }
              }}
              onResolve={async request => {
                if (!handoverTarget?.checkInId || inventoryCommandLock.current) return
                inventoryCommandLock.current = true; setSubmitting(true)
                try {
                  const updated = await resolveInventoryAtSite(handoverTarget.checkInId, request)
                  setHandoverTarget(updated); refresh(); showToast('Đã ghi nhận phương án tại cơ sở.')
                } finally { inventoryCommandLock.current = false; setSubmitting(false) }
              }} />}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
              <Button variant="outline" onClick={closeHandover} disabled={submitting}>Đóng</Button>
              {inventoryMode ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {isViewingEarlierInventoryStage && (
                    <span className="text-xs text-stone-500">Đang xem lại bước đã hoàn thành, không thể chỉnh sửa.</span>
                  )}
                  {inventoryStage === 4 && <Button variant="outline" disabled={submitting} onClick={() => returnToInventoryStage(3)}>← Quay lại bước 3</Button>}
                  {inventoryStage === 3 && <Button variant="outline" disabled={submitting} onClick={() => returnToInventoryStage(2)}>← Quay lại bước 2</Button>}
                  {inventoryStage === 2 && <Button variant="outline" disabled={submitting} onClick={() => returnToInventoryStage(1)}>← Quay lại bước 1</Button>}
                  {isViewingEarlierInventoryStage ? (
                    <Button disabled={submitting} onClick={() => setInventoryStage((inventoryStage + 1) as InventoryStage)}>Tiếp theo →</Button>
                  ) : (
                    <>
                      {inventoryStage === 1 && <Button disabled={submitting || Boolean(inventoryBlockedReason) || handoverTarget.checkInStatus === 'setup_in_progress' || !handoverTarget.inventoryVisit?.identityVerifiedAt} onClick={() => advanceInventoryStage(2)}>Tiếp tục kiểm kê hàng hóa</Button>}
                      {inventoryStage === 2 && inventoryStageReadOnly && <Button onClick={() => advanceInventoryStage(4)}>Xem lại kết quả kiểm kê</Button>}
                      {inventoryStage === 2 && !inventoryStageReadOnly && <Button disabled={submitting} onClick={() => void submitHandover()}>{submitting ? "Đang lưu kiểm kê…" : "Xác nhận hàng hóa kiểm kê"}</Button>}
                      {inventoryStage === 3 && !inventoryPublished && <Button disabled={submitting || Boolean(inventoryBlockedReason) || (lineInventory && !inventoryReviewConfirmed)} onClick={() => void continueInventoryResolution()}>{submitting ? "Đang kiểm tra sức chứa…" : "Tiếp tục đến kết quả tiếp nhận"}</Button>}
                      {inventoryStage === 3 && inventoryPublished && <Button onClick={() => advanceInventoryStage(4)}>Xem kết quả tiếp nhận</Button>}
                    </>
                  )}
                </div>
              ) : editingVerifiedIdentity ? (
                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="outline" disabled={submitting} onClick={() => {
                    resetIdentityVerificationDraft(handoverTarget.identityDocumentNumber || "")
                    setError(null)
                    setFieldErrors({})
                    setEditingVerifiedIdentity(false)
                  }}>Hủy sửa</Button>
                  <Button disabled={submitting || !savedIdentityMismatch || reviewedCorrectionTooLarge || !bookingOwnerConfirmed || !verificationNotes.trim() || !identityValidation.ok || (!!identityValidation.warning && !adulthoodConfirmed)}
                    onClick={() => void submitVerifiedIdentityCorrection()}>{submitting ? "Đang lưu…" : "Lưu CCCD"}</Button>
                </div>
              ) : isReviewingCompletedStep ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {handoverStep !== 1 && <span className="text-xs text-stone-500">Đang xem lại dữ liệu đã lưu, không thể thay đổi bước này.</span>}
                  {handoverStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => { setError(null); setHandoverStep((prev) => Math.max(1, prev - 1)); }}
                      disabled={submitting}
                    >
                      Quay lại
                    </Button>
                  )}
                  {handoverStep < Math.min(5, workflowCurrentStep) && (
                    <Button
                      onClick={() => { setError(null); setHandoverStep((prev) => Math.min(5, workflowCurrentStep, prev + 1)); }}
                      disabled={submitting}
                    >
                      Tiếp tục
                    </Button>
                  )}
                </div>
              ) : handoverStep === 5 ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="text-xs text-stone-600">
                    {handoverTarget.checkInStatus === "handover_pending_receipt"
                      ? "Đang chờ khách nhấn Xác nhận đã nhận kho."
                      : "Đang chờ khách báo đã chuẩn bị xong."}
                  </span>
                  <Button variant="outline" onClick={() => void refreshHandoverTarget()} disabled={submitting}>
                    Kiểm tra trạng thái
                  </Button>
                  {handoverStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => { setError(null); setHandoverStep((prev) => Math.max(1, prev - 1)); }}
                      disabled={submitting}
                    >
                      Quay lại
                    </Button>
                  )}
                </div>
              ) : handoverStep < 6 ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {handoverStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => { setError(null); setHandoverStep((prev) => Math.max(1, prev - 1)); }}
                      disabled={submitting}
                    >
                      Quay lại
                    </Button>
                  )}
                  {handoverStep === 1 && needsHandoverArrival ? null : handoverStep === 1 && identityComparison === null ? (
                    <Button disabled={submitting || !bookingOwnerConfirmed || !enteredIdentity || !staffCheckInActions(handoverTarget, now).canOpen} onClick={() => void checkIdentity()}>
                      {submitting ? "Đang xác minh…" : "Xác minh CCCD"}
                    </Button>
                  ) : (handoverStep !== 1 || identityCanConfirm) && (
                    <Button disabled={submitting || !staffCheckInActions(handoverTarget, now).canOpen ||
                    (handoverStep === 1 && (!bookingOwnerConfirmed || !identityValidation.ok || (!!identityValidation.warning && !adulthoodConfirmed) || (identityNeedsNotes && !verificationNotes.trim()))) ||
                    (handoverStep === 2 && (!contractFile || !!setupTermsKey && (confirmedSetupTerms !== setupTermsKey || handoverTarget.setupEarlyExitFee == null))) ||
                    (handoverStep === 3 && (handoverTarget.dueAtCheckIn ?? 0) > 0 && !paymentEvidenceFile) ||
                    (handoverStep === 4 && !emptyStorageHandoverReady)
                    } onClick={() => submitWorkflowStep()}>{submitting ? "Đang lưu…" : handoverStep === 1 && identityCorrection ? "Lưu CCCD và tiếp tục" : "Xác nhận và tiếp tục"}</Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {handoverStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => { setError(null); setHandoverStep((prev) => Math.max(1, prev - 1)); }}
                      disabled={submitting}
                    >
                      Quay lại
                    </Button>
                  )}
                  <Button disabled={submitting || Boolean(inventoryBlockedReason) || !handoverTarget.inventoryVisit?.identityVerifiedAt} onClick={() => submitHandover()}>{submitting ? "Đang hoàn tất…" : "Hoàn tất kiểm kê"}</Button>
                </div>
              )}
            </div>
          </div></ProcessingLeaseBoundary>
        )

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        title="Nhận kho & bàn giao"
        subtitle="Xác minh, ký hợp đồng, thu tiền và ghi nhận bàn giao kho trống. Nhân viên kiểm kê sau khi khách báo đã chuẩn bị hàng xong."
      />
      <div className="border-b border-stone-200 px-4 pb-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_minmax(150px,1.1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] xl:items-end">
          <Input
            label="Tìm kiếm"
            className="h-12 !border-stone-200 !bg-white"
            value={queryInput}
            placeholder="Mã đơn, khách hàng, email hoặc mã kho"
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters()
              }
            }}
          />
          <Select
            label="Trạng thái"
            className="h-12 !border-stone-200 !bg-white"
            value={statusInput}
            onChange={(event) =>
              setStatusInput(event.target.value as CheckInListStatus | "")
            }
          >
            <option value="">Tất cả trạng thái</option>
            <option value="UNSCHEDULED">Chưa lên lịch</option>
            <option value="scheduled">Đã lên lịch</option>
            <option value="identity_verified">Đã xác minh khách</option>
            <option value="contract_signed">Đã ký hợp đồng</option>
            <option value="payment_collected">Đã thu tiền</option>
            <option value="handover_pending_receipt">Đã bàn giao · chờ khách xác nhận</option>
            <option value="setup_in_progress">Khách đang chuẩn bị hàng</option>
            <option value="setup_completed">Chờ kiểm kê hàng hóa</option>
            <option value="RECOVERY_TRANSFERRED">Đã chuyển thu hồi</option>
            <option value="no_show">Khách không đến</option>
            <option value="completed">Đã hoàn tất kiểm kê</option>
            <option value="rejected">Từ chối nhận kho</option>
            <option value="cancelled">Đã hủy</option>
          </Select>
          <Input
            label="Lịch nhận từ ngày"
            type="date"
            className="h-12 !border-stone-200 !bg-white"
            value={scheduledFromInput}
            onChange={(event) => setScheduledFromInput(event.target.value)}
          />
          <Input
            label="Đến ngày"
            type="date"
            className="h-12 !border-stone-200 !bg-white"
            value={scheduledToInput}
            min={scheduledFromInput || undefined}
            onChange={(event) => setScheduledToInput(event.target.value)}
          />
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <Button className="h-12 flex-1 !bg-[#a64e00] !text-white hover:!bg-[#893f00] xl:flex-none" onClick={applyFilters}>
              Lọc
            </Button>
            <Button
              className="h-12 flex-1 !text-stone-600 xl:flex-none"
              variant="ghost"
              onClick={resetFilters}
            >
              Đặt lại
            </Button>
          </div>
        </div>
      </div>
      {error && !handoverTarget && !rejectTarget && !detailTarget && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {(["ONGOING", "PROCESSED"] as const).map(group => (
        <CheckInWorkList key={group + JSON.stringify(filters)} group={group} filters={filters}
          refreshKey={refreshKey} renderRow={renderRow} />
      ))}

      {/* One modal for both workflows. Rendering the same form through two separate modals
          unmounted and remounted ProcessingLeaseBoundary when switching modes, which released
          and re-acquired the lease and made the open case jump. */}
      <Modal
        open={Boolean(handoverTarget) && !rejectTarget}
        onClose={closeHandover}
        title={inventoryMode ? "Tiến trình kiểm kê hàng hóa" : "Bàn giao kho và đưa hàng vào"}
        titleAdornment={inventoryMode ? undefined : <HandoverWorkflowHelp />}
        size="3xl"
      >
        {workflowForm}
      </Modal>

      <Modal
        open={receiptNoticeOpen && handoverTarget?.checkInStatus === "handover_pending_receipt"}
        onClose={() => setReceiptNoticeOpen(false)}
        title="Đang chờ khách hàng xác nhận nhận kho"
        size="md"
      >
        {handoverTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Nhân viên đã xác nhận bàn giao kho trống</p>
              <p className="mt-2 leading-6">
                Đơn <b>{handoverTarget.reservationCode}</b> đang chờ khách hàng nhấn <b>“Xác nhận đã nhận kho”</b> trên cổng khách hàng.
                Chưa thể chuyển sang thời gian đưa hàng hóa vào hoặc kiểm kê hàng hóa ở bước này.
              </p>
              {handoverTarget.receiptConfirmationDueAt && <p className="mt-2 font-semibold">{receiptConfirmationState(handoverTarget, now).text} · Hạn xác nhận: {formatStaffDateTime(handoverTarget.receiptConfirmationDueAt)}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setReceiptNoticeOpen(false)} disabled={submitting}>
                Đóng thông báo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => {
          if (!submitting) {
            setError(null)
            setRejectTarget(null)
          }
        }}
        title="Từ chối nhận kho"
      >
        {rejectTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <b>{rejectTarget.reservationCode}</b> ·{" "}
              {rejectTarget.storageUnitCode} · {rejectTarget.customerName}
            </div>
            <Input
              label="Lý do từ chối"
              value={rejectReason}
              maxLength={1000}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <Select
              label="Xử lý gian kho sau khi từ chối"
              value={rejectDisposition}
              onChange={(event) =>
                setRejectDisposition(
                  event.target.value as "AVAILABLE" | "MAINTENANCE",
                )
              }
            >
              <option value="AVAILABLE">Trả về trạng thái sẵn sàng</option>
              <option value="MAINTENANCE">Chuyển sang bảo trì</option>
            </Select>
            <label className="block text-sm font-medium text-stone-700">
              Biên bản từ chối nhận kho (ảnh hoặc PDF)
              <input
                className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) =>
                  setRejectEvidenceFiles(Array.from(event.target.files || []))
                }
              />
              <span className="mt-1 block text-xs font-normal text-stone-500">
                Bắt buộc ít nhất một tệp để lưu vết quyết định.
              </span>
            </label>
            {rejectedIdentityDocument && rejectTarget.attendance?.termsVersion === HANDOVER_TERMS_VERSION && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              Xác nhận sẽ kết thúc đơn và khoản giữ chỗ của khách sẽ không được hoàn lại.
            </p>}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Từ chối sẽ kết thúc lệnh phân kho hiện hành. Chọn bảo trì nếu gian
              kho cần kiểm tra, vệ sinh hoặc sửa chữa. Hệ thống sẽ không trả
              gian kho về trạng thái sẵn sàng.
            </div>
            {error && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setError(null); setRejectTarget(null); }}>
                Đóng
              </Button>
              <Button
                variant="danger"
                disabled={
                  submitting ||
                  !staffCheckInActions(rejectTarget, now).canReject || !rejectReason.trim() ||
                  (!rejectEvidenceFiles.length &&
                    !rejectEvidenceReferences.length)
                }
                onClick={() => submitRejection()}
              >
                {submitting
                  ? "Đang tải bằng chứng và xử lý…"
                  : "Xác nhận từ chối"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Xem biên bản"
        size="xl"
      >
        {detailTarget && !detailTarget.handover && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{detailTarget.reservationCode} · {detailTarget.storageUnitCode}</p>
              <p>{parseEmptyStorageHandover(detailTarget.readinessNote).condition}</p>
              <p>{detailTarget.checkInStatus === "completed" ? "Biên bản chưa có dữ liệu chi tiết." : "Chưa kiểm kê"}</p>
            </div>
          </div>
        )}
        {detailTarget && <StaffRecordDocuments key={detailTarget.checkInId || detailTarget.reservationId}
          item={detailTarget} onPreview={assetId => void previewEvidenceFile(assetId)} onOpenReturns={onOpenReturns} />}
        <div className="mt-4 flex justify-end border-t border-stone-200 pt-4">
          <Button variant="outline" onClick={() => setDetailTarget(null)}>Đóng</Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(previewEvidence)}
        onClose={() => setPreviewEvidence(null)}
        title={previewEvidence?.fileName || "Xem trước bằng chứng"}
        size="xl"
      >
        {previewEvidence?.contentType.startsWith("image/")
          ? <img src={previewEvidence.url} alt={previewEvidence.fileName} className="max-h-[70vh] w-full object-contain" />
          : previewEvidence && <iframe title={previewEvidence.fileName} src={previewEvidence.url} className="h-[70vh] w-full" />}
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Xóa đơn bàn giao hoàn tất"
        size="md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold text-amber-900">Xác nhận xóa đơn (Soft Delete)</p>
              <p className="mt-2 leading-relaxed text-stone-700">
                Bạn có chắc chắn muốn xóa đơn bàn giao của khách hàng <b>{deleteTarget.customerName}</b> (Mã đơn: <b>{deleteTarget.reservationCode}</b> - Gian kho: <b>{deleteTarget.storageUnitCode}</b>) khỏi danh sách vận hành?
              </p>
              <p className="mt-2 text-xs text-amber-800">
                ℹ️ <b>Lưu ý:</b> Thao tác này sử dụng <b>Soft Delete</b> và ghi nhận lịch sử kiểm toán hệ thống. Dữ liệu không bị xóa vật lý khỏi cơ sở dữ liệu.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Hủy bỏ</Button>
              <Button
                variant="danger"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true)
                  try {
                    if (!deleteTarget.checkInId) {
                      setError("Không tìm thấy mã phiên nhận kho.")
                      return
                    }
                    await archiveCompletedCheckIn(deleteTarget.checkInId)
                    showToast(`Đã xóa đơn ${deleteTarget.reservationCode} (đã lưu trữ và ghi nhận lịch sử).`)
                    setDeleteTarget(null)
                    refresh()
                  } catch (err) {
                    setError(staffErrorMessage(err, "Không thể xóa đơn bàn giao."))
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? "Đang xử lý…" : "Xác nhận xóa đơn"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
