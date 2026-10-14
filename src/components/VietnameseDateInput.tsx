import { useEffect, useId, useRef, useState } from 'react'

export function vietnameseDate(value: string) {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(value) ? value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') : ''
}
export function parseVietnameseDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const iso = `${match[3]}-${match[2]}-${match[1]}`
  const date = new Date(`${iso}T12:00:00`)
  return date.getFullYear() === Number(match[3]) && date.getMonth() + 1 === Number(match[2]) && date.getDate() === Number(match[1]) ? iso : ''
}
export default function VietnameseDateInput({ value, onChange, min, max }: {
  value: string; onChange: (value: string) => void; min?: string; max?: string
}) {
  const id = useId()
  const pickerRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(vietnameseDate(value))
  const published = useRef(value)
  useEffect(() => {
    if (value !== published.current) setDraft(vietnameseDate(value))
    published.current = value
  }, [value])
  return <label htmlFor={id} className="block text-sm font-medium text-stone-700">
    Ngày nhận kho mong muốn
      <div className="relative mt-1">
        <input id={id} type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10}
          value={draft} className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-3 pr-12 text-sm font-normal focus:ring-2 focus:ring-amber-400"
          onChange={event => { const text = event.target.value; setDraft(text); const iso = parseVietnameseDate(text); published.current = iso; onChange(iso) }} />
        <button type="button" aria-label="Mở lịch chọn ngày nhận kho" title="Chọn ngày"
          className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-md p-2 text-stone-800 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-amber-400"
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            const picker = pickerRef.current
            if (!picker) return
            try { picker.showPicker() } catch { picker.focus(); picker.click() }
          }}>
          <svg aria-hidden="true" className="show-icon h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 5h14v15H5zM8 2v6m8-6v6M5 10h14" /></svg>
        </button>
        <input ref={pickerRef} aria-label="Lịch chọn ngày nhận kho" tabIndex={-1} lang="vi-VN" type="date" value={value} min={min} max={max}
          className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0" onChange={event => {
            const date = event.target.value
            setDraft(vietnameseDate(date))
            published.current = date
            onChange(date)
          }} />
      </div>
  </label>
}
