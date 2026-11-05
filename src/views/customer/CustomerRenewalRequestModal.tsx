import { useEffect, useState, type ReactNode } from "react"
import { Button, Modal } from "../../components/ui"
import {
  createRenewalVnpayPaymentIntent,
  getRenewalOptions,
  listRenewals,
  quoteRenewal,
  renewalPaymentRedirectUrl,
  reviseRenewal,
  submitRenewal,
} from "../../services/renewalApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { newRenewalIdempotencyKey, useRenewalCommand } from "../../hooks/useRenewalCommand"
import type { RenewalApiQuote, RenewalApiRecord } from "../../types/renewalApi"
import ApiReadState from "../rental-api/ApiReadState"
import RenewalRiskNotice from "../rental-api/RenewalRiskNotice"
import {
  rentalDate,
  rentalError,
  rentalMoney,
} from "../rental-api/presentation"

function isOpenRenewalConflict(error: unknown): boolean {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes("Rental already has an open or unresolved legacy renewal") ||
    msg.includes("open or unresolved legacy renewal") ||
    msg.includes("already has an open renewal") ||
    msg.includes("open renewal") ||
    msg.includes("đã có yêu cầu gia hạn")
  )
}

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
  onNavigateToRenewals?: (renewalId?: string) => void
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
  const isConflictOpenRenewal = isOpenRenewalConflict(command.error)
  const [existingRenewalId, setExistingRenewalId] = useState<string>()

  useEffect(() => {
    if (!isConflictOpenRenewal) return
    let active = true
    void listRenewals("customer", { rentalId, size: 5 })
      .then((res) => {
        if (!active) return
        const openItem = res.data.find(
          (r) =>
            r.status !== "cancelled" &&
            r.status !== "rejected" &&
            r.status !== "completed" &&
            r.status !== "payment_expired",
        )
        if (openItem) {
          setExistingRenewalId(openItem.id)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isConflictOpenRenewal, rentalId])
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
                    Ngày do hệ thống xác định. Chưa quá hạn: nối tiếp kỳ cũ. Đã quá hạn: bắt đầu từ ngày hoàn tất ký, ngày trong báo giá là dự kiến.
                  </p>
                  </div>
                </div>
              </div>
              <input
                id="renewal-start-date"
                type="text"
                className="mt-1 h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px]"
                value={quote ? rentalDate(quote.extensionStartDate) : ""}
                placeholder="dd/mm/yyyy"
                readOnly
                aria-describedby="renewal-start-policy"
              />
            </div>
          </div>
          {quote && <div className="mt-3 px-2"><QuoteLine label="Thời gian gia hạn" value={<>{rentalDate(quote.extensionStartDate)} – {rentalDate(quote.newEndDate)}</>} /></div>}
          </section>
        )}
        {options.data?.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 space-y-2">
            <p className="font-semibold text-sm text-amber-900">
              Cơ sở hiện chưa có gói thuê còn hiệu lực để gia hạn.
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Kho này hiện chưa có gói ưu đãi gia hạn trực tuyến nào còn hiệu lực. Vui lòng liên hệ hotline cơ sở hoặc nhắn tin qua mục <b>Hỗ trợ</b> để được gán gói gia hạn phù hợp.
            </p>
          </div>
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
          <section aria-label="Phương thức gia hạn" className="border-t border-stone-200 pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase text-stone-500">Quy trình gia hạn trực tuyến</h3>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">✓</span>
                <p className="font-semibold text-sm text-emerald-900">Gia hạn tự động qua thanh toán trực tuyến</p>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Quy trình gia hạn được thực hiện 100% online. Bạn không cần đến cơ sở hay ký lại hợp đồng giấy. Ngay sau khi thanh toán thành công qua VNPay, hệ thống sẽ tự động cập nhật thời hạn thuê mới đến ngày <b>{rentalDate(quote.newEndDate)}</b>.
              </p>
            </div>
            <details className="mt-3 text-sm text-stone-500">
              <summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-amber-600">Xem điều khoản gia hạn trực tuyến</summary>
              <div className="mt-2 space-y-2 leading-5 text-xs text-stone-600 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p>• Tiền gia hạn được tính theo biểu giá ưu đãi đã niêm yết của cơ sở.</p>
                <p>• Tiền cọc bảo đảm kho hiện tại được giữ nguyên để bảo đảm cho kỳ thuê mới mà không cần thu lại.</p>
                <p>• Kỳ thuê mới có hiệu lực liên tục tiếp nối kỳ thuê hiện tại sau khi xác nhận thanh toán.</p>
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
        {/* Khi có yêu cầu gia hạn đang mở: Hiển thị Thẻ thông báo trực quan, bỏ các nút thừa */}
        {isConflictOpenRenewal ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-stone-900 shadow-sm" role="alert">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-800">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1 space-y-1.5">
                <h4 className="text-base font-semibold text-amber-950">
                  Gian kho này đã có yêu cầu gia hạn đang mở
                </h4>
                <p className="text-sm leading-relaxed text-amber-900">
                  Hợp đồng thuê này đã được tạo một yêu cầu gia hạn trước đó và hiện đang chờ hoàn tất thanh toán. Để tránh phát sinh chi phí trùng lặp, hệ thống không cho phép tạo thêm yêu cầu mới.
                </p>
                <p className="text-xs font-medium text-amber-800">
                  💡 Bạn có thể đi đến yêu cầu gia hạn đã có để thanh toán online ngay hoặc kiểm tra thông tin.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-amber-200/80 pt-3.5">
              <Button
                variant="outline"
                className="bg-white hover:bg-stone-50"
                onClick={onClose}
              >
                Đóng
              </Button>
              {onNavigateToRenewals && (
                <Button
                  variant="primary"
                  className="!border-amber-600 !bg-amber-600 !text-white hover:!bg-amber-700 shadow-sm font-medium"
                  onClick={() => onNavigateToRenewals(existingRenewalId)}
                >
                  {existingRenewalId ? "Mở yêu cầu & Thanh toán ngay" : "Mở tab Yêu cầu gia hạn"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {command.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900 flex items-start gap-2.5" role="alert">
                <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="flex-1">
                  <p className="font-medium">{rentalError(command.error)}</p>
                </div>
              </div>
            ) : null}

            {command.uncertain && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 flex items-start gap-2.5">
                <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="flex-1">
                  Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại cùng yêu cầu, không đóng hộp thoại hoặc gửi yêu cầu mới.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <Button variant="outline" disabled={locked} onClick={onClose}>
                Hủy
              </Button>
              {command.conflict ? (
                <Button variant="primary" onClick={() => onSuccess()}>
                  Tải lại hồ sơ
                </Button>
              ) : (
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
                      async (created) => {
                        const renewalRecord = created as RenewalApiRecord
                        if (renewalRecord?.id) {
                          try {
                            const paymentIntent = await createRenewalVnpayPaymentIntent(
                              renewalRecord.id,
                              newRenewalIdempotencyKey(),
                            )
                            if (paymentIntent?.paymentUrl) {
                              const redirectUrl = renewalPaymentRedirectUrl(paymentIntent)
                              if (typeof window !== "undefined" && window.location) {
                                window.location.assign(redirectUrl)
                                return
                              }
                            }
                          } catch (payErr) {
                            console.warn("Could not initiate instant VNPay payment:", payErr)
                          }
                        }
                        onSuccess(renewalRecord)
                      },
                    )
                  }}
                >
                  {command.busy
                    ? "Đang gửi…"
                    : command.uncertain
                      ? "Thử lại cùng yêu cầu"
                      : "Xác nhận & Đi đến thanh toán"}
                </Button>
              )}
            </div>
          </>
        )}
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
