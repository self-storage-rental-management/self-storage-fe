import { VIETNAM_TIME_ZONE, parseVietnamDate } from '../../utils/vietnamTime'
import LocalizedDateInput from '../../components/LocalizedDateInput'
import { useEffect, useMemo, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { ApiClientError, apiRequest } from "../../services/apiClient"
import { getAuthenticatedActor, isApiAuthenticated, type ApiActor } from "../../services/authApi"
import type { User } from "../../types"
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
import { policyPendingKey, readPendingPolicy, retainPendingPolicy, clearPendingPolicy } from "./pendingPolicyPublication"
import LedgerPanel from "./LedgerPanel"
import BusinessConfigPanel from "./BusinessConfigPanel"

type Draft = Record<string, string>
type PolicyInput = RenewalPolicyInput | CommunicationPolicyInput
type Policy = RenewalPolicy | CommunicationPolicy

const labels: Record<string, string> = {
  expectedRevision: "Lần cập nhật hiện tại (nhập 0 chỉ khi tạo mới)",
  effectiveFrom: "Có hiệu lực từ ngày",
  effectiveTo: "Đến ngày (không bắt buộc)",
  paymentWindowHours: "Thời hạn thanh toán (giờ)",
  depositRate: "Tỷ lệ cọc gia hạn (0 đến 1, ví dụ 0 = miễn cọc, 0.2 = 20%)",
  signingWindowMinutes: "Thời hạn ký (phút)",
  exceptionExtensionLimitMinutes: "Giới hạn kéo dài hạn ký ngoại lệ (phút)",
  warningThroughDay: "Số ngày kết thúc mức Cảnh báo 1",
  seriousThroughDay: "Số ngày kết thúc mức Cảnh báo nghiêm trọng",
  urgentThroughDay: "Hạn chót gia hạn (số ngày sau hết hạn)",
  recoveryCutoffTime: "Giờ chốt gia hạn ngày cuối (ví dụ 17:00:00)",
  recoveryStartTime: "Giờ chuyển sang xử lý thu hồi (ví dụ 08:00:00)",
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
  if ("eligiblePackageIds" in policy) {
    result.eligiblePackageIds = policy.eligiblePackageIds.join(", ")
    result.depositRate = String(policy.depositRate ?? 0)
    result.signingEnabled = String(!!policy.signing)
    if (policy.signing)
      Object.assign(
        result,
        Object.fromEntries(
          Object.entries(policy.signing).map(([k, v]) => [k, String(v)]),
        ),
      )
    if (policy.term) {
      result.warningThroughDay = String(policy.term.warningThroughDay)
      result.seriousThroughDay = String(policy.term.seriousThroughDay)
      result.urgentThroughDay = String(policy.term.urgentThroughDay)
      result.recoveryCutoffTime = policy.term.recoveryCutoffTime
      result.recoveryStartTime = policy.term.recoveryStartTime
    }
  } else {
    result.supportEnabled = String(policy.supportReviewDays !== null)
    result.customerMayClose =
      policy.customerMayClose === null ? "" : String(policy.customerMayClose)
  }
  return result
}

export function buildPolicyInput(kind: PolicyKind, d: Draft): PolicyInput {
  const n = (key: string, fallback?: number) => {
    if (!d[key]?.trim()) {
      if (fallback !== undefined) return fallback
      throw new Error("Vui lòng nhập đủ thông tin bắt buộc.")
    }
    const val = Number(d[key])
    return Number.isNaN(val) && fallback !== undefined ? fallback : val
  }
  const base = {
    expectedRevision: n("expectedRevision", 0),
    effectiveFrom: d.effectiveFrom || "",
    effectiveTo: d.effectiveTo || null,
  }
  const input: PolicyInput =
    kind === "renewal"
      ? {
          ...base,
          paymentWindowHours: n("paymentWindowHours", 24),
          depositRate: d.depositRate !== undefined && d.depositRate.trim() !== "" ? Number(d.depositRate) : 0,
          eligiblePackageIds: (d.eligiblePackageIds || "")
            .split(/[\s,]+/)
            .filter(Boolean),
          signing:
            d.signingEnabled === "true"
              ? {
                  signingWindowMinutes: n("signingWindowMinutes", 120),
                  exceptionExtensionLimitMinutes: n(
                    "exceptionExtensionLimitMinutes",
                    60,
                  ),
                }
              : null,
          term: d.urgentThroughDay ? {
            calendar: 'CALENDAR_DAYS',
            timezone: 'Asia/Ho_Chi_Minh',
            warningThroughDay: Number(d.warningThroughDay || 3),
            seriousThroughDay: Number(d.seriousThroughDay || 6),
            urgentThroughDay: Number(d.urgentThroughDay || 7),
            recoveryFromDay: Number(d.urgentThroughDay || 7) + 1,
            recoveryCutoffTime: d.recoveryCutoffTime || '17:00:00',
            recoveryStartTime: d.recoveryStartTime || '08:00:00',
          } : undefined,
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
    paymentWindowHours: 24,
    depositRate: 0,
    eligiblePackageIds,
    signing: { signingWindowMinutes: 120, exceptionExtensionLimitMinutes: 60 },
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

function PolicyEditor({
  kind,
  facility,
  facilitiesList,
  applyAllFacilities = false,
  actor: passedActor,
  onLocked,
}: {
  kind: PolicyKind
  facility: string
  facilitiesList?: CustomerFacility[]
  applyAllFacilities?: boolean
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
  const overdueTerm = read.data && "eligiblePackageIds" in read.data && read.data.term
    ? read.data.term
    : {
        calendar: 'CALENDAR_DAYS',
        timezone: 'Asia/Ho_Chi_Minh',
        warningThroughDay: 3,
        seriousThroughDay: 6,
        urgentThroughDay: 7,
        recoveryFromDay: 8,
        recoveryCutoffTime: '17:00:00',
        recoveryStartTime: '08:00:00',
      }
  const packageRead = useRentalApiResource(
    `${actor.id}:all-renewal-packages`,
    () => kind === "renewal" ? listBusinessPackagePolicies() : Promise.resolve([]),
  )
  const [draft, setDraft] = useState<Draft>(() => retained ? policyDraft(retained.input) : {}),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(!!retained),
    [conflict, setConflict] = useState(retained?.conflict ?? false),
    [message, setMessage] = useState<string>(),
    [error, setError] = useState<unknown>()
  const isDirty = useRef(false),
    pending = useRef<PolicyInput | undefined>(retained?.input),
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
    if (read.data && !pending.current && !isDirty.current) setDraft(policyDraft(read.data))
  }, [read.data])

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
      setMessage("Đang tạo chính sách gia hạn mặc định cho toàn hệ thống...")
      try {
        const targetFacilities = facilitiesList && facilitiesList.length > 0
          ? facilitiesList
          : [{ id: facility, name: "Cơ sở" } as CustomerFacility]
        const allPackages = packageRead.data || []

        for (const targetFac of targetFacilities) {
          const eligiblePackageIds = allPackages
            .filter((item) => item.facilityId === targetFac.id && item.active)
            .map((item) => item.id)
          if (!eligiblePackageIds.length) continue

          let facRev = 0
          try {
            const cur = await getStoredIntegrationPolicy("renewal", targetFac.id)
            facRev = cur.revision
          } catch {
            facRev = 0
          }
          const input = defaultRenewalPolicyInput(eligiblePackageIds)
          input.expectedRevision = facRev
          await publishIntegrationPolicy("renewal", targetFac.id, input)
        }
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
  }, [actor.id, canWrite, facility, facilitiesList, kind, packageRead.data, packageRead.error, packageRead.loading, read.error, read.loading, read.refresh])

  useEffect(() => {
    if (!uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [uncertain])

  const inputClass =
    "mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100"

  const field = (key: string, optional = false) => (
    <label key={key} className="block">
      {labels[key]}
      <LocalizedDateInput
        className={inputClass}
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
          isDirty.current = true
          setDraft((d) => ({ ...d, [key]: e.target.value }))
        }}
      />
    </label>
  )

  const toggle = (key: string, label: string) => (
    <label className="block">
      <input
        type="checkbox"
        checked={draft[key] === "true"}
        onChange={(e) => {
          isDirty.current = true
          setDraft((d) => ({ ...d, [key]: String(e.target.checked) }))
        }}
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
      isDirty.current = false
      setDraft(policyDraft(actual))
      setUncertain(false)
      setConflict(false)
      setMessage(
        confirmed
          ? "Đã xác nhận chính sách được lưu."
          : "Đã đọc chính sách hiện tại. Kiểm tra lại nội dung trước khi lưu.",
      )
      if (confirmed) read.refresh()
    } catch (e) {
      setError(e)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const availablePackages = useMemo(() => {
    return (packageRead.data || [])
      .filter((item) => item.active)
      .sort(
        (a, b) =>
          (a.facilityName || "").localeCompare(b.facilityName || "", "vi") ||
          a.rentalMonths - b.rentalMonths ||
          a.name.localeCompare(b.name, "vi"),
      )
  }, [packageRead.data])

  const selectedPackageIds = useMemo(() => {
    return new Set(
      draft.eligiblePackageIds !== undefined
        ? draft.eligiblePackageIds.split(/[\s,]+/).filter(Boolean)
        : availablePackages.map((p) => p.id),
    )
  }, [draft.eligiblePackageIds, availablePackages])

  // Group packages by facilityName
  const packagesByFacility = useMemo(() => {
    const map: Record<string, typeof availablePackages> = {}
    for (const pkg of availablePackages) {
      const fName = pkg.facilityName || "Cơ sở hệ thống"
      if (!map[fName]) map[fName] = []
      map[fName].push(pkg)
    }
    return map
  }, [availablePackages])

  const inactiveSelectedPackages = useMemo(() => {
    return (packageRead.data || []).filter(
      (item) => !item.active && selectedPackageIds.has(item.id),
    )
  }, [packageRead.data, selectedPackageIds])

  const setPackageSelected = (packageId: string, checked: boolean) => {
    isDirty.current = true
    setDraft((current) => {
      const ids = new Set((current.eligiblePackageIds || "").split(/[\s,]+/).filter(Boolean))
      if (checked) ids.add(packageId)
      else ids.delete(packageId)
      return { ...current, eligiblePackageIds: [...ids].join(", ") }
    })
  }

  const [selectedFacilityTab, setSelectedFacilityTab] = useState<string>("all")
  const [openFacilityNames, setOpenFacilityNames] = useState<Set<string>>(new Set())
  const [activeFacilityName, setActiveFacilityName] = useState<string | null>(null)
  const section2Ref = useRef<HTMLElement>(null)

  // Click outside section 2 collapses open facility and resets active state to gray all
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (section2Ref.current && !section2Ref.current.contains(e.target as Node)) {
        setOpenFacilityNames(new Set())
        setActiveFacilityName(null)
      }
    }
    document.addEventListener("mousedown", handleDocClick)
    return () => document.removeEventListener("mousedown", handleDocClick)
  }, [])

  const toggleFacilityAccordion = (name: string) => {
    setOpenFacilityNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
        setActiveFacilityName(null)
      } else {
        setActiveFacilityName(name)
        return new Set([name])
      }
      return next
    })
  }

  const expandAll = () => setOpenFacilityNames(new Set(Object.keys(packagesByFacility)))
  const collapseAll = () => {
    setOpenFacilityNames(new Set())
    setActiveFacilityName(null)
  }

  const handleSelectFacilityTab = (tabName: string) => {
    setSelectedFacilityTab(tabName)
    if (tabName !== "all") {
      setActiveFacilityName(tabName)
      setOpenFacilityNames(new Set([tabName]))
    }
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-0 text-sm shadow-sm">
      <div className="border-b border-stone-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4">
        <h3 className="text-base font-semibold text-stone-900">
          {kind === "renewal"
            ? (applyAllFacilities ? "Chính sách gia hạn toàn hệ thống" : "Chính sách gia hạn theo cơ sở")
            : "Chính sách nhắc hạn và hỗ trợ"}
        </h3>
        <p className="mt-1 text-xs text-stone-500">
          {kind === "renewal"
            ? (applyAllFacilities
                ? "Thiết lập hiệu lực, thời hạn thanh toán, tỷ lệ cọc và gói gia hạn áp dụng đồng bộ cho toàn bộ cơ sở."
                : "Thiết lập hiệu lực, thời hạn thanh toán, tỷ lệ cọc và gói gia hạn áp dụng riêng cho cơ sở được chọn.")
            : "Thiết lập cách nhắc hạn và xử lý yêu cầu hỗ trợ khách hàng."}
        </p>
      </div>
      <div className="space-y-4 p-5">
      {read.loading && <p role="status">Đang tải chính sách...</p>}
      {read.error instanceof ApiClientError && read.error.status === 404 && kind === "renewal" && (
        <p role="status">{busy ? "Đang lưu chính sách gia hạn mặc định..." : "Chưa có chính sách gia hạn. Đang khởi tạo chính sách mặc định..."}</p>
      )}
      {!!read.error && !(read.error instanceof ApiClientError && read.error.status === 404 && kind === "renewal") && (
        <div role="alert" className="flex items-center justify-between rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <span>{integrationError(read.error)}</span>
          <button
            type="button"
            onClick={() => {
              read.refresh()
              packageRead.refresh()
            }}
            className="ml-3 font-semibold text-red-800 underline hover:text-red-950 cursor-pointer"
          >
            Thử tải lại
          </button>
        </div>
      )}
      {read.data && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
          <span className="font-semibold">Phiên bản đồng bộ hiện tại: {read.data.revision}</span>
          <span>Cập nhật lúc {parseVietnamDate(read.data.publishedAt).toLocaleString("vi-VN", { timeZone: VIETNAM_TIME_ZONE })}</span>
        </div>
      )}
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            lock.current ||
            conflict ||
            !canWrite ||
            (getAuthenticatedActor() && getAuthenticatedActor()?.id !== actor.id) ||
            (getAuthenticatedActor() && !getAuthenticatedActor()?.permissions.includes("policies:update"))
          )
            return

          let baseInput: PolicyInput
          try {
            baseInput = pending.current || buildPolicyInput(kind, draft)
          } catch {
            setMessage("Thông tin chính sách chưa đầy đủ hoặc không hợp lệ.")
            return
          }

          lock.current = true
          setBusy(true)
          setError(undefined)
          setMessage(undefined)

          try {
            if (kind === "renewal") {
              const targetFacilities = applyAllFacilities
                ? (facilitiesList && facilitiesList.length > 0
                    ? facilitiesList
                    : [{ id: facility, name: "Toàn hệ thống" } as CustomerFacility])
                : (facilitiesList?.filter(f => f.id === facility) || [{ id: facility, name: "Cơ sở" } as CustomerFacility])

              const allPackages = packageRead.data || []

              for (const targetFac of targetFacilities) {
                let facRev = 0
                try {
                  const existing = await getStoredIntegrationPolicy("renewal", targetFac.id)
                  facRev = existing.revision
                } catch {
                  facRev = 0
                }

                const facPackages = allPackages.filter((p) => p.facilityId === targetFac.id && p.active)
                const facEligible = facPackages.filter((p) => selectedPackageIds.has(p.id)).map((p) => p.id)

                const facInput: RenewalPolicyInput = {
                  expectedRevision: facRev,
                  effectiveFrom: draft.effectiveFrom || "2020-01-01",
                  effectiveTo: draft.effectiveTo || null,
                  paymentWindowHours: Number(draft.paymentWindowHours || 24),
                  depositRate: Number(draft.depositRate || 0),
                  eligiblePackageIds: facEligible,
                  signing: draft.signingEnabled === "true" ? {
                    signingWindowMinutes: Number(draft.signingWindowMinutes || 120),
                    exceptionExtensionLimitMinutes: Number(draft.exceptionExtensionLimitMinutes || 60),
                  } : null,
                  term: draft.urgentThroughDay ? {
                    calendar: 'CALENDAR_DAYS',
                    timezone: 'Asia/Ho_Chi_Minh',
                    warningThroughDay: Number(draft.warningThroughDay || 3),
                    seriousThroughDay: Number(draft.seriousThroughDay || 6),
                    urgentThroughDay: Number(draft.urgentThroughDay || 7),
                    recoveryFromDay: Number(draft.urgentThroughDay || 7) + 1,
                    recoveryCutoffTime: draft.recoveryCutoffTime || '17:00:00',
                    recoveryStartTime: draft.recoveryStartTime || '08:00:00',
                  } : undefined,
                }

                await publishIntegrationPolicy("renewal", targetFac.id, facInput)
              }

              pending.current = undefined
              clearPendingPolicy(pendingKey)
              isDirty.current = false
              setUncertain(false)
              setMessage(
                applyAllFacilities
                  ? `Đã lưu và áp dụng chính sách gia hạn thành công cho toàn bộ ${targetFacilities.length} cơ sở trong hệ thống!`
                  : `Đã lưu và áp dụng chính sách gia hạn thành công cho cơ sở ${targetFacilities[0]?.name || ''}!`
              )
              read.refresh()
            } else {
              const actual = await publishIntegrationPolicy(kind, facility, baseInput)
              if (!policyMatches(actual, baseInput, actor.id))
                throw new ApiClientError("Chưa đối chiếu được chính sách.", {
                  code: "INVALID_RESPONSE",
                })
              pending.current = undefined
              clearPendingPolicy(pendingKey)
              isDirty.current = false
              setUncertain(false)
              setDraft(policyDraft(actual))
              setMessage("Đã lưu chính sách.")
              read.refresh()
            }
          } catch (err) {
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
            } else retainPendingPolicy(pendingKey, baseInput, err instanceof ApiClientError && err.status === 409)
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        <fieldset
          disabled={!canWrite || busy || uncertain || conflict || read.loading}
          className="space-y-5"
        >
          <input type="hidden" value={draft.expectedRevision || ""} readOnly />
          {kind === "renewal" ? (
            <>
              {/* 1. Hiệu lực chính sách */}
              <section className="rounded-xl border border-stone-200 p-4 bg-stone-50/30">
                <div className="flex items-center gap-2 mb-3">
                  
                  <div>
                    <h4 className="font-semibold text-stone-900">Hiệu lực chính sách</h4>
                    <p className="text-xs text-stone-500">Khoảng thời gian chính sách gia hạn có hiệu lực thi hành.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">{field("effectiveFrom")}{field("effectiveTo", true)}</div>
              </section>

              {/* 2. Gói gia hạn áp dụng */}
              <section ref={section2Ref} className="rounded-xl border border-stone-200 p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-stone-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-stone-900">Gói gia hạn được áp dụng</h4>
                      <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-xs font-bold border border-amber-200">
                        {selectedPackageIds.size} gói đã chọn
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Chọn cơ sở từ thanh lọc phía trên để xem nhanh hoặc bấm vào từng thẻ bên dưới để tùy chọn các gói gia hạn.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canWrite && (
                      <div className="flex gap-1.5 mr-2">
                        <button
                          type="button"
                          onClick={() => {
                            isDirty.current = true
                            const allIds = availablePackages.map((p) => p.id)
                            setDraft((d) => ({ ...d, eligiblePackageIds: allIds.join(", ") }))
                          }}
                          className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 cursor-pointer transition"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            isDirty.current = true
                            setDraft((d) => ({ ...d, eligiblePackageIds: "" }))
                          }}
                          className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 cursor-pointer transition"
                        >
                          Bỏ chọn tất cả
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={expandAll}
                      className="rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 text-xs font-medium cursor-pointer transition"
                    >
                      Mở rộng tất cả
                    </button>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 text-xs font-medium cursor-pointer transition"
                    >
                      Thu gọn tất cả
                    </button>
                  </div>
                </div>

                {packageRead.loading && <p className="text-xs text-stone-500">Đang tải danh sách gói...</p>}
                {Boolean(packageRead.error) && (
                  <div role="alert" className="flex items-center justify-between rounded-lg bg-red-50 p-3 text-xs text-red-700">
                    <span>{integrationError(packageRead.error)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        read.refresh()
                        packageRead.refresh()
                      }}
                      className="ml-3 font-semibold text-red-800 underline hover:text-red-950 cursor-pointer"
                    >
                      Thử tải lại
                    </button>
                  </div>
                )}
                {!packageRead.loading && !packageRead.error && !availablePackages.length && (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Hệ thống chưa có gói thuê đang hoạt động.</p>
                )}

                {/* Quick Pills Filter Bar */}
                {Object.keys(packagesByFacility).length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <span className="text-stone-400 font-semibold whitespace-nowrap text-[11px]">Lọc nhanh:</span>
                    <button
                      type="button"
                      onClick={() => handleSelectFacilityTab("all")}
                      className={`px-3 py-1 rounded-full font-bold cursor-pointer transition whitespace-nowrap ${
                        selectedFacilityTab === "all"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200"
                      }`}
                    >
                      Tất cả cơ sở ({Object.keys(packagesByFacility).length})
                    </button>
                    {Object.entries(packagesByFacility).map(([facName, pkgs]) => {
                      const count = pkgs.filter((p) => selectedPackageIds.has(p.id)).length
                      const isSelected = selectedFacilityTab === facName
                      const isPillActive = isSelected || activeFacilityName === facName
                      return (
                        <button
                          key={facName}
                          type="button"
                          onClick={() => handleSelectFacilityTab(facName)}
                          className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition whitespace-nowrap flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-amber-600 text-white font-bold shadow-xs"
                              : isPillActive
                                ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                                : "bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200"
                          }`}
                        >
                          <span>{facName}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isSelected
                              ? "bg-amber-700 text-white"
                              : count > 0
                                ? "bg-amber-100 text-amber-900"
                                : "bg-stone-200 text-stone-500"
                          }`}>
                            {count}/{pkgs.length}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Accordion List */}
                {Object.keys(packagesByFacility).length > 0 && (
                  <div className="space-y-3 pt-1">
                    {Object.entries(packagesByFacility)
                      .filter(([facName]) => selectedFacilityTab === "all" || selectedFacilityTab === facName)
                      .map(([facName, pkgs]) => {
                        const isOpen = openFacilityNames.has(facName)
                        const isOrange = isOpen
                        const selectedCount = pkgs.filter((p) => selectedPackageIds.has(p.id)).length
                        const hasSelected = selectedCount > 0

                        return (
                          <div
                            key={facName}
                            className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                              isOrange
                                ? "border-amber-400 bg-amber-50/20 shadow-xs ring-1 ring-amber-300/50"
                                : "border-stone-200 bg-white hover:border-stone-300"
                            }`}
                          >
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => toggleFacilityAccordion(facName)}
                              className={`w-full flex items-center justify-between p-3.5 text-left select-none transition-colors duration-150 cursor-pointer ${
                                isOrange
                                  ? "bg-amber-100/60 hover:bg-amber-100/80"
                                  : "bg-stone-50/40 hover:bg-stone-100/70"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                                    isOrange
                                      ? "bg-amber-500 ring-2 ring-amber-200 scale-110"
                                      : "bg-stone-400"
                                  }`}
                                ></span>
                                <span
                                  className={`font-bold text-xs uppercase tracking-wider transition-colors ${
                                    isOrange ? "text-amber-950 font-extrabold" : "text-stone-800"
                                  }`}
                                >
                                  {facName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border transition-colors ${
                                    isOrange
                                      ? "bg-amber-200/90 text-amber-950 border-amber-300 font-bold shadow-xs"
                                      : hasSelected
                                        ? "bg-stone-100 text-stone-700 border-stone-200 font-medium"
                                        : "bg-stone-100 text-stone-500 border-stone-200"
                                  }`}
                                >
                                  {selectedCount}/{pkgs.length} gói đã chọn
                                </span>
                                <span
                                  className={`text-xs transition-transform duration-200 inline-block transform ${
                                    isOpen ? "rotate-180" : ""
                                  } ${isOrange ? "text-amber-700 font-bold" : "text-stone-400"}`}
                                >
                                  ▼
                                </span>
                              </div>
                            </button>

                            {isOpen && (
                              <div className="p-3.5 border-t border-stone-200/60 bg-white">
                                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                  {pkgs.map((item) => {
                                    const isChecked = selectedPackageIds.has(item.id)
                                    return (
                                      <label
                                        key={item.id}
                                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                                          isChecked
                                            ? "border-amber-400 bg-amber-50/70 shadow-xs"
                                            : "border-stone-200 bg-white hover:border-stone-300"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-1 accent-amber-600 rounded cursor-pointer"
                                          checked={isChecked}
                                          disabled={!canWrite || busy}
                                          onChange={(e) => {
                                            setActiveFacilityName(facName)
                                            setPackageSelected(item.id, e.target.checked)
                                          }}
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="block font-semibold text-xs text-stone-900">{item.name}</span>
                                          <span className="mt-0.5 block text-[11px] text-stone-500">
                                            {item.rentalMonths} tháng{item.discountRate > 0 ? `, giảm ${Math.round(item.discountRate * 100)}%` : ""}
                                          </span>
                                        </span>
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
                                          Hoạt động
                                        </span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                {!!inactiveSelectedPackages.length && (
                  <details className="mt-3 rounded-lg border border-stone-200 p-3 text-xs text-stone-600">
                    <summary className="cursor-pointer font-medium">Gói đã chọn đang tạm ngưng ({inactiveSelectedPackages.length})</summary>
                    <p className="mt-2 text-stone-500">Các gói này được giữ từ chính sách đã lưu. Bỏ chọn khi chỉnh sửa để loại khỏi chính sách.</p>
                    <div className="mt-2 space-y-2">
                      {inactiveSelectedPackages.map((item) => (
                        <label key={item.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked
                            disabled={!canWrite || busy}
                            onChange={(e) => setPackageSelected(item.id, e.target.checked)}
                          />
                          <span>{item.name} · {item.rentalMonths} tháng</span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </section>

              {/* 3. Quá hạn và thu hồi (Timeline Stepper) */}
              {overdueTerm && (
                <section className="rounded-xl border border-stone-200 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-orange-100 text-orange-800 rounded-lg text-sm">⏳</span>
                    <div>
                      <h4 className="font-semibold text-stone-900">Quy trình xử lý quá hạn & Thu hồi kho</h4>
                      <p className="text-xs text-stone-500">Tiến trình chuẩn tự động áp dụng khi khách hàng chậm gia hạn hợp đồng.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-1">
                    {/* Giai đoạn 1 */}
                    <div className="relative rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">Giai đoạn 1</span>
                        <span className="text-xs text-amber-800 font-bold">Ngày 1 đến {overdueTerm.urgentThroughDay} sau khi hết hạn thuê</span>
                      </div>
                      <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5 pt-1">
                        Nhắc khách hoàn tất gia hạn hoặc trả kho
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Hệ thống tự động thông báo nhắc khách hàng hoàn tất thủ tục gia hạn hoặc bàn giao trả kho.
                      </p>
                    </div>

                    {/* Giai đoạn 2 */}
                    <div className="relative rounded-xl border border-orange-200 bg-orange-50/50 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-200 text-orange-900">Giai đoạn 2</span>
                        <span className="text-xs text-orange-800 font-bold">{overdueTerm.recoveryCutoffTime.slice(0, 5)} ngày {overdueTerm.urgentThroughDay}</span>
                      </div>
                      <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5 pt-1">
                        <span>⏰</span> Hết thời gian hoàn tất gia hạn
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Chính thức hết thời gian gia hạn tự phục vụ. Chốt danh sách hợp đồng chưa hoàn tất thanh toán.
                      </p>
                    </div>

                    {/* Giai đoạn 3 */}
                    <div className="relative rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900">Giai đoạn 3</span>
                        <span className="text-xs text-rose-800 font-bold">Từ {overdueTerm.recoveryStartTime.slice(0, 5)} ngày {overdueTerm.recoveryFromDay}</span>
                      </div>
                      <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5 pt-1">
                        Chuyển hồ sơ sang xử lý thu hồi khi đủ điều kiện
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Chuyển hồ sơ sang quy trình xử lý thu hồi, niêm phong tài sản và thanh lý kho theo quy định.
                      </p>
                    </div>
                  </div>

                  {canWrite && (
                    <div className="mt-3 pt-3 border-t border-stone-200 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-stone-50/60 p-3 rounded-lg text-xs">
                      <div>
                        <label className="block font-medium text-stone-700">Ngày kết thúc cảnh báo 1</label>
                        <input
                          className={inputClass}
                          type="number"
                          min={1}
                          value={draft.warningThroughDay || "3"}
                          onChange={(e) => {
                            isDirty.current = true
                            setDraft((d) => ({ ...d, warningThroughDay: e.target.value }))
                          }}
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-stone-700">Ngày kết thúc cảnh báo 2</label>
                        <input
                          className={inputClass}
                          type="number"
                          min={2}
                          value={draft.seriousThroughDay || "6"}
                          onChange={(e) => {
                            isDirty.current = true
                            setDraft((d) => ({ ...d, seriousThroughDay: e.target.value }))
                          }}
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-stone-700">Hạn chót gia hạn (ngày)</label>
                        <input
                          className={inputClass}
                          type="number"
                          min={3}
                          value={draft.urgentThroughDay || "7"}
                          onChange={(e) => {
                            isDirty.current = true
                            setDraft((d) => ({ ...d, urgentThroughDay: e.target.value }))
                          }}
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-stone-700">Giờ chốt hạn gia hạn</label>
                        <input
                          className={inputClass}
                          type="time"
                          value={(draft.recoveryCutoffTime || "17:00:00").slice(0, 5)}
                          onChange={(e) => {
                            isDirty.current = true
                            setDraft((d) => ({ ...d, recoveryCutoffTime: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value }))
                          }}
                        />
                      </div>
                    </div>
                  )}
                </section>
              )}
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
                    Khách hàng có thể đóng yêu cầu
                    <select
                      className={inputClass}
                      required
                      value={draft.customerMayClose || ""}
                      onChange={(e) => {
                        isDirty.current = true
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
                  </label>
                </>
              )}
            </>
          )}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4">
          {canWrite && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy || read.loading}
                onClick={() => {
                  isDirty.current = false
                  setDraft(read.data ? policyDraft(read.data) : {})
                  setMessage(undefined)
                  setError(undefined)
                  setConflict(false)
                }}
              >
                Đặt lại thay đổi
              </Button>
              <Button type="submit" disabled={!canWrite || busy || conflict || read.loading}>
                {busy
                  ? "Đang lưu & đồng bộ..."
                  : uncertain
                    ? "Thử lại cùng yêu cầu"
                    : (applyAllFacilities
                        ? "Lưu & Áp dụng cho toàn bộ cơ sở"
                        : "Lưu & Áp dụng cho cơ sở này")}
              </Button>
            </>
          )}
        </div>
      </form>
      {(uncertain || conflict) && (
        <>
          <p role="status">
            {uncertain
              ? "Chưa xác định được kết quả. Không đổi nội dung hoặc tải lại trang, cần đối chiếu chính sách hoặc thử lại cùng yêu cầu."
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

export default function DuongPolicyWorkspace({
  user,
  onLocked,
}: {
  user?: User
  onLocked?: (value: boolean) => void
}) {
  const authenticatedActor = getAuthenticatedActor()
  const actor =
    authenticatedActor ||
    (!isApiAuthenticated() && user && user.role === "business"
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
  const [facility, setFacility] = useState(""),
    [rentalInput, setRentalInput] = useState("")
  const [rental, setRental] = useState("")
  const [locked, setLocked] = useState(false)
  const [applyAllFacilities, setApplyAllFacilities] = useState(false)
  const [activeMainTab, setActiveMainTab] = useState<"renewal" | "communication" | "business-config" | "ledger">("renewal")

  useEffect(() => {
    onLocked?.(locked)
  }, [locked, onLocked])

  const read = useRentalApiResource(
    `${actor?.id}:integration-facilities:${allowed}`,
    async () => {
      if (!allowed) return null
      const p = await apiRequest<PageResponse<CustomerFacility>>(
        `/api/facilities?page=0&size=50`,
      )
      if (
        !Array.isArray(p.data) ||
        !p.data.every((f) => isUuid(f.id) && typeof f.name === "string")
      )
        throw new ApiClientError("Danh sách cơ sở không hợp lệ.", {
          code: "INVALID_RESPONSE",
        })
      return p
    },
  )

  useEffect(() => {
    if (!facility && !read.loading && read.data?.data && read.data.data.length > 0) {
      const firstFacility = read.data.data[0]
      if (firstFacility) setFacility(firstFacility.id)
    }
  }, [facility, read.data, read.loading])

  if (!allowed)
    return (
      <p role="alert">
        Cần đăng nhập bằng tài khoản giám đốc thương mại có quyền xem chính
        sách.
      </p>
    )

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-stone-200/60">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Thiết lập toàn hệ thống</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">Chính sách gia hạn & Vận hành</h2>
          <p className="mt-1 text-sm text-stone-500">Quản lý điều kiện gia hạn, gói thuê áp dụng, nhắc hạn hỗ trợ và tham số vận hành tài chính StorageHub.</p>
        </div>
        <div className="flex flex-wrap items-center bg-stone-100 p-1 rounded-xl border border-stone-200 shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setActiveMainTab("renewal")}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer ${
              activeMainTab === "renewal"
                ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Chính sách gia hạn
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab("communication")}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer ${
              activeMainTab === "communication"
                ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Nhắc hạn & Hỗ trợ
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab("business-config")}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer ${
              activeMainTab === "business-config"
                ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Cấu hình vận hành
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab("ledger")}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer ${
              activeMainTab === "ledger"
                ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Tra cứu tài chính
          </button>
        </div>
      </header>

      {read.loading && (
        <Card className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm" role="status">
          Đang tải danh sách cơ sở và chính sách gia hạn...
        </Card>
      )}

      {!!read.error && (
        <Card className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 shadow-sm" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{integrationError(read.error)}</span>
            <Button type="button" variant="outline" onClick={() => read.refresh()}>
              Thử tải lại
            </Button>
          </div>
        </Card>
      )}

      {!read.loading && !read.error && read.data?.data.length === 0 && (
        <Card className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <h3 className="font-semibold text-stone-900">Chưa có cơ sở để tạo chính sách</h3>
          <p className="mt-1 text-sm text-stone-600">Hãy tạo và kích hoạt ít nhất một cơ sở trước khi cấu hình chính sách gia hạn.</p>
        </Card>
      )}

      {(activeMainTab === "renewal" || activeMainTab === "communication") && (
        <>
          {/* Bảng thông tin phạm vi áp dụng */}
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-stone-50 to-white p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 font-bold shrink-0">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900 text-sm">Cơ sở đang thao tác:</span>
                    <select
                      className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-100 cursor-pointer"
                      value={facility}
                      onChange={(e) => setFacility(e.target.value)}
                    >
                      {read.data?.data.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.city})
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-amber-100/70 border border-amber-200 px-2.5 py-1 rounded-lg cursor-pointer ml-1">
                      <input
                        type="checkbox"
                        checked={applyAllFacilities}
                        onChange={(e) => setApplyAllFacilities(e.target.checked)}
                        className="rounded accent-amber-600"
                      />
                      <span>Đồng bộ cho tất cả ({read.data?.data.length || 0} cơ sở)</span>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {applyAllFacilities
                      ? "Chế độ đồng bộ: Mọi thay đổi khi lưu sẽ tự động ghi đè và áp dụng cho toàn bộ cơ sở trong hệ thống."
                      : "Chế độ riêng biệt: Chính sách chỉ áp dụng riêng cho cơ sở được chọn ở trên."}
                  </p>
                </div>
              </div>
            </div>

            {read.data?.data && read.data.data.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-stone-200/60">
                {read.data.data.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => {
                      setFacility(f.id)
                      setApplyAllFacilities(false)
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition cursor-pointer ${
                      facility === f.id && !applyAllFacilities
                        ? "bg-amber-600 text-white border-amber-700 font-bold shadow-xs"
                        : "bg-white text-stone-700 border-stone-200 hover:border-amber-300"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${facility === f.id && !applyAllFacilities ? "bg-white" : "bg-amber-500"}`}></span>
                    <span>{f.name}</span>
                    <span className={facility === f.id && !applyAllFacilities ? "text-amber-200" : "text-stone-400"}>· {f.city}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {facility && (
            <PolicyEditor
              key={`${actor!.id}:${facility}:${activeMainTab}`}
              facility={facility}
              facilitiesList={read.data?.data || []}
              applyAllFacilities={applyAllFacilities}
              kind={activeMainTab as PolicyKind}
              actor={actor!}
              onLocked={setLocked}
            />
          )}
        </>
      )}

      {activeMainTab === "business-config" && (
        <BusinessConfigPanel canWrite={allowed} />
      )}

      {activeMainTab === "ledger" && (
        <Card className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              
              <div>
                <h3 className="font-semibold text-stone-900 text-base">
                  Tra cứu các khoản tài chính của hồ sơ thuê
                </h3>
                <p className="mt-0.5 text-xs text-stone-500">Tra cứu chi tiết các bút toán ghi nợ, lịch sử thanh toán gia hạn và tiền gửi bằng mã hồ sơ thuê.</p>
              </div>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (isUuid(rentalInput.trim())) setRental(rentalInput.trim())
            }}
          >
            <label className="block text-sm font-medium text-stone-700">
              Mã hồ sơ thuê (UUID)
              <input
                className="mt-2 block w-full rounded-xl border border-stone-300 px-3.5 py-2.5 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                placeholder="Ví dụ: e4b2d3c1-..."
                value={rentalInput}
                onChange={(e) => setRentalInput(e.target.value)}
              />
            </label>
            <Button className="mt-3.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold" type="submit" disabled={!isUuid(rentalInput.trim())}>
              Tra cứu hồ sơ
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
      )}
    </div>
  )
}
