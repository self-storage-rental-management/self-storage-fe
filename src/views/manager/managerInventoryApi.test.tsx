import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  ApiClientError,
  clearAuthTokens,
  setAccessToken,
} from "../../services/apiClient"
import {
  loadManagerInventory,
  filterInventory,
  emptyInventoryFilters,
} from "./managerInventoryApi"
import ManagerInventoryApiPanel, {
  InventoryContent,
} from "./ManagerInventoryApiPanel"
import ManagerInventoryPanel from "./ManagerInventoryPanel"

const h = vi.hoisted(() => ({
  actor: undefined as any,
  read: {} as any,
  api: true,
  identities: [] as string[],
}))
vi.mock("../../services/authApi", async (original) => ({
  ...(await original<typeof import("../../services/authApi")>()),
  getAuthenticatedActor: () => h.actor,
  isApiAuthenticated: () => h.api,
}))
vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: (identity: string) => {
    h.identities.push(identity)
    return { ...h.read, refresh: vi.fn() }
  },
}))
const actor = () => ({
  id: "manager-test",
  status: "ACTIVE",
  roles: ["MANAGER"],
  permissions: ["inventory:update"],
  facilityScopes: { "facility-a": "MANAGE" },
  facilityNames: { "facility-a": "Cơ sở thử nghiệm" },
})
const type = (id = "type-a", overrides = {}) => ({
  id,
  facilityId: "facility-a",
  code: "S",
  name: "Small Storage",
  status: "active",
  lengthM: 8,
  widthM: 10,
  heightM: 5,
  areaM2: 80,
  volumeM3: 400,
  maxLoadKg: 1000,
  monthlyPrice: 5500000,
  ...overrides,
})
const unit = (id: string, overrides = {}) => ({
  id,
  facilityId: "facility-a",
  unitTypeId: "type-a",
  code: `A-${id}`,
  floor: "1",
  zone: "Khu A",
  status: "available",
  ...overrides,
})
const page = (data: unknown[], total = data.length, index = 0, size = 100) => ({
  data,
  pagination: {
    page: index,
    pageSize: size,
    totalItems: total,
    totalPages: Math.ceil(total / size),
    sort: "id: ASC",
  },
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
function transport(types: unknown[], units: unknown[]) {
  const fetch = vi.fn(async (url: string) =>
    json(url.includes("/unit-types") ? page(types) : page(units)),
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}
beforeEach(() => {
  h.actor = actor()
  h.api = true
  h.read = { loading: true }
  h.identities = []
})
afterEach(() => {
  clearAuthTokens()
  vi.unstubAllGlobals()
})

describe("Manager inventory reads existing DB endpoints without local mutation", () => {
  it("joins by actual type ID, preserves code/floor/zone/status, VND and missing measurements", async () => {
    const fetch = transport(
      [
        type(),
        type("custom", {
          code: "S",
          name: "Kho đặc biệt",
          monthlyPrice: 7200000,
          areaM2: null,
          maxLoadKg: null,
        }),
      ],
      [
        unit("2"),
        unit("1", {
          unitTypeId: "custom",
          floor: null,
          zone: null,
          status: "maintenance",
        }),
      ],
    )
    setAccessToken("test-only-token")
    const inventory = await loadManagerInventory("facility-a")
    expect(
      inventory.units.map((u) => [
        u.id,
        u.floor,
        u.zone,
        u.definition.monthlyPrice,
      ]),
    ).toEqual([
      ["2", "1", "Khu A", 5500000],
      ["1", null, null, 7200000],
    ])
    expect(inventory.catalog.map((t) => t.total)).toEqual([1, 1])
    expect(
      fetch.mock.calls.every(
        ([url]) => url.includes("facility-a") && url.includes("sort=id,asc"),
      ),
    ).toBe(true)
    const options = (fetch.mock
      .calls as unknown as [string, RequestInit][])[0][1]
    expect(new Headers(options.headers).get("Authorization")).toBe(
      "Bearer test-only-token",
    )
    expect(options.method ?? "GET").toBe("GET")
    const html = renderToStaticMarkup(
      <InventoryContent inventory={inventory} />,
    )
    expect(html).toContain("A-1")
    expect(html).toContain("A-2")
    expect(html).toContain("7.200.000")
    expect(html).toContain("Chưa có dữ liệu")
    expect(html).toContain("Hiển thị 2 trên 2 gian kho")
    expect(html).toContain("Phân bổ theo khu vực")
    expect(html).toContain("Loại gian kho tại cơ sở")
    expect(html).toContain("Trạng thái bảo trì")
    expect(html).not.toContain("Hàng đợi bảo trì")
    expect(html).not.toContain("Năng lực khai thác hiện có")
    expect(html).not.toContain("Công suất theo loại gian kho")
    expect(html).not.toContain("Small Storage")
    expect(html).not.toContain("Không có nhiệm vụ bảo trì đang mở")
    expect(html).not.toContain("Chưa có người sử dụng")
    expect(html).not.toContain("Khả dụng ngay")
    expect(html).not.toContain("Thêm gian kho")
    expect(html).not.toContain("Chuyển sang bảo trì")
  })

  it("reads all pages before showing totals, including inactive types and held/assigned units", async () => {
    const fetch = vi.fn(async (url: string) =>
      json(
        url.includes("/unit-types")
          ? page([type("type-a", { status: "inactive" })])
          : url.includes("page=1")
            ? page([unit("last", { status: "assigned" })], 101, 1)
            : page(
                Array.from({ length: 100 }, (_, i) =>
                  unit(String(i), { status: i === 0 ? "held" : "available" }),
                ),
                101,
              ),
      ),
    )
    vi.stubGlobal("fetch", fetch)
    const inventory = await loadManagerInventory("facility-a")
    expect(inventory.units).toHaveLength(101)
    expect(inventory.catalog[0].counts.assigned).toBe(1)
    expect(inventory.catalog[0].counts.held).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(
      fetch.mock.calls.every(([url]) => !url.includes("status=active")),
    ).toBe(true)
  })

  it.each([
    null,
    { ...actor(), status: "SUSPENDED" },
    { ...actor(), roles: ["STAFF"] },
    { ...actor(), facilityScopes: {} },
  ])(
    "never fetches for inactive/wrong-role/unscoped actor %j",
    async (current) => {
      h.actor = current
      const fetch = vi.fn()
      vi.stubGlobal("fetch", fetch)
      await expect(loadManagerInventory("facility-a")).rejects.toMatchObject({
        status: 403,
      })
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it("does not query an arbitrary facility outside current scopes", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    await expect(loadManagerInventory("other-facility")).rejects.toMatchObject({
      status: 403,
    })
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([401, 403, 404, 409, 500])(
    "does not fall back to local/demo/empty data on HTTP %s",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          json({ error: { code: "FAILURE", message: "unavailable" } }, status),
        ),
      )
      await expect(loadManagerInventory("facility-a")).rejects.toMatchObject({
        status,
      })
    },
  )
  it("rejects network failure instead of verified zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
    await expect(loadManagerInventory("facility-a")).rejects.toBeDefined()
  })
  it.each([
    { facilityId: "other-facility" },
    { unitTypeId: "unknown" },
    { status: "unknown" },
    { code: "" },
    { floor: 1 },
    { zone: undefined },
  ])("rejects malformed/cross-facility units %j", async (overrides) => {
    transport([type()], [unit("1", overrides)])
    await expect(loadManagerInventory("facility-a")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
  it("verified empty is allowed, failed page/duplicate or changing total is not", async () => {
    transport([], [])
    expect((await loadManagerInventory("facility-a")).units).toEqual([])
    transport([type()], [unit("1"), unit("1")])
    await expect(loadManagerInventory("facility-a")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        json(url.includes("/unit-types") ? page([type()]) : page([], 2)),
      ),
    )
    await expect(loadManagerInventory("facility-a")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    })
  })
})

describe("Manager inventory filters and truthful read states", () => {
  it("filters actual IDs, string floors/zones/status/maintenance and accent-insensitive code; preserves source order", async () => {
    transport([type(), type("type-b")], [
      unit("10"),
      unit("2", {
        floor: "Tầng lửng",
        zone: "Khu B",
        status: "maintenance",
        unitTypeId: "type-b",
      }),
      unit("1", { status: "assigned" }),
    ])
    const { units } = await loadManagerInventory("facility-a")
    const run = (patch = {}) =>
      filterInventory(units, { ...emptyInventoryFilters, ...patch }).map(
        (u) => u.id,
      )
    expect(run({ type: "type-b" })).toEqual(["2"])
    expect(run({ floor: "Tầng lửng" })).toEqual(["2"])
    expect(run({ zone: "Khu B" })).toEqual(["2"])
    expect(run({ status: "allocated" })).toEqual(["1"])
    expect(run({ maintenance: "maintenance" })).toEqual(["2"])
    expect(run({ query: "tang lung" })).toEqual(["2"])
    expect(run({ query: "no-match" })).toEqual([])
    expect(run({ sort: "code" })).toEqual(["1", "2", "10"])
    expect(units.map((u) => u.id)).toEqual(["10", "2", "1"])
  })
  it("sorts raw VND/area and never treats unknown as zero or first price", async () => {
    transport(
      [
        type(),
        type("type-b", { monthlyPrice: 0, areaM2: 100 }),
        type("type-c", { monthlyPrice: null, areaM2: null }),
      ],
      [
        unit("a"),
        unit("b", { unitTypeId: "type-b" }),
        unit("c", { unitTypeId: "type-c" }),
      ],
    )
    const { units } = await loadManagerInventory("facility-a")
    expect(
      filterInventory(units, {
        ...emptyInventoryFilters,
        sort: "price-asc",
      }).map((u) => u.id),
    ).toEqual(["b", "a", "c"])
    expect(
      filterInventory(units, {
        ...emptyInventoryFilters,
        sort: "price-desc",
      }).map((u) => u.id),
    ).toEqual(["a", "b", "c"])
    expect(
      filterInventory(units, {
        ...emptyInventoryFilters,
        sort: "area-desc",
      }).map((u) => u.id),
    ).toEqual(["b", "a", "c"])
  })
  it.each(["loading", "error", "no-facility", "wrong-role"])(
    "%s does not display 0/0 or demo inventory",
    (state) => {
      if (state === "error")
        h.read = {
          loading: false,
          error: new ApiClientError("offline", { status: 503 }),
        }
      if (state === "no-facility") h.actor.facilityScopes = {}
      if (state === "wrong-role") h.actor.roles = ["STAFF"]
      const html = renderToStaticMarkup(<ManagerInventoryApiPanel />)
      expect(html).not.toContain("trên 0 gian kho")
      expect(html).not.toContain("Không có dữ liệu")
      expect(html).toContain(
        state === "loading"
          ? "Đang tải gian kho"
          : state === "error"
            ? "Thử lại"
            : state === "no-facility"
              ? "chưa được phân công cơ sở"
              : "chưa có quyền",
      )
    },
  )
  it("keys reads to actor/role/permissions/scope/facility and routes API mode away from legacy mutation props", () => {
    const html = renderToStaticMarkup(
      <ManagerInventoryPanel
        {...{
          createUnit: () => {
            throw new Error("legacy mutation called")
          },
        } as any}
      />,
    )
    expect(html).toContain("Đang tải gian kho")
    expect(html).not.toContain("Thêm gian kho")
    const previous = h.identities.at(-1)
    h.actor = {
      ...actor(),
      id: "other-manager",
      facilityScopes: { "facility-b": "READ" },
    }
    renderToStaticMarkup(<ManagerInventoryApiPanel />)
    expect(h.identities.at(-1)).not.toBe(previous)
    expect(h.identities.at(-1)).toContain("facility-b")
  })
  it("empty successful response shows no data; unavailable secondary sources are not called empty", () => {
    h.read = { loading: false, data: { units: [], catalog: [] } }
    const html = renderToStaticMarkup(<ManagerInventoryApiPanel />)
    expect(html).toContain("Không có dữ liệu")
    expect(html).toContain("Hiển thị 0 trên 0 gian kho")
    expect(html).not.toContain("Hàng đợi bảo trì")
    expect(html).not.toContain("Không có nhiệm vụ bảo trì đang mở")
  })
})
