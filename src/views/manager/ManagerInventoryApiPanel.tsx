import { useEffect, useMemo, useState } from "react"
import ManagerUnitTypeModal from "./ManagerUnitTypeModal"
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
import { ApiClientError } from "../../services/apiClient"
import { Icon } from "../../components/Layout"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { formatVndAmount } from "../../i18n/currency"
import { managerDisplayError } from "./managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "./managerFacilityUi"
import {
  facilityCatalogTypeHasPrice,
  facilityCatalogTypeName,
  facilityCatalogTypeStatusClass,
  facilityCatalogTypeStatusLabel,
} from "./managerFacilityCatalogApi"
import { FacilityCatalogTable } from "./ManagerFacilityCatalog"
import ManagerPagination from "./ManagerPagination"
import { paginateManagerItems } from "./managerList"
import type { RentalApiRecord } from "../../types/rentalApi"
import {
  currentInventoryRentals,
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
import { archiveManagerUnitType, restoreManagerUnitType } from "../../services/managerUnitTypeApi"
import { listAccessibleUnitTypes, type CustomerUnitType } from "../../services/customerReservationApi"
import { previewPhysicalUnitCodes } from "./managerUnitCodeHelpers"
import ManagerGoodsCatalogPanel from "./ManagerGoodsCatalogPanel"
import ManagerFacilityLifecycleRequest from './ManagerFacilityLifecycleRequest'

const statusLabels: Record<InventoryUnit["status"], string> = {
  available: "Còn trống",
  occupied: "Đang sử dụng",
  reserved: "Đã giữ cho khách",
  assigned: "Đã phân gian",
  held: "Đang giữ tạm thời",
  maintenance: "Đang bảo trì",
  inactive: "Tạm ngưng",
  archived: "Đã lưu trữ",
}
const statusClasses: Record<InventoryUnit["status"], string> = {
  available: "bg-green-100 text-green-700",
  occupied: "bg-blue-50 text-blue-700",
  reserved: "bg-violet-50 text-violet-700",
  assigned: "bg-violet-50 text-violet-700",
  held: "bg-amber-50 text-amber-800",
  maintenance: "bg-red-50 text-red-700",
  inactive: "bg-stone-100 text-stone-700",
  archived: "bg-stone-200 text-stone-600",
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

export default function ManagerInventoryApiPanel({ onOpenRental, onOpenMaintenance, view = 'info' }: {
  onOpenRental?: (rentalId: string) => void
  onOpenMaintenance?: (unitId: string, unitCode: string) => void
  view?: 'info' | 'assignment'
} = {}) {
  const actor = getAuthenticatedActor()
  const facilityId = singleManagerFacility(actor)
  const identity = `${actor?.id}:${actor?.status}:${JSON.stringify(actor?.roles)}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${facilityId}`
  return (
    <div className="fade-in min-w-0 max-w-full space-y-6">
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
            onOpenRental={onOpenRental}
            onOpenMaintenance={onOpenMaintenance}
            view={view}
          />
        </>
      )}
    </div>
  )
}

function InventoryRead({
  identity,
  facilityId,
  onOpenRental,
  onOpenMaintenance,
  view,
}: {
  identity: string
  facilityId: string
  onOpenRental?: (rentalId: string) => void
  onOpenMaintenance?: (unitId: string, unitCode: string) => void
  view: 'info' | 'assignment'
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingType, setEditingType] = useState<(CustomerUnitType & { floor?: string; zone?: string })>()
  const [reviewNotice, setReviewNotice] = useState('')
  const [deletingType, setDeletingType] = useState<{ id: string; name: string }>()
  const [restoringType, setRestoringType] = useState<CustomerUnitType>()
  const [actionError, setActionError] = useState<string>()
  const [actionBusy, setActionBusy] = useState(false)
  const read = useRentalApiResource(identity, async () => {
    try { return await loadManagerInventory(facilityId) }
    catch (error) {
      if (view === 'assignment' && error instanceof ApiClientError && error.status === 404) return { catalog: [], units: [] }
      throw error
    }
  })
  const rentals = useRentalApiResource(`${identity}:rentals`, () =>
    loadInventoryRentals(facilityId),
  )
  const unitTypes = useRentalApiResource(`${identity}:unit-types`, async () =>
    (await listAccessibleUnitTypes(facilityId, 0, 100)).data,
  )
  const actor = getAuthenticatedActor()
  const facilityName = (facilityId && actor?.facilityNames?.[facilityId]) || Object.values(actor?.facilityNames || {})[0] || 'Cơ sở được phân công'
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
    <>
      {view !== 'assignment' && <ManagerFacilityLifecycleRequest facilityId={facilityId} facilityName={facilityName} />}
      {view === 'assignment' ? <InventoryContent inventory={read.data} rentals={rentals} identity={identity} onOpenRental={onOpenRental} onOpenMaintenance={onOpenMaintenance} showCatalog={false} title="Danh sách gian kho để phân" /> : <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Cơ sở phụ trách</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
              {facilityName}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900 mt-1">Quản lý gian kho thực tế</h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">Khởi tạo và quản lý loại kho, diện tích và số lượng gian kho tại cơ sở {facilityName}.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + Thêm loại kho thực tế
        </Button>
      </div>
      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      <Card className="space-y-4 p-5">
        <div><h3 className="text-lg font-bold">Thông tin các loại kho</h3><p className="mt-1 text-sm text-stone-500">Thông số, sức chứa và tình trạng khai thác của từng loại kho tại cơ sở.</p></div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {read.data.catalog.map(type => {
          const detail = unitTypes.data?.find(item => item.id === type.id)
          const unit = read.data?.units.find(item => item.unitTypeId === type.id)
          return <article key={type.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-4">
              <div><div className="flex flex-wrap items-center gap-2"><h4 className="text-base font-bold">{type.name}</h4>{detail ? <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${facilityCatalogTypeStatusClass(detail)}`}>{facilityCatalogTypeStatusLabel(detail)}</span> : <Badge variant="muted">Đang tải</Badge>}</div><p className="mt-1 text-xs text-stone-500">Mã {type.code} · {type.total} gian · Tầng {unit?.floor || '—'} · {unit?.zone || 'Chưa có khu vực'}</p></div>
              <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => {
              setActionBusy(true); setActionError(undefined)
              try {
                const loaded = detail || (await listAccessibleUnitTypes(facilityId, 0, 100)).data.find(item => item.id === type.id)
                if (!loaded) throw new Error('Không tìm thấy loại kho. Vui lòng tải lại danh sách.')
                setEditingType({ ...loaded, floor: unit?.floor || '', zone: unit?.zone || '' })
              } catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
            }} disabled={actionBusy || detail?.status === 'archived'}>Chỉnh sửa</Button>
            {detail?.status === 'archived' ? (
              <Button variant="outline" disabled={actionBusy} onClick={() => { setActionError(undefined); setRestoringType(detail) }}>
                Khôi phục
              </Button>
            ) : (
              <Button variant="outline" disabled={actionBusy} onClick={() => { setActionError(undefined); setDeletingType(type) }}>
                Lưu trữ loại kho
              </Button>
            )}
              </div>
            </div>
            {detail ? <div className="space-y-4 p-4">
              <div className="flex gap-4">{detail.imageUrl ? <img src={detail.imageUrl} alt={detail.name} className="h-24 w-32 shrink-0 rounded-xl object-cover" /> : <div className="grid h-24 w-32 shrink-0 place-items-center rounded-xl bg-stone-100 text-xs text-stone-500">Chưa có ảnh</div>}<p className="line-clamp-4 text-sm leading-6 text-stone-600">{detail.description || 'Chưa có mô tả cho loại kho này.'}</p></div>
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-4">
                {([['Diện tích', `${detail.areaM2} m²`], ['Thể tích', `${detail.volumeM3} m³`], ['Tải trọng', `${detail.maxLoadKg} kg`], ['Giá mỗi tháng', facilityCatalogTypeHasPrice(detail) ? formatVndAmount(detail.monthlyPrice) : 'Chờ định giá']] as [string, string][]).map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 text-sm font-bold text-stone-900">{value}</dd></div>)}
              </dl>
              <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-stone-500">Kích thước kho</dt><dd className="mt-1 font-medium">{detail.lengthM} × {detail.widthM} × {detail.heightM} m</dd></div>
                <div><dt className="text-xs text-stone-500">Tình trạng sử dụng</dt><dd className="mt-1 font-medium">{detail.availableCount ?? 0} còn trống · {detail.occupiedCount ?? 0} đang dùng</dd></div>
                <div><dt className="text-xs text-stone-500">Số khung kệ mỗi gian</dt><dd className="mt-1 font-medium">{detail.rackCount} khung</dd></div>
                <div><dt className="text-xs text-stone-500">Lối đi và xe đẩy</dt><dd className="mt-1 font-medium">Rộng {detail.aisleWidthM ?? '—'} m · {detail.trolleyType || 'Chưa khai báo'}</dd></div>
                <div><dt className="text-xs text-stone-500">Sức chứa dự kiến</dt><dd className="mt-1 font-medium">{detail.smallBoxCapacity ?? 0} thùng nhỏ · {detail.largeBoxCapacity ?? 0} thùng lớn</dd></div>
                <div><dt className="text-xs text-stone-500">Tiền cọc đảm bảo kho</dt><dd className="mt-1 font-medium">{formatVndAmount(detail.securityDepositAmount)}</dd></div>
              </dl>
            </div> : <p className="p-4 text-sm text-stone-500">Đang tải thông tin chi tiết loại kho...</p>}
          </article>
        })}
        </div>
        {read.data.catalog.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/80 p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-stone-700">Cơ sở {facilityName} chưa có loại gian kho thực tế nào</p>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Vui lòng bấm nút "Thêm loại kho thực tế" bên trên để khai báo kích thước, tải trọng và số lượng gian kho cho cơ sở.
            </p>
            <div className="pt-1">
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                + Khởi tạo loại kho đầu tiên
              </Button>
            </div>
          </div>
        )}
      </Card>
      <InventoryContent inventory={read.data} rentals={rentals} identity={identity} onOpenRental={onOpenRental} onOpenMaintenance={onOpenMaintenance} />
      <div id="manager-goods-catalog" className="scroll-mt-6"><ManagerGoodsCatalogPanel /></div>
      <ManagerUnitTypeModal
        open={createOpen}
        facilityId={facilityId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); read.refresh(); unitTypes.refresh() }}
      />
      {reviewNotice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{reviewNotice}</p>}
      {editingType && (
        <ManagerUnitTypeModal
          key={editingType.id}
          open
          facilityId={facilityId}
          initial={editingType}
          onClose={() => setEditingType(undefined)}
          onCreated={() => { setEditingType(undefined); setReviewNotice('Đã xử lý thay đổi loại kho, các thay đổi cần duyệt đã được gửi tới bộ phận vận hành.'); read.refresh(); unitTypes.refresh() }}
        />
      )}
      <Modal open={!!deletingType} onClose={() => { if (!actionBusy) setDeletingType(undefined) }} title="Lưu trữ loại kho">
        <div className="space-y-4"><p>Chuyển loại kho <b>{deletingType?.name}</b> sang trạng thái lưu trữ? Dữ liệu lịch sử và các đơn đặt chỗ cũ vẫn được giữ nguyên.</p>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={actionBusy} onClick={() => setDeletingType(undefined)}>Hủy</Button><Button disabled={actionBusy} onClick={async () => {
            if (!deletingType) return
            setActionBusy(true); setActionError(undefined)
            try {
              await archiveManagerUnitType(deletingType.id)
              setDeletingType(undefined)
              read.refresh()
              unitTypes.refresh()
            }
            catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
          }}>{actionBusy ? 'Đang lưu trữ...' : 'Xác nhận lưu trữ'}</Button></div>
        </div>
      </Modal>
      <Modal open={!!restoringType} onClose={() => { if (!actionBusy) setRestoringType(undefined) }} title="Khôi phục loại kho">
        <div className="space-y-4">
          <p>Khôi phục loại kho <b>{restoringType?.name}</b> về trạng thái chờ định giá. Sau đó bộ phận vận hành cần kiểm tra giá trước khi công bố cơ sở.</p>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={actionBusy} onClick={() => setRestoringType(undefined)}>Hủy</Button>
            <Button disabled={actionBusy} onClick={async () => {
              if (!restoringType) return
              setActionBusy(true); setActionError(undefined)
              try {
                await restoreManagerUnitType(restoringType.id)
                setRestoringType(undefined)
                setReviewNotice('Đã khôi phục loại kho về trạng thái chờ định giá.')
                read.refresh()
                unitTypes.refresh()
              } catch (error) {
                setActionError(managerDisplayError(error))
              } finally {
                setActionBusy(false)
              }
            }}>{actionBusy ? 'Đang khôi phục...' : 'Xác nhận khôi phục'}</Button>
          </div>
        </div>
      </Modal>
      </>}
    </>
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
  onCreateUnitType,
  onOpenRental,
  onOpenMaintenance,
  showCatalog = true,
  title = "Quản lý gian kho",
}: {
  inventory: Awaited<ReturnType<typeof loadManagerInventory>>
  rentals?: InventorySourceRead<RentalApiRecord[]>
  identity?: string
  onCreateUnitType?: () => void
  onOpenRental?: (rentalId: string) => void
  onOpenMaintenance?: (unitId: string, unitCode: string) => void
  showCatalog?: boolean
  title?: string
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
  let selectedRentals: RentalApiRecord[] = []
  if (selected && rentals.data) {
    try { selectedRentals = currentInventoryRentals(selected, rentals.data) }
    catch { selectedRentals = [] }
  }
  const selectedRental = selectedRentals.length === 1 ? selectedRentals[0] : undefined
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
  const operationalCount = units.filter((u) => u.status !== "inactive" && u.status !== "archived").length
  const occupied = count("occupied")
  const change = (patch: Partial<InventoryFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  if (units.length === 0) {
    return <Card className="p-6 text-center"><h3 className="font-bold text-stone-900">Chưa có gian kho</h3><p className="mt-1 text-sm text-stone-500">Cơ sở chưa có gian kho để hiển thị hoặc phân cho khách hàng.</p></Card>
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
        <StatCard title="Tổng số gian" value={operationalCount} icon={Icon.box} />
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
      <SectionHeader title={title} action={onCreateUnitType && <Button variant="primary" onClick={onCreateUnitType}>+ Thêm loại kho</Button>} />
      <Card className="p-4">
        <div className="grid items-end gap-3 md:grid-cols-2 2xl:grid-cols-6">
          <label className="block min-w-0 text-sm font-medium text-stone-700 md:col-span-2">
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
            ["inactive", statusLabels.inactive],
            ["archived", statusLabels.archived],
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
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters(emptyInventoryFilters)
              setPage(1)
            }}
          >Xóa bộ lọc</Button>
        </div>
      </Card>
      <div className="flex flex-wrap items-end justify-between gap-3 text-sm text-stone-600">
        <span>Hiển thị {visible.length} trên {units.length} gian kho</span>
        <div className="w-full sm:w-64">{filter("Sắp xếp", "sort", [
            ["attention", "Cần chú ý trước"],
            ["code", "Sắp xếp theo mã gian"],
            ["area-desc", "Diện tích từ lớn đến nhỏ"],
            ["price-asc", "Giá từ thấp đến cao"],
            ["price-desc", "Giá từ cao đến thấp"],
          ])}</div>
        </div>
      <Card className="min-w-0 max-w-full overflow-hidden">
        <Table className="max-w-full" tableClassName="min-w-[900px] table-fixed [&_th]:px-3 [&_td]:px-3">
          <caption className="sr-only">Danh sách gian kho của cơ sở</caption>
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[21%]" />
            <col className="w-[14%]" />
            <col className="w-[15%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
          </colgroup>
          <Thead>
            <tr>
              <Th className="whitespace-nowrap text-left align-middle">Gian kho</Th>
              <Th className="text-left align-middle">Loại gian kho</Th>
              <Th className="text-left align-middle">Vị trí</Th>
              <Th className="whitespace-nowrap text-left align-middle">Trạng thái</Th>
              <Th className="whitespace-nowrap text-right align-middle">Giá niêm yết</Th>
              <Th className="whitespace-nowrap text-center align-middle">Thao tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {pagination.items.map((u) => (
              <Tr key={u.id} className="odd:bg-white even:bg-stone-50/50">
                <Td className="align-middle">
                  <p className="break-words font-mono text-sm font-bold leading-5 [overflow-wrap:anywhere]" title={u.code}>{u.code}</p>
                </Td>
                <Td className="align-middle">
                  <p className="font-semibold leading-5">{typeLabel(u)}</p>
                  {(u.definition.areaM2 !== null || (u.definition.lengthM !== null && u.definition.widthM !== null)) &&
                    <p className="mt-1 text-xs text-stone-500">
                      {u.definition.areaM2 !== null && `${measure(u.definition.areaM2, "m²")}`}
                      {u.definition.lengthM !== null && u.definition.widthM !== null && ` (${u.definition.lengthM.toLocaleString("vi-VN")} × ${u.definition.widthM.toLocaleString("vi-VN")} m)`}
                    </p>}
                </Td>
                <Td className="min-w-0 align-middle">
                  <div className="space-y-1">
                    <p className="truncate" title={u.floor?.trim() ? `Tầng ${u.floor}` : missing}>{u.floor?.trim() ? `Tầng ${u.floor}` : missing}</p>
                    <p className="truncate text-xs text-stone-500" title={location(u.zone)}>{location(u.zone)}</p>
                  </div>
                </Td>
                <Td className="align-middle">
                  <span className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${statusClasses[u.status]}`}>
                    {statusLabels[u.status]}
                  </span>
                </Td>
                <Td className="text-right align-middle tabular-nums">
                  {u.definition.monthlyPrice == null || u.definition.monthlyPrice <= 0 ? (
                    <p className="text-sm text-stone-500">Chờ quản lý vận hành định giá</p>
                  ) : (
                    <div className="whitespace-nowrap">
                      <p className="font-semibold text-stone-800">
                        {formatVndAmount(u.definition.monthlyPrice)}
                      </p>
                      <p className="text-xs text-stone-500">/tháng</p>
                    </div>
                  )}
                </Td>
                <Td className="text-center align-middle">
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
      {showCatalog && <><Card>
        <h2 className="border-b border-stone-200 p-4 font-bold">
          Loại gian kho tại cơ sở
        </h2>
        <FacilityCatalogTable rows={inventory.catalog} />
      </Card>
      </>}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(undefined)}
        size="xl"
        customHeader={selected && <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="modal-title" className="text-lg font-bold text-slate-900">Chi tiết gian kho · <span className="font-mono">{selected.code}</span></h2>
            <span className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${statusClasses[selected.status]}`}>{statusLabels[selected.status]}</span>
          </div>
          <button type="button" aria-label="Đóng chi tiết gian kho" className="shrink-0 rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900" onClick={() => setSelectedId(undefined)}>Đóng</button>
        </div>}
        contentClassName="max-h-[calc(90vh-76px)] overflow-y-auto p-4 sm:p-6"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {([
                ["Loại gian kho", typeLabel(selected)],
                ["Tầng", location(selected.floor)],
                ["Khu vực", location(selected.zone)],
                ["Kích thước", dimensions(selected)],
                ["Diện tích", measure(selected.definition.areaM2, "m²")],
                ["Thể tích", measure(selected.definition.volumeM3, "m³")],
                ["Tải trọng tối đa", measure(selected.definition.maxLoadKg, "kg")],
                ["Giá niêm yết", selected.definition.monthlyPrice == null || selected.definition.monthlyPrice <= 0 ? "Chờ quản lý vận hành định giá" : `${formatVndAmount(selected.definition.monthlyPrice)}/tháng`],
              ] as [string, string][]).map(([label, value]) => <div key={label} className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="mt-1 break-words text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">{value}</dd>
              </div>)}
            </dl>
            <section className="space-y-2 border-t border-stone-200 pt-4">
              <h3 className="font-bold">Hồ sơ thuê</h3>
              <InventoryRentalSummary unit={selected} read={rentals} detailed />
            </section>
            <InventoryMaintenanceDetails
              key={`${identity}:${selected.id}:maintenance`}
              unit={selected}
              identity={identity}
            />
            {(((selected.status === "available" || selected.status === "maintenance") && onOpenMaintenance) || (selectedRental && onOpenRental) || (selected.status === "occupied" && !selectedRentals.length)) && <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
              {selected.status === "occupied" && !selectedRentals.length && <Button variant="outline" onClick={() => rentals.refresh?.()}>Kiểm tra lại hồ sơ</Button>}
              {(selected.status === "available" || selected.status === "maintenance") && onOpenMaintenance && <Button variant="outline" onClick={() => { setSelectedId(undefined); onOpenMaintenance(selected.id, selected.code) }}>Tạo yêu cầu bảo trì</Button>}
              {selectedRental && onOpenRental && <Button onClick={() => { setSelectedId(undefined); onOpenRental(selectedRental.id) }}>Xem hồ sơ thuê</Button>}
            </div>}
          </div>
        )}
      </Modal>
    </>
  )
}
