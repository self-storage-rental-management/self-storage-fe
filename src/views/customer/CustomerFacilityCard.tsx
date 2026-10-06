import { Badge, Button, Card } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import type { Facility } from '../../types/storageHub'

interface Props {
  facility: Facility
  displayCode: string
  displayName: string
  displayAddress: string
  availableCount: number
  minimumMonthlyPrice: number | null
  onViewUnits: () => void
}

export default function CustomerFacilityCard({ facility, displayCode, displayName, displayAddress, availableCount, minimumMonthlyPrice, onViewUnits }: Props) {
  const image = facility.image?.startsWith('/') || facility.image?.startsWith('http')
    ? facility.image
    : `https://images.unsplash.com/${facility.image || 'photo-1586528116311-ad8dd3c8310d'}?w=720&h=352&fit=crop&auto=format`

  return <Card className="overflow-hidden stat-card-hover">
    <div className="relative h-44 bg-stone-200">
      <img src={image} alt={`Hình ảnh ${displayName}`} className="h-full w-full object-cover" />
      <div className="absolute left-3 top-3 z-10"><span className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-extrabold backdrop-blur-sm ${availableCount > 0 ? 'border-emerald-300 bg-emerald-700/95 text-white shadow-[0_8px_22px_rgba(4,120,87,0.55)]' : 'border-red-300 bg-red-700/95 text-white shadow-[0_8px_22px_rgba(185,28,28,0.5)]'}`}>{availableCount} gian kho còn trống</span></div>
    </div>
    <div className="p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold text-amber-700">{displayCode}</p><h2 className="font-bold text-stone-900">{displayName}</h2><p className="mt-1 text-xs text-stone-500">{displayAddress}</p></div><span className="text-sm font-semibold text-amber-700">{facility.rating}</span></div>
      <div className="my-4 flex flex-wrap gap-2"><Badge variant="muted">Camera 24/7</Badge>{facility.climate && <Badge variant="info">Điều hòa độ ẩm</Badge>}</div>
      <div className="flex items-end justify-between border-t border-stone-100 pt-4"><div><p className="text-xs text-stone-500">Giá chỉ từ</p><p className="text-xl font-bold text-stone-900">{minimumMonthlyPrice === null ? 'Chưa có gian kho' : <>{formatVnd(minimumMonthlyPrice)}<span className="text-xs font-normal text-stone-500">/tháng</span></>}</p></div><Button size="sm" onClick={onViewUnits}>Xem các gian kho</Button></div>
    </div>
  </Card>
}
