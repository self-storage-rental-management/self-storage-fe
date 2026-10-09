export const STAFF_GOODS_CATEGORY_LABELS: Record<string, string> = {
  FURNITURE: "Nội thất",
  KITCHENWARE: "Đồ dùng nhà bếp",
  DECOR: "Đồ trang trí",
  ELECTRONICS: "Thiết bị điện tử",
  OFFICE: "Đồ dùng văn phòng",
  TOYS: "Đồ chơi",
  SPORTS: "Dụng cụ thể thao",
  GIFTS: "Quà tặng",
  MUSICAL_INSTRUMENTS: "Nhạc cụ",
  CAMERA_EQUIPMENT: "Thiết bị máy ảnh",
  EVENT_EQUIPMENT: "Thiết bị sự kiện",
  STORE_FIXTURES: "Thiết bị cửa hàng",
  FINE_ART: "Mỹ thuật",
  CERAMIC_GLASS: "Gốm, sứ và thủy tinh",
  MOVING_ITEMS: "Đồ chuyển nhà",
  OTHER: "Khác",
}

export type StaffTaskSort = "due-asc" | "priority"

const STAFF_TASK_PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function compareStaffTaskSchedule<
  T extends { dueAt: string; priority: string },
>(left: T, right: T, sort: StaffTaskSort) {
  const timestamp = (value: string) => {
    const result = new Date(value).getTime()
    return Number.isNaN(result) ? Number.POSITIVE_INFINITY : result
  }
  const dueDifference = timestamp(left.dueAt) - timestamp(right.dueAt)
  const priorityDifference =
    (STAFF_TASK_PRIORITY_RANK[left.priority] ?? 99) -
    (STAFF_TASK_PRIORITY_RANK[right.priority] ?? 99)

  return sort === "priority"
    ? priorityDifference || dueDifference
    : dueDifference || priorityDifference
}

const CHECK_IN_STATUS_LABELS: Record<string, string> = {
  scheduled: "Đã lên lịch",
  completed: "Đã hoàn tất bàn giao",
  rejected: "Đã từ chối nhận kho",
  no_show: "Khách không đến",
  cancelled: "Đã hủy",
}

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  AWAITING_EMAIL: "Chờ xác minh thư điện tử",
  AWAITING_REVIEW: "Chờ duyệt hàng hóa",
  AWAITING_PAYMENT: "Chờ thanh toán cọc",
  PAYMENT_GRACE: "Chờ khiếu nại thanh toán",
  PAYMENT_REVIEW: "Đang đối soát thanh toán",
  CONFIRMED: "Đã xác nhận giữ kho",
  UNIT_RESERVED: "Đã phân gian kho",
  READY_FOR_CHECKIN: "Sẵn sàng nhận kho",
  AWAITING_CUSTOMER_RECEIPT: "Chờ khách hàng xác nhận nhận kho",
  COMPLETED: "Đã bàn giao",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
  REJECTED: "Hàng hóa bị từ chối",
}

const STORAGE_UNIT_STATUS_LABELS: Record<string, string> = {
  reserved: "Đã giữ cho khách",
  assigned: "Đã bàn giao",
  available: "Sẵn sàng sử dụng",
  maintenance: "Đang bảo trì",
}

export function staffGoodsCategoryLabel(value: string) {
  return STAFF_GOODS_CATEGORY_LABELS[value] ?? value
}

export function staffCheckInStatusLabel(
  checkInStatus: string | null,
  reservationStatus: string,
) {
  return checkInStatus
    ? (CHECK_IN_STATUS_LABELS[checkInStatus] ?? "Đang xử lý")
    : (RESERVATION_STATUS_LABELS[reservationStatus] ?? "Đang xử lý")
}

export function staffStorageUnitStatusLabel(value: string) {
  return STORAGE_UNIT_STATUS_LABELS[value] ?? "Chưa xác định"
}

export function formatStaffDate(value: string | null | undefined) {
  if (!value) return "Chưa xác định"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
}

export function formatStaffDateTime(value: string | null | undefined) {
  if (!value) return "Chưa lên lịch"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN")
}

export function staffErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback

  const candidate = error as {
    code?: unknown
    status?: unknown
  }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const status = typeof candidate.status === "number" ? candidate.status : null

  if (code === "TIMEOUT")
    return "Hệ thống phản hồi quá lâu. Vui lòng thử lại sau ít phút."
  if (code === "NETWORK_ERROR")
    return "Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại."
  if (status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
  if (status === 403)
    return "Bạn không có quyền thực hiện thao tác này tại cơ sở hiện tại."
  if (status === 404) return "Không tìm thấy hồ sơ cần xử lý."
  if (status === 409)
    return "Dữ liệu vừa được cập nhật ở nơi khác. Vui lòng tải lại và thử lại."
  if (status === 413)
    return "Tệp tải lên vượt quá dung lượng cho phép."
  if (status === 422 || status === 400)
    return "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập."
  if (status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại."
  if (status !== null && status >= 500)
    return "Hệ thống đang tạm thời gián đoạn. Vui lòng thử lại sau."

  return fallback
}
