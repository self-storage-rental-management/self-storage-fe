import { Button } from '../../components/ui'
import { formatVndAmount } from '../../i18n/currency'
import type { CustomerUnitType, ReservationRentalPackage } from '../../services/customerReservationApi'
import { customerFacilityName, customerFacilityAddress } from '../../i18n/customerLabels'
import { isApiAuthenticated } from '../../services/authApi'
import ReferenceBoxCapacity from './ReferenceBoxCapacity'
import CustomerFacilityPackages from './CustomerFacilityPackages'

export interface CustomerUnitDetailsProps {
  unitType: CustomerUnitType
  facilityName: string
  facilityCode?: string
  address?: string
  availableCount: number
  rentalPackages?: ReservationRentalPackage[]
  allowDefaultImage?: boolean
  isRecommended?: boolean
  isUserSelected?: boolean
  isIncompatible?: boolean
  incompatibleReason?: string
  onReserve: () => void
  onSelectRecommended?: () => void
  onClose: () => void
}

export default function CustomerUnitDetails({
  unitType: t,
  facilityName,
  facilityCode,
  address,
  availableCount,
  rentalPackages = [],
  allowDefaultImage = true,
  isRecommended = false,
  isUserSelected = false,
  isIncompatible = false,
  incompatibleReason,
  onReserve,
  onSelectRecommended,
  onClose,
}: CustomerUnitDetailsProps) {
  const size = t.code.match(/(?:^|[-_])(XL|S|M|L)(?:$|[-_])/i)?.[1]?.toUpperCase() || t.name.match(/\b(XL|S|M|L)\b/i)?.[1]?.toUpperCase()
    || ({ small: 'S', medium: 'M', large: 'L', 'extra large': 'XL' } as Record<string, string>)[t.name.toLowerCase()]
  if (!isApiAuthenticated()) {
    facilityName = customerFacilityName(facilityCode || '', facilityName)
    address = customerFacilityAddress(facilityCode || '', facilityName, address || '')
  }
  return <div className="space-y-5">
    <div className="rounded-2xl bg-[#292a27] p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-amber-300">{facilityName}</p>
        {isRecommended && (
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/40">
            ⭐ Kho hệ thống đề xuất
          </span>
        )}
        {isUserSelected && !isRecommended && !isIncompatible && (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-stone-300 border border-white/20">
            Kho bạn tự chọn
          </span>
        )}
        {isIncompatible && (
          <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-300 border border-red-400/40">
            ⚠️ Kho không còn phù hợp
          </span>
        )}
      </div>
      <h3 className="mt-1 text-2xl font-bold">{size ? `Kho cỡ ${size}` : 'Loại kho lưu trữ'}</h3>
      <p className="mt-2 text-sm">{address}</p>
      <p className="mt-2 text-xl font-bold">{formatVndAmount(t.monthlyPrice)} / tháng</p>
    </div>

    {/* Nổi bật kho hệ thống đề xuất */}
    {isRecommended && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50/90 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg text-white">⭐</span>
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Kho hệ thống đề xuất tối ưu
            </span>
            <p className="mt-1 text-xs text-stone-700">
              Cỡ kho này có sức chứa và tải trọng phù hợp nhất với hàng hóa đã khai báo, tối ưu chi phí thuê.
            </p>
          </div>
        </div>
        {onSelectRecommended && (
          <Button size="sm" onClick={onSelectRecommended} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Chọn kho đề xuất này
          </Button>
        )}
      </div>
    )}

    {/* Cảnh báo kho không còn phù hợp */}
    {isIncompatible && (
      <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-lg text-white">⚠️</span>
          <div className="flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
              Kho không còn phù hợp với hàng hóa
            </span>
            <p className="mt-1 text-xs text-stone-800">
              {incompatibleReason || 'Kích thước kiện hàng hoặc tổng tải trọng vượt quá khả năng lưu trữ của cỡ kho này.'}
            </p>
            {onSelectRecommended && (
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={onSelectRecommended} className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold">
                  ⭐ Chuyển sang kho đề xuất phù hợp
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {(t.detailImageUrl || (allowDefaultImage && size && `/images/customer-units/details/kho-${size.toLowerCase()}-chi-tiet.png`)) ? (
      <figure className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <img
          src={t.detailImageUrl || (allowDefaultImage && size ? `/images/customer-units/details/kho-${size.toLowerCase()}-chi-tiet.png` : '')}
          alt={`Sơ đồ bố trí kho cỡ ${size || t.name}`}
          className="max-h-[520px] w-full object-contain"
        />
        <figcaption className="border-t border-stone-100 p-3 text-center text-xs text-stone-500">
          Sơ đồ bố trí kho cỡ {size}. Đối chiếu thông số chi tiết bên dưới.
        </figcaption>
      </figure>
    ) : (
      <p className="rounded-xl border border-dashed border-stone-200 p-5 text-center text-sm text-stone-500">Chưa có hình ảnh loại kho.</p>
    )}
    <h4 className="text-lg font-bold">1. Thông tin kho chi tiết</h4>
    <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 text-sm">{[
      ['Diện tích', `${t.areaM2} m²`], ['Kích thước kho (D × R × C)', `${t.lengthM} × ${t.widthM} × ${t.heightM} m`],
      ['Thể tích kho', `${t.volumeM3} m³`], ['Số khung kệ', `${t.rackCount} khung`],
      ['Kích thước khung (D × R × C)', `${t.rackLengthM} × ${t.rackWidthM} × ${t.rackHeightM} m`],
      ['Chiều rộng lối đi', t.aisleWidthM ? `${t.aisleWidthM} m` : 'Chưa cập nhật'],
      ['Xe đẩy hỗ trợ', t.trolleyType || 'Chưa cập nhật'],
      ['Tải trọng tối đa', `${t.maxLoadKg.toLocaleString('vi-VN')} kg`],
      ['Giá thuê mỗi tháng', formatVndAmount(t.monthlyPrice)],
      ['Tiền cọc đảm bảo kho', formatVndAmount(t.securityDepositAmount)],
    ].map(([label, value]) => <li key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr]"><span className="text-stone-500">{label}</span><b>{value}</b></li>)}</ul>
    <ReferenceBoxCapacity unitType={t} />
    <section className="rounded-xl border border-stone-200 p-5"><h4 className="font-bold">Kỳ thuê và chi phí</h4><p className="mt-2 text-sm">Chọn thời gian thuê và khai báo hàng hóa ở bước đặt kho. Báo giá sẽ hiển thị tiền thuê, ưu đãi, cọc giữ chỗ, tiền cọc đảm bảo kho và số tiền còn lại. Không áp dụng ưu đãi minh họa để tính tiền.</p><h4 className="mt-4 font-bold">Hàng hóa cần xét duyệt</h4><p className="mt-2 text-sm">Hàng thuộc nhóm “Khác” cần nhập tên, chất liệu, mô tả, kích thước và cân nặng. Nhân viên tại cơ sở sẽ xét duyệt sau khi xác minh email.</p></section>
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h4 className="font-bold text-emerald-900">2. Ưu đãi và báo giá theo kỳ thuê</h4>
      <p className="mt-2 text-sm leading-6 text-stone-700">Chọn kỳ thuê ở bước đặt kho để nhận báo giá chính thức, cọc giữ chỗ, tiền thuê còn lại và tiền cọc đảm bảo kho.</p>
      {rentalPackages.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {rentalPackages.map(item => (
            <article key={item.code} className="rounded-xl border border-emerald-200 bg-white p-4 text-sm">
              <b>{item.name || `Thuê ${item.rentalMonths} tháng`}</b>
              <p className="mt-1 font-semibold text-emerald-700">Giảm {Math.round(item.discountRate * 100)}% tiền thuê</p>
              <p className="mt-1 text-xs text-stone-600">Tặng {item.freeSetupDays ?? 0} ngày setup khi nhận kho</p>
            </article>
          ))}
        </div>
      ) : (
        <CustomerFacilityPackages facilityId={t.facilityId} />
      )}
      <p className="mt-3 text-xs leading-5 text-stone-600">Mức áp dụng và số tiền cuối cùng được xác nhận trên báo giá của đơn. Không cộng ưu đãi hai lần.</p>
    </section>
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 to-white p-5 sm:p-6">
      <h4 className="font-bold text-stone-900">3. Quy trình đặt kho và thanh toán</h4>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Chọn kho', 'Chọn loại kho phù hợp và kỳ thuê.'],
        ['Xác nhận hồ sơ', 'Khai báo hàng, nhận báo giá và xác minh email.'],
        ['Thanh toán cọc', 'Duyệt hồ sơ nếu cần. Thanh toán cọc theo báo giá.'],
        ['Nhận kho', 'Quản lý cơ sở phân gian kho. Khách hàng nhận kho và ký hồ sơ.'],
      ].map(([title, description], i) => <li key={title} className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
        <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">{i + 1}</span>
        <h5 className="text-sm font-bold text-stone-900">{title}</h5><p className="mt-2 text-xs leading-5 text-stone-600">{description}</p>
      </li>)}</ol>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-white pt-5">
      <div className="flex items-center gap-2">
        {isRecommended && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            ⭐ Kho đề xuất tối ưu
          </span>
        )}
        {isUserSelected && !isRecommended && !isIncompatible && (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
            Kho bạn tự chọn
          </span>
        )}
        {isIncompatible && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            ⚠️ Không còn phù hợp
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onClose}>Đóng lại</Button>
        {isRecommended && onSelectRecommended && (
          <Button onClick={onSelectRecommended} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Chọn kho đề xuất này
          </Button>
        )}
        <Button disabled={availableCount <= 0 || isIncompatible} onClick={onReserve}>
          {availableCount <= 0 ? 'Hết kho' : isIncompatible ? 'Kho không phù hợp' : 'Khai báo hàng & Đặt loại kho này'}
        </Button>
      </div>
    </div>
  </div>
}
