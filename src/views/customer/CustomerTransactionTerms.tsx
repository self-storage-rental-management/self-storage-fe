import { HANDOVER_TERMS_NOTICE, HANDOVER_TERMS_VERSION, LEGACY_HANDOVER_TERMS_NOTICE, LEGACY_HANDOVER_TERMS_VERSION } from '../../domain/reservationCheckInPolicy'
import { formatVndAmount } from '../../i18n/currency'
export default function CustomerTransactionTerms({ handoverTermsVersion, depositAmount }: { handoverTermsVersion?: string | null; depositAmount?: number }) {
  const hasCurrentHandoverTerms = (handoverTermsVersion === undefined ? HANDOVER_TERMS_VERSION : handoverTermsVersion) === HANDOVER_TERMS_VERSION
  const handoverNotice = hasCurrentHandoverTerms ? HANDOVER_TERMS_NOTICE
    : handoverTermsVersion === LEGACY_HANDOVER_TERMS_VERSION ? LEGACY_HANDOVER_TERMS_NOTICE
    : 'Hạn đến nhận kho và xử lý khoản giữ chỗ theo điều khoản đã lưu của đơn.'
  const terms = [
    ['Đặt kho và thanh toán', 'Đơn được xác nhận sau khi khoản giữ chỗ được ghi nhận. Hàng cần duyệt phải được duyệt trước khi thanh toán. Thanh toán theo số tiền và thời hạn hiển thị trên đơn.'],
    ['Khoản giữ chỗ và cọc đảm bảo', 'Khoản trả trước giữ chỗ 20% được trừ vào tổng tiền phải thanh toán. Cọc đảm bảo được ghi riêng và quyết toán khi trả kho.'],
    ['Nhận kho và xác minh CCCD', handoverNotice],
    ['Bàn giao và chuẩn bị hàng', 'Thời gian chuẩn bị bắt đầu khi nhân viên hoàn tất bàn giao kho. Ngày bắt đầu tính tiền thuê theo thời điểm bàn giao và số ngày chuẩn bị miễn phí đã chốt trong hồ sơ. Khi đưa hàng vào kho xong, khách báo chuẩn bị xong và chọn lịch kiểm kê.'],
    ['Hủy đơn và sai sót thanh toán', 'Hủy đơn hoặc không đáp ứng điều kiện nhận kho có thể không được hoàn khoản giữ chỗ theo điều khoản đã chấp nhận. Nếu đã trả tiền nhưng đơn chưa ghi nhận hoặc bị thu trùng, gửi chứng từ để được đối soát.'],
    ['Trả kho và hoàn tiền', 'Tiền sử dụng, phí trả kho và khoản khấu trừ được quyết toán theo điều khoản của đơn và biên bản nghiệm thu. Khách được xem bảng kê và yêu cầu xem xét trước khi xác nhận. Tiền hoàn được theo dõi bằng trạng thái và chứng từ thanh toán.'],
    ['Điều khoản áp dụng', 'Áp dụng báo giá, hợp đồng và điều khoản đã chấp nhận của từng đơn. Mức phí và thời hạn cụ thể được lưu trong hồ sơ.'],
  ]
  return <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm leading-6" aria-label="Điều khoản giao dịch cần biết">
    <h4 className="font-bold text-stone-900">Điều khoản cần biết trước khi xác nhận</h4>
    <dl className="space-y-3">{terms.map(([title, text]) => <div key={title}><dt className="font-semibold text-stone-900">{title}</dt><dd className="mt-1 text-stone-700">{text}</dd></div>)}</dl>
    {hasCurrentHandoverTerms && depositAmount != null && <p className="font-medium text-stone-900">Khoản giữ chỗ có thể không được hoàn lại <b>{formatVndAmount(depositAmount)}</b>.</p>}
    <p className="text-xs text-stone-600">Phiên bản mới chỉ áp dụng cho đơn đã xác nhận đồng ý. Số tiền, thời hạn và phiên bản điều khoản được lưu cùng báo giá hoặc hợp đồng.</p>
  </section>
}
