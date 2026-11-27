import { recordDisplayCode } from '../../utils/recordDisplayCode'
import { compareWorkQueue } from '../../utils/workQueueSort'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { ApiClientError } from '../../services/apiClient'
import { approveRefundRequest, listRefundRequests, type RefundRequestView } from '../../services/refundRequestApi'
import { formatVndAmount } from '../../i18n/currency'

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message
  return error instanceof Error ? error.message : 'Không thể tải hàng đợi hoàn tiền.'
}

export default function BusinessRefundRequestsPanel({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const actor = getAuthenticatedActor()
  const [rows, setRows] = useState<RefundRequestView[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    if (!actor || (!actor.roles.includes('BUSINESS') && !actor.roles.includes('ADMIN'))) return
    setLoading(true)
    setFeedback('')
    try {
      const [requested, escalated] = await Promise.all([
        listRefundRequests('REQUESTED'),
        listRefundRequests('PENDING_ESCALATION'),
      ])
      setRows([...new Map([...requested, ...escalated].map(row => [row.id, row])).values()].sort((a, b) =>
        compareWorkQueue({ id: a.id, urgent: a.status === 'PENDING_ESCALATION', waitingSince: a.createdAt },
          { id: b.id, urgent: b.status === 'PENDING_ESCALATION', waitingSince: b.createdAt })))
    } catch (error) {
      setFeedback(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [actor?.id, actor?.roles.join(',')])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (refreshVersion > 0) void load()
  }, [refreshVersion, load])

  if (!actor || (!actor.roles.includes('BUSINESS') && !actor.roles.includes('ADMIN'))) return null

  async function approve(row: RefundRequestView) {
    setBusyId(row.id)
    setFeedback('')
    try {
      await approveRefundRequest(row.id)
      setFeedback(`Đã gửi hoàn tiền ${formatVndAmount(row.amount)} qua kênh thanh toán gốc.`)
      await load()
    } catch (error) {
      setFeedback(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3" aria-label="Yêu cầu hoàn tiền chờ Ban điều hành duyệt">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-950">Yêu cầu hoàn tiền cần Ban điều hành duyệt</h3>
            <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-stone-600" aria-label={`${rows.length} yêu cầu`}>{rows.length}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-900">Chỉ duyệt hoàn tiền qua VNPay khi giao dịch gốc đã thành công. Các yêu cầu khiếu nại hoặc vượt hạn mức sẽ được chuyển đến đây.</p>
        </div>
      </div>
      {feedback && <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-white p-2 text-sm text-amber-950">{feedback}</p>}
      {loading && rows.length === 0 && <p className="mt-2 text-xs text-amber-900">Đang tải danh sách yêu cầu…</p>}
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{formatVndAmount(row.amount)}</p>
                <p className="mt-1 text-xs text-stone-500">Yêu cầu lúc {new Date(row.createdAt).toLocaleString('vi-VN')} · {row.paymentId ? `Giao dịch ${row.paymentReceiptCode || recordDisplayCode(row.paymentId)}` : 'Chưa có giao dịch'}</p>
              </div>
              <Button size="sm" disabled={busyId !== null} onClick={() => void approve(row)}>
                {busyId === row.id ? 'Đang xử lý…' : 'Duyệt hoàn qua VNPay'}
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{row.reason}</p>
            <p className="mt-2 text-xs text-stone-500">Yêu cầu {row.displayCode || recordDisplayCode(row.id)} · Người tạo {row.requestedByName || (row.requestedBy ? 'Nhân viên' : 'Hệ thống')}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
