import { useRef, useState } from "react"
import { Button } from "../../components/ui"
import {
  downloadDuongEvidence,
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
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  const lock = useRef(false)
  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        {label}
        <input
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
              const uploaded = await uploadDuongEvidence(
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
}: {
  id: string
  index?: number
  label?: string
  previewLabel?: string
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  const lock = useRef(false)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
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
      <Button
        type="button"
        variant="outline"
        className="min-h-11 whitespace-nowrap"
        disabled={busy}
        onClick={async () => {
          if (lock.current) return
          lock.current = true
          setBusy(true)
          setError(undefined)
          try {
            const file = await downloadDuongEvidence(id)
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
        }}
      >
        {label || `Tải minh chứng ${index}`}
      </Button>
      {!!error && <span role="alert">{integrationError(error)}</span>}
    </span>
  )
}
