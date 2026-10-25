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
  const [fullPayment, setFullPayment] = useState(true)
  const [startDate, setStartDate] = useState("")
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
    void quoteRenewal(rentalId, code, fullPayment, startDate || undefined)
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
  }, [code, rentalId, fullPayment, startDate])
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

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-sm">
            <span>✓</span> Tiền cọc đảm bảo hợp đồng (Security Deposit)
          </div>
          <p className="mt-1 leading-relaxed text-emerald-900">
            Khoản tiền cọc bạn đã nộp khi bắt đầu hợp đồng thuê ban đầu vẫn được lưu giữ trong hệ thống và sẽ <b>tiếp tục được bảo lưu chuyển tiếp</b> sang kỳ mới. Quý khách <b>không cần nộp thêm tiền cọc</b> khi gia hạn.
          </p>
        </div>

        {options.data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-stone-900">Gói gia hạn</span>
              <select
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
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

            <label className="block">
              <span className="text-sm font-semibold text-stone-900">Ngày bắt đầu gia hạn</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                value={startDate || quote?.extensionStartDate || ""}
                disabled={locked}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setQuote(undefined)
                  setConfirmed(false)
                }}
              />
              <span className="mt-1 block text-[11px] text-stone-500">
                {startDate
                  ? `Bắt đầu từ ${rentalDate(startDate)}.`
                  : "Mặc định nối tiếp sau ngày kết thúc hiện tại."}
              </span>
            </label>
          </div>
        )}
        {options.data?.length === 0 && (
          <p>Không có dữ liệu</p>
        )}

        {options.data && options.data.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-900">Hình thức thanh toán tiền thuê</label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs transition ${
                  fullPayment
                    ? "border-amber-600 bg-amber-50/60 ring-1 ring-amber-600"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="renewalPaymentOption"
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                  checked={fullPayment}
                  disabled={locked}
                  onChange={() => {
                    setFullPayment(true)
                    setQuote(undefined)
                    setConfirmed(false)
                  }}
                />
                <div>
                  <p className="font-bold text-stone-900">Thanh toán 100% (Một lần)</p>
                  <p className="mt-0.5 leading-snug text-stone-600">
                    Thanh toán toàn bộ kỳ thuê qua VNPay, hợp đồng tự động gia hạn thành công ngay.
                  </p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs transition ${
                  !fullPayment
                    ? "border-amber-600 bg-amber-50/60 ring-1 ring-amber-600"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="renewalPaymentOption"
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                  checked={!fullPayment}
                  disabled={locked}
                  onChange={() => {
                    setFullPayment(false)
                    setQuote(undefined)
                    setConfirmed(false)
                  }}
                />
                <div>
                  <p className="font-bold text-stone-900">Chia 2 đợt thanh toán</p>
                  <p className="mt-0.5 leading-snug text-stone-600">
                    Trả trước 20% để giữ chỗ kỳ mới, 80% còn lại thanh toán khi ký phụ lục.
                  </p>
                </div>
              </label>
            </div>
          </div>
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
                <QuoteLine label="Tổng trước giảm" value={rentalMoney(quote.subtotal, quote.currency)} />
                {quote.discountAmount > 0 && (
                  <QuoteLine
                    label={`Giảm giá (${Math.round(quote.discountRate * 100)}%)`}
                    value={`- ${rentalMoney(quote.discountAmount, quote.currency)}`}
                    valueClassName="text-emerald-700"
                  />
                )}
                <QuoteLine label="Tổng sau điều chỉnh" value={rentalMoney(quote.totalAfterDiscount, quote.currency)} emphasis />
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><QuoteLine label="Tiền thuê gia hạn trả trước" value={rentalMoney(quote.renewalDepositAmount, quote.currency)} emphasis valueClassName="text-amber-950" /></div>
                <QuoteLine label="Tiền thuê còn lại khi ký" value={rentalMoney(quote.remainingRentalAmount, quote.currency)} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600">Tiền thuê gia hạn trả trước được trừ vào tiền thuê kỳ mới. Không thu lại cọc bảo đảm kho đang giữ. Phí quá hạn và phí phát sinh hợp lệ, nếu có, được ghi riêng trong bảng kê thanh toán.</p>
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
              (created) => onSuccess(created as RenewalApiRecord),
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
    <div className="flex items-start justify-between gap-4 text-sm sm:text-[15px]">
      <span className="text-slate-600">{label}</span>
      <span className={`text-right text-slate-900 ${emphasis ? "text-base font-semibold" : "font-medium"} ${valueClassName}`}>
        {value}
      </span>
    </div>
  )
}
