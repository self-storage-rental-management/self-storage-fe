import { useEffect, useState } from 'react'
import { Button, Card, Modal, SectionHeader } from '../../components/ui'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import { ApiClientError } from '../../services/apiClient'
import { listReservationPayments, listCustomerReservations, type ReservationPaymentResult } from '../../services/customerReservationApi'
import ReservationReceipt from './ReservationReceipt'
import { bookingDepositAccepted, paymentRecordLabel } from './paymentPresentation'

interface PaymentEntry { reservationCode: string; payment: ReservationPaymentResult }

export function paymentHistoryTimestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa ghi nhận'
  return new Date(value).toLocaleString('vi-VN')
}

export default function CustomerPaymentHistory() {
  const [entries, setEntries] = useState<PaymentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [receipt, setReceipt] = useState<PaymentEntry | null>(null)
  useEffect(() => {
    let disposed = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const reservations = []
        let page = 0
        let totalPages = 1
        do {
          const result = await listCustomerReservations(undefined, page, 50)
          reservations.push(...result.data)
          totalPages = result.pagination.totalPages
          page++
        } while (page < totalPages && !disposed)
        const results = await Promise.all(reservations.map(async reservation => {
          try {
            const payments = await listReservationPayments(reservation.id)
            return payments.map(payment => ({ reservationCode: reservation.reservationCode, payment }))
          } catch (failure) {
            if (failure instanceof ApiClientError && failure.status === 404) return []
            throw failure
          }
        }))
        if (!disposed) setEntries(results.flat())
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : 'Không thể tải lịch sử thanh toán.')
      } finally { if (!disposed) setLoading(false) }
    }
    void load()
    return () => { disposed = true }
  }, [revision])
  return <div className="fade-in space-y-4">
    <SectionHeader title="Lịch Sử Thanh Toán & Biên Lai" action={<Button variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Làm mới</Button>} />
    <Card className="p-4"><p className="text-xs text-stone-500">Cọc đã được đơn xác nhận</p><p className="mt-1 text-2xl font-extrabold text-stone-950">{formatVnd(entries.filter(entry => bookingDepositAccepted(entry.payment)).reduce((sum, entry) => sum + entry.payment.amount, 0))}</p></Card>
    {loading && <p role="status" className="text-sm text-stone-500">Đang tải giao dịch…</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!loading && !error && !entries.length && <Card className="p-8 text-center text-stone-500">Chưa có giao dịch nào.</Card>}
    {entries.map(entry => <Card key={entry.payment.paymentId} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-sm font-bold">{entry.reservationCode} · {entry.payment.purpose === 'RENTAL_BALANCE' ? 'Thanh toán phần còn lại khi nhận kho' : 'Cọc giữ chỗ'}</p><p className="mt-1 break-all text-xs text-stone-500">Mã giao dịch: {entry.payment.paymentId}</p><p className="text-xs text-stone-500">{paymentHistoryTimestamp(entry.payment.processedAt)}</p></div><div className="space-y-2 text-right"><p className="font-bold">{formatVnd(entry.payment.amount)}</p><p className={`text-xs font-bold ${entry.payment.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-800'}`}>{entry.payment.purpose === 'RENTAL_BALANCE' && entry.payment.paymentStatus === 'PAID' ? 'Đã ghi nhận thanh toán nhận kho' : paymentRecordLabel(entry.payment)}</p>{entry.payment.paymentStatus === 'PAID' && <Button variant="outline" size="sm" onClick={() => setReceipt(entry)}>{entry.payment.purpose === 'RENTAL_BALANCE' || bookingDepositAccepted(entry.payment) ? 'Xem biên lai' : 'Xem giao dịch'}</Button>}</div></Card>)}
    <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title={receipt?.payment.purpose === 'RENTAL_BALANCE' ? 'Biên lai thanh toán nhận kho' : receipt && bookingDepositAccepted(receipt.payment) ? 'Biên lai thanh toán' : 'Chi tiết giao dịch'}>{receipt && <ReservationReceipt payment={receipt.payment} reservationCode={receipt.reservationCode} />}</Modal>
  </div>
}
