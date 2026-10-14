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

const historyAmount = (amount: number | null) =>
  amount === null ? "Chưa có thông tin số tiền" : formatVnd(amount)

export default function CustomerPaymentHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [receipt, setReceipt] = useState<HistoryEntry | null>(null)
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
        ? "Đã xác nhận"
        : ["FAILED", "CANCELLED"].includes(entry.status)
          ? "Thanh toán không thành công"
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
          <p className="text-xs text-stone-500">Tổng giao dịch</p>
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
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Mã Giao Dịch</Th>
              <Th>Hồ Sơ</Th>
              <Th>Nội Dung</Th>
              <Th>Phương Thức</Th>
              <Th>Số Tiền</Th>
              <Th>Trạng Thái</Th>
            </tr>
          </Thead>
          <Tbody>
            {entries.map((entry) => (
              <Tr key={entry.id}>
                <Td>
                  <span className="break-all text-xs text-stone-600">{entry.reservationPayment?.transactionReference || entry.id}</span>
                  <p className="mt-0.5 text-[10px] text-stone-400">{paymentHistoryTimestamp(entry.timestamp)}</p>
                </Td>
                <Td><b className="break-all">{entry.reference}</b></Td>
                <Td>{paymentCategories[entry.category]}</Td>
                <Td><span className="text-xs text-stone-500">{entry.method || "Chưa có thông tin"}</span></Td>
                <Td><b className="whitespace-nowrap text-stone-950">{historyAmount(entry.amount)}</b></Td>
                <Td>
                  <div className="space-y-2">
                    <span className={"inline-flex rounded px-2.5 py-1 text-xs font-bold " + (entry.status === "PAID" ? "bg-emerald-700 text-white" : ["FAILED", "CANCELLED"].includes(entry.status) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")}>{statusLabel(entry)}</span>
                    {entry.status === "PAID" && <div><Button variant="outline" size="sm" onClick={() => setReceipt(entry)}>Xem biên lai</Button></div>}
                  </div>
                </Td>
              </Tr>
            ))}
            {!loading && !error && !entries.length && (
              <tr><td colSpan={6}><p className="py-6 text-center text-sm text-stone-500">Chưa có giao dịch nào.</p></td></tr>
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
