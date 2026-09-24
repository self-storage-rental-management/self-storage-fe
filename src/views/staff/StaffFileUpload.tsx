import { useEffect, useId, useRef, useState } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  onNameChange?: (name: string) => void
  disabled?: boolean
}

/** Staff attachments keep their contents, not a filename-only placeholder. */
export default function StaffFileUpload({ label, value, onChange, onNameChange, disabled = false }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const version = useRef(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => () => { ++version.current }, [])
  const remove = () => {
    ++version.current
    onChange(''); onNameChange?.(''); setName(''); setError(''); setLoading(false)
    if (input.current) input.current.value = ''
  }
  return <div className="min-w-0 space-y-2 text-sm" role="group" aria-labelledby={id}>
    <p id={id} className="font-medium text-slate-700">{label}</p>
    <div className="min-w-0 rounded-lg border border-slate-300 bg-white p-3">
      {!disabled && <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => input.current?.click()} className="rounded-md border border-emerald-700 px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">Chọn tệp</button>
        {(value || loading) && <button type="button" onClick={remove} className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700 hover:bg-red-50">Xóa tệp</button>}
      </div>}
      <input ref={input} type="file" className="sr-only" tabIndex={-1} disabled={disabled} aria-label={label} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        // An invalid replacement must not discard the previously selected file.
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
          setError('Vui lòng chọn ảnh JPEG, PNG, WEBP hoặc tài liệu PDF.'); return
        }
        if (!file.size || file.size > 3 * 1024 * 1024) {
          setError('Tệp phải có nội dung và dung lượng không quá 3 MB.'); return
        }
        const request = ++version.current
        onChange(''); onNameChange?.(''); setName(''); setError(''); setLoading(true)
        const reader = new FileReader()
        reader.onload = () => {
          if (request !== version.current) return
          setLoading(false)
          if (typeof reader.result === 'string') { onChange(reader.result); onNameChange?.(file.name); setName(file.name) }
        }
        reader.onerror = () => { if (request === version.current) { setLoading(false); setError('Không đọc được tệp. Vui lòng chọn lại.'); } }
        reader.readAsDataURL(file)
      }} />
      {!disabled && <p className="mt-2 text-xs leading-5 text-stone-500">Ảnh JPEG, PNG, WEBP hoặc tài liệu PDF · Tối đa 3 MB</p>}
      {loading && <p className="mt-2" role="status">Đang đọc tệp…</p>}
      {value && <div className="mt-2 min-w-0 space-y-2">
        <p className="break-words text-emerald-800">{name ? `Đã chọn: ${name}` : value.startsWith('data:') ? 'Tệp đã lưu' : value}</p>
        {value.startsWith('data:image/') && <img src={value} alt={`Xem trước: ${label}`} className="max-h-40 max-w-full rounded border object-contain" />}
        {value.startsWith('data:application/pdf') && <a href={value} download={name || 'tai-lieu.pdf'} className="inline-block text-emerald-800 underline">Tải tài liệu để xem</a>}
      </div>}
      {disabled && !value && <p className="text-stone-500">Chưa có tệp đính kèm.</p>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>
}
