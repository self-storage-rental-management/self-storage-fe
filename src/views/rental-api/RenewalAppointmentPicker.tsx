import { parseVietnamDate } from '../../utils/vietnamTime'
import { useEffect, useId, useState } from "react"
import { Input } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { getAuthenticatedActor } from "../../services/authApi"
import { getRenewalSigningSlots } from "../../services/renewalOperationsApi"
import { rentalError } from "./presentation"
import { vietnamLocalInstant } from "./operationsPresentation"

export function signingLocalInput(value: string | number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(parseVietnamDate(value))
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
  const noSlots = currentVersion && !read.loading && !window.slots.length
    && date >= (earliest?.slice(0, 10) ?? "") && date <= (latest?.slice(0, 10) ?? "")
  const displayDate = date ? date.split("-").reverse().join("/") : ""

  return <section className="space-y-5" aria-label="Chọn lịch ký gia hạn">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor={`${inputId}-date`} className="block text-sm font-semibold text-stone-600">Ngày ký</label>
        <div className="relative">
          <Input id={`${inputId}-date`} aria-label="Ngày ký" type="date" required disabled={disabled} value={date}
            min={earliest?.slice(0, 10) ?? today} max={latest?.slice(0, 10)}
            className="!h-14 !rounded-full !border-stone-300 !px-4 !text-base"
            onChange={e => {
              setDate(e.target.value); setTime(""); onChange(""); onReadyChange(false)
            }} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${inputId}-time`} className="block text-sm font-semibold text-stone-600">Khung giờ</label>
        <div className="relative">
          <select id={`${inputId}-time`} aria-label="Khung giờ" required disabled={disabled || read.loading || !date || availableTimes.length === 0}
            value={time} className="h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 pr-11 text-base text-stone-800 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
            onChange={e => {
              setTime(e.target.value)
              onChange(e.target.value ? `${date}T${e.target.value}` : "")
            }}>
            <option value="">{read.loading ? "Đang tải khung giờ…" : "Chọn khung giờ"}</option>
            {availableTimes.map(slot => <option key={slot} value={slot}>{slot}</option>)}
          </select>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="show-icon pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
    </div>
    {read.loading && <div role="status" className="flex items-center gap-3 py-2 text-sm text-stone-500"><span className="h-4 w-4 animate-pulse rounded-full bg-amber-200" />Đang tải lịch trống…</div>}
    {!!read.error && (
      <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <p role="alert">{rentalError(read.error)}</p>
        <button type="button" onClick={() => read.refresh()} className="ml-2 shrink-0 font-semibold text-red-800 underline hover:text-red-900">Thử lại</button>
      </div>
    )}
    {window && !currentVersion && <p role="alert" className="text-sm text-red-700">Hồ sơ đã thay đổi, hãy mở lại phần chọn lịch.</p>}
    {noSlots && <div role="status" className="flex items-start gap-3 py-1 text-stone-700">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="show-icon mt-0.5 h-5 w-5 shrink-0 text-stone-600"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M9 14l6 4m0-4-6 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <div><p className="font-semibold">Không có lịch trống ngày {displayDate}</p><p className="mt-1 text-sm text-stone-500">Hãy chọn ngày khác hoặc liên hệ cơ sở để được hỗ trợ.</p></div>
    </div>}
    {currentVersion && !!time && !!window.slots.length && !available && <p role="alert" className="text-sm text-red-700">Khung giờ đã chọn không còn khả dụng, vui lòng chọn lại.</p>}
    <p className="flex items-start gap-2 text-sm text-stone-500">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="show-icon mt-0.5 h-4 w-4 shrink-0"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01" strokeLinecap="round"/></svg>
      Bạn cần lưu lịch ký hợp lệ trước khi tiếp tục thanh toán khoản trả trước.
    </p>
  </section>
}
