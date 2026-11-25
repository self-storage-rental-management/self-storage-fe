import InventoryMismatchEvidence, { type InventoryInspectionReport } from '../staff/InventoryMismatchEvidence'
import InventoryDecisionSummary from '../../components/InventoryDecisionSummary'
import { displayStatusLabel } from '../../presentation/statusLabels'
import { invoiceNumberLabel } from '../customer/paymentLabels'
import { useManagerPresentation } from "../manager/managerPresentation"
import { useEffect, useState } from "react"
import RenewalRiskNotice from "./RenewalRiskNotice"
import RentalHandoverFiles from "./RentalHandoverFiles"
import { Badge, Button, Card, Modal } from "../../components/ui"
import BookingTransactionReceipt from "./BookingTransactionReceipt"
import type { RentalApiDetail, RentalApiRole } from "../../types/rentalApi"
import { bookingPaymentPurposes, bookingPaymentStatuses } from "../../services/rentalBookingEvidence"
import { rentalRecordLabel, rentalStatusLabel, rentalMoney, unknown, rentalDataWarning, rentalPeriodText, rentalDate, accessStatusLabels } from "./presentation"
import { downloadCheckInEvidence, type CheckInInventoryLine } from "../../services/checkInApi"
import { confirmCustomerRentalStart, extendCustomerInventoryReturnWindow, getCustomerReservation, markCustomerPreparationComplete, previewCustomerRentalStart, resolveCustomerInventory, type CustomerReservationDetail, type RentalStartConfirmation } from "../../services/customerReservationApi"
import { updateReturnRequest } from "../../services/returnApi"
import { InventoryLineInspectionResult, InventoryResolutionNotice, PackagingInspectionResult } from "../customer/CustomerReservationCard"
import InventoryAppointmentPanel from "../customer/InventoryAppointmentPanel"
import IntakeWorkflowPanel from "../../components/IntakeWorkflowPanel"
import { formatCustomerDateTime } from "../../i18n/customerDate"
import { listReturns, type ApiReturn } from "../../services/returnApi"
import { ReturnSummary } from "../return-api/ReturnApiPanel"
import { userFacingError } from "../../presentation/userFacingError"
import FilePreviewDialog from "../../components/FilePreviewDialog"
import { vietnamDateInput } from "../../utils/vietnamTime"
const labelClass = "text-xs font-normal text-slate-500"
const valueClass = "mt-1 text-sm font-medium text-slate-900"

function GoodsImage({ image }: { image: { id: string; originalName: string; contentType: string; sizeBytes: number } }) {
  const [url, setUrl] = useState<string>()
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    void downloadCheckInEvidence(image.id).then(downloaded => {
      if (!active) return
      objectUrl = URL.createObjectURL(downloaded.blob)
      setUrl(objectUrl)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [image.id])
  const open = async () => {
    if (url) { setPreview(true); return }
    try {
      const downloaded = await downloadCheckInEvidence(image.id)
      const next = URL.createObjectURL(downloaded.blob)
      setUrl(current => { if (current) URL.revokeObjectURL(current); return next })
      setPreview(true)
    } catch { setError(true) }
  }
  return <div className="space-y-1">
    <button type="button" className="block overflow-hidden rounded-lg border border-stone-200 bg-stone-50" onClick={() => void open()} title="Xem ảnh">
      {url ? <img src={url} alt={image.originalName} className="h-24 w-24 object-cover" /> : <span className="flex h-24 w-24 items-center justify-center px-2 text-center text-[11px] text-stone-500">Xem ảnh</span>}
    </button>
    {error && <p className="text-[11px] text-red-700">Không thể tải ảnh</p>}
    {preview && url && <FilePreviewDialog file={{ url, type: image.contentType, name: image.originalName }} onClose={() => setPreview(false)} />}
  </div>
}
function savedInventoryReport(rental: RentalApiDetail): InventoryInspectionReport | null {
  if (rental.inventory?.report) return rental.inventory.report
  if (!rental.inventory?.actualJson) return null
  try {
    const actual = JSON.parse(rental.inventory.actualJson)
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return null
    const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
    return {
      packageCount: finite(actual.packageCount),
      actualMeasurements: { weightKg: finite(actual.weightKg), actualVolumeM3: finite(actual.volumeM3) },
      inventoryLines: Array.isArray(actual.lines) ? actual.lines.filter((line: unknown): line is CheckInInventoryLine => Boolean(line && typeof line === 'object' && 'goodsItemId' in line && 'actualQuantity' in line && typeof line.goodsItemId === 'string' && typeof line.actualQuantity === 'number')) : [],
      actualPackagingMethod: typeof actual.packagingMethod === 'string' ? actual.packagingMethod : null,
      packagingCondition: ['INTACT', 'MINOR_DAMAGE', 'MAJOR_DAMAGE', 'UNPACKAGED'].includes(actual.packagingCondition) ? actual.packagingCondition : null,
      varianceReason: typeof actual.varianceReason === 'string' ? actual.varianceReason : null,
      notes: typeof actual.notes === 'string' ? actual.notes : '',
      evidenceReferences: Array.isArray(actual.evidenceReferences) ? actual.evidenceReferences.filter((id: unknown): id is string => typeof id === 'string') : [],
    }
  } catch { return null }
}

export default function RentalDetail({
  rental,
  onRequest,
  role = "customer",
  showTechnicalWarnings = true,
  onRentalStartConfirmed,
}: {
  rental: RentalApiDetail
  onRequest?: () => void
  role?: RentalApiRole
  showTechnicalWarnings?: boolean
  onRentalStartConfirmed?: () => void
}) {
  const { copy } = useManagerPresentation()
  const [section, setSection] = useState<'documents' | 'payments' | 'inventory'>('documents')
  const [receiptPayment, setReceiptPayment] = useState<string>()
  const [startPreview, setStartPreview] = useState<RentalStartConfirmation>()
  const [startAcknowledged, setStartAcknowledged] = useState(false)
  const [startSubmitting, setStartSubmitting] = useState(false)
  const [startError, setStartError] = useState<string>()
  const [preparationSubmitting, setPreparationSubmitting] = useState(false)
  const [preparationError, setPreparationError] = useState<string>()
  const [inventoryDetail, setInventoryDetail] = useState<CustomerReservationDetail>()
  const [inventoryReadError, setInventoryReadError] = useState('')
  const [inventoryPreviewError, setInventoryPreviewError] = useState('')
  const [inventoryReload, setInventoryReload] = useState(0)
  const [resolvingInventory, setResolvingInventory] = useState(false)
  const [inventoryActionMessage, setInventoryActionMessage] = useState('')
  const [inventoryActionError, setInventoryActionError] = useState('')
  const [activeReturnCase, setActiveReturnCase] = useState<ApiReturn>()
  const isReturningRental = ['return_requested', 'return_inspection', 'closing'].includes(rental.status)
  const inventoryReservationId = role === 'customer'
    ? rental.reservationId : null
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!inventoryReservationId) return
    let active = true
    setInventoryReadError('')
    void getCustomerReservation(inventoryReservationId)
      .then(value => { if (active) setInventoryDetail(value) })
      .catch(error => { if (active) setInventoryReadError(userFacingError(error, 'Không tải được lịch kiểm kê.')) })
    const refresh = () => { if (document.visibilityState !== 'hidden') setInventoryReload(value => value + 1) }
    const timer = window.setInterval(refresh, 15_000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [inventoryReservationId, inventoryReload])
  const previewInventoryEvidence = async (id: string) => {
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    setInventoryPreviewError('')
    try {
      const file = await downloadCheckInEvidence(id)
      const url = URL.createObjectURL(file.blob)
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) { tab?.close(); setInventoryPreviewError(userFacingError(error, 'Không thể mở bằng chứng kiểm kê.')) }
  }
  useEffect(() => {
    if (!isReturningRental) { setActiveReturnCase(undefined); return }
    let active = true
    const returnRole = role === 'manager' ? 'manager' : role === 'staff' ? 'staff' : 'customer'
    void listReturns(returnRole, 0, 50)
      .then(page => {
        if (!active) return
        const found = page.data.find(item => item.rentalId === rental.id && item.status !== 'completed')
        setActiveReturnCase(found)
      })
      .catch(() => {})
    return () => { active = false }
  }, [isReturningRental, rental.id, role])
  const labelClass = "text-xs font-medium text-stone-500"
  const valueClass = "mt-1 text-sm font-semibold text-stone-900"

  const displayCode = rental.displayCode
  const inspectionReport = savedInventoryReport(rental)
  const evidence = rental.bookingEvidence
  const agreed = evidence?.agreedAmounts
  const warnings = rental.dataWarnings.filter(warning => warning.field !== "contractEndDate")
  const accessStatus = rental.access.completeness === "UNKNOWN"
    ? null
    : accessStatusLabels[rental.access.status?.toUpperCase() || ""] || null

  const openStartPreview = async () => {
    if (!rental.reservationId) return
    setStartError(undefined)
    setStartAcknowledged(false)
    try {
      setStartPreview(await previewCustomerRentalStart(rental.reservationId))
    } catch (error) {
      setStartError(userFacingError(error, 'Không thể xem mốc bắt đầu kỳ thuê.'))
    }
  }

  const confirmStart = async () => {
    if (!rental.reservationId || !startPreview || !startAcknowledged || startSubmitting) return
    setStartSubmitting(true)
    setStartError(undefined)
    try {
      await confirmCustomerRentalStart(rental.reservationId, startPreview)
      setStartPreview(undefined)
      onRentalStartConfirmed?.()
    } catch (error) {
      setStartError(userFacingError(error, 'Không thể xác nhận bắt đầu kỳ thuê.'))
    } finally {
      setStartSubmitting(false)
    }
  }

  const reportPreparationComplete = async () => {
    if (role !== 'customer' || !rental.reservationId || preparationSubmitting) return
    setPreparationSubmitting(true)
    setPreparationError(undefined)
    try {
      setInventoryDetail(await markCustomerPreparationComplete(rental.reservationId,
        'Khách hàng đã sắp xếp hàng và sẵn sàng để nhân viên kiểm kê.'))
      onRentalStartConfirmed?.()
    } catch (error) {
      setPreparationError(userFacingError(error, 'Không thể báo đã chuẩn bị xong.'))
    } finally {
      setPreparationSubmitting(false)
    }
  }

  const resolveInventoryDecision = async (decision: 'ACCEPT_FULL' | 'CANCEL_AND_RETURN', scheduledDate?: string) => {
    if (role !== 'customer' || !rental.reservationId || resolvingInventory) return
    setResolvingInventory(true)
    setInventoryActionMessage('')
    setInventoryActionError('')
    try {
      const updated = await resolveCustomerInventory(
        rental.reservationId,
        decision,
        decision === 'CANCEL_AND_RETURN' ? 'Khách yêu cầu xử lý trả kho do kết quả kiểm kê không phù hợp.' : undefined,
        scheduledDate,
      )
      setInventoryDetail(updated)
      setInventoryActionMessage(decision === 'CANCEL_AND_RETURN'
        ? 'Đã gửi yêu cầu trả kho. Cơ sở sẽ tiếp nhận và kiểm tra hiện trạng theo quy trình trả kho.'
        : 'Đã xác nhận nhận toàn bộ hàng hóa.')
      onRentalStartConfirmed?.()
    } catch (error) {
      setInventoryActionError(userFacingError(error, 'Không thể ghi nhận phương án xử lý kiểm kê.'))
    } finally {
      setResolvingInventory(false)
    }
  }

  const extendInventoryReturn = async () => {
    if (role !== 'customer' || !rental.reservationId || resolvingInventory) return
    setResolvingInventory(true)
    setInventoryActionMessage('')
    setInventoryActionError('')
    try {
      const updated = await extendCustomerInventoryReturnWindow(rental.reservationId)
      setInventoryDetail(updated)
      setInventoryActionMessage('Đã kéo dài thời gian trả kho theo quy định.')
      onRentalStartConfirmed?.()
    } catch (error) {
      setInventoryActionError(userFacingError(error, 'Không thể kéo dài thời gian trả kho.'))
    } finally {
      setResolvingInventory(false)
    }
  }

  return (
    <div className="space-y-5 [&_dt]:text-xs [&_dt]:font-normal [&_dt]:text-stone-500 [&_dd]:mt-1.5 [&_dd]:break-words [&_dd]:text-sm [&_dd]:font-medium [&_dd]:leading-relaxed [&_dd]:text-stone-900">
      <div className="flex flex-wrap gap-2">
        <Button variant={section === 'documents' ? 'primary' : 'outline'} onClick={() => setSection('documents')}>Hồ sơ & tài liệu</Button>
        <Button variant={section === 'payments' ? 'primary' : 'outline'} onClick={() => setSection('payments')}>Thỏa thuận & giao dịch</Button>
        <Button variant={section === 'inventory' ? 'primary' : 'outline'} onClick={() => setSection('inventory')}>Kết quả kiểm kê</Button>
      </div>
      <div className={section === 'documents' ? 'space-y-5' : 'hidden'}>
      {isReturningRental && (
        <Card className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-amber-950">Hồ sơ đang trong quy trình trả kho</h3>
            <Badge variant="warning">{copy(rentalStatusLabel(rental))}</Badge>
          </div>
          {activeReturnCase ? (
            <ReturnSummary record={activeReturnCase} hideHeader />
          ) : (
            <p className="text-sm text-amber-900">Hồ sơ đã chuyển sang trả kho. Vui lòng mở mục <b>Trả kho</b> để theo dõi lịch trả, nghiệm thu và bảng kê quyết toán.</p>
          )}
        </Card>
      )}
      {rental.status === "active" && <RenewalRiskNotice rentalId={rental.id} role={role} />}
      <Card className="overflow-hidden rounded-xl border-t-4 border-t-amber-500 bg-white px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">StorageHub · Hồ sơ lưu trữ</p><h3 className="text-2xl font-bold text-stone-900">Thông tin hồ sơ thuê</h3><p className="mt-2 text-sm text-stone-500">{rental.facility.name}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${rental.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{copy(rentalStatusLabel(rental))}</span>
        </div>
        <dl className="divide-y divide-stone-100 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&>div]:py-4 sm:[&>div]:grid-cols-[180px_minmax(0,1fr)] sm:[&>div]:gap-6 [&_dd]:!mt-0">
          <div>
            <dt className={labelClass}>Mã hồ sơ thuê</dt>
            <dd className={`${valueClass} flex items-center gap-2`}>
              <span className="break-all font-mono text-xs sm:text-sm" title={displayCode || undefined}>{rentalRecordLabel(rental)}</span>
              {displayCode && <button
                type="button"
                aria-label="Sao chép mã hồ sơ thuê"
                title="Sao chép mã hồ sơ"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => { void navigator.clipboard?.writeText(displayCode) }}
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="8" y="8" width="12" height="12" rx="2" strokeWidth="1.7" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" strokeWidth="1.7" />
                </svg>
              </button>}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Khách hàng</dt>
            <dd className={valueClass}>{rental.customer.fullName}</dd>
          </div>
          <div>
            <dt className={labelClass}>Cơ sở lưu trữ</dt>
            <dd className={valueClass}>{rental.facility.name}</dd>
          </div>
          <div>
            <dt className={labelClass}>Gian kho</dt>
            <dd className={valueClass}>{rental.storageUnit.code}</dd>
          </div>
          <div>
            <dt className={labelClass}>Loại gian kho</dt>
            <dd className={valueClass}>{copy(rental.unitType.name)}</dd>
          </div>
          <div>
            <dt>Thời hạn thuê</dt>
            <dd>{rentalPeriodText(rental, showTechnicalWarnings)}</dd>
          </div>
          {rental.setupStartedAt && rental.setupEndsAt && <div>
            <dt>Hạn chuẩn bị (Miễn phí)</dt>
            <dd className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3"><p className="text-xs text-stone-500">Ngày nhận kho theo lịch khách chọn</p><p className="mt-1 font-semibold">{rentalDate(rental.setupStartedAt)}</p></div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3"><p className="text-xs text-stone-500">Kết thúc chuẩn bị miễn phí</p><p className="mt-1 font-semibold">{rentalDate(rental.setupEndsAt)}</p></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"><span className="text-sm text-emerald-800">Bắt đầu kỳ thuê có tính tiền</span><span className="font-bold text-emerald-900">{rentalDate(rental.startDate)}</span></div>
              <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">Ngày tính tiền = ngày khách chọn nhận kho + số ngày chuẩn bị miễn phí theo gói thuê.</p>
              {rental.moveInCompletedAt && <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">Đã báo hoàn tất chuẩn bị lúc {new Date(rental.moveInCompletedAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} ngày {rentalDate(vietnamDateInput(rental.moveInCompletedAt))}</p>}
            </dd>
          </div>}
          {role === 'customer' && !isReturningRental && (rental.status === 'setup' || rental.status === 'active') && rental.inventoryPending
            && !rental.moveInCompletedAt && !inventoryDetail?.setupCompletedAt && !rental.inventoryVerifiedAt && rental.reservationId && (
            <div>
              <dt>Đưa hàng vào kho</dt>
              <dd className="space-y-3">
                <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 text-violet-950">
                  <p className="text-sm font-bold">Bạn đã đưa hàng vào kho xong?</p>
                  <p className="mt-1 text-xs leading-5">Xác nhận đã đưa hàng vào thành công để mở lịch chọn ngày hẹn kiểm kê gửi cho nhân viên.</p>
                  <Button className="mt-2" size="sm" disabled={preparationSubmitting} onClick={() => void reportPreparationComplete()}>
                    {preparationSubmitting ? 'Đang gửi…' : 'Xác nhận đã đưa hàng vào thành công'}
                  </Button>
                  {preparationError && <p role="alert" className="mt-2 text-xs text-red-700">{preparationError}</p>}
                </div>
                <IntakeWorkflowPanel
                  reservationId={rental.reservationId}
                  role="CUSTOMER"
                  statusSignal={rental.moveInCompletedAt || rental.status}
                  onUpdated={onRentalStartConfirmed}
                />
              </dd>
            </div>
          )}
          {rental.inventoryVerifiedAt ? <div>
            <dt>Kiểm kê đầu vào</dt>
            <dd><Badge variant="success">Đã hoàn tất</Badge>
              <p className="mt-1 text-xs text-stone-500">Nhân viên đã xác nhận lúc {rentalDate(rental.inventoryVerifiedAt)}.</p>
              {role === 'customer' && rental.setupEndsAt && rental.status === 'setup' && <p className="mt-3 text-sm text-stone-700">Hàng đã được kiểm kê. Kỳ thuê sẽ bắt đầu theo ngày đã chốt sau khi hết thời gian chuẩn bị miễn phí.</p>}
              {role === 'customer' && rental.canConfirmRentalStart && rental.reservationId && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-stone-700">Hàng đã được kiểm kê. Bạn có thể xác nhận bắt đầu kỳ thuê hôm nay.</p>
                  <Button size="sm" onClick={openStartPreview}>Xem mốc kỳ thuê mới</Button>
                  {startError && !startPreview && <p role="alert" className="text-sm text-red-700">{startError}</p>}
                </div>
              )}
              {role === 'customer' && inventoryDetail?.reservation.id === rental.reservationId && (
                <div className="mt-3 space-y-2">
                  <InventoryResolutionNotice detail={inventoryDetail} now={now} submitting={resolvingInventory} onExtendReturnWindow={() => void extendInventoryReturn()} onResolve={(decision, scheduledDate) => void resolveInventoryDecision(decision, scheduledDate)} />
                  {inventoryActionMessage && <p role="status" className="text-xs font-medium text-emerald-700">{inventoryActionMessage}</p>}
                  {inventoryActionError && <p role="alert" className="text-xs font-medium text-red-700">{inventoryActionError}</p>}
                </div>
              )}
            </dd>
          </div> : (rental.inventoryPending || (role === 'customer' && Boolean(inventoryDetail?.inventoryDecision || inventoryDetail?.inventoryResolutionStatus === 'RETURN_REQUESTED'))) && <div>
            <dt>Kiểm kê đầu vào</dt>
            <dd className="space-y-3">{role === 'customer' && inventoryDetail?.reservation.id === rental.reservationId
              && (inventoryDetail.inventoryFinalDeadlineAt || inventoryDetail.setupCompletedAt || inventoryDetail.inventoryDecision || (inventoryDetail.inventoryResolutionStatus && inventoryDetail.inventoryResolutionStatus !== 'NOT_STARTED')) ? (
                <>
                  {!isReturningRental && inventoryDetail.inventoryFinalDeadlineAt && <InventoryAppointmentPanel detail={inventoryDetail} now={now} onSaved={setInventoryDetail} />}
                  <InventoryResolutionNotice
                    detail={inventoryDetail}
                    now={now}
                    submitting={resolvingInventory}
                    onExtendReturnWindow={() => void extendInventoryReturn()}
                    onScheduleReturnDate={async (returnCaseId, scheduledDate, note) => {
                      setResolvingInventory(true)
                      setInventoryActionMessage('')
                      setInventoryActionError('')
                      try {
                        await updateReturnRequest(returnCaseId, scheduledDate, note)
                        const refreshed = await getCustomerReservation(rental.reservationId!)
                        setInventoryDetail(refreshed)
                        setInventoryActionMessage('Đã lưu ngày hẹn trả kho dự kiến.')
                        onRentalStartConfirmed?.()
                      } catch (error) {
                        setInventoryActionError(userFacingError(error, 'Không thể lưu ngày hẹn trả kho.'))
                      } finally {
                        setResolvingInventory(false)
                      }
                    }}
                    onResolve={(decision, scheduledDate) => void resolveInventoryDecision(decision, scheduledDate)}
                  />
                  {inventoryActionMessage && <p role="status" className="text-xs font-medium text-emerald-700">{inventoryActionMessage}</p>}
                  {inventoryActionError && <p role="alert" className="text-xs font-medium text-red-700">{inventoryActionError}</p>}
                </>
              ) : <>
              <Badge variant="warning">Chưa kiểm kê</Badge>
              <p className="mt-2 text-xs leading-5 text-stone-500">Kỳ thuê vẫn tính theo ngày khách chọn nhận kho cộng số ngày chuẩn bị miễn phí, hồ sơ kiểm kê cần được hoàn tất trước hạn xử lý.</p>
              {rental.inventoryDueAt && <p className="mt-1 text-xs text-stone-500">Mốc nhắc kiểm kê: {new Date(rental.inventoryDueAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>}
              {rental.inventoryFinalDeadlineAt && <p className={`mt-1 text-xs font-bold ${new Date(rental.inventoryFinalDeadlineAt).getTime() <= now ? 'text-red-700' : 'text-stone-700'}`}>{new Date(rental.inventoryFinalDeadlineAt).getTime() <= now ? 'Đã quá hạn kiểm kê' : 'Hạn hoàn tất kiểm kê'}: {new Date(rental.inventoryFinalDeadlineAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>}
              {inventoryReadError && <div className="mt-2">
                <p role="alert" className="text-xs text-red-700">{inventoryReadError}</p>
                <Button size="sm" variant="outline" onClick={() => setInventoryReload(value => value + 1)}>Tải lại lịch kiểm kê</Button>
              </div>}
              </>}
            </dd>
          </div>}
          {rental.setupExitReviewRequired && inventoryDetail?.inventoryResolutionStatus !== 'RETURN_REQUESTED' && inventoryDetail?.inventoryDecision?.outcome !== 'REFUSED' && <div>
            <dt>Xử lý hủy/trả trong thời gian chuẩn bị</dt>
            <dd><Badge variant="warning">Chờ Ban điều hành quyết định</Badge><p className="mt-2 text-xs leading-5 text-stone-500">{rental.moveInCompletedAt ? 'Hàng đã chuyển vào: phải dọn hàng và kiểm tra trả kho trước khi quyết toán.' : 'Hàng chưa chuyển vào: xử lý như hủy sau khi nhận kho, không cần kiểm kê hàng.'} Không tự động hoàn tiền.</p></dd>
          </div>}
          <div>
            <dt>Giá thuê / tháng</dt>
            <dd>{rentalMoney(rental.monthlyPrice, rental.currency)}</dd>
          </div>
          <div>
            <dt>Quyền ra vào kho</dt>
            <dd><Badge variant={rental.access.status === 'ACTIVE' ? 'success' : 'muted'}>{accessStatus || 'Chưa xác minh'}</Badge>
            <p className="mt-2 text-xs leading-5 text-stone-500">{rental.access.completeness === 'UNKNOWN'
              ? 'Chưa tải được trạng thái cấp quyền ra vào. Vui lòng liên hệ nhân viên cơ sở.'
              : rental.access.status === 'ACTIVE' ? 'Đã có thẻ hoặc mã ra vào đang hoạt động.'
              : rental.access.status === 'REVOKED' ? 'Thẻ hoặc mã ra vào đã được thu hồi.'
              : rental.access.status === 'INACTIVE' ? 'Chưa ghi nhận thẻ hoặc mã ra vào được cấp cho hồ sơ này.'
              : 'Trạng thái được cập nhật theo thông tin quyền ra vào của cơ sở.'}</p></dd>
            {rental.access.status?.toUpperCase() === 'ACTIVE' && rental.access.reference && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"><dt className="text-xs font-medium text-amber-900">Mã ổ khóa đã bàn giao</dt><dd className="mt-1 font-mono text-base font-bold tracking-wider text-amber-950">{rental.access.reference}</dd></div>}
          </div>
        </dl>
      </Card>
      <RentalHandoverFiles key={`${role}:${rental.id}`} role={role === "manager" ? "manager" : "customer"} id={rental.id} />
      {onRequest && (
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end border-t border-stone-200 bg-white/95 px-1 py-3 backdrop-blur">
          <Button disabled={rental.status !== "active"} onClick={onRequest}>
            Yêu cầu gia hạn
          </Button>
          {rental.status !== "active" && (
            <p>
              Chỉ có thể yêu cầu gia hạn khi hồ sơ đang hiệu lực và chưa yêu cầu trả kho.
            </p>
          )}
        </div>
      )}
      {evidence && evidence.customer && <Card className="rounded-xl p-5">
        <h3 className="mb-4 border-b border-stone-200 pb-3 text-base font-bold">Thông tin khách hàng</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          {[['Họ và tên', evidence.customer.fullName], ['Email', evidence.customer.email], ['Số điện thoại', evidence.customer.phone || 'Chưa cập nhật'], ['Địa chỉ', evidence.customer.address || 'Chưa cập nhật'], ['CCCD/CMND', evidence.customer.identityDocumentNumber || 'Chưa cập nhật']].map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 font-semibold text-stone-900">{value}</dd></div>)}
        </dl>
      </Card>}
      {evidence && <Card className="rounded-xl p-5">
        <h3 className="mb-4 border-b border-stone-200 pb-3 text-base font-bold">Hàng hóa khai báo</h3>
        {!evidence.goodsItems?.length ? (
          <p className="text-sm text-stone-500">Chưa có hàng hóa được khai báo.</p>
        ) : (
          <div className="space-y-4">
            {evidence.goodsItems.map(item => {
              const fields = [
                ['Tên hàng', item.customGoodsName || item.categoryName || item.goodsCode],
                ['Loại hàng', item.categoryName],
                ['Chất liệu chính', item.customMaterial || item.materialName],
                ['Số lượng', item.quantity],
                ['Chiều dài mỗi kiện', item.lengthCm == null ? null : item.lengthCm + ' cm'],
                ['Chiều rộng mỗi kiện', item.widthCm == null ? null : item.widthCm + ' cm'],
                ['Chiều cao mỗi kiện', item.heightCm == null ? null : item.heightCm + ' cm'],
                ['Khối lượng mỗi kiện', item.weightPerItemKg == null ? null : item.weightPerItemKg + ' kg'],
                ['Dễ vỡ', item.fragile ? 'Có' : 'Không'],
                ['Được xếp chồng', item.stackable ? 'Có' : 'Không'],
                ...(item.stackable ? [['Số lớp xếp tối đa', item.maxStackLayers]] : []),
                ['Được xoay và đặt nằm ngang', item.allowHorizontalPlacement ? 'Có' : 'Không'],
                ['Ghi chú của khách', item.customerNote || 'Không có ghi chú'],
              ]
              return (
                <article key={item.id} className="overflow-hidden rounded-xl border border-stone-200">
                  <h4 className="break-words bg-stone-50 px-4 py-3 font-semibold text-stone-900">
                    {item.customGoodsName || item.categoryName || item.goodsCode}
                  </h4>
                  <dl className="grid px-4 text-sm md:grid-cols-2 md:gap-x-8">
                    {fields.map(([label, value]) => (
                      <div key={label} className="grid gap-1 border-b border-stone-100 py-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-4">
                        <dt className="font-medium text-stone-600">{label}</dt>
                        <dd className="whitespace-pre-wrap break-words font-medium text-stone-900">{value || (value === 0 ? 0 : 'Không có dữ liệu')}</dd>
                      </div>
                    ))}
                    <div className="grid gap-1 border-b border-stone-100 py-3 md:col-span-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-4">
                      <dt className="font-medium text-stone-600">Mô tả hàng hóa</dt>
                      <dd className="whitespace-pre-wrap break-words font-medium text-stone-900">{item.description || 'Không có mô tả'}</dd>
                    </div>
                  </dl>
                </article>
              )
            })}
          </div>
        )}
      </Card>}
      {evidence?.goodsItems?.some(item => item.images.length > 0) && <Card className="rounded-xl p-5">
        <h3 className="mb-4 border-b border-stone-200 pb-3 text-base font-bold">Hình ảnh hàng hóa</h3>
        <div className="space-y-5">{evidence.goodsItems.filter(item => item.images.length > 0).map(item => <div key={item.id}>
          <p className="mb-3 text-sm font-semibold text-stone-700">{item.customGoodsName || item.categoryName || item.goodsCode}</p>
          <div className="flex flex-wrap gap-3">{item.images.map(image => <GoodsImage key={image.id} image={image} />)}</div>
        </div>)}</div>
      </Card>}
      </div>
      <div className={section === 'inventory' ? 'space-y-4' : 'hidden'}>
      {(rental.inventory?.intakeDecision || inventoryDetail?.inventoryDecision) && <InventoryDecisionSummary decision={rental.inventory?.intakeDecision || inventoryDetail?.inventoryDecision} />}
      {inspectionReport ? <Card className="p-4">
        <h3 className="mb-3 border-b border-stone-200 pb-2 text-base font-semibold">Kết quả kiểm kê hàng hóa</h3>
        <InventoryMismatchEvidence item={{
          handover: inspectionReport,
          inventoryFullFit: rental.inventory?.fullFit,
          inventoryMismatchJson: rental.inventory?.mismatchJson || (rental.inventory?.mismatch ? '{}' : null),
          inventoryMismatchSummary: rental.inventory?.mismatchSummary,
          declaredPackagingMethod: rental.inventory?.declaredPackaging,
          declaredPackageCount: evidence?.goodsItems?.length ? evidence.goodsItems.reduce((sum, item) => sum + item.quantity, 0) : undefined,
          declaredGoodsWeightKg: evidence?.goodsItems?.length ? evidence.goodsItems.reduce((sum, item) => sum + item.quantity * item.weightPerItemKg, 0) : undefined,
          declaredGoodsVolumeM3: evidence?.goodsItems?.length ? evidence.goodsItems.reduce((sum, item) => sum + item.quantity * item.lengthCm * item.widthCm * item.heightCm / 1_000_000, 0) : undefined,
          declaredGoodsLines: evidence?.goodsItems?.map(item => ({ ...item, code: item.goodsCode,
            name: item.customGoodsName || item.categoryName, weightPerPackageKg: item.weightPerItemKg })),
        }} onPreview={id => void previewInventoryEvidence(id)} />
      </Card> : <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">Chưa có kết quả kiểm kê đã lưu cho hồ sơ này.</p>}
      {inventoryPreviewError && <p role="alert" className="text-sm text-red-700">{inventoryPreviewError}</p>}
      </div>
      <div className={section === 'payments' ? 'space-y-5' : 'hidden'}>
      {evidence && (
        <Card className="rounded-xl p-5">
          <h3 className="mb-4 border-b border-stone-200 pb-3 text-base font-bold">Thỏa thuận ban đầu</h3>
          {agreed ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-900 px-5 py-5 text-white">
                <div><p className="text-sm font-semibold">Tổng tiền theo thỏa thuận</p><p className="mt-1 text-xs text-stone-300">Đã gồm tiền cọc đảm bảo thuê</p></div>
                <p className="text-2xl font-bold tabular-nums">{rentalMoney(agreed.totalInitialObligation, evidence.currency)}</p>
              </div>
              <div className="divide-y divide-stone-100 px-1">
                {[["Tiền thuê toàn kỳ", agreed.netRentalAmount], ["Tiền cọc đảm bảo thuê", agreed.securityDepositAmount]].map(([label, amount]) => <div key={String(label)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="text-stone-600">{label}</span><span className="font-semibold tabular-nums text-stone-900">{rentalMoney(Number(amount), evidence.currency)}</span></div>)}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-stone-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-stone-500">Chặng 1 · Khi giữ chỗ</p><p className="mt-3 text-sm text-stone-700">Đặt cọc giữ chỗ (20%)</p><p className="mt-2 text-xl font-bold tabular-nums text-stone-900">{rentalMoney(agreed.reservationDepositAmount, evidence.currency)}</p></section>
                <section className="rounded-xl border border-amber-300 bg-amber-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Chặng 2 · Khi nhận kho</p><p className="mt-3 text-sm text-stone-700">Số tiền còn lại phải thanh toán khi bàn giao kho</p><p className="mt-2 text-xl font-bold tabular-nums text-amber-800">{rentalMoney(agreed.dueAtCheckIn, evidence.currency)}</p></section>
              </div>
            </div>
          ) : <p>Không có dữ liệu</p>}
          <p className="mt-3 text-sm">Đây là số tiền theo thỏa thuận ban đầu, không phải xác nhận đã thu tiền hoặc dư nợ hiện tại.</p>
          <h4 className="font-bold mt-4 mb-2">Giao dịch của đơn đặt chỗ</h4>
          {evidence.payments.length === 0 ? <p>Không có dữ liệu</p> : (
            <ul className="space-y-3">
              {evidence.payments.map(payment => (
                <li key={payment.id} className="rounded-xl border border-stone-200 p-4">
                  <p className="text-sm font-medium text-stone-600">{bookingPaymentPurposes[payment.purpose]}</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">{rentalMoney(payment.amount, evidence.currency)}</p>
                  <p className="mt-2 text-sm"><strong>Trạng thái:</strong> {bookingPaymentStatuses[payment.status]}</p>
                  <p className="mt-1 text-sm"><strong>Số hóa đơn:</strong> {invoiceNumberLabel(payment.invoiceNumber)}{payment.invoiceNumber?.trim() && ` · ${displayStatusLabel(payment.invoiceStatus)}`}</p>
                  {role === 'customer' && payment.status === 'PAID' && rental.reservationId && <Button variant="outline" size="sm" className="mt-3" onClick={() => setReceiptPayment(payment.id)}>Xem biên lai</Button>}
                </li>
              ))}
            </ul>
          )}
          {evidence.paymentsTruncated && <p role="status" className="mt-3">Chỉ hiển thị 20 giao dịch gần nhất, chưa phải toàn bộ lịch sử.</p>}
        </Card>
      )}
      {!evidence && <p className="rounded-xl border border-stone-200 p-4 text-sm text-stone-500">Chưa có dữ liệu thỏa thuận và giao dịch của đơn đặt chỗ.</p>}
      </div>
      {receiptPayment && rental.reservationId && <Modal open onClose={() => setReceiptPayment(undefined)} title="Biên lai thanh toán" size="lg">
        <BookingTransactionReceipt reservationId={rental.reservationId} paymentId={receiptPayment} />
      </Modal>}
      {startPreview && <Modal open onClose={() => { if (!startSubmitting) setStartPreview(undefined) }} title="Xác nhận bắt đầu kỳ thuê" size="lg">
        <div className="space-y-4 text-sm">
          <p>Thời gian miễn phí kết thúc khi bạn xác nhận. Kỳ thuê {startPreview.rentalMonths} tháng sẽ tính từ hôm nay theo báo giá đã chốt.</p>
          <dl className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-3">
            <div><dt>Ngày tính tiền theo lịch cũ</dt><dd>{rentalDate(startPreview.scheduledStartDate)}</dd></div>
            <div><dt>Bắt đầu tính tiền</dt><dd>{rentalDate(startPreview.startDate)}</dd></div>
            <div><dt>Ngày cuối kỳ thuê</dt><dd>{rentalDate(startPreview.lastPermittedDate)}</dd></div>
          </dl>
          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <input type="checkbox" className="mt-1" checked={startAcknowledged} disabled={startSubmitting} onChange={event => setStartAcknowledged(event.target.checked)} />
            <span>Tôi đã đối chiếu kết quả kiểm kê và đồng ý bắt đầu kỳ thuê tính tiền từ {rentalDate(startPreview.startDate)}.</span>
          </label>
          {startError && <p role="alert" className="text-sm text-red-700">{startError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={startSubmitting} onClick={() => setStartPreview(undefined)}>Xem lại hồ sơ</Button>
            <Button disabled={!startAcknowledged || startSubmitting} onClick={confirmStart}>{startSubmitting ? 'Đang xác nhận…' : 'Xác nhận bắt đầu kỳ thuê'}</Button>
          </div>
        </div>
      </Modal>}
      {showTechnicalWarnings && warnings.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-50 p-4">
          <h4 className="font-semibold">Cần kiểm tra dữ liệu</h4>
          {warnings.map((w, i) => (
            <p key={i}>{rentalDataWarning(w.field)}</p>
          ))}
        </div>
      )}
    </div>
  )
}
