import { Button } from '../../components/ui'
import { storageSizeCode } from '../../domain/facilityRules'
import { formatVnd } from '../../i18n/currency'
import type { Facility, UnitType } from '../../types/storageHub'
import type { CustomerUnitType } from '../../services/customerReservationApi'
import { customerUnitAmenities } from './customerPresentation'

const CUSTOMER_UNIT_IMAGE_BY_SIZE: Record<string, string> = {
  S: '/images/customer-units/kho-s.jpg',
  M: '/images/customer-units/kho-m.jpg',
  L: '/images/customer-units/kho-l.jpg',
  XL: '/images/customer-units/kho-xl.jpg',
}

export const storageTypeLabelVi = (value?: string) => {
  const normalized = (value || '').toLowerCase()
  if (normalized.includes('4xl')) return 'Kho đặc biệt lớn (4XL)'
  if (normalized.includes('xxl')) return 'Kho cực lớn (XXL)'
  if (normalized.includes('extra large') || /(^|\W)xl(\W|$)/.test(normalized)) return 'Kho rất lớn (XL)'
  if (normalized.includes('medium') || /(^|\W)m(\W|$)/.test(normalized)) return 'Kho vừa (M)'
  if (normalized.includes('small') || /(^|\W)s(\W|$)/.test(normalized)) return 'Kho nhỏ (S)'
  if (normalized.includes('large') || /(^|\W)l(\W|$)/.test(normalized)) return 'Kho lớn (L)'
  return value || 'Kho chưa xác định cỡ'
}

interface Props {
  apiSpec?: CustomerUnitType
  facility: Facility
  unitType: UnitType
  availableCount: number
  onReserve: (facility: Facility, unitType: UnitType) => void
  onViewSpecs: (facility: Facility, unitType: UnitType, availableCount: number) => void
}

export default function CustomerUnitTypeCard({ facility, unitType, apiSpec, availableCount, onReserve, onViewSpecs }: Props) {
  const isAvailable = availableCount > 0
  const sizeCode = storageSizeCode(unitType.name)
  const amenities = customerUnitAmenities(sizeCode)
  const image = CUSTOMER_UNIT_IMAGE_BY_SIZE[sizeCode] || CUSTOMER_UNIT_IMAGE_BY_SIZE.XL

  return <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-lg">
    <div className="relative h-44 overflow-hidden bg-stone-200">
      <img src={image} alt={`Không gian kho loại ${sizeCode}`} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/65 via-transparent to-transparent" />
      <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 shadow backdrop-blur-sm">📍 {facility.name}</span>
      <span className="absolute bottom-3 left-4 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">Kho size {sizeCode}</span>
    </div>
    <div className="flex flex-col p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><p className="mb-0.5 truncate text-[11px] font-bold text-amber-700">{facility.name}</p><p className="text-xs font-semibold uppercase tracking-[.12em] text-stone-500">Cỡ kho</p><h3 className="mt-0.5 text-xl font-bold leading-tight text-black">{storageTypeLabelVi(unitType.name)}</h3></div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${isAvailable ? 'border-stone-300 bg-white text-black' : 'border-red-700 bg-red-700 text-white'}`}>{isAvailable ? `${availableCount} kho trống` : 'Hết kho'}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-stone-200 py-4 text-sm">
        <div><p className="text-xs text-stone-500">Diện tích</p><p className="mt-0.5 font-bold text-black">{unitType.areaM2} m²</p></div>
        <div><p className="text-xs text-stone-500">Kích thước (D×R×C)</p><p className="mt-0.5 font-bold text-black">{unitType.lengthM} × {unitType.widthM} × {unitType.heightM} m</p></div>
        <div><p className="text-xs text-stone-500">Thể tích kho</p><p className="mt-0.5 font-bold text-black">{unitType.volumeM3} m³</p></div>
        <div><p className="text-xs text-stone-500">Số khung kệ</p><p className="mt-0.5 font-bold text-black">{apiSpec?.rackCount ?? '—'} khung</p></div>
        <div><p className="text-xs text-stone-500">Chiều rộng lối đi</p><p className="mt-0.5 font-bold text-black">{amenities ? `${amenities.aisleWidthM} m` : 'Chưa có dữ liệu'}</p></div>
        <div><p className="text-xs text-stone-500">Tải trọng tối đa</p><p className="mt-0.5 font-bold text-black">{unitType.maxLoadKg.toLocaleString('vi-VN')} kg</p></div>
      </div>
      {amenities && <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-stone-50 px-3 py-2.5 text-xs"><div><p className="text-stone-500">Hàng hóa tối đa</p><p className="mt-0.5 font-bold text-stone-800">{amenities.maxCargoDimCm.lengthCm}×{amenities.maxCargoDimCm.widthCm}×{amenities.maxCargoDimCm.heightCm} cm</p></div><div><p className="text-stone-500">Xe đẩy hỗ trợ</p><p className="mt-0.5 font-bold text-stone-800">{amenities.trolley}</p></div></div>}
      {unitType.descriptionVi && <p className="mt-4 line-clamp-3 text-sm leading-5 text-stone-600">{unitType.descriptionVi}</p>}
      <div className="pt-5"><p className="text-xs text-stone-500">Giá thuê từ</p><p className="text-2xl font-bold tracking-tight text-black">{formatVnd(unitType.monthlyPrice)}<span className="text-sm font-normal text-stone-500">/tháng</span></p><p className="mt-1 text-xs text-stone-600">Cọc giữ chỗ theo báo giá hệ thống</p><p className="mt-1 text-xs text-stone-600">Tiền đảm bảo kho: {formatVnd(unitType.monthlyPrice)} (hoàn sau nghiệm thu nếu không phát sinh khấu trừ)</p>{!isAvailable && <p className="mt-2 text-xs font-bold text-red-700">Cỡ kho này hiện chưa thể đặt.</p>}<div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => onViewSpecs(facility, unitType, availableCount)}>Xem chi tiết</Button><Button size="sm" disabled={!isAvailable} onClick={() => onReserve(facility, unitType)}>{isAvailable ? 'Bắt đầu đặt' : 'Hết kho'}</Button></div></div>
    </div>
  </article>
}
