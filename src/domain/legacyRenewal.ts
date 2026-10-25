import { formatVnd } from '../i18n/currency'

export const LEGACY_RENEWAL_NOTICE = 'Số tiền trong hồ sơ cũ chỉ là thông tin đã lưu. Vui lòng đăng nhập và mở Hồ sơ thuê để lấy báo giá, đối soát công nợ và thanh toán gia hạn.'

/** Display a historical legacy amount; missing data is never inferred or treated as zero. */
export function legacyRenewalMoney(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? formatVnd(value)
    : 'Chưa có số tiền được xác minh'
}

/** Local records cannot authorize financial commands or replace a backend quote/statement. */
export function legacyRenewalUnavailable(): never {
  throw new Error(LEGACY_RENEWAL_NOTICE)
}
