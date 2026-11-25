import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { apiDownload } from '../../services/apiClient'
import {
  recordReturnArrival, returnError, reviewReturnArrival, uploadReturnEvidence, verifyReturnIdentity, type ApiReturn,
} from '../../services/returnApi'

export default function ReturnAttendance({ record, role, editable, onChanged }: {
  record: ApiReturn
  role: 'staff' | 'manager'
  editable: boolean
  onChanged: () => void
}) {
  const [result, setResult] = useState<ApiReturn['attendance']>()
  const attendance = result ?? record.attendance
  const [now, setNow] = useState(Date.now)
  const [file, setFile] = useState<File>()
  const [document, setDocument] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const attempt = useRef<string | null>(null)
  const evidence = useRef<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => setResult(undefined), [record.attendance])

  async function downloadEvidence(id: string) {
    try {
      const asset = await apiDownload('/api/files/' + encodeURIComponent(id))
      const url = URL.createObjectURL(asset.blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = asset.fileName || 'anh-tiep-nhan'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) {
      setError(returnError(failure))
    }
  }

  if (!attendance || !['requested', 'scheduled'].includes(record.status)) return null
  const pendingReview = attendance.reviewAccepted == null && !!attendance.reviewStartsAt && now >= Date.parse(attendance.reviewStartsAt)
  const beforeDeadline = !!record.inventoryRemovalDeadlineAt && now < Date.parse(record.inventoryRemovalDeadlineAt)

  async function submit(action: () => Promise<ApiReturn>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const updated = await action()
      setResult(updated.attendance)
      onChanged()
    } catch (failure) {
      setError(returnError(failure))
      onChanged()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <section className="space-y-3 rounded-xl border border-stone-200 p-4">
    <h4 className="font-semibold">Tiếp nhận và xác minh danh tính</h4>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {attendance.expiresAt && <p className="text-sm">Phiên xác minh đến {new Date(attendance.expiresAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · Đã thử {attendance.attempts}/2 lần.</p>}
    {attendance.verifiedAt && <p className="text-sm font-medium">Đã xác minh danh tính.</p>}
    {role === 'manager' && attendance.evidenceId && <Button type="button" variant="outline"
      onClick={() => void downloadEvidence(attendance.evidenceId!)}>Tải ảnh tiếp nhận</Button>}
    {pendingReview && <p role="status">Phiên đã kết thúc. Đang chờ Quản lý đối soát.</p>}
    {attendance.reviewAccepted != null && <p role="status">{attendance.reviewAccepted ? 'Quản lý đã cho phép tiếp tục bàn giao.' : 'Quản lý đã kết thúc đối soát và không tiếp tục bàn giao thường.'}</p>}
    {role === 'staff' && editable && !attendance.arrivedAt && beforeDeadline && <>
      <label className="block text-sm">Ảnh hiện trường chứng minh khách đã đến và sẵn sàng bàn giao
        <input className="block" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
          onChange={e => { setFile(e.target.files?.[0]); evidence.current = null }} />
      </label>
      <Button type="button" disabled={busy || !file} onClick={() => void submit(async () => {
        if (!file) throw new Error('Vui lòng chọn ảnh hiện trường.')
        evidence.current ??= (await uploadReturnEvidence(record.id, file, 'staff', 'tiep-nhan-tra-kho')).id
        return recordReturnArrival(record.id, evidence.current)
      })}>Ghi nhận khách đã đến</Button>
    </>}
    {role === 'staff' && editable && attendance.arrivedAt && !attendance.verifiedAt && !pendingReview && attendance.reviewAccepted == null && <>
      <label className="block text-sm">Số giấy tờ gốc của chính chủ
        <input className="block rounded border p-2" type="password" autoComplete="off" maxLength={32} value={document}
          disabled={busy} onChange={e => { setDocument(e.target.value); attempt.current = null }} />
      </label>
      <Button type="button" disabled={busy || !document.trim()} onClick={() => void submit(async () => {
        attempt.current ??= crypto.randomUUID()
        const updated = await verifyReturnIdentity(record.id, attempt.current, document.trim())
        attempt.current = null
        setDocument('')
        if (!updated.attendance?.verifiedAt) setError('Giấy tờ không khớp với hồ sơ đặt kho.')
        return updated
      })}>Đối chiếu giấy tờ</Button>
    </>}
    {role === 'manager' && editable && pendingReview && <>
      <label className="block text-sm">Kết luận và căn cứ đối soát
        <textarea className="block w-full rounded border p-2" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || !reason.trim() || !attendance.verifiedAt}
          onClick={() => void submit(() => reviewReturnArrival(record.id, true, reason.trim()))}>Cho tiếp tục bàn giao</Button>
        <Button type="button" variant="outline" disabled={busy || !reason.trim()}
          onClick={() => void submit(() => reviewReturnArrival(record.id, false, reason.trim()))}>Kết thúc đối soát</Button>
      </div>
    </>}
  </section>
}
