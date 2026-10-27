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
    ...(settlement.setupEarlyExit ? [['Phí chấm dứt sớm một lần', settlement.earlyTerminationFee ?? null]] as [string, number | null][] : []),
    ['Phí quá hạn trong quyết toán', overdue],
    ['Phí hư hỏng', settlement.damageFee],
    ['Phí vệ sinh', settlement.cleaningFee],
    ['Phí mất đồ', settlement.lostItemFee],
    ['Công nợ khác', otherDebt],
  ]
  return <section className="space-y-5 text-sm text-stone-800" aria-label="Biên lai quyết toán trả kho">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><h3 className="text-base font-semibold leading-6 text-stone-900">Biên lai quyết toán trả kho</h3>
        <p className="mt-1 break-words text-xs leading-5 text-stone-500 [overflow-wrap:anywhere]">{entry.reference}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{offset ? 'Đã đối trừ' : refund ? 'Đã hoàn' : 'Đã thu'}</span>
    </div>
    {fee?.requiresReconciliation && <p role="alert" className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-900">
      Hồ sơ cũ chưa đối soát phí quá hạn. Biên lai này chỉ xác nhận số tiền đã thu hoặc hoàn, vui lòng liên hệ cơ sở để kiểm tra khoản còn thiếu.
    </p>}
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-4">
      <div><p className="text-xs font-medium text-stone-600">{offset ? settlement.setupEarlyExit ? 'Đã đối trừ quyết toán' : 'Đã khấu trừ cọc' : refund ? 'Đã hoàn khách hàng' : 'Đã thu bổ sung'}</p>
        <p className="mt-1 break-words text-2xl font-bold leading-8 tracking-tight text-stone-900 tabular-nums">{amount(entry.amount)}</p></div>
      <div><p className="text-[11px] text-stone-500">Phương thức</p><p className="mt-1 text-xs font-medium text-stone-700">{entry.method || 'Chưa có thông tin phương thức'}</p></div>
    </div>
    <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className="min-w-0" aria-label="Chi tiết quyết toán">
        <h4 className="mb-3 text-xs font-semibold text-stone-900">Chi tiết quyết toán</h4>
        <dl className="overflow-hidden rounded-xl border border-stone-200">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 bg-stone-50 px-3 py-3 text-xs"><dt className="text-stone-600">Cọc bảo đảm</dt><dd className="text-right font-semibold tabular-nums">{amount(settlement.depositAmount)}</dd></div>
          {settlement.setupEarlyExit && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-stone-100 px-3 py-2.5 text-xs"><dt className="leading-5 text-stone-600">Tiền thuê thực thu được quyết toán</dt><dd className="text-right font-medium leading-5 tabular-nums">{amount(settlement.rentalRefundCredit ?? null)}</dd></div>}
          {rows.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-stone-100 px-3 py-2.5 text-xs">
            <dt className="leading-5 text-stone-600">{label}</dt><dd className={`text-right leading-5 tabular-nums ${value === 0 ? 'text-stone-400' : 'font-medium text-stone-900'}`}>{amount(value)}</dd>
          </div>)}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-stone-200 bg-stone-50 px-3 py-3 text-xs font-semibold"><dt>Tổng khấu trừ</dt><dd className="text-right tabular-nums">{amount(settlement.totalDeductions)}</dd></div>
        </dl>
        {fee && !fee.requiresReconciliation && <p className="mt-3 text-[11px] leading-5 text-stone-500">
          Phí quá hạn được tính cho {fee.overdueDays} ngày đến thời điểm kiểm kê{fee.calculatedAt ? ` lúc ${new Date(fee.calculatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}, đã trừ phần phí quá hạn thanh toán trước đó.
        </p>}
      </section>
      <section className="min-w-0" aria-label="Thông tin biên nhận">
        <h4 className="mb-3 text-xs font-semibold text-stone-900">Thông tin biên nhận</h4>
        <dl className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/50 p-3">
          <div><dt className="text-[11px] leading-5 text-stone-500">Mã biên nhận hoặc giao dịch</dt><dd className="mt-1 break-all text-xs font-medium leading-5 text-stone-700">{entry.id}</dd></div>
          <div className="border-t border-stone-200/70 pt-3"><dt className="text-[11px] text-stone-500">Ghi nhận lúc</dt><dd className="mt-1 text-xs leading-5 text-stone-700">{entry.timestamp ? new Date(entry.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có thông tin'}</dd></div>
        </dl>
        {settlement.receiptFileId && <div className="mt-4 border-t border-stone-200 pt-4">
          <EvidenceDownload id={settlement.receiptFileId} previewLabel="Xem chứng từ" label="Tải biên lai" />
        </div>}
      </section>
    </div>
  </section>
}
