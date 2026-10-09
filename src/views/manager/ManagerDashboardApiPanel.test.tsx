import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiActor } from '../../services/authApi'
import { manager } from '../../../tests/rentalApiFixtures'
import ManagerDashboardApiPanel from './ManagerDashboardApiPanel'

const state = vi.hoisted(() => ({ actor: null as ApiActor | null, reads: {} as Record<string, Record<string, unknown>>, identities: [] as string[] }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => state.actor }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: (identity: string) => {
  state.identities.push(identity)
  return { loading: false, ...(state.reads[identity.slice(identity.lastIndexOf(':') + 1)] ?? {}) }
} }))
beforeEach(() => { state.actor = { ...manager, permissions: [...manager.permissions, 'support:read'] }; state.reads = {}; state.identities = [] })
const render = () => renderToStaticMarkup(<ManagerDashboardApiPanel setPage={() => {}} />)

describe('Manager API dashboard: no business demo data', () => {
  it('renders server counts, preserves verified zero and labels missing totals honestly', () => {
    state.reads = { rentals: { data: { value: 37, completeness: 'COMPLETE' } }, 'active-rentals': { data: { value: 0, completeness: 'COMPLETE' } } }
    const html = render()
    expect(html).toContain('>37<')
    expect(html).toContain('>0<')
    expect(html).toContain('Chưa xác minh')
    expect(html).not.toContain('Tải lại')
  })
  it('never renders stale counts during loading or an API error', () => {
    state.reads = { rentals: { loading: true, data: { value: 888 } }, 'active-rentals': { error: new Error('Offline'), data: { value: 999 } } }
    const html = render()
    expect(html).toContain('Đang tải')
    expect(html).not.toContain('>888<')
    expect(html).not.toContain('>999<')
    expect(html).not.toContain('>0<')
  })
  it('does not describe partial overdue results as no debt', () => {
    state.reads = { 'payment-overdue': { data: { value: null, completeness: 'PARTIAL', reason: 'Chưa đủ dữ liệu công nợ.' } } }
    const html = render()
    expect(html).toContain('Chưa đủ dữ liệu công nợ.')
    expect(html).not.toContain('Không có khoản quá hạn')
    expect(html).not.toContain('>0<')
  })
  it('does not request unauthorized metrics or render demo for a missing actor', () => {
    state.actor = { ...manager, permissions: ['support:read'] }
    render()
    expect(state.identities).toHaveLength(1)
    state.actor = null
    state.identities = []
    expect(render()).toContain('Cần đăng nhập')
    expect(state.identities).toHaveLength(0)
  })
  it('re-keys every metric for account, permission and scope changes', () => {
    render()
    const previous = state.identities.slice()
    state.actor = { ...state.actor!, id: 'other-manager', facilityScopes: { f2: 'READ' } }
    state.identities = []
    render()
    expect(state.identities).toHaveLength(6)
    expect(state.identities.every(id => !previous.includes(id))).toBe(true)
  })
})
