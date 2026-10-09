import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApiClientError } from '../../services/apiClient'
import { ManagerPresentationProvider, managerDisplayText, managerDisplayError } from './managerPresentation'
import ManagerActionNotice from './ManagerActionNotice'
import ApiReadState from '../rental-api/ApiReadState'
import SupportReadState from '../support-api/SupportReadState'
import RenewalDetail from '../rental-api/RenewalDetail'
import RentalDetail from '../rental-api/RentalDetail'
import { RenewalOperationsSummary } from '../rental-api/RenewalOperationsPanel'
import { SupportTicketSummary } from '../support-api/SupportTicketDetail'
import { rental, renewal, quote } from '../../../tests/rentalApiFixtures'
import { operationState } from '../../../tests/rentalOperationsApiFixtures'
import { supportActive } from '../../../tests/supportApiFixtures'
import { readFileSync } from 'node:fs'
import SupportApiWorkspace from '../support-api/SupportApiWorkspace'

describe('Manager-only readable presentation', () => {
  it('removes empty support parentheses without changing the source label', () => {
    const source = 'Hỗ trợ (D5 API)'
    expect(managerDisplayText(source)).toBe('Hỗ trợ khách hàng')
    expect(managerDisplayText('Hỗ trợ ()')).toBe('Hỗ trợ khách hàng')
    expect(managerDisplayText('Gửi yêu cầu (API)')).toBe('Gửi yêu cầu')
    expect(source).toBe('Hỗ trợ (D5 API)')
    const app = readFileSync(new URL('./ManagerApp.tsx', import.meta.url), 'utf8')
    expect(app).toContain('label: "Hỗ trợ khách hàng"')
    expect(app).not.toContain('label: "Hỗ trợ ()"')
  })
  it('matches shared typography within Manager only, preserving identifier fonts', () => {
    const css = readFileSync(new URL('./managerTypography.css', import.meta.url), 'utf8')
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').filter(rule => rule.trim())
    for (const rule of rules) {
      const selectors = rule.split('{')[0]
      expect(selectors.trim()).toMatch(/^\.manager-role-layout/)
    }
    expect(css).toContain('font-family: var(--font-sans)')
    expect(css).not.toContain('.manager-role-layout *')
    expect(css).not.toContain('code,')
    const app = readFileSync(new URL('./ManagerApp.tsx', import.meta.url), 'utf8')
    expect(app).toContain('manager-role-layout h-full font-sans text-sm')
  })
  it('uses readable Manager support typography and labels, keeping other role presentation intact', () => {
    const manager = renderToStaticMarkup(<ManagerPresentationProvider><SupportApiWorkspace role="manager" /></ManagerPresentationProvider>)
    expect(manager).toContain('Hỗ trợ khách hàng')
    expect(manager).not.toContain('Hỗ trợ ()')
    expect(manager).not.toContain('đúng role')
    expect(manager).toContain('text-lg font-bold text-stone-900')
    expect(manager).toContain('text-sm leading-relaxed')
    const other = renderToStaticMarkup(<SupportApiWorkspace role="customer" />)
    expect(other).toContain('Hỗ trợ khách hàng')
    expect(other).not.toContain('D5 API')
    expect(other).not.toContain('text-sm leading-relaxed')
  })
  it('translates labels and punctuation without changing their source values', () => {
    const source = { status: 'CONFIRMED', label: 'Staff — Customer; Manager' }
    expect(managerDisplayText(source.status)).toBe('Đã xác nhận')
    expect(managerDisplayText(source.label)).toBe('nhân viên - khách hàng, quản lý cơ sở')
    expect(source.status).toBe('CONFIRMED')
    expect(source.label).toBe('Staff — Customer; Manager')
  })
  it('removes operational banners but preserves safety warnings without the prefix', () => {
    expect(renderToStaticMarkup(<ManagerActionNotice>Chờ nhân viên</ManagerActionNotice>)).toBe('')
    const html = renderToStaticMarkup(<ManagerActionNotice tone="warning">Không đủ điều kiện</ManagerActionNotice>)
    expect(html).toContain('Không đủ điều kiện')
    expect(html).not.toContain('Trạng thái thao tác')
  })
  it.each([ApiReadState, SupportReadState])('hides reload only for Manager and preserves errors', (ReadState) => {
    const props = { loading: false, error: new ApiClientError('DEFERRED_SOURCE: internal_port', { status: 409 }), retry: () => {} }
    const manager = renderToStaticMarkup(<ManagerPresentationProvider><ReadState {...props} /></ManagerPresentationProvider>)
    const other = renderToStaticMarkup(<ReadState {...props} />)
    expect(manager).not.toContain('Tải lại')
    expect(manager).not.toContain('internal_port')
    expect(manager).toContain('Chưa đủ dữ liệu hoặc chính sách')
    expect(other).toContain('Tải lại')
    expect(other).not.toContain('internal_port')
    expect(other).toContain('Chưa đủ dữ liệu hoặc chính sách')
  })
  it('hides workflow/source codes in renewal progress without mutating shared state', () => {
    const state = { ...operationState, missingSources: ['BO_SIGNING_POLICY', 'UNKNOWN_INTERNAL_PORT'] }
    const before = JSON.stringify(state)
    const html = renderToStaticMarkup(<ManagerPresentationProvider><RenewalOperationsSummary state={state} /></ManagerPresentationProvider>)
    expect(html).not.toContain('Phiên bản workflow')
    expect(html).not.toContain('BO_SIGNING_POLICY')
    expect(html).not.toContain('UNKNOWN_INTERNAL_PORT')
    expect(html).toContain('Thông tin bổ sung')
    expect(JSON.stringify(state)).toBe(before)
    // D3 now uses user-facing copy for every audience; version remains command metadata,
    // not a UI requirement. Preserve the stronger Manager redaction checks above.
    const customer = renderToStaticMarkup(<RenewalOperationsSummary state={state} />)
    expect(customer).not.toContain('Phiên bản workflow')
    expect(customer).toContain('Chờ thanh toán cọc')
    expect(JSON.stringify(state)).toBe(before)
  })
  it('keeps financial completeness comparisons and actual deposit amount intact', () => {
    const record = { ...rental, financialSummary: { ...rental.financialSummary, completeness: 'COMPLETE' as const, securityDepositAmount: 1234567 } }
    const before = JSON.stringify(record)
    const html = renderToStaticMarkup(<ManagerPresentationProvider><RentalDetail rental={record} /></ManagerPresentationProvider>)
    expect(html).toContain('1.234.567 đ')
    expect(html).toContain('Đã xác minh đầy đủ')
    expect(JSON.stringify(record)).toBe(before)
  })
  it('hides policy version metadata and raw financial codes from Manager renewal detail', () => {
    const record = { ...renewal, acceptedTerms: quote, financialCheck: { ...renewal.financialCheck, completeness: 'COMPLETE' as const } }
    const html = renderToStaticMarkup(<ManagerPresentationProvider><RenewalDetail role="manager" renewal={record} onAction={() => {}} /></ManagerPresentationProvider>)
    expect(html).not.toContain('COMPLETE')
    expect(html).not.toContain('Review:')
    expect(html).not.toContain('Phiên bản:')
    expect(html).not.toContain('policy1')
    expect(html).toContain('Đã kiểm tra đầy đủ')
    const customer = renderToStaticMarkup(<RenewalDetail role="customer" renewal={record} onAction={() => {}} />)
    expect(customer).not.toContain('policy1')
    expect(customer).toContain('Đã kiểm tra đầy đủ')
  })
  it('keeps support read-only warnings but removes workflow/backfill jargon', () => {
    const html = renderToStaticMarkup(<ManagerPresentationProvider><SupportTicketSummary ticket={{ ...supportActive, workflowReady: false }} /></ManagerPresentationProvider>)
    expect(html).toContain('chưa đủ thông tin để tiếp tục xử lý')
    expect(html).not.toContain('backfill')
    expect(html).not.toContain('version 0')
  })
  it('does not expose raw server diagnostics in Manager errors', () => {
    expect(managerDisplayError(new ApiClientError('English debug message FileAsset UUID', { status: 400 }))).not.toContain('UUID')
    expect(managerDisplayError(new ApiClientError('Conflict', { status: 409 }))).toContain('Hồ sơ đã thay đổi')
  })
})
