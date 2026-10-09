import { Button } from "../../components/ui"
import { supportError } from "./presentation"

export default function SupportReadState({
  loading,
  error,
  retry,
}: {
  loading: boolean
  error?: unknown
  retry: () => void
}) {
  if (loading)
    return (
      <p role="status" className="p-4 text-sm text-stone-500">
        Đang tải yêu cầu Hỗ trợ…
      </p>
    )
  if (!error) return null
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm"
    >
      <p>{supportError(error)}</p>
      <Button variant="outline" onClick={retry}>
        Tải lại
      </Button>
    </div>
  )
}
