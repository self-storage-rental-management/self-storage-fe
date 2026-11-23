import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { listCheckIns, releaseCustomerReceiptTimeout, sendCustomerReceiptReminder, type CheckInCase } from '../../services/checkInApi'
import { managerDisplayError } from './managerPresentation'
import { formatManagerDateTime } from './managerList'

function receiptCountdown(value: string | null, now: number) {
  if (!value) return { text: 'Chưa xác định thời hạn', expired: false, urgent: true }
  const remaining = new Date(value).getTime() - now
  if (!Number.isFinite(remaining) || remaining <= 0) return { text: 'Đã quá hạn xác nhận', expired: true, urgent: true }
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  return {
    text: `Còn ${days > 0 ? `${days} ngày ` : ''}${hours > 0 ? `${hours} giờ ` : ''}${rest} phút`,
    expired: false,
    urgent: remaining <= 2 * 60 * 60_000,
  }
}

function releaseCountdown(value: string | null | undefined, now: number) {
  if (!value) return { text: 'Chưa xác định thời hạn giải phóng', eligible: false }
  const remaining = new Date(value).getTime() - now
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { text: 'Đã đủ điều kiện giải phóng kho', eligible: true }
  }
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  return {
    text: 'Có thể giải phóng sau '
      + (days > 0 ? days + ' ngày ' : '')
      + (hours > 0 ? hours + ' giờ ' : '')
      + rest + ' phút',
    eligible: false,
  }
}

export default function ManagerCheckInReminderPanel({ showToast }: { showToast: (message: string) => void }) {
  const [items, setItems] = useState<CheckInCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [now, setNow] = useState(Date.now)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<CheckInCase | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listCheckIns({ group: 'ONGOING', status: 'handover_pending_receipt', page: 0, pageSize: 100 })
      setItems(result.data.filter(item => item.checkInStatus === 'handover_pending_receipt'))
    } catch (reason) {
      setError(reason)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [reload])

  const sortedItems = useMemo(() => [...items].sort((left, right) => {
    const leftState = receiptCountdown(left.receiptConfirmationDueAt, now)
    const rightState = receiptCountdown(right.receiptConfirmationDueAt, now)
    const leftRelease = releaseCountdown(left.receiptConfirmationReleaseAt, now)
    const rightRelease = releaseCountdown(right.receiptConfirmationReleaseAt, now)
    if (leftRelease.eligible !== rightRelease.eligible) return Number(rightRelease.eligible) - Number(leftRelease.eligible)
    return Number(rightState.expired) - Number(leftState.expired)
      || Number(rightState.urgent) - Number(leftState.urgent)
      || new Date(left.receiptConfirmationDueAt || left.checkedInAt || 0).getTime()
        - new Date(right.receiptConfirmationDueAt || right.checkedInAt || 0).getTime()
  }), [items, now])

  const remind = async (item: CheckInCase) => {
    if (!item.checkInId || sendingId) return
    setSendingId(item.checkInId)
    try {
      const result = await sendCustomerReceiptReminder(item.checkInId)
      showToast(result.sent
        ? `Đã gửi nhắc khách xác nhận nhận kho cho đơn ${item.reservationCode}.`
        : `Quản lý đã nhắc đơn ${item.reservationCode} trong 2 giờ gần đây. Vui lòng thử lại sau.`)
    } catch (reason) {
      showToast(managerDisplayError(reason))
    } finally {
      setSendingId(null)
    }
  }

  const release = async () => {
    const item = releaseTarget
    if (!item?.checkInId || !releaseCountdown(item.receiptConfirmationReleaseAt, Date.now()).eligible || releasingId) return
    setReleasingId(item.checkInId)
    try {
      await releaseCustomerReceiptTimeout(item.checkInId)
      showToast('Đã giải phóng gian kho ' + item.storageUnitCode + ' sau khi khách quá hạn xác nhận.')
      setReleaseTarget(null)
      await reload()
    } catch (reason) {
      showToast(managerDisplayError(reason))
    } finally {
      setReleasingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <SectionHeader
        eyebrow="Chờ khách xác nhận"
        title="Theo dõi xác nhận nhận kho"
        subtitle="Quản lý có thể gửi lời nhắc trực tiếp khi khách hàng chưa xác nhận sau bàn giao."
      />
      <Card className="overflow-hidden">
        {loading ? <p className="p-5 text-sm text-stone-500">Đang tải hồ sơ…</p>
          : error ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-red-800"><span>Chưa tải được hồ sơ chờ xác nhận.</span><Button size="sm" variant="outline" onClick={() => void reload()}>Thử lại</Button></div>
            : !sortedItems.length ? <p className="p-5 text-sm text-stone-500">Không có hồ sơ đang chờ khách hàng xác nhận nhận kho.</p>
              : <Table>
                <Thead><Tr><Th>Đơn đặt giữ kho</Th><Th>Khách hàng</Th><Th>Gian kho</Th><Th>Thời hạn</Th><Th className="text-right">Thao tác</Th></Tr></Thead>
                <Tbody>{sortedItems.map(item => {
                  const state = receiptCountdown(item.receiptConfirmationDueAt, now)
                  const releaseState = releaseCountdown(item.receiptConfirmationReleaseAt, now)
                  return <Tr key={item.reservationId}>
                    <Td><b className="font-mono">{item.reservationCode}</b><p className="mt-1 text-xs text-stone-500">{item.facilityName}</p></Td>
                    <Td><b>{item.customerName}</b><p className="mt-1 text-xs text-stone-500">{item.customerEmail}</p></Td>
                    <Td className="font-mono">{item.storageUnitCode}</Td>
                    <Td>
                      <Badge variant={state.expired ? 'error' : state.urgent ? 'warning' : 'muted'}>{state.text}</Badge>
                      {item.receiptConfirmationDueAt && <p className={`mt-1 text-xs ${state.expired || state.urgent ? 'text-red-700' : 'text-stone-500'}`}>Hạn {formatManagerDateTime(item.receiptConfirmationDueAt)}</p>}
                      <p className={releaseState.eligible ? 'mt-1 text-xs font-semibold text-red-700' : 'mt-1 text-xs font-semibold text-amber-700'}>{releaseState.text}</p>
                    </Td>
                    <Td className="text-right"><div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={sendingId !== null || releasingId !== null} onClick={() => void remind(item)}>{sendingId === item.checkInId ? 'Đang gửi…' : 'Nhắc khách xác nhận'}</Button>
                      {releaseState.eligible && <Button size="sm" variant="danger" disabled={sendingId !== null || releasingId !== null} onClick={() => setReleaseTarget(item)}>{releasingId === item.checkInId ? 'Đang giải phóng…' : 'Giải phóng kho'}</Button>}
                    </div></Td>
                  </Tr>
                })}</Tbody>
              </Table>}
      </Card>
      <Modal
        open={Boolean(releaseTarget)}
        onClose={() => { if (!releasingId) setReleaseTarget(null) }}
        title="Giải phóng gian kho"
        size="md"
      >
        {releaseTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
              <p className="font-bold">Khách chưa xác nhận nhận kho trong 3 ngày</p>
              <p className="mt-2 leading-6">
                Xác nhận giải phóng gian <b>{releaseTarget.storageUnitCode}</b> cho đơn <b>{releaseTarget.reservationCode}</b>.
                Hồ sơ sẽ được đóng và gian kho được đưa về trạng thái sẵn sàng.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReleaseTarget(null)} disabled={Boolean(releasingId)}>Hủy</Button>
              <Button variant="danger" onClick={() => void release()} disabled={Boolean(releasingId)}>
                {releasingId ? "Đang giải phóng…" : "Xác nhận giải phóng kho"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
