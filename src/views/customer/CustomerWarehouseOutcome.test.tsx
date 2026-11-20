import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { CompatibilityCheckResult, CustomerUnitType, PalletPlan } from '../../services/customerReservationApi'
import { CustomerNoCompatibleWarehouse, CustomerNoVacantWarehouse } from './CustomerWarehouseOutcome'

const plan: PalletPlan = {
  palletLengthCm: 210, palletWidthCm: 170, palletHeightCm: 18, emptyPalletKg: 40,
  requiredPallets: 1, availableSlots: 24, totalLoadedWeightKg: 52,
  items: [], racks: [],
}

const baseCheck: CompatibilityCheckResult = {
  facilityId: 'facility', unitTypeId: 'small', startDate: '2026-11-20', endDate: '2027-02-20',
  result: 'INCOMPATIBLE', totalGoodsVolumeM3: 0.02, totalGoodsWeightKg: 12,
  unitVolumeM3: 696, unitMaxLoadKg: 600, requiredRackCount: 0, unitRackCount: 4,
  availableUnitCount: 3, staffReviewRequired: false, issues: [],
  maxCargoLengthCm: 120, maxCargoWidthCm: 80, maxCargoHeightCm: 100,
  maxCargoWeightKg: 600, physicalFitStatus: 'INCOMPATIBLE', availabilityStatus: 'NOT_EVALUATED',
}

const type = (id: string, name: string): CustomerUnitType => ({
  id, facilityId: 'facility', code: id, name, status: 'active',
  lengthM: 10, widthM: 10, heightM: 5, areaM2: 100, volumeM3: 500,
  monthlyPrice: 1, securityDepositAmount: 1, imageUrl: null, maxLoadKg: 1200,
  rackCount: 6, rackLengthM: 4, rackWidthM: 2, rackHeightM: 4.5,
  availableCount: 0, createdAt: '', updatedAt: '',
})

it('uses the largest evaluated limits on the no-compatible screen', () => {
  const html = renderToStaticMarkup(<CustomerNoCompatibleWarehouse
    check={baseCheck}
    goodsItems={[{ category: 'FURNITURE', quantity: 1, lengthCm: 12, widthCm: 12, heightCm: 123, weightPerItemKg: 12, fragile: false }]}
    maxSupportedStorageLimits={{ maxCargoLengthCm: 210, maxCargoWidthCm: 170, maxCargoHeightCm: 97, maxCargoWeightKg: 3600 }}
    onEditGoods={() => {}}
    onSupport={() => {}}
  />)

  expect(html).toContain('Giới hạn lớn nhất')
  expect(html).toContain('210 cm')
  expect(html).toContain('170 cm')
  expect(html).toContain('97 cm')
  expect(html).toContain('vượt quá giới hạn lưu trữ lớn nhất 26 cm')
  expect(html).toContain('26 cm')
})

it('shows suitable but sold-out types when the selected type is incompatible', () => {
  const current = { ...baseCheck, palletPlan: null }
  const soldOut = {
    ...baseCheck, unitTypeId: 'medium', result: 'COMPATIBLE' as const,
    physicalFitStatus: 'FIT', availabilityStatus: 'NO_VACANT_WAREHOUSE', palletPlan: plan,
    unitMaxLoadKg: 1200, availableUnitCount: 0,
  }
  const html = renderToStaticMarkup(<CustomerNoVacantWarehouse
    currentName="Kho nhỏ (S)"
    currentUnitTypeId="small"
    facilityId="facility"
    unitTypes={[type('small', 'Kho nhỏ'), type('medium', 'Kho vừa')]}
    checksByUnitType={{ small: current, medium: soldOut }}
    onChangeRental={() => {}}
    onSupport={() => {}}
    labelForType={value => value}
  />)

  expect(html).toContain('Hàng hóa không vừa Kho nhỏ (S)')
  expect(html).toContain('Kho vừa')
  expect(html).toContain('Hết kho')
})
