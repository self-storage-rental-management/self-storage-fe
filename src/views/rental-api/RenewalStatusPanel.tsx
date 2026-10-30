import { Button } from '../../components/ui'
import { renewalInvoiceLabels, renewalRefundLabels, renewalTransactionLabels, type RenewalStatusSummary } from '../../types/renewalStatus'
import { rentalDate, rentalMoney } from './presentation'

export default function RenewalStatusPanel({ summary, onReceipt }: { summary: RenewalStatusSummary; onReceipt: (id: string) => void }) {
  const i = summary.invoice
  const known = !['UNKNOWN', 'NOT_ISSUED'].includes(i.status)
  return <section className="space-y-4 rounded-xl border border-stone-200 p-4 sm:p-5" aria-label="Khoản phải thu và giao dịch gia hạn">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">Thanh toán gia hạn</h4>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${i.status === 'PAID' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{i.status === 'PARTIALLY_PAID' ? 'Đã thanh toán cọc gia hạn' : renewalInvoiceLabels[i.status]}</span>
    </div>
    {known ? <>
      <dl className="grid gap-4 border-b border-stone-100 pb-4 text-sm sm:grid-cols-3">
        {([
          ['Tổng phải trả', i.totalAfterAdjustments], ['Đã thanh toán', i.paidAmount],
          ['Còn lại', i.outstandingAmount],
        ] as const).map(([label, amount]) => <div key={label} className="flex items-baseline justify-between gap-3 sm:block"><dt className="text-stone-600">{label}</dt><dd className={`mt-1 font-semibold tabular-nums sm:text-lg ${label === 'Còn lại' ? 'text-amber-800' : 'text-stone-900'}`}>{rentalMoney(amount, i.currency)}</dd></div>)}
      </dl>
      <details className="text-xs text-stone-600">
        <summary className="w-fit cursor-pointer rounded py-1 font-medium text-stone-700 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">Chi tiết tính tiền</summary>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {([
            ['Tổng trước giảm', i.totalBeforeAdjustments], ['Giảm giá', i.discountAmount],
          ] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-medium tabular-nums text-stone-900">{rentalMoney(amount, i.currency)}</dd></div>)}
        </dl>
      </details>
    </> : <p className="text-sm text-stone-600">{i.status === 'NOT_ISSUED' ? 'Báo giá chưa được ghi thành khoản phải thu. Xem điều khoản đã chấp nhận bên dưới.' : 'Chưa đủ dữ liệu để xác minh tổng phải thu và tiền đã phân bổ. Không dùng giao dịch chưa đối soát để xác nhận đã thanh toán đủ.'}</p>}
    {!['NONE', 'UNKNOWN'].includes(i.refundStatus) && <p className="text-sm text-stone-700">Hoàn tiền: {renewalRefundLabels[i.refundStatus]}{i.refundedAmount !== null && i.refundedAmount > 0 ? `, ${rentalMoney(i.refundedAmount, i.currency)}` : ''}</p>}
    <div className="space-y-2 border-t border-stone-200 pt-3">
      <h5 className="text-sm font-semibold">Giao dịch <span className="font-normal text-stone-500">({summary.transactions.length})</span></h5>
      {summary.transactions.length === 0 ? <p className="text-sm text-stone-500">Chưa có giao dịch thanh toán.</p> : [...summary.transactions].reverse().map(t => <article key={t.paymentId} className="border-b border-stone-100 py-3 last:border-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <p className="font-semibold tabular-nums text-stone-900">{rentalMoney(t.amount, t.currency)}</p>
              <span className={`text-xs ${t.status === 'SUCCEEDED' ? 'text-emerald-800' : t.status === 'FAILED' ? 'text-red-800' : 'text-stone-700'}`}>{renewalTransactionLabels[t.status]}</span>
            </div>
            {t.paidAt && <p className="mt-1 text-xs text-stone-600">Nhận tiền: {rentalDate(t.paidAt)}</p>}
          </div>
          {t.receiptAvailable && <Button size="sm" variant="outline" onClick={() => onReceipt(t.paymentId)}>Xem biên lai</Button>}
        </div>
        {t.deadlineExpired && t.status === 'RECONCILIATION_REQUIRED' && <p className="mt-2 text-xs text-amber-800">Hạn thanh toán đã qua, đang đối soát kết quả. Chưa xác nhận giao dịch thất bại hoặc chưa thu tiền.</p>}
        {t.refundedAmount > 0 && <p className="mt-2 text-xs text-stone-600">Đã hoàn: {rentalMoney(t.refundedAmount, t.currency)}</p>}
        <details className="mt-2 text-xs text-stone-600"><summary className="w-fit cursor-pointer rounded py-1 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">Mã giao dịch</summary><p className="mt-1 break-all">{t.reference || t.paymentId}</p></details>
      </article>)}
    </div>
  </section>
}
