import { ApiClientError, apiRequest } from "./apiClient"
import type {
  RentalApiDetail,
  RentalApiPage,
  RentalApiQuery,
  RentalApiRecord,
  RentalApiRole,
} from "../types/rentalApi"

export function invalidRentalResponse(): never {
  throw new ApiClientError("Phản hồi hồ sơ thuê/gia hạn không đúng contract.", {
    code: "INVALID_RESPONSE",
  })
}
export function readRentalEnvelope<T>(
  value: unknown,
  validate: (data: unknown) => boolean,
): T {
  if (
    !value ||
    typeof value !== "object" ||
    !("data" in value) ||
    !validate(value.data)
  )
    return invalidRentalResponse()
  return value.data as T
}
export function readRentalPage<T>(
  value: unknown,
  validate: (data: unknown) => boolean,
  expectedPage?: number,
): RentalApiPage<T> {
  if (
    !value ||
    typeof value !== "object" ||
    !("data" in value) ||
    !Array.isArray(value.data) ||
    !value.data.every(validate) ||
    !("pagination" in value)
  )
    return invalidRentalResponse()
  const p = value.pagination as RentalApiPage<T>["pagination"] | null
  if (
    !p ||
    !Number.isSafeInteger(p.page) ||
    p.page < 0 ||
    !Number.isSafeInteger(p.pageSize) ||
    p.pageSize < 1 ||
    p.pageSize > 100 ||
    !Number.isSafeInteger(p.totalItems) ||
    p.totalItems < 0 ||
    !Number.isSafeInteger(p.totalPages) ||
    p.totalPages !== Math.ceil(p.totalItems / p.pageSize) ||
    value.data.length > p.pageSize ||
    value.data.length > Math.max(0, p.totalItems - p.page * p.pageSize) ||
    typeof p.sort !== "string" ||
    (expectedPage !== undefined && p.page !== expectedPage)
  )
    return invalidRentalResponse()
  return value as RentalApiPage<T>
}
export function rentalQuery(
  query: object,
  keys: string[],
  sorts: string[],
): string {
  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries(query)) {
    if (!keys.includes(key) || raw === undefined || raw === "") continue
    const value = String(raw).trim()
    if (key === "page" && (!Number.isInteger(raw) || Number(raw) < 0))
      throw new Error("Trang không hợp lệ.")
    if (
      key === "size" &&
      (!Number.isInteger(raw) || Number(raw) < 1 || Number(raw) > 100)
    )
      throw new Error("Kích thước trang không hợp lệ.")
    if (key === "search" && value.length > 200)
      throw new Error("Tìm kiếm tối đa 200 ký tự.")
    if (
      key === "sort" &&
      !sorts.some(
        (field) => value === `${field},asc` || value === `${field},desc`,
      )
    )
      throw new Error("Sắp xếp không hợp lệ.")
    if (value) params.set(key, value)
  }
  return params.size ? `?${params.toString()}` : ""
}
export function isRentalRecord(value: unknown): boolean {
  const r = value as RentalApiRecord | null
  return (
    !!r &&
    typeof r.id === "string" &&
    !!r.customer?.id &&
    typeof r.customer.fullName === "string" &&
    !!r.facility?.id &&
    typeof r.facility.name === "string" &&
    !!r.storageUnit?.id &&
    typeof r.storageUnit.code === "string" &&
    !!r.unitType?.id &&
    typeof r.unitType.name === "string" &&
    typeof r.currency === "string" &&
    [
      "active",
      "return_requested",
      "return_inspection",
      "closing",
      "completed",
    ].includes(r.status) &&
    r.currency === "VND" &&
    (r.monthlyPrice === null || (Number.isFinite(r.monthlyPrice) && r.monthlyPrice >= 0)) &&
    Array.isArray(r.dataWarnings) &&
    r.dataWarnings.every(
      (w) => w && typeof w.field === "string" && typeof w.reason === "string",
    )
  )
}
export async function listRentals(
  role: RentalApiRole,
  query: RentalApiQuery = {},
) {
  const suffix = rentalQuery(
    query,
    [
      "page",
      "size",
      "status",
      "search",
      "endFrom",
      "endTo",
      "sort",
      ...(role === "manager" ? ["facilityId"] : []),
    ],
    ["createdAt", "contractEndDate", "startDate", "monthlyPrice", "id"],
  )
  return readRentalPage<RentalApiRecord>(
    await apiRequest(`${rentalReadPath(role)}${suffix}`),
    isRentalRecord,
    query.page ?? 0,
  )
}
function isFinancialSummary(value: unknown): boolean {
  const f = value as RentalApiDetail["financialSummary"] | null
  const money = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
  const date = (v: unknown) => v === null || (
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
  )
  if (!f || f.currency !== "VND" || !date(f.nextDueDate) ||
    !(f.reason === null || typeof f.reason === "string")) return false
  if (f.completeness === "UNKNOWN") return (
    f.outstandingAmount === null && f.overdueAmount === null &&
    f.securityDepositAmount == null && f.billingMode == null &&
    f.nextDueDate === null && !!f.reason?.trim()
  )
  if (!money(f.outstandingAmount) || !money(f.overdueAmount) ||
    f.overdueAmount > f.outstandingAmount ||
    !["PREPAID_FULL_PERIOD", "OTHER"].includes(f.billingMode ?? "") ||
    (f.billingMode === "PREPAID_FULL_PERIOD" && f.nextDueDate !== null)) return false
  if (f.completeness === "PARTIAL")
    return f.securityDepositAmount === null && !!f.reason?.trim()
  return f.completeness === "COMPLETE" && money(f.securityDepositAmount)
}
export async function getRental(role: RentalApiRole, id: string) {
  return readRentalEnvelope<RentalApiDetail>(
    await apiRequest(`${rentalReadPath(role)}/${encodeURIComponent(id)}`),
    (value) => {
      const r = value as RentalApiDetail | null
      if (!isRentalRecord(value) || !r || r.id !== id ||
        !isFinancialSummary(r.financialSummary) || !r.access ||
        !(r.access.reason === null || typeof r.access.reason === "string")) return false
      return r.access.completeness === "UNKNOWN"
        ? r.access.status === null && !!r.access.reason?.trim()
        : r.access.completeness === "COMPLETE" &&
          ["ACTIVE", "INACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"].includes(r.access.status ?? "")
    },
  )
}

// Keep D1's nested read contract separate from the shared Customer list DTO.
function rentalReadPath(role: RentalApiRole) {
  return role === "customer" ? "/api/customer/rental-records" : "/api/manager/rentals"
}
