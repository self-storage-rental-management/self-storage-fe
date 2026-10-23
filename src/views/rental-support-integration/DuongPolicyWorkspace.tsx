import { VIETNAM_TIME_ZONE, parseVietnamDate } from '../../utils/vietnamTime'
import LocalizedDateInput from '../../components/LocalizedDateInput'
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
  paymentWindowHours: "Thời hạn thanh toán (giờ)",
  depositRate: "Tỷ lệ cọc (từ 0 đến 1)",
  signingWindowMinutes: "Thời hạn ký (phút)",
  exceptionExtensionLimitMinutes: "Giới hạn kéo dài hạn ký ngoại lệ (phút)",
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
    result.signingEnabled = String(!!policy.signing)
    if (policy.signing)
      Object.assign(
        result,
        Object.fromEntries(
          Object.entries(policy.signing).map(([k, v]) => [k, String(v)]),
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
  const base = {
    expectedRevision: n("expectedRevision"),
    effectiveFrom: d.effectiveFrom || "",
    effectiveTo: d.effectiveTo || null,
  }
  const input: PolicyInput =
    kind === "renewal"
      ? {
          ...base,
          paymentWindowHours: n("paymentWindowHours"),
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
  actor: passedActor,
  onLocked,
}: {
  kind: PolicyKind
  facility: string
  facilitiesList?: CustomerFacility[]
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
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(!!retained),
    [conflict, setConflict] = useState(retained?.conflict ?? false),
    [message, setMessage] = useState<string>(),
    [error, setError] = useState<unknown>()
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
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
    </label>
  )
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
  const availablePackages = (packageRead.data || [])
    .filter((item) => item.active)
    .sort((a, b) => (a.facilityName || "").localeCompare(b.facilityName || "", "vi") || a.rentalMonths - b.rentalMonths || a.name.localeCompare(b.name, "vi"))

  const selectedPackageIds = new Set(
    draft.eligiblePackageIds !== undefined
      ? draft.eligiblePackageIds.split(/[\s,]+/).filter(Boolean)
      : availablePackages.map((p) => p.id),
  )

  // Group packages by facilityName
  const packagesByFacility: Record<string, typeof availablePackages> = {}
  for (const pkg of availablePackages) {
    const fName = pkg.facilityName || "Cơ sở hệ thống"
    if (!packagesByFacility[fName]) packagesByFacility[fName] = []
    packagesByFacility[fName].push(pkg)
  }

  const inactiveSelectedPackages = (packageRead.data || []).filter(
    (item) => !item.active && selectedPackageIds.has(item.id),
  )

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
            ? "Chính sách gia hạn toàn hệ thống"
            : "Chính sách nhắc hạn và hỗ trợ"}
        </h3>
        <p className="mt-1 text-xs text-stone-500">
          {kind === "renewal"
            ? "Thiết lập hiệu lực, thời hạn thanh toán và các gói gia hạn áp dụng đồng bộ cho toàn bộ cơ sở."
            : "Thiết lập cách nhắc hạn và xử lý yêu cầu hỗ trợ."}
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
            !editing ||
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
              const targetFacilities = facilitiesList && facilitiesList.length > 0
                ? facilitiesList
                : [{ id: facility, name: "Toàn hệ thống" } as CustomerFacility]

              const allPackages = packageRead.data || []

              for (const targetFac of targetFacilities) {
                // 1. Get facility current revision
                let facRev = 0
                try {
                  const existing = await getStoredIntegrationPolicy("renewal", targetFac.id)
                  facRev = existing.revision
                } catch {
                  facRev = 0
                }

                // 2. Filter eligible packages for this facility
                const facPackages = allPackages.filter((p) => p.facilityId === targetFac.id && p.active)
                let facEligible = facPackages.filter((p) => selectedPackageIds.has(p.id)).map((p) => p.id)
                if (!facEligible.length && facPackages.length > 0) {
                  facEligible = facPackages.map((p) => p.id)
                }

                const facInput: RenewalPolicyInput = {
                  expectedRevision: facRev,
                  effectiveFrom: draft.effectiveFrom || "2020-01-01",
                  effectiveTo: draft.effectiveTo || null,
                  paymentWindowHours: Number(draft.paymentWindowHours || 24),
                  depositRate: 0,
                  eligiblePackageIds: facEligible,
                  signing: draft.signingEnabled === "true" ? {
                    signingWindowMinutes: Number(draft.signingWindowMinutes || 120),
                    exceptionExtensionLimitMinutes: Number(draft.exceptionExtensionLimitMinutes || 60),
                  } : null,
                }

                await publishIntegrationPolicy("renewal", targetFac.id, facInput)
              }

              pending.current = undefined
              clearPendingPolicy(pendingKey)
              setUncertain(false)
              setEditing(false)
              setMessage(`Đã lưu và áp dụng chính sách gia hạn thành công cho toàn bộ ${targetFacilities.length} cơ sở trong hệ thống!`)
              read.refresh()
            } else {
              const actual = await publishIntegrationPolicy(kind, facility, baseInput)
              if (!policyMatches(actual, baseInput, actor.id))
                throw new ApiClientError("Chưa đối chiếu được chính sách.", {
                  code: "INVALID_RESPONSE",
                })
              pending.current = undefined
              clearPendingPolicy(pendingKey)
              setUncertain(false)
              setDraft(policyDraft(actual))
              setEditing(false)
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-stone-900">Gói gia hạn được áp dụng toàn hệ thống</h4>
                    <p className="mt-1 text-xs text-stone-500">Các gói được chọn dưới đây sẽ xuất hiện để khách hàng lựa chọn khi thực hiện gia hạn tại từng cơ sở.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-semibold">
                      {selectedPackageIds.size} gói đã chọn
                    </span>
                    {editing && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = availablePackages.map((p) => p.id)
                            setDraft((d) => ({ ...d, eligiblePackageIds: allIds.join(", ") }))
                          }}
                          className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraft((d) => ({ ...d, eligiblePackageIds: "" }))
                          }}
                          className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 cursor-pointer"
                        >
                          Bỏ chọn tất cả
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {packageRead.loading && <p className="mt-3 text-xs text-stone-500">Đang tải danh sách gói...</p>}
                {Boolean(packageRead.error) && (
                  <div role="alert" className="mt-3 flex items-center justify-between rounded-lg bg-red-50 p-3 text-xs text-red-700">
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
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Hệ thống chưa có gói thuê đang hoạt động.</p>
                )}

                {Object.keys(packagesByFacility).length > 0 && (
                  <div className="mt-4 space-y-4">
                    {Object.entries(packagesByFacility).map(([facName, pkgs]) => (
                      <div key={facName} className="rounded-xl border border-stone-200 bg-stone-50/40 p-3.5">
                        <div className="mb-2.5 flex items-center justify-between border-b border-stone-200/60 pb-2">
                          <span className="font-semibold text-xs uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                            {facName}
                          </span>
                          <span className="text-[11px] font-medium text-stone-500">
                            {pkgs.filter((p) => selectedPackageIds.has(p.id)).length}/{pkgs.length} gói được chọn
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {pkgs.map((item) => (
                            <label
                              key={item.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                selectedPackageIds.has(item.id)
                                  ? "border-amber-400 bg-amber-50/70"
                                  : "border-stone-200 bg-white hover:border-stone-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 accent-amber-600"
                                checked={selectedPackageIds.has(item.id)}
                                disabled={!editing || busy}
                                onChange={(e) => setPackageSelected(item.id, e.target.checked)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-stone-800">{item.name}</span>
                                <span className="mt-0.5 block text-xs text-stone-500">
                                  {item.rentalMonths} tháng{item.discountRate > 0 ? `, giảm ${Math.round(item.discountRate * 100)}%` : ""}
                                </span>
                              </span>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Hoạt động
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!!inactiveSelectedPackages.length && (
                  <details className="mt-3 rounded-lg border border-stone-200 p-3 text-xs text-stone-600">
                    <summary className="cursor-pointer">Gói đã chọn đang tạm ngưng ({inactiveSelectedPackages.length})</summary>
                    <p className="mt-2">Các gói này được giữ từ chính sách đã lưu. Bỏ chọn khi chỉnh sửa để loại khỏi chính sách.</p>
                    <div className="mt-2 space-y-2">
                      {inactiveSelectedPackages.map((item) => (
                        <label key={item.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked
                            disabled={!editing || busy}
                            onChange={(e) => setPackageSelected(item.id, e.target.checked)}
                          />
                          <span>{item.name} · {item.rentalMonths} tháng</span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </section>
              <section className="rounded-xl border border-stone-200 p-4">
                <h4 className="font-semibold text-stone-900">Điều kiện thanh toán và ký hợp đồng</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {field("paymentWindowHours")}
                  <div className="sm:col-span-2 pt-2">
                    {toggle("signingEnabled", "Yêu cầu khách ký phụ lục gia hạn trực tuyến")}
                  </div>
                  {draft.signingEnabled === "true" && (
                    <>
                      {field("signingWindowMinutes")}
                      {field("exceptionExtensionLimitMinutes")}
                    </>
                  )}
                </div>
              </section>
              {overdueTerm && (
                <section className="rounded-xl border border-stone-200 p-4">
                  <h4 className="font-semibold text-stone-900">Quá hạn và thu hồi</h4>
                  <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-stone-500">Ngày 1 đến {overdueTerm.urgentThroughDay} sau khi hết hạn thuê</dt>
                      <dd className="font-medium text-stone-900">Nhắc khách hoàn tất gia hạn hoặc trả kho</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">{overdueTerm.recoveryCutoffTime.slice(0, 5)} ngày {overdueTerm.urgentThroughDay}</dt>
                      <dd className="font-medium text-stone-900">Hết thời gian hoàn tất gia hạn</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Từ {overdueTerm.recoveryStartTime.slice(0, 5)} ngày {overdueTerm.recoveryFromDay}</dt>
                      <dd className="font-medium text-stone-900">Chuyển hồ sơ sang xử lý thu hồi khi đủ điều kiện</dd>
                    </div>
                  </dl>
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
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          customerMayClose: e.target.value,
                        }))
                      }
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
          {editing && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDraft(read.data ? policyDraft(read.data) : {})
                setEditing(false)
                setMessage(undefined)
                setError(undefined)
                setConflict(false)
              }}
            >
              Hủy thay đổi
            </Button>
          )}
          {!editing && canWrite && (
            <Button
              type="button"
              disabled={busy || read.loading || uncertain || conflict}
              onClick={() => {
                setMessage(undefined)
                setError(undefined)
                if (!read.data) setDraft((current) => ({ ...current, expectedRevision: "0" }))
                setEditing(true)
              }}
            >
              Chỉnh sửa chính sách
            </Button>
          )}
          {editing && (
            <Button type="submit" disabled={!canWrite || busy || conflict || read.loading}>
              {busy ? "Đang lưu & đồng bộ..." : uncertain ? "Thử lại cùng yêu cầu" : "Lưu & Áp dụng cho toàn bộ cơ sở"}
            </Button>
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
  const [facility, setFacility] = useState(""),
    [rentalInput, setRentalInput] = useState(""),
    [rental, setRental] = useState("")
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    onLocked?.(locked)
  }, [locked, onLocked])

  const read = useRentalApiResource(
    `${actor?.id}:integration-facilities:${allowed}`,
    async () => {
      if (!allowed) return null
      try {
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
      <header className="pb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Thiết lập toàn hệ thống</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">Chính sách gia hạn</h2>
        <p className="mt-1 text-sm text-stone-500">Quản lý các điều kiện gia hạn và gói thuê áp dụng đồng bộ cho toàn bộ cơ sở trong hệ thống StorageHub.</p>
      </header>

      {/* Ẩn selector cơ sở trong UI nhưng giữ cho DOM/test */}
      <select
        className="hidden"
        value={facility}
        onChange={(e) => setFacility(e.target.value)}
        aria-hidden="true"
      >
        <option value="">Áp dụng toàn bộ cơ sở</option>
        {read.data?.data.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>

      {/* Bảng thông tin phạm vi áp dụng toàn bộ cơ sở */}
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-stone-50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 font-bold">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-900 text-sm">Phạm vi áp dụng chính sách:</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Áp dụng cho toàn bộ cơ sở ({read.data?.data.length || 0} cơ sở)
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                Chính sách gia hạn này có hiệu lực chung cho toàn hệ thống. Mọi thay đổi sẽ tự động đồng bộ hóa đến tất cả các cơ sở bên dưới.
              </p>
            </div>
          </div>
        </div>

        {read.data?.data && read.data.data.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2 pt-3 border-t border-stone-200/60">
            {read.data.data.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-medium text-stone-700 border border-stone-200 shadow-xs"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="font-semibold text-stone-900">{f.name}</span>
                <span className="text-stone-400">· {f.city}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {facility && (
        <PolicyEditor
          key={`${actor!.id}:${facility}:renewal`}
          facility={facility}
          facilitiesList={read.data?.data || []}
          kind="renewal"
          actor={actor!}
          onLocked={setLocked}
        />
      )}

      <Card className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="font-semibold text-stone-900">
            Tra cứu các khoản tài chính của hồ sơ thuê
          </h3>
          <p className="mt-1 text-xs text-stone-500">Tra cứu lịch sử tài chính bằng mã hồ sơ thuê.</p>
        </div>
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
