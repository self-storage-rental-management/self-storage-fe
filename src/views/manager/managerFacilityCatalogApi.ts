import { ApiClientError, apiRequest } from '../../services/apiClient'
import { readRentalPage } from '../../services/rentalApi'

export interface FacilityCatalogType {
  id: string
  facilityId: string
  code: string
  name: string
  lengthM: number | null
  widthM: number | null
  heightM: number | null
  areaM2: number | null
  volumeM3: number | null
  maxLoadKg: number | null
  monthlyPrice: number | null
  status: 'active' | 'inactive'
}

const unitStatuses = ['available', 'reserved', 'occupied', 'maintenance', 'held', 'assigned'] as const
type UnitStatus = typeof unitStatuses[number]
interface CatalogUnit { id: string; facilityId: string; unitTypeId: string; status: UnitStatus }
export interface FacilityCatalogRow extends FacilityCatalogType {
  total: number
  counts: Record<UnitStatus, number>
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const measure = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
function invalidCatalog(): never {
  throw new ApiClientError('Dữ liệu loại gian kho không đầy đủ hoặc không khớp cơ sở. Chưa thể xác minh số lượng.', { code: 'INVALID_RESPONSE' })
}

/** All pages must be read before a count may be presented as a facility total. */
async function readAll<T extends { id: string }>(path: string, validate: (value: unknown) => boolean): Promise<T[]> {
  const rows: T[] = []
  const ids = new Set<string>()
  let total: number | undefined
  let pageSize: number | undefined
  for (let page = 0; page < 100; page++) {
    let result
    try {
      result = readRentalPage<T>(await apiRequest(`${path}${path.includes('?') ? '&' : '?'}page=${page}&size=100&sort=id,asc`), validate, page)
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'INVALID_RESPONSE') invalidCatalog()
      throw error
    }
    if (total !== undefined && total !== result.pagination.totalItems) invalidCatalog()
    if (pageSize !== undefined && pageSize !== result.pagination.pageSize) invalidCatalog()
    total = result.pagination.totalItems
    pageSize = result.pagination.pageSize
    if (result.pagination.totalPages > 100 || result.data.length !== Math.min(result.pagination.pageSize, Math.max(0, total - page * result.pagination.pageSize))) invalidCatalog()
    for (const row of result.data) {
      if (ids.has(row.id)) invalidCatalog()
      ids.add(row.id)
      rows.push(row)
    }
    if (page + 1 >= result.pagination.totalPages) {
      if (rows.length !== total) invalidCatalog()
      return rows
    }
  }
  return invalidCatalog()
}

export async function loadManagerFacilityCatalog(facilityId: string): Promise<FacilityCatalogRow[]> {
  if (!facilityId.trim()) throw new Error('Chưa được phân công cơ sở.')
  const encoded = encodeURIComponent(facilityId)
  const [types, units] = await Promise.all([
    readAll<FacilityCatalogType>(`/api/facilities/${encoded}/unit-types`, value => record(value)
      && text(value.id) && value.facilityId === facilityId && text(value.code) && text(value.name)
      && ['active', 'inactive'].includes(String(value.status))
      && ['lengthM', 'widthM', 'heightM', 'areaM2', 'volumeM3', 'maxLoadKg', 'monthlyPrice'].every(field => measure(value[field]))),
    readAll<CatalogUnit>(`/api/storage-units?facilityId=${encoded}`, value => record(value)
      && text(value.id) && value.facilityId === facilityId && text(value.unitTypeId)
      && unitStatuses.includes(value.status as UnitStatus)),
  ])
  const rows = types.map(type => ({ ...type, total: 0, counts: Object.fromEntries(unitStatuses.map(status => [status, 0])) as Record<UnitStatus, number> }))
  const byId = new Map(rows.map(row => [row.id, row]))
  for (const unit of units) {
    const row = byId.get(unit.unitTypeId)
    if (!row) invalidCatalog()
    row.total++
    row.counts[unit.status]++
  }
  return rows
}

/** Translate presentation only; identifiers and stored names are never rewritten. */
export function facilityCatalogTypeName(name: string, code: string) {
  const normalized = name.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  const labels: Record<string, string> = {
    small: 'Gian kho nhỏ', 'small storage': 'Gian kho nhỏ',
    medium: 'Gian kho vừa', 'medium storage': 'Gian kho vừa',
    large: 'Gian kho lớn', 'large storage': 'Gian kho lớn',
    xlarge: 'Gian kho rất lớn', 'extra large': 'Gian kho rất lớn', 'extra large storage': 'Gian kho rất lớn',
    'extra large commercial': 'Gian kho thương mại rất lớn',
  }
  return labels[normalized] || (/[À-ỹ]/u.test(name) || /^(gian kho|kho)\b/i.test(name) ? name : `Loại gian kho ${code}`)
}
