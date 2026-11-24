import type { CheckInCase, CompleteCheckInRequest } from '../../services/checkInApi'
import { Button } from '../../components/ui'
import { inventoryReportNote, staffGoodsCategoryLabel } from './staffPresentation'

export type InventoryInspectionReport = Partial<Pick<CompleteCheckInRequest,
  'packageCount' | 'inventoryLines' | 'actualPackagingMethod' | 'packagingCondition' | 'notes' | 'identityVerificationNote' | 'varianceReason' | 'evidenceReferences'>> & {
  actualMeasurements: Partial<CompleteCheckInRequest['actualMeasurements']>
}

type Field = { label: string; value: string; declared?: string; changed?: boolean; comparable?: boolean }
const missing = 'Chưa ghi nhận'
const number = (value: number | null | undefined, unit = '') => value == null || !Number.isFinite(value) ? missing : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 6 })}${unit}`
const yesNo = (value?: boolean | null) => value == null ? missing : value ? 'Có' : 'Không'
const numeric = (label: string, actual: number | null | undefined, declared?: number | null, unit = ''): Field => ({
  label, value: number(actual, unit), declared: number(declared, unit),
  comparable: actual != null && declared != null && Number.isFinite(actual) && Number.isFinite(declared),
  changed: actual != null && declared != null && Number.isFinite(actual) && Number.isFinite(declared) && Math.abs(actual - declared) > 0.000001,
})
const text = (label: string, actual?: string | null, declared?: string | null, changed?: boolean): Field => ({
  label, value: actual || missing, declared: declared || missing,
  comparable: actual != null && declared != null && actual !== missing && declared !== missing,
  changed: changed ?? (actual != null && declared != null && actual.trim().toLocaleLowerCase('vi') !== declared.trim().toLocaleLowerCase('vi')),
})
function Fields({ values, caption }: { values: Field[]; caption: string }) {
  const recorded = values.filter(field => field.value !== missing && field.value.trim() !== '')
  if (!recorded.length) return null
  return <div className="overflow-x-auto rounded-lg border border-stone-300">
    <table className="w-full min-w-[38rem] table-fixed border-collapse text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <colgroup><col className="w-[26%]" /><col className="w-[25%]" /><col className="w-[25%]" /><col className="w-[24%]" /></colgroup>
      <thead className="bg-stone-100 text-stone-700"><tr>
        {['Thông tin', 'Đã khai báo', 'Thực tế kiểm kê', 'Kết quả đối chiếu'].map(label => <th key={label} scope="col" className="border-b border-r border-stone-300 px-3 py-2 font-semibold last:border-r-0">{label}</th>)}
      </tr></thead>
      <tbody>{recorded.map(field => <tr key={field.label} className={field.changed ? 'bg-amber-50' : 'bg-white'}>
        <th scope="row" className="break-words border-b border-r border-stone-200 px-3 py-2 font-medium text-stone-800">{field.label}</th>
        <td className="break-words border-b border-r border-stone-200 px-3 py-2 text-stone-600">{field.label === 'Chất liệu' && (!field.declared || field.declared === missing) ? 'Không khai báo' : field.declared || missing}</td>
        <td className={`break-words border-b border-r border-stone-200 px-3 py-2 font-semibold tabular-nums ${field.changed ? 'text-amber-950' : 'text-stone-900'}`}>{field.value}</td>
        <td className="border-b border-stone-200 px-3 py-2">
          {field.changed ? <span className="font-semibold text-amber-900">Khác khai báo</span>
            : field.label === 'Chất liệu' && (!field.declared || field.declared === missing) ? <span className="text-stone-500">Không khai báo</span>
            : field.comparable ? <span className="text-emerald-800">Khớp khai báo</span>
            : <span className="text-stone-500">Chưa đủ dữ liệu đối chiếu</span>}
        </td>
      </tr>)}</tbody>
    </table>
  </div>
}

export default function InventoryMismatchEvidence({ item, onPreview, showEvidence = true }: {
  item: Partial<Pick<CheckInCase, 'declaredGoodsLines' | 'declaredPackageCount' | 'declaredGoodsWeightKg' | 'declaredGoodsVolumeM3' | 'declaredPackagingMethod' | 'inventoryFullFit' | 'inventoryMismatchJson' | 'inventoryMismatchSummary'>> & { handover?: InventoryInspectionReport | null }; onPreview?: (assetId: string) => void
  showEvidence?: boolean
}) {
  const report = item.handover
  if (!report) return <p className="text-sm text-stone-600">Chưa có bản kiểm kê đã lưu.</p>
  const additionalNote = inventoryReportNote(report.notes, report.identityVerificationNote)
  const evidence = Array.from(new Set(report.evidenceReferences || []))
  const conclusion = item.inventoryFullFit == null ? 'Chưa đủ dữ liệu để kết luận sức chứa'
    : !item.inventoryFullFit ? 'Hàng hóa không thể chứa vừa trong kho'
    : item.inventoryMismatchJson ? 'Hàng hóa có chênh lệch nhưng vẫn vừa kho' : 'Hàng hóa khớp khai báo và vừa kho'
  return <section className="space-y-3 text-sm text-stone-900" aria-label="Kết quả kiểm kê đã lưu">
    <Fields caption="Tổng hợp kiểm kê" values={[
      numeric('Tổng số kiện', report.packageCount, item.declaredPackageCount, ' kiện'),
      numeric('Tổng khối lượng', report.actualMeasurements.weightKg, item.declaredGoodsWeightKg, ' kg'),
      numeric('Tổng thể tích', report.actualMeasurements.actualVolumeM3, item.declaredGoodsVolumeM3, ' m³'),
    ]} />
    <div className="divide-y divide-stone-200">
      {(report.inventoryLines || []).map((line, index) => {
        const declared = item.declaredGoodsLines?.find(value => value.id === line.goodsItemId)
        const actual = line.actualGoods
        const name = declared?.name || declared?.categoryName || `Dòng hàng ${index + 1}`
        const categoryChanged = declared?.catalogCategoryId && actual?.catalogCategoryId ? declared.catalogCategoryId !== actual.catalogCategoryId : undefined
        const materialChanged = declared?.catalogMaterialId && actual?.catalogMaterialId ? declared.catalogMaterialId !== actual.catalogMaterialId : undefined
        const fields: Field[] = [numeric('Số lượng', line.actualQuantity, declared?.quantity, ' kiện')]
        if (line.actualQuantity > 0) fields.push(
          text('Loại hàng', actual?.categoryName || (actual?.category ? staffGoodsCategoryLabel(actual.category) : null), declared?.categoryName || name, categoryChanged),
          text('Chất liệu', actual?.customMaterial || actual?.materialName, declared?.materialName, materialChanged),
          numeric('Dài / kiện', line.measurements?.lengthCm, declared?.lengthCm, ' cm'),
          numeric('Rộng / kiện', line.measurements?.widthCm, declared?.widthCm, ' cm'),
          numeric('Cao / kiện', line.measurements?.heightCm, declared?.heightCm, ' cm'),
          numeric('Khối lượng / kiện', actual?.weightPerItemKg ?? (line.measurements ? line.measurements.weightKg / line.actualQuantity : null), declared?.weightPerPackageKg, ' kg'),
          text('Dễ vỡ', actual?.fragile == null ? null : yesNo(actual.fragile), declared?.fragile == null ? null : yesNo(declared.fragile)),
          text('Xếp chồng', actual?.stackable == null ? null : yesNo(actual.stackable), declared?.stackable == null ? null : yesNo(declared.stackable)),
          text('Đặt nằm ngang', actual?.allowHorizontalPlacement == null ? null : yesNo(actual.allowHorizontalPlacement), declared?.allowHorizontalPlacement == null ? null : yesNo(declared.allowHorizontalPlacement)),
        )
        if (actual?.category === 'OTHER') fields.push(text('Tên hàng hóa khác', actual.customGoodsName, declared?.name))
        if (actual?.stackable) fields.push(numeric('Số lớp xếp', actual.maxStackLayers, declared?.maxStackLayers))
        return <article key={line.goodsItemId} className="space-y-2 py-3 first:pt-0 last:pb-0">
          <h4 className="font-semibold">{index + 1}. {name}</h4>
          <Fields caption={`Đối chiếu ${name}`} values={fields} />
          {actual?.description && <p className="break-words text-xs text-stone-600">Mô tả: {actual.description}</p>}
          {line.note && <p className="whitespace-pre-wrap break-words text-xs text-stone-700">Ghi chú: {line.note}</p>}
        </article>
      })}
    </div>
    {(report.actualPackagingMethod?.trim() || additionalNote) && <div className="space-y-2 border-t border-stone-200 pt-3">
      <Fields caption="Đối chiếu đóng gói" values={[text('Phương thức đóng gói', report.actualPackagingMethod, item.declaredPackagingMethod)]} />
      {additionalNote && <p className="whitespace-pre-wrap break-words text-xs text-stone-600"><b>Ghi chú bổ sung của nhân viên:</b> {additionalNote}</p>}
    </div>}
    {showEvidence && <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3 text-xs">
      <span className="font-medium">Bằng chứng kiểm kê:</span>
      {evidence.length ? evidence.map((assetId, index) => onPreview ? <Button key={assetId} type="button" size="sm" variant="outline" onClick={() => onPreview(assetId)}>Xem bằng chứng {index + 1}</Button> : <span key={assetId}>Tệp {index + 1} đã lưu</span>) : <span className="text-stone-500">Chưa có ảnh/PDF đã lưu.</span>}
    </div>}
    <footer className={`space-y-2 rounded-lg border p-3 ${item.inventoryFullFit === false ? 'border-red-200 bg-red-50 text-red-950' : item.inventoryMismatchJson ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-stone-200 bg-stone-50'}`}>
      <p className="font-semibold">Kết luận: {conclusion}</p>
      {item.inventoryMismatchSummary && <p className="text-xs">{item.inventoryMismatchSummary}</p>}
      <p className="whitespace-pre-wrap break-words text-xs"><b>Lý do chênh lệch:</b> {report.varianceReason || (item.inventoryFullFit && !item.inventoryMismatchJson ? 'Không có chênh lệch được ghi nhận.' : 'Chưa có lý do được ghi nhận.')}</p>
    </footer>
  </section>
}
