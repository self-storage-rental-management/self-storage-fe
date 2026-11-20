import { useEffect, useState } from 'react'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { ApiClientError } from '../../services/apiClient'
import {
  listBusinessFacilityLifecycleRequests,
  reviewBusinessFacilityLifecycleRequest,
  type FacilityLifecycleChangeRequest,
} from '../../services/facilityLifecycleApi'

const statusLabel = (status: FacilityLifecycleChangeRequest['requestedStatus']) =>
  status === 'maintenance' ? 'Tạm ngưng nhận đơn mới' : 'Đề nghị ngừng hoạt động'

const requestStatusLabel = (status: FacilityLifecycleChangeRequest['status']) => ({
  PENDING: 'Chờ BO xử lý',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
}[status])

const formatError = (error: unknown) => error instanceof ApiClientError || error instanceof Error
  ? error.message
  : 'Không thể xử lý yêu cầu.'

export default function BusinessFacilityLifecycleRequests() {
  const [requests, setRequests] = useState<FacilityLifecycleChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string>()
  const [review, setReview] = useState<{ item: FacilityLifecycleChangeRequest; approved: boolean }>()
  const [reason, setReason] = useState('')
  const [reviewError, setReviewError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await listBusinessFacilityLifecycleRequests())
    } catch (cause) {
      setError(formatError(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async () => {
    if (!review) return
    setBusyId(review.item.id)
    setReviewError('')
    try {
      const updated = await reviewBusinessFacilityLifecycleRequest(review.item.id, review.approved, reason)
      setRequests(current => current.map(item => item.id === updated.id ? updated : item))
      window.dispatchEvent(new Event('storagehub:facilities-refresh'))
      setReview(undefined)
      setReason('')
    } catch (cause) {
      setReviewError(formatError(cause))
      await load()
    } finally {
      setBusyId(undefined)
    }
  }

  return <Card className="mb-5 border-amber-200 bg-amber-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-bold text-stone-900">Yêu cầu thay đổi trạng thái cơ sở</h2>
        <p className="mt-1 text-xs text-stone-600">BO duyệt việc tạm ngưng nhận đơn mới hoặc ngừng hoạt động. Hệ thống kiểm tra lại số liệu ngay lúc duyệt.</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>{loading ? 'Đang tải' : 'Tải lại'}</Button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!loading && !requests.length && <p className="mt-4 text-sm text-stone-600">Chưa có yêu cầu thay đổi trạng thái cơ sở.</p>}
    <div className="mt-4 space-y-3">
      {requests.map(item => <div key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-stone-900">{item.facilityName}</p>
            <p className="mt-1 text-xs text-stone-500">{statusLabel(item.requestedStatus)} · Người gửi: {item.requesterName}</p>
          </div>
          <Badge variant={item.status === 'PENDING' ? 'warning' : item.status === 'APPROVED' ? 'success' : 'muted'}>{requestStatusLabel(item.status)}</Badge>
        </div>
        {item.reason && <p className="mt-3 text-sm text-stone-700">{item.reason}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Đơn giữ kho chờ', item.summary.pendingHoldCount],
            ['Đơn đặt kho xử lý', item.summary.processingReservationCount],
            ['Hợp đồng hiệu lực', item.summary.activeContractCount],
            ['Thanh toán tồn đọng', item.summary.outstandingPaymentCount],
            ['Hoàn tiền tồn đọng', item.summary.outstandingRefundCount],
          ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-stone-50 px-3 py-2">
            <p className="text-[11px] text-stone-500">{label}</p>
            <p className="font-bold text-stone-900">{Number(value).toLocaleString('vi-VN')}</p>
          </div>)}
        </div>
        {item.status === 'PENDING' && <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => { setReview({ item, approved: false }); setReason(''); setReviewError('') }}>Từ chối</Button>
          <Button size="sm" disabled={busyId === item.id} onClick={() => { setReview({ item, approved: true }); setReason(''); setReviewError('') }}>Duyệt</Button>
        </div>}
        {item.rejectionReason && <p className="mt-3 text-xs text-red-700">Lý do từ chối: {item.rejectionReason}</p>}
      </div>)}
    </div>

    <Modal open={Boolean(review)} onClose={() => busyId ? undefined : setReview(undefined)} title={review?.approved ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}>
      {review && <div className="space-y-4">
        <p className="text-sm text-stone-700">{review.approved ? 'Hệ thống sẽ kiểm tra lại toàn bộ số liệu trước khi cập nhật trạng thái cơ sở.' : 'Nhập lý do để Quản lý cơ sở biết nội dung cần điều chỉnh.'}</p>
        {reviewError && <p role="alert" className="text-sm text-red-700">{reviewError}</p>}
        <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" placeholder={review.approved ? 'Ghi chú duyệt nếu cần' : 'Lý do từ chối'} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={Boolean(busyId)} onClick={() => setReview(undefined)}>Hủy</Button>
          <Button disabled={Boolean(busyId) || (!review.approved && !reason.trim())} onClick={() => void submit()}>{busyId ? 'Đang xử lý' : review.approved ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</Button>
        </div>
      </div>}
    </Modal>
  </Card>
}
