import { useManagerPresentation } from "../manager/managerPresentation"
import { useRef, useState } from "react"
import { Button } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import { listSupportEscalations } from "../../services/supportApi"
import { supportModules } from "../../types/supportApi"
import type {
  SupportCommand,
  SupportModule,
  SupportRole,
  SupportTicket,
} from "../../types/supportApi"
import ApiPager from "../rental-api/ApiPager"
import SupportReadState from "./SupportReadState"
import SupportStaffPicker from "./SupportStaffPicker"
import { EvidenceUpload } from "../rental-support-integration/EvidenceControls"
import {
  supportActions,
  supportInputClass,
  supportModuleLabels,
} from "./presentation"

const labels: Record<string, string> = {
  assign: "Phân công nhân viên",
  accept: "Nhận xử lý",
  message: "Gửi trao đổi",
  information: "Yêu cầu khách hàng bổ sung",
  resolve: "Báo kết quả xử lý",
  close: "Xác nhận kết quả và đóng",
  reopen: "Mở lại yêu cầu",
  escalate: "Đề nghị chuyển bộ phận",
  decision: "Xử lý yêu cầu chuyển bộ phận",
}
export type SupportDraft = { body: string; files: string[] }
export default function SupportActionForm({
  role,
  ticket: t,
  command,
  onUploadBusy,
  mode = "all",
  internal = false,
  draft,
  onDraftChange,
}: {
  role: SupportRole
  ticket: SupportTicket
  command: ReturnType<typeof useSupportCommand>
  onUploadBusy?: (busy: boolean) => void
  internal?: boolean
  mode?: "all" | "message" | "operations"
  draft?: SupportDraft
  onDraftChange?: (draft: SupportDraft) => void
}) {
  const { manager, copy } = useManagerPresentation()

  const actor = getAuthenticatedActor()
  const actions = supportActions(actor, role, t).filter(
    (a) => a !== "follow-up" && (mode === "message" ? a === "message" : mode === "operations" ? a !== "message" && a !== "escalate" && !(role === "staff" && ["information", "resolve"].includes(a)) : true),
  )
  const [action, setAction] = useState(actions[0] ?? "")
  const [localBody, setLocalBody] = useState(""),
    [staffId, setStaffId] = useState("")
  const visibility = internal ? "INTERNAL" as const : "PUBLIC" as const
  const [localFiles, setLocalFiles] = useState<string[]>([]), [uploading, setUploading] = useState(false)
  const uploadLock = useRef(false)
  const body = draft?.body ?? localBody
  const files = draft?.files ?? localFiles
  const setBody = (value: string) => onDraftChange ? onDraftChange({ body: value, files }) : setLocalBody(value)
  const setFiles = (value: string[]) => onDraftChange ? onDraftChange({ body, files: value }) : setLocalFiles(value)
  const [module, setModule] = useState<SupportModule>("PAYMENT")
  const [escalationId, setEscalationId] = useState(""),
    [decision, setDecision] = useState<"ROUTE" | "REJECT">("ROUTE")
  if (actions.length === 0 && mode !== "all") return null
  if (!actions.includes(action) || t.version === null)
    return (
      <p className="text-sm text-stone-500">
        Không có thao tác phù hợp với quyền và trạng thái hiện tại.
      </p>
    )
  const limit = ["assign", "reopen", "escalate", "decision", "close"].includes(
    action,
  )
    ? 2000
    : 4000
  const canResolve = !internal && role === "staff" && body.length <= 4000 && (!!body.trim() || files.length > 0)
  const needsBody = !["accept", "close", "resolve"].includes(action)
  const valid =
    (!needsBody || !!body.trim()) &&
    body.length <= limit &&
    (action !== "resolve" || canResolve) &&
    (action !== "assign" || (!!staffId && staffId !== t.assignedStaffId)) &&
    (action !== "decision" || !!escalationId)
  const submit = (requestedAction = action) => {
    if (
      !(requestedAction === "resolve" ? canResolve : valid) || uploadLock.current || uploading || command.locked || command.conflict ||
      !supportActions(getAuthenticatedActor(), role, t).includes(requestedAction)
    )
      return
    const version = { expectedVersion: t.version! },
      reason = body.trim()
    let input: SupportCommand
    switch (requestedAction) {
      case "assign":
        input = { kind: "assign", ...version, assignedStaffId: staffId, reason }
        break
      case "accept":
        input = { kind: "accept", ...version }
        break
      case "message":
        input =
          role !== "customer"
            ? { kind: "message", body: reason, visibility, evidenceFileIds: files }
            : { kind: "message", body: reason, ...version, evidenceFileIds: files }
        break
      case "information":
        input = { kind: "information", ...version, message: reason, evidenceFileIds: files }
        break
      case "resolve":
        input = { kind: "resolve", ...version, summary: reason, evidenceFileIds: files }
        break
      case "close":
        input = { kind: "close", ...version, feedback: reason || undefined }
        break
      case "reopen":
        input = { kind: "reopen", ...version, reason }
        break
      case "escalate":
        input = { kind: "escalate", ...version, targetModule: module, reason, evidenceFileIds: files }
        break
      case "decision":
        input = {
          kind: "decision",
          ...version,
          escalationId,
          action: decision,
          reason,
        }
        break
      default:
        return
    }
    void command.run({ kind: "command", role, id: t.id, command: input })
  }
  return (
    <form
      className={mode === "message" ? "space-y-4" : "space-y-4 rounded-lg border border-stone-200 p-4"}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {mode !== "message" && <h3 className="font-semibold">{actions.length === 1 ? copy(labels[action]) : "Xử lý yêu cầu"}</h3>}
      {actions.length > 1 && <label className="block text-sm">
        Thao tác
        <select
          className={supportInputClass}
          value={action}
          disabled={command.locked || uploading}
          onChange={(e) => {
            setAction(e.target.value)
            setFiles([])
            setBody("")
            setStaffId("")
            setEscalationId("")
          }}
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {labels[a]}
            </option>
          ))}
        </select>
      </label>}
      {action === "assign" && t.facilityId && (
        <SupportStaffPicker
          key={t.facilityId}
          facilityId={t.facilityId}
          value={staffId}
          onChange={setStaffId}
          disabled={command.locked}
        />
      )}
      {action === "escalate" && (
        <label className="block text-sm">
          Bộ phận tiếp nhận<select
            className={supportInputClass}
            value={module}
            disabled={command.locked}
            onChange={(e) => setModule(e.target.value as SupportModule)}
          >
            {supportModules.map((m) => (
              <option key={m} value={m}>
                {copy(supportModuleLabels[m])}
              </option>
            ))}
          </select>
        </label>
      )}
      {action === "decision" && (
        <>
          <EscalationPicker
            id={t.id}
            value={escalationId}
            onChange={setEscalationId}
            disabled={command.locked}
          />
          <label className="block text-sm">
            Quyết định
            <select
              className={supportInputClass}
              value={decision}
              disabled={command.locked}
              onChange={(e) =>
                setDecision(e.target.value as "ROUTE" | "REJECT")
              }
            >
              <option value="ROUTE">Chuyển tới bộ phận phụ trách</option>
              <option value="REJECT">Từ chối chuyển, trả về nhân viên</option>
            </select>
          </label>
        </>
      )}
      {action !== "accept" && (
        <label className="block text-sm">
          {action === "close"
            ? "Phản hồi (không bắt buộc)"
            : action === "assign" ||
                action === "decision" ||
                action === "reopen" ||
                action === "escalate"
              ? "Lý do"
            : action === "message" ? mode === "message" ? null : "Nội dung trao đổi" : "Nội dung / kết quả"}
          <textarea
            aria-label={mode === "message" ? "Nội dung tin nhắn" : undefined}
            className={supportInputClass}
            rows={mode === "message" ? 3 : 2}
            placeholder={mode === "message" ? "Nhập tin nhắn..." : undefined}
            maxLength={limit}
            value={body}
            required={needsBody}
            disabled={command.locked}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={e => {
              if (mode === "message" && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
          />
        </label>
      )}
      <div className={mode === "message" ? "flex flex-wrap items-start gap-2" : "space-y-4"}>
      {["message", "information", "resolve", "escalate"].includes(action) && <EvidenceUpload
        compact={mode === "message"}
        key={`${action}:${visibility}`}
        entityType={internal || action === "escalate" ? "DUONG_SUPPORT_INTERNAL" : "DUONG_SUPPORT_PUBLIC"}
        entityId={t.id} value={files} onChange={setFiles} disabled={command.locked} onBusy={busy => { uploadLock.current = busy; setUploading(busy); onUploadBusy?.(busy) }}
      />}
      <Button
        type="submit"
        size={mode === "message" ? "sm" : "md"}
        disabled={command.locked || uploading || command.conflict || !valid}
      >
        {mode === "message" ? command.busy ? "Đang gửi..." : "Gửi tin nhắn" : copy(labels[action])}
      </Button>
      {mode === "message" && !internal && role === "staff" && supportActions(actor, role, t).includes("resolve") && <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={command.locked || uploading || command.conflict || !canResolve}
        title="Nhập mô tả hoặc đính kèm minh chứng trước khi báo đã xử lý"
        onClick={() => submit("resolve")}
      >Báo đã xử lý</Button>}
      </div>
      {mode === "message" && <p className="text-[11px] text-stone-400">Enter để gửi, Shift+Enter để xuống dòng.</p>}
    </form>
  )
}
function EscalationPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const { manager, copy } = useManagerPresentation()

  const [page, setPage] = useState(0)
  const read = useRentalApiResource(
    `${getAuthenticatedActor()?.id}:support-escalation-picker:${id}:${page}`,
    () => listSupportEscalations("manager", id, page),
  )
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Yêu cầu chờ chuyển bộ phận
        <select
          className={supportInputClass}
          value={value}
          disabled={disabled || read.loading || !read.data}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Chọn yêu cầu đang chờ xử lý</option>
          {value && !read.data?.data.some((e) => e.id === value) && (
            <option value={value}>{value}</option>
          )}
          {read.data?.data
            .filter((e) => e.status === "REQUESTED")
            .map((e) => (
              <option key={e.id} value={e.id}>
                {copy(supportModuleLabels[e.targetModule])}, {e.id}
              </option>
            ))}
        </select>
      </label>
      <SupportReadState {...read} retry={read.refresh} />
      {read.data && (
        <ApiPager
          pagination={read.data.pagination}
          onPage={setPage}
          disabled={disabled}
        />
      )}
    </div>
  )
}
