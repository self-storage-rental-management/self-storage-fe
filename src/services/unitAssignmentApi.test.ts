import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAuthTokens } from './apiClient'
import {
  changeUnitAssignment,
  createUnitAssignment,
  listAssignableUnits,
  listUnitAssignmentCandidates,
} from './unitAssignmentApi'

describe('unitAssignmentApi', () => {
  afterEach(() => {
    clearAuthTokens()
    vi.unstubAllGlobals()
  })

  it('loads confirmed reservations waiting for assignment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [],
      pagination: { page: 0, pageSize: 20, totalItems: 0, totalPages: 0, sort: 'confirmedAt: ASC' },
      correlationId: 'correlation-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listUnitAssignmentCandidates({ page: 0, q: 'RSV-001' })

    expect(result.data).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/manager/unit-assignments/candidates?page=0&pageSize=20&q=RSV-001',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('loads matching available units for the reservation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [],
      pagination: { page: 0, pageSize: 100, totalItems: 0, totalPages: 0, sort: 'code: ASC' },
      correlationId: 'correlation-2',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await listAssignableUnits('reservation-1')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/manager/unit-assignments/candidates/reservation-1/available-units?page=0&pageSize=100',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('creates an active assignment for the selected unit', async () => {
    const result = {
      assignmentId: 'assignment-1',
      assignmentStatus: 'ACTIVE',
      assignedAt: '2026-10-06T03:30:00Z',
      assignedBy: 'manager-1',
      reservationId: 'reservation-1',
      reservationCode: 'RSV-001',
      reservationStatus: 'UNIT_RESERVED',
      storageUnitId: 'unit-1',
      storageUnitCode: 'S001',
      storageUnitStatus: 'reserved',
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: result,
      correlationId: 'correlation-3',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await createUnitAssignment('reservation-1', 'unit-1')

    expect(response).toEqual(result)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/manager/unit-assignments/reservation-1',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ storageUnitId: 'unit-1' }) }),
    )
  })

  it('sends a reason when changing an assigned unit', async () => {
    const result = {
      assignmentId: 'assignment-2',
      assignmentStatus: 'ACTIVE',
      assignedAt: '2026-10-06T03:30:00Z',
      assignedBy: 'manager-1',
      reservationId: 'reservation-1',
      reservationCode: 'RSV-001',
      reservationStatus: 'UNIT_RESERVED',
      storageUnitId: 'unit-2',
      storageUnitCode: 'S002',
      storageUnitStatus: 'reserved',
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: result,
      correlationId: 'correlation-4',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await changeUnitAssignment('reservation-1', 'unit-2', 'Kho cũ cần bảo trì')

    expect(response).toEqual(result)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/manager/unit-assignments/reservation-1/change',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ storageUnitId: 'unit-2', reason: 'Kho cũ cần bảo trì', previousUnitNeedsMaintenance: false }),
      }),
    )
  })
})
