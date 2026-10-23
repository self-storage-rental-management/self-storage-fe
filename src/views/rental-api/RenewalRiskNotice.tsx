import { apiRequest } from "../../services/apiClient"
import { readRentalEnvelope } from "../../services/rentalApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { getAuthenticatedActor } from "../../services/authApi"
import { isUuid } from "../../services/renewalOperationsApi"
import { rentalDate, rentalMoney } from "./presentation"
import RecoveryTaskLink from "./RecoveryTaskLink"

export interface Risk {
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
export default function RenewalRiskNotice({ rentalId,renewalId,role="customer",revision,facilityId }: {
  rentalId?: string;renewalId?: string;role?: "customer"|"manager"|"staff";revision?: number | null;facilityId?: string
}) {
  const actor=getAuthenticatedActor(),id=renewalId??rentalId
  const read=useRentalApiResource(`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${id}:${revision}:renewal-risk`,async()=>{
    if(!id)throw new Error("Missing rental")
    return readRentalEnvelope<Risk>(await apiRequest(`/api/${role}/${renewalId?"renewals":"rentals"}/${encodeURIComponent(id)}/renewal-risk`),
      v=>validRenewalRisk(v)&&(renewalId?v.renewalId===id:v.rentalId===id))
  }, { retainDataOnRefresh: true })
  const r=read.data
  if(read.loading&&!r)return null
  if(r&&["REPOSSESSION_STARTED","REPOSSESSION_CLOSED"].includes(r.repossessionStatus??""))return <section role="status" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-1">
    <p className="font-semibold">{r.repossessionStatus==="REPOSSESSION_STARTED"?"Đang xử lý thu hồi kho":"Đã đóng hồ sơ thu hồi"}</p>
    <p>Vui lòng liên hệ cơ sở để được hỗ trợ về tài sản và tiền cọc.</p>
    {role !== "customer" && facilityId && r.recoveryTaskId && <RecoveryTaskLink role={role} taskId={r.recoveryTaskId} facilityId={facilityId} onChanged={read.refresh} />}
  </section>
  if(read.error||!r||r.completeness==="UNKNOWN")return null
  if(r.severity==="NONE")return null
  const deadline=r.signingDeadline&&r.repossessionDeadline&&Date.parse(r.signingDeadline)<Date.parse(r.repossessionDeadline)?r.signingDeadline:r.repossessionDeadline
  const closed=r.severity==="RENEWAL_CLOSED"
  return <section role="status" className={`rounded-lg border p-3 text-sm space-y-1 ${(r.overdueDays??0)>=8?"border-red-200 bg-red-50 text-red-900":"border-orange-200 bg-orange-50 text-orange-900"}`}>
    <p className="font-semibold">{closed?"Đã hết hạn gia hạn":`Hợp đồng quá hạn ${r.overdueDays} ngày`}</p>
    {closed?<p>Hạn gia hạn đã kết thúc lúc <strong>{rentalDate(r.repossessionDeadline)}</strong>. Vui lòng liên hệ cơ sở để được hỗ trợ.</p>:<p>Vui lòng đến cơ sở ký gia hạn trước <strong>{rentalDate(deadline)}</strong>. Đặt cọc hoặc đặt lịch chưa hoàn tất gia hạn.</p>}
    <p>Dự kiến xử lý thu hồi từ {rentalDate(r.repossessionStartsAt)}.</p>
    {r.remainingRentalAmount!==null&&<p>Tiền thuê còn lại: {rentalMoney(r.remainingRentalAmount,r.currency)}.</p>}
    {r.estimatedOverdueFee!==null&&<p>Phí quá hạn dự kiến: {rentalMoney(r.estimatedOverdueFee,r.currency)}.</p>}
  </section>
}
