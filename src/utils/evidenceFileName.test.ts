import { describe, expect, it } from 'vitest'
import { renameEvidenceFile } from './evidenceFileName'

describe('renameEvidenceFile', () => {
  it('creates a descriptive ASCII filename and keeps the original extension', () => {
    const file = new File(['evidence'], 'Ảnh bàn giao kho.JPG', { type: 'image/jpeg' })
    const renamed = renameEvidenceFile(file, 'Bằng chứng bàn giao kho lúc bàn giao', 'RSV-ABC-123')

    expect(renamed.name).toMatch(/^bang-chung-ban-giao-kho-luc-ban-giao-rsv-abc-123-\d{14}\.jpg$/)
    expect(renamed.type).toBe('image/jpeg')
    expect(renamed.size).toBe(file.size)
  })
})

