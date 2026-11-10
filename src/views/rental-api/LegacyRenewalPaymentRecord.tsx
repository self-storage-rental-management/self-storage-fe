import type { StoragePayment } from '../../types/storageHub'
import { LEGACY_RENEWAL_HISTORY_NOTICE, legacyRenewalMoney } from '../../domain/legacyRenewal'
import { rentalDate } from './presentation'

/** A local historical record is not a verified receipt or an issued invoice. */
export default function LegacyRenewalPaymentRecord({ payment }: { payment: StoragePayment }) {
  return <article className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
    <p className="font-semibold">Giao dịch gia hạn đã lưu</p>
    <p className="text-xs text-stone-600">{LEGACY_RENEWAL_HISTORY_NOTICE}</p>
    <dl className="grid gap-2 sm:grid-cols-2">
      <div><dt className="text-stone-500">Mã bản ghi</dt><dd>{payment.id}</dd></div>
      <div><dt className="text-stone-500">Số tiền đã lưu</dt><dd>{legacyRenewalMoney(payment.amount)}</dd></div>
      <div><dt className="text-stone-500">Trạng thái gốc chưa đối soát</dt><dd>{payment.status}</dd></div>
      <div><dt className="text-stone-500">Thời điểm đã lưu</dt><dd>{rentalDate(payment.paidAt || payment.receivedAt)}</dd></div>
      <div><dt className="text-stone-500">Mã chứng từ cũ</dt><dd>{payment.invoiceNumber || '-'}</dd></div>
      <div><dt className="text-stone-500">Tham chiếu đã lưu</dt><dd>{payment.transactionReference || '-'}</dd></div>
    </dl>
  </article>
}
