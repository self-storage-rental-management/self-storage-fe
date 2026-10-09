import { useManagerPresentation } from "../manager/managerPresentation"
import { Button } from "../../components/ui"
import { rentalError } from "./presentation"
export default function ApiReadState({
  loading,
  error,
  retry,
}: {
  loading: boolean
  error?: unknown
  retry: () => void
}) {
  const { manager, copy, errorText } = useManagerPresentation()

  if (loading)
    return (
      <p role="status" className="p-4 text-stone-500">
        Đang tải dữ liệu…
      </p>
    )
  if (!error) return null
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3"
    >
      <p>{errorText(error, rentalError)}</p>
      {!manager && (<Button variant="outline" onClick={retry}>
        Tải lại
      </Button>)}
    </div>
  )
}
