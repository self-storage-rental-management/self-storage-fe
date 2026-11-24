import type { ReactNode } from 'react'
import type { RenewalApiRecord } from '../../types/renewalApi'
import { Button } from '../../components/ui'

export const renewalPrimaryClass = '!bg-[#a64e00] !text-white hover:!bg-[#893f00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a64e00]'
export const renewalTableHeadClass = 'border-b border-stone-200 bg-[#f5f5f5] text-stone-600'
export const renewalBadgeClass = 'inline-block max-w-full rounded-full px-2.5 py-1 text-xs font-medium leading-5'
export const renewalPreviewClass = 'inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-orange-300 px-3 text-sm font-medium text-[#994600] hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700'
export const renewalDetailClass = 'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700'

export function renewalStatusTone(row: RenewalApiRecord) {
  const stage = row.statusSummary?.workflowStatus
  if (row.status === 'completed' || stage === 'COMPLETED') return 'bg-[#e5f5ec] text-[#18583b]'
  if (row.status === 'payment_expired' || row.status === 'payment_failed' ||
    stage === 'PAYMENT_WINDOW_EXPIRED' || stage === 'SIGNING_EXPIRED' || stage === 'NO_SHOW') return 'bg-[#fbe5e9] text-[#a01c32]'
  if (row.status === 'cancelled' || row.status === 'rejected') return 'bg-stone-100 text-stone-700'
  return 'bg-[#fbf3d8] text-[#854400]'
}

export function RenewalPreviewIcon() {
  return <svg aria-hidden="true" className="show-icon size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" />
  </svg>
}

export function RenewalDetailIcon() {
  return <svg aria-hidden="true" className="show-icon size-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 3 5 5-5 5" />
  </svg>
}

export function RenewalSearch({ value, onChange, onSearch, children }: {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  children?: ReactNode
}) {
  return <form className="flex flex-wrap items-center gap-2.5" onSubmit={event => { event.preventDefault(); onSearch() }}>
    <input className="h-11 min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-500 focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700"
      aria-label="Tìm theo mã hồ sơ hoặc gian kho" placeholder="Mã hồ sơ / gian kho" maxLength={200} value={value} onChange={event => onChange(event.target.value)} />
    <Button type="submit" className={`h-11 shrink-0 ${renewalPrimaryClass}`}>
      <svg aria-hidden="true" className="show-icon size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
      Tìm kiếm
    </Button>
    {children}
  </form>
}
