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
    ['customer', 'Customer', 'Khách Hàng'],
    ['staff', 'Staff', 'Nhân Viên'],
    ['business', 'Business', 'Quản Lý Vận Hành Kinh Doanh'],
    ['admin', 'Admin', 'Quản Trị Viên'],
  ] as const)('preserves the %s sidebar badge', (role, roleLabel, text) => {
    const sidebar = render(role, roleLabel).match(/<aside\b[\s\S]*?<\/aside>/)?.[0]
    expect(sidebar).toContain('px-4 pt-4 pb-2')
    expect(sidebar).toContain(text)
  })
})
