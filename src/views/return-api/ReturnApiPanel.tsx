import { useEffect, useRef, useState } from 'react'
import { Button, Card } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { rentalMoney } from '../rental-api/presentation'
import { listReturns, getReturn, requestReturn, inspectReturn, reviewDispute, confirmReturn, returnError, feeKeys,
  type ApiReturn, type ReturnRole, type ReturnFees, type InspectionInput } from '../../services/returnApi'

const labels: Record<ApiReturn['status'], string> = { requested: 'Đã yêu cầu trả kho', scheduled: 'Đã hẹn nghiệm thu', awaiting_customer_confirmation: 'Chờ khách xác nhận',
  disputed: 'Đang xem xét khiếu nại', payment_due: 'Chờ thanh toán quyết toán', refund_pending: 'Chờ chứng cứ hoàn tiền', completed: 'Đã hoàn tất' }
export function ReturnSummary({ record }: { record: ApiReturn }) {
  return <div className="space-y-2"><h4 className="font-semibold">{record.unitNumber} · {labels[record.status]}</h4>
    <p>{record.facilityName} · Ngày trả: {record.scheduledDate}</p>
    <p>Cọc theo hợp đồng: {rentalMoney(record.depositAmount, 'VND')}</p><p>Phí đã ghi nhận: {rentalMoney(record.totalDeductions, 'VND')}</p>
    <p>Khoản hoàn tiền: {rentalMoney(record.netRefundAmount, 'VND')}</p><p>Khách cần đóng thêm: {rentalMoney(record.amountDueFromCustomer, 'VND')}</p>
    {record.settlementBlocker && <p role="status" className="rounded bg-amber-50 p-3">Chưa đủ chứng cứ về số cọc đang giữ, tiền đã thu hoặc tiền hoàn đã chuyển. Hồ sơ chưa được xác nhận thanh toán/hoàn tiền thành công.</p>}
    {record.inspectionNotes && <p>Nghiệm thu: {record.inspectionNotes}</p>}{record.managerResolutionNote && <p>Kết quả xem xét: {record.managerResolutionNote}</p>}
  </div>
}
export default function ReturnApiPanel({ role, rentalId, rentalActive = false, onChanged }: {
  role: ReturnRole; rentalId?: string; rentalActive?: boolean; onChanged?: () => void
}) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${rentalId ?? ''}`
  return <ReturnWorkspace key={identity} role={role} rentalId={rentalId} rentalActive={rentalActive} onChanged={onChanged} identity={identity} />
}
function ReturnWorkspace({ role, rentalId, rentalActive, onChanged, identity }: {
  role: ReturnRole; rentalId?: string; rentalActive: boolean; onChanged?: () => void; identity: string
}) {
  const actor = getAuthenticatedActor()
  const [page, setPage] = useState(0)
  const read = useRentalApiResource(`${identity}:${page}`, () => listReturns(role, page))
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [feedback, setFeedback] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  async function run(work: () => Promise<ApiReturn>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setFeedback('')
    try {
      const result = await work()
      if (!mounted.current || getAuthenticatedActor()?.id !== actor?.id) return
      setSelected(result.id); read.refresh(); onChanged?.(); setFeedback('Máy chủ đã ghi nhận thao tác. Đang tải lại hồ sơ.')
    }
    catch (e) { if (mounted.current) { setFeedback(returnError(e)); read.refresh() } }
    finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  const rows = read.data?.data.filter(r => !rentalId || r.rentalId === rentalId) ?? []
  const readable = actor?.status === 'ACTIVE' && actor.roles.includes(role.toUpperCase() as 'CUSTOMER' | 'STAFF' | 'MANAGER')
  if (!readable) return null
  return <Card className="p-4 space-y-3"><h3 className="font-bold">Trả kho & quyết toán</h3>
    {role === 'customer' && rentalId && rentalActive && <form onSubmit={e => { e.preventDefault(); void run(() => requestReturn(rentalId, date, notes)) }} className="space-y-2">
      <label className="block">Ngày trả kho<input type="date" required value={date} disabled={busy} onChange={e => setDate(e.target.value)} className="block rounded border p-2" /></label>
      <label className="block">Lý do / ghi chú<textarea value={notes} maxLength={2000} disabled={busy} onChange={e => setNotes(e.target.value)} className="block w-full rounded border p-2" /></label>
      <Button type="submit" disabled={busy || !date || read.loading}>Gửi yêu cầu trả kho</Button>
    </form>}
    {read.loading && <p role="status">Đang tải hồ sơ trả kho...</p>}{!!read.error && <p role="alert">{returnError(read.error)}</p>}
    {feedback && <p role="status">{feedback}</p>}
    <Button variant="outline" disabled={busy} onClick={() => read.refresh()}>Tải lại danh sách</Button>
    {!read.loading && !read.error && !rows.length && <p>Chưa có hồ sơ trả kho trên trang này.</p>}
    {rows.map(record => <div key={record.id} className="rounded border p-3"><ReturnSummary record={record} />
      <Button variant="outline" disabled={busy} onClick={() => setSelected(record.id)}>Xem và xử lý hồ sơ</Button></div>)}
    <div className="flex gap-2"><Button disabled={busy || page === 0} onClick={() => { setSelected(null); setPage(p => p - 1) }}>Trang trước</Button>
      <span>Trang {page + 1}</span><Button disabled={busy || !read.data || page + 1 >= read.data.pagination.totalPages} onClick={() => { setSelected(null); setPage(p => p + 1) }}>Trang sau</Button></div>
    {selected && <ReturnActions key={selected} role={role} id={selected} run={run} busy={busy} />}
  </Card>
}
function ReturnActions({ role, id, run, busy }: { role: ReturnRole; id: string; run: (work: () => Promise<ApiReturn>) => Promise<void>; busy: boolean }) {
  const detail = useRentalApiResource(`${role}:${id}:${busy}`, () => getReturn(role, id))
  const actor = getAuthenticatedActor()
  const record = detail.data
  const [note, setNote] = useState('')
  const [fees, setFees] = useState<ReturnFees>({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0 })
  const [inventory, setInventory] = useState<InspectionInput['inventoryMatch']>('match')
  const [damage, setDamage] = useState<InspectionInput['damageClassification']>('no_damage')
  const [unit, setUnit] = useState<'available' | 'maintenance'>('available')
  const [returned, setReturned] = useState({ returnedKey: false, returnedCard: false, returnedLock: false })
  const initialized = useRef(false)
  useEffect(() => {
    if (record && !initialized.current) {
      initialized.current = true
      setFees({ damageFee: record.damageFee, cleaningFee: record.cleaningFee, lostItemFee: record.lostItemFee,
        overdueFee: record.overdueFee, outstandingFee: record.outstandingFee })
      if (record.proposedUnitStatus) setUnit(record.proposedUnitStatus)
    }
  }, [record])
  if (detail.loading) return <p role="status">Đang tải chi tiết...</p>
  if (detail.error) return <p role="alert">{returnError(detail.error)}</p>
  if (!record) return null
  const write = role === 'customer' || !!actor?.permissions.includes(role === 'manager' ? 'rentals:update' : 'returns:process')
  const canInspect = write && role === 'staff' && ['requested', 'scheduled'].includes(record.status)
  const canReview = write && role === 'manager' && record.status === 'disputed'
  return <section className="rounded border p-3 space-y-3" aria-label="Xử lý trả kho"><ReturnSummary record={record} />
    {(canInspect || canReview || role === 'customer' && record.status === 'awaiting_customer_confirmation') && <label className="block">Ghi chú / lý do<textarea className="block w-full rounded border p-2" disabled={busy} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></label>}
    {(canInspect || canReview) && <form onSubmit={e => { e.preventDefault(); void run(() => canInspect ? inspectReturn(id, { ...fees, inventoryMatch: inventory, damageClassification: damage,
      staffNotes: note, evidencePhotos: [], ...returned, proposedUnitStatus: unit }) : reviewDispute(id, { ...fees, resolutionNote: note, proposedUnitStatus: unit })) }} className="space-y-2">
      {feeKeys.map((key, i) => <label key={key} className="block">{['Phí hư hỏng', 'Phí vệ sinh', 'Phí mất đồ', 'Phí quá hạn', 'Phí còn thiếu'][i]} (VND)
        <input type="number" min="0" step="0.01" required disabled={busy} value={Number.isNaN(fees[key]) ? '' : fees[key]} onChange={e => setFees(prev => ({ ...prev, [key]: e.target.value === '' ? NaN : Number(e.target.value) }))} className="block rounded border p-2" /></label>)}
      {canInspect && <><label className="block">Đối chiếu hàng hóa<select value={inventory} disabled={busy} onChange={e => setInventory(e.target.value as typeof inventory)}><option value="match">Khớp</option><option value="missing">Thiếu</option><option value="excess">Dư</option></select></label>
        <label className="block">Hiện trạng<select value={damage} disabled={busy} onChange={e => setDamage(e.target.value as typeof damage)}><option value="no_damage">Không hư hỏng</option><option value="minor_damage">Hư hỏng nhẹ</option><option value="major_damage">Hư hỏng nặng</option><option value="abandoned_goods">Bỏ lại hàng hóa</option></select></label>
        {(['returnedKey', 'returnedCard', 'returnedLock'] as const).map((key, i) => <label key={key} className="block"><input type="checkbox" checked={returned[key]} disabled={busy} onChange={e => setReturned(prev => ({ ...prev, [key]: e.target.checked }))} />{['Đã trả chìa khóa', 'Đã trả thẻ', 'Đã trả khóa'][i]}</label>)}</>}
      <label className="block">Hiện trạng kho đề xuất<select value={unit} disabled={busy} onChange={e => setUnit(e.target.value as typeof unit)}><option value="available">Sẵn sàng</option><option value="maintenance">Cần bảo trì</option></select></label>
      <Button type="submit" disabled={busy || canReview && !note.trim()}>{canInspect ? 'Ghi nhận nghiệm thu' : 'Ghi nhận xem xét khiếu nại'}</Button>
    </form>}
    {role === 'customer' && record.status === 'awaiting_customer_confirmation' && <div className="flex gap-2">
      <Button disabled={busy || !note.trim()} onClick={() => void run(() => confirmReturn(id, 'disputed', note))}>Yêu cầu xem xét lại</Button>
      <Button disabled={busy || !!record.settlementBlocker || record.netRefundAmount === null || record.amountDueFromCustomer === null} onClick={() => void run(() => confirmReturn(id, 'accepted', note))}>Đồng ý quyết toán</Button>
    </div>}
  </section>
}
