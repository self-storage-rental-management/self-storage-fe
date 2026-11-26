import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { apiDownload, apiRequest } from '../../services/apiClient'
import { uploadMaintenanceEvidence } from '../../services/maintenanceApi'
import { parseVietnamDate } from '../../utils/vietnamTime'
import { userFacingError } from '../../presentation/userFacingError'
import { revealRecord } from '../../utils/revealRecord'
import './ViolationRecoveryPanel.css'

const actionLabels = {
  CONFIRM_VIOLATION: 'Xác nhận mở thu hồi', ASSIGN: 'Phân công', ACCEPT: 'Tiếp nhận',
  DECLINE: 'Từ chối nhiệm vụ', WILL_ATTEND: 'Tôi sẽ có mặt',
  CANNOT_ATTEND: 'Tôi không thể có mặt', DISPUTE: 'Gửi phản đối hoặc khiếu nại', RESCHEDULE: 'Đổi lịch thu hồi',
  RECORD_PRESENT: 'Ghi nhận có mặt', RECORD_ABSENT: 'Ghi nhận vắng mặt', VERIFY: 'Đối chiếu giấy tờ',
  APPROVE: 'Phê duyệt thu hồi', START: 'Bắt đầu thu hồi', SAVE_ITEM: 'Ghi nhận kiện hàng',
  BLOCK: 'Tạm dừng và báo quản lý', RESUME: 'Tiếp tục xử lý', CANCEL: 'Hủy thu hồi',
  CLOSE_REMEDIATION: 'Đóng xử lý khắc phục', COMPLETE: 'Hoàn tất thu hồi',
  ASSIGN_PICKUP: 'Phân công bàn giao hàng', OPEN_PICKUP: 'Mở phiên nhận hàng',
  VERIFY_PICKUP: 'Xác minh người nhận', RELEASE_ITEM: 'Ghi nhận đã giao kiện',
  FOLLOW_UP_PICKUP: 'Rà soát hàng lưu tạm', REQUEST_FINANCE: 'Yêu cầu đối soát tài chính',
  RESOLVE_FINANCE: 'Ghi kết luận tài chính',
  RECORD_LIQUIDATION: 'Ghi nhận thanh lý hàng lưu tạm',
} as const
type Action = keyof typeof actionLabels

const stages = {
  REVIEW_REQUIRED: 'Chờ duyệt mở thu hồi', AWAITING_ASSIGNMENT: 'Chờ phân công',
  AWAITING_ACCEPTANCE: 'Chờ nhân viên tiếp nhận', AWAITING_ATTENDANCE: 'Chờ lịch hoặc xác minh khách',
  AWAITING_APPROVAL: 'Chờ phê duyệt', APPROVED: 'Đã phê duyệt', IN_PROGRESS: 'Đang thu hồi',
  BLOCKED: 'Đang tạm dừng', COMPLETED: 'Đã thu hồi', CANCELLED: 'Đã hủy thu hồi',
}
const reasons: Record<string, string> = {
  SETUP_OVERDUE: 'Quá hạn hoàn tất chuẩn bị', INVENTORY_NO_SHOW: 'Khách không đến kiểm kê',
  INVENTORY_IDENTITY_FAILED: 'Xác minh kiểm kê chưa thành công', INVENTORY_TIMEOUT: 'Quá hạn hoàn tất kiểm kê',
  INVENTORY_CONFIRMATION_OVERDUE: 'Quá hạn 48 giờ phản hồi kết quả kiểm kê',
  REMOVAL_OVERDUE: 'Quá hạn dọn hàng sau kiểm kê sai lệch', HANDOVER_FOLLOW_UP: 'Bàn giao sau đối soát cần xử lý',
}
const replies: Record<string, string> = {
  WILL_ATTEND: 'Sẽ có mặt', CANNOT_ATTEND: 'Không thể có mặt', DISPUTED: 'Đã gửi phản đối', NO_RESPONSE: 'Chưa phản hồi',
}
type HistoryEvent = {
  action: string; actorName: string; time: string; stage: keyof typeof stages; note: string | null
}
type Liquidation = { recordedAt: string; recordedBy: string | null; note: string | null; evidenceId: string | null }
type Review = {
  report: { available: boolean; recordedBy: string | null; publishedAt: string | null; mismatchSummary: string | null
    decisionNote: string | null; notes: string | null; goodsCondition: string | null; unitCondition: string | null
    packageCount: number | null; goods: { name: string; quantity: number }[]
    evidence: { id: string; name: string; contentType: string }[] }
  removalDeadlineAt: string | null; remediationStatus: string; remediationAt: string | null; remediationNote: string
  openingAllowed: boolean; blockingReason: string | null
}
type Entry = {
  id: string; unitCode: string; taskId: string | null; staffName: string | null
  reservationCode?: string | null; customerName?: string | null
  stage: keyof typeof stages; reason: string; owner: string | null; needsWitness: boolean
  sourceDeadlineAt?: string | null; requiredAt?: string | null
  scheduledAt: string | null; deadlineAt: string | null; actionDueAt: string | null; overdueAt: string | null
  completedAt?: string | null; arrivedAt?: string | null; verifiedAt?: string | null
  responseDueAt: string | null; reply: string | null; pickupDueAt: string | null
  financePending: boolean; reasonNote: string | null; customerNote: string | null; report: string | null
  attendanceEvidenceId?: string | null; beforeEvidenceId?: string | null; afterEvidenceId?: string | null
  verificationAttempts: number; pickupAttempts: number
  items: { code: string; name: string; condition: string; location: string | null; evidenceId?: string | null; disposition: string; releasedAt: string | null; releaseEvidenceId?: string | null; liquidation?: Liquidation | null }[]
  history?: HistoryEvent[]
  detectedAt?: string | null; escalated?: boolean; reviewDueAt?: string | null; businessReviewDueAt?: string | null; review?: Review | null
  actions: Action[]
}
type Staff = { id: string; name: string }
type Envelope<T> = { data: T }

const endpoint = '/api/violation-recoveries'
const needsNote = new Set<Action>(['CONFIRM_VIOLATION', 'DECLINE', 'DISPUTE', 'RESCHEDULE', 'APPROVE', 'BLOCK', 'RESUME', 'CANCEL', 'CLOSE_REMEDIATION', 'COMPLETE', 'FOLLOW_UP_PICKUP', 'REQUEST_FINANCE', 'RESOLVE_FINANCE', 'RECORD_LIQUIDATION'])
const needsPhoto = new Set<Action>(['RECORD_PRESENT', 'RECORD_ABSENT', 'START', 'SAVE_ITEM', 'COMPLETE', 'RELEASE_ITEM', 'RECORD_LIQUIDATION'])
const isPendingItem = (item: Entry['items'][number]) => item.disposition === 'STORED' && !item.releasedAt && !item.liquidation
const field = 'w-full rounded-md border border-stone-300 bg-white px-2 py-1.5'
const dateLabel = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Chưa ghi nhận'

const ownerLabels: Record<string, string> = {
  MANAGER: 'Quản lý', STAFF: 'Nhân viên', BUSINESS: 'Chủ doanh nghiệp', BO: 'Chủ doanh nghiệp',
  CUSTOMER: 'Khách hàng', ADMIN: 'Quản trị viên',
}
const responsiblePerson = (entry: Entry) => entry.staffName || ownerLabels[entry.owner || ''] || entry.owner || 'Chưa phân công'
const stageLabel = (entry: Entry) => entry.stage === 'REVIEW_REQUIRED' && entry.escalated ? 'Chờ BO duyệt mở thu hồi' : stages[entry.stage]
const deadlineLabels: Partial<Record<Entry['stage'], string>> = {
  REVIEW_REQUIRED: 'Hạn xác nhận', AWAITING_ASSIGNMENT: 'Hạn phân công',
  AWAITING_ACCEPTANCE: 'Hạn tiếp nhận', AWAITING_ATTENDANCE: 'Hạn xác minh khách',
  AWAITING_APPROVAL: 'Hạn phê duyệt', BLOCKED: 'Hạn xử lý tạm dừng',
}
function primaryAction(entry: Entry): Action | undefined {
  const priority: Action[] = [
    'CONFIRM_VIOLATION', 'RESUME', 'ACCEPT', 'APPROVE', 'START', 'SAVE_ITEM', 'COMPLETE',
    'VERIFY', 'RECORD_PRESENT', 'VERIFY_PICKUP', 'RELEASE_ITEM', 'OPEN_PICKUP',
    'ASSIGN_PICKUP', 'FOLLOW_UP_PICKUP', 'RECORD_LIQUIDATION', 'RESOLVE_FINANCE',
    'WILL_ATTEND', 'ASSIGN',
  ]
  return priority.find(key => entry.actions.includes(key))
}
const entryActionLabel = (entry: Entry, action: Action) => action === 'CANCEL' && entry.stage === 'REVIEW_REQUIRED'
  ? 'Không mở thu hồi' : action === 'ASSIGN' && entry.staffName ? 'Đổi nhân viên' : actionLabels[action]

const historyLabels: Record<string, string> = {
  ...actionLabels,
  NOTICE: 'Đã ghi nhận thông báo cho khách',
  DETECT: 'Hệ thống phát hiện vi phạm',
  REVIEW_ESCALATED: 'Quá hạn Manager duyệt, đã báo BO',
  BO_REVIEW_OVERDUE: 'BO chưa xử lý đúng hạn',
}

function SourceEvidenceFile({ file }: { file: Review['report']['evidence'][number] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (file.contentType.startsWith('image/')) return <EvidenceImagePreview id={file.id} label={file.name} />
  return <div>
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={async () => {
      setBusy(true)
      setError('')
      try {
        const asset = await apiDownload(`/api/files/${encodeURIComponent(file.id)}`)
        const url = URL.createObjectURL(asset.blob)
        const link = document.createElement('a')
        link.href = url
        link.download = asset.fileName || file.name
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch (err) { setError(userFacingError(err, 'Không thể tải chứng từ.')) }
      finally { setBusy(false) }
    }}>{busy ? 'Đang tải…' : file.name}</Button>
    {error && <p role="alert">{error}</p>}
  </div>
}

function RecoveryReview({ entry, onLoaded }: { entry: Entry; onLoaded?: (updated: Entry | undefined) => void }) {
  const [current, setCurrent] = useState<Entry>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    onLoadedRef.current?.(undefined)
    apiRequest<Envelope<Entry>>(`${endpoint}/${encodeURIComponent(entry.id)}`, { cache: 'no-store' })
      .then(({ data }) => {
        if (data.stage !== 'REVIEW_REQUIRED')
          throw new Error('Hồ sơ đã chuyển bước. Vui lòng làm mới danh sách trước khi xử lý.')
        if (!data.detectedAt || !data.reviewDueAt || !data.review)
          throw new Error('Hồ sơ chưa trả đủ thời hạn và dữ liệu đối chiếu. Vui lòng thử tải lại.')
        if (active) { setCurrent(data); onLoadedRef.current?.(data) }
      })
      .catch(reason => { if (active) setError(userFacingError(reason, 'Không tải được thời hạn và dữ liệu đối chiếu.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [entry.id])
  const review = current?.review
  if (loading || error || !current || !review) return <div className="recovery-review">
    {loading ? <p role="status">Đang tải thời hạn và dữ liệu đối chiếu…</p> : <>
      <p role="alert" className="recovery-review-warning">{error || 'Chưa tải được hồ sơ để đối chiếu.'}</p>
    </>}
  </div>
  const businessOverdue = !!current.businessReviewDueAt && Date.now() >= Date.parse(current.businessReviewDueAt)
  return <div className="recovery-review">
    <div className="recovery-review-deadline">
      <h4>Thời hạn duyệt</h4>
      <p>Phát sinh hồ sơ: <strong>{dateLabel(current.detectedAt)}</strong></p>
      <p>Manager: <strong>{dateLabel(current.reviewDueAt)}</strong> · Trong 1 giờ làm việc từ khi phát sinh hồ sơ.</p>
      <RecoveryCountdown deadline={current.escalated ? current.businessReviewDueAt : current.reviewDueAt} label={current.escalated ? 'BO xử lý' : 'Manager duyệt'} />
      {current.escalated ? <p className="recovery-review-warning">{businessOverdue ? 'BO đã quá hạn xử lý. Hồ sơ tiếp tục chờ quyết định mở hoặc không mở thu hồi.' : `Manager đã quá hạn duyệt. Đã báo BO tiếp tục xử lý${current.businessReviewDueAt ? ` trước ${dateLabel(current.businessReviewDueAt)}` : ''}.`}</p>
        : <p>Quá hạn sẽ báo BO xử lý trong 4 giờ làm việc. Hồ sơ tiếp tục chờ quyết định, không tự mở thu hồi.</p>}
    </div>
    <h4>Thông tin đối chiếu</h4>
    {!review ? <p>Chưa tải được dữ liệu đối chiếu. Vui lòng tải lại hồ sơ.</p> : <>
      <dl className="recovery-review-facts">
        <div><dt>{entry.reason === 'REMOVAL_OVERDUE' || entry.reason === 'HANDOVER_FOLLOW_UP' ? 'Hạn dọn hàng hiện tại' : 'Hạn thực hiện trước khi thu hồi'}</dt><dd>{dateLabel(review.removalDeadlineAt || entry.sourceDeadlineAt)}</dd></div>
        <div><dt>Kết quả kiểm kê công bố lúc</dt><dd>{dateLabel(review.report.publishedAt)}</dd></div>
        <div><dt>Tình trạng khắc phục đã ghi nhận</dt><dd>{review.remediationNote}{review.remediationAt && <span> · {dateLabel(review.remediationAt)}</span>}</dd></div>
      </dl>
      <div className="recovery-review-report">
        <h4>Biên bản và kết quả kiểm kê</h4>
        {!review.report.available && <p className="recovery-review-warning">Chưa có biên bản kiểm kê đã công bố trong hồ sơ. Dữ liệu đối chiếu lấy từ biên bản và ảnh/PDF do nhân viên công bố tại Nhận kho &amp; bàn giao → Kiểm kê. Cần đối chiếu chứng từ và hiện trạng trước khi quyết định.</p>}
        {review.report.recordedBy && <p>Người ghi nhận: {review.report.recordedBy}</p>}
        {review.report.mismatchSummary && <p>Sai lệch: {review.report.mismatchSummary}</p>}
        {review.report.decisionNote && <p>Kết luận xử lý: {review.report.decisionNote}</p>}
        {review.report.packageCount != null && <p>Số kiện thực tế: {review.report.packageCount}</p>}
        {review.report.goodsCondition && <p>Tình trạng hàng: {review.report.goodsCondition}</p>}
        {review.report.unitCondition && <p>Tình trạng gian kho: {review.report.unitCondition}</p>}
        {review.report.notes && <p>Ghi chú biên bản: {review.report.notes}</p>}
        {!!review.report.goods.length && <ul>{review.report.goods.map((goods, index) => <li key={index}>{goods.name} · {goods.quantity}</li>)}</ul>}
        {!!review.report.evidence.length && <div className="recovery-review-evidence">{review.report.evidence.map(file => <SourceEvidenceFile key={file.id} file={file} />)}</div>}
      </div>
      {!review.openingAllowed && <p role="alert" className="recovery-review-blocked">{review.blockingReason}</p>}
    </>}
  </div>
}

function RecoveryCountdown({ deadline, label }: { deadline?: string | null; label: string }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!deadline || !Number.isFinite(Date.parse(deadline))) return null
  const difference = Date.parse(deadline) - now
  const seconds = Math.ceil(Math.abs(difference) / 1000)
  const days = Math.floor(seconds / 86400)
  const clock = [Math.floor(seconds % 86400 / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
  return <span role="timer" aria-live="off" className={`recovery-countdown${difference <= 0 ? ' recovery-countdown--overdue' : ''}`}>
    {label}: {difference <= 0 ? 'Đã quá hạn' : 'Còn'} {days ? `${days} ngày ` : ''}{clock}
  </span>
}

function EvidenceImagePreview({ id, label }: { id: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setFailed(false)
    setUrl(null)
    apiDownload(`/api/files/${encodeURIComponent(id)}`)
      .then(asset => {
        if (!active) return
        objectUrl = URL.createObjectURL(asset.blob)
        setUrl(objectUrl)
      })
      .catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-2 text-xs">
      <p className="mb-1 font-medium text-stone-700">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={label} className="h-28 w-full rounded object-cover" />
        </a>
      ) : failed ? (
        <p className="text-stone-500">Không tải được ảnh. Vui lòng thử lại.</p>
      ) : (
        <p className="text-stone-500">Đang tải ảnh…</p>
      )}
    </div>
  )
}

function RecoveryAction({ entry, action, onBack, onSaved }: {
  entry: Entry; action: Action; onBack: () => void; onSaved: (entry: Entry) => void
}) {
  const assigning = action === 'ASSIGN' || action === 'ASSIGN_PICKUP'
  const witness = action === 'APPROVE' || action === 'START' && entry.needsWitness
  const verify = action === 'VERIFY' || action === 'VERIFY_PICKUP'
  const pickDate = action === 'RESCHEDULE' || action === 'FOLLOW_UP_PICKUP' || action === 'RESUME' || action === 'RECORD_PRESENT'
  const [staff, setStaff] = useState<Staff[]>([])
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const attempt = useRef<string | null>(null)
  const [error, setError] = useState('')
  const [reviewData, setReviewData] = useState<Entry>()
  useEffect(() => {
    if (!assigning && !witness) return
    let active = true
    apiRequest<Envelope<Staff[]>>(`${endpoint}/${entry.id}/staff`)
      .then(response => { if (active) setStaff(response.data) })
      .catch(err => { if (active) setError(userFacingError(err, 'Không thể tải danh sách nhân viên.')) })
    return () => { active = false }
  }, [assigning, witness, entry.id])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    if (action === 'CONFIRM_VIOLATION' && (!reviewData?.review?.openingAllowed || !reviewData.actions.includes(action))) {
      setError('Cần tải dữ liệu đối chiếu mới nhất và kiểm tra điều kiện trước khi mở thu hồi.')
      return
    }
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) || '').trim() || undefined
    const local = value('appointment')
    const date = local ? parseVietnamDate(local) : undefined
    if (date && !Number.isFinite(date.getTime())) {
      setError('Mốc thời gian không hợp lệ.')
      return
    }
    const appointmentAt = date?.toISOString()
    lock.current = true
    setBusy(true)
    setError('')
    try {
      let evidenceId: string | undefined
      if (needsPhoto.has(action)) {
        const photo = data.get('photo')
        if (!entry.taskId || !(photo instanceof File) || !photo.size) throw new Error('Cần ảnh hiện trường cho đúng nhiệm vụ.')
        evidenceId = (await uploadMaintenanceEvidence(entry.taskId, photo)).id
      }
      if (verify) attempt.current ??= crypto.randomUUID()
      const response = await apiRequest<Envelope<Entry>>(`${endpoint}/${entry.id}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          action, evidenceId, appointmentAt, staffId: value('staff'), witnessId: value('witness'),
          attemptId: verify ? attempt.current : undefined, document: value('document'), note: value('note'),
          itemCode: value('itemCode'), itemName: value('itemName'), condition: value('condition'),
          location: value('location'), disposition: value('disposition'),
        }),
      })
      onSaved(response.data)
    } catch (err) {
      setError(userFacingError(err, 'Không thể ghi nhận thao tác.'))
    } finally {
      setBusy(false)
      lock.current = false
    }
  }

  return <form className="recovery-action-form space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3" onSubmit={submit}>
    <h4 className="text-sm font-semibold">{entryActionLabel(entry, action)}</h4>
    {action === 'CONFIRM_VIOLATION' && <RecoveryReview entry={entry} onLoaded={setReviewData} />}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      {(assigning || witness) && <label>{assigning ? 'Nhân viên phụ trách' : 'Nhân chứng'}
        <select name={assigning ? 'staff' : 'witness'} className={field} required={assigning || action === 'START'}>
          <option value="">Chọn nhân viên</option>
          {staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select></label>}
      {pickDate && <label>{action === 'RECORD_PRESENT' ? 'Giờ khách đến (giờ Việt Nam)' : 'Lịch hẹn hoặc rà soát (giờ Việt Nam)'}
        <input type="datetime-local" name="appointment" className={field} required={action === 'RESCHEDULE' || action === 'FOLLOW_UP_PICKUP'} /></label>}
      {verify && <label>Số giấy tờ gốc
        <input type="password" name="document" className={field} maxLength={32} autoComplete="off" required
          onChange={() => { attempt.current = null }} /></label>}
      {needsPhoto.has(action) && <label>{action === 'RECORD_LIQUIDATION' ? 'Ảnh biên bản hoặc bằng chứng thanh lý' : 'Ảnh hiện trường'}<input type="file" name="photo" accept="image/*" className={field} required /></label>}
      {action === 'CLOSE_REMEDIATION' && <label>Kết quả khắc phục<select className={field} name="disposition" required>
        <option value="">Chọn kết quả</option><option value="RESTORED">Đủ điều kiện khôi phục gian cho khách</option>
        <option value="ALREADY_RESOLVED">Hồ sơ thuê và gian đã được xử lý riêng</option>
      </select></label>}
      {action === 'SAVE_ITEM' && <>
        <label>Mã kiện<input className={field} name="itemCode" maxLength={80} required /></label>
        <label>Tên kiện<input className={field} name="itemName" maxLength={240} required /></label>
        <label>Tình trạng<input className={field} name="condition" maxLength={240} required /></label>
        <label>Phương thức<select name="disposition" className={field} required>
          <option value="STORED">Lưu tạm</option><option value="HANDED_OVER">Bàn giao cho khách</option>
        </select></label>
      </>}
      {(action === 'RELEASE_ITEM' || action === 'RECORD_LIQUIDATION') && <label>{action === 'RECORD_LIQUIDATION' ? 'Kiện cần ghi nhận thanh lý' : 'Kiện chờ nhận'}<select name="itemCode" className={field} required>
        <option value="">Chọn kiện</option>{entry.items.filter(isPendingItem)
          .map(item => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
      </select></label>}
      {(action === 'START' || action === 'SAVE_ITEM') && <label>Nơi lưu tạm hoặc người nhận
        <input className={field} name="location" maxLength={240} required /></label>}
      {action === 'COMPLETE' && <label className="flex items-center gap-2">
        <input type="checkbox" name="disposition" value="VACATED" required /> Tôi đã xác nhận gian kho trống
      </label>}
      {action === 'RECORD_LIQUIDATION' && <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="disposition" value="LIQUIDATED" required /> Tôi xác nhận kiện hàng đã được xử lý thanh lý theo biên bản
      </label>}
      {needsNote.has(action) && <label className="sm:col-span-2">{action === 'CONFIRM_VIOLATION' ? 'Căn cứ mở thu hồi' : action === 'CANCEL' && entry.stage === 'REVIEW_REQUIRED' ? 'Lý do không mở thu hồi' : action === 'COMPLETE' ? 'Biên bản và kết quả xử lý khóa' : action === 'RECORD_LIQUIDATION' ? 'Căn cứ, biên bản và kết quả xử lý thanh lý' : 'Ghi chú và căn cứ'}
        <textarea className={field} name="note" maxLength={4000} rows={3} required placeholder={action === 'CONFIRM_VIOLATION' ? 'Ghi biên bản đã đối chiếu, hạn dọn hàng và kết quả kiểm tra khắc phục.' : undefined} /></label>}
    </fieldset>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onBack}>Quay lại</Button>
      <Button type="submit" size="sm" disabled={busy || action === 'CONFIRM_VIOLATION' && (!reviewData?.review?.openingAllowed || !reviewData.actions.includes(action))}>{busy ? 'Đang ghi…' : action === 'CONFIRM_VIOLATION' ? 'Xác nhận mở thu hồi' : 'Xác nhận'}</Button>
    </div>
  </form>
}

function RecoveryDetails({ entry }: { entry: Entry }) {
  return <div className="recovery-details">
    <div className="recovery-detail-heading">
      <span className={`recovery-status recovery-status--${entry.stage.toLowerCase()}`}>{stageLabel(entry)}</span>
      <p>{reasons[entry.reason] || 'Cần xử lý thu hồi kho'}</p>
    </div>
      {entry.stage === 'REVIEW_REQUIRED' && <RecoveryReview entry={entry} />}
      <dl className="recovery-detail-facts">
        <div><dt>Phụ trách</dt><dd className="font-medium">{responsiblePerson(entry)}</dd></div>
        {entry.sourceDeadlineAt && <div><dt>Hạn thực hiện trước khi thu hồi</dt><dd>{dateLabel(entry.sourceDeadlineAt)}</dd></div>}
        {entry.requiredAt && <div><dt>Ngày mở hồ sơ</dt><dd>{dateLabel(entry.requiredAt)}</dd></div>}
        <div><dt>Lịch thu hồi</dt><dd>{dateLabel(entry.scheduledAt)}</dd></div>
        {entry.deadlineAt && <div><dt>Hạn hoàn tất</dt><dd>{dateLabel(entry.deadlineAt)}</dd></div>}
        {entry.actionDueAt && <div><dt>Hạn xử lý tiếp theo</dt><dd>{dateLabel(entry.actionDueAt)}</dd></div>}
        {entry.responseDueAt && <div><dt>Hạn phản hồi</dt><dd>{dateLabel(entry.responseDueAt)}{entry.reply ? ` · ${replies[entry.reply]}` : ''}</dd></div>}
        {entry.arrivedAt && <div><dt>Giờ khách đến</dt><dd>{dateLabel(entry.arrivedAt)}</dd></div>}
        {entry.verifiedAt && <div><dt>Giờ xác minh</dt><dd>{dateLabel(entry.verifiedAt)}</dd></div>}
        {entry.completedAt && <div><dt>Hoàn tất thu hồi</dt><dd>{dateLabel(entry.completedAt)}</dd></div>}
        {entry.pickupDueAt && entry.items.some(isPendingItem) && <div><dt>Hẹn nhận tài sản lưu tạm</dt><dd>{dateLabel(entry.pickupDueAt)}</dd></div>}
      </dl>
      {entry.verificationAttempts > 0 && <p>Lượt xác minh thu hồi đã dùng {entry.verificationAttempts}/2</p>}
      {entry.pickupAttempts > 0 && <p>Lượt xác minh nhận hàng đã dùng {entry.pickupAttempts}/2</p>}
      {entry.financePending && <p>Đang chờ đối soát cọc hoặc công nợ.</p>}
      {entry.reasonNote && <p className="whitespace-pre-wrap break-words">{entry.reasonNote}</p>}
      {entry.customerNote && <p className="whitespace-pre-wrap break-words">Phản hồi của khách · {entry.customerNote}</p>}
      {entry.report && <p className="whitespace-pre-wrap break-words">Biên bản · {entry.report}</p>}
      {(entry.attendanceEvidenceId || entry.beforeEvidenceId || entry.afterEvidenceId
        || entry.items.some(item => item.evidenceId || item.releaseEvidenceId || item.liquidation?.evidenceId)) && (
        <div className="space-y-2 border-t border-stone-200 pt-2">
          <p className="text-xs font-semibold text-stone-700">Bằng chứng thu hồi</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {entry.attendanceEvidenceId && <EvidenceImagePreview id={entry.attendanceEvidenceId} label="Ảnh tiếp nhận khách" />}
            {entry.beforeEvidenceId && <EvidenceImagePreview id={entry.beforeEvidenceId} label="Ảnh trước thu hồi" />}
            {entry.afterEvidenceId && <EvidenceImagePreview id={entry.afterEvidenceId} label="Ảnh sau thu hồi" />}
            {entry.items.map(item => (
              <Fragment key={item.code}>
                {item.evidenceId && <EvidenceImagePreview id={item.evidenceId} label={`Ảnh kiện ${item.code}`} />}
                {item.releaseEvidenceId && <EvidenceImagePreview id={item.releaseEvidenceId} label={`Ảnh bàn giao ${item.code}`} />}
                {item.liquidation?.evidenceId && <EvidenceImagePreview id={item.liquidation.evidenceId} label={`Bằng chứng thanh lý ${item.code}`} />}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      {!!entry.items.length && <ul className="space-y-1 border-t border-stone-200 pt-2">
        {entry.items.map(item => <li key={item.code} className="break-words">
          {item.code} · {item.name} · {item.condition} · {item.liquidation ? 'Đã thanh lý' : item.releasedAt ? 'Đã giao' : 'Đang lưu tạm'}{item.location && ` · ${item.location}`}
          {item.liquidation && <p className="text-xs text-stone-600">Ghi nhận thanh lý: {dateLabel(item.liquidation.recordedAt)}{item.liquidation.note && ` · ${item.liquidation.note}`}</p>}
        </li>)}
      </ul>}
      {!!entry.history?.length && (
        <details className="border-t border-stone-200 pt-2 text-xs text-stone-600">
          <summary className="cursor-pointer font-medium text-stone-700 hover:text-stone-900">
            Lịch sử xử lý ({entry.history.length})
          </summary>
          <ul className="mt-1.5 space-y-1 border-l-2 border-stone-200 pl-3">
            {entry.history.map((h, idx) => (
              <li key={idx}>
                {dateLabel(h.time)} · <b>{historyLabels[h.action] || 'Cập nhật hồ sơ'}</b> · {h.actorName} ({stages[h.stage] || 'Đã cập nhật'})
                {h.note ? ` · ${h.note}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
  </div>
}

export function ViolationRecoveryEntry({ label = 'Thu hồi kho', sourceReturnId }: { label?: string; sourceReturnId?: string }) {
  const [open, setOpen] = useState(false)
  return <div className="min-w-0">
    <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? 'Thu gọn hồ sơ thu hồi' : label}
    </Button>
    {open && <ViolationRecoveryPanel sourceReturnId={sourceReturnId} />}
  </div>
}

export function ViolationRecoveryPanel({ sourceReturnId, activeOnly = false, target }: {
  sourceReturnId?: string; activeOnly?: boolean; target?: { id: string; request: number }
}) {
  const [page, setPage] = useState(0)
  const [entries, setEntries] = useState<Entry[]>([])
  const [action, setAction] = useState<{ id: string; action: Action }>()
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [targetId, setTargetId] = useState(target?.id)
  const [showClosed, setShowClosed] = useState(false)
  const [detailId, setDetailId] = useState<string>()
  const targetCard = useRef<HTMLElement>(null)
  const revealedTarget = useRef<typeof target>(undefined)
  useEffect(() => {
    setTargetId(target?.id)
    setPage(0)
    setAction(undefined)
    setDetailId(undefined)
  }, [target])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const query = sourceReturnId ? `sourceReturnId=${encodeURIComponent(sourceReturnId)}` : `page=${page}&activeOnly=${activeOnly && !showClosed}`
    const load = targetId
      ? apiRequest<Envelope<Entry>>(`${endpoint}/${encodeURIComponent(targetId)}`).then(response => [response.data])
      : apiRequest<Envelope<Entry[]>>(`${endpoint}?${query}`).then(response => response.data)
    load.then(rows => {
      if (rows.some(row => row.stage === 'REVIEW_REQUIRED' && (!row.review || !row.reviewDueAt || !row.detectedAt)))
        throw new Error('Chưa tải đủ thời hạn và dữ liệu đối chiếu để duyệt hồ sơ. Vui lòng làm mới danh sách.')
      if (active) setEntries(rows)
    })
      .catch(err => { if (active) setError(userFacingError(err, 'Không thể tải hồ sơ thu hồi.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh, sourceReturnId, activeOnly, targetId, showClosed])

  useEffect(() => {
    if (!target || target.id !== targetId || loading || error || !targetCard.current
      || revealedTarget.current === target) return
    revealedTarget.current = target
    revealRecord(targetCard.current)
  }, [target, targetId, loading, error, entries])

  const detailEntry = entries.find(entry => entry.id === detailId)
  const openAction = (entry: Entry, key: Action) => {
    setDetailId(undefined)
    setAction({ id: entry.id, action: key })
  }

  if (detailEntry) return <section className="recovery-panel space-y-4" aria-label="Chi tiết hồ sơ thu hồi">
    <Button size="sm" variant="outline" onClick={() => setDetailId(undefined)}>Quay lại</Button>
    <h3 className="text-lg font-semibold">Hồ sơ thu hồi · {detailEntry.reservationCode || detailEntry.unitCode}</h3>
        <RecoveryDetails entry={detailEntry} />
        {!!detailEntry.actions.length && <div className="recovery-detail-actions">
          <h4>Thao tác với hồ sơ</h4>
          <div>{detailEntry.actions.map(key => <Button key={key} size="sm" variant={key === primaryAction(detailEntry) ? 'primary' : 'outline'}
            onClick={() => openAction(detailEntry, key)}>{entryActionLabel(detailEntry, key)}</Button>)}</div>
        </div>}
  </section>

  return <div className="recovery-panel">
    <div className="recovery-toolbar">
      <div className="recovery-view-switch">
        {activeOnly && !targetId && <>
          <button type="button" aria-pressed={!showClosed} disabled={!!action} onClick={() => { setShowClosed(false); setPage(0) }}>Đang xử lý</button>
          <button type="button" aria-pressed={showClosed} disabled={!!action} onClick={() => { setShowClosed(true); setPage(0) }}>Tất cả hồ sơ</button>
        </>}
        {targetId && <Button size="sm" variant="outline" disabled={!!action} onClick={() => setTargetId(undefined)}>Về danh sách thu hồi</Button>}
      </div>
      <Button size="sm" variant="ghost" disabled={loading || !!action} onClick={() => setRefresh(value => value + 1)}>Làm mới</Button>
    </div>
    {error && <p role="alert" className="recovery-error">{error}</p>}
    {loading && <p role="status" className="recovery-empty">Đang tải hồ sơ thu hồi…</p>}
    {!loading && !error && !entries.length && <p className="recovery-empty">{sourceReturnId ? 'Chưa có hồ sơ thu hồi cho yêu cầu trả kho này.' : 'Chưa có hồ sơ thu hồi trong danh sách.'}</p>}
    {!loading && !error && entries.map(entry => {
      const mainAction = primaryAction(entry)
      const pendingItems = entry.items.filter(isPendingItem).length
      const closed = entry.stage === 'COMPLETED' || entry.stage === 'CANCELLED'
      const currentDueAt = entry.stage === 'REVIEW_REQUIRED'
        ? entry.escalated ? entry.businessReviewDueAt : entry.reviewDueAt : entry.actionDueAt
      const reviewOverdue = entry.stage === 'REVIEW_REQUIRED' && !!currentDueAt && Date.now() >= Date.parse(currentDueAt)
      return <section key={entry.id} ref={entry.id === targetId ? targetCard : undefined} tabIndex={-1} className="recovery-case" aria-label={`Hồ sơ thu hồi ${entry.reservationCode || entry.unitCode}`}>
        <div className="recovery-case-header">
          <div>
            <h3>{entry.reservationCode || entry.unitCode}</h3>
            <p className="recovery-reason">{reasons[entry.reason] || 'Cần xử lý thu hồi kho'}</p>
          </div>
          <div className="recovery-status-group">
            <span className={`recovery-status recovery-status--${entry.stage.toLowerCase()}`}>{stageLabel(entry)}</span>
            {(entry.overdueAt || reviewOverdue) && !closed && <span className="recovery-overdue">{reviewOverdue ? 'Quá hạn duyệt' : 'Quá hạn xử lý'}</span>}
          </div>
        </div>
        <dl className="recovery-case-facts">
          <div><dt>Khách hàng</dt><dd>{entry.customerName || 'Chưa cập nhật'}</dd></div>
          <div><dt>Gian kho</dt><dd>{entry.unitCode}</dd></div>
          <div><dt>Nhân viên phụ trách</dt><dd>{entry.staffName || 'Chưa phân công'}</dd></div>
          <div><dt>{entry.stage === 'REVIEW_REQUIRED' ? 'Phát sinh hồ sơ' : entry.stage === 'COMPLETED' ? 'Hoàn tất thu hồi' : 'Lịch thu hồi'}</dt><dd>{dateLabel(entry.stage === 'REVIEW_REQUIRED' ? entry.detectedAt : entry.stage === 'COMPLETED' ? entry.completedAt : entry.scheduledAt)}</dd></div>
        </dl>
        {pendingItems > 0 && <p className="recovery-item-notice">{pendingItems} kiện hàng đang lưu tạm{entry.pickupDueAt ? ` · Hẹn nhận: ${dateLabel(entry.pickupDueAt)}` : ''}</p>}
        {entry.financePending && <p className="recovery-item-notice">Đang chờ đối soát cọc hoặc công nợ.</p>}
        <div className="recovery-case-footer">
          <p className="recovery-next-step">
            {entry.stage === 'AWAITING_ASSIGNMENT' ? 'Cần phân công nhân viên' :
              entry.stage === 'AWAITING_ACCEPTANCE' ? `Chờ ${entry.staffName || 'nhân viên'} tiếp nhận` :
              entry.stage === 'BLOCKED' ? 'Đang tạm dừng, chờ quản lý xử lý' : ''}
            {!closed && currentDueAt && <span>{entry.stage === 'REVIEW_REQUIRED' && entry.escalated ? 'Hạn BO xử lý' : deadlineLabels[entry.stage] || 'Hạn xử lý'}: {dateLabel(currentDueAt)}</span>}
            {!closed && currentDueAt && <RecoveryCountdown deadline={currentDueAt} label={entry.stage === 'REVIEW_REQUIRED' ? entry.escalated ? 'BO xử lý' : 'Manager duyệt' : 'Xử lý'} />}
          </p>
          <div className="recovery-case-actions">
            <Button size="sm" variant="outline" disabled={!!action} onClick={() => setDetailId(entry.id)}>Chi tiết</Button>
            {entry.stage === 'REVIEW_REQUIRED' && entry.actions.includes('CANCEL') && <Button size="sm" variant="outline" disabled={!!action} onClick={() => openAction(entry, 'CANCEL')}>Không mở thu hồi</Button>}
            {mainAction && <Button size="sm" disabled={!!action} onClick={() => openAction(entry, mainAction)}>{entryActionLabel(entry, mainAction)}</Button>}
          </div>
        </div>
        {action?.id === entry.id && <RecoveryAction key={action.action} entry={entry} action={action.action}
          onBack={() => setAction(undefined)} onSaved={updated => {
            setEntries(current => current.map(item => item.id === updated.id ? updated : item))
            setAction(undefined)
          }} />}
      </section>
    })}
    {!sourceReturnId && !targetId && (page > 0 || entries.length === 30) && <div className="recovery-pagination">
      <Button size="sm" variant="outline" disabled={loading || !!action || page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</Button>
      <Button size="sm" variant="outline" disabled={loading || !!action || entries.length < 30} onClick={() => setPage(value => value + 1)}>Trang sau</Button>
    </div>}

  </div>
}
