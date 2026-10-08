import { formatVndAmount } from '../../i18n/currency'
import type { ReservationQuote } from '../../services/customerReservationApi'

export default function ReservationQuoteSummary({ quote: q, needsReview }: { quote: ReservationQuote; needsReview: boolean }) {
  const depositPercent = q.totalAfterDiscount > 0 ? Math.round(q.reservationDepositAmount / q.totalAfterDiscount * 100) : 0
  return <section className="space-y-4 rounded-2xl border border-amber-300 bg-gradient-to-b from-amber-50/70 to-white p-6 text-sm shadow-sm">
    <h3 className="text-lg font-bold text-stone-900">Xác nhận báo giá đặt kho</h3>
    <p>Kỳ thuê: <b>{q.startDate} → {q.endDate}</b> · {q.rentalMonths} tháng</p>
    <dl className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex justify-between gap-4"><dt>Đơn giá mỗi tháng</dt><dd className="font-bold">{formatVndAmount(q.monthlyPrice)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Tiền thuê trước giảm</dt><dd className="font-bold">{formatVndAmount(q.subtotal)}</dd></div>
      <div className="flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><dt>Giảm giá ({Math.round(q.discountRate * 100)}%)</dt><dd className="font-bold">− {formatVndAmount(q.discountAmount)}</dd></div>
      <div className="flex justify-between gap-4 border-t border-stone-200 pt-3"><dt className="font-bold">Tiền thuê sau giảm</dt><dd className="font-bold text-emerald-700">{formatVndAmount(q.totalAfterDiscount)}</dd></div>
      <div className="flex justify-between gap-4 rounded-lg bg-amber-50 px-3 py-2"><dt>Cọc giữ chỗ ({depositPercent}%)</dt><dd className="font-bold text-amber-800">{formatVndAmount(q.reservationDepositAmount)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Tiền thuê còn lại</dt><dd className="font-bold">{formatVndAmount(q.remainingRentalAmount)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Tiền đảm bảo kho</dt><dd className="font-bold">{formatVndAmount(q.securityDepositAmount)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Thu khi nhận kho</dt><dd className="font-bold">{formatVndAmount(q.dueAtCheckIn)}</dd></div>
      <div className="flex justify-between gap-4 rounded-lg bg-stone-900 px-3 py-3 text-white"><dt className="font-bold">Tổng nghĩa vụ kỳ thuê</dt><dd className="text-base font-extrabold">{formatVndAmount(q.totalInitialObligation)}</dd></div>
    </dl>
    <p className="text-xs text-stone-500">Báo giá có hiệu lực đến {new Date(q.expiresAt).toLocaleString('vi-VN')}. Số tiền được lưu theo báo giá này khi tạo đơn.</p>
    {needsReview && <p className="rounded-lg bg-blue-50 p-3 text-blue-900">Hàng hóa “Khác”: xác minh OTP sau khi tạo đơn để gửi nhân viên cơ sở duyệt. Chưa thu cọc cho đến khi hồ sơ được chấp thuận.</p>}
  </section>
}
