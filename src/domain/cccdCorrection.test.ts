import { describe, expect, it } from 'vitest'
import { cccdCorrectionError } from './cccd'

describe('handover CCCD correction', () => {
  const saved = '079200123456'
  it('allows up to three serial digit changes', () => {
    expect(cccdCorrectionError(saved, '079200987456')).toBeNull()
  })
  it('blocks four serial digit changes', () => {
    expect(cccdCorrectionError(saved, '079200987656')).toContain('tối đa 3')
  })
  it.each([0, 1, 2, 3, 4, 5])('protects digit %i', index => {
    const actual = saved.split('')
    actual[index] = actual[index] === '9' ? '8' : String(Number(actual[index]) + 1)
    expect(cccdCorrectionError(saved, actual.join(''))).toContain('6 số đầu')
  })
})
