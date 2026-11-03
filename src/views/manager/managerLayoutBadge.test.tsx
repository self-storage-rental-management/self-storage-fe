import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Layout from '../../components/Layout'
import type { Role } from '../../types'

function render(role: Role, roleLabel: string) {
  return renderToStaticMarkup(<Layout
    user={{ id: 'test-user', name: 'Test User', email: 'user@example.test', role }}
    navItems={[
      { id: 'dashboard', label: 'Dashboard', icon: null, permission: 'dashboard:read' },
      { id: 'settings', label: 'Settings', icon: null, permission: 'settings:manage' },
    ]}
    currentPage="dashboard"
    onNavigate={vi.fn()}
    onLogout={vi.fn()}
    canAccess={permission => permission === 'dashboard:read'}
    roleLabel={roleLabel}
    roleColor="amber"
    notifications={[]}
  ><p>Nội dung trang</p></Layout>)
}

describe('Manager sidebar role badge removal', () => {
  it.each([
    ['customer', 'Customer', 'Khách Hàng', 'text-yellow-300'],
    ['staff', 'Staff', 'Nhân Viên', 'text-green-400'],
    ['manager', 'Manager', 'Quản Lý Cơ Sở', 'text-blue-400'],
    ['business', 'Business', 'Quản Lý Vận Hành Kinh Doanh', 'text-orange-400'],
    ['admin', 'Admin', 'Quản Trị Viên', 'text-red-400'],
  ] as const)('colors the %s sidebar role', (role, roleLabel, text, color) => {
    const sidebar = render(role, roleLabel).match(/<aside\b[\s\S]*?<\/aside>/)?.[0]
    expect(sidebar).toContain('px-4 pt-4 pb-2')
    expect(sidebar).toContain(text)
    expect(sidebar).toContain(`font-bold ${color}`)
  })
})
