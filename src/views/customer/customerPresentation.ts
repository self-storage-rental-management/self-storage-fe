export type CustomerUnitSizeCode = 'S' | 'M' | 'L' | 'XL'

export interface CustomerUnitAmenities {
  aisleWidthM: number
  maxCargoDimCm: { lengthCm: number; widthCm: number; heightCm: number }
  smallBoxCapacity: number
  largeBoxCapacity: number
  trolley: string
}

/**
 * Nội dung minh họa giao diện, không được dùng để tính availability, compatibility,
 * báo giá hoặc trạng thái Reservation. Các thông số nghiệp vụ phải lấy từ API BE.
 */
export const CUSTOMER_UNIT_AMENITIES: Record<CustomerUnitSizeCode, CustomerUnitAmenities> = {
  S: {
    aisleWidthM: 1.8,
    maxCargoDimCm: { lengthCm: 160, widthCm: 80, heightCm: 150 },
    smallBoxCapacity: 336,
    largeBoxCapacity: 200,
    trolley: 'Xe đẩy tay thông thường (0,8 × 0,5 m)',
  },
  M: {
    aisleWidthM: 2.2,
    maxCargoDimCm: { lengthCm: 200, widthCm: 100, heightCm: 180 },
    smallBoxCapacity: 504,
    largeBoxCapacity: 300,
    trolley: 'Xe đẩy sàn phẳng',
  },
  L: {
    aisleWidthM: 2.6,
    maxCargoDimCm: { lengthCm: 240, widthCm: 120, heightCm: 210 },
    smallBoxCapacity: 672,
    largeBoxCapacity: 400,
    trolley: 'Xe nâng tay pallet',
  },
  XL: {
    aisleWidthM: 3,
    maxCargoDimCm: { lengthCm: 280, widthCm: 140, heightCm: 220 },
    smallBoxCapacity: 840,
    largeBoxCapacity: 500,
    trolley: 'Xe nâng điện dắt bộ',
  },
}

export function customerUnitAmenities(sizeCode?: string): CustomerUnitAmenities | undefined {
  const normalized = sizeCode?.toUpperCase() as CustomerUnitSizeCode | undefined
  return normalized ? CUSTOMER_UNIT_AMENITIES[normalized] : undefined
}

export function customerFacilityImage(code?: string): string {
  return code?.toUpperCase().startsWith('BD-')
    ? '/images/facilities/binh-duong.jpg'
    : '/images/customer-units/kho-s.jpg'
}
