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
