import { describe, expect, it } from "vitest"
import {
  compareStaffTaskSchedule,
  formatStaffDate,
  staffCheckInStatusLabel,
  staffErrorMessage,
  staffGoodsCategoryLabel,
  staffStorageUnitStatusLabel,
} from "./staffPresentation"

describe("trình bày dữ liệu cho giao diện nhân viên", () => {
  it("dùng cùng tên loại hàng với giao diện khách hàng", () => {
    expect(staffGoodsCategoryLabel("CERAMIC_GLASS")).toBe(
      "Gốm, sứ và thủy tinh",
    )
    expect(staffGoodsCategoryLabel("OTHER")).toBe("Khác")
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
