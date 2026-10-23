import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from './ui'
import BrandLogo from './BrandLogo'
import type { PermissionKey, User, Role } from '../types'
import { isApiAuthenticated } from '../services/authApi'
import { markAllNotificationsRead } from '../services/notificationApi'

export interface NavItem {
  id: string
  label: string
  icon: ReactNode
  group?: string
  permission?: PermissionKey
}

export interface LayoutNotification {
  id: string
  title: string
  message?: string
  date?: string
  page: string
  targetId?: string
  isRead?: boolean
}

function resolveNavPage(navItems: NavItem[], requested: string | null): string | null {
  if (!requested) return null
  if (requested === 'profile') return 'profile'
  if (requested === 'policies' && navItems.some(item => item.id === 'policies')) return 'policies'
  if (navItems.some(item => item.id === requested)) return requested

  // Cross-role page alias resolution
  if (requested === 'browse-units' || requested === 'units') {
    if (navItems.some(item => item.id === 'browse-units')) return 'browse-units'
    if (navItems.some(item => item.id === 'units')) return 'units'
    if (navItems.some(item => item.id === 'inventory')) return 'inventory'
    if (navItems.some(item => item.id === 'portfolio')) return 'portfolio'
  }
  if (requested === 'browse-facilities' || requested === 'facilities' || requested === 'portfolio') {
    if (navItems.some(item => item.id === 'browse-facilities')) return 'browse-facilities'
    if (navItems.some(item => item.id === 'portfolio')) return 'portfolio'
  }
  if (requested === 'reports' || requested === 'revenue' || requested === 'performance') {
    if (navItems.some(item => item.id === 'reports')) return 'reports'
    if (navItems.some(item => item.id === 'revenue')) return 'revenue'
    if (navItems.some(item => item.id === 'performance')) return 'performance'
  }
  if (requested === 'reservations' || requested === 'holds' || requested === 'my-reservations') {
    if (navItems.some(item => item.id === 'reservations')) return 'reservations'
  }
  if (requested === 'my-rentals' || requested === 'rentals' || requested === 'leases') {
    if (navItems.some(item => item.id === 'my-rentals')) return 'my-rentals'
    if (navItems.some(item => item.id === 'rentals')) return 'rentals'
  }
  if (requested === 'checkins' || requested === 'checkin' || requested === 'returns' || requested === 'return') {
    if (navItems.some(item => item.id === 'moves')) return 'moves'
  }
  if (requested === 'overdue' || requested === 'billing' || requested === 'payments') {
    if (navItems.some(item => item.id === 'payments')) return 'payments'
  }
  if (requested === 'staff' || requested === 'tasks') {
    if (navItems.some(item => item.id === 'staff-tasks')) return 'staff-tasks'
  }
  return null
}

function requestedPageFromLocation() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/profile' || pathname === '/profile/security') return 'profile'
  if (pathname.startsWith('/admin/')) {
    const adminSub = pathname.replace('/admin/', '').split('/')[0]
    if (adminSub) return adminSub
  }
  return new URLSearchParams(window.location.search).get('page')
}

export function getInitialPage(navItems: NavItem[], fallback: string) {
  const requestedPage = requestedPageFromLocation()
  return resolveNavPage(navItems, requestedPage) ?? fallback
}

interface LayoutProps {
  user: User
  navItems: NavItem[]
  currentPage: string
  onNavigate: (page: string) => void
  onLogout: () => void
  children: ReactNode
  roleLabel: string
  roleColor: string
  notifications?: LayoutNotification[]
  additionalNotifications?: LayoutNotification[]
  onNotificationClick?: (notification: LayoutNotification) => void
  canAccess?: (permission: PermissionKey) => boolean
}


export default function Layout({
  user, navItems, currentPage, onNavigate, onLogout, children, roleLabel, roleColor, notifications: suppliedNotifications, additionalNotifications, onNotificationClick, canAccess
}: LayoutProps) {
  const roleTaskbarColor: Record<Role, string> = {
    customer: '#F4C542',
    staff: '#22C55E',
    manager: '#2F80ED',
    business: '#F2BDCC',
    admin: '#EF4444',
  }
  const taskbarColor = roleTaskbarColor[user.role] ?? '#F2BDCC'
  const visibleNavItems = canAccess ? navItems.filter(item => !item.permission || canAccess(item.permission)) : navItems
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationAreaRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!notificationsOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationAreaRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationsOpen])
  const notificationReadKey = `storagehub-opened-notifications-v2-${user.id}`
  const notificationBadgeKey = `storagehub-seen-notification-badge-v2-${user.id}`
  const bellActionStorageKey = `storagehub-bell-actions-${user.id}`
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(notificationReadKey) || '[]')
    } catch {
      return []
    }
  })
  const [badgeSeenNotificationIds, setBadgeSeenNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(notificationBadgeKey) || '[]')
    } catch {
      return []
    }
  })
  const [bellActionNotifications, setBellActionNotifications] = useState<LayoutNotification[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(bellActionStorageKey) || '[]')
    } catch {
      return []
    }
  })
  const [isBellRinging, setIsBellRinging] = useState(false)

  useEffect(() => {
    const handleBellNotification = (e: Event) => {
      const notif = (e as CustomEvent<LayoutNotification>).detail
      if (!notif) return
      setBellActionNotifications(prev => {
        const next = [notif, ...prev.filter(item => item.id !== notif.id)].slice(0, 50)
        try {
          localStorage.setItem(bellActionStorageKey, JSON.stringify(next))
        } catch {}
        return next
      })
      setIsBellRinging(true)
      window.setTimeout(() => setIsBellRinging(false), 1200)
    }
    window.addEventListener('storagehub:bell-notification', handleBellNotification)
    return () => window.removeEventListener('storagehub:bell-notification', handleBellNotification)
  }, [user.id, bellActionStorageKey])

  useEffect(() => {
    const restorePage = () => {
      const requestedPage = requestedPageFromLocation()
      const target = resolveNavPage(visibleNavItems, requestedPage)
      if (target) {
        onNavigate(target)
      }
    }
    window.addEventListener('popstate', restorePage)
    return () => window.removeEventListener('popstate', restorePage)
  }, [visibleNavItems, onNavigate])

  useEffect(() => {
    if (currentPage !== 'profile' && !visibleNavItems.some(item => item.id === currentPage)) {
      onNavigate(visibleNavItems[0]?.id ?? 'profile')
    }
  }, [currentPage, visibleNavItems, onNavigate])

  useEffect(() => {
    const url = new URL(window.location.href)
    const legacyPathname = url.pathname.replace(/\/+$/, '') || '/'

    // Always clean up lingering tab query param when leaving profile/notifications
    if (currentPage !== 'profile' && url.searchParams.has('tab')) {
      url.searchParams.delete('tab')
    } else if (currentPage === 'profile' && legacyPathname === '/profile/security' && !url.searchParams.has('tab')) {
      url.searchParams.set('tab', 'security')
    }

    // Keep every authenticated portal page shareable through /?page={page}.
    url.pathname = '/'
    url.searchParams.set('page', currentPage)
    window.history.replaceState({ page: currentPage }, '', url)
  }, [currentPage])

  const navigate = (page: string, fromMenu = true) => {
    const url = new URL(window.location.href)
    url.pathname = '/'
    url.searchParams.set('page', page)
    url.searchParams.delete('tab')
    window.history.pushState({ page }, '', url)
    onNavigate(page)
    if (fromMenu) contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Chuẩn hóa nhãn điều hướng theo tiếng Việt cho toàn bộ cổng
  const getNavLabel = (item: NavItem) => {
    if (item.label && item.label.trim()) return item.label
    const navItemTranslations: Record<string, string> = {
      'overview': 'Tổng Quan',
      'browse-facilities': 'Tìm Cơ Sở Kho',
      'browse-units': 'Kho Còn Trống',
      'reservations': 'Đơn Đặt Giữ Kho',
      'my-rentals': 'Hợp Đồng Của Tôi',
      'payments': 'Lịch Sử Thanh Toán',
      'support': 'Hỗ Trợ Khách Hàng',
      'tasks': 'Nhiệm Vụ Hàng Ngày',
      'checkin': 'Bàn Giao & Nhận Kho',
      'return': 'Nghiệm Thu Trả Kho',
      'dashboard': 'Bảng Điều Khiển',
      'reports': 'Báo Cáo Cơ Sở',
      'units': 'Quản Lý Kho',
      'staff': 'Phân Công Nhân Viên',
      'rentals': 'Hợp Đồng & Cước Thuê',
      'overdue': 'Quản Lý Nợ Quá Hạn',
      'facilities': 'Quản Lý Cơ Sở',
      'performance': 'Hiệu Suất Mặt Bằng',
      'policies': 'Gói Thuê',
      'pricing': 'Bảng Giá Loại Kho',
      'revenue': 'Báo Cáo Doanh Thu',
      'users': 'Quản Lý Người Dùng',
      'roles': 'Vai Trò & Phân Quyền',
      'login-history': 'Lịch Sử Đăng Nhập',
      'activity': 'Nhật Ký Hoạt Động',
      'settings': 'Cài Đặt Hệ Thống',
      'profile': 'Hồ Sơ Cá Nhân',
      'returns': 'Trả Kho & Quyết Toán',
      'rental-regulations': 'Quy Định Cho Thuê',
      'rental-source-policies': 'Chính Sách Gia Hạn',
      'damage-incidents': 'Xử Lý Sự Cố Kho',
    }
    const mapping = navItemTranslations[item.id]
    if (mapping) return mapping
    return item.label
  }

  const getNavGroup = (group?: string) => {
    if (!group) return undefined
    const gLower = group.toLowerCase().trim()
    const groupMap: Record<string, string> = {
      'cơ sở & mặt bằng': 'Cơ Sở & Mặt Bằng',
      'giá & khuyến mãi': 'Giá & Khuyến Mãi',
      'quy định & pháp lý': 'Quy Định & Pháp Lý',
      'vận hành & hậu mãi': 'Vận Hành & Hậu Mãi',
      'báo cáo thống kê': 'Báo Cáo Thống Kê',
      'my storage': 'Kho Của Tôi',
      'kho của tôi': 'Kho Của Tôi',
      'find storage': 'Tìm Kho',
      'tìm kho': 'Tìm Kho',
      'bookings': 'Đặt Giữ Kho',
      'đặt kho': 'Đặt Giữ Kho',
      'đặt giữ kho': 'Đặt Giữ Kho',
      'account': 'Tài Khoản',
      'tài khoản': 'Tài Khoản',
      'work queue': 'Ca Làm Việc',
      'ca làm việc': 'Ca Làm Việc',
      'customer service': 'Dịch Vụ Khách Hàng',
      'dịch vụ khách hàng': 'Dịch Vụ Khách Hàng',
      'support': 'Chăm Sóc & Hỗ Trợ',
      'chăm sóc & hỗ trợ': 'Chăm Sóc & Hỗ Trợ',
      'overview': 'Tổng Quan',
      'tổng quan': 'Tổng Quan',
      'facility operations': 'Vận Hành Cơ Sở',
      'vận hành cơ sở': 'Vận Hành Cơ Sở',
      'vận hành': 'Vận Hành & Hậu Mãi',
      'vận hành & trả kho': 'Vận Hành & Hậu Mãi',
      'rentals & finance': 'Hợp Đồng & Tài Chính',
      'hợp đồng & tài chính': 'Hợp Đồng & Tài Chính',
      'portfolio': 'Cơ Sở & Mặt Bằng',
      'danh mục': 'Cơ Sở & Mặt Bằng',
      'commercial': 'Giá & Khuyến Mãi',
      'thương mại': 'Giá & Khuyến Mãi',
      'reporting': 'Báo Cáo Thống Kê',
      'báo cáo': 'Báo Cáo Thống Kê',
      'administration': 'Quản Trị Hệ Thống',
      'quản trị': 'Quản Trị Hệ Thống',
      'security & audit': 'An Ninh & Giám Sát',
      'bảo mật & giám sát': 'An Ninh & Giám Sát',
      'system': 'Hệ Thống',
      'hệ thống': 'Hệ Thống',
      'leasing operations': 'Vận Hành Kho',
      'finance & risk': 'Tài Chính & Rủi Ro',
      'governance & audit': 'Quản Trị & Giám Sát',
    }
    const match = groupMap[gLower]
    if (match) return match
    return group
  }

  const getTranslatedRole = () => {
    const lower = roleLabel.toLowerCase()
    if (lower.includes('staff') || lower.includes('nhân viên')) return 'Nhân viên'
    if (lower.includes('customer') || lower.includes('khách hàng')) return 'Khách hàng'
    if (lower.includes('business') || lower.includes('đối tác') || lower.includes('kinh doanh') || lower.includes('thương mại')) return 'Quản lý vận hành kinh doanh'
    if (lower.includes('manager') || lower.includes('quản lý')) return 'Quản lý cơ sở'
    if (lower.includes('admin') || lower.includes('quản trị')) return 'Quản trị viên'
    return roleLabel
  }

  const allNotificationsMap = new Map<string, LayoutNotification>()
  bellActionNotifications.forEach(n => allNotificationsMap.set(n.id, n))
  ;(suppliedNotifications ?? []).forEach(n => {
    if (!allNotificationsMap.has(n.id)) allNotificationsMap.set(n.id, n)
  })
  ;(additionalNotifications ?? []).forEach(n => {
    if (!allNotificationsMap.has(n.id)) allNotificationsMap.set(n.id, n)
  })
  const notifications = Array.from(allNotificationsMap.values())

  const isNotificationRead = (item: LayoutNotification) => Boolean(item.isRead || readNotificationIds.includes(item.id))
  const unreadCount = notifications.filter(item => !item.isRead && !badgeSeenNotificationIds.includes(item.id)).length

  const formatNotificationDate = (value?: string) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    const diffSec = Math.floor((Date.now() - parsed.getTime()) / 1000)
    if (diffSec < 45) return 'Vừa xong'
    if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))} phút trước`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`
    return parsed.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const openNotifications = () => {
    setNotificationsOpen(open => !open)
    if (!notificationsOpen && unreadCount > 0) {
      const nextSeenIds = Array.from(new Set([...badgeSeenNotificationIds, ...notifications.map(item => item.id)]))
      setBadgeSeenNotificationIds(nextSeenIds)
      localStorage.setItem(notificationBadgeKey, JSON.stringify(nextSeenIds))
    }
  }

  const openNotificationDetail = (notification: LayoutNotification) => {
    const nextReadIds = Array.from(new Set([...readNotificationIds, notification.id]))
    setReadNotificationIds(nextReadIds)
    localStorage.setItem(notificationReadKey, JSON.stringify(nextReadIds))
    setBellActionNotifications(prev => {
      const updated = prev.map(item => item.id === notification.id ? { ...item, isRead: true } : item)
      try { localStorage.setItem(bellActionStorageKey, JSON.stringify(updated)) } catch {}
      return updated
    })
    setNotificationsOpen(false)
    if (onNotificationClick) onNotificationClick(notification)
    else navigate(notification.page, false)
  }

  const markAllAsRead = () => {
    const allIds = notifications.map(item => item.id)
    const nextReadIds = Array.from(new Set([...readNotificationIds, ...allIds]))
    setReadNotificationIds(nextReadIds)
    localStorage.setItem(notificationReadKey, JSON.stringify(nextReadIds))
    setBadgeSeenNotificationIds(nextReadIds)
    localStorage.setItem(notificationBadgeKey, JSON.stringify(nextReadIds))
    setBellActionNotifications(prev => {
      const updated = prev.map(item => ({ ...item, isRead: true }))
      try { localStorage.setItem(bellActionStorageKey, JSON.stringify(updated)) } catch {}
      return updated
    })
    if (isApiAuthenticated()) {
      void markAllNotificationsRead().catch(() => undefined)
      window.dispatchEvent(new Event('storagehub:notifications-refresh'))
    }
  }

  return (
    <div className={`flex h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#f3f2eb] ${user.role === 'customer' ? 'customer-role-layout' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ borderTopColor: taskbarColor }}
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 shrink-0 border-t-4 bg-[#292a27] border-r border-[#44453f] text-white flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#44453f] flex items-center justify-between">
          <BrandLogo light subtitle={'Lưu trữ an toàn'} />
        </div>

        {/* Role & Facility badge */}
        <div className="px-4 pt-4 pb-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] tracking-[.08em] font-semibold border ${roleColor || 'bg-[#3a3933] text-[#f3c675] border-[#4b4940]'}`}>
              {getTranslatedRole()}
            </span>
          </div>
          {(user.role === 'manager' || user.role === 'staff') && (
            user.facility ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#3a3933]/80 border border-[#4b4940] text-[11px] text-amber-300">
                <span>🏢</span>
                <span className="truncate font-medium">{user.facility}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-400">
                <span>⚠️ Chưa phân công cơ sở</span>
              </div>
            )
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto" aria-label={user.role === 'staff' ? 'Điều hướng nhân viên' : `${roleLabel} navigation`}>
          {visibleNavItems.map((item, index) => {
            const groupText = getNavGroup(item.group)
            const prevGroupText = getNavGroup(visibleNavItems[index - 1]?.group)
            return (
              <Fragment key={item.id}>
                {groupText && groupText !== prevGroupText && (
                  <p className={`px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500 ${index === 0 ? 'mt-1' : 'mt-5'}`}>
                    {groupText}
                  </p>
                )}
                <button
                  onClick={() => { navigate(item.id); setSidebarOpen(false) }}
                  className={`sidebar-link w-full mb-0.5 ${currentPage === item.id ? 'active' : ''}`}
                >
                  <span>{getNavLabel(item)}</span>
                </button>
              </Fragment>
            )
          })}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-[#44453f]">
          <button
            type="button"
            onClick={() => { navigate('profile'); setSidebarOpen(false) }}
            className={`w-full flex items-center gap-3 p-2 rounded-lg transition text-left mb-2.5 group ${currentPage === 'profile'
                ? 'bg-[#3a3933] border border-[#4b4940] shadow-sm'
                : 'hover:bg-white/5'
              }`}
            title={user.role === 'staff' ? 'Xem hồ sơ và cài đặt' : 'View Profile & Settings'}
          >
            <Avatar name={user.name} size="md" imageUrl={user.avatar} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-200 transition">{user.name}</p>
              <p className="text-xs text-stone-400 truncate">{user.email}</p>
            </div>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded transition ${currentPage === 'profile' ? 'bg-[#e9a12c] text-[#292a27] font-semibold' : 'text-stone-400 group-hover:text-stone-200'
              }`}>
              {'Hồ sơ'}
            </span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => { navigate('profile'); setSidebarOpen(false) }}
              className={`sidebar-link flex-1 ${currentPage === 'profile' ? 'active' : ''}`}
            >
              <svg className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {'Tài khoản'}
            </button>
            <button
              onClick={onLogout}
              className="sidebar-link px-3 text-stone-400 hover:bg-red-950/30 hover:text-red-300"
              title={'Đăng xuất'}
            >
              {'Đăng xuất'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-[#deddd2] h-16 flex items-center px-4 lg:px-7 gap-3 lg:gap-4 flex-shrink-0">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-700 p-1"
            onClick={() => setSidebarOpen(true)}
            aria-label={user.role === 'staff' ? 'Mở trình đơn điều hướng' : 'Open navigation menu'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <BrandLogo className="lg:hidden" />
          <div className="hidden lg:block">
            <p className="text-xs text-stone-400 font-mono uppercase tracking-wider">{getTranslatedRole()} {'· CỔNG QUẢN TRỊ'}</p>
            <p className="text-sm font-semibold text-stone-800">{'Quản lý cơ sở lưu trữ thông minh StorageHub'}</p>
          </div>
          {(user.role === 'manager' || user.role === 'staff') && (
            <div className="hidden sm:flex items-center ml-2">
              {user.facility ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>🏢 Cơ sở: <strong className="font-bold text-emerald-950">{user.facility}</strong></span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <span>⚠️ Chưa phân công cơ sở</span>
                </div>
              )}
            </div>
          )}
          <div className="flex-1" />

          {/* Notifications */}
            <div className="relative" ref={notificationAreaRef}>
            <button
              type="button"
              onClick={openNotifications}
              className={`relative text-stone-400 hover:text-stone-700 transition p-2 rounded-lg hover:bg-stone-100 ${roleLabel === 'Customer' ? 'customer-notification-bell' : ''} ${isBellRinging ? 'bell-ring-active' : ''}`}
              aria-label={'Xem thông báo'}
              title={'Thông báo'}
              aria-expanded={notificationsOpen}
            >
              <svg className="show-icon w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-11 z-50 w-84 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 bg-stone-50/80">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-stone-900">{'Thông báo'}</p>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        {unreadCount} mới
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs text-amber-700 hover:text-amber-800 font-medium hover:underline cursor-pointer"
                      >
                        {'Đọc tất cả'}
                      </button>
                    )}
                    <span className="text-xs text-stone-400">({notifications.length})</span>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-stone-100">
                  {notifications.length ? notifications.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => openNotificationDetail(item)}
                      className={`block w-full px-4 py-3 text-left transition cursor-pointer hover:bg-amber-100/60 ${isNotificationRead(item) ? 'bg-white' : 'bg-amber-50/70'}`}
                    >
                      <span className="flex items-start gap-2">
                        {!isNotificationRead(item) && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-200" />}
                        <span className={`block text-sm ${!isNotificationRead(item) ? 'font-semibold text-stone-900' : 'font-medium text-stone-700'}`}>{item.title}</span>
                      </span>
                      {item.message && <span className="mt-1 block whitespace-pre-line text-xs text-stone-600 line-clamp-3">{
                        item.title === 'BO từ chối thay đổi loại kho' && !item.message.includes('Lý do:')
                          ? item.message.replace(/^([^·]+ · [^·]+) · /, '$1\nLý do: ')
                          : item.message
                      }</span>}
                      {item.date && <span className="mt-1.5 block text-[10px] text-stone-400 font-mono">{formatNotificationDate(item.date)}</span>}
                    </button>
                  )) : (
                    <div className="flex flex-col items-center justify-center px-4 py-10 text-center text-stone-400">
                      <p className="text-sm font-medium text-stone-600">{'Chưa có thông báo mới'}</p>
                      <p className="text-xs text-stone-400 mt-1">{'Mọi thông báo vận hành và hệ thống sẽ xuất hiện tại đây.'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('profile')}
            className={`p-0.5 rounded-full ring-offset-2 transition ${currentPage === 'profile' ? 'ring-2 ring-[#e9a12c]' : 'hover:opacity-80'}`}
            title="Go to profile"
          >
            <Avatar name={user.name} size="sm" imageUrl={user.avatar} />
          </button>
        </header>

        {/* Content */}
        <main ref={contentScrollRef} data-layout-scroll-container className="min-w-0 flex-1 basis-0 overflow-x-hidden overflow-y-auto p-4 lg:p-7 fade-in">
          <div className="mx-auto min-w-0 w-full max-w-[1600px]">{children}</div>

        </main>
      </div>
    </div>
  )
}

// ─── Nav Icon helpers ─────────────────────────────────────────────────────────

export const Icon = {
  clock: null,
  home: null,
  building: null,
  box: null,
  calendar: null,
  credit: null,
  support: null,
  tasks: null,
  users: null,
  chart: null,
  policy: null,
  tag: null,
  shield: null,
  log: null,
  key: null,
  alert: null,
  search: null,
  eye: null,
  refresh: null,
  plus: null,
  login: null,
  dollar: null,
  cog: null,
  clipboard: null,
  check: null,
  truck: null,
}
