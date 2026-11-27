import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import CentralizedPolicyWorkspace from "./CentralizedPolicyWorkspace"

describe("CentralizedPolicyWorkspace", () => {
  it("renders the 9 Mandatory Rules compliance list and header", () => {
    const html = renderToStaticMarkup(
      <CentralizedPolicyWorkspace
        user={{ id: "u1", name: "Giám Đốc BO", role: "business", email: "bo@storagehub.vn" }}
        lang="vi"
      />
    )

    // Header & Governance
    expect(html).toContain("QUY ĐỊNH &amp; CHÍNH SÁCH VẬN HÀNH TOÀN HỆ THỐNG")
    expect(html).toContain("Quản Trị Chính Sách Tập Trung (Centralized BO Governance)")
    expect(html).toContain("Phiên bản hiệu lực: POL-2026.1")
    expect(html).toContain("Danh Sách 9 Quy Tắc Vận Hành Bắt Buộc (Centralized 9 Rules)")

    // Vertical list items for all 9 rules
    expect(html).toContain("QUY TẮC 1")
    expect(html).toContain("Tiền Cọc Đảm Bảo Thuê")

    expect(html).toContain("QUY TẮC 2")
    expect(html).toContain("Công Thức Tính Tiền Cọc")

    expect(html).toContain("QUY TẮC 3")
    expect(html).toContain("Điều Kiện Hoàn Tiền Cọc")

    expect(html).toContain("QUY TẮC 4")
    expect(html).toContain("Gia Hạn Hợp Đồng Sớm")

    expect(html).toContain("QUY TẮC 5")
    expect(html).toContain("Chấm Dứt Trước Hạn")

    expect(html).toContain("QUY TẮC 6")
    expect(html).toContain("Phạt Thanh Toán Chậm")

    expect(html).toContain("QUY TẮC 7")
    expect(html).toContain("Khấu Trừ Tiền Cọc")

    expect(html).toContain("QUY TẮC 8")
    expect(html).toContain("Gia Hạn Trực Tuyến")

    expect(html).toContain("QUY TẮC 9")
    expect(html).toContain("Bảo Vệ Biểu Giá Đang Chạy")
  })

  it("renders clean unified single overview without action buttons or scattered tab bar", () => {
    const html = renderToStaticMarkup(
      <CentralizedPolicyWorkspace
        user={{ id: "u1", name: "Giám Đốc BO", role: "business", email: "bo@storagehub.vn" }}
        lang="vi"
      />
    )

    // Action buttons are removed as requested
    expect(html).not.toContain("Xem Lịch Sử Ban Hành")
    expect(html).not.toContain("Thẩm Định &amp; Ban Hành")
    expect(html).not.toContain("Điều chỉnh thông số")
    expect(html).not.toContain("Ban hành phiên bản mới")

    // Old tab navigation bar is removed
    expect(html).not.toContain("border-b border-stone-200 bg-white rounded-t-xl px-2 pt-2 shadow-2xs")
  })

  it("ensures simulation tools callout is removed as requested", () => {
    const html = renderToStaticMarkup(
      <CentralizedPolicyWorkspace
        user={{ id: "u1", name: "Giám Đốc BO", role: "business", email: "bo@storagehub.vn" }}
        lang="vi"
      />
    )

    // Simulation preview is removed
    expect(html).not.toContain("Công Cụ Mô Phỏng Tính Toán Chính Sách (Simulation Preview)")
    expect(html).not.toContain("Số ngày quá hạn giả định")
  })
})
