import { useEffect, useRef, useState } from "react"
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
  upload?: (file: File) => Promise<{ id: string }>
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  const lock = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2 text-sm">
      {compact && <Button type="button" variant="outline" size="sm"
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
      {!!value.length && <p>Đã chọn {value.length} tệp.</p>}
      {value.map((id, index) => <Button type="button" key={id} variant="outline" disabled={disabled || busy} onClick={() => onChange(value.filter((_, i) => i !== index))}>Bỏ tệp {index + 1}</Button>)}
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
}: {
  id: string
  index?: number
  label?: string
  previewLabel?: string
  asLink?: boolean
  previewOnly?: boolean
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  const lock = useRef(false)
  const [fileName, setFileName] = useState<string | null>(null)
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
  return (
    <span className={asLink ? "inline-flex min-w-0 max-w-full flex-wrap items-center gap-2" : "inline-flex flex-wrap items-center gap-2"}>
      {previewLabel && <Button
        type="button"
        variant="outline"
        className="min-h-11 whitespace-nowrap"
        disabled={busy}
        onClick={async () => {
          if (lock.current) return
          lock.current = true
          setBusy(true)
          setError(undefined)
          const preview = window.open("about:blank", "_blank")
          if (preview) preview.opener = null
          try {
            const file = await downloadDuongEvidence(id)
            const url = URL.createObjectURL(file.blob)
            if (preview) {
              preview.location.href = url
              setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
            } else {
              const a = document.createElement("a")
              a.href = url
              a.download = file.fileName || "minh-chung"
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }
          } catch (e) {
            preview?.close()
            setError(e)
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        {busy ? "Đang tải…" : previewLabel}
      </Button>}
      {!previewOnly && (asLink ? <button
        type="button"
        className="max-w-full break-words text-left font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900 disabled:cursor-wait disabled:opacity-60 [overflow-wrap:anywhere]"
        disabled={busy}
        title="Tải về"
        onClick={download}
      >{busy ? "Đang tải…" : fileName || label || `Minh chứng ${index}`}</button> : <Button
        type="button"
        variant="outline"
        className="min-h-11 whitespace-nowrap"
        disabled={busy}
        onClick={download}
      >
        {label || `Tải minh chứng ${index}`}
      </Button>)}
      {!!error && <span role="alert">{integrationError(error)}</span>}
    </span>
  )
}
