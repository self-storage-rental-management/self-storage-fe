import { useEffect, useState } from 'react'
import { customerFacilityPolicies, type FacilityContentPolicy } from '../../services/facilityContentPolicyApi'

export default function CustomerFacilityPolicies({ facilityId }: { facilityId: string }) {
  const [policies, setPolicies] = useState<FacilityContentPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const result = await customerFacilityPolicies(facilityId)
        if (!disposed) { setPolicies(result); setError('') }
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Không tải được chính sách cơ sở.') }
      finally { if (!disposed) setLoading(false) }
    }
    setLoading(true); setPolicies([]); setError('')
    void load()
    window.addEventListener('focus', load)
    return () => { disposed = true; window.removeEventListener('focus', load) }
  }, [facilityId])
  return <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
    <h4 className="font-bold text-blue-900">Chính sách và quy định áp dụng</h4>
    {loading ? <p role="status" className="mt-3 text-sm text-stone-500">Đang tải chính sách cơ sở…</p> :
      error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> :
      policies.length === 0 ? <p className="mt-3 text-sm text-stone-500">Cơ sở chưa công bố chính sách nội dung.</p> :
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{policies.map(policy => <article key={policy.id} className="min-w-0 rounded-xl border border-blue-100 bg-white p-4">
        <h5 className="break-words font-semibold">{policy.name}</h5>
        <p className="my-2 whitespace-pre-wrap break-words rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-800">{policy.value}</p>
        {policy.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-600">{policy.description}</p>}
      </article>)}</div>}
  </section>
}
