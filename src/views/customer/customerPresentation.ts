import { UNIT_SPECS } from '../../data/demoDatabase'

export type CustomerUnitSizeCode = 'S' | 'M' | 'L' | 'XL'

export interface CustomerUnitAmenities {
  aisleWidthM: number
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
    aisleWidthM: 3,
    smallBoxCapacity: UNIT_SPECS.S.smallBoxes,
    largeBoxCapacity: UNIT_SPECS.S.largeBoxes,
    trolley: 'Xe đẩy tay thông thường (0,8 × 0,5 m)',
  },
  M: {
    aisleWidthM: 3.2,
    smallBoxCapacity: UNIT_SPECS.M.smallBoxes,
    largeBoxCapacity: UNIT_SPECS.M.largeBoxes,
    trolley: 'Xe đẩy sàn phẳng',
  },
  L: {
    aisleWidthM: 3.4,
    smallBoxCapacity: UNIT_SPECS.L.smallBoxes,
    largeBoxCapacity: UNIT_SPECS.L.largeBoxes,
    trolley: 'Xe nâng tay pallet',
  },
  XL: {
    aisleWidthM: 3.6,
    smallBoxCapacity: UNIT_SPECS.XL.smallBoxes,
    largeBoxCapacity: UNIT_SPECS.XL.largeBoxes,
    trolley: 'Xe nâng điện dắt bộ',
  },
}

export const CUSTOMER_UNIT_IMAGES: Record<CustomerUnitSizeCode, string> = {
  S: '/images/customer-units/kho-s.jpg',
  M: '/images/customer-units/kho-m.jpg',
  L: '/images/customer-units/kho-l.jpg',
  XL: '/images/customer-units/kho-xl.jpg',
}

export function customerUnitAmenities(sizeCode?: string): CustomerUnitAmenities | undefined {
  const normalized = sizeCode?.toUpperCase() as CustomerUnitSizeCode | undefined
  return normalized ? CUSTOMER_UNIT_AMENITIES[normalized] : undefined
}

export function customerUnitImage(sizeCode?: string): string {
  const normalized = sizeCode?.toUpperCase() as CustomerUnitSizeCode | undefined
  return (normalized && CUSTOMER_UNIT_IMAGES[normalized]) || CUSTOMER_UNIT_IMAGES.XL
}

export function customerFacilityImage(code?: string): string {
  return code?.toUpperCase().startsWith('BD-')
    ? '/images/facilities/binh-duong.jpg'
    : '/images/customer-units/kho-s.jpg'
}

export function resolveCustomerFacilityImage(imageUrl: string | null | undefined, code?: string): string {
  return imageUrl?.trim() || customerFacilityImage(code)
}
