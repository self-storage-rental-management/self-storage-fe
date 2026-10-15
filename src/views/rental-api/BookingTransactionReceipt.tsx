import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getCustomerReservation } from '../../services/customerReservationApi'
import ReservationReceipt from '../customer/ReservationReceipt'
import ApiReadState from './ApiReadState'

export default function BookingTransactionReceipt({ reservationId, paymentId }: { reservationId: string; paymentId: string }) {
  const read = useRentalApiResource(`booking-receipt:${reservationId}:${paymentId}`, async () => {
    const detail = await getCustomerReservation(reservationId)
    const payment = detail.payments.find(item => item.paymentId === paymentId)
    if (!payment) throw new Error('Chưa tìm thấy biên lai của giao dịch này.')
    return { payment, code: detail.reservation.reservationCode }
  })
  return read.data ? <ReservationReceipt payment={read.data.payment} reservationCode={read.data.code} /> : <ApiReadState {...read} retry={read.refresh} />
}
