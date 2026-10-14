import { REFERENCE_BOXES, referenceBoxCapacity } from '../../domain/referenceBoxCapacity'
import type { CustomerUnitType } from '../../services/customerReservationApi'

export default function ReferenceBoxCapacity({ unitType: t }: { unitType: CustomerUnitType }) {
  return <section className="space-y-3">
    <h4 className="font-bold text-stone-900">Sức chứa thùng tham khảo</h4>
    <div className="grid gap-4 sm:grid-cols-2">{REFERENCE_BOXES.map(box => {
      const capacity = referenceBoxCapacity([t.rackLengthM, t.rackWidthM, t.rackHeightM], box.dimensionsCm, t.rackCount)
      return <article key={box.label} className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
        <h5 className="font-bold text-stone-900">{box.label}</h5>
        <p className="mt-2">Kích thước D × R × C: <b>{box.dimensionsCm.join(' × ')} cm</b></p>
        {!capacity ? <p className="mt-3 text-stone-600">Chưa đủ thông số khung kệ để tính sức chứa.</p> : <>
          <p className="mt-3 text-2xl font-bold text-stone-900">{capacity.estimatedTotal.toLocaleString('vi-VN')} <span className="text-sm font-normal">thùng ước tính / kho</span></p>
        </>}
      </article>
    })}</div>
  </section>
}
