import { describe, expect, it } from "vitest"
import {
  compareCheckInSchedule,
  compareStaffTaskSchedule,
  formatStaffDate,
  parseEmptyStorageHandover,
  inventoryReportNote,
  staffCheckInStatusLabel,
  staffErrorMessage,
  staffGoodsCategoryLabel,
  staffStorageUnitStatusLabel,
} from "./staffPresentation"

describe("trình bày dữ liệu cho giao diện nhân viên", () => {
  it("đọc đúng ghi chú kiểm kê mới và biên bản cũ ghép ghi chú xác minh", () => {
    expect(inventoryReportNote("Ghi chú kiểm kê: Thiếu một kiện")).toBe("Thiếu một kiện")
    expect(inventoryReportNote("Ghi chú xác minh: Đã xem CCCD\nGhi chú bàn giao: Kiện 2 bị móp", "Đã xem CCCD")).toBe("Kiện 2 bị móp")
    expect(inventoryReportNote("Ghi chú xác minh: Đã xem CCCD", "Đã xem CCCD")).toBe("")
    expect(inventoryReportNote("Nội dung cũ")).toBe("Nội dung cũ")
  })
  it("giữ mã tệp bàn giao khi khách thêm ghi chú có dấu phẩy", () => {
    const first = "84ec5e47-685e-4ff5-abc5-76d81be44742"
    const last = "23ca7b74-54ff-4b46-811c-a98dd06516b6"
    const handover = `Tình trạng kho trống: Kho sạch | Bằng chứng: ${first}, ${last}`
    const expected = { condition: "Kho sạch", evidenceReferences: [first, last] }

    expect(parseEmptyStorageHandover(handover)).toEqual(expected)
    expect(parseEmptyStorageHandover(`${handover} | Ghi chú khách: Đã xếp xong, còn một kiện rỗng`)).toEqual(expected)
  })

  it("dùng cùng tên loại hàng với giao diện khách hàng", () => {
    expect(staffGoodsCategoryLabel("DOCUMENTS")).toBe("Sách & hồ sơ")
    expect(staffGoodsCategoryLabel("CAMERA_EQUIPMENT")).toBe("Máy ảnh & máy quay")
    expect(staffGoodsCategoryLabel("OTHER")).toBe("Hàng hóa khác")
  })

  it("không hiển thị mã trạng thái của hệ thống", () => {
    expect(staffCheckInStatusLabel("no_show", "UNIT_RESERVED")).toBe(
      "Khách không đến",
    )
    expect(staffCheckInStatusLabel(null, "READY_FOR_CHECKIN")).toBe(
      "Sẵn sàng nhận kho",
    )
    expect(staffStorageUnitStatusLabel("maintenance")).toBe("Đang bảo trì")
  })

  it("hiển thị ngày theo định dạng Việt Nam", () => {
    expect(formatStaffDate("2026-10-09T00:00:00+07:00")).toBe("09/10/2026")
    expect(formatStaffDate(null)).toBe("Chưa xác định")
  })

  it("không đưa thông báo kỹ thuật từ máy chủ lên giao diện", () => {
    expect(
      staffErrorMessage(
        { status: 400, message: "Every evidence reference must be a file asset ID" },
        "Không thể hoàn tất kiểm kê.",
      ),
    ).toBe("Mã tệp bằng chứng không hợp lệ. Vui lòng mở lại hồ sơ và thử lại.")
    expect(
      staffErrorMessage(
        { status: 409, code: "OPTIMISTIC_LOCK", message: "version mismatch" },
        "Không thể lưu.",
      ),
    ).toBe(
      "Dữ liệu vừa được cập nhật ở nơi khác. Vui lòng tải lại và thử lại.",
    )
    expect(
      staffErrorMessage(
        { status: 500, message: "NullPointerException at ReservationService" },
        "Không thể lưu.",
      ),
    ).toBe("Hệ thống đang tạm thời gián đoạn. Vui lòng thử lại sau.")
  })

  it("giải thích đúng xung đột khi tiếp tục check-in", () => {
    expect(
      staffErrorMessage(
        { status: 409, code: "CONFLICT", message: "Reservation is not READY_FOR_CHECKIN" },
        "Không thể lưu.",
      ),
    ).toContain("sẵn sàng nhận kho")
    expect(
      staffErrorMessage(
        { status: 409, code: "CONFLICT", message: "Check-in step is out of order. Expected status: scheduled" },
        "Không thể lưu.",
      ),
    ).toContain("Các bước nhận kho đã thay đổi")
  })

  it("đưa nhiệm vụ đến hạn trước lên đầu và dùng ưu tiên khi trùng hạn", () => {
    const tasks = [
      { id: "muon", dueAt: "2026-10-12", priority: "high" },
      { id: "som-thap", dueAt: "2026-10-10", priority: "low" },
      { id: "som-cao", dueAt: "2026-10-10", priority: "high" },
    ]

    expect(
      [...tasks]
        .sort((left, right) =>
          compareStaffTaskSchedule(left, right, "due-asc"),
        )
        .map((task) => task.id),
    ).toEqual(["som-cao", "som-thap", "muon"])
  })

  it("sắp xếp hồ sơ nhận kho gần nhất, mới nhất và đơn đang chờ xử lý lên đầu", () => {
    const checkIns = [
      { reservationCode: "RSV-218059", checkInStatus: "completed", appointmentAt: "2026-11-09T19:58:00" },
      { reservationCode: "RSV-235461", checkInStatus: "completed", appointmentAt: "2026-11-10T20:35:00" },
      { reservationCode: "RSV-ER2T", checkInStatus: "completed", appointmentAt: "2026-11-03T06:37:00" },
      { reservationCode: "RSV-3WJN", checkInStatus: "completed", appointmentAt: "2026-11-24T02:00:00" },
      { reservationCode: "RSV-ZBWR", checkInStatus: "setup_completed", appointmentAt: "2026-11-25T23:10:00" },
    ]

    const sorted = [...checkIns].sort(compareCheckInSchedule)
    expect(sorted.map(item => item.reservationCode)).toEqual([
      "RSV-ZBWR", // Chờ kiểm kê hàng hóa (active & 25/11/2026) -> Lên đầu
      "RSV-3WJN", // Đã hoàn tất (24/11/2026)
      "RSV-235461", // Đã hoàn tất (10/11/2026)
      "RSV-218059", // Đã hoàn tất (09/11/2026)
      "RSV-ER2T", // Đã hoàn tất (03/11/2026)
    ])
  })
})
