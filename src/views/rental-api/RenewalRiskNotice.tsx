import { apiRequest } from "../../services/apiClient"
import { readRentalEnvelope } from "../../services/rentalApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { getAuthenticatedActor } from "../../services/authApi"
import { isUuid } from "../../services/renewalOperationsApi"
import { rentalDate, rentalMoney } from "./presentation"

interface Risk {
  rentalId: string; renewalId: string | null; checkedAt: string; completeness: "COMPLETE" | "UNKNOWN"
  overdueDays: number | null; severity: "NONE" | "WARNING" | "SERIOUS" | "URGENT" | "RENEWAL_CLOSED" | "UNKNOWN"
  signingDeadline: string | null; repossessionDeadline: string | null; repossessionStartsAt: string | null
  withinOrdinaryRenewalWindow: boolean | null; remainingRentalAmount: number | null; estimatedOverdueFee: number | null; currency: string
  repossessionStatus?: "NOT_CONFIRMED" | "REPOSSESSION_STARTED" | "REPOSSESSION_CLOSED"
  repossessionStartedAt?: string | null; recoveryTaskId?: string | null
}
export function validRenewalRisk(value: unknown): value is Risk {
  const r=value as Risk|null
  const instant=(v: unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))
  const money=(v: unknown)=>v===null||typeof v==="number"&&Number.isFinite(v)&&v>=0
  return !!r&&typeof r.rentalId==="string"&&(r.renewalId===null||typeof r.renewalId==="string")
    &&instant(r.checkedAt)&&["COMPLETE","UNKNOWN"].includes(r.completeness)
    &&["NONE","WARNING","SERIOUS","URGENT","RENEWAL_CLOSED","UNKNOWN"].includes(r.severity)
    &&(r.overdueDays===null||Number.isSafeInteger(r.overdueDays)&&r.overdueDays>=0)
    &&[r.signingDeadline,r.repossessionDeadline,r.repossessionStartsAt].every(v=>v===null||instant(v))
    &&(r.withinOrdinaryRenewalWindow===null||typeof r.withinOrdinaryRenewalWindow==="boolean")
    &&money(r.remainingRentalAmount)&&money(r.estimatedOverdueFee)&&r.currency==="VND"
    &&(r.repossessionStatus===undefined||["NOT_CONFIRMED","REPOSSESSION_STARTED","REPOSSESSION_CLOSED"].includes(r.repossessionStatus))
    &&(r.repossessionStatus===undefined||r.repossessionStatus==="NOT_CONFIRMED"
      ? r.repossessionStartedAt==null&&r.recoveryTaskId==null
      : instant(r.repossessionStartedAt)&&isUuid(r.recoveryTaskId)&&r.withinOrdinaryRenewalWindow===false)
    &&(r.completeness!=="COMPLETE"||(r.overdueDays!==null&&instant(r.repossessionDeadline)&&instant(r.repossessionStartsAt)&&typeof r.withinOrdinaryRenewalWindow==="boolean"))
}
export default function RenewalRiskNotice({ rentalId,renewalId,role="customer",revision }: {
  rentalId?: string;renewalId?: string;role?: "customer"|"manager"|"staff";revision?: number | null
}) {
  const actor=getAuthenticatedActor(),id=renewalId??rentalId
  const read=useRentalApiResource(`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${id}:${revision}:renewal-risk`,async()=>{
    if(!id)throw new Error("Missing rental")
    return readRentalEnvelope<Risk>(await apiRequest(`/api/${role}/${renewalId?"renewals":"rentals"}/${encodeURIComponent(id)}/renewal-risk`),
      v=>validRenewalRisk(v)&&(renewalId?v.renewalId===id:v.rentalId===id))
  })
  const r=read.data
  if(read.loading)return null
  if(r&&["REPOSSESSION_STARTED","REPOSSESSION_CLOSED"].includes(r.repossessionStatus??""))return <section role="status" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-1">
    <p className="font-semibold">{r.repossessionStatus==="REPOSSESSION_STARTED"?"Hồ sơ đã chuyển sang xử lý thu hồi":"Nhiệm vụ thu hồi đã đóng"}</p>
    <p>Hồ sơ được tiếp nhận thu hồi lúc {rentalDate(r.repossessionStartedAt??null)}.</p>
    <p>Gia hạn theo luồng thông thường đã bị khóa. Vui lòng liên hệ cơ sở để xử lý hợp đồng, tài sản và tiền cọc.</p>
  </section>
  if(read.error||!r||r.completeness==="UNKNOWN")return <p role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-900">Chưa xác minh được mốc quá hạn và thu hồi của hồ sơ.</p>
  if(r.severity==="NONE")return null
  return <section role="status" className={`rounded-lg border p-3 text-sm space-y-1 ${["URGENT","RENEWAL_CLOSED"].includes(r.severity)?"border-red-200 bg-red-50 text-red-900":"border-amber-200 bg-amber-50 text-amber-900"}`}>
    <p className="font-semibold">{r.severity==="RENEWAL_CLOSED"?"Đã hết hạn gia hạn theo luồng thông thường":r.severity==="URGENT"?"Hạn cuối hoàn tất gia hạn hôm nay":r.severity==="SERIOUS"?"Sắp đến hạn thu hồi kho":"Hợp đồng đã quá hạn"}</p>
    <p>Hợp đồng đã quá hạn {r.overdueDays}/7 ngày. Hạn cuối trước thu hồi: {rentalDate(r.repossessionDeadline)}. Thời điểm đủ điều kiện chuyển sang thu hồi: {rentalDate(r.repossessionStartsAt)}.</p>
    {r.signingDeadline&&<p>Hạn hoàn tất ký: {rentalDate(r.signingDeadline)}.</p>}
    <p>Thanh toán cọc hoặc đặt lịch không thay đổi hạn thu hồi. Khách hàng phải hoàn tất ký gia hạn trước hạn ký và hạn cuối trước thu hồi.</p>
    {r.remainingRentalAmount!==null&&<p>Tiền thuê còn lại theo báo giá: {rentalMoney(r.remainingRentalAmount,r.currency)}.</p>}
    {r.estimatedOverdueFee!==null&&<p>Phí quá hạn dự kiến: {rentalMoney(r.estimatedOverdueFee,r.currency)}.</p>}
  </section>
}
