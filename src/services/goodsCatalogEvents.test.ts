import { afterEach, expect, it, vi } from 'vitest'
import { consumeCatalogEvents, subscribeGoodsCatalog } from './goodsCatalogEvents'

vi.mock('./apiClient', () => ({ API_BASE_URL: 'http://example.test', getAccessToken: () => 'test-token', apiRequest: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

it('nhận thay đổi qua sự kiện và giữ phần dữ liệu chưa đầy đủ giữa các lần đọc', () => {
  const changed = vi.fn()
  let pending = consumeCatalogEvents('event: ready\r\ndata: {}\r\n\r\nevent: catalog-', changed)
  expect(changed).toHaveBeenCalledTimes(1)
  pending = consumeCatalogEvents(pending + 'changed\ndata: {}\n\nevent: heartbeat\ndata: {}\n\n', changed)
  expect(changed).toHaveBeenCalledTimes(2)
  expect(pending).toBe('')
})

it('chia sẻ một kết nối có xác thực và giải phóng khi không còn màn hình theo dõi', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller } })
  const fetchStream = vi.fn().mockResolvedValue(new Response(body))
  vi.stubGlobal('fetch', fetchStream)
  const first = vi.fn(), second = vi.fn()
  const stopFirst = subscribeGoodsCatalog(first)
  const stopSecond = subscribeGoodsCatalog(second)
  try {
    await vi.waitFor(() => expect(fetchStream).toHaveBeenCalledTimes(1))
    expect(fetchStream.mock.calls[0][0]).toBe('http://example.test/api/goods-catalog/events')
    expect(fetchStream.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
    stream.enqueue(new TextEncoder().encode('event: catalog-changed\ndata: {}\n\n'))
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(1))
    expect(second).toHaveBeenCalledTimes(1)
    stopFirst()
    expect(fetchStream.mock.calls[0][1].signal.aborted).toBe(false)
    stopSecond()
    expect(fetchStream.mock.calls[0][1].signal.aborted).toBe(true)
  } finally {
    stopFirst()
    stopSecond()
    stream.close()
  }
})
