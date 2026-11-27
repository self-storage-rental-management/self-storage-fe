import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { listArrivalReviews, resolveArrivalReview, type PendingArrival, listCheckIns, releaseCustomerReceiptTimeout, type CheckInCase } from '../../services/checkInApi'
import { downloadCheckInEvidence, listInventoryRefusals, reviewInventoryRefusal, type InventoryRefusalReview } from '../../services/checkInApi'
import { managerDisplayError } from './managerPresentation'
import { formatManagerDateTime } from './managerList'

function receiptCountdown(value: string | null, now: number) {
  if (!value) return { text: 'Chưa xác định thời hạn', expired: false, urgent: true }
  const remaining = new Date(value).getTime() - now
  if (!Number.isFinite(remaining) || remaining <= 0) return { text: 'Đã quá hạn xác nhận', expired: true, urgent: true }
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  return {
    text: `Còn ${days > 0 ? `${days} ngày ` : ''}${hours > 0 ? `${hours} giờ ` : ''}${rest} phút`,
    expired: false,
    urgent: remaining <= 2 * 60 * 60_000,
  }
}

function releaseCountdown(value: string | null | undefined, now: number) {
  if (!value) return { text: 'Chưa xác định thời hạn giải phóng', eligible: false }
  const remaining = new Date(value).getTime() - now
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { text: 'Đã đủ điều kiện giải phóng kho', eligible: true }
  }
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  return {
    text: 'Có thể giải phóng sau '
      + (days > 0 ? days + ' ngày ' : '')
      + (hours > 0 ? hours + ' giờ ' : '')
      + rest + ' phút',
    eligible: false,
  }
}

export default function ManagerCheckInReminderPanel({ showToast, onCountChange }: { showToast: (message: string) => void; onCountChange?: (count: number | null) => void }) {
  const [reviews, setReviews] = useState<PendingArrival[]>([])
  const [refusals, setRefusals] = useState<InventoryRefusalReview[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [items, setItems] = useState<CheckInCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [now, setNow] = useState(Date.now)
  const [releaseTarget, setReleaseTarget] = useState<CheckInCase | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listCheckIns({ group: 'ONGOING', status: 'handover_pending_receipt', page: 0, pageSize: 100 })
      const [arrivalReviews, refusalReviews] = await Promise.all([listArrivalReviews(), listInventoryRefusals()])
      setReviews(arrivalReviews)
      setRefusals(refusalReviews)
      setItems(result.data.filter(item => item.checkInStatus === 'handover_pending_receipt'))
      onCountChange?.(result.pagination.totalItems)
    } catch (reason) {
      setError(reason)
      setItems([])
      onCountChange?.(null)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [reload])

  const sortedItems = useMemo(() => [...items].sort((left, right) => {
    const leftState = receiptCountdown(left.receiptConfirmationDueAt, now)
    const rightState = receiptCountdown(right.receiptConfirmationDueAt, now)
    const leftRelease = releaseCountdown(left.receiptConfirmationReleaseAt, now)
    const rightRelease = releaseCountdown(right.receiptConfirmationReleaseAt, now)
    if (leftRelease.eligible !== rightRelease.eligible) return Number(rightRelease.eligible) - Number(leftRelease.eligible)
    return Number(rightState.expired) - Number(leftState.expired)
      || Number(rightState.urgent) - Number(leftState.urgent)
      || new Date(left.receiptConfirmationDueAt || left.checkedInAt || 0).getTime()
        - new Date(right.receiptConfirmationDueAt || right.checkedInAt || 0).getTime()
      || left.reservationId.localeCompare(right.reservationId)
  }), [items, now])

  const release = async () => {
    const item = releaseTarget
    if (!item?.checkInId || !releaseCountdown(item.receiptConfirmationReleaseAt, Date.now()).eligible || releasingId) return
    setReleasingId(item.checkInId)
    try {
      await releaseCustomerReceiptTimeout(item.checkInId)
      showToast('Đã giải phóng gian kho ' + item.storageUnitCode + ' sau khi khách quá hạn xác nhận.')
      setReleaseTarget(null)
      await reload()
    } catch (reason) {
      showToast(managerDisplayError(reason))
    } finally {
      setReleasingId(null)
    }
  }

  return (
    <div className="space-y-3">
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
      <SectionHeader
        eyebrow="Chờ khách xác nhận"
        title="Theo dõi xác nhận nhận kho"
        subtitle="Hệ thống tự nhắc khách nếu còn 2 giờ đến hạn xác nhận nhận kho."
      />
      <Card className="overflow-hidden">
        {loading ? <p className="p-5 text-sm text-stone-500">Đang tải hồ sơ…</p>
          : error ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-red-800"><span>Chưa tải được hồ sơ chờ xác nhận.</span><Button size="sm" variant="outline" onClick={() => void reload()}>Thử lại</Button></div>
            : !sortedItems.length ? <p className="p-5 text-sm text-stone-500">Không có hồ sơ đang chờ khách hàng xác nhận nhận kho.</p>
              : <Table>
                <Thead><Tr><Th>Đơn đặt giữ kho</Th><Th>Khách hàng</Th><Th>Gian kho</Th><Th>Thời hạn</Th><Th className="text-right">Thao tác</Th></Tr></Thead>
                <Tbody>{sortedItems.map(item => {
                  const state = receiptCountdown(item.receiptConfirmationDueAt, now)
                  const releaseState = releaseCountdown(item.receiptConfirmationReleaseAt, now)
                  return <Tr key={item.reservationId}>
                    <Td><b className="font-mono">{item.reservationCode}</b><p className="mt-1 text-xs text-stone-500">{item.facilityName}</p></Td>
                    <Td><b>{item.customerName}</b><p className="mt-1 text-xs text-stone-500">{item.customerEmail}</p></Td>
                    <Td className="font-mono">{item.storageUnitCode}</Td>
                    <Td>
                      <Badge variant={state.expired ? 'error' : state.urgent ? 'warning' : 'muted'}>{state.text}</Badge>
                      {item.receiptConfirmationDueAt && <p className={`mt-1 text-xs ${state.expired || state.urgent ? 'text-red-700' : 'text-stone-500'}`}>Hạn {formatManagerDateTime(item.receiptConfirmationDueAt)}</p>}
                      {releaseState.eligible && <p className="mt-1 text-xs font-semibold text-red-700">{releaseState.text}</p>}
                    </Td>
                    <Td className="text-right"><div className="flex flex-wrap justify-end gap-2">
                      {releaseState.eligible && <Button size="sm" variant="danger" disabled={releasingId !== null} onClick={() => setReleaseTarget(item)}>{releasingId === item.checkInId ? 'Đang giải phóng…' : 'Giải phóng kho'}</Button>}
                    </div></Td>
                  </Tr>
                })}</Tbody>
              </Table>}
      </Card>
      <Modal
        open={Boolean(releaseTarget)}
        onClose={() => { if (!releasingId) setReleaseTarget(null) }}
        title="Giải phóng gian kho"
        size="md"
      >
        {releaseTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
              <p className="font-bold">Khách chưa xác nhận nhận kho trong 24 giờ</p>
              <p className="mt-2 leading-6">
                Xác nhận giải phóng gian <b>{releaseTarget.storageUnitCode}</b> cho đơn <b>{releaseTarget.reservationCode}</b>.
                Hồ sơ sẽ được đóng và gian kho được đưa về trạng thái sẵn sàng.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReleaseTarget(null)} disabled={Boolean(releasingId)}>Hủy</Button>
              <Button variant="danger" onClick={() => void release()} disabled={Boolean(releasingId)}>
                {releasingId ? "Đang giải phóng…" : "Xác nhận giải phóng kho"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
