import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { clearAuthTokens } from '../../services/apiClient'
import { facilityCatalogTypeName, loadManagerFacilityCatalog } from './managerFacilityCatalogApi'
import ManagerFacilityCatalog, { FacilityCatalogTable } from './ManagerFacilityCatalog'
import { readFileSync } from 'node:fs'

const { actor } = vi.hoisted(() => ({ actor: { current: null as null | { id: string; status: string; roles: string[]; facilityScopes: Record<string, string>; permissions: string[]; facilityNames?: Record<string, string> } } }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => actor.current }))

const definition = (id = 'type-a', facilityId = 'facility-a') => ({
  id, facilityId, code: 'S', name: 'Small Storage', status: 'active',
  lengthM: 8, widthM: 10, heightM: 5, areaM2: 80, volumeM3: 400, maxLoadKg: 1000, monthlyPrice: 5500000,
})
const unit = (id: string, status = 'available', unitTypeId = 'type-a', facilityId = 'facility-a') => ({ id, facilityId, unitTypeId, status })
const page = (data: unknown[], total = data.length, index = 0, size = 100) => ({ data, pagination: { page: index, pageSize: size, totalItems: total, totalPages: Math.ceil(total / size), sort: 'id: ASC' }, correlationId: 'test' })
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const route = (types: unknown, units: unknown) => vi.fn(async (input: string) => json(input.includes('/unit-types') ? types : units))

afterEach(() => { clearAuthTokens(); vi.unstubAllGlobals(); actor.current = null })

describe('Manager facility catalog DB read adapter', () => {
  it('uses facility-specific endpoints, IDs, dimensions and prices, not English names or global demo definitions', async () => {
    const fetch = route(page([definition(), { ...definition('type-b'), monthlyPrice: 7200000, lengthM: 12 }]),
      page([unit('u-1'), unit('u-2', 'occupied'), unit('u-3', 'maintenance', 'type-b')]))
    vi.stubGlobal('fetch', fetch)
    const rows = await loadManagerFacilityCatalog('facility-a')
    expect(rows.map(row => [row.total, row.lengthM, row.monthlyPrice])).toEqual([[2, 8, 5500000], [1, 12, 7200000]])
    expect(rows[0].counts).toEqual({ available: 1, occupied: 1, maintenance: 0, held: 0, assigned: 0, reserved: 0 })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8080/api/facilities/facility-a/unit-types?page=0&size=100&sort=id,asc',
      'http://localhost:8080/api/storage-units?facilityId=facility-a&page=0&size=100&sort=id,asc',
    ])
  })

  it('reads all unit pages before counting, including held/reserved/assigned', async () => {
    const first = Array.from({ length: 100 }, (_, index) => unit(`u-${index}`, index === 0 ? 'held' : index === 1 ? 'reserved' : 'available'))
    const fetch = vi.fn(async (url: string) => json(url.includes('/unit-types') ? page([definition()]) : url.includes('page=1') ? page([unit('last', 'assigned')], 101, 1) : page(first, 101)))
    vi.stubGlobal('fetch', fetch)
    const [row] = await loadManagerFacilityCatalog('facility-a')
    expect(row.total).toBe(101)
    expect(row.counts).toEqual({ available: 98, reserved: 1, held: 1, assigned: 1, occupied: 0, maintenance: 0 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('reads all type pages and includes inactive types without a Customer active-only filter', async () => {
    const fetch = vi.fn(async (url: string) => json(url.includes('/storage-units') ? page([]) : url.includes('page=1')
      ? page([{ ...definition('type-b'), status: 'inactive' }], 2, 1, 1) : page([definition()], 2, 0, 1)))
    vi.stubGlobal('fetch', fetch)
    const rows = await loadManagerFacilityCatalog('facility-a')
    expect(rows).toHaveLength(2)
    expect(rows[1].status).toBe('inactive')
    expect(fetch.mock.calls.every(([url]) => !url.includes('status=active'))).toBe(true)
  })

  it('accepts a verified empty facility and a type with zero actual units', async () => {
    vi.stubGlobal('fetch', route(page([]), page([])))
    expect(await loadManagerFacilityCatalog('facility-a')).toEqual([])
    vi.stubGlobal('fetch', route(page([definition()]), page([])))
    expect((await loadManagerFacilityCatalog('facility-a'))[0].total).toBe(0)
  })

  it.each([401, 403, 404, 500])('does not replace HTTP %s with demo data or zero counts', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'ERROR', message: 'Unavailable' } }, status)))
    await expect(loadManagerFacilityCatalog('facility-a')).rejects.toMatchObject({ status })
  })

  it('does not replace a network error with an empty catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(loadManagerFacilityCatalog('facility-a')).rejects.toBeDefined()
  })

  it.each([
    [page([definition('type-a', 'other-facility')]), page([])],
    [page([definition()]), page([unit('u', 'available', 'type-a', 'other-facility')])],
    [page([definition()]), page([unit('u', 'available', 'unknown-type')])],
    [page([definition()]), page([unit('u', 'unknown')])],
    [page([definition()]), page([unit('u'), unit('u')])],
    [page([{ ...definition(), monthlyPrice: -1 }]), page([])],
    [page([{ ...definition(), lengthM: '8' }]), page([])],
    [{ data: [], pagination: { page: 0, size: 100, totalElements: 0, totalPages: 0 } }, page([])],
    [page([definition()]), page([], 2)],
  ])('rejects inconsistent, cross-facility or malformed data', async (types, units) => {
    vi.stubGlobal('fetch', route(types, units))
    await expect(loadManagerFacilityCatalog('facility-a')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('rejects changing totals across pages instead of showing a partial count', async () => {
    const fetch = vi.fn(async (url: string) => json(url.includes('/unit-types') ? page([definition()])
      : url.includes('page=1') ? page([unit('last')], 102, 1) : page(Array.from({ length: 100 }, (_, i) => unit(`u-${i}`)), 101)))
    vi.stubGlobal('fetch', fetch)
    await expect(loadManagerFacilityCatalog('facility-a')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('does not request data when no facility is specified', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(loadManagerFacilityCatalog('')).rejects.toThrow('Chưa được phân công cơ sở')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Vietnamese catalog presentation', () => {
  it.each([
    ['Small Storage', 'Gian kho nhỏ'], ['Medium Storage', 'Gian kho vừa'],
    ['Large Storage', 'Gian kho lớn'], ['Extra Large Commercial', 'Gian kho thương mại rất lớn'],
    ['Gian kho lạnh', 'Gian kho lạnh'], ['Special Storage', 'Loại gian kho S'],
  ])('translates only the display name %s', (name, label) => expect(facilityCatalogTypeName(name, 'S')).toBe(label))

  it('renders DB measures and VND directly, with missing data distinct from zero', async () => {
    vi.stubGlobal('fetch', route(page([{ ...definition(), maxLoadKg: null }]), page([unit('u')])))
    const rows = await loadManagerFacilityCatalog('facility-a')
    const html = renderToStaticMarkup(<FacilityCatalogTable rows={rows} />)
    expect(html).toContain('Gian kho nhỏ')
    expect(html).not.toContain('Small Storage')
    expect(html).toContain('8 × 10 × 5 m')
    expect(html).toContain('5.500.000')
    expect(html).not.toContain('143.000.000.000')
    expect(html).toContain('1 gian')
    expect(html).toContain('Chưa có thông tin')
  })

  it('does not render a zero-count table while loading or without a facility scope', () => {
    actor.current = { id: 'manager-a', roles: ['MANAGER'], status: 'ACTIVE', permissions: [], facilityScopes: {} }
    expect(renderToStaticMarkup(<ManagerFacilityCatalog />)).toContain('Tài khoản chưa được phân công cơ sở')
    actor.current.facilityScopes = { 'facility-a': 'READ', 'facility-b': 'MANAGE' }
    actor.current.facilityNames = { 'facility-a': 'Cơ sở A', 'facility-b': 'Cơ sở B' }
    const html = renderToStaticMarkup(<ManagerFacilityCatalog />)
    expect(html).toContain('Cơ sở A')
    expect(html).toContain('Cơ sở B')
    expect(html).toContain('Đang tải')
    expect(html).not.toContain('0 gian')
  })

  it('mounts the DB catalog in API mode without changing unrelated inventory sections', () => {
    const source = readFileSync(new URL('./ManagerInventoryPanel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('isApiAuthenticated() ? <ManagerFacilityCatalog /> : <Card>')
    expect(source).not.toContain('Lịch khả dụng tương lai')
    expect(source).toContain('Hàng đợi bảo trì')
  })
})
