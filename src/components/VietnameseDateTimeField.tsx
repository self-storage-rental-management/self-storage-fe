import VietnameseDateInput from './VietnameseDateInput'

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

export default function VietnameseDateTimeField({
  value,
  onChange,
  minDate,
  maxDate,
  minDateTime,
  maxDateTime,
  label = 'Ngày hẹn (dd/mm/yyyy)',
  disabled = false,
}: {
  value: string
  onChange: (next: string) => void
  minDate?: string
  maxDate?: string
  minDateTime?: string
  maxDateTime?: string
  label?: string
  disabled?: boolean
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
          onChange={nextDate => {
            if (!disabled) update(nextDate, hour || '09', minute || '00')
          }}
        />
      </div>
      <div className="flex items-end gap-1">
        <label className="block text-xs font-medium text-stone-700">
          Giờ
          <select
            aria-label="Giờ hẹn"
            disabled={disabled}
            className="mt-1 block rounded-lg border border-stone-300 bg-white px-2 py-2.5 text-sm text-stone-900 disabled:bg-stone-100"
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
            disabled={disabled}
            className="mt-1 block rounded-lg border border-stone-300 bg-white px-2 py-2.5 text-sm text-stone-900 disabled:bg-stone-100"
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
