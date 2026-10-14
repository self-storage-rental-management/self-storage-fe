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
export default function RentalDeadlineNotice({ rental, role, now = new Date() }: { rental: RentalApiRecord; role: RentalApiRole; now?: Date }) {
  const read = useRentalApiResource(`deadline:${role}:${rental.id}`, async () =>
    readRentalEnvelope<Risk>(await apiRequest(`/api/${role}/rentals/${encodeURIComponent(rental.id)}/renewal-risk`),
      value => validRenewalRisk(value) && value.rentalId === rental.id))
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
