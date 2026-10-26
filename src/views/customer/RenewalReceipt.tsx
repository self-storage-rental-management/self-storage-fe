import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getAuthenticatedActor } from '../../services/authApi'
import { getRenewalReceipt } from '../../services/renewalReceiptApi'
import { formatVndAmount } from '../../i18n/currency'
import { rentalDate } from '../rental-api/presentation'
import ApiReadState from '../rental-api/ApiReadState'
import { paymentCurrencyLabel, paymentMethodLabel } from './paymentLabels'
import PaymentReceiptCard from './PaymentReceiptCard'

import type { RentalApiRole } from '../../types/rentalApi'

export default function RenewalReceipt({ id,paymentId,role='customer' }: { id: string; paymentId: string; role?: RentalApiRole }) {
  const actor=getAuthenticatedActor()
  const receiptRole = role === "staff" ? "manager" : role
  const read=useRentalApiResource(`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${receiptRole}:${id}:receipt:${paymentId}`,()=>getRenewalReceipt(receiptRole,id,paymentId))
  const p=read.data
  if(!p)return <ApiReadState {...read} retry={read.refresh} />
  const remaining=p.kind==='REMAINING_RENT'
  const content=p.kind==='DEPOSIT'?'Thanh toán tiền thuê gia hạn trả trước':remaining?'Thanh toán tiền thuê còn lại và phí quá hạn nếu có':'Thanh toán toàn kỳ gia hạn'
  const method=remaining ? paymentMethodLabel(p.paymentMethod) : p.paymentMethod && p.paymentMethod !== 'VNPAY' ? `VNPay (${p.paymentMethod})` : 'VNPay'
  const gatewayTime=p.gatewayPayDate && /^\d{14}$/.test(p.gatewayPayDate)
    ? `${p.gatewayPayDate.slice(8,10)}:${p.gatewayPayDate.slice(10,12)}:${p.gatewayPayDate.slice(12,14)} ${p.gatewayPayDate.slice(6,8)}/${p.gatewayPayDate.slice(4,6)}/${p.gatewayPayDate.slice(0,4)}`
    : rentalDate(p.paidAt)
  return <PaymentReceiptCard title={p.kind==='DEPOSIT'?'Biên lai tiền thuê gia hạn trả trước':remaining?'Biên lai thanh toán khi ký gia hạn':'Biên lai tiền thuê gia hạn'} reference={p.renewalId}
    status="Khoản thu đã đối soát" fields={[
      ['Mã giao dịch StorageHub',p.paymentId], [remaining?'Mã tham chiếu thanh toán':'Mã tham chiếu VNPay',p.transactionReference || '-'],
      [remaining?'Mã phiếu thu hoặc giao dịch':'Mã giao dịch VNPay',p.gatewayTransactionNo || '-'],['Yêu cầu gia hạn',p.renewalId],
      [remaining?'Thời điểm ghi nhận tại quầy':'Thời điểm VNPay ghi nhận',remaining ? rentalDate(p.paidAt) : gatewayTime],['Thời điểm StorageHub xử lý',rentalDate(p.processedAt)],
      ['Phương thức thanh toán',method],['Người ghi nhận',p.initiatedByName || '-'],
      ['Nội dung',content],['Số tiền',formatVndAmount(p.amount)],['Tiền tệ',paymentCurrencyLabel(p.currency)],
    ]} footer={`${p.environment==='SANDBOX'?'Biên lai VNPay Sandbox được lưu cùng yêu cầu gia hạn để đối chiếu thanh toán.':'Biên lai được lưu cùng yêu cầu gia hạn để đối chiếu thanh toán.'} Biên lai xác nhận riêng khoản thu này, không xác nhận đã thanh toán đủ hoặc hoàn tất ký gia hạn.`} />
}
