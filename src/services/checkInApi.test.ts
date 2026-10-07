import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAuthTokens } from './apiClient'
import { completeCheckIn, downloadCheckInEvidence, listCheckIns, markCheckInNoShow, rejectCheckIn, scheduleCheckIn, uploadCheckInEvidence } from './checkInApi'

const responseCase = {
  checkInId: 'checkin-1',
  checkInStatus: 'scheduled',
  reservationId: 'reservation-1',
}

function mockEnvelope(data: unknown) {
  return vi.fn().mockImplementation(() => Promise.resolve(
    new Response(JSON.stringify({ data, correlationId: 'c-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ))
}

describe('checkInApi', () => {
  afterEach(() => {
    clearAuthTokens()
    vi.unstubAllGlobals()
  })

  it('lists operational check-in cases', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [],
      pagination: { page: 0, pageSize: 20, totalItems: 0, totalPages: 0, sort: 'startDate: ASC' },
      correlationId: 'c-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await listCheckIns({ q: 'RSV-001' })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/staff/check-ins?page=0&pageSize=20&q=RSV-001',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('schedules a reservation for check-in', async () => {
    const fetchMock = mockEnvelope(responseCase)
    vi.stubGlobal('fetch', fetchMock)

    await scheduleCheckIn('reservation-1', {
      scheduledAt: '2026-10-07T03:00:00Z',
      contractVerified: true,
      paymentVerified: true,
      note: 'Đủ hồ sơ',
    })

    expect(fetchMock.mock.calls[0][0]).toContain('/reservations/reservation-1/schedule')
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'POST' }))
  })

  it('completes handover and supports no-show', async () => {
    const fetchMock = mockEnvelope({ ...responseCase, checkInStatus: 'completed' })
    vi.stubGlobal('fetch', fetchMock)
    const request = {
      checklist: {
        identityVerified: true,
        reservationMatched: true,
        contractVerified: true,
        paymentVerified: true,
        measurementVerified: true,
        unitWalkthrough: true,
        conditionRecorded: true,
        accessHandedOver: true,
      },
      actualMeasurements: {
        lengthCm: 100, widthCm: 100, heightCm: 100,
        weightKg: 100, actualVolumeM3: 1, varianceAccepted: true,
      },
      varianceReason: null,
      initialUnitCondition: 'Tốt',
      goodsCondition: 'Nguyên vẹn',
      packageCount: 2,
      goodsCategory: 'Đồ gia dụng',
      evidenceReferences: ['evidence.jpg'],
      handedOverItems: ['PIN', 'Biên nhận'],
      notes: '',
    }

    await completeCheckIn('checkin-1', request)
    await markCheckInNoShow('checkin-1', 'Khách không đến')

    expect(fetchMock.mock.calls[0][0]).toContain('/checkin-1/complete')
    expect(fetchMock.mock.calls[1][0]).toContain('/checkin-1/no-show')
  })

  it('rejects check-in with evidence and a safe unit disposition', async () => {
    const fetchMock = mockEnvelope({ ...responseCase, checkInStatus: 'rejected' })
    vi.stubGlobal('fetch', fetchMock)

    await rejectCheckIn('checkin-1', {
      reason: 'Hàng hóa không đúng khai báo',
      disposition: 'MAINTENANCE',
      evidenceReferences: ['asset-1'],
    })

    expect(fetchMock.mock.calls[0][0]).toContain('/checkin-1/reject')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      reason: 'Hàng hóa không đúng khai báo',
      disposition: 'MAINTENANCE',
      evidenceReferences: ['asset-1'],
    })
  })

  it('uploads handover evidence as multipart data linked to the check-in', async () => {
    const fetchMock = mockEnvelope({
      id: 'asset-1',
      originalName: 'handover.png',
      contentType: 'image/png',
      sizeBytes: 4,
      entityType: 'CHECK_IN',
      entityId: 'checkin-1',
      status: 'active',
    })
    vi.stubGlobal('fetch', fetchMock)

    await uploadCheckInEvidence('checkin-1', new File(['test'], 'handover.png', { type: 'image/png' }))

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toContain('/api/files')
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.headers as Headers).has('Content-Type')).toBe(false)
    expect((options.body as FormData).get('entityType')).toBe('CHECK_IN')
    expect((options.body as FormData).get('entityId')).toBe('checkin-1')
  })

  it('downloads check-in evidence through the authenticated file endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['evidence']), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="handover.png"',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await downloadCheckInEvidence('asset-1')

    expect(fetchMock.mock.calls[0][0]).toContain('/api/files/asset-1')
    expect(result.fileName).toBe('handover.png')
    expect(result.contentType).toBe('image/png')
  })
})
