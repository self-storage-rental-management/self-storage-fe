import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAuthTokens } from './apiClient'
import { listUnitReleaseCases, releaseAssignedUnit } from './unitReleaseApi'

describe('unitReleaseApi', () => {
  afterEach(() => {
    clearAuthTokens()
    vi.unstubAllGlobals()
  })

  it('loads releasable cancelled reservations from the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [],
      pagination: { page: 0, pageSize: 20, totalItems: 0, totalPages: 0, sort: 'reservation.cancelledAt: ASC' },
      correlationId: 'correlation-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listUnitReleaseCases({ page: 0, pageSize: 20, q: 'S001', blocked: false })

    expect(result.data).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/staff/cancelled-reservations/unit-releases?page=0&pageSize=20&blocked=false&q=S001',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('releases the exact assignment with an idempotency key', async () => {
    const result = {
      reservationId: 'reservation-1',
      reservationStatus: 'CANCELLED',
      assignmentId: 'assignment-1',
      assignmentStatus: 'CANCELLED',
      assignmentCancelledAt: '2026-10-02T03:30:00Z',
      storageUnitId: 'unit-1',
      storageUnitCode: 'S001',
      previousStorageUnitStatus: 'reserved',
      storageUnitStatus: 'maintenance',
      disposition: 'MAINTENANCE',
      processedBy: 'manager-1',
      processedAt: '2026-10-02T03:30:00Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: result,
      correlationId: 'correlation-2',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await releaseAssignedUnit(
      'reservation-1',
      { assignmentId: 'assignment-1', disposition: 'MAINTENANCE', reason: 'Cần vệ sinh' },
      'idempotency-1',
    )

    expect(response).toEqual(result)
    const [, options] = fetchMock.mock.calls[0]
    const headers = options.headers as Headers
    expect(headers.get('Idempotency-Key')).toBe('idempotency-1')
    expect(options).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ assignmentId: 'assignment-1', disposition: 'MAINTENANCE', reason: 'Cần vệ sinh' }),
    }))
  })
})
