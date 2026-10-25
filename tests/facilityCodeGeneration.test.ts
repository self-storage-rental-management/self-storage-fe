import { describe, expect, it } from 'vitest'
import {
  generateFacilityCode,
  generateFacilityPrefix,
  removeVietnameseTones,
} from '../src/views/business/facility/FacilityFormFields'

describe('generateFacilityCode and prefix generation', () => {
  it('extracts acronym from Vietnamese facility name', () => {
    expect(removeVietnameseTones('Kho Tân Bình')).toBe('Kho Tan Binh')
    expect(generateFacilityPrefix('Kho Tân Bình', 'Hồ Chí Minh')).toBe('KTB')
    expect(generateFacilityCode('Kho Tân Bình', 'Hồ Chí Minh', [])).toBe('KTB-F01')
  })

  it('handles name with numbers like Kho Quận 1', () => {
    expect(generateFacilityPrefix('Kho Quận 1', 'Hồ Chí Minh')).toBe('KQ1')
    expect(generateFacilityCode('Kho Quận 1', 'Hồ Chí Minh', [])).toBe('KQ1-F01')
  })

  it('increments sequence if code already exists', () => {
    const existing = [
      { id: '1', code: 'KTB-F01' },
      { id: '2', code: 'KTB-F02' },
    ]
    expect(generateFacilityCode('Kho Tân Bình', 'Hồ Chí Minh', existing)).toBe('KTB-F03')
  })

  it('falls back to city code if facility name is empty', () => {
    expect(generateFacilityPrefix('', 'Hà Nội')).toBe('HN')
    expect(generateFacilityCode('', 'Hà Nội', [])).toBe('HN-F01')
    expect(generateFacilityCode('', 'Hồ Chí Minh', [])).toBe('HCM-F01')
    expect(generateFacilityCode('', 'Bình Dương', [])).toBe('BD-F01')
    expect(generateFacilityCode('', 'Đà Nẵng', [])).toBe('DN-F01')
  })

  it('increments city code if facility name is empty and code exists', () => {
    const existing = [{ id: '1', code: 'HN-F01' }]
    expect(generateFacilityCode('', 'Hà Nội', existing)).toBe('HN-F02')
  })
})
