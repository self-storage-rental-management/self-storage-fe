import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { ActivityRecord, CheckInRecord, RentalRecord, ReturnCase, StoragePayment, StorageReservation, StorageUnit } from '../../types/storageHub'
import { isManagerFacilityVisible, isManagerRentalOverdue, parseManagerActivityTimestamp } from '../../domain/managerRules'
import { managerActivityLabel, managerEntityLabel, managerStatusLabel, managerUnitTypeLabel } from './managerI18n'

interface Props {
  user: User
  units: StorageUnit[]
  reservations: StorageReservation[]
  rentals: RentalRecord[]
  payments: StoragePayment[]
  activities: ActivityRecord[]
  checkins: CheckInRecord[]
  returns: ReturnCase[]
}

export default function ManagerReportsPanel({ user, units, reservations, rentals, payments, activities, checkins, returns }: Props) {
  const [activityQuery, setActivityQuery] = useState('')
  const [activityType, setActivityType] = useState('all')
  const [activityRole, setActivityRole] = useState('all')
  const [activityFrom, setActivityFrom] = useState('')
  const [activityTo, setActivityTo] = useState('')
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null)
  const facilityUnits = useMemo(() => units.filter(unit => isManagerFacilityVisible(user, unit.facilityId, unit.facilityName)), [units, user])
  const facilityReservations = reservations.filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName))
  const facilityRentals = rentals.filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName))
  const rentalIds = new Set(facilityRentals.map(item => item.id))
  const facilityPayments = payments.filter(item => item.rentalId ? rentalIds.has(item.rentalId) : facilityReservations.some(reservation => reservation.id === item.reservationId))
  const facilityActivities = activities.filter(item => isManagerFacilityVisible(user, item.facilityId))
  const facilityCheckins = checkins.filter(item => {
    const unit = units.find(candidate => candidate.id === item.unitId)
    return isManagerFacilityVisible(user, item.facilityId || unit?.facilityId, unit?.facilityName)
  })
  const facilityReturns = returns.filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName))
  const occupied = facilityUnits.filter(unit => unit.status === 'occupied').length
  const occupancy = facilityUnits.length ? Math.round((occupied / facilityUnits.length) * 100) : 0
  const collected = facilityPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + payment.amount, 0)
  const monthlyRecurring = facilityRentals.filter(rental => rental.status === 'active').reduce((sum, rental) => sum + rental.monthlyRate, 0)
  const overdueRentals = facilityRentals.filter(rental => isManagerRentalOverdue(rental))
  const unitStatusData = ['available', 'held', 'reserved', 'occupied', 'maintenance'].map(status => ({ name: managerStatusLabel(status, 'vi'), value: facilityUnits.filter(unit => unit.status === status).length }))
  const typeData = Array.from(new Set(facilityUnits.map(unit => unit.type))).map(type => ({ type: managerUnitTypeLabel(type, 'vi'), units: facilityUnits.filter(unit => unit.type === type).length, occupied: facilityUnits.filter(unit => unit.type === type && unit.status === 'occupied').length }))
  const colors = ['#10b981', '#3b82f6', '#e9a12c', '#57534e', '#ef4444']
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthCheckins = facilityCheckins.filter(item => (item.completedAt || item.scheduledDate).slice(0, 7) === currentMonth).length
  const openReturns = facilityReturns.filter(item => item.status !== 'completed').length
  const activityEvidence = (activity: ActivityRecord) => {
    const relatedReturn = activity.entityType === 'return' ? facilityReturns.find(item => item.id === activity.entityId) : undefined
    const relatedCheckin = activity.entityType === 'checkin' ? facilityCheckins.find(item => item.id === activity.entityId) : undefined
    const relatedPayment = activity.entityType === 'payment' ? facilityPayments.find(item => item.id === activity.entityId) : undefined
    return Array.from(new Set([...(activity.evidence || []), ...(relatedReturn?.evidence || []), ...(relatedCheckin?.evidencePhotos || []), ...(relatedPayment?.proofImage ? [relatedPayment.proofImage] : [])]))
  }
  const visibleActivities = facilityActivities
    .filter(activity => activityType === 'all' || activity.entityType === activityType)
    .filter(activity => activityRole === 'all' || activity.actorRole === activityRole)
    .filter(activity => {
      const timestamp = parseManagerActivityTimestamp(activity.timestamp)
      if (Number.isNaN(timestamp)) return !activityFrom && !activityTo
      const from = activityFrom ? new Date(`${activityFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
      const to = activityTo ? new Date(`${activityTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY
      return timestamp >= from && timestamp <= to
    })
    .filter(activity => {
      const query = activityQuery.trim().toLowerCase()
      return !query || [activity.action, activity.entityId, activity.actorName, activity.notes || ''].some(value => value.toLowerCase().includes(query))
    })
    .sort((left, right) => parseManagerActivityTimestamp(right.timestamp) - parseManagerActivityTimestamp(left.timestamp))
  const selectedReturn = selectedActivity?.entityType === 'return' ? facilityReturns.find(item => item.id === selectedActivity.entityId) : undefined
  const selectedCheckin = selectedActivity?.entityType === 'checkin' ? facilityCheckins.find(item => item.id === selectedActivity.entityId) : undefined
  const selectedPayment = selectedActivity?.entityType === 'payment' ? facilityPayments.find(item => item.id === selectedActivity.entityId) : undefined
  const selectedRental = selectedActivity?.entityType === 'rental' ? facilityRentals.find(item => item.id === selectedActivity.entityId) : undefined
  const selectedEvidence = selectedActivity ? activityEvidence(selectedActivity) : []

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={'Phân tích vận hành'} title="Báo cáo cơ sở" subtitle={'Số liệu được tính trực tiếp từ tồn kho, hợp đồng thuê và thanh toán hiện tại.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"><StatCard title={'Tỷ lệ lấp đầy'} value={`${occupancy}%`} icon={Icon.chart} /><StatCard title={'Doanh thu định kỳ'} value={formatVnd(monthlyRecurring)} icon={Icon.dollar} /><StatCard title={'Đã thu thực tế'} value={formatVnd(collected)} icon={Icon.credit} /><StatCard title={'Tài khoản quá hạn'} value={overdueRentals.length} icon={Icon.alert} /><StatCard title={'Nhận kho tháng này'} value={monthCheckins} icon={Icon.truck} /><StatCard title={'Hồ sơ trả đang mở'} value={openReturns} icon={Icon.refresh} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card className="p-5"><h3 className="mb-4 font-bold">{'Phân bổ trạng thái gian kho'}</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={unitStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>{unitStatusData.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="grid grid-cols-2 gap-2 text-xs">{unitStatusData.map((entry, index) => <div key={entry.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index] }} /><span className="flex-1 text-stone-500">{entry.name}</span><b>{entry.value}</b></div>)}</div></Card><Card className="p-5"><h3 className="mb-4 font-bold">{'Công suất theo loại kho'}</h3><ResponsiveContainer width="100%" height={270}><BarChart data={typeData}><CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" /><XAxis dataKey="type" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="units" fill="#d6d3d1" name="Tổng số" radius={[4, 4, 0, 0]} /><Bar dataKey="occupied" fill="#e9a12c" name="Đang sử dụng" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Card></div>
    <Card><div className="border-b border-stone-200 p-4"><div><h3 className="font-bold">Nhật ký hoạt động cơ sở</h3><p className="text-xs text-stone-500">Bao gồm thay đổi trạng thái, bằng chứng và dữ liệu trước/sau nếu nghiệp vụ có ghi nhận.</p></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5"><Input value={activityQuery} onChange={event => setActivityQuery(event.target.value)} placeholder="Tìm hành động, mã hồ sơ, người thực hiện…" /><Select value={activityType} onChange={event => setActivityType(event.target.value)}><option value="all">Tất cả đối tượng</option>{Array.from(new Set(facilityActivities.map(item => item.entityType))).map(type => <option key={type} value={type}>{managerEntityLabel(type, 'vi')}</option>)}</Select><Select value={activityRole} onChange={event => setActivityRole(event.target.value)}><option value="all">Tất cả vai trò</option>{Array.from(new Set(facilityActivities.map(item => item.actorRole))).sort().map(role => <option key={role} value={role}>{role}</option>)}</Select><Input aria-label="Từ ngày" type="date" value={activityFrom} onChange={event => setActivityFrom(event.target.value)} /><Input aria-label="Đến ngày" type="date" value={activityTo} onChange={event => setActivityTo(event.target.value)} /></div></div><Table><Thead><tr><Th>{'Thời gian'}</Th><Th>{'Hành động'}</Th><Th>{'Đối tượng'}</Th><Th>{'Người thực hiện'}</Th><Th>{'Dấu vết'}</Th><Th>{'Ghi chú'}</Th><Th /></tr></Thead><Tbody>{visibleActivities.map(activity => { const evidence = activityEvidence(activity); return <Tr key={activity.id}><Td className="text-xs">{activity.timestamp}</Td><Td className="font-mono text-xs font-bold">{managerActivityLabel(activity.action, 'vi')}</Td><Td>{managerEntityLabel(activity.entityType, 'vi')} · {activity.entityId}</Td><Td>{activity.actorName}<p className="text-xs text-stone-400">{activity.actorRole}</p></Td><Td><div className="flex flex-wrap gap-1">{activity.beforeState && <Badge variant="muted">Trước</Badge>}{activity.afterState && <Badge variant="info">Sau</Badge>}{Boolean(evidence.length) && <Badge variant="success">{evidence.length} bằng chứng</Badge>}{activity.correlationId && <Badge variant="warning">Correlation</Badge>}{!activity.beforeState && !activity.afterState && !evidence.length && !activity.correlationId && '—'}</div></Td><Td className="max-w-lg text-xs text-stone-500">{activity.notes || '—'}</Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedActivity(activity)}>Chi tiết</Button></Td></Tr>})}{!visibleActivities.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">Không có hoạt động phù hợp.</td></tr>}</Tbody></Table></Card>
    <Modal open={Boolean(selectedActivity)} onClose={() => setSelectedActivity(null)} title="Chi tiết nhật ký hoạt động" size="lg">{selectedActivity && <div className="space-y-4 text-sm"><div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2"><p><span className="text-stone-500">Hành động</span><br /><b>{managerActivityLabel(selectedActivity.action, 'vi')}</b></p><p><span className="text-stone-500">Thời gian</span><br /><b>{selectedActivity.timestamp}</b></p><p><span className="text-stone-500">Đối tượng</span><br /><b>{managerEntityLabel(selectedActivity.entityType, 'vi')} · {selectedActivity.entityId}</b></p><p><span className="text-stone-500">Người thực hiện</span><br /><b>{selectedActivity.actorName} · {selectedActivity.actorRole}</b></p>{selectedActivity.correlationId && <p><span className="text-stone-500">Correlation ID</span><br /><b className="font-mono">{selectedActivity.correlationId}</b></p>}</div>{selectedActivity.notes && <div><p className="mb-1 font-semibold">Ghi chú</p><p className="rounded-lg border border-stone-200 p-3">{selectedActivity.notes}</p></div>}{(selectedReturn || selectedCheckin || selectedPayment || selectedRental) && <div><p className="mb-1 font-semibold">Dữ liệu nghiệp vụ liên quan</p><div className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-2">{selectedReturn && <><p>Khách hàng: <b>{selectedReturn.customerName}</b></p><p>Trạng thái trả: <b>{managerStatusLabel(selectedReturn.status, 'vi')}</b></p><p>Xác nhận khách: <b>{selectedReturn.customerConfirmed ? selectedReturn.customerDecision === 'disputed' ? 'Không đồng ý' : 'Đã đồng ý' : 'Chưa xác nhận'}</b></p><p>Thanh toán quyết toán: <b>{selectedReturn.settlementPaymentId || 'Chưa có'}</b></p></>}{selectedCheckin && <><p>Khách hàng: <b>{selectedCheckin.customerName}</b></p><p>Staff thực hiện: <b>{selectedCheckin.staffName}</b></p><p>Xác nhận khách: <b>{selectedCheckin.customerConfirmationTimestamp || 'Chưa ghi nhận'}</b></p><p>Sai lệch được chấp nhận: <b>{selectedCheckin.actualMeasurements.varianceAccepted ? 'Có' : 'Không'}</b></p></>}{selectedPayment && <><p>Số tiền: <b>{formatVnd(selectedPayment.amount)}</b></p><p>Trạng thái: <b>{managerStatusLabel(selectedPayment.status, 'vi')}</b></p><p>Phương thức: <b>{selectedPayment.paymentMethod || 'Chưa ghi nhận'}</b></p><p>Mã giao dịch: <b>{selectedPayment.transactionReference || selectedPayment.invoiceNumber || 'Chưa ghi nhận'}</b></p></>}{selectedRental && <><p>Khách hàng: <b>{selectedRental.customerName}</b></p><p>Gian kho: <b>{selectedRental.unitId}</b></p><p>Kỳ thuê: <b>{selectedRental.startDate} – {selectedRental.endDate}</b></p><p>Thanh toán: <b>{managerStatusLabel(selectedRental.paymentStatus, 'vi')}</b></p></>}</div></div>}{selectedActivity.beforeState && <div><p className="mb-1 font-semibold">Trạng thái trước</p><pre className="overflow-auto rounded-lg bg-stone-900 p-3 text-xs text-stone-100">{JSON.stringify(selectedActivity.beforeState, null, 2)}</pre></div>}{selectedActivity.afterState && <div><p className="mb-1 font-semibold">Trạng thái sau</p><pre className="overflow-auto rounded-lg bg-stone-900 p-3 text-xs text-stone-100">{JSON.stringify(selectedActivity.afterState, null, 2)}</pre></div>}{Boolean(selectedEvidence.length) && <div><p className="mb-1 font-semibold">Bằng chứng từ hồ sơ nguồn</p><ul className="space-y-1">{selectedEvidence.map((item, index) => <li key={`${item}-${index}`} className="break-all rounded-lg border border-stone-200 p-2 font-mono text-xs">{item}</li>)}</ul></div>}<div className="flex justify-end"><Button variant="outline" onClick={() => setSelectedActivity(null)}>Đóng</Button></div></div>}</Modal>
  </div>
}
