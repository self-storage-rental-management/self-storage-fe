import type { ReactNode } from 'react'

export default function ManagerActionNotice({ children, tone = 'info', compact = false }: { children: ReactNode; tone?: 'info' | 'warning' | 'success'; compact?: boolean }) {
  // Remove operational status banners, but retain actionable safety warnings.
  if (tone !== 'warning') return null
  const colors = 'border-amber-200 bg-amber-50 text-amber-900'
  return <div role="status" className={`rounded-lg border ${colors} ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-4 py-3 text-sm'}`}>
    {children}
  </div>
}
