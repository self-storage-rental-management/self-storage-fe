import { describe, expect, it } from 'vitest'
import { type RackConfiguration, type RackInput } from '../../services/rackLayoutApi'
import { validateRackStep } from './ManagerRackLayoutModal'

const rack: RackInput = {
  code: 'R01', lengthCm: 400, widthCm: 200, heightCm: 450, xCm: 30, yCm: 30, orientationDeg: 0,
  uprightFrameCount: 3, uprightSizeCm: 8, levelCount: 3, beamHeightCm: 15, firstBeamBottomCm: 15,
  palletsPerCompartment: 1, maxRackLoadKg: 1200, maxBeamPairLoadKg: 100,
}

const configuration: RackConfiguration = {
  clearances: { palletGapCm: 10, palletEndCm: 9, palletSideCm: 10, handlingCm: 15 },
  racks: [rack], autoGeneratePallet: true, requestedRackCount: 10, layoutMode: 'AUTO_BALANCED_TWO_ROWS',
}

describe('Manager rack layout steps', () => {
  it('chỉ yêu cầu một mẫu khung và chấp nhận số tấm kê hợp lệ', () => {
    expect(validateRackStep(configuration, 0)).toBeUndefined()
    expect(validateRackStep(configuration, 1)).toBeUndefined()
  })

  it('không yêu cầu Manager nhập rating legacy của tấm kê', () => {
    expect(validateRackStep({ ...configuration, racks: [{ ...rack, maxLoadedPalletKg: undefined }] }, 0)).toBeUndefined()
  })

  it('để Backend quyết định số tầng tối đa theo chiều cao', () => {
    expect(validateRackStep({ ...configuration, racks: [{ ...rack, levelCount: 4 }] }, 0)).toBeUndefined()
  })

  it('kiểm tra số khung mỗi gian là số nguyên dương', () => {
    expect(validateRackStep({ ...configuration, requestedRackCount: 0 }, 0)?.message).toContain('Số khung mỗi gian')
    expect(validateRackStep({ ...configuration, requestedRackCount: 2.5 }, 0)?.message).toContain('Số khung mỗi gian')
  })

  it('không tự kiểm tra giới hạn hình học tấm kê ở Frontend', () => {
    expect(validateRackStep({ ...configuration, racks: [{ ...rack, palletsPerCompartment: 3 }] }, 1)).toBeUndefined()
  })

  it('bắt buộc có các giới hạn tải mới', () => {
    expect(validateRackStep({ ...configuration, racks: [{ ...rack, maxBeamPairLoadKg: undefined }] }, 0)?.message)
      .toContain('Giới hạn tải của khoang')
  })
})
