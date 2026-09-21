import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Avatar } from './ui'
import BrandLogo from './BrandLogo'
import type { PermissionKey, User, Role } from '../types'

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

export function getInitialPage(navItems: NavItem[], fallback: string) {
  const requestedPage = new URLSearchParams(window.location.search).get('page')
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
  onNotificationClick?: (notification: LayoutNotification) => void
  canAccess?: (permission: PermissionKey) => boolean
}


export default function Layout({
  user, navItems, currentPage, onNavigate, onLogout, children, roleLabel, notifications: suppliedNotifications, onNotificationClick, canAccess
}: LayoutProps) {
  const visibleNavItems = canAccess ? navItems.filter(item => !item.permission || canAccess(item.permission)) : navItems
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationReadKey = `storagehub-opened-notifications-v2-${user.id}`
  const notificationBadgeKey = `storagehub-seen-notification-badge-v2-${user.id}`
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

  useEffect(() => {
    const restorePage = () => {
      const requestedPage = new URLSearchParams(window.location.search).get('page')
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
    if (url.searchParams.get('page') === currentPage) return
    url.searchParams.set('page', currentPage)
    window.history.replaceState({ page: currentPage }, '', url)
  }, [currentPage])

  const navigate = (page: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('page', page)
    window.history.pushState({ page }, '', url)
    onNavigate(page)
  }

  // Chuẩn hóa nhãn điều hướng theo tiếng Việt cho toàn bộ cổng
  const getNavLabel = (item: NavItem) => {
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
      'units': 'Quản Lý Gian Kho',
      'staff': 'Phân Công Nhân Viên',
      'rentals': 'Hợp Đồng & Cước Thuê',
      'overdue': 'Quản Lý Nợ Quá Hạn',
      'facilities': 'Tổng Quan Cơ Sở',
      'performance': 'Hiệu Suất Vận Hành',
      'policies': 'Chính Sách Thuê',
      'pricing': 'Bảng Giá & Biểu Phí',
      'revenue': 'Báo Cáo Doanh Thu',
      'users': 'Quản Lý Người Dùng',
      'roles': 'Vai Trò & Phân Quyền',
      'login-history': 'Lịch Sử Đăng Nhập',
      'activity': 'Nhật Ký Hoạt Động',
      'settings': 'Cài Đặt Hệ Thống',
      'profile': 'Hồ Sơ Cá Nhân',
    }
    const mapping = navItemTranslations[item.id]
    if (mapping) return mapping
    return item.label
  }

  const getNavGroup = (group?: string) => {
    if (!group) return undefined
    const gLower = group.toLowerCase().trim()
    const groupMap: Record<string, string> = {
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
      'rentals & finance': 'Hợp Đồng & Tài Chính',
      'hợp đồng & tài chính': 'Hợp Đồng & Tài Chính',
      'portfolio': 'Danh Mục Cơ Sở',
      'danh mục': 'Danh Mục Cơ Sở',
      'commercial': 'Thương Mại & Biểu Phí',
      'thương mại': 'Thương Mại & Biểu Phí',
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
    if (lower.includes('staff') || lower.includes('nhân viên')) return 'Nhân Viên'
    if (lower.includes('customer') || lower.includes('khách hàng')) return 'Khách Hàng'
    if (lower.includes('manager') || lower.includes('quản lý')) return 'Quản Lý Cơ Sở'
    if (lower.includes('business') || lower.includes('đối tác') || lower.includes('kinh doanh')) return 'Đối Tác Kinh Doanh'
    if (lower.includes('admin') || lower.includes('quản trị')) return 'Quản Trị Viên'
    return roleLabel
  }

  const notificationCandidates = [
    { page: 'payments', vi: 'Có hóa đơn mới cần kiểm tra', timeVi: '5 phút trước' },
    { page: 'reservations', vi: 'Đơn đặt giữ kho đã được cập nhật', timeVi: '20 phút trước' },
    { page: 'overdue', vi: 'Có tài khoản quá hạn cần xử lý', timeVi: '30 phút trước' },
    { page: 'tasks', vi: 'Nhiệm vụ trong ca làm việc vừa thay đổi', timeVi: '1 giờ trước' },
    { page: 'activity', vi: 'Nhật ký hệ thống có hoạt động mới', timeVi: '2 giờ trước' },
    { page: 'support', vi: 'Yêu cầu hỗ trợ có phản hồi mới', timeVi: '2 giờ trước' },
    { page: 'units', vi: 'Trạng thái gian kho vừa được cập nhật', timeVi: '3 giờ trước' },
  ]
  const fallbackNotifications: LayoutNotification[] = notificationCandidates
    .filter(item => visibleNavItems.some(nav => nav.id === item.page))
    .slice(0, 3)
    .map(item => ({
      id: `${roleLabel}-${item.page}`,
      title: item.vi,
      message: item.timeVi,
      page: item.page
    }))
  const notifications = suppliedNotifications ?? fallbackNotifications
  const unreadCount = notifications.filter(item => !badgeSeenNotificationIds.includes(item.id)).length

  const formatNotificationDate = (value?: string) => {
    if (!value) return ''
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
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
    setNotificationsOpen(false)
    if (onNotificationClick) onNotificationClick(notification)
    else navigate(notification.page)
  }

  return (
    <div className="flex h-full bg-[#f3f2eb]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#292a27] border-r border-[#44453f] text-white flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#44453f] flex items-center justify-between">
          <BrandLogo light subtitle={'Lưu trữ an toàn'} />
        </div>

        {/* Role badge */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span className="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-[.08em] font-semibold bg-[#3a3933] text-[#f3c675] border border-[#4b4940]">
            {getTranslatedRole()}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto" aria-label={`${roleLabel} navigation`}>
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
            className={`w-full flex items-center gap-3 p-2 rounded-lg transition text-left mb-2.5 group ${
              currentPage === 'profile'
                ? 'bg-[#3a3933] border border-[#4b4940] shadow-sm'
                : 'hover:bg-white/5'
            }`}
            title="View Profile & Settings"
          >
            <Avatar name={user.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-200 transition">{user.name}</p>
              <p className="text-xs text-stone-400 truncate">{user.email}</p>
            </div>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded transition ${
              currentPage === 'profile' ? 'bg-[#e9a12c] text-[#292a27] font-semibold' : 'text-stone-400 group-hover:text-stone-200'
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
            aria-label="Open navigation menu"
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
          <div className="flex-1" />

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={openNotifications}
              className={`relative text-stone-400 hover:text-stone-700 transition p-2 rounded-lg hover:bg-stone-100 ${roleLabel === 'Customer' ? 'customer-notification-bell' : ''}`}
              aria-label={'Xem thông báo'}
              title={'Thông báo'}
              aria-expanded={notificationsOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                  <p className="font-semibold text-stone-900">{'Thông báo'}</p>
                  <span className="text-xs text-stone-400">{notifications.length}</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length ? notifications.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => openNotificationDetail(item)}
                      className={`block w-full border-b border-stone-100 px-4 py-3 text-left transition last:border-0 hover:bg-amber-100 ${readNotificationIds.includes(item.id) ? 'bg-white' : 'bg-amber-50'}`}
                    >
                      <span className="flex items-start gap-2">
                        {!readNotificationIds.includes(item.id) && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                        <span className="block text-sm font-medium text-stone-800">{item.title}</span>
                      </span>
                      {item.message && <span className="mt-1 block text-xs text-stone-500">{item.message}</span>}
                      {item.date && <span className="mt-1 block text-[10px] text-stone-400">{formatNotificationDate(item.date)}</span>}
                    </button>
                  )) : (
                    <p className="px-4 py-6 text-center text-sm text-stone-500">{'Chưa có thông báo mới'}</p>
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
            <Avatar name={user.name} size="sm" />
          </button>
        </header>

        {/* Content */}
        <main data-layout-scroll-container className="flex-1 overflow-y-auto p-4 lg:p-7 fade-in">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>

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
