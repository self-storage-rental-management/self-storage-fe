import { useState, useMemo } from 'react'
import { Card, Badge, Button, Input } from '../../components/ui'
import type { User } from '../../types'

interface Props {
  user?: User
  lang?: string
}

import { REGULATIONS, type RegulationArticle } from '../../data/rentalRegulationsData'


export default function BusinessRentalRegulationsPanel({ lang = 'vi' }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'scope' | 'finance' | 'safety' | 'operations'>('all')
  const [copied, setCopied] = useState(false)

  const filteredRegulations = useMemo(() => {
    return REGULATIONS.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const inTitle = item.title.toLowerCase().includes(q)
      const inArt = item.articleNumber.toLowerCase().includes(q)
      const inClauses = item.clauses.some((c) => c.toLowerCase().includes(q))
      const inNote = item.importantNote ? item.importantNote.toLowerCase().includes(q) : false
      return inTitle || inArt || inClauses || inNote
    })
  }, [searchQuery, activeCategory])

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
              Văn bản pháp quy chuẩn hóa quyền và nghĩa vụ của Khách hàng cùng StorageHub; quy định chi tiết về phạm vi sử dụng, thanh toán, điều kiện an toàn, quy trình xử lý sự cố và chấm dứt hợp đồng lưu trữ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs px-3.5 py-2"
              onClick={handleCopyAll}
            >
              {copied ? '✓ Đã sao chép toàn văn' : 'Sao chép toàn văn'}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3.5 py-2 font-semibold shadow-sm"
              onClick={handlePrint}
            >
              In / Xuất bản PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── HIGHLIGHT METRICS / PILLARS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-stone-200/80 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold text-sm">
              01
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Phạm vi & Thời hạn</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Điều 1 & Điều 2</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            Mục đích lưu trữ tài sản, thời điểm bắt đầu/kết thúc và cấm chuyển nhượng trái phép.
          </p>
        </Card>

        <Card className="p-4 border border-stone-200/80 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center font-bold text-sm">
              02
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Giá thuê & Gia hạn</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Điều 3 & Điều 4</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            Minh bạch biểu giá, phí dịch vụ, tiền đặt cọc và cơ chế gia hạn trước hạn.
          </p>
        </Card>

        <Card className="p-4 border border-stone-200/80 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center font-bold text-sm">
              03
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">An toàn & Bảo quản</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Điều 5 & Điều 6</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            Danh mục hàng cấm nghiêm ngặt, trách nhiệm đóng gói và lập biên bản hiện trạng.
          </p>
        </Card>

        <Card className="p-4 border border-stone-200/80 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm">
              04
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Vận hành & Pháp lý</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Điều 7, 8 & 9</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            Xử lý sự cố hạ tầng, bàn giao trả kho hợp lệ và giải quyết khiếu nại tranh chấp.
          </p>
        </Card>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <Card className="p-4 border border-stone-200/80 bg-white shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Categories */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Tất cả 9 Điều' },
              { id: 'scope', label: 'Phạm vi & Thời hạn' },
              { id: 'finance', label: 'Giá thuê & Gia hạn' },
              { id: 'safety', label: 'An toàn & Tài sản' },
              { id: 'operations', label: 'Sự cố & Bàn giao' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id as any)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-amber-800 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="w-full md:w-72">
            <Input
              placeholder="Tìm kiếm điều khoản, từ khóa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {searchQuery.trim() && (
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-stone-100">
            <span>
              Tìm thấy <strong>{filteredRegulations.length}</strong> / 9 điều khoản khớp với từ khóa "{searchQuery}"
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-amber-800 hover:underline font-semibold cursor-pointer"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        )}
      </Card>

      {/* ── ARTICLES GRID / LIST ── */}
      <div className="space-y-4">
        {filteredRegulations.length === 0 ? (
          <Card className="p-12 text-center border border-dashed border-stone-300 bg-white">
            <p className="text-sm font-semibold text-slate-700">Không tìm thấy điều khoản phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Hãy thử tìm kiếm với từ khóa khác hoặc chuyển nhóm danh mục.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery('')
                setActiveCategory('all')
              }}
            >
              Xem lại tất cả điều khoản
            </Button>
          </Card>
        ) : (
          filteredRegulations.map((art) => (
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
          ))
        )}
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
