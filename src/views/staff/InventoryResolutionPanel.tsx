import InventoryDecisionSummary from '../../components/InventoryDecisionSummary'
import { useRef, useState } from 'react'
import { userFacingError } from '../../presentation/userFacingError'
import type { AtSiteInventoryDecision } from '../../services/checkInApi'
import { uploadCheckInEvidence } from '../../services/checkInApi'
import { Button } from '../../components/ui'
import type { CheckInCase } from '../../services/checkInApi'
import { InventoryAlternatives } from './InventoryResultNotice'
import InventoryMismatchEvidence from './InventoryMismatchEvidence'
import { vietnamDateInput } from '../../utils/vietnamTime'
import { inventoryResult } from '../../domain/inventoryResult'

const MAX_EVIDENCE_FILES = 1
const MAX_EVIDENCE_SIZE_BYTES = 25 * 1024 * 1024
const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function InventoryResolutionPanel({ item, busy, onRefresh, onOpenReturns, onResolve, onPreview }: {
  item: CheckInCase; busy: boolean; onRefresh: () => void; onOpenReturns?: () => void
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
  const rejectionReasonRequired = decision === 'CANCEL_AND_RETURN'
  const disabled = busy || saving || uploading
  const uploadEvidence = async (files: File[]) => {
    if (!item.checkInId || locked.current || uploading) return
    if (files.length !== MAX_EVIDENCE_FILES || evidence.length >= MAX_EVIDENCE_FILES) {
      setError('Chỉ được đính kèm 1 ảnh biên bản. Vui lòng xóa ảnh hiện tại trước khi chọn ảnh khác.')
      return
    }
    const accepted = files
    setUploading(true); setError('')
    const uploaded: string[] = []
    try {
      for (const file of accepted) {
        if (!EVIDENCE_TYPES.includes(file.type)) throw new Error(`Tệp "${file.name}" không phải ảnh JPEG, PNG hoặc WebP.`)
        if (!file.size || file.size > MAX_EVIDENCE_SIZE_BYTES) throw new Error(`Ảnh "${file.name}" vượt quá dung lượng tối đa 25MB.`)
        const asset = await uploadCheckInEvidence(item.checkInId, file)
        uploaded.push(asset.id)
      }
      if (uploaded.length) setEvidence(current => Array.from(new Set([...current, ...uploaded])))
    } catch (reason) {
      if (uploaded.length) setEvidence(current => Array.from(new Set([...current, ...uploaded])))
      setError(userFacingError(reason, `Không thể tải ảnh biên bản "${accepted[uploaded.length]?.name ?? ''}" lên hệ thống.`))
    } finally { setUploading(false) }
  }
  const needsDate = decision === 'CANCEL_AND_RETURN'
  const today = vietnamDateInput()
  const invalidDate = needsDate && (!date || date < today)
  const submit = async () => {
    if (!onResolve || !decision || !present || disabled || locked.current || evidence.length !== MAX_EVIDENCE_FILES || invalidDate || (rejectionReasonRequired && !note.trim())) return
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
  const result = inventoryResult(item.inventoryFullFit, Boolean(item.inventoryMismatchJson))
  const report = item.handover
  const formatNumber = (value: number, digits = 0) => value.toLocaleString('vi-VN', { maximumFractionDigits: digits })
  return <div className="flex flex-col gap-4">
    <h3 className="text-lg font-bold">Kết quả tiếp nhận hàng hóa</h3>
    <div className="space-y-5 text-stone-900">
      {transferring && <div role="status" className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <h4 className="font-bold">Chờ xử lý yêu cầu chuyển hàng</h4>
        <p>Chuyển toàn bộ <b>{formatNumber(report?.packageCount ?? 0)} kiện</b> sang kho phù hợp · Đã tiếp nhận tại kho hiện tại: <b>0 kiện</b></p>
        <p className="text-xs">Theo dõi yêu cầu tại mục Hỗ trợ khách hàng.</p>
      </div>}
      {!item.inventoryDecision && !transferring && <p role="status" className="rounded-lg border bg-white p-4 text-sm font-semibold text-stone-900">
        {transferring ? 'Đã tạo yêu cầu thu xếp chuyển hàng. Cơ sở theo dõi yêu cầu tại mục Hỗ trợ khách hàng.' : done ? 'Đã ghi nhận kết quả kiểm kê vào hồ sơ thuê.' : returning ? 'Khách đã chọn trả lại kho. Tiếp tục nghiệm thu và quyết toán ở hồ sơ trả kho.'
          : partial ? 'Hồ sơ đang dùng phương án cũ đã ngừng áp dụng. Vui lòng ghi nhận lại phương án chuyển hàng hoặc trả kho.'
          : item.inventoryFullFit ? 'Hàng thực tế vẫn vừa kho. Staff ghi nhận phương án tiếp nhận trực tiếp với khách.'
          : 'Chọn chuyển hàng hoặc trả kho tại cơ sở.'}
      </p>}
      {report && <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">Bảng đối chiếu kiểm kê</h4>
          <p className="text-sm font-medium tabular-nums">{formatNumber(report.packageCount)} kiện · {formatNumber(report.actualMeasurements.weightKg, 2)} kg · {formatNumber(report.actualMeasurements.actualVolumeM3, 6)} m³</p>
        </div>
        <InventoryMismatchEvidence item={item} showEvidence={false} />
      </section>}
      <InventoryAlternatives result={result} published checkInId={item.checkInId} packages={report?.packageCount ?? 0} weight={report?.actualMeasurements.weightKg ?? 0} volume={report?.actualMeasurements.actualVolumeM3 ?? 0} showAlternatives={!returning && !done && !transferring} />
      {!done && !returning && !transferring && <fieldset className="space-y-4 rounded-xl border border-amber-200 bg-white p-4 text-sm text-stone-900" disabled={disabled}>
        <legend className="px-1 font-bold">Phương án xử lý tại cơ sở</legend>
        {otherGoods && <p className="rounded-lg bg-amber-50 p-3">Khách khai báo hàng hóa loại Khác. Staff có thể chấp nhận nếu đủ điều kiện hoặc từ chối kèm lý do. Từ chối sẽ mở hồ sơ trả kho, nghiệm thu và quyết toán để xác định tiền hoàn hoặc thu thêm.</p>}
        {([
          ['ACCEPT_FULL', otherGoods ? 'Chấp nhận hàng hóa loại Khác và tiếp nhận toàn bộ' : 'Tiếp nhận toàn bộ hàng thực tế', Boolean(item.inventoryFullFit)],
          ['REQUEST_TRANSFER', 'Tạo yêu cầu thu xếp chuyển hàng', !item.inventoryFullFit],
          ['CANCEL_AND_RETURN', otherGoods ? 'Từ chối hàng hóa loại Khác và yêu cầu trả kho, quyết toán' : 'Từ chối tiếp nhận và yêu cầu trả kho', !item.inventoryFullFit || otherGoods],
        ] as const).filter(([, , enabled]) => enabled).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name={`resolution-${item.checkInId}`} checked={decision === value} onChange={() => setDecision(value)} />{label}</label>)}
        {decision === 'CANCEL_AND_RETURN' && <label className="grid gap-1">Ngày hẹn trả kho *<input type="date" className="rounded-lg border p-2" required value={date} onChange={event => setDate(event.target.value)} /><span className="text-xs text-stone-500">Ngày trả phải nằm trong hạn trả hàng theo hồ sơ; đổi lịch không kéo dài thời hạn.</span></label>}
        <label className="grid gap-1">{rejectionReasonRequired ? 'Lý do từ chối tiếp nhận *' : 'Ghi chú phương án (không bắt buộc)'}<textarea className="rounded-lg border p-2" required={rejectionReasonRequired} maxLength={1500} value={note} onChange={event => setNote(event.target.value)} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={present} onChange={event => setPresent(event.target.checked)} />Đã trao đổi phương án với chính chủ đang có mặt tại cơ sở.</label>
        <div className="grid gap-2">
          <label className="grid gap-1">Ảnh biên bản có chữ ký khách *
            <input className="block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:font-medium" type="file"
              accept="image/jpeg,image/png,image/webp" disabled={disabled || evidence.length >= MAX_EVIDENCE_FILES}
              onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) void uploadEvidence(files) }} />
            <span className="text-xs text-stone-500">Chỉ đính kèm 1 ảnh biên bản giấy có chữ ký xác nhận của khách (tối đa 25MB). Xóa ảnh hiện tại để chọn ảnh khác. Ảnh xác minh danh tính chỉ chứng minh khách có mặt, không chứng minh khách đồng ý phương án.</span>
          </label>
          {uploading && <p role="status" className="text-xs text-stone-600">Đang tải ảnh biên bản lên…</p>}
          {evidence.length > 0 && <ul className="grid gap-2">{evidence.map((assetId, index) => <li key={assetId} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
            <span className="text-xs font-medium text-stone-700">Ảnh biên bản {index + 1}</span>
            {onPreview && <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onPreview(assetId)}>Xem ảnh</Button>}
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setEvidence(current => current.filter(id => id !== assetId))}>Xóa</Button>
          </li>)}</ul>}
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <Button disabled={!onResolve || !decision || !present || evidence.length !== MAX_EVIDENCE_FILES || invalidDate || (rejectionReasonRequired && !note.trim()) || disabled} onClick={() => void submit()}>{saving ? 'Đang lưu…' : decision === 'REQUEST_TRANSFER' ? 'Gửi yêu cầu chuyển hàng' : decision === 'ACCEPT_FULL' ? 'Ghi nhận vào hồ sơ thuê' : 'Xác nhận từ chối và tạo hồ sơ trả kho'}</Button>
      </fieldset>}
      <InventoryDecisionSummary decision={item.inventoryDecision} compact={transferring} onPreview={onPreview} onOpenReturns={onOpenReturns} />
      <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-3">
        {onPreview && Array.from(new Set(report?.evidenceReferences || [])).map(id => <Button key={id} size="sm" variant="outline" onClick={() => onPreview(id)}>Xem bằng chứng kiểm kê</Button>)}
        <Button variant="outline" disabled={busy} onClick={onRefresh}>Làm mới kết quả</Button>
        {returning && onOpenReturns && <Button disabled={busy} onClick={onOpenReturns}>Mở Trả kho & nghiệm thu</Button>}
      </div>
    </div>
  </div>
}
