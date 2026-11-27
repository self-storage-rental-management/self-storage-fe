import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerPagination from './CustomerPagination'

describe('CustomerPagination', () => {
  it('renders nothing when total is 0', () => {
    const html = renderToStaticMarkup(
      <CustomerPagination
        page={1}
        pageCount={1}
        total={0}
        pageSize={5}
        onPageChange={() => {}}
      />
    )
    expect(html).toBe('')
  })

  it('renders single-item text when total is 1', () => {
    const html = renderToStaticMarkup(
      <CustomerPagination
        page={1}
        pageCount={1}
        total={1}
        pageSize={5}
        onPageChange={() => {}}
      />
    )
    expect(html).toContain('Hiển thị')
    expect(html).toContain('Trang 1/1')
    expect(html).toContain('disabled=""')
  })

  it('renders range text and page buttons for multiple pages', () => {
    const html = renderToStaticMarkup(
      <CustomerPagination
        page={2}
        pageCount={3}
        total={12}
        pageSize={5}
        onPageChange={() => {}}
      />
    )
    expect(html).toContain('6–10')
    expect(html).toContain('12')
    expect(html).toContain('← Trước')
    expect(html).toContain('Sau →')
    expect(html).toContain('>1<')
    expect(html).toContain('>2<')
    expect(html).toContain('>3<')
  })

  it('renders ellipsis when pageCount is large', () => {
    const html = renderToStaticMarkup(
      <CustomerPagination
        page={5}
        pageCount={10}
        total={50}
        pageSize={5}
        onPageChange={() => {}}
      />
    )
    expect(html).toContain('…')
    expect(html).toContain('>1<')
    expect(html).toContain('>5<')
    expect(html).toContain('>10<')
    expect(html).toContain('aria-current="page"')
  })

  it('renders page size selector when onPageSizeChange is provided', () => {
    const html = renderToStaticMarkup(
      <CustomerPagination
        page={1}
        pageCount={3}
        total={12}
        pageSize={5}
        pageSizeOptions={[5, 10, 20]}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    )
    expect(html).toContain('5 đơn/trang')
    expect(html).toContain('10 đơn/trang')
    expect(html).toContain('20 đơn/trang')
  })
})
