import { formatCustomerDateTime } from '../../i18n/customerDate'
import { userFacingError } from '../../presentation/userFacingError'
import { useEffect, useState } from "react"
import { Button, Card, Modal, Table, Thead, Tbody, Th, Td, Tr } from "../../components/ui"
import { formatVndAmount } from "../../i18n/currency"
import {
  loadCustomerPaymentHistory,
  paymentCategories,
  isRenewalHistoryEntry,
  customerHistoryStatusLabel,
  canViewCustomerHistoryReceipt,
  type HistoryEntry,
} from "../../services/customerPaymentHistory"
import ReservationReceipt from "./ReservationReceipt"
import RenewalReceipt from "./RenewalReceipt"
import ReturnSettlementReceipt from "./ReturnSettlementReceipt"
import { formatHistoryPaymentMethod } from "./paymentLabels"
import {
  paymentRecordLabel,
} from "./paymentPresentation"
import { paymentMethodLabel } from "./paymentLabels"

export function paymentHistoryTimestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Chưa ghi nhận"
  return formatCustomerDateTime(new Date(value))
}

function ShortCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const compact = value.startsWith("SIMULATED-") ? value.slice(10, 18) : value.slice(0, 8)
  return <span className="group inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-stone-700" title={value}>
    #{compact}
    <button type="button" className="rounded p-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label={`Sao chép mã ${value}`} title={copied ? "Đã sao chép" : "Sao chép mã đầy đủ"} onClick={async () => {
      try { await navigator.clipboard.writeText(value); setCopied(true) }
      catch { setCopied(false) }
    }}>{copied ? "Đã chép" : "Sao chép"}</button>
  </span>
}

const historyAmount = (amount: number | null) =>
  amount === null ? "Chưa có thông tin số tiền" : formatVndAmount(amount)

const reservationHistoryWarning = "Chưa tải được đầy đủ lịch sử thanh toán đơn giữ kho."

export function visibleCustomerPaymentWarnings(warnings: readonly string[]) {
  return warnings.filter(warning => warning !== reservationHistoryWarning)
}

export function PaymentHistoryDossier({
  entry,
  onOpenRentals,
}: {
  entry: HistoryEntry
  onOpenRentals?: (rentalId: string) => void
}) {
  if (entry.renewalId) {
    return <button
      type="button"
      className="block text-left font-semibold text-stone-900 hover:underline"
      onClick={() => { if (entry.rentalId) onOpenRentals?.(entry.rentalId) }}
      disabled={!entry.rentalId || !onOpenRentals}
    >
      {entry.reference}
    </button>
  }
  return entry.reference.startsWith("RSV-")
    ? <span className="whitespace-nowrap font-semibold text-stone-900">{entry.reference}</span>
    : <span className="font-semibold text-stone-900">{entry.reference}</span>
}

export default function CustomerPaymentHistory({ onOpenRentals }: { onOpenRentals?: (rentalId: string) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const selectedReceipt = entries.find(entry => entry.id === receiptId)
  const receipt = !loading && !error && selectedReceipt && canViewCustomerHistoryReceipt(selectedReceipt) ? selectedReceipt : null
  const [search, setSearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'payments' | 'settlement'>('all')
  const visibleEntries = entries.filter(entry => {
    const settlement = ['damage', 'refund', 'returnOffset'].includes(entry.category) || ['REFUND', 'DAMAGE_FEE'].includes(entry.reservationPayment?.purpose || '')
    const matchesFilter = historyFilter === 'all' || (historyFilter === 'settlement' ? settlement : !settlement)
    const query = search.trim().toLocaleLowerCase('vi-VN')
    const matchesSearch = !query || [entry.paymentReference, entry.reservationPayment?.transactionReference, entry.reference, entry.unitCode, entry.facilityName].some(value => value?.toLocaleLowerCase('vi-VN').includes(query))
    return matchesFilter && matchesSearch
  })
  useEffect(() => {
    let disposed = false
    setLoading(true)
    setEntries([])
    setError(null)
    setWarnings([])
    void loadCustomerPaymentHistory()
      .then((result) => {
        if (!disposed) {
          setEntries(result.entries)
          setWarnings(result.warnings)
        }
      })
      .catch((failure) => {
        if (!disposed)
          setError(
            userFacingError(failure, "Không thể tải lịch sử thanh toán."),
          )
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [revision])
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const statusLabel = (entry: HistoryEntry) => {
    if (isRenewalHistoryEntry(entry)) return customerHistoryStatusLabel(entry)
    if (entry.reservationPayment && entry.category === "deposit") return paymentRecordLabel(entry.reservationPayment)
    if (entry.status === "SETTLED") return "Đã đối trừ"
    if (entry.status === "REFUNDED") return "Đã hoàn"
    if (entry.status === "PAID") return "Thanh toán thành công"
    if (["FAILED", "CANCELLED"].includes(entry.status)) return "Thanh toán thất bại"
    return "Chưa ghi nhận tiền"
  }
  return (
    <div className="fade-in space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Lịch sử thanh toán</h1>
        <p className="text-sm text-stone-500">Theo dõi các khoản thanh toán, gia hạn và hoàn tiền của bạn.</p>
      </header>
      {loading && (
        <p role="status" className="text-sm text-stone-500">
          Đang tải giao dịch…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {visibleCustomerPaymentWarnings(warnings).map((warning) => (
        <p
          key={warning}
          role="alert"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          {warning} Tải lại trang để thử lại.
        </p>
      ))}
      <Card className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-stone-900">Giao dịch</h2>
            {!loading && !error && <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">{visibleEntries.length} giao dịch</span>}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="min-w-0 flex-1 sm:w-72">
              <span className="sr-only">Tìm giao dịch</span>
              <input className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600" value={search} onChange={event => setSearch(event.target.value)} placeholder="Mã giao dịch, hồ sơ hoặc gian kho" />
            </label>
            <label>
              <span className="sr-only">Lọc giao dịch</span>
              <select className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700" value={historyFilter} onChange={event => setHistoryFilter(event.target.value as typeof historyFilter)}>
                <option value="all">Tất cả</option><option value="payments">Lịch sử thanh toán</option><option value="settlement">Quyết toán</option>
              </select>
            </label>
          </div>
        </div>
        <Table tableClassName="manager-payment-table min-w-[950px] table-fixed [&_th]:bg-[#f6f4f1] [&_th]:normal-case [&_th]:tracking-normal [&_th]:py-2.5 [&_td]:py-2.5">
          <colgroup><col className="w-[13%]" /><col className="w-[18%]" /><col className="w-[20%]" /><col className="w-[10%]" /><col className="w-[12%]" /><col className="w-[19%]" /><col className="w-[8%]" /></colgroup>
          <Thead>
            <tr>
              <Th>Mã Giao Dịch</Th>
              <Th>Hồ Sơ</Th>
              <Th>Nội Dung</Th>
              <Th>Phương Thức</Th>
              <Th className="text-right">Số Tiền</Th>
              <Th className="text-center">Trạng Thái</Th>
              <Th className="text-center">Biên lai</Th>
            </tr>
          </Thead>
          <Tbody>
            {visibleEntries.map((entry) => (
              <Tr key={entry.id}>
                <Td>
                  <ShortCode value={entry.paymentReference || entry.reservationPayment?.transactionReference || entry.id} />
                  <p className="mt-0.5 text-[10px] text-stone-400">{paymentHistoryTimestamp(entry.timestamp)}</p>
                </Td>
                <Td><PaymentHistoryDossier entry={entry} onOpenRentals={onOpenRentals} /></Td>
                <Td>{paymentCategories[entry.category]}</Td>
                <Td><span className="whitespace-nowrap text-xs text-stone-600">{formatHistoryPaymentMethod(entry.method)}</span></Td>
                <Td className="text-right"><b className="whitespace-nowrap text-stone-950">{historyAmount(entry.amount)}</b>
                  {isRenewalHistoryEntry(entry) && entry.statusSource === 'RENEWAL_PROJECTION' && entry.refundedAmount != null && entry.refundedAmount > 0 && <p className="mt-1 text-xs text-stone-500">Đã hoàn: {historyAmount(entry.refundedAmount)}</p>}
                </Td>
                <Td>
                  <div className="space-y-2">
                    <span className={"inline-flex rounded-full px-3 py-1.5 text-xs font-semibold " + (entry.status === "REFUNDED" ? "bg-blue-100 text-blue-700" : ["PAID", "SUCCEEDED", "SETTLED"].includes(entry.status) ? "bg-green-100 text-green-800" : ["FAILED", "CANCELLED"].includes(entry.status) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")}>{statusLabel(entry)}</span>
                    {entry.reservationPayment?.invoiceNumber && <p className="truncate font-mono text-[10px] text-stone-500" title={`Hóa đơn: ${entry.reservationPayment.invoiceNumber} · ${entry.reservationPayment.invoiceStatus || "DRAFT"}`}>Hóa đơn: {entry.reservationPayment.invoiceNumber} · {entry.reservationPayment.invoiceStatus || "DRAFT"}</p>}
                  </div>
                </Td>
                <Td className="text-center">{!loading && !error && canViewCustomerHistoryReceipt(entry) ? <Button variant="ghost" size="sm" className="!h-9 !w-9 !p-2 !text-stone-500 hover:!bg-stone-100" aria-label="Xem biên lai" title="Xem biên lai" onClick={() => setReceiptId(entry.id)}><svg aria-hidden="true" className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></svg></Button> : <span className="text-xs text-stone-400">Chưa có</span>}</Td>
              </Tr>
            ))}
            {!loading && !error && !visibleEntries.length && (
              <tr><td colSpan={7}><p className="py-6 text-center text-sm text-stone-500">Chưa có giao dịch trong nhóm đã chọn.</p></td></tr>
            )}
          </Tbody>
        </Table>
      </Card>
      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceiptId(null)}
        title="Chi tiết giao dịch"
        size={receipt?.returnSettlement ? 'lg' : '2xl'}
        className={receipt?.returnSettlement ? 'flex min-h-0 flex-col !overflow-hidden' : undefined}
        contentClassName={receipt?.returnSettlement ? 'min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5' : undefined}
        customHeader={receipt?.returnSettlement ? <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-5">
          <h2 id="modal-title" className="text-base font-semibold text-stone-900">Chi tiết giao dịch</h2>
          <button type="button" aria-label="Đóng chi tiết giao dịch" onClick={() => setReceiptId(null)} className="px-2.5 py-1 text-xs font-semibold rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-amber-600">
            Đóng
          </button>
        </div> : undefined}
      >
        {receipt &&
          (receipt.renewalId ? <RenewalReceipt key={`${receipt.renewalId}:${receipt.id}`} id={receipt.renewalId} paymentId={receipt.id} /> : receipt.reservationPayment ? (
            <ReservationReceipt
              payment={receipt.reservationPayment}
              reservationCode={receipt.reference}
            />
          ) : receipt.returnSettlement ? <ReturnSettlementReceipt entry={receipt} /> : (
            <dl className="space-y-3 text-sm">
              {[
                ["Nội dung", paymentCategories[receipt.category]],
                ["Hồ sơ", receipt.reference],
                ["Mã giao dịch", receipt.id],
                [
                  "Thời điểm ghi nhận",
                  paymentHistoryTimestamp(receipt.timestamp),
                ],
                ["Số tiền", historyAmount(receipt.amount)],
                [
                  "Phương thức",
                  formatHistoryPaymentMethod(receipt.method),
                ],
                ["Trạng thái", statusLabel(receipt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="break-all font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          ))}
      </Modal>
    </div>
  )
}
