export const USD_TO_VND_RATE = 26000

/** Backend booking API amounts are already VND. Never apply an exchange rate. */
export const formatVndAmount = (amountVnd: number): string => `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`

/** Adapter for legacy demo components whose monetary fields use USD base units. */
export const vndToLegacyBase = (amountVnd: number): number => amountVnd / USD_TO_VND_RATE

/** Hiển thị mọi giá trị nghiệp vụ theo tiền Việt; state vẫn lưu số tiền cơ sở. */
export const formatVnd = (baseAmount: number): string => {
  const vnd = Math.round(baseAmount * USD_TO_VND_RATE)
  return `${vnd.toLocaleString('vi-VN')} ₫`
}
