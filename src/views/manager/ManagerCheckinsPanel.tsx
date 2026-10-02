import React, { useEffect, useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Avatar, ProgressBar, Select, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { CheckInRecord } from '../../types/storageHub'
import { isManagerFacilityVisible } from '../../domain/managerRules'
import ManagerActionNotice from './ManagerActionNotice'
import ManagerPagination from './ManagerPagination'
import { formatManagerDate, managerDateValue, matchesManagerSearch, paginateManagerItems } from './managerList'

interface ManagerCheckinsPanelProps {
  user: User
  sb: (v: string) => React.ReactNode
}

export default function ManagerCheckinsPanel({ user, sb }: ManagerCheckinsPanelProps) {
  const { checkins: storeCheckins, units: storeUnits } = useStorageHub()
  const hiddenHistoryStorageKey = `storagehub:manager:${user.id}:hidden-checkins`

  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedCheckin, setSelectedCheckin] = useState<CheckInRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [hideTarget, setHideTarget] = useState<CheckInRecord | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning'; message: string } | null>(null)
  const [hiddenCheckinIds, setHiddenCheckinIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = JSON.parse(window.localStorage.getItem(hiddenHistoryStorageKey) || '[]')
      return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  })

  // Filter checkins by facility (either match checkin.facilityId or unit's facility)
  const scopedCheckins = storeCheckins.filter(c => {
    const unit = storeUnits.find(u => u.id === c.unitId)
    return isManagerFacilityVisible(user, c.facilityId || unit?.facilityId, unit?.facilityName)
  })
  const facilityCheckins = scopedCheckins.filter(c => !hiddenCheckinIds.includes(c.id))
  const hiddenFacilityCount = scopedCheckins.length - facilityCheckins.length

  const scheduledCount = scopedCheckins.filter(c => c.status === 'scheduled').length
  const completedCount = scopedCheckins.filter(c => c.status === 'completed').length
  const cancelledCount = scopedCheckins.filter(c => c.status === 'cancelled').length

  const staffOptions = Array.from(new Map(facilityCheckins.filter(item => item.staffId).map(item => [item.staffId, item.staffName || item.staffId])).entries()).sort((left, right) => left[1].localeCompare(right[1], 'vi'))
  const today = new Date().toISOString().slice(0, 10)
  const filteredCheckins = facilityCheckins.filter(c => {
    const matchTab =
      tab === 'All' ||
      tab === 'Tất cả' ||
      (tab === 'scheduled' && c.status === 'scheduled') ||
      (tab === 'completed' && c.status === 'completed') ||
      (tab === 'cancelled' && c.status === 'cancelled')

    const matchSearch = matchesManagerSearch(search, [c.id, c.holdId, c.customerId, c.customerName, c.unitId, c.staffId, c.staffName])
    const matchStaff = staffFilter === 'all' || c.staffId === staffFilter
    const matchDate = (!dateFrom || c.scheduledDate >= dateFrom) && (!dateTo || c.scheduledDate <= dateTo)
    return matchTab && matchSearch && matchStaff && matchDate
  }).sort((left, right) => {
    if (sortBy === 'date-asc') return managerDateValue(`${left.scheduledDate}T${left.scheduledTime || '00:00'}`) - managerDateValue(`${right.scheduledDate}T${right.scheduledTime || '00:00'}`)
    if (sortBy === 'date-desc') return managerDateValue(`${right.scheduledDate}T${right.scheduledTime || '00:00'}`) - managerDateValue(`${left.scheduledDate}T${left.scheduledTime || '00:00'}`)
    if (sortBy === 'customer') return left.customerName.localeCompare(right.customerName, 'vi')
    const priority = (item: CheckInRecord) => item.status === 'scheduled' ? (item.scheduledDate < today ? 0 : item.scheduledDate === today ? 1 : 2) : item.status === 'completed' ? 3 : 4
    return priority(left) - priority(right) || managerDateValue(`${left.scheduledDate}T${left.scheduledTime || '00:00'}`) - managerDateValue(`${right.scheduledDate}T${right.scheduledTime || '00:00'}`)
  })
  const pagination = paginateManagerItems(filteredCheckins, page, pageSize)

  useEffect(() => setPage(1), [tab, search, staffFilter, dateFrom, dateTo, sortBy, pageSize])

  const getChecklistCount = (cl: CheckInRecord['checklist']) => {
    let count = 0
    if (cl.identityVerified) count++
    if (cl.termsAccepted) count++
    if (cl.paymentConfirmed) count++
    if (cl.unitWalkthrough) count++
    if (cl.accessCodeIssued) count++
    return count
  }

  const hideHistory = () => {
    if (!hideTarget) return
    const nextHiddenIds = Array.from(new Set([...hiddenCheckinIds, hideTarget.id]))
    setHiddenCheckinIds(nextHiddenIds)
    try {
      window.localStorage.setItem(hiddenHistoryStorageKey, JSON.stringify(nextHiddenIds))
    } catch {
      setFeedback({ tone: 'warning', message: 'Đã ẩn trong phiên hiện tại nhưng trình duyệt không thể lưu tùy chọn này.' })
      setHideTarget(null)
      return
    }

    if (selectedCheckin?.id === hideTarget.id) {
      setSelectedCheckin(null)
      setDetailOpen(false)
    }
    setFeedback({ tone: 'success', message: `Đã ẩn hồ sơ ${hideTarget.id} khỏi danh sách của Manager. Dữ liệu dùng chung không bị xóa.` })
    setHideTarget(null)
  }

  const restoreHiddenHistory = () => {
    setHiddenCheckinIds([])
    try {
      window.localStorage.removeItem(hiddenHistoryStorageKey)
    } catch {
      setFeedback({ tone: 'warning', message: 'Đã hiện lại trong phiên hiện tại nhưng trình duyệt không thể lưu tùy chọn này.' })
      return
    }
    setFeedback({ tone: 'success', message: 'Đã hiện lại toàn bộ hồ sơ bàn giao bị ẩn.' })
  }

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        title={'Giám sát quy trình nhận kho & bàn giao kho'}
        subtitle={
          'Theo dõi trực quan lịch hẹn nhận kho, tiến độ xác minh pháp lý 5 bước và biên bản kiểm đo thực tế'
        }
      />

      <ManagerActionNotice>
        Manager theo dõi tiến độ và hồ sơ bàn giao. Việc xác minh khách hàng, ký biên bản, cấp quyền truy cập và hoàn tất nhận kho do Staff thực hiện.
      </ManagerActionNotice>

      {hiddenFacilityCount > 0 && (
        <ManagerActionNotice tone="info">
          <div className="flex items-center justify-between gap-3">
            <span>{hiddenFacilityCount} hồ sơ chỉ đang bị ẩn khỏi giao diện Manager; dữ liệu dùng chung vẫn còn nguyên.</span>
            <Button size="sm" variant="outline" onClick={restoreHiddenHistory}>Hiện lại</Button>
          </div>
        </ManagerActionNotice>
      )}

      {feedback && (
        <ManagerActionNotice tone={feedback.tone}>
          <div className="flex items-center justify-between gap-3">
            <span>{feedback.message}</span>
            <button type="button" className="font-semibold underline" onClick={() => setFeedback(null)}>Đóng</button>
          </div>
        </ManagerActionNotice>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={'Tổng lượt tiếp nhận'}
          value={scopedCheckins.length}
          icon={Icon.clipboard}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title={'Chờ tiếp nhận'}
          value={scheduledCount}
          delta={scheduledCount > 0 ? ('Hôm nay & sắp tới') : undefined}
          deltaPositive
          icon={Icon.calendar}
          iconBg="bg-amber-50 text-amber-700"
        />
        <StatCard
          title={'Đã bàn giao thành công'}
          value={completedCount}
          delta={`${scopedCheckins.length ? Math.round((completedCount / scopedCheckins.length) * 100) : 0}% ${'tỷ lệ hoàn tất'}`}
          deltaPositive
          icon={Icon.check}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title={'Lượt hủy / Không đến'}
          value={cancelledCount}
          icon={Icon.alert}
          iconBg="bg-stone-100 text-stone-600"
        />
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={
            ['Tất cả', 'Chờ đến hẹn', 'Đã bàn giao', 'Đã hủy']
          }
          active={
            tab === 'All' ? 'Tất cả' :
            tab === 'scheduled' ? 'Chờ đến hẹn' :
            tab === 'completed' ? 'Đã bàn giao' :
            tab === 'cancelled' ? 'Đã hủy' : tab
          }
          onChange={val => {
            if (val === 'Tất cả') setTab('All')
            else if (val === 'Chờ đến hẹn') setTab('scheduled')
            else if (val === 'Đã bàn giao') setTab('completed')
            else if (val === 'Đã hủy') setTab('cancelled')
            else setTab(val)
          }}
        />
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder={'Tìm theo mã, khách, gian kho, nhân viên...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
        </div>
      </div>
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Nhân viên" value={staffFilter} onChange={event => setStaffFilter(event.target.value)}><option value="all">Tất cả nhân viên</option>{staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>
          <label className="text-sm font-medium text-stone-700">Từ ngày<input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal" /></label>
          <label className="text-sm font-medium text-stone-700">Đến ngày<input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal" /></label>
          <Select label="Sắp xếp" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="priority">Cần xử lý trước</option><option value="date-asc">Lịch gần nhất</option><option value="date-desc">Lịch xa nhất</option><option value="customer">Tên khách hàng</option></Select>
        </div>
      </Card>

      {/* Checkins Table */}
      <Card className="overflow-hidden border border-stone-200/80 shadow-sm">
        <Table>
          <Thead>
            <tr>
              <Th>{'Mã Tiếp Nhận'}</Th>
              <Th>{'Khách Nhận Kho'}</Th>
              <Th>{'Gian Kho'}</Th>
              <Th>{'Lịch Hẹn Bàn Giao'}</Th>
              <Th>{'Tiến Độ Checklist (5 Bước)'}</Th>
              <Th>{'Nhân Viên Phụ Trách'}</Th>
              <Th>{'Trạng Thái'}</Th>
              <Th className="text-right">{'Thao Tác'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredCheckins.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-stone-400 text-sm">
                  {'Không có lịch hẹn check-in nào trong bộ lọc này.'}
                </td>
              </tr>
            ) : (
              pagination.items.map(c => {
                const passedCount = getChecklistCount(c.checklist)
                return (
                  <Tr key={c.id}>
                    <Td>
                      <span className="font-mono text-xs font-bold text-stone-800">{c.id}</span>
                      <p className="text-[11px] text-stone-400 font-mono">Đơn: {c.holdId}</p>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={c.customerName} size="sm" />
                        <div>
                          <p className="font-medium text-sm text-stone-900">{c.customerName}</p>
                          <p className="text-xs text-stone-400">ID: {c.customerId}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded text-xs">
                        {c.unitId}
                      </span>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="font-medium text-stone-800">{formatManagerDate(c.scheduledDate)}</p>
                        <p className="text-stone-400 font-mono">{c.scheduledTime || '09:00 AM'}</p>
                      </div>
                    </Td>
                    <Td>
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-stone-500">{passedCount}/5 {'bước'}</span>
                          <span className={passedCount === 5 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-semibold'}>
                            {passedCount === 5 ? ('Đầy đủ') : ('Đang xác minh')}
                          </span>
                        </div>
                        <ProgressBar
                          value={passedCount}
                          max={5}
                          color={passedCount === 5 ? 'bg-emerald-500' : passedCount >= 3 ? 'bg-amber-500' : 'bg-stone-400'}
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="font-medium text-stone-800">{c.staffName || 'Chưa phân công'}</p>
                        <p className="text-[11px] text-stone-400">{c.staffId}</p>
                      </div>
                    </Td>
                    <Td>{sb(c.status)}</Td>
                    <Td className="text-right">
                      <div className="inline-flex max-w-52 flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCheckin(c)
                              setDetailOpen(true)
                            }}
                          >
                            {'Chi tiết'}
                          </Button>
                          {c.status !== 'scheduled' && (
                            <Button variant="danger" size="sm" onClick={() => setHideTarget(c)}>
                              Xóa
                            </Button>
                          )}
                        </div>
                        <ManagerActionNotice compact tone={c.status === 'completed' ? 'success' : c.status === 'cancelled' ? 'warning' : 'info'}>{c.status === 'scheduled' ? 'Chờ Staff thực hiện nhận kho.' : c.status === 'completed' ? 'Staff đã hoàn tất bàn giao.' : 'Lịch nhận kho đã hủy; không còn thao tác.'}</ManagerActionNotice>
                      </div>
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>
        <ManagerPagination {...pagination} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      {/* Checkin Details Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={'Hồ Sơ Tiếp Nhận & Bàn Giao Gian Kho'}
      >
        {selectedCheckin && (
          <div className="space-y-4">
            {/* Header banner */}
            <div className="p-4 rounded-xl bg-slate-900 text-white shadow-inner">
              <div className="flex justify-between items-center text-xs font-mono text-amber-400">
                <span>{selectedCheckin.id}</span>
                <span>{selectedCheckin.holdId}</span>
              </div>
              <div className="mt-2 flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold font-mono">
                    {`Gian Kho ${selectedCheckin.unitId}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedCheckin.customerName} · {'Lịch hẹn:'} {formatManagerDate(selectedCheckin.scheduledDate)} {selectedCheckin.scheduledTime}
                  </p>
                </div>
                <div className="text-right">
                  {sb(selectedCheckin.status)}
                </div>
              </div>
            </div>

            {/* Checklist items detailed grid */}
            <div className="rounded-xl border border-stone-200 p-4 bg-white space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500 font-mono">
                {'Tiến Độ Xác Minh & Bàn Giao 5 Điểm'}
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">1. {'Đối chiếu CCCD/Hộ chiếu người nhận kho'}</span>
                  <Badge variant={selectedCheckin.checklist.identityVerified ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.identityVerified ? ('Đã đối chiếu') : ('Chưa duyệt')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">2. {'Ký cam kết & quy chế lưu kho'}</span>
                  <Badge variant={selectedCheckin.checklist.termsAccepted ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.termsAccepted ? ('Đã ký cam kết') : ('Chưa ký')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">3. {'Xác nhận thu đủ cước thuê & tiền đảm bảo kho'}</span>
                  <Badge variant={selectedCheckin.checklist.paymentConfirmed ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.paymentConfirmed ? ('Đã thanh toán đủ') : ('Còn thiếu')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">4. {'Dẫn khách nghiệm thu gian kho thực tế'}</span>
                  <Badge variant={selectedCheckin.checklist.unitWalkthrough ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.unitWalkthrough ? ('Đã nghiệm thu') : ('Chưa xem')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">5. {'Cấp mã PIN cửa điện tử / Thẻ khóa từ'}</span>
                  <Badge variant={selectedCheckin.checklist.accessCodeIssued ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.accessCodeIssued ? ('Đã kích hoạt PIN') : ('Chưa cấp')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actual Physical Measurements */}
            {selectedCheckin.actualMeasurements && (
              <div className="rounded-xl border border-stone-200 p-3.5 bg-stone-50 text-xs space-y-2">
                <p className="font-bold text-stone-900">{'Thông Số Kiểm Đo Hàng Hóa Thực Tế'}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded border">
                    <span className="text-stone-400 block">{'Thể tích đo'}</span>
                    <span className="font-bold text-stone-800">{selectedCheckin.actualMeasurements.actualVolumeM3} m³</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="text-stone-400 block">{'Khối lượng'}</span>
                    <span className="font-bold text-stone-800">{selectedCheckin.actualMeasurements.weightKg} kg</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="text-stone-400 block">{'Độ lệch thể tích'}</span>
                    <span className={selectedCheckin.actualMeasurements.varianceAccepted ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                      {selectedCheckin.actualMeasurements.varianceAccepted ? ('Hợp lệ') : ('Cần rà soát')}
                    </span>
                  </div>
                </div>
                {selectedCheckin.actualMeasurements.varianceNotes && (
                  <p className="text-stone-500 italic mt-1">Ghi chú: {selectedCheckin.actualMeasurements.varianceNotes}</p>
                )}
              </div>
            )}

            {/* Manager monitors access handover status but does not receive the raw credential. */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-amber-900 font-semibold block">{'Trạng thái quyền truy cập'}</span>
                <span className="text-sm font-bold text-amber-950 mt-0.5 inline-block">
                  {selectedCheckin.checklist.accessCodeIssued || selectedCheckin.accessCodeIssued || selectedCheckin.preparedAccessPin ? 'Đã cấp cho khách hàng' : 'Chưa cấp'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-stone-500 block">{'Nhân viên thực hiện:'}</span>
                <span className="font-semibold text-stone-800">{selectedCheckin.staffName}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                {'Đóng'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(hideTarget)}
        onClose={() => setHideTarget(null)}
        title="Soft-delete hồ sơ lịch sử"
      >
        {hideTarget && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold">Xóa hồ sơ {hideTarget.id} khỏi lịch sử Manager?</p>
              <p className="mt-1 text-red-700">
                Hồ sơ của {hideTarget.customerName}, gian kho {hideTarget.unitId}, sẽ chỉ bị ẩn ở giao diện Manager hiện tại. Dữ liệu bàn giao dùng chung vẫn được giữ nguyên cho các role và luồng nghiệp vụ khác.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setHideTarget(null)}>Hủy</Button>
              <Button variant="danger" onClick={hideHistory}>Xóa khỏi lịch sử</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
