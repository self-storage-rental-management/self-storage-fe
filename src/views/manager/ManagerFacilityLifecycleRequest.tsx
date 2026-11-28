import { useEffect, useState } from 'react'
import { Button, Card } from '../../components/ui'
import { ApiClientError } from '../../services/apiClient'
import {
  getManagerFacilityLifecycleSummary,
  requestManagerFacilityLifecycle,
  type FacilityLifecycleSummary,
} from '../../services/facilityLifecycleApi'
import { managerDisplayError } from './managerPresentation'

const number = (value: number) => value.toLocaleString('vi-VN')

export default function ManagerFacilityLifecycleRequest({
  facilityId,
  facilityName,
}: {
  facilityId: string
  facilityName: string
}) {
  const [summary, setSummary] = useState<FacilityLifecycleSummary>()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    setError('')
    try {
      setSummary(await getManagerFacilityLifecycleSummary(facilityId))
    } catch (cause) {
      setError(cause instanceof ApiClientError ? managerDisplayError(cause) : 'Chưa tải được thông tin vòng đời cơ sở.')
    }
  }

  useEffect(() => {
    void load()
  }, [facilityId])

  const submit = async (requestedStatus: 'maintenance' | 'inactive') => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await requestManagerFacilityLifecycle(facilityId, requestedStatus, reason)
      setNotice(requestedStatus === 'maintenance'
        ? 'Đã gửi yêu cầu tạm ngưng nhận đơn mới cho BO.'
        : 'Đã gửi yêu cầu ngừng hoạt động cho BO xem xét.')
      setReason('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu thay đổi trạng thái cơ sở.')
    } finally {
      setBusy(false)
    }
  }

  return <Card className="border-purple-200 bg-purple-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-bold text-stone-900">Trạng thái hoạt động cơ sở</h2>
        <p className="mt-1 text-xs text-stone-600">Gửi yêu cầu cho BO đối với {facilityName}. Dữ liệu giao dịch và lịch sử vẫn được giữ nguyên.</p>
      </div>
      {summary && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700">{summary.status === 'active' ? 'Đang hoạt động' : summary.status === 'maintenance' ? 'Đang bảo trì' : summary.status === 'inactive' ? 'Đã ngừng hoạt động' : 'Đang thiết lập'}</span>}
    </div>

    {summary && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {[
        ['Đơn giữ kho chờ', summary.pendingHoldCount],
        ['Đơn đặt kho xử lý', summary.processingReservationCount],
        ['Hợp đồng hiệu lực', summary.activeContractCount],
        ['Thanh toán tồn đọng', summary.outstandingPaymentCount],
        ['Hoàn tiền tồn đọng', summary.outstandingRefundCount],
      ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-stone-200 bg-white p-3">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="mt-1 text-lg font-bold text-stone-900">{number(Number(value))}</p>
      </div>)}
    </div>}

    <label className="mt-4 block text-sm font-medium text-stone-700">
      Lý do đề nghị
      <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" placeholder="Nêu ngắn gọn lý do tạm ngưng hoặc bảo trì" />
    </label>

    {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <Button variant="outline" disabled={busy || !summary || summary.status === 'inactive'} onClick={() => void submit('maintenance')}>
        {busy ? 'Đang gửi' : 'Tạm ngưng nhận đơn mới'}
      </Button>
      <Button disabled={busy || !summary || summary.status === 'inactive'} onClick={() => void submit('inactive')}>
        {busy ? 'Đang gửi' : 'Đề nghị ngừng hoạt động'}
      </Button>
    </div>
  </Card>
}
