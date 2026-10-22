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
  onNavigateToRenewals,
}: {
  actorId: string
  rentalId: string
  revision?: RenewalApiRecord
  onClose: () => void
  onSuccess: () => void
  onNavigateToRenewals?: () => void
}) {
  const options = useRentalApiResource(`${actorId}:${rentalId}:options`, () =>
    getRenewalOptions(rentalId),
  )
  const [code, setCode] = useState("")
  const note = ""
  const [quote, setQuote] = useState<RenewalApiQuote>()
  const [quoteError, setQuoteError] = useState<unknown>()
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const command = useRenewalCommand()
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
              <div className="space-y-2">
                <QuoteLine label="Tạm tính" value={rentalMoney(quote.subtotal, quote.currency)} />
                {quote.discountAmount > 0 && (
                  <QuoteLine
                    label={`Giảm giá (${Math.round(quote.discountRate * 100)}%)`}
                    value={`- ${rentalMoney(quote.discountAmount, quote.currency)}`}
                    valueClassName="text-emerald-700"
                  />
                )}
                <QuoteLine label="Tổng thanh toán" value={rentalMoney(quote.totalAfterDiscount, quote.currency)} emphasis />
                <QuoteLine label="Cọc gia hạn trả trước" value={rentalMoney(quote.renewalDepositAmount, quote.currency)} />
                <QuoteLine label="Tiền thuê còn lại khi ký" value={rentalMoney(quote.remainingRentalAmount, quote.currency)} />
              </div>
            </div>
          </section>
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onSuccess}>
              Đóng và tải lại hồ sơ
            </Button>
            {onNavigateToRenewals && (
              <Button
                variant="primary"
                onClick={onNavigateToRenewals}
              >
                Mở tab Yêu cầu gia hạn
              </Button>
            )}
          </div>
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
