export function paymentMethodLabel(value?: string | null, gateway = false): string {
  const method = value?.trim()
  if (!method) return 'Chưa có thông tin'
  switch (method.toUpperCase()) {
    case 'CASH':
    case 'TIỀN MẶT':
    case 'TIỀN MẶT TẠI CƠ SỞ':
      return 'Tiền mặt'
    case 'BANK_TRANSFER':
    case 'CHUYỂN KHOẢN':
    case 'CHUYỂN KHOẢN VIETQR':
    case 'VERIFIED_BANK':
    case 'CHUYỂN KHOẢN ĐÃ XÁC MINH':
      return 'Chuyển khoản'
    case 'ONLINE_GATEWAY':
    case 'VNPAY':
    case 'VNPAY_SANDBOX':
    case 'NCB':
    case 'THANH TOÁN TRỰC TUYẾN':
      return 'Thanh toán trực tuyến'
    case 'DEPOSIT_OFFSET':
    case 'ĐỐI TRỪ QUYẾT TOÁN':
      return 'Đối trừ quyết toán'
    case 'SIMULATED':
      return 'Thanh toán trực tuyến'
    default:
      // Never leak gateway or bank codes into customer-facing payment methods.
      return gateway ? 'Thanh toán trực tuyến' : 'Phương thức khác'
  }
}

export function paymentCurrencyLabel(value?: string | null): string {
  return value === 'VND' ? 'Đồng Việt Nam' : value || '-'
}
