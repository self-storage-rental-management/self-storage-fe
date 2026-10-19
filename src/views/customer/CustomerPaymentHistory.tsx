import { useEffect, useState } from "react"
import { Button, Card, Modal, SectionHeader, Table, Thead, Tbody, Th, Td, Tr } from "../../components/ui"
import { formatVndAmount as formatVnd } from "../../i18n/currency"
import {
  loadCustomerPaymentHistory,
  paymentCategories,
  type HistoryEntry,
} from "../../services/customerPaymentHistory"
import ReservationReceipt from "./ReservationReceipt"
import RenewalReceipt from "./RenewalReceipt"
import {
  paymentRecordLabel,
} from "./paymentPresentation"

export function paymentHistoryTimestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Chưa ghi nhận"
  return new Date(value).toLocaleString("vi-VN")
}

function ShortCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const compact = value.startsWith("SIMULATED-") ? value.slice(10, 18) : value.slice(0, 8)
  return <span className="group inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-stone-700" title={value}>
    #{compact}
    <button type="button" className="rounded p-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label={`Sao chép mã ${value}`} title={copied ? "Đã sao chép" : "Sao chép mã đầy đủ"} onClick={async () => {
      try { await navigator.clipboard.writeText(value); setCopied(true) }
      catch { setCopied(false) }
    }}>{copied ? "✓" : "⧉"}</button>
  </span>
}

const historyAmount = (amount: number | null) =>
  amount === null ? "Chưa có thông tin số tiền" : formatVnd(amount)

export default function CustomerPaymentHistory({ onOpenRentals }: { onOpenRentals?: (rentalId: string) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [receipt, setReceipt] = useState<HistoryEntry | null>(null)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'payments' | 'settlement'>('all')
  const visibleEntries = entries.filter(entry => {
    const settlement = entry.category === 'damage' || ['REFUND', 'DAMAGE_FEE'].includes(entry.reservationPayment?.purpose || '')
    return historyFilter === 'all' || (historyFilter === 'settlement' ? settlement : !settlement)
  })
  useEffect(() => {
    let disposed = false
    setLoading(true)
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
            failure instanceof Error
              ? failure.message
              : "Không thể tải lịch sử thanh toán.",
          )
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [])
  const totalPaid = (records: HistoryEntry[]) => {
    const paid = records.filter((entry) => entry.status === "PAID")
    return paid.some((entry) => entry.amount === null)
      ? null
      : paid.reduce((sum, entry) => sum + (entry.amount ?? 0), 0)
  }
  const statusLabel = (entry: HistoryEntry) =>
    entry.reservationPayment && entry.category === "deposit"
      ? paymentRecordLabel(entry.reservationPayment)
      : entry.status === "PAID"
        ? "Thanh toán thành công"
        : ["FAILED", "CANCELLED"].includes(entry.status)
          ? "Thanh toán thất bại"
          : "Chưa ghi nhận tiền"
  return (
    <div className="fade-in space-y-4">
      <SectionHeader
        title="Lịch Sử Thanh Toán & Quyết Toán"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-stone-500">Đã ghi nhận thanh toán</p>
          <p className="mt-1 text-2xl font-extrabold text-stone-950">{loading ? "…" : error ? "—" : historyAmount(totalPaid(entries))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-stone-500">Thanh toán gia hạn</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{loading ? "…" : error ? "—" : historyAmount(totalPaid(entries.filter((entry) => entry.category === "renewal" || entry.category === "renewalSigning")))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-stone-500">Số giao dịch</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{loading ? "…" : error ? "—" : entries.length}</p>
        </Card>
      </div>
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
      {warnings.map((warning) => (
        <p
          key={warning}
          role="alert"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          {warning} Tải lại trang để thử lại.
        </p>
      ))}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc giao dịch">
        <Button variant={historyFilter === 'all' ? 'primary' : 'outline'} onClick={() => setHistoryFilter('all')}>Tất cả</Button>
        <Button variant={historyFilter === 'payments' ? 'primary' : 'outline'} onClick={() => setHistoryFilter('payments')}>Lịch sử thanh toán</Button>
        <Button variant={historyFilter === 'settlement' ? 'primary' : 'outline'} onClick={() => setHistoryFilter('settlement')}>Quyết toán</Button>
      </div>
      <Card>
        <Table tableClassName="min-w-[1000px]">
          <Thead>
            <tr>
              <Th>Mã Giao Dịch</Th>
              <Th>Hồ Sơ</Th>
              <Th>Nội Dung</Th>
              <Th>Phương Thức</Th>
              <Th className="text-right">Số Tiền</Th>
              <Th>Trạng Thái</Th>
              <Th>Thao tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {visibleEntries.map((entry) => (
              <Tr key={entry.id}>
                <Td>
                  <ShortCode value={entry.reservationPayment?.transactionReference || entry.id} />
                  <p className="mt-0.5 text-[10px] text-stone-400">{paymentHistoryTimestamp(entry.timestamp)}</p>
                </Td>
                <Td>{entry.renewalId ? <>
                  <button type="button" className="block text-left font-semibold text-stone-900 hover:underline" onClick={() => { if (entry.rentalId) onOpenRentals?.(entry.rentalId) }} disabled={!entry.rentalId || !onOpenRentals}>{entry.unitCode || "Hồ sơ gia hạn"}</button>
                  {entry.facilityName && <span className="block text-xs text-stone-500">{entry.facilityName}</span>}
                  <ShortCode value={entry.renewalId} />
                </> : entry.reference.startsWith("RSV-") ? <span className="whitespace-nowrap font-semibold text-stone-900">{entry.reference}</span> : <span className="font-semibold text-stone-900">{entry.reference}</span>}</Td>
                <Td>{paymentCategories[entry.category]}</Td>
                <Td><span className="whitespace-nowrap text-xs text-stone-500">{entry.method || "—"}</span></Td>
                <Td className="text-right"><b className="whitespace-nowrap text-stone-950">{historyAmount(entry.amount)}</b></Td>
                <Td>
                  <div className="space-y-2">
                    <span className={"inline-flex rounded px-2.5 py-1 text-xs font-bold " + (entry.status === "PAID" ? "bg-emerald-700 text-white" : ["FAILED", "CANCELLED"].includes(entry.status) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")}>{statusLabel(entry)}</span>
                  </div>
                </Td>
                <Td>{entry.status === "PAID" && <Button variant="outline" size="sm" onClick={() => setReceipt(entry)}>Xem biên lai</Button>}</Td>
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
        onClose={() => setReceipt(null)}
        title="Chi tiết thanh toán"
      >
        {receipt &&
          (receipt.renewalId ? <RenewalReceipt key={`${receipt.renewalId}:${receipt.id}`} id={receipt.renewalId} paymentId={receipt.id} /> : receipt.reservationPayment ? (
            <ReservationReceipt
              payment={receipt.reservationPayment}
              reservationCode={receipt.reference}
            />
          ) : (
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
                  "Phương thức thanh toán",
                  receipt.method || "Chưa có thông tin",
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
