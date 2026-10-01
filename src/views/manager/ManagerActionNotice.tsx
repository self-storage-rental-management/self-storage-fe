import type { ReactNode } from 'react'

export default function ManagerActionNotice({ children, tone = 'info', compact = false }: { children: ReactNode; tone?: 'info' | 'warning' | 'success'; compact?: boolean }) {
  const colors = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-blue-200 bg-blue-50 text-blue-900'
  return <div role="status" className={`rounded-lg border ${colors} ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-4 py-3 text-sm'}`}>
    <span className="font-semibold">Trạng thái thao tác: </span>{children}
  </div>
}
