import { describe, expect, it } from 'vitest'
import { matchesReservationSearch, reservationPage } from './reservationList'

describe('reservation search and pagination', () => {
  it('matches Vietnamese text without accents and combines search terms', () => {
    expect(matchesReservationSearch('binh DUONG rsv-123', ['Kho Bình Dương', 'RSV-123'])).toBe(true)
    expect(matchesReservationSearch('dien tu', ['ĐIỆN TỬ'])).toBe(true)
    expect(matchesReservationSearch('RSV-999', ['RSV-123'])).toBe(false)
    expect(matchesReservationSearch('   ', [null, undefined])).toBe(true)
  })
  it('paginates matching records and clamps after filtering or deleting records', () => {
    expect(reservationPage(12, 2, 5)).toEqual({page: 2, pages: 3, start: 5, end: 10})
    expect(reservationPage(12, 3, 5)).toEqual({page: 3, pages: 3, start: 10, end: 12})
    expect(reservationPage(3, 3, 5)).toEqual({page: 1, pages: 1, start: 0, end: 3})
    expect(reservationPage(0, 2, 5)).toEqual({page: 1, pages: 1, start: 0, end: 0})
  })
})
