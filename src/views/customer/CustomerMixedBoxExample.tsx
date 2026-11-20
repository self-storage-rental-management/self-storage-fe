import type { PalletPlan } from '../../services/customerReservationApi'
import type { RackResult } from '../../services/rackLayoutApi'
import { customerRackIssue } from './CustomerPalletCheck'

const n = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

function BoxLine({ name, item }: { name: string; item: PalletPlan['items'][number] }) {
  const allocations = item.allocations ?? []
  const firstLimit = allocations[0]?.capacity.maxPieces
  const sameLimit = firstLimit !== undefined && allocations.every(allocation => allocation.capacity.maxPieces === firstLimit)
  const loads = new Map<number, number>()
  for (const { piecesPerPallet, palletCount } of allocations) {
    loads.set(piecesPerPallet, (loads.get(piecesPerPallet) ?? 0) + palletCount)
  }

  return <li>
    <strong>{n(item.quantity)} {name} cần {n(item.requiredPallets)} tấm kê.</strong>
    {sameLimit && Math.ceil(item.quantity / firstLimit) === item.requiredPallets && <p>
      Mỗi tấm xếp tối đa {n(firstLimit)} thùng. Lấy {n(item.quantity)} ÷ {n(firstLimit)} rồi làm tròn lên.
    </p>}
    {loads.size > 0 && <p>{Array.from(loads, ([pieces, pallets]) =>
      `${n(pallets)} tấm, mỗi tấm ${n(pieces)} thùng`).join(' và ')}.</p>}
  </li>
}

export default function CustomerMixedBoxExample({ result, example }: {
  result: RackResult
  example: NonNullable<RackResult['mixedBoxExample']>
}) {
  const { smallBoxQuantity, largeBoxQuantity, plan, issue } = example
  const smallWeight = smallBoxQuantity * result.smallBox.weightKg
  const largeWeight = largeBoxQuantity * result.largeBox.weightKg
  const total = smallWeight + largeWeight
  const max = result.unitCargoLimitKg

  return <section className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
    <h6 className="font-semibold">Đặt chung {n(smallBoxQuantity)} thùng nhỏ và {n(largeBoxQuantity)} thùng lớn</h6>
    <ol className="list-decimal space-y-3 pl-5">
      <li>
        <strong>Cộng khối lượng hàng của cả đơn.</strong>
        <p>{n(smallBoxQuantity)} × {n(result.smallBox.weightKg)} kg = {n(smallWeight)} kg thùng nhỏ. {n(largeBoxQuantity)} × {n(result.largeBox.weightKg)} kg = {n(largeWeight)} kg thùng lớn.</p>
        <p>{n(smallWeight)} + {n(largeWeight)} = <strong>{n(total)} kg hàng</strong>.
          {' '}{total > max ? 'Vượt' : total === max ? 'Vừa đúng' : 'Nằm trong'} giới hạn {n(max)} kg hàng của gian.</p>
        {total > max && <p>Hệ thống dừng ở bước này, trước khi tính số tấm kê.</p>}
      </li>
      {total <= max && <li>
        <strong>Tính số tấm kê cho từng dòng hàng.</strong>
        <p>Thùng nhỏ và thùng lớn được khai báo thành hai dòng. Mỗi dòng dùng tấm kê riêng.</p>
        {plan ? <ul className="list-disc space-y-2 pl-4">
          {plan.items.map(item => <BoxLine key={item.itemNumber} item={item} name={item.itemNumber === 1 ? 'thùng nhỏ' : 'thùng lớn'} />)}
        </ul> : <p>{customerRackIssue(issue, 'Chưa tìm được cách xếp cả hai loại thùng trong gian này.')}</p>}
      </li>}
      {plan && <>
        <li>
          <strong>Cộng số chỗ đặt và kiểm tra từng khung.</strong>
          <p>{plan.items.map(item => n(item.requiredPallets)).join(' + ')} = {n(plan.requiredPallets)} tấm kê, dùng <strong>{n(plan.requiredPallets)} trong {n(plan.availableSlots)} chỗ đặt</strong>.</p>
          <p>Khi kiểm tra các khung, tính cả tấm kê. {n(total)} + {n(plan.requiredPallets)} × {n(plan.emptyPalletKg)} = {n(plan.totalLoadedWeightKg)} kg.</p>
          <ul className="list-disc pl-4">{plan.racks.map(rack => <li key={rack.code}>
            Khung {rack.code} dùng {n(rack.usedSlots)} trong {n(rack.totalSlots)} chỗ. Khối lượng đặt lên khung là {n(rack.loadedWeightKg)} kg, mức tối đa {n(rack.maxLoadKg)} kg.
          </li>)}</ul>
        </li>
        {total === max && <li><strong>Kiểm tra nếu thêm hàng.</strong> Thêm một thùng nhỏ sẽ thành {n(total + result.smallBox.weightKg)} kg hàng, vượt giới hạn của gian.</li>}
      </>}
    </ol>
  </section>
}
