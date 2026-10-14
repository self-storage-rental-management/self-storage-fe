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
import { createManagerUnitType, updateManagerUnitType, deleteManagerUnitType } from "../../services/managerUnitTypeApi"
import { listAccessibleUnitTypes, type CustomerUnitType } from "../../services/customerReservationApi"

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
  const [createOpen, setCreateOpen] = useState(false)
  const [editingType, setEditingType] = useState<(CustomerUnitType & { floor?: string; zone?: string })>()
  const [reviewNotice, setReviewNotice] = useState('')
  const [viewingType, setViewingType] = useState<(CustomerUnitType & { floor?: string; zone?: string })>()
  const [deletingType, setDeletingType] = useState<{ id: string; name: string }>()
  const [actionError, setActionError] = useState<string>()
  const [actionBusy, setActionBusy] = useState(false)
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
    <>
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>Thêm loại kho thực tế</Button>
      </div>
      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      <Card className="p-4 space-y-3">
        <h3 className="font-bold">Quản lý loại kho thực tế</h3>
        {read.data.catalog.map(type => <div key={type.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3">
          <div><b>{type.code} · {type.name}</b><p className="text-xs text-stone-500">{type.total} gian kho</p></div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={actionBusy} onClick={async () => {
              setActionBusy(true); setActionError(undefined)
              try {
                const response = await listAccessibleUnitTypes(facilityId)
                const detail = response.data.find(item => item.id === type.id)
                if (!detail) throw new Error('Không tìm thấy loại kho. Vui lòng tải lại danh sách.')
                const unit = read.data?.units.find(item => item.unitTypeId === type.id)
                setViewingType({ ...detail, floor: unit?.floor || '', zone: unit?.zone || '' })
              } catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
            }}>Thông tin loại kho</Button>
            <Button variant="outline" disabled={actionBusy} onClick={async () => {
              setActionBusy(true); setActionError(undefined)
              try {
                const response = await listAccessibleUnitTypes(facilityId)
                const detail = response.data.find(item => item.id === type.id)
                if (!detail) throw new Error('Không tìm thấy loại kho. Vui lòng tải lại danh sách.')
                const unit = read.data?.units.find(item => item.unitTypeId === type.id)
                setEditingType({ ...detail, floor: unit?.floor || '', zone: unit?.zone || '' })
              } catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
            }}>Chỉnh sửa</Button>
            <Button variant="outline" disabled={actionBusy} onClick={() => { setActionError(undefined); setDeletingType(type) }}>Xóa loại kho</Button>
          </div>
        </div>)}
        {read.data.catalog.length === 0 && <p className="text-sm text-stone-500">Chưa có loại kho thực tế.</p>}
      </Card>
      <InventoryContent inventory={read.data} rentals={rentals} identity={identity} />
      <Modal open={!!viewingType} onClose={() => setViewingType(undefined)} title="Thông tin loại kho thực tế" size="xl">
        {viewingType && <div className="space-y-4">
          <div className="flex flex-col gap-4 rounded-xl bg-stone-50 p-4 sm:flex-row">
            {viewingType.imageUrl && <img src={viewingType.imageUrl} alt={viewingType.name} className="h-32 w-full rounded-lg object-cover sm:w-44" />}
            <div className="min-w-0"><h3 className="font-semibold">{viewingType.code} · {viewingType.name}</h3><p className="mt-2 whitespace-pre-wrap break-words text-stone-600">{viewingType.description || 'Chưa có mô tả'}</p></div>
          </div>
          {(() => {
            const fields = [
              ['Kích thước kho (D × R × C)', `${viewingType.lengthM} × ${viewingType.widthM} × ${viewingType.heightM} m`],
              ['Diện tích', `${viewingType.areaM2} m²`],
              ['Thể tích', `${viewingType.volumeM3} m³`],
              ['Tải trọng tối đa', `${viewingType.maxLoadKg} kg`],
              ['Số khung kệ', viewingType.rackCount],
              ['Kích thước khung (D × R × C)', `${viewingType.rackLengthM} × ${viewingType.rackWidthM} × ${viewingType.rackHeightM} m`],
              ['Chiều rộng lối đi (m)', viewingType.aisleWidthM],
              ['Xe đẩy hỗ trợ', viewingType.trolleyType],
              ['Sức chứa thùng nhỏ', viewingType.smallBoxCapacity],
              ['Sức chứa thùng lớn', viewingType.largeBoxCapacity],
              ['Tổng số gian', viewingType.totalCount],
              ['Đang sử dụng', viewingType.occupiedCount],
              ['Còn trống', viewingType.availableCount],
              ['Giá thuê / tháng', Number(viewingType.monthlyPrice) > 0 ? formatVndAmount(viewingType.monthlyPrice) : 'Chờ BO định giá'],
              ['Tiền cọc đảm bảo', formatVndAmount(viewingType.securityDepositAmount)],
              ['Trạng thái', ({ active: 'Đã công bố', awaiting_pricing: 'Chờ BO định giá', draft: 'Đang thiết lập', inactive: 'Ngừng hoạt động' } as Record<string, string>)[viewingType.status] || viewingType.status],
            ]
            const groups = [
              { title: 'Kích thước và tải trọng', items: fields.slice(0, 4) },
              { title: 'Khung kệ và thiết bị hỗ trợ', items: fields.slice(4, 8) },
              { title: 'Sức chứa thùng', items: fields.slice(8, 10) },
              { title: 'Số lượng và giá thuê', items: fields.slice(10) },
            ]
            return <div className="grid gap-4 lg:grid-cols-2">
              {groups.map((group, index) => <section key={group.title} className={`min-w-0 overflow-hidden rounded-xl border border-stone-200 ${index >= 2 ? 'lg:col-span-2' : ''}`}>
                <h4 className="border-b border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800">{group.title}</h4>
                <dl className={index >= 2 ? `grid gap-px bg-stone-200 sm:grid-cols-2 ${index === 3 ? 'lg:grid-cols-3' : ''}` : 'divide-y divide-stone-100 px-4'}>
                  {group.items.map(([label, value]) => <div key={String(label)} className={index >= 2 ? 'min-w-0 bg-white px-4 py-3' : 'grid grid-cols-1 gap-1 py-3 sm:grid-cols-2 sm:gap-3'}>
                    <dt className={index >= 2 ? 'mb-1 text-xs text-stone-500' : 'text-sm text-stone-500'}>{label}</dt>
                    <dd className={`min-w-0 whitespace-pre-wrap break-words font-medium text-stone-900 ${index >= 2 ? 'text-base' : 'text-sm'}`}>{value == null || value === '' ? 'Chưa khai báo' : value}</dd>
                  </div>)}
                </dl>
              </section>)}
            </div>
          })()}
          <div className="flex justify-end border-t border-stone-200 pt-4"><Button variant="outline" onClick={() => setViewingType(undefined)}>Đóng</Button></div>
        </div>}
      </Modal>
      <CreateUnitTypeModal open={createOpen} facilityId={facilityId} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); read.refresh() }} />
      {reviewNotice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{reviewNotice}</p>}
      {editingType && <CreateUnitTypeModal key={editingType.id} open facilityId={facilityId} initial={editingType} onClose={() => setEditingType(undefined)} onCreated={() => { setEditingType(undefined); setReviewNotice('Đã gửi thay đổi cho BO duyệt. Customer vẫn thấy thông tin đã được duyệt trước đó.'); read.refresh() }} />}
      <Modal open={!!deletingType} onClose={() => { if (!actionBusy) setDeletingType(undefined) }} title="Xóa loại kho">
        <div className="space-y-4"><p>Xóa loại kho <b>{deletingType?.name}</b> và các gian trống thuộc loại này? Loại kho có đơn đặt hoặc hồ sơ liên quan không được xóa.</p>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={actionBusy} onClick={() => setDeletingType(undefined)}>Hủy</Button><Button disabled={actionBusy} onClick={async () => {
            if (!deletingType) return
            setActionBusy(true); setActionError(undefined)
            try { await deleteManagerUnitType(deletingType.id); setDeletingType(undefined); read.refresh() }
            catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
          }}>{actionBusy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div>
        </div>
      </Modal>
    </>
  ) : (
    <Card className="p-5" role="alert">
      Chưa xác minh được dữ liệu gian kho.
    </Card>
  )
}

function CreateUnitTypeModal({ open, facilityId, onClose, onCreated, initial }: {
  open: boolean
  facilityId: string
  onClose: () => void
  onCreated: () => void
  initial?: CustomerUnitType & { floor?: string; zone?: string }
}) {
  const [form, setForm] = useState({
    code: '', name: '', description: '', lengthM: '8', widthM: '10', heightM: '5', maxLoadKg: '1000',
    rackCount: '4', rackLengthM: '4', rackWidthM: '2', rackHeightM: '4.5',
    aisleWidthM: '1.8', trolleyType: 'Xe đẩy tay / xe sàn nhỏ', smallBoxCapacity: '336', largeBoxCapacity: '200',
    physicalUnitCount: '1', floor: '1', zone: 'Khu A', imageUrl: '',
    ...(initial ? Object.fromEntries(Object.entries(initial).filter(([key]) => ['code', 'name', 'description', 'lengthM', 'widthM', 'heightM', 'maxLoadKg', 'rackCount', 'rackLengthM', 'rackWidthM', 'rackHeightM', 'aisleWidthM', 'trolleyType', 'smallBoxCapacity', 'largeBoxCapacity', 'floor', 'zone', 'imageUrl'].includes(key)).map(([key, value]) => [key, value == null ? '' : String(value)])) : {}),
    ...(initial ? { physicalUnitCount: String(initial.totalCount ?? 0) } : {}),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-sm font-medium text-stone-700">{label}
      <input className={`${inputClass} mt-1 disabled:bg-stone-100`} disabled={busy || (!!initial && ['code', 'physicalUnitCount', 'floor', 'zone'].includes(key))} type={type} value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
    </label>
  )
  const submit = async () => {
    setBusy(true); setError(undefined)
    try {
      const input = {
        code: form.code.trim().toUpperCase(), name: form.name.trim(), description: form.description.trim() || null,
        lengthM: Number(form.lengthM), widthM: Number(form.widthM), heightM: Number(form.heightM),
        maxLoadKg: Number(form.maxLoadKg), rackCount: Number(form.rackCount),
        rackLengthM: Number(form.rackLengthM), rackWidthM: Number(form.rackWidthM), rackHeightM: Number(form.rackHeightM),
        aisleWidthM: Number(form.aisleWidthM), trolleyType: form.trolleyType.trim(),
        smallBoxCapacity: Number(form.smallBoxCapacity), largeBoxCapacity: Number(form.largeBoxCapacity),
        physicalUnitCount: Number(form.physicalUnitCount), floor: form.floor.trim(), zone: form.zone.trim(),
        imageUrl: form.imageUrl.trim() || null,
      }
      if (initial) await updateManagerUnitType(initial.id, input)
      else await createManagerUnitType(facilityId, input)
      onCreated()
    } catch (cause) {
      setError(managerDisplayError(cause))
    } finally { setBusy(false) }
  }
  return <Modal open={open} onClose={() => { if (!busy) onClose() }} title={initial ? 'Chỉnh sửa loại kho thực tế' : 'Thêm loại kho thực tế'} size="xl">
    <div className="space-y-5">
      <section className="rounded-xl border border-stone-200 p-4 space-y-4">
        <h3 className="font-semibold text-stone-900">Thông tin loại kho</h3>
        <div className="grid gap-4 sm:grid-cols-2">{field('code', 'Mã loại kho')}{field('name', 'Tên loại kho')}</div>
        <label className="block text-sm font-medium text-stone-700">Mô tả loại kho
          <textarea className={`${inputClass} mt-1`} rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />
        </label>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-stone-700">Hình ảnh loại kho / sơ đồ bố trí
            <input type="url" placeholder="Dán đường dẫn ảnh https://…" value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl} disabled={busy}
              onChange={event => setForm(current => ({ ...current, imageUrl: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-stone-300 p-3" />
          </label>
          <label className="block text-sm text-stone-600">Hoặc chọn ảnh từ máy (JPG, PNG, WebP; tối đa 2 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-2 block w-full text-sm" onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
                setError('Vui lòng chọn ảnh JPG, PNG hoặc WebP không quá 2 MB.')
                return
              }
              const reader = new FileReader()
              reader.onload = () => { setForm(current => ({ ...current, imageUrl: String(reader.result) })); setError('') }
              reader.onerror = () => setError('Không đọc được ảnh. Vui lòng chọn lại.')
              reader.readAsDataURL(file)
            }} />
          </label>
          {form.imageUrl && <div className="flex flex-col gap-2">
            <img src={form.imageUrl} alt="Ảnh loại kho xem trước" className="max-h-64 w-full rounded-lg border border-stone-200 bg-stone-50 object-contain" />
            <Button variant="outline" disabled={busy} onClick={() => setForm(current => ({ ...current, imageUrl: '' }))}>Bỏ ảnh</Button>
          </div>}
        </div>
      </section>
      <section className="rounded-xl border border-stone-200 p-4 space-y-4">
        <h3 className="font-semibold text-stone-900">Kích thước và tải trọng</h3>
        <div className="grid gap-4 sm:grid-cols-3">
        {field('lengthM', 'Chiều dài (m)', 'number')}{field('widthM', 'Chiều rộng (m)', 'number')}{field('heightM', 'Chiều cao (m)', 'number')}
        </div><div className="grid gap-4 sm:grid-cols-2">{field('maxLoadKg', 'Tải trọng tối đa (kg)', 'number')}{field('aisleWidthM', 'Chiều rộng lối đi (m)', 'number')}</div>
      </section>
      <section className="rounded-xl border border-stone-200 p-4 space-y-4">
        <h3 className="font-semibold text-stone-900">Khung kệ và thiết bị hỗ trợ</h3>
        <div className="grid gap-4 sm:grid-cols-2">{field('rackCount', 'Số khung kệ', 'number')}{field('trolleyType', 'Loại xe đẩy hỗ trợ')}</div>
        <div className="grid gap-4 sm:grid-cols-3">
        {field('rackLengthM', 'Dài khung (m)', 'number')}{field('rackWidthM', 'Rộng khung (m)', 'number')}{field('rackHeightM', 'Cao khung (m)', 'number')}
        </div><div className="grid gap-4 sm:grid-cols-2">
        {field('smallBoxCapacity', 'Sức chứa thùng nhỏ', 'number')}{field('largeBoxCapacity', 'Sức chứa thùng lớn', 'number')}
        </div>
      </section>
      <section className="rounded-xl border border-stone-200 p-4 space-y-4">
        <h3 className="font-semibold text-stone-900">Số lượng và vị trí gian kho</h3>
        <div className="grid gap-4 sm:grid-cols-3">{field('physicalUnitCount', 'Số gian kho', 'number')}{field('floor', 'Tầng')}{field('zone', 'Khu vực')}</div>
      </section>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-stone-200 pt-4"><Button variant="outline" disabled={busy} onClick={onClose}>Hủy</Button><Button disabled={busy || !form.code.trim() || !form.name.trim()} onClick={() => void submit()}>{busy ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Thêm loại kho'}</Button></div>
    </div>
  </Modal>
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
                  {u.definition.monthlyPrice == null || u.definition.monthlyPrice <= 0 ? (
                    <p className="text-sm text-stone-500">Chờ BO định giá</p>
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
                  {selected.definition.monthlyPrice == null || selected.definition.monthlyPrice <= 0
                    ? 'Chờ BO định giá'
                    : `${formatVndAmount(selected.definition.monthlyPrice)}/tháng`}
                </b>
              </p>
            </div>
            <section className="space-y-2 border-t border-stone-200 pt-4">
              <h3 className="font-bold">Hồ sơ thuê</h3>
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
