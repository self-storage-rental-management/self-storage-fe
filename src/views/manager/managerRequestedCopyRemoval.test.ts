import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Manager requested description removal", () => {
  it('labels every inventory filter and removes the temperature filter completely', () => {
    const source = readFileSync(new URL('ManagerInventoryPanel.tsx', import.meta.url), 'utf8')
    for (const [label, value] of [
      ['Tìm kiếm', 'query'], ['Trạng thái gian kho', 'statusFilter'],
      ['Loại gian kho', 'typeFilter'], ['Tầng', 'floorFilter'],
      ['Khu vực', 'zoneFilter'], ['Trạng thái bảo trì', 'maintenanceFilter'],
      ['Sắp xếp', 'sortBy'],
    ]) expect(source).toContain(`label="${label}" value={${value}}`)
    expect(source).not.toContain('climateFilter')
    expect(source).not.toContain('setClimateFilter')
    expect(source).not.toContain('Mọi điều kiện nhiệt độ')
  })

  it.each([
    ["ManagerDashboardPanel.tsx", "Số liệu được tổng hợp từ dữ liệu hiện có"],
    ["ManagerPaymentsPanel.tsx", "Theo dõi thanh toán và xử lý hồ sơ quá hạn trong phạm vi chính sách hiện hành."],
    ["ManagerExceptionsPanel.tsx", "các ngoại lệ hàng hóa của đặt chỗ chỉ được quản lý cơ sở theo dõi"],
    ["ManagerExceptionsPanel.tsx", "Tổng hợp trực tiếp từ đặt chỗ, nhận/trả kho, bảo trì và công nợ."],
    ["ManagerReturnsPanel.tsx", "Theo dõi biên bản nghiệm thu, phê duyệt quyết toán hoàn cọc"],
    ["ManagerCheckinsPanel.tsx", "Theo dõi trực quan lịch hẹn nhận kho, tiến độ xác minh pháp lý"],
    ["../rental-api/RentalApiWorkspace.tsx", "Dữ liệu từ API. Duyệt gia hạn không tự kéo dài"],
    ["ManagerInventoryPanel.tsx", "Theo dõi trạng thái, vị trí, loại gian, khả dụng"],
  ])("removes only the requested description from %s", (file, text) => {
    expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toContain(text)
  })
})
