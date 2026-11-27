import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import BusinessRentalRegulationsPanel from "./BusinessRentalRegulationsPanel"

describe("BusinessRentalRegulationsPanel", () => {
  it("renders regulations without action buttons and deposit fee card", () => {
    const html = renderToStaticMarkup(
      <BusinessRentalRegulationsPanel
        user={{ id: "u1", name: "Giám Đốc BO", role: "business", email: "bo@storagehub.vn" }}
        lang="vi"
      />
    )

    // Main headers
    expect(html).toContain("QUY ĐỊNH CHO THUÊ KHO STORAGEHUB")
    expect(html).toContain("Chính Sách &amp; Quy Định Áp Dụng Đi Kèm Biểu Giá")

    // The 3 removed buttons
    expect(html).not.toContain("Sao chép toàn văn")
    expect(html).not.toContain("In / Xuất bản PDF")
    expect(html).not.toContain("Xem Toàn Văn 12 Điều Khoản")

    // The removed Phí Giữ Chỗ card
    expect(html).not.toContain("Phí Giữ Chỗ")

    // Remaining operational metrics
    expect(html).toContain("Phí Quá Hạn")
    expect(html).toContain("Tiền Cọc Đảm Bảo Thuê")
    expect(html).toContain("Thời Hạn Thuê Tối Thiểu")
    expect(html).toContain("Gia Hạn Quá Hạn")
  })
})
