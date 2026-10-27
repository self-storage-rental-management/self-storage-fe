import { Card, Badge } from '../../components/ui'
import { REGULATIONS } from '../../data/rentalRegulationsData'

interface Props {
  facilityName?: string
  defaultExpanded?: boolean
}

export default function CustomerRentalRegulations({ facilityName }: Props) {
  return (
    <section className="font-sans space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-amber-900 via-stone-800 to-amber-950 rounded-2xl p-5 sm:p-6 text-white shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Văn bản ban hành chính thức · Áp dụng toàn hệ thống {facilityName ? `· ${facilityName}` : ''}
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase">
            QUY ĐỊNH CHO THUÊ KHO STORAGEHUB
          </h3>
          <p className="text-stone-300 text-sm leading-7">
            Văn bản pháp quy chuẩn hóa quyền và nghĩa vụ của Khách hàng cùng StorageHub, quy định chi tiết về phạm vi sử dụng, giá thuê & thanh toán, điều kiện an toàn, xử lý sự cố và bàn giao kho.
          </p>
        </div>
      </div>

      {/* ── 4 TRỤ CỘT TÓM TẮT ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 border border-stone-200/80 bg-stone-50/50 shadow-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phạm vi & Thời hạn</p>
              <p className="text-sm font-bold text-slate-900">Điều 1 & Điều 2</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2 leading-7">
            Mục đích lưu trữ tài sản, thời điểm bắt đầu/kết thúc và cấm chuyển nhượng trái phép.
          </p>
        </Card>

        <Card className="p-3.5 border border-stone-200/80 bg-stone-50/50 shadow-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-800 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Giá thuê & Gia hạn</p>
              <p className="text-sm font-bold text-slate-900">Điều 3 & Điều 4</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2 leading-7">
            Minh bạch biểu giá, tiền cọc đảm bảo kho, các khoản phí và điều kiện gia hạn trước hạn.
          </p>
        </Card>

        <Card className="p-3.5 border border-stone-200/80 bg-stone-50/50 shadow-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-800 flex items-center justify-center font-bold text-xs">
              03
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">An toàn & Bảo quản</p>
              <p className="text-sm font-bold text-slate-900">Điều 5 & Điều 6</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2 leading-7">
            Danh mục hàng cấm nghiêm ngặt, đóng gói an toàn và phân định trách nhiệm tài sản.
          </p>
        </Card>

        <Card className="p-3.5 border border-stone-200/80 bg-stone-50/50 shadow-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs">
              04
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vận hành & Pháp lý</p>
              <p className="text-sm font-bold text-slate-900">Điều 7, 8 & 9</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2 leading-7">
            Xử lý sự cố, bàn giao trả kho hợp lệ và cơ chế giải quyết khiếu nại tranh chấp.
          </p>
        </Card>
      </div>

      {/* ── DANH SÁCH 9 ĐIỀU KHOẢN (HIỂN THỊ TRỰC TIẾP DẠNG DANH SÁCH) ── */}
      <div className="space-y-3 pt-2">
        <div className="space-y-3">
          {REGULATIONS.map((art) => (
            <Card
              key={art.id}
              className="p-4 border border-stone-200 bg-white hover:border-amber-300 transition-all duration-150"
            >
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${art.iconBg}`}>
                    {art.articleNumber}
                  </span>
                  <h4 className="text-base font-bold text-slate-900">
                    {art.title}
                  </h4>
                </div>
                <Badge variant={art.badgeVariant}>
                  {art.categoryLabel}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                {art.clauses.map((clause, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 leading-7">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-600 font-bold text-xs shrink-0 mt-1 border border-stone-200">
                      {idx + 1}
                    </span>
                    <span className="flex-1">{clause}</span>
                  </div>
                ))}
              </div>

              {art.importantNote && (
                <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start gap-2">
                  <span className="text-rose-600 font-bold text-sm shrink-0">Lưu ý quan trọng:</span>
                  <p className="text-sm text-rose-800 leading-7 font-medium">{art.importantNote}</p>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Hiệu lực thi hành */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2 text-sm text-slate-600 leading-7">
          <h5 className="font-bold uppercase tracking-wider text-amber-900 text-sm">
            Hiệu lực thi hành và tính pháp lý
          </h5>
          <p>
            1. Bản Quy định này có hiệu lực kể từ ngày StorageHub ban hành chính thức và được dẫn chiếu mặc định vào toàn bộ các Hợp đồng thuê kho, Phiếu xác nhận đặt giữ kho (Hold/Reservation) và Biên bản bàn giao kho.
          </p>
          <p>
            2. Khi có sự thay đổi, bổ sung điều khoản, StorageHub sẽ thông báo công khai trước ít nhất 15 ngày trên cổng quản trị hệ thống và gửi email thông báo đến các khách hàng đang có hợp đồng hiệu lực.
          </p>
        </div>
      </div>
    </section>
  )
}
