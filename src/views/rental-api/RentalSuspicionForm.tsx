import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import VietnameseDateTimeField from '../../components/VietnameseDateTimeField'
import { apiRequest } from '../../services/apiClient'
import { rentalError } from './presentation'

function localObservationTime() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date()).replace(' ', 'T')
}

export default function RentalSuspicionForm({ rentalId, role = 'staff', onSubmitted }: {
  rentalId: string
  role?: 'staff' | 'manager'
  onSubmitted?: (reportId: string) => void
}) {
  const [detectedAt, setDetectedAt] = useState(localObservationTime)
  const [requestId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState('')
  const fieldClass = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    const field = (name: string) => String(values.get(name) ?? '').trim()
    const observationTime = new Date(detectedAt + ':00+07:00')
    if (!Number.isFinite(observationTime.getTime()) || observationTime.getTime() > Date.now()) {
      setError('Vui lòng nhập thời gian phát hiện hợp lệ, không sau thời điểm hiện tại.')
      return
    }
    if (!field('description')) {
      setError('Vui lòng mô tả dấu hiệu đã quan sát hoặc được báo.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const response = await apiRequest<{ data: { id: string; code: string } }>(`/api/${role}/rentals/${rentalId}/suspicion-reports`, {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          detectedAt: observationTime.toISOString(),
          description: field('description'),
        }),
      })
      setReceipt(response.data.code)
      window.dispatchEvent(new Event('storagehub:notifications-refresh'))
      onSubmitted?.(response.data.id)
    } catch (failure) {
      setError(rentalError(failure))
    } finally {
      setBusy(false)
    }
  }

  if (receipt) return <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
    Đã lưu báo cáo <strong>{receipt}</strong>. Chờ quản lý cơ sở tiếp nhận.
  </p>

  return <form id="rental-suspicion-form" onSubmit={submit} className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
    <p className="mb-3 text-sm text-stone-600">Ghi những gì bạn quan sát được hoặc được báo để quản lý xác minh.</p>
    <fieldset disabled={busy} className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <VietnameseDateTimeField label="Thời gian phát hiện (giờ Việt Nam)" value={detectedAt}
          onChange={setDetectedAt} maxDateTime={localObservationTime()} disabled={busy} />
      </div>
      <label className="sm:col-span-2">Mô tả dấu hiệu
        <textarea className={fieldClass} name="description" required maxLength={1200} rows={3} />
      </label>
      {error && <p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</Button>
      </div>
    </fieldset>
  </form>
}
