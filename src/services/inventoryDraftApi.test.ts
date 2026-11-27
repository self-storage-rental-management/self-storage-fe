import { afterEach, expect, it, vi } from 'vitest'
import { getInventoryDraft, saveInventoryDraft, prepareInventoryResolution, type CompleteCheckInRequest } from './checkInApi'

afterEach(() => vi.unstubAllGlobals())

it('saves a versioned inventory snapshot and reloads that same saved snapshot', async () => {
  const request = { packageCount: 4, notes: 'Thùng bị móp', inventoryLines: [] } as unknown as CompleteCheckInRequest
  const saved = { request, revision: 2, savedAt: '2026-11-24T01:00:00Z' }
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: saved }), { headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  expect(await saveInventoryDraft('checkin', request, 1)).toEqual(saved)
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ request, expectedRevision: 1 })
  expect(await getInventoryDraft('checkin')).toEqual(saved)
  expect(fetch.mock.calls[1][0]).toContain('/checkin/inventory-draft')
})

it('prepares resolution using only the saved revision instead of silently submitting edited form data', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: { checkInId: 'checkin', checkInStatus: 'setup_completed', reservationId: 'reservation', reservationStatus: 'PREPARING' } }), { headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  await prepareInventoryResolution('checkin', 2)
  expect(fetch.mock.calls[0][0]).toContain('/inventory-draft/resolve')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ expectedRevision: 2 })
})
