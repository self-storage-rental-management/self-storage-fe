import * as XLSX from 'xlsx'
import type { MonthlyRevenueRecord } from '../data/demoDatabase'

export interface RevenueExportOptions {
  facilityName?: string
  revenueData?: MonthlyRevenueRecord[]
}

/**
 * Xuất file Excel báo cáo doanh thu chuẩn .xlsx gồm 2 Sheet:
 * Sheet 1: Báo cáo doanh thu (Bảng theo dõi theo tháng và tổng kết chỉ số)
 * Sheet 2: Cơ cấu doanh thu (Tỷ trọng các nguồn thu tiền thuê, phí dịch vụ...)
 */
export function exportRevenueExcel(options: RevenueExportOptions = {}): string {
  const data = options.revenueData || []
  const facilityName = options.facilityName || 'Toàn bộ cơ sở'

  const wb = XLSX.utils.book_new()
  const todayStr = new Date().toLocaleDateString('vi-VN')

  // Tính toán các chỉ số tổng hợp
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
  const avgRevenue = Math.round(totalRevenue / (data.length || 1))
  const highestItem =
    totalRevenue > 0
      ? [...data].sort((a, b) => b.revenue - a.revenue)[0] || {
          month: '-',
          revenue: 0
        }
      : { month: '-', revenue: 0 }
  const forecastNext =
    totalRevenue > 0
      ? `~${Math.round(highestItem.revenue * 1.03).toLocaleString('vi-VN')} ₫`
      : '0 ₫'

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: Báo cáo doanh thu
  // ─────────────────────────────────────────────────────────────
  const sheet1AOA: (string | number)[][] = [
    ['BÁO CÁO DOANH THU STORAGEHUB'],
    ['Phạm vi: Tháng 4 - Tháng 9'],
    [`Cơ sở: ${facilityName}`, '', `Ngày xuất báo cáo: ${todayStr}`],
    [],
    ['Tháng', 'Doanh thu', 'Tăng trưởng', 'Số hợp đồng', 'Tỷ lệ lấp đầy']
  ]

  // Thêm từng dòng tháng
  data.forEach(r => {
    sheet1AOA.push([
      r.month,
      r.revenue,
      r.growth,
      r.contracts,
      r.occupancyRate
    ])
  })

  // Dòng trống và Tóm tắt chỉ số
  sheet1AOA.push([])
  sheet1AOA.push(['TỔNG KẾT CHỈ SỐ DOANH THU'])
  sheet1AOA.push(['Tổng doanh thu:', totalRevenue])
  sheet1AOA.push(['Doanh thu trung bình/tháng:', avgRevenue])
  sheet1AOA.push(['Tháng doanh thu cao nhất:', highestItem.month])
  sheet1AOA.push(['Doanh thu cao nhất:', highestItem.revenue])
  sheet1AOA.push(['Dự báo tháng tới:', forecastNext])

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1AOA)

  // Độ rộng cột
  ws1['!cols'] = [
    { wch: 28 }, // Tháng / Chỉ số
    { wch: 20 }, // Doanh thu
    { wch: 16 }, // Tăng trưởng
    { wch: 16 }, // Số hợp đồng
    { wch: 18 }  // Tỷ lệ lấp đầy
  ]

  // Định dạng format số tiền cho các ô doanh thu: #,##0 "₫"
  // Dữ liệu bảng bắt đầu từ dòng 6 (1-indexed: B6, B7, ...)
  data.forEach((_, idx) => {
    const rowNum = 6 + idx
    const cellRef = `B${rowNum}`
    if (ws1[cellRef]) {
      ws1[cellRef].t = 'n'
      ws1[cellRef].z = '#,##0 "₫"'
    }
  })

  // Định dạng các ô tổng kết
  const summaryStartRowNum = 6 + data.length + 2 // Dòng 'Tổng doanh thu:'
  // Tổng doanh thu
  const cellTotal = `B${summaryStartRowNum}`
  if (ws1[cellTotal]) {
    ws1[cellTotal].t = 'n'
    ws1[cellTotal].z = '#,##0 "₫"'
  }
  // Trung bình
  const cellAvg = `B${summaryStartRowNum + 1}`
  if (ws1[cellAvg]) {
    ws1[cellAvg].t = 'n'
    ws1[cellAvg].z = '#,##0 "₫"'
  }
  // Cao nhất
  const cellMax = `B${summaryStartRowNum + 3}`
  if (ws1[cellMax]) {
    ws1[cellMax].t = 'n'
    ws1[cellMax].z = '#,##0 "₫"'
  }

  XLSX.utils.book_append_sheet(wb, ws1, 'Báo cáo doanh thu')

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: Cơ cấu doanh thu
  // ─────────────────────────────────────────────────────────────
  const sheet2AOA: (string | number)[][] = [
    ['CƠ CẤU DOANH THU STORAGEHUB'],
    [`Phạm vi cơ sở: ${facilityName}`, '', `Thời gian: Tháng 4 - Tháng 9`],
    [],
    ['Nguồn doanh thu', 'Tỷ trọng']
  ]

  const revenueBreakdown: Array<{ category: string; percentage: number; color: string }> = []
  revenueBreakdown.forEach(item => {
    sheet2AOA.push([item.category, `${item.percentage}%`])
  })

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2AOA)
  ws2['!cols'] = [
    { wch: 25 },
    { wch: 16 }
  ]

  XLSX.utils.book_append_sheet(wb, ws2, 'Cơ cấu doanh thu')

  // Tên file theo quy định
  const dateStr = new Date().toISOString().slice(0, 10)
  const fileName = `Bao_Cao_Doanh_Thu_StorageHub_${dateStr}.xlsx`

  XLSX.writeFile(wb, fileName)
  return fileName
}

export interface ManagerFacilityExportOptions {
  facilityName: string
  metrics: {
    occupancyRate: number | string
    totalUnits: number
    occupiedUnits: number
    availableUnits: number
    maintenanceUnits: number
    monthlyRevenue?: number | string
    collectedRevenue?: number | string
    overdueRentalsCount?: number
    monthCheckinsCount?: number
    openReturnsCount?: number
  }
  units?: Array<{
    code: string
    type: string
    floor: number | string
    zone: string
    status: string
    price: number | string
    availability?: string
  }>
  returns?: Array<{
    id: string
    unitId: string
    customerName: string
    scheduledDate: string
    status: string
    damageClassification?: string
    notes?: string
  }>
  activities?: Array<{
    timestamp: string
    action: string
    actorName: string
    actorRole: string
    entityType: string
    entityId: string
    notes?: string
  }>
}

/**
 * Xuất file Excel báo cáo vận hành cơ sở gồm các sheet:
 * Sheet 1: Chỉ số tổng quan & KPIs
 * Sheet 2: Danh sách gian kho
 * Sheet 3: Hồ sơ trả kho & nghiệm thu
 * Sheet 4: Nhật ký hoạt động
 */
export function exportManagerFacilityExcel(options: ManagerFacilityExportOptions): string {
  const wb = XLSX.utils.book_new()
  const todayStr = new Date().toLocaleDateString('vi-VN')
  const facilityName = options.facilityName || 'Cơ sở lưu trữ'
  const m = options.metrics

  // 1. Sheet Tổng quan
  const sheetSummary: (string | number)[][] = [
    ['BÁO CÁO HOẠT ĐỘNG VẬN HÀNH CƠ SỞ KHO'],
    [`Cơ sở: ${facilityName}`, '', `Ngày xuất báo cáo: ${todayStr}`],
    [],
    ['CHỈ SỐ VẬN HÀNH', 'GIÁ TRỊ', 'ĐƠN VỊ / MÔ TẢ'],
    ['Tỷ lệ lấp đầy', typeof m.occupancyRate === 'number' ? `${m.occupancyRate}%` : m.occupancyRate, 'Tỷ lệ gian kho đang có khách thuê'],
    ['Tổng số gian kho', m.totalUnits, 'Tổng quy mô cơ sở'],
    ['Gian kho đang sử dụng', m.occupiedUnits, 'Số gian có hợp đồng thuê hoạt động'],
    ['Gian kho còn trống', m.availableUnits, 'Khả dụng cho khách thuê mới'],
    ['Gian kho đang bảo trì', m.maintenanceUnits, 'Đang sửa chữa / nghiệm thu hiện trường'],
    ['Doanh thu định kỳ/tháng', m.monthlyRevenue ?? '-', 'Tổng giá trị hợp đồng active'],
    ['Tiền đã thu', m.collectedRevenue ?? '-', 'Đã đối soát ghi nhận'],
    ['Hồ sơ thuê quá hạn', m.overdueRentalsCount ?? 0, 'Cần nhắc nợ hoặc xử lý'],
    ['Lượt nhận kho trong tháng', m.monthCheckinsCount ?? 0, 'Check-in thành công'],
    ['Yêu cầu trả kho chờ xử lý', m.openReturnsCount ?? 0, 'Đang chờ nghiệm thu / hoàn tất']
  ]

  const wsSummary = XLSX.utils.aoa_to_sheet(sheetSummary)
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 45 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Chỉ số tổng quan')

  // 2. Sheet Danh sách gian kho
  if (options.units && options.units.length > 0) {
    const sheetUnits: (string | number)[][] = [
      ['DANH SÁCH GIAN KHO TẠI CƠ SỞ', '', '', '', '', '', `Xuất ngày: ${todayStr}`],
      ['Mã gian', 'Loại kho', 'Tầng', 'Khu vực', 'Trạng thái', 'Giá thuê/tháng', 'Khả dụng thực tế']
    ]
    options.units.forEach(u => {
      sheetUnits.push([
        u.code,
        u.type,
        typeof u.floor === 'number' ? `Tầng ${u.floor}` : u.floor,
        u.zone,
        u.status,
        u.price,
        u.availability || '-'
      ])
    })
    const wsUnits = XLSX.utils.aoa_to_sheet(sheetUnits)
    wsUnits['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 28 }]
    XLSX.utils.book_append_sheet(wb, wsUnits, 'Danh sách gian kho')
  }

  // 3. Sheet Hồ sơ trả kho
  if (options.returns && options.returns.length > 0) {
    const sheetReturns: (string | number)[][] = [
      ['DANH SÁCH YÊU CẦU TRẢ KHO & NGHIỆM THU', '', '', '', '', '', `Xuất ngày: ${todayStr}`],
      ['Mã hồ sơ', 'Gian kho', 'Khách hàng', 'Ngày hẹn trả', 'Trạng thái', 'Phân loại hư hại', 'Ghi chú hiện trường']
    ]
    options.returns.forEach(r => {
      sheetReturns.push([
        r.id,
        r.unitId,
        r.customerName,
        r.scheduledDate,
        r.status,
        r.damageClassification || 'Chưa kiểm tra',
        r.notes || '-'
      ])
    })
    const wsReturns = XLSX.utils.aoa_to_sheet(sheetReturns)
    wsReturns['!cols'] = [{ wch: 16 }, { wch: 15 }, { wch: 25 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, wsReturns, 'Hồ sơ trả kho')
  }

  // 4. Sheet Hoạt động gần đây
  if (options.activities && options.activities.length > 0) {
    const sheetActivities: (string | number)[][] = [
      ['NHẬT KÝ HOẠT ĐỘNG CƠ SỞ', '', '', '', '', '', `Xuất ngày: ${todayStr}`],
      ['Thời gian', 'Hành động', 'Người thực hiện', 'Vai trò', 'Loại đối tượng', 'Mã đối tượng', 'Ghi chú']
    ]
    options.activities.forEach(a => {
      sheetActivities.push([
        a.timestamp,
        a.action,
        a.actorName,
        a.actorRole,
        a.entityType,
        a.entityId,
        a.notes || '-'
      ])
    })
    const wsActivities = XLSX.utils.aoa_to_sheet(sheetActivities)
    wsActivities['!cols'] = [{ wch: 22 }, { wch: 25 }, { wch: 22 }, { wch: 15 }, { wch: 16 }, { wch: 20 }, { wch: 45 }]
    XLSX.utils.book_append_sheet(wb, wsActivities, 'Nhật ký hoạt động')
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeFacName = facilityName.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
  const fileName = `Bao_Cao_Co_So_${safeFacName}_${dateStr}.xlsx`
  XLSX.writeFile(wb, fileName)
  return fileName
}
