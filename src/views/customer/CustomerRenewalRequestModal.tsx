import { useEffect, useState } from "react"
import { Button, Modal } from "../../components/ui"
import {
  getRenewalOptions,
  quoteRenewal,
  reviseRenewal,
  submitRenewal,
} from "../../services/renewalApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand } from "../../hooks/useRenewalCommand"
import type { RenewalApiQuote, RenewalApiRecord } from "../../types/renewalApi"
import ApiReadState from "../rental-api/ApiReadState"
import {
  rentalDate,
  rentalError,
  rentalMoney,
} from "../rental-api/presentation"

export default function CustomerRenewalRequestModal({
  actorId,
  rentalId,
  revision,
  onClose,
  onSuccess,
}: {
  actorId: string
  rentalId: string
  revision?: RenewalApiRecord
  onClose: () => void
  onSuccess: () => void
}) {
  const options = useRentalApiResource(`${actorId}:${rentalId}:options`, () =>
    getRenewalOptions(rentalId),
  )
  const [code, setCode] = useState("")
  const [note, setNote] = useState("")
  const [quote, setQuote] = useState<RenewalApiQuote>()
  const [quoteError, setQuoteError] = useState<unknown>()
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [now, setNow] = useState(Date.now())
  const command = useRenewalCommand()
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const expired = quote ? now >= Date.parse(quote.expiresAt) : false
  const locked = command.busy || command.uncertain || quoteBusy
  return (
    <Modal
      open
      title={revision ? "Xác nhận điều khoản gia hạn mới" : "Yêu cầu gia hạn"}
      onClose={() => {
        if (!locked) onClose()
      }}
      size="lg"
    >
      <div className="space-y-4">
        <ApiReadState {...options} retry={options.refresh} />
        {options.data && (
          <label className="block">
            Gói gia hạn
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
              value={code}
              disabled={locked}
              onChange={(e) => {
                setCode(e.target.value)
                setQuote(undefined)
                setConfirmed(false)
              }}
            >
              <option value="">Chọn gói gia hạn</option>
              {options.data.map((o) => (
                <option key={o.pricingPackageCode} value={o.pricingPackageCode}>
                  {o.rentalMonths} tháng - {o.pricingPackageCode}
                </option>
              ))}
            </select>
          </label>
        )}
        {options.data?.length === 0 && (
          <p>Không có gói gia hạn đủ điều kiện.</p>
        )}
        <Button
          disabled={!code || locked}
          onClick={async () => {
            setQuoteBusy(true)
            setQuoteError(undefined)
            setQuote(undefined)
            setConfirmed(false)
            try {
              setQuote(await quoteRenewal(rentalId, code))
            } catch (e) {
              setQuoteError(e)
            } finally {
              setQuoteBusy(false)
              setNow(Date.now())
            }
          }}
        >
          {quoteBusy ? "Đang lấy báo giá…" : "Lấy báo giá mới"}
        </Button>
        {quoteError ? <p role="alert">{rentalError(quoteError)}</p> : null}
        {quote && (
          <div className="rounded-lg border p-4 space-y-2">
            <p>
              Kỳ gia hạn: {rentalDate(quote.extensionStartDate)} →{" "}
              {rentalDate(quote.newEndDate)}
            </p>
            <p>
              Đơn giá / tháng: {rentalMoney(quote.monthlyPrice, quote.currency)}
            </p>
            <p>Tạm tính: {rentalMoney(quote.subtotal, quote.currency)}</p>
            <p>
              Giảm giá: {rentalMoney(quote.discountAmount, quote.currency)} (tỷ
              lệ {quote.discountRate})
            </p>
            <p>
              Tổng sau giảm:{" "}
              {rentalMoney(quote.totalAfterDiscount, quote.currency)}
            </p>
            <p>
              Cọc gia hạn:{" "}
              {rentalMoney(quote.renewalDepositAmount, quote.currency)}
            </p>
            <p>
              Còn lại:{" "}
              {rentalMoney(quote.remainingRentalAmount, quote.currency)}
            </p>
            <p>Báo giá có hiệu lực đến: {rentalDate(quote.expiresAt)}</p>
            {expired && !command.uncertain && (
              <p role="alert" className="text-red-700">
                Báo giá đã hết hạn, vui lòng lấy báo giá mới.
              </p>
            )}
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={locked}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi xác nhận kỳ thuê, giá và điều khoản trên.
            </label>
          </div>
        )}
        <label className="block">
          Ghi chú
          <textarea
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            maxLength={2000}
            value={note}
            disabled={locked}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {command.error ? (
          <p role="alert">{rentalError(command.error)}</p>
        ) : null}
        {command.uncertain && (
          <p>
            Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại cùng yêu cầu, không đóng hộp thoại hoặc gửi yêu cầu mới.
          </p>
        )}
        <Button
          disabled={
            command.busy ||
            command.conflict ||
            !quote ||
            !confirmed ||
            (!command.uncertain && expired) ||
            (revision !== undefined && revision.version === null)
          }
          onClick={() => {
            if (!quote) return
            const snapshot = {
              rentalId,
              quoteId: quote.id,
              note,
              revisionId: revision?.id,
              version: revision?.version,
            }
            void command.run(
              JSON.stringify(snapshot),
              (key) =>
                revision
                  ? reviseRenewal(
                      revision.id,
                      quote.id,
                      note,
                      revision.version!,
                      key,
                    )
                  : submitRenewal(rentalId, quote.id, note, key),
              onSuccess,
            )
          }}
        >
          {command.busy
            ? "Đang gửi…"
            : command.uncertain
              ? "Thử lại cùng yêu cầu"
              : "Xác nhận và gửi"}
        </Button>
        {command.error && !command.uncertain ? (
          <Button variant="outline" onClick={onSuccess}>
            Đóng và tải lại hồ sơ
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
