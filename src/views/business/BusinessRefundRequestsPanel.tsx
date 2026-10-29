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

export default function BusinessRefundRequestsPanel() {
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
      setRows([...requested, ...escalated])
    } catch (error) {
      setFeedback(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [actor?.id, actor?.roles.join(',')])

  useEffect(() => {
    void load()
  }, [load])

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
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm" aria-label="Yêu cầu hoàn tiền chờ Business duyệt">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-amber-950">Yêu cầu hoàn tiền cần Business duyệt</h3>
          <p className="mt-1 text-sm text-amber-900">Các khoản hoàn cần phê duyệt, gồm hồ sơ vượt hạn mức Manager và hoàn cọc trước check-in. Chỉ duyệt hồ sơ có thanh toán VNPay gốc thành công.</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>{loading ? 'Đang tải…' : 'Làm mới'}</Button>
      </div>
      {feedback && <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-white p-2 text-sm text-amber-950">{feedback}</p>}
      {!loading && rows.length === 0 && <p className="mt-3 rounded-lg bg-white p-3 text-sm text-stone-600">Không có yêu cầu đang chờ duyệt.</p>}
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{formatVndAmount(row.amount)}</p>
                <p className="mt-1 text-xs text-stone-500">Yêu cầu lúc {new Date(row.createdAt).toLocaleString('vi-VN')} · Payment {row.paymentId}</p>
              </div>
              <Button size="sm" disabled={busyId !== null} onClick={() => void approve(row)}>
                {busyId === row.id ? 'Đang xử lý…' : 'Duyệt hoàn qua VNPay'}
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{row.reason}</p>
            <p className="mt-2 text-xs text-stone-500">Request {row.id} · Người tạo {row.requestedBy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
