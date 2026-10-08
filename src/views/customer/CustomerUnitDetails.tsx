import { Button } from '../../components/ui'
import { formatVndAmount } from '../../i18n/currency'
import type { CustomerUnitType } from '../../services/customerReservationApi'
import { customerFacilityName, customerFacilityAddress } from '../../i18n/customerLabels'
import { customerUnitAmenities } from './customerPresentation'

export default function CustomerUnitDetails({ unitType: t, facilityName, facilityCode, address, availableCount, onReserve, onClose }: {
  unitType: CustomerUnitType; facilityName: string; facilityCode?: string; address?: string; availableCount: number; onReserve: () => void; onClose: () => void
}) {
  const size = t.code.match(/(?:^|[-_])(XL|S|M|L)(?:$|[-_])/i)?.[1]?.toUpperCase() || t.name.match(/\b(XL|S|M|L)\b/i)?.[1]?.toUpperCase()
    || ({ small: 'S', medium: 'M', large: 'L', 'extra large': 'XL' } as Record<string, string>)[t.name.toLowerCase()]
  facilityName = customerFacilityName(facilityCode || '', facilityName)
  address = customerFacilityAddress(facilityCode || '', facilityName, address || '')
  const layout = customerUnitAmenities(size)
  const overdueFeePerDay = t.monthlyPrice / 30 * 0.5
  const overdueExampleDays = 4
  return <div className="space-y-5">
    <div className="rounded-2xl bg-[#292a27] p-5 text-white"><p className="text-xs text-amber-300">{facilityName}</p><h3 className="mt-1 text-2xl font-bold">{size ? `Kho cỡ ${size}` : 'Loại kho lưu trữ'}</h3><p className="mt-2 text-sm">{address}</p><p className="mt-2 text-xl font-bold">{formatVndAmount(t.monthlyPrice)} / tháng</p></div>
    {size && <figure className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><img src={`/images/customer-units/details/kho-${size.toLowerCase()}-chi-tiet.png`} alt={`Sơ đồ bố trí kho cỡ ${size}`} className="max-h-[520px] w-full object-contain" /><figcaption className="border-t border-stone-100 p-3 text-center text-xs text-stone-500">Sơ đồ bố trí kho cỡ {size}; đối chiếu thông số chi tiết bên dưới.</figcaption></figure>}
    <h4 className="text-lg font-bold">1. Thông tin kho chi tiết</h4>
    <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 text-sm">{[
      ['Diện tích', `${t.areaM2} m²`], ['Kích thước kho (D × R × C)', `${t.lengthM} × ${t.widthM} × ${t.heightM} m`],
      ['Thể tích kho', `${t.volumeM3} m³`], ['Số khung kệ', `${t.rackCount} khung`],
      ['Kích thước khung (D × R × C)', `${t.rackLengthM} × ${t.rackWidthM} × ${t.rackHeightM} m`],
      ['Tải trọng tối đa', `${t.maxLoadKg.toLocaleString('vi-VN')} kg`],
      ['Giá thuê mỗi tháng', formatVndAmount(t.monthlyPrice)],
      ['Tiền cọc đảm bảo', formatVndAmount(t.securityDepositAmount)],
      ...(layout ? [
        ['Chiều rộng lối đi', `${layout.aisleWidthM.toLocaleString('vi-VN')} m`],
        ['Thiết bị xe đẩy', layout.trolley],
      ] : []),
    ].map(([label, value]) => <li key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr]"><span className="text-stone-500">{label}</span><b>{value}</b></li>)}</ul>
    {layout && <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <h4 className="font-bold text-stone-900">Bố trí và sức chứa kho</h4>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-900">Mẫu thùng nhỏ 50 × 40 × 40 cm</p><p className="mt-2 text-2xl font-extrabold text-stone-950">{layout.smallBoxCapacity.toLocaleString('vi-VN')} <span className="text-sm font-normal text-stone-600">thùng</span></p></article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-900">Mẫu thùng lớn 70 × 50 × 50 cm</p><p className="mt-2 text-2xl font-extrabold text-stone-950">{layout.largeBoxCapacity.toLocaleString('vi-VN')} <span className="text-sm font-normal text-stone-600">thùng</span></p></article>
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-500">Số thùng chỉ dùng để tham khảo cách bố trí. Kết quả phù hợp chính thức được kiểm tra từ kích thước, số lượng và cân nặng bạn khai báo.</p>
    </section>}
    <section className="rounded-xl border border-stone-200 p-5"><h4 className="font-bold">Kỳ thuê và chi phí</h4><p className="mt-2 text-sm">Chọn thời gian thuê và khai báo hàng hóa ở bước đặt kho. Báo giá sẽ hiển thị tiền thuê, ưu đãi, cọc giữ chỗ, cọc đảm bảo và số tiền còn lại. Không áp dụng ưu đãi minh họa để tính tiền.</p><h4 className="mt-4 font-bold">Hàng hóa cần xét duyệt</h4><p className="mt-2 text-sm">Hàng thuộc nhóm “Khác” cần nhập tên, chất liệu, mô tả, kích thước và cân nặng; nhân viên tại cơ sở sẽ xét duyệt sau khi xác minh email.</p></section>
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h4 className="font-bold text-emerald-900">2. Ưu đãi và báo giá theo kỳ thuê</h4>
      <p className="mt-2 text-sm leading-6 text-stone-700">Chọn kỳ thuê ở bước đặt kho để nhận báo giá chính thức, cọc giữ chỗ 40%, tiền thuê còn lại và tiền đảm bảo kho.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[[3, 3], [6, 5], [12, 8]].map(([months, discount]) => <article key={months} className="rounded-xl border border-emerald-200 bg-white p-4 text-sm"><b>Thuê {months} tháng</b><p className="mt-1 font-semibold text-emerald-700">Giảm {discount}% tiền thuê</p></article>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-600">Mức áp dụng và số tiền cuối cùng được xác nhận trên báo giá của đơn; không cộng ưu đãi hai lần.</p>
    </section>
    <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
      <h4 className="font-bold text-blue-900">Chính sách và quy định áp dụng</h4>
      <p className="mt-1 text-sm text-stone-700">Áp dụng cho khách thuê tại {facilityName}.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"><h5 className="font-bold">Phí quá hạn</h5><p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">50% đơn giá thuê ngày cho mỗi ngày trễ</p><p className="text-sm leading-6 text-stone-600">Phí mỗi ngày = 50% × (đơn giá thuê tháng ÷ 30). Tổng phí = số ngày quá hạn × phí mỗi ngày.</p></article>
        <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"><h5 className="font-bold">Tiền đảm bảo kho</h5><p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">{formatVndAmount(t.securityDepositAmount)}</p><p className="text-sm leading-6 text-stone-600">Thu khi nhận kho và được quyết toán sau khi kiểm tra bàn giao, công nợ, vệ sinh và hư hại.</p></article>
        <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"><h5 className="font-bold">Thời hạn thuê tối thiểu</h5><p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">01 tháng</p><p className="text-sm leading-6 text-stone-600">Kỳ thuê sử dụng trọn tháng; thời gian và ưu đãi cụ thể được xác nhận trong báo giá.</p></article>
        <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"><h5 className="font-bold">Gia hạn quá hạn</h5><p className="my-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800">Tối đa 7 ngày</p><p className="text-sm leading-6 text-stone-600">Sau khi hợp đồng hết hạn, khách có tối đa 7 ngày để hoàn tất gia hạn. Nếu đến ngày thứ 8 vẫn chưa hoàn tất, kho sẽ được chuyển sang quy trình thu hồi.</p></article>
      </div>
    </section>
    <section><h4 className="mb-3 font-bold">3. An ninh và tiện ích vận hành</h4><div className="grid gap-3 sm:grid-cols-2"><article className="rounded-xl border border-blue-200 bg-blue-50 p-4"><b>An ninh và kiểm soát ra vào</b><p className="mt-2 text-sm">Mã PIN cá nhân và camera giám sát theo thông tin của cơ sở.</p></article><article className="rounded-xl border border-rose-200 bg-rose-50 p-4"><b>Hệ thống phòng cháy chữa cháy</b><p className="mt-2 text-sm">Cảm biến khói, nhiệt và đầu phun nước tự động theo thông tin của cơ sở.</p></article></div></section>
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
      <h4 className="font-bold text-rose-900">4. Quy định trả kho và gia hạn</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-rose-200 bg-white p-4 text-sm">
          <b>Trả kho sau ngày hết hạn</b>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-stone-700">
            <li>Thời gian quá hạn tính từ ngày kế tiếp ngày hết hạn đến khi bàn giao và nghiệm thu kho thực tế.</li>
            <li>Phí mỗi ngày = 50% × (đơn giá thuê tháng ÷ 30 ngày).</li>
            <li>Tổng phí = số ngày quá hạn × phí mỗi ngày; khoản còn thiếu sau khấu trừ tiền đảm bảo được đưa vào quyết toán.</li>
          </ul>
        </article>
        <article className="rounded-xl border border-amber-200 bg-white p-4 text-sm">
          <b>Gia hạn kỳ thuê</b>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-stone-700">
            <li>Yêu cầu gia hạn không tự động kéo dài kỳ thuê và cần được cơ sở xác nhận.</li>
            <li>Khách hàng hoàn tất hồ sơ và các khoản phải thu trước khi kỳ gia hạn có hiệu lực.</li>
          </ul>
        </article>
      </div>
      <p className="mt-3 rounded-lg bg-rose-100 p-3 text-xs leading-5 text-rose-900">Theo giá hiện tại: {formatVndAmount(t.monthlyPrice)} ÷ 30 × 50% = {formatVndAmount(overdueFeePerDay)}/ngày. Trễ {overdueExampleDays} ngày tương ứng {formatVndAmount(overdueFeePerDay * overdueExampleDays)}.</p>
    </section>
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 to-white p-5 sm:p-6">
      <h4 className="font-bold text-stone-900">5. Quy trình đặt kho và thanh toán</h4>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Chọn kho', 'Chọn loại kho phù hợp và kỳ thuê.'],
        ['Xác nhận hồ sơ', 'Khai báo hàng, nhận báo giá và xác minh email.'],
        ['Thanh toán cọc', 'Duyệt hồ sơ nếu cần; thanh toán cọc 40% theo báo giá.'],
        ['Nhận kho', 'Quản lý phân gian kho; khách nhận kho và ký hồ sơ.'],
      ].map(([title, description], i) => <li key={title} className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
        <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">{i + 1}</span>
        <h5 className="text-sm font-bold text-stone-900">{title}</h5><p className="mt-2 text-xs leading-5 text-stone-600">{description}</p>
      </li>)}</ol>
    </section>
    <div className="flex justify-end gap-2 border-t border-stone-200 bg-white pt-5"><Button variant="outline" onClick={onClose}>Đóng lại</Button><Button disabled={availableCount <= 0} onClick={onReserve}>{availableCount > 0 ? 'Khai báo hàng & Đặt loại kho này' : 'Hết kho'}</Button></div>
  </div>
}
