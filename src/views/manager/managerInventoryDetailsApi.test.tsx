import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  ApiClientError,
  clearAuthTokens,
  setAccessToken,
} from "../../services/apiClient"
import {
  currentInventoryRentals,
  inventoryLocation,
  loadInventoryAvailability,
  loadInventoryMaintenance,
  loadInventoryRentals,
} from "./managerInventoryDetailsApi"
import {
  InventoryAvailabilityDetails,
  InventoryAvailabilityResult,
  InventoryMaintenanceDetails,
  InventoryRentalSummary,
} from "./ManagerInventoryDetails"
import type { InventoryUnit } from "./managerInventoryApi"
import type { RentalApiRecord } from "../../types/rentalApi"

const h = vi.hoisted(() => ({
  actor: undefined as any,
  read: {} as any,
  identities: [] as string[],
  interactive: false,
  slots: [] as any[],
  cursor: 0,
}))
vi.mock("../../services/authApi", async (original) => ({
  ...(await original<typeof import("../../services/authApi")>()),
  getAuthenticatedActor: () => h.actor,
}))
vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: (identity: string) => {
    h.identities.push(identity)
    return { ...h.read, refresh: vi.fn() }
  },
}))
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>()
  return {
    ...react,
    useState: (initial: unknown) => {
      if (!h.interactive) return react.useState(initial)
      const slot = h.cursor++
      if (!(slot in h.slots)) h.slots[slot] = initial
      return [
        h.slots[slot],
        (value: any) => {
          h.slots[slot] =
            typeof value === "function" ? value(h.slots[slot]) : value
        },
      ]
    },
  }
})
const unit: InventoryUnit = {
  id: "unit-a",
  facilityId: "facility-a",
  unitTypeId: "type-a",
  code: "HCM-Q1-F01-L-001",
  floor: "3",
  zone: "Khu C",
  status: "occupied",
  definition: {
    id: "type-a",
    facilityId: "facility-a",
    code: "L",
    name: "Kho lớn",
    status: "active",
    lengthM: 18.3,
    widthM: 10.8,
    heightM: 5,
    areaM2: 197.64,
    volumeM3: 988.2,
    maxLoadKg: 2400,
    monthlyPrice: 15000000,
  },
}
const rental = (
  id = "rental-a",
  overrides: Partial<RentalApiRecord> = {},
): RentalApiRecord => ({
  id,
  facility: { id: unit.facilityId, code: "HCM", name: "Cơ sở HCM" },
  customer: { id: "customer-a", fullName: "Khách thử nghiệm" },
  storageUnit: { id: unit.id, code: unit.code },
  unitType: { id: unit.unitTypeId, code: "L", name: "Kho lớn" },
  status: "active",
  startDate: "2026-01-01",
  contractEndDate: "2026-04-01",
  monthlyPrice: 15000000,
  currency: "VND",
  dataWarnings: [],
  ...overrides,
})
const task = (overrides = {}) => ({
  id: "task-a",
  facilityId: unit.facilityId,
  storageUnitId: unit.id,
  unitCode: unit.code,
  title: "Kiểm tra sàn",
  reason: "Sàn cần kiểm tra",
  status: "open",
  assignedStaffName: null,
  dueAt: null,
  createdAt: "2026-10-10T08:00:00Z",
  completedAt: null,
  ...overrides,
})
const range = { startDate: "2026-10-12", endDate: "2026-11-12" }
const availability = (overrides = {}) => ({
  facilityId: unit.facilityId,
  unitTypeId: unit.unitTypeId,
  ...range,
  availableCount: 2,
  available: true,
  ...overrides,
})
const page = (data: unknown[], index = 0, total = data.length) => ({
  data,
  pagination: {
    page: index,
    pageSize: 100,
    totalItems: total,
    totalPages: Math.ceil(total / 100),
    sort: "id: ASC",
  },
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
function transport(body: unknown, status = 200) {
  const fetch = vi.fn(async (_url: string) => json(body, status))
  vi.stubGlobal("fetch", fetch)
  return fetch
}
beforeEach(() => {
  h.actor = {
    id: "manager-a",
    status: "ACTIVE",
    roles: ["MANAGER"],
    permissions: ["rentals:view", "units:view"],
    facilityScopes: { [unit.facilityId]: "READ" },
  }
  h.read = { loading: true }
  h.identities = []
  h.interactive = false
  h.slots = []
  h.cursor = 0
})
afterEach(() => {
  clearAuthTokens()
  vi.unstubAllGlobals()
})

describe("inventory read-only endpoint integration", () => {
  it("reads all rental pages, exact scope and bearer token with GET only", async () => {
    setAccessToken("test-only-token")
    const rows = Array.from({ length: 100 }, (_, i) =>
      rental(`rental-${i}`, { status: "completed" }),
    )
    const fetch = vi.fn(async (url: string) =>
      json(
        url.includes("page=1")
          ? page([rental("last")], 1, 101)
          : page(rows, 0, 101),
      ),
    )
    vi.stubGlobal("fetch", fetch)
    const rentals = await loadInventoryRentals(unit.facilityId)
    expect(rentals).toHaveLength(101)
    expect(currentInventoryRentals(unit, rentals).map((r) => r.id)).toEqual([
      "last",
    ])
    for (const [url, options] of fetch.mock
      .calls as unknown as [string, RequestInit][]) {
      expect(url).toContain("/api/manager/rentals?facilityId=facility-a")
      expect(url).toContain("size=100&sort=id,asc")
      expect(options.method ?? "GET").toBe("GET")
      expect(new Headers(options.headers).get("Authorization")).toBe(
        "Bearer test-only-token",
      )
    }
  })
  it("matches rental by unit ID and facility, not code alone or guessed dates", () => {
    const rows = [
      rental("other-unit", { storageUnit: { id: "other", code: unit.code } }),
      rental("other-facility", {
        facility: { id: "other", code: "X", name: "Other" },
      }),
      rental("completed", { status: "completed" }),
      rental("closing", { status: "closing" }),
    ]
    expect(currentInventoryRentals(unit, rows).map((r) => r.id)).toEqual([
      "closing",
    ])
    expect(() =>
      currentInventoryRentals(unit, [
        rental("mismatch", { storageUnit: { id: unit.id, code: "wrong" } }),
      ]),
    ).toThrow(ApiClientError)
  })
  it.each([
    { facility: { id: "other", code: "X", name: "Other" } },
    { status: "unknown" },
    { startDate: "2026-02-30" },
    { contractEndDate: "not-a-date" },
    { customer: { id: "customer-a", fullName: "" } },
  ])(
    "rejects malformed or outside-scope rental data (%j)",
    async (overrides) => {
      transport(page([{ ...rental(), ...overrides }]))
      await expect(loadInventoryRentals(unit.facilityId)).rejects.toMatchObject(
        { code: "INVALID_RESPONSE" },
      )
    },
  )
  it("rejects duplicate rows and inconsistent pagination, rather than choosing a tenant", async () => {
    transport(page([rental(), rental()]))
    await expect(loadInventoryRentals(unit.facilityId)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
    transport(page([rental()], 0, 101))
    await expect(loadInventoryRentals(unit.facilityId)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("reads unit maintenance history from the manager endpoint", async () => {
    const fetch = transport({
      data: [
        task(),
        task({
          id: "done",
          status: "completed",
          completedAt: "2026-10-10T09:00:00Z",
        }),
      ],
    })
    expect(await loadInventoryMaintenance(unit)).toHaveLength(2)
    expect(fetch.mock.calls[0][0]).toContain(
      `/api/manager/storage-units/${unit.id}/maintenance-history`,
    )
  })
  it.each([
    { facilityId: "other" },
    { storageUnitId: "other" },
    { unitCode: "wrong" },
    { status: "invented" },
    { dueAt: "2026-02-30" },
    { createdAt: "bad" },
    { assignedStaffName: 3 },
  ])("rejects invalid maintenance data (%j)", async (overrides) => {
    transport({ data: [task(overrides)] })
    await expect(loadInventoryMaintenance(unit)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("rejects duplicate maintenance tasks", async () => {
    transport({ data: [task(), task()] })
    await expect(loadInventoryMaintenance(unit)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("checks availability with the selected type and exact submitted dates", async () => {
    const fetch = transport({ data: availability() })
    expect((await loadInventoryAvailability(unit, range)).availableCount).toBe(
      2,
    )
    const url = new URL(fetch.mock.calls[0][0], "http://test.invalid")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      facilityId: unit.facilityId,
      unitTypeId: unit.unitTypeId,
      ...range,
    })
    expect(url.searchParams.has("storageUnitId")).toBe(false)
  })
  it.each([
    { facilityId: "other" },
    { unitTypeId: "other" },
    { startDate: "2026-10-13" },
    { endDate: "2026-11-13" },
    { availableCount: -1 },
    { availableCount: 0.5 },
    { availableCount: "2" },
    { available: false },
  ])("rejects invalid availability (%j)", async (overrides) => {
    transport({ data: availability(overrides) })
    await expect(loadInventoryAvailability(unit, range)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it.each([
    { startDate: "", endDate: "" },
    { startDate: "2026-02-30", endDate: "2026-03-31" },
    { startDate: "2026-10-12", endDate: "2026-10-12" },
    { startDate: "2026-11-12", endDate: "2026-10-12" },
  ])("invalid dates make no request (%j)", async (dates) => {
    const fetch = transport({ data: availability() })
    await expect(loadInventoryAvailability(unit, dates)).rejects.toMatchObject({
      status: 400,
    })
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([401, 403, 404, 409, 500])(
    "HTTP %s remains an error for each source, not empty data",
    async (status) => {
      transport({ message: "test failure" }, status)
      for (const load of [
        () => loadInventoryRentals(unit.facilityId),
        () => loadInventoryMaintenance(unit),
        () => loadInventoryAvailability(unit, range),
      ])
        await expect(load()).rejects.toMatchObject({ status })
    },
  )
  it("network failure never falls back to demo/empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network failure")),
    )
    for (const load of [
      () => loadInventoryRentals(unit.facilityId),
      () => loadInventoryMaintenance(unit),
      () => loadInventoryAvailability(unit, range),
    ])
      await expect(load()).rejects.toBeInstanceOf(ApiClientError)
  })
  it.each([
    null,
    { roles: ["STAFF"] },
    { status: "INACTIVE" },
    { facilityScopes: {} },
  ])("denied actor makes no requests (%j)", async (override) => {
    h.actor = override === null ? null : { ...h.actor, ...override }
    const fetch = transport({ data: [] })
    for (const load of [
      () => loadInventoryRentals(unit.facilityId),
      () => loadInventoryMaintenance(unit),
      () => loadInventoryAvailability(unit, range),
    ])
      await expect(load()).rejects.toMatchObject({ status: 403 })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("inventory detail presentation", () => {
  it.each(["../manager/ManagerInventoryPanel.tsx","../manager/ManagerDashboardPanel.tsx","../manager/ManagerExceptionsPanel.tsx","../manager/ManagerOverdueApiPanel.tsx","../manager/ManagerPagination.tsx","../manager/ManagerStaffTasksPanel.tsx","../manager/ManagerCheckinsPanel.tsx","../manager/ManagerReportsPanel.tsx","../manager/ManagerRentalsPanel.tsx","../manager/ManagerPaymentsPanel.tsx","../rental-api/ApiPager.tsx","../rental-api/RenewalDecisionModal.tsx","../rental-api/RenewalDetail.tsx","../rental-api/RentalApiWorkspace.tsx","../rental-api/RenewalOperationsPanel.tsx","../support-api/SupportActionForm.tsx","../support-api/SupportCreateForm.tsx","../support-api/SupportStaffPicker.tsx","../support-api/SupportTicketDetail.tsx","../rental-support-integration/LedgerPanel.tsx","../rental-support-integration/RenewalCoordinationPanel.tsx"])("Duong-owned presentation uses commas instead of middle-dot separators: %s", path => {
    expect(readFileSync(new URL(path, import.meta.url), "utf8")).not.toContain("·")
  })

  it("shows a real tenant and rental, with a verified last permitted date", () => {
    const r = rental("real-ref", {
      dateSemantics: {
        completeness: "COMPLETE",
        convention: "EXCLUSIVE",
        endExclusive: "2026-04-01",
        lastPermittedDate: "2026-03-31",
      },
    })
    const html = renderToStaticMarkup(
      <InventoryRentalSummary
        unit={unit}
        read={{ loading: false, data: [r] }}
        detailed
      />,
    )
    expect(html).toContain("Khách thử nghiệm")
    expect(html).toContain("real-ref")
    expect(html).toContain("31/03/2026")
    expect(html).not.toContain("chưa tìm thấy")
  })
  it("does not silently choose one of multiple uncompleted rentals", () => {
    const html = renderToStaticMarkup(
      <InventoryRentalSummary
        unit={unit}
        read={{ loading: false, data: [rental("one"), rental("two")] }}
      />,
    )
    expect(html).toContain("Có nhiều hồ sơ thuê chưa kết thúc")
    expect(html).toContain("one")
    expect(html).toContain("two")
  })
  it("availability form does not query until a valid range is submitted; labels the TYPE limitation", () => {
    const html = renderToStaticMarkup(
      <InventoryAvailabilityDetails unit={unit} identity="actor:scope" />,
    )
    expect(h.identities).toEqual([])
    expect(html).toContain("Từ ngày")
    expect(html).toContain("Đến ngày")
    expect(html).toContain("không phải lịch riêng của gian này")
    expect(html).not.toContain("Khả dụng ngay")
  })
  it("availability states never turn a loading/error into zero or a guarantee for this unit", () => {
    let html = renderToStaticMarkup(
      <InventoryAvailabilityResult unit={unit} identity="a" range={range} />,
    )
    expect(html).toContain("Đang kiểm tra khả dụng")
    expect(html).not.toContain("Không còn gian")
    h.read = {
      loading: false,
      error: new ApiClientError("internal failure", { status: 403 }),
    }
    html = renderToStaticMarkup(
      <InventoryAvailabilityResult unit={unit} identity="a" range={range} />,
    )
    expect(html).toContain('role="alert"')
    expect(html).not.toContain("Không còn gian")
    h.read = {
      loading: false,
      data: availability({ availableCount: 0, available: false }),
    }
    expect(
      renderToStaticMarkup(
        <InventoryAvailabilityResult unit={unit} identity="a" range={range} />,
      ),
    ).toContain("Không còn gian cùng loại")
    h.read = { loading: false, data: availability() }
    html = renderToStaticMarkup(
      <InventoryAvailabilityResult unit={unit} identity="a" range={range} />,
    )
    expect(html).toContain("Còn 2 gian cùng loại")
    expect(html).toContain("12/10/2026 - 12/11/2026")
    expect(html).not.toContain("Gian này còn trống")
  })
  it("source identity changes when actor scope or selected unit changes", () => {
    renderToStaticMarkup(
      <InventoryMaintenanceDetails unit={unit} identity="actor-a:scope-a" />,
    )
    renderToStaticMarkup(
      <InventoryMaintenanceDetails
        unit={{ ...unit, id: "unit-b" }}
        identity="actor-b:scope-b"
      />,
    )
    expect(h.identities).toEqual([
      "actor-a:scope-a:maintenance:unit-a",
      "actor-b:scope-b:maintenance:unit-b",
    ])
  })
  it("formats the complete position naturally without inventing missing fields", () => {
    expect(inventoryLocation("3", "Khu C")).toBe("Tầng 3, khu C")
    expect(inventoryLocation("Tầng 3", "C")).toBe("Tầng 3, khu C")
    expect(inventoryLocation(null, null)).toBe(
      "Chưa có dữ liệu tầng, chưa có dữ liệu khu vực",
    )
    expect(inventoryLocation(3, "Khu C")).not.toContain("·")
  })
})
