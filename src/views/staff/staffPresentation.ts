import { ApiClientError } from "../../services/apiClient"
import { isUuid } from "../../services/renewalOperationsApi"

export const STAFF_GOODS_CATEGORY_LABELS: Record<string, string> = {
  FURNITURE: "Nội thất",
  KITCHENWARE: "Đồ dùng nhà bếp",
  DECOR: "Vật dụng trang trí",
  DOCUMENTS: "Sách & hồ sơ",
  ELECTRONICS: "Đồ điện & điện tử",
  OFFICE: "Đồ dùng văn phòng",
  TOYS: "Đồ chơi",
  SPORTS: "Dụng cụ thể thao",
  GIFTS: "Quà tặng",
  MUSICAL_INSTRUMENTS: "Nhạc cụ",
  CAMERA_EQUIPMENT: "Máy ảnh & máy quay",
  EVENT_EQUIPMENT: "Thiết bị sự kiện",
  STORE_FIXTURES: "Thiết bị cửa hàng",
  FINE_ART: "Tranh & tượng",
  CERAMIC_GLASS: "Gốm, sứ và thủy tinh",
  MOVING_ITEMS: "Đồ chuyển nhà",
  OTHER: "Hàng hóa khác",
}

export type StaffTaskSort = "due-asc" | "priority"

const STAFF_TASK_PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function compareStaffTaskSchedule<
  T extends {
    dueAt: string
    priority: string
  },
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

export function compareCheckInSchedule<
  T extends {
    checkInStatus?: string | null
    appointmentAt?: string | null
    scheduledAt?: string | null
    setupCompletedAt?: string | null
    checkedInAt?: string | null
    startDate?: string | null
    reservationCode?: string | null
  },
>(left: T, right: T): number {
  // 1. Hồ sơ đang cần xử lý (chưa hoàn tất) luôn ưu tiên hiển thị trước các hồ sơ đã kết thúc
  const finishedStatuses = ["completed", "rejected", "no_show"]
  const leftFinished = finishedStatuses.includes(left.checkInStatus || "")
  const rightFinished = finishedStatuses.includes(right.checkInStatus || "")
  if (leftFinished !== rightFinished) {
    return leftFinished ? 1 : -1
  }

  // 2. Gần nhất / mới nhất lên đầu (sắp xếp giảm dần theo mốc thời gian nhận kho / hẹn)
  const timestamp = (item: T) => {
    const val = item.appointmentAt || item.scheduledAt || item.setupCompletedAt || item.checkedInAt || item.startDate
    if (!val) return 0
    const result = new Date(val).getTime()
    return Number.isNaN(result) ? 0 : result
  }

  const leftTime = timestamp(left)
  const rightTime = timestamp(right)
  if (rightTime !== leftTime) {
    return rightTime - leftTime
  }

  // 3. Dự phòng theo mã đơn giảm dần
  return (right.reservationCode || "").localeCompare(left.reservationCode || "")
}

const CHECK_IN_STATUS_LABELS: Record<string, string> = {
  scheduled: "Đã lên lịch",
  identity_verified: "Đã xác minh khách",
  contract_signed: "Đã ký hợp đồng",
  payment_collected: "Đã thu tiền",
  handover_pending_receipt: "Đã bàn giao · Chờ khách xác nhận",
  setup_in_progress: "Đang chuẩn bị",
  setup_completed: "Chờ kiểm kê hàng hóa",
  completed: "Đã hoàn tất kiểm kê",
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
  UNIT_RESERVED: "Đã phân kho",
  READY_FOR_CHECKIN: "Sẵn sàng nhận kho",
  AWAITING_CUSTOMER_RECEIPT: "Đang cập nhật bàn giao",
  PREPARING: "Khách đang chuẩn bị hàng",
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

export function inventoryReportNote(notes?: string | null, identityNote?: string | null) {
  const identity = identityNote?.trim()
  const cleaned = (notes || '').split(/\r?\n/).map(line => {
    let text = line.trim()
    // Old reports embedded generated conclusions and identity notes inside the free-text note.
    while (/^(Ghi chú kiểm kê|Ghi chú bàn giao):\s*/.test(text)) {
      text = text.replace(/^(Ghi chú kiểm kê|Ghi chú bàn giao):\s*/, '')
    }
    if (!text || text.startsWith('Kết quả đối chiếu hàng hóa:')) return ''
    if (identity && text === `Ghi chú xác minh: ${identity}`) return ''
    return text
  }).filter(Boolean)
  return Array.from(new Set(cleaned)).join('\n')
}

export function parseEmptyStorageHandover(note: string | null | undefined) {
  const prefix = "Tình trạng kho trống:"
  const evidenceMarker = " | Bằng chứng:"
  if (!note?.startsWith(prefix)) return { condition: "", evidenceReferences: [] }

  const handover = note.slice(prefix.length).split(" | Ghi chú khách:", 1)[0]
  const markerIndex = handover.lastIndexOf(evidenceMarker)
  if (markerIndex < 0) return { condition: handover.trim(), evidenceReferences: [] }

  return {
    condition: handover.slice(0, markerIndex).trim(),
    evidenceReferences: handover.slice(markerIndex + evidenceMarker.length)
      .split(",")
      .map(reference => reference.trim())
      .filter(isUuid),
  }
}

export function staffCheckInStatusLabel(
  checkInStatus: string | null,
  reservationStatus: string,
  recoveryTransferred = false,
) {
  if (recoveryTransferred) return "Đã chuyển thu hồi"
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
        timeZone: "Asia/Ho_Chi_Minh",
      })
}

export function formatStaffDateTime(value: string | null | undefined) {
  if (!value) return "Chưa lên lịch"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
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
  if (code === "FILE_TOO_LARGE")
    return typeof (candidate as { message?: unknown }).message === "string"
      ? String((candidate as { message?: unknown }).message)
      : "Tệp tải lên vượt quá dung lượng cho phép (tối đa 25MB)."
  if (code === "NETWORK_ERROR")
    return "Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại."
  if (status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
  if (status === 403)
    return "Bạn không có quyền thực hiện thao tác này tại cơ sở hiện tại."
  if (status === 404) return "Không tìm thấy hồ sơ cần xử lý."
  const message = error instanceof ApiClientError ? error.diagnosticMessage : typeof (candidate as { message?: unknown }).message === "string" ? String((candidate as { message?: unknown }).message) : ""
  if (message.includes("not pending refund"))
    return "Hồ sơ chưa ở trạng thái chờ hoàn cọc (có thể đang chờ khách duyệt hoặc đang khiếu nại)."
  if (message.includes("not in a state awaiting inspection"))
    return "Hồ sơ hiện không ở trạng thái chờ nghiệm thu hiện trường."
  if (message.includes("not awaiting customer confirmation"))
    return "Hồ sơ chưa ở trạng thái chờ khách hàng xác nhận."
  if (message.includes("not in disputed status"))
    return "Hồ sơ không ở trạng thái khiếu nại."
  if (status === 409) {
    if (message.startsWith("Đã hết hạn nhận kho"))
      return error instanceof ApiClientError ? error.message : message
    if (code === "OPTIMISTIC_LOCK")
      return "Dữ liệu vừa được cập nhật ở nơi khác. Vui lòng tải lại và thử lại."
    if (message.includes("Reservation is not READY_FOR_CHECKIN"))
      return "Đơn chưa ở trạng thái sẵn sàng nhận kho. Vui lòng tải lại để đồng bộ trạng thái phân kho."
    if (message.includes("Check-in step is out of order"))
      return "Các bước nhận kho đã thay đổi. Vui lòng tải lại hồ sơ để tiếp tục từ bước hiện tại."
    if (message.includes("Customer identity"))
      return "CCCD/CMND không khớp với thông tin đã khai báo trong đơn."
    if (message.includes("Khoản trả trước khi đặt kho") || message.includes("chưa được xác minh đã thanh toán"))
      return "Khoản trả trước khi đặt kho chưa được xác minh đã thanh toán hoặc cần đối soát; chưa thể nhận kho."
    if (message.includes("not ready to record the remaining payment"))
      return "Hồ sơ chưa sẵn sàng ghi nhận khoản thu còn lại. Vui lòng tải lại và kiểm tra bước ký hợp đồng."
    if (message.includes("Credentials can only be activated"))
      return "Chỉ được kích hoạt ổ khóa sau khi đã ký hợp đồng và thu tiền."
    if (message.includes("no active unit assignment"))
      return "Hồ sơ chưa có phân kho đang hoạt động. Vui lòng kiểm tra lại bước phân kho."
    if (message.includes("Storage unit is not reserved"))
      return "Gian kho không còn ở trạng thái giữ chỗ cho hồ sơ này. Vui lòng tải lại để kiểm tra."
    if (message.includes("Customer setup must be completed"))
      return "Khách chưa được ghi nhận đã chuẩn bị xong nên chưa thể kiểm kê."
    if (message.includes("Chỉ khách hàng được xác nhận đã chuẩn bị xong"))
      return "Chỉ khách hàng được phép xác nhận đã chuẩn bị xong trước khi kiểm kê."
    if (message.includes("Evidence can only be uploaded"))
      return "Chỉ được tải bằng chứng khi đang thực hiện quy trình nhận kho. Vui lòng mở lại hồ sơ và tiếp tục từ bước hiện tại."
    if (message.includes("lock reference"))
      return "Mã ổ khóa không khớp với thông tin ra vào đã kích hoạt. Vui lòng kiểm tra lại mã ổ khóa."
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(message))
      return error instanceof ApiClientError ? error.message : message
    return "Hồ sơ vừa thay đổi trạng thái. Vui lòng tải lại danh sách rồi tiếp tục nhận kho."
  }
  if (status === 413)
    return "Tệp tải lên vượt quá dung lượng cho phép."
  if (status === 422 || status === 400) {
    if (message === "Every evidence reference must be a file asset ID")
      return "Mã tệp bằng chứng không hợp lệ. Vui lòng mở lại hồ sơ và thử lại."
    if (message.includes("varianceReason is required"))
      return "Cần nhập lý do chênh lệch khi kích thước hoặc khối lượng hàng hóa khác với đơn đặt kho."
    if (message.includes("dimensions do not fit"))
      return "Kích thước hàng hóa đo đạc thực tế không vừa gian kho."
    if (message.includes("exceeds the storage unit limit"))
      return "Khối lượng hàng hóa thực tế vượt quá tải trọng tối đa của gian kho."
    if (message.includes("exceeds the storage unit capacity"))
      return "Thể tích hàng hóa thực tế vượt quá dung tích của gian kho."
    if (message.includes("variance is not accepted"))
      return "Kích thước hoặc khối lượng có chênh lệch, vui lòng xác nhận chấp thuận chênh lệch với khách hàng."
    if (message.includes("identityDocumentNumber is required"))
      return "Số CCCD/CMND không được để trống."
    if (message.includes("evidenceReferences") && message.includes("empty"))
      return "Cần ít nhất một ảnh hoặc PDF bằng chứng kiểm kê."

    const fieldErrors = extractStaffFieldErrors(error)
    const errorList = Object.values(fieldErrors).filter(Boolean)
    if (errorList.length > 0) {
      return errorList.join(". ")
    }
    if (message && !message.includes("API request failed") && !message.includes("Thông tin gửi lên chưa hợp lệ") && !message.includes("Request parameters are invalid")) {
      return error instanceof ApiClientError ? error.message : message
    }
    return "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập."
  }
  if (status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại."
  if (status !== null && status >= 500)
    return "Hệ thống đang tạm thời gián đoạn. Vui lòng thử lại sau."

  return fallback
}

export function extractStaffFieldErrors(error: unknown): Record<string, string> {
  if (!error || typeof error !== "object") return {}
  const candidate = error as { details?: unknown; message?: unknown }
  const fieldErrors: Record<string, string> = {}

  if (candidate.details && typeof candidate.details === "object" && !Array.isArray(candidate.details)) {
    for (const [rawKey, rawVal] of Object.entries(candidate.details as Record<string, unknown>)) {
      if (typeof rawVal !== "string") continue
      let key = rawKey
      if (key.startsWith("actualMeasurements.")) {
        key = key.replace("actualMeasurements.", "")
      }
      if (key === "lockReference") key = "keyLockReference"
      if (key === "initialUnitCondition") key = "initialCondition"

      let friendlyMsg = "Vui lòng kiểm tra lại thông tin đã nhập."
      if (rawVal.includes("CCCD/CMND") || key === "identityDocumentNumber") {
        friendlyMsg = "CCCD/CMND phải gồm đúng 9 hoặc 12 chữ số"
      } else if (rawVal.includes("must not be empty") || rawVal.includes("must not be blank") || rawVal.includes("required")) {
        switch (key) {
          case "lengthCm": friendlyMsg = "Vui lòng nhập chiều dài thực tế (lớn hơn 0)"; break
          case "widthCm": friendlyMsg = "Vui lòng nhập chiều rộng thực tế (lớn hơn 0)"; break
          case "heightCm": friendlyMsg = "Vui lòng nhập chiều cao thực tế (lớn hơn 0)"; break
          case "weightKg": friendlyMsg = "Vui lòng nhập khối lượng thực tế (lớn hơn 0)"; break
          case "packageCount": friendlyMsg = "Vui lòng nhập số kiện (từ 1 trở lên)"; break
          case "goodsCategory": friendlyMsg = "Vui lòng nhập loại hàng"; break
          case "goodsCondition": friendlyMsg = "Vui lòng nhập tình trạng hàng hóa"; break
          case "initialCondition": friendlyMsg = "Vui lòng ghi nhận hiện trạng kho trống"; break
          case "keyLockReference": friendlyMsg = "Vui lòng nhập mã ổ khóa"; break
          case "varianceReason": friendlyMsg = "Vui lòng nhập lý do chênh lệch"; break
          case "evidenceReferences": friendlyMsg = "Cần tải lên ít nhất 1 ảnh hoặc tệp PDF bằng chứng"; break
          default: break
        }
      }
      fieldErrors[key] = friendlyMsg
    }
  }

  const msg = error instanceof ApiClientError ? error.diagnosticMessage : typeof candidate.message === "string" ? candidate.message : ""
  if (msg.includes("varianceReason is required")) {
    fieldErrors.varianceReason = "Vui lòng nhập lý do chênh lệch khi kích thước hoặc khối lượng khác đơn đặt"
  }
  if (msg.includes("Actual goods weight exceeds")) {
    fieldErrors.weightKg = "Khối lượng hàng hóa thực tế vượt quá tải trọng gian kho"
  }
  if (msg.includes("Actual goods volume exceeds")) {
    fieldErrors.volumeM3 = "Thể tích hàng hóa vượt quá dung tích gian kho"
  }
  if (msg.includes("Actual goods dimensions do not fit")) {
    fieldErrors.lengthCm = "Kích thước hàng hóa đo đạc thực tế không vừa gian kho"
  }
  if (msg.includes("variance is not accepted")) {
    fieldErrors.varianceAccepted = "Cần ghi nhận cách xử lý chênh lệch trước khi hoàn tất"
  }
  if (msg.includes("identityDocumentNumber is required")) {
    fieldErrors.identityDocumentNumber = "Số CCCD/CMND không được để trống"
  }
  if (msg.includes("Customer identity does not match")) {
    fieldErrors.identityDocumentNumber = "CCCD/CMND không khớp với thông tin đã khai báo trong đơn"
  }
  if (msg.includes("initialUnitCondition") || msg.includes("hiện trạng kho trống")) {
    fieldErrors.initialCondition = "Cần ghi nhận hiện trạng kho trống trước khi bàn giao"
  }
  const normalizedMessage = msg.toLocaleLowerCase("vi-VN")
  if (normalizedMessage.includes("mã ổ khóa đang được sử dụng")
    || normalizedMessage.includes("chưa đủ điều kiện cấp lại")
    || normalizedMessage.includes("active credential of this type already exists")) {
    fieldErrors.keyLockReference = "Mã ổ khóa đang được sử dụng tại cơ sở này. Vui lòng chọn mã khác."
  } else if (msg.includes("lockReference") || normalizedMessage.includes("mã ổ khóa")) {
    fieldErrors.keyLockReference = "Vui lòng kiểm tra lại mã ổ khóa bàn giao"
  }

  return fieldErrors
}
