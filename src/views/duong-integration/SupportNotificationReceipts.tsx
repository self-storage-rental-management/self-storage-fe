import { useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { getAuthenticatedActor } from "../../services/authApi"
import { listNotifications } from "../../services/notificationApi"
import {
  acknowledgeNotification,
  getNotificationAcknowledgement,
  integrationError,
  type NotificationAcknowledgementState,
} from "../../services/duongIntegrationApi"
import { isUuid, isInstant } from "../../services/renewalOperationsApi"
import { ApiClientError } from "../../services/apiClient"

export default function SupportNotificationReceipts({
  ticketId,
  locked,
}: {
  ticketId: string
  locked?: boolean
}) {
  const actor = getAuthenticatedActor(),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState<string>(),
    [error, setError] = useState<unknown>()
  const [receipts, setReceipts] = useState<Record<string, NotificationAcknowledgementState>>(
      {},
    ),
    pending = useRef(false)
  const read = useRentalApiResource(
    `${actor?.id}:support-notices:${ticketId}:${page}`,
    async () => {
      const result = await listNotifications(page, 20)
      if (
        !actor ||
        actor.status !== "ACTIVE" ||
        !actor.roles.includes("CUSTOMER") ||
        !Array.isArray(result.data) ||
        !result.data.every(
          (n) =>
            isUuid(n.id) &&
            n.userId === actor.id &&
            typeof n.title === "string" &&
            typeof n.content === "string" &&
            isInstant(n.createdAt),
        ) ||
        result.pagination?.page !== page ||
        !Number.isSafeInteger(result.pagination.totalPages)
      )
        throw new ApiClientError("Thông báo không đúng định dạng.", {
          code: "INVALID_RESPONSE",
        })
      const matching = result.data.filter(n => n.type === "SUPPORT" && n.relatedEntityId === ticketId)
      const states = await Promise.all(matching.map(async n => {
        try { return { id: n.id, state: await getNotificationAcknowledgement(n.id) } }
        catch { return { id: n.id, state: null } } // No proof: never offer an acknowledgement action.
      }))
      return { ...result, acknowledgements: Object.fromEntries(states.map(s => [s.id, s.state])) }
    },
  )
  const notices =
    read.data && Array.isArray(read.data.data)
      ? read.data.data.filter(
          (n) => n.type === "SUPPORT" && n.relatedEntityId === ticketId,
        )
      : []
  return (
    <Card className="p-4 space-y-3 text-sm">
      <h4 className="font-semibold">Thông báo về yêu cầu này</h4>
      {read.loading && <p role="status">Đang tải thông báo...</p>}
      {!!(read.error || error) && (
        <p role="alert">{integrationError(read.error || error)}</p>
      )}
      {read.data && !notices.length && <p>Không có dữ liệu trên trang này.</p>}
      {notices.map((n) => (
        <div key={n.id} className="rounded border p-3 space-y-2">
          <p className="font-semibold">{n.title}</p>
          <p className="whitespace-pre-wrap">{n.content}</p>
          <NotificationAcknowledgementControl state={receipts[n.id] || read.data?.acknowledgements[n.id] || null} busy={!!busy || !!locked}
            onAcknowledge={async () => {
              if (pending.current || locked) return
              pending.current = true
              setBusy(n.id)
              setError(undefined)
              try {
                const receipt = await acknowledgeNotification(n.id)
                setReceipts(v => ({ ...v, [n.id]: { ...receipt, acknowledgementAllowed: false } }))
              } catch (e) { setError(e) }
              finally { pending.current = false; setBusy(undefined) }
            }} />
        </div>
      ))}
      {read.data && read.data.pagination.totalPages > 1 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 0 || !!busy}
            onClick={() => setPage((p) => p - 1)}
          >
            Trang trước
          </Button>
          <span>
            Trang {page + 1} / {read.data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page + 1 >= read.data.pagination.totalPages || !!busy}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}
    </Card>
  )
}

export function NotificationAcknowledgementControl({ state, busy, onAcknowledge }: {
  state: NotificationAcknowledgementState | null
  busy: boolean
  onAcknowledge: () => void
}) {
  if (!state) return <p role="status">Chưa xác minh được trạng thái xác nhận của thông báo.</p>
  if (state.status === "UNTRACKED") return <p>Thông báo này không yêu cầu xác nhận đã nhận.</p>
  if (state.status === "ACKNOWLEDGED") return <p role="status">Đã xác nhận nhận thông báo. Thao tác này không đóng yêu cầu hỗ trợ.</p>
  if (!state.acknowledgementAllowed) return <p role="status">Chưa thể xác nhận thông báo này.</p>
  return <Button variant="outline" disabled={busy} onClick={onAcknowledge}>Xác nhận đã nhận thông báo</Button>
}
