export default function InventoryMismatchReturnNotice() {
  return <aside className="space-y-2 rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm leading-6 text-orange-950" aria-label="Quyết toán khi hàng hóa sai khai báo">
    <p className="font-bold">Trả kho do hàng hóa sai khai báo</p>
    <ul className="list-disc space-y-1 pl-5">
      <li>Tiền sử dụng tính theo ngày lịch từ ngày xác nhận nhận kho đến ngày bàn giao kho trống, tính cả hai ngày. Cùng ngày tính 1 ngày.</li>
      <li>Hạn trả hàng có hiệu lực từ ngày kế tiếp ngày thông báo, kéo dài 7 ngày.</li>
      <li>Không thu phí chấm dứt sớm cố định. Manager duyệt bảng kê trong 6 giờ sau khi nhận đủ hồ sơ. Bạn xác nhận trước khi hoàn phần còn lại hoặc thanh toán thêm.</li>
    </ul>
  </aside>
}
