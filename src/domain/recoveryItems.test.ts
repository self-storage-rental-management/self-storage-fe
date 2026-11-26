import { describe, expect, it } from 'vitest'
import { groupRecoveryItems, groupQuantityLines, pendingRecoveryChoices, recoveryItemCounts, type RecoveryItem } from './recoveryItems'

const item = (index: number): RecoveryItem => ({ code: `BOX-${index}`, name: 'Thùng tài liệu', condition: 'Nguyên vẹn', location: 'Khu A', disposition: 'STORED', releasedAt: null })
describe('recovery goods quantities', () => {
  it('keeps one goods group for a hundred parcels and preserves partial delivery counts', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ ...item(index), releasedAt: index < 30 ? '2026-11-26T15:00:00Z' : null }))
    const groups = groupRecoveryItems(items)
    expect(groups).toHaveLength(1)
    expect(recoveryItemCounts(groups[0].items)).toEqual({ total: 100, stored: 70, released: 30, liquidated: 0 })
    expect(pendingRecoveryChoices(items)[0].items).toHaveLength(70)
    expect(pendingRecoveryChoices(items)[0].items.every(value => !value.releasedAt)).toBe(true)
  })
  it('separates conditions and locations within a goods type when choosing what to hand over', () => {
    const items = [item(1), { ...item(2), name: '  THÙNG  TÀI LIỆU ', condition: 'Hư hỏng' }, { ...item(3), location: 'Khu B' }, { ...item(4), name: 'Ghế' }]
    expect(groupRecoveryItems(items)).toHaveLength(2)
    expect(groupRecoveryItems(items)[0].variants).toHaveLength(3)
    expect(pendingRecoveryChoices(items)).toHaveLength(4)
  })
  it('sums quantities already declared by goods type without mutating the source', () => {
    const source = [{ name: 'Tài liệu', quantity: 40 }, { name: 'Tài liệu', quantity: 60 }, { name: 'Ghế', quantity: 0 }]
    expect(groupQuantityLines(source, line => line.name)).toEqual([{ name: 'Tài liệu', quantity: 100 }, { name: 'Ghế', quantity: 0 }])
    expect(source[0].quantity).toBe(40)
  })
})
