const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')

export class ApiClientError extends Error {
  readonly status: number | null
  readonly code: string
  readonly details: unknown

  constructor(message: string, options: { status?: number | null; code?: string; details?: unknown } = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = options.status ?? null
    this.code = options.code ?? 'API_ERROR'
    this.details = options.details
  }
}

const REFRESH_TOKEN_STORAGE_KEY = 'storagehub:refresh_token'

function readStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

let accessToken: string | null = null
let refreshToken: string | null = readStoredRefreshToken()
let refreshInFlight: Promise<boolean> | null = null

export function setAccessToken(token: string) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}

export function setRefreshToken(token: string) {
  refreshToken = token
  try {
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token)
  } catch {}
}

export function getRefreshToken() {
  return refreshToken
}

export function clearAuthTokens() {
  accessToken = null
  refreshToken = null
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {}
}

export function hasAccessToken() {
  return Boolean(accessToken)
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const payload = await readPayload(response)
      const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
      if (!response.ok || !data || typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
        return false
      }
      accessToken = data.accessToken
      refreshToken = data.refreshToken
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export async function apiRequest<T>(path: string, options: RequestInit & { skipAuth?: boolean; timeoutMs?: number } = {}): Promise<T> {
  const { skipAuth, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  if (requestOptions.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!skipAuth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response: Response
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, headers, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError('Backend phản hồi quá lâu. Vui lòng kiểm tra backend StorageHub.', { code: 'TIMEOUT' })
    }
    throw new ApiClientError('Không thể kết nối tới backend StorageHub.', { code: 'NETWORK_ERROR' })
  } finally {
    clearTimeout(timeoutId)
  }

  const payload = await readPayload(response)
  if (response.status === 401 && !skipAuth && path !== '/api/auth/refresh' && await refreshAccessToken()) {
    return apiRequest<T>(path, options)
  }
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {}
    const message = typeof error.message === 'string' ? error.message : `API request failed (${response.status})`
    throw new ApiClientError(message, {
      status: response.status,
      code: typeof error.code === 'string' ? error.code : 'API_ERROR',
      details: error.details,
    })
  }

  return payload as T
}

