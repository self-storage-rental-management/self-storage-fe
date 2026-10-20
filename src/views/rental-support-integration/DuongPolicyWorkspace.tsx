import { useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { ApiClientError, apiRequest } from "../../services/apiClient"
import { getAuthenticatedActor, type ApiActor } from "../../services/authApi"
import type { User } from "../../types"
import { useStorageHub } from "../../store/StorageHubContext"
import type {
  CustomerFacility,
  PageResponse,
} from "../../services/customerReservationApi"
import {
  getStoredIntegrationPolicy,
  publishIntegrationPolicy,
  validPolicyInput,
  integrationError,
  type PolicyKind,
  type RenewalPolicyInput,
  type CommunicationPolicyInput,
  type RenewalPolicy,
  type CommunicationPolicy,
} from "../../services/duongIntegrationApi"
import { listBusinessPackagePolicies } from "../../services/businessPolicyApi"
import { isUuid } from "../../services/renewalOperationsApi"
import LedgerPanel from "./LedgerPanel"
import { policyPendingKey, readPendingPolicy, retainPendingPolicy, clearPendingPolicy } from "./pendingPolicyPublication"

type Draft = Record<string, string>
type PolicyInput = RenewalPolicyInput | CommunicationPolicyInput
type Policy = RenewalPolicy | CommunicationPolicy
const labels: Record<string, string> = {
  expectedRevision: "Lần cập nhật hiện tại (nhập 0 chỉ khi tạo mới)",
  effectiveFrom: "Có hiệu lực từ ngày",
  effectiveTo: "Đến ngày (không bắt buộc)",
  quoteTtlHours: "Thời hạn báo giá (giờ)",
  quoteTtlMinutes: "Thời hạn báo giá (phút)",
  paymentWindowHours: "Thời hạn thanh toán (giờ)",
  requestWindowDays: "Số ngày được gửi yêu cầu trước khi hết thuê",
  depositRate: "Tỷ lệ cọc (từ 0 đến 1)",
  signingWindowMinutes: "Thời hạn ký (phút)",
  exceptionExtensionLimitMinutes: "Giới hạn kéo dài hạn ký ngoại lệ (phút)",
  warningThroughDay: "Ngày quá hạn cuối của mức cảnh báo",
  seriousThroughDay: "Ngày quá hạn cuối của mức nghiêm trọng",
  urgentThroughDay: "Ngày quá hạn cuối của mức khẩn cấp",
  recoveryFromDay: "Bắt đầu xem xét thu hồi từ ngày quá hạn",
  recoveryCutoffTime: "Giờ chốt xem xét thu hồi",
  recoveryStartTime: "Giờ bắt đầu xử lý thu hồi",
  reminderCooldownMinutes:
    "Khoảng cách tối thiểu giữa hai lần nhắc (phút, không bắt buộc)",
  supportReviewDays: "Thời gian khách hàng xem xét kết quả hỗ trợ (ngày)",
}
export function policyDraft(policy: Policy | PolicyInput): Draft {
  const result: Draft = { expectedRevision: String("revision" in policy ? policy.revision : policy.expectedRevision) }
  for (const [key, value] of Object.entries(policy))
    if (
      key !== "expectedRevision" &&
      (typeof value === "number" || typeof value === "string")
    )
      result[key] = String(value)
  if ("quoteTtlHours" in policy && typeof policy.quoteTtlHours === "number") {
    result.quoteTtlHours = String(policy.quoteTtlHours)
  } else if ("quoteTtlMinutes" in policy && typeof policy.quoteTtlMinutes === "number") {
    result.quoteTtlHours = String(Math.max(1, Math.round(policy.quoteTtlMinutes / 60)))
  }
  if ("eligiblePackageIds" in policy) {
    result.eligiblePackageIds = policy.eligiblePackageIds.join(", ")
    result.unrestrictedRenewalWindow = String(policy.requestWindowDays >= 36_500)
    result.signingEnabled = String(!!policy.signing)
    result.termEnabled = String(!!policy.term)
    if (policy.signing)
      Object.assign(
        result,
        Object.fromEntries(
          Object.entries(policy.signing).map(([k, v]) => [k, String(v)]),
        ),
      )
    if (policy.term)
      Object.assign(
        result,
        Object.fromEntries(
          Object.entries(policy.term).map(([k, v]) => [k, String(v)]),
        ),
      )
  } else {
    result.supportEnabled = String(policy.supportReviewDays !== null)
    result.customerMayClose =
      policy.customerMayClose === null ? "" : String(policy.customerMayClose)
  }
  return result
}
export function buildPolicyInput(kind: PolicyKind, d: Draft): PolicyInput {
  const n = (key: string) => {
    if (!d[key]?.trim()) throw new Error("Vui lòng nhập đủ thông tin bắt buộc.")
    return Number(d[key])
  }
  const resolveQuoteMinutes = () => {
    if (d.quoteTtlHours?.trim()) return Number(d.quoteTtlHours) * 60
    return n("quoteTtlMinutes")
  }
  const base = {
    expectedRevision: n("expectedRevision"),
    effectiveFrom: d.effectiveFrom || "",
    effectiveTo: d.effectiveTo || null,
  }
  const input: PolicyInput =
    kind === "renewal"
      ? {
          ...base,
          quoteTtlMinutes: resolveQuoteMinutes(),
          paymentWindowHours: d.paymentWindowHours?.trim() ? n("paymentWindowHours") : 24,
          requestWindowDays: d.unrestrictedRenewalWindow === "true" ? 36_500 : n("requestWindowDays"),
          // Retained in the legacy policy DTO; new Renewal terms do not collect a deposit.
          depositRate: 0,
          eligiblePackageIds: (d.eligiblePackageIds || "")
            .split(/[\s,]+/)
            .filter(Boolean),
          signing:
            d.signingEnabled === "true"
              ? {
                  signingWindowMinutes: n("signingWindowMinutes"),
                  exceptionExtensionLimitMinutes: n(
                    "exceptionExtensionLimitMinutes",
                  ),
                }
              : null,
          term:
            d.termEnabled === "true"
              ? {
                  calendar: "CALENDAR_DAYS",
                  timezone: "Asia/Ho_Chi_Minh",
                  warningThroughDay: n("warningThroughDay"),
                  seriousThroughDay: n("seriousThroughDay"),
                  urgentThroughDay: n("urgentThroughDay"),
                  recoveryFromDay: n("recoveryFromDay"),
                  recoveryCutoffTime: d.recoveryCutoffTime || "",
                  recoveryStartTime: d.recoveryStartTime || "",
                }
              : null,
        }
      : {
          ...base,
          reminderCooldownMinutes: d.reminderCooldownMinutes?.trim()
            ? n("reminderCooldownMinutes")
            : null,
          supportReviewDays:
            d.supportEnabled === "true" ? n("supportReviewDays") : null,
          customerMayClose:
            d.supportEnabled === "true" &&
            ["true", "false"].includes(d.customerMayClose)
              ? d.customerMayClose === "true"
              : null,
        }
  if (!validPolicyInput(kind, input))
    throw new Error("Thông tin chính sách chưa đầy đủ hoặc không hợp lệ.")
  return input
}

export function defaultRenewalPolicyInput(
  eligiblePackageIds: string[],
  effectiveFrom = "2020-01-01",
): RenewalPolicyInput {
  return {
    expectedRevision: 0,
    effectiveFrom,
    effectiveTo: null,
    quoteTtlMinutes: 30,
    paymentWindowHours: 24,
    requestWindowDays: 36_500,
    depositRate: 0,
    eligiblePackageIds,
    signing: { signingWindowMinutes: 120, exceptionExtensionLimitMinutes: 60 },
    term: {
      calendar: "CALENDAR_DAYS",
      timezone: "Asia/Ho_Chi_Minh",
      warningThroughDay: 1,
      seriousThroughDay: 3,
      urgentThroughDay: 7,
      recoveryFromDay: 8,
      recoveryCutoffTime: "17:00",
      recoveryStartTime: "08:00",
    },
  }
}
export function policyMatches(
  policy: Policy,
  input: PolicyInput,
  publisher: string,
): boolean {
  if (
    policy.revision !== input.expectedRevision + 1 ||
    policy.publishedBy !== publisher
  )
    return false
  const equal = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) && Array.isArray(b))
      return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
    if (a && b && typeof a === "object" && typeof b === "object")
      return Object.entries(b).every(([k, v]) =>
        equal((a as Record<string, unknown>)[k], v),
      )
    if (
      typeof a === "string" &&
      typeof b === "string" &&
      /^\d{2}:\d{2}(:00)?$/.test(a) &&
      /^\d{2}:\d{2}(:00)?$/.test(b)
    )
      return a.slice(0, 5) === b.slice(0, 5)
    return a === b
  }
  return Object.entries(input)
    .filter(([k]) => k !== "expectedRevision")
    .every(([k, v]) =>
      equal((policy as unknown as Record<string, unknown>)[k], v),
    )
}

function findFirstInvalidField(
  kind: PolicyKind,
  draft: Draft,
): { key: string; message: string } | null {
  if (kind === "renewal") {
    if (!draft.effectiveFrom?.trim()) {
      return { key: "effectiveFrom", message: "Vui lòng chọn ngày có hiệu lực." }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom.trim())) {
      return { key: "effectiveFrom", message: "Ngày có hiệu lực không đúng định dạng YYYY-MM-DD." }
    }

    if (draft.effectiveTo?.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveTo.trim())) {
        return { key: "effectiveTo", message: "Ngày kết thúc không đúng định dạng YYYY-MM-DD." }
      }
      if (draft.effectiveTo.trim() < draft.effectiveFrom.trim()) {
        return { key: "effectiveTo", message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu có hiệu lực." }
      }
    }

    if (!draft.quoteTtlHours?.trim()) {
      return { key: "quoteTtlHours", message: "Vui lòng nhập thời hạn báo giá (giờ)." }
    }
    const quoteHours = Number(draft.quoteTtlHours)
    if (isNaN(quoteHours) || quoteHours <= 0) {
      return { key: "quoteTtlHours", message: "Thời hạn báo giá phải là số lớn hơn 0." }
    }

    if (draft.unrestrictedRenewalWindow !== "true") {
      if (!draft.requestWindowDays?.trim()) {
        return { key: "requestWindowDays", message: "Vui lòng nhập số ngày được gửi yêu cầu trước khi hết thuê." }
      }
      const reqDays = Number(draft.requestWindowDays)
      if (isNaN(reqDays) || reqDays < 0) {
        return { key: "requestWindowDays", message: "Số ngày gửi yêu cầu phải là số nguyên không âm." }
      }
    }

    const packageIds = (draft.eligiblePackageIds || "").split(/[\s,]+/).filter(Boolean)
    if (packageIds.length === 0) {
      return { key: "eligiblePackageIds", message: "Vui lòng chọn ít nhất 1 gói gia hạn được áp dụng." }
    }

    if (draft.signingEnabled === "true") {
      if (!draft.signingWindowMinutes?.trim()) {
        return { key: "signingWindowMinutes", message: "Vui lòng nhập thời hạn ký (phút)." }
      }
      const signMins = Number(draft.signingWindowMinutes)
      if (isNaN(signMins) || signMins <= 0) {
        return { key: "signingWindowMinutes", message: "Thời hạn ký phải là số lớn hơn 0." }
      }

      if (!draft.exceptionExtensionLimitMinutes?.trim()) {
        return { key: "exceptionExtensionLimitMinutes", message: "Vui lòng nhập giới hạn kéo dài hạn ký ngoại lệ (phút)." }
      }
      const extMins = Number(draft.exceptionExtensionLimitMinutes)
      if (isNaN(extMins) || extMins <= 0) {
        return { key: "exceptionExtensionLimitMinutes", message: "Giới hạn kéo dài hạn ký ngoại lệ phải là số lớn hơn 0." }
      }
    }

    if (draft.termEnabled === "true") {
      if (!draft.warningThroughDay?.trim()) {
        return { key: "warningThroughDay", message: "Vui lòng nhập ngày quá hạn cuối của mức cảnh báo." }
      }
      const warnDay = Number(draft.warningThroughDay)
      if (isNaN(warnDay) || warnDay <= 0) {
        return { key: "warningThroughDay", message: "Ngày quá hạn cuối của mức cảnh báo phải là số nguyên dương." }
      }

      if (!draft.seriousThroughDay?.trim()) {
        return { key: "seriousThroughDay", message: "Vui lòng nhập ngày quá hạn cuối của mức nghiêm trọng." }
      }
      const seriousDay = Number(draft.seriousThroughDay)
      if (isNaN(seriousDay) || seriousDay <= warnDay) {
        return { key: "seriousThroughDay", message: "Ngày quá hạn cuối của mức nghiêm trọng phải lớn hơn mức cảnh báo." }
      }

      if (!draft.urgentThroughDay?.trim()) {
        return { key: "urgentThroughDay", message: "Vui lòng nhập ngày quá hạn cuối của mức khẩn cấp." }
      }
      const urgentDay = Number(draft.urgentThroughDay)
      if (isNaN(urgentDay) || urgentDay <= seriousDay) {
        return { key: "urgentThroughDay", message: "Ngày quá hạn cuối của mức khẩn cấp phải lớn hơn mức nghiêm trọng." }
      }

      if (!draft.recoveryFromDay?.trim()) {
        return { key: "recoveryFromDay", message: "Vui lòng nhập ngày bắt đầu xem xét thu hồi." }
      }
      const recDay = Number(draft.recoveryFromDay)
      if (isNaN(recDay) || recDay !== urgentDay + 1) {
        return { key: "recoveryFromDay", message: `Ngày bắt đầu thu hồi phải là ngày ${urgentDay + 1} (ngay sau mức khẩn cấp).` }
      }

      if (!draft.recoveryCutoffTime?.trim()) {
        return { key: "recoveryCutoffTime", message: "Vui lòng chọn giờ chốt xem xét thu hồi." }
      }
      if (!/^\d{2}:\d{2}$/.test(draft.recoveryCutoffTime.trim())) {
        return { key: "recoveryCutoffTime", message: "Giờ chốt xem xét thu hồi không đúng định dạng HH:mm." }
      }

      if (!draft.recoveryStartTime?.trim()) {
        return { key: "recoveryStartTime", message: "Vui lòng chọn giờ bắt đầu xử lý thu hồi." }
      }
      if (!/^\d{2}:\d{2}$/.test(draft.recoveryStartTime.trim())) {
        return { key: "recoveryStartTime", message: "Giờ bắt đầu xử lý thu hồi không đúng định dạng HH:mm." }
      }
    }
  } else {
    if (draft.reminderCooldownMinutes?.trim()) {
      const cd = Number(draft.reminderCooldownMinutes)
      if (isNaN(cd) || cd <= 0 || cd > 525600) {
        return { key: "reminderCooldownMinutes", message: "Khoảng cách nhắc phải từ 1 đến 525.600 phút." }
      }
    }
    if (draft.supportEnabled === "true") {
      if (!draft.supportReviewDays?.trim()) {
        return { key: "supportReviewDays", message: "Vui lòng nhập thời gian khách hàng xem xét kết quả hỗ trợ." }
      }
      const sDays = Number(draft.supportReviewDays)
      if (isNaN(sDays) || sDays < 7 || sDays > 365) {
        return { key: "supportReviewDays", message: "Thời gian khách hàng xem xét kết quả hỗ trợ phải từ 7 đến 365 ngày." }
      }
      if (!["true", "false"].includes(draft.customerMayClose || "")) {
        return { key: "customerMayClose", message: "Vui lòng chọn quy định khách hàng có thể đóng yêu cầu." }
      }
    }
  }

  return null
}

function jumpToField(key: string) {
  const el =
    document.getElementById(`policy-field-${key}`) ||
    document.querySelector(`[name="${key}"]`) ||
    document.getElementById(`policy-section-${key}`)

  if (el) {
    const details = el.closest("details")
    if (details && !details.open) {
      details.open = true
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    if (typeof (el as HTMLElement).focus === "function") {
      (el as HTMLElement).focus()
    }
  }
}

function PolicyEditor({
  kind,
  facility,
  actor: passedActor,
  onLocked,
}: {
  kind: PolicyKind
  facility: string
  actor?: ApiActor
  onLocked: (value: boolean) => void
}) {
  const actor = passedActor || getAuthenticatedActor()!
  const pendingKey = policyPendingKey(actor.id, facility, kind)
  const retained = readPendingPolicy(pendingKey)
  const read = useRentalApiResource(
    `${actor.id}:${facility}:${kind}:${JSON.stringify(actor.permissions)}`,
    () => getStoredIntegrationPolicy(kind, facility),
  )
  const packageRead = useRentalApiResource(
    `${actor.id}:${facility}:renewal-packages`,
    () => kind === "renewal" ? listBusinessPackagePolicies(facility) : Promise.resolve([]),
  )
  const [draft, setDraft] = useState<Draft>(() => retained ? policyDraft(retained.input) : {}),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(!!retained),
    [conflict, setConflict] = useState(retained?.conflict ?? false),
    [message, setMessage] = useState<string>(),
    [error, setError] = useState<unknown>(),
    [fieldErrorKey, setFieldErrorKey] = useState<string | null>(null),
    [fieldErrorMessage, setFieldErrorMessage] = useState<string | null>(null)
  const pending = useRef<PolicyInput | undefined>(retained?.input),
    lock = useRef(false),
    autoSeedStarted = useRef(false)
  const canWrite =
    actor.status === "ACTIVE" &&
    actor.roles.includes("BUSINESS") &&
    actor.permissions.includes("policies:update")
  useEffect(() => {
    onLocked(busy)
    return () => onLocked(false)
  }, [busy, onLocked])
  useEffect(() => {
    if (read.data && !pending.current && !editing) setDraft(policyDraft(read.data))
  }, [editing, read.data])
  useEffect(() => {
    if (
      kind !== "renewal" ||
      !canWrite ||
      read.loading ||
      packageRead.loading ||
      packageRead.error ||
      !(read.error instanceof ApiClientError) ||
      read.error.status !== 404 ||
      autoSeedStarted.current ||
      pending.current
    ) return

    autoSeedStarted.current = true
    void (async () => {
      lock.current = true
      setBusy(true)
      setError(undefined)
      setMessage("Đang tạo chính sách gia hạn mặc định cho cơ sở...")
      try {
        const packages = packageRead.data || []
        const eligiblePackageIds = packages
          .filter((item) => item.facilityId === facility && item.active)
          .map((item) => item.id)
        if (!eligiblePackageIds.length) {
          setMessage("Cơ sở chưa có gói thuê đang hoạt động để đưa vào chính sách gia hạn.")
          return
        }
        const input = defaultRenewalPolicyInput(eligiblePackageIds)
        const saved = await publishIntegrationPolicy("renewal", facility, input)
        if (!policyMatches(saved, input, actor.id))
          throw new ApiClientError("Chưa đối chiếu được chính sách mặc định đã lưu.", {
            code: "INVALID_RESPONSE",
          })
        setDraft(policyDraft(saved))
        setMessage("Đã lưu chính sách gia hạn mặc định. BO có thể chỉnh sửa bên dưới.")
        read.refresh()
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 409) {
          setMessage("Chính sách vừa được tạo ở nơi khác. Đang tải lại chính sách hiện có...")
          read.refresh()
        } else {
          setMessage(undefined)
          setError(err)
        }
      } finally {
        lock.current = false
        setBusy(false)
      }
    })()
  }, [actor.id, canWrite, facility, kind, packageRead.data, packageRead.error, packageRead.loading, read.error, read.loading, read.refresh])
  useEffect(() => {
    if (!uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [uncertain])
  const inputClass =
    "mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100"
  const field = (key: string, optional = false) => {
    const isError = fieldErrorKey === key
    return (
      <label key={key} className="block">
        <span className={isError ? "font-semibold text-red-700" : ""}>{labels[key]}</span>
        <input
          id={`policy-field-${key}`}
          name={key}
          className={`${inputClass} ${isError ? "border-red-500 ring-2 ring-red-200 bg-red-50/40" : ""}`}
          required={!optional}
          value={draft[key] || ""}
          type={
            key.startsWith("effective")
              ? "date"
              : key.endsWith("Time")
                ? "time"
                : "number"
          }
          min={0}
          step={key === "depositRate" ? "any" : 1}
          onChange={(e) => {
            if (fieldErrorKey === key) {
              setFieldErrorKey(null)
              setFieldErrorMessage(null)
            }
            setDraft((d) => ({ ...d, [key]: e.target.value }))
          }}
        />
        {isError && (
          <p className="mt-1 text-xs font-semibold text-red-600">
            {fieldErrorMessage || "Vui lòng nhập hoặc sửa lại thông tin ô này."}
          </p>
        )}
      </label>
    )
  }
  const toggle = (key: string, label: string) => (
    <label className="block">
      <input
        type="checkbox"
        checked={draft[key] === "true"}
        onChange={(e) =>
          setDraft((d) => ({ ...d, [key]: String(e.target.checked) }))
        }
      />{" "}
      {label}
    </label>
  )
  const check = async () => {
    if (lock.current || (getAuthenticatedActor() && getAuthenticatedActor()?.id !== actor.id)) return
    lock.current = true
    setBusy(true)
    setError(undefined)
    try {
      const proof = pending.current && uncertain
        ? await getStoredIntegrationPolicy(kind, facility, pending.current.expectedRevision + 1)
        : undefined
      const actual = proof || await getStoredIntegrationPolicy(kind, facility)
      if (
        pending.current &&
        uncertain &&
        !policyMatches(actual, pending.current, actor.id)
      ) {
        setMessage(
          "Chưa đối chiếu được yêu cầu trước. Giữ nguyên nội dung và thử lại cùng yêu cầu.",
        )
        return
      }
      const confirmed =
        !!pending.current && policyMatches(actual, pending.current, actor.id)
      pending.current = undefined
      clearPendingPolicy(pendingKey)
      setDraft(policyDraft(actual))
      setUncertain(false)
      setConflict(false)
      setMessage(
        confirmed
          ? "Đã xác nhận chính sách được lưu."
          : "Đã đọc chính sách hiện tại. Kiểm tra lại nội dung trước khi lưu.",
      )
      // Read the latest revision separately: a later publication is not our readback result.
      if (confirmed) read.refresh()
    } catch (e) {
      setError(e)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const selectedPackageIds = new Set((draft.eligiblePackageIds || "").split(/[\s,]+/).filter(Boolean))
  const setPackageSelected = (packageId: string, checked: boolean) => {
    setDraft((current) => {
      const ids = new Set((current.eligiblePackageIds || "").split(/[\s,]+/).filter(Boolean))
      if (checked) ids.add(packageId)
      else ids.delete(packageId)
      return { ...current, eligiblePackageIds: [...ids].join(", ") }
    })
  }
  return (
    <Card className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-0 text-sm shadow-sm">
      <div className="border-b border-stone-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4">
      <h3 className="text-base font-semibold text-stone-900">
        {kind === "renewal"
          ? "Chính sách gia hạn và quá hạn"
          : "Chính sách nhắc hạn và hỗ trợ"}
      </h3>
      <p className="mt-1 text-xs text-stone-500">{kind === "renewal" ? "Thiết lập thời hạn, gói được áp dụng và quy trình ký cho cơ sở." : "Thiết lập cách nhắc hạn và xử lý yêu cầu hỗ trợ."}</p>
      </div>
      <div className="space-y-4 p-5">
      {read.loading && <p role="status">Đang tải chính sách...</p>}
      {!!read.error && !(read.error instanceof ApiClientError && read.error.status === 404 && kind === "renewal") &&
        <p role="alert">{integrationError(read.error)}</p>}
      {read.data && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
          <span className="font-semibold">Phiên bản {read.data.revision}</span>
          <span>Cập nhật lúc {new Date(read.data.publishedAt).toLocaleString("vi-VN")}</span>
        </div>
      )}
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            lock.current ||
            conflict ||
            !editing ||
            !canWrite ||
            (getAuthenticatedActor() && getAuthenticatedActor()?.id !== actor.id) ||
            (getAuthenticatedActor() && !getAuthenticatedActor()?.permissions.includes("policies:update"))
          )
            return

          const invalid = findFirstInvalidField(kind, draft)
          if (invalid) {
            setFieldErrorKey(invalid.key)
            setFieldErrorMessage(invalid.message)
            setMessage("Thông tin chính sách chưa đầy đủ hoặc không hợp lệ.")
            setTimeout(() => jumpToField(invalid.key), 50)
            return
          }

          let input: PolicyInput
          try {
            input = pending.current || buildPolicyInput(kind, draft)
          } catch {
            const fallback = findFirstInvalidField(kind, draft)
            if (fallback) {
              setFieldErrorKey(fallback.key)
              setFieldErrorMessage(fallback.message)
              setTimeout(() => jumpToField(fallback.key), 50)
            }
            setMessage("Thông tin chính sách chưa đầy đủ hoặc không hợp lệ.")
            return
          }
          pending.current = input
          lock.current = true
          setBusy(true)
          setError(undefined)
          setMessage(undefined)
          try {
            const actual = await publishIntegrationPolicy(kind, facility, input)
            if (!policyMatches(actual, input, actor.id))
              throw new ApiClientError("Chưa đối chiếu được chính sách.", {
                code: "INVALID_RESPONSE",
              })
            pending.current = undefined
            clearPendingPolicy(pendingKey)
            setUncertain(false)
            setDraft(policyDraft(actual))
            setEditing(false)
            setFieldErrorKey(null)
            setFieldErrorMessage(null)
            setMessage("Đã lưu chính sách.")
            read.refresh()
          } catch (err) {
            // A denied/conflicting retry does not prove that the first uncertain PUT failed.
            const unknown =
              uncertain ||
              !(err instanceof ApiClientError) ||
              err.status === null ||
              err.status >= 500
            setUncertain(unknown)
            setConflict(err instanceof ApiClientError && err.status === 409)
            setError(err)
            if (!unknown) {
              pending.current = undefined
              clearPendingPolicy(pendingKey)
            } else retainPendingPolicy(pendingKey, input, err instanceof ApiClientError && err.status === 409)
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        <fieldset
          disabled={!canWrite || !editing || busy || uncertain || conflict || read.loading}
          className="space-y-5"
        >
          <input type="hidden" value={draft.expectedRevision || ""} readOnly />
          {kind === "renewal" ? (
            <>
              <section className="rounded-xl border border-stone-200 p-4">
                <h4 className="font-semibold text-stone-900">Hiệu lực chính sách</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">{field("effectiveFrom")}{field("effectiveTo", true)}</div>
              </section>
              <section className="rounded-xl border border-stone-200 p-4">
                <h4 className="font-semibold text-stone-900">Điều kiện gia hạn</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {field("quoteTtlHours")}<p className="self-end rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Thời hạn giao dịch thanh toán gia hạn: <strong>15 phút</strong> kể từ khi mở thanh toán.</p>
                  <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3 font-medium text-stone-700 sm:col-span-2">
                    <input type="checkbox" checked={draft.unrestrictedRenewalWindow === "true"} onChange={(e) => setDraft((d) => ({ ...d, unrestrictedRenewalWindow: String(e.target.checked), requestWindowDays: e.target.checked ? "36500" : "30" }))} />
                    Cho phép gửi yêu cầu gia hạn bất kỳ lúc nào (chế độ demo)
                  </label>
                  {draft.unrestrictedRenewalWindow !== "true" && field("requestWindowDays")}
                </div>
              </section>
              <section id="policy-field-eligiblePackageIds" className={`rounded-xl border p-4 transition ${fieldErrorKey === "eligiblePackageIds" ? "border-red-500 ring-2 ring-red-200 bg-red-50/20" : "border-stone-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className={`font-semibold ${fieldErrorKey === "eligiblePackageIds" ? "text-red-700" : "text-stone-900"}`}>Gói gia hạn được áp dụng</h4>
                    <p className="mt-1 text-xs text-stone-500">Chỉ các gói được chọn trong chính sách mới xuất hiện cho khách.</p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">{selectedPackageIds.size} gói đã chọn</span>
                </div>
                {fieldErrorKey === "eligiblePackageIds" && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    {fieldErrorMessage || "Vui lòng chọn ít nhất 1 gói gia hạn được áp dụng."}
                  </p>
                )}
                {packageRead.loading && <p className="mt-3 text-xs text-stone-500">Đang tải danh sách gói...</p>}
                {Boolean(packageRead.error) && <p role="alert" className="mt-3 text-xs text-red-700">{integrationError(packageRead.error)}</p>}
                {!packageRead.loading && !packageRead.error && !(packageRead.data || []).length && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Cơ sở chưa có gói thuê trong danh mục.</p>}
                {!!packageRead.data?.length && <div className="mt-3 grid gap-2 sm:grid-cols-2">{packageRead.data.map((item) => <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selectedPackageIds.has(item.id) ? "border-amber-400 bg-amber-50/70" : "border-stone-200 hover:border-stone-300"}`}><input type="checkbox" className="mt-1 accent-amber-600" checked={selectedPackageIds.has(item.id)} onChange={(e) => { if (fieldErrorKey === "eligiblePackageIds") { setFieldErrorKey(null); setFieldErrorMessage(null); } setPackageSelected(item.id, e.target.checked); }} /><span className="min-w-0 flex-1"><span className="block font-semibold text-stone-800">{item.name}</span><span className="mt-0.5 block text-xs text-stone-500">{item.rentalMonths} tháng | Giảm {Math.round(item.discountRate * 100)}%</span></span><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{item.active ? "Đang hoạt động" : "Đã tạm ngưng"}</span></label>)}</div>}
              </section>
              <details className="rounded-xl border border-stone-200 p-4" open={draft.signingEnabled === "true"}>
                <summary className="cursor-pointer font-semibold text-stone-900">Thời hạn ký</summary>
                <div className="mt-3 space-y-3">{toggle("signingEnabled", "Bật cấu hình thời hạn ký")}{draft.signingEnabled === "true" && <div className="grid gap-4 sm:grid-cols-2">{["signingWindowMinutes", "exceptionExtensionLimitMinutes"].map((k) => field(k))}</div>}</div>
              </details>
              <details className="rounded-xl border border-stone-200 p-4" open={draft.termEnabled === "true"}>
                <summary className="cursor-pointer font-semibold text-stone-900">Quá hạn và thu hồi</summary>
                <div className="mt-3 space-y-3">{toggle("termEnabled", "Bật cấu hình các mốc quá hạn")}{draft.termEnabled === "true" && <div className="grid gap-4 sm:grid-cols-2">{["warningThroughDay", "seriousThroughDay", "urgentThroughDay", "recoveryFromDay", "recoveryCutoffTime", "recoveryStartTime"].map((k) => field(k))}</div>}</div>
              </details>
            </>
          ) : (
            <>
              {field("reminderCooldownMinutes", true)}
              {toggle(
                "supportEnabled",
                "Cấu hình thời gian xem xét kết quả hỗ trợ",
              )}
              {draft.supportEnabled === "true" && (
                <>
                  {field("supportReviewDays")}
                  <label className="block">
                    <span className={fieldErrorKey === "customerMayClose" ? "font-semibold text-red-700" : ""}>Khách hàng có thể đóng yêu cầu</span>
                    <select
                      id="policy-field-customerMayClose"
                      name="customerMayClose"
                      className={`${inputClass} ${fieldErrorKey === "customerMayClose" ? "border-red-500 ring-2 ring-red-200 bg-red-50/40" : ""}`}
                      required
                      value={draft.customerMayClose || ""}
                      onChange={(e) => {
                        if (fieldErrorKey === "customerMayClose") {
                          setFieldErrorKey(null)
                          setFieldErrorMessage(null)
                        }
                        setDraft((d) => ({
                          ...d,
                          customerMayClose: e.target.value,
                        }))
                      }}
                    >
                      <option value="">Chọn quy định</option>
                      <option value="true">Cho phép</option>
                      <option value="false">Không cho phép</option>
                    </select>
                    {fieldErrorKey === "customerMayClose" && (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        {fieldErrorMessage || "Vui lòng chọn quy định."}
                      </p>
                    )}
                  </label>
                </>
              )}
            </>
          )}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4">
          {editing && <Button type="button" variant="outline" disabled={busy} onClick={() => {
            setDraft(read.data ? policyDraft(read.data) : {})
            setEditing(false)
            setMessage(undefined)
            setError(undefined)
            setConflict(false)
            setFieldErrorKey(null)
            setFieldErrorMessage(null)
          }}>Hủy thay đổi</Button>}
          {!editing && canWrite && <Button type="button" disabled={busy || read.loading || uncertain || conflict} onClick={() => { setMessage(undefined); setError(undefined); if (!read.data) setDraft((current) => ({ ...current, expectedRevision: "0" })); setEditing(true) }}>Chỉnh sửa</Button>}
          {editing && <Button type="submit" disabled={!canWrite || busy || conflict || read.loading}>
            {busy ? "Đang lưu..." : uncertain ? "Thử lại cùng yêu cầu" : "Lưu chỉnh sửa"}
          </Button>}
        </div>
      </form>
      {(uncertain || conflict) && (
        <>
          <p role="status">
            {uncertain
              ? "Chưa xác định được kết quả. Không đổi nội dung hoặc tải lại trang; cần đối chiếu chính sách hoặc thử lại cùng yêu cầu."
              : "Chính sách đã thay đổi hoặc chưa đủ điều kiện. Đọc lại chính sách trước khi tiếp tục."}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void check()}
          >
            Đối chiếu chính sách hiện tại
          </Button>
        </>
      )}
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {!!error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{integrationError(error)}</p>}
      {!canWrite && <p>Chỉ có thể xem chính sách với quyền hiện tại.</p>}
      </div>
    </Card>
  )
}
function useSafeStorageHub() {
  try {
    return useStorageHub()
  } catch {
    return null
  }
}

export default function DuongPolicyWorkspace({
  user,
  onLocked,
}: {
  user?: User
  onLocked?: (value: boolean) => void
}) {
  const hub = useSafeStorageHub()
  const authenticatedActor = getAuthenticatedActor()
  const actor =
    authenticatedActor ||
    (user && user.role === "business"
      ? {
          id: user.id || "demo-business",
          email: user.email || "business@storagehub.demo",
          fullName: user.name || "Demo Operations",
          phone: user.phone || null,
          permanentAddress: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          avatarUrl: null,
          status: "ACTIVE" as const,
          roles: ["BUSINESS" as const],
          facilityScopes: {},
          facilityNames: {},
          mustChangePassword: false,
          permissions: [
            "policies:read",
            "policies:update",
            "rentals:read",
            "rentals:update",
            "returns:read",
            "facilities:read",
          ],
        }
      : null)

  const allowed =
    !!actor &&
    actor.status === "ACTIVE" &&
    actor.roles.includes("BUSINESS") &&
    actor.permissions.includes("policies:read")
  const [page, setPage] = useState(0),
    [facility, setFacility] = useState(""),
    [kind, setKind] = useState<PolicyKind>("renewal"),
    [rentalInput, setRentalInput] = useState(""),
    [rental, setRental] = useState("")
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    onLocked?.(locked)
  }, [locked, onLocked])
  const read = useRentalApiResource(
    `${actor?.id}:integration-facilities:${allowed}:${page}`,
    async () => {
      if (!allowed) return null
      try {
        const p = await apiRequest<PageResponse<CustomerFacility>>(
          `/api/facilities?page=${page}&size=20`,
        )
        if (
          !Array.isArray(p.data) ||
          !p.data.every((f) => isUuid(f.id) && typeof f.name === "string") ||
          p.pagination?.page !== page ||
          !Number.isSafeInteger(p.pagination.totalPages)
        )
          throw new ApiClientError("Danh sách cơ sở không hợp lệ.", {
            code: "INVALID_RESPONSE",
          })
        return p
      } catch (err) {
        if (hub?.facilities && hub.facilities.length > 0) {
          return {
            data: hub.facilities.map((f) => ({
              id: f.id,
              code: f.id,
              name: f.name,
              address: f.address || "",
              city: f.city || "TP. Hồ Chí Minh",
              status: "active" as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })),
            pagination: {
              page: 0,
              size: hub.facilities.length,
              totalElements: hub.facilities.length,
              totalPages: 1,
            },
          }
        }
        throw err
      }
    },
  )
  useEffect(() => {
    if (!facility && !read.loading && read.data?.pagination.page === page) {
      const firstFacility = read.data.data[0]
      if (firstFacility) setFacility(firstFacility.id)
    }
  }, [facility, page, read.data, read.loading])
  if (!allowed)
    return (
      <p role="alert">
        Cần đăng nhập bằng tài khoản giám đốc thương mại có quyền xem chính
        sách.
      </p>
    )
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <header className="pb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Thiết lập theo cơ sở</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">Chính sách gia hạn và hỗ trợ</h2>
        <p className="mt-1 text-sm text-stone-500">Quản lý các gói khách được gia hạn và điều kiện xử lý tại từng cơ sở.</p>
      </header>
      <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      {read.loading && <p role="status">Đang tải cơ sở...</p>}
      {!!read.error && <p role="alert">{integrationError(read.error)}</p>}
      <label className="block">
        <span className="text-sm font-semibold text-stone-700">Cơ sở</span>
        <select
          disabled={locked}
          className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100"
          value={facility}
          onChange={(e) => setFacility(e.target.value)}
        >
          <option value="">Chọn cơ sở</option>
          {read.data?.data.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {read.data && !read.data.data.length && <p>Không có dữ liệu</p>}
      {read.data && read.data.pagination.totalPages > 1 && (
        <div className="flex gap-2">
          <Button
            disabled={locked || page === 0}
            onClick={() => {
              setFacility("")
              setPage((v) => v - 1)
            }}
          >
            Trang trước
          </Button>
          <Button
            disabled={locked || page + 1 >= read.data.pagination.totalPages}
            onClick={() => {
              setFacility("")
              setPage((v) => v + 1)
            }}
          >
            Trang sau
          </Button>
        </div>
      )}
      <label className="block">
        <span className="text-sm font-semibold text-stone-700">Loại chính sách</span>
        <select
          disabled={locked}
          className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100"
          value={kind}
          onChange={(e) => setKind(e.target.value as PolicyKind)}
        >
          <option value="renewal">Gia hạn và quá hạn</option>
          <option value="communication">Nhắc hạn và hỗ trợ</option>
        </select>
      </label>
      </div>
      {facility && (
        <PolicyEditor
          key={`${actor!.id}:${facility}:${kind}`}
          facility={facility}
          kind={kind}
          actor={actor!}
          onLocked={setLocked}
        />
      )}
      <Card className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div><h3 className="font-semibold text-stone-900">
          Tra cứu các khoản tài chính của hồ sơ thuê
        </h3><p className="mt-1 text-xs text-stone-500">Tra cứu lịch sử tài chính bằng mã hồ sơ thuê.</p></div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isUuid(rentalInput.trim())) setRental(rentalInput.trim())
          }}
        >
          <label className="block text-sm font-medium text-stone-700">
            Mã hồ sơ thuê
            <input
              className="mt-2 block w-full rounded-xl border border-stone-300 px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              value={rentalInput}
              onChange={(e) => setRentalInput(e.target.value)}
            />
          </label>
          <Button className="mt-3" type="submit" disabled={!isUuid(rentalInput.trim())}>
            Tra cứu
          </Button>
        </form>
        {rental && (
          <LedgerPanel
            key={`${actor!.id}:${rental}`}
            role="business"
            id={rental}
          />
        )}
      </Card>
    </div>
  )
}
