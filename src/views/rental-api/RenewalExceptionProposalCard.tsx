import { Card } from "../../components/ui"
import type { RenewalExceptionProposal } from "../../types/renewalOperationsApi"
import { unknown } from "./presentation"

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value)) : unknown
}
export default function RenewalExceptionProposalCard({ proposal: p }: { proposal: RenewalExceptionProposal }) {
  return <Card className="p-4 space-y-3">
    <h4 className="font-semibold">Đề xuất đổi lịch ký gia hạn</h4>
    {p.status === "NONE" ? <p>Không có đề xuất đang chờ xác nhận.</p> : <>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt>Lịch hiện tại</dt><dd>{dateTime(p.currentAppointmentStart)} - {dateTime(p.currentAppointmentEnd)}</dd></div>
        <div><dt>Lịch được đề xuất</dt><dd>{dateTime(p.proposedAppointmentStart)} - {dateTime(p.proposedAppointmentEnd)}</dd></div>
        <div><dt>Hạn ký hiện tại</dt><dd>{dateTime(p.currentSigningDeadline)}</dd></div>
        <div><dt>Hạn ký được đề xuất</dt><dd>{dateTime(p.proposedSigningDeadline)}</dd></div>
      </dl>
      {p.validUntil && <p>Cần xác nhận trước: {dateTime(p.validUntil)}</p>}
      {!p.confirmationAllowed && <p role="status">{p.disabledReasons.includes("PROPOSAL_EXPIRED")
        ? "Đề xuất đã hết hạn."
        : p.disabledReasons.includes("NOT_RESCHEDULE_PROPOSAL") ? "Cập nhật này không yêu cầu xác nhận đổi lịch."
        : "Đề xuất chưa đủ điều kiện xác nhận. Vui lòng kiểm tra lại sau."}</p>}
    </>}
  </Card>
}
