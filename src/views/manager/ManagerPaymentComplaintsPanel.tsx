import { managerDisplayError } from './managerPresentation'
import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { formatVndAmount } from '../../i18n/currency'
import type { PaymentComplaint } from '../../services/customerReservationApi'
import { decideManagerPaymentComplaint, downloadComplaintImage, getManagerPaymentComplaint, listManagerPaymentComplaints } from '../../services/managerPaymentComplaintApi'

const labels = { PENDING: 'Đang chờ xử lý', REVIEW_OVERDUE: 'Quá hạn xử lý', APPROVED: 'Đã chấp thuận', REJECTED: 'Đã từ chối', WITHDRAWN: 'Đã rút' }

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
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await listManagerPaymentComplaints()
      setItems(res.data)
      const count = res.data?.filter(item => item.status === 'PENDING' || item.status === 'REVIEW_OVERDUE').length ?? 0
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
      {loading ? <p className="p-8 text-center text-sm text-stone-500">Đang tải khiếu nại…</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-stone-500">Không có khiếu nại thanh toán đang chờ xử lý.</p> : <div className="divide-y divide-stone-200">{items.map(item => <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center"><div><p className="font-bold text-stone-900">{item.reservationCode}</p><p className="text-xs text-stone-500">Gửi lúc {new Date(item.submittedAt).toLocaleString('vi-VN')}</p></div><div><Badge variant={item.status === 'REVIEW_OVERDUE' ? 'error' : 'warning'}>{labels[item.status]}</Badge><p className="mt-1 line-clamp-2 text-sm text-stone-700">{item.reason}</p></div><Button size="sm" onClick={() => void open(item.id)}>Xem và xử lý</Button></div>)}</div>}
    </Card>
    <Modal open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null) }} title="Đối soát khiếu nại thanh toán">
      {selected && <div className="space-y-4 text-sm">
        <div className="rounded-lg bg-stone-50 p-3 space-y-1"><p>Đơn giữ kho: <b>{selected.reservationCode}</b></p><p>Tiền cọc cần đối soát: <b>{formatVndAmount(selected.depositAmount || 0)}</b></p><p>Trạng thái: <b>{labels[selected.status]}</b></p><p>Hạn xử lý: <b>{new Date(selected.reviewDueAt).toLocaleString('vi-VN')}</b></p></div>
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
                  onClick={() => { if (url) setPreviewImage({ url, name: image.originalName }) }}
                  className={`flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-2.5 transition ${
                    url ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 shadow-sm' : ''
                  }`}
                  title={url ? 'Bấm để phóng to ảnh chứng từ' : undefined}
                >
                  {url ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
                      <img src={url} alt={image.originalName} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 hover:opacity-100 transition">
                        <span className="text-[10px] font-bold text-white">Xem</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-stone-200 bg-stone-100 text-stone-400">
                      🖼️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900 truncate">{image.originalName}</p>
                    <p className="text-xs text-stone-500">{image.contentType} · {(image.sizeBytes / 1024).toFixed(1)} KB</p>
                    {url && <span className="text-[11px] font-semibold text-amber-700 hover:underline">🔍 Bấm để xem ảnh phóng to</span>}
                  </div>
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
    <Modal open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} title={previewImage?.name || 'Chứng từ đính kèm'}>
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
