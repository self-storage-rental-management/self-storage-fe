import { formatVndAmount } from '../../i18n/currency'
import type { ReservationQuote } from '../../services/customerReservationApi'

function formatDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.replace(/-/g, '/')
}

export default function ReservationQuoteSummary({ quote: q, needsReview, context = 'quote' }: { quote: ReservationQuote; needsReview: boolean; context?: 'quote' | 'reservation' }) {
  const depositPercent = q.totalAfterDiscount > 0 ? Math.round(q.reservationDepositAmount / q.totalAfterDiscount * 100) : 0
  const amountClass = 'min-w-[8.5rem] text-right font-semibold tabular-nums'
  const payableAmountClass = `${amountClass} text-base font-bold text-amber-700`
  const deductionAmountClass = `${amountClass} text-base font-bold text-emerald-700`

  if (context === 'reservation') {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-stone-900">Tiền thuê và cọc giữ chỗ</h3>
              {q.unitTypeName && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700 border border-stone-200">
                  {q.unitTypeName}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              {q.facilityName ? `${q.facilityName} · ` : ''}{formatDisplayDate(q.startDate)}–{formatDisplayDate(q.endDate)} · {q.rentalMonths} tháng
            </p>
          </div>
          <div className="text-right"><span className="text-xs text-stone-500">Đơn giá/tháng</span><b className="block tabular-nums text-stone-900">{formatVndAmount(q.monthlyPrice)}</b></div>
        </div>

        <div className="grid gap-4 py-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Cách tính tiền thuê</p>
            <div className="flex justify-between gap-3"><span>Tiền thuê trước giảm</span><b className="tabular-nums">{formatVndAmount(q.subtotal)}</b></div>
            {q.discountAmount > 0 && <div className="flex justify-between gap-3 text-emerald-700"><span>Giảm kỳ hạn ({Math.round(q.discountRate * 100)}%)</span><b className="tabular-nums">− {formatVndAmount(q.discountAmount)}</b></div>}
            {q.voucherCode && (q.voucherDiscountAmount ?? 0) > 0 && <div className="flex justify-between gap-3 text-emerald-700"><span>Voucher {q.voucherCode}</span><b className="tabular-nums">− {formatVndAmount(q.voucherDiscountAmount!)}</b></div>}
            <div className="flex justify-between gap-3 border-t border-stone-200 pt-2"><b>Tiền thuê sau giảm</b><b className="tabular-nums text-amber-700">{formatVndAmount(q.totalAfterDiscount)}</b></div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Lộ trình thanh toán</p>
            <div className="flex justify-between gap-3"><span>Cọc giữ chỗ ({depositPercent}%)</span><b className="tabular-nums text-amber-700">{formatVndAmount(q.reservationDepositAmount)}</b></div>
            <div className="flex justify-between gap-3"><span>Tiền thuê còn lại</span><b className="tabular-nums">{formatVndAmount(q.remainingRentalAmount)}</b></div>
            <div className="flex justify-between gap-3"><span>Tiền duy trì CSVC <small className="text-stone-500">(hoàn trả)</small></span><b className="tabular-nums">{formatVndAmount(q.securityDepositAmount)}</b></div>
            <div className="flex justify-between gap-3 border-t border-stone-200 pt-2"><b>Khoản thu khi nhận kho</b><b className="tabular-nums text-amber-700">{formatVndAmount(q.dueAtCheckIn)}</b></div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-900 px-3 py-2.5 text-white">
          <div><b>Tổng nghĩa vụ tài chính</b><p className="text-[11px] text-stone-300">Tiền thuê sau giảm + tiền duy trì CSVC</p></div>
          <b className="text-base tabular-nums">{formatVndAmount(q.totalInitialObligation)}</b>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm sm:p-6">
      {/* ── HEADER BÁO GIÁ ── */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-stone-900">{context === 'quote' ? 'Xác nhận báo giá đặt kho' : 'Tiền thuê và cọc giữ chỗ'}</h3>
          {(q.facilityName || q.unitTypeName) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-200">
              🏷️ {q.unitTypeName ? q.unitTypeName : 'Loại kho đã chọn'} {q.facilityName ? `· ${q.facilityName}` : ''}
            </span>
          )}
        </div>
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
              <span className={`${payableAmountClass} block`}>
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
            <span className="font-bold text-stone-900">Khoản thu khi nhận kho</span>
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
      {context === 'quote' && <p className="text-xs text-stone-500">
        Báo giá có hiệu lực đến {new Date(q.expiresAt).toLocaleString('vi-VN')}. Số tiền được lưu theo báo giá này khi tạo đơn.
      </p>}

      {needsReview && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 sm:text-sm">
          Hàng hóa “Khác”: xác minh OTP sau khi tạo đơn để gửi nhân viên cơ sở duyệt. Chưa thu cọc cho đến khi hồ sơ được chấp thuận.
        </p>
      )}
    </section>
  )
}
