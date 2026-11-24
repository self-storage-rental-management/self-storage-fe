export function paymentMethodLabel(value?: string | null, gateway = false): string {
  const method = value?.trim()
  if (!method) return 'Chưa có thông tin'
  switch (method.toUpperCase()) {
    case 'CASH':
    case 'TIEN_MAT':
    case 'TIỀN MẶT':
    case 'TIỀN MẶT TẠI CƠ SỞ':
    case 'TIỀN MẶT TẠI QUẦY':
      return 'Tiền mặt'
    case 'BANK_TRANSFER':
    case 'CHUYEN_KHOAN':
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
    case 'OFFSET':
    case 'ĐỐI TRỪ QUYẾT TOÁN':
    case 'KHẤU TRỪ CỌC':
      return 'Đối trừ quyết toán'
    case 'SIMULATED':
      return 'Thanh toán trực tuyến'
    default:
      // Never leak gateway or bank codes into customer-facing payment methods.
      return gateway ? 'Thanh toán trực tuyến' : 'Phương thức khác'
  }
}

export function formatHistoryPaymentMethod(value?: string | null): string {
  if (!value) return '-'
  const trimmed = value.trim()
  const upper = trimmed.toUpperCase()

  if (
    upper === 'CASH' ||
    upper === 'TIEN_MAT' ||
    upper === 'TIỀN MẶT' ||
    upper === 'TIỀN MẶT TẠI CƠ SỞ' ||
    upper === 'TIỀN MẶT TẠI QUẦY'
  ) {
    return 'Tiền mặt'
  }

  if (
    upper === 'BANK_TRANSFER' ||
    upper === 'CHUYEN_KHOAN' ||
    upper === 'CHUYỂN KHOẢN' ||
    upper === 'VERIFIED_BANK'
  ) {
    return 'Chuyển khoản'
  }

  if (
    upper === 'DEPOSIT_OFFSET' ||
    upper === 'OFFSET' ||
    upper === 'ĐỐI TRỪ QUYẾT TOÁN' ||
    upper === 'KHẤU TRỪ CỌC'
  ) {
    return 'Đối trừ quyết toán'
  }

  if (
    upper === 'VNPAY' ||
    upper === 'VNPAY_SANDBOX' ||
    upper === 'ONLINE_GATEWAY' ||
    upper === 'THANH TOÁN TRỰC TUYẾN' ||
    upper.startsWith('VNPAY') ||
    upper === 'NCB' ||
    upper === 'VCB' ||
    upper === 'VIETCOMBANK' ||
    upper === 'TCB' ||
    upper === 'TECHCOMBANK' ||
    upper === 'MB' ||
    upper === 'MBBANK' ||
    upper === 'BIDV' ||
    upper === 'AGRIBANK' ||
    upper === 'VPBANK' ||
    upper === 'TPBANK' ||
    upper === 'VIETINBANK' ||
    upper === 'ACB' ||
    upper === 'SACOMBANK' ||
    upper === 'HDBANK' ||
    upper === 'SHB' ||
    upper === 'OCB' ||
    upper === 'MSB' ||
    upper === 'VIB' ||
    upper === 'SCB' ||
    upper === 'SEABANK' ||
    upper === 'BACABANK' ||
    upper === 'BAOVIETBANK' ||
    upper === 'ABBANK' ||
    upper === 'LPBANK' ||
    upper === 'KIENLONGBANK' ||
    upper === 'NAMABANK' ||
    upper === 'PG BANK' ||
    upper === 'PVCOMBANK' ||
    upper === 'SAIGONBANK' ||
    upper === 'VIETBANK' ||
    upper === 'VIETCAPITALBANK' ||
    upper === 'TEST_BANK'
  ) {
    return 'VNPay'
  }

  if (upper === 'SIMULATED') {
    return 'Mô phỏng'
  }

  if (
    trimmed === 'Chưa có' ||
    trimmed === 'Chưa có thông tin' ||
    trimmed === '-' ||
    trimmed === '—' ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return '-'
  }

  return /[À-ỹ]/.test(trimmed) ? trimmed : 'Phương thức khác'
}

export function invoiceNumberLabel(number?: string | null): string {
  return number?.trim() || 'Chưa cấp'
}

export function paymentCurrencyLabel(value?: string | null): string {
  return value === 'VND' ? 'Đồng Việt Nam' : value || '-'
}
