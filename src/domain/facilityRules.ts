/**
 * Business rules for Facility and Storage Unit operations:
 * - Vehicle access lane validation based on unit size standards and entrance doors.
 */

export interface VehicleAccessStandard {
  minLaneM: number
  doorWidthM: number
  vehicleType: string
}

/**
 * Returns the vehicle lane standard and entrance door dimension for a storage unit size.
 * Standards:
 * - S: minLane 1.8m, doorWidth 1.0m (Trolley / hand cart)
 * - M: minLane 2.2m, doorWidth 1.2m (Platform trolley)
 * - L: minLane 2.6m, doorWidth 1.5m (Pallet jack)
 * - XL: minLane 3.0m, doorWidth 2.0m (Electric walkie / light forklift)
 * - Custom / XXL / Large: minLane >= 3.5m, doorWidth 2.4m (Heavy truck / forklift)
 */
export const getUnitTypeVehicleStandard = (
  sizeCode: string,
  widthM?: number,
  lengthM?: number,
): VehicleAccessStandard => {
  const code = (sizeCode || '').toUpperCase().trim()
  if (code === 'S') return { minLaneM: 1.8, doorWidthM: 1.0, vehicleType: 'Xe đẩy tay / Xe sàn nhỏ' }
  if (code === 'M') return { minLaneM: 2.2, doorWidthM: 1.2, vehicleType: 'Platform trolley / Xe kéo' }
  if (code === 'L') return { minLaneM: 2.6, doorWidthM: 1.5, vehicleType: 'Xe nâng tay Pallet jack' }
  if (code === 'XL') return { minLaneM: 3.0, doorWidthM: 2.0, vehicleType: 'Xe nâng điện / Forklift nhẹ' }

  // Custom unit types (XXL, 2XL, 3XL, 4XL, MINI, etc.)
  const area = (widthM || 10) * (lengthM || 10)
  if (code.includes('XXL') || code.includes('3XL') || code.includes('4XL') || area >= 100) {
    return { minLaneM: 3.5, doorWidthM: 2.4, vehicleType: 'Xe tải nặng / Container / Forklift' }
  }
  if (area >= 50) {
    return { minLaneM: 3.0, doorWidthM: 2.0, vehicleType: 'Xe tải 2.5T / Forklift' }
  }
  if (area <= 20) {
    return { minLaneM: 1.8, doorWidthM: 1.0, vehicleType: 'Xe đẩy hàng mini' }
  }
  return { minLaneM: 2.5, doorWidthM: 1.5, vehicleType: 'Xe tải nhẹ / Pallet jack' }
}

/**
 * Validates that vehicle lane width meets or exceeds size standard and door entrance width.
 */
export const validateVehicleLaneWidth = (
  sizeCode: string,
  laneWidthM: number,
  widthM?: number,
  lengthM?: number,
): { isValid: boolean; minRequiredLaneM: number; message: string } => {
  const std = getUnitTypeVehicleStandard(sizeCode, widthM, lengthM)
  const isValid = laneWidthM >= std.minLaneM && laneWidthM >= std.doorWidthM
  return {
    isValid,
    minRequiredLaneM: std.minLaneM,
    message: isValid
      ? 'Lối xe đạt chuẩn lưu thông'
      : `Lối xe (${laneWidthM}m) không đạt chuẩn tối thiểu ${std.minLaneM}m cho cỡ ${sizeCode} (cửa kho ${std.doorWidthM}m - ${std.vehicleType})`,
  }
}

export interface FrameSpecValidationResult {
  isValid: boolean
  errors: string[]
  sanitized: {
    frameCount: number
    frameDimensions: {
      lengthM: number
      widthM: number
      heightM: number
    }
  }
}

/**
 * Validates frame dimensions (length > 0, width > 0, height > 0) and frame count (integer >= 0).
 * Provides sanitized fallback values according to domain convention.
 */
export const validateFrameSpecification = (
  frameCount?: number,
  frameDimensions?: { lengthM?: number; widthM?: number; heightM?: number; depthM?: number },
): FrameSpecValidationResult => {
  const errors: string[] = []

  const rawCount = frameCount ?? 0
  const isCountValid =
    typeof rawCount === 'number' &&
    !isNaN(rawCount) &&
    Number.isInteger(rawCount) &&
    rawCount >= 0

  if (!isCountValid) {
    errors.push('Số khung phải là số nguyên không âm (>= 0)')
  }

  const rawLength = frameDimensions?.lengthM ?? frameDimensions?.depthM ?? 1
  const isLengthValid =
    typeof rawLength === 'number' && !isNaN(rawLength) && rawLength > 0

  if (!isLengthValid) {
    errors.push('Chiều dài khung phải lớn hơn 0')
  }

  const rawWidth = frameDimensions?.widthM ?? 1
  const isWidthValid =
    typeof rawWidth === 'number' && !isNaN(rawWidth) && rawWidth > 0

  if (!isWidthValid) {
    errors.push('Chiều rộng khung phải lớn hơn 0')
  }

  const rawHeight = frameDimensions?.heightM ?? 1
  const isHeightValid =
    typeof rawHeight === 'number' && !isNaN(rawHeight) && rawHeight > 0

  if (!isHeightValid) {
    errors.push('Chiều cao khung phải lớn hơn 0')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      frameCount: isCountValid ? rawCount : Math.max(0, Math.floor(rawCount) || 0),
      frameDimensions: {
        lengthM: isLengthValid ? rawLength : 1,
        widthM: isWidthValid ? rawWidth : 1,
        heightM: isHeightValid ? rawHeight : 1,
      },
    },
  }
}

/**
 * Normalizes any unit size label, code, or type name to a standard uppercase size code:
 * 'S', 'M', 'L', 'XL', 'XXL', '4XL', etc.
 */
export const storageSizeCode = (value?: string): string => {
  if (!value) return ''
  const normalized = value.toLowerCase().trim()
  if (normalized.includes('4xl')) return '4XL'
  if (normalized.includes('xxl')) return 'XXL'
  if (
    normalized.includes('extra large') ||
    normalized === 'xlarge' ||
    normalized === 'xl' ||
    /(^|\W)xl(\W|$)/.test(normalized) ||
    normalized.includes('rất lớn') ||
    normalized.includes('cực lớn')
  ) {
    return 'XL'
  }
  if (
    normalized.includes('medium') ||
    normalized === 'm' ||
    /(^|\W)m(\W|$)/.test(normalized) ||
    normalized.includes('kho trung') ||
    normalized.includes('kho vừa') ||
    normalized.includes('vừa') ||
    normalized.includes('trung')
  ) {
    return 'M'
  }
  if (
    normalized.includes('small') ||
    normalized === 's' ||
    /(^|\W)s(\W|$)/.test(normalized) ||
    normalized.includes('kho nhỏ') ||
    normalized.includes('nhỏ')
  ) {
    return 'S'
  }
  if (
    normalized.includes('large') ||
    normalized === 'l' ||
    /(^|\W)l(\W|$)/.test(normalized) ||
    normalized.includes('kho lớn') ||
    normalized.includes('lớn')
  ) {
    return 'L'
  }
  return value.toUpperCase().trim()
}

/**
 * Robustly checks if a physical unit or unit type matches a requested size/type.
 */
export const unitTypeMatches = (unitTypeName?: string, requestedTypeName?: string): boolean => {
  if (!unitTypeName || !requestedTypeName) return false
  const u = unitTypeName.toLowerCase().trim()
  const r = requestedTypeName.toLowerCase().trim()
  if (u === r) return true

  const sizeU = storageSizeCode(unitTypeName)
  const sizeR = storageSizeCode(requestedTypeName)
  const STANDARD_CODES = ['S', 'M', 'L', 'XL', 'XXL', '4XL']

  const isStandardU = STANDARD_CODES.includes(sizeU)
  const isStandardR = STANDARD_CODES.includes(sizeR)

  if (isStandardU && isStandardR) {
    return sizeU === sizeR
  }
  if (isStandardU || isStandardR) {
    return false
  }

  if (u.length >= 4 && r.length >= 4) {
    if (u.includes(r) || r.includes(u)) return true
  }

  const firstWordU = u.split(' ')[0]
  const firstWordR = r.split(' ')[0]
  if (firstWordU && firstWordR && firstWordU === firstWordR && !['kho', 'storage'].includes(firstWordU)) {
    return true
  }
  return false
}

