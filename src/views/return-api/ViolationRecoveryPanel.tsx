import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Modal } from '../../components/ui'
import FilePreviewDialog, { type FilePreview } from '../../components/FilePreviewDialog'
import { apiDownload, apiRequest } from '../../services/apiClient'
import { uploadMaintenanceEvidence } from '../../services/maintenanceApi'
import { parseVietnamDate } from '../../utils/vietnamTime'
import { userFacingError } from '../../presentation/userFacingError'
import { revealRecord } from '../../utils/revealRecord'
import './ViolationRecoveryPanel.css'
import { isManagerOverdueRecovery, visibleRecoveryActions } from '../../domain/recoveryActions'
import { displayRoleNames } from '../../presentation/displayText'
import { canHandOverRecovery, type RecoveryVerification } from '../../domain/recoveryVerification'
import { recoveryPickupBounds, recoveryPickupError } from '../../domain/recoveryPickup'
import { staffGoodsCategoryLabel as goodsCategoryLabel } from '../staff/staffPresentation'
import { groupRecoveryItems, groupQuantityLines, isPendingRecoveryItem, pendingRecoveryChoices, recoveryItemCounts, type RecoveryItem } from '../../domain/recoveryItems'

const actionLabels = {
  ASSIGN: 'Phân công', WILL_ATTEND: 'Tôi sẽ có mặt',
  CANNOT_ATTEND: 'Tôi không thể có mặt', DISPUTE: 'Gửi phản đối hoặc khiếu nại',
  RECORD_PRESENT: 'Ghi nhận có mặt', RECORD_ABSENT: 'Ghi nhận vắng mặt', VERIFY: 'Xác minh khách khi thu hồi',
  START: 'Bắt đầu thu hồi', SAVE_ITEM: 'Ghi nhận kiện hàng',
  BLOCK: 'Tạm dừng và báo quản lý', RESUME: 'Duyệt phản hồi và tiếp tục', CANCEL: 'Hủy thu hồi',
  CLOSE_REMEDIATION: 'Đóng xử lý khắc phục', COMPLETE: 'Hoàn tất thu hồi',
  ASSIGN_PICKUP: 'Phân công bàn giao hàng', SCHEDULE_PICKUP: 'Đặt lịch nhận hàng', OPEN_PICKUP: 'Mở phiên nhận hàng',
  VERIFY_PICKUP: 'Xác minh người nhận hàng', RELEASE_ITEM: 'Ghi nhận bàn giao hàng',
  FOLLOW_UP_PICKUP: 'Rà soát hàng lưu tạm', REQUEST_FINANCE: 'Yêu cầu đối soát tài chính',
  RESOLVE_FINANCE: 'Ghi kết luận tài chính',
  RECORD_LIQUIDATION: 'Ghi nhận thanh lý hàng lưu tạm',
} as const
type Action = keyof typeof actionLabels

const stages = {
  REVIEW_REQUIRED: 'Đang chuyển sang thu hồi', AWAITING_ASSIGNMENT: 'Chờ phân công',
  AWAITING_ACCEPTANCE: 'Chờ lịch thu hồi', AWAITING_ATTENDANCE: 'Chờ lịch hoặc xác minh khách',
  AWAITING_APPROVAL: 'Chờ lịch thu hồi', APPROVED: 'Chờ lịch thu hồi', IN_PROGRESS: 'Đang thu hồi',
  BLOCKED: 'Đang tạm dừng', COMPLETED: 'Đã thu hồi', CANCELLED: 'Đã hủy thu hồi',
}
export const reasons: Record<string, string> = {
  SETUP_OVERDUE: 'Quá hạn hoàn tất chuẩn bị', INVENTORY_NO_SHOW: 'Khách không đến kiểm kê',
  INVENTORY_IDENTITY_FAILED: 'Xác minh kiểm kê chưa thành công', INVENTORY_TIMEOUT: 'Quá hạn hoàn tất kiểm kê',
  INVENTORY_CONFIRMATION_OVERDUE: 'Quá hạn 48 giờ phản hồi kết quả kiểm kê',
  REMOVAL_OVERDUE: 'Quá hạn dọn hàng sau kiểm kê sai lệch', HANDOVER_FOLLOW_UP: 'Bàn giao sau đối soát cần xử lý',
  CONFIRMED_PROHIBITED_GOODS: 'Vi phạm hàng cấm đã xác minh',
}
const replies: Record<string, string> = {
  WILL_ATTEND: 'Sẽ có mặt', CANNOT_ATTEND: 'Không thể có mặt', DISPUTED: 'Đã gửi phản đối', NO_RESPONSE: 'Chưa phản hồi',
}
type HistoryEvent = {
  action: string; actorName: string; time: string; stage: keyof typeof stages; note: string | null
}
type CommunicationEntry = {
  role: string; actorName: string; action: string; time: string; note: string | null; attachmentIds?: string[]
}
export type Entry = {
  id: string; unitCode: string; taskId: string | null; staffName: string | null
  reservationCode?: string | null; customerName?: string | null
  stage: keyof typeof stages; reason: string; owner: string | null; needsWitness: boolean
  sourceDeadlineAt?: string | null; requiredAt?: string | null
  scheduledAt: string | null; deadlineAt: string | null; actionDueAt: string | null; overdueAt: string | null
  completedAt?: string | null; arrivedAt?: string | null; verifiedAt?: string | null
  responseDueAt: string | null; reply: string | null; pickupDueAt: string | null; pickupAppointmentAt?: string | null
  financePending: boolean; reasonNote: string | null; customerNote: string | null; report: string | null
  attendanceEvidenceId?: string | null; beforeEvidenceId?: string | null; afterEvidenceId?: string | null
  verificationAttempts: number; pickupAttempts: number
  attendance?: 'PRESENT' | 'ABSENT' | null
  verification?: RecoveryVerification | null; pickupVerification?: RecoveryVerification | null
  items: RecoveryItem[]
  history?: HistoryEvent[]
  detectedAt?: string | null; escalated?: boolean; reviewDueAt?: string | null; businessReviewDueAt?: string | null; review?: unknown
  canViewSourceGoods?: boolean
  managerResponseNote?: string | null
  managerRespondedAt?: string | null
  customerAttachmentIds?: string[]
  managerAttachmentIds?: string[]
  communications?: CommunicationEntry[]
  actions: Action[]
}
type Staff = { id: string; name: string }
type RecoveryPageInfo = { page: number; pageSize: number; totalItems: number; totalPages: number }
type Envelope<T> = { data: T; pagination?: RecoveryPageInfo }
const CUSTOMER_PAGE_SIZE = 8

const endpoint = '/api/violation-recoveries'
const needsNote = new Set<Action>(['DISPUTE', 'BLOCK', 'RESUME', 'CANCEL', 'COMPLETE', 'FOLLOW_UP_PICKUP', 'REQUEST_FINANCE', 'RESOLVE_FINANCE', 'RECORD_LIQUIDATION'])
const needsPhoto = new Set<Action>(['RECORD_PRESENT', 'RECORD_ABSENT', 'START', 'SAVE_ITEM', 'COMPLETE', 'RELEASE_ITEM', 'RECORD_LIQUIDATION'])
const supportsAttachments = new Set<Action>(['DISPUTE', 'RESUME', 'CANCEL', 'CLOSE_REMEDIATION', 'BLOCK'])
const isPendingItem = isPendingRecoveryItem
const field = 'w-full rounded-md border border-stone-300 bg-white px-2 py-1.5'
const dateLabel = (value?: string | null) => value
  ? parseVietnamDate(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Chưa ghi nhận'

const ownerLabels: Record<string, string> = {
  MANAGER: 'Quản lý cơ sở', STAFF: 'Nhân viên', BUSINESS: 'Chủ doanh nghiệp', BO: 'Chủ doanh nghiệp',
  CUSTOMER: 'Khách hàng', ADMIN: 'Quản trị viên',
}
const responsiblePerson = (entry: Entry) => entry.staffName || ownerLabels[entry.owner || ''] || entry.owner || 'Chưa phân công'
export const stageLabel = (entry: Entry) => stages[entry.stage]
const deadlineLabels: Partial<Record<Entry['stage'], string>> = {
  AWAITING_ASSIGNMENT: 'Hạn phân công',
  AWAITING_ATTENDANCE: 'Hạn hoàn tất thu hồi', BLOCKED: 'Hạn xử lý tạm dừng',
}
function primaryAction(entry: Entry): Action | undefined {
  const priority: Action[] = [
    'RESUME', 'VERIFY', 'START', 'SAVE_ITEM', 'COMPLETE',
    'RECORD_PRESENT', 'VERIFY_PICKUP', 'RELEASE_ITEM', 'OPEN_PICKUP',
    'ASSIGN_PICKUP', 'FOLLOW_UP_PICKUP', 'RECORD_LIQUIDATION', 'RESOLVE_FINANCE',
    'WILL_ATTEND', 'ASSIGN',
  ]
  return priority.find(key => visibleRecoveryActions(entry.actions, entry.stage, entry.responseDueAt, undefined, entry.reply).includes(key))
}
const entryActionLabel = (entry: Entry, action: Action) => action === 'ASSIGN' && entry.staffName ? 'Đổi nhân viên'
  : action === 'START' && !canHandOverRecovery(entry) ? 'Thu hồi và lưu tạm' : actionLabels[action]

export function RecoveryCountdown({ deadline, label }: { deadline?: string | null; label: string }) {
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

async function uploadRecoveryAttachment(recoveryId: string, file: File): Promise<string> {
  const form = new FormData()
  form.set('file', file)
  form.set('entityType', 'VIOLATION_RECOVERY')
  form.set('entityId', recoveryId)
  const response = await apiRequest<{ data?: { id?: string } }>('/api/files', { method: 'POST', body: form })
  if (!response?.data?.id) throw new Error('Không thể tải tệp đính kèm lên hệ thống.')
  return response.data.id
}

function EvidenceImagePreview({ id, label }: { id: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState(label)
  const [contentType, setContentType] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
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
        setFileName(asset.fileName || label)
        setContentType(asset.contentType || asset.blob.type || '')
      })
      .catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, label])

  const isImage = contentType.startsWith('image/')
  const previewFile: FilePreview | null = url ? { url, name: fileName, type: contentType || 'application/octet-stream' } : null

  return (
    <div className="rounded-md border border-stone-200 bg-white/90 p-2 text-xs">
      <p className="mb-1 truncate font-medium text-stone-700" title={fileName}>{label}</p>
      {url ? (
        isImage ? (
          <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full cursor-pointer overflow-hidden rounded border border-stone-200 hover:border-amber-400">
            <img src={url} alt={fileName} className="h-28 w-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded border border-stone-200 bg-stone-50 px-2.5 py-2 text-left font-medium text-stone-800 hover:border-amber-400 hover:bg-amber-50"
          >
            <span className="truncate">{fileName}</span>
            <span className="shrink-0 text-[11px] text-amber-800 underline">Xem tệp</span>
          </button>
        )
      ) : failed ? (
        <p className="text-stone-500">Không tải được tệp. Vui lòng thử lại.</p>
      ) : (
        <p className="text-stone-500">Đang tải tệp…</p>
      )}
      {previewOpen && previewFile && (
        <FilePreviewDialog file={previewFile} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  )
}

function VerificationNotice({ verification, kind = 'recovery', historical = false }: {
  verification?: RecoveryVerification | null; kind?: 'recovery' | 'pickup'; historical?: boolean
}) {
  if (!verification) return null
  const message = historical ? verification.matched ? 'Đã xác minh danh tính khách tại thời điểm thu hồi.'
    : verification.used >= verification.limit
      ? `Xác minh danh tính không thành công sau ${verification.used}/${verification.limit} lượt khi thu hồi. Hàng được lưu tạm và cần xác minh lại khi nhận hàng.`
      : 'Chưa xác minh được khách tại thời điểm thu hồi. Cần xác minh danh tính khi nhận hàng lưu tạm.' : verification.message
  return <div role="status" className={`recovery-verification rounded-md border p-3 text-sm ${historical ? 'border-stone-200 bg-stone-50 text-stone-600' : verification.canReceiveItems
    ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
    <p className="mb-1 font-semibold">{kind === 'pickup' ? 'Xác minh danh tính người nhận hàng' : 'Xác minh khách khi thu hồi'}</p>
    <p>{message}</p>
    <p className="mt-1 text-xs">Đã dùng {verification.used}/{verification.limit} lượt{historical ? ' trong chặng thu hồi.' : ` · Còn ${verification.remaining} lượt.`}</p>
  </div>
}

export function RecoveryAction({ entry, action, onBack, onSaved }: {
  entry: Entry; action: Action; onBack: () => void; onSaved: (entry: Entry, keepOpen: boolean) => void
}) {
  const assigning = action === 'ASSIGN' || action === 'ASSIGN_PICKUP'
  const witness = action === 'START' && entry.needsWitness
  const verify = action === 'VERIFY' || action === 'VERIFY_PICKUP' || action === 'RECORD_PRESENT'
  const pickDate = action === 'FOLLOW_UP_PICKUP' || action === 'SCHEDULE_PICKUP'
  const [staff, setStaff] = useState<Staff[]>([])
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const attempt = useRef<string | null>(null)
  const [error, setError] = useState('')
  const [goodsNames, setGoodsNames] = useState<string[]>([])
  const [goodsLoading, setGoodsLoading] = useState(action === 'SAVE_ITEM')
  const [goodsError, setGoodsError] = useState('')
  const bulkAction = action === 'RELEASE_ITEM' || action === 'RECORD_LIQUIDATION'
  const itemChoices = pendingRecoveryChoices(entry.items)
  const [selectedGroup, setSelectedGroup] = useState(() => (bulkAction && itemChoices.length === 1 ? itemChoices[0].key : ''))
  const [quantity, setQuantity] = useState('1')
  const [appointmentInput, setAppointmentInput] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const selectedChoice = itemChoices.find(choice => choice.key === selectedGroup)
  useEffect(() => {
    if (!bulkAction) return
    if (itemChoices.length === 1) {
      setSelectedGroup(itemChoices[0].key)
    } else if (selectedGroup && !itemChoices.some(choice => choice.key === selectedGroup)) {
      setSelectedGroup('')
    }
  }, [bulkAction, entry.items])
  useEffect(() => {
    if (action !== 'SAVE_ITEM') return
    let active = true
    setGoodsLoading(true)
    setGoodsNames([])
    setGoodsError('')
    apiRequest<Envelope<Preparation>>(`${endpoint}/${entry.id}/preparation`)
      .then(({ data }) => {
        if (!active) return
        const originalGoods = data.inventory.goods.length ? data.inventory.goods : data.declared
        setGoodsNames([...new Set(originalGoods.map(item => item.name.trim()).filter(name => name.length > 0 && name.length <= 240))])
      })
      .catch(() => { if (active) setGoodsError('Không tải được hàng nhập kho. Vui lòng mở lại thao tác để thử lại.') })
      .finally(() => { if (active) setGoodsLoading(false) })
    return () => { active = false }
  }, [action, entry.id])
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!entry.verifiedAt && action !== 'SCHEDULE_PICKUP') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [entry.verifiedAt, action])
  const canHandOver = canHandOverRecovery(entry, now)
  const pickupBounds = recoveryPickupBounds(entry.pickupDueAt, now)
  const pickupError = action === 'SCHEDULE_PICKUP' && (appointmentInput || !pickupBounds.available)
    ? recoveryPickupError(appointmentInput, entry.pickupDueAt, now) : null
  useEffect(() => {
    if (!assigning && !witness) return
    let active = true
    apiRequest<Envelope<Staff[]>>(`${endpoint}/${entry.id}/staff?pickup=${action === 'ASSIGN_PICKUP'}&witness=${witness}`)
      .then(response => { if (active) setStaff(response.data) })
      .catch(err => { if (active) setError(userFacingError(err, 'Không thể tải danh sách nhân viên.')) })
    return () => { active = false }
  }, [assigning, witness, entry.id, action])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (lock.current) return
    if (!visibleRecoveryActions(entry.actions, entry.stage, entry.responseDueAt, undefined, entry.reply).includes(action)) {
      setError('Thao tác không còn khả dụng hoặc đã hết hạn phản hồi. Vui lòng làm mới hồ sơ.')
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
    if (action === 'SCHEDULE_PICKUP') {
      const reason = recoveryPickupError(local || '', entry.pickupDueAt)
      if (reason) { setError(reason); return }
    }
    const count = Number(quantity)
    if ((action === 'SAVE_ITEM' || bulkAction) && (!Number.isInteger(count) || count < 1 || count > 1000)) {
      setError('Vui lòng nhập số kiện từ 1 đến 1.000.')
      return
    }
    if (bulkAction && (!selectedChoice || count > selectedChoice.items.length)) {
      setError('Số kiện cần xử lý vượt quá số đang lưu tạm trong nhóm đã chọn.')
      return
    }
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
      let attachmentIds: string[] | undefined
      if (supportsAttachments.has(action) && attachments.length > 0) {
        if (attachments.length > 10) throw new Error('Tối đa 10 tệp đính kèm mỗi lần gửi.')
        attachmentIds = []
        for (const fileItem of attachments) {
          attachmentIds.push(await uploadRecoveryAttachment(entry.id, fileItem))
        }
      }
      if (verify || action === 'SAVE_ITEM') attempt.current ??= crypto.randomUUID()
      const response = await apiRequest<Envelope<Entry>>(`${endpoint}/${entry.id}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          action, evidenceId, appointmentAt, staffId: value('staff'), witnessId: value('witness'),
          attemptId: verify || action === 'SAVE_ITEM' ? attempt.current : undefined, document: value('document'), note: value('note'),
          itemCode: value('itemCode'), itemName: value('itemName'), condition: value('condition'),
          location: value('location'), disposition: value('disposition'),
          quantity: action === 'SAVE_ITEM' ? count : undefined,
          itemCodes: bulkAction ? selectedChoice!.items.slice(0, count).map(item => item.code) : undefined,
          attachmentIds,
        }),
      })
      setAttachments([])
      if (verify) {
        attempt.current = null
        const document = form.elements.namedItem('document')
        if (document instanceof HTMLInputElement) document.value = ''
      }
      onSaved(response.data, verify && response.data.actions.includes(action))
    } catch (err) {
      setError(userFacingError(err, 'Không thể ghi nhận thao tác.'))
    } finally {
      setBusy(false)
      lock.current = false
    }
  }

  return <form className="recovery-action-form space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3" onSubmit={submit}
    onChange={() => { if (action === 'SAVE_ITEM') attempt.current = null }}>
    <h4 className="text-sm font-semibold">{entryActionLabel(entry, action)}</h4>
    {verify && <VerificationNotice kind={action === 'VERIFY_PICKUP' ? 'pickup' : 'recovery'} verification={action === 'VERIFY_PICKUP' ? entry.pickupVerification : entry.verification} />}
    {action === 'START' && !canHandOver && <p className="text-sm text-amber-800">Chưa xác minh được người nhận. Cần nhân chứng để thu hồi và đưa hàng vào khu lưu tạm; chưa được giao hàng cho khách.</p>}
    {action === 'SAVE_ITEM' && !canHandOver && <p className="text-sm text-amber-800">Chưa có xác minh người nhận còn hiệu lực. Chỉ được ghi nhận lưu tạm.</p>}
    {action === 'ASSIGN' && <p className="text-xs text-stone-600">Thời gian phụ trách: {dateLabel(entry.scheduledAt)} đến {dateLabel(entry.deadlineAt)}. Nhân viên được giải phóng lịch khi hoàn tất thu hồi.</p>}
    {action === 'SCHEDULE_PICKUP' && <div className="recovery-pickup-window">
      <p>Hạn cuối nhận hàng lưu tạm: <strong>{dateLabel(entry.pickupDueAt)}</strong></p>
      <p>Chỉ chọn từ {dateLabel(pickupBounds.min)} đến {dateLabel(pickupBounds.max)} (giờ Việt Nam).</p>
      <p>Khi đến nhận hàng, vui lòng mang giấy tờ tùy thân bản gốc để xác minh danh tính.</p>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      {(assigning || witness) && <label>{assigning ? 'Nhân viên phụ trách' : 'Nhân chứng'}
        <select name={assigning ? 'staff' : 'witness'} className={field} required={assigning || action === 'START'}>
          <option value="">Chọn nhân viên</option>
          {staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select><span className="text-xs text-stone-500">Chỉ hiển thị nhân viên đủ quyền tại cơ sở và không trùng lịch xử lý đơn khác.</span>
        {!staff.length && <span role="status" className="text-xs text-amber-700">Chưa có nhân viên phù hợp với thời gian này.</span>}</label>}
      {pickDate && <label>{action === 'SCHEDULE_PICKUP' ? 'Ngày giờ nhận hàng (giờ Việt Nam)' : 'Lịch hẹn rà soát (giờ Việt Nam)'}
        <input type="datetime-local" name="appointment" className={field} value={appointmentInput}
          onChange={event => { setAppointmentInput(event.target.value); setError('') }}
          min={action === 'SCHEDULE_PICKUP' ? pickupBounds.min : undefined}
          max={action === 'SCHEDULE_PICKUP' ? pickupBounds.max : undefined}
          required={action === 'FOLLOW_UP_PICKUP' || action === 'SCHEDULE_PICKUP'} />
        {pickupError && <span role="alert" className="mt-1 block text-red-700">{pickupError}</span>}</label>}
      {verify && <label>{action === 'RECORD_PRESENT' ? 'Số CCCD' : 'Số giấy tờ gốc'}
        <input type="password" name="document" className={field} maxLength={32} autoComplete="off" required
          onChange={() => { attempt.current = null }} /></label>}
      {needsPhoto.has(action) && <label>{action === 'RECORD_LIQUIDATION' ? 'Ảnh biên bản hoặc bằng chứng thanh lý' : 'Ảnh hiện trường'}<input type="file" name="photo" accept="image/*" className={field} required /></label>}
      {action === 'CLOSE_REMEDIATION' && <label>Kết quả khắc phục<select className={field} name="disposition" required>
        <option value="">Chọn kết quả</option><option value="RESTORED">Đủ điều kiện khôi phục gian cho khách</option>
        <option value="ALREADY_RESOLVED">Hồ sơ thuê và gian đã được xử lý riêng</option>
      </select></label>}
      {action === 'SAVE_ITEM' && <>
        <label>Loại hàng<select className={field} name="itemName" disabled={goodsLoading || !goodsNames.length} required>
          <option value="">{goodsLoading ? 'Đang tải hàng nhập kho…' : goodsNames.length ? 'Chọn loại hàng' : 'Chưa có loại hàng để chọn'}</option>
          {goodsNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
          {goodsError ? <span role="alert" className="text-xs text-red-700">{goodsError}</span>
            : !goodsLoading && !goodsNames.length ? <span className="text-xs text-stone-600">Hồ sơ chưa có hàng nhập kho hoặc hàng khai báo.</span>
              : <span className="text-xs text-stone-500">Các kiện cùng loại sẽ được cộng chung số lượng.</span>}</label>
        <label>Tình trạng<input className={field} name="condition" maxLength={240} required /></label>
        <label>Phương thức<select name="disposition" className={field} required>
          <option value="STORED">Lưu tạm</option>{canHandOver && <option value="HANDED_OVER">Bàn giao cho khách</option>}
        </select></label>
      </>}
      {bulkAction && <div className="sm:col-span-2 space-y-2 rounded-md border border-stone-200 bg-white p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-stone-700">
            {action === 'RECORD_LIQUIDATION' ? 'Hàng đang lưu tạm chờ thanh lý' : 'Hàng đang lưu tạm chờ bàn giao'} ({itemChoices.reduce((sum, choice) => sum + choice.items.length, 0)} kiện)
          </span>
          {itemChoices.length > 1 && <span className="text-xs text-stone-500">Chọn nhóm hàng bên dưới</span>}
        </div>
        {!itemChoices.length ? <p className="text-xs text-stone-500">Không còn kiện hàng nào đang lưu tạm.</p> : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {itemChoices.map(choice => {
              const active = selectedGroup === choice.key
              return <button key={choice.key} type="button" onClick={() => { setSelectedGroup(choice.key); setQuantity('1') }}
                className={`flex flex-col gap-0.5 rounded-md border p-2 text-left text-xs transition ${active
                  ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-500'
                  : 'border-stone-200 bg-stone-50 hover:border-stone-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-900">{choice.name}</span>
                  <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[11px] font-medium text-white">{choice.items.length} kiện</span>
                </div>
                <span className="text-stone-600">Tình trạng: {choice.condition}{choice.location ? ` · Vị trí: ${choice.location}` : ''}</span>
                <span className="text-[11px] text-stone-500">Mã kiện: {choice.items.slice(0, 4).map(item => item.code).join(', ')}{choice.items.length > 4 ? ` (+${choice.items.length - 4})` : ''}</span>
              </button>
            })}
          </div>
        )}
      </div>}
      {bulkAction && <label>{action === 'RECORD_LIQUIDATION' ? 'Nhóm hàng cần ghi nhận thanh lý' : 'Nhóm hàng chờ nhận'}<select name="itemGroup" className={field} required value={selectedGroup}
        onChange={event => { setSelectedGroup(event.target.value); setQuantity('1') }}>
        <option value="">Chọn nhóm hàng</option>{itemChoices.map(choice => <option key={choice.key} value={choice.key}>
          {choice.name} · {choice.condition}{choice.location ? ` · ${choice.location}` : ''} · {choice.items.length} kiện
        </option>)}
      </select></label>}
      {(action === 'SAVE_ITEM' || bulkAction) && <label>{action === 'SAVE_ITEM' ? 'Số kiện ghi nhận' : action === 'RELEASE_ITEM' ? 'Số kiện bàn giao lần này' : 'Số kiện đã thanh lý'}
        <input name="quantity" type="number" className={field} min={1} max={bulkAction ? selectedChoice?.items.length || 1000 : 1000} step={1} required value={quantity}
          onChange={event => setQuantity(event.target.value)} />
        {bulkAction && selectedChoice && <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
          <span>Đang chọn: <strong>{selectedChoice.name}</strong> · Còn <strong>{selectedChoice.items.length}</strong> kiện</span>
          {selectedChoice.items.length > 1 && Number(quantity) !== selectedChoice.items.length && (
            <button type="button" className="font-medium text-amber-800 underline hover:text-amber-950"
              onClick={() => setQuantity(String(selectedChoice.items.length))}>
              {action === 'RELEASE_ITEM' ? `Giao hết ${selectedChoice.items.length} kiện` : `Chọn hết ${selectedChoice.items.length} kiện`}
            </button>
          )}
        </span>}
      </label>}
      {(action === 'START' || action === 'SAVE_ITEM') && <label>Nơi lưu tạm hoặc người nhận
        <input className={field} name="location" maxLength={240} required /></label>}
      {action === 'COMPLETE' && <label className="flex items-center gap-2">
        <input type="checkbox" name="disposition" value="VACATED" required /> Tôi đã xác nhận gian kho trống
      </label>}
      {action === 'RECORD_LIQUIDATION' && <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="disposition" value="LIQUIDATED" required /> Tôi xác nhận kiện hàng đã được xử lý thanh lý theo biên bản
      </label>}
      {needsNote.has(action) && <label className="sm:col-span-2">{action === 'COMPLETE' ? 'Biên bản và kết quả xử lý khóa' : action === 'RECORD_LIQUIDATION' ? 'Căn cứ, biên bản và kết quả xử lý thanh lý' : action === 'RESUME' ? 'Nội dung phản hồi và kết luận cho khách hàng' : 'Ghi chú và căn cứ'}
        <textarea className={field} name="note" maxLength={4000} rows={3} required /></label>}
      {supportsAttachments.has(action) && (
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs font-medium text-stone-700">
            Tệp / hình ảnh đính kèm (tối đa 10 tệp: JPG, PNG, WebP, PDF)
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="mt-1 block w-full text-xs"
              disabled={busy}
              onChange={event => {
                const picked = Array.from(event.target.files || [])
                const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
                const allowedExt = /\.(jpe?g|png|webp|pdf)$/i
                const invalid = picked.find(item => !(allowedMime.has(item.type) || (!item.type && allowedExt.test(item.name))))
                if (invalid) {
                  setError(`Tệp "${invalid.name}" không đúng định dạng. Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc tệp PDF.`)
                  event.currentTarget.value = ''
                  return
                }
                const tooLarge = picked.find(item => item.size > 30 * 1024 * 1024)
                if (tooLarge) {
                  setError(`Tệp "${tooLarge.name}" vượt quá dung lượng tối đa 30 MB.`)
                  event.currentTarget.value = ''
                  return
                }
                setError('')
                if (picked.length > 0) {
                  setAttachments(prev => [...prev, ...picked].slice(0, 10))
                }
                event.currentTarget.value = ''
              }}
            />
          </label>
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((fileItem, idx) => (
                <li key={`${fileItem.name}-${idx}`} className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-700">
                  <span className="max-w-[200px] truncate">{fileItem.name}</span>
                  <button
                    type="button"
                    className="font-semibold text-red-700 hover:text-red-900"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onBack}>Quay lại</Button>
      <Button type="submit" size="sm" disabled={busy || action === 'SAVE_ITEM' && (goodsLoading || !goodsNames.length) || (assigning || witness) && !staff.length || action === 'SCHEDULE_PICKUP' && !!pickupError}>{busy ? 'Đang ghi…' : 'Xác nhận'}</Button>
    </div>
  </form>
}

type Preparation = {
  packaging?: string | null
  declared: { code: string | null; name: string; material: string | null; quantity: number
    lengthCm: number | null; widthCm: number | null; heightCm: number | null; weightKg: number | null
    fragile: boolean; description: string | null; note: string | null
    categoryName?: string | null; category?: string | null; stackable?: boolean; maxStackLayers?: number; allowHorizontalPlacement?: boolean
    images?: { id: string; name: string; contentType: string }[] }[]
  inventory: { available: boolean; recordedBy: string | null; publishedAt: string | null; packageCount: number | null
    mismatchSummary: string | null; decisionNote: string | null; notes: string | null; goodsCondition: string | null; unitCondition: string | null
    goods: { name: string; quantity: number; material?: string | null; condition?: string | null; note?: string | null }[]
    evidence: { id: string; name: string; contentType: string }[] }
}

export function RecoverySourceGoods({ data }: { data: Preparation }) {
  const inventory = data.inventory
  const grouped = new Map<string, Preparation['declared'][number] & { codes: string[]; images: NonNullable<Preparation['declared'][number]['images']> }>()
  for (const line of data.declared) {
    const { code, quantity, images = [], ...fields } = line
    const key = JSON.stringify(fields)
    const current = grouped.get(key)
    grouped.set(key, { ...line, quantity: (current?.quantity || 0) + quantity,
      codes: [...new Set([...(current?.codes || []), ...(code ? [code] : [])])],
      images: [...new Map([...(current?.images || []), ...images].map(file => [file.id, file])).values()] })
  }
  const declared = [...grouped.values()]
  const inspected = groupQuantityLines(inventory.goods, ({ quantity: _quantity, ...fields }) => fields)
  const number = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
  const yesNo = (value?: boolean) => value == null ? 'Chưa khai báo' : value ? 'Có' : 'Không'
  const volume = (item: Preparation['declared'][number]) => [item.lengthCm, item.widthCm, item.heightCm].every(value => value != null)
    ? item.lengthCm! * item.widthCm! * item.heightCm! / 1_000_000 : null
  const totalQuantity = data.declared.reduce((sum, item) => sum + item.quantity, 0)
  const totalWeight = data.declared.every(item => item.weightKg != null) ? data.declared.reduce((sum, item) => sum + item.quantity * item.weightKg!, 0) : null
  const totalVolume = data.declared.every(item => volume(item) != null) ? data.declared.reduce((sum, item) => sum + item.quantity * volume(item)!, 0) : null
  return <div className="recovery-source-goods">
    <h5>Hàng khách đã khai báo</h5>
    {!!data.declared.length && <>
      <dl className="recovery-source-totals">
        <div><dt>Tổng số lượng</dt><dd>{number(totalQuantity)} kiện</dd></div>
        <div><dt>Tổng khối lượng</dt><dd>{totalWeight == null ? 'Chưa khai báo' : `${number(totalWeight)} kg`}</dd></div>
        <div><dt>Tổng thể tích</dt><dd>{totalVolume == null ? 'Chưa khai báo' : `${number(totalVolume)} m³`}</dd></div>
      </dl>
      <p className="recovery-source-packaging"><strong>Phương thức đóng gói chung:</strong> {data.packaging || 'Chưa khai báo'}</p>
    </>}
    {!data.declared.length ? <p className="recovery-source-empty">Đơn chưa có danh sách hàng khai báo.</p> : <ul className="recovery-items-grid">
      {declared.map((item, index) => <li key={index} className="recovery-item-card">
        <div className="recovery-item-header"><h5>{item.name}</h5><span className="recovery-source-quantity">{number(item.quantity)} kiện</span></div>
        <dl className="recovery-item-facts recovery-declared-facts">
          <div><dt>Mã hàng</dt><dd>{item.codes.length ? `${item.codes.slice(0, 3).join(', ')}${item.codes.length > 3 ? ` và ${item.codes.length - 3} mã khác` : ''}` : 'Chưa ghi nhận'}</dd></div>
          <div><dt>Loại hàng</dt><dd>{item.categoryName || (item.category ? goodsCategoryLabel(item.category) : 'Chưa khai báo')}</dd></div>
          <div><dt>Chất liệu</dt><dd>{item.material || 'Chưa khai báo'}</dd></div>
          <div><dt>Kích thước mỗi kiện (dài × rộng × cao)</dt><dd>{[item.lengthCm, item.widthCm, item.heightCm].every(value => value != null)
            ? `${[item.lengthCm, item.widthCm, item.heightCm].map(value => number(value!)).join(' × ')} cm` : 'Chưa khai báo'}</dd></div>
          <div><dt>Khối lượng mỗi kiện</dt><dd>{item.weightKg == null ? 'Chưa khai báo' : `${number(item.weightKg)} kg`}</dd></div>
          <div><dt>Thể tích mỗi kiện</dt><dd>{volume(item) == null ? 'Chưa khai báo' : `${number(volume(item)!)} m³`}</dd></div>
          <div><dt>Hàng dễ vỡ</dt><dd>{yesNo(item.fragile)}</dd></div>
          <div><dt>Được phép xếp chồng</dt><dd>{yesNo(item.stackable)}</dd></div>
          {item.stackable && <div><dt>Số lớp xếp tối đa</dt><dd>{item.maxStackLayers ?? 'Chưa khai báo'}</dd></div>}
          <div><dt>Được phép đặt nằm ngang</dt><dd>{yesNo(item.allowHorizontalPlacement)}</dd></div>
          <div><dt>Mô tả hàng hóa</dt><dd>{item.description || 'Chưa khai báo'}</dd></div>
          <div><dt>Ghi chú của khách</dt><dd>{item.note || 'Chưa khai báo'}</dd></div>
        </dl>
        {item.images.length ? <RecoveryGroupEvidence items={item.images.map(file => ({ code: file.id, name: item.name,
          condition: '', location: null, disposition: 'DECLARED', releasedAt: null, evidenceId: file.id }))} />
          : <p className="recovery-source-no-image">Ảnh hàng khai báo: Chưa có ảnh.</p>}
      </li>)}
    </ul>}
    <h5>Kết quả kiểm kê đã ghi nhận</h5>
    {!inventory.available ? <p className="recovery-source-empty">Chưa có kết quả kiểm kê đã ghi nhận trên đơn.</p> : <div className="recovery-source-report">
      <dl className="recovery-source-report-facts">
        {inventory.recordedBy && <div><dt>Người ghi nhận</dt><dd>{inventory.recordedBy}</dd></div>}
        {inventory.publishedAt && <div><dt>Thời gian ghi nhận</dt><dd>{dateLabel(inventory.publishedAt)}</dd></div>}
        {inventory.packageCount != null && <div><dt>Số kiện đã kiểm kê</dt><dd>{number(inventory.packageCount)} kiện</dd></div>}
        {inventory.goodsCondition && <div><dt>Tình trạng hàng hóa</dt><dd>{inventory.goodsCondition}</dd></div>}
        {inventory.unitCondition && <div><dt>Hiện trạng gian kho</dt><dd>{inventory.unitCondition}</dd></div>}
        {inventory.mismatchSummary && <div className="recovery-source-wide"><dt>Chênh lệch đã ghi nhận</dt><dd>{inventory.mismatchSummary}</dd></div>}
        {inventory.decisionNote && <div className="recovery-source-wide"><dt>Kết luận kiểm kê</dt><dd>{inventory.decisionNote}</dd></div>}
        {inventory.notes && <div className="recovery-source-wide"><dt>Ghi chú kiểm kê</dt><dd>{inventory.notes}</dd></div>}
      </dl>
      {!!inventory.goods.length && <ul className="recovery-items-grid">
        {inspected.map((item, index) => <li key={index} className="recovery-item-card">
          <div className="recovery-item-header"><h5>{item.name}</h5><span className="recovery-source-quantity">{number(item.quantity)} kiện</span></div>
          {(item.material || item.condition || item.note) && <dl className="recovery-item-facts">
            {item.material && <div><dt>Chất liệu ghi nhận</dt><dd>{item.material}</dd></div>}
            {item.condition && <div><dt>Tình trạng ghi nhận</dt><dd>{item.condition}</dd></div>}
            {item.note && <div><dt>Ghi chú</dt><dd>{item.note}</dd></div>}
          </dl>}
        </li>)}
      </ul>}
      {inventory.evidence.some(file => file.contentType?.startsWith('image/')) && <div className="grid gap-2 sm:grid-cols-3">
        {inventory.evidence.filter(file => file.contentType?.startsWith('image/')).map(file => <EvidenceImagePreview key={file.id} id={file.id} label={file.name || 'Ảnh kiểm kê đã lưu'} />)}
      </div>}
    </div>}
  </div>
}

function RecoveryPreparation({ id }: { id: string }) {
  const [data, setData] = useState<Preparation>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setData(undefined)
    setError('')
    apiRequest<Envelope<Preparation>>(`${endpoint}/${encodeURIComponent(id)}/preparation`, { cache: 'no-store' })
      .then(response => { if (active) setData(response.data) })
      .catch(reason => { if (active) setError(userFacingError(reason, 'Không tải được hàng khai báo và kết quả kiểm kê.')) })
    return () => { active = false }
  }, [id])
  return <section className="recovery-source" aria-label="Hàng hóa trước thu hồi">
    <div className="recovery-items-heading"><h4>Hàng hóa trước thu hồi</h4></div>
    {error ? <p role="alert" className="recovery-error">{error}</p> : data ? <RecoverySourceGoods data={data} />
      : <p role="status" className="recovery-source-empty">Đang tải hàng khai báo và kết quả kiểm kê…</p>}
  </section>
}

function RecoveryGroupEvidence({ items }: { items: RecoveryItem[] }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const evidence = new Map<string, string>()
  for (const item of items) {
    if (item.evidenceId) evidence.set(item.evidenceId, 'Ảnh ghi nhận hàng hóa')
    if (item.releaseEvidenceId) evidence.set(item.releaseEvidenceId, 'Ảnh bàn giao hàng')
    if (item.liquidation?.evidenceId) evidence.set(item.liquidation.evidenceId, 'Bằng chứng thanh lý')
  }
  if (!evidence.size) return null
  const photos = [...evidence]
  const currentPage = Math.min(page, Math.max(0, Math.ceil(photos.length / 6) - 1))
  return <div className="recovery-group-evidence">
    <Button type="button" size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? 'Ẩn ảnh' : 'Xem ảnh'} ({photos.length})
    </Button>
    {open && <>
      <div className="grid gap-2 sm:grid-cols-3">{photos.slice(currentPage * 6, currentPage * 6 + 6).map(([id, label]) => <EvidenceImagePreview key={id} id={id} label={label} />)}</div>
      {photos.length > 6 && <div className="recovery-pagination">
        <Button type="button" size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Ảnh trước</Button>
        <span>{currentPage + 1}/{Math.ceil(photos.length / 6)}</span>
        <Button type="button" size="sm" variant="outline" disabled={(currentPage + 1) * 6 >= photos.length} onClick={() => setPage(currentPage + 1)}>Ảnh sau</Button>
      </div>}
    </>}
  </div>
}

export function RecoveryGroupedItems({ items }: { items: RecoveryItem[] }) {
  const groups = groupRecoveryItems(items)
  if (!groups.length) return null
  return <section className="recovery-items" aria-label="Kiện hàng">
    <div className="recovery-items-heading"><h4>Kiện hàng</h4><span>{items.length} kiện · {groups.length} loại hàng</span></div>
    <ul className="recovery-items-grid">
      {groups.map(group => {
        const counts = recoveryItemCounts(group.items)
        return <li key={group.key} className="recovery-item-card">
          <div className="recovery-item-header">
            <div><p>Loại hàng</p><h5>{group.name}</h5></div>
            <span className="recovery-item-quantity">{counts.total} kiện</span>
          </div>
          <dl className="recovery-group-counts">
            <div><dt>Đang lưu tạm</dt><dd>{counts.stored}</dd></div>
            <div><dt>Đã bàn giao</dt><dd>{counts.released}</dd></div>
            {counts.liquidated > 0 && <div><dt>Đã thanh lý</dt><dd>{counts.liquidated}</dd></div>}
          </dl>
          <div className="recovery-group-variants">{group.variants.map(variant => {
            const state = recoveryItemCounts(variant.items)
            return <dl key={variant.key} className="recovery-item-facts">
              <div><dt>Tình trạng</dt><dd>{variant.condition}</dd></div>
              {variant.location && <div><dt>{variant.disposition === 'HANDED_OVER' ? 'Người nhận' : 'Vị trí lưu tạm'}</dt><dd>{variant.location}</dd></div>}
              {group.variants.length > 1 && <div><dt>Số kiện tại vị trí này</dt><dd>{state.total} kiện · {state.stored} lưu tạm · {state.released} đã giao{state.liquidated ? ` · ${state.liquidated} đã thanh lý` : ''}</dd></div>}
              {[...new Set(variant.items.map(item => item.liquidation?.note).filter(Boolean))].map(note => <div key={note}><dt>Kết quả thanh lý</dt><dd>{displayRoleNames(note!)}</dd></div>)}
            </dl>
          })}</div>
          <RecoveryGroupEvidence items={group.items} />
        </li>
      })}
    </ul>
  </section>
}

export function RecoveryAttendance({ entry }: { entry: Entry }) {
  return <>
    {entry.attendance === 'ABSENT' && <div className="recovery-attendance-notice" role="status">
      <strong>Khách vắng mặt khi thu hồi</strong>
      <p>{entry.stage === 'COMPLETED' ? 'Hàng đã được đưa vào lưu tạm. Cần xác minh danh tính khi đến nhận lại hàng.'
        : 'Hàng thu hồi sẽ được đưa vào lưu tạm với nhân chứng; chưa bàn giao cho khách khi chưa xác minh danh tính.'}</p>
    </div>}
    {entry.verificationAttempts > 0 && <VerificationNotice verification={entry.verification}
      historical={entry.stage === 'COMPLETED' || entry.stage === 'CANCELLED'} />}
  </>
}

export function RecoveryDetails({ entry, actionArea, actionOpen = false }: { entry: Entry; actionArea?: ReactNode; actionOpen?: boolean }) {
  const finished = entry.stage === 'COMPLETED' || entry.stage === 'CANCELLED'
  const [phase, setPhase] = useState<1 | 2>(finished ? 2 : 1)
  useEffect(() => { setPhase(finished ? 2 : 1) }, [finished])
  const pending = entry.items.filter(isPendingItem).length
  const activePhase = finished ? 2 : 1
  return <div className="recovery-details">
    <div className="recovery-detail-heading">
      <span className={`recovery-status recovery-status--${entry.stage.toLowerCase()}`}>{stageLabel(entry)}</span>
      <p>{reasons[entry.reason] || 'Cần xử lý thu hồi kho'}</p>
    </div>
      <ol className="recovery-journey" aria-label="Tiến trình xử lý hồ sơ">
        <li><button type="button" aria-pressed={phase === 1} disabled={actionOpen} onClick={() => setPhase(1)}>
          <span className="recovery-journey-number">1</span><span><strong>Thu hồi kho</strong><small>{entry.stage === 'CANCELLED' ? 'Đã hủy' : finished ? 'Đã hoàn tất' : entry.stage === 'BLOCKED' ? 'Đang tạm dừng' : 'Đang xử lý'}</small></span>
        </button></li>
        <li><button type="button" aria-pressed={phase === 2} disabled={!finished || actionOpen} onClick={() => setPhase(2)}>
          <span className="recovery-journey-number">2</span><span><strong>Giao hàng lưu tạm</strong><small>{!finished ? 'Chờ thu hồi xong' : pending ? 'Đang xử lý' : 'Đã xử lý xong'}</small></span>
        </button></li>
      </ol>
      {pending > 0 && <section className="recovery-pickup-deadline" aria-label="Thời hạn nhận hàng lưu tạm">
        <h4>Hạn cuối nhận hàng lưu tạm</h4>
        <strong>{dateLabel(entry.pickupDueAt)}</strong>
        {entry.pickupDueAt ? <RecoveryCountdown deadline={entry.pickupDueAt} label="Nhận hàng" />
          : <p>Vui lòng liên hệ cơ sở để xác nhận thời hạn nhận hàng.</p>}
        <p>Vui lòng đặt lịch và đến nhận trước hạn. Khi nhận hàng, cần xác minh lại danh tính bằng giấy tờ bản gốc.</p>
      </section>}
      <h4 className="recovery-phase-title">{phase === 1 ? 'Chặng 1 · Thu hồi kho' : 'Chặng 2 · Giao hàng lưu tạm'}</h4>
      <dl className="recovery-detail-facts">
        <div><dt>Phụ trách</dt><dd className="font-medium">{responsiblePerson(entry)}</dd></div>
        <div><dt>Gian kho</dt><dd>{entry.unitCode}</dd></div>
        {phase === 1 && <>
        {entry.sourceDeadlineAt && <div><dt>Hạn thực hiện trước khi thu hồi</dt><dd>{dateLabel(entry.sourceDeadlineAt)}</dd></div>}
        {(entry.requiredAt || entry.detectedAt) && <div><dt>Ngày mở hồ sơ</dt><dd>{dateLabel(entry.requiredAt || entry.detectedAt)}</dd></div>}
        <div><dt>Lịch thu hồi</dt><dd>{dateLabel(entry.scheduledAt)}</dd></div>
        {entry.deadlineAt && <div><dt>Hạn hoàn tất</dt><dd>{dateLabel(entry.deadlineAt)}</dd></div>}
        {entry.actionDueAt && <div><dt>Hạn xử lý tiếp theo</dt><dd>{dateLabel(entry.actionDueAt)}</dd></div>}
        {entry.responseDueAt && <div><dt>Hạn phản hồi</dt><dd>{dateLabel(entry.responseDueAt)}{entry.reply ? ` · ${replies[entry.reply]}` : ''}</dd></div>}
        {entry.arrivedAt && <div><dt>Giờ khách đến</dt><dd>{dateLabel(entry.arrivedAt)}</dd></div>}
        {entry.verifiedAt && <div><dt>Giờ xác minh</dt><dd>{dateLabel(entry.verifiedAt)}</dd></div>}
        {entry.completedAt && <div><dt>Hoàn tất thu hồi</dt><dd>{dateLabel(entry.completedAt)}</dd></div>}
        </>}
        {phase === 2 && <>
        {entry.pickupAppointmentAt && <div><dt>Lịch hẹn nhận hàng</dt><dd>{dateLabel(entry.pickupAppointmentAt)}</dd></div>}
        </>}
      </dl>
      {phase === 1 && <>
      {entry.canViewSourceGoods && <RecoveryPreparation id={entry.id} />}
      <RecoveryAttendance entry={entry} />
      {entry.reasonNote && <p className="whitespace-pre-wrap break-words">{displayRoleNames(entry.reasonNote)}</p>}
      {(entry.communications?.length ?? 0) > 0 ? (
        <section aria-label="Lịch sử trao đổi và phản hồi" className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="font-bold text-stone-900">Lịch sử trao đổi &amp; khiếu nại ({entry.communications!.length} lượt)</h5>
            {entry.reply && entry.reply !== 'NO_RESPONSE' && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${entry.reply === 'DISPUTED'
                ? 'bg-red-100 text-red-900 ring-red-300'
                : entry.reply === 'WILL_ATTEND'
                  ? 'bg-emerald-100 text-emerald-900 ring-emerald-300'
                  : 'bg-amber-100 text-amber-900 ring-amber-300'}`}>
                {replies[entry.reply] || entry.reply}
              </span>
            )}
          </div>
          <ol className="space-y-2.5">
            {entry.communications!.map((item, idx) => {
              const isCustomer = item.role === 'CUSTOMER'
              const isDispute = item.action === 'DISPUTE'
              const cardClass = isCustomer
                ? (isDispute ? 'border-red-300 bg-red-50 text-red-950' : 'border-emerald-300 bg-emerald-50 text-emerald-950')
                : 'border-blue-300 bg-blue-50 text-blue-950'
              const actionText = item.action in actionLabels
                ? actionLabels[item.action as Action]
                : (replies[item.action] || 'Phản hồi')
              return (
                <li key={`${item.time}-${idx}`} className={`rounded-lg border px-3.5 py-2.5 ${cardClass}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold">
                      {isCustomer ? 'Khách hàng' : item.role === 'BUSINESS' ? 'Chủ doanh nghiệp' : 'Quản lý cơ sở'}
                      {item.actorName ? ` · ${item.actorName}` : ''} · {actionText}
                    </span>
                    <span className="opacity-80">{dateLabel(item.time)}</span>
                  </div>
                  {item.note && (
                    <p className="mt-1 whitespace-pre-wrap break-words font-semibold">
                      {displayRoleNames(item.note)}
                    </p>
                  )}
                  {!!item.attachmentIds?.length && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {item.attachmentIds.map((fileId, fileIdx) => (
                        <EvidenceImagePreview key={fileId} id={fileId} label={`Tệp đính kèm ${fileIdx + 1}`} />
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ) : (
        <>
          {(entry.customerNote || (entry.reply && entry.reply !== 'NO_RESPONSE')) && (() => {
            const replyTone = entry.reply === 'DISPUTED'
              ? 'border-red-300 bg-red-50 text-red-950'
              : entry.reply === 'WILL_ATTEND'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : entry.reply === 'CANNOT_ATTEND'
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-stone-300 bg-stone-50 text-stone-900'
            const badgeTone = entry.reply === 'DISPUTED'
              ? 'bg-red-100 text-red-900 ring-red-300'
              : entry.reply === 'WILL_ATTEND'
                ? 'bg-emerald-100 text-emerald-900 ring-emerald-300'
                : entry.reply === 'CANNOT_ATTEND'
                  ? 'bg-amber-100 text-amber-900 ring-amber-300'
                  : 'bg-stone-200 text-stone-800 ring-stone-300'
            return (
              <section aria-label="Phản hồi của khách" className={`rounded-xl border-2 px-4 py-3 text-sm shadow-xs ${replyTone}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">Phản hồi của khách</span>
                  {entry.reply && entry.reply !== 'NO_RESPONSE' && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${badgeTone}`}>
                      {replies[entry.reply] || entry.reply}
                    </span>
                  )}
                </div>
                {entry.customerNote && (
                  <p className="mt-1.5 whitespace-pre-wrap break-words font-semibold">
                    {displayRoleNames(entry.customerNote)}
                  </p>
                )}
                {!!entry.customerAttachmentIds?.length && (
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                    {entry.customerAttachmentIds.map((fileId, idx) => (
                      <EvidenceImagePreview key={fileId} id={fileId} label={`Tệp đính kèm ${idx + 1}`} />
                    ))}
                  </div>
                )}
              </section>
            )
          })()}
          {(entry.managerResponseNote || !!entry.managerAttachmentIds?.length) && (
            <section aria-label="Phản hồi của Quản lý" className="rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-950 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">Phản hồi từ Quản lý / Cơ sở</span>
                {entry.managerRespondedAt && (
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-900 ring-1 ring-blue-300">
                    {dateLabel(entry.managerRespondedAt)}
                  </span>
                )}
              </div>
              {entry.managerResponseNote && (
                <p className="mt-1.5 whitespace-pre-wrap break-words font-semibold">
                  {displayRoleNames(entry.managerResponseNote)}
                </p>
              )}
              {!!entry.managerAttachmentIds?.length && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                  {entry.managerAttachmentIds.map((fileId, idx) => (
                    <EvidenceImagePreview key={fileId} id={fileId} label={`Tệp phản hồi ${idx + 1}`} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {entry.report && <p className="whitespace-pre-wrap break-words">Biên bản · {displayRoleNames(entry.report)}</p>}
      {entry.attendanceEvidenceId && <div className="space-y-2 border-t border-stone-200 pt-2">
        <p className="text-xs font-semibold text-stone-700">Ghi nhận khách đến hoặc vắng mặt</p>
        <div className="grid gap-2 sm:grid-cols-3"><EvidenceImagePreview id={entry.attendanceEvidenceId}
          label={entry.attendance === 'ABSENT' ? 'Ảnh ghi nhận khách vắng mặt' : 'Ảnh ghi nhận khách đến'} /></div>
      </div>}
      {(entry.beforeEvidenceId || entry.afterEvidenceId) && (
        <div className="space-y-2 border-t border-stone-200 pt-2">
          <p className="text-xs font-semibold text-stone-700">Bằng chứng thu hồi</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {entry.beforeEvidenceId && <EvidenceImagePreview id={entry.beforeEvidenceId} label="Ảnh trước thu hồi" />}
            {entry.afterEvidenceId && <EvidenceImagePreview id={entry.afterEvidenceId} label="Ảnh sau thu hồi" />}
          </div>
        </div>
      )}
      </>}
      {phase === 2 && <>
        {pending > 0 && <VerificationNotice kind="pickup" verification={entry.pickupVerification} />}
        {pending === 0 && <p className="recovery-source-empty">Không còn kiện hàng lưu tạm chờ bàn giao.</p>}
        {entry.financePending && <p>Đang chờ đối soát cọc hoặc công nợ.</p>}
      </>}
      <RecoveryGroupedItems items={entry.items} />
      {phase === activePhase && actionArea}
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

export function RecoveryPagination({ pagination, disabled, onChange }: {
  pagination: RecoveryPageInfo; disabled: boolean; onChange: (page: number) => void
}) {
  const { page, pageSize, totalItems, totalPages } = pagination
  if (!totalItems) return null
  const pages = [...new Set([0, page - 1, page, page + 1, totalPages - 1])]
    .filter(value => value >= 0 && value < totalPages).sort((a, b) => a - b)
  return <nav className="recovery-customer-pagination" aria-label="Phân trang hồ sơ thu hồi">
    <span>Hiển thị {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalItems)} trong {totalItems} hồ sơ · Trang {page + 1}/{totalPages}</span>
    <div>
      <Button size="sm" variant="outline" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}>Trước</Button>
      {pages.map((value, index) => <Fragment key={value}>
        {index > 0 && value > pages[index - 1] + 1 && <span>…</span>}
        <Button size="sm" variant={value === page ? 'primary' : 'outline'} aria-current={value === page ? 'page' : undefined}
          disabled={disabled} onClick={() => onChange(value)}>{value + 1}</Button>
      </Fragment>)}
      <Button size="sm" variant="outline" disabled={disabled || page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Sau</Button>
    </div>
  </nav>
}

export function ViolationRecoveryPanel({ sourceReturnId, activeOnly = false, managerOverdueOnly = false, customerView = false, compact = false, leadingCards, target, detailOnly = false, onDetailClosed, onRecordChanged }: {
  sourceReturnId?: string; activeOnly?: boolean; managerOverdueOnly?: boolean; customerView?: boolean; target?: { id: string; request: number }
  compact?: boolean; leadingCards?: ReactNode; detailOnly?: boolean; onDetailClosed?: () => void; onRecordChanged?: () => void
}) {
  const [page, setPage] = useState(0)
  const [entries, setEntries] = useState<Entry[]>([])
  const [pagination, setPagination] = useState<RecoveryPageInfo>()
  const [action, setAction] = useState<{ id: string; action: Action }>()
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [targetId, setTargetId] = useState(target?.id)
  const [showClosed, setShowClosed] = useState(false)
  const [detailId, setDetailId] = useState<string>()
  const targetCard = useRef<HTMLElement>(null)
  const revealedTarget = useRef<typeof target>(undefined)
  const requestUrl = useRef<string | undefined>(undefined)
  const listTop = useRef<HTMLDivElement>(null)
  const customerPaging = customerView && !sourceReturnId && !managerOverdueOnly
  useEffect(() => {
    if (action) return
    const refreshVisibleList = () => {
      if (document.visibilityState !== 'hidden') setRefresh(value => value + 1)
    }
    const timer = window.setInterval(refreshVisibleList, 15000)
    window.addEventListener('focus', refreshVisibleList)
    document.addEventListener('visibilitychange', refreshVisibleList)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshVisibleList)
      document.removeEventListener('visibilitychange', refreshVisibleList)
    }
  }, [action])
  useEffect(() => {
    setTargetId(target?.id)
    setPage(0)
    setAction(undefined)
    setDetailId(detailOnly ? target?.id : undefined)
  }, [target, detailOnly])
  useEffect(() => {
    if (action) return
    let active = true
    const query = managerOverdueOnly ? `page=${page}&escalatedOnly=true`
      : sourceReturnId ? `sourceReturnId=${encodeURIComponent(sourceReturnId)}` : `page=${page}&activeOnly=${activeOnly && !showClosed}`
    const url = targetId ? `${endpoint}/${encodeURIComponent(targetId)}`
      : customerPaging ? `${endpoint}/customer?page=${page}&pageSize=${CUSTOMER_PAGE_SIZE}` : `${endpoint}?${query}`
    if (requestUrl.current !== url) {
      requestUrl.current = url
      setLoading(true)
      setEntries([])
      setError('')
    }
    const load = targetId
      ? apiRequest<Envelope<Entry>>(url, { cache: 'no-store' }).then(response => ({ data: [response.data], pagination: undefined }))
      : apiRequest<Envelope<Entry[]>>(url, { cache: 'no-store' })
    load.then(response => {
      if (active) {
        if (customerPaging && !targetId && response.pagination) {
          const lastPage = Math.max(0, response.pagination.totalPages - 1)
          if (page > lastPage) { setPage(lastPage); return }
        }
        const rows = response.data
        setEntries(managerOverdueOnly ? rows.filter(isManagerOverdueRecovery) : rows)
        setPagination(response.pagination)
        setError('')
      }
    })
      .catch(err => { if (active) setError(userFacingError(err, 'Không thể tải hồ sơ thu hồi.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh, sourceReturnId, activeOnly, managerOverdueOnly, targetId, showClosed, action, customerPaging])

  useEffect(() => {
    if (detailOnly || !target || target.id !== targetId || loading || error || !targetCard.current
      || revealedTarget.current === target) return
    revealedTarget.current = target
    revealRecord(targetCard.current)
  }, [target, targetId, loading, error, entries, detailOnly])

  const detailEntry = entries.find(entry => entry.id === detailId)
  const openAction = (entry: Entry, key: Action) => {
    setDetailId(entry.id)
    setAction({ id: entry.id, action: key })
  }

  return <div className={compact ? 'recovery-panel recovery-compact-panel' : 'recovery-panel'} ref={listTop}>
    {detailOnly && !detailEntry && <div className="flex items-center justify-between gap-3 py-3">
      <p role={error ? 'alert' : 'status'}>{error || 'Đang tải hồ sơ thu hồi…'}</p>
      <Button variant="outline" onClick={onDetailClosed}>Đóng</Button>
    </div>}
    <div hidden={detailOnly}>
    {((activeOnly && !managerOverdueOnly) || targetId) && <div className="recovery-toolbar">
      <div className="recovery-view-switch">
        {activeOnly && !managerOverdueOnly && !targetId && <>
          <button type="button" aria-pressed={!showClosed} disabled={!!action} onClick={() => { setShowClosed(false); setPage(0) }}>Đang xử lý</button>
          <button type="button" aria-pressed={showClosed} disabled={!!action} onClick={() => { setShowClosed(true); setPage(0) }}>Tất cả hồ sơ</button>
        </>}
        {targetId && <Button size="sm" variant="outline" disabled={!!action} onClick={() => setTargetId(undefined)}>Về danh sách thu hồi</Button>}
      </div>
    </div>}
    {error && <p role="alert" className="recovery-error">{error}</p>}
    {loading && <p role="status" className="recovery-empty">Đang tải hồ sơ thu hồi…</p>}
    {!loading && !error && !entries.length && <p className="recovery-empty">{managerOverdueOnly
      ? targetId ? 'Hồ sơ này chưa quá hạn xử lý hoặc đã được xử lý tại cơ sở.' : 'Không có hồ sơ thu hồi quá hạn phân công hoặc rà soát.'
      : sourceReturnId ? 'Chưa có hồ sơ thu hồi cho yêu cầu trả kho này.' : 'Chưa có hồ sơ thu hồi trong danh sách.'}</p>}
    {(leadingCards || !loading && entries.length > 0) && <div className={managerOverdueOnly || compact || leadingCards ? 'recovery-card-grid' : undefined}>
    {leadingCards}
    {!loading && entries.map(entry => {
      const pendingItems = entry.items.filter(isPendingItem).length
      const closed = entry.stage === 'COMPLETED' || entry.stage === 'CANCELLED'
      const currentDueAt = entry.actionDueAt || entry.deadlineAt
      const replyActions = visibleRecoveryActions(entry.actions, entry.stage, entry.responseDueAt, undefined, entry.reply)
        .filter(key => key === 'WILL_ATTEND' || key === 'CANNOT_ATTEND' || key === 'DISPUTE')
      return <section key={entry.id} ref={entry.id === targetId ? targetCard : undefined} tabIndex={-1} className="recovery-case" aria-label={`Hồ sơ thu hồi ${entry.reservationCode || entry.unitCode}`}>
        <div className="recovery-case-header">
          <div>
            <h3>{entry.reservationCode || entry.unitCode}</h3>
            <p className="recovery-reason">{reasons[entry.reason] || 'Cần xử lý thu hồi kho'}</p>
          </div>
          <div className="recovery-status-group">
            <span className={`recovery-status recovery-status--${entry.stage.toLowerCase()}`}>{stageLabel(entry)}</span>
            {entry.overdueAt && !closed && <span className="recovery-overdue">Quá hạn xử lý</span>}
          </div>
        </div>
        <dl className="recovery-case-facts">
          <div><dt>Khách hàng</dt><dd>{entry.customerName || 'Chưa cập nhật'}</dd></div>
          <div><dt>Gian kho</dt><dd>{entry.unitCode}</dd></div>
          {!compact && <>
            <div><dt>Nhân viên phụ trách</dt><dd>{entry.staffName || 'Chưa phân công'}</dd></div>
            <div><dt>Phát sinh thu hồi</dt><dd>{dateLabel(entry.requiredAt || entry.detectedAt)}</dd></div>
            <div><dt>{entry.stage === 'COMPLETED' ? 'Hoàn tất thu hồi' : 'Lịch thu hồi'}</dt><dd>{dateLabel(entry.stage === 'COMPLETED' ? entry.completedAt : entry.scheduledAt)}</dd></div>
            {!closed && <div><dt>Hạn hoàn tất</dt><dd>{dateLabel(entry.deadlineAt)}</dd></div>}
          </>}
        </dl>
        {customerView && !closed && entry.reply && entry.reply !== 'NO_RESPONSE' && !replyActions.length && entry.responseDueAt && Date.now() < Date.parse(entry.responseDueAt) && <p role="status" className="recovery-item-notice">Đã gửi phản hồi. Vui lòng chờ quản lý duyệt trước khi gửi phản hồi tiếp theo.</p>}
        {!!replyActions.length && !closed && <p className="recovery-item-notice">Vui lòng phản hồi trong 6 giờ từ khi nhận thông báo. {entry.reply ? `Phản hồi: ${replies[entry.reply] || entry.reply}. ` : ''}<RecoveryCountdown deadline={entry.responseDueAt} label="Phản hồi" /></p>}
        {!compact && !!entry.items.length && <ul className="recovery-goods-summary" aria-label="Hàng hóa đã thu hồi">
          {groupRecoveryItems(entry.items).map(group => <li key={group.key}><span>{group.name}</span><strong>{group.items.length} kiện</strong></li>)}
        </ul>}
        {!compact && pendingItems > 0 && <p className="recovery-item-notice">{pendingItems} kiện hàng đang lưu tạm{entry.pickupDueAt ? ` · Hạn nhận hàng: ${dateLabel(entry.pickupDueAt)}` : ''}</p>}
        {entry.financePending && <p className="recovery-item-notice">Đang chờ đối soát cọc hoặc công nợ.</p>}
        <div className="recovery-case-footer">
          <p className="recovery-next-step">
            {entry.stage === 'AWAITING_ASSIGNMENT' ? 'Cần phân công nhân viên' :
              entry.stage === 'AWAITING_ACCEPTANCE' || entry.stage === 'AWAITING_ATTENDANCE' ? 'Thực hiện thu hồi theo lịch đã thông báo' :
              entry.stage === 'BLOCKED' ? 'Đang tạm dừng, chờ quản lý xử lý' : ''}
            {!closed && currentDueAt && <span>{deadlineLabels[entry.stage] || 'Hạn hoàn tất'}: {dateLabel(currentDueAt)}</span>}
            {!closed && currentDueAt && <RecoveryCountdown deadline={currentDueAt} label="Xử lý" />}
            {compact && pendingItems > 0 && <>
              <strong className="recovery-pending-count">{pendingItems} kiện đang lưu tạm</strong>
              {entry.pickupDueAt && <span>Hạn nhận hàng: {dateLabel(entry.pickupDueAt)}</span>}
            </>}
          </p>
          <div className="recovery-case-actions">
            <Button size="sm" variant="outline" disabled={!!action} onClick={() => setDetailId(entry.id)}>Chi tiết</Button>
          </div>
        </div>
      </section>
    })}
    </div>}
    {customerPaging && !targetId && pagination && <RecoveryPagination pagination={pagination} disabled={loading || !!action}
      onChange={next => { setDetailId(undefined); setPage(next); listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />}
    {!customerPaging && !sourceReturnId && !targetId && (page > 0 || entries.length === 30) && <div className="recovery-pagination">
      <Button size="sm" variant="outline" disabled={loading || !!action || page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</Button>
      <Button size="sm" variant="outline" disabled={loading || !!action || entries.length < 30} onClick={() => setPage(value => value + 1)}>Trang sau</Button>
    </div>}
    </div>
    {detailEntry && <Modal open size="2xl" title={`Hồ sơ thu hồi · ${detailEntry.reservationCode || detailEntry.unitCode}`}
      closeLabel="Đóng chi tiết thu hồi" onClose={() => { setDetailId(undefined); setAction(undefined); onDetailClosed?.() }}>
      <div className="recovery-detail-modal">
        {error && <p role="alert" className="recovery-error">{error}</p>}
        <RecoveryDetails key={detailEntry.id} entry={detailEntry} actionOpen={action?.id === detailEntry.id} actionArea={action && action.id === detailEntry.id ? <RecoveryAction key={action.action} entry={detailEntry} action={action.action}
          onBack={() => setAction(undefined)} onSaved={(updated, keepOpen) => {
            setEntries(current => {
              const next = current.map(item => item.id === updated.id ? updated : item)
              return managerOverdueOnly ? next.filter(isManagerOverdueRecovery) : next
            })
            if (!keepOpen) setAction(undefined)
            onRecordChanged?.()
          }} /> : !!detailEntry.actions.length && <div className="recovery-detail-actions">
            <h4>Thao tác với hồ sơ</h4>
            <div>{visibleRecoveryActions(detailEntry.actions, detailEntry.stage, detailEntry.responseDueAt, undefined, detailEntry.reply).map(key => <Button key={key} size="sm" variant={key === primaryAction(detailEntry) ? 'primary' : 'outline'}
              onClick={() => openAction(detailEntry, key)}>{entryActionLabel(detailEntry, key)}</Button>)}</div>
          </div>} />
      </div>
    </Modal>}
  </div>
}
