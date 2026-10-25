import { useEffect, useRef, useState } from "react"
import FilePreviewDialog from "../../components/FilePreviewDialog"
import { Button } from "../../components/ui"
import {
  downloadDuongEvidence,
  getDuongEvidenceName,
  uploadDuongEvidence,
  integrationError,
} from "../../services/duongIntegrationApi"

export function EvidenceUpload({
  entityType,
  entityId,
  value,
  onChange,
  disabled,
  onBusy,
  label = "Đính kèm minh chứng",
  accept,
  limit = 10,
  compact = false,
  iconOnly = false,
  upload,
}: {
  entityType: string
  entityId?: string
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  onBusy?: (busy: boolean) => void
  label?: string
  accept?: string
  limit?: number
  compact?: boolean
  iconOnly?: boolean
  upload?: (file: File) => Promise<{ id: string }>
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  const lock = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({})
  return (
    <div className={iconOnly ? 'support-attachment-control text-sm' : 'space-y-2 text-sm'}>
      {compact && iconOnly ? <button type="button" aria-label={label} title={label}
        disabled={disabled || busy || value.length >= limit} onClick={() => inputRef.current?.click()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#95575f] hover:bg-[#faeae8] focus-visible:outline-2 focus-visible:outline-[#b86d78] disabled:opacity-40">
        <svg aria-hidden="true" className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a6 6 0 0 1 8 8l-9 9" /></svg>
      </button> : compact && <Button type="button" variant="outline" size="sm"
        disabled={disabled || busy || value.length >= limit}
        onClick={() => inputRef.current?.click()}>
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
        {label}
      </Button>}
      <label className={compact ? "hidden" : "block"}>
        {!compact && label}
        <input
          ref={inputRef}
          aria-label={label}
          className="mt-1 block w-full"
          type="file"
          accept={accept}
          disabled={disabled || busy || value.length >= limit}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file || disabled || lock.current || value.length >= limit)
              return
            lock.current = true
            setBusy(true)
            onBusy?.(true)
            setError(undefined)
            try {
              const uploaded = upload ? await upload(file) : await uploadDuongEvidence(
                file,
                entityType,
                entityId,
              )
              setSelectedNames(names => ({ ...names, [uploaded.id]: file.name }))
              onChange([...value, uploaded.id])
            } catch (e) {
              setError(e)
            } finally {
              lock.current = false
              setBusy(false)
              onBusy?.(false)
            }
          }}
        />
      </label>
      {busy && <p role="status">Đang lưu tệp...</p>}
      {!!error && (
        <p role="alert">
          {integrationError(error)} Không sử dụng tệp chưa có xác nhận lưu thành
          công.
        </p>
      )}
      {iconOnly ? !!value.length && <div className="support-selected-files" aria-label="Tệp đã chọn">
        {value.map((id, index) => <div key={id} className="support-selected-file">
          <svg aria-hidden="true" className="show-icon h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>
          <span className="min-w-0 truncate" title={selectedNames[id]}>{selectedNames[id] || `Tệp ${index + 1}`}</span>
          <button type="button" aria-label={`Bỏ ${selectedNames[id] || `tệp ${index + 1}`}`} disabled={disabled || busy} onClick={() => onChange(value.filter(fileId => fileId !== id))} className="support-remove-file">×</button>
        </div>)}
      </div> : <>
        {!!value.length && <p>Đã chọn {value.length} tệp.</p>}
        {value.map((id, index) => <Button type="button" key={id} variant="outline" disabled={disabled || busy} onClick={() => onChange(value.filter((_, i) => i !== index))}>Bỏ tệp {index + 1}</Button>)}
      </>}
    </div>
  )
}
export function EvidenceDownload({
  id,
  index = 1,
  label,
  previewLabel,
  asLink = false,
  previewOnly = false,
  chatFile = false,
  compact = false,
}: {
  id: string
  index?: number
  label?: string
  previewLabel?: string
  asLink?: boolean
  previewOnly?: boolean
  chatFile?: boolean
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  const lock = useRef(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string }>()
  useEffect(() => {
    if (!previewFile) return
    return () => URL.revokeObjectURL(previewFile.url)
  }, [previewFile])
  useEffect(() => {
    if (!asLink) return
    let active = true
    setFileName(null)
    void getDuongEvidenceName(id).then(name => {
      if (active) setFileName(name)
    }).catch(error => {
      if (active) setError(error)
    })
    return () => { active = false }
  }, [id, asLink])
  const download = async () => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(undefined)
    try {
      const file = await downloadDuongEvidence(id)
      setFileName(file.fileName)
      const url = URL.createObjectURL(file.blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.fileName || "minh-chung"
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const openPreview = async () => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(undefined)
    try {
      const file = await downloadDuongEvidence(id)
      const types: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp' }
      const mime = file.blob.type.toLowerCase().split(';')[0]
      const type = mime && mime !== 'application/octet-stream' ? mime : types[file.fileName?.split('.').pop()?.toLowerCase() ?? ''] ?? ''
      const safeType = Object.values(types).includes(type) ? type : ''
      setPreviewFile({ url: URL.createObjectURL(safeType ? new Blob([file.blob], { type: safeType }) : file.blob), name: file.fileName || 'Minh chứng', type: safeType })
    } catch (e) {
      setError(e)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <span className={asLink ? "inline-flex min-w-0 max-w-full flex-wrap items-center gap-2" : compact ? "inline-flex flex-nowrap items-center gap-1" : "inline-flex flex-wrap items-center gap-2"}>
      {!asLink && <Button
        type="button"
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'sm' : 'md'}
        className={compact ? 'h-9 w-[108px] whitespace-nowrap !bg-amber-100 !px-2 !font-semibold !text-amber-900 hover:!bg-amber-200 hover:!text-amber-950 active:!bg-amber-300' : 'min-h-11 whitespace-nowrap'}
        disabled={busy}
        onClick={openPreview}
      >
        {busy ? "Đang tải…" : previewLabel || "Xem trước"}
      </Button>}
      {!previewOnly && (asLink ? <button
        type="button"
        className={chatFile ? 'support-chat-file' : "max-w-full break-words text-left font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900 disabled:cursor-wait disabled:opacity-60 [overflow-wrap:anywhere]"}
        disabled={busy}
        title={chatFile ? fileName || label || "Xem tệp đính kèm" : "Xem tệp đính kèm"}
        onClick={openPreview}
      >{chatFile && <span className="support-chat-file-icon" aria-hidden="true"><svg className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg></span>}<span>{busy ? "Đang tải…" : fileName || label || `Tệp đính kèm ${index}`}</span></button> : <Button
        type="button"
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'sm' : 'md'}
        className={compact ? 'h-9 w-[108px] whitespace-nowrap !bg-amber-100 !px-2 !font-semibold !text-amber-900 hover:!bg-amber-200 hover:!text-amber-950 active:!bg-amber-300' : 'min-h-11 whitespace-nowrap'}
        disabled={busy}
        onClick={download}
      >
        {label || `Tải minh chứng ${index}`}
      </Button>)}
      {!!error && <span role="alert">{integrationError(error)}</span>}
      {previewFile && <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(undefined)} />}
    </span>
  )
}
