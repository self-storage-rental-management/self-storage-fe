export function paymentMethodLabel(value?: string | null): string {
  switch (value) {
    case 'CASH':
      return 'Tiền mặt'
    case 'BANK_TRANSFER':
      return 'Chuyển khoản'
    case 'ONLINE_GATEWAY':
    case 'VNPAY':
    case 'VNPAY_SANDBOX':
      return 'Thanh toán trực tuyến'
    case 'VERIFIED_BANK':
      return 'Chuyển khoản đã xác minh'
    case 'SIMULATED':
      return 'Mô phỏng'
    default:
      return value || '-'
  }
}

export function paymentCurrencyLabel(value?: string | null): string {
  return value === 'VND' ? 'Đồng Việt Nam' : value || '-'
}
