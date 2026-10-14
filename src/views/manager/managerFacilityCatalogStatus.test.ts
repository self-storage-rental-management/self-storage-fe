import { describe, expect, it } from 'vitest'
import { isFacilityCatalogType, summarizeFacilityCatalog } from './managerFacilityCatalogApi'

const type = { id: 'type-dn', facilityId: 'facility-dn', code: 'DN-S-001', name: 'Kho nhỏ', lengthM: 8, widthM: 10, heightM: 5, areaM2: 80, volumeM3: 400, maxLoadKg: 1000, monthlyPrice: 0, status: 'awaiting_pricing' as const }

describe('manager catalog before BO pricing', () => {
  it('accepts a newly created type and counts its four physical units', () => {
    expect(isFacilityCatalogType(type, 'facility-dn')).toBe(true)
    const units = Array.from({ length: 4 }, (_, index) => ({ id: `unit-${index}`, facilityId: 'facility-dn', unitTypeId: type.id, status: 'available' as const }))
    expect(summarizeFacilityCatalog([type], units)[0]).toMatchObject({ total: 4, counts: { available: 4 }, status: 'awaiting_pricing' })
  })
  it('accepts all backend lifecycle states but rejects unknown status and another facility', () => {
    for (const status of ['draft', 'awaiting_pricing', 'active', 'inactive']) expect(isFacilityCatalogType({ ...type, status }, 'facility-dn')).toBe(true)
    expect(isFacilityCatalogType({ ...type, status: 'unexpected' }, 'facility-dn')).toBe(false)
    expect(isFacilityCatalogType(type, 'facility-q1')).toBe(false)
  })
})
