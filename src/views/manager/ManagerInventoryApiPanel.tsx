import { useEffect, useMemo, useState } from "react"
import ManagerWarehouseImageField from "./ManagerWarehouseImageField"
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
import { facilityCatalogTypeName } from "./managerFacilityCatalogApi"
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
import { archiveManagerUnitType, createManagerUnitType, updateManagerUnitType } from "../../services/managerUnitTypeApi"
import { listAccessibleUnitTypes, type CustomerUnitType } from "../../services/customerReservationApi"
import { generateUnitTypeCode, formatPhysicalUnitCode, previewPhysicalUnitCodes } from "./managerUnitCodeHelpers"
import ManagerGoodsCatalogPanel from "./ManagerGoodsCatalogPanel"
import { getManagerGoodsCatalog } from "../../services/managerGoodsCatalogApi"
import type { GoodsCatalog } from "../../services/customerReservationApi"

const statusLabels: Record<InventoryUnit["status"], string> = {
  available: "Còn trống",
  occupied: "Đang sử dụng",
  reserved: "Đã giữ cho khách",
  assigned: "Đã phân gian",
  held: "Đang giữ tạm thời",
  maintenance: "Đang bảo trì",
}
const statusClasses: Record<InventoryUnit["status"], string> = {
  available: "bg-green-100 text-green-700",
  occupied: "bg-blue-50 text-blue-700",
  reserved: "bg-violet-50 text-violet-700",
  assigned: "bg-violet-50 text-violet-700",
  held: "bg-amber-50 text-amber-800",
  maintenance: "bg-red-50 text-red-700",
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
        <div className="grid grid-cols-1 gap-4">
        {read.data.catalog.map(type => {
          const detail = unitTypes.data?.find(item => item.id === type.id)
          const unit = read.data?.units.find(item => item.unitTypeId === type.id)
          return <article key={type.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-4">
              <div><div className="flex flex-wrap items-center gap-2"><h4 className="text-base font-bold">{type.name}</h4><Badge variant={detail?.status === 'active' ? 'success' : 'muted'}>{detail ? (({ active: 'Đang khai thác', awaiting_pricing: 'Chờ định giá', draft: 'Đang thiết lập', inactive: 'Tạm ngưng', archived: 'Đã lưu trữ' } as Record<string, string>)[detail.status] || 'Chưa xác định') : 'Đang tải'}</Badge></div><p className="mt-1 text-xs text-stone-500">Mã {type.code} · {type.total} gian · Tầng {unit?.floor || '—'} · {unit?.zone || 'Chưa có khu vực'}</p></div>
              <div className="flex gap-2">
            <Button variant="outline" disabled={actionBusy} onClick={async () => {
              setActionBusy(true); setActionError(undefined)
              try {
                const loaded = detail || (await listAccessibleUnitTypes(facilityId, 0, 100)).data.find(item => item.id === type.id)
                if (!loaded) throw new Error('Không tìm thấy loại kho. Vui lòng tải lại danh sách.')
                setEditingType({ ...loaded, floor: unit?.floor || '', zone: unit?.zone || '' })
              } catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
            }}>Chỉnh sửa</Button>
            <Button variant="outline" disabled={actionBusy} onClick={() => { setActionError(undefined); setDeletingType(type) }}>Lưu trữ loại kho</Button>
              </div>
            </div>
            {detail ? <div className="space-y-4 p-4">
              <div className="flex gap-4">{detail.imageUrl ? <img src={detail.imageUrl} alt={detail.name} className="h-24 w-32 shrink-0 rounded-xl object-cover" /> : <div className="grid h-24 w-32 shrink-0 place-items-center rounded-xl bg-stone-100 text-xs text-stone-500">Chưa có ảnh</div>}<p className="line-clamp-4 text-sm leading-6 text-stone-600">{detail.description || 'Chưa có mô tả cho loại kho này.'}</p></div>
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-4">
                {([['Diện tích', `${detail.areaM2} m²`], ['Thể tích', `${detail.volumeM3} m³`], ['Tải trọng', `${detail.maxLoadKg} kg`], ['Giá mỗi tháng', Number(detail.monthlyPrice) > 0 ? formatVndAmount(detail.monthlyPrice) : 'Chờ định giá']] as [string, string][]).map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 text-sm font-bold text-stone-900">{value}</dd></div>)}
              </dl>
              <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-stone-500">Kích thước kho</dt><dd className="mt-1 font-medium">{detail.lengthM} × {detail.widthM} × {detail.heightM} m</dd></div>
                <div><dt className="text-xs text-stone-500">Tình trạng sử dụng</dt><dd className="mt-1 font-medium">{detail.availableCount ?? 0} còn trống · {detail.occupiedCount ?? 0} đang dùng</dd></div>
                <div><dt className="text-xs text-stone-500">Khung kệ</dt><dd className="mt-1 font-medium">{detail.rackCount} kệ, kích thước {detail.rackLengthM} × {detail.rackWidthM} × {detail.rackHeightM} m</dd></div>
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
      <ManagerGoodsCatalogPanel />
      <CreateUnitTypeModal
        open={createOpen}
        facilityId={facilityId}
        existingCodes={read.data.catalog.map(c => c.code)}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); read.refresh() }}
      />
      {reviewNotice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{reviewNotice}</p>}
      {editingType && (
        <CreateUnitTypeModal
          key={editingType.id}
          open
          facilityId={facilityId}
          initial={editingType}
          existingCodes={read.data.catalog.map(c => c.code)}
          onClose={() => setEditingType(undefined)}
          onCreated={() => { setEditingType(undefined); setReviewNotice('Đã lưu thay đổi loại kho và cập nhật số lượng gian kho thành công.'); read.refresh() }}
        />
      )}
      <Modal open={!!deletingType} onClose={() => { if (!actionBusy) setDeletingType(undefined) }} title="Lưu trữ loại kho">
        <div className="space-y-4"><p>Chuyển loại kho <b>{deletingType?.name}</b> sang trạng thái lưu trữ? Dữ liệu lịch sử và các đơn đặt chỗ cũ vẫn được giữ nguyên.</p>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={actionBusy} onClick={() => setDeletingType(undefined)}>Hủy</Button><Button disabled={actionBusy} onClick={async () => {
            if (!deletingType) return
            setActionBusy(true); setActionError(undefined)
            try { await archiveManagerUnitType(deletingType.id); setDeletingType(undefined); read.refresh() }
            catch (error) { setActionError(managerDisplayError(error)) } finally { setActionBusy(false) }
          }}>{actionBusy ? 'Đang lưu trữ...' : 'Xác nhận lưu trữ'}</Button></div>
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

function CreateUnitTypeModal({ open, facilityId, existingCodes = [], onClose, onCreated, initial }: {
  open: boolean
  facilityId: string
  existingCodes?: string[]
  onClose: () => void
  onCreated: () => void
  initial?: CustomerUnitType & { floor?: string; zone?: string }
}) {
  const [form, setForm] = useState({
    code: '', name: '', description: '', lengthM: '8', widthM: '10', heightM: '5', maxLoadKg: '1000',
    rackCount: '4', rackLengthM: '4', rackWidthM: '2', rackHeightM: '4.5',
    aisleWidthM: '1.8', trolleyType: 'Xe đẩy tay / xe sàn nhỏ', smallBoxCapacity: '336', largeBoxCapacity: '200',
    physicalUnitCount: '1', floor: '1', zone: 'Khu A', imageUrl: '', detailImageUrl: initial?.detailImageUrl || '',
    ...(initial ? Object.fromEntries(Object.entries(initial).filter(([key]) => ['code', 'name', 'description', 'lengthM', 'widthM', 'heightM', 'maxLoadKg', 'rackCount', 'rackLengthM', 'rackWidthM', 'rackHeightM', 'aisleWidthM', 'trolleyType', 'smallBoxCapacity', 'largeBoxCapacity', 'floor', 'zone', 'imageUrl'].includes(key)).map(([key, value]) => [key, value == null ? '' : String(value)])) : {}),
    ...(initial ? { physicalUnitCount: String(initial.totalCount ?? 0) } : {}),
  })
  const [isAutoCode, setIsAutoCode] = useState(!initial)
  const [busy, setBusy] = useState(false)
  const [imageReading, setImageReading] = useState(false)
  const [error, setError] = useState<string>()
  const [goodsCatalog, setGoodsCatalog] = useState<GoodsCatalog>()
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initial?.acceptedGoodsCategoryIds || [])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(initial?.acceptedGoodsMaterialIds || [])

  useEffect(() => {
    if (!open) return
    setSelectedCategories(initial?.acceptedGoodsCategoryIds || [])
    setSelectedMaterials(initial?.acceptedGoodsMaterialIds || [])
    getManagerGoodsCatalog().then(setGoodsCatalog).catch(cause => setError(managerDisplayError(cause)))
  }, [open, initial?.id])

  const handleNameChange = (newName: string) => {
    setForm(current => {
      const next = { ...current, name: newName }
      if (isAutoCode && !initial) {
        next.code = newName.trim() ? generateUnitTypeCode(newName, existingCodes) : ''
      }
      return next
    })
  }

  const toggleAutoCode = () => {
    if (isAutoCode) {
      setIsAutoCode(false)
    } else {
      setIsAutoCode(true)
      const nextCode = form.name.trim() ? generateUnitTypeCode(form.name, existingCodes) : ''
      setForm(current => ({ ...current, code: nextCode }))
    }
  }

  const isDuplicateCode = useMemo(() => {
    const code = form.code.trim().toUpperCase()
    if (!code) return false
    return existingCodes.some(
      c => c.trim().toUpperCase() === code && (!initial || c.trim().toUpperCase() !== initial.code.trim().toUpperCase())
    )
  }, [form.code, existingCodes, initial])

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-sm font-medium text-stone-700">{label}
      <input
        className={`${inputClass} mt-1 disabled:bg-stone-100`}
        disabled={busy || (!!initial && key === 'code')}
        type={type}
        value={form[key]}
        onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}
      />
    </label>
  )
  const submit = async () => {
    if (imageReading || isDuplicateCode) return
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
        detailImageUrl: form.detailImageUrl.trim() || null,
        acceptedGoodsCategoryIds: selectedCategories,
        acceptedGoodsMaterialIds: selectedMaterials,
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
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Tên loại kho */}
          <label className="block text-sm font-medium text-stone-700">
            Tên loại kho *
            <input
              className={`${inputClass} mt-1`}
              disabled={busy}
              type="text"
              placeholder="VD: Kho Đồ Gia Đình, Kho Mini..."
              value={form.name}
              onChange={event => handleNameChange(event.target.value)}
            />
          </label>

          {/* Mã loại kho (Phương án 2) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-stone-700">Mã loại kho *</label>
                {isAutoCode && !initial && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <svg className="w-2.5 h-2.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Tự động tạo
                  </span>
                )}
              </div>

              {!initial && (
                <button
                  type="button"
                  onClick={toggleAutoCode}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
                  title={isAutoCode ? "Mở khóa để sửa mã thủ công" : "Khóa để tự động sinh mã theo tên loại kho"}
                >
                  {isAutoCode ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-stone-500 hover:text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Sửa tay</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-emerald-700 font-semibold">Tự động</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              type="text"
              readOnly={isAutoCode || !!initial}
              disabled={busy}
              className={`${inputClass} font-mono font-bold uppercase ${
                isAutoCode || !!initial
                  ? 'border-stone-300 bg-stone-100 text-stone-700 cursor-not-allowed select-all'
                  : isDuplicateCode || !form.code.trim()
                    ? 'border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500'
                    : 'border-stone-300 bg-white text-stone-900 focus:ring-amber-500'
              }`}
              placeholder={isAutoCode ? "Tự động sinh khi nhập tên (VD: KDGD-T01)" : "VD: VIP-01, MINI-A"}
              value={form.code}
              onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))}
            />
            {isDuplicateCode && (
              <p className="mt-1 text-xs text-red-600 font-medium">⚠️ Mã loại kho này đã tồn tại trong cơ sở.</p>
            )}
          </div>
        </div>
        <label className="block text-sm font-medium text-stone-700">Mô tả loại kho
          <textarea className={`${inputClass} mt-1`} rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />
        </label>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ManagerWarehouseImageField label="Ảnh tổng quan kho" value={form.imageUrl} disabled={busy || imageReading}
            onChange={value => setForm(current => ({ ...current, imageUrl: value }))} onReading={setImageReading} onError={setError} />
          <ManagerWarehouseImageField label="Ảnh chi tiết / sơ đồ bố trí" value={form.detailImageUrl} disabled={busy || imageReading}
            onChange={value => setForm(current => ({ ...current, detailImageUrl: value }))} onReading={setImageReading} onError={setError} />
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
        <div className="grid gap-4 sm:grid-cols-3">
          {field('physicalUnitCount', 'Số gian kho', 'number')}
          {field('floor', 'Tầng')}
          {field('zone', 'Khu vực')}
        </div>

        {/* Preview mã gian kho vật lý (Cách B) */}
        {!initial ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Quy tắc sinh mã gian kho vật lý (Chuẩn Tòa nhà / Khách sạn):</span>
            </div>
            <p className="text-stone-600">
              Định dạng: <span className="font-semibold font-mono text-stone-800">[Khu vực]-[Tầng][Số thứ tự]</span>
              {' '}(VD: Khu A, Tầng 1 → <span className="font-mono font-semibold text-amber-800">A-101, A-102...</span>)
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60 font-mono">
              <span className="font-semibold text-stone-700 font-sans">Mã gian kho sinh ra:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-amber-300 font-bold text-amber-800 shadow-xs">
                {previewPhysicalUnitCodes(form.zone, form.floor, Number(form.physicalUnitCount) || 1)}
              </span>
              <span className="text-xs text-stone-500 font-sans">
                ({Number(form.physicalUnitCount) || 1} gian kho vật lý tự động tạo sẵn)
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Điều chỉnh số lượng gian kho:
              </span>
              <span className="text-stone-500">
                Hiện có: <b className="text-stone-800">{initial.totalCount ?? 0}</b> gian
              </span>
            </div>
            {(() => {
              const current = initial.totalCount ?? 0
              const target = Math.max(0, Number(form.physicalUnitCount) || 0)
              const diff = target - current
              if (diff > 0) {
                return (
                  <p className="text-emerald-700 font-medium">
                    🟢 Tăng thêm <b>+{diff}</b> gian kho vật lý mới (tổng thành <b>{target}</b> gian). Các gian mới sẽ tự động sinh mã theo chuẩn Cách B: <b>{formatPhysicalUnitCode(form.zone, form.floor, current + 1)} → {formatPhysicalUnitCode(form.zone, form.floor, target)}</b>.
                  </p>
                )
              }
              if (diff < 0) {
                return (
                  <p className="text-amber-700 font-medium">
                    🟡 Giảm <b>{Math.abs(diff)}</b> gian kho trống (từ <b>{current}</b> xuống <b>{target}</b> gian). Lưu ý: Chỉ các gian đang trống và chưa có hồ sơ liên quan mới được thu hồi.
                  </p>
                )
              }
              return (
                <p className="text-stone-600">
                  Số lượng gian kho giữ nguyên (<b>{current}</b> gian). Bạn có thể thay đổi số lượng ở ô trên để thêm hoặc giảm gian kho.
                </p>
              )
            })()}
          </div>
        )}
      </section>
      <section className="rounded-xl border border-stone-200 p-4 space-y-3">
        <div><h3 className="font-semibold text-stone-900">Loại hàng được nhận</h3><p className="mt-1 text-sm text-stone-500">Chọn loại hàng trước, sau đó chọn các vật liệu được phép lưu trong loại kho này. Thay đổi phạm vi này cần BO xác nhận lại giá.</p></div>
        {!goodsCatalog ? <p className="text-sm text-stone-500">Đang tải danh mục hàng hóa…</p> : goodsCatalog.categories.filter(category => category.status === 'ACTIVE').map(category => {
          const checked = selectedCategories.includes(category.id)
          const materials = category.materials.filter(material => material.status === 'ACTIVE')
          return <div key={category.id} className="rounded-lg border border-stone-200 p-3">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={checked} onChange={event => {
              setSelectedCategories(current => event.target.checked ? [...new Set([...current, category.id])] : current.filter(id => id !== category.id))
              if (!event.target.checked) setSelectedMaterials(current => current.filter(id => !materials.some(material => material.id === id)))
            }} />{category.label}</label>
            {checked && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{materials.map(material => <label key={material.id} className="flex items-center gap-2 rounded bg-stone-50 px-3 py-2 text-sm"><input type="checkbox" checked={selectedMaterials.includes(material.id)} onChange={event => setSelectedMaterials(current => event.target.checked ? [...new Set([...current, material.id])] : current.filter(id => id !== material.id))} />{material.label}{material.fragile ? ' · Dễ vỡ' : ''}</label>)}</div>}
          </div>
        })}
      </section>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-stone-200 pt-4"><Button variant="outline" disabled={busy || imageReading} onClick={onClose}>Hủy</Button><Button disabled={busy || imageReading || !form.code.trim() || !form.name.trim() || isDuplicateCode || selectedCategories.length === 0} onClick={() => void submit()}>{imageReading ? 'Đang đọc ảnh…' : busy ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Thêm loại kho'}</Button></div>
    </div>
  </Modal>
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
      <ManagerGoodsCatalogPanel /></>}
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
