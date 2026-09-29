import { useState } from 'react'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import type { PermissionKey, User } from '../../types'
import { useStorageHub } from '../../store/StorageHubContext'
import { getAuthenticatedActor, isApiAuthenticated } from '../../services/authApi'
import ProfileView from '../ProfileView'
import AdminActivityPanel from './AdminActivityPanel'
import AdminLoginHistoryPanel from './AdminLoginHistoryPanel'
import AdminRolesPanel from './AdminRolesPanel'
import AdminSettingsPanel from './AdminSettingsPanel'
import AdminUsersPanel from './AdminUsersPanel'

export default function AdminShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { can } = useStorageHub()
  const apiActor = getAuthenticatedActor()
  const hasPermission = (permission: PermissionKey) => isApiAuthenticated()
    ? Boolean(apiActor?.permissions?.includes(permission))
    : can(user, permission)
  const navItems: NavItem[] = [
    { id: 'users', label: 'Quản lý người dùng', icon: Icon.users, group: 'Quản trị', permission: 'manage_users' as PermissionKey },
    { id: 'roles', label: 'Vai trò & Phân quyền', icon: Icon.shield, group: 'Quản trị', permission: 'manage_roles' as PermissionKey },
    { id: 'login-history', label: 'Lịch sử đăng nhập', icon: Icon.login, group: 'Bảo mật & Giám sát', permission: 'view_audit_logs' as PermissionKey },
    { id: 'activity', label: 'Nhật ký hoạt động', icon: Icon.log, group: 'Bảo mật & Giám sát', permission: 'view_audit_logs' as PermissionKey },
    { id: 'settings', label: 'Cài đặt hệ thống', icon: Icon.cog, group: 'Hệ thống', permission: 'manage_settings' as PermissionKey },
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
      {page === 'users' && hasPermission('manage_users') && <AdminUsersPanel user={user} showToast={showToast} />}
      {page === 'roles' && hasPermission('manage_roles') && <AdminRolesPanel user={user} showToast={showToast} />}
      {page === 'login-history' && hasPermission('view_audit_logs') && <AdminLoginHistoryPanel user={user} showToast={showToast} />}
      {page === 'activity' && hasPermission('view_audit_logs') && <AdminActivityPanel user={user} showToast={showToast} />}
      {page === 'settings' && hasPermission('manage_settings') && <AdminSettingsPanel user={user} showToast={showToast} />}
      {page === 'profile' && <div className="fade-in"><ProfileView user={user} /></div>}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-amber-500/50 bg-[#292a27] px-5 py-3 text-white shadow-2xl fade-in"><span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#e9a12c]" /><p className="text-sm font-medium">{toast}</p></div>}
    </Layout>
  )
}
