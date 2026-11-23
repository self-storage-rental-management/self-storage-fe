import { profileChecklist, profileProgress } from '../../components/CustomerProfileFields'
import { actorToUser, getAuthenticatedActor } from '../../services/authApi'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { useEffect, useRef, useState } from 'react'
import { savedReservationQuote, MISSING_RESERVATION_SNAPSHOT } from '../../services/reservationSnapshot'
import { Button, Modal } from '../../components/ui'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { ApiClientError } from '../../services/apiClient'
import {
  getReservationPayment,
  createVnpayPaymentUrl,
  type CustomerReservation,
  type ReservationPaymentResult,
} from '../../services/customerReservationApi'
import { paymentCountdown, paymentCountdownUrgency } from './reservationPresentation'
import ReservationReceipt from './ReservationReceipt'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import { bookingDepositAccepted } from './paymentPresentation'
import { rentalEndDateForDisplay } from '../../domain/rentalTimeline'
import type { User } from '../../types'

function displayValue(value?: string | null) {
  return value?.trim() || 'Chưa cập nhật'
}

function formatDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.replace(/-/g, '/')
}

function formatDisplayDateTime(value?: string | null) {
  if (!value) return 'Chưa chốt'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatCustomerDateTime(date)
}

interface Props {
  user?: User
  reservation: CustomerReservation
  facilityName: string
  unitTypeName: string
  paymentStartedAt?: string | null
  paymentExpiresAt?: string | null
  now: number
  onMessage: (message: string) => void
  onRefresh: () => Promise<void>
}

export default function CustomerReservationPayment({ user, reservation, facilityName, unitTypeName, paymentStartedAt, paymentExpiresAt, now, onMessage, onRefresh }: Props) {
  const [payment, setPayment] = useState<ReservationPaymentResult | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [returnFailure, setReturnFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [acceptedNoRefund, setAcceptedNoRefund] = useState(false)
  const paymentKey = useRef<string | null>(null)
  const paymentLock = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])
  useEffect(() => {
    const resume = (event: PageTransitionEvent) => {
      if (event.persisted) { paymentLock.current = false; setBusy(false); void onRefreshRef.current() }
    }
    window.addEventListener('pageshow', resume)
    return () => window.removeEventListener('pageshow', resume)
  }, [])

  useEffect(() => {
    if (['AWAITING_EMAIL', 'AWAITING_REVIEW'].includes(reservation.status)) return
    let disposed = false
    void getReservationPayment(reservation.id)
      .then(value => { if (!disposed) setPayment(value) })
      .catch(error => {
        if (!disposed && !(error instanceof ApiClientError && error.status === 404)) {
          onMessage(userFacingError(error, 'Không thể tải biên lai.'))
        }
      })
    return () => { disposed = true }
  }, [reservation.id, reservation.status, onMessage])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('vnpayReturn') !== 'true' || params.get('reservationId') !== reservation.id) return
    const status = params.get('status')
    const code = params.get('code') || 'không xác định'
    void getReservationPayment(reservation.id)
      .then(value => {
        setPayment(value)
        window.dispatchEvent(new Event('storagehub:notifications-refresh'))
        window.requestAnimationFrame(() => {
          document.getElementById(`customer-reservation-${reservation.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        if (status === 'success' && bookingDepositAccepted(value)) {
          setReturnFailure(null)
          setReceiptOpen(true)
        } else if (value.paymentStatus === 'PAID') {
          setReturnFailure('VNPay đã ghi nhận giao dịch, nhưng trạng thái đơn hiện không xác nhận khoản trả trước. Vui lòng kiểm tra và đối soát trước khi thanh toán thêm.')
        } else {
          setReturnFailure(value.paymentStatus === 'PENDING' || value.paymentStatus === 'NOT_RECEIVED'
            ? `StorageHub chưa nhận được kết quả cuối cùng từ VNPay (mã ${code}). Hệ thống sẽ tiếp tục đối soát. Không thanh toán lại nếu tài khoản đã bị trừ tiền.`
            : `Giao dịch VNPay không thành công (mã ${code}). Bạn có thể thử lại nếu đơn vẫn còn thời hạn.`)
        }
      })
      .catch(() => setReturnFailure(
        `StorageHub chưa tải được kết quả giao dịch VNPay (mã ${code}). Vui lòng kiểm tra lại trạng thái đơn trước khi thanh toán lại.`
      ))
    void onRefreshRef.current()
    params.delete('vnpayReturn')
    params.delete('status')
    params.delete('code')
    params.delete('reservationId')
    const search = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`)
  }, [reservation.id, onMessage])

  const countdown = paymentCountdown(paymentExpiresAt || reservation.holdExpiresAt, now)
  const snapshot = savedReservationQuote(reservation)
  const actor = getAuthenticatedActor()
  const profileUser = actor ? actorToUser(actor) : user
  const profileChecks = profileUser ? profileChecklist(profileUser) : []
  const missingProfileFields = profileChecks.filter(item => !item.ok).map(item => item.label)
  const profileIncomplete = !profileUser || missingProfileFields.length > 0
  useEffect(() => {
    if (reservation.status !== 'AWAITING_PAYMENT' || !countdown.expired) return
    let disposed = false
    const refreshStatus = async () => { if (!disposed) await onRefreshRef.current() }
    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 1000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [reservation.status, countdown.expired])

  const pay = async () => {
    if (paymentLock.current) return
    if (busy || countdown.expired || !acceptedNoRefund || reservation.status !== 'AWAITING_PAYMENT' || !snapshot) return
    const actor = getAuthenticatedActor()
    if (!actor || profileProgress(actorToUser(actor)) < 5) {
      onMessage('Vui lòng cập nhật đủ số điện thoại, giấy tờ tùy thân và người liên hệ khẩn cấp trong Hồ sơ trước khi thanh toán giữ chỗ.')
      return
    }
    paymentLock.current = true
    setBusy(true)
    try {
      paymentKey.current ??= crypto.randomUUID()
      const result = await createVnpayPaymentUrl(reservation.id, paymentKey.current)
      window.location.assign(result.paymentUrl)
    } catch (error) {
      onMessage(userFacingError(error, 'Không thể thanh toán trước 20% (giữ chỗ).'))
      paymentLock.current = false
      setBusy(false)
    }
  }

  const urgency = paymentCountdownUrgency(paymentExpiresAt || reservation.holdExpiresAt, now)
  const timerTone = urgency === 'danger' ? 'bg-red-700 text-white' : urgency === 'warning' ? 'border border-amber-300 bg-amber-50 text-amber-950' : 'border border-stone-200 bg-stone-50 text-stone-800'
  if (!snapshot) return <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{MISSING_RESERVATION_SNAPSHOT}</p>
  return <>
    {reservation.status === 'AWAITING_PAYMENT' && <div className={`rounded-lg p-3 text-right text-xs ${timerTone}`}>
      <p className="font-bold">Thời gian thanh toán đặt cọc giữ chỗ còn lại · giờ:phút:giây</p>
      {(paymentStartedAt || paymentExpiresAt) && <div className="mt-2 space-y-0.5 text-left text-[11px] text-inherit">
        {paymentStartedAt && <p>Bắt đầu tính 15 phút: <b>{formatDisplayDateTime(paymentStartedAt)}</b></p>}
        {paymentExpiresAt && <p>Hạn cuối: <b>{formatDisplayDateTime(paymentExpiresAt)}</b></p>}
      </div>}
      <p role="timer" className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p>
      <p className="mt-1">{countdown.expired ? 'Đã hết thời hạn. Đang chờ cập nhật trạng thái đơn.' : 'Vui lòng hoàn tất thanh toán trước khi hết thời hạn.'}</p>
      <div className="mt-2 rounded border border-amber-300/40 bg-amber-500/20 px-2 py-1.5 text-center text-[11px] font-semibold text-inherit">
        {payment?.paymentStatus === 'PAID' ? 'Nếu bạn tự hủy trước khi nhận kho, khoản trả trước được xử lý theo điều khoản đã chấp nhận.' : 'Bạn chưa thanh toán. Hủy ngay không mất phí.'}
      </div>
      {profileIncomplete && <div role="alert" className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-left text-[11px] leading-5 text-rose-900"><b>Chưa thể thanh toán</b><p>Hoàn thiện hồ sơ trước khi thanh toán, gồm: {missingProfileFields.length ? missingProfileFields.join(', ') : 'thông tin tài khoản'}.</p><p className="mt-1">Mở mục Hồ sơ để bổ sung rồi quay lại đơn này.</p></div>}
      <Button className="mt-2" size="sm" disabled={busy || countdown.expired || profileIncomplete} onClick={() => {
        const actor = getAuthenticatedActor()
        if (!actor || profileProgress(actorToUser(actor)) < 5) {
          onMessage('Vui lòng cập nhật đủ số điện thoại, giấy tờ tùy thân và người liên hệ khẩn cấp trong Hồ sơ trước khi thanh toán giữ chỗ.')
          return
        }
        setAcceptedNoRefund(false); setPayOpen(true)
      }}>Thanh toán đặt cọc giữ chỗ</Button>
    </div>}
    {payment?.paymentStatus === 'PAID' && <Button variant="outline" size="sm" className="reservation-action reservation-action-receipt min-h-10 w-full justify-center" onClick={() => setReceiptOpen(true)}>{bookingDepositAccepted(payment) ? 'Xem biên lai thanh toán' : 'Xem giao dịch cần đối soát'}</Button>}
    <Modal size="2xl" open={payOpen} onClose={() => { if (!busy) { setPayOpen(false); setConfirmModalOpen(false); setAcceptedNoRefund(false) } }} title="Thanh toán trước 20% (giữ chỗ)">
      <div className="space-y-4">
        <div className="grid gap-1 text-sm"><p>Đơn giữ kho: <b>{reservation.reservationCode}</b></p><p>Cơ sở: <b>{facilityName}</b></p><p>Loại kho: <b>{unitTypeName}</b></p><p>{reservation.rentalPeriodConfirmed ? 'Kỳ thuê đã chốt:' : 'Kỳ thuê dự kiến sau thời gian chuẩn bị:'} <b>{snapshot.startDate.split('-').reverse().join('/')} đến {rentalEndDateForDisplay(snapshot.endDate).split('-').reverse().join('/')}</b></p></div>
        <section className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          <p className="font-bold text-stone-900">Thông tin khách hàng đã khai báo</p>
          <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            <p><span className="text-stone-500">Họ và tên:</span> <b>{displayValue(reservation.customerName)}</b></p>
            <p><span className="text-stone-500">CCCD/Hộ chiếu:</span> <b>{displayValue(reservation.identityDocumentNumber)}</b></p>
            <p><span className="text-stone-500">Số điện thoại:</span> <b>{displayValue(reservation.customerPhone)}</b></p>
            <p className="break-all"><span className="text-stone-500">Email:</span> <b>{displayValue(reservation.customerEmail)}</b></p>
            <p className="sm:col-span-2"><span className="text-stone-500">Địa chỉ:</span> <b>{displayValue(reservation.customerAddress)}</b></p>
          </div>
        </section>
        <ReservationQuoteSummary quote={{ ...snapshot, facilityName, unitTypeName }} needsReview={false} context="reservation" />
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          <p className="font-bold">Các mốc thời gian</p>
          <div className="mt-2 space-y-1.5">
            <p><span className="text-blue-800">Thời điểm đăng ký:</span> <b>{formatDisplayDateTime(reservation.createdAt)}</b></p>
            <p><span className="text-blue-800">Lịch nhận kho:</span> <b>{formatDisplayDateTime(reservation.appointmentAt)}</b></p>
            <p><span className="text-blue-800">{reservation.rentalPeriodConfirmed ? 'Ngày bắt đầu kỳ thuê đã chốt:' : 'Ngày bắt đầu kỳ thuê dự kiến:'}</span> <b>{formatDisplayDate(snapshot.startDate)}</b></p>
            <p><span className="text-blue-800">Ngày bắt đầu tính tiền:</span> <b>{formatDisplayDate(snapshot.startDate)}</b></p>
          </div>
          <p className="mt-2 text-xs leading-5 text-blue-800">{reservation.rentalPeriodConfirmed ? 'Kỳ thuê đã được chốt theo ngày khách hàng xác nhận nhận kho và số ngày chuẩn bị miễn phí đã lưu.' : 'Ngày bắt đầu tính tiền bằng ngày khách hàng xác nhận nhận kho cộng số ngày chuẩn bị miễn phí đã chốt. Trước bàn giao, các mốc trên chỉ là dự kiến.'}</p>
          <p className="mt-2 text-xs leading-5 text-blue-800">Nếu thanh toán thất bại rõ ràng, bạn có thể thử lại trước hạn. Khi hết hạn, hệ thống đối soát VNPay trước khi giải phóng suất kho. Nếu chưa có kết quả cuối cùng, kho tiếp tục được giữ trong thời hạn gửi khiếu nại hiển thị trên đơn. Khi có khiếu nại hợp lệ, kho được giữ trong thời gian quản lý xử lý.</p>
        </section>
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Số tiền cần thanh toán ngay</p>
          <p className="mt-1 text-3xl font-extrabold text-stone-950">{formatVnd(snapshot.reservationDepositAmount)}</p>
          <p className="mt-1 text-xs text-stone-600">Thanh toán trước 20% (giữ chỗ) được trừ vào tổng chi phí phải thanh toán đã gồm tiền thuê và tiền cọc đảm bảo thuê.</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${timerTone}`}><p className="text-xs font-bold uppercase tracking-wide">Hạn thanh toán · giờ:phút:giây</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p></div>

        <p className="text-sm text-stone-600">Bạn sẽ được chuyển sang VNPay thử nghiệm. Sau khi thanh toán thành công, bạn có thể xem biên lai trong đơn hoặc qua email.</p>
        <Button className="w-full" disabled={busy || countdown.expired || profileIncomplete} onClick={() => { setAcceptedNoRefund(false); setConfirmModalOpen(true) }}>
          {busy ? 'Đang chuyển sang VNPay…' : `Thanh toán qua VNPay ${formatVnd(snapshot.reservationDepositAmount)}`}
        </Button>
      </div>
    </Modal>
    <Modal size="lg" open={confirmModalOpen} onClose={() => { if (!busy) setConfirmModalOpen(false) }} title="Thông báo quan trọng">
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-950">
          <div className="space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-rose-900 text-sm">
              Thông báo quan trọng: Quy định không hoàn khoản trả trước 20% (giữ chỗ)
            </p>
            <p className="leading-relaxed text-rose-900 font-medium">
              Khoản thanh toán ngay <b>{formatVnd(snapshot.reservationDepositAmount)}</b> là khoản trả trước giữ chỗ, được trừ vào tổng nghĩa vụ phải thanh toán. Theo điều khoản đã chấp nhận, khoản này <b>không hoàn khi khách tự ý hủy hoặc không nhận kho đúng hạn</b>.
            </p>
            <p className="text-[11px] leading-relaxed text-rose-800">
              Toàn bộ số tiền này sẽ được <b>khấu trừ 100%</b> vào tổng nghĩa vụ tài chính khi quý khách đến cơ sở làm thủ tục nhận kho đúng hẹn.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-800 cursor-pointer select-none hover:bg-stone-100 transition">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            checked={acceptedNoRefund}
            onChange={(e) => setAcceptedNoRefund(e.target.checked)}
          />
          <span className="leading-tight">
            Tôi xác nhận đã đọc, hiểu rõ và đồng ý rằng <b>khoản trả trước 20% (giữ chỗ) sẽ không được hoàn lại nếu tôi tự ý hủy đơn hoặc không đến nhận kho đúng hạn</b>.
          </span>
        </label>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmModalOpen(false)}
          >
            Quay lại
          </Button>
          <Button
            disabled={busy || countdown.expired || !acceptedNoRefund}
            onClick={() => void pay()}
          >
            {busy ? 'Đang chuyển sang VNPay…' : 'Xác nhận & Chuyển sang VNPay'}
          </Button>
        </div>
      </div>
    </Modal>
    <Modal size="3xl" open={receiptOpen} onClose={() => setReceiptOpen(false)} title={payment && bookingDepositAccepted(payment) ? 'Biên lai thanh toán' : 'Chi tiết giao dịch'}>
      {payment && <div className="w-full min-w-0"><ReservationReceipt payment={payment} reservationCode={reservation.reservationCode} /></div>}
    </Modal>
    <Modal open={returnFailure !== null} onClose={() => setReturnFailure(null)} title="Kết quả thanh toán VNPay">
      <div className="space-y-4">
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{returnFailure}</div>
        <p className="text-sm text-stone-600">Nếu tài khoản đã bị trừ tiền, hãy giữ lại thông báo ngân hàng, lịch sử giao dịch hoặc ảnh biên nhận để đối soát.</p>
        <Button className="w-full" onClick={() => setReturnFailure(null)}>Đã hiểu</Button>
      </div>
    </Modal>
  </>
}
