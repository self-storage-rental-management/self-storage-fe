import { useEffect, useRef, useState } from 'react'
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
          onMessage(error instanceof Error ? error.message : 'Không thể tải biên lai.')
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
        if (status === 'success' && value.paymentStatus === 'PAID') {
          setReturnFailure(null)
          setReceiptOpen(true)
          onMessage('VNPay đã xác nhận thanh toán cọc thành công. Biên lai đã được lưu trong đơn.')
        } else {
          setReturnFailure(value.paymentStatus === 'PENDING' || value.paymentStatus === 'NOT_RECEIVED'
            ? `StorageHub chưa nhận được kết quả cuối cùng từ VNPay (mã ${code}). Hệ thống sẽ tiếp tục đối soát; không thanh toán lại nếu tài khoản đã bị trừ tiền.`
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
  useEffect(() => {
    if (reservation.status !== 'AWAITING_PAYMENT' || !countdown.expired) return
    let disposed = false
    const refreshStatus = async () => { if (!disposed) await onRefreshRef.current() }
    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 1000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [reservation.status, countdown.expired])

  const pay = async () => {
    if (busy || countdown.expired || reservation.status !== 'AWAITING_PAYMENT') return
    setBusy(true)
    try {
      paymentKey.current ??= crypto.randomUUID()
      const result = await createVnpayPaymentUrl(reservation.id, paymentKey.current)
      window.location.assign(result.paymentUrl)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Không thể thanh toán cọc.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    {reservation.status === 'AWAITING_PAYMENT' && <div className="rounded-lg bg-red-700 p-3 text-right text-xs text-white">
      <p className="font-bold">Thời gian thanh toán cọc còn lại</p>
      <p role="timer" className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p>
      <p className="mt-1">{countdown.expired ? 'Đã hết thời hạn. Đang chờ cập nhật trạng thái đơn.' : 'Vui lòng hoàn tất thanh toán trước khi hết thời hạn.'}</p>
      <Button className="mt-2" size="sm" disabled={busy || countdown.expired} onClick={() => setPayOpen(true)}>Thanh toán cọc</Button>
    </div>}
    {payment?.paymentStatus === 'PAID' && <Button variant="outline" size="sm" onClick={() => setReceiptOpen(true)}>Xem biên lai thanh toán</Button>}
    <Modal open={payOpen} onClose={() => { if (!busy) setPayOpen(false) }} title="Thanh toán cọc giữ chỗ">
      <div className="space-y-4">
        <div className="grid gap-1 text-sm"><p>Đơn giữ kho: <b>{reservation.reservationCode}</b></p><p>Cơ sở: <b>{facilityName}</b></p><p>Loại kho: <b>{unitTypeName}</b></p><p>Kỳ thuê: <b>{reservation.startDate} → {reservation.endDate}</b></p></div>
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Số tiền cần thanh toán ngay</p>
          <p className="mt-1 text-3xl font-extrabold text-stone-950">{formatVnd(reservation.reservationDepositAmount)}</p>
          <p className="mt-1 text-xs text-stone-600">Cọc giữ chỗ được khấu trừ vào tiền thuê của kỳ này.</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3 text-sm space-y-1"><div className="flex justify-between gap-4"><span>Tiền thuê còn lại</span><b>{formatVnd(reservation.remainingRentalAmount)}</b></div><div className="flex justify-between gap-4"><span>Tiền đảm bảo kho</span><b>{formatVnd(reservation.securityDepositAmount)}</b></div><div className="flex justify-between gap-4 border-t border-stone-200 pt-2"><span>Tổng thanh toán khi nhận kho</span><b>{formatVnd(reservation.dueAtCheckIn)}</b></div><p className="pt-1 text-xs text-stone-500">Các khoản trên chưa thu trong bước này.</p></div>
        <div className="rounded-lg bg-red-700 p-3 text-center text-white"><p className="text-xs font-bold uppercase tracking-wide">Thời gian thanh toán còn lại</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{countdown.text}</p></div>
        <p className="text-sm text-stone-600">Bạn sẽ được chuyển sang VNPay Sandbox. Sau khi hoàn tất, VNPay sẽ đưa bạn trở lại StorageHub và cập nhật biên lai tự động.</p>
        <Button className="w-full" disabled={busy || countdown.expired} onClick={() => void pay()}>{busy ? 'Đang chuyển sang VNPay…' : `Thanh toán qua VNPay ${formatVnd(reservation.reservationDepositAmount)}`}</Button>
      </div>
    </Modal>
    <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Biên lai thanh toán">
      {payment && <ReservationReceipt payment={payment} reservationCode={reservation.reservationCode} />}
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
