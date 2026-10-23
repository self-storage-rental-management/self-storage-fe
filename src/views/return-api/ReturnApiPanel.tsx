import { useEffect, useRef, useState } from 'react'
import { Button, Card, Input, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { FilePreviewList } from '../staff/StaffFileUpload'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { rentalMoney } from '../rental-api/presentation'
import {
  completeRefund,
  confirmReturn,
  feeKeys,
  getReturn,
  inspectReturn,
  listReturns,
  paySettlement,
  requestReturn,
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
  disputed: 'Đang xem xét khiếu nại',
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
  ['disputed', 'Đang xem xét khiếu nại'],
  ['payment_due', 'Chờ thanh toán quyết toán'],
  ['refund_pending', 'Chờ hoàn cọc'],
  ['completed', 'Đã hoàn tất'],
]

export function ReturnSummary({ record }: { record: ApiReturn }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold">
        {record.unitNumber} · {labels[record.status]}
      </h4>
      <p>
        {record.facilityName} · Ngày trả: {record.scheduledDate}
      </p>
      <p>Cọc theo hợp đồng: {rentalMoney(record.depositAmount, 'VND')}</p>
      <p>Phí đã ghi nhận: {rentalMoney(record.totalDeductions, 'VND')}</p>
      <p>Khoản hoàn tiền: {rentalMoney(record.netRefundAmount, 'VND')}</p>
      <p>Khách cần đóng thêm: {rentalMoney(record.amountDueFromCustomer, 'VND')}</p>
      {record.evidencePhotos && (
        <p>Bằng chứng nghiệm thu: {record.evidencePhotos.length} tệp</p>
      )}
      {record.settlementBlocker && (
        <p role="status" className="rounded bg-amber-50 p-3">
          Chưa đủ chứng cứ về số cọc đang giữ, tiền đã thu hoặc tiền hoàn đã
          chuyển. Hồ sơ chưa được xác nhận thanh toán/hoàn tiền thành công.
        </p>
      )}
      {record.inspectionNotes && <p>Nghiệm thu: {record.inspectionNotes}</p>}
      {record.managerResolutionNote && (
        <p>Kết quả xem xét: {record.managerResolutionNote}</p>
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
  const read = useRentalApiResource(`${identity}:${page}`, () => listReturns(role, page, 100))
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApiReturn['status'] | 'all'>('all')
  const [scheduledDateFilter, setScheduledDateFilter] = useState('')
  const [sort, setSort] = useState<'date-asc' | 'date-desc' | 'customer'>('date-asc')

  async function run(work: () => Promise<ApiReturn>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setFeedback('')
    try {
      const result = await work()
      if (!mounted.current || getAuthenticatedActor()?.id !== actor?.id) return
      setSelected(result.id)
      read.refresh()
      onChanged?.()
      setFeedback('Máy chủ đã ghi nhận thao tác. Đang tải lại hồ sơ.')
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
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .filter((item) => !scheduledDateFilter || item.scheduledDate === scheduledDateFilter)
    .filter((item) => {
      const query = search.trim().toLocaleLowerCase('vi')
      if (!query) return true
      return [item.id, item.customerName, item.unitNumber, item.facilityName]
        .some((value) => value.toLocaleLowerCase('vi').includes(query))
    })
    .sort((left, right) => {
      if (sort === 'customer') return left.customerName.localeCompare(right.customerName, 'vi')
      const difference = left.scheduledDate.localeCompare(right.scheduledDate)
      return sort === 'date-desc' ? -difference : difference
    })
  const readable = actor?.status === 'ACTIVE' && (
    actor.roles.includes(role.toUpperCase() as 'CUSTOMER' | 'STAFF' | 'MANAGER') ||
    (role === 'manager' && (actor.roles.includes('BUSINESS') || actor.roles.includes('ADMIN')))
  )
  if (!readable) return null

  return (
    <div className="space-y-4">
      {role === 'customer' && rentalId && rentalActive && (
        <Card className="space-y-2 p-4">
          <h3 className="font-bold">Trả kho & quyết toán</h3>
          <form onSubmit={(event) => { event.preventDefault(); void run(() => requestReturn(rentalId, date, notes)) }} className="space-y-2">
          <label className="block">Ngày trả kho<input type="date" required value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} className="block rounded border p-2" /></label>
          <label className="block">Lý do / ghi chú<textarea value={notes} maxLength={2000} disabled={busy} onChange={(event) => setNotes(event.target.value)} className="block w-full rounded border p-2" /></label>
          <Button type="submit" disabled={busy || !date || read.loading}>Gửi yêu cầu trả kho</Button>
          </form>
        </Card>
      )}
      {role !== 'customer' && <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Tìm mã, khách hàng hoặc gian kho" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} />
          <Select label="Trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as ApiReturn['status'] | 'all'); setPage(0) }}>
            {returnStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Input label="Ngày trả kho" type="date" value={scheduledDateFilter} onChange={(event) => { setScheduledDateFilter(event.target.value); setPage(0) }} />
          <Select label="Sắp xếp" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(0) }}>
            <option value="date-asc">Ngày trả kho sớm trước</option>
            <option value="date-desc">Ngày trả kho muộn trước</option>
            <option value="customer">Tên khách hàng A–Z</option>
          </Select>
        </div>
      </Card>}
      <Card>
        {read.loading && <p role="status" className="p-4 text-sm text-stone-500">Đang tải hồ sơ trả kho...</p>}
        {!!read.error && <p role="alert" className="p-4 text-sm text-red-700">{returnError(read.error)}</p>}
        {feedback && <p role="status" className="border-b border-stone-200 p-4 text-sm text-stone-600">{feedback}</p>}
        {role !== 'customer' && <p className="border-b border-stone-200 px-4 py-3 text-xs text-stone-500">Hiển thị {rows.length} hồ sơ phù hợp bộ lọc.</p>}
        <Table>
          <Thead>
            <tr>
              <Th>Mã trả kho</Th>
              <Th>Khách hàng</Th>
              <Th>Gian kho</Th>
              <Th>Ngày trả kho</Th>
              <Th>Trạng thái</Th>
              <Th>Quyết toán</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {rows.map((record) => (
              <Tr key={record.id}>
                <Td><span className="font-mono text-xs text-stone-500">{record.id}</span></Td>
                <Td><p className="font-semibold text-stone-900">{record.customerName}</p><p className="text-xs text-stone-500">{record.facilityName}</p></Td>
                <Td className="font-medium">{record.unitNumber}</Td>
                <Td className="text-sm">{record.scheduledDate}</Td>
                <Td><span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">{labels[record.status]}</span></Td>
                <Td className="text-sm">{record.settlementBlocker ? 'Cần bổ sung chứng cứ' : record.amountDueFromCustomer && record.amountDueFromCustomer > 0 ? 'Còn khoản phải thu' : 'Đang đối chiếu'}</Td>
                <Td className="text-right"><Button variant="outline" size="sm" disabled={busy} onClick={() => setSelected(record.id)}>Xem và xử lý</Button></Td>
              </Tr>
            ))}
            {!read.loading && !rows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">Không có hồ sơ trả kho phù hợp bộ lọc.</td></tr>}
          </Tbody>
        </Table>
        {!rentalId && rows.length > 0 && <div className="flex items-center justify-end gap-3 border-t border-stone-200 p-3 text-sm"><Button variant="outline" size="sm" disabled={busy || page === 0} onClick={() => { setSelected(null); setPage((value) => value - 1) }}>Trang trước</Button><span>Trang {page + 1}</span><Button variant="outline" size="sm" disabled={busy || !read.data || page + 1 >= read.data.pagination.totalPages} onClick={() => { setSelected(null); setPage((value) => value + 1) }}>Trang sau</Button></div>}
      </Card>
      {selected && <ReturnActions key={selected} role={role} id={selected} run={run} busy={busy} />}
    </div>
  )
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

  if (detail.loading) return <p role="status">Đang tải chi tiết...</p>
  if (detail.error) return <p role="alert">{returnError(detail.error)}</p>
  if (!record) return null

  const write = role === 'customer' || !!actor?.permissions.includes(role === 'manager' ? 'rentals:update' : 'returns:process')
  const canInspect = write && role === 'staff' && ['requested', 'scheduled'].includes(record.status)
  const canReview = write && role === 'manager' && record.status === 'disputed'
  const canRefund = write && role === 'staff' && record.status === 'refund_pending'
  const canPaySettlement = role === 'customer' && record.status === 'payment_due'
  const submitInspection = async () => {
    const evidencePhotos: string[] = []
    for (const file of evidenceFiles) {
      const asset = await uploadReturnEvidence(id, file)
      evidencePhotos.push(asset.id)
    }
    return inspectReturn(id, { ...fees, inventoryMatch: inventory, damageClassification: damage, staffNotes: note, evidencePhotos, ...returned, proposedUnitStatus: unit })
  }

  return (
    <section className="space-y-3 rounded border p-3" aria-label="Xử lý trả kho">
      <ReturnSummary record={record} />
      {(canInspect || canReview || (role === 'customer' && record.status === 'awaiting_customer_confirmation')) && <label className="block">Ghi chú / lý do<textarea className="block w-full rounded border p-2" disabled={busy} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} /></label>}
      {(canInspect || canReview) && <form onSubmit={(event) => { event.preventDefault(); void run(canInspect ? submitInspection : () => reviewDispute(id, { ...fees, resolutionNote: note, proposedUnitStatus: unit })) }} className="space-y-2">
        {feeKeys.map((key, index) => <label key={key} className="block">{['Phí hư hỏng', 'Phí vệ sinh', 'Phí mất đồ', 'Phí quá hạn', 'Phí còn thiếu'][index]} (VND)<input type="number" min="0" step="0.01" required disabled={busy} value={Number.isNaN(fees[key]) ? '' : fees[key]} onChange={(event) => setFees((current) => ({ ...current, [key]: event.target.value === '' ? NaN : Number(event.target.value) }))} className="block rounded border p-2" /></label>)}
        {canInspect && <>
          <label className="block">Đối chiếu hàng hóa<select value={inventory} disabled={busy} onChange={(event) => setInventory(event.target.value as typeof inventory)}><option value="match">Khớp</option><option value="missing">Thiếu</option><option value="excess">Dư</option></select></label>
          <label className="block">Hiện trạng<select value={damage} disabled={busy} onChange={(event) => setDamage(event.target.value as typeof damage)}><option value="no_damage">Không hư hỏng</option><option value="minor_damage">Hư hỏng nhẹ</option><option value="major_damage">Hư hỏng nặng</option><option value="abandoned_goods">Bỏ lại hàng hóa</option></select></label>
          {(['returnedKey', 'returnedCard', 'returnedLock'] as const).map((key, index) => <label key={key} className="block"><input type="checkbox" checked={returned[key]} disabled={busy} onChange={(event) => setReturned((current) => ({ ...current, [key]: event.target.checked }))} /> {['Đã trả chìa khóa', 'Đã trả thẻ', 'Đã trả khóa'][index]}</label>)}
          <label className="block">Ảnh/PDF bằng chứng nghiệm thu<input type="file" multiple accept="image/*,application/pdf" disabled={busy} onChange={(event) => setEvidenceFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} className="mt-1 block w-full rounded border p-2" /></label>
          <FilePreviewList files={evidenceFiles} onRemove={(index) => setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} disabled={busy} />
        </>}
        <label className="block">Hiện trạng kho đề xuất<select value={unit} disabled={busy} onChange={(event) => setUnit(event.target.value as typeof unit)}><option value="available">Sẵn sàng</option><option value="maintenance">Cần bảo trì</option></select></label>
        <Button type="submit" disabled={busy || (canReview && !note.trim())}>{canInspect ? 'Ghi nhận nghiệm thu' : 'Ghi nhận xem xét khiếu nại'}</Button>
      </form>}
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
