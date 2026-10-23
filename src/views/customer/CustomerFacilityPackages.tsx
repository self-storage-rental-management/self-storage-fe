import { useEffect, useState } from 'react'
import { listReservationRentalPackages, type ReservationRentalPackage } from '../../services/customerReservationApi'
export default function CustomerFacilityPackages({ facilityId }: { facilityId: string }) {
  const [packages, setPackages] = useState<ReservationRentalPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const result = await listReservationRentalPackages(facilityId)
        if (!disposed) { setPackages([...result].sort((a, b) => a.rentalMonths - b.rentalMonths)); setError('') }
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Không tải được gói thuê cơ sở.') }
      finally { if (!disposed) setLoading(false) }
    }
    setLoading(true); setPackages([]); setError('')
    void load()
    window.addEventListener('focus', load)
    return () => { disposed = true; window.removeEventListener('focus', load) }
  }, [facilityId])
  if (loading) return <p role="status" className="mt-3 text-sm text-stone-500">Đang tải gói thuê…</p>
  if (error) return <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
  if (!packages.length) return <p className="mt-3 text-sm text-stone-500">Cơ sở chưa có gói thuê đang hiệu lực.</p>
  return <div className="mt-4 grid gap-3 sm:grid-cols-3">{packages.map(item => <article key={item.code} className="rounded-xl border border-emerald-200 bg-white p-4 text-sm">
    <b>{item.name || `Thuê ${item.rentalMonths} tháng`}</b><p className="mt-1 font-semibold text-emerald-700">Giảm {Math.round(item.discountRate * 100)}% tiền thuê</p>
  </article>)}</div>
}
