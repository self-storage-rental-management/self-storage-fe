import { useState } from "react"
import { Button } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { RentalApiRecord } from "../../types/rentalApi"
import {
  rentalDataWarning,
  rentalDate,
  rentalLabels,
  rentalPeriodText,
} from "../rental-api/presentation"
import { managerDisplayError } from "./managerPresentation"
import RentalHandoverFiles from '../rental-api/RentalHandoverFiles'
import InventoryRentalPayments from './InventoryRentalPayments'
import type { InventoryUnit } from "./managerInventoryApi"
import {
  currentInventoryRentals,
  isInventoryDateRange,
  loadInventoryAvailability,
  loadInventoryMaintenance,
  type InventoryDateRange,
} from "./managerInventoryDetailsApi"

export interface InventorySourceRead<T> {
  loading: boolean
  data?: T
  error?: unknown
  refresh?: () => void
}
function ReadFailure({ error, retry }: {
  error: unknown
  retry?: () => void
}) {
  return (
    <div role="alert" className="space-y-2 text-sm text-red-700">
      <p>{managerDisplayError(error)}</p>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  )
}

export function InventoryRentalSummary({
  unit,
  read,
  detailed = false,
}: {
  unit: InventoryUnit
  read: InventorySourceRead<RentalApiRecord[]>
  detailed?: boolean
}) {
  if (read.loading) return <p role="status">Đang tải hồ sơ thuê...</p>
  if (read.error) return <ReadFailure error={read.error} retry={read.refresh} />
  if (!read.data) return <p role="status">Chưa xác minh được hồ sơ thuê.</p>
  let rentals: RentalApiRecord[]
  try {
    rentals = currentInventoryRentals(unit, read.data)
  } catch (error) {
    return <ReadFailure error={error} retry={read.refresh} />
  }
  if (!rentals.length) {
    const message =
      unit.status === "occupied"
        ? "Gian đang sử dụng nhưng chưa tìm thấy hồ sơ thuê chưa kết thúc."
        : "Không có hồ sơ thuê chưa kết thúc."
    return (
      <p
        role="status"
        className="line-clamp-2 text-sm leading-5 text-stone-600"
        title={message}
      >
        {message}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {rentals.length > 1 && (
        <p role="alert" className="text-amber-800">
          Có nhiều hồ sơ thuê chưa kết thúc. Cần đối chiếu người đang sử dụng
          gian kho.
        </p>
      )}
      {unit.status === "available" && (
        <p role="alert" className="text-amber-800">
          Gian còn trống nhưng có hồ sơ thuê chưa kết thúc. Cần đối chiếu trạng
          thái.
        </p>
      )}
      {rentals.map((r) => (
        <div key={r.id}>
          <p className="font-semibold">{r.customer.fullName}</p>
          <p className="break-all text-xs text-stone-500">Hồ sơ thuê: {r.id}</p>
          <p className="text-xs text-stone-500">{rentalLabels[r.status]}</p>
          {detailed && (
            <p className="text-xs text-stone-500">
              Kỳ thuê: {rentalPeriodText(r)}
            </p>
          )}
          {r.dataWarnings.map((warning, index) => (
            <p
              key={`${warning.field}:${index}`}
              className="text-xs text-amber-800"
            >
              {rentalDataWarning(warning.field)}
            </p>
          ))}
          {detailed && <div className="mt-4 space-y-4">
            <RentalHandoverFiles key={`contract:${r.id}`} role="manager" id={r.id} contractsOnly />
            <InventoryRentalPayments key={`payments:${r.id}`} id={r.id} />
          </div>}
        </div>
      ))}
    </div>
  )
}

const maintenanceLabels = {
  open: "Chờ xử lý",
  in_progress: "Đang thực hiện",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
}
export function InventoryMaintenanceDetails({
  unit,
  identity,
}: {
  unit: InventoryUnit
  identity: string
}) {
  const read = useRentalApiResource(`${identity}:maintenance:${unit.id}`, () =>
    loadInventoryMaintenance(unit),
  )
  return (
    <section className="space-y-3 border-t border-stone-200 pt-4">
      <h3 className="font-bold">Trạng thái bảo trì</h3>
      {read.loading ? (
        <p role="status">Đang tải trạng thái bảo trì...</p>
      ) : read.error ? (
        <ReadFailure error={read.error} retry={read.refresh} />
      ) : !read.data ? (
        <p role="status">Không có dữ liệu</p>
      ) : read.data.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
        <ul className="space-y-3">
          {read.data.map((t) => (
            <li key={t.id} className="rounded-lg border border-stone-200 p-3">
              <p className="font-semibold">{t.title}</p>
              <p>Trạng thái: {maintenanceLabels[t.status]}</p>
              <p>{t.reason}</p>
              <p>Người phụ trách: {t.assignedStaffName || "Chưa phân công"}</p>
              {t.dueAt && <p>Hạn xử lý: {rentalDate(t.dueAt)}</p>}
              <p>Tạo lúc: {rentalDate(t.createdAt)}</p>
              {t.completedAt && (
                <p>Hoàn thành lúc: {rentalDate(t.completedAt)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function InventoryAvailabilityDetails({
  unit,
  identity,
}: {
  unit: InventoryUnit
  identity: string
}) {
  const [range, setRange] = useState<InventoryDateRange>({
    startDate: "",
    endDate: "",
  })
  const [submitted, setSubmitted] = useState<InventoryDateRange>()
  const [revision, setRevision] = useState(0)
  const [invalid, setInvalid] = useState(false)
  return (
    <section className="space-y-3 border-t border-stone-200 pt-4">
      <h3 className="font-bold">Kiểm tra khả dụng theo loại gian kho</h3>
      <p className="text-xs text-stone-500">
        Kết quả là số gian cùng loại còn khả dụng tại cơ sở, không phải lịch
        riêng của gian này hoặc xác nhận giữ chỗ.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!isInventoryDateRange(range)) {
            setInvalid(true)
            return
          }
          setInvalid(false)
          setSubmitted({ ...range })
          setRevision((v) => v + 1)
        }}
      >
        <label className="block">
          Từ ngày
          <input
            type="date"
            required
            value={range.startDate}
            className="mt-1 block rounded-lg border border-stone-300 p-2"
            onChange={(e) => {
              setRange((r) => ({ ...r, startDate: e.target.value }))
              setInvalid(false)
            }}
          />
        </label>
        <label className="block">
          Đến ngày
          <input
            type="date"
            required
            value={range.endDate}
            className="mt-1 block rounded-lg border border-stone-300 p-2"
            onChange={(e) => {
              setRange((r) => ({ ...r, endDate: e.target.value }))
              setInvalid(false)
            }}
          />
        </label>
        <Button type="submit" size="sm">
          Kiểm tra khả dụng
        </Button>
      </form>
      {invalid && (
        <p role="alert" className="text-red-700">
          Ngày kết thúc phải sau ngày bắt đầu.
        </p>
      )}
      {submitted && (
        <InventoryAvailabilityResult
          key={`${identity}:${unit.id}:${revision}`}
          unit={unit}
          identity={`${identity}:availability:${unit.id}:${submitted.startDate}:${submitted.endDate}:${revision}`}
          range={submitted}
        />
      )}
    </section>
  )
}

export function InventoryAvailabilityResult({
  unit,
  identity,
  range,
}: {
  unit: InventoryUnit
  identity: string
  range: InventoryDateRange
}) {
  const read = useRentalApiResource(identity, () =>
    loadInventoryAvailability(unit, range),
  )
  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">
        Khoảng ngày đã kiểm tra: {rentalDate(range.startDate)} -{" "}
        {rentalDate(range.endDate)}
      </p>
      {read.loading ? (
        <p role="status">Đang kiểm tra khả dụng...</p>
      ) : read.error ? (
        <ReadFailure error={read.error} retry={read.refresh} />
      ) : !read.data ? (
        <p role="status">Chưa xác minh được khả dụng.</p>
      ) : (
        <p role="status">
          {read.data.availableCount > 0
            ? `Còn ${read.data.availableCount} gian cùng loại khả dụng trong khoảng ngày đã kiểm tra.`
            : "Không còn gian cùng loại khả dụng trong khoảng ngày đã kiểm tra."}
        </p>
      )}
    </div>
  )
}
