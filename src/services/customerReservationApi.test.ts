import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCustomerReservation,
  cancelCustomerReservation,
  getAvailability,
  listCustomerFacilities,
  listCustomerUnitTypes,
  resendReservationOtp,
  verifyReservationOtp,
  payReservationDeposit,
  getReservationPayment,
  generateBookingDocument,
  downloadBookingDocument,
  uploadReservationGoodsImage,
} from './customerReservationApi'
import { clearAuthTokens, setAccessToken } from './apiClient'

const jsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

describe('customerReservationApi', () => {
  afterEach(() => { clearAuthTokens(); vi.unstubAllGlobals() })

  it('reloads stored payment details from the backend for receipts', async () => {
    const result = { paymentId: 'payment-1', reservationId: 'reservation-1', paymentStatus: 'PAID', amount: 600000 }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: result }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getReservationPayment('reservation-1')).toEqual(result)
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/customer/reservations/reservation-1/payment')
  })

  it.each(['SUCCESS', 'FAILED', 'NOT_RECEIVED'])('keeps backend payment outcome %s authoritative', async outcome => {
    const result = { reservationId: 'reservation-1', outcome, reservationStatus: outcome === 'SUCCESS' ? 'CONFIRMED' : 'AWAITING_PAYMENT' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: result }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await payReservationDeposit('reservation-1', 'payment-key-1')).toEqual(result)
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/customer/reservations/reservation-1/simulated-payment')
    expect(request.method).toBe('POST')
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe('payment-key-1')
    expect(request.body).toBeUndefined()
  })

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

  it('uploads a goods image with the saved goods item ownership target', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'file-1' } }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['image-bytes'], 'hang-hoa.webp', { type: 'image/webp' })

    await expect(uploadReservationGoodsImage('goods-item-1', file)).resolves.toEqual({ id: 'file-1' })

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8080/api/files')
    expect(request.method).toBe('POST')
    expect(request.body).toBeInstanceOf(FormData)
    const body = request.body as FormData
    expect(body.get('entityType')).toBe('RESERVATION_GOODS_ITEM')
    expect(body.get('entityId')).toBe('goods-item-1')
    expect(body.get('file')).toBe(file)
  })

  it('cancels a reservation with the customer-provided reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { reservation: { id: 'reservation-1' } } }))
    vi.stubGlobal('fetch', fetchMock)

    await cancelCustomerReservation('reservation-1', 'Changed storage plan')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/customer/reservations/reservation-1/cancel',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Changed storage plan' }),
      }),
    )
  })

  it('resends and verifies reservation OTP through backend endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { reservationId: 'reservation-1', verified: false } }))
      .mockResolvedValueOnce(jsonResponse({ data: { reservationId: 'reservation-1', verified: true } }))
    vi.stubGlobal('fetch', fetchMock)

    await resendReservationOtp('reservation-1')
    await verifyReservationOtp('reservation-1', '123456')

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8080/api/customer/reservations/reservation-1/email-verification/resend',
    )
    expect(fetchMock.mock.calls[1]).toEqual([
      'http://localhost:8080/api/customer/reservations/reservation-1/email-verification',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: '123456' }) }),
    ])
  })

  it('generates and downloads the booking confirmation with customer authentication', async () => {
    const document = { id: 'document-1', reservationId: 'reservation-1', fileName: 'booking-confirmation.pdf' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: document }))
      .mockResolvedValueOnce(new Response(new Blob(['%PDF-1.4']), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="booking-confirmation.pdf"',
        },
      }))
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('customer-access-token')

    await expect(generateBookingDocument('reservation-1')).resolves.toEqual(document)
    const downloaded = await downloadBookingDocument('reservation-1')

    expect(downloaded.contentType).toBe('application/pdf')
    expect(downloaded.fileName).toBe('booking-confirmation.pdf')
    expect(await downloaded.blob.text()).toBe('%PDF-1.4')
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/customer/reservations/reservation-1/booking-document')
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST')
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8080/api/customer/reservations/reservation-1/booking-document/download')
    expect(new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers).get('Authorization')).toBe('Bearer customer-access-token')
  })
})
