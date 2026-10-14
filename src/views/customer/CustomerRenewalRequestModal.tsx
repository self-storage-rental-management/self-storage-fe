import { useEffect, useState, type ReactNode } from "react"
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
import RenewalRiskNotice from "../rental-api/RenewalRiskNotice"
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
  useEffect(() => {
    let current = true
    if (!code) {
      setQuoteBusy(false)
      return () => {
        current = false
      }
    }

    setQuote(undefined)
    setQuoteError(undefined)
    setConfirmed(false)
    setQuoteBusy(true)
    void quoteRenewal(rentalId, code)
      .then((nextQuote) => {
        if (current) {
          setQuote(nextQuote)
          setNow(Date.now())
        }
      })
      .catch((error) => {
        if (current) setQuoteError(error)
      })
      .finally(() => {
        if (current) setQuoteBusy(false)
      })

    return () => {
      current = false
    }
  }, [code, rentalId])
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
        <RenewalRiskNotice rentalId={rentalId} />
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
                  {o.pricingPackageName?.trim() || `Gói thuê ${o.rentalMonths} tháng`}
                </option>
              ))}
            </select>
          </label>
        )}
        {options.data?.length === 0 && (
          <p>Không có dữ liệu</p>
        )}
        {quoteBusy ? <p role="status">Đang lấy báo giá…</p> : null}
        {quoteError ? <p role="alert">{rentalError(quoteError)}</p> : null}
        {quote && (
          <>
          <section aria-label="Chi tiết báo giá gia hạn" className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="space-y-3">
              <div className="space-y-2 border-b border-dashed border-slate-200 pb-3">
                <QuoteLine label="Kỳ gia hạn" value={<>{rentalDate(quote.extensionStartDate)} → {rentalDate(quote.newEndDate)}</>} />
                <QuoteLine label="Đơn giá / tháng" value={rentalMoney(quote.monthlyPrice, quote.currency)} />
              </div>
              <div className="space-y-2 border-b border-dashed border-slate-200 pb-3">
                <QuoteLine label="Tạm tính" value={rentalMoney(quote.subtotal, quote.currency)} />
                {quote.discountAmount > 0 && (
                  <QuoteLine
                    label="Giảm giá"
                    value={`- ${rentalMoney(quote.discountAmount, quote.currency)} (${Math.round(quote.discountRate * 100)}%)`}
                    valueClassName="text-emerald-700"
                  />
                )}
                <QuoteLine label="Tổng sau giảm" value={rentalMoney(quote.totalAfterDiscount, quote.currency)} emphasis />
              </div>
              <div className="space-y-2">
                <QuoteLine label="Cọc gia hạn trả trước" value={rentalMoney(quote.renewalDepositAmount, quote.currency)} valueClassName="text-amber-800" emphasis />
                <QuoteLine label="Tiền thuê còn lại khi ký" value={rentalMoney(quote.remainingRentalAmount, quote.currency)} />
              </div>
            </div>
          </section>
          <p className="flex items-center gap-1.5 text-xs text-stone-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="1.7"/><path d="M12 7v5l3 2" strokeWidth="1.7" strokeLinecap="round"/></svg>
            Báo giá có hiệu lực đến: {rentalDate(quote.expiresAt)}
          </p>
            {expired && !command.uncertain && (
              <p role="alert" className="text-red-700">
                Báo giá đã hết hạn, vui lòng chọn lại gói gia hạn để cập nhật báo giá.
              </p>
            )}
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-600"
                checked={confirmed}
                disabled={locked}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi xác nhận kỳ thuê, giá và điều khoản trên.
            </label>
          </>
        )}
        <label className="block">
          Ghi chú
          <textarea
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            rows={2}
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
          className="disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100 sm:min-w-44"
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

function QuoteLine({
  label,
  value,
  emphasis = false,
  valueClassName = "",
}: {
  label: string
  value: ReactNode
  emphasis?: boolean
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm sm:text-[15px]">
      <span className="text-slate-600">{label}</span>
      <span className={`text-right text-slate-900 ${emphasis ? "text-base font-semibold" : "font-medium"} ${valueClassName}`}>
        {value}
      </span>
    </div>
  )
}
