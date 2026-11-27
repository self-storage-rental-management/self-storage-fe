import { clearProcessingLeases, forgetProcessingLease, getProcessingLease, invalidateProcessing, isProcessingViewOpen, notifyProcessing, processingTarget, putProcessingLease, type LocalProcessingLease, type ProcessingView } from './processingLeaseState'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')

export class ApiClientError extends Error {
  readonly status: number | null
  readonly code: string
  readonly diagnosticMessage: string
  readonly details: unknown

  constructor(message: string, options: { status?: number | null; code?: string; details?: unknown; diagnosticMessage?: string } = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = options.status ?? null
    this.code = options.code ?? 'API_ERROR'
    this.diagnosticMessage = options.diagnosticMessage ?? message
    this.details = options.details
  }
}

const ACCESS_TOKEN_STORAGE_KEY = 'storagehub:access_token'
const REFRESH_TOKEN_STORAGE_KEY = 'storagehub:refresh_token'

function readStoredAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function readStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

let accessToken: string | null = readStoredAccessToken()
let refreshToken: string | null = readStoredRefreshToken()
let refreshInFlight: Promise<boolean> | null = null

export function setAccessToken(token: string) {
  accessToken = token
  try {
    sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
  } catch {}
}

export function clearAccessToken() {
  accessToken = null
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  } catch {}
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
  clearProcessingLeases()
  accessToken = null
  refreshToken = null
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    sessionStorage.removeItem('storagehub:current_actor')
    sessionStorage.removeItem('storagehub_customer_booking_draft')
  } catch {}
}

function notifyAuthExpired() {
  const hadSession = Boolean(accessToken || refreshToken || (() => {
    try { return Boolean(sessionStorage.getItem('storagehub:current_actor')) } catch { return false }
  })())
  clearAuthTokens()
  if (hadSession && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storagehub:auth-expired'))
  }
}

export function hasAccessToken() {
  return Boolean(accessToken)
}

export function getAccessToken() {
  return accessToken
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function isServerDiagnostic(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('exception') || lower.includes('sql') || lower.includes('stack trace') || lower.includes('at com.')
}

function responseError(status: number, payload: unknown): ApiClientError {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {}
  const rawMessage = typeof error.message === 'string' ? error.message : undefined
  const messages: Record<number, string> = {
    400: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
    401: 'Vui lòng kiểm tra thông tin đăng nhập hoặc đăng nhập lại.',
    403: 'Bạn không có quyền thực hiện thao tác này.',
    404: 'Không tìm thấy thông tin yêu cầu.',
    409: 'Hồ sơ đã thay đổi hoặc chưa đủ điều kiện. Vui lòng kiểm tra lại.',
    422: 'Vui lòng kiểm tra lại các mục đã nhập.',
  }
  const shouldMask = rawMessage && isServerDiagnostic(rawMessage)
  const message = shouldMask ? (messages[status] ?? 'Chưa thể thực hiện yêu cầu. Vui lòng thử lại sau.') : (rawMessage ?? messages[status] ?? 'Chưa thể thực hiện yêu cầu. Vui lòng thử lại sau.')
  return new ApiClientError(message, {
    status, code: typeof error.code === 'string' ? error.code : 'API_ERROR', details: error.details,
    diagnosticMessage: rawMessage,
  })
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
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      if (isRecord(data.actor)) {
        try {
          sessionStorage.setItem('storagehub:current_actor', JSON.stringify(data.actor))
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('storagehub:actor-updated'))
          }
        } catch {}
      }
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function rawApiRequest<T>(path: string, options: RequestInit & { skipAuth?: boolean; timeoutMs?: number } = {}, processingLease?: LocalProcessingLease): Promise<T> {
  const { skipAuth, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...requestOptions } = options

  // If a protected request is initiated and we don't have an accessToken in memory
  // but we do have a refreshToken in storage, refresh before sending to avoid 401s.
  if (!skipAuth && !accessToken && refreshToken && path !== '/api/auth/refresh' && path !== '/api/auth/login') {
    await refreshAccessToken()
  }

  const headers = new Headers(requestOptions.headers)
  if (requestOptions.body && !(requestOptions.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!skipAuth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response: Response
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, headers, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError('Yêu cầu mất nhiều thời gian hơn dự kiến. Vui lòng thử lại.', { code: 'TIMEOUT' })
    }
    throw new ApiClientError('Chưa kết nối được hệ thống. Vui lòng thử lại.', { code: 'NETWORK_ERROR' })
  } finally {
    clearTimeout(timeoutId)
  }

  const payload = await readPayload(response)
  if (response.status === 401 && !skipAuth && path !== '/api/auth/refresh') {
    if (await refreshAccessToken()) {
      return rawApiRequest<T>(path, options, processingLease)
    }
    notifyAuthExpired()
  }
  if (!response.ok) {
    const failure = responseError(response.status, payload)
    // Only a real lease conflict costs the operator their ownership. A 403 or a business
    // validation error says this one action is not allowed; it does not mean the record was
    // taken away, and treating it as such locked the whole screen.
    if (processingLease && isRecord(failure.details) && failure.details.processingConflict) invalidateProcessing(processingLease)
    throw failure
  }
  if (processingLease) {
    const revision = response.headers.get('X-Processing-Version')
    const stamp = response.headers.get('X-Processing-Stamp')
    const expiresAt = response.headers.get('X-Processing-Expires-At')
    if (revision !== null && stamp !== null && Number.isSafeInteger(Number(revision))) {
      processingLease.view = { ...processingLease.view, revision: Number(revision), sourceStamp: stamp, expiresAt: expiresAt || processingLease.view.expiresAt }
      notifyProcessing()
    }
    // A successful response without lease headers came from a route that is not lease-guarded.
    // That does not revoke ownership, so keep the lease and let the next heartbeat reconcile it.
    // Invalidating here used to strand the operator on "Hồ sơ đã thay đổi" mid-workflow.
  }

  return payload as T
}

/** Every protected command carries its lease and observed revision, including shortcuts outside a detail form. */
export async function apiRequest<T>(path: string, options: RequestInit & { skipAuth?: boolean; timeoutMs?: number } = {}): Promise<T> {
  const target = options.skipAuth ? null : processingTarget(path, options.method)
  if (!target) return rawApiRequest<T>(path, options)
  let lease = getProcessingLease(target.target, target.id)
  let temporary = false
  const lockUrl = target ? '/api/processing-locks/' + target.target + '/' + target.id : ''
  if (!lease) {
    if (isProcessingViewOpen(target.target, target.id))
      throw new ApiClientError('Bạn đang chỉ xem hồ sơ. Cần nhận quyền xử lý trước khi lưu thay đổi.', { status: 409, code: 'CONFLICT' })
    temporary = true
    const token = crypto.randomUUID()
    const view = (await rawApiRequest<{ data: ProcessingView }>(lockUrl + '/acquire', { method: 'POST', body: JSON.stringify({ token, reclaimSameOwner: false }) })).data
    if (!view.owned) throw new ApiClientError(`Hồ sơ đang được ${view.ownerName || 'nhân sự khác'} xử lý. Bạn chỉ có thể xem.`, { status: 409, code: 'CONFLICT' })
    lease = { target: target.target, id: target.id, token, view, invalid: false, inFlight: false, ready: true }
    putProcessingLease(lease)
  }
  if (!lease.ready) throw new ApiClientError('Đang tải dữ liệu mới của hồ sơ. Vui lòng chờ trước khi lưu.', { status: 409, code: 'CONFLICT' })
  if (lease.invalid || !lease.view.expiresAt || Date.parse(lease.view.expiresAt) <= Date.now()) {
    invalidateProcessing(lease)
    throw new ApiClientError('Quyền xử lý đã hết hạn hoặc hồ sơ đã thay đổi. Đóng và mở lại hồ sơ để tiếp tục.', { status: 409, code: 'CONFLICT' })
  }
  if (lease.inFlight) throw new ApiClientError('Một thao tác của hồ sơ đang được gửi. Vui lòng chờ hoàn tất.', { status: 409, code: 'CONFLICT' })
  lease.inFlight = true
  notifyProcessing()
  const headers = new Headers(options.headers)
  headers.set('X-Processing-Token', lease.token)
  headers.set('X-Processing-Version', String(lease.view.revision))
  headers.set('X-Processing-Stamp', lease.view.sourceStamp)
  try { return await rawApiRequest<T>(path, { ...options, headers }, lease) }
  catch (failure) {
    // A timeout can occur after a committed write. Do not adopt a new revision on retry.
    if (failure instanceof ApiClientError && ['TIMEOUT', 'NETWORK_ERROR'].includes(failure.code)) invalidateProcessing(lease)
    throw failure
  } finally {
    lease.inFlight = false
    notifyProcessing()
    if (temporary) {
      forgetProcessingLease(lease.target, lease.id, lease.token)
      try { await rawApiRequest(lockUrl + '/release', { method: 'POST', body: JSON.stringify({ token: lease.token, reclaimSameOwner: false }) }) } catch { /* TTL handles lost cleanup. */ }
    }
  }
}

export interface ApiDownload {
  blob: Blob
  contentType: string
  fileName: string | null
}

function downloadFileName(response: Response) {
  const disposition = response.headers.get('content-disposition') || ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return decodeURIComponent(encoded) } catch { return encoded }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || null
}

export async function apiDownload(path: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, method: "GET" | "HEAD" = "GET"): Promise<ApiDownload> {
  if (!accessToken && refreshToken) {
    await refreshAccessToken()
  }
  const headers = new Headers()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError('Yêu cầu mất nhiều thời gian hơn dự kiến. Vui lòng thử lại.', { code: 'TIMEOUT' })
    }
    throw new ApiClientError('Chưa kết nối được hệ thống. Vui lòng thử lại.', { code: 'NETWORK_ERROR' })
  } finally {
    globalThis.clearTimeout(timeoutId)
  }

  if (response.status === 401) {
    if (await refreshAccessToken()) return apiDownload(path, timeoutMs, method)
    notifyAuthExpired()
  }
  if (!response.ok) throw responseError(response.status, await readPayload(response))
  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    fileName: downloadFileName(response),
  }
}

