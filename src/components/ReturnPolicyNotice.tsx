import { formatVndAmount } from '../i18n/currency'

type Terms = {
  setupEarlyExitFee?: number | null
  earlyTerminationFee?: number | null
  earlyTerminationNoticeDays?: number | null
  totalAfterDiscount?: number | null
  monthlyPrice?: number | null
  rentalMonths?: number | null
  reservationDepositAmount?: number | null
  earlyTerminationFeeCoefficient?: number | null
}
export default function ReturnPolicyNotice({ terms, business = false }: { terms?: Terms; business?: boolean }) {
  const setupFee = terms?.setupEarlyExitFee ?? null
  return <div className="space-y-2">
    {setupFee != null && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
      <b>Các khoản phí trong báo giá</b>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        {setupFee != null && <span>Trả trong thời gian chuẩn bị: <b>{formatVndAmount(setupFee)}</b></span>}
      </div>
      <p className="mt-1 text-amber-900"><b>Khoản giữ lại khi trả trong thời gian chuẩn bị</b> = 20% tiền thuê sau ưu đãi{terms?.totalAfterDiscount != null ? ` (${formatVndAmount(terms.totalAfterDiscount)})` : ''} = <b>{formatVndAmount(setupFee)}</b>; khách được hoàn 80% tiền thuê còn lại. Tiền cọc đảm bảo được quyết toán riêng.</p>
      <p className="mt-1 text-amber-900">Phí hư hỏng chỉ được tính theo hạng mục và bảng giá chuẩn trong biên bản nghiệm thu.</p>
    </div>}
    <details className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-6 text-stone-800">
    <summary className="cursor-pointer font-semibold text-amber-950">Quy định trả kho, nghiệm thu và hoàn tiền</summary>
    <div className="mt-3 space-y-3">
      <p><b>Trả kho đúng hạn:</b> không tự động chịu phí chấm dứt sớm. Tiền cọc đảm bảo được quyết toán sau khi đối chiếu công nợ và hiện trạng kho.</p>
      <p><b>Trả trong thời gian chuẩn bị:</b> tiền sử dụng tính theo ngày lịch từ ngày xác nhận nhận kho đến ngày bàn giao kho trống, tính cả hai ngày. Cùng ngày tính 1 ngày. Tiền sử dụng bằng đơn giá tháng nhân số ngày rồi chia 30, làm tròn một lần đến đồng. Khoản phí chấm dứt đã chấp thuận trong báo giá{terms?.setupEarlyExitFee != null ? ` (${formatVndAmount(terms.setupEarlyExitFee)})` : ''} vẫn áp dụng cho trả setup thông thường. Hồ sơ cũ giữ điều khoản đã lưu.</p>
      <p><b>Trả do kiểm kê sai lệch:</b> không thu phí chấm dứt sớm cố định. Yêu cầu trả có hiệu lực từ ngày kế tiếp ngày thông báo và có 7 ngày trả hàng. Không tính thêm ngày cơ sở chậm thu hồi sau hạn. Tiền sử dụng và khoản khấu trừ hợp lệ được trừ vào tiền đã đóng, hoàn phần còn lại hoặc thu thêm phần thiếu.</p>
      <p><b>Trả sớm khi kỳ thuê đã bắt đầu:</b> tiền thuê và ưu đãi được tính lại theo thời gian thực tế. Dưới 3 tháng trọn vẹn, áp dụng đơn giá niêm yết và phí chấm dứt sớm theo điều khoản đã lưu. Từ 3 tháng trọn vẹn, tính lại theo bậc gói đủ điều kiện, không thu khoản phí chấm dứt sớm này.</p>
      <p><b>Báo trước:</b> {terms?.earlyTerminationNoticeDays != null ? `cần báo trước ${terms.earlyTerminationNoticeDays} ngày theo báo giá này` : 'thời hạn báo trước áp dụng theo điều khoản của đơn'}. Thiếu thời gian báo trước có thể phát sinh tiền sử dụng cho số ngày thiếu, tối đa số ngày còn lại của kỳ thuê. Khoản này được tính trong tiền sử dụng, không cộng hai lần.</p>
      <p><b>Nghiệm thu:</b> hư hỏng, vệ sinh, mất vật dụng, quá hạn hoặc công nợ chỉ được khấu trừ khi có căn cứ, biên bản và số tiền từng khoản. Khách được xem ảnh/chứng từ, tổng khấu trừ, số cọc được hoàn hoặc tiền phải trả thêm và có quyền yêu cầu xem xét trước khi xác nhận quyết toán.</p>
      <p><b>Thời hạn quyết toán:</b> Staff nghiệm thu trong 4 giờ làm việc sau khi khách bàn giao đủ điều kiện. Manager duyệt trong 6 giờ sau khi nhận đủ hồ sơ. Khách có 72 giờ xem và xác nhận bảng kê. Quá hạn không tự động đồng ý thay khách.</p>
      <p className="font-medium">Phí trả kho khác với khoản thanh toán trước 20% để giữ chỗ. Không mặc định mất toàn bộ cọc đảm bảo khi trả kho.</p>
      {business && <p className="border-t border-amber-200 pt-3">BO cần công bố điều kiện, công thức và mức phí trong gói thuê trước khi khách nhận báo giá. Quyết toán dùng phiên bản đã lưu theo đơn, không áp chính sách mới ngược cho hợp đồng cũ. Nếu hồ sơ thiếu bảng giá đã lưu hoặc có tranh chấp, cần xem xét thủ công trước khi chốt.</p>}
      {!terms && <p className="text-stone-600">Mức phí và số ngày báo trước cụ thể nằm trong báo giá/hợp đồng đã chấp nhận. Bảng quyết toán sau nghiệm thu là nơi đối chiếu số tiền thực tế; không có một mức phạt cố định cho mọi đơn.</p>}
    </div>
    </details>
  </div>
}
