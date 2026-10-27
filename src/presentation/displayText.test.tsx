import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { displayText, displayProps } from './displayText'
import { userFacingError } from './userFacingError'
import { ApiClientError } from '../services/apiClient'

describe('câu hiển thị', () => {
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

  it('không đưa chi tiết kỹ thuật hoặc lỗi tiếng Anh lên giao diện', () => {
    const error = new ApiClientError('Request body is malformed: java.lang.IllegalArgumentException', { status: 400 })
    expect(userFacingError(error)).toBe('Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các mục đã nhập.')
    expect(error.message).toContain('java.lang')
    expect(userFacingError(new Error('Loại hàng đã ngừng áp dụng\u003b vui lòng chọn lại.'))).toBe('Loại hàng đã ngừng áp dụng, vui lòng chọn lại.')
  })
})
