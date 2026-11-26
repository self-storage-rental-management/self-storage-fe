import { useEffect, useState } from 'react'
import { downloadCheckInEvidence } from '../../services/checkInApi'
import { parseVietnamDate, VIETNAM_TIME_ZONE } from '../../utils/vietnamTime'

interface Props {
  source: File | string
  index: number
  uploadedAt?: string
  handedOverAt?: string | null
  busy: boolean
  onPreview: (blob: Blob, name: string, type: string) => void
  onRemove?: () => void
}

const iconButton = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40'
const symbols = {
  view: <><path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
  remove: <><path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 6l1 14h10l1-14M10 10v6m4-6v6"/></>,
  success: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
}

function Icon({ name }: { name: keyof typeof symbols }) {
  return <svg className={name === 'success' ? 'show-icon h-3.5 w-3.5' : 'show-icon h-[18px] w-[18px]'} aria-hidden="true" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{symbols[name]}</svg>
}

const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: VIETNAM_TIME_ZONE })
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: VIETNAM_TIME_ZONE })
const sizeFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${sizeFormat.format(bytes / 1024)} KB`
  return `${sizeFormat.format(bytes / 1024 ** 2)} MB`
}

export default function HandoverEvidenceRow({ source, index, uploadedAt, handedOverAt, busy, onPreview, onRemove }: Props) {
  const [file, setFile] = useState<{ blob: Blob; url: string; name: string | null; type: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let url: string | undefined
    setFile(null)
    setFailed(false)
    async function load() {
      const result = typeof source === 'string'
        ? await downloadCheckInEvidence(source)
        : { blob: source, fileName: source.name, contentType: source.type }
      if (!active) return
      url = URL.createObjectURL(result.blob)
      setFile({ blob: result.blob, url, name: result.fileName, type: result.contentType })
    }
    void load().catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [source, attempt])

  const saved = typeof source === 'string'
  const name = file?.name || (saved ? `Tệp bằng chứng ${index + 1}` : source.name)
  const typeLabel = file?.type === 'image/jpeg' ? 'JPG' : file?.type.split('/')[1]?.toUpperCase()
  const timestamp = saved && (uploadedAt || handedOverAt)
  const date = timestamp ? parseVietnamDate(timestamp) : null
  const removeLabel = onRemove ? `Xóa ${name} khỏi danh sách` : 'Chỉ có thể xóa tệp trước khi xác nhận bàn giao'
  return <li className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[14px] border border-stone-200 bg-white px-3.5 py-3 sm:flex-nowrap">
    {file?.type.startsWith('image/') ? <img src={file.url} alt="" className="h-16 w-16 shrink-0 rounded-2xl border border-stone-200 object-cover sm:h-[84px] sm:w-[84px]" />
      : <div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-stone-100 text-xs font-semibold text-stone-600 sm:h-[84px] sm:w-[84px]">{typeLabel}</div>}
    <div className="min-w-0 flex-1 space-y-1">
      <p title={name} className="break-words text-base font-semibold text-stone-900">{name}</p>
      {file && <p className="text-sm text-stone-600">{typeLabel} · {formatSize(file.blob.size)}</p>}
      {date && Number.isFinite(date.getTime()) && <p className="text-sm text-stone-600">{uploadedAt ? 'Tải lên lúc' : 'Bàn giao lúc'} {timeFormat.format(date)} – {dateFormat.format(date)}</p>}
      {failed ? <p role="alert" className="text-xs text-red-700">Không tải được tệp. <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></p>
        : saved && file ? <p className="flex items-center gap-1 text-xs text-green-700"><Icon name="success" />Đã tải lên thành công</p>
        : <p className="text-xs text-stone-500">{saved ? 'Đang tải tệp…' : 'Chờ tải lên'}</p>}
    </div>
    <div className="ml-auto flex items-center gap-0.5">
      <button type="button" title={`Xem trước ${name}`} aria-label={`Xem trước ${name}`} className={`${iconButton} text-stone-900 hover:bg-stone-100`}
        disabled={!file} onClick={() => file && onPreview(file.blob, name, file.type)}><Icon name="view" /></button>
      <a title={`Tải xuống ${name}`} aria-label={`Tải xuống ${name}`} href={file?.url} download={name} aria-disabled={!file}
        className={`${iconButton} text-stone-600 hover:bg-stone-100 aria-disabled:opacity-40`}><Icon name="download" /></a>
      <button type="button" title={removeLabel} aria-label={removeLabel} disabled={!onRemove || busy} onClick={onRemove}
        className={`${iconButton} text-red-600 enabled:hover:bg-red-50`}><Icon name="remove" /></button>
    </div>
  </li>
}
