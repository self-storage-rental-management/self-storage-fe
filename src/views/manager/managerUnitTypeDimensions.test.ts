import { describe, expect, it } from 'vitest'
import { validateUnitTypeDimensions } from './managerUnitTypeDimensions'

const form = {
  lengthM: '8', widthM: '10', heightM: '5', maxLoadKg: '600', aisleWidthM: '1.8',
  rackLengthM: '4', rackWidthM: '2', rackHeightM: '4.5', rackCount: '4', physicalUnitCount: '1',
}

describe('Manager unit type dimensions', () => {
  it('accepts the existing S template', () => {
    expect(validateUnitTypeDimensions(form, true)).toBeUndefined()
  })

  it('rejects racks larger than the unit and an aisle as wide as the unit', () => {
    expect(validateUnitTypeDimensions({ ...form, rackHeightM: '6' }, true)).toContain('khung kệ')
    expect(validateUnitTypeDimensions({ ...form, aisleWidthM: '10' }, true)).toContain('lối đi')
  })

  it('requires at least one physical unit on creation and valid positive dimensions', () => {
    expect(validateUnitTypeDimensions({ ...form, physicalUnitCount: '0' }, true)).toContain('Số gian kho')
    expect(validateUnitTypeDimensions({ ...form, lengthM: '' }, true)).toContain('Chiều dài')
    expect(validateUnitTypeDimensions({ ...form, rackCount: '1.5' }, true)).toContain('Số khung kệ')
  })
})
