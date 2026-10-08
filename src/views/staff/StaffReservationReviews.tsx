import { useEffect, useState } from 'react'
import { Button, Card, Input, SectionHeader } from '../../components/ui'
import { decideStaffReservationReview, listStaffReservationReviews, type ReservationReview } from '../../services/staffReservationApi'

export default function StaffReservationReviews({ canApprove, facilityNames = {} }: { canApprove: boolean; facilityNames?: Record<string, string> }) {
  const [rows, setRows] = useState<ReservationReview[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await listStaffReservationReviews(page)
        if (!disposed) { setRows(result.data); setTotalPages(result.pagination.totalPages) }
      } catch (error) {
        if (!disposed) setMessage(error instanceof Error ? error.message : 'Không thể tải hồ sơ chờ duyệt.')
      } finally { if (!disposed) setLoading(false) }
    }
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [page, revision])
  const decide = async (row: ReservationReview, decision: 'APPROVE' | 'REJECT') => {
    if (busyId || !canApprove) return
    setBusyId(row.reservationId)
    setMessage(null)
    try {
      await decideStaffReservationReview(row.reservationId, decision, notes[row.reservationId] || '')
      setMessage(decision === 'APPROVE' ? `${row.reservationCode} đã được chấp thuận. Customer có thể thanh toán cọc.` : `${row.reservationCode} đã bị từ chối và giải phóng suất kho.`)
      setRows(current => current.filter(item => item.reservationId !== row.reservationId))
      setRevision(value => value + 1)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể duyệt hồ sơ.') }
    finally { setBusyId(null) }
  }
  return <div className="fade-in space-y-4">
    <SectionHeader title="Duyệt yêu cầu đặt kho" subtitle={`Chỉ hiển thị hồ sơ thuộc cơ sở được phân quyền: ${Object.values(facilityNames).join(', ') || 'chưa được gán cơ sở'}.`} action={<Button variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Làm mới</Button>} />
    {message && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{message}</p>}
    {loading && <p className="text-sm text-stone-500">Đang tải hồ sơ…</p>}
    {!loading && !rows.length && <Card className="p-8 text-center text-stone-500">Chưa có hồ sơ chờ duyệt tại cơ sở của bạn. Customer cần xác minh OTP trước khi hồ sơ xuất hiện.</Card>}
    {rows.map(row => <Card key={row.reservationId} className="space-y-4 border-l-4 border-l-amber-500 p-5">
      <div><p className="text-xs font-bold text-amber-700">{row.reservationCode}</p><h3 className="mt-1 font-bold">{row.customerEmail}</h3><p className="text-xs font-semibold text-stone-700">Cơ sở: {facilityNames[row.facilityId] || row.facilityId}</p><p className="text-xs text-stone-500">{row.startDate} → {row.endDate}</p><p className="text-xs text-stone-500">Hạn duyệt: {row.reviewDueAt ? new Date(row.reviewDueAt).toLocaleString('vi-VN') : '—'}</p></div>
      <p className="text-sm"><b>Tình trạng đóng gói:</b> {row.goodsCondition || '—'}</p>
      {row.goodsItems.map(item => <div key={item.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"><p className="font-bold">{item.customGoodsName || item.description || item.category}</p><p>Mô tả: {item.description || '—'}</p><p>Chất liệu: {item.customMaterial || item.materialName || '—'}</p><p>{item.quantity} kiện · {item.lengthCm} × {item.widthCm} × {item.heightCm} cm · {item.weightPerItemKg} kg/kiện</p><p>Dễ vỡ: {item.fragile ? 'Có' : 'Không'}</p>{item.customerNote && <p>Ghi chú khách hàng: {item.customerNote}</p>}</div>)}
      <Input label="Ghi chú / lý do từ chối" maxLength={1000} value={notes[row.reservationId] || ''} onChange={event => setNotes(current => ({ ...current, [row.reservationId]: event.target.value }))} />
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={!canApprove || Boolean(busyId) || !(notes[row.reservationId] || '').trim()} onClick={() => void decide(row, 'REJECT')}>Từ chối</Button><Button disabled={!canApprove || Boolean(busyId)} onClick={() => void decide(row, 'APPROVE')}>{busyId === row.reservationId ? 'Đang xử lý…' : 'Chấp thuận hàng hóa'}</Button></div>
    </Card>)}
    {totalPages > 1 && <div className="flex justify-end gap-3"><Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Trước</Button><p>Trang {page + 1}/{totalPages}</p><Button variant="outline" disabled={loading || page + 1 >= totalPages} onClick={() => setPage(value => value + 1)}>Sau</Button></div>}
  </div>
}
