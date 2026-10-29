import { Badge, Card, SectionHeader } from '../../components/ui'
import CustomerRentalRegulations from './CustomerRentalRegulations'

const returnRules = [
  {
    number: '2.1',
    title: 'Trả kho và quyết toán',
    category: 'Trả kho',
    badge: 'info' as const,
    numberClass: 'bg-blue-50 text-blue-700 border-blue-200',
    clauses: [
      "Gửi yêu cầu trả kho, dọn hết tài sản và bàn giao theo lịch đã xác nhận.",
      "Hai bên kiểm tra hiện trạng kho và đối chiếu các khoản phải thanh toán trước khi quyết toán.",
      "Tiền cọc đảm bảo kho được quyết toán sau khi khấu trừ công nợ và các khoản hư hại, vệ sinh hoặc phát sinh đã xác nhận. Khách hàng thanh toán phần còn thiếu nếu có.",
      "Trả kho quá hạn được tính từ ngày kế tiếp ngày hết hạn đến ngày bàn giao và nghiệm thu thực tế. Phí mỗi ngày = 50% × (đơn giá thuê tháng ÷ 30 ngày), tổng phí = số ngày quá hạn × phí mỗi ngày."
],
  },
  {
    number: '2.2',
    title: 'Gia hạn kỳ thuê',
    category: 'Gia hạn thuê',
    badge: 'purple' as const,
    numberClass: 'bg-purple-50 text-purple-700 border-purple-200',
    clauses: [
      "Gửi yêu cầu gia hạn tại hồ sơ thuê và theo dõi kết quả xác nhận của cơ sở.",
      "Thời hạn mới, giá thuê, ưu đãi và các khoản phải thu được xác nhận trong báo giá và hồ sơ gia hạn.",
      "Hoàn tất hồ sơ và thanh toán theo thời hạn hiển thị trên yêu cầu gia hạn.",
      "Yêu cầu gia hạn hoặc khoản tiền thuê gia hạn trả trước không tự động kéo dài kỳ thuê. Trường hợp đã quá hạn, các khoản phí phát sinh được đối chiếu khi hoàn tất gia hạn."
],
  },
]

export default function CustomerRentalRulesPage() {
  return <div className="fade-in space-y-6 font-sans text-sm leading-7 text-stone-700">
    <SectionHeader title="Quy định thuê kho" subtitle="Quy định cho thuê kho, trả kho và gia hạn." />

    <section aria-labelledby="rental-general-rules" className="space-y-3">
      <h2 id="rental-general-rules" className="text-xl font-bold text-stone-900 sm:text-2xl">1. Quy định cho thuê kho</h2>
      <CustomerRentalRegulations />
    </section>

    <section aria-labelledby="rental-return-rules" className="space-y-3">
      <h2 id="rental-return-rules" className="text-xl font-bold text-stone-900 sm:text-2xl">2. Quy định trả kho và gia hạn</h2>
      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900 via-stone-800 to-amber-950 p-5 text-white shadow-sm sm:p-6">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-radial from-amber-500/10 to-transparent" />
          <div className="relative space-y-1.5">
            <h3 className="text-xl font-extrabold uppercase tracking-tight text-white sm:text-2xl">Trả kho và gia hạn kỳ thuê</h3>
            <p className="text-sm leading-7 text-stone-300">Hướng dẫn bàn giao, quyết toán và hoàn tất hồ sơ gia hạn.</p>
          </div>
        </header>
        {returnRules.map(rule => <Card key={rule.number} className="border border-stone-200 bg-white p-4 transition-all duration-150 hover:border-amber-300">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${rule.numberClass}`}>{rule.number}</span>
              <h3 className="text-base font-bold text-slate-900">{rule.title}</h3>
            </div>
            <Badge variant={rule.badge}>{rule.category}</Badge>
          </div>
          <ol className="mt-3 space-y-2">
            {rule.clauses.map((clause, index) => <li key={index} className="flex items-start gap-2.5 text-sm leading-7 text-slate-700">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-xs font-bold text-stone-600">{index + 1}</span>
              <span className="flex-1">{clause}</span>
            </li>)}
          </ol>
        </Card>)}
      </div>
    </section>
  </div>
}
