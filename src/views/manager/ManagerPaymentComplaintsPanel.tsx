import { managerDisplayError } from './managerPresentation'
import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import type { PaymentComplaint } from '../../services/customerReservationApi'
import { decideManagerPaymentComplaint, getManagerPaymentComplaint, listManagerPaymentComplaints } from '../../services/managerPaymentComplaintApi'

const labels = { PENDING: 'Đang chờ xử lý', REVIEW_OVERDUE: 'Quá hạn xử lý', APPROVED: 'Đã chấp thuận', REJECTED: 'Đã từ chối', WITHDRAWN: 'Đã rút' }

export default function ManagerPaymentComplaintsPanel({ showToast }: { showToast: (message: string) => void }) {
  const [items, setItems] = useState<PaymentComplaint[]>([])
  const [selected, setSelected] = useState<PaymentComplaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems((await listManagerPaymentComplaints()).data) }
    catch (cause) { setError(managerDisplayError(cause)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const open = async (id: string) => {
    setError(null)
    try { setSelected(await getManagerPaymentComplaint(id)); setReason('') }
    catch (cause) { setError(managerDisplayError(cause)) }
  }

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selected || busy || (decision === 'REJECT' && !reason.trim())) return
    setBusy(true); setError(null)
    try {
      await decideManagerPaymentComplaint(selected.id, decision, reason)
      setSelected(null)
      showToast(decision === 'APPROVE' ? 'Đã chấp thuận và ghi nhận thanh toán.' : 'Đã từ chối khiếu nại thanh toán.')
      await load()
    } catch (cause) { setError(managerDisplayError(cause)) }
    finally { setBusy(false) }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Tài chính</p><h1 className="text-2xl font-bold text-stone-900">Khiếu nại thanh toán</h1><p className="mt-1 text-sm text-stone-500">Đối soát giao dịch chưa được ghi nhận tại cơ sở bạn quản lý.</p></div></div>
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <Card className="overflow-hidden">
      {loading ? <p className="p-8 text-center text-sm text-stone-500">Đang tải khiếu nại…</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-stone-500">Không có khiếu nại thanh toán đang chờ xử lý.</p> : <div className="divide-y divide-stone-200">{items.map(item => <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center"><div><p className="font-bold text-stone-900">{item.reservationCode}</p><p className="text-xs text-stone-500">Gửi lúc {new Date(item.submittedAt).toLocaleString('vi-VN')}</p></div><div><Badge variant={item.status === 'REVIEW_OVERDUE' ? 'error' : 'warning'}>{labels[item.status]}</Badge><p className="mt-1 line-clamp-2 text-sm text-stone-700">{item.reason}</p></div><Button size="sm" onClick={() => void open(item.id)}>Xem và xử lý</Button></div>)}</div>}
    </Card>
    <Modal open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null) }} title="Đối soát khiếu nại thanh toán">
      {selected && <div className="space-y-4 text-sm">
        <div className="rounded-lg bg-stone-50 p-3 space-y-1"><p>Đơn giữ kho: <b>{selected.reservationCode}</b></p><p>Tiền cọc cần đối soát: <b>{formatVnd(selected.depositAmount || 0)}</b></p><p>Trạng thái: <b>{labels[selected.status]}</b></p><p>Hạn xử lý: <b>{new Date(selected.reviewDueAt).toLocaleString('vi-VN')}</b></p></div>
        <div><p className="font-bold">Lý do khách hàng</p><p className="mt-1 rounded-lg border border-stone-200 p-3">{selected.reason}</p></div>
        <div><p className="font-bold">Chứng từ đính kèm</p><div className="mt-2 space-y-2">{selected.images?.map(image => <div key={image.id} className="rounded-lg border border-stone-200 p-3"><p className="font-medium">{image.originalName}</p><p className="text-xs text-stone-500">{image.contentType} · {(image.sizeBytes / 1024).toFixed(1)} KB</p></div>)}{!selected.images?.length && <p className="text-stone-500">Không có chứng từ.</p>}</div></div>
        <label className="block font-bold">Ghi chú xử lý<textarea className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 p-3 font-normal" value={reason} onChange={event => setReason(event.target.value)} placeholder="Bắt buộc khi từ chối, không bắt buộc khi chấp thuận" maxLength={2000} /></label>
        {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2"><Button variant="danger" disabled={busy || !reason.trim()} onClick={() => void decide('REJECT')}>Từ chối khiếu nại</Button><Button disabled={busy} onClick={() => void decide('APPROVE')}>{busy ? 'Đang xử lý…' : 'Chấp thuận thanh toán'}</Button></div>
      </div>}
    </Modal>
  </div>
}
