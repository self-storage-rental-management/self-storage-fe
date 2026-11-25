import { useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { normalizeRentalIdentity, validateRentalIdentity } from '../../domain/rentalIdentity'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { recordInventoryArrival, uploadCheckInEvidence, verifyInventoryIdentity, type CheckInCase } from '../../services/checkInApi'

export default function StaffInventoryVisitPanel({ item, now, busy, onBusyChange, onSaved, onPreview, noShowDisabled, onNoShow }: {
  item: CheckInCase
  now: number
  busy: boolean
  onBusyChange: (value: boolean) => void
  onSaved: (updated: CheckInCase) => void
  onPreview: (photoId: string) => void
  noShowDisabled?: boolean
  onNoShow?: () => void
}) {
  const declaredIdentityDocument = item.identityDocumentNumber?.trim() || ''
  const [document, setDocument] = useState(declaredIdentityDocument)
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
    if (!checkInId || !open || expired || !visit?.appointmentAt || !present || (!file && !photoId)) return
    await run(async () => {
      if (!visit?.arrivedAt) {
        const arrived = await recordInventoryArrival(checkInId)
        onSaved(arrived)
      }
      let uploadedPhotoId = photoId
      if (!uploadedPhotoId && file) {
        const photo = await uploadCheckInEvidence(checkInId, file, 'CHECK_IN_IDENTITY', 'anh-doi-chieu-khach-luc-kiem-ke', item.reservationCode)
        uploadedPhotoId = photo.id
        setPhotoId(uploadedPhotoId)
      }
      if (!uploadedPhotoId) throw new Error('Cần ảnh khách tại buổi kiểm kê.')
      return verifyInventoryIdentity(checkInId, { identityDocumentNumber: identity, photoId: uploadedPhotoId, bookingCustomerPresent: present })
    })
  }

  return <section className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
    <h3 className="font-semibold text-stone-900">Kiểm tra khách đến kiểm kê</h3>
    {visit?.identityVerifiedAt ? <div className="flex flex-wrap items-center gap-2">
      <span>Đã xác minh lúc {format(visit.identityVerifiedAt)}{visit.verifiedByName ? ` bởi ${visit.verifiedByName}` : ''}.</span>
      {visit.photoId && <Button type="button" size="sm" variant="outline" onClick={() => onPreview(visit.photoId!)}>Xem ảnh xác minh</Button>}
    </div> : open && <div className="space-y-4">
      {expired && <p role="status" className="font-semibold text-red-800">Đã quá hạn kiểm kê. Hồ sơ cần quản lý cơ sở xử lý.</p>}
      {!visit?.appointmentAt && <p role="status">Đang chờ khách chọn lịch kiểm kê.</p>}
      <fieldset className="space-y-4" disabled={busy || expired || !visit?.appointmentAt}>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950">
          <span className="text-xs font-medium uppercase tracking-wide text-blue-700">CCCD hoặc hộ chiếu khách đã khai báo</span>
          <p className="mt-1 font-semibold">{declaredIdentityDocument || 'Chưa có dữ liệu'}</p>
          <p className="mt-1 text-xs text-blue-800">Đối chiếu số này với giấy tờ gốc khách xuất trình tại buổi kiểm kê.</p>
        </div>
        <label className="grid gap-1">Số CCCD hoặc hộ chiếu trên giấy tờ gốc
          <input className="rounded-md border border-stone-300 bg-white p-2" autoComplete="off" maxLength={30}
            value={document} disabled={busy} onChange={event => setDocument(event.target.value)} />
        </label>
        <label className="grid gap-1">Ảnh đối chiếu khách lúc kiểm kê
          <input className="block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:font-medium" type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy}
            onChange={event => { setFile(event.target.files?.[0]); setPhotoId(undefined) }} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={present} disabled={busy} onChange={event => setPresent(event.target.checked)} />
          Đã đối chiếu giấy tờ gốc và xác nhận người đặt kho trực tiếp có mặt.
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || expired || !visit?.appointmentAt || !item.checkInId || !document.trim() || !present || (!file && !photoId)}
          onClick={() => void verify()}>{busy ? 'Đang lưu…' : 'Xác minh người đặt kho'}</Button>
        {onNoShow && <Button type="button" size="sm" variant="danger" disabled={busy || noShowDisabled} title={noShowDisabled ? 'Chỉ có thể đánh dấu khách không đến khi hồ sơ đang chờ bàn giao.' : undefined} onClick={onNoShow}>Khách không đến</Button>}
      </div>
      </div>}
    {error && <p className="text-red-800" role="alert">{error}</p>}
  </section>
}
