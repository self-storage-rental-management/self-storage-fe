import { ApiClientError } from "../../services/apiClient"
import type { ApiActor } from "../../services/authApi"
import type { SupportRole, SupportTicket } from "../../types/supportApi"

export const supportInputClass =
  "w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:bg-stone-100"
export const supportStatusLabels = {
  open: "Chờ phân công / Chờ nhận",
  in_progress: "Đang xử lý",
  waiting_customer: "Chờ Customer bổ sung",
  resolved: "Đã xử lý — chờ xác nhận",
  closed: "Đã đóng",
}
export const supportModuleLabels = {
  PAYMENT: "Thanh toán",
  RETURN_SETTLEMENT: "Quyết toán trả kho",
  MAINTENANCE: "Bảo trì",
  HANDOVER: "Bàn giao",
  ACCOUNT: "Tài khoản",
  RENEWAL: "Gia hạn",
  OVERDUE: "Quá hạn",
}
export const supportEventLabels: Record<string, string> = {
  CREATED: "Tạo yêu cầu",
  ASSIGNED: "Phân công / Giao lại",
  ACCEPTED: "Staff nhận việc",
  REQUEST_INFORMATION: "Yêu cầu Customer bổ sung",
  RESOLVED: "Staff xử lý xong",
  CLOSED: "Customer xác nhận đóng",
  REOPENED: "Customer mở lại",
  ESCALATED: "Đề nghị điều phối",
  ESCALATION_ROUTED: "Manager chuyển module",
  ESCALATION_REJECTED: "Manager từ chối điều phối",
  AUTO_CLOSED: "Tự đóng theo policy",
}
export function supportError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === null || error.status >= 500) return error.message
    if (error.message.includes("DEFERRED_SOURCE"))
      return `Chưa có nguồn dữ liệu/policy chung; thao tác chưa được thực hiện. ${error.message}`
    if (error.status === 401)
      return "Phiên đăng nhập API đã hết hạn. Vui lòng đăng nhập lại."
    if (error.status === 403)
      return "Không có quyền Hỗ trợ hoặc phạm vi cơ sở phù hợp. Staff cần quyền manage_support thật từ BE."
    if (error.status === 404)
      return "Không tìm thấy yêu cầu trong phạm vi hiện tại hoặc bạn không còn là Staff phụ trách."
    if (error.status === 409)
      return `Trạng thái/phiên bản đã thay đổi hoặc nghiệp vụ chưa cho phép. Hãy tải lại hồ sơ. ${error.message}`
  }
  return error instanceof Error
    ? error.message
    : "Không thể xử lý Hỗ trợ. Vui lòng thử lại."
}
export function canReadSupport(actor: ApiActor | null, role: SupportRole) {
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    !actor.roles.includes(
      role === "customer"
        ? "CUSTOMER"
        : role === "manager"
          ? "MANAGER"
          : "STAFF",
    )
  )
    return false
  if (role === "customer") return true
  if (!actor.permissions.includes("view_support")) return false
  if (role === "staff" && !actor.permissions.includes("manage_support"))
    return false
  return Object.values(actor.facilityScopes).some((s) =>
    role === "manager"
      ? ["READ", "OPERATE", "MANAGE"].includes(s)
      : s === "OPERATE" || s === "MANAGE",
  )
}
export function supportTicketVisible(
  actor: ApiActor,
  role: SupportRole,
  ticket: SupportTicket,
) {
  if (role === "customer") return ticket.customerId === actor.id
  const scope = actor.facilityScopes[ticket.facilityId ?? ""]
  return role === "manager"
    ? ["READ", "OPERATE", "MANAGE"].includes(scope)
    : ["OPERATE", "MANAGE"].includes(scope) &&
        ticket.assignedStaffId === actor.id
}
export function supportActions(
  actor: ApiActor | null,
  role: SupportRole,
  t: SupportTicket,
): string[] {
  if (
    !canReadSupport(actor, role) ||
    !t.workflowReady ||
    t.version === null ||
    !t.facilityId
  )
    return []
  if (role === "customer") {
    if (actor!.id !== t.customerId) return []
    return t.status === "closed"
      ? ["follow-up"]
      : t.status === "resolved"
        ? ["message", "reopen", "close"]
        : ["message"]
  }
  const scope = actor!.facilityScopes[t.facilityId]
  if (!actor!.permissions.includes("manage_support")) return []
  if (role === "manager")
    return scope === "MANAGE" && !["resolved", "closed"].includes(t.status)
      ? ["assign", "decision"]
      : []
  if (!["OPERATE", "MANAGE"].includes(scope) || t.assignedStaffId !== actor!.id)
    return []
  if (t.status === "open") return ["accept"]
  if (!t.acceptedAt) return []
  return t.status === "in_progress"
    ? ["message", "information", "resolve", "escalate"]
    : t.status === "waiting_customer"
      ? ["message"]
      : []
}
