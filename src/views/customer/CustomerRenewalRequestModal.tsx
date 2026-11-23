import { useEffect, useState, type ReactNode } from "react"
import { Button, Modal } from "../../components/ui"
import {
  getRenewalOptions,
  listRenewals,
  quoteRenewal,
  reviseRenewal,
  submitRenewal,
} from "../../services/renewalApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand } from "../../hooks/useRenewalCommand"
import { ApiClientError } from "../../services/apiClient"
import type { RenewalApiOption, RenewalApiQuote, RenewalApiRecord } from "../../types/renewalApi"
import ApiReadState from "../rental-api/ApiReadState"
import RenewalRiskNotice from "../rental-api/RenewalRiskNotice"
import {
  rentalDate,
  rentalError,
  rentalMoney,
} from "../rental-api/presentation"

const discountPercent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 2 })

export function renewalOptionLabel(option: RenewalApiOption) {
  let name = option.pricingPackageName?.trim().replace(/^gói\s+thuê(?=\s|\p{P}|$)/iu, "Gói gia hạn")
    || `Gói gia hạn ${option.rentalMonths} tháng`
  if (option.rentalMonths && !/tháng|năm/i.test(name) && /^gói/i.test(name)) {
    name = `${name} (${option.rentalMonths} tháng)`
  }
  return option.discountRate == null
    ? name
    : `${name}, giảm ${discountPercent.format(option.discountRate)}`
}

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
  onBrowseUnits,
}: {
  actorId: string
  rentalId: string
  revision?: RenewalApiRecord
  onClose: () => void
  onSuccess: (record?: RenewalApiRecord) => void
  onNavigateToRenewals?: (renewalId?: string) => void
  onBrowseUnits?: () => void
}) {
  const options = useRentalApiResource(`${actorId}:${rentalId}:options`, () =>
    getRenewalOptions(rentalId),
  )
  const [code, setCode] = useState("")
  const note = ""
  const [quote, setQuote] = useState<RenewalApiQuote>()
  const [quoteRequest, setQuoteRequest] = useState(0)
  const [expiredQuoteId, setExpiredQuoteId] = useState<string>()
  const [quoteError, setQuoteError] = useState<unknown>()
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
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
  }, [code, rentalId, quoteRequest])

  useEffect(() => {
    if (!quote?.expiresAt) return
    const delay = Math.max(0, Date.parse(quote.expiresAt) - Date.now())
    const timer = window.setTimeout(() => setExpiredQuoteId(quote.id), delay)
    return () => window.clearTimeout(timer)
  }, [quote])

  const locked = command.busy || command.uncertain || quoteBusy
  const errorDetails = command.error instanceof ApiClientError ? command.error.details : null
  const expiredOnServer = command.conflict && errorDetails !== null && typeof errorDetails === "object"
    && "reason" in errorDetails && errorDetails.reason === "RENEWAL_QUOTE_EXPIRED"
  const quoteExpired = !!quote && (expiredOnServer || expiredQuoteId === quote.id
    || (!!quote.expiresAt && Date.parse(quote.expiresAt) <= Date.now()))
  const bookingError = quoteError ?? command.error
  const bookingDetails = bookingError instanceof ApiClientError ? bookingError.details : null
  const bookingConflict = bookingDetails !== null && typeof bookingDetails === "object"
    && "reason" in bookingDetails && bookingDetails.reason === "RENEWAL_BOOKING_CONFLICT"
  const shorterCodes = bookingConflict && "shorterPackageCodes" in bookingDetails
    && Array.isArray(bookingDetails.shorterPackageCodes) ? bookingDetails.shorterPackageCodes : []
  const shorterOptions = options.data?.filter((option) => shorterCodes.includes(option.pricingPackageCode)) ?? []
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
                  if (expiredOnServer || bookingConflict) command.clear()
                  setCode(e.target.value)
                  setQuote(undefined)
                  setConfirmed(false)
                }}
              >
                <option value="">Chọn gói gia hạn</option>
                {options.data.map((o) => (
                  <option key={o.pricingPackageCode} value={o.pricingPackageCode}>
                    {renewalOptionLabel(o)}
                  </option>
                ))}
              </select>
            </label>

          </div>
          {quote && <div className="mt-3 px-2"><QuoteLine label="Thời gian gia hạn" value={<>{rentalDate(quote.extensionStartDate)} - {rentalDate(quote.newEndDate)}</>} /></div>}
          <p className="mt-2 text-xs text-stone-600">Ngày bắt đầu kỳ mới nối tiếp ngày kết thúc kỳ thuê hiện tại.</p>
          </section>
        )}
        {options.data?.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 space-y-2">
            <p className="font-semibold text-sm text-amber-900">
              Cơ sở hiện chưa có gói gia hạn còn hiệu lực.
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Kho này hiện chưa có gói ưu đãi gia hạn trực tuyến nào còn hiệu lực. Vui lòng liên hệ hotline cơ sở hoặc nhắn tin qua mục <b>Hỗ trợ</b> để được gán gói gia hạn phù hợp.
            </p>
          </div>
        )}

        {quoteBusy ? <p role="status">Đang lấy báo giá…</p> : null}
        {quoteError && !bookingConflict ? <p role="alert">{rentalError(quoteError)}</p> : null}
        {bookingConflict && !command.uncertain && (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p role="alert">Ô kho đã có lịch đặt trùng với kỳ gia hạn đã chọn.</p>
            {shorterOptions.length > 0 ? (
              <>
                <p className="text-sm">Bạn có thể chọn gói ngắn hơn:</p>
                {shorterOptions.map((option) => (
                  <Button key={option.pricingPackageCode} variant="outline" disabled={locked} onClick={() => {
                    command.clear()
                    setQuote(undefined)
                    setCode(option.pricingPackageCode)
                  }}>
                    {renewalOptionLabel(option)}
                  </Button>
                ))}
              </>
            ) : (
              <>
                <p className="text-sm">Các gói ngắn hơn hiện có cũng không phù hợp. Bạn có thể tìm ô kho khác.</p>
                {onBrowseUnits && <Button variant="outline" disabled={locked} onClick={onBrowseUnits}>Tìm ô kho khác</Button>}
              </>
            )}
          </div>
        )}
        {quoteExpired && !command.uncertain && (
          <p role="status" className="text-sm text-amber-800">
            Báo giá gia hạn đã hết hạn. Vui lòng lấy báo giá mới để tiếp tục.
          </p>
        )}
        {quote && (
          <>
          <section aria-label="Chi tiết báo giá gia hạn" className="border-t border-stone-200 pt-4">
            <h3 className="mb-3 text-xs font-medium uppercase text-stone-500">Chi tiết chi phí</h3>
            <div className="space-y-3">
                {quote.expiresAt && <QuoteLine label="Báo giá có hiệu lực đến" value={rentalDate(quote.expiresAt)} />}
                <QuoteLine label="Đơn giá / tháng" value={rentalMoney(quote.monthlyPrice, quote.currency)} />
                <QuoteLine label={`Tạm tính (${quote.rentalMonths} tháng)`} value={rentalMoney(quote.subtotal, quote.currency)} />
                {quote.discountAmount > 0 && (
                  <QuoteLine
                    label={`Ưu đãi gói (${discountPercent.format(quote.discountRate)})`}
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
            <h3 className="mb-2 text-xs font-medium uppercase text-stone-500">Quy trình gia hạn</h3>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                <p className="font-semibold text-sm text-emerald-900">Thanh toán trực tuyến và ký tại cơ sở</p>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Sau khi gửi yêu cầu, hãy lưu lịch ký rồi trả trước 20% qua VNPay. Bạn thanh toán phần còn lại tại cơ sở khi ký phụ lục gia hạn.
              </p>
            </div>
            <details className="mt-3 text-sm text-stone-500">
              <summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-amber-600">Xem điều khoản gia hạn trực tuyến</summary>
              <div className="mt-2 space-y-2 leading-5 text-xs text-stone-600 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p>• Tiền gia hạn được tính theo biểu giá ưu đãi đã niêm yết của cơ sở.</p>
                <p>• Tiền cọc bảo đảm kho hiện tại được giữ nguyên để bảo đảm cho kỳ thuê mới mà không cần thu lại.</p>
                <p>• Kỳ mới nối tiếp kỳ hiện tại và chỉ được cập nhật sau khi đã thu đủ tiền và xác nhận bản ký.</p>

              </div>
            </details>
          </section>
            <label className="flex items-start gap-2 border-t border-stone-200 pt-4 text-sm leading-5 text-stone-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-600"
                checked={confirmed}
                disabled={locked || quoteExpired}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi đã đọc và đồng ý với giá thuê cùng điều khoản gia hạn.
            </label>
          </>
        )}
        {/* Khi có yêu cầu gia hạn đang mở: Hiển thị Thẻ thông báo trực quan, bỏ các nút thừa */}
        {isConflictOpenRenewal ? (
          <div className="rounded-xl bg-amber-50/90 p-4 text-stone-900" role="alert">
            <h4 className="text-sm font-semibold text-amber-950">
              Gian kho này đã có yêu cầu gia hạn đang mở
            </h4>
            <p className="mt-1 text-sm leading-5 text-amber-900">
              Vui lòng xem hoặc thanh toán yêu cầu hiện có trước khi tạo yêu cầu mới.
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-stone-50"
                onClick={onClose}
              >
                Đóng
              </Button>
              {onNavigateToRenewals && (
                <Button
                  variant="primary"
                  size="sm"
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
            {command.error && !expiredOnServer && !bookingConflict ? (
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
              {bookingConflict && !command.uncertain ? null : !command.uncertain && (!command.conflict || expiredOnServer) && (quoteExpired || (code && quoteError)) ? (
                <Button variant="primary" disabled={locked} onClick={() => {
                  command.clear()
                  setQuote(undefined)
                  setQuoteRequest((request) => request + 1)
                }}>
                  Lấy báo giá mới
                </Button>
              ) : command.conflict ? (
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
                  className="renewal-confirm-button sm:min-w-44"
                  onClick={() => {
                    if (!quote) return
                    if (!command.uncertain && quote.expiresAt && Date.parse(quote.expiresAt) <= Date.now()) {
                      setExpiredQuoteId(quote.id)
                      return
                    }
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
                      : "Xác nhận và xem yêu cầu"}
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
