import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Manager requested description removal", () => {
  it('labels every remaining inventory filter and removes the floor/temperature filters completely', () => {
    const source = readFileSync(new URL('ManagerInventoryPanel.tsx', import.meta.url), 'utf8')
    for (const [label, value] of [
      ['Tìm kiếm', 'query'], ['Trạng thái gian kho', 'statusFilter'],
      ['Loại gian kho', 'typeFilter'],
      ['Khu vực', 'zoneFilter'],
      ['Sắp xếp', 'sortBy'],
    ]) expect(source).toContain(`label="${label}" value={${value}}`)
    expect(source).not.toContain('floorFilter')
    expect(source).not.toContain('Tầng')
    expect(source).not.toContain('climateFilter')
    expect(source).not.toContain('setClimateFilter')
    expect(source).not.toContain('Mọi điều kiện nhiệt độ')
  })

  it.each([
    ["ManagerDashboardPanel.tsx", "Số liệu được tổng hợp từ dữ liệu hiện có"],
    ["ManagerPaymentsPanel.tsx", "Theo dõi thanh toán và xử lý hồ sơ quá hạn trong phạm vi chính sách hiện hành."],
    ["ManagerReturnsPanel.tsx", "Theo dõi biên bản nghiệm thu, phê duyệt quyết toán hoàn cọc"],
    ["../rental-api/RentalApiWorkspace.tsx", "Dữ liệu từ API. Duyệt gia hạn không tự kéo dài"],
    ["ManagerInventoryPanel.tsx", "Theo dõi trạng thái, vị trí, loại gian, khả dụng"],
  ])("removes only the requested description from %s", (file, text) => {
    expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toContain(text)
  })
})
