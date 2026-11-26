import { describe, expect, it } from 'vitest'
import { mergeNotificationFeed } from './notificationFeed'

describe('notification bell timeline', () => {
  it('shows a new recovery notice before a long cached list of unit assignments', () => {
    const cached = Array.from({ length: 63 }, (_, index) => ({
      id: `cached-assignment-${index}`, title: 'Phân gian', date: '2026-11-26T06:00:00Z',
    }))
    const recovery = { id: 'api-recovery-13', title: 'Cần duyệt mở thu hồi', date: '2026-11-26T13:37:00Z' }
    const result = mergeNotificationFeed(cached, [recovery])
    expect(result[0]).toEqual(recovery)
    expect(result).toHaveLength(64)
    expect(result.filter(item => item.title === 'Phân gian')).toHaveLength(63)
  })

  it('uses the server version when a cached item has the same id', () => {
    const cached = { id: 'notice-1', title: 'Cũ', date: '2026-11-25T06:00:00Z', isRead: false }
    const server = { ...cached, title: 'Thu hồi kho cần xử lý', isRead: true }
    expect(mergeNotificationFeed([cached], [server], [cached])).toEqual([server])
  })

  it('orders additional notices by date and puts missing or invalid dates last', () => {
    const result = mergeNotificationFeed(
      [{ id: 'missing', date: undefined }, { id: 'invalid', date: 'invalid' }],
      [{ id: 'api', date: '2026-11-26T13:00:00Z' }],
      [{ id: 'newest', date: '2026-11-26T20:01:00+07:00' }],
    )
    expect(result.map(item => item.id)).toEqual(['newest', 'api', 'invalid', 'missing'])
  })
})
