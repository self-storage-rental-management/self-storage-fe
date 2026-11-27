import { defaultRackPallet, type RackInput, type RackResult } from '../../services/rackLayoutApi'

const n = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const size = (...values: number[]) => values.map(n).join(' × ') + ' cm'

function effectiveRackLoad(rack: RackResult['racks'][number], input: RackInput) {
  return rack.effectiveRackLoadKg ?? Math.min(
    input.maxRackLoadKg,
    (rack.maxBeamPairLoadKg ?? input.maxBeamPairLoadKg ?? input.maxLoadedPalletKg ?? 0) * rack.palletSlotCount,
  )
}

function beamPairLoad(rack: RackResult['racks'][number], input: RackInput) {
  return rack.maxBeamPairLoadKg ?? input.maxBeamPairLoadKg ?? input.maxLoadedPalletKg ?? 0
}

export default function CustomerRackSummary({ result }: { result: RackResult }) {
  const pallet = result.configuration.pallet ?? defaultRackPallet
  const palletLength = result.palletLengthCm ?? pallet.lengthCm
  const palletWidth = result.palletWidthCm ?? pallet.widthCm
  const palletHeight = result.palletHeightCm ?? pallet.heightCm
  const palletEmptyKg = result.palletEmptyWeightKg ?? result.palletEmptyKg ?? pallet.emptyKg
  const firstRack = result.racks[0]
  const firstInput = result.configuration.racks[0]
  if (!firstRack || !firstInput) {
    return <p className="text-sm text-stone-600">Chưa có cấu hình kệ để hiển thị sức chứa.</p>
  }

  const compartmentCount = result.totalCompartments ?? result.racks.reduce((total, rack) => total + rack.compartmentCount, 0)
  const maxCargoHeight = result.maxCargoHeightCm ?? Math.min(...result.racks.map(rack => rack.maxCargoHeightCm))
  const cargoPerCompartment = result.maxCargoWeightPerCompartmentKg
    ?? Math.max(0, Math.min(
      pallet.maxPayloadKg ?? Number.MAX_SAFE_INTEGER,
      beamPairLoad(firstRack, firstInput) - palletEmptyKg,
    ))
  const rackCargoLoads = result.racks.map((rack, index) => Math.max(
    0,
    effectiveRackLoad(rack, result.configuration.racks[index]) - rack.palletSlotCount * palletEmptyKg,
  ))
  const maxCargoPerRack = result.maxCargoWeightPerRackKg ?? Math.min(...rackCargoLoads)
  const maxCargoPerWarehouse = result.maxCargoWeightPerWarehouseKg ?? result.unitCargoLimitKg
  const smallBoxesPerCompartment = Math.floor(firstRack.smallBoxesPerRack / firstRack.compartmentCount)
  const largeBoxesPerCompartment = Math.floor(firstRack.largeBoxesPerRack / firstRack.compartmentCount)
  const sameRack = result.racks.every((rack, index) => {
    const input = result.configuration.racks[index]
    return input.lengthCm === firstInput.lengthCm
      && input.widthCm === firstInput.widthCm
      && input.heightCm === firstInput.heightCm
      && rack.levels.length === firstRack.levels.length
      && rack.bayCount === firstRack.bayCount
      && rack.compartmentCount === firstRack.compartmentCount
      && rack.palletSlotCount === firstRack.palletSlotCount
      && rack.bayLengthCm === firstRack.bayLengthCm
      && rack.bayWidthCm === firstRack.bayWidthCm
      && rack.maxCargoHeightCm === firstRack.maxCargoHeightCm
  })

  return <div className="space-y-5 text-sm text-stone-800">
    <p>Gian kho có <strong>{n(result.racks.length)} khung kệ</strong>, tổng cộng <strong>{n(compartmentCount)} khoang chứa hàng</strong>.</p>

    <section className="space-y-3">
      <h6 className="font-semibold">Cấu tạo kệ</h6>
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[38rem] text-left">
          <thead className="bg-stone-50"><tr>
            <th className="px-3 py-2 font-semibold">Thông số</th>
            <th className="px-3 py-2 font-semibold">Chi tiết</th>
          </tr></thead>
          <tbody>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Kích thước khung kệ</th><td className="px-3 py-2">{size(firstInput.lengthCm, firstInput.widthCm, firstInput.heightCm)}</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Số tầng mỗi khung</th><td className="px-3 py-2">{n(firstRack.levels.length)} tầng</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Số khoang mỗi tầng</th><td className="px-3 py-2">{n(firstRack.bayCount)} khoang</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Số tấm kê mỗi khoang</th><td className="px-3 py-2">{n(firstInput.palletsPerCompartment)} tấm</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Kích thước thông thủy mỗi khoang</th><td className="px-3 py-2">{size(result.compartmentClearLengthCm ?? firstRack.bayLengthCm, result.compartmentClearWidthCm ?? firstRack.bayWidthCm, result.compartmentClearHeightCm ?? firstRack.levels[0]?.clearHeightCm ?? 0)}</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Kích thước tấm kê do hệ thống tính</th><td className="px-3 py-2">{size(palletLength, palletWidth, palletHeight)} · nhô {n(result.actualPalletOverhangCm ?? 0)} cm mỗi mặt</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Số tấm kê tối đa theo hình học</th><td className="px-3 py-2">{n(result.maxPalletCountByGeometry ?? firstRack.maxPalletCountByGeometry ?? firstInput.palletsPerCompartment)} tấm kê mỗi khoang</td></tr>
          </tbody>
        </table>
      </div>
      {!sameRack && <p className="text-xs text-stone-600">Các khung không hoàn toàn giống nhau. Bảng trên hiển thị khung đầu tiên, còn sức chứa được tính riêng theo từng khung.</p>}
    </section>

    <section className="space-y-3">
      <h6 className="font-semibold">Khả năng lưu trữ</h6>
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[38rem] text-left">
          <thead className="bg-stone-50"><tr>
            <th className="px-3 py-2 font-semibold">Thông số</th>
            <th className="px-3 py-2 font-semibold">Chi tiết</th>
          </tr></thead>
          <tbody>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Kích thước hàng tối đa mỗi khoang</th><td className="px-3 py-2">{size(result.maxCargoLengthCm ?? palletLength, result.maxCargoWidthCm ?? palletWidth, maxCargoHeight)}</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Khối lượng hàng tối đa mỗi khoang</th><td className="px-3 py-2">{n(cargoPerCompartment)} kg</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Khối lượng hàng tối đa mỗi khung</th><td className="px-3 py-2">{n(maxCargoPerRack)} kg</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-semibold">Khối lượng hàng tối đa cả gian</th><td className="px-3 py-2 font-semibold">{n(maxCargoPerWarehouse)} kg</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section className="space-y-3">
      <h6 className="font-semibold">Sức chứa tham khảo</h6>
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[38rem] text-left">
          <thead className="bg-stone-50"><tr>
            <th className="px-3 py-2 font-semibold">Thông số</th>
            <th className="px-3 py-2 font-semibold">Thùng nhỏ</th>
            <th className="px-3 py-2 font-semibold">Thùng lớn</th>
          </tr></thead>
          <tbody>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Kích thước</th><td className="px-3 py-2">{size(result.smallBox.lengthCm, result.smallBox.widthCm, result.smallBox.heightCm)}</td><td className="px-3 py-2">{size(result.largeBox.lengthCm, result.largeBox.widthCm, result.largeBox.heightCm)}</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Khối lượng mỗi thùng</th><td className="px-3 py-2">{n(result.smallBox.weightKg)} kg</td><td className="px-3 py-2">{n(result.largeBox.weightKg)} kg</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Số lớp được phép xếp</th><td className="px-3 py-2">{n(result.smallBox.maxLayers)}</td><td className="px-3 py-2">{n(result.largeBox.maxLayers)}</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-medium">Số thùng tối đa mỗi khoang</th><td className="px-3 py-2">{n(smallBoxesPerCompartment)}</td><td className="px-3 py-2">{n(largeBoxesPerCompartment)}</td></tr>
            <tr className="border-t border-stone-200"><th className="px-3 py-2 font-semibold">Sức chứa tối đa cả gian</th><td className="px-3 py-2 font-semibold">{n(result.smallBoxesPerUnit)} thùng</td><td className="px-3 py-2 font-semibold">{n(result.largeBoxesPerUnit)} thùng</td></tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>
}
