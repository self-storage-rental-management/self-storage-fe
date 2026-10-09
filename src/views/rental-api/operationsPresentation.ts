import type { ApiActor } from "../../services/authApi"
import type {
  RenewalOperationAction,
  RenewalOperationsRole,
  RenewalOperationState,
} from "../../types/renewalOperationsApi"

export const operationLabels: Record<RenewalOperationAction, string> = {
  deposit: "Thanh toán cọc gia hạn (mô phỏng BE)",
  appointment: "Đề nghị lịch ký",
  reschedule: "Đổi lịch ký",
  confirmation: "Xác nhận đề xuất ngoại lệ",
  arrival: "Ghi nhận khách đến",
  incident: "Báo sự cố tại cơ sở",
  cash: "Ghi nhận đã thu CASH",
  completion: "Hoàn tất ký gia hạn",
  exception: "Xem xét ngoại lệ",
  refund: "Xem xét hoàn tiền",
}
export const phaseLabels: Record<RenewalOperationState["phase"], string> = {
  UNKNOWN: "Chưa có workflow vận hành xác thực",
  AWAITING_DEPOSIT: "Chờ thanh toán cọc",
  SIGNING: "Đang xử lý ký gia hạn",
  SIGNING_EXPIRY_PENDING: "Đã qua hạn ký — chờ BE đối soát",
  SIGNING_EXPIRED: "Hết hạn ký — cần xem xét",
  PAYMENT_EXPIRED: "Hết hạn thanh toán",
  COMPLETED: "Đã hoàn tất gia hạn",
}
export const sourceLabels: Record<string, string> = {
  BO_SIGNING_POLICY: "Chính sách ký/ngoại lệ của BO",
  SERVICE_CALENDAR: "Lịch phục vụ và đặt lịch thực tế",
  RENEWAL_ACCOUNTING: "Thanh toán, nghĩa vụ và phân bổ tiền gia hạn",
  SHARED_HOLD_RETURN_RECOVERY: "Giữ chỗ, trả kho và thu hồi dùng chung",
  STAFF_PERMISSION_ASSIGNMENT: "Quyền chuyên biệt và phân công Staff",
  RESOURCE_EVIDENCE: "Minh chứng gắn với hồ sơ",
  REFUND_ENTITLEMENT_EXECUTION:
    "Quyền được hoàn tiền và nguồn thực thi hoàn tiền",
  RENTAL_TERM_POLICY_DATE_CUTOFF: "Chính sách quá hạn/ngày kết thúc/cutoff",
  AUTHORITATIVE_OBLIGATIONS_ALLOCATIONS:
    "Nghĩa vụ thanh toán và phân bổ tiền xác thực",
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
    return "Không đúng vai trò thao tác."
  if (role === "customer" && actor.id !== customerId)
    return "Không phải yêu cầu gia hạn của bạn."
  if (
    role === "manager" &&
    (!actor.permissions.includes("rentals:update") ||
      !facilityId ||
      actor.facilityScopes[facilityId] !== "MANAGE")
  )
    return "Cần quyền rentals:update và phạm vi MANAGE của cơ sở."
  if (s.expectedVersion === null)
    return "Thiếu phiên bản workflow xác thực; không tự tạo version."
  const missing = sources[action].filter((ref) =>
    s.missingSources.includes(ref),
  )
  if (missing.length)
    return `Chưa kết nối: ${missing.map((ref) => sourceLabels[ref] || ref).join("; ")}.`
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
    return "Chưa có lịch ký được BE lưu."
  if (["appointment", "reschedule", "arrival"].includes(action) && s.arrivalRef)
    return "Đã ghi nhận khách đến; cần luồng sự cố/ngoại lệ thay vì đổi lịch thông thường."
  if (action === "completion" && !s.arrivalRef)
    return "Chưa có lượt khách đến được Staff ghi nhận."
  if (action === "confirmation")
    return "BE chưa cung cấp nội dung đề xuất lịch/hạn mới cho Customer. Chưa thể xác nhận mù bằng mã đề xuất."
  return null // UI prerequisites only. BE rechecks specialized permission, assignment, deadline, payment and policy.
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
