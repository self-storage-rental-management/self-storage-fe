import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { rentalDate, rentalMoney } from '../rental-api/presentation'
import RecoveryReturnSettlement from './RecoveryReturnSettlement'
import RecoveryTaskLink from '../rental-api/RecoveryTaskLink'
import {
  completeRefund,
  confirmReturn,
  feeKeys,
  inspectReturn,
  listReturns,
  paySettlement,
  requestReturn,
  updateReturnRequest,
  reviewDispute,
  returnError,
  uploadReturnEvidence,
  type ApiReturn,
  type InspectionInput,
  type ReturnFees,
  type ReturnRole,
} from '../../services/returnApi'

const labels: Record<ApiReturn['status'], string> = {
  requested: 'Đã yêu cầu trả kho',
  scheduled: 'Đã hẹn nghiệm thu',
  inspected: 'Đã nghiệm thu',
  awaiting_customer_confirmation: 'Chờ khách xác nhận',
  disputed: 'Đang khiếu nại - Cần BO giải quyết',
  payment_due: 'Chờ thanh toán quyết toán',
  refund_pending: 'Chờ hoàn cọc',
  completed: 'Đã hoàn tất',
}

const returnStatusOptions: Array<[ApiReturn['status'] | 'all', string]> = [
  ['all', 'Tất cả trạng thái'],
  ['requested', 'Đã yêu cầu trả kho'],
  ['scheduled', 'Đã hẹn nghiệm thu'],
  ['inspected', 'Đã nghiệm thu'],
  ['awaiting_customer_confirmation', 'Chờ khách xác nhận'],
  ['disputed', 'Đang khiếu nại - Cần BO giải quyết'],
  ['payment_due', 'Chờ thanh toán quyết toán'],
  ['refund_pending', 'Chờ hoàn cọc'],
  ['completed', 'Đã hoàn tất'],
]

export function ReturnSummary({ record }: { record: ApiReturn }) {
  const badgeClass =
    record.status === 'disputed'
      ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
      : record.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-800'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h4 className="text-lg font-bold text-stone-900">{record.unitNumber}</h4><p className="mt-1 text-sm text-stone-500">{record.facilityName}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{record.sourceType === 'RECOVERY' && record.status === 'completed' ? record.recoveryTaskStatus === 'CLOSED' ? 'Đã hoàn tất thu hồi' : 'Quyết toán xong, chờ thu hồi' : labels[record.status]}</span>
      </div>
      <p className="text-sm text-stone-600">{record.sourceType === 'RECOVERY' ? 'Hồ sơ từ thu hồi kho - Ngày kiểm kê: ' : 'Ngày dự kiến trả: '}<strong className="text-stone-900">{rentalDate(record.scheduledDate)}</strong></p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([
          ['Cọc theo hợp đồng', record.depositAmount], ['Phí đã ghi nhận', record.totalDeductions],
          ['Khoản hoàn tiền', record.netRefundAmount], ['Khách cần đóng thêm', record.amountDueFromCustomer],
        ] as const).map(([label, amount]) => <div key={label} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-sm font-bold text-stone-900">{amount == null ? 'Chưa xác định' : rentalMoney(amount, 'VND')}</p></div>)}
      </div>
      {record.settlementBlocker && (
        <p role="status" className="rounded bg-amber-50 p-3">
          Chưa đủ chứng cứ về số cọc đang giữ, tiền đã thu hoặc tiền hoàn đã
          chuyển. Hồ sơ chưa được xác nhận thanh toán/hoàn tiền thành công.
        </p>
      )}
    </div>
  )
}

export default function ReturnApiPanel({
  role,
  rentalId,
  rentalActive = false,
  onChanged,
}: {
  role: ReturnRole
  rentalId?: string
  rentalActive?: boolean
  onChanged?: () => void
}) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${rentalId ?? ''}`
  return (
    <ReturnWorkspace
      key={identity}
      role={role}
      rentalId={rentalId}
      rentalActive={rentalActive}
      onChanged={onChanged}
      identity={identity}
    />
  )
}

function ReturnWorkspace({
  role,
  rentalId,
  rentalActive,
  onChanged,
  identity,
}: {
  role: ReturnRole
  rentalId?: string
  rentalActive: boolean
  onChanged?: () => void
  identity: string
}) {
  const actor = getAuthenticatedActor()
  const [page, setPage] = useState(0)
  const read = useRentalApiResource(`${identity}:${page}`, async () => {
    if (!rentalId) return listReturns(role, page)
    const first = await listReturns(role, 0, 100)
    const data = [...first.data]
    for (let next = 1; next < first.pagination.totalPages; next++) data.push(...(await listReturns(role, next, 100)).data)
    return { ...first, data }
  }, { retainDataOnRefresh: true })
  const [busy, setBusy] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const recoveryLock = useRef(false)
  const recoveryLocks = useRef(new Set<string>())
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [feedback, setFeedback] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  async function run(work: () => Promise<ApiReturn>) {
    if (lock.current || recoveryLock.current) return
    lock.current = true
    setBusy(true)
    setFeedback('')
    try {
      await work()
      if (!mounted.current || getAuthenticatedActor()?.id !== actor?.id) return
      setEditing(null)
      read.refresh()
      onChanged?.()
    } catch (error) {
      if (mounted.current) {
        setFeedback(returnError(error))
        read.refresh()
      }
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const rows = (read.data?.data.filter((item) => !rentalId || item.rentalId === rentalId) ?? [])
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate))
  const readable = actor?.status === 'ACTIVE' && (
    actor.roles.includes(role.toUpperCase() as 'CUSTOMER' | 'STAFF' | 'MANAGER') ||
    (role === 'manager' && (actor.roles.includes('BUSINESS') || actor.roles.includes('ADMIN')))
  )
  if (!readable) return null

  return (
    <div className={rentalId ? 'space-y-4' : 'space-y-4 rounded-xl border border-stone-200 bg-white p-5'}>
      {!rentalId && <h3 className="border-b border-stone-200 pb-3 text-base font-bold">Trả kho & quyết toán</h3>}
      {role === 'customer' && rentalId && read.data && ((rentalActive && !rows.some(record => record.status !== 'completed' || (record.sourceType === 'RECOVERY' && record.recoveryTaskStatus !== 'CLOSED'))) || editing) && (
        <form onSubmit={(event) => { event.preventDefault(); void run(() => editing ? updateReturnRequest(editing, date, notes) : requestReturn(rentalId, date, notes)) }} className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <VietnameseDateInput label="Ngày trả kho" value={date} onChange={setDate} />
          <label className="block text-sm font-medium text-stone-700">Lý do<textarea required rows={3} placeholder="Nhập lý do trả kho…" value={notes} maxLength={2000} disabled={busy} onChange={(event) => setNotes(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-3 font-normal" /></label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || !date || !notes.trim() || read.loading}>{editing ? 'Lưu chỉnh sửa' : 'Gửi yêu cầu trả kho'}</Button>
            {editing && <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Hủy chỉnh sửa</Button>}
          </div>
        </form>
      )}
      {read.loading && !read.data && <p role="status">Đang tải hồ sơ trả kho...</p>}
      {!!read.error && <p role="alert">{returnError(read.error)}</p>}
      {feedback && <p role="status">{feedback}</p>}
      {!read.loading && !read.error && rows.length === 0 && <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Chưa có yêu cầu trả kho.</p>}
      {rows.map((record) => <div key={record.id} className="rounded-xl border border-stone-200 bg-white p-4">
        <ReturnActions role={role} record={record} run={run} busy={busy || read.loading || (recoveryBusy && !recoveryLocks.current.has(record.id))} recoveryLocked={recoveryBusy}
          onRecoveryLocked={value => { if (value) recoveryLocks.current.add(record.id); else recoveryLocks.current.delete(record.id); recoveryLock.current = recoveryLocks.current.size > 0; setRecoveryBusy(recoveryLock.current) }}
          onRecoveryChanged={() => { setFeedback('Đã cập nhật hồ sơ thu hồi.'); read.refresh(); onChanged?.() }} />
        {role === 'customer' && record.status === 'requested' && editing !== record.id && <div className="mt-3 flex justify-end border-t border-stone-100 pt-3"><Button type="button" variant="outline" disabled={busy || read.loading} onClick={() => { setEditing(record.id); setDate(record.scheduledDate); setNotes(record.customerNotes || '') }}>Chỉnh sửa yêu cầu</Button></div>}
      </div>)}
      {!rentalId && rows.length > 0 && <div className="flex gap-2"><Button disabled={busy || recoveryBusy || page === 0} onClick={() => { if (!recoveryLock.current) setPage((value) => value - 1) }}>Trang trước</Button><span>Trang {page + 1}</span><Button disabled={busy || recoveryBusy || !read.data || page + 1 >= read.data.pagination.totalPages} onClick={() => { if (!recoveryLock.current) setPage((value) => value + 1) }}>Trang sau</Button></div>}
    </div>
  )
}

function ReturnActions({ role, record, run, busy, recoveryLocked, onRecoveryLocked, onRecoveryChanged }: { role: ReturnRole; record: ApiReturn; run: (work: () => Promise<ApiReturn>) => Promise<void>; busy: boolean; recoveryLocked: boolean; onRecoveryLocked: (locked: boolean) => void; onRecoveryChanged: () => void }) {
  const id = record.id
  const actor = getAuthenticatedActor()
  const [note, setNote] = useState('')
  const [fees, setFees] = useState<ReturnFees>({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0 })
  const [inventory, setInventory] = useState<InspectionInput['inventoryMatch']>('match')
  const [damage, setDamage] = useState<InspectionInput['damageClassification']>('no_damage')
  const [unit, setUnit] = useState<'available' | 'maintenance'>('available')
  const [returned, setReturned] = useState({ returnedKey: false, returnedCard: false, returnedLock: false })
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [refundReference, setRefundReference] = useState('')
  const [refundNotes, setRefundNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản')
  const [paymentNotes, setPaymentNotes] = useState('')
  const initialized = useRef(false)

  useEffect(() => {
    if (record && !initialized.current) {
      initialized.current = true
      setFees({ damageFee: record.damageFee, cleaningFee: record.cleaningFee, lostItemFee: record.lostItemFee, overdueFee: record.overdueFee, outstandingFee: record.outstandingFee })
      if (record.proposedUnitStatus) setUnit(record.proposedUnitStatus)
    }
  }, [record])

  const write = role === 'customer' || !!actor?.permissions.includes(role === 'manager' ? 'rentals:update' : 'returns:process')
  const recovery = record.sourceType === 'RECOVERY'
  const canInspect = !recovery && write && role === 'staff' && ['requested', 'scheduled'].includes(record.status)
  const canReview = write && role === 'manager' && record.status === 'disputed'
  const canRefund = !recovery && write && role === 'staff' && record.status === 'refund_pending'
  const canPaySettlement = !recovery && role === 'customer' && record.status === 'payment_due'
  const recoveryNextStep = !recovery ? null : record.recoveryTaskStatus === 'CLOSED'
    ? 'Thu hồi đã hoàn tất. Hồ sơ thuê đã kết thúc và trạng thái kho đã được cập nhật.'
    : record.status === 'completed' ? 'Quyết toán đã hoàn tất. Hồ sơ thuê chỉ kết thúc sau khi nhân viên hoàn tất xử lý tài sản và giải phóng kho.'
      : record.status === 'payment_due' ? 'Liên hệ cơ sở để thanh toán khoản quyết toán còn thiếu. Nhân viên ghi nhận tiền kèm biên lai đã đối chiếu.'
        : record.status === 'refund_pending' ? 'Cơ sở thực hiện hoàn tiền và ghi nhận biên lai quyết toán. Thu hồi kho được hoàn tất riêng sau đó.' : null
  const submitInspection = async () => {
    const evidencePhotos: string[] = []
    for (const file of evidenceFiles) {
      const asset = await uploadReturnEvidence(id, file)
      evidencePhotos.push(asset.id)
    }
    return inspectReturn(id, { ...fees, inventoryMatch: inventory, damageClassification: damage, staffNotes: note, evidencePhotos, ...returned, proposedUnitStatus: unit })
  }

  return (
    <section className="space-y-4" aria-label="Xử lý trả kho">
      <ReturnSummary record={record} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">Bước tiếp theo</p>
        <p className="mt-1">{recoveryNextStep ?? { requested: 'Yêu cầu đã được gửi. Cơ sở sẽ sắp xếp lịch và thực hiện nghiệm thu trước khi quyết toán.', scheduled: 'Đến cơ sở theo ngày hẹn để trả kho và bàn giao cho nhân viên nghiệm thu.', inspected: 'Nghiệm thu đã được ghi nhận. Chờ cơ sở gửi kết quả quyết toán để khách hàng xác nhận.', awaiting_customer_confirmation: 'Kiểm tra các khoản phí bên dưới, sau đó đồng ý quyết toán hoặc yêu cầu xem xét lại.', disputed: 'Hồ sơ đang có khiếu nại từ khách hàng. Cần Ban Điều Hành (BO) hoặc Quản lý giải quyết trước khi tiếp tục.', payment_due: 'Thanh toán khoản quyết toán còn thiếu để tiếp tục hoàn tất trả kho.', refund_pending: 'Cơ sở đang xử lý hoàn cọc. Hồ sơ chỉ hoàn tất khi khoản hoàn tiền được ghi nhận.', completed: 'Hồ sơ trả kho và quyết toán đã hoàn tất.' }[record.status]}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 p-4">
          <h4 className="mb-3 font-semibold text-stone-900">Thông tin trả kho & nghiệm thu</h4>
          <dl className="space-y-3 text-sm">
            {([
              ['Khách hàng', record.customerName], ['Lý do trả kho', record.customerNotes || 'Chưa ghi nhận'],
              ['Ghi chú nghiệm thu', record.inspectionNotes || 'Chưa ghi nhận'],
              ...(record.customerDecisionNote ? [['Ý kiến khiếu nại của khách', record.customerDecisionNote]] : []),
              ['Kết quả xem xét', record.managerResolutionNote || 'Chưa có'],
              ['Khách xác nhận quyết toán', record.customerConfirmed ? 'Đã xác nhận' : 'Chưa xác nhận'],
              ['Hiện trạng kho đề xuất', record.proposedUnitStatus === 'available' ? 'Sẵn sàng' : record.proposedUnitStatus === 'maintenance' ? 'Cần bảo trì' : 'Chưa ghi nhận'],
              ['Bằng chứng nghiệm thu', `${record.evidencePhotos?.length ?? 0} tệp`],
            ] as Array<[string, string]>).map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium text-stone-800">{value}</dd></div>)}
          </dl>
        </div>
        <div className="rounded-xl border border-stone-200 p-4">
          <h4 className="mb-3 font-semibold text-stone-900">Chi tiết các khoản phí</h4>
          <dl className="divide-y divide-stone-100 text-sm">
            {feeKeys.map((key, index) => <div key={key} className="flex justify-between gap-3 py-2"><dt className="text-stone-500">{['Phí hư hỏng', 'Phí vệ sinh', 'Phí mất đồ', 'Phí quá hạn', 'Phí còn thiếu'][index]}</dt><dd className="shrink-0 font-medium">{rentalMoney(record[key], 'VND')}</dd></div>)}
            <div className="flex justify-between gap-3 py-3 font-bold"><dt>Tổng phí ghi nhận</dt><dd>{rentalMoney(record.totalDeductions, 'VND')}</dd></div>
          </dl>
        </div>
      </div>
      {(canInspect || canReview || (role === 'customer' && record.status === 'awaiting_customer_confirmation')) && <label className="block">Ghi chú / lý do<textarea className="block w-full rounded border p-2" disabled={busy} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} /></label>}
      {(canInspect || canReview) && <form onSubmit={(event) => { event.preventDefault(); void run(canInspect ? submitInspection : () => reviewDispute(id, { ...fees, resolutionNote: note, proposedUnitStatus: unit })) }} className="space-y-2">
        {feeKeys.map((key, index) => <label key={key} className="block">{['Phí hư hỏng', 'Phí vệ sinh', 'Phí mất đồ', 'Phí quá hạn', 'Phí còn thiếu'][index]} (VND)<input type="number" min="0" step="0.01" required disabled={busy} value={Number.isNaN(fees[key]) ? '' : fees[key]} onChange={(event) => setFees((current) => ({ ...current, [key]: event.target.value === '' ? NaN : Number(event.target.value) }))} className="block rounded border p-2" /></label>)}
        {canInspect && <>
          <label className="block">Đối chiếu hàng hóa<select value={inventory} disabled={busy} onChange={(event) => setInventory(event.target.value as typeof inventory)}><option value="match">Khớp</option><option value="missing">Thiếu</option><option value="excess">Dư</option></select></label>
          <label className="block">Hiện trạng<select value={damage} disabled={busy} onChange={(event) => setDamage(event.target.value as typeof damage)}><option value="no_damage">Không hư hỏng</option><option value="minor_damage">Hư hỏng nhẹ</option><option value="major_damage">Hư hỏng nặng</option><option value="abandoned_goods">Bỏ lại hàng hóa</option></select></label>
          {(['returnedKey', 'returnedCard', 'returnedLock'] as const).map((key, index) => <label key={key} className="block"><input type="checkbox" checked={returned[key]} disabled={busy} onChange={(event) => setReturned((current) => ({ ...current, [key]: event.target.checked }))} /> {['Đã trả chìa khóa', 'Đã trả thẻ', 'Đã trả khóa'][index]}</label>)}
          <label className="block">Ảnh/PDF bằng chứng nghiệm thu<input type="file" multiple accept="image/*,application/pdf" disabled={busy} onChange={(event) => setEvidenceFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} className="mt-1 block w-full rounded border p-2" /></label>
          {evidenceFiles.length > 0 && <ul className="list-disc pl-5 text-sm">{evidenceFiles.map((file, index) => <li key={`${file.name}:${file.lastModified}:${index}`} className="flex items-center justify-between gap-2"><span className="truncate">{file.name}</span><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Xóa</Button></li>)}</ul>}
        </>}
        <label className="block">Hiện trạng kho đề xuất<select value={unit} disabled={busy} onChange={(event) => setUnit(event.target.value as typeof unit)}><option value="available">Sẵn sàng</option><option value="maintenance">Cần bảo trì</option></select></label>
        <Button type="submit" disabled={busy || (canReview && !note.trim())}>{canInspect ? 'Ghi nhận nghiệm thu' : 'Ghi nhận xem xét khiếu nại'}</Button>
      </form>}
      {role === 'staff' && !recovery && record.status === 'awaiting_customer_confirmation' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">⏳ Đang chờ khách hàng xác nhận quyết toán</span>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">Chưa đủ điều kiện hoàn cọc</span>
          </div>
          <p className="text-xs text-amber-800">
            Biên bản nghiệm thu đã được ghi nhận và đang chờ khách hàng duyệt phương án quyết toán. Nút hoàn cọc tạm thời bị vô hiệu hóa để tránh lỗi xung đột hệ thống (409 Conflict).
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled variant="outline" className="opacity-50 cursor-not-allowed border-amber-300 text-amber-800 bg-white" title="Hồ sơ đang chờ khách duyệt - Nút bị vô hiệu hóa để tránh lỗi xung đột 409">
              Hoàn cọc (Đang chờ khách duyệt)
            </Button>
          </div>
        </div>
      )}
      {role === 'staff' && !recovery && record.status === 'disputed' && (
        <div className="rounded-xl border border-rose-300 bg-rose-50/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">⚠️ Đang khiếu nại - Cần BO giải quyết</span>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 border border-rose-300">Khóa thao tác nhân viên</span>
          </div>
          <p className="text-xs text-rose-800">
            Khách hàng đã khiếu nại kết quả quyết toán ({record.customerDecisionNote || 'Cần xem xét lại'}). Nút hoàn cọc và nghiệm thu bị khóa để tránh lỗi xung đột (409 Conflict) cho đến khi Ban Điều Hành (BO) hoặc Quản lý cơ sở thẩm định giải quyết.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled variant="outline" className="opacity-50 cursor-not-allowed border-rose-300 text-rose-700 bg-white" title="Hồ sơ đang khiếu nại - Cần BO giải quyết trước khi hoàn cọc (tránh lỗi xung đột 409)">
              Hoàn cọc (Bị khóa do khiếu nại)
            </Button>
          </div>
        </div>
      )}
      {role === 'staff' && !recovery && record.status === 'payment_due' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">💵 Chờ khách thanh toán quyết toán</span>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">Khách nộp thêm: {rentalMoney(record.amountDueFromCustomer, 'VND')}</span>
          </div>
          <p className="text-xs text-amber-800">
            Tổng chi phí nghiệm thu vượt quá tiền cọc. Khách hàng cần thanh toán phần phụ phí còn thiếu trước khi hoàn tất đóng hồ sơ trả kho.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled variant="outline" className="opacity-50 cursor-not-allowed border-amber-300 text-amber-800 bg-white" title="Hồ sơ chờ khách nộp thêm phụ phí - Nút bị vô hiệu hóa">
              Hoàn tất (Chờ khách thanh toán)
            </Button>
          </div>
        </div>
      )}
      {recovery && role !== 'customer' && record.recoveryTaskId && <RecoveryTaskLink role={role} taskId={record.recoveryTaskId} facilityId={record.facilityId} disabled={busy || recoveryLocked} onChanged={onRecoveryChanged} />}
      {recovery && write && role === 'staff' && ['payment_due', 'refund_pending'].includes(record.status) && <RecoveryReturnSettlement record={record} busy={busy} onLocked={onRecoveryLocked} onChanged={onRecoveryChanged} />}
      {canRefund && <form className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3" onSubmit={(event) => { event.preventDefault(); void run(() => completeRefund(id, { transactionReference: refundReference.trim() || undefined, notes: refundNotes.trim() || undefined })) }}>
        <h5 className="font-semibold">Hoàn cọc cho khách hàng</h5>
        <label className="block">Mã giao dịch hoàn cọc<input className="block w-full rounded border p-2" maxLength={120} required disabled={busy} value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="Ví dụ: REFUND-VCB-883921" /></label>
        <label className="block">Ghi chú chuyển tiền<textarea className="block w-full rounded border p-2" maxLength={1000} disabled={busy} value={refundNotes} onChange={(event) => setRefundNotes(event.target.value)} /></label>
        <Button type="submit" disabled={busy || !refundReference.trim()}>Xác nhận đã hoàn cọc</Button>
      </form>}
      {canPaySettlement && <form className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3" onSubmit={(event) => { event.preventDefault(); void run(() => paySettlement(id, paymentMethod, paymentNotes)) }}>
        <h5 className="font-semibold">Thanh toán phần quyết toán còn thiếu</h5>
        <label className="block">Phương thức thanh toán<select className="block w-full rounded border p-2" disabled={busy} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Chuyển khoản</option><option>Tiền mặt</option><option>Ví điện tử</option></select></label>
        <label className="block">Ghi chú<textarea className="block w-full rounded border p-2" maxLength={1000} disabled={busy} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /></label>
        <Button type="submit" disabled={busy || !paymentMethod.trim()}>Ghi nhận thanh toán</Button>
      </form>}
      {role === 'customer' && record.status === 'awaiting_customer_confirmation' && <div className="flex gap-2"><Button disabled={busy || !note.trim()} onClick={() => void run(() => confirmReturn(id, 'disputed', note))}>Yêu cầu xem xét lại</Button><Button disabled={busy || !!record.settlementBlocker || record.netRefundAmount === null || record.amountDueFromCustomer === null} onClick={() => void run(() => confirmReturn(id, 'accepted', note))}>Đồng ý quyết toán</Button></div>}
    </section>
  )
}
