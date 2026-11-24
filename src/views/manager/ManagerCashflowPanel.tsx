import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Card, Input } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getManagerCashflow, type CashflowReport } from '../../services/managerCashflowApi'
import { formatVndAmount } from '../../i18n/currency'

const reasonLabel: Record<string, string> = {
  NORMAL: 'Trả kho thông thường',
  EARLY: 'Trả kho trước hạn',
  EARLY_RETURN: 'Trả kho trước hạn',
  RETURN_IN_SETUP: 'Trả kho trong thời gian chuẩn bị',
  CANCELLED_IN_SETUP: 'Hủy thuê trong thời gian chuẩn bị',
  INVENTORY_MISMATCH: 'Trả kho do hàng hóa sai khai báo',
}
const statusLabel: Record<string, string> = { REQUESTED: 'Chờ duyệt', APPROVED: 'Đã duyệt, chờ hoàn', PROCESSING: 'Đang xử lý hoàn', REFUNDED: 'Đã hoàn tiền', REJECTED: 'Đã từ chối', FAILED: 'Hoàn tiền thất bại', refund_pending: 'Chờ hoàn tiền', completed: 'Đã hoàn tất', awaiting_customer_confirmation: 'Chờ khách xác nhận', awaiting_business_review: 'Chờ duyệt', disputed: 'Đang xem xét', inspected: 'Đã nghiệm thu', payment_due: 'Khách cần đóng thêm' }

export default function ManagerCashflowPanel({ facilityId, identity, onReport }: { facilityId: string; identity: string; onReport?: (report: CashflowReport | undefined) => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const read = useRentalApiResource(`${identity}:cashflow:${facilityId}:${range.from}:${range.to}`, () => getManagerCashflow(facilityId, range.from, range.to))
  const report = !read.loading && !read.error ? read.data : undefined
  useEffect(() => { onReport?.(report) }, [report, onReport])
  const format = (value: number | null) => value === null ? 'Chưa đủ dữ liệu' : formatVndAmount(value)
  return <Card className="space-y-5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">Thu – hoàn tiền tại cơ sở</h3><p className="mt-1 text-sm text-stone-500">Tiền thực giữ lại = tiền đã thu − tiền đã hoàn. Cọc đang giữ là khoản cần quyết toán, không phải doanh thu.</p></div><Button variant="outline" onClick={read.refresh} disabled={read.loading}>Làm mới số liệu</Button></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setRange({ from, to }) }}>
      <Input type="date" label="Từ ngày" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} />
      <Input type="date" label="Đến ngày" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} />
      <Button type="submit" disabled={read.loading}>Xem báo cáo</Button>
    </form>
    {read.loading ? <p role="status">Đang đối soát dòng tiền…</p> : read.error ? <div role="alert"><p>Chưa tải được dữ liệu tài chính. Vui lòng kiểm tra khoảng ngày và thử lại.</p><Button variant="outline" onClick={read.refresh}>Thử lại</Button></div> : report && <>
      <p className="text-sm text-stone-600">Kỳ dòng tiền: {report.from} → {report.to} · Giờ Việt Nam. Trạng thái: <b>{report.completeness === 'RECORDED' ? 'Đã tổng hợp giao dịch ghi nhận' : 'Có hồ sơ thiếu thông tin - số liệu đã ghi nhận vẫn được hiển thị'}</b>.</p>
      {report.warnings.length > 0 && <ul role="status" className="list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 pl-8 text-sm text-amber-950">{report.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ['Tiền đã thu', report.collected, 'Giao dịch thu có trạng thái Đã thu trong kỳ'],
        ['Tiền đã hoàn', report.refunded, 'Khoản hoàn đã ghi nhận hoàn tất trong kỳ'],
        ['Tiền thực giữ lại', report.netRetained, 'Dòng tiền ròng trong kỳ, chưa trừ khoản chờ hoàn'],
        ['Tiền chờ hoàn', report.pendingRefund, 'Nghĩa vụ đang chờ chi trả hiện tại'],
        ['Cọc đảm bảo đang giữ', report.securityDepositHeld, 'Phần cọc trong khoản thu nhận kho chưa quyết toán'],
      ].map(([label, value, detail]) => <div key={String(label)} className="rounded-xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 text-xl font-bold">{format(value as number | null)}</p><p className="mt-1 text-xs text-stone-500">{detail}</p></div>)}</div>
      <p className="text-xs text-stone-500">Chờ hoàn và cọc đang giữ là số dư hiện tại lúc {new Date(report.snapshotAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}, không cộng vào thu/hoàn trong kỳ. Khoản trả trước giữ chỗ nằm trong số đã thu, không cộng thêm lần nữa.</p>
      <section aria-label="Biểu đồ thu hoàn tiền"><h4 className="mb-3 font-semibold">Dòng tiền theo tháng</h4><ResponsiveContainer width="100%" height={320}><ComposedChart data={report.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis tickFormatter={v => `${Number(v) / 1_000_000} tr`} /><Tooltip formatter={v => formatVndAmount(Number(v))} /><Legend /><Bar dataKey="collected" name="Đã thu" fill="#10b981" /><Bar dataKey="refunded" name="Đã hoàn" fill="#ef4444" /><Line type="monotone" dataKey="net" name="Thực giữ lại trong kỳ" stroke="#2563eb" strokeWidth={2} /></ComposedChart></ResponsiveContainer><p className="text-xs text-stone-500">Tiền thu theo ngày giao dịch được ghi nhận; tiền hoàn theo ngày hoàn tất, kể cả khoản thu từ tháng trước. Giá trị 0 nghĩa là không có giao dịch phù hợp trong kỳ.</p></section>
      <section><h4 className="mb-3 font-semibold">Chi tiết khoản hoàn và khấu trừ</h4><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-stone-50"><tr>{['Đơn / Khách', 'Trạng thái', 'Cọc đối soát', 'Tiền thuê được ghi có', 'Tổng khấu trừ', 'Tiền hoàn theo bảng kê', 'Ngày hoàn / mã giao dịch'].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{report.settlements.map(s => <tr key={s.id} className="border-t border-stone-100"><td className="p-3"><b>{s.reservationCode}</b><p>{s.customerName}</p><p className="mt-1 text-xs text-stone-500">{reasonLabel[s.reason] || s.reason}</p></td><td className="p-3">{statusLabel[s.status] || 'Đang xử lý'}</td><td className="p-3">{format(s.deposit)}</td><td className="p-3">{format(s.rentalCredit)}</td><td className="p-3">{format(s.deductions)}</td><td className="p-3 font-semibold">{format(s.refund)}</td><td className="p-3">{s.payoutRecorded && s.paidAt ? new Date(s.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận ngày hoàn'}<p className="break-all text-xs text-stone-500">{s.reference || 'Chưa ghi mã giao dịch'}</p></td></tr>)}{!report.settlements.length && <tr><td colSpan={7} className="p-6 text-center text-stone-500">Chưa có hồ sơ quyết toán hoàn tiền.</td></tr>}</tbody></table></div></section>
    </>}
  </Card>
}
