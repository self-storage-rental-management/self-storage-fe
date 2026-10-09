import { describe, expect, it } from "vitest"
import {
  formatStaffDate,
  staffCheckInStatusLabel,
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
})
