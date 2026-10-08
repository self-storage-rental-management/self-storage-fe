import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Modal,
  SectionHeader,
  StatCard,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import type { User } from '../../types'
import {
  listAdminLoginHistory,
  listAdminSessions,
  listAdminUsers,
  revokeAdminSession,
  updateAdminUserStatus,
  type AdminApiLoginHistory,
  type AdminApiSession,
  type AdminApiUser,
} from '../../services/adminApi'
import { type ApiUserStatus } from '../../services/authApi'
import type { AdminToast } from './adminPanelTypes'
import { activityActionLabel, activityRoleLabel } from './adminActivityLocalization'
import {
  assessSecurityRisk,
  exportLoginHistoryToCsv,
  formatDateOnly,
  formatFullDateTime,
  formatTimeAgo,
  formatTimeOnly,
  parseIpLocation,
  parseUserAgent,
  type SecurityRiskAssessment,
} from './loginHistoryHelpers'

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function WindowsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.801" />
    </svg>
  )
}

function AppleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.56.65-1.06 1.71-0.92 2.73 1 .08 2.01-.48 2.62-1.23z" />
    </svg>
  )
}

function AndroidIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5896 8.411 13.849 8.1 12 8.1s-3.5896.311-5.1368.8507L4.8409 5.4477a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.741h24c-.3432-4.0821-2.6889-7.5543-6.1185-9.4196" />
    </svg>
  )
}

function LinuxIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.002 0c-3.1 0-5.4 2.8-5.4 6.2 0 1.2.3 2.5.8 3.5-1.5 1.1-2.5 3-2.5 5.1 0 3.8 3.2 6.8 7.1 6.8s7.1-3 7.1-6.8c0-2.1-1-4-2.5-5.1.5-1 .8-2.3.8-3.5 0-3.4-2.3-6.2-5.4-6.2zm-1.8 4.8c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1.5-1.1 1.1-1.1zm3.6 0c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1.5-1.1 1.1-1.1z" />
    </svg>
  )
}

function DesktopIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l3-1 3 1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function MobileIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
    </svg>
  )
}

function BotIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9V7.5a2.25 2.25 0 014.5 0V9m-7.5 4h10.5M5 19h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM9 13v2m6-2v2" />
    </svg>
  )
}

function BrowserIconBadge({ type }: { type: string }) {
  switch (type) {
    case 'windows':
      return <WindowsIcon className="h-3.5 w-3.5 text-sky-600" />
    case 'apple':
      return <AppleIcon className="h-3.5 w-3.5 text-stone-700" />
    case 'android':
      return <AndroidIcon className="h-3.5 w-3.5 text-emerald-600" />
    case 'linux':
      return <LinuxIcon className="h-3.5 w-3.5 text-amber-600" />
    case 'bot':
      return <BotIcon className="h-3.5 w-3.5 text-purple-600" />
    default:
      return <DesktopIcon className="h-3.5 w-3.5 text-stone-500" />
  }
}

function DeviceIconBadge({ type }: { type: 'desktop' | 'mobile' | 'tablet' | 'bot' }) {
  if (type === 'mobile' || type === 'tablet') {
    return <MobileIcon className="h-4 w-4 text-stone-500" />
  }
  if (type === 'bot') {
    return <BotIcon className="h-4 w-4 text-purple-600" />
  }
  return <DesktopIcon className="h-4 w-4 text-stone-500" />
}

// ─── Component ───────────────────────────────────────────────────────────────

type SubTab = 'sessions' | 'history'
type TimeFilterPreset = 'all' | 'today' | '24h' | '7d' | '30d' | 'custom'

export default function AdminLoginHistoryApiPanel({
  user,
  showToast,
}: {
  user: User
  showToast: AdminToast
}) {
  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('history')

  // Main data states
  const [history, setHistory] = useState<AdminApiLoginHistory[]>([])
  const [sessions, setSessions] = useState<AdminApiSession[]>([])
  const [users, setUsers] = useState<AdminApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters for Login History
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilterPreset>('7d')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [userFilter, setUserFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [onlyHighRisk, setOnlyHighRisk] = useState(false)

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Sessions filters
  const [sessionSearch, setSessionSearch] = useState('')
  const [sessionUserFilter, setSessionUserFilter] = useState('all')

  // Modals & Inspections
  const [selectedLog, setSelectedLog] = useState<{
    log: AdminApiLoginHistory
    risk: SecurityRiskAssessment
  } | null>(null)
  const [confirmRevokeAllOpen, setConfirmRevokeAllOpen] = useState(false)
  const [userToLock, setUserToLock] = useState<{ id: string; email: string; name: string; isLocked: boolean } | null>(null)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(label)
      setTimeout(() => setCopiedText(null), 2000)
      showToast(`Đã sao chép ${label}`)
    })
  }

  // Fetch / reload logic
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    const successParam =
      statusFilter === 'success' ? true : statusFilter === 'failed' ? false : undefined

    Promise.all([
      listAdminLoginHistory({ page: 0, size: 100, search: search.trim() || undefined, success: successParam, userId: userFilter }),
      listAdminSessions({ page: 0, size: 100, userId: sessionUserFilter }),
      users.length ? Promise.resolve({ data: users }) : listAdminUsers({ page: 0, size: 100 }),
    ])
      .then(([historyPage, sessionsPage, userPage]) => {
        setHistory(historyPage.data)
        setSessions(sessionsPage.data)
        if (!users.length && userPage.data) setUsers(userPage.data)
      })
      .catch(reason => {
        setHistory([])
        setSessions([])
        setError(reason instanceof Error ? reason.message : 'Không thể tải lịch sử đăng nhập từ cơ sở dữ liệu.')
      })
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    load()
  }, [userFilter, statusFilter, sessionUserFilter])

  // Filtered Login History List
  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = Date.now()

    return history.filter(item => {
      // 1. Search Query
      if (q) {
        const matchName = (item.fullName || '').toLowerCase().includes(q)
        const matchEmail = (item.email || '').toLowerCase().includes(q)
        const matchIp = (item.ipAddress || '').toLowerCase().includes(q)
        const matchUa = (item.userAgent || '').toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchIp && !matchUa) return false
      }

      // 2. Status filter
      if (statusFilter === 'success' && !item.success) return false
      if (statusFilter === 'failed' && item.success) return false

      // 3. User filter
      if (userFilter !== 'all' && item.userId !== userFilter && item.email !== userFilter) return false

      // 4. Role filter
      if (roleFilter !== 'all') {
        const hasRole = item.roles.some(r => r.toUpperCase() === roleFilter.toUpperCase())
        if (!hasRole) return false
      }

      // 5. Time filter preset
      if (item.occurredAt) {
        const itemTime = new Date(item.occurredAt).getTime()
        if (timeFilter === 'today') {
          const startOfToday = new Date().setHours(0, 0, 0, 0)
          if (itemTime < startOfToday) return false
        } else if (timeFilter === '24h') {
          if (now - itemTime > 24 * 3600 * 1000) return false
        } else if (timeFilter === '7d') {
          if (now - itemTime > 7 * 24 * 3600 * 1000) return false
        } else if (timeFilter === '30d') {
          if (now - itemTime > 30 * 24 * 3600 * 1000) return false
        } else if (timeFilter === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate).getTime()
            if (itemTime < start) return false
          }
          if (customEndDate) {
            const end = new Date(customEndDate).setHours(23, 59, 59, 999)
            if (itemTime > end) return false
          }
        }
      }

      // 6. Security Risk Quick Filter
      if (onlyHighRisk) {
        const risk = assessSecurityRisk(item, history)
        if (risk.level !== 'high' && risk.level !== 'warning') return false
      }

      return true
    })
  }, [history, search, statusFilter, userFilter, roleFilter, timeFilter, customStartDate, customEndDate, onlyHighRisk])

  // Filtered Sessions List
  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase()
    return sessions.filter(session => {
      if (sessionUserFilter !== 'all' && session.userId !== sessionUserFilter && session.email !== sessionUserFilter) {
        return false
      }
      if (q) {
        const matchName = (session.fullName || '').toLowerCase().includes(q)
        const matchEmail = (session.email || '').toLowerCase().includes(q)
        const matchIp = (session.createdIp || '').toLowerCase().includes(q)
        const matchUa = (session.userAgent || '').toLowerCase().includes(q)
        return matchName || matchEmail || matchIp || matchUa
      }
      return true
    })
  }, [sessions, sessionSearch, sessionUserFilter])

  // Pagination for History
  const totalPages = Math.ceil(filteredHistory.length / pageSize) || 1
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredHistory.slice(start, start + pageSize)
  }, [filteredHistory, currentPage, pageSize])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, timeFilter, customStartDate, customEndDate, userFilter, roleFilter, onlyHighRisk, pageSize])

  // High-level summary metrics
  const activeSessionsCount = useMemo(() => sessions.filter(s => s.active).length, [sessions])
  const totalHistoryCount = history.length
  const failedLoginsCount = useMemo(() => history.filter(h => !h.success).length, [history])
  const successRate = useMemo(() => {
    if (!totalHistoryCount) return '—'
    const successCount = history.filter(h => h.success).length
    return `${Math.round((successCount / totalHistoryCount) * 100)}%`
  }, [history, totalHistoryCount])
  const highRiskIncidentsCount = useMemo(() => {
    return history.filter(item => {
      const risk = assessSecurityRisk(item, history)
      return risk.level === 'high' || risk.level === 'warning'
    }).length
  }, [history])

  // Revoke single session
  const handleRevokeSession = async (session: AdminApiSession) => {
    try {
      setActionInProgress(true)
      await revokeAdminSession(session.id)
      showToast(`Đã thu hồi phiên của ${session.fullName || session.email}`)
      setSessions(prev => prev.map(s => (s.id === session.id ? { ...s, active: false, revokedAt: new Date().toISOString() } : s)))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thu hồi phiên đăng nhập.')
    } finally {
      setActionInProgress(false)
    }
  }

  // Revoke all other sessions
  const handleRevokeAllOtherSessions = async () => {
    const others = sessions.filter(s => s.active && s.email !== user.email)
    if (!others.length) {
      showToast('Không có phiên nào khác đang mở để thu hồi.')
      setConfirmRevokeAllOpen(false)
      return
    }

    try {
      setActionInProgress(true)
      const results = await Promise.allSettled(others.map(session => revokeAdminSession(session.id)))
      const revokedIds = new Set(others.filter((_, index) => results[index].status === 'fulfilled').map(session => session.id))
      setSessions(prev => prev.map(session => revokedIds.has(session.id) ? { ...session, active: false, revokedAt: new Date().toISOString() } : session))
      const failedCount = results.length - revokedIds.size
      showToast(failedCount ? `Đã thu hồi ${revokedIds.size}/${others.length} phiên; còn ${failedCount} phiên chưa xử lý.` : `Đã thu hồi thành công ${others.length} phiên thiết bị khác.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thu hồi các phiên thiết bị khác.')
    } finally {
      setActionInProgress(false)
      setConfirmRevokeAllOpen(false)
    }
  }

  // Toggle user lock
  const handleConfirmUserLock = async () => {
    if (!userToLock) return
    const newStatus: ApiUserStatus = userToLock.isLocked ? 'ACTIVE' : 'SUSPENDED'
    try {
      setActionInProgress(true)
      await updateAdminUserStatus(userToLock.id, newStatus)
      showToast(userToLock.isLocked ? `Đã mở khóa tài khoản ${userToLock.email}.` : `Đã tạm khóa tài khoản ${userToLock.email}.`)
      setUserToLock(null)
      load(true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái tài khoản.')
      setUserToLock(null)
    } finally {
      setActionInProgress(false)
    }
  }

  return (
    <div className="w-full fade-in space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <SectionHeader
        eyebrow="AN NINH & GIÁM SÁT HỆ THỐNG"
        title="Lịch sử đăng nhập & Quản lý phiên"
        subtitle="Giám sát thời gian thực các phiên làm việc, phân tích rủi ro an ninh và tra cứu log kiểm toán bảo mật toàn diện."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              onClick={() => load(true)}
              className="h-9 gap-2 shadow-sm"
            >
              <svg
                className={`h-4 w-4 ${refreshing ? 'animate-spin text-[#e9a12c]' : 'text-stone-500'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{refreshing ? 'Đang cập nhật…' : 'Làm mới'}</span>
            </Button>
            {activeSubTab === 'history' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => exportLoginHistoryToCsv(`StorageHub_Audit_Log_${new Date().toISOString().slice(0, 10)}`, filteredHistory)}
                className="h-9 gap-2 shadow-sm font-medium"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Xuất CSV ({filteredHistory.length})</span>
              </Button>
            )}
          </div>
        }
      />

      {/* ── SecOps KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Phiên đang mở"
          value={activeSessionsCount}
          delta="Thời gian thực"
          deltaPositive
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
              </span>
            </div>
          }
        />
        <StatCard
          title="Tổng lượt đăng nhập"
          value={totalHistoryCount}
          delta="Toàn hệ thống"
          deltaPositive
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
          }
        />
        <StatCard
          title="Tỉ lệ thành công"
          value={successRate}
          delta={`${failedLoginsCount} lần thất bại`}
          deltaPositive={failedLoginsCount === 0}
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          }
        />
        <StatCard
          title="Cảnh báo an ninh"
          value={highRiskIncidentsCount}
          delta={highRiskIncidentsCount > 0 ? 'Cần chú ý SecOps' : totalHistoryCount > 0 ? 'Không phát hiện cảnh báo' : 'Chưa có dữ liệu'}
          deltaPositive={highRiskIncidentsCount === 0 && totalHistoryCount > 0}
          icon={
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${highRiskIncidentsCount > 0 ? 'bg-red-50 text-red-600 ring-red-200' : 'bg-emerald-50 text-emerald-600 ring-emerald-200'}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          }
        />
      </div>

      {/* ── Sub-Navigation Tabs: Active Sessions vs Login Audit Logs ──────── */}
      <div className="flex border-b border-stone-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`group inline-flex items-center gap-2.5 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors duration-150 ${
              activeSubTab === 'history'
                ? 'border-[#e9a12c] text-[#292a27]'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
            }`}
          >
            <svg className="h-4 w-4 text-stone-400 group-hover:text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Lịch sử đăng nhập (Audit Log)</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeSubTab === 'history' ? 'bg-[#e9a12c]/20 text-[#855306]' : 'bg-stone-100 text-stone-600'}`}>
              {filteredHistory.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('sessions')}
            className={`group inline-flex items-center gap-2.5 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors duration-150 ${
              activeSubTab === 'sessions'
                ? 'border-[#e9a12c] text-[#292a27]'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
            }`}
          >
            <svg className="h-4 w-4 text-stone-400 group-hover:text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l3-1 3 1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Phiên đang hoạt động</span>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {activeSessionsCount}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()}>Thử lại</Button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PHIÊN HOẠT ĐỘNG (ACTIVE SESSIONS)                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'sessions' && (
        <div className="space-y-4 fade-in">
          {/* Action bar for sessions */}
          <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={e => setSessionSearch(e.target.value)}
                  placeholder="Tìm email, họ tên, địa chỉ IP…"
                  className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm text-stone-800 placeholder-stone-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                />
                <svg className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <select
                value={sessionUserFilter}
                onChange={e => setSessionUserFilter(e.target.value)}
                className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
              >
                <option value="all">Tất cả tài khoản</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} · {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRevokeAllOpen(true)}
                disabled={actionInProgress || activeSessionsCount <= 1}
                className="h-10 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Thu hồi tất cả thiết bị khác</span>
              </Button>
            </div>
          </div>

          {/* Sessions Table */}
          <Card className="overflow-hidden border border-stone-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-[#fbfaf6] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-600">
                  Danh sách phiên đang hoạt động ({filteredSessions.length})
                </span>
              </div>
              <span className="text-xs text-stone-400">
                Phiên bị thu hồi sẽ mất quyền truy cập vào hệ thống ngay lập tức
              </span>
            </div>

            <Table className="min-w-[1080px]">
              <Thead>
                <tr>
                  <Th className="min-w-[200px]">Tài khoản</Th>
                  <Th>Vai trò</Th>
                  <Th className="min-w-[220px]">Thiết bị & Trình duyệt</Th>
                  <Th className="min-w-[180px]">Vị trí / Địa chỉ IP</Th>
                  <Th>Bắt đầu phiên</Th>
                  <Th>Hoạt động gần nhất</Th>
                  <Th>Trạng thái</Th>
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-stone-400">
                      Không tìm thấy phiên đăng nhập nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map(session => {
                    const ua = parseUserAgent(session.userAgent)
                    const ip = parseIpLocation(session.createdIp)
                    const isSelf = session.email === user.email

                    return (
                      <Tr key={session.id} className={isSelf ? 'bg-amber-50/30' : ''}>
                        {/* Account */}
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-700">
                              {(session.fullName || session.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-stone-900">
                                {session.fullName || 'Người dùng'}
                              </p>
                              <p className="truncate text-xs text-stone-500">{session.email}</p>
                            </div>
                          </div>
                        </Td>

                        {/* Role */}
                        <Td>
                          <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-700">
                            {session.email === user.email ? 'Quản trị viên' : 'Thành viên'}
                          </span>
                        </Td>

                        {/* Device & Browser */}
                        <Td>
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                              <BrowserIconBadge type={ua.iconType} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-stone-800">
                                {ua.displayShort}
                              </p>
                              <p className="truncate text-[11px] text-stone-400" title={session.userAgent || ''}>
                                {ua.displayDevice}
                              </p>
                            </div>
                          </div>
                        </Td>

                        {/* Location / IP */}
                        <Td>
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-800">
                              <span>{ip.flag}</span>
                              <span className="truncate">{ip.city}</span>
                            </span>
                            <div className="mt-0.5 flex items-center gap-1">
                              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-mono text-stone-600">
                                {ip.ip}
                              </code>
                              <button
                                type="button"
                                title="Sao chép IP"
                                onClick={() => copyToClipboard(ip.ip, 'IP')}
                                className="text-stone-400 hover:text-stone-700"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </Td>

                        {/* Started at */}
                        <Td className="text-xs text-stone-600">
                          {formatFullDateTime(session.createdAt)}
                        </Td>

                        {/* Last active */}
                        <Td className="text-xs text-stone-500">
                          {formatTimeAgo(session.lastSeenAt || session.createdAt)}
                        </Td>

                        {/* Status */}
                        <Td>
                          {session.active ? (
                            <Badge variant="success">Đang hoạt động</Badge>
                          ) : (
                            <Badge variant="muted">Đã đóng</Badge>
                          )}
                        </Td>

                        {/* Actions */}
                        <Td className="text-right">
                          {isSelf ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              Phiên này
                            </span>
                          ) : session.active ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionInProgress}
                              onClick={() => handleRevokeSession(session)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              Thu hồi
                            </Button>
                          ) : (
                            <span className="text-xs text-stone-400">Đã kết thúc</span>
                          )}
                        </Td>
                      </Tr>
                    )
                  })
                )}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: LỊCH SỬ ĐĂNG NHẬP (AUDIT LOGS)                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'history' && (
        <div className="space-y-4 fade-in">
          {/* Advanced Filter Toolbar */}
          <Card className="border border-stone-200 p-3 shadow-sm sm:p-4">
            <div className="space-y-3">
              {/* Primary filters stay on one row on wide screens. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {/* Search */}
                <div className="relative xl:col-span-2">
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm email, họ tên, IP, trình duyệt…"
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm text-stone-800 placeholder-stone-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                  />
                  <svg className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | 'success' | 'failed')}
                  className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="success">✓ Thành công</option>
                  <option value="failed">✕ Thất bại (Lỗi xác thực)</option>
                </select>

                {/* Date Preset */}
                <select
                  value={timeFilter}
                  onChange={e => setTimeFilter(e.target.value as TimeFilterPreset)}
                  className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                >
                  <option value="all">Tất cả thời gian</option>
                  <option value="today">Hôm nay</option>
                  <option value="24h">24 giờ qua</option>
                  <option value="7d">7 ngày qua</option>
                  <option value="30d">30 ngày qua</option>
                  <option value="custom">Tùy chọn ngày…</option>
                </select>

                {/* Account Filter */}
                <select
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                >
                  <option value="all">Tất cả tài khoản</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} · {u.email}
                    </option>
                  ))}
                </select>

                {/* Role filter */}
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                >
                  <option value="all">Tất cả vai trò</option>
                  <option value="ADMIN">Quản trị viên (Admin)</option>
                  <option value="MANAGER">Quản lý cơ sở</option>
                  <option value="STAFF">Nhân viên kho</option>
                  <option value="CUSTOMER">Khách hàng thuê</option>
                </select>
              </div>

              {/* Secondary controls */}
              <div className="flex flex-wrap items-center gap-2.5 border-t border-stone-100 pt-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Custom Date Range if selected */}
                  {timeFilter === 'custom' && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700"
                        title="Từ ngày"
                      />
                      <span className="text-xs text-stone-400">→</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700"
                        title="Đến ngày"
                      />
                    </div>
                  )}

                  {/* High Risk Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setOnlyHighRisk(v => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      onlyHighRisk
                        ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300'
                        : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Chỉ cảnh báo rủi ro</span>
                  </button>

                  {/* Reset all filters */}
                  {(search || statusFilter !== 'all' || timeFilter !== '7d' || userFilter !== 'all' || roleFilter !== 'all' || onlyHighRisk) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('all')
                        setTimeFilter('7d')
                        setCustomStartDate('')
                        setCustomEndDate('')
                        setUserFilter('all')
                        setRoleFilter('all')
                        setOnlyHighRisk(false)
                      }}
                      className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 ml-1"
                    >
                      Đặt lại bộ lọc
                    </button>
                  )}
                </div>

                {/* Page Size Selector */}
                <div className="ml-auto flex items-center gap-2 text-xs text-stone-500">
                  <span>Dòng/trang:</span>
                  <select
                    value={pageSize}
                    onChange={e => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-700 focus:outline-none"
                  >
                    <option value={10}>10 dòng</option>
                    <option value={20}>20 dòng</option>
                    <option value={50}>50 dòng</option>
                    <option value={100}>100 dòng</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Login History Table */}
          <Card className="overflow-hidden border border-stone-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-[#fbfaf6] px-4 py-3 sm:px-5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-600">
                Nhật ký đăng nhập hệ thống ({filteredHistory.length} bản ghi)
              </span>
              <span className="hidden text-xs text-stone-400 xl:block">
                Nhấn vào dòng bất kỳ hoặc nút "Chi tiết" để xem dữ liệu an ninh chuyên sâu
              </span>
            </div>

            <Table className="min-w-[1080px]">
              <Thead>
                <tr>
                  <Th className="min-w-[190px]">Tài khoản</Th>
                  <Th>Vai trò</Th>
                  <Th className="min-w-[210px]">Thiết bị & Trình duyệt</Th>
                  <Th className="min-w-[170px]">Vị trí / Địa chỉ IP</Th>
                  <Th className="min-w-[150px]">Thời gian</Th>
                  <Th className="min-w-[160px]">Trạng thái & Rủi ro</Th>
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </Thead>
              <Tbody>
                {paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-sm text-stone-400">
                      Không tìm thấy bản ghi đăng nhập nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  paginatedHistory.map(item => {
                    const ua = parseUserAgent(item.userAgent)
                    const ip = parseIpLocation(item.ipAddress)
                    const risk = assessSecurityRisk(item, history)

                    // Visual tint for risk
                    const isHighRisk = risk.level === 'high'
                    const isWarning = risk.level === 'warning'
                    const rowBorderClass = isHighRisk
                      ? 'border-l-4 border-l-red-500 bg-red-50/40'
                      : isWarning
                        ? 'border-l-4 border-l-amber-400 bg-amber-50/20'
                        : 'border-l-4 border-l-transparent'

                    return (
                      <Tr
                        key={item.id}
                        onClick={() => setSelectedLog({ log: item, risk })}
                        className={`${rowBorderClass} cursor-pointer transition-colors hover:bg-stone-50`}
                      >
                        {/* Account */}
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-700">
                              {(item.fullName || item.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-stone-900">
                                {item.fullName || 'Tài khoản chưa xác định'}
                              </p>
                              <p className="truncate text-xs text-stone-500">{item.email}</p>
                            </div>
                          </div>
                        </Td>

                        {/* Roles */}
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {item.roles.length ? (
                              item.roles.map(r => (
                                <span
                                  key={r}
                                  className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-700"
                                >
                                  {activityRoleLabel(r)}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-stone-400">—</span>
                            )}
                          </div>
                        </Td>

                        {/* Device & Browser (Parsed clean + Tooltip) */}
                        <Td>
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                              <BrowserIconBadge type={ua.iconType} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-stone-800">
                                {ua.displayShort}
                              </p>
                              <p
                                className="truncate text-[11px] text-stone-400 cursor-help"
                                title={`User-Agent: ${item.userAgent || '—'}`}
                              >
                                {ua.displayDevice}
                              </p>
                            </div>
                          </div>
                        </Td>

                        {/* Location / IP */}
                        <Td>
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-800">
                              <span>{ip.flag}</span>
                              <span className="truncate">{ip.city}</span>
                            </span>
                            <div className="mt-0.5 flex items-center gap-1">
                              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-mono text-stone-600">
                                {ip.ip}
                              </code>
                              <button
                                type="button"
                                title="Sao chép IP"
                                onClick={e => {
                                  e.stopPropagation()
                                  copyToClipboard(ip.ip, 'IP')
                                }}
                                className="text-stone-400 hover:text-stone-700"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </Td>

                        {/* Timestamp */}
                        <Td>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-stone-800">
                              {formatTimeOnly(item.occurredAt)}
                            </span>
                            <span className="text-[11px] text-stone-400">
                              {formatDateOnly(item.occurredAt)} · {formatTimeAgo(item.occurredAt)}
                            </span>
                          </div>
                        </Td>

                        {/* Status & Risk Alert Badge */}
                        <Td>
                          {item.success ? (
                            <Badge variant="success">✓ Thành công</Badge>
                          ) : isHighRisk ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                              <svg className="h-3.5 w-3.5 shrink-0 text-red-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>{risk.badgeText}</span>
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                              <span>⚠️</span>
                              <span>{risk.badgeText}</span>
                            </span>
                          ) : (
                            <Badge variant="error">
                              {item.failureReason ? activityActionLabel(item.failureReason) : 'Thất bại'}
                            </Badge>
                          )}
                        </Td>

                        {/* Row Actions */}
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog({ log: item, risk })}
                              className="text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs px-2.5 py-1"
                            >
                              Chi tiết
                            </Button>

                            {/* Quick Lock/Unlock button for high risk or failed attempts */}
                            {item.userId && item.userId !== user.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setUserToLock({
                                    id: item.userId!,
                                    email: item.email,
                                    name: item.fullName || 'Người dùng',
                                    isLocked: false,
                                  })
                                }
                                className={`text-xs px-2.5 py-1 ${isHighRisk ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' : 'text-stone-600'}`}
                              >
                                Khóa TK
                              </Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    )
                  })
                )}
              </Tbody>
            </Table>

            {/* Pagination Controls */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-3.5 sm:flex-row">
              <p className="text-xs text-stone-500">
                Hiển thị{' '}
                <span className="font-semibold text-stone-800">
                  {filteredHistory.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{' '}
                –{' '}
                <span className="font-semibold text-stone-800">
                  {Math.min(currentPage * pageSize, filteredHistory.length)}
                </span>{' '}
                trong tổng số{' '}
                <span className="font-semibold text-stone-800">{filteredHistory.length}</span> bản ghi
              </p>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="h-8 px-2 text-xs"
                  title="Về trang đầu"
                >
                  « Đầu
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="h-8 px-2.5 text-xs"
                >
                  ‹ Trước
                </Button>

                {/* Page number buttons */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum: number
                  if (totalPages <= 5) pageNum = idx + 1
                  else if (currentPage <= 3) pageNum = idx + 1
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + idx
                  else pageNum = currentPage - 2 + idx

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold transition ${
                        currentPage === pageNum
                          ? 'bg-[#e9a12c] text-[#3f2607] shadow-sm'
                          : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5 text-xs"
                >
                  Sau ›
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="h-8 px-2 text-xs"
                  title="Đến trang cuối"
                >
                  Cuối »
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CHI TIẾT LOG KIỂM TOÁN AN NINH (SECOPS INSPECTION)          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Chi tiết kiểm toán an ninh đăng nhập"
        size="2xl"
      >
        {selectedLog && (() => {
          const { log, risk } = selectedLog
          const ua = parseUserAgent(log.userAgent)
          const ip = parseIpLocation(log.ipAddress)

          return (
            <div className="space-y-5 fade-in">
              {/* Account summary banner */}
              <div className="flex flex-col justify-between gap-3 rounded-xl bg-stone-50 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#292a27] text-base font-bold text-white shadow-sm">
                    {(log.fullName || log.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">{log.fullName || 'Tài khoản chưa xác định'}</h3>
                    <p className="text-xs text-stone-500">{log.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {log.roles.map(r => (
                        <span key={r} className="rounded bg-stone-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700">
                          {activityRoleLabel(r)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end">
                  <span className="text-xs text-stone-400">Thời điểm ghi nhận</span>
                  <span className="text-sm font-semibold text-stone-800">{formatFullDateTime(log.occurredAt)}</span>
                  <span className="text-xs text-stone-500">{formatTimeAgo(log.occurredAt)}</span>
                </div>
              </div>

              {/* Security Risk Assessment */}
              <div
                className={`rounded-xl border p-4 ${
                  risk.level === 'high'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : risk.level === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {risk.level === 'high' ? '🚨' : risk.level === 'warning' ? '⚠️' : '🛡️'}
                    </span>
                    <h4 className="font-bold text-sm">{risk.title}</h4>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      risk.level === 'high'
                        ? 'bg-red-200 text-red-900'
                        : risk.level === 'warning'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {risk.badgeText}
                  </span>
                </div>

                <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
                  {risk.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>

                {risk.recommendedAction && (
                  <p className="mt-2 text-xs font-semibold pt-2 border-t border-red-200/60">
                    💡 Khuyến nghị xử lý: {risk.recommendedAction}
                  </p>
                )}
              </div>

              {/* Details grid: Hardware/Browser & Network/Geo */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Hardware & Browser */}
                <div className="rounded-xl border border-stone-200 p-4 bg-white space-y-2.5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                    Thiết bị & Trình duyệt
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Trình duyệt:</span>
                      <span className="font-semibold text-stone-800">{ua.browserDisplay}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Hệ điều hành:</span>
                      <span className="font-semibold text-stone-800">{ua.os}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Loại thiết bị:</span>
                      <span className="font-semibold text-stone-800 capitalize">{ua.deviceType}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-stone-500">Môi trường:</span>
                      <span className="font-semibold text-stone-800">
                        {ua.isAutomated ? 'API Client / Script' : 'Trình duyệt Web'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Network & Geolocation */}
                <div className="rounded-xl border border-stone-200 p-4 bg-white space-y-2.5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                    Mạng & Vị trí địa lý (Geo-IP)
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Địa chỉ IP:</span>
                      <code className="font-mono font-bold text-stone-900 bg-stone-100 px-1 rounded">
                        {ip.ip}
                      </code>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Vị trí ước tính:</span>
                      <span className="font-semibold text-stone-800">
                        {ip.flag} {ip.city}, {ip.country}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Loại kết nối:</span>
                      <span className="font-semibold text-stone-800 uppercase">{ip.networkType}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-stone-500">Nhà mạng / ISP:</span>
                      <span className="font-semibold text-stone-800">{ip.isp}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw User Agent code box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                    Chuỗi User-Agent gốc (HTTP Header)
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(log.userAgent || '', 'User-Agent')}
                    className="text-xs font-semibold text-[#855306] hover:underline"
                  >
                    {copiedText === 'User-Agent' ? '✓ Đã chép!' : 'Sao chép chuỗi UA'}
                  </button>
                </div>
                <pre className="max-h-24 overflow-auto rounded-lg bg-[#1e1f1d] p-3 font-mono text-[11px] text-stone-300 leading-relaxed break-all whitespace-pre-wrap">
                  {log.userAgent || '—'}
                </pre>
              </div>

              {/* Modal footer actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-200">
                <div className="flex items-center gap-2">
                  {log.userId && log.userId !== user.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLog(null)
                        setUserToLock({
                          id: log.userId!,
                          email: log.email,
                          name: log.fullName || 'Người dùng',
                          isLocked: false,
                        })
                      }}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Khóa tài khoản này
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                    Đóng
                  </Button>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: XÁC NHẬN THU HỒI TẤT CẢ PHIÊN KHÁC                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={confirmRevokeAllOpen}
        onClose={() => setConfirmRevokeAllOpen(false)}
        title="Xác nhận thu hồi toàn bộ phiên đăng nhập khác"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-bold">⚠️ Lưu ý quản trị an ninh:</p>
            <p className="mt-1">
              Hành động này sẽ buộc đăng xuất tất cả các tài khoản đang làm việc trên mọi thiết bị ngoại trừ phiên hiện tại của bạn.
            </p>
            <p className="mt-2 text-xs text-red-700">
              Tổng số phiên sẽ bị hủy bỏ: <strong>{activeSessionsCount - 1}</strong> phiên.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmRevokeAllOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              variant="danger"
              disabled={actionInProgress}
              onClick={() => handleRevokeAllOtherSessions()}
            >
              {actionInProgress ? 'Đang thu hồi…' : 'Xác nhận thu hồi tất cả'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: XÁC NHẬN KHÓA / MỞ KHÓA TÀI KHOẢN                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={Boolean(userToLock)}
        onClose={() => setUserToLock(null)}
        title={userToLock?.isLocked ? 'Xác nhận mở khóa tài khoản' : 'Xác nhận khóa tài khoản tạm thời'}
      >
        {userToLock && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              Bạn có chắc chắn muốn {userToLock.isLocked ? 'mở khóa' : 'tạm khóa'} tài khoản{' '}
              <strong className="text-stone-900">{userToLock.name}</strong> ({userToLock.email})?
            </p>
            {!userToLock.isLocked && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                Khi bị tạm khóa, người dùng sẽ không thể đăng nhập và mọi phiên đang mở sẽ tự động bị đình chỉ hiệu lực.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setUserToLock(null)}>
                Hủy bỏ
              </Button>
              <Button
                variant={userToLock.isLocked ? 'primary' : 'danger'}
                disabled={actionInProgress}
                onClick={handleConfirmUserLock}
              >
                {actionInProgress ? 'Đang thực hiện…' : userToLock.isLocked ? 'Mở khóa ngay' : 'Khóa tài khoản'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
