import { useEffect, useMemo, useState } from 'react'
import {
  completeCheckIn,
  listCheckIns,
  markCheckInNoShow,
  scheduleCheckIn,
  uploadCheckInEvidence,
  type CheckInCase,
  type CheckInChecklist,
} from '../../services/checkInApi'
import { Badge, Button, Card, Input, Modal, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'

const checklistLabels: Array<[keyof CheckInChecklist, string]> = [
  ['identityVerified', 'Đã đối chiếu giấy tờ tùy thân'],
  ['reservationMatched', 'Reservation, cơ sở và gian kho trùng khớp'],
  ['contractVerified', 'Hợp đồng đã được ký và kiểm tra'],
  ['paymentVerified', 'Các khoản cần thu trước bàn giao đã được xác nhận'],
  ['measurementVerified', 'Đã đo và đối chiếu hàng hóa thực tế'],
  ['unitWalkthrough', 'Đã kiểm tra trực tiếp gian kho với khách'],
  ['conditionRecorded', 'Đã ghi nhận hiện trạng ban đầu'],
  ['accessHandedOver', 'Đã bàn giao quyền truy cập/PIN/chìa khóa'],
]

const emptyChecklist = () => Object.fromEntries(
  checklistLabels.map(([key]) => [key, false]),
) as unknown as CheckInChecklist

function localDateTimeInput(date = new Date(Date.now() + 24 * 60 * 60 * 1000)) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Chưa lên lịch'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export default function StaffCheckInOperationsPanel({ showToast }: { showToast: (message: string) => void }) {
  const [items, setItems] = useState<CheckInCase[]>([])
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [scheduleTarget, setScheduleTarget] = useState<CheckInCase | null>(null)
  const [scheduleAt, setScheduleAt] = useState(localDateTimeInput())
  const [contractVerified, setContractVerified] = useState(false)
  const [paymentVerified, setPaymentVerified] = useState(false)
  const [scheduleNote, setScheduleNote] = useState('Hồ sơ đã đủ điều kiện nhận kho')
  const [handoverTarget, setHandoverTarget] = useState<CheckInCase | null>(null)
  const [checklist, setChecklist] = useState<CheckInChecklist>(emptyChecklist)
  const [lengthCm, setLengthCm] = useState('100')
  const [widthCm, setWidthCm] = useState('100')
  const [heightCm, setHeightCm] = useState('100')
  const [weightKg, setWeightKg] = useState('1')
  const [volumeM3, setVolumeM3] = useState('1')
  const [initialCondition, setInitialCondition] = useState('Gian kho sạch, khóa và đèn hoạt động bình thường')
  const [goodsCondition, setGoodsCondition] = useState('Hàng hóa nguyên vẹn khi tiếp nhận')
  const [packageCount, setPackageCount] = useState('1')
  const [goodsCategory, setGoodsCategory] = useState('Hàng hóa đã khai báo')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [evidenceReferences, setEvidenceReferences] = useState<string[]>([])
  const [handedOverItems, setHandedOverItems] = useState('PIN truy cập, Biên nhận bàn giao')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [noShowTarget, setNoShowTarget] = useState<CheckInCase | null>(null)
  const [noShowReason, setNoShowReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void listCheckIns({ page, pageSize: 20, q: query })
      .then(response => {
        if (!active) return
        setItems(response.data)
        setTotalItems(response.pagination.totalItems)
        setTotalPages(response.pagination.totalPages)
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách nhận kho.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, query, refreshKey])

  const allChecksComplete = useMemo(
    () => checklistLabels.every(([key]) => checklist[key]),
    [checklist],
  )

  const refresh = () => setRefreshKey(value => value + 1)
  const fail = (reason: unknown, fallback: string) => setError(reason instanceof Error ? reason.message : fallback)

  const submitSchedule = async () => {
    if (!scheduleTarget || !scheduleAt || !contractVerified || !paymentVerified) return
    setSubmitting(true)
    try {
      await scheduleCheckIn(scheduleTarget.reservationId, {
        scheduledAt: new Date(scheduleAt).toISOString(),
        contractVerified,
        paymentVerified,
        note: scheduleNote.trim(),
      })
      showToast(`Đã lên lịch nhận kho cho ${scheduleTarget.reservationCode}.`)
      setScheduleTarget(null)
      refresh()
    } catch (reason) {
      fail(reason, 'Không thể lên lịch check-in.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitHandover = async () => {
    if (!handoverTarget?.checkInId || !allChecksComplete) return
    setSubmitting(true)
    try {
      const uploadedEvidence = [...evidenceReferences]
      for (const file of evidenceFiles) {
        const asset = await uploadCheckInEvidence(handoverTarget.checkInId, file)
        uploadedEvidence.push(asset.id)
      }
      if (evidenceFiles.length) {
        setEvidenceReferences(uploadedEvidence)
        setEvidenceFiles([])
      }
      await completeCheckIn(handoverTarget.checkInId, {
        checklist,
        actualMeasurements: {
          lengthCm: Number(lengthCm),
          widthCm: Number(widthCm),
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          actualVolumeM3: Number(volumeM3),
          varianceAccepted: true,
        },
        initialUnitCondition: initialCondition.trim(),
        goodsCondition: goodsCondition.trim(),
        packageCount: Number(packageCount),
        goodsCategory: goodsCategory.trim(),
        evidenceReferences: uploadedEvidence,
        handedOverItems: handedOverItems.split(',').map(value => value.trim()).filter(Boolean),
        notes: handoverNotes.trim(),
      })
      showToast(`Đã hoàn tất bàn giao ${handoverTarget.storageUnitCode}; đang chờ khách xác nhận nhận kho.`)
      setHandoverTarget(null)
      refresh()
    } catch (reason) {
      fail(reason, 'Không thể hoàn tất bàn giao.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitNoShow = async () => {
    if (!noShowTarget?.checkInId || !noShowReason.trim()) return
    setSubmitting(true)
    try {
      await markCheckInNoShow(noShowTarget.checkInId, noShowReason.trim())
      showToast(`Đã đánh dấu khách không đến cho ${noShowTarget.reservationCode}.`)
      setNoShowTarget(null)
      refresh()
    } catch (reason) {
      fail(reason, 'Không thể đánh dấu no-show.')
    } finally {
      setSubmitting(false)
    }
  }

  const openSchedule = (item: CheckInCase) => {
    setScheduleTarget(item)
    setScheduleAt(item.scheduledAt ? localDateTimeInput(new Date(item.scheduledAt)) : localDateTimeInput())
    setContractVerified(false)
    setPaymentVerified(false)
    setScheduleNote('Hồ sơ đã đủ điều kiện nhận kho')
  }

  const openHandover = (item: CheckInCase) => {
    setHandoverTarget(item)
    setChecklist(emptyChecklist())
    setEvidenceFiles([])
    setEvidenceReferences([])
  }

  return <div className="fade-in space-y-5">
    <SectionHeader title="Nhận kho & bàn giao" subtitle="Lên lịch, đối chiếu hàng hóa và hoàn tất bàn giao vật lý cho khách hàng." />
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input value={queryInput} placeholder="Mã reservation, khách hàng, email hoặc mã kho" onChange={event => setQueryInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setPage(0); setQuery(queryInput.trim()) } }} />
        <Button onClick={() => { setPage(0); setQuery(queryInput.trim()) }}>Tìm kiếm</Button>
        <Button variant="outline" onClick={refresh}>Tải lại</Button>
      </div>
    </Card>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <Card>
      <Table><Thead><Tr><Th>Reservation</Th><Th>Khách hàng</Th><Th>Gian kho</Th><Th>Lịch nhận</Th><Th>Trạng thái</Th><Th className="text-right">Thao tác</Th></Tr></Thead>
        <Tbody>
          {items.map(item => <Tr key={item.reservationId}>
            <Td><b className="font-mono">{item.reservationCode}</b><p className="mt-1 text-xs text-stone-500">{item.facilityName}</p></Td>
            <Td><b>{item.customerName}</b><p className="mt-1 text-xs text-stone-500">{item.customerEmail}</p></Td>
            <Td><b className="font-mono">{item.storageUnitCode}</b><p className="mt-1 text-xs text-stone-500">{item.storageUnitStatus}</p></Td>
            <Td>{formatDateTime(item.scheduledAt)}</Td>
            <Td><Badge variant={item.checkInStatus === 'completed' ? 'success' : item.checkInStatus === 'no_show' ? 'error' : item.checkInStatus === 'scheduled' ? 'info' : 'warning'}>{item.checkInStatus || item.reservationStatus}</Badge></Td>
            <Td className="text-right"><div className="flex justify-end gap-2">
              {(!item.checkInId || item.checkInStatus === 'no_show') && <Button size="sm" onClick={() => openSchedule(item)}>{item.checkInStatus === 'no_show' ? 'Lên lịch lại' : 'Lên lịch'}</Button>}
              {item.checkInStatus === 'scheduled' && <Button size="sm" onClick={() => openHandover(item)}>Bàn giao</Button>}
              {item.checkInStatus === 'scheduled' && item.scheduledAt && new Date(item.scheduledAt).getTime() <= Date.now() && <Button size="sm" variant="danger" onClick={() => { setNoShowTarget(item); setNoShowReason('') }}>No-show</Button>}
              {item.checkInStatus === 'completed' && <Badge variant="warning">Chờ khách xác nhận</Badge>}
            </div></Td>
          </Tr>)}
          {!loading && !items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">Không có hồ sơ nhận kho trong phạm vi cơ sở.</td></tr>}
          {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">Đang tải hồ sơ…</td></tr>}
        </Tbody>
      </Table>
      {totalPages > 1 && <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4 text-sm text-stone-500"><span>{totalItems} hồ sơ · Trang {page + 1}/{totalPages}</span><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Trước</Button><Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(value => value + 1)}>Sau</Button></div>}
    </Card>

    <Modal open={Boolean(scheduleTarget)} onClose={() => { if (!submitting) setScheduleTarget(null) }} title="Xác nhận hồ sơ sẵn sàng nhận kho">
      {scheduleTarget && <div className="space-y-4">
        <div className="rounded-lg bg-stone-50 p-3 text-sm"><b>{scheduleTarget.reservationCode}</b> · {scheduleTarget.storageUnitCode} · {scheduleTarget.customerName}</div>
        <Input label="Thời gian hẹn" type="datetime-local" value={scheduleAt} onChange={event => setScheduleAt(event.target.value)} />
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={contractVerified} onChange={event => setContractVerified(event.target.checked)} /> Hợp đồng đã được kiểm tra</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={paymentVerified} onChange={event => setPaymentVerified(event.target.checked)} /> Thanh toán cần thiết đã được xác nhận</label>
        <Input label="Ghi chú" value={scheduleNote} maxLength={1000} onChange={event => setScheduleNote(event.target.value)} />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setScheduleTarget(null)}>Đóng</Button><Button disabled={submitting || !scheduleAt || !contractVerified || !paymentVerified} onClick={() => void submitSchedule()}>{submitting ? 'Đang lưu…' : 'Xác nhận sẵn sàng'}</Button></div>
      </div>}
    </Modal>

    <Modal open={Boolean(handoverTarget)} onClose={() => { if (!submitting) setHandoverTarget(null) }} title="Đối chiếu và hoàn tất bàn giao" size="xl">
      {handoverTarget && <div className="space-y-4">
        <div className="rounded-lg bg-stone-50 p-3 text-sm"><b>{handoverTarget.reservationCode}</b> · {handoverTarget.storageUnitCode} · {handoverTarget.customerName}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Input label="Dài thực tế (cm)" type="number" min="0.01" value={lengthCm} onChange={event => setLengthCm(event.target.value)} /><Input label="Rộng thực tế (cm)" type="number" min="0.01" value={widthCm} onChange={event => setWidthCm(event.target.value)} /><Input label="Cao thực tế (cm)" type="number" min="0.01" value={heightCm} onChange={event => setHeightCm(event.target.value)} /><Input label="Khối lượng (kg)" type="number" min="0.01" value={weightKg} onChange={event => setWeightKg(event.target.value)} /><Input label="Thể tích (m³)" type="number" min="0.000001" value={volumeM3} onChange={event => setVolumeM3(event.target.value)} /><Input label="Số kiện" type="number" min="1" value={packageCount} onChange={event => setPackageCount(event.target.value)} /></div>
        <Input label="Loại hàng" value={goodsCategory} onChange={event => setGoodsCategory(event.target.value)} /><Input label="Hiện trạng gian kho ban đầu" value={initialCondition} onChange={event => setInitialCondition(event.target.value)} /><Input label="Tình trạng hàng hóa" value={goodsCondition} onChange={event => setGoodsCondition(event.target.value)} />
        <label className="block text-sm font-medium text-stone-700">Bằng chứng bàn giao (ảnh hoặc PDF)
          <input className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setEvidenceFiles(Array.from(event.target.files || []))} />
          <span className="mt-1 block text-xs font-normal text-stone-500">{evidenceFiles.length ? `${evidenceFiles.length} tệp chờ tải lên` : evidenceReferences.length ? `${evidenceReferences.length} tệp đã tải lên` : 'Bắt buộc ít nhất một tệp.'}</span>
        </label>
        <Input label="Vật dụng/quyền truy cập đã bàn giao" value={handedOverItems} onChange={event => setHandedOverItems(event.target.value)} />
        <div className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-2">{checklistLabels.map(([key, label]) => <label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={checklist[key]} onChange={event => setChecklist(previous => ({ ...previous, [key]: event.target.checked }))} /> {label}</label>)}</div>
        <Input label="Ghi chú bàn giao" value={handoverNotes} maxLength={2000} onChange={event => setHandoverNotes(event.target.value)} />
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Hoàn tất sẽ chuyển reservation sang AWAITING_CUSTOMER_RECEIPT, assignment sang COMPLETED và unit sang assigned. Rental chưa được tạo tại bước này.</div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setHandoverTarget(null)}>Đóng</Button><Button disabled={submitting || !allChecksComplete || !initialCondition.trim() || !goodsCondition.trim() || (!evidenceFiles.length && !evidenceReferences.length) || !handedOverItems.trim()} onClick={() => void submitHandover()}>{submitting ? 'Đang tải bằng chứng và hoàn tất…' : 'Xác nhận bàn giao'}</Button></div>
      </div>}
    </Modal>

    <Modal open={Boolean(noShowTarget)} onClose={() => { if (!submitting) setNoShowTarget(null) }} title="Đánh dấu khách không đến">
      {noShowTarget && <div className="space-y-4"><div className="rounded-lg bg-stone-50 p-3 text-sm"><b>{noShowTarget.reservationCode}</b> · {noShowTarget.customerName}</div><Input label="Lý do" value={noShowReason} maxLength={1000} onChange={event => setNoShowReason(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNoShowTarget(null)}>Đóng</Button><Button variant="danger" disabled={submitting || !noShowReason.trim()} onClick={() => void submitNoShow()}>Xác nhận no-show</Button></div></div>}
    </Modal>
  </div>
}
