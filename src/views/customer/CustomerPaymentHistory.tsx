import { useEffect, useState } from "react"
import { Button, Card, Modal, SectionHeader } from "../../components/ui"
import { formatVndAmount as formatVnd } from "../../i18n/currency"
import {
  loadCustomerPaymentHistory,
  paymentCategories,
  type HistoryEntry,
  type PaymentCategory,
} from "../../services/customerPaymentHistory"
import ReservationReceipt from "./ReservationReceipt"
import {
  bookingDepositAccepted,
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
  const [revision, setRevision] = useState(0)
  const [receipt, setReceipt] = useState<HistoryEntry | null>(null)
  const [category, setCategory] = useState<PaymentCategory | "all">("all")
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
  }, [revision])
  const filtered = entries.filter(
    (entry) => category === "all" || entry.category === category,
  )
  const statusLabel = (entry: HistoryEntry) =>
    entry.reservationPayment && entry.category === "deposit"
      ? paymentRecordLabel(entry.reservationPayment)
      : entry.status === "PAID"
        ? "Đã ghi nhận thanh toán"
        : ["FAILED", "CANCELLED"].includes(entry.status)
          ? "Thanh toán không thành công"
          : "Chưa ghi nhận tiền"
  return (
    <div className="fade-in space-y-4">
      <SectionHeader
        title="Lịch sử thanh toán và biên lai"
        action={
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            Làm mới
          </Button>
        }
      />
      <Card className="p-4">
        <p className="text-xs text-stone-500">Cọc đã được đơn xác nhận</p>
        <p className="mt-1 text-2xl font-extrabold text-stone-950">
          {formatVnd(
            entries
              .filter(
                (entry) =>
                  entry.reservationPayment &&
                  bookingDepositAccepted(entry.reservationPayment),
              )
              .reduce((sum, entry) => sum + (entry.amount ?? 0), 0),
          )}
        </p>
      </Card>
      <Card className="p-4">
        <label htmlFor="payment-category" className="block text-sm font-medium">
          Loại thanh toán
        </label>
        <select
          id="payment-category"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as PaymentCategory | "all")
          }
          className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-2 sm:max-w-md"
        >
          <option value="all">Tất cả thanh toán</option>
          {Object.entries(paymentCategories).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-stone-500">
          Hiển thị từ mới đến cũ theo thời điểm giao dịch. Có {filtered.length}{" "}
          giao dịch phù hợp.
        </p>
      </Card>
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
          {warning} Nhấn làm mới để thử lại.
        </p>
      ))}
      {!loading && !error && !filtered.length && (
        <Card className="p-8 text-center text-stone-500">
          Chưa có giao dịch phù hợp bộ lọc.
        </Card>
      )}
      {filtered.map((entry) => (
        <Card
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-4 p-5"
        >
          <div>
            <p className="text-sm font-bold">
              {entry.reference} · {paymentCategories[entry.category]}
            </p>
            <p className="mt-1 break-all text-xs text-stone-500">
              Mã giao dịch: {entry.id}
            </p>
            <p className="text-xs text-stone-500">
              {paymentHistoryTimestamp(entry.timestamp)}
            </p>
          </div>
          <div className="space-y-2 text-right">
            <p className="font-bold">{historyAmount(entry.amount)}</p>
            <p
              className={`text-xs font-bold ${
                entry.status === "PAID" ? "text-emerald-700" : "text-amber-800"
              }`}
            >
              {statusLabel(entry)}
            </p>
            {entry.status === "PAID" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReceipt(entry)}
              >
                {entry.reservationPayment ? "Xem biên lai" : "Xem giao dịch"}
              </Button>
            )}
          </div>
        </Card>
      ))}
      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Chi tiết thanh toán"
      >
        {receipt &&
          (receipt.reservationPayment ? (
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
