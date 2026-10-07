import { afterEach, describe, expect, it, vi } from 'vitest'
import { decideStaffReservationReview, listStaffReservationReviews } from './staffReservationApi'

describe('staff goods review API', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('loads the backend queue without inventing a facility scope', async () => {
    const result = { data: [{ reservationId: 'r1', goodsReviewStatus: 'PENDING' }], pagination: { totalPages: 1 } }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await listStaffReservationReviews()).toEqual(result)
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/staff/reservation-reviews?page=0&size=20')
  })
  it.each(['APPROVE', 'REJECT'] as const)('sends %s to the backend decision endpoint', async decision => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { reservationId: 'r1' } }), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await decideStaffReservationReview('r1', decision, ' Reviewed goods ')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/staff/reservation-reviews/r1/decision', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ decision, note: 'Reviewed goods' }),
    }))
  })
  it('does not send rejection without a reason', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(decideStaffReservationReview('r1', 'REJECT', ' ')).rejects.toThrow('lý do')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
