import { useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient'
import { userFacingError } from '../presentation/userFacingError'
import { Button, Modal } from './ui'
import { parseVietnamDate, vietnamDateTimeInput } from '../utils/vietnamTime'

const stages = { OPEN: 'Đang chờ', WARNING: 'Sắp đến hạn', OVERDUE: 'Quá hạn' }
const owners = { CUSTOMER: 'Khách hàng', STAFF: 'Nhân viên', MANAGER: 'Quản lý', BUSINESS: 'BO', ADMIN: 'Admin' }
const dueFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
})

type WorkItem = {
  workflow: string
  resourceId: string
  facility: string
  description: string
  dueAt: string
  status: keyof typeof stages
  waitingOn: keyof typeof owners
  canResolve: boolean
}

type Metric = {
  facilityId: string
  facility: string
  owner: keyof typeof owners
  pending: number
  overdue: number
  closed: number
  onTime: number
  averageSeconds: number | null
}

const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 })
const duration = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

function WorkflowMetrics() {
  const [data, setData] = useState<Metric[]>()
  const [error, setError] = useState('')
  const [request, setRequest] = useState(0)
  useEffect(() => {
    let current = true
    setData(undefined)
    setError('')
    void apiRequest<{ data: Metric[] }>('/api/workflow-sla/metrics')
      .then((result) => { if (current) setData(result.data) })
      .catch((reason) => { if (current) setError(userFacingError(reason, 'Không tải được KPI xử lý.')) })
    return () => { current = false }
  }, [request])
  return (
    <section aria-label="KPI theo cơ sở và vai trò" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-stone-600">Công việc đang chờ và các công việc đã rời hàng chờ trong 30 ngày gần nhất.</p>
        <Button size="sm" variant="outline" onClick={() => setRequest(value => value + 1)}>Tải lại</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="min-w-[43rem] w-full text-left">
          <thead className="border-b border-stone-200 text-xs text-stone-600">
            <tr>
              <th className="p-3">Cơ sở</th><th className="p-3">Vai trò</th>
              {['Đang chờ', 'Quá hạn', 'Đã rời hàng chờ', 'Trong hạn', 'Thời gian chờ TB'].map(label => <th className="p-3 text-right" key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {error || !data?.length ? <tr><td className="p-4" colSpan={7} role={error ? 'alert' : 'status'}>
              {error || (data ? 'Chưa có dữ liệu KPI.' : 'Đang tải KPI…')}
            </td></tr> : data.map(row => (
              <tr key={`${row.facilityId}:${row.owner}`}>
                <td className="p-3 font-medium">{row.facility}</td>
                <td className="p-3">{owners[row.owner]}</td>
                <td className="p-3 text-right tabular-nums">{row.pending}</td>
                <td className={`p-3 text-right tabular-nums ${row.overdue ? 'font-medium text-red-800' : ''}`}>{row.overdue}</td>
                <td className="p-3 text-right tabular-nums">{row.closed}</td>
                <td className="p-3 text-right tabular-nums">{row.closed ? percent.format(row.onTime / row.closed) : '—'}</td>
                <td className="whitespace-nowrap p-3 text-right tabular-nums">{row.averageSeconds == null ? '—' : `${duration.format(row.averageSeconds / 3600)} giờ`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function WorkflowSlaPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'work' | 'metrics'>('work')
  const [rows, setRows] = useState<WorkItem[]>([])
  const [status, setStatus] = useState('all')
  const [party, setParty] = useState('all')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [readError, setReadError] = useState('')
  const [editing, setEditing] = useState<WorkItem>()
  const [note, setNote] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const extending = editing?.workflow === 'INVENTORY_CHECK' || editing?.workflow === 'INVENTORY_REMOVAL'

  useEffect(() => {
    let active = true
    setLoading(true)
    setReadError('')
    void apiRequest<{ data: WorkItem[] }>('/api/workflow-sla')
      .then(({ data }) => { if (active) setRows(data) })
      .catch((error) => { if (active) setReadError(userFacingError(error, 'Không tải được danh sách hạn xử lý.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refresh])

  const visible = rows.filter((row) =>
    (status === 'all' || row.status === status)
    && (party === 'all' || (party === 'operations' ? row.waitingOn !== 'CUSTOMER' : row.waitingOn === party)),
  )

  async function saveResolution() {
    if (!editing || saving || !note.trim() || (extending && !newDeadline)) return
    setSaving(true)
    setSaveError('')
    try {
      const endpoint = extending
        ? `/api/workflow-sla/inventory/${editing.resourceId}/extend`
        : `/api/workflow-sla/check-in-rejections/${editing.resourceId}/resolve`
      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(extending ? {
          workflow: editing.workflow,
          previousDueAt: editing.dueAt,
          dueAt: parseVietnamDate(newDeadline).toISOString(),
          note: note.trim(),
        } : { note: note.trim() }),
      })
      setEditing(undefined)
      setNote('')
      setRefresh((value) => value + 1)
    } catch (error) {
      setSaveError(userFacingError(error, extending ? 'Chưa gia hạn được hồ sơ.' : 'Chưa lưu được kết quả xử lý.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Hạn xử lý nghiệp vụ" size="3xl" onClose={() => { if (!saving) onClose() }} closeLabel="Đóng">
      <div className="space-y-4 text-sm text-stone-900" data-ui="workflow-sla">
        <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
          <Button size="sm" variant={tab === 'work' ? 'secondary' : 'outline'} aria-pressed={tab === 'work'} disabled={saving} onClick={() => setTab('work')}>Công việc</Button>
          <Button size="sm" variant={tab === 'metrics' ? 'secondary' : 'outline'} aria-pressed={tab === 'metrics'} disabled={saving} onClick={() => setTab('metrics')}>KPI xử lý</Button>
        </div>
        {tab === 'metrics' ? <WorkflowMetrics /> : <>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            Trạng thái
            <select className="rounded-md border border-stone-300 bg-white px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Tất cả</option>
              {Object.entries(stages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            Đang chờ
            <select className="rounded-md border border-stone-300 bg-white px-3 py-2" value={party} onChange={(event) => setParty(event.target.value)}>
              <option value="all">Tất cả vai trò</option>
              <option value="operations">Nội bộ</option>
              {Object.entries(owners).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <Button variant="outline" disabled={loading || saving} onClick={() => setRefresh((value) => value + 1)}>Tải lại</Button>
        </div>
        {editing && (
          <form className="space-y-2 rounded-lg border border-stone-200 p-3" onSubmit={(event) => {
            event.preventDefault()
            void saveResolution()
          }}>
            {extending && <label className="grid gap-1 font-medium">
              Hạn mới theo giờ Việt Nam
              <input required type="datetime-local" className="rounded-md border border-stone-300 px-3 py-2"
                min={vietnamDateTimeInput(Math.max(Date.now(), Date.parse(editing.dueAt)) + 60_000)}
                value={newDeadline} onChange={event => setNewDeadline(event.target.value)} disabled={saving} />
            </label>}
            <label className="grid gap-1 font-medium">
              {extending ? 'Lý do chậm do cơ sở' : `Kết quả xử lý ${editing.description}`}
              <textarea autoFocus maxLength={1000} rows={3} className="rounded-md border border-stone-300 px-3 py-2 font-normal"
                value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} />
            </label>
            {saveError && <p role="alert" className="text-red-800">{saveError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || !note.trim() || (extending && !newDeadline)}>{extending ? 'Lưu gia hạn' : 'Lưu kết quả'}</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(undefined)}>Hủy</Button>
            </div>
          </form>
        )}
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full min-w-[38rem] text-left">
            <caption className="sr-only">Công việc theo hạn xử lý, giờ Việt Nam</caption>
            <thead className="border-b border-stone-200 text-xs text-stone-600">
              <tr><th className="p-3">Công việc</th><th className="p-3">Đang chờ</th><th className="p-3">Hạn xử lý</th><th className="p-3">Trạng thái</th><th className="p-3"><span className="sr-only">Thao tác</span></th></tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading || readError || !visible.length ? (
                <tr><td colSpan={5} className="p-4" role={readError ? 'alert' : 'status'}>
                  {loading ? 'Đang tải hạn xử lý…' : readError || 'Không có công việc phù hợp.'}
                </td></tr>
              ) : visible.map((row) => (
                <tr key={`${row.workflow}:${row.resourceId}`}>
                  <td className="p-3"><p className="font-medium">{row.description}</p><p className="text-xs text-stone-600">{row.facility}</p></td>
                  <td className="whitespace-nowrap p-3">{owners[row.waitingOn]}</td>
                  <td className="whitespace-nowrap p-3 tabular-nums">{dueFormat.format(new Date(row.dueAt))}</td>
                  <td className={`whitespace-nowrap p-3 ${row.status === 'OVERDUE' ? 'font-medium text-red-800' : row.status === 'WARNING' ? 'font-medium text-amber-800' : 'text-stone-600'}`}>{stages[row.status]}</td>
                  <td className="p-3">{row.canResolve && <Button size="sm" variant="outline" disabled={saving} onClick={() => {
                    setEditing(row)
                    setNote('')
                    setNewDeadline('')
                    setSaveError('')
                  }}>{row.workflow === 'CHECKIN_REJECTION' ? 'Ghi kết quả' : 'Gia hạn do cơ sở'}</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>}
      </div>
    </Modal>
  )
}
