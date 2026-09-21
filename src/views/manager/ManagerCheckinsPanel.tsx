import React, { useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Avatar, ProgressBar, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import { managerTimeLabel } from './managerI18n'
import type { CheckInRecord } from '../../types/storageHub'

interface ManagerCheckinsPanelProps {
  user: User
  sb: (v: string) => React.ReactNode
}

export default function ManagerCheckinsPanel({ user, sb }: ManagerCheckinsPanelProps) {
  const { lang } = useLanguage()
  const { checkins: storeCheckins, units: storeUnits } = useStorageHub()

  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedCheckin, setSelectedCheckin] = useState<CheckInRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const checkinTabs = [
    { key: 'All', label: lang === 'vi' ? 'Tất cả' : 'All' },
    { key: 'scheduled', label: lang === 'vi' ? 'Chờ đến hẹn' : 'Scheduled' },
    { key: 'completed', label: lang === 'vi' ? 'Đã bàn giao' : 'Completed' },
    { key: 'cancelled', label: lang === 'vi' ? 'Đã hủy' : 'Cancelled' }
  ]

  // Filter checkins by facility (either match checkin.facilityId or unit's facility)
  const facilityCheckins = storeCheckins.filter(c => {
    if (!user.facility || user.facility === 'All facilities') return true
    const unit = storeUnits.find(u => u.id === c.unitId)
    return (unit && unit.facilityName === user.facility) || c.facilityId === user.facility
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
        title={lang === 'vi' ? 'Giám Sát Nhận Kho & Bàn Giao' : 'Move-in & Handover Monitoring'}
        subtitle={
          lang === 'vi'
            ? 'Theo dõi trực quan lịch hẹn nhận kho, tiến độ xác minh pháp lý 5 bước và biên bản kiểm đo thực tế'
            : 'Supervise scheduled move-in appointments, 5-step verification checklist, and physical storage handover'
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={lang === 'vi' ? 'Tổng lượt tiếp nhận' : 'Total move-ins'}
          value={facilityCheckins.length}
          icon={Icon.clipboard}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title={lang === 'vi' ? 'Chờ tiếp nhận' : 'Scheduled Appointments'}
          value={scheduledCount}
          delta={scheduledCount > 0 ? (lang === 'vi' ? 'Hôm nay & sắp tới' : 'Upcoming') : undefined}
          deltaPositive
          icon={Icon.calendar}
          iconBg="bg-amber-50 text-amber-700"
        />
        <StatCard
          title={lang === 'vi' ? 'Đã bàn giao thành công' : 'Completed Handover'}
          value={completedCount}
          delta={`${facilityCheckins.length ? Math.round((completedCount / facilityCheckins.length) * 100) : 0}% ${lang === 'vi' ? 'tỷ lệ hoàn tất' : 'completion'}`}
          deltaPositive
          icon={Icon.check}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title={lang === 'vi' ? 'Lượt hủy / Không đến' : 'Cancelled / No Show'}
          value={cancelledCount}
          icon={Icon.alert}
          iconBg="bg-stone-100 text-stone-600"
        />
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={checkinTabs.map(item => item.label)}
          active={checkinTabs.find(item => item.key === tab)?.label || checkinTabs[0].label}
          onChange={val => {
            setTab(checkinTabs.find(item => item.label === val)?.key || 'All')
          }}
        />
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder={lang === 'vi' ? 'Tìm theo mã, khách, gian kho, nhân viên...' : 'Search ID, tenant, unit, staff...'}
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
              <Th>{lang === 'vi' ? 'Mã Tiếp Nhận' : 'Move-in ID'}</Th>
              <Th>{lang === 'vi' ? 'Khách Nhận Kho' : 'Tenant'}</Th>
              <Th>{lang === 'vi' ? 'Gian Kho' : 'Unit'}</Th>
              <Th>{lang === 'vi' ? 'Lịch Hẹn Bàn Giao' : 'Appointment'}</Th>
              <Th>{lang === 'vi' ? 'Tiến Độ Kiểm Tra (5 Bước)' : 'Handover Checklist'}</Th>
              <Th>{lang === 'vi' ? 'Nhân Viên Phụ Trách' : 'Staff In-charge'}</Th>
              <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
              <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredCheckins.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-stone-400 text-sm">
                  {lang === 'vi'
                    ? 'Không có lịch hẹn nhận kho nào trong bộ lọc này.'
                    : 'No move-in records found.'}
                </td>
              </tr>
            ) : (
              filteredCheckins.map(c => {
                const passedCount = getChecklistCount(c.checklist)
                return (
                  <Tr key={c.id}>
                    <Td>
                      <span className="font-mono text-xs font-bold text-stone-800">{c.id}</span>
                      <p className="text-[11px] text-stone-400 font-mono">{lang === 'vi' ? 'Đơn' : 'Reservation'}: {c.holdId}</p>
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
                        <p className="text-stone-400 font-mono">{managerTimeLabel(c.scheduledTime || '09:00 AM', lang)}</p>
                      </div>
                    </Td>
                    <Td>
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-stone-500">{passedCount}/5 {lang === 'vi' ? 'bước' : 'steps'}</span>
                          <span className={passedCount === 5 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-semibold'}>
                            {passedCount === 5 ? (lang === 'vi' ? 'Đầy đủ' : 'Complete') : (lang === 'vi' ? 'Đang xác minh' : 'In progress')}
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
                        <p className="font-medium text-stone-800">{c.staffName || (lang === 'vi' ? 'Chưa phân công' : 'Unassigned')}</p>
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
                        {lang === 'vi' ? 'Chi tiết' : 'Details'}
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
        title={lang === 'vi' ? 'Hồ Sơ Tiếp Nhận & Bàn Giao Gian Kho' : 'Move-in Handover Dossier'}
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
                    {lang === 'vi' ? `Gian Kho ${selectedCheckin.unitId}` : `Unit ${selectedCheckin.unitId}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedCheckin.customerName} · {lang === 'vi' ? 'Lịch hẹn:' : 'Appt:'} {selectedCheckin.scheduledDate} {managerTimeLabel(selectedCheckin.scheduledTime, lang)}
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
                {lang === 'vi' ? 'Tiến Độ Xác Minh & Bàn Giao 5 Điểm' : '5-Point Verification Checklist'}
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">1. {lang === 'vi' ? 'Đối chiếu CCCD/Hộ chiếu người nhận kho' : 'Identity Document Verification'}</span>
                  <Badge variant={selectedCheckin.checklist.identityVerified ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.identityVerified ? (lang === 'vi' ? 'Đã đối chiếu' : 'Verified') : (lang === 'vi' ? 'Chưa duyệt' : 'Pending')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">2. {lang === 'vi' ? 'Ký cam kết & quy chế lưu kho' : 'Terms & Storage Rules Acceptance'}</span>
                  <Badge variant={selectedCheckin.checklist.termsAccepted ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.termsAccepted ? (lang === 'vi' ? 'Đã ký cam kết' : 'Accepted') : (lang === 'vi' ? 'Chưa ký' : 'Pending')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">3. {lang === 'vi' ? 'Xác nhận thu đủ cước thuê & tiền đảm bảo kho' : 'Balance & Security Deposit Payment'}</span>
                  <Badge variant={selectedCheckin.checklist.paymentConfirmed ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.paymentConfirmed ? (lang === 'vi' ? 'Đã thanh toán đủ' : 'Confirmed') : (lang === 'vi' ? 'Còn thiếu' : 'Pending')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">4. {lang === 'vi' ? 'Dẫn khách nghiệm thu gian kho thực tế' : 'Unit Walkthrough & Physical Inspection'}</span>
                  <Badge variant={selectedCheckin.checklist.unitWalkthrough ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.unitWalkthrough ? (lang === 'vi' ? 'Đã nghiệm thu' : 'Inspected') : (lang === 'vi' ? 'Chưa xem' : 'Pending')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/70">
                  <span className="font-medium text-stone-700">5. {lang === 'vi' ? 'Cấp mã PIN cửa điện tử / Thẻ khóa từ' : 'Access Code & Key Credentials Issued'}</span>
                  <Badge variant={selectedCheckin.checklist.accessCodeIssued ? 'success' : 'muted'}>
                    {selectedCheckin.checklist.accessCodeIssued ? (lang === 'vi' ? 'Đã kích hoạt PIN' : 'Issued') : (lang === 'vi' ? 'Chưa cấp' : 'Pending')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actual Physical Measurements */}
            {selectedCheckin.actualMeasurements && (
              <div className="rounded-xl border border-stone-200 p-3.5 bg-stone-50 text-xs space-y-2">
                <p className="font-bold text-stone-900">{lang === 'vi' ? 'Thông Số Kiểm Đo Hàng Hóa Thực Tế' : 'Physical Verification Dimensions'}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded border">
                    <span className="text-stone-400 block">{lang === 'vi' ? 'Thể tích đo' : 'Volume'}</span>
                    <span className="font-bold text-stone-800">{selectedCheckin.actualMeasurements.actualVolumeM3} m³</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="text-stone-400 block">{lang === 'vi' ? 'Khối lượng' : 'Weight'}</span>
                    <span className="font-bold text-stone-800">{selectedCheckin.actualMeasurements.weightKg} kg</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="text-stone-400 block">{lang === 'vi' ? 'Độ lệch thể tích' : 'Variance'}</span>
                    <span className={selectedCheckin.actualMeasurements.varianceAccepted ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                      {selectedCheckin.actualMeasurements.varianceAccepted ? (lang === 'vi' ? 'Hợp lệ' : 'Accepted') : (lang === 'vi' ? 'Cần rà soát' : 'Flagged')}
                    </span>
                  </div>
                </div>
                {selectedCheckin.actualMeasurements.varianceNotes && (
                  <p className="text-stone-500 italic mt-1">{lang === 'vi' ? 'Ghi chú' : 'Notes'}: {selectedCheckin.actualMeasurements.varianceNotes}</p>
                )}
              </div>
            )}

            {/* Access Code & Handover Info */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-amber-900 font-semibold block">{lang === 'vi' ? 'Mã PIN số bảo mật gian kho' : 'Digital Access PIN'}</span>
                <span className="font-mono text-sm font-bold text-amber-950 mt-0.5 inline-block">
                  {selectedCheckin.accessCodeIssued || selectedCheckin.preparedAccessPin || (lang === 'vi' ? '••••# (Kích hoạt khi hoàn tất)' : '••••# (Activated upon completion)')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-stone-500 block">{lang === 'vi' ? 'Nhân viên thực hiện:' : 'Staff handler:'}</span>
                <span className="font-semibold text-stone-800">{selectedCheckin.staffName}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
