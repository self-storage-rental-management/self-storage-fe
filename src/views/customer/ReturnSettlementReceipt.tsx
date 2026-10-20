import type { HistoryEntry } from '../../services/customerPaymentHistory'
import { formatVndAmount } from '../../i18n/currency'
import { EvidenceDownload } from '../rental-support-integration/EvidenceControls'

const amount = (value: number | null) => value === null ? 'Chưa có thông tin' : formatVndAmount(value)

export default function ReturnSettlementReceipt({ entry }: { entry: HistoryEntry }) {
  const settlement = entry.returnSettlement
  if (!settlement) return null
  const fee = settlement.overdueSettlement
  const overdue = fee?.settlementAmount ?? settlement.overdueFee
  const postedOverdue = fee?.settlementAmount != null && settlement.overdueFee != null
    ? Math.max(0, fee.settlementAmount - settlement.overdueFee) : 0
  const otherDebt = settlement.outstandingFee === null ? null : Math.max(0, settlement.outstandingFee - postedOverdue)
  const refund = entry.status === 'REFUNDED'
  const offset = entry.status === 'SETTLED'
  const rows: [string, number | null][] = [
    ['Cọc bảo đảm', settlement.depositAmount],
    ['Phí quá hạn trong quyết toán', overdue],
    ['Phí hư hỏng', settlement.damageFee],
    ['Phí vệ sinh', settlement.cleaningFee],
    ['Phí mất đồ', settlement.lostItemFee],
    ['Công nợ khác', otherDebt],
    ['Tổng khấu trừ', settlement.totalDeductions],
  ]
  return <section className="space-y-4 text-sm" aria-label="Biên lai quyết toán trả kho">
    <div>
      <h3 className="font-semibold">Biên lai quyết toán trả kho</h3>
      <p className="mt-1 break-words text-stone-600">{entry.reference}</p>
    </div>
    {fee?.requiresReconciliation && <p role="alert" className="rounded-lg bg-orange-50 p-3 text-orange-900">
      Hồ sơ cũ chưa đối soát phí quá hạn. Biên lai này chỉ xác nhận số tiền đã thu hoặc hoàn, vui lòng liên hệ cơ sở để kiểm tra khoản còn thiếu.
    </p>}
    <dl className="space-y-2">
      {rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4">
        <dt className="text-stone-600">{label}</dt><dd className="shrink-0 font-medium">{amount(value)}</dd>
      </div>)}
    </dl>
    {fee && !fee.requiresReconciliation && <p className="text-xs text-stone-500">
      Phí quá hạn được tính cho {fee.overdueDays} ngày đến thời điểm kiểm kê{fee.calculatedAt ? ` lúc ${new Date(fee.calculatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}, đã trừ phần phí quá hạn thanh toán trước đó.
    </p>}
    <div className="rounded-lg bg-stone-50 p-4">
      <p className="text-stone-600">{offset ? 'Đã khấu trừ cọc' : refund ? 'Đã hoàn khách hàng' : 'Đã thu bổ sung'}</p>
      <p className="mt-1 text-xl font-bold">{amount(entry.amount)}</p>
      <p className="mt-1">{entry.method || 'Chưa có thông tin phương thức'}</p>
    </div>
    <dl className="space-y-2">
      <div><dt className="text-stone-500">Mã biên nhận hoặc giao dịch</dt><dd className="break-all font-mono">{entry.id}</dd></div>
      <div><dt className="text-stone-500">Ghi nhận lúc</dt><dd>{entry.timestamp ? new Date(entry.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có thông tin'}</dd></div>
      <div><dt className="text-stone-500">Trạng thái</dt><dd className="font-semibold">{offset ? 'Đã đối trừ' : refund ? 'Đã hoàn' : 'Đã thu'}</dd></div>
    </dl>
    {settlement.receiptFileId && <div className="border-t border-stone-200 pt-4">
      <EvidenceDownload id={settlement.receiptFileId} previewLabel="Xem chứng từ" label="Tải biên lai" />
    </div>}
  </section>
}
