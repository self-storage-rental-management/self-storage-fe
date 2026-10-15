export default function OverdueRentalCard({ days, endDate, recoveryDate, started = false, fee, loading = false, error = false }: {
  days: number | null; endDate: string; recoveryDate?: string; started?: boolean; fee?: string; loading?: boolean; error?: boolean
}) {
  return <section role="status" className="overflow-hidden rounded-xl border border-red-800 bg-red-800 text-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 px-3 py-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-red-100">Hồ sơ đã quá hạn sử dụng</p>
        <p className="mt-0.5 text-lg font-bold">{days != null ? `Đã quá hạn ${days} ngày` : 'Đã hết hạn hợp đồng'}</p>
      </div>
      <p className="rounded-lg bg-red-900 px-2 py-1 text-xs">Hạn hợp đồng: <strong>{endDate}</strong></p>
    </div>
    <div className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(200px,0.7fr)]">
      <div>
        <p className="text-xs text-red-100">{started ? 'Đã chuyển sang xử lý thu hồi' : 'Ngày chuyển sang xử lý thu hồi'}</p>
        <p className="mt-0.5 text-base font-bold">{loading ? 'Đang tải…' : error ? 'Chưa tải được' : recoveryDate || 'Chưa được thiết lập'}</p>
        {!started && recoveryDate && <p className="mt-1 text-xs leading-normal">Kho sẽ tự động chuyển sang xử lý thu hồi vào ngày này nếu chưa hoàn tất gia hạn hoặc trả kho.</p>}
      </div>
      <div className="rounded-lg border border-red-900 bg-red-900 p-2">
        <p className="text-xs text-red-100">Tiền quá hạn phải trả (tạm tính)</p>
        <p className="mt-1 text-lg font-bold">{loading ? 'Đang tải…' : error ? 'Chưa tải được' : fee || 'Chưa có mức phí áp dụng'}</p>
      </div>
    </div>
    <div className="border-t border-white/15 px-3 py-2">
      <p className="text-xs font-semibold leading-normal">Gia hạn chỉ thành công khi bạn đến cơ sở ký hợp đồng gia hạn. Chỉ thanh toán cọc gia hạn chưa được tính là gia hạn thành công.</p>
      {error && <p className="mt-2 text-xs text-red-100">Chưa tải được hạn thu hồi và phí quá hạn. Vui lòng tải lại trang.</p>}
    </div>
  </section>
}
