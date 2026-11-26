import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiRequest, hasAccessToken } from '../services/apiClient'
import { getAuthenticatedActor } from '../services/authApi'
import { forgetProcessingLease, getProcessingLease, invalidateProcessing, notifyProcessing, putProcessingLease, subscribeProcessing, watchProcessingView, type LocalProcessingLease, type ProcessingTarget, type ProcessingView } from '../services/processingLeaseState'

interface Props { target: ProcessingTarget; id: string; enabled?: boolean; onAcquired?: () => void | Promise<void>; children: ReactNode }

export default function ProcessingLeaseBoundary({ target, id, enabled = true, onAcquired, children }: Props) {
  const active = enabled && hasAccessToken()
  const actor = getAuthenticatedActor()
  const actorId = actor?.id
  const canForceRelease = Boolean(actor?.roles?.some(role => ['MANAGER', 'BUSINESS', 'ADMIN'].includes(role)))
  const [view, setView] = useState<ProcessingView | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(active)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [, render] = useState(0)
  const state = useRef<{ token: string; lease?: LocalProcessingLease; stopped: boolean } | null>(null)
  const lastActivity = useRef(Date.now())
  const [idle, setIdle] = useState(false)
  const draftKey = `storagehub:processing-draft:${target}:${id}`
  const markActivity = () => {
    lastActivity.current = Date.now()
    if (idle) setIdle(false)
  }
  const acquired = useRef(onAcquired)
  acquired.current = onAcquired
  const readyRef = useRef(ready)
  readyRef.current = ready
  const url = '/api/processing-locks/' + target + '/' + id

  useEffect(() => subscribeProcessing(() => render(n => n + 1)), [])
  useEffect(() => {
    const refresh = () => render(n => n + 1)
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])
  useEffect(() => {
    if (!active) return
    const current = { token: crypto.randomUUID(), stopped: false } as NonNullable<typeof state.current>
    const unwatch = watchProcessingView(target, id)
    let retries = 0
    let retryTimer: number | undefined
    state.current = current
    setView(null); setReady(false); setError(''); setPending(true)
    const acquire = async () => {
      // A same-operator lease that is about to be reclaimed must not be announced as
      // "someone else is processing". Keep the pending state until the retry settles.
      let awaitingRetry = false
      try {
        const result = (await apiRequest<{ data: ProcessingView }>(url + '/acquire', { method: 'POST', body: JSON.stringify({ token: current.token }) })).data
        if (current.stopped) {
          if (result.owned) void apiRequest(url + '/release', { method: 'POST', body: JSON.stringify({ token: current.token }) }).catch(() => {})
          return
        }
        setView(result)
        if (!result.owned && result.ownerId === actorId && retries++ < 2) {
          // StrictMode cleanup may still be releasing the previous mount's distinct token.
          awaitingRetry = true
          retryTimer = window.setTimeout(() => { if (!current.stopped) void acquire() }, 1000)
        }
        if (result.owned) {
          current.lease = { target, id, token: current.token, view: result, invalid: false, inFlight: false, ready: false }
          putProcessingLease(current.lease)
          if (current.stopped) return
          // Confirm the data still matches before loading the form. Loading it first meant the
          // form read stale data and then reported a change on top of it.
          const observed = (await apiRequest<{ data: ProcessingView }>(url, { headers: { 'X-Processing-Token': current.token } })).data
          if (!observed.owned || observed.revision !== result.revision || observed.sourceStamp !== result.sourceStamp)
            throw new Error('Hồ sơ vừa thay đổi trong lúc tải. Đóng và mở lại hồ sơ để lấy dữ liệu mới.')
          await acquired.current?.()
          if (!current.stopped) { current.lease.ready = true; notifyProcessing(); setReady(true) }
        }
      } catch (failure) {
        if (!current.stopped) { setError(failure instanceof Error ? failure.message : 'Không thể nhận quyền xử lý hồ sơ.'); setReady(false); if (current.lease) invalidateProcessing(current.lease) }
      } finally { if (!current.stopped && !awaitingRetry) setPending(false) }
    }
    const renew = async () => {
      if (current.stopped || document.hidden || !current.lease || current.lease.invalid || !readyRef.current) return
      if (Date.now() - lastActivity.current > 10 * 60_000) { setIdle(true); return }
      try {
        const result = (await apiRequest<{ data: ProcessingView }>(url + '/heartbeat', { method: 'POST', body: JSON.stringify({ token: current.token }) })).data
        if (current.stopped) return
        if (current.lease.invalid || current.lease.inFlight || result.revision < current.lease.view.revision) return
        if (result.revision !== current.lease.view.revision || result.sourceStamp !== current.lease.view.sourceStamp) {
          invalidateProcessing(current.lease); setReady(false); setError('Hồ sơ đã thay đổi. Đóng và mở lại hồ sơ để tải dữ liệu mới.'); return
        }
        current.lease.view = result; setView(result); notifyProcessing()
      } catch (failure) {
        if (!current.stopped) {
          if (current.lease) invalidateProcessing(current.lease)
          setReady(false)
          setError(failure instanceof Error ? failure.message : 'Mất kết nối, đã tạm khóa thao tác.')
          try {
            const latest = (await apiRequest<{ data: ProcessingView }>(url, { headers: { 'X-Processing-Token': current.token } })).data
            if (!current.stopped) setView(latest)
          } catch { /* The existing view remains read-only when the server is unreachable. */ }
        }
      }
    }
    const onVisibility = () => { if (!document.hidden) { markActivity(); void renew() } }
    const onActivity = () => markActivity()
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('pointerdown', onActivity, true)
    document.addEventListener('keydown', onActivity, true)
    document.addEventListener('input', onActivity, true)
    void acquire()
    const poll = window.setInterval(async () => {
      if (current.stopped || document.hidden || current.lease?.inFlight) return
      if (current.lease && !current.lease.invalid && readyRef.current) {
        void renew()
      } else {
        try {
          const result = (await apiRequest<{ data: ProcessingView }>(url, { headers: { 'X-Processing-Token': current.token } })).data
          if (!current.stopped) setView(result)
        } catch (failure) {
          if (!current.stopped) setError(failure instanceof Error ? failure.message : 'Mất kết nối, đã tạm khóa thao tác.')
        }
      }
    }, 30000)
    return () => {
      current.stopped = true
      window.clearInterval(poll)
      window.clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('pointerdown', onActivity, true)
      document.removeEventListener('keydown', onActivity, true)
      document.removeEventListener('input', onActivity, true)
      unwatch()
      forgetProcessingLease(target, id, current.token)
      // A write already in flight owns the DB lock. Release is serialized behind it.
      if (current.lease) void apiRequest(url + '/release', { method: 'POST', body: JSON.stringify({ token: current.token }), keepalive: true }).catch(() => {})
    }
  }, [active, target, id, actorId, url, attempt])

  const lease = getProcessingLease(target, id)
  const owned = active && ready && !!lease && lease.token === state.current?.token && !lease.invalid && !!lease.view.expiresAt && Date.parse(lease.view.expiresAt) > Date.now()
  const release = async () => {
    const current = state.current
    if (!current || current.lease?.inFlight) return
    setPending(true); setReady(false)
    try {
      const result = (await apiRequest<{ data: ProcessingView }>(url + '/release', { method: 'POST', body: JSON.stringify({ token: current.token }) })).data
      if (current.lease) invalidateProcessing(current.lease)
      forgetProcessingLease(target, id, current.token)
      current.lease = undefined
      setView(result); setError('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa thể nhường quyền xử lý.'); if (current.lease) invalidateProcessing(current.lease) }
    finally { setPending(false) }
  }
  const forceRelease = async () => {
    setPending(true); setError('')
    try {
      const result = (await apiRequest<{ data: ProcessingView }>(url + '/force-release', { method: 'POST' })).data
      setView(result); setReady(false); setAttempt(n => n + 1)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa thể gỡ khóa cưỡng chế.')
    } finally { setPending(false) }
  }
  if (!active) return <>{children}</>
  return <div className="space-y-3">
    <div role="status" className={`rounded-xl border p-3 text-sm ${owned ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{pending ? 'Đang kiểm tra quyền xử lý hồ sơ…' : owned ? 'Bạn đang giữ quyền xử lý hồ sơ này.' : view?.occupied && view.ownerId === actorId ? 'Bạn đang mở hồ sơ này ở tab khác. Tab hiện tại chỉ được xem.' : view?.occupied ? `Hồ sơ đang được ${view.ownerName || 'nhân sự khác'} xử lý. Bạn chỉ có thể xem.` : 'Bạn đang xem hồ sơ. Nhận xử lý trước khi chỉnh sửa.'}</p>
        {owned ? <button type="button" disabled={pending || lease?.inFlight} onClick={() => void release()} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Nhường xử lý</button>
          : <div className="flex flex-wrap gap-2"><button type="button" disabled={pending || !!view?.occupied} onClick={() => setAttempt(n => n + 1)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Nhận xử lý / tải lại</button>{canForceRelease && view?.occupied && <button type="button" disabled={pending} onClick={() => void forceRelease()} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 disabled:opacity-50">Gỡ khóa cưỡng chế</button>}</div>}
      </div>
      {view?.expiresAt && <p className="mt-1 text-xs">Quyền xử lý được gia hạn khi màn hình đang hoạt động; tự hết hạn sau 2 phút mất kết nối và tối đa 15 phút mỗi lượt. {idle && 'Đã tạm dừng gia hạn do không có thao tác trong 10 phút.'}</p>}
      {(error || lease?.invalid) && <p className="mt-1 text-xs font-semibold">{error || 'Phiên xử lý đã thay đổi. Đóng và mở lại hồ sơ trước khi tiếp tục.'}</p>}
    </div>
    <fieldset disabled={!owned} onInputCapture={event => {
      try {
        const fields = Array.from((event.currentTarget as HTMLElement).querySelectorAll('input,textarea,select')).map((field, index) => {
          const control = field as HTMLInputElement
          return { index, value: control.value, checked: control.type === 'checkbox' || control.type === 'radio' ? control.checked : undefined }
        })
        sessionStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), fields }))
      } catch {}
      markActivity()
    }} className="min-w-0 border-0 p-0 disabled:opacity-75">{children}</fieldset>
  </div>
}
