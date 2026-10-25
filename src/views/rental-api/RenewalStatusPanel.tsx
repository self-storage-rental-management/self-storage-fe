import { Button } from '../../components/ui'
import { renewalInvoiceLabels, renewalRefundLabels, renewalTransactionLabels, type RenewalStatusSummary } from '../../types/renewalStatus'
import { rentalDate, rentalMoney } from './presentation'

export default function RenewalStatusPanel({ summary, onReceipt }: { summary: RenewalStatusSummary; onReceipt: (id: string) => void }) {
  const i = summary.invoice
  const known = !['UNKNOWN', 'NOT_ISSUED'].includes(i.status)
  return <section className="space-y-4 rounded-xl border border-stone-200 p-4" aria-label="Khoản phải thu và giao dịch gia hạn">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">Khoản phải thu gia hạn</h4>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${i.status === 'PAID' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{renewalInvoiceLabels[i.status]}</span>
    </div>
    {known ? <>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {([
          ['Tổng trước giảm', i.totalBeforeAdjustments], ['Giảm giá', i.discountAmount],
          ['Điều chỉnh giảm đã ghi nhận', i.adjustmentAmount], ['Tổng sau điều chỉnh', i.totalAfterAdjustments],
          ['Đã thanh toán và phân bổ (sau hoàn tiền)', i.paidAmount], ['Còn phải thanh toán', i.outstandingAmount],
          ['Đến hạn cần thanh toán', i.dueNowAmount], ['Trong đó đã quá hạn thanh toán', i.overdueAmount],
        ] as const).map(([label, amount]) => <div key={label}><dt className="text-stone-500">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{rentalMoney(amount, i.currency)}</dd></div>)}
      </dl>
      <p className="text-xs text-stone-500">Tiền thuê gia hạn trả trước được trừ vào số còn phải thanh toán khi ký. Thanh toán đủ tiền không đồng nghĩa đã hoàn tất ký gia hạn.</p>
    </> : <p className="text-sm text-stone-600">{i.status === 'NOT_ISSUED' ? 'Báo giá chưa được ghi thành khoản phải thu. Xem điều khoản đã chấp nhận bên dưới.' : 'Chưa đủ dữ liệu để xác minh tổng phải thu và tiền đã phân bổ. Không dùng giao dịch chưa đối soát để xác nhận đã thanh toán đủ.'}</p>}
    {!['NONE', 'UNKNOWN'].includes(i.refundStatus) && <p className="text-sm text-stone-700">Hoàn tiền: {renewalRefundLabels[i.refundStatus]}{i.refundedAmount !== null && i.refundedAmount > 0 ? `, ${rentalMoney(i.refundedAmount, i.currency)}` : ''}</p>}
    <div className="space-y-2 border-t border-stone-200 pt-3">
      <h5 className="text-sm font-semibold">Từng giao dịch thanh toán</h5>
      {summary.transactions.length === 0 ? <p className="text-sm text-stone-500">Chưa có giao dịch thanh toán.</p> : [...summary.transactions].reverse().map(t => <article key={t.paymentId} className="space-y-2 border-b border-stone-100 py-3 last:border-0">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-medium">{rentalMoney(t.amount, t.currency)}</p>
          <span className={t.status === 'SUCCEEDED' ? 'text-emerald-800' : t.status === 'FAILED' ? 'text-red-800' : 'text-stone-700'}>{renewalTransactionLabels[t.status]}</span>
        </div>
        <p className="break-all text-xs text-stone-500">{t.reference || t.paymentId}</p>
        {t.deadlineExpired && t.status === 'RECONCILIATION_REQUIRED' && <p className="text-xs text-amber-800">Hạn thanh toán đã qua, đang đối soát kết quả. Chưa xác nhận giao dịch thất bại hoặc chưa thu tiền.</p>}
        {t.paidAt && <p className="text-xs text-stone-500">Thời điểm nhận tiền: {rentalDate(t.paidAt)}</p>}
        {t.refundedAmount > 0 && <p className="text-xs text-stone-600">Đã hoàn: {rentalMoney(t.refundedAmount, t.currency)}</p>}
        {t.receiptAvailable && <Button size="sm" variant="outline" onClick={() => onReceipt(t.paymentId)}>Xem biên lai khoản thu</Button>}
      </article>)}
    </div>
  </section>
}
