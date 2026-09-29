import { useMemo } from "react"
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  SectionHeader,
  StatCard,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "../../components/ui"
import { Icon } from "../../components/Layout"
import { formatVnd } from "../../i18n/currency"
import { useStorageHub } from "../../store/StorageHubContext"
import type { User } from "../../types"
import { isManagerFacilityVisible, isManagerRentalOverdue, parseManagerActivityTimestamp } from "../../domain/managerRules"
import {
  managerActivityLabel,
  managerEntityLabel,
  managerStatusLabel,
  managerUnitTypeLabel,
} from "./managerI18n"

interface Props {
  user: User
  setPage: (page: string) => void
}

interface ScheduleItem {
  id: string
  date: string
  time?: string
  title: string
  detail: string
  status: string
  page: string
  variant: string
}

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return localDateKey(result)
}

const datePart = (value?: string) =>
  value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ""

const formatDate = (value: string) => {
  const key = datePart(value)
  if (!key) return "Chưa xác định"
  return new Date(`${key}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
}

const formatActivityTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Chưa xác định"
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ManagerDashboardPanel({ user, setPage }: Props) {
  const {
    units,
    holds,
    rentals,
    checkins,
    returns,
    payments,
    renewals,
    maintenanceTasks,
    staffTasks,
    activities,
  } = useStorageHub()

  const today = localDateKey()
  const sevenDaysFromNow = addDays(new Date(), 7)
  const currentMonth = today.slice(0, 7)

  const facilityUnits = units.filter((unit) =>
    isManagerFacilityVisible(user, unit.facilityId, unit.facilityName),
  )
  const facilityHolds = holds.filter((item) =>
    isManagerFacilityVisible(user, item.facilityId, item.facilityName),
  )
  const facilityRentals = rentals.filter((item) =>
    isManagerFacilityVisible(user, item.facilityId, item.facilityName),
  )
  const facilityCheckins = checkins.filter((item) => {
    const unit = units.find((candidate) => candidate.id === item.unitId)
    return isManagerFacilityVisible(user, item.facilityId || unit?.facilityId, unit?.facilityName)
  })
  const facilityReturns = returns.filter((item) =>
    isManagerFacilityVisible(user, item.facilityId, item.facilityName),
  )
  const facilityRenewals = renewals.filter((item) => {
    const rental = rentals.find((candidate) => candidate.id === item.rentalId)
    return isManagerFacilityVisible(user, item.facilityId || rental?.facilityId, rental?.facilityName)
  })
  const facilityMaintenance = maintenanceTasks.filter((task) => {
    const unit = units.find((candidate) => candidate.id === task.unitId)
    return isManagerFacilityVisible(user, task.facilityId, unit?.facilityName)
  })
  const facilityTasks = staffTasks.filter((task) =>
    isManagerFacilityVisible(user, task.facilityId, task.facilityName),
  )
  const facilityActivities = activities.filter((activity) =>
    isManagerFacilityVisible(user, activity.facilityId),
  )

  const rentalIds = new Set(facilityRentals.map((item) => item.id))
  const reservationIds = new Set(facilityHolds.map((item) => item.id))
  const renewalIds = new Set(facilityRenewals.map((item) => item.id))
  const facilityPayments = payments.filter((payment) => {
    if (payment.rentalId && rentalIds.has(payment.rentalId)) return true
    if (payment.renewalId && renewalIds.has(payment.renewalId)) return true
    return reservationIds.has(payment.reservationId)
  })

  const activeRentals = facilityRentals.filter(
    (item) => item.status === "active",
  )
  const overdueRentals = activeRentals.filter(
    (item) => isManagerRentalOverdue(item),
  )
  const occupied = facilityUnits.filter(
    (item) => item.status === "occupied",
  ).length
  const available = facilityUnits.filter(
    (item) => item.status === "available",
  ).length
  const reserved = facilityUnits.filter((item) =>
    ["reserved", "held", "assigned"].includes(item.status),
  ).length
  const maintenanceUnits = facilityUnits.filter(
    (item) => item.status === "maintenance",
  ).length
  const occupancy = facilityUnits.length
    ? Math.round((occupied / facilityUnits.length) * 100)
    : 0
  const monthlyExpectedRent = activeRentals.reduce(
    (sum, item) => sum + item.monthlyRate,
    0,
  )

  const paidThisMonth = facilityPayments.filter((payment) => {
    const paymentDate = datePart(payment.paidAt || payment.receivedAt)
    return payment.status === "PAID" && paymentDate.startsWith(currentMonth)
  })
  const collectedThisMonth = paidThisMonth
    .filter((payment) => payment.type !== "REFUND")
    .reduce((sum, payment) => sum + payment.amount, 0)
  const refundedThisMonth = paidThisMonth
    .filter((payment) => payment.type === "REFUND")
    .reduce((sum, payment) => sum + payment.amount, 0)
  const pendingPaymentCount = facilityPayments.filter(
    (payment) => payment.status === "PENDING",
  ).length
  const recordedLateFees = overdueRentals.reduce(
    (sum, rental) => sum + (rental.lateFeeAmount || 0),
    0,
  )

  const disputedReturns = facilityReturns.filter(
    (item) => item.status === "disputed",
  )
  const pendingRenewals = facilityRenewals.filter(
    (item) => item.status === "pending",
  )
  const openMaintenance = facilityMaintenance.filter(
    (item) => item.status !== "completed",
  )
  const openTasks = facilityTasks.filter((item) => item.status !== "completed")
  const overdueTasks = openTasks.filter(
    (item) => datePart(item.dueAt) && datePart(item.dueAt) < today,
  )
  const unassignedTasks = openTasks.filter((item) => !item.assignedStaffId)
  const priorityItems = [
    {
      label: "Khiếu nại quyết toán trả kho",
      count: disputedReturns.length,
      detail: disputedReturns.length
        ? "Cần xem xét phương án quyết toán"
        : "Không có khiếu nại đang chờ",
      page: "moves",
      variant: "error",
    },
    {
      label: "Hợp đồng thanh toán quá hạn",
      count: overdueRentals.length,
      detail: overdueRentals.length
        ? "Cần thu tiền hoặc xử lý quyền truy cập"
        : "Không có hợp đồng quá hạn",
      page: "payments",
      variant: "error",
    },
    {
      label: "Nhiệm vụ đã quá hạn",
      count: overdueTasks.length,
      detail: overdueTasks.length
        ? "Cần điều phối nhân viên xử lý"
        : "Không có nhiệm vụ quá hạn",
      page: "staff-tasks",
      variant: "error",
    },
    {
      label: "Yêu cầu gia hạn chờ duyệt",
      count: pendingRenewals.length,
      detail: pendingRenewals.length
        ? "Cần xem xét thời hạn mới"
        : "Không có yêu cầu chờ duyệt",
      page: "rentals",
      variant: "info",
    },
    {
      label: "Gian kho đang bảo trì",
      count: openMaintenance.length,
      detail: openMaintenance.length
        ? "Cần theo dõi sửa chữa và nghiệm thu"
        : "Không có gian kho chờ bảo trì",
      page: "inventory",
      variant: "info",
    },
  ].sort((left, right) => Number(right.count > 0) - Number(left.count > 0))

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const inRange = (value?: string) => {
      const key = datePart(value)
      return Boolean(key && key >= today && key <= sevenDaysFromNow)
    }

    const checkinItems: ScheduleItem[] = facilityCheckins
      .filter(
        (item) => item.status === "scheduled" && inRange(item.scheduledDate),
      )
      .map((item) => ({
        id: `nhan-kho-${item.id}`,
        date: item.scheduledDate,
        time: item.scheduledTime,
        title: "Nhận kho",
        detail: `${item.customerName} · Gian ${item.unitId}`,
        status: item.status,
        page: "moves",
        variant: "info",
      }))

    const returnItems: ScheduleItem[] = facilityReturns
      .filter(
        (item) => item.status !== "completed" && inRange(item.scheduledDate),
      )
      .map((item) => ({
        id: `tra-kho-${item.id}`,
        date: item.scheduledDate,
        title: "Trả kho",
        detail: `${item.customerName} · Gian ${item.unitId}`,
        status: item.status,
        page: "moves",
        variant: item.status === "disputed" ? "error" : "warning",
      }))

    const taskItems: ScheduleItem[] = openTasks
      .filter((item) => inRange(item.dueAt))
      .map((item) => ({
        id: `nhiem-vu-${item.id}`,
        date: item.dueAt,
        title: "Nhiệm vụ cơ sở",
        detail: `Hạn hoàn thành · ${item.assignedStaffName || "Chưa phân công"}`,
        status: item.status,
        page: "staff-tasks",
        variant:
          item.priority === "high"
            ? "error"
            : item.priority === "medium"
              ? "warning"
              : "info",
      }))

    const renewalItems: ScheduleItem[] = facilityRenewals
      .filter(
        (item) =>
          item.status === "appointment_scheduled" &&
          inRange(item.appointmentDate),
      )
      .map((item) => ({
        id: `gia-han-${item.id}`,
        date: item.appointmentDate || "",
        time: item.appointmentTime,
        title: "Ký gia hạn",
        detail: `${item.customerName} · Gian ${item.unitId}`,
        status: item.status,
        page: "rentals",
        variant: "info",
      }))

    return [...checkinItems, ...returnItems, ...taskItems, ...renewalItems]
      .sort((left, right) =>
        `${datePart(left.date)} ${left.time || ""}`.localeCompare(
          `${datePart(right.date)} ${right.time || ""}`,
        ),
      )
      .slice(0, 8)
  }, [
    facilityCheckins,
    facilityReturns,
    facilityRenewals,
    openTasks,
    sevenDaysFromNow,
    today,
  ])

  const capacityByType = useMemo(() => {
    const groups = new Map<string, typeof facilityUnits>()
    facilityUnits.forEach((unit) => {
      const current = groups.get(unit.type) || []
      current.push(unit)
      groups.set(unit.type, current)
    })
    return Array.from(groups.entries()).map(([type, typeUnits]) => {
      const used = typeUnits.filter((unit) => unit.status === "occupied").length
      return {
        type: managerUnitTypeLabel(type, "vi"),
        total: typeUnits.length,
        used,
        available: typeUnits.filter((unit) => unit.status === "available")
          .length,
        reserved: typeUnits.filter((unit) =>
          ["reserved", "held", "assigned"].includes(unit.status),
        ).length,
        maintenance: typeUnits.filter((unit) => unit.status === "maintenance")
          .length,
        occupancy: typeUnits.length
          ? Math.round((used / typeUnits.length) * 100)
          : 0,
      }
    })
  }, [facilityUnits])

  const recentActivities = [...facilityActivities]
    .sort(
      (left, right) =>
        parseManagerActivityTimestamp(right.timestamp) -
        parseManagerActivityTimestamp(left.timestamp),
    )
    .slice(0, 6)

  const displayFacility =
    user.facility === "All facilities"
      ? "Tất cả cơ sở"
      : user.facility || facilityUnits[0]?.facilityName || "Chưa gán cơ sở"

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        eyebrow="Tổng quan cơ sở"
        title="Tình hình vận hành"
        subtitle={`${displayFacility} · Số liệu được tổng hợp từ dữ liệu hiện có`}
        action={
          <Button variant="outline" onClick={() => setPage("reports")}>
            Mở báo cáo chi tiết
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Tổng gian kho"
          value={facilityUnits.length}
          icon={Icon.box}
        />
        <StatCard
          title="Tỷ lệ lấp đầy"
          value={`${occupancy}%`}
          icon={Icon.chart}
        />
        <StatCard
          title="Hợp đồng hiệu lực"
          value={activeRentals.length}
          icon={Icon.policy}
        />
        <StatCard
          title="Tiền thuê dự kiến mỗi tháng"
          value={formatVnd(monthlyExpectedRent)}
          icon={Icon.dollar}
        />
        <StatCard
          title="Đã thu trong tháng"
          value={formatVnd(collectedThisMonth)}
          icon={Icon.credit}
        />
        <StatCard
          title="Hợp đồng quá hạn"
          value={overdueRentals.length}
          icon={Icon.alert}
        />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-stone-900">Công suất cơ sở</h2>
            <p className="mt-1 text-xs text-stone-500">
              Tính trên toàn bộ gian kho thuộc phạm vi quản lý
            </p>
          </div>
          <b className="text-lg">
            {occupied}/{facilityUnits.length} gian đang sử dụng
          </b>
        </div>
        <ProgressBar value={occupied} max={Math.max(1, facilityUnits.length)} />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-3">
            <span className="text-emerald-700">Còn trống</span>
            <b className="mt-1 block text-xl text-emerald-900">{available}</b>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <span className="text-amber-700">Đã giữ hoặc phân gian</span>
            <b className="mt-1 block text-xl text-amber-900">{reserved}</b>
          </div>
          <div className="rounded-lg bg-stone-100 p-3">
            <span className="text-stone-600">Đang sử dụng</span>
            <b className="mt-1 block text-xl text-stone-900">{occupied}</b>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <span className="text-red-700">Đang bảo trì</span>
            <b className="mt-1 block text-xl text-red-900">
              {maintenanceUnits}
            </b>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Theo mức độ ưu tiên
            </p>
            <h2 className="mt-1 text-lg font-bold text-stone-900">
              Việc cần xử lý
            </h2>
          </div>
          <span className="text-xs text-stone-500">
            Chỉ sử dụng hồ sơ thuộc cơ sở đang quản lý
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {priorityItems.map((item) => (
            <Card
              key={item.label}
              className={`p-4 ${item.count ? "border-amber-300" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-stone-900">{item.label}</p>
                  <p className="mt-2 text-2xl font-extrabold">{item.count}</p>
                </div>
                <Badge variant={item.count ? item.variant : "success"}>
                  {item.count ? "Cần xử lý" : "Ổn định"}
                </Badge>
              </div>
              <p className="mt-2 min-h-8 text-xs text-stone-500">
                {item.detail}
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={() => setPage(item.page)}
              >
                Mở danh sách
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-stone-200 p-4">
            <div>
              <h2 className="font-bold text-stone-900">
                Lịch vận hành trong bảy ngày
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Nhận kho, trả kho, ký gia hạn và nhiệm vụ đến hạn
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage("moves")}
            >
              Xem lịch vận hành
            </Button>
          </div>
          {scheduleItems.length ? (
            <div className="divide-y divide-stone-100">
              {scheduleItems.map((item) => (
                <button
                  key={item.id}
                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-stone-50"
                  onClick={() => setPage(item.page)}
                >
                  <div className="w-24 flex-shrink-0">
                    <p className="text-sm font-bold text-stone-900">
                      {formatDate(item.date)}
                    </p>
                    <p className="text-xs text-stone-500">
                      {item.time || "Cả ngày"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{item.title}</p>
                    <p className="truncate text-xs text-stone-500">
                      {item.detail}
                    </p>
                  </div>
                  <Badge variant={item.variant}>
                    {managerStatusLabel(item.status, "vi")}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-stone-500">
              Không có lịch vận hành trong bảy ngày tới.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-stone-900">
                Tình hình tài chính tháng này
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Tổng hợp từ các khoản thanh toán đã ghi nhận
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage("payments")}
            >
              Xem thanh toán
            </Button>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
              <span>Đã thu trong tháng</span>
              <b className="text-emerald-800">
                {formatVnd(collectedThisMonth)}
              </b>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-stone-50 p-3">
              <span>Đã hoàn trong tháng</span>
              <b>{formatVnd(refundedThisMonth)}</b>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-stone-50 p-3">
              <span>Khoản đang chờ thanh toán</span>
              <b>{pendingPaymentCount}</b>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
              <span>Phí trễ đã ghi nhận</span>
              <b className="text-red-700">{formatVnd(recordedLateFees)}</b>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
              <span>Tiền thuê dự kiến mỗi tháng</span>
              <b className="text-amber-800">{formatVnd(monthlyExpectedRent)}</b>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-stone-200 p-4">
            <div>
              <h2 className="font-bold text-stone-900">
                Công suất theo loại gian kho
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Số liệu được tính trực tiếp từ danh sách gian kho
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage("inventory")}
            >
              Xem tồn kho
            </Button>
          </div>
          <Table>
            <Thead>
              <tr>
                <Th>Loại gian kho</Th>
                <Th>Tổng số</Th>
                <Th>Đang dùng</Th>
                <Th>Còn trống</Th>
                <Th>Đã giữ</Th>
                <Th>Bảo trì</Th>
                <Th>Lấp đầy</Th>
              </tr>
            </Thead>
            <Tbody>
              {capacityByType.map((item) => (
                <Tr key={item.type}>
                  <Td className="font-semibold text-stone-900">{item.type}</Td>
                  <Td>{item.total}</Td>
                  <Td>{item.used}</Td>
                  <Td>{item.available}</Td>
                  <Td>{item.reserved}</Td>
                  <Td>{item.maintenance}</Td>
                  <Td>
                    <div className="min-w-24">
                      <div className="mb-1 text-xs">{item.occupancy}%</div>
                      <ProgressBar value={item.occupancy} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {!capacityByType.length && (
            <p className="p-8 text-center text-sm text-stone-500">
              Chưa có dữ liệu gian kho tại cơ sở này.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-stone-900">Nhiệm vụ nhân viên</h2>
              <p className="mt-1 text-xs text-stone-500">
                Tình trạng điều phối công việc tại cơ sở
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage("staff-tasks")}
            >
              Xem nhiệm vụ
            </Button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="text-xs text-stone-500">Đang mở</p>
              <b className="mt-1 block text-2xl">{openTasks.length}</b>
            </div>
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-xs text-red-700">Đã quá hạn</p>
              <b className="mt-1 block text-2xl text-red-800">
                {overdueTasks.length}
              </b>
            </div>
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs text-amber-700">Chưa phân công</p>
              <b className="mt-1 block text-2xl text-amber-800">
                {unassignedTasks.length}
              </b>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="text-xs text-stone-500">Ưu tiên cao</p>
              <b className="mt-1 block text-2xl">
                {openTasks.filter((item) => item.priority === "high").length}
              </b>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <div>
            <h2 className="font-bold text-stone-900">
              Hoạt động quản lý gần đây
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Nhật ký thay đổi thuộc cơ sở đang quản lý
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage("reports")}
          >
            Xem báo cáo
          </Button>
        </div>
        {recentActivities.length ? (
          <Table>
            <Thead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Hoạt động</Th>
                <Th>Đối tượng</Th>
                <Th>Người thực hiện</Th>
              </tr>
            </Thead>
            <Tbody>
              {recentActivities.map((activity) => (
                <Tr key={activity.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {formatActivityTime(activity.timestamp)}
                  </Td>
                  <Td className="font-semibold text-stone-900">
                    {managerActivityLabel(activity.action, "vi")}
                  </Td>
                  <Td>
                    {managerEntityLabel(activity.entityType, "vi")} ·{" "}
                    <span className="font-mono text-xs">
                      {activity.entityId}
                    </span>
                  </Td>
                  <Td>{activity.actorName}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <p className="p-8 text-center text-sm text-stone-500">
            Chưa có hoạt động nào được ghi nhận tại cơ sở này.
          </p>
        )}
      </Card>
    </div>
  )
}
