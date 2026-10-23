import { useEffect, useState } from "react"

import { Badge, Button, Card, Input, SectionHeader, Select } from "../../components/ui"

import {
  decideStaffReservationReview,
  downloadStaffReservationGoodsImage,
  listStaffActiveReservations,
  listStaffReservationReviews,
  type ReservationReview,
  type StaffReservationProgress,
} from "../../services/staffReservationApi"
import type { ReservationStatus } from "../../services/customerReservationApi"

import {
  formatStaffDateTime,
  formatStaffDate,
  staffErrorMessage,
  staffGoodsCategoryLabel,
} from "./staffPresentation"

const activeStatusLabels: Partial<Record<ReservationStatus, string>> = {
  AWAITING_EMAIL: "Chờ xác minh email",
  AWAITING_REVIEW: "Chờ duyệt hàng hóa",
  AWAITING_PAYMENT: "Chờ thanh toán cọc",
  PAYMENT_GRACE: "Chờ đối soát thanh toán",
  PAYMENT_REVIEW: "Đang duyệt khiếu nại thanh toán",
  CONFIRMED: "Đã thanh toán · Chờ phân gian",
  UNIT_RESERVED: "Đã phân gian kho",
  READY_FOR_CHECKIN: "Sẵn sàng nhận kho",
  AWAITING_CUSTOMER_RECEIPT: "Chờ khách xác nhận bàn giao",
  COMPLETED: "Đã hoàn tất bàn giao",
}

const progressSteps = ["Xác minh email", "Duyệt hồ sơ", "Thanh toán cọc", "Phân gian", "Nhận kho", "Bàn giao"]

function progressIndex(status: ReservationStatus) {
  if (status === "AWAITING_EMAIL") return 0
  if (status === "AWAITING_REVIEW") return 1
  if (["AWAITING_PAYMENT", "PAYMENT_GRACE", "PAYMENT_REVIEW"].includes(status)) return 2
  if (status === "CONFIRMED") return 3
  if (["UNIT_RESERVED", "READY_FOR_CHECKIN"].includes(status)) return 4
  if (status === "AWAITING_CUSTOMER_RECEIPT" || status === "COMPLETED") return 5
  return 0
}

export default function StaffReservationReviews({
  canApprove,
  facilityNames = {},
}: {
  canApprove: boolean
  facilityNames?: Record<string, string>
}) {
  const [rows, setRows] = useState<ReservationReview[]>([])

  const [page, setPage] = useState(0)

  const [totalPages, setTotalPages] = useState(0)

  const [revision, setRevision] = useState(0)

  const [loading, setLoading] = useState(true)

  const [busyId, setBusyId] = useState<string | null>(null)

  const [notes, setNotes] = useState<Record<string, string>>({})

  const [message, setMessage] = useState<string | null>(null)

  const [activeRows, setActiveRows] = useState<StaffReservationProgress[]>([])
  const [activePage, setActivePage] = useState(0)
  const [activeTotalPages, setActiveTotalPages] = useState(0)
  const [activeTotalItems, setActiveTotalItems] = useState(0)
  const [activeLoading, setActiveLoading] = useState(true)
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ReservationStatus | "">("")

  useEffect(() => {
    let disposed = false

    const load = async () => {
      setLoading(true)

      try {
        const result = await listStaffReservationReviews(page)

        if (!disposed) {
          setRows(result.data)
          setTotalPages(result.pagination.totalPages)
        }
      } catch (error) {
        if (!disposed)
          setMessage(
            staffErrorMessage(error, "Không thể tải hồ sơ chờ duyệt."),
          )
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void load()

    const timer = window.setInterval(() => void load(), 30_000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [page, revision])

  useEffect(() => {
    let disposed = false
    const load = async () => {
      setActiveLoading(true)
      try {
        const result = await listStaffActiveReservations({ page: activePage, size: 10, q: query, status })
        if (!disposed) {
          setActiveRows(result.data)
          setActiveTotalPages(result.pagination.totalPages)
          setActiveTotalItems(result.pagination.totalItems)
        }
      } catch (error) {
        if (!disposed) setMessage(staffErrorMessage(error, "Không thể tải danh sách đơn đang giữ kho."))
      } finally {
        if (!disposed) setActiveLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 10_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [activePage, query, revision, status])

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener("storagehub:staff-reservations-refresh", refresh)
    return () => window.removeEventListener("storagehub:staff-reservations-refresh", refresh)
  }, [])

  const viewGoodsImage = async (fileId: string) => {
    const preview = window.open("", "_blank")
    if (preview) preview.opener = null
    try {
      const file = await downloadStaffReservationGoodsImage(fileId)
      const url = URL.createObjectURL(file.blob)
      if (preview) preview.location.href = url
      else window.open(url, "_blank", "noopener,noreferrer")
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      preview?.close()
      setMessage(staffErrorMessage(error, "Không thể mở ảnh hàng hóa."))
    }
  }

  const decide = async (
    row: ReservationReview,
    decision: "APPROVE" | "REJECT",
  ) => {
    if (busyId || !canApprove) return

    setBusyId(row.reservationId)

    setMessage(null)

    try {
      await decideStaffReservationReview(
        row.reservationId,
        decision,
        notes[row.reservationId] || "",
      )

      setMessage(
        decision === "APPROVE"
          ? `${row.reservationCode} đã được chấp thuận. Khách hàng có thể thanh toán cọc.`
          : `${row.reservationCode} đã bị từ chối và suất kho đã được giải phóng.`,
      )

      setRows((current) =>
        current.filter((item) => item.reservationId !== row.reservationId),
      )

      setRevision((value) => value + 1)
    } catch (error) {
      setMessage(staffErrorMessage(error, "Không thể duyệt hồ sơ."))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fade-in space-y-4">
      <SectionHeader
        title="Đơn đặt giữ kho"
        subtitle={`Hồ sơ hàng hóa đã xác minh thư điện tử tại: ${Object.values(facilityNames).join(", ") || "cơ sở được phân quyền"}.`}
        action={
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            Làm mới
          </Button>
        }
      />
      {message && (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          {message}
        </p>
      )}
      {loading && <p className="text-sm text-stone-500">Đang tải hồ sơ…</p>}
      {!loading && !rows.length && (
        <Card className="p-8 text-center text-stone-500">
          Chưa có hồ sơ chờ duyệt tại cơ sở của bạn. Khách hàng cần xác minh thư
          điện tử trước khi hồ sơ xuất hiện.
        </Card>
      )}
      {rows.map((row) => (
        <Card
          key={row.reservationId}
          className="space-y-4 border-l-4 border-l-amber-500 p-5"
        >
          <div>
            <p className="text-xs font-bold text-amber-700">
              {row.reservationCode}
            </p>
            <h3 className="mt-1 font-bold">{row.customerEmail}</h3>
            <p className="text-xs font-semibold text-stone-700">
              Cơ sở: {facilityNames[row.facilityId] || row.facilityId}
            </p>
            <p className="text-xs text-stone-500">
              Kỳ thuê: {formatStaffDate(row.startDate)} →{" "}
              {formatStaffDate(row.endDate)}
            </p>
            <p className="text-xs text-stone-500">
              Hạn duyệt:{" "}
              {row.reviewDueAt
                ? new Date(row.reviewDueAt).toLocaleString("vi-VN")
                : "Chưa xác định"}
            </p>
          </div>
          <p className="text-sm">
            <b>Tình trạng đóng gói:</b> {row.goodsCondition || "—"}
          </p>
          {row.reservationNotes && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><b>Ghi chú của khách hàng:</b> {row.reservationNotes}</p>}
          {row.goodsItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"
            >
              <p className="font-bold">
                {item.customGoodsName || staffGoodsCategoryLabel(item.category)}
              </p>
              <p>Mô tả: {item.description || "Không có"}</p>
              <p>
                Chất liệu:{" "}
                {item.customMaterial || item.materialName || "Không có"}
              </p>
              <p>Số lượng: {item.quantity} kiện</p>
              <p>
                Kích thước mỗi kiện: {item.lengthCm} × {item.widthCm} ×{" "}
                {item.heightCm} cm
              </p>
              <p>
                Khối lượng: {item.weightPerItemKg} kg/kiện · tổng{" "}
                {(item.quantity * item.weightPerItemKg).toLocaleString("vi-VN")}{" "}
                kg
              </p>
              <p>Hàng dễ bể / dễ vỡ: {item.fragile ? "Có" : "Không"}</p>
              {item.customerNote && (
                <p>Ghi chú của khách hàng: {item.customerNote}</p>
              )}
              {item.images?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
                {item.images.map((image, index) => <Button key={image.id} type="button" size="sm" variant="outline" onClick={() => void viewGoodsImage(image.id)}>
                  Xem ảnh {index + 1}: {image.originalName}
                </Button>)}
              </div>}
            </div>
          ))}
          <Input
            label="Ghi chú / lý do từ chối"
            maxLength={1000}
            value={notes[row.reservationId] || ""}
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [row.reservationId]: event.target.value,
              }))
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={
                !canApprove ||
                Boolean(busyId) ||
                !(notes[row.reservationId] || "").trim()
              }
              onClick={() => void decide(row, "REJECT")}
            >
              Từ chối
            </Button>
            <Button
              disabled={!canApprove || Boolean(busyId)}
              onClick={() => void decide(row, "APPROVE")}
            >
              {busyId === row.reservationId
                ? "Đang xử lý…"
                : "Chấp thuận hàng hóa"}
            </Button>
          </div>
        </Card>
      ))}
      {totalPages > 1 && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={loading || page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Trước
          </Button>
          <p>
            Trang {page + 1}/{totalPages}
          </p>
          <Button
            variant="outline"
            disabled={loading || page + 1 >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Sau
          </Button>
        </div>
      )}

      <div className="border-t border-stone-300 pt-6">
        <SectionHeader
          title="Danh sách kho đang được giữ"
          subtitle={`Có ${activeTotalItems} đơn đang hoạt động tại cơ sở của bạn. Mặc định ưu tiên lịch nhận kho gần nhất.`}
        />
      </div>
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_260px_auto] md:items-end">
          <Input label="Tìm mã đơn, khách hàng, email hoặc gian kho" value={queryInput} onChange={event => setQueryInput(event.target.value)} />
          <Select label="Trạng thái" value={status} onChange={event => { setStatus(event.target.value as ReservationStatus | ""); setActivePage(0) }}>
            <option value="">Tất cả trạng thái đang hoạt động</option>
            {Object.entries(activeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Button onClick={() => { setQuery(queryInput.trim()); setActivePage(0) }}>Tìm kiếm</Button>
        </div>
      </Card>
      {activeLoading && <p className="text-sm text-stone-500">Đang tải danh sách đang giữ kho…</p>}
      {!activeLoading && !activeRows.length && <Card className="p-8 text-center text-stone-500">Không có đơn đang giữ kho phù hợp bộ lọc.</Card>}
      {activeRows.map(row => {
        const current = progressIndex(row.status)
        return <Card key={row.reservationId} className="space-y-4 border-l-4 border-l-blue-500 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-blue-700">{row.reservationCode}</p>
              <h3 className="font-bold">{row.customerName}</h3>
              <p className="text-xs text-stone-500">{row.customerEmail} · {row.facilityName}</p>
              <p className="text-xs text-stone-500">{row.unitTypeName} · Gian kho: {row.assignedUnitCode || "Chưa phân"}</p>
            </div>
            <div className="text-right">
              <Badge variant="info">{activeStatusLabels[row.status] || row.status}</Badge>
              <p className="mt-2 text-xs text-stone-600">Lịch nhận kho: <b>{row.appointmentAt ? formatStaffDateTime(row.appointmentAt) : "Chưa chọn lịch"}</b></p>
              <p className="text-xs text-stone-500">Kỳ thuê: {formatStaffDate(row.startDate)} → {formatStaffDate(row.endDate)}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {progressSteps.map((step, index) => <div key={step} className={`rounded-lg border p-2 text-[11px] ${index < current ? "border-emerald-300 bg-emerald-50 text-emerald-900" : index === current ? "border-amber-500 bg-amber-50 font-bold text-amber-950" : "border-stone-200 bg-stone-50 text-stone-400"}`}>
              <span className="mr-1 font-bold">{index < current ? "✓" : index + 1}.</span>{step}
            </div>)}
          </div>
        </Card>
      })}
      {activeTotalPages > 1 && <div className="flex items-center justify-end gap-3">
        <Button variant="outline" disabled={activeLoading || activePage === 0} onClick={() => setActivePage(value => value - 1)}>Trước</Button>
        <span className="text-sm">Trang {activePage + 1}/{activeTotalPages}</span>
        <Button variant="outline" disabled={activeLoading || activePage + 1 >= activeTotalPages} onClick={() => setActivePage(value => value + 1)}>Sau</Button>
      </div>}
    </div>
  )
}
