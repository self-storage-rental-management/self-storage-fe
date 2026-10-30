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
import { paymentCountdown } from './reservationPresentation'
import ReservationReceipt from './ReservationReceipt'
import ReservationQuoteSummary from './ReservationQuoteSummary'
import { bookingDepositAccepted } from './paymentPresentation'

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
  reservation: CustomerReservation
  facilityName: string
  unitTypeName: string
  paymentExpiresAt?: string | null
  now: number
  onMessage: (message: string) => void
  onRefresh: () => Promise<void>
}

export default function CustomerReservationPayment({ reservation, facilityName, unitTypeName, paymentExpiresAt, now, onMessage, onRefresh }: Props) {
  const [payment, setPayment] = useState<ReservationPaymentResult | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [returnFailure, setReturnFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const paymentKey = useRef<string | null>(null)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

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
          onMessage('VNPay đã xác nhận thanh toán phí giữ chỗ thành công. Biên lai đã được lưu trong đơn.')
        } else if (value.paymentStatus === 'PAID') {
          setReturnFailure('VNPay đã ghi nhận giao dịch, nhưng trạng thái đơn hiện không xác nhận cọc. Vui lòng kiểm tra và đối soát trước khi thanh toán thêm.')
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
  useEffect(() => {
    if (reservation.status !== 'AWAITING_PAYMENT' || !countdown.expired) return
    let disposed = false
    const refreshStatus = async () => { if (!disposed) await onRefreshRef.current() }
    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 1000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [reservation.status, countdown.expired])

  const pay = async () => {
    if (busy || countdown.expired || reservation.status !== 'AWAITING_PAYMENT' || !snapshot) return
    setBusy(true)
    try {
      paymentKey.current ??= crypto.randomUUID()
      const result = await createVnpayPaymentUrl(reservation.id, paymentKey.current)
      window.location.assign(result.paymentUrl)
    } catch (error) {
      onMessage(userFacingError(error, 'Không thể thanh toán phí giữ chỗ.'))
    } finally {
      setBusy(false)
    }
  }

  if (!snapshot) return <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{MISSING_RESERVATION_SNAPSHOT}</p>
  return <>
    {reservation.status === 'AWAITING_PAYMENT' && <div className="rounded-lg bg-red-700 p-3 text-right text-xs text-white">
      <p className="font-bold">Thời gian thanh toán phí giữ chỗ còn lại</p>
      <p role="timer" className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p>
      <p className="mt-1">{countdown.expired ? 'Đã hết thời hạn. Đang chờ cập nhật trạng thái đơn.' : 'Vui lòng hoàn tất thanh toán trước khi hết thời hạn.'}</p>
      <Button className="mt-2" size="sm" disabled={busy || countdown.expired} onClick={() => setPayOpen(true)}>Thanh toán phí giữ chỗ</Button>
    </div>}
    {payment?.paymentStatus === 'PAID' && <Button variant="outline" size="sm" onClick={() => setReceiptOpen(true)}>{bookingDepositAccepted(payment) ? 'Xem biên lai thanh toán' : 'Xem giao dịch cần đối soát'}</Button>}
    <Modal size="2xl" open={payOpen} onClose={() => { if (!busy) setPayOpen(false) }} title="Thanh toán phí giữ chỗ">
      <div className="space-y-4">
        <div className="grid gap-1 text-sm"><p>Đơn giữ kho: <b>{reservation.reservationCode}</b></p><p>Cơ sở: <b>{facilityName}</b></p><p>Loại kho: <b>{unitTypeName}</b></p><p>{reservation.rentalPeriodConfirmed ? 'Kỳ thuê đã chốt:' : 'Kỳ thuê dự kiến sau setup:'} <b>{snapshot.startDate.split('-').reverse().join('/')} đến {snapshot.endDate.split('-').reverse().join('/')}</b></p></div>
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
          <p className="mt-2 text-xs leading-5 text-blue-800">{reservation.rentalPeriodConfirmed ? 'Kỳ thuê đã được chốt theo ngày bàn giao thực tế và số ngày setup miễn phí đã lưu.' : 'Ngày bắt đầu tính tiền bằng ngày bàn giao thực tế cộng số ngày setup miễn phí đã chốt. Trước bàn giao, các mốc trên chỉ là dự kiến.'}</p>
        </section>
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Số tiền cần thanh toán ngay</p>
          <p className="mt-1 text-3xl font-extrabold text-stone-950">{formatVnd(snapshot.reservationDepositAmount)}</p>
          <p className="mt-1 text-xs text-stone-600">Phí giữ chỗ được trừ vào tổng nghĩa vụ tài chính đã gồm tiền thuê và cọc đảm bảo kho.</p>
        </div>
        <div className="rounded-lg bg-red-700 p-3 text-center text-white"><p className="text-xs font-bold uppercase tracking-wide">Thời gian thanh toán còn lại</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p></div>
        <p className="text-sm text-stone-600">Bạn sẽ được chuyển sang VNPay Sandbox. Sau khi hoàn tất, VNPay sẽ đưa bạn trở lại StorageHub và cập nhật biên lai tự động.</p>
        <Button className="w-full" disabled={busy || countdown.expired} onClick={() => void pay()}>{busy ? 'Đang chuyển sang VNPay…' : `Thanh toán qua VNPay ${formatVnd(snapshot.reservationDepositAmount)}`}</Button>
      </div>
    </Modal>
    <Modal size="3xl" open={receiptOpen} onClose={() => setReceiptOpen(false)} title={payment && bookingDepositAccepted(payment) ? 'Biên lai thanh toán' : 'Chi tiết giao dịch'}>
      {payment && <div className="grid items-start gap-5 lg:grid-cols-2"><ReservationReceipt payment={payment} reservationCode={reservation.reservationCode} /><ReservationQuoteSummary quote={{ ...snapshot, facilityName, unitTypeName }} needsReview={false} context="reservation" /></div>}
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
