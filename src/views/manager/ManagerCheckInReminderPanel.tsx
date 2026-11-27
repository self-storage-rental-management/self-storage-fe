import { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '../../components/ui'
import { listArrivalReviews, resolveArrivalReview, type PendingArrival, downloadCheckInEvidence, listInventoryRefusals, reviewInventoryRefusal, type InventoryRefusalReview } from '../../services/checkInApi'
import { managerDisplayError } from './managerPresentation'
import { formatManagerDateTime } from './managerList'

export default function ManagerCheckInReminderPanel({ showToast, onCountChange }: { showToast: (message: string) => void; onCountChange?: (count: number | null) => void }) {
  const [reviews, setReviews] = useState<PendingArrival[]>([])
  const [refusals, setRefusals] = useState<InventoryRefusalReview[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const reload = useCallback(async () => {
    try {
      const [arrivals, refusals] = await Promise.all([listArrivalReviews(), listInventoryRefusals()])
      setReviews(arrivals); setRefusals(refusals); setError(null)
      onCountChange?.(arrivals.length + refusals.length)
    } catch (error) { setError(error); onCountChange?.(null) }
  }, [onCountChange])
  useEffect(() => { void reload() }, [reload])
  return <div className="space-y-3">
    {error ? <Card className="p-4"><p>{managerDisplayError(error)}</p><Button onClick={() => void reload()}>Thử lại</Button></Card> : null}
      {refusals.map(({ checkInId, reservationCode, facilityName, submittedAt, report }) => <Card key={checkInId}>
        <div className="space-y-2 p-4">
          <h3 className="font-semibold">Biên bản khách từ chối ký · {reservationCode}</h3>
          <p>{facilityName} · {formatManagerDateTime(submittedAt)}</p>
          <p>Người lập biên bản: {report.staffName} · Nhân chứng: {report.witness.name}</p>
          <p>Căn cứ buộc trả: {report.grounds}</p>
          <p>Nội dung trao đổi: {report.discussion}</p>
          {report.customerReason && <p>Lý do khách từ chối ký: {report.customerReason}</p>}
          <Button size="sm" variant="outline" onClick={async () => {
            try {
              const attachment = await downloadCheckInEvidence(report.evidenceId)
              const url = URL.createObjectURL(attachment.blob)
              const link = document.createElement('a')
              link.href = url
              link.download = attachment.fileName || 'bien-ban-tu-choi-ky'
              link.click()
              window.setTimeout(() => URL.revokeObjectURL(url), 1000)
            } catch (error) { showToast(managerDisplayError(error)) }
          }}>Tải ảnh biên bản</Button>
          <label className="block">Kết luận và căn cứ<textarea className="block w-full rounded border p-2" maxLength={1000}
            value={reasons[checkInId] ?? ''} onChange={e => setReasons({ ...reasons, [checkInId]: e.target.value })} /></label>
          <div className="flex flex-wrap gap-2">{[true, false].map(approved => <Button key={String(approved)}
            disabled={!!releasingId || !reasons[checkInId]?.trim()} onClick={async () => {
              setReleasingId(checkInId)
              try {
                await reviewInventoryRefusal(checkInId, submittedAt, approved, reasons[checkInId].trim())
                showToast(approved ? 'Đã phát hành quyết định trả kho.' : 'Đã gửi yêu cầu bổ sung biên bản.')
                await reload()
              } catch (error) { showToast(managerDisplayError(error)) }
              finally { setReleasingId(null) }
            }}>{approved ? 'Duyệt và phát hành' : 'Yêu cầu bổ sung'}</Button>)}</div>
        </div>
      </Card>)}
      {reviews.map(review => <Card key={review.checkInId}><div className="space-y-2 p-4">
        <strong>Đối soát giờ đến · {review.reservationCode}</strong>
        <p>{formatManagerDateTime(review.actualArrivedAt)} · {review.evidence}</p>
        <label>Lý do quyết định <input maxLength={500} value={reasons[review.checkInId] ?? ''} onChange={e => setReasons({ ...reasons, [review.checkInId]: e.target.value })} /></label>
        <div className="flex gap-2">{[true, false].map(accepted => <Button key={String(accepted)} disabled={!!releasingId || !reasons[review.checkInId]?.trim()}
          onClick={async () => {
            setReleasingId(review.checkInId)
            try { await resolveArrivalReview(review.checkInId, accepted, reasons[review.checkInId].trim()); await reload() }
            catch (error) { showToast(managerDisplayError(error)) } finally { setReleasingId(null) }
          }}>{accepted ? 'Xác nhận đến đúng hạn' : 'Bác ghi nhận'}</Button>)}</div>
      </div></Card>)}

    {!reviews.length && !refusals.length && !error && <Card className="p-4 text-sm text-stone-600">Không có hồ sơ cần đối soát bàn giao.</Card>}
  </div>
}
