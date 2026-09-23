import { type ReactNode, type HTMLAttributes, type InputHTMLAttributes, type TdHTMLAttributes } from 'react'

// ─── Badge ───────────────────────────────────────────────────────────────────

const badgeVariants: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  error:   'bg-red-50 text-red-700 ring-1 ring-red-200',
  info:    'bg-stone-100 text-stone-700 ring-1 ring-stone-300',
  muted:   'bg-stone-100 text-stone-600 ring-1 ring-stone-200',
  purple:  'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
}

export function Badge({ variant = 'muted', children }: { variant?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeVariants[variant] ?? badgeVariants.muted}`}>
      {children}
    </span>
  )
}

// ─── Button ──────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

const btnBase = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors duration-150 select-none disabled:pointer-events-none'
const btnVariants: Record<BtnVariant, string> = {
  primary:   'bg-[#e9a12c] text-[#3f2607] hover:bg-[#dc9220] active:bg-[#ca8215]',
  secondary: 'bg-[#292a27] text-white hover:bg-[#3a3933] active:bg-[#1e1f1d]',
  outline:   'border border-[#cfcdc1] bg-white text-stone-700 hover:bg-[#f8f7f1] active:bg-stone-100',
  ghost:     'text-stone-600 hover:bg-stone-100 active:bg-stone-200',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}
const btnSizes: Record<BtnSize, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-sm px-5 py-2.5',
}

interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function Button({ variant = 'primary', size = 'md', className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({ children, className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`app-card ${className}`} {...rest}>
      {children}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  icon: ReactNode
  iconBg?: string
}

export function StatCard({ title, value, delta, deltaPositive }: StatCardProps) {
  return (
    <Card className="p-5 stat-card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{value}</p>
          {delta && (
            <p className={`text-xs mt-1 font-medium ${deltaPositive ? 'text-green-600' : 'text-red-500'}`}>
              {deltaPositive ? '↑' : '↓'} {delta}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-stone-200 bg-[#f8f7f1]">{children}</thead>
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-stone-100">{children}</tbody>
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-mono text-[11px] font-semibold text-stone-500 uppercase tracking-[.06em] ${className}`}>{children}</th>
}

export function Td({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 text-stone-700 ${className}`} {...rest}>{children}</td>
}

export function Tr({ children, className = '', ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`hover:bg-[#fbfaf6] transition-colors ${rest.onClick ? 'cursor-pointer' : ''} ${className}`}
      {...rest}
    >
      {children}
    </tr>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-[#e9a12c]', 'bg-stone-600', 'bg-emerald-700', 'bg-amber-700', 'bg-rose-700']
  const color = colors[name.charCodeAt(0) % colors.length]
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${color} ${sizeClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ─── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  type?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium text-stone-700">{label}</label>}
      <input
        className={`w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition ${className}`}
        {...props}
      />
    </div>
  )
}

export function Select({ label, children, className = '', value, onChange, disabled = false }: {
  label?: string
  children?: ReactNode
  className?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium text-stone-700">{label}</label>}
      <select
        className={`w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition bg-white ${className}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({ title, description, action }: {
  icon: ReactNode; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-slate-700 font-semibold">{title}</h3>
      {description && <p className="text-slate-500 text-sm mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, size = 'md', closeLabel = 'Close dialog' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'md' | 'lg' | 'xl'; closeLabel?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`relative max-h-[90vh] overflow-y-auto bg-white rounded-lg border border-stone-200 shadow-2xl w-full ${size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'} mx-4 p-6 fade-in`}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-lg font-bold text-stone-900">{title}</h2>
          <button aria-label={closeLabel} className="flex items-center justify-center rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Pill Tabs ────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            active === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ value, max = 100, color = 'bg-[#e9a12c]' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}
