/** Preview only. Actual handover determines the final paid period on the server. */
export function estimatedRentalPeriod(handoverDate: string, setupDays: number, months: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(handoverDate) || !Number.isInteger(setupDays) || setupDays < 0 || !Number.isInteger(months) || months < 1) return null
  const start = new Date(`${handoverDate}T00:00:00Z`)
  if (!Number.isFinite(start.getTime())) return null
  start.setUTCDate(start.getUTCDate() + setupDays)
  const target = start.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), target + 1, 0)).getUTCDate()
  const endExclusive = new Date(Date.UTC(start.getUTCFullYear(), target, Math.min(start.getUTCDate(), lastDay)))
  return { startDate: start.toISOString().slice(0, 10), endDate: endExclusive.toISOString().slice(0, 10) }
}
