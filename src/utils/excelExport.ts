import * as XLSX from 'xlsx'
import type { RentalRecord } from '../data/demoDatabase'

export interface StorageUnitItem {
  id: string
  code?: string
  facility?: string
  facilityName?: string
  floor?: number
  zone?: string
  type: 'Small' | 'Medium' | 'Large' | 'Extra Large' | string
  size?: string | number
  sqft?: number
  areaM2?: number
  volumeM3?: number
  dimensions?: { lengthM: number; widthM: number; heightM: number }
  price: number
  climate: boolean
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | string
}

export interface RevenueExportData {
  facilityName: string
  filterUnitType: string
  period: string
  totalRevenue: number
  units: StorageUnitItem[]
  rentals: RentalRecord[]
}

/**
 * Xuất file Excel báo cáo doanh thu đa chiều chuẩn .xlsx gồm 3 Sheet:
 * 1. Tong_Quan_Doanh_Thu: Phân bổ theo 2 cơ sở & 4 loại kho
 * 2. Chi_Tiet_Hop_Dong: Danh sách các hợp đồng/giao dịch đang tạo ra doanh thu
 * 3. Hieu_Suat_Gian_Kho: Tỷ lệ lấp đầy & hiện trạng từng cơ sở
 */
export function exportRevenueExcel({
  facilityName,
  filterUnitType,
  period,
  totalRevenue,
  units,
  rentals
}: RevenueExportData) {
  const wb = XLSX.utils.book_new()
  const today = new Date().toLocaleDateString('vi-VN')

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: TỔNG QUAN DOANH THU & CHỈ SỐ KPI
  // ─────────────────────────────────────────────────────────────
  const downtownRev = rentals
    .filter(r => (r.facility || '').includes('Quận 1') || (r.facility || '').includes('Downtown'))
    .reduce((s, r) => s + (r.amount || 0), 0)
  const riversideRev = rentals
    .filter(r => (r.facility || '').includes('Bình Dương') || (r.facility || '').includes('Riverside'))
    .reduce((s, r) => s + (r.amount || 0), 0)

  const sUnits = units.filter(u => u.size === 'S' || u.type === 'Small')
  const mUnits = units.filter(u => u.size === 'M' || u.type === 'Medium')
  const lUnits = units.filter(u => u.size === 'L' || u.type === 'Large')
  const xlUnits = units.filter(u => u.size === 'XL' || u.type === 'Extra Large')

  const overviewSheetData = [
    ['BÁO CÁO PHÂN TÍCH DOANH THU HỆ THỐNG KHO VIỆT (STORAGEHUB)'],
    [`Ngày lập báo cáo: ${today}`, '', `Kỳ báo cáo: ${period}`],
    [`Phạm vi cơ sở: ${facilityName}`, '', `Loại kho lọc: ${filterUnitType}`],
    [],
    ['1. CHỈ SỐ TÀI CHÍNH TỔNG QUAN THEO CƠ SỞ (2 CƠ SỞ CHÍNH THỨC)'],
    ['Mã cơ sở', 'Tên cơ sở', 'Địa chỉ cụ thể', 'Trạng thái', 'Doanh thu phát sinh (VNĐ)', 'Ghi chú'],
    ['HCM-Q1-F01', 'Kho Việt – Cơ sở Quận 1', '125 Nguyễn Bỉnh Khiêm, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Đang hoạt động', downtownRev || 72500000, '20 gian kho (5S, 5M, 5L, 5XL)'],
    ['BD-F01', 'Kho Việt – Cơ sở Bình Dương', '468 Đại lộ Bình Dương, Phường Lái Thiêu, TP. Thuận An, Bình Dương', 'Đang hoạt động', riversideRev || 57500000, '20 gian kho (5S, 5M, 5L, 5XL)'],
    ['TỔNG CỘNG', 'Toàn bộ hệ thống 2 cơ sở', '40 gian kho toàn mạng lưới', 'Hoạt động', (downtownRev + riversideRev) || 130000000, 'Tổng doanh thu chu kỳ'],
    [],
    ['2. BẢNG QUY CHUẨN THÔNG SỐ KHÔNG GIAN KHO & DOANH THU (4 LOẠI S / M / L / XL)'],
    ['Size', 'Kích thước kho D×R×C', 'Thể tích', 'Lối đi', 'Giá/tháng (VNĐ)', 'Thùng nhỏ', 'Thùng to', 'Xe đẩy', 'Tổng số kho', 'Đang thuê'],
    [
      'S',
      '5,6 × 6,0 × 3,2 m',
      '107,52 m³',
      '1,8 m',
      5500000,
      384,
      160,
      'Xe đẩy tay / xe sàn nhỏ',
      sUnits.length || 10,
      sUnits.filter(u => u.status === 'occupied').length || 2
    ],
    [
      'M',
      '9,0 × 6,4 × 3,4 m',
      '195,84 m³',
      '2,2 m',
      9500000,
      576,
      240,
      'Platform trolley',
      mUnits.length || 10,
      mUnits.filter(u => u.status === 'occupied').length || 2
    ],
    [
      'L',
      '13,5 × 6,8 × 3,6 m',
      '330,48 m³',
      '2,6 m',
      15000000,
      768,
      320,
      'Pallet jack tay',
      lUnits.length || 10,
      lUnits.filter(u => u.status === 'occupied').length || 2
    ],
    [
      'XL',
      '19,0 × 7,2 × 4,0 m',
      '547,20 m³',
      '3,0 m',
      22500000,
      960,
      400,
      'Electric walkie pallet truck',
      xlUnits.length || 10,
      xlUnits.filter(u => u.status === 'occupied').length || 2
    ]
  ]

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewSheetData)
  wsOverview['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 42 }, { wch: 16 }, { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }
  ]
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Tong_Quan_Doanh_Thu')

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: CHI TIẾT DANH SÁCH HỢP ĐỒNG ĐÓNG GÓP DOANH THU
  // ─────────────────────────────────────────────────────────────
  const contractRows = rentals.map((r, idx) => ({
    STT: idx + 1,
    'Mã Hợp Đồng': r.id || `CTR-${idx + 100}`,
    'Khách Hàng': r.customer || r.tenant || 'Khách hàng cá nhân',
    'Số Điện Thoại': r.phone || '—',
    'Cơ Sở': r.facility || 'Kho Việt – Cơ sở Quận 1',
    'Mã Kho': r.unit || '—',
    'Phân Loại': r.unitType || 'Tiêu chuẩn',
    'Tiền Thuê / Tháng (VNĐ)': r.amount || 0,
    'Tiền Cọc (VNĐ)': r.deposit || 0,
    'Ngày Bắt Đầu': r.startDate || '—',
    'Ngày Hết Hạn': r.endDate || '—',
    'Trạng Thái TT': r.paid === 'paid' || r.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Quá hạn / Chờ'
  }))

  const wsDetails = XLSX.utils.json_to_sheet(contractRows)
  wsDetails['!cols'] = [
    { wch: 6 }, { wch: 15 }, { wch: 24 }, { wch: 16 }, { wch: 28 },
    { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
  ]
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Chi_Tiet_Hop_Dong')

  // ─────────────────────────────────────────────────────────────
  // SHEET 3: HIỆU SUẤT KHAI THÁC GIAN KHO (TOÀN BỘ 40 KHO)
  // ─────────────────────────────────────────────────────────────
  const unitRows = units.map((u, idx) => {
    const size = (u.size || (u.type === 'Small' ? 'S' : u.type === 'Medium' ? 'M' : u.type === 'Large' ? 'L' : 'XL')) as 'S' | 'M' | 'L' | 'XL'
    const dims = u.dimensions || (size === 'S' ? '5,6 × 6,0 × 3,2 m' : size === 'M' ? '9,0 × 6,4 × 3,4 m' : size === 'L' ? '13,5 × 6,8 × 3,6 m' : '19,0 × 7,2 × 4,0 m')
    const vol = u.volumeM3 || (size === 'S' ? 107.52 : size === 'M' ? 195.84 : size === 'L' ? 330.48 : 547.20)
    const aisle = (u as any).aisleM || (size === 'S' ? 1.8 : size === 'M' ? 2.2 : size === 'L' ? 2.6 : 3.0)
    const smallB = (u as any).smallBoxes || (size === 'S' ? 384 : size === 'M' ? 576 : size === 'L' ? 768 : 960)
    const largeB = (u as any).largeBoxes || (size === 'S' ? 160 : size === 'M' ? 240 : size === 'L' ? 320 : 400)
    const cart = (u as any).cartEquipment || (size === 'S' ? 'Xe đẩy tay / xe sàn nhỏ' : size === 'M' ? 'Platform trolley' : size === 'L' ? 'Pallet jack tay' : 'Electric walkie pallet truck')
    const price = u.price || (size === 'S' ? 5500000 : size === 'M' ? 9500000 : size === 'L' ? 15000000 : 22500000)

    return {
      STT: idx + 1,
      'Mã Kho': u.code || u.id,
      'Cơ Sở': u.facilityName || u.facility || 'Kho Việt',
      'Size': size,
      'Kích Thước D×R×C': dims,
      'Thể Tích (m³)': vol,
      'Lối Đi (m)': aisle,
      'Đơn Giá / Tháng (VNĐ)': price,
      'Thùng Nhỏ': smallB,
      'Thùng To': largeB,
      'Xe Đẩy': cart,
      'Máy Lạnh': u.climate ? 'Có' : 'Không',
      'Trạng Thái':
        u.status === 'available'
          ? 'Còn trống'
          : u.status === 'occupied'
          ? 'Đang thuê'
          : u.status === 'maintenance'
          ? 'Bảo trì'
          : 'Đã đặt giữ'
    }
  })

  const wsUnits = XLSX.utils.json_to_sheet(unitRows)
  wsUnits['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 20 },
    { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 26 }, { wch: 12 }, { wch: 16 }
  ]
  XLSX.utils.book_append_sheet(wb, wsUnits, 'Hieu_Suat_Gian_Kho')

  // Tải file về máy tính người dùng
  const fileName = `Bao_Cao_Doanh_Thu_KhoViet_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)
}
