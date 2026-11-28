import { useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { setCustomerInventoryAppointment, type CustomerReservationDetail } from '../../services/customerReservationApi'
import { parseVietnamDate, vietnamDateTimeInput } from '../../utils/vietnamTime'

function formatTime(value: string) {
  return formatCustomerDateTime(new Date(value))
}

export function inventoryDeadlineText(value: string | null | undefined, now: number) {
  if (!value) return null
  const remaining = Date.parse(value) - now
  if (!Number.isFinite(remaining)) return null
  if (remaining <= 0) return 'Đã quá hạn xử lý'
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  return `Còn ${days > 0 ? `${days} ngày ` : ''}${hours > 0 ? `${hours} giờ ` : ''}${minutes % 60} phút`
}

function formatVietnamDateOption(isoDate: string) {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function listValidVietnamDates(startMs: number, endInclusiveMs: number) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endInclusiveMs) || endInclusiveMs < startMs) return []
  const startIso = vietnamDateTimeInput(startMs).slice(0, 10)
  const endIso = vietnamDateTimeInput(endInclusiveMs).slice(0, 10)
  const [sy, sm, sd] = startIso.split('-').map(Number)
  const [ey, em, ed] = endIso.split('-').map(Number)
  let cursor = Date.UTC(sy, sm - 1, sd)
  const limit = Date.UTC(ey, em - 1, ed)
  const dates: string[] = []
  while (cursor <= limit && dates.length < 60) {
    dates.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += 86_400_000
  }
  return dates
}

export default function InventoryAppointmentPanel({ detail, now, onSaved }: {
  detail: CustomerReservationDetail
  now: number
  onSaved: (updated: CustomerReservationDetail) => void
}) {
  const [editing, setEditing] = useState(false)
  const [appointment, setAppointment] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingLock = useRef(false)
  const deadline = Date.parse(detail.inventoryFinalDeadlineAt ?? '')
  const expired = deadline <= now || Boolean(detail.inventoryEscalatedAt)
  const awaitingResult = detail.inventoryResolutionStatus != null && detail.inventoryResolutionStatus !== 'NOT_STARTED'
  const firstMinute = Math.floor(now / 60_000) * 60_000 + 60_000
  const canPlan = !expired && firstMinute < deadline && !detail.inventoryArrivedAt && !awaitingResult
  const validDates = listValidVietnamDates(firstMinute, deadline - 1)
  const selectedDate = appointment ? appointment.slice(0, 10) : (validDates[0] ?? '')
  const selectedTime = appointment ? appointment.slice(11, 16) : '09:00'

  async function save() {
    if (savingLock.current) return
    const value = `${selectedDate}T${selectedTime}`
    const candidate = parseVietnamDate(value)
    const timestamp = candidate.getTime()
    if (!canPlan || !Number.isFinite(timestamp) || timestamp <= Date.now() || timestamp >= deadline) {
      setError('Chọn giờ trong tương lai và trước hạn kiểm kê.')
      return
    }
    savingLock.current = true
    setSaving(true)
    setError('')
    try {
      const updated = await setCustomerInventoryAppointment(detail.reservation.id, candidate.toISOString(), reason.trim() || undefined)
      onSaved(updated)
      setEditing(false)
    } catch (error) {
      setError(userFacingError(error, 'Không lưu được lịch kiểm kê.'))
    } finally {
      savingLock.current = false
      setSaving(false)
    }
  }

  return (
    <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-left text-xs text-violet-950">
      <p className="font-semibold text-sm text-violet-900">Lịch kiểm kê đầu vào</p>
      {detail.inventoryAppointmentAt && <p>Giờ hẹn <b>{formatTime(detail.inventoryAppointmentAt)}</b></p>}
      {detail.inventoryEscalatedAt
        ? <p className="font-semibold text-red-800">Đang chờ thu hồi. Vui lòng liên hệ cơ sở.</p>
        : awaitingResult
          ? <p>Nhân viên đã cập nhật kết quả kiểm kê. Vui lòng xem kết quả và thực hiện các bước được hướng dẫn.</p>
        : expired
          ? <p className="font-semibold text-red-800">Đã quá hạn kiểm kê. Vui lòng liên hệ cơ sở.</p>
          : detail.inventoryArrivedAt
            ? <p>Đã ghi nhận khách đến lúc {formatTime(detail.inventoryArrivedAt)}. {detail.inventoryIdentityVerifiedAt ? 'Đã xác minh danh tính.' : 'Đang chờ xác minh danh tính.'}</p>
            : <p>{detail.inventoryAppointmentAt ? 'Mang giấy tờ gốc đã đăng ký khi đến kiểm kê.' : 'Chọn ngày giờ đến cơ sở để kiểm kê.'}</p>}
      {canPlan && (editing ? (
        <form className="space-y-2" onSubmit={event => { event.preventDefault(); void save() }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              Ngày hẹn (dd/mm/yyyy)
              <select
                required
                value={selectedDate}
                disabled={saving}
                onChange={event => setAppointment(`${event.target.value}T${selectedTime}`)}
                className="min-w-0 rounded-md border border-violet-300 bg-white p-2"
              >
                {validDates.map(isoDate => (
                  <option key={isoDate} value={isoDate}>{formatVietnamDateOption(isoDate)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              Giờ hẹn (giờ Việt Nam)
              <input
                type="time"
                required
                value={selectedTime}
                disabled={saving}
                onChange={event => setAppointment(`${selectedDate}T${event.target.value}`)}
                className="min-w-0 rounded-md border border-violet-300 bg-white p-2"
              />
            </label>
          </div>
          {detail.inventoryAppointmentAt && <label className="grid gap-1">
            Lý do đổi lịch (không bắt buộc)
            <textarea value={reason} maxLength={500} disabled={saving} onChange={event => setReason(event.target.value)}
              className="rounded-md border border-violet-300 bg-white p-2" />
          </label>}
          {error && <p role="alert" className="text-red-800">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={saving || !selectedDate || !selectedTime}>{saving ? 'Đang lưu…' : 'Lưu lịch kiểm kê'}</Button>
            <Button size="sm" type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>Hủy</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" type="button" variant="outline" onClick={() => {
          setAppointment(detail.inventoryAppointmentAt ? vietnamDateTimeInput(detail.inventoryAppointmentAt) : `${validDates[0] ?? ''}T09:00`)
          setReason('')
          setError('')
          setEditing(true)
        }}>{detail.inventoryAppointmentAt ? 'Đổi lịch kiểm kê' : 'Chọn lịch kiểm kê'}</Button>
      ))}
    </section>
  )
}

