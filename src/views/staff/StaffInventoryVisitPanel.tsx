import { useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { normalizeRentalIdentity, validateRentalIdentity } from '../../domain/rentalIdentity'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { recordInventoryArrival, uploadCheckInEvidence, verifyInventoryIdentity, type CheckInCase } from '../../services/checkInApi'

export default function StaffInventoryVisitPanel({ item, now, busy, onBusyChange, onSaved, onPreview }: {
  item: CheckInCase
  now: number
  busy: boolean
  onBusyChange: (value: boolean) => void
  onSaved: (updated: CheckInCase) => void
  onPreview: (photoId: string) => void
}) {
  const [document, setDocument] = useState('')
  const [file, setFile] = useState<File>()
  const [photoId, setPhotoId] = useState<string>()
  const [present, setPresent] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const visit = item.inventoryVisit
  const expired = Boolean(item.inventoryFinalDeadlineAt && Date.parse(item.inventoryFinalDeadlineAt) <= now)
  const open = item.checkInStatus === 'setup_completed'
    && (item.inventoryResolutionStatus == null || item.inventoryResolutionStatus === 'NOT_STARTED')
  const format = (value: string) => formatCustomerDateTime(new Date(value))

  async function run(action: () => Promise<CheckInCase>) {
    if (busy || locked.current) return
    locked.current = true
    onBusyChange(true)
    setError('')
    try {
      onSaved(await action())
    } catch (error) {
      setError(userFacingError(error, 'Không lưu được thông tin buổi kiểm kê.'))
    } finally {
      locked.current = false
      onBusyChange(false)
    }
  }

  async function verify() {
    const identity = normalizeRentalIdentity(document)
    const result = validateRentalIdentity(identity)
    if (!result.ok) {
      setError(result.error || 'Nhập số CCCD hoặc hộ chiếu hợp lệ.')
      return
    }
    const checkInId = item.checkInId
    if (!checkInId || !present || (!file && !photoId)) return
    await run(async () => {
      let uploadedPhotoId = photoId
      if (!uploadedPhotoId && file) {
        const photo = await uploadCheckInEvidence(checkInId, file, 'CHECK_IN_IDENTITY')
        uploadedPhotoId = photo.id
        setPhotoId(uploadedPhotoId)
      }
      if (!uploadedPhotoId) throw new Error('Cần ảnh khách tại buổi kiểm kê.')
      return verifyInventoryIdentity(checkInId, { identityDocumentNumber: identity, photoId: uploadedPhotoId, bookingCustomerPresent: present })
    })
  }

  return <section className="space-y-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
    <p className="font-semibold">Lịch hẹn và xác minh khách kiểm kê</p>
    {item.setupCompletedAt && <p>Khách báo setup xong lúc {format(item.setupCompletedAt)}</p>}
    <p>Giờ hẹn <b>{visit?.appointmentAt ? format(visit.appointmentAt) : 'Chưa đặt lịch'}</b></p>
    {item.inventoryDueAt && <p>Mốc nhắc {format(item.inventoryDueAt)}</p>}
    {item.inventoryFinalDeadlineAt && <p>Hạn kiểm kê <b>{format(item.inventoryFinalDeadlineAt)}</b></p>}
    {visit?.arrivedAt && <p>Giờ khách đến thực tế <b>{format(visit.arrivedAt)}</b></p>}
    {visit?.identityVerifiedAt ? <div className="flex flex-wrap items-center gap-2">
      <span>Đã xác minh lúc {format(visit.identityVerifiedAt)}{visit.verifiedByName ? ` bởi ${visit.verifiedByName}` : ''}.</span>
      {visit.photoId && <Button type="button" size="sm" variant="outline" onClick={() => onPreview(visit.photoId!)}>Xem ảnh xác minh</Button>}
    </div> : open && (expired ? <p className="font-semibold text-red-800">Đã quá hạn kiểm kê. Hồ sơ cần Manager xử lý.</p>
      : !visit?.appointmentAt ? <p>Đang chờ khách chọn lịch kiểm kê.</p>
      : !visit.arrivedAt ? <Button type="button" size="sm" disabled={busy || !item.checkInId}
        onClick={() => { if (item.checkInId) void run(() => recordInventoryArrival(item.checkInId!)) }}>Ghi nhận khách đã đến</Button>
      : <div className="space-y-2">
        <label className="grid gap-1">Số CCCD hoặc hộ chiếu trên giấy tờ gốc
          <input className="rounded-md border border-violet-300 bg-white p-2" autoComplete="off" maxLength={30}
            value={document} disabled={busy} onChange={event => setDocument(event.target.value)} />
        </label>
        <label className="grid gap-1">Ảnh khách tại buổi kiểm kê
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy}
            onChange={event => { setFile(event.target.files?.[0]); setPhotoId(undefined) }} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={present} disabled={busy} onChange={event => setPresent(event.target.checked)} />
          Đã đối chiếu giấy tờ gốc và xác nhận người đặt kho trực tiếp có mặt.
        </label>
        <Button type="button" size="sm" disabled={busy || !document.trim() || !present || (!file && !photoId)}
          onClick={() => void verify()}>{busy ? 'Đang lưu…' : 'Xác minh người đặt kho'}</Button>
      </div>)}
    {error && <p className="text-red-800" role="alert">{error}</p>}
  </section>
}
