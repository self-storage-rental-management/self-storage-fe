import { Button } from '../../components/ui'
import type {
  CompatibilityCheckResult,
  CustomerUnitType,
  GoodsItemInput,
  ReservationStorageLimits,
} from '../../services/customerReservationApi'

const n = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

type CargoDimensions = [number, number, number]
type DimensionLimits = {
  maxCargoLengthCm: number | null
  maxCargoWidthCm: number | null
  maxCargoHeightCm: number | null
  maxCargoWeightKg?: number | null
}

function fittingPlacement(item: GoodsItemInput, limits: DimensionLimits): CargoDimensions | null {
  const maxLength = limits.maxCargoLengthCm
  const maxWidth = limits.maxCargoWidthCm
  const maxHeight = limits.maxCargoHeightCm
  if (maxLength == null || maxWidth == null || maxHeight == null) return null

  const { lengthCm: length, widthCm: width, heightCm: height } = item
  const candidates: CargoDimensions[] = [
    [length, width, height],
    [width, length, height],
  ]
  if (item.allowHorizontalPlacement) {
    candidates.push(
      [length, height, width],
      [height, length, width],
      [width, height, length],
      [height, width, length],
    )
  }
  return candidates.find(([candidateLength, candidateWidth, candidateHeight]) =>
    candidateLength <= maxLength && candidateWidth <= maxWidth && candidateHeight <= maxHeight,
  ) ?? null
}

function storageIssue(item: GoodsItemInput | undefined, limits: DimensionLimits, check: CompatibilityCheckResult) {
  if (item && limits.maxCargoLengthCm != null && limits.maxCargoWidthCm != null && limits.maxCargoHeightCm != null) {
    const placement = fittingPlacement(item, limits)
    if (!placement) {
      const dimensions = [
        { label: 'Chiều dài', value: item.lengthCm, limit: limits.maxCargoLengthCm },
        { label: 'Chiều rộng', value: item.widthCm, limit: limits.maxCargoWidthCm },
        { label: 'Chiều cao', value: item.heightCm, limit: limits.maxCargoHeightCm },
      ]
      const violation = dimensions
        .filter(row => row.value > row.limit)
        .sort((left, right) => (right.value - right.limit) - (left.value - left.limit))[0]
      if (violation) {
        const excess = violation.value - violation.limit
        return `${violation.label} kiện hàng vượt quá giới hạn lưu trữ lớn nhất ${n(excess)} cm. Hiện không có loại kho nào hỗ trợ kiện hàng này.`
      }
    }
    if (limits.maxCargoWeightKg != null && check.totalGoodsWeightKg > limits.maxCargoWeightKg) {
      return `Khối lượng hàng vượt quá giới hạn lưu trữ lớn nhất ${n(limits.maxCargoWeightKg)} kg. Hiện không có loại kho nào đủ tải trọng cho đơn hàng này.`
    }
  }
  return check.issues?.[0] || 'Hàng hóa vượt quá giới hạn lưu trữ của các loại kho hiện có.'
}

export function CustomerNoCompatibleWarehouse({ check, goodsItems = [], maxSupportedStorageLimits, onEditGoods, onSupport }: {
  check: CompatibilityCheckResult
  goodsItems?: GoodsItemInput[]
  maxSupportedStorageLimits?: ReservationStorageLimits | null
  onEditGoods: () => void
  onSupport: () => void
}) {
  const item = goodsItems[0]
  const storageLimits: DimensionLimits = maxSupportedStorageLimits ?? {
    maxCargoLengthCm: check.maxCargoLengthCm ?? null,
    maxCargoWidthCm: check.maxCargoWidthCm ?? null,
    maxCargoHeightCm: check.maxCargoHeightCm ?? null,
    maxCargoWeightKg: check.maxCargoWeightKg,
  }
  const placement = item ? fittingPlacement(item, storageLimits) : null
  const displayedDimensions: CargoDimensions | null = item
    ? placement ?? [item.lengthCm, item.widthCm, item.heightCm]
    : null
  const placementChanged = Boolean(item && placement
    && (placement[0] !== item.lengthCm || placement[1] !== item.widthCm || placement[2] !== item.heightCm))
  const dimensionRows = item ? [
    { label: 'Chiều dài', value: displayedDimensions![0], limit: storageLimits.maxCargoLengthCm },
    { label: 'Chiều rộng', value: displayedDimensions![1], limit: storageLimits.maxCargoWidthCm },
    { label: 'Chiều cao', value: displayedDimensions![2], limit: storageLimits.maxCargoHeightCm },
  ] : []
  const issue = storageIssue(item, storageLimits, check)
  const weightIssue = check.issues.some(value => /đơn nặng|khối lượng|tải trọng|vượt .*kg/i.test(value))
    || (storageLimits.maxCargoWeightKg != null && check.totalGoodsWeightKg > storageLimits.maxCargoWeightKg)
  const title = weightIssue ? 'Chưa có loại kho đủ tải trọng' : 'Chưa có loại kho phù hợp'
  const subtitle = weightIssue
    ? 'Kích thước hàng hóa phù hợp sau khi xét hướng đặt, nhưng tổng khối lượng vượt giới hạn các loại kho hiện có.'
    : 'Hàng hóa của bạn vượt quá kích thước lưu trữ được hỗ trợ.'

  return <section className="space-y-3 rounded-xl border border-red-200 bg-white p-4 text-sm text-stone-800">
    <h4 className="flex items-center gap-2 text-base font-semibold"><span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white">×</span>{title}</h4>
    <p>{subtitle}</p>
    <div className="border-t border-stone-200 pt-3">
      <h5 className="font-semibold">Kiểm tra kích thước hàng hóa</h5>
      {dimensionRows.length > 0 ? <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-xs">
            <thead className="border-b border-stone-200"><tr><th className="py-2 font-semibold">Thông số</th><th className="px-2 py-2 text-right font-semibold">Hàng của bạn</th><th className="py-2 pl-2 text-right font-semibold">{maxSupportedStorageLimits ? 'Giới hạn lớn nhất' : 'Giới hạn'}</th></tr></thead>
            <tbody>{dimensionRows.map(row => {
              const fits = row.limit != null && row.value <= row.limit
              return <tr key={row.label} className="border-b border-stone-100">
                <th className="py-2 font-medium">{row.label}</th>
                <td className={`px-2 py-2 text-right ${fits ? 'text-stone-700' : 'font-semibold text-red-600'}`}>{n(row.value)} cm</td>
                <td className="py-2 pl-2 text-right">{row.limit == null ? '—' : `${n(row.limit)} cm`} <span className={fits ? 'text-emerald-600' : 'text-red-600'}>{fits ? '✓' : '×'}</span></td>
              </tr>
            })}</tbody>
          </table>
          {placementChanged && <p className="mt-3 text-xs leading-5 text-emerald-800">Kiện hàng có thể xoay theo hướng {n(placement![0])} × {n(placement![1])} × {n(placement![2])} cm để kiểm tra trên tấm kê.</p>}
        </div> : <p className="mt-3 text-xs text-stone-500">Chưa nhận được đủ thông số lưu trữ để so sánh chi tiết.</p>}
    </div>
    <div className="border-t border-stone-200 pt-3">
      <h5 className="font-semibold">Lý do không thể lưu trữ</h5>
      <p className="mt-2 leading-5">{issue}</p>
    </div>
    <div>
      <Button type="button" onClick={onEditGoods} className="w-full sm:w-auto">Chỉnh sửa thông tin hàng hóa</Button>
    </div>
  </section>
}

type WarehouseCheckMap = Record<string, CompatibilityCheckResult>

export function CustomerNoVacantWarehouse({ currentName, currentUnitTypeId, facilityId, unitTypes, checksByUnitType, onChangeRental, onSupport, labelForType }: {
  currentName: string
  currentUnitTypeId: string
  facilityId: string
  unitTypes: CustomerUnitType[]
  checksByUnitType: WarehouseCheckMap
  onChangeRental: () => void
  onSupport: () => void
  labelForType: (name: string) => string
}) {
  const currentCheck = checksByUnitType[currentUnitTypeId]
  const currentFits = Boolean(currentCheck?.palletPlan
    && (currentCheck.physicalFitStatus === 'FIT' || !currentCheck.physicalFitStatus))
  const candidates = unitTypes
    .filter(type => type.facilityId === facilityId && type.id !== currentUnitTypeId)
    .map(type => ({ type, check: checksByUnitType[type.id] }))
    .filter(({ check }) => Boolean(check?.palletPlan
      && (check.physicalFitStatus === 'FIT' || !check.physicalFitStatus)
      && check.availableUnitCount <= 0))
    .sort((left, right) => left.type.volumeM3 - right.type.volumeM3)

  return <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-800">
    <h4 className="flex items-center gap-2 text-base font-semibold"><span className="grid h-4 w-4 place-items-center rounded-full border border-amber-700 text-[10px] text-amber-800">i</span>Chưa có gian kho trống phù hợp</h4>
    <p>{currentFits
      ? `Hàng hóa phù hợp với ${currentName}, nhưng hiện không còn gian trống trong thời gian bạn đã chọn.`
      : `Hàng hóa không vừa ${currentName}. Tuy nhiên, hàng hóa phù hợp với các loại kho dưới đây nhưng hiện không còn gian trống trong thời gian bạn đã chọn.`}</p>
    <div className="divide-y divide-stone-200 border-y border-stone-200">
      {candidates.length > 0 ? candidates.map(({ type, check }) => {
        const plan = check.palletPlan!
        return <div key={type.id} className="flex items-center justify-between gap-3 py-3">
          <div><p className="font-semibold">{labelForType(type.name)}</p><p className="mt-1 text-xs text-stone-500">{n(check.unitMaxLoadKg)} kg · {n(plan.availableSlots)} vị trí</p></div>
          <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-700">Hết kho</span>
        </div>
      }) : <p className="py-3 text-xs text-stone-600">Chưa nhận được đủ thông tin sức chứa của các loại kho.</p>}
    </div>
    <div>
      <Button type="button" onClick={onChangeRental} className="w-full sm:w-auto">Thay đổi thời gian thuê</Button>
    </div>
  </section>
}
