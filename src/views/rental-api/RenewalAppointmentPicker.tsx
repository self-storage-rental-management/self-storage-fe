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
  const selected = date && time ? `${date}T${time}` : ""
  let selectedInstant: string | null = null
  try { if (selected) selectedInstant = vietnamLocalInstant(selected) } catch {}
  const available = currentVersion && !read.loading && !read.error && !!selectedInstant
    && Date.parse(selectedInstant) > Date.now()
    && window.slots.some(slot => Date.parse(slot.start) === Date.parse(selectedInstant!))

  useEffect(() => { onReadyChange(available) }, [available, onReadyChange])
  useEffect(() => {
    if (disabled || !currentVersion || read.loading || !window?.slots.length || time) return
    const first = signingLocalInput(window.slots[0].start)
    setTime(first.slice(11, 16))
    onChange(`${date}T${first.slice(11, 16)}`)
  }, [disabled, currentVersion, read.loading, window, time, date, onChange])

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
      <Input id={`${inputId}-time`} aria-label="Giờ ký gia hạn mong muốn" label="Giờ ký gia hạn mong muốn"
        type="time" required disabled={disabled || read.loading || !date} value={time} step="1800"
        min={date === earliest?.slice(0, 10) ? earliest.slice(11, 16) : "08:00"}
        max={date === latest?.slice(0, 10) ? latest.slice(11, 16) : "16:30"}
        onChange={e => { setTime(e.target.value); onChange(`${date}T${e.target.value}`) }} />
    </div>
    {read.loading && <p role="status" className="text-xs text-stone-600">Đang tải lịch trống...</p>}
    {!!read.error && <p role="alert" className="text-xs text-red-700">{rentalError(read.error)}</p>}
    {window && !currentVersion && <p role="alert" className="text-xs text-red-700">Hồ sơ đã thay đổi, hãy mở lại phần chọn lịch.</p>}
    {currentVersion && !read.loading && !window.slots.length && <p role="status" className="text-xs text-amber-700">Ngày này không còn lịch ký trống, vui lòng chọn ngày khác.</p>}
    {currentVersion && !!time && !!window.slots.length && !available && <p role="alert" className="text-xs text-red-700">Giờ đã chọn không còn trống hoặc ngoài khung 30 phút, vui lòng chọn lại.</p>}
  </section>
}
