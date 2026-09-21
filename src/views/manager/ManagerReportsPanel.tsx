import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Card, SectionHeader, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import type { ActivityRecord, RentalRecord, StoragePayment, StorageReservation, StorageUnit } from '../../types/storageHub'
import { managerActivityLabel, managerEntityLabel, managerStatusLabel, managerUnitTypeLabel } from './managerI18n'

interface Props {
  user: User
  units: StorageUnit[]
  reservations: StorageReservation[]
  rentals: RentalRecord[]
  payments: StoragePayment[]
  activities: ActivityRecord[]
  showToast: (message: string) => void
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export default function ManagerReportsPanel({ user, units, reservations, rentals, payments, activities, showToast }: Props) {
  const { lang, formatCurrency } = useLanguage()
  const facilityUnits = useMemo(() => units.filter(unit => !user.facility || user.facility === 'All facilities' || unit.facilityName === user.facility || unit.facilityId === user.facility), [units, user.facility])
  const facilityIds = new Set(facilityUnits.map(unit => unit.facilityId))
  const facilityReservations = reservations.filter(item => facilityIds.has(item.facilityId))
  const facilityRentals = rentals.filter(item => facilityIds.has(item.facilityId))
  const rentalIds = new Set(facilityRentals.map(item => item.id))
  const facilityPayments = payments.filter(item => item.rentalId ? rentalIds.has(item.rentalId) : facilityReservations.some(reservation => reservation.id === item.reservationId))
  const facilityActivities = activities.filter(item => facilityIds.has(item.facilityId))
  const occupied = facilityUnits.filter(unit => unit.status === 'occupied').length
  const occupancy = facilityUnits.length ? Math.round((occupied / facilityUnits.length) * 100) : 0
  const collected = facilityPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + payment.amount, 0)
  const monthlyRecurring = facilityRentals.filter(rental => rental.status === 'active').reduce((sum, rental) => sum + rental.monthlyRate, 0)
  const overdueRentals = facilityRentals.filter(rental => rental.status === 'active' && rental.paymentStatus === 'overdue')
  const unitStatusData = ['available', 'reserved', 'occupied', 'maintenance'].map(status => ({ name: managerStatusLabel(status, lang), value: facilityUnits.filter(unit => unit.status === status).length }))
  const typeData = Array.from(new Set(facilityUnits.map(unit => unit.type))).map(type => ({ type: managerUnitTypeLabel(type, lang), units: facilityUnits.filter(unit => unit.type === type).length, occupied: facilityUnits.filter(unit => unit.type === type && unit.status === 'occupied').length }))
  const colors = ['#10b981', '#e9a12c', '#57534e', '#ef4444']

  const exportCsv = () => {
    const rows = lang === 'vi' ? [
      ['Báo cáo', 'Báo cáo vận hành của Quản lý cơ sở'],
      ['Cơ sở', user.facility || 'Tất cả cơ sở'],
      ['Thời điểm tạo', new Date().toLocaleString('vi-VN')],
      [],
      ['Chỉ số', 'Giá trị'],
      ['Tổng gian kho', facilityUnits.length],
      ['Gian đang sử dụng', occupied],
      ['Tỷ lệ lấp đầy', `${occupancy}%`],
      ['Hợp đồng đang hiệu lực', facilityRentals.filter(item => item.status === 'active').length],
      ['Doanh thu định kỳ hàng tháng', formatCurrency(monthlyRecurring)],
      ['Thanh toán đã thu', formatCurrency(collected)],
      ['Tài khoản quá hạn', overdueRentals.length],
      [],
      ['Gian kho', 'Loại', 'Trạng thái', 'Giá hàng tháng', 'Hợp đồng hiện tại'],
      ...facilityUnits.map(unit => [unit.code, managerUnitTypeLabel(unit.type, lang), managerStatusLabel(unit.status, lang), formatCurrency(unit.price), unit.currentRentalId || ''])
    ] : [
      ['Report', 'Facility Manager Operational Report'],
      ['Facility', user.facility || 'All facilities'],
      ['Generated at', new Date().toISOString()],
      [],
      ['Metric', 'Value'],
      ['Total units', facilityUnits.length],
      ['Occupied units', occupied],
      ['Occupancy rate', `${occupancy}%`],
      ['Active rentals', facilityRentals.filter(item => item.status === 'active').length],
      ['Monthly recurring revenue', formatCurrency(monthlyRecurring)],
      ['Collected payments', formatCurrency(collected)],
      ['Overdue accounts', overdueRentals.length],
      [],
      ['Unit', 'Type', 'Status', 'Monthly price', 'Current rental'],
      ...facilityUnits.map(unit => [unit.code, managerUnitTypeLabel(unit.type, lang), managerStatusLabel(unit.status, lang), formatCurrency(unit.price), unit.currentRentalId || ''])
    ]
    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `facility-report-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast(lang === 'vi' ? 'Đã xuất báo cáo CSV từ dữ liệu hiện tại.' : 'Current facility data exported to CSV.')
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={lang === 'vi' ? 'Phân tích vận hành' : 'Operational analytics'} title={lang === 'vi' ? 'Báo cáo cơ sở' : 'Facility Reports'} subtitle={lang === 'vi' ? 'Số liệu được tính trực tiếp từ tồn kho, hợp đồng thuê và thanh toán hiện tại.' : 'Metrics calculated directly from current inventory, rentals and payments.'} action={<Button variant="outline" onClick={exportCsv}>{lang === 'vi' ? 'Xuất CSV' : 'Export CSV'}</Button>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={lang === 'vi' ? 'Tỷ lệ lấp đầy' : 'Occupancy'} value={`${occupancy}%`} icon={Icon.chart} /><StatCard title={lang === 'vi' ? 'Doanh thu định kỳ' : 'Monthly recurring'} value={formatCurrency(monthlyRecurring)} icon={Icon.dollar} /><StatCard title={lang === 'vi' ? 'Đã thu thực tế' : 'Collected'} value={formatCurrency(collected)} icon={Icon.credit} /><StatCard title={lang === 'vi' ? 'Tài khoản quá hạn' : 'Overdue accounts'} value={overdueRentals.length} icon={Icon.alert} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card className="p-5"><h3 className="mb-4 font-bold">{lang === 'vi' ? 'Phân bổ trạng thái gian kho' : 'Unit status distribution'}</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={unitStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>{unitStatusData.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="grid grid-cols-2 gap-2 text-xs">{unitStatusData.map((entry, index) => <div key={entry.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index] }} /><span className="flex-1 capitalize text-stone-500">{entry.name}</span><b>{entry.value}</b></div>)}</div></Card><Card className="p-5"><h3 className="mb-4 font-bold">{lang === 'vi' ? 'Công suất theo loại kho' : 'Capacity by unit type'}</h3><ResponsiveContainer width="100%" height={270}><BarChart data={typeData}><CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" /><XAxis dataKey="type" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="units" fill="#d6d3d1" name={lang === 'vi' ? 'Tổng số' : 'Total'} radius={[4, 4, 0, 0]} /><Bar dataKey="occupied" fill="#e9a12c" name={lang === 'vi' ? 'Đang sử dụng' : 'Occupied'} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Card></div>
    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold">{lang === 'vi' ? 'Hoạt động quản lý gần đây' : 'Recent manager operations'}</h3></div><Table><Thead><tr><Th>{lang === 'vi' ? 'Thời gian' : 'Time'}</Th><Th>{lang === 'vi' ? 'Hành động' : 'Action'}</Th><Th>{lang === 'vi' ? 'Đối tượng' : 'Entity'}</Th><Th>{lang === 'vi' ? 'Người thực hiện' : 'Actor'}</Th><Th>{lang === 'vi' ? 'Tóm tắt' : 'Summary'}</Th></tr></Thead><Tbody>{facilityActivities.slice(0, 15).map(activity => <Tr key={activity.id}><Td className="text-xs">{activity.timestamp}</Td><Td className="text-xs font-bold">{managerActivityLabel(activity.action, lang)}</Td><Td>{managerEntityLabel(activity.entityType, lang)} · {activity.entityId}</Td><Td>{activity.actorName}</Td><Td className="max-w-lg text-xs text-stone-500">{managerActivityLabel(activity.action, lang)}</Td></Tr>)}</Tbody></Table></Card>
  </div>
}
