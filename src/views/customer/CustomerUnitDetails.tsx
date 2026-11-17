import { Button } from '../../components/ui'
import { formatVndAmount } from '../../i18n/currency'
import type { CustomerUnitType, ReservationRentalPackage } from '../../services/customerReservationApi'
import { customerFacilityName, customerFacilityAddress } from '../../i18n/customerLabels'
import { isApiAuthenticated } from '../../services/authApi'
import CustomerFacilityPackages from './CustomerFacilityPackages'
import { REFERENCE_BOXES, referenceBoxCapacity } from '../../domain/referenceBoxCapacity'

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

function formatPackageTitle(name?: string, months?: number): string {
  if (name && name.trim()) {
    const trimmed = name.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  return months ? `Gói ${months} tháng` : 'Gói thuê'
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
  const size = t.code.match(/(?:^|[-_])(XL|S|M|L)(?:$|[-_])/i)?.[1]?.toUpperCase()
    || t.name.match(/\b(XL|S|M|L)\b/i)?.[1]?.toUpperCase()
    || ({ small: 'S', medium: 'M', large: 'L', 'extra large': 'XL' } as Record<string, string>)[t.name.toLowerCase()]

  if (!isApiAuthenticated()) {
    facilityName = customerFacilityName(facilityCode || '', facilityName)
    address = customerFacilityAddress(facilityCode || '', facilityName, address || '')
  }

  const detailImageUrl = t.detailImageUrl || (allowDefaultImage && size ? `/images/customer-units/details/kho-${size.toLowerCase()}-chi-tiet.png` : '')

  const smallBox = REFERENCE_BOXES[0]
  const largeBox = REFERENCE_BOXES[1]
  const smallCapacity = referenceBoxCapacity([t.rackLengthM, t.rackWidthM, t.rackHeightM], smallBox.dimensionsCm, t.rackCount)
  const largeCapacity = referenceBoxCapacity([t.rackLengthM, t.rackWidthM, t.rackHeightM], largeBox.dimensionsCm, t.rackCount)

  // Ẩn các gói test / không hợp lệ (ví dụ > 36 tháng hoặc giảm >= 100%)
  const validPackages = rentalPackages.filter(p =>
    p.rentalMonths <= 36 &&
    p.discountRate < 1 &&
    !p.name?.toLowerCase().includes('test') &&
    !p.code?.toLowerCase().includes('test')
  )

  return (
    <div className="space-y-4 text-stone-800">
      {/* ── 1. HEADER (TÊN KHO, ĐỊA CHỈ, GIÁ/THÁNG, BADGE) ── */}
      <div className="rounded-2xl bg-[#292a27] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-amber-300">{facilityName}</p>
          {isRecommended && (
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/40">
              Kho hệ thống đề xuất
            </span>
          )}
          {isUserSelected && !isRecommended && !isIncompatible && (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-stone-300 border border-white/20">
              Kho bạn tự chọn
            </span>
          )}
          {isIncompatible && (
            <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-300 border border-red-400/40">
              Kho không còn phù hợp
            </span>
          )}
        </div>
        <h3 className="mt-1 text-2xl font-bold">{size ? `Kho cỡ ${size}` : 'Loại kho lưu trữ'}</h3>
        <p className="mt-2 text-sm text-stone-300">{address}</p>
        <p className="mt-2 text-xl font-bold text-amber-400">{formatVndAmount(t.monthlyPrice)} <span className="text-sm font-normal text-stone-300">/ tháng</span></p>
      </div>

      {/* Banner thông báo đề xuất */}
      {isRecommended && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500 bg-emerald-50/90 p-3.5 shadow-xs">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Kho hệ thống đề xuất
            </span>
            <p className="mt-1 text-xs text-stone-700">
              Cỡ kho này được hệ thống đề xuất theo hàng hóa, sức chứa, tải trọng, gói thuê và kỳ thuê đã chọn.
            </p>
          </div>
          {onSelectRecommended && (
            <Button size="sm" onClick={onSelectRecommended} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Chọn kho đề xuất này
            </Button>
          )}
        </div>
      )}

      {isUserSelected && !isRecommended && !isIncompatible && onSelectRecommended && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs sm:text-sm text-emerald-950 flex flex-wrap items-center justify-between gap-2">
          <span>Bạn đang xem kho tự chọn. Có thể giữ lựa chọn này hoặc chuyển sang kho hệ thống đề xuất.</span>
          <Button size="sm" onClick={onSelectRecommended}>Chọn kho hệ thống đề xuất</Button>
        </div>
      )}

      {/* Cảnh báo kho không còn phù hợp */}
      {isIncompatible && (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3.5 shadow-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
            Kho không còn phù hợp với hàng hóa
          </span>
          <p className="mt-1 text-xs text-stone-800">
            {incompatibleReason || 'Kích thước kiện hàng hoặc tổng tải trọng vượt quá khả năng lưu trữ của cỡ kho này.'}
          </p>
          {onSelectRecommended && (
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={onSelectRecommended} className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold">
                Chuyển sang kho đề xuất phù hợp
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Ảnh sơ đồ bố trí (nếu không có: ẩn hẳn, không hiện placeholder) */}
      {detailImageUrl ? (
        <figure className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xs">
          <img
            src={detailImageUrl}
            alt={`Sơ đồ bố trí kho cỡ ${size || t.name}`}
            className="max-h-[360px] w-full object-contain"
          />
          <figcaption className="border-t border-stone-100 p-2.5 text-center text-xs text-stone-500">
            Sơ đồ bố trí kho cỡ {size}. Đối chiếu thông số chi tiết bên dưới.
          </figcaption>
        </figure>
      ) : null}

      {/* ── 2. THÔNG SỐ CHÍNH (STAT CARDS LƯỚI 2x2 HOẶC 4 CỘT) ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs text-stone-500 font-medium">Diện tích</p>
          <p className="mt-1 text-base font-bold text-stone-900">{t.areaM2} m²</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs text-stone-500 font-medium">Kích thước (D × R × C)</p>
          <p className="mt-1 text-base font-bold text-stone-900">{t.lengthM} × {t.widthM} × {t.heightM} m</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs text-stone-500 font-medium">Tải trọng tối đa</p>
          <p className="mt-1 text-base font-bold text-stone-900">{t.maxLoadKg.toLocaleString('vi-VN')} kg</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs text-stone-500 font-medium">Tiền cọc đảm bảo thuê</p>
          <p className="mt-1 text-base font-bold text-stone-900">
            {t.securityDepositAmount && t.securityDepositAmount > 0
              ? formatVndAmount(t.securityDepositAmount)
              : 'Miễn cọc (0 ₫)'}
          </p>
        </div>
      </div>

      {/* ── 3. SỨC CHỨA ƯỚC TÍNH (GỘP THÀNH 1 KHỐI) ── */}
      <div className="rounded-xl border border-stone-200 bg-white p-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">Sức chứa ước tính</h4>
          <span className="text-[11px] text-stone-500">Ước tính toàn kho ({t.rackCount} khung kệ)</span>
        </div>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-stone-200/80 bg-stone-50/80 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-stone-900">Thùng nhỏ ({smallBox.dimensionsCm.join(' × ')} cm)</p>
              <p className="text-[11px] text-stone-500">Thùng carton đựng đồ gia dụng</p>
            </div>
            <p className="text-sm font-bold text-stone-900">
              ~{smallCapacity ? smallCapacity.estimatedTotal.toLocaleString('vi-VN') : '-'} <span className="text-xs font-normal text-stone-600">thùng/kho</span>
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-stone-200/80 bg-stone-50/80 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-stone-900">Thùng lớn ({largeBox.dimensionsCm.join(' × ')} cm)</p>
              <p className="text-[11px] text-stone-500">Thùng carton chuyển nhà / đồ cồng kềnh</p>
            </div>
            <p className="text-sm font-bold text-stone-900">
              ~{largeCapacity ? largeCapacity.estimatedTotal.toLocaleString('vi-VN') : '-'} <span className="text-xs font-normal text-stone-600">thùng/kho</span>
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">Sức chứa thực tế phụ thuộc kích thước và tải trọng hàng hóa.</p>
      </div>

      {/* ── 4. ACCORDION: XEM CHI TIẾT KỸ THUẬT (MẶC ĐỊNH ĐÓNG) ── */}
      <details className="group rounded-xl border border-stone-200 bg-white">
        <summary className="flex cursor-pointer items-center justify-between p-3.5 text-xs sm:text-sm font-bold text-stone-800 hover:bg-stone-50 select-none">
          <span>Xem chi tiết kỹ thuật</span>
          <span className="text-xs text-stone-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="border-t border-stone-100 p-4 space-y-3.5 text-xs">
          <div>
            <p className="font-bold text-stone-800 mb-2">Thông số kết cấu khung kệ & lối đi</p>
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-stone-50/50">
              {[
                ['Thể tích kho', `${t.volumeM3} m³`],
                ['Số khung kệ', `${t.rackCount} khung`],
                ['Kích thước khung (D × R × C)', `${t.rackLengthM} × ${t.rackWidthM} × ${t.rackHeightM} m`],
                ['Diện tích khung kệ', `${Number((t.rackLengthM * t.rackWidthM).toFixed(2))} m²/khung (Tổng ${Number((t.rackLengthM * t.rackWidthM * t.rackCount).toFixed(2))} m²)`],
                ['Thể tích khung kệ', `${Number((t.rackLengthM * t.rackWidthM * t.rackHeightM).toFixed(2))} m³/khung (Tổng ${Number((t.rackLengthM * t.rackWidthM * t.rackHeightM * t.rackCount).toFixed(2))} m³)`],
                ['Chiều rộng lối đi', t.aisleWidthM ? `${t.aisleWidthM} m` : 'Chưa cập nhật'],
                ['Xe đẩy hỗ trợ', t.trolleyType || 'Chưa cập nhật'],
              ].map(([label, value]) => (
                <li key={label} className="grid grid-cols-[160px_1fr] gap-2 px-3 py-2">
                  <span className="text-stone-500">{label}</span>
                  <b className="text-stone-900">{value}</b>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-bold text-stone-800 mb-1.5">Cách tính sức chứa thùng tham khảo</p>
            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/50 p-3 leading-5 text-stone-600">
              {smallCapacity && (
                <p>
                  • <b>Thùng nhỏ ({smallBox.dimensionsCm.join(' × ')} cm):</b> {smallCapacity.estimatedPerRack} thùng tham khảo/khung (giới hạn hình học {smallCapacity.perRack} thùng/khung). Hướng xếp D × R × C: {smallCapacity.orientedDimensionsCm.join(' × ')} cm; {smallCapacity.boxesAlongLength} thùng theo chiều dài × {smallCapacity.boxesAlongWidth} thùng theo chiều rộng × {smallCapacity.layers} tầng xếp. Đã trừ 20% khoảng trống thao tác.
                </p>
              )}
              {largeCapacity && (
                <p>
                  • <b>Thùng lớn ({largeBox.dimensionsCm.join(' × ')} cm):</b> {largeCapacity.estimatedPerRack} thùng tham khảo/khung (giới hạn hình học {largeCapacity.perRack} thùng/khung). Hướng xếp D × R × C: {largeCapacity.orientedDimensionsCm.join(' × ')} cm; {largeCapacity.boxesAlongLength} thùng theo chiều dài × {largeCapacity.boxesAlongWidth} thùng theo chiều rộng × {largeCapacity.layers} tầng xếp. Đã trừ 20% khoảng trống thao tác.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 p-3 leading-5 text-stone-700">
            <p className="font-semibold text-amber-950 mb-1">Hướng dẫn xếp hàng an toàn:</p>
            <p>
              Không có số kiện tối đa chung cho mọi hàng hóa. Sức chứa còn phụ thuộc kích thước, tải trọng và khả năng chịu lực của từng kiện. Xếp kiện nặng ở dưới, nhẹ ở trên; không chồng hàng dễ vỡ, hàng có ký hiệu cấm chồng hoặc vượt chiều cao khung. Nhân viên xác nhận cách xếp an toàn khi kiểm kê.
            </p>
          </div>
        </div>
      </details>

      {/* ── 5. ƯU ĐÃI THEO KỲ THUÊ (THẺ GỌN TRÊN 1 DÒNG) ── */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
        <h4 className="font-bold text-emerald-950 text-sm">Ưu đãi và báo giá theo kỳ thuê</h4>
        {validPackages.length > 0 ? (
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {validPackages.map(item => {
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
        ) : (
          <CustomerFacilityPackages facilityId={t.facilityId} />
        )}
        <p className="mt-2.5 text-[11px] leading-4 text-stone-600">
          Mức giảm chính thức xác nhận trên báo giá. Không cộng dồn ưu đãi.
        </p>
      </section>

      {/* ── 6. LƯU Ý (GỘP THÀNH 1 KHỐI TỐI ĐA 2 DÒNG) ── */}
      <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-xs leading-5 text-stone-600">
        <p>• Báo giá hiển thị tiền thuê, ưu đãi, cọc giữ chỗ và tiền còn lại ở bước đặt kho.</p>
        <p>• Hàng nhóm &quot;Khác&quot; cần nhập thông tin chi tiết và được nhân viên duyệt sau khi xác minh email.</p>
      </div>

      {/* ── 7. QUY TRÌNH 4 BƯỚC (STEPPER NGANG GỌN) ── */}
      <section className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">3. Quy trình đặt kho và thanh toán</h4>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['1. Chọn kho', 'Chọn loại kho phù hợp và kỳ thuê.'],
            ['2. Xác nhận hồ sơ', 'Khai báo hàng, nhận báo giá và xác minh email.'],
            ['3. Thanh toán cọc', 'Duyệt hồ sơ nếu cần. Thanh toán cọc theo báo giá.'],
            ['4. Nhận kho', 'Quản lý cơ sở phân kho. Khách hàng nhận kho và ký hồ sơ.'],
          ].map(([title, desc]) => (
            <div key={title} title={desc} className="flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-white px-2.5 py-2 shadow-xs cursor-default">
              <span className="text-xs font-bold text-stone-900">{title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. FOOTER STICKY CÓ NÚT CTA VÀ ĐÓNG ── */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 bg-white/95 backdrop-blur-sm p-3.5 sm:px-6 border-t border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isRecommended && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              Kho đề xuất tối ưu
            </span>
          )}
          {isUserSelected && !isRecommended && !isIncompatible && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
              Kho bạn tự chọn
            </span>
          )}
          {isIncompatible && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              Không còn phù hợp
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
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
  )
}
