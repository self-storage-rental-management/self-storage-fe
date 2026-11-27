import { useEffect, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import { apiRequest, ApiClientError } from '../../services/apiClient'
import { getAuthenticatedActor } from '../../services/authApi'
import { listOverdueCases } from '../../services/overdueApi'
import { listAllRecoveryTasks, type RecoveryTask } from '../../services/recoveryTasksApi'
import type { OverdueCase } from '../../types/overdueApi'
import { recordDisplayCode } from '../../utils/recordDisplayCode'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { isPendingRecoveryItem } from '../../domain/recoveryItems'
import { rentalDate, rentalError, rentalMoney } from '../rental-api/presentation'
import { recoveryTaskReason } from '../rental-api/RecoveryTaskDetail'
import RecoveryTaskLink from '../rental-api/RecoveryTaskLink'
import { OverdueDetail, OverdueStatusBadge } from './ManagerOverdueApiPanel'
import { managerFacilityNotice } from './managerFacilityUi'
import { ViolationRecoveryPanel, RecoveryCountdown, reasons, stageLabel, type Entry } from '../return-api/ViolationRecoveryPanel'

type Row = { kind: 'recovery'; record: Entry } | { kind: 'overdue'; record: OverdueCase } | { kind: 'task'; record: RecoveryTask }
const taskStatus = { OPEN: 'WAITING_RECOVERY', IN_PROGRESS: 'RECOVERING', CLOSED: 'COMPLETED' } as const
const hasPendingPickup = (row: Row) => row.kind === 'recovery' && row.record.stage === 'COMPLETED'
  && row.record.items?.some(isPendingRecoveryItem)
const finished = (row: Row) => row.kind === 'recovery'
  ? row.record.stage === 'CANCELLED' || row.record.stage === 'COMPLETED' && !hasPendingPickup(row)
  : row.kind === 'task' ? row.record.status === 'CLOSED' : row.record.workflowStatus === 'COMPLETED'
const deadline = (row: Row) => row.kind === 'recovery'
  ? hasPendingPickup(row) ? row.record.pickupDueAt : row.record.actionDueAt || row.record.deadlineAt
  : row.kind === 'overdue' ? row.record.kind === 'RENTAL_TERM' ? row.record.recoveryCutoff : row.record.dueAt : null
const unitCode = (row: Row) => row.kind === 'recovery' ? row.record.unitCode : row.record.storageUnitCode
const rowCode = (row: Row) => row.kind === 'recovery'
  ? row.record.reservationCode || row.record.unitCode
  : row.kind === 'task' ? row.record.storageUnitCode : row.record.rentalDisplayCode || recordDisplayCode(row.record.rentalId)
const rowType = (row: Row) => row.kind === 'recovery' ? 'Thu hồi kho'
  : row.kind === 'task' || row.record.kind === 'RENTAL_TERM' ? 'Quá thời hạn thuê' : 'Quá hạn thanh toán'

export default function ManagerRecoveryCards({ facilityId, canCoordinate, canViewOverdue, initialRecovery, initialOverdue, onOverdueClosed, onLocked }: {
  facilityId?: string; canCoordinate: boolean; canViewOverdue: boolean
  initialRecovery?: { id: string; request: number }; onLocked: (locked: boolean) => void
  initialOverdue?: { caseRef: string }; onOverdueClosed?: () => void
}) {
  const actor = getAuthenticatedActor()
  const identity = JSON.stringify([actor?.id, actor?.facilityScopes, actor?.permissions, facilityId])
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('priority')
  const [page, setPage] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [recoveryTarget, setRecoveryTarget] = useState(initialRecovery)
  const [overdueTarget, setOverdueTarget] = useState(initialOverdue?.caseRef)
  const [locked, setLocked] = useState(false)
  useEffect(() => { if (initialRecovery) setRecoveryTarget(initialRecovery) }, [initialRecovery])
  useEffect(() => {
    if (initialOverdue) {
      setRecoveryTarget(undefined)
      setOverdueTarget(initialOverdue.caseRef)
    }
  }, [initialOverdue])
  const recoveries = useRentalApiResource(`${identity}:recovery:${canCoordinate}`, async () => {
    if (!canCoordinate || !facilityId) return []
    const rows: Entry[] = []
    let next = 0
    let batch: Entry[]
    do {
      batch = (await apiRequest<{ data: Entry[] }>(`/api/violation-recoveries?page=${next++}&activeOnly=false`, { cache: 'no-store' })).data
      rows.push(...batch)
    } while (batch.length === 30)
    return [...new Map(rows.map(row => [row.id, row])).values()]
  })
  const overdue = useRentalApiResource(`${identity}:overdue:${canViewOverdue}`, async () => {
    if (!canViewOverdue || !facilityId) return { rows: [] as OverdueCase[], partial: false }
    const first = await listOverdueCases({ facilityId, kind: 'ALL', size: 100, page: 0, sort: 'priority,desc' })
    const rows = [...first.data]
    let partial = first.completeness !== 'COMPLETE'
    for (let next = 1; next < first.pagination.totalPages; next++) {
      const batch = await listOverdueCases({ facilityId, kind: 'ALL', size: 100, page: next, sort: 'priority,desc' })
      rows.push(...batch.data)
      partial ||= batch.completeness !== 'COMPLETE'
    }
    return { rows: [...new Map(rows.map(row => [row.caseRef, row])).values()], partial }
  })
  const tasks = useRentalApiResource(`${identity}:overdue-recovery-tasks:${canViewOverdue}`, async () => {
    if (!canViewOverdue || !facilityId) return []
    try {
      return await listAllRecoveryTasks('manager', facilityId)
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'FEATURE_DISABLED') return []
      throw error
    }
  }, { retainDataOnRefresh: true })
  const refresh = () => { recoveries.refresh(); overdue.refresh(); tasks.refresh() }
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (recoveryTarget || overdueTarget) return
    const timer = window.setInterval(() => {
      if (!document.hidden) { recoveries.refresh(); overdue.refresh(); tasks.refresh() }
    }, 30000)
    return () => window.clearInterval(timer)
  }, [recoveryTarget, overdueTarget, recoveries.refresh, overdue.refresh, tasks.refresh])
  useEffect(() => { setPage(0) }, [search, kind, status, sort])

  if (!facilityId) return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  const recoveryRows = recoveries.data || []
  const knownTasks = new Set(recoveryRows.map(row => row.taskId).filter(Boolean))
  const overdueRows = (overdue.data?.rows || []).filter(row => !row.recoveryTaskId || !knownTasks.has(row.recoveryTaskId))
  for (const row of overdueRows) if (row.recoveryTaskId) knownTasks.add(row.recoveryTaskId)
  const rows: Row[] = [
    ...recoveryRows.map(record => ({ kind: 'recovery' as const, record })),
    ...overdueRows.map(record => ({ kind: 'overdue' as const, record })),
    ...(tasks.data || []).filter(task => !knownTasks.has(task.id)).map(record => ({ kind: 'task' as const, record })),
  ]
  const loading = recoveries.loading || overdue.loading || tasks.loading
  const query = search.trim().toLocaleLowerCase('vi')
  const isOverdue = (row: Row) => !finished(row) && (row.kind !== 'recovery' || Date.parse(deadline(row) || '') <= now)
  const filtered = rows.filter(row =>
    (kind === 'all' || kind === 'recovery' && row.kind === 'recovery'
      || row.kind === 'overdue' && row.record.kind === kind || row.kind === 'task' && kind === 'RENTAL_TERM')
    && (status === 'all' || status === 'active' && !finished(row)
      || status === 'overdue' && isOverdue(row) || status === 'finished' && finished(row))
    && (!query || [rowCode(row), row.record.customerName, unitCode(row)].some(value => value?.toLocaleLowerCase('vi').includes(query))))
    .sort((a, b) => {
      const completionOrder = Number(finished(a)) - Number(finished(b))
      if (completionOrder) return completionOrder
      if (sort === 'unit') return unitCode(a).localeCompare(unitCode(b), 'vi')
      if (sort === 'priority') {
        const difference = Number(isOverdue(b)) - Number(isOverdue(a))
        if (difference) return difference
      }
      return (Date.parse(deadline(a) || '') || Infinity) - (Date.parse(deadline(b) || '') || Infinity)
        || rowCode(a).localeCompare(rowCode(b), 'vi')
    })
  const lastPage = Math.max(0, Math.ceil(filtered.length / 12) - 1)
  const currentPage = Math.min(page, lastPage)
  const controls = 'mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm'
  return <div className="space-y-5">
    <header><h2 className="text-2xl font-bold text-stone-900">Thu hồi kho &amp; Theo dõi quá hạn</h2>
      <p className="mt-1 text-sm text-stone-600">Theo dõi hồ sơ, phân công thu hồi và xử lý quá hạn tại cơ sở.</p></header>
    <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm">Tìm kiếm<input className={controls} placeholder="Mã hồ sơ, khách hàng, gian kho" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="text-sm">Loại hồ sơ<select className={controls} value={kind} onChange={event => setKind(event.target.value)}>
        <option value="all">Tất cả loại hồ sơ</option>
        {canCoordinate && <option value="recovery">Thu hồi kho</option>}
        {canViewOverdue && <><option value="RENTAL_TERM">Quá thời hạn thuê</option><option value="PAYMENT_DUE">Quá hạn thanh toán</option></>}
      </select></label>
      <label className="text-sm">Trạng thái<select className={controls} value={status} onChange={event => setStatus(event.target.value)}>
        <option value="active">Đang xử lý</option><option value="overdue">Đã quá hạn</option><option value="finished">Đã kết thúc</option><option value="all">Tất cả trạng thái</option>
      </select></label>
      <label className="text-sm">Sắp xếp<select className={controls} value={sort} onChange={event => setSort(event.target.value)}>
        <option value="priority">Cần xử lý trước</option><option value="deadline">Hạn xử lý gần nhất</option><option value="unit">Theo gian kho</option>
      </select></label>
    </Card>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:flex sm:flex-wrap">
      <p className="text-sm text-stone-600">{filtered.length} hồ sơ</p>
      {overdue.data?.partial && <p role="status" className="col-span-2 row-start-2 text-xs text-amber-900">Dữ liệu quá hạn chưa đầy đủ.</p>}
      <Button className="col-start-2 row-start-1 sm:ml-auto" variant="outline" size="sm" disabled={loading} onClick={refresh}>Tải lại</Button>
    </div>
    {loading && <p role="status">Đang tải hồ sơ…</p>}
    {recoveries.error != null && <p role="alert" className="text-sm text-red-700">Chưa tải được hồ sơ thu hồi. {rentalError(recoveries.error)}</p>}
    {overdue.error != null && <p role="alert" className="text-sm text-red-700">Chưa tải được hồ sơ quá hạn. {rentalError(overdue.error)}</p>}
    {tasks.error != null && <p role="alert" className="text-sm text-red-700">Chưa tải được nhiệm vụ thu hồi quá hạn thuê. {rentalError(tasks.error)}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {filtered.slice(currentPage * 12, (currentPage + 1) * 12).map(row => <Card key={`${row.kind}:${row.kind === 'recovery' ? row.record.id : row.record.caseRef}`} className="min-w-0 space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="break-all text-base font-semibold">{rowCode(row)}</h3><p className="mt-1 text-sm text-stone-600">{rowType(row)}</p></div>
          {row.kind === 'overdue' ? <OverdueStatusBadge status={row.record.workflowStatus || row.record.priority} />
            : row.kind === 'task' ? <OverdueStatusBadge status={taskStatus[row.record.status]} />
            : <span className={`recovery-status recovery-status--${row.record.stage.toLowerCase()}`}>{stageLabel(row.record)}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-stone-500">Khách hàng</dt><dd className="mt-1 break-words font-medium">{row.record.customerName || 'Chưa cập nhật'}</dd></div>
          <div><dt className="text-stone-500">Gian kho</dt><dd className="mt-1 break-all font-medium">{unitCode(row)}</dd></div>
          {row.kind === 'recovery' ? <>
            <div><dt className="text-stone-500">Phụ trách</dt><dd className="mt-1">{row.record.staffName || 'Chưa phân công'}</dd></div>
            <div><dt className="text-stone-500">{hasPendingPickup(row) ? 'Lịch nhận hàng' : 'Lịch thu hồi'}</dt>
              <dd className="mt-1">{hasPendingPickup(row) ? row.record.pickupAppointmentAt ? rentalDate(row.record.pickupAppointmentAt) : 'Chưa đặt lịch' : rentalDate(row.record.scheduledAt)}</dd></div>
          </> : row.kind === 'task' ? <>
            <div><dt className="text-stone-500">Phụ trách</dt><dd className="mt-1">{row.record.assignedStaffName || 'Chưa phân công'}</dd></div>
            <div><dt className="text-stone-500">Tiếp nhận nhiệm vụ</dt><dd className="mt-1">{rentalDate(row.record.receivedAt)}</dd></div>
          </> : <>
            <div><dt className="text-stone-500">Số ngày quá hạn</dt><dd className="mt-1 font-semibold text-red-700">{row.record.overdueDays} ngày</dd></div>
            {row.record.kind === 'PAYMENT_DUE' && <div><dt className="text-stone-500">Còn nợ</dt><dd className="mt-1 font-semibold">{rentalMoney(row.record.outstanding, row.record.currency || 'VND')}</dd></div>}
          </>}
        </dl>
        {row.kind === 'recovery' && <p className="text-sm text-stone-600">{reasons[row.record.reason] || 'Cần xử lý thu hồi kho'}</p>}
        {row.kind === 'task' && <p className="text-sm text-stone-600">{recoveryTaskReason(row.record.reason)}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <div className="space-y-1 text-xs text-stone-600">
            <p>{finished(row) ? 'Đã kết thúc xử lý' : row.kind !== 'task' && <>{hasPendingPickup(row) ? 'Hạn nhận hàng' : 'Hạn xử lý'} · {rentalDate(deadline(row))}</>}</p>
            {row.kind === 'recovery' && !finished(row) && <RecoveryCountdown deadline={deadline(row)} label="Xử lý" />}
          </div>
          {row.kind === 'task' ? <RecoveryTaskLink role="manager" taskId={row.record.id} facilityId={row.record.facilityId} onChanged={refresh} />
            : <Button size="sm" variant="outline" onClick={() => row.kind === 'recovery'
              ? setRecoveryTarget({ id: row.record.id, request: Date.now() }) : setOverdueTarget(row.record.caseRef)}>Chi tiết</Button>}
        </div>
      </Card>)}
    </div>
    {!loading && !recoveries.error && !overdue.error && !tasks.error && !filtered.length && <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">Không có hồ sơ phù hợp với bộ lọc.</p>}
    {lastPage > 0 && <nav aria-label="Phân trang hồ sơ" className="flex items-center justify-end gap-3">
      <Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Trước</Button>
      <span className="text-sm">{currentPage + 1} / {lastPage + 1}</span>
      <Button variant="outline" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Sau</Button>
    </nav>}
    {recoveryTarget && canCoordinate && <ViolationRecoveryPanel key={`${recoveryTarget.id}:${recoveryTarget.request}`} target={recoveryTarget} detailOnly
      onDetailClosed={() => { setRecoveryTarget(undefined); refresh() }} onRecordChanged={refresh} />}
    {overdueTarget && canViewOverdue && <Modal open size="xl" title="Chi tiết quá hạn & lịch sử xử lý" onClose={() => {
      if (!locked) { setOverdueTarget(undefined); onOverdueClosed?.(); onLocked(false); refresh() }
    }}>
      <OverdueDetail key={overdueTarget} identity={identity} caseRef={overdueTarget}
        onLocked={value => { setLocked(value); onLocked(value) }} onChanged={refresh} />
    </Modal>}
  </div>
}
