import { HANDOVER_TERMS_NOTICE, HANDOVER_TERMS_VERSION, LEGACY_HANDOVER_TERMS_NOTICE, LEGACY_HANDOVER_TERMS_VERSION } from '../../domain/reservationCheckInPolicy'
import { formatVndAmount } from '../../i18n/currency'
import ReturnPolicyNotice from '../../components/ReturnPolicyNotice'
export default function CustomerTransactionTerms({ handoverTermsVersion, depositAmount }: { handoverTermsVersion?: string | null; depositAmount?: number }) {
  const hasCurrentHandoverTerms = (handoverTermsVersion === undefined ? HANDOVER_TERMS_VERSION : handoverTermsVersion) === HANDOVER_TERMS_VERSION
  const handoverNotice = hasCurrentHandoverTerms ? HANDOVER_TERMS_NOTICE
    : handoverTermsVersion === LEGACY_HANDOVER_TERMS_VERSION ? LEGACY_HANDOVER_TERMS_NOTICE
    : 'Hạn đến nhận kho và xử lý khoản giữ chỗ theo điều khoản đã lưu của đơn.'
  const terms = [
    ['Đặt giữ kho và xác minh', 'Email được xác minh khi kích hoạt tài khoản; tài khoản đã xác minh không cần nhập OTP cho mỗi lần đặt kho. Giữ kho là tạm thời, chỉ xác nhận đặt thành công sau khi cọc được ghi nhận. Thời hạn thanh toán mặc định 15 phút; hàng cần duyệt có tối đa 6 giờ để duyệt rồi bắt đầu thời hạn thanh toán riêng. Luôn theo mốc giờ cụ thể trên đơn.'],
    ['Khoản trả trước và cọc đảm bảo', 'Thanh toán trước 20% (giữ chỗ) là khoản trả trước theo báo giá, được trừ vào tổng nghĩa vụ phải thanh toán. Tiền cọc đảm bảo thuê được ghi riêng và quyết toán khi trả kho. Báo giá phải hiển thị tiền thuê sau ưu đãi, khoản trả trước giữ chỗ, cọc đảm bảo thuê và phần còn phải thu. Không thu thêm một lần nữa khoản đã được ghi nhận.'],
    ['Hạn đến nhận kho và đối chiếu CCCD', handoverNotice],
    ['Hủy đơn và giao dịch có sai sót', 'Khách tự hủy hoặc không nhận kho đúng hạn có thể không được hoàn khoản trả trước giữ chỗ theo điều khoản đã chấp nhận. Lỗi thuộc StorageHub, thu trùng, trừ tiền nhưng chưa xác nhận đơn hoặc không cung cấp đúng dịch vụ phải được đối soát và xử lý theo chứng từ, hợp đồng và quy định áp dụng; không tự động coi là mất cọc.'],
    ['Bàn giao và thời gian chuẩn bị', 'Thời gian miễn phí bắt đầu khi khách xác nhận đã nhận kho trống. Khi đã chuyển hàng vào kho, khách báo chuẩn bị xong để nhân viên kiểm kê. Kỳ thuê bắt đầu theo mốc đã chốt sau khi hết thời gian chuẩn bị miễn phí; việc hoàn tất chuẩn bị hoặc kiểm kê sớm không làm đổi ngày tính tiền. Nếu trả trong thời gian chuẩn bị, hoàn 80% tiền thuê sau ưu đãi và giữ lại 20%; tiền cọc đảm bảo quyết toán riêng theo biên bản.'],
    ['Hết hạn và khiếu nại', 'Sau hạn thanh toán, hệ thống đối soát giao dịch trước khi giải phóng chỗ. Nếu chưa có kết quả, bạn có thể gửi bằng chứng trong thời hạn ghi trên đơn (mặc định 24 giờ). Quản lý dự kiến xử lý trong 24 giờ từ khi tiếp nhận. Sau hạn giữ chỗ, bạn vẫn có thể liên hệ Hỗ trợ để yêu cầu đối soát hoặc khiếu nại theo quy định.'],
    ['Trả kho, khấu trừ và hoàn tiền', 'Khách được xem biên bản, ảnh, từng khoản công nợ/phí và gửi ý kiến trước quyết toán. Khoản hoàn và khấu trừ cần có căn cứ. Đã duyệt hoàn khác với đã chuyển tiền; hạn xử lý dự kiến được ghi trong thông báo duyệt, mặc định 7 ngày. Khi chuyển xong có số tiền và chứng từ đối chiếu; thời gian tiền về phụ thuộc ngân hàng.'],
    ['Phiên bản điều khoản và thông báo', 'Kỳ thuê áp dụng báo giá, điều khoản và hợp đồng khách đã chấp nhận. Thay đổi giá hoặc quy định không tự sửa nghĩa vụ đã chốt; nội dung mới phải nêu thời điểm áp dụng và được xác nhận khi cần. Email giao dịch dùng để cập nhật hồ sơ; email quảng cáo chỉ gửi theo lựa chọn đồng ý và phải có cách hủy đăng ký.'],
  ]
  return <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm leading-6" aria-label="Điều khoản giao dịch cần biết">
    <h4 className="font-bold text-stone-900">Điều khoản cần biết trước khi xác nhận</h4>
    <dl className="space-y-3">{terms.map(([title, text]) => <div key={title}><dt className="font-semibold text-stone-900">{title}</dt><dd className="mt-1 text-stone-700">{text}</dd></div>)}</dl>
    {hasCurrentHandoverTerms && depositAmount != null && <p className="font-medium text-stone-900">Khoản giữ chỗ có thể không được hoàn lại <b>{formatVndAmount(depositAmount)}</b>.</p>}
    <ReturnPolicyNotice />
    <p className="text-xs text-stone-600">Phiên bản mới chỉ áp dụng cho đơn đã xác nhận đồng ý. Số tiền, thời hạn và phiên bản điều khoản được lưu cùng báo giá hoặc hợp đồng.</p>
  </section>
}
