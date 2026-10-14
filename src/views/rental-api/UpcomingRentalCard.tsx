export default function UpcomingRentalCard({ days, endDate }: { days: number; endDate: string }) {
  return <section role="status" className="overflow-hidden rounded-xl border border-amber-200 bg-amber-200 text-amber-950">
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide">Hồ sơ sắp hết hạn</p>
        <p className="mt-0.5 text-lg font-bold">{days === 0 ? 'Hết hạn hôm nay · còn 0 ngày' : `Còn ${days} ngày đến hết hạn`}</p>
      </div>
      <p className="rounded-lg bg-amber-300 px-2 py-1 text-xs">Hạn hợp đồng: <strong>{endDate}</strong></p>
    </div>
    <div className="space-y-1 border-t border-amber-400/40 px-3 py-2 text-xs leading-normal">
      <p>Bạn có thể gia hạn hoặc gửi yêu cầu trả kho trước khi hết hạn.</p>
      <p className="font-semibold">Gia hạn chỉ thành công khi bạn đến cơ sở ký hợp đồng gia hạn. Chỉ thanh toán cọc gia hạn chưa được tính là gia hạn thành công.</p>
    </div>
  </section>
}
