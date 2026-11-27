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
export default function ReturnPolicyNotice({ terms, business = false, showQuoteFees = true }: { terms?: Terms; business?: boolean; showQuoteFees?: boolean }) {
  const setupFee = terms?.setupEarlyExitFee ?? null
  return <div className="space-y-2">
    {showQuoteFees && setupFee != null && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
      <b>Các khoản phí trong báo giá</b>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        {setupFee != null && <span>Trả trong thời gian chuẩn bị: <b>{formatVndAmount(setupFee)}</b></span>}
      </div>

    </div>}
    <details className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-6 text-stone-800">
    <summary className="cursor-pointer font-semibold text-amber-950">Quy định trả kho, nghiệm thu và hoàn tiền</summary>
    <div className="mt-3 space-y-3">
      <p><b>Trả đúng hạn:</b> không tự động chịu phí chấm dứt sớm. Tiền cọc được quyết toán sau khi đối chiếu công nợ và hiện trạng kho.</p>
      <p><b>Trả trong thời gian chuẩn bị:</b> quyết toán theo điều khoản đã chấp nhận của đơn. Với hồ sơ tính theo ngày, tiền sử dụng = đơn giá tháng × số ngày sử dụng ÷ 30, tính cả ngày nhận kho và ngày trả kho, cộng khoản phí đã chốt trong báo giá.</p>
      <p><b>Trả do kiểm kê sai lệch:</b> không thu phí chấm dứt sớm cố định. Tiền sử dụng tính từ ngày khách xác nhận đã đưa hàng vào kho đến ngày trả, tính cả hai ngày và không vượt hạn trả đã chốt. Thời hạn trả và gia hạn hiển thị trong hồ sơ.</p>
      <p><b>Trả sớm sau khi kỳ thuê bắt đầu:</b> tháng thuê đã bắt đầu tính trọn tháng theo đơn giá bình quân từ tiền thuê sau ưu đãi đã chốt; hoàn tiền thuê của các tháng chưa bắt đầu. Không tính lại bậc gói hoặc cộng phí chấm dứt sớm riêng.</p>
      <p><b>Báo trước:</b> {terms?.earlyTerminationNoticeDays != null ? `báo trước ${terms.earlyTerminationNoticeDays} ngày theo báo giá` : 'theo thời hạn trong đơn'} để sắp lịch bàn giao và nghiệm thu. Không cộng phí riêng do thiếu ngày báo trước.</p>
      <p><b>Nghiệm thu và khấu trừ:</b> các khoản hư hỏng, vệ sinh, mất vật dụng, quá hạn và công nợ phải có căn cứ và số tiền từng khoản. Khấu trừ vào cọc trước; khi kỳ thuê đã bắt đầu, phần vượt cọc được trừ tiếp vào tiền thuê được hoàn, còn thiếu thì khách thanh toán thêm.</p>
      <p><b>Xác nhận quyết toán:</b> khách được xem biên bản, bằng chứng và bảng kê để xác nhận hoặc yêu cầu xem xét. Quá hạn không tự động được coi là đồng ý. Số tiền hoàn hoặc phải trả thêm được chốt trong hồ sơ quyết toán.</p>
      <p className="font-medium">Khoản trả trước 20% để giữ chỗ khác với cọc đảm bảo. Không mặc định mất toàn bộ cọc khi trả kho.</p>
      {business && <p className="border-t border-amber-200 pt-3">Quyết toán theo bảng giá và điều khoản đã lưu của đơn. Hồ sơ thiếu dữ liệu hoặc có tranh chấp cần được đối soát trước khi chốt.</p>}
    </div>
    </details>
  </div>
}
