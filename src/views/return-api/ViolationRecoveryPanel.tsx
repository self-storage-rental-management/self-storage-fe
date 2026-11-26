import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { apiRequest } from '../../services/apiClient'
import { uploadMaintenanceEvidence } from '../../services/maintenanceApi'
import { parseVietnamDate } from '../../utils/vietnamTime'
import { userFacingError } from '../../presentation/userFacingError'

const actionLabels = {
  CONFIRM_VIOLATION: 'Xác nhận căn cứ vi phạm', ASSIGN: 'Phân công', ACCEPT: 'Tiếp nhận',
  DECLINE: 'Từ chối nhiệm vụ', NOTICE: 'Ghi nhận thông báo hợp lệ', WILL_ATTEND: 'Tôi sẽ có mặt',
  CANNOT_ATTEND: 'Tôi không thể có mặt', DISPUTE: 'Gửi phản đối hoặc khiếu nại', RESCHEDULE: 'Đổi lịch ngoại lệ',
  RECORD_PRESENT: 'Ghi nhận có mặt', RECORD_ABSENT: 'Ghi nhận vắng mặt', VERIFY: 'Đối chiếu giấy tờ',
  APPROVE: 'Phê duyệt thu hồi', START: 'Bắt đầu thu hồi', SAVE_ITEM: 'Ghi nhận kiện hàng',
  BLOCK: 'Tạm dừng và báo quản lý', RESUME: 'Tiếp tục xử lý ngoại lệ', CANCEL: 'Hủy và khắc phục',
  CLOSE_REMEDIATION: 'Đóng xử lý khắc phục', COMPLETE: 'Hoàn tất thu hồi',
  ASSIGN_PICKUP: 'Phân công bàn giao hàng', OPEN_PICKUP: 'Mở phiên nhận hàng',
  VERIFY_PICKUP: 'Xác minh người nhận', RELEASE_ITEM: 'Ghi nhận đã giao kiện',
  FOLLOW_UP_PICKUP: 'Rà soát hàng lưu tạm', REQUEST_FINANCE: 'Yêu cầu đối soát tài chính',
  RESOLVE_FINANCE: 'Ghi kết luận tài chính',
} as const
type Action = keyof typeof actionLabels

const stages = {
  REVIEW_REQUIRED: 'Chờ xác định căn cứ', AWAITING_ASSIGNMENT: 'Chờ phân công',
  AWAITING_ACCEPTANCE: 'Chờ nhân viên tiếp nhận', AWAITING_ATTENDANCE: 'Chờ lịch hoặc xác minh khách',
  AWAITING_APPROVAL: 'Chờ phê duyệt', APPROVED: 'Đã phê duyệt', IN_PROGRESS: 'Đang thu hồi',
  BLOCKED: 'Đang tạm dừng', COMPLETED: 'Đã thu hồi', CANCELLED: 'Đã hủy thu hồi',
}
const reasons: Record<string, string> = {
  SETUP_OVERDUE: 'Quá hạn hoàn tất chuẩn bị', INVENTORY_NO_SHOW: 'Khách không đến kiểm kê',
  INVENTORY_IDENTITY_FAILED: 'Xác minh kiểm kê chưa thành công', INVENTORY_TIMEOUT: 'Quá hạn hoàn tất kiểm kê',
  REMOVAL_OVERDUE: 'Quá hạn dọn hàng sau kiểm kê sai lệch', HANDOVER_FOLLOW_UP: 'Bàn giao sau đối soát cần xử lý',
}
const replies: Record<string, string> = {
  WILL_ATTEND: 'Sẽ có mặt', CANNOT_ATTEND: 'Không thể có mặt', DISPUTED: 'Đã gửi phản đối', NO_RESPONSE: 'Chưa phản hồi',
}
type Entry = {
  id: string; unitCode: string; taskId: string | null; staffName: string | null
  stage: keyof typeof stages; reason: string; owner: string | null; needsWitness: boolean
  scheduledAt: string | null; deadlineAt: string | null; actionDueAt: string | null; overdueAt: string | null
  responseDueAt: string | null; reply: string | null; pickupDueAt: string | null
  financePending: boolean; reasonNote: string | null; customerNote: string | null; report: string | null
  verificationAttempts: number; pickupAttempts: number
  items: { code: string; name: string; condition: string; location: string | null; disposition: string; releasedAt: string | null }[]
  actions: Action[]
}
type Staff = { id: string; name: string }
type Envelope<T> = { data: T }

const endpoint = '/api/violation-recoveries'
const needsNote = new Set<Action>(['CONFIRM_VIOLATION', 'DECLINE', 'NOTICE', 'DISPUTE', 'RESCHEDULE', 'APPROVE', 'BLOCK', 'RESUME', 'CANCEL', 'CLOSE_REMEDIATION', 'COMPLETE', 'FOLLOW_UP_PICKUP', 'REQUEST_FINANCE', 'RESOLVE_FINANCE'])
const needsPhoto = new Set<Action>(['RECORD_PRESENT', 'RECORD_ABSENT', 'START', 'SAVE_ITEM', 'COMPLETE', 'RELEASE_ITEM'])
const field = 'w-full rounded-md border border-stone-300 bg-white px-2 py-1.5'
const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  : 'Chưa ghi nhận'

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

  return <form className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3" onSubmit={submit}>
    <h4 className="text-sm font-semibold">{actionLabels[action]}</h4>
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
      {needsPhoto.has(action) && <label>Ảnh hiện trường<input type="file" name="photo" accept="image/*" className={field} required /></label>}
      {action === 'NOTICE' && <label>Kênh thông báo<select className={field} name="disposition" required>
        <option value="">Chọn kênh</option><option value="APP">Ứng dụng</option><option value="EMAIL">Email</option>
        <option value="DELIVERED_IN_PERSON">Trực tiếp</option><option value="OTHER">Kênh khác đã được xác nhận</option>
      </select></label>}
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
      {action === 'RELEASE_ITEM' && <label>Kiện chờ nhận<select name="itemCode" className={field} required>
        <option value="">Chọn kiện</option>{entry.items.filter(item => item.disposition === 'STORED' && !item.releasedAt)
          .map(item => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
      </select></label>}
      {(action === 'START' || action === 'SAVE_ITEM') && <label>Nơi lưu tạm hoặc người nhận
        <input className={field} name="location" maxLength={240} required /></label>}
      {action === 'COMPLETE' && <label className="flex items-center gap-2">
        <input type="checkbox" name="disposition" value="VACATED" required /> Tôi đã xác nhận gian kho trống
      </label>}
      {needsNote.has(action) && <label className="sm:col-span-2">{action === 'NOTICE' ? 'Mã hoặc bằng chứng thông báo đã được xác nhận' :
        action === 'COMPLETE' ? 'Biên bản và kết quả xử lý khóa' : 'Ghi chú và căn cứ'}
        <textarea className={field} name="note" maxLength={4000} rows={3} required /></label>}
    </fieldset>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onBack}>Quay lại</Button>
      <Button type="submit" size="sm" disabled={busy}>{busy ? 'Đang ghi…' : 'Xác nhận'}</Button>
    </div>
  </form>
}

export default function ViolationRecoveryPanel() {
  const [page, setPage] = useState(0)
  const [entries, setEntries] = useState<Entry[]>([])
  const [action, setAction] = useState<{ id: string; action: Action }>()
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    apiRequest<Envelope<Entry[]>>(`${endpoint}?page=${page}`)
      .then(response => { if (active) setEntries(response.data) })
      .catch(err => { if (active) setError(userFacingError(err, 'Không thể tải hồ sơ thu hồi.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh])

  return <div className="space-y-3 text-sm">
    <Button size="sm" variant="outline" disabled={loading || !!action} onClick={() => setRefresh(value => value + 1)}>Tải lại</Button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {loading && <p role="status">Đang tải hồ sơ thu hồi…</p>}
    {!loading && !error && !entries.length && <p>Chưa có hồ sơ thu hồi trong danh sách.</p>}
    {!loading && !error && entries.map(entry => <section key={entry.id} className="space-y-3 rounded-lg border border-stone-200 p-3 sm:p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">Gian {entry.unitCode} · {stages[entry.stage]}</h3>
        {entry.overdueAt && <p className="font-medium text-red-700">Quá hạn</p>}
      </div>
      <p>{reasons[entry.reason]}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt>Phụ trách</dt><dd className="font-medium">{entry.staffName || entry.owner || 'Chưa phân công'}</dd></div>
        <div><dt>Lịch thu hồi</dt><dd>{dateLabel(entry.scheduledAt)}</dd></div>
        {entry.deadlineAt && <div><dt>Hạn hoàn tất</dt><dd>{dateLabel(entry.deadlineAt)}</dd></div>}
        {entry.actionDueAt && <div><dt>Hạn bước hiện tại</dt><dd>{dateLabel(entry.actionDueAt)}</dd></div>}
        {entry.responseDueAt && <div><dt>Hạn phản hồi</dt><dd>{dateLabel(entry.responseDueAt)}{entry.reply ? ` · ${replies[entry.reply]}` : ''}</dd></div>}
        {entry.pickupDueAt && <div><dt>Hẹn nhận tài sản lưu tạm</dt><dd>{dateLabel(entry.pickupDueAt)}</dd></div>}
      </dl>
      {entry.verificationAttempts > 0 && <p>Lượt xác minh thu hồi đã dùng {entry.verificationAttempts}/2</p>}
      {entry.pickupAttempts > 0 && <p>Lượt xác minh nhận hàng đã dùng {entry.pickupAttempts}/2</p>}
      {entry.financePending && <p>Đang chờ đối soát cọc hoặc công nợ.</p>}
      {entry.reasonNote && <p className="whitespace-pre-wrap break-words">{entry.reasonNote}</p>}
      {entry.customerNote && <p className="whitespace-pre-wrap break-words">Phản hồi của khách · {entry.customerNote}</p>}
      {entry.report && <p className="whitespace-pre-wrap break-words">Biên bản · {entry.report}</p>}
      {!!entry.items.length && <ul className="space-y-1 border-t border-stone-200 pt-2">
        {entry.items.map(item => <li key={item.code} className="break-words">{item.code} · {item.name} · {item.condition} · {item.releasedAt ? 'Đã giao' : 'Đang lưu tạm'}{item.location && ` · ${item.location}`}</li>)}
      </ul>}
      {action?.id === entry.id ? <RecoveryAction key={action.action} entry={entry} action={action.action}
        onBack={() => setAction(undefined)} onSaved={updated => {
          setEntries(current => current.map(item => item.id === updated.id ? updated : item))
          setAction(undefined)
        }} /> : <div className="flex flex-wrap gap-2">
          {entry.actions.map(key => <Button key={key} size="sm" variant="outline" disabled={!!action}
            onClick={() => setAction({ id: entry.id, action: key })}>{actionLabels[key]}</Button>)}
        </div>}
    </section>)}
    {(page > 0 || entries.length === 30) && <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={loading || !!action || page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</Button>
      <Button size="sm" variant="outline" disabled={loading || !!action || entries.length < 30} onClick={() => setPage(value => value + 1)}>Trang sau</Button>
    </div>}
  </div>
}
