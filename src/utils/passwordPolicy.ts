export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const PASSWORD_POLICY_HINT = 'Mật khẩu cần từ 8 đến 128 ký tự, gồm chữ hoa, chữ thường, số, ký tự đặc biệt và không chứa khoảng trắng.'

export function getPasswordValidationError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`
  if (password.length > PASSWORD_MAX_LENGTH) return `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`
  if (/\s/.test(password)) return 'Mật khẩu không được chứa khoảng trắng.'
  if (!/[a-z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ thường.'
  if (!/[A-Z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ hoa.'
  if (!/[0-9]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ số.'
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'Mật khẩu phải có ít nhất một ký tự đặc biệt.'
  return null
}
