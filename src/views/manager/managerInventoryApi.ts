import { ApiClientError } from "../../services/apiClient"
import { getAuthenticatedActor } from "../../services/authApi"
import type { UnitStatus } from "../../types/storageHub"
import { matchesManagerSearch } from "./managerList"
import {
  isFacilityCatalogType,
  readAllFacilityRows,
  summarizeFacilityCatalog,
  type FacilityCatalogType,
} from "./managerFacilityCatalogApi"

export interface InventoryUnit {
  id: string
  facilityId: string
  unitTypeId: string
  code: string
  floor: string | null
  zone: string | null
  status: UnitStatus
  definition: FacilityCatalogType
}
export interface InventoryFilters {
  query: string
  status: string
  type: string
  floor: string
  zone: string
  sort: string
}
export const emptyInventoryFilters: InventoryFilters = {
  query: "",
  status: "all",
  type: "all",
  floor: "all",
  zone: "all",
  sort: "attention",
}
const statuses: UnitStatus[] = [
  "available",
  "occupied",
  "reserved",
  "assigned",
  "held",
  "maintenance",
]
const nullableText = (v: unknown) => v === null || typeof v === "string"

export function requireInventoryFacility(facilityId: string) {
  const actor = getAuthenticatedActor()
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    !actor.roles.includes("MANAGER") ||
    !["READ", "OPERATE", "MANAGE"].includes(actor.facilityScopes[facilityId])
  ) {
    throw new ApiClientError("Bạn chưa có quyền xem gian kho tại cơ sở này.", {
      status: 403,
    })
  }
}

export async function loadManagerInventory(facilityId: string) {
  requireInventoryFacility(facilityId)
  const id = encodeURIComponent(facilityId)
  const [types, units] = await Promise.all([
    readAllFacilityRows<FacilityCatalogType>(
      `/api/facilities/${id}/unit-types`,
      (value) => isFacilityCatalogType(value, facilityId),
    ),
    readAllFacilityRows<Omit<InventoryUnit, "definition">>(
      `/api/storage-units?facilityId=${id}`,
      (value) => {
        const u = value as Omit<InventoryUnit, "definition"> | null
        return (
          !!u &&
          typeof u === "object" &&
          typeof u.id === "string" &&
          !!u.id.trim() &&
          u.facilityId === facilityId &&
          typeof u.unitTypeId === "string" &&
          !!u.unitTypeId.trim() &&
          typeof u.code === "string" &&
          !!u.code.trim() &&
          nullableText(u.floor) &&
          nullableText(u.zone) &&
          statuses.includes(u.status)
        )
      },
    ),
  ])
  const catalog = summarizeFacilityCatalog(types, units)
  const byId = new Map(types.map((type) => [type.id, type]))
  return {
    catalog,
    units: units.map((unit) => ({
      ...unit,
      definition: byId.get(unit.unitTypeId)!,
    })),
  }
}

export function filterInventory(units: InventoryUnit[], f: InventoryFilters) {
  const filtered = units.filter(
    (u) =>
      (f.status === "all" ||
        (f.status === "allocated"
          ? ["reserved", "assigned"].includes(u.status)
          : u.status === f.status)) &&
      (f.type === "all" || u.unitTypeId === f.type) &&
      (f.floor === "all" || u.floor === f.floor) &&
      (f.zone === "all" || u.zone === f.zone) &&
      matchesManagerSearch(f.query, [
        u.code,
        u.definition.name,
        u.definition.code,
        u.floor,
        u.zone,
      ]),
  )
  const rank = (u: InventoryUnit) =>
    u.status === "maintenance"
      ? 0
      : ["held", "reserved", "assigned"].includes(u.status)
        ? 1
        : u.status === "occupied"
          ? 2
          : 3
  const nullableCompare = (
    a: number | null,
    b: number | null,
    descending = false,
  ) =>
    a === null
      ? b === null
        ? 0
        : 1
      : b === null
        ? -1
        : descending
          ? b - a
          : a - b
  return filtered.sort((a, b) => {
    const difference =
      f.sort === "attention"
        ? rank(a) - rank(b)
        : f.sort === "area-desc"
          ? nullableCompare(a.definition.areaM2, b.definition.areaM2, true)
          : f.sort === "price-asc" || f.sort === "price-desc"
            ? nullableCompare(
                a.definition.monthlyPrice,
                b.definition.monthlyPrice,
                f.sort === "price-desc",
              )
            : 0
    return difference || a.code.localeCompare(b.code, "vi", { numeric: true })
  })
}
