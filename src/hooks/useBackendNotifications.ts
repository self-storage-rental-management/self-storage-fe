import { useCallback, useEffect, useState } from 'react'
import { listNotifications, type ApiNotification } from '../services/notificationApi'
import { userFacingError } from '../presentation/userFacingError'

export function useBackendNotifications(identity: string, enabled: boolean) {
  const [items, setItems] = useState<ApiNotification[]>([])
  const [pages, setPages] = useState(1)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  useEffect(() => { setItems([]); setPages(1) }, [identity])
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let sequence = 0
    const load = async () => {
      const request = ++sequence
      setLoading(true)
      try {
        const results = await Promise.all(Array.from({ length: pages }, (_, page) => listNotifications(page, 50)))
        if (disposed || request !== sequence) return
        setItems([...new Map(results.flatMap(result => result.data).map(item => [item.id, item])).values()])
        setHasMore(results[0].pagination.totalPages > pages)
        setError('')
      } catch (reason) {
        if (!disposed && request === sequence) setError(userFacingError(reason, 'Chưa cập nhật được thông báo. Vui lòng thử lại.'))
      } finally {
        if (!disposed && request === sequence) setLoading(false)
      }
    }
    const refresh = () => void load()
    refresh()
    const timer = window.setInterval(refresh, 10000)
    window.addEventListener('storagehub:notifications-refresh', refresh)
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('storagehub:notifications-refresh', refresh) }
  }, [identity, enabled, pages, retry])
  const loadMore = useCallback(() => setPages(value => value + 1), [])
  const refresh = useCallback(() => setRetry(value => value + 1), [])
  const reportFailure = useCallback((reason: unknown) => setError(userFacingError(reason, 'Chưa lưu được trạng thái thông báo. Vui lòng thử lại.')), [])
  return { items, setItems, error, loading, hasMore, loadMore, refresh, reportFailure }
}
