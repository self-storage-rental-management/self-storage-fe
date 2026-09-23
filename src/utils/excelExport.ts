import * as XLSX from 'xlsx'
import {
  REVENUE_DATA,
  REVENUE_BREAKDOWN,
  type MonthlyRevenueRecord
} from '../data/demoDatabase'

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
  const data = options.revenueData && options.revenueData.length > 0 ? options.revenueData : REVENUE_DATA
  const facilityName = options.facilityName || 'Toàn bộ cơ sở'

  const wb = XLSX.utils.book_new()
  const todayStr = new Date().toLocaleDateString('vi-VN')

  // Tính toán các chỉ số tổng hợp
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
  const avgRevenue = Math.round(totalRevenue / (data.length || 1))
  const highestItem = [...data].sort((a, b) => b.revenue - a.revenue)[0] || { month: 'Tháng 9', revenue: 18450000 }
  const forecastNext = '~19.000.000 ₫'

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

  REVENUE_BREAKDOWN.forEach(item => {
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
