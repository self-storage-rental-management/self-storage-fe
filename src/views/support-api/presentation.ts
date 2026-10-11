import { ApiClientError } from "../../services/apiClient"
import type { ApiActor } from "../../services/authApi"
import type { SupportRole, SupportTicket } from "../../types/supportApi"

export const supportInputClass =
  "w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:bg-stone-100"
export const supportStatusLabels = {
  open: "Chờ phân công / Chờ nhận",
  in_progress: "Đang xử lý",
  waiting_customer: "Chờ khách hàng bổ sung",
  resolved: "Đã xử lý - chờ xác nhận",
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
  ACCEPTED: "Nhân viên nhận việc",
  REQUEST_INFORMATION: "Yêu cầu khách hàng bổ sung",
  RESOLVED: "Nhân viên xử lý xong",
  CLOSED: "Khách hàng xác nhận đóng",
  REOPENED: "Khách hàng mở lại",
  ESCALATED: "Đề nghị điều phối",
  ESCALATION_ROUTED: "Quản lý chuyển bộ phận",
  ESCALATION_REJECTED: "Quản lý từ chối chuyển",
  AUTO_CLOSED: "Tự động đóng theo chính sách",
}
export function supportError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "INVALID_RESPONSE") return "Thông tin nhận được không hợp lệ. Vui lòng thử lại."
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (error.status === 403)
      return "Bạn không có quyền xử lý yêu cầu hỗ trợ tại cơ sở này."
    if (error.status === 404)
      return "Không tìm thấy yêu cầu trong phạm vi truy cập hoặc bạn không còn được phân công."
    if (error.code === "DEFERRED_SOURCE" || error.message.includes("DEFERRED_SOURCE"))
      return "Chưa đủ dữ liệu hoặc chính sách để tiếp tục xử lý."
    if (error.status === 409)
      return "Yêu cầu đã thay đổi hoặc chưa đủ điều kiện xử lý. Vui lòng mở lại yêu cầu."
    if (error.status === null || error.status >= 500)
      return "Chưa nhận được kết quả. Vui lòng kiểm tra kết nối và thử lại."
    return "Không thể xử lý yêu cầu. Vui lòng kiểm tra thông tin đã nhập."
  }
  return "Không thể xử lý yêu cầu hỗ trợ. Vui lòng thử lại."
}
export const supportPriorityLabels: Record<string,string> = {
  LOW: "Thấp", NORMAL: "Bình thường", MEDIUM: "Trung bình", HIGH: "Cao", URGENT: "Khẩn cấp", CRITICAL: "Nghiêm trọng",
}
export const supportLinkLabels: Record<string,string> = {
  RENTAL: "Hồ sơ thuê", RESERVATION: "Đặt chỗ", PAYMENT: "Giao dịch", STORAGE_UNIT: "Gian kho", UNIT: "Gian kho",
}
export const supportReceiverLabels: Record<string,string> = {
  REQUESTED: "Đang chờ tiếp nhận", QUEUED: "Đang chờ tiếp nhận", RECEIVED: "Đã tiếp nhận", ROUTED: "Đã chuyển xử lý",
  IN_PROGRESS: "Đang xử lý", COMPLETED: "Đã hoàn tất", SUCCEEDED: "Đã hoàn tất", FAILED: "Xử lý thất bại", REJECTED: "Bị từ chối",
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
  if (!actor.permissions.includes("support:read")) return false
  if (role === "staff" && !actor.permissions.includes("support:update"))
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
  if (!actor!.permissions.includes("support:update")) return []
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
