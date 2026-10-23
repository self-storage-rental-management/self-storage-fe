export default function PaymentReceiptCard({ title,reference,status,fields,footer,confirmed=true }: {
  title: string; reference: string; status: string; fields: [string,string][]; footer: string; confirmed?: boolean
}) {
  const amount = fields.find(([label]) => label === 'Số tiền')?.[1]
  const currency = fields.find(([label]) => label === 'Tiền tệ')?.[1]
  const information = fields.filter(([label]) => ['Nội dung', 'Phương thức thanh toán', 'Người ghi nhận'].includes(label))
  const transaction = fields.filter(([label]) => !['Số tiền', 'Tiền tệ', 'Nội dung', 'Phương thức thanh toán', 'Người ghi nhận'].includes(label))
  return <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
    <header className="space-y-4 border-b border-stone-200 px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-bold tracking-tight text-stone-900">Storage<span className="text-amber-600">Hub</span></p>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${confirmed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{status}</span>
      </div>
      <div><h3 className="text-lg font-bold leading-snug text-stone-950">{title}</h3><p className="mt-2 break-all font-mono text-xs text-stone-500">{reference}</p></div>
    </header>
    {amount && <div className="border-b border-stone-200 bg-emerald-50/60 px-5 py-5 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Số tiền thanh toán</p>
      <p className="mt-2 break-words text-3xl font-extrabold tracking-tight text-emerald-800">{amount}</p>
      {currency && <p className="mt-1 text-xs text-stone-500">Tiền tệ: {currency}</p>}
    </div>
    }
    <div className="space-y-5 px-5 py-5 sm:px-6">
      {information.length > 0 && <section>
        <h4 className="mb-3 text-sm font-semibold text-stone-900">Thông tin thanh toán</h4>
        <dl className="divide-y divide-stone-100">{information.map(([label, value]) => <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-4">
          <dt className="text-sm text-stone-500">{label}</dt><dd className="min-w-0 break-words text-sm font-medium leading-relaxed text-stone-900">{value}</dd>
        </div>)}</dl>
      </section>}
      <section className="rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3">
        <h4 className="mb-2 text-sm font-semibold text-stone-900">Thông tin giao dịch</h4>
        <dl className="divide-y divide-stone-200/70">{transaction.map(([label, value]) => <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-4">
          <dt className="text-xs leading-5 text-stone-500">{label}</dt><dd className="min-w-0 break-all text-xs font-medium leading-5 text-stone-800">{value}</dd>
        </div>)}</dl>
      </section>
    </div>
    <p className="border-t border-dashed border-stone-200 px-5 py-4 text-xs leading-relaxed text-stone-500 sm:px-6">{footer}</p>
  </article>
}
