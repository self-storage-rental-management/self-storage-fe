import { apiRequest } from '../../services/apiClient'
import ReturnPolicyNotice from '../../components/ReturnPolicyNotice'
import EmergencyContactsPanel from '../../components/EmergencyContactsPanel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { FilePreviewList } from '../staff/StaffFileUpload'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { rentalDate, rentalMoney } from '../rental-api/presentation'
import { vietnamDateInput } from '../../utils/vietnamTime'
import RecoveryReturnSettlement from './RecoveryReturnSettlement'
import RecoveryTaskLink from '../rental-api/RecoveryTaskLink'
import {
  confirmReturn,
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
  calculateDamageFee,
  returnDamageCatalog,
  type DamageItemInput,
  type InspectionInput,
  type ReturnFees,
  type ReturnRole,
} from '../../services/returnApi'
import { listMaintenanceStaff } from '../../services/maintenanceApi'

const labels: Record<ApiReturn['status'], string> = {
  requested: 'Đã yêu cầu trả kho',
  scheduled: 'Đã hẹn nghiệm thu',
  inspected: 'Đã nghiệm thu',
  awaiting_business_review: 'Chờ duyệt quyết toán nghiệp vụ',
  awaiting_customer_confirmation: 'Chờ khách xác nhận',
  disputed: 'Đang khiếu nại - Cần BO giải quyết',
  payment_due: 'Chờ thanh toán quyết toán',
  refund_pending: 'Chờ hoàn cọc',
  recovery_required: 'Cần xử lý khách không đến',
  completed: 'Đã hoàn tất',
}

const returnStatusOptions: Array<[ApiReturn['status'] | 'all', string]> = [
  ['all', 'Tất cả trạng thái'],
  ['requested', 'Đã yêu cầu trả kho'],
  ['scheduled', 'Đã hẹn nghiệm thu'],
  ['inspected', 'Đã nghiệm thu'],
  ['awaiting_business_review', 'Chờ duyệt quyết toán nghiệp vụ'],
  ['awaiting_customer_confirmation', 'Chờ khách xác nhận'],
  ['disputed', 'Đang khiếu nại - Cần BO giải quyết'],
  ['payment_due', 'Chờ thanh toán quyết toán'],
  ['refund_pending', 'Chờ hoàn cọc'],
  ['recovery_required', 'Cần xử lý khách không đến'],
  ['completed', 'Đã hoàn tất'],
]

function returnRecoveryCutoff(value: string | null | undefined) {
  if (!value) return null
  const at = new Date(value)
  return Number.isFinite(at.getTime())
    ? at.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : null
}

function statusLabel(record: Pick<ApiReturn, 'status' | 'returnType'>) {
  if (record.status === 'awaiting_business_review' && record.returnType === 'INVENTORY_MISMATCH') {
    return 'Chờ Manager duyệt quyết toán'
  }
  if (record.status === 'awaiting_business_review') return 'Chờ Ban điều hành duyệt bảng giá cũ'
  return labels[record.status]
}

export function ReturnSummary({ record, hideTerminationFee = false, hideHeader = false }: { record: ApiReturn; hideTerminationFee?: boolean; hideHeader?: boolean }) {
  if (record.sourceType === "RECOVERY") return <RecoveryReturnSummary record={record} hideTerminationFee={hideTerminationFee} hideHeader={hideHeader} />
  const inventoryMismatch = record.returnType === 'INVENTORY_MISMATCH'
  const showFixedTerminationFee = !hideTerminationFee && !inventoryMismatch
  const badgeClass =
    record.status === 'disputed'
      ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
      : record.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-800'

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h4 className="text-lg font-bold text-stone-900">{record.unitNumber}</h4><p className="mt-1 text-sm text-stone-500">{record.facilityName}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{statusLabel(record)}</span>
        </div>
        <p className="text-sm text-stone-600">{'Ngày dự kiến trả: '}<strong className="text-stone-900">{rentalDate(record.scheduledDate)}</strong></p>
        {['requested', 'scheduled'].includes(record.status) && record.recoveryEligibleAt && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Nếu khách chưa đến và chưa hoàn tất trả kho, hồ sơ sẽ chuyển sang nhiệm vụ xử lý sau <strong>{returnRecoveryCutoff(record.recoveryEligibleAt)}</strong>. Hàng chưa được tự động di chuyển.</p>}
        {record.returnType === 'INVENTORY_MISMATCH' && <p className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">Đây là yêu cầu trả kho do kết quả kiểm kê không phù hợp. Phí và thời gian được quyết toán theo nhánh xử lý kiểm kê, không gộp với trả kho hợp lệ thông thường.</p>}
        {record.status === 'recovery_required' && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950">Khách chưa đến theo lịch và đã hết thời gian ân hạn. Hàng chưa được tự động di chuyển. Cơ sở cần lập biên bản, kiểm kê và bàn giao hai người trước khi thu hồi.</p>}
        {record.status === 'recovery_required' && record.recoveryTaskDeadlineAt && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-950">Hạn xử lý nhiệm vụ thu hồi: {returnRecoveryCutoff(record.recoveryTaskDeadlineAt)}</p>}
        {inventoryMismatch && record.earlyTerminationPolicy && <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <p className="font-semibold">Trả kho do hàng hóa sai khai báo</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Tính tiền từ ngày xác nhận nhận kho đến ngày hẹn trả kho dự kiến.</li>
            <li>Quản lý cơ sở lập quyết toán, khách xác nhận trước khi hoàn tiền hoặc thu thêm.</li>
          </ul>
        </div>}
        </>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {([
          ['Cọc theo hợp đồng', record.depositAmount], ['Phí đã ghi nhận', record.totalDeductions],
          ...(record.setupEarlyExit ? [['Tiền thuê được hoàn (80%)', record.rentalRefundCredit], ...(showFixedTerminationFee ? [['Phí chấm dứt sớm một lần', record.earlyTerminationFee]] as const : [])] as const : []),
          ...(!record.setupEarlyExit && record.activeReturnPolicy ? [['Tiền thuê các tháng chưa bắt đầu', record.activeReturnPolicy.rentalRefundAmount]] as const : []),
          ['Khoản hoàn tiền', record.netRefundAmount], ['Khách cần đóng thêm', record.amountDueFromCustomer],
        ] as const).map(([label, amount]) => <div key={label} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-sm font-bold text-stone-900">{amount == null ? 'Chưa xác định' : rentalMoney(amount, 'VND')}</p></div>)}
      </div>
      {record.setupExitRequested && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{inventoryMismatch
        ? 'Chỉ tính thời gian sử dụng thực tế và các khoản có bằng chứng, không áp dụng phí chấm dứt sớm cố định.'
        : record.setupEarlyExit
        ? hideTerminationFee ? 'Trả trong thời gian chuẩn bị: hoàn 80% tiền thuê sau ưu đãi, giữ lại 20%; tiền cọc đảm bảo quyết toán riêng sau khi trừ hư hỏng theo bảng giá.' : 'Trả trong thời gian chuẩn bị: hệ thống giữ lại 20% tiền thuê sau ưu đãi và hoàn 80%. Hư hỏng trừ vào cọc một tháng; chỉ phần vượt cọc mới yêu cầu khách trả thêm.'
        : record.setupReturnedAt ? 'Kho được nghiệm thu sau hạn chuẩn bị, áp dụng quyết toán của kỳ thuê đã bắt đầu.' : 'Nhân viên cần xác nhận đã dọn hết hàng và bàn giao kho trống. Điều khoản thời gian chuẩn bị áp dụng theo thời điểm nghiệm thu thực tế.'}</p>}
      {record.settlementBlocker && (
        <p role="status" className="rounded bg-amber-50 p-3">
          {record.settlementBlocker}
        </p>
      )}
    </div>
  )
}

function RecoveryReturnSummary({ record, hideTerminationFee, hideHeader = false }: { record: ApiReturn; hideTerminationFee: boolean; hideHeader?: boolean }) {
  const badgeClass =
    record.status === 'disputed'
      ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
      : record.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-800'

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h4 className="text-lg font-bold text-stone-900">{record.unitNumber}</h4><p className="mt-1 text-sm text-stone-500">{record.facilityName}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{record.sourceType === 'RECOVERY' && record.status === 'completed' ? record.recoveryTaskStatus === 'CLOSED' ? 'Đã hoàn tất thu hồi' : 'Quyết toán xong, chờ thu hồi' : (record.status === "refund_pending" ? "Chờ hoàn tiền quyết toán" : statusLabel(record))}</span>
        </div>
        <p className="text-sm text-stone-600">{record.sourceType === 'RECOVERY' ? 'Hồ sơ từ thu hồi kho - Ngày kiểm kê: ' : 'Ngày dự kiến trả: '}<strong className="text-stone-900">{rentalDate(record.scheduledDate)}</strong></p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {([
          ['Tiền cọc đảm bảo thuê thực thu', record.depositAmount], ['Phí đã ghi nhận', record.totalDeductions],
          ...(record.setupEarlyExit ? [['Tiền thuê thực thu được quyết toán', record.rentalRefundCredit], ...(!hideTerminationFee ? [['Phí chấm dứt sớm một lần', record.earlyTerminationFee]] as const : [])] as const : []),
          ['Khoản hoàn tiền', record.netRefundAmount], ['Khách cần đóng thêm', record.amountDueFromCustomer],
        ] as const).map(([label, amount]) => <div key={label} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-sm font-bold text-stone-900">{amount == null ? 'Chưa xác định' : rentalMoney(amount, 'VND')}</p></div>)}
      </div>
      {record.setupExitRequested && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{record.setupEarlyExit
        ? hideTerminationFee ? 'Quyết toán trả kho trong thời gian chuẩn bị theo bảng kê đã ghi nhận.' : 'Quyết toán trả kho trong thời gian chuẩn bị. Tiền thuê thực thu và tiền cọc đảm bảo thuê được trừ phí chấm dứt sớm một lần cùng các khoản phí có chứng cứ.'
        : record.setupReturnedAt ? 'Kho được nghiệm thu sau hạn chuẩn bị, áp dụng quyết toán của kỳ thuê đã bắt đầu.' : 'Nhân viên cần xác nhận đã dọn hết hàng và bàn giao kho trống. Điều khoản thời gian chuẩn bị áp dụng theo thời điểm nghiệm thu thực tế.'}</p>}
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
  const today = vietnamDateInput()

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

  const rows = useMemo(() => {
    return (read.data?.data.filter((item) => !rentalId || item.rentalId === rentalId) ?? [])
      .sort((left, right) => {
        const due = (i: ApiReturn) => Date.parse(i.managerReviewDueAt || i.customerConfirmationDueAt || '')
        const leftDue = due(left), rightDue = due(right)
        if (Number.isFinite(leftDue) || Number.isFinite(rightDue))
          return (Number.isFinite(leftDue) ? leftDue : Infinity) - (Number.isFinite(rightDue) ? rightDue : Infinity)
        const urgency = (item: ApiReturn) => item.status === 'recovery_required' ? 0 : item.status !== 'completed' && item.scheduledDate < today ? 1 : item.status === 'completed' ? 3 : 2
        return urgency(left) - urgency(right) || left.scheduledDate.localeCompare(right.scheduledDate)
      })
  }, [read.data, rentalId, today])
  const editRemovalDeadline = rows.find(record => record.id === editing)?.inventoryRemovalDeadlineAt
  const maxEditReturnDate = editRemovalDeadline ? vietnamDateInput(Date.parse(editRemovalDeadline) - 1) : undefined

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_inspection' | 'review' | 'settlement' | 'completed'>('all')
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false)

  const counts = useMemo(() => {
    const pending = rows.filter((r) => ['requested', 'scheduled'].includes(r.status)).length
    const review = rows.filter((r) => ['inspected', 'awaiting_business_review', 'awaiting_customer_confirmation', 'disputed'].includes(r.status)).length
    const settlement = rows.filter((r) => ['payment_due', 'refund_pending'].includes(r.status)).length
    const completed = rows.filter((r) => r.status === 'completed').length
    return { all: rows.length, pending, review, settlement, completed }
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === 'pending_inspection' && !['requested', 'scheduled'].includes(r.status)) return false
      if (statusFilter === 'review' && !['inspected', 'awaiting_business_review', 'awaiting_customer_confirmation', 'disputed'].includes(r.status)) return false
      if (statusFilter === 'settlement' && !['payment_due', 'refund_pending'].includes(r.status)) return false
      if (statusFilter === 'completed' && r.status !== 'completed') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchUnit = r.unitNumber.toLowerCase().includes(q)
        const matchFacility = r.facilityName.toLowerCase().includes(q)
        const matchCustomer = (r.customerName || '').toLowerCase().includes(q)
        const matchNotes = (r.customerNotes || '').toLowerCase().includes(q)
        if (!matchUnit && !matchFacility && !matchCustomer && !matchNotes) return false
      }
      return true
    })
  }, [rows, statusFilter, searchQuery])

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
            <span className="hidden text-xs text-stone-500 mt-0.5 sm:inline">Chọn một hồ sơ để tiến hành nghiệm thu hoặc xem quyết toán chi tiết.</span>
          </div>
          {rows.length > 0 && role !== 'customer' && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={toggleAllExpanded}
                className="text-xs font-medium cursor-pointer"
              >
                {allExpanded ? 'Thu gọn tất cả' : 'Trải ra tất cả'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        rows.length > 1 && role !== 'customer' && (
          <div className="flex justify-end pb-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={toggleAllExpanded}
              className="text-xs font-medium cursor-pointer"
            >
              {allExpanded ? 'Thu gọn tất cả' : 'Trải ra tất cả'}
            </Button>
          </div>
        )
      )}

      {/* ─── Tìm kiếm & lọc hồ sơ trả kho ─── */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo mã kho, tên khách hàng, cơ sở hoặc lý do trả kho..."
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none placeholder:text-stone-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400 hover:text-stone-700"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Segmented control tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-200 pb-2 text-xs">
          {[
            { id: 'all' as const, label: 'Tất cả', count: counts.all },
            { id: 'pending_inspection' as const, label: 'Chờ nghiệm thu', count: counts.pending },
            { id: 'review' as const, label: 'Chờ khách / Khiếu nại', count: counts.review },
            { id: 'settlement' as const, label: 'Quyết toán / Hoàn cọc', count: counts.settlement },
            { id: 'completed' as const, label: 'Đã hoàn tất', count: counts.completed },
          ].map((tab) => {
            const active = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  active ? 'bg-amber-700 text-white' : 'bg-stone-200 text-stone-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Customer request return form (if applicable) */}
      {role === 'customer' && rentalId && read.data && ((rentalActive && !rows.some(record => record.status !== 'completed' || (record.sourceType === 'RECOVERY' && record.recoveryTaskStatus !== 'CLOSED'))) || editing) && (
        <form onSubmit={(event) => {
          event.preventDefault()
          if (date && date < today) {
            setFeedback('Ngày trả kho không được ở quá khứ.')
            return
          }
          if (editRemovalDeadline && (Date.now() >= Date.parse(editRemovalDeadline)
            || (maxEditReturnDate && date > maxEditReturnDate))) {
            setFeedback('Ngày trả kho phải nằm trong thời hạn đưa hàng ra khỏi kho.')
            return
          }
          void run(() => editing ? updateReturnRequest(editing, date, notes) : requestReturn(rentalId, date, notes))
        }} className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          {rows.some(record => record.id === editing && record.returnType === 'INVENTORY_MISMATCH')
            ? <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950"><p className="font-semibold">Trả kho do hàng hóa sai khai báo</p><ul className="mt-1 list-disc space-y-1 pl-5"><li>Tính tiền từ ngày xác nhận nhận kho đến ngày hẹn trả kho dự kiến.</li><li>Manager lập quyết toán, khách xác nhận trước khi hoàn tiền hoặc thu thêm.</li></ul></div>
            : <ReturnPolicyNotice />}
          <div>
            <VietnameseDateInput label="Ngày trả kho" value={date} min={today} max={maxEditReturnDate} onChange={setDate} />
            {date && date < today && (
              <p className="mt-1 text-xs font-semibold text-rose-600">Ngày trả kho không được ở quá khứ.</p>
            )}
          </div>
          <label className="block text-sm font-medium text-stone-700">Lý do<textarea required rows={3} placeholder="Nhập lý do trả kho…" value={notes} maxLength={2000} disabled={busy} onChange={(event) => setNotes(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-3 font-normal" /></label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || !date || date < today || Boolean(maxEditReturnDate && date > maxEditReturnDate) || !notes.trim() || read.loading}>{editing ? 'Lưu chỉnh sửa' : 'Gửi yêu cầu trả kho'}</Button>
            {editing && <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Hủy chỉnh sửa</Button>}
          </div>
        </form>
      )}

      {read.loading && !read.data && <p role="status">Đang tải hồ sơ trả kho...</p>}
      {!!read.error && <p role="alert">{returnError(read.error)}</p>}
      {feedback && <p role="status">{feedback}</p>}

      {!read.loading && !read.error && filteredRows.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-xs text-stone-500">
          {rows.length === 0 ? 'Chưa có yêu cầu trả kho nào.' : 'Không tìm thấy hồ sơ trả kho phù hợp với bộ lọc hiện tại.'}
        </div>
      )}

      {filteredRows.map((record) => {
        const isExpanded = role === 'customer' || expandedIds.has(record.id)
        const inventoryMismatch = record.returnType === 'INVENTORY_MISMATCH'
        const badgeClass =
          inventoryMismatch
            ? 'bg-red-100 text-red-900 border border-red-300 font-bold'
            : record.status === 'disputed'
            ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
            : record.status === 'completed'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : record.status === 'refund_pending'
            ? 'bg-purple-100 text-purple-800 border border-purple-300 font-semibold'
            : 'bg-amber-50 text-amber-800 border border-amber-200'

        return (
          <div key={record.id} className="rounded-xl border border-stone-200 bg-white shadow-xs transition overflow-hidden">
            {/* ─── Compact Summary Header (Bấm để mở rộng với nhân viên/quản lý) ─── */}
            <div
              className={`flex flex-wrap items-center justify-between gap-3 p-3.5 transition select-none ${
                role === 'customer'
                  ? 'bg-stone-50/80 border-b border-stone-200'
                  : inventoryMismatch
                    ? isExpanded ? 'bg-red-50/80 border-b border-red-200' : 'bg-red-50/40 hover:bg-red-50/80'
                    : isExpanded ? 'bg-stone-50/80 border-b border-stone-200' : 'hover:bg-stone-50/60'
              } ${role === 'customer' ? '' : 'cursor-pointer'}`}
              onClick={role === 'customer' ? undefined : () => toggleExpand(record.id)}
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
                  Ngày hẹn trả: <strong className="text-stone-700">{rentalDate(record.scheduledDate)}</strong>
                </span>
                {(record.managerReviewDueAt || record.customerConfirmationDueAt) && <span className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-800">
                  {record.managerReviewDueAt ? 'Hạn Manager duyệt 6 giờ' : 'Hạn xác nhận 72 giờ'}: {new Date(record.managerReviewDueAt || record.customerConfirmationDueAt!).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                  {' · '}{Date.parse(record.managerReviewDueAt || record.customerConfirmationDueAt!) <= Date.now() ? 'Đã quá hạn' : `Còn ${Math.ceil((Date.parse(record.managerReviewDueAt || record.customerConfirmationDueAt!) - Date.now()) / 60_000)} phút`}
                </span>}
                {role === 'staff' && ['requested', 'scheduled'].includes(record.status) && <button type="button" disabled={busy} className="rounded border px-2 py-1 text-xs" onClick={async e => {
                  e.stopPropagation()
                  try { await apiRequest(`/api/intake-workflow/reservations/returns/${encodeURIComponent(record.id)}/arrival`, { method: 'POST' }); setFeedback('Đã ghi nhận khách bàn giao đủ điều kiện. Hạn nghiệm thu là 4 giờ làm việc.'); read.refresh() }
                  catch { setFeedback('Chưa thể ghi nhận bàn giao. Vui lòng kiểm tra hồ sơ và thử lại.') }
                }}>Ghi nhận bàn giao đủ điều kiện nghiệm thu</button>}
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
                  {inventoryMismatch ? `Trả kho do kiểm kê sai lệch · ${statusLabel(record)}` : statusLabel(record)}
                </span>

                {role !== 'customer' && (
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
                    {isExpanded ? 'Thu gọn' : 'Trải ra'}
                  </button>
                )}
              </div>
            </div>

            {/* ─── Dữ liệu tóm tắt hồ sơ ─── */}
            <div className="grid grid-cols-2 gap-2 border-b border-stone-100 px-3.5 py-2.5 text-xs sm:grid-cols-4">
              <div>
                <span className="text-stone-400 block text-[11px]">Khách hàng</span>
                <span className="font-bold text-stone-800">{record.customerName || 'Khách thuê'}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Hạn dự kiến trả</span>
                <span className="font-semibold text-stone-700">{rentalDate(record.scheduledDate)}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">
                  {record.status === 'refund_pending' ? 'Tiền hoàn cọc' : record.status === 'payment_due' ? 'Phụ phí cần thu' : 'Cọc theo HĐ'}
                </span>
                <span className={`font-mono font-bold ${
                  record.status === 'refund_pending' ? 'text-purple-700' : record.status === 'payment_due' ? 'text-amber-800' : 'text-stone-900'
                }`}>
                  {record.status === 'refund_pending' && record.netRefundAmount != null
                    ? rentalMoney(record.netRefundAmount, 'VND')
                    : record.status === 'payment_due' && record.amountDueFromCustomer != null
                    ? rentalMoney(record.amountDueFromCustomer, 'VND')
                    : record.depositAmount != null
                    ? rentalMoney(record.depositAmount, 'VND')
                    : 'Chưa xác định'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Mã hồ sơ thuê</span>
                <span className="font-mono font-semibold text-stone-500">#{record.rentalId.slice(0, 8)}</span>
              </div>
              {record.inventoryRemovalDeadlineAt && (
                <p className="col-span-full text-stone-600">
                  Hạn đưa hàng ra <strong>{new Date(record.inventoryRemovalDeadlineAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</strong>
                </p>
              )}
              {record.customerNotes && (
                <p className="col-span-full text-stone-600 line-clamp-1 italic">
                  Lý do: &ldquo;{record.customerNotes}&rdquo;
                </p>
              )}
            </div>

            {/* ─── Chi tiết mở rộng & thao tác ─── */}
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
                {role === 'customer' && (record.status === 'requested'
                  || (record.status === 'scheduled' && Boolean(record.inventoryRemovalDeadlineAt)))
                  && (!record.inventoryRemovalDeadlineAt || Date.now() < Date.parse(record.inventoryRemovalDeadlineAt))
                  && editing !== record.id && (
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
                {role !== 'customer' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEmergencyModalOpen(true)}
                      className="text-xs font-semibold text-stone-700 border-stone-300 bg-white hover:bg-stone-50"
                    >
                      Liên hệ khẩn cấp
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(record.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800 hover:underline cursor-pointer"
                    >
                      Thu gọn hồ sơ {record.unitNumber}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Thông tin người liên hệ khẩn cấp */}
      {emergencyModalOpen && (
        <Modal open={emergencyModalOpen} onClose={() => setEmergencyModalOpen(false)} title="Thông tin người liên hệ khẩn cấp" size="lg">
          <div className="p-1">
            <EmergencyContactsPanel />
          </div>
        </Modal>
      )}
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
  icon?: string
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
          {icon && <span>{icon}</span>}<span>{label}</span>
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

function DamagePricingSelector({
  category,
  items,
  onChange,
  disabled,
}: {
  category: 'minor' | 'major'
  items: DamageItemInput[]
  onChange: (items: DamageItemInput[]) => void
  disabled?: boolean
}) {
  const catalog = returnDamageCatalog.filter((item) => item.category === category)
  const addItem = () => {
    const first = catalog[0]
    if (first) onChange([...items, { code: first.code, quantity: 1 }])
  }
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-stone-800">Bảng giá hư hỏng tự động</p>
          <p className="text-[11px] text-stone-500">Chọn hạng mục và số lượng/diện tích; hệ thống tự tính theo giá chuẩn.</p>
        </div>
        <span className="shrink-0 rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">Tự động tính</span>
      </div>
      {items.length === 0 && <p className="rounded-lg bg-white/70 p-2 text-xs text-stone-500">Chưa có hạng mục. Nếu kho không hư hại, giữ nguyên mức phí 0 ₫.</p>}
      {items.map((item, index) => {
        const price = catalog.find((entry) => entry.code === item.code) ?? catalog[0]
        return (
          <div key={`${item.code}-${index}`} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-end gap-2">
            <label className="text-[11px] font-semibold text-stone-700">
              Hạng mục
              <select
                value={item.code}
                disabled={disabled}
                onChange={(event) => onChange(items.map((current, currentIndex) => currentIndex === index ? { ...current, code: event.target.value } : current))}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs text-stone-800"
              >
                {catalog.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-stone-700">
              Số lượng ({price?.unit ?? 'đơn vị'})
              <input
                type="number"
                min="0.01"
                step={price?.unit === 'm²' ? '0.01' : '1'}
                value={item.quantity}
                disabled={disabled}
                onChange={(event) => onChange(items.map((current, currentIndex) => currentIndex === index ? { ...current, quantity: Number(event.target.value) || 0 } : current))}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-right text-xs text-stone-800"
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              aria-label="Xóa hạng mục hư hỏng"
              onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-600 hover:border-rose-300 hover:text-rose-700"
            >
              Xóa
            </button>
            <p className="col-span-full -mt-1 text-[10px] text-stone-500">
              Giá chuẩn: {price ? `${rentalMoney(price.unitPrice, 'VND')} / ${price.unit} (khung ${rentalMoney(price.suggestedMin, 'VND')}–${rentalMoney(price.suggestedMax, 'VND')})` : ''}
            </p>
            <p className="col-span-full text-[10px] font-semibold text-stone-800">
              Tính: {item.quantity || 0} × {price ? rentalMoney(price.unitPrice, 'VND') : '0 ₫'} = {rentalMoney(calculateDamageFee([item]), 'VND')}
            </p>
          </div>
        )
      })}
      <div className="flex items-center justify-between gap-2 border-t border-stone-200 pt-2">
        <button type="button" disabled={disabled} onClick={addItem} className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50">
          + Thêm hạng mục
        </button>
        <span className="text-sm font-extrabold text-stone-900">{rentalMoney(calculateDamageFee(items), 'VND')}</span>
      </div>
    </div>
  )
}

function getNextStepText(status: ApiReturn['status'], role: ReturnRole, recoveryNextStep: string | null): string {
  if (recoveryNextStep) return recoveryNextStep

  if (role === 'customer') {
    const customerSteps: Record<ApiReturn['status'], string> = {
      requested: 'Yêu cầu đã được gửi. Cơ sở sẽ sắp xếp lịch và thực hiện nghiệm thu trước khi quyết toán.',
      scheduled: 'Đến cơ sở theo ngày hẹn để trả kho và bàn giao cho nhân viên nghiệm thu.',
      inspected: 'Nghiệm thu đã được ghi nhận. Chờ cơ sở gửi kết quả quyết toán để khách hàng xác nhận.',
      awaiting_business_review: 'Hồ sơ cũ chưa có bảng giá trả sớm đã lưu. Chờ Ban điều hành xem xét.',
      awaiting_customer_confirmation: 'Kiểm tra các khoản phí bên dưới, sau đó đồng ý quyết toán hoặc yêu cầu xem xét lại.',
      disputed: 'Hồ sơ đang có khiếu nại từ bạn. Chờ Ban điều hành hoặc Quản lý cơ sở giải quyết.',
      payment_due: 'Thanh toán khoản quyết toán còn thiếu để tiếp tục hoàn tất trả kho.',
      refund_pending: 'Cơ sở đang xử lý hoàn cọc. Khoản tiền sẽ được chuyển hoàn theo thông tin của bạn.',
      completed: 'Hồ sơ trả kho và quyết toán đã hoàn tất.',
      recovery_required: 'Hồ sơ đã chuyển sang chờ thu hồi. Cơ sở sẽ liên hệ để thống nhất thời gian xử lý hàng.',
    }
    return customerSteps[status] || 'Đang xử lý hồ sơ trả kho.'
  }

  // Staff / Manager / Business perspective:
  const staffSteps: Record<ApiReturn['status'], string> = {
    requested: 'Khách hàng đã gửi yêu cầu trả kho. Cơ sở sắp xếp lịch hẹn và thực hiện nghiệm thu.',
    scheduled: 'Hẹn trả kho đã được lên lịch. Tiến hành nghiệm thu thực địa khi khách bàn giao gian kho.',
    inspected: 'Đã nghiệm thu hiện trường. Kiểm tra và hoàn tất bảng quyết toán để gửi cho khách hàng.',
    awaiting_business_review: 'Hồ sơ chưa có bảng giá trả sớm đã lưu. Chờ Ban điều hành xem xét phê duyệt.',
    awaiting_customer_confirmation: 'Đã gửi biên bản quyết toán. Đang chờ khách hàng xác nhận để tiến hành hoàn cọc.',
    disputed: 'Hồ sơ đang có khiếu nại từ khách hàng. Cần Ban điều hành hoặc Quản lý cơ sở giải quyết trước khi tiếp tục.',
    payment_due: 'Khách hàng có phụ phí vượt cọc cần thanh toán. Ghi nhận thanh toán và phát hành biên lai thu tiền.',
    refund_pending: 'Cơ sở thực hiện hoàn cọc cho khách hàng và ghi nhận biên lai hoàn tiền để hoàn tất hồ sơ.',
    completed: 'Hồ sơ trả kho và quyết toán đã hoàn tất.',
    recovery_required: 'Hồ sơ đã chuyển sang chờ thu hồi. Cần phân công nhân viên xử lý hàng và hoàn tất biên bản.',
  }
  return staffSteps[status] || 'Đang xử lý hồ sơ trả kho.'
}

function ReturnActions({ role, record, run, busy, recoveryLocked, onRecoveryLocked, onRecoveryChanged }: { role: ReturnRole; record: ApiReturn; run: (work: () => Promise<ApiReturn>) => Promise<void>; busy: boolean; recoveryLocked: boolean; onRecoveryLocked: (locked: boolean) => void; onRecoveryChanged: () => void }) {
  const id = record.id
  const actor = getAuthenticatedActor()
  const [note, setNote] = useState(record.inspectionNotes || record.staffNotes || '')
  const [fees, setFees] = useState<ReturnFees>({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0 })
  const [damageItems, setDamageItems] = useState<DamageItemInput[]>([])
  const [goodsLeft, setGoodsLeft] = useState(false)
  const [damage, setDamage] = useState<InspectionInput['damageClassification']>('no_damage')
  const [unit, setUnit] = useState<'available' | 'maintenance'>('available')
  const [returnedLock, setReturnedLock] = useState((record.lostItemFee ?? 0) <= 0)
  const [vacatedReturnId, setVacatedReturnId] = useState<string | null>(null)
  const [recoveryHandoverLocation, setRecoveryHandoverLocation] = useState('')
  const [recoveryWitnessStaffId, setRecoveryWitnessStaffId] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const initialized = useRef(false)

  useEffect(() => {
    if (record && !initialized.current) {
      initialized.current = true
      const initialLock = record.returnedLock !== undefined ? record.returnedLock : (record.lostItemFee ?? 0) <= 0
      setReturnedLock(initialLock)
      setFees({
        damageFee: record.damageFee,
        cleaningFee: record.cleaningFee,
        lostItemFee: initialLock ? 0 : (record.lostItemFee || 150000),
        overdueFee: record.overdueFee,
        outstandingFee: record.outstandingFee,
      })
      if (record.proposedUnitStatus) setUnit(record.proposedUnitStatus)
    }
  }, [record])

  const write = role === 'customer' || !!actor?.permissions.includes(role === 'manager' ? 'rentals:update' : 'returns:process')
  const recovery = record.sourceType === 'RECOVERY'
  const inventoryMismatch = record.returnType === 'INVENTORY_MISMATCH'
  const noShowRecovery = record.status === 'recovery_required'
  const witnessRead = useRentalApiResource(
    `${record.id}:${record.facilityId}:recovery-witnesses`,
    () => noShowRecovery ? listMaintenanceStaff(record.facilityId) : Promise.resolve([]),
    { retainDataOnRefresh: true },
  )
  const witnessOptions = witnessRead.data ?? []
  useEffect(() => {
    setRecoveryWitnessStaffId(record.recoveryWitnessStaffId ?? '')
  }, [record.id, record.recoveryWitnessStaffId])
  const canInspect = !recovery && write && role === 'staff' && ['requested', 'scheduled', 'recovery_required'].includes(record.status)
  const canReview = write && role === 'manager' && record.status === 'disputed'
  const recoveryNextStep = !recovery ? null : record.recoveryTaskStatus === 'CLOSED'
    ? 'Thu hồi đã hoàn tất. Hồ sơ thuê đã kết thúc và trạng thái kho đã được cập nhật.'
    : record.status === 'completed' ? 'Quyết toán đã hoàn tất. Hồ sơ thuê chỉ kết thúc sau khi nhân viên hoàn tất xử lý tài sản và giải phóng kho.'
      : record.status === 'payment_due' ? 'Liên hệ cơ sở để thanh toán khoản quyết toán còn thiếu. Nhân viên ghi nhận tiền kèm biên lai đã đối chiếu.'
        : record.status === 'refund_pending' ? 'Cơ sở thực hiện hoàn tiền và ghi nhận biên lai quyết toán. Thu hồi kho được hoàn tất riêng sau đó.' : null
  const hasEvidence = evidenceFiles.length > 0 || (Array.isArray(record.evidencePhotos) && record.evidencePhotos.length > 0)
  const submitInspection = async () => {
    if (canInspect && !hasEvidence) {
      throw new Error('Vui lòng tải lên ít nhất một ảnh hiện trường (trần, vách, sàn hoặc cửa) để làm bằng chứng nghiệm thu.')
    }
    const unitVacated = vacatedReturnId === id
    if (record.setupExitRequested && (!unitVacated || goodsLeft)) {
      throw new Error('Cần xác nhận khách đã đưa hết hàng ra và bàn giao kho trống trước khi nghiệm thu trả kho trong thời gian chuẩn bị.')
    }
    if (noShowRecovery && (goodsLeft || !unitVacated)) {
      throw new Error('Cần đưa toàn bộ hàng ra khu lưu tạm và xác nhận gian kho đã trống trước khi nghiệm thu khách không đến.')
    }
    if (noShowRecovery && evidenceFiles.length === 0) {
      throw new Error('Cần tải bằng chứng kiểm kê và bàn giao trước khi hoàn tất thu hồi hàng.')
    }
    if (noShowRecovery && !recoveryHandoverLocation.trim()) {
      throw new Error('Cần ghi nhận khu vực lưu tạm và người nhận bàn giao trước khi hoàn tất thu hồi hàng.')
    }
    if (noShowRecovery && !recoveryWitnessStaffId) {
      throw new Error('Cần chọn nhân viên thứ hai cùng xác nhận việc thu hồi hàng.')
    }
    const evidencePhotos: string[] = []
    for (const file of evidenceFiles) {
      const asset = await uploadReturnEvidence(id, file, role)
      evidencePhotos.push(asset.id)
    }
    return inspectReturn(id, {
      ...sanitizeFees(fees),
      damageFee: calculateDamageFee(damageItems),
      damageItems,
      inventoryMatch: 'match',
      damageClassification: goodsLeft ? 'abandoned_goods' : damage,
      staffNotes: note,
      evidencePhotos,
      returnedKey: false,
      returnedCard: false,
      returnedLock,
      proposedUnitStatus: unit,
      unitVacated,
      customerPresent: !noShowRecovery,
      recoveryHandoverLocation: noShowRecovery ? recoveryHandoverLocation.trim() : undefined,
      recoveryWitnessStaffId: noShowRecovery ? recoveryWitnessStaffId : undefined,
    })
  }

  return (
    <section className="space-y-4" aria-label="Xử lý trả kho">
      {!canInspect && !canReview && (
        <>
          <ReturnSummary record={record} hideHeader hideTerminationFee={false} />
          {role !== 'customer' && <EmergencyContactsPanel key={record.rentalId} rentalId={record.rentalId} />}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Bước tiếp theo</p>
            <p className="mt-1">{record.returnType === 'INVENTORY_MISMATCH' && record.status === 'awaiting_business_review'
              ? 'Bảng kê kiểm kê sai lệch đang chờ Manager duyệt. Sau đó bạn sẽ được xem và xác nhận quyết toán.'
              : getNextStepText(record.status, role, recoveryNextStep)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-stone-200 p-4">
              <h4 className="mb-3 font-semibold text-stone-900">Thông tin trả kho & nghiệm thu</h4>
              <dl className="space-y-3 text-sm">
                {([
                  ['Khách hàng', record.customerName], ['Lý do trả kho', record.customerNotes || 'Chưa ghi nhận'],
                  ['Ghi chú nghiệm thu', record.inspectionNotes || record.staffNotes || 'Chưa ghi nhận'],
                  ...(record.recoveryWitnessStaffName ? [['Nhân viên xác nhận thu hồi', record.recoveryWitnessStaffName]] : []),
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
                  {!inventoryMismatch && <div className="flex justify-between gap-3 py-2"><dt className="text-stone-500">Phí chấm dứt sớm một lần</dt><dd className="shrink-0 font-medium">{record.earlyTerminationFee == null ? 'Chưa xác định' : rentalMoney(record.earlyTerminationFee, 'VND')}</dd></div>}
                </>}
                {feeKeys.map((key, index) => <div key={key} className="flex justify-between gap-3 py-2"><dt className="text-stone-500">{['Phí hư hỏng', 'Phí vệ sinh', 'Phí mất đồ', 'Phí quá hạn', 'Phí còn thiếu'][index]}</dt><dd className="shrink-0 font-medium">{rentalMoney(record[key], 'VND')}</dd></div>)}
                <div className="flex justify-between gap-3 py-3 font-bold"><dt>Tổng phí ghi nhận</dt><dd>{rentalMoney(record.totalDeductions, 'VND')}</dd></div>
              </dl>
            </div>
          </div>
        </>
      )}

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
        const calculatedDamage = canInspect ? calculateDamageFee(damageItems) : fees.damageFee
        const effectiveFees = { ...fees, damageFee: calculatedDamage }
        const totalFees = Object.values(effectiveFees).reduce((sum, v) => sum + (Number.isNaN(v) ? 0 : v), 0)
        const rentalCredit = record.setupEarlyExit
          ? (record.rentalRefundCredit ?? record.earlyTerminationPolicy?.rentalRefundAmount ?? 0)
          : (record.activeReturnPolicy?.rentalRefundAmount ?? 0)
        const projectedRefund = record.setupEarlyExit
          ? rentalCredit + Math.max(0, deposit - totalFees)
          : Math.max(0, deposit + rentalCredit - totalFees)
        const projectedDue = record.setupEarlyExit
          ? Math.max(0, totalFees - deposit)
          : Math.max(0, totalFees - deposit - rentalCredit)
        const missingDamageItems = canInspect && !goodsLeft && damage !== 'no_damage' && damage !== 'abandoned_goods'
          && (damageItems.length === 0 || damageItems.some((item) => item.quantity <= 0))

        return (
          <div className="space-y-4">
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
                            <span>1. Thu hồi khóa đã bàn giao</span>
                          </h4>
                          <span className="text-[11px] font-medium text-stone-500">Chạm để đổi trạng thái</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {([
                            { key: 'returnedLock' as const, label: 'Ổ khóa / Chìa khóa đã bàn giao', desc: 'Đối chiếu mã khóa trong hồ sơ nhận kho và thu lại bộ khóa đã cấp' },
                          ]).map((item) => {
                            const isReturned = returnedLock
                            return (
                              <button
                                key={item.key}
                                type="button"
                                disabled={busy}
                                aria-pressed={isReturned}
                                onClick={() => setReturnedLock((prev) => !prev)}
                                className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer select-none ${
                                  isReturned
                                    ? 'border-emerald-400 bg-emerald-50/70 text-emerald-950 shadow-xs ring-1 ring-emerald-400'
                                    : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:border-stone-300 hover:bg-stone-100/60'
                                }`}
                              >
                                <div className="flex w-full items-center justify-between">
                                  
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                    isReturned ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
                                  }`}>
                                    {isReturned ? 'Đã thu hồi' : 'Chưa thu hồi'}
                                  </span>
                                </div>
                                <span className="mt-2 text-xs font-bold">{item.label}</span>
                                <span className="text-[11px] text-stone-500 leading-tight mt-0.5">{item.desc}</span>
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-stone-500">Chỉ thu hồi bộ khóa đã cấp khi nhận kho. Quyền ra vào được hệ thống thu hồi khi ghi nhận nghiệm thu.</p>
                        {(record.setupExitRequested || noShowRecovery) && (
                          <div className="pt-2 border-t border-stone-100">
                            <label className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                              vacatedReturnId === id
                                ? 'border-emerald-400 bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-400'
                                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                            }`}>
                              <input
                                type="checkbox"
                                checked={vacatedReturnId === id}
                                disabled={busy || goodsLeft}
                                onChange={(e) => setVacatedReturnId(e.target.checked ? id : null)}
                                className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                              <p className="text-xs font-bold">{noShowRecovery ? 'Xác nhận đã đưa toàn bộ hàng ra khu lưu tạm và bàn giao kho trống' : 'Xác nhận khách đã dọn sạch hàng và bàn giao kho trống'}</p>
                                <p className="text-[11px] text-stone-500">{noShowRecovery ? 'Cần hoàn tất cùng bằng chứng kiểm kê trước khi nghiệm thu khách không đến.' : 'Điều kiện bắt buộc cho hồ sơ trả kho trong thời gian setup.'}</p>
                              </div>
                            </label>
                            {noShowRecovery && (
                              <div className="mt-2 space-y-2">
                                <label className="block text-xs font-semibold text-stone-700">
                                  Khu vực lưu tạm và người nhận bàn giao
                                  <input
                                    className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm font-normal"
                                    maxLength={500}
                                    disabled={busy}
                                    value={recoveryHandoverLocation}
                                    onChange={(event) => setRecoveryHandoverLocation(event.target.value)}
                                    placeholder="Ví dụ: Khu lưu tạm A, kệ 02, nhân viên nhận bàn giao"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-stone-700">
                                  Nhân viên thứ hai xác nhận thu hồi
                                  <select
                                    className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm font-normal"
                                    disabled={busy || witnessRead.loading}
                                    value={recoveryWitnessStaffId}
                                    onChange={(event) => setRecoveryWitnessStaffId(event.target.value)}
                                  >
                                    <option value="">Chọn nhân viên cùng cơ sở</option>
                                    {witnessOptions.map((witness) => <option key={witness.id} value={witness.id}>{witness.fullName}</option>)}
                                  </select>
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* KHỐI 2: ĐÁNH GIÁ HIỆN TRẠNG KHO & HÀNG HÓA */}
                      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-4">
                        <div className="border-b border-stone-100 pb-2.5">
                          <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                            <span>2. Hiện trạng kho và hàng hóa</span>
                          </h4>
                        </div>

                        {/* Đối chiếu hàng hóa */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-stone-700 block">
                            Hàng hóa trong kho lúc trả
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { id: false, label: 'Đã dọn sạch' },
                              { id: true, label: 'Còn hàng trong kho' },
                            ] as const).map((opt) => (
                              <button
                                key={String(opt.id)}
                                type="button"
                                disabled={busy}
                                aria-pressed={goodsLeft === opt.id}
                                onClick={() => { setGoodsLeft(opt.id); setVacatedReturnId(null) }}
                                className={`rounded-xl border py-2.5 px-2 text-center text-xs transition cursor-pointer ${
                                  goodsLeft === opt.id
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 font-bold shadow-xs'
                                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                                }`}
                              >
                                
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
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {([
                              { id: 'no_damage', label: 'Không hư hại', desc: 'Kho nguyên vẹn' },
                              { id: 'minor_damage', label: 'Hư hại nhẹ', desc: 'Trầy xước/bẩn' },
                              { id: 'major_damage', label: 'Hư hại nặng', desc: 'Móp méo/vỡ' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setDamage(opt.id)
                                  setDamageItems([])
                                  setVacatedReturnId(null)
                                }}
                                className={`rounded-xl border p-2.5 text-center transition cursor-pointer ${
                                  damage === opt.id
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 font-bold shadow-xs'
                                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                                }`}
                              >
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
                              { id: 'available' as const, label: 'Sẵn sàng cho thuê tiếp', desc: 'Kho đạt chuẩn vệ sinh & kỹ thuật' },
                              { id: 'maintenance' as const, label: 'Cần bảo trì / vệ sinh', desc: 'Cần nhân viên xử lý trước khi cho thuê' },
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
                        <span>3. Ảnh hiện trường & Biên bản nghiệm thu</span>
                      </h4>
                    </div>

                    {canInspect && (
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-stone-700">Ảnh hiện trường theo khu vực</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(['Trần', 'Vách', 'Sàn', 'Cửa'] as const).map((area) => (
                            <label key={area} className="relative cursor-pointer rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-xs font-semibold text-stone-700 hover:border-emerald-500 hover:bg-emerald-50">
                              Thêm ảnh {area.toLowerCase()}
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                disabled={busy}
                                aria-label={`Ảnh hiện trạng ${area.toLowerCase()}`}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                onChange={(event) => {
                                  const files = Array.from(event.target.files ?? []).map((file) => new File([file], `${area} - ${file.name}`, { type: file.type, lastModified: file.lastModified }))
                                  setEvidenceFiles((current) => [...current, ...files])
                                  event.target.value = ''
                                }}
                              />
                            </label>
                          ))}
                        </div>
                        <p className="text-[11px] text-stone-500">Đối chiếu với ảnh và hiện trạng kho trống trong hồ sơ nhận kho.</p>
                        <label className="text-xs font-semibold text-stone-700 block">
                          Biên bản đối chứng / Tài liệu khác
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
                        <span>Bảng quyết toán hoàn tiền &amp; khấu trừ</span>
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Phí hư hỏng lấy từ bảng giá chuẩn. Hệ thống trừ vào cọc trước; với trả sau ngày bắt đầu thuê, phần vượt cọc mới trừ vào tiền thuê chưa sử dụng.
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
                    {rentalCredit > 0 && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-stone-800">{record.setupEarlyExit ? 'Tiền thuê được hoàn theo chính sách setup' : 'Tiền thuê các tháng chưa bắt đầu'}</p>
                          <p className="text-[11px] text-stone-500">{record.setupEarlyExit ? 'Hoàn 80%; giữ lại 20% theo báo giá.' : 'Hoàn sau khi trừ phí vượt cọc (nếu có).'}</p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-stone-900 font-mono">{rentalMoney(rentalCredit, 'VND')}</span>
                      </div>
                    )}

                    {/* Danh sách 5 khoản phí khấu trừ */}
                    <div className="space-y-2">

                      {damage === 'minor_damage' || damage === 'major_damage' ? <DamagePricingSelector key={damage} category={damage === 'major_damage' ? 'major' : 'minor'} items={damageItems} onChange={setDamageItems} disabled={busy} /> : null}
                      {missingDamageItems && <p className="text-[11px] font-semibold text-rose-700">Chọn ít nhất một hạng mục và số lượng hư hỏng để hệ thống tính phí.</p>}
                      <FeeInputRow label="Phí vệ sinh" value={fees.cleaningFee} onChange={(v) => setFees((f) => ({ ...f, cleaningFee: v }))} disabled={busy} />
                      <FeeInputRow label="Phí mất khóa đã bàn giao" value={fees.lostItemFee} onChange={(v) => setFees((f) => ({ ...f, lostItemFee: v }))} disabled={busy} />
                      <FeeInputRow label="Phí quá hạn" value={fees.overdueFee} onChange={(v) => setFees((f) => ({ ...f, overdueFee: v }))} disabled={busy} />
                      <FeeInputRow label="Phí còn thiếu (Công nợ)" value={fees.outstandingFee} onChange={(v) => setFees((f) => ({ ...f, outstandingFee: v }))} readOnly disabled={busy} />
                    </div>

                    {/* Tổng khấu trừ */}
                    <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
                      <span className="font-semibold text-stone-700">Tổng phí khấu trừ:</span>
                      <span className="font-bold text-stone-900 font-mono">
                        {rentalMoney(totalFees, 'VND')}
                      </span>
                    </div>

                    {/* THẺ DỰ TÍNH KẾT QUẢ THỜI GIAN THỰC */}
                    {inventoryMismatch ? (
                      <div className="rounded-xl border border-orange-300 bg-orange-50 p-3.5 text-sm text-orange-950">
                        <p className="font-bold">Trả kho do hàng hóa sai khai báo</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          <li>Tính tiền từ ngày xác nhận nhận kho đến ngày hẹn trả kho dự kiến.</li>
                          <li>Quản lý cơ sở lập quyết toán, khách xác nhận trước khi hoàn tiền hoặc thu thêm.</li>
                        </ul>
                      </div>
                    ) : projectedDue === 0 ? (
                      <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/70 p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                            Hoàn cọc dự kiến cho khách
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
                      {canInspect && !hasEvidence && (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-xs text-amber-900 font-semibold">
                          Cần tải lên ít nhất 1 ảnh hiện trường để làm bằng chứng nghiệm thu.
                        </p>
                      )}
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={busy || (canReview && !note.trim()) || missingDamageItems || (canInspect && !hasEvidence) || (canInspect && !!record.setupExitRequested && (vacatedReturnId !== id || goodsLeft))}
                        className="w-full !bg-emerald-600 hover:!bg-emerald-700 text-white font-bold py-3 text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{canInspect ? 'Ghi nhận kết quả nghiệm thu' : 'Ghi nhận xem xét khiếu nại'}</span>
                      </Button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setFees({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: record.outstandingFee || 0 })
                          setDamageItems([])
                          setDamage('no_damage')
                          setGoodsLeft(false)
                          setReturnedLock(true)
                          setUnit('available')
                        }}
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
      {write && !recovery && role === 'staff' && ['payment_due', 'refund_pending'].includes(record.status) && (
        <RecoveryReturnSettlement
          role={role}
          record={record}
          busy={busy}
          onLocked={onRecoveryLocked}
          onChanged={onRecoveryChanged}
        />
      )}
      {!recovery && record.status === 'completed' && record.settlementReceipt?.direction === 'COLLECTION' &&
        record.settlementReceipt.paymentMethod === 'CASH' && (
          <p className="break-all text-sm text-stone-700">Mã biên lai <b>{record.settlementReceipt.transactionReference}</b></p>
      )}
      {recovery && (role === 'staff' || role === 'manager') && record.recoveryTaskId && <RecoveryTaskLink role={role} taskId={record.recoveryTaskId} facilityId={record.facilityId} disabled={busy || recoveryLocked} onChanged={onRecoveryChanged} />}
      {write && recovery && role === 'staff' && ['payment_due', 'refund_pending'].includes(record.status) && <RecoveryReturnSettlement role={role} record={record} busy={busy} onLocked={onRecoveryLocked} onChanged={onRecoveryChanged} />}
      {role === 'customer' && record.status === 'awaiting_customer_confirmation' && (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <b>Thời hạn phản hồi:</b> Quý khách vui lòng kiểm tra biên bản và phản hồi trong vòng 72 giờ. Sau thời gian này, hệ thống sẽ tự động chốt quyết toán theo biên bản nghiệm thu.
          </div>
          <div className="flex gap-2">
            <Button disabled={busy || !note.trim()} onClick={() => void run(() => confirmReturn(id, 'disputed', note))}>Yêu cầu xem xét lại</Button>
            <Button disabled={busy || !!record.settlementBlocker || record.netRefundAmount === null || record.amountDueFromCustomer === null} onClick={() => void run(() => confirmReturn(id, 'accepted', note))}>Đồng ý quyết toán</Button>
          </div>
        </div>
      )}
      {record.customerDecisionNote && record.customerDecisionNote.includes('Auto-Settlement SLA') && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800">
          Quyết toán này đã được hệ thống <b>tự động xác nhận</b> do quá hạn phản hồi của khách hàng.
        </div>
      )}
    </section>
  )
}
