import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAuthTokens } from './apiClient'
import { checkInEvidenceAssetIds, completeCheckIn, completeCheckInSetup, confirmCheckInPayment, downloadCheckInEvidence, listCheckIns, listStaffAccessCredentials, recordCheckInArrival, recordInventoryArrival, rejectCheckIn, reissueAccessCredential, scheduleCheckIn, signCheckInContract, startCheckInSetup, uploadCheckInEvidence, verifyCheckInIdentity, verifyInventoryIdentity } from './checkInApi'

const responseCase = {
  checkInId: 'checkin-1',
  checkInStatus: 'scheduled',
  reservationId: 'reservation-1',
  reservationStatus: 'READY_FOR_CHECKIN',
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

  it('keeps only unique file asset IDs from legacy evidence references', () => {
    const id = '0d29e3dd-67a8-4c8c-bccd-d54e374f50b0'
    expect(checkInEvidenceAssetIds([id, 'image_0.jpg', 'uploads/check-in/photo.jpg', id])).toEqual([id])
  })

  it('lists operational check-in cases', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [],
      pagination: { page: 0, pageSize: 20, totalItems: 0, totalPages: 0, sort: 'startDate: ASC' },
      correlationId: 'c-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await listCheckIns({
      group: 'ONGOING',
      q: 'RSV-001',
      status: 'scheduled',
      scheduledFrom: '2026-10-08T17:00:00.000Z',
      scheduledTo: '2026-10-09T17:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/staff/check-ins?page=0&pageSize=20&q=RSV-001&group=ONGOING&status=scheduled&scheduledFrom=2026-10-08T17%3A00%3A00.000Z&scheduledTo=2026-10-09T17%3A00%3A00.000Z',
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

  it('records the inventory visit separately and uploads a restricted identity photo', async () => {
    const photo = new File(['sample'], 'arrival.png', { type: 'image/png' })
    const inventoryVisit = { appointmentAt: '2026-11-02T09:30:00Z', arrivedAt: '2026-11-02T09:05:00Z',
      identityVerifiedAt: null, verifiedByName: null, photoId: null }
    const fetchMock = mockEnvelope({ ...responseCase, checkInStatus: 'setup_completed', inventoryVisit })
    fetchMock.mockImplementationOnce(() => mockEnvelope({ ...responseCase, checkInStatus: 'setup_completed', inventoryVisit })())
      .mockImplementationOnce(() => mockEnvelope({ id: 'photo-1', entityType: 'CHECK_IN_IDENTITY' })())
    vi.stubGlobal('fetch', fetchMock)

    expect((await recordInventoryArrival('checkin-1')).inventoryVisit?.arrivedAt).toBe(inventoryVisit.arrivedAt)
    const asset = await uploadCheckInEvidence('checkin-1', photo, 'CHECK_IN_IDENTITY')
    await verifyInventoryIdentity('checkin-1', { identityDocumentNumber: 'P1234567', photoId: asset.id, bookingCustomerPresent: true })

    expect(fetchMock.mock.calls[0][0]).toContain('/checkin-1/inventory-arrival')
    const form = fetchMock.mock.calls[1][1].body as FormData
    expect(form.get('entityType')).toBe('CHECK_IN_IDENTITY')
    expect(form.get('entityId')).toBe('checkin-1')
    expect(fetchMock.mock.calls[2][0]).toContain('/checkin-1/inventory-identity')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      identityDocumentNumber: 'P1234567', photoId: 'photo-1', bookingCustomerPresent: true,
    })
  })

  it('records arrival and completes handover', async () => {
    const inventoryLines = [
      { goodsItemId: 'goods-1', actualQuantity: 2, condition: 'INTACT' as const, note: null,
        actualCategoryId: 'category-1', actualMaterialId: 'material-1',
        measurements: { lengthCm: 100, widthCm: 100, heightCm: 50, weightKg: 100 } },
      { goodsItemId: 'goods-2', actualQuantity: 0, condition: 'NOT_PRESENT' as const,
        note: 'Khách chưa đưa hàng vào kho', measurements: null },
    ]
    const fetchMock = mockEnvelope({ ...responseCase, checkInStatus: 'completed', handover: { inventoryLines } })
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
      identityDocumentNumber: '079203009988',
      identityVerificationNote: null,
      actualMeasurements: {
        lengthCm: 50, widthCm: 100, heightCm: 100,
        weightKg: 100, actualVolumeM3: 1, varianceAccepted: true,
      },
      varianceReason: null,
      initialUnitCondition: 'Tốt',
      goodsCondition: 'Nguyên vẹn',
      packageCount: 2,
      inventoryLines,
      goodsCategory: 'Đồ gia dụng',
      goodsMaterial: 'Gỗ',
      evidenceReferences: ['evidence.jpg'],
      handedOverItems: ['Ổ khóa LOCK-TEST', 'Biên nhận'],
      notes: '',
      lockReference: 'LOCK-TEST',
    }

    const completed = await completeCheckIn('checkin-1', request)

    expect(fetchMock.mock.calls[0][0]).toContain('/checkin-1/complete')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(expect.objectContaining({
      inventoryLines,
      goodsMaterial: 'Gỗ',
    }))
    expect(completed.handover?.inventoryLines).toEqual(inventoryLines)
    await recordCheckInArrival('checkin-1')
    expect(fetchMock.mock.calls[1][0]).toContain('/checkin-1/arrival')
    expect(fetchMock.mock.calls[1][1]?.body).toBeUndefined()
  })

  it('connects every persisted check-in workflow transition', async () => {
    const fetchMock = mockEnvelope(responseCase)
    vi.stubGlobal('fetch', fetchMock)

    await verifyCheckInIdentity('checkin-1', { identityDocumentNumber: '079203009988' })
    await signCheckInContract('checkin-1', 'contract-asset-1')
    await confirmCheckInPayment('checkin-1', 'Không còn khoản phải thu')
    await startCheckInSetup('checkin-1', {
      lockReference: 'LOCK-001',
    })
    await completeCheckInSetup('checkin-1', 'Khách đã setup xong')

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      expect.stringContaining('/checkin-1/identity-verification'),
      expect.stringContaining('/checkin-1/contract-signing'),
      expect.stringContaining('/checkin-1/payment-confirmation'),
      expect.stringContaining('/checkin-1/setup/start'),
      expect.stringContaining('/checkin-1/setup/complete'),
    ]))
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toMatchObject({
      lockReference: 'LOCK-001',
    })
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

    await uploadCheckInEvidence('checkin-1', new File(['test'], 'handover.png', { type: 'image/png' }), 'CHECK_IN', 'bang-chung-ban-giao-kho-luc-ban-giao', 'RSV-ABC-123')

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toContain('/api/files')
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.headers as Headers).has('Content-Type')).toBe(false)
    expect((options.body as FormData).get('entityType')).toBe('CHECK_IN')
    expect((options.body as FormData).get('entityId')).toBe('checkin-1')
    expect(((options.body as FormData).get('file') as File).name).toMatch(/^bang-chung-ban-giao-kho-luc-ban-giao-rsv-abc-123-\d{14}\.png$/)
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

  it('lists active staff credentials and reissues one against the active rental', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: 'credential-1', status: 'ACTIVE', rentalId: 'rental-1' }],
        pagination: { page: 0, pageSize: 100, totalItems: 1, totalPages: 1, sort: 'issuedAt: DESC' },
        correlationId: 'c-1',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'credential-2', status: 'ACTIVE', rentalId: 'rental-1' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const listed = await listStaffAccessCredentials({ status: 'ACTIVE', pageSize: 100 })
    expect(listed.data[0].rentalId).toBe('rental-1')
    await reissueAccessCredential('rental-1', {
      credentialId: 'credential-1',
      identityVerified: true,
      verificationMethod: 'ID_DOCUMENT',
      reason: 'Khách báo mất chìa khóa',
      reference: 'KEY-NEW-001',
    })

    expect(fetchMock.mock.calls[0][0]).toContain('/api/staff/access-credentials?page=0&pageSize=100&status=ACTIVE')
    expect(fetchMock.mock.calls[1][0]).toContain('/api/staff/rentals/rental-1/credentials/reissue')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ credentialId: 'credential-1', identityVerified: true, reference: 'KEY-NEW-001' })
  })
})
