import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAuthTokens } from '../../services/apiClient'
import { manager, page, rental, renewal } from '../../../tests/rentalApiFixtures'
import { supportIds, supportTicket } from '../../../tests/supportApiFixtures'
import { loadManagerApiCount, loadManagerRentalFinancial, loadManagerRentalPage, managerApiIdentity } from './managerD1D5Api'

const actor = { ...manager, facilityScopes: { ...manager.facilityScopes, [supportIds.facility]: 'MANAGE' as const }, permissions: [...manager.permissions, 'support:read'] }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
function respond(value: unknown, status = 200) {
  const fetch = vi.fn(async (_input: string) => json(value, status))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const countPage = (rows: unknown[], total = rows.length) => ({ ...page(rows), pagination: { page: 0, pageSize: 1, totalItems: total, totalPages: total, sort: 'id,asc' } })
const overduePage = (partial = false) => ({ ...countPage([]), asOf: '2026-10-09T00:00:00Z', completeness: partial ? 'PARTIAL' : 'COMPLETE', missingSources: partial ? ['RENTAL_FINANCIAL'] : [] })
afterEach(() => { vi.unstubAllGlobals(); clearAuthTokens() })

describe('Manager D1-D5 reads reuse backend contracts without local fallbacks', () => {
  it.each([
    ['rentals', '/api/manager/rentals', rental, null],
    ['active-rentals', '/api/manager/rentals', rental, 'active'],
    ['pending-renewals', '/api/manager/renewals', renewal, 'pending'],
    ['open-support', '/api/manager/support-tickets', supportTicket, 'open'],
  ] as const)('loads %s with the server total, not page length', async (metric, path, row, status) => {
    const fetch = respond(countPage([row], 37))
    expect(await loadManagerApiCount(metric, actor)).toEqual({ value: 37, completeness: 'COMPLETE' })
    const url = new URL(fetch.mock.calls[0][0] as string)
    expect(url.pathname).toBe(path)
    expect(url.searchParams.get('page')).toBe('0')
    expect(url.searchParams.get('size')).toBe('1')
    expect(url.searchParams.get('status')).toBe(status)
  })
  it.each(['payment-overdue', 'term-overdue'] as const)('does not turn a partial empty %s result into zero', async metric => {
    const fetch = respond(overduePage(true))
    expect(await loadManagerApiCount(metric, actor)).toMatchObject({ value: null, completeness: 'PARTIAL' })
    expect(new URL(fetch.mock.calls[0][0] as string).searchParams.get('kind')).toBe(metric === 'payment-overdue' ? 'PAYMENT_DUE' : 'RENTAL_TERM')
  })
  it.each(['rentals', 'active-rentals', 'pending-renewals', 'open-support', 'payment-overdue', 'term-overdue'] as const)('accepts an authoritative empty %s result', async metric => {
    respond(metric.endsWith('overdue') ? overduePage() : countPage([]))
    expect(await loadManagerApiCount(metric, actor)).toEqual({ value: 0, completeness: 'COMPLETE' })
  })
  it.each([401, 403, 409, 500])('propagates HTTP %s without a local count', async status => {
    respond({ error: { code: 'API_ERROR', message: 'Unavailable' } }, status)
    await expect(loadManagerApiCount('rentals', actor)).rejects.toMatchObject({ status })
  })
  it('propagates a connection failure and rejects malformed pagination', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
    await expect(loadManagerApiCount('rentals', actor)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    respond({ data: [], pagination: { totalItems: 99 } })
    await expect(loadManagerApiCount('rentals', actor)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('fails closed for wrong role, inactive actor, missing permission or scope before HTTP', async () => {
    const fetch = respond(countPage([]))
    for (const a of [{ ...actor, roles: ['CUSTOMER'] as const }, { ...actor, status: 'SUSPENDED' as const }, { ...actor, permissions: [] }, { ...actor, facilityScopes: {} }]) {
      await expect(loadManagerApiCount('rentals', a as typeof actor)).rejects.toMatchObject({ status: 403 })
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects cross-facility and filter-inconsistent records', async () => {
    respond(countPage([{ ...rental, facility: { ...rental.facility, id: 'outside' } }]))
    await expect(loadManagerApiCount('rentals', actor)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    respond(countPage([{ ...rental, status: 'completed' }]))
    await expect(loadManagerApiCount('active-rentals', actor)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('reads financial list/detail using existing D1 routes and preserves UNKNOWN values', async () => {
    const fetch = respond(page([rental]))
    expect((await loadManagerRentalPage(actor, { page: 0, size: 20, search: 'A-01' })).data).toHaveLength(1)
    expect(new URL(fetch.mock.calls[0][0] as string).searchParams.get('search')).toBe('A-01')
    const detailFetch = respond({ data: rental })
    expect((await loadManagerRentalFinancial(actor, rental.id)).financialSummary.outstandingAmount).toBeNull()
    expect(detailFetch.mock.calls[0][0]).toBe('http://localhost:8080/api/manager/rentals/r1')
  })
  it('rejects a foreign detail or unauthorized facility filter', async () => {
    respond({ data: { ...rental, facility: { ...rental.facility, id: 'outside' } } })
    await expect(loadManagerRentalFinancial(actor, rental.id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    const fetch = respond(page([]))
    await expect(loadManagerRentalPage(actor, { facilityId: 'outside' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('includes account, role, status, permissions and scopes in resource identity', () => {
    for (const a of [{ ...actor, id: 'other' }, { ...actor, roles: [] }, { ...actor, status: 'LOCKED' as const }, { ...actor, permissions: [] }, { ...actor, facilityScopes: {} }]) {
      expect(managerApiIdentity(a)).not.toBe(managerApiIdentity(actor))
    }
  })
})
