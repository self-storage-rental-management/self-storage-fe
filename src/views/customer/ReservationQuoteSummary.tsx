import { formatVndAmount } from '../../i18n/currency'
import type { ReservationQuote } from '../../services/customerReservationApi'

function formatDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.replace(/-/g, '/')
}

export default function ReservationQuoteSummary({ quote: q, needsReview }: { quote: ReservationQuote; needsReview: boolean }) {
  const depositPercent = q.totalAfterDiscount > 0 ? Math.round(q.reservationDepositAmount / q.totalAfterDiscount * 100) : 0

  return (
    <section className="space-y-4 rounded-2xl border border-amber-300 bg-gradient-to-b from-amber-50/70 to-white p-5 sm:p-6 text-sm shadow-sm">
      {/* ── HEADER BÁO GIÁ ── */}
      <div className="border-b border-amber-200/60 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-stone-900">Xác nhận báo giá đặt kho</h3>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 border border-amber-200">
            Kỳ hạn {q.rentalMonths} tháng
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-600">
          Kỳ thuê: <b className="text-stone-900">{formatDisplayDate(q.startDate)} đến {formatDisplayDate(q.endDate)}</b> · {q.rentalMonths} tháng
        </p>
      </div>

      {/* ── KHỐI 1: TÍNH TOÁN TIỀN THUÊ KHO ── */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
          1. Chi tiết tiền thuê kho
        </p>
        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <span className="text-stone-600">Đơn giá mỗi tháng</span>
          <span className="font-bold text-stone-900">{formatVndAmount(q.monthlyPrice)}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <span className="text-stone-600">Tiền thuê trước giảm ({q.rentalMonths} tháng)</span>
          <span className="font-bold text-stone-900">{formatVndAmount(q.subtotal)}</span>
        </div>

        {/* Giảm giá kỳ hạn (nếu có hoặc hiển thị để đối chiếu) */}
        {(q.discountAmount > 0 || q.discountRate > 0) ? (
          <div className="flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs sm:text-sm text-emerald-800 border border-emerald-200/60">
            <span className="font-medium">Giảm giá kỳ hạn ({Math.round(q.discountRate * 100)}%)</span>
            <span className="font-bold">-{formatVndAmount(q.discountAmount)}</span>
          </div>
        ) : (
          <div className="flex justify-between gap-4 rounded-lg bg-stone-50 px-3 py-1.5 text-xs text-stone-500">
            <span>Giảm giá kỳ hạn ({Math.round(q.discountRate * 100)}%)</span>
            <span>{formatVndAmount(q.discountAmount)}</span>
          </div>
        )}

        {/* Mã ưu đãi Voucher (nếu có) */}
        {q.voucherCode && (q.voucherDiscountAmount ?? 0) > 0 && (
          <div className="flex justify-between gap-4 rounded-lg bg-purple-50 px-3 py-2 text-xs sm:text-sm text-purple-900 border border-purple-200">
            <span className="font-semibold">Mã ưu đãi [{q.voucherCode}]</span>
            <span className="font-bold">-{formatVndAmount(q.voucherDiscountAmount!)}</span>
          </div>
        )}

        <div className="flex justify-between gap-4 border-t border-stone-100 pt-2.5 text-sm">
          <span className="font-bold text-stone-900">Tiền thuê ròng sau giảm</span>
          <span className="font-extrabold text-emerald-700">{formatVndAmount(q.totalAfterDiscount)}</span>
        </div>
      </div>

      {/* ── KHỐI 2: LỘ TRÌNH THANH TOÁN (CHIA 2 CHẶNG MINH BẠCH) ── */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
          2. Lộ trình thanh toán (Chia 2 chặng)
        </p>

        {/* CHẶNG 1: THANH TOÁN ONLINE NGAY (NỔI BẬT NHẤT) */}
        <div className="relative overflow-hidden rounded-xl border-2 border-amber-500 bg-gradient-to-r from-amber-500/10 via-amber-50/70 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
              <span>💳 CHẶNG 1</span>
              <span>· Thanh toán ngay</span>
            </div>
            <span className="text-[11px] font-semibold text-amber-800">Cọc giữ chỗ ({depositPercent}%)</span>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-stone-900">Cọc giữ chỗ ({depositPercent}%)</p>
              <p className="mt-1 text-xs text-stone-600">
                Thanh toán trực tuyến để giữ phòng và kích hoạt tiến trình phân gian kho.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-amber-900 tracking-tight">
                {formatVndAmount(q.reservationDepositAmount)}
              </span>
            </div>
          </div>

          <div className="mt-2.5 rounded-lg bg-white/80 p-2 text-xs text-amber-950 border border-amber-200/60 flex items-center gap-1.5">
            <span className="text-emerald-700 font-bold">✓</span>
            <span>Khoản cọc này <b>được trừ trực tiếp</b> vào tiền thuê của bạn khi nhận kho.</span>
          </div>
        </div>

        {/* CHẶNG 2: THANH TOÁN KHI NHẬN KHO TẠI CƠ SỞ */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-2.5 py-0.5 text-[11px] font-bold text-stone-700">
              <span>🏢 CHẶNG 2</span>
              <span>· Thanh toán khi nhận kho</span>
            </div>
            <span className="text-xs font-bold text-stone-800">Thu khi nhận kho</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-stone-600">• Tiền thuê còn lại ({100 - depositPercent}%)</span>
              <span className="font-semibold text-stone-800">{formatVndAmount(q.remainingRentalAmount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-600">
                • Tiền duy trì CSVC <span className="text-stone-400 italic font-normal">(Hoàn trả khi trả kho)</span>
              </span>
              <span className="font-semibold text-stone-800">{formatVndAmount(q.securityDepositAmount)}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-stone-200/60 pt-2 text-sm">
            <span className="font-bold text-stone-900">Tổng thanh toán lúc nhận kho</span>
            <span className="font-extrabold text-stone-900">{formatVndAmount(q.dueAtCheckIn)}</span>
          </div>
        </div>
      </div>

      {/* ── KHỐI 3: TỔNG NGHĨA VỤ TÀI CHÍNH KỲ THUÊ ── */}
      <div className="rounded-xl bg-stone-900 p-3.5 text-white shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-stone-300">Tổng tiền thuê và tiền duy trì CSVC</p>
          <p className="text-[11px] text-stone-400">Bao gồm cọc giữ chỗ + tiền còn lại + tiền duy trì CSVC hoàn trả</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-black text-white">{formatVndAmount(q.totalInitialObligation)}</span>
        </div>
      </div>

      {/* ── FOOTER HIỆU LỰC & XÉT DUYỆT ── */}
      <p className="text-xs text-stone-500">
        Báo giá có hiệu lực đến {new Date(q.expiresAt).toLocaleString('vi-VN')}. Số tiền được lưu theo báo giá này khi tạo đơn.
      </p>

      {needsReview && (
        <p className="rounded-lg bg-blue-50 p-3 text-xs sm:text-sm text-blue-900 border border-blue-200">
          Hàng hóa “Khác”: xác minh OTP sau khi tạo đơn để gửi nhân viên cơ sở duyệt. Chưa thu cọc cho đến khi hồ sơ được chấp thuận.
        </p>
      )}
    </section>
  )
}
