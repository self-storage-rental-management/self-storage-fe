import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAuthTokens, setAccessToken } from './apiClient'
import { getReturnFeeSchedule, getReturnFeeScheduleForReturn, publishReturnFeeSchedule, type ReturnFeeSchedule } from './returnApi'

const returnId = '11111111-1111-4111-8111-111111111111'
const oldSchedule: ReturnFeeSchedule = {
  revision: 1, prices: { clean: 0, minor: 100000 },
  details: { minor: { label: 'Vệ sinh nhẹ', trigger: 'Bụi nhẹ', applies: 'Trả kho' } },
  publishedAt: '2026-11-01T00:00:00Z',
}
const newSchedule: ReturnFeeSchedule = {
  revision: 2, prices: { clean: 0, minor: 125000 },
  details: { minor: { label: 'Dọn bụi', trigger: 'Có bụi cần quét', applies: 'Nghiệm thu trả kho' } },
  publishedAt: '2026-11-27T00:00:00Z',
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } })
}
afterEach(() => { vi.unstubAllGlobals(); clearAuthTokens() })

describe('versioned return fee transport', () => {
  it('publishes prices and all descriptions, then reads the old applicable version even when latest changed', async () => {
    setAccessToken('test-token')
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(newSchedule))
      .mockResolvedValueOnce(response(newSchedule))
      .mockResolvedValueOnce(response(oldSchedule))
      .mockResolvedValueOnce(response(oldSchedule))
    vi.stubGlobal('fetch', fetch)
    const draft = { ...oldSchedule, prices: newSchedule.prices, details: newSchedule.details }
    expect(await publishReturnFeeSchedule(draft)).toEqual(newSchedule)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/return-fee-schedule$/)
    expect(fetch.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(draft)
    expect(await getReturnFeeSchedule()).toEqual(newSchedule)
    expect(await getReturnFeeScheduleForReturn(returnId)).toEqual(oldSchedule)
    expect(await getReturnFeeScheduleForReturn(returnId)).toEqual(oldSchedule)
    expect(fetch.mock.calls[2][0]).toMatch(new RegExp(`/api/return-fee-schedule/returns/${returnId}$`))
    expect(fetch.mock.calls[3][0]).toEqual(fetch.mock.calls[2][0])
  })

  it('propagates publish failure without mutating the draft', async () => {
    setAccessToken('test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 409)))
    const draft = structuredClone(newSchedule)
    await expect(publishReturnFeeSchedule(draft)).rejects.toThrow()
    expect(draft).toEqual(newSchedule)
  })

  it('rejects an invalid return id without requesting the latest schedule', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(getReturnFeeScheduleForReturn('../latest')).rejects.toThrow('Mã hồ sơ không hợp lệ.')
    expect(fetch).not.toHaveBeenCalled()
  })
})
