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
      <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
        <p><b>Trả trong thời gian chuẩn bị, trước ngày bắt đầu tính tiền:</b> giữ lại 20% tiền thuê sau ưu đãi theo báo giá{setupFee != null ? ` (${formatVndAmount(setupFee)})` : ''} và hoàn 80% tiền thuê. Tiền cọc đảm bảo được quyết toán riêng sau khi nghiệm thu.</p>
        <p className="mt-1 text-xs text-stone-600">Nếu hư hỏng, hệ thống trừ phí hư hỏng vào cọc một tháng trước; chỉ phần vượt cọc mới yêu cầu khách thanh toán thêm. Không nhập phí tự do: nhân viên chọn hạng mục, số lượng/diện tích theo bảng giá chuẩn.</p>
        <p className="mt-1 text-xs text-stone-600"><b>Hư hỏng nhẹ</b> gồm trầy xước, bong tróc sơn, vết bẩn khó vệ sinh; <b>hư hỏng nặng</b> gồm cửa cong, khóa hỏng, sàn nứt/vỡ hoặc hư hỏng làm mất an toàn, không thể sử dụng.</p>
        <p className="mt-1 text-xs text-stone-600">Nếu việc trả kho phát sinh vì hàng không khớp khai báo, Staff ghi nhận nguyên nhân và bằng chứng để cơ sở xem xét. Hệ thống không tự động coi đây là khách tự ý hủy.</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
        <p><b>Trả sau khi kỳ thuê đã bắt đầu:</b> tháng đã bắt đầu được tính trọn tháng; hệ thống hoàn tiền thuê của các tháng chưa bắt đầu. Nếu hư hỏng vượt tiền cọc một tháng, phần vượt tiếp tục trừ vào tiền thuê chưa sử dụng; vượt cả khoản này thì khách thanh toán thêm.</p>
      </div>
      <p><b>Báo trước:</b> thời hạn báo trước theo hợp đồng dùng để sắp lịch nghiệm thu. Hệ thống vẫn chốt tiền thuê theo các tháng đã bắt đầu và hoàn các tháng chưa bắt đầu.</p>
      <p><b>Nghiệm thu:</b> hư hỏng, vệ sinh, mất vật dụng, quá hạn hoặc công nợ chỉ được khấu trừ khi có căn cứ, biên bản và số tiền từng khoản. Khách được xem ảnh/chứng từ, tổng khấu trừ, số cọc được hoàn hoặc tiền phải trả thêm và có quyền yêu cầu xem xét trước khi xác nhận quyết toán.</p>
      <p><b>Thời hạn quyết toán:</b> Staff nghiệm thu trong 4 giờ làm việc sau khi khách bàn giao đủ điều kiện. Manager duyệt trong 6 giờ sau khi nhận đủ hồ sơ. Khách có 72 giờ xem và xác nhận bảng kê. Quá hạn không tự động đồng ý thay khách.</p>
      <p className="font-medium">Phí trả kho khác với khoản thanh toán trước 20% để giữ chỗ. Không mặc định mất toàn bộ cọc đảm bảo khi trả kho.</p>
      {business && <p className="border-t border-amber-200 pt-3">BO cần công bố điều kiện, công thức và mức phí trong gói thuê trước khi khách nhận báo giá. Quyết toán dùng phiên bản đã lưu theo đơn, không áp chính sách mới ngược cho hợp đồng cũ. Nếu hồ sơ thiếu bảng giá đã lưu hoặc có tranh chấp, cần xem xét thủ công trước khi chốt.</p>}
      {!terms && <p className="text-stone-600">Mức phí và số ngày báo trước cụ thể nằm trong báo giá/hợp đồng đã chấp nhận. Bảng quyết toán sau nghiệm thu là nơi đối chiếu số tiền thực tế; không có một mức phạt cố định cho mọi đơn.</p>}
    </div>
    </details>
  </div>
}
