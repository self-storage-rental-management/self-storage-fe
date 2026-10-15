import { useManagerPresentation } from "../manager/managerPresentation"
import { useState } from "react"
import { Badge, Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getSupportTicket,
  listSupportEscalations,
  listSupportEvents,
  listSupportMessages,
} from "../../services/supportApi"
import type {
  SupportEscalation,
  SupportEvent,
  SupportMessage,
  SupportPage,
  SupportRole,
  SupportTicket,
} from "../../types/supportApi"
import ApiPager from "../rental-api/ApiPager"
import { rentalDate } from "../rental-api/presentation"
import SupportActionForm from "./SupportActionForm"
import SupportNotificationReceipts from "../rental-support-integration/SupportNotificationReceipts"
import { EvidenceDownload } from "../rental-support-integration/EvidenceControls"
import SupportReadState from "./SupportReadState"
import {
  supportActions,
  supportEventLabels,
  supportModuleLabels,
  supportStatusLabels,
  supportPriorityLabels,
  supportLinkLabels,
  supportReceiverLabels,
  supportTicketVisible,
  supportAssigneeLabel,
} from "./presentation"

export function SupportTicketSummary({ ticket: t, role = "customer" }: { ticket: SupportTicket; role?: SupportRole }) {
  const { copy } = useManagerPresentation()
  const [copied, setCopied] = useState(false)
  const facilityName = t.facilityId ? getAuthenticatedActor()?.facilityNames?.[t.facilityId] : undefined
  const otherFields: [string, string][] = [
    ...(role === "customer" ? [] : [["Mã khách hàng", t.customerId] as [string, string]]),
    ["Nhân viên phụ trách", supportAssigneeLabel(t, role)],
    ...(t.parentTicketId ? [["Yêu cầu gốc", `#${t.parentTicketId.slice(0, 8)}`] as [string, string]] : []),
    ...(t.resolvedBy && role !== "customer" ? [["Người xử lý xong", t.resolvedBy] as [string, string]] : []),
    ...([
      ["Phân công lúc", t.assignedAt],
      ["Nhân viên nhận lúc", t.acceptedAt],
      ["Xử lý xong lúc", t.resolvedAt],
      ["Đóng lúc", t.closedAt],
    ] as const).filter(([, date]) => Boolean(date)).map(([label, date]) => [label, supportDetailDate(date)] as [string, string]),
  ]

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold text-stone-900">{t.subject}</h3>
          <span className="inline-flex items-center gap-1 font-mono text-xs text-stone-500" title={t.id}>#{t.id.slice(0, 8)}
            <button type="button" className="rounded p-0.5 hover:bg-stone-100 hover:text-stone-900" title={copied ? "Đã sao chép" : "Sao chép mã yêu cầu"} aria-label="Sao chép mã yêu cầu" onClick={async () => {
              try { await navigator.clipboard.writeText(t.id); setCopied(true) }
              catch { setCopied(false) }
            }}>{copied ? "✓" : "⧉"}</button>
          </span>
        </div>
        <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${t.status === "open" ? "bg-slate-100 text-slate-700" : t.status === "in_progress" ? "bg-blue-50 text-blue-700" : t.status === "resolved" || t.status === "closed" ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-800"}`}>{copy(supportStatusLabels[t.status])}</span>
      </div>
      <p className="whitespace-pre-wrap break-words rounded-lg bg-stone-50 px-3 py-2 text-stone-800">
        {t.description}
      </p>
      <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {([
          ["Tạo lúc", supportDetailDate(t.createdAt)],
          ...(t.facilityId ? [["Cơ sở", facilityName || `#${t.facilityId.slice(0, 8)}`]] : []),
          ...(t.linkedId ? [["Hồ sơ liên kết", `${supportLinkLabels[t.linkedType || ""] || "Hồ sơ"} #${t.linkedId.slice(0, 8)}`]] : []),
        ] as [string, string][]).map(([label, value]) => <div key={label} className="min-w-0">
          <dt className="text-xs text-stone-500">{label}</dt><dd className="break-words font-medium text-stone-900">{value}</dd>
        </div>)}
      </dl>
      {t.status === "resolved" && (
        <p role="status" className="rounded bg-blue-50 p-3 text-blue-900">
          Đã xử lý xong, chờ khách hàng xác nhận. Nếu chưa hài lòng, khách hàng có thể yêu cầu mở lại.</p>
      )}
      <details className="rounded-lg border border-stone-200 px-3 py-2 text-stone-700">
        <summary className="cursor-pointer font-medium">Thông tin xử lý</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{otherFields.map(([label, value]) => <div key={label} className="min-w-0">
          <dt className="text-xs text-stone-500">{label}</dt><dd className="break-all">{value}</dd>
        </div>)}</dl>
      </details>
    </div>
  )
}

function supportDetailDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Chưa ghi nhận"
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))
}
export default function SupportTicketDetail({
  role,
  id,
  command,
  onFollowUp,
  onUploadBusy,
}: {
  role: SupportRole
  id: string
  command: ReturnType<typeof useSupportCommand>
  onFollowUp: (parent: SupportTicket) => void
  onUploadBusy?: (busy: boolean) => void
}) {
  const { manager, copy } = useManagerPresentation()

  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${id}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  const read = useRentalApiResource(identity, () => getSupportTicket(role, id))
  const t = read.data
  const refresh = () => {
    if (!command.locked) read.refresh()
  }
  if (t && (!actor || !supportTicketVisible(actor, role, t)))
    return (
      <p role="alert">
        Bạn không còn quyền với yêu cầu này. Vui lòng quay về danh sách yêu cầu.
      </p>
    )
  return (
    <div className="min-w-0 space-y-5">
      <SupportReadState {...read} retry={refresh} />
      {t && (
        <>
          <SupportTicketSummary ticket={t} role={role} />
          {role === "customer" && <SupportNotificationReceipts key={identity} ticketId={id} locked={command.locked} />}
          <SupportTimeline
            key={`${identity}:${t.version}`}
            role={role}
            id={id}
            identity={identity}
            locked={command.locked}
            initialDescription={t.description}
            initialCreatedAt={t.createdAt}
          />
          {role !== "manager" && <SupportActionForm
            key={`${id}:${t.version}`}
            role={role}
            ticket={t}
            command={command}
            onUploadBusy={onUploadBusy}
          />}
          {supportActions(actor, role, t).includes("follow-up") && (
            <Button disabled={command.locked} onClick={() => onFollowUp(t)}>
              Tạo yêu cầu tiếp nối
            </Button>
          )}
        </>
      )}
    </div>
  )
}
function SupportTimeline({
  role,
  id,
  identity,
  locked,
  initialDescription,
  initialCreatedAt,
}: {
  role: SupportRole
  id: string
  identity: string
  locked: boolean
  initialDescription: string
  initialCreatedAt: string
}) {
  const [tab, setTab] = useState<"messages" | "events" | "escalations">(
    "messages",
  )
  const [page, setPage] = useState(0)
  const read =
    useRentalApiResource<SupportPage<SupportMessage | SupportEvent | SupportEscalation>>(
      `${identity}:${tab}:${page}`,
      () =>
        tab === "messages"
          ? listSupportMessages(role, id, page)
          : tab === "events"
            ? listSupportEvents(role, id, page)
            : listSupportEscalations(role, id, page),
    )
  const tabs =
    role === "customer"
      ? ["messages"] as const
      : ["messages", "events", "escalations"] as const
  const isRepeatedOpeningMessage = (message: SupportMessage, index: number) =>
    role === "customer" && tab === "messages" && page === 0 && index === 0 &&
    message.authorRole === "CUSTOMER" && message.body.trim() === initialDescription.trim() &&
    Date.parse(message.sentAt) === Date.parse(initialCreatedAt)
  return (
    <Card className="min-w-0 space-y-3 p-4">
      {role === "customer" ? <h3 className="font-semibold">Trao đổi</h3> : <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t}
            variant={tab === t ? "primary" : "outline"}
            disabled={locked}
            onClick={() => {
              setTab(t)
              setPage(0)
            }}
          >
            {t === "messages"
              ? "Trao đổi"
              : t === "events"
                ? "Lịch sử nội bộ"
                : "Điều phối nội bộ"}
          </Button>
        ))}
      </div>}
      <SupportReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          {read.data.data.map((row, index) => {
            const message = row as SupportMessage
            const repeatedOpeningMessage = isRepeatedOpeningMessage(message, index)
            if (repeatedOpeningMessage && !message.evidenceFileIds?.length && message.evidenceCompleteness !== "UNKNOWN") return null
            return (
            <div
              key={row.id}
              className="min-w-0 space-y-1 rounded border border-stone-200 p-3 text-sm"
            >
              {tab === "messages" ? (
                <MessageRow message={message} role={role} hideBody={repeatedOpeningMessage} />
              ) : tab === "events" ? (
                <EventRow event={row as SupportEvent} />
              ) : (
                <EscalationRow escalation={row as SupportEscalation} />
              )}
            </div>
          )})}
          {(read.data.data.length === 0 || (tab === "messages" && read.data.data.length === 1 &&
            isRepeatedOpeningMessage(read.data.data[0] as SupportMessage, 0) &&
            !(read.data.data[0] as SupportMessage).evidenceFileIds?.length &&
            (read.data.data[0] as SupportMessage).evidenceCompleteness !== "UNKNOWN")) && (
            <p className="text-sm text-stone-500">
              Chưa có trao đổi mới.
            </p>
          )}
          {read.data.pagination.totalPages > 1 && <ApiPager
            pagination={read.data.pagination}
            onPage={setPage}
            disabled={locked}
          />}
        </>
      )}
    </Card>
  )
}
function MessageRow({ message: m, role, hideBody }: { message: SupportMessage; role: SupportRole; hideBody: boolean }) {

  return (
    <>
      <p>
        {m.authorRole === "STAFF" ? "Nhân viên" : "Khách hàng"},{" "}
        {supportDetailDate(m.sentAt)}{" "}
        {(role !== "customer" || m.visibility === "INTERNAL") && <Badge variant={m.visibility === "INTERNAL" ? "warning" : "muted"}>
          {m.visibility === "INTERNAL" ? "Nội bộ" : "Công khai"}
        </Badge>}
      </p>
      {!hideBody && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
      {(m.evidenceCompleteness === "UNKNOWN" || !!m.evidenceFileIds?.length) && <p className="text-xs text-stone-500">
        {m.evidenceCompleteness === "UNKNOWN" ? "Chưa thể xem tệp đính kèm." : "Tệp đính kèm:"}
      </p>}
      {m.evidenceCompleteness !== "UNKNOWN" && m.evidenceFileIds?.map((id, index) => <EvidenceDownload key={id} id={id} index={index + 1} />)}
    </>
  )
}
function EventRow({ event: e }: { event: SupportEvent }) {
  const { manager, copy } = useManagerPresentation()

  return (
    <>
      <p className="font-semibold">
        {copy(supportEventLabels[e.type] ?? "Hoạt động chưa có mô tả")}, Lần phân công{" "}
        {e.assignmentRevision}
      </p>
      <p>{rentalDate(e.recordedAt)}</p>
      <p className="whitespace-pre-wrap break-words">{e.reason}</p>
      <p className="break-all text-xs text-stone-500">
        Mã người thực hiện: {e.actorId ?? "Tác vụ hệ thống"}, Nhân viên:{" "}
        {e.assignedStaffId ?? "Chưa phân công"}
      </p>
    </>
  )
}
function EscalationRow({ escalation: e }: { escalation: SupportEscalation }) {
  const { manager, copy } = useManagerPresentation()

  return (
    <>
      <p className="font-semibold">
        {copy(supportModuleLabels[e.targetModule])},{" "}
        {e.status === "REQUESTED"
          ? "Chờ quản lý chuyển bộ phận"
          : e.status === "ROUTED"
            ? "Đã chuyển xử lý - chưa hoàn tất"
            : "Quản lý từ chối chuyển bộ phận"}
      </p>
      <p className="break-all text-xs text-stone-500">{e.id}</p>
      <p className="whitespace-pre-wrap break-words">{e.reason}</p>
      {e.decisionReason && (
        <p className="whitespace-pre-wrap break-words">
          Quyết định: {e.decisionReason}
        </p>
      )}
      <p>Gửi lúc: {rentalDate(e.requestedAt)}</p>
      <p>Kết quả bộ phận tiếp nhận: {supportReceiverLabels[e.receiverStatus ?? ""] ?? "Chưa có thông tin kết quả"}</p>
      {e.resultRef && (
        <p className="break-all">Mã kết quả: {e.resultRef}</p>
      )}
    </>
  )
}
