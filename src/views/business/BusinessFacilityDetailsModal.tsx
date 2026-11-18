import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Badge, Button, Modal } from '../../components/ui'
import { UNIT_SPECS } from '../../data/demoDatabase'
import type { CustomerUnitType } from '../../services/customerReservationApi'
import type { RackResult } from '../../services/rackLayoutApi'
import type { Facility, FacilityCustomUnitSpec, StorageUnit } from '../../types/storageHub'
import { formatVndAmount } from '../../i18n/currency'

type DetailTab = 'overview' | 'unit-types' | 'policies'

type DetailPackage = {
  id: string
  title: string
  label: string
  months: number | 'other'
  discountPercent: number
  status: 'active' | 'inactive'
  scopeType?: 'all' | 'specific'
  facilityIds?: string[]
  effectiveFrom?: string
  effectiveTo?: string | null
  description?: string
}

type DisplayUnitType = Partial<CustomerUnitType> & Pick<CustomerUnitType, 'id' | 'facilityId' | 'code' | 'name'>

interface BusinessFacilityDetailsModalProps {
  open: boolean
  onClose: () => void
  facility: Facility | null
  apiMode: boolean
  unitTypes: CustomerUnitType[]
  localUnitSpecs: FacilityCustomUnitSpec[]
  facilityUnits: StorageUnit[]
  facilityTotalCount: number
  facilityOccupiedCount: number
  facilityAvailableCount: number
  packages: DetailPackage[]
  layouts: Record<string, RackResult | null>
}

const MISSING = 'Chưa có dữ liệu'

const tabLabels: Record<DetailTab, string> = {
  overview: 'Tổng quan',
  'unit-types': 'Loại kho',
  policies: 'Gói thuê',
}

const statusLabels: Record<string, string> = {
  setup: 'Đang thiết lập',
  active: 'Đang hoạt động',
  maintenance: 'Đang bảo trì',
  inactive: 'Đã ngừng hoạt động',
  archived: 'Đã lưu trữ',
  draft: 'Đang thiết lập',
  awaiting_pricing: 'Chờ định giá',
}

const unitStatusLabels: Record<string, string> = {
  available: 'Còn trống',
  occupied: 'Đang sử dụng',
  reserved: 'Đã giữ chỗ',
  assigned: 'Đã phân gian',
  maintenance: 'Bảo trì',
  archived: 'Đã lưu trữ',
}

const statusVariant = (status?: string): 'success' | 'warning' | 'muted' => {
  if (status === 'active') return 'success'
  if (status === 'maintenance' || status === 'awaiting_pricing' || status === 'setup') return 'warning'
  return 'muted'
}

const valueOrMissing = (value: unknown) => {
  if (value === null || value === undefined || value === '') return MISSING
  return String(value)
}

const numberValue = (value: number | null | undefined, unit = '') => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return MISSING
  return `${Number(value).toLocaleString('vi-VN')}${unit ? ` ${unit}` : ''}`
}

const priceValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) <= 0) return MISSING
  return formatVndAmount(Number(value))
}

const formatVietnameseDate = (value?: string | null) => {
  if (!value) return ''
  const source = value.trim()
  if (!source) return ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(source)
    ? new Date(`${source}T00:00:00`)
    : new Date(source)
  if (Number.isNaN(date.getTime())) return source
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const effectivePeriodValue = (from?: string | null, to?: string | null) => {
  const start = formatVietnameseDate(from)
  const end = formatVietnameseDate(to)
  if (!start && !end) return MISSING
  if (!end) return start
  if (!start) return end
  return `${start} – ${end}`
}

const dimensionsValue = (length?: number | null, width?: number | null, height?: number | null, unit = 'm') => {
  if (length === null || length === undefined || width === null || width === undefined || height === null || height === undefined) return MISSING
  return `${length} × ${width} × ${height} ${unit}`
}

const gateDimensionsValue = (width?: number | null, height?: number | null) => {
  if (width === null || width === undefined || height === null || height === undefined) return MISSING
  return `${width} × ${height} m`
}

const sampleValue = (sample?: RackResult['smallBox']) => {
  if (!sample) return MISSING
  return `${sample.lengthCm} × ${sample.widthCm} × ${sample.heightCm} cm · ${sample.weightKg} kg/thùng · tối đa ${sample.maxLayers} tầng`
}

const imageSource = (value?: string | null, width = 900) => {
  if (!value) return null
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('/')) return value
  return `https://images.unsplash.com/${value}?w=${width}&auto=format&fit=crop`
}

const matchesFacility = (facility: Facility, ids?: string[]) => {
  if (!ids?.length) return true
  return ids.includes(facility.id) || Boolean(facility.code && ids.includes(facility.code))
}

function PropertyTable({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y divide-stone-100">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm text-stone-500">{label}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-sm font-medium text-stone-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DetailAccordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="border-b border-stone-200 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-stone-900 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-stone-400" aria-hidden="true">⌄</span>
      </summary>
      <div className="pb-4">
        {children}
      </div>
    </details>
  )
}

function unitMatchesCode(unit: StorageUnit, code: string) {
  return unit.sizeCode === code || unit.size === code
}

function toLocalDisplayUnitType(facility: Facility, spec: FacilityCustomUnitSpec, units: StorageUnit[]): DisplayUnitType {
  const standard = (['S', 'M', 'L', 'XL'] as const).includes(spec.sizeCode as 'S' | 'M' | 'L' | 'XL')
    ? UNIT_SPECS[spec.sizeCode as 'S' | 'M' | 'L' | 'XL']
    : undefined
  const matchingUnits = units.filter(unit => unitMatchesCode(unit, spec.sizeCode))
  const hasUnitStatuses = matchingUnits.length > 0
  const occupiedCount = matchingUnits.filter(unit => unit.status === 'occupied' || (unit.status as string) === 'rented').length
  const availableCount = matchingUnits.filter(unit => unit.status === 'available').length

  return {
    id: spec.id || `local-${spec.sizeCode}`,
    facilityId: facility.id,
    code: spec.sizeCode,
    name: spec.name,
    description: standard?.cartEquipmentDetail,
    lengthM: spec.lengthM,
    widthM: spec.widthM,
    heightM: spec.heightM,
    areaM2: standard?.areaM2 ?? spec.lengthM * spec.widthM,
    volumeM3: standard?.volumeM3 ?? spec.lengthM * spec.widthM * spec.heightM,
    monthlyPrice: spec.monthlyPrice,
    securityDepositAmount: spec.monthlyPrice,
    maxLoadKg: spec.maxLoadKg,
    maxStoredLoadKg: spec.maxLoadKg,
    rackCount: spec.frameCount,
    rackLengthM: spec.frameDimensions?.lengthM,
    rackWidthM: spec.frameDimensions?.widthM,
    rackHeightM: spec.frameDimensions?.heightM,
    aisleWidthM: standard?.vehicleLaneWidthM ?? spec.laneWidthM,
    storageAisleWidthM: standard?.aisleM,
    gateWidthM: standard?.doorWidthM,
    gateHeightM: standard?.doorHeightM,
    trolleyType: standard?.cartEquipment,
    smallBoxCapacity: standard?.smallBoxes,
    largeBoxCapacity: standard?.largeBoxes,
    totalCount: spec.count,
    occupiedCount: hasUnitStatuses ? occupiedCount : undefined,
    availableCount: hasUnitStatuses ? availableCount : undefined,
  }
}

export default function BusinessFacilityDetailsModal({
  open,
  onClose,
  facility,
  apiMode,
  unitTypes,
  localUnitSpecs,
  facilityUnits,
  facilityTotalCount,
  facilityOccupiedCount,
  facilityAvailableCount,
  packages,
  layouts,
}: BusinessFacilityDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState('')

  const localDisplayTypes = useMemo(
    () => facility && !apiMode ? localUnitSpecs.map(spec => toLocalDisplayUnitType(facility, spec, facilityUnits)) : [],
    [apiMode, facility, facilityUnits, localUnitSpecs],
  )

  const displayUnitTypes = useMemo<DisplayUnitType[]>(
    () => apiMode ? unitTypes : localDisplayTypes,
    [apiMode, localDisplayTypes, unitTypes],
  )

  const selectedUnitType = useMemo(
    () => displayUnitTypes.find(type => type.id === selectedUnitTypeId) || displayUnitTypes[0],
    [displayUnitTypes, selectedUnitTypeId],
  )

  const selectedLayout = selectedUnitType ? layouts[selectedUnitType.id] : null
  const selectedRack = selectedLayout?.racks?.[0]
  const selectedRackConfiguration = selectedLayout?.configuration?.racks?.[0]

  const selectedTypeUnits = useMemo(
    () => selectedUnitType ? facilityUnits.filter(unit => unitMatchesCode(unit, selectedUnitType.code)) : [],
    [facilityUnits, selectedUnitType],
  )

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    facilityUnits.forEach(unit => counts.set(String(unit.status), (counts.get(String(unit.status)) || 0) + 1))
    return [...counts.entries()]
  }, [facilityUnits])

  const selectedTypeStatusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    selectedTypeUnits.forEach(unit => counts.set(String(unit.status), (counts.get(String(unit.status)) || 0) + 1))
    return [...counts.entries()]
  }, [selectedTypeUnits])

  const activePackages = useMemo(() => {
    if (!facility) return []
    return packages.filter(item => item.status === 'active' && matchesFacility(facility, item.facilityIds))
  }, [facility, packages])

  useEffect(() => {
    if (!open) return
    setActiveTab('overview')
  }, [facility?.id, open])

  useEffect(() => {
    if (!displayUnitTypes.some(type => type.id === selectedUnitTypeId)) {
      setSelectedUnitTypeId(displayUnitTypes[0]?.id || '')
    }
  }, [displayUnitTypes, selectedUnitTypeId])

  if (!facility) return null

  const facilityImage = imageSource(facility.image)
  const selectedTypeImage = imageSource(selectedUnitType?.imageUrl, 700)
  const selectedTypeDetailImage = imageSource(selectedUnitType?.detailImageUrl, 900)
  const minimumPrice = displayUnitTypes
    .map(type => Number(type.monthlyPrice))
    .filter(price => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right)[0]
  const facilityPrice = minimumPrice ? priceValue(minimumPrice) : valueOrMissing(facility.price)
  const facilityStatus = statusLabels[facility.status] || valueOrMissing(facility.status)
  const typeStatus = selectedUnitType?.status ? statusLabels[String(selectedUnitType.status)] || String(selectedUnitType.status) : MISSING
  const typeStatusBadge = selectedUnitType?.status ? <Badge variant={statusVariant(String(selectedUnitType.status))}>{typeStatus}</Badge> : MISSING
  const typeAvailable = selectedUnitType?.availableCount ?? (selectedTypeUnits.length ? selectedTypeUnits.filter(unit => unit.status === 'available').length : undefined)
  const typeOccupied = selectedUnitType?.occupiedCount ?? (selectedTypeUnits.length ? selectedTypeUnits.filter(unit => unit.status === 'occupied' || (unit.status as string) === 'rented').length : undefined)
  const typeTotal = selectedUnitType?.totalCount ?? (selectedTypeUnits.length || undefined)
  const otherTypeStatuses = selectedTypeStatusCounts.filter(([status]) => status !== 'available' && status !== 'occupied')
  const otherFacilityStatuses = statusCounts.filter(([status]) => status !== 'available' && status !== 'occupied')
  const totalCargoLimit = displayUnitTypes.reduce((sum, type) => {
    const layout = layouts[type.id]
    const value = layout?.maxCargoWeightPerWarehouseKg ?? type.maxStoredLoadKg
    return value !== null && value !== undefined && Number.isFinite(Number(value)) ? sum + Number(value) : sum
  }, 0)
  const hasCargoLimit = displayUnitTypes.some(type => {
    const layout = layouts[type.id]
    return layout?.maxCargoWeightPerWarehouseKg !== null && layout?.maxCargoWeightPerWarehouseKg !== undefined
      || type.maxStoredLoadKg !== null && type.maxStoredLoadKg !== undefined
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideHeader
      size="2xl"
      className="max-h-[92vh] overflow-hidden p-0"
      contentClassName="p-0"
    >
      <div className="flex h-[min(92vh,900px)] max-h-[92vh] flex-col">
        <header className="shrink-0 border-b border-stone-200 bg-white">
          <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <h2 id="modal-title" className="truncate text-base font-bold text-stone-900">Thông tin chi tiết cơ sở</h2>
              <p className="mt-1 truncate text-xs text-stone-500">{facility.name} · {facility.code || facility.id}</p>
            </div>
            <button type="button" aria-label="Đóng" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex gap-5 overflow-x-auto px-4 sm:px-6" aria-label="Các phần thông tin cơ sở">
            {(Object.keys(tabLabels) as DetailTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                aria-current={activeTab === tab ? 'page' : undefined}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 border-b-2 px-1 pb-3 text-sm font-semibold transition ${activeTab === tab ? 'border-amber-600 text-amber-700' : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'}`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-xl border border-stone-200">
                <div className="grid gap-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                  {facilityImage ? <img src={facilityImage} alt={facility.name} className="h-48 w-full object-cover md:h-full md:min-h-56" /> : <div className="flex min-h-48 items-center justify-center bg-stone-50 text-sm text-stone-400">Chưa có ảnh cơ sở</div>}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-stone-500">{facility.code || facility.id}</p>
                        <h3 className="mt-1 text-xl font-bold text-stone-900">{facility.name}</h3>
                      </div>
                      <Badge variant={statusVariant(facility.status)}>{facilityStatus}</Badge>
                    </div>
                    <PropertyTable rows={[
                      ['Địa chỉ', `${valueOrMissing(facility.address)}${facility.city ? ` · ${facility.city}` : ''}`],
                    ]} />
                  </div>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-stone-900">Thông tin tổng hợp</h3>
                <PropertyTable rows={[
                  ['Tổng số loại kho', numberValue(displayUnitTypes.length, 'loại')],
                  ['Tổng số gian kho', numberValue(facilityTotalCount, 'gian')],
                  ['Số gian còn trống', numberValue(facilityAvailableCount, 'gian')],
                  ['Số gian đang sử dụng', numberValue(facilityOccupiedCount, 'gian')],
                  ...otherFacilityStatuses.map(([status, count]) => [`${unitStatusLabels[status] || status}`, numberValue(count, 'gian')] as [string, ReactNode]),
                  ['Người quản lý', valueOrMissing(facility.manager)],
                  ['Số điện thoại liên hệ', valueOrMissing(facility.phone)],
                  ['Giờ mở cửa', valueOrMissing(facility.accessHours)],
                  ['Giá thuê từ', facilityPrice === MISSING ? MISSING : `${facilityPrice}/tháng`],
                  ['Tổng hạn mức khối lượng hàng', hasCargoLimit ? numberValue(totalCargoLimit, 'kg') : MISSING],
                ]} />
              </section>

            </div>
          )}

          {activeTab === 'unit-types' && (
            <div className="space-y-5">
              {displayUnitTypes.length > 0 ? <>
                <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-3" role="tablist" aria-label="Lựa chọn loại kho">
                  {displayUnitTypes.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedUnitType?.id === type.id}
                      onClick={() => setSelectedUnitTypeId(type.id)}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-left transition ${selectedUnitType?.id === type.id ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'}`}
                    >
                      <span className="block text-xs font-semibold">{type.code}</span>
                      <span className="mt-0.5 block max-w-40 truncate text-xs">{type.name}</span>
                    </button>
                  ))}
                </div>

                {selectedUnitType && <>
                  <section className="overflow-hidden rounded-xl border border-stone-200">
                    <div className="grid gap-0 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)]">
                      {selectedTypeImage ? <img src={selectedTypeImage} alt={selectedUnitType.name} className="h-48 w-full object-cover md:h-full md:min-h-56" /> : <div className="flex min-h-48 items-center justify-center bg-stone-50 text-sm text-stone-400">Chưa có ảnh loại kho</div>}
                      <div className="p-4 sm:p-5">
                        <p className="font-mono text-xs font-semibold text-stone-500">{selectedUnitType.code}</p>
                        <h3 className="mt-1 text-xl font-bold text-stone-900">{selectedUnitType.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-stone-600">{valueOrMissing(selectedUnitType.description)}</p>
                        <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                          <div><p className="text-xs text-stone-500">Diện tích mỗi gian</p><p className="mt-1 text-sm font-semibold text-stone-900">{numberValue(selectedUnitType.areaM2, 'm²')}</p></div>
                          <div><p className="text-xs text-stone-500">Giới hạn khối lượng hàng</p><p className="mt-1 text-sm font-semibold text-stone-900">{numberValue(selectedUnitType.maxLoadKg, 'kg')}</p></div>
                          <div><p className="text-xs text-stone-500">Số gian còn trống</p><p className="mt-1 text-sm font-semibold text-stone-900">{numberValue(typeAvailable, 'gian')}</p></div>
                          <div><p className="text-xs text-stone-500">Giá thuê hiện hành</p><p className="mt-1 text-sm font-semibold text-stone-900">{priceValue(selectedUnitType.monthlyPrice)}</p></div>
                          <div className="sm:col-span-2"><p className="text-xs text-stone-500">Trạng thái công bố</p><div className="mt-1">{typeStatusBadge}</div></div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {selectedTypeDetailImage && <figure className="overflow-hidden rounded-xl border border-stone-200">
                    <img src={selectedTypeDetailImage} alt={`Ảnh chi tiết ${selectedUnitType.name}`} className="max-h-72 w-full object-contain" />
                  </figure>}

                  <div className="divide-y divide-stone-200">
                    <DetailAccordion title="Kích thước và tải trọng" defaultOpen>
                      <PropertyTable rows={[
                        ['Kích thước gian kho', dimensionsValue(selectedUnitType.lengthM, selectedUnitType.widthM, selectedUnitType.heightM)],
                        ['Thể tích', numberValue(selectedUnitType.volumeM3, 'm³')],
                        ['Khối lượng hàng tối đa theo cấu hình lưu trữ', numberValue(selectedLayout?.maxCargoWeightPerWarehouseKg ?? selectedUnitType.maxStoredLoadKg, 'kg')],
                        ['Tổng khối lượng tấm kê', numberValue(selectedLayout?.totalPalletEmptyWeightKg, 'kg')],
                        ['Tổng khối lượng hàng và tấm kê khi chứa tối đa', numberValue(selectedLayout?.maxStoredLoadAtCapacityKg, 'kg')],
                      ]} />
                    </DetailAccordion>

                    <DetailAccordion title="Cấu hình khung kệ">
                      <PropertyTable rows={[
                        ['Số khung mỗi gian', numberValue(selectedUnitType.rackCount, 'khung')],
                        ['Kích thước khung', dimensionsValue(selectedUnitType.rackLengthM, selectedUnitType.rackWidthM, selectedUnitType.rackHeightM)],
                        ['Số bộ trụ đứng', numberValue(selectedRackConfiguration?.uprightFrameCount, 'bộ')],
                        ['Số tầng mỗi khung', numberValue(selectedLayout?.levelsPerRack ?? selectedRackConfiguration?.levelCount, 'tầng')],
                        ['Số tầng tối đa theo chiều cao', numberValue(selectedLayout?.maxLevelsByHeight, 'tầng')],
                        ['Số khoang mỗi tầng', numberValue(selectedLayout?.compartmentsPerLevel, 'khoang')],
                        ['Số khoang mỗi khung', numberValue(selectedRack?.compartmentCount, 'khoang')],
                        ['Tổng số khoang mỗi gian', numberValue(selectedLayout?.totalCompartments, 'khoang')],
                        ['Kích thước thông thủy khoang', dimensionsValue(selectedLayout?.compartmentClearLengthCm, selectedLayout?.compartmentClearWidthCm, selectedLayout?.compartmentClearHeightCm, 'cm')],
                        ['Giới hạn chịu tải mỗi khoang', numberValue(selectedLayout?.maxBeamPairLoadKg ?? selectedRack?.maxBeamPairLoadKg, 'kg')],
                        ['Giới hạn chịu tải mỗi khung', numberValue(selectedLayout?.maxRackLoadKg ?? selectedRackConfiguration?.maxRackLoadKg, 'kg')],
                      ]} />
                    </DetailAccordion>

                    <DetailAccordion title="Thông số tấm kê">
                      <PropertyTable rows={[
                        ['Số tấm kê mỗi khoang', numberValue(selectedRackConfiguration?.palletsPerCompartment, 'tấm')],
                        ['Kích thước tấm kê', dimensionsValue(selectedLayout?.palletLengthCm, selectedLayout?.palletWidthCm, selectedLayout?.palletHeightCm, 'cm')],
                        ['Khối lượng mỗi tấm kê', numberValue(selectedLayout?.palletEmptyWeightKg ?? selectedLayout?.palletEmptyKg, 'kg')],
                        ['Giới hạn tải hàng của mỗi tấm kê', numberValue(selectedLayout?.palletMaxPayloadKg ?? selectedLayout?.maxPalletPayloadKg, 'kg')],
                        ['Tổng số tấm kê', numberValue(selectedLayout?.totalPallets ?? selectedLayout?.palletSlotCount, 'tấm')],
                        ['Kích thước vùng chứa hàng trên mỗi tấm kê', dimensionsValue(selectedLayout?.maxCargoLengthCm, selectedLayout?.maxCargoWidthCm, selectedLayout?.maxCargoHeightCm, 'cm')],
                      ]} />
                    </DetailAccordion>

                    <DetailAccordion title="Điều kiện vận hành">
                      <PropertyTable rows={[
                        ['Chiều rộng lối đi chính', numberValue(selectedUnitType.aisleWidthM, 'm')],
                        ['Chiều rộng lối đi giữa các kệ', numberValue(selectedUnitType.storageAisleWidthM, 'm')],
                        ['Kích thước cửa kho', gateDimensionsValue(selectedUnitType.gateWidthM, selectedUnitType.gateHeightM)],
                        ['Thiết bị vận chuyển hàng', valueOrMissing(selectedUnitType.trolleyType)],
                        ['Chiều cao đến vật cản thấp nhất', numberValue(selectedUnitType.lowestObstructionHeightM, 'm')],
                        ['Khoảng hở an toàn phía trên kệ', numberValue(selectedUnitType.overheadClearanceM, 'm')],
                      ]} />
                    </DetailAccordion>

                    <DetailAccordion title="Sức chứa hàng hóa">
                      <PropertyTable rows={[
                        ['Khối lượng hàng tối đa mỗi khoang', numberValue(selectedLayout?.maxCargoWeightPerCompartmentKg, 'kg')],
                        ['Khối lượng hàng tối đa mỗi khung', numberValue(selectedLayout?.maxCargoWeightPerRackKg, 'kg')],
                        ['Sức chứa thùng nhỏ', numberValue(selectedUnitType.smallBoxCapacity ?? selectedLayout?.smallBoxesPerUnit, 'thùng')],
                        ['Sức chứa thùng lớn', numberValue(selectedUnitType.largeBoxCapacity ?? selectedLayout?.largeBoxesPerUnit, 'thùng')],
                        ['Thông số thùng nhỏ', sampleValue(selectedLayout?.smallBox)],
                        ['Thông số thùng lớn', sampleValue(selectedLayout?.largeBox)],
                      ]} />
                    </DetailAccordion>

                    <DetailAccordion title="Loại hàng được nhận">
                      <PropertyTable rows={[
                        ['Loại hàng hóa', selectedUnitType.acceptedGoodsCategoryIds?.length ? `Đã cấu hình ${selectedUnitType.acceptedGoodsCategoryIds.length} loại` : MISSING],
                        ['Vật liệu', selectedUnitType.acceptedGoodsMaterialIds?.length ? `Đã cấu hình ${selectedUnitType.acceptedGoodsMaterialIds.length} loại` : MISSING],
                      ]} />
                    </DetailAccordion>

                    <DetailAccordion title="Tình trạng cho thuê">
                      <PropertyTable rows={[
                        ['Tổng số gian', numberValue(typeTotal, 'gian')],
                        ['Số gian đang sử dụng', numberValue(typeOccupied, 'gian')],
                        ...otherTypeStatuses.map(([status, count]) => [`${unitStatusLabels[status] || status}`, numberValue(count, 'gian')] as [string, ReactNode]),
                        ['Tiền đặt cọc hiện hành', priceValue(selectedUnitType.securityDepositAmount)],
                      ]} />
                    </DetailAccordion>
                  </div>
                </>}
              </> : <div className="py-12 text-center text-sm text-stone-500">Chưa có dữ liệu loại kho.</div>}
            </div>
          )}

          {activeTab === 'policies' && (
            <div>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-stone-900">Các gói thuê đang áp dụng</h3>
                {activePackages.length > 0 ? <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Gói thuê</th>
                        <th className="px-4 py-3 font-semibold">Kỳ hạn</th>
                        <th className="px-4 py-3 font-semibold">Mức giảm giá</th>
                        <th className="px-4 py-3 font-semibold">Thời gian áp dụng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {activePackages.map(item => <tr key={item.id}>
                        <td className="px-4 py-3"><p className="font-semibold text-stone-900">{valueOrMissing(item.label || item.title)}</p><p className="mt-1 text-xs text-stone-500">{valueOrMissing(item.title)}</p></td>
                        <td className="px-4 py-3 text-stone-700">{item.months === 'other' ? 'Theo thỏa thuận' : `${item.months} tháng`}</td>
                        <td className="px-4 py-3 text-stone-700">{numberValue(item.discountPercent, '%')}</td>
                        <td className="px-4 py-3 text-stone-700">{effectivePeriodValue(item.effectiveFrom, item.effectiveTo)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div> : <p className="text-sm text-stone-500">Chưa có dữ liệu.</p>}
              </section>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </footer>
      </div>
    </Modal>
  )
}
