import { useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { normalizeRentalIdentity, validateRentalIdentity } from '../../domain/rentalIdentity'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { inventoryInspectionBlockReason } from '../../domain/inventoryAccess'
import { recordInventoryArrival, uploadCheckInEvidence, verifyInventoryIdentity, type CheckInCase } from '../../services/checkInApi'

export default function StaffInventoryVisitPanel({ item, now, busy, onBusyChange, onSaved, onPreview }: {
  item: CheckInCase
  now: number
  busy: boolean
  onBusyChange: (value: boolean) => void
  onSaved: (updated: CheckInCase) => void
  onPreview: (photoId: string) => void
}) {
  const declaredIdentityDocument = item.identityDocumentNumber?.trim() || ''
  const [document, setDocument] = useState(declaredIdentityDocument)
  const [file, setFile] = useState<File>()
  const [photoId, setPhotoId] = useState<string>()
  const [present, setPresent] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const visit = item.inventoryVisit
  const blockedReason = inventoryInspectionBlockReason(item, now)
  const expired = Boolean(blockedReason)
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

  /**
   * Confirming arrival is its own step: it starts the 72h completion clock, and only then
   * does the identity confirmation form appear.
   */
  async function confirmArrival() {
    const checkInId = item.checkInId
    if (!checkInId || !open || expired || !visit?.appointmentAt) return
    await run(() => recordInventoryArrival(checkInId))
  }

  async function verify() {
    const identity = normalizeRentalIdentity(document)
    const result = validateRentalIdentity(identity)
    if (!result.ok) {
      setError(result.error || 'Nhập số CCCD hoặc hộ chiếu hợp lệ.')
      return
    }
    const checkInId = item.checkInId
    if (!checkInId || !open || expired || !visit?.appointmentAt || !visit.arrivedAt || !present || (!file && !photoId)) return
    await run(async () => {
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
      {expired && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-semibold text-red-800">
            {blockedReason}
          </p>
        </div>
      )}
      {!visit?.appointmentAt && !expired && <p role="status">Đang chờ khách chọn lịch kiểm kê.</p>}

      {!expired && !visit?.arrivedAt && visit?.appointmentAt && <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <p className="font-semibold">Xác nhận khách đã đến kiểm kê</p>
        <p className="text-xs">Khi xác nhận, thời hạn 72 giờ hoàn tất kiểm kê bắt đầu tính từ thời điểm này. Sau đó hệ thống mở phần xác nhận thông tin.</p>
        <Button type="button" size="sm" disabled={busy || !item.checkInId}
          onClick={() => void confirmArrival()}>{busy ? 'Đang lưu…' : 'Xác nhận khách đến kiểm kê'}</Button>
      </div>}
      {visit?.arrivedAt && <>
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 font-medium text-emerald-900">
          Đã xác nhận khách đến lúc {format(visit.arrivedAt)}. Hạn hoàn tất kiểm kê 72 giờ tính từ thời điểm này.
        </p>
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
        </div>
      </>}
      </div>}
    {error && <p className="text-red-800" role="alert">{error}</p>}
  </section>
}
