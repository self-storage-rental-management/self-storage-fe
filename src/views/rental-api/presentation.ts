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
    const renewalErrors: Array<[string, string]> = [
      ["Appointment expired during reservation", "Lịch hẹn đã qua trong lúc xử lý. Hãy tải lại hồ sơ và chọn lịch khác; lịch mới chưa được lưu."],
      ["Eligibility UNKNOWN", "Chưa thể xác minh hồ sơ có đủ điều kiện gia hạn. Hãy thử lại sau; nếu vẫn gặp lỗi, liên hệ quản lý cơ sở."],
      ["Eligibility/cutoff missing", "Chưa có dữ liệu xác định hạn xử lý gia hạn. Vui lòng tải lại sau."],
      ["Unverified date provenance/cutoff", "Ngày hết hạn hoặc mốc xử lý của hồ sơ chưa được xác minh. Vui lòng liên hệ quản lý cơ sở để kiểm tra hồ sơ."],
      ["BO renewal policy missing", "Cơ sở chưa công bố chính sách gia hạn đang có hiệu lực. Vui lòng liên hệ quản lý cơ sở."],
      ["Incomplete BO policy", "Chính sách gia hạn của cơ sở còn thiếu thông tin bắt buộc. Vui lòng liên hệ quản lý cơ sở."],
      ["Rental date provenance unknown", "Chưa xác minh được ngày thuê của hồ sơ nên chưa thể tính kỳ gia hạn. Vui lòng liên hệ quản lý cơ sở."],
      ["Renewal window not open", "Hồ sơ chưa đến thời hạn được yêu cầu gia hạn. Vui lòng thử lại gần ngày hết hạn."],
      ["Recovery/cutoff conflict", "Hồ sơ đã đến mốc xử lý quá hạn hoặc đang được chuyển xử lý. Không thể tiếp tục gia hạn."],
      ["Authoritative renewal pricing/rounding source missing", "Chưa lấy được bảng giá gia hạn chính thức của cơ sở. Vui lòng tải lại sau."],
      ["Renewal pricing UNKNOWN", "Chưa có giá gói gia hạn đã được xác minh cho gian kho này. Vui lòng liên hệ quản lý cơ sở."],
      ["Pricing mapping/rounding incomplete or ambiguous", "Thông tin giá hoặc cách tính tiền của gói gia hạn chưa đầy đủ. Vui lòng liên hệ quản lý cơ sở."],
      ["Incomplete pricing", "Dữ liệu giá gói gia hạn chưa đầy đủ. Vui lòng tải lại sau hoặc liên hệ quản lý cơ sở."],
      ["Package not eligible for Renewal", "Gói đã chọn không áp dụng cho gian kho hoặc chính sách gia hạn hiện tại. Hãy chọn gói khác."],
      ["Rental already has an open or unresolved legacy renewal", "Hồ sơ này đã có yêu cầu gia hạn đang xử lý. Mở danh sách yêu cầu để xem trạng thái hiện tại."],
      ["Move-out/non-active or incomplete rental blocks renewal", "Hồ sơ thuê không còn hiệu lực hoặc đang trong quy trình trả kho nên không thể gia hạn."],
      ["Rental unit type missing", "Hồ sơ chưa xác định được loại gian kho để tính giá gia hạn. Vui lòng liên hệ quản lý cơ sở."],
      ["Due obligations or dispute block approval", "Còn khoản phải thanh toán hoặc vấn đề tài chính chưa được giải quyết. Vui lòng kiểm tra công nợ với cơ sở."],
      ["Financial state UNKNOWN", "Chưa xác minh được tình trạng thanh toán của hồ sơ. Vui lòng tải lại sau."],
      ["Financial state incomplete", "Dữ liệu thanh toán của hồ sơ chưa đầy đủ để xét gia hạn. Vui lòng liên hệ quản lý cơ sở."],
      ["Consistent financial source missing", "Chưa kết nối được nguồn đối soát thanh toán của cơ sở. Yêu cầu chưa được xử lý; vui lòng thử lại sau."],
      ["Atomic shared extension hold unavailable", "Hệ thống chưa thể giữ gian kho an toàn cho yêu cầu này. Chưa có thay đổi nào được xác nhận; vui lòng thử lại sau."],
      ["Approval expiry/payment/hold lifecycle unavailable", "Hệ thống chưa sẵn sàng theo dõi thời hạn duyệt và giữ gian kho. Yêu cầu chưa được xử lý; vui lòng thử lại sau."],
      ["Terms changed: new quote and Customer confirmation required", "Điều khoản hoặc giá đã thay đổi. Hãy lấy báo giá mới và xác nhận lại trước khi gửi."],
      ["Rental allocation/end changed; requote required", "Gian kho hoặc ngày hết hạn đã thay đổi. Hãy tải lại hồ sơ và lấy báo giá mới."],
      ["Accepted Renewal terms do not match persisted request", "Điều khoản được xác nhận không còn khớp với yêu cầu đã lưu. Hãy tải lại yêu cầu và xác nhận báo giá mới."],
      ["Shared renewal amount exceeds supported precision", "Số tiền gia hạn không hợp lệ theo quy tắc làm tròn hiện tại. Vui lòng liên hệ quản lý cơ sở."],
    ]
    const specific = renewalErrors.find(([sourceText]) => error.message.includes(sourceText))
    if (specific) return specific[1]
    if (error.code === "DEFERRED_SOURCE" || error.message.includes("DEFERRED_SOURCE"))
      return "Một nguồn dữ liệu cần thiết cho gia hạn hiện chưa sẵn sàng. Yêu cầu chưa được xử lý; vui lòng thử lại sau hoặc liên hệ quản lý cơ sở nếu lỗi tiếp diễn."
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
