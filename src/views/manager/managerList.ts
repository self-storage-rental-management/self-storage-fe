import { formatVnd, USD_TO_VND_RATE } from '../../i18n/currency'

export const MANAGER_PAGE_SIZE_OPTIONS = [10, 20, 50] as const

export function normalizeManagerMoney(value?: number): number | undefined {
  if (!Number.isFinite(value) || Number(value) < 0) return undefined
  return Number(value) >= USD_TO_VND_RATE ? Number(value) / USD_TO_VND_RATE : Number(value)
}

export function normalizeManagerSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN')
    .trim()
}

export function matchesManagerSearch(query: string, values: unknown[]): boolean {
  const normalized = normalizeManagerSearch(query)
  return !normalized || values.some(value => normalizeManagerSearch(value).includes(normalized))
}

export function managerDateValue(value?: string): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

export function formatManagerDate(value?: string): string {
  const timestamp = managerDateValue(value)
  return timestamp
    ? new Date(timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa xác định'
}

export function formatManagerDateTime(value?: string): string {
  const timestamp = managerDateValue(value)
  return timestamp
    ? new Date(timestamp).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Chưa xác định'
}

export function formatManagerMoney(value?: number): string {
  const normalized = normalizeManagerMoney(value)
  return normalized === undefined ? 'Chưa xác định' : formatVnd(normalized)
}

export function paginateManagerItems<T>(items: T[], requestedPage: number, pageSize: number) {
  const safePageSize = MANAGER_PAGE_SIZE_OPTIONS.includes(pageSize as typeof MANAGER_PAGE_SIZE_OPTIONS[number]) ? pageSize : MANAGER_PAGE_SIZE_OPTIONS[0]
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  return {
    page,
    pageCount,
    total: items.length,
    items: items.slice((page - 1) * safePageSize, page * safePageSize)
  }
}
