import type { CompatibilityCheckResult, GoodsItemInput, PalletPlan } from '../../services/customerReservationApi'
import { userFacingError } from '../../presentation/userFacingError'

const n = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export function customerRackIssue(error: unknown, fallback: string) {
  return userFacingError(error, fallback)
    .replace(/\bpallet\b/gi, word => word.startsWith('P') ? 'Tấm kê' : 'tấm kê')
}

type PalletAllocation = NonNullable<PalletPlan['items'][number]['allocations']>[number]

type CompartmentDistributionRow = {
  key: string
  label: string
  itemNumbers: number[]
  palletCount: number
  layerPieces: Array<number | null>
  cargoWeight: number
  cargoLimit: number
}

function progressPercent(value: number, maximum: number) {
  if (maximum <= 0) return 0
  return Math.min(100, Math.max(0, value / maximum * 100))
}

function ProgressBar({ value, maximum }: { value: number; maximum: number }) {
  return <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
    <div className="h-full rounded-full bg-blue-500" style={{ width: `${progressPercent(value, maximum)}%` }} />
  </div>
}

function distributionRows(plan: PalletPlan, goodsItems: GoodsItemInput[]): CompartmentDistributionRow[] {
  const rows = new Map<string, CompartmentDistributionRow>()

  // v8 returns one record per physical pallet.  Several goods lines can now
  // share that pallet, so build the short customer view from the unique
  // pallet records instead of counting each line allocation as another
  // pallet.
  if (plan.pallets?.length) {
    for (const pallet of plan.pallets) {
      const rackNumber = plan.racks.findIndex(value => value.code === pallet.rackCode) + 1
      const key = `${pallet.rackCode}-${pallet.compartmentNumber}`
      let row = rows.get(key)
      if (!row) {
        row = {
          key,
          label: `Khung ${rackNumber > 0 ? rackNumber : ''} · Khoang ${pallet.compartmentNumber}`,
          itemNumbers: [],
          palletCount: 0,
          layerPieces: [],
          cargoWeight: 0,
          cargoLimit: pallet.compartmentCargoLimitKg,
        }
        rows.set(key, row)
      }
      row.palletCount += 1
      row.cargoWeight += pallet.cargoWeightKg
      row.cargoLimit = Math.max(row.cargoLimit, pallet.compartmentCargoLimitKg)
      for (const item of pallet.items ?? []) {
        if (!row.itemNumbers.includes(item.itemNumber)) row.itemNumbers.push(item.itemNumber)
      }
      if (pallet.placements?.length) {
        const layerCounts = new Map<number, number>()
        for (const placement of pallet.placements) {
          layerCounts.set(placement.layer, (layerCounts.get(placement.layer) ?? 0) + 1)
        }
        for (const [layer, pieces] of layerCounts) {
          const index = Math.max(0, layer - 1)
          row.layerPieces[index] = (row.layerPieces[index] ?? 0) + pieces
        }
      } else {
        for (const item of pallet.items ?? []) {
          const pieces = item.quantity
          const layerCount = Math.max(1, item.layers)
          let remaining = pieces
          for (let layer = 0; layer < layerCount; layer++) {
            const layerPieces = Math.ceil(remaining / (layerCount - layer))
            row.layerPieces[layer] = (row.layerPieces[layer] ?? 0) + layerPieces
            remaining -= layerPieces
          }
        }
      }
    }
    return Array.from(rows.values())
  }

  const fallbackSlotByRack = new Map<string, number>()
  for (const item of plan.items) {
    const goods = goodsItems[item.itemNumber - 1]
    const weightPerItem = goods?.weightPerItemKg ?? item.weightPerItemKg ?? 0
    for (const allocation of item.allocations ?? []) {
      const rack = plan.racks.find(value => value.code === allocation.rackCode)
      const rackNumber = plan.racks.findIndex(value => value.code === allocation.rackCode) + 1
      const palletsPerCompartment = rack && rack.compartments > 0
        ? Math.max(1, Math.round(rack.totalSlots / rack.compartments))
        : 1
      for (let palletIndex = 0; palletIndex < allocation.palletCount; palletIndex++) {
        const slotIndex = fallbackSlotByRack.get(allocation.rackCode) ?? 0
        fallbackSlotByRack.set(allocation.rackCode, slotIndex + 1)
        const compartmentNumber = allocation.compartmentNumber ?? Math.floor(slotIndex / palletsPerCompartment) + 1
        const key = `${allocation.rackCode}-${compartmentNumber}`
        let row = rows.get(key)
        if (!row) {
          row = {
            key,
            label: `Khung ${rackNumber > 0 ? rackNumber : ''} · Khoang ${compartmentNumber}`,
            itemNumbers: [],
            palletCount: 0,
            layerPieces: [],
            cargoWeight: 0,
            cargoLimit: allocation.compartmentCargoLimitKg ?? allocation.capacity.cargoWeightLimitKg,
          }
          rows.set(key, row)
        }
        if (!row.itemNumbers.includes(item.itemNumber)) row.itemNumbers.push(item.itemNumber)
        row.palletCount += 1
        const pieces = allocation.piecesPerPallet
        const layers = Math.min(
          allocation.capacity.usableLayers,
          Math.max(1, Math.ceil(pieces / Math.max(1, allocation.capacity.piecesPerLayer))),
        )
        let remainingPieces = pieces
        for (let layer = 0; layer < layers; layer++) {
          const layerPieces = Math.min(remainingPieces, allocation.capacity.piecesPerLayer)
          remainingPieces -= layerPieces
          row.layerPieces[layer] = (row.layerPieces[layer] ?? 0) + layerPieces
        }
        row.cargoWeight += pieces * weightPerItem
        row.cargoLimit = Math.max(row.cargoLimit, allocation.compartmentCargoLimitKg ?? allocation.capacity.cargoWeightLimitKg)
      }
    }
  }
  return Array.from(rows.values())
}

function StorageConditions({ plan, goodsItems, compartmentCount }: { plan: PalletPlan; goodsItems: GoodsItemInput[]; compartmentCount: number }) {
  return <section className="space-y-2">
    <h5 className="font-semibold">Tại sao cần {n(compartmentCount)} khoang?</h5>
    <p className="font-semibold">Điều kiện lưu trữ</p>
    {plan.items.map(item => {
      const limits = new Map<string, { capacity: PalletAllocation['capacity']; cargoHeightCm?: number; pieces: number }>()
      for (const allocation of item.allocations ?? []) {
        const rack = plan.racks.find(value => value.code === allocation.rackCode)
        const key = JSON.stringify(allocation.capacity)
        const previous = limits.get(key)
        limits.set(key, {
          capacity: allocation.capacity,
          cargoHeightCm: rack?.maxCargoHeightCm,
          pieces: (previous?.pieces ?? 0) + allocation.piecesPerPallet,
        })
      }
      return Array.from(limits, ([key, { capacity, cargoHeightCm, pieces }]) => {
        const actualLayers = Math.min(
          capacity.usableLayers,
          Math.max(1, Math.ceil(pieces / Math.max(1, capacity.piecesPerLayer))),
        )
        const goods = goodsItems[item.itemNumber - 1]
        const stackRule = goods?.fragile || goods?.stackable === false
          ? '1 lớp'
          : goods?.stackable === true
            ? 'Tự tính theo chiều cao khoang'
            : `${item.allowedStackLayers} lớp`
        const placementLengthCm = goods ? capacity.placementLengthCm ?? goods.lengthCm : null
        const placementWidthCm = goods ? capacity.placementWidthCm ?? goods.widthCm : null
        const placementHeightCm = goods ? capacity.placementHeightCm ?? goods.heightCm : null
        const placementChanged = Boolean(goods && placementLengthCm != null && placementWidthCm != null
          && placementHeightCm != null
          && (placementLengthCm !== goods.lengthCm || placementWidthCm !== goods.widthCm
            || placementHeightCm !== goods.heightCm))
        const laidFlat = Boolean(goods && placementHeightCm != null && placementHeightCm < goods.heightCm)
        const actualStackHeight = placementHeightCm == null ? null : actualLayers * placementHeightCm
        const limiting = capacity.maxPiecesByDimensions <= capacity.maxPiecesByWeight ? 'kích thước hàng hóa' : 'khối lượng hàng hóa'
        return <div key={`${item.itemNumber}-${key}`} className="space-y-2">
          {plan.items.length > 1 && <p className="text-xs font-semibold">Hàng {item.itemNumber}</p>}
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="bg-stone-50"><tr><th className="px-3 py-2 font-semibold">Điều kiện lưu trữ</th><th className="px-3 py-2 text-right font-semibold">Kết quả</th></tr></thead>
              <tbody>
                {goods && placementChanged && <tr className="border-t border-stone-200"><td className="px-3 py-2">Kích thước sau khi đặt</td><td className="px-3 py-2 text-right">{n(placementLengthCm!)} × {n(placementWidthCm!)} × {n(placementHeightCm!)} cm</td></tr>}
                <tr className="border-t border-stone-200"><td className="px-3 py-2">Số kiện xếp vừa mỗi lớp</td><td className="px-3 py-2 text-right">{n(capacity.piecesPerLayer)} kiện</td></tr>
                <tr className="border-t border-stone-200"><td className="px-3 py-2">Quy tắc xếp chồng</td><td className="px-3 py-2 text-right">{stackRule}</td></tr>
                <tr className="border-t border-stone-200"><td className="px-3 py-2">Số lớp thực tế xếp vừa</td><td className="px-3 py-2 text-right">{n(actualLayers)} lớp</td></tr>
                <tr className="border-t border-stone-200"><td className="px-3 py-2">Số kiện tối đa theo kích thước</td><td className="px-3 py-2 text-right">{n(capacity.maxPiecesByDimensions)} kiện</td></tr>
                <tr className="border-t border-stone-200"><td className="px-3 py-2">Số kiện tối đa theo khối lượng</td><td className="px-3 py-2 text-right">{n(capacity.maxPiecesByWeight)} kiện</td></tr>
                <tr className="border-t border-stone-200 font-semibold"><td className="px-3 py-2">Số kiện tối đa mỗi tấm kê</td><td className="px-3 py-2 text-right">{n(capacity.maxPieces)} kiện</td></tr>
              </tbody>
            </table>
          </div>
          {goods && placementChanged && <p className="text-xs leading-5">Phương án lưu trữ: {laidFlat ? 'xoay kiện hàng và đặt nằm ngang' : 'xoay kiện hàng trên mặt tấm kê'} ({n(placementLengthCm!)} × {n(placementWidthCm!)} × {n(placementHeightCm!)} cm).</p>}
          {goods && cargoHeightCm != null && goods.stackable === true && actualLayers < capacity.usableLayers
            ? <p className="text-xs leading-5">Hệ thống tự tính theo chiều cao dành cho hàng {n(cargoHeightCm)} cm. Với {n(pieces)} kiện ở phương án này, chỉ cần {n(actualLayers)} lớp ({n(actualStackHeight ?? 0)} cm).</p>
            : goods && cargoHeightCm != null && <p className="text-xs leading-5">Chiều cao dành cho hàng là {n(cargoHeightCm)} cm, kiện cao {n(placementHeightCm ?? goods.heightCm)} cm nên xếp vừa {n(actualLayers)} lớp.</p>}
          <p className="text-xs leading-5">Giới hạn quyết định trong trường hợp này là <strong>{limiting}</strong>.</p>
        </div>
      })
    })}
  </section>
}

function DistributionTable({ plan, goodsItems }: { plan: PalletPlan; goodsItems: GoodsItemInput[] }) {
  const rows = distributionRows(plan, goodsItems)
  const layerColumns = Array.from({ length: Math.max(1, ...rows.map(row => row.layerPieces.length)) }, (_, index) => index)
  return <section className="space-y-2">
    <h5 className="font-semibold">Phương án sắp xếp theo khoang</h5>
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-[38rem] text-left text-xs">
        <thead className="bg-stone-50"><tr>
          <th className="px-3 py-2 font-semibold">Khoang</th>
          {layerColumns.map(index => <th key={index} className="px-3 py-2 text-center font-semibold">Lớp {index + 1}</th>)}
          <th className="px-3 py-2 font-semibold">Tải hàng</th>
        </tr></thead>
        <tbody>
          {rows.map(row => <tr key={row.key} className="border-t border-stone-200">
            <td className="px-3 py-2">{row.label}<span className="block text-[11px] text-stone-500">{row.palletCount} tấm kê</span>{plan.items.length > 1 && <span className="block text-[11px] text-stone-500">Hàng {row.itemNumbers.join(', ')}</span>}</td>
            {layerColumns.map(index => <td key={index} className="px-3 py-2 text-center">{row.layerPieces[index] == null ? '—' : `${n(row.layerPieces[index]!)} kiện`}</td>)}
            <td className="px-3 py-2"><div className="flex items-center justify-between gap-3"><span>{n(row.cargoWeight)}/{n(row.cargoLimit)} kg</span><span className="min-w-24 flex-1"><ProgressBar value={row.cargoWeight} maximum={row.cargoLimit} /></span></div></td>
          </tr>)}
          <tr className="border-t border-stone-200 font-semibold">
            <td className="px-3 py-2">Tổng cộng</td>
            {layerColumns.map(index => <td key={index} className="px-3 py-2 text-center">{n(rows.reduce((sum, row) => sum + (row.layerPieces[index] ?? 0), 0))}</td>)}
            <td className="px-3 py-2">{n(rows.reduce((sum, row) => sum + row.cargoWeight, 0))} kg</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
}

function CompatiblePalletResult({ check, plan, goodsItems, unitTypeName }: {
  check: CompatibilityCheckResult
  plan: PalletPlan
  goodsItems: GoodsItemInput[]
  unitTypeName?: string
}) {
  const totalQuantity = goodsItems.length > 0
    ? goodsItems.reduce((sum, item) => sum + item.quantity, 0)
    : plan.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalWeight = check.totalGoodsWeightKg
  const unitLimit = check.unitMaxLoadKg
  const freeWeight = Math.max(0, unitLimit - totalWeight)
  const rows = distributionRows(plan, goodsItems)
  const occupiedCompartments = rows.length || plan.requiredPallets
  const rackReference = plan.racks[0]
  const palletsPerCompartment = rackReference && rackReference.compartments > 0
    ? Math.max(1, Math.round(rackReference.totalSlots / rackReference.compartments))
    : 1
  const totalCompartments = Math.max(occupiedCompartments, Math.round(plan.availableSlots / palletsPerCompartment))
  const freeCompartments = Math.max(0, totalCompartments - occupiedCompartments)
  return <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
    <div className="border-b border-stone-200 pb-4">
      <h4 className="flex items-center gap-2 text-base font-semibold text-stone-900"><span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold leading-none text-white">✓</span>Hàng của bạn vừa kho!</h4>
      <p className="mt-1 text-xs text-stone-500">{unitTypeName || 'Loại kho đã chọn'} · {n(totalQuantity)} kiện hàng</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div><p className="text-xs text-stone-500">Khối lượng hàng</p><p className="mt-1 text-lg font-semibold text-stone-900">{n(totalWeight)} / {n(unitLimit)} kg</p><ProgressBar value={totalWeight} maximum={unitLimit} /><p className="mt-1 text-[11px] text-stone-500">Còn {n(freeWeight)} kg hạn mức</p></div>
        <div><p className="text-xs text-stone-500">Khoang lưu trữ</p><p className="mt-1 text-lg font-semibold text-stone-900">{n(occupiedCompartments)} / {n(totalCompartments)}</p><ProgressBar value={occupiedCompartments} maximum={totalCompartments} /><p className="mt-1 text-[11px] text-stone-500">Còn {n(freeCompartments)} khoang</p></div>
      </div>
    </div>
    <StorageConditions plan={plan} goodsItems={goodsItems} compartmentCount={occupiedCompartments} />
    <DistributionTable plan={plan} goodsItems={goodsItems} />
    <p className="flex items-center gap-2 text-xs text-emerald-800"><span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-700 text-[10px] font-bold leading-none text-emerald-700">✓</span>Đáp ứng giới hạn kích thước và tải trọng.</p>
    {check.staffReviewRequired && <p className="text-xs text-amber-800">Hàng cần nhân viên cơ sở xét duyệt trước khi nhận.</p>}
    <p className="text-[11px] text-stone-500">Phương án lưu trữ dự kiến. Nhân viên sẽ đối chiếu khi tiếp nhận hàng.</p>
  </div>
}

export default function CustomerPalletCheck({ check, loading = false, goodsItems = [], unitTypeName, noAlternativeReason }: {
  check?: CompatibilityCheckResult | null
  loading?: boolean
  goodsItems?: GoodsItemInput[]
  unitTypeName?: string
  noAlternativeReason?: string
}) {
  const plan = check?.palletPlan
  const compatible = Boolean(check && check.result !== 'INCOMPATIBLE' && plan)
  const reviewRequired = Boolean(check && (check.result === 'REVIEW_REQUIRED' || check.physicalFitStatus === 'REVIEW_REQUIRED'))
  return <section className={compatible ? 'space-y-3 text-sm text-stone-800' : 'space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800'}>
    {!compatible && <h4 className="font-semibold">{reviewRequired ? 'Cần xác minh cấu hình kho' : 'Hàng của bạn có vừa kho không?'}</h4>}
    {!compatible && unitTypeName && <p>Loại kho đang kiểm tra <strong>{unitTypeName}</strong></p>}
    {loading ? <p role="status">Đang tính theo cấu hình kệ và kiểm tra số gian còn trống…</p>
      : !check ? <p>Nhập đủ thông tin hàng và gói thuê để kiểm tra.</p>
      : check.result === 'INCOMPATIBLE' || !plan ? <p role="status" className="rounded-lg bg-red-50 p-3 text-red-900">
        {customerRackIssue(check.issues[0], check.palletLayoutMissing
          ? 'Loại kho chưa có thông tin kệ để tính sức chứa.'
          : reviewRequired
            ? 'Cấu hình kệ đã có phần hình học nhưng chưa xác nhận tải trọng tấm kê, nên chưa thể kết luận hàng có vừa kho.'
          : 'Chưa tìm được cách xếp hàng trong gian này.')}
        {noAlternativeReason && ` ${customerRackIssue(noAlternativeReason, 'Chưa tìm được kho thay thế phù hợp.')}`}
      </p> : <CompatiblePalletResult check={check} plan={plan} goodsItems={goodsItems} unitTypeName={unitTypeName} />}
  </section>
}
