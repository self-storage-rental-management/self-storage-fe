export const VIETNAMESE_PHONE_ERROR_MESSAGE =
  'Số điện thoại phải bắt đầu bằng 02, 03, 05, 07, 08 hoặc 09; ví dụ 0908123456 hoặc +84908123456.'

const PHONE_SEPARATOR_PATTERN = /[\s().-]/g
const VIETNAMESE_PHONE_PATTERN = /^(?:0(?:2\d{8,9}|[35789]\d{8})|\+?84(?:2\d{8,9}|[35789]\d{8}))$/

export function compactVietnamesePhone(value: string) {
  return value.trim().replace(PHONE_SEPARATOR_PATTERN, '')
}

export function isVietnamesePhone(value: string) {
  const compact = compactVietnamesePhone(value)
  return VIETNAMESE_PHONE_PATTERN.test(compact)
}

export function isOptionalVietnamesePhone(value: string | null | undefined) {
  return !value?.trim() || isVietnamesePhone(value)
}
