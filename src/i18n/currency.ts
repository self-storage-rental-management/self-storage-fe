export const USD_TO_VND_RATE = 26000

/** Hiển thị mọi giá trị nghiệp vụ theo tiền Việt; state vẫn lưu số tiền cơ sở. */
export const formatVnd = (baseAmount: number): string => {
  const vnd = Math.round(baseAmount * USD_TO_VND_RATE)
  return `${vnd.toLocaleString('vi-VN')} ₫`
}
