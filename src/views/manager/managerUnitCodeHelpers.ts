/**
 * Helper functions for Manager warehouse unit types and physical unit codes.
 * - Phần 1 (Phương án 2): Tự động sinh mã loại kho theo chữ cái đầu Tên loại kho + số thứ tự (-T01).
 * - Phần 2 (Cách B): Tự động sinh mã gian kho vật lý theo chuẩn khách sạn/tòa nhà: [Khu vực]-[Tầng][Số thứ tự 2 chữ số] (VD: A-101, B-205).
 */

export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/**
 * Lấy chữ cái đầu của các từ trong Tên loại kho (viết hoa, không dấu).
 * VD: "Kho Đồ Gia Đình" -> "KDGD"
 *     "Kho Mini Cá Nhân" -> "KMCN"
 *     "Kho Tiêu Chuẩn" -> "KTC"
 *     "Locker 1m" -> "L1M"
 */
export function generateUnitTypePrefix(name: string): string {
  const clean = removeVietnameseTones(name || '').trim()
  if (!clean) return 'LK'

  const words = clean.split(/[^a-zA-Z0-9]+/).filter(Boolean)
  if (words.length === 0) return 'LK'

  const acronym = words
    .map(w => {
      if (/^\d+$/.test(w)) return w
      return w[0].toUpperCase()
    })
    .join('')

  if (acronym.length >= 2) return acronym.slice(0, 8)
  if (acronym.length === 1 && clean.length >= 2) {
    return clean.slice(0, 3).toUpperCase()
  }
  return acronym || 'LK'
}

/**
 * Sinh mã loại kho theo Phương án 2:
 * [Chữ cái đầu]-[T01]
 * Nếu trùng với mã đã có trong cơ sở, tự động tăng lên -T02, -T03...
 */
export function generateUnitTypeCode(
  name: string,
  existingCodes: string[] = [],
  currentCode?: string,
): string {
  const prefix = generateUnitTypePrefix(name)
  const existingUpper = new Set(
    existingCodes
      .map(c => (c || '').trim().toUpperCase())
      .filter(c => c && c !== currentCode?.toUpperCase())
  )

  let index = 1
  let candidate = `${prefix}-T${String(index).padStart(2, '0')}`
  while (existingUpper.has(candidate)) {
    index++
    candidate = `${prefix}-T${String(index).padStart(2, '0')}`
    if (index > 99) break
  }
  return candidate
}

/**
 * Trích xuất tiền tố Khu vực:
 * "Khu A" -> "A"
 * "Khu B" -> "B"
 * "Zone C" -> "C"
 * "Khu Vực 1" -> "1"
 * "A" -> "A"
 */
export function extractZonePrefix(zone: string): string {
  const clean = removeVietnameseTones(zone || '').trim()
  if (!clean) return 'A'

  const stripped = clean.replace(/^(khu\s*vuc|khu|zone)\s*/i, '').trim()
  if (stripped) {
    const letters = stripped.replace(/[^a-zA-Z0-9]/g, '')
    if (letters) return letters.toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase() || 'A'
}

/**
 * Trích xuất số Tầng:
 * "Tầng 1" -> "1"
 * "T2" -> "2"
 * "1" -> "1"
 */
export function extractFloorNumber(floor: string): string {
  const clean = (floor || '').trim()
  const digits = clean.replace(/[^0-9]/g, '')
  if (digits) return digits
  return clean ? clean.toUpperCase() : '1'
}

/**
 * Sinh mã gian kho vật lý theo Cách B (Chuẩn Khách sạn / Tòa nhà):
 * [Khu vực]-[Tầng][Số thứ tự 2 chữ số]
 * VD:
 * - Khu A, Tầng 1, gian 1 -> A-101
 * - Khu A, Tầng 1, gian 10 -> A-110
 * - Khu B, Tầng 2, gian 5 -> B-205
 */
export function formatPhysicalUnitCode(zone: string, floor: string, index: number): string {
  const zonePrefix = extractZonePrefix(zone)
  const floorNum = extractFloorNumber(floor)
  const paddedIndex = String(index).padStart(2, '0')
  return `${zonePrefix}-${floorNum}${paddedIndex}`
}

/**
 * Hiển thị xem trước dãy mã gian kho vật lý (Cách B):
 * - count = 1: A-101
 * - count = 2: A-101, A-102
 * - count > 2: A-101 → A-110
 */
export function previewPhysicalUnitCodes(zone: string, floor: string, count: number): string {
  const safeCount = Math.max(1, count || 1)
  const first = formatPhysicalUnitCode(zone, floor, 1)
  if (safeCount === 1) return first
  if (safeCount === 2) return `${first}, ${formatPhysicalUnitCode(zone, floor, 2)}`
  const last = formatPhysicalUnitCode(zone, floor, safeCount)
  return `${first} → ${last}`
}
