import { recordDisplayCode, receiptDisplayCode, internalPaymentReference } from '../../utils/recordDisplayCode'
import { displayStatusLabel } from '../../presentation/statusLabels'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getAuthenticatedActor } from '../../services/authApi'
import type { PaymentReceiptExport } from '../../utils/downloadPaymentReceipt'
import { getRenewalReceipt, type RenewalReceiptData } from '../../services/renewalReceiptApi'
import { formatVndAmount } from '../../i18n/currency'
import { rentalDate } from '../rental-api/presentation'
import ApiReadState from '../rental-api/ApiReadState'
import { invoiceNumberLabel, paymentCurrencyLabel, paymentMethodLabel } from './paymentLabels'
import PaymentReceiptCard from './PaymentReceiptCard'
import { EvidenceDownload } from '../rental-support-integration/EvidenceControls'

import type { RentalApiRole } from '../../types/rentalApi'

export default function RenewalReceipt({ id,paymentId,role='customer' }: { id: string; paymentId: string; role?: RentalApiRole }) {
  const actor=getAuthenticatedActor()
  const receiptRole = role === "staff" ? "manager" : role
  const read=useRentalApiResource(`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${receiptRole}:${id}:receipt:${paymentId}`,()=>getRenewalReceipt(receiptRole,id,paymentId))
  const p=read.data
  if(!p)return <ApiReadState {...read} retry={read.refresh} />
  return <div className="space-y-4">
    {p.receiptFileId
      ? <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">Biên lai gốc do nhân viên đính kèm</h3>
        <EvidenceDownload id={p.receiptFileId} previewLabel="Xem biên lai gốc" label="Tải biên lai gốc" />
      </section>
      : p.kind === 'REMAINING_RENT' && <p role="status" className="text-sm text-amber-900">Giao dịch này chưa có biên lai gốc đính kèm. Vui lòng liên hệ cơ sở để đối chiếu.</p>}
    <PaymentReceiptCard {...renewalReceiptExport(p)} />
  </div>
}

export function renewalReceiptExport(p: RenewalReceiptData): PaymentReceiptExport {
  const remaining=p.kind==='REMAINING_RENT'
  const content=p.kind==='DEPOSIT'?'Thanh toán cọc gia hạn':p.kind==='INSTALLMENT'?'Thanh toán kỳ gia hạn':remaining?'Thanh toán tiền thuê còn lại và phí quá hạn nếu có':'Thanh toán toàn kỳ gia hạn'
  const method=paymentMethodLabel(remaining ? p.paymentMethod : p.paymentMethod || 'VNPAY', !remaining)
  const gatewayTime=p.gatewayPayDate && /^\d{14}$/.test(p.gatewayPayDate)
    ? `${p.gatewayPayDate.slice(8,10)}:${p.gatewayPayDate.slice(10,12)}:${p.gatewayPayDate.slice(12,14)} ${p.gatewayPayDate.slice(6,8)}/${p.gatewayPayDate.slice(4,6)}/${p.gatewayPayDate.slice(0,4)}`
    : rentalDate(p.paidAt)
  return {
    title: remaining ? 'Phiếu ghi nhận thanh toán khi ký gia hạn' : 'Phiếu xác nhận thanh toán gia hạn',
    reference: receiptDisplayCode(p.receiptCode, p.transactionReference, p.paymentId),
    status: 'Khoản thu đã đối soát',
    fields: [
      ['Mã phiếu thu',p.receiptCode || 'Chưa cấp'], [remaining?'Mã tham chiếu thanh toán':'Mã tham chiếu VNPay',internalPaymentReference(p.transactionReference) ? '-' : p.transactionReference || '-'],
      [remaining?'Mã giao dịch thanh toán':'Mã giao dịch VNPay',p.gatewayTransactionNo || '-'],['Yêu cầu gia hạn',p.renewalLabel || recordDisplayCode(p.renewalId)],
      [remaining?'Thời điểm ghi nhận tại quầy':'Thời điểm VNPay ghi nhận',remaining ? rentalDate(p.paidAt) : gatewayTime],['Thời điểm StorageHub xử lý',rentalDate(p.processedAt)],
      ['Phương thức thanh toán',method],['Người ghi nhận',p.initiatedByName || '-'],
      ['Nội dung',content],['Số tiền',formatVndAmount(p.amount)],['Tiền tệ',paymentCurrencyLabel(p.currency)],
      ['Số hóa đơn',invoiceNumberLabel(p.invoiceNumber)],['Trạng thái hóa đơn',displayStatusLabel(p.invoiceStatus)],
      ['Ngày phát hành hóa đơn',p.invoiceIssuedAt ? rentalDate(p.invoiceIssuedAt) : '-'],
    ],
    footer: p.environment==='SANDBOX'?'Phiếu xác nhận VNPay thử nghiệm được lưu cùng yêu cầu gia hạn để đối chiếu thanh toán.':'Phiếu ghi nhận được lưu cùng yêu cầu gia hạn để đối chiếu thanh toán.',
  }
}
