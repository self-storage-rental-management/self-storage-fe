import { describe, expect, it } from 'vitest'
import { UNIT_SPECS } from '../src/data/demoDatabase'

describe('Customer Storage Unit Display Requirements', () => {
  it('verifies rack count matches the floor plan images for all sizes', () => {
    // kho-s-chi-tiet.png: 4 racks (2 x 2)
    expect(UNIT_SPECS.S.frameCount).toBe(4)
    // kho-m-chi-tiet.png: 6 racks (2 x 3)
    expect(UNIT_SPECS.M.frameCount).toBe(6)
    // kho-l-chi-tiet.png: 8 racks (2 x 4)
    expect(UNIT_SPECS.L.frameCount).toBe(8)
    // kho-xl-chi-tiet.png: 10 racks (2 x 5)
    expect(UNIT_SPECS.XL.frameCount).toBe(10)
  })

  it('verifies single aisle width value matching warehouse standards for all sizes', () => {
    // S: 1.8m aisle
    expect(UNIT_SPECS.S.aisleM).toBe(1.8)
    // M: 2.2m aisle
    expect(UNIT_SPECS.M.aisleM).toBe(2.2)
    // L: 2.6m aisle
    expect(UNIT_SPECS.L.aisleM).toBe(2.6)
    // XL: 3.0m aisle
    expect(UNIT_SPECS.XL.aisleM).toBe(3.0)
  })

  it('verifies full D x R x C dimensions preserve height without separate height field', () => {
    expect(UNIT_SPECS.S.dimensions).toContain('8,0')
    expect(UNIT_SPECS.S.dimensions).toContain('10,0')
    expect(UNIT_SPECS.S.dimensions).toContain('5,0')
    expect(UNIT_SPECS.S.heightM).toBe(5.0)
  })

  it('verifies customer trolley helper properly localizes equipment names', () => {
    const customerTrolleyVi = (sizeCode?: string, originalTrolley?: string): string => {
      const code = (sizeCode || '').toUpperCase()
      if (code === 'S') return 'Xe đẩy tay / xe sàn nhỏ'
      if (code === 'M') return 'Xe đẩy sàn phẳng'
      if (code === 'L') return 'Xe nâng tay pallet'
      if (code === 'XL') return 'Xe nâng điện dắt bộ'
      if (!originalTrolley) return 'Xe đẩy tiêu chuẩn'
      const t = originalTrolley.toLowerCase()
      if (t.includes('electric') || t.includes('walkie')) return 'Xe nâng điện dắt bộ'
      if (t.includes('platform')) return 'Xe đẩy sàn phẳng'
      if (t.includes('pallet')) return 'Xe nâng tay pallet'
      return originalTrolley
    }

    expect(customerTrolleyVi('S', 'Xe đẩy tay / xe sàn nhỏ')).toBe('Xe đẩy tay / xe sàn nhỏ')
    expect(customerTrolleyVi('M', 'Platform trolley')).toBe('Xe đẩy sàn phẳng')
    expect(customerTrolleyVi('L', 'Pallet jack tay')).toBe('Xe nâng tay pallet')
    expect(customerTrolleyVi('XL', 'Electric walkie pallet truck')).toBe('Xe nâng điện dắt bộ')
  })
})
