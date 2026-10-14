import type { RentalApiRecord, RentalApiRole } from '../../types/rentalApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getRental } from '../../services/rentalApi'
import { rentalDate, rentalMoney } from './presentation'

export function rentalDeadlineState(rental: RentalApiRecord, now = new Date()) {
  if (rental.status === 'completed' || !rental.contractEndDate) return null
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const last = rental.dateSemantics?.lastPermittedDate || rental.contractEndDate
  const days = Math.round((Date.parse(last) - Date.parse(today)) / 86400000)
  if (!Number.isFinite(days)) return null
  return days < 0 ? 'overdue' : days <= 7 ? 'upcoming' : null
}
export default function RentalDeadlineNotice({ rental, role }: { rental: RentalApiRecord; role: RentalApiRole }) {
  const read = useRentalApiResource(`deadline:${role}:${rental.id}`, () => getRental(role, rental.id))
  const financial = read.data?.financialSummary
  const unknown = 'Chưa có dữ liệu xác thực'
  return <div role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
    <p className="font-semibold">Hồ sơ đã quá hạn sử dụng — hạn: {rentalDate(rental.dateSemantics?.lastPermittedDate || rental.contractEndDate)}</p>
    <dl className="mt-3 grid gap-3 sm:grid-cols-3">
      <div><dt className="text-xs">Tình trạng tài chính</dt><dd className="mt-1 font-medium">{!financial || financial.completeness === 'UNKNOWN' ? unknown : financial.completeness === 'PARTIAL' ? 'Đã xác minh một phần' : 'Đã xác minh đầy đủ'}</dd></div>
      <div><dt className="text-xs">Hạn nghĩa vụ thanh toán kế tiếp</dt><dd className="mt-1 font-medium">{!financial || financial.completeness === 'UNKNOWN' ? unknown : financial.billingMode === 'PREPAID_FULL_PERIOD' ? 'Đã trả trước toàn kỳ' : financial.nextDueDate ? rentalDate(financial.nextDueDate) : unknown}</dd></div>
      <div><dt className="text-xs">Dư nợ / Quá hạn</dt><dd className="mt-1 font-medium">{!financial || financial.completeness === 'UNKNOWN' ? unknown : `${rentalMoney(financial.outstandingAmount, financial.currency)} / ${rentalMoney(financial.overdueAmount, financial.currency)}`}</dd></div>
    </dl>
    {Boolean(read.error) && <p className="mt-2 text-xs">Chưa tải được thông tin tài chính. Vui lòng thử lại.</p>}
  </div>
}
export function RentalDeadlineBanner({ rental, role, now = new Date() }: { rental: RentalApiRecord; role: RentalApiRole; now?: Date }) {
  const state = rentalDeadlineState(rental, now)
  if (!state) return null
  return state === 'overdue' ? <RentalDeadlineNotice rental={rental} role={role} /> :
    <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Hồ sơ sắp hết hạn vào {rentalDate(rental.dateSemantics?.lastPermittedDate || rental.contractEndDate)}. Bạn có thể gia hạn hoặc gửi yêu cầu trả kho.</p>
}
