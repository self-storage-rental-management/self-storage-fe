import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { displayText, displayProps } from './displayText'
import { userFacingError } from './userFacingError'
import { ApiClientError } from '../services/apiClient'

describe('câu hiển thị', () => {
  it('giải mã các ký tự HTML thành nội dung hiển thị đúng', () => {
    const html = renderToStaticMarkup(<p>Sách &amp; hồ sơ &gt; &quot;Gỗ&quot;</p>)
    expect(html).toContain('Sách &amp; hồ sơ &gt; &quot;Gỗ&quot;')
    expect(html).not.toContain('&amp;,')
  })

  it('chuẩn hóa câu cố định, nội dung backend, fragment và thuộc tính hỗ trợ', () => {
    const backend = 'Đã cập nhật\u003b hãy kiểm tra lại.'
    const html = renderToStaticMarkup(<div title={backend}><p>Đã lưu&#59; thông tin mới</p><span>{backend}</span><p><>{backend}</></p><input placeholder={backend} /></div>)
    expect(html).not.toContain('\u003b')
    expect(html).toContain('Đã cập nhật, hãy kiểm tra lại.')
    expect(html).toContain('Đã lưu, thông tin mới')
  })

  it('giữ nguyên giá trị nhập, đường dẫn và dữ liệu nguồn', () => {
    const original = 'Ghi chú\u003b nguyên bản'
    const props = displayProps('input', { value: original, title: original, 'data-id': original }) as Record<string, string>
    expect(props.value).toBe(original)
    expect(props['data-id']).toBe(original)
    expect(props.title).toBe('Ghi chú, nguyên bản')
    expect(original).toContain('\u003b')
    expect(displayText('Đã lưu.')).toBe('Đã lưu.')
  })

  it('loại dấu chấm phẩy trong thông báo, hộp thoại và dữ liệu đọc từ hệ thống', () => {
    const backend = 'Nội thất\u003b cần kiểm tra'
    const html = renderToStaticMarkup(<main>
      <div role="alert">{backend}</div>
      <div role="dialog" aria-label={backend}><p>{backend}</p></div>
      <input readOnly value={backend} />
      <input disabled defaultValue={backend} />
      <textarea readOnly value={backend} />
      <span aria-valuetext={backend} aria-roledescription={backend}>{backend}</span>
    </main>)
    expect(html).not.toContain('\u003b')
    expect(html).toContain('Nội thất, cần kiểm tra')
    expect(backend).toBe('Nội thất\u003b cần kiểm tra')
  })

  it('giữ nguyên mã lựa chọn và đường dẫn có dấu phân cách', () => {
    const source = 'category\u003bmaterial'
    const option = displayProps('option', { value: source, children: source }) as Record<string, string>
    const link = displayProps('a', { href: `/details/${source}`, children: source }) as Record<string, string>
    expect(option.value).toBe(source)
    expect(option.children).toBe('category, material')
    expect(link.href).toBe(`/details/${source}`)
    expect(link.children).toBe('category, material')
  })

  it('không đưa chi tiết kỹ thuật hoặc lỗi tiếng Anh lên giao diện', () => {
    const error = new ApiClientError('Request body is malformed: java.lang.IllegalArgumentException', { status: 400 })
    expect(userFacingError(error)).toBe('Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các mục đã nhập.')
    expect(error.message).toContain('java.lang')
    expect(userFacingError(new Error('Loại hàng đã ngừng áp dụng\u003b vui lòng chọn lại.'))).toBe('Loại hàng đã ngừng áp dụng, vui lòng chọn lại.')
  })
})
