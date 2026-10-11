import { ApiClientError, apiRequest } from "../../services/apiClient"
import { isRentalRecord, readRentalEnvelope } from "../../services/rentalApi"
import type { RentalApiRecord } from "../../types/rentalApi"
import type { MaintenanceTaskApi } from "../../services/maintenanceApi"
import { readAllFacilityRows } from "./managerFacilityCatalogApi"
import {
  requireInventoryFacility,
  type InventoryUnit,
} from "./managerInventoryApi"

export type InventoryMaintenance = Pick<MaintenanceTaskApi, "id" | "facilityId" | "storageUnitId" | "unitCode" | "title" | "reason" | "status" | "assignedStaffName" | "dueAt" | "createdAt" | "completedAt">
export interface InventoryAvailability {
  facilityId: string
  unitTypeId: string
  startDate: string
  endDate: string
  availableCount: number
  available: boolean
}
export interface InventoryDateRange {
  startDate: string
  endDate: string
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object"
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim()
export const isInventoryDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
const nullableDate = (v: unknown) => v === null || isInventoryDate(v)
const nullableInstant = (v: unknown) =>
  v === null || (text(v) && Number.isFinite(Date.parse(v)))
export function isInventoryDateRange(range: InventoryDateRange) {
  return (
    isInventoryDate(range.startDate) &&
    isInventoryDate(range.endDate) &&
    range.endDate > range.startDate
  )
}
function invalid(): never {
  throw new ApiClientError(
    "Thông tin nhận được không khớp gian kho hoặc không đầy đủ.",
    { code: "INVALID_RESPONSE" },
  )
}

/** Read-only, all facility pages; never infer the current tenant from a unit status or end date. */
export async function loadInventoryRentals(
  facilityId: string,
): Promise<RentalApiRecord[]> {
  requireInventoryFacility(facilityId)
  return readAllFacilityRows<RentalApiRecord>(
    `/api/manager/rentals?facilityId=${encodeURIComponent(facilityId)}`,
    (value) =>
      isRentalRecord(value) &&
      record(value) &&
      record(value.facility) &&
      value.facility.id === facilityId &&
      record(value.customer) &&
      text(value.customer.id) &&
      text(value.customer.fullName) &&
      record(value.storageUnit) &&
      text(value.storageUnit.id) &&
      text(value.storageUnit.code) &&
      nullableDate(value.startDate) &&
      nullableDate(value.contractEndDate),
  )
}

export function currentInventoryRentals(
  unit: InventoryUnit,
  rentals: RentalApiRecord[],
) {
  const matches = rentals.filter(
    (r) =>
      r.facility.id === unit.facilityId &&
      r.storageUnit.id === unit.id &&
      r.status !== "completed",
  )
  if (matches.some((r) => r.storageUnit.code !== unit.code)) invalid()
  return matches // More than one uncompleted record is a conflict, not a license to pick a tenant.
}

export async function loadInventoryMaintenance(
  unit: InventoryUnit,
): Promise<InventoryMaintenance[]> {
  requireInventoryFacility(unit.facilityId)
  const rows = readRentalEnvelope<InventoryMaintenance[]>(
    await apiRequest(
      `/api/manager/storage-units/${encodeURIComponent(unit.id)}/maintenance-history`,
    ),
    (value) =>
      Array.isArray(value) &&
      value.every(
        (t) =>
          record(t) &&
          text(t.id) &&
          t.facilityId === unit.facilityId &&
          t.storageUnitId === unit.id &&
          t.unitCode === unit.code &&
          text(t.title) &&
          text(t.reason) &&
          ["open", "in_progress", "completed", "cancelled"].includes(
            String(t.status),
          ) &&
          (t.assignedStaffName === null || text(t.assignedStaffName)) &&
          nullableDate(t.dueAt) &&
          text(t.createdAt) &&
          Number.isFinite(Date.parse(t.createdAt)) &&
          nullableInstant(t.completedAt),
      ),
  )
  if (new Set(rows.map((t) => t.id)).size !== rows.length) invalid()
  return rows
}

/** This endpoint answers availability by TYPE, never a specific unit's calendar. */
export async function loadInventoryAvailability(
  unit: InventoryUnit,
  range: InventoryDateRange,
): Promise<InventoryAvailability> {
  requireInventoryFacility(unit.facilityId)
  if (!isInventoryDateRange(range))
    throw new ApiClientError("Ngày kết thúc phải sau ngày bắt đầu.", {
      status: 400,
    })
  const query = new URLSearchParams({
    facilityId: unit.facilityId,
    unitTypeId: unit.unitTypeId,
    startDate: range.startDate,
    endDate: range.endDate,
  })
  return readRentalEnvelope<InventoryAvailability>(
    await apiRequest(`/api/availability?${query}`),
    (value) =>
      record(value) &&
      value.facilityId === unit.facilityId &&
      value.unitTypeId === unit.unitTypeId &&
      value.startDate === range.startDate &&
      value.endDate === range.endDate &&
      typeof value.availableCount === "number" &&
      Number.isSafeInteger(value.availableCount) &&
      value.availableCount >= 0 &&
      value.available === value.availableCount > 0,
  )
}

export function inventoryLocation(
  floor: string | number | null,
  zone: string | null,
) {
  const floorText =
    floor === null
      ? ""
      : String(floor)
          .trim()
          .replace(/^tầng\s+/i, "")
  const zoneText = zone?.trim().replace(/^khu\s+/i, "")
  return `${floorText ? `Tầng ${floorText}` : "Chưa có dữ liệu tầng"}, ${
    zoneText ? `khu ${zoneText}` : "chưa có dữ liệu khu vực"
  }`
}
