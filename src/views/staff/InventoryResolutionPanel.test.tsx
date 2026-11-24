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
