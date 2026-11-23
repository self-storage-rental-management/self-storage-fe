import { useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient'
import { uploadCheckInEvidence } from '../services/checkInApi'

interface State {
  setupDeadlineAt?: string | null
  setupExtensionDays?: number | null
  setupExtensionCount?: number | null
  readyAt?: string | null
  appointmentAt?: string | null
  arrivedAt?: string | null
  identityVerifiedAt?: string | null
  inventoryDeadlineAt?: string | null
  remainderDeadlineAt?: string | null
  resultConfirmationDueAt?: string | null
  history: Array<{ action: string; time: string; after?: string; reason?: string }>
}
const show = (s?: string | null) => s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận'

export default function IntakeWorkflowPanel({ reservationId, role, checkInId }: {
  reservationId: string; role: 'CUSTOMER' | 'STAFF' | 'MANAGER'; checkInId?: string | null
}) {
  const [state, setState] = useState<State | null>(null)
  const [at, setAt] = useState('')
  const [reason, setReason] = useState('')
  const [extensionDays, setExtensionDays] = useState('')
  const [document, setDocument] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const url = `/api/intake-workflow/reservations/${encodeURIComponent(reservationId)}`
  useEffect(() => {
    let active = true
    const load = () => apiRequest<{ data: State }>(url).then(r => { if (active) setState(old => JSON.stringify(old) === JSON.stringify(r.data) ? old : r.data) }).catch(() => {})
    void load()
    const timer = window.setInterval(() => { setNow(Date.now()); void load() }, 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [url])
  const change = async (action: string) => {
    setBusy(true); setError('')
    try {
      let photoId: string | undefined
      if (action === 'VERIFY') {
        if (!photo || !checkInId) throw new Error('Thiếu ảnh kiểm kê')
        photoId = (await uploadCheckInEvidence(checkInId, photo)).id
      }
      const needsDate = ['EXTEND_SETUP', 'APPOINTMENT', 'FACILITY_EXTENSION'].includes(action)
      if (needsDate && !at) throw new Error('Thiếu lịch')
      const result = await apiRequest<{ data: State }>(url, { method: 'POST', body: JSON.stringify({
        action, at: needsDate ? new Date(`${at}:00+07:00`).toISOString() : undefined, reason, documentNumber: document, photoId, extensionDays: extensionDays ? Number(extensionDays) : undefined,
      }) })
      setState(result.data)
    } catch {
      setError('Chưa thể cập nhật. Vui lòng kiểm tra thời hạn, số lượt còn lại, lịch hẹn và thông tin xác minh.')
    } finally { setBusy(false) }
  }
  if (!state) return null
  const deadline = !state.readyAt ? state.setupDeadlineAt : state.remainderDeadlineAt || state.resultConfirmationDueAt || (!state.arrivedAt ? state.inventoryDeadlineAt : null)
  const remaining = deadline ? Date.parse(deadline) - now : null
  const button = (action: string, label: string, disabled = false) => <button type="button" disabled={busy || disabled} onClick={() => void change(action)} className="rounded border border-stone-400 bg-white px-3 py-2 text-sm disabled:opacity-50">{label}</button>
  return <section className={`space-y-3 rounded-xl border p-4 text-left text-sm ${remaining != null && remaining < 86_400_000 ? 'border-red-400 bg-red-50 text-red-950' : 'border-stone-300 bg-stone-50'}`}>
    <h4 className="font-bold">Setup và lịch kiểm kê</h4>
    {deadline && <p className="font-semibold">Hạn: {show(deadline)} · {remaining! <= 0 ? 'Đã quá hạn' : `Còn ${Math.ceil(remaining! / 3_600_000)} giờ`}</p>}
    {!state.readyAt && <p>Đã dời {state.setupExtensionCount ?? 0}/2 lần. Mỗi lần tối đa {state.setupExtensionDays ?? 'chưa cấu hình'} ngày. Không cộng thời gian miễn phí.</p>}
    <p>Lịch kiểm kê: {show(state.appointmentAt)}</p>
    {state.resultConfirmationDueAt && <p>Vui lòng xác nhận hoặc gửi ý kiến về kết quả trong 48 giờ. Quá hạn không tự động xác nhận thay bạn.</p>}
    {role === 'MANAGER' && state.setupExtensionDays == null && !state.readyAt && <label className="block">Số ngày tối đa mỗi lần dời hạn<input className="ml-2 rounded border p-2" type="number" min="1" step="1" value={extensionDays} onChange={e => setExtensionDays(e.target.value)} /></label>}
    {state.readyAt && <p>Khách đến: {show(state.arrivedAt)} · Xác minh: {show(state.identityVerifiedAt)}</p>}
    {(role === 'MANAGER' || role === 'CUSTOMER') && <label className="block">Ngày giờ mới theo giờ Việt Nam<input className="mt-1 block rounded border p-2" type="datetime-local" value={at} onChange={e => setAt(e.target.value)} /></label>}
    {role === 'CUSTOMER' && <div className="flex flex-wrap gap-2">{!state.readyAt && button('EXTEND_SETUP', 'Dời hạn setup', (state.setupExtensionCount ?? 0) >= 2 || !state.setupDeadlineAt)}{state.readyAt && !state.arrivedAt && button('APPOINTMENT', 'Lưu lịch kiểm kê')}</div>}
    {role === 'STAFF' && state.readyAt && <div className="space-y-2">
      {!state.arrivedAt && button('ARRIVAL', 'Ghi nhận khách đã đến')}
      {state.arrivedAt && !state.identityVerifiedAt && <><label className="block">CCCD hoặc hộ chiếu<input className="ml-2 rounded border p-2" value={document} onChange={e => setDocument(e.target.value)} /></label><label className="block">Ảnh tại buổi kiểm kê<input type="file" accept="image/*" capture="user" onChange={e => setPhoto(e.target.files?.[0] || null)} /></label>{button('VERIFY', 'Xác minh chính chủ')}</>}
    </div>}
    {role !== 'CUSTOMER' && <div className="flex flex-wrap gap-2">{button('REMIND', 'Nhắc khách')}{role === 'MANAGER' && <><input aria-label="Lý do điều chỉnh do cơ sở" className="rounded border p-2" placeholder="Lý do điều chỉnh do cơ sở" value={reason} onChange={e => setReason(e.target.value)} />{button('FACILITY_EXTENSION', 'Điều chỉnh hạn do cơ sở')}</>}</div>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
    <details><summary>Lịch sử xử lý</summary>{state.history.map((h, i) => <p key={i}>{show(h.time)} · {h.action === 'APPOINTMENT' ? 'Cập nhật lịch kiểm kê' : h.action === 'EXTEND_SETUP' ? 'Dời hạn setup' : h.action === 'VERIFY' ? 'Xác minh chính chủ' : h.action === 'ARRIVAL' ? 'Khách đã đến' : h.action === 'FACILITY_EXTENSION' ? 'Điều chỉnh do cơ sở' : 'Gửi nhắc'}{h.after ? ` · ${show(h.after)}` : ''}{h.reason ? ` · ${h.reason}` : ''}</p>)}</details>
  </section>
}
