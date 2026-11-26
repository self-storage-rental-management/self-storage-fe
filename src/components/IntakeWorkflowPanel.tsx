import { useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient'
import { uploadCheckInEvidence } from '../services/checkInApi'
import VietnameseDateInput from './VietnameseDateInput'
import { Badge, Button } from './ui'
import { canResolveAttendanceReview } from '../domain/intakePermissions'

interface VerificationAttemptView {
  attemptNumber?: number | null
  outcome: string
  recordedAt: string
  reason?: string | null
}

interface State {
  policyVersion?: string | null
  receivedAt?: string | null
  originalDeadlineAt?: string | null
  arrivalDeadlineAt?: string | null
  setupCutoffAt?: string | null
  setupDeadlineAt?: string | null
  setupExtensionDays?: number | null
  extensionMaxHours?: number | null
  maxExtensions?: number | null
  setupExtensionCount?: number | null
  readyAt?: string | null
  appointmentAt?: string | null
  appointmentStatus?: string | null
  appointmentVersion?: number | null
  actualArrivedAt?: string | null
  arrivalRecordedAt?: string | null
  arrivedAt?: string | null
  attendanceReviewDeadlineAt?: string | null
  attendanceReviewStatus?: string | null
  firstIdentityVerificationAt?: string | null
  inspectionClockStartedAt?: string | null
  inspectionCompletionDeadlineAt?: string | null
  verificationAttemptCount?: number | null
  maxVerificationAttempts?: number | null
  verificationStatus?: string | null
  identityVerifiedAt?: string | null
  inspectionStartedAt?: string | null
  inspectionCompletedAt?: string | null
  inspectionFailureReason?: string | null
  interruptionReason?: string | null
  exceptionDueAt?: string | null
  exceptionReason?: string | null
  inventoryDeadlineAt?: string | null
  remainderDeadlineAt?: string | null
  resultConfirmationDueAt?: string | null
  intakeVersion?: number | null
  verificationAttempts?: VerificationAttemptView[]
  history: Array<{ action: string; time: string; before?: string | null; after?: string | null; reason?: string | null }>
}

const show = (s?: string | null) =>
  s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa đặt'

function vietnamDateTimeInput(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function VietnameseDateTimeField({
  value,
  onChange,
  minDate,
  maxDate,
  minDateTime,
  maxDateTime,
  label = 'Ngày hẹn (dd/mm/yyyy)',
}: {
  value: string
  onChange: (next: string) => void
  minDate?: string
  maxDate?: string
  minDateTime?: string
  maxDateTime?: string
  label?: string
}) {
  const effectiveMinDate = minDate ?? minDateTime?.slice(0, 10)
  const effectiveMaxDate = maxDate ?? maxDateTime?.slice(0, 10)
  const [datePart, timePart] = value ? value.split('T') : ['', '']
  const [rawHour, rawMinute] = timePart ? timePart.split(':') : ['09', '00']

  const allowedHoursFor = (d: string) => {
    const minH = minDateTime && d === minDateTime.slice(0, 10) ? minDateTime.slice(11, 13) : '00'
    const maxH = maxDateTime && d === maxDateTime.slice(0, 10) ? maxDateTime.slice(11, 13) : '23'
    return HOURS_24.filter(h => h >= minH && h <= maxH)
  }

  const allowedMinutesFor = (d: string, h: string) => {
    const minM = minDateTime && d === minDateTime.slice(0, 10) && h === minDateTime.slice(11, 13)
      ? minDateTime.slice(14, 16)
      : '00'
    const maxM = maxDateTime && d === maxDateTime.slice(0, 10) && h === maxDateTime.slice(11, 13)
      ? maxDateTime.slice(14, 16)
      : '59'
    return MINUTES_60.filter(m => m >= minM && m <= maxM)
  }

  const allowedHours = datePart ? allowedHoursFor(datePart) : HOURS_24
  const hour = allowedHours.includes(rawHour) ? rawHour : (allowedHours[0] ?? rawHour)
  const allowedMinutes = datePart ? allowedMinutesFor(datePart, hour) : MINUTES_60
  const minute = allowedMinutes.includes(rawMinute) ? rawMinute : (allowedMinutes[0] ?? rawMinute)

  const update = (nextDate: string, nextHour: string, nextMinute: string) => {
    if (!nextDate) {
      onChange('')
      return
    }
    const hrs = allowedHoursFor(nextDate)
    const h = hrs.includes(nextHour) ? nextHour : (hrs[0] ?? nextHour ?? '09')
    const mins = allowedMinutesFor(nextDate, h)
    const m = mins.includes(nextMinute) ? nextMinute : (mins[0] ?? nextMinute ?? '00')
    onChange(`${nextDate}T${h}:${m}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[11rem] flex-1">
        <VietnameseDateInput
          label={label}
          value={datePart || ''}
          min={effectiveMinDate}
          max={effectiveMaxDate}
          onChange={nextDate => update(nextDate, hour || '09', minute || '00')}
        />
      </div>
      <div className="flex items-end gap-1">
        <label className="block text-xs font-medium text-stone-700">
          Giờ
          <select
            aria-label="Giờ hẹn"
            className="mt-1 block rounded-lg border border-stone-300 bg-white px-2 py-2.5 text-sm text-stone-900"
            value={hour}
            onChange={e => update(datePart, e.target.value, minute)}
          >
            {allowedHours.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <span className="pb-2.5 font-semibold text-stone-500">:</span>
        <label className="block text-xs font-medium text-stone-700">
          Phút
          <select
            aria-label="Phút hẹn"
            className="mt-1 block rounded-lg border border-stone-300 bg-white px-2 py-2.5 text-sm text-stone-900"
            value={minute}
            onChange={e => update(datePart, hour, e.target.value)}
          >
            {allowedMinutes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

function formatRemaining(remainingMs: number | null): { text: string; urgent: boolean; expired: boolean } | null {
  if (remainingMs == null || !Number.isFinite(remainingMs)) return null
  if (remainingMs <= 0) return { text: 'Đã quá hạn', urgent: true, expired: true }
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const urgent = remainingMs < 86_400_000
  if (days >= 3) return { text: `Còn ${days} ngày`, urgent, expired: false }
  if (days >= 1) return { text: hours > 0 ? `Còn ${days} ngày ${hours} giờ` : `Còn ${days} ngày`, urgent, expired: false }
  if (hours >= 1) return { text: `Còn ${hours} giờ`, urgent, expired: false }
  return { text: `Còn ${totalMinutes} phút`, urgent, expired: false }
}

function appointmentBadge(status?: string | null): { label: string; variant: string } {
  switch (status) {
    case 'ACTIVE': return { label: 'Đã đặt lịch', variant: 'success' }
    case 'NOT_READY': return { label: 'Đã hủy do chưa chuẩn bị xong', variant: 'warning' }
    case 'MISSED': return { label: 'Đã bỏ lỡ lịch', variant: 'error' }
    case 'ATTENDED': return { label: 'Đã có mặt', variant: 'success' }
    case 'CANCELLED': return { label: 'Đã hủy', variant: 'muted' }
    default: return { label: 'Chưa đặt lịch', variant: 'muted' }
  }
}

function verificationStatusLabel(status?: string | null, inspectionCompletedAt?: string | null) {
  if (inspectionCompletedAt) return 'Đã hoàn tất kiểm kê'
  switch (status) {
    case 'IN_PROGRESS': return 'Chờ xác minh lại (lần 1 chưa đạt)'
    case 'PASSED': return 'Đã xác minh danh tính · Chờ kiểm kê hàng hóa'
    case 'FAILED_MAX_ATTEMPTS': return 'Không đạt sau 2 lần xác minh'
    default: return 'Chưa xác minh'
  }
}

function attemptOutcomeLabel(outcome: string) {
  switch (outcome) {
    case 'PASS': return 'Đạt'
    case 'FAIL': return 'Chưa đạt'
    case 'TECH_ERROR': return 'Lỗi kỹ thuật'
    default: return outcome
  }
}

function historyActionLabel(action: string) {
  switch (action) {
    case 'COMPLETE_SETUP': return 'Báo chuẩn bị hàng xong'
    case 'APPOINTMENT': return 'Cập nhật lịch kiểm kê'
    case 'EXTEND_SETUP': return 'Gia hạn thời gian đến kiểm kê'
    case 'ARRIVAL': return 'Ghi nhận khách đã đến'
    case 'VERIFY': return 'Xác minh danh tính'
    case 'VERIFY_TECH_ERROR': return 'Sự cố kỹ thuật khi xác minh'
    case 'MARK_MISSED': return 'Ghi nhận bỏ lỡ lịch hẹn'
    case 'RESOLVE_REVIEW': return 'Kết luận đối soát'
    case 'INTERRUPT_INSPECTION': return 'Ghi nhận gián đoạn kiểm kê'
    case 'COMPLETE_INSPECTION': return 'Hoàn tất kiểm kê'
    case 'FACILITY_EXTENSION': return 'Điều chỉnh hạn do cơ sở'
    default: return 'Gửi nhắc nhở'
  }
}

export default function IntakeWorkflowPanel({
  reservationId,
  role,
  checkInId,
  statusSignal,
  mode = 'full',
  hideCompleteSetupButton = false,
  onUpdated,
}: {
  reservationId: string
  role: 'CUSTOMER' | 'STAFF' | 'MANAGER' | 'BUSINESS'
  checkInId?: string | null
  statusSignal?: string | null
  mode?: 'full' | 'setup' | 'inspection' | 'staff-visit'
  hideCompleteSetupButton?: boolean
  onUpdated?: () => void
}) {
  const [state, setState] = useState<State | null>(null)
  const [at, setAt] = useState('')
  const [reason, setReason] = useState('')
  const [extensionDays, setExtensionDays] = useState('')
  const [document, setDocument] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [verifyOutcome, setVerifyOutcome] = useState<'PASS' | 'FAIL' | 'TECH_ERROR'>('PASS')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const url = `/api/intake-workflow/reservations/${encodeURIComponent(reservationId)}`
  useEffect(() => {
    let active = true
    const load = () => apiRequest<{ data: State }>(url).then(r => {
      if (active) setState(old => JSON.stringify(old) === JSON.stringify(r.data) ? old : r.data)
    }).catch(() => {})
    void load()
    const timer = window.setInterval(() => { setNow(Date.now()); void load() }, 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [url, statusSignal])

  const change = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true); setError('')
    try {
      let photoId: string | undefined
      if (action === 'VERIFY' && verifyOutcome === 'PASS') {
        if (!photo || !checkInId) throw new Error('Thiếu ảnh kiểm kê.')
        photoId = (await uploadCheckInEvidence(checkInId, photo, 'CHECK_IN_IDENTITY', 'anh-doi-chieu-khach-luc-kiem-ke')).id
      }
      const needsDate = ['APPOINTMENT', 'FACILITY_EXTENSION'].includes(action)
      if (needsDate && !at) throw new Error('Vui lòng chọn ngày giờ.')
      const body: Record<string, unknown> = {
        action,
        at: needsDate ? new Date(`${at}:00+07:00`).toISOString() : undefined,
        reason,
        documentNumber: document,
        photoId,
        extensionDays: action === 'EXTEND_SETUP'
          ? maxDaysPerExtension
          : (extensionDays ? Number(extensionDays) : undefined),
        expectedVersion: state?.intakeVersion ?? undefined,
        ...extra,
      }
      if (action === 'EXTEND_SETUP' && state?.appointmentStatus === 'ACTIVE' && state.appointmentAt) {
        body.keepAppointment = true
      }
      if (action === 'VERIFY') {
        body.outcome = verifyOutcome
      }
      if (action === 'ARRIVAL' && evidenceNote.trim()) {
        body.evidenceNote = evidenceNote.trim()
      }
      const result = await apiRequest<{ data: State }>(url, { method: 'POST', body: JSON.stringify(body) })
      setState(result.data)
      if (action === 'APPOINTMENT') setAt('')
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Chưa thể cập nhật. Vui lòng kiểm tra lại thời hạn, số lượt gia hạn hoặc lịch hẹn.')
    } finally { setBusy(false) }
  }

  if (!state) return null

  const arrivalDeadline = state.arrivalDeadlineAt || state.inventoryDeadlineAt || state.setupDeadlineAt
  const setupCutoff = state.setupCutoffAt
  const maxExtensions = state.maxExtensions ?? 2
  const usedExtensions = state.setupExtensionCount ?? 0
  const remainingExtensions = Math.max(0, maxExtensions - usedExtensions)
  const maxDaysPerExtension = Math.max(1, Math.floor((state.extensionMaxHours ?? (state.setupExtensionDays ?? 1) * 24) / 24))
  const inspectionClockStartedAt = state.inspectionClockStartedAt || state.firstIdentityVerificationAt
  // The 72h window is anchored on the customer arrival confirmation, not on identity verification.
  const clockStarted = Boolean(inspectionClockStartedAt)
  const verificationCount = state.verificationAttemptCount ?? 0
  const verificationLimit = state.maxVerificationAttempts ?? 2
  const verificationLocked = state.verificationStatus === 'PASSED'
    || state.verificationStatus === 'FAILED_MAX_ATTEMPTS'
    || verificationCount >= verificationLimit
  // Attendance review and facility deadline changes are Manager-only in the backend.
  const isManager = canResolveAttendanceReview(role)

  const activeDeadline = clockStarted
    ? (state.inspectionCompletionDeadlineAt || state.remainderDeadlineAt || state.resultConfirmationDueAt)
    : arrivalDeadline
  const remaining = formatRemaining(activeDeadline ? Date.parse(activeDeadline) - now : null)
  const minimumDateTime = vietnamDateTimeInput(Math.ceil(now / 60_000) * 60_000)
  const minimumDate = minimumDateTime.slice(0, 10)
  const readyAtMs = state.readyAt ? Date.parse(state.readyAt) : null
  const minAppointmentAnchorMs = readyAtMs && Number.isFinite(readyAtMs) ? Math.max(now, readyAtMs) : now
  const minAppointmentDateTime = vietnamDateTimeInput(Math.ceil((minAppointmentAnchorMs + 6 * 3_600_000) / 60_000) * 60_000)
  const minAppointmentDate = minAppointmentDateTime.slice(0, 10)
  const maxAppointmentDateTime = arrivalDeadline ? vietnamDateTimeInput(Date.parse(arrivalDeadline)) : undefined
  const maxAppointmentDate = maxAppointmentDateTime ? maxAppointmentDateTime.slice(0, 10) : undefined
  const selectedDateTimeIsPast = Boolean(at && at < minimumDateTime)
  const selectedAppointmentOutOfRange = Boolean(
    at && (at < minAppointmentDateTime || (maxAppointmentDateTime && at > maxAppointmentDateTime)),
  )
  const apptBadge = appointmentBadge(state.appointmentStatus)
  const previewExtendedDeadline = arrivalDeadline
    ? show(new Date(Date.parse(arrivalDeadline) + maxDaysPerExtension * 86_400_000).toISOString())
    : null

  if (mode === 'setup') {
    if (!setupCutoff || clockStarted || state.readyAt) return null
    const setupRemaining = formatRemaining(Date.parse(setupCutoff) - now)
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3.5 py-2.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-stone-500">Hạn báo đưa hàng vào xong</span>
          {setupRemaining && (
            <Badge variant={setupRemaining.expired ? 'error' : setupRemaining.urgent ? 'warning' : 'muted'}>
              {setupRemaining.text}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 font-semibold text-stone-900">{show(setupCutoff)}</p>
        <p className="mt-0.5 text-[11px] text-stone-500">Cần xác nhận trước giờ hẹn kiểm kê (hoặc hạn đến kiểm kê) tối thiểu 6 giờ.</p>
      </div>
    )
  }

  if (mode === 'staff-visit') {
    const visitRemaining = formatRemaining(
      (clockStarted ? state.inspectionCompletionDeadlineAt : arrivalDeadline)
        ? Date.parse((clockStarted ? state.inspectionCompletionDeadlineAt : arrivalDeadline)!) - now
        : null,
    )
    return (
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-left text-sm text-stone-800">
        {clockStarted ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-stone-900">Thời hạn hoàn tất kiểm kê (72 giờ)</h4>
                <Badge variant={state.inspectionCompletedAt ? 'success' : state.verificationStatus === 'FAILED_MAX_ATTEMPTS' ? 'error' : 'warning'}>
                  {state.inspectionCompletedAt
                    ? 'Đã hoàn tất kiểm kê'
                    : state.verificationStatus === 'PASSED'
                      ? 'Chờ kiểm kê hàng hóa'
                      : verificationStatusLabel(state.verificationStatus, state.inspectionCompletedAt)}
                </Badge>
              </div>
              {visitRemaining && !state.inspectionCompletedAt && (
                <Badge variant={visitRemaining.expired ? 'error' : visitRemaining.urgent ? 'warning' : 'muted'}>
                  {visitRemaining.text}
                </Badge>
              )}
            </div>
            <p className="text-xs text-stone-600">
              {state.inspectionCompletedAt
                ? 'Buổi kiểm kê hàng hóa đã hoàn tất trong thời hạn 72 giờ kể từ khi xác nhận khách đến.'
                : state.verificationStatus === 'PASSED'
                  ? `Thời hạn 72 giờ hoàn tất kiểm kê được tính từ lúc xác nhận khách đến (${show(inspectionClockStartedAt)}). Nhân viên cần hoàn tất kiểm kê hàng hóa trước hạn chót bên dưới.`
                  : state.verificationStatus === 'FAILED_MAX_ATTEMPTS'
                    ? 'Khách đã hết 2 lần xác minh danh tính. Hồ sơ chuyển xử lý không đạt kiểm kê.'
                    : `Thời hạn 72 giờ hoàn tất kiểm kê đã bắt đầu tính từ lúc xác nhận khách đến (${show(inspectionClockStartedAt)}). Cần xác minh danh tính và hoàn tất kiểm kê trước hạn chót bên dưới.`}
            </p>
            <dl className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
                <dt className="text-xs text-stone-500">Bắt đầu tính giờ kiểm kê</dt>
                <dd className="mt-0.5 font-semibold text-stone-900">{show(inspectionClockStartedAt)}</dd>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
                <dt className="text-xs text-stone-500">Hạn hoàn tất (72 giờ)</dt>
                <dd className="mt-0.5 font-semibold text-stone-900">{show(state.inspectionCompletionDeadlineAt)}</dd>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
                <dt className="text-xs text-stone-500">Xác minh danh tính</dt>
                <dd className="mt-0.5 font-semibold text-stone-900">
                  {state.verificationStatus === 'PASSED'
                    ? `Đạt (lần ${verificationCount}/${verificationLimit})`
                    : `${verificationCount}/${verificationLimit} lần`}
                </dd>
              </div>
            </dl>
            {state.verificationAttempts && (state.verificationAttempts.length > 1 || state.verificationStatus !== 'PASSED') && (
              <ul className="space-y-1 border-t border-stone-200 pt-2 text-xs text-stone-600">
                {state.verificationAttempts.map((a, idx) => (
                  <li key={idx}>
                    {a.attemptNumber ? `Lần ${a.attemptNumber}` : 'Sự cố kỹ thuật'} · {attemptOutcomeLabel(a.outcome)} · {show(a.recordedAt)}
                    {a.reason ? ` (${a.reason})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-stone-500">Hạn đến kiểm kê: </span>
              <b className="text-stone-900">{show(arrivalDeadline)}</b>
            </div>
            {visitRemaining && (
              <Badge variant={visitRemaining.expired ? 'error' : visitRemaining.urgent ? 'warning' : 'muted'}>
                {visitRemaining.text}
              </Badge>
            )}
          </div>
        )}

        {state.attendanceReviewStatus === 'PENDING' && (
          <div className="space-y-2.5 rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-amber-950">Đối soát khách đến phút cuối (quá hạn 30 phút)</span>
              <Badge variant="warning">Chờ đối soát</Badge>
            </div>
            <p className="text-stone-600">
              Đơn hàng đã quá hạn đến kiểm kê nhưng còn trong khung đối soát 30 phút (Hạn đối soát: {show(state.attendanceReviewDeadlineAt)}).
              {isManager
                ? 'Quản lý có thể xác nhận khách đến để tiếp tục xác minh & kiểm kê ngay, hoặc chốt vắng mặt.'
                : 'Đang chờ Quản lý kết luận đối soát. Nhân viên chưa thể tiếp tục xác minh và kiểm kê.'}
            </p>
            {/* Only a Manager may conclude the attendance review; the backend rejects Staff. */}
            {isManager && (
              <>
                <input
                  className="block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                  placeholder="Lý do / bằng chứng đối soát (bắt buộc khi duyệt đúng hạn hoặc ngoại lệ)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={busy || !reason.trim()}
                    onClick={() => void change('RESOLVE_REVIEW', { outcome: 'APPROVED_ON_TIME' })}
                  >
                    Chấp nhận đến đúng hạn
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void change('RESOLVE_REVIEW', { outcome: 'CONFIRMED_ABSENT' })}
                  >
                    Xác nhận vắng mặt
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !reason.trim()}
                    onClick={() => void change('RESOLVE_REVIEW', { outcome: 'FACILITY_EXCEPTION' })}
                  >
                    Ngoại lệ cơ sở
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {!state.arrivedAt && !state.actualArrivedAt && state.appointmentStatus === 'ACTIVE' && (
          <div className="border-t border-stone-200 pt-2">
            <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void change('MARK_MISSED')}>
              Xác nhận bỏ lỡ lịch
            </Button>
          </div>
        )}

        {(state.arrivedAt || state.actualArrivedAt) && !verificationLocked && state.verificationStatus === 'IN_PROGRESS' && (
          <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
            <p className="font-semibold text-stone-900">Xác minh danh tính lại (Lần {verificationCount + 1}/{verificationLimit})</p>
            <label className="block">
              Kết quả đối chiếu
              <select className="ml-2 rounded-lg border border-stone-300 bg-white px-2 py-1" value={verifyOutcome} onChange={e => setVerifyOutcome(e.target.value as 'PASS' | 'FAIL' | 'TECH_ERROR')}>
                <option value="PASS">Đạt — Đúng người đặt kho</option>
                <option value="FAIL">Không đạt — Sai giấy tờ / sai người</option>
                <option value="TECH_ERROR">Sự cố kỹ thuật (không trừ lượt)</option>
              </select>
            </label>
            <label className="block">CCCD hoặc hộ chiếu<input className="ml-2 rounded-lg border border-stone-300 bg-white px-2 py-1" value={document} onChange={e => setDocument(e.target.value)} /></label>
            {verifyOutcome === 'PASS' && (
              <label className="block">Ảnh tại buổi kiểm kê<input className="ml-2" type="file" accept="image/*" capture="user" onChange={e => setPhoto(e.target.files?.[0] || null)} /></label>
            )}
            {verifyOutcome !== 'PASS' && (
              <label className="block">Lý do bắt buộc<input className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5" value={reason} onChange={e => setReason(e.target.value)} /></label>
            )}
            <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void change('VERIFY')}>
              Lưu kết quả xác minh
            </Button>
          </div>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      </section>
    )
  }

  return (
    <section className={`space-y-4 rounded-xl border p-4 text-left text-sm ${remaining?.urgent ? 'border-red-300 bg-red-50/70 text-stone-900' : 'border-stone-200 bg-white text-stone-800'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-stone-900">
          {mode === 'inspection' ? 'Lịch hẹn & thời hạn kiểm kê' : 'Thời hạn chuẩn bị & lịch kiểm kê'}
        </h4>
        {remaining && (
          <Badge variant={remaining.expired ? 'error' : remaining.urgent ? 'warning' : 'muted'}>
            {remaining.text}
          </Badge>
        )}
      </div>

      {/* Key milestones summary — concise & user-friendly */}
      <dl className="grid gap-2.5 sm:grid-cols-2">
        {arrivalDeadline && (
          <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
            <dt className="text-xs text-stone-500">Hạn đến kiểm kê</dt>
            <dd className="mt-0.5 font-semibold text-stone-900">{show(arrivalDeadline)}</dd>
          </div>
        )}
        {mode !== 'inspection' && !clockStarted && setupCutoff && (
          <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
            <dt className="text-xs text-stone-500">Hạn báo chuẩn bị xong</dt>
            <dd className="mt-0.5 font-semibold text-stone-900">
              {state.readyAt ? `Đã xong · ${show(state.readyAt)}` : show(setupCutoff)}
            </dd>
          </div>
        )}
        <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
          <dt className="flex items-center justify-between gap-2 text-xs text-stone-500">
            <span>Lịch hẹn kiểm kê</span>
            <Badge variant={apptBadge.variant}>{apptBadge.label}</Badge>
          </dt>
          <dd className="mt-0.5 font-semibold text-stone-900">
            {state.appointmentAt ? show(state.appointmentAt) : <span className="text-xs font-normal text-stone-500">Chọn ngày giờ bên dưới</span>}
          </dd>
        </div>
        {!clockStarted && (
          <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
            <dt className="text-xs text-stone-500">Số lần gia hạn còn lại</dt>
            <dd className="mt-0.5 font-semibold text-stone-900">
              {remainingExtensions}/{maxExtensions} lần <span className="text-xs font-normal text-stone-500">(tối đa {maxDaysPerExtension} ngày/lần)</span>
            </dd>
          </div>
        )}
      </dl>

      {state.appointmentStatus === 'NOT_READY' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          Lịch hẹn cũ đã tự động hủy vì chưa báo chuẩn bị hàng xong trước 6 giờ. Bạn có thể báo chuẩn bị xong hoặc gia hạn để đặt lại lịch mới.
        </div>
      )}

      {state.appointmentStatus === 'MISSED' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900">
          Bạn đã bỏ lỡ lịch hẹn kiểm kê trước đó. Vui lòng đặt lại lịch mới trước hạn đến kiểm kê.
        </div>
      )}

      {state.attendanceReviewStatus === 'PENDING' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
          <p className="font-semibold">Đang đối soát thời điểm khách đến (quá hạn 30 phút)</p>
          <p className="mt-0.5">Hạn xử lý đối soát: {show(state.attendanceReviewDeadlineAt)}</p>
          {role !== 'CUSTOMER' && (
            <p className="mt-1 text-stone-600">
              Đơn hàng quá hạn đến nhưng đang trong khung 30 phút đối soát.
              {isManager ? ' Quản lý có thể kết luận đối soát ngay bên dưới.' : ' Đang chờ Quản lý kết luận đối soát.'}
            </p>
          )}
        </div>
      )}

      {clockStarted && (
        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/80 p-3.5 text-xs text-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-stone-900">
              {state.inspectionCompletedAt ? 'Kết quả kiểm kê hàng hóa' : 'Thời hạn hoàn tất kiểm kê (72 giờ)'}
            </span>
            <Badge variant={state.inspectionCompletedAt ? 'success' : state.verificationStatus === 'FAILED_MAX_ATTEMPTS' ? 'error' : 'warning'}>
              {state.inspectionCompletedAt
                ? 'Đã hoàn tất kiểm kê'
                : state.verificationStatus === 'PASSED'
                  ? 'Chờ kiểm kê hàng hóa'
                  : verificationStatusLabel(state.verificationStatus, state.inspectionCompletedAt)}
            </Badge>
          </div>
          <p className="text-stone-600">
            {state.inspectionCompletedAt
              ? 'Buổi kiểm kê hàng hóa đã hoàn tất trong thời hạn 72 giờ kể từ khi xác nhận khách đến.'
              : state.verificationStatus === 'PASSED'
                ? `Thời hạn 72 giờ hoàn tất kiểm kê được tính từ lúc xác nhận khách đến (${show(inspectionClockStartedAt)}). Cần hoàn tất kiểm kê hàng hóa trước hạn chót bên dưới.`
                : `Thời hạn 72 giờ hoàn tất kiểm kê đã bắt đầu tính từ lúc xác nhận khách đến (${show(inspectionClockStartedAt)}).`}
          </p>
          <dl className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
              <dt className="text-[11px] text-stone-500">Bắt đầu tính giờ kiểm kê</dt>
              <dd className="mt-0.5 font-semibold text-stone-900">{show(inspectionClockStartedAt)}</dd>
            </div>
            <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
              <dt className="text-[11px] text-stone-500">Hạn hoàn tất (72 giờ)</dt>
              <dd className="mt-0.5 font-semibold text-stone-900">{show(state.inspectionCompletionDeadlineAt)}</dd>
            </div>
            <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
              <dt className="text-[11px] text-stone-500">Xác minh danh tính</dt>
              <dd className="mt-0.5 font-semibold text-stone-900">
                {state.verificationStatus === 'PASSED'
                  ? `Đạt (lần ${verificationCount}/${verificationLimit})`
                  : `${verificationCount}/${verificationLimit} lần`}
              </dd>
            </div>
          </dl>
          {state.verificationAttempts && (state.verificationAttempts.length > 1 || state.verificationStatus !== 'PASSED') && (
            <ul className="space-y-0.5 border-t border-stone-200 pt-1.5 text-stone-600">
              {state.verificationAttempts.map((a, idx) => (
                <li key={idx}>
                  {a.attemptNumber ? `Lần ${a.attemptNumber}` : 'Sự cố kỹ thuật'} · {attemptOutcomeLabel(a.outcome)} · {show(a.recordedAt)}
                  {a.reason ? ` (${a.reason})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.inspectionFailureReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">{state.inspectionFailureReason}</p>}
      {state.interruptionReason && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Tạm gián đoạn: {state.interruptionReason}</p>}
      {state.exceptionReason && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Điều chỉnh từ cơ sở: {state.exceptionReason}{state.exceptionDueAt ? ` · Hạn mới ${show(state.exceptionDueAt)}` : ''}</p>}
      {state.resultConfirmationDueAt && <p className="text-xs text-stone-600">Vui lòng xác nhận hoặc góp ý kết quả kiểm kê trong vòng 48 giờ.</p>}

      {role === 'CUSTOMER' && !clockStarted && !state.inspectionFailureReason && (
        <div className="space-y-3 border-t border-stone-200 pt-3">
          {!hideCompleteSetupButton && !state.readyAt && (
            <div>
              <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void change('COMPLETE_SETUP')}>
                Xác nhận đã đưa hàng vào xong
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
            <p className="text-xs font-semibold text-stone-800">
              {state.appointmentAt && state.appointmentStatus === 'ACTIVE' ? 'Đổi lịch hẹn kiểm kê' : 'Đặt lịch hẹn kiểm kê'}
            </p>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Chọn thời gian từ {minAppointmentDateTime.slice(11, 16)} {minAppointmentDate.split('-').reverse().join('/')} đến trước hạn đến kiểm kê ({show(arrivalDeadline)}).
            </p>
            <div className="mt-2 space-y-2">
              <VietnameseDateTimeField
                label="Ngày hẹn (dd/mm/yyyy)"
                value={at}
                minDate={minAppointmentDate}
                maxDate={maxAppointmentDate}
                minDateTime={minAppointmentDateTime}
                maxDateTime={maxAppointmentDateTime}
                onChange={setAt}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || selectedAppointmentOutOfRange || !at}
                onClick={() => void change('APPOINTMENT')}
              >
                {state.appointmentAt && state.appointmentStatus === 'ACTIVE' ? 'Đổi lịch hẹn' : 'Đặt lịch kiểm kê'}
              </Button>
            </div>
          </div>

          {remainingExtensions > 0 && arrivalDeadline && Date.parse(arrivalDeadline) > now && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3">
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-stone-800">
                  Cần thêm thời gian? Gia hạn thêm {maxDaysPerExtension} ngày (còn {remainingExtensions}/{maxExtensions} lượt)
                </p>
                {previewExtendedDeadline && (
                  <p className="text-[11px] text-stone-600">
                    Hạn đến kiểm kê sẽ dời đến <b>{previewExtendedDeadline}</b>; sau đó bạn có thể chọn lại ngày hẹn mới ở trên.
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void change('EXTEND_SETUP')}
              >
                Gia hạn thêm {maxDaysPerExtension} ngày
              </Button>
            </div>
          )}
        </div>
      )}

      {role === 'STAFF' && (
        <div className="space-y-3 border-t border-stone-200 pt-3 text-xs">
          {!state.arrivedAt && !state.actualArrivedAt && (
            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <label className="block text-stone-700">
                Ghi chú bằng chứng có mặt (bắt buộc nếu ghi nhận đến muộn)
                <input
                  className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                  value={evidenceNote}
                  onChange={e => setEvidenceNote(e.target.value)}
                  placeholder="Ví dụ: Sổ quầy lễ tân 10:29:50"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void change('ARRIVAL')}>
                  Ghi nhận khách đã đến
                </Button>
                {state.appointmentStatus === 'ACTIVE' && (
                  <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void change('MARK_MISSED')}>
                    Xác nhận bỏ lỡ lịch
                  </Button>
                )}
              </div>
            </div>
          )}
          {(state.arrivedAt || state.actualArrivedAt) && !verificationLocked && (
            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="font-semibold text-stone-900">Xác minh danh tính (Lần {verificationCount + 1}/{verificationLimit})</p>
              <label className="block">
                Kết quả đối chiếu
                <select className="ml-2 rounded-lg border border-stone-300 bg-white px-2 py-1" value={verifyOutcome} onChange={e => setVerifyOutcome(e.target.value as 'PASS' | 'FAIL' | 'TECH_ERROR')}>
                  <option value="PASS">Đạt — Đúng người đặt kho</option>
                  <option value="FAIL">Không đạt — Sai giấy tờ / sai người</option>
                  <option value="TECH_ERROR">Sự cố kỹ thuật (không trừ lượt)</option>
                </select>
              </label>
              <label className="block">CCCD hoặc hộ chiếu<input className="ml-2 rounded-lg border border-stone-300 bg-white px-2 py-1" value={document} onChange={e => setDocument(e.target.value)} /></label>
              {verifyOutcome === 'PASS' && (
                <label className="block">Ảnh tại buổi kiểm kê<input className="ml-2" type="file" accept="image/*" capture="user" onChange={e => setPhoto(e.target.files?.[0] || null)} /></label>
              )}
              {verifyOutcome !== 'PASS' && (
                <label className="block">Lý do bắt buộc<input className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5" value={reason} onChange={e => setReason(e.target.value)} /></label>
              )}
              <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void change('VERIFY')}>
                Lưu kết quả xác minh
              </Button>
            </div>
          )}
          {state.verificationStatus === 'PASSED' && !state.inspectionCompletedAt && (
            <div className="space-y-2">
              <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void change('COMPLETE_INSPECTION')}>Hoàn tất kiểm kê</Button>
            </div>
          )}
        </div>
      )}

      {(role === 'STAFF' || role === 'MANAGER' || role === 'BUSINESS') && (
        <div className="space-y-3 border-t border-stone-200 pt-3 text-xs">
          {/* Concluding the attendance review and changing the facility deadline are
              Manager-only actions; the backend rejects Staff for both. */}
          {isManager && state.attendanceReviewStatus === 'PENDING' && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="font-semibold text-amber-950">Kết luận đối soát khách đến phút cuối</p>
              <input className="block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5" placeholder="Lý do / bằng chứng đối soát (bắt buộc khi duyệt đúng hạn hoặc ngoại lệ)" value={reason} onChange={e => setReason(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="primary" disabled={busy || !reason.trim()} onClick={() => void change('RESOLVE_REVIEW', { outcome: 'APPROVED_ON_TIME' })}>Chấp nhận đến đúng hạn</Button>
                <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void change('RESOLVE_REVIEW', { outcome: 'CONFIRMED_ABSENT' })}>Xác nhận vắng mặt</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => void change('RESOLVE_REVIEW', { outcome: 'FACILITY_EXCEPTION' })}>Ngoại lệ cơ sở</Button>
              </div>
            </div>
          )}
          {isManager && (
            <div className="space-y-2">
              <VietnameseDateTimeField
                label="Ngày giờ mới theo giờ Việt Nam (dd/mm/yyyy)"
                value={at}
                minDate={minimumDate}
                minDateTime={minimumDateTime}
                onChange={setAt}
              />
              <input aria-label="Lý do điều chỉnh do cơ sở" className="block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5" placeholder="Lý do điều chỉnh do cơ sở" value={reason} onChange={e => setReason(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void change('REMIND')}>Nhắc khách</Button>
                <Button type="button" size="sm" variant="primary" disabled={busy || selectedDateTimeIsPast || !at || !reason.trim()} onClick={() => void change('FACILITY_EXTENSION')}>Điều chỉnh hạn do cơ sở</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      {role !== 'CUSTOMER' && state.history.length > 0 && (
        <details className="text-xs text-stone-500">
          <summary className="cursor-pointer font-medium hover:text-stone-700">Lịch sử xử lý ({state.history.length})</summary>
          <div className="mt-1.5 space-y-1 border-l-2 border-stone-200 pl-3">
            {state.history.map((h, i) => (
              <p key={i}>
                {show(h.time)} · {historyActionLabel(h.action)}
                {h.after ? ` · ${show(h.after)}` : ''}
                {h.reason ? ` · ${h.reason}` : ''}
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
