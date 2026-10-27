import { useRef, useState } from 'react'
import { Button } from '../../components/ui'

export default function ManagerWarehouseImageField({ label, value, disabled, onChange, onReading, onError }: {
  label: string; value: string; disabled: boolean; onChange: (value: string) => void
  onReading: (reading: boolean) => void; onError: (error: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const clearFile = () => { setName(''); if (input.current) input.current.value = '' }
  return <div className="space-y-3 rounded-xl border border-stone-200 p-4">
    <label className="block text-sm font-semibold text-stone-800">{label}
      <input type="url" placeholder="Dán link ảnh https://…" disabled={disabled}
        value={value.startsWith('data:') ? '' : value} className="mt-2 w-full rounded-lg border border-stone-300 p-3 font-normal"
        onChange={event => { clearFile(); onChange(event.target.value) }} />
    </label>
    <label className="block text-sm text-stone-600">Hoặc chọn từ máy (JPG, PNG, WebP, tối đa 2 MB)
      <input ref={input} type="file" disabled={disabled} accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full" onChange={event => {
        const file = event.target.files?.[0]
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
          event.target.value = ''
          onError('Vui lòng chọn ảnh JPG, PNG hoặc WebP không quá 2 MB.')
          return
        }
        onReading(true)
        const reader = new FileReader()
        reader.onload = () => { onChange(String(reader.result)); setName(file.name); onError(''); onReading(false) }
        reader.onerror = () => { onError('Không đọc được ảnh. Vui lòng chọn lại.'); onReading(false) }
        reader.readAsDataURL(file)
      }} />
    </label>
    {name && <p role="status" className="break-words text-sm text-emerald-700">Đã chọn ảnh: {name}</p>}
    {value && <>
      <img src={value} alt={label} className="max-h-60 w-full rounded-lg border border-stone-200 bg-stone-50 object-contain" />
      <Button variant="outline" disabled={disabled} onClick={() => { clearFile(); onChange('') }}>Bỏ ảnh</Button>
    </>}
  </div>
}
