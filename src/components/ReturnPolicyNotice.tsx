import { formatVndAmount } from '../i18n/currency'

type Terms = { setupEarlyExitFee?: number | null; earlyTerminationFee?: number | null; earlyTerminationNoticeDays?: number | null }
export default function ReturnPolicyNotice({ terms, business = false }: { terms?: Terms; business?: boolean }) {
  return <details className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-6 text-stone-800">
    <summary className="cursor-pointer font-semibold text-amber-950">Quy định phí trả kho, nghiệm thu và hoàn cọc{terms?.earlyTerminationFee != null ? ` · Phí chấm dứt sớm theo báo giá: ${formatVndAmount(terms.earlyTerminationFee)}` : ''}</summary>
    <div className="mt-3 space-y-3">
      <p><b>Trả kho đúng hạn:</b> không tự động chịu phí chấm dứt sớm. Tiền cọc đảm bảo được quyết toán sau khi đối chiếu công nợ và hiện trạng kho.</p>
      <p><b>Trả trong thời gian chuẩn bị:</b> áp dụng phí chấm dứt một lần theo báo giá đã chấp nhận{terms?.setupEarlyExitFee != null ? ` (${formatVndAmount(terms.setupEarlyExitFee)})` : ''}. Nếu đã chuyển hàng vào, có thể tính thêm số ngày sử dụng theo đơn giá niêm yết. Nếu chưa chuyển hàng vào, không tính khoản sử dụng hàng trong thời gian chuẩn bị.</p>
      <p><b>Trả sớm khi kỳ thuê đã bắt đầu:</b> tiền thuê và ưu đãi được tính lại theo thời gian thực tế. Dưới 3 tháng trọn vẹn, áp dụng đơn giá niêm yết và phí chấm dứt sớm theo điều khoản đã lưu. Từ 3 tháng trọn vẹn, tính lại theo bậc gói đủ điều kiện, không thu khoản phí chấm dứt sớm này.</p>
      <p><b>Báo trước:</b> {terms?.earlyTerminationNoticeDays != null ? `cần báo trước ${terms.earlyTerminationNoticeDays} ngày theo báo giá này` : 'thời hạn báo trước áp dụng theo điều khoản của đơn'}. Thiếu thời gian báo trước có thể phát sinh tiền sử dụng cho số ngày thiếu, tối đa số ngày còn lại của kỳ thuê. Khoản này được tính trong tiền sử dụng, không cộng hai lần.</p>
      <p><b>Nghiệm thu:</b> hư hỏng, vệ sinh, mất vật dụng, quá hạn hoặc công nợ chỉ được khấu trừ khi có căn cứ, biên bản và số tiền từng khoản. Khách được xem ảnh/chứng từ, tổng khấu trừ, số cọc được hoàn hoặc tiền phải trả thêm và có quyền yêu cầu xem xét trước khi xác nhận quyết toán.</p>
      <p className="font-medium">Phí trả kho khác với khoản thanh toán trước 20% để giữ chỗ. Không mặc định mất toàn bộ cọc đảm bảo khi trả kho.</p>
      {business && <p className="border-t border-amber-200 pt-3">BO cần công bố điều kiện, công thức và mức phí trong gói thuê trước khi khách nhận báo giá. Quyết toán dùng phiên bản đã lưu theo đơn, không áp chính sách mới ngược cho hợp đồng cũ. Nếu hồ sơ thiếu bảng giá đã lưu hoặc có tranh chấp, cần xem xét thủ công trước khi chốt.</p>}
      {!terms && <p className="text-stone-600">Mức phí và số ngày báo trước cụ thể nằm trong báo giá/hợp đồng đã chấp nhận. Bảng quyết toán sau nghiệm thu là nơi đối chiếu số tiền thực tế; không có một mức phạt cố định cho mọi đơn.</p>}
    </div>
  </details>
}
