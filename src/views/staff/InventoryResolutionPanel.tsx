import { useRef, useState } from 'react'
import { userFacingError } from '../../presentation/userFacingError'
import type { AtSiteInventoryDecision } from '../../services/checkInApi'
import { uploadCheckInEvidence } from '../../services/checkInApi'
import { Button } from '../../components/ui'
import type { CheckInCase } from '../../services/checkInApi'
import InventoryResultNotice from './InventoryResultNotice'
import { vietnamDateInput } from '../../utils/vietnamTime'
import { InventoryLineInspectionResult, PackagingInspectionResult } from '../customer/CustomerReservationCard'
import { inventoryResult } from '../../domain/inventoryResult'

function quantities(value?: string | null): Record<string, number> {
  try { const result = JSON.parse(value || '{}'); return result && typeof result === 'object' && !Array.isArray(result) ? result : {} } catch { return {} }
}

const MAX_EVIDENCE_FILES = 10
const MAX_EVIDENCE_SIZE_BYTES = 25 * 1024 * 1024
const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function InventoryResolutionPanel({ item, busy, onRefresh, onPartialRemoval, onOpenReturns, onResolve, onPreview }: {
  item: CheckInCase; busy: boolean; onRefresh: () => void; onPartialRemoval: () => void; onOpenReturns?: () => void
  onPreview?: (assetId: string) => void
  onResolve?: (request: { decision: AtSiteInventoryDecision; customerPresent: boolean; note?: string; scheduledDate?: string; evidenceReferences?: string[]; resultVersion?: number }) => Promise<void>
}) {
  const [decision, setDecision] = useState<AtSiteInventoryDecision | ''>('')
  const [present, setPresent] = useState(false)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const locked = useRef(false)
  const otherGoods = item.declaredGoodsLines?.some(line => line.category === 'OTHER') ?? false
  const rejectionReasonRequired = otherGoods && decision === 'CANCEL_AND_RETURN'
  const disabled = busy || saving || uploading
  const uploadEvidence = async (files: File[]) => {
    if (!item.checkInId || locked.current || uploading) return
    const accepted = files.slice(0, Math.max(0, MAX_EVIDENCE_FILES - evidence.length))
    if (!accepted.length) { setError(`Chỉ được tải lên tối đa ${MAX_EVIDENCE_FILES} ảnh biên bản.`); return }
    setUploading(true); setError('')
    const uploaded: string[] = []
    try {
      for (const file of accepted) {
        if (!EVIDENCE_TYPES.includes(file.type)) throw new Error(`Tệp "${file.name}" không phải ảnh JPEG, PNG hoặc WebP.`)
        if (!file.size || file.size > MAX_EVIDENCE_SIZE_BYTES) throw new Error(`Ảnh "${file.name}" vượt quá dung lượng tối đa 25MB.`)
        const asset = await uploadCheckInEvidence(item.checkInId, file, 'CHECK_IN', 'bien-ban-xu-ly-chenh-lech-hang-hoa', item.reservationCode)
        uploaded.push(asset.id)
      }
      if (uploaded.length) setEvidence(current => Array.from(new Set([...current, ...uploaded])))
    } catch (reason) {
      if (uploaded.length) setEvidence(current => Array.from(new Set([...current, ...uploaded])))
      setError(userFacingError(reason, `Không thể tải ảnh biên bản "${accepted[uploaded.length]?.name ?? ''}" lên hệ thống.`))
    } finally { setUploading(false) }
  }
  const needsDate = decision === 'ACCEPT_PARTIAL' || decision === 'CANCEL_AND_RETURN'
  const today = vietnamDateInput()
  const latestRemoval = vietnamDateInput(Date.now() + 3 * 86400000)
  const invalidDate = needsDate && (!date || date < today || (decision === 'ACCEPT_PARTIAL' && date > latestRemoval))
  const submit = async () => {
    if (!onResolve || !decision || !present || disabled || locked.current || !evidence.length || invalidDate || (rejectionReasonRequired && !note.trim())) return
    locked.current = true; setSaving(true); setError('')
    try { await onResolve({ decision, customerPresent: true, scheduledDate: needsDate ? date : undefined, note: note.trim() || undefined, evidenceReferences: evidence.length ? evidence : undefined, resultVersion: item.inventoryResultVersion }) }
    catch (error) { setError(userFacingError(error, 'Không thể ghi nhận phương án xử lý.')) }
    finally { locked.current = false; setSaving(false) }
  }
  const status = item.inventoryResolutionStatus
  const partial = status === 'PARTIAL_ACCEPTED'
  const transferring = status === 'TRANSFER_REQUESTED'
  const returning = status === 'RETURN_REQUESTED'
  const done = status === 'ACCEPTED' || item.checkInStatus === 'completed'
  const accepted = quantities(partial ? item.inventoryAcceptedQuantitiesJson : item.inventorySuggestedQuantitiesJson)
  const lines = item.handover?.inventoryLines ?? []
  return <div className="space-y-4">
    <h3 className="text-lg font-bold">Kết quả tiếp nhận hàng hóa</h3>
    <InventoryResultNotice result={inventoryResult(item.inventoryFullFit, Boolean(item.inventoryMismatchJson))} published
      checkInId={item.checkInId} packages={item.handover?.packageCount ?? 0}
      weight={item.handover?.actualMeasurements.weightKg ?? 0} volume={item.handover?.actualMeasurements.actualVolumeM3 ?? 0}>
      <p role="status" className="rounded-lg border bg-white p-4 text-sm font-semibold text-stone-900">
        {transferring ? 'Đã tạo yêu cầu thu xếp chuyển hàng. Cơ sở theo dõi yêu cầu tại mục Hỗ trợ khách hàng.' : done ? 'Đã ghi nhận kết quả kiểm kê vào hồ sơ thuê.' : returning ? 'Khách đã chọn trả lại kho. Tiếp tục nghiệm thu và quyết toán ở hồ sơ trả kho.'
          : partial ? item.inventoryRemainderRemovedAt ? 'Đã xác nhận đưa phần dư ra. Hồ sơ đã tiếp nhận phần hàng còn lại.' : 'Khách đã chọn nhận một phần. Chờ đưa phần dư ra và Staff xác nhận bằng chứng.'
          : item.inventoryFullFit ? 'Hàng thực tế vẫn vừa kho. Staff ghi nhận phương án tiếp nhận trực tiếp với khách.'
          : 'Chọn đưa phần dư ra khỏi gian kho hoặc tạo yêu cầu thu xếp chuyển hàng ngay tại cơ sở.'}
      </p>
      {item.inventoryFullFit && item.inventoryActualJson && <div className="space-y-2 rounded-lg bg-white p-3 text-stone-900">
        <InventoryLineInspectionResult detail={{ inventoryActualJson: item.inventoryActualJson, goodsItems: item.declaredGoodsLines }} />
        <PackagingInspectionResult detail={{ inventoryActualJson: item.inventoryActualJson, goodsCondition: item.declaredPackagingMethod }} />
      </div>}
      {partial && item.inventoryRemainderDeadlineAt && <p>Ngày hẹn hoàn tất đưa hàng dư ra: <b>{new Date(Date.parse(item.inventoryRemainderDeadlineAt) - 1).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</b></p>}
      {partial && item.inventoryRemainderRemovedAt && <p>Đã đưa hàng dư ra ngày {new Date(item.inventoryRemainderRemovedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.</p>}
      {!item.inventoryFullFit && !returning && lines.length > 0 && <div className="overflow-x-auto rounded-lg border bg-white text-stone-900">
        <table className="w-full text-left text-sm"><caption className="p-3 text-left font-semibold">Phần tiếp nhận và phần phải đưa ra</caption>
          <thead><tr><th className="p-3">Hàng hóa</th><th className="p-3">Thực tế</th><th className="p-3">Số kiện giữ lại</th><th className="p-3">Số kiện cần đưa ra</th></tr></thead>
          <tbody>{lines.map(line => {
            const count = typeof accepted[line.goodsItemId] === 'number' ? accepted[line.goodsItemId] : 0
            return <tr key={line.goodsItemId} className="border-t"><td className="p-3">{line.actualGoods?.customGoodsName || item.declaredGoodsLines?.find(row => row.id === line.goodsItemId)?.name || 'Hàng hóa'}</td><td className="p-3">{line.actualQuantity}</td><td className="p-3">{count}</td><td className="p-3">{Math.max(0, line.actualQuantity - count)}</td></tr>
          })}</tbody>
        </table>
      </div>}
      {!done && !partial && !returning && !transferring && <fieldset className="space-y-4 rounded-xl border border-amber-200 bg-white p-4 text-sm text-stone-900" disabled={disabled}>
        <legend className="px-1 font-bold">Phương án xử lý tại cơ sở</legend>
        {otherGoods && <p className="rounded-lg bg-amber-50 p-3">Khách khai báo hàng hóa loại Khác. Staff có thể chấp nhận nếu đủ điều kiện hoặc từ chối kèm lý do. Từ chối sẽ mở hồ sơ trả kho, nghiệm thu và quyết toán để xác định tiền hoàn hoặc thu thêm.</p>}
        {([
          ['ACCEPT_FULL', otherGoods ? 'Chấp nhận hàng hóa loại Khác và tiếp nhận toàn bộ' : 'Tiếp nhận toàn bộ hàng thực tế', Boolean(item.inventoryFullFit)],
          ['ACCEPT_PARTIAL', 'Nhận phần vừa kho, đưa phần dư ra', !item.inventoryFullFit],
          ['REQUEST_TRANSFER', 'Tạo yêu cầu thu xếp chuyển hàng', !item.inventoryFullFit],
          ['CANCEL_AND_RETURN', otherGoods ? 'Từ chối hàng hóa loại Khác và yêu cầu trả kho, quyết toán' : 'Trả lại kho', Boolean(item.inventoryFullFit && otherGoods)],
        ] as const).filter(([, , enabled]) => enabled).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name={`resolution-${item.checkInId}`} checked={decision === value} onChange={() => setDecision(value)} />{label}</label>)}
        {decision === 'ACCEPT_PARTIAL' && <label className="grid gap-1">Ngày hoàn tất đưa hàng dư ra *<input type="date" className="rounded-lg border p-2" min={today} max={latestRemoval} required value={date} onChange={event => setDate(event.target.value)} /></label>}
        {decision === 'CANCEL_AND_RETURN' && <label className="grid gap-1">Ngày hẹn trả kho *<input type="date" className="rounded-lg border p-2" required value={date} onChange={event => setDate(event.target.value)} /><span className="text-xs text-stone-500">Ngày trả phải nằm trong hạn trả hàng theo hồ sơ; đổi lịch không kéo dài thời hạn.</span></label>}
        <label className="grid gap-1">{rejectionReasonRequired ? 'Lý do từ chối tiếp nhận *' : 'Ghi chú phương án (không bắt buộc)'}<textarea className="rounded-lg border p-2" required={rejectionReasonRequired} maxLength={1500} value={note} onChange={event => setNote(event.target.value)} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={present} onChange={event => setPresent(event.target.checked)} />Đã trao đổi phương án với chính chủ đang có mặt tại cơ sở.</label>
        <div className="grid gap-2">
          <label className="grid gap-1">Biên bản xác nhận phương án hàng hóa có chữ ký khách *
            <input className="block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:font-medium" type="file"
              accept="image/jpeg,image/png,image/webp" multiple
              onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) void uploadEvidence(files) }} />
            <span className="text-xs text-stone-500">Bắt buộc: ảnh biên bản giấy có chữ ký xác nhận của khách. Ảnh xác minh danh tính chỉ chứng minh khách có mặt, không chứng minh khách đồng ý phương án.</span>
          </label>
          {uploading && <p role="status" className="text-xs text-stone-600">Đang tải ảnh biên bản lên…</p>}
          {evidence.length > 0 && <ul className="grid gap-2">{evidence.map((assetId, index) => <li key={assetId} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
            <span className="text-xs font-medium text-stone-700">Ảnh biên bản {index + 1}</span>
            {onPreview && <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onPreview(assetId)}>Xem ảnh</Button>}
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setEvidence(current => current.filter(id => id !== assetId))}>Xóa</Button>
          </li>)}</ul>}
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <Button disabled={!onResolve || !decision || !present || !evidence.length || invalidDate || (rejectionReasonRequired && !note.trim()) || disabled} onClick={() => void submit()}>{saving ? 'Đang lưu…' : decision === 'REQUEST_TRANSFER' ? 'Gửi yêu cầu chuyển hàng' : decision === 'ACCEPT_FULL' ? 'Ghi nhận vào hồ sơ thuê' : 'Ghi nhận phương án tại cơ sở'}</Button>
      </fieldset>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={onRefresh}>Làm mới kết quả</Button>
        {partial && !item.inventoryRemainderRemovedAt && <Button disabled={busy} onClick={onPartialRemoval}>Xác nhận phần dư đã đưa ra</Button>}
        {returning && onOpenReturns && <Button disabled={busy} onClick={onOpenReturns}>Mở Trả kho & nghiệm thu</Button>}
      </div>
    </InventoryResultNotice>
  </div>
}
