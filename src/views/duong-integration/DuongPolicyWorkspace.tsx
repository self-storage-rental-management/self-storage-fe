import { useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { ApiClientError, apiRequest } from "../../services/apiClient"
import { getAuthenticatedActor } from "../../services/authApi"
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
  if ("eligiblePackageIds" in policy) {
    result.eligiblePackageIds = policy.eligiblePackageIds.join(", ")
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
  const base = {
    expectedRevision: n("expectedRevision"),
    effectiveFrom: d.effectiveFrom || "",
    effectiveTo: d.effectiveTo || null,
  }
  const input: PolicyInput =
    kind === "renewal"
      ? {
          ...base,
          quoteTtlMinutes: n("quoteTtlMinutes"),
          paymentWindowHours: n("paymentWindowHours"),
          requestWindowDays: n("requestWindowDays"),
          depositRate: n("depositRate"),
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
  onLocked,
}: {
  kind: PolicyKind
  facility: string
  onLocked: (value: boolean) => void
}) {
  const actor = getAuthenticatedActor()!
  const pendingKey = policyPendingKey(actor.id, facility, kind)
  const retained = readPendingPolicy(pendingKey)
  const read = useRentalApiResource(
    `${actor.id}:${facility}:${kind}:${JSON.stringify(actor.permissions)}`,
    () => getStoredIntegrationPolicy(kind, facility),
  )
  const [draft, setDraft] = useState<Draft>(() => retained ? policyDraft(retained.input) : {}),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(!!retained),
    [conflict, setConflict] = useState(retained?.conflict ?? false),
    [message, setMessage] = useState<string>(),
    [error, setError] = useState<unknown>()
  const pending = useRef<PolicyInput | undefined>(retained?.input),
    lock = useRef(false)
  useEffect(() => {
    onLocked(busy)
    return () => onLocked(false)
  }, [busy, onLocked])
  useEffect(() => {
    if (read.data && !pending.current) setDraft(policyDraft(read.data))
  }, [read.data])
  useEffect(() => {
    if (!uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [uncertain])
  const canWrite =
    actor.status === "ACTIVE" &&
    actor.roles.includes("BUSINESS") &&
    actor.permissions.includes("policies:update")
  const inputClass =
    "mt-1 block w-full rounded border border-stone-300 px-3 py-2"
  const field = (key: string, optional = false) => (
    <label key={key} className="block">
      {labels[key]}
      <input
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
    if (lock.current || getAuthenticatedActor()?.id !== actor.id) return
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
  return (
    <Card className="p-4 space-y-4 text-sm">
      <h3 className="font-semibold">
        {kind === "renewal"
          ? "Chính sách gia hạn và quá hạn"
          : "Chính sách nhắc hạn và hỗ trợ"}
      </h3>
      {read.loading && <p role="status">Đang tải chính sách...</p>}
      {!!read.error && <p role="alert">{integrationError(read.error)}</p>}
      {read.error instanceof ApiClientError && read.error.status === 404 && (
        <p>
          Không tự xác định lần cập nhật bằng 0 khi chưa đọc được chính sách.
          Chỉ tạo mới sau khi xác nhận cơ sở chưa có chính sách này.
        </p>
      )}
      {read.data && (
        <p>
          Cập nhật lúc:{" "}
          {new Date(read.data.publishedAt).toLocaleString("vi-VN")}
        </p>
      )}
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            lock.current ||
            conflict ||
            !canWrite ||
            getAuthenticatedActor()?.id !== actor.id ||
            !getAuthenticatedActor()?.permissions.includes("policies:update")
          )
            return
          let input: PolicyInput
          try {
            input = pending.current || buildPolicyInput(kind, draft)
          } catch {
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
          disabled={!canWrite || busy || uncertain || conflict || read.loading}
          className="grid gap-3 sm:grid-cols-2"
        >
          {field("expectedRevision")}
          {field("effectiveFrom")}
          {field("effectiveTo", true)}
          {kind === "renewal" ? (
            <>
              {[
                "quoteTtlMinutes",
                "paymentWindowHours",
                "requestWindowDays",
                "depositRate",
              ].map((k) => field(k))}
              <label className="block">
                Mã gói thuê đủ điều kiện (cách nhau bằng dấu phẩy, để trống nếu
                không có)
                <textarea
                  className={inputClass}
                  value={draft.eligiblePackageIds || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      eligiblePackageIds: e.target.value,
                    }))
                  }
                />
              </label>
              {toggle("signingEnabled", "Cấu hình thời hạn ký")}
              {draft.signingEnabled === "true" &&
                ["signingWindowMinutes", "exceptionExtensionLimitMinutes"].map(
                  (k) => field(k),
                )}
              {toggle(
                "termEnabled",
                "Cấu hình các mức quá hạn (ngày lịch, giờ Việt Nam)",
              )}
              {draft.termEnabled === "true" &&
                [
                  "warningThroughDay",
                  "seriousThroughDay",
                  "urgentThroughDay",
                  "recoveryFromDay",
                  "recoveryCutoffTime",
                  "recoveryStartTime",
                ].map((k) => field(k))}
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
        <Button
          type="submit"
          disabled={!canWrite || busy || conflict || read.loading}
        >
          {uncertain ? "Thử lại cùng yêu cầu" : "Lưu chính sách"}
        </Button>
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
      {message && <p role="status">{message}</p>}
      {!!error && <p role="alert">{integrationError(error)}</p>}
      {!canWrite && <p>Chỉ có thể xem chính sách với quyền hiện tại.</p>}
    </Card>
  )
}
export default function DuongPolicyWorkspace({
  onLocked,
}: {
  onLocked?: (value: boolean) => void
}) {
  const actor = getAuthenticatedActor()
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
    },
  )
  if (!allowed)
    return (
      <p role="alert">
        Cần đăng nhập bằng tài khoản giám đốc thương mại có quyền xem chính
        sách.
      </p>
    )
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Chính sách gia hạn và hỗ trợ</h2>
      {read.loading && <p role="status">Đang tải cơ sở...</p>}
      {!!read.error && <p role="alert">{integrationError(read.error)}</p>}
      <label className="block">
        Cơ sở
        <select
          disabled={locked}
          className="ml-2 rounded border p-2"
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
        Loại chính sách
        <select
          disabled={locked}
          className="ml-2 rounded border p-2"
          value={kind}
          onChange={(e) => setKind(e.target.value as PolicyKind)}
        >
          <option value="renewal">Gia hạn và quá hạn</option>
          <option value="communication">Nhắc hạn và hỗ trợ</option>
        </select>
      </label>
      {facility && (
        <PolicyEditor
          key={`${actor!.id}:${facility}:${kind}`}
          facility={facility}
          kind={kind}
          onLocked={setLocked}
        />
      )}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">
          Tra cứu các khoản tài chính của hồ sơ thuê
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isUuid(rentalInput.trim())) setRental(rentalInput.trim())
          }}
        >
          <label>
            Mã hồ sơ thuê
            <input
              className="ml-2 rounded border p-2"
              value={rentalInput}
              onChange={(e) => setRentalInput(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={!isUuid(rentalInput.trim())}>
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
