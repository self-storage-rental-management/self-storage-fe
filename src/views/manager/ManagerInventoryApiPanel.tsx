import { useEffect, useMemo, useState, useRef } from "react"
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
                setEditingType({ ...detail, floor: unit?.floor || '', zone: unit?.zone || '' })
              } catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
            }}>Chỉnh sửa</Button>
            <Button variant="outline" disabled={actionBusy} onClick={() => { setActionError(undefined); setDeletingType(type) }}>Xóa loại kho</Button>
          </div>
        </div>)}
        {read.data.catalog.length === 0 && <p className="text-sm text-stone-500">Chưa có loại kho thực tế.</p>}
      </Card>
      <InventoryContent inventory={read.data} rentals={rentals} identity={identity} />
      <CreateUnitTypeModal open={createOpen} facilityId={facilityId} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); read.refresh() }} />
      {editingType && <CreateUnitTypeModal key={editingType.id} open facilityId={facilityId} initial={editingType} onClose={() => setEditingType(undefined)} onCreated={() => { setEditingType(undefined); read.refresh() }} />}
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [open, initial?.imageUrl])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP).')
      return
    }
    const reader = new FileReader()
    reader.onload = (uploadEvt) => {
      const result = uploadEvt.target?.result
      if (typeof result === 'string') {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 1200
          let w = img.width
          let h = img.height
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w)
              w = maxDim
            } else {
              w = Math.round((w * maxDim) / h)
              h = maxDim
            }
          }
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h)
            const compressed = canvas.toDataURL('image/jpeg', 0.85)
            setForm(current => ({ ...current, imageUrl: compressed }))
            setImageError(false)
          } else {
            setForm(current => ({ ...current, imageUrl: result }))
            setImageError(false)
          }
        }
        img.src = result
      }
    }
    reader.readAsDataURL(file)
  }

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
        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-700">
            Hình ảnh loại kho
          </label>
          <div className="flex flex-col sm:flex-row gap-3 items-start bg-stone-50 p-3 rounded-xl border border-stone-200">
            {/* Thumbnail Preview / Dropzone */}
            <div className="relative w-full sm:w-44 h-32 rounded-lg overflow-hidden bg-stone-200 border border-stone-300 shrink-0 group flex items-center justify-center shadow-xs">
              {form.imageUrl && !imageError ? (
                <>
                  <img
                    src={form.imageUrl}
                    alt={form.name || "Unit type"}
                    className="w-full h-full object-cover transition"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-stone-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer bg-white text-stone-800 text-[11px] font-bold px-2 py-1 rounded shadow hover:bg-stone-100 transition"
                    >
                      Đổi ảnh
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(current => ({ ...current, imageUrl: '' }))
                        setImageError(false)
                      }}
                      className="cursor-pointer bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2 py-1 rounded shadow transition"
                    >
                      Xóa
                    </button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-stone-300/50 transition"
                >
                  <svg className="w-8 h-8 text-stone-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-stone-600">Chọn ảnh từ máy</span>
                  <span className="text-[10px] text-stone-400">PNG, JPG, WebP</span>
                </div>
              )}
            </div>

            {/* Upload & URL Controls */}
            <div className="flex-1 w-full space-y-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Tải ảnh từ máy tính hoặc dán link ảnh (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Dán link ảnh (URL) hoặc chọn file từ máy..."
                    value={form.imageUrl}
                    onChange={e => {
                      setForm(current => ({ ...current, imageUrl: e.target.value }))
                      setImageError(false)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs shrink-0 transition cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Chọn file</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  Hỗ trợ định dạng PNG, JPG, WebP. Ảnh sẽ hiển thị đại diện cho loại kho này trên hệ thống.
                </p>
              </div>
            </div>
          </div>
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
