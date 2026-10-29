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
    expect(app).not.toContain('label: "Hỗ trợ khách hàng"')
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
  it('does not expose raw server diagnostics in Manager errors', () => {
    expect(managerDisplayError(new ApiClientError('Material already exists in this goods category', { status: 409 }))).toBe('Vật liệu này đã có trong loại hàng hóa. Vui lòng nhập tên khác.')
    expect(managerDisplayError(new ApiClientError('English debug message FileAsset UUID', { status: 400 }))).not.toContain('UUID')
    expect(managerDisplayError(new ApiClientError('Conflict', { status: 409 }))).toBe('Dữ liệu đã thay đổi hoặc chưa đủ điều kiện xử lý. Vui lòng tải lại trước khi tiếp tục.')
  })
})
