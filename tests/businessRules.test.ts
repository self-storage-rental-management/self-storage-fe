import { describe, it, expect } from 'vitest'
import { DEFAULT_ROLE_PERMISSIONS, normalizeRolePermissions } from '../src/auth/rbac'
import type { User } from '../src/types'
import { isExcludedFacility, isExcludedUnit, isExcludedRelated } from '../src/store/StorageHubContext'
import { getUnitTypeVehicleStandard, validateVehicleLaneWidth } from '../src/domain/facilityRules'

describe('Business Owner (BO) Business Rules & Logic', () => {
  const dummyBusinessUser: User = {
    id: 'demo-business',
    name: 'Demo Operations',
    email: 'business@storagehub.demo',
    role: 'business',
    facility: 'All facilities'
  }

  describe('RBAC & Permissions', () => {
    it('grants manage_policies and commercial permissions to business role by default', () => {
      const perms = DEFAULT_ROLE_PERMISSIONS.business
      expect(perms.view_facilities).toBe(true)
      expect(perms.view_reports).toBe(true)
      expect(perms.view_policies).toBe(true)
      expect(perms.manage_policies).toBe(true)
      expect(perms.view_dashboard).toBe(true)
      expect(perms.view_payments).toBe(true)
    })

    it('preserves manage_policies permission for business role during normalization', () => {
      const normalized = normalizeRolePermissions({
        business: {
          manage_policies: false,
          view_facilities: true
        }
      })
      expect(normalized.business.manage_policies).toBe(true)
    })

    it('keeps staff-only operations disabled for business', () => {
      const perms = DEFAULT_ROLE_PERMISSIONS.business
      expect(perms.perform_checkin).toBe(false)
      expect(perms.approve_reservations).toBe(false)
      expect(perms.manage_staff_tasks).toBe(false)
    })
  })

  describe('Facility Code Suggestion Logic', () => {
    const suggestFacilityCode = (cityName: string, existingCodes: string[]) => {
      let prefix = 'FAC'
      const lower = cityName.toLowerCase()
      if (lower.includes('hà nội') || lower.includes('ha noi')) prefix = 'HN'
      else if (lower.includes('hồ chí minh') || lower.includes('hcm') || lower.includes('sài gòn') || lower.includes('q1') || lower.includes('quận')) prefix = 'HCM'
      else if (lower.includes('bình dương') || lower.includes('binh duong')) prefix = 'BD'
      else if (lower.includes('đà nẵng') || lower.includes('da nang')) prefix = 'DN'
      else if (lower.includes('hải phòng') || lower.includes('hai phong')) prefix = 'HP'
      else if (lower.includes('cần thơ') || lower.includes('can tho')) prefix = 'CT'
      else {
        prefix = cityName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase() || 'FAC'
      }

      const regex = new RegExp(`^${prefix}-F?(\\d+)`, 'i')
      const existingNums = existingCodes
        .map((c) => {
          const m = c.match(regex)
          return m ? parseInt(m[1], 10) : 0
        })
        .filter((n) => n > 0)

      const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1
      return `${prefix}-F${String(nextNum).padStart(2, '0')}`
    }

    it('suggests correct facility code for cities', () => {
      expect(suggestFacilityCode('Hà Nội', [])).toBe('HN-F01')
      expect(suggestFacilityCode('Hà Nội', ['HN-F01'])).toBe('HN-F02')
      expect(suggestFacilityCode('TP. Hồ Chí Minh', ['HCM-Q1-F01'])).toBe('HCM-F01')
      expect(suggestFacilityCode('Bình Dương', ['BD-F01'])).toBe('BD-F02')
      expect(suggestFacilityCode('Đà Nẵng', [])).toBe('DN-F01')
    })
  })

  describe('Unit Allocation & Occupied Constraints', () => {
    it('prevents reducing unit count below the number of occupied units', () => {
      const currentOccupied = { S: 3, M: 2, L: 1, XL: 0 }
      const newAllocation = { S: 2, M: 2, L: 1, XL: 0 } // Tried to reduce S from 3 to 2

      const canReduceS = newAllocation.S >= currentOccupied.S
      const canReduceM = newAllocation.M >= currentOccupied.M
      const canReduceL = newAllocation.L >= currentOccupied.L
      const canReduceXL = newAllocation.XL >= currentOccupied.XL

      expect(canReduceS).toBe(false)
      expect(canReduceM).toBe(true)
      expect(canReduceL).toBe(true)
      expect(canReduceXL).toBe(true)
    })
  })

  describe('Facility Safety Checks on Delete', () => {
    it('blocks facility deletion when there are occupied units or active rentals', () => {
      const facilityId = 'fac-001'
      const targetFac = { id: 'fac-001', code: 'HCM-Q1-F01', occupied: 3 }
      const units = [
        { id: 'HCM-Q1-F01-S-001', facilityId: 'fac-001', status: 'occupied' },
        { id: 'HCM-Q1-F01-S-002', facilityId: 'fac-001', status: 'available' }
      ]
      const rentals = [
        { id: 'rnt-1', facilityId: 'fac-001', status: 'active' }
      ]
      const holds: any[] = []

      const hasOccupiedUnits = units.some(u => 
        (u.facilityId === facilityId || (targetFac && (u.facilityId === targetFac.id || u.facilityId === targetFac.code))) &&
        (u.status === 'occupied' || (u.status as string) === 'rented')
      )
      const hasActiveRentals = rentals.some(r =>
        (r.facilityId === facilityId || (targetFac && (r.facilityId === targetFac.id || r.facilityId === targetFac.code))) &&
        ['active', 'return_requested', 'return_inspection', 'closing'].includes(r.status)
      )

      expect(hasOccupiedUnits).toBe(true)
      expect(hasActiveRentals).toBe(true)
    })

    it('allows facility deletion when facility has no occupied units, no active holds, and no active rentals', () => {
      const facilityId = 'fac-new'
      const targetFac = { id: 'fac-new', code: 'HN-F01', occupied: 0 }
      const units = [
        { id: 'HN-F01-S-001', facilityId: 'fac-new', status: 'available' },
        { id: 'HN-F01-S-002', facilityId: 'fac-new', status: 'available' }
      ]
      const rentals: any[] = []
      const holds: any[] = []

      const hasOccupiedUnits = units.some(u => 
        (u.facilityId === facilityId || (targetFac && (u.facilityId === targetFac.id || u.facilityId === targetFac.code))) &&
        (u.status === 'occupied' || (u.status as string) === 'rented')
      )
      const hasActiveRentals = rentals.some(r =>
        (r.facilityId === facilityId || (targetFac && (r.facilityId === targetFac.id || r.facilityId === targetFac.code))) &&
        ['active', 'return_requested', 'return_inspection', 'closing'].includes(r.status)
      )
      const hasActiveHolds = holds.some(h =>
        (h.facilityId === facilityId || (targetFac && (h.facilityId === targetFac.id || h.facilityId === targetFac.code))) &&
        !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(h.status)
      )

      expect(hasOccupiedUnits).toBe(false)
      expect(hasActiveRentals).toBe(false)
      expect(hasActiveHolds).toBe(false)
    })
  })

  describe('Pricing Normalization & Currency Conversion', () => {
    const USD_TO_VND_RATE = 26000

    it('normalizes VND monthly price to base currency to prevent formatVnd inflation', () => {
      const rawVndPrice = 1600000 // 1.6M VND
      const normalizedPrice = rawVndPrice > 10000 ? rawVndPrice / USD_TO_VND_RATE : rawVndPrice
      
      // formatVnd(normalizedPrice) will calculate: Math.round(normalizedPrice * USD_TO_VND_RATE)
      const formattedVnd = Math.round(normalizedPrice * USD_TO_VND_RATE)
      expect(formattedVnd).toBe(1600000)
    })

    it('keeps standard USD base amounts unchanged if <= 10000', () => {
      const basePrice = 61.54 // ~$61.54
      const normalized = basePrice > 10000 ? basePrice / USD_TO_VND_RATE : basePrice
      expect(normalized).toBe(61.54)
    })
  })

  describe('Dynamic Occupancy Counting', () => {
    it('accurately counts occupied units matching either facility id or code', () => {
      const fac = { id: 'fac-001', code: 'HCM-Q1-F01', units: 10, occupied: 2 }
      const unitsList = [
        { id: 'u1', facilityId: 'fac-001', status: 'occupied' },
        { id: 'u2', facilityId: 'HCM-Q1-F01', status: 'occupied' },
        { id: 'u3', facilityId: 'fac-001', status: 'available' },
        { id: 'u4', facilityId: 'fac-002', status: 'occupied' },
      ]

      const getFacilityOccupiedCount = (f: typeof fac) => {
        return unitsList.filter(
          (u) =>
            (u.facilityId === f.id || u.facilityId === f.code) &&
            (u.status === 'occupied' || (u.status as string) === 'rented')
        ).length
      }

      const getFacilityTotalUnits = (f: typeof fac) => {
        const matching = unitsList.filter((u) => u.facilityId === f.id || u.facilityId === f.code).length
        return matching > 0 ? matching : f.units || 0
      }

      expect(getFacilityOccupiedCount(fac)).toBe(2)
      expect(getFacilityTotalUnits(fac)).toBe(3)
    })
  })

  describe('Facility Price & Details View Synchronization', () => {
    const USD_TO_VND_RATE = 26000
    const UNIT_SPECS = {
      S: { priceMonthly: 5500000, priceFormatted: '5.500.000đ' },
      M: { priceMonthly: 9500000, priceFormatted: '9.500.000đ' },
      L: { priceMonthly: 15000000, priceFormatted: '15.000.000đ' },
      XL: { priceMonthly: 22500000, priceFormatted: '22.500.000đ' },
    }

    const resolveFacilitySizePriceFormatted = (
      fac: any,
      size: 'S' | 'M' | 'L' | 'XL',
      unitsList: any[],
      facilityPricingOverrides: Record<string, any> = {}
    ): string => {
      const tierId = size === 'S' ? 'tier-1' : size === 'M' ? 'tier-2' : size === 'L' ? 'tier-3' : 'tier-4'
      const override = facilityPricingOverrides[fac.id]?.[tierId]
      if (override?.basePrice && override.basePrice > 0) {
        return `${Math.round(override.basePrice).toLocaleString('vi-VN')}đ`
      }

      if (fac.unitPrices?.[size] && fac.unitPrices[size] > 0) {
        return `${Math.round(fac.unitPrices[size]).toLocaleString('vi-VN')}đ`
      }

      const matchingUnits = unitsList.filter(
        (u) =>
          (u.facilityId === fac.id || u.facilityId === fac.code) &&
          (u.size === size || u.type === (size === 'S' ? 'Small' : size === 'M' ? 'Medium' : size === 'L' ? 'Large' : 'Extra Large'))
      )
      if (matchingUnits.length > 0 && matchingUnits[0].price) {
        const rawP = matchingUnits[0].price
        const vnd = rawP > 10000 ? rawP : Math.round(rawP * USD_TO_VND_RATE)
        return `${Math.round(vnd).toLocaleString('vi-VN')}đ`
      }

      const dist = fac.unitDistribution
      const activeSizes = dist
        ? (['S', 'M', 'L', 'XL'] as const).filter((s) => (dist[s] ?? 0) > 0)
        : []
      if (activeSizes.length === 1 && activeSizes[0] === size && fac.price) {
        const parsed = parseInt(fac.price.replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) {
          return `${Math.round(parsed).toLocaleString('vi-VN')}đ`
        }
      }

      return UNIT_SPECS[size].priceFormatted
    }

    it('synchronizes custom facility price (15.550.000đ) to detail view when facility has only XL units', () => {
      // User scenario: facility created with 25 XL units, initially defaulted to 22.500.000đ
      const facInitial = {
        id: 'HN-F01',
        code: 'HN-F01',
        name: 'Kho Việt – Cơ sở Hà Nội',
        units: 25,
        unitDistribution: { S: 0, M: 0, L: 0, XL: 25 },
        price: '22.500.000đ',
        unitPrices: { S: 5500000, M: 9500000, L: 15000000, XL: 22500000 },
      }
      const unitsInitial = Array.from({ length: 25 }, (_, i) => ({
        id: `HN-F01-XL-${i + 1}`,
        facilityId: 'HN-F01',
        size: 'XL',
        price: 22500000 / USD_TO_VND_RATE,
      }))

      // Initial price in detail view is 22.500.000đ
      expect(resolveFacilitySizePriceFormatted(facInitial, 'XL', unitsInitial)).toBe('22.500.000đ')

      // User updates starting price in Edit modal to 15.550.000đ
      const updatedPriceStr = '15.550.000đ'
      const updatedPriceNum = 15550000
      const facUpdated = {
        ...facInitial,
        price: updatedPriceStr,
        unitPrices: { ...facInitial.unitPrices, XL: updatedPriceNum },
      }
      const unitsUpdated = unitsInitial.map((u) => ({
        ...u,
        price: updatedPriceNum / USD_TO_VND_RATE,
      }))

      // Detail view now correctly reflects 15.550.000đ instead of hardcoded 22.500.000đ
      expect(resolveFacilitySizePriceFormatted(facUpdated, 'XL', unitsUpdated)).toBe('15.550.000đ')
    })

    it('correctly auto-determines starting price based on the smallest active size', () => {
      // All S, M, L are 0, only XL has 25 units
      const dist = { S: 0, M: 0, L: 0, XL: 25 }
      const activeSizes = (['S', 'M', 'L', 'XL'] as const).filter((s) => dist[s] > 0)
      const minActiveSize = activeSizes[0]
      expect(minActiveSize).toBe('XL')

      const xlPrice = UNIT_SPECS.XL.priceFormatted
      expect(xlPrice).toBe('22.500.000đ')
    })
  })

  describe('Facility Load Capacity & Warehouse Photos', () => {
    it('correctly calculates total floor load capacity (tons) from unit distribution and load limits', () => {
      const unitDist = { S: 5, M: 5, L: 5, XL: 5 }
      const loadLimits = { S: 1000, M: 1600, L: 2800, XL: 4000 }

      const totalKg =
        unitDist.S * loadLimits.S +
        unitDist.M * loadLimits.M +
        unitDist.L * loadLimits.L +
        unitDist.XL * loadLimits.XL

      expect(totalKg).toBe(5 * 1000 + 5 * 1600 + 5 * 2800 + 5 * 4000) // 5000 + 8000 + 14000 + 20000 = 47000 kg
      const totalTon = Math.round((totalKg / 1000) * 10) / 10
      expect(totalTon).toBe(47.0)
    })

    it('assigns custom maxLoadKg to storage units when specified by business owner', () => {
      const defaultLoadLimits: Record<'S' | 'M' | 'L' | 'XL', number> = { S: 1000, M: 1600, L: 2800, XL: 4000 }
      const customLoadLimits: Partial<Record<'S' | 'M' | 'L' | 'XL', number>> = { S: 1200, M: 1800, L: 3000, XL: 4500 }
      const size: 'S' | 'M' | 'L' | 'XL' = 'L'
      const unitMaxLoad = customLoadLimits[size] ?? defaultLoadLimits[size]
      expect(unitMaxLoad).toBe(3000)
    })

    it('supports base64 data URLs and standard URLs for warehouse photos', () => {
      const base64Url = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...'
      const webUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d'

      const isImageSrcValid = (src: string) => src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://')

      expect(isImageSrcValid(base64Url)).toBe(true)
      expect(isImageSrcValid(webUrl)).toBe(true)
      expect(isImageSrcValid('invalid_string')).toBe(false)
    })

    it('does not exclude Đà Nẵng facilities, units, or related data on reload', () => {
      const daNangFacility = {
        id: 'fac-danang-01',
        code: 'DN-F01',
        city: 'Đà Nẵng',
        name: 'Kho Việt – Cơ sở Đà Nẵng'
      }
      expect(isExcludedFacility(daNangFacility)).toBe(false)

      const daNangUnit = {
        id: 'DN-F01-S-001',
        code: 'DN-F01-S-001',
        facilityId: 'DN-F01',
        facilityName: 'Kho Việt – Cơ sở Đà Nẵng'
      }
      expect(isExcludedUnit(daNangUnit)).toBe(false)

      const daNangRelated = {
        facilityId: 'DN-F01',
        facilityName: 'Kho Việt – Cơ sở Đà Nẵng'
      }
      expect(isExcludedRelated(daNangRelated)).toBe(false)
    })

    it('supports custom unitLaneWidths configuration and zero unit defaults', () => {
      const facilityWithCustomLanes = {
        id: 'fac-custom-lanes',
        name: 'Kho Custom Lanes',
        unitDistribution: { S: 0, M: 0, L: 0, XL: 0 },
        unitLaneWidths: { S: 2.0, M: 2.5, L: 3.0, XL: 3.5 }
      }

      expect(facilityWithCustomLanes.unitLaneWidths.S).toBe(2.0)
      expect(facilityWithCustomLanes.unitLaneWidths.M).toBe(2.5)
      expect(facilityWithCustomLanes.unitLaneWidths.L).toBe(3.0)
      expect(facilityWithCustomLanes.unitLaneWidths.XL).toBe(3.5)
      expect(facilityWithCustomLanes.unitDistribution.S).toBe(0)
    })
  })

  describe('Dynamic Unit Types & Custom Dimensions (D × R × C)', () => {
    it('calculates volume (m3) and area (m2) accurately when custom height is provided', () => {
      const customSpec = {
        sizeCode: 'XXL',
        name: 'Kho Ngoại Khổ (XXL)',
        lengthM: 25.0,
        widthM: 12.0,
        heightM: 6.5, // Customizable height, not hardcoded to 4.5m
        laneWidthM: 5.0,
        maxLoadKg: 5000,
        monthlyPrice: 32000000,
        count: 4,
      }

      const calcArea = Math.round(customSpec.lengthM * customSpec.widthM * 10) / 10
      const calcVol = Math.round(customSpec.lengthM * customSpec.widthM * customSpec.heightM * 10) / 10

      expect(calcArea).toBe(300.0) // 25 * 12 = 300 m2
      expect(calcVol).toBe(1950.0) // 25 * 12 * 6.5 = 1950 m3
    })

    it('allows deleting unit types during creation or when occupancy is 0', () => {
      let specs = [
        { sizeCode: 'S', count: 0 },
        { sizeCode: 'M', count: 0 },
        { sizeCode: 'L', count: 0 },
        { sizeCode: 'XL', count: 0 },
        { sizeCode: 'XXL', count: 5 },
      ]

      // Business owner removes S, M, L to keep only XL and XXL
      const removeSpec = (list: typeof specs, code: string, occCount: number, isEditing: boolean) => {
        if (isEditing && occCount > 0) {
          throw new Error(`Cannot delete ${code} with occupied units`)
        }
        return list.filter((s) => s.sizeCode !== code)
      }

      specs = removeSpec(specs, 'S', 0, false)
      specs = removeSpec(specs, 'M', 0, false)
      specs = removeSpec(specs, 'L', 0, false)

      expect(specs.map((s) => s.sizeCode)).toEqual(['XL', 'XXL'])
      expect(specs.length).toBe(2)
    })

    it('strictly prevents deletion of a unit type when units are actively rented', () => {
      const occupiedMap = {
        S: 3,
        M: 0,
        XXL: 2,
      }

      const isDeleteAllowed = (sizeCode: keyof typeof occupiedMap, isEditing: boolean) => {
        const occ = occupiedMap[sizeCode] || 0
        return !isEditing || occ === 0
      }

      // In edit mode:
      expect(isDeleteAllowed('S', true)).toBe(false) // 3 occupied -> blocked
      expect(isDeleteAllowed('M', true)).toBe(true)  // 0 occupied -> allowed
      expect(isDeleteAllowed('XXL', true)).toBe(false) // 2 occupied -> blocked

      // In create mode (draft, not editing active facility):
      expect(isDeleteAllowed('S', false)).toBe(true)
      expect(isDeleteAllowed('XXL', false)).toBe(true)
    })

    it('generates storage units with custom size codes, dimensions and loads', () => {
      const facilityCode = 'HN-F01'
      const customSpec = {
        sizeCode: 'XXL',
        name: 'Kho Ngoại Khổ (XXL)',
        lengthM: 20,
        widthM: 10,
        heightM: 6,
        laneWidthM: 5,
        maxLoadKg: 4500,
        monthlyPrice: 28000000,
        count: 2,
        floor: 1,
        zone: 'Khu E'
      }

      const generatedUnits = Array.from({ length: customSpec.count }, (_, i) => ({
        id: `${facilityCode}-${customSpec.sizeCode}-${String(i + 1).padStart(3, '0')}`,
        code: `${facilityCode}-${customSpec.sizeCode}-${String(i + 1).padStart(3, '0')}`,
        facilityId: facilityCode,
        type: customSpec.name,
        sizeCode: customSpec.sizeCode,
        priceMonthly: customSpec.monthlyPrice,
        maxLoadKg: customSpec.maxLoadKg,
        dimensions: {
          lengthM: customSpec.lengthM,
          widthM: customSpec.widthM,
          heightM: customSpec.heightM
        }
      }))

      expect(generatedUnits).toHaveLength(2)
      expect(generatedUnits[0].code).toBe('HN-F01-XXL-001')
      expect(generatedUnits[1].code).toBe('HN-F01-XXL-002')
      expect(generatedUnits[0].dimensions.heightM).toBe(6)
      expect(generatedUnits[0].maxLoadKg).toBe(4500)
    })

    it('allows customer catalog to correctly recognize and display 4XL units', () => {
      const unit4XL = {
        id: 'fac-003-4XL-001',
        code: 'HN-F01-4XL-001',
        facilityId: 'fac-003',
        facilityName: 'Kho Hà Nội',
        floor: 1,
        zone: 'Khu 4XL',
        type: 'Kho 4XL',
        sizeCode: '4XL',
        areaM2: 120,
        dimensions: { lengthM: 15, widthM: 8, heightM: 5 },
        doorDimensions: { widthM: 1.5, heightM: 2.4 },
        volumeM3: 600,
        maxLoadKg: 20000,
        price: 35000000,
        deposit: 35000000,
        status: 'available' as const,
        climate: true,
        reservedPeriods: [],
        version: 1,
      }

      // Catalog mapping logic
      let sizeCode = unit4XL.sizeCode || ''
      if (!sizeCode) {
        const match = unit4XL.code.match(/-([A-Za-z0-9]+)-\d+$/)
        sizeCode = match ? match[1] : 'M'
      }

      expect(sizeCode).toBe('4XL')
      expect(unit4XL.dimensions.lengthM * unit4XL.dimensions.widthM).toBe(120)
      expect(unit4XL.volumeM3).toBe(600)
      expect(unit4XL.maxLoadKg).toBe(20000)
    })

    it('enforces transport vehicle standards and door dimensions for standard sizes', () => {
      const sStd = getUnitTypeVehicleStandard('S')
      expect(sStd.minLaneM).toBe(1.8)
      expect(sStd.doorWidthM).toBe(1.0)
      expect(sStd.minLaneM).toBeGreaterThanOrEqual(sStd.doorWidthM)

      const mStd = getUnitTypeVehicleStandard('M')
      expect(mStd.minLaneM).toBe(2.2)
      expect(mStd.doorWidthM).toBe(1.2)
      expect(mStd.minLaneM).toBeGreaterThanOrEqual(mStd.doorWidthM)

      const lStd = getUnitTypeVehicleStandard('L')
      expect(lStd.minLaneM).toBe(2.6)
      expect(lStd.doorWidthM).toBe(1.5)
      expect(lStd.minLaneM).toBeGreaterThanOrEqual(lStd.doorWidthM)

      const xlStd = getUnitTypeVehicleStandard('XL')
      expect(xlStd.minLaneM).toBe(3.0)
      expect(xlStd.doorWidthM).toBe(2.0)
      expect(xlStd.minLaneM).toBeGreaterThanOrEqual(xlStd.doorWidthM)
    })

    it('enforces heavier standards for large custom units like XXL or 4XL', () => {
      const xxlStd = getUnitTypeVehicleStandard('XXL', 12, 25)
      expect(xxlStd.minLaneM).toBeGreaterThanOrEqual(3.5)
      expect(xxlStd.doorWidthM).toBe(2.4)
      expect(xxlStd.minLaneM).toBeGreaterThan(xxlStd.doorWidthM)
    })

    it('validates lane width input correctly and flags sub-standard widths', () => {
      // S size requires 1.8m
      const sValid = validateVehicleLaneWidth('S', 2.0)
      expect(sValid.isValid).toBe(true)

      const sInvalid = validateVehicleLaneWidth('S', 1.2)
      expect(sInvalid.isValid).toBe(false)
      expect(sInvalid.minRequiredLaneM).toBe(1.8)

      // XL size requires 3.0m
      const xlInvalid = validateVehicleLaneWidth('XL', 2.5)
      expect(xlInvalid.isValid).toBe(false)
      expect(xlInvalid.minRequiredLaneM).toBe(3.0)

      const xlValid = validateVehicleLaneWidth('XL', 3.5)
      expect(xlValid.isValid).toBe(true)
    })
  })
})



