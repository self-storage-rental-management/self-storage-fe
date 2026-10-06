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
    !Number.isInteger(p.page) ||
    p.page < 0 ||
    !Number.isInteger(p.pageSize) ||
    p.pageSize < 1 ||
    !Number.isInteger(p.totalItems) ||
    p.totalItems < 0 ||
    !Number.isInteger(p.totalPages) ||
    p.totalPages < 0
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
    (r.monthlyPrice === null || Number.isFinite(r.monthlyPrice)) &&
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
    await apiRequest(`/api/${role}/rentals${suffix}`),
    isRentalRecord,
  )
}
export async function getRental(role: RentalApiRole, id: string) {
  return readRentalEnvelope<RentalApiDetail>(
    await apiRequest(`/api/${role}/rentals/${encodeURIComponent(id)}`),
    (value) =>
      isRentalRecord(value) &&
      !!(value as RentalApiDetail).financialSummary &&
      typeof (value as RentalApiDetail).financialSummary.completeness ===
        "string" &&
      ["outstandingAmount", "overdueAmount"].every((field) => {
        const money = (value as RentalApiDetail).financialSummary[
          (field as "outstandingAmount" | "overdueAmount")
        ]
        return money === null || Number.isFinite(money)
      }) &&
      !!(value as RentalApiDetail).access &&
      typeof (value as RentalApiDetail).access.completeness === "string",
  )
}
