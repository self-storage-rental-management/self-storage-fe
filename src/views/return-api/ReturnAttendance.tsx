import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { apiDownload } from '../../services/apiClient'
import { getAuthenticatedActor } from '../../services/authApi'
import { listMaintenanceStaff } from '../../services/maintenanceApi'
import { parseVietnamDate } from '../../utils/vietnamTime'
import {
  reopenReturnVerification, returnError, reviewReturnArrival, uploadReturnEvidence, verifyReturnIdentity, type ApiReturn,
} from '../../services/returnApi'

export function requiresReturnAttendance(record: ApiReturn) {
  return !!record.attendance && record.sourceType !== 'RECOVERY'
    && ['requested', 'scheduled'].includes(record.status)
    && !(record.returnType === 'INVENTORY_MISMATCH' && record.setupReturnedAt)
}

export function isReturnIdentityReviewPending(record: ApiReturn, now: number) {
  const attendance = record.attendance
  return requiresReturnAttendance(record) && attendance?.reviewAccepted !== false
    && !!attendance?.reviewStartsAt && now >= Date.parse(attendance.reviewStartsAt)
}

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
  const [staffId, setStaffId] = useState('')
  const [appointment, setAppointment] = useState('')
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof listMaintenanceStaff>>>([])
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
  useEffect(() => {
    attempt.current = null
    setDocument('')
  }, [attendance?.reverificationStartedAt])
  const pendingReview = isReturnIdentityReviewPending({ ...record, attendance }, now)
  const handoverOverdue = pendingReview && attendance?.reviewAccepted === true
    && !!attendance.handoverDueAt && now >= Date.parse(attendance.handoverDueAt)
  const canReopen = pendingReview && !!attendance?.evidenceId && !attendance.verifiedAt && !attendance.reverificationStartedAt
  const canAssign = pendingReview && (!!attendance?.verifiedAt || canReopen)
  useEffect(() => {
    if (role !== 'manager' || !editable || !canAssign) return
    let active = true
    listMaintenanceStaff(record.facilityId).then(people => { if (active) setStaff(people) })
      .catch(failure => { if (active) setError(returnError(failure)) })
    return () => { active = false }
  }, [role, editable, canAssign, record.facilityId])

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

  if (!attendance || !requiresReturnAttendance(record)) return null
  const arrivalDeadline = record.returnType === 'INVENTORY_MISMATCH'
    ? record.inventoryRemovalDeadlineAt
    : record.recoveryEligibleAt
  const beforeDeadline = !arrivalDeadline || now < Date.parse(arrivalDeadline)
  const assignedToVerify = !attendance.reverificationStaffId || attendance.reverificationStaffId === getAuthenticatedActor()?.id
  const canEnterIdentity = role === 'staff' && editable && assignedToVerify && !attendance.verifiedAt
    && !pendingReview && attendance.reviewAccepted == null && (!!attendance.arrivedAt || beforeDeadline)
  const canVerify = canEnterIdentity && (!!attendance.arrivedAt || !!file) && !busy && !!document.trim()

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
    <h4 className="font-semibold">{role === 'manager' ? 'Tiếp nhận và xác minh danh tính' : 'Xác minh danh tính trả kho'}</h4>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {role === 'staff' && attendance.arrivedAt && <p className="text-sm">Đã ghi nhận khách đến lúc {new Date(attendance.arrivedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.</p>}
    {role === 'staff' && !attendance.arrivedAt && !beforeDeadline && <p role="status" className="text-sm">Đã hết hạn ghi nhận khách đến. Vui lòng kiểm tra hồ sơ thu hồi.</p>}
    {attendance.expiresAt && <p className="text-sm">Phiên xác minh đến {new Date(attendance.expiresAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · Đã thử {attendance.attempts}/2 lần.</p>}
    {attendance.reverificationStartedAt && !attendance.verifiedAt && !pendingReview && attendance.reviewAccepted == null && (
      <p className="text-sm">Quản lý đã mở phiên xác minh lại. {role === 'staff' && !assignedToVerify && 'Nhân viên được phân công sẽ đối chiếu giấy tờ.'}</p>
    )}
    {attendance.verifiedAt && <p className="text-sm font-medium">Đã xác minh danh tính.</p>}
    {role === 'manager' && attendance.handoverAppointmentAt && <p className="text-sm">Lịch bàn giao sau đối soát · {new Date(attendance.handoverAppointmentAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
    {attendance.handoverDueAt && <p className="text-sm">Hạn bàn giao sau đối soát · {new Date(attendance.handoverDueAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
    {role === 'manager' && attendance.evidenceId && <Button type="button" variant="outline"
      onClick={() => void downloadEvidence(attendance.evidenceId!)}>Tải ảnh tiếp nhận</Button>}
    {handoverOverdue
      ? <div role="status" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-900">
        <p className="font-semibold">Đã quá hạn bàn giao sau đối soát</p>
        <p>Hồ sơ đã quay lại chờ Quản lý rà soát. Bằng chứng khách đến đúng hạn được giữ lại.</p>
      </div>
      : pendingReview && <p role="status">Phiên đã kết thúc. Đang chờ Quản lý đối soát.</p>}
    {!handoverOverdue && attendance.reviewAccepted != null && <p role="status">{attendance.reviewAccepted ? 'Quản lý đã cho phép tiếp tục bàn giao.' : 'Quản lý đã kết thúc đối soát và không tiếp tục bàn giao thường.'}</p>}
    {canEnterIdentity && <form className="space-y-3"
      onSubmit={event => {
        event.preventDefault()
        if (!canVerify) return
        void submit(async () => {
          let evidenceId: string | undefined
          if (!attendance.arrivedAt && file) {
            evidence.current ??= (await uploadReturnEvidence(record.id, file, 'staff', 'tiep-nhan-tra-kho')).id
            evidenceId = evidence.current
          }
          attempt.current ??= crypto.randomUUID()
          const updated = await verifyReturnIdentity(record.id, attempt.current, document.trim(), attendance.reverificationStartedAt, evidenceId)
          attempt.current = null
          setDocument('')
          if (!updated.attendance?.verifiedAt) setError('Giấy tờ không khớp với hồ sơ đặt kho.')
          return updated
        })
      }}>
      {!attendance.arrivedAt && <label className="block text-sm">Ảnh hiện trường chứng minh khách đã đến và sẵn sàng bàn giao
        <input className="block" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy}
          onChange={e => { setFile(e.target.files?.[0]); evidence.current = null }} />
      </label>}
      <label className="block text-sm">Số CCCD trên giấy tờ gốc
        <input className="block rounded border p-2" type="password" autoComplete="off" maxLength={32} value={document}
          required disabled={busy} aria-describedby="return-identity-help"
          onChange={e => { setDocument(e.target.value); attempt.current = null }} />
      </label>
      <p id="return-identity-help" className="text-xs text-stone-600">
        Nhập CCCD 12 số hoặc số hộ chiếu đã dùng khi đặt kho.
      </p>
      <Button type="submit" disabled={!canVerify}>Xác minh danh tính</Button>
    </form>}
    {role === 'manager' && editable && pendingReview && <>
      <label className="block text-sm">Kết luận và căn cứ đối soát
        <textarea className="block w-full rounded border p-2" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />
      </label>
      {canAssign && <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Nhân viên phụ trách
          <select className="block w-full rounded border p-2" disabled={busy} value={staffId} onChange={e => setStaffId(e.target.value)}>
            <option value="">Chọn nhân viên</option>
            {staff.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
          </select>
        </label>
        {attendance.verifiedAt && <label className="block text-sm">Lịch khác nếu cần · giờ Việt Nam
          <input className="block w-full rounded border p-2" type="datetime-local" disabled={busy} value={appointment} onChange={e => setAppointment(e.target.value)} />
        </label>}
      </div>}
      <div className="flex flex-wrap gap-2">
        {canReopen && <Button type="button" disabled={busy || !reason.trim() || !staffId}
          onClick={() => void submit(() => reopenReturnVerification(record.id, staffId, reason.trim()))}>Mở lại phiên xác minh</Button>}
        {attendance.verifiedAt && <Button type="button" disabled={busy || !reason.trim() || !staffId}
          onClick={() => void submit(() => reviewReturnArrival(record.id, true, reason.trim(), staffId,
            appointment ? parseVietnamDate(appointment).toISOString() : undefined))}>Cho tiếp tục bàn giao</Button>}
        <Button type="button" variant="outline" disabled={busy || !reason.trim()}
          onClick={() => void submit(() => reviewReturnArrival(record.id, false, reason.trim()))}>Kết thúc đối soát</Button>
      </div>
    </>}
  </section>
}
