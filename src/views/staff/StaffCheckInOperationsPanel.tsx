import { useEffect, useMemo, useState } from "react"

import {
  completeCheckIn,
  downloadCheckInEvidence,
  listCheckIns,
  markCheckInNoShow,
  recordCheckInRemainingPayment,
  rejectCheckIn,
  scheduleCheckIn,
  uploadCheckInEvidence,
  type CheckInCase,
  type CheckInChecklist,
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
  formatStaffDateTime,
  staffCheckInStatusLabel,
  staffErrorMessage,
  staffStorageUnitStatusLabel,
} from "./staffPresentation"
import { FilePreviewList } from "./StaffFileUpload"

const checklistLabels: Array<[keyof CheckInChecklist, string]> = [
  ["identityVerified", "Đã đối chiếu giấy tờ tùy thân"],

  ["reservationMatched", "Đơn đặt giữ kho, cơ sở và gian kho trùng khớp"],

  ["contractVerified", "Hợp đồng đã được ký và kiểm tra"],

  ["paymentVerified", "Các khoản cần thu trước bàn giao đã được xác nhận"],

  ["measurementVerified", "Đã đo và đối chiếu hàng hóa thực tế"],

  ["unitWalkthrough", "Đã kiểm tra trực tiếp gian kho với khách hàng"],

  ["conditionRecorded", "Đã ghi nhận hiện trạng ban đầu"],

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

  const boundary = new Date(`${date}T00:00:00`)

  if (nextDay) boundary.setDate(boundary.getDate() + 1)

  return boundary.toISOString()
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

export default function StaffCheckInOperationsPanel({
  showToast,
}: {
  showToast: (message: string) => void
}) {
  const [items, setItems] = useState<CheckInCase[]>([])

  const [page, setPage] = useState(0)

  const [totalItems, setTotalItems] = useState(0)

  const [totalPages, setTotalPages] = useState(0)

  const [queryInput, setQueryInput] = useState("")

  const [query, setQuery] = useState("")

  const [statusInput, setStatusInput] = useState<CheckInListStatus | "">("")

  const [status, setStatus] = useState<CheckInListStatus | "">("")

  const [scheduledFromInput, setScheduledFromInput] = useState("")

  const [scheduledFrom, setScheduledFrom] = useState("")

  const [scheduledToInput, setScheduledToInput] = useState("")

  const [scheduledTo, setScheduledTo] = useState("")

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  const [handoverTarget, setHandoverTarget] = useState<CheckInCase | null>(null)

  const [handoverStep, setHandoverStep] = useState(1)

  const [checklist, setChecklist] = useState<CheckInChecklist>(emptyChecklist)

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

  const [goodsCategory, setGoodsCategory] = useState("Hàng hóa đã khai báo")

  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])

  const [contractFile, setContractFile] = useState<File | null>(null)

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

  useEffect(() => {
    const refreshCheckIns = () => setRefreshKey((value) => value + 1)
    window.addEventListener("storagehub:checkins-refresh", refreshCheckIns)
    return () => {
      window.removeEventListener("storagehub:checkins-refresh", refreshCheckIns)
    }
  }, [])

  useEffect(() => {
    let active = true

    setLoading(true)

    setError(null)

    void listCheckIns({
      page,
      pageSize: 20,
      q: query,
      status: status || undefined,
      scheduledFrom: localDateBoundary(scheduledFrom),
      scheduledTo: localDateBoundary(scheduledTo, true),
    })

      .then((response) => {
        if (!active) return

        setItems(response.data)

        setTotalItems(response.pagination.totalItems)

        setTotalPages(response.pagination.totalPages)
      })

      .catch((reason) => {
        if (active)
          setError(
            staffErrorMessage(reason, "Không thể tải danh sách nhận kho."),
          )
      })

      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [page, query, refreshKey, scheduledFrom, scheduledTo, status])

  const allChecksComplete = useMemo(
    () => checklistLabels.every(([key]) => checklist[key]),

    [checklist],
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

  const measurementVariance = checkInComparison?.hasVariance ?? false

  const declaredIdentityDocument = handoverTarget?.identityDocumentNumber?.trim() || ""
  const identityMismatch = Boolean(
    declaredIdentityDocument &&
      identityDocumentNumber.trim() &&
      normalizeIdentityDocument(declaredIdentityDocument) !==
        normalizeIdentityDocument(identityDocumentNumber),
  )
  const identityVerificationBlocked = !normalizeIdentityDocument(identityDocumentNumber) || identityMismatch

  const refresh = () => setRefreshKey((value) => value + 1)

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

    setPage(0)

    setQuery(queryInput.trim())

    setStatus(statusInput)

    setScheduledFrom(scheduledFromInput)

    setScheduledTo(scheduledToInput)
  }

  const resetFilters = () => {
    setQueryInput("")

    setStatusInput("")

    setScheduledFromInput("")

    setScheduledToInput("")

    setQuery("")

    setStatus("")

    setScheduledFrom("")

    setScheduledTo("")

    setPage(0)

    setError(null)

    refresh()
  }

  const fail = (reason: unknown, fallback: string) =>
    setError(staffErrorMessage(reason, fallback))

  const submitHandover = async () => {
    const dueAtCheckIn = handoverTarget?.dueAtCheckIn ?? 0
    const hasKeyLock = Boolean(keyLockReference.trim())
    if (
      !handoverTarget?.checkInId ||
      !allChecksComplete ||
      !contractFile ||
      !hasKeyLock ||
      (dueAtCheckIn > 0 && !paymentEvidenceFile) ||
      !Number.isFinite(Number(lengthCm)) ||
      !Number.isFinite(Number(widthCm)) ||
      !Number.isFinite(Number(heightCm)) ||
      !Number.isFinite(Number(weightKg)) ||
      !Number.isFinite(Number(volumeM3)) ||
      identityVerificationBlocked
    ) return

    const declaredIdentity = normalizeIdentityDocument(handoverTarget.identityDocumentNumber)
    const providedIdentity = normalizeIdentityDocument(identityDocumentNumber)
    if (!providedIdentity || (declaredIdentity && declaredIdentity !== providedIdentity)) {
      setError("CCCD/Hộ chiếu không khớp thông tin đơn đặt kho. Chưa thể tiếp tục bàn giao.")
      return
    }

    setSubmitting(true)

    try {
      const uploadedEvidence = [...evidenceReferences]

      const contractUpload = new File(
        [contractFile],
        `hop-dong-da-ky-${contractFile.name}`,
        { type: contractFile.type, lastModified: contractFile.lastModified },
      )
      const contractAsset = await uploadCheckInEvidence(
        handoverTarget.checkInId,
        contractUpload,
      )
      uploadedEvidence.push(contractAsset.id)

      for (const file of evidenceFiles) {
        const asset = await uploadCheckInEvidence(
          handoverTarget.checkInId,
          file,
        )

        uploadedEvidence.push(asset.id)
      }

      let paymentEvidenceFileId: string | undefined
      if (dueAtCheckIn > 0 && paymentEvidenceFile) {
        const paymentAsset = await uploadCheckInEvidence(
          handoverTarget.checkInId,
          paymentEvidenceFile,
        )
        paymentEvidenceFileId = paymentAsset.id
        uploadedEvidence.push(paymentAsset.id)
      }

      if (evidenceFiles.length) {
        setEvidenceReferences(uploadedEvidence)

        setEvidenceFiles([])
      }

      if (dueAtCheckIn > 0) {
        await recordCheckInRemainingPayment(handoverTarget.checkInId, {
          amount: dueAtCheckIn,
          paymentMethod,
          paymentEvidenceFileId: paymentEvidenceFileId!,
          note: "Ghi nhận tại bước bàn giao và nhận kho",
        })
      }

      await completeCheckIn(handoverTarget.checkInId, {
        checklist,

        identityDocumentNumber: identityDocumentNumber.trim(),

        identityVerificationNote: verificationNotes.trim() || null,

        actualMeasurements: {
          lengthCm: Number(lengthCm),

          widthCm: Number(widthCm),

          heightCm: Number(heightCm),

          weightKg: Number(weightKg),

          actualVolumeM3: Number(volumeM3),

          varianceAccepted: measurementVariance && varianceAccepted,
        },

        varianceReason: measurementVariance ? varianceReason.trim() : null,

        initialUnitCondition: initialCondition.trim(),

        goodsCondition: goodsCondition.trim(),

        packageCount: Number(packageCount),

        goodsCategory: goodsCategory.trim(),

        evidenceReferences: uploadedEvidence,

        handedOverItems: [
          ...handedOverItems.split(",").map((value) => value.trim()).filter(Boolean),
          `Ổ khóa ${keyLockReference.trim()}`,
        ],

        notes: [
          verificationNotes.trim()
            ? `Ghi chú xác minh: ${verificationNotes.trim()}`
            : "",
          handoverNotes.trim()
            ? `Ghi chú bàn giao: ${handoverNotes.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        lockReference: keyLockReference.trim(),
      })

      setContractFile(null)

      setPaymentEvidenceFile(null)

      showToast(
        `Đã hoàn tất bàn giao ${handoverTarget.storageUnitCode}. Reservation đang chờ khách xác nhận nhận kho.`,
      )

      setHandoverTarget(null)

      refresh()
    } catch (reason) {
      fail(reason, "Không thể hoàn tất bàn giao.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitRejection = async () => {
    if (!rejectTarget?.checkInId || !rejectReason.trim()) return

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
    if (!noShowTarget?.checkInId || !noShowReason.trim()) return

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
    setHandoverTarget(item)

    setHandoverStep(1)

    setChecklist(emptyChecklist())

    setIdentityDocumentNumber(item.identityDocumentNumber || "")

    setVerificationNotes("")

    setEvidenceFiles([])

    setContractFile(null)

    setPaymentEvidenceFile(null)

    setEvidenceReferences([])

    setKeyLockReference("")

    setPaymentMethod("CASH")

    setHandedOverItems("Biên nhận bàn giao")

    setLengthCm(formatInputNumber(item.declaredGoodsLengthCm))

    setWidthCm(formatInputNumber(item.declaredGoodsWidthCm))

    setHeightCm(formatInputNumber(item.declaredGoodsHeightCm))

    setWeightKg(formatInputNumber(item.declaredGoodsWeightKg))

    setVolumeM3(formatInputNumber(item.declaredGoodsVolumeM3))

    setPackageCount(String(item.declaredPackageCount ?? 1))

    setMeasurementChecks(emptyMeasurementChecks())

    setVarianceAccepted(false)

    setVarianceReason("")
  }

  const beginHandover = async (item: CheckInCase) => {
    if (item.checkInStatus === "scheduled") {
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
        contractVerified: true,
        paymentVerified: true,
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

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        title="Nhận kho & bàn giao"
        subtitle="Đối chiếu hàng hóa và hoàn tất bàn giao theo lịch hẹn do khách hàng đặt. Hồ sơ đã bàn giao vẫn được lưu để tra cứu và xem lại."
      />
      <Card className="border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-stone-900">Bộ lọc hồ sơ nhận kho</p>
            <p className="mt-1 text-xs text-stone-500">Tìm nhanh theo đơn, khách hàng, gian kho hoặc lịch hẹn.</p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            {loading ? "Đang tải…" : `${totalItems} hồ sơ`}
          </span>
        </div>
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
            <option value="no_show">Khách không đến</option>
            <option value="completed">Đã bàn giao</option>
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
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <Card className="overflow-visible border-stone-200/80 shadow-sm">
        <Table tableClassName="min-w-[1080px]">
          <Thead>
            <Tr>
              <Th>Đơn đặt giữ kho</Th>
              <Th>Khách hàng</Th>
              <Th>Gian kho</Th>
              <Th>Lịch nhận</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Thao tác</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item) => (
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
                  <p className="mt-1 text-[11px] text-stone-500">Lịch do khách hàng đặt. Có thể bàn giao sớm.</p>
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
                    {item.checkInStatus !== "completed" && (
                      <>
                        <Button
                          className="shrink-0 whitespace-nowrap !px-2 !py-1 !text-[11px]"
                          size="sm"
                          disabled={item.checkInStatus === "rejected"}
                          onClick={() => void beginHandover(item)}
                        >
                          Bàn giao
                        </Button>
                        <Button
                          className="shrink-0 whitespace-nowrap !px-2 !py-1 !text-[11px]"
                          size="sm"
                          variant="danger"
                          disabled={item.checkInStatus !== "scheduled"}
                          onClick={() => openRejection(item)}
                        >
                          Từ chối nhận kho
                        </Button>
                        <Button
                          className="shrink-0 whitespace-nowrap !px-2 !py-1 !text-[11px]"
                          size="sm"
                          variant="danger"
                          disabled={
                            item.checkInStatus !== "scheduled" ||
                            !item.checkInId ||
                            !item.scheduledAt ||
                            new Date(item.scheduledAt).getTime() > Date.now()
                          }
                          onClick={() => {
                            setNoShowTarget(item)
                            setNoShowReason("")
                          }}
                        >
                          Khách không đến
                        </Button>
                      </>
                    )}
                    {item.checkInStatus === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailTarget(item)}
                      >
                        Xem biên bản
                      </Button>
                    )}
                    {item.checkInStatus === "completed" && (
                      <Badge variant="success">COMPLETED</Badge>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
            {!loading && !items.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-stone-500"
                >
                  Không có hồ sơ nhận kho trong phạm vi cơ sở.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-stone-500"
                >
                  Đang tải hồ sơ…
                </td>
              </tr>
            )}
          </Tbody>
        </Table>
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

      <Modal
        open={Boolean(handoverTarget)}
        onClose={() => {
          if (!submitting) setHandoverTarget(null)
        }}
        title="Đối chiếu và hoàn tất bàn giao"
        size="xl"
      >
        {handoverTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <b>{handoverTarget.reservationCode}</b> ·{" "}
              {handoverTarget.storageUnitCode} · {handoverTarget.customerName}
            </div>
            <div className="grid gap-2 sm:grid-cols-4" aria-label="Các bước check-in">
              {["Xác minh", "Đối chiếu hàng hóa", "Hồ sơ & thanh toán", "Bàn giao"].map((label, index) => {
                const step = index + 1
                return (
                  <button
                    key={label}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                      handoverStep === step
                        ? "border-amber-500 bg-amber-50 font-semibold text-amber-950"
                        : handoverStep > step
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 bg-stone-50 text-stone-500"
                    }`}
                    onClick={() => {
                      if (step <= handoverStep) setHandoverStep(step)
                    }}
                    disabled={step > handoverStep}
                  >
                    <span className="mr-1 font-bold">{step}.</span>{label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-stone-500">Các trường có dấu <span className="font-bold text-red-600">*</span> là bắt buộc.</p>
            <div hidden={handoverStep !== 1} className="space-y-4">
            <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm sm:grid-cols-4">
              <div>
                <span className="text-stone-500">Khách hàng</span>
                <p className="font-semibold">{handoverTarget.customerName}</p>
              </div>
              <div>
                <span className="text-stone-500">CCCD / Hộ chiếu khách đã khai báo</span>
                <p className="mt-1 font-semibold">
                  {declaredIdentityDocument || "Đơn cũ chưa lưu CCCD"}
                </p>
              </div>
              <div>
                <label className="block text-stone-500" htmlFor="checkin-identity-document">
                  CCCD / Hộ chiếu trên giấy tờ gốc <span className="font-bold text-red-600">*</span>
                </label>
                <input
                  id="checkin-identity-document"
                  value={identityDocumentNumber}
                  onChange={(event) => setIdentityDocumentNumber(event.target.value)}
                  placeholder="Nhập số trên giấy tờ gốc"
                  autoComplete="off"
                  className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 font-semibold text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <span className="text-stone-500">Số điện thoại</span>
                <p className="font-semibold">{handoverTarget.customerPhone || "Chưa cập nhật"}</p>
              </div>
            </div>
            {!declaredIdentityDocument && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                Đơn này chưa lưu CCCD. Nhập số trên giấy tờ gốc và tích xác nhận đã đối chiếu; hệ thống sẽ lưu số này vào đơn khi hoàn tất check-in.
              </p>
            )}
            <div className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm sm:grid-cols-2">
              {([
                ["identityVerified", "Đã đối chiếu giấy tờ tùy thân *"],
                ["reservationMatched", "Đơn đặt giữ kho, cơ sở và gian kho trùng khớp *"],
              ] as Array<[keyof CheckInChecklist, string]>).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 font-medium text-stone-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checklist[key]}
                    onChange={(event) => setChecklist((previous) => ({ ...previous, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <label className="block font-medium" htmlFor="checkin-verification-notes">
                Ghi chú xác minh nếu thông tin chưa trùng khớp
              </label>
              <textarea
                id="checkin-verification-notes"
                rows={2}
                value={verificationNotes}
                onChange={(event) => setVerificationNotes(event.target.value)}
                maxLength={1000}
                placeholder="Ghi rõ nội dung chưa khớp và cách xử lý hoặc đánh dấu cần kiểm tra lại…"
                className="mt-1 block w-full resize-y rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <p className="mt-1 text-xs text-amber-800">
                {identityMismatch
                  ? "CCCD thực tế không khớp số đã khai báo; không thể hoàn tất bàn giao. Ghi chú bên dưới dùng để đánh dấu và xử lý đối soát."
                  : "Nếu chưa xác minh được, để nguyên mục tương ứng chưa chọn và ghi chú lý do tại đây."}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              Lịch nhận kho do khách hàng đặt: <b>{formatStaffDateTime(handoverTarget.appointmentAt || handoverTarget.scheduledAt)}</b>.
              Nhân viên không thể thay đổi lịch. Nếu khách đến sớm, nhân viên vẫn có thể đối chiếu và bàn giao ngay.
            </div>
            </div>
            <div hidden={handoverStep !== 2} className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
              Thông tin khách khai báo:{" "}
              <b>
                {handoverTarget.declaredPackageCount == null
                  ? "Chưa có số kiện"
                  : `${handoverTarget.declaredPackageCount} kiện`}
              </b>{" "}·{" "}
              <b>{handoverTarget.declaredGoodsWeightKg} kg</b> ·{" "}
              <b>{handoverTarget.declaredGoodsVolumeM3} m³</b>. Nhân viên cần
              nhập thông tin thực tế để đối chiếu trước khi hoàn tất.
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Dài thực tế (cm) *"
                type="number"
                min="0.01"
                value={lengthCm}
                onChange={(event) => {
                  const next = event.target.value
                  setLengthCm(next)
                  setVolumeM3(volumeFromDimensions(next, widthCm, heightCm))
                }}
              />
              <Input
                label="Rộng thực tế (cm) *"
                type="number"
                min="0.01"
                value={widthCm}
                onChange={(event) => {
                  const next = event.target.value
                  setWidthCm(next)
                  setVolumeM3(volumeFromDimensions(lengthCm, next, heightCm))
                }}
              />
              <Input
                label="Cao thực tế (cm) *"
                type="number"
                min="0.01"
                value={heightCm}
                onChange={(event) => {
                  const next = event.target.value
                  setHeightCm(next)
                  setVolumeM3(volumeFromDimensions(lengthCm, widthCm, next))
                }}
              />
              <Input
                label="Khối lượng (kg) *"
                type="number"
                min="0.01"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
              />
              <Input
                label="Thể tích (m³) *"
                type="number"
                min="0.000001"
                value={volumeM3}
                readOnly
                className="bg-stone-50"
              />
              <Input
                label="Số kiện *"
                type="number"
                min="1"
                value={packageCount}
                onChange={(event) => setPackageCount(event.target.value)}
              />
            </div>
            {checkInComparison && (
              <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
                <div>
                  <b>Đối chiếu thông tin đơn hàng và thực tế *</b>
                  <div className="mt-2">
                    <Badge variant={checkInComparison.hasVariance ? "error" : "success"}>
                      {checkInComparison.hasVariance ? "Thông tin đơn hàng chưa khớp" : "Thông tin đơn hàng khớp"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-indigo-800">
                    Kiểm tra số kiện, khối lượng và thể tích trước khi xác nhận
                    bàn giao. Chênh lệch khối lượng hoặc thể tích trên 5% cần
                    được nhân viên ghi nhận lý do.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-indigo-100 bg-white p-3">
                    <div className="font-semibold">Số kiện</div>
                    <div className="mt-1 text-xs text-stone-600">
                      Khách khai báo: {checkInComparison.declaredPackageCount == null
                        ? "Chưa có dữ liệu"
                        : checkInComparison.declaredPackageCount + " kiện"}
                    </div>
                    <div className="text-xs text-stone-600">
                      Thực tế: {Number.isFinite(checkInComparison.actualPackageCount)
                        ? checkInComparison.actualPackageCount + " kiện"
                        : "Chưa nhập"}
                    </div>
                    <div className="mt-2">
                      <ComparisonBadge matches={checkInComparison.packageCountMatches} />
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs font-medium text-indigo-950">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={measurementChecks.packageCount}
                        onChange={(event) => setMeasurementChecks((previous) => ({ ...previous, packageCount: event.target.checked }))}
                      />
                      Đã đối chiếu số kiện *
                    </label>
                  </div>
                  <div className="rounded-md border border-indigo-100 bg-white p-3">
                    <div className="font-semibold">Khối lượng</div>
                    <div className="mt-1 text-xs text-stone-600">
                      Khách khai báo: {checkInComparison.declaredWeight} kg
                    </div>
                    <div className="text-xs text-stone-600">
                      Thực tế: {Number.isFinite(checkInComparison.actualWeight)
                        ? checkInComparison.actualWeight + " kg"
                        : "Chưa nhập"}
                    </div>
                    <div className="mt-2">
                      <ComparisonBadge matches={checkInComparison.weightMatches} />
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs font-medium text-indigo-950">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={measurementChecks.weight}
                        onChange={(event) => setMeasurementChecks((previous) => ({ ...previous, weight: event.target.checked }))}
                      />
                      Đã đối chiếu khối lượng *
                    </label>
                  </div>
                  <div className="rounded-md border border-indigo-100 bg-white p-3">
                    <div className="font-semibold">Thể tích</div>
                    <div className="mt-1 text-xs text-stone-600">
                      Khách khai báo: {checkInComparison.declaredVolume} m³
                    </div>
                    <div className="text-xs text-stone-600">
                      Thực tế: {Number.isFinite(checkInComparison.actualVolume)
                        ? checkInComparison.actualVolume + " m³"
                        : "Chưa nhập"}
                    </div>
                    <div className="mt-2">
                      <ComparisonBadge matches={checkInComparison.volumeMatches} />
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs font-medium text-indigo-950">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={measurementChecks.volume}
                        onChange={(event) => setMeasurementChecks((previous) => ({ ...previous, volume: event.target.checked }))}
                      />
                      Đã đối chiếu thể tích *
                    </label>
                  </div>
                  <div className="rounded-md border border-indigo-100 bg-white p-3">
                    <div className="font-semibold">Kích thước</div>
                    <div className="mt-1 text-xs text-stone-600">
                      Khách khai báo: {checkInComparison.declaredDimensionsAvailable
                        ? `${checkInComparison.declaredDimensions.join(" × ")} cm`
                        : "Chưa có dữ liệu"}
                    </div>
                    <div className="text-xs text-stone-600">
                      Thực tế: {checkInComparison.actualDimensions.every((value) => Number.isFinite(value) && value > 0)
                        ? `${checkInComparison.actualDimensions.join(" × ")} cm`
                        : "Chưa nhập"}
                    </div>
                    <div className="mt-2">
                      <ComparisonBadge matches={checkInComparison.dimensionMatches} />
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs font-medium text-indigo-950">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={measurementChecks.dimensions}
                        onChange={(event) => setMeasurementChecks((previous) => ({ ...previous, dimensions: event.target.checked }))}
                      />
                      Đã đối chiếu kích thước *
                    </label>
                  </div>
                </div>
              </div>
            )}
            {measurementVariance && (
              <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <b>
                  Phát hiện số kiện, kích thước hoặc số đo thực tế chênh lệch so
                  với khai báo. Hãy xác nhận lý do, hoặc từ chối nhận kho nếu
                  hàng hóa không đạt yêu cầu.
                </b>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={varianceAccepted}
                    onChange={(event) =>
                      setVarianceAccepted(event.target.checked)
                    }
                  />{" "}
                  Tôi đã đối chiếu với khách hàng và chấp nhận chênh lệch này. *
                </label>
                <Input
                  label="Lý do chênh lệch *"
                  value={varianceReason}
                  maxLength={1000}
                  onChange={(event) => setVarianceReason(event.target.value)}
                />
              </div>
            )}
            </div>
            <div hidden={handoverStep !== 3} className="space-y-4">
            {(handoverTarget.dueAtCheckIn ?? 0) > 0 && (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <div>
                  <b>Thanh toán phần còn lại khi nhận kho</b>
                  <p className="mt-1 text-xs text-emerald-800">
                    Số tiền cần thu: {Number(handoverTarget.dueAtCheckIn).toLocaleString("vi-VN")} đồng. Biên lai sẽ được hiển thị trong tài khoản khách hàng.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Phương thức thanh toán" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                  </Select>
                  <label className="block text-sm font-medium text-stone-700">
                    Ảnh biên lai / bằng chứng giao dịch *
                    <input
                      className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => setPaymentEvidenceFile(event.target.files?.[0] || null)}
                    />
                    <span className="mt-1 block text-xs font-normal text-stone-500">
                      {paymentEvidenceFile ? `Đã chọn: ${paymentEvidenceFile.name}` : "Chưa chọn ảnh hoặc PDF biên lai."}
                    </span>
                  </label>
                </div>
                <label className="flex items-start gap-2 text-sm font-medium text-emerald-950">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checklist.paymentVerified}
                    onChange={(event) => setChecklist((previous) => ({ ...previous, paymentVerified: event.target.checked }))}
                  />
                  Đã đối chiếu số tiền và bằng chứng giao dịch với khách hàng *
                </label>
              </div>
            )}
            {(handoverTarget.dueAtCheckIn ?? 0) <= 0 && (
              <label className="flex items-start gap-2 text-sm font-medium text-emerald-950">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checklist.paymentVerified}
                  onChange={(event) => setChecklist((previous) => ({ ...previous, paymentVerified: event.target.checked }))}
                />
                Đã đối chiếu và xác nhận đơn không còn khoản cần thu trước bàn giao *
              </label>
            )}
            <Input
              label="Loại hàng *"
              value={goodsCategory}
              onChange={(event) => setGoodsCategory(event.target.value)}
            />
            <Input
              label="Hiện trạng gian kho ban đầu *"
              value={initialCondition}
              onChange={(event) => setInitialCondition(event.target.value)}
            />
            <Input
              label="Tình trạng hàng hóa *"
              value={goodsCondition}
              onChange={(event) => setGoodsCondition(event.target.value)}
            />
            <div className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm sm:grid-cols-2">
              <label className="flex items-start gap-2 font-medium text-stone-800">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checklist.unitWalkthrough}
                  onChange={(event) => setChecklist((previous) => ({ ...previous, unitWalkthrough: event.target.checked }))}
                />
                Đã kiểm tra trực tiếp gian kho với khách hàng *
              </label>
              <label className="flex items-start gap-2 font-medium text-stone-800">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checklist.conditionRecorded}
                  onChange={(event) => setChecklist((previous) => ({ ...previous, conditionRecorded: event.target.checked }))}
                />
                Đã ghi nhận hiện trạng gian kho và hàng hóa *
              </label>
            </div>
            <label className="block text-sm font-medium text-stone-700">
              Văn bản hợp đồng đã ký *
              <input
                className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => setContractFile(event.target.files?.[0] || null)}
              />
              <span className="mt-1 block text-xs font-normal text-stone-500">
              Tải lên bản PDF hoặc ảnh hợp đồng đã ký để khách hàng xem lại sau khi bàn giao.
                {contractFile ? ` Đã chọn: ${contractFile.name}` : " Chưa chọn tệp."}
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm font-medium text-stone-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={checklist.contractVerified}
                onChange={(event) => setChecklist((previous) => ({ ...previous, contractVerified: event.target.checked }))}
              />
              Đã kiểm tra hợp đồng đã ký với khách hàng *
            </label>
            </div>
            <div hidden={handoverStep !== 4} className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
              <p className="font-semibold text-amber-950">Bàn giao ổ khóa</p>
              <Input label="Mã ổ khóa / chìa khóa *" value={keyLockReference} onChange={event => setKeyLockReference(event.target.value)} placeholder="Ví dụ: LOCK-018 hoặc KEY-018" />
              <p className="text-xs text-stone-600">Mã ổ khóa được kích hoạt khi nhân viên xác nhận bàn giao và thu hồi khi nghiệm thu trả kho hoặc đổi mã. Không lưu hoặc bàn giao mật khẩu.</p>
              <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checklist.accessHandedOver}
                  onChange={(event) => setChecklist((previous) => ({ ...previous, accessHandedOver: event.target.checked }))}
                />
                <span>Đã bàn giao và kiểm tra ổ khóa với khách hàng <span className="font-bold text-red-600">*</span></span>
              </label>
            </div>
            <label className="block text-sm font-medium text-stone-700">
              Bằng chứng bàn giao (ảnh hoặc PDF)
              <input
                className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) =>
                  setEvidenceFiles(Array.from(event.target.files || []))
                }
              />
              <span className="mt-1 block text-xs font-normal text-stone-500">
                {evidenceFiles.length
                  ? `${evidenceFiles.length} tệp chờ tải lên`
                  : evidenceReferences.length
                    ? `${evidenceReferences.length} tệp đã tải lên`
                    : contractFile
                    ? "Đã chọn hợp đồng. Bạn có thể thêm ảnh hiện trạng nếu cần."
                    : "Hợp đồng là bắt buộc. Bạn có thể thêm ảnh hiện trạng nếu cần."}
              </span>
            </label>
            <FilePreviewList files={evidenceFiles} onRemove={(index) => setEvidenceFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} disabled={submitting} />
            <FilePreviewList files={contractFile ? [contractFile] : []} onRemove={() => setContractFile(null)} disabled={submitting} />
            <FilePreviewList files={paymentEvidenceFile ? [paymentEvidenceFile] : []} onRemove={() => setPaymentEvidenceFile(null)} disabled={submitting} />
            <Input
              label="Vật dụng hoặc quyền truy cập đã bàn giao *"
              value={handedOverItems}
              onChange={(event) => setHandedOverItems(event.target.value)}
            />
            <Input
              label="Ghi chú bàn giao"
              value={handoverNotes}
              maxLength={2000}
              onChange={(event) => setHandoverNotes(event.target.value)}
            />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setHandoverTarget(null)}>
                Đóng
              </Button>
              <div className="flex gap-2">
                {handoverStep > 1 && (
                  <Button variant="outline" onClick={() => setHandoverStep((value) => value - 1)} disabled={submitting}>
                    Quay lại
                  </Button>
                )}
                {handoverStep < 4 ? (
                  <Button
                    disabled={
                      submitting ||
                      (handoverStep === 1 && (!identityDocumentNumber.trim() || !checklist.identityVerified || !checklist.reservationMatched || identityVerificationBlocked)) ||
                      (handoverStep === 2 && (!Object.values(measurementChecks).every(Boolean) || (measurementVariance && (!varianceAccepted || !varianceReason.trim())))) ||
                      (handoverStep === 3 && (!checklist.paymentVerified || !contractFile || !checklist.contractVerified || !initialCondition.trim() || !goodsCondition.trim() || ((handoverTarget.dueAtCheckIn ?? 0) > 0 && !paymentEvidenceFile)))
                    }
                    onClick={() => setHandoverStep((value) => value + 1)}
                  >
                    Tiếp tục
                  </Button>
                ) : (
                  <Button
                    disabled={
                      submitting ||
                      !allChecksComplete ||
                      !identityDocumentNumber.trim() ||
                      identityVerificationBlocked ||
                      !contractFile ||
                      !keyLockReference.trim() ||
                      ((handoverTarget.dueAtCheckIn ?? 0) > 0 && !paymentEvidenceFile) ||
                      !initialCondition.trim() ||
                      !goodsCondition.trim() ||
                      !goodsCategory.trim() ||
                      !handedOverItems.trim() ||
                      !packageCount.trim() ||
                      Number(packageCount) < 1 ||
                      !Number.isInteger(Number(packageCount)) ||
                      (measurementVariance && (!varianceAccepted || !varianceReason.trim()))
                    }
                    onClick={() => void submitHandover()}
                  >
                    {submitting ? "Đang tải bằng chứng và hoàn tất…" : "Xác nhận bàn giao"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(noShowTarget)}
        onClose={() => {
          if (!submitting) setNoShowTarget(null)
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoShowTarget(null)}>
                Đóng
              </Button>
              <Button
                variant="danger"
                disabled={submitting || !noShowReason.trim()}
                onClick={() => void submitNoShow()}
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
          if (!submitting) setRejectTarget(null)
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>
                Đóng
              </Button>
              <Button
                variant="danger"
                disabled={
                  submitting ||
                  !rejectReason.trim() ||
                  (!rejectEvidenceFiles.length &&
                    !rejectEvidenceReferences.length)
                }
                onClick={() => void submitRejection()}
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
            <div className="rounded-lg bg-stone-50 p-3">
              <b>{detailTarget.reservationCode}</b> ·{" "}
              {detailTarget.storageUnitCode} · {detailTarget.customerName}
              <p className="mt-1 text-xs text-stone-500">
                Hoàn tất lúc {formatStaffDateTime(detailTarget.checkedInAt)} bởi{" "}
                {detailTarget.performedByName ||
                  detailTarget.performedBy ||
                  "nhân viên cơ sở"}
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-3">
              <div>
                <span className="text-stone-500">Khách hàng</span>
                <p className="font-semibold">{detailTarget.customerName}</p>
              </div>
              <div>
                <span className="text-stone-500">Số CCCD / Hộ chiếu</span>
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
                  {detailTarget.handover?.checklist[key] ? "✓" : "✕"} {label}
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
                      onClick={() => void previewEvidenceFile(assetId)}
                    >
                      {downloadingEvidence === assetId
                        ? "Đang tải…"
                        : `Xem trước tệp ${index + 1}`}
                    </Button>
                  ),
                )}
              </div>
            </div>
            {detailTarget.handover.notes && (
              <div className="rounded-lg bg-stone-50 p-3">
                <b>Ghi chú</b>
                <p className="mt-1 text-stone-600">
                  {detailTarget.handover.notes}
                </p>
              </div>
            )}
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
              Biên bản bàn giao chưa có dữ liệu chi tiết.
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
