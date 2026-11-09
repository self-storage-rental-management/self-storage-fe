import { describe, expect, it } from 'vitest'
import { customerUnitImage, resolveCustomerFacilityImage } from './customerPresentation'

describe('customer facility images', () => {
  it('uses the local facility image when the API does not provide one', () => {
    expect(resolveCustomerFacilityImage(null, 'BD-F01')).toBe('/images/facilities/binh-duong.jpg')
    expect(resolveCustomerFacilityImage(undefined, 'HCM-Q1-F01')).toBe('/images/customer-units/kho-s.jpg')
  })

  it('keeps a configured API image URL', () => {
    expect(resolveCustomerFacilityImage('https://cdn.example.test/facility.jpg', 'BD-F01'))
      .toBe('https://cdn.example.test/facility.jpg')
  })

  it('uses the local image that matches the unit size', () => {
    expect(customerUnitImage('S')).toBe('/images/customer-units/kho-s.jpg')
    expect(customerUnitImage('M')).toBe('/images/customer-units/kho-m.jpg')
  })
})
