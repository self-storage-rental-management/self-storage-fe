import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
const statusLabel: Record<string, string> = {
  REQUESTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt, chờ hoàn',
  PROCESSING: 'Đang xử lý hoàn',
  REFUNDED: 'Đã hoàn tiền',
  REJECTED: 'Đã từ chối',
  FAILED: 'Hoàn tiền thất bại',
  refund_pending: 'Chờ hoàn tiền',
  completed: 'Đã hoàn tất',
  awaiting_customer_confirmation: 'Chờ khách xác nhận',
  awaiting_business_review: 'Chờ duyệt',
  disputed: 'Đang xem xét',
  inspected: 'Đã nghiệm thu',
  payment_due: 'Khách cần đóng thêm',
}

const formatMonthLabel = (monthStr: string) => {
  if (!monthStr) return ''
  const parts = monthStr.split('-')
  return parts.length === 2 ? `Tháng ${parts[1]}/${parts[0]}` : monthStr
}

export default function ManagerCashflowPanel({
  facilityId,
  identity,
  onReport,
}: {
  facilityId: string
  identity: string
  onReport?: (report: CashflowReport | undefined) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const read = useRentalApiResource(
    `${identity}:cashflow:${facilityId}:${range.from}:${range.to}`,
    () => getManagerCashflow(facilityId, range.from, range.to),
  )
  const report = !read.loading && !read.error ? read.data : undefined

  useEffect(() => {
    onReport?.(report)
  }, [report, onReport])

  // Sync date inputs when report loads initial date range
  useEffect(() => {
    if (report && !from && !to) {
      setFrom(report.from)
      setTo(report.to)
    }
  }, [report])

  const format = (value: number | null) => (value === null ? 'Chưa đủ dữ liệu' : formatVndAmount(value))
  const chartHeight = Math.max(340, (report?.monthly?.length || 6) * 52)

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Thu – hoàn tiền tại cơ sở</h3>
          <p className="mt-1 text-sm text-stone-500">
            Tiền thực giữ lại = tiền đã thu − tiền đã hoàn. Cọc đang giữ là khoản cần quyết toán, không phải doanh thu.
          </p>
        </div>
        <Button variant="outline" onClick={read.refresh} disabled={read.loading}>
          Làm mới số liệu
        </Button>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={event => {
          event.preventDefault()
          setRange({ from, to })
        }}
      >
        <Input
          type="date"
          label="Từ ngày"
          value={from}
          max={to || undefined}
          onChange={event => setFrom(event.target.value)}
        />
        <Input
          type="date"
          label="Đến ngày"
          value={to}
          min={from || undefined}
          onChange={event => setTo(event.target.value)}
        />
        <Button type="submit" disabled={read.loading}>
          Xem báo cáo
        </Button>
      </form>

      {read.loading ? (
        <p role="status">Đang đối soát dòng tiền…</p>
      ) : read.error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 space-y-2">
          <p className="font-medium">
            {read.error instanceof Error && read.error.message
              ? read.error.message
              : 'Chưa tải được dữ liệu tài chính. Vui lòng kiểm tra khoảng ngày và thử lại.'}
          </p>
          <Button variant="outline" size="sm" onClick={read.refresh}>
            Thử lại
          </Button>
        </div>
      ) : (
        report && (
          <>
            <p className="text-sm text-stone-600">
              Kỳ dòng tiền: <b>{report.from}</b> → <b>{report.to}</b> · Giờ Việt Nam. Trạng thái:{' '}
              <b>
                {report.completeness === 'RECORDED'
                  ? 'Đã tổng hợp giao dịch ghi nhận'
                  : 'Có hồ sơ thiếu thông tin — số liệu đã ghi nhận vẫn được hiển thị'}
              </b>
              .
            </p>

            {report.warnings.length > 0 && (
              <ul
                role="status"
                className="list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 pl-8 text-sm text-amber-950"
              >
                {report.warnings.map(w => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Tiền đã thu (Doanh thu)', report.collected, 'Giao dịch thu có trạng thái Đã thu trong kỳ'],
                ['Tiền đã hoàn', report.refunded, 'Khoản hoàn đã ghi nhận hoàn tất trong kỳ'],
                ['Tiền thực giữ lại', report.netRetained, 'Dòng tiền ròng trong kỳ, chưa trừ khoản chờ hoàn'],
                ['Tiền chờ hoàn', report.pendingRefund, 'Nghĩa vụ đang chờ chi trả hiện tại'],
                ['Cọc đảm bảo đang giữ', report.securityDepositHeld, 'Phần cọc trong khoản thu nhận kho chưa quyết toán'],
              ].map(([label, value, detail]) => (
                <div key={String(label)} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs text-stone-500">{label}</p>
                  <p className="mt-2 text-xl font-bold">{format(value as number | null)}</p>
                  <p className="mt-1 text-xs text-stone-500">{detail}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-stone-500">
              Chờ hoàn và cọc đang giữ là số dư hiện tại lúc{' '}
              {new Date(report.snapshotAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}, không cộng vào
              thu/hoàn trong kỳ. Khoản trả trước giữ chỗ nằm trong số đã thu, không cộng thêm lần nữa.
            </p>

            <section aria-label="Biểu đồ thu hoàn tiền">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-stone-900">Sơ đồ thu – hoàn tiền theo tháng</h4>
                <span className="text-xs text-stone-500">Trục dọc (Y): Tháng · Trục ngang (X): Doanh thu (VNĐ)</span>
              </div>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart
                  layout="vertical"
                  data={report.monthly}
                  margin={{ top: 10, right: 30, left: 15, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
                  <XAxis
                    type="number"
                    tickFormatter={v => `${(Number(v) / 1_000_000).toLocaleString('vi-VN')} tr`}
                    tick={{ fill: '#78716c', fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    width={110}
                    tick={{ fill: '#44403c', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(v: any, name: any) => [formatVndAmount(Number(v)), name]}
                    labelFormatter={label => formatMonthLabel(String(label))}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="collected" name="Doanh thu đã thu" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="refunded" name="Tiền đã hoàn" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="net" name="Thực giữ lại (Doanh thu ròng)" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-stone-500">
                Tiền thu theo ngày giao dịch được ghi nhận; tiền hoàn theo ngày hoàn tất, kể cả khoản thu từ tháng trước.
                Giá trị 0 nghĩa là không có giao dịch phù hợp trong kỳ.
              </p>
            </section>

            <section>
              <h4 className="mb-3 font-semibold">Chi tiết khoản hoàn và khấu trừ</h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-stone-50">
                    <tr>
                      {[
                        'Đơn / Khách',
                        'Trạng thái',
                        'Cọc đối soát',
                        'Tiền thuê được ghi có',
                        'Tổng khấu trừ',
                        'Tiền hoàn theo bảng kê',
                        'Ngày hoàn / mã giao dịch',
                      ].map(t => (
                        <th key={t} className="p-3">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.settlements.map(s => (
                      <tr key={s.id} className="border-t border-stone-100">
                        <td className="p-3">
                          <b>{s.reservationCode}</b>
                          <p>{s.customerName}</p>
                          <p className="mt-1 text-xs text-stone-500">{reasonLabel[s.reason] || s.reason}</p>
                        </td>
                        <td className="p-3">{statusLabel[s.status] || 'Đang xử lý'}</td>
                        <td className="p-3">{format(s.deposit)}</td>
                        <td className="p-3">{format(s.rentalCredit)}</td>
                        <td className="p-3">{format(s.deductions)}</td>
                        <td className="p-3 font-semibold">{format(s.refund)}</td>
                        <td className="p-3">
                          {s.payoutRecorded && s.paidAt
                            ? new Date(s.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                            : 'Chưa ghi nhận ngày hoàn'}
                          <p className="break-all text-xs text-stone-500">{s.reference || 'Chưa ghi mã giao dịch'}</p>
                        </td>
                      </tr>
                    ))}
                    {!report.settlements.length && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-stone-500">
                          Chưa có hồ sơ quyết toán hoàn tiền.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )
      )}
    </Card>
  )
}
