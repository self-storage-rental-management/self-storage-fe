import { useEffect, useId, useState } from "react"
import { Input } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { getAuthenticatedActor } from "../../services/authApi"
import { getRenewalSigningSlots } from "../../services/renewalOperationsApi"
import { rentalDate, rentalError } from "./presentation"
import { vietnamLocalInstant } from "./operationsPresentation"

export function signingLocalInput(value: string | number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value))
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`
}

export default function RenewalAppointmentPicker({
  renewalId, expectedVersion, value, disabled, onChange, onReadyChange,
}: {
  renewalId: string
  expectedVersion: number | null
  value: string
  disabled: boolean
  onChange: (value: string) => void
  onReadyChange: (ready: boolean) => void
}) {
  const inputId = useId()
  const actor = getAuthenticatedActor()
  const today = signingLocalInput(Date.now()).slice(0, 10)
  const [date, setDate] = useState(value.slice(0, 10) || today)
  const [time, setTime] = useState(value.slice(11, 16))
  const read = useRentalApiResource(
    `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${renewalId}:${expectedVersion}:signing-slots:${date}`,
    () => getRenewalSigningSlots(renewalId, date),
  )
  const window = read.data
  const earliest = window ? signingLocalInput(window.availableAt) : null
  const latest = window ? signingLocalInput(window.deadlineAt) : null
  const currentVersion = !!window && window.date === date && window.expectedVersion === expectedVersion
  const availableTimes = currentVersion && !read.loading && !read.error
    ? (window?.slots ?? []).map(slot => signingLocalInput(slot.start).slice(11, 16))
    : []
  const selected = date && time ? `${date}T${time}` : ""
  let selectedInstant: string | null = null
  try { if (selected) selectedInstant = vietnamLocalInstant(selected) } catch {}
  const available = currentVersion && !read.loading && !read.error && !!selectedInstant
    && Date.parse(selectedInstant) > Date.now()
    && window.slots.some(slot => Date.parse(slot.start) === Date.parse(selectedInstant!))

  useEffect(() => { onReadyChange(available) }, [available, onReadyChange])
  useEffect(() => {
    if (!currentVersion || !earliest || !latest) return
    const firstDate = earliest.slice(0, 10)
    const lastDate = latest.slice(0, 10)
    if (date >= firstDate && date <= lastDate) return
    setDate(firstDate)
    setTime("")
    onChange("")
    onReadyChange(false)
  }, [currentVersion, earliest, latest, date, onChange, onReadyChange])
  useEffect(() => {
    if (disabled || !currentVersion || read.loading || read.error || !window) return
    if (time && availableTimes.includes(time)) return
    const first = availableTimes[0] ?? ""
    if (time === first) return
    setTime(first)
    onChange(first ? `${date}T${first}` : "")
  }, [disabled, currentVersion, read.loading, read.error, window, time, date, onChange])

  return <section className="space-y-3 border-t border-stone-200 pt-4">
    <div>
      <p className="text-sm font-semibold text-stone-900">Chọn ngày giờ ký gia hạn</p>
      {window && <p className="mt-1 text-xs leading-5 text-stone-600">
        Lịch hợp lệ từ <b>{rentalDate(window.availableAt)}</b> đến <b>{rentalDate(window.deadlineAt)}</b>.
        {" "}Giờ ký từ 08:00 đến 16:30, mỗi lượt 30 phút.
      </p>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Input id={`${inputId}-date`} aria-label="Ngày ký gia hạn mong muốn" label="Ngày ký gia hạn mong muốn"
        type="date" required disabled={disabled} value={date}
        min={earliest?.slice(0, 10) ?? today} max={latest?.slice(0, 10)}
        onChange={e => {
          setDate(e.target.value); setTime(""); onChange(""); onReadyChange(false)
        }} />
      <div className="space-y-1">
        <label htmlFor={`${inputId}-time`} className="block whitespace-nowrap text-sm font-medium text-stone-700">Giờ ký gia hạn mong muốn</label>
        <select id={`${inputId}-time`} aria-label="Giờ ký gia hạn mong muốn" required
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
          disabled={disabled || read.loading || !availableTimes.length} value={availableTimes.includes(time) ? time : ""}
          onChange={e => { setTime(e.target.value); onChange(e.target.value ? `${date}T${e.target.value}` : "") }}>
          <option value="">{read.loading ? "Đang tải giờ trống..." : "Chọn giờ trống"}</option>
          {availableTimes.map(slotTime => <option key={slotTime} value={slotTime}>{slotTime}</option>)}
        </select>
      </div>
    </div>
    {read.loading && <p role="status" className="text-xs text-stone-600">Đang tải lịch trống...</p>}
    {!!read.error && <p role="alert" className="text-xs text-red-700">{rentalError(read.error)}</p>}
    {window && !currentVersion && <p role="alert" className="text-xs text-red-700">Hồ sơ đã thay đổi, hãy mở lại phần chọn lịch.</p>}
    {currentVersion && !read.loading && !window.slots.length && date >= (earliest?.slice(0, 10) ?? "") && date <= (latest?.slice(0, 10) ?? "") && <p role="status" className="text-xs text-amber-700">Chưa có giờ ký khả dụng trong ngày này. Vui lòng chọn ngày khác hoặc liên hệ cơ sở.</p>}
    {currentVersion && !!time && !!window.slots.length && !available && <p role="alert" className="text-xs text-red-700">Giờ đã chọn không còn trống hoặc ngoài khung 30 phút, vui lòng chọn lại.</p>}
  </section>
}
