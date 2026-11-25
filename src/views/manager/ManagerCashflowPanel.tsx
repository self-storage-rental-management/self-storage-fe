import { receiptDisplayCode, internalPaymentReference } from '../../utils/recordDisplayCode'
import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Card, Input } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getManagerCashflow, type CashflowReport } from '../../services/managerCashflowApi'
import { formatVndAmount } from '../../i18n/currency'
import { vietnamDateInput } from '../../utils/vietnamTime'

const reasonLabel: Record<string, string> = {
  NORMAL: 'Trả kho thông thường',
  EARLY: 'Trả kho trước hạn',
  EARLY_RETURN: 'Trả kho trước hạn',
  RETURN_IN_SETUP: 'Trả kho trong thời gian chuẩn bị',
  CANCELLED_IN_SETUP: 'Hủy thuê trong thời gian chuẩn bị',
  INVENTORY_MISMATCH: 'Trả kho do hàng hóa sai khai báo',
}
const statusLabel: Record<string, string> = {
  REQUESTED: 'Chờ phê duyệt', PENDING_ESCALATION: 'Chờ phê duyệt', APPROVED: 'Đã duyệt, chờ chi hoàn',
  PROCESSING: 'Đang chi hoàn', REFUNDED: 'Đã hoàn tiền', REJECTED: 'Đã từ chối', FAILED: 'Hoàn tiền thất bại',
  PENDING: 'Đã duyệt, chờ chi hoàn', COMPLETED: 'Đã hoàn tiền', refund_pending: 'Đã duyệt, chờ chi hoàn', completed: 'Đã hoàn tất',
  awaiting_customer_confirmation: 'Chờ khách xác nhận', awaiting_business_review: 'Chờ phê duyệt', disputed: 'Đang xem xét',
  inspected: 'Đã nghiệm thu', payment_due: 'Khách cần đóng thêm'
}

type ChartMode = 'auto' | 'day' | 'month'
type ChartPoint = { day?: string; month?: string; collected: number; refunded: number; net: number }

function inclusiveDays(from: string, to: string) {
  const start = from.split('-').map(Number)
  const end = to.split('-').map(Number)
  if (start.length !== 3 || end.length !== 3 || start.some(Number.isNaN) || end.some(Number.isNaN)) return 0
  return Math.round((Date.UTC(end[0], end[1] - 1, end[2]) - Date.UTC(start[0], start[1] - 1, start[2])) / 86_400_000) + 1
}

function shortChartDate(value: string) {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}` : value
}

const pendingApprovalSettlementStatuses = new Set(['REQUESTED', 'PENDING_ESCALATION', 'awaiting_business_review'])
const pendingPayoutSettlementStatuses = new Set(['APPROVED', 'PROCESSING', 'PENDING', 'refund_pending'])

function settlementStatusText(status: string) {
  return pendingApprovalSettlementStatuses.has(status) ? 'Chờ duyệt' : statusLabel[status] || 'Đang xử lý'
}

function settlementTimingText(line: CashflowReport['settlements'][number]) {
  if (line.payoutRecorded && line.paidAt) {
    const paidAt = new Date(line.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    const receipt = line.receiptCode || (line.reference ? receiptDisplayCode(null, line.reference) : null)
    const transferReference = line.receiptCode && line.reference && !internalPaymentReference(line.reference) ? line.reference : null
    return [`Đã hoàn tiền lúc ${paidAt}`, receipt, transferReference].filter(Boolean).join(' · ')
  }
  if (pendingApprovalSettlementStatuses.has(line.status)) return 'Chưa có ngày hoàn tiền do yêu cầu đang chờ phê duyệt.'
  if (pendingPayoutSettlementStatuses.has(line.status)) return 'Chưa có ngày hoàn tiền do đang chờ chi hoàn.'
  return 'Chưa ghi nhận ngày hoàn tiền.'
}

export default function ManagerCashflowPanel({ facilityId, identity, onReport }: { facilityId: string; identity: string; onReport?: (report: CashflowReport | undefined) => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [chartMode, setChartMode] = useState<ChartMode>('auto')
  const [dateError, setDateError] = useState<string | null>(null)
  const [knownFirstPaymentDate, setKnownFirstPaymentDate] = useState('')
  const read = useRentalApiResource(`${identity}:cashflow:${facilityId}:${range.from}:${range.to}`, () => getManagerCashflow(facilityId, range.from, range.to))
  const report = !read.loading && !read.error ? read.data : undefined
  useEffect(() => { onReport?.(report) }, [report, onReport])
  useEffect(() => {
    if (report?.firstPaymentDate) setKnownFirstPaymentDate(report.firstPaymentDate)
  }, [report?.firstPaymentDate])
  useEffect(() => {
    if (report && !from && !to) {
      setFrom(report.from)
      setTo(report.to)
    }
  }, [report, from, to])
  const today = vietnamDateInput()
  const firstPaymentDate = report?.firstPaymentDate || knownFirstPaymentDate
  const missingDateBoundary = Boolean(report && !report.firstPaymentDate && !knownFirstPaymentDate)
  const formatDate = (value: string) => value ? value.split('-').reverse().join('/') : value
  const loadErrorMessage = read.error instanceof Error && read.error.message
    ? read.error.message
    : 'Chưa tải được dữ liệu tài chính. Vui lòng kiểm tra khoảng ngày và thử lại.'
  const automaticChartMode: Exclude<ChartMode, 'auto'> = report && inclusiveDays(report.from, report.to) <= 31 ? 'day' : 'month'
  const requestedChartMode = chartMode === 'auto' ? automaticChartMode : chartMode
  const effectiveChartMode: Exclude<ChartMode, 'auto'> = requestedChartMode === 'day' && report && !report.daily.length ? 'month' : requestedChartMode
  const chartData: ChartPoint[] = report ? effectiveChartMode === 'day' ? report.daily : report.monthly : []
  const chartDataKey = effectiveChartMode === 'day' ? 'day' : 'month'
  const chartModeLabel = effectiveChartMode === 'day' ? 'theo ngày' : 'theo tháng'
  const validateDateRange = () => {
    if (!firstPaymentDate) {
      setDateError('Cơ sở chưa có thanh toán đã ghi nhận để chọn khoảng báo cáo.')
      return false
    }
    if (!from || !to) {
      setDateError('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.')
      return false
    }
    if (from < firstPaymentDate) {
      setDateError(`Ngày bắt đầu phải từ ${formatDate(firstPaymentDate)} hoặc muộn hơn.`)
      return false
    }
    if (from > today || to > today) {
      setDateError(`Không được chọn ngày trong tương lai. Ngày hiện tại là ${formatDate(today)}.`)
      return false
    }
    if (from > to) {
      setDateError('Ngày bắt đầu không được sau ngày kết thúc.')
      return false
    }
    setDateError(null)
    return true
  }
  const format = (value: number | null) => value === null ? 'Chưa đủ dữ liệu' : formatVndAmount(value)
  return <Card className="space-y-5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">Quản lý thu và hoàn tiền</h3><p className="mt-1 text-sm text-stone-500">Báo cáo dòng tiền tại cơ sở. Dòng tiền ròng không đồng nghĩa với doanh thu vì tiền đã thu có thể bao gồm cọc bảo đảm phải hoàn lại.</p></div><Button variant="outline" onClick={read.refresh} disabled={read.loading}>Làm mới số liệu</Button></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (validateDateRange()) setRange({ from, to }) }}>
      <Input type="date" label="Từ ngày" value={from} min={firstPaymentDate || undefined} max={to && to < today ? to : today} disabled={read.loading || !firstPaymentDate} onChange={event => { setFrom(event.target.value); setDateError(null) }} />
      <Input type="date" label="Đến ngày" value={to} min={from || firstPaymentDate || undefined} max={today} disabled={read.loading || !firstPaymentDate} onChange={event => { setTo(event.target.value); setDateError(null) }} />
      <Button type="submit" disabled={read.loading || !firstPaymentDate}>Xem báo cáo</Button>
      {!firstPaymentDate && report && (missingDateBoundary ? <p role="status" className="basis-full text-xs text-amber-800">Đã tải dữ liệu thanh toán, nhưng máy chủ chưa trả ngày thanh toán đầu tiên. Vui lòng khởi động lại BE để bật chọn khoảng ngày.</p> : <p role="status" className="basis-full text-xs text-amber-800">Cơ sở chưa có thanh toán đã ghi nhận để lập báo cáo dòng tiền.</p>)}
      {dateError && <p role="alert" className="basis-full rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-800">{dateError}</p>}
    </form>
    {read.loading ? <p role="status">Đang đối soát dòng tiền…</p> : read.error ? <div role="alert"><p>{loadErrorMessage}</p><Button variant="outline" onClick={read.refresh}>Thử lại</Button></div> : report && <>
      <p className="text-sm text-stone-600">Kỳ dòng tiền: {formatDate(report.from)} → {formatDate(report.to)}.</p>
      {report.warnings.length > 0 && <ul role="status" className="list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 pl-8 text-sm text-amber-950">{report.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      <section aria-label="Tổng quan dòng tiền"><h4 className="mb-3 font-semibold">Tổng quan dòng tiền</h4><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ['Tiền đã thu', report.collected, 'Giao dịch thu có trạng thái Đã thu trong kỳ'],
        ['Tiền đã hoàn', report.refunded, 'Khoản hoàn đã ghi nhận hoàn tất trong kỳ'],
        ['Dòng tiền ròng', report.netRetained, 'Tiền đã thu − tiền đã hoàn; không phải doanh thu'],
        ['Tiền chờ chi hoàn', report.pendingRefund, 'Đã duyệt nhưng chưa ghi nhận chuyển trả'],
        ['Cọc đảm bảo đang giữ', report.securityDepositHeld, 'Cọc chưa quyết toán, không tính là doanh thu'],
      ].map(([label, value, detail]) => <div key={String(label)} className="rounded-xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 text-xl font-bold">{format(value as number | null)}</p><p className="mt-1 text-xs text-stone-500">{detail}</p></div>)}</div></section>
      <section aria-label="Biến động thu hoàn tiền"><div className="flex flex-wrap items-end justify-between gap-3"><div><h4 className="font-semibold">Biến động thu – hoàn tiền</h4><p className="mt-1 text-xs text-stone-500">Đang hiển thị {chartModeLabel}. Mặc định theo ngày khi khoảng lọc không quá 31 ngày.</p></div><label className="text-xs font-medium text-stone-600">Hiển thị<select value={chartMode} onChange={event => setChartMode(event.target.value as ChartMode)} className="ml-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-800"><option value="auto">Tự động</option><option value="day">Theo ngày</option><option value="month">Theo tháng</option></select></label></div><ResponsiveContainer width="100%" height={320}><ComposedChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={chartDataKey} tickFormatter={value => effectiveChartMode === 'day' ? shortChartDate(String(value)) : String(value)} /><YAxis tickFormatter={v => `${Number(v) / 1_000_000} tr`} /><Tooltip labelFormatter={value => effectiveChartMode === 'day' ? shortChartDate(String(value)) : String(value)} formatter={v => formatVndAmount(Number(v))} /><Legend /><Bar dataKey="collected" name="Đã thu" fill="#10b981" /><Bar dataKey="refunded" name="Đã hoàn" fill="#ef4444" /><Line type="monotone" dataKey="net" name="Dòng tiền ròng" stroke="#2563eb" strokeWidth={2} /></ComposedChart></ResponsiveContainer><p className="text-xs text-stone-500">Tiền thu theo ngày giao dịch được ghi nhận; tiền hoàn theo ngày hoàn tất, kể cả khoản thu từ tháng trước. Giá trị 0 nghĩa là không có giao dịch phù hợp trong kỳ.</p></section>
      <section aria-label="Chi tiết hoàn tiền và khấu trừ"><h4 className="mb-3 text-lg font-semibold">Chi tiết hoàn tiền và khấu trừ</h4><div className="space-y-3">{report.settlements.map(s => <article key={s.id} aria-label={`${s.reservationCode} · ${reasonLabel[s.reason] || 'Lý do khác'}`} className="rounded-xl border border-stone-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-stone-900">{s.reservationCode}</p><p className="mt-2 text-sm text-stone-700">{s.customerName}</p></div><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">{settlementStatusText(s.status)}</span></div><div className="my-4 border-t border-stone-200" /><dl className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4"><div><dt className="text-sm text-stone-500">Cọc dự kiến hoàn</dt><dd className="mt-1 text-lg font-semibold text-stone-900">{format(s.deposit)}</dd></div><div><dt className="text-sm text-stone-500">Tiền thuê dự kiến hoàn</dt><dd className="mt-1 text-lg font-semibold text-stone-900">{format(s.rentalCredit)}</dd></div><div><dt className="text-sm text-stone-500">Phí khấu trừ</dt><dd className="mt-1 text-lg font-semibold text-stone-900">{format(s.deductions)}</dd></div><div><dt className="text-sm text-stone-500">Tổng dự kiến hoàn</dt><dd className="mt-1 text-lg font-semibold text-emerald-700">{format(s.refund)}</dd></div></dl><p className="mt-4 text-sm text-stone-500">{settlementTimingText(s)}</p></article>)}{!report.settlements.length && <p className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">Chưa có hồ sơ quyết toán hoàn tiền.</p>}</div></section>
    </>}
  </Card>
}
