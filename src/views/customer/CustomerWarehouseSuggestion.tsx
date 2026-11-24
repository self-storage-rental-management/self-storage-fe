import { useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import { formatVndAmount } from '../../i18n/currency'
import type { CompatibilityCheckResult, GoodsItemInput, PalletPlan, ReservationPackagePricing } from '../../services/customerReservationApi'
import { getCustomerRackLayout, type RackResult } from '../../services/rackLayoutApi'

const n = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

function ProgressBar({ value, maximum, danger = false }: { value: number; maximum: number; danger?: boolean }) {
  const width = maximum > 0 ? Math.min(100, Math.max(0, value / maximum * 100)) : 0
  return <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
    <div className={`h-full rounded-full ${danger ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${width}%` }} />
  </div>
}

function useRackLayout(facilityId: string | undefined, unitTypeId: string | undefined) {
  const [layout, setLayout] = useState<RackResult | null | undefined>(undefined)
  useEffect(() => {
    if (!facilityId || !unitTypeId) return
    let active = true
    setLayout(undefined)
    void getCustomerRackLayout(facilityId, unitTypeId)
      .then(result => { if (active) setLayout(result ?? null) })
      .catch(() => { if (active) setLayout(null) })
    return () => { active = false }
  }, [facilityId, unitTypeId])
  return layout
}

function compartmentStats(plan: PalletPlan) {
  const reference = plan.racks[0]
  const palletsPerCompartment = reference && reference.compartments > 0
    ? Math.max(1, Math.round(reference.totalSlots / reference.compartments))
    : 1
  const keys = new Set<string>()
  const fallbackSlotByRack = new Map<string, number>()
  for (const item of plan.items) for (const allocation of item.allocations ?? []) {
    for (let index = 0; index < allocation.palletCount; index++) {
      const slot = fallbackSlotByRack.get(allocation.rackCode) ?? 0
      fallbackSlotByRack.set(allocation.rackCode, slot + 1)
      const compartment = allocation.compartmentNumber ?? Math.floor(slot / palletsPerCompartment) + 1
      keys.add(`${allocation.rackCode}-${compartment}`)
    }
  }
  return {
    used: keys.size || Math.max(1, Math.ceil(plan.requiredPallets / palletsPerCompartment)),
    total: Math.max(1, Math.round(plan.availableSlots / palletsPerCompartment)),
  }
}

type PriceComparison = {
  rentalMonths: number
  current: ReservationPackagePricing
  suggested: ReservationPackagePricing
}

function RentalPriceComparison({ currentName, suggestedName, comparison }: {
  currentName: string
  suggestedName: string
  comparison: PriceComparison
}) {
  const { current, suggested, rentalMonths } = comparison
  const rentalSavings = current.rentAfterPackageDiscount - suggested.rentAfterPackageDiscount
  const rows = [
    ['Tiền thuê cả kỳ', current.rentAfterPackageDiscount, suggested.rentAfterPackageDiscount],
    ['Tiền cọc đảm bảo kho (hoàn lại khi trả kho)', current.securityDepositAmount, suggested.securityDepositAmount],
    ['Tổng phải thanh toán', current.rentAfterPackageDiscount + current.securityDepositAmount, suggested.rentAfterPackageDiscount + suggested.securityDepositAmount],
    ['Phí giữ chỗ (thanh toán trước 20%)', current.reservationDepositAmount, suggested.reservationDepositAmount],
  ] as const

  return <div className="space-y-2 rounded-lg border border-amber-200 bg-white p-3 text-stone-900">
    {rentalSavings > 0 && <p className="text-lg font-bold text-amber-800">Tiết kiệm {formatVndAmount(rentalSavings)} tiền thuê trong {n(rentalMonths)} tháng</p>}
    <h5 className="font-semibold">So sánh chi phí kỳ thuê {n(rentalMonths)} tháng</h5>
    <p className="text-xs text-stone-600">Tiền thuê đã tính mức giảm {n(suggested.discountRate * 100)}% của gói đang chọn.</p>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[25rem] text-left text-xs sm:text-sm">
        <thead className="border-b border-stone-200">
          <tr>
            <th scope="col" className="py-2 pr-2">Khoản tiền</th>
            <th scope="col" className="px-2 py-2 text-right">{currentName}</th>
            <th scope="col" className="px-2 py-2 text-right">{suggestedName}</th>
            <th scope="col" className="py-2 pl-2 text-right">Chênh lệch khi đổi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, from, to]) => {
            const difference = Math.round(to) - Math.round(from)
            return <tr key={label} className="border-b border-stone-100">
              <th scope="row" className="py-2 pr-2 font-medium">{label}</th>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatVndAmount(from)}</td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatVndAmount(to)}</td>
              <td className="whitespace-nowrap py-2 pl-2 text-right font-semibold tabular-nums">
                {difference === 0 ? 'Bằng nhau' : `${difference > 0 ? '+' : '−'}${formatVndAmount(Math.abs(difference))}`}
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
    <p className="text-xs text-stone-600">Cọc đảm bảo được hoàn lại sau quyết toán. Cọc thấp hơn giúp giảm số tiền cần trả ban đầu; khoản trả trước đã nằm trong tổng chi phí. Số tiền cuối cùng theo báo giá.</p>
  </div>
}

export default function CustomerWarehouseSuggestion({
  currentName, suggestedName, suggestedCheck, plan, goodsItems = [], currentCheck, priceComparison, actionLabel, disabled, onChoose,
}: {
  currentName: string
  suggestedName: string
  suggestedCheck: CompatibilityCheckResult
  plan: PalletPlan
  goodsItems?: GoodsItemInput[]
  currentCheck?: CompatibilityCheckResult | null
  priceComparison?: PriceComparison
  actionLabel: string
  disabled: boolean
  onChoose: () => void
}) {
  const currentLayout = useRackLayout(currentCheck?.facilityId, currentCheck?.unitTypeId)
  const totalQuantity = goodsItems.reduce((sum, item) => sum + item.quantity, 0)
  const suggestedCompartments = compartmentStats(plan)
  if (currentCheck) {
    const currentFitsCapacity = currentCheck.physicalFitStatus === 'FIT'
      || Boolean(currentCheck.palletPlan && currentCheck.result !== 'INCOMPATIBLE')
    const currentHasNoVacancy = currentCheck.availabilityStatus === 'NO_VACANT_WAREHOUSE'
      || currentFitsCapacity && currentCheck.availableUnitCount <= 0
    const totalWeight = currentCheck.totalGoodsWeightKg
    const currentLimit = currentCheck.unitMaxLoadKg
    const weightExceeded = totalWeight > currentLimit
    const requiredPallets = currentCheck.requiredPallets ?? null
    const availablePalletSlots = currentCheck.availablePalletSlots ?? null
    const currentPalletSlotShortage = requiredPallets != null
      && availablePalletSlots != null
      && requiredPallets > availablePalletSlots
    const currentUsedCompartments = currentCheck.palletPlan
      ? compartmentStats(currentCheck.palletPlan).used
      : null
    const currentTotalCompartments = currentLayout?.totalCompartments
      ?? (currentCheck.palletPlan ? compartmentStats(currentCheck.palletPlan).total : null)
    const currentReason = currentHasNoVacancy
      ? `Hàng hóa đã vừa với sức chứa của ${currentName}, nhưng hiện không còn gian kho trống trong kỳ thuê đã chọn.`
      : currentCheck.issues[0] || `Khối lượng hàng vượt giới hạn của ${currentName}.`
    const compartmentDisplay = currentUsedCompartments == null
      ? currentTotalCompartments == null ? 'Không xếp đủ' : `Không xếp đủ / ${n(currentTotalCompartments)}`
      : currentTotalCompartments == null ? `${n(currentUsedCompartments)} / -` : `${n(currentUsedCompartments)} / ${n(currentTotalCompartments)}`
    const showPalletSlotProgress = !currentCheck.palletPlan
      && requiredPallets != null
      && availablePalletSlots != null
    const storageLabel = showPalletSlotProgress ? 'Vị trí tấm kê' : 'Khoang lưu trữ'
    const storageDisplay = showPalletSlotProgress
      ? `${n(requiredPallets!)} / ${n(availablePalletSlots!)}`
      : compartmentDisplay
    const storageOverage = showPalletSlotProgress
      ? Math.max(0, requiredPallets! - availablePalletSlots!)
      : 0
    const currentTitle = currentHasNoVacancy
      ? 'Hàng vừa sức chứa nhưng kho đã hết gian trống'
      : weightExceeded
        ? 'Kho đang chọn vượt tải trọng'
        : currentPalletSlotShortage
          ? 'Kho đang chọn không đủ vị trí tấm kê'
          : 'Kho đang chọn chưa đủ sức chứa'
    return <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-800">
      <h4 className="flex items-center gap-2 text-base font-semibold"><span className="text-amber-700">⚠</span>{currentTitle}</h4>
      <p className="text-xs text-stone-500">{currentName} · {n(totalQuantity)} kiện hàng</p>
      <div className="grid grid-cols-2 gap-4 border-b border-stone-200 pb-4">
        <div><p className="text-xs text-stone-500">Khối lượng hàng</p><p className={`mt-1 text-lg font-semibold ${weightExceeded ? 'text-red-600' : 'text-stone-900'}`}>{n(totalWeight)} / {n(currentLimit)} kg</p><ProgressBar value={totalWeight} maximum={currentLimit} danger={weightExceeded} /><p className={`mt-1 text-[11px] ${weightExceeded ? 'text-red-600' : 'text-stone-500'}`}>{weightExceeded ? `Vượt ${n(totalWeight - currentLimit)} kg` : `Còn ${n(Math.max(0, currentLimit - totalWeight))} kg hạn mức`}</p></div>
        <div><p className="text-xs text-stone-500">{storageLabel}</p><p className={`mt-1 text-lg font-semibold ${storageOverage > 0 ? 'text-red-600' : 'text-stone-900'}`}>{storageDisplay}</p>{showPalletSlotProgress ? <ProgressBar value={requiredPallets!} maximum={availablePalletSlots!} danger={storageOverage > 0} /> : currentUsedCompartments != null && currentTotalCompartments != null && <ProgressBar value={currentUsedCompartments} maximum={currentTotalCompartments} />}<p className={`mt-1 text-[11px] ${storageOverage > 0 ? 'text-red-600' : 'text-stone-500'}`}>{storageOverage > 0 ? `Vượt ${n(storageOverage)} vị trí tấm kê` : currentUsedCompartments == null ? 'Chưa có phương án xếp đủ toàn bộ số tấm kê' : 'Số khoang cần dùng'}</p></div>
      </div>
      <div className="border-b border-stone-200 pb-3">
        <h5 className="font-semibold">Tại sao chưa thể chọn kho này?</h5>
        <p className="mt-2 leading-5">{currentReason}</p>
      </div>
      <div className="space-y-2">
        <h5 className="font-semibold">{currentHasNoVacancy ? 'Loại kho còn gian trống phù hợp' : 'Loại kho phù hợp hơn'}</h5>
        <div className="rounded-lg border border-stone-200 p-3">
          <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{suggestedName}</p><p className="mt-1 text-xs text-stone-500">{n(suggestedCompartments.total)} khoang chứa hàng</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">Phù hợp</span></div>
          <div className="mt-3 space-y-2 text-xs"><div><div className="flex justify-between"><span>Khối lượng hàng</span><strong>{n(suggestedCheck.totalGoodsWeightKg)} / {n(suggestedCheck.unitMaxLoadKg)} kg</strong></div><ProgressBar value={suggestedCheck.totalGoodsWeightKg} maximum={suggestedCheck.unitMaxLoadKg} /></div><div><div className="flex justify-between"><span>Khoang lưu trữ</span><strong>{n(suggestedCompartments.used)} / {n(suggestedCompartments.total)} khoang</strong></div><ProgressBar value={suggestedCompartments.used} maximum={suggestedCompartments.total} /></div></div>
          <Button type="button" className="mt-3 w-full" disabled={disabled} onClick={onChoose}>{actionLabel}</Button>
        </div>
      </div>
      <p className="text-xs text-stone-500">Bạn có thể đổi loại kho mà không cần nhập lại thông tin hàng hóa.</p>
      {priceComparison && <RentalPriceComparison currentName={currentName} suggestedName={suggestedName} comparison={priceComparison} />}
      {suggestedCheck.staffReviewRequired && <p className="text-xs text-amber-800">Nhân viên cơ sở cần duyệt hàng trước khi thanh toán cọc.</p>}
    </section>
  }
  const { palletLengthCm, palletWidthCm } = plan
  return <section className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <h4 className="font-semibold">Gợi ý đổi sang {suggestedName}</h4>
    {priceComparison && <RentalPriceComparison currentName={currentName} suggestedName={suggestedName} comparison={priceComparison} />}
    <details><summary className="cursor-pointer text-sm font-medium">Xem lý do kho được gợi ý phù hợp</summary><ul className="mt-2 list-disc space-y-1 pl-5">
      <li>
        Tấm kê của {suggestedName} có chiều dài {n(palletLengthCm)} cm và chiều rộng {n(palletWidthCm)} cm.
        {plan.items.map(item => {
          const goods = goodsItems[item.itemNumber - 1]
          const placement = item.allocations?.[0]?.capacity
          const placementChanged = goods && placement?.placementLengthCm != null
            && placement.placementWidthCm != null && placement.placementHeightCm != null
            && (placement.placementLengthCm !== goods.lengthCm
              || placement.placementWidthCm !== goods.widthCm
              || placement.placementHeightCm !== goods.heightCm)
          if (placementChanged) {
            const laidFlat = placement!.placementHeightCm! < goods!.heightCm
            return <p key={item.itemNumber}>Hàng {item.itemNumber} xếp vừa khi {laidFlat ? 'xoay và đặt nằm ngang' : 'xoay trên mặt tấm kê'} ({n(placement!.placementLengthCm!)} × {n(placement!.placementWidthCm!)} × {n(placement!.placementHeightCm!)} cm).</p>
          }
          if (!goods || (goods.lengthCm <= palletLengthCm && goods.widthCm <= palletWidthCm)
            || goods.widthCm > palletLengthCm || goods.lengthCm > palletWidthCm) return null
          return <p key={item.itemNumber}>
            Hàng {item.itemNumber} xếp vừa khi xoay ngang. Chiều rộng kiện {n(goods.widthCm)} cm đặt theo chiều dài tấm kê.
          </p>
        })}
      </li>
      <li>
        <strong>{suggestedName} chứa tối đa {n(suggestedCheck.unitMaxLoadKg)} kg hàng.</strong>
        {' '}Đơn nặng {n(suggestedCheck.totalGoodsWeightKg)} kg, nằm trong giới hạn của gian.
      </li>
      <li>
        Cách xếp dùng <strong>{n(suggestedCompartments.used)} trong {n(suggestedCompartments.total)} khoang</strong>.
        {' '}Khối lượng trên từng khung nằm trong mức cho phép.
      </li>
      <li>Có {n(suggestedCheck.availableUnitCount)} gian phù hợp trong kỳ thuê đã chọn.</li>
    </ul></details>

    {suggestedCheck.staffReviewRequired && <p>Nhân viên cơ sở cần duyệt hàng trước khi thanh toán cọc.</p>}
    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onChoose}>{actionLabel}</Button>
  </section>
}
