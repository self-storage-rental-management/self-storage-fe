import { userFacingError } from '../../presentation/userFacingError'
import { useEffect, useState } from 'react'
import { listReservationRentalPackages, type ReservationRentalPackage } from '../../services/customerReservationApi'

function formatPackageTitle(name?: string, months?: number): string {
  if (name && name.trim()) {
    const trimmed = name.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  return months ? `Gói ${months} tháng` : 'Gói thuê'
}

export default function CustomerFacilityPackages({ facilityId }: { facilityId: string }) {
  const [packages, setPackages] = useState<ReservationRentalPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const result = await listReservationRentalPackages(facilityId)
        if (!disposed) {
          const valid = result
            .filter(p => p.rentalMonths <= 36 && p.discountRate < 1 && !p.name?.toLowerCase().includes('test') && !p.code?.toLowerCase().includes('test'))
            .sort((a, b) => a.rentalMonths - b.rentalMonths)
          setPackages(valid)
          setError('')
        }
      } catch (e) { if (!disposed) setError(userFacingError(e, 'Không tải được gói thuê cơ sở.')) }
      finally { if (!disposed) setLoading(false) }
    }
    setLoading(true); setPackages([]); setError('')
    void load()
    window.addEventListener('focus', load)
    return () => { disposed = true; window.removeEventListener('focus', load) }
  }, [facilityId])
  if (loading) return <p role="status" className="mt-3 text-xs text-stone-500">Đang tải gói thuê…</p>
  if (error) return <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>
  if (!packages.length) return <p className="mt-3 text-xs text-stone-500">Cơ sở chưa có gói thuê đang hiệu lực.</p>
  return (
    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
      {packages.map(item => {
        const isZero = item.discountRate <= 0 && (item.freeSetupDays ?? 0) <= 0
        const discountPercent = Math.round(item.discountRate * 100)
        return (
          <article
            key={item.code}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-xs ${
              isZero ? 'border-stone-200 bg-stone-50/80 text-stone-500' : 'border-emerald-200 bg-white text-stone-800 shadow-xs'
            }`}
          >
            <b className="text-stone-900">{formatPackageTitle(item.name, item.rentalMonths)}</b>
            <div className="flex items-center gap-1.5 ml-auto">
              {discountPercent > 0 ? (
                <span className="font-bold text-emerald-700">Giảm {discountPercent}% tiền thuê</span>
              ) : (
                <span className="text-stone-500">Giá gốc</span>
              )}
              {(item.freeSetupDays ?? 0) > 0 && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                  +{item.freeSetupDays} ngày miễn phí
                </span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
