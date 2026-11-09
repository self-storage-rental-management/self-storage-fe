import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EvidenceUpload } from './EvidenceControls'

describe('uploaded evidence preview controls', () => {
  it('offers an in-page preview for each saved attachment without navigation links', () => {
    const html = renderToStaticMarkup(<EvidenceUpload entityType="DUONG_RENEWAL_CASH_RECEIPT"
      value={['file-one', 'file-two']} onChange={() => {}} />)
    expect(html.match(/Xem trước/g)).toHaveLength(2)
    expect(html).toContain('Bỏ tệp 1')
    expect(html).toContain('Bỏ tệp 2')
    expect(html).not.toContain('href=')
  })
  it('also supports compact attachment previews', () => {
    const html = renderToStaticMarkup(<EvidenceUpload entityType="DUONG_SUPPORT_PUBLIC"
      value={['file-one']} onChange={() => {}} compact iconOnly />)
    expect(html).toContain('Xem trước')
    expect(html).not.toContain('href=')
  })
})
