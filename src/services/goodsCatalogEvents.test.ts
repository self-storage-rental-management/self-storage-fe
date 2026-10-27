import { expect, it, vi } from 'vitest'
import { consumeCatalogEvents } from './goodsCatalogEvents'

it('nhận thay đổi qua sự kiện và giữ phần dữ liệu chưa đầy đủ giữa các lần đọc', () => {
  const changed = vi.fn()
  let pending = consumeCatalogEvents('event: ready\r\ndata: {}\r\n\r\nevent: catalog-', changed)
  expect(changed).toHaveBeenCalledTimes(1)
  pending = consumeCatalogEvents(pending + 'changed\ndata: {}\n\nevent: heartbeat\ndata: {}\n\n', changed)
  expect(changed).toHaveBeenCalledTimes(2)
  expect(pending).toBe('')
})
