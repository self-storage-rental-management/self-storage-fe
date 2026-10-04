import type { Role } from '../../types'

export type AdminSection = 'users' | 'roles' | 'login-history' | 'activity' | 'settings'
export type AdminToast = (message: string) => void

export const roleColors: Record<Role, string> = {
  customer: 'bg-blue-100 text-blue-700',
  staff: 'bg-green-100 text-green-700',
  manager: 'bg-purple-100 text-purple-700',
  business: 'bg-amber-100 text-amber-700',
  admin: 'bg-red-100 text-red-700',
}

export const roleLabels: Record<Role, string> = {
  customer: 'Khách hàng',
  staff: 'Nhân viên',
  manager: 'Quản lý',
  business: 'Kinh doanh',
  admin: 'Quản trị viên',
}

export function CheckIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
}

export function MinusIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" /></svg>
}

export function LockIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
}

export function SearchIcon({ className = '' }: { className?: string }) {
  return <svg className={`show-icon h-4 w-4 ${className}`} style={{ display: 'inline-block', width: '1rem', height: '1rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
}

export function RefreshIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
}
