import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { parseVietnameseDate, vietnameseDate } from './VietnameseDateInput'

/** Displays Vietnamese dates while preserving ISO values for existing form/API handlers. */
export default function LocalizedDateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type !== 'date' && props.type !== 'datetime-local') return <input {...props} />
  return <DateField {...props} />
}

function DateField({ type, value, defaultValue, onChange, onBlur, min, max, className = '', name, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const withTime = type === 'datetime-local'
  const initial = String(value ?? defaultValue ?? '')
  const [iso, setIso] = useState(initial)
  const [draft, setDraft] = useState(() => display(initial, withTime))
  const published = useRef(initial)
  const picker = useRef<HTMLInputElement>(null)
  const text = useRef<HTMLInputElement>(null)
  const lower = typeof min === 'string' ? min : undefined
  const upper = typeof max === 'string' ? max : undefined

  useEffect(() => {
    if (value === undefined) return
    const next = String(value)
    if (next !== published.current) setDraft(display(next, withTime))
    published.current = next
    setIso(next)
  }, [value, withTime])

  useEffect(() => {
    const parsed = parse(draft, withTime)
    const error = draft && !parsed ? 'Vui lòng nhập ngày hợp lệ theo định dạng ngày/tháng/năm.'
      : parsed && lower && parsed < lower ? `Ngày phải từ ${display(lower, withTime)}.`
      : parsed && upper && parsed > upper ? `Ngày phải không muộn hơn ${display(upper, withTime)}.` : ''
    text.current?.setCustomValidity(error)
  }, [draft, lower, upper, withTime])

  const publish = (event: ChangeEvent<HTMLInputElement>, next: string) => {
    published.current = next
    setIso(next)
    // Existing handlers receive the same ISO value as a native date input.
    const target = new Proxy(event.target, {
      get(element, key) {
        if (key === 'value') return next
        const property = Reflect.get(element, key, element)
        return typeof property === 'function' ? property.bind(element) : property
      },
    })
    onChange?.({ ...event, target, currentTarget: target })
  }

  return <div className="relative min-w-0">
    <input {...props} ref={text} type="text" lang="vi-VN" value={draft}
      placeholder={withTime ? 'ngày/tháng/năm giờ:phút' : 'ngày/tháng/năm'}
      className={`${className} pr-12`} maxLength={withTime ? 19 : 10}
      onChange={event => { setDraft(event.target.value); publish(event, parse(event.target.value, withTime)) }}
      onBlur={event => {
        const parsed = parse(event.target.value, withTime)
        if (parsed) setDraft(display(parsed, withTime))
        onBlur?.(event)
      }} />
    <button type="button" aria-label={withTime ? 'Mở lịch chọn ngày giờ' : 'Mở lịch chọn ngày'}
      title="Chọn ngày" disabled={props.disabled || props.readOnly}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-inherit disabled:opacity-50"
      onClick={() => {
        if (!picker.current) return
        try { picker.current.showPicker() } catch { picker.current.focus(); picker.current.click() }
      }}>
      <svg aria-hidden="true" className="show-icon h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 5h14v15H5zM8 2v6m8-6v6M5 10h14" /></svg>
    </button>
    <input ref={picker} type={type} name={name} value={iso} min={lower} max={upper} step={props.step}
      disabled={props.disabled || props.readOnly} tabIndex={-1} aria-hidden="true"
      className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      onChange={event => { setDraft(display(event.target.value, withTime)); publish(event, event.target.value) }} />
  </div>
}

function display(value: string, withTime: boolean) {
  const date = vietnameseDate(value.slice(0, 10))
  return date && withTime && value.includes('T') ? `${date} ${value.slice(11)}` : date
}

function parse(value: string, withTime: boolean): string {
  if (!withTime) return parseVietnameseDate(value)
  const match = value.match(/^(\d{2}\/\d{2}\/\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return ''
  const date = parseVietnameseDate(match[1])
  return date && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4] ?? 0) < 60
    ? `${date}T${match[2]}:${match[3]}${match[4] ? `:${match[4]}` : ''}` : ''
}
