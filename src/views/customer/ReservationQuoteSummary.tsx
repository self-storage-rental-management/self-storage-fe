import { formatCustomerDateTime } from '../../i18n/customerDate'
import { formatVndAmount } from '../../i18n/currency'
import type { ReservationQuote } from '../../services/customerReservationApi'
import { rentalEndDateForDisplay } from '../../domain/rentalTimeline'
import CustomerTransactionTerms from './CustomerTransactionTerms'

function formatDisplayDate(value: string, endDate = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value.replace(/-/g, '/')
  if (!endDate) return `${match[3]}/${match[2]}/${match[1]}`
  const displayEndDate = rentalEndDateForDisplay(value)
  const displayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(displayEndDate)
  return displayMatch ? `${displayMatch[3]}/${displayMatch[2]}/${displayMatch[1]}` : displayEndDate.replace(/-/g, '/')
}

export default function ReservationQuoteSummary({ quote: q, needsReview, context = 'quote' }: { quote: ReservationQuote; needsReview: boolean; context?: 'quote' | 'reservation' }) {
  const depositPercent = q.totalInitialObligation > 0 ? Math.round(q.reservationDepositAmount / q.totalInitialObligation * 100) : 0
  const amountClass = 'min-w-[8.5rem] text-right font-semibold tabular-nums'
  const payableAmountClass = `${amountClass} text-base font-bold text-amber-700`
  const deductionAmountClass = `${amountClass} text-base font-bold text-emerald-700`


  return (
    <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm sm:p-6">
      <details className="rounded-lg border border-stone-200 p-3"><summary className="cursor-pointer font-semibold">Điều khoản giữ kho, hủy, trả kho và hoàn tiền</summary><div className="mt-3"><CustomerTransactionTerms /></div></details>
      {/* ── HEADER BÁO GIÁ ── */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-stone-900">Báo giá đặt kho</h3>
          {(q.facilityName || q.unitTypeName) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-200">
               {q.unitTypeName ? q.unitTypeName : 'Loại kho đã chọn'} {q.facilityName ? `· ${q.facilityName}` : ''}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-stone-600">
          {q.rentalPeriodConfirmed ? 'Kỳ thuê đã chốt:' : 'Kỳ thuê dự kiến sau thời gian chuẩn bị:'} <b className="text-stone-900">{formatDisplayDate(q.startDate)} đến {formatDisplayDate(q.endDate, true)}</b> · {q.rentalMonths} tháng
        </p>
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          <b>{q.freeSetupDays ?? 0} ngày chuẩn bị miễn phí</b> tính từ khi bạn xác nhận nhận kho trống. Sau khi nhân viên kiểm kê, bạn có thể xác nhận bắt đầu kỳ thuê ngay. Nếu chưa xác nhận sớm, kỳ thuê bắt đầu theo lịch hết miễn phí. Quyền lợi chuẩn bị áp dụng một lần cho đơn ban đầu.
        </div>

      </div>

      {/* ── KHỐI 3: TỔNG CHI PHÍ PHẢI THANH TOÁN ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-900 p-4 text-white">
        <div>
          <p className="text-sm font-bold">Tổng chi phí phải thanh toán</p>
          <p className="text-[11px] text-stone-300">Tiền thuê kỳ thuê + tiền cọc đảm bảo thuê hoàn trả</p>
        </div>
        <div className="ml-auto text-right">
          <span className={`${amountClass} block text-xl font-bold text-white`}>{formatVndAmount(q.totalInitialObligation)}</span>
        </div>
      </div>


      {/* ── KHỐI 1: TÍNH TOÁN TIỀN THUÊ KHO ── */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-700">1. Các khoản cộng và giảm trừ</p>
        <div className="space-y-2.5 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <span className="text-stone-600">Đơn giá mỗi tháng</span>
          <span className={`${amountClass} text-sm text-stone-900`}>{formatVndAmount(q.monthlyPrice)}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <span className="text-stone-600">Tiền thuê ({q.rentalMonths} tháng)</span>
          <span className={`${amountClass} text-sm text-stone-900`}>{formatVndAmount(q.subtotal)}</span>
        </div>

        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <span className="text-stone-600">Tiền cọc đảm bảo thuê (hoàn trả)</span>
          <span className={amountClass}>+ {formatVndAmount(q.securityDepositAmount)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-stone-200 pt-2 font-bold">
          <span>Tổng trước ưu đãi</span>
          <span className={amountClass}>{formatVndAmount(q.subtotal + q.securityDepositAmount)}</span>
        </div>

        {/* Giảm giá kỳ hạn (nếu có hoặc hiển thị để đối chiếu) */}
        {(q.discountAmount > 0 || q.discountRate > 0) ? (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 sm:text-sm">
            <span className="font-semibold">Giảm giá kỳ hạn ({Math.round(q.discountRate * 100)}%)</span>
            <span className={deductionAmountClass}>- {formatVndAmount(q.discountAmount)}</span>
          </div>
        ) : (
          <div className="flex justify-between gap-4 border-t border-stone-100 pt-2.5 text-xs text-stone-500 sm:text-sm">
            <span>Giảm giá kỳ hạn ({Math.round(q.discountRate * 100)}%)</span>
            <span className={`${amountClass} text-sm`}>{formatVndAmount(q.discountAmount)}</span>
          </div>
        )}

        {/* Mã ưu đãi Voucher (nếu có) */}
        {q.voucherCode && (q.voucherDiscountAmount ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 sm:text-sm">
            <span className="font-semibold">Mã ưu đãi [{q.voucherCode}]</span>
            <span className={deductionAmountClass}>- {formatVndAmount(q.voucherDiscountAmount!)}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <span className="font-bold text-stone-900">Tổng sau ưu đãi (đã gồm tiền cọc đảm bảo thuê)</span>
          <span className={payableAmountClass}>{formatVndAmount(q.totalInitialObligation)}</span>
        </div>
        </div>
      </div>

      {/* ── KHỐI 2: LỘ TRÌNH THANH TOÁN (CHIA 2 CHẶNG MINH BẠCH) ── */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-700">
          2. Lộ trình thanh toán (Chia 2 chặng)
        </p>

        {/* CHẶNG 1: THANH TOÁN ONLINE NGAY (NỔI BẬT NHẤT) */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="border-b border-stone-200 pb-2 text-xs font-bold uppercase tracking-wider text-stone-700">Chặng 1 · Đặt cọc giữ chỗ</p>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-stone-900">Đặt cọc giữ chỗ ({depositPercent}%)</p><p className="mt-1 text-xs text-stone-600">{depositPercent}% × tổng tiền {formatVndAmount(q.totalInitialObligation)} (đã gồm tiền thuê và tiền cọc đảm bảo thuê).</p>
            </div>
            <div className="ml-auto text-right">
              <span className={`${payableAmountClass} block`}>
                {formatVndAmount(q.reservationDepositAmount)}
              </span>
            </div>
          </div>

<p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-600">Khoản đặt cọc giữ chỗ này <b>được trừ trực tiếp</b> vào tổng tiền cần thanh toán khi bàn giao kho.</p>
          <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50/90 p-2.5 text-xs text-rose-900">
            <span className="font-bold text-rose-950">Quy định không hoàn tiền:</span> Phí đặt cọc giữ chỗ ({depositPercent}%) là khoản bảo đảm việc giữ loại kho đã chọn và <b>không được hoàn lại</b> trong trường hợp khách hàng tự ý hủy đơn hoặc bỏ lịch nhận kho.
          </div>
        </div>

        {/* CHẶNG 2: THANH TOÁN KHI NHẬN KHO TẠI CƠ SỞ */}
        <div className="space-y-2.5 rounded-xl border border-stone-200 bg-white p-4">
          <p className="border-b border-stone-200/60 pb-2 text-xs font-bold uppercase tracking-wider text-stone-700">Chặng 2 · Thanh toán khi nhận kho</p>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span>Tổng chi phí phải thanh toán</span><span className={amountClass}>{formatVndAmount(q.totalInitialObligation)}</span></div>
            <div className="flex justify-between gap-4 text-emerald-700"><span>Khoản trừ (Đặt cọc giữ chỗ Chặng 1)</span><span className={amountClass}>- {formatVndAmount(q.reservationDepositAmount)}</span></div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-stone-200/60 pt-2 text-sm">
            <span className="font-bold text-stone-900">Số tiền còn lại phải thanh toán khi bàn giao kho</span>
            <span className={payableAmountClass}>{formatVndAmount(q.dueAtCheckIn)}</span>
          </div>
        </div>
      </div>



      {/* ── FOOTER HIỆU LỰC & XÉT DUYỆT ── */}
      {context === 'reservation' && <p className="text-xs text-stone-500">Báo giá đã lưu khi tạo đơn. Các khoản thanh toán được đối chiếu theo số tiền đã chốt.</p>}
      {context === 'quote' && <p className="text-xs text-stone-500">
        Báo giá có hiệu lực đến {formatCustomerDateTime(new Date(q.expiresAt))}. Số tiền được lưu theo báo giá này khi tạo đơn.
      </p>}

      {needsReview && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 sm:text-sm">
          Hàng hóa “Khác”: tài khoản đã xác minh email được chuyển hồ sơ trực tiếp cho nhân viên cơ sở duyệt. Chưa thu cọc cho đến khi hồ sơ được chấp thuận.
        </p>
      )}
    </section>
  )
}
