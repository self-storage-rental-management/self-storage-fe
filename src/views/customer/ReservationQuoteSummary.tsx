import { formatVndAmount } from '../../i18n/currency'
import type { ReservationQuote } from '../../services/customerReservationApi'

function formatDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.replace(/-/g, '/')
}

export default function ReservationQuoteSummary({ quote: q, needsReview }: { quote: ReservationQuote; needsReview: boolean }) {
  const depositPercent = q.totalAfterDiscount > 0 ? Math.round(q.reservationDepositAmount / q.totalAfterDiscount * 100) : 0
  const amountClass = 'min-w-[8.5rem] text-right font-semibold tabular-nums'
  const payableAmountClass = `${amountClass} text-base font-bold text-amber-700`
  const deductionAmountClass = `${amountClass} text-base font-bold text-emerald-700`

  return (
    <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm sm:p-6">
      {/* ── HEADER BÁO GIÁ ── */}
      <div className="border-b border-stone-200 pb-4">
        <h3 className="text-lg font-bold text-stone-900">Xác nhận báo giá đặt kho</h3>
        <p className="mt-1 text-xs text-stone-600">
          Kỳ thuê: <b className="text-stone-900">{formatDisplayDate(q.startDate)} đến {formatDisplayDate(q.endDate)}</b> · {q.rentalMonths} tháng
        </p>
      </div>

      {/* ── KHỐI 1: TÍNH TOÁN TIỀN THUÊ KHO ── */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-700">1. Chi tiết tiền thuê kho</p>
        <div className="space-y-2.5 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <span className="text-stone-600">Đơn giá mỗi tháng</span>
          <span className={`${amountClass} text-sm text-stone-900`}>{formatVndAmount(q.monthlyPrice)}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <span className="text-stone-600">Tiền thuê trước giảm ({q.rentalMonths} tháng)</span>
          <span className={`${amountClass} text-sm text-stone-900`}>{formatVndAmount(q.subtotal)}</span>
        </div>

        {/* Giảm giá kỳ hạn (nếu có hoặc hiển thị để đối chiếu) */}
        {(q.discountAmount > 0 || q.discountRate > 0) ? (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 sm:text-sm">
            <span className="font-semibold">Giảm giá kỳ hạn ({Math.round(q.discountRate * 100)}%)</span>
            <span className={deductionAmountClass}>− {formatVndAmount(q.discountAmount)}</span>
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
            <span className={deductionAmountClass}>− {formatVndAmount(q.voucherDiscountAmount!)}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <span className="font-bold text-stone-900">Tiền thuê sau khi trừ ưu đãi</span>
          <span className={payableAmountClass}>{formatVndAmount(q.totalAfterDiscount)}</span>
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
          <p className="border-b border-stone-200 pb-2 text-xs font-bold uppercase tracking-wider text-stone-700">Chặng 1 · Thanh toán ngay</p>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-stone-900">Cọc giữ chỗ ({depositPercent}%)</p>
            </div>
            <div className="ml-auto text-right">
              <span className={`${amountClass} block text-xl font-bold text-amber-700`}>
                {formatVndAmount(q.reservationDepositAmount)}
              </span>
            </div>
          </div>

          <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-600">Khoản cọc này <b>được trừ trực tiếp</b> vào tiền thuê của bạn khi nhận kho.</p>
        </div>

        {/* CHẶNG 2: THANH TOÁN KHI NHẬN KHO TẠI CƠ SỞ */}
        <div className="space-y-2.5 rounded-xl border border-stone-200 bg-white p-4">
          <p className="border-b border-stone-200/60 pb-2 text-xs font-bold uppercase tracking-wider text-stone-700">Chặng 2 · Thanh toán khi nhận kho</p>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-stone-600">• Tiền thuê còn lại ({100 - depositPercent}%)</span>
              <span className={`${amountClass} text-sm text-stone-800`}>{formatVndAmount(q.remainingRentalAmount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-600">
                • Tiền duy trì CSVC <span className="text-stone-400 italic font-normal">(Hoàn trả khi trả kho)</span>
              </span>
              <span className={`${amountClass} text-sm text-stone-800`}>{formatVndAmount(q.securityDepositAmount)}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-stone-200/60 pt-2 text-sm">
            <span className="font-bold text-stone-900">Tổng thanh toán lúc nhận kho</span>
            <span className={payableAmountClass}>{formatVndAmount(q.dueAtCheckIn)}</span>
          </div>
        </div>
      </div>

      {/* ── KHỐI 3: TỔNG NGHĨA VỤ TÀI CHÍNH KỲ THUÊ ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-900 p-4 text-white">
        <div>
          <p className="text-sm font-bold">Tổng nghĩa vụ tài chính</p>
          <p className="text-[11px] text-stone-300">Tiền thuê sau giảm + tiền duy trì CSVC hoàn trả</p>
        </div>
        <div className="ml-auto text-right">
          <span className={`${amountClass} block text-xl font-bold text-white`}>{formatVndAmount(q.totalInitialObligation)}</span>
        </div>
      </div>

      {/* ── FOOTER HIỆU LỰC & XÉT DUYỆT ── */}
      <p className="text-xs text-stone-500">
        Báo giá có hiệu lực đến {new Date(q.expiresAt).toLocaleString('vi-VN')}. Số tiền được lưu theo báo giá này khi tạo đơn.
      </p>

      {needsReview && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 sm:text-sm">
          Hàng hóa “Khác”: xác minh OTP sau khi tạo đơn để gửi nhân viên cơ sở duyệt. Chưa thu cọc cho đến khi hồ sơ được chấp thuận.
        </p>
      )}
    </section>
  )
}
