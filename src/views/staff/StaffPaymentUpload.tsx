import { useEffect, useRef, useState } from 'react'

export default function StaffPaymentUpload({ value, onChange, onNameChange }: { value: string; onChange: (value: string) => void; onNameChange?: (name: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const version = useRef(0)
  useEffect(() => () => { ++version.current }, [])
  return <div className="space-y-2 text-sm">
    <p className="font-medium text-slate-700">Ảnh hoặc chứng từ thanh toán</p>
    <label className="block cursor-pointer rounded-lg border border-dashed border-emerald-600 bg-white p-3 focus-within:ring-2 focus-within:ring-emerald-600">
      <span className="font-semibold text-emerald-800">Chọn tệp chứng từ</span>
      <input type="file" className="sr-only" aria-label="Chọn tệp chứng từ thanh toán" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        const request = ++version.current
        onChange(''); setName(''); onNameChange?.(''); setError(''); setLoading(false)
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
          setError('Định dạng chưa được hỗ trợ. Vui lòng chọn ảnh JPEG, PNG, WEBP hoặc tài liệu PDF.'); return
        }
        if (file.size === 0 || file.size > 3 * 1024 * 1024) {
          setError('Vui lòng chọn tệp có nội dung và dung lượng tối đa 3 MB.'); return
        }
        setLoading(true)
        const reader = new FileReader()
        reader.onload = () => {
          if (request !== version.current) return
          setLoading(false)
          if (typeof reader.result === 'string') { onChange(reader.result); setName(file.name); onNameChange?.(file.name) }
        }
        reader.onerror = () => { if (request === version.current) { setLoading(false); setError('Không đọc được tệp. Vui lòng chọn lại chứng từ.'); } }
        reader.readAsDataURL(file)
      }} />
      <span className="mt-1 block text-xs text-stone-500">Ảnh JPEG, PNG, WEBP hoặc tài liệu PDF · Tối đa 3 MB</span>
    </label>
    {loading && <p role="status">Đang đọc chứng từ…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {value && <div className="space-y-2"><p className="break-all text-emerald-800">Đã chọn: {name}</p>{value.startsWith('data:image/') && <img src={value} alt="Xem trước chứng từ thanh toán" className="max-h-40 rounded border object-contain" />}<button type="button" className="text-red-700 underline" onClick={() => { ++version.current; onChange(''); setName('') }}>Xóa chứng từ</button></div>}
  </div>
}
