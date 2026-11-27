import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import VietnameseDateTimeField from '../../components/VietnameseDateTimeField'
import { apiDownload } from '../../services/apiClient'
import { getAuthenticatedActor } from '../../services/authApi'
import { listMaintenanceStaff } from '../../services/maintenanceApi'
import { parseVietnamDate, vietnamDateTimeInput } from '../../utils/vietnamTime'
import {
  recordReturnArrival,
  reopenReturnVerification,
  returnError,
  reviewReturnArrival,
  uploadReturnEvidence,
  verifyReturnIdentity,
  type ApiReturn,
} from '../../services/returnApi'
import { awaitsCustomerClearance } from './ReturnClearance'

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

const formatVn = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận'

export default function ReturnAttendance({ record, role, editable, onChanged }: {
  record: ApiReturn
  role: 'staff' | 'manager'
  editable: boolean
  onChanged: () => void
}) {
  const isMismatch = record.returnType === 'INVENTORY_MISMATCH'
  const [result, setResult] = useState<ApiReturn['attendance']>()
  const attendance = result ?? record.attendance
  const [now, setNow] = useState(Date.now)
  const [file, setFile] = useState<File>()
  const [document, setDocument] = useState('')
  const [lateMode, setLateMode] = useState(false)
  const [actualArrivedAt, setActualArrivedAt] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
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
  useEffect(() => {
    setLateMode(false)
    setActualArrivedAt('')
    setEvidenceNote('')
    setFile(undefined)
    evidence.current = null
  }, [record.id])

  const pendingReview = isReturnIdentityReviewPending({ ...record, attendance }, now)
  const handoverOverdue = pendingReview && attendance?.reviewAccepted === true
    && !!attendance.handoverDueAt && now >= Date.parse(attendance.handoverDueAt)
  const preArrivalReview = isMismatch && !attendance?.arrivedAt && attendance?.reviewStatus === 'PENDING'
  const canReopen = pendingReview && !preArrivalReview && !attendance?.verifiedAt && !attendance?.reverificationStartedAt
    && (!!attendance?.evidenceId || (isMismatch && !!attendance?.arrivedAt && !!attendance?.recordedAt))
  const canAssign = pendingReview && (!!attendance?.verifiedAt || canReopen || preArrivalReview)

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

  const arrivalDeadline = isMismatch
    ? record.inventoryRemovalDeadlineAt
    : record.recoveryEligibleAt
  const beforeDeadline = !arrivalDeadline || now < Date.parse(arrivalDeadline)
  const assignedToVerify = !attendance.reverificationStaffId || attendance.reverificationStaffId === getAuthenticatedActor()?.id

  // For INVENTORY_MISMATCH, arrival capture is separated from identity verification.
  const canRecordMismatchArrival = isMismatch && role === 'staff' && editable && !attendance.arrivedAt
    && !pendingReview && attendance.reviewStatus !== 'PENDING' && attendance.reviewAccepted == null
  const canEnterIdentity = role === 'staff' && editable && assignedToVerify && !attendance.verifiedAt
    && !pendingReview && attendance.reviewAccepted == null
    && (isMismatch ? !!attendance.arrivedAt : (!!attendance.arrivedAt || beforeDeadline))
  const clearancePending = awaitsCustomerClearance(record)
  const canVerify = canEnterIdentity && !clearancePending
    && (isMismatch || !!attendance.arrivedAt || !!file)
    && !busy && !!document.trim()

  const lateArrivalClaimedBeforeDeadline = Boolean(
    attendance.lateArrivalClaimedAt
    && (!arrivalDeadline || Date.parse(attendance.lateArrivalClaimedAt) < Date.parse(arrivalDeadline)),
  )

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
    <h4 className="font-semibold">{role === 'manager' ? 'Tiếp nhận và xác minh danh tính' : 'Tiếp nhận và xác minh danh tính trả kho'}</h4>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

    {isMismatch && record.scheduledAppointmentAt && (
      <p className="text-sm text-stone-700">Lịch hẹn bàn giao của khách · <strong>{formatVn(record.scheduledAppointmentAt)}</strong></p>
    )}
    {isMismatch && arrivalDeadline && (
      <p className="text-sm text-stone-700">Hạn cuối dọn hàng · <strong>{formatVn(arrivalDeadline)}</strong></p>
    )}

    {isMismatch && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      <p>Thời hạn trả kho đã chốt: {record.returnWindowDays != null ? `${record.returnWindowDays} ngày` : 'Chưa có thông tin'}.</p>
      <p>Gia hạn mỗi lần tối đa: {record.returnExtensionDays != null ? `${record.returnExtensionDays} ngày` : 'Chưa có thông tin'} · Đã gia hạn {record.returnExtensionCount ?? 0}/{record.maxReturnExtensions ?? 2} lần.</p>
    </div>}

    {attendance.arrivedAt && (
      <div className="space-y-1 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-800">
        <p>Đã xác nhận khách đến lúc <strong>{formatVn(attendance.arrivedAt)}</strong>.</p>
        {attendance.recordedAt && (
          <p className="text-xs text-stone-600">Thời điểm thao tác ghi nhận lên hệ thống: {formatVn(attendance.recordedAt)}</p>
        )}
        {attendance.evidenceNote && (
          <p className="text-xs text-stone-700">Bằng chứng ghi nhận: {attendance.evidenceNote}</p>
        )}
        {attendance.reviewReason && (
          <p className="text-xs text-stone-700">Kết luận đối soát của Quản lý: {attendance.reviewReason}</p>
        )}
      </div>
    )}

    {!isMismatch && role === 'staff' && !attendance.arrivedAt && !beforeDeadline && (
      <p role="status" className="text-sm">Đã hết hạn ghi nhận khách đến. Vui lòng kiểm tra hồ sơ thu hồi.</p>
    )}

    {attendance.expiresAt && (
      <p className="text-sm">Phiên xác minh đến {formatVn(attendance.expiresAt)} · Đã thử {attendance.attempts}/2 lần.</p>
    )}
    {attendance.reverificationStartedAt && !attendance.verifiedAt && !pendingReview && attendance.reviewAccepted == null && (
      <p className="text-sm">Quản lý đã mở phiên xác minh. {role === 'staff' && !assignedToVerify && 'Nhân viên được phân công sẽ đối chiếu giấy tờ.'}</p>
    )}
    {attendance.verifiedAt && <p className="text-sm font-medium text-emerald-800">Đã xác minh danh tính.</p>}
    {role === 'manager' && attendance.handoverAppointmentAt && <p className="text-sm">Lịch bàn giao sau đối soát · {formatVn(attendance.handoverAppointmentAt)}</p>}
    {attendance.handoverDueAt && <p className="text-sm">Hạn bàn giao sau đối soát · {formatVn(attendance.handoverDueAt)}</p>}
    {role === 'manager' && attendance.evidenceId && (
      <Button type="button" variant="outline" onClick={() => void downloadEvidence(attendance.evidenceId!)}>
        Tải ảnh tiếp nhận
      </Button>
    )}

    {preArrivalReview && (
      <div role="status" className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-semibold">Đang chờ Quản lý đối soát lượt đến trả kho</p>
        <p>Thời điểm khách đến thực tế được ghi nhận: <strong>{formatVn(attendance.lateArrivalClaimedAt)}</strong> ({lateArrivalClaimedBeforeDeadline ? 'trong hạn cuối dọn hàng' : 'sau hạn cuối dọn hàng'})</p>
        <p className="text-xs">Thời điểm nhân viên gửi ghi nhận lên hệ thống: {formatVn(attendance.recordedAt)}</p>
        {attendance.evidenceNote && <p className="text-xs">Bằng chứng nhân viên ghi nhận: {attendance.evidenceNote}</p>}
      </div>
    )}

    {!preArrivalReview && (handoverOverdue
      ? <div role="status" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-900">
        <p className="font-semibold">Đã quá hạn bàn giao sau đối soát</p>
        <p>Hồ sơ đã quay lại chờ Quản lý rà soát. Bằng chứng khách đến đúng hạn được giữ lại.</p>
      </div>
      : pendingReview && <p role="status">Phiên đã kết thúc. Đang chờ Quản lý đối soát.</p>)}

    {!handoverOverdue && attendance.reviewAccepted != null && (
      <p role="status">{attendance.reviewAccepted ? 'Quản lý đã cho phép tiếp tục bàn giao.' : 'Quản lý đã kết thúc đối soát và không tiếp tục bàn giao thường.'}</p>
    )}

    {canRecordMismatchArrival && (
      <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-stone-900">Bước 1 · Ghi nhận khách đến trả kho</p>
          {beforeDeadline && (
            <label className="flex items-center gap-1.5 text-xs text-stone-700">
              <input
                type="checkbox"
                checked={lateMode}
                disabled={busy}
                onChange={e => setLateMode(e.target.checked)}
              />
              Ghi nhận muộn / bổ sung bằng chứng
            </label>
          )}
        </div>

        {beforeDeadline && !lateMode && (
          <div className="space-y-2">
            <p className="text-xs text-stone-600">
              Bấm ghi nhận ngay khi khách có mặt. Máy chủ sẽ lưu chính xác thời điểm tiếp nhận trước khi bạn nhập giấy tờ xác minh.
            </p>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void submit(async () => {
                let evidenceId: string | undefined
                if (file) {
                  evidence.current ??= (await uploadReturnEvidence(record.id, file, 'staff', 'tiep-nhan-tra-kho')).id
                  evidenceId = evidence.current
                }
                return recordReturnArrival(record.id, {
                  evidenceId,
                  evidenceNote: evidenceNote.trim() || undefined,
                  expectedVersion: record.returnVersion,
                })
              })}
            >
              Ghi nhận khách đến
            </Button>
          </div>
        )}

        {(!beforeDeadline || lateMode) && (
          <form
            className="space-y-3"
            onSubmit={event => {
              event.preventDefault()
              const trimmedNote = evidenceNote.trim()
              if (!trimmedNote && !file) {
                setError('Ghi nhận đến muộn hoặc sau hạn bắt buộc phải có ghi chú bằng chứng hoặc ảnh hiện trường.')
                return
              }
              void submit(async () => {
                let evidenceId: string | undefined
                if (file) {
                  evidence.current ??= (await uploadReturnEvidence(record.id, file, 'staff', 'tiep-nhan-tra-kho')).id
                  evidenceId = evidence.current
                }
                const arrivedIso = actualArrivedAt ? new Date(`${actualArrivedAt}:00+07:00`).toISOString() : undefined
                return recordReturnArrival(record.id, {
                  actualArrivedAt: arrivedIso,
                  evidenceNote: trimmedNote || undefined,
                  evidenceId,
                  expectedVersion: record.returnVersion,
                })
              })
            }}
          >
            {!beforeDeadline && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
                Đã quá hạn cuối dọn hàng. Nhân viên không tự ghi nhận thành đến đúng hạn; vui lòng nhập thời điểm khách đến thực tế và bằng chứng để chuyển Quản lý đối soát.
              </p>
            )}
            <VietnameseDateTimeField
              label="Thời điểm khách đến thực tế (giờ Việt Nam)"
              value={actualArrivedAt}
              maxDateTime={vietnamDateTimeInput(now)}
              disabled={busy}
              onChange={setActualArrivedAt}
            />
            <label className="block text-xs font-medium text-stone-700">
              Ghi chú bằng chứng có mặt (bắt buộc)
              <textarea
                className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm"
                rows={2}
                maxLength={500}
                required
                disabled={busy}
                value={evidenceNote}
                onChange={e => setEvidenceNote(e.target.value)}
                placeholder="Ví dụ: Khách có mặt tại quầy lễ tân lúc 23:55 ngày 28/11, đã ký sổ tiếp nhận..."
              />
            </label>
            <label className="block text-xs font-medium text-stone-700">
              Ảnh hiện trường / bằng chứng (tùy chọn)
              <input
                className="mt-1 block text-xs"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={e => { setFile(e.target.files?.[0]); evidence.current = null }}
              />
            </label>
            <Button type="submit" disabled={busy || !evidenceNote.trim()}>
              {beforeDeadline ? 'Gửi ghi nhận đến muộn cho Quản lý đối soát' : 'Chuyển Quản lý đối soát lượt đến'}
            </Button>
          </form>
        )}
      </div>
    )}

    {canEnterIdentity && <form className="space-y-3"
      onSubmit={event => {
        event.preventDefault()
        if (!canVerify) return
        void submit(async () => {
          let evidenceId: string | undefined
          if ((!attendance.arrivedAt || (isMismatch && !attendance.evidenceId)) && file) {
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
      {isMismatch && <p className="text-sm font-semibold text-stone-900">Bước 2 · Xác minh danh tính</p>}
      {(!attendance.arrivedAt || (isMismatch && !attendance.evidenceId)) && (
        <label className="block text-sm">
          {isMismatch ? 'Ảnh hiện trường khi tiếp nhận (tùy chọn nếu đã có)' : 'Ảnh hiện trường chứng minh khách đã đến và sẵn sàng bàn giao'}
          <input className="block" type="file" accept="image/jpeg,image/png,image/webp" required={!isMismatch && !attendance.arrivedAt} disabled={busy || clearancePending}
            onChange={e => { setFile(e.target.files?.[0]); evidence.current = null }} />
        </label>
      )}
      <label className="block text-sm">Số CCCD trên giấy tờ gốc
        <input className="block rounded border p-2" type="password" autoComplete="off" maxLength={32} value={document}
          required disabled={busy || clearancePending} aria-describedby="return-identity-help"
          onChange={e => { setDocument(e.target.value); attempt.current = null }} />
      </label>
      <p id="return-identity-help" className="text-xs text-stone-600">
        {clearancePending ? 'Chờ khách xác nhận đã dọn kho để xác minh danh tính.' : 'Nhập CCCD 12 số hoặc số hộ chiếu đã dùng khi đặt kho.'}
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
        {preArrivalReview && lateArrivalClaimedBeforeDeadline && (
          <Button type="button" disabled={busy || !reason.trim() || !staffId}
            onClick={() => void submit(() => reviewReturnArrival(record.id, true, reason.trim(), staffId, undefined, 'APPROVED_ON_TIME'))}>
            Chấp nhận đến đúng hạn &amp; mở xác minh
          </Button>
        )}
        {preArrivalReview && !lateArrivalClaimedBeforeDeadline && (
          <Button type="button" disabled={busy || !reason.trim() || !staffId}
            onClick={() => void submit(() => reviewReturnArrival(record.id, true, reason.trim(), staffId, undefined, 'FACILITY_EXCEPTION'))}>
            Chấp nhận xử lý ngoại lệ &amp; mở xác minh
          </Button>
        )}
        {canReopen && <Button type="button" disabled={busy || !reason.trim() || !staffId}
          onClick={() => void submit(() => reopenReturnVerification(record.id, staffId, reason.trim()))}>Mở lại phiên xác minh</Button>}
        {attendance.verifiedAt && <Button type="button" disabled={busy || !reason.trim() || !staffId}
          onClick={() => void submit(() => reviewReturnArrival(record.id, true, reason.trim(), staffId,
            appointment ? parseVietnamDate(appointment).toISOString() : undefined,
            attendance.reviewStatus === 'FACILITY_EXCEPTION' ? 'FACILITY_EXCEPTION' : 'APPROVED_ON_TIME'))}>Cho tiếp tục bàn giao</Button>}
        <Button type="button" variant="outline" disabled={busy || !reason.trim()}
          onClick={() => void submit(() => reviewReturnArrival(record.id, false, reason.trim(), undefined, undefined, 'CONFIRMED_ABSENT'))}>Kết thúc đối soát</Button>
      </div>
    </>}
  </section>
}
