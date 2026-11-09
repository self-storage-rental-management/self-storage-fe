/** All application, demo and API monetary values are VND. Formatting never converts currency. */
export const formatVndAmount = (amountVnd: number): string => `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`
export const formatVnd = formatVndAmount
