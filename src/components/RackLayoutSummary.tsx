import { defaultRackPallet, type RackResult } from '../services/rackLayoutApi'

const n = (value: number | undefined, digits = 2) => value !== undefined && Number.isFinite(value)
  ? value.toLocaleString('vi-VN', { maximumFractionDigits: digits })
  : '-'

const dimensions = (...values: (number | undefined)[]) => `${values.map(value => n(value)).join(' × ')} cm`

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-stone-100 py-2 last:border-0">
    <dt className="text-stone-500">{label}</dt>
    <dd className="mt-0.5 font-medium text-stone-900">{value}</dd>
  </div>
}

function geometryStatus(status?: string) {
  if (status === 'CONFIG_GEOMETRY_VALID' || status === 'CONFIGURATION_VALID') return 'Hợp lệ theo hình học'
  if (status === 'LEGACY_CONFIGURATION') return 'Cấu hình cũ - cần rà soát'
  return status || 'Chưa có kết quả'
}

function operationStatus(status?: string) {
  if (status === 'CONFIGURED_NOT_VERIFIED') return 'Đã có cấu hình, chưa xác minh vận hành'
  if (status === 'NOT_EVALUATED') return 'Chưa xác minh vận hành'
  if (status === 'LEGACY') return 'Cấu hình cũ - cần rà soát'
  return status || 'Chưa có kết quả'
}

export default function RackLayoutSummary({ result }: { result: RackResult }) {
  const firstRack = result.racks[0]
  const firstLevel = firstRack?.levels[0]
  const pallet = result.configuration.pallet ?? defaultRackPallet
  const palletLength = result.palletLengthCm ?? pallet.lengthCm
  const palletWidth = result.palletWidthCm ?? pallet.widthCm
  const palletHeight = result.palletHeightCm ?? pallet.heightCm
  const palletEmpty = result.palletEmptyWeightKg ?? result.palletEmptyKg ?? pallet.emptyKg
  const palletPayload = result.palletMaxPayloadKg ?? pallet.maxPayloadKg
  const rackCount = result.rackCount ?? result.racks.length
  const levels = result.levelsPerRack ?? firstRack?.levels.length
  const compartments = result.totalCompartments ?? result.racks.reduce((sum, rack) => sum + rack.compartmentCount, 0)
  const totalPallets = result.totalPallets ?? result.palletSlotCount
  const area = result.warehouseAreaM2
  const maxCargoWarehouse = result.maxCargoWeightPerWarehouseKg ?? result.unitCargoLimitKg
  const totalTare = result.totalPalletEmptyWeightKg ?? totalPallets * palletEmpty
  const grossAtCapacity = result.maxStoredLoadAtCapacityKg
  const maxCargoHeight = result.maxCargoHeightCm ?? firstRack?.maxCargoHeightCm
  const maxPalletByLoad = result.maxPalletCountByLoad
  const maxPalletByGeometry = result.maxPalletCountByGeometry
  const maxPalletUsable = result.maxFeasiblePalletCount ?? (maxPalletByLoad !== undefined && maxPalletByGeometry !== undefined
    ? Math.min(maxPalletByLoad, maxPalletByGeometry) : undefined)
  const warnings = result.warnings ?? []

  return <div className="space-y-5 text-sm text-stone-800">
    <section>
      <h3 className="text-base font-semibold text-stone-900">Tổng quan cấu hình</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Số khung trong gian" value={n(rackCount, 0)} />
        <Detail label="Số tầng mỗi khung" value={n(levels, 0)} />
        <Detail label="Số khoang mỗi tầng" value={n(result.compartmentsPerLevel ?? firstRack?.bayCount, 0)} />
        <Detail label="Tổng số khoang" value={n(compartments, 0)} />
        <Detail label="Tổng số tấm kê" value={n(totalPallets, 0)} />
        <Detail label="Diện tích gian kho" value={area === undefined ? '-' : `${n(area)} m²`} />
        <Detail label="Hàng tối đa mỗi gian" value={`${n(maxCargoWarehouse)} kg`} />
      </dl>
    </section>

    <section className="rounded-lg border border-stone-200 p-4">
      <h3 className="text-base font-semibold text-stone-900">Thông số lưu trữ</h3>
      <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
        <Detail label="Kích thước thông thủy khoang (D × R × C)" value={dimensions(firstRack?.bayLengthCm, firstRack?.bayWidthCm, firstLevel?.clearHeightCm)} />
        <Detail label="Kích thước tấm kê (D × R × C)" value={dimensions(palletLength, palletWidth, palletHeight)} />
        <Detail label="Kích thước hàng tối đa trên tấm kê" value={dimensions(result.maxCargoLengthCm ?? palletLength, result.maxCargoWidthCm ?? palletWidth, maxCargoHeight)} />
        <Detail label="Khối lượng tấm kê rỗng" value={`${n(palletEmpty)} kg/tấm · ${n(totalTare)} kg/toàn gian`} />
        <Detail label="Tải hàng tối đa mỗi khoang" value={`${n(result.maxCargoWeightPerCompartmentKg)} kg`} />
        <Detail label="Tải hàng tối đa mỗi khung" value={`${n(result.maxCargoWeightPerRackKg)} kg`} />
        <Detail label="Tải hàng tối đa mỗi gian" value={`${n(maxCargoWarehouse)} kg`} />
        <Detail label="Tổng tấm kê và hàng ở mức tính toán" value={grossAtCapacity === undefined ? '-' : `${n(grossAtCapacity)} kg`} />
        <Detail label="Tấm kê tối đa theo hình học" value={`${n(maxPalletByGeometry, 0)} tấm/khoang`} />
        <Detail label="Tấm kê tối đa theo tải trọng" value={`${n(maxPalletByLoad, 0)} tấm/khoang`} />
        <Detail label="Tấm kê có thể dùng" value={`${n(maxPalletUsable, 0)} tấm/khoang`} />
        <Detail label="Tải hàng tối đa mỗi tấm kê" value={`${n(palletPayload)} kg`} />
      </dl>
    </section>

    <section>
      <h3 className="text-base font-semibold text-stone-900">Sức chứa thùng mẫu</h3>
      <p className="mt-1 text-stone-500">Mỗi ví dụ được tính riêng cho một loại thùng, dùng để tham khảo khả năng chứa theo cấu hình.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 p-4">
          <p className="text-lg font-semibold text-stone-900">{n(result.smallBoxesPerUnit, 0)} {result.smallBox.name.toLowerCase()}</p>
          <p className="mt-1 text-stone-600">{dimensions(result.smallBox.lengthCm, result.smallBox.widthCm, result.smallBox.heightCm)}</p>
          <p className="mt-1 text-stone-600">{n(result.smallBox.weightKg)} kg/thùng · tối đa {n(result.smallBox.maxLayers, 0)} lớp</p>
        </div>
        <div className="rounded-lg border border-stone-200 p-4">
          <p className="text-lg font-semibold text-stone-900">{n(result.largeBoxesPerUnit, 0)} {result.largeBox.name.toLowerCase()}</p>
          <p className="mt-1 text-stone-600">{dimensions(result.largeBox.lengthCm, result.largeBox.widthCm, result.largeBox.heightCm)}</p>
          <p className="mt-1 text-stone-600">{n(result.largeBox.weightKg)} kg/thùng · tối đa {n(result.largeBox.maxLayers, 0)} lớp</p>
        </div>
      </div>
    </section>

    <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <p><span className="font-semibold">Kiểm tra hình học:</span> {geometryStatus(result.geometryStatus)}.</p>
      {result.operationStatus && <p className="mt-1"><span className="font-semibold">Trạng thái vận hành:</span> {operationStatus(result.operationStatus)}.</p>}
      {warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">{warnings.slice(0, 4).map(warning => <li key={warning}>{warning}</li>)}</ul>}
      <p className="mt-2 text-xs text-stone-600">Các số liệu tải trọng và sức chứa là kết quả tính theo thông số đã nhập; cần xác minh thực tế trước khi đưa kệ vào vận hành.</p>
    </section>
  </div>
}
