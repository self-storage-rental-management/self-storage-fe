import { ApiClientError } from "../../services/apiClient"
import type { RenewalApiAction, RenewalApiRecord } from "../../types/renewalApi"
import type { ApiActor } from "../../services/authApi"

export const rentalLabels: Record<string, string> = {
  active: "Đang hiệu lực",
  return_requested: "Đã yêu cầu trả kho",
  return_inspection: "Đang kiểm tra trả kho",
  closing: "Đang quyết toán",
  completed: "Hoàn tất",
}
export const renewalLabels: Record<string, string> = {
  pending: "Chờ xét duyệt",
  deposit_paid: "Đã trả cọc",
  approved: "Đã duyệt",
  appointment_scheduled: "Đã hẹn",
  payment_processing: "Đang xử lý thanh toán",
  payment_failed: "Thanh toán thất bại",
  payment_expired: "Hết hạn thanh toán",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
  completed: "Hoàn tất",
}
export const unknown = "Chưa có dữ liệu xác thực"
export function rentalMoney(
  value: number | null | undefined,
  currency: string,
) {
  if (value == null || !Number.isFinite(value)) return unknown
  // Wire values are applied amounts, never legacy USD-base values.
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)} ${
    currency === "VND" ? "đ" : currency
  }`
}
export function rentalDate(value: string | null | undefined) {
  if (!value) return unknown
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (date) return `${date[3]}/${date[2]}/${date[1]}`
  if (!Number.isFinite(Date.parse(value))) return unknown
  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  })
}
export function rentalError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 403)
      return "Bạn không có quyền hoặc phạm vi cơ sở để thực hiện thao tác này."
    if (error.status === 404)
      return "Không tìm thấy hồ sơ hoặc hồ sơ không thuộc phạm vi truy cập."
    if (error.code === "DEFERRED_SOURCE" || error.message.includes("DEFERRED_SOURCE"))
      return `Chưa có nguồn dữ liệu/policy chung để xử lý. ${error.message}`
    if (error.status === 409)
      return `Xung đột nghiệp vụ hoặc phiên bản. Hãy tải lại hồ sơ; nếu điều khoản thay đổi, Customer cần xác nhận báo giá mới. ${error.message}`
  }
  return error instanceof Error
    ? error.message
    : "Không thể tải dữ liệu. Vui lòng thử lại."
}
export function hasRenewalAction(
  record: RenewalApiRecord,
  action: RenewalApiAction,
  actor: ApiActor | null,
  role: "customer" | "manager",
) {
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    record.version === null ||
    !record.allowedActions.includes(action)
  )
    return false
  if (role === "manager")
    return (
      actor.roles.includes("MANAGER") &&
      actor.permissions.includes("manage_rentals") &&
      actor.facilityScopes[record.facility.id] === "MANAGE" &&
      ["APPROVE", "REJECT"].includes(action)
    )
  return (
    actor.roles.includes("CUSTOMER") &&
    actor.id === record.customer.id &&
    ["CANCEL", "ACCEPT_REVISED_QUOTE"].includes(action)
  )
}
