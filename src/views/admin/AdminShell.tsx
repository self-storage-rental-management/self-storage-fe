import { useState } from 'react'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import type { PermissionKey, User } from '../../types'
import { useStorageHub } from '../../store/StorageHubContext'
import { getAuthenticatedActor, isApiAuthenticated, normalizeApiPermissions } from '../../services/authApi'
import ProfileView from '../ProfileView'
import AdminActivityApiPanel from './AdminActivityApiPanel'
import AdminLoginHistoryApiPanel from './AdminLoginHistoryApiPanel'
import AdminRolesApiPanel from './AdminRolesApiPanel'
import AdminSettingsApiPanel from './AdminSettingsApiPanel'
import AdminUsersApiPanel from './AdminUsersApiPanel'

export default function AdminShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { can } = useStorageHub()
  const apiActor = getAuthenticatedActor()
  const apiPermissions = new Set(normalizeApiPermissions(apiActor?.permissions))
  const userPermissions = new Set(user.permissions ?? [])
  const hasPermission = (permission: PermissionKey) => isApiAuthenticated()
    ? apiPermissions.has(permission) || userPermissions.has(permission)
    : can(user, permission)
  const navItems: NavItem[] = [
    { id: 'users', label: 'Quản lý người dùng', icon: Icon.users, group: 'Quản trị', permission: 'users:manage' as PermissionKey },
    { id: 'roles', label: 'Vai trò & Phân quyền', icon: Icon.shield, group: 'Quản trị', permission: 'roles:manage' as PermissionKey },
    { id: 'login-history', label: 'Lịch sử đăng nhập', icon: Icon.login, group: 'Bảo mật & Giám sát', permission: 'audit_logs:read' as PermissionKey },
    { id: 'activity', label: 'Nhật ký hoạt động', icon: Icon.log, group: 'Bảo mật & Giám sát', permission: 'audit_logs:read' as PermissionKey },
    { id: 'settings', label: 'Cài đặt hệ thống', icon: Icon.cog, group: 'Hệ thống', permission: 'settings:manage' as PermissionKey },
  ]
  const [page, setPage] = useState(() => getInitialPage(navItems, 'users'))
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  return (
    <Layout
      user={user}
      navItems={navItems}
      currentPage={page}
      onNavigate={setPage}
      onLogout={onLogout}
      roleLabel="Quản Trị Viên Hệ Thống"
      roleColor="bg-red-100 text-red-700"
      canAccess={hasPermission}
    >
      <style>{`
        header button[title*="Thông báo" i] svg,
        header button[title*="Notification" i] svg,
        header button[aria-label*="thông báo" i] svg,
        header button[aria-label*="notification" i] svg,
        header .relative > button > svg { display: block !important; }
      `}</style>
      {page === 'users' && hasPermission('users:manage') && <AdminUsersApiPanel user={user} showToast={showToast} />}
      {page === 'roles' && hasPermission('roles:manage') && <AdminRolesApiPanel user={user} showToast={showToast} />}
      {page === 'login-history' && hasPermission('audit_logs:read') && <AdminLoginHistoryApiPanel user={user} showToast={showToast} />}
      {page === 'activity' && hasPermission('audit_logs:read') && <AdminActivityApiPanel user={user} showToast={showToast} />}
      {page === 'settings' && hasPermission('settings:manage') && <AdminSettingsApiPanel user={user} showToast={showToast} />}
      {page === 'profile' && <div className="fade-in"><ProfileView user={user} /></div>}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-amber-500/50 bg-[#292a27] px-5 py-3 text-white shadow-2xl fade-in"><span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#e9a12c]" /><p className="text-sm font-medium">{toast}</p></div>}
    </Layout>
  )
}
