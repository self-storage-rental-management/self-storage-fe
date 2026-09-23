import React, { useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Avatar, ProgressBar, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { CheckInRecord } from '../../types/storageHub'
import { isFacilityVisible } from '../../domain/managerRules'

interface ManagerCheckinsPanelProps {
  user: User
  sb: (v: string) => React.ReactNode
}

export default function ManagerCheckinsPanel({ user, sb }: ManagerCheckinsPanelProps) {
    const { checkins: storeCheckins, units: storeUnits } = useStorageHub()

  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedCheckin, setSelectedCheckin] = useState<CheckInRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Filter checkins by facility (either match checkin.facilityId or unit's facility)
  const facilityCheckins = storeCheckins.filter(c => {
    const unit = storeUnits.find(u => u.id === c.unitId)
    return isFacilityVisible(user, c.facilityId || unit?.facilityId, unit?.facilityName)
  })

  const scheduledCount = facilityCheckins.filter(c => c.status === 'scheduled').length
  const completedCount = facilityCheckins.filter(c => c.status === 'completed').length
  const cancelledCount = facilityCheckins.filter(c => c.status === 'cancelled').length

  const filteredCheckins = facilityCheckins.filter(c => {
    const matchTab =
      tab === 'All' ||
      tab === 'Tất cả' ||
      (tab === 'scheduled' && c.status === 'scheduled') ||
      (tab === 'completed' && c.status === 'completed') ||
      (tab === 'cancelled' && c.status === 'cancelled')

    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      c.id.toLowerCase().includes(q) ||
      c.customerName.toLowerCase().includes(q) ||
      c.unitId.toLowerCase().includes(q) ||
      (c.staffName && c.staffName.toLowerCase().includes(q))

    return matchTab && matchSearch
  })

  const getChecklistCount = (cl: CheckInRecord['checklist']) => {
    let count = 0
    if (cl.identityVerified) count++
    if (cl.termsAccepted) count++
    if (cl.paymentConfirmed) count++
    if (cl.unitWalkthrough) count++
    if (cl.accessCodeIssued) count++
    return count
  }

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        title={'Giám sát quy trình nhận kho & bàn giao kho'}
        subtitle={
          'Theo dõi trực quan lịch hẹn nhận kho, tiến độ xác minh pháp lý 5 bước và biên bản kiểm đo thực tế'
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={'Tổng lượt tiếp nhận'}
          value={facilityCheckins.length}
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
          delta={`${facilityCheckins.length ? Math.round((completedCount / facilityCheckins.length) * 100) : 0}% ${'tỷ lệ hoàn tất'}`}
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
              filteredCheckins.map(c => {
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
                        <p className="font-medium text-stone-800">{c.scheduledDate}</p>
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
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>
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
                    {selectedCheckin.customerName} · {'Lịch hẹn:'} {selectedCheckin.scheduledDate} {selectedCheckin.scheduledTime}
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

            {/* Access Code & Handover Info */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-amber-900 font-semibold block">{'Mã PIN số bảo mật gian kho'}</span>
                <span className="font-mono text-sm font-bold text-amber-950 mt-0.5 inline-block">
                  {selectedCheckin.accessCodeIssued || selectedCheckin.preparedAccessPin || '••••# (Kích hoạt khi hoàn tất)'}
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
    </div>
  )
}
