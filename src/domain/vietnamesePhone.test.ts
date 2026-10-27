import { describe, expect, it } from 'vitest'
import { isOptionalVietnamesePhone, isVietnamesePhone } from './vietnamesePhone'

describe('Vietnamese phone validation', () => {
  it('accepts Vietnamese mobile and landline prefixes with common separators', () => {
    expect(isVietnamesePhone('0908 123 456')).toBe(true)
    expect(isVietnamesePhone('+84 908 123 456')).toBe(true)
    expect(isVietnamesePhone('028 3999 1111')).toBe(true)
  })

  it('rejects unsupported prefixes and invalid lengths', () => {
    expect(isVietnamesePhone('0108 123 456')).toBe(false)
    expect(isVietnamesePhone('0908 123')).toBe(false)
    expect(isVietnamesePhone('123456789')).toBe(false)
  })

  it('allows optional profile phone fields to remain blank', () => {
    expect(isOptionalVietnamesePhone('')).toBe(true)
    expect(isOptionalVietnamesePhone(null)).toBe(true)
    expect(isOptionalVietnamesePhone('0111 123 456')).toBe(false)
  })
})
