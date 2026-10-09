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
