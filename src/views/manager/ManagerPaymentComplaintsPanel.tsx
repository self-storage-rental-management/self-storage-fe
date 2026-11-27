import { managerDisplayError } from './managerPresentation'
import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { formatVndAmount } from '../../i18n/currency'
import type { PaymentComplaint } from '../../services/customerReservationApi'
import {
  decideManagerPaymentComplaint,
  downloadComplaintImage,
  getManagerPaymentComplaint,
  listManagerPaymentComplaints,
  queryManagerPaymentComplaintVnpay,
} from '../../services/managerPaymentComplaintApi'

const labels = { PENDING: 'Đang chờ xử lý', REVIEW_OVERDUE: 'Quá hạn xử lý', APPROVED: 'Đã chấp thuận', REJECTED: 'Đã từ chối', WITHDRAWN: 'Đã rút' }
const queryConclusionMeta: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'muted' }> = {
  DEMO_PAID_CONFIRMED: { label: 'Đủ căn cứ xác nhận — MÔ PHỎNG (00)', variant: 'success' },
  PAID_CONFIRMED: { label: 'VNPAY xác nhận đã thanh toán (00)', variant: 'success' },
  INCOMPLETE: { label: 'Giao dịch chưa hoàn tất (01)', variant: 'warning' },
  FAILED: { label: 'Giao dịch lỗi trên VNPAY (02)', variant: 'error' },
  REVERSED: { label: 'Giao dịch đảo / tra soát (04)', variant: 'warning' },
  NOT_FOUND: { label: 'Không tìm thấy trên VNPAY (91)', variant: 'muted' },
  INVALID_SIGNATURE: { label: 'Dữ liệu xác minh không khớp', variant: 'error' },
  UNAVAILABLE: { label: 'Chưa đủ căn cứ xác nhận thanh toán', variant: 'warning' },
}

export default function ManagerPaymentComplaintsPanel({
  showToast,
  hideHeader,
  onCountChange
}: {
  showToast: (message: string) => void
  hideHeader?: boolean
  onCountChange?: (count: number) => void
}) {
  const [items, setItems] = useState<PaymentComplaint[]>([])
  const [selected, setSelected] = useState<PaymentComplaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loadingImages, setLoadingImages] = useState(false)
  const [queryingVnpay, setQueryingVnpay] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await listManagerPaymentComplaints()
      const sorted = [...(res.data || [])].sort((a, b) => {
        const aOverdue = a.status === 'REVIEW_OVERDUE' ? 0 : 1
        const bOverdue = b.status === 'REVIEW_OVERDUE' ? 0 : 1
        if (aOverdue !== bOverdue) return aOverdue - bOverdue
        return Date.parse(a.reviewDueAt) - Date.parse(b.reviewDueAt)
      })
      setItems(sorted)
      const count = sorted.filter(item => item.status === 'PENDING' || item.status === 'REVIEW_OVERDUE').length
      onCountChange?.(count)
    }
    catch (cause) { setError(managerDisplayError(cause)) }
    finally { setLoading(false) }
  }, [onCountChange])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!selected?.images?.length) {
      setImageUrls({})
      return
    }
    let disposed = false
    const createdUrls: string[] = []
    setLoadingImages(true)

    Promise.all(
      selected.images.map(async img => {
        try {
          const res = await downloadComplaintImage(img.id)
          createdUrls.push(res.url)
          return { id: img.id, url: res.url }
        } catch {
          return { id: img.id, url: null }
        }
      })
    ).then(results => {
      if (disposed) {
        createdUrls.forEach(url => URL.revokeObjectURL(url))
        return
      }
      const map: Record<string, string> = {}
      results.forEach(r => {
        if (r.url) map[r.id] = r.url
      })
      setImageUrls(map)
    }).finally(() => {
      if (!disposed) setLoadingImages(false)
    })

    return () => {
      disposed = true
      createdUrls.forEach(url => URL.revokeObjectURL(url))
      setImageUrls({})
    }
  }, [selected?.id])

  const open = async (id: string) => {
    setError(null)
    try { setSelected(await getManagerPaymentComplaint(id)); setReason('') }
    catch (cause) { setError(managerDisplayError(cause)) }
  }

  const queryVnpay = async () => {
    if (!selected || queryingVnpay || busy) return
    setQueryingVnpay(true); setError(null)
    try {
      const updated = await queryManagerPaymentComplaintVnpay(selected.id)
      setSelected(updated)
      showToast('Đã truy vấn kết quả giao dịch từ VNPAY.')
    } catch (cause) { setError(managerDisplayError(cause)) }
    finally { setQueryingVnpay(false) }
  }

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selected || busy || (decision === 'REJECT' && !reason.trim())) return
    setBusy(true); setError(null)
    try {
      await decideManagerPaymentComplaint(selected.id, decision, reason)
      setSelected(null)
      showToast(decision === 'APPROVE' ? 'Đã chấp thuận và ghi nhận thanh toán.' : 'Đã từ chối khiếu nại thanh toán.')
      window.dispatchEvent(new Event('storagehub:complaints-updated'))
      window.dispatchEvent(new Event('storagehub:notifications-refresh'))
      await load()
    } catch (cause) { setError(managerDisplayError(cause)) }
    finally { setBusy(false) }
  }

  return <div className="space-y-5">
    {!hideHeader && (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Tài chính</p>
          <h1 className="text-2xl font-bold text-stone-900">Khiếu nại thanh toán</h1>
          <p className="mt-1 text-sm text-stone-500">Đối soát giao dịch chưa được ghi nhận tại cơ sở bạn quản lý.</p>
        </div>
      </div>
    )}
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <Card className="overflow-hidden">
      {loading ? <p className="p-8 text-center text-sm text-stone-500">Đang tải khiếu nại…</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-stone-500">Không có khiếu nại thanh toán đang chờ xử lý.</p> : <div className="divide-y divide-stone-200">{items.map(item => {
        const remainingMs = Date.parse(item.reviewDueAt) - Date.now()
        const remainingLabel = remainingMs <= 0
          ? 'Đã quá hạn xử lý'
          : remainingMs < 3_600_000
            ? `Còn ${Math.max(1, Math.ceil(remainingMs / 60_000))} phút`
            : `Còn ${Math.floor(remainingMs / 3_600_000)} giờ ${Math.floor((remainingMs % 3_600_000) / 60_000)} phút`
        return (
          <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
            <div>
              <p className="font-bold text-stone-900">{item.reservationCode}</p>
              <p className="text-xs text-stone-500">Gửi lúc {new Date(item.submittedAt).toLocaleString('vi-VN')}</p>
              <p className={`text-xs font-semibold ${remainingMs <= 1_800_000 ? 'text-red-700' : 'text-amber-700'}`}>
                Hạn xử lý: {new Date(item.reviewDueAt).toLocaleString('vi-VN')} ({remainingLabel})
              </p>
            </div>
            <div>
              <Badge variant={item.status === 'REVIEW_OVERDUE' ? 'error' : remainingMs <= 1_800_000 ? 'error' : 'warning'}>{labels[item.status]}</Badge>
              <p className="mt-1 line-clamp-2 text-sm text-stone-700">{item.reason}</p>
            </div>
            <Button size="sm" onClick={() => void open(item.id)}>Xem và xử lý</Button>
          </div>
        )
      })}</div>}
    </Card>
    <Modal size="xl" open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null) }} title="Đối soát khiếu nại thanh toán">
      {selected && <div className="space-y-4 text-sm">
        <div className="rounded-lg bg-stone-50 p-3 space-y-1">
          <p>Đơn giữ kho: <b>{selected.reservationCode}</b></p>
          <p>Tiền cọc cần đối soát: <b>{formatVndAmount(selected.depositAmount || 0)}</b></p>
          <p>Trạng thái: <b>{labels[selected.status]}</b></p>
          <p>Hạn xử lý: <b>{new Date(selected.reviewDueAt).toLocaleString('vi-VN')}</b></p>
          {selected.gatewayIntentId && <p>Mã tham chiếu VNPAY (vnp_TxnRef): <code className="font-mono text-xs">{selected.gatewayIntentId}</code></p>}
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-stone-900">Đối soát VNPAY</p>
            <Button type="button" size="sm" variant="outline" disabled={queryingVnpay || busy || selected.gatewayQueryConclusion === 'DEMO_PAID_CONFIRMED'} onClick={() => void queryVnpay()}>
              {queryingVnpay ? 'Đang truy vấn VNPAY…' : 'Kiểm tra giao dịch VNPAY'}
            </Button>
          </div>
          {selected.gatewayQueryConclusion ? (() => {
            const meta = queryConclusionMeta[selected.gatewayQueryConclusion] || { label: selected.gatewayQueryConclusion, variant: 'muted' as const }
            const message = selected.gatewayQueryConclusion === 'UNAVAILABLE' && selected.gatewayQueryResponseCode === '99'
              ? 'Lần kiểm tra này chưa xác định được khách đã thanh toán hay chưa. Khách có thể mới mở trang thanh toán rồi thoát, nhưng kết quả này chưa đủ để kết luận. Vui lòng đối chiếu chứng từ khách gửi và thông tin giao dịch trước khi chấp thuận hoặc từ chối khiếu nại.'
              : selected.gatewayQueryMessage
            return (
              <div className="space-y-1.5 rounded border border-stone-200 bg-white p-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  {selected.gatewayQueryCheckedAt && <span className="text-stone-500">Kiểm tra lúc {new Date(selected.gatewayQueryCheckedAt).toLocaleString('vi-VN')}</span>}
                </div>
                {message && <p className="text-stone-800">{message}</p>}
                <div className="grid grid-cols-2 gap-1 text-stone-600 pt-1 border-t border-stone-100">
                  <span>Mã phản hồi: <b>{selected.gatewayQueryResponseCode || '—'}</b></span>
                  <span>Trạng thái GD: <b>{selected.gatewayQueryTransactionStatus || '—'}</b></span>
                  <span>Mã GD VNPAY: <b>{selected.gatewayQueryTransactionNo || '—'}</b></span>
                  <span>Ngày thanh toán: <b>{selected.gatewayQueryPayDate || '—'}</b></span>
                </div>
              </div>
            )
          })() : (
            <p className="text-xs text-stone-600">Chưa truy vấn VNPAY cho khiếu nại này. Bấm nút bên trên để kiểm tra trực tiếp trên VNPAY Sandbox trước khi quyết định.</p>
          )}
        </div>
        <div><p className="font-bold">Lý do khách hàng</p><p className="mt-1 rounded-lg border border-stone-200 p-3">{selected.reason}</p></div>
        <div>
          <p className="font-bold">Chứng từ đính kèm</p>
          <div className="mt-2 space-y-2">
            {loadingImages && <p className="text-xs text-stone-500 italic">Đang tải ảnh chứng từ...</p>}
            {selected.images?.map(image => {
              const url = imageUrls[image.id]
              return (
                <div
                  key={image.id}
                  className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-2.5"
                >
                  {url ? (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
                      <img src={url} alt={image.originalName} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-stone-200 bg-stone-100 text-stone-400">
                      🖼️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900 truncate">{image.originalName}</p>
                    <p className="text-xs text-stone-500">{image.contentType} · {(image.sizeBytes / 1024).toFixed(1)} KB</p>
                  </div>
                  {url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewImage({ url, name: image.originalName })}
                    >
                      Xem
                    </Button>
                  )}
                </div>
              )
            })}
            {!selected.images?.length && <p className="text-stone-500">Không có chứng từ.</p>}
          </div>
        </div>
        <label className="block font-bold">Ghi chú xử lý<textarea className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 p-3 font-normal" value={reason} onChange={event => setReason(event.target.value)} placeholder="Bắt buộc khi từ chối, không bắt buộc khi chấp thuận" maxLength={2000} /></label>
        {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2"><Button variant="danger" disabled={busy || !reason.trim()} onClick={() => void decide('REJECT')}>Từ chối khiếu nại</Button><Button disabled={busy} onClick={() => void decide('APPROVE')}>{busy ? 'Đang xử lý…' : 'Chấp thuận thanh toán'}</Button></div>
      </div>}
    </Modal>
    <Modal size="xl" open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} title={previewImage?.name || 'Chứng từ đính kèm'}>
      {previewImage && (
        <div className="space-y-4">
          <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg bg-stone-950/5 p-2">
            <img src={previewImage.url} alt={previewImage.name} className="max-h-[65vh] w-auto max-w-full rounded object-contain shadow" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs">
            <a href={previewImage.url} download={previewImage.name} target="_blank" rel="noreferrer" className="rounded border border-stone-300 bg-white px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-50">
              Tải ảnh gốc về máy
            </a>
            <Button size="sm" variant="outline" onClick={() => setPreviewImage(null)}>
              Đóng
            </Button>
          </div>
        </div>
      )}
    </Modal>
  </div>
}
