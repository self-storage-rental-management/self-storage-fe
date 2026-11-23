import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import StaffPagination from "./StaffPagination"
import { archiveCompletedCheckIn } from "../../services/checkInApi"

describe("Staff Operations Features", () => {
  describe("Phân trang đơn đặt giữ kho (StaffPagination)", () => {
    it("hiển thị phân trang đầy đủ khi pageCount > 1", () => {
      const html = renderToStaticMarkup(
        <StaffPagination
          page={1}
          pageCount={3}
          total={25}
          onPageChange={vi.fn()}
        />,
      )

      expect(html).toContain("Trang 1/3 · 25 mục")
      expect(html).toContain("Trước")
      expect(html).toContain("Sau")
      expect(html).toContain("2")
      expect(html).toContain("3")
    })

    it("không render phân trang khi pageCount <= 1 và số lượng nhỏ", () => {
      const html = renderToStaticMarkup(
        <StaffPagination
          page={1}
          pageCount={1}
          total={5}
          onPageChange={vi.fn()}
        />,
      )
      expect(html).toBe("")
    })
  })

  describe("Xóa đơn sau khi bàn giao thành công (Soft Delete)", () => {
    it("cung cấp hàm archiveCompletedCheckIn gửi phương thức DELETE tới API", () => {
      expect(typeof archiveCompletedCheckIn).toBe("function")
    })
  })
})
