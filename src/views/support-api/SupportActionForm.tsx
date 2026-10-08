import { useState } from "react"
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
import {
  supportActions,
  supportInputClass,
  supportModuleLabels,
} from "./presentation"

const labels: Record<string, string> = {
  assign: "Giao / Giao lại Staff",
  accept: "Nhận xử lý",
  message: "Gửi trao đổi",
  information: "Yêu cầu Customer bổ sung",
  resolve: "Báo kết quả xử lý",
  close: "Xác nhận kết quả và đóng",
  reopen: "Mở lại yêu cầu",
  escalate: "Đề nghị điều phối module",
  decision: "Điều phối escalation",
}
export default function SupportActionForm({
  role,
  ticket: t,
  command,
}: {
  role: SupportRole
  ticket: SupportTicket
  command: ReturnType<typeof useSupportCommand>
}) {
  const actor = getAuthenticatedActor()
  const actions = supportActions(actor, role, t).filter(
    (a) => a !== "follow-up",
  )
  const [action, setAction] = useState(actions[0] ?? "")
  const [body, setBody] = useState(""),
    [staffId, setStaffId] = useState("")
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC")
  const [module, setModule] = useState<SupportModule>("PAYMENT")
  const [escalationId, setEscalationId] = useState(""),
    [decision, setDecision] = useState<"ROUTE" | "REJECT">("ROUTE")
  if (!actions.includes(action) || t.version === null)
    return (
      <p className="text-sm text-stone-500">
        Không có thao tác phù hợp theo role/trạng thái hiện tại.
      </p>
    )
  const limit = ["assign", "reopen", "escalate", "decision", "close"].includes(
    action,
  )
    ? 2000
    : 4000
  const needsBody = !["accept", "close"].includes(action)
  const valid =
    (!needsBody || !!body.trim()) &&
    body.length <= limit &&
    (action !== "assign" || (!!staffId && staffId !== t.assignedStaffId)) &&
    (action !== "decision" || !!escalationId)
  const submit = () => {
    if (
      !valid ||
      !supportActions(getAuthenticatedActor(), role, t).includes(action)
    )
      return
    const version = { expectedVersion: t.version! },
      reason = body.trim()
    let input: SupportCommand
    switch (action) {
      case "assign":
        input = { kind: "assign", ...version, assignedStaffId: staffId, reason }
        break
      case "accept":
        input = { kind: "accept", ...version }
        break
      case "message":
        input =
          role === "staff"
            ? { kind: "message", body: reason, visibility }
            : { kind: "message", body: reason, ...version }
        break
      case "information":
        input = { kind: "information", ...version, message: reason }
        break
      case "resolve":
        input = { kind: "resolve", ...version, summary: reason }
        break
      case "close":
        input = { kind: "close", ...version, feedback: reason || undefined }
        break
      case "reopen":
        input = { kind: "reopen", ...version, reason }
        break
      case "escalate":
        input = { kind: "escalate", ...version, targetModule: module, reason }
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
      className="space-y-4 rounded-lg border border-stone-200 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <h3 className="font-semibold">Thao tác theo role</h3>
      <label className="block text-sm">
        Thao tác
        <select
          className={supportInputClass}
          value={action}
          disabled={command.locked}
          onChange={(e) => {
            setAction(e.target.value)
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
      </label>
      {action === "assign" && t.facilityId && (
        <SupportStaffPicker
          key={t.facilityId}
          facilityId={t.facilityId}
          value={staffId}
          onChange={setStaffId}
          disabled={command.locked}
        />
      )}
      {action === "message" && role === "staff" && (
        <label className="block text-sm">
          Phạm vi trao đổi
          <select
            className={supportInputClass}
            value={visibility}
            disabled={command.locked}
            onChange={(e) =>
              setVisibility(e.target.value as "PUBLIC" | "INTERNAL")
            }
          >
            <option value="PUBLIC">Công khai với Customer</option>
            <option value="INTERNAL">Nội bộ — Customer không thấy</option>
          </select>
        </label>
      )}
      {action === "escalate" && (
        <label className="block text-sm">
          Module nhận điều phối
          <select
            className={supportInputClass}
            value={module}
            disabled={command.locked}
            onChange={(e) => setModule(e.target.value as SupportModule)}
          >
            {supportModules.map((m) => (
              <option key={m} value={m}>
                {supportModuleLabels[m]}
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
              <option value="ROUTE">Chuyển tới module được phép</option>
              <option value="REJECT">Từ chối điều phối, trả về Staff</option>
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
              : "Nội dung / kết quả"}
          <textarea
            className={supportInputClass}
            rows={3}
            maxLength={limit}
            value={body}
            required={needsBody}
            disabled={command.locked}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
      )}
      {["close", "resolve", "escalate", "decision"].includes(action) && (
        <p className="text-sm text-amber-800">
          BE kiểm tra policy và kết quả từ nguồn chung. Chuyển module không đồng
          nghĩa đã xử lý xong; ghi chú không thay thế kết quả thanh
          toán/refund/bảo trì. Thiếu nguồn sẽ bị chặn, không tự giả lập thành
          công.
        </p>
      )}
      <p className="text-xs text-stone-500">
        Phiên bản {t.version} · Lần phân công {t.assignmentRevision}. Manager
        không có thao tác hoàn thành thay Staff.
      </p>
      <Button
        type="submit"
        disabled={command.locked || command.conflict || !valid}
      >
        {labels[action]}
      </Button>
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
  const [page, setPage] = useState(0)
  const read = useRentalApiResource(
    `${getAuthenticatedActor()?.id}:support-escalation-picker:${id}:${page}`,
    () => listSupportEscalations("manager", id, page),
  )
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Escalation chờ điều phối
        <select
          className={supportInputClass}
          value={value}
          disabled={disabled || read.loading || !read.data}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Chọn yêu cầu đang REQUESTED</option>
          {value && !read.data?.data.some((e) => e.id === value) && (
            <option value={value}>{value}</option>
          )}
          {read.data?.data
            .filter((e) => e.status === "REQUESTED")
            .map((e) => (
              <option key={e.id} value={e.id}>
                {supportModuleLabels[e.targetModule]} · {e.id}
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
