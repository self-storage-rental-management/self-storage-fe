import type { ReactNode } from 'react'
import type { RentalApiRecord, RentalApiRole } from '../../types/rentalApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { readRentalEnvelope } from '../../services/rentalApi'
import { apiRequest } from '../../services/apiClient'
import { validRenewalRisk, type Risk } from './RenewalRiskNotice'
import { rentalDate, rentalMoney } from './presentation'
import OverdueRentalCard from './OverdueRentalCard'
import UpcomingRentalCard from './UpcomingRentalCard'

export function rentalDaysUntilDeadline(rental: RentalApiRecord, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const last = rental.dateSemantics?.lastPermittedDate || rental.contractEndDate
  return last ? Math.round((Date.parse(last) - Date.parse(today)) / 86400000) : NaN
}

export function rentalDeadlineState(rental: RentalApiRecord, now = new Date()) {
  if (rental.status === 'completed' || !rental.contractEndDate) return null
  const days = rentalDaysUntilDeadline(rental, now)
  if (!Number.isFinite(days)) return null
  return days < 0 ? 'overdue' : days <= 7 ? 'upcoming' : null
}

export interface RenewalEligibilityItem {
  id?: string
  rentalId?: string
  status: string
}

export function getRentalRenewalEligibility<
  R extends { id?: string; status: string; contractEndDate?: string | null; dateSemantics?: { lastPermittedDate?: string | null } | null },
  N extends RenewalEligibilityItem
>(
  rental: R,
  openRenewals: N[] = [],
  now = new Date()
) {
  const isRentalActive = rental.status === 'active'
  const openRenewal = openRenewals.find(
    (r) =>
      (r.rentalId === rental.id || r.id === rental.id) &&
      r.status !== 'cancelled' &&
      r.status !== 'rejected' &&
      r.status !== 'completed' &&
      r.status !== 'payment_expired'
  )
  const hasOpenRenewal = Boolean(openRenewal)

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const last = rental.dateSemantics?.lastPermittedDate || rental.contractEndDate
  const remainingDays = last ? Math.round((Date.parse(last) - Date.parse(today)) / 86400000) : NaN
  const isWithin7Days = Number.isFinite(remainingDays) && remainingDays <= 7

  const canRenew = isRentalActive && isWithin7Days && !hasOpenRenewal

  let reason: string | undefined
  if (!isRentalActive) {
    reason = 'Chỉ có thể gia hạn khi hợp đồng đang hoạt động.'
  } else if (hasOpenRenewal) {
    reason = 'Hợp đồng này đã có yêu cầu gia hạn đang được xử lý.'
  } else if (!isWithin7Days) {
    reason = 'Chỉ có thể gia hạn khi hợp đồng còn 7 ngày trước ngày hết hạn.'
  }

  return {
    canRenew,
    isWithin7Days,
    hasOpenRenewal,
    openRenewal,
    remainingDays,
    reason,
  }
}
function CompactDeadline({ title, overdue, children, guidance }: {
  title: string
  overdue?: boolean
  children: ReactNode
  guidance?: ReactNode
}) {
  return <div className={`rounded-lg border px-3 py-2.5 text-sm ${overdue ? 'border-orange-200 bg-[#fcf7ef] text-stone-700' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <p className={`flex items-center gap-2 font-bold ${overdue ? 'text-orange-900' : 'text-amber-900'}`}>
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{title}
      </p>
      {children}
      {guidance && <details className="rental-deadline-details">
        <summary className="cursor-pointer rounded-md border border-stone-300 bg-white px-2.5 py-1 text-sm font-semibold hover:bg-stone-50">Xem cảnh báo đầy đủ</summary>
        <div className="mt-2 space-y-1 border-t border-stone-200 pt-2 text-sm">{guidance}</div>
      </details>}
    </div>
  </div>
}

const renewalGuidance = 'Gia hạn chỉ thành công khi bạn đến cơ sở ký hợp đồng gia hạn. Chỉ thanh toán tiền thuê gia hạn trả trước chưa được tính là gia hạn thành công.'

export default function RentalDeadlineNotice({ rental, role, now = new Date(), compact = false }: {
  rental: RentalApiRecord; role: RentalApiRole; now?: Date; compact?: boolean
}) {
  const read = useRentalApiResource(`deadline:${role}:${rental.id}`, async () => {
    if (role === 'staff') return null
    return readRentalEnvelope<Risk>(await apiRequest(`/api/${role}/rentals/${encodeURIComponent(rental.id)}/renewal-risk`),
      value => validRenewalRisk(value) && value.rentalId === rental.id)
  })
  const risk = read.data
  const last = rental.dateSemantics?.lastPermittedDate || rental.contractEndDate
  const calculatedDays = Math.max(0, -rentalDaysUntilDeadline(rental, now))
  const days = risk?.overdueDays ?? (Number.isFinite(calculatedDays) ? calculatedDays : null)
  const recovery = risk?.repossessionStartedAt || risk?.repossessionStartsAt
  const fee = risk?.estimatedOverdueFee != null ? rentalMoney(risk.estimatedOverdueFee, risk.currency) : undefined
  if (compact) return <CompactDeadline overdue title={days != null ? `Đã quá hạn ${days} ngày` : 'Đã hết hạn hợp đồng'}
    guidance={(Boolean(recovery) || role === 'customer' || Boolean(read.error)) && <>
      {recovery && <p>Hạn hợp đồng: <strong>{rentalDate(last)}</strong></p>}
      {recovery && !risk?.repossessionStartedAt && <p>Kho sẽ tự động chuyển sang xử lý thu hồi vào thời điểm này nếu chưa hoàn tất gia hạn hoặc trả kho.</p>}
      {role === 'customer' && <p>{renewalGuidance}</p>}
      {Boolean(read.error) && <p>Chưa tải được hạn thu hồi và phí quá hạn. Vui lòng tải lại trang.</p>}
    </>}>
    <p>{recovery
      ? <>{risk?.repossessionStartedAt ? 'Đã chuyển xử lý thu hồi:' : 'Chuyển xử lý thu hồi:'} <strong>{rentalDate(recovery)}</strong></>
      : <>Hạn hợp đồng: <strong>{rentalDate(last)}</strong></>}</p>
    {fee !== undefined && <p>Tiền quá hạn tạm tính: <strong>{fee}</strong></p>}
    {read.loading && <p role="status" className="text-xs text-stone-600">Đang tải thông tin quá hạn…</p>}
  </CompactDeadline>
  return <OverdueRentalCard days={days}
    endDate={rentalDate(last)} recoveryDate={recovery ? rentalDate(recovery) : undefined}
    started={Boolean(risk?.repossessionStartedAt)} loading={read.loading} error={Boolean(read.error)}
    fee={fee} />
}
export function RentalDeadlineBanner({ rental, role, now = new Date(), compact = false }: {
  rental: RentalApiRecord; role: RentalApiRole; now?: Date; compact?: boolean
}) {
  const state = rentalDeadlineState(rental, now)
  if (!state) return null
  if (state === 'overdue') return <RentalDeadlineNotice rental={rental} role={role} now={now} compact={compact} />
  const days = rentalDaysUntilDeadline(rental, now)
  const endDate = rentalDate(rental.dateSemantics?.lastPermittedDate || rental.contractEndDate)
  if (compact) return <CompactDeadline title={days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày đến hết hạn`}
    guidance={role === 'customer' && <>
      <p>Bạn có thể gia hạn hoặc gửi yêu cầu trả kho trước khi hết hạn.</p>
      <p>{renewalGuidance}</p>
    </>}>
    <p>Hạn hợp đồng: <strong>{endDate}</strong></p>
  </CompactDeadline>
  return <UpcomingRentalCard days={days} endDate={endDate} />
}
