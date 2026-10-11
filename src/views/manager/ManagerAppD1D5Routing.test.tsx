import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { User } from '../../types'
import ManagerApp from './ManagerApp'

const state = vi.hoisted(() => ({ api: true, page: 'dashboard', nav: [] as { id: string; permission: string; label: string }[] }))
vi.mock('../../services/authApi', async () => ({ ...await vi.importActual('../../services/authApi'), isApiAuthenticated: () => state.api, getAuthenticatedActor: () => ({ id: 'manager', facilityScopes: {} }), canApiActor: () => true }))
vi.mock('../../store/StorageHubContext', () => ({ useStorageHub: () => ({ facilities: [], rentals: [], renewals: [], returns: [], staffTasks: [], can: () => true }) }))
vi.mock('../../components/Layout', async () => ({
  ...await vi.importActual('../../components/Layout'),
  getInitialPage: () => state.page,
  default: ({ children, navItems }: { children: React.ReactNode; navItems: typeof state.nav }) => { state.nav = navItems; return <div>{children}</div> },
}))
vi.mock('./ManagerDashboardApiPanel', () => ({ default: (props: object) => <p>API dashboard {Object.keys(props).join(',')}</p> }))
vi.mock('./ManagerFinancialApiPanel', () => ({ default: (props: object) => <p>API financial {Object.keys(props).join(',')}</p> }))
vi.mock('./ManagerDashboardPanel', () => ({ default: () => <p>Legacy dashboard</p> }))
vi.mock('./ManagerPaymentsPanel', () => ({ default: () => <p>Legacy payments</p> }))
beforeEach(() => { state.api = true; state.page = 'dashboard'; state.nav = [] })
const render = () => renderToStaticMarkup(<ManagerApp user={{ id: 'manager' } as User} onLogout={() => {}} />)

describe('Manager D1-D5 routing isolation', () => {
  it.each(['dashboard', 'payments'])('uses only API %s in authenticated mode and never passes business Context props', page => {
    state.page = page
    const html = render()
    expect(html).toContain(page === 'dashboard' ? 'API dashboard setPage' : 'API financial setPage')
    expect(html).not.toContain('Legacy')
    for (const prop of ['rentals,', 'payments,', 'config,', 'applyRentalLateFee', 'setRentalOverlock', 'sendDelinquencyReminder']) expect(html).not.toContain(prop)
  })
  it.each(['dashboard', 'payments'])('preserves the explicit legacy %s branch outside API mode', page => {
    state.page = page; state.api = false
    expect(render()).toContain(page === 'dashboard' ? 'Legacy dashboard' : 'Legacy payments')
  })
  it('uses the existing D1 read permission for API finance without granting payment commands', () => {
    render()
    expect(state.nav.find(item => item.id === 'payments')).toMatchObject({ label: 'Thông tin tài chính', permission: 'rentals:read' })
    state.api = false; render()
    expect(state.nav.find(item => item.id === 'payments')).toMatchObject({ permission: 'payments:collect' })
  })
  it('keeps new runtime readers free of demo/store/storage imports and payment command clients', () => {
    for (const file of ['managerD1D5Api.ts', 'ManagerDashboardApiPanel.tsx', 'ManagerFinancialApiPanel.tsx']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      for (const forbidden of ['StorageHubContext', 'DemoDatabase', 'localStorage', 'sessionStorage', '/tests/', 'applyRentalLateFee', 'setRentalOverlock', 'sendDelinquencyReminder']) expect(source).not.toContain(forbidden)
    }
  })
})
