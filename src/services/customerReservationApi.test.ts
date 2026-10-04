import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCustomerReservation,
  getAvailability,
  listCustomerFacilities,
  listCustomerUnitTypes,
} from './customerReservationApi'

const jsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

describe('customerReservationApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads only active facilities from the backend catalog', async () => {
    const payload = { data: [], pagination: { page: 0, size: 50, totalElements: 0, totalPages: 0 } }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    await listCustomerFacilities()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/facilities?status=active&page=0&size=50',
      expect.any(Object),
    )
  })

  it('passes the selected dates when loading unit types', async () => {
    const payload = { data: [], pagination: { page: 0, size: 50, totalElements: 0, totalPages: 0 } }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    await listCustomerUnitTypes('facility-1', {
      startDate: '2026-11-01',
      endDate: '2027-02-01',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/facilities/facility-1/unit-types?status=active&startDate=2026-11-01&endDate=2027-02-01&page=0&size=50',
      expect.any(Object),
    )
  })

  it('uses the backend availability result without calculating capacity locally', async () => {
    const availability = {
      facilityId: 'facility-1', unitTypeId: 'type-1',
      startDate: '2026-11-01', endDate: '2027-02-01', availableCount: 3, available: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: availability }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getAvailability({
      facilityId: 'facility-1', unitTypeId: 'type-1',
      startDate: '2026-11-01', endDate: '2027-02-01',
    })).resolves.toEqual(availability)
  })

  it('sends an idempotency key when creating a reservation', async () => {
    const reservation = { id: 'reservation-1', reservationCode: 'RSV-1' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: reservation }))
    vi.stubGlobal('fetch', fetchMock)
    const input = {
      quoteId: 'quote-1',
      goodsCondition: 'Packed',
      notes: 'FE integration',
      goodsItems: [{
        category: 'FURNITURE' as const,
        quantity: 1,
        lengthCm: 100,
        widthCm: 60,
        heightCm: 15,
        weightPerItemKg: 18,
        fragile: false,
      }],
    }

    await createCustomerReservation(input, 'reservation-fe-test-001')

    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe('reservation-fe-test-001')
    expect(request.body).toBe(JSON.stringify(input))
  })
})
