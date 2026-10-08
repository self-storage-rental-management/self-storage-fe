/** Seed data for the frontend demo. Replace this module with API calls when the backend is connected. */

export const FACILITIES = [
  {
    id: 'fac-001',
    code: 'HCM-Q1-F01',
    name: 'Kho Việt – Cơ sở Quận 1',
    address: '125 Nguyễn Bỉnh Khiêm, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    city: 'TP. Hồ Chí Minh',
    rating: 4.9,
    available: 20,
    price: '5.500.000đ',
    climate: true,
    security: '24/7',
    image: 'photo-1553413077-190dd305871c',
    units: 20,
    occupied: 3,
    revenue: 30000000,
    growth: 8.4,
    manager: 'Nguyễn Văn Quản Lý',
    status: 'active' as const,
    unitDistribution: { S: 5, M: 5, L: 5, XL: 5 }
  },
  {
    id: 'fac-002',
    code: 'BD-F01',
    name: 'Kho Việt – Cơ sở Bình Dương',
    address: '468 Đại lộ Bình Dương, Phường Lái Thiêu, TP. Thuận An, Bình Dương',
    city: 'Bình Dương',
    rating: 4.8,
    available: 15,
    price: '5.500.000đ',
    climate: true,
    security: '24/7',
    image: 'photo-1586864387967-d02ef85d93e8',
    units: 20,
    occupied: 5,
    revenue: 57500000,
    growth: 6.2,
    manager: 'Mai Trần',
    status: 'active' as const,
    unitDistribution: { S: 5, M: 5, L: 5, XL: 5 }
  },
]

export interface UnitSpec {
  size: 'S' | 'M' | 'L' | 'XL'
  name: string
  dimensions: string
  lengthM: number
  widthM: number
  heightM: number
  areaM2: number
  volumeM3: number
  /** Số khung kệ trong kho */
  frameCount: number
  /** Kích thước mỗi khung kệ: rộng × sâu/dài × cao (m) */
  frameDimensions: { widthM: number; depthM: number; heightM: number; lengthM?: number }
  /** Khoảng cách giữa 2 khung kệ (m) */
  frameDistanceM: number
  /** Chiều rộng lối xe (m) */
  vehicleLaneWidthM: number
  /** Chiều rộng lối đi bộ (m) – bằng khoảng cách 2 khung */
  aisleM: number
  /** Kích thước khung cửa kho: rộng × cao (m) */
  doorWidthM: number
  doorHeightM: number
  /** Kích cỡ hàng hóa tối đa có thể đưa vào kho (cm) – Dài × Rộng × Cao */
  maxCargoDimCm: { lengthCm: number; widthCm: number; heightCm: number }
  /** Tải trọng sàn tối đa (kg) */
  maxLoadKg: number
  priceMonthly: number
  priceFormatted: string
  /** Thùng nhỏ: kích thước cm, thể tích m³, số lượng tối đa */
  smallBox: { lengthCm: number; widthCm: number; heightCm: number; volumeM3: number; count: number }
  /** Thùng to: kích thước cm, thể tích m³, số lượng tối đa */
  largeBox: { lengthCm: number; widthCm: number; heightCm: number; volumeM3: number; count: number }
  /** Shorthand dùng cho UI sức chứa */
  smallBoxes: number
  largeBoxes: number
  /** Loại xe đẩy hỗ trợ */
  cartEquipment: string
  /** Mô tả loại xe đẩy chi tiết */
  cartEquipmentDetail: string
}

export const UNIT_SPECS: Record<'S' | 'M' | 'L' | 'XL', UnitSpec> = {
  S: {
    size: 'S',
    name: 'Kho Nhỏ (S)',
    dimensions: '8,0 × 10,0 × 5,0 m',
    lengthM: 8.0,
    widthM: 10.0,
    heightM: 5.0,
    areaM2: 80.0,
    volumeM3: 400.0,
    frameCount: 4,
    frameDimensions: { widthM: 2, depthM: 4, heightM: 4.5, lengthM: 4 },
    frameDistanceM: 1.8,
    vehicleLaneWidthM: 1.8,
    aisleM: 1.8,
    doorWidthM: 1.0,
    doorHeightM: 2.1,
    maxCargoDimCm: { lengthCm: 160, widthCm: 80, heightCm: 150 },
    maxLoadKg: 600,
    priceMonthly: 5500000,
    priceFormatted: '5.500.000đ',
    smallBox: { lengthCm: 80, widthCm: 60, heightCm: 60, volumeM3: 0.288, count: 336 },
    largeBox: { lengthCm: 100, widthCm: 80, heightCm: 80, volumeM3: 0.64, count: 200 },
    smallBoxes: 336,
    largeBoxes: 200,
    cartEquipment: 'Xe đẩy tay / xe sàn nhỏ',
    cartEquipmentDetail: 'Xe đẩy tay thông thường (0,8 × 0,5 m) – phù hợp thùng carton và đồ gia dụng nhẹ'
  },
  M: {
    size: 'M',
    name: 'Kho Trung (M)',
    dimensions: '12,6 × 10,4 × 5,0 m',
    lengthM: 12.6,
    widthM: 10.4,
    heightM: 5.0,
    areaM2: 131.04,
    volumeM3: 655.2,
    frameCount: 6,
    frameDimensions: { widthM: 2, depthM: 4, heightM: 4.5, lengthM: 4 },
    frameDistanceM: 2.2,
    vehicleLaneWidthM: 2.2,
    aisleM: 2.2,
    doorWidthM: 1.2,
    doorHeightM: 2.2,
    maxCargoDimCm: { lengthCm: 200, widthCm: 100, heightCm: 180 },
    maxLoadKg: 1200,
    priceMonthly: 9500000,
    priceFormatted: '9.500.000đ',
    smallBox: { lengthCm: 80, widthCm: 60, heightCm: 60, volumeM3: 0.288, count: 504 },
    largeBox: { lengthCm: 100, widthCm: 80, heightCm: 80, volumeM3: 0.64, count: 300 },
    smallBoxes: 504,
    largeBoxes: 300,
    cartEquipment: 'Platform trolley',
    cartEquipmentDetail: 'Xe đẩy sàn phẳng (0,9 × 0,6 m) – phù hợp thiết bị văn phòng và nội thất vừa'
  },
  L: {
    size: 'L',
    name: 'Kho Lớn (L)',
    dimensions: '18,3 × 10,8 × 5,0 m',
    lengthM: 18.3,
    widthM: 10.8,
    heightM: 5.0,
    areaM2: 197.64,
    volumeM3: 988.2,
    frameCount: 8,
    frameDimensions: { widthM: 2, depthM: 4, heightM: 4.5, lengthM: 4 },
    frameDistanceM: 2.6,
    vehicleLaneWidthM: 2.6,
    aisleM: 2.6,
    doorWidthM: 1.5,
    doorHeightM: 2.4,
    maxCargoDimCm: { lengthCm: 240, widthCm: 120, heightCm: 210 },
    maxLoadKg: 2400,
    priceMonthly: 15000000,
    priceFormatted: '15.000.000đ',
    smallBox: { lengthCm: 80, widthCm: 60, heightCm: 60, volumeM3: 0.288, count: 672 },
    largeBox: { lengthCm: 100, widthCm: 80, heightCm: 80, volumeM3: 0.64, count: 400 },
    smallBoxes: 672,
    largeBoxes: 400,
    cartEquipment: 'Pallet jack tay',
    cartEquipmentDetail: 'Xe nâng tay thủy lực (1,6 × 0,7 m) – phù hợp pallet hàng và tồn kho kinh doanh'
  },
  XL: {
    size: 'XL',
    name: 'Kho Rất Lớn (XL)',
    dimensions: '25,0 × 11,2 × 5,0 m',
    lengthM: 25.0,
    widthM: 11.2,
    heightM: 5.0,
    areaM2: 280.0,
    volumeM3: 1400.0,
    frameCount: 10,
    frameDimensions: { widthM: 2, depthM: 4, heightM: 4.5, lengthM: 4 },
    frameDistanceM: 3.0,
    vehicleLaneWidthM: 3.0,
    aisleM: 3.0,
    doorWidthM: 2.0,
    doorHeightM: 2.8,
    maxCargoDimCm: { lengthCm: 300, widthCm: 180, heightCm: 260 },
    maxLoadKg: 3600,
    priceMonthly: 22500000,
    priceFormatted: '22.500.000đ',
    smallBox: { lengthCm: 80, widthCm: 60, heightCm: 60, volumeM3: 0.288, count: 840 },
    largeBox: { lengthCm: 100, widthCm: 80, heightCm: 80, volumeM3: 0.64, count: 500 },
    smallBoxes: 840,
    largeBoxes: 500,
    cartEquipment: 'Electric walkie pallet truck',
    cartEquipmentDetail: 'Xe nâng pallet điện dắt bộ (1,8 × 0,8 m) – phù hợp máy móc, hàng nặng và pallet công nghiệp'
  }
}

export const UNITS = [
  // ── 20 Gian Kho Cơ Sở TP. Hồ Chí Minh (HCM-Q1-F01) ──
  // Size S: 8.0 × 10.0 × 5.0 m · 400.0 m³ · 5,500,000đ/tháng
  { id: 'HCM-Q1-F01-S-001', code: 'HCM-Q1-F01-S-001', customerCode: 'HCM-Q1-F01-S-001', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'occupied', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-S-002', code: 'HCM-Q1-F01-S-002', customerCode: 'HCM-Q1-F01-S-002', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-S-003', code: 'HCM-Q1-F01-S-003', customerCode: 'HCM-Q1-F01-S-003', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-S-004', code: 'HCM-Q1-F01-S-004', customerCode: 'HCM-Q1-F01-S-004', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-S-005', code: 'HCM-Q1-F01-S-005', customerCode: 'HCM-Q1-F01-S-005', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },

  // Size M: 12.6 × 10.4 × 5.0 m · 655.2 m³ · 9,500,000đ/tháng
  { id: 'HCM-Q1-F01-M-001', code: 'HCM-Q1-F01-M-001', customerCode: 'HCM-Q1-F01-M-001', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: true, status: 'occupied', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-M-002', code: 'HCM-Q1-F01-M-002', customerCode: 'HCM-Q1-F01-M-002', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-M-003', code: 'HCM-Q1-F01-M-003', customerCode: 'HCM-Q1-F01-M-003', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-M-004', code: 'HCM-Q1-F01-M-004', customerCode: 'HCM-Q1-F01-M-004', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-M-005', code: 'HCM-Q1-F01-M-005', customerCode: 'HCM-Q1-F01-M-005', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },

  // Size L: 18.3 × 10.8 × 5.0 m · 988.2 m³ · 15,000,000đ/tháng
  { id: 'HCM-Q1-F01-L-001', code: 'HCM-Q1-F01-L-001', customerCode: 'HCM-Q1-F01-L-001', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: false, status: 'occupied', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-L-002', code: 'HCM-Q1-F01-L-002', customerCode: 'HCM-Q1-F01-L-002', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-L-003', code: 'HCM-Q1-F01-L-003', customerCode: 'HCM-Q1-F01-L-003', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-L-004', code: 'HCM-Q1-F01-L-004', customerCode: 'HCM-Q1-F01-L-004', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-L-005', code: 'HCM-Q1-F01-L-005', customerCode: 'HCM-Q1-F01-L-005', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },

  // Size XL: 25.0 × 11.2 × 5.0 m · 1400.0 m³ · 22,500,000đ/tháng
  { id: 'HCM-Q1-F01-XL-001', code: 'HCM-Q1-F01-XL-001', customerCode: 'HCM-Q1-F01-XL-001', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-XL-002', code: 'HCM-Q1-F01-XL-002', customerCode: 'HCM-Q1-F01-XL-002', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-XL-003', code: 'HCM-Q1-F01-XL-003', customerCode: 'HCM-Q1-F01-XL-003', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-XL-004', code: 'HCM-Q1-F01-XL-004', customerCode: 'HCM-Q1-F01-XL-004', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },
  { id: 'HCM-Q1-F01-XL-005', code: 'HCM-Q1-F01-XL-005', customerCode: 'HCM-Q1-F01-XL-005', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001' },

  // ── 20 Gian Kho Cơ Sở Bình Dương (BD-F01) ──
  // Size S: 8.0 × 10.0 × 5.0 m · 400.0 m³
  { id: 'BD-F01-S-001', code: 'BD-F01-S-001', customerCode: 'BD-F01-S-001', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-S-002', code: 'BD-F01-S-002', customerCode: 'BD-F01-S-002', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'occupied', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-S-003', code: 'BD-F01-S-003', customerCode: 'BD-F01-S-003', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-S-004', code: 'BD-F01-S-004', customerCode: 'BD-F01-S-004', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-S-005', code: 'BD-F01-S-005', customerCode: 'BD-F01-S-005', size: 'S', sizeCode: 'S', type: 'Small', dimensions: '8,0×10,0×5,0 m', dimensionsM: [8.0, 10.0, 5.0], areaM2: 80.0, volumeM3: 400.0, maxLoadKg: 600, price: 5500000, floor: 1, zone: 'Khu A', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },

  // Size M: 12.6 × 10.4 × 5.0 m · 655.2 m³
  { id: 'BD-F01-M-001', code: 'BD-F01-M-001', customerCode: 'BD-F01-M-001', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: false, status: 'occupied', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-M-002', code: 'BD-F01-M-002', customerCode: 'BD-F01-M-002', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-M-003', code: 'BD-F01-M-003', customerCode: 'BD-F01-M-003', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-M-004', code: 'BD-F01-M-004', customerCode: 'BD-F01-M-004', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-M-005', code: 'BD-F01-M-005', customerCode: 'BD-F01-M-005', size: 'M', sizeCode: 'M', type: 'Medium', dimensions: '12,6×10,4×5,0 m', dimensionsM: [12.6, 10.4, 5.0], areaM2: 131.04, volumeM3: 655.2, maxLoadKg: 1200, price: 9500000, floor: 2, zone: 'Khu B', climate: false, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },

  // Size L: 18.3 × 10.8 × 5.0 m · 988.2 m³
  { id: 'BD-F01-L-001', code: 'BD-F01-L-001', customerCode: 'BD-F01-L-001', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: true, status: 'occupied', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-L-002', code: 'BD-F01-L-002', customerCode: 'BD-F01-L-002', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-L-003', code: 'BD-F01-L-003', customerCode: 'BD-F01-L-003', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-L-004', code: 'BD-F01-L-004', customerCode: 'BD-F01-L-004', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-L-005', code: 'BD-F01-L-005', customerCode: 'BD-F01-L-005', size: 'L', sizeCode: 'L', type: 'Large', dimensions: '18,3×10,8×5,0 m', dimensionsM: [18.3, 10.8, 5.0], areaM2: 197.64, volumeM3: 988.2, maxLoadKg: 2400, price: 15000000, floor: 3, zone: 'Khu C', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },

  // Size XL: 25.0 × 11.2 × 5.0 m · 1400.0 m³
  { id: 'BD-F01-XL-001', code: 'BD-F01-XL-001', customerCode: 'BD-F01-XL-001', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'occupied', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-XL-002', code: 'BD-F01-XL-002', customerCode: 'BD-F01-XL-002', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'occupied', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-XL-003', code: 'BD-F01-XL-003', customerCode: 'BD-F01-XL-003', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-XL-004', code: 'BD-F01-XL-004', customerCode: 'BD-F01-XL-004', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
  { id: 'BD-F01-XL-005', code: 'BD-F01-XL-005', customerCode: 'BD-F01-XL-005', size: 'XL', sizeCode: 'XL', type: 'Extra Large', dimensions: '25,0×11,2×5,0 m', dimensionsM: [25.0, 11.2, 5.0], areaM2: 280.0, volumeM3: 1400.0, maxLoadKg: 3600, price: 22500000, floor: 4, zone: 'Khu D', climate: true, status: 'available', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002' },
]

export const MY_RENTALS = [
  { id: 'rent-001', unit: 'HCM-Q1-F01-M-001', facility: 'Kho Việt – Cơ sở Quận 1', size: 131.04, sizeCode: 'M', status: 'active', paid: true, amount: 9500000, startDate: 'Jan 12, 2026', nextDue: 'Oct 12, 2026' },
  { id: 'rent-002', unit: 'HCM-Q1-F01-S-001', facility: 'Kho Việt – Cơ sở Quận 1', size: 80.0, sizeCode: 'S', status: 'active', paid: false, amount: 5500000, startDate: 'Feb 01, 2026', nextDue: 'Sep 25, 2026' }
]

export const PAYMENTS = [
  { id: 'INV-2026-0081', date: 'Sep 12, 2026', description: 'Unit HCM-Q1-F01-M-001 · Thuê tháng 9', method: 'Chuyển khoản VietQR', amount: 9500000, status: 'paid' },
  { id: 'INV-2026-0070', date: 'Aug 12, 2026', description: 'Unit HCM-Q1-F01-M-001 · Thuê tháng 8', method: 'Chuyển khoản VietQR', amount: 9500000, status: 'paid' },
  { id: 'INV-2026-0062', date: 'Jul 12, 2026', description: 'Unit HCM-Q1-F01-M-001 · Thuê tháng 7', method: 'Chuyển khoản VietQR', amount: 9500000, status: 'paid' },
]

export interface TicketMessage {
  id: string
  sender: string
  role: 'customer' | 'staff' | 'system'
  time: string
  text: string
}

export interface TicketItem {
  id: string
  customer: string
  email: string
  phone?: string
  subject: string
  category: string
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'waiting-customer' | 'resolved'
  created: string
  facility: string
  facilityId?: string
  unit: string
  assignedStaff?: string
  assignedStaffInitials?: string
  updatedAt?: string
  relatedType?: 'rental' | 'reservation' | 'general'
  relatedId?: string
  messages: TicketMessage[]
  source?: 'ai_assistant' | 'direct' | 'escalation'
  aiSummary?: string
  estimatedWaitTime?: string
  emergencyEscalation?: boolean
  impact?: 'high' | 'medium' | 'low'
  feedbackRating?: 'helpful' | 'unhelpful'
  feedbackComment?: string
}

export interface StaffRosterMember {
  id: string
  name: string
  initials: string
  role: 'staff' | 'manager'
  email: string
  phone: string
  facility: string
  facilityId: string
  online: boolean
}

export const STAFF_ROSTER: StaffRosterMember[] = [
  { id: 'staff-1', name: 'Mai Tran', initials: 'MT', role: 'staff', email: 'mai.tran@storagehub.demo', phone: '+84 905 111 222', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', online: true },
  { id: 'staff-2', name: 'Huy Le', initials: 'HL', role: 'staff', email: 'huy.le@storagehub.demo', phone: '+84 905 333 444', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', online: true },
  { id: 'staff-3', name: 'Anh Pham', initials: 'AP', role: 'staff', email: 'anh.pham@storagehub.demo', phone: '+84 905 555 666', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', online: false },
  { id: 'staff-4', name: 'Tuan Vo', initials: 'TV', role: 'staff', email: 'tuan.vo@storagehub.demo', phone: '+84 905 777 888', facility: 'Kho Việt – Cơ sở Bình Dương', facilityId: 'fac-002', online: true },
  { id: 'staff-5', name: 'Demo Staff', initials: 'DS', role: 'staff', email: 'staff@storagehub.demo', phone: '+84 905 550 101', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', online: true },
  { id: 'staff-mgr', name: 'Demo Manager', initials: 'DM', role: 'manager', email: 'manager@storagehub.demo', phone: '+84 903 444 888', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', online: true }
]

export const TICKETS: TicketItem[] = [
  {
    id: 'TKT-1042',
    customer: 'Demo Customer',
    email: 'customer@storagehub.demo',
    phone: '+84 908 123 456',
    subject: 'Access gate code not responding at main entry',
    category: 'Access & Entry',
    priority: 'high',
    impact: 'high',
    status: 'in-progress',
    source: 'ai_assistant',
    aiSummary: 'Khách báo mã PIN không mở được cổng chính lúc 10:15. Trợ lý AI phát hiện sự cố phần cứng điều khiển, đã tự động phân loại Khẩn cấp và gán cho Mai Tran.',
    estimatedWaitTime: '~5 - 10 phút',
    created: 'Sep 17, 2026 · 10:24 AM',
    updatedAt: 'Sep 17, 2026 · 10:45 AM',
    facility: 'Kho Việt – Cơ sở Quận 1',
    facilityId: 'fac-001',
    unit: 'HCM-Q1-F01-M-001',
    assignedStaff: 'Mai Tran',
    assignedStaffInitials: 'MT',
    messages: [
      {
        id: 'msg-1',
        sender: 'Demo Customer',
        role: 'customer',
        time: 'Sep 17, 2026 · 10:24 AM',
        text: 'Hello, I tried entering my digital passcode (4921#) at the north vehicle gate around 10:15 AM today but the keypad beeped three times with a red LED error. Could you verify if my pin is synced?'
      },
      {
        id: 'msg-2',
        sender: 'Mai Tran',
        role: 'staff',
        time: 'Sep 17, 2026 · 10:45 AM',
        text: 'Hi Demo Customer, chúng tôi vừa làm mới firmware cho bộ điều khiển cổng Bắc. Bạn thử lại hoặc dùng mã khẩn cấp 8820# trong lúc chờ kỹ thuật viên kiểm tra trực tiếp.'
      }
    ]
  },
  {
    id: 'TKT-1039',
    customer: 'Tran Van Binh',
    email: 'binh.tran@email.com',
    subject: 'Request invoice receipt with business VAT tax code',
    category: 'Billing & Invoices',
    priority: 'medium',
    status: 'in-progress',
    created: 'Sep 16, 2026 · 02:15 PM',
    facility: 'Kho Việt – Cơ sở Quận 1',
    unit: 'HCM-Q1-F01-S-002',
    messages: [
      {
        id: 'msg-3',
        sender: 'Tran Van Binh',
        role: 'customer',
        time: 'Sep 16, 2026 · 02:15 PM',
        text: 'Please re-issue my last two rent receipts with Company Tax ID: 0314892019.'
      },
      {
        id: 'msg-4',
        sender: 'Accounting Team',
        role: 'staff',
        time: 'Sep 16, 2026 · 04:30 PM',
        text: 'Your request has been forwarded to accounting. Revised e-invoices will be sent to your registered email.'
      }
    ]
  },
  {
    id: 'TKT-1025',
    customer: 'Le Hoang Nam',
    email: 'nam.le@gmail.com',
    subject: 'Inquiry about climate-controlled unit temperature range',
    category: 'Unit Condition',
    priority: 'low',
    status: 'resolved',
    created: 'Sep 14, 2026 · 09:00 AM',
    facility: 'Kho Việt – Cơ sở Quận 1',
    unit: 'HCM-Q1-F01-L-001',
    messages: [
      {
        id: 'msg-5',
        sender: 'Le Hoang Nam',
        role: 'customer',
        time: 'Sep 14, 2026 · 09:00 AM',
        text: 'What is the standard humidity and temperature maintained on Floor 3?'
      },
      {
        id: 'msg-6',
        sender: 'Facility Operations',
        role: 'staff',
        time: 'Sep 14, 2026 · 10:12 AM',
        text: 'Hi Mr. Nam, Floor 3 is temperature controlled between 20°C–23°C with humidity strictly maintained under 55% RH 24/7.'
      }
    ]
  },
  {
    id: 'TKT-1018',
    customer: 'Nguyen Minh Anh',
    email: 'anh.nguyen@outlook.com',
    subject: 'Extend monthly rental contract automatically',
    category: 'Billing & Invoices',
    priority: 'low',
    status: 'resolved',
    created: 'Sep 12, 2026 · 03:40 PM',
    facility: 'Kho Việt – Cơ sở Quận 1',
    unit: 'HCM-Q1-F01-S-001',
    messages: [
      {
        id: 'msg-7',
        sender: 'Nguyen Minh Anh',
        role: 'customer',
        time: 'Sep 12, 2026 · 03:40 PM',
        text: 'I would like to activate auto-renewal for my lease on HCM-Q1-F01-S-001.'
      },
      {
        id: 'msg-8',
        sender: 'Demo Staff',
        role: 'staff',
        time: 'Sep 12, 2026 · 04:00 PM',
        text: 'Auto-renewal is now active on your account with payment method ending in 4242.'
      }
    ]
  }
]

export const SUPPORT_TICKETS = TICKETS

export const TASKS = [
  { id: 'task-1', title: 'Kiểm tra HCM-Q1-F01-S-001 trước bàn giao', time: '09:00 AM', priority: 'high', done: false },
  { id: 'task-2', title: 'Verify reservation R-2048', time: '10:30 AM', priority: 'medium', done: true },
  { id: 'task-3', title: 'Check corridor cameras', time: '02:00 PM', priority: 'low', done: false }
]

export const RESERVATIONS = [
  { id: 'RSV-2048', customer: 'Nguyen Minh Anh', email: 'anh.nguyen@outlook.com', phone: '090 123 4567', identityId: '079203001234', unit: 'HCM-Q1-F01-S-001', facility: 'Kho Việt – Cơ sở Quận 1', facilityAddress: '125 Nguyễn Bỉnh Khiêm, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', size: 33.6, sizeCode: 'S', moveIn: 'Sep 20, 2026', payment: 'paid', paid: true, status: 'pending', emailVerified: true, goodsType: 'Tài liệu và đồ gia dụng', material: 'Giấy, nhựa, vải', packageCount: 12, weightKg: 180, dimensionsCm: '80 × 60 × 70', dimWeightKg: 56, initialCondition: '12 kiện nguyên niêm phong, khô ráo', evidence: ['EV-2048-01 · Ảnh hàng hóa lúc khai báo', 'MAIL-2048 · Email đã xác nhận lúc 09:42 18/09/2026'] },
  { id: 'RSV-2049', customer: 'Hoang Van Bach', email: 'bach.hoang@gmail.com', phone: '091 999 8811', identityId: '079198004567', unit: 'HCM-Q1-F01-M-002', facility: 'Kho Việt – Cơ sở Quận 1', facilityAddress: '125 Nguyễn Bỉnh Khiêm, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', size: 57.6, sizeCode: 'M', moveIn: 'Sep 22, 2026', payment: 'pending', paid: false, status: 'confirmed', emailVerified: false, goodsType: 'Thiết bị văn phòng', material: 'Kim loại, nhựa', packageCount: 8, weightKg: 240, dimensionsCm: '120 × 80 × 90', dimWeightKg: 173, initialCondition: '8 kiện, 1 thùng móp góc nhẹ', evidence: ['EV-2049-01 · Phiếu khai báo hàng hóa'] }
]

export const CHECKINS = [
  { id: 'CHK-301', reservationId: 'RSV-2048', customer: 'Nguyen Minh Anh', email: 'anh.nguyen@outlook.com', phone: '090 123 4567', identityId: '079203001234', unit: 'HCM-Q1-F01-S-001', facility: 'Kho Việt – Cơ sở Quận 1', date: 'Sep 20, 2026', time: '11:00 AM', status: 'scheduled', goodsType: 'Tài liệu và đồ gia dụng', material: 'Giấy, nhựa, vải', packageCount: 12, weightKg: 180, dimensionsCm: '80 × 60 × 70', dimWeightKg: 56, initialCondition: 'Kho sạch, khóa hoạt động; 12 kiện nguyên niêm phong', evidence: ['Ảnh CCCD đã đối chiếu', 'Ảnh hiện trạng kho trước bàn giao', 'Phiếu cân & đo kích thước'] }
]

export const RETURNS = [
  { id: 'RET-118', customer: 'Pham Thu Ha', email: 'ha.pham@gmail.com', phone: '093 555 0128', unit: 'HCM-Q1-F01-S-003', facility: 'Kho Việt – Cơ sở Quận 1', date: 'Sep 15, 2026', returnDate: 'Sep 15, 2026', condition: 'good', status: 'pending', deposit: 5_500_000 / 26_000, damageNotes: '', goodsType: 'Đồ gia dụng', material: 'Gỗ, vải', packageCount: 6, initialWeightKg: 132, finalWeightKg: 130, initialCondition: 'Kho sạch, tường và khóa nguyên vẹn; 6 kiện', finalCondition: 'Chờ kiểm kê', classification: 'Chờ phân loại', evidence: ['EV-IN-118 · 6 ảnh hiện trạng lúc nhận kho'] }
]

export const OCCUPANCY_DATA = [
  { month: 'Tháng 4', occupied: 82, total: 120 },
  { month: 'Tháng 5', occupied: 91, total: 120 },
  { month: 'Tháng 6', occupied: 96, total: 120 },
  { month: 'Tháng 7', occupied: 103, total: 120 },
  { month: 'Tháng 8', occupied: 111, total: 120 },
  { month: 'Tháng 9', occupied: 116, total: 120 }
]

export interface MonthlyRevenueRecord {
  month: string
  revenue: number
  growth: string
  growthNumber: number
  contracts: number
  occupancyRate: string
  occupancyNumber: number
}

export const REVENUE_DATA: MonthlyRevenueRecord[] = [
  { month: 'Tháng 4', revenue: 68500000, growth: '—', growthNumber: 0, contracts: 6, occupancyRate: '14%', occupancyNumber: 0.14 },
  { month: 'Tháng 5', revenue: 82000000, growth: '+19,7%', growthNumber: 0.197, contracts: 7, occupancyRate: '16%', occupancyNumber: 0.16 },
  { month: 'Tháng 6', revenue: 85000000, growth: '+3,7%', growthNumber: 0.037, contracts: 8, occupancyRate: '19%', occupancyNumber: 0.19 },
  { month: 'Tháng 7', revenue: 86000000, growth: '+1,2%', growthNumber: 0.012, contracts: 8, occupancyRate: '19%', occupancyNumber: 0.19 },
  { month: 'Tháng 8', revenue: 87000000, growth: '+1,2%', growthNumber: 0.012, contracts: 8, occupancyRate: '19%', occupancyNumber: 0.19 },
  { month: 'Tháng 9', revenue: 87500000, growth: '+0,6%', growthNumber: 0.006, contracts: 8, occupancyRate: '19%', occupancyNumber: 0.19 }
]

export const REVENUE_BREAKDOWN = [
  { category: 'Tiền thuê kho', percentage: 78, color: '#2563eb' },
  { category: 'Phí dịch vụ', percentage: 13, color: '#10b981' },
  { category: 'Phí vận chuyển', percentage: 5, color: '#f59e0b' },
  { category: 'Phí khác', percentage: 4, color: '#8b5cf6' }
]

export const WAREHOUSE_PERFORMANCE = {
  currentOccupancy: '19%',
  activeContracts: 8,
  renewalRate: '91%'
}

export const UNIT_TYPE_DATA = [
  { name: 'Small', value: 2, color: '#3b82f6' },
  { name: 'Medium', value: 2, color: '#8b5cf6' },
  { name: 'Large', value: 2, color: '#f59e0b' },
  { name: 'Extra Large', value: 2, color: '#10b981' }
]

export interface RentalRecord {
  id: string
  customer: string
  tenant: string
  email: string
  phone: string
  unit: string
  unitType: string
  size: number
  facility: string
  amount: number
  deposit: number
  status: 'active' | 'pending' | 'expiring' | 'terminated'
  paid: 'paid' | 'pending' | 'overdue'
  paymentStatus: 'paid' | 'pending' | 'overdue'
  startDate: string
  nextDue: string
  dueDate: string
  endDate: string
  autoRenew: boolean
  gateCode: string
}

export const RENTALS: RentalRecord[] = [
  {
    id: 'RNT-2026-001',
    customer: 'Demo Customer',
    tenant: 'Demo Customer',
    email: 'customer@storagehub.demo',
    phone: '+84 908 123 456',
    unit: 'HCM-Q1-F01-S-001',
    unitType: 'Kho Nhỏ (S)',
    size: 5,
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 5500000,
    deposit: 5500000,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'Jan 12, 2026',
    nextDue: 'Oct 12, 2026',
    dueDate: 'Oct 12, 2026',
    endDate: 'Jan 12, 2027',
    autoRenew: true,
    gateCode: '4921#'
  },
  {
    id: 'RNT-2026-002',
    customer: 'Saigon Logistics Co.',
    tenant: 'Saigon Logistics Co.',
    email: 'contact@sg-logistics.vn',
    phone: '+84 28 3822 9999',
    unit: 'HCM-Q1-F01-M-001',
    unitType: 'Kho Trung (M)',
    size: 10,
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 9500000,
    deposit: 9500000,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'May 01, 2026',
    nextDue: 'Oct 01, 2026',
    dueDate: 'Oct 01, 2026',
    endDate: 'May 01, 2027',
    autoRenew: true,
    gateCode: '9004#'
  },
  {
    id: 'RNT-2026-003',
    customer: 'Pham Thu Ha',
    tenant: 'Pham Thu Ha',
    email: 'ha.pham@gmail.com',
    phone: '+84 93 555 0128',
    unit: 'HCM-Q1-F01-L-001',
    unitType: 'Kho Lớn (L)',
    size: 15,
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 15000000,
    deposit: 15000000,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'Mar 18, 2026',
    nextDue: 'Sep 18, 2026',
    dueDate: 'Sep 18, 2026',
    endDate: 'Sep 18, 2026',
    autoRenew: false,
    gateCode: '7318#'
  },
  {
    id: 'RNT-2026-004',
    customer: 'Le Hoang Nam',
    tenant: 'Le Hoang Nam',
    email: 'nam.le@gmail.com',
    phone: '+84 988 776 655',
    unit: 'HCM-Q1-F01-L-001',
    unitType: 'Kho Lớn (L)',
    size: 20,
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 15000000,
    deposit: 15000000,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'Jun 15, 2026',
    nextDue: 'Oct 15, 2026',
    dueDate: 'Oct 15, 2026',
    endDate: 'Dec 15, 2026',
    autoRenew: false,
    gateCode: '3128#'
  },
  {
    id: 'RNT-2026-005',
    customer: 'Saigon Logistics Co.',
    tenant: 'Saigon Logistics Co.',
    email: 'contact@sg-logistics.vn',
    phone: '+84 28 3822 9999',
    unit: 'HCM-Q1-F01-XL-001',
    unitType: 'Kho Rất Lớn (XL)',
    size: 25,
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 22500000,
    deposit: 22500000,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'May 01, 2026',
    nextDue: 'Oct 01, 2026',
    dueDate: 'Oct 01, 2026',
    endDate: 'May 01, 2027',
    autoRenew: true,
    gateCode: '9004#'
  },
  {
    id: 'RNT-2026-006',
    customer: 'Doan Thi Mai',
    tenant: 'Doan Thi Mai',
    email: 'mai.doan@gmail.com',
    phone: '+84 977 112 233',
    unit: 'BD-F01-S-002',
    unitType: 'Kho Nhỏ (S)',
    size: 5,
    facility: 'Kho Việt – Cơ sở Bình Dương',
    amount: 5500000,
    deposit: 5500000,
    status: 'pending',
    paid: 'pending',
    paymentStatus: 'pending',
    startDate: 'Sep 25, 2026',
    nextDue: 'Sep 25, 2026',
    dueDate: 'Sep 25, 2026',
    endDate: 'Mar 25, 2027',
    autoRenew: false,
    gateCode: 'Pending'
  },

  {
    id: 'RNT-2026-007',
    customer: 'Vuong Quoc Tuan',
    tenant: 'Vuong Quoc Tuan',
    email: 'tuan.vuong@vcorp.vn',
    phone: '+84 909 888 222',
    unit: 'BD-F01-M-001',
    unitType: 'Kho Trung (M)',
    size: 10,
    facility: 'Kho Việt – Cơ sở Bình Dương',
    amount: 9500000,
    deposit: 9500000,
    status: 'active',
    paid: 'overdue',
    paymentStatus: 'overdue',
    startDate: 'Feb 15, 2026',
    nextDue: 'Sep 01, 2026',
    dueDate: 'Sep 01, 2026',
    endDate: 'Feb 15, 2027',
    autoRenew: false,
    gateCode: '5561#'
  }
]

export const STAFF_LIST = [
  { id: 'demo-staff', name: 'Demo Staff', email: 'staff@storagehub.demo', role: 'Operations Specialist', roleVi: 'Chuyên viên vận hành', shift: 'Morning', shiftVi: 'Ca sáng', tasks: 3, status: 'on-duty', phone: '090 555 0101', facilityId: 'fac-001', facilityName: 'Kho Việt – Cơ sở Quận 1' },
  { id: 'staff-2', name: 'Mai Tran', email: 'mai@storagehub.demo', role: 'Facility Supervisor', roleVi: 'Giám sát cơ sở', shift: 'Day', shiftVi: 'Ca ngày', tasks: 5, status: 'on-duty', phone: '090 555 0102', facilityId: 'fac-001', facilityName: 'Kho Việt – Cơ sở Quận 1' },
  { id: 'staff-3', name: 'Nguyen Quoc Dat', email: 'dat.nguyen@storagehub.demo', role: 'Security & Access Tech', roleVi: 'Kỹ thuật an ninh và truy cập', shift: 'Night', shiftVi: 'Ca đêm', tasks: 1, status: 'off-duty', phone: '090 555 0103', facilityId: 'fac-002', facilityName: 'Kho Việt – Cơ sở Bình Dương' }
]

export interface OverdueAccount {
  id: string
  customer: string
  tenant: string
  email: string
  phone: string
  unit: string
  facility: string
  amount: number
  baseAmount: number
  lateFee: number
  days: number
  overdueDays: number
  stage: 'grace' | 'notice' | 'overlocked' | 'lien'
  stageLabel: string
  status: 'overdue' | 'critical' | 'lien'
  overlocked: boolean
  lastContact: string
  remindersSent: number
  dueDate: string
}

export const OVERDUE: OverdueAccount[] = [
  {
    id: 'OD-11',
    customer: 'Tran Van Binh',
    tenant: 'Tran Van Binh',
    email: 'binh.tran@email.com',
    phone: '+84 912 345 678',
    unit: 'A-210',
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 89,
    baseAmount: 89,
    lateFee: 25,
    days: 13,
    overdueDays: 13,
    stage: 'notice',
    stageLabel: '8–14 Days (Notice Sent)',
    status: 'overdue',
    overlocked: false,
    lastContact: 'Sep 15, 2026 · SMS Sent',
    remindersSent: 2,
    dueDate: 'Sep 05, 2026'
  },
  {
    id: 'OD-12',
    customer: 'Vuong Quoc Tuan',
    tenant: 'Vuong Quoc Tuan',
    email: 'tuan.vuong@vcorp.vn',
    phone: '+84 909 888 222',
    unit: 'B-108',
    facility: 'Kho Việt – Cơ sở Bình Dương',
    amount: 135,
    baseAmount: 135,
    lateFee: 35,
    days: 17,
    overdueDays: 17,
    stage: 'overlocked',
    stageLabel: '15–30 Days (Overlocked)',
    status: 'critical',
    overlocked: true,
    lastContact: 'Sep 14, 2026 · Phone Call',
    remindersSent: 3,
    dueDate: 'Sep 01, 2026'
  },
  {
    id: 'OD-13',
    customer: 'Nguyen Dinh Trinh',
    tenant: 'Nguyen Dinh Trinh',
    email: 'trinh.nguyen@freemail.com',
    phone: '+84 902 119 922',
    unit: 'C-105',
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 220,
    baseAmount: 220,
    lateFee: 50,
    days: 34,
    overdueDays: 34,
    stage: 'lien',
    stageLabel: '30+ Days (Notice of Lien)',
    status: 'lien',
    overlocked: true,
    lastContact: 'Sep 10, 2026 · Certified Mail',
    remindersSent: 5,
    dueDate: 'Aug 15, 2026'
  },
  {
    id: 'OD-14',
    customer: 'Ha Gia Bao',
    tenant: 'Ha Gia Bao',
    email: 'giabao.ha@gmail.com',
    phone: '+84 938 445 566',
    unit: 'A-304',
    facility: 'Kho Việt – Cơ sở Quận 1',
    amount: 89,
    baseAmount: 89,
    lateFee: 0,
    days: 4,
    overdueDays: 4,
    stage: 'grace',
    stageLabel: '1–7 Days (Grace Period)',
    status: 'overdue',
    overlocked: false,
    lastContact: 'Sep 17, 2026 · Automated Email',
    remindersSent: 1,
    dueDate: 'Sep 14, 2026'
  }
]

export const UTILIZATION = [
  { name: 'Kho Việt – Cơ sở Quận 1', value: 80 },
  { name: 'Kho Việt – Cơ sở Bình Dương', value: 76 }
]

export const SUPPORT_METRICS = [
  { label: 'Open', value: 4 },
  { label: 'Resolved', value: 28 }
]

export const REVENUE_TREND = REVENUE_DATA

export const CONVERSION_DATA = [
  { month: 'Tháng 4', visits: 420, bookings: 38 },
  { month: 'Tháng 5', visits: 510, bookings: 49 },
  { month: 'Tháng 6', visits: 580, bookings: 61 },
  { month: 'Tháng 7', visits: 620, bookings: 66 },
  { month: 'Tháng 8', visits: 710, bookings: 78 },
  { month: 'Tháng 9', visits: 760, bookings: 84 }
]

// export const PRICING_TIERS = [
//   { id: 'tier-1', name: 'Small Unit', size: '5 ft (25 sq ft)', basePrice: 89, climateAdder: 20, highDemandMultiplier: 1.15, facility: 'All facilities' },
//   { id: 'tier-2', name: 'Medium Unit', size: '10 ft (100 sq ft)', basePrice: 149, climateAdder: 30, highDemandMultiplier: 1.2, facility: 'All facilities' },
//   { id: 'tier-3', name: 'Large Unit', size: '20 ft (400 sq ft)', basePrice: 269, climateAdder: 45, highDemandMultiplier: 1.25, facility: 'All facilities' }
// ]

export interface PricingTierItem {
  id: string
  sizeCode: 'S' | 'M' | 'L' | 'XL'
  name: string
  size?: string
  basePrice: number
  highDemandMultiplier: number
  facility: string
}

export const PRICING_TIERS: PricingTierItem[] = [
  {
    id: 'tier-1',
    sizeCode: 'S',
    name: 'Kho Nhỏ (S)',
    size: '',
    basePrice: UNIT_SPECS.S.priceMonthly,
    highDemandMultiplier: 1.15,
    facility: 'Toàn bộ cơ sở'
  },
  {
    id: 'tier-2',
    sizeCode: 'M',
    name: 'Kho Vừa (M)',
    size: '',
    basePrice: UNIT_SPECS.M.priceMonthly,
    highDemandMultiplier: 1.2,
    facility: 'Toàn bộ cơ sở'
  },
  {
    id: 'tier-3',
    sizeCode: 'L',
    name: 'Kho Lớn (L)',
    size: '',
    basePrice: UNIT_SPECS.L.priceMonthly,
    highDemandMultiplier: 1.25,
    facility: 'Toàn bộ cơ sở'
  },
  {
    id: 'tier-4',
    sizeCode: 'XL',
    name: 'Kho Rất Lớn (XL)',
    size: '',
    basePrice: UNIT_SPECS.XL.priceMonthly,
    highDemandMultiplier: 1.3,
    facility: 'Toàn bộ cơ sở'
  }
];

export interface PromotionItem {
  id: string
  code: string
  name: string
  description: string
  value: string
  discount: string
  type: 'percentage' | 'fixed-amount' | 'first-month-free' | 'seasonal'
  typeLabel: string
  active: boolean
  status: 'active' | 'paused' | 'expired'
  uses: number
  maxUses: number
  minLeaseMonths: number
  applicableFacility: string
  applicableUnitType: string
  startDate: string
  expires: string
}

export const DISCOUNTS: PromotionItem[] = [
  {
    id: 'DSC-101',
    code: 'WELCOME10',
    name: 'New Tenant Welcome Offer',
    description: '10% discount off the first 3 months of storage rental for first-time customers.',
    value: '10% OFF',
    discount: '10% off for 3 months',
    type: 'percentage',
    typeLabel: 'Percentage Off',
    active: true,
    status: 'active',
    uses: 48,
    maxUses: 100,
    minLeaseMonths: 3,
    applicableFacility: 'All facilities',
    applicableUnitType: 'All Sizes',
    startDate: 'Jan 01, 2026',
    expires: 'Dec 31, 2026'
  },
  {
    id: 'DSC-102',
    code: 'FIRSTFREE',
    name: '1st Month Free on Annual Lease',
    description: 'Pay for 11 months upfront or sign a 12-month contract and receive the 1st full month completely free.',
    value: '100% OFF M1',
    discount: '1st Month 100% Free',
    type: 'first-month-free',
    typeLabel: 'Free Month',
    active: true,
    status: 'active',
    uses: 22,
    maxUses: 50,
    minLeaseMonths: 12,
    applicableFacility: 'Kho Việt – Cơ sở Quận 1',
    applicableUnitType: 'Medium & Large',
    startDate: 'Feb 15, 2026',
    expires: 'Nov 30, 2026'
  },
  {
    id: 'DSC-103',
    code: 'FALLSTORAGE25',
    name: 'Autumn Move-In Special',
    description: 'Instant 650.000 ₫ deduction on the first month invoice for any new storage unit reservation.',
    value: '650.000 ₫ OFF',
    discount: '650.000 ₫ one-time adjustment',
    type: 'fixed-amount',
    typeLabel: 'Fixed Amount',
    active: true,
    status: 'active',
    uses: 36,
    maxUses: 80,
    minLeaseMonths: 1,
    applicableFacility: 'Kho Việt – Cơ sở Bình Dương',
    applicableUnitType: 'Small & Medium',
    startDate: 'Sep 01, 2026',
    expires: 'Oct 31, 2026'
  },
  {
    id: 'DSC-104',
    code: 'BIZBULK15',
    name: 'Corporate Bulk Lease Advantage',
    description: '15% ongoing monthly discount for enterprise & B2B accounts renting 2 or more units simultaneously.',
    value: '15% OFF',
    discount: '15% recurring discount',
    type: 'percentage',
    typeLabel: 'Enterprise Bulk',
    active: true,
    status: 'active',
    uses: 14,
    maxUses: 30,
    minLeaseMonths: 6,
    applicableFacility: 'All facilities',
    applicableUnitType: 'Large & Extra Large',
    startDate: 'Mar 01, 2026',
    expires: 'Dec 31, 2026'
  },
  {
    id: 'DSC-105',
    code: 'SUMMER2026',
    name: 'Summer Flash Promotion (Expired)',
    description: 'Summer seasonal campaign for student locker and mini storage.',
    value: '390.000 ₫ OFF',
    discount: '390.000 ₫ one-time off',
    type: 'seasonal',
    typeLabel: 'Seasonal Flash',
    active: false,
    status: 'expired',
    uses: 60,
    maxUses: 60,
    minLeaseMonths: 2,
    applicableFacility: 'All facilities',
    applicableUnitType: 'Small',
    startDate: 'Jun 01, 2026',
    expires: 'Aug 31, 2026'
  }
]

// export const POLICIES = [
//   { id: 'pol-1', name: 'Standard monthly rental', description: 'Month-to-month rental with 30-day notice.', status: 'active' },
//   { id: 'pol-2', name: 'Annual corporate lease', description: '12-month fixed commitment with discounted base rate.', status: 'active' }
// ]

export const POLICIES = [
  { id: 'pol-1', name: 'Grace Period', value: '3 days', scope: 'All Facilities', editable: true, description: 'Thời gian ân hạn thanh toán (03 ngày); từ ngày thứ 4 quá hạn bắt đầu áp dụng phí phạt trễ theo ngày và tạm khóa mã PIN mở kho.' },
  { id: 'pol-2', name: 'Late Fee', value: '50% đơn giá ngày / ngày trễ', scope: 'All Facilities', editable: true, description: 'Phí phạt quá hạn tính theo ngày trễ thực tế: (Cước thuê tháng ÷ 30) × 50% × số ngày trễ.' },
  { id: 'pol-3', name: 'Security Deposit', value: '1 month', scope: 'All Facilities', editable: true, description: 'Tiền cọc an ninh tương đương 01 tháng cước cơ sở (hoàn trả 100% trong 24h sau khi hoàn tất kiểm tra trả kho nguyên trạng).' },
  { id: 'pol-4', name: 'Notice to Vacate', value: '15 days', scope: 'All Facilities', editable: true, description: 'Thời hạn thông báo trước khi kết thúc hợp đồng trước hạn (chỉ áp dụng khi trả kho sớm; hợp đồng trọn gói hết kỳ hạn tự động thanh lý).' },
  { id: 'pol-5', name: 'Minimum Lease', value: '1 month', scope: 'All Facilities', editable: true, description: 'Kỳ hạn hợp đồng thuê kho tự quản tối thiểu là 01 tháng.' }
]

export const FEES = [
  { type: 'Phí nộp muộn', amount: '50% đơn giá ngày / ngày trễ', trigger: 'Áp dụng sau 3 ngày ân hạn kể từ ngày đến hạn thanh toán. Công thức: (giá thuê tháng ÷ 30) × 50% × số ngày trễ.', applies: 'Tất cả khách thuê' },
  { type: 'Phí thay thế khóa số', amount: '1.170.000 ₫', trigger: 'Khi khách làm mất hoặc hư hỏng khóa / thẻ từ', applies: 'Trách nhiệm khách thuê' },
  { type: 'Phí dọn vệ sinh kho', amount: '2.080.000 ₫', trigger: 'Áp dụng nếu trả kho còn rác bẩn hoặc chất nguy hại', applies: 'Kiểm tra khi trả kho' },
  { type: 'Phí hỗ trợ mở khóa khẩn cấp', amount: '780.000 ₫', trigger: 'Mở khóa thủ công ngoài giờ hành chính tại cơ sở', applies: 'Mỗi lần yêu cầu' }
]

// Policy fixture retained for verification tests; the Admin settings screen reads the API.
export interface SettingGroup {
  group: string
  description?: string
  items: Array<{
    id: string
    label: string
    description?: string
    type: 'text' | 'select' | 'toggle' | 'number'
    value: string | number | boolean
    options?: string[]
  }>
}

export const SETTINGS_GROUPS: SettingGroup[] = [
  {
    group: 'Billing & Invoicing Rules',
    description: 'Policy verification fixture.',
    items: [{ id: 'gracePeriod', label: 'Late Fee Grace Period (Days)', type: 'number', value: 3 }]
  }
]

export const USERS = [
  { id: 'demo-customer', name: 'Demo Customer', email: 'customer@storagehub.demo', role: 'customer', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', phone: '+84 908 123 456', status: 'active', lastLogin: 'Today, 09:12 AM', joined: 'Jan 12, 2026' },
  { id: 'demo-staff', name: 'Demo Staff', email: 'staff@storagehub.demo', role: 'staff', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', phone: '+84 905 550 101', status: 'active', lastLogin: 'Today, 08:45 AM', joined: 'Jan 10, 2026' },
  { id: 'demo-manager', name: 'Demo Manager', email: 'manager@storagehub.demo', role: 'manager', facility: 'Kho Việt – Cơ sở Quận 1', facilityId: 'fac-001', phone: '+84 903 444 888', status: 'active', lastLogin: 'Today, 08:30 AM', joined: 'Jan 05, 2026' },
  { id: 'demo-business', name: 'Demo Operations', email: 'business@storagehub.demo', role: 'business', facility: 'All facilities', phone: '+84 28 3999 1111', status: 'active', lastLogin: 'Yesterday, 04:20 PM', joined: 'Dec 20, 2025' },
  { id: 'demo-admin', name: 'Demo Administrator', email: 'admin@storagehub.demo', role: 'admin', facility: 'All facilities', phone: '+84 901 000 999', status: 'active', lastLogin: 'Today, 07:55 AM', joined: 'Dec 01, 2025' }
]

export const LOGIN_HISTORY = [
  { id: 'log-1', user: 'Demo Customer', email: 'customer@storagehub.demo', role: 'customer', time: 'Today, 09:12 AM', ip: '192.168.1.20', location: 'District 1, HCMC', device: 'Chrome on macOS', status: 'success' },
  { id: 'log-2', user: 'Demo Staff', email: 'staff@storagehub.demo', role: 'staff', time: 'Today, 08:45 AM', ip: '192.168.1.21', location: 'District 1, HCMC', device: 'Firefox on Windows', status: 'success' },
  { id: 'log-3', user: 'Demo Manager', email: 'manager@storagehub.demo', role: 'manager', time: 'Today, 08:30 AM', ip: '192.168.1.10', location: 'District 1, HCMC', device: 'Safari on iPhone 15', status: 'success' },
  { id: 'log-4', user: 'Unknown User', email: 'admin@storagehub.demo', role: 'admin', time: 'Yesterday, 11:42 PM', ip: '14.232.180.99', location: 'Da Nang, VN', device: 'Chrome on Windows', status: 'failed' }
]
