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
import SupportReadState from "./SupportReadState"
import {
  supportActions,
  supportEventLabels,
  supportModuleLabels,
  supportStatusLabels,
  supportTicketVisible,
} from "./presentation"

export function SupportTicketSummary({ ticket: t }: { ticket: SupportTicket }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="break-words text-lg font-semibold">{t.subject}</h3>
        <p className="break-all text-xs text-stone-500">Mã yêu cầu: {t.id}</p>
      </div>
      <Badge
        variant={
          t.status === "closed" || t.status === "resolved"
            ? "success"
            : "warning"
        }
      >
        {supportStatusLabels[t.status]}
      </Badge>
      <p className="whitespace-pre-wrap break-words rounded bg-stone-50 p-3">
        {t.description}
      </p>
      <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {([
          ["Customer", t.customerId],
          ["Cơ sở", t.facilityId ?? "Chưa có nguồn xác thực"],
          ["Staff phụ trách", t.assignedStaffId ?? "Chưa phân công"],
          [
            "Hồ sơ liên kết",
            t.linkedId ? `${t.linkedType}: ${t.linkedId}` : "Không liên kết",
          ],
          ["Yêu cầu gốc", t.parentTicketId ?? "Không có"],
          ["Người xử lý xong", t.resolvedBy ?? "Chưa có bản ghi"],
        ] as const).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-stone-500">{label}</dt>
            <dd className="break-all">{value}</dd>
          </div>
        ))}
        {([
          ["Tạo lúc", t.createdAt],
          ["Phân công lúc", t.assignedAt],
          ["Staff nhận lúc", t.acceptedAt],
          ["Xử lý xong lúc", t.resolvedAt],
          ["Đóng lúc", t.closedAt],
        ] as const).map(([label, date]) => (
          <div key={label}>
            <dt className="text-stone-500">{label}</dt>
            <dd>{rentalDate(date)}</dd>
          </div>
        ))}
      </dl>
      {!t.workflowReady && (
        <p role="status" className="rounded bg-amber-50 p-3 text-amber-900">
          Hồ sơ cũ chưa có workflow metadata được xác thực. Chỉ đọc; không tự
          backfill hoặc gán version 0.
        </p>
      )}
      {t.status === "resolved" && (
        <p role="status" className="rounded bg-blue-50 p-3 text-blue-900">
          Đã xử lý xong, chưa đóng. Customer có thể xác nhận kết quả hoặc yêu cầu mở lại;
          backend vẫn kiểm tra policy và quyền. Không mặc định ticket sẽ tự đóng:
          tự đóng còn cần policy chung và bằng chứng notification đúng lần xử lý này.
        </p>
      )}
      <div
        role="status"
        className="space-y-1 rounded border border-amber-200 bg-amber-50 p-3 text-amber-900"
      >
        {t.slaCompleteness === "UNKNOWN" || !t.sla ? (
          <>
            <p>SLA / mức ưu tiên: Chưa có nguồn policy/lịch làm việc chung.</p>
            <p>Không kết luận yêu cầu đang đúng hạn hoặc quá hạn.</p>
            {t.missingSourceReason && (
              <p className="break-words text-xs">{t.missingSourceReason}</p>
            )}
          </>
        ) : (
          <>
            <p>
              Policy: {t.sla.policyRef} · {t.sla.policyVersion} · Ưu tiên{" "}
              {t.sla.priority}
            </p>
            <p>Hạn phản hồi đầu: {rentalDate(t.sla.firstReplyDueAt)}</p>
            <p>Hạn cập nhật tiếp: {rentalDate(t.sla.nextUpdateDueAt)}</p>
            <p>
              {t.sla.activeWorkPaused
                ? "Tạm dừng thời gian xử lý do đang chờ Customer."
                : "Không tạm dừng thời gian xử lý."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
export default function SupportTicketDetail({
  role,
  id,
  command,
  onFollowUp,
}: {
  role: SupportRole
  id: string
  command: ReturnType<typeof useSupportCommand>
  onFollowUp: (parent: SupportTicket) => void
}) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${id}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  const read = useRentalApiResource(identity, () => getSupportTicket(role, id))
  const t = read.data
  if (t && (!actor || !supportTicketVisible(actor, role, t)))
    return (
      <p role="alert">
        Bạn không còn quyền với yêu cầu này. Vui lòng tải lại hàng đợi.
      </p>
    )
  return (
    <div className="min-w-0 space-y-5">
      <Button
        variant="outline"
        disabled={command.locked}
        onClick={read.refresh}
      >
        Tải lại chi tiết
      </Button>
      <SupportReadState {...read} retry={read.refresh} />
      {t && (
        <>
          <SupportTicketSummary ticket={t} />
          <SupportTimeline
            key={`${identity}:${t.version}`}
            role={role}
            id={id}
            identity={identity}
            locked={command.locked}
          />
          <SupportActionForm
            key={`${id}:${t.version}`}
            role={role}
            ticket={t}
            command={command}
          />
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
}: {
  role: SupportRole
  id: string
  identity: string
  locked: boolean
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
  return (
    <Card className="min-w-0 space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
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
      </div>
      <SupportReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          {read.data.data.map((row) => (
            <div
              key={row.id}
              className="min-w-0 space-y-1 rounded border border-stone-200 p-3 text-sm"
            >
              {tab === "messages" ? (
                <MessageRow message={row as SupportMessage} />
              ) : tab === "events" ? (
                <EventRow event={row as SupportEvent} />
              ) : (
                <EscalationRow escalation={row as SupportEscalation} />
              )}
            </div>
          ))}
          {read.data.data.length === 0 && (
            <p className="text-sm text-stone-500">
              Chưa có bản ghi trong phạm vi này.
            </p>
          )}
          <ApiPager
            pagination={read.data.pagination}
            onPage={setPage}
            disabled={locked}
          />
        </>
      )}
    </Card>
  )
}
function MessageRow({ message: m }: { message: SupportMessage }) {
  return (
    <>
      <p>
        {m.authorRole === "STAFF" ? "Staff" : "Customer"} ·{" "}
        {rentalDate(m.sentAt)}{" "}
        <Badge variant={m.visibility === "INTERNAL" ? "warning" : "muted"}>
          {m.visibility === "INTERNAL" ? "Nội bộ" : "Công khai"}
        </Badge>
      </p>
      <p className="break-all text-xs text-stone-500">
        Người gửi: {m.authorId}
      </p>
      <p className="whitespace-pre-wrap break-words">{m.body}</p>
      <p className="text-xs text-stone-500">
        {m.evidenceCompleteness === "UNKNOWN"
          ? "Minh chứng: chưa có nguồn xác thực quyền đọc, không hiển thị mã file."
          : m.evidenceFileIds?.length
            ? "Mã minh chứng được BE cho phép đọc; tải file chờ tích hợp quyền chung."
            : "Không đính kèm file."}
      </p>
      {m.evidenceCompleteness === "COMPLETE" &&
        m.evidenceFileIds?.map((id) => (
          <p key={id} className="break-all text-xs">
            {id}
          </p>
        ))}
    </>
  )
}
function EventRow({ event: e }: { event: SupportEvent }) {
  return (
    <>
      <p className="font-semibold">
        {supportEventLabels[e.type] ?? e.type} · Lần phân công{" "}
        {e.assignmentRevision}
      </p>
      <p>{rentalDate(e.recordedAt)}</p>
      <p className="whitespace-pre-wrap break-words">{e.reason}</p>
      <p className="break-all text-xs text-stone-500">
        Người thao tác: {e.actorId ?? "Tác vụ hệ thống"} · Staff:{" "}
        {e.assignedStaffId ?? "Chưa phân công"}
      </p>
    </>
  )
}
function EscalationRow({ escalation: e }: { escalation: SupportEscalation }) {
  return (
    <>
      <p className="font-semibold">
        {supportModuleLabels[e.targetModule]} ·{" "}
        {e.status === "REQUESTED"
          ? "Chờ Manager điều phối"
          : e.status === "ROUTED"
            ? "Đã chuyển module — chưa đồng nghĩa hoàn thành"
            : "Manager từ chối điều phối"}
      </p>
      <p className="break-all text-xs text-stone-500">{e.id}</p>
      <p className="whitespace-pre-wrap break-words">{e.reason}</p>
      {e.decisionReason && (
        <p className="whitespace-pre-wrap break-words">
          Quyết định: {e.decisionReason}
        </p>
      )}
      <p>Gửi lúc: {rentalDate(e.requestedAt)}</p>
      <p>Kết quả module nhận: {e.receiverStatus ?? "Chưa có nguồn xác thực"}</p>
      {e.resultRef && (
        <p className="break-all">Mã kết quả thật: {e.resultRef}</p>
      )}
    </>
  )
}
