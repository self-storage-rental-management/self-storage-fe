import { describe, expect, it } from "vitest"
import {
  compareStaffTaskSchedule,
  formatStaffDate,
  parseEmptyStorageHandover,
  staffCheckInStatusLabel,
  staffErrorMessage,
  staffGoodsCategoryLabel,
  staffStorageUnitStatusLabel,
} from "./staffPresentation"

describe("trình bày dữ liệu cho giao diện nhân viên", () => {
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
})
