import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  Modal,
  SectionHeader,
  StatCard,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { Icon } from "../../components/Layout"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { formatVndAmount } from "../../i18n/currency"
import { managerDisplayError } from "./managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "./managerFacilityUi"
import { facilityCatalogTypeName } from "./managerFacilityCatalogApi"
import { FacilityCatalogTable } from "./ManagerFacilityCatalog"
import ManagerPagination from "./ManagerPagination"
import { paginateManagerItems } from "./managerList"
import type { RentalApiRecord } from "../../types/rentalApi"
import {
  inventoryLocation,
  loadInventoryRentals,
} from "./managerInventoryDetailsApi"
import {
  InventoryRentalSummary,
  InventoryMaintenanceDetails,
  type InventorySourceRead,
} from "./ManagerInventoryDetails"
import {
  emptyInventoryFilters,
  filterInventory,
  loadManagerInventory,
  type InventoryFilters,
  type InventoryUnit,
} from "./managerInventoryApi"

const statusLabels: Record<InventoryUnit["status"], string> = {
  available: "Còn trống",
  occupied: "Đang sử dụng",
  reserved: "Đã giữ cho khách",
  assigned: "Đã phân gian",
  held: "Đang giữ tạm thời",
  maintenance: "Đang bảo trì",
}
const variants: Record<InventoryUnit["status"], string> = {
  available: "success",
  occupied: "info",
  reserved: "purple",
  assigned: "purple",
  held: "purple",
  maintenance: "warning",
}
const inputClass =
  "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
const missing = "Chưa có dữ liệu"
const measure = (n: number | null, suffix: string) =>
  n === null ? missing : `${n.toLocaleString("vi-VN")} ${suffix}`
const location = (value: string | null) => value?.trim() || missing
const typeLabel = (u: InventoryUnit) =>
  facilityCatalogTypeName(u.definition.name, u.definition.code)
const dimensions = (u: InventoryUnit) =>
  [u.definition.lengthM, u.definition.widthM, u.definition.heightM].some(
    (n) => n === null,
  )
    ? missing
    : `${u.definition.lengthM?.toLocaleString("vi-VN")} × ${u.definition.widthM?.toLocaleString("vi-VN")} × ${u.definition.heightM?.toLocaleString("vi-VN")} m`

export default function ManagerInventoryApiPanel() {
  const actor = getAuthenticatedActor()
  const facilityId = singleManagerFacility(actor)
  const identity = `${actor?.id}:${actor?.status}:${JSON.stringify(actor?.roles)}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${facilityId}`
  return (
    <div className="fade-in space-y-6">
      <SectionHeader eyebrow="Vận hành cơ sở" title="Quản lý gian kho" />
      {!actor ||
      actor.status !== "ACTIVE" ||
      !actor.roles.includes("MANAGER") ? (
        <Card className="p-5" role="alert">
          Bạn chưa có quyền xem gian kho.
        </Card>
      ) : !facilityId ? (
        <Card className="p-5" role="status">
          {managerFacilityNotice(actor)}
        </Card>
      ) : (
        <>
          <InventoryRead
            key={identity}
            identity={identity}
            facilityId={facilityId}
          />
        </>
      )}
    </div>
  )
}

function InventoryRead({
  identity,
  facilityId,
}: {
  identity: string
  facilityId: string
}) {
  const read = useRentalApiResource(identity, () =>
    loadManagerInventory(facilityId),
  )
  const rentals = useRentalApiResource(`${identity}:rentals`, () =>
    loadInventoryRentals(facilityId),
  )
  if (read.loading)
    return (
      <Card className="p-5" role="status">
        Đang tải gian kho...
      </Card>
    )
  if (read.error)
    return (
      <Card className="p-5 space-y-3" role="alert">
        <p>{managerDisplayError(read.error)}</p>
        <Button variant="outline" onClick={read.refresh}>
          Thử lại
        </Button>
      </Card>
    )
  return read.data ? (
    <InventoryContent
      inventory={read.data}
      rentals={rentals}
      identity={identity}
    />
  ) : (
    <Card className="p-5" role="alert">
      Chưa xác minh được dữ liệu gian kho.
    </Card>
  )
}

export function InventoryContent({
  inventory,
  rentals = { loading: true },
  identity = "inventory",
}: {
  inventory: Awaited<ReturnType<typeof loadManagerInventory>>
  rentals?: InventorySourceRead<RentalApiRecord[]>
  identity?: string
}) {
  const [filters, setFilters] = useState<InventoryFilters>(
    emptyInventoryFilters,
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedId, setSelectedId] = useState<string>()
  const units = inventory.units
  const visible = useMemo(
    () => filterInventory(units, filters),
    [units, filters],
  )
  const pagination = paginateManagerItems(visible, page, pageSize)
  const selected = units.find((u) => u.id === selectedId)
  const floors = [
    ...new Set(
      units.map((u) => u.floor).filter((s): s is string => !!s?.trim()),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }))
  const zones = [
    ...new Set(
      units.map((u) => u.zone).filter((s): s is string => !!s?.trim()),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }))
  const count = (status: InventoryUnit["status"]) =>
    units.filter((u) => u.status === status).length
  const occupied = count("occupied")
  const change = (patch: Partial<InventoryFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  const filter = (
    label: string,
    field: keyof InventoryFilters,
    options: [string, string][],
  ) => (
    <label className="block text-sm font-medium text-stone-700">
      {label}
      <select
        className={`${inputClass} mt-1`}
        value={filters[field]}
        onChange={(e) => change({ [field]: e.target.value })}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard title="Tổng số gian" value={units.length} icon={Icon.box} />
        <StatCard
          title="Còn trống"
          value={count("available")}
          icon={Icon.check}
        />
        <StatCard title="Đang sử dụng" value={occupied} icon={Icon.key} />
        <StatCard
          title="Đã phân gian"
          value={count("reserved") + count("assigned")}
          icon={Icon.calendar}
        />
        <StatCard
          title="Đang bảo trì"
          value={count("maintenance")}
          icon={Icon.tasks}
        />
      </div>
      <Card className="p-4">
        <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium text-stone-700 md:col-span-2">
            Tìm kiếm
            <input
              className={`${inputClass} mt-1`}
              placeholder="Tìm mã gian, loại gian, tầng hoặc khu vực..."
              value={filters.query}
              onChange={(e) => change({ query: e.target.value })}
            />
          </label>
          {filter("Trạng thái gian kho", "status", [
            ["all", "Tất cả trạng thái"],
            ["available", statusLabels.available],
            ["occupied", statusLabels.occupied],
            ["allocated", "Đã phân gian / giữ chỗ"],
            ["held", statusLabels.held],
            ["maintenance", statusLabels.maintenance],
          ])}
          {filter("Loại gian kho", "type", [
            ["all", "Tất cả loại gian kho"],
            ...inventory.catalog.map(
              (t) =>
                [
                  t.id,
                  facilityCatalogTypeName(t.name, t.code),
                ] as [string, string],
            ),
          ])}
          {filter("Tầng", "floor", [
            ["all", "Tất cả tầng"],
            ...floors.map((f) => [f, `Tầng ${f}`] as [string, string]),
          ])}
          {filter("Khu vực", "zone", [
            ["all", "Tất cả khu vực"],
            ...zones.map((z) => [z, z] as [string, string]),
          ])}
          {filter("Sắp xếp", "sort", [
            ["attention", "Cần chú ý trước"],
            ["code", "Sắp xếp theo mã gian"],
            ["area-desc", "Diện tích từ lớn đến nhỏ"],
            ["price-asc", "Giá từ thấp đến cao"],
            ["price-desc", "Giá từ cao đến thấp"],
          ])}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-500">
          <span>
            Hiển thị {visible.length} trên {units.length} gian kho
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters(emptyInventoryFilters)
              setPage(1)
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>
      </Card>
      <Card>
        <Table tableClassName="min-w-[980px] table-fixed">
          <caption className="sr-only">Danh sách gian kho của cơ sở</caption>
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[19%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
          </colgroup>
          <Thead>
            <tr>
              <Th className="whitespace-nowrap text-left align-middle">Gian kho</Th>
              <Th className="text-left align-middle">Loại gian kho</Th>
              <Th className="text-left align-middle">Vị trí</Th>
              <Th className="whitespace-nowrap text-left align-middle">Trạng thái</Th>
              <Th className="whitespace-nowrap text-left align-middle">Giá niêm yết</Th>
              <Th className="whitespace-nowrap text-left align-middle">Thao tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {pagination.items.map((u) => (
              <Tr key={u.id} className="odd:bg-white even:bg-stone-50/50">
                <Td className="align-middle">
                  <p className="break-all font-mono text-sm font-bold leading-5">{u.code}</p>
                </Td>
                <Td className="align-middle">
                  <p className="font-semibold leading-5">{typeLabel(u)}</p>
                </Td>
                <Td className="align-middle">
                  <div className="space-y-1">
                    <p>{u.floor?.trim() ? `Tầng ${u.floor}` : missing}</p>
                    <p className="text-sm text-stone-500">{location(u.zone)}</p>
                  </div>
                </Td>
                <Td className="align-middle">
                  <Badge variant={variants[u.status]}>
                    {statusLabels[u.status]}
                  </Badge>
                </Td>
                <Td className="align-middle">
                  {u.definition.monthlyPrice === null ? (
                    <p className="text-sm text-stone-500">{missing}</p>
                  ) : (
                    <div className="whitespace-nowrap">
                      <p className="font-semibold text-stone-800">
                        {formatVndAmount(u.definition.monthlyPrice)}
                      </p>
                      <p className="text-xs text-stone-500">/tháng</p>
                    </div>
                  )}
                </Td>
                <Td className="align-middle">
                  <Button
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={() => setSelectedId(u.id)}
                  >
                    Chi tiết
                  </Button>
                </Td>
              </Tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-sm text-stone-500"
                >
                  {units.length === 0
                    ? "Không có dữ liệu"
                    : "Không có gian kho phù hợp với bộ lọc."}
                </td>
              </tr>
            )}
          </Tbody>
        </Table>
        <ManagerPagination
          {...pagination}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </Card>
      <div>
        <Card>
          <h2 className="border-b border-stone-200 p-4 font-bold">
            Phân bổ theo khu vực
          </h2>
          <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-1">
            {[...new Set(units.map((u) => u.zone))].map((zone) => {
              const inZone = units.filter((u) => u.zone === zone)
              return (
                <div
                  key={zone ?? "no-zone"}
                  className="rounded-xl border border-stone-200 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <b>{location(zone)}</b>
                    <Badge variant="muted">{inZone.length} gian</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {Object.entries(statusLabels).map(([status, text]) => (
                      <p key={status} className="text-xs text-stone-600">
                        {text}:{" "}
                        <b>
                          {inZone.filter((u) => u.status === status).length}
                        </b>
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
            {units.length === 0 && <p>Không có dữ liệu</p>}
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="border-b border-stone-200 p-4 font-bold">
          Loại gian kho tại cơ sở
        </h2>
        <FacilityCatalogTable rows={inventory.catalog} />
      </Card>
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(undefined)}
        title="Chi tiết gian kho"
        size="xl"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <p>
                Gian kho: <b>{selected.code}</b>
              </p>
              <p>
                Loại gian kho: <b>{typeLabel(selected)}</b>
              </p>
              <p>
                Trạng thái: <b>{statusLabels[selected.status]}</b>
              </p>
              <p>
                Vị trí:{" "}
                <b>{inventoryLocation(selected.floor, selected.zone)}</b>
              </p>
              <p>
                Kích thước: <b>{dimensions(selected)}</b>
              </p>
              <p>
                Diện tích: <b>{measure(selected.definition.areaM2, "m²")}</b>
              </p>
              <p>
                Thể tích: <b>{measure(selected.definition.volumeM3, "m³")}</b>
              </p>
              <p>
                Tải trọng tối đa:{" "}
                <b>{measure(selected.definition.maxLoadKg, "kg")}</b>
              </p>
              <p>
                Giá niêm yết:{" "}
                <b>
                  {selected.definition.monthlyPrice === null
                    ? missing
                    : `${formatVndAmount(selected.definition.monthlyPrice)}/tháng`}
                </b>
              </p>
            </div>
            <section className="space-y-2 border-t border-stone-200 pt-4">
              <h3 className="font-bold">Hồ sơ thuê và người thuê</h3>
              <InventoryRentalSummary unit={selected} read={rentals} detailed />
            </section>
            <InventoryMaintenanceDetails
              key={`${identity}:${selected.id}:maintenance`}
              unit={selected}
              identity={identity}
            />
          </div>
        )}
      </Modal>
    </>
  )
}
