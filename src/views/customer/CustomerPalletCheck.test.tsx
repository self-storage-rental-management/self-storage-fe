import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { CompatibilityCheckResult } from '../../services/customerReservationApi'
import CustomerPalletCheck from './CustomerPalletCheck'

const check: CompatibilityCheckResult = {
  facilityId: 'facility', unitTypeId: 'unit-type', startDate: '2026-11-17', endDate: '2027-02-17',
  result: 'COMPATIBLE', totalGoodsVolumeM3: 0.54, totalGoodsWeightKg: 75, unitVolumeM3: 400, unitMaxLoadKg: 600,
  rackUtilizationRate: 0, usableVolumePerRackM3: 0, requiredRackCount: 1, unitRackCount: 1, availableUnitCount: 1,
  staffReviewRequired: false, issues: [],
  palletPlan: {
    palletLengthCm: 120, palletWidthCm: 80, palletHeightCm: 14.4, emptyPalletKg: 25, palletMaxPayloadKg: 500,
    requiredPallets: 1, availableSlots: 12, totalLoadedWeightKg: 100,
    items: [{ itemNumber: 1, quantity: 15, requiredPallets: 1, maxPiecesOnOnePallet: 15, allowedStackLayers: 3 }],
    racks: [{
      code: 'R01', usedSlots: 1, totalSlots: 12, loadedWeightKg: 100, maxLoadKg: 1200, slotMaxLoadKg: 100,
      compartments: 6, bayLengthCm: 188, bayWidthCm: 184, maxCargoHeightCm: 100.6,
      levels: [{ number: 1, supportTopCm: 30, clearHeightCm: 130 }],
    }],
  },
}

it('explains the actual plan returned by the backend', () => {
  const html = renderToStaticMarkup(<CustomerPalletCheck check={check} />)
  for (const text of ['Hàng của bạn vừa kho!', '1 / 6', 'Tại sao cần 1 khoang?', '15 kiện hàng', '75 / 600 kg']) {
    expect(html).toContain(text)
  }
  expect(html).not.toContain('80%')
})
it('does not count a shared pallet twice when two goods lines use one compartment', () => {
  const capacity = {
    maxLoadedKg: 100, cargoWeightLimitKg: 60, piecesPerLayer: 4, usableLayers: 1,
    maxPiecesByDimensions: 4, maxPiecesByWeight: 12, maxPieces: 4,
    placementLengthCm: 100, placementWidthCm: 80, placementHeightCm: 40,
  }
  const html = renderToStaticMarkup(<CustomerPalletCheck goodsItems={[
    { category: 'FURNITURE', lengthCm: 100, widthCm: 80, heightCm: 40, quantity: 1, weightPerItemKg: 5, fragile: false },
    { category: 'DECOR', lengthCm: 100, widthCm: 80, heightCm: 40, quantity: 1, weightPerItemKg: 5, fragile: false },
  ]} check={{
    ...check, totalGoodsWeightKg: 10, palletPlan: {
      ...check.palletPlan!, requiredPallets: 1, totalLoadedWeightKg: 50,
      items: [
        { itemNumber: 1, quantity: 1, requiredPallets: 1, maxPiecesOnOnePallet: 1, allowedStackLayers: 1,
          weightPerItemKg: 5, allocations: [{ rackCode: 'R01', compartmentNumber: 1, palletCount: 1, piecesPerPallet: 1, loadedWeightKg: 50, capacity }] },
        { itemNumber: 2, quantity: 1, requiredPallets: 1, maxPiecesOnOnePallet: 1, allowedStackLayers: 1,
          weightPerItemKg: 5, allocations: [{ rackCode: 'R01', compartmentNumber: 1, palletCount: 1, piecesPerPallet: 1, loadedWeightKg: 50, capacity }] },
      ],
      pallets: [{ palletNumber: 1, rackCode: 'R01', compartmentNumber: 1, compartmentCargoLimitKg: 60,
        cargoWeightKg: 10, loadedWeightKg: 50,
        items: [{ itemNumber: 1, quantity: 1, layers: 1, cargoWeightKg: 5 }, { itemNumber: 2, quantity: 1, layers: 1, cargoWeightKg: 5 }],
        placements: [
          { itemNumber: 1, boxNumber: 1, layer: 1, xCm: 0, yCm: 0, zCm: 0, lengthCm: 100, widthCm: 80, heightCm: 40 },
          { itemNumber: 2, boxNumber: 1, layer: 1, xCm: 100, yCm: 0, zCm: 0, lengthCm: 100, widthCm: 80, heightCm: 40 },
        ] }],
    },
  }} />)
  expect(html).toContain('1 / 6')
  expect(html).toContain('1 tấm kê')
  expect(html).toContain('Hàng 1, 2')
  expect(html).not.toContain('2 tấm kê')
})

it('explains the weight limit and displays the actual split of nine items', () => {
  const capacity = {
    maxLoadedKg: 100, cargoWeightLimitKg: 75, piecesPerLayer: 60, usableLayers: 1,
    maxPiecesByDimensions: 60, maxPiecesByWeight: 6, maxPieces: 6,
  }
  const html = renderToStaticMarkup(<CustomerPalletCheck unitTypeName="Kho nhỏ" goodsItems={[{
    category: 'FURNITURE', lengthCm: 12, widthCm: 12, heightCm: 12, quantity: 9, weightPerItemKg: 12, fragile: true,
  }]} check={{
    ...check, totalGoodsWeightKg: 108, palletPlan: {
      ...check.palletPlan!, requiredPallets: 2, totalLoadedWeightKg: 158,
      items: [{
        itemNumber: 1, quantity: 9, requiredPallets: 2, maxPiecesOnOnePallet: 6, allowedStackLayers: 1,
        weightPerItemKg: 12,
        allocations: [
          { rackCode: 'R01', palletCount: 1, piecesPerPallet: 6, loadedWeightKg: 97, capacity },
          { rackCode: 'R01', palletCount: 1, piecesPerPallet: 3, loadedWeightKg: 61, capacity },
        ],
      }],
    },
  }} />)
  for (const expected of ['Kho nhỏ', '108 / 600 kg', '60 kiện', '6 kiện',
    'Kích thước tấm kê (D × R × C)', '120 × 80 × 14,4 cm', 'Khối lượng tấm kê rỗng',
    '25 kg/tấm kê',
    'Khung 1 · Khoang 1', '2 tấm kê', '108/75 kg', '108 kg']) {
    expect(html).toContain(expected)
  }
})

it('does not render a second condition table for a partial final pallet', () => {
  const firstCapacity = {
    maxLoadedKg: 100, cargoWeightLimitKg: 75, piecesPerLayer: 5, usableLayers: 1,
    maxPiecesByDimensions: 5, maxPiecesByWeight: 5, maxPieces: 5,
    placementLengthCm: 12, placementWidthCm: 12, placementHeightCm: 1,
  }
  const partialCapacity = { ...firstCapacity, piecesPerLayer: 2 }
  const html = renderToStaticMarkup(<CustomerPalletCheck goodsItems={[{
    category: 'FURNITURE', lengthCm: 12, widthCm: 12, heightCm: 1, quantity: 7, weightPerItemKg: 12,
    fragile: false, stackable: true,
  }]} check={{
    ...check, totalGoodsWeightKg: 84, palletPlan: {
      ...check.palletPlan!, requiredPallets: 2, totalLoadedWeightKg: 124,
      racks: check.palletPlan!.racks.map(rack => ({ ...rack, maxCargoHeightCm: 97 })),
      items: [{
        itemNumber: 1, quantity: 7, requiredPallets: 2, maxPiecesOnOnePallet: 5, allowedStackLayers: 97,
        weightPerItemKg: 12,
        allocations: [
          { rackCode: 'R01', compartmentNumber: 1, palletCount: 1, piecesPerPallet: 5, loadedWeightKg: 100, capacity: firstCapacity },
          { rackCode: 'R01', compartmentNumber: 2, palletCount: 1, piecesPerPallet: 2, loadedWeightKg: 64, capacity: partialCapacity },
        ],
      }],
    },
  }} />)
  expect(html.match(/<th[^>]*>Điều kiện lưu trữ/gu)).toHaveLength(1)
  expect(html).toContain('Số kiện có thể xếp theo số lớp và tải trọng')
  expect(html).toContain('5 kiện/tấm kê')
  expect(html).not.toContain('Khả năng chịu tải của tấm kê')
  expect(html).toContain('Số lớp cần dùng theo phương án')
  expect(html).toContain('Tải tổng tối đa tại vị trí xếp (tấm kê + hàng)')
  expect(html).toContain('Giới hạn hàng sau khi trừ tấm kê')
  expect(html).not.toContain('Số kiện tối đa theo kích thước')
  expect(html).not.toContain('Số kiện tối đa theo khối lượng')
  expect(html).not.toContain('Số kiện tối đa mỗi tấm kê')
  expect(html).not.toContain('Quy tắc xếp chồng')
  expect(html).not.toContain('Số lớp tối đa có thể xếp')
  expect(html).not.toContain('Phương án lưu trữ:')
  expect(html).not.toContain('Giới hạn quyết định trong trường hợp này là')
})

it('renders every layer returned by the three-dimensional packing plan', () => {
  const capacity = {
    maxLoadedKg: 100, cargoWeightLimitKg: 75, piecesPerLayer: 2, usableLayers: 2,
    maxPiecesByDimensions: 4, maxPiecesByWeight: 15, maxPieces: 4,
    placementLengthCm: 100, placementWidthCm: 80, placementHeightCm: 40,
  }
  const html = renderToStaticMarkup(<CustomerPalletCheck goodsItems={[{
    category: 'FURNITURE', lengthCm: 100, widthCm: 80, heightCm: 40, quantity: 3, weightPerItemKg: 5,
    fragile: false, stackable: true,
  }]} check={{
    ...check, totalGoodsWeightKg: 15, palletPlan: {
      ...check.palletPlan!, requiredPallets: 1, totalLoadedWeightKg: 55,
      items: [{
        itemNumber: 1, quantity: 3, requiredPallets: 1, maxPiecesOnOnePallet: 3, allowedStackLayers: 2,
        weightPerItemKg: 5,
        allocations: [{ rackCode: 'R01', compartmentNumber: 1, palletCount: 1, piecesPerPallet: 3, loadedWeightKg: 55, capacity }],
      }],
      pallets: [{
        palletNumber: 1, rackCode: 'R01', compartmentNumber: 1, compartmentCargoLimitKg: 75,
        cargoWeightKg: 15, loadedWeightKg: 55,
        items: [{ itemNumber: 1, quantity: 3, layers: 2, cargoWeightKg: 15 }],
        placements: [
          { itemNumber: 1, boxNumber: 1, layer: 1, xCm: 0, yCm: 0, zCm: 0, lengthCm: 100, widthCm: 80, heightCm: 40 },
          { itemNumber: 1, boxNumber: 2, layer: 1, xCm: 100, yCm: 0, zCm: 0, lengthCm: 100, widthCm: 80, heightCm: 40 },
          { itemNumber: 1, boxNumber: 3, layer: 2, xCm: 0, yCm: 0, zCm: 40, lengthCm: 100, widthCm: 80, heightCm: 40 },
        ],
      }],
    },
  }} />)
  expect(html).toContain('Lớp 2')
  expect(html).toContain('1 kiện')
})

it('giải thích khi kiện được xoay và đặt nằm ngang để vừa kho', () => {
  const capacity = {
    maxLoadedKg: 100, cargoWeightLimitKg: 75, piecesPerLayer: 17, usableLayers: 1,
    maxPiecesByDimensions: 17, maxPiecesByWeight: 6, maxPieces: 6,
    placementLengthCm: 12, placementWidthCm: 123, placementHeightCm: 12,
  }
  const html = renderToStaticMarkup(<CustomerPalletCheck unitTypeName="Kho nhỏ" goodsItems={[{
    category: 'FURNITURE', lengthCm: 12, widthCm: 12, heightCm: 123, quantity: 1, weightPerItemKg: 12,
    fragile: false, allowHorizontalPlacement: true,
  }]} check={{
    ...check, totalGoodsWeightKg: 12, palletPlan: {
      ...check.palletPlan!, requiredPallets: 1, totalLoadedWeightKg: 52,
      items: [{
        itemNumber: 1, quantity: 1, requiredPallets: 1, maxPiecesOnOnePallet: 6, allowedStackLayers: 1,
        weightPerItemKg: 12,
        allocations: [{ rackCode: 'R01', compartmentNumber: 1, palletCount: 1, piecesPerPallet: 1, loadedWeightKg: 52, capacity }],
      }],
    },
  }} />)
  expect(html).toContain('Kích thước sau khi đặt')
  expect(html).toContain('12 × 123 × 12 cm')
  expect(html).not.toContain('Phương án lưu trữ:')
})

it('chỉ hiển thị lý do đơn vượt giới hạn khối lượng của gian', () => {
  const issue = 'Đơn nặng 605 kg, vượt 5 kg so với giới hạn 600 kg hàng của gian.'
  const html = renderToStaticMarkup(<CustomerPalletCheck check={{
    ...check, result: 'INCOMPATIBLE', palletPlan: null, totalGoodsWeightKg: 605,
    issues: [issue],
  }} goodsItems={[{ category: 'FURNITURE', lengthCm: 12, widthCm: 12, heightCm: 12, quantity: 121, weightPerItemKg: 5, fragile: false }]} />)
  expect(html).toContain(issue)
  expect(html).not.toMatch(/121 × 5|Hàng xếp vừa/u)
})

it('chỉ hiện nguyên nhân kiện rộng 133 cm và lý do đổi loại kho cũng không giải quyết được', () => {
  const issue = 'Hàng 1 không vừa mặt pallet. Kiện có chiều rộng 133 cm, vượt 13 cm so với cạnh dài nhất là 120 cm.'
  const html = renderToStaticMarkup(<CustomerPalletCheck check={{
    ...check, result: 'INCOMPATIBLE', palletPlan: null, totalGoodsWeightKg: 144, issues: [issue],
  }} noAlternativeReason="Chưa có loại kho nào tại cơ sở này vừa toàn bộ hàng và còn gian trống trong kỳ thuê đã chọn." />)
  expect(html).toContain('Hàng 1 không vừa mặt tấm kê. Kiện có chiều rộng 133 cm, vượt 13 cm so với cạnh dài nhất là 120 cm. Chưa có loại kho nào tại cơ sở này vừa toàn bộ hàng và còn gian trống trong kỳ thuê đã chọn.')
  expect(html.match(/chiều rộng 133 cm/gu)).toHaveLength(1)
  expect(html).not.toMatch(/144 kg|600 kg|chiều cao|vượt tải|pallet|;/iu)
})

it('explains when the selected type has no layout to calculate', () => {
  const html = renderToStaticMarkup(<CustomerPalletCheck check={{
    ...check, result: 'INCOMPATIBLE', palletPlan: null, palletLayoutMissing: true, totalGoodsWeightKg: 605,
  }} />)
  expect(html).toContain('Loại kho chưa có thông tin kệ')
  expect(html).not.toMatch(/Chưa có gian phù hợp|vượt 5 kg|605 kg/u)
})
