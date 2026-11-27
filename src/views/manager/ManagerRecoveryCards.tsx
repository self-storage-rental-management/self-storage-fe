import { useEffect, useState } from 'react'
import { Button, Card, Modal } from '../../components/ui'
import { apiRequest } from '../../services/apiClient'
import { getAuthenticatedActor } from '../../services/authApi'
import { listOverdueCases } from '../../services/overdueApi'
import type { OverdueCase } from '../../types/overdueApi'
import { recordDisplayCode } from '../../utils/recordDisplayCode'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { rentalDate, rentalError, rentalMoney } from '../rental-api/presentation'
import { OverdueDetail, OverdueStatusBadge } from './ManagerOverdueApiPanel'
import { managerFacilityNotice } from './managerFacilityUi'
import { ViolationRecoveryPanel, RecoveryCountdown, reasons, stageLabel, type Entry } from '../return-api/ViolationRecoveryPanel'

type Row = { kind: 'recovery'; record: Entry } | { kind: 'overdue'; record: OverdueCase }
const finished = (row: Row) => row.kind === 'recovery'
  ? ['COMPLETED', 'CANCELLED'].includes(row.record.stage) : row.record.workflowStatus === 'COMPLETED'
const deadline = (row: Row) => row.kind === 'recovery'
  ? row.record.actionDueAt || row.record.deadlineAt
  : row.record.kind === 'RENTAL_TERM' ? row.record.recoveryCutoff : row.record.dueAt
const unitCode = (row: Row) => row.kind === 'recovery' ? row.record.unitCode : row.record.storageUnitCode
const rowCode = (row: Row) => row.kind === 'recovery'
  ? row.record.reservationCode || row.record.unitCode : row.record.rentalDisplayCode || recordDisplayCode(row.record.rentalId)
const rowType = (row: Row) => row.kind === 'recovery' ? 'Thu hồi kho'
  : row.record.kind === 'RENTAL_TERM' ? 'Quá thời hạn thuê' : 'Quá hạn thanh toán'

export default function ManagerRecoveryCards({ facilityId, canCoordinate, canViewOverdue, initialRecovery, initialOverdue, onOverdueClosed, onLocked }: {
  facilityId?: string; canCoordinate: boolean; canViewOverdue: boolean
  initialRecovery?: { id: string; request: number }; onLocked: (locked: boolean) => void
  initialOverdue?: { caseRef: string }; onOverdueClosed?: () => void
}) {
  const actor = getAuthenticatedActor()
  const identity = JSON.stringify([actor?.id, actor?.facilityScopes, actor?.permissions, facilityId])
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('active')
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
  const refresh = () => { recoveries.refresh(); overdue.refresh() }
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (recoveryTarget || overdueTarget) return
    const timer = window.setInterval(() => {
      if (!document.hidden) { recoveries.refresh(); overdue.refresh() }
    }, 30000)
    return () => window.clearInterval(timer)
  }, [recoveryTarget, overdueTarget, recoveries.refresh, overdue.refresh])
  useEffect(() => { setPage(0) }, [search, kind, status, sort])

  if (!facilityId) return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  const recoveryRows = recoveries.data || []
  const knownTasks = new Set(recoveryRows.map(row => row.taskId).filter(Boolean))
  const rows: Row[] = [
    ...recoveryRows.map(record => ({ kind: 'recovery' as const, record })),
    ...(overdue.data?.rows || []).filter(row => !row.recoveryTaskId || !knownTasks.has(row.recoveryTaskId))
      .map(record => ({ kind: 'overdue' as const, record })),
  ]
  const query = search.trim().toLocaleLowerCase('vi')
  const isOverdue = (row: Row) => !finished(row) && (row.kind === 'overdue' || Date.parse(deadline(row) || '') <= now)
  const filtered = rows.filter(row =>
    (kind === 'all' || kind === 'recovery' && row.kind === 'recovery'
      || row.kind === 'overdue' && row.record.kind === kind)
    && (status === 'all' || status === 'active' && !finished(row)
      || status === 'overdue' && isOverdue(row) || status === 'finished' && finished(row))
    && (!query || [rowCode(row), row.record.customerName, unitCode(row)].some(value => value?.toLocaleLowerCase('vi').includes(query))))
    .sort((a, b) => {
      if (sort === 'unit') return unitCode(a).localeCompare(unitCode(b), 'vi')
      if (sort === 'priority') {
        const difference = Number(finished(a)) - Number(finished(b)) || Number(isOverdue(b)) - Number(isOverdue(a))
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-stone-600">{filtered.length} hồ sơ</p>
      <Button variant="outline" size="sm" disabled={recoveries.loading || overdue.loading} onClick={refresh}>Tải lại</Button>
    </div>
    {(recoveries.loading || overdue.loading) && <p role="status">Đang tải hồ sơ…</p>}
    {recoveries.error != null && <p role="alert" className="text-sm text-red-700">Chưa tải được hồ sơ thu hồi. {rentalError(recoveries.error)}</p>}
    {overdue.error != null && <p role="alert" className="text-sm text-red-700">Chưa tải được hồ sơ quá hạn. {rentalError(overdue.error)}</p>}
    {overdue.data?.partial && <p role="status" className="text-sm text-amber-900">Dữ liệu quá hạn chưa đầy đủ từ các nguồn đối soát.</p>}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {filtered.slice(currentPage * 12, (currentPage + 1) * 12).map(row => <Card key={`${row.kind}:${row.kind === 'recovery' ? row.record.id : row.record.caseRef}`} className="min-w-0 space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="break-all text-base font-semibold">{rowCode(row)}</h3><p className="mt-1 text-sm text-stone-600">{rowType(row)}</p></div>
          {row.kind === 'overdue' ? <OverdueStatusBadge status={row.record.workflowStatus || row.record.priority} />
            : <span className={`recovery-status recovery-status--${row.record.stage.toLowerCase()}`}>{stageLabel(row.record)}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-stone-500">Khách hàng</dt><dd className="mt-1 break-words font-medium">{row.record.customerName || 'Chưa cập nhật'}</dd></div>
          <div><dt className="text-stone-500">Gian kho</dt><dd className="mt-1 break-all font-medium">{unitCode(row)}</dd></div>
          {row.kind === 'recovery' ? <>
            <div><dt className="text-stone-500">Phụ trách</dt><dd className="mt-1">{row.record.staffName || 'Chưa phân công'}</dd></div>
            <div><dt className="text-stone-500">Lịch thu hồi</dt><dd className="mt-1">{rentalDate(row.record.scheduledAt)}</dd></div>
          </> : <>
            <div><dt className="text-stone-500">Số ngày quá hạn</dt><dd className="mt-1 font-semibold text-red-700">{row.record.overdueDays} ngày</dd></div>
            {row.record.kind === 'PAYMENT_DUE' && <div><dt className="text-stone-500">Còn nợ</dt><dd className="mt-1 font-semibold">{rentalMoney(row.record.outstanding, row.record.currency || 'VND')}</dd></div>}
          </>}
        </dl>
        {row.kind === 'recovery' && <p className="text-sm text-stone-600">{reasons[row.record.reason] || 'Cần xử lý thu hồi kho'}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <div className="space-y-1 text-xs text-stone-600">
            <p>{finished(row) ? 'Đã kết thúc xử lý' : <>Hạn xử lý · {rentalDate(deadline(row))}</>}</p>
            {row.kind === 'recovery' && !finished(row) && <RecoveryCountdown deadline={deadline(row)} label="Xử lý" />}
          </div>
          <Button size="sm" variant="outline" onClick={() => row.kind === 'recovery'
            ? setRecoveryTarget({ id: row.record.id, request: Date.now() }) : setOverdueTarget(row.record.caseRef)}>Chi tiết</Button>
        </div>
      </Card>)}
    </div>
    {!recoveries.loading && !overdue.loading && !recoveries.error && !overdue.error && !filtered.length && <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">Không có hồ sơ phù hợp với bộ lọc.</p>}
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
