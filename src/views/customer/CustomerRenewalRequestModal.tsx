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
  onSuccess: (record?: RenewalApiRecord) => void
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
  const [startInfoOpen, setStartInfoOpen] = useState(false)
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
      <div className="space-y-5 text-[15px] text-stone-900">
        <RenewalRiskNotice rentalId={rentalId} />
        <ApiReadState {...options} retry={options.refresh} />

        {options.data && (
          <section aria-label="Thông tin gia hạn">
          <p className="mb-2 text-xs font-medium uppercase text-stone-500">Thông tin gia hạn</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="flex h-7 items-center text-[15px] font-semibold text-stone-900">Gói gia hạn</span>
              <select
                className="mt-1 h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px]"
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

            <div>
              <div className="flex h-7 items-center gap-1">
                <label htmlFor="renewal-start-date" className="text-[15px] font-semibold text-stone-900">Ngày bắt đầu</label>
                <div className="relative" onMouseEnter={() => setStartInfoOpen(true)} onMouseLeave={() => setStartInfoOpen(false)} onKeyDown={(event) => {
                  if (event.key === "Escape" && startInfoOpen) {
                    event.stopPropagation()
                    setStartInfoOpen(false)
                  }
                }}>
                  <button
                    type="button"
                    aria-label="Giải thích ngày bắt đầu gia hạn"
                    aria-describedby={startInfoOpen ? "renewal-start-policy" : undefined}
                    onFocus={() => setStartInfoOpen(true)}
                    onBlur={() => setStartInfoOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-amber-600"
                  >
                    <svg className="show-icon h-4 w-4" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11v5M12 8h.01" />
                    </svg>
                  </button>
                  <div hidden={!startInfoOpen} className="absolute right-0 top-full z-20 w-64 max-w-[calc(100vw-4rem)] pt-1">
                  <p id="renewal-start-policy" role="tooltip" className="rounded-lg border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-600 shadow-md">
                    Ngày do hệ thống xác định. Chưa quá hạn: nối tiếp kỳ cũ. Đã quá hạn: bắt đầu từ ngày hoàn tất ký; ngày trong báo giá là dự kiến.
                  </p>
                  </div>
                </div>
              </div>
              <input
                id="renewal-start-date"
                type="date"
                className="mt-1 h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px]"
                value={quote?.extensionStartDate || ""}
                readOnly
                aria-describedby="renewal-start-policy"
              />
            </div>
          </div>
          {quote && <div className="mt-3 px-2"><QuoteLine label="Thời gian gia hạn" value={<>{rentalDate(quote.extensionStartDate)} – {rentalDate(quote.newEndDate)}</>} /></div>}
          </section>
        )}
        {options.data?.length === 0 && (
          <p>Cơ sở hiện chưa có gói thuê còn hiệu lực để gia hạn.</p>
        )}

        {quoteBusy ? <p role="status">Đang lấy báo giá…</p> : null}
        {quoteError ? <p role="alert">{rentalError(quoteError)}</p> : null}
        {quote && (
          <>
          <section aria-label="Chi tiết báo giá gia hạn" className="border-t border-stone-200 pt-4">
            <h3 className="mb-3 text-xs font-medium uppercase text-stone-500">Chi tiết chi phí</h3>
            <div className="space-y-3">
                <QuoteLine label="Đơn giá / tháng" value={rentalMoney(quote.monthlyPrice, quote.currency)} />
                <QuoteLine label={`Tạm tính (${quote.rentalMonths} tháng)`} value={rentalMoney(quote.subtotal, quote.currency)} />
                {quote.discountAmount > 0 && (
                  <QuoteLine
                    label={`Ưu đãi gói (${Math.round(quote.discountRate * 100)}%)`}
                    value={`- ${rentalMoney(quote.discountAmount, quote.currency)}`}
                    valueClassName="!text-emerald-700"
                  />
                )}
            </div>
            <div className="mt-4 border-t border-stone-200 pt-4">
              <QuoteLine label="Tổng tiền gia hạn" value={rentalMoney(quote.totalAfterDiscount, quote.currency)} emphasis />
            </div>
          </section>
          <section aria-label="Kế hoạch thanh toán" className="border-t border-stone-200 pt-4">
            <h3 className="mb-3 text-xs font-medium uppercase text-stone-500">Kế hoạch thanh toán</h3>
            <div className="divide-y divide-stone-200 rounded-xl border border-stone-200 px-3">
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="font-medium">Thanh toán trước (20%)</p><p className="mt-1 text-sm text-stone-500">Sau khi gửi yêu cầu</p></div>
                <p className="shrink-0 text-right font-semibold tabular-nums">{rentalMoney(quote.renewalDepositAmount, quote.currency)}</p>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="font-medium">Thanh toán khi ký (80%)</p><p className="mt-1 text-sm text-stone-500">Sau khi trừ khoản trả trước</p></div>
                <p className="shrink-0 text-right font-semibold tabular-nums">{rentalMoney(quote.remainingRentalAmount, quote.currency)}</p>
              </div>
            </div>
          </section>
          <section aria-label="Thời hạn ký hợp đồng" className="px-2">
            <h3 className="flex items-center gap-2 font-medium">
              <svg className="show-icon h-4 w-4 text-stone-500" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6M12 2v3" /></svg>
              Thời hạn ký hợp đồng
            </h3>
            {quote.signingWindowDays != null
              ? <p className="mt-2 text-sm leading-5">Trong vòng <strong className="font-medium">{quote.signingWindowDays} ngày</strong> kể từ khi khoản thanh toán trước được xác nhận.</p>
              : <p className="mt-2 text-sm leading-5">Hạn ký cụ thể được hệ thống xác nhận theo hồ sơ sau khi thanh toán.</p>}
            <p className="mt-1 text-sm text-stone-500">Đổi lịch không gia hạn thời hạn này.</p>
            <details className="mt-2 text-sm text-stone-500">
              <summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-amber-600">Xem điều khoản gia hạn</summary>
              <div className="mt-2 space-y-2 leading-5">
                <p>Khoản trả trước được trừ vào tiền thuê kỳ mới. Không thu lại cọc bảo đảm kho đang giữ.</p>
                <p>Phí quá hạn và phí phát sinh hợp lệ, nếu có, được ghi riêng trong bảng kê thanh toán.</p>
                <p>Hạn ký không vượt quá hạn xử lý quá hạn của hồ sơ. Gia hạn chỉ hoàn tất khi đủ tiền và hợp đồng đã ký được ghi nhận.</p>
              </div>
            </details>
          </section>
            <label className="flex items-start gap-2 border-t border-stone-200 pt-4 text-sm leading-5 text-stone-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-600"
                checked={confirmed}
                disabled={locked}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi đã đọc và đồng ý với giá thuê cùng điều khoản gia hạn.
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
        <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={locked} onClick={onClose}>Hủy</Button>
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
              (created) => onSuccess(created as RenewalApiRecord),
            )
          }}
        >
          {command.busy
            ? "Đang gửi…"
            : command.uncertain
              ? "Thử lại cùng yêu cầu"
              : "Gửi yêu cầu gia hạn"}
        </Button>
        </div>
        {command.error && !command.uncertain ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onSuccess()}>
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
    <div className="flex items-start justify-between gap-4 text-[15px]">
      <span className={emphasis ? "font-semibold text-stone-900" : "text-stone-500"}>{label}</span>
      <span className={`text-right tabular-nums text-stone-900 ${emphasis ? "text-lg font-semibold" : "font-medium"} ${valueClassName}`}>
        {value}
      </span>
    </div>
  )
}
