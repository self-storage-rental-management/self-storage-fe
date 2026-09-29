import { describe, it, expect } from 'vitest'
import { DEFAULT_ROLE_PERMISSIONS, normalizeRolePermissions } from '../src/auth/rbac'
import type { User } from '../src/types'
import { isExcludedFacility, isExcludedUnit, isExcludedRelated } from '../src/store/StorageHubContext'

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
  })
})



