import type { ReservationQuote } from '../../services/customerReservationApi'
import { formatVndAmount } from '../../i18n/currency'
import { rentalEndDateForDisplay } from '../../domain/rentalTimeline'

const dateLabel = (value: string) => value.split('-').reverse().join('/')
interface Props {
  facility: string; unit: string; months: number; setupDays: number
  date: string; time: string; minDate: string; maxDate: string; earliestTime: string
  startDate?: string; endDate?: string; quote?: ReservationQuote | null; needsReview: boolean
  accepted: boolean; onAccepted: (value: boolean) => void
  onDate: (value: string) => void; onTime: (value: string) => void
  isAllowed: (date: string, time: string) => boolean
}
export default function BookingArrivalDetails(p: Props) {
  const hasSetupEarlyExitTerms = Boolean(p.quote?.setupEarlyExitPolicyVersion && p.quote.setupEarlyExitFee != null)
  const dates: string[] = []
  const cursor = new Date(`${p.minDate}T12:00:00Z`)
  for (let i = 0; i < 32 && Number.isFinite(cursor.getTime()); i++) {
    const day = cursor.toISOString().slice(0, 10)
    if (day > p.maxDate) break
    dates.push(day); cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  const times = Array.from(new Set([...Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`), p.time, p.earliestTime])).filter(Boolean).sort()
  const changeDate = (date: string) => {
    p.onDate(date)
    if (!p.isAllowed(date, p.time)) {
      const next = times.find(time => p.isAllowed(date, time))
      if (next) p.onTime(next)
    }
  }
  const row = (label: string, value: string, accent = false) => <div className="flex justify-between gap-4 border-b border-stone-200 py-2 last:border-0"><span>{label}</span><strong className={`text-right tabular-nums ${accent ? 'text-amber-700' : ''}`}>{value}</strong></div>
  return <div className="space-y-4">
    <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm">
      <h3 className="font-semibold">Chọn ngày giờ nhận kho</h3>
      <p>Cơ sở: <b>{p.facility}</b> · Hoạt động 24/24</p>
      <p>Bạn có thể nhận kho từ <b>{dateLabel(p.minDate)}</b> đến <b>{dateLabel(p.maxDate)}</b>. Giờ khả dụng tuân theo thời gian báo trước của đơn.</p>
      <fieldset><legend className="mb-2 font-medium">Ngày nhận kho mong muốn</legend><div className="flex flex-wrap gap-2">{dates.map(day => <label key={day} className={`cursor-pointer rounded-lg border px-4 py-3 ${p.date === day ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'border-stone-300 bg-white'}`}><input className="sr-only" type="radio" name="booking-arrival-date" value={day} checked={p.date === day} onChange={() => changeDate(day)} />{day.slice(8)}/{day.slice(5, 7)}</label>)}</div></fieldset>
      <label className="block font-medium">Giờ nhận kho<select className="mt-2 block min-w-40 rounded-lg border border-stone-300 bg-white px-3 py-2" value={p.time} onChange={event => p.onTime(event.target.value)}>{times.map(time => <option key={time} value={time} disabled={!p.isAllowed(p.date, time)}>{time}</option>)}</select></label>
      {!p.isAllowed(p.date, p.time) && <p role="alert" className="text-red-700">Giờ nhận kho chưa hợp lệ. Vui lòng chọn giờ khả dụng.</p>}
    </section>
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><h3 className="mb-2 font-semibold">Các mốc thời gian dự kiến</h3>
      {row('Nhận kho (bàn giao)', `${p.time} · ${dateLabel(p.date)}`)}
      {row('Chuẩn bị miễn phí', `${p.setupDays} ngày (gói ${p.months} tháng)`)}
      {row('Bắt đầu tính tiền thuê', p.startDate ? dateLabel(p.startDate) : 'Chưa xác định')}
      {row('Kết thúc kỳ thuê', p.endDate ? dateLabel(rentalEndDateForDisplay(p.endDate)) : 'Chưa xác định')}
      <p className="mt-3 text-xs leading-5">Ngày tính tiền dự kiến theo ngày bàn giao + {p.setupDays} ngày chuẩn bị. Nếu nhận kho muộn, các mốc sẽ tính lại theo bàn giao thực tế. Hoàn tất chuẩn bị hoặc kiểm kê sớm không làm đổi ngày bắt đầu tính tiền đã chốt.</p>
    </section>
    {p.quote && <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm"><h3 className="mb-2 font-semibold">Tóm tắt đơn</h3>
      {row('Loại kho', `${p.unit} · gói ${p.months} tháng`)}
      {row('Tổng chi phí (gồm cọc đảm bảo hoàn lại)', formatVndAmount(p.quote.totalInitialObligation))}
      {row('Thanh toán trước 20% (trong 15 phút)', formatVndAmount(p.quote.reservationDepositAmount), true)}
      {row('Còn lại thanh toán khi nhận kho', formatVndAmount(p.quote.dueAtCheckIn))}
      <p className="mt-2 text-xs text-stone-500">Số tiền theo báo giá ở bước 3. Khoản trả trước được trừ vào tổng chi phí khi bàn giao.</p>
    </section>}
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{p.needsReview ? 'Đơn cần nhân viên duyệt. Khi đơn được duyệt, bạn sẽ nhận email và có 15 phút để thanh toán khoản trả trước.' : 'Sau khi xác nhận đặt kho và hoàn tất xác minh cần thiết, bạn có 15 phút để thanh toán khoản trả trước.'} Quá hạn, chỗ giữ được nhả và đơn hết hiệu lực.</p>
    <label className="flex items-start gap-2 text-sm">
      <input className="mt-1" type="checkbox" checked={p.accepted} onChange={event => p.onAccepted(event.target.checked)} />
      <span className="space-y-1 leading-5">
        <span className="block">Tôi đã đọc, hiểu và đồng ý:</span>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>Quy định nhận kho: nếu quá hạn đến nhận kho, chỗ giữ được nhả và khoản trả trước không được hoàn lại theo điều khoản đã chấp nhận.</li>
          {hasSetupEarlyExitTerms && <li>Điều khoản trả kho trong thời gian chuẩn bị của báo giá này.</li>}
        </ul>
      </span>
    </label>
  </div>
}
