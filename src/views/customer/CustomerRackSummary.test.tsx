import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { sampleRackPallet, type RackResult } from '../../services/rackLayoutApi'
import CustomerRackSummary from './CustomerRackSummary'

const codes = ['R01', 'R02', 'R03', 'R04']
const result: RackResult = {
  configuration: {
    pallet: sampleRackPallet,
    clearances: { palletGapCm: 0, palletEndCm: 9, palletSideCm: 0, handlingCm: 15, maxPalletOverhangCm: 5, rackWallClearanceCm: 30 },
    racks: codes.map((code, index) => ({
      code, xCm: index * 400, yCm: 0, orientationDeg: 0, lengthCm: 400, widthCm: 200, heightCm: 450,
      uprightFrameCount: 3, uprightSizeCm: 8, levelCount: 3, beamHeightCm: 15, firstBeamBottomCm: 15,
      palletsPerCompartment: 1, maxLoadedPalletKg: 100, maxRackLoadKg: 1200, beamOuterSpanCm: 200, maxBeamPairLoadKg: 100,
    })),
  },
  racks: codes.map(code => ({
    code, bayCount: 2, levels: [30, 175, 320].map((supportTopCm, index) => ({ number: index + 1, supportTopCm, clearHeightCm: 130 })),
    compartmentCount: 6, palletSlotCount: 6, bayLengthCm: 188, bayWidthCm: 184, maxCargoHeightCm: 97,
    palletAlongRackCm: 170, palletAcrossRackCm: 210, smallBoxesPerPallet: 12, largeBoxesPerPallet: 4,
    smallBoxesPerRack: 72, largeBoxesPerRack: 24, effectiveRackLoadKg: 600, maxBeamPairLoadKg: 100,
  })),
  palletSlotCount: 24, smallBoxesPerUnit: 120, largeBoxesPerUnit: 40, unitCargoLimitKg: 600,
  minCargoHeightCm: 80, palletHeightCm: 18, palletEmptyKg: 40, palletMaxPayloadKg: 500,
  smallBox: { name: 'Thùng nhỏ', lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 5, maxLayers: 3 },
  largeBox: { name: 'Thùng lớn', lengthCm: 100, widthCm: 80, heightCm: 80, weightKg: 15, maxLayers: 1 },
}

it('hiển thị ba bảng sức chứa theo đúng cấu hình pallet mới', () => {
  const html = renderToStaticMarkup(<CustomerRackSummary result={result} />)

  for (const text of [
    '4 khung kệ', '24 khoang chứa hàng', '400 × 200 × 450 cm', '3 tầng', '2 khoang', '1 tấm',
    '188 × 184 × 130 cm', '210 × 170 × 18 cm', '210 × 170 × 97 cm', '60 kg', '360 kg', '600 kg',
    '40 × 30 × 30 cm', '100 × 80 × 80 cm', '12', '4', '120 thùng', '40 thùng',
  ]) expect(html).toContain(text)
})

it('tính tải hàng của khung bằng tải hiệu dụng trừ khối lượng tấm kê', () => {
  const html = renderToStaticMarkup(<CustomerRackSummary result={result} />)
  expect(html).toContain('Khối lượng hàng tối đa mỗi khung')
  expect(html).toContain('360 kg')
  expect(html).not.toContain('1.200 kg')
})

it('giữ thông báo riêng khi các khung có kích thước khác nhau', () => {
  const different = {
    ...result,
    racks: result.racks.map((rack, index) => index === 3 ? { ...rack, maxCargoHeightCm: 90 } : rack),
  }
  const html = renderToStaticMarkup(<CustomerRackSummary result={different} />)
  expect(html).toContain('Các khung không hoàn toàn giống nhau')
  expect(html).toContain('210 × 170 × 90 cm')
})
