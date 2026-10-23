import { useEffect, useId, useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  onNameChange?: (name: string) => void
  disabled?: boolean
}

interface FilePreviewListProps {
  files: File[]
  onRemove?: (index: number) => void
  disabled?: boolean
}

function fileKey(file: File, index: number) {
  return `${file.name}:${file.lastModified}:${file.size}:${index}`
}

/** Preview files locally before they are uploaded to the server. */
export function FilePreviewList({ files, onRemove, disabled = false }: FilePreviewListProps) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    files.forEach((file, index) => { next[fileKey(file, index)] = URL.createObjectURL(file) })
    setUrls(next)
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url))
  }, [files])

  if (!files.length) return null
  return <>
    <div className="grid gap-2 sm:grid-cols-2">
      {files.map((file, index) => {
        const url = urls[fileKey(file, index)]
        const image = file.type.startsWith('image/')
        return <div key={fileKey(file, index)} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-2">
          {image && url ? <img src={url} alt={`Xem trước ${file.name}`} className="h-14 w-14 rounded object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded bg-stone-100 text-xs font-semibold text-stone-500">PDF</div>}
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-stone-500">{Math.ceil(file.size / 1024)} KB</p></div>
          <Button type="button" size="sm" variant="outline" disabled={!url || disabled} onClick={() => url && setPreview({ file, url })}>Xem</Button>
          {onRemove && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onRemove(index)}>Xóa</Button>}
        </div>
      })}
    </div>
    <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.file.name} size="xl">
      {preview && (preview.file.type.startsWith('image/')
        ? <img src={preview.url} alt={`Xem trước ${preview.file.name}`} className="max-h-[70vh] w-full object-contain" />
        : <iframe title={`Xem trước ${preview.file.name}`} src={preview.url} className="h-[70vh] w-full" />)}
    </Modal>
  </>
}

/** Staff attachments keep their contents, not a filename-only placeholder. */
export default function StaffFileUpload({ label, value, onChange, onNameChange, disabled = false }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const version = useRef(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  useEffect(() => () => { ++version.current }, [])
  const remove = () => {
    ++version.current
    onChange('')
    onNameChange?.('')
    setName('')
    setError('')
    setLoading(false)
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
          setError('Vui lòng chọn ảnh JPEG, PNG, WEBP hoặc tài liệu PDF.')
          return
        }
        if (!file.size || file.size > 3 * 1024 * 1024) {
          setError('Tệp phải có nội dung và dung lượng không quá 3 MB.')
          return
        }
        const request = ++version.current
        onChange('')
        onNameChange?.('')
        setName('')
        setError('')
        setLoading(true)
        const reader = new FileReader()
        reader.onload = () => {
          if (request !== version.current) return
          setLoading(false)
          if (typeof reader.result === 'string') {
            onChange(reader.result)
            onNameChange?.(file.name)
            setName(file.name)
          }
        }
        reader.onerror = () => {
          if (request === version.current) {
            setLoading(false)
            setError('Không đọc được tệp. Vui lòng chọn lại.')
          }
        }
        reader.readAsDataURL(file)
      }} />
      {!disabled && <p className="mt-2 text-xs leading-5 text-stone-500">Ảnh JPEG, PNG, WEBP hoặc tài liệu PDF · Tối đa 3 MB</p>}
      {loading && <p className="mt-2" role="status">Đang đọc tệp…</p>}
        {value && <div className="mt-2 min-w-0 space-y-2">
        <p className="break-words text-emerald-800">{name ? `Đã chọn: ${name}` : value.startsWith('data:') ? 'Tệp đã lưu' : value}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>Xem trước</Button>
      </div>}
      {disabled && !value && <p className="text-stone-500">Chưa có tệp đính kèm.</p>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`Xem trước: ${label}`} size="xl">
      {value.startsWith('data:image/')
        ? <img src={value} alt={`Xem trước: ${label}`} className="max-h-[70vh] w-full object-contain" />
        : <iframe title={`Xem trước: ${label}`} src={value} className="h-[70vh] w-full" />}
    </Modal>
  </div>
}
