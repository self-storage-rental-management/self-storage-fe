import { ApiClientError } from "../../services/apiClient"
import type { RenewalApiAction, RenewalApiRecord } from "../../types/renewalApi"
import type { ApiActor } from "../../services/authApi"
import type { RentalApiRecord } from "../../types/rentalApi"

export function rentalPeriodText(rental: RentalApiRecord) {
  const verified = rental.dateSemantics?.completeness === "COMPLETE"
  const end = verified ? rental.dateSemantics!.lastPermittedDate : rental.contractEndDate
  const interval = `${rentalDate(rental.startDate)} → ${rentalDate(end)}`
  return verified ? interval : `${interval} (chưa xác minh ngày cuối sử dụng)`
}

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
    if (error.code === "INVALID_RESPONSE") return "Thông tin nhận được không hợp lệ. Vui lòng thử lại."
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (error.status === 403)
      return "Bạn không có quyền hoặc phạm vi cơ sở để thực hiện thao tác này."
    if (error.status === 404)
      return "Không tìm thấy hồ sơ hoặc hồ sơ không thuộc phạm vi truy cập."
    if (error.code === "DEFERRED_SOURCE" || error.message.includes("DEFERRED_SOURCE"))
      return "Chưa đủ dữ liệu hoặc chính sách để tiếp tục xử lý."
    if (error.status === 409)
      return "Hồ sơ đã thay đổi hoặc chưa đủ điều kiện xử lý. Vui lòng mở lại hồ sơ, nếu điều khoản thay đổi hãy xác nhận báo giá mới."
    if (error.status === null || error.status >= 500)
      return "Chưa nhận được kết quả. Vui lòng kiểm tra kết nối và thử lại."
    return "Không thể thực hiện yêu cầu. Vui lòng kiểm tra thông tin đã nhập."
  }
  return "Không thể thực hiện yêu cầu. Vui lòng thử lại."
}
export const financialCompletenessLabels: Record<string,string> = { UNKNOWN: "Chưa có thông tin", PARTIAL: "Đã kiểm tra một phần", COMPLETE: "Đã kiểm tra đầy đủ" }
export const accessStatusLabels: Record<string,string> = { ACTIVE: "Đang hoạt động", INACTIVE: "Chưa hoạt động", SUSPENDED: "Tạm ngừng", REVOKED: "Đã thu hồi", EXPIRED: "Đã hết hạn" }
export function rentalDataWarning(field: string) {
  const labels: Record<string,string> = { startDate: "Ngày bắt đầu", contractEndDate: "Ngày kết thúc", monthlyPrice: "Đơn giá", currency: "Đơn vị tiền", customer: "Khách hàng", storageUnit: "Gian kho", unitType: "Loại gian kho", facility: "Cơ sở" }
  return `${labels[field] ?? "Thông tin hồ sơ"} cần được kiểm tra.`
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
  // An advertised action cannot turn missing/contradictory financial data into approval.
  if (action === "APPROVE" && (
    record.status !== "pending" || record.reviewState !== "READY" || !record.acceptedTerms ||
    record.financialCheck.completeness !== "COMPLETE" || !record.financialCheck.checkedAt ||
    record.financialCheck.hasUnresolvedDispute !== false ||
    record.financialCheck.blockingObligationRefs?.length !== 0
  )) return false
  if (role === "manager")
    return (
      actor.roles.includes("MANAGER") &&
      actor.permissions.includes("rentals:update") &&
      actor.facilityScopes[record.facility.id] === "MANAGE" &&
      ["APPROVE", "REJECT"].includes(action)
    )
  return (
    actor.roles.includes("CUSTOMER") &&
    actor.id === record.customer.id &&
    ["CANCEL", "ACCEPT_REVISED_QUOTE"].includes(action)
  )
}
