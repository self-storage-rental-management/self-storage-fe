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
export default function RentalDeadlineNotice({ rental, role, now = new Date() }: { rental: RentalApiRecord; role: RentalApiRole; now?: Date }) {
  const read = useRentalApiResource(`deadline:${role}:${rental.id}`, async () => {
    if (role === 'staff') return null
    return readRentalEnvelope<Risk>(await apiRequest(`/api/${role}/rentals/${encodeURIComponent(rental.id)}/renewal-risk`),
      value => validRenewalRisk(value) && value.rentalId === rental.id)
  })
  const risk = read.data
  const last = rental.dateSemantics?.lastPermittedDate || rental.contractEndDate
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const calculatedDays = last ? Math.max(0, Math.round((Date.parse(today) - Date.parse(last)) / 86400000)) : NaN
  const recovery = risk?.repossessionStartedAt || risk?.repossessionStartsAt
  return <OverdueRentalCard days={risk?.overdueDays ?? (Number.isFinite(calculatedDays) ? calculatedDays : null)}
    endDate={rentalDate(last)} recoveryDate={recovery ? rentalDate(recovery) : undefined}
    started={Boolean(risk?.repossessionStartedAt)} loading={read.loading} error={Boolean(read.error)}
    fee={risk?.estimatedOverdueFee != null ? rentalMoney(risk.estimatedOverdueFee, risk.currency) : undefined} />
}
export function RentalDeadlineBanner({ rental, role, now = new Date() }: { rental: RentalApiRecord; role: RentalApiRole; now?: Date }) {
  const state = rentalDeadlineState(rental, now)
  if (!state) return null
  return state === 'overdue' ? <RentalDeadlineNotice rental={rental} role={role} now={now} /> :
    <UpcomingRentalCard days={rentalDaysUntilDeadline(rental, now)} endDate={rentalDate(rental.dateSemantics?.lastPermittedDate || rental.contractEndDate)} />
}
