export default function InventoryGoodsNotice() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
      <h3 className="font-semibold">Lưu ý về hàng hóa trong thời gian thuê</h3>
      <div className="mt-2 space-y-2">
        <p>Danh sách hàng hóa được ghi nhận tại thời điểm kiểm kê nhằm đối chiếu với khai báo, khả năng lưu trữ và điều kiện an toàn của gian kho.</p>
        <p>Trong thời gian thuê, khách hàng có trách nhiệm tự bảo đảm hàng hóa lưu trữ phù hợp với quy định của StorageHub, không vượt quá giới hạn kho và không thuộc danh mục hàng cấm hoặc hàng có nguy cơ cháy, nổ.</p>
        <p>Nếu hàng hóa do khách đưa vào gây cháy, nổ hoặc thiệt hại, trách nhiệm bồi thường được xác định theo nguyên nhân, mức độ thiệt hại thực tế, hợp đồng và quy định pháp luật.</p>
      </div>
    </section>
  )
}
