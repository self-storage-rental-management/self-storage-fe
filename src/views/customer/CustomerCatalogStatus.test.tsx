import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerCatalogStatus, { catalogLoadError } from './CustomerCatalogStatus'
import { ApiClientError } from '../../services/apiClient'
const props = { loading: false, warehouseError: null, goodsError: null, onRetry: () => {}, onLogin: () => {} }
it('explains an expired session and provides login recovery instead of a connection error', () => {
  const html = renderToStaticMarkup(<CustomerCatalogStatus {...props} goodsError={catalogLoadError(new ApiClientError('Unauthorized', { status: 401 }))} />)
  expect(html).toContain('Phiên đăng nhập đã hết hạn')
  expect(html).toContain('Đăng nhập lại')
  expect(html).not.toContain('kiểm tra kết nối')
})
it('distinguishes warehouse failure from goods failure and provides retry', () => {
  const error = catalogLoadError(new ApiClientError('Network', { code: 'NETWORK_ERROR' }))
  const warehouse = renderToStaticMarkup(<CustomerCatalogStatus {...props} warehouseError={error} />)
  expect(warehouse).toContain('Chưa tải được cơ sở và loại kho')
  expect(warehouse).toContain('Tải lại danh mục')
  const goods = renderToStaticMarkup(<CustomerCatalogStatus {...props} goodsError={error} />)
  expect(goods).toContain('Chưa tải được danh mục hàng hóa')
  expect(goods).not.toContain('Chưa tải được cơ sở và loại kho')
  expect(goods).not.toContain(';')
})
it('clears the error region after successful recovery', () => {
  expect(renderToStaticMarkup(<CustomerCatalogStatus {...props} />)).toBe('')
})
