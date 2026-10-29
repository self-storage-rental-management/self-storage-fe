import { API_BASE_URL, apiRequest, getAccessToken } from './apiClient'

type Listener = () => void
const listeners = new Set<Listener>()
let connection: AbortController | undefined

/** One authenticated SSE connection shared by catalog readers in this browser. */
export function subscribeGoodsCatalog(listener: Listener) {
  listeners.add(listener)
  if (!connection) {
    connection = new AbortController()
    void connect(connection.signal)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      connection?.abort()
      connection = undefined
    }
  }
}

export function consumeCatalogEvents(buffer: string, notify: Listener): string {
  const frames = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const remainder = frames.pop() || ''
  for (const frame of frames) {
    if (/^event: ?(?:ready|catalog-changed)$/m.test(frame)) notify()
  }
  return remainder
}

async function connect(signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const token = getAccessToken()
      const response = await fetch(`${API_BASE_URL}/api/goods-catalog/events`, {
        headers: token ? { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } : { Accept: 'text/event-stream' },
        signal,
      })
      if (response.status === 401) {
        await apiRequest('/api/customer/reservations/goods-catalog')
        throw new Error('Reconnect')
      }
      if (!response.ok || !response.body) throw new Error('Stream unavailable')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      try {
        while (!signal.aborted) {
          const chunk = await reader.read()
          if (chunk.done) break
          pending = consumeCatalogEvents(pending + decoder.decode(chunk.value, { stream: true }), () => {
            for (const current of listeners) current()
          })
        }
      } finally { reader.releaseLock() }
    } catch {
      // A ready event refreshes changes missed while disconnected.
    }
    if (signal.aborted) return
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
      const timer = setTimeout(finish, 1500)
      signal.addEventListener('abort', finish, { once: true })
    })
  }
}
