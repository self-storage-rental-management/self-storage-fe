import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { FilePreviewList } from '../staff/StaffFileUpload'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { rentalDate, rentalMoney } from '../rental-api/presentation'
import RecoveryReturnSettlement from './RecoveryReturnSettlement'
import RecoveryTaskLink from '../rental-api/RecoveryTaskLink'
import {
  completeRefund,
  confirmReturn,
  fastApproveReturn,
  feeKeys,
  inspectReturn,
  sanitizeFees,
  listReturns,
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
  awaiting_business_review: 'Chờ Business duyệt bảng giá cũ',
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
  ['awaiting_business_review', 'Chờ Business duyệt bảng giá cũ'],
  ['awaiting_customer_confirmation', 'Chờ khách xác nhận'],
  ['disputed', 'Đang khiếu nại - Cần BO giải quyết'],
  ['payment_due', 'Chờ thanh toán quyết toán'],
  ['refund_pending', 'Chờ hoàn cọc'],
  ['completed', 'Đã hoàn tất'],
]

export function ReturnSummary({ record, hideTerminationFee = false }: { record: ApiReturn; hideTerminationFee?: boolean }) {
  if (record.sourceType === "RECOVERY") return <RecoveryReturnSummary record={record} hideTerminationFee={hideTerminationFee} />
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
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{labels[record.status]}</span>
      </div>
      <p className="text-sm text-stone-600">{'Ngày dự kiến trả: '}<strong className="text-stone-900">{rentalDate(record.scheduledDate)}</strong></p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([
          ['Cọc theo hợp đồng', record.depositAmount], ['Phí đã ghi nhận', record.totalDeductions],
          ...(record.setupEarlyExit ? [['Tiền thuê thực thu được quyết toán', record.rentalRefundCredit], ...(!hideTerminationFee ? [['Phí chấm dứt sớm một lần', record.earlyTerminationFee]] as const : [])] as const : []),
          ['Khoản hoàn tiền', record.netRefundAmount], ['Khách cần đóng thêm', record.amountDueFromCustomer],
        ] as const).map(([label, amount]) => <div key={label} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-sm font-bold text-stone-900">{amount == null ? 'Chưa xác định' : rentalMoney(amount, 'VND')}</p></div>)}
      </div>
      {record.setupExitRequested && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{record.setupEarlyExit
        ? hideTerminationFee ? 'Quyết toán trả kho trong setup theo bảng kê đã ghi nhận.' : 'Quyết toán trả kho trong setup. Tiền thuê thực thu và cọc bảo đảm được trừ phí chấm dứt sớm một lần cùng các khoản phí có chứng cứ.'
        : record.setupReturnedAt ? 'Kho được nghiệm thu sau hạn setup, áp dụng quyết toán của kỳ thuê đã bắt đầu.' : 'Staff cần xác nhận đã dọn hết hàng và bàn giao kho trống. Điều khoản setup áp dụng theo thời điểm nghiệm thu thực tế.'}</p>}
      {record.settlementBlocker && (
        <p role="status" className="rounded bg-amber-50 p-3">
          {record.settlementBlocker}
        </p>
      )}
    </div>
  )
}

function RecoveryReturnSummary({ record, hideTerminationFee }: { record: ApiReturn; hideTerminationFee: boolean }) {
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
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{record.sourceType === 'RECOVERY' && record.status === 'completed' ? record.recoveryTaskStatus === 'CLOSED' ? 'Đã hoàn tất thu hồi' : 'Quyết toán xong, chờ thu hồi' : (record.status === "refund_pending" ? "Chờ hoàn tiền quyết toán" : labels[record.status])}</span>
      </div>
      <p className="text-sm text-stone-600">{record.sourceType === 'RECOVERY' ? 'Hồ sơ từ thu hồi kho - Ngày kiểm kê: ' : 'Ngày dự kiến trả: '}<strong className="text-stone-900">{rentalDate(record.scheduledDate)}</strong></p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([
          ['Cọc bảo đảm thực thu', record.depositAmount], ['Phí đã ghi nhận', record.totalDeductions],
          ...(record.setupEarlyExit ? [['Tiền thuê thực thu được quyết toán', record.rentalRefundCredit], ...(!hideTerminationFee ? [['Phí chấm dứt sớm một lần', record.earlyTerminationFee]] as const : [])] as const : []),
          ['Khoản hoàn tiền', record.netRefundAmount], ['Khách cần đóng thêm', record.amountDueFromCustomer],
        ] as const).map(([label, amount]) => <div key={label} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-sm font-bold text-stone-900">{amount == null ? 'Chưa xác định' : rentalMoney(amount, 'VND')}</p></div>)}
      </div>
      {record.setupExitRequested && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{record.setupEarlyExit
        ? hideTerminationFee ? 'Quyết toán trả kho trong setup theo bảng kê đã ghi nhận.' : 'Quyết toán trả kho trong setup. Tiền thuê thực thu và cọc bảo đảm được trừ phí chấm dứt sớm một lần cùng các khoản phí có chứng cứ.'
        : record.setupReturnedAt ? 'Kho được nghiệm thu sau hạn setup, áp dụng quyết toán của kỳ thuê đã bắt đầu.' : 'Staff cần xác nhận đã dọn hết hàng và bàn giao kho trống. Điều khoản setup áp dụng theo thời điểm nghiệm thu thực tế.'}</p>}
      {record.settlementBlocker && (
        <p role="status" className="rounded bg-amber-50 p-3">
          {record.settlementBlocker}
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

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [initializedExpansion, setInitializedExpansion] = useState(false)

  useEffect(() => {
    if (rows.length > 0 && !initializedExpansion) {
      const activeIds = rows.filter((r) => r.status !== 'completed').map((r) => r.id)
      setExpandedIds(new Set(activeIds.length > 0 ? activeIds : [rows[0].id]))
      setInitializedExpansion(true)
    }
  }, [rows, initializedExpansion])

  const allExpanded = rows.length > 0 && rows.every((r) => expandedIds.has(r.id))

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(rows.map((r) => r.id)))
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (!readable) return null

  return (
    <div className={rentalId ? 'space-y-4' : 'space-y-4 rounded-xl border border-stone-200 bg-white p-5'}>
      {!rentalId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-stone-900">Trả kho & quyết toán</h3>
            {rows.length > 0 && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                {rows.length} hồ sơ
              </span>
            )}
          </div>
          {rows.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={toggleAllExpanded}
                className="text-xs font-medium cursor-pointer"
              >
                {allExpanded ? '▲ Thu gọn tất cả' : '▼ Trải ra tất cả'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        rows.length > 1 && (
          <div className="flex justify-end pb-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={toggleAllExpanded}
              className="text-xs font-medium cursor-pointer"
            >
              {allExpanded ? '▲ Thu gọn tất cả' : '▼ Trải ra tất cả'}
            </Button>
          </div>
        )
      )}
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
      {rows.map((record) => {
        const isExpanded = expandedIds.has(record.id)
        const isCompleted = record.status === 'completed'
        const badgeClass =
          record.status === 'disputed'
            ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
            : record.status === 'completed'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : record.status === 'refund_pending'
            ? 'bg-purple-100 text-purple-800 border border-purple-300 font-semibold'
            : 'bg-amber-50 text-amber-800 border border-amber-200'

        return (
          <div key={record.id} className="rounded-xl border border-stone-200 bg-white shadow-xs transition overflow-hidden">
            {/* ─── Compact Summary Header (Clickable) ─── */}
            <div
              className={`flex flex-wrap items-center justify-between gap-3 p-3.5 cursor-pointer transition select-none ${
                isExpanded ? 'bg-stone-50/80 border-b border-stone-200' : 'hover:bg-stone-50/60'
              }`}
              onClick={() => toggleExpand(record.id)}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200 font-mono">
                  {record.unitNumber}
                </span>
                <span className="text-xs font-medium text-stone-500">
                  {record.facilityName}
                </span>
                {record.customerName && (
                  <span className="text-xs text-stone-700 bg-white px-2 py-0.5 rounded border border-stone-200">
                    Khách: <strong className="font-semibold text-stone-800">{record.customerName}</strong>
                  </span>
                )}
                <span className="text-xs text-stone-500">
                  Hạn trả: <strong className="text-stone-700">{rentalDate(record.scheduledDate)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                {record.status === 'refund_pending' && record.netRefundAmount != null && (
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                    Hoàn cọc: {rentalMoney(record.netRefundAmount, 'VND')}
                  </span>
                )}
                {record.status === 'payment_due' && record.amountDueFromCustomer != null && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    Cần thu: {rentalMoney(record.amountDueFromCustomer, 'VND')}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                  {labels[record.status]}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpand(record.id)
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    isExpanded
                      ? 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                      : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold'
                  }`}
                  title={isExpanded ? 'Thu gọn hồ sơ này' : 'Trải ra xem chi tiết và xử lý'}
                >
                  {isExpanded ? '▲ Thu gọn' : '▼ Trải ra'}
                </button>
              </div>
            </div>

            {/* ─── Expanded Details & Actions ─── */}
            {isExpanded && (
              <div className="p-4 space-y-4">
                <ReturnActions
                  role={role}
                  record={record}
                  run={run}
                  busy={busy || read.loading || (recoveryBusy && !recoveryLocks.current.has(record.id))}
                  recoveryLocked={recoveryBusy}
                  onRecoveryLocked={value => {
                    if (value) recoveryLocks.current.add(record.id)
                    else recoveryLocks.current.delete(record.id)
                    recoveryLock.current = recoveryLocks.current.size > 0
                    setRecoveryBusy(recoveryLock.current)
                  }}
                  onRecoveryChanged={() => {
                    setFeedback('Đã cập nhật hồ sơ trả kho.')
                    read.refresh()
                    onChanged?.()
                  }}
                />
                {role === 'customer' && record.status === 'requested' && editing !== record.id && (
                  <div className="mt-3 flex justify-end border-t border-stone-100 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || read.loading}
                      onClick={() => {
                        setEditing(record.id)
                        setDate(record.scheduledDate)
                        setNotes(record.customerNotes || '')
                      }}
                    >
                      Chỉnh sửa yêu cầu
                    </Button>
                  </div>
                )}
                <div className="flex justify-end border-t border-stone-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(record.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800 hover:underline cursor-pointer"
                  >
                    ▲ Thu gọn hồ sơ {record.unitNumber}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {!rentalId && rows.length > 0 && (
        <div className="flex gap-2">
          <Button disabled={busy || recoveryBusy || page === 0} onClick={() => { if (!recoveryLock.current) setPage((value) => value - 1) }}>Trang trước</Button>
          <span>Trang {page + 1}</span>
          <Button disabled={busy || recoveryBusy || !read.data || page + 1 >= read.data.pagination.totalPages} onClick={() => { if (!recoveryLock.current) setPage((value) => value + 1) }}>Trang sau</Button>
        </div>
      )}
    </div>
  )
}

function FeeInputRow({
  label,
  icon,
  value,
  onChange,
  disabled,
  readOnly,
}: {
  label: string
  icon: string
  value: number
  onChange: (val: number) => void
  disabled?: boolean
  readOnly?: boolean
}) {
  const displayVal = Number.isNaN(value) || value === 0 ? '' : value
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-2.5 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-500">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
          <span>{icon}</span>
          <span>{label}</span>
        </label>
        {readOnly && <span className="text-[10px] text-stone-400 font-medium">Tự động</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="number"
            min="0"
            step="1000"
            readOnly={readOnly}
            disabled={disabled}
            value={displayVal}
            placeholder="0"
            onChange={(e) => {
              const v = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))
              onChange(v)
            }}
            className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-right font-mono text-sm font-bold text-stone-900 focus:outline-none"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400">₫</span>
        </div>
      </div>
      {!readOnly && !disabled && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {[
            { label: '0đ', add: 0, reset: true },
            { label: '+50k', add: 50000 },
            { label: '+100k', add: 100000 },
            { label: '+200k', add: 200000 },
            { label: '+500k', add: 500000 },
          ].map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() => {
                const cur = Number.isNaN(value) ? 0 : value
                onChange(pill.reset ? 0 : cur + pill.add)
              }}
              className="rounded-md border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer"
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}
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
  const [vacatedReturnId, setVacatedReturnId] = useState<string | null>(null)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
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
  const recoveryNextStep = !recovery ? null : record.recoveryTaskStatus === 'CLOSED'
    ? 'Thu hồi đã hoàn tất. Hồ sơ thuê đã kết thúc và trạng thái kho đã được cập nhật.'
    : record.status === 'completed' ? 'Quyết toán đã hoàn tất. Hồ sơ thuê chỉ kết thúc sau khi nhân viên hoàn tất xử lý tài sản và giải phóng kho.'
      : record.status === 'payment_due' ? 'Liên hệ cơ sở để thanh toán khoản quyết toán còn thiếu. Nhân viên ghi nhận tiền kèm biên lai đã đối chiếu.'
        : record.status === 'refund_pending' ? 'Cơ sở thực hiện hoàn tiền và ghi nhận biên lai quyết toán. Thu hồi kho được hoàn tất riêng sau đó.' : null
  const submitInspection = async () => {
    const unitVacated = vacatedReturnId === id
    if (record.setupExitRequested && (!unitVacated || damage === 'abandoned_goods')) {
      throw new Error('Cần xác nhận khách đã đưa hết hàng ra và bàn giao kho trống trước khi nghiệm thu trả kho trong setup.')
    }
    const evidencePhotos: string[] = []
    for (const file of evidenceFiles) {
      const asset = await uploadReturnEvidence(id, file, role)
      evidencePhotos.push(asset.id)
    }
    return inspectReturn(id, { ...sanitizeFees(fees), inventoryMatch: inventory, damageClassification: damage, staffNotes: note, evidencePhotos, ...returned, proposedUnitStatus: unit, unitVacated })
  }

  return (
    <section className="space-y-4" aria-label="Xử lý trả kho">
      <ReturnSummary record={record} hideTerminationFee={role === 'customer'} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">Bước tiếp theo</p>
        <p className="mt-1">{recoveryNextStep ?? { requested: 'Yêu cầu đã được gửi. Cơ sở sẽ sắp xếp lịch và thực hiện nghiệm thu trước khi quyết toán.', scheduled: 'Đến cơ sở theo ngày hẹn để trả kho và bàn giao cho nhân viên nghiệm thu.', inspected: 'Nghiệm thu đã được ghi nhận. Chờ cơ sở gửi kết quả quyết toán để khách hàng xác nhận.', awaiting_business_review: 'Hồ sơ cũ chưa có bảng giá trả sớm snapshot. Chờ Business duyệt thủ công.', awaiting_customer_confirmation: 'Kiểm tra các khoản phí bên dưới, sau đó đồng ý quyết toán hoặc yêu cầu xem xét lại.', disputed: 'Hồ sơ đang có khiếu nại từ khách hàng. Cần Ban Điều Hành (BO) hoặc Quản lý giải quyết trước khi tiếp tục.', payment_due: 'Thanh toán khoản quyết toán còn thiếu để tiếp tục hoàn tất trả kho.', refund_pending: 'Cơ sở đang xử lý hoàn cọc. Hồ sơ chỉ hoàn tất khi khoản hoàn tiền được ghi nhận.', completed: 'Hồ sơ trả kho và quyết toán đã hoàn tất.' }[record.status]}</p>
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
            {!recovery && record.setupEarlyExit && <>
              <div className="flex justify-between gap-3 py-2"><dt className="text-stone-500">Tiền thuê thực thu được quyết toán</dt><dd className="shrink-0 font-medium">{record.rentalRefundCredit == null ? 'Chưa xác định' : rentalMoney(record.rentalRefundCredit, 'VND')}</dd></div>
              {role !== 'customer' && <div className="flex justify-between gap-3 py-2"><dt className="text-stone-500">Phí chấm dứt sớm một lần</dt><dd className="shrink-0 font-medium">{record.earlyTerminationFee == null ? 'Chưa xác định' : rentalMoney(record.earlyTerminationFee, 'VND')}</dd></div>}
            </>}
            {feeKeys.map((key, index) => <div key={key} className="flex justify-between gap-3 py-2"><dt className="text-stone-500">{['Phí hư hỏng', 'Phí vệ sinh', 'Phí mất đồ', 'Phí quá hạn', 'Phí còn thiếu'][index]}</dt><dd className="shrink-0 font-medium">{rentalMoney(record[key], 'VND')}</dd></div>)}
            <div className="flex justify-between gap-3 py-3 font-bold"><dt>Tổng phí ghi nhận</dt><dd>{rentalMoney(record.totalDeductions, 'VND')}</dd></div>
          </dl>
        </div>
      </div>

      {/* Ghi chú phản hồi cho khách khi xác nhận */}
      {role === 'customer' && record.status === 'awaiting_customer_confirmation' && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
          <label className="block text-xs font-bold text-stone-800">
            Ghi chú phản hồi / lý do khiếu nại (nếu có)
          </label>
          <textarea
            className="block w-full rounded-xl border border-stone-300 p-3 text-sm focus:border-amber-500 focus:outline-none"
            disabled={busy}
            value={note}
            maxLength={2000}
            rows={3}
            placeholder="Nhập ý kiến của bạn về bảng quyết toán..."
            onChange={(event) => setNote(event.target.value)}
          />

        </div>
      )}

      {/* ─── OPTION 1: MODERN 2-COLUMN INSPECTION & LIVE SETTLEMENT ─── */}
      {(canInspect || canReview) && (() => {
        const deposit = record.depositAmount ?? 0
        const totalFees = Object.values(fees).reduce((sum, v) => sum + (Number.isNaN(v) ? 0 : v), 0)
        const projectedRefund = Math.max(0, deposit - totalFees)
        const projectedDue = Math.max(0, totalFees - deposit)

        const handleQuickStandardPass = () => {
          setFees({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0 })
          setInventory('match')
          setDamage('no_damage')
          setReturned({ returnedKey: true, returnedCard: true, returnedLock: true })
          setUnit('available')
          if (record.setupExitRequested) setVacatedReturnId(id)
          const standardNote = 'Gian kho sạch sẽ, nguyên vẹn. Đã thu hồi đủ chìa khóa, thẻ từ và ổ khóa. Kho đạt chuẩn hoàn cọc 100%.'
          setNote(standardNote)
          void run(async () => {
            return inspectReturn(id, {
              damageFee: 0,
              cleaningFee: 0,
              lostItemFee: 0,
              overdueFee: 0,
              outstandingFee: 0,
              inventoryMatch: 'match',
              damageClassification: 'no_damage',
              staffNotes: standardNote,
              evidencePhotos: [],
              returnedKey: true,
              returnedCard: true,
              returnedLock: true,
              proposedUnitStatus: 'available',
              unitVacated: true,
            })
          })
        }

        return (
          <div className="space-y-4">
            {/* 1-Click Fast Pass Banner for Staff */}
            {canInspect && !recovery && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white text-lg shadow-sm">
                      ✨
                    </span>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Nghiệm thu đạt chuẩn (Kho nguyên vẹn)</h4>
                      <p className="text-xs text-stone-600">
                        Nếu gian kho sạch đẹp, khách bàn giao đủ chìa/thẻ và không có hư hại, bạn có thể duyệt hoàn cọc 100% với 1 chạm.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={handleQuickStandardPass}
                      className="!bg-emerald-600 hover:!bg-emerald-700 text-white font-bold px-4 py-2 shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      Nghiệm thu đạt chuẩn & Hoàn cọc 100%
                    </Button>

                  </div>
                </div>
              </div>
            )}

            {/* Form Nghiệm Thu 2 Cột */}
            <form onSubmit={(event) => {
              event.preventDefault()
              void run(canInspect ? submitInspection : () => reviewDispute(id, { ...fees, resolutionNote: note, proposedUnitStatus: unit }))
            }} className="space-y-4">
              <div className="grid gap-5 lg:grid-cols-12">
                {/* ─── CỘT TRÁI (7 cols): Khảo sát thực địa, Phụ kiện & Bằng chứng ─── */}
                <div className="lg:col-span-7 space-y-4">
                  {canInspect && (
                    <>
                      {/* KHỐI 1: BÀN GIAO PHỤ KIỆN & CHÌA KHÓA */}
                      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                          <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                            <span>🔑</span>
                            <span>1. Thu hồi phụ kiện & chìa khóa</span>
                          </h4>
                          <span className="text-[11px] font-medium text-stone-500">Chạm để đổi trạng thái</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {([
                            { key: 'returnedKey' as const, label: 'Chìa khóa cơ', icon: '🔑', desc: 'Chìa mở cửa gian kho' },
                            { key: 'returnedCard' as const, label: 'Thẻ từ ra vào', icon: '💳', desc: 'Thẻ quét cổng an ninh' },
                            { key: 'returnedLock' as const, label: 'Ổ khóa cơ sở', icon: '🔒', desc: 'Khóa do cơ sở cấp' },
                          ]).map((item) => {
                            const isReturned = returned[item.key]
                            return (
                              <button
                                key={item.key}
                                type="button"
                                disabled={busy}
                                onClick={() => setReturned((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                                className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer select-none ${
                                  isReturned
                                    ? 'border-emerald-400 bg-emerald-50/70 text-emerald-950 shadow-xs ring-1 ring-emerald-400'
                                    : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:border-stone-300 hover:bg-stone-100/60'
                                }`}
                              >
                                <div className="flex w-full items-center justify-between">
                                  <span className="text-xl">{item.icon}</span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                    isReturned ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
                                  }`}>
                                    {isReturned ? '✓ Đã thu' : 'Chưa nhận'}
                                  </span>
                                </div>
                                <span className="mt-2 text-xs font-bold">{item.label}</span>
                                <span className="text-[11px] text-stone-500 leading-tight mt-0.5">{item.desc}</span>
                              </button>
                            )
                          })}
                        </div>
                        {record.setupExitRequested && (
                          <div className="pt-2 border-t border-stone-100">
                            <label className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                              vacatedReturnId === id
                                ? 'border-emerald-400 bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-400'
                                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                            }`}>
                              <input
                                type="checkbox"
                                checked={vacatedReturnId === id}
                                disabled={busy || damage === 'abandoned_goods'}
                                onChange={(e) => setVacatedReturnId(e.target.checked ? id : null)}
                                className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <p className="text-xs font-bold">Xác nhận khách đã dọn sạch hàng và bàn giao kho trống</p>
                                <p className="text-[11px] text-stone-500">Điều kiện bắt buộc cho hồ sơ trả kho trong thời gian setup.</p>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* KHỐI 2: ĐÁNH GIÁ HIỆN TRẠNG KHO & HÀNG HÓA */}
                      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-4">
                        <div className="border-b border-stone-100 pb-2.5">
                          <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                            <span>🏢</span>
                            <span>2. Hiện trạng kho & Kiểm kê hàng hóa</span>
                          </h4>
                        </div>

                        {/* Đối chiếu hàng hóa */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-stone-700 block">
                            Đối chiếu hàng hóa lúc bàn giao
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { id: 'match', label: 'Khớp khai báo', icon: '🟢' },
                              { id: 'missing', label: 'Thiếu hàng', icon: '🟡' },
                              { id: 'excess', label: 'Dư thừa', icon: '🟠' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={busy}
                                onClick={() => setInventory(opt.id)}
                                className={`rounded-xl border py-2.5 px-2 text-center text-xs transition cursor-pointer ${
                                  inventory === opt.id
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 font-bold shadow-xs'
                                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                                }`}
                              >
                                <div className="text-base">{opt.icon}</div>
                                <div className="mt-0.5 font-medium">{opt.label}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Mức độ hư hại */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-stone-700 block">
                            Mức độ hư hại gian kho (Trần, Vách, Sàn, Cửa)
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {([
                              { id: 'no_damage', label: 'Không hư hại', desc: 'Kho nguyên vẹn', icon: '🟢' },
                              { id: 'minor_damage', label: 'Hư hại nhẹ', desc: 'Trầy xước/bẩn', icon: '🟡' },
                              { id: 'major_damage', label: 'Hư hại nặng', desc: 'Móp méo/vỡ', icon: '🔴' },
                              { id: 'abandoned_goods', label: 'Bỏ lại hàng', desc: 'Còn đồ bên trong', icon: '📦' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setDamage(opt.id)
                                  setVacatedReturnId(null)
                                }}
                                className={`rounded-xl border p-2.5 text-center transition cursor-pointer ${
                                  damage === opt.id
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 font-bold shadow-xs'
                                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                                }`}
                              >
                                <div className="text-base">{opt.icon}</div>
                                <div className="text-xs font-bold mt-0.5">{opt.label}</div>
                                <div className="text-[10px] text-stone-500 mt-0.5">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Đề xuất trạng thái sau trả kho */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-stone-700 block">
                            Đề xuất trạng thái gian kho sau khi nghiệm thu
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {([
                              { id: 'available' as const, label: 'Sẵn sàng cho thuê tiếp', desc: 'Kho đạt chuẩn vệ sinh & kỹ thuật', icon: '✅' },
                              { id: 'maintenance' as const, label: 'Cần bảo trì / vệ sinh', desc: 'Cần staff xử lý trước khi cho thuê', icon: '🔧' },
                            ]).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={busy}
                                onClick={() => setUnit(opt.id)}
                                className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                                  unit === opt.id
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 font-bold shadow-xs'
                                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{opt.icon}</span>
                                  <span className="text-xs font-bold">{opt.label}</span>
                                </div>
                                <p className="text-[11px] text-stone-500 mt-1">{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* KHỐI 3: BẰNG CHỨNG HÌNH ẢNH & GHI CHÚ */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-4">
                    <div className="border-b border-stone-100 pb-2.5">
                      <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <span>📸</span>
                        <span>3. Ảnh hiện trường & Biên bản nghiệm thu</span>
                      </h4>
                    </div>

                    {canInspect && (
                      <div className="space-y-2.5">
                        <label className="text-xs font-semibold text-stone-700 block">
                          Tải ảnh chụp kho / Biên bản đối chứng
                        </label>
                        <div className="relative rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-4 text-center hover:border-emerald-500 hover:bg-emerald-50/30 transition cursor-pointer group">
                          <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            disabled={busy}
                            onChange={(event) => setEvidenceFiles((current) => [...current, ...Array.from(event.target.files ?? [])])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            title="Tải ảnh bằng chứng nghiệm thu"
                          />
                          <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                            <span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
                            <p className="text-xs font-bold text-stone-800">
                              Nhấn để chọn ảnh hoặc kéo thả ảnh chụp kho vào đây
                            </p>
                            <p className="text-[11px] text-stone-500">
                              Hỗ trợ định dạng JPG, PNG, PDF (có thể chọn nhiều ảnh)
                            </p>
                          </div>
                        </div>
                        <FilePreviewList
                          files={evidenceFiles}
                          onRemove={(index) => setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                          disabled={busy}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700 block">
                        {canInspect ? 'Ghi chú biên bản của nhân viên' : 'Kết luận xem xét giải quyết khiếu nại'}
                      </label>
                      <textarea
                        className="block w-full rounded-xl border border-stone-300 p-3 text-xs leading-relaxed focus:border-emerald-500 focus:outline-none bg-stone-50/40"
                        disabled={busy}
                        rows={3}
                        value={note}
                        maxLength={2000}
                        placeholder={canInspect ? 'Ví dụ: Gian kho nguyên vẹn, tường vách khô ráo, khách đã dọn sạch hàng hóa...' : 'Nhập nội dung giải quyết khiếu nại...'}
                        onChange={(event) => setNote(event.target.value)}
                      />
                      <p className="text-right text-[10px] text-stone-400">{note.length}/2000 ký tự</p>
                    </div>
                  </div>
                </div>

                {/* ─── CỘT PHẢI (5 cols): BẢNG QUYẾT TOÁN CỌC & KHẤU TRỪ ─── */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-4 sticky top-4">
                    <div className="border-b border-stone-100 pb-3">
                      <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <span>💳</span>
                        <span>Bảng quyết toán cọc & Phụ phí</span>
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Tự động tính số tiền hoàn cọc thời gian thực theo số liệu nhập.
                      </p>
                    </div>

                    {/* Tiền cọc gốc */}
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-stone-800">Tiền cọc theo hợp đồng</p>
                        <p className="text-[11px] text-stone-500">Khoản bảo đảm thực thu</p>
                      </div>
                      <span className="text-base font-extrabold text-stone-900 font-mono">
                        {rentalMoney(deposit, 'VND')}
                      </span>
                    </div>

                    {/* Danh sách 5 khoản phí khấu trừ */}
                    <div className="space-y-2">
                      <FeeInputRow label="Phí hư hỏng" icon="🔨" value={fees.damageFee} onChange={(v) => setFees((f) => ({ ...f, damageFee: v }))} disabled={busy} />
                      <FeeInputRow label="Phí vệ sinh" icon="🧹" value={fees.cleaningFee} onChange={(v) => setFees((f) => ({ ...f, cleaningFee: v }))} disabled={busy} />
                      <FeeInputRow label="Phí mất đồ / chìa khóa" icon="🔑" value={fees.lostItemFee} onChange={(v) => setFees((f) => ({ ...f, lostItemFee: v }))} disabled={busy} />
                      <FeeInputRow label="Phí quá hạn" icon="⏱️" value={fees.overdueFee} onChange={(v) => setFees((f) => ({ ...f, overdueFee: v }))} disabled={busy} />
                      <FeeInputRow label="Phí còn thiếu (Công nợ)" icon="📄" value={fees.outstandingFee} onChange={(v) => setFees((f) => ({ ...f, outstandingFee: v }))} readOnly disabled={busy} />
                    </div>

                    {/* Tổng khấu trừ */}
                    <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
                      <span className="font-semibold text-stone-700">Tổng phí khấu trừ:</span>
                      <span className="font-bold text-stone-900 font-mono">
                        {rentalMoney(totalFees, 'VND')}
                      </span>
                    </div>

                    {/* THẺ DỰ TÍNH KẾT QUẢ THỜI GIAN THỰC */}
                    {projectedDue === 0 ? (
                      <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/70 p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                            ✓ Hoàn cọc dự kiến cho khách
                          </span>
                          <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900">
                            HOÀN CỌC
                          </span>
                        </div>
                        <p className="text-xl font-black text-emerald-800 font-mono">
                          {rentalMoney(projectedRefund, 'VND')}
                        </p>
                        <p className="text-[11px] text-emerald-900 leading-relaxed">
                          Số tiền này sẽ được chuyển hoàn cho khách sau khi khách xác nhận biên bản.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-rose-300 bg-gradient-to-br from-rose-50 to-amber-50/70 p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-950 uppercase tracking-wide">
                            Khách cần nộp thêm phụ phí
                          </span>
                          <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-extrabold text-rose-900">
                            THU THÊM
                          </span>
                        </div>
                        <p className="text-xl font-black text-rose-700 font-mono">
                          {rentalMoney(projectedDue, 'VND')}
                        </p>
                        <p className="text-[11px] text-rose-900 leading-relaxed">
                          Tổng phí vượt quá tiền cọc gốc. Khách hàng cần thanh toán thêm khoản chênh lệch này.
                        </p>
                      </div>
                    )}

                    {/* Nút hành động chính */}
                    <div className="space-y-2 pt-1">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={busy || (canReview && !note.trim()) || (canInspect && !!record.setupExitRequested && (vacatedReturnId !== id || damage === 'abandoned_goods'))}
                        className="w-full !bg-emerald-600 hover:!bg-emerald-700 text-white font-bold py-3 text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>📋</span>
                        <span>{canInspect ? 'Ghi nhận kết quả nghiệm thu' : 'Ghi nhận xem xét khiếu nại'}</span>
                      </Button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setFees({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: record.outstandingFee || 0 })}
                        className="w-full py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition cursor-pointer"
                      >
                        ↺ Đặt lại tất cả phụ phí về 0đ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )
      })()}
      {role === 'staff' && !recovery && record.status === 'awaiting_customer_confirmation' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">Đang chờ khách hàng xác nhận quyết toán</span>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">Có thể duyệt hoàn tất ngay</span>
          </div>
          <p className="text-xs text-amber-800">
            Biên bản nghiệm thu đã lập. Bạn có thể xác nhận cho phép trả kho và hoàn tất hồ sơ ngay mà không cần đợi thêm.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              onClick={() => void run(() => confirmReturn(id, 'accepted', note.trim() || 'Nhân viên hỗ trợ xác nhận quyết toán trực tiếp tại quầy', role))}
            >
              ✓ Xác nhận hoàn tất trả kho ngay
            </Button>
          </div>
        </div>
      )}
      {role === 'staff' && !recovery && record.status === 'disputed' && (
        <div className="rounded-xl border border-rose-300 bg-rose-50/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">Khiếu nại từ khách hàng</span>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300">Có thể duyệt trả kho</span>
          </div>
          <p className="text-xs text-rose-800">
            Ý kiến khách: {record.customerDecisionNote || 'Cần xem xét lại'}. Bạn có thể bỏ qua khiếu nại và duyệt cho trả kho ngay.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              onClick={() => void run(() => reviewDispute(id, {
                damageFee: 0,
                cleaningFee: 0,
                lostItemFee: 0,
                overdueFee: 0,
                outstandingFee: 0,
                resolutionNote: note.trim() || 'Nhân viên duyệt bỏ qua khiếu nại và cho trả kho ngay',
                proposedUnitStatus: 'available',
              }))}
            >
              ✓ Duyệt trả kho & Hoàn tất ngay
            </Button>
          </div>
        </div>
      )}

      {role === 'staff' && !recovery && record.status === 'refund_pending' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-base shadow-xs">
                ✓
              </span>
              <div>
                <p className="font-bold text-emerald-950 text-sm">
                  Khách hàng đã hoàn thành nghĩa vụ tài chính · Tiền cọc hoàn: {rentalMoney(record.netRefundAmount, 'VND')}
                </p>
                <p className="text-xs text-emerald-800">
                  Hồ sơ đã được xác nhận quyết toán. Bấm xác nhận để hoàn tất thủ tục trả kho và giải phóng gian kho.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              className="!bg-emerald-600 hover:!bg-emerald-700 text-white font-bold px-5 py-2.5 cursor-pointer shadow-sm whitespace-nowrap"
              onClick={() => void run(() => completeRefund(id, { amount: record.netRefundAmount ?? undefined }))}
            >
              ✓ Xác nhận hoàn tất đóng hồ sơ
            </Button>
          </div>
        </div>
      )}
      {role === 'staff' && !recovery && record.status === 'payment_due' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white font-bold text-base shadow-xs">
                💵
              </span>
              <div>
                <p className="font-bold text-amber-950 text-sm">
                  Phụ phí phát sinh: {rentalMoney(record.amountDueFromCustomer, 'VND')}
                </p>
                <p className="text-xs text-amber-800">
                  Khách hàng đã thanh toán phụ phí trực tiếp tại quầy. Bấm xác nhận để đóng hồ sơ trả kho.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              className="!bg-amber-600 hover:!bg-amber-700 text-white font-bold px-5 py-2.5 cursor-pointer shadow-sm whitespace-nowrap"
              onClick={() => void run(() => confirmReturn(id, 'accepted', 'Nhân viên xác nhận hoàn tất phụ phí và đóng hồ sơ trả kho', role))}
            >
              ✓ Xác nhận đã thu & Đóng hồ sơ
            </Button>

          </div>
        </div>
      )}
      {recovery && (role === 'staff' || role === 'manager') && record.recoveryTaskId && <RecoveryTaskLink role={role} taskId={record.recoveryTaskId} facilityId={record.facilityId} disabled={busy || recoveryLocked} onChanged={onRecoveryChanged} />}
      {write && recovery && role === 'staff' && ['payment_due', 'refund_pending'].includes(record.status) && <RecoveryReturnSettlement record={record} busy={busy} onLocked={onRecoveryLocked} onChanged={onRecoveryChanged} />}
      {role === 'customer' && record.status === 'awaiting_customer_confirmation' && (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            ⏱️ <b>Thời hạn phản hồi (SLA 72 giờ):</b> Quý khách vui lòng kiểm tra biên bản và phản hồi trong vòng 72 giờ. Sau thời gian này, hệ thống sẽ tự động chốt quyết toán theo biên bản nghiệm thu.
          </div>
          <div className="flex gap-2">
            <Button disabled={busy || !note.trim()} onClick={() => void run(() => confirmReturn(id, 'disputed', note))}>Yêu cầu xem xét lại</Button>
            <Button disabled={busy || !!record.settlementBlocker || record.netRefundAmount === null || record.amountDueFromCustomer === null} onClick={() => void run(() => confirmReturn(id, 'accepted', note))}>Đồng ý quyết toán</Button>
          </div>
        </div>
      )}
      {record.customerDecisionNote && record.customerDecisionNote.includes('Auto-Settlement SLA') && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800">
          ℹ️ Quyết toán này đã được hệ thống <b>tự động xác nhận (Auto-Settlement SLA 72h)</b> do quá hạn phản hồi của khách hàng.
        </div>
      )}
    </section>
  )
}
