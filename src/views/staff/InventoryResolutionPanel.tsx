import { useRef, useState } from 'react'
import { userFacingError } from '../../presentation/userFacingError'
import type { AtSiteInventoryDecision } from '../../services/checkInApi'
import { Button } from '../../components/ui'
import type { CheckInCase } from '../../services/checkInApi'
import InventoryResultNotice from './InventoryResultNotice'
import { inventoryResult } from '../../domain/inventoryResult'

function quantities(value?: string | null): Record<string, number> {
  try { const result = JSON.parse(value || '{}'); return result && typeof result === 'object' && !Array.isArray(result) ? result : {} } catch { return {} }
}

export default function InventoryResolutionPanel({ item, busy, onRefresh, onPartialRemoval, onOpenReturns, onResolve }: {
  item: CheckInCase; busy: boolean; onRefresh: () => void; onPartialRemoval: () => void; onOpenReturns?: () => void
  onResolve?: (request: { decision: AtSiteInventoryDecision; customerPresent: boolean; note?: string; scheduledDate?: string; evidenceReferences?: string[]; resultVersion?: number }) => Promise<void>
}) {
  const [decision, setDecision] = useState<AtSiteInventoryDecision | ''>('')
  const [present, setPresent] = useState(false)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const locked = useRef(false)
  const otherGoods = item.declaredGoodsLines?.some(line => line.category === 'OTHER') ?? false
  const rejectionReasonRequired = otherGoods && decision === 'CANCEL_AND_RETURN'
  const submit = async () => {
    if (!onResolve || !decision || !present || busy || locked.current || !evidence.length || (decision === 'CANCEL_AND_RETURN' && !date) || (rejectionReasonRequired && !note.trim())) return
    locked.current = true; setSaving(true); setError('')
    try { await onResolve({ decision, customerPresent: true, scheduledDate: decision === 'CANCEL_AND_RETURN' ? date : undefined, note: note.trim() || undefined, evidenceReferences: evidence.length ? evidence : undefined, resultVersion: item.inventoryResultVersion }) }
    catch (error) { setError(userFacingError(error, 'Không thể ghi nhận phương án xử lý.')) }
    finally { locked.current = false; setSaving(false) }
  }
  const status = item.inventoryResolutionStatus
  const partial = status === 'PARTIAL_ACCEPTED'
  const returning = status === 'RETURN_REQUESTED'
  const done = status === 'ACCEPTED' || item.checkInStatus === 'completed'
  const accepted = quantities(partial ? item.inventoryAcceptedQuantitiesJson : item.inventorySuggestedQuantitiesJson)
  const lines = item.handover?.inventoryLines ?? []
  return <div className="space-y-4">
    <h3 className="text-lg font-bold">Xử lý sai lệch và xác nhận tiếp nhận</h3>
    <InventoryResultNotice result={inventoryResult(item.inventoryFullFit, Boolean(item.inventoryMismatchJson))} published
      checkInId={item.checkInId} packages={item.handover?.packageCount ?? 0}
      weight={item.handover?.actualMeasurements.weightKg ?? 0} volume={item.handover?.actualMeasurements.actualVolumeM3 ?? 0}>
      <p role="status" className="rounded-lg border bg-white p-4 text-sm font-semibold text-stone-900">
        {done ? 'Đã hoàn tất kiểm kê và tiếp nhận hàng hóa.' : returning ? 'Khách đã chọn trả lại kho. Tiếp tục nghiệm thu và quyết toán ở hồ sơ trả kho.'
          : partial ? item.inventoryRemainderRemovedAt ? 'Đã xác nhận đưa phần dư ra. Hồ sơ đã tiếp nhận phần hàng còn lại.' : 'Khách đã chọn nhận một phần. Chờ đưa phần dư ra và Staff xác nhận bằng chứng.'
          : item.inventoryFullFit ? 'Hàng thực tế vẫn vừa kho. Staff ghi nhận phương án tiếp nhận trực tiếp với khách.'
          : item.inventoryPartialFitAvailable ? 'Trao đổi với khách tại cơ sở và ghi nhận nhận phần vừa kho hoặc trả lại kho.' : 'Không có phương án nhận một phần. Staff ghi nhận trả kho với khách tại cơ sở.'}
      </p>
      {!item.inventoryFullFit && !returning && lines.length > 0 && <div className="overflow-x-auto rounded-lg border bg-white text-stone-900">
        <table className="w-full text-left text-sm"><caption className="p-3 text-left font-semibold">Phần tiếp nhận và phần phải đưa ra</caption>
          <thead><tr><th className="p-3">Hàng hóa</th><th className="p-3">Thực tế</th><th className="p-3">{partial ? 'Đã chọn nhận' : 'Có thể nhận'}</th><th className="p-3">Phần dư</th></tr></thead>
          <tbody>{lines.map(line => {
            const count = typeof accepted[line.goodsItemId] === 'number' ? accepted[line.goodsItemId] : partial || item.inventoryPartialFitAvailable ? 0 : null
            return <tr key={line.goodsItemId} className="border-t"><td className="p-3">{line.actualGoods?.customGoodsName || item.declaredGoodsLines?.find(row => row.id === line.goodsItemId)?.name || 'Hàng hóa'}</td><td className="p-3">{line.actualQuantity}</td><td className="p-3">{count ?? 'Chưa ghi nhận'}</td><td className="p-3">{count == null ? 'Chưa ghi nhận' : Math.max(0, line.actualQuantity - count)}</td></tr>
          })}</tbody>
        </table>
      </div>}
      {!done && !partial && !returning && <fieldset className="space-y-4 rounded-xl border border-amber-200 bg-white p-4 text-sm text-stone-900" disabled={busy || saving}>
        <legend className="px-1 font-bold">Phương án xử lý tại cơ sở</legend>
        {otherGoods && <p className="rounded-lg bg-amber-50 p-3">Khách khai báo hàng hóa loại Khác. Staff có thể chấp nhận nếu đủ điều kiện hoặc từ chối kèm lý do. Từ chối sẽ mở hồ sơ trả kho, nghiệm thu và quyết toán để xác định tiền hoàn hoặc thu thêm.</p>}
        {([
          ['ACCEPT_FULL', otherGoods ? 'Chấp nhận hàng hóa loại Khác và tiếp nhận toàn bộ' : 'Tiếp nhận toàn bộ hàng thực tế', Boolean(item.inventoryFullFit)],
          ['ACCEPT_PARTIAL', 'Nhận phần vừa kho, đưa phần dư ra', !item.inventoryFullFit && Boolean(item.inventoryPartialFitAvailable)],
          ['CANCEL_AND_RETURN', otherGoods ? 'Từ chối hàng hóa loại Khác và yêu cầu trả kho, quyết toán' : 'Trả lại kho', !item.inventoryFullFit || otherGoods],
        ] as const).filter(([, , enabled]) => enabled).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name={`resolution-${item.checkInId}`} checked={decision === value} onChange={() => setDecision(value)} />{label}</label>)}
        {decision === 'CANCEL_AND_RETURN' && <label className="grid gap-1">Ngày hẹn trả kho *<input type="date" className="rounded-lg border p-2" required value={date} onChange={event => setDate(event.target.value)} /><span className="text-xs text-stone-500">Ngày trả phải nằm trong hạn trả hàng theo hồ sơ; đổi lịch không kéo dài thời hạn.</span></label>}
        <label className="grid gap-1">{rejectionReasonRequired ? 'Lý do từ chối tiếp nhận *' : 'Ghi chú phương án (không bắt buộc)'}<textarea className="rounded-lg border p-2" required={rejectionReasonRequired} maxLength={1500} value={note} onChange={event => setNote(event.target.value)} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={present} onChange={event => setPresent(event.target.checked)} />Đã trao đổi phương án với chính chủ đang có mặt tại cơ sở.</label>
        <label className="grid gap-1">Mã ảnh biên bản có chữ ký khách *
          <input className="rounded-lg border p-2" value={evidence.join(', ')} onChange={event => setEvidence(event.target.value.split(',').map(value => value.trim()).filter(Boolean))} placeholder="Mã tệp ảnh biên bản có chữ ký khách" />
          <span className="text-xs text-stone-500">Bắt buộc: ảnh biên bản giấy có chữ ký xác nhận của khách. Ảnh xác minh danh tính chỉ chứng minh khách có mặt, không chứng minh khách đồng ý phương án.</span>
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <Button disabled={!onResolve || !decision || !present || !evidence.length || (decision === 'CANCEL_AND_RETURN' && !date) || (rejectionReasonRequired && !note.trim()) || busy || saving} onClick={() => void submit()}>{saving ? 'Đang lưu phương án…' : 'Ghi nhận phương án tại cơ sở'}</Button>
      </fieldset>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={onRefresh}>Cập nhật trạng thái xử lý</Button>
        {partial && !item.inventoryRemainderRemovedAt && <Button disabled={busy} onClick={onPartialRemoval}>Xác nhận phần dư đã đưa ra</Button>}
        {returning && onOpenReturns && <Button disabled={busy} onClick={onOpenReturns}>Mở Trả kho & nghiệm thu</Button>}
      </div>
    </InventoryResultNotice>
  </div>
}
