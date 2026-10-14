export default function PaymentReceiptCard({ title,reference,status,fields,footer,confirmed=true }: {
  title: string; reference: string; status: string; fields: [string,string][]; footer: string; confirmed?: boolean
}) {
  return <article className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3">
      <div className="min-w-0 flex-1"><p className="text-xs font-bold text-stone-500">{title}</p><p className="mt-1 break-all text-sm font-bold">{reference}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${confirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{status}</span>
    </div>
    <dl className="grid gap-px bg-stone-200 sm:grid-cols-2">{fields.map(([label,value]) => <div key={label} className="min-w-0 bg-white px-4 py-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-all text-sm font-bold text-stone-900">{value}</dd></div>)}</dl>
    <p className="border-t border-stone-200 px-5 py-4 text-xs text-stone-600">{footer}</p>
  </article>
}
