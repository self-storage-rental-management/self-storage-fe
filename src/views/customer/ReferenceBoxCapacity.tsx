import { REFERENCE_BOXES, referenceBoxCapacity } from '../../domain/referenceBoxCapacity'
import type { CustomerUnitType } from '../../services/customerReservationApi'

export default function ReferenceBoxCapacity({ unitType: t }: { unitType: CustomerUnitType }) {
  return <section className="space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="font-bold text-stone-900">Sức chứa thùng tham khảo</h4>
      <span className="text-xs text-stone-500">
        Khung kệ: <b>{t.rackLengthM} × {t.rackWidthM} × {t.rackHeightM} m</b> · Diện tích: <b>{Number((t.rackLengthM * t.rackWidthM).toFixed(2))} m²</b> · Thể tích: <b>{Number((t.rackLengthM * t.rackWidthM * t.rackHeightM).toFixed(2))} m³/khung</b>
      </span>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">{REFERENCE_BOXES.map(box => {
      const capacity = referenceBoxCapacity([t.rackLengthM, t.rackWidthM, t.rackHeightM], box.dimensionsCm, t.rackCount)
      return <article key={box.label} className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
        <h5 className="font-bold text-stone-900">{box.label}</h5>
        <p className="mt-2">Kích thước D × R × C: <b>{box.dimensionsCm.join(' × ')} cm</b></p>
        {!capacity ? <p className="mt-3 text-stone-600">Chưa đủ thông số khung kệ để tính sức chứa.</p> : <>
          <p className="mt-3"><b>{capacity.estimatedPerRack} thùng tham khảo / khung</b> · giới hạn hình học {capacity.perRack} thùng / khung.</p>
          <p className="mt-2 text-xs leading-5 text-stone-600">Hướng xếp D × R × C: {capacity.orientedDimensionsCm.join(' × ')} cm; {capacity.boxesAlongLength} thùng theo chiều dài × {capacity.boxesAlongWidth} thùng theo chiều rộng × {capacity.layers} lớp. Số tham khảo đã trừ 20% khoảng trống.</p>
          <p className="mt-3 text-2xl font-bold text-stone-900">{capacity.estimatedTotal.toLocaleString('vi-VN')} <span className="text-sm font-normal">thùng ước tính / kho</span></p>
        </>}
      </article>
    })}</div>
    <p className="text-xs leading-5 text-stone-600">Không có số kiện tối đa chung cho mọi hàng hóa. Sức chứa còn phụ thuộc kích thước, tải trọng và khả năng chịu lực của từng kiện. Xếp kiện nặng ở dưới, nhẹ ở trên; không chồng hàng dễ vỡ, hàng có ký hiệu cấm chồng hoặc vượt chiều cao khung. Nhân viên xác nhận cách xếp an toàn khi kiểm kê.</p>
  </section>
}
