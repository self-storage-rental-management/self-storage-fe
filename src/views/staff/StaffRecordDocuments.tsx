import { Fragment, useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { CheckInCase } from '../../services/checkInApi'
import { Button } from '../../components/ui'
import InventoryDecisionSummary from '../../components/InventoryDecisionSummary'
import InventoryMismatchEvidence from './InventoryMismatchEvidence'
import { formatStaffDateTime, parseEmptyStorageHandover } from './staffPresentation'

export default function StaffRecordDocuments({ item, onPreview, onOpenReturns }: {
  item: CheckInCase; onPreview: (id: string) => void; onOpenReturns?: () => void
}) {
  const [tab, setTab] = useState<'handover' | 'inventory'>('handover')
  const id = useId()
  const record = item.handoverRecord
  const receiptConfirmedAt = item.customerReceiptConfirmedAt
  const receiptStatus = receiptConfirmedAt ? 'Khách đã xác nhận nhận kho' : item.checkInStatus === 'handover_pending_receipt' ? 'Chờ khách xác nhận nhận kho' : 'Chưa có bản ghi xác nhận nhận kho riêng'
  const handover = parseEmptyStorageHandover(item.readinessNote)
  const handoverEvidence = Array.from(new Set(handover.evidenceReferences))
  const inventoryReport = item.handover
  const legacyInventory = Boolean(inventoryReport && !item.inventoryActualJson)
  const inventoryEvidence = Array.from(new Set(inventoryReport?.evidenceReferences || []))
    .filter(assetId => !handoverEvidence.includes(assetId))
  const handoverCompleted = Boolean(item.checkedInAt) && !['rejected', 'no_show', 'cancelled'].includes(item.checkInStatus || '')
  const fieldClass = 'mt-1 break-words font-medium text-stone-900'
  const fields = (values: [string, string | null | undefined][]) => <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
    {values.map(([label, value]) => <div key={label}><dt className="text-stone-500">{label}</dt><dd className={fieldClass}>{value || 'Chưa ghi nhận'}</dd></div>)}
  </dl>
  const excelTable = (values: [string, ReactNode][], columns = 3) => <div className="overflow-x-auto rounded-lg border border-stone-200">
    <table className="min-w-[720px] w-full border-collapse text-left text-sm">
      <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
        <tr>{Array.from({ length: columns }, (_, index) => <Fragment key={index}>
          <th className="border-b border-stone-200 px-3 py-2">Thông tin</th>
          <th className="border-b border-stone-200 px-3 py-2">Giá trị</th>
        </Fragment>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: Math.ceil(values.length / columns) }, (_, row) => <tr key={row} className="align-top even:bg-stone-50/50">
          {Array.from({ length: columns }, (_, column) => {
            const value = values[row * columns + column]
            return value ? <Fragment key={column}>
              <th scope="row" className="border-t border-stone-200 px-3 py-2 font-medium text-stone-600">{value[0]}</th>
              <td className="border-t border-stone-200 px-3 py-2 font-medium text-stone-900">{value[1] || 'Chưa ghi nhận'}</td>
            </Fragment> : <td key={`empty-${column}`} colSpan={2} className="border-t border-stone-200 px-3 py-2" />
          })}
        </tr>)}
      </tbody>
    </table>
  </div>
  return <div className="space-y-4">
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">{fields([
      ['Mã đơn giữ kho', item.reservationCode], ['Gian kho', item.storageUnitCode], ['Khách hàng', item.customerName],
    ])}</div>
    <div role="tablist" aria-label="Loại biên bản" className="flex flex-wrap gap-2">
      {([['handover', 'Biên bản bàn giao'], ['inventory', 'Biên bản kiểm kê']] as const).map(([value, label]) => <Button
        key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-controls={`${id}-${value}-panel`}
        aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} variant={tab === value ? 'primary' : 'outline'}
        onClick={() => setTab(value)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 'handover' : event.key === 'End' ? 'inventory' : value === 'handover' ? 'inventory' : 'handover'
          setTab(next); document.getElementById(`${id}-${next}-tab`)?.focus()
        }}>{label}</Button>)}
    </div>
    <section role="tabpanel" id={`${id}-handover-panel`} aria-labelledby={`${id}-handover-tab`} hidden={tab !== 'handover'}>
      <div className="space-y-5 text-sm">
        <h3 className="font-semibold">Thông tin bàn giao gian kho</h3>
        {!handoverCompleted && <p className="rounded-lg bg-amber-50 p-3 text-amber-950">Chưa hoàn tất bàn giao kho. Bên dưới là thông tin đã ghi nhận trong hồ sơ.</p>}
        {excelTable([
          ['Thời điểm bàn giao', record?.handedOverAt ? formatStaffDateTime(record.handedOverAt) : handoverCompleted && item.checkedInAt ? formatStaffDateTime(item.checkedInAt) : null],
          ['Cơ sở bàn giao', record?.facilityName || item.facilityName],
          ['Địa chỉ cơ sở', record?.facilityAddress || item.facilityAddress],
          ['Người trực tiếp bàn giao', record?.handedOverByName],
          ['Nhân viên phụ trách', item.assignedStaffName], ['Điện thoại khách', item.customerPhone],
          ['CCCD/CMND đã đối chiếu', item.verifiedIdentityDocument || item.identityDocumentNumber],
          ['Mã ổ khóa / chìa khóa', item.lockReference],
          ['Thời điểm ký hợp đồng', item.contractSignedAt ? formatStaffDateTime(item.contractSignedAt) : null],
        ])}
        <section className="space-y-2" aria-label="Danh sách đã bàn giao">
          <h4 className="font-semibold">Danh sách vật dụng / quyền truy cập đã giao</h4>
          {record?.items.length ? <div className="overflow-x-auto rounded-lg border border-stone-200"><table className="min-w-[480px] w-full border-collapse text-left text-sm"><thead className="bg-stone-50 text-xs font-semibold text-stone-600"><tr><th className="border-b border-stone-200 px-3 py-2">Vật dụng / quyền truy cập</th><th className="border-b border-stone-200 px-3 py-2 text-right">Số lượng</th></tr></thead><tbody>{record.items.map((entry, index) => <tr key={`${entry.name}-${index}`} className="even:bg-stone-50/50"><td className="border-t border-stone-200 px-3 py-2">{entry.name}</td><td className="border-t border-stone-200 px-3 py-2 text-right font-semibold">{entry.quantity}</td></tr>)}</tbody></table></div>
            : <p className="text-xs text-stone-500">Chưa ghi nhận danh sách và số lượng đã giao.</p>}
        </section>
        <section className="space-y-2" aria-label="Khách xác nhận nhận kho">
          <h4 className="font-semibold">Xác nhận nhận kho của khách</h4>
          {excelTable([['Trạng thái', receiptStatus], ['Thời gian xác nhận', receiptConfirmedAt ? formatStaffDateTime(receiptConfirmedAt) : null]], 2)}
        </section>
        <section className="space-y-2" aria-label="Hồ sơ và bằng chứng bàn giao">
          <h4 className="font-semibold">Hồ sơ và bằng chứng bàn giao</h4>
          {excelTable([
            ['Biên bản có chữ ký hai bên', record?.signedRecordReference ? <Button type="button" size="sm" variant="outline" onClick={() => onPreview(record.signedRecordReference!)}>Xem biên bản đã ký</Button> : 'Chưa lưu riêng'],
            ['Hiện trạng kho khi bàn giao', handover.condition || 'Chưa có mô tả hiện trạng kho bàn giao đã lưu.'],
            ['Ghi chú đối chiếu giấy tờ', item.identityVerificationNote || 'Không có'],
            ['Ghi chú bàn giao', record?.note || 'Không có'],
            ['Bằng chứng bàn giao', handoverEvidence.length ? <div className="flex flex-wrap gap-2">{handoverEvidence.map((assetId, index) => <Button key={assetId} type="button" size="sm" variant="outline" onClick={() => onPreview(assetId)}>Xem tệp {index + 1}</Button>)}</div> : 'Chưa có bằng chứng đã lưu'],
            ['Bằng chứng ký hợp đồng', item.contractEvidenceReference && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.contractEvidenceReference) ? <Button type="button" size="sm" variant="outline" onClick={() => onPreview(item.contractEvidenceReference!)}>Xem tệp</Button> : 'Chưa có'],
          ], 1)}
        </section>
      </div>
    </section>
    <section role="tabpanel" id={`${id}-inventory-panel`} aria-labelledby={`${id}-inventory-tab`} hidden={tab !== 'inventory'}>
      <div className="space-y-4">
        {inventoryReport ? <>
          <header className="space-y-3 border-b border-stone-200 pb-3">
            <h3 className="text-base font-semibold">Biên bản kiểm kê hàng hóa</h3>
            {fields([
              ['Mã hồ sơ kiểm kê', item.checkInId], ['Cơ sở kiểm kê', item.facilityName],
              ['Nhân viên thực hiện', item.performedByName],
              ['Thời điểm hoàn tất kiểm kê', item.inventoryVerifiedAt ? formatStaffDateTime(item.inventoryVerifiedAt) : null],
              ['Khách hàng', item.customerName], ['Điện thoại', item.customerPhone],
              ['Email', item.customerEmail],
              ['CCCD/CMND đối chiếu khi kiểm kê', inventoryReport.identityDocumentNumber],
            ])}
          </header>
          {legacyInventory && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Biên bản cũ: hiển thị số liệu đã lưu. Hồ sơ chưa có kết luận sức chứa và quyết định tiếp nhận theo mẫu mới.</p>}
          {inventoryReport.identityVerificationNote && <p className="whitespace-pre-wrap text-xs text-stone-700"><b>Ghi chú đối chiếu giấy tờ khi kiểm kê:</b> {inventoryReport.identityVerificationNote}</p>}
          {inventoryReport.initialUnitCondition && <p className="whitespace-pre-wrap text-xs text-stone-700"><b>Hiện trạng gian kho ghi trong biên bản:</b> {inventoryReport.initialUnitCondition}</p>}
          {inventoryReport.goodsCondition && <p className="whitespace-pre-wrap text-xs text-stone-700"><b>Tình trạng hàng hóa ghi trong biên bản:</b> {inventoryReport.goodsCondition}</p>}
          <InventoryMismatchEvidence item={{ ...item,
            inventoryFullFit: legacyInventory ? undefined : item.inventoryFullFit,
            handover: { ...inventoryReport, evidenceReferences: inventoryEvidence },
          }} onPreview={onPreview} />
          <section className="space-y-3 border-t border-stone-200 pt-3" aria-label="Quyết định tiếp nhận và xác nhận biên bản">
            <h4 className="font-semibold">Quyết định tiếp nhận và xác nhận</h4>
            {item.inventoryDecision ? <InventoryDecisionSummary decision={item.inventoryDecision} onPreview={onPreview} onOpenReturns={onOpenReturns} />
              : <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">{legacyInventory ? 'Chưa ghi nhận quyết định tiếp nhận theo mẫu mới cho biên bản cũ này.' : item.inventoryResolutionStatus === 'RETURN_REQUESTED' ? 'Đã ghi nhận yêu cầu trả kho. Chưa có đầy đủ thông tin người quyết định và biên bản ký theo mẫu mới.' : item.inventoryResolutionStatus === 'TRANSFER_REQUESTED' ? 'Đã tạo yêu cầu chuyển hàng. Chưa có đầy đủ thông tin quyết định theo mẫu mới.' : item.inventoryResolutionStatus === 'ACCEPTED' ? 'Hàng hóa đã được tiếp nhận. Chưa có bản ghi xác nhận riêng theo mẫu mới.' : 'Chưa ghi nhận quyết định tiếp nhận.'}</p>}
            {!item.inventoryDecision?.evidenceReferences.length && <p className="text-xs text-stone-600">Ảnh biên bản có chữ ký khách: chưa được lưu riêng trong hồ sơ này.</p>}
          </section>
        </> : <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">Chưa có biên bản kiểm kê đã lưu cho hồ sơ này.</p>}
      </div>
    </section>
  </div>
}
