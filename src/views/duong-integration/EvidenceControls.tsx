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
  limit = 10,
}: {
  entityType: string
  entityId?: string
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  onBusy?: (busy: boolean) => void
  limit?: number
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  const lock = useRef(false)
  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        Đính kèm minh chứng
        <input
          className="mt-1 block w-full"
          type="file"
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
}: {
  id: string
  index?: number
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  return (
    <span className="inline-block mr-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
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
            setBusy(false)
          }
        }}
      >
        Tải minh chứng {index}
      </Button>
      {!!error && <span role="alert">{integrationError(error)}</span>}
    </span>
  )
}
