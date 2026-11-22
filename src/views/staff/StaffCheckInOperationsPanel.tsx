import { useEffect, useId, useMemo, useState } from "react"
import { isCheckInHandoverExpired, staffCheckInActions } from "../../domain/reservationCheckInPolicy"

import {
  completeCheckIn,
  completeCheckInSetup,
  confirmCheckInPayment,
  downloadCheckInEvidence,
  listCheckIns,
  markCheckInNoShow,
  recordCheckInRemainingPayment,
  rejectCheckIn,
  scheduleCheckIn,
  signCheckInContract,
  startCheckInSetup,
  uploadCheckInEvidence,
  verifyCheckInIdentity,
  checkInEvidenceAssetIds,
  type CheckInCase,
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
  formatStaffDateTime,
  parseEmptyStorageHandover,
  inventoryReportNote,
  staffCheckInStatusLabel,
  staffErrorMessage,
  staffStorageUnitStatusLabel,
} from "./staffPresentation"
import { FilePreviewList } from "./StaffFileUpload"

const checklistLabels: Array<[keyof CheckInChecklist, string]> = [
  ["identityVerified", "Đã đối chiếu giấy tờ tùy thân"],

  ["reservationMatched", "Khách hàng và đơn đặt kho đã được đối chiếu"],

  ["contractVerified", "Hợp đồng đã được ký và kiểm tra"],

  ["paymentVerified", "Các khoản cần thu trước bàn giao đã được xác nhận"],

  ["measurementVerified", "Đã đo và đối chiếu hàng hóa thực tế"],

  ["unitWalkthrough", "Đã bàn giao kho trống cho khách hàng"],

  ["conditionRecorded", "Đã ghi nhận tình trạng hàng hóa"],

  ["accessHandedOver", "Đã bàn giao mã truy cập, thẻ hoặc chìa khóa"],
]

const emptyChecklist = () =>
  Object.fromEntries(
    checklistLabels.map(([key]) => [key, false]),
  ) as unknown as CheckInChecklist

function normalizeIdentityDocument(value: string | null | undefined) {
  return value?.trim().replace(/[\s.-]/g, "").toUpperCase() || ""
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

type InventoryDraft = {
  quantity: string
  condition: CheckInInventoryLine["condition"] | ""
  note: string
  lengthCm: string
  widthCm: string
  heightCm: string
  weightKg: string
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
  const volume = quantity === 0 ? 0 : measured ? dimensions[0] * dimensions[1] * dimensions[2] * quantity / 1_000_000 : NaN
  const declaredVolume = declaredDimensions.every(value => value != null)
    ? Number(line.lengthCm) * Number(line.widthCm) * Number(line.heightCm) * line.quantity / 1_000_000
    : NaN
  const badges = [
    { label: "Số kiện", matches: Number.isInteger(quantity) ? quantity === line.quantity : null },
    { label: "Khối lượng", matches: measured && quantity > 0 && line.weightPerPackageKg != null
      ? !hasMaterialVariance(entry.weightKg, line.weightPerPackageKg * line.quantity, 0.1) : null },
    { label: "Thể tích", matches: quantity > 0 && Number.isFinite(volume) && Number.isFinite(declaredVolume)
      ? !hasMaterialVariance(String(volume), declaredVolume, 0.0001) : null },
    { label: "Kích thước", matches: measured && quantity > 0 ? dimensionsMatch(dimensions, declaredDimensions) : null },
  ]
  return { quantity, dimensions, weight, volume, measured, badges, needsNote: badges.some(badge => badge.matches === false) || entry.condition === "DAMAGED" }
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

type MeasurementComparisonKey = "packageCount" | "weight" | "volume" | "dimensions"

const emptyMeasurementChecks = (): Record<MeasurementComparisonKey, boolean> => ({
  packageCount: false,
  weight: false,
  volume: false,
  dimensions: false,
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
  return stepForCheckIn(item) <= 4 && isCheckInHandoverExpired(item.appointmentAt || item.scheduledAt, now)
}

const workflowStepLabels = [
  "Xác minh khách",
  "Ký hợp đồng",
  "Thu tiền",
  "Bàn giao kho",
  "Thời gian chuẩn bị",
  "Kiểm kê hàng",

]

type CheckInFilters = Pick<NonNullable<Parameters<typeof listCheckIns>[0]>, "q" | "status" | "scheduledFrom" | "scheduledTo">

const checkInTableColumnWidths = ["16%", "15%", "13%", "16%", "10%", "30%"] as const

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
    setResult(null)
    setError("")
    void listCheckIns({ ...filters, group, page, pageSize: 20 }).then(response => {
      if (!active) return
      if (page > 0 && page >= response.pagination.totalPages) {
        setPage(Math.max(0, response.pagination.totalPages - 1))
      } else {
        setResult(response)
      }
    }).catch(reason => {
      if (active) setError(staffErrorMessage(reason, "Không thể tải danh sách nhận kho."))
    })
    return () => { active = false }
  }, [filters, group, page, refreshKey])

  const { totalItems = 0, totalPages = 0 } = result?.pagination ?? {}
  const title = group === "ONGOING" ? "Đang diễn ra" : "Đã xử lý"
  return (
    <section aria-label={title}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          {result && <span className="text-xs text-stone-500">{totalItems} hồ sơ</span>}
        </div>
        {error ? <p role="alert" className="p-4 text-sm text-red-800">{error}</p>
          : !result ? <p className="py-8 text-center text-sm text-stone-500">Đang tải hồ sơ…</p>
          : result.data.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              {group === "ONGOING" ? "Không có đơn đang diễn ra phù hợp." : "Không có đơn đã xử lý phù hợp."}
            </p>
          ) : (
            <Table tableClassName="min-w-[1420px] table-fixed">
              <CheckInTableColumns />
              <Thead>
                <Tr>
                  <Th>Đơn đặt giữ kho</Th>
                  <Th>Khách hàng</Th>
                  <Th>Gian kho</Th>
                  <Th>
                    <span className="inline-flex items-center gap-1">
                      Lịch nhận
                      <AppointmentScheduleHelp />
                    </span>
                  </Th>
                  <Th>Trạng thái</Th>
                  <Th className="text-right">Thao tác</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.map(item => renderRow(item, group))}
              </Tbody>
            </Table>
          )}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4 text-sm text-stone-500">
            <span>
              {totalItems} hồ sơ · Trang {page + 1}/{totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </Button>
          </div>
        )}
      </Card>
    </section>
  )
}

export default function StaffCheckInOperationsPanel({
  showToast,
}: {
  showToast: (message: string) => void
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

  const [customerWaitTarget, setCustomerWaitTarget] = useState<"receipt" | "preparation" | null>(null)

  const [handoverStep, setHandoverStep] = useState(1)

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

  const [identityDocumentNumber, setIdentityDocumentNumber] = useState("")

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

  const [goodsCategory, setGoodsCategory] = useState("Hàng hóa đã khai báo")

  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])

  const [contractFile, setContractFile] = useState<File | null>(null)
  const [confirmedSetupTerms, setConfirmedSetupTerms] = useState<string | null>(null)
  const setupTermsKey = handoverTarget?.setupEarlyExitPolicyVersion
    ? JSON.stringify([handoverTarget.checkInId, handoverTarget.setupEarlyExitPolicyVersion, handoverTarget.setupEarlyExitFee])
    : null

  const [paymentEvidenceFile, setPaymentEvidenceFile] = useState<File | null>(null)

  const [evidenceReferences, setEvidenceReferences] = useState<string[]>([])

  const [handedOverItems, setHandedOverItems] = useState(
    "Biên nhận bàn giao",
  )

  const [handoverNotes, setHandoverNotes] = useState("")

  const [keyLockReference, setKeyLockReference] = useState("")

  const [paymentMethod, setPaymentMethod] = useState("CASH")

  const [noShowTarget, setNoShowTarget] = useState<CheckInCase | null>(null)

  const [noShowReason, setNoShowReason] = useState("")

  const [rejectTarget, setRejectTarget] = useState<CheckInCase | null>(null)

  const [rejectReason, setRejectReason] = useState("")

  const [rejectDisposition, setRejectDisposition] =
    useState<"AVAILABLE" | "MAINTENANCE">("AVAILABLE")

  const [rejectEvidenceFiles, setRejectEvidenceFiles] = useState<File[]>([])

  const [rejectEvidenceReferences, setRejectEvidenceReferences] =
    useState<string[]>([])

  const [detailTarget, setDetailTarget] = useState<CheckInCase | null>(null)

  const [downloadingEvidence, setDownloadingEvidence] = useState<string | null>(
    null,
  )

  const [previewEvidence, setPreviewEvidence] = useState<{
    url: string
    contentType: string
    fileName: string
  } | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [showCustomerReadyModal, setShowCustomerReadyModal] = useState(false)

  useEffect(() => {
    const refreshCheckIns = () => setRefreshKey((value) => value + 1)
    window.addEventListener("storagehub:checkins-refresh", refreshCheckIns)
    return () => {
      window.removeEventListener("storagehub:checkins-refresh", refreshCheckIns)
    }
  }, [])

  const declaredLines = handoverTarget?.declaredGoodsLines ?? []
  const lineInventory = declaredLines.length > 0 && (
    handoverTarget?.checkInStatus !== "completed" || Boolean(handoverTarget.handover?.inventoryLines?.some(line => line.measurements))
  )
  const inventoryRows = declaredLines.map(line => {
    const entry = inventoryDraft[line.id] ?? (
      handoverTarget?.checkInStatus === "completed" ? emptyInventory : inventoryFromDeclaration(line)
    )
    return { line, entry, comparison: compareInventory(line, entry) }
  })
  const inventoryLinesComplete = inventoryRows.every(({ entry, comparison }) => {
    const { quantity, measured, needsNote } = comparison
    return entry.checked && Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647
      && Boolean(entry.condition) && (quantity === 0 ? entry.condition === "NOT_PRESENT" : measured && Number.isFinite(comparison.volume) && entry.condition !== "NOT_PRESENT")
      && (!needsNote || Boolean(entry.note.trim()))
  })
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
  const measurementVariance = lineInventory
    ? inventoryRows.some(({ comparison }) => comparison.badges.some(badge => badge.matches === false))
      || (inventoryLinesComplete && packageCountValid && (totalPackages !== handoverTarget?.declaredPackageCount
        || hasMaterialVariance(String(actualWeight), handoverTarget?.declaredGoodsWeightKg ?? NaN, 0.1)
        || hasMaterialVariance(String(actualVolume), handoverTarget?.declaredGoodsVolumeM3 ?? NaN, 0.0001)
        || dimensionsMatch([actualDimensions[0], actualDimensions[1], actualDimensions[2]], [
          handoverTarget?.declaredGoodsLengthCm ?? null, handoverTarget?.declaredGoodsWidthCm ?? null, handoverTarget?.declaredGoodsHeightCm ?? null,
        ]) === false))
    : checkInComparison?.hasVariance ?? false
  const hasEmptyStorageEvidence = evidenceFiles.length > 0 || evidenceReferences.length > 0
  const emptyStorageHandoverReady = Boolean(keyLockReference.trim() && initialCondition.trim() && hasEmptyStorageEvidence)

  const workflowCurrentStep = handoverTarget ? stepForCheckIn(handoverTarget) : 1
  const handoverDeadlinePassed = handoverTarget ? handoverExpired(handoverTarget, now) : false
  const isReviewingCompletedStep = Boolean(
    handoverTarget &&
      (handoverTarget.checkInStatus === "completed" || handoverStep < workflowCurrentStep ||
        (handoverStep === 4 && ["handover_pending_receipt", "setup_in_progress", "setup_completed", "completed"].includes(handoverTarget.checkInStatus || ""))),
  )

  const declaredIdentityDocument = handoverTarget?.identityDocumentNumber?.trim() || ""
  const identityVerificationBlocked = !normalizeIdentityDocument(identityDocumentNumber)
  const identityMismatch = Boolean(
    declaredIdentityDocument &&
      identityDocumentNumber.trim() &&
      normalizeIdentityDocument(declaredIdentityDocument) !==
        normalizeIdentityDocument(identityDocumentNumber),
  )

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
      setHandoverStep(stepForCheckIn(latest))
      if (latest.checkInStatus === "handover_pending_receipt") setCustomerWaitTarget("receipt")
      else if (latest.checkInStatus === "setup_in_progress") setCustomerWaitTarget("preparation")
      else setCustomerWaitTarget(null)
    } catch (reason) {
      fail(reason, "Không thể cập nhật trạng thái bàn giao.")
    }
  }

  useEffect(() => {
    if (!customerWaitTarget || !handoverTarget?.checkInId) return

    let active = true
    const pollCustomerReceipt = async () => {
      try {
        const response = await listCheckIns({
          page: 0,
          pageSize: 100,
          q: handoverTarget.reservationCode,
        })
        const latest = response.data.find((item) => item.checkInId === handoverTarget.checkInId)
        if (!active || !latest) return

        setHandoverTarget(latest)
        setHandoverStep(stepForCheckIn(latest))
        if (latest.checkInStatus === "handover_pending_receipt") {
          setCustomerWaitTarget("receipt")
        } else if (latest.checkInStatus === "setup_in_progress") {
          if (customerWaitTarget === "receipt") {
            showToast("Khách hàng đã xác nhận sẵn sàng bàn giao. Đang chờ khách chuẩn bị hàng để kiểm kê.")
          }
          setCustomerWaitTarget("preparation")
        } else {
          if (customerWaitTarget === "preparation" && latest.checkInStatus === "setup_completed") {
            showToast("Khách hàng đã báo sẵn sàng kiểm kê. Bước kiểm kê hàng hóa đã được mở.")
          }
          setCustomerWaitTarget(null)
        }
      } catch {
        // Keep the waiting popup open. The next poll can recover from a temporary read error.
      }
    }

    const timer = window.setInterval(() => void pollCustomerReceipt(), 3000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [customerWaitTarget, handoverTarget?.checkInId, handoverTarget?.reservationCode, showToast])

  const closeHandover = () => {
    if (submitting) return
    setError(null)
    setFieldErrors({})
    setCustomerWaitTarget(null)
    setShowCustomerReadyModal(false)
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
    setFieldErrors({})
    setError(null)

    const errors: Record<string, string> = {}
    if (lineInventory) {
      for (const { line, entry, comparison } of inventoryRows) {
        const field = `inventory-${line.id}`
        const { quantity, measured, needsNote } = comparison
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) {
          errors[`${field}-quantity`] = "Nhập số kiện nguyên từ 0 trở lên"
        }
        if (quantity > 0 && (!measured || !Number.isFinite(comparison.volume))) {
          errors[`${field}-measurements`] = "Nhập đủ kích thước và khối lượng thực tế của dòng hàng"
        }
        if (!entry.condition || (quantity === 0) !== (entry.condition === "NOT_PRESENT")) {
          errors[`${field}-condition`] = "Chọn tình trạng phù hợp với số kiện thực tế"
        }
        if (needsNote && !entry.note.trim()) {
          errors[`${field}-note`] = "Ghi chú lý do chênh lệch hoặc hư hỏng"
        }
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
    if (!goodsCategory.trim()) errors.goodsCategory = "Vui lòng nhập loại hàng"
    if (!initialCondition.trim()) errors.initialCondition = "Cần ghi nhận hiện trạng kho ở bước bàn giao"
    if (!keyLockReference.trim()) errors.lockReference = "Cần ghi nhận mã ổ khóa hoặc chìa khóa ở bước bàn giao"
    if ((!lineInventory || inventoryLinesComplete) && !allChecksComplete && !Object.keys(errors).length) {
      errors.handoverChecklist = "Cần hoàn tất các bước xác nhận trước khi kiểm kê"
    }
    if (measurementVariance) {
      if (!varianceAccepted) {
        errors.varianceAccepted = "Cần trao đổi với khách và đánh dấu chấp nhận chênh lệch"
      }
      if (!varianceReason.trim()) {
        errors.varianceReason = "Vui lòng nhập lý do chênh lệch khi hàng hóa khác đơn đặt"
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
      errors.identityDocumentNumber = "Số CCCD/CMND không được để trống"
    } else if (!/^(?:\d{9}|\d{12})$/.test(providedIdentity)) {
      errors.identityDocumentNumber = "CCCD/CMND phải gồm đúng 9 hoặc 12 chữ số"
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError("Một số trường thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu đỏ bên dưới.")
      return
    }

    if (!handoverTarget?.checkInId) return

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
        )

        uploadedEvidence.push(asset.id)
      }

      if (evidenceFiles.length) {
        setEvidenceReferences(uploadedEvidence)

        setEvidenceFiles([])
      }

      await completeCheckIn(handoverTarget.checkInId, {
        checklist: lineInventory ? { ...checklist, measurementVerified: true, conditionRecorded: true } : checklist,

        identityDocumentNumber: identityDocumentNumber.trim(),

        identityVerificationNote: verificationNotes.trim() || null,

        actualMeasurements: {
          lengthCm: lineInventory ? actualDimensions[0] : Number(lengthCm),

          widthCm: lineInventory ? actualDimensions[1] : Number(widthCm),

          heightCm: lineInventory ? actualDimensions[2] : Number(heightCm),

          weightKg: lineInventory ? actualWeight : Number(weightKg),

          actualVolumeM3: lineInventory ? actualVolume : Number(volumeM3),

          varianceAccepted: measurementVariance && varianceAccepted,
        },

        varianceReason: measurementVariance ? varianceReason.trim() : null,

        initialUnitCondition: initialCondition.trim(),

        goodsCondition: lineInventory ? "Đã ghi nhận tình trạng theo từng dòng hàng" : goodsCondition.trim(),

        packageCount: totalPackages,
        inventoryLines: lineInventory ? inventoryRows.map(({ line, entry, comparison }) => ({
          goodsItemId: line.id,
          actualQuantity: comparison.quantity,
          condition: entry.condition as CheckInInventoryLine["condition"],
          note: entry.note.trim() || null,
          measurements: comparison.quantity > 0 ? {
            lengthCm: comparison.dimensions[0],
            widthCm: comparison.dimensions[1],
            heightCm: comparison.dimensions[2],
            weightKg: comparison.weight,
          } : null,
        })) : [],

        goodsCategory: goodsCategory.trim(),

        evidenceReferences: uploadedEvidence,

        handedOverItems: [
          ...handedOverItems.split(",").map((value) => value.trim()).filter(Boolean),
          `Ổ khóa ${keyLockReference.trim()}`,
        ],

        notes: handoverNotes.trim() ? `Ghi chú kiểm kê: ${handoverNotes.trim()}` : "",
        lockReference: keyLockReference.trim(),
      })

      setContractFile(null)
      setConfirmedSetupTerms(null)

      setPaymentEvidenceFile(null)

      showToast(
        `Đã hoàn tất bàn giao ${handoverTarget.storageUnitCode}. Hồ sơ vẫn được lưu trong Nhận kho & bàn giao để xem lại.`,
      )

      setCustomerWaitTarget(null)
      setHandoverTarget(null)

      refresh()
    } catch (reason) {
      fail(reason, "Không thể hoàn tất bàn giao.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitWorkflowStep = async () => {
    if (!handoverTarget?.checkInId) return
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
        if (!normalized || !/^(?:\d{9}|\d{12})$/.test(normalized)) {
          setFieldErrors({ identityDocumentNumber: "CCCD/CMND phải gồm đúng 9 hoặc 12 chữ số." })
          setError("Số CCCD/CMND trên giấy tờ gốc không hợp lệ. Vui lòng nhập đúng 9 hoặc 12 chữ số.")
          setSubmitting(false)
          return
        }
        updated = await verifyCheckInIdentity(handoverTarget.checkInId, {
          identityDocumentNumber: identityDocumentNumber.trim(),
          note: verificationNotes.trim() || undefined,
        })
        setChecklist((current) => ({ ...current, identityVerified: true, reservationMatched: true }))
      } else if (handoverStep === 2) {
        if (!contractFile) return
        if (setupTermsKey && (confirmedSetupTerms !== setupTermsKey || handoverTarget.setupEarlyExitFee == null)) {
          throw new Error('Cần đối chiếu điều khoản phí trả kho trong thời gian chuẩn bị trong hợp đồng đã ký trước khi tiếp tục.')
        }
        const asset = await uploadCheckInEvidence(handoverTarget.checkInId, contractFile)
        updated = await signCheckInContract(handoverTarget.checkInId, asset.id, handoverTarget.setupEarlyExitPolicyVersion)
        setChecklist((current) => ({ ...current, contractVerified: true }))
      } else if (handoverStep === 3) {
        const due = handoverTarget.dueAtCheckIn ?? 0
        if (due > 0) {
          if (!paymentEvidenceFile) return
          const asset = await uploadCheckInEvidence(handoverTarget.checkInId, paymentEvidenceFile)
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
        if (/\b(pin|password|mật khẩu|mat khau)\b/i.test(keyLockReference)) {
          throw new Error("Không nhập mật khẩu hoặc mã PIN vào ô Mã ổ khóa / Chìa khóa.")
        }
        if (!emptyStorageHandoverReady) {
          throw new Error("Cần nhập mã ổ khóa, ghi nhận hiện trạng và chọn ít nhất một ảnh hoặc PDF bằng chứng kho trống.")
        }
        const emptyStorageEvidence = checkInEvidenceAssetIds(evidenceReferences)
        for (const file of evidenceFiles) {
          const asset = await uploadCheckInEvidence(handoverTarget.checkInId, file)
          emptyStorageEvidence.push(asset.id)
        }
        setEvidenceReferences(emptyStorageEvidence)
        setEvidenceFiles([])
        updated = await startCheckInSetup(handoverTarget.checkInId, {
          lockReference: keyLockReference.trim(),
          note: "Bàn giao kho trống để khách chuẩn bị hàng",
          initialUnitCondition: initialCondition.trim(),
          evidenceReferences: emptyStorageEvidence,
        })
        setChecklist((current) => ({ ...current, accessHandedOver: true, unitWalkthrough: true }))
        if (updated.checkInStatus === "handover_pending_receipt") {
          setCustomerWaitTarget("receipt")
        }
      } else if (handoverStep === 5) {
        if (handoverTarget.checkInStatus === "handover_pending_receipt") {
          setCustomerWaitTarget("receipt")
          throw new Error("Đang chờ khách hàng xác nhận nhận kho trên cổng khách hàng.")
        }
        updated = await completeCheckInSetup(
          handoverTarget.checkInId,
          "Nhân viên xác nhận khách hàng đã sẵn sàng bàn giao để kiểm kê hàng hóa",
        )
      }
      if (updated) {
        setHandoverTarget(updated)
        setHandoverStep(stepForCheckIn(updated))
      } else {
        setHandoverStep((current) => Math.min(6, current + 1))
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
        const asset = await uploadCheckInEvidence(rejectTarget.checkInId, file)

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
      })

      showToast(
        rejectDisposition === "MAINTENANCE"
          ? `Đã từ chối nhận kho và chuyển ${rejectTarget.storageUnitCode} sang bảo trì.`
          : `Đã từ chối nhận kho và trả ${rejectTarget.storageUnitCode} về trạng thái sẵn sàng.`,
      )

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

  const previewEvidenceFile = async (assetId: string) => {
    setDownloadingEvidence(assetId)

    try {
      const result = await downloadCheckInEvidence(assetId)

      const url = URL.createObjectURL(result.blob)

      setPreviewEvidence((previous) => {
        if (previous) URL.revokeObjectURL(previous.url)
        return {
          url,
          contentType: result.contentType,
          fileName: result.fileName || `bang-chung-nhan-kho-${assetId}`,
        }
      })
    } catch (reason) {
      fail(reason, "Không thể xem trước bằng chứng bàn giao.")
    } finally {
      setDownloadingEvidence(null)
    }
  }

  const submitNoShow = async () => {
    if (!noShowTarget?.checkInId || !noShowReason.trim() || !staffCheckInActions(noShowTarget).canMarkAbsent) return

    setSubmitting(true)

    try {
      await markCheckInNoShow(noShowTarget.checkInId, noShowReason.trim())

      showToast(
        `Đã đánh dấu khách không đến cho ${noShowTarget.reservationCode}.`,
      )

      setNoShowTarget(null)

      refresh()
    } catch (reason) {
      fail(reason, "Không thể đánh dấu khách không đến.")
    } finally {
      setSubmitting(false)
    }
  }

  const openHandover = (item: CheckInCase) => {
    setError(null)
    setFieldErrors({})
    setHandoverTarget(item)
    setCustomerWaitTarget(
      item.checkInStatus === "handover_pending_receipt"
        ? "receipt"
        : item.checkInStatus === "setup_in_progress"
          ? "preparation"
          : null,
    )

    setHandoverStep(stepForCheckIn(item))
    setHandoverNotes(inventoryReportNote(item.handover?.notes, item.handover?.identityVerificationNote))

    const restoredChecklist = item.handover?.checklist ?? emptyChecklist()
    setChecklist({
      ...restoredChecklist,
      identityVerified: Boolean(item.identityVerifiedAt) || restoredChecklist.identityVerified,
      reservationMatched: Boolean(item.identityVerifiedAt) || restoredChecklist.reservationMatched,
      contractVerified: Boolean(item.contractSignedAt) || restoredChecklist.contractVerified,
      paymentVerified: Boolean(item.paymentCollectedAt) || restoredChecklist.paymentVerified,
      accessHandedOver: Boolean(item.setupStartedAt) || restoredChecklist.accessHandedOver,
      unitWalkthrough: Boolean(item.setupStartedAt) || restoredChecklist.unitWalkthrough,
    })

    setIdentityDocumentNumber(item.identityDocumentNumber || "")

    setVerificationNotes("")

    setEvidenceFiles([])

    setContractFile(null)
    setConfirmedSetupTerms(null)

    setPaymentEvidenceFile(null)

    const emptyStorageHandover = parseEmptyStorageHandover(item.readinessNote)
    setInitialCondition(emptyStorageHandover.condition || "Gian kho sạch, khóa và đèn hoạt động bình thường")
    setEvidenceReferences(Array.from(new Set([
      ...emptyStorageHandover.evidenceReferences,
      ...(item.handover?.evidenceReferences ?? []),
    ])))

    setKeyLockReference(item.lockReference || "")

    setPaymentMethod("CASH")

    setHandedOverItems("Biên nhận bàn giao")

    setLengthCm(formatInputNumber(item.declaredGoodsLengthCm))

    setWidthCm(formatInputNumber(item.declaredGoodsWidthCm))

    setHeightCm(formatInputNumber(item.declaredGoodsHeightCm))

    setWeightKg(formatInputNumber(item.declaredGoodsWeightKg))

    setVolumeM3(formatInputNumber(item.declaredGoodsVolumeM3))

    const savedLines = item.handover?.inventoryLines ?? []
    setInventoryDraft(Object.fromEntries(savedLines.map(line => [line.goodsItemId, {
      quantity: String(line.actualQuantity), condition: line.condition, note: line.note ?? "",
      lengthCm: formatInputNumber(line.measurements?.lengthCm),
      widthCm: formatInputNumber(line.measurements?.widthCm),
      heightCm: formatInputNumber(line.measurements?.heightCm),
      weightKg: formatInputNumber(line.measurements?.weightKg),
      checked: true,
    }])))
    setPackageCount(String(item.handover?.packageCount ?? (item.declaredGoodsLines?.length ? 0 : item.declaredPackageCount ?? 1)))

    setMeasurementChecks(emptyMeasurementChecks())

    setVarianceAccepted(false)

    setVarianceReason("")
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

  const openRejection = (item: CheckInCase) => {
    setRejectTarget(item)

    setRejectReason("")

    setRejectDisposition("AVAILABLE")

    setRejectEvidenceFiles([])

    setRejectEvidenceReferences([])
  }

  const renderRow = (item: CheckInCase, group: CheckInGroup) => {
    const actions = staffCheckInActions(item, now)
    return (
    <Tr key={item.reservationId}>
      <Td>
        <b className="font-mono">{item.reservationCode}</b>
        <p className="mt-1 text-xs text-stone-500">
          {item.facilityName}
        </p>
      </Td>
      <Td>
        <b>{item.customerName}</b>
        <p className="mt-1 text-xs text-stone-500">
          {item.customerEmail}
        </p>
      </Td>
      <Td>
        <b className="font-mono">{item.storageUnitCode}</b>
        <p className="mt-1 text-xs text-stone-500">
          {staffStorageUnitStatusLabel(item.storageUnitStatus)}
        </p>
      </Td>
      <Td>
        <span>{formatStaffDateTime(item.appointmentAt || item.scheduledAt)}</span>
        {group === "ONGOING" && stepForCheckIn(item) <= 4 && (item.appointmentAt || item.scheduledAt) && handoverExpired(item, now) && (
          <p className="mt-1 text-[11px] font-medium text-red-700">Đã hết hạn nhận kho</p>
        )}
      </Td>
      <Td>
        <Badge
          variant={
            item.checkInStatus === "completed"
              ? "success"
              : item.checkInStatus === "no_show" ||
                  item.checkInStatus === "rejected"
                ? "error"
                : item.checkInStatus === "scheduled"
                  ? "info"
                  : "warning"
          }
        >
          {staffCheckInStatusLabel(
            item.checkInStatus,
            item.reservationStatus,
          )}
        </Badge>
      </Td>
      <Td className="min-w-[320px] whitespace-nowrap text-right">
        <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
          {group === "ONGOING" && item.checkInStatus !== "completed" && (
            <>
              <Button
                className="shrink-0 whitespace-nowrap !px-2 !py-1 !text-[11px]"
                size="sm"
                disabled={submitting || !actions.canOpen}
                onClick={() => beginHandover(item)}
              >
                {actions.label}
              </Button>
              <Button
                className="shrink-0 whitespace-nowrap !px-2 !py-1 !text-[11px]"
                size="sm"
                variant="danger"
                disabled={submitting || !actions.canReject}
                onClick={() => openRejection(item)}
              >
                Từ chối nhận kho
              </Button>
              <Button
                className="shrink-0 whitespace-nowrap !px-2 !py-1 !text-[11px]"
                size="sm"
                variant="danger"
                disabled={submitting || !actions.canMarkAbsent}
                onClick={() => {
                  setNoShowTarget(item)
                  setNoShowReason("")
                }}
              >
                Khách không đến
              </Button>
            </>
          )}
          {["handover_pending_receipt", "setup_in_progress", "setup_completed"].includes(item.checkInStatus || "") && (
            <Button size="sm" variant="outline" onClick={() => setDetailTarget(item)}>Xem biên bản</Button>
          )}
          {item.checkInStatus === "completed" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openHandover(item)}
              >
                Xem lại các bước
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDetailTarget(item)}
              >
                Xem biên bản
              </Button>
            </>
          )}
          {group === "PROCESSED" && item.checkInStatus !== "completed" && (
            <span className="max-w-60 whitespace-normal text-xs text-stone-600">{item.rejectionReason || staffCheckInStatusLabel(item.checkInStatus, item.reservationStatus)}</span>
          )}
        </div>
      </Td>
    </Tr>
    )
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        title="Nhận kho & bàn giao"
        subtitle="Xác minh, ký hợp đồng, thu tiền và ghi nhận bàn giao kho trống. Nhân viên kiểm kê sau khi khách báo đã chuẩn bị hàng xong."
      />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.7fr)_minmax(180px,1fr)_minmax(150px,.8fr)_minmax(150px,.8fr)_auto] xl:items-end">
          <Input
            label="Tìm kiếm"
            value={queryInput}
            placeholder="Mã đơn, khách hàng, thư điện tử hoặc mã kho"
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters()
              }
            }}
          />
          <Select
            label="Trạng thái"
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
            <option value="no_show">Khách không đến</option>
            <option value="completed">Đã hoàn tất kiểm kê</option>
            <option value="rejected">Từ chối nhận kho</option>
            <option value="cancelled">Đã hủy</option>
          </Select>
          <Input
            label="Lịch nhận từ ngày"
            type="date"
            value={scheduledFromInput}
            onChange={(event) => setScheduledFromInput(event.target.value)}
          />
          <Input
            label="Đến ngày"
            type="date"
            value={scheduledToInput}
            min={scheduledFromInput || undefined}
            onChange={(event) => setScheduledToInput(event.target.value)}
          />
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <Button className="flex-1 xl:flex-none" onClick={applyFilters}>
              Lọc
            </Button>
            <Button
              className="flex-1 xl:flex-none"
              variant="outline"
              onClick={resetFilters}
            >
              Đặt lại
            </Button>
          </div>
        </div>
      </Card>
      {error && !handoverTarget && !rejectTarget && !noShowTarget && !detailTarget && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {(["ONGOING", "PROCESSED"] as const).map(group => (
        <CheckInWorkList key={group + JSON.stringify(filters)} group={group} filters={filters}
          refreshKey={refreshKey} renderRow={renderRow} />
      ))}

      <Modal
        open={Boolean(handoverTarget)}
        onClose={closeHandover}
        title="Quy trình bàn giao, chuẩn bị và kiểm kê"
        titleAdornment={<HandoverWorkflowHelp />}
        size="3xl"
      >
        {handoverTarget && (
          <div className="space-y-5">
            <dl className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Mã đơn giữ kho', handoverTarget.reservationCode], ['Mã gian kho bàn giao', handoverTarget.storageUnitCode],
                ['Khách hàng nhận kho', handoverTarget.customerName], ['Tên cơ sở', handoverTarget.facilityName || 'StorageHub'],
              ].map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-words font-semibold text-stone-900">{value || 'Chưa cập nhật'}</dd></div>)}
            </dl>
            {handoverDeadlinePassed && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">{handoverDeadlineMessage}</p>}
            {error && (
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
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Tiến độ nhận kho">
              {workflowStepLabels.map((label, index) => {
                const step = index + 1
                return (
                  <div
                    key={label}
                    aria-current={handoverStep === step ? "step" : undefined}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition select-none cursor-default ${
                    handoverStep === step
                      ? "border-amber-500 bg-amber-50 font-semibold text-amber-950"
                      : workflowCurrentStep >= step
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 bg-stone-50 text-stone-500 opacity-70"
                    }`}
                  >
                    <span className="mr-1 font-bold">{step}.</span>{label}
                  </div>
                )
              })}
            </div>

            {handoverStep === 1 && (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-lg border border-stone-200 p-4 text-sm md:grid-cols-3">
                  <div><span className="text-stone-500">Khách hàng</span><p className="font-semibold">{handoverTarget.customerName}</p></div>
                  <div>
                    <span className="text-stone-500">CCCD/CMND đã khai báo</span>
                    <p className="font-semibold">{declaredIdentityDocument || "Chưa có dữ liệu"}</p>
                    {identityMismatch && !isReviewingCompletedStep && (
                      <button
                        type="button"
                        onClick={() => {
                          clearFieldError("identityDocumentNumber")
                          setIdentityDocumentNumber(declaredIdentityDocument)
                        }}
                        className="mt-1 text-xs text-amber-700 hover:text-amber-800 underline"
                      >
                        Khôi phục số đã khai báo
                      </button>
                    )}
                  </div>
                  <Input
                    label="CCCD/CMND trên giấy tờ gốc *"
                    error={fieldErrors.identityDocumentNumber}
                    value={identityDocumentNumber}
                    disabled={isReviewingCompletedStep}
                    onChange={(event) => {
                      clearFieldError("identityDocumentNumber")
                      setIdentityDocumentNumber(event.target.value)
                    }}
                  />
                </div>
                {identityMismatch && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-semibold flex items-center gap-1.5">
                      <span>⚠️</span> Số giấy tờ gốc khác với thông tin đã khai báo ban đầu ({declaredIdentityDocument || "chưa khai báo"}).
                    </p>
                    <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                      Nhân viên đã đối chiếu giấy tờ gốc thực tế. Khi bấm <b>Xác nhận và tiếp tục</b>, hệ thống sẽ tự động cập nhật số CCCD/CMND mới ({identityDocumentNumber.trim()}) vào hồ sơ đơn hàng và lưu lịch sử xác minh.
                    </p>
                  </div>
                )}
                <div className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm sm:grid-cols-2">
                  <label className="flex items-center gap-2"><input type="checkbox" disabled={isReviewingCompletedStep} checked={checklist.identityVerified && checklist.reservationMatched} onChange={(event) => setChecklist((value) => ({ ...value, identityVerified: event.target.checked, reservationMatched: event.target.checked }))} />Đã kiểm tra giấy tờ gốc và đối chiếu khách hàng với đơn đặt kho *</label>
                </div>
                <Input label="Ghi chú xác minh" value={verificationNotes || handoverTarget.identityVerificationNote || ""} disabled={isReviewingCompletedStep} maxLength={1000} onChange={(event) => setVerificationNotes(event.target.value)} />
              </div>
            )}

            {handoverStep === 2 && (
              <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div><p className="font-semibold text-blue-950">Ký và lưu hợp đồng</p><p className="text-sm text-blue-800">Tệp hợp đồng được lưu vào đúng hồ sơ bàn giao.</p></div>
                {handoverTarget.contractEvidenceReference && isReviewingCompletedStep ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    Hợp đồng đã ký được lưu. Mã bằng chứng: <b className="font-mono">{handoverTarget.contractEvidenceReference}</b>
                  </div>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-stone-700">Hợp đồng đã ký (PDF hoặc ảnh, tối đa 25MB) *<input disabled={submitting || isReviewingCompletedStep} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => {
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
                            : <>Nếu khách trả kho trong thời gian chuẩn bị, khoản phí áp dụng một lần là <strong>{handoverTarget.setupEarlyExitFee.toLocaleString('vi-VN')} đồng</strong>.</>}
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
                    <Select label="Phương thức thanh toán" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></Select>
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
                ) : <p className="text-sm">{isReviewingCompletedStep ? `Đã ghi nhận lúc ${formatStaffDateTime(handoverTarget.paymentCollectedAt)}.` : "Đơn không còn khoản phải thu. Xác nhận để chuyển sang bàn giao kho."}</p>}
                {!isReviewingCompletedStep && <FilePreviewList files={paymentEvidenceFile ? [paymentEvidenceFile] : []} onRemove={() => setPaymentEvidenceFile(null)} disabled={submitting} />}
              </div>
            )}

            {handoverStep === 4 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-amber-950">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
                    <div>
                      <p className="text-base font-bold text-amber-950">Bàn giao gian kho trống & Kích hoạt quyền ra vào</p>
                      <p className="text-xs text-amber-800 mt-0.5">Tiến hành dẫn khách kiểm tra kho thực tế, bàn giao mã mở khóa và xác nhận hiện trạng ban đầu.</p>
                    </div>
                    <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900">
                      Bước 4/6
                    </span>
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
                      <Input
                        label="Mã ổ khóa / Chìa khóa *"
                        error={fieldErrors.keyLockReference || fieldErrors.lockReference}
                        value={keyLockReference}
                        disabled={isReviewingCompletedStep}
                        onChange={(event) => {
                          clearFieldError("keyLockReference")
                          clearFieldError("lockReference")
                          setKeyLockReference(event.target.value)
                        }}
                        placeholder="Ví dụ: LOCK-018 hoặc KEY-A04"
                      />
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
                  </div>

                  <div className="space-y-2.5 border-t border-stone-100 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-700">2. Danh mục kiểm tra bàn giao (Checklist)</p>
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

                {(!isReviewingCompletedStep || evidenceReferences.length > 0) && <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
                  {!isReviewingCompletedStep && (
                    <>
                      <label className="block text-sm font-semibold text-stone-800">
                        Ảnh hoặc PDF bằng chứng kho trống *
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                          disabled={submitting}
                          onChange={(event) => {
                            const selected = Array.from(event.target.files ?? [])
                            if (selected.some(file => !validateUploadFile(file, "bàn giao", setError))) {
                              event.target.value = ""
                              return
                            }
                            setEvidenceFiles(selected)
                          }}
                        />
                      </label>
                      <p className="text-xs text-stone-600">Chọn ít nhất một tệp ghi nhận hiện trạng kho trước khi khách chuyển hàng vào. Tối đa 25 MB mỗi tệp.</p>
                      <FilePreviewList
                        files={evidenceFiles}
                        onRemove={index => setEvidenceFiles(files => files.filter((_, current) => current !== index))}
                        disabled={submitting}
                      />
                      {!hasEmptyStorageEvidence && <p className="text-xs font-medium text-amber-800">Chọn tệp bằng chứng để có thể xác nhận bàn giao.</p>}
                      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    </>
                  )}
                  {evidenceReferences.length > 0 && <p className="text-xs text-stone-600">Đã tải lên {evidenceReferences.length} tệp bằng chứng.</p>}
                </div>}

                {handoverTarget.lockReference && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <div className="flex items-center justify-between">
                      <b>Mã ổ khóa đã bàn giao cho khách hàng</b>
                      <span className="font-mono font-bold bg-white px-2.5 py-1 rounded border border-emerald-300 text-emerald-950">
                        {handoverTarget.lockReference}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-800">
                      Bàn giao lúc: {formatStaffDateTime(handoverTarget.setupStartedAt)}. Khách hàng có {handoverTarget.freeSetupDays} ngày để chuyển đồ và chuẩn bị trước khi tính cước hợp đồng.
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
                      <p className="font-bold text-base">Đang chờ khách hàng sẵn sàng bàn giao</p>
                      <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900">Chờ khách xác nhận</span>
                    </div>
                    <p className="mt-3 text-sm">Vui lòng chờ khách hàng nhấn <b>“Sẵn sàng bàn giao”</b>. Hệ thống sẽ tự cập nhật bước tiếp theo.</p>
                  </div>
                ) : (
                  <>
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/60 pb-3">
                    <div>
                      <p className="font-bold text-base text-violet-950">Khách hàng đang trong thời gian chuẩn bị</p>
                      <p className="text-xs text-violet-800 mt-0.5">Khách hàng đang chủ động đưa hàng hóa vào gian kho và sắp xếp kiện hàng.</p>
                    </div>
                    <span className="rounded-full bg-violet-100 border border-violet-300 px-3 py-1 text-xs font-bold text-violet-900">Bước 5/6</span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <span className="text-stone-500">Bắt đầu bàn giao:</span>
                      <p className="font-bold text-stone-900 mt-0.5">{formatStaffDateTime(handoverTarget.setupStartedAt)}</p>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <span className="text-stone-500">Thời gian chuẩn bị miễn phí:</span>
                      <p className="font-bold text-emerald-700 mt-0.5">{handoverTarget.freeSetupDays} ngày</p>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <span className="text-stone-500">Tính cước kỳ thuê từ:</span>
                      <p className="font-bold text-stone-900 mt-0.5">{handoverTarget.paidRentalStartsOn || `Bàn giao + ${handoverTarget.freeSetupDays} ngày`}</p>
                    </div>
                  </div>
                  </div>

                <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700 space-y-2">
                  <p className="font-bold text-stone-900">Quy trình tiếp theo</p>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Sau khi khách hàng hoàn tất việc chuyển đồ vào kho hoặc hết thời gian chuẩn bị miễn phí, nhân viên cơ sở sẽ tiến hành <b>Kiểm kê thực tế</b> (đo đạc kích thước kiện, cân nặng và chụp ảnh lưu hồ sơ).
                  </p>
                  <p className="text-xs text-stone-500">
                    Bấm <b>"Xác nhận bàn giao"</b> khi khách hàng báo đã sắp xếp xong hoặc khi đến hạn kiểm kê.
                  </p>
                </div>
                 </>
                )}

              </div>
            )}

            {handoverStep === 6 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950"><b>Kiểm kê hàng hóa</b><p className="mt-1 text-xs">Chỉ đối chiếu số kiện, khối lượng, thể tích, kích thước và tình trạng hàng hóa sau khi khách đã sắp xếp xong. Hiện trạng kho trống đã được ghi nhận ở bước bàn giao.</p>{handoverTarget.inventoryDueAt && <p className="mt-1 text-xs">Hạn kiểm kê: <b>{formatStaffDateTime(handoverTarget.inventoryDueAt)}</b></p>}</div>
                {lineInventory ? (
                  <div className="space-y-5">
                    {inventoryRows.map(({ line, entry, comparison }, index) => {
                      const absent = comparison.quantity === 0
                      const errorKey = `inventory-${line.id}`
                      return (
                        <fieldset key={line.id} className="min-w-0 space-y-3 rounded-lg border border-stone-200 px-4 pb-4" disabled={isReviewingCompletedStep || submitting}>
                          <legend className="max-w-full px-1">
                            <span className="inline-block max-w-full break-words rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-950">
                              {line.name || `Hàng hóa ${index + 1}`}
                            </span>
                          </legend>
                          <p className="text-sm text-stone-600">
                            Khai báo {line.quantity} kiện
                            {line.lengthCm != null && line.widthCm != null && line.heightCm != null && ` · ${line.lengthCm} × ${line.widthCm} × ${line.heightCm} cm/kiện`}
                            {line.weightPerPackageKg != null && ` · ${line.weightPerPackageKg} kg/kiện`}
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {inventoryDimensions.map(([field, label]) => (
                              <Input key={field} label={label} type="number" min="0.01" step="any" value={absent ? "" : entry[field]} disabled={absent}
                                onChange={event => updateInventoryLine(line, { [field]: event.target.value })} />
                            ))}
                            <Input label="Khối lượng cả dòng (kg)" type="number" min="0.01" step="any" value={absent ? "0" : entry.weightKg} disabled={absent}
                              onChange={event => updateInventoryLine(line, { weightKg: event.target.value })} />
                            <Input label="Thể tích cả dòng (m³)" value={absent ? "0" : formatVolume(comparison.volume)} readOnly />
                            <Input label="Số kiện thực tế *" error={fieldErrors[`${errorKey}-quantity`]} type="number" min="0" step="1" value={entry.quantity} onChange={event => {
                              const quantity = event.target.value
                              const condition = quantity && Number(quantity) === 0 ? "NOT_PRESENT" : entry.condition === "NOT_PRESENT" ? "" : entry.condition
                              updateInventoryLine(line, { quantity, condition })
                            }} />
                          </div>
                          {fieldErrors[`${errorKey}-measurements`] && <p className="text-xs text-red-700">{fieldErrors[`${errorKey}-measurements`]}</p>}
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {comparison.badges.map(({ label, matches }) => (
                              <div key={label} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm">
                                <b>{label}</b><ComparisonBadge matches={matches} />
                              </div>
                            ))}
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
                              {fieldErrors[`${errorKey}-condition`] && <p className="text-xs text-red-700">{fieldErrors[`${errorKey}-condition`]}</p>}
                            </div>
                            <Input label={comparison.needsNote ? "Ghi chú chênh lệch hoặc hư hỏng *" : "Ghi chú kiểm kê"} error={fieldErrors[`${errorKey}-note`]} value={entry.note} maxLength={1000}
                              onChange={event => updateInventoryLine(line, { note: event.target.value })} />
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
                          })
                        }}
                      />
                      Đã đối chiếu đủ số kiện, khối lượng, thể tích và kích thước *
                    </label>
                    {fieldErrors.measurementChecks && (
                      <p className="text-xs text-red-600 font-medium pl-2">{fieldErrors.measurementChecks}</p>
                    )}
                  </div>
                </div>}
                </>)}
                {measurementVariance && (
                  <div className={`space-y-3 rounded-lg border ${fieldErrors.varianceAccepted || fieldErrors.varianceReason ? 'border-red-300 bg-red-50/50' : 'border-amber-300 bg-amber-50'} p-3 text-sm`}>
                    <div>
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
                        Đã trao đổi với khách và chấp nhận chênh lệch *
                      </label>
                      {fieldErrors.varianceAccepted && (
                        <p className="text-xs text-red-600 font-medium mt-1 pl-6">{fieldErrors.varianceAccepted}</p>
                      )}
                    </div>
                    <Input
                      label="Lý do chênh lệch *"
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Loại hàng *"
                    error={fieldErrors.goodsCategory}
                    disabled={isReviewingCompletedStep}
                    value={goodsCategory}
                    onChange={(event) => {
                      clearFieldError("goodsCategory")
                      setGoodsCategory(event.target.value)
                    }}
                  />
                  <div className={`rounded-lg border ${fieldErrors.initialCondition || fieldErrors.initialUnitCondition ? 'border-red-400 bg-red-50/30' : 'border-stone-200 bg-stone-50'} px-3 py-2 text-sm`}>
                    <span className="text-stone-500">Tình trạng kho trống đã ghi nhận</span>
                    <b className="mt-1 block">{initialCondition || 'Chưa ghi nhận'}</b>
                    {(fieldErrors.initialCondition || fieldErrors.initialUnitCondition) && (
                      <p className="text-xs text-red-600 font-medium mt-1">{fieldErrors.initialCondition || fieldErrors.initialUnitCondition}</p>
                    )}
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
                  <Input
                    label="Ghi chú kiểm kê"
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
                      Ảnh/PDF bằng chứng kiểm kê hàng hóa (tối đa 25MB/tệp) *
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
                {isReviewingCompletedStep && handoverTarget.handover?.evidenceReferences.length ? <p className="text-xs text-stone-600">Đã lưu {handoverTarget.handover.evidenceReferences.length} tệp bằng chứng kiểm kê trong biên bản.</p> : null}
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2 shadow-sm">
                <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 font-medium">
                  <span>{error}</span>
                  {Object.keys(fieldErrors).length > 0 && (
                    <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs text-red-700">
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
              <Button variant="outline" onClick={closeHandover} disabled={submitting}>Đóng</Button>
              {isReviewingCompletedStep ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="text-xs text-stone-500">Đang xem lại dữ liệu đã lưu, không thể thay đổi bước này.</span>
                  {handoverStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => { setError(null); setHandoverStep((prev) => Math.max(1, prev - 1)); }}
                      disabled={submitting}
                    >
                      Quay lại
                    </Button>
                  )}
                  {handoverStep < workflowCurrentStep && (
                    <Button
                      onClick={() => { setError(null); setHandoverStep((prev) => Math.min(workflowCurrentStep, prev + 1)); }}
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
                      ? "Đang chờ khách nhấn Sẵn sàng bàn giao."
                      : "Đang chờ khách nhấn Sẵn sàng để kiểm kê sau khi sắp xếp hàng hóa xong."}
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
                  <Button
                    onClick={() => setShowCustomerReadyModal(true)}
                    disabled={submitting || handoverTarget.checkInStatus === "handover_pending_receipt"}
                  >
                    {submitting
                      ? "Đang xác nhận…"
                      : handoverTarget.checkInStatus === "handover_pending_receipt"
                        ? "Chờ khách xác nhận nhận kho"
                        : "Xác nhận bàn giao"}
                  </Button>
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
                  <Button disabled={submitting || !staffCheckInActions(handoverTarget, now).canOpen ||
                    (handoverStep === 1 && (!checklist.identityVerified || !checklist.reservationMatched || identityVerificationBlocked)) ||
                    (handoverStep === 2 && (!contractFile || !!setupTermsKey && (confirmedSetupTerms !== setupTermsKey || handoverTarget.setupEarlyExitFee == null))) ||
                    (handoverStep === 3 && (handoverTarget.dueAtCheckIn ?? 0) > 0 && !paymentEvidenceFile) ||
                    (handoverStep === 4 && !emptyStorageHandoverReady)
                  } onClick={() => submitWorkflowStep()}>{submitting ? "Đang lưu…" : "Xác nhận và tiếp tục"}</Button>
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
                  <Button disabled={submitting} onClick={() => submitHandover()}>{submitting ? "Đang hoàn tất…" : "Hoàn tất kiểm kê"}</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={customerWaitTarget === "receipt" && Boolean(handoverTarget)}
        onClose={() => setCustomerWaitTarget(null)}
        title="Đang chờ khách hàng sẵn sàng bàn giao"
        size="md"
      >
        {handoverTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Nhân viên đã xác nhận bàn giao kho trống</p>
              <p className="mt-2 leading-6">
                Đơn <b>{handoverTarget.reservationCode}</b> đang chờ khách hàng nhấn <b>“Sẵn sàng bàn giao”</b> trên cổng khách hàng.
                Chưa thể chuyển sang kiểm kê hàng hóa ở bước này.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setCustomerWaitTarget(null)} disabled={submitting}>
                Đóng thông báo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showCustomerReadyModal}
        onClose={() => { if (!submitting) setShowCustomerReadyModal(false); }}
        title="Khách hàng sẵn sàng bàn giao"
        size="md"
      >
        {handoverTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
              <div className="rounded-full bg-violet-100 p-2 text-violet-700 shrink-0">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-base text-violet-950">Khách hàng đã sẵn sàng bàn giao</p>
                <p className="mt-1 text-xs text-violet-800 leading-relaxed">
                  Khách hàng đã hoàn tất việc sắp xếp hàng hóa vào gian kho và xác nhận sẵn sàng để nhân viên cơ sở thực hiện kiểm kê thực tế.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-500">Khách hàng:</span>
                <span className="font-semibold text-stone-900">{handoverTarget.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Mã đơn giữ kho:</span>
                <span className="font-mono font-medium text-stone-900">{handoverTarget.reservationCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Gian kho bàn giao:</span>
                <span className="font-mono font-bold text-amber-700">{handoverTarget.storageUnitCode}</span>
              </div>
            </div>

            <p className="text-xs text-stone-600">
              Sau khi xác nhận, hệ thống sẽ kết thúc thời gian chuẩn bị và chuyển hồ sơ sang <b>Bước 6: Kiểm kê hàng hóa</b> (đo đạc kích thước kiện, cân nặng và chụp ảnh lưu hồ sơ).
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-3">
              <Button
                variant="outline"
                disabled={submitting}
                onClick={() => setShowCustomerReadyModal(false)}
              >
                Quay lại
              </Button>
              <Button
                disabled={submitting}
                onClick={async () => {
                  setShowCustomerReadyModal(false)
                  await submitWorkflowStep()
                }}
              >
                {submitting ? "Đang xử lý…" : "Khách hàng sẵn sàng bàn giao"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(noShowTarget)}
        onClose={() => {
          if (!submitting) {
            setError(null)
            setNoShowTarget(null)
          }
        }}
        title="Đánh dấu khách không đến"
      >
        {noShowTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <b>{noShowTarget.reservationCode}</b> ·{" "}
              {noShowTarget.customerName}
            </div>
            <Input
              label="Lý do"
              value={noShowReason}
              maxLength={1000}
              onChange={(event) => setNoShowReason(event.target.value)}
            />
            {error && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setError(null); setNoShowTarget(null); }}>
                Đóng
              </Button>
              <Button
                variant="danger"
                disabled={submitting || !noShowReason.trim() || !staffCheckInActions(noShowTarget, now).canMarkAbsent}
                onClick={() => submitNoShow()}
              >
                Xác nhận khách không đến
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
              Bằng chứng từ chối (ảnh hoặc PDF)
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
        title="Biên bản nhận kho & bàn giao"
        size="xl"
      >
        {detailTarget?.handover && (
          <div className="space-y-4 text-sm">
            {!!detailTarget.handover.inventoryLines?.length && (
              <section className="divide-y divide-stone-200 rounded-lg border border-stone-200">
                <h3 className="px-3 py-2 font-semibold">Kết quả kiểm kê từng dòng hàng</h3>
                {detailTarget.handover.inventoryLines.map((line, index) => {
                  const declared = detailTarget.declaredGoodsLines?.find(item => item.id === line.goodsItemId)
                  const condition = { INTACT: "Nguyên vẹn", DAMAGED: "Có hư hỏng", NOT_PRESENT: "Không có kiện nào" }[line.condition]
                  return (
                    <div key={line.goodsItemId} className="space-y-1 p-3">
                      <p className="font-medium">{declared?.name || `Hàng hóa ${index + 1}`}{declared?.code && ` · ${declared.code}`}</p>
                      <p className="text-stone-700">{declared && `Khai báo ${declared.quantity} kiện · `}Thực tế {line.actualQuantity} kiện · {condition}</p>
                      {line.measurements && <p className="text-stone-700">{line.measurements.lengthCm} × {line.measurements.widthCm} × {line.measurements.heightCm} cm/kiện · {line.measurements.weightKg} kg cả dòng</p>}
                      {line.note && <p className="break-words text-stone-700">{line.note}</p>}
                    </div>
                  )
                })}
              </section>
            )}
            <div className="rounded-lg bg-stone-50 p-3">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div><dt className="text-xs text-stone-500">Mã đơn giữ kho</dt><dd className="mt-1 font-semibold">{detailTarget.reservationCode}</dd></div>
                <div><dt className="text-xs text-stone-500">Mã gian kho bàn giao</dt><dd className="mt-1 font-semibold">{detailTarget.storageUnitCode}</dd></div>
                <div><dt className="text-xs text-stone-500">Khách hàng nhận kho</dt><dd className="mt-1 font-semibold">{detailTarget.customerName}</dd></div>
              </dl>
              <p className="mt-1 text-xs text-stone-500">
                Hoàn tất lúc {formatStaffDateTime(detailTarget.checkedInAt)} bởi{" "}
                {detailTarget.performedByName ||
                  detailTarget.performedBy ||
                  "nhân viên cơ sở"}
                {detailTarget.assignedStaffName && (
                  <> · Phụ trách: {detailTarget.assignedStaffName}</>
                )}
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-3">
              <div>
                <span className="text-stone-500">Khách hàng</span>
                <p className="font-semibold">{detailTarget.customerName}</p>
              </div>
              <div>
                <span className="text-stone-500">Số CCCD/CMND</span>
                <p className="font-semibold">{detailTarget.handover.identityDocumentNumber || "Chưa cập nhật"}</p>
              </div>
              <div>
                <span className="text-stone-500">Số điện thoại</span>
                <p className="font-semibold">{detailTarget.customerPhone || "Chưa cập nhật"}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-stone-200 p-3">
                <span className="text-stone-500">Kích thước thực tế</span>
                <p className="mt-1 font-semibold">
                  {detailTarget.handover.actualMeasurements.lengthCm} ×{" "}
                  {detailTarget.handover.actualMeasurements.widthCm} ×{" "}
                  {detailTarget.handover.actualMeasurements.heightCm} cm
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 p-3">
                <span className="text-stone-500">Khối lượng / thể tích</span>
                <p className="mt-1 font-semibold">
                  {detailTarget.handover.actualMeasurements.weightKg} kg ·{" "}
                  {detailTarget.handover.actualMeasurements.actualVolumeM3} m³
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 p-3">
                <span className="text-stone-500">Hàng hóa</span>
                <p className="mt-1 font-semibold">
                  {detailTarget.handover.packageCount} kiện ·{" "}
                  {detailTarget.handover.goodsCategory}
                </p>
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-indigo-950">
              <b>Đối chiếu với thông tin khách đã khai báo</b>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-indigo-100 bg-white p-3">
                  <span className="text-xs text-stone-500">Số kiện</span>
                  <p className="mt-1 text-xs">Khai báo: {detailTarget.declaredPackageCount ?? "Chưa có dữ liệu"}</p>
                  <p className="text-xs">Thực tế: {detailTarget.handover.packageCount}</p>
                  <div className="mt-2">
                    <ComparisonBadge
                      matches={detailTarget.declaredPackageCount == null
                        ? null
                        : detailTarget.declaredPackageCount === detailTarget.handover.packageCount}
                    />
                  </div>
                </div>
                <div className="rounded-md border border-indigo-100 bg-white p-3">
                  <span className="text-xs text-stone-500">Khối lượng</span>
                  <p className="mt-1 text-xs">Khai báo: {detailTarget.declaredGoodsWeightKg} kg</p>
                  <p className="text-xs">Thực tế: {detailTarget.handover.actualMeasurements.weightKg} kg</p>
                  <div className="mt-2">
                    <ComparisonBadge
                      matches={!hasMaterialVariance(
                        String(detailTarget.handover.actualMeasurements.weightKg),
                        detailTarget.declaredGoodsWeightKg,
                        0.1,
                      )}
                    />
                  </div>
                </div>
                <div className="rounded-md border border-indigo-100 bg-white p-3">
                  <span className="text-xs text-stone-500">Thể tích</span>
                  <p className="mt-1 text-xs">Khai báo: {detailTarget.declaredGoodsVolumeM3} m³</p>
                  <p className="text-xs">Thực tế: {detailTarget.handover.actualMeasurements.actualVolumeM3} m³</p>
                  <div className="mt-2">
                    <ComparisonBadge
                      matches={!hasMaterialVariance(
                        String(detailTarget.handover.actualMeasurements.actualVolumeM3),
                        detailTarget.declaredGoodsVolumeM3,
                        0.0001,
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
            {detailTarget.handover.varianceReason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <b>Chênh lệch đã xác nhận:</b>{" "}
                {detailTarget.handover.varianceReason}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-stone-200 p-3">
                <b>Hiện trạng gian kho</b>
                <p className="mt-1 text-stone-600">
                  {detailTarget.handover.initialUnitCondition}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 p-3">
                <b>Tình trạng hàng hóa</b>
                <p className="mt-1 text-stone-600">
                  {detailTarget.handover.goodsCondition}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <b>Vật dụng/quyền truy cập đã bàn giao</b>
              <p className="mt-1 text-stone-600">
                {detailTarget.handover.handedOverItems.join(", ")}
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-2">
              {checklistLabels.map(([key, label]) => (
                <div
                  key={key}
                  className={
                    detailTarget.handover?.checklist[key]
                      ? "text-emerald-700"
                      : "text-red-700"
                  }
                >
                  {detailTarget.handover?.checklist[key] ? "[Đạt]" : "[Chưa]"} {label}
                </div>
              ))}
            </div>
            <div>
              <b>Bằng chứng</b>
              <div className="mt-2 flex flex-wrap gap-2">
                {detailTarget.handover.evidenceReferences.map(
                  (assetId, index) => (
                    <Button
                      key={assetId}
                      size="sm"
                      variant="outline"
                      disabled={downloadingEvidence === assetId}
                      onClick={() => previewEvidenceFile(assetId)}
                    >
                      {downloadingEvidence === assetId
                        ? "Đang tải…"
                        : `Xem trước tệp ${index + 1}`}
                    </Button>
                  ),
                )}
              </div>
            </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <b>Ghi chú kiểm kê</b>
                <p className="mt-1 whitespace-pre-wrap break-words text-stone-600">
                  {inventoryReportNote(detailTarget.handover.notes, detailTarget.handover.identityVerificationNote) || "Không có ghi chú."}
                </p>
              </div>
            {detailTarget.handover.identityVerificationNote && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <b>Ghi chú xác minh CCCD</b>
                <p className="mt-1 text-stone-600">
                  {detailTarget.handover.identityVerificationNote}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailTarget(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
        {detailTarget && !detailTarget.handover && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{detailTarget.reservationCode} · {detailTarget.storageUnitCode}</p>
              <p>{parseEmptyStorageHandover(detailTarget.readinessNote).condition}</p>
              <p>{detailTarget.checkInStatus === "completed" ? "Biên bản chưa có dữ liệu chi tiết." : "Chưa kiểm kê"}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailTarget(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(previewEvidence)}
        onClose={() => {
          if (previewEvidence) URL.revokeObjectURL(previewEvidence.url)
          setPreviewEvidence(null)
        }}
        title={previewEvidence?.fileName || "Xem trước bằng chứng"}
        size="xl"
      >
        {previewEvidence?.contentType.startsWith("image/")
          ? <img src={previewEvidence.url} alt={previewEvidence.fileName} className="max-h-[70vh] w-full object-contain" />
          : previewEvidence && <iframe title={previewEvidence.fileName} src={previewEvidence.url} className="h-[70vh] w-full" />}
      </Modal>
    </div>
  )
}
