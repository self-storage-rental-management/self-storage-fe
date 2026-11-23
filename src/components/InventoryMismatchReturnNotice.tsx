export default function InventoryMismatchReturnNotice() {
  return <aside className="space-y-2 rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm leading-6 text-orange-950" aria-label="Quyết toán khi hàng hóa sai khai báo">
    <p className="font-bold">Trả kho do hàng hóa sai khai báo</p>
    <ul className="list-disc space-y-1 pl-5">
      <li>Tính tiền từ ngày xác nhận nhận kho đến ngày hẹn trả kho dự kiến.</li>
      <li>Manager lập quyết toán, khách xác nhận trước khi hoàn tiền hoặc thu thêm.</li>
    </ul>
  </aside>
}
