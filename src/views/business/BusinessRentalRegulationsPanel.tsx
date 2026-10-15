import { useState, useMemo } from 'react'
import { Card, Badge, Button, Input } from '../../components/ui'
import type { User } from '../../types'

interface Props {
  user?: User
  lang?: string
}

interface RegulationArticle {
  id: number
  articleNumber: string
  title: string
  category: 'scope' | 'finance' | 'safety' | 'operations'
  categoryLabel: string
  badgeVariant: 'info' | 'warning' | 'purple' | 'success'
  iconBg: string
  clauses: string[]
  importantNote?: string
}

const REGULATIONS: RegulationArticle[] = [
  {
    id: 1,
    articleNumber: 'Điều 1',
    title: 'Đối tượng và phạm vi sử dụng',
    category: 'scope',
    categoryLabel: 'Phạm vi sử dụng',
    badgeVariant: 'info',
    iconBg: 'bg-blue-50 text-blue-700 border-blue-200',
    clauses: [
      'Khách hàng được quyền sử dụng khu vực lưu trữ được chỉ định trong hợp đồng trong thời hạn đã thỏa thuận.',
      'Kho chỉ được sử dụng để lưu trữ tài sản, không được sử dụng làm nơi cư trú, nơi sản xuất hoặc hoạt động khác trái với mục đích thuê.',
      'Khách hàng không được tự ý chuyển nhượng hoặc cho thuê lại kho nếu chưa được StorageHub chấp thuận.',
    ],
  },
  {
    id: 2,
    articleNumber: 'Điều 2',
    title: 'Thời hạn thuê',
    category: 'scope',
    categoryLabel: 'Thời hạn hợp đồng',
    badgeVariant: 'info',
    iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    clauses: [
      'Thời hạn thuê do hai bên thỏa thuận và được ghi rõ trong hợp đồng.',
      'Thời điểm bắt đầu và kết thúc thuê phải được xác định rõ, tránh phát sinh tranh chấp về ngày tính phí.',
      'Việc thay đổi thời hạn thuê phải được xác nhận trước khi kỳ thuê mới bắt đầu.',
    ],
  },
  {
    id: 3,
    articleNumber: 'Điều 3',
    title: 'Giá thuê và thanh toán',
    category: 'finance',
    categoryLabel: 'Giá thuê & Thanh toán',
    badgeVariant: 'purple',
    iconBg: 'bg-purple-50 text-purple-700 border-purple-200',
    clauses: [
      'Giá thuê, mức giảm giá, kỳ thanh toán và các khoản phí phải được thông báo rõ trước khi khách hàng xác nhận giao dịch.',
      'Mức giảm giá chỉ áp dụng khi khách đáp ứng điều kiện của chính sách đã công bố.',
      'Các khoản đặt cọc, phí dịch vụ và điều kiện hoàn trả phải được quy định riêng, không gộp mơ hồ vào tiền thuê.',
      'Khi thanh toán trễ hạn, StorageHub thông báo cho khách hàng và áp dụng biện pháp xử lý theo hợp đồng và pháp luật có liên quan.',
    ],
  },
  {
    id: 4,
    articleNumber: 'Điều 4',
    title: 'Gia hạn hợp đồng',
    category: 'finance',
    categoryLabel: 'Gia hạn thuê',
    badgeVariant: 'purple',
    iconBg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    clauses: [
      'Khách hàng có thể gửi yêu cầu gia hạn trước ngày kết thúc hợp đồng.',
      'Gia hạn cần xác nhận thời hạn mới, giá thuê, ưu đãi và các điều kiện áp dụng.',
      'Chính sách giá mới không tự động thay đổi khoản tiền đã chốt cho kỳ thuê cũ.',
      'Nếu khách hàng đã hết hạn thuê, việc tiếp tục sử dụng kho phải được kiểm tra và xác nhận lại theo quy trình.',
    ],
  },
  {
    id: 5,
    articleNumber: 'Điều 5',
    title: 'Hàng hóa bị cấm hoặc hạn chế',
    category: 'safety',
    categoryLabel: 'An toàn & Hàng cấm',
    badgeVariant: 'warning',
    iconBg: 'bg-rose-50 text-rose-700 border-rose-200',
    clauses: [
      'Không được lưu trữ tài sản bị pháp luật cấm, chất dễ cháy nổ, chất độc hại hoặc hàng hóa gây nguy hiểm.',
      'Không được lưu trữ động vật sống, hàng dễ phân hủy hoặc vật phẩm có nguy cơ gây ô nhiễm, hư hại cho kho và tài sản khác.',
      'Khách hàng phải tuân thủ hướng dẫn an toàn và thông báo các yêu cầu bảo quản đặc biệt khi có liên quan.',
    ],
    importantNote: 'Nghiêm cấm tuyệt đối hóa chất dễ nổ, pháo hoa, vũ khí, hàng lậu và chất độc hại. Vi phạm sẽ bị đơn phương hủy hợp đồng và chuyển giao cơ quan chức năng.',
  },
  {
    id: 6,
    articleNumber: 'Điều 6',
    title: 'Bảo quản và trách nhiệm tài sản',
    category: 'safety',
    categoryLabel: 'Trách nhiệm tài sản',
    badgeVariant: 'warning',
    iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
    clauses: [
      'Khách hàng có trách nhiệm đóng gói, sắp xếp và bảo quản tài sản phù hợp với điều kiện của kho.',
      'Các bên phối hợp ghi nhận hiện trạng, lập biên bản khi phát hiện mất mát hoặc hư hỏng.',
      'Trách nhiệm của mỗi bên được xác định dựa trên nguyên nhân, chứng cứ, thỏa thuận và quy định pháp luật; không mặc nhiên loại trừ trách nhiệm của bất kỳ bên nào.',
      'Khách hàng được thông báo rõ về phạm vi bảo hiểm nếu có và trách nhiệm đối với tài sản của mình.',
    ],
  },
  {
    id: 7,
    articleNumber: 'Điều 7',
    title: 'Sự cố và bảo trì',
    category: 'operations',
    categoryLabel: 'Bảo trì & Sự cố',
    badgeVariant: 'success',
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    clauses: [
      'Khách hàng cần thông báo khi phát hiện rò rỉ nước, cháy, mùi bất thường, hư hỏng kết cấu hoặc sự cố an ninh.',
      'StorageHub tiếp nhận, ghi nhận và xử lý sự cố theo mức độ nghiêm trọng.',
      'Việc tiếp cận kho để kiểm tra hoặc sửa chữa phải tuân theo quy trình an toàn và quyền riêng tư, trừ tình huống khẩn cấp được xử lý theo quy định áp dụng.',
    ],
  },
  {
    id: 8,
    articleNumber: 'Điều 8',
    title: 'Chấm dứt thuê và bàn giao kho',
    category: 'operations',
    categoryLabel: 'Chấm dứt & Bàn giao',
    badgeVariant: 'success',
    iconBg: 'bg-teal-50 text-teal-700 border-teal-200',
    clauses: [
      'Khách hàng thông báo chấm dứt thuê theo thời hạn đã thỏa thuận.',
      'Khách hàng lấy tài sản ra khỏi kho, thanh toán các khoản còn nợ và bàn giao kho theo quy trình.',
      'Hai bên xác nhận tình trạng kho, tài sản còn lại và các khoản cần xử lý.',
      'Tài sản bị bỏ lại không được tự ý thanh lý nếu chưa thực hiện đúng quy trình thông báo và xử lý hợp pháp.',
    ],
  },
  {
    id: 9,
    articleNumber: 'Điều 9',
    title: 'Khiếu nại và giải quyết tranh chấp',
    category: 'operations',
    categoryLabel: 'Tranh chấp & Pháp lý',
    badgeVariant: 'info',
    iconBg: 'bg-sky-50 text-sky-700 border-sky-200',
    clauses: [
      'Khách hàng có quyền yêu cầu giải thích phí, cung cấp chứng từ và khiếu nại về dịch vụ.',
      'Hai bên ưu tiên trao đổi và đối chiếu hồ sơ giao dịch để giải quyết.',
      'Nếu không giải quyết được, tranh chấp được xử lý theo thỏa thuận hợp pháp và pháp luật có liên quan.',
    ],
  },
]

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
