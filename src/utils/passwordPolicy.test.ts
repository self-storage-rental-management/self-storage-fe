import { describe, expect, it } from 'vitest'
import { getPasswordValidationError } from './passwordPolicy'

describe('password policy', () => {
  it('accepts a password that meets all requirements', () => {
    expect(getPasswordValidationError('StorageHub8!')).toBeNull()
  })

  it('rejects passwords that miss a required character class', () => {
    expect(getPasswordValidationError('storagehub8!')).toContain('chữ hoa')
    expect(getPasswordValidationError('STORAGEHUB8!')).toContain('chữ thường')
    expect(getPasswordValidationError('StorageHub!')).toContain('chữ số')
    expect(getPasswordValidationError('StorageHub8')).toContain('ký tự đặc biệt')
  })

  it('rejects whitespace and passwords outside the length range', () => {
    expect(getPasswordValidationError('Storage Hub8!')).toContain('khoảng trắng')
    expect(getPasswordValidationError('Aa1!')).toContain('ít nhất 8')
    expect(getPasswordValidationError('A'.repeat(127) + 'a1!')).toContain('128')
  })
})
