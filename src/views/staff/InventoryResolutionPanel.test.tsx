import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import InventoryResolutionPanel from './InventoryResolutionPanel'
import type { CheckInCase } from '../../services/checkInApi'

function render(overrides: Partial<CheckInCase>) {
  return renderToStaticMarkup(<InventoryResolutionPanel item={{ checkInId: 'checkin', inventoryResolutionStatus: 'PENDING_CUSTOMER', ...overrides } as CheckInCase}
    busy={false} onRefresh={vi.fn()} onPartialRemoval={vi.fn()} onOpenReturns={vi.fn()} />)
}

it('records full intake onsite without suggesting another warehouse when changed goods fit', () => {
  const html = render({ inventoryFullFit: true, inventoryMismatchJson: '{}' })
  expect(html).toContain('ghi nhận phương án tiếp nhận')
  expect(html).not.toContain('Gợi ý chuyển sang kho phù hợp')
  expect(html).not.toContain('Xác nhận phần dư đã đưa ra')
})
it('offers the physical removal confirmation only after the customer accepts partial intake', () => {
  expect(render({ inventoryResolutionStatus: 'PARTIAL_ACCEPTED', inventoryFullFit: false })).toContain('Xác nhận phần dư đã đưa ra')
  expect(render({ inventoryFullFit: false })).not.toContain('Xác nhận phần dư đã đưa ra')
  expect(render({ inventoryResolutionStatus: 'PARTIAL_ACCEPTED', inventoryRemainderRemovedAt: '2026-11-24T00:00:00Z' })).not.toContain('Xác nhận phần dư đã đưa ra')
})

it('routes an actual return request to inspection and settlement', () => {
  const html = render({ inventoryResolutionStatus: 'RETURN_REQUESTED', inventoryFullFit: false })
  expect(html).toContain('Mở Trả kho &amp; nghiệm thu')
  expect(html).not.toContain('Xác nhận phần dư đã đưa ra')
})

it('offers acceptance and rejection of declared OTHER goods even when the goods fit', () => {
  const html = render({ inventoryFullFit: true, declaredGoodsLines: [{ id: 'other', category: 'OTHER' }] as CheckInCase['declaredGoodsLines'] })
  expect(html).toContain('Chấp nhận hàng hóa loại Khác')
  expect(html).toContain('Từ chối hàng hóa loại Khác')
  expect(html).toContain('tiền hoàn hoặc thu thêm')
  expect(render({ inventoryFullFit: true })).not.toContain('Từ chối hàng hóa loại Khác')
})

it('captures the signed paper record as uploaded photos instead of asking for a file code', () => {
  const html = render({ inventoryFullFit: true })
  expect(html).toContain('Ảnh biên bản có chữ ký khách')
  expect(html).toContain('type="file"')
  expect(html).toContain('multiple=""')
  expect(html).not.toContain('Mã ảnh biên bản')
  expect(html).not.toContain('Mã tệp ảnh biên bản')
})
