import { useState } from 'react'
import { Card, Badge, Button } from '../../components/ui'
import type { User } from '../../types'
import { REGULATIONS } from '../../data/rentalRegulationsData'

interface Props {
  user?: User
  lang?: string
}

export default function BusinessRentalRegulationsPanel({ lang = 'vi' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopyAll = () => {
    const fullText = `QUY ĐỊNH CHO THUÊ KHO STORAGEHUB\n\n` +
      REGULATIONS.map(
        (r) => `${r.articleNumber}. ${r.title}\n` + r.clauses.map((c, i) => `${i + 1}. ${c}`).join('\n')
      ).join('\n\n')

    void navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 fade-in pb-12">
      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-amber-900 via-stone-800 to-amber-950 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Văn bản ban hành chính thức · Áp dụng toàn hệ thống
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase">
              QUY ĐỊNH CHO THUÊ KHO STORAGEHUB
            </h1>
            <p className="text-stone-300 text-sm leading-relaxed">
              Văn bản pháp quy chuẩn hóa quyền và nghĩa vụ của Khách hàng cùng StorageHub, quy định chi tiết về phạm vi sử dụng, thanh toán, điều kiện an toàn, quy trình xử lý sự cố và chấm dứt hợp đồng lưu trữ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs px-3.5 py-2 cursor-pointer"
              onClick={handleCopyAll}
            >
              {copied ? '✓ Đã sao chép toàn văn' : 'Sao chép toàn văn'}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3.5 py-2 font-semibold shadow-sm cursor-pointer"
              onClick={handlePrint}
            >
              In / Xuất bản PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── KHỐI 1: QUY CHUẨN VẬN HÀNH CỐT LÕI & ĐIỀU KHOẢN HỢP ĐỒNG ── */}
      <Card className="p-6 border border-stone-200/90 shadow-sm bg-gradient-to-br from-stone-50 via-white to-amber-50/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200/70 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {lang === "vi" ? "Quy định pháp lý & Vận hành chuẩn hóa" : "Legal & Operations"}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {lang === "vi" ? "Hiển thị bên Customer" : "Hiển thị bên Customer"}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {lang === "vi" ? "Chính Sách & Quy Định Áp Dụng Đi Kèm Biểu Giá" : "Policies & Regulations Applicable to Pricing"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {lang === "vi"
                ? "Các thông số này được công bố trực tiếp cho khách hàng khi xem chi tiết loại kho, đặt giữ chỗ và thanh lý hợp đồng trên Customer Portal."
                : "These parameters are published directly to customers when viewing units, reserving, and settling agreements on the Customer Portal."}
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            className="bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs px-4 py-2 self-start md:self-auto shrink-0 shadow-sm flex items-center gap-1.5 cursor-pointer"
            onClick={() => {
              const el = document.getElementById('regulations-articles')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span>{lang === "vi" ? "Xem Toàn Văn 12 Điều Khoản" : "View Full 12 Articles"}</span>
            <span>↓</span>
          </Button>
        </div>

        {/* 5 Chỉ Số Vận Hành Cốt Lõi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-4">
          <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Phí Quá Hạn</span>
            <div className="text-base font-extrabold text-amber-700 font-mono mt-1">50% / ngày</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Phí mỗi ngày = 50% × (đơn giá thuê tháng ÷ 30). Tự động tính theo số ngày trễ.</p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Phí Giữ Chỗ</span>
            <div className="text-base font-extrabold text-amber-600 font-mono mt-1">10% – 30%</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Cấu hình theo từng gói thuê (mặc định 20%). Trừ trực tiếp vào tiền thuê khi nhận kho.</p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tiền Cọc Đảm Bảo Kho</span>
            <div className="text-base font-extrabold text-emerald-700 font-mono mt-1">Theo loại kho</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Thu khi nhận kho, hoàn trả lại sau kiểm tra nghiệm thu trả kho, vệ sinh và công nợ.</p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Thời Hạn Thuê Tối Thiểu</span>
            <div className="text-base font-extrabold text-slate-900 font-mono mt-1">01 Tháng</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Kỳ thuê sử dụng trọn tháng. Chi tiết xác nhận trên báo giá hợp đồng.</p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Gia Hạn Quá Hạn</span>
            <div className="text-base font-extrabold text-blue-700 font-mono mt-1">Tối Đa 7 Ngày</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Khách có tối đa 7 ngày để hoàn tất gia hạn. Đến ngày thứ 8 chuyển thu hồi kho.</p>
          </div>
        </div>

        {/* Quy Định Trả Kho & Gia Hạn Mẫu Hiển Thị Khách Hàng */}
        <div className="mt-4 pt-4 border-t border-stone-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-rose-900 text-sm">Quy định trả kho và gia hạn (Công bố khách hàng)</h4>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
              Hiển thị tại Customer Portal
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <article className="rounded-xl border border-rose-200 bg-white p-3.5">
              <b className="text-slate-800 text-sm">Trả kho sau ngày hết hạn</b>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-stone-700 leading-relaxed">
                <li>Thời gian quá hạn tính từ ngày kế tiếp ngày hết hạn đến khi bàn giao và nghiệm thu kho thực tế.</li>
                <li>Phí mỗi ngày = 50% × (đơn giá thuê tháng ÷ 30 ngày).</li>
                <li>Tổng phí bằng số ngày quá hạn nhân với phí mỗi ngày. Khoản còn thiếu sau khấu trừ tiền cọc đảm bảo kho được đưa vào quyết toán.</li>
              </ul>
            </article>
            <article className="rounded-xl border border-amber-200 bg-white p-3.5">
              <b className="text-slate-800 text-sm">Gia hạn kỳ thuê</b>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-stone-700 leading-relaxed">
                <li>Yêu cầu gia hạn không tự động kéo dài kỳ thuê và cần được cơ sở xác nhận.</li>
                <li>Khách hàng hoàn tất hồ sơ và các khoản phải thu trước khi kỳ gia hạn có hiệu lực.</li>
              </ul>
            </article>
          </div>
          <p className="rounded-lg bg-rose-50 border border-rose-200/70 p-3 text-xs leading-5 text-rose-900 font-medium">
            Ví dụ tính phạt mẫu (giá kho 3.000.000 đ/tháng): 3.000.000 đ ÷ 30 × 50% = 50.000 đ/ngày. Trễ 4 ngày tương ứng 200.000 đ (khấu trừ trực tiếp vào tiền cọc đảm bảo kho khi quyết toán).
          </p>
        </div>
      </Card>

      {/* ── ARTICLES GRID / LIST ── */}
      <div id="regulations-articles" className="space-y-4">
        {REGULATIONS.map((art) => (
          <Card
            key={art.id}
            className="p-5 sm:p-6 border border-stone-200/90 shadow-2xs bg-white hover:border-amber-300 transition-all duration-200"
          >
            {/* Article Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${art.iconBg}`}>
                  {art.articleNumber}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {art.title}
                </h2>
              </div>
              <div className="self-start sm:self-auto">
                <Badge variant={art.badgeVariant}>
                  {art.categoryLabel}
                </Badge>
              </div>
            </div>

            {/* Clauses List */}
            <div className="mt-4 space-y-3">
              {art.clauses.map((clause, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-600 font-bold text-xs shrink-0 mt-0.5 border border-stone-200">
                    {idx + 1}
                  </span>
                  <span className="flex-1">{clause}</span>
                </div>
              ))}
            </div>

            {/* Important Note (if any) */}
            {art.importantNote && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50/80 border border-rose-200/90 flex items-start gap-3">
                <span className="text-rose-600 font-bold text-sm shrink-0">⚠️ Lưu ý quan trọng:</span>
                <p className="text-xs text-rose-800 leading-relaxed font-medium">{art.importantNote}</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* ── FOOTER LEGAL NOTICE ── */}
      <Card className="p-5 border border-amber-200/70 bg-amber-50/40 rounded-xl space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
          Hiệu lực thi hành và tính pháp lý
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          1. Bản Quy định này có hiệu lực kể từ ngày StorageHub ban hành chính thức và được dẫn chiếu mặc định vào toàn bộ các Hợp đồng thuê kho, Phiếu xác nhận đặt giữ kho (Hold/Reservation) và Biên bản bàn giao kho.
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">
          2. Khi có sự thay đổi, bổ sung điều khoản nhằm đáp ứng quy chuẩn kỹ thuật hoặc quy định mới của pháp luật, StorageHub sẽ thông báo công khai trước ít nhất 15 ngày trên cổng quản trị hệ thống và gửi email thông báo đến các khách hàng đang có hợp đồng hiệu lực.
        </p>
      </Card>
    </div>
  )
}
