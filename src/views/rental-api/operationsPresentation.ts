import type { ApiActor } from "../../services/authApi"
import { rentalError } from "./presentation"
import { ApiClientError } from "../../services/apiClient"
import type {
  RenewalOperationAction,
  RenewalOperationsRole,
  RenewalOperationState,
  RenewalExceptionProposal,
  RenewalOperationCommand,
} from "../../types/renewalOperationsApi"

export const operationLabels: Record<RenewalOperationAction, string> = {
  deposit: "Thanh toán cọc thử nghiệm",
  appointment: "Đề nghị lịch ký",
  reschedule: "Đổi lịch ký",
  confirmation: "Xác nhận đề xuất ngoại lệ",
  arrival: "Ghi nhận khách đến",
  incident: "Báo sự cố tại cơ sở",
  cash: "Ghi nhận thu tiền mặt",
  completion: "Hoàn tất ký gia hạn",
  exception: "Xem xét ngoại lệ",
  refund: "Xem xét hoàn tiền",
}
export const phaseLabels: Record<RenewalOperationState["phase"], string> = {
  UNKNOWN: "Chưa có thông tin xử lý gia hạn",
  AWAITING_DEPOSIT: "Chờ thanh toán cọc",
  SIGNING: "Đang xử lý ký gia hạn",
  SIGNING_EXPIRY_PENDING: "Đã quá hạn ký, chờ đối soát",
  SIGNING_EXPIRED: "Hết hạn ký, cần xem xét",
  PAYMENT_EXPIRED: "Hết hạn thanh toán",
  COMPLETED: "Đã hoàn tất gia hạn",
}
export const sourceLabels: Record<string, string> = {
  BO_SIGNING_POLICY: "Chính sách ký và xử lý ngoại lệ",
  SERVICE_CALENDAR: "Lịch phục vụ và đặt lịch thực tế",
  RENEWAL_ACCOUNTING: "Thanh toán và phân bổ tiền gia hạn",
  SHARED_HOLD_RETURN_RECOVERY: "Giữ chỗ, trả kho và thu hồi",
  STAFF_PERMISSION_ASSIGNMENT: "Quyền và phân công nhân viên",
  RESOURCE_EVIDENCE: "Minh chứng gắn với hồ sơ",
  REFUND_ENTITLEMENT_EXECUTION:
    "Điều kiện và kết quả hoàn tiền",
  RENTAL_TERM_POLICY_DATE_CUTOFF: "Chính sách quá hạn và mốc thu hồi",
  AUTHORITATIVE_OBLIGATIONS_ALLOCATIONS:
    "Khoản phải thanh toán và phân bổ tiền",
}
const sources: Record<RenewalOperationAction, string[]> = {
  deposit: [
    "BO_SIGNING_POLICY",
    "SERVICE_CALENDAR",
    "RENEWAL_ACCOUNTING",
    "SHARED_HOLD_RETURN_RECOVERY",
  ],
  appointment: ["SERVICE_CALENDAR", "SHARED_HOLD_RETURN_RECOVERY"],
  reschedule: ["SERVICE_CALENDAR", "SHARED_HOLD_RETURN_RECOVERY"],
  confirmation: [
    "BO_SIGNING_POLICY",
    "SERVICE_CALENDAR",
    "SHARED_HOLD_RETURN_RECOVERY",
  ],
  arrival: [
    "STAFF_PERMISSION_ASSIGNMENT",
    "RESOURCE_EVIDENCE",
    "SHARED_HOLD_RETURN_RECOVERY",
  ],
  incident: ["STAFF_PERMISSION_ASSIGNMENT", "RESOURCE_EVIDENCE"],
  cash: [
    "STAFF_PERMISSION_ASSIGNMENT",
    "RENEWAL_ACCOUNTING",
    "SHARED_HOLD_RETURN_RECOVERY",
  ],
  completion: [
    "STAFF_PERMISSION_ASSIGNMENT",
    "RESOURCE_EVIDENCE",
    "RENEWAL_ACCOUNTING",
    "SHARED_HOLD_RETURN_RECOVERY",
  ],
  exception: ["STAFF_PERMISSION_ASSIGNMENT", "RESOURCE_EVIDENCE"],
  refund: ["STAFF_PERMISSION_ASSIGNMENT", "RESOURCE_EVIDENCE"],
}
export function operationBlockedReason(
  s: RenewalOperationState,
  role: RenewalOperationsRole,
  action: RenewalOperationAction,
  actor: ApiActor | null,
  facilityId?: string,
  customerId?: string,
  proposal?: RenewalExceptionProposal | null,
  now = Date.now(),
) {
  const owner = [
    "deposit",
    "appointment",
    "reschedule",
    "confirmation",
  ].includes(action)
    ? "customer"
    : ["exception", "refund"].includes(action)
      ? "manager"
      : "staff"
  if (
    role !== owner ||
    !actor ||
    actor.status !== "ACTIVE" ||
    !actor.roles.includes(
      role.toUpperCase() as "CUSTOMER" | "MANAGER" | "STAFF",
    )
  )
    return "Bạn không có quyền thực hiện thao tác này."
  if (role === "customer" && actor.id !== customerId)
    return "Không phải yêu cầu gia hạn của bạn."
  if (
    role === "manager" &&
    (!actor.permissions.includes("rentals:update") ||
      !facilityId ||
      actor.facilityScopes[facilityId] !== "MANAGE")
  )
    return "Bạn chưa có quyền quản lý hồ sơ thuê tại cơ sở này."
  if (s.expectedVersion === null)
    return "Hồ sơ chưa đủ thông tin để tiếp tục xử lý."
  const missing = sources[action].filter((ref) =>
    s.missingSources.includes(ref),
  )
  if (missing.length)
    return `Chưa đủ thông tin: ${missing.map((ref) => sourceLabels[ref] || "Thông tin xử lý gia hạn").join(", ")}.`
  if (action === "deposit" && s.phase !== "AWAITING_DEPOSIT")
    return "Không ở bước chờ cọc."
  if (
    ["appointment", "reschedule", "arrival", "cash", "completion"].includes(
      action,
    ) &&
    s.phase !== "SIGNING"
  )
    return "Chỉ thao tác trong bước ký đang hiệu lực."
  if (action === "appointment" && s.appointmentRef)
    return "Đã có lịch; dùng đổi lịch."
  if (
    ["reschedule", "arrival", "incident"].includes(action) &&
    !s.appointmentRef
  )
    return "Chưa có lịch ký được ghi nhận."
  if (["appointment", "reschedule", "arrival"].includes(action) && s.arrivalRef)
    return "Đã ghi nhận khách đến; cần luồng sự cố/ngoại lệ thay vì đổi lịch thông thường."
  if (action === "completion" && !s.arrivalRef)
    return "Chưa có lượt khách đến được nhân viên ghi nhận."
  if (action === "confirmation") return exceptionConfirmationBlockedReason(s, proposal, now)
  return null // UI prerequisites only. BE rechecks specialized permission, assignment, deadline, payment and policy.
}
export function exceptionConfirmationBlockedReason(s: RenewalOperationState, p?: RenewalExceptionProposal | null, now = Date.now()) {
  if (!p) return "Chưa tải được nội dung đề xuất lịch/hạn mới để xác nhận."
  if (p.status === "NONE" || !s.pendingExceptionRef) return "Không có đề xuất đổi lịch đang chờ xác nhận."
  if (p.renewalId !== s.renewalId || p.decisionRef !== s.pendingExceptionRef || p.expectedVersion !== s.expectedVersion)
    return "Đề xuất đã thay đổi. Vui lòng cập nhật thông tin trước khi xác nhận."
  if (!p.confirmationAllowed || p.status !== "AVAILABLE")
    return p.disabledReasons.includes("PROPOSAL_EXPIRED") ? "Đề xuất đổi lịch đã hết hạn."
      : "Đề xuất hiện chưa đủ điều kiện xác nhận."
  if (!["SIGNING", "SIGNING_EXPIRED", "SIGNING_EXPIRY_PENDING"].includes(s.phase)) return "Hồ sơ không còn ở bước xử lý ký gia hạn."
  if (!p.validUntil || !Number.isFinite(Date.parse(p.validUntil)) || now >= Date.parse(p.validUntil)) return "Đề xuất đổi lịch đã hết hạn."
  return null
}
export function exceptionConfirmationCommand(s: RenewalOperationState, p?: RenewalExceptionProposal | null, now = Date.now()): RenewalOperationCommand {
  const reason = exceptionConfirmationBlockedReason(s, p, now)
  if (reason || s.expectedVersion === null || !p?.decisionRef) throw new Error(reason || "Chưa có đề xuất hợp lệ.")
  return { action: "confirmation", body: { decisionRef: p.decisionRef, expectedVersion: s.expectedVersion } }
}
// Only for local form validation, never for arbitrary server responses.
export function operationValidationError(error: unknown) {
  if (error instanceof ApiClientError || !(error instanceof Error)) return rentalError(error)
  if (error.message === "Minh chứng cần tối đa 10 FileAsset UUID khác nhau, đã liên kết với hồ sơ.")
    return "Nhập tối đa 10 mã tệp khác nhau đã liên kết với hồ sơ."
  return error.message
}
// datetime-local is explicitly a Vietnam local time, independent of the browser's timezone.
export function vietnamLocalInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Chọn ngày và giờ tại Việt Nam.")
  const instant = new Date(`${value}:00+07:00`)
  if (!Number.isFinite(instant.getTime()))
    throw new Error("Ngày/giờ không hợp lệ.")
  if (
    new Date(instant.getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16) !== value
  )
    throw new Error("Ngày/giờ không tồn tại.")
  return instant.toISOString()
}
